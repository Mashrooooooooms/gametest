export class GridEngine {
  constructor(width, height, tileWidth = 64, tileHeight = 32) {
    this.width = width
    this.height = height
    this.tileWidth = tileWidth
    this.tileHeight = tileHeight
    this.walkable = []
<<<<<<< HEAD
=======
    this.originX = 0
    this.originY = 0
>>>>>>> 68a7727f50406c7cb4dcda62a2eb8ea628e7a477
  }

  initEmptyMap() {
    this.walkable = Array(this.height).fill().map(() => Array(this.width).fill(true))
    for (let i = 0; i < this.width; i++) {
      this.walkable[0][i] = false
      this.walkable[this.height-1][i] = false
    }
    for (let i = 0; i < this.height; i++) {
      this.walkable[i][0] = false
      this.walkable[i][this.width-1] = false
    }
  }

  setWall(col, row) {
    if (this.walkable[row]?.[col] !== undefined) this.walkable[row][col] = false
  }

  isWalkable(col, row) {
    col = Math.round(col)
    row = Math.round(row)
    return this.walkable[row]?.[col] === true
  }

  toScreen(col, row) {
    const x = (col - row) * (this.tileWidth / 2)
    const y = (col + row) * (this.tileHeight / 2)
    return { x, y }
  }

  toTile(screenX, screenY) {
    const tw2 = this.tileWidth / 2
    const th2 = this.tileHeight / 2
    const col = (screenX / tw2 + screenY / th2) / 2
    const row = (screenY / th2 - screenX / tw2) / 2
    return { col, row }
  }

  findPath(startCol, startRow, targetCol, targetRow) {
    startCol = Math.round(startCol)
    startRow = Math.round(startRow)
    targetCol = Math.round(targetCol)
    targetRow = Math.round(targetRow)
    if (!this.isWalkable(targetCol, targetRow)) return null
    const queue = [{ col: startCol, row: startRow, path: [{ col: startCol, row: startRow }] }]
    const visited = Array(this.height).fill().map(() => Array(this.width).fill(false))
    visited[startRow][startCol] = true

    while (queue.length) {
      const { col, row, path } = queue.shift()
      if (col === targetCol && row === targetRow) return path
      const neighbors = [
        { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
        { dc: -1, dr: 0 }, { dc: 1, dr: 0 }
      ]
      for (const { dc, dr } of neighbors) {
        const nc = col + dc, nr = row + dr
        if (nc >= 0 && nc < this.width && nr >= 0 && nr < this.height && this.isWalkable(nc, nr) && !visited[nr][nc]) {
          visited[nr][nc] = true
          queue.push({ col: nc, row: nr, path: [...path, { col: nc, row: nr }] })
        }
      }
    }
    return null
  }

  hasLineOfSight(col0, row0, col1, row1) {
    let dx = Math.abs(col1 - col0)
    let dy = Math.abs(row1 - row0)
    let sx = col0 < col1 ? 1 : -1
    let sy = row0 < row1 ? 1 : -1
    let err = dx - dy
    let x = col0, y = row0
    while (true) {
      if (x === col1 && y === row1) break
      if (!this.isWalkable(x, y)) return false
      let e2 = 2 * err
      if (e2 > -dy) { err -= dy; x += sx }
      if (e2 < dx) { err += dx; y += sy }
    }
    return true
  }
}