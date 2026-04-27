/**
 * EduPlay - Creator Module (v2)
 * All activity types + subject/topic categorization + image labeling
 */
const Creator = {
  type:     null,
  _cats:    [],       // drag & drop categories cache
  _imgData: [],       // image labeling: [{id, src, zones:[]}]

  _typeNames: {
    quiz:       'Quiz',
    truefalse:  'Verdadero / Falso',
    dragdrop:   'Drag & Drop',
    matching:   'Conexión de Términos',
    memory:     'Juego de Memoria',
    imagelabel: 'Etiquetado de Imagen',
  },
  
  // ── Image Helpers ────────────────────────────
  _imgPart(imgSrc) {
    return `
      <div class="item-image-area">
        <div class="item-image-preview-wrapper" style="${imgSrc ? '' : 'display:none'}">
          ${imgSrc ? `<img src="${imgSrc}" class="item-img-tag">` : ''}
          <button class="btn-remove-img-overlay" onclick="Creator._removeImg(this)" title="Quitar imagen">✕</button>
        </div>
        <button class="btn btn-sm btn-upload-item-img" onclick="Creator._triggerImgUpload(this)">
          ${imgSrc ? '📷 Cambiar imagen' : '📷 Añadir imagen'}
        </button>
      </div>`;
  },

  _triggerImgUpload(btn) {
    let input = document.getElementById('global-item-img-upload');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'global-item-img-upload';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
    }
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) {
        showToast('La imagen es muy pesada (máx 1.5MB). Intenta con otra.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const base64 = ev.target.result;
        const card = btn.closest('.question-card');
        const wrapper = card.querySelector('.item-image-preview-wrapper');
        wrapper.style.display = 'flex';
        wrapper.innerHTML = `<img src="${base64}" class="item-img-tag"><button class="btn-remove-img-overlay" onclick="Creator._removeImg(this)" title="Quitar imagen">✕</button>`;
        btn.innerHTML = '📷 Cambiar imagen';
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  _removeImg(btn) {
    const area = btn.closest('.item-image-area');
    const wrapper = area.querySelector('.item-image-preview-wrapper');
    const uploadBtn = area.querySelector('.btn-upload-item-img');
    wrapper.style.display = 'none';
    wrapper.innerHTML = '';
    uploadBtn.innerHTML = '📷 Añadir imagen';
  },

  // ── Public API ───────────────────────────────
  async newActivity(type) {
    this.type = type;
    App.editingActivityId = null;
    document.getElementById('creator-title').textContent = 'Crear ' + (this._typeNames[type] || type);
    const all = await Storage.getActivities();
    this._render(type, null, all);
  },

  async loadActivity(activity) {
    this.type = activity.type;
    document.getElementById('creator-title').textContent = 'Editar ' + (this._typeNames[activity.type] || activity.type);
    const all = await Storage.getActivities();
    this._render(activity.type, activity, all);
  },

  // ── Render dispatcher ────────────────────────
  _render(type, activity, allActivities = []) {
    const el  = document.getElementById('creator-content');
    const map = {
      quiz:       () => this._quizForm(activity, allActivities),
      truefalse:  () => this._tfForm(activity, allActivities),
      dragdrop:   () => this._ddForm(activity, allActivities),
      matching:   () => this._matchForm(activity, allActivities),
      memory:     () => this._memForm(activity, allActivities),
      imagelabel: () => this._imgLabelForm(activity, allActivities),
    };
    el.innerHTML = (map[type] || (() => '<p>Tipo no soportado</p>'))();
    this._attachEvents(type);
  },

  // ── Common sections ──────────────────────────

  /** Title field + optional subject/topic rows */
  _titleField(val, placeholder, subject = '', topic = '', acts = []) {
    const subjects = [...new Set(acts.map(a => a.subject).filter(Boolean))].sort();
    const topics   = [...new Set(acts.map(a => a.topic).filter(Boolean))].sort();
    return `
      <div class="creator-title-section">
        <div class="form-group">
          <label class="form-label" for="act-title">Título de la Actividad</label>
          <input type="text" id="act-title" class="form-input"
            placeholder="${placeholder}" value="${Creator._e(val)}">
        </div>
        <div class="subject-topic-row">
          <div class="form-group">
            <label class="form-label">Materia / Asignatura <small style="text-transform:none;font-weight:400;color:var(--text-muted)">(opcional)</small></label>
            <input type="text" id="act-subject" class="form-input"
              placeholder="Ej: Anatomía, Historia, Matemáticas…"
              list="dl-subjects" value="${Creator._e(subject)}">
            <datalist id="dl-subjects">${subjects.map(s => `<option value="${Creator._e(s)}">`).join('')}</datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Tema <small style="text-transform:none;font-weight:400;color:var(--text-muted)">(opcional)</small></label>
            <input type="text" id="act-topic" class="form-input"
              placeholder="Ej: Músculos faciales, La Revolución Francesa…"
              list="dl-topics" value="${Creator._e(topic)}">
            <datalist id="dl-topics">${topics.map(t => `<option value="${Creator._e(t)}">`).join('')}</datalist>
          </div>
        </div>
      </div>`;
  },

  _footer() {
    return `
      <div class="creator-footer">
        <div class="creator-footer-inner">
          <button class="btn btn-ghost" id="btn-creator-cancel">Cancelar</button>
          <button class="btn btn-primary" id="btn-creator-save">💾 Guardar</button>
        </div>
      </div>`;
  },

  // ────────────────────────────────────────────
  // QUIZ
  // ────────────────────────────────────────────
  _quizForm(act, all) {
    const qs = act?.data?.questions || [this._newQ()];
    return `<div class="creator-form">
      ${this._titleField(act?.title || '', 'Ej: Quiz de Historia', act?.subject || '', act?.topic || '', all)}
      <div class="question-list" id="q-list">
        ${qs.map((q, i) => this._quizQCard(q, i)).join('')}
      </div>
      <button class="add-item-btn" id="btn-add-item">+ Agregar Pregunta</button>
    </div>${this._footer()}`;
  },

  _newQ() { return { id: App.uid(), text: '', options: ['', '', '', ''], correct: 0 }; },

  _quizQCard(q, i) {
    // Normalize correct to integer — Gemini sometimes returns it as a string (e.g. "2" instead of 2)
    const correctIdx = parseInt(q.correct ?? 0);
    return `
      <div class="question-card" data-id="${q.id}">
        <div class="question-number">${i + 1}</div>
        <button class="btn-icon question-card-actions" onclick="Creator._removeCard('${q.id}')">✕</button>
        <div class="question-card-content">
          <div class="form-group">
            <label class="form-label">Pregunta</label>
            <textarea class="form-textarea q-text" rows="2" placeholder="Escribe la pregunta...">${Creator._e(q.text)}</textarea>
          </div>
          ${this._imgPart(q.image)}
          <div class="form-group" style="margin-top:var(--sp-md)">
            <label class="form-label">Opciones <small style="text-transform:none;font-weight:400;color:var(--text-muted)">(marca la correcta)</small></label>
            <div class="options-grid">
              ${q.options.map((opt, oi) => `
                <div class="option-item ${correctIdx === oi ? 'correct' : ''}">
                  <input type="radio" class="option-radio" name="cor-${q.id}" value="${oi}" ${correctIdx === oi ? 'checked' : ''}>
                  <input type="text" class="option-input" placeholder="Opción ${oi + 1}" value="${Creator._e(opt)}">
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  },

  // ────────────────────────────────────────────
  // TRUE / FALSE
  // ────────────────────────────────────────────
  _tfForm(act, all) {
    const stmts = act?.data?.statements || [this._newStmt()];
    return `<div class="creator-form">
      ${this._titleField(act?.title || '', 'Ej: Verdadero o Falso: Geografía', act?.subject || '', act?.topic || '', all)}
      <div class="question-list" id="q-list">
        ${stmts.map((s, i) => this._tfCard(s, i)).join('')}
      </div>
      <button class="add-item-btn" id="btn-add-item">+ Agregar Afirmación</button>
    </div>${this._footer()}`;
  },

  _newStmt() { return { id: App.uid(), text: '', correct: true }; },

  _tfCard(s, i) {
    return `
      <div class="question-card" data-id="${s.id}">
        <div class="question-number">${i + 1}</div>
        <button class="btn-icon question-card-actions" onclick="Creator._removeCard('${s.id}')">✕</button>
        <div class="question-card-content">
          <div class="form-group">
            <label class="form-label">Afirmación</label>
            <textarea class="form-textarea q-text" rows="2" placeholder="Escribe la afirmación...">${Creator._e(s.text)}</textarea>
          </div>
          ${this._imgPart(s.image)}
          <div class="form-group" style="margin-top:var(--sp-md)">
            <label class="form-label">Respuesta Correcta</label>
            <div class="tf-toggle">
              <button type="button" class="tf-btn ${s.correct ? 'active-true' : ''}" onclick="Creator._tfPick(this, true)">✓ Verdadero</button>
              <button type="button" class="tf-btn ${!s.correct ? 'active-false' : ''}" onclick="Creator._tfPick(this, false)">✗ Falso</button>
            </div>
          </div>
        </div>
      </div>`;
  },

  _tfPick(btn, val) {
    const card = btn.closest('.question-card');
    card.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active-true', 'active-false'));
    btn.classList.add(val ? 'active-true' : 'active-false');
  },

  // ────────────────────────────────────────────
  // DRAG & DROP
  // ────────────────────────────────────────────
  _ddForm(act, all) {
    this._cats = [...(act?.data?.categories || ['Categoría A', 'Categoría B'])];
    const items = act?.data?.items || [this._newDDItem()];
    return `<div class="creator-form">
      ${this._titleField(act?.title || '', 'Ej: Clasifica los animales', act?.subject || '', act?.topic || '', all)}
      <div class="question-card categories-section">
        <label class="form-label">Categorías</label>
        <div class="category-chips" id="cat-chips">
          ${this._cats.map(c => this._catChip(c)).join('')}
        </div>
        <div class="add-category-row">
          <input type="text" class="form-input" id="new-cat-input" placeholder="Nueva categoría…">
          <button class="btn btn-secondary" id="btn-add-cat">+ Agregar</button>
        </div>
      </div>
      <div class="question-list" id="q-list">
        ${items.map((it, i) => this._ddItemCard(it, i, this._cats)).join('')}
      </div>
      <button class="add-item-btn" id="btn-add-item">+ Agregar Elemento</button>
    </div>${this._footer()}`;
  },

  _catChip(c) {
    return `<div class="category-chip" data-cat="${Creator._e(c)}">${Creator._e(c)}
      <button type="button" onclick="Creator._removeCat(this)">✕</button>
    </div>`;
  },

  _newDDItem(cat) { return { id: App.uid(), text: '', category: cat || '' }; },

  _ddItemCard(item, i, cats) {
    return `
      <div class="question-card" data-id="${item.id}">
        <div class="question-number">${i + 1}</div>
        <button class="btn-icon question-card-actions" onclick="Creator._removeCard('${item.id}')">✕</button>
        <div class="question-card-content">
          <div class="form-group">
            <label class="form-label">Elemento</label>
            <input type="text" class="form-input q-text" placeholder="Ej: Perro, Matemáticas…" value="${Creator._e(item.text)}">
          </div>
          ${this._imgPart(item.image)}
          <div class="form-group" style="margin-top:var(--sp-md)">
            <label class="form-label">Categoría Correcta</label>
            <select class="item-category-select">
              ${cats.map(c => `<option value="${Creator._e(c)}" ${item.category === c ? 'selected' : ''}>${Creator._e(c)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>`;
  },

  _removeCat(btn) {
    const chip = btn.closest('.category-chip');
    const cat  = chip.dataset.cat;
    this._cats = this._cats.filter(c => c !== cat);
    this._ddRefresh();
  },

  _addCat() {
    const inp = document.getElementById('new-cat-input');
    const val = inp.value.trim();
    if (!val) return;
    if (this._cats.includes(val)) { showToast('Esa categoría ya existe', 'error'); return; }
    this._cats.push(val);
    inp.value = '';
    this._ddRefresh();
  },

  async _ddRefresh() {
    const items = [...document.querySelectorAll('#q-list [data-id]')].map(card => ({
      id: card.dataset.id,
      text: card.querySelector('.q-text')?.value || '',
      category: card.querySelector('.item-category-select')?.value || '',
      image: card.querySelector('.item-img-tag')?.src || null
    }));
    const title = document.getElementById('act-title')?.value || '';
    const subject = document.getElementById('act-subject')?.value || '';
    const topic   = document.getElementById('act-topic')?.value || '';
    const all = await Storage.getActivities();
    document.getElementById('creator-content').innerHTML =
      this._ddForm({ title, subject, topic, data: { categories: this._cats, items } }, all);
    this._attachEvents('dragdrop');
  },

  // ────────────────────────────────────────────
  // MATCHING
  // ────────────────────────────────────────────
  _matchForm(act, all) {
    const pairs = act?.data?.pairs || [this._newPair()];
    return `<div class="creator-form">
      ${this._titleField(act?.title || '', 'Ej: Países y sus capitales', act?.subject || '', act?.topic || '', all)}
      <div class="question-list" id="q-list">
        ${pairs.map((p, i) => this._matchCard(p, i)).join('')}
      </div>
      <button class="add-item-btn" id="btn-add-item">+ Agregar Par</button>
    </div>${this._footer()}`;
  },

  _newPair() { return { id: App.uid(), left: '', right: '' }; },

  _matchCard(p, i) {
    return `
      <div class="question-card" data-id="${p.id}">
        <div class="question-number">${i + 1}</div>
        <button class="btn-icon question-card-actions" onclick="Creator._removeCard('${p.id}')">✕</button>
        <div class="question-card-content">
          <div class="pair-row">
            <div>
              <label class="form-label">Término</label>
              <input type="text" class="form-input pair-left" placeholder="Ej: Perro" value="${Creator._e(p.left)}">
              ${this._imgPart(p.image)}
            </div>
            <div class="pair-separator">↔</div>
            <div>
              <label class="form-label">Definición / Par</label>
              <input type="text" class="form-input pair-right" placeholder="Ej: Dog" value="${Creator._e(p.right)}">
            </div>
          </div>
        </div>
      </div>`;
  },

  // ────────────────────────────────────────────
  // MEMORY
  // ────────────────────────────────────────────
  _memForm(act, all) {
    const pairs = act?.data?.pairs || [this._newMemPair()];
    return `<div class="creator-form">
      ${this._titleField(act?.title || '', 'Ej: Vocabulario en inglés', act?.subject || '', act?.topic || '', all)}
      <div class="question-card" style="background:var(--bg-surface)">
        <p style="font-size:.85rem;color:var(--text-muted)">💡 Cada par genera dos cartas. El jugador debe encontrar los pares.</p>
      </div>
      <div class="question-list" id="q-list">
        ${pairs.map((p, i) => this._memCard(p, i)).join('')}
      </div>
      <button class="add-item-btn" id="btn-add-item">+ Agregar Par de Cartas</button>
    </div>${this._footer()}`;
  },

  _newMemPair() { return { id: App.uid(), front: '', back: '' }; },

  _memCard(p, i) {
    return `
      <div class="question-card" data-id="${p.id}">
        <div class="question-number">${i + 1}</div>
        <button class="btn-icon question-card-actions" onclick="Creator._removeCard('${p.id}')">✕</button>
        <div class="question-card-content">
          <div class="memory-pair-row">
            <div>
              <label class="form-label">Carta A</label>
              <input type="text" class="form-input pair-front" placeholder="Ej: Apple" value="${Creator._e(p.front)}">
              ${this._imgPart(p.image)}
            </div>
            <div class="pair-separator">⟷</div>
            <div>
              <label class="form-label">Carta B</label>
              <input type="text" class="form-input pair-back" placeholder="Ej: Manzana" value="${Creator._e(p.back)}">
            </div>
          </div>
        </div>
      </div>`;
  },

  // ────────────────────────────────────────────
  // IMAGE LABELING
  // ────────────────────────────────────────────
  _imgLabelForm(act, all) {
    Creator._imgData = act?.data?.images
      ? act.data.images.map(img => ({ id: img.id, src: img.src, zones: [...(img.zones || [])] }))
      : [];

    return `<div class="creator-form">
      ${this._titleField(act?.title || '', 'Ej: Músculos de la cara', act?.subject || '', act?.topic || '', all)}

      <div class="question-card">
        <label class="form-label">📍 Imágenes y Zonas de Etiquetado</label>
        <p style="color:var(--text-muted);font-size:.82rem;margin-bottom:var(--sp-md)">
          Sube una o más imágenes y <strong>haz clic sobre cada imagen</strong> para agregar zonas de etiquetado.
        </p>
        <div id="img-list"></div>
        <label class="img-upload-btn" for="img-file-input">
          📁 Agregar Imagen(es)
          <input type="file" id="img-file-input" accept="image/*" multiple style="display:none">
        </label>
      </div>

      <div class="question-card" id="word-bank-section">
        <label class="form-label">🔤 Banco de Palabras (auto-generado)</label>
        <p style="color:var(--text-muted);font-size:.82rem;margin-bottom:var(--sp-sm)">
          Se genera automáticamente con los nombres de todas las zonas.
        </p>
        <div id="word-bank-preview" class="word-bank-preview-chips">
          <em style="color:var(--text-muted);font-size:.82rem">Agrega zonas para ver el banco aquí</em>
        </div>
      </div>
    </div>${this._footer()}`;
  },

  /** Called in _attachEvents after rendering the image label form */
  _initImgList() {
    Creator._imgData.forEach(imgObj => this._appendImgCard(imgObj));
    this._updateWordBankPreview();

    document.getElementById('img-file-input')?.addEventListener('change', e => {
      Array.from(e.target.files).forEach(file => this._loadImgFile(file));
      e.target.value = '';
    });
  },

  _loadImgFile(file) {
    if (!file.type.startsWith('image/')) { showToast('Solo se permiten imágenes', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const imgObj = { id: App.uid(), src: ev.target.result, zones: [] };
      Creator._imgData.push(imgObj);
      this._appendImgCard(imgObj);
      this._updateWordBankPreview();
    };
    reader.readAsDataURL(file);
  },

  _appendImgCard(imgObj) {
    const list = document.getElementById('img-list');
    if (!list) return;

    const card = document.createElement('div');
    card.className = 'img-creator-card';
    card.dataset.imgId = imgObj.id;

    const idx = Creator._imgData.findIndex(i => i.id === imgObj.id);
    card.innerHTML = `
      <div class="img-card-header">
        <span class="img-card-num">🖼 Imagen ${idx + 1}</span>
        <button class="btn btn-sm btn-ghost" data-del-img="${imgObj.id}">🗑 Eliminar imagen</button>
      </div>
      <div class="img-creator-wrapper" data-img-id="${imgObj.id}">
        <img src="${imgObj.src}" class="img-creator-img" alt="Imagen" draggable="false">
      </div>
      <p class="img-click-hint">💡 Haz clic sobre la imagen para agregar zonas de etiquetado</p>`;

    list.appendChild(card);

    card.querySelector(`[data-del-img]`).addEventListener('click', () => this._removeImg(imgObj.id));

    const wrapper = card.querySelector('.img-creator-wrapper');
    this._renderZoneMarkers(imgObj.id, wrapper);
    this._attachImgClickEvent(imgObj.id, wrapper);
  },

  _attachImgClickEvent(imgId, wrapper) {
    wrapper.addEventListener('click', e => {
      if (e.target.closest('.creator-zone-pin') || e.target.closest('.zone-input-popup')) return;
      const imgEl = wrapper.querySelector('.img-creator-img');
      const rect  = imgEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;
      if (x < 0 || x > 100 || y < 0 || y > 100) return;
      this._showZoneInput(imgId, x, y, wrapper);
    });
  },

  _makePinDraggable(pin, imgId, zoneId, wrapper, propX = 'x', propY = 'y') {
    let dragging = false;
    let moved    = false;
    let startX, startY, origLeft, origTop;

    pin.addEventListener('mousedown', e => {
      if (e.target.closest('.zone-pin-del')) return; // let delete button work
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      moved    = false;
      startX   = e.clientX;
      startY   = e.clientY;
      
      if (propX === 'size') {
        const imgObj = Creator._imgData.find(i => i.id === imgId);
        const zone   = imgObj?.zones.find(z => z.id === zoneId);
        origLeft = zone ? zone.size : 10;
      } else {
        origLeft = parseFloat(pin.style.left);
        origTop  = parseFloat(pin.style.top);
      }
      
      pin.classList.add('dragging');
      document.body.style.userSelect = 'none';
    });

    const onMove = e => {
      if (!dragging) return;
      const imgEl = wrapper.querySelector('.img-creator-img');
      const rect  = imgEl.getBoundingClientRect();
      const dx = ((e.clientX - startX) / rect.width)  * 100;
      const dy = ((e.clientY - startY) / rect.height) * 100;
      
      const imgObj = Creator._imgData.find(i => i.id === imgId);
      const zone   = imgObj?.zones.find(z => z.id === zoneId);
      if (!zone) return;

      if (propX === 'size') {
        const newSize = Math.min(Math.max(origLeft + dx, 2), 50);
        zone.size = newSize;
        pin.style.left = (zone.x + newSize) + '%';
      } else {
        const newX = Math.min(Math.max(origLeft + dx, 0), 100);
        const newY = Math.min(Math.max(origTop  + dy, 0), 100);
        pin.style.left = newX + '%';
        pin.style.top  = newY + '%';
        zone[propX] = newX;
        zone[propY] = newY;
      }
      
      this._updateSVGLayer(imgId, wrapper);
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
    };

    const onUp = e => {
      if (!dragging) return;
      dragging = false;
      pin.classList.remove('dragging');
      document.body.style.userSelect = '';
      if (moved) {
        // Block the wrapper click so no new pin spawns
        e.stopPropagation();
        wrapper.addEventListener('click', ev => ev.stopPropagation(), { once: true, capture: true });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  },

  _updateSVGLayer(imgId, wrapper) {
    let svg = wrapper.querySelector('svg.creator-svg-layer');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'creator-svg-layer');
      wrapper.appendChild(svg);
    }
    const imgObj = Creator._imgData.find(i => i.id === imgId);
    if (!imgObj) return;

    let html = '';
    imgObj.zones.forEach(z => {
      const lx = z.labelX ?? z.x;
      const ly = z.labelY ?? z.y;
      
      if (z.type === 'arrow') {
        html += `<line x1="${lx}%" y1="${ly}%" x2="${z.x}%" y2="${z.y}%" stroke="var(--primary-light)" stroke-width="2" />`;
      } else if (z.type === 'circle') {
        const sz = z.size || 10;
        // SVG circle with % works based on diagonal of viewBox if we don't have one, but we can just use ellipse to be safe.
        // Actually, CSS width/height on an absolute div is easier for a perfect circle that scales with width.
        // Let's use ellipse so it stays exactly with the image's coordinate space.
        html += `<ellipse cx="${z.x}%" cy="${z.y}%" rx="${sz}%" ry="${sz * wrapper.clientWidth / wrapper.clientHeight}%" fill="rgba(124,58,237,0.2)" stroke="var(--primary)" stroke-width="2" />`;
        html += `<line x1="${lx}%" y1="${ly}%" x2="${z.x}%" y2="${z.y}%" stroke="var(--primary-light)" stroke-width="2" stroke-dasharray="4,4" />`;
      }
    });
    svg.innerHTML = html;
  },

  _renderZoneMarkers(imgId, wrapper) {
    wrapper.querySelectorAll('.creator-zone-pin, .creator-target-pin, .creator-resize-handle').forEach(el => el.remove());
    this._updateSVGLayer(imgId, wrapper);
    
    const imgObj = Creator._imgData.find(i => i.id === imgId);
    if (!imgObj) return;

    imgObj.zones.forEach(z => {
      const isExt = (z.type === 'arrow' || z.type === 'circle');
      const lx = isExt ? z.labelX : z.x;
      const ly = isExt ? z.labelY : z.y;

      // The label pin
      const pin = document.createElement('div');
      pin.className = 'creator-zone-pin draggable-pin';
      pin.dataset.zoneId = z.id;
      pin.style.left = lx + '%';
      pin.style.top  = ly + '%';
      pin.title = '↕ Arrastra para mover';
      pin.innerHTML  = `
        <span class="zone-pin-drag-handle">⠿</span>
        <span class="zone-pin-label">${Creator._e(z.label)}</span>
        <button class="zone-pin-del" title="Eliminar zona">✕</button>`;
      pin.querySelector('.zone-pin-del').addEventListener('click', ev => {
        ev.stopPropagation();
        this._removeZone(imgId, z.id);
      });
      wrapper.appendChild(pin);
      this._makePinDraggable(pin, imgId, z.id, wrapper, isExt ? 'labelX' : 'x', isExt ? 'labelY' : 'y');
      
      // Target pin for arrow
      if (z.type === 'arrow') {
        const targetPin = document.createElement('div');
        targetPin.className = 'creator-target-pin';
        targetPin.style.left = z.x + '%';
        targetPin.style.top  = z.y + '%';
        targetPin.title = '↕ Arrastra objetivo';
        wrapper.appendChild(targetPin);
        this._makePinDraggable(targetPin, imgId, z.id, wrapper, 'x', 'y');
      }
      
      // Center and resize handle for circle
      if (z.type === 'circle') {
        const centerPin = document.createElement('div');
        centerPin.className = 'creator-target-pin';
        centerPin.style.left = z.x + '%';
        centerPin.style.top  = z.y + '%';
        centerPin.title = '↕ Arrastra centro';
        wrapper.appendChild(centerPin);
        this._makePinDraggable(centerPin, imgId, z.id, wrapper, 'x', 'y');
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'creator-resize-handle';
        resizeHandle.style.left = (z.x + (z.size || 10)) + '%';
        resizeHandle.style.top  = z.y + '%';
        resizeHandle.title = '↔ Arrastra para redimensionar';
        wrapper.appendChild(resizeHandle);
        this._makePinDraggable(resizeHandle, imgId, z.id, wrapper, 'size', 'size');
      }
    });
  },

  _showZoneInput(imgId, x, y, wrapper) {
    wrapper.querySelector('.zone-input-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'zone-input-popup';
    popup.style.left = Math.min(x, 62) + '%';
    popup.style.top  = Math.min(y, 82) + '%';
    popup.innerHTML  = `
      <select class="zone-type-sel">
        <option value="pin">📍 Punto</option>
        <option value="arrow">↗️ Flecha</option>
        <option value="circle">⭕ Círculo</option>
      </select>
      <input type="text" class="zone-label-inp" placeholder="Nombre de la estructura…">
      <button class="zone-inp-ok" title="Confirmar">✓</button>
      <button class="zone-inp-x"  title="Cancelar">✕</button>`;

    wrapper.appendChild(popup);
    const inp = popup.querySelector('.zone-label-inp');
    const typeSel = popup.querySelector('.zone-type-sel');
    inp.focus();

    const confirm = () => {
      const label = inp.value.trim();
      const type = typeSel.value;
      popup.remove();
      if (!label) return;
      this._addZone(imgId, x, y, label, type, wrapper);
    };

    popup.querySelector('.zone-inp-ok').addEventListener('click', confirm);
    popup.querySelector('.zone-inp-x').addEventListener('click', () => popup.remove());
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') popup.remove();
    });
    inp.addEventListener('click', e => e.stopPropagation());
    typeSel.addEventListener('click', e => e.stopPropagation());
    popup.addEventListener('click', e => e.stopPropagation());
  },

  _addZone(imgId, x, y, label, type, wrapper) {
    const imgObj = Creator._imgData.find(i => i.id === imgId);
    if (!imgObj) return;
    const zone = { id: App.uid(), x, y, label, type: type || 'pin' };
    
    if (type === 'arrow' || type === 'circle') {
      // Place label on the side with more space so it stays visible
      zone.labelX = x > 60 ? Math.max(0, x - 18) : Math.min(100, x + 18);
      zone.labelY = y > 60 ? Math.max(0, y - 18) : Math.min(100, y + 18);
    }
    if (type === 'circle') {
      zone.size = 10;
    }
    
    imgObj.zones.push(zone);
    this._renderZoneMarkers(imgId, wrapper);
    this._updateWordBankPreview();
  },

  _removeZone(imgId, zoneId) {
    const imgObj = Creator._imgData.find(i => i.id === imgId);
    if (!imgObj) return;
    imgObj.zones = imgObj.zones.filter(z => z.id !== zoneId);
    const wrapper = document.querySelector(`.img-creator-wrapper[data-img-id="${imgId}"]`);
    if (wrapper) this._renderZoneMarkers(imgId, wrapper);
    this._updateWordBankPreview();
  },

  _removeImg(imgId) {
    Creator._imgData = Creator._imgData.filter(i => i.id !== imgId);
    document.querySelector(`.img-creator-card[data-img-id="${imgId}"]`)?.remove();
    this._updateWordBankPreview();
  },

  _updateWordBankPreview() {
    const preview = document.getElementById('word-bank-preview');
    if (!preview) return;
    const labels = Creator._imgData.flatMap(img => img.zones.map(z => z.label));
    preview.innerHTML = labels.length
      ? labels.map(l => `<span class="word-bank-preview-chip">${Creator._e(l)}</span>`).join('')
      : '<em style="color:var(--text-muted);font-size:.82rem">Agrega zonas para ver el banco aquí</em>';
  },

  // ────────────────────────────────────────────
  // SHARED card manipulation
  // ────────────────────────────────────────────
  _removeCard(id) {
    const list = document.getElementById('q-list');
    if (list.children.length <= 1) { showToast('Debe haber al menos un elemento', 'error'); return; }
    const card = list.querySelector(`[data-id="${id}"]`);
    if (card) { card.remove(); this._renumber(); }
  },

  _renumber() {
    document.querySelectorAll('#q-list .question-card').forEach((c, i) => {
      const n = c.querySelector('.question-number');
      if (n) n.textContent = i + 1;
    });
  },

  _addItem() {
    const list  = document.getElementById('q-list');
    const count = list.children.length;
    const div   = document.createElement('div');
    const type  = this.type;

    if (type === 'quiz') {
      div.innerHTML = this._quizQCard(this._newQ(), count);
      list.appendChild(div.firstElementChild);
      this._reattachRadios();
    } else if (type === 'truefalse') {
      div.innerHTML = this._tfCard(this._newStmt(), count);
      list.appendChild(div.firstElementChild);
    } else if (type === 'dragdrop') {
      div.innerHTML = this._ddItemCard(this._newDDItem(this._cats[0]), count, this._cats);
      list.appendChild(div.firstElementChild);
    } else if (type === 'matching') {
      div.innerHTML = this._matchCard(this._newPair(), count);
      list.appendChild(div.firstElementChild);
    } else if (type === 'memory') {
      div.innerHTML = this._memCard(this._newMemPair(), count);
      list.appendChild(div.firstElementChild);
    }

    list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  _reattachRadios() {
    document.querySelectorAll('.option-radio').forEach(r => {
      r.onchange = () => {
        const card = r.closest('.question-card');
        card.querySelectorAll('.option-item').forEach(i => i.classList.remove('correct'));
        r.closest('.option-item').classList.add('correct');
      };
    });
  },

  // ────────────────────────────────────────────
  // Event binding
  // ────────────────────────────────────────────
  _attachEvents(type) {
    document.getElementById('btn-add-item')?.addEventListener('click', () => this._addItem());
    document.getElementById('btn-creator-save')?.addEventListener('click', () => this._save());
    document.getElementById('btn-creator-cancel')?.addEventListener('click', () => App.goHome());

    if (type === 'dragdrop') {
      document.getElementById('btn-add-cat')?.addEventListener('click', () => this._addCat());
      document.getElementById('new-cat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this._addCat(); }
      });
    }

    if (type === 'quiz') this._reattachRadios();

    if (type === 'imagelabel') this._initImgList();
  },

  // ────────────────────────────────────────────
  // Save / Collect
  // ────────────────────────────────────────────
  _save() {
    const title   = document.getElementById('act-title')?.value?.trim();
    const subject = document.getElementById('act-subject')?.value?.trim() || '';
    const topic   = document.getElementById('act-topic')?.value?.trim() || '';

    if (!title) { showToast('El título es obligatorio', 'error'); return; }

    let data;
    try { data = this._collect(); }
    catch (e) { showToast(e.message, 'error'); return; }

    const existing = App.editingActivityId ? Storage.getActivity(App.editingActivityId) : null;
    const activity = {
      id:        App.editingActivityId || App.uid(),
      type:      this.type,
      title,
      subject,
      topic,
      createdAt: existing?.createdAt || Date.now(),
      data,
    };

    if (App.editingActivityId) Storage.updateActivity(activity);
    else                       Storage.addActivity(activity);

    // Auto-descarga del archivo JSON
    const blob = new Blob([JSON.stringify(activity, null, 2)], { type: 'application/json' });
    const filename = (activity.title || 'actividad').replace(/[^a-z0-9áéíóúüñ\s]/gi,'').replace(/\s+/g,'_').slice(0,40) + '.bellestudia.json';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(App.editingActivityId ? 'Actividad guardada y descargada ✅' : 'Actividad creada y descargada ✅', 'success');
    App.editingActivityId = null;
    App.goHome();
  },

  _collect() {
    const t = this.type;
    if (t === 'quiz')       return this._collectQuiz();
    if (t === 'truefalse')  return this._collectTF();
    if (t === 'dragdrop')   return this._collectDD();
    if (t === 'matching')   return this._collectMatch();
    if (t === 'memory')     return this._collectMem();
    if (t === 'imagelabel') return this._collectImgLabel();
    throw new Error('Tipo desconocido');
  },

  _collectQuiz() {
    const cards = [...document.querySelectorAll('#q-list [data-id]')];
    if (!cards.length) throw new Error('Agrega al menos una pregunta');
    const questions = cards.map((c, i) => {
      const text = c.querySelector('.q-text')?.value?.trim();
      if (!text) throw new Error(`La pregunta ${i + 1} está vacía`);
      const opts = [...c.querySelectorAll('.option-input')].map(inp => inp.value.trim());
      if (opts.some(o => !o)) throw new Error(`Completa todas las opciones de la pregunta ${i + 1}`);
      const chk = c.querySelector('.option-radio:checked');
      const image = c.querySelector('.item-img-tag')?.src || null;
      return { id: App.uid(), text, options: opts, correct: chk ? parseInt(chk.value) : 0, image };
    });
    return { questions };
  },

  _collectTF() {
    const cards = [...document.querySelectorAll('#q-list [data-id]')];
    if (!cards.length) throw new Error('Agrega al menos una afirmación');
    const statements = cards.map((c, i) => {
      const text = c.querySelector('.q-text')?.value?.trim();
      if (!text) throw new Error(`La afirmación ${i + 1} está vacía`);
      const active = c.querySelector('.tf-btn.active-true,.tf-btn.active-false');
      const image = c.querySelector('.item-img-tag')?.src || null;
      return { id: App.uid(), text, correct: active ? active.classList.contains('active-true') : true, image };
    });
    return { statements };
  },

  _collectDD() {
    if (!this._cats || this._cats.length < 2) throw new Error('Necesitas al menos 2 categorías');
    const cards = [...document.querySelectorAll('#q-list [data-id]')];
    if (!cards.length) throw new Error('Agrega al menos un elemento');
    const items = cards.map((c, i) => {
      const text = c.querySelector('.q-text')?.value?.trim();
      if (!text) throw new Error(`El elemento ${i + 1} está vacío`);
      const category = c.querySelector('.item-category-select')?.value;
      const image = c.querySelector('.item-img-tag')?.src || null;
      return { id: App.uid(), text, category, image };
    });
    return { categories: [...this._cats], items };
  },

  _collectMatch() {
    const cards = [...document.querySelectorAll('#q-list [data-id]')];
    if (cards.length < 2) throw new Error('Agrega al menos 2 pares');
    const pairs = cards.map((c, i) => {
      const left  = c.querySelector('.pair-left')?.value?.trim();
      const right = c.querySelector('.pair-right')?.value?.trim();
      const image = c.querySelector('.item-img-tag')?.src || null;
      if (!left || !right) throw new Error(`El par ${i + 1} está incompleto`);
      return { id: App.uid(), left, right, image };
    });
    return { pairs };
  },

  _collectMem() {
    const cards = [...document.querySelectorAll('#q-list [data-id]')];
    if (cards.length < 2) throw new Error('Agrega al menos 2 pares de cartas');
    const pairs = cards.map((c, i) => {
      const front = c.querySelector('.pair-front')?.value?.trim();
      const back  = c.querySelector('.pair-back')?.value?.trim();
      const image = c.querySelector('.item-img-tag')?.src || null;
      if (!front || !back) throw new Error(`El par ${i + 1} está incompleto`);
      return { id: App.uid(), front, back, image };
    });
    return { pairs };
  },

  _collectImgLabel() {
    if (!Creator._imgData.length) throw new Error('Agrega al menos una imagen');
    const totalZones = Creator._imgData.reduce((s, img) => s + img.zones.length, 0);
    if (totalZones === 0) throw new Error('Agrega zonas de etiquetado en al menos una imagen');
    return {
      images: Creator._imgData.map(img => ({
        id:    img.id,
        src:   img.src,
        zones: img.zones,
      }))
    };
  },

  // ── Utility ─────────────────────────────────
  _e(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
