// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// Глобальные переменные состояния
let balance = 0; // ИСПРАВЛЕНО: баланс установлен на 0
let gameState = 'IDLE'; // IDLE, RUNNING, CRASHED
let currentMultiplier = 1.0;
let crashPoint = 1.0;
let betAmount = 100;
let gameInterval = null;
let animationFrame = null;

// Порог вывода средств
const MIN_WITHDRAWAL_STARS = 50;

// Canvas элементы
const canvas = document.getElementById('crashCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

// Настройка размеров Canvas
function resizeCanvas() {
  if (!canvas) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Инициализация баланса при загрузке
document.addEventListener('DOMContentLoaded', () => {
  updateBalance(0);
});

// ==================== 1. ПЕРЕКЛЮЧЕНИЕ ТАБОВ ====================
function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  if (el) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    el.classList.add('active');
  }
}

// ==================== 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function updateBalance(amount) {
  balance += amount;
  const balanceEl = document.getElementById('balanceVal');
  if (balanceEl) {
    balanceEl.innerText = balance.toLocaleString('ru-RU');
  }
}

function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = text;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function setBet(val) {
  const input = document.getElementById('betInput');
  if (input) {
    input.value = val;
  }
}

function setMaxBet() {
  const input = document.getElementById('betInput');
  if (input) {
    input.value = balance;
  }
}

function copyRefLink() {
  const input = document.getElementById('refLinkInput');
  if (input) {
    navigator.clipboard.writeText(input.value);
    showToast('Ссылка скопирована!');
  }
}

// ИСПРАВЛЕНО: Награда за задание ограничена 15 звездами
function completeTask(btn, reward) {
  if (btn.disabled) return;
  
  // Жесткое ограничение награды не более 15 звезд
  const actualReward = Math.min(reward, 15);

  btn.disabled = true;
  btn.innerText = 'Готово';
  btn.style.opacity = '0.5';
  
  updateBalance(actualReward);
  showToast(`Получено +${actualReward} ⭐!`);
}

// Сброс всех выполненных заданий
function resetTasks() {
  document.querySelectorAll('.task-btn').forEach(btn => {
    btn.disabled = false;
    btn.innerText = 'Выполнить';
    btn.style.opacity = '1';
  });
  showToast('Проверка заданий сброшена');
}

// НОВОЕ: Функция вывода средств (минимум 50 звезд)
function requestWithdrawal() {
  const input = document.getElementById('withdrawInput');
  const amount = input ? parseInt(input.value) || 0 : balance;

  if (amount < MIN_WITHDRAWAL_STARS) {
    showToast(`Минимальный вывод от ${MIN_WITHDRAWAL_STARS} ⭐`);
    return;
  }

  if (amount > balance) {
    showToast('Недостаточно ⭐ на балансе');
    return;
  }

  updateBalance(-amount);
  showToast(`Заявка на вывод ${amount} ⭐ создана!`);
}

// ==================== 3. ЛОГИКА CRASH ИГРЫ ====================
function startCrashGame() {
  const input = document.getElementById('betInput');
  betAmount = parseInt(input.value) || 0;

  if (betAmount <= 0) {
    showToast('Введите корректную ставку');
    return;
  }
  if (betAmount > balance) {
    showToast('Недостаточно ⭐ на балансе');
    return;
  }

  // Списываем ставку
  updateBalance(-betAmount);
  gameState = 'RUNNING';
  currentMultiplier = 1.0;

  // Генерация случайного коэффициента краша
  const e = 2 ** 32;
  const h = crypto.getRandomValues(new Uint32Array(1))[0];
  crashPoint = Math.max(1.01, parseFloat(((100 * e - h) / (e - h) / 100).toFixed(2)));

  // Интерфейс
  document.getElementById('btnStartGame').style.display = 'none';
  const btnCashout = document.getElementById('btnCashout');
  btnCashout.style.display = 'block';
  btnCashout.innerText = `ЗАБРАТЬ (${(betAmount * currentMultiplier).toFixed(0)} ⭐)`;

  const multEl = document.getElementById('multiplierVal');
  multEl.classList.remove('crashed');
  multEl.innerText = '1.00x';
  document.getElementById('crashStatus').innerText = 'РАКЕТА ЛЕТИТ...';

  // Старт цикла игры
  const startTime = Date.now();
  
  gameInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    currentMultiplier = parseFloat((1 + 0.06 * Math.pow(elapsed, 1.8)).toFixed(2));

    if (currentMultiplier >= crashPoint) {
      triggerCrash();
    } else {
      multEl.innerText = `${currentMultiplier.toFixed(2)}x`;
      btnCashout.innerText = `ЗАБРАТЬ (${(betAmount * currentMultiplier).toFixed(0)} ⭐)`;
    }
  }, 50);

  animateCanvas();
}

function cashoutCrash() {
  if (gameState !== 'RUNNING') return;

  gameState = 'IDLE';
  clearInterval(gameInterval);

  const winAmount = Math.floor(betAmount * currentMultiplier);
  updateBalance(winAmount);

  showToast(`Выигрыш: +${winAmount} ⭐!`);
  addHistoryBadge(currentMultiplier, true);

  resetGameUI();
}

function triggerCrash() {
  gameState = 'CRASHED';
  clearInterval(gameInterval);

  const multEl = document.getElementById('multiplierVal');
  multEl.innerText = `${crashPoint.toFixed(2)}x`;
  multEl.classList.add('crashed');
  document.getElementById('crashStatus').innerText = 'РАКЕТА ВЗОРВАЛАСЬ!';

  addHistoryBadge(crashPoint, false);
  showToast('Ракета улетела!');

  setTimeout(resetGameUI, 2000);
}

function resetGameUI() {
  gameState = 'IDLE';
  document.getElementById('btnStartGame').style.display = 'block';
  document.getElementById('btnCashout').style.display = 'none';
  if (gameState !== 'CRASHED') {
    document.getElementById('crashStatus').innerText = 'ОЖИДАНИЕ СТАВКИ';
  }
}

function addHistoryBadge(val, isWin) {
  const container = document.getElementById('crashHistory');
  if (!container) return;

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.style.background = isWin ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 70, 85, 0.2)';
  badge.style.color = isWin ? 'var(--accent-green)' : 'var(--accent-red)';
  badge.innerText = `${val.toFixed(2)}x`;

  container.insertBefore(badge, container.firstChild);
  if (container.children.length > 8) {
    container.removeChild(container.lastChild);
  }
}

// ==================== 4. CANVAS ОТРЕСОВКА ====================
let progress = 0;

function animateCanvas() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Сетка
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }

  if (gameState === 'RUNNING') {
    progress = Math.min(progress + 0.02, 1);
    
    // Отрисовка траектории полета
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    const controlX = canvas.width * 0.5;
    const controlY = canvas.height;
    const endX = canvas.width * 0.85;
    const endY = canvas.height * 0.2;

    ctx.quadraticCurveTo(controlX, controlY, endX * progress, canvas.height - (canvas.height - endY) * progress);
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Свечение под графиком
    ctx.lineTo(endX * progress, canvas.height);
    ctx.lineTo(0, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(255, 212, 59, 0.2)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();

    requestAnimationFrame(animateCanvas);
  } else {
    progress = 0;
  }
}
