/**
 * EduPlay - Table Sort / Mesa de Trabajo Activity Engine & Creator
 * Permite clasificar elementos en zonas sobre una mesa con imagen de fondo,
 * etiquetas de texto fijos (estéril, sucio, limpio) y opción de orden secuencial por zona.
 * + Interacción visual directa para arrastrar y cambiar tamaño de zonas y textos en el creador.
 * + Renderizado de instrumentos como imágenes PNG realistas sobre la mesa (sin fondo de cápsula/globito) y tamaño ajustable.
 */

// ═════════════════════════════════════════════════════════════════════════════
// CREATOR MODULE
// ═════════════════════════════════════════════════════════════════════════════
const TableSortCreator = {
  _act: null,
  _bgImage: 'assets/table_bg.jpg',
  _labels: [], // [{id, text, x, y, color}]
  _zones: [],  // [{id, name, x, y, width, height, ordered}]
  _items: [],  // [{id, name, image, imgSize, zoneId, order}]

  _activeDrag: null, // { type: 'label_move'|'zone_move'|'zone_resize', id, startX, startY, origX, origY, origW, origH }

  render(activity, allActivities = []) {
    this._act = activity;
    const d = activity?.data || {};
    
    this._bgImage = d.bgImage || 'assets/table_bg.jpg';
    this._labels = d.labels ? JSON.parse(JSON.stringify(d.labels)) : [
      { id: App.uid(), text: 'ETIQUETA 1', x: 25, y: 12, color: '#2563eb' },
      { id: App.uid(), text: 'ETIQUETA 2', x: 75, y: 12, color: '#dc2626' }
    ];
    
    // Por defecto, 3 zonas preconfiguradas (Izquierda, Centro, Derecha)
    this._zones = d.zones ? JSON.parse(JSON.stringify(d.zones)) : [
      { id: 'zone_left', name: 'Zona Izquierda', x: 3, y: 22, width: 29, height: 72, ordered: false },
      { id: 'zone_center', name: 'Zona Centro', x: 35, y: 22, width: 29, height: 72, ordered: false },
      { id: 'zone_right', name: 'Zona Derecha', x: 67, y: 22, width: 29, height: 72, ordered: false }
    ];

    this._items = d.items ? JSON.parse(JSON.stringify(d.items)) : [
      { id: App.uid(), name: 'Elemento 1', image: '', imgSize: 120, zoneId: 'zone_left', order: 1 },
      { id: App.uid(), name: 'Elemento 2', image: '', imgSize: 120, zoneId: 'zone_center', order: 1 },
      { id: App.uid(), name: 'Elemento 3', image: '', imgSize: 120, zoneId: 'zone_right', order: 1 }
    ];

    return `
      <div class="creator-form tablesort-creator">
        ${Creator._titleField(activity?.title || '', 'Ej: Clasificación de Instrumental Quirúrgico', activity?.subject || '', activity?.topic || '', allActivities)}

        <!-- 1. Editor Visual de la Mesa (Imagen + Textos Arrastrables + Zonas Redimensionables) -->
        <div class="creator-section-card">
          <h3 class="section-card-title">🖼️ Editor Visual de la Mesa</h3>
          <p class="section-card-desc">
            💡 <strong>Arrastra directamente</strong> los textos para moverlos. <strong>Mueve y estira las esquinas</strong> de las zonas para cambiar su tamaño y posición en la mesa.
          </p>

          <div class="table-bg-preview-container" style="position:relative; margin-top:1rem; border-radius:12px; overflow:hidden; border:2px dashed var(--border); background:var(--bg-surface); text-align:center; padding:1rem; user-select:none;">
            <div id="ts-bg-preview-wrapper" style="position:relative; width:100%; max-width:750px; aspect-ratio:16/9; margin:0 auto; border-radius:8px; overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,0.5);">
              <img id="ts-bg-img" src="${this._bgImage}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.src='assets/table_bg.jpg'" draggable="false">
              
              <!-- Fixed text labels preview overlay -->
              <div id="ts-labels-overlay-preview" style="position:absolute; inset:0;"></div>
              <!-- Zones preview overlay -->
              <div id="ts-zones-overlay-preview" style="position:absolute; inset:0;"></div>
            </div>

            <div style="margin-top:1rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="TableSortCreator._changeBgImage()">📷 Cambiar Imagen de Fondo</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="TableSortCreator._resetBgImage()">🔄 Usar Mesa Azul Predeterminada</button>
            </div>
          </div>
        </div>

        <!-- 2. Textos Fijos sobre la Imagen (Estéril, Sucio, Limpio...) -->
        <div class="creator-section-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h3 class="section-card-title">🏷️ Textos Fijos sobre la Imagen</h3>
              <p class="section-card-desc">Coloca rótulos fijos para guiar al estudiante (ej: "Estéril", "Sucio", "Limpio"). Puedes arrastrarlos directamente sobre la mesa arriba.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="TableSortCreator._addLabel()">+ Añadir Texto Fijo</button>
          </div>
          
          <div id="ts-labels-list" class="ts-items-grid" style="margin-top:1rem;">
            ${this._renderLabelsList()}
          </div>
        </div>

        <!-- 3. Zonas en la Mesa & Toggle de Orden -->
        <div class="creator-section-card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 class="section-card-title">📐 Zonas de la Mesa</h3>
              <p class="section-card-desc">Define las áreas donde los estudiantes deben colocar los objetos. Ajusta su tamaño estirando la esquina inferior derecha directamente sobre la mesa.</p>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button type="button" class="btn btn-ghost btn-sm" onclick="TableSortCreator._presetZones(2)">2 Zonas (Izq/Der)</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="TableSortCreator._presetZones(3)">3 Zonas (Izq/Centro/Der)</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="TableSortCreator._addZone()">+ Añadir Zona</button>
            </div>
          </div>

          <div id="ts-zones-list" style="margin-top:1rem; display:flex; flex-direction:column; gap:1rem;">
            ${this._renderZonesList()}
          </div>
        </div>

        <!-- 4. Banco de Elementos a Clasificar -->
        <div class="creator-section-card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 class="section-card-title">🧩 Banco de Elementos por Zona</h3>
              <p class="section-card-desc">Organiza y añade elementos directamente en las columnas de cada zona. Puedes subir fotos transparentes PNG, recortarlas y definir su orden.</p>
            </div>
          </div>

          <div id="ts-items-list" style="margin-top:1rem;">
            ${this._renderItemsList()}
          </div>
        </div>
      </div>
      ${Creator._footer()}
    `;
  },

  _attachEvents() {
    this._updatePreviewOverlay();

    const wrapper = document.getElementById('ts-bg-preview-wrapper');
    if (!wrapper) return;

    const getPctCoords = (e) => {
      const rect = wrapper.getBoundingClientRect();
      const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      return { xPct, yPct, rect };
    };

    wrapper.onpointerdown = e => {
      const labelEl = e.target.closest('[data-label-id]');
      const resizeHandle = e.target.closest('[data-zone-resize-id]');
      const zoneEl = e.target.closest('[data-zone-move-id]');

      const coords = getPctCoords(e);

      if (labelEl) {
        e.preventDefault();
        const id = labelEl.dataset.labelId;
        const lbl = this._labels.find(l => l.id === id);
        if (lbl) {
          this._activeDrag = {
            type: 'label_move',
            id,
            startXPct: coords.xPct,
            startYPct: coords.yPct,
            origX: lbl.x,
            origY: lbl.y
          };
          wrapper.setPointerCapture(e.pointerId);
        }
      } else if (resizeHandle) {
        e.preventDefault();
        e.stopPropagation();
        const id = resizeHandle.dataset.zoneResizeId;
        const z = this._zones.find(x => x.id === id);
        if (z) {
          this._activeDrag = {
            type: 'zone_resize',
            id,
            startXPct: coords.xPct,
            startYPct: coords.yPct,
            origW: z.width,
            origH: z.height
          };
          wrapper.setPointerCapture(e.pointerId);
        }
      } else if (zoneEl) {
        e.preventDefault();
        const id = zoneEl.dataset.zoneMoveId;
        const z = this._zones.find(x => x.id === id);
        if (z) {
          this._activeDrag = {
            type: 'zone_move',
            id,
            startXPct: coords.xPct,
            startYPct: coords.yPct,
            origX: z.x,
            origY: z.y
          };
          wrapper.setPointerCapture(e.pointerId);
        }
      }
    };

    wrapper.onpointermove = e => {
      if (!this._activeDrag) return;
      e.preventDefault();
      const coords = getPctCoords(e);
      const dxPct = coords.xPct - this._activeDrag.startXPct;
      const dyPct = coords.yPct - this._activeDrag.startYPct;

      if (this._activeDrag.type === 'label_move') {
        const lbl = this._labels.find(l => l.id === this._activeDrag.id);
        if (lbl) {
          lbl.x = Math.max(0, Math.min(100, Math.round(this._activeDrag.origX + dxPct)));
          lbl.y = Math.max(0, Math.min(100, Math.round(this._activeDrag.origY + dyPct)));
          this._updatePreviewOverlay();
          this._syncFormInput('label', lbl.id);
        }
      } else if (this._activeDrag.type === 'zone_move') {
        const z = this._zones.find(x => x.id === this._activeDrag.id);
        if (z) {
          z.x = Math.max(0, Math.min(100 - z.width, Math.round(this._activeDrag.origX + dxPct)));
          z.y = Math.max(0, Math.min(100 - z.height, Math.round(this._activeDrag.origY + dyPct)));
          this._updatePreviewOverlay();
          this._syncFormInput('zone', z.id);
        }
      } else if (this._activeDrag.type === 'zone_resize') {
        const z = this._zones.find(x => x.id === this._activeDrag.id);
        if (z) {
          z.width = Math.max(5, Math.min(100 - z.x, Math.round(this._activeDrag.origW + dxPct)));
          z.height = Math.max(5, Math.min(100 - z.y, Math.round(this._activeDrag.origH + dyPct)));
          this._updatePreviewOverlay();
          this._syncFormInput('zone', z.id);
        }
      }
    };

    wrapper.onpointerup = wrapper.onpointercancel = e => {
      if (this._activeDrag) {
        this._activeDrag = null;
        try { wrapper.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    };
  },

  _syncFormInput(type, id) {
    if (type === 'label') {
      const lbl = this._labels.find(l => l.id === id);
      if (!lbl) return;
      const xInp = document.getElementById(`lbl-x-${id}`);
      const yInp = document.getElementById(`lbl-y-${id}`);
      if (xInp) xInp.value = lbl.x;
      if (yInp) yInp.value = lbl.y;
    } else if (type === 'zone') {
      const z = this._zones.find(x => x.id === id);
      if (!z) return;
      const xInp = document.getElementById(`zone-x-${id}`);
      const yInp = document.getElementById(`zone-y-${id}`);
      const wInp = document.getElementById(`zone-w-${id}`);
      const hInp = document.getElementById(`zone-h-${id}`);
      if (xInp) xInp.value = z.x;
      if (yInp) yInp.value = z.y;
      if (wInp) wInp.value = z.width;
      if (hInp) hInp.value = z.height;
    }
  },

  _getLabelHex(lbl) {
    const colorMap = {
      blue: '#2563eb',
      red: '#dc2626',
      green: '#059669',
      purple: '#7c3aed',
      dark: '#0f172a'
    };
    if (lbl.color && lbl.color.startsWith('#')) return lbl.color;
    return colorMap[lbl.color] || '#2563eb';
  },

  _renderLabelsList() {
    if (!this._labels.length) {
      return `<p style="color:var(--text-muted); font-size:0.9rem;">No hay textos fijos agregados.</p>`;
    }
    return this._labels.map((lbl, idx) => `
      <div class="question-card" style="margin-bottom:0.75rem; padding:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:200px;">
            <span style="font-weight:bold; color:var(--primary-light);">#${idx + 1}</span>
            <input type="text" class="form-input" value="${Creator._e(lbl.text)}" placeholder="Ej: ETIQUETA" 
                   oninput="TableSortCreator._updateLabelText('${lbl.id}', this.value)" style="flex:1;">
          </div>

          <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <label style="font-size:0.85rem; color:var(--text-muted);">Color:</label>
              <input type="color" class="form-input-color" value="${this._getLabelHex(lbl)}" 
                     onchange="TableSortCreator._updateLabelColor('${lbl.id}', this.value)" 
                     style="width:34px; height:34px; padding:2px; border:1px solid var(--border); border-radius:50%; cursor:pointer; background:none;"
                     title="Seleccionar color (Rueda de color)">
            </div>

            <input type="hidden" id="lbl-x-${lbl.id}" value="${lbl.x}">
            <input type="hidden" id="lbl-y-${lbl.id}" value="${lbl.y}">

            <button type="button" class="btn-icon" onclick="TableSortCreator._removeLabel('${lbl.id}')" title="Eliminar label">✕</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  _renderZonesList() {
    if (!this._zones.length) {
      return `<p style="color:var(--text-muted); font-size:0.9rem;">No hay zonas definidas.</p>`;
    }
    return this._zones.map((z, idx) => `
      <div class="question-card" style="padding:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <h4 style="margin:0; color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
            <span class="stat-chip" style="padding:0.2rem 0.6rem;">Zona ${idx + 1}</span>
            <input type="text" class="form-input" value="${Creator._e(z.name)}" placeholder="Nombre de la zona"
                   oninput="TableSortCreator._updateZoneName('${z.id}', this.value)" style="font-weight:600; width:220px;">
          </h4>
          <button type="button" class="btn-icon" onclick="TableSortCreator._removeZone('${z.id}')" title="Eliminar zona">✕</button>
        </div>

        <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); padding:0.75rem; border-radius:8px;">
          <!-- Toggle de Orden Secuencial -->
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600; font-size:0.9rem; color:var(--primary-light);">
            <input type="checkbox" style="width:18px; height:18px; accent-color:var(--primary);" 
                   ${z.ordered ? 'checked' : ''} 
                   onchange="TableSortCreator._updateZoneOrdered('${z.id}', this.checked)">
            <span>🔢 Exigir Orden Secuencial</span>
          </label>

          <input type="hidden" id="zone-x-${z.id}" value="${z.x}">
          <input type="hidden" id="zone-y-${z.id}" value="${z.y}">
          <input type="hidden" id="zone-w-${z.id}" value="${z.width}">
          <input type="hidden" id="zone-h-${z.id}" value="${z.height}">
        </div>
      </div>
    `).join('');
  },

  _renderItemsList() {
    if (!this._zones.length) {
      return `<p style="color:var(--text-muted); font-size:0.9rem;">Crea al menos una zona primero para agregar elementos al banco.</p>`;
    }

    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem; align-items:start;">
        ${this._zones.map(z => {
          const zoneItems = this._items.filter(it => it.zoneId === z.id);
          return `
            <div class="ts-zone-column-card" style="background:var(--bg-surface); border:1.5px solid var(--border); border-radius:12px; padding:1rem; display:flex; flex-direction:column; gap:0.75rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
                <h4 style="margin:0; font-size:1rem; color:var(--primary-light); font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                  <span>📍 ${Creator._e(z.name)}</span>
                  ${z.ordered ? '<span style="font-size:0.75rem; background:rgba(217,70,239,0.2); color:var(--primary-light); padding:2px 6px; border-radius:4px;">🔢 Ordenado</span>' : ''}
                </h4>
                <span class="stat-chip" style="font-size:0.78rem; padding:0.15rem 0.5rem;">${zoneItems.length} item${zoneItems.length === 1 ? '' : 's'}</span>
              </div>

              <!-- Lista de items en esta zona -->
              <div style="display:flex; flex-direction:column; gap:0.75rem;">
                ${zoneItems.length === 0 ? `
                  <div style="text-align:center; padding:1.5rem 0.5rem; border:1.5px dashed var(--border); border-radius:8px; color:var(--text-muted); font-size:0.85rem;">
                    Sin elementos en esta zona
                  </div>
                ` : zoneItems.map((it, idx) => this._renderItemCard(it, z, idx)).join('')}
              </div>

              <!-- Botón para añadir elemento directamente a esta zona -->
              <button type="button" class="btn btn-secondary btn-sm" onclick="TableSortCreator._addItemToZone('${z.id}')" style="width:100%; margin-top:0.25rem; justify-content:center;">
                + Añadir elemento a ${Creator._e(z.name)}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _renderItemCard(it, z, idx) {
    return `
      <div class="question-card" style="padding:0.85rem; margin:0; background:var(--bg-card);" data-item-id="${it.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span style="font-weight:bold; font-size:0.85rem; color:var(--primary-light);">#${idx + 1}</span>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${this._zones.length > 1 ? `
              <select class="form-input" onchange="TableSortCreator._updateItemZone('${it.id}', this.value)" style="padding:0.2rem 0.4rem; font-size:0.75rem; width:auto;" title="Mover a otra zona">
                ${this._zones.map(zn => `<option value="${zn.id}" ${it.zoneId === zn.id ? 'selected' : ''}>Mover a: ${Creator._e(zn.name)}</option>`).join('')}
              </select>
            ` : ''}
            <button type="button" class="btn-icon" onclick="TableSortCreator._removeItem('${it.id}')" title="Eliminar elemento" style="width:26px; height:26px; font-size:0.8rem; min-width:26px;">✕</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <!-- Nombre del elemento -->
          <input type="text" class="form-input" value="${Creator._e(it.name)}" placeholder="Nombre del elemento / instrumento"
                 oninput="TableSortCreator._updateItemName('${it.id}', this.value)" style="font-weight:500; font-size:0.9rem; padding:0.4rem 0.6rem;">

          <!-- Opciones de orden y tamaño de imagen -->
          <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
            ${z.ordered ? `
            <div style="display:flex; align-items:center; gap:0.25rem;">
              <label style="font-size:0.75rem; color:var(--primary-light); white-space:nowrap;">Secuencia (Orden):</label>
              <input type="number" class="form-input" value="${it.order || (idx + 1)}" min="1" max="50" style="width:55px; padding:0.25rem 0.4rem; font-size:0.8rem;"
                     oninput="TableSortCreator._updateItemOrder('${it.id}', this.value)">
            </div>` : ''}

            ${it.image ? `
            <div style="display:flex; align-items:center; gap:0.25rem;">
              <label style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">Alt px:</label>
              <input type="number" class="form-input" value="${it.imgSize || 120}" min="40" max="300" style="width:65px; padding:0.25rem 0.4rem; font-size:0.8rem;"
                     oninput="TableSortCreator._updateItemImgSize('${it.id}', this.value)">
            </div>` : ''}
          </div>

          <!-- Imagen opcional del elemento -->
          <div class="item-image-area" style="margin-top:0.25rem;">
            <div class="item-image-preview-wrapper" style="${it.image ? '' : 'display:none'}; max-width:100%; aspect-ratio:16/9; max-height:90px;">
              ${it.image ? `<img src="${it.image}" class="item-img-tag" style="max-height:80px; object-fit:contain;">` : ''}
              <button class="btn-crop-img-overlay" type="button" onclick="TableSortCreator._cropItemImage('${it.id}', this)" title="Recortar imagen">✂️</button>
              <button class="btn-remove-img-overlay" type="button" onclick="TableSortCreator._removeItemImage('${it.id}')" title="Quitar imagen">✕</button>
            </div>
            <button class="btn btn-sm btn-ghost" type="button" onclick="TableSortCreator._uploadItemImage('${it.id}')" style="font-size:0.78rem; padding:0.3rem 0.5rem; width:100%; justify-content:center;">
              ${it.image ? '📷 Cambiar foto' : '📷 Foto opcional'}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  _cropItemImage(id, btn) {
    const card = btn.closest('.item-image-area');
    const img = card?.querySelector('.item-img-tag');
    if (!img || !img.src) return;
    ImageCropper.open(img.src, croppedSrc => {
      img.src = croppedSrc;
      const it = this._items.find(x => x.id === id);
      if (it) it.image = croppedSrc;
    });
  },

  // ── Preview overlay renderer con arrastre y redimensionado visual ───
  _updatePreviewOverlay() {
    const labelsContainer = document.getElementById('ts-labels-overlay-preview');
    const zonesContainer = document.getElementById('ts-zones-overlay-preview');
    if (!labelsContainer || !zonesContainer) return;

    // Render Labels Overlay
    labelsContainer.innerHTML = this._labels.map(lbl => {
      const colorHex = this._getLabelHex(lbl);
      return `
        <div class="ts-label-badge" 
             data-label-id="${lbl.id}"
             style="position:absolute; left:${lbl.x}%; top:${lbl.y}%; transform:translate(-50%, -50%); cursor:move; z-index:10; border:2px solid rgba(255,255,255,0.6); background:${colorHex}; color:#fff;"
             title="Arrastra para mover este texto">
          🖐️ ${Creator._e(lbl.text)}
        </div>
      `;
    }).join('');

    // Render Zones Overlay (Sin visualizar texto de porcentajes)
    zonesContainer.innerHTML = this._zones.map(z => `
      <div data-zone-move-id="${z.id}"
           style="position:absolute; left:${z.x}%; top:${z.y}%; width:${z.width}%; height:${z.height}%; 
                  border:1.5px dashed #a855f7; background:rgba(168,85,247,0.08); border-radius:8px;
                  cursor:move; z-index:5; display:flex; flex-direction:column; justify-content:space-between; padding:4px; box-sizing:border-box;"
           title="Arrastra para mover la zona">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; font-weight:bold; background:rgba(0,0,0,0.65); color:#fff; padding:2px 6px; border-radius:4px;">
            ${Creator._e(z.name)} ${z.ordered ? '🔢' : ''}
          </span>
        </div>

        <!-- Tirador de cambio de tamaño (Resize handle) -->
        <div data-zone-resize-id="${z.id}" 
             style="position:absolute; right:-6px; bottom:-6px; width:16px; height:16px; background:#a855f7; border:2px solid #fff; border-radius:50%; cursor:se-resize; z-index:12; box-shadow:0 0 8px rgba(0,0,0,0.5);"
             title="Arrastra esta esquina para cambiar el tamaño de la zona">
        </div>
      </div>
    `).join('');
  },

  // ── Handlers & Mutators ──────────────────────
  _changeBgImage() {
    let input = document.getElementById('ts-bg-upload-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'ts-bg-upload-input';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
    }
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        return showToast('Imagen muy grande (máx 2MB)', 'error');
      }
      const reader = new FileReader();
      reader.onload = ev => {
        this._bgImage = ev.target.result;
        const img = document.getElementById('ts-bg-img');
        if (img) img.src = this._bgImage;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  _resetBgImage() {
    this._bgImage = 'assets/table_bg.jpg';
    const img = document.getElementById('ts-bg-img');
    if (img) img.src = this._bgImage;
    showToast('Restaurada imagen de la mesa predeterminada', 'info');
  },

  _addLabel() {
    this._labels.push({ id: App.uid(), text: 'NUEVO TEXTO', x: 50, y: 15, color: 'blue' });
    document.getElementById('ts-labels-list').innerHTML = this._renderLabelsList();
    this._updatePreviewOverlay();
  },

  _removeLabel(id) {
    this._labels = this._labels.filter(l => l.id !== id);
    document.getElementById('ts-labels-list').innerHTML = this._renderLabelsList();
    this._updatePreviewOverlay();
  },

  _updateLabelText(id, val) {
    const l = this._labels.find(x => x.id === id);
    if (l) { l.text = val; this._updatePreviewOverlay(); }
  },

  _updateLabelColor(id, val) {
    const l = this._labels.find(x => x.id === id);
    if (l) { l.color = val; this._updatePreviewOverlay(); }
  },

  _updateLabelPos(id, axis, val) {
    const l = this._labels.find(x => x.id === id);
    if (l) { l[axis] = parseInt(val) || 0; this._updatePreviewOverlay(); }
  },

  _addZone() {
    const idx = this._zones.length + 1;
    this._zones.push({
      id: 'zone_' + App.uid(),
      name: `Zona ${idx}`,
      x: 10, y: 30, width: 35, height: 60,
      ordered: false
    });
    document.getElementById('ts-zones-list').innerHTML = this._renderZonesList();
    document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
    this._updatePreviewOverlay();
  },

  _presetZones(count) {
    if (count === 2) {
      this._zones = [
        { id: 'zone_left', name: 'Zona Izquierda', x: 4, y: 22, width: 44, height: 72, ordered: false },
        { id: 'zone_right', name: 'Zona Derecha', x: 52, y: 22, width: 44, height: 72, ordered: false }
      ];
    } else if (count === 3) {
      this._zones = [
        { id: 'zone_left', name: 'Zona Izquierda', x: 3, y: 22, width: 29, height: 72, ordered: false },
        { id: 'zone_center', name: 'Zona Centro', x: 35, y: 22, width: 29, height: 72, ordered: false },
        { id: 'zone_right', name: 'Zona Derecha', x: 67, y: 22, width: 29, height: 72, ordered: false }
      ];
    }
    // Asignar primera zona disponible a items huérfanos
    this._items.forEach(it => {
      if (!this._zones.some(z => z.id === it.zoneId)) {
        it.zoneId = this._zones[0].id;
      }
    });

    document.getElementById('ts-zones-list').innerHTML = this._renderZonesList();
    document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
    this._updatePreviewOverlay();
    showToast(`Aplicado diseño de ${count} zonas`, 'info');
  },

  _removeZone(id) {
    if (this._zones.length <= 1) {
      return showToast('Debe haber al menos 1 zona en la mesa', 'error');
    }
    this._zones = this._zones.filter(z => z.id !== id);
    // Reasignar items a la primera zona restante
    const fallbackId = this._zones[0].id;
    this._items.forEach(it => {
      if (it.zoneId === id) it.zoneId = fallbackId;
    });

    document.getElementById('ts-zones-list').innerHTML = this._renderZonesList();
    document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
    this._updatePreviewOverlay();
  },

  _updateZoneName(id, val) {
    const z = this._zones.find(x => x.id === id);
    if (z) {
      z.name = val;
      document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
      this._updatePreviewOverlay();
    }
  },

  _updateZoneOrdered(id, isChecked) {
    const z = this._zones.find(x => x.id === id);
    if (z) {
      z.ordered = isChecked;
      document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
      this._updatePreviewOverlay();
    }
  },

  _updateZoneDim(id, key, val) {
    const z = this._zones.find(x => x.id === id);
    if (z) {
      z[key] = parseInt(val) || 0;
      this._updatePreviewOverlay();
    }
  },

  _addItem(zoneId) {
    const targetZoneId = zoneId || this._zones[0]?.id || '';
    const sameZoneItems = this._items.filter(i => i.zoneId === targetZoneId);

    this._items.push({
      id: App.uid(),
      name: `Elemento ${this._items.length + 1}`,
      image: '',
      imgSize: 120,
      zoneId: targetZoneId,
      order: sameZoneItems.length + 1
    });
    document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
  },

  _addItemToZone(zoneId) {
    this._addItem(zoneId);
  },

  _removeItem(id) {
    this._items = this._items.filter(i => i.id !== id);
    document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
  },

  _updateItemName(id, val) {
    const it = this._items.find(x => x.id === id);
    if (it) it.name = val;
  },

  _updateItemZone(id, val) {
    const it = this._items.find(x => x.id === id);
    if (it) {
      it.zoneId = val;
      const sameZoneItems = this._items.filter(i => i.zoneId === val);
      it.order = sameZoneItems.length;
      document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
    }
  },

  _updateItemOrder(id, val) {
    const it = this._items.find(x => x.id === id);
    if (it) it.order = parseInt(val) || 1;
  },

  _updateItemImgSize(id, val) {
    const it = this._items.find(x => x.id === id);
    if (it) it.imgSize = parseInt(val) || 120;
  },

  _removeItemImage(id) {
    const it = this._items.find(x => x.id === id);
    if (it) {
      it.image = '';
      document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
    }
  },

  _uploadItemImage(id) {
    let input = document.getElementById('ts-item-img-upload');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'ts-item-img-upload';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
    }
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1 * 1024 * 1024) return showToast('Imagen muy grande (máx 1MB)', 'error');
      const reader = new FileReader();
      reader.onload = ev => {
        const it = this._items.find(x => x.id === id);
        if (it) {
          it.image = ev.target.result;
          if (!it.imgSize) it.imgSize = 120;
          document.getElementById('ts-items-list').innerHTML = this._renderItemsList();
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  // ── Save activity data ───────────────────────
  collectData() {
    const title   = document.getElementById('act-title')?.value.trim();
    const subject = document.getElementById('act-subject')?.value.trim() || '';
    const topic   = document.getElementById('act-topic')?.value.trim() || '';

    if (!title) { showToast('Ingresa un título para la actividad', 'error'); return null; }
    if (!this._zones.length) { showToast('Debes tener al menos 1 zona en la mesa', 'error'); return null; }
    if (!this._items.length) { showToast('Debes añadir al menos 1 elemento al banco', 'error'); return null; }

    return {
      title,
      subject,
      topic,
      data: {
        bgImage: this._bgImage,
        labels:  this._labels,
        zones:   this._zones,
        items:   this._items
      }
    };
  }
};


// ═════════════════════════════════════════════════════════════════════════════
// PLAYER MODULE
// ═════════════════════════════════════════════════════════════════════════════
const TableSortActivity = {
  act: null,
  placed: {},   // { zoneId: [itemId, itemId, ...] }
  selected: null, // itemId for tap-to-place on mobile/desktop
  submitted: false,

  shuffledItems: [],

  start(activity) {
    this.act = activity;
    this.placed = {};
    this.selected = null;
    this.submitted = false;

    // Aleatorizar los elementos del banco
    this.shuffledItems = this._shuffle([...(activity?.data?.items || [])]);

    // Inicializar contenedores de zonas vacíos
    (activity.data.zones || []).forEach(z => {
      this.placed[z.id] = [];
    });

    this.render();
  },

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  render() {
    const container = document.getElementById('player-content');
    const d = this.act.data;
    const allItems = this.shuffledItems || d.items || [];
    const zones = d.zones || [];
    const labels = d.labels || [];

    // Calcular elementos aún en el banco
    const placedItemIds = new Set(Object.values(this.placed).flat());
    const bankItems = allItems.filter(i => !placedItemIds.has(i.id));

    // Elementos totales y colocados
    const totalCount = allItems.length;
    const placedCount = placedItemIds.size;

    container.innerHTML = `
      <div class="tablesort-player-container">
        
        <!-- Header de Progreso -->
        <div class="progress-container" style="margin-bottom:1rem;">
          <div class="progress-header">
            <span>Elementos colocados en la mesa</span>
            <span><strong>${placedCount}</strong> / ${totalCount}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.round((placedCount / totalCount) * 100)}%"></div>
          </div>
        </div>

        <!-- Mesa de Trabajo (Imagen de fondo + zonas + etiquetas) -->
        <div class="ts-table-wrapper" id="ts-table-wrapper">
          <img src="${d.bgImage || 'assets/table_bg.jpg'}" class="ts-table-bg-img" alt="Mesa de Trabajo" draggable="false">

          <!-- Etiquetas de Texto Fijas -->
          <div class="ts-labels-overlay">
            ${labels.map(lbl => {
              const colorHex = TableSortCreator._getLabelHex ? TableSortCreator._getLabelHex(lbl) : (lbl.color && lbl.color.startsWith('#') ? lbl.color : ({ blue: '#2563eb', red: '#dc2626', green: '#059669', purple: '#7c3aed', dark: '#0f172a' }[lbl.color] || '#2563eb'));
              return `
                <div class="ts-label-badge" style="position:absolute; left:${lbl.x}%; top:${lbl.y}%; transform:translate(-50%,-50%); background:${colorHex}; color:#fff;">
                  ${App.esc(lbl.text)}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Zonas de Colocación (Drop targets) -->
          <div class="ts-zones-overlay">
            ${zones.map(z => this._renderZoneBox(z)).join('')}
          </div>
        </div>

        <!-- Banco de Elementos (Abajo) -->
        <div class="ts-bank-container">
          <div class="ts-bank-header">
            <h3>🧩 Banco de Elementos (${bankItems.length})</h3>
            <span style="font-size:0.85rem; color:var(--text-muted);">
              Arrastra o toca un elemento y luego toca la zona de la mesa donde corresponda.
            </span>
          </div>

          <div class="ts-bank-grid" id="ts-bank-grid">
            ${bankItems.length === 0 ? `
              <div style="grid-column:1/-1; text-align:center; padding:1rem; color:var(--text-muted); font-size:0.9rem;">
                ¡Todos los elementos están colocados en la mesa! 🎯
              </div>` : 
              bankItems.map(it => this._renderItemChip(it)).join('')
            }
          </div>
        </div>

        <!-- Acciones del Jugador -->
        <div class="player-actions-bar" style="margin-top:1.5rem; display:flex; justify-content:center; gap:1rem;">
          ${this.submitted ? `
            <button class="btn btn-secondary btn-lg" onclick="TableSortActivity.start(TableSortActivity.act)">🔄 Volver a Intentar</button>
          ` : `
            <button class="btn btn-ghost" onclick="TableSortActivity._resetPlacement()">🧹 Limpiar Mesa</button>
            <button class="btn btn-primary btn-lg" id="btn-ts-submit" onclick="TableSortActivity._checkAnswers()" ${placedCount === 0 ? 'disabled' : ''}>
              ✅ Comprobar Mesa
            </button>
          `}
        </div>

      </div>
    `;

    this._attachInteractions();
  },

  _renderZoneBox(z) {
    const itemsInZone = (this.placed[z.id] || []).map(id => this.act.data.items.find(i => i.id === id)).filter(Boolean);

    return `
      <div class="ts-zone-box ${this.selected ? 'ts-zone-highlight' : ''}" 
           data-zone-id="${z.id}"
           style="position:absolute; left:${z.x}%; top:${z.y}%; width:${z.width}%; height:${z.height}%;">
        
        <div class="ts-zone-header">
          <span class="ts-zone-title">${App.esc(z.name)}</span>
          ${z.ordered ? '<span class="ts-zone-badge-ordered" title="Los elementos deben ir en orden estricto">🔢 En orden</span>' : ''}
        </div>

        <div class="ts-zone-content">
          ${itemsInZone.map((it, idx) => this._renderPlacedChip(it, z, idx)).join('')}
        </div>
      </div>
    `;
  },

  _renderItemChip(it) {
    const isSel = this.selected === it.id;
    return `
      <div class="ts-item-chip ${isSel ? 'selected' : ''}" 
           draggable="true" 
           data-item-id="${it.id}"
           onclick="TableSortActivity._selectItem('${it.id}')">
        ${it.image ? `<img src="${it.image}" class="ts-chip-img" alt="">` : ''}
        <span class="ts-chip-text">${App.esc(it.name)}</span>
      </div>
    `;
  },

  _renderPlacedChip(it, zone, index) {
    let resultClass = '';
    let statusIcon = '';

    if (this.submitted) {
      const isCorrectZone = it.zoneId === zone.id;
      let isCorrectOrder = true;

      if (zone.ordered) {
        // En zona ordenada, el índice 0 corresponde a order: 1
        isCorrectOrder = (it.order === (index + 1));
      }

      if (isCorrectZone && isCorrectOrder) {
        resultClass = 'chip-correct';
        statusIcon = '✅';
      } else {
        resultClass = 'chip-incorrect';
        statusIcon = '❌';
      }
    }

    // Si tiene imagen, renderizar la imagen PNG directamente sobre la mesa (sin fondo de cápusa/globito)
    if (it.image) {
      const hPx = parseInt(it.imgSize) || 120;
      return `
        <div class="ts-placed-item-wrapper ${resultClass}" 
             data-item-id="${it.id}"
             data-zone-id="${zone.id}"
             onclick="TableSortActivity._onPlacedChipClick('${it.id}', '${zone.id}')"
             title="${App.esc(it.name)} (Click para quitar)">
          ${zone.ordered ? `<span class="ts-placed-order-num" style="position:absolute; top:-2px; left:-2px; z-index:4;">${index + 1}º</span>` : ''}
          <img src="${it.image}" class="ts-placed-img" style="height:${hPx}px; max-width:100%;" alt="${App.esc(it.name)}">
          <span class="ts-placed-item-name">${App.esc(it.name)}</span>
          ${statusIcon ? `<span class="ts-chip-status" style="position:absolute; top:-6px; right:-6px; font-size:1.2rem; z-index:5;">${statusIcon}</span>` : '<button type="button" class="ts-item-remove-btn">✕</button>'}
        </div>
      `;
    }

    return `
      <div class="ts-placed-chip ${resultClass}" 
           data-item-id="${it.id}"
           data-zone-id="${zone.id}"
           onclick="TableSortActivity._onPlacedChipClick('${it.id}', '${zone.id}')">
        ${zone.ordered ? `<span class="ts-placed-order-num">${index + 1}º</span>` : ''}
        <span class="ts-chip-text">${App.esc(it.name)}</span>
        ${statusIcon ? `<span class="ts-chip-status">${statusIcon}</span>` : '<span class="ts-chip-remove">✕</span>'}
      </div>
    `;
  },

  // ── Interacciones Drag & Drop + Tap-to-Place ───
  _attachInteractions() {
    if (this.submitted) return;

    // Draggable chips
    document.querySelectorAll('.ts-item-chip[draggable="true"]').forEach(chip => {
      chip.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', chip.dataset.itemId);
        chip.classList.add('dragging');
      });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    });

    // Drop zones
    document.querySelectorAll('.ts-zone-box').forEach(zoneEl => {
      zoneEl.addEventListener('dragover', e => {
        e.preventDefault();
        zoneEl.classList.add('drag-over');
      });

      zoneEl.addEventListener('dragleave', () => zoneEl.classList.remove('drag-over'));

      zoneEl.addEventListener('drop', e => {
        e.preventDefault();
        zoneEl.classList.remove('drag-over');
        const itemId = e.dataTransfer.getData('text/plain');
        const zoneId = zoneEl.dataset.zoneId;
        if (itemId && zoneId) {
          this._placeItemInZone(itemId, zoneId);
        }
      });

      // Tap-to-place en la zona
      zoneEl.addEventListener('click', e => {
        if (e.target.closest('.ts-placed-chip') || e.target.closest('.ts-placed-item-wrapper')) return;
        if (this.selected) {
          this._placeItemInZone(this.selected, zoneEl.dataset.zoneId);
        }
      });
    });
  },

  _selectItem(id) {
    if (this.submitted) return;
    this.selected = (this.selected === id) ? null : id;
    this.render();
  },

  _placeItemInZone(itemId, zoneId) {
    if (this.submitted) return;

    // Quitar de otras zonas si ya estaba colocado
    Object.keys(this.placed).forEach(zId => {
      this.placed[zId] = this.placed[zId].filter(id => id !== itemId);
    });

    // Colocar en nueva zona
    if (!this.placed[zoneId]) this.placed[zoneId] = [];
    this.placed[zoneId].push(itemId);

    this.selected = null;
    App.playSound('pop');
    this.render();
  },

  _onPlacedChipClick(itemId, zoneId) {
    if (this.submitted) return;
    // Si se hace clic en un chip ya colocado, devolver al banco
    this.placed[zoneId] = (this.placed[zoneId] || []).filter(id => id !== itemId);
    App.playSound('pop');
    this.render();
  },

  _resetPlacement() {
    if (this.submitted) return;
    (this.act.data.zones || []).forEach(z => {
      this.placed[z.id] = [];
    });
    this.selected = null;
    showToast('Mesa limpiada', 'info');
    this.render();
  },

  // ── Verificación y Cálculo de Puntaje ─────────
  _checkAnswers() {
    if (this.submitted) return;
    this.submitted = true;

    const items = this.act.data.items || [];
    const zones = this.act.data.zones || [];

    let totalPoints = items.length;
    let earnedPoints = 0;

    items.forEach(it => {
      const correctZoneId = it.zoneId;
      const targetZone = zones.find(z => z.id === correctZoneId);

      // Buscar en qué zona y qué posición lo puso el jugador
      let playerZoneId = null;
      let playerIndex = -1;

      Object.entries(this.placed).forEach(([zId, placedList]) => {
        const idx = placedList.indexOf(it.id);
        if (idx !== -1) {
          playerZoneId = zId;
          playerIndex = idx;
        }
      });

      const inCorrectZone = (playerZoneId === correctZoneId);

      if (inCorrectZone) {
        if (targetZone?.ordered) {
          // Si exige orden, el índice debe coincidir (order: 1 -> index 0)
          const expectedIndex = (it.order || 1) - 1;
          if (playerIndex === expectedIndex) {
            earnedPoints++;
          }
        } else {
          earnedPoints++;
        }
      }
    });

    const scorePct = Math.round((earnedPoints / totalPoints) * 100);

    // Audio Feedback
    if (scorePct === 100) {
      App.playSound('win');
    } else if (scorePct >= 60) {
      App.playSound('correct');
    } else {
      App.playSound('incorrect');
    }

    this.render();

    // Mostrar Modal de Resultados
    setTimeout(() => {
      const msgData = scoreMessage(scorePct);
      const isMapacheImg = msgData.emoji && msgData.emoji.includes('<img');

      showInfoModal(
        'Resultados de la Mesa',
        `
        <div style="text-align:center; padding:1rem 0;">
          <div style="font-size:3rem; margin-bottom:0.5rem;">
            ${isMapacheImg ? msgData.emoji : msgData.emoji}
          </div>
          <h2 style="font-size:2.2rem; font-weight:800; color:var(--primary-light); margin-bottom:0.25rem;">${scorePct}%</h2>
          <p style="font-size:1.1rem; color:var(--text-main); font-weight:600; margin-bottom:1rem;">${msgData.msg}</p>
          <div class="stat-chip" style="display:inline-block; font-size:1rem; padding:0.5rem 1.2rem;">
            Aciertos: <strong>${earnedPoints}</strong> de <strong>${totalPoints}</strong> elementos
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-top:1rem;">
            Revisa la mesa para ver los aciertos (✅) y correcciones (❌).
          </p>
        </div>
        `
      );
    }, 300);
  }
};
