# AstraGuard AI 🛰️

> **Real-time space debris tracking and orbital conjunction analysis**  
> A full-stack monorepo scaffolded with [IBM Bob](https://bob.ibm.com).

---

## Architecture

```
AstraGuard-AI/
├── backend/                    # Python FastAPI service
│   ├── main.py                 # API routes + TLE parsing
│   ├── requirements.txt        # Python dependencies
│   ├── setup_env.sh            # Unix venv bootstrap script
│   └── setup_env.bat           # Windows venv bootstrap script
│
├── frontend/                   # Next.js 14 (TypeScript) UI
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout (dark theme)
│   │   │   ├── page.tsx        # Entry page → Dashboard
│   │   │   └── globals.css     # Tailwind base + custom styles
│   │   └── components/
│   │       ├── Dashboard.tsx   # Main dashboard shell
│   │       ├── MetricCard.tsx  # Reusable KPI card component
│   │       ├── SatelliteTable.tsx  # Live TLE satellite table
│   │       └── StatusBar.tsx   # Backend connectivity indicator
│   ├── next.config.js          # Proxy /api/* → localhost:8000
│   ├── tailwind.config.ts      # Custom space colour palette
│   └── package.json
│
└── README.md
```

### Data Flow

```
CelesTrak HTTPS API
       │
       ▼
FastAPI /api/satellites/tle   ← GET ?group=active_sats&limit=50
       │   (TLE text → parsed JSON)
       ▼
Next.js API proxy  /api/*  →  localhost:8000
       │
       ▼
Dashboard.tsx  →  MetricCard × 5  +  SatelliteTable
```

---

## Stack

| Layer     | Technology                                |
|-----------|-------------------------------------------|
| Frontend  | Next.js 14 · TypeScript · Tailwind CSS · Lucide React |
| Backend   | Python 3.11+ · FastAPI · uvicorn · httpx  |
| Orbital   | sgp4 · skyfield (TLE propagation)         |
| Data      | CelesTrak live TLE feeds (HTTPS/JSON)     |

---

## Quick Start

### 1 — Backend

**Unix / macOS**
```bash
cd backend
chmod +x setup_env.sh && ./setup_env.sh
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Windows**
```cmd
cd backend
setup_env.bat
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

API docs auto-generated at **http://localhost:8000/docs**

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

> The `next.config.js` automatically proxies `/api/*` requests to the FastAPI backend so no CORS configuration is needed in development.

---

## API Reference

| Method | Endpoint                   | Description                              |
|--------|----------------------------|------------------------------------------|
| GET    | `/`                        | Health check / service info              |
| GET    | `/health`                  | Liveness probe                           |
| GET    | `/api/satellites/tle`      | Live TLE data from CelesTrak             |
| GET    | `/api/satellites/groups`   | List all available TLE groups            |
| GET    | `/api/stats`               | Dashboard aggregate statistics           |

### TLE Groups

| ID               | Description                         |
|------------------|-------------------------------------|
| `active_sats`    | All active satellites (default)     |
| `stations`       | Space stations (ISS, CSS, …)        |
| `visual`         | Visually observable objects         |
| `debris_cosmos`  | Cosmos-2251 collision debris        |
| `debris_iridium` | Iridium-33 collision debris         |
| `fengyun`        | Fengyun-1C debris                   |
| `last_30_days`   | Recently launched objects           |

**Example request:**
```
GET /api/satellites/tle?group=stations&limit=10
```

---

## Dashboard Features

- **Active Objects Tracked** — live count from CelesTrak active catalog
- **High-Risk Conjunctions** — close-approach events within 1 km (next 7 days)
- **Next Orbital Pass** — estimated ISS overpass time via skyfield
- **Total Debris Objects** — tracked fragments from major collision events
- **LEO Density Index** — normalized crowding index for low Earth orbit
- **Live Satellite Table** — 50 most recent TLE entries with altitude-based risk classification

---

## Built With IBM Bob

This project was scaffolded end-to-end using **IBM Bob** (AI software engineer):

- Full-stack monorepo structure generated in a single prompt
- FastAPI endpoint with live TLE parsing and orbital mechanics
- Next.js dark-space dashboard with reusable component architecture
- Tailwind custom colour palette, animated CSS, and responsive layout
- Windows + Unix environment bootstrap scripts

---

## Environment Variables

Create a `.env` file in `backend/` (optional, for future auth):

```env
CELESTRAK_API_KEY=   # Not required for public endpoints
PORT=8000
```

---

## Roadmap

- [ ] WebSocket live conjunction alerts
- [ ] 3-D orbital visualisation (Three.js / CesiumJS)
- [ ] skyfield-powered real overpass predictions
- [ ] SOCRATES conjunction data integration
- [ ] Satellite search and filtering UI
- [ ] Historical debris event timeline

---

*Data sourced from [CelesTrak](https://celestrak.org) — Dr. T.S. Kelso.*
