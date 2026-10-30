import { notFound } from '@tanstack/react-router'

/** A route param used as a row ID. Anything that couldn't be one is simply not found. */
export function idInput(id: unknown): string {
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw notFound()
  return id
}
