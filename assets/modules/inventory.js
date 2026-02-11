// ========== INVENTORY SYSTEM ==========
let inventoryData = {
  equipment: [],
  mainInventory: [],
  storageContainers: [],
  maxWeightCapacity: 0
};

// Initialize inventory system
function initializeInventory() {
  loadInventory();
  displayEquipment();
  displayEquipmentStats();
  displayMainInventory();
  loadStorageContainers();
  updateWeightDisplay();
  
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
  
  // Add event delegation for stats page weapons buttons
  const weaponsStatsContainer = document.getElementById('weapons_stats_list');
  if (weaponsStatsContainer) {
    weaponsStatsContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('weapon-btn')) {
        const weaponIndex = e.target.getAttribute('data-weapon-index');
        const action = e.target.getAttribute('data-action');
        
        if (action === 'notes') {
          showWeaponNotes(weaponIndex);
        } else if (action === 'edit') {
          showWeaponsPopup();
        } else if (action === 'delete') {
          if (confirm('Are you sure you want to delete this weapon?')) {
            weaponsData.splice(weaponIndex, 1);
            displayWeaponsStats();
            updateWeaponsPreview();
            autosave();
          }
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
        
        <div class="inventory-controls">
          <button onclick="showItemForm('${storage.id}')">+ Add Item</button>
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
  console.log('Save equipment called');
  
  const name = document.getElementById('equipment_name').value.trim();
  const type = document.getElementById('equipment_type').value;
  const bonus = document.getElementById('equipment_bonus').value.trim();
  const weight = parseFloat(document.getElementById('equipment_weight').value) || 0;
  const description = document.getElementById('equipment_description').value.trim();
  const editId = document.getElementById('saveEquipmentBtn').getAttribute('data-edit-id');
  
  console.log('Form data:', { name, type, bonus, weight, description, editId });
  
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
    console.log('Editing existing equipment with ID:', editId);
    const existingEquipment = inventoryData.equipment.find(e => e.id === editId);
    if (existingEquipment) {
      console.log('Found existing equipment:', existingEquipment);
      Object.assign(existingEquipment, equipmentData);
      console.log('Updated equipment:', existingEquipment);
    } else {
      console.log('Existing equipment not found!');
    }
  } else {
    // Adding new equipment
    console.log('Adding new equipment');
    inventoryData.equipment.push(equipmentData);
    console.log('Equipment added. New array:', inventoryData.equipment);
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
  console.log('Displaying equipment:', data); // Debug log
  
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

// Create weapon card
function createWeaponCard(weapon, index) {
  const card = document.createElement('div');
  card.className = 'weapon-card';
  
  card.innerHTML = `
    <div class="weapon-info">
      <h4>${weapon.name || 'Unnamed Weapon'}</h4>
      <div class="weapon-stats">
        <span class="weapon-stat"><strong>To Hit:</strong> ${weapon.toHit || 'N/A'}</span>
        <span class="weapon-stat"><strong>Damage:</strong> ${weapon.damage || 'N/A'}</span>
        <span class="weapon-stat"><strong>Bonus:</strong> ${weapon.bonusDamage || 'N/A'}</span>
        <span class="weapon-stat"><strong>Properties:</strong> ${weapon.properties || 'N/A'}</span>
      </div>
    </div>
    <div class="weapon-actions">
      <button class="weapon-btn notes-btn" data-weapon-index="${index}" data-action="notes">Notes</button>
      <button class="weapon-btn edit-btn" data-weapon-index="${index}" data-action="edit">Edit</button>
      <button class="weapon-btn delete-btn" data-weapon-index="${index}" data-action="delete">Delete</button>
    </div>
  `;
  
  return card;
}

// Create equipment card
function createEquipmentCard(equipment) {
  const card = document.createElement('div');
  card.className = 'equipment-card';
  card.innerHTML = `
    <div class="equipment-header">
      <h4 class="equipment-name">${equipment.name}</h4>
      <span class="equipment-type">${equipment.type}</span>
    </div>
    <div class="equipment-stats">
      ${equipment.bonus ? `<div class="equipment-stat"><span class="equipment-stat-label">Bonus/AC:</span><span class="equipment-stat-value">${equipment.bonus}</span></div>` : ''}
      <div class="equipment-stat"><span class="equipment-stat-label">Weight:</span><span class="equipment-stat-value">${equipment.weight} lbs</span></div>
    </div>
    ${equipment.description ? `<div class="equipment-description">${equipment.description}</div>` : ''}
    <div class="equipment-actions">
      <button class="equipment-btn notes-btn" data-equipment-id="${equipment.id}" data-action="notes">Notes</button>
      <button class="equipment-btn edit-btn" data-equipment-id="${equipment.id}" data-action="edit">Edit</button>
      <button class="equipment-btn delete-btn" data-equipment-id="${equipment.id}" data-action="delete">Delete</button>
    </div>
  `;
  return card;
}

// Edit equipment
function editEquipment(id) {
  console.log('Edit equipment called with ID:', id);
  console.log('Current equipment data:', inventoryData.equipment);
  
  const equipment = inventoryData.equipment.find(e => e.id === id);
  console.log('Found equipment:', equipment);
  
  if (equipment) {
    console.log('Populating form with equipment data:', equipment);
    
    document.getElementById('equipmentFormTitle').textContent = 'Edit Equipment';
    document.getElementById('equipment_name').value = equipment.name || '';
    document.getElementById('equipment_type').value = equipment.type || 'weapon';
    document.getElementById('equipment_bonus').value = equipment.bonus || '';
    document.getElementById('equipment_weight').value = equipment.weight || '';
    document.getElementById('equipment_description').value = equipment.description || '';
    document.getElementById('saveEquipmentBtn').textContent = 'Update Equipment';
    document.getElementById('saveEquipmentBtn').setAttribute('data-edit-id', id);
    
    console.log('Form populated, showing popup');
    console.log('About to show equipmentFormPopup');
    showPopup('equipmentFormPopup');
    console.log('Popup call completed');
    
    // Verify form values after popup is shown
    setTimeout(() => {
      console.log('Form values after popup:');
      console.log('Name:', document.getElementById('equipment_name').value);
      console.log('Type:', document.getElementById('equipment_type').value);
      console.log('Bonus:', document.getElementById('equipment_bonus').value);
      console.log('Weight:', document.getElementById('equipment_weight').value);
      console.log('Description:', document.getElementById('equipment_description').value);
      
      // Check which popups are visible
      const formPopup = document.getElementById('equipmentFormPopup');
      const tablePopup = document.getElementById('equipmentPopup');
      console.log('Form popup display:', formPopup.style.display);
      console.log('Table popup display:', tablePopup.style.display);
      console.log('Form popup visible:', formPopup.offsetParent !== null);
      console.log('Table popup visible:', tablePopup.offsetParent !== null);
    }, 200);
  } else {
    console.log('Equipment not found with ID:', id);
  }
}

// Delete equipment
function deleteEquipment(id) {
  console.log('Delete equipment called with ID:', id);
  console.log('Current equipment data:', inventoryData.equipment);
  
  if (confirm('Are you sure you want to delete this equipment?')) {
    const index = inventoryData.equipment.findIndex(e => e.id === id);
    console.log('Found equipment at index:', index);
    
    if (index > -1) {
      inventoryData.equipment.splice(index, 1);
      console.log('Equipment removed. New data:', inventoryData.equipment);
      
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
      
      console.log('Equipment deletion completed');
    } else {
      console.log('Equipment not found with ID:', id);
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
  document.getElementById('saveItemBtn').textContent = 'Add Item';
  document.getElementById('saveItemBtn').setAttribute('data-container', container);
  document.getElementById('saveItemBtn').removeAttribute('data-edit-id');
  showPopup('itemFormPopup');
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
  
  if (!name) {
    alert('Please enter a name for the item.');
    return;
  }
  
  const itemData = {
    id: editId || Date.now().toString(),
    name: name,
    type: type,
    weight: weight,
    description: description
  };
  
  // Check weight limits
  if (container === 'main') {
    const currentWeight = calculateMainInventoryWeight();
    const maxWeight = inventoryData.maxWeightCapacity;
    if (maxWeight > 0 && currentWeight + weight > maxWeight) {
      document.getElementById('weightWarningMessage').textContent = 'Sorry, that item won\'t fit into your main inventory.';
      showPopup('weightWarningPopup');
      return;
    }
  } else {
    // Check storage container weight
    const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
    if (storageContainer) {
      const currentWeight = calculateStorageWeight(container);
      if (storageContainer.maxWeight > 0 && currentWeight + weight > storageContainer.maxWeight) {
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
  card.innerHTML = `
    <div class="item-header">
      <h4 class="item-name">${item.name}</h4>
      <span class="item-type">${item.type}</span>
    </div>
    <div class="item-stats">
      <div class="item-stat"><span class="item-stat-label">Weight:</span><span class="item-stat-value">${item.weight} lbs</span></div>
    </div>
    ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
    <div class="item-actions">
      <button class="item-btn edit-btn" onclick="editItem('${item.id}', '${container}')">✏️</button>
      <button class="item-btn delete-btn" onclick="deleteItem('${item.id}', '${container}')">🗑️</button>
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
    document.getElementById('item_description').value = item.description;
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
  
  const container = document.getElementById(`storage_${storageId}_items`);
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

// Calculate main inventory weight (includes equipment + items)
function calculateMainInventoryWeight() {
  const equipmentWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const itemsWeight = inventoryData.mainInventory.reduce((total, item) => total + (item.weight || 0), 0);
  return equipmentWeight + itemsWeight;
}

// Calculate storage weight
function calculateStorageWeight(storageId) {
  const storage = inventoryData.storageContainers.find(s => s.id === storageId);
  if (!storage) return 0;
  return storage.items.reduce((total, item) => total + (item.weight || 0), 0);
}

// Update weight display
function updateWeightDisplay() {
  updateEquipmentWeightDisplay();
  updateMainInventoryWeightDisplay();
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
  const itemsWeight = inventoryData.mainInventory.reduce((total, item) => total + (item.weight || 0), 0);
  const totalWeight = equipmentWeight + itemsWeight;
  const totalWeightKg = (totalWeight * 0.453592).toFixed(2);
  const maxWeight = inventoryData.maxWeightCapacity;
  const weightDisplay = document.getElementById('main_inventory_weight_total');
  
  if (maxWeight > 0) {
    const weightStatus = totalWeight > maxWeight ? 'weight-warning' : 'weight-ok';
    weightDisplay.className = `weight-display ${weightStatus}`;
    weightDisplay.innerHTML = `
      <div>Total: ${totalWeight}/${maxWeight} lbs / ${totalWeightKg} kg</div>
      <div style="font-size: 0.8em; opacity: 0.8; margin-top: 5px;">
        Equipment: ${equipmentWeight} lbs | Items: ${itemsWeight} lbs
      </div>
    `;
  } else {
    weightDisplay.className = 'weight-display weight-ok';
    weightDisplay.innerHTML = `
      <div>Total: ${totalWeight} lbs / ${totalWeightKg} kg</div>
      <div style="font-size: 0.8em; opacity: 0.8; margin-top: 5px;">
        Equipment: ${equipmentWeight} lbs | Items: ${itemsWeight} lbs
      </div>
    `;
  }
}

// Update storage weight displays
function updateStorageWeightDisplays() {
  if (!inventoryData.storageContainers) return;
  
  inventoryData.storageContainers.forEach(storage => {
    const currentWeight = calculateStorageWeight(storage.id);
    const totalWeightKg = (currentWeight * 0.453592).toFixed(2);
    const weightStatus = storage.maxWeight > 0 && currentWeight > storage.maxWeight ? 'weight-warning' : 'weight-ok';
    
    // Update the weight display for this container
    const weightDisplay = document.getElementById(`${storage.id}_weight`);
    if (weightDisplay) {
      weightDisplay.className = `weight-display ${weightStatus}`;
      if (storage.maxWeight > 0) {
        weightDisplay.textContent = `Total: ${currentWeight}/${storage.maxWeight} lbs / ${totalWeightKg} kg`;
      } else {
        weightDisplay.textContent = `Total: ${currentWeight} lbs / ${totalWeightKg} kg`;
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
  const saved = localStorage.getItem('dndInventory');
  if (saved) {
    const loadedData = JSON.parse(saved);
    // Merge with existing inventoryData to preserve character-specific data
    inventoryData = {
      equipment: loadedData.equipment || [],
      mainInventory: loadedData.mainInventory || [],
      storageContainers: loadedData.storageContainers || [],
      maxWeightCapacity: loadedData.maxWeightCapacity || 0
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
  const conditionHTML = `
    <div class="condition ${color}" id="condition_${conditionId}">
      <div class="condition-header">
        <span>${name}</span>
        <span class="condition-turns">${turns ? turns + ' turns' : 'Indefinite'}</span>
      </div>
      <div>${effect}</div>
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
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <p><strong>To Hit:</strong> ${item.toHit || '-'}</p>
          <p><strong>Damage:</strong> ${item.damage || '-'}</p>
        </div>
        <div>
          <p><strong>Bonus Damage:</strong> ${item.bonusDamage || '-'}</p>
          <p><strong>Properties:</strong> ${item.properties || '-'}</p>
        </div>
      </div>
      ${item.notes ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Special Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.notes}</p>
      </div>` : ''}
    `;
  } else if (type === 'equipment') {
    content = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <p><strong>Type:</strong> ${item.type || '-'}</p>
          <p><strong>Bonus:</strong> ${item.bonus || '-'}</p>
        </div>
        <div>
          <p><strong>Weight:</strong> ${item.weight || 0} lbs (${(item.weight * 0.453592).toFixed(2)} kg)</p>
        </div>
      </div>
      ${item.notes ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.notes}</p>
      </div>` : ''}
    `;
  } else if (type === 'inventory') {
    content = `
      <div style="margin-bottom: 15px;">
        <p><strong>Weight:</strong> ${item.weight || 0} lbs (${(item.weight * 0.453592).toFixed(2)} kg)</p>
      </div>
      ${item.description ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Description:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.description}</p>
      </div>` : ''}
      ${item.notes ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.notes}</p>
      </div>` : ''}
    `;
  }
  
  document.getElementById('itemDetailsContent').innerHTML = content;
  showPopup('itemDetailsPopup');
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
document.getElementById('settingsBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('settingsDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

// Close dropdown when clicking elsewhere
document.addEventListener('click', function(e) {
  if (!e.target.closest('#settingsDropdown') && !e.target.closest('#settingsBtn')) {
    document.getElementById('settingsDropdown').style.display = 'none';
  }
});

