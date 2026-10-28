/**
 * Parse node:test counters across supported Node runtimes.
 * Node 20 prints TAP comments such as "# pass 10"; Node 24 emits "ℹ pass 10".
 */
export function parseTapSummary(output) {
  const source = typeof output === "string" ? output : "";
  const counts = { tests: 0, pass: 0, fail: 0 };
  const summaryLine = /^(?:#|ℹ)\s+(tests|pass|fail)\s+(\d+)\s*$/gm;

  for (const match of source.matchAll(summaryLine)) {
    counts[match[1]] = Number(match[2]);
  }

  return counts;
}
