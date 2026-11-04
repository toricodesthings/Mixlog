import { useNavigate, useSearch } from '@tanstack/react-router'

type Search = { meters?: string }

/** `?meters=<versionId>` opens that version's meters, so a refresh or a pasted link lands with them open. Opening adds
 *  a history entry; moving to another version replaces it, so Back closes; the same one again closes. */
export function useMetersParam() {
  const navigate = useNavigate()
  const open = (useSearch({ strict: false }) as Search).meters ?? null
  const close = () => navigate({ to: '.', search: ({ meters: _, ...rest }: Search) => rest, replace: true, resetScroll: false })
  return {
    open,
    close,
    toggle: (id: string) =>
      id === open ? close() : navigate({ to: '.', search: (prev: Search) => ({ ...prev, meters: id }), replace: open !== null, resetScroll: false }),
  }
}
