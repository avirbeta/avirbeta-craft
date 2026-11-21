import * as THREE from './three.module.js';

/* ═══════════════════════════════════════════════════════════
   AVIRBETA 3D — воксельная песочница
   ═══════════════════════════════════════════════════════════ */

/* ── helpers ─────────────────────────────────────────────── */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const isFiniteNumber = v => typeof v === 'number' && Number.isFinite(v);
const lerp = (a, b, t) => a + (b - a) * t;
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
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, s = 0, oct = 3) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x * f, y * f, s + i * 31) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

/* ── block definitions ──────────────────────────────────── */
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, SAND = 5,
      LOG = 6, LEAVES = 7, PLANKS = 8, WATER = 9, GLASS = 10,
      COAL = 11, IRON = 12, GOLD = 13, DIAMOND = 14, BEDROCK = 15,
      SNOW = 16, BRICK = 17;
const APPLE = 100;

const BLOCKS = [];
function defBlock(id, name, hard, drop, opts = {}) {
  BLOCKS[id] = Object.assign({
    id, name, hard, drop,
    solid: true, opaque: true,
    top: 0, bottom: 0, side: 0
  }, opts);
}

defBlock(AIR, 'Воздух', 0, 0, { solid: false, opaque: false });
defBlock(GRASS, 'Трава', 0.6, DIRT, { top: 0, bottom: 2, side: 1 });
defBlock(DIRT, 'Земля', 0.5, DIRT, { top: 2, bottom: 2, side: 2 });
defBlock(STONE, 'Камень', 1.2, COBBLE, { top: 3, bottom: 3, side: 3 });
defBlock(COBBLE, 'Булыжник', 1.2, COBBLE, { top: 4, bottom: 4, side: 4 });
defBlock(SAND, 'Песок', 0.4, SAND, { top: 5, bottom: 5, side: 5 });
defBlock(LOG, 'Бревно', 0.8, LOG, { top: 7, bottom: 7, side: 6 });
defBlock(LEAVES, 'Листва', 0.2, LEAVES, { top: 8, bottom: 8, side: 8 });
defBlock(PLANKS, 'Доски', 0.8, PLANKS, { top: 9, bottom: 9, side: 9 });
defBlock(WATER, 'Вода', Infinity, 0, { solid: false, opaque: false, top: 10, bottom: 10, side: 10 });
defBlock(GLASS, 'Стекло', 0.35, GLASS, { opaque: false, top: 11, bottom: 11, side: 11 });
defBlock(COAL, 'Угольная руда', 1.5, COAL, { top: 12, bottom: 12, side: 12 });
defBlock(IRON, 'Железная руда', 1.8, IRON, { top: 13, bottom: 13, side: 13 });
defBlock(GOLD, 'Золотая руда', 2.2, GOLD, { top: 14, bottom: 14, side: 14 });
defBlock(DIAMOND, 'Алмазная руда', 2.6, DIAMOND, { top: 15, bottom: 15, side: 15 });
defBlock(BEDROCK, 'Бедрок', Infinity, 0, { top: 16, bottom: 16, side: 16 });
defBlock(SNOW, 'Снег', 0.35, SNOW, { top: 17, bottom: 17, side: 17 });
defBlock(BRICK, 'Кирпич', 1.3, BRICK, { top: 18, bottom: 18, side: 18 });

const isBlock = id => id > 0 && id < 100 && !!BLOCKS[id];
const isSolid = id => isBlock(id) && BLOCKS[id].solid;
const isOpaque = id => isBlock(id) && BLOCKS[id].opaque;
const blockName = id => isBlock(id) ? BLOCKS[id].name : (id === APPLE ? 'Яблоко' : '???');

/* ── textures ───────────────────────────────────────────── */
const ATLAS_SIZE = 128, TILE = 16, COLS = 8;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = ATLAS_SIZE;
const actx = atlasCanvas.getContext('2d');
actx.imageSmoothingEnabled = false;

function baseNoise(g, r, base, colors, n = 70) {
  g.fillStyle = base; g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1);
  }
}
function oreBlob(g, r, color, dark) {
  for (let k = 0; k < 4; k++) {
    const x = 2 + ((r() * 11) | 0), y = 2 + ((r() * 11) | 0);
    g.fillStyle = dark; g.fillRect(x, y, 3, 3);
    g.fillStyle = color; g.fillRect(x, y, 2, 2);
    g.fillStyle = '#ffffff66'; g.fillRect(x, y, 1, 1);
  }
}

function tile(index, draw, seed) {
  const col = index % COLS, row = (index / COLS) | 0;
  const g = actx;
  g.save();
  g.beginPath();
  g.rect(col * TILE, row * TILE, TILE, TILE);
  g.clip();
  g.translate(col * TILE, row * TILE);
  draw(g, rng(seed));
  g.restore();
}

tile(0, (g, r) => {
  baseNoise(g, r, '#4f9a35', ['#57a83b', '#468c2f', '#63b84a', '#3f7a2e'], 90);
}, 10);
tile(1, (g, r) => {
  baseNoise(g, r, '#7b5432', ['#6a4629', '#8a603d', '#5c3c22', '#946a45'], 70);
  g.fillStyle = '#4f9a35'; g.fillRect(0, 0, 16, 4);
  for (let x = 0; x < 16; x++) {
    g.fillStyle = r() < 0.5 ? '#57a83b' : '#468c2f';
    g.fillRect(x, 0, 1, 2 + ((r() * 3) | 0));
  }
}, 11);
tile(2, (g, r) => {
  baseNoise(g, r, '#7b5432', ['#6a4629', '#8a603d', '#5c3c22', '#946a45'], 110);
}, 12);
tile(3, (g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98', '#73767f', '#9598a2'], 130);
}, 13);
tile(4, (g, r) => {
  baseNoise(g, r, '#5e6169', ['#555861', '#6a6d76'], 80);
  for (let i = 0; i < 7; i++) {
    const x = (r() * 12) | 0, y = (r() * 12) | 0;
    const w = 3 + ((r() * 4) | 0), h = 2 + ((r() * 3) | 0);
    g.fillStyle = '#7e818b'; g.fillRect(x, y, w, h);
    g.fillStyle = '#999ca6'; g.fillRect(x, y, w, 1);
    g.fillStyle = '#4c4f57'; g.fillRect(x, y + h - 1, w, 1);
  }
}, 14);
tile(5, (g, r) => {
  baseNoise(g, r, '#e0cf8d', ['#d4c17c', '#ecdca3', '#c9b671', '#f4e8b8'], 130);
}, 15);
tile(6, (g, r) => {
  baseNoise(g, r, '#6b4726', ['#5c3c1f', '#785231', '#4e321a'], 60);
  for (const x of [3, 7, 11, 14]) {
    g.fillStyle = '#4a2f19'; g.fillRect(x, 0, 1, 16);
    g.fillStyle = '#835a34'; g.fillRect(x + 1, 0, 1, 16);
  }
}, 16);
tile(7, (g, r) => {
  baseNoise(g, r, '#6b4726', ['#5c3c1f', '#785231', '#4e321a'], 40);
  g.strokeStyle = '#4a2f19'; g.lineWidth = 1;
  g.beginPath(); g.arc(8, 8, 5, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(8, 8, 2.5, 0, Math.PI * 2); g.stroke();
}, 17);
tile(8, (g, r) => {
  baseNoise(g, r, '#2f6b26', ['#3f7a2e', '#4f9138', '#2a5c22', '#5aa340', '#3a732c'], 190);
}, 18);
tile(9, (g, r) => {
  baseNoise(g, r, '#b07a3f', ['#a36f37', '#bc874b', '#966330'], 60);
  for (let y = 0; y < 16; y += 4) {
    g.fillStyle = '#7d5527'; g.fillRect(0, y, 16, 1);
    g.fillStyle = '#cf9a5a'; g.fillRect(0, y + 1, 16, 1);
  }
  g.fillStyle = '#7d5527';
  g.fillRect(5, 0, 1, 4); g.fillRect(11, 4, 1, 4);
  g.fillRect(3, 8, 1, 4); g.fillRect(9, 12, 1, 4);
}, 19);
tile(10, (g, r) => {
  g.fillStyle = 'rgba(40,108,196,0.9)'; g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = 'rgba(130,200,255,0.5)';
    g.fillRect((r() * 14) | 0, (r() * 15) | 0, 2, 1);
  }
  g.fillStyle = 'rgba(20,60,130,0.4)'; g.fillRect(0, 14, 16, 2);
}, 20);
tile(11, (g, r) => {
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = 'rgba(190,232,255,0.22)'; g.fillRect(0, 0, 16, 16);
  g.strokeStyle = '#c8eeff'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 15, 15);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillRect(3, 3, 1, 6); g.fillRect(4, 3, 4, 1);
}, 21);
tile(12, (g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98'], 70);
  oreBlob(g, r, '#2c2c33', '#15151a');
}, 22);
tile(13, (g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98'], 70);
  oreBlob(g, r, '#e0b089', '#8a5a3a');
}, 23);
tile(14, (g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98'], 70);
  oreBlob(g, r, '#ffd84f', '#a8791e');
}, 24);
tile(15, (g, r) => {
  baseNoise(g, r, '#7c7f88', ['#6d7079', '#8b8e98'], 70);
  oreBlob(g, r, '#5ff0de', '#1d8f86');
}, 25);
tile(16, (g, r) => {
  baseNoise(g, r, '#2d2d36', ['#1c1c23', '#3d3d48', '#24242c'], 150);
}, 26);
tile(17, (g, r) => {
  baseNoise(g, r, '#eef6ff', ['#dce9f7', '#ffffff', '#d2e2f2'], 90);
}, 27);
tile(18, (g, r) => {
  baseNoise(g, r, '#9a4a3a', ['#8a3f31', '#aa5747', '#7c3529'], 60);
  g.fillStyle = '#d8c0a0';
  for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  g.fillRect(0, 0, 1, 4); g.fillRect(8, 0, 1, 4);
  g.fillRect(4, 4, 1, 4); g.fillRect(12, 4, 1, 4);
  g.fillRect(0, 8, 1, 4); g.fillRect(8, 8, 1, 4);
  g.fillRect(4, 12, 1, 4); g.fillRect(12, 12, 1, 4);
}, 28);

const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestFilter;
atlasTexture.colorSpace = THREE.SRGBColorSpace;

function tileUV(index) {
  const col = index % COLS, row = (index / COLS) | 0;
  const pad = 0.001;
  const u0 = col / COLS + pad;
  const u1 = (col + 1) / COLS - pad;
  const v0 = 1 - (row + 1) / COLS + pad;
  const v1 = 1 - row / COLS - pad;
  return [u0, v0, u1, v1];
}

/* иконки для HUD */
const iconCache = new Map();
function makeIcon(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (id === APPLE) {
    g.fillStyle = '#d63b3b';
    g.beginPath(); g.arc(8, 9, 5, 0, TAU); g.fill();
    g.fillStyle = '#ff6b6b';
    g.beginPath(); g.arc(6, 7, 2, 0, TAU); g.fill();
    g.fillStyle = '#6b4726'; g.fillRect(8, 2, 1, 3);
    g.fillStyle = '#4f9a35'; g.fillRect(9, 2, 3, 2);
  } else if (isBlock(id)) {
    const tex = BLOCKS[id].side;
    const col = tex % COLS, row = (tex / COLS) | 0;
    g.drawImage(atlasCanvas, col * 16, row * 16, 16, 16, 0, 0, 16, 16);
  }
  iconCache.set(id, c);
  return c;
}

/* ── world ──────────────────────────────────────────────── */
const WX = 128, WY = 64, WZ = 128, CHUNK = 16;
const SEA = 24;
const worldKey = 'avirbeta3d_save_v1';

let world = new Uint8Array(WX * WY * WZ);
let heightMap = new Int16Array(WX * WZ);
let worldSeed = 1;
const idx = (x, y, z) => x + z * WX + y * WX * WZ;
const inside = (x, y, z) => x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ;

function getBlock(x, y, z) {
  if (y < 0) return BEDROCK;
  if (y >= WY) return AIR;
  if (x < 0 || x >= WX || z < 0 || z >= WZ) return BEDROCK;
  return world[idx(x, y, z)];
}
function setBlockRaw(x, y, z, id) {
  if (inside(x, y, z)) world[idx(x, y, z)] = id;
}

/* ── generation ─────────────────────────────────────────── */
function generateWorld(seed) {
  worldSeed = (seed >>> 0) || 1;
  world = new Uint8Array(WX * WY * WZ);
  heightMap = new Int16Array(WX * WZ);
  const r = rng(worldSeed);

  for (let x = 0; x < WX; x++) {
    for (let z = 0; z < WZ; z++) {
      let h = 30
        + (fbm(x * 0.035, z * 0.035, worldSeed + 1, 4) - 0.5) * 14
        + (fbm(x * 0.09, z * 0.09, worldSeed + 2, 3) - 0.5) * 4;
      h = clamp(Math.round(h), 18, 52);
      heightMap[x + z * WX] = h;

      for (let y = 0; y <= h; y++) {
        let id = STONE;
        if (y === 0) id = BEDROCK;
        else if (y === h) {
          if (h <= SEA + 1) id = SAND;
          else if (h > 44) id = SNOW;
          else id = GRASS;
        } else if (y > h - 4) {
          id = h <= SEA + 1 ? SAND : DIRT;
        }
        if (id === STONE && y > 4 && y < h - 4) {
          const cave = fbm(x * 0.055 + y * 0.04, z * 0.055 - y * 0.035, worldSeed + 7, 3);
          if (cave > 0.635) id = AIR;
        }
        world[idx(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) {
        world[idx(x, y, z)] = WATER;
      }
    }
  }

  // руды
  const ro = rng(worldSeed + 99);
  const ores = [[COAL, 5, 52, 320], [IRON, 12, 46, 180], [GOLD, 24, 52, 80], [DIAMOND, 32, 60, 36]];
  for (const [id, minY, maxY, count] of ores) {
    for (let i = 0; i < count; i++) {
      let x = 2 + ((ro() * (WX - 4)) | 0);
      let z = 2 + ((ro() * (WZ - 4)) | 0);
      let y = minY + ((ro() * Math.max(1, maxY - minY)) | 0);
      const n = 3 + ((ro() * 4) | 0);
      for (let k = 0; k < n; k++) {
        if (inside(x, y, z) && world[idx(x, y, z)] === STONE) world[idx(x, y, z)] = id;
        const d = (ro() * 6) | 0;
        if (d < 2) x += d ? 1 : -1;
        else if (d < 4) z += d === 2 ? 1 : -1;
        else y += d === 4 ? 1 : -1;
        x = clamp(x, 1, WX - 2); y = clamp(y, 2, WY - 3); z = clamp(z, 1, WZ - 2);
      }
    }
  }

  // деревья
  for (let x = 4; x < WX - 4; x++) {
    for (let z = 4; z < WZ - 4; z++) {
      const h = heightMap[x + z * WX];
      if (h <= SEA + 1 || h > 43) continue;
      if (world[idx(x, h, z)] !== GRASS) continue;
      if (r() > 0.012) continue;
      const th = 5 + ((r() * 3) | 0);
      let ok = true;
      for (let i = 1; i <= th + 2; i++) if (getBlock(x, h + i, z) === WATER) ok = false;
      if (!ok) continue;
      for (let i = 1; i <= th; i++) setBlockRaw(x, h + i, z, LOG);
      const top = h + th;
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            if (dy === 1 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
            const bx = x + dx, by = top + dy, bz = z + dz;
            if (inside(bx, by, bz) && getBlock(bx, by, bz) === AIR) setBlockRaw(bx, by, bz, LEAVES);
          }
        }
      }
    }
  }

  // спавн
  let sx = WX >> 1, sz = WZ >> 1;
  let sh = heightMap[sx + sz * WX];
  for (let tries = 0; tries < 200; tries++) {
    if (sh > SEA + 2 && sh < 44) break;
    sx = 20 + ((r() * (WX - 40)) | 0);
    sz = 20 + ((r() * (WZ - 40)) | 0);
    sh = heightMap[sx + sz * WX];
  }
  // убираем только деревья вокруг спавна, не трогая рельеф
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      for (let dy = 1; dy <= 10; dy++) {
        const bx = sx + dx, bz = sz + dz, by = sh + dy;
        const b = getBlock(bx, by, bz);
        if (b === LOG || b === LEAVES) setBlockRaw(bx, by, bz, AIR);
      }
    }
  }
  spawn.x = sx + 0.5;
  spawn.y = sh + 1;
  spawn.z = sz + 0.5;
}

/* ── three.js scene ─────────────────────────────────────── */
const container = document.getElementById('game3d');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6fb7ff);
scene.fog = new THREE.Fog(0x6fb7ff, 35, 110);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 260);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a3a2a, 1.0);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff3d0, 1.4);
sunLight.position.set(60, 100, 30);
scene.add(sunLight);
const playerLight = new THREE.PointLight(0xffe0b0, 1.1, 16, 2);
scene.add(playerLight);

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(5, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false })
);
scene.add(sunMesh);
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(4, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false })
);
scene.add(moonMesh);

// звёзды
const starPositions = [];
const sr = rng(4242);
for (let i = 0; i < 500; i++) {
  const th = sr() * TAU;
  const ph = Math.acos(2 * sr() - 1);
  const R = 150;
  starPositions.push(Math.sin(ph) * Math.cos(th) * R, Math.cos(ph) * R, Math.sin(ph) * Math.sin(th) * R);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0, fog: false, sizeAttenuation: false });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* ── materials ──────────────────────────────────────────── */
const opaqueMat = new THREE.MeshLambertMaterial({
  map: atlasTexture, vertexColors: true, side: THREE.DoubleSide
});
const waterMat = new THREE.MeshLambertMaterial({
  map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.62,
  depthWrite: false, side: THREE.DoubleSide
});
const glassMat = new THREE.MeshLambertMaterial({
  map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.36,
  depthWrite: false, side: THREE.DoubleSide
});

/* ── chunk meshing ──────────────────────────────────────── */
const chunkMeshes = new Map();

const FACES = [
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], shade: 0.82, face: 'side' },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], shade: 0.72, face: 'side' },
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1.0, face: 'top' },
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: 0.55, face: 'bottom' },
  { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], shade: 0.9, face: 'side' },
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], shade: 0.78, face: 'side' }
];

function pushQuad(bucket, x, y, z, face, tileIndex) {
  const start = bucket.pos.length / 3;
  const [u0, v0, u1, v1] = tileUV(tileIndex);
  const uvs = [[u0,v0],[u0,v1],[u1,v1],[u1,v0]];
  for (let i = 0; i < 4; i++) {
    const c = face.corners[i];
    bucket.pos.push(x + c[0], y + c[1], z + c[2]);
    bucket.norm.push(face.dir[0], face.dir[1], face.dir[2]);
    bucket.uv.push(uvs[i][0], uvs[i][1]);
    bucket.col.push(face.shade, face.shade, face.shade);
  }
  bucket.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function disposeChunk(cx, cz) {
  const key = cx + ',' + cz;
  const list = chunkMeshes.get(key);
  if (!list) return;
  for (const mesh of list) {
    if (!mesh) continue;
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  chunkMeshes.delete(key);
}

function buildChunk(cx, cz) {
  disposeChunk(cx, cz);
  const opaque = { pos: [], norm: [], uv: [], col: [], idx: [] };
  const water = { pos: [], norm: [], uv: [], col: [], idx: [] };
  const glass = { pos: [], norm: [], uv: [], col: [], idx: [] };

  for (let y = 0; y < WY; y++) {
    for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
      for (let z = cz * CHUNK; z < (cz + 1) * CHUNK; z++) {
        const id = getBlock(x, y, z);
        if (id === AIR) continue;
        const block = BLOCKS[id];
        const bucket = id === WATER ? water : (id === GLASS ? glass : opaque);
        for (const face of FACES) {
          const nd = getBlock(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
          if (isOpaque(nd)) continue;
          if (id === WATER && nd === WATER) continue;
          if (id === GLASS && nd === GLASS) continue;
          const tileIndex = face.face === 'top' ? block.top : (face.face === 'bottom' ? block.bottom : block.side);
          pushQuad(bucket, x, y, z, face, tileIndex);
        }
      }
    }
  }

  const meshes = [];
  const build = (bucket, mat, order) => {
    if (!bucket.pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(bucket.col, 3));
    geo.setIndex(bucket.idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = order;
    mesh.frustumCulled = true;
    scene.add(mesh);
    return mesh;
  };

  meshes.push(build(opaque, opaqueMat, 0));
  meshes.push(build(water, waterMat, 2));
  meshes.push(build(glass, glassMat, 1));
  chunkMeshes.set(cx + ',' + cz, meshes);
}

function rebuildAt(x, z) {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  buildChunk(cx, cz);
  if (x % CHUNK === 0 && cx > 0) buildChunk(cx - 1, cz);
  if (x % CHUNK === CHUNK - 1 && cx < WX / CHUNK - 1) buildChunk(cx + 1, cz);
  if (z % CHUNK === 0 && cz > 0) buildChunk(cx, cz - 1);
  if (z % CHUNK === CHUNK - 1 && cz < WZ / CHUNK - 1) buildChunk(cx, cz + 1);
}

function buildAllChunks() {
  for (let cx = 0; cx < WX / CHUNK; cx++) {
    for (let cz = 0; cz < WZ / CHUNK; cz++) buildChunk(cx, cz);
  }
}

/* ── player ─────────────────────────────────────────────── */
const spawn = { x: WX / 2 + 0.5, y: 35, z: WZ / 2 + 0.5 };
const player = {
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
  yaw: 0, pitch: 0, onGround: false,
  health: 20, hunger: 20, mode: 'survival',
  flying: false, lastSpace: 0, deadT: 0,
  hungerAcc: 0, regenAcc: 0, hurtCd: 0, walk: 0
};

const EYE = 1.62, PW = 0.3, PH = 1.8;
const GRAV = 28;

function collides(x, y, z) {
  const x0 = Math.floor(x - PW), x1 = Math.floor(x + PW);
  const y0 = Math.floor(y), y1 = Math.floor(y + PH - 0.001);
  const z0 = Math.floor(z - PW), z1 = Math.floor(z + PW);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      for (let zz = z0; zz <= z1; zz++) {
        if (isSolid(getBlock(xx, yy, zz))) return true;
      }
    }
  }
  return false;
}

function inWater() {
  return getBlock(Math.floor(player.x), Math.floor(player.y + 0.4), Math.floor(player.z)) === WATER;
}

function respawn() {
  player.x = spawn.x; player.y = spawn.y; player.z = spawn.z;
  player.vx = player.vy = player.vz = 0;
  player.health = 20; player.hunger = 20;
  player.deadT = 0;
  updateHearts(); updateHunger();
  toast('Ты возродился у места старта');
}

function ensurePlayerSafe() {
  if (
    !isFiniteNumber(player.x) || !isFiniteNumber(player.y) || !isFiniteNumber(player.z) ||
    player.x < 0 || player.x > WX || player.z < 0 || player.z > WZ ||
    player.y < 0 || player.y > WY
  ) {
    player.x = spawn.x; player.y = spawn.y; player.z = spawn.z;
  }
  player.x = clamp(player.x, 0.01, WX - 0.01);
  player.z = clamp(player.z, 0.01, WZ - 0.01);
  player.y = clamp(player.y, 0.01, WY - PH - 0.01);

  if (collides(player.x, player.y, player.z)) {
    let placed = false;
    for (let y = Math.max(1, Math.floor(player.y)); y < WY - PH; y++) {
      if (!collides(player.x, y, player.z)) {
        player.y = y;
        placed = true;
        break;
      }
    }
    if (!placed) {
      player.x = spawn.x; player.y = spawn.y; player.z = spawn.z;
    }
  }
  player.vx = player.vy = player.vz = 0;
}

function hurt(dmg) {
  if (player.mode === 'creative' || player.hurtCd > 0) return;
  player.health = Math.max(0, player.health - dmg);
  player.hurtCd = 0.8;
  updateHearts();
  if (player.health <= 0) {
    player.deadT = 1.4;
    toast('Ты потерял сознание…');
  }
}

function updatePlayer(dt) {
  const inW = inWater();
  const fly = player.mode === 'creative' && player.flying;

  if (player.deadT > 0) {
    player.deadT -= dt;
    if (player.deadT <= 0) respawn();
    return;
  }

  const forward = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
  const strafe = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  const sprint = !!keys['ShiftLeft'] && !fly;

  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let mx = (-sin * forward + cos * strafe);
  let mz = (-cos * forward - sin * strafe);
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx /= len; mz /= len; }

  const maxSpeed = fly ? 10 : (inW ? 3 : (sprint ? 6.2 : 4.4));
  const accel = fly ? 30 : (inW ? 10 : 22);
  player.vx += mx * accel * dt;
  player.vz += mz * accel * dt;
  const friction = player.onGround || fly || inW ? 10 : 2;
  player.vx -= player.vx * Math.min(1, friction * dt);
  player.vz -= player.vz * Math.min(1, friction * dt);
  const hs = Math.hypot(player.vx, player.vz);
  if (hs > maxSpeed) { player.vx = player.vx / hs * maxSpeed; player.vz = player.vz / hs * maxSpeed; }

  if (fly) {
    const up = !!keys['Space'];
    const down = !!keys['ShiftLeft'];
    player.vy = up ? 7 : (down ? -7 : 0);
  } else if (inW) {
    player.vy = Math.max(player.vy - 8 * dt, -4);
    if (keys['Space']) player.vy = 4;
  } else {
    player.vy -= GRAV * dt;
    if (player.vy < -42) player.vy = -42;
    if (keys['Space'] && player.onGround) {
      player.vy = 8.6;
      player.onGround = false;
    }
  }

  // перемещение по осям
  const ny = player.y + player.vy * dt;
  if (!collides(player.x, ny, player.z)) player.y = ny;
  else {
    if (player.vy < 0) {
      const landV = player.vy;
      player.onGround = true;
      if (!fly && landV < -20) hurt(Math.min(12, Math.floor((-landV - 18) / 3) * 2));
    }
    player.vy = 0;
  }
  const nx = player.x + player.vx * dt;
  if (!collides(nx, player.y, player.z)) player.x = nx; else player.vx = 0;
  const nz = player.z + player.vz * dt;
  if (!collides(player.x, player.y, nz)) player.z = nz; else player.vz = 0;

  // проверка "на земле" для прыжка
  player.onGround = collides(player.x, player.y - 0.08, player.z) || (fly && player.vy === 0);
  player.x = clamp(player.x, 1.4, WX - 1.4);
  player.z = clamp(player.z, 1.4, WZ - 1.4);

  player.walk += Math.hypot(player.vx, player.vz) * dt * 2.5;

  // голод / регенерация
  if (player.mode !== 'creative') {
    player.hungerAcc += dt;
    if (player.hungerAcc > 35) {
      player.hungerAcc = 0;
      player.hunger = Math.max(0, player.hunger - 1);
      updateHunger();
    }
    if (player.hunger <= 0) {
      player.starveAcc = (player.starveAcc || 0) + dt;
      if (player.starveAcc > 4) { player.starveAcc = 0; hurt(1); }
    } else {
      player.starveAcc = 0;
    }
    if (player.hunger >= 18) {
      player.regenAcc += dt;
      if (player.regenAcc > 5 && player.health < 20) {
        player.regenAcc = 0;
        player.health = Math.min(20, player.health + 1);
        updateHearts();
      }
    }
  } else {
    player.hunger = 20;
  }

  player.hurtCd = Math.max(0, player.hurtCd - dt);
}

/* ── camera / raycast ───────────────────────────────────── */
function facing() {
  return new THREE.Vector3(
    -Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    -Math.cos(player.yaw) * Math.cos(player.pitch)
  );
}
function updateCamera() {
  camera.position.set(player.x, player.y + EYE, player.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  playerLight.position.set(player.x, player.y + 1.2, player.z);
}

function raycast(maxDist = 6) {
  const origin = new THREE.Vector3(player.x, player.y + EYE, player.z);
  const dir = facing();
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
  const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z);
  let tMaxX = stepX > 0 ? (x + 1 - origin.x) / dir.x : (origin.x - x) / -dir.x;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) / dir.y : (origin.y - y) / -dir.y;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) / dir.z : (origin.z - z) / -dir.z;
  let nx = 0, ny = 0, nz = 0;

  for (let t = 0; t <= maxDist; ) {
    const id = getBlock(x, y, z);
    if (id !== AIR && id !== WATER) return { x, y, z, id, nx, ny, nz };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

/* ── highlight / particles ──────────────────────────────── */
const highlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
const highlightMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
const highlight = new THREE.LineSegments(highlightGeo, highlightMat);
highlight.visible = false;
scene.add(highlight);

const particles = [];
const particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
function burst(x, y, z, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.set(x + 0.5 + (Math.random() - 0.5), y + 0.5 + Math.random(), z + 0.5 + (Math.random() - 0.5));
    scene.add(mesh);
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 1,
      vz: (Math.random() - 0.5) * 3,
      life: 0.6 + Math.random() * 0.4
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vy -= 12 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += dt * 3;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

/* ── inventory / hotbar ─────────────────────────────────── */
const inv = new Map();
let hotbar = [PLANKS, COBBLE, DIRT, STONE, SAND, LOG, GLASS, BRICK, null];
let selected = 0;
let mining = { x: 0, y: 0, z: 0, progress: 0, active: false };
let placeCd = 0, breakCd = 0;

const countOf = id => inv.get(id) || 0;

function addItem(id, n = 1) {
  if (!id) return;
  inv.set(id, countOf(id) + n);
  if (!hotbar.includes(id)) {
    const empty = hotbar.indexOf(null);
    if (empty >= 0) hotbar[empty] = id;
  }
  updateHotbar();
}
function takeItem(id, n = 1) {
  const c = countOf(id);
  if (c < n) return false;
  if (c === n) inv.delete(id); else inv.set(id, c - n);
  updateHotbar();
  return true;
}

function selectedId() { return hotbar[selected]; }
function selectedCount() {
  const id = selectedId();
  if (!id) return 0;
  return player.mode === 'creative' ? Infinity : countOf(id);
}

const PARTICLE_COLORS = {
  [GRASS]: 0x5aa63c, [DIRT]: 0x7a5232, [STONE]: 0x7c7f88, [COBBLE]: 0x6f727b,
  [SAND]: 0xdfcf8f, [LOG]: 0x6b4726, [LEAVES]: 0x3f7a2e, [PLANKS]: 0xb07a3f,
  [GLASS]: 0xbfe8ff, [COAL]: 0x33343c, [IRON]: 0xd8a17a, [GOLD]: 0xffd34d,
  [DIAMOND]: 0x4be0d0, [SNOW]: 0xeef6ff, [BRICK]: 0x9a4a3a, [BEDROCK]: 0x2b2b33
};
function breakBlock(x, y, z) {
  const id = getBlock(x, y, z);
  if (!isBlock(id) || BLOCKS[id].hard === Infinity) return;
  setBlockRaw(x, y, z, AIR);
  const block = BLOCKS[id];
  if (block.drop) {
    addItem(block.drop, 1);
    if (id === LEAVES && Math.random() < 0.12) addItem(APPLE, 1);
  }
  burst(x, y, z, PARTICLE_COLORS[id] || 0x888888, 12);
  rebuildAt(x, z);
  updateHotbar();
}

function placeBlock(x, y, z) {
  if (!inside(x, y, z)) return;
  const id = selectedId();
  if (!id || !isBlock(id)) return;
  const cur = getBlock(x, y, z);
  if (cur !== AIR && cur !== WATER) return;
  if (selectedCount() <= 0) return;
  // не ставить внутрь игрока
  if (x + 1 > player.x - PW && x < player.x + PW &&
      z + 1 > player.z - PW && z < player.z + PW &&
      y + 1 > player.y && y < player.y + PH) return;
  setBlockRaw(x, y, z, id);
  if (player.mode !== 'creative') takeItem(id, 1);
  rebuildAt(x, z);
  updateHotbar();
}

/* ── UI ──────────────────────────────────────────────────── */
const hudEl = document.getElementById('hud');
const hotbarEl = document.getElementById('hotbar');
const heartsEl = document.getElementById('hearts');
const hungerCv = document.getElementById('hunger');
const hungerCtx = hungerCv.getContext('2d');
const clockText = document.getElementById('clock-text');
const clockIcon = document.getElementById('clock-icon');
const toastEl = document.getElementById('toast');
const targetNameEl = document.getElementById('target-name');
const titleEl = document.getElementById('title');
const loadingEl = document.getElementById('loading');
const loadingFill = document.getElementById('loading-fill');
const loadingSub = document.getElementById('loading-sub');
const lockEl = document.getElementById('lock');
const pauseEl = document.getElementById('pause');
const invPanel = document.getElementById('inventory');
const invGrid = document.getElementById('inv-grid');
const invSlot = document.getElementById('inv-slot');
const slotEls = [];

function buildHotbar() {
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    d.innerHTML = `<span class="num">${i + 1}</span><canvas width="16" height="16"></canvas><span class="count"></span>`;
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
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 16, 16);
    let n = 0;
    if (id) {
      n = player.mode === 'creative' ? Infinity : countOf(id);
      g.drawImage(makeIcon(id), 0, 0);
    }
    el.querySelector('.count').textContent = !id ? '' : (n === Infinity ? '∞' : (n > 0 ? n : ''));
    el.classList.toggle('sel', i === selected);
    el.classList.toggle('dim', !id || (n <= 0 && player.mode !== 'creative'));
  }
}
function selectSlot(i) {
  selected = clamp(i, 0, 8);
  updateHotbar();
  if (invSlot) invSlot.textContent = selected + 1;
}

let lastHp = -1, lastHunger = -1;
function updateHearts() {
  const full = Math.ceil(clamp(player.health, 0, 20) / 2);
  if (full === lastHp) return;
  lastHp = full;
  heartsEl.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('span');
    s.className = 'heart' + (i < full ? ' on' : '');
    s.textContent = '♥';
    heartsEl.appendChild(s);
  }
}
function updateHunger() {
  const full = Math.ceil(clamp(player.hunger, 0, 20) / 2);
  hungerCtx.clearRect(0, 0, 200, 22);
  for (let i = 0; i < 10; i++) {
    const x = i * 20 + 2;
    const on = i < full;
    hungerCtx.fillStyle = on ? '#c97a3a' : '#3b2a46';
    hungerCtx.beginPath(); hungerCtx.ellipse(x + 10, 11, 6, 4, -0.5, 0, TAU); hungerCtx.fill();
    hungerCtx.fillStyle = on ? '#ffe9c2' : '#2a2033';
    hungerCtx.fillRect(x + 3, 13, 5, 3);
  }
}
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

let lastClock = '';
function updateClock() {
  const hours = (dayTime * 24 + 6) % 24;
  const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
  const s = `День ${dayCount} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (s !== lastClock) { lastClock = s; clockText.textContent = s; }
  clockIcon.textContent = daylight() > 0.25 ? '☀' : '☾';
}

function updatePauseMode() {
  const el = document.getElementById('pause-mode');
  if (el) el.textContent = player.mode === 'creative' ? 'творческий' : 'выживание';
  const tb = document.getElementById('toggle-mode');
  if (tb) tb.textContent = player.mode === 'creative' ? 'Вернуться в выживание' : 'Включить творческий режим';
}

/* inventory panel */
function itemCategories() { return ['blocks']; }
function invEntries() {
  if (player.mode === 'creative') {
    return [PLANKS, COBBLE, DIRT, STONE, SAND, LOG, LEAVES, GLASS, COAL, IRON, GOLD, DIAMOND, SNOW, BRICK, APPLE].map(id => [id, Infinity]);
  }
  return Array.from(inv.entries()).filter(([id, n]) => id && n > 0).sort((a, b) => a[0] - b[0]);
}
function refreshInventory() {
  invGrid.innerHTML = '';
  const entries = invEntries();
  for (const [id, n] of entries) {
    const b = document.createElement('button');
    b.className = 'inv-item';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    cv.getContext('2d').drawImage(makeIcon(id), 0, 0);
    const nm = document.createElement('span');
    nm.textContent = blockName(id);
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = n === Infinity ? '∞' : n;
    b.append(cv, nm, cnt);
    b.title = `В слот ${selected + 1}`;
    b.addEventListener('click', () => {
      hotbar[selected] = id;
      updateHotbar();
    });
    invGrid.appendChild(b);
  }
  if (!entries.length) invGrid.innerHTML = '<div class="sub">Пока пусто — копай блоки</div>';
}

function openInventory() {
  if (document.pointerLockElement) document.exitPointerLock();
  paused = true;
  uiOpen = true;
  invPanel.classList.remove('hidden');
  pauseEl.classList.add('hidden');
  lockEl.classList.add('hidden');
  refreshInventory();
}
function closeInventory() {
  invPanel.classList.add('hidden');
  uiOpen = false;
  if (started) {
    paused = true;
    lockEl.classList.remove('hidden');
  }
}

/* ── pointer lock / pause ────────────────────────────────── */
let started = false, paused = true, uiOpen = false, quickplay = false;
let saveAcc = 0;

function requestLock() {
  try { canvas.requestPointerLock(); } catch (e) {}
}

function showPause() {
  if (!started) return;
  paused = true;
  uiOpen = false;
  pauseEl.classList.remove('hidden');
  lockEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  updatePauseMode();
  saveGame();
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    paused = false;
    uiOpen = false;
    lockEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    invPanel.classList.add('hidden');
    hudEl.classList.remove('hidden');
  } else if (started && !uiOpen && !quickplay) {
    if (!pauseEl.classList.contains('hidden')) return;
    showPause();
  }
});

lockEl.addEventListener('click', () => {
  requestLock();
});
document.getElementById('resume').addEventListener('click', () => {
  pauseEl.classList.add('hidden');
  paused = false;
  requestLock();
});
document.getElementById('save').addEventListener('click', () => {
  if (saveGame()) toast('Мир сохранён');
  else toast('Не удалось сохранить: хранилище переполнено');
});
document.getElementById('toggle-mode').addEventListener('click', () => {
  player.mode = player.mode === 'creative' ? 'survival' : 'creative';
  player.flying = false;
  if (player.mode === 'creative') { player.health = 20; player.hunger = 20; }
  updateHearts(); updateHunger(); updateHotbar(); updatePauseMode();
  toast(player.mode === 'creative' ? 'Творческий режим' : 'Выживание');
});
document.getElementById('new-world').addEventListener('click', () => {
  if (!confirm('Создать новый мир?')) return;
  try { localStorage.removeItem(worldKey); } catch (e) {}
  beginGame(false, document.getElementById('mode-select').value);
});
document.getElementById('mode-select').addEventListener('change', () => {});

/* ── save / load ─────────────────────────────────────────── */
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
  if (!started) return;
  try {
    const rle = [];
    let prev = world[0], n = 1;
    for (let i = 1; i < world.length; i++) {
      if (world[i] === prev && n < 255) n++;
      else { rle.push(prev, n); prev = world[i]; n = 1; }
    }
    rle.push(prev, n);
    const bytes = new Uint8Array(rle);
    const data = {
      v: 1,
      seed: worldSeed,
      world: toBase64(bytes),
      px: player.x, py: player.y, pz: player.z,
      yaw: player.yaw, pitch: player.pitch,
      health: player.health, hunger: player.hunger,
      mode: player.mode,
      inv: Array.from(inv.entries()),
      hotbar,
      spawn: { x: spawn.x, y: spawn.y, z: spawn.z },
      time: dayTime, day: dayCount
    };
    localStorage.setItem(worldKey, JSON.stringify(data));
    return true;
  } catch (e) { console.error(e); return false; }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(worldKey);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || !d.world) return false;
    const bytes = fromBase64(d.world);
    const w = new Uint8Array(WX * WY * WZ);
    let q = 0, i = 0;
    while (i < bytes.length && q < w.length) {
      const id = bytes[i++], n = bytes[i++];
      for (let k = 0; k < n && q < w.length; k++) w[q++] = id;
    }
    if (q !== w.length) return false;
    for (let k = 0; k < w.length; k++) if (w[k] !== AIR && !isBlock(w[k])) return false;
    world = w;
    worldSeed = isFiniteNumber(d.seed) ? (d.seed >>> 0) : 1;
    heightMap = new Int16Array(WX * WZ);
    for (let x = 0; x < WX; x++) {
      for (let z = 0; z < WZ; z++) {
        let y = WY - 1;
        while (y > 0 && getBlock(x, y, z) === AIR) y--;
        heightMap[x + z * WX] = y;
      }
    }
    player.x = isFiniteNumber(d.px) ? d.px : spawn.x;
    player.y = isFiniteNumber(d.py) ? d.py : spawn.y;
    player.z = isFiniteNumber(d.pz) ? d.pz : spawn.z;
    player.yaw = isFiniteNumber(d.yaw) ? d.yaw : -Math.PI / 2;
    player.pitch = isFiniteNumber(d.pitch)
      ? clamp(d.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01)
      : -0.1;
    player.health = isFiniteNumber(d.health) ? clamp(d.health, 0, 20) : 20;
    player.hunger = isFiniteNumber(d.hunger) ? clamp(d.hunger, 0, 20) : 20;
    player.mode = d.mode === 'creative' ? 'creative' : 'survival';
    player.flying = false;
    player.deadT = 0;
    player.vx = player.vy = player.vz = 0;
    inv.clear();
    if (Array.isArray(d.inv)) {
      for (const entry of d.inv) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [id, n] = entry;
        if ((isBlock(id) || id === APPLE) && isFiniteNumber(n) && n > 0) {
          inv.set(id, Math.floor(n));
        }
      }
    }
    if (Array.isArray(d.hotbar) && d.hotbar.length === 9) {
      hotbar = d.hotbar.map(id => ((isBlock(id) || id === APPLE) ? id : null));
    }
    if (
      d.spawn &&
      isFiniteNumber(d.spawn.x) &&
      isFiniteNumber(d.spawn.y) &&
      isFiniteNumber(d.spawn.z)
    ) {
      spawn.x = d.spawn.x;
      spawn.y = d.spawn.y;
      spawn.z = d.spawn.z;
    }
    dayTime = isFiniteNumber(d.time) ? clamp(d.time, 0, 0.999) : 0.25;
    dayCount = isFiniteNumber(d.day) ? Math.max(1, Math.floor(d.day)) : 1;
    ensurePlayerSafe();
    return true;
  } catch (e) { console.error(e); return false; }
}

/* ── day / night ─────────────────────────────────────────── */
let dayTime = 0.25, dayCount = 1;
const DAY_LENGTH = 600;
const dayColor = new THREE.Color(0x6fb7ff);
const nightColor = new THREE.Color(0x050817);
const skyColor = new THREE.Color();

function daylight() {
  const angle = (dayTime - 0.25) * TAU;
  return clamp(Math.cos(angle) * 1.15, 0, 1);
}

function updateSky(dt) {
  dayTime += dt / DAY_LENGTH;
  if (dayTime >= 1) { dayTime -= 1; dayCount++; }
  const angle = (dayTime - 0.25) * TAU;
  const sx = Math.sin(angle) * 100, sy = Math.cos(angle) * 100;
  sunMesh.position.set(sx, sy, 40);
  moonMesh.position.set(-sx, -sy, 40);
  const day = daylight();
  skyColor.copy(nightColor).lerp(dayColor, day);
  scene.background.copy(skyColor);
  scene.fog.color.copy(skyColor);
  hemi.intensity = 0.22 + day * 1.15;
  hemi.color.setRGB(0.55 + day * 0.4, 0.7 + day * 0.25, 0.9);
  hemi.groundColor.setRGB(0.18 + day * 0.1, 0.14 + day * 0.08, 0.1);
  sunLight.intensity = day * 1.25;
  sunLight.position.set(sx, sy, 40);
  sunMesh.visible = sy > -15;
  moonMesh.visible = -sy > -15;
  starMat.opacity = clamp(1 - day * 1.6, 0, 1);
  playerLight.intensity = 0.55 + (1 - day) * 0.55;
}

/* ── input ───────────────────────────────────────────────── */
const keys = {};
const mouse = { left: false, right: false };

window.addEventListener('keydown', e => {
  if (e.code === 'F5' || (e.ctrlKey && e.code === 'KeyR')) return;
  keys[e.code] = true;
  if (e.code === 'Escape') {
    if (!invPanel.classList.contains('hidden')) { closeInventory(); e.preventDefault(); return; }
    if (!pauseEl.classList.contains('hidden')) { document.getElementById('resume').click(); e.preventDefault(); return; }
  }
  if (!started) return;
  if (e.code === 'KeyE') {
    if (!invPanel.classList.contains('hidden')) closeInventory();
    else if (!paused) openInventory();
    e.preventDefault(); return;
  }
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  }
  if (e.code === 'Space' && player.mode === 'creative' && !paused) {
    const now = performance.now();
    if (now - player.lastSpace < 320) {
      player.flying = !player.flying;
      player.vy = 0;
      toast(player.flying ? 'Полёт включён' : 'Полёт выключен');
    }
    player.lastSpace = now;
  }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

window.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = clamp(player.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
});

canvas.addEventListener('mousedown', e => {
  if (!started || paused) return;
  if (document.pointerLockElement !== canvas) { requestLock(); return; }
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) { mouse.right = true; tryPlace(); }
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('wheel', e => {
  if (!started || paused) return;
  e.preventDefault();
  const d = Math.sign(e.deltaY) || 1;
  selectSlot((selected + d + 9) % 9);
}, { passive: false });

/* ── mining / placing ───────────────────────────────────── */
function updateMining(dt) {
  placeCd = Math.max(0, placeCd - dt);
  breakCd = Math.max(0, breakCd - dt);
  const hit = raycast(6);
  if (hit) {
    highlight.visible = true;
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    highlight.visible = false;
  }
  const nameEl = document.getElementById('target-name');
  if (hit) {
    nameEl.textContent = BLOCKS[hit.id].name;
    nameEl.classList.add('show');
  } else {
    nameEl.classList.remove('show');
  }

  if (!mouse.left || !hit || paused) {
    mining.progress = 0;
    mining.active = false;
    highlightMat.color.setHex(0xffffff);
    return;
  }

  if (mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z) {
    mining.x = hit.x; mining.y = hit.y; mining.z = hit.z; mining.progress = 0;
  }

  if (player.mode === 'creative') {
    if (breakCd <= 0) {
      breakBlock(hit.x, hit.y, hit.z);
      breakCd = 0.15;
    }
    return;
  }

  const hard = BLOCKS[hit.id].hard;
  if (hard === Infinity) return;
  mining.progress += dt / Math.max(0.15, hard);
  highlightMat.color.setHex(mining.progress > 0.66 ? 0xff9d2e : (mining.progress > 0.33 ? 0xffd34d : 0xffffff));
  if (mining.progress >= 1) {
    breakBlock(hit.x, hit.y, hit.z);
    mining.progress = 0;
  }
}

function tryPlace() {
  if (paused) return;
  const id = selectedId();
  if (id === APPLE) {
    if (player.hunger >= 20) return;
    if (player.mode !== 'creative') takeItem(APPLE, 1);
    player.hunger = Math.min(20, player.hunger + 4);
    updateHunger();
    toast('Яблоко съедено');
    return;
  }
  const hit = raycast(6);
  if (!hit) return;
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  placeBlock(x, y, z);
}

/* ── loop ────────────────────────────────────────────────── */
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
  last = t;
  if (started && !paused) {
    updatePlayer(dt);
    updateMining(dt);
    updateParticles(dt);
    updateSky(dt);
    updateCamera();
    updateClock();
    saveAcc += dt;
    if (saveAcc >= 30) { saveAcc = 0; saveGame(); }
  }
  if (started) renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
window.addEventListener('beforeunload', saveGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });

/* ── game start / title ──────────────────────────────────── */
function showTitle() {
  started = false;
  paused = true;
  hudEl.classList.add('hidden');
  titleEl.classList.remove('hidden');
  loadingEl.classList.add('hidden');
  lockEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  const btn = document.getElementById('btn-play');
  let hasSave = false;
  try { hasSave = !!localStorage.getItem(worldKey); } catch (e) {}
  btn.textContent = hasSave ? 'Продолжить' : 'Играть';
}

function hideTitle() {
  titleEl.classList.add('hidden');
  loadingEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
}

function beginGame(newWorld, mode) {
  titleEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  invPanel.classList.add('hidden');
  loadingEl.classList.remove('hidden');
  loadingSub.textContent = newWorld ? 'Генерация мира…' : 'Загрузка мира…';
  loadingFill.style.animation = 'none';
  void loadingFill.offsetWidth;
  loadingFill.style.animation = '';
  loadingSub.textContent = newWorld ? 'Генерация мира…' : 'Загрузка мира…';

  setTimeout(() => {
    try {
      let loaded = false;
      if (!newWorld) loaded = loadGame();
      if (!loaded) {
        player.mode = mode === 'creative' ? 'creative' : 'survival';
        generateWorld((Math.random() * 0x7fffffff) | 0);
        player.x = spawn.x; player.y = spawn.y; player.z = spawn.z;
        player.health = 20; player.hunger = 20;
        player.yaw = -Math.PI / 2; player.pitch = -0.1;
        player.flying = false;
        inv.clear();
        inv.set(PLANKS, 16);
        hotbar = [PLANKS, COBBLE, DIRT, STONE, SAND, LOG, GLASS, BRICK, null];
        dayTime = 0.25; dayCount = 1;
      }
      buildAllChunks();
      started = true;
      paused = true;
      lastHp = -1; lastHunger = -1;
      updateHearts(); updateHunger(); updateHotbar(); updatePauseMode();
      updateCamera(); updateSky(0);
      renderer.render(scene, camera);
      hudEl.classList.remove('hidden');
      loadingEl.classList.add('hidden');
      if (quickplay) {
        paused = false;
        lockEl.classList.add('hidden');
        pauseEl.classList.add('hidden');
        quickplay = false;
      } else {
        paused = true;
        lockEl.classList.remove('hidden');
      }
      playerLight.position.set(player.x, player.y + 1.2, player.z);
      saveGame();
    } catch (err) {
      console.error(err);
      const box = document.getElementById('err');
      box.style.display = 'block';
      box.textContent = 'Ошибка 3D: ' + (err && err.stack ? err.stack : err);
      loadingEl.classList.add('hidden');
      showTitle();
    }
  }, 80);
}

document.getElementById('btn-play').addEventListener('click', () => {
  beginGame(false, document.getElementById('mode-select').value);
});
document.getElementById('btn-new').addEventListener('click', () => {
  if (!confirm('Создать новый мир? Текущий будет потерян.')) return;
  beginGame(true, document.getElementById('mode-select').value);
});

/* ── boot ────────────────────────────────────────────────── */
buildHotbar();
updateHearts();
updateHunger();
showTitle();
updateSky(0);
quickplay = new URLSearchParams(location.search).get('play') === '1';
if (quickplay) {
  beginGame(true, new URLSearchParams(location.search).get('mode') || 'survival');
}
requestAnimationFrame(loop);
