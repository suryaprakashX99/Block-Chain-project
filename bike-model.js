// Detailed procedural motorcycle (original design: a classic single-cylinder touring bike).
// Every part is a separate group so the Workshop game can install / remove it,
// and every fastener is a separate bolt object with a spanner size.
//
// Units are metres. +x = front of the bike, +y = up, +z = right-hand side.
import * as THREE from "./three.module.min.js";

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ---------------------------------------------------------------- materials
export function makeMaterials() {
  const paint = c => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  return {
    tank: paint("#5a1e7a"),
    frame: paint("#141218"),
    fenders: paint("#141218"),
    panels: paint("#5a1e7a"),
    rims: new THREE.MeshStandardMaterial({ color: "#d9dbe3", metalness: 1, roughness: 0.18 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#eef0ff", metalness: 1, roughness: 0.1 }),
    alu: new THREE.MeshStandardMaterial({ color: "#b8bcc6", metalness: 0.9, roughness: 0.35 }),
    darkAlu: new THREE.MeshStandardMaterial({ color: "#3a3d46", metalness: 0.8, roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: "#0f0f13", metalness: 0.3, roughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#121214", roughness: 0.92 }),
    leather: new THREE.MeshStandardMaterial({ color: "#2a1d18", roughness: 0.75 }),
    steel: new THREE.MeshStandardMaterial({ color: "#9aa0ab", metalness: 1, roughness: 0.28 }),
    gold: new THREE.MeshStandardMaterial({ color: "#d4a017", metalness: 0.9, roughness: 0.3 }),
    spring: new THREE.MeshStandardMaterial({ color: "#ff3d5a", metalness: 0.5, roughness: 0.35 }),
    ceramic: new THREE.MeshStandardMaterial({ color: "#f2efe6", roughness: 0.4 }),
    lens: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#e8fbff", emissiveIntensity: 1.6, roughness: 0.1 }),
    tail: new THREE.MeshStandardMaterial({ color: "#ff2d4f", emissive: "#ff1a3c", emissiveIntensity: 1.4 }),
    amber: new THREE.MeshStandardMaterial({ color: "#ffb02e", emissive: "#ff9a00", emissiveIntensity: 1.1 }),
    mirror: new THREE.MeshStandardMaterial({ color: "#ccd6ff", metalness: 1, roughness: 0.02 }),
    bolt: new THREE.MeshStandardMaterial({ color: "#c9ccd6", metalness: 1, roughness: 0.25 })
  };
}

// ---------------------------------------------------------------- geometry helpers
function rod(a, b, r, mat, seg = 14) {
  const dir = b.clone().sub(a), len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
function taper(a, b, r1, r2, mat, seg = 20) {
  const dir = b.clone().sub(a), len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
function boxBetween(a, b, w, h, mat) {
  const dir = b.clone().sub(a), len = dir.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, h), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
function tube(points, r, mat, segs = 64) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segs, r, 12), mat);
}
function disc(r, depth, mat, seg = 40) {           // cylinder with its axis along z
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, seg), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function gearShape(teeth, rOut, rIn, holes = 0, holeR = 0, holeRing = 0, bore = 0.02) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = i % 4, r = k === 1 || k === 2 ? rOut : rIn;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2, h = new THREE.Path();
    h.absarc(Math.cos(a) * holeRing, Math.sin(a) * holeRing, holeR, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const b = new THREE.Path(); b.absarc(0, 0, bore, 0, Math.PI * 2, true); s.holes.push(b);
  return s;
}
function brakeDiscShape(rOut, rIn, holes) {
  const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const inner = new THREE.Path(); inner.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(inner);
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < holes; i++) {
    const a = ((i + ring * 0.5) / holes) * Math.PI * 2, rr = rIn + (rOut - rIn) * (ring ? 0.68 : 0.36);
    const h = new THREE.Path(); h.absarc(Math.cos(a) * rr, Math.sin(a) * rr, 0.0045, 0, Math.PI * 2, true); s.holes.push(h);
  }
  return s;
}
class Helix extends THREE.Curve {
  constructor(r, h, turns) { super(); this.r = r; this.h = h; this.turns = turns; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}
// 2D convex hull (monotone chain) for the chain path around both sprockets.
function hull(pts) {
  pts = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// ---------------------------------------------------------------- key points
const RA = V(-0.70, 0.345);        // rear axle
const FA = V(0.80, 0.345);         // front axle
const SP = V(-0.12, 0.43);         // swingarm pivot
const HEAD_TOP = V(0.46, 1.02), HEAD_BOT = V(0.52, 0.86);
const CYL_BASE = V(0.15, 0.58), CYL_DIR = V(Math.sin(0.26), Math.cos(0.26)).normalize();
const FORK_DIR = FA.clone().sub(V(0.47, 1.02)).normalize();
const cylAt = d => CYL_BASE.clone().addScaledVector(CYL_DIR, d);
const forkAt = d => V(0.47, 1.02).addScaledVector(FORK_DIR, d);

// ---------------------------------------------------------------- the bike
export function buildBike(M = makeMaterials()) {
  const root = new THREE.Group();
  const parts = {};
  const add = (id, name, deps, build, bolts = []) => {
    const g = new THREE.Group(); g.name = id;
    build(g);
    g.traverse(o => { o.userData.partId = id; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.add(g);
    parts[id] = { id, name, deps, group: g, bolts: bolts.map((b, i) => ({ id: `${id}-${i}`, partId: id, ...b })) };
  };
  // Bolt helper: position, axis (direction the bolt head faces), spanner size in mm, description.
  const B = (pos, axis, size, label) => ({ pos, axis: axis.clone().normalize(), size, label });
  const ZP = V(0, 0, 1), ZN = V(0, 0, -1);

  // ---------- FRAME ----------
  add("frame", "Main frame", [], g => {
    const m = M.frame, r = 0.019;
    g.add(rod(HEAD_TOP, HEAD_BOT, 0.032, m));                                         // steering head
    g.add(tube([V(0.45, 0.98), V(0.25, 0.93), V(0.0, 0.88), V(-0.2, 0.86)], 0.024, m)); // backbone
    [-0.075, 0.075].forEach(z => {
      g.add(tube([V(0.5, 0.88, z * 0.4), V(0.42, 0.6, z), V(0.34, 0.3, z), V(0.28, 0.2, z)], r, m));          // down tubes
      g.add(tube([V(0.28, 0.2, z), V(0.05, 0.17, z), V(-0.14, 0.22, z), V(-0.16, 0.42, z)], r, m));          // cradle
      g.add(tube([V(-0.16, 0.42, z), V(-0.18, 0.62, z), V(-0.2, 0.86, z * 1.2)], r, m));                     // seat post
    });
    [-0.11, 0.11].forEach(z => {
      g.add(tube([V(-0.2, 0.86, z), V(-0.5, 0.86, z), V(-0.82, 0.84, z)], 0.015, m));                        // seat rails
      g.add(tube([V(-0.18, 0.6, z * 0.8), V(-0.45, 0.72, z), V(-0.68, 0.84, z)], 0.014, m));                 // subframe stays
    });
    g.add(rod(V(-0.82, 0.84, -0.11), V(-0.82, 0.84, 0.11), 0.014, m));                                      // rear loop
    g.add(rod(V(-0.2, 0.86, -0.13), V(-0.2, 0.86, 0.13), 0.014, m));
    g.add(rod(V(-0.16, 0.42, -0.1), V(-0.16, 0.42, 0.1), 0.02, m));                                         // pivot cross tube
    // Gussets and engine mount plates.
    [-0.09, 0.09].forEach(z => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.006), m); p.position.set(0.3, 0.32, z); g.add(p);
      const q = p.clone(); q.position.set(-0.11, 0.26, z); g.add(q);
      const s = p.clone(); s.position.set(-0.13, 0.52, z); g.add(s);
    });
    const gus = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.03), m); gus.position.set(0.42, 0.95, 0); gus.rotation.z = -0.4; g.add(gus);
  });

  // ---------- ENGINE (crankcase + gearbox) ----------
  add("engine", "Crankcase & gearbox", ["frame"], g => {
    const prof = new THREE.Shape();
    prof.moveTo(0.28, 0.32); prof.quadraticCurveTo(0.33, 0.44, 0.24, 0.56); prof.lineTo(0.02, 0.6);
    prof.quadraticCurveTo(-0.1, 0.58, -0.12, 0.46); prof.quadraticCurveTo(-0.12, 0.26, 0.02, 0.22); prof.lineTo(0.2, 0.22);
    prof.quadraticCurveTo(0.27, 0.24, 0.28, 0.32);
    const geo = new THREE.ExtrudeGeometry(prof, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 4, curveSegments: 20 });
    geo.translate(0, 0, -0.1);
    g.add(new THREE.Mesh(geo, M.alu));
    // Clutch cover (right) with screws, stator cover (left), oil sight glass.
    const clutch = disc(0.095, 0.03, M.alu, 48); clutch.position.set(0.12, 0.4, 0.125); g.add(clutch);
    const clutchRim = disc(0.1, 0.012, M.darkAlu, 48); clutchRim.position.set(0.12, 0.4, 0.115); g.add(clutchRim);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, s = disc(0.008, 0.012, M.steel, 6);
      s.position.set(0.12 + Math.cos(a) * 0.083, 0.4 + Math.sin(a) * 0.083, 0.142); g.add(s);
    }
    const glass = disc(0.016, 0.006, M.amber, 24); glass.position.set(0.2, 0.3, 0.142); g.add(glass);
    const stator = disc(0.075, 0.03, M.alu, 48); stator.position.set(0.0, 0.38, -0.125); g.add(stator);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, s = disc(0.007, 0.012, M.steel, 6);
      s.position.set(Math.cos(a) * 0.064, 0.38 + Math.sin(a) * 0.064, -0.142); g.add(s);
    }
    // Front sprocket on the gearbox output shaft (left side).
    const fs = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(15, 0.05, 0.043, 0, 0, 0, 0.012), { depth: 0.008, bevelEnabled: false }), M.steel);
    fs.position.set(-0.06, 0.36, -0.13); g.add(fs);
    const sump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), M.darkAlu); sump.position.set(0.1, 0.205, 0); g.add(sump);
    const oilFilter = disc(0.03, 0.04, M.darkAlu, 24); oilFilter.position.set(0.24, 0.36, 0.12); g.add(oilFilter);
  }, [
    B(V(0.31, 0.32, 0.13), ZP, 12, "Front engine mount"),
    B(V(-0.11, 0.26, 0.13), ZP, 12, "Lower rear engine mount"),
    B(V(-0.13, 0.52, 0.13), ZP, 12, "Upper rear engine mount")
  ]);

  // ---------- CYLINDER (barrel with cooling fins) ----------
  add("cylinder", "Cylinder barrel", ["engine"], g => {
    g.add(rod(cylAt(-0.01), cylAt(0.2), 0.058, M.darkAlu, 32));
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.092 - i * 0.002, 0.092 - i * 0.002, 0.007, 40), i % 2 ? M.black : M.alu);
      f.position.copy(cylAt(0.015 + i * 0.021));
      f.quaternion.setFromUnitVectors(UP, CYL_DIR);
      g.add(f);
    }
  });

  // ---------- CYLINDER HEAD ----------
  add("head", "Cylinder head & rocker cover", ["cylinder"], g => {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, CYL_DIR);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.17), M.alu);
    body.position.copy(cylAt(0.245)); body.quaternion.copy(q); g.add(body);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.006, 0.2), M.black);
      fin.position.copy(cylAt(0.218 + i * 0.016)); fin.quaternion.copy(q); g.add(fin);
    }
    const rocker = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.08, 6, 16), M.chrome);
    rocker.position.copy(cylAt(0.3)); rocker.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2)); rocker.scale.set(1, 1, 1.25); g.add(rocker);
    const port = rod(cylAt(0.24).add(V(0.05, 0, 0.03)), cylAt(0.24).add(V(0.1, -0.02, 0.05)), 0.026, M.alu); g.add(port);   // exhaust port
    const intake = rod(cylAt(0.24).add(V(-0.05, 0, 0)), cylAt(0.24).add(V(-0.1, 0.01, 0)), 0.024, M.alu); g.add(intake);    // intake port
  }, [0, 1, 2, 3].map(i => {
    const off = [V(0.055, 0, 0.06), V(-0.055, 0, 0.06), V(0.055, 0, -0.06), V(-0.055, 0, -0.06)][i];
    return B(cylAt(0.33).add(off), CYL_DIR, 10, ["Head bolt front-right", "Head bolt rear-right", "Head bolt front-left", "Head bolt rear-left"][i]);
  }));

  // ---------- SPARK PLUG ----------
  add("sparkPlug", "Spark plug & HT lead", ["head"], g => {
    const base = cylAt(0.25).add(V(0, 0.0, 0.09));
    g.add(rod(base, base.clone().add(V(0, 0.02, 0.03)), 0.007, M.steel));
    g.add(rod(base.clone().add(V(0, 0.02, 0.03)), base.clone().add(V(0, 0.035, 0.055)), 0.009, M.ceramic));
    g.add(rod(base.clone().add(V(0, 0.035, 0.055)), base.clone().add(V(0, 0.05, 0.075)), 0.012, M.black));
    g.add(tube([base.clone().add(V(0, 0.05, 0.075)), V(0.05, 0.86, 0.12), V(-0.1, 0.84, 0.1), V(-0.22, 0.74, 0.06)], 0.005, M.black, 40));
  }, [B(cylAt(0.25).add(V(0, 0.03, 0.12)), V(0, 0.4, 1), 16, "Spark plug (plug socket)")]);

  // ---------- CARBURETTOR ----------
  add("carb", "Carburettor", ["head"], g => {
    const c = cylAt(0.24).add(V(-0.16, 0.0, 0));
    g.add(rod(c.clone().add(V(0.05, 0, 0)), c.clone().add(V(-0.05, 0, 0)), 0.03, M.alu, 24));
    const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), M.darkAlu); bowl.position.copy(c).add(V(0, -0.045, 0)); g.add(bowl);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 20), M.chrome); top.position.copy(c).add(V(0, 0.04, 0)); g.add(top);
    g.add(tube([c.clone().add(V(0, 0.05, 0)), V(0.1, 0.95, -0.05), V(0.35, 1.08, -0.2)], 0.004, M.black, 30));     // throttle cable
    g.add(taper(c.clone().add(V(-0.05, 0, 0)), c.clone().add(V(-0.09, -0.01, 0)), 0.03, 0.04, M.rubber));           // intake boot
  }, [B(cylAt(0.24).add(V(-0.115, 0.03, 0.035)), V(0, 0.3, 1), 8, "Carb flange top"), B(cylAt(0.24).add(V(-0.115, -0.03, 0.035)), V(0, -0.3, 1), 8, "Carb flange bottom")]);

  // ---------- AIR FILTER BOX ----------
  add("airbox", "Air filter box", ["carb", "frame"], g => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.17), M.black); box.position.set(-0.22, 0.7, 0); g.add(box);
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 28), M.darkAlu); cover.rotation.x = Math.PI / 2; cover.position.set(-0.22, 0.7, 0.09); g.add(cover);
    g.add(taper(V(-0.15, 0.71, 0), V(-0.05, 0.75, 0), 0.04, 0.035, M.rubber));
  }, [B(V(-0.22, 0.7, 0.1), ZP, 8, "Air box cover screw")]);

  // ---------- EXHAUST HEADER ----------
  add("exhaust", "Exhaust header pipe", ["head"], g => {
    const start = cylAt(0.24).add(V(0.1, -0.02, 0.05));
    g.add(tube([start, V(0.4, 0.62, 0.1), V(0.42, 0.4, 0.14), V(0.33, 0.2, 0.16), V(0.1, 0.17, 0.18), V(-0.15, 0.23, 0.19)], 0.022, M.chrome, 80));
    const flange = disc(0.035, 0.012, M.steel, 6); flange.position.copy(start); flange.quaternion.setFromUnitVectors(V(0, 0, 1), V(0.8, -0.2, 0.5).normalize()); g.add(flange);
    const shield = tube([V(0.4, 0.55, 0.12), V(0.42, 0.42, 0.155), V(0.37, 0.28, 0.17)], 0.026, M.darkAlu, 30); g.add(shield);
  }, [B(cylAt(0.24).add(V(0.11, 0.01, 0.07)), V(0.6, 0.2, 0.8), 10, "Header flange nut upper"), B(cylAt(0.24).add(V(0.11, -0.05, 0.07)), V(0.6, -0.2, 0.8), 10, "Header flange nut lower")]);

  // ---------- MUFFLER ----------
  add("muffler", "Silencer / muffler", ["exhaust", "frame"], g => {
    g.add(taper(V(-0.15, 0.24, 0.19), V(-0.32, 0.3, 0.2), 0.024, 0.055, M.chrome));
    g.add(taper(V(-0.32, 0.3, 0.2), V(-0.82, 0.46, 0.2), 0.055, 0.058, M.chrome, 32));
    const cap = disc(0.058, 0.02, M.darkAlu, 32); cap.quaternion.setFromUnitVectors(V(0, 1, 0), V(-1, -0.3, 0).normalize()); cap.position.set(-0.83, 0.465, 0.2); g.add(cap);
    const tip = disc(0.022, 0.03, M.black, 20); tip.quaternion.copy(cap.quaternion); tip.position.set(-0.845, 0.47, 0.2); g.add(tip);
    g.add(rod(V(-0.55, 0.39, 0.2), V(-0.55, 0.62, 0.13), 0.008, M.frame));                                   // hanger
    const heat = taper(V(-0.4, 0.34, 0.23), V(-0.65, 0.42, 0.235), 0.03, 0.03, M.darkAlu); heat.scale.set(1, 1, 0.5); g.add(heat);
  }, [B(V(-0.55, 0.62, 0.15), ZP, 12, "Muffler hanger bolt")]);

  // ---------- SWINGARM ----------
  add("swingarm", "Swingarm", ["frame"], g => {
    [-0.105, 0.105].forEach(z => {
      g.add(boxBetween(V(SP.x, SP.y, z), V(RA.x, RA.y, z), 0.04, 0.022, M.frame));
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.026), M.alu); end.position.set(RA.x + 0.01, RA.y, z); g.add(end);   // axle adjuster blocks
    });
    g.add(rod(V(-0.3, 0.4, -0.105), V(-0.3, 0.4, 0.105), 0.016, M.frame));
    g.add(rod(V(SP.x, SP.y, -0.115), V(SP.x, SP.y, 0.115), 0.022, M.alu));
    [-0.105, 0.105].forEach(z => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.02), M.frame); m.position.set(-0.55, 0.385, z); g.add(m); });
  }, [B(V(SP.x, SP.y, 0.135), ZP, 17, "Swingarm pivot bolt")]);

  // ---------- REAR SHOCKS (twin) ----------
  add("rearShock", "Rear shock absorbers (pair)", ["swingarm"], g => {
    [-0.13, 0.13].forEach(z => {
      const a = V(-0.55, 0.385, z), b = V(-0.5, 0.83, z), dir = b.clone().sub(a).normalize(), len = a.distanceTo(b);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      const spring = new THREE.Mesh(new THREE.TubeGeometry(new Helix(0.028, len * 0.62, 9), 300, 0.0045, 8), M.spring);
      spring.position.copy(a).addScaledVector(dir, len * 0.18); spring.quaternion.copy(q); g.add(spring);
      g.add(rod(a, a.clone().addScaledVector(dir, len * 0.55), 0.012, M.chrome));
      g.add(rod(a.clone().addScaledVector(dir, len * 0.5), b, 0.02, M.black));
      const capT = rod(b.clone().addScaledVector(dir, -0.06), b.clone().addScaledVector(dir, -0.04), 0.034, M.alu); g.add(capT);
      const capB = rod(a.clone().addScaledVector(dir, 0.08), a.clone().addScaledVector(dir, 0.1), 0.034, M.alu); g.add(capB);
      [a, b].forEach(p => { const eye = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.006, 8, 20), M.alu); eye.position.copy(p); g.add(eye); });
    });
  }, [B(V(-0.5, 0.83, 0.15), ZP, 12, "Right shock top mount"), B(V(-0.5, 0.83, -0.15), ZN, 12, "Left shock top mount")]);

  // ---------- WHEELS ----------
  function wheel(g, centre, opts) {
    const w = new THREE.Group(); w.position.copy(centre); w.name = "spin";
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.055, 24, 80), M.rubber); w.add(tyre);
    // Tread blocks.
    const lug = new THREE.BoxGeometry(0.03, 0.012, 0.035), lugs = new THREE.InstancedMesh(lug, M.rubber, 72), d = new THREE.Object3D();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, side = i % 2 ? 0.025 : -0.025;
      d.position.set(Math.cos(a) * 0.343, Math.sin(a) * 0.343, side); d.rotation.set(0, 0, a + Math.PI / 2); d.updateMatrix(); lugs.setMatrixAt(i, d.matrix);
    }
    w.add(lugs);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.012, 10, 80), M.rims); w.add(rim);
    const rim2 = new THREE.Mesh(new THREE.CylinderGeometry(0.257, 0.257, 0.05, 80, 1, true), M.rims); rim2.rotation.x = Math.PI / 2; w.add(rim2);
    const hub = disc(0.055, 0.12, M.alu, 32); w.add(hub);
    [-0.05, 0.05].forEach(z => { const fl = disc(0.065, 0.008, M.alu, 32); fl.position.z = z; w.add(fl); });
    for (let i = 0; i < 36; i++) {                                    // laced spokes
      const a = (i / 36) * Math.PI * 2, side = i % 2 ? 0.05 : -0.05, ha = a + (i % 4 < 2 ? 0.35 : -0.35);
      w.add(rod(V(Math.cos(ha) * 0.06, Math.sin(ha) * 0.06, side), V(Math.cos(a) * 0.255, Math.sin(a) * 0.255, side * 0.15), 0.0022, M.steel, 5));
    }
    const axle = rod(V(0, 0, -0.14), V(0, 0, 0.14), 0.01, M.steel); w.add(axle);
    const valve = rod(V(0.25, 0, 0.01), V(0.23, 0, 0.012), 0.004, M.steel); w.add(valve);
    if (opts.rearSprocket) {
      const sp = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(40, 0.118, 0.108, 6, 0.016, 0.07, 0.03), { depth: 0.008, bevelEnabled: false }), M.steel);
      sp.position.z = -0.12; w.add(sp);
    }
    g.add(w);
    return w;
  }
  add("rearWheel", "Rear wheel & sprocket", ["swingarm"], g => wheel(g, RA, { rearSprocket: true }),
    [B(V(RA.x, RA.y, 0.15), ZP, 24, "Rear axle nut")]);
  add("frontWheel", "Front wheel", ["fork"], g => wheel(g, FA, {}),
    [B(V(FA.x, FA.y, 0.14), ZP, 17, "Front axle nut")]);

  // ---------- BRAKES ----------
  add("rearBrake", "Rear brake disc & caliper", ["rearWheel"], g => {
    const d = new THREE.Mesh(new THREE.ExtrudeGeometry(brakeDiscShape(0.11, 0.06, 12), { depth: 0.005, bevelEnabled: false, curveSegments: 24 }), M.steel);
    d.position.set(RA.x, RA.y, 0.075); d.name = "spin"; g.add(d);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.04), M.gold); cal.position.set(RA.x + 0.06, RA.y + 0.08, 0.08); cal.rotation.z = -0.6; g.add(cal);
    g.add(rod(V(RA.x + 0.06, RA.y + 0.08, 0.1), V(-0.1, 0.3, 0.15), 0.004, M.black));
  }, [B(V(RA.x + 0.03, RA.y + 0.1, 0.105), ZP, 12, "Rear caliper bolt top"), B(V(RA.x + 0.09, RA.y + 0.06, 0.105), ZP, 12, "Rear caliper bolt bottom")]);

  add("frontBrake", "Front brake disc & caliper", ["frontWheel"], g => {
    const d = new THREE.Mesh(new THREE.ExtrudeGeometry(brakeDiscShape(0.145, 0.085, 16), { depth: 0.005, bevelEnabled: false, curveSegments: 32 }), M.steel);
    d.position.set(FA.x, FA.y, 0.07); d.name = "spin"; g.add(d);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, b = disc(0.006, 0.01, M.alu, 6); b.position.set(FA.x + Math.cos(a) * 0.075, FA.y + Math.sin(a) * 0.075, 0.078); g.add(b); }
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.045), M.gold); cal.position.set(FA.x - 0.1, FA.y + 0.07, 0.075); cal.rotation.z = 0.5; g.add(cal);
    g.add(tube([V(FA.x - 0.1, FA.y + 0.1, 0.09), V(0.62, 0.8, 0.13), V(0.5, 1.05, 0.2), V(0.42, 1.12, 0.3)], 0.004, M.black, 40));
  }, [B(V(FA.x - 0.13, FA.y + 0.06, 0.1), ZP, 12, "Front caliper bolt lower"), B(V(FA.x - 0.08, FA.y + 0.1, 0.1), ZP, 12, "Front caliper bolt upper")]);

  // ---------- DRIVE CHAIN ----------
  add("chain", "Drive chain", ["rearWheel", "engine"], g => {
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      pts.push({ x: -0.06 + Math.cos(a) * 0.05, y: 0.36 + Math.sin(a) * 0.05 });
      pts.push({ x: RA.x + Math.cos(a) * 0.118, y: RA.y + Math.sin(a) * 0.118 });
    }
    const h = hull(pts); h.push(h[0]);
    let total = 0; const seg = [];
    for (let i = 0; i < h.length - 1; i++) { const l = Math.hypot(h[i + 1].x - h[i].x, h[i + 1].y - h[i].y); seg.push(l); total += l; }
    const N = 112, links = new THREE.InstancedMesh(new THREE.BoxGeometry(0.013, 0.006, 0.014), M.steel, N), d = new THREE.Object3D();
    for (let k = 0; k < N; k++) {
      let s = (k / N) * total, i = 0;
      while (s > seg[i]) { s -= seg[i]; i++; }
      const t = s / seg[i], x = h[i].x + (h[i + 1].x - h[i].x) * t, y = h[i].y + (h[i + 1].y - h[i].y) * t;
      d.position.set(x, y, -0.125 + (k % 2 ? 0.003 : -0.003)); d.rotation.set(0, 0, Math.atan2(h[i + 1].y - h[i].y, h[i + 1].x - h[i].x)); d.updateMatrix();
      links.setMatrixAt(k, d.matrix);
    }
    g.add(links);
    const guard = boxBetween(V(-0.12, 0.47, -0.14), V(-0.62, 0.47, -0.14), 0.02, 0.006, M.black); g.add(guard);
  }, [B(V(RA.x + 0.03, RA.y, -0.15), ZN, 10, "Chain adjuster nut")]);

  // ---------- FRONT FORKS + TRIPLE CLAMPS ----------
  add("fork", "Front forks & triple clamps", ["frame"], g => {
    [-0.085, 0.085].forEach(z => {
      const top = forkAt(-0.03).setZ(z), mid = forkAt(0.4).setZ(z), low = forkAt(0.36).setZ(z), bottom = FA.clone().setZ(z);
      g.add(rod(top, mid, 0.019, M.chrome, 20));                       // stanchion
      g.add(taper(low, bottom.clone().addScaledVector(FORK_DIR, 0.03), 0.026, 0.024, M.darkAlu, 20));   // lower leg
      const cap = disc(0.021, 0.012, M.alu, 6); cap.quaternion.setFromUnitVectors(UP, FORK_DIR); cap.rotation.x += 0; cap.position.copy(forkAt(-0.04).setZ(z)); g.add(cap);
      const seal = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.005, 8, 24), M.black); seal.position.copy(low); seal.quaternion.setFromUnitVectors(V(0, 0, 1), FORK_DIR); g.add(seal);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), M.darkAlu); foot.position.copy(bottom); g.add(foot);
    });
    const topClamp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.24), M.alu); topClamp.position.copy(forkAt(0.0)); topClamp.quaternion.setFromUnitVectors(UP, FORK_DIR.clone().negate()); g.add(topClamp);
    const botClamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.24), M.darkAlu); botClamp.position.copy(forkAt(0.16)); botClamp.quaternion.copy(topClamp.quaternion); g.add(botClamp);
    const stem = disc(0.022, 0.02, M.chrome, 6); stem.position.copy(forkAt(-0.012)); stem.quaternion.setFromUnitVectors(UP, FORK_DIR); g.add(stem);
  }, [B(forkAt(0.0).add(V(0.035, 0, 0.085)), V(1, 0.3, 0), 14, "Top clamp pinch bolt right"), B(forkAt(0.0).add(V(0.035, 0, -0.085)), V(1, 0.3, 0), 14, "Top clamp pinch bolt left")]);

  // ---------- FRONT FENDER ----------
  add("frontFender", "Front mudguard", ["fork"], g => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.11, 48, 1, true, Math.PI * 0.55, Math.PI * 0.75), M.fenders);
    f.material.side = THREE.DoubleSide; f.rotation.x = Math.PI / 2; f.position.copy(FA); g.add(f);
    [-0.07, 0.07].forEach(z => g.add(tube([V(FA.x + 0.2, FA.y + 0.2, z), V(FA.x, FA.y + 0.05, z * 1.2), V(FA.x - 0.2, FA.y + 0.25, z)], 0.005, M.chrome, 20)));
  }, [B(V(FA.x + 0.02, FA.y + 0.2, 0.09), ZP, 8, "Mudguard bolt right"), B(V(FA.x + 0.02, FA.y + 0.2, -0.09), ZN, 8, "Mudguard bolt left")]);

  // ---------- HANDLEBAR + controls ----------
  add("handlebar", "Handlebar, grips & levers", ["fork"], g => {
    g.add(tube([V(0.32, 1.13, -0.38), V(0.39, 1.12, -0.24), V(0.45, 1.09, -0.09), V(0.46, 1.08, 0), V(0.45, 1.09, 0.09), V(0.39, 1.12, 0.24), V(0.32, 1.13, 0.38)], 0.011, M.chrome, 60));
    [-1, 1].forEach(s => {
      g.add(rod(V(0.335, 1.13, s * 0.3), V(0.32, 1.13, s * 0.4), 0.017, M.rubber));               // grips
      const end = disc(0.018, 0.012, M.alu, 16); end.position.set(0.318, 1.13, s * 0.405); g.add(end);
      g.add(tube([V(0.37, 1.13, s * 0.25), V(0.42, 1.12, s * 0.3), V(0.43, 1.11, s * 0.38)], 0.005, M.alu, 16));   // levers
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.035), M.black); sw.position.set(0.36, 1.125, s * 0.265); g.add(sw);
    });
    const res = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.03), M.black); res.position.set(0.39, 1.16, 0.22); g.add(res);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.08), M.alu); clamp.position.set(0.46, 1.08, 0); g.add(clamp);
  }, [B(V(0.48, 1.1, 0.03), UP, 8, "Bar clamp bolt right"), B(V(0.48, 1.1, -0.03), UP, 8, "Bar clamp bolt left")]);

  // ---------- MIRRORS ----------
  add("mirrors", "Mirrors (pair)", ["handlebar"], g => {
    [-1, 1].forEach(s => {
      g.add(tube([V(0.38, 1.13, s * 0.25), V(0.36, 1.25, s * 0.29), V(0.33, 1.33, s * 0.33)], 0.005, M.chrome, 16));
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 32), M.chrome); head.rotation.z = Math.PI / 2; head.position.set(0.325, 1.37, s * 0.34); head.scale.set(1, 1, 0.75); g.add(head);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.044, 32), M.mirror); glass.rotation.y = -Math.PI / 2; glass.position.set(0.318, 1.37, s * 0.34); glass.scale.set(1, 0.75, 1); g.add(glass);
    });
  }, [B(V(0.38, 1.14, 0.25), UP, 10, "Right mirror nut"), B(V(0.38, 1.14, -0.25), UP, 10, "Left mirror nut")]);

  // ---------- HEADLIGHT + indicators ----------
  add("headlight", "Headlight & indicators", ["fork"], g => {
    const c = V(0.62, 0.93, 0);
    const bucket = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.chrome);
    bucket.rotation.z = Math.PI / 2; bucket.position.copy(c); g.add(bucket);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.01, 40), M.lens); lens.rotation.z = Math.PI / 2; lens.position.copy(c).add(V(0.003, 0, 0)); g.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.008, 10, 48), M.chrome); ring.rotation.y = Math.PI / 2; ring.position.copy(c).add(V(0.006, 0, 0)); g.add(ring);
    [-1, 1].forEach(s => {
      g.add(rod(V(0.58, 0.95, s * 0.1), V(0.56, 1.0, s * 0.09), 0.009, M.frame));                  // ears
      g.add(rod(V(0.56, 0.95, s * 0.1), V(0.6, 0.95, s * 0.2), 0.004, M.chrome));                   // indicator stalk
      const ind = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.025, 4, 12), M.amber); ind.rotation.z = Math.PI / 2; ind.position.set(0.62, 0.95, s * 0.2); g.add(ind);
    });
  }, [B(V(0.58, 0.95, 0.115), ZP, 10, "Headlight ear bolt right"), B(V(0.58, 0.95, -0.115), ZN, 10, "Headlight ear bolt left")]);

  // ---------- INSTRUMENTS ----------
  const dial = (label, max) => canvasTex(256, 256, (x, w) => {
    x.fillStyle = "#07060d"; x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#ff8a3d"; x.lineWidth = 6; x.beginPath(); x.arc(128, 128, 112, Math.PI * 0.75, Math.PI * 2.25); x.stroke();
    x.fillStyle = "#e8e6ff"; x.font = "bold 22px sans-serif"; x.textAlign = "center";
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
      x.fillText(String(Math.round((max / 6) * i)), 128 + Math.cos(a) * 82, 136 + Math.sin(a) * 82);
    }
    x.font = "bold 18px sans-serif"; x.fillStyle = "#2de2e6"; x.fillText(label, 128, 190);
    x.strokeStyle = "#ff3d5a"; x.lineWidth = 5; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(Math.PI * 1.15) * 90, 128 + Math.sin(Math.PI * 1.15) * 90); x.stroke();
  });
  add("instruments", "Speedometer & tachometer", ["handlebar"], g => {
    [[-0.055, dial("km/h", 180)], [0.055, dial("rpm x1000", 9)]].forEach(([z, tex]) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.05, 32), M.chrome); pod.position.set(0.46, 1.15, z); pod.rotation.z = 0.5; g.add(pod);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.042, 32), new THREE.MeshBasicMaterial({ map: tex }));
      face.position.set(0.448, 1.176, z);
      face.quaternion.setFromUnitVectors(V(0, 0, 1), V(-Math.sin(0.5), Math.cos(0.5), 0));
      face.rotateZ(-Math.PI / 2);
      g.add(face);
    });
  }, [B(V(0.46, 1.12, 0), V(0.4, 1, 0), 8, "Instrument bracket bolt")]);

  // ---------- BATTERY ----------
  add("battery", "Battery", ["frame"], g => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.1), M.black); b.position.set(-0.3, 0.66, 0); g.add(b);
    const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.121, 0.04, 0.101), new THREE.MeshStandardMaterial({ color: "#2de2e6", emissive: "#0c4a4c" })); lbl.position.set(-0.3, 0.68, 0); g.add(lbl);
    [[0.035, "#ff3d5a"], [-0.035, "#222"]].forEach(([z, c]) => { const t = disc(0.008, 0.02, new THREE.MeshStandardMaterial({ color: c }), 10); t.rotation.x = 0; t.position.set(-0.27, 0.735, z); g.add(t); });
    g.add(tube([V(-0.27, 0.74, 0.035), V(-0.2, 0.78, 0.06), V(-0.1, 0.62, 0.11)], 0.004, M.spring, 20));
  }, [B(V(-0.27, 0.75, 0.035), UP, 10, "Battery terminal")]);

  // ---------- SIDE PANELS ----------
  add("sidePanels", "Side panels (pair)", ["battery", "airbox"], g => {
    const s = new THREE.Shape(); s.moveTo(-0.13, 0.84); s.lineTo(-0.48, 0.84); s.quadraticCurveTo(-0.44, 0.6, -0.22, 0.56); s.quadraticCurveTo(-0.12, 0.6, -0.13, 0.84);
    [-1, 1].forEach(side => {
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
      const m = new THREE.Mesh(geo, M.panels); m.position.z = side * 0.13 - (side < 0 ? 0.012 : 0); g.add(m);
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.04), new THREE.MeshBasicMaterial({ map: canvasTex(256, 86, (x) => {
        x.fillStyle = "rgba(0,0,0,0)"; x.clearRect(0, 0, 256, 86); x.fillStyle = "#f4efff"; x.font = "bold italic 56px sans-serif"; x.textAlign = "center"; x.fillText("500 ST", 128, 62);
      }), transparent: true }));
      badge.position.set(-0.27, 0.73, side * (0.13 + 0.018)); if (side < 0) badge.rotation.y = Math.PI; g.add(badge);
    });
  }, [B(V(-0.3, 0.8, 0.15), ZP, 8, "Right panel screw"), B(V(-0.3, 0.8, -0.15), ZN, 8, "Left panel screw")]);

  // ---------- FUEL TANK ----------
  add("fuelTank", "Fuel tank", ["frame", "carb"], g => {
    const geo = new THREE.SphereGeometry(1, 64, 32);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {                                  // shape a teardrop tank with a flat base
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < -0.35) y = -0.35 + (y + 0.35) * 0.2;
      const taperK = 1 - Math.max(0, -x) * 0.25;
      p.setXYZ(i, x * 0.27, y * 0.12, z * 0.15 * taperK);
    }
    geo.computeVertexNormals();
    const tank = new THREE.Mesh(geo, M.tank); tank.position.set(0.17, 0.99, 0); tank.rotation.z = -0.08; g.add(tank);
    const cap = disc(0.03, 0.02, M.chrome, 24); cap.rotation.x = 0; cap.position.set(0.23, 1.112, 0); g.add(cap);
    [-1, 1].forEach(s => {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.01), M.rubber); pad.position.set(0.02, 0.97, s * 0.138); pad.rotation.y = s * 0.15; g.add(pad);
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.05), new THREE.MeshBasicMaterial({ map: canvasTex(300, 100, (x) => {
        x.clearRect(0, 0, 300, 100); x.fillStyle = "#f4efff"; x.font = "bold italic 64px sans-serif"; x.textAlign = "center"; x.fillText("APEX", 150, 70);
        x.strokeStyle = "#ff8a3d"; x.lineWidth = 5; x.beginPath(); x.moveTo(20, 84); x.lineTo(280, 84); x.stroke();
      }), transparent: true }));
      badge.scale.setScalar(0.8); badge.position.set(0.2, 0.99, s * 0.158); badge.rotation.y = s < 0 ? Math.PI : 0; g.add(badge);
    });
    g.add(tube([V(0.02, 0.9, 0.02), V(0.03, 0.82, 0.05), V(0.02, 0.76, 0.03)], 0.005, M.black, 12));      // fuel line
  }, [B(V(0.36, 0.95, 0.11), ZP, 10, "Tank front mount right"), B(V(0.36, 0.95, -0.11), ZN, 10, "Tank front mount left")]);

  // ---------- SEAT ----------
  add("seat", "Seat & grab rail", ["fuelTank", "sidePanels", "rearShock"], g => {
    const s = new THREE.Shape();
    s.moveTo(-0.08, 0.9); s.quadraticCurveTo(-0.2, 0.97, -0.42, 0.95); s.quadraticCurveTo(-0.62, 0.94, -0.84, 0.98);
    s.lineTo(-0.85, 0.9); s.lineTo(-0.1, 0.87); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 6, curveSegments: 24 });
    geo.translate(0, 0, -0.12);
    g.add(new THREE.Mesh(geo, M.leather));
    const stitch = tube([V(-0.15, 0.965, 0.0), V(-0.42, 0.985, 0), V(-0.8, 1.0, 0)], 0.003, M.ceramic, 30); g.add(stitch);
    g.add(tube([V(-0.6, 0.93, 0.14), V(-0.8, 0.95, 0.15), V(-0.9, 0.95, 0.0), V(-0.8, 0.95, -0.15), V(-0.6, 0.93, -0.14)], 0.011, M.chrome, 40));
  }, [B(V(-0.83, 0.93, 0.0), V(-1, 0.2, 0), 10, "Seat rear bolt")]);

  // ---------- REAR FENDER + TAIL LIGHT + PLATE ----------
  add("rearFender", "Rear mudguard, tail light & plate", ["frame", "battery"], g => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.13, 48, 1, true, Math.PI * 0.9, Math.PI * 0.65), M.fenders);
    f.material.side = THREE.DoubleSide; f.rotation.x = Math.PI / 2; f.position.copy(RA); g.add(f);
    [-0.06, 0.06].forEach(z => g.add(tube([V(-0.82, 0.84, z), V(-0.9, 0.79, z), V(-0.97, 0.66, z * 0.6)], 0.008, M.frame, 16)));   // tail bracket
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.1), M.tail); tl.position.set(-0.98, 0.72, 0); g.add(tl);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.11), M.chrome); housing.position.set(-0.965, 0.72, 0); g.add(housing);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: canvasTex(400, 200, (x) => {
      x.fillStyle = "#f6f3e8"; x.fillRect(0, 0, 400, 200); x.strokeStyle = "#111"; x.lineWidth = 8; x.strokeRect(6, 6, 388, 188);
      x.fillStyle = "#111"; x.font = "bold 96px sans-serif"; x.textAlign = "center"; x.fillText("26-D-APX", 200, 132);
    }), roughness: 0.6 }));
    plate.rotation.y = -Math.PI / 2; plate.position.set(-0.99, 0.6, 0); plate.rotation.x = 0; g.add(plate);
    [-1, 1].forEach(s => {
      g.add(rod(V(-0.92, 0.75, s * 0.06), V(-0.95, 0.75, s * 0.16), 0.004, M.chrome));
      const ind = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.022, 4, 12), M.amber); ind.rotation.z = Math.PI / 2; ind.position.set(-0.96, 0.75, s * 0.17); g.add(ind);
    });
  }, [B(V(-0.75, 0.8, 0.13), ZP, 8, "Mudguard bolt right"), B(V(-0.75, 0.8, -0.13), ZN, 8, "Mudguard bolt left")]);

  // ---------- FOOTPEGS + pedals ----------
  add("footpegs", "Footpegs, brake pedal & gear lever", ["frame"], g => {
    [-1, 1].forEach(s => {
      g.add(rod(V(-0.05, 0.3, s * 0.12), V(-0.05, 0.3, s * 0.26), 0.012, M.alu));
      g.add(rod(V(-0.05, 0.3, s * 0.17), V(-0.05, 0.3, s * 0.26), 0.017, M.rubber));
    });
    g.add(tube([V(-0.04, 0.3, 0.17), V(0.12, 0.26, 0.17), V(0.22, 0.27, 0.18)], 0.007, M.frame, 16));           // brake pedal
    g.add(tube([V(-0.04, 0.33, -0.17), V(0.1, 0.33, -0.18), V(0.18, 0.35, -0.19)], 0.007, M.frame, 16));        // gear lever
  }, [B(V(-0.05, 0.3, 0.13), ZP, 12, "Right footpeg bolt"), B(V(-0.05, 0.3, -0.13), ZN, 12, "Left footpeg bolt")]);

  // ---------- KICKSTAND ----------
  add("kickstand", "Side stand", ["frame"], g => {
    g.add(rod(V(0.0, 0.24, -0.1), V(0.1, 0.02, -0.28), 0.011, M.frame));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.04), M.frame); foot.position.set(0.1, 0.012, -0.28); g.add(foot);
  }, [B(V(0.0, 0.24, -0.12), ZN, 14, "Side stand pivot bolt")]);

  // ---------- bolt meshes ----------
  const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6), washerGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.003, 20);
  const hitGeo = new THREE.SphereGeometry(0.034, 10, 8);
  const bolts = [];
  Object.values(parts).forEach(p => p.bolts.forEach(b => {
    const g = new THREE.Group();
    g.position.copy(b.pos);
    g.quaternion.setFromUnitVectors(UP, b.axis);
    const head = new THREE.Mesh(boltGeo, M.bolt); head.position.y = 0.008; g.add(head);
    const washer = new THREE.Mesh(washerGeo, M.steel); g.add(washer);
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0035, 8, 28), new THREE.MeshBasicMaterial({ color: "#ff8a3d" }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.004; g.add(ring);
    g.traverse(o => { o.userData.boltId = b.id; });
    b.object = g; b.head = head; b.ring = ring;
    root.add(g);
    bolts.push(b);
  }));

  // Paint zones -> materials (the Workshop paint shop edits these).
  const zones = { tank: M.tank, frame: M.frame, fenders: M.fenders, panels: M.panels, rims: M.rims };

  return { root, parts, bolts, zones, materials: M };
}

// Install order that respects every dependency (used for hints and the showroom).
export function assemblyOrder(parts) {
  const done = new Set(), order = [];
  const ids = Object.keys(parts);
  while (order.length < ids.length) {
    const next = ids.find(id => !done.has(id) && parts[id].deps.every(d => done.has(d)));
    if (!next) break;
    done.add(next); order.push(next);
  }
  return order;
}
