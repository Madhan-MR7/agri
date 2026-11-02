"""Hybrid RAG: Pinecone vector search + Neo4j knowledge graph + Gemini generation."""
import hashlib
import logging
from dataclasses import dataclass, field
from functools import lru_cache

from app.config import settings
from app.services import graph_rag, llm

log = logging.getLogger(__name__)


@dataclass
class RagAnswer:
    answer: str
    citations: list[str] = field(default_factory=list)
    source_type: str = "model"  # model | rag | graph | hybrid
    graph_facts: int = 0


@lru_cache
def _index():
    from pinecone import Pinecone

    if not (settings.pinecone_api_key and settings.pinecone_index):
        return None
    return Pinecone(api_key=settings.pinecone_api_key).Index(settings.pinecone_index)


def _vector_contexts(vec: list[float], namespace: str) -> tuple[list[str], list[str]]:
    index = _index()
    if index is None:
        return [], []
    res = index.query(vector=vec, top_k=25, include_metadata=True, namespace=namespace)
    contexts, citations = [], []
    for m in res.get("matches", []) if res else []:
        if m.get("score", 0) < settings.rag_similarity_threshold:
            continue
        md = m.get("metadata", {})
        snippet = md.get("text") or md.get("chunk") or ""
        if snippet:
            contexts.append(snippet)
            citations.append(md.get("source", "document"))
    return contexts, citations


def _cache_answer(vec: list[float], question: str, answer: str, namespace: str) -> None:
    index = _index()
    if index is None:
        return
    try:
        vector_id = hashlib.sha256(question.encode()).hexdigest()
        index.upsert(
            vectors=[{
                "id": f"qa-{vector_id}",
                "values": vec,
                "metadata": {"text": answer, "question": question, "source": "gemini-auto"},
            }],
            namespace=namespace,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("Failed to store answer in Pinecone: %s", e)


def hybrid_answer(question_en: str, namespace: str | None = None, disease_mode: bool = False) -> RagAnswer:
    namespace = namespace or settings.default_namespace

    vec = llm.embed_text(question_en)
    contexts, citations = _vector_contexts(vec, namespace)
    facts = graph_rag.retrieve_facts(question_en)

    if contexts and facts:
        source_type = "hybrid"
    elif facts:
        source_type = "graph"
    elif contexts:
        source_type = "rag"
    else:
        source_type = "model"
    if facts:
        citations.append("knowledge-graph")

    context_block = "\n\n---\n".join(contexts[:5]) if contexts else "(none)"
    facts_block = "\n".join(facts) if facts else "(none)"
    format_rules = (
        "- Include Disease Name, Symptoms, Cause/Disease Cycle, and Management (organic and chemical remedies)."
        if disease_mode
        else "- Answer the question directly first, then give practical steps."
    )

    prompt = f"""
You are a professional agriculture advisor helping smallholder farmers.

QUESTION:
{question_en}

DOCUMENT CONTEXT (from the knowledge base, may be empty):
{context_block}

KNOWLEDGE GRAPH FACTS (entity -[relation]-> entity, may be empty):
{facts_block}

INSTRUCTIONS:
- Prefer the knowledge graph facts and document context over general knowledge; chain graph facts
  together to answer multi-step questions.
- If the context does not cover the question, answer from general agronomy knowledge.
- Use bullet points; keep sentences short and farmer-friendly.
{format_rules}
"""
    answer = llm.generate(prompt)

    if source_type == "model" and answer and settings.rag_cache_llm_answers:
        _cache_answer(vec, question_en, answer, namespace)

    return RagAnswer(answer=answer, citations=citations, source_type=source_type, graph_facts=len(facts))
