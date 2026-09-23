const express = require('express');
const Datastore = require('nedb-promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Использование v3 файлов базы данных для полного сброса
const usersDb = Datastore.create({ filename: path.join(__dirname, 'users_v3.db'), autoload: true });
const tasksDb = Datastore.create({ filename: path.join(__dirname, 'tasks_v3.db'), autoload: true });

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

// 2. Логика Ракетки: Старт полета
app.post('/api/game/crash/play', async (req, res) => {
  try {
    const { telegram_id, bet } = req.body;
    const userId = String(telegram_id);
    const betAmount = parseInt(bet, 10);

    if (isNaN(betAmount) || betAmount <= 0) return res.status(400).json({ error: 'Неверная ставка' });

    const user = await usersDb.findOne({ telegram_id: userId });
    if (!user || user.balance < betAmount) return res.status(400).json({ error: 'Недостаточно звезд' });

    // Снимаем ставку с баланса
    const newBalance = user.balance - betAmount;
    
    // Генерация коэффициента взрыва (от 1.01 до 6.00x)
    const crashPoint = +(1 + Math.random() * 5).toFixed(2);

    await usersDb.update({ telegram_id: userId }, { $set: { balance: newBalance } });

    res.json({ success: true, newBalance, crashPoint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Логика Ракетки: Забрать выигрыш (Cashout)
app.post('/api/game/crash/cashout', async (req, res) => {
  try {
    const { telegram_id, winAmount, mult } = req.body;
    const userId = String(telegram_id);
    const win = parseInt(winAmount, 10);
    const currentMult = parseFloat(mult);

    const user = await usersDb.findOne({ telegram_id: userId });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

    const newBalance = user.balance + win;
    const newGames = (user.total_games || 0) + 1;
    const maxMult = Math.max(user.max_mult || 1.0, currentMult);

    await usersDb.update(
      { telegram_id: userId },
      { $set: { balance: newBalance, total_games: newGames, max_mult: maxMult } }
    );

    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Игра в Кости (Dice)
app.post('/api/game/dice', async (req, res) => {
  try {
    const { telegram_id, bet } = req.body;
    const userId = String(telegram_id);
    const betAmount = parseInt(bet, 10);

    if (isNaN(betAmount) || betAmount <= 0) return res.status(400).json({ error: 'Неверная ставка' });

    const user = await usersDb.findOne({ telegram_id: userId });
    if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
    if (user.balance < betAmount) return res.status(400).json({ error: 'Недостаточно звезд' });

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

// 5. Задания
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

    await usersDb.update({ telegram_id: userId }, { $set: { balance: newBalance } });

    res.json({ success: true, reward: taskConfig.reward, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Вывод
app.post('/api/withdraw', async (req, res) => {
  try {
    const { telegram_id, wallet, amount } = req.body;
    const userId = String(telegram_id);
    const withdrawAmount = parseInt(amount, 10);

    if (!wallet || isNaN(withdrawAmount) || withdrawAmount < 50) {
      return res.status(400).json({ error: 'Минимальная сумма вывода 50 ⭐' });
    }

    const user = await usersDb.findOne({ telegram_id: userId });
    if (!user || user.balance < withdrawAmount) return res.status(400).json({ error: 'Недостаточно средств' });

    const newBalance = user.balance - withdrawAmount;
    await usersDb.update({ telegram_id: userId }, { $set: { balance: newBalance } });

    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
