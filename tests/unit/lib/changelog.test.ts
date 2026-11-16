import { describe, expect, it } from 'vitest'

import { parseChangelog } from '#/lib/changelog'

describe('parseChangelog', () => {
  it('keeps the summary, date and grouped bullets, and skips Unreleased', () => {
    const entries = parseChangelog(['## [Unreleased]', '', '### Added', '', '- Soon', '', '## [1.2.0] - 2026-09-21', '', 'A calmer room', '', '### Added', '', '- One', '- Two', '', '### Fixed', '', '- Three'].join('\n'))
    expect(entries).toEqual([{ version: 'v1.2.0', date: '2026-09-21', title: 'A calmer room', groups: [{ kind: 'added', items: ['One', 'Two'] }, { kind: 'fixed', items: ['Three'] }] }])
  })

  it('rejects bullets longer than one line', () => {
    expect(() => parseChangelog(`## [1.0.0]\n\n### Fixed\n\n- ${'x'.repeat(121)}`)).toThrow(/120 characters/)
  })
})
