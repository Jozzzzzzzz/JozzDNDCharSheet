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

function initializeFirebase() {
  try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    window.auth = auth; // Make auth globally available for button check
    db = firebase.firestore();

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      updateAuthUI();
      if (user) {
        setSyncStatus('Signed in successfully');
        // Auto-sync from cloud when user signs in
        setTimeout(() => syncFromCloud(true), 1000);
      }
    });

    console.log('Firebase initialized successfully');
    // Update UI to enable sign-in button
    updateAuthUI();
  } catch (error) {
    console.error('Firebase initialization error:', error);
    setSyncStatus('Cloud sync unavailable');
    // Update UI to show error state
    updateAuthUI();
  }
}

function updateAuthUI() {
  const signedInView = document.getElementById('signedInView');
  const signedOutView = document.getElementById('signedOutView');
  const userEmail = document.getElementById('userEmail');
  const signInBtn = document.getElementById('signInBtn');

  if (currentUser) {
    signedInView.style.display = 'block';
    signedOutView.style.display = 'none';
    userEmail.textContent = currentUser.email;
  } else {
    signedInView.style.display = 'none';
    signedOutView.style.display = 'block';
    // Enable/disable sign-in button based on Firebase availability
    if (signInBtn) {
      signInBtn.disabled = !auth;
      signInBtn.textContent = auth ? 'Sign In with Google' : 'Loading...';
    }
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

    if (!window.auth) {
      console.error('Firebase auth instance not initialized');
      setSyncStatus('Authentication not ready');
      alert('Authentication is not ready yet. Please wait a moment and try again.');
      return;
    }

    console.log('Attempting Google sign-in...');
    setSyncStatus('Opening sign-in popup...');

    const provider = new firebase.auth.GoogleAuthProvider();
    // Add scopes if needed
    provider.addScope('email');
    provider.addScope('profile');

    const result = await window.auth.signInWithPopup(provider);
    console.log('Sign-in successful:', result.user.email);
    setSyncStatus('Signed in successfully');
  } catch (error) {
    console.error('Sign-in error:', error);

    // Handle specific error cases
    let errorMessage = 'Sign-in failed';
    if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Popup was blocked by browser. Please allow popups and try again.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in cancelled';
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage = 'This domain is not authorized for sign-in. Please add it to Firebase Console.';
    } else if (error.message && error.message.includes('signInWithPopup')) {
      errorMessage = 'Authentication system is not ready. Please refresh the page and try again.';
    } else {
      errorMessage = error.message || 'Unknown sign-in error';
    }

    setSyncStatus(errorMessage);
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
    const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
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
    const localCharacters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
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

  // Derived auto-math outputs should not be manually edited.
  ['str_bonus','dex_bonus','con_bonus','int_bonus','wis_bonus','cha_bonus',
   'str_save','dex_save','con_save','int_save','wis_save','cha_save','prof_bonus']
    .forEach(id => {
      const field = document.getElementById(id);
      if (field) field.readOnly = true;
    });
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

  // Format with + prefix for positive numbers
  bonusInput.value = formatSignedNumber(modifier);

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
  profBonusInput.value = newProfBonus;

  // Recalculate all saving throws
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateSavingThrow(ability);
  });

  updateAllSkillBonuses();
}

function handleProfBonusInput() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  
  let value = profBonusInput.value;
  
  // Ensure it always starts with + or -
  if (value && !value.startsWith('+') && !value.startsWith('-')) {
    value = '+' + value;
  }
  
  // Remove any extra + signs at the start
  if (value.startsWith('++')) {
    value = '+' + value.substring(2);
  }
  
  // Limit to 3 characters total (e.g., +99, -9)
  if (value.length > 3) {
    value = value.substring(0, 3);
  }
  
  profBonusInput.value = value;
  
  // Recalculate all saving throws with the new proficiency bonus
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateSavingThrow(ability);
  });
  updateAllSkillBonuses();
}

function resetProfBonusIfEmpty() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  
  // If the input is empty or just whitespace, reset to calculated value
  if (!profBonusInput.value.trim()) {
    const calculatedProfBonus = calculateProficiencyBonus();
    profBonusInput.value = calculatedProfBonus;
    
    // Recalculate all saving throws
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateSavingThrow(ability);
    });
    updateAllSkillBonuses();
  }
}

function updateProficiencyBonusIfNotOverridden() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  
  // Only update if the current value matches the calculated value (not manually overridden)
  const currentValue = profBonusInput.value;
  const calculatedValue = calculateProficiencyBonus();
  
  if (currentValue === calculatedValue || !currentValue.trim()) {
    // Update to new calculated value
    profBonusInput.value = calculatedValue;
    
    // Recalculate all saving throws
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateSavingThrow(ability);
    });
    updateAllSkillBonuses();
  }
}


// Initialize Firebase when page loads
document.addEventListener('DOMContentLoaded', function() {
  initializeFirebase();
  enableAutoSync();
  
  // Register service worker for PWA functionality
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('data:text/javascript;base64,' + btoa(`
      self.addEventListener('install', function(event) {
        event.waitUntil(self.skipWaiting());
      });
      
      self.addEventListener('activate', function(event) {
        event.waitUntil(self.clients.claim());
      });
      
      self.addEventListener('fetch', function(event) {
        // Let the browser handle all requests normally
        return;
      });
    `)).catch(function(error) {
      console.log('Service Worker registration failed:', error);
    });
  }
  
});


