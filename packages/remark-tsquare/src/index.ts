/**
 * remark-tsquare: turns ```tsquare code blocks into wireframe images while the site is built
 * (Docusaurus, Astro, Next.js with MDX, anything on unified). Nothing runs in the reader's browser.
 *
 * Each block becomes <figure class="tsquare-board"><img src="data:image/svg+xml,…"></figure>, or,
 * when its text has problems, <div class="tsquare-problems"> listing them by line, plus a warning on
 * the file and in the build log (or a failed build, with `strict`).
 *
 * The replacement is an mdast node that says which HTML to become (data.hName/hProperties/hChildren),
 * not raw HTML: MDX rejects raw HTML nodes, and both paths through remark-rehype understand this.
 */
import type { Element, ElementContent } from "hast";
import type { Code, Parent, Root, RootContent } from "mdast";
import type { VFile } from "vfile";
import { check, IMG_STYLE, LANG, problemsHeading, problemText, render, renderFailure, svgDataUrl, type Problem } from "../../../shared/board.js";

export interface Options {
  /** Draw flow arrows between screens. Default true. */
  flows?: boolean;
  /** Fail the build when a wireframe has problems, instead of listing them on the page. Default false. */
  strict?: boolean;
}

export default function remarkTsquare(options: Options = {}) {
  const flows = options.flows ?? true;
  const strict = options.strict ?? false;

  return async function transform(tree: Root, file: VFile) {
    const blocks: { node: Code; parent: Parent; index: number }[] = [];
    collect(tree, blocks);
    // every board at once; each replaces its own code block, so the order doesn't matter
    await Promise.all(
      blocks.map(async ({ node, parent, index }) => {
        const text = node.value;
        const checked = check(text, flows);
        let replacement: Element;
        if (checked.ok) {
          try {
            const svg = await render(text, checked.spec, flows);
            replacement = h("figure", { className: ["tsquare-board"] }, [
              h("img", { src: svgDataUrl(svg), alt: checked.alt, width: checked.width, height: checked.height, style: IMG_STYLE }),
            ]);
          } catch (err) {
            replacement = report(file, node, [renderFailure(err)], strict);
          }
        } else {
          replacement = report(file, node, checked.problems, strict);
        }
        parent.children[index] = asMdast(replacement, node);
      }),
    );
  };
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
    console.warn(`${file.path ?? "Markdown"}:${message.line ?? "?"}:${message.column ?? "?"}: ${message.reason}`);
  }
  return h("div", { className: ["tsquare-problems"], role: "note" }, [
    h("strong", {}, [{ type: "text", value: problemsHeading(problems) }]),
    h("ul", {}, problems.map((p) => h("li", {}, [{ type: "text", value: problemText(p) }]))),
  ]);
}

function h(tagName: string, properties: Element["properties"], children: ElementContent[] = []): Element {
  return { type: "element", tagName, properties, children };
}

/** An mdast node that remark-rehype (and MDX) turns into the given element, in place of the code block. */
function asMdast(element: Element, code: Code): RootContent {
  return {
    type: "tsquareBoard",
    position: code.position,
    data: { hName: element.tagName, hProperties: element.properties, hChildren: element.children },
  } as unknown as RootContent;
}
