/** What an upload says about itself, in words a bar can say out loud. Pure. */

/** "84 KB", "48.2 MB", "1.24 GB". */
export const sizeOf = (bytes: number) =>
  bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`

/** "12.4 of 48.0 MB": the share of `bytes` sent so far. */
export function sentOf(share: number, bytes: number) {
  const [unit, size] = bytes < 1024 ** 3 ? (['MB', 1024 ** 2] as const) : (['GB', 1024 ** 3] as const)
  const digits = unit === 'MB' ? 1 : 2
  return `${((share * bytes) / size).toFixed(digits)} of ${(bytes / size).toFixed(digits)} ${unit}`
}

/** Time left at the pace so far, once there's enough of it to judge (a few seconds in). Never a clock time. */
export function timeLeft(sent: number, total: number, seconds: number): string | null {
  if (seconds < 3 || sent <= 0 || sent >= total) return null
  const left = ((total - sent) / sent) * seconds
  return left < 60 ? `${Math.max(5, Math.round(left / 5) * 5)} s left` : `${Math.round(left / 60)} min left`
}
