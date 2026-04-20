/**
 * EduPlay - Main App Controller (v3)
 * + Subject/Topic filtering
 * + Image Label activity support
 * + Export / Import / Download App
 */

// ── Global utilities ─────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

/** Confirmation modal (secure: uses textContent) */
function showModal(title, message, onConfirm) {
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-confirm').style.display = '';
  document.getElementById('modal-cancel').textContent  = 'Cancelar';
  document.getElementById('modal-overlay').style.display = 'flex';

  const overlay = document.getElementById('modal-overlay');
  const okBtn   = document.getElementById('modal-confirm');
  const xBtn    = document.getElementById('modal-cancel');
  const cleanup = () => { overlay.style.display = 'none'; okBtn.onclick = null; xBtn.onclick = null; };
  okBtn.onclick = () => { cleanup(); onConfirm(); };
  xBtn.onclick  = cleanup;
}

/** Info / action modal (uses innerHTML for rich content) */
function showInfoModal(title, htmlContent, onReady) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').innerHTML = htmlContent;
  document.getElementById('modal-confirm').style.display = 'none';
  document.getElementById('modal-cancel').textContent = 'Cerrar';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel').onclick = closeInfoModal;
  if (typeof onReady === 'function') setTimeout(onReady, 0);
}

function closeInfoModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-confirm').style.display = '';
  document.getElementById('modal-cancel').textContent = 'Cancelar';
  document.getElementById('modal-message').innerHTML = '';
  document.getElementById('modal-cancel').onclick = null;
}

function scoreMessage(pct) {
  const select = (arr) => arr[Math.floor(Math.random() * arr.length)];
  if (pct === 100) {
    const mapache = '<img src="../raccanim.png" alt="Mapache" style="width: 150px; height: 150px; object-fit: contain; filter: drop-shadow(0 8px 12px rgba(255, 215, 0, 0.4)); animation: float 2s infinite ease-in-out;">';
    return select([
      { emoji: mapache, msg: '¡Perfecto! ¡Eres increíble!' },
      { emoji: mapache, msg: '¡Impecable! Rendimiento legendario.' },
      { emoji: mapache, msg: '¡Puntuación perfecta! ¡Felicidades!' },
      { emoji: mapache, msg: '¡Estás on fire! 100% de aciertos.' }
    ]);
  }
  if (pct >= 80) return select([
    { emoji: '🎉', msg: '¡Excelente resultado!' },
    { emoji: '👏', msg: '¡Muy bien hecho! Casi perfecto.' },
    { emoji: '🚀', msg: '¡Gran trabajo! Estás muy cerca de la cima.' },
    { emoji: '💪', msg: '¡Impresionante nivel!' }
  ]);
  if (pct >= 60) return select([
    { emoji: '👍', msg: '¡Buen trabajo!' },
    { emoji: '✅', msg: '¡Aprobado! Pero puedes hacerlo mejor.' },
    { emoji: '🙂', msg: 'Bien hecho, ¡sigue así!' }
  ]);
  if (pct >= 40) return select([
    { emoji: '📚', msg: 'Sigue practicando.' },
    { emoji: '✏️', msg: 'Has aprendido algo nuevo hoy.' },
    { emoji: '🧗', msg: 'Un poco más de repaso y lo lograrás.' }
  ]);
  return select([
    { emoji: '💪', msg: '¡Tú puedes mejorar!' },
    { emoji: '🌱', msg: 'Todo experto fue alguna vez principiante.' },
    { emoji: '🔁', msg: '¡Inténtalo de nuevo!' }
  ]);
}

// ── App ──────────────────────────────────────
const App = {
  editingActivityId: null,
  filterSubject:     null,
  filterTopic:       null,

  _VIEWS: ['dashboard', 'type-selector', 'creator', 'player', 'community'],

  uid()  { return generateId(); },
  esc(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  _typeInfo(type) {
    const map = {
      quiz:       { icon: '🎯', label: 'Quiz' },
      truefalse:  { icon: '✅', label: 'Verdadero/Falso' },
      dragdrop:   { icon: '🧩', label: 'Drag & Drop' },
      matching:   { icon: '🔗', label: 'Conexión de Términos' },
      memory:     { icon: '🃏', label: 'Memoria' },
      imagelabel: { icon: '🖼', label: 'Etiquetado de Imagen' },
    };
    return map[type] || { icon: '📝', label: type };
  },

  // ── View routing ─────────────────────────────
  showView(id) {
    this._VIEWS.forEach(v => document.getElementById('view-' + v)?.classList.remove('active'));
    document.getElementById('view-' + id)?.classList.add('active');
    window.scrollTo(0, 0);
  },

  goHome() {
    if (MemoryActivity.timerInterval) { clearInterval(MemoryActivity.timerInterval); MemoryActivity.timerInterval = null; }
    this.editingActivityId = null;
    this.showView('dashboard');
    this.renderDashboard();
  },

  // ── Filter ───────────────────────────────────
  setFilter(subject, topic = null) {
    if (subject === null) {
      this.filterSubject = null;
      this.filterTopic   = null;
    } else {
      this.filterSubject = subject;
      this.filterTopic   = topic;
    }
    this.renderDashboard();
  },

  // ── Dashboard ────────────────────────────────
  async renderDashboard() {
    const all = await Storage.getActivities();
    const grid       = document.getElementById('activities-grid');
    const emptyState = document.getElementById('empty-state');
    const statsBar   = document.getElementById('stats-bar');

    // Stats chips
    const counts = {};
    all.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    statsBar.innerHTML =
      `<div class="stat-chip"><strong>${all.length}</strong> actividad${all.length !== 1 ? 'es' : ''}</div>` +
      Object.entries(counts).map(([t, n]) => {
        const info = this._typeInfo(t);
        return `<div class="stat-chip">${info.icon} <strong>${n}</strong> ${info.label}</div>`;
      }).join('');

    // Subject / Topic filter bar
    const subjects = [...new Set(all.map(a => a.subject).filter(Boolean))].sort();
    const filterSection = document.getElementById('filter-section');

    if (subjects.length && filterSection) {
      const topicsForSubject = this.filterSubject
        ? [...new Set(all.filter(a => a.subject === this.filterSubject).map(a => a.topic).filter(Boolean))].sort()
        : [];

      filterSection.innerHTML = `
        <div class="filter-bar-label">Filtrar por Materia</div>
        <div class="subject-filter-bar">
          <button class="filter-chip ${!this.filterSubject ? 'active' : ''}"
            onclick="App.setFilter(null)">Todas</button>
          ${subjects.map(s => `
            <button class="filter-chip ${this.filterSubject === s ? 'active' : ''}"
              onclick="App.setFilter('${this.esc(s)}')">${this.esc(s)}</button>`).join('')}
        </div>
        ${this.filterSubject && topicsForSubject.length ? `
        <div class="topic-filter-bar">
          <button class="filter-chip ${!this.filterTopic ? 'active' : ''}"
            onclick="App.setFilter('${this.esc(this.filterSubject)}', null)">Todos los temas</button>
          ${topicsForSubject.map(t => `
            <button class="filter-chip ${this.filterTopic === t ? 'active' : ''}"
              onclick="App.setFilter('${this.esc(this.filterSubject)}','${this.esc(t)}')">${this.esc(t)}</button>`).join('')}
        </div>` : ''}`;
      filterSection.style.display = 'block';
    } else if (filterSection) {
      filterSection.style.display = 'none';
    }

    // Filter
    let filtered = [...all].reverse();
    if (this.filterSubject) filtered = filtered.filter(a => a.subject === this.filterSubject);
    if (this.filterTopic)   filtered = filtered.filter(a => a.topic   === this.filterTopic);

    if (!filtered.length) {
      grid.innerHTML = '';
      emptyState.style.display = all.length ? 'none' : 'block';
      if (all.length && !filtered.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
          No hay actividades en esta materia/tema.<br>
          <button class="btn btn-ghost" style="margin-top:1rem" onclick="App.setFilter(null)">Ver todas</button>
        </div>`;
      }
      return;
    }
    emptyState.style.display = 'none';

    // Render cards
    grid.innerHTML = filtered.map(a => {
      const info = this._typeInfo(a.type);
      const date = new Date(a.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
      const d    = a.data;
      const cnt  = d.questions?.length || d.statements?.length || d.items?.length || d.pairs?.length
                 || d.images?.reduce((s, img) => s + img.zones.length, 0) || 0;
      const cntLabel = d.images
        ? `${d.images.length} imagen${d.images.length !== 1 ? 'es' : ''}, ${cnt} zona${cnt !== 1 ? 's' : ''}`
        : (cnt ? `${cnt} elemento${cnt !== 1 ? 's' : ''}` : '');

      const subjectBadge = a.subject
        ? `<div class="card-subject-badge">${this.esc(a.subject)}${a.topic ? ' › ' + this.esc(a.topic) : ''}</div>`
        : '';

      return `
        <div class="activity-card">
          <div class="card-type-badge">${info.icon} ${info.label}</div>
          ${subjectBadge}
          <div class="card-title">${this.esc(a.title)}</div>
          <div class="card-meta">${date}${cntLabel ? ' · ' + cntLabel : ''}</div>
          <div class="card-actions">
            <button class="btn btn-sm btn-ghost" onclick="App.editActivity('${a.id}')" title="Editar">✏️</button>
            <button class="btn btn-sm btn-ghost" onclick="App.deleteActivity('${a.id}')" title="Eliminar">🗑️</button>
            <button class="btn btn-sm btn-ghost" onclick="Exporter.showShareModal('${a.id}')" title="Compartir / Exportar">📤</button>
            <button class="btn btn-sm btn-primary" onclick="App.playActivity('${a.id}')">▶ Jugar</button>
          </div>
        </div>`;
    }).join('');
  },

  // ── Activity actions ─────────────────────────
  async deleteActivity(id) {
    const act = await Storage.getActivity(id);
    if (!act) return;
    showModal('Eliminar Actividad',
      `¿Eliminar "${act.title}"? Esta acción no se puede deshacer.`,
      async () => { await Storage.deleteActivity(id); await this.renderDashboard(); showToast('Actividad eliminada', 'success'); });
  },

  async editActivity(id) {
    const act = await Storage.getActivity(id);
    if (!act) return;
    this.editingActivityId = id;
    await Creator.loadActivity(act);
    this.showView('creator');
  },

  async playActivity(id) {
    const act = await Storage.getActivity(id);
    if (!act) return;
    document.getElementById('player-title').textContent = act.title;
    const engines = {
      quiz:       QuizActivity,
      truefalse:  TrueFalseActivity,
      dragdrop:   DragDropActivity,
      matching:   MatchingActivity,
      memory:     MemoryActivity,
      imagelabel: ImageLabelActivity,
    };
    const engine = engines[act.type];
    if (engine) engine.start(act);
    this.showView('player');
  },

  // ── Community ────────────────────────────────
  async renderCommunity() {
    const grid = document.getElementById('community-grid');
    const stats = document.getElementById('comm-total-stats');
    
    if (!window.Community || typeof firebase === 'undefined') {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Conexión a internet requerida para entrar a la comunidad.</div>';
      return;
    }

    try {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Descargando base de datos mundial... ⏳</div>';
      const activities = await Community.getRecentActivities(30);
      stats.textContent = activities.length;

      if (!activities.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Aún no hay actividades publicadas. ¡Sé el primero!</div>';
        return;
      }

      grid.innerHTML = activities.map(a => {
        const info = this._typeInfo(a.type);
        const subjectBadge = a.subject ? `<div class="card-subject-badge">${this.esc(a.subject)}${a.topic ? ' › ' + this.esc(a.topic) : ''}</div>` : '';
        const author = a.author || 'Anónimo';
        // Safeguard to format timestamp
        let dateStr = 'Reciente';
        if (a.publishedAt && a.publishedAt.toDate) {
          dateStr = a.publishedAt.toDate().toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        return `
          <div class="activity-card" style="border-color: rgba(0, 210, 255, 0.3);">
            <div class="card-type-badge">${info.icon} ${info.label}</div>
            ${subjectBadge}
            <div class="card-title">${this.esc(a.title)}</div>
            <div class="card-meta">👨‍🏫 ${this.esc(author)} · ${dateStr}</div>
            <div class="card-actions" style="margin-top: 1rem;">
              <button class="btn btn-sm btn-primary" onclick="App.importFromCommunity('${a.id}')" style="width:100%">📥 Guardar en mis actividades</button>
            </div>
          </div>`;
      }).join('');
    } catch (e) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Error al conectar con la comunidad.<br><small>${e.message}</small></div>`;
    }
  },

  async importFromCommunity(id) {
    try {
      const activities = await Community.getRecentActivities(30);
      const act = activities.find(a => a.id === id);
      if (!act) return showToast('No se encontró la actividad', 'error');

      // Modificamos el ID para evitar conflictos, pero guardamos el original
      const importedAct = {
        id: this.uid(),
        type: act.type,
        title: act.title + " (Comunidad)",
        subject: act.subject,
        topic: act.topic,
        data: act.data,
        createdAt: Date.now()
      };

      await Storage.addActivity(importedAct);
      showToast('¡Actividad importada a tu cuenta!', 'success');
      this.goHome(); // Devuelve al dashboard
    } catch (e) {
      showToast('Error al importar', 'error');
    }
  },

  // ── Init ─────────────────────────────────────
  async init() {
    // Migrar datos viejos si existen
    await Storage.migrate();

    // Logo / home
    document.getElementById('btn-home').addEventListener('click', () => this.goHome());
    
    // ... resto de event listeners ...
    document.getElementById('nav-btn-dashboard')?.addEventListener('click', () => {
      this.showView('dashboard');
      this.renderDashboard();
    });

    document.getElementById('nav-btn-community')?.addEventListener('click', () => {
      this.showView('community');
      this.renderCommunity();
    });

    // New activity
    ['btn-new-activity', 'btn-new-activity-empty'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => this.showView('type-selector'));
    });

    // Activity type cards
    document.querySelectorAll('.type-card').forEach(card => {
      card.addEventListener('click', () => {
        Creator.newActivity(card.dataset.type);
        this.showView('creator');
      });
    });

    // Back buttons
    document.getElementById('btn-back-selector')?.addEventListener('click', () => this.goHome());
    document.getElementById('btn-back-creator')?.addEventListener('click',  () => this.goHome());
    document.getElementById('btn-back-player')?.addEventListener('click',   () => this.goHome());

    // Import
    document.getElementById('btn-import')?.addEventListener('click',       () => Exporter.importJSON());

    // Modal close on backdrop click
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay'))
        closeInfoModal();
    });

    this.renderDashboard();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
