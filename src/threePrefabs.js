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

const MATERIALS = {
  body: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.82, metalness: 0.02 }),
  bodyAlt: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.84, metalness: 0.02 }),
  base: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.92, metalness: 0.08 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.96, metalness: 0.02 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.28, metalness: 0.76 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.18, roughness: 0.12, metalness: 0 }),
  panel: (() => {
    const material = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.05 });
    material.emissive = new THREE.Color(0x60a5fa);
    material.emissiveIntensity = 0.7;
    return material;
  })(),
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
    default:
      return buildFridgeLike(node.width, node.depth, node.height3d, node.accent || '#60a5fa');
  }
}
