import { Game, PRESETS, TYPES } from "./game";
import "./style.css";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header><div class="brand"><span class="brand-mark">√</span><div><h1>复扫雷</h1><p>Complexweeper</p></div></div><span class="tagline">四种雷，一个复数世界。</span></header>
<section class="game" aria-label="复扫雷游戏">
<div class="toolbar"><label class="difficulty">难度 <select id="difficulty">${PRESETS.map((p, i) => `<option value="${i}">${p.label}</option>`).join("")}<option value="custom">自定义</option></select></label><button id="restart">↻ 新一局</button></div>
<form id="custom" hidden><div class="custom-fields"><label>宽<input name="width" type="number" min="9" max="40" value="16" required></label><label>高<input name="height" type="number" min="9" max="30" value="16" required></label>${TYPES.slice(
  1,
)
  .map(
    (t) =>
      `<label>${t} 雷<input name="count" type="number" min="0" max="999" value="10" required></label>`,
  )
  .join(
    "",
  )}<button type="submit">开始自定义</button></div><p id="custom-error" role="alert"></p></form>
<div class="dashboard"><div class="mine-counts">${TYPES.slice(1)
  .map(
    (t, i) =>
      `<div class="counter type-${i + 1}"><span>${t}</span><strong id="count-${i + 1}">—</strong></div>`,
  )
  .join(
    "",
  )}</div><div class="time"><span>用时</span><strong id="time">00:00</strong></div></div>
<div class="play-toolbar"><div class="mode" role="group" aria-label="点击操作"><button id="reveal-mode" aria-pressed="true">翻开</button><button id="flag-mode" aria-pressed="false">⚑ 标旗</button></div><span id="progress">0 / 71 安全格</span></div>
<div class="board-scroll" tabindex="0" aria-label="盘面滚动区域"><div id="board" class="board" role="group" aria-label="扫雷盘面"></div></div>
<div class="game-status"><span id="status" role="status">点击任意格子开始</span><span id="moves">0 步</span></div>
<div class="copy-bar"><label>盘面格式 <select id="format"><option value="csv">CSV</option><option value="text">纯文本（制表符）</option></select></label><button id="copy">⧉ 复制盘面</button><span id="copy-status" role="status"></span></div>
<div id="manual" hidden><label for="copy-text">请选中下方盘面并手动复制</label><textarea id="copy-text" readonly spellcheck="false"></textarea><button id="select-copy">全选盘面</button></div>
</section>
<details class="rules"><summary>怎么玩？</summary><div><p>雷有 +1、−1、+i、−i 四种。数字是周围八格雷之和的模长，例如 +1 和 +i 得到 √2。</p><p>空白表示周围无雷，会连片展开；0 表示周围有雷但互相抵消。翻开全部安全格即可获胜，第一次翻开及其邻格无雷。</p><p>右键或「标旗」模式循环：空 → +1 → −1 → +i → −i → 空。点击已翻开的数字格或使用中键可展开邻格：旗帜总数须等于真实雷数，实虚比例须符合真实比例或其倒数。旗的位置错误仍可能踩雷。</p><p>上方四个计数是各类雷总数减去对应旗帜数，开局后显示。复制只包含当前可见信息。</p></div></details>
<footer>复数相加，推理不止于数字。</footer>`;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let game = new Game(PRESETS[0]);
let mode: "reveal" | "flag" = "reveal";
let cells: HTMLButtonElement[] = [];
function createBoard(): void {
  const board = element<HTMLDivElement>("board");
  board.replaceChildren();
  board.style.setProperty("--columns", String(game.config.width));
  cells = game.mine.map((_, i) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.addEventListener("click", () => {
      if (game.open[i]) game.chord(i);
      else if (mode === "flag") game.cycleFlag(i);
      else game.reveal(i);
      render();
    });
    cell.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      game.cycleFlag(i);
      render();
    });
    cell.addEventListener("mousedown", (e) => {
      if (e.button === 1) e.preventDefault();
    });
    cell.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        game.chord(i);
        render();
      }
    });
    board.append(cell);
    return cell;
  });
  render();
}
function render(): void {
  cells.forEach((cell, i) => {
    const token = game.token(i),
      isMine = token.startsWith("M"),
      isFlag = token.includes("F");
    cell.className = `cell ${game.open[i] ? "opened" : ""} ${isMine ? "mine" : ""} ${isFlag ? "flag" : ""} ${token.startsWith("X") ? "wrong" : ""} ${game.boom === i ? "boom" : ""}`;
    const type = isMine ? game.mine[i] : isFlag ? game.flag[i] : 0;
    if (type) cell.classList.add(`type-${type}`);
    cell.textContent =
      token === "?" || token === "_"
        ? ""
        : isMine
          ? `✹${TYPES[type]}`
          : isFlag
            ? `${token.startsWith("X") ? "×" : "⚑"}${TYPES[type]}`
            : token;
    const row = Math.floor(i / game.config.width) + 1,
      col = (i % game.config.width) + 1;
    cell.setAttribute(
      "aria-label",
      `第 ${row} 行第 ${col} 列，${token === "?" ? "未翻开" : token === "_" ? "空白" : isMine ? `${TYPES[type]} 雷` : isFlag ? `${token.startsWith("X") ? "错误" : "已标"} ${TYPES[type]} 旗` : token}`,
    );
    cell.disabled = game.over;
  });
  TYPES.slice(1).forEach((_, i) => {
    element(`count-${i + 1}`).textContent = game.started
      ? String(game.totals[i + 1] - game.flag.filter((t) => t === i + 1).length)
      : "—";
  });
  element("status").textContent = game.message;
  element("status").className = game.over
    ? game.win
      ? "win-text"
      : "loss-text"
    : "";
  element("moves").textContent = `${game.moves} 步`;
  element("progress").textContent =
    `${game.open.filter((o, i) => o && !game.mine[i]).length} / ${game.mine.length - game.config.mines} 安全格`;
  updateTime();
}
function updateTime(): void {
  const seconds = Math.floor(
    (game.started
      ? game.over
        ? game.elapsed
        : Date.now() - game.startedAt
      : 0) / 1000,
  );
  element("time").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function restart(config = game.config): void {
  game = new Game(config);
  element("copy-status").textContent = "";
  element("manual").hidden = true;
  createBoard();
}
element("restart").addEventListener("click", () => restart());
element<HTMLSelectElement>("difficulty").addEventListener("change", (e) => {
  const value = (e.target as HTMLSelectElement).value;
  element("custom").hidden = value !== "custom";
  if (value !== "custom") restart(PRESETS[Number(value)]);
});
element<HTMLFormElement>("custom").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = element<HTMLFormElement>("custom"),
    data = new FormData(form);
  const width = Number(data.get("width")),
    height = Number(data.get("height")),
    counts = data.getAll("count").map(Number),
    mines = counts.reduce((a, b) => a + b, 0);
  if (
    !Number.isInteger(width) ||
    width < 9 ||
    width > 40 ||
    !Number.isInteger(height) ||
    height < 9 ||
    height > 30 ||
    counts.some((n) => !Number.isInteger(n) || n < 0 || n > 999) ||
    mines < 1 ||
    mines > width * height - 9
  ) {
    element("custom-error").textContent =
      `宽度 9–40，高度 9–30；雷数合计须在 1–${width * height - 9} 之间。`;
    return;
  }
  element("custom-error").textContent = "";
  restart({ width, height, mines, counts });
});
for (const nextMode of ["reveal", "flag"] as const)
  element(`${nextMode}-mode`).addEventListener("click", () => {
    mode = nextMode;
    for (const option of ["reveal", "flag"])
      element(`${option}-mode`).setAttribute(
        "aria-pressed",
        String(option === mode),
      );
  });
element("copy").addEventListener("click", async () => {
  const format = element<HTMLSelectElement>("format").value as "csv" | "text",
    text = game.export(format);
  element("manual").hidden = true;
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    element("copy-status").textContent = "盘面已复制";
  } catch {
    element("copy-status").textContent = "自动复制不可用，请手动复制";
    element("manual").hidden = false;
    const textarea = element<HTMLTextAreaElement>("copy-text");
    textarea.value = text;
    textarea.focus();
    textarea.select();
  }
});
element("select-copy").addEventListener("click", () => {
  const textarea = element<HTMLTextAreaElement>("copy-text");
  textarea.focus();
  textarea.select();
});
setInterval(updateTime, 500);
createBoard();
