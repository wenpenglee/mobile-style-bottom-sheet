/**
 * service.js
 * Business logic: snap state machine, drag physics, PDF rendering via PDF.js.
 * No direct DOM queries here — elements are injected via init().
 */
const BottomSheetService = (function ($) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const PDF_URL         = 'https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf';
  const PDFJS_WORKER    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const SNAPS           = ['peek', 'half', 'full'];
  const DISMISS_THRESHOLD_RATIO = 0.80;
  const DISMISS_VELOCITY        = 18;

  // ── DOM refs (set via init) ────────────────────────────────────────────────
  let $sheet, $backdrop, $snapDots, $canvasWrap, $loader, $error;

  // ── State ──────────────────────────────────────────────────────────────────
  let currentSnap = null;
  let pdfLoaded   = false;
  let pdfDoc      = null;
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
    $sheet      = els.$sheet;
    $backdrop   = els.$backdrop;
    $snapDots   = els.$snapDots;
    $canvasWrap = els.$canvasWrap;
    $loader     = els.$loader;
    $error      = els.$error;
  }

  // ── PDF rendering ──────────────────────────────────────────────────────────
  function loadPdf() {
    if (pdfLoaded) return;
    pdfLoaded = true;

    $loader.removeClass('hidden');
    $error.removeClass('visible');

    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

    pdfjsLib.getDocument({ url: PDF_URL }).promise
      .then(function (pdf) {
        pdfDoc = pdf;
        renderAllPages(pdf);
      })
      .catch(function (err) {
        console.error('PDF load error:', err);
        $loader.addClass('hidden');
        $error.addClass('visible');
      });
  }

  function renderAllPages(pdf) {
    // Pre-create page wrappers in order so they always appear top-to-bottom
    for (var p = 1; p <= pdf.numPages; p++) {
      $canvasWrap.append(
        $('<div>', { 'class': 'pdf-page', 'data-page': p })
      );
    }

    var containerWidth = $canvasWrap[0].offsetWidth || window.innerWidth;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function renderOne(pageNum) {
      return pdf.getPage(pageNum).then(function (page) {
        var baseVP   = page.getViewport({ scale: 1 });
        var scale    = (containerWidth / baseVP.width) * dpr;
        var viewport = page.getViewport({ scale: scale });

        var canvas   = document.createElement('canvas');
        canvas.width  = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        $canvasWrap.find('.pdf-page[data-page="' + pageNum + '"]').append(canvas);

        return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise
          .then(function () {
            // Show content as soon as page 1 is painted
            if (pageNum === 1) $loader.addClass('hidden');
          });
      });
    }

    // Render page 1, then remaining pages in parallel
    renderOne(1).then(function () {
      var rest = [];
      for (var p = 2; p <= pdf.numPages; p++) {
        rest.push(renderOne(p));
      }
      return Promise.all(rest);
    }).catch(function (err) {
      console.error('PDF render error:', err);
      $loader.addClass('hidden');
      if (!$canvasWrap.find('canvas').length) $error.addClass('visible');
    });
  }

  // ── PDF navigation ─────────────────────────────────────────────────────────
  function goToLastPage() {
    if (!pdfDoc) return;
    var totalPages = pdfDoc.numPages;
    // Prefer the fully rendered last page; fall back to last available
    var $target = $canvasWrap.find('.pdf-page[data-page="' + totalPages + '"]');
    if (!$target.length) $target = $canvasWrap.find('.pdf-page').last();
    if (!$target.length) return;
    $target[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
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
