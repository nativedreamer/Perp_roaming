# 24/7 Binance Futures Scanner

An autonomous, 24/7 perpetual futures market scanner and algorithmic signal generation engine. The system continuously analyzes all USDT Perpetual contracts on Binance using the **EMA 11/34 crossover + VWAP + EMA 200 Zone** strategy, calculating ATR-based Stop-Loss (SL) and multi-tier Take-Profit (TP1-TP4) targets, logging trades to SQLite, and serving an interactive live web dashboard.

**Zero Configuration Required** — Starts and scans out of the box with zero setup.

---

## ⚡ Features

- **24/7 Autonomous Scanning**: Asynchronous `aiohttp` engine continuously cycling through all active Binance USDT Perpetual contracts.
- **Zero Config**: No `.env` or external setup required — starts immediately with tuned defaults.
- **Smart Rate-Limiting**: Controlled concurrency (`Semaphore`) and request delays to strictly adhere to Binance API constraints (preventing HTTP 429/418 bans).
- **Algorithmic Strategy Execution**:
  - EMA 11/34 crossover on confirmed candle close
  - VWAP vs EMA 200 Zone alignment filter
  - Confirming candle color filter (Green for Long, Red for Short)
  - ATR(14) dynamic Stop-Loss (`2.5 × ATR`) and Take-Profit targets (`1.5R`, `2.0R`, `3.0R`, `4.0R`)
  - Bar cooldown filter preventing repeat triggers
- **Trade Resolution Engine**: Automatically monitors open signals against live candle highs/lows to log `TP1 HIT`, `TP2 HIT`, `TP3 HIT`, `TP4 HIT`, and `SL HIT`.
- **Interactive Web Dashboard**:
  - Start/Pause 24/7 background scanning with one click
  - Trigger instant manual scan passes
  - Real-time signals feed with TP/SL hit status tracking
  - Historical in-browser backtester over Binance candles
  - Live trending pairs and 24h ticker cards
- **Persistence**: SQLite database (`signals.db`) recording all signals, levels, and audit logs.
- **Production Ready**: Pre-configured with `Dockerfile`, `docker-compose.yml`, and `render.yaml` for 1-click cloud deployment.

---

## 📁 Repository Structure

```
├── backend/
│   ├── __init__.py           # Python package marker
│   ├── config.py             # Built-in configuration defaults (no .env required)
│   ├── strategy.py           # EMA 11/34 + VWAP + EMA 200 + ATR mathematical logic
│   ├── database.py           # SQLite persistence layer (signals.db)
│   ├── scanner.py            # Rate-limited 24/7 Binance Futures market scanner
│   ├── main.py               # FastAPI server, REST endpoints & static frontend serving
│   └── requirements.txt      # Python dependencies
├── frontend/
│   └── index.html            # Connected web dashboard
├── .gitignore                # Git ignore rules for Python, SQLite, and caches
├── Dockerfile                # Production container specification
├── docker-compose.yml        # Docker Compose service definition with persistent volume
├── render.yaml               # Infrastructure-as-Code blueprint for Render.com
└── README.md                 # Complete documentation
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Python 3.10 or higher

### 1. Clone & Setup Environment

```bash
git clone https://github.com/nativedreamer/Perp_roaming.git
cd Perp_roaming

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. Run the Service (Zero Configuration)

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Dashboard:** Open [http://localhost:8000](http://localhost:8000)
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

The scanner starts automatically in the background and continuously monitors all Binance USDT Perpetual pairs!

---

## ☁️ 24/7 Cloud Deployment on Render.com

### Method 1: Render Blueprint (Recommended)
1. Push this repository to GitHub.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository: `nativedreamer/Perp_roaming`.
5. Click **Apply**. Render will automatically provision the Python service, attach persistent storage for `signals.db`, and start scanning 24/7!

### Method 2: Manual Web Service
1. On Render, click **New +** → **Web Service** and connect your repository.
2. Configure settings:
   - **Environment:** `Python 3`
   - **Region:** `Frankfurt (EU Central)` *(Lowest latency to Binance servers)*
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/api/status`
3. Click **Deploy Web Service**.

---

## 🐳 Docker & VPS Deployment

Deploy continuously on any Ubuntu/Debian VPS using Docker Compose:

```bash
# Clone and enter directory
git clone https://github.com/nativedreamer/Perp_roaming.git
cd Perp_roaming

# Build and start container in background (runs zero-config)
docker compose up -d --build

# Monitor live logs
docker compose logs -f
```

---

## 📊 Strategy Rules & Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `EMA_FAST` | 11 | Fast trend EMA period |
| `EMA_SLOW` | 34 | Slow trend EMA period |
| `EMA_TREND`| 200 | Baseline macro trend EMA |
| `ATR_PERIOD`| 14 | Average True Range volatility measure |
| `SL_ATR_MULT`| 2.5 | Stop-loss distance multiplier (`ATR × 2.5`) |
| `TP1_RATIO` | 1.5 | Take-profit 1 risk-to-reward ratio (`1 : 1.5`) |
| `TREND_FILTER`| `zone` | Direction filter (`zone`: VWAP vs EMA 200, `price`: Price vs VWAP & EMA 200, `none`) |
| `REQUIRE_CANDLE_COLOR` | `true` | Requires green candle for Longs, red for Shorts |
| `BAR_COOLDOWN`| 3 | Minimum completed bars between repeat signals on the same symbol |

---

## 📄 License
MIT License.
