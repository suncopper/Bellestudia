/**
 * EduPlay / Bellestudia - Timeline Activity Engine
 * Ordering timeline elements chronologically with optional top name slots and bottom content cards (images & text).
 * Supports Drag & Drop + Tap-to-place.
 */
const TimelineActivity = {
  activity: null,
  _submitted: false,
  _showNames: true,
  _nameBank: [],    // [{ id, itemId, name }] shuffled
  _itemBank: [],    // [{ id, itemId, text, image, name }] shuffled
  _answers: {},     // { 'top_0': nameBankId, 'bottom_0': itemBankId }
  _sel: null,       // { type: 'top'|'bottom', id: string }
  _finalCorrect: 0,
  _finalTotal: 0,

  start(act) {
    this.activity = act;
    this._submitted = false;
    this._sel = null;
    this._answers = {};
    
    const d = act.data || {};
    this._showNames = (d.showNames !== undefined) ? !!d.showNames : true;
    this._orientation = d.orientation || 'horizontal';

    const items = d.items || [];
    
    // Build banks
    this._nameBank = this._shuffle(items.map(it => ({
      id: 'name_' + it.id,
      itemId: it.id,
      name: it.name || ''
    })));

    this._itemBank = this._shuffle(items.map(it => ({
      id: 'item_' + it.id,
      itemId: it.id,
      text: it.text || '',
      image: it.image || null,
      name: it.name || ''
    })));

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
    if (!container) return;

    const items = this.activity.data.items || [];
    const totalItems = items.length;
    const showNames = this._showNames;
    const orientation = this._orientation || 'horizontal';

    // Track placed items
    const placedTop = new Set(Object.entries(this._answers).filter(([k]) => k.startsWith('top_')).map(([, v]) => v));
    const placedBottom = new Set(Object.entries(this._answers).filter(([k]) => k.startsWith('bottom_')).map(([, v]) => v));

    const availableNames = this._nameBank.filter(n => !placedTop.has(n.id));
    const availableItems = this._itemBank.filter(it => !placedBottom.has(it.id));

    // Progress calculation
    let totalSlots = totalItems * (showNames ? 2 : 1);
    let filledSlots = Object.keys(this._answers).length;

    let html = `
      <div class="timeline-player timeline-orientation-${orientation}">
        <div class="progress-container" style="margin-bottom: var(--sp-lg);">
          <div class="progress-header">
            <span>Elementos colocados</span>
            <span>${filledSlots} / ${totalSlots}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.round((filledSlots / (totalSlots || 1)) * 100)}%"></div>
          </div>
        </div>

        <div class="timeline-scroll-container ${orientation}">
          <div class="timeline-track-wrapper ${orientation}">
            <div class="timeline-main-line ${orientation}"></div>
            
            <div class="timeline-stations ${orientation}">
              ${items.map((item, idx) => {
                const topKey = `top_${idx}`;
                const bottomKey = `bottom_${idx}`;

                const topEntryId = this._answers[topKey];
                const topEntry = topEntryId ? this._nameBank.find(n => n.id === topEntryId) : null;
                const isTopCorrect = this._isTopSlotCorrect(idx);

                const bottomEntryId = this._answers[bottomKey];
                const bottomEntry = bottomEntryId ? this._itemBank.find(i => i.id === bottomEntryId) : null;
                const isBottomCorrect = this._isBottomSlotCorrect(idx);

                let topCls = '';
                if (this._submitted) {
                  topCls = isTopCorrect ? 'correct' : 'incorrect';
                } else if (topEntry) {
                  topCls = 'filled';
                } else if (this._sel && this._sel.type === 'top') {
                  topCls = 'drop-target';
                }

                let bottomCls = '';
                if (this._submitted) {
                  bottomCls = isBottomCorrect ? 'correct' : 'incorrect';
                } else if (bottomEntry) {
                  bottomCls = 'filled';
                } else if (this._sel && this._sel.type === 'bottom') {
                  bottomCls = 'drop-target';
                }

                return `
                  <div class="timeline-station ${orientation === 'vertical' ? 'vertical-station' : ''}" data-index="${idx}">
                    
                    ${showNames ? `
                    <!-- Top Slot for Name -->
                    <div class="timeline-top-area">
                      <div class="timeline-top-slot ${topCls}" data-slot-key="${topKey}">
                        ${topEntry ? `
                          <span class="timeline-slot-text">${App.esc(topEntry.name)}</span>
                          ${!this._submitted ? `<button class="timeline-remove-btn" data-slot-key="${topKey}">✕</button>` : ''}
                        ` : `
                          <span class="timeline-slot-ph">Nombre ${idx + 1}</span>
                        `}
                        ${this._submitted && !isTopCorrect ? `
                          <div class="timeline-answer-key">✓ ${App.esc(item.name)}</div>
                        ` : ''}
                      </div>
                      <div class="timeline-stem top-stem"></div>
                    </div>` : ''}

                    <!-- Timeline Node -->
                    <div class="timeline-node-wrapper">
                      <div class="timeline-node-circle">${idx + 1}</div>
                    </div>

                    <!-- Bottom Stem & Slot for Content (Image/Text) -->
                    <div class="timeline-bottom-area">
                      <div class="timeline-stem bottom-stem"></div>
                      <div class="timeline-bottom-slot ${bottomCls}" data-slot-key="${bottomKey}">
                        ${bottomEntry ? `
                          <div class="timeline-card-content">
                            ${bottomEntry.image ? `<img src="${bottomEntry.image}" class="timeline-card-img" alt="Imagen">` : ''}
                            ${bottomEntry.text ? `<span class="timeline-card-text">${App.esc(bottomEntry.text)}</span>` : ''}
                          </div>
                          ${!this._submitted ? `<button class="timeline-remove-btn" data-slot-key="${bottomKey}">✕</button>` : ''}
                        ` : `
                          <span class="timeline-slot-ph">Arrastra elemento aquí</span>
                        `}
                        ${this._submitted && !isBottomCorrect ? `
                          <div class="timeline-answer-key">
                            ✓ Correcto: ${App.esc(item.name ? item.name + ' - ' : '')}${App.esc(item.text || 'Imagen')}
                          </div>
                        ` : ''}
                      </div>
                    </div>

                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Banks Section -->
        ${!this._submitted ? `
        <div class="timeline-banks-container">
          ${showNames ? `
          <div class="timeline-bank-panel">
            <div class="timeline-bank-title">
              🏷️ NOMBRES DE CASILLAS
              ${this._sel && this._sel.type === 'top' ? ' — <span style="color:var(--primary-light);font-weight:400">toca una casilla arriba</span>' : ''}
            </div>
            <div class="timeline-chips-pool">
              ${availableNames.map(n => `
                <div class="timeline-name-chip ${this._sel && this._sel.id === n.id ? 'selected' : ''}"
                     data-bank-type="top" data-entry-id="${n.id}">
                  ${App.esc(n.name)}
                </div>
              `).join('')}
              ${!availableNames.length ? '<span style="color:var(--text-muted);font-size:.82rem;">✓ Todos los nombres colocados</span>' : ''}
            </div>
          </div>` : ''}

          <div class="timeline-bank-panel">
            <div class="timeline-bank-title">
              🖼️/📝 ELEMENTOS PARA ORDENAR
              ${this._sel && this._sel.type === 'bottom' ? ' — <span style="color:var(--primary-light);font-weight:400">toca una casilla abajo</span>' : ''}
            </div>
            <div class="timeline-cards-pool">
              ${availableItems.map(it => `
                <div class="timeline-item-card ${this._sel && this._sel.id === it.id ? 'selected' : ''}"
                     data-bank-type="bottom" data-entry-id="${it.id}">
                  ${it.image ? `<img src="${it.image}" class="timeline-item-card-img" alt="Imagen">` : ''}
                  ${it.text ? `<span class="timeline-item-card-text">${App.esc(it.text)}</span>` : ''}
                </div>
              `).join('')}
              ${!availableItems.length ? '<span style="color:var(--text-muted);font-size:.82rem;">✓ Todos los elementos colocados</span>' : ''}
            </div>
          </div>
        </div>` : ''}

        <!-- Actions -->
        <div class="timeline-actions">
          <button class="btn btn-ghost" id="btn-tl-reset">🔄 Reiniciar</button>
          ${this._submitted
            ? `<button class="btn btn-primary" id="btn-tl-view-score">Ver Puntuación →</button>`
            : `<button class="btn btn-primary" id="btn-tl-check">✓ Verificar respuestas</button>`
          }
        </div>
      </div>
    `;

    // Preserve scroll position before re-rendering
    const prevScroll = document.querySelector('.timeline-scroll-container');
    const savedScrollLeft = prevScroll ? prevScroll.scrollLeft : 0;
    const savedScrollTop  = prevScroll ? prevScroll.scrollTop  : 0;

    container.innerHTML = html;

    // Restore scroll position after new DOM is injected
    const newScroll = container.querySelector('.timeline-scroll-container');
    if (newScroll) {
      newScroll.scrollLeft = savedScrollLeft;
      newScroll.scrollTop  = savedScrollTop;
    }

    this._bindEvents();
  },

  _bindEvents() {
    if (this._submitted) {
      document.getElementById('btn-tl-reset')?.addEventListener('click', () => {
        this._answers = {};
        this._sel = null;
        this._submitted = false;
        this.render();
      });
      document.getElementById('btn-tl-view-score')?.addEventListener('click', () => {
        this._renderScore(this._finalCorrect, this._finalTotal);
      });
      return;
    }

    // ── Select items from banks (Tap & Drag) ──
    document.querySelectorAll('.timeline-name-chip, .timeline-item-card').forEach(el => {
      const type = el.dataset.bankType;
      const id = el.dataset.entryId;

      el.addEventListener('click', () => {
        if (this._sel && this._sel.id === id) {
          this._sel = null;
        } else {
          this._sel = { type, id };
        }
        this.render();
      });

      el.addEventListener('pointerdown', e => this._startDrag(e, el, type, id), { passive: false });
    });

    // ── Slots (Tap to place / remove) ──
    document.querySelectorAll('.timeline-top-slot, .timeline-bottom-slot').forEach(slot => {
      const slotKey = slot.dataset.slotKey;
      const slotType = slotKey.startsWith('top_') ? 'top' : 'bottom';

      slot.addEventListener('click', e => {
        e.stopPropagation();
        if (this._answers[slotKey]) {
          // Deselect / remove placed item back to bank
          delete this._answers[slotKey];
          this._sel = null;
          this.render();
        } else if (this._sel && this._sel.type === slotType) {
          // Place selected bank entry here
          this._answers[slotKey] = this._sel.id;
          this._sel = null;
          App.playSound('pop');
          this.render();
        }
      });
    });

    // Remove buttons inside slots
    document.querySelectorAll('.timeline-remove-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const slotKey = btn.dataset.slotKey;
        delete this._answers[slotKey];
        this._sel = null;
        this.render();
      });
    });

    // Click outside to deselect
    document.querySelector('.timeline-player')?.addEventListener('click', e => {
      if (!e.target.closest('.timeline-name-chip') && !e.target.closest('.timeline-item-card') &&
          !e.target.closest('.timeline-top-slot') && !e.target.closest('.timeline-bottom-slot')) {
        if (this._sel) {
          this._sel = null;
          this.render();
        }
      }
    });

    // Action buttons
    document.getElementById('btn-tl-reset')?.addEventListener('click', () => {
      this._answers = {};
      this._sel = null;
      this._submitted = false;
      this.render();
    });

    document.getElementById('btn-tl-check')?.addEventListener('click', () => this._submit());
  },

  // ── Drag & Drop Logic ──
  _startDrag(e, element, type, entryId) {
    if (this._submitted) return;
    if (e.target.closest('.timeline-remove-btn')) return;
    e.preventDefault();

    element.setPointerCapture(e.pointerId);

    const ghost = document.createElement('div');
    ghost.className = (type === 'top' ? 'timeline-name-chip' : 'timeline-item-card') + ' drag-ghost';
    ghost.innerHTML = element.innerHTML;
    document.body.appendChild(ghost);
    this._ghost = ghost;

    const rect = element.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;

    const moveHandler = mv => {
      mv.preventDefault();
      if (this._ghost) {
        this._ghost.style.left = (mv.clientX - ox) + 'px';
        this._ghost.style.top = (mv.clientY - oy) + 'px';
      }
      this._highlightSlotUnder(mv.clientX, mv.clientY, type);
    };

    const upHandler = up => {
      if (this._ghost) {
        this._ghost.remove();
        this._ghost = null;
      }
      this._dropOnSlot(up.clientX, up.clientY, type, entryId);
      element.removeEventListener('pointermove', moveHandler);
      element.removeEventListener('pointerup', upHandler);
    };

    element.addEventListener('pointermove', moveHandler, { passive: false });
    element.addEventListener('pointerup', upHandler);
  },

  _highlightSlotUnder(cx, cy, type) {
    const selector = type === 'top' ? '.timeline-top-slot' : '.timeline-bottom-slot';
    document.querySelectorAll(selector).forEach(s => {
      const r = s.getBoundingClientRect();
      const over = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
      s.classList.toggle('drag-over', over);
    });
  },

  _dropOnSlot(cx, cy, type, entryId) {
    const selector = type === 'top' ? '.timeline-top-slot' : '.timeline-bottom-slot';
    let dropped = false;

    document.querySelectorAll(selector).forEach(s => {
      s.classList.remove('drag-over');
      const r = s.getBoundingClientRect();
      if (!dropped && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        const slotKey = s.dataset.slotKey;
        this._answers[slotKey] = entryId;
        this._sel = null;
        dropped = true;
        App.playSound('pop');
      }
    });

    if (dropped) this.render();
  },

  _isTopSlotCorrect(idx) {
    const topEntryId = this._answers[`top_${idx}`];
    if (!topEntryId) return false;
    const topEntry = this._nameBank.find(n => n.id === topEntryId);
    if (!topEntry) return false;

    const expectedItem = this.activity.data.items[idx];
    if (!expectedItem) return false;

    // 1. Direct ID match
    if (topEntry.itemId === expectedItem.id) return true;

    // 2. Content / Name equality match (allows duplicate events in timeline)
    const placedName   = (topEntry.name || '').trim().toLowerCase();
    const expectedName = (expectedItem.name || '').trim().toLowerCase();
    return (placedName.length > 0 && placedName === expectedName);
  },

  _isBottomSlotCorrect(idx) {
    const bottomEntryId = this._answers[`bottom_${idx}`];
    if (!bottomEntryId) return false;
    const bottomEntry = this._itemBank.find(i => i.id === bottomEntryId);
    if (!bottomEntry) return false;

    const expectedItem = this.activity.data.items[idx];
    if (!expectedItem) return false;

    // 1. Direct ID match
    if (bottomEntry.itemId === expectedItem.id) return true;

    // 2. Content equality match (text + image + name - allows duplicate events in timeline)
    const placedText   = (bottomEntry.text || '').trim().toLowerCase();
    const expectedText = (expectedItem.text || '').trim().toLowerCase();

    const placedName   = (bottomEntry.name || '').trim().toLowerCase();
    const expectedName = (expectedItem.name || '').trim().toLowerCase();

    const sameImage = (bottomEntry.image === expectedItem.image);
    const sameText  = (placedText === expectedText);
    const sameName  = (placedName === expectedName);

    return (sameImage && sameText && sameName);
  },

  // ── Submit & Score ──
  _submit() {
    const items = this.activity.data.items || [];
    const totalItems = items.length;
    const showNames = this._showNames;
    const totalSlots = totalItems * (showNames ? 2 : 1);
    const filledCount = Object.keys(this._answers).length;

    if (filledCount < totalSlots) {
      showToast(`Faltan ${totalSlots - filledCount} elementos por ordenar en la línea de tiempo`, 'error');
      return;
    }

    this._submitted = true;
    let correctCount = 0;

    items.forEach((item, idx) => {
      if (showNames) {
        if (this._isTopSlotCorrect(idx)) {
          correctCount++;
        }
      }

      if (this._isBottomSlotCorrect(idx)) {
        correctCount++;
      }
    });

    this._finalCorrect = correctCount;
    this._finalTotal = totalSlots;

    if (correctCount === totalSlots) {
      App.playSound('win');
    } else {
      App.playSound('pop');
    }

    this.render();
  },

  _renderScore(correct, total) {
    const pct = Math.round((correct / total) * 100);
    const { emoji, msg } = scoreMessage(pct);
    const container = document.getElementById('player-content');
    if (!container) return;

    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${pct}%</div>
        <div class="score-label">${correct} de ${total} aciertos en la línea de tiempo</div>
        <div class="score-message">${msg}</div>
        <div class="score-actions">
          <button class="btn btn-secondary" id="btn-retry-tl">🔄 Reintentar</button>
          <button class="btn btn-ghost"     id="btn-review-tl">👁️ Revisar Respuestas</button>
          <button class="btn btn-primary"   id="btn-home-tl">🏠 Inicio</button>
        </div>
      </div>
    `;

    document.getElementById('btn-retry-tl')?.addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-review-tl')?.addEventListener('click', () => this.render());
    document.getElementById('btn-home-tl')?.addEventListener('click', () => App.goHome());
  }
};
