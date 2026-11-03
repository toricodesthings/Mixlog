import { isNotFound, isRedirect } from '@tanstack/react-router'

import { Refusal } from '#/server/input'

/** What the artist reads when something failed that nobody planned for: the real error is in the log, never the response. */
export const SERVER_FAILED = 'Something went wrong on the server. Try again.'

/**
 * The one way the Worker logs: warnings and failures only, never the happy path. The error goes to the console as
 * itself (and its cause, where the real reason of a D1 or R2 failure usually sits), so Workers Logs keeps its name,
 * message and source-mapped stack and Workers Issues groups it. `context` is what it takes to repeat it: the function,
 * its input, the key or part involved.
 */
export function report(level: 'warn' | 'error', what: string, error?: unknown, context?: Record<string, unknown>) {
  const cause = error instanceof Error ? error.cause : undefined
  console[level](what, ...[error, cause, context].filter((arg) => arg !== undefined))
}

/** An answer, not a failure: a refusal in the artist's words, a not-found or a redirect. These are never logged. */
export const isAnswer = (error: unknown) => error instanceof Refusal || isNotFound(error) || isRedirect(error)
