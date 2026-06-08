export const ITEMS = {
  // Оружие
  pistol: { 
    id: 'pistol', 
    name: 'Старый пистолет', 
    type: 'weapon', 
    damage: 10, 
    speed: 1.0, 
    color: '#95a5a6',
    icon: '🔫' 
  },
  blaster: { 
    id: 'blaster', 
    name: 'Плазменный бластер', 
    type: 'weapon', 
    damage: 25, 
    speed: 1.5, 
    color: '#3498db',
    icon: '🛸' 
  },
  
  // Броня
  light_armor: { 
    id: 'light_armor', 
    name: 'Кевларовый жилет', 
    type: 'armor', 
    defense: 5, 
    color: '#2ecc71',
    icon: '🦺' 
  },
  heavy_armor: { 
    id: 'heavy_armor', 
    name: 'Тяжелая броня', 
    type: 'armor', 
    defense: 15, 
    color: '#34495e',
    icon: '🛡️' 
  },

  // Расходники
  medkit: { 
    id: 'medkit', 
    name: 'Аптечка', 
    type: 'consumable', 
    heal: 40, 
    color: '#e74c3c',
    icon: '❤️' 
  }
}

// Вспомогательная функция для получения предмета по ID
export function getItemById(id) {
  return ITEMS[id] || null
}