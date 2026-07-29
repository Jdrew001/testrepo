import { pathToFileURL } from "node:url";
import { failure } from "./terminal.mjs";

export function isDirectRun(metaUrl) {
  return process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;
}

export function runMain(main) {
  main().catch((error) => {
    console.error("");
    failure(error.message);
    process.exit(1);
  });
}
