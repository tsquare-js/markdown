// Builds each package's dist/: index.js (ESM, the shared code bundled in, dependencies left as
// imports) and index.d.ts. The shared code lives outside the packages, so its declarations are
// emitted to a temporary folder and only the package's own index.d.ts is kept; the build fails if
// that file still points at anything outside the package.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const packages = readdirSync("packages");
const types = mkdtempSync(join(tmpdir(), "tsquare-markdown-"));
try {
  execFileSync("npx", ["tsc", "-p", "tsconfig.build.json", "--outDir", types], { stdio: "inherit" });
  for (const name of packages) {
    const dir = join("packages", name);
    rmSync(join(dir, "dist"), { recursive: true, force: true });
    await build({
      entryPoints: [join(dir, "src/index.ts")],
      outfile: join(dir, "dist/index.js"),
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node20",
      packages: "external",
      logLevel: "warning",
    });
    const dts = join(types, "packages", name, "src/index.d.ts");
    const relative = readFileSync(dts, "utf8").match(/from ["']\.{1,2}\/[^"']*["']/);
    if (relative) throw new Error(`${name}: index.d.ts imports ${relative[0]}; public types must not come from shared/`);
    copyFileSync(dts, join(dir, "dist/index.d.ts"));
  }
} finally {
  rmSync(types, { recursive: true, force: true });
}
console.log(`built ${packages.map((p) => `packages/${p}/dist/`).join(", ")}`);
