<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>Stars Tasks</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>

  <style>
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:#f3f4f6;
      color:#171717;
    }
    .wrap{
      max-width:520px;
      margin:auto;
      padding:18px 14px 35px;
    }
    .header{
      background:#fff;
      border-radius:22px;
      padding:22px;
      margin-bottom:14px;
      box-shadow:0 4px 18px rgba(0,0,0,.06);
    }
    .title{
      font-size:25px;
      font-weight:800;
      margin-bottom:5px;
    }
    .sub{
      color:#777;
      font-size:14px;
    }
    .balance{
      margin-top:18px;
      background:#f0f1f3;
      border-radius:18px;
      padding:17px;
    }
    .balance-label{
      color:#777;
      font-size:13px;
    }
    .stars{
      font-size:32px;
      font-weight:800;
      margin-top:3px;
    }
    .refresh{
      margin-top:12px;
      width:100%;
      border:0;
      border-radius:13px;
      padding:12px;
      background:#e5e7eb;
      font-size:14px;
      font-weight:700;
      cursor:pointer;
    }
    .card{
      background:#fff;
      border-radius:20px;
      padding:18px;
      margin-bottom:12px;
      box-shadow:0 4px 18px rgba(0,0,0,.05);
    }
    .row{
      display:flex;
      align-items:center;
      gap:13px;
    }
    .icon{
      width:46px;
      height:46px;
      border-radius:14px;
      background:#f0f1f3;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:23px;
      flex:none;
    }
    .name{
      font-size:17px;
      font-weight:750;
    }
    .desc{
      color:#777;
      font-size:13px;
      margin-top:3px;
      line-height:1.35;
    }
    .reward{
      margin-left:auto;
      font-weight:800;
      white-space:nowrap;
    }
    button.action{
      width:100%;
      margin-top:15px;
      border:0;
      border-radius:14px;
      padding:14px;
      background:#171717;
      color:#fff;
      font-size:15px;
      font-weight:700;
      cursor:pointer;
    }
    button.action:disabled{
      opacity:.55;
    }
    .progress{
      height:8px;
      background:#e5e7eb;
      border-radius:10px;
      overflow:hidden;
      margin-top:13px;
    }
    .progress > div{
      height:100%;
      width:0%;
      background:#171717;
      transition:.3s;
    }
    .small{
      margin-top:8px;
      color:#777;
      font-size:12px;
    }
    .withdraw{
      background:#171717;
      color:#fff;
    }
    .withdraw .desc,
    .withdraw .small{
      color:#bbb;
    }
  </style>
</head>

<body>
<div class="wrap">

  <div class="header">
    <div class="title">⭐ Stars Tasks</div>
    <div class="sub">Выполняй задания и получай Telegram Stars</div>

    <div class="balance">
      <div class="balance-label">Ваш баланс</div>
      <div class="stars" id="balance">0 ⭐</div>
      <button class="refresh" id="refreshBtn">↻ Обновить баланс</button>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <div class="icon">📢</div>
      <div>
        <div class="name">Подписаться на канал</div>
        <div class="desc">Подпишись на канал и проверь подписку</div>
      </div>
      <div class="reward">+15 ⭐</div>
    </div>

    <button class="action" id="subscribeBtn">
      Подписаться
    </button>

    <button class="action" id="checkBtn">
      Проверить подписку
    </button>
  </div>

  <div class="card">
    <div class="row">
      <div class="icon">👥</div>
      <div>
        <div class="name">Пригласить друзей</div>
        <div class="desc">+2 ⭐ за каждого приглашённого друга</div>
      </div>
      <div class="reward">+2 ⭐</div>
    </div>

    <div class="progress">
      <div id="refProgress"></div>
    </div>

    <div class="small" id="refText">Приглашено: 0 / 5</div>

    <button class="action" id="inviteBtn">
      Пригласить друзей
    </button>
  </div>

  <div class="card">
    <div class="row">
      <div class="icon">📤</div>
      <div>
        <div class="name">Отправить пост</div>
        <div class="desc">Поделись постом с друзьями</div>
      </div>
      <div class="reward">+5 ⭐</div>
    </div>

    <button class="action" id="shareBtn">
      Отправить пост
    </button>
  </div>

  <div class="card withdraw">
    <div class="row">
      <div class="icon">💰</div>
      <div>
        <div class="name">Вывод ⭐</div>
        <div class="desc">Минимальная сумма вывода — 50 ⭐</div>
      </div>
    </div>

    <button class="action" id="withdrawBtn">
      Вывести Stars
    </button>

    <div class="small">
      После заявки напиши администратору @AlinaResseler
    </div>
  </div>

</div>

<script>
const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

const initData = tg.initData;

const headers = {
  "Content-Type": "application/json",
  "X-Telegram-Init-Data": initData
};

let currentUser = null;

async function loadUser() {
  try {
    const res = await fetch("/api/me", {
      headers
    });

    if (!res.ok) {
      throw new Error("Ошибка авторизации");
    }

    currentUser = await res.json();

    document.getElementById("balance").textContent =
      `${currentUser.stars} ⭐`;

    const referrals = Number(currentUser.referrals || 0);
    const progress = Math.min(referrals, 5);

    document.getElementById("refText").textContent =
      `Приглашено: ${referrals} / 5`;

    document.getElementById("refProgress").style.width =
      `${progress * 20}%`;

  } catch (e) {
    console.error(e);
    tg.showAlert("Не удалось обновить баланс.");
  }
}

document.getElementById("refreshBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshBtn");

  btn.disabled = true;
  btn.textContent = "Обновление...";

  await loadUser();

  btn.disabled = false;
  btn.textContent = "↻ Обновить баланс";
});

document.getElementById("subscribeBtn").addEventListener("click", () => {
  tg.openTelegramLink("https://t.me/belcryptoo");
});

document.getElementById("checkBtn").addEventListener("click", async () => {
  const btn = document.getElementById("checkBtn");

  btn.disabled = true;
  btn.textContent = "Проверяем...";

  try {
    const res = await fetch("/api/check-subscription", {
      method: "POST",
      headers
    });

    const data = await res.json();

    if (data.ok) {
      tg.showAlert("Подписка подтверждена! +15 ⭐");
    } else {
      tg.showAlert("Подписка не найдена. Сначала подпишись на канал.");
    }

    await loadUser();

  } catch (e) {
    tg.showAlert("Ошибка проверки подписки.");
  }

  btn.disabled = false;
  btn.textContent = "Проверить подписку";
});

document.getElementById("inviteBtn").addEventListener("click", async () => {
  if (!currentUser) {
    await loadUser();
  }

  const ref = currentUser.id;

  const link =
    `${location.origin}/?ref=${ref}`;

  const text =
    "Заходи и получай Telegram Stars ⭐";

  const shareUrl =
    "https://t.me/share/url?url=" +
    encodeURIComponent(link) +
    "&text=" +
    encodeURIComponent(text);

  tg.openTelegramLink(shareUrl);
});

document.getElementById("shareBtn").addEventListener("click", async () => {

  const shareUrl =
    "https://t.me/share/url?url=" +
    encodeURIComponent("https://t.me/belcryptoo") +
    "&text=" +
    encodeURIComponent("Подпишись на канал ⭐");

  tg.openTelegramLink(shareUrl);

  setTimeout(async () => {
    try {
      await fetch("/api/share-complete", {
        method: "POST",
        headers
      });

      await loadUser();

      tg.showAlert("Готово! +5 ⭐");
    } catch (e) {
      console.error(e);
    }
  }, 1200);
});

document.getElementById("withdrawBtn").addEventListener("click", async () => {
  if (!currentUser) {
    await loadUser();
  }

  if (Number(currentUser.stars) < 50) {
    tg.showAlert("Минимальный вывод — 50 ⭐");
    return;
  }

  try {
    const res = await fetch("/api/withdraw", {
      method: "POST",
      headers
    });

    const data = await res.json();

    if (!res.ok) {
      tg.showAlert(data.error || "Ошибка вывода.");
      return;
    }

    tg.showAlert(
      "Заявка на вывод создана. Сейчас откроется администратор."
    );

    tg.openTelegramLink(
      "https://t.me/AlinaResseler"
    );

  } catch (e) {
    tg.showAlert("Ошибка отправки заявки.");
  }
});

async function processReferral() {
  const params = new URLSearchParams(window.location.search);
  const ref = Number(params.get("ref"));

  if (!ref || !currentUser || ref === Number(currentUser.id)) {
    return;
  }

  try {
    await fetch("/api/referral", {
      method: "POST",
      headers,
      body: JSON.stringify({
        inviter_id: ref
      })
    });

    await loadUser();
  } catch (e) {
    console.error(e);
  }
}

(async () => {
  await loadUser();
  await processReferral();
})();
</script>

</body>
</html>
