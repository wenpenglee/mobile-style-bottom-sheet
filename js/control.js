/**
 * control.js
 * DOM binding: selects elements, attaches event listeners, delegates to BottomSheetService.
 */
$(function () {
  'use strict';

  // ── DOM references ─────────────────────────────────────────────────────────
  const $sheet    = $('#bottomSheet');
  const $backdrop = $('#backdrop');
  const $handle   = $('#handleArea');
  const $body     = $sheet.find('.sheet-body');
  const $snapDots = $('.snap-dot');
  const $frame    = $('#pdfFrame');
  const $loader   = $('#pdfLoader');
  const $error    = $('#pdfError');

  // ── Initialise service with DOM refs ───────────────────────────────────────
  BottomSheetService.init({ $sheet, $backdrop, $snapDots, $frame, $loader, $error });

  // ── Drag: handle (always triggers drag) ───────────────────────────────────
  $handle[0].addEventListener('pointerdown', function (e) {
    e.preventDefault();
    $handle[0].setPointerCapture(e.pointerId);
    BottomSheetService.onDragStart(e.clientY);
  }, { passive: false });

  // Drag from body only when scrolled to top (so normal scroll still works)
  $body[0].addEventListener('pointerdown', function (e) {
    if ($body[0].scrollTop === 0) {
      BottomSheetService.onDragStart(e.clientY);
    }
  });

  $sheet[0].addEventListener('pointermove',   function (e) { BottomSheetService.onDragMove(e.clientY); });
  $sheet[0].addEventListener('pointerup',     function ()  { BottomSheetService.onDragEnd(); });
  $sheet[0].addEventListener('pointercancel', function ()  { BottomSheetService.onDragEnd(); });

  // ── Snap dot clicks ────────────────────────────────────────────────────────
  $snapDots.on('click', function () {
    BottomSheetService.applySnap($(this).data('snap'));
  });

  // ── Button bindings ────────────────────────────────────────────────────────
  $('#openBtn').on('click',     function () { BottomSheetService.open('half'); });
  $('#closeBtn').on('click',    function () { BottomSheetService.close(); });
  $('#lastPageBtn').on('click', function () { BottomSheetService.goToLastPage(); });

  // Backdrop tap closes the sheet
  $backdrop.on('click', function () { BottomSheetService.close(); });

  // Prevent sheet clicks from bubbling up to the backdrop
  $sheet.on('click', function (e) { e.stopPropagation(); });

  // ── Keyboard ───────────────────────────────────────────────────────────────
  $(document).on('keydown', function (e) {
    if (e.key === 'Escape' && BottomSheetService.isOpen()) {
      BottomSheetService.close();
    }
  });
});
