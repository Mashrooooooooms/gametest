import { ref } from 'vue'
import { GridEngine } from '../game/GridEngine.js'

export function useWorld() {
  const currentLocation = ref(null)
  const currentLocationId = ref(0)
  const locations = ref(new Map())
  let lastTransitionTime = 0
  const TRANSITION_COOLDOWN = 500

  const WALL_HEIGHT = 70, FLOOR_THICKNESS = 8, FLOOR_DROP = 24
  const MAP_SIZE = 45, ROOM_COUNT = 5, MIN_ROOM_SIZE = 6, MAX_ROOM_SIZE = 12

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

  function roomsOverlap(r1, r2, padding = 2) {
    return !(r1.x + r1.w + padding < r2.x || r2.x + r2.w + padding < r1.x ||
             r1.y + r1.h + padding < r2.y || r2.y + r2.h + padding < r1.y)
  }

  function drawThickLine(grid, x1, y1, x2, y2, thickness = 2) {
    let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1)
    let sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1
    let err = dx - dy, x = x1, y = y1
    while (true) {
      for (let i = -Math.floor(thickness/2); i <= Math.floor(thickness/2); i++) {
        for (let j = -Math.floor(thickness/2); j <= Math.floor(thickness/2); j++) {
          const nx = x + i, ny = y + j
          if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) grid.walkable[ny][nx] = true
        }
      }
      if (x === x2 && y === y2) break
      const e2 = 2 * err
      if (e2 > -dy) { err -= dy; x += sx }
      if (e2 < dx) { err += dx; y += sy }
    }
  }

  function findClosestEdge(room) {
    const cx = room.x + room.w / 2, cy = room.y + room.h / 2
    const dL = cx, dR = MAP_SIZE - cx, dT = cy, dB = MAP_SIZE - cy
    const min = Math.min(dL, dR, dT, dB)
    if (min === dL) return 'left'; if (min === dR) return 'right'
    if (min === dT) return 'top'; return 'bottom'
  }

  function generateLocation(locationId) {
    const grid = new GridEngine(MAP_SIZE, MAP_SIZE, 64, 32)
    grid.initEmptyMap()
    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) grid.walkable[y][x] = false

    const roomList = []
    let attempts = 0
    while (roomList.length < ROOM_COUNT && attempts < 500) {
      const w = rand(MIN_ROOM_SIZE, MAX_ROOM_SIZE), h = rand(MIN_ROOM_SIZE, MAX_ROOM_SIZE)
      const x = rand(2, MAP_SIZE - w - 2), y = rand(2, MAP_SIZE - h - 2)
      const newRoom = { id: roomList.length, x, y, w, h, enemiesAllowed: false }
      let overlap = false
      for (let r of roomList) if (roomsOverlap(newRoom, r, 4)) { overlap = true; break }
      if (!overlap) {
        for (let i = y; i < y + h; i++) for (let j = x; j < x + w; j++) grid.walkable[i][j] = true
        roomList.push(newRoom)
      }
      attempts++
    }

    const connections = []
    for (let i = 0; i < roomList.length - 1; i++) {
      let bestDist = Infinity, bestJ = i + 1
      for (let j = i + 1; j < roomList.length; j++) {
        const c1 = { x: Math.floor(roomList[i].x + roomList[i].w/2), y: Math.floor(roomList[i].y + roomList[i].h/2) }
        const c2 = { x: Math.floor(roomList[j].x + roomList[j].w/2), y: Math.floor(roomList[j].y + roomList[j].h/2) }
        const d = Math.hypot(c1.x - c2.x, c1.y - c2.y)
        if (d < bestDist) { bestDist = d; bestJ = j }
      }
      if (!connections.some(c => (c.a === i && c.b === bestJ) || (c.a === bestJ && c.b === i))) connections.push({ a: i, b: bestJ })
    }

    for (let conn of connections) {
      const rA = roomList[conn.a], rB = roomList[conn.b]
      drawThickLine(grid, Math.floor(rA.x+rA.w/2), Math.floor(rA.y+rA.h/2), Math.floor(rB.x+rB.w/2), Math.floor(rA.y+rA.h/2), 2)
      drawThickLine(grid, Math.floor(rB.x+rB.w/2), Math.floor(rA.y+rA.h/2), Math.floor(rB.x+rB.w/2), Math.floor(rB.y+rB.h/2), 2)
    }

    roomList[Math.floor(roomList.length/2)].enemiesAllowed = true

    let exitRoom = null, minDist = Infinity
    for (let r of roomList) {
      if (!r.enemiesAllowed) {
        const edge = findClosestEdge(r)
        const dist = edge==='left'?r.x+r.w/2 : edge==='right'?MAP_SIZE-(r.x+r.w/2) : edge==='top'?r.y+r.h/2 : MAP_SIZE-(r.y+r.h/2)
        if (dist < minDist) { minDist = dist; exitRoom = r }
      }
    }
    if (!exitRoom) exitRoom = roomList[0]

    const edge = findClosestEdge(exitRoom)
    let dx = edge==='left'?exitRoom.x : edge==='right'?exitRoom.x+exitRoom.w-1 : Math.floor(exitRoom.x+exitRoom.w/2)
    let dy = edge==='top'?exitRoom.y : edge==='bottom'?exitRoom.y+exitRoom.h-1 : Math.floor(exitRoom.y+exitRoom.h/2)
    drawThickLine(grid, dx, dy, edge==='left'?0:edge==='right'?MAP_SIZE-1:dx, edge==='top'?0:edge==='bottom'?MAP_SIZE-1:dy, 2)

    const exit = { x: dx, y: dy, edge, targetLocation: null, isLocked: locationId > 0, hackType: locationId > 0 ? 'hard' : null }

    const chests = [], hackTypes = ['easy', 'medium', 'hard']
    for (let i = 0; i < 3; i++) {
      let cx, cy, valid = false, att = 0
      while (!valid && att < 100) {
        cx = rand(2, MAP_SIZE-3); cy = rand(2, MAP_SIZE-3)
        valid = grid.walkable[cy][cx] && Math.hypot(cx-exit.x, cy-exit.y)>5 && Math.hypot(cx-roomList[0].x, cy-roomList[0].y)>5
        for (let c of chests) if (Math.hypot(cx-c.x, cy-c.y)<4) valid = false
        att++
      }
      if (valid) chests.push({ id: `chest_${locationId}_${i}`, x: cx, y: cy, isLocked: true, isJammed: false, hackType: hackTypes[Math.floor(Math.random()*3)], loot: [{ itemId: Math.random()>0.5?'medkit':'light_armor', count: 1 }] })
    }

    return { grid, rooms: roomList, exit, chests }
  }

  function generateLinkedLocation(fromId, fromExit) {
    const newId = locations.value.size
    const { grid, rooms, exit, chests } = generateLocation(newId)
    exit.targetLocation = fromId
    locations.value.set(newId, { grid, rooms, exit, chests })
    const from = locations.value.get(fromId)
    from.exit.targetLocation = newId
    return newId
  }

  function initWorld() {
    const id = 0
    const { grid, rooms, exit, chests } = generateLocation(id)
    exit.targetLocation = null
    locations.value.set(id, { grid, rooms, exit, chests })
    currentLocationId.value = id
    currentLocation.value = locations.value.get(id)
    const sr = rooms[0]
    return { startGrid: grid, startPos: grid.toScreen(Math.floor(sr.x+sr.w/2), Math.floor(sr.y+sr.h/2)) }
  }

  function switchToLocation(locId, cb) {
    if (Date.now() - lastTransitionTime < TRANSITION_COOLDOWN) return false
    const loc = locations.value.get(locId)
    if (!loc) return false
    lastTransitionTime = Date.now()
    currentLocationId.value = locId
    currentLocation.value = loc
    const pos = loc.grid.toScreen(loc.exit.x, loc.exit.y)
    if (cb) cb(locId, pos, loc.grid)
    return true
  }

  function attemptDoorTransition(px, py, cb) {
    if (Date.now() - lastTransitionTime < TRANSITION_COOLDOWN) return false
    if (!currentLocation.value) return false
    const { grid, exit } = currentLocation.value
    const { col, row } = grid.toTile(px, py)
    if (!exit || Math.abs(exit.x - Math.round(col)) > 1.5 || Math.abs(exit.y - Math.round(row)) > 1.5) return false
    
    let target = exit.targetLocation
    if (target === null) { target = generateLinkedLocation(currentLocationId.value, exit); exit.targetLocation = target }
    return switchToLocation(target, cb)
  }

  function isPositionValid(x, y, r = 8) {
    if (!currentLocation.value) return false
    const g = currentLocation.value.grid
    const checks = [{dx:0,dy:0},{dx:r,dy:0},{dx:-r,dy:0},{dx:0,dy:r},{dx:0,dy:-r},{dx:r*.7,dy:r*.7},{dx:-r*.7,dy:r*.7},{dx:r*.7,dy:-r*.7},{dx:-r*.7,dy:-r*.7}]
    for (const o of checks) if (!g.isWalkable(g.toTile(x+o.dx, y+o.dy).col, g.toTile(x+o.dx, y+o.dy).row)) return false
    return true
  }

  function getExit() { return currentLocation.value?.exit || null }
  function getChests() { return currentLocation.value?.chests || [] }
  
  function getChestAt(x, y) {
    if (!currentLocation.value) return null
    const { col, row } = currentLocation.value.grid.toTile(x, y)
    return currentLocation.value.chests.find(c => c.x === Math.round(col) && c.y === Math.round(row))
  }

  function unlockChest(id) { const c = currentLocation.value.chests.find(x => x.id === id); if (c) c.isLocked = false }
  
  function isEnemyRoom(x, y) {
    if (!currentLocation.value) return false
    const { col, row } = currentLocation.value.grid.toTile(x, y)
    return currentLocation.value.rooms.some(r => col>=r.x && col<r.x+r.w && row>=r.y && row<r.y+r.h && r.enemiesAllowed)
  }
  
  function isNearDoor(x, y) {
    const e = getExit(); if (!e) return false
    const { col, row } = currentLocation.value.grid.toTile(x, y)
    return Math.abs(e.x - Math.round(col)) <= 1.5 && Math.abs(e.y - Math.round(row)) <= 1.5
  }

  return {
    initWorld, switchToLocation, attemptDoorTransition, isPositionValid,
    getExit, getChests, getChestAt, unlockChest,
    isEnemyRoom, isNearDoor, getCurrentGrid: () => currentLocation.value?.grid || null,
    currentLocationId, WALL_HEIGHT, FLOOR_THICKNESS, FLOOR_DROP, MAP_SIZE
  }
}