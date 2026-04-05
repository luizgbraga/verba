"""
ETL: Wiktextract JSON dump → definitions table in verba.db

Streams the compressed dump (~2.5GB) line-by-line through gunzip,
extracting only (word, lang, definition) for terms that exist in our
etymology database. Never loads the full dump into memory.

Usage:
    python scripts/build_definitions.py

The script will:
1. Stream-download the wiktextract dump
2. For each entry, check if (word, lang) exists in our terms table
3. If yes, store the first definition gloss
4. Build an index for fast lookups
"""

import gzip
import json
import sqlite3
import time
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DATA_DIR / "verba.db"
DUMP_URL = "https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz"
DUMP_PATH = DATA_DIR / "raw-wiktextract-data.jsonl.gz"

BATCH_SIZE = 10_000


def download_if_needed():
    if DUMP_PATH.exists():
        size_gb = DUMP_PATH.stat().st_size / (1024**3)
        print(f"  Dump already exists ({size_gb:.1f}GB), skipping download")
        return
    print(f"  Downloading {DUMP_URL}...")
    print("  (This is ~2.5GB, will take a while)")
    urllib.request.urlretrieve(DUMP_URL, str(DUMP_PATH))
    print(f"  Downloaded to {DUMP_PATH}")


def load_known_terms(conn: sqlite3.Connection) -> set[tuple[str, str]]:
    """Load all (term, lang) pairs from the terms table into a set for fast lookup."""
    print("  Loading known terms from database...")
    cursor = conn.execute("SELECT DISTINCT term, TRIM(lang) FROM terms")
    terms = set()
    for row in cursor:
        terms.add((row[0], row[1]))
    print(f"  Loaded {len(terms):,} unique (term, lang) pairs")
    return terms


def extract_definition(entry: dict) -> str | None:
    """Extract the first gloss from the first sense."""
    senses = entry.get("senses", [])
    for sense in senses:
        glosses = sense.get("glosses", [])
        if glosses:
            gloss = glosses[0]
            # Skip meta-glosses like "Alternative form of X"
            if gloss.startswith("Alternative") or gloss.startswith("Obsolete"):
                continue
            cleaned = gloss[:500].rstrip(".")
            return cleaned[0].upper() + cleaned[1:] if cleaned else cleaned
    return None


def main():
    t0 = time.perf_counter()

    # Step 1: Download
    print("Step 1: Download dump")
    download_if_needed()

    # Step 2: Load known terms for filtering
    conn = sqlite3.connect(str(DB_PATH))
    known = load_known_terms(conn)

    # Step 3: Create definitions table
    print("Step 2: Creating definitions table...")
    conn.execute("DROP TABLE IF EXISTS definitions")
    conn.execute("""
        CREATE TABLE definitions (
            term TEXT NOT NULL,
            lang TEXT NOT NULL,
            definition TEXT NOT NULL,
            PRIMARY KEY (term, lang)
        ) WITHOUT ROWID
    """)

    # Step 4: Stream and filter
    print("Step 3: Streaming dump and extracting definitions...")
    batch = []
    matched = 0
    processed = 0
    skipped_no_def = 0

    with gzip.open(str(DUMP_PATH), "rt", encoding="utf-8") as f:
        for line in f:
            processed += 1
            if processed % 500_000 == 0:
                elapsed = time.perf_counter() - t0
                print(
                    f"  Processed {processed:,} entries, {matched:,} matched ({elapsed:.0f}s)"
                )

            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            word = entry.get("word", "")
            lang = entry.get("lang", "")

            if (word, lang) not in known:
                continue

            definition = extract_definition(entry)
            if not definition:
                skipped_no_def += 1
                continue

            batch.append((word, lang, definition))
            matched += 1

            if len(batch) >= BATCH_SIZE:
                conn.executemany(
                    "INSERT OR IGNORE INTO definitions VALUES (?, ?, ?)",
                    batch,
                )
                batch.clear()

    # Flush remaining
    if batch:
        conn.executemany(
            "INSERT OR IGNORE INTO definitions VALUES (?, ?, ?)",
            batch,
        )

    # Step 5: Index
    print("Step 4: Building index...")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_def_lookup ON definitions(term, lang)")
    conn.commit()

    # Stats
    count = conn.execute("SELECT COUNT(*) FROM definitions").fetchone()[0]
    conn.close()

    elapsed = time.perf_counter() - t0
    print(f"\nDone in {elapsed:.0f}s")
    print(f"  Processed: {processed:,} entries")
    print(f"  Matched: {matched:,} definitions")
    print(f"  Skipped (no gloss): {skipped_no_def:,}")
    print(f"  Stored: {count:,} unique definitions")


if __name__ == "__main__":
    main()
