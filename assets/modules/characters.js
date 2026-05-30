// Global variables declared in core.js: weaponsData, equipmentData, currentCharacter, deleteState,
// deleteTargetCharacterId, LAST_SELECTED_CHARACTER_KEY, LAST_SELECTED_CHARACTER_AT_KEY,
// CHARACTER_FAVORITES_KEY, LAST_SELECTION_MAX_AGE_MS, MAX_FAVORITE_CHARACTERS

// ========== SUGGESTION FORM ==========

function initializeSuggestionForm() {
    const form = document.getElementById('suggestionForm');
    if (form) {
      form.addEventListener('submit', handleSuggestionSubmit);
    }
  }

async function handleSuggestionSubmit(event) {
    event.preventDefault();
    await handleSuggestionSubmitGeneric('suggestionType', 'suggestionText', 'suggestionStatus');
  }

async function handleSettingsSuggestionSubmit(event) {
    event.preventDefault();
    await handleSuggestionSubmitGeneric('settingsSuggestionType', 'settingsSuggestionText', 'settingsSuggestionStatus');
  }

async function handleSuggestionSubmitGeneric(typeId, textId, statusId) {
    const suggestionType = document.getElementById(typeId)?.value;
    const suggestionText = document.getElementById(textId)?.value;

    if (!suggestionType || !suggestionText || !suggestionText.trim()) {
      showSuggestionStatusFor(statusId, 'Please fill in all fields', 'error');
      return;
    }

    const userEmail = currentUser ? currentUser.email : 'anonymous@example.com';
    showSuggestionStatusFor(statusId, 'Sending suggestion...', 'info');

    try {
      await sendSuggestionEmail(userEmail, suggestionType, suggestionText);
      showSuggestionStatusFor(statusId, 'Suggestion sent successfully! Thank you for your feedback.', 'success');
      const typeEl = document.getElementById(typeId);
      const textEl = document.getElementById(textId);
      if (typeEl) typeEl.value = '';
      if (textEl) textEl.value = '';
    } catch (error) {
      console.error('Error sending suggestion:', error);
      showSuggestionStatusFor(statusId, 'Failed to send suggestion. Please try again later.', 'error');
    }
  }
  
// Send suggestion email through Formspree owner notification endpoint
async function sendSuggestionEmail(userEmail, suggestionType, suggestionText) {
    const subject = `D&D Character Sheet Suggestion - ${suggestionType}`;
    const body = `Hello Joz,

I have a suggestion for the D&D Character Sheet:

Suggestion Type: ${suggestionType}

My Suggestion:
${suggestionText}

Submitted by: ${userEmail}

Thanks for creating this awesome character sheet!

Best regards,
${userEmail}`;
    const result = await sendOwnerNotification(subject, body, {
      event_type: 'suggestion',
      suggestion_type: suggestionType,
      suggestion_text: suggestionText
    }, userEmail);
    if (!result.success) {
      throw new Error('Suggestion email request failed');
    }
    return result;
  }

function showSuggestionStatus(message, type) {
    showSuggestionStatusFor('suggestionStatus', message, type);
  }

function showSuggestionStatusFor(elementId, message, type) {
    const statusDiv = document.getElementById(elementId);
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status-message ${type}`;
      statusDiv.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 5000);
    }
  }

// Web App / PWA Initialization

window.addEventListener('resize', refreshAllNoteBoxes);
window.addEventListener('orientationchange', refreshAllNoteBoxes);

const rollingBannerMessages = [
  'This sheet autosaves character data to your browser. Use Export to back up your character.',
  'Tip: Cloud Sync is best for device-to-device play. Export is your emergency backup.',
  'Fun fact: A mimic can be a chest, a door, or your trust issues.',
  'News slot: Add your latest project updates here for players.',
  'Tip: Keep quick notes updated before long rests so nothing gets lost.',
  'Fun fact: The average party plan survives about six seconds after initiative.',
  'Did you know: For this sheet, 1 GP is roughly NZ$100 as a table-friendly estimate.',
  'Did you know: A quick rough guide is 1 CP ~= NZ$1, 1 SP ~= NZ$10, and 1 GP ~= NZ$100.',
  'Did you know: 1 platinum piece is worth 10 GP, about NZ$1,000 using this rough table estimate.',
  'Did you know: A loose 1 GP comparison is about US$60, NZ$100, or GBP 50 for flavour only.',
  'Did you know: If a top-1% line was around NZ$5 million, that would be about 50,000 GP.',
  'Did you know: If a top-1% line was around US$10 million, that would be about 166,667 GP.',
  'Did you know: If a top-1% line was around GBP 4 million, that would be about 80,000 GP.',
  'Fun fact: A dragon sitting on 100,000 GP is roughly sitting on NZ$10 million by this sheet estimate.',
  'Tip: Real-world money comparisons are just table flavour; D&D item prices are not balanced like modern shopping.'
];
// rollingBannerLastIndex declared in core.js

const wealthComparisonCountries = [
  { country: 'New Zealand', top1Gp: 50000, top5Gp: 15000, top10Gp: 8000 },
  { country: 'the United States', top1Gp: 166667, top5Gp: 60000, top10Gp: 30000 },
  { country: 'the United Kingdom', top1Gp: 80000, top5Gp: 30000, top10Gp: 15000 },
  { country: 'Australia', top1Gp: 60000, top5Gp: 22000, top10Gp: 12000 },
  { country: 'Canada', top1Gp: 75000, top5Gp: 28000, top10Gp: 14000 }
];

function parseCurrencyAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getCurrentCurrencySummary() {
  const currency = collectCurrencyData();
  const standard = [
    { label: 'CP', amount: parseCurrencyAmount(currency.cp), gpValue: 0.01 },
    { label: 'SP', amount: parseCurrencyAmount(currency.sp), gpValue: 0.1 },
    { label: 'EP', amount: parseCurrencyAmount(currency.ep), gpValue: 0.5 },
    { label: 'GP', amount: parseCurrencyAmount(currency.gp), gpValue: 1 }
  ];

  const custom = (Array.isArray(currency.custom) ? currency.custom : []).map(item => {
    const name = String(item.name || '').trim();
    const amount = parseCurrencyAmount(item.amount);
    const gpValue = /^(pp|platinum|platinum pieces?)$/i.test(name) ? 10 : 0;
    return { label: name || 'Custom', amount, gpValue };
  });

  const allCurrencies = standard.concat(custom);
  const totalGp = allCurrencies.reduce((total, item) => total + item.amount * item.gpValue, 0);
  const list = allCurrencies
    .filter(item => item.amount > 0)
    .map(item => `${item.amount.toLocaleString()} ${item.label}`)
    .join(', ');

  return { totalGp, list };
}

function getWealthBand(totalGp, country) {
  if (totalGp >= country.top1Gp) return 'top 1%';
  if (totalGp >= country.top5Gp) return 'top 5%';
  if (totalGp >= country.top10Gp) return 'top 10%';
  return 'still working toward the top 10%';
}

function getCurrentCharacterDisplayName() {
  const nameFromField = document.getElementById('char_name')?.value?.trim();
  if (nameFromField) return nameFromField;

  const characters = getStoredJSON('dndCharacters', []);
  const character = characters.find(char => char.id === currentCharacter);
  return character?.name || 'This character';
}

function buildCurrencyWealthBannerMessage() {
  const { totalGp, list } = getCurrentCurrencySummary();
  if (totalGp <= 0 || !list) return null;

  const country = wealthComparisonCountries[Math.floor(Math.random() * wealthComparisonCountries.length)];
  const band = getWealthBand(totalGp, country);
  const characterName = getCurrentCharacterDisplayName();
  const roundedGp = Math.round(totalGp).toLocaleString();
  return `Did you know: ${characterName} has ${roundedGp} GP, roughly ${band} rich in ${country.country}.`;
}

// ========== CHARACTER MANAGEMENT ==========

// ========== EXISTING FUNCTIONALITY (UPDATED FOR CHARACTER SYSTEM) ==========
// Manual save function with status feedback

let autosaveDebounceTimer = null;
function scheduleAutosave(delayMs = 400) {
  if (autosaveDebounceTimer) {
    clearTimeout(autosaveDebounceTimer);
  }
  autosaveDebounceTimer = setTimeout(() => {
    autosaveDebounceTimer = null;
    autosave();
  }, delayMs);
}

function bindGlobalAutosaveListeners() {
  if (document.body?.dataset?.globalAutosaveBound === '1') return;
  if (document.body) {
    document.body.dataset.globalAutosaveBound = '1';
  }

  const shouldIgnoreTarget = (target) => {
    if (!(target instanceof Element)) return true;
    if (target.closest('#importModal, #importPreviewModal, #deleteCharacterPopup, #newCharacterPopup')) return true;
    return false;
  };

  document.addEventListener('input', (event) => {
    if (shouldIgnoreTarget(event.target)) return;
    scheduleAutosave();
  });

  document.addEventListener('change', (event) => {
    if (shouldIgnoreTarget(event.target)) return;
    scheduleAutosave(150);
  });

  window.addEventListener('beforeunload', () => {
    try {
      autosave();
    } catch (error) {
      console.error('Autosave on unload failed:', error);
    }
  });
}

function getCurrencyFieldValue(id) {
  return document.getElementById(id)?.value || '0';
}

function collectCurrencyData() {
  return {
    cp: getCurrencyFieldValue('currency_cp'),
    sp: getCurrencyFieldValue('currency_sp'),
    ep: getCurrencyFieldValue('currency_ep'),
    gp: getCurrencyFieldValue('gold_field'),
    custom: Array.from(document.querySelectorAll('#custom_currency_rows .custom-currency-row')).map(row => ({
      name: row.querySelector('.custom-currency-name')?.value || '',
      amount: row.querySelector('.custom-currency-amount')?.value || '0'
    })).filter(currency => currency.name || currency.amount !== '0')
  };
}

function setCurrencyInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? '0';
}

function addCustomCurrencyRow(currency = {}, shouldAutosave = true) {
  const container = document.getElementById('custom_currency_rows');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'custom-currency-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'custom-currency-name';
  nameInput.placeholder = 'Name';
  nameInput.value = currency.name || '';
  nameInput.addEventListener('input', autosave);

  const amountInput = document.createElement('input');
  amountInput.type = 'number';
  amountInput.min = '0';
  amountInput.className = 'custom-currency-amount';
  amountInput.placeholder = '0';
  amountInput.value = currency.amount ?? '0';
  amountInput.addEventListener('input', autosave);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'currency-remove-btn';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    row.remove();
    autosave();
  });

  row.append(nameInput, amountInput, removeButton);
  container.appendChild(row);
  if (shouldAutosave) autosave();
}

function loadCurrencyData(page4 = {}) {
  const currency = page4.currency || {
    cp: '0',
    sp: '0',
    ep: '0',
    gp: page4.gold || '0',
    custom: []
  };

  setCurrencyInputValue('currency_cp', currency.cp);
  setCurrencyInputValue('currency_sp', currency.sp);
  setCurrencyInputValue('currency_ep', currency.ep);
  setCurrencyInputValue('gold_field', currency.gp ?? page4.gold ?? '0');

  const customContainer = document.getElementById('custom_currency_rows');
  if (customContainer) {
    customContainer.innerHTML = '';
    (Array.isArray(currency.custom) ? currency.custom : []).forEach(customCurrency => {
      addCustomCurrencyRow(customCurrency, false);
    });
  }
}

// ========== EXISTING FUNCTIONS (UPDATED) ==========

function getCharacterSyncTimestamp(character) {
  const updated = character?.updatedAt ? Date.parse(character.updatedAt) : NaN;
  if (Number.isFinite(updated)) return updated;
  const created = character?.createdAt ? Date.parse(character.createdAt) : NaN;
  if (Number.isFinite(created)) return created;
  const idNum = Number(character?.id);
  if (Number.isFinite(idNum)) return idNum;
  return 0;
}

const DELETED_CHARACTERS_KEY = 'dndDeletedCharacters';

function getDeletedCharacterMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_CHARACTERS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function setDeletedCharacterMap(deletedCharacters) {
  localStorage.setItem(DELETED_CHARACTERS_KEY, JSON.stringify(deletedCharacters || {}));
}

function markCharacterDeleted(characterId) {
  if (!characterId) return;
  const deletedCharacters = getDeletedCharacterMap();
  deletedCharacters[characterId] = new Date().toISOString();
  setDeletedCharacterMap(deletedCharacters);
}

function mergeDeletedCharacterMaps(localDeleted, cloudDeleted) {
  const merged = { ...(cloudDeleted || {}) };
  Object.entries(localDeleted || {}).forEach(([id, deletedAt]) => {
    const localTs = Date.parse(deletedAt);
    const cloudTs = Date.parse(merged[id]);
    if (!Number.isFinite(cloudTs) || (Number.isFinite(localTs) && localTs >= cloudTs)) {
      merged[id] = deletedAt;
    }
  });
  return merged;
}

function pruneDeletedCharacters(characters, deletedCharacters) {
  return (Array.isArray(characters) ? characters : []).filter((character) => {
    const deletedAt = deletedCharacters?.[character?.id];
    if (!deletedAt) return true;
    const deletedTs = Date.parse(deletedAt);
    return !Number.isFinite(deletedTs) || getCharacterSyncTimestamp(character) > deletedTs;
  });
}

function mergeCharacterLists(localCharacters, cloudCharacters) {
  const mergedById = new Map();
  const apply = (char) => {
    if (!char || !char.id) return;
    const existing = mergedById.get(char.id);
    if (!existing) {
      mergedById.set(char.id, char);
      return;
    }
    const existingTs = getCharacterSyncTimestamp(existing);
    const incomingTs = getCharacterSyncTimestamp(char);
    if (incomingTs >= existingTs) {
      mergedById.set(char.id, char);
    }
  };

  (Array.isArray(localCharacters) ? localCharacters : []).forEach(apply);
  (Array.isArray(cloudCharacters) ? cloudCharacters : []).forEach(apply);
  return Array.from(mergedById.values());
}

