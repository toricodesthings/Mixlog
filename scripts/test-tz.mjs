// Runs the tests once per time zone, so a test that leans on the machine's zone fails somewhere.
// Usage: node scripts/test-tz.mjs [zones...]   (default: the four-zone matrix, Cadence's)
import { spawnSync } from "node:child_process";

const ZONES = ["America/Toronto", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Pago_Pago"];
const zones = process.argv.length > 2 ? process.argv.slice(2) : ZONES;

let failed = false;
for (const TZ of zones) {
    console.log(`\n── TZ=${TZ} ──`);
    const run = spawnSync("pnpm", ["exec", "vitest", "run"], { stdio: "inherit", env: { ...process.env, TZ } });
    if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
