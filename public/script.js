// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user;
const username = user ? user.username : 'Гость';
const firstName = user ? user.first_name : 'Пользователь';
const userId = user ? user.id : null;

// Оформляем аватарку и имя на странице
document.getElementById('userAvatar').innerText = firstName.charAt(0).toUpperCase();

const subActionBtn = document.getElementById('subActionBtn');
const checkSubBtn = document.getElementById('checkSubBtn');
const statusText = document.getElementById('statusText');
const adminPanel = document.getElementById('adminPanel');
const userStars = document.getElementById('userStars');

let isSubscribedState = false;

// Кнопка перехода на твой канал
subActionBtn.addEventListener('click', () => {
    window.open('https://t.me/belcryptoo', '_blank'); 
    subActionBtn.style.display = 'none';
    checkSubBtn.style.display = 'flex';
    checkSubBtn.classList.add('pulse');
    statusText.style.color = 'var(--hint-color)';
    statusText.innerText = 'После подписки нажмите кнопку проверки ниже 👇';
});

// Проверка подписки через сервер
checkSubBtn.addEventListener('click', async () => {
    if (!userId) {
        statusText.style.color = 'var(--danger)';
        statusText.innerText = 'Ошибка: не удалось определить профиль Telegram';
        return;
    }

    statusText.style.color = 'var(--hint-color)';
    statusText.innerText = 'Проверяем статус подписки...';

    try {
        const response = await fetch('/api/check-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId })
        });
        const data = await response.json();

        if (data.subscribed) {
            isSubscribedState = true;
            statusText.style.color = 'var(--success)';
            statusText.innerText = '🎉 Успешно! Вам начислено +10 звезд!';
            userStars.innerText = '10';
            checkSubBtn.style.display = 'none';
        } else {
            statusText.style.color = 'var(--danger)';
            statusText.innerText = '❌ Вы еще не подписались на канал!';
        }
    } catch (error) {
        statusText.style.color = 'var(--danger)';
        statusText.innerText = 'Ошибка связи с сервером проверки';
    }
});

// Проверка прав администратора при загрузке
if (username) {
    fetch('/api/check-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
    })
    .then(res => res.json())
    .then(data => {
        if (data.isAdmin) {
            adminPanel.style.display = 'block';
        }
    })
    .catch(err => console.error('Ошибка проверки админа:', err));
}
