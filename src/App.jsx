import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './App.css';
import { DEVICE_CATALOG, WALL_CATALOG, ZONE_CATALOG } from './catalog.js';
import {
  DEFAULT_STROKE_BY_KIND,
  GRID_PX,
  MAX_HISTORY,
  SAFETY_CLEARANCE_MM_DEFAULT,
  STORAGE_KEY,
  applyGrid,
  computeCollisions,
  createPlacementNode,
  downloadText,
  fmtCm,
  fmtMm,
  getNodeBounds,
  hexToRgba,
  maybeSnapDeviceToWalls,
  mmToPx,
  normalizeDesign,
  pxToMm,
  serializeDesign,
  snapPx,
  uid,
} from './plannerUtils.js';
import { buildPrefab3D } from './threePrefabs.js';

const TAB_OPTIONS = [
  { key: 'devices', label: '設備' },
  { key: 'zones', label: '區域' },
  { key: 'walls', label: '牆體' },
];

const DEVICE_ICONS = {
  centrifuge: '⚙️',
  pcr_machine: '🧬',
  microscope: '🔬',
  auto_analyzer: '📊',
  spectrophotometer: '🌈',
  incubator: '🌡️',
  automation_track: '🔄',
  pure_water: '💧',
  fridge: '❄️',
  ultra_low_freezer: '🧊',
  bench: '🧪',
  hood: '💨',
  sink: '🚿',
};

const TAB_COPY = {
  devices: {
    title: '設備庫',
    hint: '用設備卡片放置常見儀器，系統會保留實際比例與安全淨距。',
  },
  zones: {
    title: '區域模板',
    hint: '用區域快速分出流程路徑，讓平面配置更像正式規劃圖。',
  },
  walls: {
    title: '牆體模組',
    hint: '用隔牆與半牆模擬動線、設備靠牆配置與局部遮擋。',
  },
};

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      const next = {
        width: Math.max(320, Math.round(element.clientWidth)),
        height: Math.max(360, Math.round(element.clientHeight)),
      };
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [ref]);

  return size;
}

function useUndoableDesign(initialDesign) {
  const [history, setHistory] = useState({ past: [], present: initialDesign, future: [] });

  const commit = useCallback((updater) => {
    setHistory((current) => {
      const nextPresent = typeof updater === 'function' ? updater(current.present) : updater;
      const currentString = JSON.stringify(current.present);
      const nextString = JSON.stringify(nextPresent);
      if (currentString === nextString) return current;
      return {
        past: [...current.past, current.present].slice(-MAX_HISTORY),
        present: nextPresent,
        future: [],
      };
    });
  }, []);

  const replace = useCallback((nextPresent) => {
    setHistory({ past: [], present: nextPresent, future: [] });
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, MAX_HISTORY),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) return current;
      const next = current.future[0];
      return {
        past: [...current.past, current.present].slice(-MAX_HISTORY),
        present: next,
        future: current.future.slice(1),
      };
    });
  }, []);

  return {
    design: history.present,
    commit,
    replace,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

function iconForNode(node) {
  if (node.type === 'wall') return '🧱';
  if (node.type === 'zone') return '▧';
  return DEVICE_ICONS[node.key] || '🧪';
}

function createDeviceVisual(group, node, isSelected, isConflict) {
  const stroke = isConflict ? '#f59e0b' : isSelected ? '#0ea5e9' : DEFAULT_STROKE_BY_KIND.device;
  const base = new Konva.Rect({
    width: node.width,
    height: node.depth,
    fill: 'rgba(255,255,255,0.95)',
    stroke,
    strokeWidth: isConflict || isSelected ? 3 : 2,
    cornerRadius: 18,
    shadowColor: 'rgba(15,23,42,0.18)',
    shadowBlur: isSelected ? 22 : 12,
    shadowOffsetY: 8,
    shadowOpacity: 0.2,
    name: 'main-rect',
  });
  const accent = new Konva.Rect({
    x: 0,
    y: 0,
    width: node.width,
    height: Math.max(10, node.depth * 0.12),
    fill: node.accent,
    cornerRadius: [18, 18, 0, 0],
    opacity: 0.94,
    listening: false,
  });
  const inner = new Konva.Rect({
    x: node.width * 0.08,
    y: node.depth * 0.28,
    width: node.width * 0.84,
    height: node.depth * 0.46,
    fill: hexToRgba(node.accent || '#60a5fa', 0.12),
    stroke: hexToRgba(node.accent || '#60a5fa', 0.48),
    strokeWidth: 1,
    cornerRadius: 12,
    listening: false,
  });
  const label = new Konva.Text({
    x: 16,
    y: 18,
    text: `${iconForNode(node)} ${node.name}`,
    fontSize: 16,
    fontStyle: '700',
    fill: '#0f172a',
    width: node.width - 32,
    listening: false,
  });
  const detail = new Konva.Text({
    x: 16,
    y: node.depth - 34,
    text: `${fmtMm(pxToMm(node.width))} × ${fmtMm(pxToMm(node.depth))}`,
    fontSize: 12,
    fill: '#475569',
    width: node.width - 32,
    align: 'right',
    listening: false,
  });
  group.add(base, accent, inner, label, detail);
}

function createZoneVisual(group, node, isSelected) {
  const fillColor = node.zoneColor || '#3b82f6';
  const rect = new Konva.Rect({
    width: node.width,
    height: node.depth,
    fill: node.fill,
    stroke: isSelected ? '#0ea5e9' : fillColor,
    strokeWidth: isSelected ? 3 : 2,
    dash: [14, 8],
    cornerRadius: 18,
    name: 'main-rect',
  });
  const title = new Konva.Text({
    x: 18,
    y: 18,
    text: `${iconForNode(node)} ${node.name}`,
    fontSize: 18,
    fontStyle: '700',
    fill: fillColor,
    width: node.width - 36,
    listening: false,
  });
  const sub = new Konva.Text({
    x: 18,
    y: 46,
    text: '流程 / 動線區域',
    fontSize: 12,
    fill: '#475569',
    listening: false,
  });
  const footer = new Konva.Text({
    x: 18,
    y: node.depth - 30,
    text: `${fmtMm(pxToMm(node.width))} × ${fmtMm(pxToMm(node.depth))}`,
    fontSize: 12,
    fill: '#475569',
    width: node.width - 36,
    align: 'right',
    listening: false,
  });
  group.add(rect, title, sub, footer);
}

function createWallVisual(group, node, isSelected) {
  const rect = new Konva.Rect({
    width: node.width,
    height: node.depth,
    fill: 'rgba(249,115,22,0.18)',
    stroke: isSelected ? '#ea580c' : DEFAULT_STROKE_BY_KIND.wall,
    strokeWidth: isSelected ? 3 : 2,
    cornerRadius: 12,
    name: 'main-rect',
  });
  const stripe = new Konva.Rect({
    x: 6,
    y: 6,
    width: Math.max(0, node.width - 12),
    height: Math.max(0, node.depth - 12),
    fill: 'rgba(249,115,22,0.08)',
    dash: [6, 5],
    stroke: 'rgba(249,115,22,0.38)',
    strokeWidth: 1,
    cornerRadius: 8,
    listening: false,
  });
  group.add(rect, stripe);
}

function App() {
  const initialDesign = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeDesign(JSON.parse(raw)) : normalizeDesign({ nodes: [], ui: { gridVisible: true, snapEnabled: true } });
    } catch {
      return normalizeDesign({ nodes: [], ui: { gridVisible: true, snapEnabled: true } });
    }
  }, []);

  const { design, commit, replace, undo, redo, canUndo, canRedo } = useUndoableDesign(initialDesign);
  const [selectedTab, setSelectedTab] = useState('devices');
  const [selectedIds, setSelectedIds] = useState([]);
  const [placementMode, setPlacementMode] = useState(null);
  const [is3DVisible, setIs3DVisible] = useState(false);
  const [toast, setToast] = useState('');
  const [infoCard, setInfoCard] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const fileInputRef = useRef(null);
  const canvasPanelRef = useRef(null);
  const canvasHostRef = useRef(null);
  const threeHostRef = useRef(null);
  const designRef = useRef(design);
  const selectionRef = useRef(selectedIds);
  const placementRef = useRef(placementMode);
  const is3DVisibleRef = useRef(is3DVisible);
  const toastTimerRef = useRef(null);
  const scene2DRef = useRef({ stage: null, gridLayer: null, mainLayer: null, warningLayer: null, transformer: null, selectionRect: null, nodeMap: new Map(), marquee: null });
  const scene3DRef = useRef({ scene: null, renderer: null, camera: null, controls: null, objectsGroup: null, threeMap: new Map(), pickables: [], raycaster: null, pointer: null, initialized: false, cleanup: null });
  const apiRef = useRef({});
  const canvasSize = useElementSize(canvasPanelRef);

  const collisions = useMemo(() => computeCollisions(design.nodes), [design.nodes]);
  const selectedNodes = useMemo(
    () => design.nodes.filter((node) => selectedIds.includes(node.id)),
    [design.nodes, selectedIds],
  );

  const metrics = useMemo(() => ({
    devices: design.nodes.filter((node) => node.type === 'device').length,
    zones: design.nodes.filter((node) => node.type === 'zone').length,
    walls: design.nodes.filter((node) => node.type === 'wall').length,
  }), [design.nodes]);

  const pushToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 1600);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setInfoCard(null);
  }, []);

  const selectOnly = useCallback((id) => {
    setSelectedIds(id ? [id] : []);
    setInfoCard(null);
  }, []);

  const toggleSelection = useCallback((id) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    setInfoCard(null);
  }, []);

  const updateNode = useCallback((id, patch) => {
    commit((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
    }));
  }, [commit]);

  const updateSelectedNode = useCallback((patch) => {
    if (selectedIds.length !== 1) return;
    updateNode(selectedIds[0], patch);
  }, [selectedIds, updateNode]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    commit((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => !selectedIds.includes(node.id)),
    }));
    setSelectedIds([]);
    setInfoCard(null);
    pushToast('已刪除選取物件');
  }, [commit, pushToast, selectedIds]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    commit((current) => {
      const clones = current.nodes
        .filter((node) => selectedIds.includes(node.id))
        .map((node) => applyGrid({ ...node, id: uid(), x: node.x + 40, y: node.y + 40, name: `${node.name} 副本` }, current.ui.snapEnabled));
      return { ...current, nodes: [...current.nodes, ...clones] };
    });
    pushToast('已複製選取物件');
  }, [commit, pushToast, selectedIds]);

  const addPlacementAt = useCallback((pointer) => {
    const node = createPlacementNode(placementRef.current, pointer, designRef.current.ui.snapEnabled);
    if (!node) return;
    commit((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedIds([node.id]);
    setPlacementMode(null);
    pushToast(`已放置 ${node.name}`);
  }, [commit, pushToast]);

  const resetDesign = useCallback((clearStorage = false) => {
    replace(normalizeDesign({ nodes: [], ui: designRef.current.ui }));
    setSelectedIds([]);
    setPlacementMode(null);
    setInfoCard(null);
    if (clearStorage) localStorage.removeItem(STORAGE_KEY);
    pushToast('已重置規劃');
  }, [pushToast, replace]);

  const exportPNG = useCallback(() => {
    const stage = scene2DRef.current.stage;
    if (!stage) return;
    const anchor = document.createElement('a');
    anchor.href = stage.toDataURL({ pixelRatio: 2 });
    anchor.download = 'lab-planner.png';
    anchor.click();
    pushToast('已匯出 PNG');
  }, [pushToast]);

  const exportPDF = useCallback(() => {
    const stage = scene2DRef.current.stage;
    if (!stage) return;
    import('jspdf').then(({ jsPDF }) => {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [stage.width(), stage.height()] });
      pdf.addImage(stage.toDataURL({ pixelRatio: 2 }), 'PNG', 0, 0, stage.width(), stage.height());
      pdf.save('lab-planner.pdf');
      pushToast('已匯出 PDF');
    }).catch(() => {
      pushToast('PDF 匯出失敗');
    });
  }, [pushToast]);

  const exportJSON = useCallback(() => {
    downloadText('lab-planner-design.json', JSON.stringify(serializeDesign(designRef.current), null, 2));
    pushToast('已匯出 JSON');
  }, [pushToast]);

  const importJSON = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        replace(normalizeDesign(parsed));
        setSelectedIds([]);
        setPlacementMode(null);
        pushToast('已匯入設計');
      } catch {
        pushToast('匯入失敗');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [pushToast, replace]);

  useEffect(() => {
    designRef.current = design;
  }, [design]);

  useEffect(() => {
    selectionRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    placementRef.current = placementMode;
  }, [placementMode]);

  useEffect(() => {
    is3DVisibleRef.current = is3DVisible;
  }, [is3DVisible]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDesign(design)));
  }, [design]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => design.nodes.some((node) => node.id === id)));
  }, [design.nodes]);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    apiRef.current = {
      clearSelection,
      selectOnly,
      toggleSelection,
      addPlacementAt,
      updateNodeFromCanvas: (id, nextNode) => {
        commit((current) => ({
          ...current,
          nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...nextNode } : node)),
        }));
      },
      showInfoCard: setInfoCard,
    };
  }, [addPlacementAt, clearSelection, commit, selectOnly, toggleSelection]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (event.key === 'Escape') {
        if (placementRef.current) {
          setPlacementMode(null);
          pushToast('已取消放置模式');
          return;
        }
        clearSelection();
        return;
      }
      if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace')) {
        deleteSelected();
        event.preventDefault();
      }
      if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        undo();
        event.preventDefault();
      }
      if (!isTyping && (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z'))) {
        redo();
        event.preventDefault();
      }
      if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        duplicateSelected();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, deleteSelected, duplicateSelected, pushToast, redo, undo]);

  useEffect(() => {
    if (!canvasHostRef.current || scene2DRef.current.stage) return undefined;

    const stage = new Konva.Stage({
      container: canvasHostRef.current,
      width: canvasSize.width || 800,
      height: canvasSize.height || 640,
    });
    const gridLayer = new Konva.Layer();
    const warningLayer = new Konva.Layer();
    const mainLayer = new Konva.Layer();
    stage.add(gridLayer);
    stage.add(warningLayer);
    stage.add(mainLayer);

    scene2DRef.current = {
      stage,
      gridLayer,
      mainLayer,
      warningLayer,
      transformer: null,
      selectionRect: null,
      nodeMap: new Map(),
      marquee: { active: false, start: null },
    };

    const handleStageClick = (event) => {
      if (event.target !== stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      if (placementRef.current) {
        apiRef.current.addPlacementAt(pointer);
        return;
      }
      apiRef.current.clearSelection();
    };

    const handleMouseDown = (event) => {
      if (is3DVisibleRef.current || placementRef.current || event.target !== stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const state = scene2DRef.current;
      state.marquee = { active: true, start: pointer };
      if (state.selectionRect) {
        state.selectionRect.visible(true);
        state.selectionRect.position(pointer);
        state.selectionRect.size({ width: 0, height: 0 });
        state.mainLayer.batchDraw();
      }
    };

    const handleMouseMove = () => {
      const state = scene2DRef.current;
      if (!state.marquee?.active || !state.selectionRect) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const { start } = state.marquee;
      state.selectionRect.setAttrs({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        width: Math.abs(pos.x - start.x),
        height: Math.abs(pos.y - start.y),
      });
      state.mainLayer.batchDraw();
    };

    const handleMouseUp = (event) => {
      const state = scene2DRef.current;
      if (!state.marquee?.active || !state.selectionRect) return;
      state.marquee = { active: false, start: null };
      const box = state.selectionRect.getClientRect();
      state.selectionRect.visible(false);
      const hits = [...state.nodeMap.values()]
        .filter((entry) => Konva.Util.haveIntersection(box, entry.group.getClientRect()))
        .map((entry) => entry.id);
      if (hits.length > 0) {
        setSelectedIds((current) => (event.evt?.shiftKey ? [...new Set([...current, ...hits])] : hits));
      }
      state.mainLayer.draw();
    };

    stage.on('click tap', handleStageClick);
    stage.on('mousedown touchstart', handleMouseDown);
    stage.on('mousemove touchmove', handleMouseMove);
    stage.on('mouseup touchend', handleMouseUp);

    return () => {
      stage.destroy();
      scene2DRef.current = { stage: null, gridLayer: null, mainLayer: null, warningLayer: null, transformer: null, selectionRect: null, nodeMap: new Map(), marquee: null };
    };
  }, [canvasSize.height, canvasSize.width]);

  useEffect(() => {
    const stage = scene2DRef.current.stage;
    if (!stage || !canvasSize.width || !canvasSize.height) return;
    stage.width(canvasSize.width);
    stage.height(canvasSize.height);
  }, [canvasSize.height, canvasSize.width]);

  useEffect(() => {
    const { stage, gridLayer, mainLayer, warningLayer } = scene2DRef.current;
    if (!stage || !gridLayer || !mainLayer || !warningLayer) return;

    gridLayer.destroyChildren();
    if (design.ui.gridVisible) {
      for (let x = 0; x <= stage.width(); x += GRID_PX) {
        gridLayer.add(new Konva.Line({ points: [x, 0, x, stage.height()], stroke: 'rgba(148,163,184,0.14)', strokeWidth: 1 }));
      }
      for (let y = 0; y <= stage.height(); y += GRID_PX) {
        gridLayer.add(new Konva.Line({ points: [0, y, stage.width(), y], stroke: 'rgba(148,163,184,0.14)', strokeWidth: 1 }));
      }
    }

    warningLayer.destroyChildren();
    collisions.pairs.filter((pair) => pair.type === 'clearance' && pair.seg).forEach((pair) => {
      const line = new Konva.Line({
        points: [pair.seg.ax, pair.seg.ay, pair.seg.bx, pair.seg.by],
        stroke: 'rgba(245,158,11,0.95)',
        strokeWidth: 2,
        dash: [10, 7],
      });
      const midX = (pair.seg.ax + pair.seg.bx) / 2;
      const midY = (pair.seg.ay + pair.seg.by) / 2;
      const text = new Konva.Text({
        x: midX + 6,
        y: midY + 6,
        text: `${pair.gapMm}mm / 需 ≥ ${pair.needMm}mm`,
        fontSize: 12,
        fontStyle: '700',
        fill: '#92400e',
      });
      const bg = new Konva.Rect({
        x: text.x() - 4,
        y: text.y() - 2,
        width: text.width() + 8,
        height: text.height() + 4,
        fill: 'rgba(255,237,213,0.9)',
        stroke: 'rgba(245,158,11,0.45)',
        strokeWidth: 1,
        cornerRadius: 8,
      });
      warningLayer.add(line, bg, text);
    });

    mainLayer.destroyChildren();
    const nodeMap = new Map();

    design.nodes.forEach((node) => {
      const isSelected = selectedIds.includes(node.id);
      const isConflict = collisions.conflictIds.has(node.id);
      const group = new Konva.Group({ x: node.x, y: node.y, rotation: node.rotation, draggable: !is3DVisible, id: node.id, name: node.type });

      if (node.type === 'device') createDeviceVisual(group, node, isSelected, isConflict);
      if (node.type === 'zone') createZoneVisual(group, node, isSelected);
      if (node.type === 'wall') createWallVisual(group, node, isSelected);

      group.on('click tap', (event) => {
        event.cancelBubble = true;
        if (event.evt?.shiftKey) {
          apiRef.current.toggleSelection(node.id);
        } else {
          apiRef.current.selectOnly(node.id);
        }
      });

      group.on('dragend', () => {
        const others = designRef.current.nodes.filter((item) => item.id !== node.id);
        let nextNode = { ...node, x: group.x(), y: group.y(), rotation: group.rotation() };
        if (designRef.current.ui.snapEnabled) nextNode = applyGrid(nextNode, true);
        nextNode = maybeSnapDeviceToWalls(nextNode, others, designRef.current.ui.snapEnabled);
        apiRef.current.updateNodeFromCanvas(node.id, nextNode);
      });

      group.on('transformend', () => {
        const mainRect = group.findOne('.main-rect');
        const scaleX = group.scaleX();
        const scaleY = group.scaleY();
        let nextNode = {
          ...node,
          x: group.x(),
          y: group.y(),
          rotation: group.rotation(),
          width: Math.max(GRID_PX, mainRect.width() * scaleX),
          depth: Math.max(GRID_PX, mainRect.height() * scaleY),
        };
        if (designRef.current.ui.snapEnabled) nextNode = applyGrid(nextNode, true);
        nextNode = maybeSnapDeviceToWalls(nextNode, designRef.current.nodes.filter((item) => item.id !== node.id), designRef.current.ui.snapEnabled);
        group.scaleX(1);
        group.scaleY(1);
        apiRef.current.updateNodeFromCanvas(node.id, nextNode);
      });

      mainLayer.add(group);
      nodeMap.set(node.id, { id: node.id, group });
      if (node.type === 'zone') group.moveToBottom();
    });

    const selectionRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      fill: 'rgba(14,165,233,0.12)',
      stroke: 'rgba(14,165,233,0.92)',
      strokeWidth: 1,
      visible: false,
      listening: false,
      cornerRadius: 8,
    });

    const transformer = new Konva.Transformer({
      keepRatio: false,
      rotateEnabled: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'],
      anchorSize: 10,
      borderStroke: '#0ea5e9',
      borderStrokeWidth: 2,
      anchorFill: '#e0f2fe',
      anchorStroke: '#0369a1',
      anchorCornerRadius: 5,
      padding: 6,
    });

    mainLayer.add(selectionRect);
    mainLayer.add(transformer);
    transformer.nodes(selectedIds.map((id) => nodeMap.get(id)?.group).filter(Boolean));

    scene2DRef.current.nodeMap = nodeMap;
    scene2DRef.current.selectionRect = selectionRect;
    scene2DRef.current.transformer = transformer;
    gridLayer.draw();
    warningLayer.draw();
    mainLayer.draw();
  }, [collisions.conflictIds, collisions.pairs, design.nodes, design.ui.gridVisible, is3DVisible, selectedIds]);

  useEffect(() => {
    if (!threeHostRef.current || scene3DRef.current.initialized) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 40000);
    camera.position.set(1200, 1200, 1200);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    threeHostRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xd0e8ff, 0.55));

    const directional = new THREE.DirectionalLight(0xffffff, 1.1);
    directional.position.set(1400, 2000, 900);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 1;
    directional.shadow.camera.far = 30000;
    directional.shadow.camera.left = -9000;
    directional.shadow.camera.right = 9000;
    directional.shadow.camera.top = 9000;
    directional.shadow.camera.bottom = -9000;
    scene.add(directional);

    const fillLight = new THREE.DirectionalLight(0x7090ff, 0.35);
    fillLight.position.set(-800, 600, -600);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.18);
    rimLight.position.set(0, -400, 1200);
    scene.add(rimLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(new THREE.GridHelper(20000, 200, 0x334155, 0x1e293b));

    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event) => {
      const current = scene3DRef.current;
      if (!current.renderer || !is3DVisibleRef.current) return;
      const rect = current.renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(pointer, current.camera);
      const hits = raycaster.intersectObjects(current.pickables, false);
      if (hits.length === 0) {
        apiRef.current.clearSelection();
        apiRef.current.showInfoCard(null);
        return;
      }
      const hitId = hits[0].object.userData?.nodeId;
      const hitNode = designRef.current.nodes.find((node) => node.id === hitId);
      if (!hitNode) return;
      if (event.shiftKey) {
        apiRef.current.toggleSelection(hitId);
      } else {
        apiRef.current.selectOnly(hitId);
      }
      apiRef.current.showInfoCard({
        nodeId: hitId,
        x: event.clientX,
        y: event.clientY,
      });
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    scene3DRef.current = {
      scene,
      renderer,
      camera,
      controls,
      objectsGroup,
      threeMap: new Map(),
      pickables: [],
      raycaster,
      pointer,
      initialized: true,
      cleanup: () => renderer.domElement.removeEventListener('pointerdown', handlePointerDown),
    };

    return () => {
      scene3DRef.current.cleanup?.();
      renderer.dispose();
      if (threeHostRef.current?.contains(renderer.domElement)) {
        threeHostRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const current = scene3DRef.current;
    if (!current.renderer || !canvasSize.width || !canvasSize.height) return;
    current.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    current.renderer.setSize(canvasSize.width, canvasSize.height, false);
    current.camera.aspect = canvasSize.width / canvasSize.height;
    current.camera.updateProjectionMatrix();
  }, [canvasSize.height, canvasSize.width]);

  useEffect(() => {
    const current = scene3DRef.current;
    if (!current.scene || !current.objectsGroup || !current.renderer || !current.camera || !canvasSize.width || !canvasSize.height) return;

    while (current.objectsGroup.children.length) current.objectsGroup.remove(current.objectsGroup.children[0]);
    current.threeMap = new Map();
    current.pickables = [];

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    design.nodes.forEach((node) => {
      const x3d = node.x + node.width / 2 - centerX;
      const z3d = node.y + node.depth / 2 - centerY;

      if (node.type === 'zone') {
        const zoneMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(node.width, node.depth),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(node.zoneColor || '#3b82f6'),
            transparent: true,
            opacity: selectedIds.includes(node.id) ? 0.3 : 0.18,
            roughness: 0.95,
            metalness: 0,
            side: THREE.DoubleSide,
          }),
        );
        zoneMesh.rotation.x = -Math.PI / 2;
        zoneMesh.position.set(x3d, 1, z3d);
        zoneMesh.userData = { nodeId: node.id };
        const outline = new THREE.LineSegments(new THREE.EdgesGeometry(zoneMesh.geometry), new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.95 }));
        outline.rotation.copy(zoneMesh.rotation);
        outline.position.copy(zoneMesh.position);
        outline.visible = selectedIds.includes(node.id);
        const root = new THREE.Group();
        root.add(zoneMesh, outline);
        current.objectsGroup.add(root);
        current.threeMap.set(node.id, { root, outline, kind: node.type });
        current.pickables.push(zoneMesh);
        return;
      }

      const prefab = buildPrefab3D(node);
      const root = prefab.root;
      root.position.set(x3d, 0, z3d);
      root.rotation.y = -THREE.MathUtils.degToRad(node.rotation);
      root.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });

      const pickGeometry = new THREE.BoxGeometry(node.width, prefab.pickHeight || node.height3d, node.depth);
      const pickMesh = new THREE.Mesh(pickGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
      pickMesh.position.set(0, (prefab.pickHeight || node.height3d) / 2, 0);
      pickMesh.userData = { nodeId: node.id };
      root.add(pickMesh);

      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(pickGeometry), new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.95 }));
      outline.position.copy(pickMesh.position);
      outline.visible = selectedIds.includes(node.id) || collisions.conflictIds.has(node.id);
      if (collisions.conflictIds.has(node.id)) {
        const hard = collisions.pairs.some((pair) => pair.type === 'overlap' && (pair.aId === node.id || pair.bId === node.id));
        outline.material.color.setHex(hard ? 0xef4444 : 0xf59e0b);
      }
      root.add(outline);
      current.objectsGroup.add(root);
      current.threeMap.set(node.id, { root, outline, kind: node.type });
      current.pickables.push(pickMesh);
    });

    const maxDimension = Math.max(canvasSize.width, canvasSize.height, 1200);
    const distance = Math.abs((maxDimension / 2) / Math.tan((current.camera.fov * Math.PI) / 360)) * 1.25;
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    current.camera.position.copy(direction.multiplyScalar(distance));
    current.camera.near = Math.max(1, distance / 100);
    current.camera.far = Math.max(40000, distance * 10);
    current.camera.updateProjectionMatrix();
    current.controls.target.set(0, 0, 0);
    current.controls.update();

    if (is3DVisible) {
      current.renderer.render(current.scene, current.camera);
    }
  }, [canvasSize.height, canvasSize.width, collisions.conflictIds, collisions.pairs, design.nodes, is3DVisible, selectedIds]);

  useEffect(() => {
    const current = scene3DRef.current;
    if (!current.renderer || !current.scene || !current.camera) return undefined;
    let frameId = 0;

    const renderFrame = () => {
      if (!is3DVisibleRef.current) return;
      current.controls.update();
      current.renderer.render(current.scene, current.camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    if (is3DVisible) {
      frameId = window.requestAnimationFrame(renderFrame);
    }

    return () => window.cancelAnimationFrame(frameId);
  }, [is3DVisible]);

  const activeInfoNode = infoCard ? design.nodes.find((node) => node.id === infoCard.nodeId) : null;

  const GROUP_LABELS = { instruments: '儀器設備', furniture: '家具設施' };

  const renderLibraryCards = () => {
    if (selectedTab === 'devices') {
      const q = sidebarSearch.trim().toLowerCase();
      const filtered = q
        ? DEVICE_CATALOG.filter((item) => item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
        : DEVICE_CATALOG;

      const groups = [];
      const seen = new Set();
      filtered.forEach((item) => {
        if (!seen.has(item.group)) { seen.add(item.group); groups.push(item.group); }
      });

      return (
        <>
          {groups.map((group) => {
            const groupPlacedCount = design.nodes.filter((node) => node.type === 'device' && filtered.some((item) => item.key === node.key && item.group === group)).length;
            return (
            <div key={group}>
              <div className="group-label">{GROUP_LABELS[group] || group} <span>{groupPlacedCount} 已放置</span></div>
              <div className="library-grid">
                {filtered.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`library-card${placementMode?.key === item.key ? ' library-card--active' : ''}`}
                    onClick={() => setPlacementMode({ kind: 'device', key: item.key, label: item.name })}
                  >
                    <div className="library-card__head">
                      <div className="library-card__icon">{DEVICE_ICONS[item.key] || '🧪'}</div>
                      <div>
                        <div className="library-card__name">{item.name}</div>
                        <div className="library-card__sub">{item.widthMm}×{item.depthMm}mm</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            );
          })}
          {filtered.length === 0 && <div className="empty-search">找不到符合的元件</div>}
        </>
      );
    }

    if (selectedTab === 'zones') {
      return (
        <>
          <div className="group-label">區域模板 <span>{metrics.zones} 已放置</span></div>
          <div className="library-grid">
            {ZONE_CATALOG.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`library-card${placementMode?.key === item.key ? ' library-card--active' : ''}`}
                onClick={() => setPlacementMode({ kind: 'zone', key: item.key, label: item.name })}
              >
                <div className="library-card__head">
                  <div className="library-card__icon" style={{ background: `${item.color}22`, color: item.color }}>▧</div>
                  <div>
                    <div className="library-card__name">{item.name}</div>
                    <div className="library-card__sub">{item.widthMm}×{item.depthMm}mm</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="group-label">牆體模組 <span>{metrics.walls} 已放置</span></div>
        <div className="library-grid">
          {WALL_CATALOG.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`library-card${placementMode?.key === item.key ? ' library-card--active' : ''}`}
              onClick={() => setPlacementMode({ kind: 'wall', key: item.key, label: item.name })}
            >
              <div className="library-card__head">
                <div className="library-card__icon">🧱</div>
                <div>
                  <div className="library-card__name">{item.name}</div>
                  <div className="library-card__sub">高 {item.heightMm}mm · 厚 {item.thicknessMm}mm</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </>
    );
  };

  const singleSelected = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const singleBounds = singleSelected ? getNodeBounds(singleSelected) : null;
  const overlapPairs = collisions.pairs.filter((pair) => pair.type === 'overlap').length;
  const clearancePairs = collisions.pairs.filter((pair) => pair.type === 'clearance').length;

  return (
    <div className="app-shell">
      {/* ── Global top navigation bar ── */}
      <header className="topnav">
        <div className="topnav__brand">
          <div className="brand-mark">L</div>
          <span className="brand-name">ISO 15189 Lab Designer</span>
        </div>

        <div className="topnav__tools">
          <button type="button" className="tn-btn" onClick={undo} disabled={!canUndo} title="撤銷 Ctrl+Z">↶</button>
          <button type="button" className="tn-btn" onClick={redo} disabled={!canRedo} title="重做 Ctrl+Y">↷</button>
          <button type="button" className="tn-btn" onClick={duplicateSelected} disabled={selectedIds.length === 0} title="複製 Ctrl+D">⧉</button>
          <button type="button" className="tn-btn" onClick={deleteSelected} disabled={selectedIds.length === 0} title="刪除 Del">⌫</button>
          <div className="tn-sep" />
          <button
            type="button"
            className={`tn-btn${design.ui.gridVisible ? ' tn-btn--active' : ''}`}
            onClick={() => commit((current) => ({ ...current, ui: { ...current.ui, gridVisible: !current.ui.gridVisible } }))}
            title="格線"
          >
            #
          </button>
          <button
            type="button"
            className={`tn-btn${design.ui.snapEnabled ? ' tn-btn--active' : ''}`}
            onClick={() => commit((current) => ({ ...current, ui: { ...current.ui, snapEnabled: !current.ui.snapEnabled } }))}
            title="磁吸"
          >
            ⛶
          </button>
        </div>

        <div className="topnav__actions">
          <button type="button" className="tn-btn" onClick={exportPDF} title="匯出 PDF">匯出 PDF</button>
          <button type="button" className="tn-btn" onClick={() => fileInputRef.current?.click()} title="匯入 JSON">儲存/載入</button>
          <button
            type="button"
            className={`view-toggle-btn${is3DVisible ? ' view-toggle-btn--2d' : ''}`}
            onClick={() => setIs3DVisible((current) => !current)}
          >
            {is3DVisible ? '◧ VIEW 2D' : '◨ VIEW 3D'}
          </button>
        </div>
      </header>

      {/* ── Left sidebar: component library ── */}
      <aside className="sidebar panel">
        <div className="sidebar__header">
          <span className="sidebar__title">元件庫</span>
          <div className="sidebar__metrics">
            <span className="metric-chip">{metrics.devices} 設備</span>
            <span className="metric-chip">{collisions.pairs.length > 0 ? `⚠ ${collisions.pairs.length}` : '✓ 安全'}</span>
          </div>
        </div>

        <div className="sidebar__search">
          <input
            placeholder="搜尋元件名稱..."
            value={sidebarSearch}
            onChange={(event) => setSidebarSearch(event.target.value)}
          />
        </div>

        <div className="tabs">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab ${selectedTab === tab.key ? 'tab--active' : ''}`}
              onClick={() => { setSelectedTab(tab.key); setSidebarSearch(''); }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="library-panel">
          {renderLibraryCards()}
        </div>

        <div className="placement-banner">
          {placementMode ? (
            <div className="notice-card">
              <strong>放置模式：</strong>{placementMode.label}<br />
              點畫布放置，Esc 取消。
            </div>
          ) : (
            <div className="notice-card">
              <strong>{TAB_COPY[selectedTab].hint}</strong>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main canvas workspace ── */}
      <main className="workspace">
        <div className="toolbar">
          <div className="toolbar__cluster">
            <button type="button" className="icon-button" onClick={exportPNG} title="匯出 PNG">PNG</button>
            <button type="button" className="icon-button" onClick={exportJSON} title="匯出 JSON">JSON</button>
          </div>

          <div className="toolbar__spacer" />

          <div className="toolbar__cluster">
            <button type="button" className="ghost-button" onClick={() => resetDesign(true)}>清空重置</button>
            <div className="pill" style={{ fontSize: 11 }}>
              {is3DVisible ? '3D 視角：拖曳旋轉 / 滾輪縮放' : `格線 ${design.ui.gridVisible ? '開啟' : '關閉'} · 吸附 ${design.ui.snapEnabled ? '開啟' : '關閉'}`}
            </div>
          </div>
        </div>

        <div className="canvas-panel" ref={canvasPanelRef}>
          <div ref={canvasHostRef} className={`canvas-stage ${is3DVisible ? 'canvas-stage--hidden' : ''}`} />
          <div ref={threeHostRef} className={`three-stage ${is3DVisible ? '' : 'three-stage--hidden'}`} />

          {!is3DVisible && design.nodes.length === 0 && (
            <div className="workspace-card">
              <h3>從左側元件庫開始建立規劃</h3>
              <p>先放置區域與牆體，再放設備。系統會顯示安全距離不足、支援撤銷重做，也可直接匯出成果圖。</p>
              <div className="workspace-card__footer">
                <span className="hotkey">Shift：多選</span>
                <span className="hotkey">Delete：刪除</span>
                <span className="hotkey">Ctrl/Cmd + Z：撤銷</span>
              </div>
            </div>
          )}

          {!is3DVisible && design.nodes.length > 0 && (
            <div className="workspace-card">
              <h3>目前規劃摘要</h3>
              <p>
                共 {design.nodes.length} 個物件，{overlapPairs} 組重疊、{clearancePairs} 組安全距離不足。
              </p>
              <div className="workspace-card__footer">
                <span className={`pill ${collisions.pairs.length === 0 ? 'status-chip--safe' : clearancePairs > 0 ? 'status-chip--warning' : 'status-chip--danger'}`}>
                  {collisions.pairs.length === 0 ? '目前無安全警示' : '請檢查橘色距離線與衝突外框'}
                </span>
              </div>
            </div>
          )}

          {is3DVisible && (
            <div className="threed-banner">
              <span className="threed-badge">3D ENGINE: HYBRID INTERACTION MODE STABLE</span>
              <span className="threed-info">已啟用 3D 空間位移與穩定懸停</span>
            </div>
          )}

          {activeInfoNode && infoCard && is3DVisible && (
            <div
              className="info-card"
              style={{
                left: Math.min(infoCard.x + 14, window.innerWidth - 340),
                top: Math.min(infoCard.y + 14, window.innerHeight - 220),
              }}
            >
              <div className="info-card__title">
                <div className="info-card__badge">{iconForNode(activeInfoNode)}</div>
                <div>
                  <strong>{activeInfoNode.name}</strong>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{activeInfoNode.type}</div>
                </div>
              </div>
              <div className="info-card__row"><span>尺寸</span><span>{fmtMm(pxToMm(activeInfoNode.width))} × {fmtMm(pxToMm(activeInfoNode.depth))}</span></div>
              <div className="info-card__row"><span>高度</span><span>{fmtCm(pxToMm(activeInfoNode.height3d))}</span></div>
              <div className="info-card__row"><span>座標</span><span>{fmtMm(pxToMm(activeInfoNode.x))}, {fmtMm(pxToMm(activeInfoNode.y))}</span></div>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" className="hidden-file-input" accept="application/json" onChange={importJSON} />
      </main>

      <aside className="inspector panel">
        <div className="inspector__head">
          <h2>屬性 / 檢查</h2>
          <p>這裡會顯示目前選取物件的尺寸、位置與安全資訊，也提供快速修正。</p>
        </div>
        <div className="inspector__body">
          <div className="inspector-card">
            <h3 className="inspector-card__title">專案狀態</h3>
            <div className="inspector-card__meta">
              <span className={`pill ${collisions.pairs.length === 0 ? 'status-chip--safe' : 'status-chip--warning'}`}>
                {collisions.pairs.length === 0 ? '無安全警示' : `${collisions.pairs.length} 組待處理`}
              </span>
              <span className="pill">{design.nodes.length} 個物件</span>
            </div>
            <div className="stats-list">
              <div className="stats-item"><span>設備</span><strong>{metrics.devices}</strong></div>
              <div className="stats-item"><span>區域</span><strong>{metrics.zones}</strong></div>
              <div className="stats-item"><span>牆體</span><strong>{metrics.walls}</strong></div>
              <div className="stats-item"><span>重疊</span><strong>{overlapPairs}</strong></div>
              <div className="stats-item"><span>淨距不足</span><strong>{clearancePairs}</strong></div>
            </div>
          </div>

          {selectedNodes.length === 0 && (
            <div className="inspector-card empty-state">
              <h3 className="inspector-card__title">尚未選取物件</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                選取單一設備可直接編輯尺寸、位置、旋轉與安全距離；多選時可批次刪除或複製。
              </p>
            </div>
          )}

          {selectedNodes.length > 1 && (
            <div className="inspector-card">
              <h3 className="inspector-card__title">已選取 {selectedNodes.length} 個物件</h3>
              <div className="inline-actions">
                <button type="button" className="secondary-button" onClick={duplicateSelected}>複製選取</button>
                <button type="button" className="ghost-button" onClick={deleteSelected}>刪除選取</button>
              </div>
            </div>
          )}

          {singleSelected && (
            <div className="inspector-card">
              <h3 className="inspector-card__title">{singleSelected.name}</h3>
              <div className="inspector-card__meta">
                <span className="pill">{singleSelected.type}</span>
                <span className="pill">{iconForNode(singleSelected)} {singleSelected.key}</span>
                {collisions.conflictIds.has(singleSelected.id) ? <span className="pill status-chip--warning">需要調整</span> : <span className="pill status-chip--safe">安全</span>}
              </div>

              <div className="inspector-grid" style={{ marginTop: 18 }}>
                <div className="field field--full">
                  <label htmlFor="name">名稱</label>
                  <input id="name" value={singleSelected.name} onChange={(event) => updateSelectedNode({ name: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="x">X (mm)</label>
                  <input id="x" type="number" value={pxToMm(singleSelected.x)} onChange={(event) => updateSelectedNode({ x: mmToPx(Number(event.target.value) || 0) })} />
                </div>
                <div className="field">
                  <label htmlFor="y">Y (mm)</label>
                  <input id="y" type="number" value={pxToMm(singleSelected.y)} onChange={(event) => updateSelectedNode({ y: mmToPx(Number(event.target.value) || 0) })} />
                </div>
                <div className="field">
                  <label htmlFor="width">寬度 (mm)</label>
                  <input id="width" type="number" value={pxToMm(singleSelected.width)} onChange={(event) => updateSelectedNode({ width: Math.max(GRID_PX, snapPx(mmToPx(Number(event.target.value) || 100))) })} />
                </div>
                <div className="field">
                  <label htmlFor="depth">深度 (mm)</label>
                  <input id="depth" type="number" value={pxToMm(singleSelected.depth)} onChange={(event) => updateSelectedNode({ depth: Math.max(GRID_PX, snapPx(mmToPx(Number(event.target.value) || 100))) })} />
                </div>
                <div className="field">
                  <label htmlFor="rotation">旋轉 (°)</label>
                  <input id="rotation" type="number" value={singleSelected.rotation} onChange={(event) => updateSelectedNode({ rotation: Number(event.target.value) || 0 })} />
                </div>
                <div className="field">
                  <label htmlFor="height">高度 (mm)</label>
                  <input id="height" type="number" value={pxToMm(singleSelected.height3d)} onChange={(event) => updateSelectedNode({ height3d: mmToPx(Number(event.target.value) || 0) })} />
                </div>
                {singleSelected.type === 'device' && (
                  <div className="field field--full">
                    <label htmlFor="clearance">安全距離 (mm)</label>
                    <input id="clearance" type="number" value={singleSelected.clearanceMm ?? SAFETY_CLEARANCE_MM_DEFAULT} onChange={(event) => updateSelectedNode({ clearanceMm: Math.max(0, Number(event.target.value) || 0) })} />
                  </div>
                )}
              </div>

              <div className="stats-list">
                <div className="stats-item"><span>外框寬度</span><strong>{singleBounds ? fmtMm(pxToMm(singleBounds.width)) : '-'}</strong></div>
                <div className="stats-item"><span>外框深度</span><strong>{singleBounds ? fmtMm(pxToMm(singleBounds.height)) : '-'}</strong></div>
                <div className="stats-item"><span>目前座標</span><strong>{fmtMm(pxToMm(singleSelected.x))}, {fmtMm(pxToMm(singleSelected.y))}</strong></div>
              </div>

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="button" className="secondary-button" onClick={duplicateSelected}>複製</button>
                <button type="button" className="ghost-button" onClick={deleteSelected}>刪除</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

export default App;
