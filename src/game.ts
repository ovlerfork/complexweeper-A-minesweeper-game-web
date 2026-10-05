export const TYPES = ["", "+1", "−1", "+i", "−i"];
export const CLUES: Record<number, string> = {
  0: "0",
  1: "1",
  2: "√2",
  4: "2",
  5: "√5",
  8: "2√2",
  9: "3",
  10: "√10",
  13: "√13",
  16: "4",
  17: "√17",
  18: "3√2",
  20: "2√5",
  25: "5",
  26: "√26",
  29: "√29",
  32: "4√2",
  34: "√34",
  36: "6",
  37: "√37",
  40: "2√10",
  49: "7",
  50: "5√2",
  64: "8",
};
export const PRESETS = [
  { width: 9, height: 9, mines: 10, label: "初级 · 9×9 · 10 雷" },
  { width: 16, height: 16, mines: 40, label: "中级 · 16×16 · 40 雷" },
  { width: 30, height: 16, mines: 99, label: "高级 · 30×16 · 99 雷" },
];
export function splitEvenly(total: number): number[] {
  return Array.from(
    { length: 4 },
    (_, i) => Math.floor(total / 4) + (i < total % 4 ? 1 : 0),
  );
}

export interface Config {
  width: number;
  height: number;
  mines: number;
  counts?: number[];
}
const vectors = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export class Game {
  mine: number[];
  clue: number[];
  open: boolean[];
  flag: number[];
  labels: number[];
  labelPhase = 0;
  totals = [0, 0, 0, 0, 0];
  firstClick = -1;
  started = false;
  over = false;
  win = false;
  boom = -1;
  moves = 0;
  startedAt = 0;
  elapsed = 0;
  message = "点击任意格子开始";
  private randomState: number;
  private nextLabel: number[];
  constructor(
    public config: Config,
    public seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1,
  ) {
    this.config = { ...config, counts: config.counts?.slice() };
    this.seed = seed || 1;
    this.randomState = this.seed;
    const n = config.width * config.height;
    this.mine = Array(n).fill(0);
    this.clue = Array(n).fill(-1);
    this.open = Array(n).fill(false);
    this.flag = Array(n).fill(0);
    this.labels = Array(n).fill(0);
    this.nextLabel = Array(n).fill(0);
  }
  neighbors(cell: number): number[] {
    const { width, height } = this.config,
      row = Math.floor(cell / width),
      col = cell % width,
      result: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr,
          c = col + dc;
        if ((dr || dc) && r >= 0 && r < height && c >= 0 && c < width)
          result.push(r * width + c);
      }
    return result;
  }
  private random(): number {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let t = this.randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private shuffle<T>(values: T[]): void {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  }
  generate(cell: number): void {
    this.firstClick = cell;
    const safe = new Set([cell, ...this.neighbors(cell)]);
    const pool = this.mine.map((_, i) => i).filter((i) => !safe.has(i));
    this.shuffle(pool);
    const counts = this.config.counts;
    const types = counts?.flatMap((count, i) =>
      Array<number>(count).fill(i + 1),
    );
    const count = Math.min(types?.length || this.config.mines, pool.length);
    if (types?.length) {
      types.length = count;
      this.shuffle(types);
    }
    for (let k = 0; k < count; k++)
      this.mine[pool[k]] = types?.length
        ? types[k]
        : 1 + Math.floor(this.random() * 4);
    this.config.mines = count;
    this.computeClues();
    this.totals.fill(0);
    this.mine.forEach((t) => {
      if (t) this.totals[t]++;
    });
  }
  computeClues(): void {
    this.mine.forEach((type, i) => {
      if (type) {
        this.clue[i] = -1;
        return;
      }
      let a = 0,
        b = 0;
      this.neighbors(i).forEach((j) => {
        a += vectors[this.mine[j]][0];
        b += vectors[this.mine[j]][1];
      });
      this.clue[i] = a * a + b * b;
    });
  }
  isBlank(cell: number): boolean {
    return !this.mine[cell] && this.neighbors(cell).every((j) => !this.mine[j]);
  }
  cascade(seeds: number[]): void {
    const stack = [...seeds],
      queued = new Set(seeds);
    while (stack.length) {
      const i = stack.pop()!;
      if (this.open[i] || this.mine[i] || this.flag[i]) continue;
      this.open[i] = true;
      this.labels[i] = 0;
      this.nextLabel[i] = 0;
      if (this.isBlank(i))
        this.neighbors(i).forEach((j) => {
          if (!queued.has(j)) {
            queued.add(j);
            stack.push(j);
          }
        });
    }
  }
  reveal(cell: number, now = Date.now()): void {
    if (this.over || this.open[cell] || this.flag[cell]) return;
    if (!this.started) {
      this.generate(cell);
      this.started = true;
      this.startedAt = now;
    }
    this.moves++;
    if (this.mine[cell]) {
      this.open[cell] = true;
      this.labels[cell] = 0;
      this.nextLabel[cell] = 0;
      this.finish(false, now, cell);
      return;
    }
    this.cascade([cell]);
    this.message = "继续翻开安全格";
    this.checkWin(now);
  }
  cycleFlag(cell: number): void {
    if (this.over || this.open[cell]) return;
    do {
      this.flag[cell] = (this.flag[cell] + 1) % 5;
    } while (this.flag[cell] && this.config.counts?.[this.flag[cell] - 1] === 0);
    this.moves++;
  }
  markQuestion(cell: number, clear = false): void {
    if (this.over || !Number.isInteger(cell) || cell < 0 || cell >= this.labels.length) return;
    if (this.labels[cell]) {
      this.nextLabel[cell] = this.labels[cell] % 4 + 1;
      this.labels[cell] = 0;
    } else {
      if (clear) return;
      if (this.nextLabel[cell]) {
        this.labels[cell] = this.nextLabel[cell];
        this.labelPhase = (this.labels[cell] - 1) * 2 + 1;
      } else {
        this.labels[cell] = Math.floor(this.labelPhase / 2) + 1;
        this.labelPhase = (this.labelPhase + 1) % 8;
      }
    }
    this.moves++;
  }
  matchCombo(cell: number): boolean {
    const truth = [0, 0],
      got = [0, 0];
    this.neighbors(cell).forEach((j) => {
      if (this.mine[j]) truth[this.mine[j] <= 2 ? 0 : 1]++;
      if (this.flag[j]) got[this.flag[j] <= 2 ? 0 : 1]++;
    });
    return (
      (truth[0] === got[0] && truth[1] === got[1]) ||
      (truth[0] === got[1] && truth[1] === got[0])
    );
  }
  chord(cell: number, now = Date.now()): void {
    if (this.over || !this.open[cell] || this.mine[cell]) return;
    const targets = this.neighbors(cell).filter(
      (j) => !this.open[j] && !this.flag[j],
    );
    if (!targets.length) return;
    if (!this.matchCombo(cell)) {
      this.message = "无法展开：旗帜总数或实虚比例不符合";
      return;
    }
    this.moves++;
    const boom = targets.find((j) => this.mine[j]);
    if (boom !== undefined) {
      this.open[boom] = true;
      this.labels[boom] = 0;
      this.nextLabel[boom] = 0;
      this.finish(false, now, boom);
      return;
    }
    this.cascade(targets);
    this.message = "周围安全格已展开";
    this.checkWin(now);
  }
  private checkWin(now: number): void {
    if (this.mine.every((t, i) => t || this.open[i])) this.finish(true, now);
  }
  private finish(win: boolean, now: number, boom = -1): void {
    this.over = true;
    this.win = win;
    this.boom = boom;
    this.elapsed = now - this.startedAt;
    this.message = win ? "恭喜，所有安全格已翻开！" : "踩雷了，再来一局吧";
  }
  token(cell: number): string {
    if (this.open[cell])
      return this.mine[cell]
        ? `M${TYPES[this.mine[cell]]}`
        : this.isBlank(cell)
          ? "_"
          : CLUES[this.clue[cell]];
    if (this.flag[cell])
      return `${this.over && !this.win && this.flag[cell] !== this.mine[cell] ? "X" : ""}F${TYPES[this.flag[cell]]}`;
    if (this.over && !this.win && this.mine[cell])
      return `M${TYPES[this.mine[cell]]}`;
    return "?";
  }
  export(format: "csv" | "text"): string {
    const rows: string[] = [];
    for (let r = 0; r < this.config.height; r++)
      rows.push(
        this.mine
          .slice(r * this.config.width, (r + 1) * this.config.width)
          .map((_, c) => {
            const i = r * this.config.width + c;
            return this.token(i) + (this.labels[i] ? `{?${"ABCD"[this.labels[i] - 1]}}` : "");
          })
          .join(format === "csv" ? "," : "\t"),
      );
    return rows.join("\n");
  }
}
