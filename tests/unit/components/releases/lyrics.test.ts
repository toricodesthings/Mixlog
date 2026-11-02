import { describe, expect, it } from 'vitest'

import { countOf, isTag, markSection, previewOf } from '#/components/releases/lyrics'

const cursor = (text: string) => ({ text: text.replace('|', ''), at: text.indexOf('|') })
const mark = (text: string, section: Parameters<typeof markSection>[2]) => {
  const before = cursor(text)
  const after = markSection(before.text, before.at, section)
  return after.text.slice(0, after.at) + '|' + after.text.slice(after.at)
}

describe('lyrics', () => {
  it('reads Musixmatch tags', () => {
    expect(isTag('#VERSE')).toBe(true)
    expect(isTag('#pre-chorus ')).toBe(true)
    expect(isTag('#1 hit')).toBe(false)
    expect(isTag('a #VERSE')).toBe(false)
  })

  it('tags the section the cursor is in, a blank line before it', () => {
    expect(mark('|', 'Intro')).toBe('#INTRO\n|')
    expect(mark('Line one|', 'Verse')).toBe('#VERSE\nLine one|')
    expect(mark('Line one\nLi|ne two', 'Chorus')).toBe('Line one\n\n#CHORUS\nLi|ne two')
    expect(mark('Line one\n|', 'Chorus')).toBe('Line one\n\n#CHORUS\n|')
    expect(mark('Line one\n\n|\nLine two', 'Bridge')).toBe('Line one\n\n#BRIDGE\n|Line two')
  })

  it('changes a tag rather than stacking another', () => {
    expect(mark('#VERSE\nLine| one', 'Chorus')).toBe('#CHORUS\nLine| one')
    expect(mark('#VER|SE\nLine one', 'Hook')).toBe('#HOOK|\nLine one')
  })

  it('previews and counts the words, not the tags', () => {
    expect(previewOf('#VERSE\n\nOne two\nThree\nFour')).toEqual(['#VERSE', 'One two', 'Three'])
    expect(countOf('#VERSE\nOne two\n\nThree')).toEqual({ lines: 2, words: 3 })
  })
})
