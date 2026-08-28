const PointClickCreator = {
  scenes: [],
  currentSceneId: null,
  startSceneId: null,

  render(act, all) {
    this.scenes = act?.data?.scenes ? JSON.parse(JSON.stringify(act.data.scenes)) : [];
    if (!this.scenes.length) {
      this.currentSceneId = null;
      this.startSceneId = null;
    } else {
      this.startSceneId = act?.data?.startSceneId || this.scenes[0].id;
      this.currentSceneId = this.currentSceneId || this.startSceneId;
    }
    this.missions = act?.data?.missions ? JSON.parse(JSON.stringify(act.data.missions)) : [];

    return `
      <div class="creator-form pointclick-creator">
        ${Creator._titleField(act?.title || '', 'Ej: Misterio en la Mansión', act?.subject || '', act?.topic || '', all)}
        
        <div class="pc-layout" style="display:flex; gap:20px; align-items:flex-start; margin-bottom:20px;">
          <!-- Sidebar: Escenas -->
          <div class="pc-sidebar" style="width:250px; flex-shrink:0; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-md); padding:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
              <h3 style="font-size:1rem; margin:0;">Escenas</h3>
              <label class="btn btn-sm btn-primary" style="cursor:pointer; padding:4px 8px;">
                + Añadir
                <input type="file" id="pc-add-scene-file" accept="image/*" style="display:none;">
              </label>
            </div>
            <div id="pc-scene-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
              <!-- Escenas generadas dinámicamente -->
            </div>

            <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:10px;">
              <label class="form-label" style="font-size:0.85rem; font-weight:600; color:#ff6b9e;">🚩 Escena de Inicio</label>
              <select id="pc-start-scene-sel" class="form-input" style="font-size:0.8rem; padding:4px;">
                ${this.scenes.map(s => `<option value="${s.id}" ${s.id === this.startSceneId ? 'selected' : ''}>${Creator._e(s.name) || '(Escena sin nombre)'}</option>`).join('')}
              </select>
            </div>

            <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:0.9rem; margin:0; color:#ff6b9e;">📜 Misiones</h3>
                <button id="pc-add-mission" class="btn btn-xs btn-ghost" style="padding:2px 6px; font-size:0.7rem;">+ Añadir</button>
              </div>
              <div id="pc-mission-list" style="display:flex; flex-direction:column; gap:5px; max-height:150px; overflow-y:auto;">
                <!-- Misiones generadas dinámicamente -->
              </div>
            </div>
          </div>

          <!-- Main Area -->
          <div class="pc-main" style="flex-grow:1; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-md); padding:15px;">
            <div id="pc-scene-editor">
              <div style="text-align:center; padding:40px; color:var(--text-muted);">
                Añade o selecciona una escena para editarla.
              </div>
            </div>
          </div>
        </div>
      </div>
      ${Creator._footer()}
    `;
  },

  attachEvents() {
    this._renderSceneList();

    const handleSceneFile = file => {
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 2 * 1024 * 1024) { showToast('Imagen muy pesada. Máximo 2MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const id = App.uid();
        this.scenes.push({
          id: id,
          name: 'Escena ' + (this.scenes.length + 1),
          bgImage: ev.target.result,
          hotspots: []
        });
        if (!this.currentSceneId) this.currentSceneId = id;
        this._renderSceneList();
      };
      reader.readAsDataURL(file);
    };

    const addBtn = document.getElementById('pc-add-scene-file');
    addBtn?.addEventListener('change', e => {
      handleSceneFile(e.target.files[0]);
      e.target.value = '';
    });

    // Sidebar Drop Zone
    const sidebar = document.querySelector('.pc-sidebar');
    if (sidebar) {
      this._setupImageDrop(sidebar, handleSceneFile);
    }

    document.getElementById('pc-add-mission')?.addEventListener('click', () => {
      this.missions.push({ id: App.uid(), name: 'Nueva Misión', description: '' });
      this._renderMissionList();
    });
  },

  _renderSceneList() {
    const list = document.getElementById('pc-scene-list');
    if (!list) return;

    list.innerHTML = this.scenes.map(s => `
      <div class="pc-scene-item ${s.id === this.currentSceneId ? 'active' : ''}" data-id="${s.id}" style="padding:10px; background:var(--bg-surface); border:1px solid ${s.id === this.currentSceneId ? 'var(--primary)' : 'var(--border)'}; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${Creator._e(s.name)}</span>
        <button class="btn-icon pc-del-scene" style="width:24px; height:24px; padding:0; line-height:1;" data-id="${s.id}">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.pc-scene-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.pc-del-scene')) return;
        this.currentSceneId = el.dataset.id;
        this._renderSceneList();
      });
    });

    list.querySelectorAll('.pc-del-scene').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scenes = this.scenes.filter(s => s.id !== el.dataset.id);
        if (this.currentSceneId === el.dataset.id) {
          this.currentSceneId = this.scenes[0] ? this.scenes[0].id : null;
        }
        this._renderSceneList();
      });
    });

    this._renderEditor();
    this._renderMissionList();
    this._attachGlobalEvents();
  },

  _renderMissionList() {
    const list = document.getElementById('pc-mission-list');
    if (!list) return;

    if (!this.missions.length) {
      list.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); text-align:center;">No hay misiones.</div>';
      return;
    }

    list.innerHTML = this.missions.map(m => `
      <div class="pc-mission-item" style="background:var(--bg-surface); border:1px solid var(--border); border-radius:4px; padding:6px;">
        <input type="text" class="pc-mission-name" data-id="${m.id}" value="${Creator._e(m.name)}" placeholder="Nombre" style="width:100%; border:none; background:transparent; font-size:0.75rem; font-weight:700; color:#ff6b9e; margin-bottom:2px;">
        <textarea class="pc-mission-desc" data-id="${m.id}" placeholder="Descripción..." style="width:100%; border:none; background:transparent; font-size:0.7rem; color:var(--text-primary); resize:none; line-height:1.2; height:32px;">${Creator._e(m.description)}</textarea>
        <div style="text-align:right;">
          <button class="pc-del-mission" data-id="${m.id}" style="background:transparent; border:none; color:var(--error); font-size:0.65rem; cursor:pointer;">Eliminar</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.pc-mission-name').forEach(inp => {
      inp.addEventListener('input', e => {
        const m = this.missions.find(m => m.id === inp.dataset.id);
        if (m) m.name = e.target.value;
        this._updateMissionDropdowns(); // Update all dropdowns without re-rendering the whole UI
      });
    });
    list.querySelectorAll('.pc-mission-desc').forEach(txt => {
      txt.addEventListener('input', e => {
        const m = this.missions.find(m => m.id === txt.dataset.id);
        if (m) m.description = e.target.value;
      });
    });
    list.querySelectorAll('.pc-del-mission').forEach(btn => {
      btn.addEventListener('click', () => {
        this.missions = this.missions.filter(m => m.id !== btn.dataset.id);
        this._renderMissionList();
      });
    });
  },

  _attachGlobalEvents() {
    document.getElementById('pc-start-scene-sel')?.addEventListener('change', e => {
      this.startSceneId = e.target.value;
    });
  },

  _renderEditor() {
    const editor = document.getElementById('pc-scene-editor');
    if (!editor) return;

    const scene = this.scenes.find(s => s.id === this.currentSceneId);
    if (!scene) {
      editor.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Añade o selecciona una escena para editarla.</div>';
      return;
    }

    editor.innerHTML = `
      <div style="margin-bottom:15px; display:flex; gap:10px; align-items:center;">
        <label>Nombre:</label>
        <input type="text" id="pc-scene-name" class="form-input" style="flex-grow:1;" value="${Creator._e(scene.name)}">
      </div>
      
      <div style="background:rgba(255,107,158,0.05); padding:10px; border-radius:8px; border:1px solid rgba(255,107,158,0.2); margin-bottom:15px; display:flex; gap:10px; align-items:center;">
        <div style="flex:1;">
          <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:2px;">🚀 Activar Misión al entrar:</label>
          <select id="pc-scene-activates-mission" class="form-input" style="font-size:0.75rem; padding:2px;"></select>
        </div>
        <div style="flex:1;">
          <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:2px;">✅ Completar Misión al entrar:</label>
          <select id="pc-scene-completes-mission" class="form-input" style="font-size:0.75rem; padding:2px;"></select>
        </div>
      </div>

      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">Haz clic y arrastra en la imagen para dibujar una zona interactiva (hotspot).</p>
      
      <div id="pc-canvas-wrapper" style="position:relative; width:100%; aspect-ratio:16/9; background:#000; overflow:hidden; border:1px solid var(--border); border-radius:var(--r-sm); user-select:none;">
        <img src="${scene.bgImage}" draggable="false" style="width:100%; height:100%; object-fit:contain; pointer-events:none; display:block;">
        
        <!-- Hotspots existentes -->
        ${scene.hotspots.map(hs => `
          <div class="pc-hotspot-box" data-id="${hs.id}" style="position:absolute; left:${hs.x}%; top:${hs.y}%; width:${hs.width}%; height:${hs.height}%; border:2px solid var(--primary); background:rgba(217,70,239,0.2); cursor:move;">
            ${hs.image ? `<img src="${hs.image}" style="width:100%; height:100%; object-fit:contain; pointer-events:none;">` : ''}
            <div style="position:absolute; top:-22px; left:-2px; background:var(--primary); color:#fff; font-size:10px; padding:2px 4px; border-radius:2px; white-space:nowrap; pointer-events:none;">
              ${hs.type === 'navigate' ? '🔗 Navegar' : '💬 Mensaje'}
            </div>
            <button class="pc-del-hotspot" data-id="${hs.id}" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; cursor:pointer; z-index:10;">✕</button>
            <div class="pc-resize-handle" data-id="${hs.id}" style="position:absolute; bottom:-3px; right:-3px; width:12px; height:12px; background:var(--primary); border-radius:50%; cursor:nwse-resize; z-index:10; border:2px solid #fff;"></div>
          </div>
        `).join('')}
      </div>

      <div id="pc-hotspot-props" style="margin-top:20px; padding:15px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--r-sm); display:none;">
        <h4 style="margin-bottom:10px; font-size:0.95rem;">Propiedades de la Zona</h4>
        
        <div class="form-group" style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid var(--border);">
          <label class="form-label">🖼 Imagen Base de la Zona (Opcional)</label>
          <div id="pc-hs-image-dropzone" style="border:2px dashed var(--border); border-radius:8px; padding:15px; text-align:center; transition:all 0.2s; background:rgba(0,0,0,0.05);">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">Arrastra una imagen aquí o</div>
            <label class="btn btn-sm btn-secondary" style="cursor:pointer; margin:0 auto;">
              Subir Archivo
              <input type="file" id="pc-hs-image" accept="image/*" style="display:none;">
            </label>
            <button class="btn btn-sm btn-ghost" id="pc-hs-image-del" style="display:none; color:var(--error); margin-top:5px; width:100%;">Quitar imagen</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid var(--border);">
          <label class="form-label">📦 Inventario y Objetos</label>
          
          <!-- Give Item -->
          <div style="background:rgba(255,107,158,0.05); padding:10px; border-radius:8px; border:1px solid rgba(255,107,158,0.2); margin-bottom:10px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; cursor:pointer;">
              <input type="checkbox" id="pc-hs-gives-item-toggle" ${scene.hotspots.find(h => h.id === this._selectedHotspotId)?.givesItem ? 'checked' : ''}>
              🎁 Dar objeto al activar
            </label>
            <div id="pc-hs-gives-item-fields" style="display:none; margin-top:10px; padding-top:10px; border-top:1px dashed rgba(255,107,158,0.3);">
              <input type="text" id="pc-hs-item-name" class="form-input" placeholder="Nombre del objeto" style="margin-bottom:8px; font-size:0.8rem;">
              <div id="pc-hs-item-icon-dropzone" style="border:1.5px dashed rgba(255,107,158,0.3); border-radius:6px; padding:10px; text-align:center; font-size:0.75rem;">
                <div style="margin-bottom:5px;">Icono (Arrastra o sube)</div>
                <label class="btn btn-sm btn-ghost" style="cursor:pointer; padding:2px 6px;">
                  📷 Seleccionar
                  <input type="file" id="pc-hs-item-icon" accept="image/*" style="display:none;">
                </label>
                <div id="pc-hs-item-icon-preview" style="margin-top:5px; display:none;">
                  <img src="" style="width:32px; height:32px; object-fit:contain; border-radius:4px; border:1px solid var(--border);">
                </div>
              </div>
              <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; margin-top:8px; cursor:pointer;">
                <input type="checkbox" id="pc-hs-item-droppable"> Permite tirar el objeto del inventario
              </label>
            </div>
          </div>

          <!-- Requires Item -->
          <div style="background:rgba(0,0,0,0.03); padding:10px; border-radius:8px; border:1px solid var(--border);">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:0.8rem;">🗝 Requiere objeto para activar:</label>
              <select id="pc-hs-requires-item" class="form-input" style="font-size:0.8rem;"></select>
            </div>
            <div id="pc-hs-consumes-container" style="display:none; margin-top:8px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer;">
                <input type="checkbox" id="pc-hs-consumes-item"> Consumir objeto al usar
              </label>
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid var(--border);">
          <label class="form-label">🚀 Progreso y Estado</label>
          
          <div style="background:rgba(255,107,158,0.03); padding:10px; border-radius:8px; border:1px solid var(--border); display:flex; flex-direction:column; gap:8px;">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:4px;">Activa Misión:</label>
                <select id="pc-hs-activates-mission" class="form-input" style="font-size:0.75rem; padding:2px;"></select>
              </div>
              <div>
                <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:4px;">Completa Misión:</label>
                <select id="pc-hs-completes-mission" class="form-input" style="font-size:0.75rem; padding:2px;"></select>
              </div>
            </div>

            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:4px;">Cambiar a Estado (Permanente):</label>
              <input type="text" id="pc-hs-set-state" class="form-input" placeholder="ej: cortado, abierto" style="font-size:0.75rem; padding:4px;">
              <p style="font-size:0.65rem; color:var(--text-muted); margin-top:3px;">Esto guardará el estado para siempre en la partida.</p>
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Acción principal</label>
          <select id="pc-hs-type" class="form-input">
            <option value="message">Secuencia de Diálogos (Estilo Otome)</option>
            <option value="navigate">Ir a Escena Directamente</option>
            <option value="ending">Finalizar Juego (Pantalla de Fin)</option>
          </select>
        </div>
        
        <div id="pc-hs-dynamic-props"></div>

        <!-- Visual States -->
        <div class="form-group" style="margin-top:20px; border-top:1px solid var(--border); padding-top:15px;">
          <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
            <span>🎨 Estados Visuales (Opcional)</span>
            <button id="pc-hs-add-state" class="btn btn-xs btn-ghost">+ Añadir</button>
          </label>
          <div id="pc-hs-states-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>

      </div>
    `;

    document.getElementById('pc-scene-name').addEventListener('input', e => {
      scene.name = e.target.value;
      const listItem = document.querySelector(`.pc-scene-item[data-id="${scene.id}"] span`);
      if (listItem) listItem.textContent = scene.name || 'Sin nombre';

      const targetSel = document.getElementById('pc-hs-target');
      if (targetSel) {
        const val = targetSel.value;
        targetSel.innerHTML = this.scenes.map(s => `<option value="${s.id}">${Creator._e(s.name) || '(Escena sin nombre)'}</option>`).join('');
        targetSel.value = val;
      }
    });

    this._attachCanvasEvents();
    this._attachHotspotEvents();

    // Scene missions
    const actSel = document.getElementById('pc-scene-activates-mission');
    const compSel = document.getElementById('pc-scene-completes-mission');
    const missionsHtml = '<option value="">Ninguna</option>' + this.missions.map(m => `
      <option value="${m.id}">${Creator._e(m.name) || '(Misión sin nombre)'}</option>
    `).join('');
    
    if (actSel) {
      actSel.innerHTML = missionsHtml;
      actSel.value = scene.activatesMission || '';
      actSel.addEventListener('change', e => scene.activatesMission = e.target.value || null);
    }
    if (compSel) {
      compSel.innerHTML = missionsHtml;
      compSel.value = scene.completesMission || '';
      compSel.addEventListener('change', e => scene.completesMission = e.target.value || null);
    }
  },

  _attachCanvasEvents() {
    const wrapper = document.getElementById('pc-canvas-wrapper');
    if (!wrapper) return;

    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentBox = null;

    // Remove dragging logic for entire body since it interferes with clicks
    // Only capture mousedown on wrapper
    wrapper.addEventListener('mousedown', e => {
      if (e.target.closest('.pc-hotspot-box')) return;
      e.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      startX = ((e.clientX - rect.left) / rect.width) * 100;
      startY = ((e.clientY - rect.top) / rect.height) * 100;

      isDrawing = true;
      currentBox = document.createElement('div');
      currentBox.style.position = 'absolute';
      currentBox.style.border = '2px dashed var(--primary-light)';
      currentBox.style.background = 'rgba(217,70,239,0.1)';
      currentBox.style.left = startX + '%';
      currentBox.style.top = startY + '%';
      currentBox.style.width = '0%';
      currentBox.style.height = '0%';
      wrapper.appendChild(currentBox);
    });

    const onMouseMove = e => {
      if (!isDrawing || !currentBox) return;
      const rect = wrapper.getBoundingClientRect();
      const curX = ((e.clientX - rect.left) / rect.width) * 100;
      const curY = ((e.clientY - rect.top) / rect.height) * 100;

      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);

      currentBox.style.left = Math.max(0, x) + '%';
      currentBox.style.top = Math.max(0, y) + '%';
      currentBox.style.width = Math.min(100 - x, w) + '%';
      currentBox.style.height = Math.min(100 - y, h) + '%';
    };

    const onMouseUp = e => {
      if (!isDrawing) return;
      isDrawing = false;

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!currentBox) return;

      const w = parseFloat(currentBox.style.width);
      const h = parseFloat(currentBox.style.height);

      if (w > 2 && h > 2) {
        const scene = this.scenes.find(s => s.id === this.currentSceneId);
        const newHs = {
          id: App.uid(),
          x: parseFloat(currentBox.style.left),
          y: parseFloat(currentBox.style.top),
          width: w,
          height: h,
          type: 'message',
          content: 'Nuevo mensaje'
        };
        scene.hotspots.push(newHs);
        this._renderEditor();
        this._selectHotspot(newHs.id);
      } else {
        currentBox.remove();
      }
      currentBox = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  },

  _attachHotspotEvents() {
    this._makeHotspotsDraggable();

    document.getElementById('pc-hs-type')?.addEventListener('change', e => {
      const scene = this.scenes.find(s => s.id === this.currentSceneId);
      const hs = scene?.hotspots.find(h => h.id === this._selectedHotspotId);
      if (hs) {
        hs.type = e.target.value;
        this._renderHotspotDynamicProps(hs);
        const box = document.querySelector(`.pc-hotspot-box[data-id="${hs.id}"] div`);
        if (box) box.textContent = hs.type === 'navigate' ? '🔗 Navegar' : '💬 Diálogo';
      }
    });

    const handleHsImage = file => {
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 1 * 1024 * 1024) { showToast('Máximo 1MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const scene = this.scenes.find(s => s.id === this.currentSceneId);
        const hs = scene.hotspots.find(h => h.id === this._selectedHotspotId);
        if (hs) {
          hs.image = ev.target.result;
          this._renderEditor();
          this._selectHotspot(hs.id);
        }
      };
      reader.readAsDataURL(file);
    };

    document.getElementById('pc-hs-image')?.addEventListener('change', e => {
      handleHsImage(e.target.files[0]);
      e.target.value = '';
    });

    const hsDropzone = document.getElementById('pc-hs-image-dropzone');
    if (hsDropzone) this._setupImageDrop(hsDropzone, handleHsImage);

    document.getElementById('pc-hs-image-del')?.addEventListener('click', () => {
      const scene = this.scenes.find(s => s.id === this.currentSceneId);
      const hs = scene.hotspots.find(h => h.id === this._selectedHotspotId);
      if (hs) {
        delete hs.image;
        this._renderEditor();
        this._selectHotspot(hs.id);
      }
    });

    // --- INVENTORY EVENTS ---
    const getSelectedHs = () => {
      const scene = this.scenes.find(s => s.id === this.currentSceneId);
      return scene?.hotspots.find(h => h.id === this._selectedHotspotId);
    };

    document.getElementById('pc-hs-gives-item-toggle')?.addEventListener('change', e => {
      const hs = getSelectedHs();
      if (!hs) return;
      if (e.target.checked) {
        hs.givesItem = { id: App.uid(), name: 'Nuevo Objeto', icon: null, droppable: true };
      } else {
        delete hs.givesItem;
      }
      this._selectHotspot(hs.id);
    });

    document.getElementById('pc-hs-item-name')?.addEventListener('input', e => {
      const hs = getSelectedHs();
      if (hs?.givesItem) hs.givesItem.name = e.target.value;
    });

    document.getElementById('pc-hs-item-droppable')?.addEventListener('change', e => {
      const hs = getSelectedHs();
      if (hs?.givesItem) hs.givesItem.droppable = e.target.checked;
    });

    const handleIconFile = file => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const hs = getSelectedHs();
        if (hs?.givesItem) {
          hs.givesItem.icon = ev.target.result;
          this._selectHotspot(hs.id);
        }
      };
      reader.readAsDataURL(file);
    };

    document.getElementById('pc-hs-item-icon')?.addEventListener('change', e => handleIconFile(e.target.files[0]));
    const iconDropzone = document.getElementById('pc-hs-item-icon-dropzone');
    if (iconDropzone) this._setupImageDrop(iconDropzone, handleIconFile);

    document.getElementById('pc-hs-requires-item')?.addEventListener('change', e => {
      const hs = getSelectedHs();
      if (!hs) return;
      hs.requiresItem = e.target.value || null;
      document.getElementById('pc-hs-consumes-container').style.display = hs.requiresItem ? 'block' : 'none';
    });

    document.getElementById('pc-hs-consumes-item')?.addEventListener('change', e => {
      const hs = getSelectedHs();
      if (hs) hs.consumesItem = e.target.checked;
    });

    document.getElementById('pc-hs-activates-mission')?.addEventListener('change', e => {
      const hs = getSelectedHs();
      if (hs) hs.activatesMission = e.target.value || null;
    });

    document.getElementById('pc-hs-completes-mission')?.addEventListener('change', e => {
      const hs = getSelectedHs();
      if (hs) hs.completesMission = e.target.value || null;
    });

    document.getElementById('pc-hs-set-state')?.addEventListener('input', e => {
      const hs = getSelectedHs();
      if (hs) hs.setState = e.target.value.trim() || null;
    });

    document.getElementById('pc-hs-add-state')?.addEventListener('click', () => {
      const hs = getSelectedHs();
      if (!hs) return;
      if (!hs.states) hs.states = {};
      const stateName = prompt('Nombre del estado (ej: cortado, abierto):');
      if (stateName) {
        hs.states[stateName] = { image: hs.image || null };
        this._renderHotspotStates(hs);
      }
    });
  },

  _makeHotspotsDraggable() {
    const wrapper = document.getElementById('pc-canvas-wrapper');
    if (!wrapper) return;

    document.querySelectorAll('.pc-hotspot-box').forEach(box => {
      let isDragging = false;
      let isResizing = false;
      let startX = 0, startY = 0;
      let origLeft = 0, origTop = 0, origWidth = 0, origHeight = 0;

      const handle = box.querySelector('.pc-resize-handle');

      const onMouseDown = (e) => {
        if (e.target.closest('.pc-del-hotspot')) return;
        e.stopPropagation();
        this._selectHotspot(box.dataset.id);

        startX = e.clientX;
        startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();

        const scene = this.scenes.find(s => s.id === this.currentSceneId);
        const hs = scene.hotspots.find(h => h.id === box.dataset.id);
        if (!hs) return;

        origLeft = hs.x;
        origTop = hs.y;
        origWidth = hs.width;
        origHeight = hs.height;

        if (e.target === handle) {
          isResizing = true;
        } else {
          isDragging = true;
        }
        document.body.style.userSelect = 'none';
      };

      const onMouseMove = (e) => {
        if (!isDragging && !isResizing) return;
        const rect = wrapper.getBoundingClientRect();
        const dx = ((e.clientX - startX) / rect.width) * 100;
        const dy = ((e.clientY - startY) / rect.height) * 100;

        const scene = this.scenes.find(s => s.id === this.currentSceneId);
        const hs = scene.hotspots.find(h => h.id === box.dataset.id);

        if (isDragging) {
          let nx = origLeft + dx;
          let ny = origTop + dy;
          nx = Math.max(0, Math.min(100 - origWidth, nx));
          ny = Math.max(0, Math.min(100 - origHeight, ny));
          hs.x = nx;
          hs.y = ny;
          box.style.left = nx + '%';
          box.style.top = ny + '%';
        } else if (isResizing) {
          let nw = origWidth + dx;
          let nh = origHeight + dy;
          nw = Math.max(2, Math.min(100 - origLeft, nw));
          nh = Math.max(2, Math.min(100 - origTop, nh));
          hs.width = nw;
          hs.height = nh;
          box.style.width = nw + '%';
          box.style.height = nh + '%';
        }
      };

      const onMouseUp = (e) => {
        if (!isDragging && !isResizing) return;
        isDragging = false;
        isResizing = false;
        document.body.style.userSelect = '';
      };

      box.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      box.querySelector('.pc-del-hotspot').addEventListener('mousedown', e => {
        e.stopPropagation();
        const hsId = box.dataset.id;
        const scene = this.scenes.find(s => s.id === this.currentSceneId);
        scene.hotspots = scene.hotspots.filter(h => h.id !== hsId);
        this._renderEditor();
        document.getElementById('pc-hotspot-props').style.display = 'none';
      });
    });
  },

  _selectedHotspotId: null,

  _selectHotspot(id) {
    this._selectedHotspotId = id;

    document.querySelectorAll('.pc-hotspot-box').forEach(box => {
      if (box.dataset.id === id) {
        box.style.border = '2px solid #fff';
        box.style.boxShadow = '0 0 10px rgba(255,255,255,0.8)';
        box.style.zIndex = '5';
      } else {
        box.style.border = '2px solid var(--primary)';
        box.style.boxShadow = 'none';
        box.style.zIndex = '1';
      }
    });

    const scene = this.scenes.find(s => s.id === this.currentSceneId);
    const hs = scene.hotspots.find(h => h.id === id);
    if (!hs) return;

    const props = document.getElementById('pc-hotspot-props');
    props.style.display = 'block';

    const typeSel = document.getElementById('pc-hs-type');
    const delImgBtn = document.getElementById('pc-hs-image-del');

    typeSel.value = hs.type;
    if (hs.image) delImgBtn.style.display = 'block';
    else delImgBtn.style.display = 'none';

    // Inventory UI state
    const givesFields = document.getElementById('pc-hs-gives-item-fields');
    if (hs.givesItem) {
      givesFields.style.display = 'block';
      document.getElementById('pc-hs-item-name').value = hs.givesItem.name || '';
      document.getElementById('pc-hs-item-droppable').checked = hs.givesItem.droppable !== false;
      const preview = document.getElementById('pc-hs-item-icon-preview');
      if (hs.givesItem.icon) {
        preview.style.display = 'block';
        preview.querySelector('img').src = hs.givesItem.icon;
      } else {
        preview.style.display = 'none';
      }
    } else {
      givesFields.style.display = 'none';
    }

    // Populate Requires Item Dropdown
    const reqSel = document.getElementById('pc-hs-requires-item');
    const allItems = [];
    this.scenes.forEach(s => {
      s.hotspots.forEach(h => {
        if (h.givesItem && h.id !== hs.id) allItems.push(h.givesItem);
      });
    });

    reqSel.innerHTML = '<option value="">Ninguno</option>' + allItems.map(item => `
      <option value="${item.id}" ${hs.requiresItem === item.id ? 'selected' : ''}>${Creator._e(item.name) || '(Objeto sin nombre)'}</option>
    `).join('');

    document.getElementById('pc-hs-consumes-container').style.display = hs.requiresItem ? 'block' : 'none';
    document.getElementById('pc-hs-consumes-item').checked = !!hs.consumesItem;

    // Missions Dropdowns
    const actSel = document.getElementById('pc-hs-activates-mission');
    const compSel = document.getElementById('pc-hs-completes-mission');
    const missionsHtml = '<option value="">Ninguna</option>' + this.missions.map(m => `
      <option value="${m.id}">${Creator._e(m.name) || '(Misión sin nombre)'}</option>
    `).join('');
    
    actSel.innerHTML = missionsHtml;
    compSel.innerHTML = missionsHtml;
    actSel.value = hs.activatesMission || '';
    compSel.value = hs.completesMission || '';

    document.getElementById('pc-hs-set-state').value = hs.setState || '';

    this._renderHotspotStates(hs);
    this._renderHotspotDynamicProps(hs);
  },

  _renderHotspotStates(hs) {
    const list = document.getElementById('pc-hs-states-list');
    if (!list) return;

    if (!hs.states || !Object.keys(hs.states).length) {
      list.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); text-align:center;">Sin estados adicionales.</div>';
      return;
    }

    list.innerHTML = Object.keys(hs.states).map(name => `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <strong style="font-size:0.75rem; color:#ff6b9e;">${Creator._e(name)}</strong>
          <button class="pc-del-hs-state" data-name="${name}" style="background:transparent; border:none; color:var(--error); font-size:0.8rem; cursor:pointer;">✕</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="pc-hs-state-img-dropzone" data-name="${name}" style="border:1.5px dashed var(--border); border-radius:6px; padding:6px; text-align:center; flex:1; cursor:pointer; font-size:0.7rem;">
            ${hs.states[name].image ? '🖼 Cambiar Imagen' : '📷 Subir Imagen'}
            <input type="file" class="pc-hs-state-img-input" style="display:none;" data-name="${name}">
          </div>
          ${hs.states[name].image ? `<img src="${hs.states[name].image}" style="width:30px; height:30px; object-fit:contain; border-radius:4px;">` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.pc-del-hs-state').forEach(btn => {
      btn.addEventListener('click', () => {
        delete hs.states[btn.dataset.name];
        this._renderHotspotStates(hs);
      });
    });

    list.querySelectorAll('.pc-hs-state-img-dropzone').forEach(dz => {
      const name = dz.dataset.name;
      const inp = dz.querySelector('input');
      dz.addEventListener('click', () => inp.click());

      const handleStateImg = file => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          hs.states[name].image = ev.target.result;
          this._renderHotspotStates(hs);
        };
        reader.readAsDataURL(file);
      };
      inp.addEventListener('change', e => handleStateImg(e.target.files[0]));
      this._setupImageDrop(dz, handleStateImg);
    });
  },

  _renderHotspotDynamicProps(hs) {
    const dyn = document.getElementById('pc-hs-dynamic-props');
    if (!dyn) return;

    if (hs.type === 'navigate') {
      dyn.innerHTML = `
        <div class="form-group">
          <label class="form-label">Escena Destino</label>
          <select id="pc-hs-target" class="form-input">
            ${this.scenes.map(s => `<option value="${s.id}" ${hs.targetSceneId === s.id ? 'selected' : ''}>${Creator._e(s.name) || '(Escena sin nombre)'}</option>`).join('')}
          </select>
        </div>
      `;
      document.getElementById('pc-hs-target').addEventListener('change', e => {
        hs.targetSceneId = e.target.value;
      });
    }
    else if (hs.type === 'ending') {
      dyn.innerHTML = `
        <div class="form-group">
          <label class="form-label">Tipo de Final</label>
          <select id="pc-hs-end-type" class="form-input">
            <option value="good" ${hs.endType === 'good' ? 'selected' : ''}>🌟 Final Bueno</option>
            <option value="bad" ${hs.endType === 'bad' ? 'selected' : ''}>💀 Final Malo</option>
            <option value="neutral" ${hs.endType === 'neutral' ? 'selected' : ''}>😐 Final Neutral</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Mensaje personalizado (Opcional)</label>
          <textarea id="pc-hs-end-msg" class="form-textarea" rows="2" placeholder="¡Felicidades! Has logrado...">${Creator._e(hs.endMsg || '')}</textarea>
        </div>
      `;
      document.getElementById('pc-hs-end-type').addEventListener('change', e => hs.endType = e.target.value);
      document.getElementById('pc-hs-end-msg').addEventListener('input', e => hs.endMsg = e.target.value);
    }
    else if (hs.type === 'message') {
      if (!hs.sequence) {
        hs.sequence = [{ id: App.uid(), speaker: '', text: hs.content || 'Hola...', image: null, choices: hs.choices || [] }];
        delete hs.choices; // Migrar choices viejos al primer mensaje
      }

      const allItems = [];
      this.scenes.forEach(s => { s.hotspots.forEach(h => { if (h.givesItem) allItems.push(h.givesItem); }); });
      const itemsHtml = '<option value="">(🔓 Libre)</option>' + allItems.map(it => `<option value="${it.id}">${Creator._e(it.name) || '(Objeto sin nombre)'}</option>`).join('');
      const missionsHtml = '<option value="">(Sin cambio)</option>' + this.missions.map(m => `<option value="${m.id}">${Creator._e(m.name) || '(Misión sin nombre)'}</option>`).join('');

      dyn.innerHTML = `
        <div style="background:var(--bg-card); padding:10px; border-radius:var(--r-sm); border:1px solid var(--border);">
          <h5 style="margin-bottom:10px;">Secuencia de Diálogos</h5>
          <div id="pc-seq-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:10px;">
            ${hs.sequence.map((msg, i) => `
              <div class="pc-seq-item" data-id="${msg.id}" style="border-left:3px solid var(--primary); padding-left:10px; background:var(--bg-surface); padding:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                  <strong style="font-size:0.8rem; color:var(--text-muted)">Mensaje ${i + 1}</strong>
                  <button class="btn-icon pc-del-seq" data-id="${msg.id}" style="width:20px; height:20px; padding:0; line-height:1; color:var(--error);" title="Eliminar">✕</button>
                </div>
                <input type="text" class="form-input pc-seq-speaker" placeholder="Nombre (ej. Juan)" value="${Creator._e(msg.speaker || '')}" style="margin-bottom:5px; padding:4px;">
                <textarea class="form-textarea pc-seq-text" rows="2" placeholder="Texto del diálogo...">${Creator._e(msg.text || '')}</textarea>
                
                <div style="margin-top:5px; font-size:0.8rem; display:flex; align-items:center; gap:10px;">
                  <div class="pc-seq-img-dropzone" data-id="${msg.id}" style="border:1px dashed var(--border); padding:4px 8px; border-radius:6px; cursor:pointer; flex:1; text-align:center;">
                    <span style="font-size:0.7rem;">${msg.image ? '🖼 Cambiar' : '📷 Soltar imagen'}</span>
                    <input type="file" class="pc-seq-img-input" accept="image/*" style="display:none;" data-id="${msg.id}">
                  </div>
                  ${msg.image ? `<button class="btn-icon pc-seq-img-del" data-id="${msg.id}" style="color:var(--error);">✕</button> <span style="color:var(--primary); font-size:0.7rem;">OK ✅</span>` : ''}
                </div>

                <!-- Auto-navigate to scene -->
                <div style="margin-top:8px; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
                  <span style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">➡️ Al terminar, ir a:</span>
                  <select class="form-input pc-seq-next-scene" data-id="${msg.id}" style="padding:2px; font-size:0.75rem;">
                    <option value="">(Continuar secuencia)</option>
                    <optgroup label="Escenas">
                      ${this.scenes.map(s => `<option value="${s.id}" ${msg.nextSceneId === s.id ? 'selected' : ''}>${Creator._e(s.name) || '(Escena sin nombre)'}</option>`).join('')}
                    </optgroup>
                    <optgroup label="Finales">
                      <option value="end:good" ${msg.nextSceneId === 'end:good' ? 'selected' : ''}>🌟 Final Bueno</option>
                      <option value="end:bad" ${msg.nextSceneId === 'end:bad' ? 'selected' : ''}>💀 Final Malo</option>
                      <option value="end:neutral" ${msg.nextSceneId === 'end:neutral' ? 'selected' : ''}>😐 Final Neutral</option>
                    </optgroup>
                  </select>
                </div>

                <!-- Mission triggers per message -->
                <div style="margin-top:8px; display:flex; gap:10px;">
                  <div style="flex:1;">
                    <label style="font-size:0.65rem; color:var(--text-muted); display:block;">🚀 Activa Misión:</label>
                    <select class="pc-seq-activates-mission form-input" data-id="${msg.id}" style="font-size:0.65rem; padding:1px;">
                      ${missionsHtml.replace(`value="${msg.activatesMission}"`, `value="${msg.activatesMission}" selected`)}
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label style="font-size:0.65rem; color:var(--text-muted); display:block;">✅ Completa Misión:</label>
                    <select class="pc-seq-completes-mission form-input" data-id="${msg.id}" style="font-size:0.65rem; padding:1px;">
                      ${missionsHtml.replace(`value="${msg.completesMission}"`, `value="${msg.completesMission}" selected`)}
                    </select>
                  </div>
                </div>

                <!-- Opciones Ancladas -->
                <div style="margin-top:10px; border-top:1px dashed var(--border); padding-top:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <span style="font-size:0.75rem; color:var(--text-muted);">Decisiones (Ramificar y terminar secuencia aquí)</span>
                    <button class="btn-icon pc-btn-add-msg-choice" data-msgid="${msg.id}" style="color:var(--primary); font-size:1.2rem; line-height:1;">+</button>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:5px;">
                    ${(msg.choices || []).map((c, ci) => `
                      <div style="display:flex; flex-direction:column; gap:4px; background:rgba(0,0,0,0.05); padding:6px; border-radius:4px; margin-bottom:5px;">
                        <div style="display:flex; gap:5px; align-items:center;">
                          <input type="text" class="pc-msg-choice-text" placeholder="Texto (ej. Salir)" value="${Creator._e(c.text)}" data-msgid="${msg.id}" data-idx="${ci}" style="flex:1; padding:2px 4px; font-size:0.8rem;">
                          <select class="form-input pc-msg-choice-target" data-msgid="${msg.id}" data-idx="${ci}" style="width:130px; padding:2px; font-size:0.8rem;">
                            <optgroup label="Escenas">
                              ${this.scenes.map(s => `<option value="scene:${s.id}" ${c.targetSceneId === 'scene:' + s.id || c.targetSceneId === s.id ? 'selected' : ''}>${Creator._e(s.name) || '(Escena sin nombre)'}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Esta charla">
                              ${hs.sequence.map((sm, smIdx) => `<option value="msg:${sm.id}" ${c.targetSceneId === 'msg:' + sm.id ? 'selected' : ''}>Mensaje ${smIdx + 1}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Finales">
                              <option value="end:good" ${c.targetSceneId === 'end:good' ? 'selected' : ''}>🌟 Final Bueno</option>
                              <option value="end:bad" ${c.targetSceneId === 'end:bad' ? 'selected' : ''}>💀 Final Malo</option>
                              <option value="end:neutral" ${c.targetSceneId === 'end:neutral' ? 'selected' : ''}>😐 Final Neutral</option>
                            </optgroup>
                          </select>
                          <button class="btn-icon pc-del-msg-choice" data-msgid="${msg.id}" data-idx="${ci}" style="color:var(--error); font-size:0.8rem; padding:0 4px;">✕</button>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                          <div style="display:flex; align-items:center; gap:4px; flex:1;">
                            <span style="font-size:0.7rem; color:var(--text-muted);">🗝 Requiere:</span>
                            <select class="pc-msg-choice-req form-input" data-msgid="${msg.id}" data-idx="${ci}" style="flex:1; padding:1px; font-size:0.7rem;">
                              ${itemsHtml.replace(`value="${c.requiresItem}"`, `value="${c.requiresItem}" selected`)}
                            </select>
                          </div>
                          ${c.requiresItem ? `
                            <label style="display:flex; align-items:center; gap:4px; font-size:0.7rem; color:var(--text-muted); cursor:pointer;">
                              <input type="checkbox" class="pc-msg-choice-consume" data-msgid="${msg.id}" data-idx="${ci}" ${c.consumesItem ? 'checked' : ''}>
                              Consumir
                            </label>
                          ` : ''}
                        </div>
                        <!-- Mission triggers per choice -->
                        <div style="display:flex; gap:5px; margin-top:4px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.1);">
                           <select class="pc-msg-choice-act form-input" data-msgid="${msg.id}" data-idx="${ci}" style="flex:1; padding:1px; font-size:0.6rem;">
                             <option value="">🚀 (No activa misión)</option>
                             ${this.missions.map(m => `<option value="${m.id}" ${c.activatesMission === m.id ? 'selected' : ''}>🚀 ${Creator._e(m.name)}</option>`).join('')}
                           </select>
                           <select class="pc-msg-choice-comp form-input" data-msgid="${msg.id}" data-idx="${ci}" style="flex:1; padding:1px; font-size:0.6rem;">
                             <option value="">✅ (No completa misión)</option>
                             ${this.missions.map(m => `<option value="${m.id}" ${c.completesMission === m.id ? 'selected' : ''}>✅ ${Creator._e(m.name)}</option>`).join('')}
                           </select>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-sm btn-secondary" id="pc-btn-add-seq" style="width:100%;">+ Añadir Continuación de Diálogo</button>
        </div>
      `;

      // Eventos de secuencia
      document.getElementById('pc-btn-add-seq').addEventListener('click', () => {
        const lastMsg = hs.sequence[hs.sequence.length - 1];
        hs.sequence.push({
          id: App.uid(),
          speaker: lastMsg ? lastMsg.speaker : '',
          text: '',
          image: lastMsg ? lastMsg.image : null
        });
        this._renderHotspotDynamicProps(hs);
      });

      dyn.querySelectorAll('.pc-seq-item').forEach(item => {
        const id = item.dataset.id;
        const msg = hs.sequence.find(m => m.id === id);

        item.querySelector('.pc-seq-speaker').addEventListener('input', e => msg.speaker = e.target.value);
        item.querySelector('.pc-seq-text').addEventListener('input', e => msg.text = e.target.value);

        item.querySelector('.pc-del-seq').addEventListener('click', () => {
          if (hs.sequence.length <= 1) return showToast('Debe haber al menos un diálogo', 'error');
          hs.sequence = hs.sequence.filter(m => m.id !== id);
          this._renderHotspotDynamicProps(hs);
        });

        const handleSeqFile = file => {
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            msg.image = ev.target.result;
            this._renderHotspotDynamicProps(hs);
          };
          reader.readAsDataURL(file);
        };

        item.querySelector('.pc-seq-img-input').addEventListener('change', e => handleSeqFile(e.target.files[0]));
        const seqDropzone = item.querySelector('.pc-seq-img-dropzone');
        if (seqDropzone) {
          this._setupImageDrop(seqDropzone, handleSeqFile);
          seqDropzone.addEventListener('click', () => seqDropzone.querySelector('input').click());
        }

        const delImg = item.querySelector('.pc-seq-img-del');
        if (delImg) delImg.addEventListener('click', () => {
          msg.image = null;
          this._renderHotspotDynamicProps(hs);
        });

        item.querySelector('.pc-seq-next-scene').addEventListener('change', e => {
          msg.nextSceneId = e.target.value || null;
        });
        item.querySelector('.pc-seq-activates-mission').addEventListener('change', e => {
          msg.activatesMission = e.target.value || null;
        });
        item.querySelector('.pc-seq-completes-mission').addEventListener('change', e => {
          msg.completesMission = e.target.value || null;
        });
      });

      // Eventos de decisiones en cada mensaje
      dyn.querySelectorAll('.pc-btn-add-msg-choice').forEach(btn => {
        btn.addEventListener('click', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          if (!msg.choices) msg.choices = [];
          msg.choices.push({ text: 'Nueva Opción', targetSceneId: 'scene:' + this.scenes[0]?.id });
          this._renderHotspotDynamicProps(hs);
        });
      });

      dyn.querySelectorAll('.pc-msg-choice-text').forEach(inp => {
        inp.addEventListener('input', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          msg.choices[e.target.dataset.idx].text = e.target.value;
        });
      });
      dyn.querySelectorAll('.pc-msg-choice-target').forEach(sel => {
        sel.addEventListener('change', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          msg.choices[e.target.dataset.idx].targetSceneId = e.target.value;
        });
      });
      dyn.querySelectorAll('.pc-msg-choice-req').forEach(sel => {
        sel.addEventListener('change', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          msg.choices[e.target.dataset.idx].requiresItem = e.target.value || null;
          this._renderHotspotDynamicProps(hs); // Re-render to show/hide "Consumir" checkbox
        });
      });
      dyn.querySelectorAll('.pc-msg-choice-act').forEach(sel => {
        sel.addEventListener('change', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          msg.choices[e.target.dataset.idx].activatesMission = e.target.value || null;
        });
      });
      dyn.querySelectorAll('.pc-msg-choice-comp').forEach(sel => {
        sel.addEventListener('change', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          msg.choices[e.target.dataset.idx].completesMission = e.target.value || null;
        });
      });
      dyn.querySelectorAll('.pc-msg-choice-consume').forEach(chk => {
        chk.addEventListener('change', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          msg.choices[e.target.dataset.idx].consumesItem = e.target.checked;
        });
      });
      dyn.querySelectorAll('.pc-del-msg-choice').forEach(btn => {
        btn.addEventListener('click', e => {
          const msgId = e.target.dataset.msgid;
          const msg = hs.sequence.find(m => m.id === msgId);
          msg.choices.splice(e.target.dataset.idx, 1);
          this._renderHotspotDynamicProps(hs);
        });
      });
    }
  },

  _setupImageDrop(el, callback) {
    el.addEventListener('dragover', e => {
      e.preventDefault();
      el.style.borderColor = 'var(--primary)';
      el.style.background = 'rgba(217,70,239,0.05)';
    });
    el.addEventListener('dragleave', e => {
      e.preventDefault();
      el.style.borderColor = '';
      el.style.background = '';
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.borderColor = '';
      el.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        callback(file);
      }
    });
  },

  collectData() {
    if (!this.scenes.length) throw new Error("Debes añadir al menos una escena.");
    return {
      startSceneId: this.startSceneId || this.scenes[0].id,
      scenes: this.scenes,
      missions: this.missions
    };
  },

  _updateMissionDropdowns() {
    const missionsHtml = '<option value="">Ninguna</option>' + this.missions.map(m => `
      <option value="${m.id}">${Creator._e(m.name) || '(Misión sin nombre)'}</option>
    `).join('');

    const missionsHtmlDialog = '<option value="">(Sin cambio)</option>' + this.missions.map(m => `
      <option value="${m.id}">${Creator._e(m.name) || '(Misión sin nombre)'}</option>
    `).join('');

    // 1. Scene Level
    ['pc-scene-activates-mission', 'pc-scene-completes-mission'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const val = el.value;
        el.innerHTML = missionsHtml;
        el.value = val;
      }
    });

    // 2. Hotspot Level
    ['pc-hs-activates-mission', 'pc-hs-completes-mission'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const val = el.value;
        el.innerHTML = missionsHtml;
        el.value = val;
      }
    });

    // 3. Dialog Sequences (Messages)
    document.querySelectorAll('.pc-seq-activates-mission, .pc-seq-completes-mission').forEach(el => {
      const val = el.value;
      el.innerHTML = missionsHtmlDialog;
      el.value = val;
    });

    // 4. Dialog Choices
    document.querySelectorAll('.pc-msg-choice-act').forEach(el => {
      const val = el.value;
      el.innerHTML = '<option value="">🚀 (No activa misión)</option>' + this.missions.map(m => `<option value="${m.id}">🚀 ${Creator._e(m.name) || '(Misión sin nombre)'}</option>`).join('');
      el.value = val;
    });
    document.querySelectorAll('.pc-msg-choice-comp').forEach(el => {
      const val = el.value;
      el.innerHTML = '<option value="">✅ (No completa misión)</option>' + this.missions.map(m => `<option value="${m.id}">✅ ${Creator._e(m.name) || '(Misión sin nombre)'}</option>`).join('');
      el.value = val;
    });
  }
};
