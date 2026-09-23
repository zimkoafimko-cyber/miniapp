const express = require('express');
const Datastore = require('nedb-promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных на чистом JS (без C++ компиляции)
const usersDb = Datastore.create({ filename: path.join(__dirname, 'users.db'), autoload: true });
const tasksDb = Datastore.create({ filename: path.join(__dirname, 'tasks.db'), autoload: true });

// Конфигурация заданий
const TASKS_CONFIG = {
  1: { reward: 15, title: 'Подписка на канал' },
  2: { reward: 15, title: 'Пригласи 3 друзей' },
  3: { reward: 3,  title: 'Ежедневный бонус' }
};

// 1. Инициализация пользователя
app.post('/api/user/init', async (req, res) => {
  try {
    const { telegram_id, username } = req.body;
    if (!telegram_id) return res.status(400).json({ error: 'Telegram ID обязателен' });

    const userId = String(telegram_id);
    const name = username || 'Игрок';

    let user = await usersDb.findOne({ telegram_id: userId });

    if (!user) {
      user = {
        telegram_id: userId,
        username: name,
        balance: 0,
        total_games: 0,
        max_mult: 1.0,
        ref_earned: 0
      };
      await usersDb.insert(user);
    }

    const tasks = await tasksDb.find({ telegram_id: userId });
    const completedTasks = tasks.map(t => t.task_id);

    res.json({ user, completedTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Игра в Кости (Dice)
app.post('/api/game/dice', async (req, res) => {
  try {
    const { telegram_id, bet } = req.body;
    const userId = String(telegram_id);
    const betAmount = parseInt(bet, 10);

    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: 'Неверная сумма ставки' });
    }

    const user = await usersDb.findOne({ telegram_id: userId });
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

    await usersDb.update(
      { telegram_id: userId },
      { $set: { balance: newBalance, total_games: newGames } }
    );

    res.json({ dice1, dice2, sum, isWin, winAmount, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Выполнение заданий
app.post('/api/tasks/complete', async (req, res) => {
  try {
    const { telegram_id, task_id } = req.body;
    const userId = String(telegram_id);
    const taskId = parseInt(task_id, 10);

    const taskConfig = TASKS_CONFIG[taskId];
    if (!taskConfig) return res.status(400).json({ error: 'Задание не найдено' });

    const existing = await tasksDb.findOne({ telegram_id: userId, task_id: taskId });
    if (existing) return res.status(400).json({ error: 'Задание уже выполнено' });

    await tasksDb.insert({ telegram_id: userId, task_id: taskId });

    const user = await usersDb.findOne({ telegram_id: userId });
    const newBalance = (user ? user.balance : 0) + taskConfig.reward;

    await usersDb.update(
      { telegram_id: userId },
      { $set: { balance: newBalance } }
    );

    res.json({ success: true, reward: taskConfig.reward, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Вывод средств
app.post('/api/withdraw', async (req, res) => {
  try {
    const { telegram_id, wallet, amount } = req.body;
    const userId = String(telegram_id);
    const withdrawAmount = parseInt(amount, 10);

    if (!wallet || isNaN(withdrawAmount) || withdrawAmount < 50) {
      return res.status(400).json({ error: 'Минимальная сумма вывода 50 ⭐' });
    }

    const user = await usersDb.findOne({ telegram_id: userId });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (user.balance < withdrawAmount) return res.status(400).json({ error: 'Недостаточно средств' });

    const newBalance = user.balance - withdrawAmount;
    await usersDb.update(
      { telegram_id: userId },
      { $set: { balance: newBalance } }
    );

    res.json({ success: true, newBalance, message: 'Заявка отправлена!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
