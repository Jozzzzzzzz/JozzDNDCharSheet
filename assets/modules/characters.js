// Global variables declared in core.js: weaponsData, equipmentData, currentCharacter, deleteState,
// deleteTargetCharacterId, LAST_SELECTED_CHARACTER_KEY, LAST_SELECTED_CHARACTER_AT_KEY,
// CHARACTER_FAVORITES_KEY, LAST_SELECTION_MAX_AGE_MS, MAX_FAVORITE_CHARACTERS

function generateCharacterId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getFavoriteCharacterIds() {
  const raw = JSON.parse(localStorage.getItem(CHARACTER_FAVORITES_KEY) || '[]');
  if (!Array.isArray(raw)) return [];
  return raw.filter(id => typeof id === 'string');
}

function setFavoriteCharacterIds(ids) {
  localStorage.setItem(CHARACTER_FAVORITES_KEY, JSON.stringify(ids));
}

function isFavoriteCharacter(characterId) {
  return getFavoriteCharacterIds().includes(characterId);
}

function toggleFavoriteCharacter(characterId) {
  const favs = new Set(getFavoriteCharacterIds());
  if (favs.has(characterId)) {
    favs.delete(characterId);
  } else {
    if (favs.size >= MAX_FAVORITE_CHARACTERS) {
      showPopup('favoritesLimitPopup');
      return;
    }
    favs.add(characterId);
  }
  setFavoriteCharacterIds(Array.from(favs));
  loadCharacterList();
}

function rememberSelectedCharacter(characterId) {
  if (!characterId) return;
  localStorage.setItem(LAST_SELECTED_CHARACTER_KEY, characterId);
  localStorage.setItem(LAST_SELECTED_CHARACTER_AT_KEY, `${Date.now()}`);
}

function clearRememberedSelectedCharacter() {
  localStorage.removeItem(LAST_SELECTED_CHARACTER_KEY);
  localStorage.removeItem(LAST_SELECTED_CHARACTER_AT_KEY);
}

function getRecentSelectedCharacterId(characters) {
  const storedId = localStorage.getItem(LAST_SELECTED_CHARACTER_KEY);
  const storedAt = Number(localStorage.getItem(LAST_SELECTED_CHARACTER_AT_KEY) || '');
  if (!storedId || !Number.isFinite(storedAt)) {
    clearRememberedSelectedCharacter();
    return null;
  }

  const ageMs = Date.now() - storedAt;
  const exists = characters.some(char => char.id === storedId);
  if (ageMs > LAST_SELECTION_MAX_AGE_MS || ageMs < 0 || !exists) {
    clearRememberedSelectedCharacter();
    return null;
  }
  return storedId;
}

function sortCharactersForDisplay(characters) {
  const byName = (a, b) => (a.name || '').localeCompare((b.name || ''), undefined, { sensitivity: 'base' });
  const favorites = [];
  const others = [];
  characters.forEach(char => {
    if (isFavoriteCharacter(char.id)) {
      favorites.push(char);
    } else {
      others.push(char);
    }
  });
  favorites.sort(byName);
  others.sort(byName);
  return { favorites, others };
}

// ========== THEME MANAGEMENT ==========
function toggleTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle.checked) {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('dndTheme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('dndTheme', 'dark');
  }
}

function setAccentDerivedColors(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const borderColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
  const softColor = `rgba(${r}, ${g}, ${b}, 0.18)`;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const contrast = yiq >= 140 ? '#111111' : '#f7f7f7';
  const lighten = (value, amount) => Math.min(255, Math.round(value + (255 - value) * amount));
  const accentText = yiq < 120
    ? `rgb(${lighten(r, 0.65)}, ${lighten(g, 0.65)}, ${lighten(b, 0.65)})`
    : color;
  document.documentElement.style.setProperty('--accent-border', borderColor);
  document.documentElement.style.setProperty('--accent-soft', softColor);
  document.documentElement.style.setProperty('--accent-contrast', contrast);
  document.documentElement.style.setProperty('--accent-text', accentText);
}

function updateAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('dndAccentColor', color);
  setAccentDerivedColors(color);
}

function clampTextScalePercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 100;
  return Math.min(140, Math.max(85, Math.round(num)));
}

function applyTextScalePercent(percentValue) {
  const percent = clampTextScalePercent(percentValue);
  const scale = (percent / 100).toFixed(2);
  document.documentElement.style.setProperty('--text-scale', scale);
  document.documentElement.style.fontSize = `${(16 * percent / 100).toFixed(2)}px`;
  localStorage.setItem('dndTextScalePercent', String(percent));
  const slider = document.getElementById('textScaleSlider');
  const valueLabel = document.getElementById('textScaleValue');
  if (slider) slider.value = String(percent);
  if (valueLabel) valueLabel.textContent = `${percent}%`;
}

function updateTextScaleFromSlider(percentValue) {
  applyTextScalePercent(percentValue);
}

function loadThemeSettings() {
  // Load theme preference
  const savedTheme = localStorage.getItem('dndTheme');
  const themeToggle = document.getElementById('themeToggle');
  
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (themeToggle) themeToggle.checked = true;
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (themeToggle) themeToggle.checked = false;
  }
  
  // Load accent color
  const savedAccentColor = localStorage.getItem('dndAccentColor');
  if (savedAccentColor) {
    document.documentElement.style.setProperty('--accent', savedAccentColor);
    const colorPicker = document.getElementById('accentColor');
    if (colorPicker) colorPicker.value = savedAccentColor;
    setAccentDerivedColors(savedAccentColor);
  }

  const savedTextScale = localStorage.getItem('dndTextScalePercent');
  applyTextScalePercent(savedTextScale || 100);
}

// ========== INITIALIZATION ==========
  // Suggestion Form Functions
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
function initializeWebApp() {
  // Improved double-tap handling - only prevent zoom on form elements
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    const target = event.target;
    
    // Only prevent zoom on form elements, not on scrollable content
    if (now - lastTouchEnd <= 300 && 
        (target.tagName === 'INPUT' || 
         target.tagName === 'TEXTAREA' || 
         target.tagName === 'SELECT' ||
         target.classList.contains('button') ||
         target.classList.contains('btn'))) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  // Prevent context menu on long press
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  // Handle orientation changes
  window.addEventListener('orientationchange', function() {
    setTimeout(function() {
      // Force a reflow to fix layout issues
      document.body.style.height = '100vh';
      setTimeout(function() {
        document.body.style.height = '';
      }, 100);
    }, 500);
  });
  
  // Minimal touch handling - rely on CSS overscroll-behavior for pull-to-refresh prevention
  // No JavaScript touch event prevention to avoid console errors
  
  // Handle viewport changes for web app mode
  function handleViewportChange() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);
  handleViewportChange();
}

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

function rollBannerMessage() {
  const textEl = document.getElementById('rollingBannerText');
  if (!textEl || rollingBannerMessages.length === 0) return;

  const dynamicMessage = Math.random() < 0.35 ? buildCurrencyWealthBannerMessage() : null;
  let nextMessage = dynamicMessage;

  if (!nextMessage) {
    let nextIndex = Math.floor(Math.random() * rollingBannerMessages.length);
    if (rollingBannerMessages.length > 1 && nextIndex === rollingBannerLastIndex) {
      nextIndex = (nextIndex + 1) % rollingBannerMessages.length;
    }
    rollingBannerLastIndex = nextIndex;
    nextMessage = rollingBannerMessages[nextIndex];
  }

  textEl.classList.add('is-fading');
  setTimeout(() => {
    textEl.textContent = nextMessage;
    textEl.classList.remove('is-fading');
  }, 140);
}

window.initializeApp = function() {
  // Initialize web app features first
  initializeWebApp();
  
  // Initialize character system
  loadCharacterList();
  
  // Initialize theme system
  loadThemeSettings();
  
  // Initialize HP display
  updateHPDisplay();
  
  // Initialize death save visual states
  initializeDeathSaves();
  
  // Initialize Hit Dice calculation
  calculateHitDiceRecovery();
  
  // Initialize potion info
  updatePotionInfo();
  
  // Initialize ability bonuses
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateAbilityBonus(ability);
    // Format bonus input to ensure + prefix
    formatBonusInput(ability + '_bonus');
  });
  
  // Initialize proficiency bonus
  updateProficiencyBonus();

  // Numeric guards + skill auto-math wiring
  enforceAutoMathNumericInputs();
  setupSkillCalculationFields();
  
  // Initialize saving throws
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateSavingThrow(ability);
    // Format save input to ensure + prefix
    formatSaveInput(ability + '_save');
  });
  
  // Initialize suggestion form
  initializeSuggestionForm();
  
  // Remove resizable class from Character Info section
  const characterInfoSection = document.querySelector('.character-info-section');
  if (characterInfoSection) {
    characterInfoSection.classList.remove('resizable-container');
  }

  // Initialize actions and features
  initializeActions();

  // Initialize inventory system
  initializeInventory();

  // Initialize equipment data for stats page
  if (typeof window.equipmentData === 'undefined') {
    window.equipmentData = [];
  }

  // Load character list and restore recent selection only if selected within 12 hours.
  const characters = getStoredJSON('dndCharacters', []);
  const recentCharacterId = getRecentSelectedCharacterId(characters);
  currentCharacter = recentCharacterId || null;
  loadCharacterList();

  if (recentCharacterId) {
    loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
    const page1Tab = document.querySelector('.tab[data-tab="page1"]');
    if (page1Tab) page1Tab.click();
  } else {
    showHomePage();
  }
  
  // Initialize portrait functionality (guard if elements absent)
  const portraitUpload = document.getElementById('portraitUpload');
  const portraitPreview = document.getElementById('portraitPreview');
  if (portraitUpload && portraitPreview) {
    portraitUpload.addEventListener('change', handlePortraitUpload);
    portraitPreview.addEventListener('click', function() {
      portraitUpload.click();
    });
  }
  
  // Initialize weapons and equipment if empty
  if (weaponsData.length === 0) {
    weaponsData.push({ name: '', toHit: '', damage: '', bonusDamage: '', notes: '', properties: '' });
    updateWeaponsPreview();
  }
  
  if (equipmentData.length === 0) {
    equipmentData.push({ name: '', type: '', bonus: '', weight: 0, notes: '' });
    updateEquipmentPreviews();
  }
  
  // Update weights
  updateWeight();
  document.querySelectorAll('#extra_containers .section').forEach(container => {
    updateContainerWeight(container.id);
  });

 // Enable resizing
makeContainersResizable();
setupNoteBoxHandlers();
setupNoteBoxObserver();
setupAutoResize();
setupMobileTextareaAutoGrow();
  loadLayout(); // This should come after all elements are created
  bindGlobalAutosaveListeners();
  rollBannerMessage();
  setTimeout(() => {
  applyFlexWrapSizing();
  syncSpellPanels();
}, 0);
};

// ========== CHARACTER MANAGEMENT ==========
function showHomePage() {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById('home').classList.add('active');
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  rollBannerMessage();
}

function createNewCharacter() {
  const charName = document.getElementById('newCharName').value.trim();
  const createStatus = document.getElementById('createStatus');

  if (!charName) {
    if (createStatus) {
      createStatus.textContent = 'Please enter a character name';
      createStatus.className = 'status-message error';
      createStatus.style.display = 'block';
      setTimeout(() => {
        createStatus.style.display = 'none';
      }, 3000);
    }
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const newChar = {
      id: generateCharacterId(),
      name: charName,
      createdAt: nowIso,
      updatedAt: nowIso,
      data: {
        characterInfo: { name: charName },
        page1: {},
        page2: {},
        page3: {},
        page4: {},
        page6: {},
        weapons: [],
        equipment: []
      }
    };

    let characters = getStoredJSON('dndCharacters', []);
    characters.push(newChar);
    localStorage.setItem('dndCharacters', JSON.stringify(characters));
    queueCloudSync(0);

    loadCharacterList();
    loadSelectedCharacter(newChar.id);
    document.getElementById('newCharName').value = '';

    if (createStatus) {
      createStatus.textContent = `Character "${charName}" created successfully!`;
      createStatus.className = 'status-message success';
      createStatus.style.display = 'block';
      setTimeout(() => {
        createStatus.style.display = 'none';
      }, 3000);
    }
  } catch (error) {
    console.error('Error creating character:', error);
    if (createStatus) {
      createStatus.textContent = 'Error creating character. Please try again.';
      createStatus.className = 'status-message error';
      createStatus.style.display = 'block';
      setTimeout(() => {
        createStatus.style.display = 'none';
      }, 3000);
    }
  }
}

function loadCharacterList() {
  const characters = getStoredJSON('dndCharacters', []);
  const favoritesList = document.getElementById('favoriteCharacterList');
  const loadList = document.getElementById('characterList');
  if (!loadList) return;
  if (favoritesList) favoritesList.innerHTML = '';
  loadList.innerHTML = '';

  if (!characters.some(char => char.id === currentCharacter)) {
    currentCharacter = null;
  }

  const renderEmpty = (container, message) => {
    if (!container) return;
    const empty = document.createElement('div');
    empty.className = 'character-list-empty';
    empty.textContent = message;
    container.appendChild(empty);
    container.setAttribute('aria-disabled', 'true');
  };

  if (characters.length === 0) {
    renderEmpty(favoritesList, 'No favourite characters');
    renderEmpty(loadList, 'No characters found');
    return;
  }

  if (favoritesList) favoritesList.removeAttribute('aria-disabled');
  loadList.removeAttribute('aria-disabled');
  const { favorites, others } = sortCharactersForDisplay(characters);
  const renderItem = (container, char) => {
    if (!container) return;
    const item = document.createElement('div');
    item.className = `character-list-item${char.id === currentCharacter ? ' selected' : ''}`;
    item.dataset.characterId = char.id;
    item.tabIndex = 0;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', char.id === currentCharacter ? 'true' : 'false');
    item.addEventListener('click', () => loadSelectedCharacter(char.id));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadSelectedCharacter(char.id);
      }
    });

    const name = document.createElement('span');
    name.className = 'character-list-name';
    name.textContent = char.name || 'Unnamed';
    item.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'character-item-actions';

    const star = document.createElement('button');
    star.type = 'button';
    star.className = `character-favorite-btn${isFavoriteCharacter(char.id) ? ' is-favorite' : ''}`;
    star.textContent = isFavoriteCharacter(char.id) ? '?' : '?';
    star.title = isFavoriteCharacter(char.id) ? 'Remove from favourites' : 'Add to favourites';
    star.setAttribute('aria-label', star.title);
    star.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavoriteCharacter(char.id);
    });
    actions.appendChild(star);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'character-delete-btn';
    del.textContent = 'Delete';
    del.title = `Delete ${char.name || 'character'}`;
    del.setAttribute('aria-label', del.title);
    del.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      initiateDelete(char.id);
    });
    actions.appendChild(del);

    item.appendChild(actions);

    container.appendChild(item);
  };

  if (favorites.length === 0) {
    renderEmpty(favoritesList, 'No favourite characters');
  } else {
    favorites.forEach(char => renderItem(favoritesList, char));
  }

  if (others.length === 0) {
    renderEmpty(loadList, 'All characters are in favourites');
  } else {
    others.forEach(char => renderItem(loadList, char));
  }
}

function loadSelectedCharacter(charId) {
  if (!charId) return;
  const characters = getStoredJSON('dndCharacters', []);
  if (!characters.some(char => char.id === charId)) return;

  rememberSelectedCharacter(charId);
  deleteTargetCharacterId = null;
  currentCharacter = charId;
  loadCharacterList();

  resetDeleteUI();
  loadData();
  document.querySelector('.tab[data-tab="page1"]').click();
}

function initiateDelete(charId) {
  const btn = document.getElementById('deleteCharacterActionBtn');
  const input = document.getElementById('deleteCharacterConfirmInput');
  const count = document.getElementById('deleteCharacterCount');
  const inputWrap = document.getElementById('deleteCharacterInputWrap');
  const message = document.getElementById('deleteCharacterMessage');
  const characters = getStoredJSON('dndCharacters', []);
  const targetId =
    charId ||
    deleteTargetCharacterId ||
    (characters.some(char => char.id === currentCharacter) ? currentCharacter : null);
  const target = targetId ? characters.find(char => char.id === targetId) : null;

  if (!btn || !input || !count || !inputWrap || !message) return;
  if (!targetId || !target) {
    alert('No character selected to delete');
    resetDeleteUI();
    return;
  }

  if (deleteTargetCharacterId && deleteTargetCharacterId !== targetId) {
    resetDeleteUI();
  }
  deleteTargetCharacterId = targetId;
  showPopup('deleteCharacterPopup');
  deleteState++;
  
  if (deleteState === 1) {
    message.textContent = `Delete "${target.name || 'Character'}"?`;
    btn.textContent = `Delete ${target.name || 'Character'}?`;
    btn.classList.add('warning');
    btn.classList.remove('danger');
    inputWrap.style.display = 'none';
    btn.disabled = false;
  } else if (deleteState === 2) {
    message.textContent = 'This action cannot be undone.';
    btn.textContent = 'CONFIRM DELETE!';
    btn.classList.remove('warning');
    btn.classList.add('danger');
    btn.disabled = false;
  } else if (deleteState === 3) {
    message.textContent = 'Type "DELETE" to permanently remove this character.';
    btn.textContent = 'DELETE FOREVER';
    inputWrap.style.display = 'block';
    input.focus();
    input.oninput = function() {
      count.textContent = `${input.value.length}/6`;
      btn.disabled = input.value !== 'DELETE';
    };
    btn.disabled = input.value !== 'DELETE';
  } else if (deleteState === 4 && input.value === 'DELETE') {
    const finalTargetId = deleteTargetCharacterId || targetId;
    const finalTarget = characters.find(char => char.id === finalTargetId);
    const charName = finalTarget?.name || 'character';
    const updatedChars = characters.filter(char => char.id !== finalTargetId);

    localStorage.setItem('dndCharacters', JSON.stringify(updatedChars));
    setFavoriteCharacterIds(getFavoriteCharacterIds().filter(id => id !== finalTargetId));
    markCharacterDeleted(finalTargetId);
    queueCloudSync(0);
    alert(`${charName} deleted permanently`);
    
    if (updatedChars.length > 0) {
      currentCharacter = updatedChars[0].id;
      rememberSelectedCharacter(currentCharacter);
      resetDeleteUI();
      loadCharacterList();
      loadData();
      setupSkillCalculationFields();
      enforceAutoMathNumericInputs();
      document.querySelector('.tab[data-tab="page1"]').click();
    } else {
      currentCharacter = null;
      clearRememberedSelectedCharacter();
      resetDeleteUI();
      loadCharacterList();
      showHomePage();
    }
    closePopup('deleteCharacterPopup');
  }
}

function resetDeleteUI() {
  const btn = document.getElementById('deleteCharacterActionBtn');
  const input = document.getElementById('deleteCharacterConfirmInput');
  const count = document.getElementById('deleteCharacterCount');
  const inputWrap = document.getElementById('deleteCharacterInputWrap');
  const message = document.getElementById('deleteCharacterMessage');

  deleteState = 0;
  deleteTargetCharacterId = null;
  if (!btn || !input || !count || !inputWrap || !message) return;
  message.textContent = 'Are you sure you want to delete this character?';
  btn.textContent = 'Delete Character';
  btn.classList.remove('warning', 'danger');
  btn.disabled = false;
  inputWrap.style.display = 'none';
  input.value = '';
  count.textContent = '0/6';
}

// ========== EXISTING FUNCTIONALITY (UPDATED FOR CHARACTER SYSTEM) ==========
// Manual save function with status feedback
function manualSave() {
  const saveStatus = document.getElementById('saveStatus');
  if (saveStatus) {
    saveStatus.textContent = 'Saving...';
    saveStatus.style.color = '#ffd700';
  }
  
  try {
    autosave();
    if (saveStatus) {
      saveStatus.textContent = 'Saved!';
      saveStatus.style.color = '#4CAF50';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 2000);
    }
  } catch (error) {
    console.error('Save error:', error);
    if (saveStatus) {
      saveStatus.textContent = 'Save failed!';
      saveStatus.style.color = '#f44336';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 3000);
    }
  }
}

function autosave() {
  // Ensure a character target exists
  if (!currentCharacter) {
    let characters = getStoredJSON('dndCharacters', []);
    if (characters.length === 0) {
      const nowIso = new Date().toISOString();
      const defaultChar = {
        id: generateCharacterId(),
        name: 'New Character',
        createdAt: nowIso,
        updatedAt: nowIso,
        data: { characterInfo: { name: 'New Character' }, page1: {}, page2: {}, page3: {}, page4: {}, page6: {}, weapons: [], equipment: [] }
      };
      characters = [defaultChar];
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
      currentCharacter = defaultChar.id;
      loadCharacterList();
    } else {
      currentCharacter = characters[0].id;
    }
  }
  
  const characters = getStoredJSON('dndCharacters', []);
  const charIndex = characters.findIndex(char => char.id === currentCharacter);
  if (charIndex === -1) return;
  
  const data = {
    characterInfo: {
      name: document.getElementById('char_name').value,
      race: document.getElementById('char_race').value,
      class: document.getElementById('char_class').value,
      subclass: document.getElementById('char_subclass').value,
      level: document.getElementById('char_level').value
    },
    actionTracker: {
      actions: document.getElementById('action_counter').value,
      actionUsed: document.getElementById('action_tick').checked,
      bonusActions: document.getElementById('bonus_action_counter').value,
      bonusActionUsed: document.getElementById('bonus_action_tick').checked
    },
    page1: {
    abilities: ['str','dex','con','int','wis','cha'].reduce((obj,ability) => {
  obj[ability] = document.getElementById(ability).value;
  obj[`${ability}_bonus`] = document.getElementById(`${ability}_bonus`).value;
  // Add this line for saving throws:
  obj[`${ability}_save`] = document.getElementById(`${ability}_save`).value;
  // Add saving throw proficiency
  obj[`${ability}_save_prof`] = document.getElementById(`${ability}_save_prof`).checked;
  return obj;
}, {}),
      combatStats: {
        ac: document.getElementById('ac').value,
        initiative: document.getElementById('initiative').value,
        speed: document.getElementById('speed').value,
        prof_bonus: document.getElementById('prof_bonus').value
      },

      health: {
        max_hp: document.getElementById('max_hp').value,
        curr_hp: document.getElementById('curr_hp').value,
        temp_hp: document.getElementById('temp_hp_text')?.textContent?.match(/\d+/)?.[0] || '0',
        hit_dice_spend: document.getElementById('hit_dice_spend').value,
        con_modifier: document.getElementById('con_modifier').value,
        hit_die_size: document.getElementById('hit_die_size').value,
        potion_type: document.getElementById('potion_type').value
      },
      equipmentData: equipmentData,
      skills: ['acrobatics','animal_handling','arcana','athletics','deception','history',
               'insight','intimidation','investigation','medicine','nature','perception',
               'performance','persuasion','religion','sleight_of_hand','stealth','survival']
               .reduce((obj,skill) => {
        obj[`prof_${skill}`] = document.getElementById(`prof_${skill}`).checked;
        const adjInput = document.getElementById(`adj_${skill}`);
        obj[`adj_${skill}`] = adjInput ? adjInput.value : '+0';
        obj[`bonus_${skill}`] = document.getElementById(`bonus_${skill}`).value;
        return obj;
      }, {}),
      deathSaves: {
        success: [
          document.getElementById('death_save_success_1_checkbox').checked,
          document.getElementById('death_save_success_2_checkbox').checked,
          document.getElementById('death_save_success_3_checkbox').checked
        ],
        failure: [
          document.getElementById('death_save_failure_1_checkbox').checked,
          document.getElementById('death_save_failure_2_checkbox').checked,
          document.getElementById('death_save_failure_3_checkbox').checked
        ]
      },
      actionsData: actionsData,
      actionsNotes: document.getElementById('actions_notes').value,
      inventoryData: inventoryData,
      maxWeightCapacity: document.getElementById('max_weight_capacity').value,
      equipmentData: inventoryData.equipment.map(item => ({
        name: item.name,
        type: item.type,
        bonus: item.bonus,
        weight: item.weight,
        notes: item.description
      })),
      proficienciesTraining: document.getElementById('proficiencies_training').value,
      statsQuickNotes: document.getElementById('stats_quick_notes').value
    },
    page2: {
      portrait: document.getElementById('portraitPreview').querySelector('img')?.src || null,
      backstory: document.getElementById('char_backstory').value,
      traits: {
        personality: document.getElementById('personality_traits').value,
        ideals: document.getElementById('traits_ideals').value,
        bonds: document.getElementById('traits_bonds').value,
        flaws: document.getElementById('traits_flaws').value,
        allies: document.getElementById('traits_allies').value,
        appearance: document.getElementById('traits_appearance').value
      }
    },
    page3: {
      spellNotes: document.getElementById('spell_notes').value,
      spellcastingInfo: {
        ability: document.getElementById('spellcasting_ability').value,
        saveDC: document.getElementById('spell_save_dc').value,
        attackBonus: document.getElementById('spell_attack_bonus').value,
        casterType: document.getElementById('caster_type').value,
        spellsPrepared: document.getElementById('spells_prepared').value
      },
      manualSpellSlots: manualSpellSlots,
      manualSpellSlotsUsed: manualSpellSlotsUsed,
      customResources: customResources,
      customResourcesUsed: customResourcesUsed,
      spellsData: spellsData,
      favoritesData: favoritesData
    },
    page4: {
      gold: document.getElementById('gold_field').value,
      currency: collectCurrencyData(),
      equipment: equipmentData,
      inventory: Array.from(document.querySelectorAll('#inventory_table tbody tr')).map(row => ({
        name: row.cells[0].textContent,
        description: row.cells[1].textContent,
        notes: row.cells[2].textContent,
        weight: parseFloat(row.cells[3].textContent) || 0
      })),
      containers: Array.from(document.querySelectorAll('#extra_containers .section')).map(container => ({
        name: container.querySelector('h3').textContent,
        maxWeight: container.querySelector('div').textContent.includes('Max Weight') ? 
                   parseInt(container.querySelector('div').textContent.match(/\d+/)[0]) : 0,
        items: Array.from(container.querySelectorAll('tbody tr')).map(row => ({
          name: row.cells[0].textContent,
          description: row.cells[1].textContent,
          notes: row.cells[2].textContent,
          weight: parseFloat(row.cells[3].textContent) || 0
        }))
      }))
    },
    page6: {
      // Quest & Mission Info
      activeQuests: document.getElementById('active_quests').value,
      completedQuests: document.getElementById('completed_quests').value,
      questLeads: document.getElementById('quest_leads').value,
      missionObjectives: document.getElementById('mission_objectives').value,
      
      // World & Locations
      importantLocations: document.getElementById('important_locations').value,
      travelRoutes: document.getElementById('travel_routes').value,
      worldEvents: document.getElementById('world_events').value,
      placesToVisit: document.getElementById('places_to_visit').value,
      
      // NPCs & Contacts
      keyNpcs: document.getElementById('key_npcs').value,
      alliesContacts: document.getElementById('allies_contacts').value,
      enemiesThreats: document.getElementById('enemies_threats').value,
      npcRelationships: document.getElementById('npc_relationships').value,
      npcInformation: document.getElementById('npc_information').value,
      
      // Session & Campaign
      sessionNotes: document.getElementById('session_notes').value,
      campaignTimeline: document.getElementById('campaign_timeline').value,
      partyDecisions: document.getElementById('party_decisions').value,
      campaignGoals: document.getElementById('campaign_goals').value,
      
      // Combat & Strategy
      combatNotes: document.getElementById('combat_notes').value,
      enemyInformation: document.getElementById('enemy_information').value,
      equipmentItems: document.getElementById('equipment_items').value,
      spellAbilityNotes: document.getElementById('spell_ability_notes').value,
      
      // General Info
      rulesMechanics: document.getElementById('rules_mechanics').value,
      ideasPlans: document.getElementById('ideas_plans').value,
      miscellaneousNotes: document.getElementById('miscellaneous_notes').value
    },
    weapons: weaponsData,
    conditions: Array.from(document.querySelectorAll('#conditions_container .condition')).map(condition => ({
      name: condition.querySelector('.condition-header').children[0].textContent,
      turns: condition.querySelector('.condition-header').children[1].textContent,
      effect: condition.children[1].textContent,
      color: condition.classList.contains('blue') ? 'blue' : 
             condition.classList.contains('green') ? 'green' : 'red'
    }))
  };
  
  const nextName = document.getElementById('char_name').value || 'Unnamed';
  const currentData = characters[charIndex].data || {};
  const dataChanged = JSON.stringify(currentData) !== JSON.stringify(data);
  const nameChanged = (characters[charIndex].name || 'Unnamed') !== nextName;
  if (!dataChanged && !nameChanged) {
    return;
  }

  characters[charIndex].data = data;
  characters[charIndex].name = nextName;
  characters[charIndex].updatedAt = new Date().toISOString();
  localStorage.setItem('dndCharacters', JSON.stringify(characters));
}

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

function loadData() {
  if (!currentCharacter) return;
  
  const characters = getStoredJSON('dndCharacters', []);
  const character = characters.find(char => char.id === currentCharacter);
  if (!character) return;
  
  const data = character.data;
  
  // Character Info
  if (data.characterInfo) {
    document.getElementById('char_name').value = data.characterInfo.name || '';
    document.getElementById('char_race').value = data.characterInfo.race || '';
    document.getElementById('char_class').value = data.characterInfo.class || '';
    document.getElementById('char_subclass').value = data.characterInfo.subclass || '';
    document.getElementById('char_level').value = data.characterInfo.level || '';
  }

  // Action Tracker
  if (data.actionTracker) {
    document.getElementById('action_counter').value = data.actionTracker.actions || 0;
    document.getElementById('action_tick').checked = data.actionTracker.actionUsed || false;
    document.getElementById('bonus_action_counter').value = data.actionTracker.bonusActions || 0;
    document.getElementById('bonus_action_tick').checked = data.actionTracker.bonusActionUsed || false;
  }

  // Page 1: Stats
    if (data.page1) {
    // Abilities
    for (const ability in data.page1.abilities) {
      const element = document.getElementById(ability);
      if (element) element.value = data.page1.abilities[ability];
  // Add these lines for saving throws:
  const saveElement = document.getElementById(`${ability}_save`);
  if (saveElement) saveElement.value = data.page1.abilities[`${ability}_save`] || '';
  
  // Load saving throw proficiency
  const profElement = document.getElementById(`${ability}_save_prof`);
  if (profElement) profElement.checked = data.page1.abilities[`${ability}_save_prof`] || false;

    }

    // Restore saved proficiency bonus before running derived calculations.
    if (data.page1.combatStats && Object.prototype.hasOwnProperty.call(data.page1.combatStats, 'prof_bonus')) {
      const profBonusInput = document.getElementById('prof_bonus');
      if (profBonusInput && data.page1.combatStats.prof_bonus !== null && data.page1.combatStats.prof_bonus !== undefined) {
        profBonusInput.value = data.page1.combatStats.prof_bonus;
      }
    }

    if (typeof syncAutoMathOverridesFromCurrentValues === 'function') {
      syncAutoMathOverridesFromCurrentValues();
    }
    
    // Calculate ability bonuses after loading
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateAbilityBonus(ability);
      // Format bonus input to ensure + prefix
      formatBonusInput(ability + '_bonus');
    });
    
    // Update proficiency bonus after loading
    updateProficiencyBonus();
    
    // Calculate saving throws after loading
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateSavingThrow(ability);
      // Format save input to ensure + prefix
      formatSaveInput(ability + '_save');
    });
    
    // Combat Stats
    if (data.page1.combatStats) {
      document.getElementById('ac').value = data.page1.combatStats.ac || '';
      document.getElementById('initiative').value = data.page1.combatStats.initiative || '';
      document.getElementById('speed').value = data.page1.combatStats.speed || '';
    }

    // Health
    if (data.page1.health) {
      document.getElementById('max_hp').value = data.page1.health.max_hp || '';
      document.getElementById('curr_hp').value = data.page1.health.curr_hp || '';
      document.getElementById('hit_dice_spend').value = data.page1.health.hit_dice_spend || '1';
      document.getElementById('con_modifier').value = data.page1.health.con_modifier || '0';
      document.getElementById('hit_die_size').value = data.page1.health.hit_die_size || '8';
      document.getElementById('potion_type').value = data.page1.health.potion_type || 'lesser';
      
      // Restore temp HP
      if (data.page1.health.temp_hp) {
        const tempHPText = document.getElementById('temp_hp_text');
        if (tempHPText) {
          tempHPText.textContent = `Temporary HP: ${data.page1.health.temp_hp}`;
          const tempHPDisplay = document.getElementById('temp_hp_display');
          if (tempHPDisplay) {
            tempHPDisplay.classList.add('show');
          }
        }
      }
      
      calculateHitDiceRecovery();
      updatePotionInfo();
    }    // Skills
    if (data.page1.skills) {
      for (const skill in data.page1.skills) {
        if (skill.startsWith('prof_')) {
          const checkbox = document.getElementById(skill);
          if (checkbox) checkbox.checked = data.page1.skills[skill];
        } else if (skill.startsWith('adj_')) {
          const input = document.getElementById(skill);
          if (input) input.value = sanitizeSignedValue(data.page1.skills[skill]);
        } else if (skill.startsWith('bonus_')) {
          // Backward compatibility: old saves stored only bonus_ values.
          const skillName = skill.replace('bonus_', '');
          const adjInput = document.getElementById(`adj_${skillName}`);
          if (adjInput && !data.page1.skills[`adj_${skillName}`]) {
            adjInput.value = sanitizeSignedValue(data.page1.skills[skill]);
          }
        }
      }
    }
    updateAllSkillBonuses();

    // Death Saves
    if (data.page1.deathSaves) {
      for (let i = 0; i < 3; i++) {
        if (data.page1.deathSaves.success[i]) {
          document.getElementById(`death_save_success_${i+1}_checkbox`).checked = true;
          document.getElementById(`death_save_success_${i+1}`).classList.add('checked');
        }
        if (data.page1.deathSaves.failure[i]) {
          document.getElementById(`death_save_failure_${i+1}_checkbox`).checked = true;
          document.getElementById(`death_save_failure_${i+1}`).classList.add('checked');
        }
      }
    }
    
    // Initialize death save visual states after loading
    initializeDeathSaves();
    
    // Actions & Features
    if (data.page1.actionsData) {
      actionsData = data.page1.actionsData;
      displayActions('action');
      updateFavorites();
    }
    
    // Actions Notes
    if (data.page1.actionsNotes) {
      document.getElementById('actions_notes').value = data.page1.actionsNotes;
    }
    
    // Inventory Data
    if (data.page1.inventoryData) {
      inventoryData = data.page1.inventoryData;
      displayEquipment();
      displayEquipmentStats();
      displayMainInventory();
      loadStorageContainers();
      updateWeightDisplay();
    } else {
      // If no inventory data, try to load from stats page equipment
      if (window.equipmentData && window.equipmentData.length > 0) {
        inventoryData.equipment = window.equipmentData.map(item => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: item.name,
          type: item.type,
          bonus: item.bonus,
          weight: item.weight,
          description: item.notes
        }));
        displayEquipment();
        displayEquipmentStats();
        updateWeightDisplay();
      }
    }
    
    // Max Weight Capacity
    if (data.page1.maxWeightCapacity) {
      document.getElementById('max_weight_capacity').value = data.page1.maxWeightCapacity;
      inventoryData.maxWeightCapacity = parseFloat(data.page1.maxWeightCapacity) || 0;
    }
    
    // Equipment Data for Stats Page
    if (data.page1.equipmentData) {
      window.equipmentData = data.page1.equipmentData;
      updateEquipmentPreviews();
    }
    
    // Sync equipment between stats and inventory pages
    syncEquipmentBetweenPages();
    
    // Proficiencies & Training
    if (data.page1.proficienciesTraining) {
      document.getElementById('proficiencies_training').value = data.page1.proficienciesTraining;
    }
    
    // Quick Notes
    if (data.page1.statsQuickNotes) {
      document.getElementById('stats_quick_notes').value = data.page1.statsQuickNotes;
    }
  }
  
  // Page 2: Background
  if (data.page2) {
    // Portrait
    if (data.page2.portrait) {
      const img = document.createElement('img');
      img.src = data.page2.portrait;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '12px';
      document.getElementById('portraitPreview').innerHTML = '';
      document.getElementById('portraitPreview').appendChild(img);
    }
    
    // Backstory
    if (data.page2.backstory) {
      document.getElementById('char_backstory').value = data.page2.backstory;
    }
    
    // Traits
    if (data.page2.traits) {
      document.getElementById('personality_traits').value = data.page2.traits.personality || '';
      document.getElementById('traits_ideals').value = data.page2.traits.ideals || '';
      document.getElementById('traits_bonds').value = data.page2.traits.bonds || '';
      document.getElementById('traits_flaws').value = data.page2.traits.flaws || '';
      document.getElementById('traits_allies').value = data.page2.traits.allies || '';
      document.getElementById('traits_appearance').value = data.page2.traits.appearance || '';
    }
  }
  
  // Page 3: Spells
  if (data.page3) {
    if (data.page3.spellNotes) {
    document.getElementById('spell_notes').value = data.page3.spellNotes;
    }
    
    // Load spellcasting info
    if (data.page3.spellcastingInfo) {
      document.getElementById('spellcasting_ability').value = data.page3.spellcastingInfo.ability || 'int';
      document.getElementById('spell_save_dc').value = data.page3.spellcastingInfo.saveDC || '8';
      document.getElementById('spell_attack_bonus').value = data.page3.spellcastingInfo.attackBonus || '0';
      document.getElementById('caster_type').value = data.page3.spellcastingInfo.casterType || 'prepared';
      document.getElementById('spells_prepared').value = data.page3.spellcastingInfo.spellsPrepared || '0';
    }
    
    // Load manual spell slots
    if (data.page3.manualSpellSlots) {
      manualSpellSlots = data.page3.manualSpellSlots;
    }
    
    // Load manual spell slots used
    if (data.page3.manualSpellSlotsUsed) {
      manualSpellSlotsUsed = data.page3.manualSpellSlotsUsed;
    }
    
    // Load custom resources
    if (data.page3.customResources) {
      customResources = data.page3.customResources;
    }
    
    // Load custom resources used
    if (data.page3.customResourcesUsed) {
      customResourcesUsed = data.page3.customResourcesUsed;
    }
    
    // Load spells data
    if (data.page3.spellsData) {
      spellsData = normalizeSpellsDataContainer(data.page3.spellsData);
    }
    
    // Load favorites data
    if (data.page3.favoritesData) {
      favoritesData = normalizeSpellsDataContainer(data.page3.favoritesData);
    }
    
    // Update spell system
    updateSpellSlots();
    updateCustomResources();
    renderSpells();
  }
  
  // Page 4: Inventory
  if (data.page4) {
    loadCurrencyData(data.page4);
    
    // Equipment
    if (data.page4.equipment) {
      equipmentData = data.page4.equipment;
      updateEquipmentPreviews();
    }
    
    // Main Inventory - Legacy support (if old inventory table exists)
    if (data.page4.inventory) {
      const inventoryTable = document.getElementById('inventory_table');
      if (inventoryTable) {
        const tbody = inventoryTable.querySelector('tbody');
        if (tbody) {
      tbody.innerHTML = '';
      
      data.page4.inventory.forEach(item => {
        const row = tbody.insertRow();
        row.className = 'item-row';
        row.innerHTML = `
          <td>${item.name || ''}</td>
          <td>${item.description || ''}</td>
          <td class="table-notes">${item.notes || ''}</td>
          <td>${item.weight || 0}</td>
          <td>${(item.weight * 0.453592).toFixed(2)}</td>
          <td><button onclick="event.stopPropagation(); this.closest('tr').remove(); updateWeight(); autosave()">Remove</button></td>
        `;
        row.onclick = () => showItemDetails(item, 'inventory');
      });
      
      updateWeight();
        }
      }
    }
    
    // Containers
    if (data.page4.containers) {
      const extraContainers = document.getElementById('extra_containers');
      extraContainers.innerHTML = '';
      const containerDropdown = document.getElementById('item_container');
      
      if (containerDropdown) {
        while (containerDropdown.children.length > 1) {
          containerDropdown.removeChild(containerDropdown.lastChild);
        }
      }
      
      data.page4.containers.forEach(containerData => {
        const containerId = 'container_' + Date.now();
        const containerHTML = `
          <div class="section" id="${containerId}">
            <div class="inventory-controls">
              <h3>${containerData.name}</h3>
              ${containerData.maxWeight > 0 ? `<div>Max Weight: ${containerData.maxWeight} lbs</div>` : ''}
              <button class="delete-container-btn" onclick="confirmContainerDeletion('${containerId}')">Delete Container</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th>Weight (lbs)</th>
                  <th>Weight (kg)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${containerData.items.map(item => `
                  <tr class="item-row">
                    <td>${item.name || ''}</td>
                    <td>${item.description || ''}</td>
                    <td class="table-notes">${item.notes || ''}</td>
                    <td>${item.weight || 0}</td>
                    <td>${(item.weight * 0.453592).toFixed(2)}</td>
                    <td><button onclick="event.stopPropagation(); this.closest('tr').remove(); updateContainerWeight('${containerId}'); autosave()">Remove</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <button onclick="showAddContainerItemPopup('${containerId}')" style="margin-top: 10px;">+ Add Item</button>
            <div class="weight-display">Current: ${containerData.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(1)} lbs / 
              ${(containerData.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0) * 0.453592).toFixed(1)} kg</div>
          </div>
        `;
        
        extraContainers.insertAdjacentHTML('beforeend', containerHTML);
        
        containerData.items.forEach(item => {
          const rows = document.querySelectorAll(`#${containerId} tbody tr`);
          rows.forEach(row => {
            if (row.cells[0].textContent === item.name) {
              row.onclick = () => showItemDetails(item, 'inventory');
            }
          });
        });
        
        const option = document.createElement('option');
        option.value = containerId;
        option.textContent = containerData.name;
        containerDropdown.appendChild(option);
      });
    }
  }
  
  // Page 6: Notes
  if (data.page6) {
    // Quest & Mission Info
    if (data.page6.activeQuests) {
      document.getElementById('active_quests').value = data.page6.activeQuests;
    }
    if (data.page6.completedQuests) {
      document.getElementById('completed_quests').value = data.page6.completedQuests;
    }
    if (data.page6.questLeads) {
      document.getElementById('quest_leads').value = data.page6.questLeads;
    }
    if (data.page6.missionObjectives) {
      document.getElementById('mission_objectives').value = data.page6.missionObjectives;
    }
    
    // World & Locations
    if (data.page6.importantLocations) {
      document.getElementById('important_locations').value = data.page6.importantLocations;
    }
    if (data.page6.travelRoutes) {
      document.getElementById('travel_routes').value = data.page6.travelRoutes;
    }
    if (data.page6.worldEvents) {
      document.getElementById('world_events').value = data.page6.worldEvents;
    }
    if (data.page6.placesToVisit) {
      document.getElementById('places_to_visit').value = data.page6.placesToVisit;
    }
    
    // NPCs & Contacts
    if (data.page6.keyNpcs) {
      document.getElementById('key_npcs').value = data.page6.keyNpcs;
    }
    if (data.page6.alliesContacts) {
      document.getElementById('allies_contacts').value = data.page6.alliesContacts;
    }
    if (data.page6.enemiesThreats) {
      document.getElementById('enemies_threats').value = data.page6.enemiesThreats;
    }
    if (data.page6.npcRelationships) {
      document.getElementById('npc_relationships').value = data.page6.npcRelationships;
    }
    if (data.page6.npcInformation) {
      document.getElementById('npc_information').value = data.page6.npcInformation;
    }
    
    // Session & Campaign
    if (data.page6.sessionNotes) {
      document.getElementById('session_notes').value = data.page6.sessionNotes;
    }
    if (data.page6.campaignTimeline) {
      document.getElementById('campaign_timeline').value = data.page6.campaignTimeline;
    }
    if (data.page6.partyDecisions) {
      document.getElementById('party_decisions').value = data.page6.partyDecisions;
    }
    if (data.page6.campaignGoals) {
      document.getElementById('campaign_goals').value = data.page6.campaignGoals;
    }
    
    // Combat & Strategy
    if (data.page6.combatNotes) {
      document.getElementById('combat_notes').value = data.page6.combatNotes;
    }
    if (data.page6.enemyInformation) {
      document.getElementById('enemy_information').value = data.page6.enemyInformation;
    }
    if (data.page6.equipmentItems) {
      document.getElementById('equipment_items').value = data.page6.equipmentItems;
    }
    if (data.page6.spellAbilityNotes) {
      document.getElementById('spell_ability_notes').value = data.page6.spellAbilityNotes;
    }
    
    // General Info
    if (data.page6.rulesMechanics) {
      document.getElementById('rules_mechanics').value = data.page6.rulesMechanics;
    }
    if (data.page6.ideasPlans) {
      document.getElementById('ideas_plans').value = data.page6.ideasPlans;
    }
    if (data.page6.miscellaneousNotes) {
      document.getElementById('miscellaneous_notes').value = data.page6.miscellaneousNotes;
    }
  }
  
  // Weapons
  if (data.weapons) {
    weaponsData = data.weapons;
    updateWeaponsPreview();
  }
  
  // Conditions
  if (data.conditions) {
    const container = document.getElementById('conditions_container');
    container.innerHTML = '';
    
    data.conditions.forEach(condition => {
      const conditionId = Date.now();
      const conditionHTML = `
        <div class="condition ${condition.color}" id="condition_${conditionId}">
          <div class="condition-header">
            <span>${condition.name}</span>
            <span class="condition-turns">${condition.turns}</span>
          </div>
          <div>${condition.effect}</div>
          <button onclick="removeCondition('${conditionId}')" style="float:right; padding:2px 5px; margin-top:5px;">Remove</button>
        </div>
      `;
      
      container.insertAdjacentHTML('beforeend', conditionHTML);
    });
  }

  // Re-sync note sizing after data is loaded into textareas.
  setupNoteBoxHandlers();

  setTimeout(() => {
    applyFlexWrapSizing();
  }, 0);
}

function clearAllFormFields() {
  // Clear character info fields
  const charInfoFields = ['char_name', 'char_race', 'char_class', 'char_subclass', 'char_level'];
  charInfoFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear ability scores and bonuses
  const abilityFields = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  abilityFields.forEach(ability => {
    const scoreElement = document.getElementById(ability);
    const bonusElement = document.getElementById(`${ability}_bonus`);
    const saveElement = document.getElementById(`${ability}_save`);
    const profElement = document.getElementById(`${ability}_save_prof`);

    if (scoreElement) scoreElement.value = '';
    if (bonusElement) bonusElement.value = '';
    if (saveElement) saveElement.value = '';
    if (profElement) profElement.checked = false;
  });

  // Clear combat stats
  const combatFields = ['ac', 'initiative', 'speed', 'prof_bonus'];
  combatFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear health fields
  const healthFields = ['max_hp', 'curr_hp', 'hit_dice_spend', 'con_modifier', 'hit_die_size', 'potion_type'];
  healthFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear temp HP display
  const tempHPDisplay = document.getElementById('temp_hp_display');
  if (tempHPDisplay) {
    tempHPDisplay.classList.remove('show');
    const tempHPText = document.getElementById('temp_hp_text');
    if (tempHPText) tempHPText.textContent = '';
  }

  // Clear skills
  const skillNames = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history',
                     'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
                     'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'];

  skillNames.forEach(skill => {
    const profElement = document.getElementById(`prof_${skill}`);
    const adjElement = document.getElementById(`adj_${skill}`);
    const bonusElement = document.getElementById(`bonus_${skill}`);

    if (profElement) profElement.checked = false;
    if (adjElement) adjElement.value = '+0';
    if (bonusElement) bonusElement.value = '';
  });

  // Clear death saves
  for (let i = 1; i <= 3; i++) {
    const successElement = document.getElementById(`death_save_success_${i}`);
    const failureElement = document.getElementById(`death_save_failure_${i}`);
    const successCheckbox = document.getElementById(`death_save_success_${i}_checkbox`);
    const failureCheckbox = document.getElementById(`death_save_failure_${i}_checkbox`);

    if (successElement) successElement.classList.remove('checked');
    if (failureElement) failureElement.classList.remove('checked');
    if (successCheckbox) successCheckbox.checked = false;
    if (failureCheckbox) failureCheckbox.checked = false;
  }

  // Clear action tracker
  const actionFields = ['action_counter', 'bonus_action_counter'];
  actionFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  const actionTicks = ['action_tick', 'bonus_action_tick'];
  actionTicks.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.checked = false;
  });

  // Clear background fields
  const backgroundFields = ['char_backstory', 'personality_traits', 'traits_ideals', 'traits_bonds',
                           'traits_flaws', 'traits_allies', 'traits_appearance'];
  backgroundFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear portrait
  const portraitPreview = document.getElementById('portraitPreview');
  if (portraitPreview) {
    portraitPreview.innerHTML = '<span style="color: #666;">No image</span>';
  }

  // Clear spell fields
  const spellFields = ['spell_notes', 'spellcasting_ability', 'spell_save_dc', 'spell_attack_bonus',
                      'caster_type', 'spells_prepared'];
  spellFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear inventory fields
  const inventoryFields = ['currency_cp', 'currency_sp', 'currency_ep', 'gold_field', 'max_weight_capacity'];
  inventoryFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  const customCurrencyRows = document.getElementById('custom_currency_rows');
  if (customCurrencyRows) customCurrencyRows.innerHTML = '';

  // Clear notes fields
  const notesFields = ['active_quests', 'completed_quests', 'quest_leads', 'mission_objectives',
                      'important_locations', 'travel_routes', 'world_events', 'places_to_visit',
                      'key_npcs', 'allies_contacts', 'enemies_threats', 'npc_relationships',
                      'npc_information', 'session_notes', 'campaign_timeline', 'party_decisions',
                      'campaign_goals', 'combat_notes', 'enemy_information', 'equipment_items',
                      'spell_ability_notes', 'rules_mechanics', 'ideas_plans', 'miscellaneous_notes'];
  notesFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear actions and features
  const actionsNotes = document.getElementById('actions_notes');
  if (actionsNotes) actionsNotes.value = '';

  // Clear inventory data
  const proficienciesTraining = document.getElementById('proficiencies_training');
  if (proficienciesTraining) proficienciesTraining.value = '';

  const statsQuickNotes = document.getElementById('stats_quick_notes');
  if (statsQuickNotes) statsQuickNotes.value = '';

  // Clear weapons and equipment data
  weaponsData = [];
  equipmentData = [];
  updateWeaponsPreview();
  updateEquipmentPreviews();

  // Clear conditions
  const conditionsContainer = document.getElementById('conditions_container');
  if (conditionsContainer) {
    conditionsContainer.innerHTML = '';
  }

  // Clear inventory containers
  const extraContainers = document.getElementById('extra_containers');
  if (extraContainers) {
    extraContainers.innerHTML = '';
  }

  // Clear main inventory table
  const inventoryTable = document.getElementById('inventory_table');
  if (inventoryTable) {
    const tbody = inventoryTable.querySelector('tbody');
    if (tbody) tbody.innerHTML = '';
  }

  // Reset inventory data
  inventoryData = {
    equipment: [],
    mainInventory: [],
    storageContainers: [],
    maxWeightCapacity: 0
  };

  // Clear actions data
  actionsData = {
    actions: []
  };
  displayActions('action');
  updateFavorites();

  // Clear spells data
  spellsData = {
    cantrips: [],
    spells: []
  };
  favoritesData = {
    cantrips: [],
    spells: []
  };
  manualSpellSlots = [];
  manualSpellSlotsUsed = {};
  customResources = [];
  customResourcesUsed = {};

  // Update spell system
  updateSpellSlots();
  updateCustomResources();
  renderSpells();
}

// ========== EXISTING FUNCTIONS (UPDATED) ==========
function sanitizeFilePart(value, fallback = 'unknown') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '');
  return cleaned || fallback;
}

function formatDatePart(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return 'unknown-date';
  return date.toISOString().split('T')[0];
}

function inferCharacterCreatedAt(character) {
  if (character?.createdAt) return character.createdAt;
  const idNum = Number(character?.id);
  if (Number.isFinite(idNum)) {
    const dateFromId = new Date(idNum);
    if (!Number.isNaN(dateFromId.getTime())) {
      return dateFromId.toISOString();
    }
  }
  return null;
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

function exportData() {
  if (!currentCharacter) {
    alert("No character loaded to export");
    return;
  }
  
  const characters = getStoredJSON('dndCharacters', []);
  const character = characters.find(char => char.id === currentCharacter);
  
  if (!character) {
    alert("Character not found");
    return;
  }
  
  try {
    // Ensure data is up to date before exporting
    autosave();

    const nowIso = new Date().toISOString();
    const characterData = character.data || {};
    const createdAt = inferCharacterCreatedAt(character) || nowIso;

    // Backfill createdAt for older characters so future exports are stable.
    if (!character.createdAt) {
      character.createdAt = createdAt;
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
    }

    const displayName = characterData?.characterInfo?.name || character.name || 'dnd_character';
    const level = characterData?.characterInfo?.level;
    const levelPart = level ? `lvl${String(level).trim()}` : 'lvl-unknown';
    const createdDatePart = formatDatePart(createdAt);
    
    // Create export data with metadata
    const exportData = {
      version: "2.1",
      exportDate: nowIso,
      createdAt: createdAt,
      character: characterData,
      characterInfo: {
        id: character.id,
        name: character.name,
        createdAt: createdAt
      },
      aiGuide: {
        canonicalDataPath: "character",
        keyFields: {
          name: "character.characterInfo.name",
          level: "character.characterInfo.level",
          class: "character.characterInfo.class",
          race: "character.characterInfo.race"
        },
        importHints: [
          "Use root.character as the full canonical sheet payload for this app.",
          "When creating a new character from another person's file, copy root.character directly.",
          "If root.character is missing, treat root.data as fallback payload."
        ],
        codeExample: "const file = JSON.parse(text); const payload = file.character || file.data || file; const name = payload?.characterInfo?.name;"
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilePart(displayName, 'dnd_character')}_${sanitizeFilePart(levelPart, 'lvl-unknown')}_created-${createdDatePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.textContent = 'Exported!';
      saveStatus.style.color = '#4CAF50';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 2000);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Export failed. Please try again.');
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      // Support multiple import formats:
      // 1) Current export wrapper: { version, exportDate, character, characterInfo }
      // 2) Raw character payload: { characterInfo, page1, ... }
      // 3) Full character record: { id, name, data }
      const characterData = importedData?.character || importedData?.data || importedData;
      const charName =
        importedData?.characterInfo?.name ||
        importedData?.name ||
        characterData?.characterInfo?.name ||
        'Imported Character';

      if (!characterData || typeof characterData !== 'object') {
        throw new Error('Unsupported character file format');
      }

      const importedCreatedAt =
        importedData?.createdAt ||
        importedData?.characterInfo?.createdAt ||
        new Date().toISOString();
      
      const newChar = {
        id: generateCharacterId(),
        name: charName,
        createdAt: importedCreatedAt,
        updatedAt: new Date().toISOString(),
        data: characterData
      };
      
      let characters = getStoredJSON('dndCharacters', []);
      characters.push(newChar);
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
      queueCloudSync(0);
      
      loadCharacterList();
      loadSelectedCharacter(newChar.id);
      setupSkillCalculationFields();
      enforceAutoMathNumericInputs();
      
      alert(`Character "${charName}" imported successfully!`);
    } catch (err) {
      alert("Error importing file: " + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

