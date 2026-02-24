# Mobile-Style Bottom Sheet

A mobile app–style bottom sheet built with **HTML, CSS, and jQuery only** — no build step, no framework. Open `index.html` directly in a browser.

**Live repo:** https://github.com/wenpenglee/mobile-style-bottom-sheet

---

## Features

- Three snap positions driven by viewport thirds (1/3 · 2/3 · full screen)
- Drag handle with velocity-biased snap and rubber-band resistance
- Smooth backdrop that dims the page at peek/half, stays visible at full
- Rounded top corners preserved at all snap positions
- PDF displayed in a native browser `<iframe>`
- Floating **Last Page** button — replaces the iframe with a fresh one at `#page=9999`
- Loading spinner + error fallback state
- Keyboard (`Escape`) and backdrop-tap dismiss
- Zero dependencies beyond jQuery 3

---

## File Structure

```
index.html          HTML markup only — no inline style or script
styles.css          All visual styles
js/
  service.js        Business logic (snap state, drag physics, PDF rendering)
  control.js        DOM binding (element refs + event listeners)
```

---

## Architecture

The JavaScript is split into two layers that communicate in one direction only:

```
control.js  ──calls──▶  BottomSheetService (service.js)
               (DOM events)        (state + logic)
```

### `service.js` — `BottomSheetService`

An IIFE module. DOM elements are injected once via `init(els)` so the service itself contains no `$('#...')` queries.

| Responsibility | Functions |
|---|---|
| Lifecycle | `open(snap)`, `close()`, `isOpen()` |
| Snap state | `applySnap(snap)`, `getSnapTranslate(snap)`, `updateDots(snap)` |
| Drag physics | `onDragStart(y)`, `onDragMove(y)`, `onDragEnd()` |
| PDF loading | `loadPdf()` — uses PDF.js, renders pages to `<canvas>` |
| PDF navigation | `goToLastPage()` — scrolls canvas wrap to `scrollHeight` |

**Snap positions** (all based on `window.innerHeight`):

| Class | `translateY` | Visible area |
|---|---|---|
| `snap-peek` | `vh × 2/3` | 1/3 of screen |
| `snap-half` | `vh × 1/3` | 2/3 of screen |
| `snap-full` | `0` | Full screen |
| *(hidden)* | `100dvh` | None |

**Drag dismiss** triggers when `translateY > vh × 0.80` or flick velocity `> 18 px/frame`.

### `control.js`

Runs inside `$(function(){})`. Selects all DOM refs, calls `BottomSheetService.init(els)`, then wires events:

- `pointerdown/move/up/cancel` on the handle and canvas wrap → drag methods
- Canvas wrap drag only fires when `scrollTop === 0` (avoids fighting with PDF scroll)
- Snap dot clicks, open/close/lastPage button clicks, backdrop click, `Escape` key

---

## PDF Display & Navigation

The PDF is loaded in a native browser `<iframe>`. The iframe `src` is set by JS on first open (not in HTML) to avoid an early network request.

**Why replace the element for Last Page instead of changing `.src`?**

Changing only the hash of an already-loaded URL (e.g. `file.pdf` → `file.pdf#page=9999`) is treated by browsers as a *same-document hash change* — the PDF viewer never re-reads the fragment. Replacing the entire `<iframe>` element forces a genuine fresh navigation, so the viewer picks up `#page=9999` on load and jumps to the last page.

```js
// _loadFrameSrc() in service.js
var $newFrame = $('<iframe>', { src: PDF_URL + '#page=9999', ... });
$frame.replaceWith($newFrame);   // true fresh navigation
$frame = $newFrame;              // keep module ref in sync
```

- All major browsers (Chrome, Firefox, Safari) clamp `#page=9999` to the actual last page.
- Error state appears after 15 s if the iframe fails to load.

---

## Key CSS Notes

- `.bottom-sheet` is always `height: 100dvh` — snap positions are pure `translateY` offsets
- `touch-action: none` on the sheet prevents browser scroll interference during drag
- `.pdf-canvas-wrap` is `position: absolute; inset: 0; overflow-y: auto` — sits beneath the loader/error overlays (`z-index: 2`) and the FAB (`z-index: 3`)
- Backdrop `opacity` transitions independently via its own CSS class (`.visible`)

---

## Adding a New PDF

Change `PDF_URL` at the top of `js/service.js`:

```js
const PDF_URL = 'https://your-domain.com/path/to/file.pdf';
```

Also update the open-in-new-tab `href` and error fallback `href` in `index.html` to match.

> **CORS note:** PDF.js fetches the file via XHR. The target server must send `Access-Control-Allow-Origin: *` (or equivalent). Most public/academic static hosts do. If not, the error fallback state will appear.

---

## Extending

**Add a new snap position**
1. Add a CSS rule: `.bottom-sheet.snap-X { transform: translateY(...); }`
2. Add `'X'` to the `SNAPS` array in `service.js`
3. Add a `<div class="snap-dot" data-snap="X">` in `index.html`

**Change open default snap**
In `control.js`: `$('#openBtn').on('click', () => BottomSheetService.open('half'))` — change `'half'` to `'peek'` or `'full'`.

**Replace the PDF**
See *Adding a New PDF* above.

---

## Commit History

| Hash | Description |
|---|---|
| `19eb202` | fix: scroll to very bottom of PDF on Last Page click |
| `da3cbda` | feat: replace iframe with PDF.js canvas renderer |
| `7ee03cb` | fix: force full iframe reload for Last Page navigation |
| `8ae7f5e` | fix: keep Last Page button always visible |
| `b5d3c6d` | feat: add floating Last Page button inside bottom sheet |
| `dcb79e3` | refactor: split into HTML / CSS / service / control files |
| `46e4f1c` | fix: keep backdrop visible at all snap positions |
| `6c2ab14` | fix: keep rounded corners at full-screen snap |
| `b9adeca` | feat: rework snap points to viewport thirds |
| `5ee9e7d` | feat: add inline PDF viewer inside bottom sheet |
| `3860746` | feat: initial bottom sheet implementation |

---

## Dependencies

| Library | Version | Purpose |
|---|---|---|
| [jQuery](https://jquery.com) | 3.7.1 | DOM + event helpers |

Loaded from CDN — no install required.
