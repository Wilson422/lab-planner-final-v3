import React, { useState, useRef } from 'react';
import { Stage, Layer } from 'react-konva';
import { 
  Save, Trash2, RotateCcw, Download, MousePointer2, 
  Square, Layout, Wind, Droplets, Database, Box
} from 'lucide-react';
import Element from './components/Element';
import './App.css';

const ITEM_TYPES = [
  { type: 'bench', name: '實驗桌', icon: <Square size={20}/>, width: 120, height: 60, fill: '#3b82f6' },
  { type: 'hood', name: '排煙櫃', icon: <Wind size={20}/>, width: 100, height: 80, fill: '#ef4444' },
  { type: 'sink', name: '水槽', icon: <Droplets size={20}/>, width: 60, height: 60, fill: '#06b6d4' },
  { type: 'cabinet', name: '儲藏櫃', icon: <Database size={20}/>, width: 80, height: 40, fill: '#f59e0b' },
  { type: 'island', name: '中央台', icon: <Layout size={20}/>, width: 200, height: 100, fill: '#8b5cf6' },
  { type: 'eq', name: '儀器', icon: <Box size={20}/>, width: 50, height: 50, fill: '#10b981' },
];

function App() {
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const stageRef = useRef(null);
  const trRef = useRef(null);

  const handleAdd = (item) => {
    const newEl = {
      ...item,
      id: `el-${Date.now()}`,
      x: 50,
      y: 50,
      rotation: 0
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const handleExport = () => {
    const dataURL = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = 'lab-design.png';
    link.href = dataURL;
    link.click();
  };

  const checkDeselect = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>Lab Planner</h2>
        <p className="category-title">組件清單</p>
        <div className="item-grid">
          {ITEM_TYPES.map((item, i) => (
            <div key={i} className="draggable-item" onClick={() => handleAdd(item)}>
              {item.icon}
              <span>{item.name}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto' }}>
           <button className="btn-primary" style={{ width: '100%' }} onClick={handleExport}>
            <Download size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }}/>
            匯出規劃圖
          </button>
        </div>
      </aside>

      <main className="canvas-area">
        <div className="canvas-toolbar">
          <button className="toolbar-btn" onClick={() => setSelectedId(null)}><MousePointer2/></button>
          <button className="toolbar-btn" onClick={() => setElements(elements.filter(el => el.id !== selectedId))}><Trash2/></button>
          <button className="toolbar-btn" onClick={() => setElements([])}><RotateCcw/></button>
        </div>
        <Stage
          width={window.innerWidth - 580}
          height={window.innerHeight}
          onMouseDown={checkDeselect}
          onTouchStart={checkDeselect}
          ref={stageRef}
        >
          <Layer>
            {elements.map((el, i) => (
              <Element
                key={i}
                shapeProps={el}
                isSelected={el.id === selectedId}
                trRef={trRef}
                onSelect={() => setSelectedId(el.id)}
                onChange={(newAttrs) => {
                  const rects = elements.slice();
                  rects[i] = newAttrs;
                  setElements(rects);
                }}
              />
            ))}
          </Layer>
        </Stage>
      </main>

      <aside className="inspector">
        <h3>物件屬性</h3>
        {selectedElement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="prop-group">
              <label className="prop-label">名稱</label>
              <input className="prop-input" value={selectedElement.name} onChange={(e) => {
                const newEls = elements.map(el => el.id === selectedId ? {...el, name: e.target.value} : el);
                setElements(newEls);
              }} />
            </div>
            <div className="prop-group">
              <label className="prop-label">寬度</label>
              <input type="number" className="prop-input" value={Math.round(selectedElement.width)} onChange={(e) => {
                const newEls = elements.map(el => el.id === selectedId ? {...el, width: parseInt(e.target.value)} : el);
                setElements(newEls);
              }} />
            </div>
            <div className="prop-group">
              <label className="prop-label">高度</label>
              <input type="number" className="prop-input" value={Math.round(selectedElement.height)} onChange={(e) => {
                const newEls = elements.map(el => el.id === selectedId ? {...el, height: parseInt(e.target.value)} : el);
                setElements(newEls);
              }} />
            </div>
            <div className="prop-group">
              <label className="prop-label">顏色</label>
              <input type="color" className="prop-input" value={selectedElement.fill} style={{height: '40px'}} onChange={(e) => {
                const newEls = elements.map(el => el.id === selectedId ? {...el, fill: e.target.value} : el);
                setElements(newEls);
              }} />
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>請選擇物件以編輯</p>
          </div>
        )}
      </aside>
    </div>
  );
}

export default App;