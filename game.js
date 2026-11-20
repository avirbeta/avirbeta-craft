(() => {
'use strict';

/* ════════════════════════════════════════════════════════════
   Minecraft 2D — Долина
   Одна страница, без ассетов: вся графика рисуется на canvas.
   ════════════════════════════════════════════════════════════ */

/* ── helpers ─────────────────────────────────────────────── */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pad2 = n => String(n).padStart(2, '0');
const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smoothstep = t => t * t * (3 - 2 * t);

function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smoothstep(xf), v = smoothstep(yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, s = 0, oct = 3) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x * f, y * f, s + i * 31) * amp;
    norm += amp;
    amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

function hexRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mixColor(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

/* ── blocks & items ─────────────────────────────────────── */
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, SAND = 5,
      LOG = 6, LEAVES = 7, PLANKS = 8, COAL = 9, IRON = 10, GOLD = 11,
      DIAMOND = 12, BEDROCK = 13, GLASS = 14, TORCH = 15, WATER = 16, BRICK = 17,
      SNOW = 18, ICE = 19, CACTUS = 20, GRAVEL = 21, SANDSTONE = 22,
      STONEBRICK = 23, CRAFT_TABLE = 24, FURNACE = 25, CHEST = 26,
      LAVA = 27, WOOL = 28, FLOWER = 29, TALLGRASS = 30;

/* предметы (не блоки) */
const STICK = 100, COAL_ITEM = 101, CHARCOAL = 102, IRON_INGOT = 103,
      GOLD_INGOT = 104, DIAMOND_ITEM = 105, APPLE = 106,
      RAW_BEEF = 107, COOKED_BEEF = 108, RAW_PORK = 109, COOKED_PORK = 110,
      LEATHER = 111, ROTTEN_FLESH = 112,
      COW_EGG = 300, PIG_EGG = 301, ZOMBIE_EGG = 302, SLIME_EGG = 303;

/* инструменты: 200 pick, 210 axe, 220 shovel, 230 sword; +0..3 — материал */
const WOOD_PICK = 200, STONE_PICK = 201, IRON_PICK = 202, DIAMOND_PICK = 203;
const WOOD_AXE = 210, STONE_AXE = 211, IRON_AXE = 212, DIAMOND_AXE = 213;
const WOOD_SHOVEL = 220, STONE_SHOVEL = 221, IRON_SHOVEL = 222, DIAMOND_SHOVEL = 223;
const WOOD_SWORD = 230, STONE_SWORD = 231, IRON_SWORD = 232, DIAMOND_SWORD = 233;

const BLOCKS = [];
function defBlock(id, name, hard, drop, opts = {}) {
  BLOCKS[id] = Object.assign({
    id, name, hard, drop,
    solid: true, pass: false, light: 0, tool: 'none',
    color: '#888'
  }, opts);
}

defBlock(AIR, 'Воздух', 0, 0, { solid: false, pass: true, color: '#000' });
defBlock(GRASS, 'Трава', 0.45, DIRT, { color: '#5aa63c', tool: 'shovel' });
defBlock(DIRT, 'Земля', 0.4, DIRT, { color: '#7a5232', tool: 'shovel' });
defBlock(STONE, 'Камень', 1.15, COBBLE, { color: '#7c7f88', tool: 'pick' });
defBlock(COBBLE, 'Булыжник', 1.05, COBBLE, { color: '#6f727b', tool: 'pick' });
defBlock(SAND, 'Песок', 0.4, SAND, { color: '#dfcf8f', tool: 'shovel' });
defBlock(LOG, 'Бревно', 0.7, LOG, { color: '#6b4726', tool: 'axe' });
defBlock(LEAVES, 'Листва', 0.25, 0, {
  color: '#3f7a2e', pass: true,
  drops: [{ id: LEAVES, n: 1, chance: 0.55 }, { id: APPLE, n: 1, chance: 0.08 }]
});
defBlock(PLANKS, 'Доски', 0.6, PLANKS, { color: '#b07a3f', tool: 'axe' });
defBlock(COAL, 'Угольная руда', 1.3, COAL_ITEM, { color: '#33343c', tool: 'pick' });
defBlock(IRON, 'Железная руда', 1.6, IRON, { color: '#d8a17a', tool: 'pick' });
defBlock(GOLD, 'Золотая руда', 1.9, GOLD, { color: '#ffd34d', tool: 'pick' });
defBlock(DIAMOND, 'Алмазная руда', 2.4, DIAMOND_ITEM, { color: '#4be0d0', tool: 'pick' });
defBlock(BEDROCK, 'Бедрок', Infinity, 0, { color: '#2b2b33', tool: 'pick' });
defBlock(GLASS, 'Стекло', 0.3, GLASS, { color: '#bfe8ff', pass: true });
defBlock(TORCH, 'Факел', 0.06, TORCH, { solid: false, pass: true, light: 14, color: '#ffb347' });
defBlock(WATER, 'Вода', Infinity, 0, { solid: false, pass: true, color: '#2f6fbf' });
defBlock(BRICK, 'Кирпич', 1.2, BRICK, { color: '#9a4a3a', tool: 'pick' });

defBlock(SNOW, 'Снег', 0.3, SNOW, { color: '#eef6ff', tool: 'shovel' });
defBlock(ICE, 'Лёд', 0.5, ICE, { color: '#a8dcff', pass: true, tool: 'pick' });
defBlock(CACTUS, 'Кактус', 0.4, CACTUS, { color: '#3d8b3d' });
defBlock(GRAVEL, 'Гравий', 0.4, GRAVEL, { color: '#7a7370', tool: 'shovel' });
defBlock(SANDSTONE, 'Песчаник', 1.0, SANDSTONE, { color: '#cbb26a', tool: 'pick' });
defBlock(STONEBRICK, 'Каменный кирпич', 1.2, STONEBRICK, { color: '#777b85', tool: 'pick' });
defBlock(CRAFT_TABLE, 'Верстак', 0.7, CRAFT_TABLE, { color: '#a06b3a', tool: 'axe' });
defBlock(FURNACE, 'Печь', 1.4, FURNACE, { color: '#6f737c', tool: 'pick' });
defBlock(CHEST, 'Сундук', 0.7, CHEST, { color: '#a06b3a', tool: 'axe' });
defBlock(LAVA, 'Лава', Infinity, 0, { solid: false, pass: true, light: 15, color: '#ff7a1a' });
defBlock(WOOL, 'Шерсть', 0.3, WOOL, { color: '#eeeeee' });
defBlock(FLOWER, 'Цветок', 0.05, FLOWER, { solid: false, pass: true, color: '#ff6b9d' });
defBlock(TALLGRASS, 'Трава', 0.05, TALLGRASS, { solid: false, pass: true, color: '#4f9a35' });

const lightPass = id => BLOCKS[id].pass;

/* ── textures (16×16, procedural) ────────────────────────── */
const TEX = [];
function makeTex(draw, seed) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, rng(seed));
  return c;
}
function baseNoise(g, r, base, colors, n = 70) {
  g.fillStyle = base;
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1);
  }
}
function oreBlob(g, r, color, dark) {
  for (let k = 0; k < 4; k++) {
    const x = 2 + ((r() * 11) | 0);
    const y = 2 + ((r() * 11) | 0);
    g.fillStyle = dark;
    g.fillRect(x, y, 3, 3);
    g.fillStyle = color;
    g.fillRect(x, y, 2, 2);
    g.fillStyle = '#ffffff66';
    g.fillRect(x, y, 1, 1);
  }
}

TEX[GRASS] = makeTex((g, r) => {
  baseNoise(g, r, '#7b5432', ['#6a4629', '#8a603d', '#5c3c22', '#946a45']);
  for (let x = 0; x < 16; x++) {
    const h = 2 + ((r() * 3) | 0);
    g.fillStyle = r() < 0.5 ? '#57a83b' : '#468c2f';
    g.fillRect(x, 0, 1, h);
  }
  for (let i = 0; i < 16; i++) {
    g.fillStyle = '#63b84a';
    g.fillRect((r() * 16) | 0, (r() * 3) | 0, 1, 1);
  }
}, 101);

TEX[DIRT] = makeTex((g, r) => {
  baseNoise(g, r, '#7b5432', ['#6a4629', '#8a603d', '#5c3c22', '#946a45'], 110);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = '#513620';
    g.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1);
  }
}, 102);

TEX[STONE] = makeTex((g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98', '#73767f', '#9598a2'], 130);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = 'rgba(104,107,115,.5)';
    g.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1);
  }
  for (let i = 0; i < 4; i++) {
    g.fillStyle = 'rgba(160,163,172,.4)';
    g.fillRect((r() * 15) | 0, (r() * 15) | 0, 1, 2);
  }
}, 103);

TEX[COBBLE] = makeTex((g, r) => {
  baseNoise(g, r, '#5e6169', ['#555861', '#6a6d76'], 90);
  for (let i = 0; i < 7; i++) {
    const x = (r() * 12) | 0, y = (r() * 12) | 0;
    const w = 3 + ((r() * 4) | 0), h = 2 + ((r() * 3) | 0);
    g.fillStyle = '#7e818b';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#999ca6';
    g.fillRect(x, y, w, 1);
    g.fillStyle = '#4c4f57';
    g.fillRect(x, y + h - 1, w, 1);
  }
}, 104);

TEX[SAND] = makeTex((g, r) => {
  baseNoise(g, r, '#e0cf8d', ['#d4c17c', '#ecdca3', '#c9b671', '#f4e8b8'], 130);
}, 105);

TEX[LOG] = makeTex((g, r) => {
  baseNoise(g, r, '#6b4726', ['#5c3c1f', '#785231', '#4e321a'], 70);
  for (const x of [3, 7, 11, 14]) {
    g.fillStyle = '#4a2f19';
    g.fillRect(x, 0, 1, 16);
    g.fillStyle = '#835a34';
    g.fillRect(x + 1, 0, 1, 16);
  }
  g.fillStyle = '#3f2815';
  g.fillRect(5, 6, 3, 2);
}, 106);

TEX[LEAVES] = makeTex((g, r) => {
  g.clearRect(0, 0, 16, 16);
  for (let i = 0; i < 200; i++) {
    g.fillStyle = ['#2f6b26', '#3f7a2e', '#4f9138', '#2a5c22', '#5aa340'][(r() * 5) | 0];
    g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1);
  }
  for (let i = 0; i < 22; i++) {
    g.clearRect((r() * 16) | 0, (r() * 16) | 0, 1, 1);
  }
}, 107);

TEX[PLANKS] = makeTex((g, r) => {
  baseNoise(g, r, '#b07a3f', ['#a36f37', '#bc874b', '#966330'], 60);
  for (let y = 0; y < 16; y += 4) {
    g.fillStyle = '#7d5527';
    g.fillRect(0, y, 16, 1);
    g.fillStyle = '#cf9a5a';
    g.fillRect(0, y + 1, 16, 1);
  }
  g.fillStyle = '#7d5527';
  g.fillRect(5, 0, 1, 4); g.fillRect(11, 4, 1, 4);
  g.fillRect(3, 8, 1, 4); g.fillRect(9, 12, 1, 4);
}, 108);

TEX[COAL] = makeTex((g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98', '#73767f'], 80);
  oreBlob(g, r, '#2c2c33', '#17171c');
}, 109);

TEX[IRON] = makeTex((g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98', '#73767f'], 80);
  oreBlob(g, r, '#e0b089', '#8a5a3a');
}, 110);

TEX[GOLD] = makeTex((g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98', '#73767f'], 80);
  oreBlob(g, r, '#ffd84f', '#a8791e');
}, 111);

TEX[DIAMOND] = makeTex((g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98', '#73767f'], 80);
  oreBlob(g, r, '#5ff0de', '#1d8f86');
}, 112);

TEX[BEDROCK] = makeTex((g, r) => {
  baseNoise(g, r, '#2d2d36', ['#1c1c23', '#3d3d48', '#24242c'], 150);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = '#141419';
    g.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 2);
  }
}, 113);

TEX[GLASS] = makeTex((g, r) => {
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = 'rgba(190,232,255,0.18)';
  g.fillRect(0, 0, 16, 16);
  g.strokeStyle = '#c8eeff';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, 15, 15);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillRect(3, 3, 1, 6);
  g.fillRect(4, 3, 4, 1);
  g.fillRect(10, 9, 1, 4);
}, 114);

TEX[TORCH] = makeTex((g, r) => {
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = '#5b3a1e';
  g.fillRect(7, 8, 2, 7);
  g.fillStyle = '#8a5a2b';
  g.fillRect(7, 8, 1, 7);
  g.fillStyle = '#ff9d2e';
  g.fillRect(6, 4, 4, 5);
  g.fillStyle = '#ffd34d';
  g.fillRect(7, 3, 2, 5);
  g.fillStyle = '#fff2a8';
  g.fillRect(7, 4, 1, 2);
}, 115);

TEX[WATER] = makeTex((g, r) => {
  g.fillStyle = 'rgba(40,108,196,0.62)';
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = 'rgba(130,200,255,0.35)';
    g.fillRect((r() * 14) | 0, (r() * 15) | 0, 2, 1);
  }
  g.fillStyle = 'rgba(20,60,130,0.35)';
  g.fillRect(0, 14, 16, 2);
}, 116);

TEX[BRICK] = makeTex((g, r) => {
  baseNoise(g, r, '#9a4a3a', ['#8a3f31', '#aa5747', '#7c3529'], 60);
  g.fillStyle = '#d8c0a0';
  for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  g.fillRect(0, 0, 1, 4); g.fillRect(8, 0, 1, 4);
  g.fillRect(4, 4, 1, 4); g.fillRect(12, 4, 1, 4);
  g.fillRect(0, 8, 1, 4); g.fillRect(8, 8, 1, 4);
  g.fillRect(4, 12, 1, 4); g.fillRect(12, 12, 1, 4);
}, 117);

TEX[SNOW] = makeTex((g, r) => {
  baseNoise(g, r, '#eef6ff', ['#dce9f7', '#ffffff', '#d2e2f2', '#f8fcff'], 90);
}, 118);

TEX[ICE] = makeTex((g, r) => {
  g.fillStyle = 'rgba(168,220,255,0.75)';
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect((r() * 15) | 0, (r() * 15) | 0, 2, 1);
  }
  g.fillStyle = 'rgba(110,180,240,0.45)';
  g.fillRect(2, 10, 6, 1);
  g.fillRect(9, 3, 1, 6);
}, 119);

TEX[CACTUS] = makeTex((g, r) => {
  baseNoise(g, r, '#3d8b3d', ['#2f6f2f', '#4f9f4a', '#256025'], 60);
  g.fillStyle = '#2b5d2b';
  g.fillRect(3, 0, 1, 16); g.fillRect(12, 0, 1, 16);
  g.fillStyle = '#7fce6f';
  for (let i = 0; i < 6; i++) g.fillRect(5, 2 + i * 2, 1, 1);
  g.fillStyle = '#dfe9c0';
  g.fillRect(1, 5, 1, 1); g.fillRect(14, 8, 1, 1); g.fillRect(6, 1, 1, 1);
}, 120);

TEX[GRAVEL] = makeTex((g, r) => {
  baseNoise(g, r, '#79726d', ['#615b57', '#8d8781', '#544f4b', '#a09a93'], 130);
  for (let i = 0; i < 12; i++) {
    g.fillStyle = ['#615b57', '#8d8781', '#a09a93'][(r() * 3) | 0];
    g.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2);
  }
}, 121);

TEX[SANDSTONE] = makeTex((g, r) => {
  baseNoise(g, r, '#d6c27e', ['#cbb26a', '#e2d093', '#bfa55f'], 60);
  g.fillStyle = '#b39a55';
  g.fillRect(0, 4, 16, 1); g.fillRect(0, 10, 16, 1);
  g.fillStyle = '#e8d9a4';
  g.fillRect(0, 5, 16, 1); g.fillRect(0, 11, 16, 1);
}, 122);

TEX[STONEBRICK] = makeTex((g, r) => {
  baseNoise(g, r, '#7b7e88', ['#6d7079', '#8b8e98', '#73767f'], 70);
  g.fillStyle = '#555861';
  g.fillRect(0, 7, 16, 1); g.fillRect(0, 15, 16, 1);
  g.fillRect(7, 0, 1, 8); g.fillRect(3, 8, 1, 8); g.fillRect(12, 8, 1, 8);
  g.fillStyle = '#999ca6';
  g.fillRect(0, 8, 16, 1); g.fillRect(8, 0, 1, 7);
}, 123);

TEX[CRAFT_TABLE] = makeTex((g, r) => {
  baseNoise(g, r, '#a06b3a', ['#8f5d31', '#b37c47', '#7d5129'], 50);
  g.fillStyle = '#6b4726';
  g.fillRect(0, 0, 16, 2); g.fillRect(0, 14, 16, 2);
  g.fillRect(0, 0, 2, 16); g.fillRect(14, 0, 2, 16);
  g.fillStyle = '#c99a5f';
  g.fillRect(3, 3, 10, 10);
  g.fillStyle = '#7d5129';
  g.fillRect(7, 3, 1, 10); g.fillRect(3, 7, 10, 1);
  g.fillStyle = '#5b3a1e';
  g.fillRect(3, 3, 2, 2); g.fillRect(11, 11, 2, 2);
}, 124);

TEX[FURNACE] = makeTex((g, r) => {
  baseNoise(g, r, '#6f737c', ['#61646d', '#7d818b', '#585b63'], 80);
  g.fillStyle = '#3a3a40';
  g.fillRect(3, 4, 10, 8);
  g.fillStyle = '#1f1d1c';
  g.fillRect(4, 8, 8, 4);
  g.fillStyle = '#ff9d2e';
  g.fillRect(5, 10, 2, 2); g.fillRect(8, 9, 2, 3);
  g.fillStyle = '#5b3a1e';
  g.fillRect(4, 5, 8, 1);
}, 125);

TEX[CHEST] = makeTex((g, r) => {
  baseNoise(g, r, '#a06b3a', ['#8f5d31', '#b37c47', '#7d5129'], 40);
  g.fillStyle = '#6b4726';
  g.fillRect(0, 0, 16, 2); g.fillRect(0, 14, 16, 2);
  g.fillRect(0, 0, 2, 16); g.fillRect(14, 0, 2, 16);
  g.fillRect(0, 7, 16, 1);
  g.fillStyle = '#ffd34d';
  g.fillRect(7, 6, 2, 4);
  g.fillStyle = '#3a2a1a';
  g.fillRect(4, 3, 8, 1); g.fillRect(4, 10, 8, 1);
}, 126);

TEX[LAVA] = makeTex((g, r) => {
  g.fillStyle = '#d63d0a';
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ['#ff7a1a', '#ffb02e', '#ff4d00', '#ffe066'][(r() * 4) | 0];
    g.fillRect((r() * 16) | 0, (r() * 16) | 0, 2, 1);
  }
}, 127);

TEX[WOOL] = makeTex((g, r) => {
  baseNoise(g, r, '#eeeeee', ['#dedede', '#ffffff', '#d0d0d0'], 100);
}, 128);

TEX[FLOWER] = makeTex((g, r) => {
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = '#3f7a2e';
  g.fillRect(7, 8, 2, 8);
  g.fillRect(5, 11, 2, 1); g.fillRect(9, 13, 2, 1);
  g.fillStyle = '#ff5d8f';
  g.fillRect(5, 3, 6, 5); g.fillRect(6, 2, 4, 7);
  g.fillStyle = '#ffd0e6';
  g.fillRect(7, 4, 2, 3);
  g.fillStyle = '#ffe066';
  g.fillRect(7, 5, 1, 1);
}, 129);

TEX[TALLGRASS] = makeTex((g, r) => {
  g.clearRect(0, 0, 16, 16);
  for (let i = 0; i < 7; i++) {
    const x = 2 + ((r() * 12) | 0);
    const h = 6 + ((r() * 8) | 0);
    g.fillStyle = ['#3f7a2e', '#4f9a35', '#2f6b26'][(r() * 3) | 0];
    g.fillRect(x, 16 - h, 1, h);
    g.fillRect(x + 1, 16 - h + 2, 1, h - 2);
  }
}, 130);

/* ── предметы, иконки, инструменты ───────────────────────── */
const ITEMS = [];
const ICONS = [];

function iconCanvas(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}

ICONS[STICK] = iconCanvas(g => {
  g.fillStyle = '#6b4726';
  for (let i = 0; i < 10; i++) g.fillRect(3 + i, 13 - i, 2, 2);
  g.fillStyle = '#8a5a2b';
  for (let i = 0; i < 8; i++) g.fillRect(3 + i, 12 - i, 1, 1);
});
ICONS[COAL_ITEM] = iconCanvas(g => {
  g.fillStyle = '#1b1b21';
  g.fillRect(3, 5, 9, 7); g.fillRect(5, 3, 5, 2); g.fillRect(4, 11, 7, 2);
  g.fillStyle = '#3d3d47';
  g.fillRect(4, 4, 3, 2); g.fillRect(9, 7, 2, 2);
  g.fillStyle = '#6a6a78';
  g.fillRect(5, 5, 1, 1);
});
ICONS[CHARCOAL] = iconCanvas(g => {
  g.fillStyle = '#2c2119';
  g.fillRect(3, 5, 9, 7); g.fillRect(5, 3, 5, 2); g.fillRect(4, 11, 7, 2);
  g.fillStyle = '#4a3a2c';
  g.fillRect(4, 4, 3, 2);
});
function ingotIcon(c1, c2) {
  return iconCanvas(g => {
    g.fillStyle = c2;
    g.fillRect(2, 7, 12, 5);
    g.fillStyle = c1;
    g.fillRect(3, 6, 10, 4);
    g.fillStyle = '#ffffff66';
    g.fillRect(4, 7, 5, 1);
  });
}
ICONS[IRON_INGOT] = ingotIcon('#d9dde5', '#8d939f');
ICONS[GOLD_INGOT] = ingotIcon('#ffd84f', '#b8871c');
ICONS[DIAMOND_ITEM] = iconCanvas(g => {
  g.fillStyle = '#5ff0de';
  g.beginPath(); g.moveTo(8, 2); g.lineTo(14, 8); g.lineTo(8, 14); g.lineTo(2, 8); g.closePath(); g.fill();
  g.fillStyle = '#b9fff5';
  g.beginPath(); g.moveTo(8, 3); g.lineTo(8, 8); g.lineTo(3, 8); g.closePath(); g.fill();
  g.fillStyle = '#1f8f86';
  g.fillRect(7, 9, 2, 3);
});
ICONS[APPLE] = iconCanvas(g => {
  g.fillStyle = '#d63b3b';
  g.beginPath(); g.arc(8, 9, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff6b6b';
  g.beginPath(); g.arc(6, 7, 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6b4726'; g.fillRect(8, 2, 1, 3);
  g.fillStyle = '#4f9a35'; g.fillRect(9, 2, 3, 2);
});
function meatIcon(c1, c2, cooked) {
  return iconCanvas(g => {
    g.fillStyle = c2;
    g.fillRect(2, 4, 12, 9);
    g.fillStyle = c1;
    g.fillRect(3, 4, 10, 7);
    g.fillStyle = cooked ? '#8a5a2b' : '#ffb3c0';
    g.fillRect(4, 5, 4, 2); g.fillRect(9, 8, 3, 2);
    g.fillStyle = '#e8d7c0';
    g.fillRect(11, 10, 4, 3);
  });
}
ICONS[RAW_BEEF] = meatIcon('#c94a4a', '#8f2f2f', false);
ICONS[COOKED_BEEF] = meatIcon('#8a4a2b', '#5b2f1a', true);
ICONS[RAW_PORK] = meatIcon('#ff9aa8', '#c96b7a', false);
ICONS[COOKED_PORK] = meatIcon('#c97a4a', '#8a4a2b', true);
ICONS[LEATHER] = iconCanvas(g => {
  g.fillStyle = '#8a5a2b';
  g.fillRect(2, 4, 12, 9);
  g.fillStyle = '#b07a3f';
  g.fillRect(3, 5, 10, 7);
  g.fillStyle = '#6b4726';
  g.fillRect(3, 5, 10, 1); g.fillRect(3, 11, 10, 1);
});
ICONS[ROTTEN_FLESH] = iconCanvas(g => {
  g.fillStyle = '#6b6b2b';
  g.fillRect(2, 4, 12, 9);
  g.fillStyle = '#8a8a3a';
  g.fillRect(3, 5, 8, 6);
  g.fillStyle = '#3f3f1a';
  g.fillRect(5, 7, 3, 2); g.fillRect(10, 9, 2, 2);
});

function eggIcon(base, spot, dark) {
  return iconCanvas(g => {
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(8, 9, 5.2, 6.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = base;
    g.beginPath(); g.ellipse(8, 8.5, 4.3, 5.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = spot;
    g.fillRect(5, 6, 2, 2); g.fillRect(9, 9, 2, 2); g.fillRect(6, 11, 2, 1);
    g.fillStyle = '#ffffff88';
    g.fillRect(6, 4, 1, 2);
  });
}
ICONS[COW_EGG] = eggIcon('#f1e7da', '#3a3430', '#b8a894');
ICONS[PIG_EGG] = eggIcon('#ff9aa8', '#d96f82', '#b55a6a');
ICONS[ZOMBIE_EGG] = eggIcon('#6fbf5f', '#2f6b2f', '#3f7a35');
ICONS[SLIME_EGG] = eggIcon('#58ca6b', '#2f8f3f', '#2a5c2a');

const TOOL_MATS = [
  { tier: 1, name: 'Деревянн', c1: '#c08a4a', c2: '#8a5a2b', speed: 2.2, dur: 60 },
  { tier: 2, name: 'Каменн', c1: '#a8abb4', c2: '#71747d', speed: 4.0, dur: 130 },
  { tier: 3, name: 'Железн', c1: '#e4e8ef', c2: '#a3a9b5', speed: 6.0, dur: 280 },
  { tier: 4, name: 'Алмазн', c1: '#6ff7e4', c2: '#2ab3a4', speed: 9.0, dur: 800 }
];

function toolIcon(kind, c1, c2) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  // рукоять
  for (let i = 0; i < 9; i++) {
    g.fillStyle = i < 4 ? '#8a5a2b' : '#6b4726';
    g.fillRect(2 + i, 13 - i, 2, 2);
  }
  g.fillStyle = '#4a2f19';
  g.fillRect(2, 13, 3, 2);

  if (kind === 'sword') {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = c1; g.fillRect(8 + i, 7 - i, 2, 2);
      g.fillStyle = c2; g.fillRect(9 + i, 7 - i, 1, 1);
    }
    g.fillStyle = '#d8c070'; g.fillRect(6, 9, 4, 1);
    g.fillStyle = '#a08a3a'; g.fillRect(7, 10, 2, 2);
  } else if (kind === 'pick') {
    g.fillStyle = c2; g.fillRect(2, 3, 12, 2);
    g.fillStyle = c1; g.fillRect(3, 4, 10, 1);
    g.fillRect(2, 5, 2, 2); g.fillRect(12, 5, 2, 2);
  } else if (kind === 'axe') {
    g.fillStyle = c2; g.fillRect(7, 2, 7, 6);
    g.fillStyle = c1; g.fillRect(8, 3, 5, 4);
    g.fillStyle = c2; g.fillRect(5, 4, 2, 3);
  } else if (kind === 'shovel') {
    g.fillStyle = c2; g.fillRect(8, 1, 5, 6);
    g.fillStyle = c1; g.fillRect(9, 2, 3, 4);
  }
  return c;
}

function addTool(id, name, kind, mat) {
  const icon = toolIcon(kind, mat.c1, mat.c2);
  ICONS[id] = icon;
  ITEMS[id] = {
    id, name, icon, block: 0, stack: 1,
    tool: {
      kind,
      tier: mat.tier,
      speed: kind === 'sword' ? 1.2 : mat.speed,
      maxDur: kind === 'sword' ? Math.round(mat.dur * 0.8) : mat.dur,
      dmg: kind === 'sword' ? [0, 3, 4, 5, 6][mat.tier] : 1
    }
  };
}

const KINDS = [
  { key: 'pick', ids: [WOOD_PICK, STONE_PICK, IRON_PICK, DIAMOND_PICK], suffix: 'кирка' },
  { key: 'axe', ids: [WOOD_AXE, STONE_AXE, IRON_AXE, DIAMOND_AXE], suffix: 'топор' },
  { key: 'shovel', ids: [WOOD_SHOVEL, STONE_SHOVEL, IRON_SHOVEL, DIAMOND_SHOVEL], suffix: 'лопата' },
  { key: 'sword', ids: [WOOD_SWORD, STONE_SWORD, IRON_SWORD, DIAMOND_SWORD], suffix: 'меч' }
];
KINDS.forEach(k => {
  const fem = k.key === 'pick' || k.key === 'shovel';
  TOOL_MATS.forEach((mat, i) => {
    addTool(k.ids[i], `${mat.name}${fem ? 'ая' : 'ый'} ${k.suffix}`, k.key, mat);
  });
});

/* пищевые предметы */
[[APPLE, 'Яблоко', 4], [RAW_BEEF, 'Сырая говядина', 3], [COOKED_BEEF, 'Стейк', 8],
 [RAW_PORK, 'Сырая свинина', 3], [COOKED_PORK, 'Жареная свинина', 8],
 [ROTTEN_FLESH, 'Гнилая плоть', 1]].forEach(([id, name, food]) => {
  ITEMS[id] = { id, name, icon: ICONS[id], block: 0, food, stack: 64 };
});
[[STICK, 'Палка'], [COAL_ITEM, 'Уголь'], [CHARCOAL, 'Древесный уголь'],
 [IRON_INGOT, 'Железный слиток'], [GOLD_INGOT, 'Золотой слиток'],
 [DIAMOND_ITEM, 'Алмаз'], [LEATHER, 'Кожа']].forEach(([id, name]) => {
  ITEMS[id] = { id, name, icon: ICONS[id], block: 0, stack: 64 };
});
[[COW_EGG, 'Яйцо призыва · Корова', 'cow'],
 [PIG_EGG, 'Яйцо призыва · Свинья', 'pig'],
 [ZOMBIE_EGG, 'Яйцо призыва · Зомби', 'zombie'],
 [SLIME_EGG, 'Яйцо призыва · Слизень', 'slime']].forEach(([id, name, kind]) => {
  ITEMS[id] = { id, name, icon: ICONS[id], block: 0, stack: 64, egg: kind, creativeOnly: true };
});

/* блоки как предметы */
for (let id = 1; id < BLOCKS.length; id++) {
  if (!BLOCKS[id] || id === AIR) continue;
  ICONS[id] = TEX[id];
  ITEMS[id] = { id, name: BLOCKS[id].name, icon: TEX[id], block: id, stack: 64 };
}
/* топливо */
ITEMS[COAL_ITEM].fuel = 30;
ITEMS[CHARCOAL].fuel = 30;
ITEMS[LOG].fuel = 12;
ITEMS[PLANKS].fuel = 6;
ITEMS[STICK].fuel = 3;

/* фон пещер (не блок, а «стена» позади) */
const WALL_TEX = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = rng(4242);
  g.fillStyle = '#3a2a22';
  g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 2000; i++) {
    g.fillStyle = ['#221812', '#544034', '#2c201a', '#6a5242', '#160f0b'][(r() * 5) | 0];
    g.fillRect((r() * 64) | 0, (r() * 64) | 0, 1, 1);
  }
  for (let i = 0; i < 110; i++) {
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.fillRect((r() * 58) | 0, (r() * 58) | 0, 2 + ((r() * 6) | 0), 1);
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = '#6a5242';
    g.fillRect((r() * 62) | 0, (r() * 62) | 0, 2, 2);
  }
  return c;
})();

/* ── world ───────────────────────────────────────────────── */
const W = 320, H = 128, TILE = 40;
const SAVE_KEY = 'avirbeta_save_v2';
const DAY_LENGTH = 480;
const REACH = 5.5;

let world = new Uint8Array(W * H);
let surfaceArr = new Int16Array(W);
let seed = 1;

const idx = (x, y) => y * W + x;
const inWorld = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

function tileAt(x, y) {
  if (!inWorld(x, y)) return BEDROCK;
  return world[idx(x, y)];
}
function isSolid(x, y) {
  if (x < 0 || x >= W) return true;
  if (y < 0) return false;
  if (y >= H) return true;
  return BLOCKS[world[idx(x, y)]].solid;
}
function isWater(x, y) {
  return inWorld(x, y) && world[idx(x, y)] === WATER;
}
function isLava(x, y) {
  return inWorld(x, y) && world[idx(x, y)] === LAVA;
}

/* ── terrain generation ──────────────────────────────────── */
const BIOME_PLAINS = 0, BIOME_FOREST = 1, BIOME_DESERT = 2, BIOME_SNOW = 3, BIOME_MOUNTAIN = 4;
let biomeArr = new Uint8Array(W);

function worldLooksValid(w) {
  if (!w || w.length !== W * H) return false;
  let solid = 0, air = 0;
  for (let i = 0; i < w.length; i++) {
    const id = w[i];
    if (!BLOCKS[id]) return false;
    if (BLOCKS[id].solid) solid++;
    else if (id === AIR) air++;
  }
  return solid > W * 12 && air > W * 2 && solid < w.length - W * 2;
}

function genFlatWorld(newSeed) {
  seed = (newSeed >>> 0) || 1;
  world = new Uint8Array(W * H);
  surfaceArr = new Int16Array(W);
  biomeArr = new Uint8Array(W);
  const r = rng(seed);
  const base = 60;
  for (let x = 0; x < W; x++) {
    surfaceArr[x] = base;
    biomeArr[x] = BIOME_PLAINS;
    for (let y = base; y < H; y++) {
      let id = STONE;
      if (y === base) id = GRASS;
      else if (y < base + 4) id = DIRT;
      if (y >= H - 2) id = BEDROCK;
      world[idx(x, y)] = id;
    }
    if (x > 10 && x < W - 10 && r() < 0.05) {
      const th = 4 + ((r() * 3) | 0);
      for (let i = 1; i <= th; i++) world[idx(x, base - i)] = LOG;
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && dy === -2) continue;
          const lx = x + dx, ly = base - th + dy;
          if (inWorld(lx, ly) && world[idx(lx, ly)] === AIR) world[idx(lx, ly)] = LEAVES;
        }
      }
    }
  }
  const sx = Math.floor(W / 2);
  for (let dx = -4; dx <= 4; dx++) {
    const x = clamp(sx + dx, 0, W - 1);
    for (let dy = -4; dy < 0; dy++) if (inWorld(x, base + dy)) world[idx(x, base + dy)] = AIR;
    world[idx(x, base)] = GRASS;
    biomeArr[x] = BIOME_PLAINS;
  }
  spawnX = sx + 0.15;
  spawnY = base - 1.8;
}

function genWorld(newSeed) {
  seed = (newSeed >>> 0) || 1;
  world = new Uint8Array(W * H);
  surfaceArr = new Int16Array(W);
  biomeArr = new Uint8Array(W);
  const r = rng(seed);

  for (let x = 0; x < W; x++) {
    const temp = noise2(x * 0.008, 0, seed + 50);
    const hum = noise2(x * 0.01, 0, seed + 51);
    const mount = noise2(x * 0.005, 0, seed + 52);

    let biome;
    if (Math.abs(x - W / 2) < 10) biome = BIOME_PLAINS;
    else if (mount > 0.7) biome = BIOME_MOUNTAIN;
    else if (temp < 0.38) biome = BIOME_SNOW;
    else if (temp > 0.62) biome = BIOME_DESERT;
    else if (hum > 0.52) biome = BIOME_FOREST;
    else biome = BIOME_PLAINS;
    biomeArr[x] = biome;

    let h = 62
      + (fbm(x * 0.018, 0, seed + 1, 4) - 0.5) * 18
      + (noise2(x * 0.07, 0, seed + 2) - 0.5) * 4;
    if (biome === BIOME_MOUNTAIN) h -= 8 + (mount - 0.74) * 55;
    if (biome === BIOME_DESERT) h += 2;
    h = clamp(Math.round(h), 36, H - 32);
    surfaceArr[x] = h;

    for (let y = h; y < H; y++) {
      let id = STONE;
      const d = y - h;
      if (y >= H - 2) id = BEDROCK;
      else if (d < 4) {
        if (biome === BIOME_DESERT) id = SAND;
        else if (biome === BIOME_SNOW) id = d < 2 ? SNOW : DIRT;
        else if (biome === BIOME_MOUNTAIN && h < 52) id = STONE;
        else id = DIRT;
      } else if (d < 9 && biome === BIOME_DESERT) {
        id = SANDSTONE;
      } else {
        const n1 = fbm(x * 0.05, y * 0.075, seed + 7, 4);
        const n2 = fbm(x * 0.07 + 40, y * 0.05 + 40, seed + 8, 3);
        const tunnel = Math.abs(n2 - 0.5);
        const th = 0.69 - Math.min(0.07, d * 0.0009);
        if (d > 8 && (n1 > th || (d > 11 && tunnel < 0.012))) id = AIR;
      }
      world[idx(x, y)] = id;
    }

    let top;
    if (biome === BIOME_DESERT) top = SAND;
    else if (biome === BIOME_SNOW) top = SNOW;
    else if (biome === BIOME_MOUNTAIN) top = h < 46 ? SNOW : (h < 54 ? STONE : GRASS);
    else top = GRASS;
    world[idx(x, h)] = top;

    // редкие ледяные пятна в снежном биоме
    if (biome === BIOME_SNOW && r() < 0.06 && h > 2) world[idx(x, h)] = ICE;
  }

  // ore veins
  const ro = rng(seed + 99);
  function vein(id, count, minD, maxD, smin, smax) {
    for (let i = 0; i < count; i++) {
      let cx = 3 + ((ro() * (W - 6)) | 0);
      let cy = Math.round(surfaceArr[cx] + minD + ro() * (maxD - minD));
      const n = smin + ((ro() * (smax - smin + 1)) | 0);
      for (let k = 0; k < n; k++) {
        if (inWorld(cx, cy) && world[idx(cx, cy)] === STONE) world[idx(cx, cy)] = id;
        const dir = (ro() * 4) | 0;
        if (dir === 0) cx++; else if (dir === 1) cx--; else if (dir === 2) cy++; else cy--;
        cx = clamp(cx, 2, W - 3);
        cy = clamp(cy, 2, H - 3);
      }
    }
  }
  vein(COAL, 240, 5, 55, 3, 6);
  vein(IRON, 140, 14, 75, 3, 5);
  vein(GOLD, 60, 28, 95, 2, 4);
  vein(DIAMOND, 24, 48, 110, 2, 3);

  // деревья и декор
  let lastTree = -20;
  for (let x = 4; x < W - 4; x++) {
    const gy = surfaceArr[x];
    const top = world[idx(x, gy)];
    const biome = biomeArr[x];
    if (x - lastTree < 4) continue;

    if (biome === BIOME_DESERT && top === SAND && r() < 0.055) {
      const ch = 1 + ((r() * 3) | 0);
      for (let i = 1; i <= ch; i++) if (gy - i > 0) world[idx(x, gy - i)] = CACTUS;
      lastTree = x;
      continue;
    }

    if (top !== GRASS && !(biome === BIOME_SNOW && top === SNOW)) continue;

    let chance = 0;
    if (biome === BIOME_FOREST) chance = 0.16;
    else if (biome === BIOME_PLAINS) chance = 0.055;
    else if (biome === BIOME_SNOW) chance = 0.09;
    else if (biome === BIOME_MOUNTAIN) chance = 0.04;
    if (r() > chance) continue;

    const spruce = biome === BIOME_SNOW;
    const th = spruce ? 6 + ((r() * 4) | 0) : 4 + ((r() * 4) | 0);
    for (let i = 1; i <= th; i++) {
      const yy = gy - i;
      if (yy > 0) world[idx(x, yy)] = LOG;
    }

    if (spruce) {
      for (let layer = 0; layer < 5; layer++) {
        const yy = gy - th + layer * 2;
        const rad = layer < 1 ? 1 : (layer < 3 ? 2 : 1);
        for (let dx = -rad; dx <= rad; dx++) {
          if (dx === 0 && layer < 4) continue;
          const lx = x + dx;
          if (inWorld(lx, yy) && world[idx(lx, yy)] === AIR) world[idx(lx, yy)] = LEAVES;
        }
      }
      if (gy - th - 1 > 0) world[idx(x, gy - th - 1)] = LEAVES;
    } else {
      for (let dy = -3; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy >= 0) continue;
          if (Math.abs(dx) === 2 && dy === -3) continue;
          const lx = x + dx, ly = gy - th + dy;
          if (inWorld(lx, ly) && world[idx(lx, ly)] === AIR) world[idx(lx, ly)] = LEAVES;
        }
      }
    }
    lastTree = x;
  }

  // трава и цветы
  for (let x = 2; x < W - 2; x++) {
    const gy = surfaceArr[x];
    if (world[idx(x, gy)] !== GRASS) continue;
    if (world[idx(x, gy - 1)] !== AIR) continue;
    if (biomeArr[x] === BIOME_DESERT) continue;
    const roll = r();
    if (roll < 0.12) world[idx(x, gy - 1)] = FLOWER;
    else if (roll < 0.4) world[idx(x, gy - 1)] = TALLGRASS;
  }

  // площадка спавна
  const sx = Math.floor(W / 2);
  for (let dx = -4; dx <= 4; dx++) {
    const x = clamp(sx + dx, 0, W - 1);
    const gy = surfaceArr[x];
    for (let dy = -4; dy < 0; dy++) {
      if (inWorld(x, gy + dy)) world[idx(x, gy + dy)] = AIR;
    }
    world[idx(x, gy)] = GRASS;
    biomeArr[x] = BIOME_PLAINS;
  }
  spawnX = sx + 0.15;
  spawnY = surfaceArr[sx] - 1.8;
}

/* ── lighting ────────────────────────────────────────────── */
const skyL = new Uint8Array(W * H);
const blkL = new Uint8Array(W * H);
let lightDirty = false;

function propagate(q, grid) {
  for (let head = 0; head < q.length; head++) {
    const i = q[head];
    const l = grid[i];
    if (l <= 1) continue;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) { const ni = i - 1; if (lightPass(world[ni]) && grid[ni] < l - 1) { grid[ni] = l - 1; q.push(ni); } }
    if (x < W - 1) { const ni = i + 1; if (lightPass(world[ni]) && grid[ni] < l - 1) { grid[ni] = l - 1; q.push(ni); } }
    if (y > 0) { const ni = i - W; if (lightPass(world[ni]) && grid[ni] < l - 1) { grid[ni] = l - 1; q.push(ni); } }
    if (y < H - 1) { const ni = i + W; if (lightPass(world[ni]) && grid[ni] < l - 1) { grid[ni] = l - 1; q.push(ni); } }
  }
}

function computeLight() {
  skyL.fill(0);
  blkL.fill(0);
  const q = [];

  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const i = idx(x, y);
      if (!lightPass(world[i])) break;
      skyL[i] = 15;
      q.push(i);
    }
  }
  propagate(q, skyL);

  q.length = 0;
  for (let i = 0; i < world.length; i++) {
    if (world[i] === TORCH) { blkL[i] = 14; q.push(i); }
    else if (world[i] === LAVA) { blkL[i] = 15; q.push(i); }
  }
  propagate(q, blkL);
}

/* ── canvas & camera ─────────────────────────────────────── */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const worldCanvas = document.createElement('canvas');
const wctx = worldCanvas.getContext('2d');
let vw = 0, vh = 0;
let camX = 0, camY = 0, shake = 0;

function resize() {
  vw = window.innerWidth;
  vh = window.innerHeight;
  canvas.width = vw;
  canvas.height = vh;
  worldCanvas.width = vw;
  worldCanvas.height = vh;
  ctx.imageSmoothingEnabled = false;
  wctx.imageSmoothingEnabled = false;
  camX = clamp(camX, 0, Math.max(0, W * TILE - vw));
  camY = clamp(camY, 0, Math.max(0, H * TILE - vh));
}
window.addEventListener('resize', resize);

/* ── player & state ──────────────────────────────────────── */
const GRAV = 58;
let spawnX = W / 2, spawnY = 40;

const player = {
  x: 0, y: 0, w: 0.7, h: 1.8,
  vx: 0, vy: 0, onGround: false, coyote: 0, jumpHeld: false,
  face: 1, walkPhase: 0, hp: 20, invuln: 0, regenTimer: 0, regenAcc: 0,
  dead: false, deadT: 0, hunger: 20, hungerAcc: 0, starveAcc: 0,
  mode: 'survival', flying: false, lastSpaceTap: 0
};

const toolDur = new Map();

let time = 0;
let dayTime = 0.22;
let dayCount = 1;
let paused = false;
const settings = { volume: 0.6 };
try {
  const st = JSON.parse(localStorage.getItem('avirbeta_settings') || '{}');
  if (typeof st.volume === 'number') settings.volume = clamp(st.volume, 0, 1);
} catch (e) {}
try {
  // старые/несовместимые сохранения из ранних версий
  localStorage.removeItem('mc2d_save_v1');
  localStorage.removeItem('avirbeta_save_v1');
} catch (e) {}
let craftOpen = false;
let invOpen = false;
let invTab = 'all';
let invSearch = '';
let started = false;
let furnaceOpen = false;
let chestOpen = false;
let chestKey = null;
const chests = new Map();
let worldDifficulty = 'normal';
let selected = 0;
let saveAcc = 0;

const inv = new Map();
let hotbar = [PLANKS, TORCH, null, null, null, null, null, null, null];

const slimes = [];
const mobs = [];
const particles = [];
const mining = { x: -1, y: -1, progress: 0 };
let attackCd = 0, placeCd = 0, spawnTimer = 3;
let animalTimer = 5, zombieTimer = 8;

const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, left: false, right: false };
const keys = {};

/* ── inventory ───────────────────────────────────────────── */
const count = id => inv.get(id) || 0;

function addItem(id, n = 1) {
  if (!id) return;
  inv.set(id, count(id) + n);
  if (!hotbar.includes(id)) {
    const empty = hotbar.indexOf(null);
    if (empty >= 0) hotbar[empty] = id;
  }
  updateHotbar();
}
function takeItem(id, n = 1) {
  const c = count(id);
  if (c < n) return false;
  if (c === n) inv.delete(id); else inv.set(id, c - n);
  updateHotbar();
  return true;
}

function selectSlot(i) {
  selected = clamp(i, 0, 8);
  updateHotbar();
  if (invSlot) invSlot.textContent = selected + 1;
}

/* ── crafting (3×3) ─────────────────────────────────────── */
const RECIPES = [];
function trimPattern(pat) {
  let minX = 99, maxX = -1;
  for (const row of pat) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ' ') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX < 0) return pat;
  return pat.map(row => row.slice(minX, maxX + 1));
}
function addRecipe(out, opts) {
  if (opts.pattern) opts.pattern = trimPattern(opts.pattern);
  RECIPES.push(Object.assign({ out }, opts));
}

addRecipe([PLANKS, 4], { shapeless: [[LOG, 1]] });
addRecipe([STICK, 4], { shapeless: [[PLANKS, 2]] });
addRecipe([TORCH, 4], { shapeless: [[COAL_ITEM, 1], [STICK, 1]] });
addRecipe([TORCH, 4], { shapeless: [[CHARCOAL, 1], [STICK, 1]] });

addRecipe([CRAFT_TABLE, 1], { pattern: ['PP', 'PP'], key: { P: PLANKS } });
addRecipe([STONEBRICK, 4], { pattern: ['CC', 'CC'], key: { C: COBBLE } });
addRecipe([SANDSTONE, 1], { pattern: ['SS', 'SS'], key: { S: SAND } });
addRecipe([FURNACE, 1], { pattern: ['CCC', 'C C', 'CCC'], key: { C: COBBLE } });
addRecipe([CHEST, 1], { pattern: ['PPP', 'P P', 'PPP'], key: { P: PLANKS } });

const TOOL_MATERIALS = [[PLANKS, 0], [COBBLE, 1], [IRON_INGOT, 2], [DIAMOND_ITEM, 3]];
const TOOL_PATTERNS = {
  pick: ['MMM', ' S ', ' S '],
  axe: ['MM ', 'MS ', ' S '],
  shovel: [' M ', ' S ', ' S '],
  sword: [' M ', ' M ', ' S ']
};
KINDS.forEach(k => {
  TOOL_MATERIALS.forEach(([mat, i]) => {
    addRecipe([k.ids[i], 1], {
      pattern: TOOL_PATTERNS[k.key],
      key: { M: mat, S: STICK }
    });
  });
});

const craftGrid = new Array(9).fill(null);
let craftDomBuilt = false;

function itemName(id) { return ITEMS[id] ? ITEMS[id].name : '???'; }
function itemCategory(id) {
  const it = ITEMS[id];
  if (!it) return 'materials';
  if (it.egg) return 'eggs';
  if (it.block) return 'blocks';
  if (it.tool) return 'tools';
  if (it.food) return 'food';
  return 'materials';
}
function itemIcon(id) { return ICONS[id] || TEX[id]; }

function recipeCost(rec) {
  const m = new Map();
  if (rec.shapeless) {
    for (const [id, n] of rec.shapeless) m.set(id, (m.get(id) || 0) + n);
  } else {
    for (const row of rec.pattern) {
      for (const ch of row) {
        if (ch === ' ') continue;
        const id = rec.key[ch];
        m.set(id, (m.get(id) || 0) + 1);
      }
    }
  }
  return m;
}

function canCraft(rec) {
  if (player.mode === 'creative') return true;
  for (const [id, n] of recipeCost(rec)) if (count(id) < n) return false;
  return true;
}

function matchRecipe() {
  const items = craftGrid.filter(Boolean);
  if (!items.length) return null;

  for (const rec of RECIPES) {
    if (rec.shapeless) {
      const req = [];
      for (const [id, n] of rec.shapeless) for (let k = 0; k < n; k++) req.push(id);
      if (items.length !== req.length) continue;
      const pool = items.slice();
      let ok = true;
      for (const id of req) {
        const i = pool.indexOf(id);
        if (i < 0) { ok = false; break; }
        pool.splice(i, 1);
      }
      if (ok && pool.length === 0) return rec;
      continue;
    }

    let minX = 3, maxX = -1, minY = 3, maxY = -1;
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (craftGrid[y * 3 + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const pat = rec.pattern;
    if (w !== pat[0].length || h !== pat.length) continue;

    let ok = true;
    for (let y = 0; y < h && ok; y++) {
      for (let x = 0; x < w && ok; x++) {
        const ch = pat[y][x];
        const cell = craftGrid[(minY + y) * 3 + (minX + x)];
        if (ch === ' ') {
          if (cell !== null) ok = false;
        } else if (cell !== rec.key[ch]) {
          ok = false;
        }
      }
    }
    if (ok) return rec;
  }
  return null;
}

function clearCraftGrid() {
  craftGrid.fill(null);
}

function fillRecipe(rec) {
  clearCraftGrid();
  if (rec.shapeless) {
    let i = 0;
    for (const [id, n] of rec.shapeless) for (let k = 0; k < n && i < 9; k++) craftGrid[i++] = id;
  } else {
    for (let y = 0; y < rec.pattern.length; y++) {
      for (let x = 0; x < rec.pattern[y].length; x++) {
        const ch = rec.pattern[y][x];
        craftGrid[y * 3 + x] = ch === ' ' ? null : rec.key[ch];
      }
    }
  }
  renderCraftGrid();
}

function craftCurrent() {
  const rec = matchRecipe();
  if (!rec || !canCraft(rec)) return;
  if (player.mode !== 'creative') {
    for (const [id, n] of recipeCost(rec)) takeItem(id, n);
  }
  addItem(rec.out[0], rec.out[1]);
  const outItem = ITEMS[rec.out[0]];
  if (outItem && outItem.tool) toolDur.set(rec.out[0], outItem.tool.maxDur);
  sfx('craft');
  toast(`Создано: ${itemName(rec.out[0])} ×${rec.out[1]}`);
  refreshCraft();
  updateHotbar();
}

function buildCraftGrid() {
  if (craftDomBuilt) return;
  craftDomBuilt = true;
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'craft-cell';
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    cell.appendChild(cv);
    cell.addEventListener('click', () => {
      craftGrid[i] = null;
      renderCraftGrid();
    });
    craftGridEl.appendChild(cell);
  }
  craftResultEl.addEventListener('click', craftCurrent);
}

function renderCraftGrid() {
  const cells = craftGridEl.children;
  for (let i = 0; i < 9; i++) {
    const cv = cells[i].querySelector('canvas');
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 16, 16);
    if (craftGrid[i]) g.drawImage(itemIcon(craftGrid[i]), 0, 0);
  }
  renderCraftResult();
}

function renderCraftResult() {
  const rec = matchRecipe();
  craftResultEl.innerHTML = '';
  craftResultEl.disabled = true;
  if (!rec) return;

  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  cv.getContext('2d').drawImage(itemIcon(rec.out[0]), 0, 0);
  const label = document.createElement('div');
  label.className = 'cnt';
  label.textContent = `×${rec.out[1]}`;
  craftResultEl.append(cv, label);
  craftResultEl.title = itemName(rec.out[0]);
  craftResultEl.disabled = !canCraft(rec);
}

function refreshCraftBook() {
  craftBookEl.innerHTML = '';
  for (const rec of RECIPES) {
    const row = document.createElement('div');
    row.className = 'recipe' + (canCraft(rec) ? '' : ' off');

    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    cv.getContext('2d').drawImage(itemIcon(rec.out[0]), 0, 0);

    const info = document.createElement('div');
    info.className = 'info';
    const cost = [...recipeCost(rec)].map(([id, n]) => `${n}× ${itemName(id)}`).join(' + ');
    info.innerHTML =
      `<div class="name">${rec.out[1]}× ${itemName(rec.out[0])}</div>` +
      `<div class="ing">${cost}</div>`;

    row.append(cv, info);
    row.addEventListener('click', () => {
      fillRecipe(rec);
      renderCraftResult();
    });
    craftBookEl.appendChild(row);
  }
}

function refreshCraftInventory() {
  craftInvEl.innerHTML = '';
  let entries;
  if (player.mode === 'creative') {
    entries = Object.keys(ITEMS).filter(id => ITEMS[id] && id !== AIR).map(id => [Number(id), Infinity]);
  } else {
    entries = Array.from(inv.entries()).filter(([id, n]) => id && n > 0);
  }
  entries.sort((a, b) => a[0] - b[0]);

  for (const [id, n] of entries) {
    const b = document.createElement('button');
    b.className = 'craft-item';
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    cv.getContext('2d').drawImage(itemIcon(id), 0, 0);
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = itemName(id);
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = n === Infinity ? '∞' : n;
    b.append(cv, nm, cnt);
    b.addEventListener('click', () => {
      if (player.mode !== 'creative' && count(id) <= 0) return;
      const empty = craftGrid.indexOf(null);
      if (empty < 0) { toast('Сетка заполнена'); return; }
      craftGrid[empty] = id;
      renderCraftGrid();
      sfx('click');
    });
    craftInvEl.appendChild(b);
  }
}

function refreshCraft() {
  buildCraftGrid();
  renderCraftGrid();
  refreshCraftBook();
  refreshCraftInventory();
}

/* ── DOM ─────────────────────────────────────────────────── */
const hudEl = document.getElementById('hud');
const hotbarEl = document.getElementById('hotbar');
const heartsEl = document.getElementById('hearts');
const hungerCv = document.getElementById('hunger');
const hungerCtx = hungerCv.getContext('2d');
const clockIcon = document.getElementById('clock-icon');
const clockText = document.getElementById('clock-text');
const toastEl = document.getElementById('toast');
const hintEl = document.getElementById('hint');
const craftEl = document.getElementById('craft');
const craftGridEl = document.getElementById('craft-grid');
const craftResultEl = document.getElementById('craft-result');
const craftBookEl = document.getElementById('craft-book');
const craftInvEl = document.getElementById('craft-inv');
const furnacePanel = document.getElementById('furnace-panel');
const smeltListEl = document.getElementById('smelt-list');
const chestPanel = document.getElementById('chest-panel');
const chestGridEl = document.getElementById('chest-grid');
const chestInvEl = document.getElementById('chest-inv');
const invPanel = document.getElementById('inventory');
const invGrid = document.getElementById('inv-grid');
const invSlot = document.getElementById('inv-slot');
const invTabsEl = document.getElementById('inv-tabs');
const invSearchEl = document.getElementById('inv-search');
const modeBadgeEl = document.getElementById('mode-badge');
const pauseEl = document.getElementById('pause');
const titleEl = document.getElementById('title');
const loadingEl = document.getElementById('loading');
const loadingBg = document.getElementById('loading-bg');
const loadingFill = document.getElementById('loading-fill');
const loadingPercent = document.getElementById('loading-percent');
const loadingStep = document.getElementById('loading-step');
const loadingSub = document.getElementById('loading-sub');
const loadingTip = document.getElementById('loading-tip');
const splashEl = document.getElementById('splash');
const btnPlay = document.getElementById('btn-play');
const newWorldPanel = document.getElementById('newworld-panel');
const settingsPanel = document.getElementById('settings-panel');
const aboutPanel = document.getElementById('about-panel');
const seedInput = document.getElementById('seed-input');
const modeSelect = document.getElementById('mode-select');
const diffSelect = document.getElementById('diff-select');
const volInput = document.getElementById('vol');
const slotEls = [];

function buildHotbar() {
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = `<span class="num">${i + 1}</span><canvas width="16" height="16"></canvas><span class="count"></span><div class="dur"><i></i></div>`;
    d.addEventListener('mousedown', e => { e.stopPropagation(); selectSlot(i); });
    hotbarEl.appendChild(d);
    slotEls.push(d);
  }
}

function updateHotbar() {
  for (let i = 0; i < 9; i++) {
    const el = slotEls[i];
    if (!el) continue;
    const id = hotbar[i];
    const cv = el.querySelector('canvas');
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 16, 16);

    const n = !id ? 0 : (player.mode === 'creative' ? Infinity : count(id));
    if (id) c.drawImage(itemIcon(id), 0, 0);

    const cntEl = el.querySelector('.count');
    cntEl.textContent = !id ? '' : (n === Infinity ? '∞' : (n > 0 ? n : ''));
    el.classList.toggle('sel', i === selected);
    el.classList.toggle('dim', !id || (n <= 0 && player.mode !== 'creative'));

    const it = id ? ITEMS[id] : null;
    const durEl = el.querySelector('.dur');
    if (it && it.tool && player.mode !== 'creative') {
      const max = it.tool.maxDur;
      const d = toolDur.has(id) ? toolDur.get(id) : max;
      durEl.style.display = 'block';
      const bar = durEl.querySelector('i');
      bar.style.width = Math.max(0, Math.min(100, d / max * 100)) + '%';
      bar.style.background = d / max > 0.5 ? '#5be36f' : (d / max > 0.2 ? '#ffc84a' : '#ff5d6f');
    } else {
      durEl.style.display = 'none';
    }
  }
}

function updatePauseMode() {
  const el = document.getElementById('pause-mode');
  if (el) el.textContent = player.mode === 'creative' ? 'творческий' : 'выживание';
  if (modeBadgeEl) modeBadgeEl.classList.toggle('hidden', !(started && player.mode === 'creative'));
  const tb = document.getElementById('toggle-mode');
  if (tb) tb.textContent = player.mode === 'creative' ? 'Вернуться в выживание' : 'Включить творческий режим';
}

let lastHpDrawn = -1;
function updateHearts() {
  const full = Math.ceil(clamp(player.hp, 0, 20) / 2);
  if (full === lastHpDrawn) return;
  lastHpDrawn = full;
  heartsEl.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.className = 'heart' + (i < full ? ' on' : '');
    s.textContent = '♥';
    heartsEl.appendChild(s);
  }
}

let lastHungerDrawn = -1;
function updateHunger() {
  const full = Math.ceil(clamp(player.hunger, 0, 20) / 2);
  if (full === lastHungerDrawn) return;
  lastHungerDrawn = full;
  hungerCtx.clearRect(0, 0, 200, 22);
  for (let i = 0; i < 10; i++) {
    const x = i * 20 + 2;
    const on = i < full;
    hungerCtx.fillStyle = on ? '#c97a3a' : '#3b2a46';
    hungerCtx.beginPath();
    hungerCtx.ellipse(x + 10, 11, 6, 4, -0.5, 0, TAU);
    hungerCtx.fill();
    hungerCtx.fillStyle = on ? '#ffe9c2' : '#2a2033';
    hungerCtx.fillRect(x + 3, 13, 5, 3);
    if (on) {
      hungerCtx.fillStyle = '#ffb35c';
      hungerCtx.beginPath();
      hungerCtx.ellipse(x + 8, 10, 2, 1.5, -0.5, 0, TAU);
      hungerCtx.fill();
    }
  }
}

let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

let hintTimer = 0;
function hideHint() {
  hintEl.classList.add('fade');
}

function setPaused(v) {
  paused = v;
  pauseEl.classList.toggle('hidden', !v);
  if (v) {
    saveGame();
    mouse.left = mouse.right = false;
  }
}

function setCraft(v) {
  craftOpen = v;
  craftEl.classList.toggle('hidden', !v);
  mouse.left = mouse.right = false;
  if (v) {
    invOpen = false;
    invPanel.classList.add('hidden');
    furnaceOpen = false;
    furnacePanel.classList.add('hidden');
    chestOpen = false;
    chestPanel.classList.add('hidden');
    refreshCraft();
  }
}

function setInventory(v) {
  invOpen = v;
  invPanel.classList.toggle('hidden', !v);
  mouse.left = mouse.right = false;
  if (v) {
    craftOpen = false;
    craftEl.classList.add('hidden');
    furnaceOpen = false;
    furnacePanel.classList.add('hidden');
    chestOpen = false;
    chestPanel.classList.add('hidden');
    if (invSlot) invSlot.textContent = selected + 1;
    refreshInventory();
  }
}

function refreshInventory() {
  invGrid.innerHTML = '';
  let entries;
  if (player.mode === 'creative') {
    entries = Object.keys(ITEMS).filter(id => ITEMS[id] && Number(id) !== AIR)
      .map(id => [Number(id), Infinity]);
  } else {
    entries = Array.from(inv.entries()).filter(([id, n]) => id && n > 0);
  }
  const q = invSearch.trim().toLowerCase();
  entries = entries.filter(([id]) =>
    (invTab === 'all' || itemCategory(id) === invTab) &&
    (!q || itemName(id).toLowerCase().includes(q))
  );
  entries.sort((a, b) => a[0] - b[0]);

  if (invTabsEl) {
    for (const b of invTabsEl.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.cat === invTab);
    }
  }

  if (!entries.length) {
    invGrid.innerHTML = '<div class="empty">Ничего не найдено</div>';
    return;
  }
  for (const [id, n] of entries) {
    const b = document.createElement('button');
    b.className = 'inv-item';
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    cv.getContext('2d').drawImage(itemIcon(id), 0, 0);
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = itemName(id);
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = n === Infinity ? '∞' : n;
    b.append(cv, nm, cnt);
    b.title = `В слот ${selected + 1}`;
    b.addEventListener('click', () => {
      hotbar[selected] = id;
      updateHotbar();
      sfx('click');
      toast(`${itemName(id)} → слот ${selected + 1}`);
    });
    invGrid.appendChild(b);
  }
}

document.getElementById('resume').addEventListener('click', () => setPaused(false));
document.getElementById('save').addEventListener('click', () => { saveGame(); toast('Мир сохранён'); });
document.getElementById('newworld').addEventListener('click', () => {
  saveGame();
  openNewWorld('pause');
});



/* ── furnace ─────────────────────────────────────────────── */
const SMELT_RECIPES = [
  { in: IRON, out: IRON_INGOT },
  { in: GOLD, out: GOLD_INGOT },
  { in: SAND, out: GLASS },
  { in: COBBLE, out: STONE },
  { in: RAW_BEEF, out: COOKED_BEEF },
  { in: RAW_PORK, out: COOKED_PORK },
  { in: LOG, out: CHARCOAL }
];

function fuelItem() {
  if (count(COAL_ITEM) > 0) return COAL_ITEM;
  if (count(CHARCOAL) > 0) return CHARCOAL;
  return 0;
}

function openFurnace() {
  furnaceOpen = true;
  craftOpen = false; invOpen = false; chestOpen = false;
  craftEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  chestPanel.classList.add('hidden');
  furnacePanel.classList.remove('hidden');
  refreshFurnace();
  mouse.left = mouse.right = false;
}

function closeFurnace() {
  furnaceOpen = false;
  furnacePanel.classList.add('hidden');
}

function refreshFurnace() {
  smeltListEl.innerHTML = '';
  const fuel = fuelItem();
  for (const rec of SMELT_RECIPES) {
    const row = document.createElement('div');
    row.className = 'recipe smelt-row';
    const can = player.mode === 'creative' || (count(rec.in) > 0 && fuel > 0);

    const ic = document.createElement('canvas');
    ic.width = 16; ic.height = 16;
    ic.getContext('2d').drawImage(itemIcon(rec.in), 0, 0);
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '➜';
    const oc = document.createElement('canvas');
    oc.width = 16; oc.height = 16;
    oc.getContext('2d').drawImage(itemIcon(rec.out), 0, 0);

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `<div class="name">${itemName(rec.in)} ➜ ${itemName(rec.out)}</div>` +
      `<div class="ing">1 × ${itemName(rec.in)} + 1 × топливо</div>`;

    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = 'Плавить';
    btn.disabled = !can;
    btn.addEventListener('click', () => {
      const f = fuelItem();
      if (player.mode !== 'creative') {
        if (count(rec.in) <= 0 || !f) return;
        takeItem(rec.in, 1);
        takeItem(f, 1);
      }
      addItem(rec.out, 1);
      sfx('craft');
      toast(`Получено: ${itemName(rec.out)}`);
      refreshFurnace();
      updateHotbar();
    });

    row.append(ic, arrow, oc, info, btn);
    smeltListEl.appendChild(row);
  }
}

/* ── chest ───────────────────────────────────────────────── */
function openChest(tx, ty) {
  chestKey = tx + ',' + ty;
  if (!chests.has(chestKey)) chests.set(chestKey, new Array(9).fill(null));
  chestOpen = true;
  craftOpen = false; invOpen = false; furnaceOpen = false;
  craftEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  furnacePanel.classList.add('hidden');
  chestPanel.classList.remove('hidden');
  renderChest();
  mouse.left = mouse.right = false;
}

function closeChest() {
  chestOpen = false;
  chestPanel.classList.add('hidden');
}

function refreshChestInv() {
  chestInvEl.innerHTML = '';
  const entries = Array.from(inv.entries()).filter(([id, n]) => id && n > 0).sort((a, b) => a[0] - b[0]);
  for (const [id, n] of entries) {
    const b = document.createElement('button');
    b.className = 'craft-item';
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    cv.getContext('2d').drawImage(itemIcon(id), 0, 0);
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = itemName(id);
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = n;
    b.append(cv, nm, cnt);
    b.addEventListener('click', () => {
      if (count(id) <= 0) return;
      const arr = chests.get(chestKey);
      const empty = arr.indexOf(null);
      if (empty < 0) { toast('Сундук полон'); return; }
      takeItem(id, 1);
      arr[empty] = id;
      renderChest();
    });
    chestInvEl.appendChild(b);
  }
}

function renderChest() {
  const arr = chests.get(chestKey) || new Array(9).fill(null);
  chestGridEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'craft-cell';
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    if (arr[i]) cv.getContext('2d').drawImage(itemIcon(arr[i]), 0, 0);
    cell.appendChild(cv);
    cell.addEventListener('click', () => {
      const id = arr[i];
      if (!id) return;
      addItem(id, 1);
      arr[i] = null;
      renderChest();
      sfx('click');
    });
    chestGridEl.appendChild(cell);
  }
  refreshChestInv();
}

/* ── title / menus ───────────────────────────────────────── */
const SPLASHES = [
  '100% без Mojang!', 'Слизни одобряют!', 'Сделано в AVIRBETA',
  'Копай глубже!', 'Не Minecraft, а Avirbeta!', 'Осторожно, зомби!',
  '2D лучше 3D!', 'Блоки решают!', 'Найди алмазы!'
];
let settingsReturn = 'title';
let launching = false;
let newWorldReturn = 'title';

function showTitle() {
  started = false;
  paused = false;
  craftOpen = false;
  invOpen = false;
  pauseEl.classList.add('hidden');
  craftEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  furnacePanel.classList.add('hidden');
  chestPanel.classList.add('hidden');
  furnaceOpen = false;
  chestOpen = false;
  newWorldPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  aboutPanel.classList.add('hidden');
  titleEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  btnPlay.textContent = localStorage.getItem(SAVE_KEY) ? 'Продолжить' : 'Играть';
  splashEl.textContent = SPLASHES[(Math.random() * SPLASHES.length) | 0];
  mouse.left = mouse.right = false;
}

function ensurePlayerSafe() {
  if (!Number.isFinite(player.x) || !Number.isFinite(player.y) ||
      player.x < 0 || player.x > W - player.w || player.y < 0 || player.y > H - 0.2) {
    player.x = clamp(spawnX, 0, W - player.w);
    player.y = spawnY;
  }
  if (collides(player.x, player.y, player.w, player.h)) {
    const tx = clamp(Math.floor(player.x), 0, W - 1);
    let placed = false;
    for (let y = Math.max(0, surfaceArr[tx] - 2); y < H - 2; y++) {
      if (!collides(player.x, y, player.w, player.h)) {
        player.y = y;
        placed = true;
        break;
      }
    }
    if (!placed) {
      player.x = clamp(spawnX, 0, W - player.w);
      player.y = spawnY;
    }
  }
  player.vx = 0;
  player.vy = 0;
}

function showGameUI(keepLoading = false) {
  if (!keepLoading) loadingEl.classList.add('hidden');
  titleEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  newWorldPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  aboutPanel.classList.add('hidden');
  pauseEl.classList.add('hidden');
  craftEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  furnacePanel.classList.add('hidden');
  chestPanel.classList.add('hidden');
  craftOpen = false;
  invOpen = false;
  furnaceOpen = false;
  chestOpen = false;
  paused = false;
  started = true;
  ensurePlayerSafe();
  hintEl.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(hideHint, 12000);
  camX = clamp(player.x * TILE - vw / 2, 0, Math.max(0, W * TILE - vw));
  camY = clamp(player.y * TILE - vh / 2, 0, Math.max(0, H * TILE - vh));
  updateHearts();
  updateHunger();
  updateHotbar();
  updatePauseMode();
  mouse.left = mouse.right = false;
  toast(player.mode === 'creative' ? 'Творческий режим' : 'Выживание');

  // первый кадр рисуем сразу, не дожидаясь requestAnimationFrame
  try {
    render();
    updateClock();
  } catch (err) {
    console.error(err);
  }
}

function startGame(fresh = false) {
  ensureAudio();
  if (!fresh) loadGame();
  showGameUI();
}

const LOADING_TIPS = [
  'факелы освещают пещеры и отпугивают тьму.',
  'алмазы ищут глубже 50 блоков.',
  'печь превращает руду в слитки, а песок — в стекло.',
  'двойной пробел в творческом режиме включает полёт.',
  'слизни прыгают на игрока по ночам.',
  'железная кирка добывает руду быстрее каменной.',
  'сундук сохраняет вещи между сессиями.',
  'в творческом инвентаре есть яйца призыва мобов.',
  'из яблок и мяса можно восстановить голод.',
  'инструменты ломаются — следи за полоской прочности.'
];

function setLoading(p, step) {
  loadingFill.style.width = clamp(p, 0, 100) + '%';
  loadingPercent.textContent = Math.round(p) + '%';
  loadingStep.textContent = step;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function hideLoading() {
  loadingEl.classList.add('hidden');
  loadingEl.classList.remove('run');
  loadingFill.classList.remove('run');
}

function launchGame(fresh, seedVal, mode, diff) {
  if (launching) return;
  launching = true;
  ensureAudio();

  titleEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  newWorldPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  aboutPanel.classList.add('hidden');
  pauseEl.classList.add('hidden');
  craftEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  furnacePanel.classList.add('hidden');
  chestPanel.classList.add('hidden');

  loadingEl.classList.remove('hidden');
  loadingEl.classList.remove('run');
  loadingBg.style.backgroundImage = `url(${TEX[DIRT].toDataURL()})`;
  const hasSave = !!localStorage.getItem(SAVE_KEY);
  loadingSub.textContent = (fresh || !hasSave)
    ? (mode === 'creative' ? 'Создание творческого мира…' : 'Создание нового мира…')
    : 'Загрузка мира…';
  loadingTip.textContent = 'Совет: ' + LOADING_TIPS[(Math.random() * LOADING_TIPS.length) | 0];
  loadingPercent.textContent = '0%';
  loadingStep.textContent = 'Генерация мира…';

  // перезапуск CSS-анимации
  void loadingEl.offsetWidth;
  loadingFill.classList.remove('run');
  void loadingFill.offsetWidth;
  loadingFill.classList.add('run');
  loadingEl.classList.add('run');

  // грузим мир синхронно: игра стартует всегда, даже если таймеры/анимации
  // в фоне заторможены. Экран загрузки — только косметика.
  try {
    if (fresh) newWorld(seedVal, mode, diff);
    else loadGame();
    loadingPercent.textContent = '100%';
    loadingStep.textContent = 'Готово';
    showGameUI(true);
    setTimeout(hideLoading, 1800);
  } catch (err) {
    console.error(err);
    try {
      newWorld();
      showGameUI(true);
      toast('Сохранение повреждено — создан новый мир');
    } catch (e) {
      hideLoading();
      showTitle();
    }
  } finally {
    launching = false;
  }
}


function openNewWorld(from = 'title') {
  newWorldReturn = from;
  titleEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  aboutPanel.classList.add('hidden');
  newWorldPanel.classList.remove('hidden');
}

function openSettings(from) {
  settingsReturn = from;
  titleEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  newWorldPanel.classList.add('hidden');
  aboutPanel.classList.add('hidden');
  settingsPanel.classList.remove('hidden');
  volInput.value = Math.round(settings.volume * 100);
}

function openAbout() {
  titleEl.classList.add('hidden');
  aboutPanel.classList.remove('hidden');
}

function parseSeed(raw) {
  raw = (raw || '').trim();
  if (!raw) return (Math.random() * 0x7fffffff) | 0;
  if (/^\d+$/.test(raw)) return (parseInt(raw, 10) >>> 0);
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
  return h >>> 0;
}

function createWorldFromPanel() {
  newWorldPanel.classList.add('hidden');
  launchGame(true, parseSeed(seedInput.value), modeSelect.value, diffSelect.value);
}

function saveSettings() {
  try { localStorage.setItem('avirbeta_settings', JSON.stringify(settings)); } catch (e) {}
}

btnPlay.addEventListener('click', () => launchGame(false));
loadingEl.addEventListener('click', hideLoading);
document.getElementById('loading-skip').addEventListener('click', e => { e.stopPropagation(); hideLoading(); });
window.addEventListener('keydown', e => {
  if (!loadingEl.classList.contains('hidden')) {
    hideLoading();
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);
document.getElementById('btn-new').addEventListener('click', () => openNewWorld('title'));
document.getElementById('btn-settings').addEventListener('click', () => openSettings('title'));
document.getElementById('btn-about').addEventListener('click', openAbout);
document.getElementById('newworld-back').addEventListener('click', () => {
  newWorldPanel.classList.add('hidden');
  if (newWorldReturn === 'pause' && started) {
    pauseEl.classList.remove('hidden');
    paused = true;
  } else {
    showTitle();
  }
});
document.getElementById('about-back').addEventListener('click', showTitle);
document.getElementById('create-world').addEventListener('click', createWorldFromPanel);
document.getElementById('settings-back').addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  if (settingsReturn === 'pause' && started) {
    pauseEl.classList.remove('hidden');
    paused = true;
  } else {
    showTitle();
  }
});
document.getElementById('to-menu').addEventListener('click', () => {
  saveGame();
  showTitle();
});
document.getElementById('pause-settings').addEventListener('click', () => {
  paused = true;
  openSettings('pause');
});
volInput.addEventListener('input', () => {
  settings.volume = clamp(Number(volInput.value) / 100, 0, 1);
  saveSettings();
});
document.getElementById('fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
document.getElementById('reset-save').addEventListener('click', () => {
  if (!confirm('Удалить сохранение мира?')) return;
  localStorage.removeItem(SAVE_KEY);
  btnPlay.textContent = 'Играть';
  toast('Сохранение удалено');
});

invTabsEl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  invTab = b.dataset.cat;
  refreshInventory();
});
invSearchEl.addEventListener('input', () => {
  invSearch = invSearchEl.value;
  refreshInventory();
});

document.getElementById('toggle-mode').addEventListener('click', () => {
  player.mode = player.mode === 'creative' ? 'survival' : 'creative';
  player.flying = false;
  player.invuln = 0;
  if (player.mode === 'creative') {
    player.hp = 20;
    player.hunger = 20;
  }
  updateHearts();
  updateHunger();
  updateHotbar();
  updatePauseMode();
  if (invOpen) refreshInventory();
  saveGame();
  toast(player.mode === 'creative' ? 'Творческий режим включён' : 'Выживание включено');
});

/* ── sound ───────────────────────────────────────────────── */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (audioCtx && !audioCtx._n) {
    audioCtx._n = 1;
  }
}
function tone(freq, dur, type = 'square', vol = 0.035, slide = 0) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, freq + slide), t + dur);
  vol *= settings.volume;
  g.gain.setValueAtTime(Math.max(0.0001, vol), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noiseBurst(dur = 0.09, vol = 0.05, freq = 1200) {
  if (!audioCtx) return;
  if (!noiseBuf) {
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const f = audioCtx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = freq;
  const g = audioCtx.createGain();
  vol *= settings.volume;
  g.gain.setValueAtTime(Math.max(0.0001, vol), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(audioCtx.destination);
  src.start(t); src.stop(t + dur);
}
function sfx(kind) {
  if (!audioCtx) return;
  switch (kind) {
    case 'break': noiseBurst(0.1, 0.055, 900); tone(180, 0.08, 'square', 0.02, -60); break;
    case 'place': tone(150, 0.07, 'square', 0.03, 40); break;
    case 'jump': tone(360, 0.1, 'sine', 0.028, 240); break;
    case 'hurt': tone(220, 0.22, 'sawtooth', 0.045, -140); break;
    case 'hit': noiseBurst(0.06, 0.05, 1600); tone(260, 0.06, 'square', 0.025, -80); break;
    case 'kill': tone(420, 0.18, 'square', 0.04, -300); break;
    case 'craft': tone(520, 0.08, 'triangle', 0.035); setTimeout(() => tone(780, 0.1, 'triangle', 0.035), 70); break;
    case 'die': tone(300, 0.6, 'sawtooth', 0.05, -240); break;
    case 'click': tone(620, 0.04, 'square', 0.02); break;
  }
}

/* ── particles ───────────────────────────────────────────── */
function burst(x, y, color, n = 10, spread = 6) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * spread,
      vy: -Math.random() * spread - 1,
      life: 0.4 + Math.random() * 0.4,
      max: 0.8,
      size: 2 + Math.random() * 3,
      color
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 42 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/* ── physics ─────────────────────────────────────────────── */
function collides(x, y, w, h) {
  const x0 = Math.floor(x), x1 = Math.floor(x + w - 0.0001);
  const y0 = Math.floor(y), y1 = Math.floor(y + h - 0.0001);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(tx, ty)) return true;
    }
  }
  return false;
}

function moveEntity(e, dt) {
  let landV = 0;
  e.x += e.vx * dt;
  if (collides(e.x, e.y, e.w, e.h)) {
    if (e.vx > 0) e.x = Math.floor(e.x + e.w) - e.w - 0.001;
    else if (e.vx < 0) e.x = Math.floor(e.x) + 1.001;
    e.vx = 0;
  }
  e.y += e.vy * dt;
  e.onGround = false;
  if (collides(e.x, e.y, e.w, e.h)) {
    if (e.vy > 0) {
      landV = e.vy;
      e.y = Math.floor(e.y + e.h) - e.h - 0.001;
      e.onGround = true;
    } else if (e.vy < 0) {
      e.y = Math.floor(e.y) + 1.001;
    }
    e.vy = 0;
  }
  return landV;
}

/* ── world mutation ──────────────────────────────────────── */
function breakBlock(tx, ty) {
  if (!inWorld(tx, ty)) return;
  const id = world[idx(tx, ty)];
  if (!id || BLOCKS[id].hard === Infinity) return;
  const b = BLOCKS[id];
  world[idx(tx, ty)] = AIR;
  if (id === CHEST) {
    const key = tx + ',' + ty;
    const arr = chests.get(key);
    if (arr) {
      for (const it of arr) if (it) addItem(it, 1);
      chests.delete(key);
    }
  }

  const drops = b.drops || (b.drop ? [{ id: b.drop, n: 1, chance: 1 }] : []);
  for (const d of drops) {
    if (Math.random() <= (d.chance ?? 1)) addItem(d.id, d.n ?? 1);
  }

  burst(tx + 0.5, ty + 0.5, b.color, 12, 7);
  sfx('break');
  lightDirty = true;
}

function useDurability(id, n = 1) {
  const it = ITEMS[id];
  if (!it || !it.tool || player.mode === 'creative') return;
  const max = it.tool.maxDur;
  let d = toolDur.has(id) ? toolDur.get(id) : max;
  d -= n;
  if (d <= 0) {
    if (count(id) > 0) takeItem(id, 1);
    if (count(id) > 0) toolDur.set(id, max);
    else toolDur.delete(id);
    toast(`${it.name} сломался`);
    sfx('break');
  } else {
    toolDur.set(id, d);
  }
  updateHotbar();
}

function placeAt(tx, ty) {
  if (!inWorld(tx, ty)) return;
  const id = hotbar[selected];
  const it = ITEMS[id];
  if (!it || !it.block) return;
  if (player.mode !== 'creative' && count(id) <= 0) return;
  const cur = world[idx(tx, ty)];
  if (cur !== AIR && cur !== WATER && cur !== TORCH && cur !== FLOWER && cur !== TALLGRASS) return;
  if (tx < player.x + player.w && tx + 1 > player.x &&
      ty < player.y + player.h && ty + 1 > player.y) return;

  world[idx(tx, ty)] = it.block;
  if (player.mode !== 'creative') takeItem(id, 1);
  burst(tx + 0.5, ty + 0.5, BLOCKS[it.block].color, 6, 4);
  sfx('place');
  lightDirty = true;
}

function eatFood(id) {
  const it = ITEMS[id];
  if (!it || !it.food || player.hunger >= 20) return;
  if (player.mode !== 'creative') takeItem(id, 1);
  player.hunger = Math.min(20, player.hunger + it.food);
  player.foodAcc = 0;
  burst(player.x + player.w / 2, player.y + 0.6, '#ff9d6e', 8, 4);
  sfx('eat');
  updateHunger();
}

/* ── mining / interaction ────────────────────────────────── */
function slimeAtWorld(wx, wy) {
  for (const s of slimes) {
    if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h) return s;
  }
  return null;
}

function hitSlime(s, dmg = 1) {
  if (!s || s.hp <= 0) return;
  s.hp -= dmg;
  s.flash = 0.14;
  s.vx += (Math.sign(s.x - player.x) || 1) * 4.5;
  s.vy = -4.5;
  burst(s.x + s.w / 2, s.y + s.h / 2, '#6fe07d', 8, 5);
  sfx('hit');
  const it = ITEMS[hotbar[selected]];
  if (it && it.tool && it.tool.kind === 'sword') useDurability(it.id, 1);
  if (s.hp <= 0) {
    const i = slimes.indexOf(s);
    if (i >= 0) slimes.splice(i, 1);
    burst(s.x + s.w / 2, s.y + s.h / 2, '#3f9c4a', 20, 8);
    sfx('kill');
  }
}

function mineAt(tx, ty, dt) {
  if (!inWorld(tx, ty)) { mining.progress = 0; mining.x = -1; return; }
  const id = world[idx(tx, ty)];
  if (!id || BLOCKS[id].hard === Infinity || BLOCKS[id].hard <= 0) {
    mining.progress = 0; mining.x = -1; return;
  }

  const it = ITEMS[hotbar[selected]];
  const block = BLOCKS[id];

  if (player.mode === 'creative') {
    breakBlock(tx, ty);
    mining.progress = 0; mining.x = -1;
    return;
  }

  let speed = 1;
  if (it && it.tool) {
    if (it.tool.kind === block.tool) speed = it.tool.speed;
    else if (it.tool.kind === 'sword' && block.tool === 'none') speed = 1.5;
  }

  if (mining.x !== tx || mining.y !== ty) {
    mining.x = tx; mining.y = ty; mining.progress = 0;
  }
  mining.progress += dt * speed / block.hard;
  if (mining.progress >= 1) {
    breakBlock(tx, ty);
    if (it && it.tool && it.tool.kind !== 'sword') useDurability(it.id, 1);
    mining.progress = 0; mining.x = -1;
  }
}

function spawnEggMob(kind) {
  const dir = player.face || 1;
  for (const side of [dir, -dir]) {
    const x = player.x + side * 1.5;
    if (kind === 'slime') {
      const y = player.y + player.h - 0.9;
      if (!collides(x, y, 0.9, 0.9)) {
        slimes.push({
          x, y, w: 0.9, h: 0.9,
          vx: 0, vy: 0, hp: 3, onGround: false, hop: 0.8, flash: 0
        });
        burst(x + 0.45, y + 0.45, '#6fe07d', 10, 5);
        sfx('craft');
        return true;
      }
    } else {
      const spec = kind === 'cow'
        ? { w: 1.15, h: 1.0, hp: 10, color: '#e8dccb' }
        : kind === 'pig'
          ? { w: 0.9, h: 0.8, hp: 8, color: '#ff9aa8' }
          : { w: 0.7, h: 1.8, hp: 16, color: '#6fbf5f' };
      const y = player.y + player.h - spec.h;
      if (!collides(x, y, spec.w, spec.h)) {
        mobs.push({
          kind, x, y, w: spec.w, h: spec.h,
          vx: 0, vy: 0, onGround: false, flash: 0,
          hp: spec.hp, maxHp: spec.hp,
          dir: Math.random() < 0.5 ? -1 : 1, wander: 1 + Math.random() * 2
        });
        burst(x + spec.w / 2, y + spec.h / 2, spec.color, 10, 5);
        sfx('craft');
        return true;
      }
    }
  }
  toast('Нет места для моба');
  return false;
}

function updateInteract(dt) {
  attackCd -= dt;
  placeCd -= dt;

  const wx = (mouse.x + camX) / TILE;
  const wy = (mouse.y + camY) / TILE;
  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  const dist = Math.hypot(wx - pcx, wy - pcy);
  const inReach = dist <= REACH && !player.dead;
  const tx = Math.floor(wx), ty = Math.floor(wy);

  if (mouse.left && inReach) {
    const it = ITEMS[hotbar[selected]];
    const dmg = it && it.tool && it.tool.kind === 'sword' ? it.tool.dmg : 1;
    const mob = mobAtWorld(wx, wy);
    const s = mob ? null : slimeAtWorld(wx, wy);
    if (mob) {
      mining.progress = 0; mining.x = -1;
      if (attackCd <= 0) { hitMob(mob, dmg); attackCd = 0.32; }
    } else if (s) {
      mining.progress = 0; mining.x = -1;
      if (attackCd <= 0) { hitSlime(s, dmg); attackCd = 0.32; }
    } else {
      mineAt(tx, ty, dt);
    }
  } else {
    mining.progress = 0; mining.x = -1;
  }

  if (mouse.right && inReach && placeCd <= 0) {
    const it = ITEMS[hotbar[selected]];
    const targetId = inWorld(tx, ty) ? world[idx(tx, ty)] : AIR;

    if (it && it.egg) {
      placeCd = 0.5;
      if (spawnEggMob(it.egg) && player.mode !== 'creative') takeItem(it.id, 1);
      return;
    }
    if (targetId === CRAFT_TABLE) {
      placeCd = 0.4;
      setCraft(true);
      return;
    }
    if (targetId === FURNACE) {
      placeCd = 0.4;
      if (typeof openFurnace === 'function') openFurnace(tx, ty);
      return;
    }
    if (targetId === CHEST) {
      placeCd = 0.4;
      if (typeof openChest === 'function') openChest(tx, ty);
      return;
    }
    if (it && it.food && player.hunger < 20) {
      placeCd = 0.55;
      eatFood(it.id);
      return;
    }
    placeCd = 0.16;
    placeAt(tx, ty);
  }
}

/* ── damage / death ──────────────────────────────────────── */
function hurtPlayer(dmg, dir) {
  if (player.mode === 'creative') return;
  if (player.dead || player.invuln > 0) return;
  player.hp = Math.max(0, player.hp - dmg);
  player.invuln = 1.15;
  player.regenTimer = 0;
  player.regenAcc = 0;
  shake = 0.55;
  player.vx += dir * 6;
  player.vy = Math.min(player.vy, -5.5);
  player.onGround = false;
  sfx('hurt');
  updateHearts();
  if (player.hp <= 0) {
    player.dead = true;
    player.deadT = 1.8;
    sfx('die');
  }
}

function respawn() {
  player.x = spawnX;
  player.y = spawnY;
  player.vx = player.vy = 0;
  player.hp = 20;
  player.dead = false;
  player.invuln = 2;
  player.regenTimer = 0;
  player.regenAcc = 0;
  slimes.length = 0;
  mobs.length = 0;
  updateHearts();
  toast('Ты очнулся у места старта');
}

/* ── slimes ──────────────────────────────────────────────── */
function spawnSlime() {
  for (let tries = 0; tries < 14; tries++) {
    const tx = Math.round(player.x + (Math.random() * 2 - 1) * 20);
    if (tx < 3 || tx >= W - 3) continue;
    const ty = surfaceArr[tx] - 1;
    if (!inWorld(tx, ty) || world[idx(tx, ty)] !== AIR) continue;
    const ground = world[idx(tx, ty + 1)];
    if (!BLOCKS[ground].solid) continue;
    slimes.push({
      x: tx + 0.05, y: ty - 0.9, w: 0.9, h: 0.9,
      vx: 0, vy: 0, hp: 3, onGround: false, hop: 0.8, flash: 0
    });
    return;
  }
}

function updateSlimes(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTimer = 3;
    if (daylight() < 0.22 && slimes.length < 6 && worldDifficulty !== 'peaceful') spawnSlime();
  }

  for (let i = slimes.length - 1; i >= 0; i--) {
    const s = slimes[i];
    s.flash = Math.max(0, s.flash - dt);
    s.vy = Math.min(s.vy + GRAV * dt, 34);

    if (s.onGround) {
      s.vx *= Math.max(0, 1 - dt * 8);
      s.hop -= dt;
      if (s.hop <= 0) {
        s.hop = 0.9 + Math.random() * 0.9;
        const dir = Math.sign(player.x - s.x) || 1;
        s.vx = dir * (2 + Math.random() * 1.6);
        s.vy = -(8 + Math.random() * 2);
        s.onGround = false;
      }
    }

    moveEntity(s, dt);
    s.x = clamp(s.x, 0, W - s.w);

    if (!player.dead && player.invuln <= 0 &&
        s.x < player.x + player.w && s.x + s.w > player.x &&
        s.y < player.y + player.h && s.y + s.h > player.y) {
      if (worldDifficulty !== 'peaceful') hurtPlayer(worldDifficulty === 'hard' ? 3 : 2, Math.sign(player.x - s.x) || 1);
    }

    const dx = s.x - player.x, dy = s.y - player.y;
    if (dx * dx + dy * dy > 60 * 60) slimes.splice(i, 1);
  }
}


/* ── mobs: животные и зомби ─────────────────────────────── */
function mobAtWorld(wx, wy) {
  for (const m of mobs) {
    if (wx >= m.x && wx <= m.x + m.w && wy >= m.y && wy <= m.y + m.h) return m;
  }
  return null;
}

function overlapPlayer(m) {
  return m.x < player.x + player.w && m.x + m.w > player.x &&
         m.y < player.y + player.h && m.y + m.h > player.y;
}

function hitMob(m, dmg) {
  if (!m || m.hp <= 0) return;
  m.hp -= dmg;
  m.flash = 0.15;
  m.vx += (Math.sign(m.x - player.x) || 1) * 4.5;
  m.vy = -4.5;
  const col = m.kind === 'cow' ? '#e8dccb' : (m.kind === 'pig' ? '#ff9aa8' : '#6fbf5f');
  burst(m.x + m.w / 2, m.y + m.h / 2, col, 8, 5);
  sfx('hit');

  const it = ITEMS[hotbar[selected]];
  if (it && it.tool && it.tool.kind === 'sword') useDurability(it.id, 1);

  if (m.hp <= 0) {
    const i = mobs.indexOf(m);
    if (i >= 0) mobs.splice(i, 1);
    const rolls = [];
    if (m.kind === 'cow') {
      rolls.push([RAW_BEEF, 1 + ((Math.random() * 2) | 0)]);
      rolls.push([LEATHER, 1]);
    } else if (m.kind === 'pig') {
      rolls.push([RAW_PORK, 1 + ((Math.random() * 2) | 0)]);
    } else {
      rolls.push([ROTTEN_FLESH, 1]);
    }
    for (const [id, n] of rolls) addItem(id, n);
    burst(m.x + m.w / 2, m.y + m.h / 2, col, 18, 8);
    sfx('kill');
  }
}

function findMobSpot(range, grassOnly) {
  for (let t = 0; t < 18; t++) {
    const tx = Math.round(player.x + (Math.random() * 2 - 1) * range);
    if (tx < 4 || tx >= W - 4) continue;
    const sy = surfaceArr[tx];
    const top = world[idx(tx, sy)];
    if (grassOnly && top !== GRASS && top !== SNOW) continue;
    if (!BLOCKS[top].solid) continue;
    if (world[idx(tx, sy - 1)] !== AIR) continue;
    return { tx, sy };
  }
  return null;
}

function spawnAnimal() {
  if (mobs.filter(m => m.kind !== 'zombie').length >= 5) return;
  const p = findMobSpot(20, true);
  if (!p) return;
  const cow = Math.random() < 0.5;
  const h = cow ? 1.0 : 0.8;
  mobs.push({
    kind: cow ? 'cow' : 'pig',
    x: p.tx + 0.05, y: p.sy - h,
    w: cow ? 1.15 : 0.9, h,
    vx: 0, vy: 0, onGround: false, flash: 0,
    hp: cow ? 10 : 8, maxHp: cow ? 10 : 8,
    dir: Math.random() < 0.5 ? -1 : 1, wander: 1 + Math.random() * 2
  });
}

function spawnZombie() {
  if (mobs.filter(m => m.kind === 'zombie').length >= 4) return;
  const p = findMobSpot(22, false);
  if (!p) return;
  mobs.push({
    kind: 'zombie',
    x: p.tx + 0.15, y: p.sy - 1.8,
    w: 0.7, h: 1.8,
    vx: 0, vy: 0, onGround: false, flash: 0,
    hp: 16, maxHp: 16, dir: 1, wander: 0
  });
}

function updateMobs(dt) {
  animalTimer -= dt;
  if (animalTimer <= 0) {
    animalTimer = 7;
    if (daylight() > 0.3) spawnAnimal();
  }
  zombieTimer -= dt;
  if (zombieTimer <= 0) {
    zombieTimer = 6;
    if (daylight() < 0.24 && worldDifficulty !== 'peaceful') spawnZombie();
  }

  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    m.flash = Math.max(0, m.flash - dt);
    m.vy = Math.min(m.vy + GRAV * dt, 36);

    if (m.kind === 'zombie') {
      const dx = player.x - m.x;
      const near = !player.dead && Math.abs(dx) < 18 && Math.abs(player.y - m.y) < 9;
      if (near) {
        m.dir = Math.sign(dx) || 1;
        m.vx = m.dir * 2.2;
        if (m.onGround) {
          const ax = m.x + (m.dir > 0 ? m.w + 0.25 : -0.25);
          if (isSolid(Math.floor(ax), Math.floor(m.y + m.h - 0.2)) ||
              isSolid(Math.floor(ax), Math.floor(m.y + 0.5))) m.vy = -9.5;
        }
      } else {
        m.vx *= Math.max(0, 1 - dt * 8);
      }
      if (!player.dead && player.invuln <= 0 && overlapPlayer(m)) {
        if (worldDifficulty !== 'peaceful') hurtPlayer(worldDifficulty === 'hard' ? 3 : 2, m.dir);
      }
      if (daylight() > 0.45 && Math.random() < dt * 0.6) {
        burst(m.x + m.w / 2, m.y + 0.4, '#8a8a3a', 6, 4);
        mobs.splice(i, 1);
        continue;
      }
    } else {
      m.wander -= dt;
      if (m.wander <= 0) {
        m.wander = 2 + Math.random() * 3;
        m.dir = Math.random() < 0.5 ? -1 : 1;
      }
      m.vx = m.dir * 1.5;
      if (m.onGround) {
        const ax = m.x + (m.dir > 0 ? m.w + 0.25 : -0.25);
        if (isSolid(Math.floor(ax), Math.floor(m.y + m.h - 0.2))) m.vy = -7.5;
      }
    }

    moveEntity(m, dt);
    m.x = clamp(m.x, 0, W - m.w);

    const dx = m.x - player.x, dy = m.y - player.y;
    if (dx * dx + dy * dy > 60 * 60) mobs.splice(i, 1);
  }
}

/* ── time of day ─────────────────────────────────────────── */
function daylight() {
  return 0.08 + Math.max(0, Math.sin(dayTime * TAU)) * 0.92;
}

const SKY_STOPS = [
  [0.00, '#ff9a62', '#ffd9a8'],
  [0.07, '#84b8ff', '#dff0ff'],
  [0.20, '#4aa3ff', '#cfeeff'],
  [0.33, '#3d8bff', '#b9e6ff'],
  [0.44, '#6aa6ff', '#e2f0ff'],
  [0.50, '#ff8654', '#ffc48f'],
  [0.56, '#a54a7a', '#4b2b52'],
  [0.64, '#191a3a', '#0e1026'],
  [0.76, '#080a18', '#0c1030'],
  [0.88, '#10122c', '#1a1d45'],
  [0.96, '#6b3a66', '#2a1a3a'],
  [1.00, '#ff9a62', '#ffd9a8']
];

function skyColors(t) {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const a = SKY_STOPS[i], b = SKY_STOPS[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      return [mixColor(a[1], b[1], k), mixColor(a[2], b[2], k)];
    }
  }
  return [SKY_STOPS[0][1], SKY_STOPS[0][2]];
}

/* ── save / load ─────────────────────────────────────────── */
function rleEncode(arr) {
  const out = new Uint8Array(arr.length * 2);
  let p = 0;
  let prev = arr[0], n = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === prev && n < 255) n++;
    else { out[p++] = prev; out[p++] = n; prev = arr[i]; n = 1; }
  }
  out[p++] = prev; out[p++] = n;
  return out.subarray(0, p);
}

function toBase64(bytes) {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function saveGame() {
  try {
    const data = {
      v: 2,
      seed,
      world: toBase64(rleEncode(world)),
      surface: Array.from(surfaceArr),
      biome: Array.from(biomeArr),
      px: player.x, py: player.y,
      hp: player.hp,
      hunger: player.hunger,
      mode: player.mode,
      difficulty: worldDifficulty,
      toolDur: Array.from(toolDur.entries()),
      chests: Array.from(chests.entries()),
      inv: Array.from(inv.entries()),
      hotbar,
      dayTime, dayCount
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('save failed', e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 2 && d.world) {
        const bytes = fromBase64(d.world);
        const w = new Uint8Array(W * H);
        let q = 0, i = 0;
        while (i < bytes.length && q < w.length) {
          const id = bytes[i++], n = bytes[i++];
          for (let k = 0; k < n && q < w.length; k++) w[q++] = id;
        }
        let worldOk = q === w.length;
        if (worldOk) {
          for (let k = 0; k < w.length; k++) {
            if (!BLOCKS[w[k]]) { worldOk = false; break; }
          }
        }
        if (worldOk && !worldLooksValid(w)) worldOk = false;
        if (worldOk) {
          world = w;
          surfaceArr = new Int16Array(W);
          if (Array.isArray(d.surface) && d.surface.length === W) {
            for (let x = 0; x < W; x++) surfaceArr[x] = d.surface[x];
          } else {
            for (let x = 0; x < W; x++) {
              let y = 0;
              while (y < H && world[idx(x, y)] === AIR) y++;
              surfaceArr[x] = y;
            }
          }
          biomeArr = new Uint8Array(W);
          if (Array.isArray(d.biome) && d.biome.length === W) {
            for (let x = 0; x < W; x++) biomeArr[x] = d.biome[x];
          }
          seed = d.seed || 1;
          player.x = d.px;
          player.y = d.py;
          player.hp = clamp(d.hp ?? 20, 0, 20);
          player.hunger = clamp(d.hunger ?? 20, 0, 20);
          player.mode = d.mode === 'creative' ? 'creative' : 'survival';
          worldDifficulty = d.difficulty || 'normal';
          player.dead = false;
          player.flying = false;
          player.vx = player.vy = 0;
          toolDur.clear();
          if (Array.isArray(d.toolDur)) d.toolDur.forEach(([id, dur]) => { if (ITEMS[id] && ITEMS[id].tool) toolDur.set(id, dur); });
          chests.clear();
          if (Array.isArray(d.chests)) {
            for (const [k, arr] of d.chests) if (Array.isArray(arr) && arr.length === 9) chests.set(k, arr);
          }
          inv.clear();
          if (Array.isArray(d.inv)) d.inv.forEach(([id, n]) => { if (id && ITEMS[id] && n > 0) inv.set(id, n); });
          if (Array.isArray(d.hotbar) && d.hotbar.length === 9) {
            hotbar = d.hotbar.map(id => (id && ITEMS[id] ? id : null));
          }
          dayTime = typeof d.dayTime === 'number' ? d.dayTime : 0.22;
          dayCount = d.dayCount || 1;
          spawnX = Math.floor(W / 2) + 0.15;
          spawnY = surfaceArr[Math.floor(W / 2)] - 1.8;
          computeLight();
          updatePauseMode();
          lastHpDrawn = -1;
          lastHungerDrawn = -1;
          updateHearts();
          updateHunger();
          updateHotbar();
          toast('Мир загружен');
          return;
        }
      }
    }
  } catch (e) {
    console.warn('load failed', e);
  }
  newWorld();
}

function newWorld(seedValue, mode, difficulty) {
  const useSeed = seedValue === undefined ? ((Math.random() * 0x7fffffff) | 0) : (seedValue >>> 0);
  genWorld(useSeed);
  if (!worldLooksValid(world)) genFlatWorld(useSeed);
  player.mode = mode === 'creative' ? 'creative' : 'survival';
  worldDifficulty = difficulty || 'normal';
  inv.clear();
  inv.set(PLANKS, 32);
  inv.set(TORCH, 16);
  hotbar = [PLANKS, TORCH, null, null, null, null, null, null, null];
  selected = 0;
  player.x = spawnX;
  player.y = spawnY;
  player.vx = player.vy = 0;
  player.hp = 20;
  player.dead = false;
  player.invuln = 0;
  player.regenTimer = 0;
  player.regenAcc = 0;
  player.hunger = 20;
  player.hungerAcc = 0;
  player.starveAcc = 0;
  player.flying = false;
  toolDur.clear();
  dayTime = 0.22;
  dayCount = 1;
  slimes.length = 0;
  mobs.length = 0;
  particles.length = 0;
  mining.progress = 0; mining.x = -1;
  computeLight();
  lastHpDrawn = -1;
  lastHungerDrawn = -1;
  updateHearts();
  updateHunger();
  updateHotbar();
  camX = clamp(player.x * TILE - vw / 2, 0, Math.max(0, W * TILE - vw));
  camY = clamp(player.y * TILE - vh / 2, 0, Math.max(0, H * TILE - vh));
  updatePauseMode();
  saveGame();
}

/* ── input ───────────────────────────────────────────────── */
function onFirstInput() {
  ensureAudio();
  hideHint();
}

window.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', e => {
  onFirstInput();
  if (e.button === 1) {
    e.preventDefault();
    const tx = Math.floor((mouse.x + camX) / TILE);
    const ty = Math.floor((mouse.y + camY) / TILE);
    const id = inWorld(tx, ty) ? world[idx(tx, ty)] : AIR;
    if (id && count(id) > 0) {
      hotbar[selected] = id;
      updateHotbar();
      sfx('click');
    }
    return;
  }
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.right = true;
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('wheel', e => {
  if (paused || craftOpen) return;
  e.preventDefault();
  const dir = Math.sign(e.deltaY) || 1;
  selectSlot((selected + dir + 9) % 9);
}, { passive: false });

window.addEventListener('keydown', e => {
  onFirstInput();
  const k = e.key.toLowerCase();
  const code = e.code || '';

  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) {
    if (k === 'escape') ae.blur();
    return;
  }

  if (!started) {
    if (k === 'escape' || code === 'Escape') {
      if (!newWorldPanel.classList.contains('hidden') ||
          !settingsPanel.classList.contains('hidden') ||
          !aboutPanel.classList.contains('hidden')) {
        showTitle();
      }
    }
    return;
  }

  if (!newWorldPanel.classList.contains('hidden') ||
      !settingsPanel.classList.contains('hidden') ||
      !aboutPanel.classList.contains('hidden')) {
    if (k === 'escape' || code === 'Escape') {
      if (!newWorldPanel.classList.contains('hidden')) {
        newWorldPanel.classList.add('hidden');
        if (newWorldReturn === 'pause' && started) {
          pauseEl.classList.remove('hidden');
          paused = true;
        } else {
          showTitle();
        }
      } else if (!settingsPanel.classList.contains('hidden')) {
        settingsPanel.classList.add('hidden');
        if (settingsReturn === 'pause' && started) {
          pauseEl.classList.remove('hidden');
          paused = true;
        } else {
          showTitle();
        }
      } else {
        showTitle();
      }
    }
    e.preventDefault();
    return;
  }

  if (!paused && player.mode === 'creative' && (k === ' ' || code === 'Space')) {
    const t = performance.now();
    if (t - player.lastSpaceTap < 320) {
      player.flying = !player.flying;
      player.vy = 0;
      toast(player.flying ? 'Полёт включён' : 'Полёт выключен');
    }
    player.lastSpaceTap = t;
  }

  if (k === 'escape' || code === 'Escape') {
    if (craftOpen) setCraft(false);
    else if (invOpen) setInventory(false);
    else if (furnaceOpen) closeFurnace();
    else if (chestOpen) closeChest();
    else setPaused(!paused);
    e.preventDefault();
    return;
  }
  if (k === 'e' || code === 'KeyE') {
    if (!paused) {
      if (furnaceOpen) closeFurnace();
      else if (chestOpen) closeChest();
      else if (invOpen) setInventory(false);
      else setCraft(!craftOpen);
    }
    e.preventDefault();
    return;
  }
  if (k === 'i' || k === 'tab' || code === 'KeyI' || code === 'Tab') {
    if (!paused) {
      if (furnaceOpen) closeFurnace();
      else if (chestOpen) closeChest();
      else if (craftOpen) setCraft(false);
      else setInventory(!invOpen);
    }
    e.preventDefault();
    return;
  }
  if (/^[1-9]$/.test(k) || /^Digit[1-9]$/.test(code)) {
    selectSlot((/^[1-9]$/.test(k) ? +k : +code.slice(5)) - 1);
    e.preventDefault();
    return;
  }
  keys[k] = true;
  if (code) keys[code] = true;
  if (k === ' ' || code === 'Space' || k.startsWith('arrow')) e.preventDefault();
});

window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
  if (e.code) keys[e.code] = false;
});
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  mouse.left = mouse.right = false;
});
window.addEventListener('beforeunload', saveGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });

/* ── update ──────────────────────────────────────────────── */
function updatePlayer(dt) {
  if (player.mode === 'creative' && player.flying) {
    const jump = keys[' '] || keys['Space'];
    const down = keys['shift'] || keys['ShiftLeft'] || keys['ShiftRight'];
    const left = keys['a'] || keys['arrowleft'] || keys['KeyA'] || keys['ArrowLeft'];
    const right = keys['d'] || keys['arrowright'] || keys['KeyD'] || keys['ArrowRight'];
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) { player.vx += dir * 72 * dt; player.face = dir; }
    player.vx -= player.vx * Math.min(1, 8 * dt);
    player.vx = clamp(player.vx, -9.5, 9.5);
    player.vy = jump ? -7 : (down ? 7 : 0);
    moveEntity(player, dt);
    player.x = clamp(player.x, 0, W - player.w);
    player.walkPhase += Math.abs(player.vx) * dt * 4;
    return;
  }

  const inWater = isWater(player.x + player.w / 2, player.y + player.h * 0.75);
  const left = keys['a'] || keys['arrowleft'] || keys['KeyA'] || keys['ArrowLeft'];
  const right = keys['d'] || keys['arrowright'] || keys['KeyD'] || keys['ArrowRight'];
  const jump = keys[' '] || keys['w'] || keys['arrowup'] || keys['Space'] || keys['KeyW'] || keys['ArrowUp'];
  const dir = (right ? 1 : 0) - (left ? 1 : 0);

  const maxSpd = inWater ? 4.2 : 7.4;
  if (dir !== 0) {
    player.vx += dir * (inWater ? 24 : 62) * dt;
    player.face = dir;
  }
  const fr = inWater ? 4 : (player.onGround ? (dir ? 8 : 14) : 1.4);
  player.vx -= player.vx * Math.min(1, fr * dt);
  player.vx = clamp(player.vx, -maxSpd, maxSpd);

  if (player.onGround) player.coyote = 0.1;
  else player.coyote = Math.max(0, player.coyote - dt);

  if (jump && !player.jumpHeld && !inWater && player.coyote > 0) {
    player.vy = -16.2;
    player.coyote = 0;
    player.jumpHeld = true;
    player.onGround = false;
    sfx('jump');
  }
  if (!jump) player.jumpHeld = false;

  if (inWater) {
    if (jump) player.vy = -5.2;
    player.vy = Math.min(player.vy + 13 * dt, 4.5);
  } else {
    player.vy = Math.min(player.vy + GRAV * dt, 38);
    if (!jump && player.vy < -5) player.vy = -5;
  }

  const landV = moveEntity(player, dt);

  if (landV > 30 && !inWater) {
    hurtPlayer(Math.min(10, Math.floor((landV - 30) / 4) * 2 + 2), 0);
  }

  player.x = clamp(player.x, 0, W - player.w);
  player.walkPhase += Math.abs(player.vx) * dt * 4.4;

  if (isLava(player.x + player.w / 2, player.y + player.h * 0.75)) {
    hurtPlayer(3, 0);
  }

  if (player.y > H + 3) {
    player.hp = 0;
    player.dead = true;
    player.deadT = 1.2;
  }
}

function updateCamera(dt) {
  const tx = clamp((player.x + player.w / 2) * TILE - vw / 2, 0, Math.max(0, W * TILE - vw));
  const ty = clamp((player.y + player.h / 2) * TILE - vh / 2, 0, Math.max(0, H * TILE - vh));
  camX = lerp(camX, tx, Math.min(1, dt * 7));
  camY = lerp(camY, ty, Math.min(1, dt * 7));
}

function update(dt) {
  time += dt;
  shake = Math.max(0, shake - dt * 2.4);

  if (lightDirty) {
    computeLight();
    lightDirty = false;
  }

  if (player.dead) {
    player.deadT -= dt;
    if (player.deadT <= 0) respawn();
  } else {
    updatePlayer(dt);
    updateInteract(dt);
  }

  updateSlimes(dt);
  updateMobs(dt);
  updateParticles(dt);
  updateCamera(dt);

  player.invuln = Math.max(0, player.invuln - dt);
  if (!player.dead) {
    if (player.mode === 'creative') {
      player.hunger = 20;
      updateHunger();
    } else {
      player.hungerAcc += dt;
      if (player.hungerAcc >= 30) {
        player.hungerAcc = 0;
        player.hunger = Math.max(0, player.hunger - 1);
        updateHunger();
      }
      if (player.hunger <= 0) {
        player.starveAcc += dt;
        if (player.starveAcc > 4) {
          player.starveAcc = 0;
          hurtPlayer(1, 0);
        }
      } else {
        player.starveAcc = 0;
      }
      if (player.hunger >= 18) {
        player.regenTimer += dt;
        if (player.regenTimer > 4 && player.hp < 20) {
          player.regenAcc += dt;
          if (player.regenAcc > 4) {
            player.regenAcc = 0;
            player.hp = Math.min(20, player.hp + 1);
            updateHearts();
          }
        }
      } else {
        player.regenTimer = 0;
      }
    }
  }

  dayTime += dt / DAY_LENGTH;
  if (dayTime >= 1) {
    dayTime -= 1;
    dayCount++;
    toast(`День ${dayCount}`);
  }

  saveAcc += dt;
  if (saveAcc > 30) { saveAcc = 0; saveGame(); }
}

/* ── render helpers ──────────────────────────────────────── */
function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const stars = [];
{
  const r = rng(777);
  for (let i = 0; i < 150; i++) stars.push({ x: r(), y: r() * 0.62, s: r() < 0.85 ? 1 : 2, tw: r() * TAU });
}
const clouds = [];
{
  const r = rng(555);
  for (let i = 0; i < 9; i++) clouds.push({ x: r(), y: 0.05 + r() * 0.3, s: 0.6 + r() * 0.9, sp: 0.4 + r() * 0.8 });
}

function drawSky(day) {
  const [top, bottom] = skyColors(dayTime);
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);

  // stars
  const starAlpha = clamp(1 - day * 2.2, 0, 1);
  if (starAlpha > 0.02) {
    for (const st of stars) {
      const a = starAlpha * (0.5 + 0.5 * Math.sin(time * 1.7 + st.tw));
      ctx.fillStyle = `rgba(255,240,220,${a.toFixed(3)})`;
      ctx.fillRect(st.x * vw, st.y * vh, st.s, st.s);
    }
  }

  // sun / moon
  if (dayTime < 0.52) {
    const p = dayTime / 0.52;
    const x = vw * (0.02 + 0.96 * p);
    const y = vh * 0.72 - Math.sin(p * Math.PI) * vh * 0.58;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 90);
    rg.addColorStop(0, 'rgba(255,240,180,0.95)');
    rg.addColorStop(0.35, 'rgba(255,210,120,0.55)');
    rg.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.fillStyle = '#fff4c2';
    ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
  } else {
    const p = (dayTime - 0.52) / 0.48;
    const x = vw * (0.02 + 0.96 * p);
    const y = vh * 0.72 - Math.sin(p * Math.PI) * vh * 0.58;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 80);
    rg.addColorStop(0, 'rgba(220,235,255,0.5)');
    rg.addColorStop(1, 'rgba(180,210,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 80, y - 80, 160, 160);
    ctx.fillStyle = '#eef4ff';
    ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(190,205,235,0.45)';
    ctx.beginPath(); ctx.arc(x - 5, y - 3, 12, 0, TAU); ctx.fill();
  }

  // clouds
  ctx.fillStyle = `rgba(255,255,255,${(0.18 + day * 0.3).toFixed(3)})`;
  for (const c of clouds) {
    const span = vw + 500;
    const x = ((c.x * span - camX * 0.12 * c.sp - time * 5 * c.sp) % span + span) % span - 250;
    const y = c.y * vh * 0.55 + Math.sin(time * 0.15 + c.x * 9) * 4;
    const s = c.s;
    ctx.beginPath();
    ctx.ellipse(x, y, 60 * s, 18 * s, 0, 0, TAU);
    ctx.ellipse(x + 45 * s, y + 3 * s, 40 * s, 14 * s, 0, 0, TAU);
    ctx.ellipse(x - 45 * s, y + 4 * s, 36 * s, 12 * s, 0, 0, TAU);
    ctx.fill();
  }
}

let wallPattern = null;

function drawUnderground(rx, ry) {
  const x0 = Math.max(0, Math.floor(rx / TILE) - 1);
  const x1 = Math.min(W - 1, Math.ceil((rx + vw) / TILE) + 1);
  if (x1 < x0) return;

  let minSy = vh;
  for (let tx = x0; tx <= x1; tx++) {
    const sy = surfaceArr[tx] * TILE - ry;
    if (sy < minSy) minSy = sy;
  }
  if (minSy >= vh) return;

  const g = wctx.createLinearGradient(0, Math.max(0, minSy), 0, vh);
  g.addColorStop(0, '#6b5140');
  g.addColorStop(0.45, '#3c3244');
  g.addColorStop(1, '#242132');

  if (!wallPattern) wallPattern = wctx.createPattern(WALL_TEX, 'repeat');

  for (let tx = x0; tx <= x1; tx++) {
    const sy = Math.max(0, surfaceArr[tx] * TILE - ry);
    if (sy >= vh) continue;
    const sx = tx * TILE - rx;
    wctx.fillStyle = g;
    wctx.fillRect(sx, sy, TILE + 1, vh - sy);
    wctx.globalAlpha = 0.8;
    wctx.fillStyle = wallPattern;
    wctx.fillRect(sx, sy, TILE + 1, vh - sy);
    wctx.globalAlpha = 1;
  }
}

const CRACKS = [
  [[4, 3], [7, 6]], [[7, 6], [4, 10]], [[4, 10], [9, 14]],
  [[10, 4], [7, 6]], [[7, 6], [11, 9]], [[11, 9], [8, 14]],
  [[2, 7], [6, 9]], [[6, 9], [14, 7]], [[9, 2], [10, 5]]
];

function drawWorldTiles(rx, ry) {
  const x0 = Math.max(0, Math.floor(rx / TILE) - 1);
  const x1 = Math.min(W - 1, Math.ceil((rx + vw) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(ry / TILE) - 1);
  const y1 = Math.min(H - 1, Math.ceil((ry + vh) / TILE) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const id = world[idx(tx, ty)];
      if (!id) continue;
      const sx = tx * TILE - rx;
      const sy = ty * TILE - ry;
      if (id === WATER) {
        wctx.globalAlpha = 0.8;
        wctx.drawImage(TEX[WATER], sx, sy, TILE, TILE);
        wctx.globalAlpha = 1;
      } else {
        wctx.drawImage(TEX[id], sx, sy, TILE, TILE);
      }

      if (id === TORCH) {
        const fl = 0.5 + 0.5 * Math.sin(time * 9 + tx * 3 + ty);
        wctx.fillStyle = `rgba(255,200,90,${(0.12 + fl * 0.1).toFixed(3)})`;
        wctx.beginPath();
        wctx.arc(sx + TILE / 2, sy + TILE * 0.4, TILE * 0.75, 0, TAU);
        wctx.fill();
      }

      if (mining.x === tx && mining.y === ty && mining.progress > 0) {
        const n = Math.min(CRACKS.length, Math.ceil(mining.progress * CRACKS.length));
        wctx.strokeStyle = 'rgba(0,0,0,.62)';
        wctx.lineWidth = 2;
        wctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = CRACKS[i][0], b = CRACKS[i][1];
          wctx.moveTo(sx + a[0] * TILE / 16, sy + a[1] * TILE / 16);
          wctx.lineTo(sx + b[0] * TILE / 16, sy + b[1] * TILE / 16);
        }
        wctx.stroke();
      }
    }
  }
}

function drawSlime(s, rx, ry) {
  const size = s.w * TILE;
  const px = s.x * TILE - rx;
  const py = s.y * TILE - ry;
  const squash = clamp(1 - Math.abs(s.vy) * 0.012, 0.82, 1.14);
  const w = size * squash;
  const h = size / squash;
  const x = px + (size - w) / 2;
  const y = py + size - h;

  wctx.fillStyle = 'rgba(0,0,0,.25)';
  wctx.beginPath();
  wctx.ellipse(px + size / 2, py + size - 2, size * 0.42, 3, 0, 0, TAU);
  wctx.fill();

  wctx.fillStyle = s.flash > 0 ? '#ffffff' : '#58ca6b';
  roundRect(wctx, x, y, w, h, w * 0.36);
  wctx.fill();

  wctx.fillStyle = s.flash > 0 ? '#ffffff' : '#8ff09c';
  roundRect(wctx, x + w * 0.16, y + h * 0.12, w * 0.48, h * 0.26, w * 0.16);
  wctx.fill();

  const eyeY = y + h * 0.4;
  const eyeDX = w * 0.17;
  wctx.fillStyle = '#12351a';
  wctx.fillRect(x + w / 2 - eyeDX - 2, eyeY, 4, 5);
  wctx.fillRect(x + w / 2 + eyeDX - 2, eyeY, 4, 5);
  wctx.fillStyle = '#fff';
  wctx.fillRect(x + w / 2 - eyeDX - 1, eyeY + 1, 1, 1);
  wctx.fillRect(x + w / 2 + eyeDX - 1, eyeY + 1, 1, 1);
}

function drawMob(m, rx, ry) {
  const px = m.x * TILE - rx;
  const py = m.y * TILE - ry;
  const w = m.w * TILE;
  const h = m.h * TILE;
  const dir = m.dir < 0 ? -1 : 1;
  const flash = m.flash > 0;

  wctx.fillStyle = 'rgba(0,0,0,.25)';
  wctx.beginPath();
  wctx.ellipse(px + w / 2, py + h - 2, w * 0.42, 3, 0, 0, TAU);
  wctx.fill();

  wctx.save();
  wctx.translate(px + w / 2, py);
  wctx.scale(dir, 1);

  if (m.kind === 'zombie') {
    wctx.fillStyle = flash ? '#fff' : '#33405e';
    wctx.fillRect(-w * 0.32, h * 0.55, w * 0.24, h * 0.45);
    wctx.fillRect(w * 0.08, h * 0.55, w * 0.24, h * 0.45);
    wctx.fillStyle = flash ? '#fff' : '#3f6b4a';
    wctx.fillRect(-w * 0.38, h * 0.27, w * 0.76, h * 0.31);
    wctx.fillStyle = flash ? '#fff' : '#6fbf5f';
    wctx.fillRect(w * 0.04, h * 0.34, w * 0.48, h * 0.12);
    wctx.fillRect(w * 0.04, h * 0.49, w * 0.42, h * 0.11);
    wctx.fillRect(-w * 0.28, h * 0.04, w * 0.56, h * 0.27);
    wctx.fillStyle = '#1e2b1c';
    wctx.fillRect(w * 0.02, h * 0.13, w * 0.09, h * 0.05);
    wctx.fillRect(-w * 0.12, h * 0.13, w * 0.09, h * 0.05);
    wctx.fillStyle = '#2a1a1a';
    wctx.fillRect(-w * 0.1, h * 0.22, w * 0.2, h * 0.03);
    wctx.fillStyle = flash ? '#fff' : '#2f5a3a';
    wctx.fillRect(-w * 0.12, h * 0.39, w * 0.16, h * 0.07);
  } else if (m.kind === 'cow') {
    wctx.fillStyle = flash ? '#fff' : '#c9bba8';
    for (const lx of [-0.35, -0.1, 0.15, 0.4]) wctx.fillRect(w * lx, h * 0.72, w * 0.13, h * 0.28);
    wctx.fillStyle = flash ? '#fff' : '#f1e7da';
    roundRect(wctx, -w * 0.45, h * 0.25, w * 0.9, h * 0.55, w * 0.2);
    wctx.fill();
    wctx.fillStyle = flash ? '#fff' : '#3a3430';
    wctx.fillRect(-w * 0.3, h * 0.32, w * 0.2, h * 0.16);
    wctx.fillRect(w * 0.05, h * 0.45, w * 0.16, h * 0.18);
    wctx.fillStyle = flash ? '#fff' : '#f1e7da';
    roundRect(wctx, w * 0.3, h * 0.12, w * 0.35, h * 0.4, w * 0.12);
    wctx.fill();
    wctx.fillStyle = '#e0a6a6';
    wctx.fillRect(w * 0.53, h * 0.3, w * 0.13, h * 0.14);
    wctx.fillStyle = '#8a5a5a';
    wctx.fillRect(w * 0.56, h * 0.34, w * 0.04, h * 0.04);
    wctx.fillStyle = '#222';
    wctx.fillRect(w * 0.47, h * 0.2, w * 0.06, h * 0.06);
    wctx.fillStyle = '#e8e0d0';
    wctx.fillRect(w * 0.28, h * 0.05, w * 0.06, h * 0.1);
  } else {
    wctx.fillStyle = flash ? '#fff' : '#e58f9f';
    for (const lx of [-0.32, -0.08, 0.12, 0.34]) wctx.fillRect(w * lx, h * 0.72, w * 0.14, h * 0.28);
    wctx.fillStyle = flash ? '#fff' : '#ff9aa8';
    roundRect(wctx, -w * 0.45, h * 0.25, w * 0.9, h * 0.55, w * 0.22);
    wctx.fill();
    roundRect(wctx, w * 0.3, h * 0.18, w * 0.32, h * 0.35, w * 0.12);
    wctx.fill();
    wctx.fillStyle = '#d96f82';
    wctx.fillRect(w * 0.52, h * 0.3, w * 0.14, h * 0.15);
    wctx.fillStyle = '#7a3a48';
    wctx.fillRect(w * 0.55, h * 0.34, w * 0.03, h * 0.04);
    wctx.fillRect(w * 0.6, h * 0.34, w * 0.03, h * 0.04);
    wctx.fillStyle = '#222';
    wctx.fillRect(w * 0.44, h * 0.22, w * 0.05, h * 0.06);
    wctx.fillStyle = '#e58f9f';
    wctx.fillRect(w * 0.34, h * 0.13, w * 0.08, h * 0.08);
  }
  wctx.restore();

  if (m.hp < m.maxHp) {
    const bw = w * 0.8;
    const bx = px + (w - bw) / 2;
    const by = py - 7;
    wctx.fillStyle = 'rgba(0,0,0,.65)';
    wctx.fillRect(bx - 1, by - 1, bw + 2, 4);
    wctx.fillStyle = '#ff5d6f';
    wctx.fillRect(bx, by, bw * Math.max(0, m.hp / m.maxHp), 2);
  }
}

function drawPlayer(rx, ry) {
  const px = player.x * TILE - rx;
  const py = player.y * TILE - ry;
  const w = player.w * TILE;
  const h = player.h * TILE;
  const s = h / 56;
  const walk = player.walkPhase;
  const sw = Math.sin(walk) * 4;
  const bob = Math.abs(Math.sin(walk)) * 1.2;

  if (player.invuln > 0 && Math.floor(player.invuln * 22) % 2 === 0) return;

  wctx.save();
  wctx.translate(px + w / 2, py + bob);
  wctx.scale(s * (player.face < 0 ? -1 : 1), s);

  // shadow
  wctx.fillStyle = 'rgba(0,0,0,.28)';
  wctx.beginPath();
  wctx.ellipse(0, 55, 10, 3, 0, 0, TAU);
  wctx.fill();

  // legs
  wctx.fillStyle = '#2f3552';
  wctx.fillRect(-7, 37 + Math.max(0, sw), 6, 14);
  wctx.fillRect(1, 37 + Math.max(0, -sw), 6, 14);
  wctx.fillStyle = '#1c2030';
  wctx.fillRect(-7, 50 + Math.max(0, sw), 6, 5);
  wctx.fillRect(1, 50 + Math.max(0, -sw), 6, 5);

  // body
  wctx.fillStyle = '#7fd8c4';
  wctx.fillRect(-7, 17, 14, 20);
  wctx.fillStyle = '#aef2e2';
  wctx.fillRect(-4, 17, 8, 4);
  wctx.fillStyle = '#5fb9a8';
  wctx.fillRect(-7, 33, 14, 4);

  // arms
  wctx.fillStyle = '#7fd8c4';
  wctx.fillRect(-11, 19 - Math.max(0, -sw), 4, 14);
  wctx.fillRect(7, 19 - Math.max(0, sw), 4, 14);
  wctx.fillStyle = '#ffd9c0';
  wctx.fillRect(-11, 31 - Math.max(0, -sw), 4, 4);
  wctx.fillRect(7, 31 - Math.max(0, sw), 4, 4);

  // head
  wctx.fillStyle = '#ffd9c0';
  wctx.fillRect(-9, 1, 18, 16);

  // hair
  wctx.fillStyle = '#ff9ec4';
  wctx.fillRect(-10, -2, 20, 7);
  wctx.fillRect(-11, 3, 3, 14);
  wctx.fillRect(8, 3, 3, 12);
  wctx.beginPath();
  wctx.moveTo(-10, -2); wctx.lineTo(0, 5); wctx.lineTo(10, -2);
  wctx.closePath(); wctx.fill();

  // cat ears
  wctx.beginPath();
  wctx.moveTo(-10, -2); wctx.lineTo(-12, -9); wctx.lineTo(-5, -4);
  wctx.closePath(); wctx.fill();
  wctx.beginPath();
  wctx.moveTo(10, -2); wctx.lineTo(12, -9); wctx.lineTo(5, -4);
  wctx.closePath(); wctx.fill();
  wctx.fillStyle = '#ffc2d9';
  wctx.beginPath();
  wctx.moveTo(-10, -3); wctx.lineTo(-10.5, -7); wctx.lineTo(-7, -4.5);
  wctx.closePath(); wctx.fill();

  // eyes
  wctx.fillStyle = '#3a2433';
  wctx.fillRect(-6, 8, 3, 4);
  wctx.fillRect(3, 8, 3, 4);
  wctx.fillStyle = '#ffffff';
  wctx.fillRect(-5, 8, 1, 1);
  wctx.fillRect(4, 8, 1, 1);

  // blush
  wctx.fillStyle = 'rgba(255,120,160,.45)';
  wctx.fillRect(-8, 13, 3, 2);
  wctx.fillRect(5, 13, 3, 2);

  wctx.restore();
}

function drawParticles(rx, ry) {
  for (const p of particles) {
    wctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    wctx.fillStyle = p.color;
    wctx.fillRect(p.x * TILE - rx, p.y * TILE - ry, p.size, p.size);
  }
  wctx.globalAlpha = 1;
}

/* ── light overlay ───────────────────────────────────────── */
const lightCv = document.createElement('canvas');
const lightCtx = lightCv.getContext('2d');
let lightImg = null;

function buildLightOverlay(rx, ry, day) {
  const x0 = Math.max(0, Math.floor(rx / TILE) - 1);
  const y0 = Math.max(0, Math.floor(ry / TILE) - 1);
  const x1 = Math.min(W - 1, Math.ceil((rx + vw) / TILE) + 1);
  const y1 = Math.min(H - 1, Math.ceil((ry + vh) / TILE) + 1);
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;

  if (lightCv.width !== cols || lightCv.height !== rows) {
    lightCv.width = cols;
    lightCv.height = rows;
    lightImg = null;
  }
  if (!lightImg) lightImg = lightCtx.createImageData(cols, rows);
  const data = lightImg.data;

  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;
  let o = 0;

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++, o += 4) {
      const i = idx(tx, ty);
      const id = world[i];
      let sl = skyL[i], bl = blkL[i];

      if (BLOCKS[id].solid) {
        sl = 0; bl = 0;
        if (tx > 0) { sl = Math.max(sl, skyL[i - 1]); bl = Math.max(bl, blkL[i - 1]); }
        if (tx < W - 1) { sl = Math.max(sl, skyL[i + 1]); bl = Math.max(bl, blkL[i + 1]); }
        if (ty > 0) { sl = Math.max(sl, skyL[i - W]); bl = Math.max(bl, blkL[i - W]); }
        if (ty < H - 1) { sl = Math.max(sl, skyL[i + W]); bl = Math.max(bl, blkL[i + W]); }
      }

      let b = Math.max(sl * day, bl) / 15;

      const dx = tx + 0.5 - pcx;
      const dy = ty + 0.5 - pcy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 6) b = Math.max(b, (1 - d / 6) * 0.62);
      if (ty > surfaceArr[tx]) b = Math.max(b, 0.28);
      b = Math.max(b, 0.14);

      const a = Math.round((1 - clamp(b, 0, 1)) * 210);
      data[o] = 0; data[o + 1] = 0; data[o + 2] = 0; data[o + 3] = a;
    }
  }

  lightCtx.putImageData(lightImg, 0, 0);
  return { x0, y0, cols, rows };
}

function applyLighting(rx, ry, day) {
  const v = buildLightOverlay(rx, ry, day);
  wctx.save();
  wctx.globalCompositeOperation = 'source-atop';
  wctx.imageSmoothingEnabled = true;
  wctx.drawImage(lightCv, v.x0 * TILE - rx, v.y0 * TILE - ry, v.cols * TILE, v.rows * TILE);
  wctx.restore();
  wctx.imageSmoothingEnabled = false;
}

/* ── HUD / overlays ──────────────────────────────────────── */
function drawTarget(rx, ry) {
  if (paused || craftOpen || player.dead) return;
  const tx = Math.floor((mouse.x + rx) / TILE);
  const ty = Math.floor((mouse.y + ry) / TILE);
  if (!inWorld(tx, ty)) return;

  const dist = Math.hypot(tx + 0.5 - (player.x + player.w / 2), ty + 0.5 - (player.y + player.h / 2));
  const ok = dist <= REACH;
  const sx = tx * TILE - rx;
  const sy = ty * TILE - ry;

  ctx.lineWidth = 2;
  ctx.strokeStyle = ok ? 'rgba(255,255,255,.9)' : 'rgba(255,90,120,.65)';
  ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);

  ctx.fillStyle = ok ? 'rgba(255,255,255,.9)' : 'rgba(255,90,120,.65)';
  const c = 6;
  ctx.fillRect(sx + 1, sy + 1, c, 2);
  ctx.fillRect(sx + 1, sy + 1, 2, c);
  ctx.fillRect(sx + TILE - 1 - c, sy + 1, c, 2);
  ctx.fillRect(sx + TILE - 3, sy + 1, 2, c);
  ctx.fillRect(sx + 1, sy + TILE - 3, c, 2);
  ctx.fillRect(sx + 1, sy + TILE - 1 - c, 2, c);
  ctx.fillRect(sx + TILE - 1 - c, sy + TILE - 3, c, 2);
  ctx.fillRect(sx + TILE - 3, sy + TILE - 1 - c, 2, c);
}

function drawDamage() {
  if (player.invuln > 0 && !player.dead) {
    const a = 0.1 + 0.08 * Math.sin(time * 40);
    const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.25, vw / 2, vh / 2, vh * 0.85);
    g.addColorStop(0, 'rgba(255,20,60,0)');
    g.addColorStop(1, `rgba(255,20,60,${a.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  }
  if (player.dead) {
    ctx.fillStyle = 'rgba(8,4,12,.55)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#ffd0e0';
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ты потерял сознание…', vw / 2, vh / 2);
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#c9b6d6';
    ctx.fillText('возрождение…', vw / 2, vh / 2 + 30);
    ctx.textAlign = 'left';
  }
}

let lastClock = '';
function updateClock() {
  const hours = (dayTime * 24 + 6) % 24;
  const hh = Math.floor(hours);
  const mm = Math.floor((hours - hh) * 60);
  const s = `День ${dayCount} · ${pad2(hh)}:${pad2(mm)}`;
  if (s !== lastClock) {
    lastClock = s;
    clockText.textContent = s;
  }
  clockIcon.textContent = daylight() > 0.32 ? '☀' : '☾';
}

function render() {
  const day = daylight();
  drawSky(day);

  const shx = shake > 0 ? (Math.random() - 0.5) * shake * 26 : 0;
  const shy = shake > 0 ? (Math.random() - 0.5) * shake * 26 : 0;
  const rx = camX + shx;
  const ry = camY + shy;

  wctx.clearRect(0, 0, vw, vh);
  drawUnderground(rx, ry);
  drawWorldTiles(rx, ry);
  for (const s of slimes) drawSlime(s, rx, ry);
  for (const m of mobs) drawMob(m, rx, ry);
  drawPlayer(rx, ry);
  drawParticles(rx, ry);
  applyLighting(rx, ry, day);

  ctx.drawImage(worldCanvas, 0, 0);
  drawTarget(rx, ry);
  drawDamage();
}

/* ── main loop ───────────────────────────────────────────── */
let lastT = performance.now();
function loop(ts) {
  const dt = Math.min(0.05, Math.max(0, (ts - lastT) / 1000));
  lastT = ts;

  try {
    if (!started) {
      requestAnimationFrame(loop);
      return;
    }

    if (!paused && !craftOpen && !invOpen && !furnaceOpen && !chestOpen) update(dt);
    render();
    updateClock();
  } catch (err) {
    console.error(err);
    const box = document.getElementById('err');
    if (box) {
      box.style.display = 'block';
      box.textContent = 'Ошибка рендера: ' + (err && err.message ? err.message : err) +
        '\n' + (err && err.stack ? err.stack : '');
    }
  }

  requestAnimationFrame(loop);
}

/* ── boot ────────────────────────────────────────────────── */
resize();
buildHotbar();
buildCraftGrid();
updateHearts();
updateHunger();
updateHotbar();
updateClock();

const bootParams = new URLSearchParams(location.search);
if (bootParams.get('play') === '1') {
  if (bootParams.get('fresh') === '1') {
    newWorld(undefined, bootParams.get('mode') || 'survival', bootParams.get('diff') || 'normal');
    startGame(true);
  } else {
    startGame(false);
  }
} else {
  showTitle();
}
requestAnimationFrame(loop);

/* отладочный доступ (можно дергать из консоли браузера) */
window.__mc2d = {
  player, inv, slimes, mobs, particles, mouse,
  spawnAnimal, spawnZombie,
  give: (id, n = 1) => addItem(id, n),
  teleport: (x, y) => { player.x = x; player.y = y; player.vx = player.vy = 0; },
  setTime: t => { dayTime = ((t % 1) + 1) % 1; },
  breakAt: (x, y) => breakBlock(x, y),
  placeAt: (x, y) => placeAt(x, y),
  openCraft: () => setCraft(true),
  openInventory: () => setInventory(true),
  openFurnace, openChest, chests,
  spawnEggMob,
  biomes: () => Array.from(biomeArr),
  biomeAt: x => biomeArr[Math.floor(x)],
  surfaceAt: x => surfaceArr[Math.floor(x)],
  blockAt: (x, y) => world[idx(Math.floor(x), Math.floor(y))],
  biomeName: x => ['plains','forest','desert','snow','mountain'][biomeArr[Math.floor(x)]],
  setBlock: (x, y, id) => { if (inWorld(x, y)) { world[idx(x, y)] = id; lightDirty = true; } },
  stats: () => { const c = {}; for (let i = 0; i < world.length; i++) c[world[i]] = (c[world[i]] || 0) + 1; return c; },
  version: 'v3',
  tex: id => TEX[id].toDataURL(),
  select: i => selectSlot(i),
  save: saveGame,
  start: () => startGame(false),
  state: () => ({ started, paused, loading: !loadingEl.classList.contains('hidden'), mode: player.mode, x: player.x, y: player.y, clock: clockText.textContent }),
  showTitle,
  newWorld
};

})();
