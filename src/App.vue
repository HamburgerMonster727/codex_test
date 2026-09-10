<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BOARD_SIZE, createSnakeGame } from './game/snakeGame.js'

const HIGH_SCORE_KEY = 'neon-snake-high-score'
const canvasRef = ref(null)
const boardRef = ref(null)
let timerId = null
let resizeObserver = null
let sessionHighScore = 0

try {
  sessionHighScore = Math.max(0, Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0)
} catch {}

const game = reactive({})
const engine = createSnakeGame({ highScore: sessionHighScore, state: game })
let webMcpLifecycle = null

const phaseLabel = computed(() => ({
  ready: '准备就绪',
  running: '正在运行',
  paused: '游戏暂停',
  over: '本局结束',
}[game.phase]))

const overlay = computed(() => ({
  ready: { eyebrow: 'NEON GRID ONLINE', title: '按空格开始', detail: '用方向键或 WASD 控制蛇的方向' },
  paused: { eyebrow: 'SYSTEM HOLD', title: '游戏暂停', detail: '再次按空格继续' },
  over: { eyebrow: 'SIGNAL LOST', title: '本局结束', detail: `最终得分 ${game.score} · 按 Enter 重新开始` },
}[game.phase]))

function persistHighScore() {
  sessionHighScore = Math.max(sessionHighScore, game.highScore)
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(sessionHighScore))
  } catch {}
}

function stopLoop() {
  if (timerId !== null) {
    window.clearTimeout(timerId)
    timerId = null
  }
}

function runLoop() {
  stopLoop()
  if (game.phase !== 'running') return
  timerId = window.setTimeout(() => {
    engine.step()
    if (game.highScore > sessionHighScore) persistHighScore()
    if (game.phase === 'running') runLoop()
  }, game.speed)
}

function toggleGame() {
  if (game.phase === 'ready' || game.phase === 'paused') {
    engine.start()
    runLoop()
  } else if (game.phase === 'running') {
    engine.pause()
    stopLoop()
  }
}

function restartGame() {
  stopLoop()
  engine.reset()
  engine.start()
  runLoop()
}

const directionKeys = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
}

function handleKeydown(event) {
  if (directionKeys[event.key]) {
    event.preventDefault()
    engine.changeDirection(directionKeys[event.key])
    if (game.phase === 'ready') {
      engine.start()
      runLoop()
    }
    return
  }
  if (event.code === 'Space') {
    event.preventDefault()
    if (game.phase !== 'over') toggleGame()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    restartGame()
  }
}

function handleBlur() {
  if (game.phase === 'running') {
    engine.pause()
    stopLoop()
  }
}

function registerWebMcp() {
  const context = document.modelContext
  if (!context?.registerTool) return
  webMcpLifecycle = new AbortController()
  const reportError = () => {}
  try {
    void Promise.resolve(context.registerTool({
      name: 'control_snake_game',
      title: '控制贪吃蛇游戏',
      description: '开始、暂停或重新开始当前贪吃蛇游戏，并返回更新后的可见游戏状态。',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['start', 'pause', 'restart'] },
        },
        required: ['action'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !['start', 'pause', 'restart'].includes(input.action)) {
          throw new TypeError('action 必须是 start、pause 或 restart')
        }
        if (input.action === 'restart') restartGame()
        else if (input.action === 'pause') {
          engine.pause()
          stopLoop()
        } else if (game.phase !== 'over') {
          engine.start()
          runLoop()
        }
        return { phase: game.phase, score: game.score, highScore: game.highScore }
      },
    }, { signal: webMcpLifecycle.signal })).catch(reportError)
  } catch {
    webMcpLifecycle.abort()
    webMcpLifecycle = null
  }
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const board = boardRef.value
  if (!canvas || !board) return
  const size = Math.floor(Math.min(board.clientWidth, board.clientHeight))
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = size * ratio
  canvas.height = size * ratio
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  drawGame()
}

function roundedCell(ctx, x, y, size, radius) {
  const gap = Math.max(1.5, size * 0.11)
  ctx.beginPath()
  ctx.roundRect(x * size + gap, y * size + gap, size - gap * 2, size - gap * 2, radius)
}

function drawGame() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const pixelSize = canvas.width
  const cell = pixelSize / BOARD_SIZE
  const ratio = Math.min(window.devicePixelRatio || 1, 2)

  ctx.clearRect(0, 0, pixelSize, pixelSize)
  ctx.fillStyle = '#070c13'
  ctx.fillRect(0, 0, pixelSize, pixelSize)

  ctx.strokeStyle = 'rgba(111, 255, 211, 0.065)'
  ctx.lineWidth = ratio
  for (let i = 1; i < BOARD_SIZE; i += 1) {
    const point = Math.round(i * cell) + 0.5
    ctx.beginPath(); ctx.moveTo(point, 0); ctx.lineTo(point, pixelSize); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, point); ctx.lineTo(pixelSize, point); ctx.stroke()
  }

  if (game.food) {
    const cx = (game.food.x + 0.5) * cell
    const cy = (game.food.y + 0.5) * cell
    ctx.save()
    ctx.shadowColor = '#ff3ca6'
    ctx.shadowBlur = cell * 0.55
    ctx.fillStyle = '#ff3ca6'
    ctx.beginPath()
    ctx.arc(cx, cy, cell * 0.29, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffd1eb'
    ctx.beginPath()
    ctx.arc(cx - cell * 0.09, cy - cell * 0.1, cell * 0.075, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  game.snake.forEach((segment, index) => {
    ctx.save()
    if (index === 0) {
      ctx.shadowColor = '#7dffd5'
      ctx.shadowBlur = cell * 0.52
      ctx.fillStyle = '#b8ffe8'
    } else {
      const alpha = Math.max(0.38, 0.9 - index * 0.025)
      ctx.fillStyle = `rgba(41, 238, 176, ${alpha})`
    }
    roundedCell(ctx, segment.x, segment.y, cell, cell * 0.2)
    ctx.fill()
    ctx.restore()
  })
}

watch(game, () => nextTick(drawGame), { deep: true })

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, { passive: false })
  window.addEventListener('blur', handleBlur)
  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(boardRef.value)
  nextTick(resizeCanvas)
  registerWebMcp()
})

onBeforeUnmount(() => {
  stopLoop()
  persistHighScore()
  webMcpLifecycle?.abort()
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('blur', handleBlur)
})
</script>

<template>
  <main class="game-shell">
    <section class="game-card" aria-labelledby="game-title">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <div>
            <p class="kicker">ARCADE / 01</p>
            <h1 id="game-title">爆炫贪吃蛇</h1>
          </div>
        </div>

        <div class="status" aria-live="polite">
          <span class="status-dot" :class="{ active: game.phase === 'running' }"></span>
          {{ phaseLabel }}
        </div>
      </header>

      <div class="content-grid">
        <aside class="score-panel" aria-label="游戏数据">
          <div class="score-block primary-score">
            <span>吃了多少个</span>
            <strong>{{ String(game.score).padStart(2, '0') }}</strong>
          </div>
          <div class="score-block">
            <span>最高得分</span>
            <strong>{{ String(game.highScore).padStart(2, '0') }}</strong>
          </div>
          <div class="speed-block">
            <div class="speed-heading"><span>速度等级</span><b>{{ Math.floor((165 - game.speed) / 12) + 1 }}</b></div>
            <div class="speed-track"><i :style="{ width: `${Math.min(100, 18 + ((165 - game.speed) / 95) * 82)}%` }"></i></div>
          </div>
          <p class="tiny-note">每吃 5 个能量核心，移动速度提升一级。</p>
        </aside>

        <div ref="boardRef" class="board-wrap">
          <canvas ref="canvasRef" tabindex="0" aria-label="贪吃蛇游戏区域，使用方向键或 WASD 操作"></canvas>
          <Transition name="overlay">
            <div v-if="game.phase !== 'running'" class="game-overlay">
              <p>{{ overlay.eyebrow }}</p>
              <h2>{{ overlay.title }}</h2>
              <span>{{ overlay.detail }}</span>
            </div>
          </Transition>
          <span class="corner corner-tl"></span><span class="corner corner-tr"></span>
          <span class="corner corner-bl"></span><span class="corner corner-br"></span>
        </div>

        <aside class="control-panel" aria-label="操作说明">
          <div>
            <p class="panel-label">方向控制</p>
            <div class="keys arrows" aria-label="方向键">
              <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>
            </div>
            <span class="or">或</span>
            <div class="keys wasd" aria-label="WASD 键">
              <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
            </div>
          </div>
          <div class="action-keys">
            <p><kbd>SPACE</kbd><span>开始 / 暂停</span></p>
            <p><kbd>ENTER</kbd><span>重新开始</span></p>
          </div>
        </aside>
      </div>

      <footer>
        <span><i></i> 目标：收集洋红能量核心</span>
        <span>避免撞上边界与自己的轨迹</span>
      </footer>
    </section>
  </main>
</template>
