const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'super-secret-key-12345',
    resave: false,
    saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public')));

// Данные админа
const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = '12345';

// База данных балансов для админки
const userBalances = {};

function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).json({ success: false, error: 'Не авторизован' });
}

// Авторизация
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Неверный логин или пароль!' });
});

app.get('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Управление балансами
app.post('/api/admin/set-balance', checkAuth, (req, res) => {
    const { userId, amount } = req.body;
    userBalances[userId] = Number(amount);
    res.json({ success: true, balances: userBalances });
});

app.get('/api/admin/users', checkAuth, (req, res) => {
    res.json({ success: true, balances: userBalances });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
