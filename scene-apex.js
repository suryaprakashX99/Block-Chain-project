// Apex Auto hero: an interactive neon sports car and touring motorbike (original low-poly models).
import { createStage, neonEdges, glowDisc, switcher, THREE } from "./stage3d.js";

const host = document.getElementById("stage3d");
if (host && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const stage = createStage(host, { envTop: "#1a0d2e", envMid: "#ff3d8b", envLow: "#ff8a3d", camera: [0, 2.4, 10.5] });
  const { scene, pivot } = stage;

  scene.add(new THREE.HemisphereLight("#7b5cff", "#120a1e", 0.6));
  const key = new THREE.DirectionalLight("#ffd9b0", 2.2); key.position.set(4, 6, 5); scene.add(key);
  const pink = new THREE.PointLight("#ff3d8b", 40, 12); pink.position.set(-4, 2, 2); scene.add(pink);
  const cyan = new THREE.PointLight("#2de2e6", 30, 12); cyan.position.set(4, 1.5, -3); scene.add(cyan);

  const paint = new THREE.MeshPhysicalMaterial({ color: "#5a1e7a", metalness: 0.55, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#0b0a1a", metalness: 0.2, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide });
  const rubber = new THREE.MeshStandardMaterial({ color: "#0c0b12", roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: "#d9d4ff", metalness: 1, roughness: 0.2 });
  const glow = color => new THREE.MeshBasicMaterial({ color });

  // ---------- CAR ----------
  const car = new THREE.Group();
  const profile = new THREE.Shape();
  [[-2.3, 0.38], [2.2, 0.38], [2.38, 0.55], [2.25, 0.72], [0.95, 0.88], [0.25, 1.32], [-0.95, 1.36], [-2.05, 1.0], [-2.38, 0.86]]
    .forEach(([x, y], i) => (i ? profile.lineTo(x, y) : profile.moveTo(x, y)));
  profile.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4 });
  bodyGeo.translate(0, 0, -0.9);
  car.add(new THREE.Mesh(bodyGeo, paint));
  car.add(neonEdges(bodyGeo, "#ff8a3d", 30));

  // Side windows (dark glass panels) on both sides.
  const win = new THREE.Shape();
  [[0.85, 0.9], [0.25, 1.26], [-0.9, 1.29], [-1.75, 0.98]].forEach(([x, y], i) => (i ? win.lineTo(x, y) : win.moveTo(x, y)));
  win.closePath();
  [-1, 1].forEach(s => {
    const w = new THREE.Mesh(new THREE.ShapeGeometry(win), glass);
    w.position.z = s * 1.02; if (s < 0) w.rotation.y = Math.PI, w.scale.x = -1;
    car.add(w);
  });

  // Lights.
  [-0.62, 0.62].forEach(z => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.42), glow("#e8fbff"));
    hl.position.set(2.37, 0.62, z); car.add(hl);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 1.9), glow("#ff2d6f"));
  tail.position.set(-2.46, 0.86, 0); car.add(tail);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 2.0), paint);
  spoiler.position.set(-2.1, 1.22, 0); car.add(spoiler);
  car.add(neonEdges(spoiler.geometry, "#ff3d8b").translateX(-2.1).translateY(1.22));

  // Wheels.
  const carWheels = [];
  const makeCarWheel = () => {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.32, 32), rubber); tyre.rotation.x = Math.PI / 2; w.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.34, 6), chrome); rim.rotation.x = Math.PI / 2; w.add(rim);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.018, 8, 40), glow("#2de2e6")); ring.position.z = 0.18; w.add(ring);
    const ring2 = ring.clone(); ring2.position.z = -0.18; w.add(ring2);
    return w;
  };
  [[1.45, 1.02], [1.45, -1.02], [-1.45, 1.02], [-1.45, -1.02]].forEach(([x, z]) => {
    const w = makeCarWheel(); w.position.set(x, 0.44, z); car.add(w); carWheels.push(w);
  });
  car.add(glowDisc(stage, "#ff3d8b", 7));
  car.scale.setScalar(0.95);

  // ---------- BIKE ----------
  const bike = new THREE.Group();
  const bikeWheels = [];
  const makeBikeWheel = () => {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.11, 16, 48), rubber));
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.02, 8, 48), glow("#2de2e6")));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), chrome);
      s.rotation.z = (i / 5) * Math.PI; w.add(s);
    }
    return w;
  };
  const rear = makeBikeWheel(); rear.position.set(-1.25, 0.69, 0);
  const front = makeBikeWheel(); front.position.set(1.3, 0.69, 0);
  bike.add(rear, front); bikeWheels.push(rear, front);

  const tube = (pts, r, mat) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 10), mat);
  bike.add(tube([[-1.25, 0.69, 0], [-0.3, 1.0, 0], [0.75, 1.55, 0]], 0.07, paint));           // main frame
  bike.add(tube([[0.75, 1.55, 0], [1.05, 1.1, 0], [1.3, 0.69, 0]], 0.05, chrome));            // forks
  bike.add(tube([[-1.25, 0.69, 0.12], [-0.4, 0.62, 0.22], [0.35, 0.5, 0.2]], 0.06, chrome));   // exhaust
  bike.add(tube([[0.7, 1.75, -0.45], [0.8, 1.7, 0], [0.7, 1.75, 0.45]], 0.035, chrome));     // handlebar

  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), paint);
  tank.scale.set(1.15, 0.55, 0.62); tank.position.set(0.25, 1.48, 0); bike.add(tank);
  bike.add(neonEdges(new THREE.SphereGeometry(0.5, 10, 5).scale(1.15, 0.55, 0.62).translate(0.25, 1.48, 0), "#ff8a3d", 20));
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.5), new THREE.MeshStandardMaterial({ color: "#1d1a28", metalness: 0.9, roughness: 0.35 }));
  engine.position.set(-0.05, 0.85, 0); bike.add(engine);
  bike.add(neonEdges(engine.geometry, "#ff3d8b").translateX(-0.05).translateY(0.85));
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: "#120f1c", roughness: 0.7 }));
  seat.position.set(-0.6, 1.42, 0); seat.rotation.z = 0.12; bike.add(seat);
  const headlamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), glow("#e8fbff"));
  headlamp.rotation.z = Math.PI / 2; headlamp.position.set(0.98, 1.5, 0); bike.add(headlamp);
  const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.28), glow("#ff2d6f"));
  tailLamp.position.set(-1.12, 1.38, 0); bike.add(tailLamp);
  bike.add(glowDisc(stage, "#ff8a3d", 5.5));
  bike.scale.setScalar(1.15);
  bike.visible = false;

  // Showroom turntable that grounds the models.
  const deck = new THREE.Group();
  deck.add(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.4, 0.16, 64), new THREE.MeshPhysicalMaterial({ color: "#0a0814", metalness: 0.3, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4 })));
  const deckRing = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.03, 8, 96), glow("#ff3d8b"));
  deckRing.rotation.x = Math.PI / 2; deckRing.position.y = 0.08; deck.add(deckRing);
  const deckRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.012, 8, 96), glow("#2de2e6"));
  deckRing2.rotation.x = Math.PI / 2; deckRing2.position.y = 0.085; deck.add(deckRing2);
  deck.position.y = -0.08;
  pivot.add(deck, car, bike);
  pivot.rotation.y = -0.6;
  pivot.position.y = -0.6;

  let current = car;
  switcher(host, ["Car", "Bike"], i => {
    const next = i ? bike : car;
    if (next === current) return;
    current.visible = false; next.visible = true; next.scale.multiplyScalar(0.6);
    current = next;
  });

  const targetScale = { car: 0.95, bike: 1.15 };
  stage.onTick((dt, t) => {
    carWheels.forEach(w => (w.rotation.z -= dt * 6));
    bikeWheels.forEach(w => (w.rotation.z -= dt * 6));
    pivot.position.y = -0.6;
    car.position.y = bike.position.y = 0.02 + Math.sin(t * 1.4) * 0.03;
    const s = current === car ? targetScale.car : targetScale.bike;
    current.scale.lerp(new THREE.Vector3(s, s, s), 0.12);
  });
  host.classList.add("ready");
}
