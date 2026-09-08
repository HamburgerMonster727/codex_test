export const BOARD_SIZE = 20
export const INITIAL_SPEED = 165
export const MIN_SPEED = 70

export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
})

const STARTING_SNAKE = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
]

const samePosition = (a, b) => a.x === b.x && a.y === b.y
const cloneSnake = () => STARTING_SNAKE.map((segment) => ({ ...segment }))

export function speedForScore(score) {
  return Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(score / 5) * 12)
}

export function createFood(snake, random = Math.random, boardSize = BOARD_SIZE) {
  const freeCells = []
  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        freeCells.push({ x, y })
      }
    }
  }
  if (!freeCells.length) return null
  return freeCells[Math.floor(random() * freeCells.length)]
}

export function createSnakeGame(options = {}) {
  const random = options.random ?? Math.random
  const boardSize = options.boardSize ?? BOARD_SIZE
  const initialHighScore = Math.max(0, Number(options.highScore) || 0)

  const state = options.state ?? {}
  state.highScore = initialHighScore

  const reset = () => {
    state.snake = cloneSnake()
    state.direction = { ...DIRECTIONS.right }
    state.pendingDirection = { ...DIRECTIONS.right }
    state.score = 0
    state.highScore = Math.max(state.highScore || 0, initialHighScore)
    state.speed = INITIAL_SPEED
    state.phase = 'ready'
    state.food = createFood(state.snake, random, boardSize)
    return state
  }

  const start = () => {
    if (state.phase === 'ready' || state.phase === 'paused') state.phase = 'running'
    return state.phase
  }

  const pause = () => {
    if (state.phase === 'running') state.phase = 'paused'
    return state.phase
  }

  const changeDirection = (nextDirection) => {
    const next = typeof nextDirection === 'string' ? DIRECTIONS[nextDirection] : nextDirection
    if (!next) return false
    const current = state.direction
    if (current.x + next.x === 0 && current.y + next.y === 0) return false
    state.pendingDirection = { ...next }
    return true
  }

  const step = () => {
    if (state.phase !== 'running') return { moved: false, ate: false }

    state.direction = { ...state.pendingDirection }
    const head = state.snake[0]
    const nextHead = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    }
    const ate = state.food && samePosition(nextHead, state.food)
    const bodyToCheck = ate ? state.snake : state.snake.slice(0, -1)
    const hitWall = nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= boardSize || nextHead.y >= boardSize
    const hitSelf = bodyToCheck.some((segment) => samePosition(segment, nextHead))

    if (hitWall || hitSelf) {
      state.phase = 'over'
      return { moved: false, ate: false, collision: hitWall ? 'wall' : 'self' }
    }

    state.snake = [nextHead, ...state.snake]
    if (ate) {
      state.score += 1
      state.highScore = Math.max(state.highScore, state.score)
      state.speed = speedForScore(state.score)
      state.food = createFood(state.snake, random, boardSize)
      if (!state.food) state.phase = 'over'
    } else {
      state.snake.pop()
    }

    return { moved: true, ate: Boolean(ate) }
  }

  reset()
  return { state, start, pause, reset, changeDirection, step }
}
