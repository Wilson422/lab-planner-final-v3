import React, { useEffect } from "react";
import "./App.css";

function App() {
  useEffect(() => {
    // --- Optimized Logic Start ---
lucide.createIcons();
        const stage = new Konva.Stage({ container: 'container', width: window.innerWidth - 580, height: window.innerHeight });
        const layer = new Konva.Layer();
        stage.add(layer);
        const tr = new Konva.Transformer({ keepRatio: false });
        layer.add(tr);

        let selectedNode = null;

        function addZone(name) { createNode('zone', name, 300, 200, 0, 'rgba(59, 130, 246, 0.1)', '#3b82f6'); }
        function addDevice(name, w, h, z, color) { createNode('device', name, w, h, z, color, '#1e293b'); }

        function createNode(type, name, w, h, z, fill, stroke) {
            const group = new Konva.Group({ x: 100, y: 100, draggable: true, name: type, customData: { height3d: z } });
            const rect = new Konva.Rect({ width: w, height: h, fill: fill, stroke: stroke, name: 'main-rect', dash: type === 'zone' ? [10, 5] : [] });
            const title = new Konva.Text({ text: name, fontSize: 14, fill: stroke, padding: 8, name: 'title-text' });
            const dim = new Konva.Text({ text: '', fontSize: 10, fill: stroke, name: 'dim-label' });
            group.add(rect, title, dim);
            updateUI(group);
            group.on('dragmove transform', () => updateUI(group));
            group.on('click tap', (e) => { e.cancelBubble = true; selectNode(group); });
            layer.add(group);
            if(type === 'zone') group.moveToBottom();
            selectNode(group);
        }

        function updateUI(group) {
            const rect = group.findOne('.main-rect');
            const dim = group.findOne('.dim-label');
            const w = Math.round(rect.width() * group.scaleX());
            const h = Math.round(rect.height() * group.scaleY());
            dim.text(`${w} x ${h}`);
            dim.x(rect.width() - dim.width() - 5); dim.y(rect.height() - 15);
            if(selectedNode === group) renderInspector();
        }

        function selectNode(node) { selectedNode = node; tr.nodes([node]); renderInspector(); layer.draw(); }
        stage.on('click tap', (e) => { if(e.target === stage) { tr.nodes([]); selectedNode = null; document.getElementById('inspector-content').innerText = '請選擇物件'; layer.draw(); }});

        function renderInspector() {
            if(!selectedNode) return;
            const n = selectedNode; const r = n.findOne('.main-rect');
            const w = Math.round(r.width() * n.scaleX()); const h = Math.round(r.height() * n.scaleY());
            document.getElementById('inspector-content').innerHTML = `
                <div class="prop-row"><label class="prop-label">名稱</label><input type="text" value="${n.findOne('.title-text').text()}" oninput="update('name', this.value)"></div>
                <div class="prop-grid">
                    <div class="prop-group"><label class="prop-label">X</label><input type="number" value="${Math.round(n.x())}" oninput="update('x', this.value)"></div>
                    <div class="prop-group"><label class="prop-label">Y</label><input type="number" value="${Math.round(n.y())}" oninput="update('y', this.value)"></div>
                    <div class="prop-group"><label class="prop-label">W</label><input type="number" value="${w}" oninput="update('w', this.value)"></div>
                    <div class="prop-group"><label class="prop-label">H</label><input type="number" value="${h}" oninput="update('h', this.value)"></div>
                    <div class="prop-group"><label class="prop-label">旋轉</label><input type="number" value="${Math.round(n.rotation())}" oninput="update('rot', this.value)"></div>
                    <div class="prop-group"><label class="prop-label">高度</label><input type="number" value="${n.attrs.customData?.height3d || 0}" oninput="update('z', this.value)"></div>
                </div>
                <button class="btn-action" style="background:var(--danger)" onclick="deleteSelected()">刪除物件</button>
            `;
        }

        function update(p, v) {
            if(!selectedNode) return;
            if(p==='name') selectedNode.findOne('.title-text').text(v);
            if(p==='x') selectedNode.x(parseInt(v)); if(p==='y') selectedNode.y(parseInt(v));
            if(p==='w') selectedNode.scaleX(parseInt(v)/selectedNode.findOne('.main-rect').width());
            if(p==='h') selectedNode.scaleY(parseInt(v)/selectedNode.findOne('.main-rect').height());
            if(p==='rot') selectedNode.rotation(parseInt(v));
            if(p==='z') selectedNode.attrs.customData.height3d = parseInt(v);
            updateUI(selectedNode); layer.draw();
        }

        function deleteSelected() { if(selectedNode) { selectedNode.destroy(); tr.nodes([]); selectedNode = null; renderInspector(); layer.draw(); } }

        // 3D 引擎
        let sc, cam, rend, ctrl;
        function toggle3D() {
            const btn = document.getElementById('toggle-3d');
            const c2d = document.getElementById('container');
            const c3d = document.getElementById('three-container');
            if(!sc) {
                sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0f1a);
                cam = new THREE.PerspectiveCamera(45, c3d.clientWidth/c3d.clientHeight, 1, 10000);
                cam.position.set(1000, 1000, 1000);
                rend = new THREE.WebGLRenderer({ antialias: true });
                rend.setSize(c3d.clientWidth, c3d.clientHeight);
                c3d.appendChild(rend.domElement);
                ctrl = new THREE.OrbitControls(cam, rend.domElement);
                sc.add(new THREE.AmbientLight(0xffffff, 1));
                const dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(1, 1, 1); sc.add(dl);
                sc.add(new THREE.GridHelper(5000, 50, 0x334155, 0x1e293b));
            }
            if(c3d.style.display === 'none' || c3d.style.display === '') {
                c3d.style.display = 'block'; c2d.style.display = 'none'; btn.innerText = '返回 2D';
                rend.setSize(c3d.clientWidth, c3d.clientHeight);
                update3D(); animate3D();
            } else { c3d.style.display = 'none'; c2d.style.display = 'block'; btn.innerText = '查看 3D 預覽'; }
        }

        function update3D() {
            while(sc.children.length > 3) sc.remove(sc.children[sc.children.length-1]);
            layer.getChildren().filter(n => n.name()==='device'||n.name()==='zone').forEach(n => {
                const r = n.findOne('.main-rect');
                const w = r.width()*n.scaleX(); const d = r.height()*n.scaleY();
                const x = (n.x() + w/2) - stage.width()/2; const y = (n.y() + d/2) - stage.height()/2;
                if(n.name()==='device') {
                    const h = n.attrs.customData.height3d || 100;
                    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhongMaterial({ color: r.fill(), transparent:true, opacity:0.9 }));
                    m.position.set(x, h/2, y); m.rotation.y = -THREE.MathUtils.degToRad(n.rotation()); sc.add(m);
                } else {
                    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent:true, opacity:0.2, side:2 }));
                    m.rotation.x = -Math.PI/2; m.position.set(x, 1, y); sc.add(m);
                }
            });
        }
        function animate3D() { if(document.getElementById('three-container').style.display === 'block') { requestAnimationFrame(animate3D); ctrl.update(); rend.render(sc, cam); } }
        function exportImg(f) { tr.nodes([]); layer.draw(); if(f==='png') { const l = document.createElement('a'); l.download='lab.png'; l.href=stage.toDataURL(); l.click(); } else { const doc = new jspdf.jsPDF('l','px',[stage.width(), stage.height()]); doc.addImage(stage.toDataURL(), 'PNG', 0,0, stage.width(), stage.height()); doc.save('lab.pdf'); } }
    // --- Optimized Logic End ---
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header"><i data-lucide="layout"></i> LabCAD Web Pro</div>
        <div className="tool-section"><div className="item" onClick={() => window.addZone("新規劃區域")}>新增區域</div></div>
        <div className="tool-section"><div className="item-grid">
          <div className="item" onClick={() => window.addDevice("實驗桌", 120, 60, 80, "#3b82f6")}>實驗桌</div>
          <div className="item" onClick={() => window.addDevice("排煙櫃", 100, 80, 200, "#ef4444")}>排煙櫃</div>
        </div></div>
        <div style={{ marginTop: "auto", padding: "20px" }}>
          <button className="btn-action" style={{ background: "var(--accent)" }} id="toggle-3d" onClick={() => window.toggle3D()}>查看 3D 預覽</button>
        </div>
      </aside>
      <main className="canvas-area">
        <div className="toolbar">
          <button className="tool-btn" onClick={() => window.exportImg("png")}><i data-lucide="image"></i></button>
          <button className="tool-btn" onClick={() => window.exportImg("pdf")}><i data-lucide="file-text"></i></button>
          <button className="tool-btn" onClick={() => window.deleteSelected()}><i data-lucide="trash-2"></i></button>
        </div>
        <div id="container"></div>
        <div id="three-container"></div>
      </main>
      <aside className="inspector">
        <h3 id="ins-title">屬性</h3>
        <div id="inspector-content">請選擇物件</div>
      </aside>
    </div>
  );
}

export default App;