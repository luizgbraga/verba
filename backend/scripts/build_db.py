"""
ETL script: Parquet → SQLite
Reads etymology.parquet via Polars, builds an optimized SQLite database
for fast graph traversal queries.

Schema design:
- `terms` table: deduplicated (term, lang) pairs with integer PKs
- `relations` table: edges between terms with relation types
- Indexes on all lookup columns for fast recursive CTE traversal
"""

import sqlite3
import time
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).parent.parent / "data"
PARQUET_PATH = DATA_DIR / "etymology.parquet"
DB_PATH = DATA_DIR / "verba.db"


def main():
    t0 = time.perf_counter()

    print("Reading parquet...")
    df = pl.read_parquet(PARQUET_PATH)
    print(f"  {len(df):,} rows loaded in {time.perf_counter() - t0:.1f}s")

    # --- Build terms table ---
    print("Building terms table...")
    # Extract unique (term_id, term, lang) from both sides
    source_terms = df.select(
        pl.col("term_id").alias("id"),
        pl.col("term"),
        pl.col("lang"),
    ).unique(subset=["id"])

    related_terms = (
        df.filter(pl.col("related_term").is_not_null())
        .select(
            pl.col("related_term_id").alias("id"),
            pl.col("related_term").alias("term"),
            pl.col("related_lang").alias("lang"),
        )
        .unique(subset=["id"])
    )

    terms = pl.concat([source_terms, related_terms]).unique(subset=["id"])
    print(f"  {len(terms):,} unique terms")

    # --- Build relations table ---
    print("Building relations table...")
    relations = (
        df.filter(pl.col("related_term").is_not_null())
        .select(
            pl.col("term_id").alias("source_id"),
            pl.col("related_term_id").alias("target_id"),
            pl.col("reltype").alias("relation_type"),
        )
        .unique()
    )
    print(f"  {len(relations):,} unique relations")

    # --- Write to SQLite ---
    print("Writing SQLite database...")
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=OFF")  # Safe for bulk write
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA cache_size=-512000")  # 512MB cache for build

    conn.execute("""
        CREATE TABLE terms (
            id TEXT PRIMARY KEY,
            term TEXT NOT NULL,
            lang TEXT NOT NULL
        ) WITHOUT ROWID
    """)

    conn.execute("""
        CREATE TABLE relations (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relation_type TEXT NOT NULL
        )
    """)

    # Bulk insert terms
    print("  Inserting terms...")
    conn.executemany(
        "INSERT OR IGNORE INTO terms VALUES (?, ?, ?)",
        terms.iter_rows(),
    )

    # Bulk insert relations
    print("  Inserting relations...")
    conn.executemany(
        "INSERT INTO relations VALUES (?, ?, ?)",
        relations.iter_rows(),
    )

    # Build indexes AFTER insert (faster)
    print("  Building indexes...")
    conn.execute("CREATE INDEX idx_terms_term_lang ON terms(term, lang)")
    conn.execute("CREATE INDEX idx_terms_lang ON terms(lang)")
    conn.execute("CREATE INDEX idx_terms_term ON terms(term)")
    conn.execute("CREATE INDEX idx_relations_source ON relations(source_id)")
    conn.execute("CREATE INDEX idx_relations_target ON relations(target_id)")
    conn.execute("CREATE INDEX idx_relations_type ON relations(relation_type)")

    conn.commit()

    # Optimize
    conn.execute("ANALYZE")
    conn.execute("PRAGMA optimize")
    conn.close()

    elapsed = time.perf_counter() - t0
    size_mb = DB_PATH.stat().st_size / 1024 / 1024
    print(f"\nDone in {elapsed:.1f}s — {size_mb:.0f}MB database at {DB_PATH}")


if __name__ == "__main__":
    main()
