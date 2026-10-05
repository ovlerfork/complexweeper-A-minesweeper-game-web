import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, CLUES, splitEvenly } from "./game";
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

// Reference boards produced by Zig 0.14.1 running the native game.zig.
test("native seeded random and custom generation produce identical typed boards and initial flood", () => {
  {
    const game = new Game({ width: 9, height: 9, mines: 10 }, 0);
    game.reveal(0, 1000);
    assert.equal(game.seed, 1);
    assert.deepEqual(
      game.mine.flatMap((type, index) => (type ? [[index, type]] : [])),
      [
        [11, 3],
        [26, 2],
        [38, 4],
        [40, 3],
        [41, 1],
        [53, 1],
        [56, 3],
        [58, 2],
        [61, 2],
        [78, 4],
      ],
    );
    assert.deepEqual(
      game.open.flatMap((opened, index) => (opened ? [index] : [])),
      [
        0, 1, 9, 10, 18, 19, 27, 28, 36, 37, 45, 46, 54, 55, 63, 64, 65, 66, 67,
        68, 72, 73, 74, 75, 76, 77,
      ],
    );
  }
  {
    const game = new Game({ width: 16, height: 16, mines: 40 }, 4045620583);
    game.reveal(136, 1000);
    assert.equal(game.seed, 4045620583);
    assert.deepEqual(
      game.mine.flatMap((type, index) => (type ? [[index, type]] : [])),
      [
        [4, 4],
        [6, 2],
        [10, 2],
        [33, 4],
        [36, 2],
        [40, 2],
        [51, 2],
        [57, 4],
        [60, 1],
        [63, 4],
        [64, 3],
        [66, 2],
        [74, 1],
        [75, 4],
        [76, 4],
        [77, 4],
        [81, 1],
        [88, 3],
        [90, 3],
        [96, 2],
        [112, 3],
        [114, 2],
        [123, 3],
        [133, 2],
        [139, 2],
        [143, 3],
        [144, 1],
        [149, 1],
        [154, 2],
        [160, 2],
        [162, 4],
        [168, 3],
        [173, 1],
        [219, 4],
        [222, 4],
        [233, 3],
        [242, 1],
        [246, 3],
        [251, 2],
        [252, 3],
      ],
    );
    assert.deepEqual(
      game.open.flatMap((opened, index) => (opened ? [index] : [])),
      [
        21, 22, 23, 37, 38, 39, 52, 53, 54, 55, 67, 68, 69, 70, 71, 83, 84, 85,
        86, 87, 99, 100, 101, 102, 103, 104, 105, 106, 115, 116, 117, 118, 119,
        120, 121, 122, 134, 135, 136, 137, 138, 150, 151, 152, 153,
      ],
    );
  }
  {
    const game = new Game(
      { width: 12, height: 12, mines: 14, counts: [0, 7, 0, 7] },
      123456789,
    );
    game.reveal(143, 1000);
    assert.equal(game.seed, 123456789);
    assert.deepEqual(
      game.mine.flatMap((type, index) => (type ? [[index, type]] : [])),
      [
        [4, 2],
        [7, 4],
        [39, 4],
        [43, 4],
        [45, 4],
        [53, 4],
        [58, 2],
        [59, 2],
        [78, 2],
        [81, 4],
        [90, 2],
        [94, 2],
        [112, 4],
        [114, 2],
      ],
    );
    assert.deepEqual(
      game.open.flatMap((opened, index) => (opened ? [index] : [])),
      [
        0, 1, 2, 3, 12, 13, 14, 15, 24, 25, 26, 27, 36, 37, 38, 48, 49, 50, 51,
        52, 60, 61, 62, 63, 64, 65, 72, 73, 74, 75, 76, 77, 84, 85, 86, 87, 88,
        89, 91, 92, 93, 96, 97, 98, 99, 100, 101, 103, 104, 105, 106, 107, 108,
        109, 110, 111, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125,
        126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139,
        140, 141, 142, 143,
      ],
    );
  }
});

test("native custom prefill splits remainder into the earliest types", () => {
  assert.deepEqual(splitEvenly(10), [3, 3, 2, 2]);
  assert.deepEqual(splitEvenly(99), [25, 25, 25, 24]);
});
