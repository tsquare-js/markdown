/**
 * The HTML every plugin makes, as hast elements: remark-tsquare hands them to remark-rehype (and MDX),
 * markdown-it-tsquare turns them into a string. One place, so both plugins' pages look the same.
 */
import type { Element, ElementContent } from "hast";
import { EXPAND_ICON_PATH, IMG_STYLE, problemsHeading, problemText, ZOOM_CSS, ZOOM_INLINE, type Problem, type Screen } from "./board.js";

export function h(tagName: string, properties: Element["properties"], children: ElementContent[] = []): Element {
  return { type: "element", tagName, properties, children };
}

const text = (value: string): ElementContent => ({ type: "text", value });

export interface BoardMarkup {
  /** The SVG's data: URL. */
  src: string;
  alt: string;
  width: number;
  height: number;
  screens: Screen[];
  /** The popover's id when the board can zoom (boardId), or null. */
  zoomId: string | null;
  /** The playground link, or null. */
  href: string | null;
}

/**
 * <figure class="tsquare-board"> with the board's <img>. A board that zooms wraps it in a button
 * inside a popover (styled by ZOOM_CSS to sit in the page until it's opened), and lists its screens
 * for the viewer.
 */
export function boardElement(board: BoardMarkup): Element {
  const img = h("img", { src: board.src, alt: board.alt, width: board.width, height: board.height, style: IMG_STYLE });
  const caption = board.href
    ? [h("figcaption", { className: ["tsquare-caption"] }, [h("a", { className: ["tsquare-link"], href: board.href, target: "_blank", rel: ["noopener"] }, [text("Open in playground")])])]
    : [];
  if (!board.zoomId) return h("figure", { className: ["tsquare-board"] }, [img, ...caption]);
  const id = board.zoomId;
  return h("figure", { className: ["tsquare-board"], dataTsquareScreens: JSON.stringify(board.screens) }, [
    h("div", { popover: "auto", id, className: ["tsquare-zoom"], style: ZOOM_INLINE.wrapper }, [
      h("button", { type: "button", className: ["tsquare-open"], popoverTarget: id, ariaLabel: `Show ${board.alt.toLowerCase()} at full size`, style: ZOOM_INLINE.open }, [img, badge()]),
      h("button", { type: "button", className: ["tsquare-close"], popoverTarget: id, popoverTargetAction: "hide", style: ZOOM_INLINE.close }, [text("Close")]),
    ]),
    ...caption,
  ]);
}

function badge(): Element {
  const path = h("path", { d: EXPAND_ICON_PATH, fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" });
  return h("span", { className: ["tsquare-badge"], ariaHidden: "true", style: ZOOM_INLINE.badge }, [h("svg", { viewBox: "0 0 24 24", width: 14, height: 14 }, [path])]);
}

/** <div class="tsquare-problems"> listing them by line, in place of the board. */
export function problemsElement(problems: Problem[]): Element {
  return h("div", { className: ["tsquare-problems"], role: "note" }, [
    h("strong", {}, [text(problemsHeading(problems))]),
    h("ul", {}, problems.map((p) => h("li", {}, [text(problemText(p))]))),
  ]);
}

/** The full-size view's styles, once per page that has a board that zooms. */
export function zoomStyleElement(): Element {
  return h("style", {}, [text(ZOOM_CSS)]);
}

/**
 * The same styles as a stylesheet link with the CSS inside it, for markdown-it: VitePress compiles
 * pages into Vue templates, which drop <style> but keep <link>.
 */
export function zoomStyleLinkElement(): Element {
  return h("link", { rel: ["stylesheet"], href: "data:text/css," + encodeURIComponent(ZOOM_CSS) });
}

/** "docs/intro.md:26:1: tsquare: …", for the build log. */
export function logLine(path: string | undefined, line: number | undefined, column: number | undefined, message: string) {
  return `${path ?? "Markdown"}:${line ?? "?"}:${column ?? "?"}: tsquare: ${message}`;
}
