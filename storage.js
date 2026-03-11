/**
 * storage.js — LocalStorage utilities for Ramadhan Tracker
 *
 * Date keys are YYYY-MM-DD (Gregorian). After Maghrib (sunset), the active
 * key advances to the next Gregorian day — the Islamic night already belongs
 * to the following day.  All times are UTC+8 (Malaysia Time / MYT).
 * Kuala Lumpur coordinates: lat 3.1390°N, lon 101.6869°E
 */

const KL_LAT = 3.139;
const KL_LON = 101.6869;
const MYT_OFFSET_MS = 8 * 3600 * 1000;

/**
 * Returns a Date object whose local accessors (getHours, getDate, …) reflect
 * the current time in MYT (UTC+8), regardless of the user's system timezone.
 */
function getMYTDate() {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + MYT_OFFSET_MS);
}

/**
 * Formats a MYT Date object to a YYYY-MM-DD key.
 * @param {Date} d
 * @returns {string}
 */
function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calculates approximate Maghrib (sunset) time in decimal MYT hours for
 * Kuala Lumpur using the USNO solar position algorithm.
 * e.g. returns 19.37 for 7:22 PM MYT.
 * @param {number} year
 * @param {number} month  1-based
 * @param {number} day
 * @returns {number}
 */
function getSunsetMYT(year, month, day) {
  const N1 = Math.floor(275 * month / 9);
  const N2 = Math.floor((month + 9) / 12);
  const N3 = 1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3);
  const N = N1 - N2 * N3 + day - 30;

  const lngHour = KL_LON / 15;
  const t = N + (18 - lngHour) / 24;

  const M = 0.9856 * t - 3.289;
  const Mrad = (M * Math.PI) / 180;
  let L = M + 1.916 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 282.634;
  L = ((L % 360) + 360) % 360;

  let RA = (Math.atan(0.91764 * Math.tan((L * Math.PI) / 180)) * 180) / Math.PI;
  RA = ((RA % 360) + 360) % 360;
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;

  const sinDec = 0.39782 * Math.sin((L * Math.PI) / 180);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos((90.8333 * Math.PI) / 180) - sinDec * Math.sin((KL_LAT * Math.PI) / 180)) /
    (cosDec * Math.cos((KL_LAT * Math.PI) / 180));

  if (cosH > 1 || cosH < -1) return 19.33; // fallback ~7:20 PM

  const H = (360 - (Math.acos(cosH) * 180) / Math.PI) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = ((T - lngHour) % 24 + 24) % 24;
  return UT + 8; // UTC → MYT
}

/**
 * Returns today's active date key (YYYY-MM-DD, MYT, Maghrib-aware).
 * After sunset, the Islamic night already belongs to the next Gregorian day,
 * so the key advances by one day after Maghrib.
 * @returns {string}
 */
export function getTodayKey() {
  const myt = getMYTDate();
  const y = myt.getFullYear();
  const mo = myt.getMonth() + 1;
  const d = myt.getDate();
  const nowHour = myt.getHours() + myt.getMinutes() / 60;
  if (nowHour >= getSunsetMYT(y, mo, d)) {
    const tomorrow = new Date(myt);
    tomorrow.setDate(d + 1);
    return formatDateKey(tomorrow);
  }
  return formatDateKey(myt);
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
 * Calculates the current streak: consecutive days (MYT, Maghrib-aware)
 * where at least one item was completed.
 * @returns {number}
 */
export function calculateStreak() {
  const todayKey = getTodayKey();
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayHasActivity = Object.values(getDateData(todayKey)).some(Boolean);
  const startOffset = todayHasActivity ? 0 : 1;
  let streak = 0;

  for (let i = startOffset; i < MAX_STREAK_DAYS; i++) {
    const d = new Date(ty, tm - 1, td - i);
    if (Object.values(getDateData(formatDateKey(d))).some(Boolean)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
