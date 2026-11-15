import { useBlocker } from '@tanstack/react-router'
import { LogOut, TriangleAlert } from 'lucide-react'
import { useRef } from 'react'

import { Composer } from './Composer'

/**
 * Asks before leaving a page with changes that aren't saved: going to another page in the app (a confirm in our own
 * words) or closing the tab (the browser's own prompt). A change of search only (a picker, Settings) stays on the
 * page, so it passes. `allow` lets the page's own Save-and-leave through once.
 */
export function useLeaveGuard(dirty: boolean, what: string) {
  const skip = useRef(false)
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (skip.current) return (skip.current = false)
      return dirty && current.pathname !== next.pathname
    },
    enableBeforeUnload: () => dirty,
    withResolver: true,
  })
  const guard =
    blocker.status === 'blocked' ? (
      <Composer
        onClose={blocker.reset}
        title="Leave without saving?"
        icon={TriangleAlert}
        description={`Your changes to ${what} aren’t saved. Leaving lets them go.`}
        submit={{ label: 'Leave', icon: LogOut, onSubmit: blocker.proceed }}
        closeLabel="Stay"
        className="sm:max-w-md"
      >
        {null}
      </Composer>
    ) : null
  return { guard, allow: () => void (skip.current = true) }
}
