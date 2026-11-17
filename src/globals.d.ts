/** From package.json at build time (vite.config.ts): the version is never typed anywhere else. */
declare const __APP_VERSION__: string
/** The public meter's hostname, from wrangler.jsonc at build time (vite.config.ts); empty when there is none. */
declare const __METER_HOST__: string

/** A .wasm compiled ahead by the Cloudflare plugin, for `initSync` (Workers can't compile at runtime). */
declare module '*.wasm?module' {
  const module: WebAssembly.Module
  export default module
}
