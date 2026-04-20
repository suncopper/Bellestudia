/**
 * EduPlay - Exporter / Importer Module
 * - Export activity as JSON (for EduPlay users)
 * - Import JSON activity files
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

  // ── Helpers ─────────────────────────────────────
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
