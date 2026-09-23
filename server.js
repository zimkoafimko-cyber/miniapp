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
  daily_bonus_at TEXT,
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
      (id, username, first_name)
      VALUES (?, ?, ?)
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

/*
  Получаем username бота автоматически,
  если BOT_USERNAME не задан в Render.
*/
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

/*
  Регистрируем реферала.

  ref_123456789
  ^
  Telegram ID пригласившего.
*/
function processReferral(tgUser, startParam) {
  if (!startParam) return;

  const match = String(startParam).match(/^ref_(\d+)$/);

  if (!match) return;

  const inviterId = Number(match[1]);
  const inviteeId = Number(tgUser.id);

  // Нельзя пригласить самого себя.
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

  // Уже есть пригласивший — ничего не меняем.
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

      db.prepare(`
        UPDATE users
        SET stars = stars + ?
        WHERE id = ?
      `).run(
        REFERRAL_REWARD,
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
      subscribe: SUBSCRIBE_REWARD,
      daily: DAILY_REWARD,
      referral: REFERRAL_REWARD
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
    referralReward: REFERRAL_REWARD
  });
});

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

      if (!user.subscribe_claimed) {
        db.prepare(`
          UPDATE users
          SET stars = stars + ?,
              subscribe_claimed = 1
          WHERE id = ?
        `).run(
          SUBSCRIBE_REWARD,
          tgUser.id
        );
      }
    }

    res.json({
      ok: isSubscribed,
      status
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Ошибка проверки подписки."
    });
  }
});

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

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const lastBonus = user.daily_bonus_at
    ? String(user.daily_bonus_at).slice(0, 10)
    : null;

  if (lastBonus === today) {
    return res.status(400).json({
      error: "Бонус уже получен сегодня."
    });
  }

  db.prepare(`
    UPDATE users
    SET stars = stars + ?,
        daily_bonus_at = ?
    WHERE id = ?
  `).run(
    DAILY_REWARD,
    new Date().toISOString(),
    tgUser.id
  );

  res.json({
    ok: true,
    reward: DAILY_REWARD
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
    reward: REFERRAL_REWARD
  });
});

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
