/* ==========================================================================
   MEMORY POUR ENFANTS — MOTEUR RESPONSIVE SMARTPHONE, TABLETTE & ORDINATEUR
   ========================================================================== */

(() => {
  'use strict';

  const STORAGE_KEY = 'memory_enfants_bruno_v2';

  const THEMES = {
    ferme: {
      id: 'ferme',
      name: 'LA FERME',
      folder: 'assets/images/ferme/',
      back: 'assets/images/ferme/vert.webp',
      medal: 'assets/images/ferme/medaille_ferme.webp',
      victorySound: 'assets/audio/meuh.mp3',
      accent: '#38a84f'
    },
    savane: {
      id: 'savane',
      name: 'LA SAVANE',
      folder: 'assets/images/savane/',
      back: 'assets/images/savane/rouge.webp',
      medal: 'assets/images/savane/medaille_savane.webp',
      victorySound: 'assets/audio/lion.mp3',
      accent: '#f39521'
    },
    papillons: {
      id: 'papillons',
      name: 'LES PAPILLONS',
      folder: 'assets/images/papillons/',
      back: 'assets/images/papillons/bleu.webp',
      medal: 'assets/images/papillons/medaille_papillon.webp',
      victorySound: 'assets/audio/harpe.mp3',
      accent: '#e46ca2'
    }
  };

  // --- État global ---
  let selectedPairs = 12; // 6 (Facile), 8 (Moyen), 12 (Classique)
  let currentTheme = null;
  let moves = 0;
  let matchedPairs = 0;
  let flippedCards = [];
  let canFlip = true;
  let isMuted = false;
  let victoryAudio = null;
  let audioCtx = null;
  let confettiAnimId = null;

  const progress = loadProgress();

  // --- Références DOM ---
  const screens = {
    home: document.getElementById('home-screen'),
    choice: document.getElementById('choice-screen'),
    game: document.getElementById('game-screen')
  };

  const boardStage = document.getElementById('board-stage');
  const board = document.getElementById('game-board');
  const themeTitleEl = document.getElementById('current-theme-title');
  const pairsCounterEl = document.getElementById('pairs-counter');
  const movesCounterEl = document.getElementById('moves-counter');
  const progressFillEl = document.getElementById('progress-fill');

  const victoryPopup = document.getElementById('victory-popup');
  const medalImg = document.getElementById('medal-img');
  const finalMovesSpan = document.getElementById('final-moves');
  const victoryStarsEl = document.getElementById('victory-stars');
  const victoryRecordEl = document.getElementById('victory-record');
  const confettiCanvas = document.getElementById('confetti-canvas');

  const soundButtons = document.querySelectorAll('.sound-btn');
  const diffPills = document.querySelectorAll('.diff-pill');

  // --- Sauvegarde locale (records & médailles par univers et niveau) ---
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          best: parsed.best || {},
          medals: parsed.medals || {},
          muted: Boolean(parsed.muted),
          pairs: [6, 8, 12].includes(parsed.pairs) ? parsed.pairs : 12
        };
      }
    } catch { /* navigation privée */ }
    return { best: {}, medals: {}, muted: false, pairs: 12 };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        best: progress.best,
        medals: progress.medals,
        muted: isMuted,
        pairs: selectedPairs
      }));
    } catch { /* ignore */ }
  }

  function recordKey(themeId, pairs) {
    return `${themeId}_${pairs}`;
  }

  // --- Audio (MP3 d'origine + petit clic doux Web Audio au retournement) ---
  function unlockAudio() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function playFlipPop() {
    if (isMuted || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.065);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    } catch { /* ignore */ }
  }

  function playSfx(path, isVictory = false) {
    if (isMuted) return;
    if (isVictory) stopVictoryAudio();
    const audio = new Audio(path);
    audio.volume = isVictory ? 0.9 : 0.75;
    if (isVictory) victoryAudio = audio;
    audio.play().catch(() => {});
  }

  function stopVictoryAudio() {
    if (victoryAudio) {
      victoryAudio.pause();
      victoryAudio.currentTime = 0;
      victoryAudio = null;
    }
  }

  function syncSoundUI() {
    soundButtons.forEach((btn) => {
      btn.classList.toggle('is-muted', isMuted);
      btn.setAttribute('aria-pressed', String(isMuted));
    });
  }

  function toggleMute() {
    unlockAudio();
    isMuted = !isMuted;
    if (isMuted) stopVictoryAudio();
    syncSoundUI();
    saveProgress();
  }

  // --- Préchargement fluide des images & sons d'un univers ---
  const preloadedThemes = new Set();
  function preloadTheme(config) {
    if (preloadedThemes.has(config.id)) return;
    preloadedThemes.add(config.id);
    new Image().src = config.back;
    new Image().src = config.medal;
    for (let i = 1; i <= 12; i++) {
      new Image().src = `${config.folder}${String(i).padStart(2, '0')}.webp`;
    }
    new Audio(config.victorySound).load();
    new Audio('assets/audio/ding.mp3').load();
  }

  // --- Navigation entre écrans ---
  function showScreen(key) {
    Object.values(screens).forEach((s) => s.classList.remove('is-active'));
    screens[key].classList.add('is-active');
    victoryPopup.hidden = true;
    stopVictoryAudio();
    stopConfetti();

    if (key === 'choice') {
      updateChoiceCardsUI();
    } else if (key === 'game') {
      requestAnimationFrame(layoutBoard);
    }
  }

  // --- Mise à jour des cartes d'univers (records & médailles) ---
  function updateChoiceCardsUI() {
    Object.keys(THEMES).forEach((id) => {
      const bestEl = document.querySelector(`[data-best-for="${id}"]`);
      const medalEl = document.querySelector(`[data-medal-for="${id}"]`);
      const best = progress.best[recordKey(id, selectedPairs)];
      if (bestEl) {
        bestEl.textContent = best
          ? `Record (${selectedPairs * 2} cartes) : ${best} coups`
          : `${selectedPairs * 2} cartes · Prêt à jouer !`;
      }
      if (medalEl) {
        medalEl.hidden = !progress.medals[id];
      }
    });
  }

  // --- Mélange véritable Fisher-Yates ---
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // --- Calcul dynamique de la grille pour tenir à 100 % sur TOUT écran (smartphone → 4K) ---
  function pickGridDimensions(totalCards, availW, availH) {
    const isPortrait = availH >= availW;
    const wideRatio = availW / Math.max(1, availH);

    if (totalCards === 12) {
      return isPortrait ? { cols: 3, rows: 4 } : { cols: 4, rows: 3 };
    }
    if (totalCards === 16) {
      if (wideRatio > 2.2) return { cols: 8, rows: 2 };
      return { cols: 4, rows: 4 };
    }
    // 24 cartes (classique)
    if (isPortrait) return { cols: 4, rows: 6 };
    if (wideRatio > 2.15) return { cols: 8, rows: 3 };
    return { cols: 6, rows: 4 };
  }

  function layoutBoard() {
    if (!screens.game.classList.contains('is-active')) return;
    const totalCards = selectedPairs * 2;
    const rect = boardStage.getBoundingClientRect();
    const availW = Math.max(220, rect.width - 8);
    const availH = Math.max(220, rect.height - 8);

    const { cols, rows } = pickGridDimensions(totalCards, availW, availH);
    const gap = availW < 420 ? 7 : availW < 768 ? 10 : 12;

    const maxW = (availW - gap * (cols - 1)) / cols;
    const maxH = (availH - gap * (rows - 1)) / rows;
    const cardSize = Math.max(46, Math.min(156, Math.floor(Math.min(maxW, maxH))));

    board.style.setProperty('--cols', String(cols));
    board.style.setProperty('--card-size', `${cardSize}px`);
    board.style.setProperty('--card-gap', `${gap}px`);
  }

  // --- Initialisation d'une partie ---
  function initGame(config) {
    currentTheme = config;
    preloadTheme(config);

    themeTitleEl.textContent = config.name;
    medalImg.src = config.medal;
    moves = 0;
    matchedPairs = 0;
    flippedCards = [];
    canFlip = true;
    updateHUD();

    // Tire aléatoirement `selectedPairs` illustrations parmi les 12 disponibles de l'univers
    const allIds = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const chosenIds = shuffle(allIds).slice(0, selectedPairs);
    const deck = shuffle([...chosenIds, ...chosenIds]);

    board.innerHTML = '';
    const frag = document.createDocumentFragment();

    deck.forEach((id, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.dataset.id = id;
      card.setAttribute('aria-label', `Carte ${idx + 1}`);
      card.innerHTML = `
        <div class="card-inner">
          <div class="card-face card-back" style="background-image:url('${config.back}')"></div>
          <div class="card-face card-front" style="background-image:url('${config.folder}${id}.webp')"></div>
        </div>
      `;
      card.addEventListener('click', () => flipCard(card));
      frag.appendChild(card);
    });

    board.appendChild(frag);
    showScreen('game');
    requestAnimationFrame(layoutBoard);
  }

  function updateHUD() {
    pairsCounterEl.textContent = `${matchedPairs} / ${selectedPairs}`;
    movesCounterEl.textContent = String(moves);
    const pct = selectedPairs > 0 ? Math.round((matchedPairs / selectedPairs) * 100) : 0;
    progressFillEl.style.width = `${pct}%`;
  }

  // --- Logique de retournement & comparaison ---
  function flipCard(card) {
    if (!canFlip || card.classList.contains('is-flipped') || card.classList.contains('is-matched')) {
      return;
    }

    unlockAudio();
    playFlipPop();
    card.classList.add('is-flipped');
    flippedCards.push(card);

    if (flippedCards.length === 2) {
      moves += 1;
      updateHUD();
      checkMatch();
    }
  }

  function checkMatch() {
    canFlip = false;
    const [c1, c2] = flippedCards;

    if (c1.dataset.id === c2.dataset.id) {
      c1.classList.add('is-matched');
      c2.classList.add('is-matched');
      c1.setAttribute('aria-disabled', 'true');
      c2.setAttribute('aria-disabled', 'true');
      matchedPairs += 1;
      flippedCards = [];
      canFlip = true;
      updateHUD();
      playSfx('assets/audio/ding.mp3');

      if (matchedPairs === selectedPairs) {
        setTimeout(handleVictory, 520);
      }
    } else {
      setTimeout(() => {
        c1.classList.add('is-wrong');
        c2.classList.add('is-wrong');
      }, 360);

      setTimeout(() => {
        c1.classList.remove('is-flipped', 'is-wrong');
        c2.classList.remove('is-flipped', 'is-wrong');
        flippedCards = [];
        canFlip = true;
      }, 920);
    }
  }

  // --- Victoire, étoiles, record & confettis ---
  function computeStars(totalMoves, totalPairs) {
    if (totalMoves <= Math.round(totalPairs * 1.55)) return '⭐⭐⭐';
    if (totalMoves <= Math.round(totalPairs * 2.25)) return '⭐⭐';
    return '⭐';
  }

  function handleVictory() {
    finalMovesSpan.textContent = String(moves);
    victoryStarsEl.textContent = computeStars(moves, selectedPairs);

    const key = recordKey(currentTheme.id, selectedPairs);
    const prevBest = progress.best[key];
    const isNewRecord = !prevBest || moves < prevBest;
    if (isNewRecord) {
      progress.best[key] = moves;
    }
    progress.medals[currentTheme.id] = true;
    saveProgress();

    victoryRecordEl.hidden = !isNewRecord;
    victoryPopup.hidden = false;
    playSfx(currentTheme.victorySound, true);
    launchConfetti();
  }

  // --- Confettis légers sur Canvas ---
  function stopConfetti() {
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    const ctx = confettiCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }

  function launchConfetti() {
    stopConfetti();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    confettiCanvas.width = w * dpr;
    confettiCanvas.height = h * dpr;
    const ctx = confettiCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const colors = ['#ffd43b', '#ff5924', '#38a84f', '#2b9be8', '#e5498b', '#ffffff'];
    const pieces = Array.from({ length: 75 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.45,
      r: 5 + Math.random() * 6,
      vx: (Math.random() - 0.5) * 3.2,
      vy: 2.2 + Math.random() * 3.6,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.16,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    let frames = 0;
    function tick() {
      frames += 1;
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.vy += 0.03;
        if (p.y < h + 30) alive += 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r * 0.55, p.r * 2, p.r * 1.1);
        ctx.restore();
      }
      if (alive > 0 && frames < 260) {
        confettiAnimId = requestAnimationFrame(tick);
      } else {
        stopConfetti();
      }
    }
    confettiAnimId = requestAnimationFrame(tick);
  }

  // --- Initialisation des écouteurs ---
  function bindEvents() {
    isMuted = progress.muted;
    selectedPairs = progress.pairs;
    syncSoundUI();

    diffPills.forEach((pill) => {
      const pairs = Number(pill.dataset.pairs);
      const active = pairs === selectedPairs;
      pill.classList.toggle('is-selected', active);
      pill.setAttribute('aria-checked', String(active));

      pill.addEventListener('click', () => {
        unlockAudio();
        playFlipPop();
        selectedPairs = pairs;
        diffPills.forEach((p) => {
          const isSel = Number(p.dataset.pairs) === pairs;
          p.classList.toggle('is-selected', isSel);
          p.setAttribute('aria-checked', String(isSel));
        });
        saveProgress();
        updateChoiceCardsUI();
      });
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      unlockAudio();
      playFlipPop();
      showScreen('choice');
    });

    document.getElementById('btn-quit').addEventListener('click', () => showScreen('home'));
    document.getElementById('btn-back').addEventListener('click', () => showScreen('choice'));
    document.getElementById('btn-restart').addEventListener('click', () => {
      if (currentTheme) initGame(currentTheme);
    });
    document.getElementById('btn-replay-same').addEventListener('click', () => {
      if (currentTheme) initGame(currentTheme);
    });
    document.getElementById('btn-replay-choice').addEventListener('click', () => showScreen('choice'));

    soundButtons.forEach((btn) => btn.addEventListener('click', toggleMute));

    document.querySelectorAll('.univers-card').forEach((card) => {
      card.addEventListener('click', () => {
        unlockAudio();
        const theme = THEMES[card.dataset.theme];
        if (theme) initGame(theme);
      });
    });

    // Recalcul instantané sur rotation smartphone ou redimensionnement fenêtre
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => layoutBoard());
      ro.observe(boardStage);
    }
    window.addEventListener('resize', layoutBoard);
    window.addEventListener('orientationchange', () => setTimeout(layoutBoard, 120));

    // Échap pour fermer la modale de victoire
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !victoryPopup.hidden) {
        showScreen('choice');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bindEvents);
})();
