export function useRenderer(canvasRef, getGrid, getPlayer, getEnemies, getProjectiles, getHitMarkers, getExit, getChests, worldConstants) {
  let ctx = null
  let camera = { x: 0, y: 0 }
  let screenWidth = 0, screenHeight = 0
  let dpr = window.devicePixelRatio || 1

  const playerImg = new Image()
  const enemyImg = new Image()
  playerImg.src = '/src/assets/04 zx 1 5.png'
  enemyImg.src = '/src/assets/04 zx 1 5.png'
  playerImg.onerror = () => { playerImg._fallback = true }
  enemyImg.onerror = () => { enemyImg._fallback = true }

  function initRenderer() {
    const canvas = canvasRef.value
    if (!canvas) return
    ctx = canvas.getContext('2d')
    resizeCanvas()
  }

  function updateCamera(playerX, playerY) {
    camera.x = playerX - screenWidth / 2
    camera.y = playerY - screenHeight / 2
  }

  function resizeCanvas() {
    const canvas = canvasRef.value
    if (!canvas || !ctx) return
    dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    screenWidth = window.innerWidth
    screenHeight = window.innerHeight
  }

  function drawTile(grid, col, row) {
    if (!grid) return
    const { x, y } = grid.toScreen(col, row)
    let screenX = x - camera.x
    let screenY = y - camera.y
    const hw = grid.tileWidth / 2
    const hh = grid.tileHeight / 2

    if (screenX + hw < -100 || screenX - hw > screenWidth + 100 ||
        screenY + grid.tileHeight + worldConstants.WALL_HEIGHT < -100 || screenY - hh > screenHeight + 100) return

    const isWall = !grid.isWalkable(col, row)
    if (!isWall) screenY += worldConstants.FLOOR_DROP
    const thickness = isWall ? worldConstants.WALL_HEIGHT : worldConstants.FLOOR_THICKNESS

    const top = { x: screenX, y: screenY }
    const right = { x: screenX + hw, y: screenY + hh }
    const bottom = { x: screenX, y: screenY + grid.tileHeight }
    const left = { x: screenX - hw, y: screenY + hh }

    ctx.beginPath()
    ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(bottom.x, bottom.y + thickness); ctx.lineTo(left.x, left.y + thickness); ctx.closePath()
    ctx.fillStyle = isWall ? '#4a2b2b' : '#151520'; ctx.fill()

    ctx.beginPath()
    ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(right.x, right.y); ctx.lineTo(right.x, right.y + thickness); ctx.lineTo(bottom.x, bottom.y + thickness); ctx.closePath()
    ctx.fillStyle = isWall ? '#6d4242' : '#252535'; ctx.fill()

    ctx.beginPath()
    ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y); ctx.closePath()
    ctx.fillStyle = isWall ? '#9e6b6b' : '#35354a'; ctx.fill()

    if (isWall) {
      ctx.beginPath()
      ctx.moveTo(left.x, left.y + thickness/2); ctx.lineTo(bottom.x, bottom.y + thickness/2); ctx.lineTo(right.x, right.y + thickness/2)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; ctx.lineWidth = 2; ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); ctx.lineTo(right.x, right.y + thickness); ctx.lineTo(bottom.x, bottom.y + thickness); ctx.lineTo(left.x, left.y + thickness); ctx.lineTo(left.x, left.y); ctx.closePath()
    ctx.strokeStyle = isWall ? '#2a1515' : '#0a0a15'; ctx.lineWidth = isWall ? 2 : 1; ctx.stroke()
  }

  function drawDoor(grid, exit) {
    if (!exit) return
    let doorCol = exit.edge === 'left' ? 0 : exit.edge === 'right' ? worldConstants.MAP_SIZE - 1 : exit.x
    let doorRow = exit.edge === 'top' ? 0 : exit.edge === 'bottom' ? worldConstants.MAP_SIZE - 1 : exit.y
    
    const pos = grid.toScreen(doorCol, doorRow)
    const screenX = pos.x - camera.x
    const screenY = pos.y - camera.y + worldConstants.FLOOR_DROP
    const doorWidth = (grid.tileWidth / 2) * 1.5
    const doorHeight = grid.tileHeight * 2
    
    ctx.save()
    ctx.fillStyle = '#4a3520'; ctx.fillRect(screenX - doorWidth/2, screenY - doorHeight, doorWidth, doorHeight)
    ctx.fillStyle = '#6b4e31'; ctx.fillRect(screenX - doorWidth/2 + 4, screenY - doorHeight + 4, doorWidth - 8, doorHeight - 8)
    ctx.strokeStyle = '#3a2515'; ctx.lineWidth = 2
    ctx.strokeRect(screenX - doorWidth/4, screenY - doorHeight * 0.7, doorWidth/2, doorHeight * 0.3)
    ctx.strokeRect(screenX - doorWidth/4, screenY - doorHeight * 0.3, doorWidth/2, doorHeight * 0.2)
    ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(screenX + doorWidth/4, screenY - doorHeight/2, 4, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.stroke()
    ctx.globalAlpha = 0.3
    const gradient = ctx.createRadialGradient(screenX, screenY - doorHeight/2, 0, screenX, screenY - doorHeight/2, doorWidth)
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)'); gradient.addColorStop(1, 'rgba(255, 215, 0, 0)')
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(screenX, screenY - doorHeight/2, doorWidth, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  function drawChest(grid, chest) {
    const pos = grid.toScreen(chest.x, chest.y)
    const screenX = pos.x - camera.x
    const screenY = pos.y - camera.y + worldConstants.FLOOR_DROP
    const hw = grid.tileWidth / 2
    const hh = grid.tileHeight / 2
    
    ctx.save()
    if (chest.isLocked) {
      ctx.fillStyle = '#5d4037'
      ctx.fillRect(screenX - hw * 0.6, screenY - hh * 1.5, hw * 1.2, hh * 1.5)
      ctx.fillStyle = '#ffd700'
      ctx.beginPath(); ctx.arc(screenX, screenY - hh * 0.75, 4, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = '#8d6e63'
      ctx.fillRect(screenX - hw * 0.6, screenY - hh * 1.5, hw * 1.2, hh * 1.5)
      ctx.fillStyle = '#3e2723'
      ctx.fillRect(screenX - hw * 0.4, screenY - hh * 1.3, hw * 0.8, hh * 0.4)
    }
    ctx.restore()
  }

  function drawSpriteAt(grid, worldX, worldY, img, isPlayer = false, yOffset = 0) {
    const screenX = worldX - camera.x
    const screenY = worldY - camera.y + yOffset
    const size = grid.tileHeight * 1.2
    if (img.complete && !img._fallback) {
      ctx.drawImage(img, screenX - size/2, screenY - size, size, size)
    } else {
      ctx.beginPath(); ctx.arc(screenX, screenY - size/2, size/2, 0, Math.PI*2)
      ctx.fillStyle = isPlayer ? '#3a86ff' : '#e63946'; ctx.fill()
      ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke()
    }
    if (isPlayer) {
      ctx.beginPath(); ctx.arc(screenX, screenY - size/2, size*0.6, 0, Math.PI*2)
      ctx.fillStyle = 'rgba(255,80,80,0.2)'; ctx.fill()
    }
  }

  function drawHealthBar(worldX, worldY, current, max, width = 40, yOffset = 0) {
    const screenX = worldX - camera.x
    const screenY = worldY - camera.y + yOffset - 28
    const percent = current / max
    ctx.fillStyle = '#111'; ctx.fillRect(screenX - width/2 - 1, screenY - 1, width + 2, 8)
    ctx.fillStyle = percent > 0.5 ? '#2ecc71' : (percent > 0.25 ? '#f1c40f' : '#e74c3c')
    ctx.fillRect(screenX - width/2, screenY, width * percent, 6)
  }

  function drawEnemy(grid, enemy) {
    const pos = grid.toScreen(enemy.col, enemy.row)
    drawSpriteAt(grid, pos.x, pos.y, enemyImg, false, worldConstants.FLOOR_DROP)
    drawHealthBar(pos.x, pos.y, enemy.hp, enemy.maxHp, 40, worldConstants.FLOOR_DROP)
  }

  function drawProjectile(p) {
    const x = p.fromX + (p.toX - p.fromX) * p.progress - camera.x
    const y = p.fromY + (p.toY - p.fromY) * p.progress - camera.y
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2)
    ctx.fillStyle = p.isEnemy ? '#ff6666' : '#ffaa44'
    ctx.shadowColor = p.isEnemy ? '#ff6666' : '#ffaa44'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0
  }

  function drawHitMarker(m) {
    const alpha = Math.max(0, m.life)
    ctx.save(); ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(m.x - camera.x - 10, m.y - camera.y - 10); ctx.lineTo(m.x - camera.x + 10, m.y - camera.y + 10)
    ctx.moveTo(m.x - camera.x + 10, m.y - camera.y - 10); ctx.lineTo(m.x - camera.x - 10, m.y - camera.y + 10)
    ctx.lineWidth = 3; ctx.strokeStyle = '#ff4444'; ctx.stroke()
    ctx.restore()
  }

  function render(playerX, playerY, playerHp, playerMaxHp) {
    const grid = getGrid()
    if (!ctx || !grid) return

    ctx.clearRect(0, 0, screenWidth, screenHeight)
    const renderList = []
    
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        renderList.push({ type: 'tile', col, row, depth: col + row })
      }
    }

    const exit = getExit()
    if (exit) renderList.push({ type: 'door', obj: exit, depth: exit.x + exit.y })

    const chests = getChests()
    if (chests) {
      chests.forEach(c => renderList.push({ type: 'chest', obj: c, depth: c.x + c.y }))
    }

    const enemies = getEnemies()
    enemies.forEach(e => renderList.push({ type: 'enemy', obj: e, depth: Math.round(e.col) + Math.round(e.row) }))

    const pTile = grid.toTile(playerX, playerY)
    renderList.push({ type: 'player', depth: Math.round(pTile.col) + Math.round(pTile.row) })

    renderList.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth
      const priority = { tile: 0, door: 1, chest: 2, enemy: 3, player: 4 }
      return priority[a.type] - priority[b.type]
    })

    renderList.forEach(item => {
      if (item.type === 'tile') drawTile(grid, item.col, item.row)
      else if (item.type === 'door') drawDoor(grid, item.obj)
      else if (item.type === 'chest') drawChest(grid, item.obj)
      else if (item.type === 'enemy') drawEnemy(grid, item.obj)
      else if (item.type === 'player') {
        drawSpriteAt(grid, playerX, playerY, playerImg, true, worldConstants.FLOOR_DROP)
        drawHealthBar(playerX, playerY, playerHp, playerMaxHp, 40, worldConstants.FLOOR_DROP)
      }
    })

    getProjectiles().forEach(p => drawProjectile(p))
    getHitMarkers().forEach(m => drawHitMarker(m))
  }

  function getScreenSize() {
    return { width: screenWidth, height: screenHeight }
  }

  return { initRenderer, resizeCanvas, updateCamera, render, getScreenSize }
}