import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
let sourceUrl = "https://github.com/ovlerfork/complexweeper-A-minesweeper-game-web";
try {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  sourceUrl += `/tree/${revision}`;
} catch {
  // Source archives can be built without Git metadata or a Git executable.
}
export default defineConfig({
  base: "./",
  define: {
    __SOURCE_URL__: JSON.stringify(sourceUrl),
  },
});
