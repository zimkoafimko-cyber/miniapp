const express = require('express');
const cors = require('cors');
const path = require('path');
const DataStore = require('nedb-promises');

const app = express();

app.use(express.json());
app.use(cors());

// База данных сохраняется в файл database.db, данные не пропадут при перезапуске
const db = DataStore.create({ filename: path.join(__dirname, 'database.db'), autoload: true });
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID || '@belcryptoo';
const ADMIN_NAME = process.env.ADMIN_NAME;

// Функция проверки подписки через Telegram API
async function checkTelegramSubscription(userId) {
    if (!BOT_TOKEN) return false;
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`);
        const data = await response.json();
        if (data.ok) {
            return ['member', 'administrator', 'creator'].includes(data.result.status);
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки подписки API:', error);
        return false;
    }
}

// Получить или создать пользователя (баланс сохраняется навсегда)
app.get('/api/user', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false });

    let user = await db.findOne({ userId: Number(userId) });
    if (!user) {
        user = { 
            userId: Number(userId), 
            stars: 0, 
            subscribed: false, 
            lastShared: null, 
            lastDaily: null 
        };
        await db.insert(user);
    }
    res.json({ 
        success: true, 
        stars: user.stars, 
        subscribed: user.subscribed 
    });
});

// Проверка подписки и начисление 15 звезд (только 1 раз)
app.post('/api/check-subscription', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });

    let user = await db.findOne({ userId: Number(userId) });
    if (!user) {
        user = { userId: Number(userId), stars: 0, subscribed: false };
        await db.insert(user);
    }

    if (user.subscribed) {
        return res.json({ subscribed: true, stars: user.stars });
    }

    const isSubscribed = await checkTelegramSubscription(userId);

    if (isSubscribed) {
        user.subscribed = true;
        user.stars = (user.stars || 0) + 15; // 15 звезд за подписку
        await db.update(
            { userId: Number(userId) }, 
            { $set: { subscribed: true, stars: user.stars } }
        );
    }

    res.json({ subscribed: user.subscribed, stars: user.stars });
});

// Награда за шеринг (+2 звезды с защитой от спама)
app.post('/api/reward-share', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false });

    let user = await db.findOne({ userId: Number(userId) });
    if (!user) {
        user = { userId: Number(userId), stars: 0, lastShared: 0 };
        await db.insert(user);
    }

    const now = Date.now();
    if (user.lastShared && now - user.lastShared < 60000) {
        return res.json({ success: false, message: 'Слишком часто! Подождите минуту.' });
    }

    user.stars = (user.stars || 0) + 2;
    user.lastShared = now;

    await db.update(
        { userId: Number(userId) }, 
        { $set: { stars: user.stars, lastShared: user.lastShared } }
    );

    res.json({ success: true, stars: user.stars });
});

// Ежедневный бонус (+3 звезды, защита: строго 1 раз в 24 часа)
app.post('/api/reward-daily', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false });

    let user = await db.findOne({ userId: Number(userId) });
    if (!user) {
        user = { userId: Number(userId), stars: 0, lastDaily: 0 };
        await db.insert(user);
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (user.lastDaily && now - user.lastDaily < oneDay) {
        return res.json({ success: false, message: 'Бонус уже получен сегодня! Ждите 24 часа.' });
    }

    user.stars = (user.stars || 0) + 3;
    user.lastDaily = now;

    await db.update(
        { userId: Number(userId) }, 
        { $set: { stars: user.stars, lastDaily: user.lastDaily } }
    );

    res.json({ success: true, stars: user.stars });
});

// Синхронизация баланса после игр (краш / кости)
app.post('/api/update-balance', async (req, res) => {
    const { userId, newBalance } = req.body;
    if (!userId || typeof newBalance !== 'number' || newBalance < 0) {
        return res.status(400).json({ success: false, message: 'Некорректные данные' });
    }

    let user = await db.findOne({ userId: Number(userId) });
    if (!user) {
        return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    await db.update(
        { userId: Number(userId) }, 
        { $set: { stars: newBalance } }
    );

    res.json({ success: true, stars: newBalance });
});

// Проверка админа
app.post('/api/check-admin', (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ isAdmin: false });

    const cleanAdminName = (ADMIN_NAME || '').replace('@', '').trim().toLowerCase();
    const cleanUserName = username.replace('@', '').trim().toLowerCase();

    res.json({ isAdmin: cleanUserName === cleanAdminName });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
