/**
 * service.js
 * Business logic: snap state machine, drag physics, PDF loading via iframe.
 * No direct DOM queries here — elements are injected via init().
 */
const BottomSheetService = (function ($) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const PDF_URL                 = 'https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf';
  const SNAPS                   = ['peek', 'half', 'full'];
  const DISMISS_THRESHOLD_RATIO = 0.80;
  const DISMISS_VELOCITY        = 18;
  const PDF_TIMEOUT_MS          = 15000;

  // ── DOM refs (set via init) ────────────────────────────────────────────────
  let $sheet, $backdrop, $snapDots, $frame, $scrollContainer, $loader, $error;

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
    $sheet           = els.$sheet;
    $backdrop        = els.$backdrop;
    $snapDots        = els.$snapDots;
    $frame           = els.$frame;
    $scrollContainer = els.$scrollContainer;
    $loader          = els.$loader;
    $error           = els.$error;
  }

  // ── PDF loading ────────────────────────────────────────────────────────────
  function loadPdf() {
    if (pdfLoaded) return;
    pdfLoaded = true;
    _loadFrameSrc(PDF_URL);
  }

  // Swap in a brand-new <iframe> pointing at `src`.
  // Replacing the element (vs. changing .src) forces a full navigation so
  // the browser's PDF viewer always picks up any URL fragment (#page=N).
  function _loadFrameSrc(src) {
    $loader.removeClass('hidden');
    $error.removeClass('visible');

    var $newFrame = $('<iframe>', {
      'class': 'pdf-frame',
      id:      'pdfFrame',
      title:   'PDF Viewer',
      allowfullscreen: '',
    });

    var timer = setTimeout(function () {
      if (!$loader.hasClass('hidden')) {
        $loader.addClass('hidden');
        $error.addClass('visible');
      }
    }, PDF_TIMEOUT_MS);

    $newFrame.on('load', function () {
      clearTimeout(timer);
      $loader.addClass('hidden');
    });

    // Replace keeps the same DOM position; update the module ref so
    // future calls (e.g. goToLastPage) target the new element.
    $frame.replaceWith($newFrame);
    $frame = $newFrame;

    // Set src after attaching to the DOM so the load event fires reliably.
    $frame.attr('src', src);
  }

  // ── PDF navigation ─────────────────────────────────────────────────────────
  // scrollTo(0, scrollHeight) on the container we own scrolls to the very
  // bottom of the tall iframe, where the PDF viewer has rendered the last page.
  function goToLastPage() {
    if (!pdfLoaded) return;
    $scrollContainer[0].scrollTo({ top: $scrollContainer[0].scrollHeight, behavior: 'smooth' });
  }

  // ── Snap state ─────────────────────────────────────────────────────────────
  function getSnapTranslate(snap) {
    var vh = window.innerHeight;
    switch (snap) {
      case 'peek': return vh * 2 / 3;
      case 'half': return vh / 3;
      case 'full': return 0;
    }
    return vh;
  }

  function getCurrentTranslate() {
    var m = new DOMMatrix(window.getComputedStyle($sheet[0]).transform);
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

    var next = drag.startTranslate + (clientY - drag.startY);
    if (next < 0) next *= 0.25;
    next = Math.min(next, window.innerHeight + 60);

    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      $sheet.css('transform', 'translateY(' + next + 'px)');
    });
  }

  function onDragEnd() {
    if (!drag.active) return;
    drag.active = false;
    $sheet.removeClass('dragging');

    var currentY = getCurrentTranslate();
    var vh       = window.innerHeight;

    if (currentY > vh * DISMISS_THRESHOLD_RATIO || drag.velocity > DISMISS_VELOCITY) {
      close();
      return;
    }

    var biased = currentY + drag.velocity * 6;
    var nearest = SNAPS[0], minDist = Infinity;
    SNAPS.forEach(function (s) {
      var d = Math.abs(biased - getSnapTranslate(s));
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
    goToLastPage,
  };

}(jQuery));
