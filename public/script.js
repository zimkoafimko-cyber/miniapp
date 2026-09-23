const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const tgUser = tg?.initDataUnsafe?.user;
const telegram_id = tgUser ? tgUser.id : 'test_user_123';
const username = tgUser ? (tgUser.first_name || tgUser.username) : 'Игрок';

let currentUser = { balance: 0, total_games: 0, max_mult: 1.0, ref_earned: 0 };

// Переменные для Rocket Crash
let crashInterval = null;
let currentMult = 1.00;
let serverCrashPoint = 1.00;
let currentBet = 0;
let isFlying = false;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function initUserData() {
  try {
    const res = await fetch('/api/user/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, username })
    });
    const data = await res.json();

    if (data.user) {
      currentUser = data.user;
      updateUI();
    }

    if (data.completedTasks) {
      data.completedTasks.forEach(taskId => markTaskAsCompleted(taskId));
    }
  } catch (e) {
    console.error('Ошибка инициализации профиля:', e);
  }
}

function updateUI() {
  document.getElementById('userName').innerText = username;
  document.getElementById('balanceVal').innerText = currentUser.balance;
  
  if (document.getElementById('statTotalGames')) {
    document.getElementById('statTotalGames').innerText = currentUser.total_games;
  }
  if (document.getElementById('statMaxMult')) {
    document.getElementById('statMaxMult').innerText = (currentUser.max_mult || 1.0).toFixed(2) + 'x';
  }
  if (document.getElementById('statRefEarned')) {
    document.getElementById('statRefEarned').innerText = currentUser.ref_earned + ' ⭐';
  }
}

// LOGIC: ROCKET CRASH
async function startCrashGame() {
  const betInput = document.getElementById('betInput');
  const bet = parseInt(betInput ? betInput.value : 0, 10);
  const btnStart = document.getElementById('btnStartGame');
  const btnCashout = document.getElementById('btnCashout');
  const multText = document.getElementById('multiplierVal');
  const statusText = document.getElementById('crashStatus');

  if (!bet || bet <= 0) return showToast('Укажите ставку');
  if (bet > currentUser.balance) return showToast('Недостаточно звезд на балансе');

  currentBet = bet;
  btnStart.style.display = 'none';
  btnCashout.style.display = 'block';
  btnCashout.innerText = `ЗАБРАТЬ (1.00x)`;

  try {
    const response = await fetch('/api/game/crash/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, bet })
    });
    const data = await response.json();

    if (data.error) {
      btnStart.style.display = 'block';
      btnCashout.style.display = 'none';
      return showToast(data.error);
    }

    currentUser.balance = data.newBalance;
    updateUI();

    serverCrashPoint = data.crashPoint;
    currentMult = 1.00;
    isFlying = true;
    statusText.innerText = 'ПОЛЕТ...';
    statusText.style.color = 'var(--accent-green)';

    crashInterval = setInterval(() => {
      currentMult += 0.03;
      multText.innerText = currentMult.toFixed(2) + 'x';
      
      const potentialWin = Math.floor(currentBet * currentMult);
      btnCashout.innerText = `ЗАБРАТЬ (${potentialWin} ⭐)`;

      if (currentMult >= serverCrashPoint) {
        clearInterval(crashInterval);
        isFlying = false;
        statusText.innerText = 'РАКЕТА ВЗОРВАЛАСЬ!';
        statusText.style.color = 'var(--accent-red)';
        
        btnStart.style.display = 'block';
        btnCashout.style.display = 'none';
        showToast('Ракета взлетела слишком высоко и сгорела!');
      }
    }, 100);

  } catch (e) {
    btnStart.style.display = 'block';
    btnCashout.style.display = 'none';
    showToast('Ошибка запуска полета');
  }
}

async function cashoutCrash() {
  if (!isFlying) return;
  clearInterval(crashInterval);
  isFlying = false;

  const btnStart = document.getElementById('btnStartGame');
  const btnCashout = document.getElementById('btnCashout');
  const statusText = document.getElementById('crashStatus');

  const winAmount = Math.floor(currentBet * currentMult);

  try {
    const res = await fetch('/api/game/crash/cashout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, winAmount, mult: currentMult })
    });
    const data = await res.json();

    if (data.success) {
      currentUser.balance = data.newBalance;
      updateUI();
      statusText.innerText = `УСПЕХ! Вы забрали ${winAmount} ⭐`;
      statusText.style.color = 'var(--accent-green)';
      showToast(`Выигрыш +${winAmount} ⭐`);
    }
  } catch (e) {
    showToast('Ошибка вывода');
  }

  btnStart.style.display = 'block';
  btnCashout.style.display = 'none';
}

// LOGIC: DICE
async function playDice() {
  const betInput = document.getElementById('diceBetInput');
  const bet = parseInt(betInput ? betInput.value : 0, 10);
  const btn = document.getElementById('btnPlayDice');
  const d1 = document.getElementById('dice1');
  const d2 = document.getElementById('dice2');
  const status = document.getElementById('diceStatus');

  if (!bet || bet <= 0) return showToast('Укажите корректную ставку');
  if (bet > currentUser.balance) return showToast('Недостаточно звезд на балансе');

  btn.disabled = true;
  status.innerText = 'Бросаем кости...';

  try {
    const response = await fetch('/api/game/dice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, bet })
    });
    const data = await response.json();

    btn.disabled = false;

    if (data.error) {
      status.innerText = data.error;
      showToast(data.error);
      return;
    }

    d1.innerText = data.dice1;
    d2.innerText = data.dice2;

    currentUser.balance = data.newBalance;
    currentUser.total_games += 1;
    updateUI();

    if (data.isWin) {
      status.style.color = 'var(--accent-green)';
      status.innerText = `ВЫИГРЫШ +${data.winAmount} ⭐ (Сумма: ${data.sum})`;
      showToast(`Вы выиграли +${data.winAmount} ⭐`);
    } else {
      status.style.color = 'var(--accent-red)';
      status.innerText = `ВЫПАЛО 7! Вы проиграли -${bet} ⭐`;
      showToast(`Выпала сумма 7! Ставка сгорела`);
    }

  } catch (err) {
    btn.disabled = false;
    showToast('Ошибка соединения с сервером');
  }
}

// LOGIC: TASKS & UTILS
async function completeTask(btnElement, taskId) {
  try {
    const res = await fetch('/api/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, task_id: taskId })
    });
    const data = await res.json();

    if (data.error) return showToast(data.error);

    currentUser.balance = data.newBalance;
    updateUI();
    markTaskAsCompleted(taskId);
    showToast(`Награда +${data.reward} ⭐ зачислена!`);
  } catch (e) {
    showToast('Не удалось выполнить задание');
  }
}

function markTaskAsCompleted(taskId) {
  const btn = document.querySelector(`button[onclick="completeTask(this, ${taskId})"]`);
  if (btn) {
    btn.innerText = 'Выполнено ✅';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
}

function setBet(val) { document.getElementById('betInput').value = val; }
function setMaxBet() { document.getElementById('betInput').value = currentUser.balance; }
function setDiceBet(val) { document.getElementById('diceBetInput').value = val; }
function setDiceMaxBet() { document.getElementById('diceBetInput').value = currentUser.balance; }

function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => initUserData());
