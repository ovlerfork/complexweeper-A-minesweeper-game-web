import { Game, PRESETS, TYPES, splitEvenly } from "./game";
import "./style.css";
import { encodeGame, decodeGame } from "./share";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header><div class="brand"><span class="brand-mark">√</span><div><h1>复扫雷</h1><p>Complexweeper</p></div></div><nav aria-label="游戏菜单"><button id="records">纪录</button><button id="rules">玩法</button><button id="about">关于</button><button id="exit">结束</button></nav></header>
<section class="game" aria-label="复扫雷游戏">
<div class="toolbar"><label class="difficulty">难度 <select id="difficulty">${PRESETS.map((p, i) => `<option value="${i}">${p.label}</option>`).join("")}<option value="custom">自定义</option></select></label><div class="game-controls"><label>缩放 <select id="zoom"><option value="1">100%</option><option value="2" selected>200%</option><option value="3">300%</option></select></label><button id="restart">↻ 新一局</button></div></div>
<form id="custom" hidden><div class="custom-fields"><label>宽<input name="width" type="number" min="9" max="40" value="16" required></label><label>高<input name="height" type="number" min="9" max="30" value="16" required></label>${TYPES.slice(
  1,
)
  .map(
    (t) =>
      `<label>${t} 雷<input name="count" type="number" min="0" max="1191" value="10" required></label>`,
  )
  .join(
    "",
  )}<button id="split-counts" type="button">按合计均分</button><button type="submit">开始自定义</button></div><p id="custom-error" role="alert"></p></form>
<div class="dashboard"><div class="mine-counts">${TYPES.slice(1)
  .map(
    (t, i) =>
      `<div class="counter type-${i + 1}"><span>${t}</span><strong id="count-${i + 1}">—</strong></div>`,
  )
  .join(
    "",
  )}</div><button id="face" class="face" aria-label="开始新一局" title="开始新一局">:)</button><div class="time"><span>秒</span><strong id="time">—</strong></div></div>
<div class="play-toolbar"><div class="mode" role="group" aria-label="点击操作"><button id="reveal-mode" aria-pressed="true">翻开</button><button id="flag-mode" aria-pressed="false">⚑ 标旗</button><button id="chord-mode" aria-pressed="false">展开</button></div><span id="progress">0 / 71 安全格</span></div>
<div class="board-scroll" tabindex="0" aria-label="盘面滚动区域"><div id="board" class="board" role="group" aria-label="扫雷盘面"></div></div>
<div class="game-status"><span id="status" role="status">点击任意格子开始</span><span id="moves">0 步</span></div>
<div class="copy-bar"><label>盘面格式 <select id="format"><option value="csv">CSV</option><option value="text">纯文本（制表符）</option></select></label><button id="copy">⧉ 复制盘面</button><button id="share">↗ 分享对局</button><span id="copy-status" role="status"></span></div>
<div id="manual" hidden><label id="manual-label" for="copy-text">请选中下方文本并手动复制</label><textarea id="copy-text" readonly spellcheck="false"></textarea><button id="select-copy">全选文本</button></div>
</section>
<dialog id="info-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title"></h2><div id="dialog-body"></div><form method="dialog"><button>关闭</button></form></dialog>
<footer>复数相加，推理不止于数字。</footer>`;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let game = new Game(PRESETS[0]);
let mode: "reveal" | "flag" | "chord" = "reveal";
let active = true;
let settled = false;
let zoom = 2;
let scores = [0, 0, 0];
let scoresPersisted = true;
try {
  const saved: unknown = JSON.parse(
    localStorage.getItem("complexweeper-scores") || "null",
  );
  if (
    Array.isArray(saved) &&
    saved.length === 3 &&
    saved.every((n) => Number.isInteger(n) && n >= 0)
  )
    scores = saved;
} catch {
  scoresPersisted = false;
}
function dialog(title: string, body: string): void {
  element("dialog-title").textContent = title;
  element("dialog-body").innerHTML = body;
  const panel = element<HTMLDialogElement>("info-dialog");
  if (!panel.open) panel.showModal();
}
function showScores(highlight = false): void {
  dialog(
    highlight ? "新纪录！" : "最高分纪录",
    `<table>${["初级", "中级", "高级"].map((label, i) => `<tr><th>${label}</th><td>${scores[i] ? `${scores[i]} 秒` : "———"}</td></tr>`).join("")}</table>${scoresPersisted ? "" : "<p>浏览器不允许保存，纪录仅保留至本次页面关闭。</p>"}`,
  );
}
function settle(): void {
  if (!game.over || settled) return;
  settled = true;
  if (!game.win) return;
  const preset = PRESETS.findIndex(
    (p) =>
      p.width === game.config.width &&
      p.height === game.config.height &&
      p.mines === game.config.mines,
  );
  if (preset < 0) return;
  const seconds = Math.max(1, Math.floor(game.elapsed / 1000));
  if (scores[preset] && seconds >= scores[preset]) return;
  scores[preset] = seconds;
  try {
    localStorage.setItem("complexweeper-scores", JSON.stringify(scores));
  } catch {
    scoresPersisted = false;
  }
  showScores(true);
}
let held = -1;
let chordHeld = false;
let leftDown = false;
let rightDown = false;
let middleDown = false;
let consumed = false;
let facePressed = false;
let flashUntil = 0;
let suppressMouseUntil = 0;
function clearPress(): void {
  held = -1;
  chordHeld = false;
  leftDown = false;
  rightDown = false;
  middleDown = false;
  consumed = false;
}
function act(action: () => void): void {
  if (!active) return;
  action();
  flashUntil = Date.now() + 150;
  render();
}
function mouseCell(event: MouseEvent): number {
  const cell = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLButtonElement>(".cell");
  return cell ? Number(cell.dataset.cell) : -1;
}

let cells: HTMLButtonElement[] = [];
function createBoard(): void {
  const board = element<HTMLDivElement>("board");
  board.replaceChildren();
  board.style.setProperty("--zoom", String(zoom));
  board.style.setProperty("--columns", String(game.config.width));
  cells = game.mine.map((_, i) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.cell = String(i);
    cell.addEventListener("click", (e) => {
      if ((e as MouseEvent).detail === 0)
        act(() => {
          if (mode === "flag") game.cycleFlag(i);
          else if (mode === "chord") game.chord(i);
          else game.reveal(i);
        });
    });
    cell.addEventListener("contextmenu", (e) => e.preventDefault());
    cell.addEventListener("auxclick", (e) => e.preventDefault());
    cell.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") suppressMouseUntil = Date.now() + 800;
    });
    cell.addEventListener("mousedown", (e) => {
      if (!active || game.over || Date.now() < suppressMouseUntil) return;
      e.preventDefault();
      if (e.button === 0) leftDown = true;
      if (e.button === 2) rightDown = true;
      if (e.button === 1) middleDown = true;
      held = i;
      chordHeld =
        middleDown || (leftDown && rightDown) || (leftDown && mode === "chord");
      if (chordHeld) consumed = false;
      else if (e.button === 2) act(() => game.cycleFlag(i));
      render();
    });
    cell.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      act(() => {
        if (mode === "flag") game.cycleFlag(i);
        else if (mode === "chord") game.chord(i);
        else game.reveal(i);
      });
    });
    board.append(cell);
    return cell;
  });
  render();
}
document.addEventListener("mousemove", (e) => {
  if (!leftDown && !middleDown && !chordHeld) return;
  held = mouseCell(e);
  render();
});
document.addEventListener("mouseup", (e) => {
  if (Date.now() < suppressMouseUntil) return;
  const target = mouseCell(e);
  if (!consumed && target >= 0 && target === held) {
    if (chordHeld) {
      consumed = true;
      act(() => game.chord(target));
    } else if (e.button === 0 && leftDown)
      act(() =>
        mode === "flag" ? game.cycleFlag(target) : game.reveal(target),
      );
  }
  if (e.button === 0) leftDown = false;
  if (e.button === 2) rightDown = false;
  if (e.button === 1) middleDown = false;
  if (!leftDown && !rightDown && !middleDown) clearPress();
  else {
    held = -1;
    chordHeld = false;
  }
  render();
});
window.addEventListener("blur", () => {
  clearPress();
  render();
});
function render(): void {
  const preview =
    held >= 0 && chordHeld && game.open[held] && !game.over
      ? new Set(
          game.neighbors(held).filter((j) => !game.open[j] && !game.flag[j]),
        )
      : new Set<number>();
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
    if (
      preview.has(i) ||
      (i === held && leftDown && !chordHeld && !game.open[i] && !game.flag[i])
    )
      cell.classList.add("pressed");
    cell.disabled = game.over || !active;
  });
  TYPES.slice(1).forEach((_, i) => {
    element(`count-${i + 1}`).textContent = game.started
      ? String(game.totals[i + 1] - game.flag.filter((t) => t === i + 1).length)
      : "—";
  });
  element("status").textContent = active
    ? game.message
    : "本局已结束，点击新一局继续";
  element("status").className = game.over
    ? game.win
      ? "win-text"
      : "loss-text"
    : "";
  element("moves").textContent = `${game.moves} 步`;
  element("progress").textContent =
    `${game.open.filter((o, i) => o && !game.mine[i]).length} / ${game.mine.length - game.config.mines} 安全格`;
  updateTime();
  updateFace();
  settle();
}
function updateFace(): void {
  element("face").textContent = facePressed
    ? ":|"
    : game.over
      ? game.win
        ? ":D"
        : ":("
      : held >= 0 || Date.now() < flashUntil
        ? ":O"
        : ":)";
}
function updateTime(): void {
  const seconds = Math.min(
    9999,
    Math.floor(
      (game.started
        ? game.over || !active
          ? game.elapsed
          : Date.now() - game.startedAt
        : 0) / 1000,
    ),
  );
  element("time").textContent = game.started
    ? String(seconds).padStart(4, "0")
    : "—";
}
function restart(config = game.config): void {
  game = new Game(config);
  active = true;
  settled = false;
  clearPress();
  element("copy-status").textContent = "";
  element("manual").hidden = true;
  history.replaceState(null, "", location.pathname + location.search);
  createBoard();
}
element("restart").addEventListener("click", () => restart());
element("face").addEventListener("click", () => restart());
element("face").addEventListener("pointerdown", () => {
  facePressed = true;
  updateFace();
});
document.addEventListener("pointerup", () => {
  facePressed = false;
  updateFace();
});
document.addEventListener("pointercancel", () => {
  facePressed = false;
  clearPress();
  render();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "F2") {
    e.preventDefault();
    restart();
  }
});
element("zoom").addEventListener("change", () => {
  zoom = Number(element<HTMLSelectElement>("zoom").value);
  element("board").style.setProperty("--zoom", String(zoom));
});
element("records").addEventListener("click", () => showScores());
element("rules").addEventListener("click", () =>
  dialog(
    "玩法与操作",
    "<p>雷有 +1、−1、+i、−i 四种。数字为周围八格雷之和的模长，显示为整数或最简根式。</p><p>空白周围无雷，会连片展开；0 周围有雷但互相抵消。翻开所有安全格即可获胜。首次翻开及其邻格无雷。</p><p>左键翻开；右键循环标旗；中键或左右键同时按住预览，松手展开。手机使用翻开、标旗、展开模式。F2 或人脸按钮开始新一局。</p><p>展开时，旗数须等于真实雷数，实虚数量须符合真实比例或其倒数。旗的位置错误仍可能踩雷。</p><p>计数是对应雷总数减去对应旗数，首次翻开后显示。复制只包含当前可见信息。</p>",
  ),
);
element("about").addEventListener("click", () =>
  dialog(
    "关于复扫雷",
    '<div class="about-brand"><span class="brand-mark">√</span><strong>复扫雷 Complexweeper · 网页版</strong></div><p>基于 Microsoft® 扫雷，原版作者 Robert Donner、Curt Johnson。</p><p>原生版本及新增原生素材：青月晓。网页版以文字与 CSS 绘制盘面。</p><p>Copyright © 2026 青月晓<br>免费软件，代码采用 GPL-3.0 授权。与 Microsoft 公司无隶属关系。</p>',
  ),
);
element("exit").addEventListener("click", () => {
  if (game.started && !game.over) game.elapsed = Date.now() - game.startedAt;
  active = false;
  clearPress();
  render();
});
function prefillCustom(): void {
  const form = element<HTMLFormElement>("custom");
  (form.elements.namedItem("width") as HTMLInputElement).value = String(
    game.config.width,
  );
  (form.elements.namedItem("height") as HTMLInputElement).value = String(
    game.config.height,
  );
  const counts = game.config.counts?.some(Boolean)
    ? game.config.counts
    : splitEvenly(game.config.mines);
  form
    .querySelectorAll<HTMLInputElement>('input[name="count"]')
    .forEach((input, i) => (input.value = String(counts[i])));
  element("custom-error").textContent = "";
  updateCountLimits();
}
function updateCountLimits(): void {
  const form = element<HTMLFormElement>("custom"),
    data = new FormData(form);
  const max = Number(data.get("width")) * Number(data.get("height")) - 9;
  form
    .querySelectorAll<HTMLInputElement>('input[name="count"]')
    .forEach((input) => (input.max = String(Math.max(0, max))));
}
element("split-counts").addEventListener("click", () => {
  const inputs = element("custom").querySelectorAll<HTMLInputElement>(
    'input[name="count"]',
  );
  const total = Array.from(inputs).reduce(
    (sum, input) =>
      sum + Math.min(100000, Number(input.value.replace(/\D/g, ""))),
    0,
  );
  const counts = splitEvenly(Math.min(total > 0 ? total : 99, 999));
  inputs.forEach((input, i) => {
    input.value = String(counts[i]);
  });
});
element("custom").addEventListener("input", updateCountLimits);
element<HTMLSelectElement>("difficulty").addEventListener("change", (e) => {
  const value = (e.target as HTMLSelectElement).value;
  element("custom").hidden = value !== "custom";
  if (value !== "custom") restart(PRESETS[Number(value)]);
  else prefillCustom();
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
    counts.some(
      (n) => !Number.isInteger(n) || n < 0 || n > width * height - 9,
    ) ||
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
for (const nextMode of ["reveal", "flag", "chord"] as const)
  element(`${nextMode}-mode`).addEventListener("click", () => {
    mode = nextMode;
    for (const option of ["reveal", "flag", "chord"])
      element(`${option}-mode`).setAttribute(
        "aria-pressed",
        String(option === mode),
      );
  });
async function copyText(text: string, label: string): Promise<void> {
  element("manual").hidden = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    element("copy-status").textContent = `${label}已复制`;
  } catch {
    element("copy-status").textContent = "自动复制不可用，请手动复制";
    element("manual-label").textContent = `请选中下方${label}并手动复制`;
    element("manual").hidden = false;
    const textarea = element<HTMLTextAreaElement>("copy-text");
    textarea.value = text;
    textarea.focus();
    textarea.select();
  }
}
element("copy").addEventListener("click", () => {
  const format = element<HTMLSelectElement>("format").value as "csv" | "text";
  void copyText(game.export(format), "盘面");
});
element("share").addEventListener("click", () => {
  const url = new URL(location.href);
  url.hash = `game=${encodeGame(game, active)}`;
  void copyText(url.href, "对局链接");
});
element("select-copy").addEventListener("click", () => {
  const textarea = element<HTMLTextAreaElement>("copy-text");
  textarea.focus();
  textarea.select();
});
setInterval(() => {
  updateTime();
  updateFace();
}, 100);
function loadSharedGame(): void {
  if (!location.hash.startsWith("#game=")) return;
  try {
    const restored = decodeGame(location.hash.slice(6));
    game = restored.game;
    active = restored.active;
    settled = game.over;
    clearPress();
    const preset = game.config.counts ? -1 : PRESETS.findIndex(p =>
      p.width === game.config.width && p.height === game.config.height && p.mines === game.config.mines);
    element<HTMLSelectElement>("difficulty").value = preset < 0 ? "custom" : String(preset);
    element("custom").hidden = preset >= 0;
    if (preset < 0) prefillCustom();
    element("copy-status").textContent = "分享对局已载入";
  } catch (error) {
    element("copy-status").textContent = error instanceof Error ? error.message : "无法载入分享对局";
  }
}
window.addEventListener("hashchange", () => {
  loadSharedGame();
  createBoard();
});
loadSharedGame();
createBoard();
