const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Читаем переменные окружения из Render
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_NAME = process.env.ADMIN_NAME;

// Базовый роут для проверки, что сервер живой
app.get('/', (req, res) => {
    res.send('Telegram Mini App Backend is running!');
});

// Функция проверки подписки на канал
async function checkTelegramSubscription(userId) {
    if (!BOT_TOKEN || !CHANNEL_ID) {
        console.error('BOT_TOKEN или CHANNEL_ID не заданы!');
        return false;
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`);
        const data = await response.json();
        
        if (data.ok) {
            const status = data.result.status;
            // Пользователь считается подписанным, если он участник, админ или создатель
            return ['member', 'administrator', 'creator'].includes(status);
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        return false;
    }
}

// Эндпоинт для проверки подписки из фронтенда
app.post('/api/check-subscription', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'userId обязателен' });
    }

    const isSubscribed = await checkTelegramSubscription(userId);
    res.json({ subscribed: isSubscribed });
});

// Эндпоинт для проверки, является ли пользователь администратором
app.post('/api/check-admin', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.json({ isAdmin: false });
    }

    // Сравниваем пришедший username с ADMIN_NAME из Render (без учета регистра и лишних символов)
    const cleanAdminName = (ADMIN_NAME || '').replace('@', '').trim();
    const cleanUserName = username.replace('@', '').trim();

    const isAdmin = cleanUserName === cleanAdminName;
    res.json({ isAdmin });
});

// Обязательно используем process.env.PORT для Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
