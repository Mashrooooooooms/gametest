import { ref } from 'vue'

/**
 * Управляет врагами: ИИ, движение, стрельба.
 * @param {Function} getGrid - функция, возвращающая текущую сетку (GridEngine)
 * @param {Function} getPlayerPosition - функция, возвращающая {x, y} игрока
 * @param {Function} addProjectileFn - функция для создания снаряда
 */
export function useEnemies(getGrid, getPlayerPosition, addProjectileFn) {
  const enemies = ref([])

  const MOVE_SPEED = 3.2
  const MAX_SHOOT_DIST = 9.0
  const MIN_DIST = 2.8
  const BASE_SHOOT_DELAY = 1.1

  function initEnemies(count = 6, startCol, startRow, currentTime) {
    const newEnemies = []
    const grid = getGrid()
    if (!grid) return

    for (let i = 0; i < count; i++) {
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

  function isEnemyCollision(col, row, excludeEnemy = null) {
    for (let enemy of enemies.value) {
      if (enemy === excludeEnemy) continue
      const eCol = Math.round(enemy.col)
      const eRow = Math.round(enemy.row)
      if (Math.abs(eCol - col) < 0.8 && Math.abs(eRow - row) < 0.8) return true
    }
    return false
  }

  function updateEnemies(deltaTime, nowSec) {
    const grid = getGrid()
    if (!grid) return

    const playerPos = getPlayerPosition()
    const playerTile = grid.toTile(playerPos.x, playerPos.y)
    const playerCol = Math.round(playerTile.col)
    const playerRow = Math.round(playerTile.row)

    for (let enemy of enemies.value) {
      if (nowSec < enemy.awakeTime) continue

      const currentCol = Math.round(enemy.col)
      const currentRow = Math.round(enemy.row)
      const distToPlayer = Math.hypot(currentCol - playerCol, currentRow - playerRow)
      const hasLos = grid.hasLineOfSight(currentCol, currentRow, playerCol, playerRow)
      const canAct = nowSec >= enemy.actionCooldown

      // Стрельба
      if (hasLos && distToPlayer <= MAX_SHOOT_DIST && canAct) {
        const randomDelay = BASE_SHOOT_DELAY + Math.random() * 0.4
        if (!enemy.lastShotTime || (nowSec - enemy.lastShotTime) >= randomDelay) {
          enemy.lastShotTime = nowSec
          enemy.actionCooldown = nowSec + 0.6

          const fromPos = grid.toScreen(currentCol, currentRow)
          const accuracyPenalty = distToPlayer * 12
          const spreadX = (Math.random() - 0.5) * (30 + accuracyPenalty)
          const spreadY = (Math.random() - 0.5) * (30 + accuracyPenalty)

          addProjectileFn(
            fromPos.x, fromPos.y,
            playerPos.x + spreadX, playerPos.y + spreadY,
            true, 1
          )
        }
      }

      // Движение
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
        } else if (distToPlayer < MIN_DIST) {
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

  function damageEnemyAt(x, y, damage, onEnemyDeath, forceCheck = false) {
    const grid = getGrid()
    if (!grid) return false

    let closest = null
    let closestDist = forceCheck ? 100 : 50
    for (let enemy of enemies.value) {
      const enemyWorld = grid.toScreen(Math.round(enemy.col), Math.round(enemy.row))
      const d = Math.hypot(x - enemyWorld.x, y - enemyWorld.y)
      if (d < closestDist) {
        closestDist = d
        closest = enemy
      }
    }
    if (closest) {
      closest.hp -= damage
      if (closest.hp <= 0) {
        const idx = enemies.value.indexOf(closest)
        if (idx !== -1) {
          enemies.value.splice(idx, 1)
          onEnemyDeath()
        }
      }
      return true
    }
    return false
  }

  function getEnemies() {
    return enemies.value
  }

  function resetEnemies(startCol, startRow, currentTime) {
    enemies.value = []
    initEnemies(6, startCol, startRow, currentTime)
  }

  return {
    enemies,
    initEnemies,
    updateEnemies,
    damageEnemyAt,
    getEnemies,
    resetEnemies,
    isEnemyCollision
  }
}