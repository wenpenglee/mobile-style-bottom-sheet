/**
 * service.js
 * Business logic: snap state machine, drag physics, PDF network request.
 * No direct DOM queries here — elements are injected via init().
 */
const BottomSheetService = (function ($) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const PDF_URL = 'https://www.princexml.com/samples/invoice-colorful/invoicesample.pdf';
  const SNAPS   = ['peek', 'half', 'full'];
  const DISMISS_THRESHOLD_RATIO = 0.80; // dismiss if dragged below 80% of vh
  const DISMISS_VELOCITY        = 18;   // px/frame flick threshold
  const PDF_TIMEOUT_MS          = 15000;

  // ── DOM refs (set via init) ────────────────────────────────────────────────
  let $sheet, $backdrop, $snapDots, $frame, $loader, $error;

  // ── State ──────────────────────────────────────────────────────────────────
  let currentSnap = null;
  let pdfLoaded   = false;
  let rafId       = null;

  const drag = {
    active: false,
    startY: 0,
    startTranslate: 0,
    lastY: 0,
    velocity: 0,
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  function init(els) {
    $sheet     = els.$sheet;
    $backdrop  = els.$backdrop;
    $snapDots  = els.$snapDots;
    $frame     = els.$frame;
    $loader    = els.$loader;
    $error     = els.$error;
  }

  // ── PDF (network request) ──────────────────────────────────────────────────
  function loadPdf() {
    if (pdfLoaded) return;
    pdfLoaded = true;

    $loader.removeClass('hidden');
    $error.removeClass('visible');
    $frame.attr('src', PDF_URL);

    const timer = setTimeout(function () {
      if (!$loader.hasClass('hidden')) {
        $loader.addClass('hidden');
        $error.addClass('visible');
      }
    }, PDF_TIMEOUT_MS);

    $frame.on('load', function () {
      clearTimeout(timer);
      $loader.addClass('hidden');
    });
  }

  // ── Snap state ─────────────────────────────────────────────────────────────
  function getSnapTranslate(snap) {
    const vh = window.innerHeight;
    switch (snap) {
      case 'peek': return vh * 2 / 3;  // 1/3 of screen visible
      case 'half': return vh / 3;       // 2/3 of screen visible
      case 'full': return 0;            // full screen
    }
    return vh; // hidden (off-screen)
  }

  function getCurrentTranslate() {
    const m = new DOMMatrix(window.getComputedStyle($sheet[0]).transform);
    return m.m42;
  }

  function updateDots(snap) {
    $snapDots.each(function () {
      $(this).toggleClass('active', $(this).data('snap') === snap);
    });
  }

  function applySnap(snap) {
    $sheet
      .removeClass('dragging snap-peek snap-half snap-full')
      .addClass('snap-' + snap)
      .css('transform', '');
    currentSnap = snap;
    updateDots(snap);
    $backdrop.addClass('visible');
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  function open(snap) {
    applySnap(snap || 'half');
    loadPdf();
  }

  function close() {
    $sheet.removeClass('dragging snap-peek snap-half snap-full');
    $backdrop.removeClass('visible');
    currentSnap = null;
    updateDots(null);
    $sheet.css('transform', '');
  }

  function isOpen() {
    return currentSnap !== null;
  }

  // ── Drag physics ───────────────────────────────────────────────────────────
  function onDragStart(clientY) {
    drag.active         = true;
    drag.startY         = clientY;
    drag.startTranslate = getCurrentTranslate();
    drag.lastY          = clientY;
    drag.velocity       = 0;
    $sheet.addClass('dragging');
  }

  function onDragMove(clientY) {
    if (!drag.active) return;
    drag.velocity = clientY - drag.lastY;
    drag.lastY    = clientY;

    let next = drag.startTranslate + (clientY - drag.startY);
    if (next < 0) next *= 0.25;                          // rubber-band above full
    next = Math.min(next, window.innerHeight + 60);       // clamp below screen

    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      $sheet.css('transform', 'translateY(' + next + 'px)');
    });
  }

  function onDragEnd() {
    if (!drag.active) return;
    drag.active = false;
    $sheet.removeClass('dragging');

    const currentY = getCurrentTranslate();
    const vh       = window.innerHeight;

    if (currentY > vh * DISMISS_THRESHOLD_RATIO || drag.velocity > DISMISS_VELOCITY) {
      close();
      return;
    }

    // Find nearest snap, biased by flick velocity
    const biased = currentY + drag.velocity * 6;
    let nearest = SNAPS[0], minDist = Infinity;
    SNAPS.forEach(function (s) {
      const d = Math.abs(biased - getSnapTranslate(s));
      if (d < minDist) { minDist = d; nearest = s; }
    });

    applySnap(nearest);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    init,
    open,
    close,
    isOpen,
    applySnap,
    onDragStart,
    onDragMove,
    onDragEnd,
  };

}(jQuery));
