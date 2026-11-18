import { X } from 'lucide-react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../primitives/Dialog'
import { UtilitySheet } from '../shared/UtilitySheet'
import { AboutTab } from '../settings/tabs/AboutTab'

/** Settings' About, on its own, over the public meter: a sheet on compact, the same large dialog as Settings on a wide
 *  screen. The public host serves no other page, so the changelog link is left out. */
export function MeterAbout({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shell = useShellMode()
  if (shell.isCompact)
    return (
      <UtilitySheet open={open} title="About Mixlog" onClose={onClose}>
        <div className="mobile-settings-content">
          <AboutTab meter />
        </div>
      </UtilitySheet>
    )
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="block min-w-0 !bg-panel-raised ![backdrop-filter:none] ![-webkit-backdrop-filter:none] !max-w-none gap-0 overflow-hidden rounded-[2rem] p-0 outline-hidden !translate-x-[-50%] !translate-y-[-50%] !left-[50%] !top-[50%]"
        style={{ width: 'min(calc(100vw - 2rem), 1720px)', height: 'calc(100vh - 2rem)' }}
        hideCloseButton
      >
        <DialogTitle className="sr-only">About Mixlog</DialogTitle>
        <DialogDescription className="sr-only">Who made Mixlog, and where to find it.</DialogDescription>
        <div className="settings-content-bg relative flex h-full min-w-0 flex-col items-stretch overflow-y-auto">
          <button type="button" className="group absolute right-6 top-6 z-10 flex cursor-pointer flex-col items-center gap-2" onClick={onClose} aria-label="Close about">
            <div className="btn-icon rounded-full border border-line-light text-ink-soft group-hover:bg-white/[0.06] group-hover:text-ink">
              <X className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ink-muted">ESC</span>
          </button>
          <div className="m-auto w-full min-w-0 max-w-4xl shrink-0 px-8 py-16">
            <AboutTab meter />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
