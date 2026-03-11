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

// Ramadan 1447 AH starts 2 March 2026 (Malaysia official)
const RAMADAN_1447_START = new Date(2026, 2, 2);

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
    meaning: "Aku niat berpuasa esok hari untuk menunaikan fardhu Ramadhan tahun ini kerana Allah Ta'ala.",
  },
  {
    id: 'buka_puasa',
    title: 'Doa Berbuka Puasa',
    arabic: 'اللهم لك صمت وعلى رزقك أفطرت',
    meaning: 'Ya Allah, untuk-Mu aku berpuasa dan dengan rezeki-Mu aku berbuka.',
  },
  {
    id: 'lailatul_qadar',
    title: 'Doa Lailatul Qadar',
    arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
    meaning: 'Ya Allah, sesungguhnya Engkau Maha Pemaaf, Engkau menyukai kemaafan, maka maafkanlah aku.',
  },
  {
    id: 'sayyidul_istighfar',
    title: 'Sayyidul Istighfar',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    meaning: "Ya Allah Engkau Tuhanku, tiada tuhan selain Engkau. Engkau menciptakanku dan aku hamba-Mu. Aku berada di atas perjanjian-Mu semampu aku. Aku berlindung dari kejahatan perbuatanku. Aku mengakui nikmat-Mu dan mengakui dosaku. Maka ampunilah aku, tiada yang mengampuni dosa kecuali Engkau.",
  },
  {
    id: 'subhanallah',
    title: 'Subhanallah × 100',
    arabic: 'سُبْحَانَ اللهِ',
    meaning: 'Maha Suci Allah. Dibaca 100 kali.',
    target: 100,
  },
  {
    id: 'alhamdulillah',
    title: 'Alhamdulillah × 100',
    arabic: 'الْحَمْدُ لِلهِ',
    meaning: 'Segala puji bagi Allah. Dibaca 100 kali.',
    target: 100,
  },
  {
    id: 'allahuakbar',
    title: 'Allahu Akbar × 100',
    arabic: 'اللهُ أَكْبَرُ',
    meaning: 'Allah Maha Besar. Dibaca 100 kali.',
    target: 100,
  },
  {
    id: 'astaghfirullah',
    title: 'Astaghfirullah × 100',
    arabic: 'أَسْتَغْفِرُ اللهَ',
    meaning: 'Aku memohon ampun kepada Allah. Dibaca 100 kali.',
    target: 100,
  },
  {
    id: 'tasbih_azim',
    title: 'Tasbih Agung',
    arabic: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ سُبْحَانَ اللهِ الْعَظِيمِ',
    meaning: 'Maha Suci Allah dan segala puji bagi-Nya, Maha Suci Allah Yang Maha Agung.',
  },
  {
    id: 'selawat',
    title: 'Selawat × 100',
    arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ',
    meaning: 'Ya Allah, cucurkanlah rahmat ke atas Nabi Muhammad. Dibaca 100 kali.',
    target: 100,
  },
  {
    id: 'rabbana_atina',
    title: 'Rabbana Atina',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    meaning: 'Ya Tuhan kami, berikanlah kami kebaikan di dunia dan kebaikan di akhirat, dan peliharalah kami dari azab neraka.',
  },
  {
    id: 'doa_yunus',
    title: 'Doa Nabi Yunus',
    arabic: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    meaning: 'Tiada tuhan melainkan Engkau, Maha Suci Engkau, sesungguhnya aku adalah termasuk orang-orang yang zalim.',
  },
];

createApp({
  setup() {
    const items = ref([]);
    const todayKey = ref(getTodayKey());
    const activeDate = ref(getTodayKey()); // single active date — today by default
    const activeData = ref({});
    const streak = ref(0);
    const shareStatus = ref('');
    const isLoading = ref(true);
    const sectionExpanded = ref({ general: true, night: true, zikir: false });
    const expandedZikir = ref({});
    const deferredInstall = ref(null);
    const showInstallModal = ref(false);
    const showDonateModal = ref(false);
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

    function loadActiveData() {
      activeData.value = { ...getDateData(activeDate.value) };
    }

    function refreshStreak() {
      streak.value = calculateStreak();
    }

    /* ── Daily reset check ───────────────────────────────────────── */

    function checkDateReset() {
      const current = getTodayKey();
      if (current !== todayKey.value) {
        todayKey.value = current;
        // If user was viewing today, advance them to new today
        if (activeDate.value === todayKey.value) activeDate.value = current;
        loadActiveData();
        refreshStreak();
      }
    }

    /* ── Date navigation ─────────────────────────────────────────── */

    function prevDay() {
      const [y, m, d] = activeDate.value.split('-').map(Number);
      const prev = new Date(y, m - 1, d - 1);
      const key = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
      activeDate.value = key;
    }

    function nextDay() {
      if (activeDate.value >= todayKey.value) return;
      const [y, m, d] = activeDate.value.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      const key = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
      activeDate.value = key;
    }

    /* ── Checklist toggles ───────────────────────────────────────── */

    function toggleActiveItem(id) {
      const newVal = !activeData.value[id];
      const updated = { ...activeData.value, [id]: newVal };
      if (id === 'terawih8' && newVal) updated.terawih20 = false;
      if (id === 'terawih20' && newVal) updated.terawih8 = false;
      activeData.value = updated;
      setDateData(activeDate.value, updated);
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

    function setActiveQty(id, val) {
      const qty = Math.max(0, parseInt(val) || 0);
      const updated = { ...activeData.value, [id + '_qty']: qty };
      const zikirEntry = ZIKIR_LIST.find(z => z.id === id);
      if (zikirEntry && zikirEntry.target) {
        // auto-check when count reaches target
        updated[id] = qty >= zikirEntry.target;
      } else if (qty > 0) {
        updated[id] = true;
      }
      activeData.value = updated;
      setDateData(activeDate.value, updated);
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

    // Terawih 8 & 20 are mutually exclusive — count as one slot
    const totalItems = computed(() => {
      const hasTerawihPair = items.value.some(i => i.id === 'terawih8')
        && items.value.some(i => i.id === 'terawih20');
      return hasTerawihPair ? items.value.length - 1 : items.value.length;
    });

    const activeCompleted = computed(() => {
      let count = 0;
      let terawihCounted = false;
      for (const item of items.value) {
        if (item.id === 'terawih8' || item.id === 'terawih20') {
          if (!terawihCounted) {
            terawihCounted = true;
            if (activeData.value.terawih8 || activeData.value.terawih20) count++;
          }
        } else if (activeData.value[item.id]) {
          count++;
        }
      }
      return count;
    });

    const progressPercent = computed(() =>
      totalItems.value > 0
        ? Math.round((activeCompleted.value / totalItems.value) * 100)
        : 0,
    );

    const isViewingToday = computed(() => activeDate.value === todayKey.value);
    const isAtFirstDay = computed(() => {
      // Don't allow going before 1 Ramadan 1447 = 2 Mar 2026 (Malaysia)
      return activeDate.value <= '2026-03-02';
    });

    const hijriDate = computed(() => getHijriDate(activeDate.value));
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

    function formatDateShort(dateKey) {
      const [y, m, d] = dateKey.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-MY', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    }

    function formatDateDay(dateKey) {
      const [y, m, d] = dateKey.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-MY', { weekday: 'long' });
    }

    /* ── Share ───────────────────────────────────────────────────── */

    async function share() {
      const completedNames = items.value
        .filter((item) => activeData.value[item.id])
        .map((item) => {
          if (item.unit) {
            const qty = getQty(activeData.value, item.id);
            return qty > 0 ? `${item.name}: ${qty} ${item.unit} ✓` : `${item.name} ✓`;
          }
          return `${item.name} ✓`;
        });

      const text = [
        '🌙 Ramadhan Tracker',
        hijriDate.value ? `📅 ${hijriDate.value}` : '',
        '',
        `${isViewingToday.value ? 'Today' : formatDate(activeDate.value)}: ${activeCompleted.value} / ${totalItems.value} completed`,
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

    watch(activeDate, loadActiveData);

    onMounted(async () => {
      await loadItems();
      loadActiveData();
      refreshStreak();
      isLoading.value = false;
      setInterval(checkDateReset, 60_000);
      // Pick up prompt captured before Vue mounted
      if (window.__deferredInstall) deferredInstall.value = window.__deferredInstall;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstall.value = e;
        window.__deferredInstall = e;
      });
    });

    return {
      items,
      todayKey,
      activeDate,
      activeData,
      streak,
      shareStatus,
      isLoading,
      totalItems,
      activeCompleted,
      progressPercent,
      isViewingToday,
      isAtFirstDay,
      hijriDate,
      generalItems,
      nightItems,
      sectionExpanded,
      expandedZikir,
      zikirList: ZIKIR_LIST,
      deferredInstall,
      showInstallModal,
      showDonateModal,
      isIOS,
      isStandalone,
      formatDate,
      formatDateShort,
      formatDateDay,
      toggleSection,
      toggleZikir,
      toggleActiveItem,
      setActiveQty,
      getQty,
      prevDay,
      nextDay,
      share,
      installPWA,
    };
  },
}).mount('#app');
