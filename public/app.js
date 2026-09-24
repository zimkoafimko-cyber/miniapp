document.addEventListener('DOMContentLoaded', async () => {
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'guest_user';
    const username = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Игрок';

    const refsKey = 'user_refs_v2_' + userId;
    const tasksKey = 'completed_tasks_v2_' + userId;

    let balance = 0;
    let referralCount = Number(localStorage.getItem(refsKey)) || 0;

    // Загружаем актуальный баланс с сервера при старте
    async function loadServerBalance() {
        try {
            const res = await fetch(`/api/user/balance/${userId}`);
            const data = await res.json();
            if (data.success) {
                balance = data.balance;
                updateUI();
            }
        } catch (e) {
            console.error('Ошибка загрузки баланса с сервера', e);
        }
    }

    // Синхронизируем баланс с сервером при изменениях
    async function syncBalanceToServer() {
        try {
            await fetch('/api/user/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, balance })
            });
        } catch (e) {
            console.error('Ошибка синхронизации', e);
        }
    }

    function updateUI() {
        const balanceEls = document.querySelectorAll('#balance, #wallet-balance');
        balanceEls.forEach(el => { if (el) el.innerText = balance; });

        const nameEls = document.querySelectorAll('#user-nicename, #profile-name');
        nameEls.forEach(el => { if (el) el.innerText = username; });

        const avatarEls = document.querySelectorAll('#user-initial, #profile-initial');
        avatarEls.forEach(el => { if (el) el.innerText = username.charAt(0).toUpperCase(); });

        const profileIdInput = document.getElementById('profile-id-input');
        if (profileIdInput) profileIdInput.value = userId;

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

        syncBalanceToServer();
    }

    window.copyRefLink = function() {
        const refLinkInput = document.getElementById('ref-link');
        if (refLinkInput) {
            navigator.clipboard.writeText(refLinkInput.value);
            alert('📋 Реферальная ссылка скопирована!');
        }
    };

    window.copyUserId = function() {
        const profileIdInput = document.getElementById('profile-id-input');
        if (profileIdInput) {
            navigator.clipboard.writeText(profileIdInput.value);
            alert('📋 Ваш ID успешно скопирован!');
        }
    };

    window.verifyTask = function(taskId, reward) {
        let completedTasks = JSON.parse(localStorage.getItem(tasksKey) || '[]');
        if (completedTasks.includes(taskId)) {
            alert('Вы уже получили награду!');
            return;
        }

        const checkBtn = document.getElementById(`check-btn-${taskId}`);
        if (checkBtn) checkBtn.innerText = 'Проверка...';

        setTimeout(() => {
            balance += reward;
            completedTasks.push(taskId);
            localStorage.setItem(tasksKey, JSON.stringify(completedTasks));
            updateUI();
            alert(`🎉 Начислено +${reward} ⭐`);
        }, 800);
    };

    window.withdrawStars = function() {
        if (balance < 50) {
            alert('❌ Минимум для вывода: 50 ⭐');
            return;
        }
        alert(`✅ Заявка на вывод отправлена на аккаунт @AlinaResseler!\nСумма: ${balance} ⭐`);
    };

    // === КРАШ ИГРА (35% win) ===
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
                alert('Недостаточно звезд!');
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
            if (status) status.innerText = '🚀 Ракета летит...';

            const isLucky = Math.random() * 100 < 35;
            const crashPoint = isLucky ? (2.0 + Math.random() * 3.0) : (1.02 + Math.random() * 0.18);

            crashInterval = setInterval(() => {
                currentMultiplier += 0.05;
                if (multDisplay) multDisplay.innerText = currentMultiplier.toFixed(2) + 'x';

                if (currentMultiplier >= crashPoint) {
                    clearInterval(crashInterval);
                    isPlayingCrash = false;
                    if (fire) fire.classList.remove('fire-active');
                    if (multDisplay) multDisplay.innerText = 'CRASH 💥';
                    if (status) status.innerText = `💥 Взрыв на ${crashPoint.toFixed(2)}x! Ставка сгорела.`;
                    btn.innerText = 'Запустить';
                    btn.style.background = '';
                    betInput.disabled = false;
                    updateUI();
                }
            }, 120);

        } else {
            clearInterval(crashInterval);
            isPlayingCrash = false;
            if (fire) fire.classList.remove('fire-active');

            const winAmount = Math.floor(crashBetAmount * currentMultiplier);
            balance += winAmount;
            updateUI();

            if (status) status.innerText = `🎉 Вы забрали +${winAmount} ⭐`;
            btn.innerText = 'Запустить';
            btn.style.background = '';
            betInput.disabled = false;
        }
    };

    // === КОСТИ ИГРА (30% win) ===
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
        if (status) status.innerText = '🎲 Бросаем...';

        setTimeout(() => {
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
                if (status) status.innerText = `🎉 Сумма ${sum} (>7)! Выиграно +${win} ⭐`;
            } else {
                if (status) status.innerText = `❌ Сумма ${sum}. Проигрыш.`;
            }
            updateUI();
        }, 500);
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

    // Запуск загрузки баланса с сервера
    await loadServerBalance();
});
