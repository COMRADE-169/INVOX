import { gsap } from 'gsap';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateRows(body) {
  const rows = [...body.children].filter((row) => row.matches('tr') && !row.dataset.motionPlayed);
  if (!rows.length) return;
  rows.forEach((row) => { row.dataset.motionPlayed = 'true'; });

  if (reducedMotion) return;
  gsap.fromTo(rows.slice(0, 16),
    { autoAlpha: 0, y: 8 },
    { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.035, ease: 'power1.out', clearProps: 'all' });
}

function animateCount(element) {
  const targetValue = Number(element.textContent.trim());
  if (!Number.isFinite(targetValue) || reducedMotion) return;

  const previous = Number(element.dataset.motionValue || 0);
  if (previous === targetValue) return;
  element.dataset.motionValue = String(targetValue);
  const count = { value: previous };
  gsap.to(count, {
    value: targetValue,
    duration: 0.55,
    ease: 'power1.out',
    onUpdate: () => { element.textContent = String(Math.round(count.value)); }
  });
}

function init() {
  if (reducedMotion) return;

  document.querySelectorAll('.module-section').forEach((module) => {
    const observer = new MutationObserver(() => {
      if (!module.classList.contains('hidden')) {
        gsap.fromTo(module, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.28, clearProps: 'all' });
      }
    });
    observer.observe(module, { attributes: true, attributeFilter: ['class'] });
  });

  document.querySelectorAll('#invoice-table-body, #po-table-body, #quotation-table-body').forEach((body) => {
    const observer = new MutationObserver(() => animateRows(body));
    observer.observe(body, { childList: true });
    animateRows(body);
  });

  const summaryCount = document.getElementById('quotation-summary-count');
  if (summaryCount) {
    const observer = new MutationObserver(() => animateCount(summaryCount));
    observer.observe(summaryCount, { childList: true, characterData: true, subtree: true });
    animateCount(summaryCount);
  }

  const toastObserver = new MutationObserver((records) => {
    records.flatMap((record) => [...record.addedNodes]).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const toasts = node.matches('.toast') ? [node] : [...node.querySelectorAll('.toast')];
      toasts.forEach((toast) => {
        gsap.fromTo(toast, { autoAlpha: 0, y: 12, scale: 0.97 }, {
          autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: 'power2.out', clearProps: 'all'
        });
      });
    });
  });
  toastObserver.observe(document.body, { childList: true, subtree: true });

  document.querySelectorAll('#studio-module-tabs button').forEach((tab) => {
    tab.addEventListener('click', () => {
      gsap.to(tab, { scale: 0.97, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut' });
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
