/**
 * EduPlay - Memory Card Game Engine
 */
const MemoryActivity = {
  activity: null,
  cards: [],
  flipped: [],       // card IDs currently face-up (max 2)
  matched: new Set(),// card IDs that are permanently matched
  moves: 0,
  canFlip: true,
  startTime: null,
  timerInterval: null,

  start(activity) {
    this.activity = activity;
    this.flipped = [];
    this.matched = new Set();
    this.moves = 0;
    this.canFlip = true;
    this.startTime = Date.now();

    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }

    // Build card list: each pair -> 2 cards
    this.cards = this._shuffle(
      activity.data.pairs.flatMap(pair => [
        { id: 'c_' + pair.id + '_a', pairId: pair.id, text: pair.front, image: pair.image },
        { id: 'c_' + pair.id + '_b', pairId: pair.id, text: pair.back },
      ])
    );

    this.render();
    this._startTimer();
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  _startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const el = document.getElementById('mem-timer');
      if (el) el.textContent = this._fmt(Math.floor((Date.now() - this.startTime) / 1000));
    }, 1000);
  },

  _fmt(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  },

  render() {
    const n = this.cards.length;
    const cols = Math.min(Math.ceil(Math.sqrt(n)), 6);
    const container = document.getElementById('player-content');
    const pairsFound = this.matched.size / 2;
    const totalPairs = n / 2;

    container.innerHTML = `
      <div class="memory-stats">
        <div class="memory-stat">
          <div class="memory-stat-value">${this.moves}</div>
          <div class="memory-stat-label">Movimientos</div>
        </div>
        <div class="memory-stat">
          <div class="memory-stat-value">${pairsFound}/${totalPairs}</div>
          <div class="memory-stat-label">Pares</div>
        </div>
        <div class="memory-stat">
          <div class="memory-stat-value" id="mem-timer">00:00</div>
          <div class="memory-stat-label">Tiempo</div>
        </div>
      </div>

      <div class="memory-grid" style="grid-template-columns:repeat(${cols},1fr)">
        ${this.cards.map(c => {
          const isFlipped = this.flipped.includes(c.id) || this.matched.has(c.id);
          const isMatched = this.matched.has(c.id);
          let cls = 'memory-card';
          if (isFlipped) cls += ' flipped';
          if (isMatched) cls += ' matched';
          return `
            <div class="${cls}" data-card-id="${c.id}">
              <div class="memory-card-inner">
                <div class="memory-card-front">🎴</div>
                <div class="memory-card-back" style="display:flex; flex-direction:column; justify-content:center; align-items:center;">
                  ${c.image ? `<img src="${c.image}" style="max-height:45px; max-width:90%; margin-bottom:5px; border-radius:4px; pointer-events:none;">` : ''}
                  <div style="font-size:0.9em; line-height:1.2;">${App.esc(c.text)}</div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    // Attach click events
    container.querySelectorAll('.memory-card').forEach(el => {
      el.addEventListener('click', () => this._flip(el.dataset.cardId));
    });
  },

  _flip(cardId) {
    if (!this.canFlip) return;
    if (this.flipped.includes(cardId)) return;
    if (this.matched.has(cardId)) return;

    this.flipped.push(cardId);

    // Animate flip in DOM without full re-render
    const el = document.querySelector(`[data-card-id="${cardId}"]`);
    if (el) el.classList.add('flipped');

    if (this.flipped.length === 2) {
      this.moves++;
      this._updateStats();
      this.canFlip = false;

      const [id1, id2] = this.flipped;
      const c1 = this.cards.find(c => c.id === id1);
      const c2 = this.cards.find(c => c.id === id2);

      if (c1.pairId === c2.pairId) {
        // ✅ Match
        setTimeout(() => {
          this.matched.add(id1);
          this.matched.add(id2);
          this.flipped = [];
          this.canFlip = true;

          [id1, id2].forEach(id => {
            const card = document.querySelector(`[data-card-id="${id}"]`);
            if (card) card.classList.add('matched');
          });
          this._updateStats();

          if (this.matched.size === this.cards.length) {
            setTimeout(() => this._renderComplete(), 700);
          }
        }, 600);
      } else {
        // ❌ No match — flip back
        setTimeout(() => {
          [id1, id2].forEach(id => {
            const card = document.querySelector(`[data-card-id="${id}"]`);
            if (card) card.classList.remove('flipped');
          });
          this.flipped = [];
          this.canFlip = true;
          this._updateStats();
        }, 1100);
      }
    }
  },

  _updateStats() {
    const movesEl = document.querySelector('.memory-stat:nth-child(1) .memory-stat-value');
    const pairsEl = document.querySelector('.memory-stat:nth-child(2) .memory-stat-value');
    if (movesEl) movesEl.textContent = this.moves;
    if (pairsEl) pairsEl.textContent = `${this.matched.size/2}/${this.cards.length/2}`;
  },

  _renderComplete() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const totalPairs = this.cards.length / 2;
    const container = document.getElementById('player-content');

    let emoji, msg;
    if (this.moves <= totalPairs * 1.5)      { emoji = '🏆'; msg = '¡Memoria extraordinaria!'; }
    else if (this.moves <= totalPairs * 2.5) { emoji = '🎉'; msg = '¡Muy bien hecho!'; }
    else                                     { emoji = '👍'; msg = '¡Lo lograste!'; }

    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${totalPairs}</div>
        <div class="score-label">pares encontrados en ${this.moves} movimientos</div>
        <div class="score-message">${msg}</div>
        <p style="color:var(--text-muted);margin-bottom:1.5rem">⏱ Tiempo total: ${this._fmt(elapsed)}</p>
        <div class="score-actions">
          <button class="btn btn-secondary" id="btn-retry-mem">🔄 Jugar de nuevo</button>
          <button class="btn btn-primary"   id="btn-home-mem">🏠 Inicio</button>
        </div>
      </div>`;

    document.getElementById('btn-retry-mem').addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-home-mem').addEventListener('click', () => App.goHome());
  }
};
