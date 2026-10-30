import { useNavigate, useSearch } from '@tanstack/react-router'

type Search = { settings?: string }

/** `?settings=<tab>` opens Settings over whatever page you're on (`menu` is the compact category list). */
export function useSettingsParam() {
  const settings = useSearch({ strict: false }).settings ?? null
  const navigate = useNavigate()
  return {
    settings,
    /** Opening adds a history entry; moving between tabs replaces it, so Back closes Settings. */
    open: (tab: string) =>
      navigate({ to: '.', search: (prev: Search) => ({ ...prev, settings: tab }), replace: settings !== null, resetScroll: false }),
    close: () => navigate({ to: '.', search: ({ settings: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}
