import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktop = window.matchMedia('(min-width: 768px)').matches;
const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4)
  || (navigator.deviceMemory && navigator.deviceMemory < 4);

function initReveals() {
  const revealGroups = [
    ...document.querySelectorAll('#features .landing-card'),
    ...document.querySelectorAll('#faq .faq-item'),
    ...document.querySelectorAll('#story .landing-card')
  ];

  gsap.fromTo('.hero-copy > *',
    { autoAlpha: 0, y: 16 },
    { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.1, ease: 'power2.out', delay: 0.08 });

  revealGroups.forEach((element, index) => {
    gsap.fromTo(element,
      { autoAlpha: 0, y: 22 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.65,
        delay: (index % 4) * 0.045,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 88%',
          once: true
        }
      });
  });

  gsap.fromTo('.landing-flow-grid > *',
    { autoAlpha: 0, y: 18 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.12,
      ease: 'power2.out',
      scrollTrigger: { trigger: '.landing-flow-grid', start: 'top 82%', once: true }
    });

  document.querySelectorAll('p[class*="text-2xl"][class*="text-3xl"]').forEach((element) => {
    const original = element.textContent.trim();
    const match = original.match(/^([^0-9]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) return;

    const prefix = match[1];
    const finalValue = Number(match[2].replace(/,/g, ''));
    const suffix = match[3];
    if (!Number.isFinite(finalValue)) return;

    const counter = { value: 0 };
    ScrollTrigger.create({
      trigger: element,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(counter, {
        value: finalValue,
        duration: 1.35,
        ease: 'power2.out',
        onUpdate: () => {
          element.textContent = `${prefix}${Math.round(counter.value).toLocaleString('en-IN')}${suffix}`;
        }
      })
    });
  });
}

function canRenderScene() {
  if (!desktop || lowPower || reducedMotion) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (error) {
    console.warn('INVOX 3D preview is unavailable in this browser.', error);
    return false;
  }
}

function initHeroScene() {
  const container = document.getElementById('hero-3d-scene');
  if (!container || !canRenderScene()) return;

  const observer = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();

    try {
      const { mountInvoiceScene } = await import('./hero-scene.jsx');
      mountInvoiceScene(container);
      container.addEventListener('invox-scene-fallback', () => {
        container.closest('section')?.classList.remove('hero-has-3d-scene');
      }, { once: true });
    } catch (error) {
      console.error('Could not load the INVOX 3D invoice preview.', error);
    }
  }, { rootMargin: '120px 0px' });

  observer.observe(container);
}

function init() {
  if (!reducedMotion) initReveals();
  initHeroScene();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
