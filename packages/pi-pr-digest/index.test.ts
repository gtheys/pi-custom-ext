import { describe, expect, it } from 'bun:test'
import { BUILTIN_BOTS, classifyActivity, isBot } from './index.ts'

const bots = new Set(BUILTIN_BOTS)

describe('isBot', () => {
  it('flags [bot] suffix and known bot logins', () => {
    expect(isBot('renovate[bot]', bots)).toBe(true)
    expect(isBot('sonarqubecloud', bots)).toBe(true)
    expect(isBot('copilot-pull-request-reviewer', bots)).toBe(true)
    expect(isBot('gtheys', bots)).toBe(false)
  })
})

describe('classifyActivity', () => {
  it('ignores bot comments and reviews', () => {
    const result = classifyActivity(
      [{ author: { login: 'sonarqubecloud' } }],
      [
        {
          author: { login: 'copilot-pull-request-reviewer' },
          state: 'COMMENTED',
        },
      ],
      bots,
    )
    expect(result.hasHumanComments).toBe(false)
    expect(result.humanCommenters).toEqual([])
    expect(result.humanReviews).toEqual([])
  })

  it('dedupes human commenters and keeps review states', () => {
    const result = classifyActivity(
      [{ author: { login: 'alice' } }, { author: { login: 'alice' } }],
      [
        { author: { login: 'bob' }, state: 'APPROVED' },
        { author: { login: 'sonarqubecloud' }, state: 'COMMENTED' },
      ],
      bots,
    )
    expect(result.hasHumanComments).toBe(true)
    expect(result.humanCommenters).toEqual(['alice'])
    expect(result.humanReviews).toEqual([{ author: 'bob', state: 'APPROVED' }])
  })
})
