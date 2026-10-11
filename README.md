# Perp Roaming - 24/7 Binance Futures Quant Radar & Paper Trading Bot

A high-frequency quantitative perpetual futures radar and automated paper-trading terminal built with React 19, TypeScript, Tailwind CSS, and Vite. Configured for zero-config **Vercel** deployment.

## 🚀 Key Features

1. **Unlimited Perpetual Pairs Scanner (Dynamic Discovery):**
   - Continuously monitors **all available perpetual / USDT pairs** on Binance without artificial pair limits.
   - Initialized with 120+ high-liquidity perpetual pairs and dynamically pulls the entire perpetual universe, cycling round-robin 24/7.
   - Built-in rate limiting and fallback resilience.

2. **Dual Quantitative Strategies:**
   - **Volumetric Order Blocks + EMA (Pine Script Port):** Bullish/Bearish Order Blocks detection, EMA 20/50/200 trend alignment, volume delta threshold, breaker blocks, and liquidity sweeps.
   - **VWAP + EMA Dynamic Reversion:** Intraday volume-weighted bands, pullback triggers, and dynamic stop-loss/take-profit calculations.

3. **Manual Quant Analyses Studio:**
   - Dedicated interactive deep-dive modal to inspect any perpetual symbol on demand.
   - Quantitative scorecard: Order block zones, EMA 20/50/200 spread, VWAP deviation, RSI 14, 24h volume surge, and ATR volatility.
   - One-click copy trade plan, instant simulated execution, or load directly into the live multi-timeframe interactive chart.

4. **Realistic Paper Trading Simulation Engine:**
   - Real-time simulated fills, leverage selector (1x - 125x), dynamic PnL tracking, margin maintenance checks, liquidation calculations, and interactive order book.
   - Auto-execute mode for signals meeting minimum confluence thresholds.

5. **Deploy Ready for Vercel:**
   - Configured with `vercel.json` for fast SPA routing, clean URLs, and optimized Vite production builds (`npm run build`).

---

## 🛠 Tech Stack

- **Framework:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS v4 + Framer Motion
- **Icons:** Lucide React
- **Data Source:** Binance Public REST API (CORS enabled with multi-node fallback)
- **Deployment:** Vercel (or static hosting)

---

## 📦 Local Development

```bash
# Install dependencies
npm install

# Start local development server (runs on port 3000)
npm run dev

# Run TypeScript type check
npm run lint

# Build for production
npm run build
```

---

## ⚡ Vercel Deployment Instructions

1. **Push to your GitHub repository:**
   ```bash
   git add .
   git commit -m "feat: perpetual radar with unlimited pair screener, manual analysis studio, and paper trading"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
   - Import your GitHub repository.
   - **Framework Preset:** Vite (or Other).
   - **Build Command:** `npm run build` (or `vite build`).
   - **Output Directory:** `dist`.
   - Click **Deploy**. Vercel will automatically build and publish your project with automated previews on each commit.

---

## 📄 License
MIT License. Free for personal and algorithmic trading research.
