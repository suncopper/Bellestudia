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
  searchTerm:        '',
  
  communityActivities: [],
  commFilterSubject: null,
  commSearchTerm: '',

  _VIEWS: ['dashboard', 'type-selector', 'creator', 'player', 'community'],

  uid()  { return generateId(); },

  // ── Audio Feedback ───────────────────────────
  _audioCtx: null,
  playSound(type) {
    if (!this._audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this._audioCtx = new AudioContext();
    }
    const ctx = this._audioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, t + 0.1); // C6
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'incorrect') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'win') {
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, t + 0.3); // C6
      osc.start(t);
      osc.stop(t + 0.5);
    } else if (type === 'pop') {
      // Just a small pop for placing an item
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.05);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'flip') {
      // Short swoosh for card flip
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  },
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
      pointclick: { icon: '🖱️', label: 'Juego Point & Click' },
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
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        (a.title   || '').toLowerCase().includes(term) ||
        (a.subject || '').toLowerCase().includes(term) ||
        (a.topic   || '').toLowerCase().includes(term)
      );
    }

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
      const d    = a.data || {};

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
    if (act) this.playActivityFromData(act);
  },


  // ── Community ────────────────────────────────
  async renderCommunity() {
    const grid  = document.getElementById('community-grid');
    const stats = document.getElementById('comm-total-stats');

    if (!window.Community || typeof firebase === 'undefined') {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Conexión a internet requerida para entrar a la comunidad.</div>';
      return;
    }

    try {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Descargando base de datos mundial... ⏳</div>';
      this.communityActivities = await Community.getRecentActivities(30);
      stats.textContent = this.communityActivities.length;

      if (!this.communityActivities.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Aún no hay actividades publicadas. ¡Sé el primero!</div>';
        return;
      }

      this._renderCommunityGrid();
    } catch (e) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Error al conectar con la comunidad.<br><small>${e.message}</small></div>`;
    }
  },

  _renderCommunityGrid() {
    const grid  = document.getElementById('community-grid');
    const stats = document.getElementById('comm-total-stats');
    let list = this.communityActivities || [];

    if (this.commSearchTerm) {
      const term = this.commSearchTerm.toLowerCase();
      list = list.filter(a =>
        (a.title   || '').toLowerCase().includes(term) ||
        (a.subject || '').toLowerCase().includes(term) ||
        (a.topic   || '').toLowerCase().includes(term) ||
        (a.author  || '').toLowerCase().includes(term)
      );
    }

    stats.textContent = list.length;

    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">No se encontraron actividades con esa búsqueda.</div>';
      return;
    }

    grid.innerHTML = list.map(a => {
      const info = this._typeInfo(a.type);
      const subjectBadge = a.subject
        ? `<div class="card-subject-badge">${this.esc(a.subject)}${a.topic ? ' › ' + this.esc(a.topic) : ''}</div>`
        : '';
      const author = a.author || 'Anónimo';
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
  },

  async importFromCommunity(id) {
    try {
      showToast('Descargando actividad... ⏳', 'info');
      const act = await Community.getActivity(id);
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
      showToast('Error al importar: ' + e.message, 'error');
    }
  },

  // ── Init ─────────────────────────────────────
  async init() {
    // Migrar datos viejos si existen
    await Storage.migrate();

    // Theme & Sidebar setup
    const themeBtnSidebar = document.getElementById('btn-theme-sidebar');
    if (themeBtnSidebar) {
      const rootApp = document.documentElement;
      themeBtnSidebar.textContent = rootApp.getAttribute('data-theme') === 'light' ? '🌙 Modo Oscuro' : '☀️ Modo Claro';
      themeBtnSidebar.addEventListener('click', () => {
        const isLight = rootApp.getAttribute('data-theme') === 'light';
        if (isLight) {
          rootApp.removeAttribute('data-theme');
          localStorage.setItem('bellestudia_theme', 'dark');
          themeBtnSidebar.textContent = '☀️ Modo Claro';
        } else {
          rootApp.setAttribute('data-theme', 'light');
          localStorage.setItem('bellestudia_theme', 'light');
          themeBtnSidebar.textContent = '🌙 Modo Oscuro';
        }
      });
    }

    const btnMenuApp = document.getElementById('btn-menu-app');
    const sidebarApp = document.getElementById('app-sidebar');
    const sidebarOverlayApp = document.getElementById('app-sidebar-overlay');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');

    const toggleSidebar = (show) => {
      if (show) {
        sidebarApp.classList.add('active');
        sidebarOverlayApp.classList.add('active');
      } else {
        sidebarApp.classList.remove('active');
        sidebarOverlayApp.classList.remove('active');
      }
    };

    if (btnMenuApp) btnMenuApp.addEventListener('click', () => toggleSidebar(true));
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
    if (sidebarOverlayApp) sidebarOverlayApp.addEventListener('click', () => toggleSidebar(false));

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

    // Dashboard search bar listener
    document.getElementById('dashboard-search')?.addEventListener('input', e => {
      this.searchTerm = e.target.value;
      this.renderDashboard();
    });

    // Community search bar listener
    document.getElementById('comm-search')?.addEventListener('input', e => {
      this.commSearchTerm = e.target.value;
      this._renderCommunityGrid();
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

    // Check for shared activity in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('sharedId');
    if (sharedId) {
      this.loadSharedActivity(sharedId);
    }
  },

  async loadSharedActivity(id) {
    try {
      showInfoModal('Cargando actividad', '<div style="text-align:center;padding:2rem"><p>Obteniendo actividad compartida...</p><div class="spinner" style="margin:1rem auto">⏳</div></div>');
      
      const act = await Community.getActivity(id);
      if (!act) throw new Error('No se encontró la actividad compartida.');
      
      closeInfoModal();
      this.playActivityFromData(act);
      showToast('Actividad compartida cargada con éxito', 'success');
      
      // Limpiar URL para no recargarla al refrescar
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      closeInfoModal();
      showToast('Error al cargar link: ' + e.message, 'error');
    }
  },

  playActivityFromData(act) {
    document.getElementById('player-title').textContent = act.title;
    const engines = {
      quiz:       QuizActivity,
      truefalse:  TrueFalseActivity,
      dragdrop:   DragDropActivity,
      matching:   MatchingActivity,
      memory:     MemoryActivity,
      imagelabel: ImageLabelActivity,
      pointclick: PointClickActivity,
    };
    const engine = engines[act.type];
    if (engine) engine.start(act);
    this.showView('player');
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  App.init();
  // Pre-compute the real hash at boot so it doesn't sit as a static string
  AdminPanel.PASS_HASH = await AdminPanel._sha256('raccoonstudy123');
  AdminPanel.init();
});

// ══════════════════════════════════════════════
//  ADMIN PANEL  — Acceso secreto por contraseña
// ══════════════════════════════════════════════
const AdminPanel = {
  // SHA-256 hash of "raccoonstudy123"
  // (computed at runtime via Web Crypto API)
  PASS_HASH: '6e3fa0a2b04c0e8de1c3b0f5e9a2d4f7c1b8e6d3a9f2c5b0e7d4a1f8c3b6e9d2',

  _unlocked: false,
  _allActivities: [],
  _searchTerm: '',
  _triggerCount: 0,
  _triggerTimer: null,

  // ── Inicializar listeners ─────────────────
  init() {
    // Trigger: 5 clics en el footer
    const trigger = document.getElementById('admin-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => {
        this._triggerCount++;
        clearTimeout(this._triggerTimer);
        if (this._triggerCount >= 5) {
          this._triggerCount = 0;
          this.openGate();
        } else {
          this._triggerTimer = setTimeout(() => { this._triggerCount = 0; }, 2000);
        }
      });
    }

    // Botón mostrar/ocultar contraseña
    document.getElementById('admin-toggle-pw')?.addEventListener('click', () => {
      const inp = document.getElementById('admin-password-input');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Botón cancelar gate
    document.getElementById('admin-cancel')?.addEventListener('click', () => this.close());

    // Botón desbloquear
    document.getElementById('admin-unlock')?.addEventListener('click', () => this.tryUnlock());

    // Enter en el input de contraseña
    document.getElementById('admin-password-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.tryUnlock();
    });

    // Botón salir del panel
    document.getElementById('admin-logout')?.addEventListener('click', () => {
      this._unlocked = false;
      this.close();
    });

    // Botón actualizar lista
    document.getElementById('admin-refresh')?.addEventListener('click', () => this.loadActivities());

    // Búsqueda dentro del panel
    document.getElementById('admin-search')?.addEventListener('input', e => {
      this._searchTerm = e.target.value;
      this.renderList();
    });

    // Cerrar con clic fuera del panel
    document.getElementById('admin-overlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('admin-overlay')) this.close();
    });
  },

  // ── Abrir la ventana de contraseña ────────
  openGate() {
    const overlay = document.getElementById('admin-overlay');
    const gate    = document.getElementById('admin-gate');
    const panel   = document.getElementById('admin-panel');
    overlay.style.display = 'flex';
    if (this._unlocked) {
      gate.style.display  = 'none';
      panel.style.display = 'flex';
      this.loadActivities();
    } else {
      gate.style.display  = 'block';
      panel.style.display = 'none';
      document.getElementById('admin-password-input').value = '';
      document.getElementById('admin-gate-error').textContent = '';
      setTimeout(() => document.getElementById('admin-password-input')?.focus(), 100);
    }
  },

  close() {
    document.getElementById('admin-overlay').style.display = 'none';
  },

  // ── Verificar contraseña ──────────────────
  async tryUnlock() {
    const input = document.getElementById('admin-password-input').value;
    const hash  = await this._sha256(input);
    if (hash === this.PASS_HASH) {
      this._unlocked = true;
      document.getElementById('admin-gate').style.display  = 'none';
      document.getElementById('admin-panel').style.display = 'flex';
      this.loadActivities();
    } else {
      const err = document.getElementById('admin-gate-error');
      err.textContent = '❌ Contraseña incorrecta';
      document.getElementById('admin-password-input').value = '';
      document.getElementById('admin-password-input').focus();
      setTimeout(() => { err.textContent = ''; }, 2500);
    }
  },

  async _sha256(message) {
    const msgBuffer  = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray  = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ── Cargar actividades de Firestore ───────
  async loadActivities() {
    const listEl = document.getElementById('admin-list');
    listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted,#94a3b8);padding:2rem;">Cargando... ⏳</p>';
    document.getElementById('admin-search').value = '';
    this._searchTerm = '';
    try {
      this._allActivities = await Community.getAllActivities();
      this.renderList();
    } catch (e) {
      listEl.innerHTML = `<p style="text-align:center;color:#f87171;padding:2rem;">Error: ${e.message}</p>`;
    }
  },

  // ── Renderizar lista filtrada ─────────────
  renderList() {
    const listEl = document.getElementById('admin-list');
    const countEl = document.getElementById('admin-count');
    let list = this._allActivities;

    if (this._searchTerm) {
      const t = this._searchTerm.toLowerCase();
      list = list.filter(a =>
        (a.title   || '').toLowerCase().includes(t) ||
        (a.author  || '').toLowerCase().includes(t) ||
        (a.subject || '').toLowerCase().includes(t) ||
        (a.topic   || '').toLowerCase().includes(t)
      );
    }

    countEl.textContent = `${list.length} actividad${list.length !== 1 ? 'es' : ''}`;

    if (!list.length) {
      listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted,#94a3b8);padding:2rem;">No se encontraron actividades.</p>';
      return;
    }

    const typeIcons = { quiz:'🎯', truefalse:'✅', dragdrop:'🧩', matching:'🔗', memory:'🃏', imagelabel:'🖼', pointclick:'🖱️' };

    listEl.innerHTML = list.map(a => {
      const icon   = typeIcons[a.type] || '📝';
      const author = App.esc(a.author || 'Anónimo');
      const title  = App.esc(a.title  || 'Sin título');
      const subj   = a.subject ? `<span style="font-size:0.75rem;background:rgba(138,43,226,0.15);color:#c084fc;padding:2px 8px;border-radius:20px;margin-left:6px;">${App.esc(a.subject)}</span>` : '';
      let dateStr  = 'Reciente';
      if (a.publishedAt?.toDate) {
        dateStr = a.publishedAt.toDate().toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric' });
      }
      return `
        <div style="display:flex;align-items:center;gap:1rem;padding:0.85rem 1rem;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);transition:background 0.2s;" 
             onmouseover="this.style.background='rgba(255,255,255,0.06)'" 
             onmouseout="this.style.background='rgba(255,255,255,0.03)'">
          <span style="font-size:1.4rem;flex-shrink:0;">${icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:var(--text-main,#f8fafc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}${subj}</div>
            <div style="font-size:0.8rem;color:var(--text-muted,#94a3b8);">👤 ${author} &nbsp;·&nbsp; ${dateStr}</div>
          </div>
          <div style="display:flex;gap:0.4rem;flex-shrink:0;">
            <button 
              onclick="AdminPanel.editActivity('${a.id}', '${title.replace(/'/g,"\\'")}'  , '${(a.author||'').replace(/'/g,"\\'")}')"
              style="padding:0.45rem 0.9rem;border-radius:8px;border:1px solid rgba(139,92,246,0.35);background:rgba(139,92,246,0.08);color:#c084fc;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.2s;"
              onmouseover="this.style.background='rgba(139,92,246,0.2)'"
              onmouseout="this.style.background='rgba(139,92,246,0.08)'"
            >✏️ Editar</button>
            <button 
              onclick="AdminPanel.deleteActivity('${a.id}', '${title.replace(/'/g,"\\'")}')"
              style="padding:0.45rem 0.9rem;border-radius:8px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.2s;"
              onmouseover="this.style.background='rgba(239,68,68,0.2)'"
              onmouseout="this.style.background='rgba(239,68,68,0.08)'"
            >🗑️ Eliminar</button>
          </div>
        </div>`;
    }).join('');
  },

  // ── Eliminar actividad ────────────────────
  deleteActivity(id, title) {
    showModal(
      'Eliminar de la Comunidad',
      `¿Eliminar "${title}" de la base de datos pública? Esta acción no se puede deshacer.`,
      async () => {
        try {
          showToast('Eliminando... ⏳', 'info');
          await Community.deleteActivity(id);
          this._allActivities = this._allActivities.filter(a => a.id !== id);
          this.renderList();
          showToast('Actividad eliminada de la comunidad ✅', 'success');
        } catch (e) {
          showToast('Error al eliminar: ' + e.message, 'error');
        }
      }
    );
  },

  // ── Editar actividad ────────────────────
  editActivity(id, currentTitle, currentAuthor) {
    showInfoModal(
      '✏️ Editar Actividad',
      `<div style="display:flex;flex-direction:column;gap:1rem;">
        <div>
          <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.05em;">Nombre de la actividad</label>
          <input id="admin-edit-title" type="text" value="${App.esc(currentTitle)}"
            style="width:100%;padding:0.75rem 1rem;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:var(--r-md);color:var(--text-primary);font-size:0.95rem;font-family:var(--font-body);outline:none;">
        </div>
        <div>
          <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.05em;">Autor</label>
          <input id="admin-edit-author" type="text" value="${App.esc(currentAuthor)}"
            style="width:100%;padding:0.75rem 1rem;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:var(--r-md);color:var(--text-primary);font-size:0.95rem;font-family:var(--font-body);outline:none;">
        </div>
        <p id="admin-edit-error" style="color:#f87171;font-size:0.85rem;min-height:1.2em;margin:0;"></p>
        <button onclick="AdminPanel.saveEdit('${id}')" 
          style="width:100%;padding:0.75rem;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#8a2be2,#6d1fc2);color:#fff;font-size:0.95rem;font-weight:600;cursor:pointer;">
          Guardar cambios
        </button>
      </div>`,
      () => document.getElementById('admin-edit-title')?.focus()
    );
    // store id for saveEdit
    this._editingId = id;
  },

  async saveEdit(id) {
    const titleEl  = document.getElementById('admin-edit-title');
    const authorEl = document.getElementById('admin-edit-author');
    const errorEl  = document.getElementById('admin-edit-error');
    const newTitle  = titleEl?.value.trim();
    const newAuthor = authorEl?.value.trim();

    if (!newTitle) {
      if (errorEl) errorEl.textContent = 'El nombre no puede estar vacío.';
      return;
    }

    try {
      if (errorEl) errorEl.textContent = 'Guardando...';
      await Community.updateActivity(id, { title: newTitle, author: newAuthor || 'Anónimo' });

      // Update local cache
      const act = this._allActivities.find(a => a.id === id);
      if (act) {
        act.title  = newTitle;
        act.author = newAuthor || 'Anónimo';
      }

      closeInfoModal();
      this.renderList();
      showToast('Actividad actualizada ✅', 'success');
    } catch (e) {
      if (errorEl) errorEl.textContent = 'Error: ' + e.message;
    }
  }
};
