const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Настройка middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'super-secret-key-change-it-12345', // Случайный секретный ключ для сессий
    resave: false,
    saveUninitialized: false
}));

// Раздаем статические файлы из папки public (index.html, styles.css, app.js, admin.html)
app.use(express.static(path.join(__dirname, 'public')));

// === ДАННЫЕ АДМИНА ===
const ADMIN_LOGIN = 'admin';      // Ваш логин для входа
const ADMIN_PASSWORD = '12345';   // Ваш пароль для входа

// База данных балансов пользователей (в памяти)
const userBalances = {};

// Промежуточная проверка: авторизован ли админ
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ success: false, error: 'Не авторизован' });
}

// === API ДЛЯ ИГРЫ И ПРИЛОЖЕНИЯ ===

// 1. Синхронизация и сохранение данных игрока (чтобы не было ошибки связи)
app.post('/api/user/update', (req, res) => {
    const { userId, balance, clicks } = req.body;
    
    // Если userId не передан, создаем временный ключ по IP или дефолтный
    const id = userId || req.ip || 'guest';
    
    userBalances[id] = {
        balance: Number(balance) || 0,
        clicks: Number(clicks) || 0,
        updatedAt: new Date()
    };
    
    res.json({ success: true, balance: userBalances[id].balance });
});

// 2. Получение данных игрока
app.get('/api/user/get/:id', (req, res) => {
    const userId = req.params.id;
    const userData = userBalances[userId] || { balance: 0, clicks: 0 };
    res.json({ success: true, ...userData });
});


// === API ДЛЯ АДМИН-ПАНЕЛИ ===

// 3. Авторизация в админке
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Неверный логин или пароль!' });
});

// 4. Выход из админки
app.get('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 5. Изменение/выдача баланса игроку через админку
app.post('/api/admin/set-balance', checkAuth, (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || amount === undefined) {
        return res.status(400).json({ success: false, message: 'Заполните все поля!' });
    }
    
    // Если пользователя еще нет в базе, создаем структуру
    if (!userBalances[userId]) {
        userBalances[userId] = { balance: 0, clicks: 0 };
    }
    
    userBalances[userId].balance = Number(amount);
    
    // Преобразуем объект в удобный формат для админки (выводим просто балансы)
    const simpleBalances = {};
    for (const [key, val] of Object.entries(userBalances)) {
        simpleBalances[key] = val.balance;
    }
    
    res.json({ success: true, balances: simpleBalances });
});

// 6. Получение списка всех балансов для админки
app.get('/api/admin/users', checkAuth, (req, res) => {
    const simpleBalances = {};
    for (const [key, val] of Object.entries(userBalances)) {
        simpleBalances[key] = val.balance;
    }
    res.json({ success: true, balances: simpleBalances });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер успешно запущен на порту ${PORT}`);
});
