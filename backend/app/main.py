from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.db import close_db, get_db
from app.queries import build_tree, find_term_by_id, get_languages, search_terms


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await get_db()
    yield
    await close_db()


app = FastAPI(title="Verba", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"]
)


@app.get("/api/tree")
async def tree(
    term: str = Query(..., min_length=1),
    lang: str | None = Query(None),
    depth: int = Query(5, ge=1, le=8),
):
    return await build_tree(term, lang, depth)


@app.get("/api/tree/{term_id}")
async def tree_by_id(term_id: str, depth: int = Query(5, ge=1, le=8)):
    term_data = await find_term_by_id(term_id)
    if not term_data:
        return {"root": None, "nodes": [], "edges": []}
    return await build_tree(term_data["term"], term_data["lang"], depth)


@app.get("/api/search")
async def search(
    q: str = Query(..., min_length=1),
    lang: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    return {"results": await search_terms(q, lang, limit)}


@app.get("/api/languages")
async def languages():
    return {"languages": await get_languages()}
