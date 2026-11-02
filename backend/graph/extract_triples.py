"""Turn unstructured agriculture text (.txt / .md) into triples CSV for graph/ingest.py.

Usage (from backend/):
    python -m graph.extract_triples docs/ --out graph/import/extracted_triples.csv

Review the CSV before loading it: LLM extraction is fast but not always correct.
"""
import argparse
import csv
import json
import re
from pathlib import Path

from app.services import llm

ENTITY_TYPES = [
    "Crop", "Disease", "Pest", "Pathogen", "Symptom", "Remedy", "Fertilizer", "Pesticide",
    "SoilType", "Season", "Region", "Climate", "Nutrient", "Practice", "Variety",
]
RELATIONS = [
    "SUSCEPTIBLE_TO", "CAUSED_BY", "HAS_SYMPTOM", "TREATED_BY", "PREVENTED_BY", "GROWS_IN",
    "SUITABLE_FOR_SEASON", "GROWN_IN_REGION", "REQUIRES_NUTRIENT", "DEFICIENCY_CAUSES",
    "RECOMMENDED_FERTILIZER", "HAS_VARIETY", "ATTACKS", "FAVOURED_BY", "ROTATES_WITH",
]

PROMPT = """Extract agricultural knowledge-graph triples from the text below.
Entity types: {types}
Relations: {rels}
Return ONLY a JSON array of objects with keys head, head_type, relation, tail, tail_type.
Use short canonical entity names (e.g. "Wheat Yellow Rust", "Mancozeb"). Skip anything uncertain.

TEXT:
{text}
"""


def _chunks(text: str, size: int = 4000):
    paras, buf = text.split("\n\n"), ""
    for p in paras:
        if len(buf) + len(p) > size and buf:
            yield buf
            buf = ""
        buf += p + "\n\n"
    if buf.strip():
        yield buf


def extract(text: str) -> list[dict]:
    raw = llm.generate(PROMPT.format(types=", ".join(ENTITY_TYPES), rels=", ".join(RELATIONS), text=text))
    match = re.search(r"\[.*\]", raw, re.S)
    if not match:
        return []
    try:
        items = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    keys = ("head", "head_type", "relation", "tail", "tail_type")
    return [{k: str(i[k]).strip() for k in keys} for i in items if isinstance(i, dict) and all(i.get(k) for k in keys)]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", type=Path, nargs="+", help="files or folders of .txt/.md")
    ap.add_argument("--out", type=Path, default=Path("graph/import/extracted_triples.csv"))
    args = ap.parse_args()

    files = []
    for p in args.inputs:
        files += sorted(p.rglob("*.txt")) + sorted(p.rglob("*.md")) if p.is_dir() else [p]

    seen, rows = set(), []
    for f in files:
        for chunk in _chunks(f.read_text(encoding="utf-8", errors="ignore")):
            for t in extract(chunk):
                key = (t["head"].lower(), t["relation"], t["tail"].lower())
                if key not in seen:
                    seen.add(key)
                    rows.append({**t, "source": f.name})
        print(f"{f}: {len(rows)} triples so far")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["head", "head_type", "relation", "tail", "tail_type", "source"])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} triples to {args.out}")


if __name__ == "__main__":
    main()
