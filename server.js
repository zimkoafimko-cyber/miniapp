const express = require('express');
const cors = require('cors');
const path = require('path');
const DataStore = require('nedb-promises');

const app = express();

app.use(express.json());
app.use(cors());

// Инициализация базы данных (файл базы сохранится локально на сервере)
const db = DataStore.create({ filename: path.join(__dirname, 'database.db'), autoload: true });

// Раздаем статические файлы (index.html, styles.css, script.js) из корня проекта
app.use(express.static(path.join(__dirname)));

// Читаем переменные окружения из Render
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_NAME = process.env.ADMIN_NAME;

// Функция проверки подписки на канал через Telegram Bot API
async function checkTelegramSubscription(userId) {
    if (!BOT_TOKEN || !CHANNEL_ID) {
        console.error('BOT_TOKEN или CHANNEL_ID не заданы в переменных окружения!');
        return false;
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`);
        const data = await response.json();
        
        if (data.ok) {
            const status = data.result.status;
            // Пользователь считается подписанным, если он участник, админ или создатель канала
            return ['member', 'administrator', 'creator'].includes(status);
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        return false;
    }
}

// Эндпоинт для проверки подписки
app.post('/api/check-subscription', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'userId обязателен' });
    }

    const isSubscribed = await checkTelegramSubscription(userId);
    
    // Если подписан, можно зафиксировать это в базе данных nedb
    if (isSubscribed) {
        await db.update(
            { userId: userId },
            { $set: { subscribed: true, updatedAt: new Date() } },
            { upsert: true }
        );
    }

    res.json({ subscribed: isSubscribed });
});

// Эндпоинт для проверки прав администратора (сравнение без учета символа @ и регистра)
app.post('/api/check-admin', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.json({ isAdmin: false });
    }

    const cleanAdminName = (ADMIN_NAME || '').replace('@', '').trim().toLowerCase();
    const cleanUserName = username.replace('@', '').trim().toLowerCase();

    const isAdmin = cleanUserName === cleanAdminName;
    res.json({ isAdmin });
});

// Главная страница — возвращает index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера на порту, который выделяет Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
