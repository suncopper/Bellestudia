/**
 * EduPlay - Drag & Drop Activity Engine
 * Uses Pointer Events API for unified mouse + touch support
 */
const DragDropActivity = {
  activity: null,
  userAnswers: {},   // { itemId: categoryName }
  shuffledItems: [],
  ghost: null,
  draggingId: null,
  submitted: false,

  start(activity) {
    this.activity = activity;
    this.userAnswers = {};
    this.ghost = null;
    this.draggingId = null;
    this.submitted = false;
    this.shuffledItems = this._shuffle([...activity.data.items]);
    this.render();
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  _zid(cat) { return 'z_' + cat.replace(/[^a-zA-Z0-9]/g, '_'); },

  render() {
    const { categories, items } = this.activity.data;
    const container = document.getElementById('player-content');
    const unplaced = this.shuffledItems.filter(it => !this.userAnswers[it.id]);

    container.innerHTML = `
      <div class="dragdrop-workspace">
        <div class="drag-items-pool">
          <h3>🖐 Arrastra los elementos a su categoría correcta</h3>
          <div class="drag-items-container" id="pool" data-zone="__pool__">
            ${unplaced.map(it => this._itemHtml(it)).join('')}
          </div>
        </div>

        <div class="drop-zones" id="drop-zones">
          ${categories.map(cat => `
            <div class="drop-zone" id="${this._zid(cat)}" data-zone="${App.esc(cat)}">
              <h3>${App.esc(cat)}</h3>
              <div class="drop-zone-items">
                ${this.shuffledItems.filter(it => this.userAnswers[it.id] === cat)
                    .map(it => this._itemHtml(it)).join('')}
              </div>
            </div>`).join('')}
        </div>

        <div class="dragdrop-actions">
          <button class="btn btn-ghost" id="btn-dd-reset">🔄 Reiniciar</button>
          <button class="btn btn-primary" id="btn-dd-check">✓ Comprobar</button>
        </div>
      </div>`;

    document.getElementById('btn-dd-reset').addEventListener('click', () => this.reset());
    document.getElementById('btn-dd-check').addEventListener('click', () => this.submit());
    this._attachDragEvents();
  },

  _itemHtml(item) {
    const imgHtml = item.image ? `<img src="${item.image}" style="max-height:60px; max-width:100%; display:block; margin:0 auto 0.2rem; border-radius:4px; pointer-events:none;">` : '';
    return `<div class="drag-item" data-item-id="${item.id}" id="drag-${item.id}" touch-action="none">${imgHtml}${App.esc(item.text)}</div>`;
  },

  _attachDragEvents() {
    document.querySelectorAll('.drag-item').forEach(el => {
      el.addEventListener('pointerdown', e => this._startDrag(e, el), { passive: false });
    });
  },

  _startDrag(e, el) {
    if (this.submitted) return;
    e.preventDefault();

    const itemId = el.dataset.itemId;
    this.draggingId = itemId;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);

    // Ghost element
    const ghost = el.cloneNode(true);
    ghost.className = 'drag-item drag-ghost';
    ghost.style.width = el.offsetWidth + 'px';
    document.body.appendChild(ghost);
    this.ghost = ghost;

    const rect = el.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    this._moveGhost(e.clientX, e.clientY, ox, oy);

    const onMove = mv => {
      mv.preventDefault();
      this._moveGhost(mv.clientX, mv.clientY, ox, oy);
      this._highlightZone(mv.clientX, mv.clientY);
    };

    const onUp = up => {
      this._endDrag(up.clientX, up.clientY, itemId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };

    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
  },

  _moveGhost(cx, cy, ox, oy) {
    if (!this.ghost) return;
    this.ghost.style.left = (cx - ox) + 'px';
    this.ghost.style.top  = (cy - oy) + 'px';
  },

  _highlightZone(cx, cy) {
    document.querySelectorAll('.drop-zone, #pool').forEach(zone => {
      zone.classList.remove('drag-over');
      const r = zone.getBoundingClientRect();
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom)
        zone.classList.add('drag-over');
    });
  },

  _endDrag(cx, cy, itemId) {
    if (this.ghost) { this.ghost.remove(); this.ghost = null; }
    const orig = document.getElementById('drag-' + itemId);
    if (orig) orig.classList.remove('dragging');
    this.draggingId = null;

    let target = null;
    document.querySelectorAll('.drop-zone, #pool').forEach(zone => {
      zone.classList.remove('drag-over');
      const r = zone.getBoundingClientRect();
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) target = zone;
    });

    if (target) {
      const zone = target.dataset.zone;
      if (zone === '__pool__') delete this.userAnswers[itemId];
      else this.userAnswers[itemId] = zone;
      this.render();
    }
  },

  reset() {
    this.userAnswers = {};
    this.submitted = false;
    this.render();
  },

  submit() {
    const { items } = this.activity.data;
    const unplaced = items.filter(it => !this.userAnswers[it.id]);
    if (unplaced.length > 0) {
      showToast(`Quedan ${unplaced.length} elemento(s) sin colocar`, 'error');
      return;
    }

    this.submitted = true;
    let score = 0;
    items.forEach(it => { if (this.userAnswers[it.id] === it.category) score++; });
    this._renderResult(score, items.length);
  },

  _renderResult(score, total) {
    const pct = Math.round((score / total) * 100);
    const { emoji, msg } = scoreMessage(pct);
    const { categories, items } = this.activity.data;
    const container = document.getElementById('player-content');

    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${pct}%</div>
        <div class="score-label">${score} de ${total} correctos</div>
        <div class="score-message">${msg}</div>
      </div>

      <div style="margin-top:2rem">
        <h3 style="font-family:var(--font-display);margin-bottom:1rem">Resultados</h3>
        <div class="drop-zones" style="pointer-events:none">
          ${categories.map(cat => `
            <div class="drop-zone" style="border-style:solid">
              <h3>${App.esc(cat)}</h3>
              <div class="drop-zone-items">
                ${items.filter(it => it.category === cat).map(it => {
                  const placed = this.userAnswers[it.id] === cat;
                  return `<div class="drag-item ${placed ? 'correct-placed' : 'incorrect-placed'}">${App.esc(it.text)}</div>`;
                }).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="score-actions" style="margin-top:2rem">
        <button class="btn btn-secondary" id="btn-retry-dd">🔄 Reintentar</button>
        <button class="btn btn-primary" id="btn-home-dd">🏠 Inicio</button>
      </div>`;

    document.getElementById('btn-retry-dd').addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-home-dd').addEventListener('click', () => App.goHome());
  }
};
