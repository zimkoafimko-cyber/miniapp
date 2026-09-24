const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Серверное хранилище в памяти (ID пользователя -> Баланс)
const userBalances = {};
const completedTasksDB = {};

// Админ-авторизация
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'alina' && password === 'opelve') {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Неверный логин или пароль!' });
    }
});

// Выдача баланса из админки
app.post('/api/admin/set-balance', (req, res) => {
    const { userId, amount } = req.body;
    if (!userId) return res.json({ success: false });
    
    userBalances[userId] = Number(amount) || 0;
    res.json({ success: true, balances: userBalances });
});

// Получение списка всех пользователей для админки
app.get('/api/admin/users', (req, res) => {
    res.json({ success: true, balances: userBalances });
});

// Получение баланса пользователя для мини-приложения
app.get('/api/user/balance/:userId', (req, res) => {
    const userId = req.params.userId;
    const balance = userBalances[userId] !== undefined ? userBalances[userId] : 0;
    res.json({ success: true, balance });
});

// Синхронизация баланса с клиентом (когда игрок играет или выполняет задания)
app.post('/api/user/sync', (req, res) => {
    const { userId, balance } = req.body;
    if (userId) {
        userBalances[userId] = Number(balance) || 0;
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
