// Определяем ID пользователя из Telegram Mini App или создаем гостевой
const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'guest_user';
const username = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Игрок';

// Загружаем данные из памяти устройства (localStorage)
let balance = Number(localStorage.getItem('user_balance_' + userId)) || 0;
let clicks = Number(localStorage.getItem('user_clicks_' + userId)) || 0;

// Функция обновления интерфейса
function updateUI() {
    const balanceElements = document.querySelectorAll('.balance-amount, #balance');
    balanceElements.forEach(el => {
        if (el) el.innerText = balance;
    });

    const nameEl = document.querySelector('.user-name');
    if (nameEl) nameEl.innerText = username;

    const avatarEl = document.querySelector('.user-avatar');
    if (avatarEl) avatarEl.innerText = username.charAt(0).toUpperCase();
}

// Обработка кликов / заработка
function handleTap() {
    balance += 1;
    clicks += 1;
    
    // Сохраняем в память телефона
    localStorage.setItem('user_balance_' + userId, balance);
    localStorage.setItem('user_clicks_' + userId, clicks);
    
    updateUI();
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    updateUI();

    // Привязываем клик к главной кнопке (например, с классом btn-primary или по ID)
    const actionBtn = document.getElementById('click-btn') || document.querySelector('.btn-primary');
    if (actionBtn) {
        actionBtn.addEventListener('click', handleTap);
    }

    // Логика переключения вкладок (нижняя навигация)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const targetTab = item.getAttribute('data-tab');
            if (targetTab) {
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                const activeTabContent = document.getElementById(targetTab);
                if (activeTabContent) {
                    activeTabContent.classList.add('active');
                }
            }
        });
    });
});
