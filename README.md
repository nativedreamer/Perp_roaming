# 24/7 Binance Futures Scanner & Telegram Signal Bot

An automated, 24/7 perpetual futures market scanner and algorithmic signal generation bot. The system continuously analyzes all USDT Perpetual contracts on Binance using the **EMA 11/34 crossover + VWAP + EMA 200 Zone** strategy, calculating ATR-based Stop-Loss (SL) and multi-tier Take-Profit (TP1-TP4) targets, dispatching instant notifications to Telegram with anti-spam cooldowns, and serving an interactive web dashboard.

---

## ⚡ Features

- **24/7 Continuous Scanning**: Asynchronous `aiohttp` engine cycling through all active Binance USDT Perpetual contracts.
- **Smart Rate-Limiting**: Controlled concurrency (`Semaphore`) and request delays to strictly adhere to Binance API constraints (preventing HTTP 429/418 bans).
- **Instant Telegram Alerts**: Delivers formatted signal cards containing:
  - Trading Pair (e.g. `BTC/USDT`), Direction (`LONG` / `SHORT`), and Timeframe
  - Entry Price, Stop-Loss (SL), and Take-Profit Targets (`TP1`, `TP2`, `TP3`)
  - Risk-to-Reward Ratio (RRR)
- **Anti-Spam & Bar Cooldowns**: In-memory and database cooldown filters preventing repetitive spam for the same pair.
- **Interactive Telegram Commands**:
  - `/status` — Scanner uptime, tracked symbol count, active state, win rate
  - `/signals` — Last 5 triggered trading signals
  - `/scan` — Manually trigger an immediate scan cycle
  - `/help` — Command instructions
- **Interactive Web Dashboard**:
  - Start/Pause 24/7 background scanning with one click
  - Trigger instant market scan passes
  - Test Telegram bot connectivity directly from the UI
  - Real-time signals feed with TP/SL hit status tracking
  - Historical in-browser backtester over Binance candles
- **Persistence**: SQLite database (`signals.db`) recording all signals, levels, and audit logs.
- **Production Ready**: Pre-configured with `Dockerfile`, `docker-compose.yml`, and `render.yaml` for 1-click cloud deployment.

---

## 📁 Repository Structure

```
├── backend/
│   ├── __init__.py           # Python package marker
│   ├── config.py             # Configuration management via Pydantic Settings
│   ├── strategy.py           # EMA 11/34 + VWAP + EMA 200 + ATR mathematical logic
│   ├── database.py           # SQLite persistence layer (signals.db)
│   ├── telegram_bot.py       # Telegram notification & command handler (/status, /signals)
│   ├── scanner.py            # Rate-limited 24/7 Binance Futures market scanner
│   ├── main.py               # FastAPI server, REST endpoints & static frontend serving
│   └── requirements.txt      # Python dependencies
├── frontend/
│   └── index.html            # Connected web dashboard
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules for Python, SQLite, and secrets
├── Dockerfile                # Production container specification
├── docker-compose.yml        # Docker Compose service definition with persistent volume
├── render.yaml               # Infrastructure-as-Code blueprint for Render.com
└── README.md                 # Complete documentation
```

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Python 3.10 or higher
- Telegram Bot Token & Chat ID (instructions below)

### 1. Clone & Setup Environment

```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"
BINANCE_TIMEFRAME="5m"
SCAN_INTERVAL_SECONDS=30
```

### 3. Run the Service

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Dashboard:** Open [http://localhost:8000](http://localhost:8000)
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🤖 Telegram Bot Configuration

1. **Obtain Bot Token:**
   - Message [@BotFather](https://t.me/BotFather) on Telegram.
   - Run `/newbot` and follow instructions to get your `TELEGRAM_BOT_TOKEN`.
2. **Obtain Chat ID:**
   - Message [@userinfobot](https://t.me/userinfobot) to get your personal `TELEGRAM_CHAT_ID`.
   - *For Channels/Groups:* Add your bot as an Administrator and use the group/channel ID (usually starts with `-100`).
3. **Test Alerts:**
   - Click **"Test Alert"** on the web dashboard or use `curl -X POST http://localhost:8000/api/telegram/test`.

---

## ☁️ 24/7 Cloud Deployment on Render.com

### Method 1: Render Blueprint (Recommended)
1. Push this repository to GitHub.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository. Render will automatically read `render.yaml`.
5. Enter your `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` when prompted.
6. Click **Apply**. Render will automatically provision the service, mount persistent storage for `signals.db`, and start scanning 24/7.

### Method 2: Manual Web Service
1. On Render, click **New +** → **Web Service** and connect your repository.
2. Configure settings:
   - **Environment:** `Python 3`
   - **Region:** `Frankfurt (EU Central)` *(Lowest latency to Binance servers)*
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/api/status`
3. Add Environment Variables:
   - `TELEGRAM_BOT_TOKEN`: Your bot token
   - `TELEGRAM_CHAT_ID`: Your chat ID
   - `BINANCE_TIMEFRAME`: `5m`
   - `SCAN_INTERVAL_SECONDS`: `30`
   - `DATABASE_PATH`: `/app/data/signals.db`
4. Add a **Persistent Disk** mounted at `/app/data` (1 GB) to preserve trade logs across redeploys.

---

## 🐳 Docker & VPS Deployment

Deploy continuously on any Ubuntu/Debian VPS using Docker Compose:

```bash
# Clone and enter directory
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>

# Configure environment
cp .env.example .env
nano .env

# Build and start container in background
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
MIT License. Free for personal and commercial trading systems.
