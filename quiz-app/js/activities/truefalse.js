/**
 * EduPlay - True / False Activity Engine
 */
const TrueFalseActivity = {
  activity: null,
  currentIndex: 0,
  score: 0,
  answered: false,

  start(activity) {
    this.activity = activity;
    this.currentIndex = 0;
    this.score = 0;
    this.answered = false;
    this.render();
  },

  render() {
    const stmts = this.activity.data.statements;
    const container = document.getElementById('player-content');

    if (this.currentIndex >= stmts.length) {
      this.renderScore(container);
      return;
    }

    const s = stmts[this.currentIndex];
    const progress = (this.currentIndex / stmts.length) * 100;
    const isLast = this.currentIndex === stmts.length - 1;

    container.innerHTML = `
      <div class="progress-container">
        <div class="progress-header">
          <span>Afirmación ${this.currentIndex + 1} / ${stmts.length}</span>
          <span>⭐ ${this.score} pts</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>

      <div class="tf-statement-card">
        ${s.image ? `<div style="text-align:center; margin-bottom:1rem;"><img src="${s.image}" style="max-width:100%; max-height:250px; border-radius:8px; object-fit:contain;" alt="Imagen adjunta"></div>` : ''}
        <div class="tf-statement-text">${App.esc(s.text)}</div>
        <div class="tf-buttons">
          <button class="tf-play-btn verdadero" id="btn-v">
            <span>✓</span><span style="font-size:1rem">Verdadero</span>
          </button>
          <button class="tf-play-btn falso" id="btn-f">
            <span>✗</span><span style="font-size:1rem">Falso</span>
          </button>
        </div>
        <div id="tf-feedback"></div>
        <div id="tf-nav" style="display:none;margin-top:1.5rem;text-align:center">
          <button class="btn btn-primary" id="btn-tf-next">
            ${isLast ? 'Ver Resultado →' : 'Siguiente →'}
          </button>
        </div>
      </div>`;

    this.answered = false;

    document.getElementById('btn-v').addEventListener('click', () => this.answer(true));
    document.getElementById('btn-f').addEventListener('click', () => this.answer(false));
    document.getElementById('btn-tf-next')?.addEventListener('click', () => this.next());
  },

  answer(value) {
    if (this.answered) return;
    this.answered = true;

    const s = this.activity.data.statements[this.currentIndex];
    const correct = value === s.correct;
    if (correct) this.score++;

    const btnV = document.getElementById('btn-v');
    const btnF = document.getElementById('btn-f');
    btnV.disabled = true; btnF.disabled = true;

    if (s.correct === true) {
      btnV.classList.add('selected-correct');
      if (!correct) btnF.classList.add('selected-incorrect');
    } else {
      btnF.classList.add('selected-correct');
      if (!correct) btnV.classList.add('selected-incorrect');
    }

    document.getElementById('tf-feedback').innerHTML = correct
      ? `<div class="quiz-feedback correct" style="margin-top:1rem">🎉 ¡Correcto!</div>`
      : `<div class="quiz-feedback incorrect" style="margin-top:1rem">❌ Era <strong>${s.correct ? 'Verdadero' : 'Falso'}</strong></div>`;

    document.getElementById('tf-nav').style.display = 'block';
  },

  next() { this.currentIndex++; this.render(); },

  renderScore(container) {
    const total = this.activity.data.statements.length;
    const pct = Math.round((this.score / total) * 100);
    const { emoji, msg } = scoreMessage(pct);

    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${pct}%</div>
        <div class="score-label">${this.score} de ${total} correctas</div>
        <div class="score-message">${msg}</div>
        <div class="score-actions">
          <button class="btn btn-secondary" id="btn-retry-tf">🔄 Reintentar</button>
          <button class="btn btn-primary" id="btn-home-tf">🏠 Inicio</button>
        </div>
      </div>`;

    document.getElementById('btn-retry-tf').addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-home-tf').addEventListener('click', () => App.goHome());
  }
};
