# Verba

Built for curious language enthusiasts:

<img width="1470" height="830" alt="image" src="https://github.com/user-attachments/assets/df96f258-a9f5-42cc-abd9-1f82c7f489b4" />


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
