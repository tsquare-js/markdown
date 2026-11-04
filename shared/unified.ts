/**
 * What remark-tsquare and rehype-tsquare share: drawing a page's blocks into board or problems
 * elements, warning about problems on the file and in the build log, and the zoom script's import on
 * MDX pages. Each plugin only finds its blocks (mdast code nodes, or hast <pre><code>) and puts the
 * elements back in their place.
 */
import type { Element } from "hast";
import type { Point, Position } from "unist";
import type { VFile } from "vfile";
import { boardId, check, playgroundLink, render, renderFailure, svgDataUrl, zoomable, type Problem, type Zoom } from "./board.js";
import { boardElement, logLine, problemsElement } from "./markup.js";

export interface Settings {
  flows: boolean;
  strict: boolean;
  zoom: Zoom;
  link: boolean | string;
  /** The plugin's name, as the source of its messages. */
  source: string;
}

export interface Block {
  /** The wireframe's text. */
  text: string;
  /** Where the block is in the file, for messages with no line of their own. */
  position?: Position;
  /** The line before the text's first line (a fence's line) and its column: a problem on the text's line n is at line + n. */
  before?: Pick<Point, "line" | "column">;
}

/** Each block drawn as its board (or its problems), in order, and how many boards can zoom. */
export async function drawBlocks(blocks: Block[], file: VFile, settings: Settings): Promise<{ elements: Element[]; zooms: number }> {
  let zooms = 0;
  // every board at once; each goes back in its own place, so the order they finish in doesn't matter
  const elements = await Promise.all(
    blocks.map(async (block, n) => {
      const checked = check(block.text);
      if (!checked.ok) return report(file, block, checked.problems, settings);
      try {
        const drawn = await render(block.text, checked.spec, settings.flows);
        const zoomId = zoomable(drawn.width, settings.zoom) ? boardId(block.text, n) : null;
        if (zoomId) zooms++;
        return boardElement({ alt: checked.alt, width: drawn.width, height: drawn.height, screens: drawn.screens, src: svgDataUrl(drawn.svg), zoomId, href: playgroundLink(block.text, settings.link) });
      } catch (err) {
        return report(file, block, [renderFailure(err)], settings);
      }
    }),
  );
  return { elements, zooms };
}

/** Warns on the file for each problem (with its line in the document), and returns the list to show in place. */
function report(file: VFile, block: Block, problems: Problem[], settings: Settings): Element {
  const where = (p: Problem) => (block.before && p.line ? { line: block.before.line + p.line, column: block.before.column } : block.position);
  if (settings.strict) {
    const first = problems[0];
    const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : "";
    file.fail(`tsquare: ${first.message}${more}`, { place: where(first), ruleId: "invalid-wireframe", source: settings.source });
  }
  for (const p of problems) warn(file, `tsquare: ${p.message}`, where(p), "invalid-wireframe", settings.source);
  return problemsElement(problems);
}

/** A message on the file, and the same in the build log: Docusaurus and Astro don't print a file's messages. */
export function warn(file: VFile, reason: string, place: Position | Pick<Point, "line" | "column"> | undefined, ruleId: string, source: string) {
  const message = file.message(reason, { place, ruleId, source });
  console.warn(logLine(file.path, message.line, message.column, reason.replace(/^tsquare: /, "")));
}

/** MDX (remark-mdx registered on this processor) can import the zoom script; plain Markdown can't. */
export function isMdx(processor: { data(key: string): unknown } | void) {
  const extensions = processor ? processor.data("fromMarkdownExtensions") : undefined;
  return Array.isArray(extensions) && extensions.flat(Infinity).some((e) => Boolean((e as { enter?: Record<string, unknown> } | null)?.enter?.mdxjsEsm));
}

/**
 * `import "<specifier>"`, as an MDX ESM node (with the estree MDX compiles from). The same node works
 * in mdast and in hast: MDX passes it through remark-rehype.
 */
export function mdxImport(specifier: string) {
  return {
    type: "mdxjsEsm" as const,
    value: `import ${JSON.stringify(specifier)};`,
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        body: [{ type: "ImportDeclaration", specifiers: [], attributes: [], source: { type: "Literal", value: specifier, raw: JSON.stringify(specifier) } }],
      },
    },
  };
}
