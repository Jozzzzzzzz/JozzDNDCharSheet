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
  }

  const syncUpBtn = document.querySelector('.settings-sync-up-btn');
  if (syncUpBtn && syncUpBtn.dataset.authBound !== '1') {
    syncUpBtn.dataset.authBound = '1';
    syncUpBtn.type = 'button';
    syncUpBtn.addEventListener('click', (event) => {
      event.preventDefault();
      syncToCloud();
    });
  }

  const syncDownBtn = document.querySelector('.settings-sync-down-btn');
  if (syncDownBtn && syncDownBtn.dataset.authBound !== '1') {
    syncDownBtn.dataset.authBound = '1';
    syncDownBtn.type = 'button';
    syncDownBtn.addEventListener('click', (event) => {
      event.preventDefault();
      syncFromCloud();
    });
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

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      window.currentUser = user;
      updateAuthUI();
      if (user) {
        setSyncStatus('Signed in successfully');
        handleSignedInUser(user).catch((err) => {
          console.error('Signed-in user handling error:', err);
        });
        // Auto-sync from cloud when user signs in
        setTimeout(() => syncFromCloud(true), 1000);
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

  const flags = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? (snap.data() || {}) : {};
    const knownDevices = data.knownDevices || {};
    const firstEver = !snap.exists;
    const newDevice = !knownDevices || !Object.prototype.hasOwnProperty.call(knownDevices, deviceId);

    let knownDeviceCount = Number(data.knownDeviceCount);
    if (!Number.isFinite(knownDeviceCount)) {
      knownDeviceCount = Object.keys(knownDevices || {}).length;
    }
    if (newDevice) knownDeviceCount += 1;

    const FieldValue = firebase.firestore.FieldValue;
    const update = {
      email: user.email || '',
      lastSignInAt: FieldValue.serverTimestamp(),
      lastDeviceId: deviceId,
      knownDeviceCount: knownDeviceCount,
      // Presence: updated by heartbeat too, but set once on sign-in.
      lastSeenAt: FieldValue.serverTimestamp()
    };

    // Nested device stats (dot-path updates so we don't overwrite other devices).
    update[`knownDevices.${deviceId}.lastSeenAt`] = FieldValue.serverTimestamp();
    update[`knownDevices.${deviceId}.lastSignInAt`] = FieldValue.serverTimestamp();
    update[`knownDevices.${deviceId}.ua`] = (navigator.userAgent || '').slice(0, 180);
    update[`knownDevices.${deviceId}.lastSignInIso`] = nowIso;
    if (newDevice) {
      update[`knownDevices.${deviceId}.firstSeenAt`] = FieldValue.serverTimestamp();
      update[`knownDevices.${deviceId}.firstSeenIso`] = nowIso;
    }

    if (firstEver) {
      update.firstSeenAt = FieldValue.serverTimestamp();
      update.firstSeenIso = nowIso;
      update.signInCount = 1;
    } else {
      update.signInCount = FieldValue.increment(1);
    }

    tx.set(docRef, update, { merge: true });
    return { firstEver, newDevice };
  });

  if (!isOwnerEmail(user.email) && (flags.firstEver || flags.newDevice)) {
    const subject = flags.firstEver ? 'New User Sign-In (First Time)' : 'New User Sign-In (New Device)';
    const message = `A user signed in with Google.\n\nEmail: ${user.email || 'unknown'}\nUID: ${user.uid}\nDevice: ${deviceId}\nEvent: ${flags.firstEver ? 'first_time' : 'new_device'}\nTime: ${nowIso}`;
    await sendOwnerNotification(subject, message, {
      event_type: flags.firstEver ? 'google_signin_first' : 'google_signin_new_device',
      signed_in_email: user.email || '',
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
  if (now - lastPresenceAt < 45000) return; // throttle
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
  presenceTimer = setInterval(sendPresenceHeartbeat, 60000);
  // Also bump on focus/visibility (attach once)
  if (!presenceListenersAttached) {
    presenceListenersAttached = true;
    window.addEventListener('focus', sendPresenceHeartbeat);
    document.addEventListener('visibilitychange', onPresenceVisibilityChange);
  }
  // Expose for autosave hook
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
    const nickname = prompt('Pick a name/nickname to show in the app (you can change it later):') || '';
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
      alert('Firebase is still loading. Please wait a moment and try again.');
      return;
    }

    if (!firebase.auth) {
      console.error('Firebase auth module not available');
      setSyncStatus('Firebase auth not available');
      alert('Firebase authentication is not available. Please refresh the page.');
      return;
    }

    if (!window.auth && !ensureFirebaseReady()) {
      console.error('Firebase auth instance not initialized');
      setSyncStatus('Authentication not ready');
      alert('Authentication is not ready yet. Please wait a moment and try again.');
      return;
    }

    setSyncStatus('Opening sign-in popup...');

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
    alert(errorMessage);
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
let lastOwnSaveAt = 0;

// ---- helpers ----

function charCollection() {
  return db.collection('userData').doc(currentUser.uid).collection('characters');
}

function userMetaRef() {
  return db.collection('userData').doc(currentUser.uid);
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
  }, 2000);
}

async function syncActiveCharacterToCloud() {
  if (!currentUser || !window.currentCharacter) return;
  try {
    const characters = window.getStoredJSON
      ? window.getStoredJSON('dndCharacters', [])
      : JSON.parse(localStorage.getItem('dndCharacters') || '[]');
    const char = characters.find(c => c.id === window.currentCharacter);
    if (!char) return;

    const FieldValue = firebase.firestore.FieldValue;
    // Record the moment we fire this write — the snapshot echo will arrive
    // within a few seconds and must be ignored.
    lastOwnSaveAt = Date.now();
    await charCollection().doc(char.id).set({
      ...char,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Keep user meta (theme/accent) in sync
    const theme = localStorage.getItem('dndTheme') || 'dark';
    const accentColor = localStorage.getItem('dndAccentColor') || '#ffd700';
    await userMetaRef().set({ theme, accentColor, lastModified: FieldValue.serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error('[sync] Upload failed:', err);
  }
}

// Legacy name used by manual sync-up button in settings
async function syncToCloud(silent = false) {
  if (!currentUser) {
    if (!silent) setSyncStatus('Please sign in first');
    return;
  }
  try {
    if (!silent) setSyncStatus('Uploading to cloud...');
    await syncActiveCharacterToCloud();
    if (!silent) setSyncStatus('Uploaded to cloud');
  } catch (err) {
    console.error('[sync] syncToCloud error:', err);
    if (!silent) setSyncStatus('Upload failed: ' + err.message);
  }
}

// ---- read: pull all characters from cloud on boot ----

async function syncFromCloud(silent = false) {
  if (!currentUser) {
    if (!silent) setSyncStatus('Please sign in first');
    return;
  }
  try {
    if (!silent) setSyncStatus('Downloading from cloud...');

    await migrateOldFormatIfNeeded();

    const snapshot = await charCollection().get();
    if (snapshot.empty) {
      if (!silent) setSyncStatus('No cloud data found');
      return;
    }

    const cloudChars = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));

    // Pull theme/accent from meta doc
    const metaSnap = await userMetaRef().get();
    const meta = metaSnap.exists ? (metaSnap.data() || {}) : {};
    if (meta.theme) localStorage.setItem('dndTheme', meta.theme);
    if (meta.accentColor) localStorage.setItem('dndAccentColor', meta.accentColor);

    // Merge cloud chars with local: newer updatedAt wins per character
    const localChars = window.getStoredJSON
      ? window.getStoredJSON('dndCharacters', [])
      : JSON.parse(localStorage.getItem('dndCharacters') || '[]');

    const merged = mergeByUpdatedAt(localChars, cloudChars);
    localStorage.setItem('dndCharacters', JSON.stringify(merged));

    if (!silent) {
      setSyncStatus(`Synced ${merged.length} character(s)`);
    }

    loadCharacterList();

    // Load the last-used character, or first in list
    const lastId = localStorage.getItem('dndLastSelectedCharacter');
    const target = (lastId && merged.find(c => c.id === lastId)) ? lastId : (merged[0]?.id || null);
    if (target) {
      window.currentCharacter = target;
      rememberSelectedCharacter(target);
      loadData();
      if (typeof setupSkillCalculationFields === 'function') setupSkillCalculationFields();
      if (typeof enforceAutoMathNumericInputs === 'function') enforceAutoMathNumericInputs();
      startActiveCharacterListener(target);
    }

    if (silent) showCloudToast('Synced from cloud');
  } catch (err) {
    console.error('[sync] Download failed:', err);
    if (!silent) setSyncStatus('Download failed: ' + err.message);
  }
}

// Merge two character arrays: for each id, keep the one with the newer updatedAt.
// Characters only in one list are included as-is.
function mergeByUpdatedAt(local, cloud) {
  const map = new Map();
  const ts = c => {
    if (!c) return 0;
    // Firestore Timestamp object
    if (c.updatedAt && typeof c.updatedAt.toMillis === 'function') return c.updatedAt.toMillis();
    if (c.updatedAt) return Date.parse(c.updatedAt) || 0;
    if (c.createdAt) return Date.parse(c.createdAt) || 0;
    return 0;
  };
  [...(local || []), ...(cloud || [])].forEach(c => {
    if (!c || !c.id) return;
    const existing = map.get(c.id);
    if (!existing || ts(c) >= ts(existing)) map.set(c.id, c);
  });
  return Array.from(map.values());
}

// ---- live listener: watch the active character only ----

function startActiveCharacterListener(charId) {
  stopActiveCharacterListener();
  if (!currentUser || !charId) return;

  activeCharacterUnsubscribe = charCollection().doc(charId).onSnapshot(snap => {
    if (!snap.exists) return;
    if (window.currentCharacter !== charId) return;

    // Suppress echoes from our own saves — any snapshot arriving within
    // 10 seconds of our last write is almost certainly our own echo.
    if (Date.now() - lastOwnSaveAt < 10000) return;

    const cloudChar = { ...snap.data(), id: snap.id };
    const chars = window.getStoredJSON
      ? window.getStoredJSON('dndCharacters', [])
      : JSON.parse(localStorage.getItem('dndCharacters') || '[]');

    // Another device is ahead — apply silently
    const updated = chars.map(c => c.id === charId ? cloudChar : c);
    localStorage.setItem('dndCharacters', JSON.stringify(updated));

    loadData();
    if (typeof setupSkillCalculationFields === 'function') setupSkillCalculationFields();
    if (typeof enforceAutoMathNumericInputs === 'function') enforceAutoMathNumericInputs();
    showCloudToast('Sheet updated from another device');
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
  stopActiveCharacterListener
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


