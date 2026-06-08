<template>
  <div class="hack-container">
    <div class="terminal-header">
      <div class="header-left">
        <span class="blink">_</span> {{ terminalTitle }} // ID: {{ targetId }}
      </div>
      <div class="header-hint">
        >> ЗАДАЧА: {{ currentHints[currentBlock] || 'Внимательно изучите код' }}
      </div>
    </div>
    
    <div class="terminal-screen" :class="screenClass">
      <div class="status-line">
        <span>[ СТАТУС: <span :class="statusColor">{{ hackStatus }}</span> ]</span>
        <span v-if="timeLeft !== null" class="timer">
          ⏱ {{ timeLeft.toFixed(1) }}с <span class="penalty-hint">(-5с за ошибку)</span>
        </span>
      </div>
      
      <div class="code-container">
        <template v-for="(block, blockIdx) in codeBlocks" :key="blockIdx">
          <!-- Уже взломанные блоки -->
          <div v-if="blockIdx < currentBlock" class="block-found">
            ✓ ЭТАП {{ blockIdx + 1 }}/{{ totalBlocks }} ВЗЛОМАН
          </div>
          
          <!-- Текущий активный блок -->
          <div v-else-if="blockIdx === currentBlock && block" class="code-block-wrapper active-block" :class="{ 'shake': hackStatus.includes('ОШИБКА') }">
            <div class="block-label">// ЭТАП {{ blockIdx + 1 }}/{{ totalBlocks }}: {{ currentLabels[blockIdx] || 'ДАННЫЕ' }}</div>
            <div class="code-block">
              <div 
                v-for="(line, idx) in block" 
                :key="idx"
                class="code-line"
                :class="{ 
                  'selected': playerScript.includes(line.code),
                  'wrong': wrongLines.includes(line.code)
                }"
                @click="selectLine(line, blockIdx)"
              >
                <span class="line-num">{{ getLineNum(blockIdx, idx) }}</span>
                <span class="code-text" v-html="highlightSyntax(line.code)"></span>
              </div>
            </div>
          </div>
          
          <!-- Заблокированные будущие блоки -->
          <div v-else-if="blockIdx > currentBlock" class="code-block-wrapper locked-block">
            <div class="block-label">// ЭТАП {{ blockIdx + 1 }}/{{ totalBlocks }}: ЗАБЛОКИРОВАНО</div>
            <div class="code-block locked-content">
              <div v-for="i in 4" :key="i" class="code-line dummy">
                <span class="line-num">--</span>
                <span class="code-text">0x0000000000000000</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="info-panel">
      <div class="info-text" v-if="hackStatus === 'СИСТЕМА ЗАБЛОКИРОВАНА'">
        <span class="critical">>> ВРЕМЯ ИСТЕКЛО. ПРОТОКОЛ ЗАЩИТЫ АКТИВИРОВАН.</span>
      </div>
      <div class="info-text" v-else>
        <span v-if="currentBlock < totalBlocks">>> Ожидание ввода команды...</span>
        <span v-else class="success">>> ДОСТУП РАЗРЕШЕН</span>
      </div>
      
      <!-- Кнопка продолжить только если это обычная ошибка, а не конец времени -->
      <button v-if="hackStatus === 'ОШИБКА: НЕВЕРНЫЙ КОД'" class="retry-btn" @click="clearError">ПРОДОЛЖИТЬ</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  type: { type: String, default: 'medium' },
  targetId: { type: String, default: '00' }
})
const emit = defineEmits(['success', 'fail'])

const HACK_CONFIG = {
  easy: { blocks: 1, linesPerBlock: 6, timeLimit: null },
  medium: { blocks: 3, linesPerBlock: 9, timeLimit: null },
  hard: { blocks: 3, linesPerBlock: 12, timeLimit: 45 },
  extreme: { blocks: 4, linesPerBlock: 15, timeLimit: 60 }
}

const TERMINAL_TITLES = {
  easy: 'BASIC_SCANNER v1.2', medium: 'DECRYPTOR_TOOL v2.4',
  hard: 'ADVANCED_CRACKER v3.7', extreme: 'ROOT_EXPLOIT v5.0'
}

const BLOCK_LABELS = {
  easy: ['Инициализация'],
  medium: ['Инициализация ядра', 'Аутентификация', 'Взлом замка'],
  hard: ['Защищенное соединение', 'Обход шифрования', 'Эксплойт ядра'],
  extreme: ['Загрузка модуля', 'Дешифровка SSL', 'SQL-инъекция', 'Root-доступ']
}

const BLOCK_HINTS = {
  easy: ['Найдите команду инициализации'],
  medium: ['Найдите функцию инициализации ядра', 'Найдите проверку хеша доступа', 'Найдите команду физического взлома'],
  hard: ['Инициализация защищенного соединения', 'Обход системы шифрования', 'Выполнение эксплойта ядра'],
  extreme: ['Загрузка модуля ядра', 'Дешифровка SSL-сертификата', 'Инъекция SQL-запроса', 'Выполнение root-доступа']
}

const CODE_TARGETS = {
  init: ['kernel.init(root_access=true)', 'sys.load_module("crypto_core")', 'auth.bypass_sequence(start)', 'security.override(level=9)'],
  auth: ['if (hash.verify(token)) { grant_access(); }', 'crypto.check_signature(data, key)', 'auth.validate_credentials(user, pass)', 'security.decrypt_hash(target)'],
  exec: ['lock.physical_override(force=true)', 'sys.execute("sudo rm -rf /lock")', 'hardware.bypass_pin(code=0x4A2F)', 'kernel.flush_security_logs()'],
  network: ['net.establish_secure_channel(port=443)', 'firewall.inject_rule(allow_all=true)', 'proxy.redirect_traffic(target)', 'socket.bind(0x7F000001, 8080)'],
  exploit: ['memory.overflow(buffer, 0xDEADBEEF)', 'stack.smash(payload, ret_addr)', 'heap.spray(shellcode, size=4096)', 'kernel.exploit_cve_2024_1234()']
}

const CODE_DECOYS = [
  'kernel.init(root_access=false)', 'sys.load_module("crypto_core_backup")', 'auth.bypass_sequence(end)',
  'if (hash.verify(token) === false) { grant_access(); }', 'crypto.check_signature(data, null)',
  'auth.validate_credentials(user, "admin")', 'security.decrypt_hash(target, weak_key)',
  'lock.physical_override(force=false)', 'sys.execute("sudo rm -rf /lock_backup")',
  'hardware.bypass_pin(code=0x0000)', 'kernel.flush_security_logs(dry_run=true)',
  'net.establish_secure_channel(port=80)', 'firewall.inject_rule(allow_all=false)',
  'proxy.redirect_traffic(target, honeypot)', 'socket.bind(0x00000000, 22)',
  'memory.overflow(buffer, 0x00000000)', 'stack.smash(payload, ret_addr=null)',
  'heap.spray(shellcode, size=0)', 'kernel.exploit_cve_2024_0000()',
  'const bypass = require("fake-bypass");', 'function decrypt_hash(target) { return null; }',
  'await security.override(level=1);', 'if (user.level < 9) { return deny(); }',
  'for (let i=0; i<tokens.length; i++) { verify(tokens[i]); }', 'while (!connection.secure) { handshake(); }'
]

const config = computed(() => HACK_CONFIG[props.type] || HACK_CONFIG.medium)
const terminalTitle = computed(() => TERMINAL_TITLES[props.type] || TERMINAL_TITLES.medium)
const currentLabels = computed(() => BLOCK_LABELS[props.type] || BLOCK_LABELS.medium)
const currentHints = computed(() => BLOCK_HINTS[props.type] || BLOCK_HINTS.medium)
const totalBlocks = computed(() => config.value.blocks)

const hackStatus = ref('СКАНИРОВАНИЕ...')
const codeBlocks = ref([])
const playerScript = ref([])
const wrongLines = ref([])
const currentBlock = ref(0)
const timeLeft = ref(null)
let timerInterval = null

watch(() => props.type, () => initHack(), { immediate: true })

function initHack() {
  hackStatus.value = 'СКАНИРОВАНИЕ...'
  playerScript.value = []
  wrongLines.value = []
  currentBlock.value = 0
  codeBlocks.value = []
  
  generateCode()
  
  setTimeout(() => {
    hackStatus.value = 'ОЖИДАНИЕ ВВОДА'
    if (config.value.timeLimit) {
      timeLeft.value = config.value.timeLimit
      startTimer()
    }
  }, 800)
}

function generateCode() {
  const blocks = []
  const targetCategories = ['init', 'auth', 'exec', 'network', 'exploit']
  
  for (let i = 0; i < config.value.blocks; i++) {
    const category = targetCategories[i % targetCategories.length]
    const targets = CODE_TARGETS[category]
    const target = targets[Math.floor(Math.random() * targets.length)]
    
    const shuffledDecoys = [...CODE_DECOYS].sort(() => Math.random() - 0.5)
    const decoysCount = config.value.linesPerBlock - 1
    const decoys = shuffledDecoys.slice(0, decoysCount)
    
    const block = [
      ...decoys.slice(0, Math.floor(decoysCount / 2)).map(code => ({ code, isTarget: false })),
      { code: target, isTarget: true },
      ...decoys.slice(Math.floor(decoysCount / 2)).map(code => ({ code, isTarget: false }))
    ]
    blocks.push(block)
  }
  codeBlocks.value = blocks
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) {
      clearInterval(timerInterval)
      timeLeft.value = 0
      hackStatus.value = 'СИСТЕМА ЗАБЛОКИРОВАНА'
      emit('fail') // Немедленно сообщаем родителю о провале
    }
  }, 100)
}

function selectLine(line, blockIndex) {
  if (hackStatus.value === 'СИСТЕМА ЗАБЛОКИРОВАНА' || hackStatus.value === 'ВЗЛОМ УСПЕШЕН') return
  if (blockIndex !== currentBlock.value) return
  
  if (line.isTarget) {
    playerScript.value.push(line.code)
    currentBlock.value++
    
    if (currentBlock.value >= config.value.blocks) {
      hackStatus.value = 'ВЗЛОМ УСПЕШЕН'
      if (timerInterval) clearInterval(timerInterval)
      emit('success')
    } else {
      hackStatus.value = 'ОЖИДАНИЕ ВВОДА'
    }
  } else {
    wrongLines.value.push(line.code)
    hackStatus.value = 'ОШИБКА: НЕВЕРНЫЙ КОД'
    
    if (timeLeft.value !== null) {
      timeLeft.value = Math.max(0, timeLeft.value - 5)
    }
    
    setTimeout(() => {
      if (hackStatus.value === 'ОШИБКА: НЕВЕРНЫЙ КОД') {
        hackStatus.value = 'ОЖИДАНИЕ ВВОДА'
        wrongLines.value = []
      }
    }, 800)
  }
}

function clearError() {
  hackStatus.value = 'ОЖИДАНИЕ ВВОДА'
  wrongLines.value = []
}

function resetHack() {
  initHack()
}

function getLineNum(blockIdx, lineIdx) {
  let num = 1
  for (let i = 0; i < blockIdx; i++) {
    num += codeBlocks.value[i]?.length || 0
  }
  return num + lineIdx
}

function highlightSyntax(code) {
  return code
    .replace(/(if|else|for|while|switch|case|break|return|const|let|var|function|try|catch|class|export|import|async|await)/g, '<span class="kw">$1</span>')
    .replace(/(true|false|null|undefined)/g, '<span class="bool">$1</span>')
    .replace(/(\d+)/g, '<span class="num">$1</span>')
    .replace(/(".*?")/g, '<span class="str">$1</span>')
    .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
    .replace(/([a-z_]+\()/g, '<span class="func">$1</span>')
}

const screenClass = computed(() => {
  if (hackStatus.value === 'СИСТЕМА ЗАБЛОКИРОВАНА') return 'screen-blocked'
  if (hackStatus.value.includes('ОШИБКА')) return 'screen-error'
  if (hackStatus.value === 'ВЗЛОМ УСПЕШЕН') return 'screen-success'
  return 'screen-normal'
})

const statusColor = computed(() => {
  if (hackStatus.value === 'СИСТЕМА ЗАБЛОКИРОВАНА') return 'color-red'
  if (hackStatus.value.includes('ОШИБКА')) return 'color-red'
  if (hackStatus.value === 'ВЗЛОМ УСПЕШЕН') return 'color-cyan'
  return 'color-green'
})

onUnmounted(() => { if (timerInterval) clearInterval(timerInterval) })
</script>

<style scoped>
.hack-container { background: #0d0d0d; border: 1px solid #333; border-radius: 4px; width: 700px; max-height: 90vh; overflow-y: auto; box-shadow: 0 0 50px rgba(0,0,0,0.95); font-family: 'Courier New', Courier, monospace; }

/* --- НОВАЯ ШАПКА --- */
.terminal-header { 
  background: #1a1a1a; color: #666; padding: 12px 20px; font-size: 12px; 
  border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;
  position: sticky; top: 0; z-index: 10;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.header-hint { color: #ffd700; font-weight: bold; letter-spacing: 0.5px; }
.blink { animation: blink 1s step-end infinite; color: #00ff00; }
@keyframes blink { 50% { opacity: 0; } }

.terminal-screen { background: #0a0a0a; padding: 20px; border-bottom: 1px solid #333; }
.screen-normal { color: #00ff00; } .screen-error { color: #ff3333; } .screen-success { color: #00ffff; } .screen-blocked { color: #ff0000; animation: pulse-red 1s infinite; }
@keyframes pulse-red { 0%, 100% { background: #0a0a0a; } 50% { background: #1a0505; } }

.status-line { margin-bottom: 20px; font-size: 14px; border-bottom: 1px solid #222; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
.color-red { color: #ff3333; font-weight: bold; } .color-green { color: #00ff00; font-weight: bold; } .color-cyan { color: #00ffff; font-weight: bold; }
.timer { color: #ffaa00; font-weight: bold; display: flex; align-items: center; gap: 8px; }
.penalty-hint { color: #ff6666; font-size: 11px; font-weight: normal; }

.code-container { display: flex; flex-direction: column; gap: 20px; }
.block-found { background: #003300; color: #00ff00; padding: 16px; text-align: center; font-size: 14px; border: 1px solid #00ff00; border-radius: 4px; }

.code-block-wrapper { border: 1px solid #333; border-radius: 4px; overflow: hidden; transition: all 0.3s; }
.code-block-wrapper.active-block { border-color: #00ff00; box-shadow: 0 0 15px rgba(0, 255, 0, 0.1); }
.code-block-wrapper.active-block.shake { animation: shake 0.4s; }
@keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }

.block-label { background: #1a1a1a; color: #888; padding: 6px 12px; font-size: 11px; border-bottom: 1px solid #333; }
.code-block { background: #0f0f0f; }
.code-line { display: flex; padding: 6px 12px; cursor: pointer; transition: background 0.15s; border-left: 3px solid transparent; }
.code-line:hover { background: #1a1a1a; border-left-color: #555; }
.code-line.selected { background: #003300; border-left-color: #00ff00; }
.code-line.wrong { background: #330000; border-left-color: #ff3333; }
.code-line.dummy { cursor: default; opacity: 0.3; }
.code-line.dummy:hover { background: transparent; border-left-color: transparent; }

.line-num { color: #666; margin-right: 16px; min-width: 30px; text-align: right; user-select: none; }
.code-text { color: #d4d4d4; flex: 1; }

.kw { color: #569cd6; } .bool { color: #569cd6; } .num { color: #b5cea8; } .str { color: #ce9178; } .comment { color: #6a9955; font-style: italic; } .func { color: #dcdcaa; }

.locked-block { opacity: 0.5; }
.locked-content { background: #050505; }

.info-panel { background: #111; padding: 16px 20px; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
.info-text { color: #00ff00; font-size: 14px; }
.info-text .critical { color: #ff0000; font-weight: bold; animation: blink 0.5s infinite; }
.retry-btn { background: #330000; border: 1px solid #ff3333; color: #ff6666; padding: 8px 20px; cursor: pointer; font-family: inherit; font-size: 12px; transition: all 0.2s; }
.retry-btn:hover { background: #ff3333; color: #fff; }
</style>