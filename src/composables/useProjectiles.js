import { ref } from 'vue'

export function useProjectiles() {
  const projectiles = ref([])
  const hitMarkers = ref([])
  const PROJECTILE_SPEED = 900

  function addProjectile(fromX, fromY, toX, toY, isEnemy, damage = 1) {
    projectiles.value.push({
      fromX, fromY,
      toX, toY,
      progress: 0,
      isEnemy,
      damage,
      hitSomething: false
    })
  }

  function addHitMarker(x, y) {
    hitMarkers.value.push({ x, y, life: 1.0 })
  }

  function raycastEnemy(x1, y1, x2, y2, enemies, getGrid) {
    const grid = getGrid()
    if (!grid) return null

    let closest = null
    let closestDist2 = Infinity
    const radius = 25

    for (const enemy of enemies) {
      const enemyPos = grid.toScreen(Math.round(enemy.col), Math.round(enemy.row))
      const ex = enemyPos.x
      const ey = enemyPos.y

      const ax = x2 - x1
      const ay = y2 - y1
      const len2 = ax * ax + ay * ay
      if (len2 === 0) continue

      let t = ((ex - x1) * ax + (ey - y1) * ay) / len2
      t = Math.max(0, Math.min(1, t))
      const projX = x1 + t * ax
      const projY = y1 + t * ay

      const dx = projX - ex
      const dy = projY - ey
      const dist2 = dx * dx + dy * dy

      if (dist2 < radius * radius && dist2 < closestDist2) {
        closestDist2 = dist2
        closest = enemy
      }
    }
    return closest
  }

  function updateProjectiles(deltaTime, isWalkableFn, onHitPlayer, onHitEnemy, enemiesRef, getGrid) {
    for (let i = 0; i < projectiles.value.length; i++) {
      const p = projectiles.value[i]
      if (p.hitSomething) {
        projectiles.value.splice(i, 1)
        i--
        continue
      }

      const dx = p.toX - p.fromX
      const dy = p.toY - p.fromY
      const totalDist = Math.hypot(dx, dy)
      if (totalDist < 0.01) {
        projectiles.value.splice(i, 1)
        i--
        continue
      }

      const step = PROJECTILE_SPEED * deltaTime
      const prevProgress = p.progress
      p.progress += step / totalDist

      const segStartX = p.fromX + dx * prevProgress
      const segStartY = p.fromY + dy * prevProgress
      const segEndX = p.fromX + dx * Math.min(1, p.progress)
      const segEndY = p.fromY + dy * Math.min(1, p.progress)

      if (!p.isEnemy && enemiesRef && enemiesRef.value) {
        const hitEnemy = raycastEnemy(segStartX, segStartY, segEndX, segEndY, enemiesRef.value, getGrid)
        if (hitEnemy) {
          onHitEnemy(segEndX, segEndY, p.damage)
          addHitMarker(segEndX, segEndY)
          p.hitSomething = true
          projectiles.value.splice(i, 1)
          i--
          continue
        }
      }

      const grid = getGrid()
      if (grid) {
        const midX = (segStartX + segEndX) / 2
        const midY = (segStartY + segEndY) / 2
        const tileMid = grid.toTile(midX, midY)
        if (!grid.isWalkable(tileMid.col, tileMid.row)) {
          projectiles.value.splice(i, 1)
          i--
          continue
        }
      }

      if (p.progress >= 1) {
        if (p.isEnemy) {
          const died = onHitPlayer(p.damage)
          if (died) addHitMarker(p.toX, p.toY)
        } else {
          onHitEnemy(p.toX, p.toY, p.damage, true)
        }
        projectiles.value.splice(i, 1)
        i--
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

  function clearAll() {
    projectiles.value = []
    hitMarkers.value = []
  }

  return {
    projectiles,
    hitMarkers,
    addProjectile,
    addHitMarker,
    updateProjectiles,
    updateHitMarkers,
    clearAll
  }
}