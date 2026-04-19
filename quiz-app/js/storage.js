/**
 * Bellestudia - Storage Layer (IndexedDB Version)
 * Persists all activities in a local database (no server needed)
 * Replaces localStorage to overcome 5MB limits.
 */
const Storage = {
  DB_NAME: 'BellestudiaDB',
  STORE_NAME: 'activities',
  VERSION: 1,

  _getDB() {
    return new Promise((resolve, reject) => {
      console.log('Opening IndexedDB: ', this.DB_NAME);
      const request = indexedDB.open(this.DB_NAME, this.VERSION);
      
      // Timeout de seguridad: si no abre en 5s, avisar
      const timeout = setTimeout(() => {
        console.error('IndexedDB open timeout');
        reject(new Error('Timeout opening database'));
      }, 5000);

      request.onupgradeneeded = (e) => {
        console.log('DB Upgrade needed...');
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => {
        clearTimeout(timeout);
        console.log('DB Success');
        resolve(request.result);
      };
      
      request.onerror = () => {
        clearTimeout(timeout);
        console.error('DB Error:', request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('DB Blocked: please close other tabs of this app');
      };
    });
  },

  /** Migrates data from old localStorage if present */
  async migrate() {
    const oldKey = 'eduplay_activities';
    const raw = localStorage.getItem(oldKey);
    if (raw) {
      try {
        const list = JSON.parse(raw);
        console.log(`Migrating ${list.length} activities to IndexedDB...`);
        for (const act of list) {
          await this.addActivity(act);
        }
        localStorage.removeItem(oldKey);
        console.log('Migration complete.');
      } catch (e) {
        console.error('Migration failed:', e);
      }
    }
  },

  async getActivities() {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        let list = request.result || [];
        if (list.length === 0) {
          // Fallback to preloaded or samples if truly empty
          this._initEmpty(resolve);
        } else {
          resolve(list);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async _initEmpty(resolve) {
    const initial = (typeof _BELLESTUDIA_PRELOADED !== 'undefined' && Array.isArray(_BELLESTUDIA_PRELOADED) && _BELLESTUDIA_PRELOADED.length)
      ? _BELLESTUDIA_PRELOADED
      : this._samples();
    for (const act of initial) {
      await this.addActivity(act);
    }
    resolve(initial);
  },

  async addActivity(activity) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.put(activity);
      request.onsuccess = () => resolve(activity);
      request.onerror = () => reject(request.error);
    });
  },

  async updateActivity(updated) {
    return this.addActivity(updated); // put handles both add and update
  },

  async deleteActivity(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getActivity(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /* ── Ejemplo inicial para que el dashboard no luzca vacío ── */
  _samples() {
    return [
      {
        id: 'sample-quiz-1',
        type: 'quiz',
        title: 'Quiz de Ejemplo: Capitales del Mundo',
        createdAt: Date.now() - 172800000,
        data: {
          questions: [
            { id: 'q1', text: '¿Cuál es la capital de Francia?', options: ['Londres','París','Madrid','Roma'], correct: 1 },
            { id: 'q2', text: '¿Cuál es la capital de Japón?', options: ['Seúl','Pekín','Tokio','Bangkok'], correct: 2 },
            { id: 'q3', text: '¿Cuál es la capital de Brasil?', options: ['São Paulo','Río de Janeiro','Brasilia','Salvador'], correct: 2 },
          ]
        }
      },
      {
        id: 'sample-tf-1',
        type: 'truefalse',
        title: 'Verdadero o Falso: Ciencias Naturales',
        createdAt: Date.now() - 86400000,
        data: {
          statements: [
            { id: 's1', text: 'El agua hierve a 100 °C al nivel del mar.', correct: true },
            { id: 's2', text: 'La Tierra es el planeta más grande del Sistema Solar.', correct: false },
            { id: 's3', text: 'Los murciélagos son mamíferos.', correct: true },
            { id: 's4', text: 'La Luna tiene atmósfera propia.', correct: false },
          ]
        }
      },
      {
        id: 'sample-match-1',
        type: 'matching',
        title: 'Conexión: Países y Capitales',
        createdAt: Date.now() - 43200000,
        data: {
          pairs: [
            { id: 'p1', left: 'Alemania', right: 'Berlín' },
            { id: 'p2', left: 'Italia',   right: 'Roma' },
            { id: 'p3', left: 'Egipto',   right: 'El Cairo' },
            { id: 'p4', left: 'México',   right: 'Ciudad de México' },
          ]
        }
      },
      {
        id: 'sample-mem-1',
        type: 'memory',
        title: 'Memoria: Vocabulario en Inglés',
        createdAt: Date.now() - 3600000,
        data: {
          pairs: [
            { id: 'm1', front: '🐕 Dog',   back: 'Perro' },
            { id: 'm2', front: '🐈 Cat',   back: 'Gato' },
            { id: 'm3', front: '🏠 House', back: 'Casa' },
            { id: 'm4', front: '📚 Book',  back: 'Libro' },
            { id: 'm5', front: '🌟 Star',  back: 'Estrella' },
            { id: 'm6', front: '🎵 Music', back: 'Música' },
          ]
        }
      }
    ];
  }
};
