import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import aiohttp

logger = logging.getLogger(__name__)

class TelegramNotifier:
    def __init__(self, bot_token: str, chat_id: str, cooldown_minutes: int = 15):
        self.bot_token = bot_token.strip()
        self.chat_id = chat_id.strip()
        self.cooldown_minutes = cooldown_minutes
        self.last_alerts: Dict[str, datetime] = {}
        self.session: Optional[aiohttp.ClientSession] = None
        self.is_running = False
        self.polling_task: Optional[asyncio.Task] = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session

    def is_configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    def is_in_cooldown(self, symbol: str) -> bool:
        if symbol not in self.last_alerts:
            return False
        elapsed = datetime.utcnow() - self.last_alerts[symbol]
        return elapsed < timedelta(minutes=self.cooldown_minutes)

    def format_signal_message(self, sig: Dict[str, Any]) -> str:
        """
        Formats signal notification according to specification:
        Pair, Direction, Timeframe, Entry Price, SL, TP1, TP2, RRR.
        """
        direction = sig.get("direction", "LONG").upper()
        dir_emoji = "🟢 LONG" if direction in ("LONG", "CALL") else "🔴 SHORT"
        
        entry = sig.get("entry_price", 0.0)
        sl = sig.get("sl_price", 0.0)
        tp1 = sig.get("tp1_price", 0.0)
        tp2 = sig.get("tp2_price", 0.0)
        tp3 = sig.get("tp3_price", 0.0)
        rrr = sig.get("risk_reward_ratio", 1.5)
        tf = sig.get("timeframe", "5m")
        symbol = sig.get("symbol", "").replace("USDT", "/USDT")

        # Format numbers with appropriate precision
        fmt = lambda n: f"{n:.6f}".rstrip("0").rstrip(".") if abs(n) < 1 else f"{n:,.2f}"

        msg = (
            f"⚡ <b>NEW BINANCE FUTURES SIGNAL</b> ⚡\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯 <b>Pair:</b> <code>{symbol}</code>\n"
            f"📈 <b>Direction:</b> <b>{dir_emoji}</b>\n"
            f"⏱ <b>Timeframe:</b> <b>{tf}</b>\n"
            f"📊 <b>Strategy:</b> EMA 11/34 + VWAP Zone\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"💵 <b>Entry Price:</b> <code>{fmt(entry)}</code>\n"
            f"🛑 <b>Stop Loss:</b> <code>{fmt(sl)}</code>\n"
            f"🎯 <b>Take Profit 1:</b> <code>{fmt(tp1)}</code>\n"
            f"🎯 <b>Take Profit 2:</b> <code>{fmt(tp2)}</code>\n"
            f"🎯 <b>Take Profit 3:</b> <code>{fmt(tp3)}</code>\n"
            f"⚖️ <b>Risk/Reward:</b> <b>1 : {rrr}</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"⏰ <i>Time (UTC):</i> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        return msg

    async def send_message(self, text: str, chat_id: Optional[str] = None) -> bool:
        if not self.bot_token:
            logger.debug("Telegram token missing; skipping alert.")
            return False

        target_chat = chat_id or self.chat_id
        if not target_chat:
            logger.warning("Telegram chat_id missing.")
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": target_chat,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True
        }

        try:
            session = await self.get_session()
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    logger.info("Telegram notification sent successfully to %s", target_chat)
                    return True
                else:
                    body = await resp.text()
                    logger.error("Telegram API error (%s): %s", resp.status, body)
                    return False
        except Exception as e:
            logger.error("Failed to send Telegram message: %s", e)
            return False

    async def notify_signal(self, sig: Dict[str, Any]) -> bool:
        symbol = sig.get("symbol", "")
        if self.is_in_cooldown(symbol):
            logger.info("Anti-spam: %s is in cooldown, skipping alert", symbol)
            return False

        text = self.format_signal_message(sig)
        success = await self.send_message(text)
        if success:
            self.last_alerts[symbol] = datetime.utcnow()
        return success

    async def start_polling(self, db_getter, scanner_getter):
        """
        Runs a lightweight asynchronous Telegram command bot loop for /status, /signals, /start
        """
        if not self.bot_token:
            logger.info("Telegram polling skipped: No BOT_TOKEN provided.")
            return

        self.is_running = True
        logger.info("Starting Telegram Bot command listener (/status, /signals)...")
        offset = 0

        while self.is_running:
            try:
                session = await self.get_session()
                url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates"
                params = {"offset": offset, "timeout": 20}
                
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=25)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        updates = data.get("result", [])
                        for update in updates:
                            offset = update["update_id"] + 1
                            message = update.get("message")
                            if not message or "text" not in message:
                                continue

                            chat_id = str(message["chat"]["id"])
                            text = message["text"].strip()
                            await self._handle_command(text, chat_id, db_getter, scanner_getter)
                    elif resp.status in (401, 404):
                        logger.error("Invalid Telegram bot token. Polling aborted.")
                        break
                    else:
                        await asyncio.sleep(5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug("Telegram polling exception: %s", e)
                await asyncio.sleep(5)

    async def _handle_command(self, cmd_text: str, chat_id: str, db_getter, scanner_getter):
        cmd = cmd_text.split()[0].lower()
        db = db_getter()
        scanner = scanner_getter()

        if cmd in ("/start", "/help"):
            msg = (
                "🤖 <b>EMA VWAP Binance Futures Bot</b>\n\n"
                "Available Commands:\n"
                "• <code>/status</code> - View scanner status, uptime & metrics\n"
                "• <code>/signals</code> - View last 5 triggered trading signals\n"
                "• <code>/scan</code> - Trigger immediate market scan\n"
                "• <code>/help</code> - Show this menu"
            )
            await self.send_message(msg, chat_id=chat_id)

        elif cmd == "/status":
            uptime = scanner.get_uptime() if scanner else "N/A"
            scanned = len(scanner.valid_symbols) if scanner else 0
            is_active = scanner.is_running if scanner else False
            stats = db.get_stats() if db else {}

            status_msg = (
                f"📊 <b>SCANNER SYSTEM STATUS</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"🟢 <b>Status:</b> {'RUNNING' if is_active else 'PAUSED'}\n"
                f"⏳ <b>Uptime:</b> {uptime}\n"
                f"🪙 <b>Scanned Pairs:</b> {scanned} USDT Perpetuals\n"
                f"⏱ <b>Timeframe:</b> {scanner.timeframe if scanner else '5m'}\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📈 <b>Total Signals:</b> {stats.get('total_signals', 0)}\n"
                f"🏆 <b>Win Rate:</b> {stats.get('win_rate', 0)}%\n"
                f"✅ <b>Wins:</b> {stats.get('wins', 0)} | ❌ <b>Losses:</b> {stats.get('losses', 0)}\n"
                f"🎯 <b>Open Positions:</b> {stats.get('open_signals', 0)}"
            )
            await self.send_message(status_msg, chat_id=chat_id)

        elif cmd == "/signals":
            signals = db.get_recent_signals(limit=5) if db else []
            if not signals:
                await self.send_message("ℹ️ No signals recorded yet.", chat_id=chat_id)
                return

            msg_parts = ["📡 <b>LAST 5 SIGNALS:</b>\n━━━━━━━━━━━━━━━━━━━━"]
            for s in signals:
                dir_emoji = "🟢" if s["direction"] in ("LONG", "CALL") else "🔴"
                msg_parts.append(
                    f"{dir_emoji} <b>{s['symbol']}</b> ({s['direction']}) [{s['timeframe']}]\n"
                    f"Entry: <code>{s['entry_price']}</code> | SL: <code>{s['sl_price']}</code> | TP1: <code>{s['tp1_price']}</code>\n"
                    f"Status: <b>{s['status']}</b> · <i>{s['created_at'][:19]}</i>\n"
                )
            await self.send_message("\n".join(msg_parts), chat_id=chat_id)

        elif cmd == "/scan":
            await self.send_message("🔄 Triggering manual Binance Futures scan...", chat_id=chat_id)
            if scanner:
                asyncio.create_task(scanner.scan_once())

    async def close(self):
        self.is_running = False
        if self.session and not self.session.closed:
            await self.session.close()
