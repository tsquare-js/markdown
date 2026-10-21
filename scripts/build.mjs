// Builds each package's dist/: index.js (ESM, the shared code bundled in, dependencies left as
// imports) and index.d.ts. The shared code lives outside the packages, so its declarations are
// emitted to a temporary folder and only the package's own index.d.ts is kept; the build fails if
// that file still points at anything outside the package.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    // the zoom script, for the reader's browser; tsquare/viewer stays an import for the site's bundler
    if (existsSync(join(dir, "src/client.ts"))) {
      await build({
        entryPoints: [join(dir, "src/client.ts")],
        outfile: join(dir, "dist/client.js"),
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2020",
        packages: "external",
        logLevel: "warning",
      });
    }
    for (const entry of ["index", "client"]) {
      const dts = join(types, "packages", name, `src/${entry}.d.ts`);
      if (!existsSync(dts)) continue;
      const source = readFileSync(dts, "utf8");
      const relative = source.match(/from ["']\.{1,2}\/[^"']*["']/);
      // client.d.ts re-exports install() from shared/: give it its own declaration
      if (entry === "client") writeFileSync(join(dir, "dist/client.d.ts"), "/** Starts listening for clicks on boards (the import already did; calling it again does nothing). */\nexport declare function install(): void;\n");
      else if (relative) throw new Error(`${name}: ${entry}.d.ts imports ${relative[0]}; public types must not come from shared/`);
      else copyFileSync(dts, join(dir, `dist/${entry}.d.ts`));
    }
  }
} finally {
  rmSync(types, { recursive: true, force: true });
}
console.log(`built ${packages.map((p) => `packages/${p}/dist/`).join(", ")}`);
