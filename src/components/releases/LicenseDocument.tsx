import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import 'react-pdf/dist/Page/TextLayer.css'

import type { VersionRow } from '#/server/releases'
import { downloadUrl, readFile } from '../../lib/files'
import { Button } from '../primitives'
import { ViewerBar, ViewerDivider, ViewerTool, ZoomTools, useZoom } from '../shared/Viewer'
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

/** One license, read in place: a PDF as pages on a desk with zoom and paging, a .docx as its text. A .doc (Word
 *  97–2003) can't be read in a browser, so it says so and offers the file. Loaded lazily by LicenseControl. */
export default function LicenseDocument({ version }: { version: VersionRow }) {
  const [state, setState] = useState<{ status: 'reading'; arrived: number } | { status: 'pdf'; data: Uint8Array } | { status: 'word'; html: string } | { status: 'failed' }>({ status: 'reading', arrived: 0 })
  const word = version.content_type === 'application/msword'

  useEffect(() => {
    if (word) return
    let live = true
    void (async () => {
      try {
        const bytes = await readFile(version.id, version.size, (arrived) => live && setState({ status: 'reading', arrived }))
        if (version.content_type === 'application/pdf') return live && setState({ status: 'pdf', data: new Uint8Array(bytes) })
        const mammoth = await import('mammoth')
        const { value } = await mammoth.convertToHtml({ arrayBuffer: bytes })
        if (live) setState({ status: 'word', html: value })
      } catch {
        if (live) setState({ status: 'failed' })
      }
    })()
    return () => void (live = false)
  }, [version.id, version.size, version.content_type, word])

  if (word) return <Unreadable version={version}>A Word 97–2003 document opens in Word, not here. Download it to read it.</Unreadable>
  if (state.status === 'failed') return <Unreadable version={version}>Couldn’t read this license here. It’s stored as uploaded: download it to open it.</Unreadable>
  if (state.status === 'reading') return <Reading arrived={state.arrived} />
  if (state.status === 'word') return <iframe title={`License: ${version.filename}`} sandbox="" srcDoc={wordPage(state.html)} className="block size-full" />
  return <PdfPages data={state.data} version={version} />
}

/**
 * The pages on a desk, each laid out at its own size before pdf.js draws it, so nothing moves as they arrive. The
 * reading stays over them until the first is drawn. The bar pages through them and zooms (`useZoom`), fit to width first.
 */
function PdfPages({ data, version }: { data: Uint8Array; version: VersionRow }) {
  const scroller = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  // pdf.js takes the bytes to its worker, so the same object must survive re-renders.
  const file = useMemo(() => ({ data }), [data])
  const [sizes, setSizes] = useState<{ width: number; height: number }[] | null>(null)
  const [painted, setPainted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [current, setCurrent] = useState(1)
  const widest = sizes ? sizes.reduce((a, b) => (b.width > a.width ? b : a)) : null
  // 100% is printed size: pdf.js draws 1pt as 1px, and a point is 96/72 of a CSS pixel, as in Preview and Chrome.
  const zoom = useZoom(scroller, widest, 'width', 96 / 72)
  const scale = zoom.scale

  const loaded = async (pdf: PDFDocumentProxy) => {
    const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1)))
    setSizes(pages.map((p) => p.getViewport({ scale: 1 })))
  }
  /** The page whose top has passed a third of the way down the view is the one being read. */
  const track = () => {
    const el = scroller.current!
    const line = el.scrollTop + el.clientHeight / 3
    setCurrent(Math.max(1, pageRefs.current.filter((p) => p && p.offsetTop <= line).length))
  }
  const go = (page: number) => pageRefs.current[page - 1]?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  if (failed) return <Unreadable version={version}>Couldn’t read this PDF here. Download it to open it.</Unreadable>
  const pages = sizes?.length ?? 0
  return (
    <div className="relative size-full">
      <div ref={scroller} onScroll={track} className="size-full overflow-auto overscroll-contain [scrollbar-gutter:stable_both-edges]">
        <Document file={file} options={PDF_OPTIONS} onLoadSuccess={(pdf) => void loaded(pdf)} onLoadError={() => setFailed(true)} loading={null} error={null}>
          <div className="mx-auto flex w-fit min-w-full flex-col items-center gap-4 px-4 pt-[calc(env(safe-area-inset-top)+var(--chrome,0px))] pb-28 sm:gap-6 sm:px-8 sm:pt-8">
            {scale > 0 &&
              sizes!.map((size, i) => (
                // The paper is laid down at its size first; the page draws onto it, so arriving never flashes.
                <div key={i} ref={(el) => void (pageRefs.current[i] = el)} className="relative shrink-0 overflow-hidden rounded-md bg-white shadow-[0_18px_44px_-18px_rgb(0_0_0/0.6)] ring-1 ring-black/10" style={{ width: Math.round(size.width * scale), height: Math.round(size.height * scale) }}>
                  <Page pageNumber={i + 1} width={Math.round(size.width * scale)} renderAnnotationLayer={false} loading={null} onRenderSuccess={i === 0 ? () => setPainted(true) : undefined} />
                </div>
              ))}
          </div>
        </Document>
      </div>

      {!painted && <Reading arrived={1} className="absolute inset-0 bg-room-void" />}

      {pages > 0 && (
        <ViewerBar shown={painted}>
          <ViewerTool label="Previous page" onClick={() => go(current - 1)} disabled={current <= 1}><ChevronUp size={16} /></ViewerTool>
          <span data-numeric className="readout min-w-14 text-center text-ink-soft" aria-live="polite">
            <span className="sr-only">Page </span><span className="text-ink">{current}</span> / {pages}
          </span>
          <ViewerTool label="Next page" onClick={() => go(current + 1)} disabled={current >= pages}><ChevronDown size={16} /></ViewerTool>
          <ViewerDivider />
          <ZoomTools zoom={zoom} />
        </ViewerBar>
      )}
    </div>
  )
}

function Unreadable({ version, children }: { version: VersionRow; children: string }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="max-w-sm text-[0.9375rem] text-ink-soft">{children}</p>
      <Button asChild variant="secondary">
        <a href={downloadUrl(version.id)} download={version.filename}>Download {version.filename}</a>
      </Button>
    </div>
  )
}
