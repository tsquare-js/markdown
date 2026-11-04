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
import { LANG } from "../../../shared/board.js";
import { zoomStyleElement } from "../../../shared/markup.js";
import { drawBlocks, isMdx, mdxImport } from "../../../shared/unified.js";

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
    const found: { node: Code; parent: Parent; index: number }[] = [];
    collect(tree, found);
    const blocks = found.map(({ node }) => ({ text: node.value, position: node.position, before: node.position?.start }));
    const { elements, zooms } = await drawBlocks(blocks, file, { flows, strict, zoom, link, source: "remark-tsquare" });
    found.forEach(({ node, parent, index }, n) => (parent.children[index] = asMdast(elements[n], node)));
    if (zooms) {
      tree.children.push(asMdast(zoomStyleElement()));
      if (mdx) tree.children.unshift(mdxImport(CLIENT) as unknown as RootContent);
    }
  };
}

function collect(node: Root | RootContent, out: { node: Code; parent: Parent; index: number }[]) {
  if (!("children" in node)) return;
  node.children.forEach((child, index) => {
    if (child.type === "code" && child.lang === LANG) out.push({ node: child, parent: node, index });
    else collect(child, out);
  });
}

/** An mdast node that remark-rehype (and MDX) turns into the given element, in place of the code block. */
function asMdast(element: Element, code?: Code): RootContent {
  return {
    type: "tsquareBoard",
    position: code?.position,
    data: { hName: element.tagName, hProperties: element.properties, hChildren: element.children },
  } as unknown as RootContent;
}
