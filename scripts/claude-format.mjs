// Claude Code hooks (.claude/settings.json): `queue` notes each file Claude edits, `flush` formats them all once when
// Claude stops, so no edit mid-task meets a file reformatted under it.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const queue = join(root, 'node_modules/.cache/claude-format-queue')

if (process.argv[2] === 'queue') {
  const file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path
  if (file && !relative(root, file).startsWith('..')) {
    mkdirSync(dirname(queue), { recursive: true })
    appendFileSync(queue, `${file}\n`)
  }
} else if (process.argv[2] === 'flush' && existsSync(queue)) {
  const files = [...new Set(readFileSync(queue, 'utf8').split('\n'))].filter((f) => f && existsSync(f))
  rmSync(queue)
  if (files.length)
    execFileSync(join(root, 'node_modules/.bin/oxfmt'), ['--no-error-on-unmatched-pattern', ...files], {
      cwd: root,
      stdio: 'inherit',
    })
}
