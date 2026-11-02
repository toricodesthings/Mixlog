/**
 * Lyrics as Musixmatch writes them: plain lines, a section's tag (`#VERSE`) on its own line above it, a blank line
 * between sections. So lyrics pasted from Musixmatch arrive whole, and lyrics written here paste straight back.
 */

export const SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Hook', 'Bridge', 'Outro', 'Instrumental'] as const
export type Section = (typeof SECTIONS)[number]

export const tagOf = (section: Section) => `#${section.toUpperCase()}`
/** A line that's a section tag: `#` and a word, alone on its line (`#VERSE`, `#pre-chorus`). */
export const isTag = (line: string) => /^#[A-Za-z][\w-]*\s*$/.test(line)

/**
 * Marks the section the cursor (`at`) is in with `section`: the tag goes on its own line above the cursor's line,
 * a blank line before it; a blank line becomes the tag; a line already under a tag has its tag changed. The cursor
 * stays where it was in the text.
 */
export function markSection(text: string, at: number, section: Section): { text: string; at: number } {
  const lines = text.split('\n')
  const before = text.slice(0, at).split('\n')
  let row = before.length - 1
  let column = before[row].length
  const tag = tagOf(section)

  let place: number
  if (isTag(lines[row])) {
    lines[row] = tag
    column = tag.length
    place = row
  } else if (!lines[row].trim()) {
    lines[row] = tag
    if (row === lines.length - 1) lines.push('')
    place = row
    row += 1 // write on under the tag
    column = 0
  } else if (row > 0 && isTag(lines[row - 1])) {
    lines[row - 1] = tag
    place = row - 1
  } else {
    lines.splice(row, 0, tag)
    place = row
    row += 1
  }
  if (place > 0 && lines[place - 1].trim()) {
    lines.splice(place, 0, '')
    row += 1
  }
  const offset = lines.slice(0, row).reduce((sum, line) => sum + line.length + 1, 0)
  return { text: lines.join('\n'), at: offset + column }
}

/** The opening lines, for a folded preview: tags and words, blank lines skipped. */
export const previewOf = (lyrics: string, count = 3) =>
  lyrics
    .split('\n')
    .filter((line) => line.trim())
    .slice(0, count)

export const countOf = (lyrics: string) => {
  const lines = lyrics.split('\n').filter((line) => line.trim() && !isTag(line))
  return { lines: lines.length, words: lines.reduce((sum, line) => sum + line.split(/\s+/).filter(Boolean).length, 0) }
}
