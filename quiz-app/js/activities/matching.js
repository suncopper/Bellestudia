/**
 * EduPlay - Matching / Connection Activity Engine
 */
const MatchingActivity = {
  activity: null,
  shuffledRight: [],
  selectedLeft: null,
  selectedRight: null,
  matchedPairs: [],    // [{ leftId, rightId }] — only correct pairs
  showIncorrect: false,
  score: 0,

  start(activity) {
    this.activity = activity;
    this.shuffledRight = this._shuffle([...activity.data.pairs]);
    this.selectedLeft = null;
    this.selectedRight = null;
    this.matchedPairs = [];
    this.showIncorrect = false;
    this.score = 0;
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
    const pairs = this.activity.data.pairs;
    const total  = pairs.length;
    const pending = total - this.score;
    const container = document.getElementById('player-content');

    const leftHtml = pairs.map(pair => {
      const matched  = this.matchedPairs.some(m => m.leftId === pair.id);
      const selected = this.selectedLeft === pair.id;
      const isIncErr = this.showIncorrect && selected;

      let cls = 'matching-item';
      if (matched)     cls += ' matched-correct';
      else if (isIncErr) cls += ' matched-incorrect';
      else if (selected)  cls += ' selected';

      const disabled = matched ? 'style="cursor:default"' : '';
      const imgHtml = pair.image ? `<img src="${pair.image}" style="max-width:100px; max-height:100px; display:block; margin:0 auto 0.5rem; border-radius:4px; pointer-events:none;">` : '';
      return `<div class="${cls}" data-left="${pair.id}" ${disabled}>${imgHtml}${App.esc(pair.left)}</div>`;
    }).join('');

    const rightHtml = this.shuffledRight.map(pair => {
      const matched  = this.matchedPairs.some(m => m.rightId === pair.id);
      const selected = this.selectedRight === pair.id;
      const isIncErr = this.showIncorrect && selected;

      let cls = 'matching-item';
      if (matched)      cls += ' matched-correct';
      else if (isIncErr)  cls += ' matched-incorrect';
      else if (selected)  cls += ' selected';

      const disabled = matched ? 'style="cursor:default"' : '';
      return `<div class="${cls}" data-right="${pair.id}" ${disabled}>${App.esc(pair.right)}</div>`;
    }).join('');

    container.innerHTML = `
      <div class="matching-score-display">
        <div class="match-count">
          <div class="match-count-number">${this.score}</div>
          <div class="match-count-label">Correctas</div>
        </div>
        <div class="match-count">
          <div class="match-count-number">${pending}</div>
          <div class="match-count-label">Pendientes</div>
        </div>
      </div>

      <div class="matching-workspace" id="matching-ws">
        <div class="matching-column">
          <div class="matching-column-title">Términos</div>
          ${leftHtml}
        </div>
        <div class="matching-column">
          <div class="matching-column-title">Definiciones / Pares</div>
          ${rightHtml}
        </div>
      </div>
      <div class="matching-hint">
        👆 Selecciona un término y luego su par
      </div>`;

    // Attach click events
    container.querySelectorAll('[data-left]').forEach(el => {
      el.addEventListener('click', () => this._clickLeft(el.dataset.left));
    });
    container.querySelectorAll('[data-right]').forEach(el => {
      el.addEventListener('click', () => this._clickRight(el.dataset.right));
    });
  },

  _clickLeft(id) {
    if (this.matchedPairs.some(m => m.leftId === id)) return;
    if (this.showIncorrect) return;
    this.selectedLeft = (this.selectedLeft === id) ? null : id;
    this._tryMatch();
  },

  _clickRight(id) {
    if (this.matchedPairs.some(m => m.rightId === id)) return;
    if (this.showIncorrect) return;
    this.selectedRight = (this.selectedRight === id) ? null : id;
    this._tryMatch();
  },

  _tryMatch() {
    if (this.selectedLeft && this.selectedRight) {
      const correct = this.selectedLeft === this.selectedRight; // same pair id
      if (correct) {
        this.matchedPairs.push({ leftId: this.selectedLeft, rightId: this.selectedRight });
        this.score++;
        this.selectedLeft = null;
        this.selectedRight = null;
        this.render();

        if (this.score === this.activity.data.pairs.length) {
          setTimeout(() => this._renderFinal(), 700);
        }
      } else {
        // Show incorrect briefly
        this.showIncorrect = true;
        this.render();
        setTimeout(() => {
          this.showIncorrect = false;
          this.selectedLeft = null;
          this.selectedRight = null;
          this.render();
        }, 900);
      }
    } else {
      this.render();
    }
  },

  _renderFinal() {
    const total = this.activity.data.pairs.length;
    const pct = 100; // they completed all pairs
    const { emoji, msg } = scoreMessage(pct);
    const container = document.getElementById('player-content');

    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${total}/${total}</div>
        <div class="score-label">Todas las conexiones correctas</div>
        <div class="score-message">${msg}</div>
        <div class="score-actions">
          <button class="btn btn-secondary" id="btn-retry-match">🔄 Reintentar</button>
          <button class="btn btn-primary"   id="btn-home-match">🏠 Inicio</button>
        </div>
      </div>`;

    document.getElementById('btn-retry-match').addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-home-match').addEventListener('click', () => App.goHome());
  }
};
