<template>
  <div class="game-container">
    <canvas ref="canvasRef" tabindex="0" @contextmenu.prevent></canvas>
    <div class="ui-hp">HP: {{ player.hp }} / {{ player.maxHp }}</div>
    
    <!-- Подсказки -->
    <div v-if="isNearDoor(player.x, player.y)" class="door-hint">
      {{ getExit()?.isLocked ? 'Нажмите [E] чтобы взломать дверь' : 'Нажмите [E] чтобы войти' }}
    </div>
    <div v-if="nearbyChest" class="chest-hint">Нажмите [E] чтобы взломать сундук</div>

    <button class="fullscreen-btn" @click="toggleFullscreen">{{ isFullscreen ? '⊗' : '⛶' }}</button>
    
    <div v-if="gameState !== 'playing'" class="end-screen">
      <h1 :class="gameState === 'victory' ? 'text-victory' : 'text-gameover'">
        {{ gameState === 'victory' ? 'ПОБЕДА!' : 'GAME OVER' }}
      </h1>
      <p class="end-message">{{ gameState === 'victory' ? 'Все враги уничтожены.' : 'Вы пали в бою.' }}</p>
      <button class="restart-btn" @click="restartGame">Начать заново</button>
    </div>

    <Inventory ref="invRef" @heal="(amount) => player.hp = Math.min(player.maxHp, player.hp + amount)" />
    <ChestUI :is-open="isChestOpen" :chest="activeChest" :on-unlock="onChestUnlock" :on-take-item="onChestTakeItem" :on-close="closeChest" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useGameState } from './composables/useGameState'
import { usePlayer } from './composables/usePlayer'
import { useProjectiles } from './composables/useProjectiles'
import { useEnemies } from './composables/useEnemies'
import { useWorld } from './composables/useWorld'
import { useRenderer } from './composables/useRenderer'
import Inventory from './components/Inventory.vue'
import ChestUI from './components/ChestUI.vue'

const canvasRef = ref(null)
const invRef = ref(null)
const isFullscreen = ref(false)
let animationId = null, lastFrameTime = 0, mouseRightHeld = false

const MOVE_KEYS = new Set(['w','s','a','d','arrowup','arrowdown','arrowleft','arrowright'])

const { gameState, setVictory, setGameOver, resetGameState } = useGameState()
const { initWorld, attemptDoorTransition, getCurrentGrid, getExit, getChests, getChestAt, unlockChest,
  isPositionValid, isEnemyRoom, isNearDoor, currentLocationId, WALL_HEIGHT, FLOOR_THICKNESS, FLOOR_DROP, MAP_SIZE } = useWorld()

const { player, updateMovement, setTarget, takeDamage, resetPosition, resetHealth, getPosition, setKey } = usePlayer(0, 0)
const { projectiles, hitMarkers, addProjectile, addHitMarker, updateProjectiles, updateHitMarkers, clearAll } = useProjectiles()
const { enemies, updateEnemies, damageEnemyAt, resetEnemies, getEnemies } = useEnemies(getCurrentGrid, getPosition, addProjectile)
const { initRenderer, resizeCanvas, updateCamera, render, getScreenSize } = useRenderer(
  canvasRef, getCurrentGrid, getPosition, getEnemies, () => projectiles.value, () => hitMarkers.value, getExit, getChests, 
  { WALL_HEIGHT, FLOOR_THICKNESS, FLOOR_DROP, MAP_SIZE }
)

const activeChest = ref(null)
const isChestOpen = ref(false)

// Вычисляем, стоит ли игрок рядом с сундуком, для отображения подсказки
const nearbyChest = computed(() => {
  const pos = getPosition()
  return getChestAt(pos.x, pos.y)
})

function checkWalkable(x, y) {
  const g = getCurrentGrid(); return g ? g.isWalkable(g.toTile(x,y).col, g.toTile(x,y).row) : false
}

function onLocationTransition(id, pos, g) {
  resetPosition(pos.x, pos.y); setTarget(null, null); clearAll()
  if (isEnemyRoom(pos.x, pos.y)) {
    const t = g.toTile(pos.x, pos.y); resetEnemies(Math.round(t.col), Math.round(t.row), performance.now()/1000)
  } else enemies.value = []
  updateCamera(player.value.x, player.value.y)
}

function restartGame() {
  resetGameState(); resetHealth(); clearAll()
  const { startGrid, startPos } = initWorld()
  resetPosition(startPos.x, startPos.y)
  if (isEnemyRoom(startPos.x, startPos.y)) {
    const t = startGrid.toTile(startPos.x, startPos.y)
    resetEnemies(Math.round(t.col), Math.round(t.row), performance.now()/1000)
  } else enemies.value = []
  updateCamera(player.value.x, player.value.y)
}

function getWorldCoords(e) {
  const c = canvasRef.value, r = c.getBoundingClientRect()
  return { x: (e.clientX - r.left) + player.value.x - window.innerWidth/2, y: (e.clientY - r.top) + player.value.y - window.innerHeight/2 }
}

function handleKey(e, isDown) {
  const rawKey = e.key
  const k = rawKey.toLowerCase()

  if ((k === 'i' || k === 'tab') && isDown) { e.preventDefault(); invRef.value?.toggle(); return }
  if (k === 'g' && isDown) { invRef.value?.cheatGiveItem('blaster'); invRef.value?.cheatGiveItem('heavy_armor'); invRef.value?.cheatGiveItem('medkit') }
  
  if ((k === 'e' || k === 'у' || k === 'u') && isDown && gameState.value === 'playing') {
    e.preventDefault()
    const pos = getPosition()
    const chest = getChestAt(pos.x, pos.y)
    
    if (chest) {
      if (chest.isJammed) {
        // Можно добавить всплывающее сообщение, но пока просто игнорируем
        return 
      }
      activeChest.value = chest
      isChestOpen.value = true
      return
    }
    
    const exit = getExit()
    if (exit && isNearDoor(pos.x, pos.y)) {
      if (exit.isLocked) {
        activeChest.value = { ...exit, id: `door_${currentLocationId.value}` }
        isChestOpen.value = true
      } else {
        attemptDoorTransition(pos.x, pos.y, onLocationTransition)
      }
    }
}

  // ИСПРАВЛЕНИЕ УПРАВЛЕНИЯ: маппинг стрелок обратно в правильный регистр для usePlayer
  if (MOVE_KEYS.has(k)) {
    e.preventDefault()
    const mappedKey = k === 'arrowup' ? 'ArrowUp' :
                      k === 'arrowdown' ? 'ArrowDown' :
                      k === 'arrowleft' ? 'ArrowLeft' :
                      k === 'arrowright' ? 'ArrowRight' : k
    setKey(mappedKey, isDown)
  }
}

function onMouseDown(e) {
  if (gameState.value !== 'playing' || (invRef.value?.isOpen) || isChestOpen.value) return
  const {x, y} = getWorldCoords(e), w = invRef.value?.getWeaponStats() || {damage: 10, speed: 1.0}
  if (e.button === 2) { e.preventDefault(); mouseRightHeld = true; if(isPositionValid(x, y)) setTarget(x, y) }
  else if (e.button === 0) addProjectile(player.value.x, player.value.y, x, y, false, w.damage, w.speed)
}
function onMouseMove(e) { if(mouseRightHeld && gameState.value === 'playing') { const p = getWorldCoords(e); if(isPositionValid(p.x, p.y)) setTarget(p.x, p.y) } }
function onMouseUp(e) { if(e.button === 2) mouseRightHeld = false }

function toggleFullscreen() {
  if(!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(console.log); isFullscreen.value = true }
  else { document.exitFullscreen(); isFullscreen.value = false }
}
function onFullscreenChange() { isFullscreen.value = !!document.fullscreenElement; setTimeout(()=>{resizeCanvas(); updateCamera(player.value.x, player.value.y)}, 100) }

function animate(now) {
  const dt = Math.min(0.033, (now - lastFrameTime) / 1000); lastFrameTime = now
  if(dt > 0 && gameState.value === 'playing') {
    const g = getCurrentGrid()
    if(g) { 
      updateMovement(dt, isPositionValid)
      updateEnemies(dt, now/1000)
      updateProjectiles(dt, checkWalkable, onPlayerHit, onEnemyHit, {value: enemies.value}, () => g)
      updateHitMarkers(dt)
      updateCamera(player.value.x, player.value.y) 
    }
  }
  render(player.value.x, player.value.y, player.value.hp, player.value.maxHp)
  animationId = requestAnimationFrame(animate)
}

function onPlayerHit(dmg) { return takeDamage(Math.max(1, dmg - (invRef.value?.getArmorDefense() || 0))) }
function onEnemyHit(x, y, dmg, force = false) { const h = damageEnemyAt(x, y, dmg, () => getEnemies().length === 0 && setVictory(), force); if(h) addHitMarker(x, y); return h }
function onChestUnlock() { if(!activeChest.value) return; activeChest.value.id.startsWith('door_') ? (getExit().isLocked = false) : unlockChest(activeChest.value.id) }
function onChestTakeItem(i) { if(activeChest.value?.loot?.[i]) { invRef.value?.cheatGiveItem(activeChest.value.loot[i].itemId); activeChest.value.loot.splice(i, 1) } }
function closeChest() { isChestOpen.value = false; activeChest.value = null }

onMounted(() => {
  restartGame(); initRenderer(); resizeCanvas(); updateCamera(player.value.x, player.value.y)
  window.addEventListener('resize', ()=>{resizeCanvas(); updateCamera(player.value.x, player.value.y)})
  window.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', e => handleKey(e, true))
  window.addEventListener('keyup', e => handleKey(e, false))
  const c = canvasRef.value
  c.addEventListener('mousemove', onMouseMove); c.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp)
  c.focus(); lastFrameTime = performance.now(); animate(lastFrameTime)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', e => handleKey(e, true))
  window.removeEventListener('keyup', e => handleKey(e, false))
  const c = canvasRef.value
  if(c) { c.removeEventListener('mousemove', onMouseMove); c.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp) }
})
</script>

<style scoped>
.game-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; margin: 0; padding: 0; }
canvas { display: block; width: 100%; height: 100%; outline: none; background: #16213e; cursor: crosshair; }
.ui-hp { position: absolute; top: 20px; left: 20px; color: white; font-family: sans-serif; font-size: clamp(16px, 2vw, 24px); font-weight: bold; text-shadow: 2px 2px 4px #000; pointer-events: none; z-index: 10; }
.door-hint, .chest-hint { position: absolute; bottom: 15%; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.8); color: #ffd700; padding: 12px 24px; border-radius: 8px; font-family: sans-serif; font-size: clamp(16px, 2vw, 20px); font-weight: bold; border: 2px solid #ffd700; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); animation: pulse 1.5s infinite ease-in-out; pointer-events: none; z-index: 20; }
@keyframes pulse { 0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.9; } 50% { transform: translateX(-50%) scale(1.05); opacity: 1; } }
.fullscreen-btn { position: absolute; top: 20px; right: 20px; width: clamp(40px, 5vw, 60px); height: clamp(40px, 5vw, 60px); font-size: clamp(20px, 2.5vw, 30px); background: rgba(0, 0, 0, 0.5); color: white; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; cursor: pointer; transition: all 0.2s ease; z-index: 10; display: flex; align-items: center; justify-content: center; }
.fullscreen-btn:hover { background: rgba(58, 134, 255, 0.7); border-color: #3a86ff; transform: scale(1.1); }
.end-screen { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.75); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
.end-screen h1 { font-size: clamp(48px, 8vw, 96px); font-family: sans-serif; font-weight: 900; margin: 0 0 10px 0; text-shadow: 0 4px 15px rgba(0, 0, 0, 0.6); letter-spacing: 2px; }
.text-victory { color: #2ecc71; } .text-gameover { color: #e74c3c; }
.end-message { color: #ccc; font-family: sans-serif; margin-bottom: 30px; font-size: clamp(16px, 2vw, 22px); }
.restart-btn { margin-top: 20px; padding: clamp(12px, 2vw, 20px) clamp(32px, 5vw, 60px); font-size: clamp(18px, 2.5vw, 26px); font-weight: bold; font-family: sans-serif; color: white; background: #3a86ff; border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 6px 20px rgba(58, 134, 255, 0.4); }
.restart-btn:hover { background: #2563eb; transform: translateY(-2px) scale(1.05); box-shadow: 0 8px 25px rgba(58, 134, 255, 0.6); }
.restart-btn:active { transform: translateY(1px) scale(0.98); }
</style>