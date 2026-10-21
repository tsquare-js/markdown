/**
 * The zoom script: a click on a board opens it in tsquare's viewer (zoom, pan, pinch, a button per
 * screen, Esc to close) instead of the plain full-size view. Browser code; each package publishes it
 * as "<package>/client", and the plugins import it into MDX pages that have a board. One listener on
 * the document, so boards that a docs site swaps in later (client-side navigation) work too.
 */
import { createViewer, type Viewer } from "tsquare/viewer";

const STYLES = `.tsquare-viewer{width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:rgba(18,22,30,.96);color:#f3f5f8;font:14px system-ui,sans-serif}
.tsquare-viewer[open]{display:grid;grid-template-rows:auto 1fr}
.tsquare-viewer-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) 10px max(12px,env(safe-area-inset-left,0px))}
.tsquare-viewer-screens{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}
.tsquare-viewer-bar button{font:600 13px system-ui,sans-serif;color:inherit;background:rgba(255,255,255,.12);border:0;border-radius:6px;padding:7px 11px;cursor:pointer;font-variant-numeric:tabular-nums}
.tsquare-viewer-bar button[aria-pressed=true]{background:#fff;color:#172033}
.tsquare-viewer-bar button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.tsquare-viewer-stage{min-height:0;cursor:grab}
.tsquare-viewer-stage.panning{cursor:grabbing}
.tsquare-viewer-stage.animate>*{transition:transform .25s ease}
@media (prefers-reduced-motion:reduce){.tsquare-viewer-stage.animate>*{transition:none}}`;

const SVG_URL = "data:image/svg+xml,";

let dialog: HTMLDialogElement | null = null;
let viewer: Viewer | null = null;

/** Starts listening for clicks on boards (once per page; importing it again does nothing). */
export function install() {
  if (typeof document === "undefined") return; // the server render of an MDX page imports it too
  const w = window as { __tsquareZoom?: boolean };
  if (w.__tsquareZoom) return;
  w.__tsquareZoom = true;
  document.documentElement.dataset.tsquareZoom = "script"; // for the styles, and to tell it's loaded
  document.addEventListener("click", (event) => {
    const open = event.target instanceof Element ? event.target.closest(".tsquare-open") : null;
    const figure = open?.closest(".tsquare-board");
    const img = figure?.querySelector("img");
    if (!figure || !img?.src.startsWith(SVG_URL)) return;
    event.preventDefault(); // the viewer instead of the plain full-size view
    const zoom = figure.querySelector<HTMLElement>(".tsquare-zoom");
    if (zoom?.matches?.(":popover-open")) zoom.hidePopover();
    show(img, JSON.parse(figure.getAttribute("data-tsquare-screens") ?? "[]"));
  });
}

function show(img: HTMLImageElement, screens: { name: string; x: number; y: number; width: number; height: number }[]) {
  if (!dialog) dialog = build();
  dialog.setAttribute("aria-label", img.alt || "Wireframe");
  dialog.showModal();
  const svg = decodeURIComponent(img.src.slice(SVG_URL.length));
  const width = Number(img.getAttribute("width")) || img.naturalWidth;
  const height = Number(img.getAttribute("height")) || img.naturalHeight;
  viewer!.show(svg, width, height, screens.map((s) => ({ type: "Screen" as const, ...s })));
  viewer!.fit();
}

function build() {
  const style = document.createElement("style");
  style.textContent = STYLES;
  document.head.append(style);
  const el = document.createElement("dialog");
  el.className = "tsquare-viewer";
  el.innerHTML = `<div class="tsquare-viewer-bar">
  <div class="tsquare-viewer-screens"></div>
  <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
  <button type="button" data-zoom="fit" aria-label="Fit the board">100%</button>
  <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
  <button type="button" data-close>Close</button>
</div>
<div class="tsquare-viewer-stage"><div></div></div>`;
  document.body.append(el);
  const $ = (selector: string) => el.querySelector<HTMLElement>(selector)!;
  viewer = createViewer({
    stage: $(".tsquare-viewer-stage"),
    canvas: $(".tsquare-viewer-stage > div"),
    screens: $(".tsquare-viewer-screens"),
    zoomIn: $("[data-zoom=in]"),
    zoomOut: $("[data-zoom=out]"),
    zoomFit: $("[data-zoom=fit]"),
  });
  $("[data-close]").addEventListener("click", () => el.close());
  return el;
}

install();
