import { ref } from 'vue'

/**
 * Управляет глобальным состоянием игры:
 * - 'playing' — игра активна
 * - 'victory' — игрок победил
 * - 'gameover' — игрок проиграл
 */
export function useGameState() {
  const gameState = ref('playing')
  
  function setVictory() {
    if (gameState.value === 'playing') gameState.value = 'victory'
  }
  
  function setGameOver() {
    if (gameState.value === 'playing') gameState.value = 'gameover'
  }
  
  function resetGameState() {
    gameState.value = 'playing'
  }
  
  return { gameState, setVictory, setGameOver, resetGameState }
}