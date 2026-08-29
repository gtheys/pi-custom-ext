import { describe, expect, it } from 'bun:test'
import { parseSnippet } from './index.ts'

describe('parseSnippet', () => {
  it('parses frontmatter and body', () => {
    const snippet = parseSnippet(
      'concise.md',
      [
        '---',
        'name: concise',
        'description: Keep it short',
        'placement: prepend',
        'order: 10',
        '---',
        'Answer concisely.',
      ].join('\n'),
    )
    expect(snippet).toEqual({
      id: 'concise.md',
      name: 'concise',
      description: 'Keep it short',
      placement: 'prepend',
      order: 10,
      body: 'Answer concisely.',
    })
  })

  it('defaults placement to append, order to 9999, name to filename', () => {
    const snippet = parseSnippet(
      'raw.md',
      '---\ndescription: hi\n---\nJust a body.',
    )
    expect(snippet?.placement).toBe('append')
    expect(snippet?.order).toBe(9999)
    expect(snippet?.name).toBe('raw')
  })

  it('rejects files without frontmatter or body', () => {
    expect(parseSnippet('x.md', 'no frontmatter here')).toBeNull()
    expect(parseSnippet('x.md', '---\nname: x\n---\n')).toBeNull()
  })

  it('strips quotes and tolerates CRLF', () => {
    const snippet = parseSnippet(
      'q.md',
      '---\r\nname: "quoted"\r\norder: 5\r\n---\r\nBody text.',
    )
    expect(snippet?.name).toBe('quoted')
    expect(snippet?.order).toBe(5)
  })
})
