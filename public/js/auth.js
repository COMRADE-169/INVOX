/**
 * INVOX - Firebase authentication.
 */

(function () {
  'use strict';

  const firebase = window.firebase;

  function readLegacyUser() {
    try {
      const user = JSON.parse(localStorage.getItem('invox_auth_user_session') || 'null');
      return user && typeof user.uid === 'string' && typeof user.email === 'string' ? user : null;
    } catch (error) {
      console.error('Could not inspect legacy account metadata:', error);
      localStorage.removeItem('invox_auth_user_session');
      return null;
    } finally {
      localStorage.removeItem('invox_auth_registered_users');
      localStorage.removeItem('invox_auth_verification_queue');
    }
  }

  class InvoxAuthService {
    constructor() {
      this.currentUser = null;
      this.listeners = [];
      this.authReady = false;
      this.redirectError = null;
      this.legacyUser = readLegacyUser();
      this.hydrationPromise = null;
      this.readyPromise = this.initialize();
    }

    async hydrateAccountData() {
      if (this.hydrationPromise) return this.hydrationPromise;
      this.hydrationPromise = (async () => {
        await this.waitForStorage();
        await window.InvoxStorage?.hydrate();
        if (this.legacyUser && await window.InvoxStorage?.importLegacyUser(this.legacyUser)) {
          this.legacyUser = null;
        }
      })();
      try {
        await this.hydrationPromise;
      } finally {
        this.hydrationPromise = null;
      }
    }

    ensureUserDocument(user) {
      return firebase.firestore().collection('users').doc(user.uid).set({
        displayName: user.displayName || '',
        email: user.email || ''
      }, { merge: true });
    }

    async initialize() {
      try {
        await window.InvoxFirebaseReady;
        if (!firebase.apps.length) {
          this.authReady = true;
          this.notifyListeners(null);
          return null;
        }

        try {
          await firebase.auth().getRedirectResult();
        } catch (error) {
          console.error('Google sign-in redirect failed:', error);
          this.redirectError = this.normalizeAuthError(error);
        }

        return await new Promise(resolve => {
          firebase.auth().onAuthStateChanged(async user => {
            try {
              if (user) {
                await user.reload();
                user = firebase.auth().currentUser;
              }
              this.currentUser = this.publicUser(user);
            } catch (error) {
              console.error('Could not restore Firebase account data:', error);
              this.reportError(error);
              user = firebase.auth().currentUser || user;
              this.currentUser = this.publicUser(user);
            } finally {
              this.authReady = true;
              this.notifyListeners(this.currentUser);
              resolve(this.currentUser);
            }
            if (user) {
              this.ensureUserDocument(user)
                .then(() => this.hydrateAccountData())
                .catch(error => {
                  console.error('Could not restore Firebase account data:', error);
                  this.reportError(error);
                });
            }
          }, error => {
            console.error('Unable to restore the Firebase session:', error);
            this.authReady = true;
            this.notifyListeners(null);
            resolve(null);
          });
        });
      } catch (error) {
        console.error('Firebase authentication could not initialize:', error);
        this.authReady = true;
        this.notifyListeners(null);
        return null;
      }
    }

    async waitForStorage() {
      if (window.InvoxStorage) return;
      await new Promise(resolve => window.addEventListener('invox:storage-ready', resolve, { once: true }));
    }

    reportError(error) {
      window.dispatchEvent(new CustomEvent('invox:api-error', { detail: { message: error.message } }));
    }

    requireFirebase() {
      if (!firebase?.apps?.length) {
        throw new Error('Firebase is not configured. Set the Firebase web app environment variables and rebuild.');
      }
    }

    publicUser(user) {
      if (!user) return null;
      return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        emailVerified: Boolean(user.emailVerified),
        photoURL: user.photoURL || null
      };
    }

    onAuthStateChanged(callback) {
      this.listeners.push(callback);
      if (this.authReady) callback(this.currentUser);
      return () => {
        this.listeners = this.listeners.filter(listener => listener !== callback);
      };
    }

    whenReady() {
      return this.readyPromise;
    }

    getRedirectError() {
      const error = this.redirectError;
      this.redirectError = null;
      return error;
    }

    notifyListeners(user) {
      this.currentUser = user;
      this.listeners.forEach(callback => {
        try {
          callback(user);
        } catch (error) {
          console.error('Auth listener error:', error);
        }
      });
    }

    getCurrentUser() {
      return this.currentUser;
    }

    static evaluatePasswordStrength(password) {
      if (!password) {
        return {
          score: 0,
          label: 'Empty',
          percent: 0,
          colorClass: 'bg-slate-700',
          textColor: 'text-slate-400',
          checks: { length: false, upper: false, lower: false, number: false, special: false }
        };
      }
      const checks = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
      };
      let score = 0;
      if (checks.length) score++;
      if (checks.upper && checks.lower) score++;
      if (checks.number) score++;
      if (checks.special) score++;
      const values = [
        { label: 'Weak', percent: 25, colorClass: 'bg-rose-500', textColor: 'text-rose-400' },
        { label: 'Weak', percent: 25, colorClass: 'bg-rose-500', textColor: 'text-rose-400' },
        { label: 'Fair', percent: 50, colorClass: 'bg-amber-500', textColor: 'text-amber-400' },
        { label: 'Good', percent: 75, colorClass: 'bg-indigo-500', textColor: 'text-indigo-400' },
        { label: 'Strong', percent: 100, colorClass: 'bg-emerald-500', textColor: 'text-emerald-400' }
      ];
      return { score, checks, ...values[Math.min(score, 4)] };
    }

    async finishSignIn(user) {
      user = firebase.auth().currentUser || user;
      this.notifyListeners(this.publicUser(user));
      this.ensureUserDocument(user)
        .then(() => this.hydrateAccountData())
        .catch(error => {
          console.error('Could not synchronize Firebase account data:', error);
          this.reportError(error);
        });
      return this.currentUser;
    }

    async signUp(name, email, password, confirmPassword) {
      this.requireFirebase();
      if (!name || name.trim().length < 2) throw new Error('Please enter your full name (at least 2 characters).');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Please enter a valid email address.');
      const strength = InvoxAuthService.evaluatePasswordStrength(password);
      if (strength.score < 2 || password.length < 8) {
        throw new Error('Password must be at least 8 characters long and contain letters and numbers.');
      }
      if (password !== confirmPassword) throw new Error('Passwords do not match. Please verify both fields.');

      try {
        const credential = await firebase.auth().createUserWithEmailAndPassword(email.trim().toLowerCase(), password);
        await credential.user.updateProfile({ displayName: name.trim() });
        await this.ensureUserDocument(credential.user);
        this.notifyListeners(this.publicUser(credential.user));
        await this.hydrateAccountData();
        return this.currentUser;
      } catch (error) {
        throw this.normalizeAuthError(error);
      }
    }

    async signIn(email, password, rememberMe = true) {
      this.requireFirebase();
      if (!email || !email.includes('@')) throw new Error('Please enter a valid email address.');
      if (!password) throw new Error('Please enter your password.');
      try {
        await firebase.auth().setPersistence(
          rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
        );
        const credential = await firebase.auth().signInWithEmailAndPassword(email.trim().toLowerCase(), password);
        return await this.finishSignIn(credential.user);
      } catch (error) {
        throw this.normalizeAuthError(error);
      }
    }

    async signOut() {
      this.requireFirebase();
      await firebase.auth().signOut();
      this.notifyListeners(null);
      return true;
    }

    async changePassword(currentPassword, newPassword, confirmNewPassword) {
      this.requireFirebase();
      const user = firebase.auth().currentUser;
      if (!user) throw new Error('You must be signed in to change your password.');
      if (newPassword !== confirmNewPassword) throw new Error('New passwords do not match.');
      const strength = InvoxAuthService.evaluatePasswordStrength(newPassword);
      if (strength.score < 2 || newPassword.length < 8) {
        throw new Error('New passwords must be at least 8 characters long and contain letters and numbers.');
      }
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
      return true;
    }

    async updateProfile(updates) {
      this.requireFirebase();
      const authUser = firebase.auth().currentUser;
      if (!authUser) throw new Error('No authenticated user session.');
      if (updates.displayName) {
        const displayName = updates.displayName.trim();
        if (displayName.length < 2) throw new Error('Name must contain at least 2 characters.');
        await authUser.updateProfile({ displayName });
        await firebase.firestore().collection('users').doc(authUser.uid).set({
          displayName,
          email: authUser.email || ''
        }, { merge: true });
      }
      if (updates.businessProfile && window.InvoxStorage) {
        window.InvoxStorage.saveBusinessProfile({
          ...(window.InvoxStorage.getBusinessProfile() || {}),
          ...updates.businessProfile
        });
      }
      this.notifyListeners(this.publicUser(authUser));
      return this.currentUser;
    }

    async signInWithGoogle() {
      this.requireFirebase();
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithRedirect(provider);
    }

    async sendPasswordResetEmail(email) {
      this.requireFirebase();
      if (!email || !email.includes('@')) throw new Error('Please enter a valid email address.');
      await firebase.auth().sendPasswordResetEmail(email.trim().toLowerCase(), {
        url: `${window.location.origin}/login.html?reset=1`
      });
      return true;
    }

    requireAuth(redirectTarget = null) {
      const target = redirectTarget || window.location.pathname.split('/').pop() || 'app.html';
      if (!this.currentUser) {
        const loginUrl = `login.html?redirect=${encodeURIComponent(target + window.location.search)}`;
        window.location.replace(loginUrl);
        return false;
      }
      return true;
    }

    redirectIfAuthenticated(defaultTarget = 'app.html') {
      if (this.currentUser) {
        window.location.replace(this.getRedirectTarget(defaultTarget));
        return true;
      }
      return false;
    }

    getRedirectTarget(defaultTarget = 'app.html') {
      const requested = new URLSearchParams(window.location.search).get('redirect') || defaultTarget;
      const target = new URL(requested, window.location.origin);
      if (target.origin !== window.location.origin) return defaultTarget;
      return `${target.pathname}${target.search}${target.hash}`;
    }

    normalizeAuthError(error) {
      const mapped = {
        'auth/email-already-in-use': ['EMAIL_ALREADY_EXISTS', 'An account with this email address already exists.'],
        'auth/user-not-found': ['USER_NOT_FOUND', 'No account found with that email address.'],
        'auth/wrong-password': ['WRONG_PASSWORD', 'Incorrect password.'],
        'auth/invalid-credential': ['WRONG_PASSWORD', 'Incorrect email or password.'],
        'auth/invalid-email': ['INVALID_EMAIL', 'Please enter a valid email address.'],
        'auth/weak-password': ['WEAK_PASSWORD', 'Password must be at least 6 characters long.'],
        'auth/too-many-requests': ['TOO_MANY_REQUESTS', 'Too many attempts. Please wait and try again.'],
        'auth/popup-closed-by-user': ['POPUP_CLOSED', 'The sign-in window was closed before completing authentication.']
      }[error.code];
      if (!mapped) return error;
      const normalized = new Error(mapped[1]);
      normalized.code = mapped[0];
      normalized.email = error.email || firebase.auth().currentUser?.email;
      return normalized;
    }
  }

  window.InvoxAuth = new InvoxAuthService();
})();
