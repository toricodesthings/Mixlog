import { notFound } from '@tanstack/react-router'
import { z } from 'zod'

/** A row ID (`crypto.randomUUID()`, or a seed's slug); `what` names it in the error. */
export const Id = (what = 'Not found.') => z.string(what).regex(/^[\w-]{1,64}$/, what)

/** Whether a value could be a row ID. */
export const isId = (id: unknown): id is string => Id().safeParse(id).success

/** A route param used as a row ID. Anything that couldn't be one is simply not found. */
export function idInput(id: unknown): string {
  if (!isId(id)) throw notFound()
  return id
}

/** A no in the artist's words (bad input, a rule the move breaks): their answer, not a bug. Its `status` keeps Start
 *  from logging it, and `server/log.ts` lets it through untouched. */
export class Refusal extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

/** A Zod schema as a validator whose error is the first problem in our own words, not Zod's JSON dump. */
export const readWith =
  <T extends z.ZodType>(schema: T) =>
  (input: unknown): z.output<T> => {
    const result = schema.safeParse(input)
    if (!result.success) throw new Refusal(result.error.issues[0].message)
    return result.data
  }
