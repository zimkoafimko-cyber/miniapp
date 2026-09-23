import express from "express";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "AlinaResseler";
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || "belcryptoo";
const BOT_USERNAME = process.env.BOT_USERNAME || "";
const PORT = Number(process.env.PORT || 3000);

const REFERRAL_REWARD = 2;
const SUBSCRIBE_REWARD = 15; 
const DAILY_REWARD = 3;
const FRIENDS_TASK_REWARD = 15;
const MIN_WITHDRAWAL = 50;

const db = new Database(path.join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  stars INTEGER NOT NULL DEFAULT 0,
  referred_by INTEGER,
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  subscribe_claimed INTEGER NOT NULL DEFAULT 0,
  friends_task_claimed INTEGER NOT NULL DEFAULT 0,
  daily_bonus_at TEXT,
  active_crash_point REAL DEFAULT 0,
  active_crash_bet INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  inviter_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculatedHash !== hash) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

  try { return JSON.parse(params.get("user")); } catch { return null; }
}

function getTelegramUser(req) {
  return verifyInitData(req.headers["x-telegram-init-data"]);
}

function createOrUpdateUser(tgUser) {
  let user = db.prepare("SELECT * FROM users WHERE id = ?").get(tgUser.id);
  if (!user) {
    db.prepare(`
      INSERT INTO users (id, username, first_name, stars)
      VALUES (?, ?, ?, 0)
    `).run(tgUser.id, tgUser.username || "", tgUser.first_name || "");
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(tgUser.id);
  } else {
    db.prepare(`UPDATE users SET username = ?, first_name = ? WHERE id = ?`)
      .run(tgUser.username || "", tgUser.first_name || "", tgUser.id);
  }
  return user;
}

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.json();
}

app.get("/api/me", (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const user = createOrUpdateUser(tgUser);

  const referralCount = db.prepare(`
    SELECT COUNT(*) AS count FROM referrals WHERE inviter_id = ?
  `).get(tgUser.id).count;

  const now = Date.now();
  let dailyAvailable = true;
  if (user.daily_bonus_at) {
    const lastBonus = new Date(user.daily_bonus_at).getTime();
    if (now - lastBonus < 24 * 60 * 60 * 1000) {
      dailyAvailable = false;
    }
  }

  res.json({
    id: user.id,
    stars: user.stars,
    referralCount,
    tasks: {
      subscribe: Boolean(user.subscribe_claimed),
      friends: Boolean(user.friends_task_claimed) || referralCount >= 3,
      dailyAvailable: dailyAvailable
    }
  });
});

app.post("/api/check-subscription", async (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const user = createOrUpdateUser(tgUser);
  if (user.subscribe_claimed) {
    return res.status(400).json({ error: "Вы уже получили награду за подписку!" });
  }

  try {
    const result = await telegram("getChatMember", {
      chat_id: `@${CHANNEL_USERNAME.replace(/^@/, "")}`,
      user_id: tgUser.id
    });

    if (result.ok && ["creator", "administrator", "member"].includes(result.result.status)) {
      db.prepare(`UPDATE users SET stars = stars + ?, subscribe_claimed = 1 WHERE id = ?`)
        .run(SUBSCRIBE_REWARD, tgUser.id);

      return res.json({ ok: true, reward: SUBSCRIBE_REWARD });
    }
    res.status(400).json({ error: "Подписка не обнаружена!" });
  } catch (error) {
    res.status(500).json({ error: "Ошибка проверки подписки." });
  }
});

app.post("/api/check-friends-task", (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const user = createOrUpdateUser(tgUser);
  if (user.friends_task_claimed) {
    return res.status(400).json({ error: "Задание уже выполнено!" });
  }

  const count = db.prepare(`SELECT COUNT(*) AS count FROM referrals WHERE inviter_id = ?`).get(tgUser.id).count;

  if (count < 3) {
    return res.status(400).json({ error: `Нужно 3 друга, сейчас приглашено: ${count}` });
  }

  db.prepare(`UPDATE users SET stars = stars + ?, friends_task_claimed = 1 WHERE id = ?`)
    .run(FRIENDS_TASK_REWARD, tgUser.id);

  res.json({ ok: true, reward: FRIENDS_TASK_REWARD });
});

app.post("/api/daily-bonus", (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const user = createOrUpdateUser(tgUser);
  const now = Date.now();

  if (user.daily_bonus_at) {
    const lastBonus = new Date(user.daily_bonus_at).getTime();
    if (now - lastBonus < 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "Ежедневный бонус уже получен! Зайдите завтра." });
    }
  }

  db.prepare(`UPDATE users SET stars = stars + ?, daily_bonus_at = ? WHERE id = ?`)
    .run(DAILY_REWARD, new Date().toISOString(), tgUser.id);

  res.json({ ok: true, reward: DAILY_REWARD });
});

/* --- ИГРА CRASH --- */
app.post("/api/crash/play", (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const { bet } = req.body;
  const betAmount = parseInt(bet, 10);

  if (isNaN(betAmount) || betAmount < 1 || betAmount > 100) {
    return res.status(400).json({ error: "Ставка должна быть от 1 до 100 ⭐" });
  }

  const user = createOrUpdateUser(tgUser);
  if (user.stars < betAmount) {
    return res.status(400).json({ error: "Недостаточно ⭐ для этой ставки!" });
  }

  const isWin = Math.random() < 0.20;
  let crashPoint = isWin ? parseFloat((1.5 + Math.random() * 2.0).toFixed(2)) : 1.00;

  db.prepare(`
    UPDATE users
    SET stars = stars - ?,
        active_crash_point = ?,
        active_crash_bet = ?
    WHERE id = ?
  `).run(betAmount, crashPoint, betAmount, tgUser.id);

  res.json({ ok: true, crashPoint });
});

app.post("/api/crash/cashout", (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const { multiplier } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(tgUser.id);

  if (!user || !user.active_crash_point) {
    return res.status(400).json({ error: "Активная игра не найдена" });
  }

  if (multiplier > user.active_crash_point) {
    db.prepare(`UPDATE users SET active_crash_point = 0, active_crash_bet = 0 WHERE id = ?`).run(tgUser.id);
    return res.status(400).json({ error: "Ракета взорвалась раньше!" });
  }

  const winAmount = Math.floor(user.active_crash_bet * multiplier);
  db.prepare(`UPDATE users SET stars = stars + ?, active_crash_point = 0, active_crash_bet = 0 WHERE id = ?`).run(winAmount, tgUser.id);

  res.json({ ok: true, winAmount });
});

/* --- ИГРА КОСТИ (DICE) --- */
app.post("/api/dice/play", (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const { bet } = req.body;
  const betAmount = parseInt(bet, 10);

  if (isNaN(betAmount) || betAmount < 1 || betAmount > 100) {
    return res.status(400).json({ error: "Ставка должна быть от 1 до 100 ⭐" });
  }

  const user = createOrUpdateUser(tgUser);
  if (user.stars < betAmount) {
    return res.status(400).json({ error: "Недостаточно ⭐ на балансе!" });
  }

  const isWin = Math.random() < 0.20;
  let dice1, dice2, sum;

  if (isWin) {
    do {
      dice1 = Math.floor(Math.random() * 6) + 1;
      dice2 = Math.floor(Math.random() * 6) + 1;
      sum = dice1 + dice2;
    } while (sum === 7);
  } else {
    const losePairs = [[1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1]];
    const randomPair = losePairs[Math.floor(Math.random() * losePairs.length)];
    dice1 = randomPair[0];
    dice2 = randomPair[1];
    sum = 7;
  }

  let winAmount = 0;
  if (isWin) {
    winAmount = Math.floor(betAmount * 1.2);
    db.prepare(`UPDATE users SET stars = stars + ? WHERE id = ?`).run(winAmount - betAmount, tgUser.id);
  } else {
    db.prepare(`UPDATE users SET stars = stars - ? WHERE id = ?`).run(betAmount, tgUser.id);
  }

  const updatedUser = db.prepare("SELECT stars FROM users WHERE id = ?").get(tgUser.id);

  res.json({
    ok: true,
    isWin,
    dice1,
    dice2,
    sum,
    winAmount,
    newBalance: updatedUser.stars
  });
});

app.post("/api/withdraw", (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return res.status(401).json({ error: "Unauthorized" });

  const user = createOrUpdateUser(tgUser);
  if (user.stars < MIN_WITHDRAWAL) {
    return res.status(400).json({ error: `Минимальный вывод: ${MIN_WITHDRAWAL} ⭐` });
  }

  const amount = user.stars;
  db.prepare(`UPDATE users SET stars = 0 WHERE id = ?`).run(tgUser.id);
  db.prepare(`INSERT INTO withdrawals (user_id, amount) VALUES (?, ?)`).run(tgUser.id, amount);

  res.json({ ok: true, amount });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
