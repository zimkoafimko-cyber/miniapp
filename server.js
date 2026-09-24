const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Настройка сессий для входа по паролю
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'super-secret-key-change-it', // Можете заменить на любой случайный текст
    resave: false,
    saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public')));

// === ДАННЫЕ АДМИНА ===
const ADMIN_LOGIN = 'admin';      // Ваш логин
const ADMIN_PASSWORD = '12345';   // Ваш пароль (обязательно смените потом!)

// База данных пользователей в памяти (в продакшене лучше подключить MongoDB/PostgreSQL)
// Ключ — ID или юзернейм, значение — баланс
const userBalances = {};

// Проверка авторизации
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ error: 'Не авторизован' });
}

// 1. Маршрут для входа
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Неверный логин или пароль!' });
});

// 2. Выход из админки
app.get('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 3. Получение и изменение баланса юзера (для админки)
app.post('/api/admin/set-balance', checkAuth, (req, res) => {
    const { userId, amount } = req.body;
    userBalances[userId] = Number(amount);
    res.json({ success: true, balances: userBalances });
});

// 4. Получение списка балансов
app.get('/api/admin/users', checkAuth, (req, res) => {
    res.json({ success: true, balances: userBalances });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
