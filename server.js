import express from "express";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "AlinaResseler";
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || "belcryptoo";
const PORT = Number(process.env.PORT || 3000);

if (!BOT_TOKEN) console.warn("BOT_TOKEN is not set. Put it in .env on your host.");

const db = new Database(path.join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  referred_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referral_rewarded INTEGER NOT NULL DEFAULT 0,
  share_rewarded INTEGER NOT NULL DEFAULT 0,
  subscribe_claimed INTEGER NOT NULL DEFAULT 0
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
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash))) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now()/1000 - authDate > 86400) return null;
  try { return JSON.parse(params.get("user")); } catch { return null; }
}

function userFromRequest(req) {
  return verifyInitData(req.headers["x-telegram-init-data"]);
}

function upsertUser(tg) {
  let u = db.prepare("SELECT * FROM users WHERE id=?").get(tg.id);
  if (!u) {
    db.prepare("INSERT INTO users(id,username,first_name) VALUES(?,?,?)")
      .run(tg.id, tg.username || "", tg.first_name || "");
    u = db.prepare("SELECT * FROM users WHERE id=?").get(tg.id);
  } else {
    db.prepare("UPDATE users SET username=?, first_name=? WHERE id=?")
      .run(tg.username || "", tg.first_name || "", tg.id);
  }
  return u;
}

async function telegram(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(body)
  });
  return r.json();
}

app.get("/api/config", (req,res) => res.json({
  channel: CHANNEL_USERNAME,
  admin: ADMIN_USERNAME,
  minWithdrawal: 50,
  rewards: { subscribe: 15, referral: 2, share: 5 }
}));

app.get("/api/me", (req,res) => {
  const tg = userFromRequest(req);
  if (!tg) return res.status(401).json({error:"Telegram authorization required"});
  const u = upsertUser(tg);
  const count = db.prepare("SELECT COUNT(*) c FROM referrals WHERE inviter_id=?").get(tg.id).c;
  res.json({id:u.id, username:u.username, first_name:u.first_name, stars:u.stars, referrals:count});
});

app.post("/api/check-subscription", async (req,res) => {
  const tg = userFromRequest(req);
  if (!tg) return res.status(401).json({error:"Unauthorized"});
  upsertUser(tg);
  try {
    const result = await telegram("getChatMember", {chat_id:`@${CHANNEL_USERNAME.replace(/^@/,"")}`, user_id:tg.id});
    const status = result?.result?.status;
    const ok = ["creator","administrator","member"].includes(status) ||
      (status === "restricted" && result?.result?.is_member === true);
    if (ok) {
      const claimed = db.prepare("SELECT subscribe_claimed FROM users WHERE id=?").get(tg.id);
      if (!claimed?.subscribe_claimed) {
        db.prepare("UPDATE users SET stars=stars+15, subscribe_claimed=1 WHERE id=?").run(tg.id);
      }
    }
    res.json({ok, status});
  } catch {
    res.status(500).json({error:"Не удалось проверить подписку. Убедитесь, что бот — администратор канала."});
  }
});

app.post("/api/share-complete", (req,res) => {
  const tg = userFromRequest(req);
  if (!tg) return res.status(401).json({error:"Unauthorized"});
  upsertUser(tg);
  // Telegram does not provide a reliable server-side receipt that a user
  // actually sent a shared post. This endpoint records the user's action
  // after the share flow; it is deliberately separated from the reward.
  const u = db.prepare("SELECT share_rewarded FROM users WHERE id=?").get(tg.id);
  if (!u.share_rewarded) {
    db.prepare("UPDATE users SET stars=stars+5, share_rewarded=1 WHERE id=?").run(tg.id);
  }
  res.json({ok:true});
});

app.post("/api/withdraw", (req,res) => {
  const tg = userFromRequest(req);
  if (!tg) return res.status(401).json({error:"Unauthorized"});
  const u = upsertUser(tg);
  if (u.stars < 50) return res.status(400).json({error:"Минимальный вывод — 50 ⭐"});
  db.prepare("INSERT INTO withdrawals(user_id,amount) VALUES(?,?)").run(tg.id, u.stars);
  res.json({ok:true, contact:`https://t.me/${ADMIN_USERNAME.replace(/^@/,"")}`});
});

app.get("/health", (_,res)=>res.send("OK"));
app.get("*", (_,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT, ()=>console.log(`Listening on ${PORT}`));
