/**
 * EduPlay - Image Label Activity Engine
 * Multiple images + shared word bank
 * Tap-to-place (mobile friendly) + Drag & Drop (desktop)
 */
const ImageLabelActivity = {
  activity:   null,
  _bank:      [],    // [{id, label, zoneId}] shuffled
  _answers:   {},    // { zoneId: bankEntryId }
  _sel:       null,  // selected bank entry id
  _imgIdx:    0,
  _submitted: false,
  _ghost:     null,

  start(act) {
    this.activity   = act;
    this._imgIdx    = 0;
    this._submitted = false;
    this._sel       = null;
    this._answers   = {};
    if (this._ghost) { this._ghost.remove(); this._ghost = null; }
    this._bank = this._buildBank();
    this.render();
  },

  _buildBank() {
    const entries = this.activity.data.images.flatMap(img =>
      img.zones.map(z => ({ id: z.id + '_bw', label: z.label, zoneId: z.id }))
    );
    return this._shuffle([...entries]);
  },

  _shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  render() {
    const container = document.getElementById('player-content');
    const images = this.activity.data.images;
    const img  = images[this._imgIdx];
    const total = images.length;

    const placed   = new Set(Object.values(this._answers));
    const available = this._bank.filter(e => !placed.has(e.id));

    // Count total correct/total for progress
    const allZones = images.flatMap(i => i.zones);
    const totalZones = allZones.length;
    const filledCount = Object.keys(this._answers).length;

    container.innerHTML = `
      <div class="img-label-player">

        ${total > 1 ? `
        <div class="img-nav-bar">
          <button class="btn btn-ghost btn-sm" id="btn-img-prev" ${this._imgIdx === 0 ? 'disabled' : ''}>← Anterior</button>
          <span class="img-counter">Imagen ${this._imgIdx + 1} / ${total}</span>
          <button class="btn btn-ghost btn-sm" id="btn-img-next" ${this._imgIdx === total - 1 ? 'disabled' : ''}>Siguiente →</button>
        </div>` : ''}

        ${total > 1 ? `
        <div class="progress-container" style="margin-bottom:0">
          <div class="progress-header">
            <span>Zonas rellenadas</span>
            <span>${filledCount} / ${totalZones}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(filledCount/totalZones*100)}%"></div></div>
        </div>` : ''}

        <div class="img-label-wrapper" id="img-wrapper">
          <img src="${img.src}" class="img-label-img" id="img-label-img"
            alt="Imagen de actividad" draggable="false">

          ${img.zones.map(z => {
            const entry = this._bank.find(e => this._answers[z.id] === e.id);
            const placedLabel = entry?.label;
            const cls = this._submitted
              ? (placedLabel === z.label ? 'correct' : 'incorrect')
              : (placedLabel ? 'filled' : (this._sel ? 'drop-target' : ''));
            return `
              <div class="img-label-zone ${cls}" data-zone-id="${z.id}"
                style="left:${z.x}%;top:${z.y}%">
                ${placedLabel
                  ? `<span class="zone-word-text">${App.esc(placedLabel)}</span>
                     ${this._submitted && placedLabel !== z.label
                       ? `<div class="zone-answer-key">✓ ${App.esc(z.label)}</div>` : ''}`
                  : '<span class="zone-empty-ph">_ _ _</span>'}
              </div>`;
          }).join('')}
        </div>

        <div class="word-bank-panel">
          <div class="word-bank-title" id="wbank-title">
            PALABRAS
            ${this._sel ? '— <span style="color:var(--primary-light);font-weight:400">toca una zona para colocar</span>' : ''}
          </div>
          <div class="word-bank-chips" id="word-chips">
            ${available.map(e => `
              <div class="word-chip ${this._sel === e.id ? 'selected' : ''}"
                data-entry-id="${e.id}" data-label="${App.esc(e.label)}">${App.esc(e.label)}</div>
            `).join('')}
            ${!available.length && !this._submitted
              ? '<span style="color:var(--text-muted);font-size:.85rem">✓ Todas las palabras han sido colocadas</span>'
              : ''}
          </div>
        </div>

        <div class="img-label-actions">
          <button class="btn btn-ghost" id="btn-lbl-reset">🔄 Reiniciar</button>
          <button class="btn btn-primary" id="btn-lbl-check">✓ Verificar respuestas</button>
        </div>
      </div>`;

    this._bindEvents();
  },

  _bindEvents() {
    // ── Navigation ──
    document.getElementById('btn-img-prev')?.addEventListener('click', () => {
      this._imgIdx = Math.max(0, this._imgIdx - 1);
      this._sel = null;
      this.render();
    });
    document.getElementById('btn-img-next')?.addEventListener('click', () => {
      this._imgIdx = Math.min(this.activity.data.images.length - 1, this._imgIdx + 1);
      this._sel = null;
      this.render();
    });

    // ── Tap to select word chip ──
    document.querySelectorAll('.word-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (this._submitted) return;
        const id = chip.dataset.entryId;
        this._sel = (this._sel === id) ? null : id;
        this._updateSelectionUI();
      });
      // Drag support
      chip.addEventListener('pointerdown', e => this._startChipDrag(e, chip), { passive: false });
    });

    // ── Tap zone: place or remove ──
    document.querySelectorAll('.img-label-zone').forEach(zone => {
      zone.addEventListener('click', e => {
        if (this._submitted) return;
        e.stopPropagation();
        const zid = zone.dataset.zoneId;
        const existingId = this._answers[zid];
        if (existingId) {
          // Return word to bank
          delete this._answers[zid];
          this._sel = null;
          this.render();
        } else if (this._sel) {
          this._answers[zid] = this._sel;
          this._sel = null;
          this.render();
        }
      });
    });

    // ── Click empty area = deselect ──
    document.getElementById('img-wrapper')?.addEventListener('click', () => {
      if (this._sel) { this._sel = null; this._updateSelectionUI(); }
    });

    // ── Buttons ──
    document.getElementById('btn-lbl-reset')?.addEventListener('click', () => {
      this._answers = {};
      this._sel = null;
      this._submitted = false;
      this.render();
    });
    document.getElementById('btn-lbl-check')?.addEventListener('click', () => this._submit());
  },

  _updateSelectionUI() {
    document.querySelectorAll('.word-chip').forEach(ch => {
      ch.classList.toggle('selected', ch.dataset.entryId === this._sel);
    });
    document.querySelectorAll('.img-label-zone:not(.filled):not(.correct):not(.incorrect)').forEach(z => {
      z.classList.toggle('drop-target', !!this._sel);
    });
    const title = document.getElementById('wbank-title');
    if (title) {
      title.innerHTML = 'PALABRAS' + (this._sel
        ? ' — <span style="color:var(--primary-light);font-weight:400">toca una zona de la imagen</span>'
        : '');
    }
  },

  // ── Drag & Drop ──────────────────────────────
  _startChipDrag(e, chip) {
    if (this._submitted) return;
    e.preventDefault();

    const entryId = chip.dataset.entryId;
    const label   = chip.dataset.label;
    chip.setPointerCapture(e.pointerId);

    const ghost = document.createElement('div');
    ghost.className = 'word-chip drag-ghost';
    ghost.textContent = label;
    document.body.appendChild(ghost);
    this._ghost = ghost;

    const ox = e.clientX - chip.getBoundingClientRect().left;
    const oy = e.clientY - chip.getBoundingClientRect().top;

    const _move = mv => {
      mv.preventDefault();
      if (this._ghost) {
        this._ghost.style.left = (mv.clientX - ox) + 'px';
        this._ghost.style.top  = (mv.clientY - oy) + 'px';
      }
      this._highlightZoneUnder(mv.clientX, mv.clientY);
    };

    const _up = up => {
      if (this._ghost) { this._ghost.remove(); this._ghost = null; }
      this._dropOnZone(up.clientX, up.clientY, entryId);
      chip.removeEventListener('pointermove', _move);
      chip.removeEventListener('pointerup', _up);
    };

    chip.addEventListener('pointermove', _move, { passive: false });
    chip.addEventListener('pointerup', _up);
  },

  _highlightZoneUnder(cx, cy) {
    document.querySelectorAll('.img-label-zone').forEach(z => {
      const r = z.getBoundingClientRect();
      const over = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
      z.classList.toggle('drag-over', over);
    });
  },

  _dropOnZone(cx, cy, entryId) {
    let dropped = false;
    document.querySelectorAll('.img-label-zone').forEach(z => {
      z.classList.remove('drag-over');
      const r = z.getBoundingClientRect();
      if (!dropped && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        const zid = z.dataset.zoneId;
        if (!this._answers[zid]) {
          this._answers[zid] = entryId;
          this._sel = null;
          dropped = true;
        }
      }
    });
    if (dropped) this.render();
  },

  // ── Submit ───────────────────────────────────
  _submit() {
    const allZones = this.activity.data.images.flatMap(img => img.zones);
    const unplaced = allZones.filter(z => !this._answers[z.id]);
    if (unplaced.length > 0) {
      showToast(`Faltan ${unplaced.length} zona(s) por rellenar`, 'error');
      return;
    }
    this._submitted = true;
    const correct = allZones.filter(z => {
      const e = this._bank.find(b => b.id === this._answers[z.id]);
      return e?.label === z.label;
    }).length;
    this.render();
    setTimeout(() => this._renderScore(correct, allZones.length), 1500);
  },

  _renderScore(correct, total) {
    const pct = Math.round((correct / total) * 100);
    const { emoji, msg } = scoreMessage(pct);
    const container = document.getElementById('player-content');
    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${pct}%</div>
        <div class="score-label">${correct} de ${total} etiquetas correctas</div>
        <div class="score-message">${msg}</div>
        <div class="score-actions">
          <button class="btn btn-secondary" id="btn-retry-lbl">🔄 Reintentar</button>
          <button class="btn btn-primary"   id="btn-home-lbl">🏠 Inicio</button>
        </div>
      </div>`;
    document.getElementById('btn-retry-lbl')?.addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-home-lbl')?.addEventListener('click', () => App.goHome());
  }
};
