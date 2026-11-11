import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "..");
const frontendRoots = [join(src, "pages"), join(src, "public")];
const frontendFiles = [];

function collectJavaScriptFiles(directory) {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      collectJavaScriptFiles(absolute);
    } else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry)) {
      frontendFiles.push(absolute);
    }
  }
}

for (const root of frontendRoots) {
  collectJavaScriptFiles(root);
}

test("frontend imports only public backend web modules", () => {
  const invalid = [];
  const importPattern =
    /\bfrom\s*["'](backend\/[^"']+)["']|\bimport\s*(?:\(\s*)?["'](backend\/[^"']+)["']|\brequire\s*\(\s*["'](backend\/[^"']+)["']/g;

  for (const file of frontendFiles) {
    const source = readFileSync(file, "utf8");
    let match;
    while ((match = importPattern.exec(source)) !== null) {
      const specifier = match[1] || match[2] || match[3];
      if (!/\.web(?:\.js)?$/.test(specifier)) {
        invalid.push({
          file: file.slice(src.length + 1),
          line: source.slice(0, match.index).split("\n").length,
          specifier,
        });
      }
    }
  }

  assert.deepEqual(
    invalid,
    [],
    "Frontend may call backend web modules, but must not import private backend modules"
  );
});
