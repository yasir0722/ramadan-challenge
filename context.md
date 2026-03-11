# Ramadhan Checklist Tracker — System Specification

---

## 1. App Overview

Ramadhan Checklist Tracker is a lightweight Progressive Web App (PWA) that helps Muslims track their nightly worship activities during the holy month of Ramadhan. Users can tick off activities each night, view their streaks, review and edit past days, and share their progress with others — all without requiring an internet connection after the initial load.

---

## 2. Goals of the App

- Help users build consistent worship habits during Ramadhan
- Provide a simple, distraction-free checklist experience
- Work fully offline after first load (PWA)
- Require no backend, no database, and no user account
- Be installable on mobile devices (Android & iOS)
- Be easily deployable to GitHub Pages at zero cost

---

## 3. Technology Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| UI Framework  | Vue 3 (Composition API, CDN build)      |
| Bundler       | None (static files, CDN-based Vue 3)    |
| Styling       | TailwindCSS (CDN)                       |
| PWA           | Custom service-worker.js + manifest.json|
| Data Storage  | Browser LocalStorage                    |
| Data Source   | checklist.csv (fetched at runtime)      |
| Deployment    | GitHub Pages (static site)              |

Vue 3 is loaded via CDN (`vue.esm-browser.js`) so the app runs as plain static files with no build step required.

---

## 4. Data Storage Approach

All user data is persisted in the browser's **LocalStorage** using date-keyed JSON objects.

- **Key format:** `YYYY-MM-DD` (e.g. `2026-03-11`)
- **Value format:** JSON object mapping checklist item IDs to booleans

### Example LocalStorage entry

```json
{
  "2026-03-11": {
    "terawih8": true,
    "witir": true,
    "tahajud": false,
    "3qul": true
  }
}
```

Each date key is stored independently. No expiration or server sync occurs.

---

## 5. File Architecture

```
/
├── index.html          # Main UI layout (Vue template + PWA boilerplate)
├── app.js              # Main application logic (Vue 3 Composition API)
├── storage.js          # LocalStorage read/write and streak calculation
├── checklist.csv       # Checklist items data source (id,name pairs)
├── manifest.json       # PWA install configuration
├── service-worker.js   # Offline caching via Cache API
├── icon.svg            # App icon for PWA
└── context.md          # This file — system documentation and specification
```

---

## 6. Data Structure

### checklist.csv

```csv
id,name
terawih8,Terawih 8 Rakaat
terawih20,Terawih 20 Rakaat
witir,Witir
3qul,3 Qul
tahajud,Qiam Tahajud
hajat,Qiam Hajat
taubat,Qiam Taubat
```

### LocalStorage (runtime)

```
localStorage["2026-03-11"] = '{"terawih8":true,"witir":true,...}'
localStorage["2026-03-10"] = '{"terawih8":true,"witir":true,"3qul":true,...}'
```

### Vue reactive state (app.js)

| Variable        | Type                | Description                           |
|-----------------|---------------------|---------------------------------------|
| `items`         | `Ref<Array>`        | Parsed checklist items from CSV       |
| `todayKey`      | `Ref<string>`       | Current date in YYYY-MM-DD format     |
| `todayData`     | `Ref<Object>`       | Today's checked items `{id: bool}`    |
| `selectedDate`  | `Ref<string>`       | Date selected in history picker       |
| `selectedData`  | `Ref<Object>`       | Checked items for selected date       |
| `streak`        | `Ref<number>`       | Current consecutive-day streak count  |
| `shareStatus`   | `Ref<string>`       | Feedback message after sharing        |

---

## 7. Feature List

| Feature              | Description                                                               |
|----------------------|---------------------------------------------------------------------------|
| Daily Checklist      | Tap to toggle worship activities for today                                |
| Progress Bar         | Shows `X / Y completed` with a visual bar                                 |
| Daily Reset          | Checklist automatically reflects current date; new day = fresh checklist  |
| Streak Counter       | Counts consecutive days with ≥1 activity completed (🔥)                   |
| Edit Previous Day    | Date picker lets users view and toggle items for any past date            |
| Share Result         | Copies/shares a formatted summary via Web Share API or clipboard          |
| Offline Support      | Service worker caches all assets for full offline use                     |
| PWA Install          | manifest.json enables "Add to Home Screen" on mobile                      |

---

## 8. UI Sections

### Header
- App title: `🌙 Ramadhan Tracker`

### Streak Card
- Displays: `🔥 Streak: N days`
- Updated live as user ticks activities

### Today Card
- Current date (formatted)
- Progress bar (`X / Y completed`)
- Scrollable checklist with tap-to-toggle items
- Checked items shown with strikethrough style

### Share Button
- Full-width button below Today Card
- Triggers Web Share API (mobile) or clipboard copy (desktop)
- Shows brief feedback (`✓ Shared!` / `✓ Copied!`)

### History Card
- `<input type="date">` picker (max = today)
- When a past date is selected: shows its checklist with toggle support
- Editing past dates updates LocalStorage and recalculates streak

---

## 9. User Flow

```
Open App
  └─> Load checklist.csv
  └─> Read today's LocalStorage entry
  └─> Display today's checklist + progress
  └─> Show streak count

User taps a checklist item
  └─> Toggle item state
  └─> Persist to LocalStorage
  └─> Update progress bar + streak

User taps Share
  └─> Build text summary
  └─> Try Web Share API → fallback to Clipboard
  └─> Show confirmation

User opens History Card
  └─> Select a past date
  └─> Load that date's LocalStorage entry
  └─> Display and allow edits
  └─> Save changes + recalculate streak

New day arrives (midnight)
  └─> Interval check detects new date
  └─> Reset todayKey, reload today's data (empty)
```

---

## 10. Offline Strategy

The service worker uses a **Cache-First** strategy:

1. On `install`: pre-cache all core assets
2. On `fetch`: serve from cache if available, else fetch from network
3. On `activate`: delete old cache versions

### Cached assets

```
./
./index.html
./app.js
./storage.js
./checklist.csv
./manifest.json
./icon.svg
```

The app functions fully offline after the first successful load. LocalStorage is always available offline.

---

## 11. Deployment Method

The app is deployed as a **static site on GitHub Pages**.

### Steps

1. Push all files to the `main` branch (or `gh-pages` branch)
2. Enable GitHub Pages in repository Settings → Pages
3. Set source to the branch root (`/`)
4. Access at: `https://<username>.github.io/<repo-name>/`

### Notes

- No build step required — all files are plain HTML/JS
- Service worker scope is relative to deployment path
- All asset paths use `./` relative references for portability
- No server-side code or API calls are made at runtime
