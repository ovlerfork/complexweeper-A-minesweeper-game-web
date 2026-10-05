import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
export default defineConfig({
  base: "./",
  define: {
    __SOURCE_URL__: JSON.stringify(`https://github.com/ovlerfork/complexweeper-A-minesweeper-game-web/tree/${revision}`),
  },
});
