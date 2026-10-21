/**
 * What every plugin here shares: from a ```tsquare block's text to an image (or the problems that
 * stop it), with the same markup as tsquare's browser script (renderAll): a figure.tsquare-board
 * holding an <img>, or a div.tsquare-problems listing them by line. Bundled into each package.
 */
import { boardLayout, compileWireframe, encodeWireframe, MAX_SHARED_TEXT, renderWireframeSvg, type CompileResult } from "tsquare";

/** The code block language the plugins render. */
export const LANG = "tsquare";

type Spec = NonNullable<CompileResult["spec"]>;

export interface Problem {
  /** The line inside the code block (1 = its first line), when the problem belongs to one. */
  line?: number;
  message: string;
}

/** A screen's box on the board, for the viewer's screen buttons. */
export interface Screen {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Checked =
  | { ok: true; spec: Spec; width: number; height: number; alt: string; screens: Screen[] }
  | { ok: false; problems: Problem[] };

/** Compiles the text (synchronous and fast) and works out the image's size and alt text. */
export function check(text: string, flows: boolean): Checked {
  const { spec, issues } = compileWireframe(text);
  if (!spec || issues.length) {
    return { ok: false, problems: issues.length ? issues.map((i) => ({ line: i.line, message: i.message })) : [{ message: "This isn't a wireframe." }] };
  }
  const { width, height, items } = boardLayout(spec, { flows });
  const title = (spec.elements[spec.root]?.props as { title?: string } | undefined)?.title;
  const screens = items.filter((i) => i.type === "Screen").map(({ name, x, y, width, height }) => ({ name, x, y, width, height }));
  return { ok: true, spec, width, height, alt: title ? `Wireframe: ${title}` : "Wireframe", screens };
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

export type Zoom = "auto" | boolean;

/**
 * Whether a board can be opened at full size. "auto" without a script can't measure the column, so it
 * guesses: docs columns are about 650-850px, and every multi-screen or desktop board is wider than 800.
 */
export function zoomable(width: number, zoom: Zoom) {
  return zoom === true || (zoom === "auto" && width > ZOOM_AUTO_WIDTH);
}
export const ZOOM_AUTO_WIDTH = 800;

/** The expand badge's icon (two arrows pointing out). */
export const EXPAND_ICON_PATH = "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7";

/**
 * The full-size view without a script: the board's wrapper is a popover, styled to sit in the page
 * until it's opened. Opened, it covers the window with the board at its real size (scroll around it;
 * Esc, Close or a click on the board closes it). Browsers without popovers show the plain board.
 * One copy per page.
 */
export const ZOOM_CSS = `.tsquare-zoom:not(:popover-open){display:block;position:static;inset:auto;width:auto;height:auto;margin:0;padding:0;border:0;overflow:visible;background:none;color:inherit}
.tsquare-zoom:popover-open{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;padding:calc(56px + env(safe-area-inset-top,0px)) 16px 16px;box-sizing:border-box;overflow:auto;background:rgba(18,22,30,.94)}
.tsquare-open{display:block;position:relative;width:100%;margin:0;padding:0;border:0;background:none;font:inherit;text-align:left;cursor:zoom-in}
.tsquare-open:focus-visible{outline:3px solid #2563c9;outline-offset:3px}
.tsquare-zoom:popover-open .tsquare-open{width:auto;cursor:zoom-out}
.tsquare-zoom:popover-open .tsquare-open img{max-width:none!important;margin:0 auto}
.tsquare-badge{position:absolute;right:8px;bottom:8px;display:grid;place-items:center;width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,.92);color:#172033;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.tsquare-zoom:popover-open .tsquare-badge{display:none}
.tsquare-close{display:none;position:fixed;z-index:1;top:calc(12px + env(safe-area-inset-top,0px));right:max(12px,env(safe-area-inset-right,0px));font:600 14px system-ui,sans-serif;color:#172033;background:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.tsquare-zoom:popover-open .tsquare-close{display:block}
html:has(.tsquare-zoom:popover-open){overflow:hidden}`;

/** A short id from the text, so each board's popover has its own (with the board's place on the page). */
export function boardId(text: string, index: number) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `tsquare-${(h >>> 0).toString(36)}-${index}`;
}

export const PLAYGROUND = "https://tsquare.dev/playground";

/**
 * The playground link for a board: the wireframe goes after the #, which browsers never send to the
 * server. `link` is true (tsquare.dev) or the address of a playground the site hosts itself. None for
 * text longer than the playground accepts from a link.
 */
export function playgroundLink(text: string, link: boolean | string): string | null {
  if (!link || new TextEncoder().encode(text).length > MAX_SHARED_TEXT) return null;
  return `${(link === true ? PLAYGROUND : link).replace(/#.*$/, "")}#${encodeWireframe(text)}`;
}
