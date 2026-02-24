# MarketPl.ai Frontend

React + Vite + TypeScript UI for importing price data, exploring it, and running backtests.

## Requirements

- Node.js 18+
- Backend API running on `http://localhost:8000`

## Run Locally

From this folder:

```bash
npm install
npm run dev
```

The app runs on http://localhost:5173.

### API proxy

During development, Vite proxies requests from `/api/*` to `http://localhost:8000` (see `vite.config.ts`).
The frontend code calls the API using relative URLs (e.g. `/api/stock-prices`).

If you need to point to a different backend URL, update the proxy target in `vite.config.ts`.

## Environment

There is an `app/client/.env.example` with `VITE_API_BASE_URL`, but the current fetch layer uses relative `/api` paths (so this variable is not required for local dev).

## App Routes

- `/import` – upload CSV and monitor import status
- `/data` – browse imported price data
- `/backtest` – run single-symbol and comparison backtests
- `/portfolio` – run small portfolio backtests

## Scripts

- `npm run dev` – start dev server
- `npm run build` – type-check + production build
- `npm run lint` – run ESLint
- `npm run preview` – preview production build locally
