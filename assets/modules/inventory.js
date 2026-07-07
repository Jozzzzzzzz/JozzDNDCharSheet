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
          if (confirm('Are you sure you want to delete this weapon?')) {
            weaponsData.splice(weaponIndex, 1);
            displayWeaponsStats();
            updateWeaponsPreview();
            autosave();
          }
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
    alert('Please enter a name for the equipment.');
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
  
  if (confirm('Are you sure you want to delete this equipment?')) {
    const index = inventoryData.equipment.findIndex(e => e.id === id);
    
    if (index > -1) {
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
      
    } else {
    }
  }
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
    alert('Form error: Missing required elements. Please refresh the page and try again.');
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
    alert('Please enter a name for the item.');
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
  if (confirm('Are you sure you want to delete this item?')) {
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
  }
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

  if (qty <= 0) { alert('Please enter a quantity greater than 0.'); return; }

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
      alert(`Not enough ${currency.toUpperCase()} to purchase ${qty}× ${item.name}. You need ${totalCost.toFixed(2)} ${currency}.`);
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
function showConditionPopup() {
  document.getElementById('condition_name').value = '';
  document.getElementById('condition_turns').value = '';
  document.getElementById('condition_effect').value = '';
  document.getElementById('condition_color').value = 'red';
  showPopup('conditionPopup');
}

function addCondition() {
  const name = document.getElementById('condition_name').value;
  const turns = document.getElementById('condition_turns').value;
  const effect = document.getElementById('condition_effect').value;
  const color = document.getElementById('condition_color').value;
  
  if (!name) {
    alert("Please enter a condition name");
    return;
  }
  
  const conditionId = Date.now();
  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s => String(s));
  const conditionHTML = `
    <div class="condition ${color}" id="condition_${conditionId}">
      <div class="condition-header">
        <span>${esc(name)}</span>
        <span class="condition-turns">${turns ? esc(turns) + ' turns' : 'Indefinite'}</span>
      </div>
      <div>${esc(effect)}</div>
      <button onclick="removeCondition('${conditionId}')" style="float:right; padding:2px 5px; margin-top:5px;">Remove</button>
    </div>
  `;
  
  document.getElementById('conditions_container').insertAdjacentHTML('beforeend', conditionHTML);
  closePopup('conditionPopup');
  autosave();
}

function removeCondition(id) {
  document.getElementById(`condition_${id}`).remove();
  autosave();
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
  if (!confirm('Clear all purchase history? This cannot be undone.')) return;
  inventoryData.purchaseHistory = [];
  saveInventory();
  displayPurchaseHistory();
  autosave();
}

// ========== ROUND RESET BUTTON ==========
function resetRoundActions() {
  document.getElementById('action_tick').checked = false;
  document.getElementById('bonus_action_tick').checked = false;
  autosave();
  alert("Action counters reset for new round!");
}


// ========== LAYOUT SYSTEM ==========
const LayoutManager = {
  STORAGE_KEY: 'dndSheetLayout_final',
  initialized: false,
  
  init() {
    if (this.initialized) return;
    this.initialized = true;
    
    window.addEventListener('load', () => {
      this.ensureElementIds();
      
      // Set up save button
      const saveBtn = document.getElementById('saveLayoutBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.save();
        });
      }
      
      // Set up reset button
      const resetBtn = document.getElementById('resetLayoutBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.reset();
        });
      }
      
      this.load();
    });
  },
  
  ensureElementIds() {
    document.querySelectorAll('.section:not([id])').forEach((el, i) => {
      el.id = `section-${i+1}`;
    });
    
    document.querySelectorAll('textarea:not([id])').forEach((el, i) => {
      el.id = `textarea-${i+1}`;
    });
  },
  
  save() {
    try {
      const layout = {
        version: 'final',
        timestamp: new Date().toISOString(),
        sections: {},
        textareas: {}
      };

      document.querySelectorAll('.section').forEach(section => {
        if (section.offsetParent) {
          layout.sections[section.id] = {
            width: section.style.width || `${section.offsetWidth}px`,
            height: section.style.height || `${section.offsetHeight}px`,
            position: window.getComputedStyle(section).position
          };
        }
      });

      document.querySelectorAll('textarea').forEach(textarea => {
        if (textarea.offsetParent) {
          layout.textareas[textarea.id] = {
            width: textarea.style.width || `${textarea.offsetWidth}px`,
            height: textarea.style.height || `${textarea.offsetHeight}px`
          };
        }
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layout));
      alert('Layout saved successfully!');
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      alert('Save error: ' + e.message);
      return false;
    }
  },
  
  load() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return false;

      const layout = JSON.parse(data);

      Object.entries(layout.sections || {}).forEach(([id, style]) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.width = style.width;
          el.style.height = style.height;
          if (style.position) el.style.position = style.position;
        }
      });

      Object.entries(layout.textareas || {}).forEach(([id, style]) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.width = style.width;
          el.style.height = style.height;
        }
      });

      return true;
    } catch (e) {
      console.error('Load failed:', e);
      return false;
    }
  },
  
  reset() {
    if (confirm('Are you sure you want to reset ALL layout settings to default?')) {
      // Reset sections
      document.querySelectorAll('.section').forEach(section => {
        section.style.width = '';
        section.style.height = '';
        section.style.position = '';
        section.style.left = '';
        section.style.top = '';
      });
      
      // Reset textareas
      document.querySelectorAll('textarea').forEach(textarea => {
        textarea.style.width = '';
        textarea.style.height = '';
      });
      
      // Clear storage
      localStorage.removeItem(this.STORAGE_KEY);
      alert('Layout has been reset to default settings');
    }
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  LayoutManager.init();
});

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

