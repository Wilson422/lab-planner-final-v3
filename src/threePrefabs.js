import * as THREE from 'three';

function createRoundedRectShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function makeRoundedBoxGeo(width, height, depth, radius, smoothSteps = 5) {
  const geo = new THREE.ExtrudeGeometry(createRoundedRectShape(width, height, radius), {
    depth,
    bevelEnabled: false,
    curveSegments: smoothSteps,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function emissiveMaterial(baseHex, emissiveHex, intensity = 0.75) {
  const mat = new THREE.MeshStandardMaterial({ color: baseHex, roughness: 0.42, metalness: 0.05 });
  mat.emissive = new THREE.Color(emissiveHex);
  mat.emissiveIntensity = intensity;
  return mat;
}

const MATERIALS = {
  body: new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.75, metalness: 0.04 }),
  bodyAlt: new THREE.MeshStandardMaterial({ color: 0xd8e0ea, roughness: 0.78, metalness: 0.04 }),
  base: new THREE.MeshStandardMaterial({ color: 0x2d3a4a, roughness: 0.88, metalness: 0.12 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.96, metalness: 0.02 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb8c4d0, roughness: 0.22, metalness: 0.82 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.22, roughness: 0.08, metalness: 0 }),
  panel: emissiveMaterial(0x0c1a2e, 0x3b82f6, 0.85),
  screen: emissiveMaterial(0x0c1a2e, 0x22d3ee, 0.6),
};

function accentMaterial(hex) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.52, metalness: 0.08 });
}

function addAccent(root, { x, y, z, width, height, accent, radius = 8 }) {
  const mesh = new THREE.Mesh(
    makeRoundedBoxGeo(width, height, 8, Math.min(radius, width * 0.2), 4),
    accentMaterial(accent),
  );
  mesh.position.set(x, y, z);
  root.add(mesh);
}

function addPanel(root, { x, y, z, width, height }) {
  const mesh = new THREE.Mesh(makeRoundedBoxGeo(width, height, 8, 10, 4), MATERIALS.panel);
  mesh.position.set(x, y, z);
  root.add(mesh);
}

function addHandle(root, { x, y, z, length }) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, length, 12), MATERIALS.metal);
  mesh.position.set(x, y, z);
  root.add(mesh);
}

function buildBench(width, depth, height) {
  const root = new THREE.Group();
  const top = new THREE.Mesh(makeRoundedBoxGeo(width, 44, depth, 16, 5), MATERIALS.body);
  top.position.set(0, height - 22, 0);
  root.add(top);

  const legHeight = height - 70;
  const legGeo = makeRoundedBoxGeo(26, legHeight, 26, 6, 3);
  [
    [-width / 2 + 28, legHeight / 2, -depth / 2 + 28],
    [width / 2 - 28, legHeight / 2, -depth / 2 + 28],
    [-width / 2 + 28, legHeight / 2, depth / 2 - 28],
    [width / 2 - 28, legHeight / 2, depth / 2 - 28],
  ].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, MATERIALS.base);
    leg.position.set(x, y, z);
    root.add(leg);
  });

  return { root, pickHeight: height };
}

function buildFridgeLike(width, depth, height, accent) {
  const root = new THREE.Group();
  const radius = Math.min(22, Math.min(width, depth) * 0.08);
  const plinth = new THREE.Mesh(makeRoundedBoxGeo(width * 0.96, 40, depth * 0.96, 12, 3), MATERIALS.base);
  plinth.position.set(0, 20, 0);
  root.add(plinth);

  const body = new THREE.Mesh(makeRoundedBoxGeo(width, height, depth, radius, 6), MATERIALS.body);
  body.position.set(0, height / 2 + 40, 0);
  root.add(body);

  const door = new THREE.Mesh(makeRoundedBoxGeo(width * 0.9, height * 0.88, 6, Math.min(14, radius), 4), MATERIALS.bodyAlt);
  door.position.set(0, height / 2 + 40, depth / 2 + 6);
  root.add(door);

  addHandle(root, { x: width / 2 - 34, y: height / 2 + 40, z: depth / 2 + 18, length: height * 0.44 });
  addPanel(root, { x: 0, y: height + 40 - 124, z: depth / 2 + 14, width: width * 0.5, height: 76 });
  addAccent(root, { x: width * 0.22, y: height + 40 - 175, z: depth / 2 + 18, width: width * 0.34, height: 20, accent });
  return { root, pickHeight: height + 40 };
}

function buildIncubator(width, depth, height, accent) {
  const root = new THREE.Group();
  const radius = Math.min(22, Math.min(width, depth) * 0.08);
  const base = new THREE.Mesh(makeRoundedBoxGeo(width * 0.96, 40, depth * 0.96, 12, 3), MATERIALS.base);
  base.position.set(0, 20, 0);
  root.add(base);

  const body = new THREE.Mesh(makeRoundedBoxGeo(width, height, depth, radius, 6), MATERIALS.body);
  body.position.set(0, height / 2 + 40, 0);
  root.add(body);

  const glass = new THREE.Mesh(makeRoundedBoxGeo(width * 0.82, height * 0.74, 10, Math.min(18, radius), 5), MATERIALS.glass);
  glass.position.set(0, height / 2 + 40, depth / 2 + 10);
  root.add(glass);

  addPanel(root, { x: 0, y: height + 40 - 120, z: depth / 2 + 14, width: width * 0.5, height: 74 });
  addAccent(root, { x: width * 0.22, y: height + 40 - 170, z: depth / 2 + 16, width: width * 0.35, height: 20, accent });
  addHandle(root, { x: width / 2 - 36, y: height / 2 + 40, z: depth / 2 + 16, length: height * 0.45 });
  return { root, pickHeight: height + 40 };
}

function buildCentrifuge(width, depth, height, accent) {
  const root = new THREE.Group();
  const baseHeight = height * 0.58;
  const base = new THREE.Mesh(makeRoundedBoxGeo(width, baseHeight, depth, Math.min(18, Math.min(width, depth) * 0.08), 5), MATERIALS.base);
  base.position.set(0, baseHeight / 2, 0);
  root.add(base);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(width, depth) * 0.36, Math.min(width, depth) * 0.36, height * 0.28, 30), MATERIALS.bodyAlt);
  lid.position.set(0, baseHeight + height * 0.14, 0);
  root.add(lid);

  addPanel(root, { x: width * 0.18, y: baseHeight * 0.66, z: depth / 2 + 14, width: width * 0.42, height: height * 0.24 });
  addAccent(root, { x: -width * 0.15, y: baseHeight * 0.56, z: depth / 2 + 14, width: width * 0.28, height: 18, accent });
  return { root, pickHeight: height };
}

function buildSink(width, depth, height, accent) {
  const root = new THREE.Group();
  const cabinet = new THREE.Mesh(makeRoundedBoxGeo(width * 0.92, height - 60, depth * 0.92, 16, 5), MATERIALS.bodyAlt);
  cabinet.position.set(0, (height - 60) / 2, 0);
  root.add(cabinet);

  const top = new THREE.Mesh(makeRoundedBoxGeo(width, 44, depth, 16, 6), MATERIALS.body);
  top.position.set(0, height - 22, 0);
  root.add(top);

  const basin = new THREE.Mesh(makeRoundedBoxGeo(width * 0.55, 26, depth * 0.45, 14, 5), MATERIALS.dark);
  basin.position.set(-width * 0.08, height - 30, 0);
  root.add(basin);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 120, 14), MATERIALS.metal);
  post.position.set(width * 0.2, height + 30, 0);
  root.add(post);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 120, 14), MATERIALS.metal);
  spout.rotation.z = Math.PI / 2;
  spout.position.set(width * 0.2 + 55, height + 70, 0);
  root.add(spout);

  addHandle(root, { x: width * 0.34, y: (height - 60) / 2, z: depth / 2 + 14, length: (height - 60) * 0.36 });
  addAccent(root, { x: -width * 0.18, y: (height - 60) / 2, z: depth / 2 + 14, width: width * 0.28, height: 18, accent });
  return { root, pickHeight: height };
}

function buildHood(width, depth, height, accent) {
  const root = new THREE.Group();
  const radius = Math.min(22, Math.min(width, depth) * 0.08);
  const base = new THREE.Mesh(makeRoundedBoxGeo(width, 46, depth, 14, 5), MATERIALS.base);
  base.position.set(0, 23, 0);
  root.add(base);

  const body = new THREE.Mesh(makeRoundedBoxGeo(width, height, depth, radius, 6), MATERIALS.body);
  body.position.set(0, height / 2 + 46, 0);
  root.add(body);

  const frame = new THREE.Mesh(makeRoundedBoxGeo(width * 0.92, height * 0.6, 14, 12, 5), MATERIALS.bodyAlt);
  frame.position.set(0, height * 0.58, depth / 2 + 6);
  root.add(frame);

  const glass = new THREE.Mesh(makeRoundedBoxGeo(width * 0.86, height * 0.52, 10, 12, 5), MATERIALS.glass);
  glass.position.set(0, height * 0.58, depth / 2 + 10);
  root.add(glass);

  addPanel(root, { x: 0, y: height + 46 - 142, z: depth / 2 + 16, width: width * 0.6, height: 84 });
  addAccent(root, { x: width * 0.22, y: height + 46 - 192, z: depth / 2 + 16, width: width * 0.35, height: 20, accent });
  return { root, pickHeight: height + 46 };
}

function buildPCR(width, depth, height, accent) {
  const root = new THREE.Group();
  const baseH = height * 0.62;

  const body = new THREE.Mesh(makeRoundedBoxGeo(width, baseH, depth, Math.min(18, width * 0.07), 5), MATERIALS.body);
  body.position.set(0, baseH / 2, 0);
  root.add(body);

  const lid = new THREE.Mesh(makeRoundedBoxGeo(width * 0.88, height * 0.22, depth * 0.82, 12, 4), MATERIALS.bodyAlt);
  lid.position.set(0, baseH + height * 0.11, 0);
  root.add(lid);

  const tube = new THREE.Mesh(makeRoundedBoxGeo(width * 0.52, height * 0.18, depth * 0.52, 8, 3), MATERIALS.dark);
  tube.position.set(0, baseH - height * 0.06, 0);
  root.add(tube);

  addPanel(root, { x: width * 0.18, y: baseH * 0.62, z: depth / 2 + 12, width: width * 0.44, height: baseH * 0.34 });
  addAccent(root, { x: -width * 0.2, y: baseH * 0.46, z: depth / 2 + 14, width: width * 0.26, height: 14, accent });
  return { root, pickHeight: height };
}

function buildMicroscope(width, depth, height, accent) {
  const root = new THREE.Group();

  const base = new THREE.Mesh(makeRoundedBoxGeo(width * 0.88, height * 0.09, depth * 0.72, 12, 4), MATERIALS.base);
  base.position.set(0, height * 0.045, 0);
  root.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.09, width * 0.11, height * 0.68, 14), MATERIALS.body);
  column.position.set(-width * 0.14, height * 0.44, 0);
  root.add(column);

  const arm = new THREE.Mesh(makeRoundedBoxGeo(width * 0.52, height * 0.06, depth * 0.14, 8, 3), MATERIALS.bodyAlt);
  arm.position.set(width * 0.06, height * 0.72, 0);
  root.add(arm);

  const nosepiece = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.09, width * 0.07, height * 0.12, 14), MATERIALS.dark);
  nosepiece.position.set(width * 0.22, height * 0.62, 0);
  root.add(nosepiece);

  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.045, width * 0.055, height * 0.18, 12), MATERIALS.bodyAlt);
  eyepiece.position.set(-width * 0.14, height * 0.82, 0);
  eyepiece.rotation.z = Math.PI / 7;
  root.add(eyepiece);

  const stage = new THREE.Mesh(makeRoundedBoxGeo(width * 0.56, height * 0.04, depth * 0.44, 8, 3), MATERIALS.metal);
  stage.position.set(width * 0.06, height * 0.44, 0);
  root.add(stage);

  addAccent(root, { x: -width * 0.14, y: height * 0.2, z: depth / 2 - depth * 0.08, width: width * 0.22, height: 14, accent });
  return { root, pickHeight: height };
}

function buildAutoAnalyzer(width, depth, height, accent) {
  const root = new THREE.Group();
  const radius = Math.min(20, Math.min(width, depth) * 0.06);

  const plinth = new THREE.Mesh(makeRoundedBoxGeo(width * 0.96, 44, depth * 0.96, 12, 3), MATERIALS.base);
  plinth.position.set(0, 22, 0);
  root.add(plinth);

  const body = new THREE.Mesh(makeRoundedBoxGeo(width, height, depth, radius, 6), MATERIALS.body);
  body.position.set(0, height / 2 + 44, 0);
  root.add(body);

  addPanel(root, { x: width * 0.08, y: height * 0.62 + 44, z: depth / 2 + 14, width: width * 0.6, height: height * 0.28 });

  const slot = new THREE.Mesh(makeRoundedBoxGeo(width * 0.52, height * 0.16, 10, 10, 3), MATERIALS.screen);
  slot.position.set(-width * 0.08, height * 0.34 + 44, depth / 2 + 8);
  root.add(slot);

  addAccent(root, { x: width * 0.24, y: height * 0.2 + 44, z: depth / 2 + 16, width: width * 0.28, height: 18, accent });
  addHandle(root, { x: -width / 2 + 34, y: height * 0.5 + 44, z: depth / 2 + 16, length: height * 0.32 });
  return { root, pickHeight: height + 44 };
}

function buildSpectrophotometer(width, depth, height, accent) {
  const root = new THREE.Group();
  const bodyH = height * 0.72;

  const body = new THREE.Mesh(makeRoundedBoxGeo(width, bodyH, depth, Math.min(16, width * 0.07), 5), MATERIALS.body);
  body.position.set(0, bodyH / 2, 0);
  root.add(body);

  const lidW = width * 0.42;
  const lidD = depth * 0.48;
  const lid = new THREE.Mesh(makeRoundedBoxGeo(lidW, height * 0.22, lidD, 10, 4), MATERIALS.bodyAlt);
  lid.position.set(-width * 0.1, bodyH + height * 0.11, -depth * 0.06);
  root.add(lid);

  const well = new THREE.Mesh(makeRoundedBoxGeo(lidW * 0.6, height * 0.05, lidD * 0.6, 6, 3), MATERIALS.dark);
  well.position.set(-width * 0.1, bodyH - height * 0.02, -depth * 0.06);
  root.add(well);

  addPanel(root, { x: width * 0.24, y: bodyH * 0.55, z: depth / 2 + 12, width: width * 0.42, height: bodyH * 0.36 });
  addAccent(root, { x: -width * 0.2, y: bodyH * 0.34, z: depth / 2 + 12, width: width * 0.26, height: 13, accent });
  return { root, pickHeight: height };
}

function buildAutomationTrack(width, depth, height, accent) {
  const root = new THREE.Group();

  const base = new THREE.Mesh(makeRoundedBoxGeo(width, height * 0.38, depth, 10, 4), MATERIALS.base);
  base.position.set(0, height * 0.19, 0);
  root.add(base);

  const rail = new THREE.Mesh(makeRoundedBoxGeo(width * 0.96, height * 0.14, depth * 0.28, 6, 3), MATERIALS.metal);
  rail.position.set(0, height * 0.38 + height * 0.07, 0);
  root.add(rail);

  const carrierSize = Math.min(depth * 0.7, height * 0.4);
  [-width * 0.32, 0, width * 0.32].forEach((cx) => {
    const carrier = new THREE.Mesh(makeRoundedBoxGeo(carrierSize, height * 0.3, carrierSize, 6, 3), MATERIALS.bodyAlt);
    carrier.position.set(cx, height * 0.52 + height * 0.15, 0);
    root.add(carrier);
  });

  const endCap = new THREE.Mesh(makeRoundedBoxGeo(depth * 0.9, height * 0.38, depth * 0.9, 8, 3), MATERIALS.body);
  endCap.position.set(width / 2 + depth * 0.45, height * 0.19, 0);
  root.add(endCap);

  addPanel(root, { x: width / 2 + depth * 0.45, y: height * 0.24, z: depth / 2 + 12, width: depth * 0.64, height: height * 0.24 });
  addAccent(root, { x: width * 0.38, y: height * 0.24, z: depth / 2 + 12, width: width * 0.16, height: 12, accent });
  return { root, pickHeight: height };
}

function buildPureWater(width, depth, height, accent) {
  const root = new THREE.Group();
  const radius = Math.min(18, Math.min(width, depth) * 0.1);

  const body = new THREE.Mesh(makeRoundedBoxGeo(width, height * 0.78, depth, radius, 5), MATERIALS.body);
  body.position.set(0, height * 0.39, 0);
  root.add(body);

  const tank = new THREE.Mesh(makeRoundedBoxGeo(width * 0.68, height * 0.24, depth * 0.58, 10, 4), MATERIALS.glass);
  tank.position.set(0, height * 0.78 + height * 0.12, 0);
  root.add(tank);

  const tankOuter = new THREE.Mesh(makeRoundedBoxGeo(width * 0.68, height * 0.24, depth * 0.58, 10, 4), MATERIALS.bodyAlt);
  tankOuter.position.set(0, height * 0.78 + height * 0.12, 0);
  root.add(tankOuter);
  tankOuter.material = new THREE.MeshStandardMaterial({ color: 0xd0e8f5, roughness: 0.5, metalness: 0.06, transparent: true, opacity: 0.55 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 90, 10), MATERIALS.metal);
  post.position.set(width * 0.3, height * 0.52, depth / 2 + 28);
  root.add(post);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 70, 10), MATERIALS.metal);
  spout.rotation.z = Math.PI / 2;
  spout.position.set(width * 0.3 + 44, height * 0.42, depth / 2 + 28);
  root.add(spout);

  addPanel(root, { x: 0, y: height * 0.6, z: depth / 2 + 12, width: width * 0.54, height: height * 0.2 });
  addAccent(root, { x: 0, y: height * 0.35, z: depth / 2 + 14, width: width * 0.38, height: 12, accent });
  return { root, pickHeight: height + height * 0.24 };
}

function buildWall(width, depth, wallHeight) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallHeight, depth),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92, metalness: 0.05 }),
  );
  mesh.position.set(0, wallHeight / 2, 0);
  root.add(mesh);
  return { root, pickHeight: wallHeight };
}

export function buildPrefab3D(node) {
  if (node.type === 'wall') {
    return buildWall(node.width, node.depth, node.height3d);
  }

  switch (node.key) {
    case 'bench':
      return buildBench(node.width, node.depth, node.height3d);
    case 'fridge':
    case 'ultra_low_freezer':
      return buildFridgeLike(node.width, node.depth, node.height3d, node.accent);
    case 'incubator':
      return buildIncubator(node.width, node.depth, node.height3d, node.accent);
    case 'centrifuge':
      return buildCentrifuge(node.width, node.depth, node.height3d, node.accent);
    case 'sink':
      return buildSink(node.width, node.depth, node.height3d, node.accent);
    case 'hood':
      return buildHood(node.width, node.depth, node.height3d, node.accent);
    case 'pcr_machine':
      return buildPCR(node.width, node.depth, node.height3d, node.accent);
    case 'microscope':
      return buildMicroscope(node.width, node.depth, node.height3d, node.accent);
    case 'auto_analyzer':
      return buildAutoAnalyzer(node.width, node.depth, node.height3d, node.accent);
    case 'spectrophotometer':
      return buildSpectrophotometer(node.width, node.depth, node.height3d, node.accent);
    case 'automation_track':
      return buildAutomationTrack(node.width, node.depth, node.height3d, node.accent);
    case 'pure_water':
      return buildPureWater(node.width, node.depth, node.height3d, node.accent);
    default:
      return buildFridgeLike(node.width, node.depth, node.height3d, node.accent || '#60a5fa');
  }
}
