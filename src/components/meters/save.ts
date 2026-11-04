import { measureStored } from '../../lib/meter'
import type { Analysis } from '#/server/loudness'
import { saveAnalysis } from '#/server/releases'

/** Saves a reading that landed after its bounce was stored (it fills once; the cron catches one that never lands), then
 *  `onSaved`, so the page shows it. */
export function saveLate(versionId: string, late: Promise<Analysis | null> | undefined, onSaved: () => void) {
  void late
    ?.then(async (analysis) => {
      if (analysis) await saveAnalysis({ data: { versionId, analysis } }).then(onSaved)
    })
    .catch(() => {})
}

/** Measure, on a version without a reading: reads it on this device and saves what it read. */
export async function measureAndSave(version: { id: string; size: number; filename: string }, onProgress?: (share: number) => void) {
  const analysis = await measureStored(version, onProgress)
  if (analysis) await saveAnalysis({ data: { versionId: version.id, analysis } })
  return analysis
}
