/**
 * EduPlay - Quiz Activity Engine
 */
const QuizActivity = {
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
    const qs = this.activity.data.questions;
    const container = document.getElementById('player-content');

    if (this.currentIndex >= qs.length) {
      this.renderScore(container);
      return;
    }

    const q = qs[this.currentIndex];
    const progress = (this.currentIndex / qs.length) * 100;
    const isLast = this.currentIndex === qs.length - 1;

    container.innerHTML = `
      <div class="progress-container">
        <div class="progress-header">
          <span>Pregunta ${this.currentIndex + 1} / ${qs.length}</span>
          <span>⭐ ${this.score} pts</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>

      <div class="quiz-question-card">
        ${q.image ? `<div class="quiz-question-image"><img src="${q.image}" alt="Imagen adjunta"></div>` : ''}
        <div class="quiz-question-text">${App.esc(q.text)}</div>
        <div class="quiz-options" id="quiz-options">
          ${q.options.map((opt, i) => `
            <button class="quiz-option-btn" id="opt-${i}" data-index="${i}">
              <span class="opt-letter">${['A','B','C','D'][i]}.</span>
              <span>${App.esc(opt)}</span>
            </button>`).join('')}
        </div>
        <div id="quiz-feedback"></div>
      </div>

      <div class="quiz-nav" id="quiz-nav" style="display:none">
        <button class="btn btn-primary" id="btn-next-q">
          ${isLast ? 'Ver Resultado →' : 'Siguiente →'}
        </button>
      </div>
    `;

    this.answered = false;

    document.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.addEventListener('click', () => this.answer(parseInt(btn.dataset.index)));
    });
    document.getElementById('btn-next-q')?.addEventListener('click', () => this.next());
  },

  answer(idx) {
    if (this.answered) return;
    this.answered = true;

    const q = this.activity.data.questions[this.currentIndex];
    const correct = idx === q.correct;
    if (correct) this.score++;

    document.querySelectorAll('.quiz-option-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correct) btn.classList.add('correct');
      else if (i === idx && !correct) btn.classList.add('incorrect');
    });

    const fb = document.getElementById('quiz-feedback');
    fb.innerHTML = correct
      ? `<div class="quiz-feedback correct">🎉 ¡Correcto!</div>`
      : `<div class="quiz-feedback incorrect">❌ La respuesta era: <strong>${App.esc(q.options[q.correct])}</strong></div>`;

    document.getElementById('quiz-nav').style.display = 'flex';
  },

  next() { this.currentIndex++; this.render(); },

  renderScore(container) {
    const total = this.activity.data.questions.length;
    const pct = Math.round((this.score / total) * 100);
    const { emoji, msg } = scoreMessage(pct);

    container.innerHTML = `
      <div class="score-screen">
        <div class="score-emoji">${emoji}</div>
        <div class="score-main">${pct}%</div>
        <div class="score-label">${this.score} de ${total} correctas</div>
        <div class="score-message">${msg}</div>
        <div class="score-actions">
          <button class="btn btn-secondary" id="btn-retry-quiz">🔄 Reintentar</button>
          <button class="btn btn-primary" id="btn-home-quiz">🏠 Inicio</button>
        </div>
      </div>`;

    document.getElementById('btn-retry-quiz').addEventListener('click', () => this.start(this.activity));
    document.getElementById('btn-home-quiz').addEventListener('click', () => App.goHome());
  }
};
