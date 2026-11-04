/* tslint:disable */
/* eslint-disable */
/**
 * A source that can seek: `read_at(offset, length) -> Uint8Array`, called synchronously.
 */
export function measure_seekable(size: number, read_at: Function, hint: string): any;
/**
 * A source that only streams forward: chunks pushed in order (large WAV, AIFF, FLAC).
 */
export class Pump {
  free(): void;
  constructor(hint: string);
  push(chunk: Uint8Array): void;
  finish(): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_pump_free: (a: number, b: number) => void;
  readonly measure_seekable: (a: number, b: any, c: number, d: number) => [number, number, number];
  readonly pump_finish: (a: number) => [number, number, number];
  readonly pump_new: (a: number, b: number) => number;
  readonly pump_push: (a: number, b: number, c: number) => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
