import * as THREE from 'three';
import {
  LANES,
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
  shopScreen: document.getElementById('shop-screen'),
  pauseScreen: document.getElementById('pause-screen'),
  gameoverScreen: document.getElementById('gameover-screen'),
  victoryScreen: document.getElementById('victory-screen'),

  dangerVignette: document.getElementById('danger-vignette'),
  joyVignette: document.getElementById('joy-vignette'),
  quoteBanner: document.getElementById('quote-banner'),
  quoteText: document.getElementById('quote-text'),
  sprintBanner: document.getElementById('sprint-banner'),
  sprintMeters: document.getElementById('sprint-meters'),
  floatingPopups: document.getElementById('floating-popups'),

  hudGoodPoints: document.getElementById('hud-good-points'),
  hudHearts: document.getElementById('hud-hearts'),
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

  menuBankPoints: document.getElementById('menu-bank-points'),
  menuBestScore: document.getElementById('menu-best-score'),
  menuFlightsWon: document.getElementById('menu-flights-won'),

  shopBankVal: document.getElementById('shop-bank-val'),
  shopItems: document.getElementById('shop-items'),

  goReasonBadge: document.getElementById('gameover-reason-badge'),
  goQuote: document.getElementById('gameover-quote'),
  goScore: document.getElementById('go-score'),
  goGoodPoints: document.getElementById('go-good-points'),
  goDistance: document.getElementById('go-distance'),
  goBroken: document.getElementById('go-broken'),
  btnRevive: document.getElementById('btn-revive'),
  reviveCostLabel: document.getElementById('revive-cost-label'),

  vicBonus: document.getElementById('vic-bonus'),
  vicGoodPoints: document.getElementById('vic-good-points'),
  vicScore: document.getElementById('vic-score'),
  vicStage: document.getElementById('vic-stage'),

  btnPlay: document.getElementById('btn-play'),
  btnShop: document.getElementById('btn-shop'),
  btnShopClose: document.getElementById('btn-shop-close'),
  btnSound: document.getElementById('btn-sound'),
  btnPause: document.getElementById('btn-pause'),
  btnResume: document.getElementById('btn-resume'),
  btnRestartPause: document.getElementById('btn-restart-pause'),
  btnHomePause: document.getElementById('btn-home-pause'),
  btnRetry: document.getElementById('btn-retry'),
  btnGoHome: document.getElementById('btn-go-home'),
  btnNextFlight: document.getElementById('btn-next-flight'),
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

const world = new WorldManager(scene);
const player = new PlayerController(scene);
const meniot = new MeniotPursuer(scene);
const particles = new ParticleSystem(scene);

// ================= GAME STATE =================
let save = loadSave();
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

function createEmptyRun(stage = 1, carryScore = 0) {
  const targetDistance = FLIGHT_CONFIG.baseDistance + (stage - 1) * FLIGHT_CONFIG.distancePerStage;
  const timeLeft = Math.max(75, FLIGHT_CONFIG.baseTimeSeconds + (stage - 1) * 10);
  return {
    stage,
    distance: 0,
    targetDistance,
    timeLeft,
    speed: PLAYER_CONFIG.baseSpeed + (stage - 1) * 2.0,
    hearts: PLAYER_CONFIG.maxHearts,
    score: carryScore,
    goodPoints: 0,
    brokenMeniot: 0,
    combo: 0,
    comboTimer: 0,
    joyCharge: 0, // 0..100
    freeRevivesLeft: getUpgradeValue(save, 'freeRevives'),
    paidRevivesUsed: 0,
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

// ================= UI HELPERS =================
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

function getMeniotVisualDanger() {
  // Directly tied to clear remaining hearts so player immediately understands the threat!
  if (run.powerups.joy > 0) return 0.05;
  if (run.hearts >= 3) return 0.14;
  if (run.hearts === 2) return 0.56;
  return 0.94;
}

function updateHUD() {
  const progress = Math.min(1, run.distance / run.targetDistance);
  const remaining = Math.max(0, Math.ceil(run.targetDistance - run.distance));

  el.hudGoodPoints.textContent = run.goodPoints.toLocaleString('he-IL');
  el.hudScore.textContent = `ניקוד: ${Math.floor(run.score).toLocaleString('he-IL')}`;

  // Crystal-clear 3 hearts display!
  const fullHearts = '💛'.repeat(run.hearts);
  const emptyHearts = '🖤'.repeat(Math.max(0, PLAYER_CONFIG.maxHearts - run.hearts));
  el.hudHearts.textContent = fullHearts + emptyHearts;

  const mult = getCurrentMultiplier();
  el.hudMultiplier.textContent = `×${mult}`;

  const zoneIdx = world.currentZoneIdx;
  const zone = ZONES[zoneIdx] || ZONES[0];
  el.hudZoneName.textContent = zone.name;
  el.hudFlightStage.textContent = `טיסה #${run.stage}`;
  el.hudDistanceLeft.textContent = `נותרו ${remaining.toLocaleString('he-IL')} מ׳ עד המטוס`;
  el.hudFlightFill.style.width = `${(progress * 100).toFixed(1)}%`;
  el.hudPlaneMarker.style.right = `${(progress * 100).toFixed(1)}%`;

  // Highlight active/completed stage milestones on the route bar!
  el.ms1.className = `ms-item ${zoneIdx === 0 ? 'active' : 'done'}`;
  el.ms2.className = `ms-item ${zoneIdx === 1 ? 'active' : zoneIdx > 1 ? 'done' : ''}`;
  el.ms3.className = `ms-item ${zoneIdx === 2 ? 'active' : ''}`;

  el.hudTimer.textContent = `⏱️ ${formatTimer(run.timeLeft)}`;
  el.hudTimer.classList.toggle('urgent', run.timeLeft <= 15);

  // Final 140m unmistakable sprint callout!
  if (remaining <= 140 && remaining > 0) {
    el.sprintMeters.textContent = remaining.toString();
    el.sprintBanner.classList.remove('hidden');
    el.quoteBanner.classList.add('hidden');
  } else {
    el.sprintBanner.classList.add('hidden');
  }

  // Joy meter
  const joyPct = run.powerups.joy > 0 ? Math.round((run.powerups.joy / 6.0) * 100) : Math.round(run.joyCharge);
  el.hudJoyPct.textContent = run.powerups.joy > 0 ? 'פעיל! ✨' : `${joyPct}%`;
  el.hudJoyFill.style.width = `${Math.min(100, joyPct)}%`;
  el.joyReadyHint.classList.toggle('hidden', !(run.joyCharge >= 80 && run.powerups.joy <= 0));

  // Last-heart danger vignette & Joy vignette
  el.dangerVignette.classList.toggle('hidden', !(run.hearts === 1 && run.powerups.joy <= 0));
  el.joyVignette.classList.toggle('hidden', run.powerups.joy <= 0);

  // Combo badge
  if (run.combo >= 3) {
    el.comboBadge.classList.remove('hidden');
    el.comboCount.textContent = `×${run.combo}`;
  } else {
    el.comboBadge.classList.add('hidden');
  }

  // Active power-up pills
  const pills = [];
  if (run.powerups.joy > 0) pills.push(`<div class="powerup-pill joy">🌟 שמחה תמיד ${run.powerups.joy.toFixed(1)}ש׳</div>`);
  if (run.powerups.fire > 0) pills.push(`<div class="powerup-pill fire">🔥 כובע האש ${run.powerups.fire.toFixed(1)}ש׳</div>`);
  if (run.powerups.magnet > 0) pills.push(`<div class="powerup-pill magnet">🧲 מגנט אזמרה ${run.powerups.magnet.toFixed(1)}ש׳</div>`);
  if (run.powerups.wings > 0) pills.push(`<div class="powerup-pill wings">✨ כנפי שמחה ${run.powerups.wings.toFixed(1)}ש׳</div>`);
  if (run.powerups.double > 0) pills.push(`<div class="powerup-pill double">⚡ אור הצדיק ×2 (${run.powerups.double.toFixed(1)}ש׳)</div>`);
  el.activePowerups.innerHTML = pills.join('');
}

function getCurrentMultiplier() {
  let m = 1;
  if (world.currentZoneIdx === 1) m *= 2; // Narrow Bridge double points!
  if (run.powerups.double > 0) m *= 2;
  if (run.powerups.joy > 0) m *= 2;
  return m;
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

// Guaranteed-solvable, well-spaced Subway Surfers rhythmic wave spawner!
function spawnWave() {
  const z0 = -118;
  const difficulty = Math.min(1, (run.distance / run.targetDistance) * 0.7 + (run.stage - 1) * 0.25);
  const roll = Math.random();

  const [l0, l1, l2] = [0, 1, 2].sort(() => Math.random() - 0.5);
  let extraSpacing = 0;

  if (roll < 0.24) {
    // Pattern 1: Ramp Train with rooftop Good Points ribbon + Super Point crown!
    spawnObstacle('ramp_train', l0, z0 - 8);
    spawnGoodPointLine(l0, z0 - 1, 6, 2.5, 4.15, 0, true);
    spawnObstacle('low', l1, z0 - 2);
    spawnGoodPointLine(l1, z0, 3, 2.3, 1.0, 2.2, false);
    // Keep l2 completely open for breathing room!
    spawnGoodPointLine(l2, z0 - 3, 4, 2.6, 1.05, 0, false);
    extraSpacing = 12;
  } else if (roll < 0.44) {
    // Pattern 2: Classic Subway Surfers Double-Train Canyon (center/third lane open + slide/jump!)
    spawnObstacle('train', l0, z0 - 8);
    spawnObstacle(Math.random() < 0.55 ? 'ramp_train' : 'train', l1, z0 - 8);
    if (Math.random() < 0.5) {
      spawnObstacle('high', l2, z0 - 5);
      spawnGoodPointLine(l2, z0 - 1, 5, 2.5, 0.85, 0, false);
    } else {
      spawnObstacle('low', l2, z0 - 5);
      spawnGoodPointLine(l2, z0 - 2, 4, 2.4, 1.0, 2.2, false);
    }
    if (Math.random() < 0.38) {
      spawnPowerup(l2, z0 - 16, 1.35);
    }
    extraSpacing = 14;
  } else if (roll < 0.65) {
    // Pattern 3: Meni'ot Slalom (twisting purple Meni'ah pillars + curved Good Points trail)
    spawnObstacle('meniah', l0, z0);
    spawnObstacle('meniah', l1, z0 - 12);
    spawnGoodPointLine(l2, z0 + 2, 4, 2.5, 1.05, 0, false);
    spawnGoodPointLine(l0, z0 - 11, 4, 2.5, 1.05, 0, true);
    if (Math.random() < 0.36) {
      spawnPowerup(l1, z0, 1.35);
    }
    extraSpacing = 8;
  } else if (roll < 0.84) {
    // Pattern 4: Approaching Moving Airport Shuttle (slower, clearly telegraphed!)
    spawnObstacle('moving_train', l0, z0 - 16);
    spawnObstacle(difficulty > 0.4 ? 'low' : 'high', l1, z0 - 2);
    spawnGoodPointLine(l2, z0, 5, 2.6, 1.05, 0, false);
    if (Math.random() < 0.34) {
      spawnPowerup(l2, z0 - 14, 1.35);
    }
    extraSpacing = 12;
  } else {
    // Pattern 5: Jump -> Slide Rhythm Combo
    spawnObstacle('low', l0, z0);
    spawnObstacle('high', l0, z0 - 15);
    spawnGoodPointLine(l0, z0 + 2, 3, 2.2, 1.0, 2.2, false);
    spawnGoodPointLine(l0, z0 - 12, 4, 2.2, 0.85, 0, true);
    spawnObstacle('meniah', l1, z0 - 7);
    extraSpacing = 10;
  }

  // Smooth, readable spacing that tightens gently without ever feeling chaotic
  spawnCursor = THREE.MathUtils.lerp(35, 26, difficulty) + extraSpacing;
}

// ================= GAME FLOW ACTIONS =================
function startNewRun(stage = 1, carryScore = 0) {
  sound.ensureContext();
  clearTrackEntities();
  particles.clear();
  world.reset();
  player.reset();

  run = createEmptyRun(stage, carryScore);
  spawnCursor = 20;
  state = 'playing';

  el.startScreen.classList.add('hidden');
  el.shopScreen.classList.add('hidden');
  el.pauseScreen.classList.add('hidden');
  el.gameoverScreen.classList.add('hidden');
  el.victoryScreen.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.hud.classList.remove('hidden');
  el.controlsHint.classList.remove('faded');

  sound.startMusic();
  showQuote(
    stage === 1
      ? 'שלב 1/3: שדרות ירושלים — עבור 3 שלבים והגע למטוס לאומן! ✈️'
      : `טיסה #${stage} יוצאת לדרך! עבור 3 שלבים והגע לצדיק!`,
    3400
  );
  updateHUD();
}

function triggerJoyFever() {
  if (run.powerups.joy > 0) return;
  run.joyCharge = 0;
  run.powerups.joy = 6.0;
  run.timeLeft += 4;
  if (run.hearts < PLAYER_CONFIG.maxHearts) {
    run.hearts++;
    spawnFloatingPopup('💛 +1 כוח שמחה!', 'gold', 90);
  }
  sound.playJoyFever();
  particles.burst(player.x, player.y + 1.5, 0, 0xffd24c, 26, 9);
  showQuote('🌟 שמחה תמיד! בלתי־פגיע + מגנט + 4 שנ׳ לטיסה!', 3000);
  spawnFloatingPopup('🌟 מצב שמחה תמיד!', 'gold');
}

function handleObstacleHit(obs, index) {
  // Always clear the obstacle we collided with so the player NEVER gets stuck or weirdly trapped!
  obs.smashed = true;
  scene.remove(obs.group);
  obstacles.splice(index, 1);

  // Joy Fever smashes everything for free!
  if (run.powerups.joy > 0) {
    run.brokenMeniot++;
    run.score += 50;
    cameraShake = 0.16;
    sound.playSmashMeniah();
    particles.burst(obs.x, 1.8, obs.z, 0xffd24c, 20, 9);
    spawnFloatingPopup('🔥 שברת מניעה! +50', 'fire');
    return;
  }

  // Fire Helmet Shield absorbs the hit cleanly without losing a heart!
  if (run.powerups.fire > 0) {
    run.powerups.fire = 0;
    player.invincibleTimer = 1.7;
    run.brokenMeniot++;
    run.score += 35;
    cameraShake = 0.22;
    sound.playSmashMeniah();
    particles.burst(obs.x, 1.8, obs.z, 0xff6b2b, 22, 9);
    showQuote('🔥 כובע האש הגן עליך ושבר את המניעה!', 2600);
    spawnFloatingPopup('🔥 כובע האש הציל!', 'fire');
    return;
  }

  // Standard hit -> deduct exactly 1 clear Heart!
  run.hearts = Math.max(0, run.hearts - 1);
  run.combo = 0;
  cameraShake = 0.34;
  sound.playStumble();
  particles.burst(player.x, player.y + 1.3, 0, 0xa855f7, 20, 8);

  if (run.hearts <= 0) {
    triggerGameOver('caught');
    return;
  }

  player.invincibleTimer = 1.9;
  if (run.hearts === 2) {
    spawnFloatingPopup('⚠️ מניעה! נותרו 2 כוחות 💛💛', 'purple');
  } else {
    spawnFloatingPopup('⚠️ נותר כוח אחרון! המניעות צמודות!', 'purple');
    showQuote('⚠️ זהירות! נותר כוח אחד — עוד מניעה אחת והריצה נעצרת!', 2800);
  }
}

function triggerGameOver(reason = 'caught') {
  state = 'gameover';
  sound.pauseMusic();
  sound.playGameOver();

  // Bank Good Points & save high score immediately!
  save.bankPoints += run.goodPoints;
  if (run.score > save.bestScore) save.bestScore = Math.floor(run.score);
  writeSave(save);
  updateMenuStats();

  el.hud.classList.add('hidden');
  el.dangerVignette.classList.add('hidden');
  el.joyVignette.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.gameoverScreen.classList.remove('hidden');

  if (reason === 'timeout') {
    el.goReasonBadge.textContent = '⏱️ נגמר הזמן להספיק לטיסה!';
  } else {
    el.goReasonBadge.textContent = '🌩️ אזלו כל 3 הכוחות מול המניעות';
  }

  el.goQuote.textContent = `״${BRESLOV_QUOTES[Math.floor(Math.random() * BRESLOV_QUOTES.length)]}״`;
  el.goScore.textContent = Math.floor(run.score).toLocaleString('he-IL');
  el.goGoodPoints.textContent = run.goodPoints.toLocaleString('he-IL');
  el.goDistance.textContent = `${Math.floor(run.distance).toLocaleString('he-IL')} / ${run.targetDistance} מ׳`;
  el.goBroken.textContent = run.brokenMeniot.toLocaleString('he-IL');

  if (run.freeRevivesLeft > 0) {
    el.btnRevive.disabled = false;
    el.reviveCostLabel.textContent = `חינם! מחזיר 2 כוחות 💛💛 (נותרו ${run.freeRevivesLeft} חינם)`;
  } else {
    const cost = 20 + run.paidRevivesUsed * 15;
    el.btnRevive.disabled = save.bankPoints < cost;
    el.reviveCostLabel.textContent = `עלות: ${cost} נקודות טובות (יש לך ${save.bankPoints})`;
  }
}

function reviveRun() {
  if (run.freeRevivesLeft > 0) {
    run.freeRevivesLeft--;
  } else {
    const cost = 20 + run.paidRevivesUsed * 15;
    if (save.bankPoints < cost) return;
    save.bankPoints -= cost;
    run.paidRevivesUsed++;
    writeSave(save);
  }

  save.bankPoints = Math.max(0, save.bankPoints - run.goodPoints);
  writeSave(save);

  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].z > -44) {
      scene.remove(obstacles[i].group);
      obstacles.splice(i, 1);
    }
  }

  if (run.timeLeft < 20) run.timeLeft += 22;
  run.hearts = 2;
  player.invincibleTimer = 2.4;
  player.y = 0;
  player.vy = 0;
  player.isJumping = false;
  player.isSliding = false;
  run.powerups.fire = Math.max(run.powerups.fire, 5);

  state = 'playing';
  el.gameoverScreen.classList.add('hidden');
  el.hud.classList.remove('hidden');
  sound.playJoyFever();
  sound.startMusic();
  particles.burst(player.x, 1.5, 0, 0xffd24c, 28, 10);
  showQuote('🔥 אין שום יאוש בעולם כלל! קיבלת 2 כוחות 💛💛 + כובע האש!', 3200);
}

function triggerVictory() {
  state = 'victory';
  sound.pauseMusic();
  sound.playVictory();
  clearTrackEntities();

  const flightBonus = 50 + (run.stage - 1) * 25;
  run.goodPoints += flightBonus;
  run.score += 1000 * run.stage;

  save.bankPoints += run.goodPoints;
  save.flightsCompleted += 1;
  if (run.score > save.bestScore) save.bestScore = Math.floor(run.score);
  writeSave(save);
  updateMenuStats();

  world.finishGroup.visible = true;
  world.finishGroup.position.z = -12;

  el.hud.classList.add('hidden');
  el.dangerVignette.classList.add('hidden');
  el.joyVignette.classList.add('hidden');
  el.sprintBanner.classList.add('hidden');
  el.quoteBanner.classList.add('hidden');
  el.victoryScreen.classList.remove('hidden');

  el.vicBonus.textContent = `+${flightBonus} ✦`;
  el.vicGoodPoints.textContent = run.goodPoints.toLocaleString('he-IL');
  el.vicScore.textContent = Math.floor(run.score).toLocaleString('he-IL');
  el.vicStage.textContent = `#${run.stage}`;

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
  updateMenuStats();

  el.hud.classList.add('hidden');
  el.pauseScreen.classList.add('hidden');
  el.gameoverScreen.classList.add('hidden');
  el.victoryScreen.classList.add('hidden');
  el.shopScreen.classList.add('hidden');
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
  if (player.slide()) {
    sound.playSlide();
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return; // Prevents accidental double-lane skips when holding a key!

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

  if (state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
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

// Touch & Mouse Drag Swipe controls
let pointerStart = null;
function onPointerStart(x, y) {
  pointerStart = { x, y };
}
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
el.btnGoHome.addEventListener('click', goHome);
el.btnRevive.addEventListener('click', reviveRun);
el.btnNextFlight.addEventListener('click', () => startNewRun(run.stage + 1, run.score));
el.btnVicHome.addEventListener('click', goHome);

// ================= MAIN UPDATE LOOP =================
function updatePlaying(dt) {
  const progress = Math.min(1, run.distance / run.targetDistance);
  const remaining = Math.max(0, run.targetDistance - run.distance);

  // Smooth, controlled, fair Subway Surfers speed curve (never erratic!)
  const targetSpeed = Math.min(
    PLAYER_CONFIG.maxSpeed,
    PLAYER_CONFIG.baseSpeed + (run.stage - 1) * 2.0 + progress * 7.2 + (run.powerups.joy > 0 ? 3.2 : 0)
  );
  run.speed += (targetSpeed - run.speed) * Math.min(1, dt * 2.2);

  const dz = run.speed * dt;
  run.distance += dz * 0.62; // ~55–65s crisp pacing for 900m Flight #1!
  run.score += dz * 0.62 * getCurrentMultiplier();
  run.timeLeft -= dt;

  if (!run.hintHidden && run.distance > 90) {
    run.hintHidden = true;
    el.controlsHint.classList.add('faded');
  }

  // Update power-up timers
  for (const key of Object.keys(run.powerups)) {
    if (run.powerups[key] > 0) {
      run.powerups[key] = Math.max(0, run.powerups[key] - dt);
    }
  }

  // Combo decay
  if (run.comboTimer > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) run.combo = 0;
  }

  sound.setIntensity(run.speed / PLAYER_CONFIG.baseSpeed, run.powerups.joy > 0);

  // Update world & check clear 3-stage transitions!
  const { zoneChanged, zone } = world.update(dt, run.speed, progress, remaining, run.powerups.joy > 0);
  if (zoneChanged) {
    sound.playPowerup();
    showQuote(zone.quote, 3800);
    spawnFloatingPopup(`✨ ${zone.name}`, 'sky');
    particles.burst(player.x, 3, -6, 0xffd24c, 18, 8);
  }

  // Final runway stretch — stop obstacles and lay out a golden Good Points carpet to the Airplane!
  if (remaining <= 105 && !run.runwayCleared) {
    run.runwayCleared = true;
    spawnGoodPointLine(1, -28, 12, 4.5, 1.1, 0, true);
  } else if (remaining > 105) {
    spawnCursor -= dz;
    if (spawnCursor <= 0) {
      spawnWave();
    }
  }

  // Advance obstacles & compute train rooftop / ramp support!
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
  if (landed) {
    particles.burst(player.x, player.groundY + 0.15, 0, 0xffe4b5, 7, 3.8);
  }
  if (bufferedJumped) {
    sound.playJump(run.powerups.wings > 0);
  }

  // Subtle footstep dust puffs
  if (!player.isJumping && !player.isSliding) {
    footstepDustTimer -= dt;
    if (footstepDustTimer <= 0) {
      footstepDustTimer = 0.16;
      particles.burst(player.x, player.y + 0.12, 0.25, run.powerups.joy > 0 ? 0xffd24c : 0xe2e8f0, 2, 2.0);
    }
  }

  // Update pursuing Meni'ot storm right behind player based on clear remaining hearts!
  meniot.update(dt, timeNow, player.x, getMeniotVisualDanger(), true);

  // Forgiving, rock-solid obstacle collision detection
  const hb = player.getHitbox();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.smashed) continue;

    // Safe if atop train roof or climbing its yellow ramp!
    if (o.roofY != null && Math.abs(hb.x - o.x) < o.halfW + 0.38) {
      if (hb.y >= o.roofY - 0.82) continue;
      if (o.hasRamp && 0 >= o.z + o.halfD - 0.35 && 0 <= o.z + o.halfD + o.rampLength + 0.35) continue;
    }

    const overlapX = Math.abs(hb.x - o.x) < hb.halfW + o.halfW - 0.28;
    const overlapZ = Math.abs(hb.z - o.z) < hb.halfD + o.halfD - 0.24;
    const overlapY = hb.y < o.maxY - 0.16 && hb.y + hb.height > o.minY + 0.16;

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

      const mult = getCurrentMultiplier();
      const basePts = c.isSuper ? 10 : 1;
      const gained = basePts * mult;
      run.goodPoints += gained;
      run.score += gained * 12;
      run.combo += 1;
      run.comboTimer = 2.8;

      sound.playGoodPoint(run.combo, c.isSuper);
      particles.burst(c.x, c.y, c.z, c.isSuper ? 0xfffbeb : 0xffd24c, c.isSuper ? 16 : 6, c.isSuper ? 7 : 4.5);

      if (c.isSuper) {
        if (run.hearts < PLAYER_CONFIG.maxHearts) {
          run.hearts++;
          spawnFloatingPopup(`✦ כתר אזמרה +${gained} • +1 💛!`, 'gold');
        } else {
          spawnFloatingPopup(`✦ כתר אזמרה +${gained}!`, 'gold');
        }
      } else if (run.combo % 15 === 0) {
        showQuote(BRESLOV_QUOTES[Math.floor(Math.random() * BRESLOV_QUOTES.length)], 2600);
        spawnFloatingPopup(`✦ רצף ×${run.combo}!`, 'gold');
      }

      if (run.powerups.joy <= 0) {
        run.joyCharge = Math.min(100, run.joyCharge + (c.isSuper ? 22 : 4.5));
        if (run.joyCharge >= 100) {
          triggerJoyFever();
        }
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

  // Check Flight Arrival Victory!
  if (run.distance >= run.targetDistance) {
    triggerVictory();
    return;
  }

  // Check Boarding Timer expiry
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
    showQuote('🔥 כובע האש! מגן ממניעה ושובר אותה!', 2600);
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
    showQuote('⚡ אור הצדיק! כפל נקודות וניקוד ×2!', 2600);
    spawnFloatingPopup('⚡ אור הצדיק ×2!', 'purple');
  }
}

function updateCamera(dt) {
  if (state === 'menu') {
    const sway = Math.sin(timeNow * 0.65) * 1.1;
    camera.position.lerp(new THREE.Vector3(sway, 2.8, 6.2), Math.min(1, dt * 4));
    camera.lookAt(0, 1.75, -8);
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

  // Rock-steady, responsive Subway Surfers chase camera
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
    meniot.update(dt, timeNow, 0, 0, false);
  } else if (state === 'playing') {
    updatePlaying(dt);
  } else if (state === 'victory') {
    player.update(dt, 0, 'victory', run.powerups, timeNow);
    meniot.update(dt, timeNow, 0, 0, false);
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

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot!
updateMenuStats();
camera.position.set(0, 2.8, 6.2);
camera.lookAt(0, 1.75, -8);

const previewParam = new URLSearchParams(window.location.search).get('preview');
if (previewParam === 'bridge') {
  startNewRun(1, 0);
  run.distance = run.targetDistance * 0.42;
  run.hearts = 2;
} else if (previewParam === 'airport') {
  startNewRun(1, 0);
  run.distance = run.targetDistance - 95;
  run.hearts = 1;
} else if (previewParam === 'victory') {
  startNewRun(1, 0);
  run.distance = run.targetDistance;
  triggerVictory();
}

requestAnimationFrame(animate);
