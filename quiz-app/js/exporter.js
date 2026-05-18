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
         <button class="share-option-btn" id="sopt-link" style="background: rgba(0, 210, 255, 0.1); border-color: rgba(0, 210, 255, 0.3);">
           <span class="share-opt-icon">🔗</span>
           <div>
             <div class="share-opt-title" style="color: #00d2ff;">Compartir Link Directo</div>
             <div class="share-opt-desc">Crea un link único para que cualquiera pueda jugar sin descargar nada.</div>
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

          const isUpdate = !!act.cloudId;
          // Si ya existe, no pedimos el autor de nuevo para no sobreescribirlo accidentalmente
          const author = isUpdate ? null : prompt("Introduce tu nombre o apodo para que la gente sepa quién creó esta genialidad:");
          if (!isUpdate && author === null) return; // Canceló
          
          showToast(isUpdate ? 'Actualizando en la Comunidad... ⏳' : 'Publicando en la nube... ⏳', 'info');
          try {
            const cloudId = await Community.publishActivity(act, author || 'Profesor Anónimo', act.cloudId);
            // Guardamos el cloudId si es nuevo
            if (!isUpdate) {
              act.cloudId = cloudId;
              await Storage.updateActivity(act);
            }
            showToast(isUpdate ? '¡Actualizado con éxito en la Comunidad! 🌍' : '¡Publicado con éxito en la Comunidad! 🌍', 'success');
          } catch(e) {
            showToast('Error publicando: ' + e.message, 'error');
          }
        });
        document.getElementById('sopt-link')?.addEventListener('click', () => {
          closeInfoModal();
          this.shareLink(activityId);
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

  // ── Share Link ──────────────────────────────────
  async shareLink(activityId) {
    const act = await Storage.getActivity(activityId);
    if (!act) return;

    if (!window.Community || typeof firebase === 'undefined') {
      return showToast('Necesitas conexión a internet para compartir links.', 'error');
    }

    const isUpdate = !!act.cloudId;
    showToast(isUpdate ? 'Actualizando link... ⏳' : 'Generando link... ⏳', 'info');

    try {
      // Publicamos usando el cloudId existente si lo tiene
      // Pasamos null como autor para no sobreescribir el autor original si es una actualización
      const cloudId = await Community.publishActivity(act, isUpdate ? null : "Usuario Bellestudia", act.cloudId);
      
      // Si es nuevo, lo guardamos en la actividad local
      if (!isUpdate) {
        act.cloudId = cloudId;
        await Storage.updateActivity(act);
      }

      const baseUrl = window.location.href.split('?')[0];
      const shareUrl = baseUrl + "?sharedId=" + cloudId;

      showInfoModal(
        isUpdate ? `✅ Link actualizado` : `🔗 Link generado`,
        `<p style="margin-bottom: var(--sp-md)">${isUpdate ? 'La versión online se ha actualizado. El link sigue siendo el mismo:' : 'Copia este link para compartir la actividad:'}</p>
         <div style="display:flex; gap:0.5rem; margin-bottom:var(--sp-lg)">
           <input type="text" id="share-url-input" class="form-input" value="${shareUrl}" readonly style="flex:1; font-size:0.85rem">
           <button class="btn btn-primary" id="btn-copy-url">Copiar</button>
         </div>
         <p style="font-size:0.8rem; color:var(--text-muted)">${isUpdate ? 'Cualquier persona que use el link anterior ahora verá tus cambios más recientes.' : 'Cualquiera con este link podrá jugar directamente a tu actividad.'}</p>`,
        () => {
          document.getElementById('btn-copy-url')?.addEventListener('click', () => {
            const inp = document.getElementById('share-url-input');
            inp.select();
            document.execCommand('copy');
            showToast('¡Link copiado al portapapeles! 📋', 'success');
          });
        }
      );
    } catch (e) {
      showToast('Error al compartir: ' + e.message, 'error');
    }
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
