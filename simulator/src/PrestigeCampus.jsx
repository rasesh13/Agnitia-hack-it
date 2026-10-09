import { useLayoutEffect, useMemo, useRef } from "react";
import { Html, Line, Sparkles } from "@react-three/drei";
import * as THREE from "three";

/*
 * Prestige University, Indore — new academic building by Sanjay Puri Architects
 * (2018–2026). Geometry follows the published drawings:
 * - 28 × 20 grid of ~4.1 m roof platforms over a 114 × 82 m footprint
 *   (roof floor plan), ~463 accessible platforms forming an open-air auditorium.
 * - Roof steps diagonally from 29.4 m at the apex corner down to the approach
 *   corner (Sections A and B, levels +4.8 / +9.0 / +13.2 / +17.4 / +21.6 / +25.8 / +29.4).
 * - Landscaped courtyards cut through the volume to ground level.
 * - A double-height diagonal indoor street runs from the south entrance through
 *   to the rear of the building.
 * - East, west and south faces wrapped in ventilated GFRC jali screens.
 * - Outdoor food-court terraces cascade from the low corner around a stepped pool.
 */

export const PRESTIGE_CELL = 4.1;
const COLS = 28;
const ROWS = 20;
const HALF_W = (COLS * PRESTIGE_CELL) / 2;
const HALF_D = (ROWS * PRESTIGE_CELL) / 2;

// Traced from the architect's roof floor plan: L = landscaped lawn platform,
// V = courtyard / light-well open to the sky, . = paved stepping platform.
const ROOF_MAP = [
  "...............VVV..........",
  "...LL..LL..LL..VVV.LL....LL.",
  ".LLLLVVLL..LL.LL...LL....LL.",
  ".LL..VV..VVVV.LLLL....LLVV..",
  ".......LLVV.....LL....LLVV..",
  ".LL....LLVV...VVV.VVVVV...LL",
  ".LLVVVV.....LLVVV.VVVVV...LL",
  "...VVVV.....LL......LL...LL.",
  "...VV....VVVV.......LL.VVLL.",
  "...VVLL.VV.....LL....VVVV...",
  "..LL.LL.VV.....LL..LLVV.....",
  "..LL...........VV..LL.......",
  ".....VVVV...LL.VV...LL......",
  "...LLVVVVLL.LLVV....LL......",
  "LL.LL..LLLLLL.VV..VV.....LL.",
  "LL.....LL..LL.....VV.....LL.",
  "...........VV...............",
  ".LL.LL...LLVV..LL....LL.....",
  ".LL.LL...LL....LL....LL.....",
  "............................",
];

// Outdoor food-court terraces that cascade away from the low corner.
const TERRACE_ROWS = {
  20: [15, 31], 21: [15, 31], 22: [16, 30], 23: [17, 29], 24: [18, 28], 25: [19, 27], 26: [21, 25],
};
const TERRACE_SIDE = { 28: [11, 19], 29: [11, 19], 30: [13, 19], 31: [15, 19] };
const POOL_CELLS = new Set([
  "19,20", "20,20", "21,20", "22,20", "23,20", "24,20",
  "19,21", "20,21", "21,21", "22,21", "23,21", "24,21",
  "20,22", "21,22", "22,22", "23,22",
]);

const STREET_SOFFIT = 9;
const streetColumn = (row) => (row >= 14 ? 11 : row >= 10 ? 12 : row >= 5 ? 13 : 14);
const isStreet = (i, j) => j >= 0 && j < ROWS && (i === streetColumn(j) || i === streetColumn(j) + 1);

const cellX = (i) => -HALF_W + (i + 0.5) * PRESTIGE_CELL;
const cellZ = (j) => -HALF_D + (j + 0.5) * PRESTIGE_CELL;
const hash = (a, b, c = 0) => {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return value - Math.floor(value);
};
const quantize = (value, step = 0.15) => Math.round(value / step) * step;

// Diagonal ramp: 29.4 m at the apex corner, ~11 m at the far end of Section A,
// ~22 m at the far end of the screened long face, 4.8 m at the approach corner.
function mainHeight(i, j) {
  const along = (i + 0.5) / COLS;
  const across = (j + 0.5) / ROWS;
  const t = (0.72 * along + 0.28 * across) / 0.98;
  return quantize(29.4 - (29.4 - 4.8) * Math.min(1, t));
}

const SIDES = [
  { di: 1, dj: 0, axis: "x", sign: 1 },
  { di: -1, dj: 0, axis: "x", sign: -1 },
  { di: 0, dj: 1, axis: "z", sign: 1 },
  { di: 0, dj: -1, axis: "z", sign: -1 },
];

const BRICK = "#e0814c";
const BRICK_DARK = "#cf6f3e";
const PAVER = "#d9d5cc";
const LAWN = "#5f8f3e";
const CONCRETE = "#a7a49c";
const GLASS = "#22363f";

/* Procedural brick + GFRC jali shading in building-local space, so every
 * instanced column shares one continuous facade pattern. */
function createBrickMaterial({ color = BRICK, half = [HALF_W, HALF_D], jaliEverywhere = false } = {}) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHalf = { value: new THREE.Vector2(half[0], half[1]) };
    shader.uniforms.uJaliAll = { value: jaliEverywhere ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPbLocal;\nvarying vec3 vPbNormal;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vPbLocal = (instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vPbLocal = transformed;
        #endif
        vPbNormal = normal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vPbLocal;
        varying vec3 vPbNormal;
        uniform vec2 uHalf;
        uniform float uJaliAll;
        float pbHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 an = abs(vPbNormal);
          vec2 pbUv = an.x > 0.5 ? vPbLocal.zy : (an.z > 0.5 ? vPbLocal.xy : vPbLocal.xz);
          float shade = 1.0;
          if (an.y < 0.5) {
            bool facade = uJaliAll > 0.5
              || (an.x > 0.5 && abs(vPbLocal.x) > uHalf.x - 0.06)
              || (an.z > 0.5 && abs(vPbLocal.z) > uHalf.y - 0.06);
            if (facade && vPbLocal.y > 1.1) {
              vec2 cell = pbUv / vec2(1.025, 1.4);
              vec2 pid = floor(cell);
              vec2 pf = fract(cell);
              float h = pbHash(pid);
              float seam = max(1.0 - smoothstep(0.0, 0.035, pf.x), 1.0 - smoothstep(0.0, 0.04, pf.y));
              shade *= (0.93 + h * 0.11) * (1.0 - seam * 0.22);
              if (h > 0.3) {
                vec2 g = fract(pbUv * 6.0);
                float d = abs(g.x - 0.5) + abs(g.y - 0.5);
                float hole = 1.0 - smoothstep(0.17, 0.25, d);
                float w = fwidth(pbUv.x * 6.0) + fwidth(pbUv.y * 6.0);
                float fade = clamp(1.0 - w * 0.8, 0.0, 1.0);
                shade *= mix(0.84, 1.0 - hole * 0.5, fade);
              }
            } else {
              vec2 b = pbUv / vec2(0.23, 0.085);
              b.x += step(1.0, mod(floor(b.y), 2.0)) * 0.5;
              vec2 bf = fract(b);
              float mortar = max(1.0 - smoothstep(0.0, 0.12, bf.y), 1.0 - smoothstep(0.0, 0.05, bf.x));
              float fade = clamp(1.0 - fwidth(b.y) * 1.3, 0.0, 1.0);
              shade *= 1.0 - mortar * 0.26 * fade;
              shade *= 0.94 + pbHash(floor(b)) * 0.1 * fade;
            }
          } else {
            shade *= 0.96;
          }
          diffuseColor.rgb *= shade;
        }`,
      );
  };
  material.customProgramCacheKey = () => `prestige-brick-${jaliEverywhere ? "jali" : "facade"}`;
  return material;
}

function Instances({ items, color, material, emissive = "#000000", emissiveIntensity = 0, metalness = 0, roughness = 0.8, castShadow = true, receiveShadow = true, geometry = "box", transparent = false, opacity = 1 }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new THREE.Object3D();
    const tint = new THREE.Color();
    items.forEach((item, index) => {
      object.position.set(...item.position);
      object.rotation.set(...(item.rotation || [0, 0, 0]));
      object.scale.set(...(item.scale || [1, 1, 1]));
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
      if (item.color) mesh.setColorAt(index, tint.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[null, null, items.length]} castShadow={castShadow} receiveShadow={receiveShadow} material={material}>
      {geometry === "box" && <boxGeometry args={[1, 1, 1]} />}
      {geometry === "crown" && <icosahedronGeometry args={[1, 1]} />}
      {geometry === "cylinder" && <cylinderGeometry args={[0.5, 0.5, 1, 10]} />}
      {!material && (
        <meshStandardMaterial
          color={items[0].color ? "#ffffff" : color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={metalness}
          roughness={roughness}
          transparent={transparent}
          opacity={opacity}
        />
      )}
    </instancedMesh>
  );
}

function buildAcademicBlock() {
  const cells = new Map();
  const key = (i, j) => `${i},${j}`;

  for (let j = 0; j < ROWS; j += 1) {
    for (let i = 0; i < COLS; i += 1) {
      const code = ROOF_MAP[j][i];
      cells.set(key(i, j), {
        i, j,
        x: cellX(i),
        z: cellZ(j),
        h: mainHeight(i, j),
        type: code === "V" ? "void" : code === "L" ? "lawn" : "paver",
        base: isStreet(i, j) ? STREET_SOFFIT : 0,
        street: isStreet(i, j),
        terrace: false,
      });
    }
  }

  const addTerrace = (i, j) => {
    if (cells.has(key(i, j))) return;
    const steps = Math.max(j - (ROWS - 1), 0) + Math.max(i - (COLS - 1), 0);
    const pool = POOL_CELLS.has(key(i, j));
    cells.set(key(i, j), {
      i, j,
      x: cellX(i),
      z: cellZ(j),
      h: pool ? 0.55 : Math.max(0.45, quantize(4.6 - steps * 0.62 - (hash(i, j) > 0.7 ? 0.3 : 0))),
      type: pool ? "pool" : hash(i, j, 3) > 0.06 ? "lawn" : "paver",
      base: 0,
      street: false,
      terrace: true,
    });
  };
  Object.entries(TERRACE_ROWS).forEach(([row, [from, to]]) => {
    for (let i = from; i <= to; i += 1) addTerrace(i, Number(row));
  });
  Object.entries(TERRACE_SIDE).forEach(([column, [from, to]]) => {
    for (let j = from; j <= to; j += 1) addTerrace(Number(column), j);
  });

  // Raised classroom volumes that punch above the stepping roof.
  cells.forEach((cell) => {
    if (cell.terrace || cell.street || cell.type !== "paver") return;
    if (cell.i < 1 || cell.j < 1 || cell.i > COLS - 2 || cell.j > ROWS - 2) return;
    if ((cell.i * 7 + cell.j * 11) % 23 === 0) {
      cell.h += 3.15;
      cell.raised = true;
    }
  });

  const solid = (cell) => cell && cell.type !== "void" && cell.type !== "pool";
  const columns = [];
  const soffits = [];
  const soffitLights = [];
  const pavers = [];
  const lawns = [];
  const rims = [];
  const steps = [];
  const frames = [];
  const glass = [];
  const courtyardFloors = [];
  const planters = [];
  const shrubs = [];
  const trees = [];
  const water = [];
  const raisedGlass = [];
  const streetGlass = [];

  const faceOffset = (side, distance) => (side.axis === "x" ? [side.sign * distance, 0] : [0, side.sign * distance]);
  const edgeScale = (side, length, height, thickness) => (side.axis === "x" ? [thickness, height, length] : [length, height, thickness]);

  cells.forEach((cell) => {
    const { x, z, h, i, j } = cell;
    if (cell.type === "void") {
      courtyardFloors.push({ position: [x, 0.08, z], scale: [PRESTIGE_CELL, 0.16, PRESTIGE_CELL] });
      if (hash(i, j, 5) > 0.45) {
        planters.push({ position: [x, 0.45, z], scale: [2.2, 0.7, 2.2] });
        shrubs.push({ position: [x, 1.1, z], scale: [1.1, 0.7, 1.1] });
      }
      if (hash(i, j, 6) > 0.72) trees.push({ x, z, y: 0.2, scale: 0.9 });
      return;
    }
    if (cell.type === "pool") {
      water.push({ position: [x, 0.42, z], scale: [PRESTIGE_CELL + 0.02, 0.12, PRESTIGE_CELL + 0.02] });
      return;
    }

    const base = cell.base;
    columns.push({ position: [x, (h + base) / 2, z], scale: [PRESTIGE_CELL + 0.002, h - base, PRESTIGE_CELL + 0.002] });
    if (cell.street) {
      soffits.push({ position: [x, base - 0.2, z], scale: [PRESTIGE_CELL, 0.4, PRESTIGE_CELL] });
      soffitLights.push({ position: [x, base - 0.42, z], scale: [2.6, 0.06, 0.32] });
    }

    const topInset = PRESTIGE_CELL - 0.62;
    (cell.type === "lawn" ? lawns : pavers).push({ position: [x, h + 0.06, z], scale: [topInset, 0.12, topInset] });
    if (cell.type === "lawn" && hash(i, j, 2) > 0.35) {
      shrubs.push({ position: [x + (hash(i, j, 8) - 0.5) * 2, h + 0.55, z + (hash(i, j, 9) - 0.5) * 2], scale: [0.75, 0.55, 0.75] });
    }
    if (cell.type === "lawn" && !cell.terrace && hash(i, j, 4) > 0.8) trees.push({ x, z, y: h, scale: 0.55 });
    if (cell.terrace && cell.type === "lawn" && hash(i, j, 4) > 0.86) trees.push({ x, z, y: h, scale: 0.5 });

    SIDES.forEach((side, sideIndex) => {
      const neighbour = cells.get(key(i + side.di, j + side.dj));
      const neighbourHeight = solid(neighbour) ? neighbour.h : neighbour?.type === "pool" ? 0.42 : 0;
      const drop = h - neighbourHeight;
      if (drop <= 0.25) return;
      const [ox, oz] = faceOffset(side, PRESTIGE_CELL / 2 - 0.16);
      const stairCandidate = solid(neighbour) && drop <= 2.5 && !neighbour.street && hash(i, j, sideIndex) < 0.34;

      if (stairCandidate) {
        const gap = 1.5;
        const pieceLength = (PRESTIGE_CELL - gap) / 2;
        const shift = gap / 2 + pieceLength / 2;
        [-1, 1].forEach((direction) => {
          const along = side.axis === "x" ? [0, direction * shift] : [direction * shift, 0];
          rims.push({ position: [x + ox + along[0], h + 0.45, z + oz + along[1]], scale: edgeScale(side, pieceLength, 0.9, 0.32) });
        });
        const count = Math.max(2, Math.round(drop / 0.3));
        for (let step = 0; step < count; step += 1) {
          const top = neighbourHeight + drop * (count - step) / count;
          const distance = PRESTIGE_CELL / 2 + 0.17 + step * 0.32;
          const [sx, sz] = faceOffset(side, distance);
          steps.push({
            position: [x + sx, (neighbourHeight + top) / 2, z + sz],
            scale: edgeScale(side, gap - 0.1, top - neighbourHeight, 0.34),
          });
        }
      } else {
        rims.push({ position: [x + ox, h + 0.45, z + oz], scale: edgeScale(side, PRESTIGE_CELL, 0.9, 0.32) });
      }

      // Deep-set punched windows onto courtyards; glazing onto large level drops.
      if (neighbour?.type === "void") {
        for (let floor = 0; floor < 7; floor += 1) {
          const y = 2.5 + floor * 4.2;
          if (y + 1.4 > h - 0.8 || hash(i, j, sideIndex * 10 + floor) < 0.3) continue;
          const large = hash(i, j, floor + 40) > 0.5;
          const width = large ? 2.5 : 1.5;
          const height = large ? 2.4 : 1.5;
          const [fx, fz] = faceOffset(side, PRESTIGE_CELL / 2 + 0.12);
          const along = (hash(i, j, floor + 60) - 0.5) * 1.2;
          const shiftAlong = side.axis === "x" ? [0, along] : [along, 0];
          frames.push({ position: [x + fx + shiftAlong[0], y, z + fz + shiftAlong[1]], scale: edgeScale(side, width + 0.36, height + 0.36, 0.42) });
          const [gx, gz] = faceOffset(side, PRESTIGE_CELL / 2 + 0.34);
          glass.push({ position: [x + gx + shiftAlong[0], y, z + gz + shiftAlong[1]], scale: edgeScale(side, width, height, 0.06) });
        }
      } else if (solid(neighbour) && drop >= 3) {
        const [gx, gz] = faceOffset(side, PRESTIGE_CELL / 2 + 0.06);
        const glazingHeight = Math.min(drop - 1.1, 3.6);
        raisedGlass.push({ position: [x + gx, neighbourHeight + 0.35 + glazingHeight / 2, z + gz], scale: edgeScale(side, PRESTIGE_CELL - 0.9, glazingHeight, 0.08) });
      }
    });

    if (cell.street) {
      SIDES.forEach((side) => {
        const neighbour = cells.get(key(i + side.di, j + side.dj));
        if (!neighbour || neighbour.street || neighbour.type === "void" || neighbour.terrace) return;
        const [gx, gz] = faceOffset(side, PRESTIGE_CELL / 2 - 0.02);
        streetGlass.push({ position: [x + gx, STREET_SOFFIT / 2 + 0.1, z + gz], scale: edgeScale(side, PRESTIGE_CELL - 0.25, STREET_SOFFIT - 0.6, 0.1) });
      });
    }
  });

  const streetPath = [];
  for (let j = ROWS - 1; j >= 0; j -= 1) {
    const c = streetColumn(j);
    streetPath.push({ position: [(cellX(c) + cellX(c + 1)) / 2, 0.06, cellZ(j)], scale: [PRESTIGE_CELL * 2, 0.12, PRESTIGE_CELL + 0.02] });
  }

  return {
    cells, columns, soffits, soffitLights, pavers, lawns, rims, steps, frames, glass,
    courtyardFloors, planters, shrubs, trees, water, raisedGlass, streetGlass, streetPath,
  };
}

function TreeCluster({ trees }) {
  const trunks = useMemo(() => trees.map((tree) => ({ position: [tree.x, tree.y + 1.4 * tree.scale, tree.z], scale: [0.5 * tree.scale, 2.8 * tree.scale, 0.5 * tree.scale] })), [trees]);
  const crowns = useMemo(() => trees.map((tree, index) => ({ position: [tree.x, tree.y + 3.6 * tree.scale, tree.z], scale: [2.3 * tree.scale, 2 * tree.scale, 2.3 * tree.scale], color: index % 3 ? "#3f7a37" : "#4f8a3c" })), [trees]);
  return (
    <>
      <Instances items={trunks} geometry="cylinder" color="#6b4b31" roughness={1} />
      <Instances items={crowns} geometry="crown" roughness={1} />
    </>
  );
}

export function PrestigeAcademicBlock({ building, selected, onSelect }) {
  const [name, , x, z, , , , rotation = 0] = building;
  const block = useMemo(() => buildAcademicBlock(), []);
  const brick = useMemo(() => createBrickMaterial(), []);
  const darkBrick = useMemo(() => createBrickMaterial({ color: BRICK_DARK }), []);

  const isSelected = selected === name;
  const apex = mainHeight(0, 0);

  return (
    <group
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(name);
      }}
    >
      {/* Plinth and landscaped forecourt */}
      <mesh position={[0, 0.04, 2]} receiveShadow>
        <boxGeometry args={[HALF_W * 2 + 14, 0.08, HALF_D * 2 + 16]} />
        <meshStandardMaterial color="#d2cbbc" roughness={0.95} />
      </mesh>

      <Instances items={block.columns} material={brick} />
      <Instances items={block.rims} material={darkBrick} />
      <Instances items={block.steps} material={darkBrick} />
      <Instances items={block.pavers} color={PAVER} roughness={0.92} />
      <Instances items={block.lawns} color={LAWN} roughness={1} />
      <Instances items={block.shrubs} geometry="crown" color="#4d7f36" roughness={1} />
      <TreeCluster trees={block.trees} />

      {/* Courtyards cut through to ground */}
      <Instances items={block.courtyardFloors} color="#bdb6a6" roughness={0.9} castShadow={false} />
      <Instances items={block.planters} color={CONCRETE} roughness={0.85} />
      <Instances items={block.frames} color={CONCRETE} roughness={0.8} />
      <Instances items={block.glass} color={GLASS} emissive="#f2c27a" emissiveIntensity={0.08} metalness={0.4} roughness={0.18} castShadow={false} />
      <Instances items={block.raisedGlass} color="#2a4450" emissive="#f2c27a" emissiveIntensity={0.06} metalness={0.45} roughness={0.15} castShadow={false} />

      {/* Double-height diagonal indoor street */}
      <Instances items={block.streetPath} color="#cfc8ba" roughness={0.45} castShadow={false} />
      <Instances items={block.soffits} color="#9c9890" roughness={0.85} />
      <Instances items={block.soffitLights} color="#fff4dc" emissive="#ffe2a8" emissiveIntensity={0.9} castShadow={false} />
      <Instances items={block.streetGlass} color="#2e4a55" emissive="#f6d9a2" emissiveIntensity={0.12} metalness={0.35} roughness={0.12} transparent opacity={0.78} castShadow={false} />

      {/* Stepped pool within the outdoor terraces */}
      <Instances items={block.water} color="#2a7fb8" emissive="#0b3d63" emissiveIntensity={0.25} metalness={0.3} roughness={0.08} castShadow={false} />

      {/* Rooftop weather station at the 29.4 m apex */}
      <group position={[cellX(0), apex + 0.9, cellZ(0)]}>
        <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.08, 0.1, 4.8, 6]} /><meshStandardMaterial color="#e3e1da" metalness={0.6} /></mesh>
        <mesh position={[0, 4.9, 0]}><sphereGeometry args={[0.32, 10, 8]} /><meshStandardMaterial color="#f4f2ec" /></mesh>
        <mesh position={[0.9, 3.6, 0]}><boxGeometry args={[1.4, 0.06, 0.8]} /><meshStandardMaterial color="#1b4b70" metalness={0.6} /></mesh>
      </group>

      {/* Entrance portal signage */}
      <Html position={[cellX(12), STREET_SOFFIT + 1.1, HALF_D + 0.3]} center transform distanceFactor={11}>
        <div className="regional-building-sign">PRESTIGE UNIVERSITY</div>
      </Html>

      <Html position={[-HALF_W * 0.55, apex + 7, -HALF_D * 0.6]} center distanceFactor={135}>
        <button className={`regional-label ${isSelected ? "is-selected" : ""}`} onClick={() => onSelect(name)}>
          {name}
        </button>
      </Html>
      {isSelected && <Sparkles count={60} scale={[HALF_W * 2, 26, HALF_D * 2]} position={[0, 15, 0]} color="#ffb067" />}
    </group>
  );
}

/* Hostel towers seen behind the academic block. Both variants share one massing:
 * a double-height glazed podium between brick piers, a residential slab, a
 * parapeted roof with a stair room and tanks, and a landscaped forecourt.
 * - "concrete": exposed white-concrete frame over recessed brick infill and
 *   glass-railed loggias, with a terracotta jali stair core.
 * - "terracotta": brick slab with framed windows and chajjas, stacked balconies
 *   in colour-framed bays, and a taller rendered service wing with brick fins. */
const HOSTEL_FLOOR = 3.3;
const HOSTEL_PODIUM = 4.2;
const HOSTEL_CONCRETE = "#dcd6ca";
const HOSTEL_RENDER = "#e6dece";
const HOSTEL_ACCENTS = ["#e3a73a", "#d9692f", "#3f7db8"];

export function PrestigeHostelTower({ building, selected, onSelect, proposalVisible = true, variant = "terracotta" }) {
  const [name, , x, z, width, depth, floors, rotation = 0] = building;
  const isConcrete = variant === "concrete";
  const halfW = width / 2;
  const halfD = depth / 2;
  const roof = HOSTEL_PODIUM + (floors - 1) * HOSTEL_FLOOR;
  const wingWidth = isConcrete ? 0 : width * 0.34;
  const wingDepth = depth - 1.5;
  const wingTop = roof + 2.6;
  const mainWidth = width - wingWidth;
  const mainX = -halfW + mainWidth / 2;
  const wingX = halfW - wingWidth / 2;
  const brick = useMemo(() => createBrickMaterial({ half: [999, 999] }), []);
  const jali = useMemo(() => createBrickMaterial({ jaliEverywhere: true, half: [999, 999] }), []);

  const facade = useMemo(() => {
    const out = { lit: [], dark: [], frames: [], bands: [], slabs: [], railGlass: [], rails: [], fins: [], columns: [], piers: [], mullions: [] };
    // Long faces run along x (axis "z"), short faces along z (axis "x").
    const onFace = (axis, sign, along, y, offset, w, h, t) => (axis === "z"
      ? { position: [along, y, sign * offset], scale: [w, h, t] }
      : { position: [sign * offset, y, along], scale: [t, h, w] });
    const glaze = (item, seed) => (hash(...seed) > 0.6 ? out.lit : out.dark).push(item);
    const framedWindow = (axis, sign, along, y0, wall, seed) => {
      out.frames.push({ ...onFace(axis, sign, along, y0 + 1.65, wall + 0.1, 2.15, 2.05, 0.3), color: HOSTEL_CONCRETE });
      out.frames.push({ ...onFace(axis, sign, along, y0 + 2.85, wall + 0.32, 2.5, 0.12, 0.62), color: HOSTEL_CONCRETE });
      glaze(onFace(axis, sign, along, y0 + 1.65, wall + 0.27, 1.7, 1.6, 0.04), seed);
    };

    // Podium: brick piers and mullions in front of the lobby glazing.
    const piers = Math.round(width / 5);
    [-1, 1].forEach((face) => {
      for (let index = 0; index <= piers; index += 1) {
        out.piers.push(onFace("z", face, -halfW + 0.4 + index * ((width - 0.8) / piers), HOSTEL_PODIUM / 2, halfD - 0.4, 0.8, HOSTEL_PODIUM, 0.8));
      }
      for (let px = -halfW + 1.6; px < halfW - 1; px += 1.6) {
        out.mullions.push(onFace("z", face, px, HOSTEL_PODIUM / 2, halfD - 0.94, 0.08, HOSTEL_PODIUM - 0.4, 0.08));
      }
    });

    if (isConcrete) {
      const bays = Math.max(5, Math.round(width / 4.2));
      const bayW = width / bays;
      const sideBays = Math.max(3, Math.round(depth / 4.5));
      const sideW = depth / sideBays;
      const frameHeight = roof - HOSTEL_PODIUM + 0.4;
      [-1, 1].forEach((face) => {
        for (let index = 0; index <= bays; index += 1) {
          out.columns.push(onFace("z", face, -halfW + 0.35 + index * ((width - 0.7) / bays), HOSTEL_PODIUM + frameHeight / 2, halfD - 0.35, 0.7, frameHeight, 0.7));
        }
        for (let index = 1; index < sideBays; index += 1) {
          if (face < 0 && Math.abs(-halfD + index * sideW) < 3.6) continue;
          out.columns.push(onFace("x", face, -halfD + index * sideW, HOSTEL_PODIUM + frameHeight / 2, halfW - 0.35, 0.7, frameHeight, 0.7));
        }
      });
      for (let floor = 0; floor < floors - 1; floor += 1) {
        const y0 = HOSTEL_PODIUM + floor * HOSTEL_FLOOR;
        out.bands.push({ position: [0, y0, 0], scale: [width + 0.3, 0.36, depth + 0.3] });
        [-1, 1].forEach((face) => {
          for (let bay = 0; bay < bays; bay += 1) {
            const px = -halfW + (bay + 0.5) * bayW;
            glaze(onFace("z", face, px, y0 + 1.4, halfD - 0.57, bayW - 1.3, 2.1, 0.04), [floor, bay, face]);
            out.railGlass.push(onFace("z", face, px, y0 + 0.68, halfD - 0.12, bayW - 0.75, 0.95, 0.03));
            out.rails.push(onFace("z", face, px, y0 + 1.18, halfD - 0.12, bayW - 0.75, 0.07, 0.07));
          }
          for (let bay = 0; bay < sideBays; bay += 1) {
            const pz = -halfD + (bay + 0.5) * sideW;
            if (face < 0 && Math.abs(pz) < 3.6) continue;
            glaze(onFace("x", face, pz, y0 + 1.5, halfW - 0.57, sideW - 1.6, 1.8, 0.04), [floor, bay, face + 5]);
          }
        });
      }
    } else {
      const bays = Math.max(4, Math.round(mainWidth / 3.9));
      const bayW = mainWidth / bays;
      const sideBays = Math.max(3, Math.round(depth / 4.2));
      const sideW = depth / sideBays;
      const wingBays = Math.max(2, Math.round(wingWidth / 3.4));
      const wingBayW = wingWidth / wingBays;
      const finHeight = wingTop - HOSTEL_PODIUM;
      [-1, 1].forEach((face) => {
        for (let index = 0; index <= wingBays; index += 1) {
          out.fins.push(onFace("z", face, wingX - wingWidth / 2 + 0.16 + index * ((wingWidth - 0.32) / wingBays), HOSTEL_PODIUM + finHeight / 2, wingDepth / 2 + 0.37, 0.32, finHeight, 0.75));
        }
      });
      for (let floor = 0; floor < floors - 1; floor += 1) {
        const y0 = HOSTEL_PODIUM + floor * HOSTEL_FLOOR;
        out.bands.push({ position: [mainX, y0, 0], scale: [mainWidth + 0.18, 0.24, depth + 0.18] });
        [-1, 1].forEach((face) => {
          for (let bay = 0; bay < bays; bay += 1) {
            const px = mainX - mainWidth / 2 + (bay + 0.5) * bayW;
            // Balconies stack in alternating bays; each stack keeps one frame colour.
            if ((bay + (face > 0 ? 0 : 1)) % 2 === 0) {
              const color = HOSTEL_ACCENTS[(Math.floor(bay / 2) + (face > 0 ? 0 : 2)) % HOSTEL_ACCENTS.length];
              out.frames.push({ ...onFace("z", face, px, y0 + 1.45, halfD, 2.55, 2.75, 0.22), color });
              glaze(onFace("z", face, px, y0 + 1.35, halfD + 0.12, 2.0, 2.3, 0.04), [floor, bay, face]);
              out.slabs.push(onFace("z", face, px, y0 + 0.1, halfD + 0.65, bayW - 0.5, 0.2, 1.3));
              out.railGlass.push(onFace("z", face, px, y0 + 0.7, halfD + 1.27, bayW - 0.5, 0.95, 0.04));
              out.rails.push(onFace("z", face, px, y0 + 1.2, halfD + 1.27, bayW - 0.5, 0.07, 0.07));
            } else {
              framedWindow("z", face, px, y0, halfD, [floor, bay, face]);
            }
          }
          for (let bay = 0; bay < wingBays; bay += 1) {
            const px = wingX - wingWidth / 2 + (bay + 0.5) * wingBayW;
            glaze(onFace("z", face, px, y0 + 1.65, wingDepth / 2 + 0.03, wingBayW - 1.3, 1.6, 0.04), [floor, bay + 20, face]);
          }
          for (let bay = 0; bay < sideBays; bay += 1) {
            const pz = -halfD + (bay + 0.5) * sideW;
            if (face < 0) framedWindow("x", -1, pz, y0, halfW, [floor, bay, 9]);
            else if (Math.abs(pz) < wingDepth / 2 - 1) glaze(onFace("x", 1, pz, y0 + 1.65, halfW + 0.03, sideW - 1.6, 1.6, 0.04), [floor, bay, 11]);
          }
        });
      }
    }
    return out;
  }, [depth, floors, halfD, halfW, isConcrete, mainWidth, mainX, roof, width, wingDepth, wingTop, wingWidth, wingX]);

  // Low-tilt PV rows on frames that stay behind the parapet line.
  const roofSolar = useMemo(() => {
    const panels = [];
    const rails = [];
    const addArray = (x0, x1, z0, z1, base) => {
      const columns = Math.floor((x1 - x0) / 2.15);
      const rows = Math.floor((z1 - z0) / 2.3);
      const startX = (x0 + x1) / 2 - ((columns - 1) * 2.15) / 2;
      const startZ = (z0 + z1) / 2 - ((rows - 1) * 2.3) / 2;
      for (let row = 0; row < rows; row += 1) {
        const pz = startZ + row * 2.3;
        rails.push({ position: [(x0 + x1) / 2, base + 0.18, pz], scale: [columns * 2.15, 0.14, 0.14] });
        for (let column = 0; column < columns; column += 1) {
          panels.push({ position: [startX + column * 2.15, base + 0.5, pz], rotation: [-0.26, 0, 0], scale: [2.0, 0.08, 1.3] });
        }
      }
    };
    const clearFrom = -halfW + 8.5;
    if (isConcrete) {
      addArray(clearFrom, halfW - 1, -halfD + 1, halfD - 1, roof);
    } else {
      addArray(clearFrom, halfW - wingWidth - 0.5, -halfD + 1, halfD - 1, roof);
      addArray(wingX - wingWidth / 2 + 0.6, halfW - 0.4, -wingDepth / 2 + 0.6, wingDepth / 2 - 0.6, wingTop + 0.15);
    }
    return { panels, rails };
  }, [halfD, halfW, isConcrete, roof, wingDepth, wingTop, wingWidth, wingX]);

  const grounds = useMemo(() => {
    const lawnWidth = halfW - 1.5;
    const lawnX = 3.5 + lawnWidth / 2;
    const front = halfD + 7;
    const lawns = [];
    const hedges = [];
    const trees = [];
    const benches = [];
    const bollards = [];
    [-1, 1].forEach((side) => {
      lawns.push({ position: [side * lawnX, 0.17, front], scale: [lawnWidth, 0.1, 10] });
      hedges.push({ position: [side * lawnX, 0.5, front + 5.2], scale: [lawnWidth, 0.7, 0.7] });
      hedges.push({ position: [side * 3.85, 0.45, front + 0.4], scale: [0.6, 0.6, 8.6] });
      trees.push({ x: side * (3.5 + lawnWidth * 0.3), z: front + 1.5, y: 0.2, scale: 1 });
      trees.push({ x: side * (3.5 + lawnWidth * 0.78), z: front - 2.5, y: 0.2, scale: 0.85 });
      benches.push({ position: [side * 4.9, 0.42, front - 1], scale: [0.6, 0.45, 2.0] });
      for (let index = 0; index < 4; index += 1) {
        bollards.push({ position: [side * 3.2, 0.6, halfD + 3 + index * 2.8], scale: [0.18, 0.9, 0.18] });
      }
    });
    const bikes = Array.from({ length: 9 }, (_, index) => ({
      position: [halfW + 3, 0.62, -3.6 + index * 0.9],
      scale: [1.7, 0.95, 0.12],
      color: ["#2d4f7c", "#b33a2e", "#2f3336", "#d9a52f"][index % 4],
    }));
    return { lawns, hedges, trees, benches, bollards, bikes };
  }, [halfD, halfW]);

  const roofWidth = isConcrete ? width : mainWidth;
  const roofX = isConcrete ? 0 : mainX;
  const parapet = useMemo(() => [
    { position: [roofX, roof + 0.55, halfD - 0.125], scale: [roofWidth, 1.1, 0.25] },
    { position: [roofX, roof + 0.55, -halfD + 0.125], scale: [roofWidth, 1.1, 0.25] },
    { position: [roofX - roofWidth / 2 + 0.125, roof + 0.55, 0], scale: [0.25, 1.1, depth] },
    ...(isConcrete ? [{ position: [halfW - 0.125, roof + 0.55, 0], scale: [0.25, 1.1, depth] }] : []),
  ], [depth, halfD, halfW, isConcrete, roof, roofWidth, roofX]);
  const isSelected = selected === name;

  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]} onClick={(event) => { event.stopPropagation(); onSelect(name); }}>
      <mesh position={[0, 0.06, 4]} receiveShadow>
        <boxGeometry args={[width + 12, 0.12, depth + 18]} />
        <meshStandardMaterial color="#cdc6b6" roughness={0.95} />
      </mesh>

      {/* Double-height glazed lobby behind brick piers */}
      <mesh position={[0, HOSTEL_PODIUM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width - 2, HOSTEL_PODIUM, depth - 2]} />
        <meshStandardMaterial color="#34444b" metalness={0.35} roughness={0.2} emissive="#f2d3a0" emissiveIntensity={0.16} />
      </mesh>
      <Instances items={facade.piers} material={brick} />
      <Instances items={facade.mullions} color="#2b3236" metalness={0.5} roughness={0.4} castShadow={false} />
      <mesh position={[0, HOSTEL_PODIUM, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.5, 0.45, depth + 0.5]} />
        <meshStandardMaterial color={HOSTEL_CONCRETE} roughness={0.85} />
      </mesh>

      {isConcrete ? (
        <>
          {/* Recessed brick infill inside the exposed frame */}
          <mesh position={[0, (HOSTEL_PODIUM + roof) / 2, 0]} castShadow receiveShadow material={brick}>
            <boxGeometry args={[width - 1.2, roof - HOSTEL_PODIUM, depth - 1.2]} />
          </mesh>
          <Instances items={facade.columns} color={HOSTEL_CONCRETE} roughness={0.85} />
          <mesh position={[-halfW - 2.4, (roof + 3) / 2, 0]} castShadow receiveShadow material={jali}>
            <boxGeometry args={[4.8, roof + 3, 7]} />
          </mesh>
          <mesh position={[-halfW - 2.4, roof + 3.1, 0]} castShadow>
            <boxGeometry args={[5.2, 0.3, 7.4]} />
            <meshStandardMaterial color={HOSTEL_CONCRETE} roughness={0.85} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[mainX, (HOSTEL_PODIUM + roof) / 2, 0]} castShadow receiveShadow material={brick}>
            <boxGeometry args={[mainWidth, roof - HOSTEL_PODIUM, depth]} />
          </mesh>
          <mesh position={[wingX, (HOSTEL_PODIUM + wingTop) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[wingWidth, wingTop - HOSTEL_PODIUM, wingDepth]} />
            <meshStandardMaterial color={HOSTEL_RENDER} roughness={0.9} />
          </mesh>
          <Instances items={facade.fins} material={brick} />
          <mesh position={[wingX, wingTop + 0.15, 0]} castShadow>
            <boxGeometry args={[wingWidth + 0.3, 0.3, wingDepth + 1.7]} />
            <meshStandardMaterial color={HOSTEL_CONCRETE} roughness={0.85} />
          </mesh>
        </>
      )}

      <Instances items={facade.bands} color={HOSTEL_CONCRETE} roughness={0.85} />
      <Instances items={facade.frames} roughness={0.7} />
      <Instances items={facade.slabs} color={HOSTEL_CONCRETE} roughness={0.85} />
      <Instances items={facade.dark} color="#223139" emissive="#f4cf8f" emissiveIntensity={0.04} metalness={0.4} roughness={0.15} castShadow={false} />
      <Instances items={facade.lit} color="#38444a" emissive="#ffcf8a" emissiveIntensity={0.06} metalness={0.3} roughness={0.2} castShadow={false} />
      <Instances items={facade.railGlass} color="#a9c6cf" metalness={0.2} roughness={0.1} transparent opacity={0.4} castShadow={false} />
      <Instances items={facade.rails} color="#3a4044" metalness={0.6} roughness={0.35} castShadow={false} />

      {/* Roof: parapet, stair room with water tanks, PV rows */}
      <Instances items={parapet} color={HOSTEL_CONCRETE} roughness={0.85} />
      <mesh position={[roofX, roof + 0.04, 0]} receiveShadow>
        <boxGeometry args={[roofWidth - 0.5, 0.08, depth - 0.5]} />
        <meshStandardMaterial color="#bab4a7" roughness={0.95} />
      </mesh>
      {isConcrete ? (
        <mesh position={[-halfW + 4.3, roof + 1.5, -depth * 0.15]} castShadow receiveShadow>
          <boxGeometry args={[6, 3, 6.5]} />
          <meshStandardMaterial color={HOSTEL_CONCRETE} roughness={0.85} />
        </mesh>
      ) : (
        <mesh position={[-halfW + 4.3, roof + 1.5, -depth * 0.15]} castShadow receiveShadow material={brick}>
          <boxGeometry args={[6, 3, 6.5]} />
        </mesh>
      )}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-halfW + 4.3 + side * 1.4, roof + 3.8, -depth * 0.15]} castShadow>
          <cylinderGeometry args={[0.95, 0.95, 1.6, 16]} />
          <meshStandardMaterial color="#2d3134" roughness={0.6} />
        </mesh>
      ))}
      {proposalVisible && (
        <>
          <Instances items={roofSolar.panels} color="#173f63" metalness={0.72} roughness={0.2} castShadow={false} />
          <Instances items={roofSolar.rails} color="#9aa0a3" metalness={0.6} roughness={0.4} castShadow={false} />
        </>
      )}

      {/* Entrance canopy, steps and signage */}
      <mesh position={[0, 3.7, halfD + 2.3]} castShadow>
        <boxGeometry args={[9, 0.3, 4.6]} />
        <meshStandardMaterial color={HOSTEL_CONCRETE} roughness={0.7} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 4.2, 1.8, halfD + 4.3]} castShadow>
          <boxGeometry args={[0.25, 3.6, 0.25]} />
          <meshStandardMaterial color="#3a4044" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, halfD + 0.8]} receiveShadow>
        <boxGeometry args={[7, 0.18, 1.4]} />
        <meshStandardMaterial color={HOSTEL_CONCRETE} roughness={0.9} />
      </mesh>
      <Html position={[0, 4.15, halfD + 4.62]} center transform distanceFactor={11}>
        <div className="regional-building-sign">{name.toUpperCase()}</div>
      </Html>

      {/* Landscaped forecourt */}
      <mesh position={[0, 0.15, halfD + 6.5]} receiveShadow>
        <boxGeometry args={[7, 0.06, 12.5]} />
        <meshStandardMaterial color="#e5dfd1" roughness={0.9} />
      </mesh>
      <Instances items={grounds.lawns} color={LAWN} roughness={1} castShadow={false} />
      <Instances items={grounds.hedges} color="#4d7f36" roughness={1} />
      <Instances items={grounds.benches} color="#8a6142" roughness={0.9} />
      <Instances items={grounds.bollards} geometry="cylinder" color="#f4ecd8" emissive="#ffe2a8" emissiveIntensity={0.4} castShadow={false} />
      <Instances items={grounds.bikes} roughness={0.5} metalness={0.4} castShadow={false} />
      <mesh position={[0, 0.35, -halfD - 1.4]} castShadow receiveShadow>
        <boxGeometry args={[width - 2, 0.6, 1.4]} />
        <meshStandardMaterial color={HOSTEL_CONCRETE} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.8, -halfD - 1.4]}>
        <boxGeometry args={[width - 2.6, 0.5, 1]} />
        <meshStandardMaterial color="#4d7f36" roughness={1} />
      </mesh>
      <TreeCluster trees={grounds.trees} />

      <Html position={[0, roof + 9, 0]} center distanceFactor={125}>
        <button className={`regional-label ${isSelected ? "is-selected" : ""}`} onClick={() => onSelect(name)}>{name}</button>
      </Html>
      {isSelected && <Sparkles count={30} scale={[width, roof, depth]} position={[0, roof / 2, 0]} color="#ffb067" />}
    </group>
  );
}

export function PrestigeSportsArena({ building, selected, onSelect }) {
  const [name, , x, z] = building;
  const pitch = { x: 0, z: -25, w: 64, d: 100 };
  const lines = useMemo(() => {
    const y = 0.32;
    const hw = pitch.w / 2 - 3;
    const hd = pitch.d / 2 - 3;
    const box = (x0, z0, x1, z1) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [x0, y, z0]];
    const circle = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return [Math.cos(angle) * 9, y, Math.sin(angle) * 9];
    });
    return [
      box(-hw, -hd, hw, hd),
      [[-hw, y, 0], [hw, y, 0]],
      circle,
      box(-20, -hd, 20, -hd + 16),
      box(-20, hd - 16, 20, hd),
      box(-9, -hd, 9, -hd + 5.5),
      box(-9, hd - 5.5, 9, hd),
    ];
  }, [pitch.d, pitch.w]);

  const courts = [[-16, 50], [16, 50]];
  const isSelected = selected === name;

  return (
    <group position={[x, 0, z]} onClick={(event) => { event.stopPropagation(); onSelect(name); }}>
      <group position={[pitch.x, 0, pitch.z]}>
        <mesh position={[0, 0.14, 0]} receiveShadow>
          <boxGeometry args={[pitch.w, 0.2, pitch.d]} />
          <meshStandardMaterial color="#4c8a3f" roughness={1} />
        </mesh>
        {Array.from({ length: 10 }, (_, index) => (
          <mesh key={index} position={[0, 0.25, -pitch.d / 2 + 5 + index * 10]}>
            <boxGeometry args={[pitch.w - 6, 0.02, 5]} />
            <meshStandardMaterial color="#56963f" roughness={1} />
          </mesh>
        ))}
        {lines.map((points, index) => <Line key={index} points={points} color="#f4f1e6" lineWidth={1.2} />)}
        {[-1, 1].map((end) => (
          <group key={end} position={[0, 0, end * (pitch.d / 2 - 3)]}>
            {[-3.66, 3.66].map((post) => (
              <mesh key={post} position={[post, 1.3, 0]}><boxGeometry args={[0.18, 2.44, 0.18]} /><meshStandardMaterial color="#ffffff" /></mesh>
            ))}
            <mesh position={[0, 2.5, 0]}><boxGeometry args={[7.5, 0.18, 0.18]} /><meshStandardMaterial color="#ffffff" /></mesh>
          </group>
        ))}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
          <group key={`${sx}${sz}`} position={[sx * (pitch.w / 2 + 3), 0, sz * (pitch.d / 2 - 6)]}>
            <mesh position={[0, 11, 0]}><cylinderGeometry args={[0.25, 0.4, 22, 8]} /><meshStandardMaterial color="#9da3a5" metalness={0.5} /></mesh>
            <mesh position={[-sx * 0.6, 22.3, 0]}><boxGeometry args={[1.2, 1.4, 3.2]} /><meshStandardMaterial color="#e8eef0" emissive="#fffbe8" emissiveIntensity={0.35} /></mesh>
          </group>
        ))}
        {/* Spectator steps and pavilion */}
        <group position={[pitch.w / 2 + 9, 0, 0]}>
          {Array.from({ length: 4 }, (_, step) => (
            <mesh key={step} position={[step * 1.3, 0.3 + step * 0.45, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.3, 0.6 + step * 0.9, 38]} />
              <meshStandardMaterial color="#c86a40" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[2.2, 5.6, 0]} castShadow><boxGeometry args={[7, 0.3, 40]} /><meshStandardMaterial color="#e2ddd3" /></mesh>
          {[-18, 0, 18].map((pz) => <mesh key={pz} position={[5.2, 2.8, pz]}><boxGeometry args={[0.3, 5.6, 0.3]} /><meshStandardMaterial color="#8a8a86" /></mesh>)}
        </group>
      </group>

      {courts.map(([cx, cz], index) => (
        <group key={index} position={[cx, 0, cz]}>
          <mesh position={[0, 0.16, 0]} receiveShadow><boxGeometry args={[17, 0.22, 30]} /><meshStandardMaterial color="#2f6f86" roughness={0.75} /></mesh>
          <mesh position={[0, 0.28, 0]}><boxGeometry args={[15, 0.02, 28]} /><meshStandardMaterial color="#3f86a0" roughness={0.75} /></mesh>
          <Line points={[[-7.5, 0.31, 0], [7.5, 0.31, 0]]} color="#f4f1e6" lineWidth={1} />
          {[-1, 1].map((end) => (
            <group key={end} position={[0, 0, end * 13.2]}>
              <mesh position={[0, 1.6, end * 0.6]}><cylinderGeometry args={[0.1, 0.1, 3.2, 6]} /><meshStandardMaterial color="#5d6366" /></mesh>
              <mesh position={[0, 3.3, 0]}><boxGeometry args={[1.8, 1.1, 0.08]} /><meshStandardMaterial color="#f4f4f0" /></mesh>
            </group>
          ))}
        </group>
      ))}

      <Html position={[0, 12, -25]} center distanceFactor={125}>
        <button className={`regional-label ${isSelected ? "is-selected" : ""}`} onClick={() => onSelect(name)}>{name}</button>
      </Html>
      {isSelected && <Sparkles count={30} scale={[70, 10, 130]} position={[0, 4, 0]} color="#ffb067" />}
    </group>
  );
}

/* Site context traced from the ground-floor plan: west car park, angled bays
 * along the diagonal approach road, landscaped forecourt, and the quarried hill
 * that rises behind the campus in the project photographs. The proposed PV is
 * carried on car-park canopies so the stepped brick roof stays untouched. */
export function PrestigeSiteDetails({ academic, roads, diagonal, proposalVisible = true }) {
  const [bx, bz] = academic;
  const parked = useMemo(() => {
    const cars = [];
    const palette = ["#e6e3dc", "#c9372c", "#2e3a44", "#9ea4a8", "#f0f0ea", "#3f6c9a", "#5a5f62"];
    // West car park: two rows of perpendicular bays either side of the access lane.
    for (let index = 0; index < 26; index += 1) {
      const pz = bz - 38 + index * 2.9;
      [-1, 1].forEach((side) => {
        if (hash(index, side) < 0.2) return;
        cars.push({ x: bx - HALF_W - 23 + side * 9, z: pz, yaw: Math.PI / 2, color: palette[(index + side + 7) % palette.length] });
      });
    }
    // Angled bays on the south side of the diagonal approach road.
    const start = new THREE.Vector2(...diagonal[0]);
    const end = new THREE.Vector2(...diagonal[1]);
    const direction = end.clone().sub(start).normalize();
    const normal = new THREE.Vector2(-direction.y, direction.x);
    if (normal.y < 0) normal.multiplyScalar(-1);
    const length = end.distanceTo(start);
    for (let distance = 18; distance < length - 20; distance += 3.4) {
      if (hash(distance, 4) < 0.28) continue;
      const point = start.clone().addScaledVector(direction, distance).addScaledVector(normal, 10.5);
      cars.push({ x: point.x, z: point.y, yaw: Math.atan2(direction.x, direction.y) + Math.PI / 4, color: palette[Math.floor(distance) % palette.length] });
    }
    return cars;
  }, [bx, bz, diagonal]);

  const carports = useMemo(() => {
    const panels = [];
    const posts = [];
    const beams = [];
    // West car park: one canopy over each row of bays, sloping away from the lane.
    [-1, 1].forEach((side) => {
      const cx = bx - HALF_W - 23 + side * 9;
      for (let index = 0; index < 26; index += 1) {
        panels.push({ position: [cx, 3.35, bz - 38 + index * 2.9], rotation: [0, 0, side * 0.12], scale: [6, 0.14, 2.5] });
      }
      for (let index = 0; index < 9; index += 1) {
        posts.push({ position: [cx - side * 1.6, 1.6, bz - 37 + index * 9], scale: [0.22, 3.2, 0.22] });
      }
      beams.push({ position: [cx - side * 1.6, 3.15, bz - 1.75], scale: [0.3, 0.3, 75.5] });
    });
    // Angled bays: a canopy strip following the approach road.
    const start = new THREE.Vector2(...diagonal[0]);
    const end = new THREE.Vector2(...diagonal[1]);
    const direction = end.clone().sub(start).normalize();
    const normal = new THREE.Vector2(-direction.y, direction.x);
    if (normal.y < 0) normal.multiplyScalar(-1);
    const yaw = Math.atan2(direction.x, direction.y);
    const length = end.distanceTo(start);
    for (let distance = 17; distance < length - 19; distance += 3.4) {
      const point = start.clone().addScaledVector(direction, distance).addScaledVector(normal, 10.8);
      panels.push({ position: [point.x, 3.35, point.y], rotation: [0, yaw, 0.12], scale: [6, 0.14, 2.9] });
      if (Math.round(distance / 3.4) % 3 === 0) {
        const post = start.clone().addScaledVector(direction, distance).addScaledVector(normal, 12.4);
        posts.push({ position: [post.x, 1.6, post.y], scale: [0.22, 3.2, 0.22] });
      }
    }
    return { panels, posts, beams };
  }, [bx, bz, diagonal]);

  const carBodies = useMemo(() => parked.map((car) => ({ position: [car.x, 0.75, car.z], rotation: [0, car.yaw, 0], scale: [1.9, 1.05, 4.3], color: car.color })), [parked]);
  const carCabins = useMemo(() => parked.map((car) => ({ position: [car.x, 1.55, car.z], rotation: [0, car.yaw, 0], scale: [1.7, 0.6, 2.3] })), [parked]);

  const lamps = useMemo(() => {
    const items = [];
    roads.forEach((road, roadIndex) => {
      for (let index = 0; index < road.length - 1; index += 1) {
        const a = new THREE.Vector2(...road[index]);
        const b = new THREE.Vector2(...road[index + 1]);
        const length = a.distanceTo(b);
        const direction = b.clone().sub(a).normalize();
        const normal = new THREE.Vector2(-direction.y, direction.x);
        for (let distance = 6; distance < length; distance += 22) {
          const side = (index + roadIndex) % 2 ? 1 : -1;
          const point = a.clone().addScaledVector(direction, distance).addScaledVector(normal, side * 8.2);
          items.push(point);
        }
      }
    });
    return items;
  }, [roads]);
  const lampPoles = useMemo(() => lamps.map((point) => ({ position: [point.x, 3.2, point.y], scale: [0.18, 6.4, 0.18] })), [lamps]);
  const lampHeads = useMemo(() => lamps.map((point) => ({ position: [point.x, 6.5, point.y], scale: [0.7, 0.25, 0.7] })), [lamps]);

  const forecourtBeds = useMemo(() => {
    const beds = [];
    for (let index = 0; index < 7; index += 1) {
      beds.push({ position: [bx - HALF_W + 6 + index * 7.2, 0.35, bz + HALF_D + 8], scale: [5.2, 0.7, 2.4] });
    }
    for (let index = 0; index < 6; index += 1) {
      beds.push({ position: [bx - HALF_W - 5, 0.35, bz - HALF_D + 6 + index * 13], scale: [2.2, 0.7, 9] });
    }
    return beds;
  }, [bx, bz]);

  const hill = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(420, 150, 70, 26);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const px = position.getX(index);
      const pz = position.getZ(index);
      const ridge = Math.max(0, 1 - Math.abs(pz + 10) / 75);
      const swell = 0.75 + 0.25 * Math.sin(px * 0.021) + 0.12 * Math.sin(px * 0.067 + 1.3);
      const fade = Math.min(1, (210 - Math.abs(px)) / 70);
      let height = 36 * Math.pow(ridge, 1.35) * swell * Math.max(0, fade);
      // Quarry benches cut into the near face of the ridge.
      if (px > -60 && px < 70 && pz > 0) height = Math.min(height, Math.floor(height / 6) * 6 + 1.2);
      position.setY(index, height - 0.5);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  return (
    <group>
      {/* West car park surface */}
      <mesh position={[bx - HALF_W - 23, 0.05, bz]} receiveShadow>
        <boxGeometry args={[26, 0.1, 80]} />
        <meshStandardMaterial color="#5d6264" roughness={0.95} />
      </mesh>
      <Instances items={carBodies} roughness={0.35} metalness={0.3} />
      <Instances items={carCabins} color="#1f2c33" roughness={0.2} metalness={0.4} castShadow={false} />
      <Instances items={lampPoles} color="#3b3f42" metalness={0.5} roughness={0.5} castShadow={false} />
      <Instances items={lampHeads} color="#f7f1dd" emissive="#ffe6b0" emissiveIntensity={0.45} castShadow={false} />
      <Instances items={forecourtBeds} color="#4b7a35" roughness={1} />
      {proposalVisible && (
        <>
          <Instances items={carports.panels} color="#21507f" metalness={0.72} roughness={0.22} />
          <Instances items={carports.posts} color="#c9ccc8" metalness={0.6} roughness={0.4} castShadow={false} />
          <Instances items={carports.beams} color="#c9ccc8" metalness={0.6} roughness={0.4} castShadow={false} />
          <Html position={[bx - HALF_W - 23, 9, bz - 20]} center distanceFactor={130}>
            <div className="regional-label">Solar carports • proposed</div>
          </Html>
        </>
      )}

      <mesh geometry={hill} position={[-90, 0, -262]} receiveShadow>
        <meshStandardMaterial color="#76704c" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

/* Main gate: a wave-shaped canopy of stacked terracotta blocks carried on
 * "pixelated" corbel columns that step outward as they rise, with a coffered
 * underside, jali light panels and grey metal fencing between the piers.
 * The tallest arch spans the entry road. */
const GATE_WAVE = [[-31, 5.8], [-22, 6.2], [-13, 8.4], [-5, 13.6], [1, 15.6], [7, 14.4], [15, 11.2], [24, 9.4], [31, 10]];
const GATE_TERRACOTTA = ["#c97a52", "#d0855c", "#c2714a", "#d68f66", "#c67650"];
const GATE_DEPTH = 14;

function gateTop(x) {
  const clamped = Math.min(Math.max(x, GATE_WAVE[0][0]), GATE_WAVE[GATE_WAVE.length - 1][0]);
  for (let index = 0; index < GATE_WAVE.length - 1; index += 1) {
    const [x0, y0] = GATE_WAVE[index];
    const [x1, y1] = GATE_WAVE[index + 1];
    if (clamped <= x1) {
      const s = (1 - Math.cos(Math.PI * ((clamped - x0) / (x1 - x0)))) / 2;
      return y0 + (y1 - y0) * s;
    }
  }
  return GATE_WAVE[GATE_WAVE.length - 1][1];
}

function buildGate() {
  const blocks = [];
  const slabs = [];
  const lights = [];
  const tint = (a, b, c) => GATE_TERRACOTTA[Math.floor(hash(a, b, c) * GATE_TERRACOTTA.length)];
  const rows = 10;
  const rowDepth = GATE_DEPTH / rows;

  // Canopy: one column of blocks per 0.9 m, each block's depth varying to form coffers.
  for (let i = 0; i <= 69; i += 1) {
    const x = -31 + i * 0.9;
    const top = gateTop(x);
    slabs.push({ position: [x, top - 0.75, 0], scale: [0.92, 0.5, GATE_DEPTH - 0.3] });
    for (let k = 0; k < rows; k += 1) {
      const z = -GATE_DEPTH / 2 + (k + 0.5) * rowDepth;
      const fascia = k === 0 || k === rows - 1;
      // Fascia blocks step in a regular rhythm, like the stacked panels of the real canopy.
      const lift = fascia ? [0, 0.18, 0.06][i % 3] : 0;
      const thick = fascia ? 1.6 + [0, 0.35, 0.18, 0.5][i % 4] : 0.9 + ((i + k) % 2) * 0.25;
      blocks.push({ position: [x, top + lift - thick / 2, z], scale: [0.84, thick, rowDepth - 0.08], color: tint(i, k, 3) });
      if (!fascia && hash(i, k, 4) > 0.9) {
        lights.push({ position: [x, top + lift - thick - 0.04, z], scale: [0.7, 0.06, rowDepth - 0.3] });
      }
    }
  }

  // Corbel columns: a pier that steps outward layer by layer until it meets the canopy.
  const columns = [
    { x: -28.5, base: 1.7, grow: 0.3 },
    { x: -8.6, base: 1.3, grow: 0.5 },
    { x: 8.6, base: 1.3, grow: 0.5 },
    { x: 29, base: 1.6, grow: 0.35 },
  ];
  columns.forEach((column, columnIndex) => {
    const ceiling = gateTop(column.x) - 1.2;
    const layerHeight = 0.9;
    for (let layer = 0; layer * layerHeight < ceiling; layer += 1) {
      const y = layer * layerHeight + layerHeight / 2;
      const rise = Math.max(0, y - 3.5) / Math.max(ceiling - 3.5, 1);
      const flare = Math.pow(rise, 1.7);
      const ex = column.base + flare * column.grow * 10;
      const ez = Math.min(GATE_DEPTH / 2 - 0.3, column.base + flare * 6);
      blocks.push({ position: [column.x, y, 0], scale: [ex * 2 - 0.5, layerHeight, ez * 2 - 0.5], color: tint(columnIndex, layer, 9) });
      const ring = (along, length, fixed, axis) => {
        const count = Math.max(2, Math.round(length / 1.0));
        for (let index = 0; index < count; index += 1) {
          const t = -length / 2 + (index + 0.5) * (length / count);
          // Each strip keeps its depth up the column, so blocks read as hanging vertical prisms.
          const out = 0.3 + hash(columnIndex * 31 + index, axis.length, fixed > 3 ? 1 : 0) * 0.45 + (hash(index, layer, columnIndex) > 0.8 ? 0.25 : 0);
          [-1, 1].forEach((sign) => {
            const offset = sign * (fixed - 0.25 + out / 2);
            blocks.push(axis === "z"
              ? { position: [along + t, y, offset], scale: [0.96, layerHeight - 0.06, out], color: tint(index, layer, columnIndex + sign) }
              : { position: [along + offset, y, t], scale: [out, layerHeight - 0.06, 0.96], color: tint(index, layer, columnIndex - sign + 7) });
          });
        }
      };
      ring(column.x, ex * 2, ez, "z");
      ring(column.x, ez * 2, ex, "x");
    }
  });

  return { blocks, slabs, lights, columns };
}

export function PrestigeGate() {
  const gate = useMemo(() => buildGate(), []);
  const fence = useMemo(() => {
    const panels = [];
    const posts = [];
    const runs = [[-56, -30.5, -1], [30.5, 56, -1], [-26.5, -10.5, -3.5], [10.5, 27, -3.5]];
    runs.forEach(([from, to, z]) => {
      panels.push({ position: [(from + to) / 2, 1.3, z], scale: [to - from, 2.4, 0.12] });
      for (let px = from; px <= to + 0.01; px += 2.6) posts.push({ position: [px, 1.4, z], scale: [0.16, 2.8, 0.2] });
    });
    const slats = [];
    runs.forEach(([from, to, z]) => {
      for (let px = from + 0.3; px < to; px += 0.35) slats.push({ position: [px, 1.3, z + 0.1], scale: [0.06, 2.3, 0.06] });
    });
    return { panels, posts, slats };
  }, []);

  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 31, 0.1, 0]} receiveShadow>
          <boxGeometry args={[50, 0.2, GATE_DEPTH + 6]} />
          <meshStandardMaterial color="#c9c1ae" roughness={0.95} />
        </mesh>
      ))}

      <Instances items={gate.slabs} color="#8f4a2b" roughness={0.9} castShadow={false} />
      <Instances items={gate.blocks} roughness={0.82} />
      <Instances items={gate.lights} color="#fff1d0" emissive="#ffd28a" emissiveIntensity={0.9} castShadow={false} />

      {/* Fencing between the piers and along the boundary */}
      <Instances items={fence.panels} color="#9ea2a3" metalness={0.4} roughness={0.5} transparent opacity={0.55} castShadow={false} />
      <Instances items={fence.slats} color="#c3c6c6" metalness={0.5} roughness={0.45} castShadow={false} />
      <Instances items={fence.posts} color="#7e8384" metalness={0.5} roughness={0.45} castShadow={false} />

      {/* Guard booth under the low canopy */}
      <mesh position={[-17, 1.5, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 3, 2.8]} />
        <meshStandardMaterial color="#b8643c" roughness={0.85} />
      </mesh>
      <mesh position={[-17, 1.8, 1.92]}>
        <boxGeometry args={[2.4, 1.1, 0.06]} />
        <meshStandardMaterial color="#26363d" emissive="#f4cf8f" emissiveIntensity={0.08} metalness={0.4} roughness={0.2} />
      </mesh>

      {/* Boom barrier across the entry road */}
      <mesh position={[-6.6, 0.55, 3]}><boxGeometry args={[0.5, 1.1, 0.5]} /><meshStandardMaterial color="#3a4044" /></mesh>
      <mesh position={[-1.4, 1.1, 3]}><boxGeometry args={[10.4, 0.16, 0.16]} /><meshStandardMaterial color="#e2483c" /></mesh>

      <Html position={[gate.columns[0].x, 2.6, gate.columns[0].base + 0.75]} center transform distanceFactor={8}>
        <div className="regional-gate-name">PRESTIGE UNIVERSITY</div>
      </Html>
    </group>
  );
}
