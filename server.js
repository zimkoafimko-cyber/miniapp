const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_NAME = process.env.ADMIN_NAME;

// Проверка подписки пользователя через Telegram API
async function checkTelegramSubscription(userId) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${userId}`);
        const data = await response.json();
        
        if (data.ok) {
            const status = data.result.status;
            // Пользователь считается подписанным, если статус не left и не kicked
            return ['member', 'administrator', 'creator'].includes(status);
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки подписки:', error);
        return false;
    }
}
