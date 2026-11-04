import { readFileSync } from 'node:fs'

// The committed meter, compiled as the Worker's `?module` import hands it over.
export default new WebAssembly.Module(readFileSync(new URL('../../meter/pkg/mixlog_meter_bg.wasm', import.meta.url)))
