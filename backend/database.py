import sqlite3
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class SignalDatabase:
    def __init__(self, db_path: str = "signals.db"):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS signals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    strategy TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    entry_price REAL NOT NULL,
                    sl_price REAL NOT NULL,
                    tp1_price REAL NOT NULL,
                    tp2_price REAL NOT NULL,
                    tp3_price REAL NOT NULL,
                    tp4_price REAL NOT NULL,
                    risk_reward_ratio REAL NOT NULL,
                    atr REAL,
                    status TEXT NOT NULL DEFAULT 'OPEN',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    telegram_sent INTEGER DEFAULT 0,
                    t1_hit INTEGER DEFAULT 0,
                    t2_hit INTEGER DEFAULT 0,
                    t3_hit INTEGER DEFAULT 0,
                    t4_hit INTEGER DEFAULT 0,
                    metadata TEXT
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scan_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    symbols_scanned INTEGER NOT NULL,
                    trending_count INTEGER NOT NULL,
                    signals_triggered INTEGER NOT NULL,
                    duration_seconds REAL NOT NULL
                )
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at);
            """)
            conn.commit()
            logger.info("SignalDatabase initialized successfully at %s", self.db_path)

    def insert_signal(self, sig: Dict[str, Any]) -> int:
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO signals (
                    symbol, direction, strategy, timeframe, entry_price,
                    sl_price, tp1_price, tp2_price, tp3_price, tp4_price,
                    risk_reward_ratio, atr, status, created_at, updated_at,
                    telegram_sent, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sig["symbol"],
                sig["direction"],
                sig.get("strategy", "EMA/VWAP"),
                sig.get("timeframe", "5m"),
                sig["entry_price"],
                sig["sl_price"],
                sig["tp1_price"],
                sig["tp2_price"],
                sig["tp3_price"],
                sig["tp4_price"],
                sig.get("risk_reward_ratio", 1.5),
                sig.get("atr", 0.0),
                sig.get("status", "OPEN"),
                now,
                now,
                1 if sig.get("telegram_sent") else 0,
                json.dumps(sig.get("metadata", {}))
            ))
            conn.commit()
            return cursor.lastrowid

    def update_signal_status(self, signal_id: int, status: str, t1: bool = None, t2: bool = None, t3: bool = None, t4: bool = None):
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            updates = ["status = ?", "updated_at = ?"]
            params = [status, now]

            if t1 is not None:
                updates.append("t1_hit = ?")
                params.append(1 if t1 else 0)
            if t2 is not None:
                updates.append("t2_hit = ?")
                params.append(1 if t2 else 0)
            if t3 is not None:
                updates.append("t3_hit = ?")
                params.append(1 if t3 else 0)
            if t4 is not None:
                updates.append("t4_hit = ?")
                params.append(1 if t4 else 0)

            params.append(signal_id)
            sql = f"UPDATE signals SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(sql, params)
            conn.commit()

    def get_open_signals(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM signals WHERE status = 'OPEN' ORDER BY id DESC")
            return [dict(row) for row in cursor.fetchall()]

    def get_recent_signals(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM signals ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def get_stats(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total FROM signals")
            total = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) as open_count FROM signals WHERE status = 'OPEN'")
            open_count = cursor.fetchone()["open_count"]

            cursor.execute("SELECT COUNT(*) as tp1_count FROM signals WHERE t1_hit = 1")
            tp1_count = cursor.fetchone()["tp1_count"]

            cursor.execute("SELECT COUNT(*) as tp2_count FROM signals WHERE t2_hit = 1")
            tp2_count = cursor.fetchone()["tp2_count"]

            cursor.execute("SELECT COUNT(*) as tp3_count FROM signals WHERE t3_hit = 1")
            tp3_count = cursor.fetchone()["tp3_count"]

            cursor.execute("SELECT COUNT(*) as tp4_count FROM signals WHERE t4_hit = 1")
            tp4_count = cursor.fetchone()["tp4_count"]

            # Win is defined as reaching at least TP1 before SL, or TP4
            cursor.execute("SELECT COUNT(*) as wins FROM signals WHERE status LIKE '%TP%' OR t1_hit = 1")
            wins = cursor.fetchone()["wins"]

            cursor.execute("SELECT COUNT(*) as losses FROM signals WHERE status = 'SL HIT' AND t1_hit = 0")
            losses = cursor.fetchone()["losses"]

            decided = wins + losses
            win_rate = (wins / decided * 100) if decided > 0 else 0.0

            return {
                "total_signals": total,
                "open_signals": open_count,
                "wins": wins,
                "losses": losses,
                "win_rate": round(win_rate, 1),
                "tp1_hits": tp1_count,
                "tp2_hits": tp2_count,
                "tp3_hits": tp3_count,
                "tp4_hits": tp4_count,
            }

    def log_scan(self, scanned: int, trending: int, signals: int, duration: float):
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO scan_logs (timestamp, symbols_scanned, trending_count, signals_triggered, duration_seconds)
                VALUES (?, ?, ?, ?, ?)
            """, (now, scanned, trending, signals, duration))
            conn.commit()
