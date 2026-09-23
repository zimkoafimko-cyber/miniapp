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

// ОГРАНИЧЕНИЯ И НАГРАДЫ (НЕ ПРЕВЫШАЮТ 15 ЗВЕЗД)
const REFERRAL_REWARD = 2;
const SUBSCRIBE_REWARD = 15; // Максимум 15 звезд
const DAILY_REWARD = 3;
const MIN_WITHDRAWAL = 50;  // Вывод строго от 50 звезд

const db = new Database(path.join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

// Инициализация базы данных (Баланс изначально 0)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  stars INTEGER NOT NULL DEFAULT 0,
  referred_by INTEGER,
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  subscribe_claimed INTEGER NOT NULL DEFAULT 0,
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

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash.length !== hash.length) return null;

  if (
    !crypto.timingSafeEqual(
      Buffer.from(calculatedHash),
      Buffer.from(hash)
    )
  ) {
    return null;
  }

  const authDate = Number(params.get("auth_date") || 0);

  if (!authDate) return null;

  if (Date.now() / 1000 - authDate > 86400) {
    return null;
  }

  try {
    return JSON.parse(params.get("user"));
  } catch {
    return null;
  }
}

function getTelegramUser(req) {
  return verifyInitData(
    req.headers["x-telegram-init-data"]
  );
}

function createOrUpdateUser(tgUser) {
  let user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(tgUser.id);

  if (!user) {
    db.prepare(`
      INSERT INTO users
      (id, username, first_name, stars)
      VALUES (?, ?, ?, 0)
    `).run(
      tgUser.id,
      tgUser.username || "",
      tgUser.first_name || ""
    );

    user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(tgUser.id);
  } else {
    db.prepare(`
      UPDATE users
      SET username = ?, first_name = ?
      WHERE id = ?
    `).run(
      tgUser.username || "",
      tgUser.first_name || "",
      tgUser.id
    );
  }

  return user;
}

async function telegram(method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  return response.json();
}

let cachedBotUsername = BOT_USERNAME.replace(/^@/, "");

async function getBotUsername() {
  if (cachedBotUsername) {
    return cachedBotUsername;
  }

  try {
    const result = await telegram("getMe", {});

    if (result.ok && result.result.username) {
      cachedBotUsername = result.result.username;
      return cachedBotUsername;
    }
  } catch (error) {
    console.error("getMe error:", error);
  }

  return "";
}

function processReferral(tgUser, startParam) {
  if (!startParam) return;

  const match = String(startParam).match(/^ref_(\d+)$/);

  if (!match) return;

  const inviterId = Number(match[1]);
  const inviteeId = Number(tgUser.id);

  if (inviterId === inviteeId) return;

  const inviter = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(inviterId);

  if (!inviter) return;

  const invitee = db
    .prepare(`
      SELECT referred_by, referral_rewarded
      FROM users
      WHERE id = ?
    `)
    .get(inviteeId);

  if (!invitee) return;

  if (invitee.referred_by) return;

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE users
      SET referred_by = ?
      WHERE id = ?
    `).run(
      inviterId,
      inviteeId
    );

    const existingReferral = db
      .prepare(`
        SELECT invitee_id
        FROM referrals
        WHERE invitee_id = ?
      `)
      .get(inviteeId);

    if (!existingReferral) {
      db.prepare(`
        INSERT INTO referrals
        (inviter_id, invitee_id)
        VALUES (?, ?)
      `).run(
        inviterId,
        inviteeId
      );

      // Жесткое ограничение награды за реферала
      const reward = Math.min(REFERRAL_REWARD, 15);

      db.prepare(`
        UPDATE users
        SET stars = stars + ?
        WHERE id = ?
      `).run(
        reward,
        inviterId
      );

      db.prepare(`
        UPDATE users
        SET referral_rewarded = 1
        WHERE id = ?
      `).run(inviteeId);
    }
  });

  transaction();
}

app.get("/api/config", async (req, res) => {
  const botUsername = await getBotUsername();

  res.json({
    channel: CHANNEL_USERNAME,
    admin: ADMIN_USERNAME,
    botUsername,
    minWithdrawal: MIN_WITHDRAWAL,
    rewards: {
      subscribe: Math.min(SUBSCRIBE_REWARD, 15),
      daily: Math.min(DAILY_REWARD, 15),
      referral: Math.min(REFERRAL_REWARD, 15)
    }
  });
});

app.get("/api/me", (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({
      error: "Telegram authorization required"
    });
  }

  const startParam =
    req.headers["x-telegram-start-param"] || "";

  createOrUpdateUser(tgUser);

  processReferral(
    tgUser,
    startParam
  );

  const user = db
    .prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `)
    .get(tgUser.id);

  const referralCount = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM referrals
      WHERE inviter_id = ?
    `)
    .get(tgUser.id).count;

  res.json({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    stars: user.stars,
    referralCount,
    referralReward: Math.min(REFERRAL_REWARD, 15)
  });
});

/* Проверка подписки (ЕДИНОРАЗОВАЯ НАГРАДА ДО 15 ЗВЕЗД) */
app.post("/api/check-subscription", async (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  createOrUpdateUser(tgUser);

  try {
    const result = await telegram("getChatMember", {
      chat_id: `@${CHANNEL_USERNAME.replace(/^@/, "")}`,
      user_id: tgUser.id
    });

    if (!result.ok) {
      return res.status(500).json({
        error: "Не удалось проверить подписку."
      });
    }

    const status = result.result.status;

    const isSubscribed =
      ["creator", "administrator", "member"].includes(status) ||
      (
        status === "restricted" &&
        result.result.is_member === true
      );

    if (isSubscribed) {
      const user = db
        .prepare(`
          SELECT subscribe_claimed
          FROM users
          WHERE id = ?
        `)
        .get(tgUser.id);

      if (user.subscribe_claimed) {
        return res.status(400).json({
          error: "Бонус за подписку уже был получен ранее!"
        });
      }

      const reward = Math.min(SUBSCRIBE_REWARD, 15);

      db.prepare(`
        UPDATE users
        SET stars = stars + ?,
            subscribe_claimed = 1
        WHERE id = ?
      `).run(
        reward,
        tgUser.id
      );

      return res.json({
        ok: true,
        status,
        rewarded: true,
        reward
      });
    }

    res.json({
      ok: false,
      status
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Ошибка проверки подписки."
    });
  }
});

/* Ежедневный бонус (СТРОГО 1 РАЗ В 24 ЧАСА) */
app.post("/api/daily-bonus", (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  createOrUpdateUser(tgUser);

  const user = db
    .prepare(`
      SELECT daily_bonus_at
      FROM users
      WHERE id = ?
    `)
    .get(tgUser.id);

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  if (user.daily_bonus_at) {
    const lastBonusTime = new Date(user.daily_bonus_at).getTime();
    
    if (now - lastBonusTime < TWENTY_FOUR_HOURS) {
      const timeLeftMs = TWENTY_FOUR_HOURS - (now - lastBonusTime);
      const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

      return res.status(400).json({
        error: `Следующий бонус будет доступен через ${hoursLeft} ч. ${minutesLeft} мин.`
      });
    }
  }

  const reward = Math.min(DAILY_REWARD, 15);

  db.prepare(`
    UPDATE users
    SET stars = stars + ?,
        daily_bonus_at = ?
    WHERE id = ?
  `).run(
    reward,
    new Date().toISOString(),
    tgUser.id
  );

  res.json({
    ok: true,
    reward
  });
});

app.get("/api/referral", async (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  createOrUpdateUser(tgUser);

  const botUsername = await getBotUsername();

  if (!botUsername) {
    return res.status(500).json({
      error: "Не удалось определить username бота."
    });
  }

  const referralLink =
    `https://t.me/${botUsername}?start=ref_${tgUser.id}`;

  const count = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM referrals
      WHERE inviter_id = ?
    `)
    .get(tgUser.id).count;

  res.json({
    link: referralLink,
    count,
    reward: Math.min(REFERRAL_REWARD, 15)
  });
});

/* Вывод средств (СТРОГО ОТ 50 ЗВЕЗД) */
app.post("/api/withdraw", (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const user = createOrUpdateUser(tgUser);

  if (user.stars < MIN_WITHDRAWAL) {
    return res.status(400).json({
      error: `Минимальный вывод — ${MIN_WITHDRAWAL} ⭐`
    });
  }

  const amount = user.stars;

  // Списываем средства при выводе
  db.prepare(`
    UPDATE users
    SET stars = 0
    WHERE id = ?
  `).run(tgUser.id);

  db.prepare(`
    INSERT INTO withdrawals
    (user_id, amount)
    VALUES (?, ?)
  `).run(
    tgUser.id,
    amount
  );

  res.json({
    ok: true,
    amount,
    contact:
      `https://t.me/${ADMIN_USERNAME.replace(/^@/, "")}`
  });
});

/* --- ИГРА CRASH --- */

app.post("/api/crash/play", (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

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

  let crashPoint;
  if (isWin) {
    crashPoint = parseFloat((1.5 + Math.random() * 2.0).toFixed(2));
  } else {
    crashPoint = 1.00;
  }

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

  if (!tgUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { multiplier } = req.body;

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(tgUser.id);

  if (!user || !user.active_crash_point) {
    return res.status(400).json({ error: "Активная игра не найдена" });
  }

  if (multiplier > user.active_crash_point) {
    db.prepare(`
      UPDATE users
      SET active_crash_point = 0,
          active_crash_bet = 0
      WHERE id = ?
    `).run(tgUser.id);

    return res.status(400).json({ error: "Ракета взорвалась раньше!" });
  }

  const winAmount = Math.floor(user.active_crash_bet * multiplier);

  db.prepare(`
    UPDATE users
    SET stars = stars + ?,
        active_crash_point = 0,
        active_crash_bet = 0
    WHERE id = ?
  `).run(winAmount, tgUser.id);

  res.json({ ok: true, winAmount });
});

app.get("/health", (req, res) => {
  res.send("OK");
});

app.use((req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});
