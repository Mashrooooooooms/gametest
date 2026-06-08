<template>
  <div v-if="isOpen" class="chest-overlay" @click="close">
    <div class="chest-container" @click.stop>
      
      <!-- Экран блокировки при истечении времени -->
      <div v-if="isJammed" class="jammed-interface">
        <h2 class="jammed-title">⚠ СИСТЕМА ЗАБЛОКИРОВАНА ⚠</h2>
        <p class="jammed-text">Превышено время ожидания. Протокол защиты активирован.<br>Попытка взлома аннулирована.</p>
      </div>

      <!-- Фаза взлома -->
      <div v-else-if="phase === 'hacking' && chest" class="hacking-phase">
        <HackGame 
          :key="chest.id" 
          :type="chest.hackType || 'medium'" 
          :target-id="chest.id?.split('_').pop() || '00'" 
          @success="onHackSuccess" 
          @fail="onHackFail" 
        />
      </div>

      <!-- Фаза лута -->
      <div v-else-if="phase === 'loot'" class="loot-interface">
        <h2 class="loot-title">СУНДУК ВЗЛОМАН</h2>
        <div class="loot-grid">
          <div v-for="(cell, i) in lootGrid" :key="i" class="loot-cell" :class="{'has-item':cell}" @click="takeItem(i)">
            <span v-if="cell" class="item-icon">{{ getItem(cell.itemId).icon }}</span>
            <span v-if="cell" class="item-name">{{ getItem(cell.itemId).name }}</span>
          </div>
        </div>
        <p class="loot-hint">Кликни по предмету, чтобы забрать</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import HackGame from './HackGame.vue'

const ITEMS = {
  pistol: { id:'pistol', name:'Старый пистолет', type:'weapon', damage:10, speed:1.0, icon:'🔫' },
  blaster: { id:'blaster', name:'Плазменный бластер', type:'weapon', damage:25, speed:1.8, icon:'🛸' },
  light_armor: { id:'light_armor', name:'Кевларовый жилет', type:'armor', defense:5, icon:'🦺' },
  heavy_armor: { id:'heavy_armor', name:'Тяжелая броня', type:'armor', defense:15, icon:'🛡️' },
  medkit: { id:'medkit', name:'Аптечка', type:'consumable', heal:40, icon:'❤️' }
}

const props = defineProps({ isOpen: Boolean, chest: Object, onTakeItem: Function, onUnlock: Function, onClose: Function })
const phase = ref('hacking')
const isJammed = ref(false) // Новое состояние: сундук заблокирован

watch(() => [props.isOpen, props.chest], ([open, c]) => {
  if (open && c) {
    isJammed.value = false // Сбрасываем при новом открытии (если это новый сундук)
    phase.value = c.isLocked ? 'hacking' : 'loot'
  } else if (!open) {
    phase.value = 'hacking'
    isJammed.value = false
  }
}, { immediate: true })

function onHackSuccess() { 
  props.onUnlock?.()
  setTimeout(() => phase.value = 'loot', 1500) 
}

function onHackFail() { 
  isJammed.value = true
  // Через 2.5 секунды автоматически закрываем интерфейс, чтобы игрок вернулся в игру
  setTimeout(() => {
    props.onClose?.()
  }, 2500)
}

function takeItem(i) { props.onTakeItem?.(i) }
function close() { props.onClose?.() }
function getItem(id) { return ITEMS[id] || { name:'?', icon:'❓' } }
const lootGrid = computed(() => { const g=Array(4).fill(null); props.chest?.loot?.forEach((x,i)=>{if(i<4)g[i]=x}); return g })
</script>

<style scoped>
.chest-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(10px); }
.chest-container { display: flex; flex-direction: column; align-items: center; }
.hacking-phase { display: flex; justify-content: center; }

/* Стили для экрана блокировки */
.jammed-interface { 
  background: #1a0505; border: 2px solid #ff0000; border-radius: 4px; 
  padding: 60px 40px; text-align: center; width: 500px; 
  box-shadow: 0 0 40px rgba(255, 0, 0, 0.3);
  animation: pulse-red-bg 1s infinite;
}
@keyframes pulse-red-bg { 0%, 100% { box-shadow: 0 0 40px rgba(255, 0, 0, 0.3); } 50% { box-shadow: 0 0 60px rgba(255, 0, 0, 0.6); } }
.jammed-title { color: #ff0000; font-family: 'Courier New', monospace; font-size: 28px; margin: 0 0 20px 0; letter-spacing: 2px; }
.jammed-text { color: #ff6666; font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.5; }

.loot-interface { background: #0d0d0d; border: 1px solid #333; border-radius: 4px; padding: 40px; text-align: center; width: 500px; }
.loot-title { color: #ffd700; font-family: sans-serif; margin: 0 0 30px 0; font-size: 24px; }
.loot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.loot-cell { background: #1a1a1a; border: 2px solid #333; border-radius: 8px; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
.loot-cell.has-item { border-color: #ffd700; background: #2a2510; }
.loot-cell.has-item:hover { transform: translateY(-3px); background: #3a3515; }
.item-icon { font-size: 40px; margin-bottom: 8px; }
.item-name { font-size: 14px; color: #ccc; font-family: sans-serif; }
.loot-hint { color: #666; font-size: 12px; font-family: sans-serif; }
</style>