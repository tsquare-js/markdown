// Draws a board in a worker thread: markdown-it renders synchronously and tsquare's renderer is async,
// so index.ts waits for this worker with synckit. The spec comes checked from the main thread.
import { runAsWorker } from "synckit";
import type { CompileResult } from "tsquare";
import { draw } from "../../../shared/board.js";

runAsWorker(async (spec: NonNullable<CompileResult["spec"]>, flows: boolean) => draw(spec, flows));
