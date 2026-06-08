import { ref } from 'vue'

export function usePlayer(startX, startY) {
  const player = ref({ x: startX, y: startY, hp: 100, maxHp: 100, speed: 160 })
  const keys = ref({ w: false, s: false, a: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false })
  const target = ref({ x: null, y: null })

  function setKey(key, state) {
    if (keys.value.hasOwnProperty(key)) keys.value[key] = state
  }
  function setTarget(x, y) { target.value = { x, y } }
  function getPosition() { return { x: player.value.x, y: player.value.y } }
  function takeDamage(amount) { player.value.hp -= amount; if (player.value.hp <= 0) { player.value.hp = 0; return true } return false }
  function resetHealth() { player.value.hp = player.value.maxHp }
  function resetPosition(x, y) { player.value.x = x; player.value.y = y; target.value = { x: null, y: null } }

  function updateMovement(delta, isPositionValid) {
    let dx = 0, dy = 0
    if (keys.value.w || keys.value.ArrowUp) dy -= 1
    if (keys.value.s || keys.value.ArrowDown) dy += 1
    if (keys.value.a || keys.value.ArrowLeft) dx -= 1
    if (keys.value.d || keys.value.ArrowRight) dx += 1

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy)
      dx /= length; dy /= length
      target.value = { x: null, y: null }
    } else if (target.value.x !== null && target.value.y !== null) {
      const tx = target.value.x - player.value.x, ty = target.value.y - player.value.y
      const dist = Math.hypot(tx, ty)
      if (dist > 5) { dx = tx / dist; dy = ty / dist }
      else { target.value = { x: null, y: null } }
    }

    if (dx === 0 && dy === 0) return
    const moveDist = player.value.speed * delta
    
    let nextX = player.value.x + dx * moveDist, nextY = player.value.y
    if (isPositionValid(nextX, nextY)) player.value.x = nextX

    nextX = player.value.x; nextY = player.value.y + dy * moveDist
    if (isPositionValid(nextX, nextY)) player.value.y = nextY
  }

  return { player, updateMovement, setTarget, takeDamage, resetPosition, resetHealth, getPosition, setKey }
}