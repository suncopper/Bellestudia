/**
 * EduPlay - Exporter / Importer Module
 * - Export activity as JSON (for EduPlay users)
 * - Export activity as standalone HTML (anyone can open and play)
 * - Import JSON activity files
 * - Download the full app as one self-contained HTML file
 */
const Exporter = {

  // ── Share modal ──────────────────────────────────
  async showShareModal(activityId) {
    const act = await Storage.getActivity(activityId);
    if (!act) return;

    showInfoModal(
      `📤 Compartir actividad`,
      `<p style="color:var(--text-secondary);margin-bottom:var(--sp-lg)">"${App.esc(act.title)}"</p>
       <div class="share-options">
         <button class="share-option-btn" id="sopt-json">
           <span class="share-opt-icon">📋</span>
           <div>
             <div class="share-opt-title">Exportar como JSON</div>
             <div class="share-opt-desc">Para importar en otro Bellestudia — ligero y rápido</div>
           </div>
         </button>
         <button class="share-option-btn" id="sopt-html">
           <span class="share-opt-icon">🌐</span>
           <div>
             <div class="share-opt-title">Exportar como página HTML</div>
             <div class="share-opt-desc">Cualquiera puede abrirlo y jugar — <strong>sin instalar nada</strong></div>
           </div>
         </button>
         <button class="share-option-btn" id="sopt-community" style="background: rgba(138, 43, 226, 0.1); border-color: rgba(138, 43, 226, 0.3);">
           <span class="share-opt-icon">🌍</span>
           <div>
             <div class="share-opt-title" style="color: #a5b4fc;">Publicar a la Comunidad</div>
             <div class="share-opt-desc">Sube esta actividad al servidor público para que todos puedan descargarla.</div>
           </div>
         </button>
       </div>`,
      () => {
        document.getElementById('sopt-json')?.addEventListener('click', () => {
          closeInfoModal();
          this.exportJSON(activityId);
        });
        document.getElementById('sopt-html')?.addEventListener('click', async () => {
          closeInfoModal();
          const act = await Storage.getActivity(activityId);
          if (!act) return;
          // If we are completely offline (bundled mode), self-replicate the app
          if (!document.querySelector('script[src*="js/app.js"]')) {
             this._downloadSelfReplicatingApp([act], 'bellestudia_actividad.html');
          } else {
             this.exportHTML(activityId);
          }
        });
        document.getElementById('sopt-community')?.addEventListener('click', async () => {
          closeInfoModal();
          const act = await Storage.getActivity(activityId);
          if (!act) return;
          
          if (!window.Community || typeof firebase === 'undefined') {
            return showToast('Necesitas conexión a internet para publicar en la comunidad.', 'error');
          }

          const author = prompt("Introduce tu nombre o apodo para que la gente sepa quién creó esta genialidad:");
          if (author === null) return; // Canceló

          // Validación de peso máximo para Firestore (1MB)
          const dataSize = new Blob([JSON.stringify(act)]).size;
          if (dataSize > 900000) { // Mayor a ~900KB
            return showInfoModal('Actividad Demasiado Pesada 🏋️', `
              <div style="color:var(--text-secondary); line-height:1.6">
                <p>Las bases de datos gratuitas de la comunidad admiten un máximo de <strong>1 MB</strong> por publicación.</p>
                <p style="margin-top:1rem">Tu actividad pesa <strong>${(dataSize / 1024 / 1024).toFixed(2)} MB</strong>. Esto comúnmente ocurre porque contiene muchas imágenes generadas por la inteligencia artificial de Bellestudia Pro.</p>
                <p style="margin-top:1rem;color:var(--text-muted);font-size:0.9rem">💡 <em>Solución: Intenta subir actividades creadas manualmente desde la App, o genera PDFs con la opción "Incluir Imágenes" desactivada.</em></p>
              </div>`);
          }
          
          showToast('Publicando en la nube... ⏳', 'info');
          try {
            await Community.publishActivity(act, author || 'Profesor Anónimo');
            showToast('¡Publicado con éxito en la Comunidad! 🌍', 'success');
          } catch(e) {
            showToast('Error publicando: ' + e.message, 'error');
          }
        });
      }
    );
  },

  // ── Export single activity as JSON ───────────────
  async exportJSON(activityId) {
    const act = await Storage.getActivity(activityId);
    if (!act) return;
    const blob = new Blob([JSON.stringify(act, null, 2)], { type: 'application/json' });
    this._download(blob, this._fname(act.title) + '.bellestudia.json');
    showToast('Actividad exportada como JSON ✅', 'success');
  },

  // ── Import from JSON file ───────────────────────
  importJSON() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,.bellestudia.json';
    inp.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ev => {
        try {
          let parsed = JSON.parse(ev.target.result);
          const acts = Array.isArray(parsed) ? parsed : [parsed];
          let added = 0, updated = 0;
          for (const act of acts) {
            if (!act.type || !act.title || !act.data) continue;
            if (!act.id) act.id = App.uid();
            act.createdAt = act.createdAt || Date.now();
            
            if (await Storage.getActivity(act.id)) {
              await Storage.updateActivity(act);
              updated++;
            } else {
              await Storage.addActivity(act);
              added++;
            }
          }
          if (!(added + updated)) throw new Error('No se encontraron actividades válidas');
          showToast(`Importación exitosa: ${added} nuevas, ${updated} actualizadas ✅`, 'success');
          await App.renderDashboard();
        } catch (err) {
          showToast('Error al importar: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    });
    inp.click();
  },

  // ── Export activity as standalone playable HTML ──
  async exportHTML(activityId) {
    const act = await Storage.getActivity(activityId);
    if (!act) return;

    showToast('Generando archivo HTML…', 'info');

    try {
      const [mainCSS, playerCSS, fontsCSS] = await Promise.all([
        this._fetch('css/main.css'),
        this._fetch('css/player.css'),
        this._fetch('css/fonts.css'),
      ]);

      const enginePaths = {
        quiz:       'js/activities/quiz.js',
        truefalse:  'js/activities/truefalse.js',
        dragdrop:   'js/activities/dragdrop.js',
        matching:   'js/activities/matching.js',
        memory:     'js/activities/memory.js',
        imagelabel: 'js/activities/imagelabel.js',
      };
      const engineNames = {
        quiz:'QuizActivity', truefalse:'TrueFalseActivity',
        dragdrop:'DragDropActivity', matching:'MatchingActivity',
        memory:'MemoryActivity', imagelabel:'ImageLabelActivity',
      };

      const engineJS   = enginePaths[act.type] ? await this._fetch(enginePaths[act.type]) : '';
      const engineName = engineNames[act.type] || '';

      const html = this._buildActivityHTML(act, mainCSS, playerCSS, engineJS, engineName, fontsCSS);
      this._download(new Blob([html], { type: 'text/html;charset=utf-8' }), this._fname(act.title) + '.html');
      showToast('Página HTML generada ✅ — ¡compártela!', 'success');
    } catch {
      showInfoModal('Sin acceso a los archivos', `
        <p style="color:var(--text-secondary);margin-bottom:var(--sp-md)">
          La exportación HTML requiere que la app esté abierta desde el servidor local.
        </p>
        <div class="info-box">
          <strong style="color:var(--text-primary)">Cómo activar el servidor:</strong>
          <ol style="padding-left:1.25rem;margin-top:.5rem;color:var(--text-secondary);line-height:2">
            <li>Abre una terminal en la carpeta <code>quiz-app</code></li>
            <li>Ejecuta: <code>python -m http.server 8765</code></li>
            <li>Abre <a href="http://localhost:8765" target="_blank" style="color:var(--primary-light)">http://localhost:8765</a></li>
          </ol>
        </div>
        <p style="margin-top:var(--sp-md);color:var(--text-muted);font-size:.82rem">
          💡 El export como JSON siempre funciona sin servidor.
        </p>`);
    }
  },

  // ── Show Bundle App modal ─────────────────────
  async showBundleModal() {
    const acts = await Storage.getActivities();
    const actsListHTML = acts.length === 0 
      ? `<p style="color:var(--text-muted);font-size:.85rem">No tienes actividades creadas aún.</p>`
      : `<div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--r-md); padding: var(--sp-sm); margin-bottom: var(--sp-sm); background: rgba(0,0,0,0.2);">
          ${acts.map(a => `
            <label style="display: flex; align-items: center; gap: var(--sp-sm); padding: var(--sp-xs); cursor: pointer; border-bottom: 1px solid var(--border-light);">
              <input type="checkbox" class="bundle-cb" value="${a.id}" checked>
              <span style="font-size: .85rem; color: var(--text-primary)">
                ${App.esc(a.title)} <span style="color:var(--text-muted);font-size:.75rem">(${a.type})</span>
              </span>
            </label>
          `).join('')}
         </div>
         <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-md);">
           <button class="btn btn-sm btn-ghost" id="btn-sel-all">Seleccionar Todo</button>
           <button class="btn btn-sm btn-ghost" id="btn-sel-none">Deseleccionar</button>
         </div>`;

    showInfoModal('📦 Exportar Paquete / Descargar App', `
      <div class="download-section">
        <h3 class="dl-section-title">1. Selecciona las actividades:</h3>
        ${actsListHTML}
        
        <h3 class="dl-section-title" style="margin-top:var(--sp-lg)">2. Elige cómo exportar:</h3>
        <div class="share-options" style="margin-bottom: var(--sp-lg);">
          <button class="share-option-btn" id="dl-bundle-json">
            <span class="share-opt-icon">📋</span>
            <div>
              <div class="share-opt-title">Paquete JSON</div>
              <div class="share-opt-desc">Para enviar a otro usuario o usar de respaldo.</div>
            </div>
          </button>
          <button class="share-option-btn" id="dl-bundle-html">
            <span class="share-opt-icon">🌐</span>
            <div>
              <div class="share-opt-title">App Completa (HTML)</div>
              <div class="share-opt-desc">Archivo HTML que cualquier celular abre sin instalar nada.</div>
            </div>
          </button>
        </div>
      </div>`,
      () => {
        const cbs = document.querySelectorAll('.bundle-cb');
        document.getElementById('btn-sel-all')?.addEventListener('click', () => cbs.forEach(c => c.checked = true));
        document.getElementById('btn-sel-none')?.addEventListener('click', () => cbs.forEach(c => c.checked = false));

        document.getElementById('dl-bundle-json')?.addEventListener('click', () => {
          const selectedIds = Array.from(document.querySelectorAll('.bundle-cb:checked')).map(cb => cb.value);
          if (!selectedIds.length) return showToast('Selecciona al menos una actividad', 'error');
          closeInfoModal();
          const selectedActs = acts.filter(a => selectedIds.includes(a.id));
          const blob = new Blob([JSON.stringify(selectedActs, null, 2)], { type: 'application/json' });
          this._download(blob, `bellestudia_paquete_${selectedActs.length}.json`);
          showToast(`Paquete JSON (${selectedActs.length}) guardado ✅`, 'success');
        });

        document.getElementById('dl-bundle-html')?.addEventListener('click', () => {
          const selectedIds = Array.from(document.querySelectorAll('.bundle-cb:checked')).map(cb => cb.value);
          closeInfoModal();
          const selectedActs = acts.filter(a => selectedIds.includes(a.id));
          
          if (!document.querySelector('script[src*="js/app.js"]')) {
             this._downloadSelfReplicatingApp(selectedActs, 'Bellestudia.html');
          } else {
             this._doDownloadApp(selectedActs);
          }
        });
      }
    );
  },

  // ── Offline Self-Replicating HTML App Generation ──
  _downloadSelfReplicatingApp(activitiesArray, filename = 'Bellestudia.html') {
    showToast('Generando Bellestudia...', 'info');
    try {
      const clone = document.documentElement.cloneNode(true);
      
      // Clean up dynamic state so the app looks fresh on load
      clone.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      clone.querySelector('#view-dashboard')?.classList.add('active');
      const grid = clone.querySelector('#activities-grid');
      if (grid) grid.innerHTML = '';
      const stats = clone.querySelector('#stats-bar');
      if (stats) stats.innerHTML = '';
      const empty = clone.querySelector('#empty-state');
      if (empty) empty.style.display = '';
      const toasts = clone.querySelector('#toast-container');
      if (toasts) toasts.innerHTML = '';
      const overlay = clone.querySelector('#modal-overlay');
      if (overlay) overlay.style.display = 'none';

      // Cleanup any inputs that might have retained values
      clone.querySelectorAll('input, textarea').forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio') el.removeAttribute('checked');
        else el.removeAttribute('value');
        el.textContent = '';
      });

      // Update PRELOADED data script
      const acts = activitiesArray && activitiesArray.length ? activitiesArray : [];
      const scriptText = `var _BELLESTUDIA_PRELOADED=${JSON.stringify(acts)};`;
      let targetScript = clone.querySelector('.preload-script-tag');
      
      if (targetScript) {
        targetScript.textContent = scriptText;
      } else {
        const s = document.createElement('script');
        s.className = 'preload-script-tag';
        s.textContent = scriptText;
        clone.querySelector('body')?.prepend(s);
      }

      const finalHTML = '<!DOCTYPE html>\n<html lang="es">\n' + clone.innerHTML + '\n</html>';
      this._download(new Blob([finalHTML], { type: 'text/html;charset=utf-8' }), filename);
      showToast('App generada ✅', 'success');
    } catch(err) {
      showToast('Error al empaquetar: ' + err.message, 'error');
    }
  },

  // ── Actually download the bundled app ───────────
  async _doDownloadApp(activitiesArray) {
    showToast('Empaquetando la aplicación…', 'info');

    try {
      const [mainCSS, creatorCSS, playerCSS, fontsCSS] = await Promise.all([
        this._fetch('css/main.css'),
        this._fetch('css/creator.css'),
        this._fetch('css/player.css'),
        this._fetch('css/fonts.css'),
      ]);

      const jsPaths = [
        'js/storage.js', 'js/activities/quiz.js', 'js/activities/truefalse.js',
        'js/activities/dragdrop.js', 'js/activities/matching.js', 'js/activities/memory.js',
        'js/activities/imagelabel.js', 'js/creator.js', 'js/exporter.js', 'js/app.js',
      ];
      const jsBundles = await Promise.all(jsPaths.map(p => this._fetch(p)));
      const indexHTML = await this._fetch('index.html');

      const activities = activitiesArray && activitiesArray.length ? activitiesArray : null;
      const bundled    = this._bundleApp(indexHTML, mainCSS, creatorCSS, playerCSS, fontsCSS, jsBundles, activities);

      this._download(new Blob([bundled], { type: 'text/html;charset=utf-8' }), 'Bellestudia.html');
      showToast('Bellestudia.html lista para compartir ✅', 'success');
    } catch {
      showInfoModal('Servidor requerido', `
        <p style="color:var(--text-secondary);margin-bottom:var(--sp-md)">
          Para empaquetar la app necesitas abrirla desde el servidor local:
        </p>
        <div class="info-box">
          <code>python -m http.server 8765</code><br>
          Luego abre <a href="http://localhost:8765" target="_blank" style="color:var(--primary-light)">http://localhost:8765</a>
        </div>
        <p style="margin-top:var(--sp-md);color:var(--text-muted);font-size:.82rem">
          Alternativa rápida: comprime la carpeta <code>quiz-app</code> como ZIP y compártela.
        </p>`);
    }
  },

  // ── Build standalone activity HTML ──────────────
  _buildActivityHTML(act, mainCSS, playerCSS, engineJS, engineName, fontsCSS = '') {
    const typeIcon = { quiz:'🎯',truefalse:'✅',dragdrop:'🧩',matching:'🔗',memory:'🃏',imagelabel:'🖼' }[act.type] || '📝';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${this._ea(act.title)} — Bellestudia">
  <title>${this._eh(act.title)} — Bellestudia</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
/* Fuentes embebidas — funciona sin internet */
${fontsCSS}
${mainCSS}
${playerCSS}
  </style>
</head>
<body>
<div id="app">
  <header id="app-header">
    <nav class="nav-container">
      <div class="nav-logo" onclick="if(confirm('¿Reiniciar la actividad?'))location.reload()" style="cursor:pointer" title="Reiniciar">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">Bellestudia</span>
      </div>
      ${act.subject ? `<span style="font-family:var(--font-display);color:var(--text-muted);font-size:.85rem">${this._eh(act.subject)}${act.topic ? ' › ' + this._eh(act.topic) : ''}</span>` : ''}
    </nav>
  </header>
  <main id="app-main" style="padding:var(--sp-xl) 0">
    <div class="container">
      <div class="view-header">
        <span style="font-size:2rem">${typeIcon}</span>
        <h1>${this._eh(act.title)}</h1>
      </div>
      <div id="player-content"></div>
    </div>
  </main>
  <footer class="app-footer">⚡ Hecho con Bellestudia &mdash; Toca el logo para reiniciar</footer>
</div>
<div id="toast-container" aria-live="polite"></div>

<script>
/* ── Datos de la actividad ── */
const ACTIVITY = ${JSON.stringify(act)};

/* ── Utilidades ── */
function generateId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,9);}
function showToast(msg,type='info'){
  const icons={success:'✅',error:'❌',info:'ℹ️'};
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML='<span>'+(icons[type]||'')+'</span><span>'+String(msg)+'</span>';
  document.getElementById('toast-container').appendChild(t);
  setTimeout(()=>t.remove(),3200);
}
function scoreMessage(pct){
  if(pct===100)return{emoji:'🏆',msg:'¡Perfecto! ¡Eres increíble!'};
  if(pct>=80)return{emoji:'🎉',msg:'¡Excelente resultado!'};
  if(pct>=60)return{emoji:'👍',msg:'¡Buen trabajo!'};
  if(pct>=40)return{emoji:'📚',msg:'Sigue practicando'};
  return{emoji:'💪',msg:'¡Tú puedes mejorar!'};
}
const App={
  esc(s){if(!s&&s!==0)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');},
  uid(){return generateId();},
  goHome(){if(confirm('¿Reiniciar la actividad?'))location.reload();}
};

/* ── Motor de actividad ── */
${engineJS}

/* ── Inicio ── */
document.addEventListener('DOMContentLoaded',()=>${engineName}.start(ACTIVITY));
<\/script>
</body>
</html>`;
  },

  // ── Bundle full app into one HTML file ──────────
  _bundleApp(indexHTML, mainCSS, creatorCSS, playerCSS, fontsCSS, jsBundles, activities) {
    const preload = activities
      ? `<script class="preload-script-tag">var _BELLESTUDIA_PRELOADED=${JSON.stringify(activities)};<\/script>`
      : `<script class="preload-script-tag">var _BELLESTUDIA_PRELOADED=[];<\/script>`;

    // Inline CSS (fonts first so they're available immediately)
    let html = indexHTML
      .replace('<link rel="stylesheet" href="css/fonts.css">', `<style>\n${fontsCSS}\n</style>`)
      .replace('<link rel="stylesheet" href="css/main.css">', `<style>\n${mainCSS}\n</style>`)
      .replace('<link rel="stylesheet" href="css/creator.css">', `<style>\n${creatorCSS}\n</style>`)
      .replace('<link rel="stylesheet" href="css/player.css">', `<style>\n${playerCSS}\n</style>`);

    // Replace all external <script src> tags: first → inlined bundle, rest → removed
    const pattern = /<script src="[^"]+"><\/script>/g;
    let done = false;
    html = html.replace(pattern, () => {
      if (!done) {
        done = true;
        return `${preload}\n<script>\n${jsBundles.join('\n\n/* ─────── */\n\n')}\n<\/script>`;
      }
      return '';
    });

    return html;
  },

  // ── Helpers ─────────────────────────────────────
  async _fetch(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error('fetch failed: ' + path);
    return r.text();
  },
  _eh(s) { return !s ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },
  _ea(s) { return this._eh(s).replace(/"/g,'&quot;'); },
  _fname(t) { return (t||'actividad').replace(/[^a-z0-9áéíóúüñ\s]/gi,'').replace(/\s+/g,'_').slice(0,40)||'actividad'; },
  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
