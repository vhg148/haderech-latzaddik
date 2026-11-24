import { SHOP_UPGRADES, CHARACTERS } from './config.js';

const STORAGE_KEY = 'haderech_latzaddik_save_v2';

const DEFAULT_SAVE = {
  selectedCharacter: 'ari',
  bankPoints: 0,
  bestScore: 0,
  flightsCompleted: 0,
  upgrades: {
    fireDuration: 0,
    magnetDuration: 0,
    wingsDuration: 0,
    doubleDuration: 0,
    pointBonus: 0,
  },
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('haderech_latzaddik_save_v1');
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw);
    const validChar = CHARACTERS.some((c) => c.id === parsed.selectedCharacter)
      ? parsed.selectedCharacter
      : 'ari';
    return {
      ...DEFAULT_SAVE,
      ...parsed,
      selectedCharacter: validChar,
      upgrades: {
        ...DEFAULT_SAVE.upgrades,
        ...(parsed.upgrades || {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota issues
  }
}

export function getUpgradeValue(save, id) {
  const def = SHOP_UPGRADES.find((u) => u.id === id);
  if (!def) return 0;
  const lvl = save.upgrades[id] || 0;
  return def.baseVal + lvl * def.valStep;
}

export function getUpgradeCost(save, id) {
  const def = SHOP_UPGRADES.find((u) => u.id === id);
  if (!def) return Infinity;
  const lvl = save.upgrades[id] || 0;
  if (lvl >= def.maxLevel) return null;
  return def.baseCost + lvl * def.costStep;
}
