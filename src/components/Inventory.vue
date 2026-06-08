<template>
  <div v-if="isOpen" class="inventory-overlay" @click="closeContextMenu">
    <div class="inventory-container" @click.stop>
      <h2 class="inv-title">ИНВЕНТАРЬ</h2>
      
      <div class="inv-layout">
        <!-- Экипировка -->
        <div class="equipment-panel">
          <h3>Экипировка</h3>
          <div class="equip-slot" :class="{ 'has-item': equipment.weapon }"
               @contextmenu.prevent="openContextMenu($event, { type: 'equip', equipSlot: 'weapon', item: equipment.weapon })">
            <span v-if="equipment.weapon" class="item-icon">{{ getItem(equipment.weapon.itemId).icon }}</span>
            <span v-else class="slot-label">🔫 Оружие</span>
          </div>
          
          <div class="equip-slot" :class="{ 'has-item': equipment.armor }"
               @contextmenu.prevent="openContextMenu($event, { type: 'equip', equipSlot: 'armor', item: equipment.armor })">
            <span v-if="equipment.armor" class="item-icon">{{ getItem(equipment.armor.itemId).icon }}</span>
            <span v-else class="slot-label">🦺 Броня</span>
          </div>

          <div class="stats-panel" v-if="equipment.weapon || equipment.armor">
            <p v-if="equipment.weapon">⚔️ Урон: {{ getItem(equipment.weapon.itemId).damage }}</p>
            <p v-if="equipment.armor">🛡️ Защита: {{ getItem(equipment.armor.itemId).defense }}</p>
          </div>
        </div>

        <!-- Сетка 10x10 -->
        <div class="grid-panel">
          <h3>Рюкзак</h3>
          <div class="inventory-grid">
            <div v-for="(row, y) in grid" :key="y" class="grid-row">
              <div v-for="(cell, x) in row" :key="x" class="grid-cell" :class="{ 'has-item': cell }"
                   @contextmenu.prevent="openContextMenu($event, { type: 'grid', gridX: x, gridY: y, item: cell })">
                <span v-if="cell" class="item-icon">{{ getItem(cell.itemId).icon }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p class="inv-hint">ПКМ по предмету для действий | [I] или [TAB] чтобы закрыть</p>
    </div>

    <!-- Контекстное меню -->
    <div v-if="contextMenu.visible" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">
      <template v-if="contextMenu.target?.type === 'grid'">
        <button v-if="getItem(contextMenu.target.item.itemId).type !== 'consumable'" @click="handleAction('equip')">Экипировать</button>
        <button v-if="getItem(contextMenu.target.item.itemId).type === 'consumable'" @click="handleAction('use')">Использовать</button>
        <button @click="handleAction('drop')" class="danger">Выкинуть</button>
      </template>
      <template v-else-if="contextMenu.target?.type === 'equip'">
        <button @click="handleAction('drop')" class="danger">Снять</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Принимем функцию для лечения, чтобы не мутировать пропсы напрямую (это вызывает красные ошибки в Vue)
const emit = defineEmits(['heal'])

const ITEMS = {
  pistol: { id: 'pistol', name: 'Старый пistолет', type: 'weapon', damage: 10, speed: 1.0, icon: '🔫' },
  blaster: { id: 'blaster', name: 'Плазменный бластер', type: 'weapon', damage: 25, speed: 1.8, icon: '🛸' },
  light_armor: { id: 'light_armor', name: 'Кевларовый жилет', type: 'armor', defense: 5, icon: '🦺' },
  heavy_armor: { id: 'heavy_armor', name: 'Тяжелая броня', type: 'armor', defense: 15, icon: '🛡️' },
  medkit: { id: 'medkit', name: 'Аптечка', type: 'consumable', heal: 40, icon: '❤️' }
}

const isOpen = ref(false)
const grid = ref(Array(10).fill(null).map(() => Array(10).fill(null)))
const equipment = ref({ weapon: null, armor: null })
const contextMenu = ref({ visible: false, x: 0, y: 0, target: null })

function toggle() {
  isOpen.value = !isOpen.value
  closeContextMenu()
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function openContextMenu(e, target) {
  e.preventDefault()
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, target }
}

function addItemToGrid(itemId) {
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (!grid.value[y][x]) {
        grid.value[y][x] = { itemId, count: 1 }
        return true
      }
    }
  }
  return false
}

function handleAction(action) {
  const target = contextMenu.value.target
  if (!target) return

  if (action === 'drop') {
    if (target.type === 'grid') {
      grid.value[target.gridY][target.gridX] = null
    } else if (target.type === 'equip') {
      equipment.value[target.equipSlot] = null
    }
  } 
  else if (action === 'equip' && target.type === 'grid') {
    const item = ITEMS[target.item.itemId]
    if (item.type === 'consumable') return
    
    const slot = item.type
    const oldEquipped = equipment.value[slot]
    
    if (oldEquipped) {
      addItemToGrid(oldEquipped.itemId)
    }
    
    equipment.value[slot] = { itemId: item.id, count: 1 }
    grid.value[target.gridY][target.gridX] = null
  } 
  else if (action === 'use' && target.type === 'grid') {
    const item = ITEMS[target.item.itemId]
    if (item.type === 'consumable' && item.heal) {
      emit('heal', item.heal) // Безопасно передаем запрос на лечение в App.vue
      grid.value[target.gridY][target.gridX] = null
    }
  }
  closeContextMenu()
}

function cheatGiveItem(itemId) {
  addItemToGrid(itemId)
}

function getWeaponStats() {
  const w = equipment.value.weapon ? ITEMS[equipment.value.weapon.itemId] : ITEMS.pistol
  return { damage: w.damage, speed: w.speed }
}

function getArmorDefense() {
  const a = equipment.value.armor ? ITEMS[equipment.value.armor.itemId] : null
  return a ? a.defense : 0
}

function getItem(itemId) {
  return ITEMS[itemId]
}

// Делаем методы и данные доступными для App.vue через ref
defineExpose({
  isOpen,
  grid,
  equipment,
  contextMenu,
  toggle,
  closeContextMenu,
  handleAction,
  cheatGiveItem,
  getWeaponStats,
  getArmorDefense
})
</script>

<style scoped>
.inventory-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px); }
.inventory-container { background: #1e2738; border: 2px solid #3a86ff; border-radius: 12px; padding: 24px; min-width: 600px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
.inv-title { color: white; text-align: center; margin: 0 0 20px 0; font-family: sans-serif; letter-spacing: 2px; }
.inv-layout { display: flex; gap: 40px; }
.equipment-panel, .grid-panel { display: flex; flex-direction: column; }
.equipment-panel h3, .grid-panel h3 { color: #8899aa; font-family: sans-serif; font-size: 14px; text-transform: uppercase; margin: 0 0 12px 0; }
.equip-slot { width: 64px; height: 64px; background: #151c28; border: 2px solid #2a3b55; border-radius: 8px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
.equip-slot.has-item { border-color: #3a86ff; background: #1e3a5f; }
.equip-slot:hover { border-color: #5dade2; transform: scale(1.05); }
.slot-label { font-size: 24px; opacity: 0.3; }
.item-icon { font-size: 32px; }
.stats-panel { margin-top: 20px; padding: 12px; background: #151c28; border-radius: 8px; color: #ccc; font-family: sans-serif; font-size: 14px; }
.stats-panel p { margin: 4px 0; }
.inventory-grid { display: flex; flex-direction: column; gap: 4px; }
.grid-row { display: flex; gap: 4px; }
.grid-cell { width: 48px; height: 48px; background: #151c28; border: 1px solid #2a3b55; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
.grid-cell.has-item { background: #1e3a5f; border-color: #3a86ff; }
.grid-cell:hover { border-color: #5dade2; background: #244773; }
.inv-hint { color: #556677; font-family: sans-serif; font-size: 12px; text-align: center; margin-top: 20px; }
.context-menu { position: fixed; background: #2c3e50; border: 1px solid #3a86ff; border-radius: 6px; padding: 4px 0; min-width: 140px; box-shadow: 0 8px 20px rgba(0,0,0,0.6); z-index: 1001; display: flex; flex-direction: column; }
.context-menu button { background: transparent; border: none; color: white; padding: 10px 16px; text-align: left; cursor: pointer; font-family: sans-serif; font-size: 14px; transition: background 0.15s; }
.context-menu button:hover { background: #3a86ff; }
.context-menu button.danger { color: #ff6b6b; }
.context-menu button.danger:hover { background: #c0392b; color: white; }
</style>