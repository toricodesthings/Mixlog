import * as React from 'react'
import { X } from 'lucide-react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn } from '../../lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../primitives/Dialog'
import { SearchField } from '../primitives/SearchField'
import { SETTINGS_CATEGORIES, SettingsContent } from './SettingsContent'
import { SettingsSheet } from './SettingsSheet'
import { useSettingsParam } from './use-settings-param'

/** Settings over the current page: a large dialog with searchable categories on desktop, a sheet on compact. */
export function SettingsDialog() {
  const shell = useShellMode()
  const { settings, open, close } = useSettingsParam()
  // `menu` is the compact list; a desktop opening it shows the first tab.
  const activeTab = settings === 'menu' ? 'appearance' : settings

  const [searchQuery, setSearchQuery] = React.useState('')
  // Search matches a tab's name or any of its row titles
  const needle = searchQuery.trim().toLowerCase()
  const matches = SETTINGS_CATEGORIES.filter(
    (item) => !('isHeader' in item) && [item.label, ...item.keywords].some((text) => text.toLowerCase().includes(needle)),
  )

  if (shell.isCompact) return <SettingsSheet />
  if (!activeTab) return null

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && void close()}>
      <DialogContent
        className="block !bg-panel-raised ![backdrop-filter:none] ![-webkit-backdrop-filter:none] h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none gap-0 overflow-hidden rounded-[2rem] p-0 outline-none lg:h-[95vh] lg:w-[min(96vw,1720px)] !translate-x-[-50%] !translate-y-[-50%] !left-[50%] !top-[50%]"
        style={{ width: 'min(calc(100vw - 2rem), 1720px)', maxWidth: 'none', height: 'calc(100vh - 2rem)' }}
        hideCloseButton
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">How Mixlog looks and behaves on this device.</DialogDescription>

        <div className="flex h-full w-full">
          {/* Left Sidebar */}
          <div className="hidden w-[280px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-line/70 bg-room-surface-muted/70 px-4 py-10 md:flex">
            <div className="px-2">
              <SearchField placeholder="Search settings" aria-label="Search settings" value={searchQuery} onValueChange={setSearchQuery} />
            </div>

            <nav className="flex flex-col gap-1 pr-2">
              {needle && matches.length === 0 && (
                <p className="px-3 py-2 text-sm text-ink-soft">No settings match “{searchQuery.trim()}”.</p>
              )}
              {SETTINGS_CATEGORIES.map((item, i) => {
                if ('isHeader' in item) {
                  if (needle) return null
                  return (
                    <div key={`header-${i}`} className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
                      {item.label}
                    </div>
                  )
                }
                if (needle && !matches.includes(item)) return null
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void open(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent',
                      isActive
                        ? 'bg-white/[0.08] font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                        : 'text-ink-soft hover:bg-white/[0.05] hover:text-ink',
                    )}
                  >
                    <Icon aria-hidden="true" className={cn('h-4 w-4', isActive ? 'h-5 w-5 text-accent' : 'text-ink-muted')} />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="settings-content-bg relative flex flex-1 flex-col items-stretch overflow-y-auto">
            <button type="button" className="group absolute right-6 top-6 z-10 flex cursor-pointer flex-col items-center gap-2" onClick={() => void close()} aria-label="Close settings">
              <div className="btn-icon rounded-full border border-line-light text-ink-soft group-hover:bg-white/[0.06] group-hover:text-ink">
                <X className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">ESC</span>
            </button>

            <div className="min-h-full w-full px-8 py-14 md:px-14 xl:px-20">
              <SettingsContent activeTab={activeTab} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
