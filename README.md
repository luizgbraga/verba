# Verba

Built for curious language enthusiasts:

<img width="1470" height="830" alt="image" src="https://github.com/user-attachments/assets/adf91745-2c94-4e08-9e31-3caeef5441aa" />

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
