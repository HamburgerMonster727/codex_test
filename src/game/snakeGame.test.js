import { describe, expect, it } from 'vitest'
import { DIRECTIONS, INITIAL_SPEED, createFood, createSnakeGame, speedForScore } from './snakeGame.js'

describe('snake game engine', () => {
  it('moves one grid cell on each running step', () => {
    const game = createSnakeGame({ random: () => 0 })
    game.start()
    game.step()
    expect(game.state.snake[0]).toEqual({ x: 11, y: 10 })
    expect(game.state.snake).toHaveLength(3)
  })

  it('does not advance while paused', () => {
    const game = createSnakeGame()
    game.start()
    game.pause()
    const before = game.state.snake.map((segment) => ({ ...segment }))
    expect(game.step().moved).toBe(false)
    expect(game.state.snake).toEqual(before)
  })

  it('rejects a direct reverse direction', () => {
    const game = createSnakeGame()
    expect(game.changeDirection('left')).toBe(false)
    expect(game.state.pendingDirection).toEqual(DIRECTIONS.right)
  })

  it('grows, scores, and creates new food after eating', () => {
    const game = createSnakeGame({ random: () => 0, highScore: 0 })
    game.state.food = { x: 11, y: 10 }
    game.start()
    expect(game.step().ate).toBe(true)
    expect(game.state.snake).toHaveLength(4)
    expect(game.state.score).toBe(1)
    expect(game.state.highScore).toBe(1)
    expect(game.state.snake).not.toContainEqual(game.state.food)
  })

  it('ends on a wall collision', () => {
    const game = createSnakeGame()
    game.state.snake = [{ x: 19, y: 10 }, { x: 18, y: 10 }]
    game.start()
    expect(game.step().collision).toBe('wall')
    expect(game.state.phase).toBe('over')
  })

  it('ends on a self collision', () => {
    const game = createSnakeGame()
    game.state.snake = [
      { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 },
    ]
    game.state.direction = { ...DIRECTIONS.up }
    game.state.pendingDirection = { ...DIRECTIONS.left }
    game.start()
    expect(game.step().collision).toBe('self')
    expect(game.state.phase).toBe('over')
  })

  it('only places food on an unoccupied cell', () => {
    const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
    expect(createFood(snake, () => 0, 2)).toEqual({ x: 1, y: 1 })
  })

  it('increases speed in score bands and respects the cap', () => {
    expect(speedForScore(0)).toBe(INITIAL_SPEED)
    expect(speedForScore(5)).toBeLessThan(INITIAL_SPEED)
    expect(speedForScore(999)).toBe(70)
  })

  it('resets the round while preserving the high score', () => {
    const game = createSnakeGame({ highScore: 12 })
    game.state.score = 8
    game.state.phase = 'over'
    game.reset()
    expect(game.state.score).toBe(0)
    expect(game.state.highScore).toBe(12)
    expect(game.state.phase).toBe('ready')
  })
})
