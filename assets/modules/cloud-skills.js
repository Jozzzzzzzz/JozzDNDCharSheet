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
const OWNER_EMAIL = 'vanreejoz33@gmail.com';

function initializeFirebase() {
  try {
    console.log('=== Firebase Initialization Starting ===');
    console.log('Firebase global available:', typeof firebase !== 'undefined');
    
    // Verify Firebase libraries are loaded
    if (typeof firebase === 'undefined') {
      console.error('Firebase library not loaded');
      setSyncStatus('Firebase library not available');
      return;
    }
    
    console.log('Firebase object:', Object.keys(firebase || {}));
    
    // Prevent multiple initialization attempts
    if (firebaseApp) {
      console.log('Firebase already initialized');
      return;
    }
    
    console.log('Initializing Firebase with config:', firebaseConfig.projectId);
    firebaseApp = firebase.initializeApp(firebaseConfig);
    console.log('Firebase app initialized:', firebaseApp.name);
    
    auth = firebase.auth();
    console.log('Auth initialized:', typeof auth);
    
    // Set persistence to LOCAL so user stays logged in
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
      console.log('Persistence error (non-critical):', err);
    });
    
    window.auth = auth; // Make auth globally available for button check
    console.log('Auth set to window.auth');
    
    db = firebase.firestore();
    console.log('Firestore initialized:', typeof db);
    window.db = db;
    console.log('Firestore set to window.db');

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      console.log('Auth state changed. User:', user ? user.email : 'null');
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

    console.log('Firebase initialized successfully');
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
  console.log('=== updateAuthUI called ===');
  const signedInView = document.getElementById('signedInView');
  const signedOutView = document.getElementById('signedOutView');
  const userEmail = document.getElementById('userEmail');
  const signInBtn = document.getElementById('signInBtn');

  console.log('signedInView:', signedInView ? 'found' : 'NOT FOUND');
  console.log('signedOutView:', signedOutView ? 'found' : 'NOT FOUND');
  console.log('userEmail:', userEmail ? 'found' : 'NOT FOUND');
  console.log('signInBtn:', signInBtn ? 'found' : 'NOT FOUND');
  console.log('currentUser:', currentUser ? currentUser.email : 'null');
  console.log('auth object:', auth ? 'exists' : 'NOT EXISTS');

  if (currentUser) {
    console.log('User is signed in, showing signed-in view');
    if (signedInView) signedInView.style.display = 'block';
    if (signedOutView) signedOutView.style.display = 'none';
    if (userEmail) userEmail.textContent = currentUser.email;
  } else {
    console.log('User is NOT signed in, showing sign-out view');
    if (signedInView) signedInView.style.display = 'none';
    if (signedOutView) signedOutView.style.display = 'block';
    // Enable/disable sign-in button based on Firebase availability
    if (signInBtn) {
      const shouldEnable = !!auth;
      console.log('Setting button disabled to:', !shouldEnable, '(auth exists:', shouldEnable, ')');
      signInBtn.disabled = !auth;
      signInBtn.textContent = auth ? 'Sign In with Google' : 'Loading...';
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
}

// Authentication Functions
async function signInWithGoogle() {
  try {
    console.log('=== Sign-in attempt started ===');
    console.log('Firebase defined:', typeof firebase !== 'undefined');
    console.log('Firebase.auth:', typeof firebase?.auth);
    console.log('window.auth:', typeof window.auth);
    
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

    if (!window.auth) {
      console.error('Firebase auth instance not initialized');
      setSyncStatus('Authentication not ready');
      alert('Authentication is not ready yet. Please wait a moment and try again.');
      return;
    }

    console.log('All Firebase checks passed, proceeding with sign-in...');
    setSyncStatus('Opening sign-in popup...');

    const provider = new firebase.auth.GoogleAuthProvider();
    console.log('GoogleAuthProvider created:', provider);
    
    // Add scopes if needed
    provider.addScope('email');
    provider.addScope('profile');
    console.log('Scopes added');

    let result;
    console.log('Attempting signInWithPopup...');
    try {
      result = await window.auth.signInWithPopup(provider);
      console.log('Sign-in successful (popup):', result.user.email);
      setSyncStatus('Signed in successfully');
    } catch (popupError) {
      console.log('Popup error:', popupError.code, popupError.message);
      
      // If popup fails, try redirect method
      if (popupError.code === 'auth/popup-blocked' || 
          popupError.code === 'auth/operation-not-supported-in-this-environment' ||
          popupError.message?.includes('popup')) {
        console.log('Popup unavailable, trying redirect method...');
        setSyncStatus('Redirecting to sign-in...');
        
        try {
          await window.auth.signInWithRedirect(provider);
          console.log('Redirect initiated');
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
      console.log('Current domain:', window.location.hostname);
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

// Cloud Sync Functions
async function syncToCloud() {
  if (!currentUser) {
    setSyncStatus('Please sign in first');
    return;
  }
  
  try {
    setSyncStatus('Uploading to cloud...');
    
    // Get current character data
    const characters = window.getStoredJSON ? window.getStoredJSON('dndCharacters', []) : (JSON.parse(localStorage.getItem('dndCharacters') || '[]'));
    const theme = localStorage.getItem('dndTheme') || 'dark';
    const accentColor = localStorage.getItem('dndAccentColor') || '#ffd700';
    
    const userData = {
      characters: characters,
      theme: theme,
      accentColor: accentColor,
      lastSync: firebase.firestore.FieldValue.serverTimestamp(),
      version: '1.0'
    };
    
    // Save to Firestore
    await db.collection('userData').doc(currentUser.uid).set(userData);
    
    setSyncStatus(`Uploaded ${characters.length} characters to cloud`);
  } catch (error) {
    console.error('Upload error:', error);
    setSyncStatus('Upload failed: ' + error.message);
  }
}

async function syncFromCloud(silent = false) {
  if (!currentUser) {
    if (!silent) setSyncStatus('Please sign in first');
    return;
  }
  
  try {
    if (!silent) setSyncStatus('Downloading from cloud...');
    
    // Get data from Firestore
    const doc = await db.collection('userData').doc(currentUser.uid).get();
    
    if (!doc.exists) {
      if (!silent) setSyncStatus('No cloud data found');
      return;
    }
    
    const userData = doc.data();
    
    // Ask user if they want to replace local data
    const localCharacters = window.getStoredJSON ? window.getStoredJSON('dndCharacters', []) : (JSON.parse(localStorage.getItem('dndCharacters') || '[]'));
    const cloudCharacters = userData.characters || [];
    
    let shouldReplace = true;
    if (!silent && localCharacters.length > 0) {
      shouldReplace = confirm(
        `Replace ${localCharacters.length} local characters with ${cloudCharacters.length} cloud characters?`
      );
    }
    
    if (shouldReplace) {
      // Replace local data with cloud data
      localStorage.setItem('dndCharacters', JSON.stringify(cloudCharacters));
      if (userData.theme) localStorage.setItem('dndTheme', userData.theme);
      if (userData.accentColor) localStorage.setItem('dndAccentColor', userData.accentColor);
      
      // Refresh the page to load new data
      if (!silent) {
        setSyncStatus(`Downloaded ${cloudCharacters.length} characters`);
        setTimeout(() => {
          if (confirm('Reload page to apply synced data?')) {
            location.reload();
          }
        }, 1000);
      } else {
        // Silent sync - just reload character list
        loadCharacterList();
        if (cloudCharacters.length > 0) {
          currentCharacter = cloudCharacters[0].id;
          loadData();
          setupSkillCalculationFields();
          enforceAutoMathNumericInputs();
        }
      }
    }
  } catch (error) {
    console.error('Download error:', error);
    if (!silent) setSyncStatus('Download failed: ' + error.message);
  }
}

// Auto-sync functionality
function enableAutoSync() {
  // Auto-save to cloud every 5 minutes if signed in
  setInterval(() => {
    if (currentUser) {
      syncToCloud();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Enhanced autosave to include cloud sync
// Defer wrapping autosave since core.js might still be loading
setTimeout(() => {
  if (typeof autosave === 'function' && !autosave.__cloudSyncWrapped) {
    const originalAutosave = autosave;
    autosave = function() {
      // Call original autosave
      originalAutosave();
      
      // If user is signed in, schedule a cloud sync
      if (currentUser) {
        // Debounce cloud sync to avoid too many uploads
        clearTimeout(window.cloudSyncTimeout);
        window.cloudSyncTimeout = setTimeout(() => {
          syncToCloud();
        }, 10000); // Sync 10 seconds after last change
      }
    };
    autosave.__cloudSyncWrapped = true;
  }
}, 100);

// Skill calculation + numeric input helpers
const SKILL_ABILITY_MAP = {
  acrobatics: 'dex',
  animal_handling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  survival: 'wis'
};

const SKILL_LIST = Object.keys(SKILL_ABILITY_MAP);
const ABILITY_LIST = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const autoMathOverrideState = {
  profBonus: false,
  abilityBonus: ABILITY_LIST.reduce((acc, ability) => {
    acc[ability] = false;
    return acc;
  }, {})
};

function formatSignedNumber(value) {
  const n = parseInt(value, 10) || 0;
  return n >= 0 ? `+${n}` : `${n}`;
}

function parseSignedNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).trim().replace(/[^0-9+-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function sanitizeDigits(value, maxLength = null) {
  let cleaned = String(value || '').replace(/\D/g, '');
  if (maxLength) cleaned = cleaned.slice(0, maxLength);
  return cleaned;
}

function sanitizeSignedValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '+0';
  const sign = trimmed.startsWith('-') ? '-' : '+';
  const digits = trimmed.replace(/\D/g, '');
  const numeric = digits ? parseInt(digits, 10) : 0;
  return sign === '-' ? `-${numeric}` : `+${numeric}`;
}

function getCalculatedAbilityBonus(ability) {
  const scoreInput = document.getElementById(ability);
  if (!scoreInput) return '+0';
  const score = parseInt(scoreInput.value, 10) || 0;
  return formatSignedNumber(Math.floor((score - 10) / 2));
}

function setAbilityBonusOverride(ability, isOverridden) {
  if (!Object.prototype.hasOwnProperty.call(autoMathOverrideState.abilityBonus, ability)) return;
  autoMathOverrideState.abilityBonus[ability] = !!isOverridden;
}

function setProficiencyBonusOverride(isOverridden) {
  autoMathOverrideState.profBonus = !!isOverridden;
}

function syncAutoMathOverridesFromCurrentValues() {
  ABILITY_LIST.forEach(ability => {
    const bonusInput = document.getElementById(`${ability}_bonus`);
    if (!bonusInput) return;
    const rawValue = String(bonusInput.value || '').trim();
    if (!rawValue) {
      setAbilityBonusOverride(ability, false);
      bonusInput.value = getCalculatedAbilityBonus(ability);
      return;
    }
    const current = sanitizeSignedValue(bonusInput.value);
    const calculated = getCalculatedAbilityBonus(ability);
    setAbilityBonusOverride(ability, current !== calculated);
    bonusInput.value = current;
  });

  const profBonusInput = document.getElementById('prof_bonus');
  if (profBonusInput) {
    const rawValue = String(profBonusInput.value || '').trim();
    if (!rawValue) {
      setProficiencyBonusOverride(false);
      profBonusInput.value = calculateProficiencyBonus();
      return;
    }
    const current = sanitizeSignedValue(profBonusInput.value);
    const calculated = calculateProficiencyBonus();
    setProficiencyBonusOverride(current !== calculated);
    profBonusInput.value = current;
  }
}

function bindAutoMathOverrideInputs() {
  ABILITY_LIST.forEach(ability => {
    const bonusInput = document.getElementById(`${ability}_bonus`);
    if (!bonusInput || bonusInput.dataset.bonusOverrideBound === '1') return;
    bonusInput.dataset.bonusOverrideBound = '1';
    bonusInput.readOnly = false;
    bonusInput.removeAttribute('readonly');
    bonusInput.inputMode = 'numeric';

    bonusInput.addEventListener('input', () => {
      const cleaned = String(bonusInput.value || '').replace(/[^0-9-]/g, '');
      const normalized = cleaned.startsWith('-')
        ? '-' + cleaned.slice(1).replace(/-/g, '')
        : cleaned.replace(/-/g, '');
      bonusInput.value = normalized;
      setAbilityBonusOverride(ability, true);
      calculateSavingThrow(ability);
      updateAllSkillBonuses();
      if (typeof autosave === 'function') autosave();
    });

    bonusInput.addEventListener('blur', () => {
      const trimmed = String(bonusInput.value || '').trim();
      if (!trimmed) {
        setAbilityBonusOverride(ability, false);
        calculateAbilityBonus(ability);
      } else {
        bonusInput.value = sanitizeSignedValue(trimmed);
        setAbilityBonusOverride(ability, bonusInput.value !== getCalculatedAbilityBonus(ability));
        calculateSavingThrow(ability);
        updateAllSkillBonuses();
      }
      if (typeof autosave === 'function') autosave();
    });
  });

  const profBonusInput = document.getElementById('prof_bonus');
  if (profBonusInput && profBonusInput.dataset.profOverrideBound !== '1') {
    profBonusInput.dataset.profOverrideBound = '1';
    profBonusInput.readOnly = false;
    profBonusInput.removeAttribute('readonly');
    profBonusInput.inputMode = 'numeric';

    profBonusInput.addEventListener('input', () => {
      const cleaned = String(profBonusInput.value || '').replace(/[^0-9-]/g, '');
      const normalized = cleaned.startsWith('-')
        ? '-' + cleaned.slice(1).replace(/-/g, '')
        : cleaned.replace(/-/g, '');
      profBonusInput.value = normalized;
      setProficiencyBonusOverride(true);
      ABILITY_LIST.forEach(ability => calculateSavingThrow(ability));
      updateAllSkillBonuses();
      if (typeof autosave === 'function') autosave();
    });

    profBonusInput.addEventListener('blur', () => {
      const trimmed = String(profBonusInput.value || '').trim();
      if (!trimmed) {
        setProficiencyBonusOverride(false);
        updateProficiencyBonus();
      } else {
        profBonusInput.value = sanitizeSignedValue(trimmed);
        setProficiencyBonusOverride(profBonusInput.value !== calculateProficiencyBonus());
        ABILITY_LIST.forEach(ability => calculateSavingThrow(ability));
        updateAllSkillBonuses();
      }
      if (typeof autosave === 'function') autosave();
    });
  }
}

function enforceAutoMathNumericInputs() {
  const unsignedNumericIds = ['str','dex','con','int','wis','cha','char_level','max_hp','curr_hp','hit_dice_spend','ac','initiative','speed'];
  unsignedNumericIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input || input.dataset.numericOnlyBound === '1') return;
    input.dataset.numericOnlyBound = '1';
    input.inputMode = 'numeric';
    input.addEventListener('input', () => {
      const maxLength = input.id === 'char_level' ? 2 : (input.id.length === 3 ? 2 : null);
      const next = sanitizeDigits(input.value, maxLength);
      if (input.value !== next) input.value = next;
    });
  });

  const signedNumericIds = ['con_modifier'];
  signedNumericIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input || input.dataset.signedNumericOnlyBound === '1') return;
    input.dataset.signedNumericOnlyBound = '1';
    input.inputMode = 'numeric';
    input.addEventListener('input', () => {
      const cleaned = String(input.value || '').replace(/[^0-9-]/g, '');
      const normalized = cleaned.startsWith('-')
        ? '-' + cleaned.slice(1).replace(/-/g, '')
        : cleaned.replace(/-/g, '');
      if (input.value !== normalized) input.value = normalized;
    });
  });

  // Saving throws are derived from ability/proficiency values.
  ['str_save','dex_save','con_save','int_save','wis_save','cha_save']
    .forEach(id => {
      const field = document.getElementById(id);
      if (field) field.readOnly = true;
    });

  bindAutoMathOverrideInputs();
}

function calculateSkillBonus(skill) {
  const ability = SKILL_ABILITY_MAP[skill];
  if (!ability) return;

  const totalInput = document.getElementById(`bonus_${skill}`);
  const profCheckbox = document.getElementById(`prof_${skill}`);
  const adjInput = document.getElementById(`adj_${skill}`);
  const abilityBonus = document.getElementById(`${ability}_bonus`);
  const profBonus = document.getElementById('prof_bonus');
  if (!totalInput || !profCheckbox || !abilityBonus || !profBonus) return;

  const abilityMod = parseSignedNumber(abilityBonus.value);
  const profMod = parseSignedNumber(profBonus.value);
  const adjMod = parseSignedNumber(adjInput ? adjInput.value : 0);

  let total = abilityMod + adjMod;
  if (profCheckbox.checked) total += profMod;

  totalInput.value = formatSignedNumber(total);
}

function updateAllSkillBonuses() {
  SKILL_LIST.forEach(skill => calculateSkillBonus(skill));
}

function setupSkillCalculationFields() {
  SKILL_LIST.forEach(skill => {
    const row = document.getElementById(`bonus_${skill}`)?.closest('.skill-row');
    const totalInput = document.getElementById(`bonus_${skill}`);
    const profCheckbox = document.getElementById(`prof_${skill}`);
    if (!row || !totalInput || !profCheckbox) return;

    totalInput.readOnly = true;
    totalInput.classList.add('skill-total-input');
    totalInput.tabIndex = -1;

    let adjInput = document.getElementById(`adj_${skill}`);
    if (!adjInput) {
      adjInput = document.createElement('input');
      adjInput.type = 'text';
      adjInput.id = `adj_${skill}`;
      adjInput.className = 'skill-adjust-input';
      adjInput.placeholder = '+0';
      // Adjustment is the custom override component; default to neutral.
      adjInput.value = '+0';
      row.insertBefore(adjInput, totalInput);
    }

    if (adjInput.dataset.skillAdjustBound !== '1') {
      adjInput.dataset.skillAdjustBound = '1';
      adjInput.addEventListener('input', () => {
        // Allow typing with immediate recalc; sanitize on blur for clean persisted value.
        calculateSkillBonus(skill);
        autosave();
      });
      adjInput.addEventListener('blur', () => {
        adjInput.value = sanitizeSignedValue(adjInput.value);
        calculateSkillBonus(skill);
        autosave();
      });
    }

    if (profCheckbox.dataset.skillProfBound !== '1') {
      profCheckbox.dataset.skillProfBound = '1';
      profCheckbox.addEventListener('change', () => {
        calculateSkillBonus(skill);
        autosave();
      });
    }
  });

  if (document.body.dataset.skillAutoMathBound !== '1') {
    document.body.dataset.skillAutoMathBound = '1';
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      const scoreInput = document.getElementById(ability);
      const bonusInput = document.getElementById(`${ability}_bonus`);
      if (scoreInput) {
        scoreInput.addEventListener('input', () => updateAllSkillBonuses());
        scoreInput.addEventListener('change', () => updateAllSkillBonuses());
      }
      if (bonusInput) {
        bonusInput.addEventListener('input', () => updateAllSkillBonuses());
        bonusInput.addEventListener('change', () => updateAllSkillBonuses());
      }
    });
    const profBonusInput = document.getElementById('prof_bonus');
    if (profBonusInput) {
      profBonusInput.addEventListener('input', () => updateAllSkillBonuses());
      profBonusInput.addEventListener('change', () => updateAllSkillBonuses());
    }
  }

  updateAllSkillBonuses();
}
// Ability Score Bonus Calculation
function calculateAbilityBonus(ability) {
  const scoreInput = document.getElementById(ability);
  const bonusInput = document.getElementById(ability + '_bonus');

  if (!scoreInput || !bonusInput) return;

  scoreInput.value = sanitizeDigits(scoreInput.value, 2);
  const score = parseInt(scoreInput.value, 10) || 0;

  // Calculate modifier: (score - 10) / 2, rounded down
  const modifier = Math.floor((score - 10) / 2);

  // Keep auto-math unless user intentionally overrides this bonus input.
  if (!autoMathOverrideState.abilityBonus[ability]) {
    bonusInput.value = formatSignedNumber(modifier);
  }

  calculateSavingThrow(ability);
  updateAllSkillBonuses();
}

function formatBonusInput(inputId) {
  if (!inputId) return;
  const ability = inputId.replace('_bonus', '');
  calculateAbilityBonus(ability);
}

// Saving Throw Functions
function formatSaveInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  let value = input.value;
  
  // Ensure it always starts with + or -
  if (!value.startsWith('+') && !value.startsWith('-')) {
    value = '+' + value;
  }
  
  // Remove any extra + signs at the start
  if (value.startsWith('++')) {
    value = '+' + value.substring(2);
  }
  
  // Limit to 4 characters total (e.g., +999, -99)
  if (value.length > 4) {
    value = value.substring(0, 4);
  }
  
  input.value = value;
}

function calculateSavingThrow(ability) {
  const saveInput = document.getElementById(ability + '_save');
  const profCheckbox = document.getElementById(ability + '_save_prof');
  const abilityBonus = document.getElementById(ability + '_bonus');
  const profBonus = document.getElementById('prof_bonus');
  
  if (!saveInput || !profCheckbox || !abilityBonus || !profBonus) return;
  
  // Get ability bonus (remove + prefix for calculation)
  const abilityMod = parseInt(abilityBonus.value.replace('+', '')) || 0;
  
  // Get proficiency bonus (remove + prefix for calculation)
  const profMod = parseInt(profBonus.value.replace('+', '')) || 0;
  
  // Calculate saving throw modifier
  let saveMod = abilityMod;
  
  // Add proficiency bonus if proficient
  if (profCheckbox.checked) {
    saveMod += profMod;
  }
  
  // Format with + prefix for positive numbers
  const formattedSave = saveMod >= 0 ? `+${saveMod}` : `${saveMod}`;
  
  saveInput.value = formattedSave;
}

function calculateProficiencyBonus() {
  const levelInput = document.getElementById('char_level');
  if (!levelInput) return '+2'; // Default for level 1-4
  
  const level = parseInt(levelInput.value) || 1;
  
  // D&D 5e proficiency bonus calculation
  let profBonus = 2; // Base proficiency bonus
  
  if (level >= 5) profBonus = 3;
  if (level >= 9) profBonus = 4;
  if (level >= 13) profBonus = 5;
  if (level >= 17) profBonus = 6;
  
  return `+${profBonus}`;
}

function updateProficiencyBonus() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;

  const newProfBonus = calculateProficiencyBonus();
  if (!autoMathOverrideState.profBonus) {
    profBonusInput.value = newProfBonus;
  }

  // Recalculate all saving throws
  ABILITY_LIST.forEach(ability => {
    calculateSavingThrow(ability);
  });

  updateAllSkillBonuses();
}

function handleProfBonusInput() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;

  profBonusInput.value = sanitizeSignedValue(profBonusInput.value);
  setProficiencyBonusOverride(profBonusInput.value !== calculateProficiencyBonus());

  // Recalculate all saving throws with the current proficiency bonus
  ABILITY_LIST.forEach(ability => {
    calculateSavingThrow(ability);
  });
  updateAllSkillBonuses();
}

function resetProfBonusIfEmpty() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  
  // If the input is empty or just whitespace, reset to calculated value
  if (!profBonusInput.value.trim()) {
    setProficiencyBonusOverride(false);
    updateProficiencyBonus();
  }
}

function updateProficiencyBonusIfNotOverridden() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;

  if (!autoMathOverrideState.profBonus || !profBonusInput.value.trim()) {
    setProficiencyBonusOverride(false);
    updateProficiencyBonus();
  }
}

Object.assign(window, {
  formatSignedNumber,
  parseSignedNumber,
  sanitizeDigits,
  sanitizeSignedValue,
  enforceAutoMathNumericInputs,
  calculateSkillBonus,
  updateAllSkillBonuses,
  setupSkillCalculationFields,
  calculateAbilityBonus,
  formatBonusInput,
  formatSaveInput,
  calculateSavingThrow,
  calculateProficiencyBonus,
  updateProficiencyBonus,
  handleProfBonusInput,
  resetProfBonusIfEmpty,
  updateProficiencyBonusIfNotOverridden
});


// Initialize Firebase when page loads or immediately if already loaded
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve();
  }

  return navigator.serviceWorker.register('/sw.js')
    .then(function(registration) {
      console.log('Service Worker registered:', registration);
      return registration;
    })
    .catch(function(error) {
      console.warn('Service Worker registration failed:', error);
    });
}

function initCloudFirebase() {
  console.log('=== initCloudFirebase called ===');
  console.log('document.readyState:', document.readyState);
  
  initializeFirebase();
  enableAutoSync();
  registerServiceWorker();
}

// Initialize immediately if DOM is ready, otherwise wait for the event
if (document.readyState === 'loading') {
  console.log('DOM still loading, adding DOMContentLoaded listener');
  document.addEventListener('DOMContentLoaded', initCloudFirebase);
} else {
  console.log('DOM already ready, initializing immediately');
  initCloudFirebase();
}


