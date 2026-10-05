import { Game, PRESETS, TYPES, splitEvenly } from "./game";
import "./style.css";
import { encodeGame, decodeGame } from "./share";
import atlas from "../素材/图集.json";
declare const __SOURCE_URL__: string;
const atlasUrl = new URL("../素材/图集.png", import.meta.url).href;
const sprites = new Map(atlas.slots.map(slot => [slot.name, slot]));
function sprite(target: HTMLElement, name: string): void {
  const rect = sprites.get(name)!;
  target.style.backgroundImage = `url("${atlasUrl}")`;
  target.style.backgroundPosition = `calc(${-rect.x}px * var(--zoom)) calc(${-rect.y}px * var(--zoom))`;
  target.style.backgroundSize = `calc(${atlas.width}px * var(--zoom)) calc(${atlas.height}px * var(--zoom))`;
}
function led(target: HTMLElement, value: number | null, imaginary = false): void {
  const base = imaginary ? 3 : 4;
  const digits = value === null ? base : Math.max(base, String(Math.abs(value)).length + Number(value < 0));
  const text = value === null ? " ".repeat(digits) : (value < 0 ? "-" : "") + String(Math.abs(value)).padStart(digits - Number(value < 0), "0");
  target.replaceChildren(...Array.from(text + (imaginary ? value === null ? " " : "i" : ""), ch => {
    const digit = document.createElement("span");
    digit.className = "led-digit";
    sprite(digit, `led_${ch === " " ? "blank" : ch === "-" ? "minus" : ch}`);
    return digit;
  }));
  target.setAttribute("aria-label", value === null ? "未开始" : `${value}${imaginary ? "i" : ""}`);
}
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<section class="game" aria-label="复扫雷游戏">
<nav class="menu-bar" aria-label="游戏菜单"><details><summary>游戏(G)</summary><div class="menu">
<button id="restart">开局(N)<span>F2</span></button><hr>
${PRESETS.map((p, i) => `<button data-difficulty="${i}">${["初级(B)", "中级(I)", "高级(E)"][i]}<span>${p.width}×${p.height} · ${p.mines} 雷</span></button>`).join("")}
<button data-difficulty="custom">自定义(C)…</button><hr><button id="records">最高分纪录(R)…</button><hr>
<button data-zoom="fit">适应窗口</button>
${[1, 2, 3].map(value => `<button data-zoom="${value}">${value * 100}%</button>`).join("")}
<button data-zoom="custom">自定义…</button>
<hr><label class="menu-setting">中键行为<select id="middle-action"><option value="question">问号标记</option><option value="chord">展开邻格</option></select></label><hr><button id="exit">退出(X)</button></div></details><details><summary>帮助(H)</summary><div class="menu"><button id="rules">玩法与操作(H)</button><hr><button id="about">关于复扫雷(A)…</button></div></details></nav>
<select id="difficulty" hidden>${PRESETS.map((p, i) => `<option value="${i}">${p.label}</option>`).join("")}<option value="custom">自定义</option></select>
<div class="native-scroll"><div class="native-frame">
<div class="dashboard"><div class="mine-counts">${TYPES.slice(1).map((t, i) => `<div class="counter" aria-label="${t} 剩余雷数"><span class="counter-flag" id="flag-icon-${i+1}"></span><strong id="count-${i+1}"></strong></div>`).join("")}</div><button id="face" class="face" aria-label="开始新一局" title="开始新一局"></button><div class="time"><strong id="time" aria-label="计时"></strong></div></div>
<div class="board-scroll" tabindex="0" aria-label="盘面滚动区域"><div id="board" class="board" role="group" aria-label="扫雷盘面"></div></div>
</div></div>
<div class="play-toolbar"><div class="mode" role="group" aria-label="点击操作"><button id="reveal-mode" aria-pressed="true">翻开</button><button id="flag-mode" aria-pressed="false">⚑ 标旗</button><button id="question-mode" aria-pressed="false" title="引号标记问号；同格按蓝→灭→紫→灭→棕→灭→绿→灭循环；Shift 点击或 Shift+引号清除">? 问号</button><button id="chord-mode" aria-pressed="false">展开</button></div><span id="remaining-mines">剩余雷：10</span><span id="progress">0 / 71 安全格</span></div>
<div class="game-status"><span id="status" role="status">点击任意格子开始</span><span id="moves">0 步</span></div>
<div class="copy-bar"><label>盘面格式 <select id="format"><option value="csv">CSV</option><option value="text">纯文本（制表符）</option></select></label><button id="copy">⧉ 复制盘面</button><button id="share">↗ 分享对局</button><span id="copy-status" role="status"></span></div>
<div id="manual" hidden><label id="manual-label" for="copy-text">请选中下方文本并手动复制</label><textarea id="copy-text" readonly spellcheck="false"></textarea><button id="select-copy">全选文本</button></div>
</section>
<dialog id="custom-dialog" aria-labelledby="custom-title"><h2 id="custom-title">自定义</h2><form id="custom"><div class="custom-fields"><label>宽<input name="width" type="number" min="9" max="40" value="16" required></label><label>高<input name="height" type="number" min="9" max="30" value="16" required></label>${TYPES.slice(
  1,
)
  .map(
    (t) =>
      `<label>${t} 雷<input name="count" type="number" min="0" max="1191" value="10" required></label>`,
  )
  .join(
    "",
  )}<button id="split-counts" type="button">按合计均分</button><button type="submit">开始自定义</button></div><p id="custom-error" role="alert"></p><button id="cancel-custom" type="button">取消</button></form></dialog>
<dialog id="zoom-dialog" aria-labelledby="zoom-title"><h2 id="zoom-title">自定义缩放</h2><form id="custom-zoom"><label>缩放 <input id="zoom-percent" type="number" min="1" step="any" value="100" aria-label="缩放百分比" required> %</label><div class="dialog-actions"><button type="submit">确定</button><button id="cancel-zoom" type="button">取消</button></div></form></dialog>
<dialog id="info-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title"></h2><div id="dialog-body"></div><form method="dialog"><button>关闭</button></form></dialog>
`;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let game = new Game(PRESETS[0]);
let mode: "reveal" | "flag" | "chord" | "question" = "reveal";
let middleAction: "question" | "chord" = "question";
let active = true;
let settled = false;
let zoom = 1;
let fitZoom = true;
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
let chordPreview = new Set<number>();
let leftDown = false;
let rightDown = false;
let middleDown = false;
let consumed = false;
let facePressed = false;
let flashUntil = 0;
function clearPress(): void {
  held = -1;
  chordHeld = false;
  chordPreview.clear();
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

let hoveredCell = -1;
function clickCell(i: number, clear = false): void {
  if (mode === "question") game.markQuestion(i, clear);
  else if (mode === "flag") game.cycleFlag(i);
  else if (mode === "chord") game.chord(i);
  else game.reveal(i);
}
let cells: HTMLButtonElement[] = [];
function createBoard(): void {
  const board = element<HTMLDivElement>("board");
  board.replaceChildren();
  hoveredCell = -1;
  element("app").style.setProperty("--zoom", String(zoom));
  element("app").style.setProperty("--board-width", `${game.config.width * 16}px`);
  board.style.setProperty("--columns", String(game.config.width));
  cells = game.mine.map((_, i) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.cell = String(i);
    cell.addEventListener("pointerenter", () => hoveredCell = i);
    cell.addEventListener("pointerleave", () => { if (hoveredCell === i) hoveredCell = -1; });
    cell.addEventListener("click", (e) => {
      if ((e as MouseEvent).detail === 0)
        act(() => clickCell(i, (e as MouseEvent).shiftKey));
    });
    cell.addEventListener("contextmenu", (e) => e.preventDefault());
    cell.addEventListener("auxclick", (e) => e.preventDefault());
    cell.addEventListener("pointerdown", (e) => {
      // Cancel compatibility mouse events; touch and pen act on pointerup.
      if (e.pointerType !== "mouse") e.preventDefault();
    });
    cell.addEventListener("mousedown", (e) => {
      if (!active || game.over) return;
      e.preventDefault();
      if (e.button === 0) leftDown = true;
      if (e.button === 2) rightDown = true;
      if (e.button === 1) middleDown = true;
      held = i;
      chordHeld =
        (leftDown && rightDown) || (leftDown && mode === "chord") ||
        (middleDown && middleAction === "chord");
      if (chordHeld) {
        consumed = false;
        chordPreview = new Set(game.chordTargets(i));
      } else {
        chordPreview.clear();
        if (e.button === 2) act(() => game.cycleFlag(i));
      }
      render();
    });
    cell.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      act(() => clickCell(i, e.shiftKey));
    });
    board.append(cell);
    return cell;
  });
  render();
  updateZoom();
}
document.addEventListener("mousemove", (e) => {
  if (!leftDown && !middleDown && !chordHeld) return;
  const next = mouseCell(e);
  if (next !== held) {
    held = next;
    chordPreview = new Set(chordHeld && held >= 0 ? game.chordTargets(held) : []);
  }
  render();
});
document.addEventListener("mouseup", (e) => {
  const target = mouseCell(e);
  if (!consumed && target >= 0 && target === held) {
    if (chordHeld) {
      consumed = true;
      act(() => game.chord(target));
    } else if (e.button === 0 && leftDown)
      act(() => clickCell(target, e.shiftKey));
    else if (e.button === 1 && middleDown)
      act(() => game.markQuestion(target, e.shiftKey));
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
  const preview = held >= 0 && chordHeld && !game.over ? chordPreview : new Set<number>();
  cells.forEach((cell, i) => {
    const token = game.token(i),
      isMine = token.startsWith("M"),
      isFlag = token.includes("F");
    cell.className = `cell ${game.open[i] ? "opened" : ""} ${isMine ? "mine" : ""} ${isFlag ? "flag" : ""} ${token.startsWith("X") ? "wrong" : ""} ${game.boom === i ? "boom" : ""}`;
    const type = isMine ? game.mine[i] : isFlag ? game.flag[i] : 0;
    if (type) cell.classList.add(`type-${type}`);
    cell.textContent = "";
    let tile = token === "?" ? "closed" : token === "_" ? "blank" : token.startsWith("X") ? `wrong_${game.flag[i]}` : isFlag ? `flag_${game.flag[i]}` : isMine ? `${game.boom === i ? "boom" : "mine"}_${game.mine[i]}` : `num_${game.clue[i]}`;
    if (preview.has(i) || (i === held && leftDown && !chordHeld && !game.open[i] && !game.flag[i])) tile = "blank";
    sprite(cell, tile);
    if (game.labels[i]) {
      if (game.open[i]) {
        const rect = sprites.get(tile)!;
        sprite(cell, "blank");
        const clue = document.createElement("span");
        clue.className = "annotated-clue";
        clue.style.backgroundImage = `url("${atlasUrl}")`;
        clue.style.backgroundSize = `calc(${atlas.width * 0.75}px * var(--zoom)) calc(${atlas.height * 0.75}px * var(--zoom))`;
        clue.style.backgroundPosition = `calc(${-rect.x * 0.75}px * var(--zoom)) calc(${-rect.y * 0.75}px * var(--zoom))`;
        clue.setAttribute("aria-hidden", "true");
        cell.append(clue);
      }
      const marker = document.createElement("span");
      marker.className = `question-label question-${game.labels[i]}`;
      marker.textContent = "?";
      marker.setAttribute("aria-hidden", "true");
      cell.append(marker);
    }
    const row = Math.floor(i / game.config.width) + 1,
      col = (i % game.config.width) + 1;
    cell.setAttribute(
      "aria-label",
      `第 ${row} 行第 ${col} 列，${token === "?" ? "未翻开" : token === "_" ? "空白" : isMine ? `${TYPES[type]} 雷` : isFlag ? `${token.startsWith("X") ? "错误" : "已标"} ${TYPES[type]} 旗` : token}`,
    );
    if (game.labels[i]) cell.setAttribute("aria-label", `${cell.getAttribute("aria-label")}，${["蓝色 A", "紫色 B", "棕色 C", "深绿色 D"][game.labels[i] - 1]}问号标记`);
    if (
      preview.has(i) ||
      (i === held && leftDown && !chordHeld && !game.open[i] && !game.flag[i])
    )
      cell.classList.add("pressed");
    cell.disabled = game.over || !active;
  });
  let counterWidth = 72;
  TYPES.slice(1).forEach((_, i) => {
    const type = i + 1;
    const remaining = game.totals[type] - game.flag.filter(t => t === type).length;
    led(element(`count-${type}`), game.started ? remaining : null, type >= 3);
    sprite(element(`flag-icon-${type}`), `flag_${type}`);
    counterWidth = Math.max(counterWidth, 20 + element(`count-${type}`).children.length * 13);
  });
  element("app").style.setProperty("--counter-width", `${counterWidth}px`);
  element("status").textContent = active
    ? game.message
    : "本局已结束，点击新一局继续";
  element("status").className = game.over
    ? game.win
      ? "win-text"
      : "loss-text"
    : "";
  element("moves").textContent = `${game.moves} 步`;
  element("remaining-mines").textContent =
    `剩余雷：${game.config.mines - game.flag.filter(t => t !== 0).length}`;
  element("progress").textContent =
    `${game.open.filter((o, i) => o && !game.mine[i]).length} / ${game.mine.length - game.config.mines} 安全格`;
  document.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach(button => button.setAttribute("aria-checked", String(button.dataset.difficulty === element<HTMLSelectElement>("difficulty").value)));
  updateTime();
  updateFace();
  settle();
}
function updateFace(): void {
  sprite(element("face"), facePressed ? "face_down" : game.over ? game.win ? "face_win" : "face_dead" : held >= 0 || Date.now() < flashUntil ? "face_scan" : "face_normal");
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
  led(element("time"), game.started ? seconds : null);
}
function restart(config = game.config): void {
  game = new Game(config);
  active = true;
  settled = false;
  setMode("reveal");
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
  if ((e.key === "'" || e.key === '"') && !e.repeat && !e.ctrlKey && !e.metaKey) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable], dialog") || document.querySelector("dialog[open]")) return;
    const focused = document.activeElement?.closest<HTMLButtonElement>(".cell");
    const cell = focused ? Number(focused.dataset.cell) : hoveredCell;
    if (cell >= 0 && active && !game.over) {
      e.preventDefault();
      act(() => game.markQuestion(cell, e.shiftKey));
    }
  }
  if (e.key === "F2") {
    e.preventDefault();
    restart();
  }
});
function applyZoom(value: number): void {
  zoom = value;
  app.style.setProperty("--zoom", String(zoom));
  const frame = document.querySelector<HTMLElement>(".native-frame")!;
  app.style.width = `${Math.max(320, frame.getBoundingClientRect().width)}px`;
}
function updateZoom(): void {
  if (fitZoom) {
    const frame = document.querySelector<HTMLElement>(".native-frame")!;
    const panel = document.querySelector<HTMLElement>(".game")!;
    const margins = getComputedStyle(app);
    const availableHeight = window.innerHeight - parseFloat(margins.marginTop) - parseFloat(margins.marginBottom);
    applyZoom(1);
    let low = 0;
    let high = window.innerWidth / frame.getBoundingClientRect().width + 1;
    // Measure wrapped toolbars as well as the scaled frame at each candidate size.
    for (let i = 0; i < 16; i++) {
      const candidate = (low + high) / 2;
      applyZoom(candidate);
      if (frame.getBoundingClientRect().width <= document.documentElement.clientWidth && panel.getBoundingClientRect().height <= availableHeight)
        low = candidate;
      else high = candidate;
    }
    applyZoom(Math.max(low, 0.01));
  } else applyZoom(zoom);
  const selected = fitZoom ? "fit" : [1, 2, 3].includes(zoom) ? String(zoom) : "custom";
  document.querySelectorAll<HTMLButtonElement>("[data-zoom]").forEach(button => button.setAttribute("aria-checked", String(button.dataset.zoom === selected)));
}
element<HTMLFormElement>("custom-zoom").addEventListener("submit", e => {
  e.preventDefault();
  const input = element<HTMLInputElement>("zoom-percent");
  if (!input.reportValidity() || !Number.isFinite(input.valueAsNumber)) return;
  fitZoom = false;
  zoom = input.valueAsNumber / 100;
  updateZoom();
  element<HTMLDialogElement>("zoom-dialog").close();
});
element("cancel-zoom").addEventListener("click", () => element<HTMLDialogElement>("zoom-dialog").close());
window.addEventListener("resize", updateZoom);
element<HTMLSelectElement>("middle-action").addEventListener("change", (e) => {
  middleAction = (e.target as HTMLSelectElement).value === "chord" ? "chord" : "question";
  clearPress();
  render();
});
const menus = Array.from(document.querySelectorAll<HTMLDetailsElement>(".menu-bar details"));
function closeMenus(): void { menus.forEach(menu => menu.open = false); }
menus.forEach(menu => menu.addEventListener("toggle", () => { if (menu.open) menus.filter(other => other !== menu).forEach(other => other.open = false); }));
document.addEventListener("click", e => { if (!(e.target as HTMLElement).closest(".menu-bar")) closeMenus(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeMenus();
  if (e.altKey && (e.key.toLowerCase() === "g" || e.key.toLowerCase() === "h")) {
    e.preventDefault();
    const menu = menus[e.key.toLowerCase() === "g" ? 0 : 1];
    closeMenus(); menu.open = true; menu.querySelector<HTMLButtonElement>("button")?.focus();
  }
});
document.querySelectorAll<HTMLButtonElement>(".menu button").forEach(button => button.addEventListener("click", () => {
  closeMenus();
  if (button.dataset.difficulty) {
    const select = element<HTMLSelectElement>("difficulty"); select.value = button.dataset.difficulty; select.dispatchEvent(new Event("change"));

  }
  if (button.dataset.zoom === "custom") {
    element<HTMLInputElement>("zoom-percent").value = String(Math.round(zoom * 10000) / 100);
    element<HTMLDialogElement>("zoom-dialog").showModal();
  } else if (button.dataset.zoom) {
    fitZoom = button.dataset.zoom === "fit";
    if (!fitZoom) zoom = Number(button.dataset.zoom);
    updateZoom();
  }
}));
element("records").addEventListener("click", () => showScores());
element("rules").addEventListener("click", () =>
  dialog(
    "玩法与操作",
    "<p>雷有 +1、−1、+i、−i 四种。数字为周围八格雷之和的模长，显示为整数或最简根式。</p><p>空白周围无雷，会连片展开；0 周围有雷但互相抵消。翻开所有安全格即可获胜。首次翻开及其邻格无雷。</p><p>左键翻开；右键循环标旗：空→+1→−1→+i→−i→空。左右键同时按住预览，松手展开。手机使用翻开、标旗、问号、展开模式。F2 或人脸按钮开始新一局。</p><p>中键默认标记问号，可在游戏菜单的“中键行为”中改为按住预览、松手展开邻格。问号模式点击格子可标记问号；指针停在格子上或聚焦格子后，按单引号键也可标记。新格子的颜色按蓝→蓝→紫→紫→棕→棕→绿→绿循环。</p><p>重复标记同一格按蓝→灭→紫→灭→棕→灭→绿→灭循环。重新点亮同一格后，下一个新格子仍使用该颜色，再下一个使用下一种颜色。中键设为问号标记时 Shift+中键、问号模式下 Shift 点击或 Shift+单引号可清除，保留该格下一种颜色。</p><p>格子翻开时会清除原有问号。已翻开的格子和旗帜上仍可添加问号；问号不影响扫雷规则，也不会启动计时。</p><p>展开会结合邻格附近已翻开的数字和空白，按旗帜的正负实虚类型推理，只翻开能够确定安全的邻格。线索不足时保留未确定的格子；旗帜错误仍可能踩雷。</p><p>各类型计数是对应雷总数减去对应旗数，首次翻开后显示。工具栏的剩余雷为所有类型雷的总数减去所有旗帜数，开局即显示；每面旗计一颗雷，问号不计入。旗数超过总雷数时可显示负数。复制只包含当前可见信息。</p>",
  ),
);
element("about").addEventListener("click", () =>
  dialog(
    "关于复扫雷",
    `<div class="about-brand"><span class="brand-mark">√</span><strong>复扫雷 Complexweeper · 网页版</strong></div><p>基于 Microsoft® 扫雷，原版作者 Robert Donner、Curt Johnson。</p><p>原生版本及新增原生素材：青月晓。网页版开发：Ovler。网页版沿用原生版图集与经典界面布局。网页版修改日期：2026-10-05。</p><p>Copyright © 2026 青月晓<br>代码采用 GPL-3.0 授权。您可以按照 GNU 通用公共许可证第 3 版的条款复制、修改和再分发本程序。本程序不提供任何担保，包括适销性或特定用途适用性的担保。具体条款请查看许可证。</p><p><a href="${__SOURCE_URL__}" target="_blank" rel="noopener noreferrer">项目源码与构建说明</a> · <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">GPL-3.0 许可证</a></p><p>原扫雷图像素材权利属于 Microsoft，不在 GPL-3.0 授权范围内。本项目与 Microsoft 公司无隶属关系。</p>`,
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
element<HTMLDialogElement>("custom-dialog").addEventListener("close", () => {
  const preset = game.config.counts ? -1 : PRESETS.findIndex(p =>
    p.width === game.config.width && p.height === game.config.height && p.mines === game.config.mines);
  element<HTMLSelectElement>("difficulty").value = preset < 0 ? "custom" : String(preset);
  render();
});
element("cancel-custom").addEventListener("click", () => element<HTMLDialogElement>("custom-dialog").close());
element("custom").addEventListener("input", updateCountLimits);
element<HTMLSelectElement>("difficulty").addEventListener("change", (e) => {
  const value = (e.target as HTMLSelectElement).value;
  if (value !== "custom") restart(PRESETS[Number(value)]);
  else { prefillCustom(); element<HTMLDialogElement>("custom-dialog").showModal(); }
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
  element<HTMLDialogElement>("custom-dialog").close();
});
function setMode(nextMode: typeof mode): void {
  mode = nextMode;
  for (const option of ["reveal", "flag", "question", "chord"])
    element(`${option}-mode`).setAttribute("aria-pressed", String(option === mode));
}
for (const nextMode of ["reveal", "flag", "question", "chord"] as const)
  element(`${nextMode}-mode`).addEventListener("click", () => setMode(nextMode));
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
