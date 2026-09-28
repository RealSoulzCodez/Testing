// Procedural NAO-style humanoid built from Three.js primitives.
// No external model files: every part is generated here so colours can be
// re-themed from CSS tokens later.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const cssVar = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

function materials() {
  const shell = new THREE.MeshPhysicalMaterial({
    color: cssVar('--robot-shell', '#f4f5f8'),
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const joint = new THREE.MeshStandardMaterial({
    color: cssVar('--robot-joint', '#3b404a'),
    roughness: 0.45,
    metalness: 0.35,
  });
  const accent = new THREE.MeshPhysicalMaterial({
    color: cssVar('--robot-accent', '#f89818'),
    roughness: 0.38,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  const visor = new THREE.MeshPhysicalMaterial({
    color: '#1d2129',
    roughness: 0.15,
    metalness: 0.4,
    clearcoat: 1,
  });
  const glow = new THREE.MeshBasicMaterial({ color: cssVar('--robot-glow', '#3fd8ff') });
  return { shell, joint, accent, visor, glow };
}

// Smooth rounded box via a scaled capsule-ish sphere; cheap and soft-looking.
function blob(mat, sx, sy, sz, seg = 40) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg), mat);
  m.scale.set(sx, sy, sz);
  return m;
}

function capsule(mat, r, len, seg = 24) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, seg), mat);
}

function buildArm(M, side) {
  // side: 1 = robot's left (screen right when facing camera), -1 = robot's right
  const shoulder = new THREE.Group();
  const ball = blob(M.joint, 0.12, 0.12, 0.12);
  shoulder.add(ball);
  const cap = blob(M.shell, 0.15, 0.13, 0.14);
  cap.position.set(0.03 * side, 0.03, 0);
  shoulder.add(cap);

  const upper = capsule(M.shell, 0.085, 0.22);
  upper.position.y = -0.2;
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -0.36;
  shoulder.add(elbow);
  elbow.add(blob(M.joint, 0.075, 0.075, 0.075));

  const fore = capsule(M.accent, 0.095, 0.2);
  fore.position.y = -0.18;
  elbow.add(fore);

  const hand = new THREE.Group();
  hand.position.y = -0.36;
  elbow.add(hand);
  hand.add(blob(M.joint, 0.07, 0.08, 0.055));
  for (let i = 0; i < 3; i++) {
    const f = capsule(M.joint, 0.018, 0.07, 10);
    f.position.set((i - 1) * 0.035, -0.1, 0.01);
    hand.add(f);
  }
  const thumb = capsule(M.joint, 0.018, 0.05, 10);
  thumb.position.set(-0.06 * side, -0.05, 0.03);
  thumb.rotation.z = 0.6 * side;
  hand.add(thumb);

  shoulder.userData = { elbow, hand };
  return shoulder;
}

function buildLeg(M, side) {
  // NAO legs are short and chunky; keep proportions compact.
  const hip = new THREE.Group();
  hip.add(blob(M.joint, 0.12, 0.1, 0.12));

  const thigh = blob(M.shell, 0.165, 0.22, 0.175);
  thigh.position.y = -0.2;
  hip.add(thigh);
  const thighPad = blob(M.accent, 0.06, 0.13, 0.12);
  thighPad.position.set(0.13 * side, -0.2, 0);
  hip.add(thighPad);

  const knee = new THREE.Group();
  knee.position.y = -0.43;
  hip.add(knee);
  knee.add(blob(M.joint, 0.11, 0.08, 0.11));

  const shin = blob(M.shell, 0.16, 0.23, 0.18);
  shin.position.y = -0.23;
  knee.add(shin);
  const plate = blob(M.accent, 0.12, 0.17, 0.07);
  plate.position.set(0, -0.2, 0.13);
  knee.add(plate);

  const ankle = new THREE.Group();
  ankle.position.y = -0.47;
  knee.add(ankle);
  ankle.add(blob(M.joint, 0.085, 0.05, 0.085));
  const foot = blob(M.shell, 0.17, 0.08, 0.27);
  foot.position.set(0.015 * side, -0.07, 0.07);
  ankle.add(foot);
  const sole = blob(M.joint, 0.17, 0.03, 0.27);
  sole.position.set(0.015 * side, -0.115, 0.07);
  ankle.add(sole);

  return hip;
}

function buildHead(M) {
  const head = new THREE.Group();

  const skull = blob(M.shell, 0.43, 0.4, 0.41, 64);
  head.add(skull);

  // Dark face band wrapping the front of the head.
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.418, 64, 32, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.33, Math.PI * 0.36),
    M.visor,
  );
  // phi range 0.2π..0.8π is centred on +z, so the band already faces forward.
  face.scale.set(1.03, 0.97, 1.03);
  head.add(face);

  // Eyes: glowing LED rings with a dark lens.
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 16, 48), M.glow);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), new THREE.MeshBasicMaterial({ color: '#0b0e14' }));
    lens.position.z = -0.004;
    eye.add(ring, lens);
    eye.position.set(0.15 * s, 0.03, 0.405);
    eye.rotation.y = 0.28 * s;
    eyes.add(eye);
  }
  head.add(eyes);

  // Mouth camera slit.
  const mouth = blob(M.joint, 0.05, 0.012, 0.01);
  mouth.position.set(0, -0.17, 0.39);
  head.add(mouth);

  // Ears: speaker discs with accent rims.
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 48), M.joint);
    disc.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 16, 48), M.accent);
    rim.rotation.y = Math.PI / 2;
    const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.065, 32), M.visor);
    grille.rotation.z = Math.PI / 2;
    ear.add(disc, rim, grille);
    ear.position.set(0.41 * s, 0.0, -0.02);
    head.add(ear);
  }

  // Accent crown plate on top of the head.
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.432, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.22),
    M.accent,
  );
  crown.scale.set(1.0, 0.94, 0.96);
  head.add(crown);

  head.userData = { eyes };
  return head;
}

function buildTorso(M) {
  const torso = new THREE.Group();

  const chest = blob(M.shell, 0.4, 0.38, 0.29, 56);
  chest.position.y = 0.05;
  torso.add(chest);

  const chestPlate = blob(M.visor, 0.2, 0.18, 0.08);
  chestPlate.position.set(0, 0.1, 0.23);
  torso.add(chestPlate);

  const button = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 12, 40), null);
  button.material = new THREE.MeshBasicMaterial({ color: cssVar('--robot-accent', '#f89818') });
  button.position.set(0, 0.1, 0.305);
  torso.add(button);

  const belly = blob(M.joint, 0.28, 0.14, 0.22);
  belly.position.y = -0.33;
  torso.add(belly);

  const hips = blob(M.shell, 0.33, 0.12, 0.24);
  hips.position.y = -0.45;
  torso.add(hips);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 24), M.joint);
  neck.position.y = 0.47;
  torso.add(neck);

  return { torso, chestButton: button };
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(20,30,50,0.35)');
  grd.addColorStop(1, 'rgba(20,30,50,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createRobotScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the brand orange from drifting to yellow
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.5, 9); // robot fills ~60% of the stage, sitting slightly low

  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(cssVar('--robot-glow', '#3fd8ff'), 1.2);
  rim.position.set(-4, 2, -3);
  const warm = new THREE.DirectionalLight(cssVar('--robot-accent', '#f89818'), 0.6);
  warm.position.set(4, -1, -2);
  scene.add(key, rim, warm, new THREE.AmbientLight('#ffffff', 0.35));

  const M = materials();

  // Rig ---------------------------------------------------------------
  const root = new THREE.Group(); // scroll rotation + position
  const body = new THREE.Group(); // idle breathing
  root.add(body);
  scene.add(root);

  const { torso, chestButton } = buildTorso(M);
  torso.position.y = 0.55;
  body.add(torso);

  const head = buildHead(M);
  head.position.y = 1.43;
  body.add(head);

  const armL = buildArm(M, 1);
  armL.position.set(0.5, 0.88, 0);
  armL.rotation.z = 0.12;
  const armR = buildArm(M, -1);
  armR.position.set(-0.5, 0.88, 0);
  armR.rotation.z = -0.12;
  body.add(armL, armR);

  const legL = buildLeg(M, 1);
  legL.position.set(0.17, 0.0, 0);
  const legR = buildLeg(M, -1);
  legR.position.set(-0.17, 0.0, 0);
  body.add(legL, legR);

  // Feet end up at y ≈ -1.05; centre the figure vertically.
  body.position.y = -0.1;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.16;
  root.add(shadow);

  // State ---------------------------------------------------------------
  const state = {
    progress: 0,
    pointer: new THREE.Vector2(),
    lookX: 0,
    lookY: 0,
    wave: 0, // 0..1 envelope
    waveStart: -1,
    blinkAt: 2,
    running: true,
    offsetX: 0,
    scale: 1,
    frames: 0,
  };

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the robot a consistent size on narrow / portrait screens.
    camera.fov = camera.aspect < 0.8 ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  window.addEventListener('pointermove', (e) => {
    state.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  const clock = new THREE.Clock();

  function tick() {
    if (!state.running) return;
    const t = clock.getElapsedTime();

    // Idle breathing.
    body.position.y = -0.1 + Math.sin(t * 1.6) * 0.015;
    torso.rotation.x = Math.sin(t * 1.6) * 0.01;

    // Scroll: one full turn, slight dolly-in, then face the viewer again.
    const p = state.progress;
    root.rotation.y = p * Math.PI * 2;
    root.position.x += (state.offsetX - root.position.x) * 0.08;
    const s = state.scale * (1 + Math.sin(p * Math.PI) * 0.06);
    root.scale.setScalar(s);

    // Head tracks the pointer, mostly when facing the camera.
    const facing = Math.max(0, Math.cos(root.rotation.y));
    state.lookX += (state.pointer.x * 0.5 * facing - state.lookX) * 0.06;
    state.lookY += (state.pointer.y * 0.25 * facing - state.lookY) * 0.06;
    head.rotation.y = state.lookX;
    head.rotation.x = state.lookY;

    // Arms sway a little as the body turns.
    armL.rotation.x = Math.sin(t * 1.2) * 0.05 + Math.sin(p * Math.PI * 2) * 0.25;
    armR.rotation.x = -Math.sin(t * 1.2) * 0.05 - Math.sin(p * Math.PI * 2) * 0.25;

    // Wave with the robot's right arm.
    if (state.waveStart >= 0) {
      const w = (t - state.waveStart) / 2.4;
      state.wave = w >= 1 ? 0 : Math.sin(Math.min(w, 1) * Math.PI);
      if (w >= 1) state.waveStart = -1;
    }
    const wv = state.wave;
    armR.rotation.z = -0.12 - wv * 2.5;
    armR.userData.elbow.rotation.z = -wv * (0.6 + Math.sin(t * 9) * 0.35);
    armR.rotation.x = armR.rotation.x * (1 - wv);

    // Eyes: gentle pulse + occasional blink.
    const pulse = 0.85 + Math.sin(t * 2.4) * 0.15;
    M.glow.color.set(cssVar('--robot-glow', '#3fd8ff')).multiplyScalar(pulse);
    if (t > state.blinkAt) {
      const b = (t - state.blinkAt) / 0.18;
      const k = b < 1 ? 1 - Math.sin(b * Math.PI) * 0.9 : 1;
      head.userData.eyes.children.forEach((e) => (e.scale.y = k));
      if (b >= 1) state.blinkAt = t + 2.5 + Math.random() * 3;
    }
    chestButton.scale.setScalar(1 + Math.sin(t * 3) * 0.08);

    renderer.render(scene, camera);
    state.frames++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    setProgress(p) { state.progress = p; },
    setOffset(x) { state.offsetX = x; },
    setScale(s) { state.scale = s; },
    wave() { state.waveStart = clock.elapsedTime; },
    pause() { state.running = false; },
    // Read-only snapshot used by the end-to-end tests.
    debug() {
      return {
        frames: state.frames,
        triangles: renderer.info.render.triangles,
        rotationY: root.rotation.y,
        progress: state.progress,
        running: state.running,
      };
    },
    resume() {
      if (state.running) return;
      state.running = true;
      clock.getDelta();
      requestAnimationFrame(tick);
    },
  };
}
