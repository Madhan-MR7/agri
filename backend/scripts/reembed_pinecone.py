"""Re-embed every vector in the Pinecone index with the current Gemini embedding model.

Needed after switching embedding models (text-embedding-004 was retired): vectors from
different models are not comparable, so old vectors no longer match new queries.
Each vector's text is read from its `text` (or `chunk`) metadata, embedded again, and
upserted with the same id and metadata.

Usage (from backend/):
    python -m scripts.reembed_pinecone --dry-run          # count what would be re-embedded
    python -m scripts.reembed_pinecone                     # re-embed in place
    python -m scripts.reembed_pinecone --target-namespace v2   # write to another namespace instead
"""
import argparse
import time

from pinecone import Pinecone

from app.config import settings
from app.services.llm import embed_documents

BATCH = 50  # vectors per fetch / embed / upsert round


def all_ids(index, namespace: str):
    token = None
    while True:
        page = index.list_paginated(namespace=namespace, limit=100, pagination_token=token)
        yield from (v.id for v in page.vectors)
        token = page.pagination.next if page.pagination else None
        if not token:
            break


def embed_with_retry(texts: list[str], attempts: int = 6) -> list[list[float]]:
    for i in range(attempts):
        try:
            return embed_documents(texts)
        except Exception as e:  # noqa: BLE001 - rate limits come back as various google errors
            if i == attempts - 1:
                raise
            wait = 2 ** i * 5
            print(f"  embed failed ({type(e).__name__}: {str(e)[:80]}), retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError("unreachable")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--namespace", default=settings.default_namespace, help="source namespace (default: DEFAULT_NAMESPACE)")
    ap.add_argument("--target-namespace", default=None, help="write here instead of overwriting in place")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    target = args.namespace if args.target_namespace is None else args.target_namespace

    index = Pinecone(api_key=settings.pinecone_api_key).Index(settings.pinecone_index)
    ids = list(all_ids(index, args.namespace))
    print(f"{len(ids)} vectors in namespace {args.namespace!r}; model={settings.gemini_embed_model} "
          f"dim={settings.gemini_embed_dim}; target namespace {target!r}")
    if args.dry_run:
        return

    done = skipped = 0
    for start in range(0, len(ids), BATCH):
        fetched = index.fetch(ids=ids[start : start + BATCH], namespace=args.namespace).vectors
        items = []
        for vid, v in fetched.items():
            md = dict(v.metadata or {})
            text = md.get("text") or md.get("chunk") or ""
            if text.strip():
                items.append((vid, text, md))
            else:
                skipped += 1
        if not items:
            continue

        vectors = embed_with_retry([t for _, t, _ in items])
        index.upsert(
            vectors=[{"id": vid, "values": vec, "metadata": md} for (vid, _, md), vec in zip(items, vectors)],
            namespace=target,
        )
        done += len(items)
        print(f"  {done}/{len(ids)} re-embedded")

    print(f"Finished: {done} re-embedded, {skipped} skipped (no text).")


if __name__ == "__main__":
    main()
