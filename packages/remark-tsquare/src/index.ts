/**
 * remark-tsquare: turns ```tsquare code blocks into wireframe images while the site is built
 * (Docusaurus, Astro, Next.js with MDX, anything on unified). Nothing runs in the reader's browser
 * unless zoom's script is loaded.
 *
 * Each block becomes <figure class="tsquare-board"><img src="data:image/svg+xml,…"></figure>, or,
 * when its text has problems, <div class="tsquare-problems"> listing them by line, plus a warning on
 * the file and in the build log (or a failed build, with `strict`).
 *
 * A board that can zoom sits inside a popover styled to stay in the page (shared/board.ts ZOOM_CSS):
 * a click shows it at full size, with no script. On MDX pages the plugin also imports
 * "remark-tsquare/client", which opens the viewer instead (zoom, pan, pinch, screen buttons).
 *
 * The replacement is an mdast node that says which HTML to become (data.hName/hProperties/hChildren),
 * not raw HTML: MDX rejects raw HTML nodes, and both paths through remark-rehype understand this.
 */
import type { Element } from "hast";
import type { Code, Parent, Root, RootContent } from "mdast";
import type { VFile } from "vfile";
import { boardId, check, LANG, playgroundLink, render, renderFailure, svgDataUrl, zoomable, type Problem } from "../../../shared/board.js";
import { boardElement, logLine, problemsElement, zoomStyleElement } from "../../../shared/markup.js";

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

const CLIENT = "remark-tsquare/client";

export default function remarkTsquare(this: { data(key: string): unknown } | void, options: Options = {}) {
  const flows = options.flows ?? true;
  const strict = options.strict ?? false;
  const zoom = options.zoom ?? "auto";
  const link = options.link ?? false;
  const mdx = isMdx(this);

  return async function transform(tree: Root, file: VFile) {
    const blocks: { node: Code; parent: Parent; index: number }[] = [];
    collect(tree, blocks);
    let zooms = 0;
    // every board at once; each replaces its own code block, so the order doesn't matter
    await Promise.all(
      blocks.map(async ({ node, parent, index }, n) => {
        const text = node.value;
        const checked = check(text);
        let replacement: Element;
        if (checked.ok) {
          try {
            const drawn = await render(text, checked.spec, flows);
            const zoomId = zoomable(drawn.width, zoom) ? boardId(text, n) : null;
            if (zoomId) zooms++;
            replacement = boardElement({ alt: checked.alt, width: drawn.width, height: drawn.height, screens: drawn.screens, src: svgDataUrl(drawn.svg), zoomId, href: playgroundLink(text, link) });
          } catch (err) {
            replacement = report(file, node, [renderFailure(err)], strict);
          }
        } else {
          replacement = report(file, node, checked.problems, strict);
        }
        parent.children[index] = asMdast(replacement, node);
      }),
    );
    if (zooms) {
      tree.children.push(asMdast(zoomStyleElement()));
      if (mdx) tree.children.unshift(importClient());
    }
  };
}

/** MDX (remark-mdx registered on this processor) can import the zoom script; plain Markdown can't. */
function isMdx(processor: { data(key: string): unknown } | void) {
  const extensions = processor ? processor.data("fromMarkdownExtensions") : undefined;
  return Array.isArray(extensions) && extensions.flat(Infinity).some((e) => Boolean((e as { enter?: Record<string, unknown> } | null)?.enter?.mdxjsEsm));
}

/** `import "remark-tsquare/client"`, as an MDX ESM node (with the estree MDX compiles from). */
function importClient(): RootContent {
  return {
    type: "mdxjsEsm",
    value: `import ${JSON.stringify(CLIENT)};`,
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        body: [{ type: "ImportDeclaration", specifiers: [], attributes: [], source: { type: "Literal", value: CLIENT, raw: JSON.stringify(CLIENT) } }],
      },
    },
  } as unknown as RootContent;
}

function collect(node: Root | RootContent, out: { node: Code; parent: Parent; index: number }[]) {
  if (!("children" in node)) return;
  node.children.forEach((child, index) => {
    if (child.type === "code" && child.lang === LANG) out.push({ node: child, parent: node, index });
    else collect(child, out);
  });
}

/** Warns on the file for each problem (with its line in the document), and returns the list to show in place. */
function report(file: VFile, node: Code, problems: Problem[], strict: boolean): Element {
  const fence = node.position?.start;
  const where = (p: Problem) => (fence && p.line ? { line: fence.line + p.line, column: fence.column } : node.position);
  if (strict) {
    const first = problems[0];
    const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : "";
    file.fail(`tsquare: ${first.message}${more}`, { place: where(first), ruleId: "invalid-wireframe", source: "remark-tsquare" });
  }
  for (const p of problems) {
    const message = file.message(`tsquare: ${p.message}`, { place: where(p), ruleId: "invalid-wireframe", source: "remark-tsquare" });
    // also in the build log: Docusaurus and Astro don't print a file's messages
    console.warn(logLine(file.path, message.line, message.column, p.message));
  }
  return problemsElement(problems);
}

/** An mdast node that remark-rehype (and MDX) turns into the given element, in place of the code block. */
function asMdast(element: Element, code?: Code): RootContent {
  return {
    type: "tsquareBoard",
    position: code?.position,
    data: { hName: element.tagName, hProperties: element.properties, hChildren: element.children },
  } as unknown as RootContent;
}
