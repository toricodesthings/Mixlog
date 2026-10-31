// The date-model guard (AGENTS.md "Dates"). Fails on code that can read a day as a different day, or show a clock time.
// Scans src/ except src/lib/time.ts, the one place that converts. A deliberate exception needs `// time-ok: <reason>` on the line.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const EXEMPT = new Set(["src/lib/time.ts", "src/routeTree.gen.ts"]);

const DATEISH = String.raw`\w*(?:[Dd]ate|[Dd]ay|[Ss]tamp|[Tt]ime|iso|Iso|ISO|_at|At|_on|On)\w*`;
const RULES = [
    [new RegExp(String.raw`\b${DATEISH}\??\.(?:slice|substring)\(\s*0\s*,\s*10\s*\)`), "slicing a timestamp for a day (use dayOf)"],
    [new RegExp(String.raw`\b${DATEISH}\??\.split\(\s*["']T["']\s*\)\s*\[\s*0\s*\]`), "split('T')[0] to get a day (use dayOf)"],
    [/toISOString\(\)\s*\.(?:slice|substring|split)\(/, "toISOString() to get a day (use todayIn / dayOf)"],
    [/new Date\(\s*[`"'][^`"']*T(?:00:00|12:00|23:59)/, "new Date(...T00:00) style parsing"],
    [/getTimezoneOffset/, "getTimezoneOffset"],
    [/\.(?:getDate|getHours|setHours|getDay|getFullYear|getMonth)\(/, "Date local getters (use dayOf in a zone)"],
    [/toLocale(?:Date|Time)?String\(|Intl\.DateTimeFormat/, "formatting a date outside lib/time (use formatDay)"],
    [/strftime\(\s*'%Y-%m-%d'|date\(\s*'now'/i, "a UTC day in SQL (the client sends the day, in its zone)"],
];

const problems = [];
for (const entry of readdirSync(join(root, "src"), { recursive: true })) {
    const full = join(root, "src", entry);
    const rel = relative(root, full).replaceAll("\\", "/");
    if (!/\.(ts|tsx)$/.test(entry) || /\.d\.ts$/.test(entry) || EXEMPT.has(rel) || statSync(full).isDirectory()) continue;
    readFileSync(full, "utf8").split("\n").forEach((line, i) => {
        const code = line.trimStart();
        if (line.includes("time-ok") || code.startsWith("//") || code.startsWith("*")) return;
        for (const [re, why] of RULES) if (re.test(line)) problems.push(`${rel}:${i + 1}  ${why}\n    ${code}`);
    });
}

if (problems.length) {
    console.error(`check-time: ${problems.length} problem(s). Use src/lib/time.ts, or add \`// time-ok: <reason>\`.\n`);
    console.error(problems.join("\n"));
    process.exit(1);
}
console.log("check-time: ok");
