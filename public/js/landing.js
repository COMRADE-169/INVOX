/**
 * INVOX - Landing Page & About Us Interactive Controller
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initThemeMode();
    initStickyNav();
    initMobileMenu();
    initFAQAccordion();
    initLoginModal();
    initContactForm();
    initHeroMockup();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  // --- 1. DARK / LIGHT THEME TOGGLE ---
  function initThemeMode() {
    const savedTheme = localStorage.getItem('invox_theme_mode') || 'dark';
    applyTheme(savedTheme);

    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = current === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
      });
    });
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      html.classList.add('dark');
      body.classList.remove('landing-mode');
    } else {
      html.classList.remove('dark');
      body.classList.add('landing-mode');
    }

    localStorage.setItem('invox_theme_mode', theme);
    updateThemeToggleIcons(theme);
  }

  function updateThemeToggleIcons(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const icon = btn.querySelector('[data-lucide]');
      if (icon) {
        if (theme === 'dark') {
          icon.setAttribute('data-lucide', 'sun');
        } else {
          icon.setAttribute('data-lucide', 'moon');
        }
      }
    });
    if (window.lucide) window.lucide.createIcons();
  }

  // --- 2. STICKY NAVBAR SCROLL EFFECTS ---
  function initStickyNav() {
    const nav = document.getElementById('main-navbar');
    if (!nav) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        nav.classList.add('shadow-lg', 'bg-slate-900/95', 'dark:bg-slate-950/95');
      } else {
        nav.classList.remove('shadow-lg');
      }
    });
  }

  // --- 3. MOBILE MENU TOGGLE ---
  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu-drawer');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
      menu.classList.toggle('hidden');
    });

    // Close when clicking mobile links
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.add('hidden');
      });
    });
  }

  // --- 4. FAQ ACCORDION ---
  function initFAQAccordion() {
    const items = document.querySelectorAll('.faq-item');
    items.forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      if (!trigger) return;

      trigger.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        // Collapse all others
        items.forEach(i => i.classList.remove('active'));
        // Toggle current
        if (!isActive) {
          item.classList.add('active');
        }
      });
    });
  }

  // --- 6. LOGIN MODAL ---
  function initLoginModal() {
    const modal = document.getElementById('modal-login');
    const openBtns = document.querySelectorAll('.btn-open-login');
    const closeBtns = modal?.querySelectorAll('.btn-close-modal');
    const form = document.getElementById('login-form');
    const demoBtn = document.getElementById('btn-demo-login');

    if (!modal) return;

    openBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      });
    });

    closeBtns?.forEach(btn => {
      btn.addEventListener('click', () => modal.classList.add('hidden'));
    });

    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        modal.classList.add('hidden');
      }
    });

    // Form submission validation
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value?.trim();
      const password = document.getElementById('login-password')?.value;

      if (!email || !email.includes('@')) {
        showToast('Please enter a valid email address', 'error');
        return;
      }
      if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }

      try {
        if (window.InvoxAuth) {
          await window.InvoxAuth.signIn(email, password);
        }
        modal.classList.add('hidden');
        showToast('Login successful! Redirecting to INVOX Studio...', 'success');
        setTimeout(() => {
          window.location.href = 'app.html';
        }, 600);
      } catch (err) {
        showToast(err.message || 'Login failed', 'error');
      }
    });

    // 1-Click Demo Login
    demoBtn?.addEventListener('click', async () => {
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (emailInput) emailInput.value = 'demo@invox.studio';
      if (passInput) passInput.value = 'invox2026pro';

      try {
        if (window.InvoxAuth) {
          await window.InvoxAuth.signIn('demo@invox.studio', 'invox2026pro');
        }
        showToast('Logged in as Demo Pro User! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'app.html';
        }, 600);
      } catch (err) {
        showToast(err.message || 'Demo login failed', 'error');
      }
    });
  }

  // --- 7. CONTACT FORM VALIDATION (FOR ABOUT.HTML) ---
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('contact-name')?.value?.trim();
      const email = document.getElementById('contact-email')?.value?.trim();
      const subject = document.getElementById('contact-subject')?.value?.trim();
      const message = document.getElementById('contact-message')?.value?.trim();
      const submitBtn = document.getElementById('btn-contact-submit');

      // Validation
      if (!name || name.length < 2) {
        showToast('Please enter your full name', 'error');
        document.getElementById('contact-name')?.focus();
        return;
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please provide a valid email address', 'error');
        document.getElementById('contact-email')?.focus();
        return;
      }

      if (!subject) {
        showToast('Please provide a subject line', 'error');
        document.getElementById('contact-subject')?.focus();
        return;
      }

      if (!message || message.length < 10) {
        showToast('Message must be at least 10 characters long', 'error');
        document.getElementById('contact-message')?.focus();
        return;
      }

      // Simulate sending
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="animate-spin h-4 w-4 text-white inline mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg> Sending message...
        `;
      }

      setTimeout(() => {
        form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Send Message</span><i data-lucide="send" class="w-4 h-4"></i>`;
        }
        
        const successBox = document.getElementById('contact-success-box');
        if (successBox) successBox.classList.remove('hidden');

        showToast('Thank you! Your message has been sent. We will respond within 24 hours.', 'success');
        if (window.lucide) window.lucide.createIcons();
      }, 1000);
    });
  }

  // --- 8. HERO INVOICE MOCKUP ANIMATION ---
  function initHeroMockup() {
    const replayBtn = document.getElementById('hero-mockup-replay');
    if (!replayBtn) return;

    replayBtn.addEventListener('click', runHeroAnimation);
    // Initial trigger after 1.2s
    setTimeout(runHeroAnimation, 1200);
  }

  function runHeroAnimation() {
    const typingInput = document.getElementById('hero-invoice-details-display');
    const itemRow = document.getElementById('hero-mock-item-2');
    const totalDisplay = document.getElementById('hero-mock-total');
    const stampDisplay = document.getElementById('hero-mock-stamp');
    const qrDisplay = document.getElementById('hero-mock-qr');

    if (!typingInput) return;

    // Reset state
    typingInput.textContent = '';
    if (itemRow) itemRow.classList.add('opacity-0', 'translate-y-2');
    if (totalDisplay) totalDisplay.textContent = '₹10,000.00';
    if (stampDisplay) stampDisplay.classList.add('opacity-0');
    if (qrDisplay) qrDisplay.classList.add('scale-95', 'opacity-60');

    const promptText = 'Client: Rahul • 5 logo designs @ ₹2,000 • 18% GST';
    let charIndex = 0;

    const interval = setInterval(() => {
      if (charIndex < promptText.length) {
        typingInput.textContent += promptText.charAt(charIndex);
        charIndex++;
      } else {
        clearInterval(interval);
        // Step 1: Pop item row
        setTimeout(() => {
          if (itemRow) itemRow.classList.remove('opacity-0', 'translate-y-2');
          // Step 2: Ticking total to ₹11,800
          setTimeout(() => {
            if (totalDisplay) totalDisplay.textContent = '₹11,800.00';
            // Step 3: Reveal PAID stamp & Glowing UPI QR
            setTimeout(() => {
              if (stampDisplay) stampDisplay.classList.remove('opacity-0');
              if (qrDisplay) qrDisplay.classList.remove('scale-95', 'opacity-60');
            }, 400);
          }, 350);
        }, 300);
      }
    }, 35);
  }

  // Simple toast helper for landing pages
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 3200);
  }

})();
