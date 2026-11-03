import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

import type { VersionRow } from '#/server/releases'
import { downloadUrl, readFile } from '../../lib/files'
import { Button } from '../primitives'
import { Reading } from './LicenseControl'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

// A license is the artist's own upload, but a PDF can still carry forms and links: no XFA, and no annotation layer,
// so nothing in it can navigate or run. Its text layer stays, so terms can be selected and copied.
const PDF_OPTIONS = { enableXfa: false }

/** A Word document's text, in a frame with no scripts, no origin and nowhere to go: links open nothing. */
const wordPage = (html: string) => `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<base target="_blank"><style>
  :root { color-scheme: light; font: 15px/1.6 system-ui, sans-serif; }
  body { margin: 0 auto; max-width: 46rem; padding: 2.5rem 2rem; background: Canvas; color: CanvasText; }
  img { max-width: 100%; height: auto; } table { border-collapse: collapse; } td, th { border: 1px solid GrayText; padding: .35rem .5rem; }
</style></head><body>${html}</body></html>`

/** One license, read in place: a PDF page by page at the panel's width, a .docx as its text. A .doc (Word 97–2003)
 *  can't be read in a browser, so it says so and offers the file. Loaded lazily by LicenseControl. */
export default function LicenseDocument({ version }: { version: VersionRow }) {
  const [state, setState] = useState<{ status: 'reading' } | { status: 'pdf'; data: Uint8Array } | { status: 'word'; html: string } | { status: 'failed' }>({ status: 'reading' })
  const word = version.content_type === 'application/msword'

  useEffect(() => {
    if (word) return
    let live = true
    void (async () => {
      try {
        const bytes = await readFile(version.id)
        if (version.content_type === 'application/pdf') return live && setState({ status: 'pdf', data: new Uint8Array(bytes) })
        const mammoth = await import('mammoth')
        const { value } = await mammoth.convertToHtml({ arrayBuffer: bytes })
        if (live) setState({ status: 'word', html: value })
      } catch {
        if (live) setState({ status: 'failed' })
      }
    })()
    return () => void (live = false)
  }, [version.id, version.content_type, word])

  if (word) return <Unreadable version={version}>A Word 97–2003 document opens in Word, not here. Download it to read it.</Unreadable>
  if (state.status === 'failed') return <Unreadable version={version}>Couldn’t read this license here. It’s stored as uploaded: download it to open it.</Unreadable>
  if (state.status === 'reading') return <Reading />
  if (state.status === 'word') return <iframe title={`License: ${version.filename}`} sandbox="" srcDoc={wordPage(state.html)} className="block h-full min-h-[60dvh] w-full rounded-2xl" />
  return <PdfPages data={state.data} />
}

/** Every page, fitted to the panel's width as it resizes. */
function PdfPages({ data }: { data: Uint8Array }) {
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [pages, setPages] = useState(0)
  // pdf.js takes the bytes to its worker, so the same object must survive re-renders.
  const file = useMemo(() => ({ data }), [data])

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(frame.current!)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={frame} className="flex flex-col items-center gap-3 p-3 sm:p-4">
      <Document file={file} options={PDF_OPTIONS} onLoadSuccess={({ numPages }) => setPages(numPages)} loading={<Reading />} error={<Reading>Couldn’t read this PDF here. Download it to open it.</Reading>}>
        {width > 0 &&
          Array.from({ length: pages }, (_, i) => (
            <Page key={i} pageNumber={i + 1} width={width} renderAnnotationLayer={false} className="mb-3 overflow-hidden rounded-xl shadow-lg last:mb-0" loading={null} />
          ))}
      </Document>
    </div>
  )
}

function Unreadable({ version, children }: { version: VersionRow; children: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="max-w-sm text-[15px] text-ink-soft">{children}</p>
      <Button asChild variant="secondary">
        <a href={downloadUrl(version.id)} download={version.filename}>Download {version.filename}</a>
      </Button>
    </div>
  )
}
