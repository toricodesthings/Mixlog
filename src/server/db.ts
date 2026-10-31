import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'

import * as schema from '#/server/schema'

/** D1 through Drizzle: typed queries over `schema.ts`, every value bound. */
export const db = drizzle(env.DB, { schema })
