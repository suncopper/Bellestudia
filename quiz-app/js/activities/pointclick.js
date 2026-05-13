const PointClickActivity = {
  start(activity) {
    this.act = activity;
    this.container = document.getElementById('player-content');
    this.scenes = activity.data.scenes || [];

    if (!this.scenes.length) {
      this.container.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted)">No hay escenas en este juego.</div>';
      return;
    }

    this.currentSceneId = activity.data.startSceneId || this.scenes[0].id;
    this.currentSequence = null;
    this.currentSequenceIdx = 0;
    this.currentHotspotId = null;
    this.dialogHistory = [];
    this.jumpedViaChoice = false;
    this.inventory = [];
    this.missions = []; // { id, name, description, status: 'active'|'completed' }
    this.hotspotStates = {}; // { hotspotId: stateName }

    // Generar el overlay del menú una sola vez
    if (!document.getElementById('pointclick-menu-overlay')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="pointclick-menu-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.65); backdrop-filter:blur(5px); z-index:9999; justify-content:center; align-items:center;">
          <div style="background:var(--bg-card); padding:30px; border-radius:var(--r-lg); width:90%; max-width:580px; box-shadow:0 20px 60px rgba(0,0,0,0.4); border:2px solid #ff6b9e; display:flex; flex-direction:column; max-height:90vh;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
              <h2 style="margin:0; color:#ff6b9e; font-family:var(--font-display); font-size:1.4rem;">Sistema de Partidas</h2>
              <button id="pointclick-menu-close" class="btn-icon" style="color:var(--text-muted); font-size:1.4rem; line-height:1;">✕</button>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; border-bottom:2px solid var(--border); padding-bottom:12px;">
              <button id="pc-tab-save" class="btn btn-ghost" style="color:#ff6b9e; font-weight:bold;">💾 Guardar</button>
              <button id="pc-tab-load" class="btn btn-ghost">📂 Cargar</button>
              <button id="pc-btn-fullscreen" class="btn btn-ghost">⛶ Pantalla Completa</button>
              <button id="pc-btn-restart" class="btn btn-ghost" style="margin-left:auto; color:var(--error);">↩ Reiniciar</button>
            </div>
            <div id="pc-slots-container" style="overflow-y:auto; flex-grow:1; display:flex; flex-direction:column; gap:10px; padding-right:5px;">
            </div>
          </div>
        </div>
      `);

      document.getElementById('pointclick-menu-close').addEventListener('click', () => {
        document.getElementById('pointclick-menu-overlay').style.display = 'none';
      });
      document.getElementById('pc-tab-save').addEventListener('click', () => this.renderMenu('save'));
      document.getElementById('pc-tab-load').addEventListener('click', () => this.renderMenu('load'));
      document.getElementById('pc-btn-fullscreen').addEventListener('click', () => {
        document.getElementById('pointclick-menu-overlay').style.display = 'none';
        const fsEl = document.getElementById('pointclick-fs-root') || document.documentElement;
        if (!document.fullscreenElement) {
          fsEl.requestFullscreen().catch(() => document.documentElement.requestFullscreen().catch(() => {}));
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
      document.getElementById('pc-btn-restart').addEventListener('click', () => {
        if (confirm('¿Seguro que quieres reiniciar? Todo el progreso no guardado se perderá.')) {
          document.getElementById('pointclick-menu-overlay').style.display = 'none';
          this.currentSequence = null;
          this.currentHotspotId = null;
          this.jumpedViaChoice = false;
          this.inventory = [];
          this.missions = [];
          this.hotspotStates = {};
          this._showStartScreen();
        }
      });
    }

    this._showStartScreen();
  },

  // ── SAVE SYSTEM ─────────────────────────────────────────────────────────────

  getSaves() {
    try {
      const data = localStorage.getItem('eduplay_save_pc_' + this.act.id);
      return data ? JSON.parse(data) : {};
    } catch (e) { return {}; }
  },

  setSave(slot, stateObj) {
    const saves = this.getSaves();
    const sceneName = this.scenes.find(s => s.id === stateObj.sceneId)?.name || 'Escena';
    saves[slot] = { time: Date.now(), data: stateObj, preview: sceneName };
    localStorage.setItem('eduplay_save_pc_' + this.act.id, JSON.stringify(saves));
  },

  performAutoSave() {
    this.setSave(0, this.getCurrentState());
  },

  getCurrentState() {
    return {
      sceneId: this.currentSceneId,
      inDialog: !!this.currentSequence,
      hotspotId: this.currentHotspotId,
      sequenceIdx: this.currentSequenceIdx,
      history: this.dialogHistory || [],
      jumpedViaChoice: this.jumpedViaChoice || false,
      inventory: this.inventory || [],
      missions: this.missions || [],
      hotspotStates: this.hotspotStates || {}
    };
  },

  loadSave(slot) {
    const saves = this.getSaves();
    const save = saves[slot];
    if (!save || !save.data) return;

    const overlay = document.getElementById('pointclick-menu-overlay');
    if (overlay) overlay.style.display = 'none';

    // Remember if we were in fullscreen before re-rendering
    const wasFullscreen = !!document.fullscreenElement;

    const state = save.data;
    this.currentSceneId = state.sceneId;
    this.currentSequence = null;
    this.jumpedViaChoice = state.jumpedViaChoice || false;
    this.inventory = state.inventory || [];
    this.missions = state.missions || [];
    this.hotspotStates = state.hotspotStates || {};

    this.renderScene(state.sceneId, false);

    // Restore fullscreen on the new fs-root element
    if (wasFullscreen) {
      const newFsRoot = document.getElementById('pointclick-fs-root');
      if (newFsRoot) newFsRoot.requestFullscreen().catch(() => {});
    }

    if (state.inDialog && state.hotspotId) {
      const scene = this.scenes.find(s => s.id === state.sceneId);
      const hs = scene?.hotspots.find(h => h.id === state.hotspotId);
      if (hs) {
        const el = document.querySelector(`.pointclick-hotspot[data-id="${hs.id}"]`);
        this.currentSequence = hs.sequence || [{ text: hs.content || '', speaker: '', image: hs.image || null }];
        this.currentSequenceIdx = state.sequenceIdx || 0;
        this.dialogHistory = state.history || [];
        this.currentHotspotId = hs.id;
        this.currentHotspotElement = el;
        this.originalHotspotImage = hs.image || null;
        this.renderDialogStep();
      }
    }
  },

  renderMenu(mode) {
    const container = document.getElementById('pc-slots-container');
    const tabSave = document.getElementById('pc-tab-save');
    const tabLoad = document.getElementById('pc-tab-load');

    tabSave.style.color = mode === 'save' ? '#ff6b9e' : 'var(--text-primary)';
    tabSave.style.fontWeight = mode === 'save' ? 'bold' : 'normal';
    tabLoad.style.color = mode === 'load' ? '#ff6b9e' : 'var(--text-primary)';
    tabLoad.style.fontWeight = mode === 'load' ? 'bold' : 'normal';

    const saves = this.getSaves();
    let html = '';

    if (mode === 'load') {
      html += this._slotHTML(0, '🔄 Autoguardado', saves[0], mode);
    }
    for (let i = 1; i <= 8; i++) {
      html += this._slotHTML(i, `Ranura ${i}`, saves[i], mode);
    }

    container.innerHTML = html;

    container.querySelectorAll('.pc-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = parseInt(btn.dataset.slot);
        if (mode === 'save') {
          App.playSound('pop');
          this.setSave(slot, this.getCurrentState());
          this.renderMenu('save');
        } else {
          if (saves[slot] && saves[slot].data) {
            App.playSound('flip');
            this.loadSave(slot);
          }
        }
      });
    });
  },

  _slotHTML(slot, title, saveObj, mode) {
    const isEmpty = !saveObj || !saveObj.data;
    const timeStr = isEmpty ? '—' : new Date(saveObj.time).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
    const preview = isEmpty ? 'Vacío' : saveObj.preview;
    const isDisabled = mode === 'load' && isEmpty;
    const cursor = isDisabled ? 'cursor:not-allowed; opacity:0.5;' : 'cursor:pointer;';
    const cls = (!isDisabled) ? 'class="pc-slot-btn"' : '';

    return `
      <div ${cls} data-slot="${slot}"
           style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--bg-surface); ${cursor} transition:all 0.2s; gap:10px;">
        <div>
          <div style="font-weight:600; color:var(--text-primary); margin-bottom:3px;">${title}</div>
          <div style="font-size:0.82rem; color:var(--text-muted);">${preview}</div>
        </div>
        <div style="font-size:0.78rem; color:var(--text-muted); text-align:right; white-space:nowrap;">${timeStr}</div>
      </div>
    `;
  },

  // ── SCENE RENDERING ──────────────────────────────────────────────────────────

  renderScene(sceneId, doAutosave = true) {
    if (sceneId && sceneId.startsWith('end:')) {
      const type = sceneId.split(':')[1];
      this._showEndScreen(type);
      return;
    }

    this.currentSceneId = sceneId;
    if (doAutosave) this.performAutoSave();

    const scene = this.scenes.find(s => s.id === sceneId);
    if (!scene) {
      this.container.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--error)">Error: Escena no encontrada.</div>';
      return;
    }

    // Trigger mission changes on scene entry
    if (scene.activatesMission) this._activateMission(scene.activatesMission);
    if (scene.completesMission) this._completeMission(scene.completesMission);

    // Rescue menu overlay before innerHTML wipes the DOM
    const menuOverlay = document.getElementById('pointclick-menu-overlay');
    if (menuOverlay) document.body.appendChild(menuOverlay);

    this.container.innerHTML = `
      <div id="pointclick-fs-root" style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; max-width:900px; margin:0 auto; background:#000; border-radius:var(--r-lg);">

        <!-- 16:9 Scene -->
        <div class="pointclick-wrapper" style="position:relative; width:100%; aspect-ratio:16/9; background:#000; overflow:hidden; border-radius:var(--r-lg); box-shadow:var(--sh-lg); border:1px solid var(--border);">
          <img src="${scene.bgImage}" style="width:100%; height:100%; object-fit:contain; pointer-events:none; animation:fadeIn 0.4s ease;">

          <!-- Hotspots -->
          ${(scene.hotspots || []).map(hs => {
            const state = this.hotspotStates[hs.id];
            const activeHs = (state && hs.states && hs.states[state]) ? { ...hs, ...hs.states[state] } : hs;
            if (activeHs.hidden) return '';
            return `
              <div class="pointclick-hotspot" data-id="${hs.id}"
                   style="position:absolute; left:${activeHs.x !== undefined ? activeHs.x : hs.x}%; top:${activeHs.y !== undefined ? activeHs.y : hs.y}%; width:${activeHs.width !== undefined ? activeHs.width : hs.width}%; height:${activeHs.height !== undefined ? activeHs.height : hs.height}%; cursor:pointer; background:transparent;">
                ${activeHs.image ? `<img src="${activeHs.image}" class="pointclick-hs-img" style="width:100%; height:100%; object-fit:contain; pointer-events:none; transition:filter 0.2s;">` : ''}
              </div>
            `;
          }).join('')}

          <!-- Menu button (always visible, top-right) -->
          <button id="pointclick-scene-menu" style="position:absolute; top:8px; right:8px; z-index:20; background:rgba(0,0,0,0.5); color:#fff; border:1.5px solid rgba(255,255,255,0.3); border-radius:8px; padding:4px 10px; font-size:0.7rem; font-weight:600; cursor:pointer; backdrop-filter:blur(4px); letter-spacing:0.04em; transition:background 0.2s;">
            ☰ MENÚ
          </button>

          <!-- Choices overlay: floats centered over the scene, no background blur -->
          <div id="pointclick-choices-overlay" style="position:absolute; inset:0; display:none; align-items:center; justify-content:center; z-index:25; pointer-events:none;">
            <div id="pointclick-choices-box" style="background:rgba(10,8,20,0.92); border:2px solid #ff6b9e; border-radius:14px; padding:14px 18px; display:flex; flex-direction:column; gap:8px; max-width:65%; backdrop-filter:blur(10px); box-shadow:0 8px 32px rgba(0,0,0,0.5); pointer-events:all;">
            </div>
          </div>

          <!-- Dialog overlay — fixed height at the bottom -->
          <div id="pointclick-dialog-wrapper" style="position:absolute; bottom:0; left:0; right:0; height:28%; padding:5px 8px 6px; display:none; animation:fadeIn 0.2s ease; box-sizing:border-box;">
            <div style="width:100%; height:100%; background:rgba(10,8,20,0.82); backdrop-filter:blur(6px); color:#f0eeff; padding:8px 12px 7px 12px; border-radius:10px; border:2px solid #ff6b9e; font-size:0.82rem; box-shadow:0 4px 20px rgba(0,0,0,0.45); display:flex; flex-direction:column; gap:4px; overflow:hidden; box-sizing:border-box;">
              <!-- Speaker name badge -->
              <div id="pointclick-dialog-speaker-box" style="display:none; flex-shrink:0;">
                <span id="pointclick-dialog-speaker" style="background:linear-gradient(135deg,#ff6b9e,#ff8db3); color:#fff; padding:2px 10px; border-radius:10px; font-weight:700; font-size:0.72rem; display:inline-block; letter-spacing:0.04em;"></span>
              </div>
              <!-- Text: paginated -->
              <div id="pointclick-dialog-text" style="flex:1; overflow:hidden; line-height:1.55;"></div>
              <!-- Actions -->
              <div id="pointclick-dialog-actions" style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-shrink:0;">
                <button id="pointclick-dialog-back" style="display:none; background:transparent; border:1.5px solid #ff6b9e; color:#ff6b9e; border-radius:14px; padding:3px 10px; font-weight:600; font-size:0.72rem; cursor:pointer;">◀ Volver</button>
                <div style="flex:1;"></div>
                <button id="pointclick-dialog-next" style="background:linear-gradient(135deg,#ff6b9e,#ff8db3); color:#fff; border:none; border-radius:14px; padding:4px 14px; font-weight:700; font-size:0.78rem; box-shadow:0 2px 8px rgba(255,107,158,0.5); cursor:pointer;">Siguiente ▶</button>
                <button id="pointclick-dialog-close" style="display:none; background:rgba(255,255,255,0.12); color:#ccc; border:1px solid rgba(255,255,255,0.2); border-radius:14px; padding:4px 12px; font-weight:600; font-size:0.78rem; cursor:pointer;">Cerrar ✕</button>
              </div>
            </div>
          </div>

          <!-- Inventory button: above left corner of dialog box -->
          <button id="pointclick-inventory-btn" style="position:absolute; bottom:calc(28% + 5px); left:8px; z-index:26; background:rgba(10,8,20,0.8); border:2px solid #ff6b9e; border-radius:50%; width:30px; height:30px; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); transition:transform 0.15s; line-height:1;" title="Inventario">🎒</button>

          <!-- Inventory panel: popup above the button -->
          <div id="pointclick-inventory-panel" style="position:absolute; bottom:calc(28% + 40px); left:8px; z-index:27; background:rgba(10,8,20,0.95); border:2px solid #ff6b9e; border-radius:12px; padding:10px 12px; min-width:170px; max-width:230px; display:none; backdrop-filter:blur(10px); box-shadow:0 4px 20px rgba(0,0,0,0.5);">
            <div style="font-size:0.7rem; font-weight:700; color:#ff6b9e; margin-bottom:7px; letter-spacing:0.06em;">🎒 INVENTARIO</div>
            <div id="pointclick-inventory-items"></div>
          </div>

          <!-- Missions button: above inventory button -->
          <button id="pointclick-missions-btn" style="position:absolute; bottom:calc(28% + 5px); left:46px; z-index:26; background:rgba(10,8,20,0.8); border:2px solid #ff6b9e; border-radius:50%; width:30px; height:30px; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); transition:transform 0.15s; line-height:1;" title="Misiones">📜</button>

          <!-- Missions panel: popup above the button -->
          <div id="pointclick-missions-panel" style="position:absolute; bottom:calc(28% + 40px); left:46px; z-index:27; background:rgba(10,8,20,0.95); border:2px solid #ff6b9e; border-radius:12px; padding:10px 12px; min-width:200px; max-width:280px; display:none; backdrop-filter:blur(10px); box-shadow:0 4px 20px rgba(0,0,0,0.5);">
            <div style="font-size:0.7rem; font-weight:700; color:#ff6b9e; margin-bottom:7px; letter-spacing:0.06em;">📜 MISIONES</div>
            <div id="pointclick-missions-list"></div>
          </div>

        </div>
      </div>
    `;

    // Move menu overlay into fs-root so it's visible in fullscreen
    const fsRoot = document.getElementById('pointclick-fs-root');
    if (menuOverlay && fsRoot) {
      menuOverlay.style.position = 'absolute';
      menuOverlay.style.borderRadius = 'inherit';
      fsRoot.style.position = 'relative';
      fsRoot.appendChild(menuOverlay);
    }

    // Hotspot hover + click
    this.container.querySelectorAll('.pointclick-hotspot').forEach(el => {
      const img = el.querySelector('.pointclick-hs-img');
      el.addEventListener('mouseenter', () => {
        if (img) img.style.filter = 'drop-shadow(0px 0px 8px rgba(255,255,255,0.9))';
        else el.style.outline = '2px solid rgba(255,255,255,0.3)';
      });
      el.addEventListener('mouseleave', () => {
        if (img) img.style.filter = 'none';
        else el.style.outline = 'none';
      });
      el.addEventListener('click', () => {
        const hs = scene.hotspots.find(h => h.id === el.dataset.id);
        if (!hs) return;
        // Check if item is required
        if (hs.requiresItem) {
          if (!this._hasItem(hs.requiresItem)) {
            const def = this._findItemDef(hs.requiresItem);
            const name = def ? def.name : 'un objeto necesario';
            this._showNeedItemMsg(name);
            return;
          }
          if (hs.consumesItem) this._removeItem(hs.requiresItem);
        }

        // Apply state overrides for logic
        const state = this.hotspotStates[hs.id];
        const activeHs = (state && hs.states && hs.states[state]) ? { ...hs, ...hs.states[state] } : hs;

        // Permanent State Change
        if (activeHs.setState) {
          this.hotspotStates[hs.id] = activeHs.setState;
          this.renderScene(this.currentSceneId); // Re-render to show changes
          return; // Stop here if it's just a state change? Usually state changes also trigger message/nav
        }

        // Mission triggers
        if (activeHs.activatesMission) this._activateMission(activeHs.activatesMission);
        if (activeHs.completesMission) this._completeMission(activeHs.completesMission);

        if (activeHs.type === 'message') {
          this.startDialogSequence(activeHs, el);
        } else if (activeHs.type === 'navigate') {
          let target = activeHs.targetSceneId;
          if (target && target.startsWith('scene:')) target = target.split(':')[1];
          App.playSound('flip');
          this.renderScene(target);
        } else if (activeHs.type === 'ending') {
          App.playSound('mission');
          this._showEndScreen(activeHs.endType || 'neutral', null, activeHs.endMsg);
        }
      });
    });

    // Scene menu button (always visible)
    document.getElementById('pointclick-scene-menu')?.addEventListener('click', () => {
      App.playSound('pop');
      document.getElementById('pointclick-menu-overlay').style.display = 'flex';
      this.renderMenu('save');
    });

    // Close dialog button
    document.getElementById('pointclick-dialog-close')?.addEventListener('click', () => {
      App.playSound('pop');
      document.getElementById('pointclick-dialog-wrapper').style.display = 'none';
      document.getElementById('pointclick-choices-overlay').style.display = 'none';
      this.currentSequence = null;
      this.currentHotspotId = null;
      this.jumpedViaChoice = false;
      this._overflowText = null;
      if (this.typewriterInterval) clearInterval(this.typewriterInterval);
      if (this.currentHotspotElement && this.originalHotspotImage !== undefined) {
        const hsImg = this.currentHotspotElement.querySelector('.pointclick-hs-img');
        if (hsImg) { if (this.originalHotspotImage) hsImg.src = this.originalHotspotImage; else hsImg.remove(); }
      }
      this.performAutoSave();
    });

    // Inventory button toggle
    document.getElementById('pointclick-inventory-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById('pointclick-inventory-panel');
      if (!panel) return;
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) this._renderInventoryPanel();
    });
    // Click anywhere on scene (not the panel/btn) closes it
    document.querySelector('.pointclick-wrapper')?.addEventListener('click', (e) => {
      if (!e.target.closest('#pointclick-inventory-panel') && !e.target.closest('#pointclick-inventory-btn')) {
        const panel = document.getElementById('pointclick-inventory-panel');
        if (panel) panel.style.display = 'none';
      }
    });

    // Missions button toggle
    document.getElementById('pointclick-missions-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById('pointclick-missions-panel');
      if (!panel) return;
      const isOpen = panel.style.display !== 'none';
      panel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) this._renderMissionsPanel();
    });
    // Click anywhere on scene (not the panel/btn) closes it
    document.querySelector('.pointclick-wrapper')?.addEventListener('click', (e) => {
      if (!e.target.closest('#pointclick-missions-panel') && !e.target.closest('#pointclick-missions-btn')) {
        const panel = document.getElementById('pointclick-missions-panel');
        if (panel) panel.style.display = 'none';
      }
    });

    this._renderInventoryPanel();
    this._renderMissionsPanel();
  },

  // ── DIALOG ───────────────────────────────────────────────────────────────────

  startDialogSequence(hs, hotspotElement) {
    App.playSound('pop');

    // Give item if defined and not already in inventory
    if (hs.givesItem && hs.givesItem.id && !this._hasItem(hs.givesItem.id)) {
      this._addItem(hs.givesItem);
    }

    if (!hs.sequence) {
      hs.sequence = [{ text: hs.content || '', speaker: '', image: hs.image || null }];
    }

    this.currentSequence = hs.sequence;
    this.currentSequenceIdx = 0;
    this.dialogHistory = [];
    this.currentHotspotId = hs.id;
    this.currentHotspotElement = hotspotElement;
    this.originalHotspotImage = hs.image || null;
    this.jumpedViaChoice = false;
    this._overflowText = null;

    if (this.typewriterInterval) clearInterval(this.typewriterInterval);

    this.performAutoSave();
    this.renderDialogStep();
  },

  _paginateText(textEl, str) {
    textEl.innerHTML = App.esc(str).replace(/\\n/g, '<br>');
    if (textEl.scrollHeight <= textEl.clientHeight + 2) return [str, null];
    let lo = 0, hi = str.length;
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      textEl.innerHTML = App.esc(str.substring(0, mid)).replace(/\\n/g, '<br>');
      if (textEl.scrollHeight > textEl.clientHeight + 2) hi = mid;
      else lo = mid;
    }
    let cut = lo;
    while (cut > 0 && str[cut] !== ' ' && str[cut] !== '\n') cut--;
    if (cut === 0) cut = lo;
    textEl.innerHTML = App.esc(str.substring(0, cut)).replace(/\\n/g, '<br>');
    return [str.substring(0, cut).trimEnd(), str.substring(cut).trimStart()];
  },

  renderDialogStep() {
    const wrapper = document.getElementById('pointclick-dialog-wrapper');
    const speakerBox = document.getElementById('pointclick-dialog-speaker-box');
    const speakerEl = document.getElementById('pointclick-dialog-speaker');
    const textEl = document.getElementById('pointclick-dialog-text');
    const btnNext = document.getElementById('pointclick-dialog-next');
    const btnClose = document.getElementById('pointclick-dialog-close');
    const btnBack = document.getElementById('pointclick-dialog-back');
    const choicesContainer = document.getElementById('pointclick-dialog-choices');

    const step = this.currentSequence[this.currentSequenceIdx];

    // Trigger missions for this specific message
    if (step.activatesMission) this._activateMission(step.activatesMission);
    if (step.completesMission) this._completeMission(step.completesMission);

    const wasJumped = this.jumpedViaChoice;
    this.jumpedViaChoice = false;

    // Speaker name badge
    if (step.speaker) {
      speakerEl.textContent = step.speaker;
      speakerBox.style.display = 'block';
    } else {
      speakerBox.style.display = 'none';
    }

    // Update character sprite on the hotspot in the SCENE (not in dialog)
    if (this.currentHotspotElement) {
      let hsImg = this.currentHotspotElement.querySelector('.pointclick-hs-img');
      if (step.image) {
        if (!hsImg) {
          hsImg = document.createElement('img');
          hsImg.className = 'pointclick-hs-img';
          hsImg.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;transition:opacity 0.2s;';
          this.currentHotspotElement.appendChild(hsImg);
        }
        hsImg.src = step.image;
      } else if (hsImg) {
        hsImg.src = this.originalHotspotImage || '';
      }
    }

    // Determine display text: continuation page or fresh step
    const isContinuation = !!this._overflowText;
    const displayStr = isContinuation ? this._overflowText : (step.text || '');
    this._overflowText = null;

    // Typewriter effect
    if (this.typewriterInterval) clearInterval(this.typewriterInterval);
    textEl.innerHTML = '';
    this.isTyping = true;
    let charIdx = 0;

    this.typewriterInterval = setInterval(() => {
      if (charIdx >= displayStr.length) {
        clearInterval(this.typewriterInterval);
        this.isTyping = false;
        textEl.innerHTML = App.esc(displayStr).replace(/\\n/g, '<br>');
        return;
      }
      const char = displayStr[charIdx++];
      textEl.innerHTML = App.esc(displayStr.substring(0, charIdx)).replace(/\\n/g, '<br>');
      if (textEl.scrollHeight > textEl.clientHeight + 2) {
        // Overflow detected — find word boundary and store rest
        clearInterval(this.typewriterInterval);
        this.isTyping = false;
        let cut = charIdx - 1;
        while (cut > 0 && displayStr[cut] !== ' ' && displayStr[cut] !== '\n') cut--;
        if (cut === 0) cut = charIdx - 1;
        textEl.innerHTML = App.esc(displayStr.substring(0, cut)).replace(/\\n/g, '<br>');
        this._overflowText = displayStr.substring(cut).trimStart();
        return;
      }
      if (charIdx % 3 === 0 && char.trim() !== '') App.playSound('pop');
    }, 30);

    wrapper.style.display = 'flex';
    const hasChoices = !isContinuation && step.choices && step.choices.length > 0;
    const isLast = !isContinuation &&
                   ((this.currentSequenceIdx >= this.currentSequence.length - 1) ||
                    (wasJumped && !hasChoices));

    // Back button
    const newBtnBack = btnBack.cloneNode(true);
    btnBack.parentNode.replaceChild(newBtnBack, btnBack);
    if (this.dialogHistory.length > 0) {
      newBtnBack.style.display = 'inline-block';
      newBtnBack.addEventListener('click', () => {
        App.playSound('pop');
        this._overflowText = null;
        this.currentSequenceIdx = this.dialogHistory.pop();
        this.renderDialogStep();
      });
    } else {
      newBtnBack.style.display = 'none';
    }

    const newBtnNext = btnNext.cloneNode(true);
    btnNext.parentNode.replaceChild(newBtnNext, btnNext);

    // Skip typing to end (handles overflow detection too)
    const skipTyping = () => {
      if (!this.isTyping) return;
      clearInterval(this.typewriterInterval);
      this.isTyping = false;
      // Write full displayStr checking overflow
      textEl.innerHTML = App.esc(displayStr).replace(/\\n/g, '<br>');
      if (textEl.scrollHeight > textEl.clientHeight + 2) {
        let lo = 0, hi = displayStr.length;
        while (lo < hi - 1) {
          const mid = Math.floor((lo + hi) / 2);
          textEl.innerHTML = App.esc(displayStr.substring(0, mid)).replace(/\\n/g, '<br>');
          if (textEl.scrollHeight > textEl.clientHeight + 2) hi = mid;
          else lo = mid;
        }
        let cut = lo;
        while (cut > 0 && displayStr[cut] !== ' ' && displayStr[cut] !== '\n') cut--;
        if (cut === 0) cut = lo;
        textEl.innerHTML = App.esc(displayStr.substring(0, cut)).replace(/\\n/g, '<br>');
        this._overflowText = displayStr.substring(cut).trimStart();
      }
    };

    // Single interval to update button state when typing/overflow resolves
    const checkDone = setInterval(() => {
      if (this.isTyping) return;
      clearInterval(checkDone);

      if (this._overflowText) {
        newBtnNext.textContent = 'Continuar ▶';
        newBtnNext.style.display = 'inline-block';
        btnClose.style.display = 'none';
        newBtnNext.onclick = () => { App.playSound('pop'); this.renderDialogStep(); };
      } else if (hasChoices) {
        // Show floating choices overlay above scene
        newBtnNext.style.display = 'none';
        btnClose.style.display = 'none';
        const choicesOverlay = document.getElementById('pointclick-choices-overlay');
        const choicesBox = document.getElementById('pointclick-choices-box');
        if (choicesOverlay && choicesBox) {
          choicesOverlay.style.display = 'flex';
          choicesBox.innerHTML = step.choices.map(c => {
            const hasReq = !c.requiresItem || this._hasItem(c.requiresItem);
            const style = hasReq 
              ? "border:1.5px solid #ff6b9e; color:#ff6b9e; background:rgba(255,107,158,0.08); cursor:pointer;" 
              : "border:1.5px solid #444; color:#666; background:rgba(50,50,50,0.5); cursor:not-allowed; opacity:0.7;";
            
            return `
              <button class="pointclick-choice-btn" data-target="${c.targetSceneId}" ${!hasReq ? 'disabled' : ''}
                      data-req="${c.requiresItem || ''}"
                      style="border-radius:10px; font-weight:600; font-size:0.85rem; padding:8px 16px; transition:all 0.15s; text-align:left; white-space:nowrap; ${style}">
                ${App.esc(c.text)}
                ${(!hasReq && c.requiresItem) ? ` <span style="font-size:0.7rem; opacity:0.8;">(🔒 ${this._findItemDef(c.requiresItem)?.name || 'Objeto'})</span>` : ''}
              </button>
            `;
          }).join('');
          choicesBox.querySelectorAll('.pointclick-choice-btn').forEach((btn, ci) => {
            if (btn.disabled) return;
            const c = step.choices[ci];

            btn.addEventListener('mouseenter', () => { btn.style.background = '#ff6b9e'; btn.style.color = '#fff'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,107,158,0.08)'; btn.style.color = '#ff6b9e'; });
            btn.addEventListener('click', () => {
              App.playSound('flip');
              choicesOverlay.style.display = 'none';

              // Consumir item si es requerido y está marcado como consumible
              if (c.requiresItem && c.consumesItem) {
                this._removeItem(c.requiresItem);
              }

              // Trigger missions for this choice
              if (c.activatesMission) this._activateMission(c.activatesMission);
              if (c.completesMission) this._completeMission(c.completesMission);

              let target = btn.dataset.target;
              if (target.startsWith('end:')) {
                const type = target.split(':')[1];
                document.getElementById('pointclick-dialog-wrapper').style.display = 'none';
                choicesOverlay.style.display = 'none';
                this._showEndScreen(type);
                return;
              }

              if (target.startsWith('msg:')) {
                const tgtId = target.split(':')[1];
                const nextIdx = this.currentSequence.findIndex(m => m.id === tgtId);
                if (nextIdx !== -1) {
                  this.dialogHistory.push(this.currentSequenceIdx);
                  this.currentSequenceIdx = nextIdx;
                  this.jumpedViaChoice = true;
                  this._overflowText = null;
                  this.performAutoSave();
                  this.renderDialogStep();
                }
              } else {
                if (target.startsWith('scene:')) target = target.split(':')[1];
                document.getElementById('pointclick-dialog-wrapper').style.display = 'none';
                this.currentSequence = null;
                this.jumpedViaChoice = false;
                this._overflowText = null;
                this.renderScene(target);
              }
            });
          });
        }
      } else if (step.nextSceneId) {
        newBtnNext.textContent = 'Continuar ▶';
        newBtnNext.style.display = 'inline-block';
        btnClose.style.display = 'none';
        newBtnNext.onclick = () => {
          App.playSound('flip');
          document.getElementById('pointclick-dialog-wrapper').style.display = 'none';
          this.currentSequence = null;
          this.jumpedViaChoice = false;
          this._overflowText = null;
          this.renderScene(step.nextSceneId);
        };
      } else if (!isLast) {
        newBtnNext.textContent = 'Siguiente ▶';
        newBtnNext.style.display = 'inline-block';
        btnClose.style.display = 'none';
        newBtnNext.onclick = () => {
          App.playSound('pop');
          this.dialogHistory.push(this.currentSequenceIdx);
          this.currentSequenceIdx++;
          this.performAutoSave();
          this.renderDialogStep();
        };
      } else {
        newBtnNext.style.display = 'none';
        btnClose.style.display = 'inline-block';
      }
    }, 50);

    // During typing, "Siguiente" skips animation
    newBtnNext.style.display = 'inline-block';
    newBtnNext.textContent = 'Siguiente ▶';
    btnClose.style.display = 'none';
    newBtnNext.onclick = skipTyping;

    wrapper.onclick = (e) => {
      if (e.target.closest('button')) return;
      skipTyping();
    };
  },

  // ── START SCREEN ─────────────────────────────────────────────────────────────

  _showStartScreen() {
    const saves = this.getSaves();
    const hasAutoSave = saves[0] && saves[0].data;
    const bgImg = this.scenes[0]?.bgImage || '';
    const title = this.act.title || 'Aventura';

    // Rescue menu overlay before wiping container
    const menuOverlay = document.getElementById('pointclick-menu-overlay');
    if (menuOverlay) document.body.appendChild(menuOverlay);

    this.container.innerHTML = `
      <div id="pointclick-fs-root" style="position:relative; display:flex; align-items:center; justify-content:center; width:100%; max-width:900px; margin:0 auto; border-radius:var(--r-lg); overflow:hidden; aspect-ratio:16/9; background:#000;">
        <img src="${bgImg}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:brightness(0.4); pointer-events:none;">
        <div style="position:relative; z-index:2; text-align:center; padding:30px; display:flex; flex-direction:column; align-items:center; gap:18px;">
          <div style="font-size:0.8rem; letter-spacing:0.2em; color:#ff8db3; text-transform:uppercase; font-weight:600;">Novela Visual</div>
          <h1 style="margin:0; font-size:clamp(1.4rem,4vw,2.4rem); color:#fff; text-shadow:0 2px 20px rgba(255,107,158,0.6); font-family:var(--font-display); line-height:1.2;">${App.esc(title)}</h1>
          <div style="width:60px; height:2px; background:linear-gradient(90deg,transparent,#ff6b9e,transparent);"></div>
          <button id="pc-start-new" style="background:linear-gradient(135deg,#ff6b9e,#ff8db3); color:#fff; border:none; border-radius:20px; padding:10px 32px; font-size:1rem; font-weight:700; cursor:pointer; box-shadow:0 4px 20px rgba(255,107,158,0.5); letter-spacing:0.05em;">▶ Comenzar</button>
          ${hasAutoSave ? `<button id="pc-start-continue" style="background:rgba(255,255,255,0.1); color:#fff; border:1.5px solid rgba(255,107,158,0.5); border-radius:20px; padding:8px 24px; font-size:0.9rem; font-weight:600; cursor:pointer; backdrop-filter:blur(4px);">📂 Continuar partida</button>` : ''}
        </div>
      </div>
    `;

    const fsRoot = document.getElementById('pointclick-fs-root');
    if (menuOverlay && fsRoot) {
      menuOverlay.style.position = 'absolute';
      menuOverlay.style.borderRadius = 'inherit';
      fsRoot.appendChild(menuOverlay);
    }

    document.getElementById('pc-start-new')?.addEventListener('click', () => {
      this.inventory = [];
      this.missions = [];
      this.hotspotStates = {};
      this.renderScene(this.currentSceneId);
    });
    document.getElementById('pc-start-continue')?.addEventListener('click', () => {
      this.loadSave(0);
    });
  },

  // ── INVENTORY ────────────────────────────────────────────────────────────────

  _hasItem(id) { return this.inventory.some(i => i.id === id); },

  _addItem(item) {
    if (this._hasItem(item.id)) return;
    this.inventory.push(item);
    this._renderInventoryPanel();
    // Toast notification
    const toast = document.createElement('div');
    toast.textContent = `+  ${item.name}`;
    toast.style.cssText = 'position:absolute;bottom:calc(28% + 44px);left:48px;z-index:40;background:linear-gradient(135deg,#ff6b9e,#ff8db3);color:#fff;padding:4px 12px;border-radius:12px;font-size:0.75rem;font-weight:700;pointer-events:none;animation:fadeIn 0.2s ease;';
    const wrapper = document.querySelector('.pointclick-wrapper');
    if (wrapper) { wrapper.appendChild(toast); setTimeout(() => toast.remove(), 2000); }
    this.performAutoSave();
  },

  _removeItem(id) {
    this.inventory = this.inventory.filter(i => i.id !== id);
    this._renderInventoryPanel();
    this.performAutoSave();
  },

  _findItemDef(id) {
    for (const scene of this.scenes) {
      for (const hs of scene.hotspots || []) {
        if (hs.givesItem && hs.givesItem.id === id) return hs.givesItem;
      }
    }
    return null;
  },

  _renderInventoryPanel() {
    const panel = document.getElementById('pointclick-inventory-panel');
    const itemsEl = document.getElementById('pointclick-inventory-items');
    if (!panel || !itemsEl) return;
    if (!this.inventory.length) {
      itemsEl.innerHTML = '<div style="font-size:0.78rem;color:rgba(255,255,255,0.4);text-align:center;padding:6px 0;">Inventario vacío</div>';
      return;
    }
    itemsEl.innerHTML = this.inventory.map(item => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,107,158,0.2);">
        ${item.icon ? `<img src="${item.icon}" style="width:24px;height:24px;object-fit:contain;border-radius:4px;">` : '<span style="font-size:1.1rem;">📦</span>'}
        <span style="flex:1;font-size:0.8rem;color:#f0eeff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${App.esc(item.name)}">${App.esc(item.name)}</span>
        ${item.droppable ? `<button class="pc-inv-drop" data-id="${item.id}" style="background:transparent;border:1px solid rgba(255,100,100,0.5);color:rgba(255,120,120,0.8);border-radius:6px;padding:2px 6px;font-size:0.68rem;cursor:pointer;flex-shrink:0;" title="Tirar objeto">Tirar</button>` : ''}
      </div>
    `).join('');
    itemsEl.querySelectorAll('.pc-inv-drop').forEach(btn => {
      btn.addEventListener('click', () => { this._removeItem(btn.dataset.id); });
    });
  },

  _showNeedItemMsg(itemName) {
    App.playSound('pop');
    const wrapper = document.querySelector('.pointclick-wrapper');
    if (!wrapper) return;
    const msg = document.createElement('div');
    msg.textContent = `Necesitas: ${itemName}`;
    msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:40;background:rgba(10,8,20,0.92);color:#ff8db3;border:2px solid #ff6b9e;border-radius:12px;padding:10px 22px;font-size:0.85rem;font-weight:700;pointer-events:none;animation:fadeIn 0.2s ease;white-space:nowrap;';
    wrapper.appendChild(msg);
    setTimeout(() => msg.remove(), 2200);
  },

  // ── MISSIONS ─────────────────────────────────────────────────────────────────

  _activateMission(mission) {
    // mission can be an ID (from existing data) or a full object {id, name, description}
    let mObj = typeof mission === 'string' ? (this.act.data.missions || []).find(m => m.id === mission) : mission;
    if (!mObj) return;
    if (this.missions.some(m => m.id === mObj.id)) return;
    
    this.missions.push({ ...mObj, status: 'active' });
    this._showMissionToast(`Nueva misión: ${mObj.name}`);
    this._renderMissionsPanel();
    this.performAutoSave();
  },

  _completeMission(missionId) {
    const m = this.missions.find(m => m.id === missionId);
    if (!m || m.status === 'completed') return;
    m.status = 'completed';
    this._showMissionToast(`¡Misión completada: ${m.name}!`);
    this._renderMissionsPanel();
    this.performAutoSave();
  },

  _showMissionToast(text) {
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);z-index:40;background:linear-gradient(135deg,#ff6b9e,#ff8db3);color:#fff;padding:8px 20px;border-radius:20px;font-size:0.85rem;font-weight:700;pointer-events:none;animation:fadeIn 0.2s ease;box-shadow:0 4px 15px rgba(0,0,0,0.3);';
    const wrapper = document.querySelector('.pointclick-wrapper');
    if (wrapper) { wrapper.appendChild(toast); setTimeout(() => toast.remove(), 3000); }
  },

  _renderMissionsPanel() {
    const panel = document.getElementById('pointclick-missions-panel');
    const listEl = document.getElementById('pointclick-missions-list');
    if (!panel || !listEl) return;
    if (!this.missions.length) {
      listEl.innerHTML = '<div style="font-size:0.78rem;color:rgba(255,255,255,0.4);text-align:center;padding:10px 0;">No hay misiones activas</div>';
      return;
    }
    listEl.innerHTML = this.missions.map(m => `
      <div style="padding:8px 0; border-bottom:1px solid rgba(255,107,158,0.2); opacity: ${m.status === 'completed' ? '0.6' : '1'}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <span style="font-size:0.8rem; font-weight:700; color:${m.status === 'completed' ? '#888' : '#f0eeff'}">${App.esc(m.name)}</span>
          ${m.status === 'completed' ? '<span style="color:#4ade80; font-size:0.7rem;">✓</span>' : ''}
        </div>
        <div style="font-size:0.72rem; color:rgba(255,238,255,0.7); line-height:1.3;">${App.esc(m.description || '')}</div>
      </div>
    `).reverse().join('');
  }
};

const style = document.createElement('style');
style.innerHTML = `
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  .pc-slot-btn:hover {
    border-color: #ff6b9e !important;
    background: rgba(255,107,158,0.06) !important;
  }
  #pointclick-scene-menu:hover {
    background: rgba(255,107,158,0.6) !important;
    border-color: #ff6b9e !important;
  }
  /* Fullscreen: expand the game root to fill the screen */
  #pointclick-fs-root:fullscreen,
  #pointclick-fs-root:-webkit-full-screen,
  #pointclick-fs-root:-moz-full-screen,
  #pointclick-fs-root:-ms-fullscreen {
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  #pointclick-fs-root:fullscreen .pointclick-wrapper,
  #pointclick-fs-root:-webkit-full-screen .pointclick-wrapper,
  #pointclick-fs-root:-moz-full-screen .pointclick-wrapper,
  #pointclick-fs-root:-ms-fullscreen .pointclick-wrapper {
    width: min(100vw, calc(100vh * 16 / 9)) !important;
    border-radius: 0 !important;
    border: none !important;
  }
  /* Scrollbar style for dialog text */
  #pointclick-dialog-text::-webkit-scrollbar { width: 3px; }
  #pointclick-dialog-text::-webkit-scrollbar-track { background: transparent; }
  #pointclick-dialog-text::-webkit-scrollbar-thumb { background: rgba(255,107,158,0.5); border-radius: 3px; }
`;
document.head.appendChild(style);
