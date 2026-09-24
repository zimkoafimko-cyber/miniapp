// Ждем полной загрузки страницы, чтобы элементы точно существовали
document.addEventListener('DOMContentLoaded', () => {
    // Получаем данные пользователя Telegram или ставим заглушку для теста
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'guest_user';
    const username = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Игрок';

    // Загружаем баланс и рефералов из localStorage
    let balance = Number(localStorage.getItem('user_balance_' + userId)) || 100;
    let referralCount = Number(localStorage.getItem('user_refs_' + userId)) || 0;

    // Функция обновления интерфейса
    function updateUI() {
        const balanceEls = document.querySelectorAll('#balance, #wallet-balance');
        balanceEls.forEach(el => { if (el) el.innerText = balance; });

        const nameEl = document.getElementById('user-nicename');
        if (nameEl) nameEl.innerText = username;

        const avatarEl = document.getElementById('user-initial');
        if (avatarEl) avatarEl.innerText = username.charAt(0).toUpperCase();

        const refCountEl = document.getElementById('ref-count');
        if (refCountEl) refCountEl.innerText = referralCount;

        const refLinkInput = document.getElementById('ref-link');
        if (refLinkInput) {
            refLinkInput.value = `https://t.me/belcryptoo_bot?start=ref_${userId}`;
        }

        // Проверяем выполненные задания
        const completedTasks = JSON.parse(localStorage.getItem('completed_tasks_' + userId) || '[]');
        completedTasks.forEach(taskId => {
            const btn = document.getElementById(`check-btn-${taskId}`);
            if (btn) {
                btn.innerText = 'Выполнено ✓';
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.style.background = '#475569';
            }
        });

        localStorage.setItem('user_balance_' + userId, balance);
    }

    // Реферальная ссылка
    window.copyRefLink = function() {
        const refLinkInput = document.getElementById('ref-link');
        if (refLinkInput) {
            navigator.clipboard.writeText(refLinkInput.value);
            alert('📋 Реферальная ссылка скопирована!');
        }
    };

    // Проверка задания
    window.verifyTask = function(taskId, reward) {
        let completedTasks = JSON.parse(localStorage.getItem('completed_tasks_' + userId) || '[]');
        if (completedTasks.includes(taskId)) {
            alert('Вы уже получили награду за это задание!');
            return;
        }

        const checkBtn = document.getElementById(`check-btn-${taskId}`);
        if (checkBtn) checkBtn.innerText = 'Проверка...';

        setTimeout(() => {
            balance += reward;
            completedTasks.push(taskId);
            localStorage.setItem('completed_tasks_' + userId, JSON.stringify(completedTasks));
            updateUI();
            alert(`🎉 Подписка подтверждена! Начислено +${reward} ⭐`);
        }, 800);
    };

    // === ИГРА: КРАШ (РАКЕТА) ===
    let crashInterval = null;
    let currentMultiplier = 1.00;
    let isPlayingCrash = false;
    let crashBetAmount = 0;

    window.toggleCrashGame = function() {
        const btn = document.getElementById('crash-btn');
        const status = document.getElementById('crash-status');
        const betInput = document.getElementById('crash-bet');
        const multDisplay = document.getElementById('crash-mult');
        const fire = document.getElementById('rocket-fire');

        if (!isPlayingCrash) {
            crashBetAmount = Number(betInput.value);
            if (crashBetAmount > balance || crashBetAmount <= 0) {
                alert('Недостаточно звезд для ставки!');
                return;
            }

            balance -= crashBetAmount;
            updateUI();

            isPlayingCrash = true;
            currentMultiplier = 1.00;
            btn.innerText = 'Забрать';
            btn.style.background = '#22c55e';
            betInput.disabled = true;
            if (fire) fire.classList.add('fire-active');
            if (status) status.innerText = 'Ракета летит...';

            const crashPoint = 1.20 + Math.random() * 2.30;

            crashInterval = setInterval(() => {
                currentMultiplier += 0.04;
                if (multDisplay) multDisplay.innerText = currentMultiplier.toFixed(2) + 'x';

                if (currentMultiplier >= crashPoint) {
                    clearInterval(crashInterval);
                    isPlayingCrash = false;
                    if (fire) fire.classList.remove('fire-active');
                    if (multDisplay) multDisplay.innerText = 'CRASH!';
                    if (status) status.innerText = `💥 Взрыв на ${crashPoint.toFixed(2)}x! Ставка сгорела.`;
                    btn.innerText = 'Запустить';
                    btn.style.background = '';
                    betInput.disabled = false;
                }
            }, 120);

        } else {
            clearInterval(crashInterval);
            isPlayingCrash = false;
            if (fire) fire.classList.remove('fire-active');

            const winAmount = Math.floor(crashBetAmount * currentMultiplier);
            balance += winAmount;
            updateUI();

            if (status) status.innerText = `✅ Успех! Выигрыш +${winAmount} ⭐`;
            if (multDisplay) multDisplay.innerText = '💰 ' + winAmount;
            btn.innerText = 'Запустить';
            btn.style.background = '';
            betInput.disabled = false;
        }
    };

    // === ИГРА: КОСТИ (DICE) ===
    window.playDice = function() {
        const betInput = document.getElementById('dice-bet');
        const status = document.getElementById('dice-status');
        const dice1 = document.getElementById('dice-1');
        const dice2 = document.getElementById('dice-2');

        const bet = Number(betInput.value);
        if (bet > balance || bet <= 0) {
            alert('Недостаточно звезд!');
            return;
        }

        balance -= bet;
        updateUI();
        if (status) status.innerText = '🎲 Бросаем кости...';

        setTimeout(() => {
            const roll1 = Math.floor(Math.random() * 6) + 1;
            const roll2 = Math.floor(Math.random() * 6) + 1;
            const sum = roll1 + roll2;

            const symbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            if (dice1) dice1.innerText = symbols[roll1 - 1];
            if (dice2) dice2.innerText = symbols[roll2 - 1];

            if (sum > 7) {
                const win = bet * 2;
                balance += win;
                if (status) status.innerText = `🎉 Сумма ${sum}! Вы выиграли +${win} ⭐`;
            } else {
                if (status) status.innerText = `❌ Сумма ${sum}. Вы проиграли.`;
            }
            updateUI();
        }, 600);
    };

    // Навигация по вкладкам
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const targetTab = item.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            const activeTab = document.getElementById(targetTab);
            if (activeTab) activeTab.classList.add('active');
        });
    });

    // Первичный запуск интерфейса
    updateUI();
});
