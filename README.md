# Verba

Type any word in any language. Watch its family tree bloom across 3000 years of human language.

**2.3M terms** · **3.7M etymological relationships** · **1.8M definitions** · **3,300+ languages**

## Setup

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python scripts/build_db.py              # ~25s
python scripts/build_definitions.py     # ~10min (downloads 2.5GB)

# Frontend
cd ../frontend
npm install

# Run
cd ..
./run.sh # http://localhost:5173
```

## Data

- [etymology-db](https://github.com/droher/etymology-db) — etymological relationships (CC-BY-SA 3.0)
- [wiktextract](https://kaikki.org/dictionary/) — word definitions from Wiktionary (CC-BY-SA 3.0)
