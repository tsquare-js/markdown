/**
 * What every plugin here shares: from a ```tsquare block's text to an image (or the problems that
 * stop it), with the same markup as tsquare's browser script (renderAll): a figure.tsquare-board
 * holding an <img>, or a div.tsquare-problems listing them by line. Bundled into each package.
 */
import { boardLayout, compileWireframe, renderWireframeSvg, type CompileResult } from "tsquare";

/** The code block language the plugins render. */
export const LANG = "tsquare";

type Spec = NonNullable<CompileResult["spec"]>;

export interface Problem {
  /** The line inside the code block (1 = its first line), when the problem belongs to one. */
  line?: number;
  message: string;
}

export type Checked =
  | { ok: true; spec: Spec; width: number; height: number; alt: string }
  | { ok: false; problems: Problem[] };

/** Compiles the text (synchronous and fast) and works out the image's size and alt text. */
export function check(text: string, flows: boolean): Checked {
  const { spec, issues } = compileWireframe(text);
  if (!spec || issues.length) {
    return { ok: false, problems: issues.length ? issues.map((i) => ({ line: i.line, message: i.message })) : [{ message: "This isn't a wireframe." }] };
  }
  const { width, height } = boardLayout(spec, { flows });
  const title = (spec.elements[spec.root]?.props as { title?: string } | undefined)?.title;
  return { ok: true, spec, width, height, alt: title ? `Wireframe: ${title}` : "Wireframe" };
}

// Renders by text, so a dev server re-rendering a page after an edit only draws the boards that changed.
// The promise goes in as soon as a render starts: Docusaurus compiles its client and server bundles
// at the same time, and caching only finished renders drew every board twice.
const cache = new Map<string, Promise<string>>();
const CACHE_SIZE = 200;

/** The SVG of a checked board (the same promise while the same text is being drawn, or was before). */
export function render(text: string, spec: Spec, flows: boolean): Promise<string> {
  const key = (flows ? "1" : "0") + text;
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key); // most recently used goes last
    cache.set(key, hit);
    return hit;
  }
  const svg = renderWireframeSvg(spec, { skipValidation: true, flows });
  cache.set(key, svg);
  svg.catch(() => {
    if (cache.get(key) === svg) cache.delete(key); // a failed render is tried again next time
  });
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return svg;
}

/**
 * The SVG inside the URL as text, escaping only what a URL or an HTML attribute can't hold. Smaller
 * than base64 after compression (35 KB vs 44 KB gzipped for a one-screen board), and an <img> keeps
 * each board's SVG ids to itself, where inline <svg>s on one page would clash.
 */
export function svgDataUrl(svg: string) {
  return "data:image/svg+xml," + svg.replace(/[\r\n%#()<>?[\\\]^`{|}"']/g, encodeURIComponent);
}

/** "2 problems in this wireframe" */
export function problemsHeading(problems: Problem[]) {
  return problems.length === 1 ? "1 problem in this wireframe" : `${problems.length} problems in this wireframe`;
}

/** "line 3: …" */
export function problemText(p: Problem) {
  return p.line ? `line ${p.line}: ${p.message}` : p.message;
}

/** For a board that compiled but couldn't be drawn (a renderer bug). */
export function renderFailure(err: unknown): Problem {
  return { message: `tsquare couldn't render this board: ${err instanceof Error ? err.message : String(err)}` };
}

/** Inline styles that make a board fit its column at its own aspect ratio, whatever the site's CSS. */
export const IMG_STYLE = "max-width:100%;height:auto";
