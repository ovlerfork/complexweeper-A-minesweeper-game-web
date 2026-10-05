import { Game, type Config } from "./game";

// Version 2 adds question labels and their next-pair phase to the version 1 board.
export function encodeGame(game: Game, active = true, now = Date.now()): string {
  const elapsed = game.started
    ? game.over || !active ? game.elapsed : Math.max(0, now - game.startedAt)
    : 0;
  const state = [2, game.seed, [game.config.width, game.config.height, game.config.mines, game.config.counts ?? null],
    game.firstClick, game.moves, Math.floor(elapsed), active ? 1 : 0,
    game.over ? game.win ? 2 : 1 : 0, game.boom,
    game.open.flatMap((open, i) => open ? [[i, game.mine[i] ? -game.mine[i] : game.clue[i]]] : []),
    game.flag.flatMap((type, i) => type ? [[i, type]] : []),
    game.labels.flatMap((color, i) => color ? [[i, color]] : []), game.labelPhase];
  return btoa(JSON.stringify(state)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeGame(encoded: string, now = Date.now()): { game: Game; active: boolean } {
  const invalid = () => { throw new Error("分享链接无效或版本不受支持，请重新复制完整链接。"); };
  if (!encoded || encoded.length > 40000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) invalid();
  let data: unknown;
  try { data = JSON.parse(atob(encoded.replaceAll("-", "+").replaceAll("_", "/"))); }
  catch { invalid(); }
  if (!Array.isArray(data) || (data.length !== 11 && data.length !== 13)) return invalid();
  const [version, seed, config, first, moves, elapsed, active, status, boom, opened, flags, labels, phase] = data;
  const integer = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
  if (((version !== 1 || data.length !== 11) && (version !== 2 || data.length !== 13)) || !integer(seed, 0, 0xffffffff) || !Array.isArray(config) || config.length !== 4) return invalid();
  const [width, height, mines, counts] = config;
  if (!integer(width, 9, 40) || !integer(height, 9, 30) || !integer(mines, 1, width * height - 9)) return invalid();
  if (counts !== null && (!Array.isArray(counts) || counts.length !== 4 ||
    counts.some(n => !integer(n, 0, mines)) || counts.reduce((a: number, b: number) => a + b, 0) !== mines)) return invalid();
  const n = width * height;
  if (!integer(first, -1, n - 1) || !integer(moves, 0, Number.MAX_SAFE_INTEGER) ||
    !integer(elapsed, 0, Number.MAX_SAFE_INTEGER) || !integer(active, 0, 1) ||
    !integer(status, 0, 2) || !integer(boom, -1, n - 1)) return invalid();
  const gameConfig: Config = { width, height, mines, ...(counts === null ? {} : { counts }) };
  const game = new Game(gameConfig, seed);
  if (first !== -1) {
    game.generate(first);
    game.started = true;
    game.startedAt = now - elapsed;
  }
  const restorePairs = (pairs: unknown, isOpen: boolean) => {
    if (!Array.isArray(pairs) || pairs.length > n) invalid();
    const seen = new Set<number>();
    for (const pair of pairs as unknown[]) {
      if (!Array.isArray(pair) || pair.length !== 2 || !integer(pair[0], 0, n - 1) || seen.has(pair[0])) invalid();
      const [i, value] = pair as [number, number];
      seen.add(i);
      if (isOpen) {
        if (first === -1 || value !== (game.mine[i] ? -game.mine[i] : game.clue[i])) invalid();
        game.open[i] = true;
      } else {
        if (!integer(value, 1, 4) || game.open[i]) invalid();
        game.flag[i] = value;
      }
    }
  };
  restorePairs(opened, true);
  restorePairs(flags, false);
  if (version === 2) {
    if (!integer(phase, 0, 7) || !Array.isArray(labels) || labels.length > n) return invalid();
    const seen = new Set<number>();
    for (const pair of labels) {
      if (!Array.isArray(pair) || pair.length !== 2 || !integer(pair[0], 0, n - 1) ||
        !integer(pair[1], 1, 4) || seen.has(pair[0])) return invalid();
      seen.add(pair[0]);
      game.labels[pair[0]] = pair[1];
    }
    game.labelPhase = phase;
  }
  const openMines = game.mine.flatMap((t, i) => t && game.open[i] ? [i] : []);
  const allSafe = game.started && game.mine.every((t, i) => t || game.open[i]);
  if ((first === -1 && (status !== 0 || elapsed !== 0 || boom !== -1)) ||
    (first !== -1 && (!game.open[first] || game.mine[first])) ||
    (status === 1 ? openMines.length !== 1 || openMines[0] !== boom || allSafe : openMines.length !== 0 || boom !== -1) ||
    (status === 2 ? !allSafe : allSafe)) invalid();
  game.moves = moves;
  game.elapsed = elapsed;
  game.over = status !== 0;
  game.win = status === 2;
  game.boom = boom;
  game.message = game.over ? game.win ? "恭喜，所有安全格已翻开！" : "踩雷了，再来一局吧"
    : game.started ? "继续翻开安全格" : "点击任意格子开始";
  return { game, active: active === 1 };
}
