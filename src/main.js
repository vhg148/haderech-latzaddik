import * as THREE from 'three';
import {
  LANES,
  CHARACTERS,
  PLAYER_CONFIG,
  FLIGHT_CONFIG,
  ZONES,
  BRESLOV_QUOTES,
  SHOP_UPGRADES,
} from './config.js';
import { loadSave, writeSave, getUpgradeValue, getUpgradeCost } from './storage.js';
import { sound } from './audio.js';
import { WorldManager } from './world.js';
import {
  PlayerController,
  MeniotPursuer,
  createObstacleMesh,
  createGoodPointMesh,
  createPowerupMesh,
  ParticleSystem,
} from './entities.js';

// ================= DOM REFERENCES =================
const el = {
  container: document.getElementById('canvas-container'),
  hud: document.getElementById('hud'),
  startScreen: document.getElementById('start-screen'),
  charScreen: document.getElementById('character-screen'),
  shopScreen: document.getElementById('shop-screen'),
  pauseScreen: document.getElementById('pause-screen'),
  gameoverScreen: document.getElementById('gameover-screen'),
  victoryScreen: document.getElementById('victory-screen'),

  strike1Vignette: document.getElementById('strike1-vignette'),
  dangerVignette: document.getElementById('danger-vignette'),
  joyVignette: document.getElementById('joy-vignette'),
  quoteBanner: document.getElementById('quote-banner'),
  quoteText: document.getElementById('quote-text'),
  sprintBanner: document.getElementById('sprint-banner'),
  sprintMeters: document.getElementById('sprint-meters'),
  floatingPopups: document.getElementById('floating-popups'),

  hudCharAvatar: document.getElementById('hud-char-avatar'),
  hudCharName: document.getElementById('hud-char-name'),
  hudGoodPoints: document.getElementById('hud-good-points'),
  hudStrikesLabel: document.getElementById('hud-strikes-label'),
  hudStrikeDots: document.getElementById('hud-strike-dots'),
  hudScore: document.getElementById('hud-score'),
  hudMultiplier: document.getElementById('hud-multiplier'),
  hudZoneName: document.getElementById('hud-zone-name'),
  hudTimer: document.getElementById('hud-timer'),
  hudFlightFill: document.getElementById('hud-flight-fill'),
  hudPlaneMarker: document.getElementById('hud-plane-marker'),
  hudDistanceLeft: document.getElementById('hud-distance-left'),
  hudFlightStage: document.getElementById('hud-flight-stage'),
  ms1: document.getElementById('ms-1'),
  ms2: document.getElementById('ms-2'),
  ms3: document.getElementById('ms-3'),
  msGoal: document.getElementById('ms-goal'),
  hudJoyPct: document.getElementById('hud-joy-pct'),
  hudJoyFill: document.getElementById('hud-joy-fill'),
  joyReadyHint: document.getElementById('joy-ready-hint'),
  activePowerups: document.getElementById('active-powerups'),
  comboBadge: document.getElementById('combo-badge'),
  comboCount: document.getElementById('combo-count'),
  controlsHint: document.getElementById('controls-hint'),

  menuHeroImg: document.getElementById('menu-hero-img'),
  menuHeroNameBadge: document.getElementById('menu-hero-name-badge'),
  menuBankPoints: document.getElementById('menu-bank-points'),
  menuBestScore: document.getElementById('menu-best-score'),
  menuFlightsWon: document.getElementById('menu-flights-won'),
  quickCharStrip: document.getElementById('quick-char-strip'),
  btnPlayLabel: document.getElementById('btn-play-label'),

  charCardsGrid: document.getElementById('char-cards-grid'),
  btnCharPlayLabel: document.getElementById('btn-char-play-label'),

  shopBankVal: document.getElementById('shop-bank-val'),
  shopItems: document.getElementById('shop-items'),

  goReasonBadge: document.getElementById('gameover-reason-badge'),
  goQuote: document.getElementById('gameover-quote'),
  goScore: document.getElementById('go-score'),
  goGoodPoints: document.getElementById('go-good-points'),
  goStrikes: document.getElementById('go-strikes'),
  goDistance: document.getElementById('go-distance'),

  vicHeroImg: document.getElementById('vic-hero-img'),
  vicTitle: document.getElementById('vic-title'),
  vicQuote: document.getElementById('vic-quote'),
  vicBonus: document.getElementById('vic-bonus'),
  vicGoodPoints: document.getElementById('vic-good-points'),
  vicScore: document.getElementById('vic-score'),
  vicStrikes: document.getElementById('vic-strikes'),

  btnPlay: document.getElementById('btn-play'),
  btnOpenChars: document.getElementById('btn-open-chars'),
  btnCharsCloseX: document.getElementById('btn-chars-close-x'),
  btnCharsBack: document.getElementById('btn-chars-back'),
  btnCharPlayNow: document.getElementById('btn-char-play-now'),
  btnShop: document.getElementById('btn-shop'),
  btnShopClose: document.getElementById('btn-shop-close'),
  btnSound: document.getElementById('btn-sound'),
  btnPause: document.getElementById('btn-pause'),
  btnResume: document.getElementById('btn-resume'),
  btnRestartPause: document.getElementById('btn-restart-pause'),
  btnHomePause: document.getElementById('btn-home-pause'),
  btnRetry: document.getElementById('btn-retry'),
  btnGoChars: document.getElementById('btn-go-chars'),
  btnGoHome: document.getElementById('btn-go-home'),
  btnNextFlight: document.getElementById('btn-next-flight'),
  btnVicChars: document.getElementById('btn-vic-chars'),
  btnVicHome: document.getElementById('btn-vic-home'),
};

// ================= THREE.JS SCENE SETUP =================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.2, 320);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
el.container.appendChild(renderer.domElement);

let save = loadSave();

const world = new WorldManager(scene);
const player = new PlayerController(scene, save.selectedCharacter);
const meniot = new MeniotPursuer(scene);
const particles = new ParticleSystem(scene);

// ================= GAME STATE =================
let state = 'menu'; // 'menu' | 'playing' | 'paused' | 'gameover' | 'victory'
let timeNow = 0;

let run = createEmptyRun(1);
let obstacles = [];
let collectibles = [];
let powerupPickups = [];

let spawnCursor = 0;
let quoteTimeout = null;
let cameraShake = 0;
let victoryFireworkTimer = 0;
let footstepDustTimer = 0;

function getSelectedChar() {
  return CHARACTERS.find((c) => c.id === save.selectedCharacter) || CHARACTERS[0];
}

function createEmptyRun(stage = 1, carryScore = 0) {
  const targetDistance = FLIGHT_CONFIG.baseDistance + (stage - 1) * FLIGHT_CONFIG.distancePerStage;
  const timeLeft = Math.max(72, FLIGHT_CONFIG.baseTimeSeconds + (stage - 1) * 10);
  return {
    stage,
    distance: 0,
    targetDistance,
    timeLeft,
    speed: PLAYER_CONFIG.baseSpeed + (stage - 1) * 2.0,
    strikes: 0, // 0 -> 1 (Meni'ot closer) -> 2 (Meni'ot right on you!) -> 3 (Game Over!)
    score: carryScore,
    goodPoints: 0,
    brokenMeniot: 0,
    cleanDodges: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    joyCharge: 0,
    powerups: {
      fire: 0,
      magnet: 0,
      wings: 0,
      double: 0,
      joy: 0,
    },
    hintHidden: false,
    runwayCleared: false,
  };
}

// ================= CHARACTER SELECTION UI =================
function selectCharacter(charId, playSound = true) {
  const ch = CHARACTERS.find((c) => c.id === charId);
  if (!ch) return;
  save.selectedCharacter = ch.id;
  writeSave(save);
  player.setCharacter(ch.id);

  if (playSound) {
    sound.ensureContext();
    sound.playGoodPoint(6, false);
  }

  // Update menu hero display
  el.menuHeroImg.src = ch.portrait;
  el.menuHeroImg.classList.toggle('photo-frame', !ch.isFullSpritePortrait);
  el.menuHeroNameBadge.textContent = `${ch.name} • ${ch.role}`;
  el.btnPlayLabel.textContent = `צא לדרך עם ${ch.name}!`;
  el.btnCharPlayLabel.textContent = `צא לדרך עם ${ch.name}! ✈️`;

  // Update HUD mini-avatar
  el.hudCharAvatar.src = ch.portrait;
  el.hudCharAvatar.classList.toggle('sprite-fit', ch.isFullSpritePortrait);
  el.hudCharName.textContent = `${ch.name} • נקודות טובות`;

  renderCharacterSelectors();
}

function renderCharacterSelectors() {
  // 1. Quick switcher strip on Start Screen
  el.quickCharStrip.innerHTML = '';
  for (const ch of CHARACTERS) {
    const selected = ch.id === save.selectedCharacter;
    const btn = document.createElement('button');
    btn.className = `quick-char-btn ${selected ? 'selected' : ''}`;
    btn.type = 'button';
    btn.innerHTML = `
      <img src="${ch.portrait}" alt="${ch.name}" class="quick-char-thumb ${ch.isFullSpritePortrait ? 'sprite-fit' : ''}" />
      <div class="quick-char-meta">
        <strong>${ch.name}</strong>
        <small>${selected ? '✓ נבחר' : ch.role}</small>
      </div>
    `;
    btn.addEventListener('click', () => selectCharacter(ch.id, true));
    el.quickCharStrip.appendChild(btn);
  }

  // 2. Full Character Selection Modal Cards
  el.charCardsGrid.innerHTML = '';
  for (const ch of CHARACTERS) {
    const selected = ch.id === save.selectedCharacter;
    const card = document.createElement('div');
    card.className = `char-card ${selected ? 'selected' : ''}`;
    card.innerHTML = `
      ${selected ? '<span class="char-selected-badge">✓ נבחר</span>' : ''}
      <div class="char-card-portrait-wrap" style="border-color: ${selected ? '#ffd24c' : ch.accent}">
        <img src="${ch.portrait}" alt="${ch.name}" class="char-card-portrait ${ch.isFullSpritePortrait ? 'sprite-fit' : ''}" />
      </div>
      <div class="char-card-name">${ch.name}</div>
      <div class="char-card-role">${ch.role}</div>
      <div class="char-card-tagline">${ch.tagline}</div>
    `;
    card.addEventListener('click', () => selectCharacter(ch.id, true));
    el.charCardsGrid.appendChild(card);
  }
}

function openCharacterScreen() {
  state = 'menu';
  sound.pauseMusic();
  renderCharacterSelectors();
  el.hud.classList.add('hidden');
  el.startScreen.classList.add('hidden');
  el.gameoverScreen.classList.add('hidden');
  el.victoryScreen.classList.add('hidden');
  el.shopScreen.classList.add('hidden');
  el.pauseScreen.classList.add('hidden');
  el.strike1Vignette.classList.add('hidden');
  el.dangerVignette.classList.add('hidden');
  el.joyVignette.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.charScreen.classList.remove('hidden');
}

// ================= UI & SCORING HELPERS =================
function showQuote(text, durationMs = 3200) {
  el.quoteText.textContent = text;
  el.quoteBanner.classList.remove('hidden');
  if (quoteTimeout) clearTimeout(quoteTimeout);
  quoteTimeout = setTimeout(() => {
    el.quoteBanner.classList.add('hidden');
  }, durationMs);
}

function spawnFloatingPopup(text, colorClass = 'gold', offsetX = 0) {
  const node = document.createElement('div');
  node.className = `float-popup ${colorClass}`;
  node.textContent = text;
  node.style.left = `calc(50% + ${offsetX}px)`;
  el.floatingPopups.appendChild(node);
  setTimeout(() => node.remove(), 1100);
}

function updateMenuStats() {
  el.menuBankPoints.textContent = save.bankPoints.toLocaleString('he-IL');
  el.menuBestScore.textContent = Math.floor(save.bestScore).toLocaleString('he-IL');
  el.menuFlightsWon.textContent = `${save.flightsCompleted} ✈️`;
}

function renderShop() {
  el.shopBankVal.textContent = save.bankPoints.toLocaleString('he-IL');
  el.shopItems.innerHTML = '';

  for (const item of SHOP_UPGRADES) {
    const lvl = save.upgrades[item.id] || 0;
    const cost = getUpgradeCost(save, item.id);
    const val = getUpgradeValue(save, item.id);

    const row = document.createElement('div');
    row.className = 'shop-item';

    const dotsHtml = Array.from({ length: item.maxLevel }, (_, i) =>
      `<span class="level-dot ${i < lvl ? 'filled' : ''}"></span>`
    ).join('');

    row.innerHTML = `
      <div class="shop-item-info">
        <div class="shop-item-icon">${item.icon}</div>
        <div>
          <div class="shop-item-title">${item.title} (${val} ${item.unit})</div>
          <div class="shop-item-desc">${item.desc}</div>
          <div class="shop-level-dots">${dotsHtml}</div>
        </div>
      </div>
      <button class="btn-buy" ${cost === null || save.bankPoints < cost ? 'disabled' : ''}>
        ${cost === null ? 'מקסימום ✓' : `שדרג • ${cost} ✦`}
      </button>
    `;

    const btn = row.querySelector('.btn-buy');
    if (cost !== null) {
      btn.addEventListener('click', () => {
        if (save.bankPoints >= cost) {
          save.bankPoints -= cost;
          save.upgrades[item.id] = lvl + 1;
          writeSave(save);
          sound.playPowerup();
          renderShop();
          updateMenuStats();
        }
      });
    }

    el.shopItems.appendChild(row);
  }
}

function formatTimer(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

// Rebuilt Skill-Based Streak Multiplier: rises as you chain Good Points cleanly, resets to ×1 on a strike!
function getStreakMultiplier() {
  if (run.combo >= 45) return 4;
  if (run.combo >= 22) return 3;
  if (run.combo >= 10) return 2;
  return 1;
}

function getTotalMultiplier() {
  let m = getStreakMultiplier();
  if (world.currentZoneIdx === 1) m *= 2; // Narrow Bridge ×2
  if (run.powerups.double > 0) m *= 2;
  return m;
}

function updateHUD() {
  const progress = Math.min(1, run.distance / run.targetDistance);
  const remaining = Math.max(0, Math.ceil(run.targetDistance - run.distance));

  el.hudGoodPoints.textContent = run.goodPoints.toLocaleString('he-IL');
  el.hudScore.textContent = `ניקוד: ${Math.floor(run.score).toLocaleString('he-IL')}`;
  el.hudMultiplier.textContent = `×${getTotalMultiplier()}`;

  // Clear 3-Strike Escalation Indicator (0/3 -> 1/3 -> 2/3 -> 3/3 Stopped!)
  const dots = el.hudStrikeDots.children;
  for (let i = 0; i < 3; i++) {
    dots[i].className = 'strike-dot';
    if (i < run.strikes) {
      dots[i].classList.add(run.strikes >= 2 ? 'hit2' : 'hit1');
    }
  }
  if (run.strikes === 0) {
    el.hudStrikesLabel.textContent = 'מניעות: 0/3 (נקי ✨)';
    el.hudStrikesLabel.className = 'strikes-label';
  } else if (run.strikes === 1) {
    el.hudStrikesLabel.textContent = 'פגיעה 1/3 — מתקרבות!';
    el.hudStrikesLabel.className = 'strikes-label warn';
  } else {
    el.hudStrikesLabel.textContent = 'פסילה 2/3 — אחרונה!';
    el.hudStrikesLabel.className = 'strikes-label crit';
  }

  const zoneIdx = world.currentZoneIdx;
  const zone = ZONES[zoneIdx] || ZONES[0];
  el.hudZoneName.textContent = zone.name;
  el.hudFlightStage.textContent = `טיסה #${run.stage}`;
  el.hudDistanceLeft.textContent = `נותרו ${remaining.toLocaleString('he-IL')} מ׳ עד המטוס`;
  el.hudFlightFill.style.width = `${(progress * 100).toFixed(1)}%`;
  el.hudPlaneMarker.style.right = `${(progress * 100).toFixed(1)}%`;

  el.ms1.className = `ms-item ${zoneIdx === 0 ? 'active' : 'done'}`;
  el.ms2.className = `ms-item ${zoneIdx === 1 ? 'active' : zoneIdx > 1 ? 'done' : ''}`;
  el.ms3.className = `ms-item ${zoneIdx === 2 ? 'active' : ''}`;

  el.hudTimer.textContent = `⏱️ ${formatTimer(run.timeLeft)}`;
  el.hudTimer.classList.toggle('urgent', run.timeLeft <= 15);

  if (remaining <= 140 && remaining > 0) {
    el.sprintMeters.textContent = remaining.toString();
    el.sprintBanner.classList.remove('hidden');
    el.quoteBanner.classList.add('hidden');
  } else {
    el.sprintBanner.classList.add('hidden');
  }

  // Joy meter
  const joyPct = run.powerups.joy > 0 ? Math.round((run.powerups.joy / 5.0) * 100) : Math.round(run.joyCharge);
  el.hudJoyPct.textContent = run.powerups.joy > 0 ? 'פעיל! ✨' : `${joyPct}%`;
  el.hudJoyFill.style.width = `${Math.min(100, joyPct)}%`;
  el.joyReadyHint.classList.toggle('hidden', !(run.joyCharge >= 80 && run.powerups.joy <= 0));

  // Progressive visual escalation vignettes!
  el.strike1Vignette.classList.toggle('hidden', !(run.strikes === 1 && run.powerups.joy <= 0));
  el.dangerVignette.classList.toggle('hidden', !(run.strikes >= 2 && run.powerups.joy <= 0));
  el.joyVignette.classList.toggle('hidden', run.powerups.joy <= 0);

  // Combo badge
  if (run.combo >= 3) {
    el.comboBadge.classList.remove('hidden');
    el.comboCount.textContent = `×${run.combo}`;
  } else {
    el.comboBadge.classList.add('hidden');
  }

  // Active power-ups
  const pills = [];
  if (run.powerups.joy > 0) pills.push(`<div class="powerup-pill joy">🌟 שמחה תמיד ${run.powerups.joy.toFixed(1)}ש׳</div>`);
  if (run.powerups.fire > 0) pills.push(`<div class="powerup-pill fire">🔥 כובע האש ${run.powerups.fire.toFixed(1)}ש׳</div>`);
  if (run.powerups.magnet > 0) pills.push(`<div class="powerup-pill magnet">🧲 מגנט אזמרה ${run.powerups.magnet.toFixed(1)}ש׳</div>`);
  if (run.powerups.wings > 0) pills.push(`<div class="powerup-pill wings">✨ כנפי שמחה ${run.powerups.wings.toFixed(1)}ש׳</div>`);
  if (run.powerups.double > 0) pills.push(`<div class="powerup-pill double">⚡ אור הצדיק ×2 (${run.powerups.double.toFixed(1)}ש׳)</div>`);
  el.activePowerups.innerHTML = pills.join('');
}

// ================= ENTITY CLEANUP & SPAWNING =================
function clearTrackEntities() {
  for (const o of obstacles) scene.remove(o.group);
  for (const c of collectibles) scene.remove(c.group);
  for (const p of powerupPickups) scene.remove(p.group);
  obstacles = [];
  collectibles = [];
  powerupPickups = [];
}

function spawnGoodPointLine(laneIdx, startZ, count, spacing = 2.6, baseY = 1.05, arcHeight = 0, superLast = false) {
  const x = LANES[laneIdx];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const y = baseY + Math.sin(t * Math.PI) * arcHeight;
    const isSuper = superLast && i === count - 1;
    const gp = createGoodPointMesh(isSuper);
    const z = startZ - i * spacing;
    gp.group.position.set(x, y, z);
    scene.add(gp.group);
    collectibles.push({
      ...gp,
      x,
      y,
      z,
      baseY: y,
      lane: laneIdx,
      collected: false,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function spawnObstacle(type, laneIdx, z) {
  const obs = createObstacleMesh(type);
  const x = LANES[laneIdx];
  obs.group.position.set(x, 0, z);
  scene.add(obs.group);
  obstacles.push({
    ...obs,
    x,
    z,
    lane: laneIdx,
    smashed: false,
    passed: false,
  });
  return obs;
}

function spawnPowerup(laneIdx, z, y = 1.35) {
  const kinds = ['fire', 'magnet', 'wings', 'double'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const p = createPowerupMesh(kind);
  const x = LANES[laneIdx];
  p.group.position.set(x, y, z);
  scene.add(p.group);
  powerupPickups.push({
    ...p,
    x,
    y,
    baseY: y,
    z,
    lane: laneIdx,
    collected: false,
    phase: Math.random() * Math.PI * 2,
  });
}

// Guaranteed-solvable wave spawner that genuinely escalates as Strikes increase (0 -> 1 -> 2)!
function spawnWave() {
  const z0 = -118;
  const progressDiff = (run.distance / run.targetDistance) * 0.6 + (run.stage - 1) * 0.2;
  // Strikes visibly intensify the Meni'ot obstacles!
  const strikeBoost = run.strikes * 0.16;
  const difficulty = Math.min(1, progressDiff + strikeBoost);
  const roll = Math.random();

  const [l0, l1, l2] = [0, 1, 2].sort(() => Math.random() - 0.5);
  let extraSpacing = 0;

  if (roll < 0.22) {
    // Pattern 1: Ramp Train + rooftop Good Points ribbon
    spawnObstacle('ramp_train', l0, z0 - 8);
    spawnGoodPointLine(l0, z0 - 1, 6, 2.5, 4.15, 0, true);
    spawnObstacle('low', l1, z0 - 2);
    spawnGoodPointLine(l1, z0, 3, 2.3, 1.0, 2.2, false);
    if (run.strikes >= 1) {
      spawnObstacle('high', l2, z0 - 10);
    }
    spawnGoodPointLine(l2, z0 - 3, 4, 2.6, 0.9, 0, false);
    extraSpacing = 12;
  } else if (roll < 0.44) {
    // Pattern 2: Double-Train Canyon
    spawnObstacle('train', l0, z0 - 8);
    spawnObstacle(Math.random() < 0.5 ? 'ramp_train' : 'train', l1, z0 - 8);
    if (Math.random() < 0.5) {
      spawnObstacle('high', l2, z0 - 5);
      spawnGoodPointLine(l2, z0 - 1, 5, 2.5, 0.85, 0, false);
    } else {
      spawnObstacle('low', l2, z0 - 5);
      spawnGoodPointLine(l2, z0 - 2, 4, 2.4, 1.0, 2.2, false);
    }
    if (Math.random() < 0.28) {
      spawnPowerup(l2, z0 - 16, 1.35);
    }
    extraSpacing = 13;
  } else if (roll < 0.67) {
    // Pattern 3: Meni'ot Slalom (denser on Strike 1 & 2!)
    spawnObstacle('meniah', l0, z0);
    spawnObstacle('meniah', l1, z0 - 10);
    if (run.strikes >= 2) {
      spawnObstacle('low', l2, z0 - 18);
    }
    spawnGoodPointLine(l2, z0 + 2, 4, 2.5, 1.05, 0, false);
    spawnGoodPointLine(l0, z0 - 10, 4, 2.5, 1.05, 0, true);
    if (Math.random() < 0.28) {
      spawnPowerup(l1, z0, 1.35);
    }
    extraSpacing = 8;
  } else if (roll < 0.85) {
    // Pattern 4: Approaching Moving Airport Shuttle
    spawnObstacle('moving_train', l0, z0 - 15);
    spawnObstacle(difficulty > 0.35 ? 'low' : 'high', l1, z0 - 2);
    spawnGoodPointLine(l2, z0, 5, 2.6, 1.05, 0, false);
    if (Math.random() < 0.25) {
      spawnPowerup(l2, z0 - 14, 1.35);
    }
    extraSpacing = 11;
  } else {
    // Pattern 5: Jump -> Slide Rhythm Combo
    spawnObstacle('low', l0, z0);
    spawnObstacle('high', l0, z0 - 14);
    spawnGoodPointLine(l0, z0 + 2, 3, 2.2, 1.0, 2.2, false);
    spawnGoodPointLine(l0, z0 - 11, 4, 2.2, 0.85, 0, true);
    spawnObstacle('meniah', l1, z0 - 6);
    if (run.strikes >= 1) {
      spawnObstacle('meniah', l2, z0 - 14);
    }
    extraSpacing = 10;
  }

  // Tightens noticeably with Strike 1 & Strike 2 so Meni'ot truly intensify!
  const strikeFactor = 1 - run.strikes * 0.11;
  spawnCursor = (THREE.MathUtils.lerp(34, 24, difficulty) + extraSpacing) * strikeFactor;
}

// ================= GAME FLOW ACTIONS =================
function startNewRun(stage = 1, carryScore = 0) {
  sound.ensureContext();
  clearTrackEntities();
  particles.clear();
  world.reset();
  player.reset();
  player.setCharacter(save.selectedCharacter);

  run = createEmptyRun(stage, carryScore);
  spawnCursor = 18;
  state = 'playing';

  el.startScreen.classList.add('hidden');
  el.charScreen.classList.add('hidden');
  el.shopScreen.classList.add('hidden');
  el.pauseScreen.classList.add('hidden');
  el.gameoverScreen.classList.add('hidden');
  el.victoryScreen.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.strike1Vignette.classList.add('hidden');
  el.dangerVignette.classList.add('hidden');
  el.hud.classList.remove('hidden');
  el.controlsHint.classList.remove('faded');

  const ch = getSelectedChar();
  sound.startMusic();
  showQuote(
    stage === 1
      ? (ch.female
          ? `${ch.name} יוצאת לדרך! היזהרי מ־3 פסילות מול המניעות והספיקי לטיסה! ✈️`
          : `${ch.name} יוצא לדרך! היזהר מ־3 פסילות מול המניעות והספק לטיסה! ✈️`)
      : `טיסה #${stage} עם ${ch.name}! המניעות חזקות יותר — קדימה לשער אומן!`,
    3400
  );
  updateHUD();
}

function triggerJoyFever() {
  if (run.powerups.joy > 0) return;
  run.joyCharge = 0;
  run.powerups.joy = 5.0;
  run.timeLeft += 3;
  // Note: Joy Fever does NOT erase strikes, so 3-strike tension stays real and meaningful!
  sound.playJoyFever();
  particles.burst(player.x, player.y + 1.5, 0, 0xffd24c, 26, 9);
  showQuote('🌟 מצב שמחה תמיד! בלתי־פגיע לשבירת מניעות ל־5 שניות!', 2800);
  spawnFloatingPopup('🌟 שמחה תמיד!', 'gold');
}

// Rebuilt 3-Strike Escalation Hit Handler!
function handleObstacleHit(obs, index) {
  obs.smashed = true;
  scene.remove(obs.group);
  obstacles.splice(index, 1);

  // Joy Fever smashes obstacles for +75 bonus!
  if (run.powerups.joy > 0) {
    run.brokenMeniot++;
    run.score += 75;
    cameraShake = 0.16;
    sound.playSmashMeniah();
    particles.burst(obs.x, 1.8, obs.z, 0xffd24c, 20, 9);
    spawnFloatingPopup('🔥 שברת מניעה! +75', 'fire');
    return;
  }

  // Fire Helmet Shield absorbs ONE hit then disappears!
  if (run.powerups.fire > 0) {
    run.powerups.fire = 0;
    player.invincibleTimer = 1.4;
    run.brokenMeniot++;
    run.score += 60;
    cameraShake = 0.22;
    sound.playSmashMeniah();
    particles.burst(obs.x, 1.8, obs.z, 0xff6b2b, 22, 9);
    showQuote('🔥 כובע האש ספג את הפגיעה ושבר את המניעה!', 2400);
    spawnFloatingPopup('🔥 כובע האש הגן!', 'fire');
    return;
  }

  // REAL STRIKE — 1 -> 2 -> 3 (Game Stops!)
  run.strikes += 1;
  run.combo = 0;
  run.comboTimer = 0;
  cameraShake = 0.36;
  sound.playStumble();
  particles.burst(player.x, player.y + 1.3, 0, run.strikes >= 2 ? 0xef4444 : 0xa855f7, 22, 8.5);

  if (run.strikes === 1) {
    // First Hit: Meni'ot surge closer + -100 score penalty!
    run.score = Math.max(0, run.score - 100);
    player.invincibleTimer = 1.5;
    showQuote('⚠️ פגיעה ראשונה (1/3) — המניעות התקרבו ומתגברות! (-100 ניקוד)', 3000);
    spawnFloatingPopup('⚠️ פגיעה 1/3 • -100', 'purple');
    updateHUD();
  } else if (run.strikes === 2) {
    // Second Strike: Meni'ot right behind heels + -150 score penalty + critical warning!
    run.score = Math.max(0, run.score - 150);
    player.invincibleTimer = 1.5;
    showQuote('🚨 פסילה שנייה (2/3) — המניעות ממש עליך! עוד פגיעה אחת והמשחק נעצר!', 3400);
    spawnFloatingPopup('🚨 פסילה 2/3 • -150!', 'danger');
    updateHUD();
  } else {
    // Third Strike: GAME STOPS IMMEDIATELY!
    updateHUD();
    triggerGameOver('strikes');
  }
}

function triggerGameOver(reason = 'strikes') {
  state = 'gameover';
  sound.pauseMusic();
  sound.playGameOver();

  save.bankPoints += run.goodPoints;
  if (run.score > save.bestScore) save.bestScore = Math.floor(run.score);
  writeSave(save);
  updateMenuStats();

  el.hud.classList.add('hidden');
  el.strike1Vignette.classList.add('hidden');
  el.dangerVignette.classList.add('hidden');
  el.joyVignette.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.quoteBanner.classList.add('hidden');
  el.gameoverScreen.classList.remove('hidden');

  if (reason === 'timeout') {
    el.goReasonBadge.textContent = '⏱️ נגמר הזמן להספיק לטיסה!';
  } else {
    el.goReasonBadge.textContent = '🛑 3 פסילות — המשחק נעצר!';
  }

  el.goQuote.textContent = `״${BRESLOV_QUOTES[Math.floor(Math.random() * BRESLOV_QUOTES.length)]}״`;
  el.goScore.textContent = Math.floor(run.score).toLocaleString('he-IL');
  el.goGoodPoints.textContent = `${run.goodPoints.toLocaleString('he-IL')} ✦`;
  el.goStrikes.textContent = `${run.strikes} / 3`;
  el.goDistance.textContent = `${Math.floor(run.distance)} מ׳ • רצף ×${run.bestCombo}`;
}

function triggerVictory() {
  state = 'victory';
  sound.pauseMusic();
  sound.playVictory();
  clearTrackEntities();

  const ch = getSelectedChar();
  const cleanBonus = run.strikes === 0 ? 300 : run.strikes === 1 ? 150 : 0;
  const arrivalScoreBonus = 500 + cleanBonus;
  const flightPointsBonus = 40 + (run.stage - 1) * 20;

  run.goodPoints += flightPointsBonus;
  run.score += arrivalScoreBonus;

  save.bankPoints += run.goodPoints;
  save.flightsCompleted += 1;
  if (run.score > save.bestScore) save.bestScore = Math.floor(run.score);
  writeSave(save);
  updateMenuStats();

  world.finishGroup.visible = true;
  world.finishGroup.position.z = -12;

  el.hud.classList.add('hidden');
  el.strike1Vignette.classList.add('hidden');
  el.dangerVignette.classList.add('hidden');
  el.joyVignette.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.quoteBanner.classList.add('hidden');
  el.victoryScreen.classList.remove('hidden');

  el.vicHeroImg.src = ch.victoryImg;
  el.vicHeroImg.classList.toggle('photo-frame', !ch.isFullSpritePortrait);
  el.vicTitle.textContent = ch.female
    ? `${ch.name} הגיעה לטיסה לצדיק!`
    : `${ch.name} הגיע לטיסה לצדיק!`;
  el.vicQuote.textContent = run.strikes === 0
    ? '״ריצה נקייה מושלמת (0 פסילות)! ניצחת את כל המניעות!״'
    : '״העיקר להגיע — התגברת על המניעות והספקת למטוס לאומן!״';

  el.vicBonus.textContent = `+${arrivalScoreBonus} נק׳ (+${flightPointsBonus}✦)`;
  el.vicGoodPoints.textContent = `${run.goodPoints.toLocaleString('he-IL')} ✦`;
  el.vicScore.textContent = Math.floor(run.score).toLocaleString('he-IL');
  el.vicStrikes.textContent = `${run.strikes} / 3`;

  particles.burst(0, 4.5, -4, 0xffd24c, 35, 11);
  particles.burst(-4, 5.5, -6, 0x38bdf8, 28, 10);
  particles.burst(4, 5.5, -6, 0xf97316, 28, 10);
}

function goHome() {
  state = 'menu';
  sound.pauseMusic();
  clearTrackEntities();
  particles.clear();
  world.reset();
  player.reset();
  player.setCharacter(save.selectedCharacter);
  updateMenuStats();
  renderCharacterSelectors();

  el.hud.classList.add('hidden');
  el.charScreen.classList.add('hidden');
  el.pauseScreen.classList.add('hidden');
  el.gameoverScreen.classList.add('hidden');
  el.victoryScreen.classList.add('hidden');
  el.shopScreen.classList.add('hidden');
  el.strike1Vignette.classList.add('hidden');
  el.dangerVignette.classList.add('hidden');
  el.joyVignette.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.quoteBanner.classList.add('hidden');
  el.startScreen.classList.remove('hidden');
}

// ================= INPUT CONTROLS =================
function handleMoveLeft() {
  if (state !== 'playing') return;
  if (player.moveLane(-1)) sound.playLaneSwitch();
}

function handleMoveRight() {
  if (state !== 'playing') return;
  if (player.moveLane(1)) sound.playLaneSwitch();
}

function handleJump() {
  if (state !== 'playing') return;
  const hasWings = run.powerups.wings > 0;
  if (player.jump(hasWings)) {
    sound.playJump(hasWings);
    particles.burst(player.x, player.y + 0.2, 0, hasWings ? 0xfef08a : 0xe2e8f0, 7, 4.5);
  }
}

function handleSlide() {
  if (state !== 'playing') return;
  if (player.slide()) sound.playSlide();
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === 'playing') {
      state = 'paused';
      sound.pauseMusic();
      el.pauseScreen.classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      sound.startMusic();
      el.pauseScreen.classList.add('hidden');
    }
    return;
  }

  if (e.code === 'KeyM') {
    const muted = sound.toggleMute();
    el.btnSound.textContent = muted ? '🔇' : '🔊';
    return;
  }

  if (state === 'menu' && !el.startScreen.classList.contains('hidden') && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    startNewRun(1, 0);
    return;
  }

  if (state !== 'playing') return;

  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      e.preventDefault();
      handleMoveLeft();
      break;
    case 'ArrowRight':
    case 'KeyD':
      e.preventDefault();
      handleMoveRight();
      break;
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      e.preventDefault();
      handleJump();
      break;
    case 'ArrowDown':
    case 'KeyS':
      e.preventDefault();
      handleSlide();
      break;
    case 'KeyE':
    case 'ShiftLeft':
    case 'ShiftRight':
      if (run.joyCharge >= 80 && run.powerups.joy <= 0) {
        triggerJoyFever();
      }
      break;
  }
});

// Touch & Mouse Drag Swipe
let pointerStart = null;
function onPointerStart(x, y) { pointerStart = { x, y }; }
function onPointerEnd(x, y) {
  if (!pointerStart || state !== 'playing') return;
  const dx = x - pointerStart.x;
  const dy = y - pointerStart.y;
  pointerStart = null;
  if (Math.hypot(dx, dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) handleMoveRight();
    else handleMoveLeft();
  } else {
    if (dy < 0) handleJump();
    else handleSlide();
  }
}

renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.touches[0]) onPointerStart(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
renderer.domElement.addEventListener('touchend', (e) => {
  if (e.changedTouches[0]) onPointerEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
}, { passive: true });
renderer.domElement.addEventListener('mousedown', (e) => onPointerStart(e.clientX, e.clientY));
window.addEventListener('mouseup', (e) => onPointerEnd(e.clientX, e.clientY));

// Button listeners
el.btnPlay.addEventListener('click', () => startNewRun(1, 0));
el.btnOpenChars.addEventListener('click', openCharacterScreen);
el.btnCharsCloseX.addEventListener('click', goHome);
el.btnCharsBack.addEventListener('click', goHome);
el.btnCharPlayNow.addEventListener('click', () => startNewRun(1, 0));
el.btnShop.addEventListener('click', () => {
  renderShop();
  el.startScreen.classList.add('hidden');
  el.shopScreen.classList.remove('hidden');
});
el.btnShopClose.addEventListener('click', () => {
  el.shopScreen.classList.add('hidden');
  el.startScreen.classList.remove('hidden');
});
el.btnSound.addEventListener('click', () => {
  const muted = sound.toggleMute();
  el.btnSound.textContent = muted ? '🔇' : '🔊';
});
el.btnPause.addEventListener('click', () => {
  if (state === 'playing') {
    state = 'paused';
    sound.pauseMusic();
    el.pauseScreen.classList.remove('hidden');
  }
});
el.btnResume.addEventListener('click', () => {
  state = 'playing';
  sound.startMusic();
  el.pauseScreen.classList.add('hidden');
});
el.btnRestartPause.addEventListener('click', () => startNewRun(1, 0));
el.btnHomePause.addEventListener('click', goHome);
el.btnRetry.addEventListener('click', () => startNewRun(1, 0));
el.btnGoChars.addEventListener('click', openCharacterScreen);
el.btnGoHome.addEventListener('click', goHome);
el.btnNextFlight.addEventListener('click', () => startNewRun(run.stage + 1, run.score));
el.btnVicChars.addEventListener('click', openCharacterScreen);
el.btnVicHome.addEventListener('click', goHome);

// ================= MAIN UPDATE LOOP =================
function updatePlaying(dt) {
  const progress = Math.min(1, run.distance / run.targetDistance);
  const remaining = Math.max(0, run.targetDistance - run.distance);

  // Smooth, controlled speed that gently escalates with progress & strikes
  const targetSpeed = Math.min(
    PLAYER_CONFIG.maxSpeed,
    PLAYER_CONFIG.baseSpeed + (run.stage - 1) * 2.0 + progress * 7.2 + run.strikes * 1.1 + (run.powerups.joy > 0 ? 3.0 : 0)
  );
  run.speed += (targetSpeed - run.speed) * Math.min(1, dt * 2.2);

  const dz = run.speed * dt;
  const distDelta = dz * 0.62;
  run.distance += distDelta;
  // Modest +1 score per meter (main score now comes from Good Points, Streaks & Clean Dodges!)
  run.score += distDelta;
  run.timeLeft -= dt;

  if (!run.hintHidden && run.distance > 90) {
    run.hintHidden = true;
    el.controlsHint.classList.add('faded');
  }

  for (const key of Object.keys(run.powerups)) {
    if (run.powerups[key] > 0) run.powerups[key] = Math.max(0, run.powerups[key] - dt);
  }

  if (run.comboTimer > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) run.combo = 0;
  }

  sound.setIntensity(run.speed / PLAYER_CONFIG.baseSpeed, run.powerups.joy > 0);

  const { zoneChanged, zone } = world.update(dt, run.speed, progress, remaining, run.powerups.joy > 0);
  if (zoneChanged) {
    sound.playPowerup();
    showQuote(zone.quote, 3600);
    spawnFloatingPopup(`✨ ${zone.name}`, 'sky');
    particles.burst(player.x, 3, -6, 0xffd24c, 18, 8);
  }

  if (remaining <= 105 && !run.runwayCleared) {
    run.runwayCleared = true;
    spawnGoodPointLine(1, -28, 12, 4.5, 1.1, 0, true);
  } else if (remaining > 105) {
    spawnCursor -= dz;
    if (spawnCursor <= 0) spawnWave();
  }

  // Advance obstacles, award Clean Dodge points & compute train rooftop support!
  let supportY = 0;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    const stepZ = (run.speed + (o.moveSpeed || 0)) * dt;
    o.z += stepZ;
    o.group.position.z = o.z;

    if (o.group.userData.spinRings) {
      o.group.userData.spinRings[0].rotation.z += dt * 4.0;
      o.group.userData.spinRings[1].rotation.z -= dt * 5.0;
    }

    // Award +15 Clean Dodge bonus when an unhit obstacle passes safely behind player!
    if (!o.passed && !o.smashed && o.z - o.halfD > 1.2) {
      o.passed = true;
      run.cleanDodges++;
      run.score += 15;
    }

    if (o.z > 24) {
      scene.remove(o.group);
      obstacles.splice(i, 1);
      continue;
    }

    if (o.smashed) continue;

    if (o.roofY != null && Math.abs(player.x - o.x) < o.halfW + 0.38) {
      const frontZ = o.z + o.halfD;
      const backZ = o.z - o.halfD;

      if (o.hasRamp && 0 >= frontZ - 0.35 && 0 <= frontZ + o.rampLength + 0.3) {
        const rampProgress = THREE.MathUtils.clamp(1 - (0 - frontZ) / o.rampLength, 0, 1);
        supportY = Math.max(supportY, rampProgress * o.roofY);
      } else if (0 >= backZ - 0.45 && 0 <= frontZ + 0.45) {
        if (player.y >= o.roofY - 0.85) {
          supportY = Math.max(supportY, o.roofY);
        }
      }
    }
  }

  player.groundY = supportY;
  const { landed, bufferedJumped } = player.update(dt, run.speed, 'playing', run.powerups, timeNow);
  if (landed) particles.burst(player.x, player.groundY + 0.15, 0, 0xffe4b5, 7, 3.8);
  if (bufferedJumped) sound.playJump(run.powerups.wings > 0);

  if (!player.isJumping && !player.isSliding) {
    footstepDustTimer -= dt;
    if (footstepDustTimer <= 0) {
      footstepDustTimer = 0.16;
      particles.burst(player.x, player.y + 0.12, 0.25, run.powerups.joy > 0 ? 0xffd24c : 0xe2e8f0, 2, 2.0);
    }
  }

  // Update pursuing Meni'ot storm — visibly closes in on Strike 1 & Strike 2!
  meniot.update(dt, timeNow, player.x, run.strikes, run.powerups.joy > 0, true);

  // Obstacle collisions
  const hb = player.getHitbox();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.smashed) continue;

    if (o.roofY != null && Math.abs(hb.x - o.x) < o.halfW + 0.38) {
      if (hb.y >= o.roofY - 0.82) continue;
      if (o.hasRamp && 0 >= o.z + o.halfD - 0.35 && 0 <= o.z + o.halfD + o.rampLength + 0.35) continue;
    }

    const overlapX = Math.abs(hb.x - o.x) < hb.halfW + o.halfW - 0.24;
    const overlapZ = Math.abs(hb.z - o.z) < hb.halfD + o.halfD - 0.2;
    const overlapY = hb.y < o.maxY - 0.14 && hb.y + hb.height > o.minY + 0.14;

    if (overlapX && overlapZ && overlapY) {
      if (player.invincibleTimer > 0 && run.powerups.joy <= 0 && run.powerups.fire <= 0) {
        continue;
      }
      handleObstacleHit(o, i);
      if (state !== 'playing') return;
    }
  }

  // Update & collect Good Points ("נקודות טובות")
  const magnetOn = run.powerups.magnet > 0 || run.powerups.joy > 0;
  const basePointScore = getUpgradeValue(save, 'pointBonus');
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    c.z += dz;
    c.gem.rotation.y += dt * 3.2;
    c.halo.rotation.z -= dt * 2.0;

    if (magnetOn && c.z > -24 && c.z < 6) {
      const pull = Math.min(1, dt * 13);
      c.x += (player.x - c.x) * pull;
      c.y += (player.y + 1.25 - c.y) * pull;
      c.z += (0 - c.z) * pull * 0.75;
    } else {
      c.y = c.baseY + Math.sin(timeNow * 4 + c.phase) * 0.18;
    }

    c.group.position.set(c.x, c.y, c.z);

    if (c.z > 14) {
      scene.remove(c.group);
      collectibles.splice(i, 1);
      continue;
    }

    const dx = Math.abs(c.x - player.x);
    const dy = Math.abs(c.y - (player.y + 1.15));
    const dzDist = Math.abs(c.z);
    if (dx < 1.38 && dy < 1.6 && dzDist < 1.5) {
      scene.remove(c.group);
      collectibles.splice(i, 1);

      run.combo += 1;
      if (run.combo > run.bestCombo) run.bestCombo = run.combo;
      run.comboTimer = 2.8;

      const mult = getTotalMultiplier();
      const gpValue = c.isSuper ? 5 : 1;
      run.goodPoints += gpValue;
      const scoreGained = gpValue * basePointScore * mult;
      run.score += scoreGained;

      sound.playGoodPoint(run.combo, c.isSuper);
      particles.burst(c.x, c.y, c.z, c.isSuper ? 0xfffbeb : 0xffd24c, c.isSuper ? 16 : 6, c.isSuper ? 7 : 4.5);

      if (c.isSuper) {
        spawnFloatingPopup(`✦ כתר אזמרה +${scoreGained}!`, 'gold');
      } else if (run.combo === 10 || run.combo === 22 || run.combo === 45) {
        spawnFloatingPopup(`🔥 מכפיל רצף ×${getStreakMultiplier()}!`, 'gold');
      }

      if (run.powerups.joy <= 0) {
        run.joyCharge = Math.min(100, run.joyCharge + (c.isSuper ? 18 : 3.6));
        if (run.joyCharge >= 100) triggerJoyFever();
      }
    }
  }

  // Update & collect Power-ups
  for (let i = powerupPickups.length - 1; i >= 0; i--) {
    const p = powerupPickups[i];
    p.z += dz;
    p.y = p.baseY + Math.sin(timeNow * 3.5 + p.phase) * 0.22;
    p.orb.rotation.y += dt * 2.6;
    p.ring.rotation.z += dt * 3.5;
    p.group.position.set(p.x, p.y, p.z);

    if (p.z > 14) {
      scene.remove(p.group);
      powerupPickups.splice(i, 1);
      continue;
    }

    const dx = Math.abs(p.x - player.x);
    const dy = Math.abs(p.y - (player.y + 1.2));
    if (dx < 1.5 && dy < 1.75 && Math.abs(p.z) < 1.65) {
      scene.remove(p.group);
      powerupPickups.splice(i, 1);
      activatePowerup(p.kind);
    }
  }

  if (run.distance >= run.targetDistance) {
    triggerVictory();
    return;
  }

  if (run.timeLeft <= 0) {
    triggerGameOver('timeout');
    return;
  }

  updateHUD();
}

function activatePowerup(kind) {
  sound.playPowerup();
  particles.burst(player.x, player.y + 1.5, 0, 0xffd24c, 20, 8);

  if (kind === 'fire') {
    run.powerups.fire = getUpgradeValue(save, 'fireDuration');
    showQuote('🔥 כובע האש! מגן מפגיעה אחת ושובר את המניעה!', 2600);
    spawnFloatingPopup('🔥 כובע האש!', 'fire');
  } else if (kind === 'magnet') {
    run.powerups.magnet = getUpgradeValue(save, 'magnetDuration');
    showQuote('🧲 מגנט אזמרה! מושך נקודות טובות מכל הנתיבים!', 2600);
    spawnFloatingPopup('🧲 מגנט אזמרה!', 'sky');
  } else if (kind === 'wings') {
    run.powerups.wings = getUpgradeValue(save, 'wingsDuration');
    showQuote('✨ כנפי שמחה! קפיצות גבוהות מעל רכבות ומניעות!', 2600);
    spawnFloatingPopup('✨ כנפי שמחה!', 'gold');
  } else if (kind === 'double') {
    run.powerups.double = getUpgradeValue(save, 'doubleDuration');
    showQuote('⚡ אור הצדיק! כפל ניקוד ×2!', 2600);
    spawnFloatingPopup('⚡ אור הצדיק ×2!', 'purple');
  }
}

function updateCamera(dt) {
  if (state === 'menu') {
    const sway = Math.sin(timeNow * 0.65) * 1.0;
    camera.position.lerp(new THREE.Vector3(sway, 2.7, 5.8), Math.min(1, dt * 4));
    camera.lookAt(0, 1.65, -8);
    camera.fov += (55 - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
    return;
  }

  if (state === 'victory') {
    const orbit = Math.sin(timeNow * 0.9) * 2.2;
    camera.position.lerp(new THREE.Vector3(orbit, 3.2, 6.8), Math.min(1, dt * 3.5));
    camera.lookAt(0, 2.2, -8);
    return;
  }

  const shakeX = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
  const shakeY = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
  cameraShake = Math.max(0, cameraShake - dt * 2.4);

  const targetCamX = player.x * 0.42 + shakeX;
  const targetCamY = 5.05 + player.y * 0.42 + shakeY;
  const targetCamZ = 8.6;

  camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 9);
  camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 8);
  camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 6);
  camera.lookAt(player.x * 0.22, 1.9 + player.y * 0.26, -18);

  const speedFactor = THREE.MathUtils.clamp((run.speed - PLAYER_CONFIG.baseSpeed) / 14, 0, 1);
  const targetFov = 58 + speedFactor * 3.5 + (run.powerups.joy > 0 ? 1.8 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3.5);
  camera.updateProjectionMatrix();
}

// ================= ANIMATION LOOP =================
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  timeNow += dt;

  if (state === 'menu') {
    world.update(dt, 7.0, 0.05, FLIGHT_CONFIG.baseDistance, false);
    player.update(dt, 0, 'menu', run.powerups, timeNow);
    meniot.update(dt, timeNow, 0, 0, false, false);
  } else if (state === 'playing') {
    updatePlaying(dt);
  } else if (state === 'gameover') {
    meniot.update(dt, timeNow, player.x, 3, false, true);
  } else if (state === 'victory') {
    player.update(dt, 0, 'victory', run.powerups, timeNow);
    meniot.update(dt, timeNow, 0, 0, false, false);
    victoryFireworkTimer -= dt;
    if (victoryFireworkTimer <= 0) {
      victoryFireworkTimer = 0.55;
      const fx = (Math.random() - 0.5) * 12;
      const fy = 4.5 + Math.random() * 4.5;
      const colors = [0xffd24c, 0x38bdf8, 0xf97316, 0xc084fc, 0x4ade80];
      particles.burst(fx, fy, -7, colors[Math.floor(Math.random() * colors.length)], 22, 9);
    }
  }

  particles.update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot!
selectCharacter(save.selectedCharacter, false);
updateMenuStats();
camera.position.set(0, 2.7, 5.8);
camera.lookAt(0, 1.65, -8);

const params = new URLSearchParams(window.location.search);
const charParam = params.get('char');
if (charParam && CHARACTERS.some((c) => c.id === charParam)) {
  selectCharacter(charParam, false);
}
const previewParam = params.get('preview');
if (previewParam === 'chars') {
  openCharacterScreen();
} else if (previewParam === 'strike1') {
  startNewRun(1, 0);
  run.strikes = 1;
  run.score = 240;
  updateHUD();
} else if (previewParam === 'strike2') {
  startNewRun(1, 0);
  run.strikes = 2;
  run.score = 390;
  updateHUD();
} else if (previewParam === 'gameover') {
  startNewRun(1, 0);
  run.strikes = 3;
  run.goodPoints = 18;
  run.score = 620;
  run.distance = 410;
  run.bestCombo = 12;
  triggerGameOver('strikes');
}

requestAnimationFrame(animate);
