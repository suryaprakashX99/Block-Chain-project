// Elite Strikers hero: a 3D football (true 32-panel ball) with a cricket ball in orbit.
import { createStage, glowDisc, switcher, THREE } from "./stage3d.js";

const host = document.getElementById("stage3d");
if (host && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const stage = createStage(host, { envTop: "#0f1a3a", envMid: "#39ff9c", envLow: "#2de2e6", camera: [0, 1.6, 9] });
  const { scene, pivot } = stage;

  scene.add(new THREE.HemisphereLight("#9fffe0", "#0a0f1e", 0.8));
  const key = new THREE.DirectionalLight("#ffffff", 2.4); key.position.set(3, 5, 6); scene.add(key);
  const green = new THREE.PointLight("#39ff9c", 35, 12); green.position.set(-3.5, 1, 2.5); scene.add(green);
  const teal = new THREE.PointLight("#2de2e6", 30, 12); teal.position.set(3.5, -0.5, -2); scene.add(teal);

  // ---------- FOOTBALL: truncated icosahedron projected onto a sphere ----------
  function footballGeometry(radius = 1.25, detail = 5) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const V = [[0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi], [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0], [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]]
      .map(v => new THREE.Vector3(...v));
    const adj = (a, b) => Math.abs(V[a].distanceTo(V[b]) - 2) < 1e-6;
    const lerp = (a, b, t) => V[a].clone().lerp(V[b], t);
    const polys = []; // { pts, black }

    // 12 pentagons, one around each original vertex.
    V.forEach((v, i) => {
      const nb = V.map((_, j) => j).filter(j => j !== i && adj(i, j));
      const axis = v.clone().normalize();
      const ref = V[nb[0]].clone().sub(v).projectOnPlane(axis).normalize();
      const cross = new THREE.Vector3().crossVectors(axis, ref);
      nb.sort((a, b) => {
        const da = V[a].clone().sub(v), db = V[b].clone().sub(v);
        return Math.atan2(da.dot(cross), da.dot(ref)) - Math.atan2(db.dot(cross), db.dot(ref));
      });
      polys.push({ pts: nb.map(j => lerp(i, j, 1 / 3)), black: true });
    });
    // 20 hexagons, one per original face.
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) {
      if (adj(a, b) && adj(b, c) && adj(a, c)) {
        polys.push({ pts: [lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), lerp(b, c, 1 / 3), lerp(b, c, 2 / 3), lerp(c, a, 1 / 3), lerp(c, a, 2 / 3)], black: false });
      }
    }

    // Each panel: fan of subdivided triangles, shrunk slightly to leave seams, pushed onto the sphere.
    const pos = [], col = [];
    const white = new THREE.Color("#f4f7ff"), black = new THREE.Color("#0b0d14");
    polys.forEach(({ pts, black: isBlack }) => {
      const centre = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);
      const shrunk = pts.map(p => p.clone().lerp(centre, 0.035));
      const colour = isBlack ? black : white;
      for (let k = 0; k < shrunk.length; k++) {
        const A = centre, B = shrunk[k], C = shrunk[(k + 1) % shrunk.length];
        const P = (i, j) => {
          const u = i / detail, v = j / detail;
          return A.clone().multiplyScalar(1 - u - v).add(B.clone().multiplyScalar(u)).add(C.clone().multiplyScalar(v)).normalize().multiplyScalar(radius);
        };
        for (let i = 0; i < detail; i++) for (let j = 0; j < detail - i; j++) {
          const tri = [[P(i, j), P(i + 1, j), P(i, j + 1)]];
          if (i + j < detail - 1) tri.push([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]);
          tri.forEach(t => t.forEach(p => { pos.push(p.x, p.y, p.z); col.push(colour.r, colour.g, colour.b); }));
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  const football = new THREE.Group();
  football.add(new THREE.Mesh(footballGeometry(), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 })));
  // Glowing seams: an emissive core just under the panels.
  football.add(new THREE.Mesh(new THREE.SphereGeometry(1.22, 48, 32), new THREE.MeshBasicMaterial({ color: "#39ff9c" })));
  football.position.y = 1.35;

  // ---------- CRICKET BALL ----------
  const cricket = new THREE.Group();
  cricket.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), new THREE.MeshPhysicalMaterial({ color: "#b3122e", roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 })));
  const seamMat = new THREE.MeshStandardMaterial({ color: "#fff6e8", roughness: 0.6 });
  [-0.035, 0.035].forEach(o => {
    const s = new THREE.Mesh(new THREE.TorusGeometry(Math.sqrt(0.42 * 0.42 - o * o) + 0.004, 0.01, 8, 64), seamMat);
    s.position.z = o; cricket.add(s);
  });
  for (let i = 0; i < 48; i++) {               // stitches
    const a = (i / 48) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.04, 0.1), seamMat);
    st.position.set(Math.cos(a) * 0.425, Math.sin(a) * 0.425, 0);
    st.rotation.z = a; cricket.add(st);
  }
  const orbit = new THREE.Group();
  orbit.add(cricket);
  cricket.position.set(2.6, 0, 0);
  orbit.position.y = 1.35;
  orbit.rotation.z = 0.35;

  const disc = glowDisc(stage, "#39ff9c", 5);
  pivot.add(football, orbit, disc);

  let mode = 0; // 0 = football focus, 1 = cricket focus
  switcher(host, ["Football", "Cricket"], i => { mode = i; });

  stage.onTick((dt, t) => {
    football.rotation.x += dt * 0.6;
    football.rotation.z += dt * 0.25;
    const bounce = Math.abs(Math.sin(t * 2.2));
    football.position.y = 1.15 + bounce * 0.45;
    football.scale.setScalar(THREE.MathUtils.lerp(football.scale.x, mode ? 0.55 : 1, 0.08));
    cricket.scale.setScalar(THREE.MathUtils.lerp(cricket.scale.x, mode ? 2.4 : 1, 0.08));
    cricket.position.x = THREE.MathUtils.lerp(cricket.position.x, mode ? 0 : 2.6, 0.08);
    orbit.rotation.y += dt * (mode ? 0.2 : 1.6);
    cricket.rotation.x += dt * 3;
    disc.scale.setScalar(1 - bounce * 0.25);
  });
  host.classList.add("ready");
}
