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

// Wired for the settings-page suggestion form (settingsSuggestion* IDs). That form
// is not currently rendered in any page; kept as the ready hook if it's re-added.
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

// Returns a complete phrase that slots into "{name} {phrase}." so every wealth
// band reads as a grammatical sentence.
function getWealthBandPhrase(totalGp, country) {
  const where = country.country;
  if (totalGp >= country.top1Gp) return `would sit in the top 1% of wealth in ${where}`;
  if (totalGp >= country.top5Gp) return `would rank among the richest 5% in ${where}`;
  if (totalGp >= country.top10Gp) return `would make the top 10% of earners in ${where}`;
  return `is still building toward the top 10% in ${where}`;
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
  const phrase = getWealthBandPhrase(totalGp, country);
  const characterName = getCurrentCharacterDisplayName();
  const roundedGp = Math.round(totalGp).toLocaleString();
  // e.g. "Did you know: Six Sevenson holds 355 GP — by this sheet's estimate
  // that is still building toward the top 10% in Australia."
  return `Did you know: ${characterName} holds ${roundedGp} GP — by this sheet's estimate that ${phrase}.`;
}

// Context-aware banners that react to the live sheet (HP + spell slots).
// Returns one relevant line at random, or null if nothing notable applies.
// Kept light: only reads fields that are always in the DOM.
function buildContextualBannerMessage() {
  const name = getCurrentCharacterDisplayName();
  const candidates = [];

  // --- Health state ---
  const currHp = parseInt(document.getElementById('curr_hp')?.value, 10);
  const maxHp = parseInt(document.getElementById('max_hp')?.value, 10);
  if (Number.isFinite(currHp) && Number.isFinite(maxHp) && maxHp > 0) {
    const ratio = currHp / maxHp;
    if (currHp <= 0) {
      candidates.push(`${name} is down. Someone roll for a heal — fast.`);
    } else if (ratio <= 0.25) {
      candidates.push(`${name} is hanging on by a thread. Reach for a potion.`);
      candidates.push(`${name} is one bad roll from the floor right now.`);
    } else if (ratio <= 0.5) {
      candidates.push(`${name} is bloodied — one solid hit from real trouble.`);
    } else if (ratio >= 1) {
      candidates.push(`${name} is at full health and ready for whatever's next.`);
    }
  }

  // --- Spell slots / resources (from spells.js globals) ---
  // These are file-level `let` globals in spells.js; reference them bare with a
  // typeof guard since characters.js loads before spells.js.
  const slots = (typeof manualSpellSlots !== 'undefined' && Array.isArray(manualSpellSlots)) ? manualSpellSlots : [];
  const used = (typeof manualSpellSlotsUsed !== 'undefined' && manualSpellSlotsUsed) ? manualSpellSlotsUsed : {};
  if (slots.length) {
    let totalMax = 0, totalUsed = 0;
    slots.forEach(s => {
      const max = Number(s.maxValue) || 0;
      totalMax += max;
      totalUsed += Math.min(max, Number(used[s.id]) || 0);
    });
    if (totalMax > 0) {
      if (totalUsed >= totalMax) {
        candidates.push(`${name} is out of spell slots — time to swing something heavy.`);
      } else if (totalUsed === 0) {
        candidates.push(`${name} is fully charged — every spell slot ready to go.`);
      } else if (totalUsed >= totalMax * 0.75) {
        candidates.push(`${name} is running low on spell slots. Spend them wisely.`);
      }
    }
  }

  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

window.buildContextualBannerMessage = buildContextualBannerMessage;

// ========== CHARACTER MANAGEMENT ==========

let autosaveDebounceTimer = null;
function scheduleAutosave(delayMs = 400) {
  if (autosaveDebounceTimer) {
    clearTimeout(autosaveDebounceTimer);
  }
  autosaveDebounceTimer = setTimeout(() => {
    autosaveDebounceTimer = null;
    try { autosave(); } catch (err) { console.error('scheduleAutosave: autosave crashed:', err); }
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

