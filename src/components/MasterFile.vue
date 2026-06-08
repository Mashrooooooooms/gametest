<template>
  <div class="game-container">
    <canvas ref="canvasRef" tabindex="0" @contextmenu.prevent></canvas>
    
    <!-- UI Здоровья -->
    <div class="ui-hp">
      HP: {{ player.hp }} / {{ player.maxHp }}
    </div>

    <!-- Кнопка полного экрана -->
    <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'">
      {{ isFullscreen ? '⊗' : '⛶' }}
    </button>

    <!-- ЭКРАН ПОБЕДЫ / ПОРАЖЕНИЯ -->
    <div v-if="gameState !== 'playing'" class="end-screen">
      <h1 :class="gameState === 'victory' ? 'text-victory' : 'text-gameover'">
        {{ gameState === 'victory' ? 'ПОБЕДА!' : 'GAME OVER' }}
      </h1>
      <p class="end-message">
        {{ gameState === 'victory' ? 'Все враги уничтожены.' : 'Вы пали в бою.' }}
      </p>
      <button class="restart-btn" @click="restartGame">Начать заново</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { GridEngine } from '../game/GridEngine.js'

const canvasRef = ref(null)
let ctx = null
let grid = null
let animationId = null

// 🎯 СОСТОЯНИЕ ИГРЫ
const gameState = ref('playing')
const isFullscreen = ref(false)

// ---- Загрузка спрайтов ----
const playerImg = new Image()
const enemyImg = new Image()
playerImg.src = '/src/assets/04 zx 1 5.png'
enemyImg.src = '/src/assets/04 zx 1 5.png'
playerImg.onerror = () => { playerImg._fallback = true }
enemyImg.onerror = () => { enemyImg._fallback = true }

// ---- Состояние игры ----
const player = ref({
  x: 0, y: 0,
  hp: 10, maxHp: 10
})
let targetX = null, targetY = null
const PLAYER_SPEED = 320

const enemies = ref([])
const projectiles = ref([])
const hitMarkers = ref([])

let camera = { x: 0, y: 0 }
let screenWidth = 0, screenHeight = 0
let dpr = window.devicePixelRatio || 1

// 🎯 НАСТРОЙКИ ВЫСОТЫ
const WALL_HEIGHT = 70          
const FLOOR_THICKNESS = 8       
const FLOOR_DROP = 24           

// ---- Проверка проходимости ----
function isPositionValid(x, y, radius = 20) {
  const offsets = [
    { dx: 0, dy: 0 }, { dx: radius, dy: 0 }, { dx: -radius, dy: 0 },
    { dx: 0, dy: radius }, { dx: 0, dy: -radius },
    { dx: radius*0.7, dy: radius*0.7 }, { dx: -radius*0.7, dy: radius*0.7 }
  ]
  for (let off of offsets) {
    const tile = grid.toTile(x + off.dx, y + off.dy)
    if (!grid.isWalkable(tile.col, tile.row)) return false
  }
  return true
}

// ---- Проверка коллизии врагов ----
function isEnemyCollision(col, row, excludeEnemy = null) {
  for (let enemy of enemies.value) {
    if (enemy === excludeEnemy) continue
    const eCol = Math.round(enemy.col)
    const eRow = Math.round(enemy.row)
    if (Math.abs(eCol - col) < 0.8 && Math.abs(eRow - row) < 0.8) return true
  }
  return false
}

// ---- Инициализация врагов ----
function initEnemies() {
  const newEnemies = []
  const startCol = Math.floor(grid.width / 2)
  const startRow = Math.floor(grid.height / 2)
  const currentTime = performance.now() / 1000

  for (let i = 0; i < 6; i++) {
    let col, row, safe
    let attempts = 0
    do {
      col = Math.floor(Math.random() * (grid.width - 6)) + 3
      row = Math.floor(Math.random() * (grid.height - 6)) + 3
      safe = grid.isWalkable(col, row) && Math.hypot(col - startCol, row - startRow) >= 10
      for (let e of newEnemies) {
        if (Math.abs(e.col - col) < 2 && Math.abs(e.row - row) < 2) safe = false
      }
      attempts++
    } while (!safe && attempts < 200)
    
    newEnemies.push({
      col, row,
      hp: 3, maxHp: 3,
      lastShotTime: 0,
      actionCooldown: 0,
      awakeTime: currentTime + 2.5
    })
  }
  enemies.value = newEnemies
}

// ---- ФУНКЦИЯ ПЕРЕЗАПУСКА ----
function restartGame() {
  gameState.value = 'playing'
  player.value.hp = player.value.maxHp
  
  const centerCol = Math.floor(grid.width / 2)
  const centerRow = Math.floor(grid.height / 2)
  const startPos = grid.toScreen(centerCol, centerRow)
  player.value.x = startPos.x
  player.value.y = startPos.y
  targetX = null
  targetY = null

  projectiles.value = []
  hitMarkers.value = []
  
  initEnemies()
  updateCamera()
}

// ---- 🎯 ПОЛНОЭКРАННЫЙ РЕЖИМ ----
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(err => {
      console.log(`Ошибка полноэкранного режима: ${err.message}`)
    })
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    })
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  setTimeout(resizeCanvas, 100)
}

// ---- Камера ----
function updateCamera() {
  camera.x = player.value.x - screenWidth / 2
  camera.y = player.value.y - screenHeight / 2
}

// ---- Отрисовка ----
function drawTile(col, row) {
  const { x, y } = grid.toScreen(col, row)
  let screenX = x - camera.x
  let screenY = y - camera.y
  
  const hw = grid.tileWidth / 2
  const hh = grid.tileHeight / 2
  
  if (screenX + hw < -100 || screenX - hw > screenWidth + 100 ||
      screenY + grid.tileHeight + WALL_HEIGHT < -100 || screenY - hh > screenHeight + 100) return

  const isWall = !grid.isWalkable(col, row)
  
  if (!isWall) {
    screenY += FLOOR_DROP
  }

  const thickness = isWall ? WALL_HEIGHT : FLOOR_THICKNESS

  const top = { x: screenX, y: screenY }
  const right = { x: screenX + hw, y: screenY + hh }
  const bottom = { x: screenX, y: screenY + grid.tileHeight }
  const left = { x: screenX - hw, y: screenY + hh }

  ctx.beginPath()
  ctx.moveTo(left.x, left.y)
  ctx.lineTo(bottom.x, bottom.y)
  ctx.lineTo(bottom.x, bottom.y + thickness)
  ctx.lineTo(left.x, left.y + thickness)
  ctx.closePath()
  ctx.fillStyle = isWall ? '#4a2b2b' : '#151520'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(bottom.x, bottom.y)
  ctx.lineTo(right.x, right.y)
  ctx.lineTo(right.x, right.y + thickness)
  ctx.lineTo(bottom.x, bottom.y + thickness)
  ctx.closePath()
  ctx.fillStyle = isWall ? '#6d4242' : '#252535'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(top.x, top.y)
  ctx.lineTo(right.x, right.y)
  ctx.lineTo(bottom.x, bottom.y)
  ctx.lineTo(left.x, left.y)
  ctx.closePath()
  ctx.fillStyle = isWall ? '#9e6b6b' : '#35354a'
  ctx.fill()

  if (isWall) {
    const halfThickness = thickness / 2
    ctx.beginPath()
    ctx.moveTo(left.x, left.y + halfThickness)
    ctx.lineTo(bottom.x, bottom.y + halfThickness)
    ctx.lineTo(right.x, right.y + halfThickness)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(top.x, top.y)
  ctx.lineTo(right.x, right.y)
  ctx.lineTo(right.x, right.y + thickness)
  ctx.lineTo(bottom.x, bottom.y + thickness)
  ctx.lineTo(left.x, left.y + thickness)
  ctx.lineTo(left.x, left.y)
  ctx.closePath()
  ctx.strokeStyle = isWall ? '#2a1515' : '#0a0a15'
  ctx.lineWidth = isWall ? 2 : 1
  ctx.stroke()
}

function drawSpriteAt(worldX, worldY, img, isPlayer = false, yOffset = 0) {
  const screenX = worldX - camera.x
  const screenY = worldY - camera.y + yOffset
  const size = grid.tileHeight * 1.2
  if (img.complete && !img._fallback) {
    ctx.drawImage(img, screenX - size/2, screenY - size, size, size)
  } else {
    ctx.beginPath()
    ctx.arc(screenX, screenY - size/2, size/2, 0, Math.PI*2)
    ctx.fillStyle = isPlayer ? '#3a86ff' : '#e63946'
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  if (isPlayer) {
    ctx.beginPath()
    ctx.arc(screenX, screenY - size/2, size*0.6, 0, Math.PI*2)
    ctx.fillStyle = 'rgba(255,80,80,0.2)'
    ctx.fill()
  }
}

function drawHealthBar(worldX, worldY, current, max, width = 40, yOffset = 0) {
  const screenX = worldX - camera.x
  const screenY = worldY - camera.y + yOffset - 28
  const percent = current / max
  ctx.fillStyle = '#111'
  ctx.fillRect(screenX - width/2 - 1, screenY - 1, width + 2, 8)
  ctx.fillStyle = percent > 0.5 ? '#2ecc71' : (percent > 0.25 ? '#f1c40f' : '#e74c3c')
  ctx.fillRect(screenX - width/2, screenY, width * percent, 6)
}

function drawEnemy(e) {
  const pos = grid.toScreen(e.col, e.row)
  drawSpriteAt(pos.x, pos.y, enemyImg, false, FLOOR_DROP)
  drawHealthBar(pos.x, pos.y, e.hp, e.maxHp, 40, FLOOR_DROP)
}

function drawProjectile(p) {
  const x = p.fromX + (p.toX - p.fromX) * p.progress - camera.x
  const y = p.fromY + (p.toY - p.fromY) * p.progress - camera.y
  ctx.beginPath()
  ctx.arc(x, y, 5, 0, Math.PI*2)
  ctx.fillStyle = p.isEnemy ? '#ff6666' : '#ffaa44'
  ctx.shadowColor = p.isEnemy ? '#ff6666' : '#ffaa44'
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawHitMarker(m) {
  const alpha = Math.max(0, m.life)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.moveTo(m.x - camera.x - 10, m.y - camera.y - 10)
  ctx.lineTo(m.x - camera.x + 10, m.y - camera.y + 10)
  ctx.moveTo(m.x - camera.x + 10, m.y - camera.y - 10)
  ctx.lineTo(m.x - camera.x - 10, m.y - camera.y + 10)
  ctx.lineWidth = 3
  ctx.strokeStyle = '#ff4444'
  ctx.stroke()
  ctx.restore()
}

function render() {
  if (!ctx) return
  ctx.clearRect(0, 0, screenWidth, screenHeight)
  
  const renderList = []
  
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      renderList.push({ type: 'tile', col, row, depth: col + row })
    }
  }
  
  enemies.value.forEach(e => {
    renderList.push({ type: 'enemy', obj: e, depth: Math.round(e.col) + Math.round(e.row) })
  })
  
  const pTile = grid.toTile(player.value.x, player.value.y)
  renderList.push({ type: 'player', depth: Math.round(pTile.col) + Math.round(pTile.row) })

  renderList.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    const isTileA = a.type === 'tile' ? 0 : 1
    const isTileB = b.type === 'tile' ? 0 : 1
    return isTileA - isTileB
  })

  renderList.forEach(item => {
    if (item.type === 'tile') {
      drawTile(item.col, item.row)
    } else if (item.type === 'enemy') {
      drawEnemy(item.obj)
    } else if (item.type === 'player') {
      drawSpriteAt(player.value.x, player.value.y, playerImg, true, FLOOR_DROP)
      drawHealthBar(player.value.x, player.value.y, player.value.hp, player.value.maxHp, 40, FLOOR_DROP)
    }
  })

  projectiles.value.forEach(p => drawProjectile(p))
  hitMarkers.value.forEach(m => drawHitMarker(m))
}

// ---- Движение игрока ----
function updatePlayerMovement(deltaTime) {
  if (targetX === null || targetY === null) return
  const dx = targetX - player.value.x
  const dy = targetY - player.value.y
  const dist = Math.hypot(dx, dy)
  if (dist < 2) {
    player.value.x = targetX
    player.value.y = targetY
    targetX = targetY = null
    return
  }
  const step = Math.min(PLAYER_SPEED * deltaTime, dist)
  const newX = player.value.x + dx / dist * step
  const newY = player.value.y + dy / dist * step
  if (isPositionValid(newX, newY)) {
    player.value.x = newX
    player.value.y = newY
  } else {
    targetX = targetY = null
  }
  updateCamera()
}

// ---- ИНТЕЛЛЕКТ ВРАГОВ ----
function updateEnemies(deltaTime, nowSec) {
  const MOVE_SPEED = 3.2
  const MAX_SHOOT_DIST = 9.0
  const MIN_DIST = 2.8
  const BASE_SHOOT_DELAY = 1.1 

  const playerTile = grid.toTile(player.value.x, player.value.y)
  const playerCol = Math.round(playerTile.col)
  const playerRow = Math.round(playerTile.row)

  for (let enemy of enemies.value) {
    if (nowSec < enemy.awakeTime) continue;

    const currentCol = Math.round(enemy.col)
    const currentRow = Math.round(enemy.row)
    const distToPlayer = Math.hypot(currentCol - playerCol, currentRow - playerRow)
    const hasLos = grid.hasLineOfSight(currentCol, currentRow, playerCol, playerRow)

    const canAct = nowSec >= enemy.actionCooldown

    if (hasLos && distToPlayer <= MAX_SHOOT_DIST && canAct) {
      const randomDelay = BASE_SHOOT_DELAY + Math.random() * 0.4
      
      if (!enemy.lastShotTime || (nowSec - enemy.lastShotTime) >= randomDelay) {
        enemy.lastShotTime = nowSec
        enemy.actionCooldown = nowSec + 0.6 

        const fromPos = grid.toScreen(currentCol, currentRow)
        const accuracyPenalty = distToPlayer * 12 
        const spreadX = (Math.random() - 0.5) * (30 + accuracyPenalty)
        const spreadY = (Math.random() - 0.5) * (30 + accuracyPenalty)

        projectiles.value.push({
          fromX: fromPos.x, fromY: fromPos.y,
          toX: player.value.x + spreadX,
          toY: player.value.y + spreadY,
          progress: 0,
          isEnemy: true,
          damage: 1
        })
      }
    }

    let needToMove = false
    let targetCol = currentCol
    let targetRow = currentRow

    if (canAct && (!hasLos || distToPlayer > MAX_SHOOT_DIST || distToPlayer < MIN_DIST)) {
      if (distToPlayer > MAX_SHOOT_DIST || !hasLos) {
        const path = grid.findPath(currentCol, currentRow, playerCol, playerRow)
        if (path && path.length > 1) {
          targetCol = path[1].col
          targetRow = path[1].row
          needToMove = true
        }
      }
      else if (distToPlayer < MIN_DIST) {
        let best = null
        let bestDist = -1
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dc === 0 && dr === 0) continue
            const nc = currentCol + dc
            const nr = currentRow + dr
            if (nc >= 0 && nc < grid.width && nr >= 0 && nr < grid.height && grid.isWalkable(nc, nr)) {
              const newDist = Math.hypot(nc - playerCol, nr - playerRow)
              if (!isEnemyCollision(nc, nr, enemy) && newDist > distToPlayer && newDist > bestDist) {
                bestDist = newDist
                best = { col: nc, row: nr }
              }
            }
          }
        }
        if (best) {
          targetCol = best.col
          targetRow = best.row
          needToMove = true
        }
      }
    }

    if (needToMove) {
      const dx = targetCol - enemy.col
      const dy = targetRow - enemy.row
      const len = Math.hypot(dx, dy)
      if (len > 0.01) {
        const step = MOVE_SPEED * deltaTime
        let newCol = enemy.col + dx / len * step
        let newRow = enemy.row + dy / len * step
        if (Math.hypot(newCol - enemy.col, newRow - enemy.row) > len) {
          newCol = targetCol
          newRow = targetRow
        }
        if (!isEnemyCollision(newCol, newRow, enemy)) {
          enemy.col = newCol
          enemy.row = newRow
        }
      }
    }
  }
}

// ---- Снаряды ----
function updateProjectiles(deltaTime) {
  const SPEED = 900
  for (let i = 0; i < projectiles.value.length; i++) {
    const p = projectiles.value[i]
    const dx = p.toX - p.fromX
    const dy = p.toY - p.fromY
    const totalDist = Math.hypot(dx, dy)
    if (totalDist < 0.01) {
      projectiles.value.splice(i, 1)
      i--
      continue
    }
    const step = SPEED * deltaTime
    p.progress += step / totalDist
    if (p.progress >= 1) {
      const hitX = p.toX
      const hitY = p.toY
      if (p.isEnemy) {
        player.value.hp = Math.max(0, player.value.hp - p.damage)
        hitMarkers.value.push({ x: hitX, y: hitY, life: 1.0 })
        
        if (player.value.hp <= 0) {
          gameState.value = 'gameover'
        }
      } else {
        let closest = null
        let closestDist = 50
        for (let enemy of enemies.value) {
          const enemyWorld = grid.toScreen(Math.round(enemy.col), Math.round(enemy.row))
          const d = Math.hypot(hitX - enemyWorld.x, hitY - enemyWorld.y)
          if (d < closestDist) {
            closestDist = d
            closest = enemy
          }
        }
        if (closest) {
          closest.hp -= p.damage
          hitMarkers.value.push({ x: hitX, y: hitY, life: 1.0 })
          if (closest.hp <= 0) {
            const idx = enemies.value.indexOf(closest)
            if (idx !== -1) enemies.value.splice(idx, 1)
          }
        }
      }
      projectiles.value.splice(i, 1)
      i--
    } else {
      const tx = p.fromX + dx * p.progress
      const ty = p.fromY + dy * p.progress
      const tile = grid.toTile(tx, ty)
      if (!grid.isWalkable(tile.col, tile.row)) {
        projectiles.value.splice(i, 1)
        i--
      }
    }
  }
}

function updateHitMarkers(deltaTime) {
  for (let i = 0; i < hitMarkers.value.length; i++) {
    hitMarkers.value[i].life -= deltaTime * 4
    if (hitMarkers.value[i].life <= 0) {
      hitMarkers.value.splice(i, 1)
      i--
    }
  }
}

function shootAtCursor(worldX, worldY) {
  projectiles.value.push({
    fromX: player.value.x, fromY: player.value.y,
    toX: worldX, toY: worldY,
    progress: 0,
    isEnemy: false,
    damage: 1
  })
}

// ---- Управление мышью ----
function getWorldCoordsFromScreen(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  const scaleX = canvasRef.value.width / rect.width
  const scaleY = canvasRef.value.height / rect.height
  const screenX = (e.clientX - rect.left) * scaleX
  const screenY = (e.clientY - rect.top) * scaleY
  return { x: screenX + camera.x, y: screenY + camera.y }
}

let mouseRightHeld = false

function onMouseMove(e) {
  if (mouseRightHeld) {
    const { x, y } = getWorldCoordsFromScreen(e)
    if (isPositionValid(x, y)) {
      targetX = x
      targetY = y
    }
  }
}

function onMouseDown(e) {
  if (gameState.value !== 'playing') return
  
  if (e.button === 2) {
    mouseRightHeld = true
    e.preventDefault()
    const { x, y } = getWorldCoordsFromScreen(e)
    if (isPositionValid(x, y)) {
      targetX = x
      targetY = y
    }
  } else if (e.button === 0) {
    const { x, y } = getWorldCoordsFromScreen(e)
    shootAtCursor(x, y)
  }
}

function onMouseUp(e) {
  if (e.button === 2) mouseRightHeld = false
}

// ---- Инициализация карты ----
function initGame() {
  grid = new GridEngine(28, 28)
  grid.initEmptyMap()

  const centerCol = Math.floor(grid.width / 2)
  const centerRow = Math.floor(grid.height / 2)
  
  const numWalls = 9
  for (let i = 0; i < numWalls; i++) {
    let placed = false
    let attempts = 0
    while (!placed && attempts < 50) {
      attempts++
      const isHorizontal = Math.random() > 0.5
      const length = Math.floor(Math.random() * 4) + 3 
      
      const maxCol = isHorizontal ? grid.width - length : grid.width
      const maxRow = isHorizontal ? grid.height : grid.height - length

      const startCol = Math.floor(Math.random() * (maxCol - 4)) + 2
      const startRow = Math.floor(Math.random() * (maxRow - 4)) + 2

      const midCol = startCol + (isHorizontal ? length / 2 : 0)
      const midRow = startRow + (isHorizontal ? 0 : length / 2)
      if (Math.hypot(midCol - centerCol, midRow - centerRow) < 5) continue

      let canPlace = true
      for (let j = 0; j < length; j++) {
        const c = isHorizontal ? startCol + j : startCol
        const r = isHorizontal ? startRow : startRow + j
        if (!grid.isWalkable(c, r)) {
          canPlace = false
          break
        }
      }

      if (canPlace) {
        for (let j = 0; j < length; j++) {
          const c = isHorizontal ? startCol + j : startCol
          const r = isHorizontal ? startRow : startRow + j
          grid.setWall(c, r)
        }
        placed = true
      }
    }
  }

  const startPos = grid.toScreen(centerCol, centerRow)
  player.value.x = startPos.x
  player.value.y = startPos.y
  initEnemies()
  updateCamera()
}

// ---- 🎯 АДАПТИВНЫЙ РЕСАЙЗ ----
function resizeCanvas() {
  const canvas = canvasRef.value
  dpr = window.devicePixelRatio || 1
  
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  
  ctx.scale(dpr, dpr)
  
  screenWidth = window.innerWidth
  screenHeight = window.innerHeight
  
  updateCamera()
  render()
}

let lastFrameTime = 0
function animate(nowMs) {
  const delta = Math.min(0.033, (nowMs - lastFrameTime) / 1000)
  
  if (delta > 0 && grid && gameState.value === 'playing') {
    updatePlayerMovement(delta)
    updateEnemies(delta, nowMs / 1000)
    updateProjectiles(delta)
    updateHitMarkers(delta)
    
    if (enemies.value.length === 0) {
      gameState.value = 'victory'
    }
  }
  
  render()
  lastFrameTime = nowMs
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  const canvas = canvasRef.value
  ctx = canvas.getContext('2d')
  initGame()
  resizeCanvas()
  
  // 👇 Алерт для проверки
  alert('Компонент игры загружен и работает!')
  
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('fullscreenchange', onFullscreenChange)
  
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  
  canvas.focus()
  lastFrameTime = performance.now()
  animate(lastFrameTime)
})
onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('fullscreenchange', onFullscreenChange)
  
  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mouseup', onMouseUp)
  }
})
</script>

<style scoped>
.game-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
  background: #16213e;
  cursor: crosshair;
}

.ui-hp {
  position: absolute;
  top: 20px;
  left: 20px;
  color: white;
  font-family: sans-serif;
  font-size: clamp(16px, 2vw, 24px);
  font-weight: bold;
  text-shadow: 2px 2px 4px #000;
  pointer-events: none;
  z-index: 10;
}

.fullscreen-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: clamp(40px, 5vw, 60px);
  height: clamp(40px, 5vw, 60px);
  font-size: clamp(20px, 2.5vw, 30px);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-btn:hover {
  background: rgba(58, 134, 255, 0.7);
  border-color: #3a86ff;
  transform: scale(1.1);
}

.end-screen {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.end-screen h1 {
  font-size: clamp(48px, 8vw, 96px);
  font-family: sans-serif;
  font-weight: 900;
  margin: 0 0 10px 0;
  text-shadow: 0 4px 15px rgba(0,0,0,0.6);
  letter-spacing: 2px;
}

.text-victory {
  color: #2ecc71;
}

.text-gameover {
  color: #e74c3c;
}

.end-message {
  color: #ccc;
  font-family: sans-serif;
  margin-bottom: 30px;
  font-size: clamp(16px, 2vw, 22px);
}

.restart-btn {
  margin-top: 20px;
  padding: clamp(12px, 2vw, 20px) clamp(32px, 5vw, 60px);
  font-size: clamp(18px, 2.5vw, 26px);
  font-weight: bold;
  font-family: sans-serif;
  color: white;
  background: #3a86ff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 6px 20px rgba(58, 134, 255, 0.4);
}

.restart-btn:hover {
  background: #2563eb;
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 25px rgba(58, 134, 255, 0.6);
}

.restart-btn:active {
  transform: translateY(1px) scale(0.98);
}

.newstyletest {
    margin: 0;
}
</style>