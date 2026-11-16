export type ChangelogGroup = { kind: 'added' | 'changed' | 'removed' | 'fixed'; items: string[] }
export type ChangelogEntry = { version: string; /** LocalDate from the release heading. */ date?: string; title: string; groups: ChangelogGroup[] }

// Injected at build time from CHANGELOG.md (vite.config.ts). Don't edit entries anywhere else.
declare const __CHANGELOG__: ChangelogEntry[]

/** Newest first. */
// Undefined where the parser runs on its own (vite.config.ts, tests).
export const CHANGELOG: ChangelogEntry[] = typeof __CHANGELOG__ === 'undefined' ? [] : __CHANGELOG__

const HEADING = /^\[?(\d+\.\d+\.\d+)\]?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/
const MAX_BULLET = 120
const KINDS = new Set<string>(['added', 'changed', 'removed', 'fixed'])

/** One entry per released version, newest first (`[Unreleased]` is skipped): the summary line under the heading is
 *  its title, the bullets under each `###` its groups. Throws on a bullet past one line, so the page stays scannable. */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const tooLong = markdown.split('\n').filter((line) => line.startsWith('- ') && line.length - 2 > MAX_BULLET)
  if (tooLong.length > 0) throw new Error(`CHANGELOG.md bullets must be ${MAX_BULLET} characters or fewer:\n${tooLong.join('\n')}`)

  return markdown.split(/^## /m).slice(1).flatMap((block) => {
    const [heading = '', ...lines] = block.split('\n')
    const [, version, date] = HEADING.exec(heading) ?? []
    if (!version) return []
    const groups: ChangelogGroup[] = []
    let title: string | undefined
    for (const raw of lines) {
      const line = raw.trim()
      if (line.startsWith('### ')) {
        const kind = line.slice(4).trim().toLowerCase()
        if (KINDS.has(kind)) groups.push({ kind: kind as ChangelogGroup['kind'], items: [] })
      } else if (line.startsWith('- ')) groups.at(-1)?.items.push(line.slice(2).trim())
      else if (line && !title && !line.startsWith('[')) title = line
    }
    return [{ version: `v${version}`, date, title: title ?? 'Improvements and fixes', groups: groups.filter((g) => g.items.length > 0) }]
  })
}
