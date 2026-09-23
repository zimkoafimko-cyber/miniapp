const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных SQLite
const db = new Database('./database.sqlite');

// Создание таблиц при запуске
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    balance INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    max_mult REAL DEFAULT 1.0,
    ref_earned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS completed_tasks (
    telegram_id TEXT,
    task_id INTEGER,
    PRIMARY KEY (telegram_id, task_id)
  );
`);

// Конфигурация заданий
const TASKS_CONFIG = {
  1: { reward: 15, title: 'Подписка на канал' },
  2: { reward: 15, title: 'Пригласи 3 друзей' },
  3: { reward: 3,  title: 'Ежедневный бонус' }
};

// 1. Инициализация пользователя
app.post('/api/user/init', (req, res) => {
  try {
    const { telegram_id, username } = req.body;
    if (!telegram_id) return res.status(400).json({ error: 'Telegram ID обязателен' });

    const userId = String(telegram_id);
    const name = username || 'Игрок';

    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(userId);

    if (!user) {
      db.prepare('INSERT INTO users (telegram_id, username, balance) VALUES (?, ?, 0)').run(userId, name);
      user = { telegram_id: userId, username: name, balance: 0, total_games: 0, max_mult: 1.0, ref_earned: 0 };
    }

    const tasks = db.prepare('SELECT task_id FROM completed_tasks WHERE telegram_id = ?').all(userId);
    const completedTasks = tasks.map(t => t.task_id);

    res.json({ user, completedTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Игра в Кости (Dice)
app.post('/api/game/dice', (req, res) => {
  try {
    const { telegram_id, bet } = req.body;
    const userId = String(telegram_id);
    const betAmount = parseInt(bet, 10);

    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: 'Неверная сумма ставки' });
    }

    const user = db.prepare('SELECT balance, total_games FROM users WHERE telegram_id = ?').get(userId);
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (user.balance < betAmount) return res.status(400).json({ error: 'Недостаточно звезд на балансе' });

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const sum = dice1 + dice2;

    let isWin = false;
    let winAmount = 0;
    let newBalance = user.balance;

    if (sum === 7) {
      newBalance -= betAmount;
    } else {
      isWin = true;
      winAmount = Math.floor(betAmount * 1.20) - betAmount;
      newBalance += winAmount;
    }

    const newGames = (user.total_games || 0) + 1;

    db.prepare('UPDATE users SET balance = ?, total_games = ? WHERE telegram_id = ?').run(newBalance, newGames, userId);

    res.json({ dice1, dice2, sum, isWin, winAmount, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Выполнение заданий
app.post('/api/tasks/complete', (req, res) => {
  try {
    const { telegram_id, task_id } = req.body;
    const userId = String(telegram_id);
    const taskId = parseInt(task_id, 10);

    const taskConfig = TASKS_CONFIG[taskId];
    if (!taskConfig) return res.status(400).json({ error: 'Задание не найдено' });

    const existing = db.prepare('SELECT * FROM completed_tasks WHERE telegram_id = ? AND task_id = ?').get(userId, taskId);
    if (existing) return res.status(400).json({ error: 'Задание уже выполнено' });

    db.prepare('INSERT INTO completed_tasks (telegram_id, task_id) VALUES (?, ?)').run(userId, taskId);

    const user = db.prepare('SELECT balance FROM users WHERE telegram_id = ?').get(userId);
    const newBalance = (user ? user.balance : 0) + taskConfig.reward;

    db.prepare('UPDATE users SET balance = ? WHERE telegram_id = ?').run(newBalance, userId);

    res.json({ success: true, reward: taskConfig.reward, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Вывод средств
app.post('/api/withdraw', (req, res) => {
  try {
    const { telegram_id, wallet, amount } = req.body;
    const userId = String(telegram_id);
    const withdrawAmount = parseInt(amount, 10);

    if (!wallet || isNaN(withdrawAmount) || withdrawAmount < 50) {
      return res.status(400).json({ error: 'Минимальная сумма вывода 50 ⭐' });
    }

    const user = db.prepare('SELECT balance FROM users WHERE telegram_id = ?').get(userId);
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (user.balance < withdrawAmount) return res.status(400).json({ error: 'Недостаточно средств' });

    const newBalance = user.balance - withdrawAmount;
    db.prepare('UPDATE users SET balance = ? WHERE telegram_id = ?').run(newBalance, userId);

    res.json({ success: true, newBalance, message: 'Заявка отправлена!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
