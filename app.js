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

// Ramadan 1447 AH starts 1 March 2026 (Malaysia official)
const RAMADAN_1447_START = new Date(2026, 2, 1);

function getHijriDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date - RAMADAN_1447_START) / 86400000);
  if (diff >= 0 && diff < 30) return `${diff + 1} Ramadan 1447 AH`;
  return '';
}

const ZIKIR_LIST = [
  {
    id: 'niat_puasa',
    title: 'Niat Puasa Ramadhan',
    arabic: 'نَوَيْتُ صَوْمَ غَدٍ عَنْ أَدَاءِ فَرْضِ شَهْرِ رَمَضَانَ هَذِهِ السَّنَةِ لِلَّهِ تَعَالَى',
    transliteration: "Nawaitu sauma ghadin 'an ada'i fardhi shahri Ramadhana hadzihis sanati lillahi ta'ala",
    meaning: "Aku niat berpuasa esok hari untuk menunaikan fardhu Ramadhan tahun ini kerana Allah Ta'ala.",
  },
  {
    id: 'buka_puasa',
    title: 'Doa Berbuka Puasa',
    arabic: 'اللَّهُمَّ إِنِّي لَكَ صُمْتُ وَبِكَ آمَنْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ',
    transliteration: "Allahumma inni laka sumtu wa bika aamantu wa 'ala rizqika aftartu",
    meaning: 'Ya Allah, untuk-Mu aku berpuasa, kepada-Mu aku beriman, dan dengan rezeki-Mu aku berbuka.',
  },
  {
    id: 'lailatul_qadar',
    title: 'Doa Lailatul Qadar',
    arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
    transliteration: "Allahumma innaka 'afuwwun tuhibbul 'afwa fa'fu 'anni",
    meaning: 'Ya Allah, sesungguhnya Engkau Maha Pemaaf, Engkau menyukai kemaafan, maka maafkanlah aku.',
  },
  {
    id: 'sayyidul_istighfar',
    title: 'Sayyidul Istighfar',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    transliteration: "Allahumma anta rabbi la ilaha illa anta khalaqtani wa ana 'abduka wa ana 'ala 'ahdika wa wa'dika mastata'tu, a'udhu bika min sharri ma sana'tu, abuu laka bini'matika 'alayya wa abuu laka bidhanbi faghfir li, fa innahu la yaghfirudh-dhunuba illa anta",
    meaning: "Ya Allah, Engkau Tuhanku, tiada tuhan selain Engkau. Engkau menciptakanku dan aku hamba-Mu. Aku berada di atas perjanjian-Mu semampu aku. Aku berlindung dari kejahatan perbuatanku. Aku mengakui nikmat-Mu dan mengakui dosaku. Maka ampunilah aku, tiada yang mengampuni dosa kecuali Engkau.",
  },
  {
    id: 'tasbih',
    title: 'Zikir Pagi & Petang',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'Subhanallahi wa bihamdih (100×)',
    meaning: 'Maha Suci Allah dan segala puji bagi-Nya. Dibaca 100 kali pagi dan petang.',
  },
];

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
    const sectionExpanded = ref({ general: true, night: true, zikir: false });
    const expandedZikir = ref({});
    const deferredInstall = ref(null);
    const showInstallModal = ref(false);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || !!window.navigator.standalone;

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

    /* ── Section & Zikir expand ──────────────────────────────────── */

    function toggleSection(name) {
      sectionExpanded.value = { ...sectionExpanded.value, [name]: !sectionExpanded.value[name] };
    }

    function toggleZikir(id) {
      expandedZikir.value = { ...expandedZikir.value, [id]: !expandedZikir.value[id] };
    }

    /* ── Quantity ────────────────────────────────────────────────── */

    function getQty(data, id) {
      return data[id + '_qty'] || 0;
    }

    function setTodayQty(id, val) {
      const qty = Math.max(0, parseInt(val) || 0);
      const updated = { ...todayData.value, [id + '_qty']: qty };
      if (qty > 0) updated[id] = true;
      todayData.value = updated;
      setDateData(todayKey.value, updated);
      if (selectedDate.value === todayKey.value) selectedData.value = { ...updated };
      refreshStreak();
    }

    function setSelectedQty(id, val) {
      const qty = Math.max(0, parseInt(val) || 0);
      const updated = { ...selectedData.value, [id + '_qty']: qty };
      if (qty > 0) updated[id] = true;
      selectedData.value = updated;
      setDateData(selectedDate.value, updated);
      if (selectedDate.value === todayKey.value) todayData.value = { ...updated };
      refreshStreak();
    }

    /* ── PWA Install ─────────────────────────────────────────────── */

    function installPWA() {
      if (deferredInstall.value) {
        deferredInstall.value.prompt();
        deferredInstall.value.userChoice.then(() => {
          deferredInstall.value = null;
          showInstallModal.value = false;
        });
      } else {
        showInstallModal.value = false;
      }
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
        .map((item) => {
          if (item.unit) {
            const qty = getQty(todayData.value, item.id);
            return qty > 0 ? `${item.name}: ${qty} ${item.unit} ✓` : `${item.name} ✓`;
          }
          return `${item.name} ✓`;
        });

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
      setInterval(checkDateReset, 60_000);
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstall.value = e;
      });
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
      sectionExpanded,
      expandedZikir,
      zikirList: ZIKIR_LIST,
      deferredInstall,
      showInstallModal,
      isIOS,
      isStandalone,
      formatDate,
      toggleSection,
      toggleZikir,
      toggleTodayItem,
      toggleSelectedItem,
      setTodayQty,
      setSelectedQty,
      getQty,
      share,
      installPWA,
    };
  },
}).mount('#app');
