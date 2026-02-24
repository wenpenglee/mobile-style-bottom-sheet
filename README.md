# Mobile-Style Bottom Sheet

A mobile app–style bottom sheet built with **HTML, CSS, jQuery**, and **PDF.js** — no build step, no framework. Open `index.html` directly in a browser.

**Live repo:** https://github.com/wenpenglee/mobile-style-bottom-sheet

---

## Features

- Three snap positions driven by viewport thirds (1/3 · 2/3 · full screen)
- Drag handle with velocity-biased snap and rubber-band resistance
- Smooth backdrop that dims the page at peek/half, stays visible at full
- Rounded top corners preserved at all snap positions
- PDF rendered page-by-page via **PDF.js** (no iframe, full JS control)
- Floating **Last Page** button that smooth-scrolls to the end of the PDF
- Loading spinner + error fallback state
- Keyboard (`Escape`) and backdrop-tap dismiss
- Zero dependencies beyond jQuery 3 and PDF.js 3

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

## PDF Rendering (PDF.js)

```
pdfjsLib.getDocument(PDF_URL)
  └─ renderAllPages(pdf)
       ├─ Pre-create .pdf-page[data-page=N] wrappers in DOM order
       ├─ Render page 1  → hide loader immediately
       └─ Render pages 2–N in parallel (Promise.all)
```

- Scale: `(containerWidth / baseViewport.width) × devicePixelRatio` (capped at ×2)
- `goToLastPage()` → `$canvasWrap[0].scrollTo({ top: scrollHeight, behavior: 'smooth' })`
- Error state appears if PDF.js fails to load (e.g. CORS blocked)

**Why not an `<iframe>`?**
Native browser PDF viewers are cross-origin; JavaScript cannot scroll or navigate them programmatically. PDF.js renders the PDF in-page, giving full control.

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
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | PDF fetch + canvas rendering |

Both loaded from CDN — no install required.
