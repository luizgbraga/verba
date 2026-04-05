from app.db import get_db

ORIGIN_RELATIONS = {
    "inherited_from",
    "borrowed_from",
    "derived_from",
    "learned_borrowing_from",
    "semi_learned_borrowing_from",
    "orthographic_borrowing_from",
    "unadapted_borrowing_from",
    "calque_of",
    "partial_calque_of",
    "semantic_loan_from",
    "phono_semantic_matching_from",
}

COMPOUND_RELATIONS = {
    "compound_of",
    "blend_of",
    "has_prefix",
    "has_suffix",
    "has_confix",
}

_REL_IN = ",".join(f"'{r}'" for r in ORIGIN_RELATIONS)
_COMP_IN = ",".join(f"'{r}'" for r in COMPOUND_RELATIONS)


def _row_to_term(row) -> dict:
    return {"id": row["id"], "term": row["term"], "lang": row["lang"]}


async def find_term(term: str, lang: str | None = None) -> dict | None:
    """Case-insensitive lookup, preferring the variant with the most relations."""
    db = await get_db()
    if lang:
        cursor = await db.execute(
            """SELECT t.id, t.term, t.lang,
                       (SELECT COUNT(*) FROM relations r
                        WHERE r.source_id = t.id OR r.target_id = t.id) as rel_count
                FROM terms t
                WHERE t.term = ? COLLATE NOCASE AND t.lang = ?
                ORDER BY rel_count DESC, (t.term = ?) DESC
                LIMIT 1""",
            (term, lang, term),
        )
    else:
        cursor = await db.execute(
            """SELECT t.id, t.term, t.lang,
                       (SELECT COUNT(*) FROM relations r
                        WHERE r.source_id = t.id OR r.target_id = t.id) as rel_count
                FROM terms t
                WHERE t.term = ? COLLATE NOCASE
                ORDER BY rel_count DESC, (t.term = ?) DESC
                LIMIT 1""",
            (term, term),
        )
    row = await cursor.fetchone()
    return _row_to_term(row) if row else None


async def find_term_by_id(term_id: str) -> dict | None:
    db = await get_db()
    cursor = await db.execute(
        "SELECT id, term, lang FROM terms WHERE id = ? LIMIT 1", (term_id,)
    )
    row = await cursor.fetchone()
    return _row_to_term(row) if row else None


async def _traverse(term_id: str, direction: str, max_depth: int) -> tuple[list, list]:
    """BFS traversal. direction='up' follows source→target, 'down' follows target→source."""
    db = await get_db()
    nodes, edges = {}, []
    frontier, visited = {term_id}, set()

    for _ in range(max_depth):
        if not frontier:
            break
        visited |= frontier
        ph = ",".join("?" * len(frontier))

        if direction == "up":
            q = f"SELECT r.source_id, r.target_id, r.relation_type, t.id as tid, t.term, t.lang FROM relations r JOIN terms t ON t.id = r.target_id WHERE r.source_id IN ({ph}) AND r.relation_type IN ({_REL_IN})"
        else:
            q = f"SELECT r.source_id, r.target_id, r.relation_type, t.id as tid, t.term, t.lang FROM relations r JOIN terms t ON t.id = r.source_id WHERE r.target_id IN ({ph}) AND r.relation_type IN ({_REL_IN})"

        cursor = await db.execute(q, list(frontier))
        rows = await cursor.fetchall()
        next_frontier = set()
        for row in rows:
            tid = row["tid"]
            nodes[tid] = {"id": tid, "term": row["term"], "lang": row["lang"]}
            edges.append(
                {
                    "source": row["source_id"],
                    "target": row["target_id"],
                    "relation": row["relation_type"],
                }
            )
            if tid not in visited:
                next_frontier.add(tid)
        frontier = next_frontier

    return list(nodes.values()), edges


async def get_cognates(term_id: str) -> tuple[list, list]:
    db = await get_db()
    cursor = await db.execute(
        """SELECT r.source_id, r.target_id,
                  t1.id as s_id, t1.term as s_term, t1.lang as s_lang,
                  t2.id as t_id, t2.term as t_term, t2.lang as t_lang
           FROM relations r
           JOIN terms t1 ON t1.id = r.source_id
           JOIN terms t2 ON t2.id = r.target_id
           WHERE (r.source_id = ? OR r.target_id = ?) AND r.relation_type = 'cognate_of'
           LIMIT 50""",
        (term_id, term_id),
    )
    rows = await cursor.fetchall()
    nodes = {}
    edges = []
    for row in rows:
        nodes[row["s_id"]] = {
            "id": row["s_id"],
            "term": row["s_term"],
            "lang": row["s_lang"],
        }
        nodes[row["t_id"]] = {
            "id": row["t_id"],
            "term": row["t_term"],
            "lang": row["t_lang"],
        }
        edges.append(
            {
                "source": row["source_id"],
                "target": row["target_id"],
                "relation": "cognate_of",
            }
        )
    nodes.pop(term_id, None)
    return list(nodes.values()), edges


async def get_compounds(term_id: str) -> tuple[list, list]:
    db = await get_db()
    cursor = await db.execute(
        f"SELECT r.source_id, r.target_id, r.relation_type, t.id as tid, t.term, t.lang FROM relations r JOIN terms t ON t.id = r.target_id WHERE r.source_id = ? AND r.relation_type IN ({_COMP_IN})",
        (term_id,),
    )
    rows = await cursor.fetchall()
    nodes = {}
    edges = []
    for row in rows:
        nodes[row["tid"]] = {"id": row["tid"], "term": row["term"], "lang": row["lang"]}
        edges.append(
            {
                "source": row["source_id"],
                "target": row["target_id"],
                "relation": row["relation_type"],
            }
        )
    return list(nodes.values()), edges


async def build_tree(term: str, lang: str | None = None, depth: int = 5) -> dict:
    root = await find_term(term, lang)
    if not root:
        return {"root": None, "nodes": [], "edges": []}

    all_nodes = {root["id"]: root}
    all_edges = []

    for nodes, edges in [
        await _traverse(root["id"], "up", depth),
        await _traverse(root["id"], "down", depth),
        await get_cognates(root["id"]),
        await get_compounds(root["id"]),
    ]:
        for n in nodes:
            all_nodes[n["id"]] = n
        all_edges.extend(edges)

    seen = set()
    unique = []
    for e in all_edges:
        key = (e["source"], e["target"], e["relation"])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    # Batch-fetch definitions for all nodes in one query
    node_list = list(all_nodes.values())
    definitions = await _batch_definitions(node_list)
    for n in node_list:
        key = (n["term"], n["lang"])
        if key in definitions:
            n["definition"] = definitions[key]

    return {"root": root, "nodes": node_list, "edges": unique}


async def _batch_definitions(nodes: list[dict]) -> dict[tuple[str, str], str]:
    """Fetch definitions for a batch of nodes in a single query."""
    db = await get_db()
    if not nodes:
        return {}

    # Check if definitions table exists
    cursor = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='definitions'"
    )
    if not await cursor.fetchone():
        return {}

    # Build batch query with UNION ALL for each (term, lang) pair
    pairs = list({(n["term"], n["lang"]) for n in nodes})
    if not pairs:
        return {}

    placeholders = " OR ".join(["(term = ? AND lang = ?)"] * len(pairs))
    params = [v for pair in pairs for v in pair]

    cursor = await db.execute(
        f"SELECT term, lang, definition FROM definitions WHERE {placeholders}",
        params,
    )
    rows = await cursor.fetchall()
    return {(r["term"], r["lang"]): r["definition"] for r in rows}


async def search_terms(query: str, lang: str | None = None, limit: int = 20) -> list:
    """Prefix search with case-variant deduplication."""
    db = await get_db()
    fetch_limit = limit * 3
    params: list = [f"{query}%"]
    lang_clause = ""
    if lang:
        lang_clause = "AND t.lang = ?"
        params.append(lang)
    params.append(fetch_limit)

    cursor = await db.execute(
        f"""SELECT t.term, t.lang,
                   (SELECT COUNT(*) FROM relations r WHERE r.source_id = t.id OR r.target_id = t.id) as rel_count
            FROM terms t WHERE t.term LIKE ? {lang_clause}
            GROUP BY t.term, t.lang ORDER BY rel_count DESC LIMIT ?""",
        params,
    )
    rows = await cursor.fetchall()

    seen: set[tuple[str, str]] = set()
    results = []
    for r in rows:
        key = (r["term"].lower(), r["lang"])
        if key in seen:
            continue
        seen.add(key)
        results.append({"term": r["term"], "lang": r["lang"]})
        if len(results) >= limit:
            break
    return results


async def get_languages() -> list:
    db = await get_db()
    cursor = await db.execute(
        "SELECT DISTINCT TRIM(lang) as lang FROM terms ORDER BY lang"
    )
    rows = await cursor.fetchall()
    return [r["lang"] for r in rows if r["lang"] and r["lang"].strip()]
