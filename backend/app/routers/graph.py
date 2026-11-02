"""Knowledge-graph inspection endpoints (handy while loading the graph RAG dataset)."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.db.neo4j_client import get_driver, run_read
from app.services import graph_rag

router = APIRouter(prefix="/api/graph", tags=["graph"])


class GraphQuery(BaseModel):
    question: str


@router.get("/status")
def status():
    if get_driver() is None:
        return {"connected": False}
    labels = run_read("MATCH (n) RETURN labels(n)[0] AS label, count(*) AS count ORDER BY count DESC")
    rels = run_read("MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS count ORDER BY count DESC")
    return {"connected": True, "nodes": labels, "relationships": rels}


@router.post("/facts")
def facts(body: GraphQuery):
    """Show which entities and facts graph RAG would add to the prompt for a question."""
    return {"entities": graph_rag.find_entities(body.question), "facts": graph_rag.retrieve_facts(body.question)}
