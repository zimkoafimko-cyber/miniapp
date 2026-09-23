const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const tgUser = tg?.initDataUnsafe?.user;
const telegram_id = tgUser ? tgUser.id : 'test_user_123';
const username = tgUser ? (tgUser.first_name || tgUser.username) : 'Игрок';

let currentUser = {
  balance: 0,
  total_games: 0,
  max_mult: 1.0,
  ref_earned: 0
};

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
      data.completedTasks.forEach(taskId => {
        markTaskAsCompleted(taskId);
      });
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
    document.getElementById('statMaxMult').innerText = currentUser.max_mult.toFixed(2) + 'x';
  }
  if (document.getElementById('statRefEarned')) {
    document.getElementById('statRefEarned').innerText = currentUser.ref_earned + ' ⭐';
  }
}

function setDiceBet(val) {
  const input = document.getElementById('diceBetInput');
  if (input) input.value = val;
}

function setDiceMaxBet() {
  const input = document.getElementById('diceBetInput');
  if (input) input.value = currentUser.balance;
}

function setBet(val) {
  const input = document.getElementById('betInput');
  if (input) input.value = val;
}

function setMaxBet() {
  const input = document.getElementById('betInput');
  if (input) input.value = currentUser.balance;
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

// LOGIC: TASKS
async function completeTask(btnElement, taskId) {
  try {
    const res = await fetch('/api/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, task_id: taskId })
    });
    const data = await res.json();

    if (data.error) {
      showToast(data.error);
      return;
    }

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

// LOGIC: WITHDRAWAL & TABS
async function requestWithdrawal() {
  const wallet = document.getElementById('withdrawWallet')?.value;
  const amount = parseInt(document.getElementById('withdrawInput')?.value || 0, 10);

  if (!wallet) return showToast('Введите адрес кошелька');
  if (amount < 50) return showToast('Минимальная сумма 50 ⭐');
  if (amount > currentUser.balance) return showToast('Недостаточно средств');

  try {
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id, wallet, amount })
    });
    const data = await res.json();

    if (data.error) return showToast(data.error);

    currentUser.balance = data.newBalance;
    updateUI();
    showToast('Заявка на вывод отправлена!');
  } catch (e) {
    showToast('Ошибка при выводе средств');
  }
}

function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
}

function copyRefLink() {
  const refInput = document.getElementById('refLinkInput');
  if (refInput) {
    refInput.select();
    navigator.clipboard.writeText(refInput.value);
    showToast('Ссылка скопирована!');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initUserData();
});
