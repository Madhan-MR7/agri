"""Load knowledge-graph triples into Neo4j for graph RAG.

Usage (from backend/, with `docker compose up -d neo4j` running):
    python -m graph.ingest graph/sample_triples.csv
    python -m graph.ingest data/my_triples.csv --wipe

CSV columns (header required):
    head, head_type, relation, tail, tail_type      required
    source                                          optional, stored on the relationship
    <anything else>                                 optional, stored as relationship properties
e.g.  Wheat,Crop,SUSCEPTIBLE_TO,Wheat Yellow Rust,Disease,ICAR handbook

Every node gets the shared `:Entity` label plus its own type label, so the full-text
index `entity_names` used by app/services/graph_rag.py covers all entity types.
"""
import argparse
import csv
import re
from collections import defaultdict
from pathlib import Path

from app.db.neo4j_client import close, run_write

REQUIRED = ["head", "head_type", "relation", "tail", "tail_type"]
BATCH = 500

SCHEMA = [
    "CREATE CONSTRAINT entity_key IF NOT EXISTS FOR (n:Entity) REQUIRE n.key IS UNIQUE",
    "CREATE FULLTEXT INDEX entity_names IF NOT EXISTS FOR (n:Entity) ON EACH [n.name]",
]


def _ident(value: str, upper: bool = False) -> str:
    """Make a safe Cypher label / relationship type (they can't be query parameters)."""
    words = re.findall(r"[A-Za-z0-9]+", value)
    if not words:
        raise ValueError(f"Invalid label/relation: {value!r}")
    ident = "_".join(w.upper() for w in words) if upper else "".join(w[:1].upper() + w[1:] for w in words)
    return ident if ident[0].isalpha() else f"X{ident}"


def _merge_query(head_type: str, rel: str, tail_type: str) -> str:
    return f"""
UNWIND $rows AS row
MERGE (h:Entity {{key: '{head_type}:' + toLower(row.head)}})
  ON CREATE SET h.name = row.head
SET h:{head_type}
MERGE (t:Entity {{key: '{tail_type}:' + toLower(row.tail)}})
  ON CREATE SET t.name = row.tail
SET t:{tail_type}
MERGE (h)-[r:{rel}]->(t)
SET r += row.props
"""


def load(path: Path, wipe: bool = False) -> None:
    for stmt in SCHEMA:
        run_write(stmt)
    if wipe:
        run_write("MATCH (n:Entity) DETACH DELETE n")

    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"{path} is missing columns: {missing}")
        for row in reader:
            if not all((row.get(c) or "").strip() for c in REQUIRED):
                continue
            key = (_ident(row["head_type"]), _ident(row["relation"], upper=True), _ident(row["tail_type"]))
            props = {k: v.strip() for k, v in row.items() if k not in REQUIRED and v and v.strip()}
            groups[key].append({"head": row["head"].strip(), "tail": row["tail"].strip(), "props": props})

    total = 0
    for (h_type, rel, t_type), rows in groups.items():
        query = _merge_query(h_type, rel, t_type)
        for i in range(0, len(rows), BATCH):
            run_write(query, rows=rows[i : i + BATCH])
        total += len(rows)
        print(f"  {h_type} -[{rel}]-> {t_type}: {len(rows)}")
    print(f"Loaded {total} triples from {path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path, nargs="+")
    ap.add_argument("--wipe", action="store_true", help="delete existing graph entities first")
    args = ap.parse_args()
    try:
        for i, p in enumerate(args.csv):
            load(p, wipe=args.wipe and i == 0)
    finally:
        close()


if __name__ == "__main__":
    main()
