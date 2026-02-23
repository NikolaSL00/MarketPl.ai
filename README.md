# MarketPl.ai

Plain initialization of the application architecture:

- Frontend: React + Vite + TypeScript in `app/client`
- Backend: FastAPI + PyMongo in `app/backend`
- Database: MongoDB (non-relational) via Docker Compose

## Project Structure

.
├── app/
│   ├── client/
│   └── backend/
├── data_gathering/
└── docker-compose.yml

## 1) Start MongoDB

From the project root:

```bash
docker compose up -d
```

MongoDB will be available at `mongodb://localhost:27017`.

## 2) Start Backend (FastAPI)

```bash
cd app/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

Backend endpoints:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/health/db`

## 3) Start Frontend (React + Vite)

```bash
cd app/client
cp .env.example .env
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`.
