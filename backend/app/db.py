from pathlib import Path

import aiosqlite

DB_PATH = Path(__file__).parent.parent / "data" / "verba.db"

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await aiosqlite.connect(str(DB_PATH))
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA cache_size=-128000")
        await _db.execute("PRAGMA mmap_size=1073741824")
        await _db.execute("PRAGMA temp_store=MEMORY")
    return _db


async def close_db():
    global _db
    if _db is not None:
        await _db.close()
        _db = None
