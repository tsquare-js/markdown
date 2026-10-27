/**
 * markdown-it-tsquare: turns ```tsquare code blocks into wireframe images while the site is built
 * (VitePress, Eleventy, anything on markdown-it). Nothing runs in the reader's browser unless zoom's
 * script is loaded.
 *
 * The same HTML as remark-tsquare (shared/markup.ts). markdown-it renders synchronously and tsquare's
 * renderer is async, so boards are drawn in a worker thread that the render waits for (synckit):
 * about 0.3 s to start it, on the first board, then each board takes what it would in the main thread.
 */
import { fileURLToPath } from "node:url";
import { toHtml } from "hast-util-to-html";
import type MarkdownIt from "markdown-it";
import { createSyncFn } from "synckit";
import type { CompileResult } from "tsquare";
import { boardId, check, LANG, playgroundLink, renderFailure, svgDataUrl, zoomable, type Drawn, type Problem } from "../../../shared/board.js";
import { boardElement, logLine, problemsElement, zoomStyleLinkElement } from "../../../shared/markup.js";

export interface Options {
  /** Draw flow arrows between screens. Default true. */
  flows?: boolean;
  /** Fail the build when a wireframe has problems, instead of listing them on the page. Default false. */
  strict?: boolean;
  /**
   * Let readers open a board at full size: "auto" (default) for boards wider than a docs column,
   * true for every board, false for none. With the zoom script, it opens in a viewer with zoom and pan.
   */
  zoom?: "auto" | boolean;
  /**
   * An "Open in playground" link under each board: true for tsquare.dev, or the address of your own
   * playground. Default false.
   */
  link?: boolean | string;
}

type Spec = NonNullable<CompileResult["spec"]>;

// A board that takes longer than this fails with a message instead of hanging the build (a worker
// that can't start would otherwise be waited for forever).
const RENDER_TIMEOUT = 60_000;

let drawInWorker: ((spec: Spec, flows: boolean) => Drawn) | undefined; // started on the first board
const draw = (spec: Spec, flows: boolean): Drawn =>
  (drawInWorker ??= createSyncFn(fileURLToPath(new URL("./worker.js", import.meta.url)), { timeout: RENDER_TIMEOUT }))(spec, flows);

// Drawn boards by text, so a dev server re-rendering a page after an edit only draws the boards that changed
const cache = new Map<string, Drawn>();
const CACHE_SIZE = 200;

function drawnFor(text: string, spec: Spec, flows: boolean): Drawn {
  const key = (flows ? "1" : "0") + text;
  let drawn = cache.get(key);
  if (drawn === undefined) {
    drawn = draw(spec, flows);
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  } else cache.delete(key); // most recently used goes last
  cache.set(key, drawn);
  return drawn;
}

// Per page (markdown-it's env): how many boards so far, for their ids, and whether the zoom styles are in
const pages = new WeakMap<object, { boards: number; styled: boolean }>();

export default function markdownItTsquare(md: MarkdownIt, options: Options = {}): void {
  const flows = options.flows ?? true;
  const strict = options.strict ?? false;
  const zoom = options.zoom ?? "auto";
  const link = options.link ?? false;
  const fallback = md.renderer.rules.fence!;
  // each render starts the page's count and styles afresh, even when a site passes the same env again
  // (core rules run once per render, before any fence is rendered)
  md.core.ruler.push("tsquare_page", (state) => {
    if (typeof state.env === "object" && state.env !== null) pages.delete(state.env);
  });

  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    if (token.info.trim().split(/\s+/)[0] !== LANG) return fallback(tokens, idx, opts, env, self);
    const text = token.content.replace(/\n$/, ""); // as remark has it, so ids and links match
    const page = pageOf(env);
    const n = page ? page.boards++ : 0;
    const checked = check(text);
    if (!checked.ok) return report(env, token.map, checked.problems, strict);
    let drawn: Drawn;
    try {
      drawn = drawnFor(text, checked.spec, flows);
    } catch (err) {
      return report(env, token.map, [renderFailure(err)], strict);
    }
    const zoomId = zoomable(drawn.width, zoom) ? boardId(text, n) : null;
    const figure = toHtml(boardElement({ alt: checked.alt, width: drawn.width, height: drawn.height, screens: drawn.screens, src: svgDataUrl(drawn.svg), zoomId, href: playgroundLink(text, link) }));
    // the styles go with the page's first board that zooms (a fence can't add to the end of the page),
    // as a <link>: VitePress drops a page's <style>
    if (zoomId && page && !page.styled) {
      page.styled = true;
      return toHtml(zoomStyleLinkElement()) + figure + "\n";
    }
    return figure + "\n";
  };
}

function pageOf(env: unknown) {
  if (typeof env !== "object" || env === null) return undefined;
  let page = pages.get(env);
  if (!page) pages.set(env, (page = { boards: 0, styled: false }));
  return page;
}

/** The page's file: VitePress puts it in env.path, Eleventy in env.page.inputPath. */
function pathOf(env: unknown): string | undefined {
  const e = env as { path?: unknown; page?: { inputPath?: unknown } } | undefined;
  const path = e?.path ?? e?.page?.inputPath;
  return typeof path === "string" ? path : undefined;
}

/** Warns in the build log (or fails the build, with `strict`) and returns the list to show in place. */
function report(env: unknown, map: [number, number] | null, problems: Problem[], strict: boolean) {
  // map[0] is the fence's line, counting from 0; a problem's line counts from the fence's next line
  const line = (p: Problem) => (map ? map[0] + 1 + (p.line ?? 0) : undefined);
  const path = pathOf(env);
  if (strict) {
    const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : "";
    throw new Error(logLine(path, line(problems[0]), 1, problems[0].message + more));
  }
  for (const p of problems) console.warn(logLine(path, line(p), 1, p.message));
  return toHtml(problemsElement(problems)) + "\n";
}
