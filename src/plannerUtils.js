import { DEVICE_BY_KEY, WALL_BY_KEY, ZONE_BY_KEY } from './catalog.js';

export const GRID_PX = 10;
export const MM_PER_GRID = 100;
export const MM_PER_PX = MM_PER_GRID / GRID_PX;
export const STORAGE_KEY = 'lab_planner_design_v2';
export const SAFETY_CLEARANCE_MM_DEFAULT = 100;
export const MAX_HISTORY = 60;
export const DEFAULT_STROKE_BY_KIND = {
  device: '#1e293b',
  zone: '#3b82f6',
  wall: '#f97316',
};

export function pxToMm(px) {
  return Math.round(px * MM_PER_PX);
}

export function mmToPx(mm) {
  return Math.round(mm / MM_PER_PX);
}

export function fmtMm(mm) {
  return `${Math.round(mm)} mm`;
}

export function fmtCm(mm) {
  return `${Math.round(mm / 10)} cm`;
}

export function snapPx(value) {
  return Math.round(value / GRID_PX) * GRID_PX;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((item) => item + item).join('')
    : normalized;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function baseNode(overrides) {
  return {
    id: uid(),
    x: 100,
    y: 100,
    width: mmToPx(1200),
    depth: mmToPx(700),
    rotation: 0,
    height3d: mmToPx(900),
    fill: 'rgba(148, 163, 184, 0.12)',
    stroke: DEFAULT_STROKE_BY_KIND.device,
    accent: '#60a5fa',
    zoneColor: null,
    dash: [],
    clearanceMm: SAFETY_CLEARANCE_MM_DEFAULT,
    wallThicknessMm: 0,
    wallHeightMm: 0,
    wallOrientation: '',
    ...overrides,
  };
}

export function createPlacementNode(placementMode, pointer, snapEnabled = true) {
  if (!placementMode) {
    return null;
  }

  let node;

  if (placementMode.kind === 'device') {
    const item = DEVICE_BY_KEY.get(placementMode.key);
    if (!item) return null;
    node = baseNode({
      type: 'device',
      key: item.key,
      name: item.name,
      width: mmToPx(item.widthMm),
      depth: mmToPx(item.depthMm),
      height3d: mmToPx(item.heightMm),
      fill: 'rgba(255, 255, 255, 0.85)',
      stroke: DEFAULT_STROKE_BY_KIND.device,
      accent: item.accent,
      theme: item.theme,
    });
  } else if (placementMode.kind === 'zone') {
    const item = ZONE_BY_KEY.get(placementMode.key);
    if (!item) return null;
    node = baseNode({
      type: 'zone',
      key: item.key,
      name: item.name,
      width: mmToPx(item.widthMm),
      depth: mmToPx(item.depthMm),
      height3d: 0,
      fill: hexToRgba(item.color, 0.12),
      stroke: item.color,
      zoneColor: item.color,
      dash: [12, 8],
    });
  } else {
    const item = WALL_BY_KEY.get(placementMode.key);
    if (!item) return null;
    node = baseNode({
      type: 'wall',
      key: item.key,
      name: item.name,
      width: mmToPx(item.orientation === 'h' ? item.lengthMm : item.thicknessMm),
      depth: mmToPx(item.orientation === 'h' ? item.thicknessMm : item.lengthMm),
      height3d: mmToPx(item.heightMm),
      fill: 'rgba(249, 115, 22, 0.14)',
      stroke: DEFAULT_STROKE_BY_KIND.wall,
      wallThicknessMm: item.thicknessMm,
      wallHeightMm: item.heightMm,
      wallOrientation: item.orientation,
      clearanceMm: 0,
    });
  }

  const x = pointer.x - node.width / 2;
  const y = pointer.y - node.depth / 2;
  return applyGrid({ ...node, x, y }, snapEnabled);
}

export function applyGrid(node, snapEnabled) {
  if (!snapEnabled) return node;
  return {
    ...node,
    x: snapPx(node.x),
    y: snapPx(node.y),
    width: Math.max(GRID_PX, snapPx(node.width)),
    depth: Math.max(GRID_PX, snapPx(node.depth)),
  };
}

export function normalizeNode(rawNode) {
  const type = rawNode?.type === 'zone' || rawNode?.type === 'wall' ? rawNode.type : 'device';
  const fallbackStroke = DEFAULT_STROKE_BY_KIND[type] || DEFAULT_STROKE_BY_KIND.device;
  return baseNode({
    id: rawNode?.id || uid(),
    type,
    key: rawNode?.key || type,
    name: rawNode?.name || '未命名',
    x: Number(rawNode?.x ?? rawNode?.xPx ?? 100),
    y: Number(rawNode?.y ?? rawNode?.yPx ?? 100),
    width: Number(rawNode?.width ?? rawNode?.widthPx ?? mmToPx(Number(rawNode?.wMm ?? 1200))),
    depth: Number(rawNode?.depth ?? rawNode?.depthPx ?? mmToPx(Number(rawNode?.dMm ?? 700))),
    rotation: Number(rawNode?.rotation ?? rawNode?.rot ?? 0),
    height3d: Number(rawNode?.height3d ?? rawNode?.height3dPx ?? mmToPx(Number(rawNode?.hMm ?? 900))),
    fill: rawNode?.fill || (type === 'zone' ? 'rgba(59, 130, 246, 0.12)' : type === 'wall' ? 'rgba(249, 115, 22, 0.14)' : 'rgba(255, 255, 255, 0.85)'),
    stroke: rawNode?.stroke || fallbackStroke,
    accent: rawNode?.accent || '#60a5fa',
    zoneColor: rawNode?.zoneColor || null,
    dash: Array.isArray(rawNode?.dash) ? rawNode.dash : (type === 'zone' ? [12, 8] : []),
    clearanceMm: Number(rawNode?.clearanceMm ?? SAFETY_CLEARANCE_MM_DEFAULT),
    wallThicknessMm: Number(rawNode?.wallThicknessMm ?? 0),
    wallHeightMm: Number(rawNode?.wallHeightMm ?? 0),
    wallOrientation: rawNode?.wallOrientation || '',
    theme: rawNode?.theme || 'neutral',
  });
}

export function normalizeDesign(rawDesign) {
  return {
    version: 2,
    savedAt: rawDesign?.savedAt || new Date().toISOString(),
    ui: {
      gridVisible: rawDesign?.ui?.gridVisible ?? true,
      snapEnabled: rawDesign?.ui?.snapEnabled ?? true,
    },
    nodes: Array.isArray(rawDesign?.nodes) ? rawDesign.nodes.map(normalizeNode) : [],
  };
}

export function serializeDesign(design) {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    units: {
      gridPx: GRID_PX,
      mmPerGrid: MM_PER_GRID,
    },
    ui: design.ui,
    nodes: design.nodes.map((node) => ({
      ...node,
      xMm: pxToMm(node.x),
      yMm: pxToMm(node.y),
      wMm: pxToMm(node.width),
      dMm: pxToMm(node.depth),
      hMm: pxToMm(node.height3d),
      rot: node.rotation,
    })),
  };
}

function rotatePoint(x, y, degrees) {
  const radians = degrees * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

export function getNodeBounds(node) {
  const corners = [
    rotatePoint(0, 0, node.rotation),
    rotatePoint(node.width, 0, node.rotation),
    rotatePoint(node.width, node.depth, node.rotation),
    rotatePoint(0, node.depth, node.rotation),
  ].map((point) => ({ x: point.x + node.x, y: point.y + node.y }));

  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.width <= b.x
    || b.x + b.width <= a.x
    || a.y + a.height <= b.y
    || b.y + b.height <= a.y
  );
}

function getClosestSegmentBetweenRects(a, b) {
  const ax1 = a.x;
  const ay1 = a.y;
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx1 = b.x;
  const by1 = b.y;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const centerA = { x: (ax1 + ax2) / 2, y: (ay1 + ay2) / 2 };
  const centerB = { x: (bx1 + bx2) / 2, y: (by1 + by2) / 2 };

  const clampPoint = (point, rect) => ({
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height),
  });

  let best = {
    a: clampPoint(centerB, a),
    b: clampPoint(centerA, b),
  };

  const distanceSq = (segment) => (segment.a.x - segment.b.x) ** 2 + (segment.a.y - segment.b.y) ** 2;
  let bestDistance = distanceSq(best);

  const candidates = [];

  if (ax2 < bx1) {
    const y = clamp(centerA.y, by1, by2);
    candidates.push({ a: { x: ax2, y: clamp(y, ay1, ay2) }, b: { x: bx1, y } });
  }
  if (bx2 < ax1) {
    const y = clamp(centerB.y, ay1, ay2);
    candidates.push({ a: { x: ax1, y }, b: { x: bx2, y: clamp(y, by1, by2) } });
  }
  if (ay2 < by1) {
    const x = clamp(centerA.x, bx1, bx2);
    candidates.push({ a: { x: clamp(x, ax1, ax2), y: ay2 }, b: { x, y: by1 } });
  }
  if (by2 < ay1) {
    const x = clamp(centerB.x, ax1, ax2);
    candidates.push({ a: { x, y: ay1 }, b: { x: clamp(x, bx1, bx2), y: by2 } });
  }

  candidates.forEach((candidate) => {
    const distance = distanceSq(candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });

  return {
    ax: best.a.x,
    ay: best.a.y,
    bx: best.b.x,
    by: best.b.y,
  };
}

export function computeCollisions(nodes) {
  const devices = nodes.filter((node) => node.type === 'device');
  const pairs = [];
  const conflictIds = new Set();

  for (let i = 0; i < devices.length; i += 1) {
    for (let j = i + 1; j < devices.length; j += 1) {
      const first = devices[i];
      const second = devices[j];
      const firstBounds = getNodeBounds(first);
      const secondBounds = getNodeBounds(second);

      if (rectsOverlap(firstBounds, secondBounds)) {
        pairs.push({ type: 'overlap', aId: first.id, bId: second.id, gapMm: 0, needMm: 0, seg: null });
        conflictIds.add(first.id);
        conflictIds.add(second.id);
        continue;
      }

      const needMm = Math.max(first.clearanceMm || 0, second.clearanceMm || 0, SAFETY_CLEARANCE_MM_DEFAULT);
      const seg = getClosestSegmentBetweenRects(firstBounds, secondBounds);
      const gapPx = Math.hypot(seg.ax - seg.bx, seg.ay - seg.by);
      const gapMm = pxToMm(gapPx);

      if (gapMm < needMm) {
        pairs.push({ type: 'clearance', aId: first.id, bId: second.id, gapMm, needMm, seg });
        conflictIds.add(first.id);
        conflictIds.add(second.id);
      }
    }
  }

  return { pairs, conflictIds };
}

export function maybeSnapDeviceToWalls(node, nodes, snapEnabled) {
  if (node.type !== 'device') return node;
  const walls = nodes.filter((item) => item.type === 'wall');
  if (walls.length === 0) return snapEnabled ? applyGrid(node, snapEnabled) : node;

  const tolerance = mmToPx(50);
  const deviceBounds = getNodeBounds(node);
  let best = null;

  walls.forEach((wall) => {
    const bounds = getNodeBounds(wall);
    const candidates = [
      { axis: 'x', delta: (bounds.x + bounds.width) - deviceBounds.x, dist: Math.abs(deviceBounds.x - (bounds.x + bounds.width)) },
      { axis: 'x', delta: bounds.x - (deviceBounds.x + deviceBounds.width), dist: Math.abs((deviceBounds.x + deviceBounds.width) - bounds.x) },
      { axis: 'y', delta: (bounds.y + bounds.height) - deviceBounds.y, dist: Math.abs(deviceBounds.y - (bounds.y + bounds.height)) },
      { axis: 'y', delta: bounds.y - (deviceBounds.y + deviceBounds.height), dist: Math.abs((deviceBounds.y + deviceBounds.height) - bounds.y) },
    ].filter((item) => item.dist <= tolerance);

    candidates.forEach((candidate) => {
      if (!best || candidate.dist < best.dist) {
        best = candidate;
      }
    });
  });

  let next = { ...node };
  if (best?.axis === 'x') next.x += best.delta;
  if (best?.axis === 'y') next.y += best.delta;
  if (snapEnabled) next = applyGrid(next, snapEnabled);
  return next;
}

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
