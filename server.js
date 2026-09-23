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
const PORT = Number(process.env.PORT || 3000);

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
  share_rewarded INTEGER NOT NULL DEFAULT 0,
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

try {
  db.exec("ALTER TABLE users ADD COLUMN daily_bonus_at TEXT");
} catch (e) {}

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
  return verifyInitData(req.headers["x-telegram-init-data"]);
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

app.get("/api/config", (req, res) => {
  res.json({
    channel: CHANNEL_USERNAME,
    admin: ADMIN_USERNAME,
    minWithdrawal: 50,
    rewards: {
      subscribe: 15,
      daily: 3,
      share: 5
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

  const user = createOrUpdateUser(tgUser);

  const referrals = db
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
    referrals
  });
});

app.post("/api/referral", (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  const inviterId = Number(req.body.inviter_id);

  if (!inviterId || inviterId === tgUser.id) {
    return res.json({ ok: false });
  }

  createOrUpdateUser(tgUser);

  const inviter = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(inviterId);

  if (!inviter) {
    return res.json({ ok: false });
  }

  const alreadyReferred = db
    .prepare(`
      SELECT *
      FROM referrals
      WHERE invitee_id = ?
    `)
    .get(tgUser.id);

  if (alreadyReferred) {
    return res.json({ ok: false });
  }

  db.prepare(`
    INSERT INTO referrals
    (inviter_id, invitee_id)
    VALUES (?, ?)
  `).run(inviterId, tgUser.id);

  db.prepare(`
    UPDATE users
    SET stars = stars + 2
    WHERE id = ?
  `).run(inviterId);

  res.json({ ok: true });
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
        error: "Telegram не смог проверить подписку."
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
          SET stars = stars + 15,
              subscribe_claimed = 1
          WHERE id = ?
        `).run(tgUser.id);
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
      SELECT *
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
    SET stars = stars + 3,
        daily_bonus_at = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    tgUser.id
  );

  res.json({
    ok: true,
    reward: 3
  });
});

app.post("/api/share-complete", (req, res) => {
  const tgUser = getTelegramUser(req);

  if (!tgUser) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  createOrUpdateUser(tgUser);

  const user = db
    .prepare(`
      SELECT share_rewarded
      FROM users
      WHERE id = ?
    `)
    .get(tgUser.id);

  if (!user.share_rewarded) {
    db.prepare(`
      UPDATE users
      SET stars = stars + 5,
          share_rewarded = 1
      WHERE id = ?
    `).run(tgUser.id);
  }

  res.json({
    ok: true,
    reward: 5
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

  if (user.stars < 50) {
    return res.status(400).json({
      error: "Минимальный вывод — 50 ⭐"
    });
  }

  db.prepare(`
    INSERT INTO withdrawals
    (user_id, amount)
    VALUES (?, ?)
  `).run(
    tgUser.id,
    user.stars
  );

  res.json({
    ok: true,
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
