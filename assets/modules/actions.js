// ========== ACTIONS SYSTEM ==========
let actionsData = {
  actions: []
};

// Initialize actions
function initializeActions() {
  loadActions();
  displayActions('action');
  updateFavorites();
}

// Show action form
function showActionForm(type) {
  document.getElementById('actionFormTitle').textContent = 'Add Action';
  document.getElementById('action_name').value = '';
  document.getElementById('action_category').value = 'melee';
  document.getElementById('action_damage').value = '';
  document.getElementById('action_range').value = '';
  document.getElementById('action_uses').value = '';
  document.getElementById('action_attack').value = '';
  document.getElementById('action_description').value = '';
  document.getElementById('saveActionBtn').textContent = 'Add Action';
  showPopup('actionFormPopup');
}

// Update action form based on type
function updateActionForm() {
  const categorySelect = document.getElementById('action_category');
  
  // Clear existing options
  categorySelect.innerHTML = '';
  
  const options = [
    { value: 'melee', text: 'Melee' },
    { value: 'ranged', text: 'Ranged' },
    { value: 'spell', text: 'Spell' },
    { value: 'other', text: 'Other' }
  ];
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    categorySelect.appendChild(optionElement);
  });
}

// Save action
function saveAction() {
  const name = document.getElementById('action_name').value.trim();
  const category = document.getElementById('action_category').value;
  const damage = document.getElementById('action_damage').value.trim();
  const range = document.getElementById('action_range').value.trim();
  const uses = document.getElementById('action_uses').value.trim();
  const attack = document.getElementById('action_attack').value.trim();
  const description = document.getElementById('action_description').value.trim();
  const editId = document.getElementById('saveActionBtn').getAttribute('data-edit-id');
  
  if (!name) {
    alert('Please enter a name for the action.');
    return;
  }
  
  const actionData = {
    id: editId || Date.now().toString(),
    name: name,
    type: 'action',
    category: category,
    damage: damage,
    range: range,
    uses: uses,
    attack: attack,
    description: description,
    favorite: false
  };
  
  if (editId) {
    // Editing existing action
    const existingAction = actionsData.actions.find(a => a.id === editId);
    if (existingAction) {
      actionData.favorite = existingAction.favorite; // Preserve favorite status
      Object.assign(existingAction, actionData);
    }
  } else {
    // Adding new action
    actionsData.actions.push(actionData);
  }
  
  saveActions();
  displayActions('action');
  updateFavorites();
  closePopup('actionFormPopup');
  autosave();
}

// Display actions
function displayActions(type) {
  const container = document.getElementById('actions_list');
  if (!container) {
    return;
  }
  
  const data = actionsData.actions;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No actions added yet. Click "+ Add Action" to get started!</p>`;
    return;
  }
  
  data.forEach(action => {
    const actionCard = createActionCard(action, 'action');
    container.appendChild(actionCard);
  });
}

// Create action card
function createActionCard(action, type) {
  const card = document.createElement('div');
  card.className = `action-card ${action.favorite ? 'favorite' : ''}`;
  card.innerHTML = `
    <div class="action-header">
      <h4 class="action-name">${action.name}</h4>
      <span class="action-type">${action.category}</span>
    </div>
    <div class="action-stats">
      ${action.damage ? `<div class="action-stat"><span class="action-stat-label">Damage/Effect:</span><span class="action-stat-value">${action.damage}</span></div>` : ''}
      ${action.range ? `<div class="action-stat"><span class="action-stat-label">Range/Area:</span><span class="action-stat-value">${action.range}</span></div>` : ''}
      ${action.uses ? `<div class="action-stat"><span class="action-stat-label">Uses:</span><span class="action-stat-value">${action.uses}</span></div>` : ''}
      ${action.attack ? `<div class="action-stat"><span class="action-stat-label">Attack/Save:</span><span class="action-stat-value">${action.attack}</span></div>` : ''}
    </div>
    ${action.description ? `<div class="action-description">${action.description}</div>` : ''}
    <div class="action-actions">
      <button class="action-btn favorite-btn ${action.favorite ? 'favorited' : ''}" onclick="toggleFavorite('${action.id}', '${type}')">
        ${action.favorite ? '❤️' : '🤍'}
      </button>
      <button class="action-btn edit-btn" onclick="editAction('${action.id}', '${type}')">✏️</button>
      <button class="action-btn delete-btn" onclick="deleteAction('${action.id}', '${type}')">🗑️</button>
    </div>
  `;
  return card;
}

// Toggle favorite
function toggleFavorite(id, type) {
  const action = actionsData.actions.find(a => a.id === id);
  if (action) {
    action.favorite = !action.favorite;
    saveActions();
    displayActions('action');
    updateFavorites();
    autosave();
  }
}

// Edit action
function editAction(id, type) {
  const action = actionsData.actions.find(a => a.id === id);
  if (action) {
    document.getElementById('actionFormTitle').textContent = 'Edit Action';
    document.getElementById('action_type').value = 'action';
    document.getElementById('action_name').value = action.name;
    document.getElementById('action_category').value = action.category;
    document.getElementById('action_damage').value = action.damage;
    document.getElementById('action_range').value = action.range;
    document.getElementById('action_uses').value = action.uses;
    document.getElementById('action_attack').value = action.attack;
    document.getElementById('action_description').value = action.description;
    document.getElementById('saveActionBtn').textContent = 'Update Action';
    document.getElementById('saveActionBtn').setAttribute('data-edit-id', id);
    showPopup('actionFormPopup');
  }
}

// Delete action
function deleteAction(id, type) {
  if (confirm('Are you sure you want to delete this action?')) {
    const index = actionsData.actions.findIndex(a => a.id === id);
    if (index > -1) {
      actionsData.actions.splice(index, 1);
      saveActions();
      displayActions('action');
      updateFavorites();
      autosave();
    }
  }
}

// Clear all actions
function clearAllActions(type) {
  if (confirm('Are you sure you want to clear all actions? This cannot be undone.')) {
    actionsData.actions = [];
    saveActions();
    displayActions('action');
    updateFavorites();
    autosave();
  }
}

// Filter actions
function filterActions(type) {
  const filter = document.getElementById('action_filter').value;
  const data = actionsData.actions;
  const container = document.getElementById('actions_list');
  
  let filteredData = data;
  if (filter !== 'all') {
    if (filter === 'favorites') {
      filteredData = data.filter(action => action.favorite);
    } else {
      filteredData = data.filter(action => action.category === filter);
    }
  }
  
  container.innerHTML = '';
  
  if (filteredData.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No actions found for this filter.</p>`;
    return;
  }
  
  filteredData.forEach(action => {
    const actionCard = createActionCard(action, 'action');
    container.appendChild(actionCard);
  });
}

// Update favorites display
function updateFavorites() {
  const favoritesActions = actionsData.actions.filter(action => action.favorite);
  
  const actionsContainer = document.getElementById('favorites_actions_list');
  
  actionsContainer.innerHTML = '';
  
  if (favoritesActions.length === 0) {
    actionsContainer.innerHTML = '<p style="text-align: center; color: var(--text); opacity: 0.7;">No favorite actions yet.</p>';
  } else {
    favoritesActions.forEach(action => {
      const actionCard = createActionCard(action, 'action');
      actionsContainer.appendChild(actionCard);
    });
  }
}

// Save actions to localStorage
function saveActions() {
  localStorage.setItem('dndActions', JSON.stringify(actionsData));
}

// Load actions from localStorage
function loadActions() {
  const saved = localStorage.getItem('dndActions');
  if (saved) {
    actionsData = JSON.parse(saved);
  }
}

