// `cloudflare:workers` for tests in plain Node: `env.DB` is D1's API over an in-memory SQLite (node:sqlite) built
// from `migrations/`, so server queries run for real. Only the calls Drizzle's D1 driver makes are here. `env.FILES`
// is R2 in memory: whole objects, one-page listing, ranged reads, and multipart uploads that fail like R2's when the upload is gone.
// `env.IMAGES` "encodes" by prefixing the bytes with what it was asked for, and refuses anything that isn't a PNG.
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

export const sqlite = new DatabaseSync(':memory:')
sqlite.exec('PRAGMA foreign_keys = ON')
for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'))

type Value = string | number | bigint | null | Uint8Array
class Statement {
  constructor(readonly query: string, readonly params: Value[] = []) {}
  bind(...params: Value[]) {
    return new Statement(this.query, params)
  }
  async all() {
    return { results: sqlite.prepare(this.query).all(...this.params), success: true, meta: {} }
  }
  async raw() {
    const statement = sqlite.prepare(this.query)
    statement.setReturnArrays(true)
    return statement.all(...this.params)
  }
  async first() {
    return sqlite.prepare(this.query).get(...this.params) ?? null
  }
  async run() {
    sqlite.prepare(this.query).run(...this.params)
    return { results: [], success: true, meta: {} }
  }
}

type Stored = { bytes: Uint8Array; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
type Range = { offset: number; length?: number } | { suffix: number }

/** What's in the bucket, by key. */
export const objects = new Map<string, Stored>()
/** Multipart uploads started and not yet completed or aborted, by upload ID. */
export const multiparts = new Map<string, { key: string; options?: Omit<Stored, 'bytes'>; parts: Map<number, Uint8Array<ArrayBuffer>> }>()
/** The R2 keys deleted so far. */
export const deletedKeys: string[] = []

const read = async (body: BodyInit) => new Uint8Array(await new Response(body).arrayBuffer())

/** A `Range: bytes=…` header as R2 reports it back. */
function rangeOf(header: string | null | undefined): Range | undefined {
  const [, start, end] = header?.match(/^bytes=(\d*)-(\d*)$/) ?? []
  if (start === undefined) return undefined
  if (!start) return { suffix: Number(end) }
  return end ? { offset: Number(start), length: Number(end) - Number(start) + 1 } : { offset: Number(start) }
}

function objectOf(key: string, stored: Stored, range?: Range) {
  const size = stored.bytes.byteLength
  const offset = !range ? 0 : 'suffix' in range ? Math.max(0, size - range.suffix) : range.offset
  const end = !range ? size : 'suffix' in range ? size : range.length === undefined ? size : offset + range.length
  return { key, size, httpEtag: `"${key}"`, httpMetadata: stored.httpMetadata, customMetadata: stored.customMetadata, range, body: new Blob([stored.bytes.slice(offset, end)]).stream() }
}

const PNG = [0x89, 0x50, 0x4e, 0x47]
export const env = {
  IMAGES: {
    input: (stream: ReadableStream) => {
      const steps: object[] = []
      const transformer = {
        transform: (step: object) => (steps.push(step), transformer),
        output: async (options: object) => {
          const bytes = await read(stream)
          if (!PNG.every((b, i) => bytes[i] === b)) throw new Error('ImagesError 9412: not an image')
          return { response: () => new Response(new Blob([JSON.stringify([...steps, options]), bytes])) }
        },
      }
      return transformer
    },
  },
  FILES: {
    put: async (key: string, body: BodyInit, options?: Omit<Stored, 'bytes'>) => void objects.set(key, { bytes: await read(body), ...options }),
    get: async (key: string, options?: { range?: Headers }) => {
      const stored = objects.get(key)
      return stored ? objectOf(key, stored, rangeOf(options?.range?.get('range'))) : null
    },
    list: async () => ({ objects: [...objects.keys()].map((key) => ({ key })), truncated: false, cursor: undefined }),
    delete: async (keys: string | string[]) => {
      for (const key of [keys].flat()) objects.delete(key), deletedKeys.push(key)
    },
    createMultipartUpload: async (key: string, options?: Omit<Stored, 'bytes'>) => {
      const uploadId = crypto.randomUUID()
      multiparts.set(uploadId, { key, options, parts: new Map() })
      return { key, uploadId }
    },
    resumeMultipartUpload: (key: string, uploadId: string) => {
      const upload = () => {
        const found = multiparts.get(uploadId)
        if (!found || found.key !== key) throw new Error('NoSuchUpload')
        return found
      }
      return {
        uploadPart: async (partNumber: number, body: BodyInit) => {
          upload().parts.set(partNumber, await read(body))
          return { partNumber, etag: `${uploadId}-${partNumber}` }
        },
        complete: async (parts: { partNumber: number; etag: string }[]) => {
          const { parts: sent, options } = upload()
          if (parts.some((p) => p.etag !== `${uploadId}-${p.partNumber}` || !sent.has(p.partNumber))) throw new Error('InvalidPart')
          const stored = { bytes: new Uint8Array(await new Blob(parts.map((p) => sent.get(p.partNumber)!)).arrayBuffer()), ...options }
          multiparts.delete(uploadId)
          objects.set(key, stored)
          return objectOf(key, stored)
        },
        abort: async () => void (upload(), multiparts.delete(uploadId)),
      }
    },
  },
  DB: {
    prepare: (query: string) => new Statement(query),
    batch: (statements: Statement[]) => Promise.all(statements.map((s) => s.all())),
  },
}
