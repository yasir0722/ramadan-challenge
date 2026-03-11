/**
 * app.js — Main application logic for Ramadhan Tracker
 *
 * Uses Vue 3 Composition API (CDN build).
 * Parses checklist.csv at runtime and manages all reactive state.
 */

import {
  createApp,
  ref,
  computed,
  onMounted,
  watch,
} from './vue.esm-browser.js';

import {
  getTodayKey,
  getDateData,
  setDateData,
  calculateStreak,
} from './storage.js';

/**
 * Parses a simple two-column CSV (id,name) into an array of objects.
 * Handles both LF and CRLF line endings.
 * @param {string} text - Raw CSV text
 * @returns {Array<{id: string, name: string}>}
 */
function parseCSV(text) {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(',');
      return headers.reduce((obj, header, i) => {
        obj[header] = (values[i] || '').trim();
        return obj;
      }, {});
    })
    .filter((item) => item.id && item.name);
}

/**
 * Formats a date key to a Hijri (Islamic) date string using the
 * Umm al-Qura calendar, anchored to Kuala Lumpur timezone.
 * @param {string} dateKey - YYYY-MM-DD
 * @returns {string}
 */
function getHijriDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kuala_Lumpur',
    });
    const parts = fmt.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('day')} ${get('month')} ${get('year')} AH`;
  } catch {
    return '';
  }
}

createApp({
  setup() {
    const items = ref([]);
    const todayKey = ref(getTodayKey());
    const todayData = ref({});
    const selectedDate = ref(getTodayKey());
    const selectedData = ref({});
    const streak = ref(0);
    const shareStatus = ref('');
    const isLoading = ref(true);

    /* ── Data loading ────────────────────────────────────────────── */

    async function loadItems() {
      try {
        const res = await fetch('./checklist.csv');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        items.value = parseCSV(text);
      } catch (e) {
        console.error('Failed to load checklist.csv:', e);
        items.value = [];
      }
    }

    function loadTodayData() {
      todayData.value = { ...getDateData(todayKey.value) };
    }

    function loadSelectedData() {
      selectedData.value = { ...getDateData(selectedDate.value) };
    }

    function refreshStreak() {
      streak.value = calculateStreak();
    }

    /* ── Daily reset check ───────────────────────────────────────── */

    function checkDateReset() {
      const current = getTodayKey();
      if (current !== todayKey.value) {
        todayKey.value = current;
        selectedDate.value = current;
        loadTodayData();
        loadSelectedData();
        refreshStreak();
      }
    }

    /* ── Checklist toggles ───────────────────────────────────────── */

    function toggleTodayItem(id) {
      todayData.value = { ...todayData.value, [id]: !todayData.value[id] };
      setDateData(todayKey.value, todayData.value);
      // Keep selected in sync when viewing today
      if (selectedDate.value === todayKey.value) {
        selectedData.value = { ...todayData.value };
      }
      refreshStreak();
    }

    function toggleSelectedItem(id) {
      selectedData.value = { ...selectedData.value, [id]: !selectedData.value[id] };
      setDateData(selectedDate.value, selectedData.value);
      // Keep today in sync when selected date is today
      if (selectedDate.value === todayKey.value) {
        todayData.value = { ...selectedData.value };
      }
      refreshStreak();
    }

    /* ── Computed ────────────────────────────────────────────────── */

    const totalItems = computed(() => items.value.length);

    const todayCompleted = computed(
      () => items.value.filter((item) => todayData.value[item.id]).length,
    );

    const progressPercent = computed(() =>
      totalItems.value > 0
        ? Math.round((todayCompleted.value / totalItems.value) * 100)
        : 0,
    );

    const selectedCompleted = computed(
      () => items.value.filter((item) => selectedData.value[item.id]).length,
    );

    const isViewingToday = computed(() => selectedDate.value === todayKey.value);

    const hijriDate = computed(() => getHijriDate(todayKey.value));
    const generalItems = computed(() => items.value.filter((item) => item.type === 'general'));
    const nightItems = computed(() => items.value.filter((item) => item.type === 'night'));

    /* ── Helpers ─────────────────────────────────────────────────── */

    function formatDate(dateKey) {
      const [year, month, day] = dateKey.split('-').map(Number);
      // Use local date constructor (year, monthIndex, day) to avoid UTC offset issues
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-MY', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    /* ── Share ───────────────────────────────────────────────────── */

    async function share() {
      const completedNames = items.value
        .filter((item) => todayData.value[item.id])
        .map((item) => `${item.name} ✓`);

      const text = [
        '🌙 Ramadhan Tracker',
        hijriDate.value ? `📅 ${hijriDate.value}` : '',
        '',
        `Today: ${todayCompleted.value} / ${totalItems.value} completed`,
        `🔥 Streak: ${streak.value} days`,
        '',
        ...completedNames,
        '',
        'Track yours 👉 https://yasir0722.github.io/ramadan-challenge/',
      ].filter(Boolean).join('\n');

      try {
        if (navigator.share) {
          await navigator.share({ title: '🌙 Ramadhan Tracker', text });
          shareStatus.value = '✓ Shared!';
        } else {
          await navigator.clipboard.writeText(text);
          shareStatus.value = '✓ Copied!';
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          try {
            await navigator.clipboard.writeText(text);
            shareStatus.value = '✓ Copied!';
          } catch {
            shareStatus.value = 'Failed to share';
          }
        }
      }

      setTimeout(() => {
        shareStatus.value = '';
      }, 2500);
    }

    /* ── Lifecycle ───────────────────────────────────────────────── */

    watch(selectedDate, loadSelectedData);

    onMounted(async () => {
      await loadItems();
      loadTodayData();
      loadSelectedData();
      refreshStreak();
      isLoading.value = false;
      // Poll every minute for midnight date rollover.
      // The interval is intentionally not cleared — this single-page app
      // is never unmounted in normal use.
      setInterval(checkDateReset, 60_000);
    });

    return {
      items,
      todayKey,
      todayData,
      selectedDate,
      selectedData,
      streak,
      shareStatus,
      isLoading,
      totalItems,
      todayCompleted,
      progressPercent,
      selectedCompleted,
      isViewingToday,
      hijriDate,
      generalItems,
      nightItems,
      formatDate,
      toggleTodayItem,
      toggleSelectedItem,
      share,
    };
  },
}).mount('#app');
