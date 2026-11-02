/**
 * Public-page session controls shared by the landing and About pages.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const groups = [...document.querySelectorAll('[data-public-auth]')];
    if (!groups.length || !window.InvoxAuth) return;

    groups.forEach(group => {
      group.querySelector('[data-auth-menu-toggle]')?.addEventListener('click', event => {
        event.stopPropagation();
        const dropdown = group.querySelector('[data-auth-dropdown]');
        const isOpen = dropdown && !dropdown.hasAttribute('data-auth-state-hidden');
        setHidden(dropdown, isOpen);
        group.querySelector('[data-auth-menu-toggle]')?.setAttribute('aria-expanded', String(!isOpen));
      });

      group.querySelector('[data-auth-logout]')?.addEventListener('click', async () => {
        try {
          await window.InvoxAuth.signOut();
        } catch (error) {
          console.error('Could not sign out', error);
          window.alert(`Could not sign out: ${error.message}`);
        }
      });
    });

    document.addEventListener('click', event => {
      groups.forEach(group => {
        if (group.contains(event.target)) return;
        setHidden(group.querySelector('[data-auth-dropdown]'), true);
        group.querySelector('[data-auth-menu-toggle]')?.setAttribute('aria-expanded', 'false');
      });
    });

    window.InvoxAuth.onAuthStateChanged(render);
    window.InvoxAuth.whenReady().then(() => render(window.InvoxAuth.getCurrentUser()));

    function render(user) {
      document.body.classList.remove('auth-state-pending');
      groups.forEach(group => {
        setHidden(group.querySelector('[data-auth-loading]'), true);
        setHidden(group.querySelector('[data-auth-guest]'), Boolean(user));
        setHidden(group.querySelector('[data-auth-user]'), !user);
        const avatarLink = group.querySelector('[data-auth-avatar-link]');
        const initials = group.querySelector('[data-auth-initials]');
        const photo = group.querySelector('[data-auth-photo]');
        const name = user?.displayName?.trim() || user?.email?.split('@')[0] || 'User';
        const words = name.split(/\s+/).filter(Boolean);
        const initialsText = words.length > 1
          ? `${words[0][0]}${words[words.length - 1][0]}`
          : name.slice(0, 2);

        if (avatarLink) avatarLink.title = name;
        if (initials) initials.textContent = initialsText.toUpperCase();
        if (photo) {
          if (user?.photoURL) {
            photo.src = user.photoURL;
            photo.alt = `${name}'s profile photo`;
            photo.classList.remove('hidden');
            if (initials) initials.classList.add('hidden');
          } else {
            photo.removeAttribute('src');
            photo.alt = '';
            photo.classList.add('hidden');
            if (initials) initials.classList.remove('hidden');
          }
        }
        setHidden(group.querySelector('[data-auth-dropdown]'), true);
        group.querySelector('[data-auth-menu-toggle]')?.setAttribute('aria-expanded', 'false');
      });
      if (window.lucide) window.lucide.createIcons();
    }

    function setHidden(element, hidden) {
      if (!element) return;
      element.toggleAttribute('data-auth-state-hidden', hidden);
      element.classList.toggle('hidden', hidden);
    }
  });
})();
