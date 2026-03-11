/**
 * storage.js — LocalStorage utilities for Ramadhan Tracker
 *
 * Date keys are stored as YYYY-MM-DD strings.
 * Each date maps to an object of { [itemId]: boolean }.
 */

/**
 * Returns today's date key in YYYY-MM-DD format using local time.
 * @returns {string}
 */
export function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retrieves checklist data for a given date.
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @returns {Object} - Map of { itemId: boolean }
 */
export function getDateData(dateKey) {
  try {
    const raw = localStorage.getItem(dateKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persists checklist data for a given date.
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Object} data - Map of { itemId: boolean }
 */
export function setDateData(dateKey, data) {
  try {
    localStorage.setItem(dateKey, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to LocalStorage:', e);
  }
}

const MAX_STREAK_DAYS = 365;

/**
 * Calculates the current streak: the number of consecutive past days
 * (including today if it has activity) where at least one item was completed.
 * @returns {number}
 */
export function calculateStreak() {
  const today = new Date();
  let streak = 0;

  // Start from today; if today has no activity, start from yesterday
  const todayKey = getTodayKey();
  const todayData = getDateData(todayKey);
  const todayHasActivity = Object.values(todayData).some(Boolean);
  const startOffset = todayHasActivity ? 0 : 1;

  for (let i = startOffset; i < MAX_STREAK_DAYS; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    const data = getDateData(key);
    const hasActivity = Object.values(data).some(Boolean);

    if (hasActivity) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
