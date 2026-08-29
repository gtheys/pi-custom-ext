import { describe, expect, it } from 'bun:test'
import {
  type AskAnswer,
  formatAnswerForModel,
  getOtherLabel,
  normalizeOptions,
  sortAnswers,
} from './index.ts'

describe('normalizeOptions', () => {
  it('trims labels, defaults value to label, drops empty labels', () => {
    const result = normalizeOptions([
      { label: '  Postgres  ', description: '  relational ' },
      { label: 'SQLite', value: ' sqlite ' },
      { label: '   ' },
    ])
    expect(result).toEqual([
      { label: 'Postgres', value: 'Postgres', description: 'relational' },
      { label: 'SQLite', value: 'sqlite', description: undefined },
    ])
  })

  it('handles undefined input', () => {
    expect(normalizeOptions(undefined)).toEqual([])
  })
})

describe('getOtherLabel', () => {
  it('avoids collision with a user-supplied "Other" option', () => {
    expect(getOtherLabel([{ label: 'Other', value: 'x' }])).toBe(
      'Other (custom)',
    )
    expect(getOtherLabel([{ label: 'Postgres', value: 'x' }])).toBe('Other')
  })
})

describe('sortAnswers', () => {
  it('orders options by index, other second-to-last, text last', () => {
    const answers: AskAnswer[] = [
      { type: 'other', label: 'custom', value: 'custom' },
      { type: 'option', label: 'B', value: 'b', index: 2 },
      { type: 'option', label: 'A', value: 'a', index: 1 },
      { type: 'text', label: 'free', value: 'free' },
    ]
    const sorted = sortAnswers(answers)
    expect(sorted.map((a) => a.type)).toEqual([
      'option',
      'option',
      'other',
      'text',
    ])
    expect((sorted[0] as { index: number }).index).toBe(1)
  })
})

describe('formatAnswerForModel', () => {
  it('formats each answer kind', () => {
    expect(
      formatAnswerForModel({ type: 'text', label: 'hello', value: 'hello' }),
    ).toBe('hello')
    expect(
      formatAnswerForModel({ type: 'other', label: 'mine', value: 'mine' }),
    ).toBe('Other: mine')
    expect(
      formatAnswerForModel({
        type: 'option',
        label: 'Postgres',
        value: 'pg',
        index: 2,
      }),
    ).toBe('2. Postgres')
  })
})
