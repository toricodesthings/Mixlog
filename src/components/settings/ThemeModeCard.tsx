import { Monitor, Moon, Sun } from 'lucide-react'

import type { ThemeChoice } from '../../hooks/ui/use-appearance'
import { cn } from '../../lib/utils'

const MODE_META = {
  'blue-hour': { icon: Moon, label: 'Blue Hour', desc: 'The control room after dark' },
  daylight: { icon: Sun, label: 'Daylight Studio', desc: 'Warm and bright' },
  system: { icon: Monitor, label: 'Match system', desc: 'Follows this device' },
} as const

function Scene({ day, className }: { day: boolean; className?: string }) {
  return (
    <div className={cn('flex h-full flex-col justify-between p-2', day ? 'bg-preview-day' : 'bg-preview-night', className)}>
      <div className="flex gap-1">
        <div className={cn('h-1.5 w-6 rounded-full', day ? 'bg-preview-day-signal' : 'bg-preview-night-signal')} />
        <div className={cn('h-1.5 w-4 rounded-full opacity-30', day ? 'bg-preview-day-ink' : 'bg-preview-night-ink')} />
      </div>
      <div className="flex gap-1.5">
        <div className={cn('h-3 w-full rounded', day ? 'bg-preview-day-card' : 'bg-preview-night-card')} />
        <div className={cn('h-3 w-full rounded', day ? 'bg-preview-day-card' : 'bg-preview-night-card')} />
      </div>
    </div>
  )
}

function MiniPreview({ mode }: { mode: ThemeChoice }) {
  return (
    <div className="relative h-16 w-full overflow-hidden rounded-lg">
      {mode === 'system' ? (
        <>
          <Scene day={false} className="absolute inset-0" />
          <Scene day className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
        </>
      ) : (
        <Scene day={mode === 'daylight'} />
      )}
    </div>
  )
}

export function ThemeModeCard({ mode, selected, onSelect }: { mode: ThemeChoice; selected: boolean; onSelect: () => void }) {
  const meta = MODE_META[mode]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group flex w-full cursor-pointer flex-col gap-2.5 rounded-2xl border p-3 text-left transition-all duration-200',
        selected ? 'border-accent/40 bg-accent/[0.06]' : 'border-line-light bg-white/[0.02] hover:bg-white/[0.04]',
      )}
    >
      <MiniPreview mode={mode} />
      <div className="flex items-center gap-2">
        <Icon size={14} aria-hidden="true" className={cn('transition-colors', selected ? 'text-accent' : 'text-ink-muted')} />
        <span className="text-[13px] font-medium text-ink">{meta.label}</span>
      </div>
      <span className="text-[11px] text-ink-muted">{meta.desc}</span>
    </button>
  )
}
