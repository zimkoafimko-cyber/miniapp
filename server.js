const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Ошибка подключения к SQLite:', err.message);
    else console.log('База данных SQLite подключена успешно.');
});

db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    stars INTEGER DEFAULT 0,
    subscribed INTEGER DEFAULT 0,
    last_daily TEXT,
    last_share TEXT
)`);

// Получить данные пользователя
app.get('/api/user', (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'Нет ID пользователя' });

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: 'Ошибка базы данных' });
        if (!row) {
            db.run(`INSERT INTO users (id, stars, subscribed) VALUES (?, 0, 0)`, [userId], (err) => {
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true, stars: 0, subscribed: 0 });
            });
        } else {
            res.json({ success: true, stars: row.stars, subscribed: row.subscribed });
        }
    });
});

// Обновить баланс
app.post('/api/update-balance', (req, res) => {
    const { userId, balance } = req.body;
    if (!userId) return res.status(400).json({ success: false });

    db.run(`UPDATE users SET stars = ? WHERE id = ?`, [balance, userId], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Ежедневный бонус (+3 звезды)
app.post('/api/reward-daily', (req, res) => {
    const { userId } = req.body;
    const today = new Date().toDateString();

    db.get(`SELECT last_daily, stars FROM users WHERE id = ?`, [userId], (err, row) => {
        if (err || !row) return res.status(500).json({ success: false });

        if (row.last_daily === today) {
            return res.status(400).json({ success: false, message: 'Бонус уже получен сегодня!' });
        }

        const newStars = row.stars + 3;
        db.run(`UPDATE users SET stars = ?, last_daily = ? WHERE id = ?`, [newStars, today, userId], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, stars: newStars });
        });
    });
});

// Проверка подписки (+15 звезд)
app.post('/api/check-subscription', (req, res) => {
    const { userId } = req.body;
    
    db.get(`SELECT subscribed, stars FROM users WHERE id = ?`, [userId], (err, row) => {
        if (err || !row) return res.status(500).json({ success: false });

        if (row.subscribed === 1) {
            return res.json({ subscribed: true, stars: row.stars });
        }

        // Эмуляция проверки подписки (в реальном боте здесь идет запрос к Telegram Bot API)
        const isSubscribed = true; 

        if (isSubscribed) {
            const newStars = row.stars + 15;
            db.run(`UPDATE users SET subscribed = 1, stars = ? WHERE id = ?`, [newStars, userId], (err) => {
                if (err) return res.status(500).json({ success: false });
                res.json({ subscribed: true, stars: newStars });
            });
        } else {
            res.json({ subscribed: false });
        }
    });
});

// Награда за шеринг (+2 звезды)
app.post('/api/reward-share', (req, res) => {
    const { userId } = req.body;
    const now = Date.now();

    db.get(`SELECT last_share, stars FROM users WHERE id = ?`, [userId], (err, row) => {
        if (err || !row) return res.status(500).json({ success: false });

        if (row.last_share && now - row.last_share < 60000) {
            return res.status(400).json({ success: false, message: 'Слишком часто!' });
        }

        const newStars = row.stars + 2;
        db.run(`UPDATE users SET stars = ?, last_share = ? WHERE id = ?`, [newStars, now, userId], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, stars: newStars });
        });
    });
});

// Проверка админа (Замените 'your_admin_username' на свой юзернейм в Telegram без @)
app.post('/api/check-admin', (req, res) => {
    const { username } = req.body;
    const adminUsername = 'your_admin_username'; 
    res.json({ isAdmin: username === adminUsername });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
