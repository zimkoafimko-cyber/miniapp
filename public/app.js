document.addEventListener('DOMContentLoaded', () => {
    // Получаем реальный ID пользователя из Telegram (или ставим guest_user для тестов на ПК)
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'guest_user';
    const username = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Игрок';

    // Уникальные ключи с версией v2 для чистого старта у всех игроков
    const balanceKey = 'user_balance_v2_' + userId;
    const refsKey = 'user_refs_v2_' + userId;
    const tasksKey = 'completed_tasks_v2_' + userId;

    let balance = Number(localStorage.getItem(balanceKey)) || 0;
    let referralCount = Number(localStorage.getItem(refsKey)) || 0;

    // Функция обновления интерфейса на экране
    function updateUI() {
        const balanceEls = document.querySelectorAll('#balance, #wallet-balance');
        balanceEls.forEach(el => { if (el) el.innerText = balance; });

        const nameEls = document.querySelectorAll('#user-nicename, #profile-name');
        nameEls.forEach(el => { if (el) el.innerText = username; });

        const avatarEls = document.querySelectorAll('#user-initial, #profile-initial');
        avatarEls.forEach(el => { if (el) el.innerText = username.charAt(0).toUpperCase(); });

        const profileIdInput = document.getElementById('profile-id-input');
        if (profileIdInput) {
            profileIdInput.value = userId;
        }

        const refCountEl = document.getElementById('ref-count');
        if (refCountEl) refCountEl.innerText = referralCount;

        const refLinkInput = document.getElementById('ref-link');
        if (refLinkInput) {
            refLinkInput.value = `https://t.me/belcryptoo_bot?start=ref_${userId}`;
        }

        const completedTasks = JSON.parse(localStorage.getItem(tasksKey) || '[]');
        completedTasks.forEach(taskId => {
            const btn = document.getElementById(`check-btn-${taskId}`);
            if (btn) {
                btn.innerText = 'Выполнено ✓';
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.style.background = '#475569';
            }
        });

        localStorage.setItem(balanceKey, balance);
    }

    // Копирование реферальной ссылки
    window.copyRefLink = function() {
        const refLinkInput = document.getElementById('ref-link');
        if (refLinkInput) {
            navigator.clipboard.writeText(refLinkInput.value);
            alert('📋 Реферальная ссылка скопирована!');
        }
    };

    // Копирование уникального ID из профиля
    window.copyUserId = function() {
        const profileIdInput = document.getElementById('profile-id-input');
        if (profileIdInput) {
            navigator.clipboard.writeText(profileIdInput.value);
            alert('📋 Ваш ID успешно скопирован в буфер обмена!');
        }
    };

    // Проверка заданий
    window.verifyTask = function(taskId, reward) {
        let completedTasks = JSON.parse(localStorage.getItem(tasksKey) || '[]');
        if (completedTasks.includes(taskId)) {
            alert('Вы уже получили награду за это задание!');
            return;
        }

        const checkBtn = document.getElementById(`check-btn-${taskId}`);
        if (checkBtn) checkBtn.innerText = 'Проверка...';

        setTimeout(() => {
            balance += reward;
            completedTasks.push(taskId);
            localStorage.setItem(tasksKey, JSON.stringify(completedTasks));
            updateUI();
            alert(`🎉 Подписка подтверждена! Начислено +${reward} ⭐`);
        }, 800);
    };

    // Запрос на вывод средств
    window.withdrawStars = function() {
        if (balance < 50) {
            alert('❌ Недостаточно звезд! Минимум для вывода: 50 ⭐');
            return;
        }
        alert(`✅ Заявка на вывод отправлена на аккаунт @AlinaResseler!\nСумма: ${balance} ⭐`);
    };

    // === ИГРА: КРАШ (РАКЕТА) — Шанс выигрыша 35% ===
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
        const rocketObj = document.getElementById('rocket-container-obj');

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
            btn.innerText = 'Забрать ⭐';
            btn.style.background = 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)';
            betInput.disabled = true;
            if (fire) fire.classList.add('fire-active');
            if (status) status.innerText = '🚀 Ракета набирает высоту...';

            // Шанс успеха 35%
            const isLucky = Math.random() * 100 < 35;
            const crashPoint = isLucky ? (2.0 + Math.random() * 3.0) : (1.02 + Math.random() * 0.18);

            crashInterval = setInterval(() => {
                currentMultiplier += 0.05;
                if (multDisplay) multDisplay.innerText = currentMultiplier.toFixed(2) + 'x';
                
                if (rocketObj) {
                    const randomOffset = (Math.random() - 0.5) * 6;
                    rocketObj.style.transform = `translateY(-${(currentMultiplier - 1) * 15}px) translateX(${randomOffset}px)`;
                }

                if (currentMultiplier >= crashPoint) {
                    clearInterval(crashInterval);
                    isPlayingCrash = false;
                    if (fire) fire.classList.remove('fire-active');
                    if (rocketObj) rocketObj.style.transform = 'translateY(0px)';
                    if (multDisplay) multDisplay.innerText = 'CRASH 💥';
                    if (status) status.innerText = `💥 Ракета взорвалась на ${crashPoint.toFixed(2)}x! Ставка сгорела.`;
                    btn.innerText = 'Запустить';
                    btn.style.background = '';
                    betInput.disabled = false;
                }
            }, 120);

        } else {
            clearInterval(crashInterval);
            isPlayingCrash = false;
            if (fire) fire.classList.remove('fire-active');
            if (rocketObj) rocketObj.style.transform = 'translateY(0px)';

            const winAmount = Math.floor(crashBetAmount * currentMultiplier);
            balance += winAmount;
            updateUI();

            if (status) status.innerText = `🎉 Успех! Вы забрали +${winAmount} ⭐`;
            if (multDisplay) multDisplay.innerText = '+' + winAmount;
            btn.innerText = 'Запустить';
            btn.style.background = '';
            betInput.disabled = false;
        }
    };

    // === ИГРА: КОСТИ — Шанс выигрыша 30% ===
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

        if (dice1) dice1.classList.add('dice-rolling');
        if (dice2) dice2.classList.add('dice-rolling');

        setTimeout(() => {
            if (dice1) dice1.classList.remove('dice-rolling');
            if (dice2) dice2.classList.remove('dice-rolling');

            // Шанс победы 30%
            const isWin = Math.random() * 100 < 30;
            let roll1, roll2, sum;

            if (isWin) {
                do {
                    roll1 = Math.floor(Math.random() * 6) + 1;
                    roll2 = Math.floor(Math.random() * 6) + 1;
                    sum = roll1 + roll2;
                } while (sum <= 7);
            } else {
                do {
                    roll1 = Math.floor(Math.random() * 6) + 1;
                    roll2 = Math.floor(Math.random() * 6) + 1;
                    sum = roll1 + roll2;
                } while (sum > 7);
            }

            const symbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            if (dice1) dice1.innerText = symbols[roll1 - 1];
            if (dice2) dice2.innerText = symbols[roll2 - 1];

            if (sum > 7) {
                const win = bet * 2;
                balance += win;
                if (status) status.innerText = `🎉 Сумма ${sum} (больше 7)! Вы выиграли +${win} ⭐`;
            } else {
                if (status) status.innerText = `❌ Сумма ${sum}. К сожалению, вы проиграли.`;
            }
            updateUI();
        }, 500);
    };

    // Логика переключения нижних вкладок меню
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

    // Первичный запуск интерфейса при открытии страницы
    updateUI();
});
