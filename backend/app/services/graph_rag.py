"""Graph RAG over the Neo4j agricultural knowledge graph.

Retrieval strategy (works with any schema loaded by graph/ingest.py):
  1. Match entities named in the question via the `entity_names` full-text index.
  2. Expand up to 2 hops around the matched entities.
  3. Serialise the paths as "(Type) name -[RELATION]-> (Type) name" facts for the LLM.

Multi-hop facts are what let the bot answer questions such as
"Which fungicide treats the disease that affects wheat grown in black soil?"
that pure vector search struggles with.
"""
import logging
import re

from app.db.neo4j_client import run_read

log = logging.getLogger(__name__)

_STOPWORDS = {
    "what", "which", "when", "where", "how", "why", "the", "and", "for", "with", "that", "this",
    "is", "are", "my", "in", "of", "to", "a", "an", "on", "can", "i", "do", "does", "should",
    "crop", "crops", "plant", "plants", "give", "tell", "about", "me", "it", "from", "best",
}

_ENTITY_QUERY = """
CALL db.index.fulltext.queryNodes('entity_names', $q) YIELD node, score
WHERE score > $min_score
RETURN elementId(node) AS id, node.name AS name, labels(node)[0] AS type, score
ORDER BY score DESC LIMIT $limit
"""

_NEIGHBOURHOOD_QUERY = """
MATCH (n) WHERE elementId(n) IN $ids
MATCH p = (n)-[*1..2]-(m)
WITH p LIMIT $max_paths
UNWIND relationships(p) AS r
WITH DISTINCT r
RETURN labels(startNode(r))[0] AS h_type, startNode(r).name AS head,
       type(r) AS rel, properties(r) AS rel_props,
       labels(endNode(r))[0] AS t_type, endNode(r).name AS tail
LIMIT $max_facts
"""


def _lucene_query(question: str) -> str:
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z\-]{2,}", question.lower()) if w not in _STOPWORDS]
    # Fuzzy match each keyword so "blights" still finds "Blight"
    return " OR ".join(f"{re.sub(r'[^a-z]', '', w)}~" for w in words if re.sub(r"[^a-z]", "", w))


def find_entities(question: str, limit: int = 8, min_score: float = 0.5) -> list[dict]:
    q = _lucene_query(question)
    if not q:
        return []
    return run_read(_ENTITY_QUERY, q=q, limit=limit, min_score=min_score)


def retrieve_facts(question: str, max_facts: int = 60) -> list[str]:
    try:
        entities = find_entities(question)
        if not entities:
            return []
        rows = run_read(
            _NEIGHBOURHOOD_QUERY, ids=[e["id"] for e in entities], max_paths=300, max_facts=max_facts
        )
    except Exception as e:  # noqa: BLE001
        log.warning("Graph RAG retrieval failed: %s", e)
        return []

    facts = []
    for r in rows:
        props = {k: v for k, v in (r.get("rel_props") or {}).items() if k != "source" and v not in (None, "")}
        extra = f" {props}" if props else ""
        facts.append(f"({r['h_type']}) {r['head']} -[{r['rel']}{extra}]-> ({r['t_type']}) {r['tail']}")
    log.info("Graph RAG: %d entities, %d facts", len(entities), len(facts))
    return facts
