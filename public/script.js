const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user;
const username = user ? user.username : 'Гость';
const firstName = user ? user.first_name : 'Пользователь';
const userId = user ? user.id : null;

document.getElementById('userName').innerText = firstName;
document.getElementById('userAvatar').innerText = firstName.charAt(0).toUpperCase();

const userStars = document.getElementById('userStars');
const dailyBtn = document.getElementById('dailyBtn');
const dailyStatus = document.getElementById('dailyStatus');
const subActionBtn = document.getElementById('subActionBtn');
const checkSubBtn = document.getElementById('checkSubBtn');
const statusText = document.getElementById('statusText');
const shareBtn = document.getElementById('shareBtn');
const shareStatus = document.getElementById('shareStatus');
const refBtn = document.getElementById('refBtn');
const refStatus = document.getElementById('refStatus');
const withdrawBtn = document.getElementById('withdrawBtn');
const withdrawStatus = document.getElementById('withdrawStatus');
const adminPanel = document.getElementById('adminPanel');

let currentStars = 0;

function updateBalance(newStars) {
    currentStars = newStars;
    userStars.innerText = currentStars;

    if (userId) {
        fetch('/api/update-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, balance: currentStars })
        }).catch(err => console.error('Ошибка сохранения баланса:', err));
    }
}

if (userId) {
    fetch(`/api/user?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                currentStars = data.stars || 0;
                userStars.innerText = currentStars;
                if (data.subscribed) {
                    subActionBtn.style.display = 'none';
                    checkSubBtn.style.display = 'none';
                    statusText.style.color = 'var(--success)';
                    statusText.innerText = '✅ Подписка подтверждена (+15 ⭐)';
                }
            }
        })
        .catch(err => console.error('Ошибка профиля:', err));
}

dailyBtn.addEventListener('click', async () => {
    if (!userId) return;
    dailyStatus.style.color = 'var(--hint-color)';
    dailyStatus.innerText = 'Получаем бонус...';

    try {
        const res = await fetch('/api/reward-daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId })
        });
        const data = await res.json();
        if (data.success) {
            updateBalance(data.stars);
            dailyStatus.style.color = 'var(--success)';
            dailyStatus.innerText = '🎉 Успешно! Получено +3 звезды!';
        } else {
            dailyStatus.style.color = 'var(--danger)';
            dailyStatus.innerText = data.message || 'Бонус уже был получен сегодня.';
        }
    } catch (e) {
        dailyStatus.style.color = 'var(--danger)';
        dailyStatus.innerText = 'Ошибка соединения';
    }
});

subActionBtn.addEventListener('click', () => {
    window.open('https://t.me/belcryptoo', '_blank'); 
    subActionBtn.style.display = 'none';
    checkSubBtn.style.display = 'flex';
    statusText.style.color = 'var(--hint-color)';
    statusText.innerText = 'После подписки нажмите кнопку проверки 👇';
});

checkSubBtn.addEventListener('click', async () => {
    if (!userId) return;
    statusText.style.color = 'var(--hint-color)';
    statusText.innerText = 'Проверяем подписку на @belcryptoo...';

    try {
        const response = await fetch('/api/check-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId })
        });
        const data = await response.json();

        if (data.subscribed) {
            updateBalance(data.stars);
            statusText.style.color = 'var(--success)';
            statusText.innerText = '🎉 Успешно! Начислено +15 звезд!';
            checkSubBtn.style.display = 'none';
        } else {
            statusText.style.color = 'var(--danger)';
            statusText.innerText = '❌ Вы не подписаны на канал @belcryptoo!';
        }
    } catch (error) {
        statusText.style.color = 'var(--danger)';
        statusText.innerText = 'Ошибка связи с сервером';
    }
});

shareBtn.addEventListener('click', () => {
    window.open(`https://t.me/share/url?url=https://t.me/belcryptoo&text=Зарабатывай%20звезды%20и%20играй%20вместе%20с%20BelCrypto!`, '_blank');
    shareStatus.style.color = 'var(--hint-color)';
    shareStatus.innerText = 'Подтверждаем отправку поста...';

    setTimeout(async () => {
        try {
            const res = await fetch('/api/reward-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId })
            });
            const data = await res.json();
            if (data.success) {
                updateBalance(data.stars);
                shareStatus.style.color = 'var(--success)';
                shareStatus.innerText = '✅ +2 ⭐ за публикацию!';
                setTimeout(() => shareStatus.innerText = '', 3000);
            } else {
                shareStatus.style.color = 'var(--danger)';
                shareStatus.innerText = data.message || 'Слишком часто!';
            }
        } catch (e) {
            shareStatus.innerText = '';
        }
    }, 2000);
});

refBtn.addEventListener('click', () => {
    const refLink = `https://t.me/belcryptoo?start=ref_${userId}`;
    navigator.clipboard.writeText(refLink).then(() => {
        refStatus.style.color = 'var(--success)';
        refStatus.innerText = 'Реферальная ссылка скопирована!';
        setTimeout(() => refStatus.innerText = '', 3000);
    });
});

withdrawBtn.addEventListener('click', () => {
    if (currentStars < 50) {
        withdrawStatus.style.color = 'var(--danger)';
        withdrawStatus.innerText = `❌ Недостаточно звезд. Нужно минимум 50 ⭐ (у вас ${currentStars})`;
    } else {
        withdrawStatus.style.color = 'var(--success)';
        withdrawStatus.innerText = '✅ Заявка создана! Напишите администратору @belcryptoo для вывода.';
        setTimeout(() => {
            window.open('https://t.me/belcryptoo', '_blank');
        }, 1500);
    }
});

// --- КРАШ РАКЕТА ---
const crashPlayBtn = document.getElementById('crashPlayBtn');
const crashBetInput = document.getElementById('crashBetInput');
const crashMultiplier = document.getElementById('crashMultiplier');
const rocketContainer = document.getElementById('rocketContainer');
const rocketFire = document.getElementById('rocketFire');
const spaceStars = document.getElementById('spaceStars');
const crashStatus = document.getElementById('crashStatus');

let crashInterval = null;
let currentMultiplier = 1.00;
let targetCrashAt = 1.00;
let activeBet = 0;
let gamePhase = 'IDLE';

crashPlayBtn.addEventListener('click', () => {
    if (gamePhase === 'IDLE') {
        const bet = parseInt(crashBetInput.value);
        if (isNaN(bet) || bet <= 0) {
            crashStatus.style.color = 'var(--danger)';
            crashStatus.innerText = 'Введите корректную ставку!';
            return;
        }
        if (currentStars < bet) {
            crashStatus.style.color = 'var(--danger)';
            crashStatus.innerText = 'Недостаточно звезд!';
            return;
        }

        activeBet = bet;
        updateBalance(currentStars - activeBet);
        
        gamePhase = 'FLYING';
        crashBetInput.disabled = true;
        crashPlayBtn.innerText = 'ЗАБРАТЬ';
        crashPlayBtn.style.background = 'var(--success)';
        
        rocketContainer.classList.add('rocket-flying');
        rocketFire.classList.add('fire-active');
        spaceStars.classList.add('stars-moving');
        rocketContainer.classList.remove('rocket-crash');

        crashStatus.style.color = 'var(--hint-color)';
        crashStatus.innerText = 'Ракета набирает высоту...';

        currentMultiplier = 1.00;
        crashMultiplier.innerText = '1.00x';

        const roll = Math.random();
        if (roll < 0.70) {
            targetCrashAt = parseFloat((1.00 + Math.random() * 0.35).toFixed(2));
        } else {
            targetCrashAt = parseFloat((1.40 + Math.random() * 3.10).toFixed(2));
        }

        crashInterval = setInterval(() => {
            currentMultiplier += 0.03;
            crashMultiplier.innerText = currentMultiplier.toFixed(2) + 'x';

            if (currentMultiplier >= targetCrashAt) {
                endCrashGame(false);
            }
        }, 90);

    } else if (gamePhase === 'FLYING') {
        clearInterval(crashInterval);
        const winAmount = Math.floor(activeBet * currentMultiplier);
        updateBalance(currentStars + winAmount);
        
        stopRocketAnimation();
        crashStatus.style.color = 'var(--success)';
        crashStatus.innerText = `🎯 Успешно! Вы забрали на ${currentMultiplier.toFixed(2) + 'x'} (+${winAmount} ⭐)`;
        
        resetCrashButton();
    }
});

function endCrashGame(isWin) {
    clearInterval(crashInterval);
    rocketContainer.classList.remove('rocket-flying');
    rocketFire.classList.remove('fire-active');
    spaceStars.classList.remove('stars-moving');
    rocketContainer.classList.add('rocket-crash');

    crashStatus.style.color = 'var(--danger)';
    crashStatus.innerText = `💥 КРАШ на ${targetCrashAt}x! Ракета взорвалась.`;
    
    resetCrashButton();
}

function stopRocketAnimation() {
    rocketContainer.classList.remove('rocket-flying');
    rocketFire.classList.remove('fire-active');
    spaceStars.classList.remove('stars-moving');
}

function resetCrashButton() {
    gamePhase = 'IDLE';
    crashPlayBtn.innerText = 'Запустить';
    crashPlayBtn.style.background = '';
    crashBetInput.disabled = false;
}

// --- СЧАСТЛИВЫЕ КОСТИ ---
const dicePlayBtn = document.getElementById('dicePlayBtn');
const diceBetInput = document.getElementById('diceBetInput');
const dice1 = document.getElementById('dice1');
const dice2 = document.getElementById('dice2');
const diceStatus = document.getElementById('diceStatus');
const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

dicePlayBtn.addEventListener('click', () => {
    const bet = parseInt(diceBetInput.value);
    if (isNaN(bet) || bet <= 0) {
        diceStatus.style.color = 'var(--danger)';
        diceStatus.innerText = 'Введите ставку!';
        return;
    }
    if (currentStars < bet) {
        diceStatus.style.color = 'var(--danger)';
        diceStatus.innerText = 'Недостаточно звезд!';
        return;
    }

    updateBalance(currentStars - bet);
    dice1.classList.add('dice-rolling');
    dice2.classList.add('dice-rolling');
    diceStatus.style.color = 'var(--hint-color)';
    diceStatus.innerText = 'Бросаем кости на удачу...';

    let rollTimer = setInterval(() => {
        dice1.innerText = diceFaces[Math.floor(Math.random() * 6)];
        dice2.innerText = diceFaces[Math.floor(Math.random() * 6)];
    }, 80);

    setTimeout(() => {
        clearInterval(rollTimer);
        dice1.classList.remove('dice-rolling');
        dice2.classList.remove('dice-rolling');

        const r1 = Math.floor(Math.random() * 6) + 1;
        const r2 = Math.floor(Math.random() * 6) + 1;

        dice1.innerText = diceFaces[r1 - 1];
        dice2.innerText = diceFaces[r2 - 1];

        const sum = r1 + r2;
        if (sum > 7) {
            const winAmount = bet * 2;
            updateBalance(currentStars + winAmount);
            diceStatus.style.color = 'var(--success)';
            diceStatus.innerText = `🎲 Сумма ${sum} (> 7)! Победа: +${winAmount} ⭐`;
        } else {
            diceStatus.style.color = 'var(--danger)';
            diceStatus.innerText = `🎲 Сумма ${sum}. Проигрыш, попробуйте еще!`;
        }
    }, 700);
});

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
    .catch(err => console.error(err));
}
