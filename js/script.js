document.addEventListener('DOMContentLoaded', () => {
    
    // 1. ÉLÉMENTS
    const screens = {
        home: document.getElementById('home-screen'),
        choice: document.getElementById('choice-screen'),
        game: document.getElementById('game-screen')
    };
    const board = document.getElementById('game-board');
    const counterBox = document.getElementById('counter-box');
    const titleDisplay = document.getElementById('current-theme-title');
    const victoryPopup = document.getElementById('victory-popup');
    const medalImg = document.getElementById('medal-img');
    const btnSound = document.getElementById('btn-sound');
    const finalMovesSpan = document.getElementById('final-moves');

    // 2. VARIABLES
    let moves = 0;
    let matchedCount = 0;
    let flippedCards = [];
    let canFlip = true;
    let isMuted = false;
    let currentTheme = null;
    let victoryAudio = null; // Pour stopper le son de victoire si on quitte

    const themes = {
        ferme: { name: "LA FERME", folder: "assets/images/ferme/", back: "assets/images/ferme/vert.webp", medal: "assets/images/ferme/medaille_ferme.webp", victorySound: "assets/audio/meuh.mp3" },
        savane: { name: "LA SAVANE", folder: "assets/images/savane/", back: "assets/images/savane/rouge.webp", medal: "assets/images/savane/medaille_savane.webp", victorySound: "assets/audio/lion.mp3" },
        papillons: { name: "LES PAPILLONS", folder: "assets/images/papillons/", back: "assets/images/papillons/bleu.webp", medal: "assets/images/papillons/medaille_papillon.webp", victorySound: "assets/audio/harpe.mp3" }
    };

    // 3. PRÉCHARGEMENT
    function preloadTheme(config) {
        new Image().src = config.back;
        new Image().src = config.medal;
        for (let i = 1; i <= 12; i++) {
            new Image().src = `${config.folder}${i.toString().padStart(2, '0')}.webp`;
        }
        new Audio(config.victorySound).load();
        new Audio('assets/audio/ding.mp3').load();
    }

    // 4. AUDIO
    function playSfx(path, isVictory = false) {
        if (isMuted) return;
        if (isVictory && victoryAudio) { victoryAudio.pause(); victoryAudio.currentTime = 0; }
        const audio = new Audio(path);
        if (isVictory) victoryAudio = audio;
        audio.play().catch(() => {});
    }

    btnSound.onclick = () => {
        isMuted = !isMuted;
        btnSound.src = isMuted ? "assets/ui/off.webp" : "assets/ui/on.webp";
        if (isMuted && victoryAudio) victoryAudio.pause();
    };

    // 5. NAVIGATION
    function showScreen(key) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[key].classList.add('active');
        victoryPopup.style.display = "none";
        if (victoryAudio) { victoryAudio.pause(); victoryAudio.currentTime = 0; }
    }

    document.getElementById('btn-play').onclick = () => showScreen('choice');
    document.getElementById('btn-quit').onclick = () => showScreen('home');
    document.getElementById('btn-back').onclick = () => showScreen('choice');
    document.getElementById('btn-replay').onclick = () => showScreen('choice');

    // 6. INITIALISATION JEU
    document.querySelectorAll('.univers-card').forEach(card => {
        const handleChoice = () => {
            const key = card.dataset.theme;
            currentTheme = themes[key];
            preloadTheme(currentTheme);
            initGame(currentTheme);
        };
        card.onclick = handleChoice;
        card.onkeydown = (e) => { if(e.key === "Enter" || e.key === " ") handleChoice(); };
    });

    function initGame(config) {
        titleDisplay.textContent = config.name;
        medalImg.src = config.medal;
        board.innerHTML = "";
        moves = 0; matchedCount = 0; flippedCards = []; canFlip = true;
        counterBox.textContent = `COUPS : ${moves}`;
        
        let cardValues = [];
        for (let i = 1; i <= 12; i++) {
            let id = i.toString().padStart(2, '0');
            cardValues.push(id, id);
        }
        cardValues.sort(() => Math.random() - 0.5);

        cardValues.forEach(id => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = id;
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.innerHTML = `<div class="card-inner">
                <div class="card-back" style="background-image: url('${config.back}')"></div>
                <div class="card-front" style="background-image: url('${config.folder}${id}.webp')"></div>
            </div>`;
            
            const handleFlip = () => flip(card);
            card.onclick = handleFlip;
            card.onkeydown = (e) => { if(e.key === "Enter" || e.key === " ") { e.preventDefault(); handleFlip(); }};
            board.appendChild(card);
        });
        showScreen('game');
    }

    function flip(card) {
        if (!canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) return;
        card.classList.add('flipped');
        flippedCards.push(card);
        if (flippedCards.length === 2) {
            moves++;
            counterBox.textContent = `COUPS : ${moves}`;
            checkMatch();
        }
    }

    function checkMatch() {
        canFlip = false;
        const [c1, c2] = flippedCards;
        if (c1.dataset.id === c2.dataset.id) {
            c1.classList.add('matched'); c2.classList.add('matched');
            matchedCount += 2; flippedCards = []; canFlip = true;
            playSfx('assets/audio/ding.mp3');
            if (matchedCount === 24) {
                setTimeout(() => {
                    finalMovesSpan.textContent = moves;
                    victoryPopup.style.display = "flex";
                    playSfx(currentTheme.victorySound, true);
                }, 600);
            }
        } else {
            setTimeout(() => {
                c1.classList.remove('flipped'); c2.classList.remove('flipped');
                flippedCards = []; canFlip = true;
            }, 1000);
        }
    }
});