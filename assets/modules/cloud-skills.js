// ========== FIREBASE CLOUD SYNC ==========

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAgMenA-kiiwESliFp2zXgYLa7a3pPM65I",
  authDomain: "dndcharproject.firebaseapp.com",
  projectId: "dndcharproject",
  storageBucket: "dndcharproject.firebasestorage.app",
  messagingSenderId: "80899162338",
  appId: "1:80899162338:web:b7f9c9fbf96b9553c29ebb"
};

// ---- Staging safety switch --------------------------------------------------
// On the private staging host (LAN address / localhost) the app talks ONLY to the
// local Firebase emulators with a fake config, so it can never read or change the
// real cloud data. On every real address (github.io, web.app, ...) this does nothing.
const DND_STAGING = /^(192\.168\.|10\.|127\.|localhost$|dndsite)/.test(location.hostname);
window.DND_STAGING = DND_STAGING;
if (DND_STAGING) {
  Object.assign(firebaseConfig, {
    apiKey: 'staging-fake-key', authDomain: location.hostname, projectId: 'demo-dnd',
    storageBucket: '', messagingSenderId: '0', appId: '1:0:web:staging'
  });
}

// Initialize Firebase
let firebaseApp, auth, db;
let currentUser = null;
window.currentUser = null;
let cloudSyncTimer = null;
const OWNER_EMAIL = 'vanreejoz33@gmail.com';

function bindAuthButtons() {
  const signInBtn = document.getElementById('signInBtn');
  if (signInBtn && signInBtn.dataset.authBound !== '1') {
    signInBtn.dataset.authBound = '1';
    signInBtn.type = 'button';
    signInBtn.addEventListener('click', (event) => {
      event.preventDefault();
      signInWithGoogle();
    });
    signInBtn.addEventListener('touchend', (event) => {
      event.preventDefault();
      signInWithGoogle();
    }, { passive: false });
    // Staging only: a second one-tap login as the OWNER test account, to try the admin side. Emulator-only account.
    if (DND_STAGING && !document.getElementById('signInOwnerStagingBtn')) {
      const ob = document.createElement('button');
      ob.id = 'signInOwnerStagingBtn'; ob.type = 'button'; ob.className = signInBtn.className;
      ob.textContent = 'Staging: sign in as owner (admin)';
      ob.addEventListener('click', async () => {
        try {
          try { await window.auth.signInWithEmailAndPassword(OWNER_EMAIL, 'staging-only'); }
          catch (e) { await window.auth.createUserWithEmailAndPassword(OWNER_EMAIL, 'staging-only'); }
          setSyncStatus('Signed in as the staging OWNER test account');
        } catch (e) { setSyncStatus('Owner sign-in failed: ' + (e.message || e)); }
      });
      signInBtn.insertAdjacentElement('afterend', ob);
    }
  }

  // Sync buttons: an inline onclick in settings.html is the primary path (works
  // even if this binder never runs). We only add a JS listener as a secondary
  // path when the inline handler is somehow absent, so they never double-fire.
  const syncUpBtn = document.querySelector('.settings-sync-up-btn');
  if (syncUpBtn && syncUpBtn.dataset.authBound !== '1') {
    syncUpBtn.dataset.authBound = '1';
    syncUpBtn.type = 'button';
    if (!syncUpBtn.getAttribute('onclick')) {
      syncUpBtn.addEventListener('click', (event) => { event.preventDefault(); handleSyncUpConfirm(syncUpBtn); });
    }
  }

  const syncDownBtn = document.querySelector('.settings-sync-down-btn');
  if (syncDownBtn && syncDownBtn.dataset.authBound !== '1') {
    syncDownBtn.dataset.authBound = '1';
    syncDownBtn.type = 'button';
    if (!syncDownBtn.getAttribute('onclick')) {
      syncDownBtn.addEventListener('click', (event) => { event.preventDefault(); handleSyncDownConfirm(syncDownBtn); });
    }
  }

  const signOutBtn = document.querySelector('.settings-signout-btn');
  if (signOutBtn && signOutBtn.dataset.authBound !== '1') {
    signOutBtn.dataset.authBound = '1';
    signOutBtn.type = 'button';
    signOutBtn.addEventListener('click', (event) => {
      event.preventDefault();
      signOut();
    });
  }
}

function initializeFirebase() {
  try {
    
    // Verify Firebase libraries are loaded
    if (typeof firebase === 'undefined') {
      console.error('Firebase library not loaded');
      setSyncStatus('Firebase library not available');
      return;
    }
    
    
    // Prevent multiple initialization attempts
    if (firebaseApp) {
      updateAuthUI();
      return;
    }
    
    firebaseApp = firebase.apps && firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(firebaseConfig);
    
    auth = firebase.auth();
    
    // Set persistence to LOCAL so user stays logged in
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
    });
    
    window.auth = auth; // Make auth globally available for button check
    
    db = firebase.firestore();
    window.db = db;
    if (DND_STAGING) {
      // Staging: use the local emulators (auth :9099, firestore :8081) - never the real project
      auth.useEmulator('http://' + location.hostname + ':9099', { disableWarnings: true });
      db.useEmulator(location.hostname, 8081);
      console.warn('[staging] Firebase emulators in use - no real data is touched');
    }

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      window.currentUser = user;
      updateAuthUI();
      if (user) {
        // Use sessionStorage so full sign-in handling only runs once per browser session.
        // On refresh the auth state fires again but we skip the heavy Firestore work.
        const sessionKey = `dndSessionHandled_${user.uid}`;
        const alreadyHandled = sessionStorage.getItem(sessionKey) === '1';

        if (!alreadyHandled) {
          sessionStorage.setItem(sessionKey, '1');
          setSyncStatus('Signed in successfully');
          handleSignedInUser(user).catch((err) => {
            console.error('Signed-in user handling error:', err);
          });
          setTimeout(() => syncFromCloud(true), 1000);
        } else {
          // Refresh/re-render — just restart the live listener, skip the heavy stuff
          startPresenceHeartbeat(getOrCreateDeviceId());
          startActiveCharacterListener(window.currentCharacter);
        }
      } else {
        stopPresenceHeartbeat();
      }
    });

    bindAuthButtons();
    // Update UI to enable sign-in button
    updateAuthUI();
  } catch (error) {
    console.error('=== Firebase initialization error ===');
    console.error('Error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    setSyncStatus('Cloud sync unavailable');
    // Update UI to show error state
    updateAuthUI();
  }
}

function updateAuthUI() {
  bindAuthButtons();
  const signedInView = document.getElementById('signedInView');
  const signedOutView = document.getElementById('signedOutView');
  const userEmail = document.getElementById('userEmail');
  const signInBtn = document.getElementById('signInBtn');


  if (currentUser) {
    if (signedInView) signedInView.style.display = 'block';
    if (signedOutView) signedOutView.style.display = 'none';
    if (userEmail) userEmail.textContent = currentUser.email;
  } else {
    if (signedInView) signedInView.style.display = 'none';
    if (signedOutView) signedOutView.style.display = 'block';
    // Enable/disable sign-in button based on Firebase availability
    if (signInBtn) {
      const firebaseAvailable = typeof firebase !== 'undefined' && !!firebase.auth;
      signInBtn.disabled = false;
      signInBtn.textContent = firebaseAvailable ? 'Sign In with Google' : 'Retry Google Sign In';
    }
  }

  if (typeof window.updateAdminPortalVisibility === 'function') {
    window.updateAdminPortalVisibility();
  }
}

function setSyncStatus(message) {
  const statusElement = document.getElementById('syncStatus');
  if (statusElement) {
    statusElement.textContent = message;
    // Clear status after 3 seconds
    setTimeout(() => {
      statusElement.textContent = '';
    }, 3000);
  }
  if (typeof window.updateAdminPortalVisibility === 'function') {
    window.updateAdminPortalVisibility();
  }
}

async function sendOwnerNotification(subject, message, extra = {}, fromEmailOverride = '') {
  if (window.DND_STAGING) return { success: true, skipped: 'staging' }; // never email from staging
  const fromEmail = fromEmailOverride || currentUser?.email || 'anonymous@example.com';
  try {
    const formData = new FormData();
    formData.append('email', fromEmail);
    formData.append('subject', subject);
    formData.append('message', message);
    formData.append('_replyto', fromEmail);
    formData.append('_subject', subject);
    Object.keys(extra).forEach((key) => formData.append(key, String(extra[key] ?? '')));

    const response = await fetch('https://formspree.io/f/xovnrwbd', {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Owner notification response error:', response.status, errorText);
    }
    return { success: response.ok };
  } catch (error) {
    console.error('Owner notification failed:', error);
    return { success: false };
  }
}

function isOwnerEmail(email) {
  return String(email || '').toLowerCase() === OWNER_EMAIL.toLowerCase();
}

function getOrCreateDeviceId() {
  const key = 'dndDeviceId';
  let existing = '';
  try { existing = localStorage.getItem(key) || ''; } catch (_) {}
  if (existing && typeof existing === 'string' && existing.length >= 12) return existing;

  let bytes;
  try {
    bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
  } catch (_) {
    // Very old browsers fallback
    return `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
  const id = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(key, id); } catch (_) {}
  return id;
}

async function trackSigninAndMaybeNotify(user) {
  if (!db || !user?.uid) return { firstEver: false, newDevice: false, deviceId: '' };
  const deviceId = getOrCreateDeviceId();
  const docRef = db.collection('auth_signins').doc(user.uid);
  const nowIso = new Date().toISOString();

  const NOTIFY_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  const flags = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? (snap.data() || {}) : {};
    const knownDevices = data.knownDevices || {};
    const firstEver = !snap.exists;
    const deviceData = knownDevices[deviceId] || {};
    const newDevice = !Object.prototype.hasOwnProperty.call(knownDevices, deviceId);

    // Check if we already notified for this device recently (server-side, survives localStorage clears)
    const lastNotifiedIso = deviceData.notifiedAt || '';
    const lastNotifiedMs = lastNotifiedIso ? new Date(lastNotifiedIso).getTime() : 0;
    const shouldNotify = firstEver && (Date.now() - lastNotifiedMs > NOTIFY_COOLDOWN_MS);

    let knownDeviceCount = Number(data.knownDeviceCount);
    if (!Number.isFinite(knownDeviceCount)) {
      knownDeviceCount = Object.keys(knownDevices).length;
    }
    if (newDevice) knownDeviceCount += 1;

    const FieldValue = firebase.firestore.FieldValue;
    const update = {
      email: user.email || '',
      lastSignInAt: FieldValue.serverTimestamp(),
      lastDeviceId: deviceId,
      knownDeviceCount: knownDeviceCount,
      lastSeenAt: FieldValue.serverTimestamp()
    };

    update[`knownDevices.${deviceId}.lastSeenAt`] = FieldValue.serverTimestamp();
    update[`knownDevices.${deviceId}.lastSignInAt`] = FieldValue.serverTimestamp();
    update[`knownDevices.${deviceId}.ua`] = (navigator.userAgent || '').slice(0, 180);
    update[`knownDevices.${deviceId}.lastSignInIso`] = nowIso;
    if (newDevice) {
      update[`knownDevices.${deviceId}.firstSeenAt`] = FieldValue.serverTimestamp();
      update[`knownDevices.${deviceId}.firstSeenIso`] = nowIso;
    }
    if (shouldNotify) {
      update[`knownDevices.${deviceId}.notifiedAt`] = nowIso;
    }

    if (firstEver) {
      update.firstSeenAt = FieldValue.serverTimestamp();
      update.firstSeenIso = nowIso;
      update.signInCount = 1;
    } else {
      update.signInCount = FieldValue.increment(1);
    }

    tx.set(docRef, update, { merge: true });
    return { firstEver, newDevice, shouldNotify };
  });

  const SIGNIN_SUPPRESSED_EMAILS = [
    'vanreejoz33@gmail.com',
    'justbetterjozz@gmail.com',
  ];
  const isSupressed = SIGNIN_SUPPRESSED_EMAILS.includes(String(user.email || '').toLowerCase());
  if (!isOwnerEmail(user.email) && !isSupressed && flags.shouldNotify) {
    const userEmail = user.email || 'unknown';
    const subject = `New User Sign-In — ${userEmail}`;
    const message = `A new user signed in for the first time.\n\nEmail: ${userEmail}\nUID: ${user.uid}\nDevice: ${deviceId}\nTime: ${nowIso}`;
    await sendOwnerNotification(subject, message, {
      event_type: 'google_signin_first',
      signed_in_email: userEmail,
      signed_in_uid: user.uid,
      device_id: deviceId
    });
  }

  return { ...flags, deviceId };
}

let presenceTimer = null;
let lastPresenceAt = 0;
let lastPresenceUid = '';
let lastPresenceDevice = '';
let presenceListenersAttached = false;
function onPresenceVisibilityChange() {
  if (!document.hidden) sendPresenceHeartbeat();
}

async function sendPresenceHeartbeat() {
  if (!db || !currentUser?.uid) return;
  const now = Date.now();
  if (now - lastPresenceAt < 240000) return; // throttle to max once per 4 minutes
  lastPresenceAt = now;
  const uid = currentUser.uid;
  const deviceId = lastPresenceDevice || getOrCreateDeviceId();
  lastPresenceUid = uid;
  lastPresenceDevice = deviceId;

  const docRef = db.collection('auth_signins').doc(uid);
  const FieldValue = firebase.firestore.FieldValue;
  const update = {
    lastSeenAt: FieldValue.serverTimestamp(),
    lastDeviceId: deviceId
  };
  update[`knownDevices.${deviceId}.lastSeenAt`] = FieldValue.serverTimestamp();
  try {
    await docRef.set(update, { merge: true });
  } catch (e) {
    console.warn('Presence heartbeat failed:', e);
  }
}

function startPresenceHeartbeat(deviceId) {
  lastPresenceDevice = deviceId || getOrCreateDeviceId();
  if (presenceTimer) clearInterval(presenceTimer);
  // Timer-based presence
  presenceTimer = setInterval(sendPresenceHeartbeat, 300000); // every 5 minutes
  // Expose for compatibility (no longer called from autosave)
  window.presenceHeartbeat = sendPresenceHeartbeat;
  // Kick once immediately
  sendPresenceHeartbeat();
}

function stopPresenceHeartbeat() {
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  lastPresenceAt = 0;
  lastPresenceUid = '';
  lastPresenceDevice = '';
  window.presenceHeartbeat = null;
}

async function handleSignedInUser(user) {
  await ensureUserProfile(user);
  const { deviceId } = await trackSigninAndMaybeNotify(user);
  startPresenceHeartbeat(deviceId);
}

async function ensureUserProfile(user) {
  if (!db || !user?.uid) return;
  const uid = user.uid;
  const email = user.email || '';
  const docRef = db.collection('userProfiles').doc(uid);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() || {}) : {};

  const FieldValue = firebase.firestore.FieldValue;
  const update = {
    email: email,
    lastSeenAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!snap.exists) update.createdAt = FieldValue.serverTimestamp();

  const hasNickname = typeof existing.nickname === 'string' && existing.nickname.trim().length > 0;
  const promptKey = `dndNicknamePrompted_${uid}`;
  const alreadyPrompted = (localStorage.getItem(promptKey) || '') === '1';
  if (!hasNickname && !alreadyPrompted && !isOwnerEmail(email)) {
    const nickname = (typeof appPrompt === 'function'
      ? await appPrompt('Pick a name/nickname to show in the app (you can change it later):', { title: 'Welcome!', placeholder: 'Your name', confirmText: 'Save' })
      : prompt('Pick a name/nickname to show in the app (you can change it later):')) || '';
    localStorage.setItem(promptKey, '1');
    const clean = nickname.trim().slice(0, 40);
    if (clean) update.nickname = clean;
  }

  await docRef.set(update, { merge: true });
}

function ensureFirebaseReady() {
  if (window.auth) return true;
  initializeFirebase();
  return !!window.auth;
}

// Authentication Functions
async function signInWithGoogle() {
  try {
    
    // Comprehensive checks for Firebase availability
    if (typeof firebase === 'undefined') {
      console.error('Firebase library not loaded');
      setSyncStatus('Firebase not loaded yet');
      (window.appToast || alert)('Firebase is still loading. Please wait a moment and try again.', 'error');
      return;
    }

    if (!firebase.auth) {
      console.error('Firebase auth module not available');
      setSyncStatus('Firebase auth not available');
      (window.appToast || alert)('Firebase authentication is not available. Please refresh the page.', 'error');
      return;
    }

    if (!window.auth && !ensureFirebaseReady()) {
      console.error('Firebase auth instance not initialized');
      setSyncStatus('Authentication not ready');
      (window.appToast || alert)('Authentication is not ready yet. Please wait a moment and try again.', 'error');
      return;
    }

    setSyncStatus('Opening sign-in popup...');

    if (DND_STAGING) {
      // Staging only: one-tap login as the seeded test copy of Jozz (exists only in the emulator)
      await window.auth.signInWithEmailAndPassword('jozz@staging.test', 'staging-only');
      setSyncStatus('Signed in as staging test user');
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    
    // Add scopes if needed
    provider.addScope('email');
    provider.addScope('profile');

    let result;
    try {
      result = await window.auth.signInWithPopup(provider);
      setSyncStatus('Signed in successfully');
    } catch (popupError) {
      
      // If popup fails, try redirect method
      if (popupError.code === 'auth/popup-blocked' || 
          popupError.code === 'auth/operation-not-supported-in-this-environment' ||
          popupError.message?.includes('popup')) {
        setSyncStatus('Redirecting to sign-in...');
        
        try {
          await window.auth.signInWithRedirect(provider);
          // The page will redirect, but we'll get results when it comes back
        } catch (redirectError) {
          console.error('Redirect also failed:', redirectError);
          throw redirectError;
        }
      } else {
        throw popupError;
      }
    }
    
  } catch (error) {
    console.error('=== Sign-in error ===');
    console.error('Error object:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));

    // Handle specific error cases
    let errorMessage = 'Sign-in failed';
    if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Popup was blocked by browser. Please allow popups and try again.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in cancelled';
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage = 'This domain is not authorized for sign-in. You need to add it to Firebase Console > Authentication > Settings > Authorized domains.\n\nCurrent domain: ' + window.location.hostname;
    } else if (error.code === 'auth/operation-not-supported-in-this-environment') {
      errorMessage = 'Sign-in is not supported in this browser. Please try a different browser or add this domain to Firebase.';
    } else if (error.message && error.message.includes('signInWithPopup')) {
      errorMessage = 'Authentication system is not ready. Please refresh the page and try again.';
    } else if (error.message && error.message.includes('Network')) {
      errorMessage = 'Network error. Please check your internet connection.';
    } else {
      errorMessage = error.message || 'Unknown sign-in error';
    }

    setSyncStatus(errorMessage);
    console.error('Final error message:', errorMessage);
    (window.appToast || alert)(errorMessage, 'error');
  }
}

async function signOut() {
  try {
    await auth.signOut();
    setSyncStatus('Signed out');
  } catch (error) {
    console.error('Sign-out error:', error);
    setSyncStatus('Sign-out failed');
  }
}

// ========== CLOUD SYNC (subcollection-per-character) ==========
//
// Firestore layout:
//   userData/{uid}                         — user prefs (theme, accentColor)
//   userData/{uid}/characters/{charId}     — one document per character
let activeCharacterUnsubscribe = null;
// Timestamp of the last save WE initiated — used to suppress the echo
// from our own writes coming back through onSnapshot.
let lastOwnSaveAt = 0; // no longer used to decide anything; kept so nothing that reads it breaks

// ---- helpers ----

function charCollection() {
  return db.collection('userData').doc(currentUser.uid).collection('characters');
}

function userMetaRef() {
  return db.collection('userData').doc(currentUser.uid);
}

// All account-level appearance preferences that sync across devices (NOT character
// data). Gathered from localStorage for upload, and applied on download so the account
// looks the same however/wherever you open the app.
function gatherUserPrefs() {
  return {
    theme: localStorage.getItem('dndTheme') || 'dark',
    accentColor: localStorage.getItem('dndAccentColor') || '#ffd700',
    fontFamily: localStorage.getItem('dndFontFamily') || '',
    textScalePercent: localStorage.getItem('dndTextScalePercent') || '',
    bgImage: localStorage.getItem('dndBgImage') || '',
    bgCustoms: localStorage.getItem('dndBgCustoms') || '',
    customFeats: localStorage.getItem('dndCustomFeats') || '',
  };
}

// Apply pulled-down prefs to localStorage + the live UI. Only writes keys that are
// present in the cloud doc, and only repaints if something actually changed — so a
// device that just set a pref locally isn't fought by an older cloud value on boot.
function applyUserPrefs(meta) {
  if (!meta || typeof meta !== 'object') return;
  let visualChanged = false;
  if (typeof meta.customFeats === 'string' && meta.customFeats && typeof featMergeCustom === 'function') featMergeCustom(meta.customFeats);

  if (meta.theme) localStorage.setItem('dndTheme', meta.theme);

  if (meta.accentColor && meta.accentColor !== localStorage.getItem('dndAccentColor')) {
    localStorage.setItem('dndAccentColor', meta.accentColor);
    visualChanged = true;
  }
  if (typeof meta.fontFamily === 'string' && meta.fontFamily && meta.fontFamily !== localStorage.getItem('dndFontFamily')) {
    localStorage.setItem('dndFontFamily', meta.fontFamily);
    if (typeof applyFontFamily === 'function') applyFontFamily(meta.fontFamily);
  }
  if (typeof meta.textScalePercent !== 'undefined' && String(meta.textScalePercent) !== '' && String(meta.textScalePercent) !== localStorage.getItem('dndTextScalePercent')) {
    localStorage.setItem('dndTextScalePercent', String(meta.textScalePercent));
    if (typeof applyTextScalePercent === 'function') applyTextScalePercent(meta.textScalePercent);
  }
  if (typeof meta.bgCustoms === 'string' && meta.bgCustoms) {
    localStorage.setItem('dndBgCustoms', meta.bgCustoms);
  }
  if (typeof meta.bgImage === 'string' && meta.bgImage !== localStorage.getItem('dndBgImage')) {
    localStorage.setItem('dndBgImage', meta.bgImage);
    if (typeof bgApply === 'function') bgApply(meta.bgImage || null);
    if (typeof bgRenderPicker === 'function') bgRenderPicker();
  }

  // Accent needs the full derive+repaint (and a notes re-render) — reuse loadThemeSettings.
  if (visualChanged && typeof loadThemeSettings === 'function') loadThemeSettings();
}

function showCloudToast(message) {
  const existing = document.getElementById('__cloudToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = '__cloudToast';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--accent);color:var(--accent-contrast);padding:8px 14px;border-radius:6px;font-size:13px;z-index:9999;opacity:1;transition:opacity 0.4s';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3000);
}

// ---- migration from old single-doc format ----

async function migrateOldFormatIfNeeded() {
  try {
    const oldDoc = await userMetaRef().get();
    if (!oldDoc.exists) return;
    const data = oldDoc.data() || {};
    if (!Array.isArray(data.characters) || data.characters.length === 0) return;

    // Fan out each character into its own subcollection doc
    const batch = db.batch();
    const FieldValue = firebase.firestore.FieldValue;
    data.characters.forEach(char => {
      if (!char || !char.id) return;
      const ref = charCollection().doc(char.id);
      batch.set(ref, {
        ...char,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    // Remove the old characters array from the meta doc
    batch.update(userMetaRef(), { characters: FieldValue.delete() });
    await batch.commit();
    console.log('[sync] Migrated', data.characters.length, 'characters to subcollection');
  } catch (err) {
    console.warn('[sync] Migration check failed (non-fatal):', err);
  }
}

// ---- write: save active character to cloud ----

function scheduleSyncToCloud() {
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    syncActiveCharacterToCloud();
  }, 15000); // 15s debounce — reduces write frequency vs previous 2s
}

// ---- version-checked sync ----
// Every sheet on the cloud carries a revision number. A device remembers the cloud copy it last agreed
// with (its "base", kept in IndexedDB). To save, it checks the cloud first: if nobody else changed it the
// write goes through; if another device changed it, the two sets of edits are merged field by field, and
// only when both changed the same field is your version kept as a separate "conflict" copy. Nothing is
// overwritten blindly, and nothing is deleted from the cloud (deleting only flags the sheet).
const MAX_CLOUD_DOC = 1000000, WARN_CLOUD_DOC = 800000;
const SAFE = () => window.dndSafety;
const readLocalChars = () => (window.getStoredJSON ? window.getStoredJSON('dndCharacters', []) : JSON.parse(localStorage.getItem('dndCharacters') || '[]'));
const writeLocalChars = arr => SAFE().safeSet('dndCharacters', JSON.stringify(arr));
const tsIso = v => (v && typeof v.toMillis === 'function') ? new Date(v.toMillis()).toISOString() : (typeof v === 'string' ? v : new Date().toISOString());
// the sheet as the device stores it (no cloud-only bookkeeping fields, readable timestamps)
function toLocalChar(cloud) {
  const c = { ...cloud }; delete c.rev; delete c.deleted; delete c.deletedAt;
  c.updatedAt = tsIso(cloud.updatedAt); if (cloud.createdAt && typeof cloud.createdAt.toMillis === 'function') c.createdAt = tsIso(cloud.createdAt);
  return c;
}
// run sync jobs one at a time so a push and an incoming change never interleave
let _syncChain = Promise.resolve();
const queueSync = fn => { const run = _syncChain.then(fn, fn); _syncChain = run.catch(() => {}); return run; };

function reloadActiveSheet() {
  if (typeof loadData === 'function') loadData();
  if (typeof setupSkillCalculationFields === 'function') setupSkillCalculationFields();
  if (typeof enforceAutoMathNumericInputs === 'function') enforceAutoMathNumericInputs();
}

// Decide what a sheet should look like when the device copy and the cloud copy are both known.
function reconcile(local, cloud, base) {
  const S = SAFE(); const cn = S.leafNs(cloud), ln = S.leafNs(local);
  if (S.sameNs(cn, ln)) return { char: local, needPush: false, same: true };
  if (base && S.sameNs(cn, base.n)) return { char: local, needPush: true };                         // only this device changed
  if (base && S.sameNs(ln, base.n)) return { char: toLocalChar(cloud), needPush: false, took: 'cloud' }; // only the cloud changed
  if (base) {                                                                                       // both changed: merge per field
    const r = S.merge3(base.n, local, cloud);
    r.merged.updatedAt = new Date().toISOString();
    return { char: r.merged, conflicts: r.conflicts, needPush: !S.sameNs(S.leafNs(r.merged), cn), merged: true };
  }
  // never synced from this device: the newer copy wins, the other is kept as a restore point
  if (S.tsMs(cloud) >= S.tsMs(local)) return { char: toLocalChar(cloud), needPush: false, took: 'cloud', snapLocal: true };
  return { char: local, needPush: true, snapCloud: true };
}

async function saveConflictCopy(localChar, conflicts) {
  try {
    const copy = JSON.parse(JSON.stringify(localChar)); const now = new Date();
    copy.id = 'c' + now.getTime() + '_' + Math.random().toString(36).slice(2, 6);
    copy.name = `${localChar.name || 'Sheet'} (conflict ${now.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})`;
    if (copy.data && copy.data.characterInfo) copy.data.characterInfo.name = copy.name;
    copy.createdAt = copy.updatedAt = now.toISOString();
    const all = readLocalChars(); all.push(copy); writeLocalChars(all);
    if (typeof loadCharacterList === 'function') loadCharacterList();
    SAFE().warn(`Two devices changed the same thing on "${localChar.name}". The other device's version was kept, and yours was saved as a separate sheet called "${copy.name}". Nothing was lost.`);
    cloudPush(copy);
  } catch (e) { console.error('[sync] conflict copy failed', e); }
}

// store a reconciled sheet on this device (and refresh the form if it is the open one)
async function storeReconciled(id, mineAtStart, r, cloud) {
  const all = readLocalChars(); const i = all.findIndex(c => c.id === id);
  if (r.char !== mineAtStart) {
    if (i >= 0) { await SAFE().snapshot(all[i], r.merged ? 'before merging with another device' : 'before an update from the cloud', true); all[i] = r.char; } else all.push(r.char);
    writeLocalChars(all);
  }
  await SAFE().setBase(id, cloud.rev || 0, cloud);
  if (r.conflicts && r.conflicts.length) saveConflictCopy(mineAtStart, r.conflicts);
}

// A sheet deleted on another device is followed (and kept in Recently deleted) unless it was edited here
// after the delete happened. Opening a sheet can rewrite it slightly, so "unchanged" is judged by time.
function editedAfterDelete(local, cloud, base) {
  const delMs = cloud && cloud.deletedAt && typeof cloud.deletedAt.toMillis === 'function' ? cloud.deletedAt.toMillis() : 0;
  if (delMs) return SAFE().tsMs(local) > delMs;
  return !(base && SAFE().sameNs(SAFE().leafNs(local), base.n));
}

const cloudPush = (char, opts) => queueSync(() => pushBody(char, opts));
async function pushBody(char, opts = {}) {
  if (!currentUser || !char || !char.id) return { status: 'skipped' };
  {
    const size = JSON.stringify(char).length;
    if (size > MAX_CLOUD_DOC) { SAFE().warn(`"${char.name}" is too big to sync to the cloud (${Math.round(size / 1024)} KB, limit about 1000 KB). It is still saved on this device. Shrinking the portrait usually fixes it.`); return { status: 'toolarge' }; }
    if (size > WARN_CLOUD_DOC) showCloudToast(`Sheet is ${Math.round(size / 1024)} KB, close to the cloud limit`);
    const S = SAFE(); const FV = firebase.firestore.FieldValue; const ref = charCollection().doc(char.id);
    const base = await S.getBase(char.id); let out = null;
    try {
      await db.runTransaction(async txn => {
        out = null;
        const snap = await txn.get(ref); const cloud = snap.exists ? { ...snap.data(), id: char.id } : null; const cloudRev = cloud ? (cloud.rev || 0) : 0;
        let toWrite = char, conflicts = [], merged = false;
        if (cloud && cloud.deleted && !opts.undelete) {
          out = editedAfterDelete(char, cloud, base) ? { status: 'deleted-edited' } : { status: 'deleted-elsewhere' }; return;
        }
        if (cloud && !cloud.deleted) {
          const r = reconcile(char, cloud, base);
          if (r.same) { out = { status: 'same', rev: cloudRev, cloud }; return; }
          if (!r.needPush) { out = { status: 'cloud-newer', rev: cloudRev, cloud, r }; return; }
          toWrite = r.char; conflicts = r.conflicts || []; merged = !!r.merged;
        }
        const payload = { ...toWrite, id: char.id, rev: cloudRev + 1, updatedAt: FV.serverTimestamp() };
        if (opts.undelete) { payload.deleted = false; payload.deletedAt = null; }
        txn.set(ref, payload);
        out = { status: 'written', rev: cloudRev + 1, toWrite, conflicts, merged, cloudBefore: cloud };
      });
    } catch (err) { console.error('[sync] Upload failed:', err); return { status: 'error', err }; }

    if (out.status === 'deleted-elsewhere') {            // deleted on another device and untouched here: follow the delete, keep a copy
      const all = readLocalChars(); await S.trashChar(char, 'deleted on another device');
      writeLocalChars(all.filter(c => c.id !== char.id)); await S.dropBase(char.id);
      if (typeof loadCharacterList === 'function') loadCharacterList();
      showCloudToast(`"${char.name}" was deleted on another device (restore it in Settings)`);
      return out;
    }
    if (out.status === 'deleted-edited') return pushBody(char, { undelete: true });   // you edited a sheet deleted elsewhere: keep it
    if (out.status === 'same' || out.status === 'cloud-newer') {
      const cloud = out.cloud; const mine = readLocalChars().find(c => c.id === char.id) || char;
      const r = out.r || reconcile(mine, cloud, base);
      await storeReconciled(char.id, mine, r, cloud);
      if (r.char !== mine && window.currentCharacter === char.id) reloadActiveSheet();
      return out;
    }
    // written: the base is now what we wrote; if a merge changed the sheet, bring this device up to date
    const written = { ...out.toWrite, id: char.id };
    await S.setBase(char.id, out.rev, written);
    if (window.__unsavedChars) delete window.__unsavedChars[char.id];
    if (out.merged) {
      const all = readLocalChars(); const i = all.findIndex(c => c.id === char.id);
      if (i >= 0) {
        const cur = all[i]; await S.snapshot(cur, 'before merging with another device', true);
        // keep anything typed while the save was in flight
        all[i] = S.sameNs(S.leafNs(cur), S.leafNs(char)) ? written : S.merge3(S.leafNs(char), cur, written).merged;
        writeLocalChars(all);
        if (window.currentCharacter === char.id) reloadActiveSheet();
      }
      showCloudToast('Merged changes from another device');
      if (out.conflicts.length) saveConflictCopy(char, out.conflicts);
    }
    return out;
  }
}

async function cloudMarkDeleted(id) {
  if (!currentUser || !id) return;
  try {
    await charCollection().doc(id).update({ deleted: true, deletedAt: firebase.firestore.FieldValue.serverTimestamp(), rev: firebase.firestore.FieldValue.increment(1) });
    await SAFE().dropBase(id);
  } catch (e) { console.warn('[sync] could not flag delete yet (will retry on next sync):', e && e.code); }
}
async function cloudUndelete(char) { await SAFE().dropBase(char.id); return cloudPush(char, { undelete: true }); }
async function listCloudDeleted() {
  if (!currentUser) return [];
  const snap = await charCollection().where('deleted', '==', true).get();
  // sheets deleted more than 30 days ago drop off the restore list (the cloud copy is kept; the owner can still restore it from Admin)
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  return snap.docs.filter(d => { const t = d.data().deletedAt; const ms = t && t.toMillis ? t.toMillis() : 0; return !ms || ms > cutoff; }).map(d => ({ id: d.id, name: d.data().name || 'Sheet' }));
}
// Delete a sheet that is ALREADY flagged deleted for good (the user chose "delete for good" in Sheet safety).
// Refuses to touch a live sheet, so a stray call can never remove one that is in use.
async function cloudPurge(id) {
  if (!currentUser || !id) return false;
  const ref = charCollection().doc(id); const d = await ref.get();
  if (!d.exists) return true;
  if (!d.data().deleted) return false;
  await ref.delete(); await SAFE().dropBase(id); return true;
}
async function cloudFetchDeleted(id) {
  const d = await charCollection().doc(id).get(); if (!d.exists) return null;
  const c = toLocalChar({ ...d.data(), id }); return c;
}

// ---- write: save active character to cloud ----

async function syncActiveCharacterToCloud() {
  if (!currentUser || !window.currentCharacter) return;
  const id = window.currentCharacter;
  const char = (window.__unsavedChars && window.__unsavedChars[id]) || readLocalChars().find(c => c.id === id);
  if (!char) return;
  await cloudPush(char);
  try { await userMetaRef().set({ ...gatherUserPrefs(), lastModified: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); }
  catch (err) { console.error('[sync] Prefs upload failed:', err); }
}

// 3-step confirm state for the manual sync-up button
const syncUpConfirmState = {};
function handleSyncUpConfirm(btn) {
  const state = syncUpConfirmState;
  if (!state.step) {
    // Step 1: first click
    state.step = 1;
    const localChars = window.getStoredJSON
      ? window.getStoredJSON('dndCharacters', [])
      : JSON.parse(localStorage.getItem('dndCharacters') || '[]');
    btn.textContent = `Send ${localChars.length} sheet${localChars.length !== 1 ? 's' : ''} to the cloud?`;
    btn.style.background = '#c0392b';
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => resetSyncUpBtn(btn), 6000);
    return;
  }
  if (state.step === 1) {
    // Step 2: second click
    state.step = 2;
    btn.textContent = 'Yes, send changes (nothing is deleted)';
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => resetSyncUpBtn(btn), 6000);
    return;
  }
  if (state.step === 2) {
    // Step 3: confirmed — go
    resetSyncUpBtn(btn);
    syncToCloud();
  }
}
function resetSyncUpBtn(btn) {
  if (!btn) return;
  const state = syncUpConfirmState;
  state.step = 0;
  if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  btn.textContent = 'Sync Up Now';
  btn.style.background = '';
}

// Manual sync-up: sends every sheet on this device that is new or changed. It never deletes anything
// in the cloud, and a sheet that changed elsewhere is merged, not overwritten.
async function syncToCloud(silent = false) {
  if (!currentUser) {
    if (!silent) setSyncStatus('Please sign in first');
    return;
  }
  try {
    if (!silent) setSyncStatus('Uploading to cloud...');
    const tomb = window.getStoredJSON('dndDeletedCharacters', {});
    const local = readLocalChars().filter(c => !tomb[c.id]);
    let wrote = 0, failed = 0;
    for (const ch of local) { const r = await cloudPush((window.__unsavedChars && window.__unsavedChars[ch.id]) || ch); if (r && r.status === 'written') wrote++; else if (r && (r.status === 'error' || r.status === 'toolarge')) failed++; }
    for (const id of Object.keys(tomb)) await cloudMarkDeleted(id);
    try { await userMetaRef().set({ ...gatherUserPrefs(), lastModified: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch (e) { /* prefs are best effort */ }
    if (!silent) setSyncStatus(failed ? `${failed} sheet${failed > 1 ? 's' : ''} could not be uploaded` : (wrote ? `Uploaded ${wrote} changed sheet${wrote > 1 ? 's' : ''}` : 'Everything is already up to date'));
  } catch (err) {
    console.error('[sync] syncToCloud error:', err);
    if (!silent) setSyncStatus('Upload failed: ' + err.message);
  }
}

// ---- read: pull characters from cloud ----

// Boot / sign-in / manual "Sync Down": brings this device up to date without ever wiping it.
// For each sheet: only the cloud changed -> take the cloud copy; only this device changed -> keep it and
// send it up; both changed -> merge field by field. Sheets only on this device are kept and uploaded.
// Sheets deleted elsewhere are moved to "Recently deleted" here, never erased.
async function syncFromCloud(silent = false) {
  if (!currentUser) {
    if (!silent) setSyncStatus('Please sign in first');
    return;
  }
  return queueSync(async () => {
    try {
      if (!silent) setSyncStatus('Downloading from cloud...');
      await migrateOldFormatIfNeeded();
      const S = SAFE();
      const snapshot = await charCollection().get();
      const cloudDocs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));

      // appearance prefs (theme/accent/font/text-scale/background) apply live
      const metaSnap = await userMetaRef().get();
      applyUserPrefs(metaSnap.exists ? (metaSnap.data() || {}) : {});

      let local = readLocalChars(); const tomb = window.getStoredJSON('dndDeletedCharacters', {});
      const cloudIds = new Set(cloudDocs.map(c => c.id)); const toPush = []; const conflictCopies = [];
      let added = 0, updated = 0, trashed = 0; let activeChanged = false;

      for (const cloud of cloudDocs) {
        const id = cloud.id; const mine = local.find(c => c.id === id); const base = await S.getBase(id);
        if (cloud.deleted) {
          if (!mine) continue;
          if (!editedAfterDelete(mine, cloud, base)) { await S.trashChar(mine, 'deleted on another device'); local = local.filter(c => c.id !== id); await S.dropBase(id); trashed++; if (window.currentCharacter === id) activeChanged = true; }
          else toPush.push(mine);                                   // edited here since: keep it (the push un-deletes it)
          continue;
        }
        if (tomb[id]) { cloudMarkDeleted(id); continue; }           // deleted on this device earlier; make sure the cloud knows
        if (!mine) { local.push(toLocalChar(cloud)); await S.setBase(id, cloud.rev || 0, cloud); added++; continue; }
        const r = reconcile(mine, cloud, base);
        if (r.snapLocal) await S.snapshot(mine, 'before the cloud copy replaced it', true);
        if (r.snapCloud) await S.snapshot(toLocalChar(cloud), 'cloud copy before your newer copy replaced it', true);
        if (r.char !== mine) { await S.snapshot(mine, r.merged ? 'before merging with another device' : 'before an update from the cloud', true); local[local.indexOf(mine)] = r.char; updated++; if (window.currentCharacter === id) activeChanged = true; }
        await S.setBase(id, cloud.rev || 0, cloud);
        if (r.conflicts && r.conflicts.length) conflictCopies.push([mine, r.conflicts]);
        if (r.needPush) toPush.push(r.char);
      }
      for (const mine of local) if (!cloudIds.has(mine.id) && !tomb[mine.id]) toPush.push(mine);   // new on this device

      if (added || updated || trashed) writeLocalChars(local);
      if (typeof loadCharacterList === 'function') loadCharacterList();
      for (const [m, c] of conflictCopies) await saveConflictCopy(m, c);

      // open the last-used sheet, or the first one
      const finalChars = readLocalChars();
      const lastId = localStorage.getItem('dndLastSelectedCharacter');
      const target = (lastId && finalChars.find(c => c.id === lastId)) ? lastId : (finalChars[0] && finalChars[0].id) || null;
      if (target) {
        const switching = window.currentCharacter !== target;
        window.currentCharacter = target; rememberSelectedCharacter(target);
        if (switching || activeChanged || window.__loadedCharId !== target) reloadActiveSheet();
        startActiveCharacterListener(target);
      }
      for (const ch of toPush) { if (ch && !(tomb[ch.id])) await pushBody(ch); }

      if (!silent) setSyncStatus(`Up to date: ${finalChars.length} sheet${finalChars.length !== 1 ? 's' : ''}${added ? `, ${added} new` : ''}${updated ? `, ${updated} updated` : ''}${toPush.length ? `, ${toPush.length} sent up` : ''}`);
      else if (added || updated) showCloudToast('Synced from cloud');
    } catch (err) {
      console.error('[sync] Download failed:', err);
      if (!silent) setSyncStatus('Download failed: ' + err.message);
    }
  });
}

// 3-step confirm state for the manual sync-down button
const syncDownConfirmState = {};
function handleSyncDownConfirm(btn) {
  const state = syncDownConfirmState;
  if (!state.step) {
    state.step = 1;
    btn.textContent = 'Bring this device up to date?';
    btn.style.background = '#c0392b';
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => resetSyncDownBtn(btn), 6000);
    return;
  }
  if (state.step === 1) {
    state.step = 2;
    btn.textContent = 'Yes, update (nothing is wiped)';
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => resetSyncDownBtn(btn), 6000);
    return;
  }
  if (state.step === 2) {
    resetSyncDownBtn(btn);
    syncFromCloud(false);
  }
}
function resetSyncDownBtn(btn) {
  if (!btn) return;
  const state = syncDownConfirmState;
  state.step = 0;
  if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  btn.textContent = 'Sync Down Now';
  btn.style.background = '';
}

// ---- live listener: watch the active character only ----

// A change arrived from another device. Fold it into this device's copy without losing local edits.
async function handleRemoteChange(cloud, charId) {
  const S = SAFE();
  const base = await S.getBase(charId);
  if (base && S.sameNs(S.leafNs(cloud), base.n)) return;              // nothing new (this is the echo of our own save)
  if (cloud.deleted) return;                                           // deletes are applied on the next full sync
  if (typeof autosave === 'function') autosave();                      // capture whatever is typed right now
  const mine = readLocalChars().find(c => c.id === charId); if (!mine) return;
  const r = reconcile(mine, cloud, base);
  if (r.snapLocal) await S.snapshot(mine, 'before the cloud copy replaced it', true);
  await storeReconciled(charId, mine, r, cloud);
  if (r.char !== mine && window.currentCharacter === charId) { reloadActiveSheet(); showCloudToast(r.merged ? 'Merged changes from another device' : 'Sheet updated from another device'); }
  if (r.needPush) setTimeout(() => { const cur = readLocalChars().find(c => c.id === charId); if (cur) cloudPush(cur); }, 800);
}

function startActiveCharacterListener(charId) {
  stopActiveCharacterListener();
  if (!currentUser || !charId) return;

  activeCharacterUnsubscribe = charCollection().doc(charId).onSnapshot(snap => {
    if (!snap.exists) return;
    if (window.currentCharacter !== charId) return;
    if (snap.metadata.hasPendingWrites) return;                         // our own write in flight
    queueSync(() => handleRemoteChange({ ...snap.data(), id: snap.id }, charId)).catch(err => console.warn('[sync] remote change failed:', err));
  }, err => {
    console.warn('[sync] Live listener error:', err);
  });
}

function stopActiveCharacterListener() {
  if (activeCharacterUnsubscribe) {
    activeCharacterUnsubscribe();
    activeCharacterUnsubscribe = null;
  }
}

// Called by loadSelectedCharacter in core.js whenever the active character changes
function onActiveCharacterChanged(charId) {
  if (!currentUser || !charId) return;
  startActiveCharacterListener(charId);
}

// ---- boot ----

Object.assign(window, {
  signInWithGoogle,
  signOut,
  syncToCloud,
  syncFromCloud,
  scheduleSyncToCloud,
  onActiveCharacterChanged,
  stopActiveCharacterListener,
  cloudMarkDeleted,
  cloudUndelete,
  listCloudDeleted,
  cloudPurge,
  cloudFetchDeleted
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve();
  return navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('Service Worker registration failed:', err);
  });
}

function initCloudFirebase() {
  initializeFirebase();
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCloudFirebase);
} else {
  initCloudFirebase();
}


