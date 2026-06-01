/**
 * EduPlay - Image Match Activity Engine
 * Multiple images + separate name and definition banks
 * Tap-to-place (mobile friendly) + Drag & Drop (Pointer Events for desktop)
 */
const ImageMatchActivity = {
  activity: null,
  _answers: {},       // { itemId: { name: chipId, desc: chipId } }
  _shuffledNames: [], // [{ id, text }]
  _shuffledDescs: [], // [{ id, text }]
  _sel: null,         // { id, type: 'name'|'desc', text }
  _submitted: false,
  _ghost: null,

  start(act) {
    this.activity = act;
    this._answers = {};
    this._sel = null;
    this._submitted = false;
    if (this._ghost) { this._ghost.remove(); this._ghost = null; }

    const items = act.data.items || [];
    items.forEach(it => {
      this._answers[it.id] = { name: null, desc: null };
    });

    // Construir bancos de chips
    const names = items.map(it => ({ id: it.id + '_name', text: it.name, itemId: it.id }));
    const descs = items.map(it => ({ id: it.id + '_desc', text: it.definition, itemId: it.id }));

    this._shuffledNames = this._shuffle([...names]);
    this._shuffledDescs = this._shuffle([...descs]);

    this.render();
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  render() {
    const container = document.getElementById('player-content');
    if (!container) return;

    const items = this.activity.data.items || [];

    // Encontrar qué chips ya han sido colocados
    const placedNameIds = new Set();
    const placedDescIds = new Set();
    Object.values(this._answers).forEach(ans => {
      if (ans.name) placedNameIds.add(ans.name);
      if (ans.desc) placedDescIds.add(ans.desc);
    });

    // Filtrar disponibles en los bancos
    const availNames = this._shuffledNames.filter(n => !placedNameIds.has(n.id));
    const availDescs = this._shuffledDescs.filter(d => !placedDescIds.has(d.id));

    // Renderizar las tarjetas
    const cardsHtml = items.map(it => {
      const ans = this._answers[it.id] || { name: null, desc: null };
      
      const placedNameChip = ans.name ? this._shuffledNames.find(n => n.id === ans.name) : null;
      const placedDescChip = ans.desc ? this._shuffledDescs.find(d => d.id === ans.desc) : null;

      const hasName = !!placedNameChip;
      const hasDesc = !!placedDescChip;

      // Clases para feedback de corrección
      let nameCls = '';
      let descCls = '';
      if (this._submitted) {
        const isNameCorrect = placedNameChip && placedNameChip.itemId === it.id;
        const isDescCorrect = placedDescChip && placedDescChip.itemId === it.id;
        nameCls = isNameCorrect ? 'correct' : 'incorrect';
        descCls = isDescCorrect ? 'correct' : 'incorrect';
      } else {
        nameCls = hasName ? 'filled' : (this._sel?.type === 'name' ? 'selected' : '');
        descCls = hasDesc ? 'filled' : (this._sel?.type === 'desc' ? 'selected' : '');
      }

      return `
        <div class="imagematch-card" data-item-id="${it.id}">
          <div class="imagematch-img-container">
            <img src="${it.image}" alt="Ficha interactiva" draggable="false">
          </div>
          <div class="imagematch-slots">
            <div class="imagematch-slot slot-type-name ${nameCls}" data-item-id="${it.id}" data-slot-type="name">
              ${placedNameChip 
                ? `<span>${App.esc(placedNameChip.text)}</span>` 
                : `<span class="zone-empty-ph">[ Nombre ]</span>`}
              ${this._submitted && placedNameChip && placedNameChip.itemId !== it.id 
                ? `<div class="imagematch-slot-key">✓ Correcto: ${App.esc(it.name)}</div>` 
                : ''}
            </div>
            <div class="imagematch-slot slot-type-desc ${descCls}" data-item-id="${it.id}" data-slot-type="desc">
              ${placedDescChip 
                ? `<span>${App.esc(placedDescChip.text)}</span>` 
                : `<span class="zone-empty-ph">[ Definición ]</span>`}
              ${this._submitted && placedDescChip && placedDescChip.itemId !== it.id 
                ? `<div class="imagematch-slot-key">✓ Correcto: ${App.esc(it.definition)}</div>` 
                : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="imagematch-player">
        <div class="imagematch-layout">
          <div class="imagematch-workspace">
            ${cardsHtml}
          </div>

          <div class="imagematch-sidebar">
            <div class="imagematch-banks">
              <!-- Banco de Nombres -->
              <div class="imagematch-bank">
                <div class="imagematch-bank-title">
                  <span>📌 Nombres</span>
                  ${this._sel?.type === 'name' ? '<span style="font-size:0.7rem; color:var(--primary-light); font-weight:normal;">Toca un espacio [ Nombre ]</span>' : ''}
                </div>
                <div class="imagematch-bank-chips" id="bank-names">
                  ${availNames.map(n => `
                    <div class="word-chip chip-type-name ${this._sel?.id === n.id ? 'selected' : ''}" 
                         data-chip-id="${n.id}" data-chip-type="name">${App.esc(n.text)}</div>
                  `).join('')}
                  ${!availNames.length && !this._submitted 
                    ? '<span style="color:var(--text-muted); font-size:0.8rem;">✓ Nombres colocados</span>' 
                    : ''}
                </div>
              </div>

              <!-- Banco de Definiciones -->
              <div class="imagematch-bank">
                <div class="imagematch-bank-title">
                  <span>📝 Definiciones</span>
                  ${this._sel?.type === 'desc' ? '<span style="font-size:0.7rem; color:var(--secondary); font-weight:normal;">Toca un espacio [ Definición ]</span>' : ''}
                </div>
                <div class="imagematch-bank-chips" id="bank-descs">
                  ${availDescs.map(d => `
                    <div class="word-chip chip-type-desc ${this._sel?.id === d.id ? 'selected' : ''}" 
                         data-chip-id="${d.id}" data-chip-type="desc">${App.esc(d.text)}</div>
                  `).join('')}
                  ${!availDescs.length && !this._submitted 
                    ? '<span style="color:var(--text-muted); font-size:0.8rem;">✓ Definiciones colocadas</span>' 
                    : ''}
                </div>
              </div>
            </div>

            <div class="img-label-actions imagematch-sidebar-actions">
              <button class="btn btn-ghost" id="btn-im-reset">🔄 Reiniciar</button>
              ${this._submitted 
                ? `<button class="btn btn-primary" id="btn-im-view-score">Ver Puntuación →</button>`
                : `<button class="btn btn-primary" id="btn-im-check">✓ Comprobar Respuestas</button>`}
            </div>
          </div>
        </div>
      </div>`;

    this._bindEvents();
  },

  _bindEvents() {
    // ── Tap to select chip ──
    document.querySelectorAll('.word-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (this._submitted) return;
        const id = chip.dataset.chipId;
        const type = chip.dataset.chipType;
        const text = chip.textContent;

        if (this._sel?.id === id) {
          this._sel = null;
        } else {
          this._sel = { id, type, text };
        }
        this.render();
      });

      // Pointer event para arrastrar
      chip.addEventListener('pointerdown', e => this._startDrag(e, chip), { passive: false });
    });

    // ── Tap slot to place/remove ──
    document.querySelectorAll('.imagematch-slot').forEach(slot => {
      slot.addEventListener('click', e => {
        if (this._submitted) return;
        e.stopPropagation();

        const itemId = slot.dataset.itemId;
        const slotType = slot.dataset.slotType; // 'name' | 'desc'
        const existingId = this._answers[itemId][slotType];

        if (existingId) {
          // Si ya hay un elemento, lo quitamos y devolvemos al banco
          this._answers[itemId][slotType] = null;
          this._sel = null;
          App.playSound('pop');
          this.render();
        } else if (this._sel && this._sel.type === slotType) {
          // Si hay uno seleccionado y corresponde al tipo de slot, lo colocamos
          this._answers[itemId][slotType] = this._sel.id;
          this._sel = null;
          App.playSound('pop');
          this.render();
        }
      });
    });

    // Reiniciar y verificar botones
    document.getElementById('btn-im-reset')?.addEventListener('click', () => {
      const items = this.activity.data.items || [];
      items.forEach(it => {
        this._answers[it.id] = { name: null, desc: null };
      });
      this._sel = null;
      this._submitted = false;
      this.render();
    });

    document.getElementById('btn-im-check')?.addEventListener('click', () => this._submitAnswers());
    document.getElementById('btn-im-view-score')?.addEventListener('click', () => {
      this._renderScore();
    });
  },

  // ── Drag and Drop Logic (Pointer Events) ──
  _startDrag(e, chip) {
    if (this._submitted) return;
    e.preventDefault();

    const chipId = chip.dataset.chipId;
    const type = chip.dataset.chipType;
    chip.setPointerCapture(e.pointerId);

    // Crear fantasma
    const ghost = chip.cloneNode(true);
    ghost.className = `word-chip drag-ghost ${type === 'name' ? 'chip-type-name' : 'chip-type-desc'}`;
    ghost.style.width = chip.offsetWidth + 'px';
    document.body.appendChild(ghost);
    this._ghost = ghost;

    const rect = chip.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    this._moveGhost(e.clientX, e.clientY, ox, oy);

    const onMove = mv => {
      mv.preventDefault();
      this._moveGhost(mv.clientX, mv.clientY, ox, oy);
      this._highlightSlotUnder(mv.clientX, mv.clientY, type);
    };

    const onUp = up => {
      if (this._ghost) { this._ghost.remove(); this._ghost = null; }
      this._dropOnSlot(up.clientX, up.clientY, chipId, type);
      chip.removeEventListener('pointermove', onMove);
      chip.removeEventListener('pointerup', onUp);
    };

    chip.addEventListener('pointermove', onMove, { passive: false });
    chip.addEventListener('pointerup', onUp);
  },

  _moveGhost(cx, cy, ox, oy) {
    if (!this._ghost) return;
    this._ghost.style.left = (cx - ox) + 'px';
    this._ghost.style.top = (cy - oy) + 'px';
  },

  _highlightSlotUnder(cx, cy, type) {
    document.querySelectorAll(`.imagematch-slot[data-slot-type="${type}"]`).forEach(slot => {
      const r = slot.getBoundingClientRect();
      const over = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
      slot.classList.toggle('drag-over', over);
    });
  },

  _dropOnSlot(cx, cy, chipId, type) {
    let dropped = false;
    document.querySelectorAll(`.imagematch-slot[data-slot-type="${type}"]`).forEach(slot => {
      slot.classList.remove('drag-over');
      const r = slot.getBoundingClientRect();
      if (!dropped && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        const itemId = slot.dataset.itemId;
        // Solo colocar si el slot está vacío
        if (!this._answers[itemId][type]) {
          this._answers[itemId][type] = chipId;
          this._sel = null;
          App.playSound('pop');
          dropped = true;
        }
      }
    });
    if (dropped) this.render();
  },

  // ── Submit & Score Screen ──
  _submitAnswers() {
    const items = this.activity.data.items || [];
    let unplacedCount = 0;
    
    items.forEach(it => {
      const ans = this._answers[it.id];
      if (!ans.name || !ans.desc) unplacedCount++;
    });

    if (unplacedCount > 0) {
      showToast(`Quedan ${unplacedCount} espacio(s) por rellenar`, 'error');
      return;
    }

    this._submitted = true;

    // Calcular puntaje
    let totalPoints = items.length * 2; // 2 puntos por tarjeta (Nombre y Definición)
    let correctPoints = 0;

    items.forEach(it => {
      const ans = this._answers[it.id];
      const nameChip = this._shuffledNames.find(n => n.id === ans.name);
      const descChip = this._shuffledDescs.find(d => d.id === ans.desc);

      if (nameChip && nameChip.itemId === it.id) correctPoints++;
      if (descChip && descChip.itemId === it.id) correctPoints++;
    });

    this._finalCorrect = correctPoints;
    this._finalTotal = totalPoints;

    if (correctPoints === totalPoints) {
      App.playSound('win');
    } else {
      App.playSound('pop');
    }

    this.render();
  },

  _renderScore() {
    const pct = Math.round((this._finalCorrect / this._finalTotal) * 100);
    const { emoji, msg } = scoreMessage(pct);
    const container = document.getElementById('player-content');

    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${pct}%</div>
        <div class="score-label">${this._finalCorrect} de ${this._finalTotal} respuestas correctas</div>
        <div class="score-message">${msg}</div>
        <div class="score-actions">
          <button class="btn btn-secondary" id="btn-im-retry">🔄 Reintentar</button>
          <button class="btn btn-ghost"     id="btn-im-review">👁️ Revisar Respuestas</button>
          <button class="btn btn-primary"   id="btn-im-home">🏠 Inicio</button>
        </div>
      </div>`;

    document.getElementById('btn-im-retry').addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-im-review').addEventListener('click', () => this.render());
    document.getElementById('btn-im-home').addEventListener('click', () => App.goHome());
  }
};
