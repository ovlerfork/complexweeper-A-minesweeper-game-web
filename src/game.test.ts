import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, CLUES } from "./game";
function fixture(
  width: number,
  height: number,
  mines: [number, number][],
): Game {
  const game = new Game({ width, height, mines: mines.length }, 1);
  mines.forEach(([i, t]) => (game.mine[i] = t));
  game.computeClues();
  game.started = true;
  game.startedAt = 1000;
  return game;
}
test("seeded generation protects first-click neighborhood, preserves preflags and exact custom counts", () => {
  const config = { width: 9, height: 9, mines: 10, counts: [4, 3, 2, 1] };
  const game = new Game(config, 42),
    same = new Game(config, 42);
  game.cycleFlag(80);
  game.reveal(40, 1000);
  same.reveal(40, 1000);
  assert.deepEqual(game.mine, same.mine);
  assert.deepEqual(game.totals, [0, 4, 3, 2, 1]);
  assert.ok([40, ...game.neighbors(40)].every((i) => game.mine[i] === 0));
  assert.equal(game.flag[80], 1);
  assert.equal(game.open[80], false);
});
test("cancellation 0 is visible and does not flood, while true blanks flood without opening flags", () => {
  const game = fixture(5, 3, [
    [1, 1],
    [3, 2],
  ]);
  assert.equal(game.clue[2], 0);
  assert.equal(game.isBlank(2), false);
  game.reveal(2, 1100);
  assert.equal(game.open.filter(Boolean).length, 1);
  game.cycleFlag(10);
  game.reveal(14, 1200);
  assert.equal(game.open[10], false);
  assert.equal(game.open[13], true);
  assert.equal(game.token(2), "0");
  assert.equal(game.token(14), "_");
});
test("clues use squared complex modulus and exact simplified labels", () => {
  const game = fixture(3, 3, [
    [0, 1],
    [1, 1],
    [2, 3],
  ]);
  assert.equal(game.clue[4], 5);
  assert.equal(CLUES[game.clue[4]], "√5");
  assert.equal(CLUES[40], "2√10");
  assert.equal(CLUES[64], "8");
});
test("flag cycle protects cells and requires manual clearing before reveal", () => {
  const game = new Game({ width: 9, height: 9, mines: 10 }, 1);
  for (let t = 1; t <= 4; t++) {
    game.cycleFlag(0);
    assert.equal(game.flag[0], t);
    game.reveal(0);
    assert.equal(game.started, false);
  }
  game.cycleFlag(0);
  game.reveal(0);
  assert.equal(game.started, true);
});
test("chord accepts swapped real/imaginary counts but wrong positions can lose", () => {
  const game = fixture(3, 3, [
    [0, 1],
    [2, 2],
    [6, 3],
  ]);
  game.open[4] = true;
  game.flag[0] = 3;
  game.flag[2] = 4;
  game.flag[6] = 1;
  assert.equal(game.matchCombo(4), true);
  game.chord(4, 2000);
  assert.equal(game.win, true);
  assert.equal(game.elapsed, 1000);
  const wrong = fixture(3, 3, [
    [0, 1],
    [2, 2],
    [6, 3],
  ]);
  wrong.open[4] = true;
  wrong.flag[1] = 1;
  wrong.flag[3] = 2;
  wrong.flag[5] = 3;
  wrong.chord(4, 2000);
  assert.equal(wrong.over, true);
  assert.equal(wrong.win, false);
  assert.equal(wrong.boom, 0);
  const rejected = fixture(3, 3, [
    [0, 1],
    [2, 2],
    [6, 3],
  ]);
  rejected.open[4] = true;
  rejected.flag[0] = 1;
  rejected.flag[2] = 1;
  rejected.flag[6] = 1;
  rejected.chord(4);
  assert.equal(rejected.over, false);
  assert.equal(rejected.open.filter(Boolean).length, 1);
});
test("exports visible state in CSV or tab text and exposes loss mines with wrong flags", () => {
  const game = fixture(3, 3, [
    [0, 1],
    [8, 4],
  ]);
  game.open[4] = true;
  game.flag[2] = 2;
  assert.equal(game.export("csv"), "?,?,F−1\n?,√2,?\n?,?,?");
  assert.equal(game.export("text").split("\n")[0], "?\t?\tF−1");
  game.reveal(0, 2000);
  assert.equal(game.export("csv"), "M+1,?,XF−1\n?,√2,?\n?,?,M−i");
});
