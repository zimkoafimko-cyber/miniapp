const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Мидлварь для парсинга JSON и отдачи статических файлов (HTML, CSS, JS)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ==========================================
   1. БАЗА ДАННЫХ (SQLITE)
   ========================================== */
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err);
  } else {
    console.log('Успешное подключение к базе данных SQLite.');
  }
});

// Создание таблиц при старте сервера
db.serialize(() => {
  // Таблица пользователей
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      username TEXT,
      balance INTEGER DEFAULT 0,
      total_games INTEGER DEFAULT 0,
      max_mult REAL DEFAULT 1.0,
      ref_earned INTEGER DEFAULT 0
    )
  `);

  // Таблица выполненных заданий (чтобы исключить начисление наград по несколько раз)
  db.run(`
    CREATE TABLE IF NOT EXISTS completed_tasks (
      telegram_id TEXT,
      task_id INTEGER,
      PRIMARY KEY (telegram_id, task_id)
    )
  `);
});

/* ==========================================
   2. КОНФИГУРАЦИЯ ЗАДАНИЙ (SERVER TRUTH)
   ========================================== */
const TASKS_CONFIG = {
  1: { reward: 15, title: 'Подписка на канал' },
  2: { reward: 15, title: 'Пригласи 3 друзей' },
  3: { reward: 3,  title: 'Ежедневный бонус' }
};

/* ==========================================
   3. API ЭНДПОИНТЫ
   ========================================== */

// --- Инициализация и загрузка профиля ---
app.post('/api/user/init', (req, res) => {
  const { telegram_id, username } = req.body;

  if (!telegram_id) {
    return res.status(400).json({ error: 'Telegram ID обязателен' });
  }

  const userId = String(telegram_id);
  const name = username || 'Игрок';

  db.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, userRow) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!userRow) {
      // Регистрируем нового пользователя с стартовым балансом 0
      db.run(
        'INSERT INTO users (telegram_id, username, balance) VALUES (?, ?, 0)',
        [userId, name],
        (insertErr) => {
          if (insertErr) return res.status(500).json({ error: insertErr.message });
          
          return res.json({
            user: { telegram_id: userId, username: name, balance: 0, total_games: 0, max_mult: 1.0, ref_earned: 0 },
            completedTasks: []
          });
        }
      );
    } else {
      // Загружаем список айди выполненных заданий
      db.all('SELECT task_id FROM completed_tasks WHERE telegram_id = ?', [userId], (taskErr, taskRows) => {
        if (taskErr) return res.status(500).json({ error: taskErr.message });

        const completedIds = taskRows.map(t => t.task_id);
        return res.json({
          user: userRow,
          completedTasks: completedIds
        });
      });
    }
  });
});

// --- Логика игры в Кости (Dice) ---
app.post('/api/game/dice', (req, res) => {
  const { telegram_id, bet } = req.body;
  const userId = String(telegram_id);
  const betAmount = parseInt(bet, 10);

  if (isNaN(betAmount) || betAmount <= 0) {
    return res.status(400).json({ error: 'Неверная сумма ставки' });
  }

  db.get('SELECT balance, total_games FROM users WHERE telegram_id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (user.balance < betAmount) return res.status(400).json({ error: 'Недостаточно звезд на балансе' });

    // Генерация значений костей (1-6)
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const sum = dice1 + dice2;

    let isWin = false;
    let winAmount = 0;
    let newBalance = user.balance;

    if (sum === 7) {
      // При сумме 7 — проигрыш
      newBalance -= betAmount;
    } else {
      // Любая другая сумма — выигрыш x1.20
      isWin = true;
      winAmount = Math.floor(betAmount * 1.20) - betAmount;
      newBalance += winAmount;
    }

    const newGames = (user.total_games || 0) + 1;

    // Сохранение результатов в БД
    db.run(
      'UPDATE users SET balance = ?, total_games = ? WHERE telegram_id = ?',
      [newBalance, newGames, userId],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });

        res.json({
          dice1,
          dice2,
          sum,
          isWin,
          winAmount,
          newBalance
        });
      }
    );
  });
});

// --- Выполнение заданий ---
app.post('/api/tasks/complete', (req, res) => {
  const { telegram_id, task_id } = req.body;
  const userId = String(telegram_id);
  const taskId = parseInt(task_id, 10);

  const taskConfig = TASKS_CONFIG[taskId];
  if (!taskConfig) {
    return res.status(400).json({ error: 'Задание не существует' });
  }

  // Проверяем, делалось ли задание ранее
  db.get('SELECT * FROM completed_tasks WHERE telegram_id = ? AND task_id = ?', [userId, taskId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'Вы уже получили награду за это задание' });

    // Вставляем запись о выполнении
    db.run('INSERT INTO completed_tasks (telegram_id, task_id) VALUES (?, ?)', [userId, taskId], (insertErr) => {
      if (insertErr) return res.status(500).json({ error: insertErr.message });

      // Начисляем награду на баланс
      db.get('SELECT balance FROM users WHERE telegram_id = ?', [userId], (userErr, user) => {
        if (userErr || !user) return res.status(400).json({ error: 'Пользователь не найден' });

        const newBalance = user.balance + taskConfig.reward;

        db.run('UPDATE users SET balance = ? WHERE telegram_id = ?', [newBalance, userId], (updateErr) => {
          if (updateErr) return res.status(500).json({ error: updateErr.message });

          res.json({
            success: true,
            reward: taskConfig.reward,
            newBalance
          });
        });
      });
    });
  });
});

// --- Вывод средств ---
app.post('/api/withdraw', (req, res) => {
  const { telegram_id, wallet, amount } = req.body;
  const userId = String(telegram_id);
  const withdrawAmount = parseInt(amount, 10);

  if (!wallet || isNaN(withdrawAmount) || withdrawAmount < 50) {
    return res.status(400).json({ error: 'Минимальная сумма для вывода: 50 ⭐' });
  }

  db.get('SELECT balance FROM users WHERE telegram_id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (user.balance < withdrawAmount) return res.status(400).json({ error: 'Недостаточно средств на балансе' });

    const newBalance = user.balance - withdrawAmount;

    db.run('UPDATE users SET balance = ? WHERE telegram_id = ?', [newBalance, userId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: updateErr.message });

      res.json({
        success: true,
        newBalance,
        message: 'Заявка на вывод успешно сформирована!'
      });
    });
  });
});

/* ==========================================
   4. ЗАПУСК СЕРВЕРА
   ========================================== */
app.listen(PORT, () => {
  console.log(`Сервер успешно запущен на порту ${PORT}`);
});
