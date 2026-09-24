const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для обработки JSON запросов
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных SQLite:', err.message);
    } else {
        console.log('Успешно подключено к базе данных SQLite.');
    }
});

// Создание таблицы пользователей, если она еще не создана
db.run(`CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    username TEXT,
    stars INTEGER DEFAULT 0,
    subscribed INTEGER DEFAULT 0,
    last_daily TEXT
)`, (err) => {
    if (err) {
        console.error('Ошибка создания таблицы:', err.message);
    }
});

// --- API ЭНДПОИНТЫ ---

// 1. Получение данных пользователя и проверка регистрации
app.get('/api/user', (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'Отсутствует userId' });
    }

    db.get(`SELECT * FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
        }

        if (row) {
            res.json({
                success: true,
                stars: row.stars,
                subscribed: row.subscribed === 1
            });
        } else {
            // Если пользователя нет в базе — регистрируем с 0 балансом
            db.run(`INSERT INTO users (telegram_id, stars, subscribed) VALUES (?, 0, 0)`, [userId], (insErr) => {
                if (insErr) {
                    return res.status(500).json({ success: false, message: 'Ошибка создания пользователя' });
                }
                res.json({ success: true, stars: 0, subscribed: false });
            });
        }
    });
});

// 2. ГАРАНТИРОВАННОЕ СОХРАНЕНИЕ БАЛАНСА (исправление проблемы сброса)
app.post('/api/update-balance', (req, res) => {
    const { userId, balance } = req.body;
    if (!userId || balance === undefined) {
        return res.status(400).json({ success: false, message: 'Неверные данные' });
    }

    db.run(`UPDATE users SET stars = ? WHERE telegram_id = ?`, [balance, userId], function(err) {
        if (err) {
            console.error('Ошибка сохранения баланса:', err.message);
            return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
        }
        res.json({ success: true });
    });
});

// 3. Ежедневный бонус (+3 звезды)
app.post('/api/reward-daily', (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'No userId' });

    const today = new Date().toISOString().slice(0, 10); // Формат YYYY-MM-DD

    db.get(`SELECT last_daily, stars FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (err || !row) {
            return res.status(400).json({ success: false, message: 'Пользователь не найден' });
        }

        if (row.last_daily === today) {
            return res.json({ success: false, message: 'Бонус уже получен сегодня!' });
        }

        const newStars = row.stars + 3;
        db.run(`UPDATE users SET stars = ?, last_daily = ? WHERE telegram_id = ?`, [newStars, today, userId], (updErr) => {
            if (updErr) return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
            res.json({ success: true, stars: newStars });
        });
    });
});

// 4. Проверка подписки на канал
app.post('/api/check-subscription', (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'No userId' });

    db.get(`SELECT stars, subscribed FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (err || !row) return res.status(400).json({ success: false, message: 'User not found' });

        if (row.subscribed === 1) {
            return res.json({ subscribed: true, stars: row.stars });
        }

        // Здесь можно добавить реальный запрос через Telegram Bot API (telegraf / node-telegram-bot-api)
        // Для примера симулируем успешную подписку и начисление +15 звезд:
        const isSubscribed = true; // Замените на реальную проверку Telegram API при необходимости
        
        if (isSubscribed) {
            const newStars = row.stars + 15;
            db.run(`UPDATE users SET stars = ?, subscribed = 1 WHERE telegram_id = ?`, [newStars, userId], (updErr) => {
                if (updErr) return res.status(500).json({ success: false, message: 'DB error' });
                res.json({ subscribed: true, stars: newStars });
            });
        } else {
            res.json({ subscribed: false });
        }
    });
});

// 5. Награда за репост / поделиться (+2 звезды)
app.post('/api/reward-share', (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'No userId' });

    db.get(`SELECT stars FROM users WHERE telegram_id = ?`, [userId], (err, row) => {
        if (err || !row) return res.status(400).json({ success: false, message: 'User not found' });

        const newStars = row.stars + 2;
        db.run(`UPDATE users SET stars = ? WHERE telegram_id = ?`, [newStars, userId], (updErr) => {
            if (updErr) return res.status(500).json({ success: false, message: 'DB error' });
            res.json({ success: true, stars: newStars });
        });
    });
});

// 6. Проверка прав администратора
app.post('/api/check-admin', (req, res) => {
    const { username } = req.body;
    // Укажите свой юзернейм администратора без символа @
    const adminUsername = 'your_admin_username'; 

    const isAdmin = username && username.toLowerCase() === adminUsername.toLowerCase();
    res.json({ isAdmin });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
