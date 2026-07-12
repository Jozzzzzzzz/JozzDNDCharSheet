// ========== INVENTORY SYSTEM ==========
let inventoryData = {
  equipment: [],
  mainInventory: [],
  storageContainers: [],
  maxWeightCapacity: 0,
  purchaseHistory: []
};

// Initialize inventory system
function initializeInventory() {
  loadInventory();
  displayEquipment();
  displayEquipmentStats();
  displayMainInventory();
  loadStorageContainers();
  updateWeightDisplay();
  displayPurchaseHistory();

  // Restore encumbrance toggle state
  const encToggle = document.getElementById('encumbrance_toggle');
  if (encToggle) encToggle.checked = !!inventoryData.encumbranceEnabled;

  // Add event delegation for equipment buttons (only once)
  const equipmentContainer = document.getElementById('equipment_list');
  if (equipmentContainer) {
    equipmentContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('equipment-btn')) {
        const equipmentId = e.target.getAttribute('data-equipment-id');
        const action = e.target.getAttribute('data-action');
        
        if (action === 'notes') {
          showEquipmentNotes(equipmentId);
        } else if (action === 'edit') {
          editEquipment(equipmentId);
        } else if (action === 'delete') {
          deleteEquipment(equipmentId);
        }
      }
    });
  }
  
  // Add event delegation for stats page equipment buttons
  const equipmentStatsContainer = document.getElementById('equipment_stats_list');
  if (equipmentStatsContainer) {
    equipmentStatsContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('equipment-btn')) {
        const equipmentId = e.target.getAttribute('data-equipment-id');
        const action = e.target.getAttribute('data-action');
        
        if (action === 'notes') {
          showEquipmentNotes(equipmentId);
        } else if (action === 'edit') {
          editEquipment(equipmentId);
        } else if (action === 'delete') {
          deleteEquipment(equipmentId);
        }
      }
    });
  }
  
  // Add event delegation for stats page weapons (same card/button pattern as equipment)
  const weaponsStatsContainer = document.getElementById('weapons_stats_list');
  if (weaponsStatsContainer && !weaponsStatsContainer.dataset.delegationBound) {
    weaponsStatsContainer.dataset.delegationBound = '1';
    weaponsStatsContainer.addEventListener('click', function(e) {
      const weaponBtn = e.target.closest('.equipment-btn[data-weapon-index]');
      if (weaponBtn) {
        const weaponIndex = parseInt(weaponBtn.getAttribute('data-weapon-index'), 10);
        const action = weaponBtn.getAttribute('data-action');

        if (action === 'notes') {
          showWeaponNotes(weaponIndex);
        } else if (action === 'edit') {
          editWeapon(weaponIndex);
        } else if (action === 'delete') {
          appConfirm('Are you sure you want to delete this weapon?', { confirmText: 'Delete' }).then(ok => {
            if (!ok) return;
            weaponsData.splice(weaponIndex, 1);
            displayWeaponsStats();
            updateWeaponsPreview();
            autosave();
          });
        }
        return;
      }

      const weaponCard = e.target.closest('.equipment-card[data-weapon-index]');
      if (weaponCard && !e.target.closest('.equipment-btn')) {
        const weaponIndex = parseInt(weaponCard.getAttribute('data-weapon-index'), 10);
        if (!Number.isNaN(weaponIndex)) {
          showWeaponDetails(weaponIndex);
        }
      }
    });
  }
}

// Load storage containers from saved data
function loadStorageContainers() {
  if (!inventoryData.storageContainers) return;
  
  const extraContainers = document.getElementById('extra_containers');
  extraContainers.innerHTML = '';
  
  inventoryData.storageContainers.forEach(storage => {
    const containerHTML = `
      <div class="section storage-container-section" id="${storage.id}">
        <div class="inventory-controls">
          <h3>${storage.name}</h3>
          <div class="inventory-settings">
            ${storage.maxWeight > 0 ? `<span>Max Weight: ${storage.maxWeight} lbs</span>` : '<span>Unlimited Weight</span>'}
          </div>
          <button class="delete-container-btn" onclick="confirmContainerDeletion('${storage.id}')">Delete Container</button>
        </div>
        
        <div class="inventory-controls" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button onclick="showItemForm('${storage.id}')">+ Add Item</button>
          <input type="search" id="search_${storage.id}" placeholder="Filter items..." oninput="filterInventory('${storage.id}')" style="flex:1;min-width:120px;"/>
        </div>

        <div class="inventory-list-container" id="${storage.id}_items">
          <!-- Items will be populated here -->
        </div>
        <div class="weight-display" id="${storage.id}_weight">Total: 0 lbs / 0 kg</div>
      </div>
    `;
    
    extraContainers.insertAdjacentHTML('beforeend', containerHTML);
    
    // Add to item container dropdown
    const containerDropdown = document.getElementById('item_container');
    if (containerDropdown) {
      const option = document.createElement('option');
      option.value = storage.id;
      option.textContent = storage.name;
      containerDropdown.appendChild(option);
    }
    
    // Display items for this container
    displayStorageItems(storage.id);
  });
}

// Show equipment form
function showEquipmentForm() {
  document.getElementById('equipmentFormTitle').textContent = 'Add Equipment';
  document.getElementById('equipment_name').value = '';
  document.getElementById('equipment_type').value = 'weapon';
  document.getElementById('equipment_bonus').value = '';
  document.getElementById('equipment_weight').value = '';
  document.getElementById('equipment_description').value = '';
  document.getElementById('saveEquipmentBtn').textContent = 'Add Equipment';
  document.getElementById('saveEquipmentBtn').removeAttribute('data-edit-id');
  showPopup('equipmentFormPopup');
}

// Save equipment
function saveEquipment() {
  
  const name = document.getElementById('equipment_name').value.trim();
  const type = document.getElementById('equipment_type').value;
  const bonus = document.getElementById('equipment_bonus').value.trim();
  const weight = parseFloat(document.getElementById('equipment_weight').value) || 0;
  const description = document.getElementById('equipment_description').value.trim();
  const editId = document.getElementById('saveEquipmentBtn').getAttribute('data-edit-id');
  
  
  if (!name) {
    appToast('Please enter a name for the equipment.', 'error');
    return;
  }
  
  const equipmentData = {
    id: editId || Date.now().toString(),
    name: name,
    type: type,
    bonus: bonus,
    weight: weight,
    description: description
  };
  
  if (editId) {
    // Editing existing equipment
    const existingEquipment = inventoryData.equipment.find(e => e.id === editId);
    if (existingEquipment) {
      Object.assign(existingEquipment, equipmentData);
    } else {
    }
  } else {
    // Adding new equipment
    inventoryData.equipment.push(equipmentData);
  }
  
  displayEquipment();
  displayEquipmentStats();
  updateWeightDisplay();
  syncEquipmentToStats();
  
  // Also update the stats page equipment data
  window.equipmentData = inventoryData.equipment.map(item => ({
    name: item.name,
    type: item.type,
    bonus: item.bonus,
    weight: item.weight,
    notes: item.description
  }));
  updateEquipmentPreviews();
  
  closePopup('equipmentFormPopup');
  autosave();
  
  // Force refresh the equipment display
  setTimeout(() => {
    displayEquipment();
  }, 100);
}

// Display equipment
function displayEquipment() {
  const container = document.getElementById('equipment_list');
  
  // Ensure inventoryData.equipment exists
  if (!inventoryData.equipment) {
    inventoryData.equipment = [];
  }
  
  const data = inventoryData.equipment;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No equipment added yet. Click "+ Add Equipment" to get started!</p>`;
    return;
  }
  
  data.forEach(equipment => {
    const equipmentCard = createEquipmentCard(equipment);
    container.appendChild(equipmentCard);
  });
  
  updateEquipmentWeightDisplay();
}

// Display equipment on stats page
function displayEquipmentStats() {
  const container = document.getElementById('equipment_stats_list');
  
  // Ensure inventoryData.equipment exists
  if (!inventoryData.equipment) {
    inventoryData.equipment = [];
  }
  
  const data = inventoryData.equipment;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No equipment added yet. Click "+ Add Equipment" to get started!</p>`;
    updateEquipmentStatsWeightDisplay();
    return;
  }
  
  data.forEach(equipment => {
    const equipmentCard = createEquipmentCard(equipment);
    container.appendChild(equipmentCard);
  });
  
  updateEquipmentStatsWeightDisplay();
}

// Display weapons on stats page
function displayWeaponsStats() {
  const container = document.getElementById('weapons_stats_list');
  if (!container) return;

  container.innerHTML = '';
  
  if (weaponsData.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No weapons added yet. Click "+ Add Weapon" to get started!</p>`;
    return;
  }
  
  weaponsData.forEach((weapon, index) => {
    const weaponCard = createWeaponCard(weapon, index);
    container.appendChild(weaponCard);
  });
}

// Create weapon card (reuse equipment card markup/classes so it looks identical on the stats page)
function createWeaponCard(weapon, index) {
  const card = document.createElement('div');
  card.className = 'equipment-card';
  card.setAttribute('data-weapon-index', String(index));
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View details for ${weapon.name || 'weapon'}`);

  const typeLabel = weapon.properties
    ? weapon.properties.split(',')[0].trim()
    : 'Weapon';

  const notesPreview = weapon.notes && weapon.notes.length > 120
    ? `${weapon.notes.substring(0, 117)}...`
    : weapon.notes;

  const name = escapeHtml(weapon.displayName || weapon.name || 'Unnamed Weapon');
  const badge = escapeHtml(typeLabel);
  const toHit = escapeHtml(weapon.toHit || '-');
  const damage = escapeHtml(weapon.damage || '-');

  card.innerHTML = `
    <div class="equipment-header">
      <h4 class="equipment-name">${name}</h4>
      <span class="equipment-type">${badge}</span>
    </div>
    <div class="equipment-stats">
      <div class="equipment-stat"><span class="equipment-stat-label">To Hit:</span><span class="equipment-stat-value">${toHit}</span></div>
      <div class="equipment-stat"><span class="equipment-stat-label">Damage:</span><span class="equipment-stat-value">${damage}</span></div>
      ${weapon.bonusDamage ? `<div class="equipment-stat"><span class="equipment-stat-label">Bonus Dmg:</span><span class="equipment-stat-value">${escapeHtml(weapon.bonusDamage)}</span></div>` : ''}
      ${weapon.properties ? `<div class="equipment-stat"><span class="equipment-stat-label">Properties:</span><span class="equipment-stat-value">${escapeHtml(weapon.properties)}</span></div>` : ''}
    </div>
    ${notesPreview ? `<div class="equipment-description">${escapeHtml(notesPreview)}</div>` : ''}
    <div class="weapon-roll-row" onclick="event.stopPropagation();">
      <div class="weapon-roll-group">
        <span class="weapon-roll-label">Attack</span>
        <button type="button" class="weapon-roll-btn" title="Roll to hit" onclick="event.stopPropagation(); rollWeaponAttack(${index}, 'normal')">Hit</button>
        <button type="button" class="weapon-roll-btn weapon-roll-adv" title="With advantage" onclick="event.stopPropagation(); rollWeaponAttack(${index}, 'adv')">Adv</button>
        <button type="button" class="weapon-roll-btn weapon-roll-dis" title="With disadvantage" onclick="event.stopPropagation(); rollWeaponAttack(${index}, 'dis')">Dis</button>
      </div>
      <div class="weapon-roll-group">
        <span class="weapon-roll-label">Damage</span>
        <button type="button" class="weapon-roll-btn" title="Roll damage" onclick="event.stopPropagation(); rollWeaponDmg(${index}, false)">Dmg</button>
        <button type="button" class="weapon-roll-btn weapon-roll-crit" title="Roll critical damage (double dice)" onclick="event.stopPropagation(); rollWeaponDmg(${index}, true)">Crit</button>
      </div>
    </div>
    <div class="equipment-actions">
      <button type="button" class="equipment-btn notes-btn" data-weapon-index="${index}" data-action="notes">Notes</button>
      <button type="button" class="equipment-btn edit-btn" data-weapon-index="${index}" data-action="edit">Edit</button>
      <button type="button" class="equipment-btn delete-btn" data-weapon-index="${index}" data-action="delete">Delete</button>
    </div>
  `;

  card.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showWeaponDetails(index);
    }
  });

  return card;
}

// Create equipment card
function createEquipmentCard(equipment) {
  const card = document.createElement('div');
  card.className = 'equipment-card';
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s => String(s));
  card.innerHTML = `
    <div class="equipment-header">
      <h4 class="equipment-name">${esc(equipment.name)}</h4>
      <span class="equipment-type">${esc(equipment.type)}</span>
    </div>
    <div class="equipment-stats">
      ${equipment.bonus ? `<div class="equipment-stat"><span class="equipment-stat-label">Bonus/AC:</span><span class="equipment-stat-value">${esc(equipment.bonus)}</span></div>` : ''}
      <div class="equipment-stat"><span class="equipment-stat-label">Weight:</span><span class="equipment-stat-value">${esc(String(equipment.weight))} lbs</span></div>
    </div>
    ${equipment.description ? `<div class="equipment-description">${esc(equipment.description)}</div>` : ''}
    <div class="equipment-actions">
      <button class="equipment-btn notes-btn" data-equipment-id="${esc(equipment.id)}" data-action="notes">Notes</button>
      <button class="equipment-btn edit-btn" data-equipment-id="${esc(equipment.id)}" data-action="edit">Edit</button>
      <button class="equipment-btn delete-btn" data-equipment-id="${esc(equipment.id)}" data-action="delete">Delete</button>
    </div>
  `;
  return card;
}

// Edit equipment
function editEquipment(id) {
  
  const equipment = inventoryData.equipment.find(e => e.id === id);
  
  if (equipment) {
    
    document.getElementById('equipmentFormTitle').textContent = 'Edit Equipment';
    document.getElementById('equipment_name').value = equipment.name || '';
    document.getElementById('equipment_type').value = equipment.type || 'weapon';
    document.getElementById('equipment_bonus').value = equipment.bonus || '';
    document.getElementById('equipment_weight').value = equipment.weight || '';
    document.getElementById('equipment_description').value = equipment.description || '';
    document.getElementById('saveEquipmentBtn').textContent = 'Update Equipment';
    document.getElementById('saveEquipmentBtn').setAttribute('data-edit-id', id);
    
    showPopup('equipmentFormPopup');
    
    // Verify form values after popup is shown
    setTimeout(() => {
      
      // Check which popups are visible
      const formPopup = document.getElementById('equipmentFormPopup');
      const tablePopup = document.getElementById('equipmentPopup');
    }, 200);
  } else {
  }
}

// Delete equipment
function deleteEquipment(id) {
  appConfirm('Are you sure you want to delete this equipment?', { confirmText: 'Delete' }).then(ok => {
    if (!ok) return;
    const index = inventoryData.equipment.findIndex(e => e.id === id);
    if (index === -1) return;

    inventoryData.equipment.splice(index, 1);

    displayEquipment();
    displayEquipmentStats();
    updateWeightDisplay();
    syncEquipmentToStats();

    // Also update the stats page equipment data
    window.equipmentData = inventoryData.equipment.map(item => ({
      name: item.name,
      type: item.type,
      bonus: item.bonus,
      weight: item.weight,
      notes: item.description
    }));
    updateEquipmentPreviews();

    autosave();
  });
}


// Show item form
function showItemForm(container) {
  document.getElementById('itemFormTitle').textContent = 'Add Item';
  document.getElementById('item_name').value = '';
  document.getElementById('item_type').value = 'consumable';
  document.getElementById('item_weight').value = '';
  document.getElementById('item_description').value = '';
  document.getElementById('item_value').value = '';
  document.getElementById('item_stackable').checked = false;
  document.getElementById('item_quantity').value = 1;
  document.getElementById('item_quantity_row').style.display = 'none';
  document.getElementById('saveItemBtn').textContent = 'Add Item';
  document.getElementById('saveItemBtn').setAttribute('data-container', container);
  document.getElementById('saveItemBtn').removeAttribute('data-edit-id');
  showPopup('itemFormPopup');
}

function toggleItemStackable() {
  const stackable = document.getElementById('item_stackable').checked;
  document.getElementById('item_quantity_row').style.display = stackable ? 'flex' : 'none';
}

// Save item
function saveItem() {
  const nameElement = document.getElementById('item_name');
  const typeElement = document.getElementById('item_type');
  const weightElement = document.getElementById('item_weight');
  const descriptionElement = document.getElementById('item_description');
  const saveBtnElement = document.getElementById('saveItemBtn');
  
  // Check if elements exist
  if (!nameElement || !typeElement || !weightElement || !descriptionElement || !saveBtnElement) {
    console.error('Missing form elements:', { nameElement, typeElement, weightElement, descriptionElement, saveBtnElement });
    appToast('Form error: missing required elements. Please refresh the page and try again.', 'error');
    return;
  }
  
  const name = nameElement.value.trim();
  const type = typeElement.value;
  const weight = parseFloat(weightElement.value) || 0;
  const description = descriptionElement.value.trim();
  const container = saveBtnElement.getAttribute('data-container');
  const editId = saveBtnElement.getAttribute('data-edit-id');
  const stackable = document.getElementById('item_stackable').checked;
  const quantity = stackable ? (parseInt(document.getElementById('item_quantity').value) || 1) : 1;
  const value = parseFloat(document.getElementById('item_value').value) || 0;

  if (!name) {
    appToast('Please enter a name for the item.', 'error');
    return;
  }

  const itemData = {
    id: editId || Date.now().toString(),
    name: name,
    type: type,
    weight: weight,
    description: description,
    stackable: stackable,
    quantity: quantity,
    value: value
  };
  
  // Effective weight for this item (unit × qty for stackables)
  const effectiveWeight = weight * quantity;

  // Check weight limits
  if (container === 'main') {
    const currentWeight = calculateMainInventoryWeight();
    // When editing, subtract the old item's weight first
    const oldWeight = editId ? itemEffectiveWeight(inventoryData.mainInventory.find(i => i.id === editId) || {}) : 0;
    const maxWeight = inventoryData.maxWeightCapacity;
    if (maxWeight > 0 && (currentWeight - oldWeight + effectiveWeight) > maxWeight) {
      document.getElementById('weightWarningMessage').textContent = 'Sorry, that item won\'t fit into your main inventory.';
      showPopup('weightWarningPopup');
      return;
    }
  } else {
    const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
    if (storageContainer) {
      const currentWeight = calculateStorageWeight(container);
      const oldItem = editId ? (storageContainer.items || []).find(i => i.id === editId) : null;
      const oldWeight = oldItem ? itemEffectiveWeight(oldItem) : 0;
      if (storageContainer.maxWeight > 0 && (currentWeight - oldWeight + effectiveWeight) > storageContainer.maxWeight) {
        document.getElementById('weightWarningMessage').textContent = `Sorry, that item won't fit into ${storageContainer.name}.`;
        showPopup('weightWarningPopup');
        return;
      }
    }
  }
  
  if (editId) {
    // Editing existing item
    let existingItem;
    if (container === 'main') {
      existingItem = inventoryData.mainInventory.find(i => i.id === editId);
    } else {
      const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
      if (storageContainer) {
        existingItem = storageContainer.items.find(i => i.id === editId);
      }
    }
    if (existingItem) {
      Object.assign(existingItem, itemData);
    }
  } else {
    // Adding new item
    if (container === 'main') {
      inventoryData.mainInventory.push(itemData);
    } else {
      const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
      if (storageContainer) {
        storageContainer.items.push(itemData);
      }
    }
  }
  
  saveInventory();
  if (container === 'main') {
    displayMainInventory();
  } else {
    displayStorageContainers();
  }
  updateWeightDisplay();
  closePopup('itemFormPopup');
  autosave();
}

// Display main inventory
function displayMainInventory() {
  const container = document.getElementById('main_inventory_list');
  const data = inventoryData.mainInventory;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No items in main inventory. Click "+ Add Item" to get started!</p>`;
    return;
  }
  
  data.forEach(item => {
    const itemCard = createItemCard(item, 'main');
    container.appendChild(itemCard);
  });
  
  updateMainInventoryWeightDisplay();
}

// Create item card
function createItemCard(item, container) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.itemName = (item.name || '').toLowerCase();
  card.dataset.itemType = (item.type || '').toLowerCase();

  const qty = item.stackable ? (item.quantity || 1) : 1;
  const totalWeight = ((item.weight || 0) * qty).toFixed(2).replace(/\.00$/, '');
  const weightLabel = item.stackable && qty > 1
    ? `${totalWeight} lbs (${item.weight} × ${qty})`
    : `${totalWeight} lbs`;
  const valueText = item.value > 0
    ? `<div class="item-stat"><span class="item-stat-label">Value:</span><span class="item-stat-value">${item.value} gp${item.stackable && qty > 1 ? ` × ${qty} = ${(item.value * qty).toFixed(2).replace(/\.00$/, '')} gp` : ''}</span></div>`
    : '';
  const qtyBadge = item.stackable ? `<span class="item-qty-badge">×${qty}</span>` : '';
  const refillBtn = item.stackable
    ? `<button class="item-btn refill-btn" onclick="showRefillPopup('${item.id}', '${container}')" title="Refill stack">+</button>`
    : '';

  // Build move-to options (all destinations except current)
  const destinations = [{ id: 'main', name: 'Main Inventory' }]
    .concat((inventoryData.storageContainers || []).map(s => ({ id: s.id, name: s.name })))
    .filter(d => d.id !== container);
  const moveOptions = destinations.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
  const moveSelect = destinations.length > 0
    ? `<select class="item-move-select" onchange="moveItem('${item.id}', '${container}', this.value); this.value='';" title="Move to...">
         <option value="" disabled selected>Move to...</option>
         ${moveOptions}
       </select>`
    : '';

  card.innerHTML = `
    <div class="item-header">
      <h4 class="item-name">${escapeHtml(item.name)}</h4>
      <span class="item-type">${escapeHtml(item.type)}</span>
      ${qtyBadge}
    </div>
    <div class="item-stats">
      <div class="item-stat"><span class="item-stat-label">Weight:</span><span class="item-stat-value">${weightLabel}</span></div>
      ${valueText}
    </div>
    ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
    <div class="item-actions">
      ${refillBtn}
      ${moveSelect}
      <button class="item-btn edit-btn" onclick="editItem('${item.id}', '${container}')">Edit</button>
      <button class="item-btn delete-btn" onclick="deleteItem('${item.id}', '${container}')">Del</button>
    </div>
  `;
  return card;
}

// Edit item
function editItem(id, container) {
  let item;
  if (container === 'main') {
    item = inventoryData.mainInventory.find(i => i.id === id);
  } else {
    const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
    if (storageContainer) {
      item = storageContainer.items.find(i => i.id === id);
    }
  }
  
  if (item) {
    document.getElementById('itemFormTitle').textContent = 'Edit Item';
    document.getElementById('item_name').value = item.name;
    document.getElementById('item_type').value = item.type;
    document.getElementById('item_weight').value = item.weight;
    document.getElementById('item_description').value = item.description || '';
    document.getElementById('item_value').value = item.value || '';
    document.getElementById('item_stackable').checked = !!item.stackable;
    document.getElementById('item_quantity').value = item.quantity || 1;
    document.getElementById('item_quantity_row').style.display = item.stackable ? 'flex' : 'none';
    document.getElementById('saveItemBtn').textContent = 'Update Item';
    document.getElementById('saveItemBtn').setAttribute('data-container', container);
    document.getElementById('saveItemBtn').setAttribute('data-edit-id', id);
    showPopup('itemFormPopup');
  }
}

// Delete item
function deleteItem(id, container) {
  appConfirm('Are you sure you want to delete this item?', { confirmText: 'Delete' }).then(ok => {
    if (!ok) return;
    if (container === 'main') {
      const index = inventoryData.mainInventory.findIndex(i => i.id === id);
      if (index > -1) {
        inventoryData.mainInventory.splice(index, 1);
        displayMainInventory();
      }
    } else {
      const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
      if (storageContainer) {
        const index = storageContainer.items.findIndex(i => i.id === id);
        if (index > -1) {
          storageContainer.items.splice(index, 1);
          displayStorageContainers();
        }
      }
    }
    saveInventory();
    updateWeightDisplay();
    autosave();
  });
}





// Display storage items
function displayStorageItems(storageId) {
  const storage = inventoryData.storageContainers.find(s => s.id === storageId);
  if (!storage) return;
  
  const container = document.getElementById(`${storageId}_items`);
  const data = storage.items;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No items in this storage container. Click "+ Add Item" to get started!</p>`;
    return;
  }
  
  data.forEach(item => {
    const itemCard = createItemCard(item, storageId);
    container.appendChild(itemCard);
  });
}

// Returns the effective weight of a single item (weight × quantity for stackables)
function itemEffectiveWeight(item) {
  const qty = item.stackable ? (item.quantity || 1) : 1;
  return (item.weight || 0) * qty;
}

// Calculate main inventory weight (includes equipment + items)
function calculateMainInventoryWeight() {
  const equipmentWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const itemsWeight = inventoryData.mainInventory.reduce((total, item) => total + itemEffectiveWeight(item), 0);
  return equipmentWeight + itemsWeight;
}

// Calculate storage weight
function calculateStorageWeight(storageId) {
  const storage = inventoryData.storageContainers.find(s => s.id === storageId);
  if (!storage) return 0;
  return storage.items.reduce((total, item) => total + itemEffectiveWeight(item), 0);
}

// Update weight display
function updateWeightDisplay() {
  updateEquipmentWeightDisplay();
  updateMainInventoryWeightDisplay();
  updateStorageWeightDisplays();
}

// Aliases used by app.js and core.js inline handlers
function updateWeight() {
  updateWeightDisplay();
}

function updateContainerWeight(containerId) {
  updateStorageWeightDisplays();
}

// Update equipment weight display
function updateEquipmentWeightDisplay() {
  const totalWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const totalWeightKg = (totalWeight * 0.453592).toFixed(2);
  document.getElementById('equipment_weight_total').textContent = `Equipment Weight: ${totalWeight} lbs / ${totalWeightKg} kg`;
}

// Update equipment weight display on stats page
function updateEquipmentStatsWeightDisplay() {
  const totalWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const totalWeightKg = (totalWeight * 0.453592).toFixed(2);
  document.getElementById('equipment_stats_weight_total').textContent = `Equipment Weight: ${totalWeight} lbs / ${totalWeightKg} kg`;
}

// Update main inventory weight display
function updateMainInventoryWeightDisplay() {
  const equipmentWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const itemsWeight = inventoryData.mainInventory.reduce((total, item) => total + itemEffectiveWeight(item), 0);
  const totalWeight = parseFloat((equipmentWeight + itemsWeight).toFixed(2));
  const totalWeightKg = (totalWeight * 0.453592).toFixed(2);
  const maxWeight = inventoryData.maxWeightCapacity;
  const weightDisplay = document.getElementById('main_inventory_weight_total');

  const totalValue = inventoryData.mainInventory.reduce((sum, item) => {
    const qty = item.stackable ? (item.quantity || 1) : 1;
    return sum + ((item.value || 0) * qty);
  }, 0);
  const valueLine = totalValue > 0
    ? `<div style="font-size: 0.8em; opacity: 0.8; margin-top: 3px;">Total Value: ${totalValue.toFixed(2).replace(/\.00$/, '')} gp</div>`
    : '';

  // Encumbrance line
  let encumbranceLine = '';
  if (inventoryData.encumbranceEnabled) {
    const tier = getEncumbranceTier(totalWeight);
    const strEl = document.getElementById('str');
    const str = strEl ? (parseInt(strEl.value) || 10) : 10;
    const enc = str * 5, heavy = str * 10, max = str * 15;
    const thresholds = `Enc: ${enc} | Heavy: ${heavy} | Max: ${max} lbs`;
    if (tier) {
      encumbranceLine = `<div style="font-size:0.85em;font-weight:bold;color:${tier.color};margin-top:4px;">${tier.label}</div>
        <div style="font-size:0.75em;opacity:0.75;margin-top:2px;">${thresholds}</div>`;
    } else {
      encumbranceLine = `<div style="font-size:0.75em;opacity:0.7;margin-top:4px;">${thresholds}</div>`;
    }
  }

  // Update encumbrance status chip near the toggle
  const statusEl = document.getElementById('encumbrance_status');
  if (statusEl && inventoryData.encumbranceEnabled) {
    const tier = getEncumbranceTier(totalWeight);
    statusEl.textContent = tier ? tier.label.split(' (')[0] : 'No encumbrance';
    statusEl.style.color = tier ? tier.color : '';
  } else if (statusEl) {
    statusEl.textContent = '';
  }

  if (maxWeight > 0) {
    const weightStatus = totalWeight > maxWeight ? 'weight-warning' : 'weight-ok';
    weightDisplay.className = `weight-display ${weightStatus}`;
    weightDisplay.innerHTML = `
      <div>Total: ${totalWeight}/${maxWeight} lbs / ${totalWeightKg} kg</div>
      <div style="font-size: 0.8em; opacity: 0.8; margin-top: 5px;">
        Equipment: ${equipmentWeight} lbs | Items: ${itemsWeight} lbs
      </div>
      ${valueLine}
      ${encumbranceLine}
    `;
  } else {
    weightDisplay.className = `weight-display weight-ok`;
    weightDisplay.innerHTML = `
      <div>Total: ${totalWeight} lbs / ${totalWeightKg} kg</div>
      <div style="font-size: 0.8em; opacity: 0.8; margin-top: 5px;">
        Equipment: ${equipmentWeight} lbs | Items: ${itemsWeight} lbs
      </div>
      ${valueLine}
      ${encumbranceLine}
    `;
  }
}

// Update storage weight displays
function updateStorageWeightDisplays() {
  if (!inventoryData.storageContainers) return;
  
  inventoryData.storageContainers.forEach(storage => {
    const currentWeight = parseFloat(calculateStorageWeight(storage.id).toFixed(2));
    const totalWeightKg = (currentWeight * 0.453592).toFixed(2);
    const weightStatus = storage.maxWeight > 0 && currentWeight > storage.maxWeight ? 'weight-warning' : 'weight-ok';
    const totalValue = (storage.items || []).reduce((sum, item) => {
      const qty = item.stackable ? (item.quantity || 1) : 1;
      return sum + ((item.value || 0) * qty);
    }, 0);
    const valueLine = totalValue > 0 ? ` | Value: ${totalValue.toFixed(2).replace(/\.00$/, '')} gp` : '';

    const weightDisplay = document.getElementById(`${storage.id}_weight`);
    if (weightDisplay) {
      weightDisplay.className = `weight-display ${weightStatus}`;
      if (storage.maxWeight > 0) {
        weightDisplay.textContent = `Total: ${currentWeight}/${storage.maxWeight} lbs / ${totalWeightKg} kg${valueLine}`;
      } else {
        weightDisplay.textContent = `Total: ${currentWeight} lbs / ${totalWeightKg} kg${valueLine}`;
      }
    }
  });
}

// Sync equipment to stats page
function syncEquipmentToStats() {
  // Convert inventory equipment data to the format expected by the stats page
  const equipmentData = inventoryData.equipment.map(item => ({
    name: item.name,
    type: item.type,
    bonus: item.bonus,
    weight: item.weight,
    notes: item.description
  }));
  
  // Update the equipment data array used by the stats page
  window.equipmentData = equipmentData;
  
  // Update the equipment preview on the stats page
  updateEquipmentPreviews();
  
  // Also update the stats page equipment display
  displayEquipmentStats();
}

// Sync equipment between stats and inventory pages
function syncEquipmentBetweenPages() {
  // If inventory has equipment but stats doesn't, sync from inventory to stats
  if (inventoryData.equipment && inventoryData.equipment.length > 0 && (!window.equipmentData || window.equipmentData.length === 0)) {
    window.equipmentData = inventoryData.equipment.map(item => ({
      name: item.name,
      type: item.type,
      bonus: item.bonus,
      weight: item.weight,
      notes: item.description
    }));
    updateEquipmentPreviews();
    displayEquipmentStats();
  }
  // If stats has equipment but inventory doesn't, sync from stats to inventory
  else if (window.equipmentData && window.equipmentData.length > 0 && (!inventoryData.equipment || inventoryData.equipment.length === 0)) {
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

// Save inventory to localStorage
function saveInventory() {
  localStorage.setItem('dndInventory', JSON.stringify(inventoryData));
}

// Load inventory from localStorage
function loadInventory() {
  const loadedData = window.getStoredJSON ? window.getStoredJSON('dndInventory', null) : (JSON.parse(localStorage.getItem('dndInventory') || 'null'));
  if (loadedData) {
    // Merge with existing inventoryData to preserve character-specific data
    inventoryData = {
      equipment: loadedData.equipment || [],
      mainInventory: loadedData.mainInventory || [],
      storageContainers: loadedData.storageContainers || [],
      maxWeightCapacity: loadedData.maxWeightCapacity || 0,
      purchaseHistory: loadedData.purchaseHistory || [],
      encumbranceEnabled: loadedData.encumbranceEnabled || false
    };
  } else {
    // Ensure equipment array exists
    if (!inventoryData.equipment) {
      inventoryData.equipment = [];
    }
  }
}

// Update max weight capacity
function updateMaxWeightCapacity() {
  const maxWeight = parseFloat(document.getElementById('max_weight_capacity').value) || 0;
  inventoryData.maxWeightCapacity = maxWeight;
  updateWeightDisplay();
  autosave();
}

// ========== SEARCH / FILTER ==========
function filterInventory(containerId) {
  const searchId = containerId === 'main' ? 'main_inventory_search' : `search_${containerId}`;
  const query = (document.getElementById(searchId)?.value || '').toLowerCase().trim();
  const listId = containerId === 'main' ? 'main_inventory_list' : `${containerId}_items`;
  const list = document.getElementById(listId);
  if (!list) return;

  list.querySelectorAll('.item-card').forEach(card => {
    const name = card.dataset.itemName || '';
    const type = card.dataset.itemType || '';
    card.style.display = (!query || name.includes(query) || type.includes(query)) ? '' : 'none';
  });
}

// ========== QUICK MOVE ==========
function moveItem(itemId, fromContainer, toContainer) {
  if (!toContainer || fromContainer === toContainer) return;

  // Find the item
  let item;
  if (fromContainer === 'main') {
    const idx = inventoryData.mainInventory.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    item = inventoryData.mainInventory.splice(idx, 1)[0];
  } else {
    const sc = inventoryData.storageContainers.find(s => s.id === fromContainer);
    if (!sc) return;
    const idx = sc.items.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    item = sc.items.splice(idx, 1)[0];
  }

  // Place in destination
  if (toContainer === 'main') {
    inventoryData.mainInventory.push(item);
  } else {
    const sc = inventoryData.storageContainers.find(s => s.id === toContainer);
    if (sc) sc.items.push(item);
    else { // destination gone — put it back
      if (fromContainer === 'main') inventoryData.mainInventory.push(item);
      else {
        const orig = inventoryData.storageContainers.find(s => s.id === fromContainer);
        if (orig) orig.items.push(item);
      }
      return;
    }
  }

  saveInventory();
  displayMainInventory();
  displayStorageContainers();
  updateWeightDisplay();
  autosave();
}

// ========== ENCUMBRANCE ==========
function toggleEncumbrance() {
  const enabled = document.getElementById('encumbrance_toggle').checked;
  inventoryData.encumbranceEnabled = enabled;
  saveInventory();
  updateWeightDisplay();
  autosave();
}

function getEncumbranceTier(totalWeight) {
  const strEl = document.getElementById('str');
  const str = strEl ? (parseInt(strEl.value) || 10) : 10;
  const enc = str * 5;
  const heavy = str * 10;
  const max = str * 15;

  if (totalWeight > max)   return { tier: 'max',    label: 'Max Carry Exceeded', color: '#cc0000' };
  if (totalWeight > heavy) return { tier: 'heavy',  label: 'Heavily Encumbered (speed −20, disadvantage on STR/DEX/CON)', color: '#e06c00' };
  if (totalWeight > enc)   return { tier: 'enc',    label: 'Encumbered (speed −10)', color: '#c8a000' };
  return null;
}

// ========== REFILL SYSTEM ==========
let _refillItemId = null;
let _refillContainer = null;

function showRefillPopup(itemId, container) {
  _refillItemId = itemId;
  _refillContainer = container;

  let item;
  if (container === 'main') {
    item = inventoryData.mainInventory.find(i => i.id === itemId);
  } else {
    const sc = inventoryData.storageContainers.find(s => s.id === container);
    if (sc) item = sc.items.find(i => i.id === itemId);
  }
  if (!item) return;

  document.getElementById('refillItemName').textContent = `${item.name} (currently ×${item.quantity || 1})`;
  document.getElementById('refill_qty').value = 1;
  document.getElementById('refill_purchased').checked = true;
  document.getElementById('refill_cost').value = item.value || '';

  // Populate currency dropdown with all available currencies
  const currencySelect = document.getElementById('refill_currency');
  currencySelect.innerHTML = `
    <option value="gp">Gold (gp)</option>
    <option value="sp">Silver (sp)</option>
    <option value="cp">Copper (cp)</option>
    <option value="ep">Electrum (ep)</option>
  `;
  document.querySelectorAll('#custom_currency_rows .custom-currency-row').forEach(row => {
    const name = row.querySelector('.custom-currency-name')?.value?.trim();
    if (name) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      currencySelect.appendChild(opt);
    }
  });
  currencySelect.value = 'gp';

  document.getElementById('refill_cost_section').style.display = 'block';
  updateRefillTotalCost();
  showPopup('refillPopup');
}

function toggleRefillCost() {
  const purchased = document.getElementById('refill_purchased').checked;
  document.getElementById('refill_cost_section').style.display = purchased ? 'block' : 'none';
}

function updateRefillTotalCost() {
  const qty = parseInt(document.getElementById('refill_qty').value) || 0;
  const cost = parseFloat(document.getElementById('refill_cost').value) || 0;
  const currency = document.getElementById('refill_currency').value;
  const total = (qty * cost).toFixed(2).replace(/\.00$/, '');
  const el = document.getElementById('refill_total_cost');
  if (el) el.textContent = qty > 0 && cost > 0 ? `Total: ${total} ${currency}` : '';
}

function confirmRefill() {
  const qty = parseInt(document.getElementById('refill_qty').value) || 0;
  const purchased = document.getElementById('refill_purchased').checked;
  const costPerUnit = parseFloat(document.getElementById('refill_cost').value) || 0;
  const currency = document.getElementById('refill_currency').value;

  if (qty <= 0) { appToast('Please enter a quantity greater than 0.', 'error'); return; }

  // Find item
  let item;
  if (_refillContainer === 'main') {
    item = inventoryData.mainInventory.find(i => i.id === _refillItemId);
  } else {
    const sc = inventoryData.storageContainers.find(s => s.id === _refillContainer);
    if (sc) item = sc.items.find(i => i.id === _refillItemId);
  }
  if (!item) return;

  // Deduct currency if purchased
  if (purchased && costPerUnit > 0) {
    const totalCost = costPerUnit * qty;
    if (!deductCurrency(totalCost, currency)) {
      appToast(`Not enough ${currency.toUpperCase()} to purchase ${qty}× ${item.name}. You need ${totalCost.toFixed(2)} ${currency}.`, 'error');
      return;
    }
  }

  // Add to stack
  item.quantity = (item.quantity || 1) + qty;

  // Log to purchase history
  if (!inventoryData.purchaseHistory) inventoryData.purchaseHistory = [];
  inventoryData.purchaseHistory.unshift({
    id: Date.now().toString(),
    date: new Date().toLocaleDateString(),
    itemName: item.name,
    qtyAdded: qty,
    purchased: purchased,
    costPerUnit: purchased ? costPerUnit : 0,
    totalCost: purchased ? costPerUnit * qty : 0,
    currency: purchased ? currency : null
  });

  saveInventory();
  if (_refillContainer === 'main') {
    displayMainInventory();
  } else {
    displayStorageContainers();
  }
  updateWeightDisplay();
  displayPurchaseHistory();
  closePopup('refillPopup');
  autosave();
}

// Deduct currency from inventory fields — tries to deduct in-kind, no auto-conversion
function deductCurrency(amount, currency) {
  const fieldMap = { gp: 'gold_field', sp: 'currency_sp', cp: 'currency_cp', ep: 'currency_ep' };

  if (fieldMap[currency]) {
    const el = document.getElementById(fieldMap[currency]);
    if (!el) return false;
    const current = parseFloat(el.value) || 0;
    if (current < amount) return false;
    el.value = parseFloat((current - amount).toFixed(2));
    autosave();
    return true;
  }

  // Custom currency — find by name in the custom rows
  const rows = document.querySelectorAll('#custom_currency_rows .custom-currency-row');
  for (const row of rows) {
    const nameInput = row.querySelector('.custom-currency-name');
    const amountInput = row.querySelector('.custom-currency-amount');
    if (nameInput && amountInput && nameInput.value.trim().toLowerCase() === currency.toLowerCase()) {
      const current = parseFloat(amountInput.value) || 0;
      if (current < amount) return false;
      amountInput.value = parseFloat((current - amount).toFixed(2));
      autosave();
      return true;
    }
  }

  return false;
}

// ========== CONDITIONS SYSTEM ==========
// ========== CONDITIONS ==========

// The 14 official SRD 5e conditions, plus Exhaustion (which carries a level).
// desc is the short effect summary; slug builds the open5e.com/conditions link.
const SRD_CONDITIONS = [
  { name: 'Blinded', slug: 'blinded', desc: "Can't see, automatically fails sight checks. Attacks against you have advantage; your attacks have disadvantage." },
  { name: 'Charmed', slug: 'charmed', desc: "Can't attack the charmer or target them with harmful effects. The charmer has advantage on social checks with you." },
  { name: 'Deafened', slug: 'deafened', desc: "Can't hear and automatically fails any check requiring hearing." },
  { name: 'Frightened', slug: 'frightened', desc: "Disadvantage on checks and attacks while the source of fear is in sight. Can't willingly move closer to the source." },
  { name: 'Grappled', slug: 'grappled', desc: "Speed becomes 0 and can't benefit from bonuses to speed. Ends if the grappler is incapacitated or moved away." },
  { name: 'Incapacitated', slug: 'incapacitated', desc: "Can't take actions or reactions." },
  { name: 'Invisible', slug: 'invisible', desc: "Impossible to see without special sense. Attacks against you have disadvantage; your attacks have advantage." },
  { name: 'Paralyzed', slug: 'paralyzed', desc: "Incapacitated, can't move or speak. Auto-fails STR and DEX saves. Attacks against you have advantage and are auto-crits within 5 ft." },
  { name: 'Petrified', slug: 'petrified', desc: "Turned to stone: incapacitated, unaware, resistance to all damage, immune to poison/disease. Attacks against you have advantage." },
  { name: 'Poisoned', slug: 'poisoned', desc: "Disadvantage on attack rolls and ability checks." },
  { name: 'Prone', slug: 'prone', desc: "Can only crawl. Disadvantage on attacks. Melee attacks against you have advantage; ranged have disadvantage." },
  { name: 'Restrained', slug: 'restrained', desc: "Speed 0. Attacks against you have advantage; your attacks have disadvantage. Disadvantage on DEX saves." },
  { name: 'Stunned', slug: 'stunned', desc: "Incapacitated, can't move, can only falter speech. Auto-fails STR and DEX saves. Attacks against you have advantage." },
  { name: 'Unconscious', slug: 'unconscious', desc: "Incapacitated, can't move or speak, unaware, drops what it holds and falls prone. Auto-fails STR/DEX saves. Attacks have advantage and auto-crit within 5 ft." },
];

// Combat auto-hint chips per condition (display only — no rules enforcement). Keyed by
// slug. Each hint: { icon, label }. Rendered on the condition card so a player sees the
// key mechanical modifiers at a glance without reading the full effect text.
const CONDITION_HINTS = {
  blinded:      [{ icon: '⚔️', label: 'Your attacks: Disadvantage' }, { icon: '🛡️', label: 'Attacks vs you: Advantage' }],
  charmed:      [{ icon: '🚫', label: "Can't harm the charmer" }],
  frightened:   [{ icon: '⚔️', label: 'Attacks & checks: Disadvantage' }],
  grappled:     [{ icon: '👟', label: 'Speed 0' }],
  invisible:    [{ icon: '⚔️', label: 'Your attacks: Advantage' }, { icon: '🛡️', label: 'Attacks vs you: Disadvantage' }],
  paralyzed:    [{ icon: '🛡️', label: 'Attacks vs you: Advantage' }, { icon: '💀', label: 'Auto-crit within 5 ft' }, { icon: '🎲', label: 'Auto-fail STR/DEX saves' }],
  petrified:    [{ icon: '🛡️', label: 'Attacks vs you: Advantage' }, { icon: '🎲', label: 'Auto-fail STR/DEX saves' }],
  poisoned:     [{ icon: '⚔️', label: 'Attacks & checks: Disadvantage' }],
  prone:        [{ icon: '⚔️', label: 'Your attacks: Disadvantage' }, { icon: '🛡️', label: 'Melee vs you: Advantage · Ranged: Disadvantage' }],
  restrained:   [{ icon: '⚔️', label: 'Your attacks: Disadvantage' }, { icon: '🛡️', label: 'Attacks vs you: Advantage' }, { icon: '🎲', label: 'DEX saves: Disadvantage' }],
  stunned:      [{ icon: '🛡️', label: 'Attacks vs you: Advantage' }, { icon: '🎲', label: 'Auto-fail STR/DEX saves' }],
  unconscious:  [{ icon: '🛡️', label: 'Attacks vs you: Advantage' }, { icon: '💀', label: 'Auto-crit within 5 ft' }, { icon: '🎲', label: 'Auto-fail STR/DEX saves' }],
};

// Return the hint chips for a condition by name (case-insensitive), or [] if none.
function conditionHintsFor(name) {
  if (!name) return [];
  const slug = String(name).trim().toLowerCase();
  return CONDITION_HINTS[slug] || [];
}

// Exhaustion has 6 cumulative levels (SRD). Effect shown is the cumulative effect at that level.
const EXHAUSTION_LEVELS = {
  1: 'Disadvantage on ability checks.',
  2: 'Speed halved. (plus level 1)',
  3: 'Disadvantage on attack rolls and saving throws. (plus levels 1-2)',
  4: 'Hit point maximum halved. (plus levels 1-3)',
  5: 'Speed reduced to 0. (plus levels 1-4)',
  6: 'Death. (plus levels 1-5)',
};

function exhaustionLink() { return 'https://open5e.com/conditions/exhaustion'; }

// In-memory conditions model. Each: { id, name, effect, link, turns, color, exhaustionLevel? }
window.conditionsData = window.conditionsData || [];

// ========== CONCENTRATION TRACKER ==========
// Single active concentration: { spellName, castAt } | null. Saved as data.concentration.
window.concentrationData = window.concentrationData || null;

// Begin concentrating on a spell. Casting a new concentration spell replaces the old
// one (5e: you can only concentrate on one at a time). Called from cast paths.
// Returns true if concentration was started.
function startConcentration(spellName) {
  if (!spellName) return false;
  window.concentrationData = { spellName: String(spellName), castAt: Date.now() };
  renderConcentration();
  if (typeof autosave === 'function') autosave();
  return true;
}

// Cast a concentration spell — if already concentrating on a *different* spell, confirm
// the swap first (breaking the old one). Resolves after any prompt. Used by cast buttons.
async function castWithConcentration(spellName) {
  const current = window.concentrationData;
  if (current && current.spellName && current.spellName !== spellName) {
    const ok = typeof appConfirm === 'function'
      ? await appConfirm(`You're concentrating on ${current.spellName}. Casting ${spellName} will end it. Continue?`, { confirmText: 'Switch' })
      : true;
    if (!ok) return false;
  }
  return startConcentration(spellName);
}

function clearConcentration() {
  window.concentrationData = null;
  renderConcentration();
  if (typeof autosave === 'function') autosave();
}

// Render the concentration banner. Hidden entirely when not concentrating.
function renderConcentration() {
  const banner = document.getElementById('concentration_banner');
  if (!banner) return;
  const c = window.concentrationData;
  if (!c || !c.spellName) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s => String(s));
  banner.style.display = 'flex';
  banner.innerHTML = `
    <span class="concentration-icon" aria-hidden="true">🌀</span>
    <span class="concentration-text">Concentrating on <strong>${esc(c.spellName)}</strong></span>
    <button type="button" class="concentration-clear-btn" onclick="clearConcentration()" title="Stop concentrating">Clear</button>
  `;
}

function showConditionPopup() {
  // Reset to picker mode
  const sel = document.getElementById('condition_srd_select');
  if (sel) sel.value = '';
  const toggle = document.getElementById('condition_custom_toggle');
  if (toggle) toggle.checked = false;
  const exhRow = document.getElementById('condition_exhaustion_row');
  if (exhRow) exhRow.style.display = 'none';
  const exhLvl = document.getElementById('condition_exhaustion_level');
  if (exhLvl) exhLvl.value = '1';
  document.getElementById('condition_name').value = '';
  document.getElementById('condition_turns').value = '';
  document.getElementById('condition_effect').value = '';
  document.getElementById('condition_link').value = '';
  document.getElementById('condition_color').value = 'red';
  updateConditionMode();
  showPopup('conditionPopup');
}

// Toggle between SRD picker and custom entry, and show the exhaustion level row when relevant.
function updateConditionMode() {
  const custom = document.getElementById('condition_custom_toggle')?.checked;
  const pickerRow = document.getElementById('condition_picker_row');
  const customFields = document.getElementById('condition_custom_fields');
  if (pickerRow) pickerRow.style.display = custom ? 'none' : 'block';
  if (customFields) customFields.style.display = custom ? 'block' : 'none';

  // Exhaustion level row only shows in picker mode when Exhaustion is selected
  const sel = document.getElementById('condition_srd_select');
  const exhRow = document.getElementById('condition_exhaustion_row');
  if (exhRow) exhRow.style.display = (!custom && sel && sel.value === 'exhaustion') ? 'block' : 'none';
}

function addCondition() {
  const custom = document.getElementById('condition_custom_toggle')?.checked;
  let cond;

  if (custom) {
    const name = document.getElementById('condition_name').value.trim();
    if (!name) { dmToastOrAlert('Please enter a condition name'); return; }
    cond = {
      id: 'cond_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name,
      effect: document.getElementById('condition_effect').value.trim(),
      link: document.getElementById('condition_link').value.trim(),
      turns: document.getElementById('condition_turns').value.trim(),
      color: document.getElementById('condition_color').value,
    };
  } else {
    const slug = document.getElementById('condition_srd_select').value;
    if (!slug) { dmToastOrAlert('Please pick a condition'); return; }
    if (slug === 'exhaustion') {
      const level = parseInt(document.getElementById('condition_exhaustion_level').value) || 1;
      cond = {
        id: 'cond_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: 'Exhaustion',
        exhaustionLevel: level,
        effect: EXHAUSTION_LEVELS[level],
        link: exhaustionLink(),
        turns: '',
        color: 'red',
      };
    } else {
      const src = SRD_CONDITIONS.find(c => c.slug === slug);
      if (!src) { dmToastOrAlert('Unknown condition'); return; }
      cond = {
        id: 'cond_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: src.name,
        effect: src.desc,
        link: 'https://open5e.com/conditions/' + src.slug,
        turns: '',
        color: 'red',
      };
    }
  }

  window.conditionsData.push(cond);
  renderConditions();
  closePopup('conditionPopup');
  autosave();
}

// Thin alias kept for the conditions code; routes through the shared app toast.
function dmToastOrAlert(msg) {
  if (typeof appToast === 'function') appToast(msg, 'error');
  else alert(msg);
}

function removeCondition(id) {
  window.conditionsData = window.conditionsData.filter(c => c.id !== id);
  renderConditions();
  autosave();
}

// Step an exhaustion card's level up or down (1-6). Removing below 1 clears it.
function adjustExhaustion(id, delta) {
  const cond = window.conditionsData.find(c => c.id === id);
  if (!cond || typeof cond.exhaustionLevel !== 'number') return;
  const next = cond.exhaustionLevel + delta;
  if (next < 1) { removeCondition(id); return; }
  cond.exhaustionLevel = Math.min(6, next);
  cond.effect = EXHAUSTION_LEVELS[cond.exhaustionLevel];
  renderConditions();
  autosave();
}

// Render all condition cards from window.conditionsData into the container.
function renderConditions() {
  const container = document.getElementById('conditions_container');
  if (!container) return;
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s => String(s));
  container.innerHTML = window.conditionsData.map(cond => {
    const color = cond.color || 'red';
    const isExh = typeof cond.exhaustionLevel === 'number';
    const titleText = isExh ? `Exhaustion — Level ${cond.exhaustionLevel}` : cond.name;
    const title = cond.link
      ? `<a href="${esc(cond.link)}" target="_blank" rel="noopener noreferrer" class="condition-link">${esc(titleText)}</a>`
      : esc(titleText);
    const turns = cond.turns ? `${esc(cond.turns)} turns` : (isExh ? '' : 'Indefinite');
    const hints = isExh ? [] : conditionHintsFor(cond.name);
    const hintChips = hints.length
      ? `<div class="condition-hints">${hints.map(h =>
          `<span class="condition-hint-chip"><span class="chip-icon" aria-hidden="true">${h.icon}</span>${esc(h.label)}</span>`
        ).join('')}</div>`
      : '';
    const exhControls = isExh
      ? `<div class="condition-exh-controls">
           <button type="button" onclick="adjustExhaustion('${cond.id}', -1)" title="Lower level">−</button>
           <span class="condition-exh-level">Lv ${cond.exhaustionLevel}</span>
           <button type="button" onclick="adjustExhaustion('${cond.id}', 1)" title="Raise level">+</button>
         </div>`
      : '';
    return `
      <div class="condition ${color}" id="${esc(cond.id)}">
        <div class="condition-header">
          <span>${title}</span>
          ${turns ? `<span class="condition-turns">${turns}</span>` : ''}
        </div>
        <div class="condition-effect">${esc(cond.effect)}</div>
        ${hintChips}
        <div class="condition-actions">
          ${exhControls}
          <button type="button" onclick="removeCondition('${cond.id}')" class="condition-remove-btn">Remove</button>
        </div>
      </div>`;
  }).join('');
}

// ========== WEAPON DETAILS ==========
function showWeaponDetails(index) {
  if (index >= 0 && index < weaponsData.length) {
    const weapon = weaponsData[index];
    showItemDetails(weapon, 'weapon');
  }
}

// Show weapon notes
function showWeaponNotes(index) {
  const weapon = weaponsData[index];
  if (weapon) {
    document.getElementById('notesTitle').textContent = `${weapon.name || 'Weapon'} - Notes`;
    document.getElementById('notesContent').innerHTML = `
      <div style="white-space: pre-wrap; line-height: 1.6; color: var(--text);">
        ${weapon.notes || 'No notes available for this weapon.'}
      </div>
    `;
    showPopup('notesPopup');
  }
}

// Show equipment notes
function showEquipmentNotes(id) {
  const equipment = inventoryData.equipment.find(item => item.id === id);
  if (equipment) {
    document.getElementById('notesTitle').textContent = `${equipment.name || 'Equipment'} - Notes`;
    document.getElementById('notesContent').innerHTML = `
      <div style="white-space: pre-wrap; line-height: 1.6; color: var(--text);">
        ${equipment.description || 'No notes available for this equipment.'}
      </div>
    `;
    showPopup('notesPopup');
  }
}

// Global variable to track current notes field being edited
let currentNotesField = null;
let currentNotesElement = null;

// Show notes editor popup
function showNotesPopup(fieldId, title) {
  const textarea = document.getElementById(fieldId);
  if (!textarea) return;
  if (title) {
    textarea.dataset.popupTitle = title;
  }
  textarea.focus();
  scheduleNoteBoxSizing(textarea);
}

// Save notes from editor popup
function saveNotesEditor() {
  const editorTextarea = document.getElementById('notesEditorTextarea');
  const target = currentNotesElement || (currentNotesField ? document.getElementById(currentNotesField) : null);

  if (target && editorTextarea) {
    target.value = editorTextarea.value;
    autosave();
    scheduleNoteBoxSizing(target);
  }

  closeNotesEditorPopup();
}

// ========== ITEM DETAILS ==========
function showItemDetails(item, type) {
  document.getElementById('itemDetailsTitle').textContent = item.name || 'Unnamed Item';
  
  let content = '';
  if (type === 'weapon') {
    content = `
      <div class="item-details-grid">
        <div class="item-details-group">
          <p><strong>To Hit:</strong> ${escapeHtml(item.toHit || '-')}</p>
          <p><strong>Damage:</strong> ${escapeHtml(item.damage || '-')}</p>
        </div>
        <div class="item-details-group">
          <p><strong>Bonus Damage:</strong> ${escapeHtml(item.bonusDamage || '-')}</p>
          <p><strong>Properties:</strong> ${escapeHtml(item.properties || '-')}</p>
        </div>
      </div>
      ${item.notes ? `<div class="item-details-notes">
        <h4>Special Notes:</h4>
        <p>${escapeHtml(item.notes)}</p>
      </div>` : ''}
    `;
  } else if (type === 'equipment') {
    const weightNum = Number(item.weight);
    const weightSafe = Number.isFinite(weightNum) ? weightNum : 0;
    const kg = (weightSafe * 0.453592).toFixed(2);
    content = `
      <div class="item-details-grid">
        <div class="item-details-group">
          <p><strong>Type:</strong> ${escapeHtml(item.type || '-')}</p>
          <p><strong>Bonus:</strong> ${escapeHtml(item.bonus || '-')}</p>
        </div>
        <div class="item-details-group">
          <p><strong>Weight:</strong> ${escapeHtml(String(weightSafe))} lbs (${escapeHtml(kg)} kg)</p>
        </div>
      </div>
      ${item.notes ? `<div class="item-details-notes">
        <h4>Notes:</h4>
        <p>${escapeHtml(item.notes)}</p>
      </div>` : ''}
    `;
  } else if (type === 'inventory') {
    const weightNum = Number(item.weight);
    const weightSafe = Number.isFinite(weightNum) ? weightNum : 0;
    const kg = (weightSafe * 0.453592).toFixed(2);
    content = `
      <div class="item-details-group">
        <p><strong>Weight:</strong> ${escapeHtml(String(weightSafe))} lbs (${escapeHtml(kg)} kg)</p>
      </div>
      ${item.description ? `<div class="item-details-notes">
        <h4>Description:</h4>
        <p>${escapeHtml(item.description)}</p>
      </div>` : ''}
      ${item.notes ? `<div class="item-details-notes">
        <h4>Notes:</h4>
        <p>${escapeHtml(item.notes)}</p>
      </div>` : ''}
    `;
  }
  
  document.getElementById('itemDetailsContent').innerHTML = content;
  showPopup('itemDetailsPopup');
}

// ========== PURCHASE HISTORY ==========
function displayPurchaseHistory() {
  const container = document.getElementById('purchase_history_list');
  if (!container) return;

  const history = inventoryData.purchaseHistory || [];
  if (history.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7;">No purchases recorded yet. Use the + button on a stackable item to record a purchase.</p>`;
    return;
  }

  const rows = history.map(entry => {
    const costText = entry.purchased && entry.totalCost > 0
      ? `${entry.totalCost.toFixed(2).replace(/\.00$/, '')} ${entry.currency}`
      : '—';
    const sourceText = entry.purchased ? 'Purchased' : 'Found / Given';
    return `
      <div class="purchase-history-row">
        <span class="ph-date">${escapeHtml(entry.date)}</span>
        <span class="ph-item">${escapeHtml(entry.itemName)}</span>
        <span class="ph-qty">+${entry.qtyAdded}</span>
        <span class="ph-source ${entry.purchased ? 'ph-purchased' : 'ph-found'}">${sourceText}</span>
        <span class="ph-cost">${costText}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = rows;
}

function clearPurchaseHistory() {
  appConfirm('Clear all purchase history? This cannot be undone.', { confirmText: 'Clear' }).then(ok => {
    if (!ok) return;
    inventoryData.purchaseHistory = [];
    saveInventory();
    displayPurchaseHistory();
    autosave();
  });
}

// ========== ROUND RESET BUTTON ==========
function resetRoundActions() {
  document.getElementById('action_tick').checked = false;
  document.getElementById('bonus_action_tick').checked = false;
  autosave();
  appToast('Action counters reset for new round!', 'success');
}


// Settings dropdown functionality
function setSettingsModalLock(locked) {
  document.body.classList.toggle('settings-open', locked);
  document.documentElement.classList.toggle('settings-open', locked);
}

function handlePortraitUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const portraitPreview = document.getElementById('portraitPreview');
    portraitPreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '12px';
    portraitPreview.appendChild(img);
    autosave();
  };
  reader.readAsDataURL(file);
}

function removePortrait() {
  const portraitPreview = document.getElementById('portraitPreview');
  portraitPreview.innerHTML = '<span style="color: #666;">No image</span>';
  document.getElementById('portraitUpload').value = '';
  autosave();
}

// Settings dropdown — delegated from document since settingsBtn is in async-loaded chrome.html
document.addEventListener('click', function(e) {
  if (e.target.closest('#settingsBtn')) {
    e.stopPropagation();
    const dropdown = document.getElementById('settingsDropdown');
    if (!dropdown) return;
    const shouldOpen = dropdown.style.display === 'none';
    dropdown.style.display = shouldOpen ? 'block' : 'none';
    setSettingsModalLock(shouldOpen);
  } else if (!e.target.closest('#settingsDropdown')) {
    const dropdown = document.getElementById('settingsDropdown');
    if (dropdown) dropdown.style.display = 'none';
    setSettingsModalLock(false);
  }
});

function displayStorageContainers() {
  if (!inventoryData.storageContainers) return;
  inventoryData.storageContainers.forEach(storage => {
    displayStorageItems(storage.id);
    updateContainerWeight(storage.id);
  });
}

