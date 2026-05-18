/**
 * Bellestudia - Community Module (Firebase Integration)
 * Maneja la lectura y publicación de actividades públicas en Firestore.
 */

// Firebase está disponible de forma global gracias a los scripts en el index.html
// Configuración ofuscada para evitar scrapers de texto plano en el código fuente
const getFirebaseConfig = () => {
  const p = atob("YmVsbGFzdHVkaWEtZWZiOWM=");
  return {
    apiKey: atob("QUl6YVN5QWFYZ2NRYTBxdktXYW5yRGRIRS0zc1NQZWZvUm51cHRv"),
    authDomain: p + ".firebaseapp.com",
    projectId: p,
    storageBucket: p + ".firebasestorage.app",
    messagingSenderId: atob("NzM0MzU0ODIyOTgx"),
    appId: atob("MTo3MzQzNTQ4MjI5ODE6d2ViOmUwYjM1OWRlNWNhYmI5MzhiZDkwMmM=")
  };
};
const firebaseConfig = getFirebaseConfig();

let db = null;

const Community = {
  
  init() {
    if (typeof firebase === 'undefined') {
      console.warn("Firebase no está disponible (modo offline o error de red). La pestaña comunidad se ocultará.");
      document.getElementById('nav-btn-community')?.style.setProperty('display', 'none');
      return;
    }
    
    // Inicializar app de Firebase
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase Community Init ✅");
  },

  async publishActivity(activity, author, existingId = null) {
    if (!db) throw new Error("Firebase no está conectado.");
    
    try {
      const publicActivity = {
        title: activity.title,
        type: activity.type,
        subject: activity.subject || '',
        topic: activity.topic || '',
        publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
        originalId: activity.id 
      };

      if (author) {
        publicActivity.author = author;
      } else if (!existingId) {
        publicActivity.author = 'Anónimo';
      }

      // Permitir que la UI se actualice (muestre el Toast) antes de bloquear el hilo principal
      await new Promise(resolve => setTimeout(resolve, 50));

      // Comprimir imágenes base64 dentro de la actividad
      let activityDataCloned = JSON.parse(JSON.stringify(activity.data || {}));
      activityDataCloned = await this.compressImages(activityDataCloned);

      const rawData = JSON.stringify(activityDataCloned);
      const dataString = rawData;
      publicActivity.compressed = false;

      const chunkSize = 800000; 
      const chunks = [];
      for (let i = 0; i < dataString.length; i += chunkSize) {
        chunks.push(dataString.substring(i, i + chunkSize));
      }
      publicActivity.chunksCount = chunks.length;

      // 1. Guardar documento principal
      let docRef;
      if (existingId) {
        docRef = db.collection("community_activities").doc(existingId);
        await docRef.set(publicActivity, { merge: true });
      } else {
        docRef = await db.collection("community_activities").add(publicActivity);
      }

      // 2. Guardar los trozos concurrentemente
      const uploadPromises = [];
      for (let i = 0; i < chunks.length; i++) {
        uploadPromises.push(
          docRef.collection("chunks").doc(i.toString()).set({
            text: chunks[i]
          })
        );
      }
      await Promise.all(uploadPromises);

      return docRef.id;

    } catch (e) {
      console.error("Error al publicar:", e);
      throw new Error(`No se pudo publicar: ${e.message}`);
    }
  },


  async getRecentActivities(limit = 20) {
    if (!db) throw new Error("Firebase no está conectado.");

    try {
      // Ordenamos por los más recientes y limitamos. 
      // NOTA: Esto ahora solo descarga metadatos ligeros, ahorrando ancho de banda.
      const snapshot = await db.collection("community_activities")
                               .orderBy("publishedAt", "desc")
                               .limit(limit)
                               .get();

      const activities = [];
      snapshot.forEach(doc => {
        activities.push({ id: doc.id, ...doc.data() });
      });

      return activities;
    } catch (e) {
      console.error("Error al obtener comunidad:", e);
      throw new Error(`Error de descarga: ${e.message}`);
    }
  },

  async getActivity(id) {
    if (!db) throw new Error("Firebase no está conectado.");

    try {
      const doc = await db.collection("community_activities").doc(id).get();
      if (!doc.exists) throw new Error("La actividad no existe.");
      const act = { id: doc.id, ...doc.data() };

      // Si tiene 'data' directo, es una actividad antigua (retrocompatibilidad)
      if (act.data) return act;

      // Si no, reconstruimos la data uniendo los trozos de la subcolección
      let fullString = "";
      const downloadPromises = [];
      for (let i = 0; i < (act.chunksCount || 1); i++) {
        downloadPromises.push(doc.ref.collection("chunks").doc(i.toString()).get());
      }
      
      const chunkDocs = await Promise.all(downloadPromises);
      for (const chunkDoc of chunkDocs) {
        if (chunkDoc.exists) {
          fullString += chunkDoc.data().text;
        }
      }

      if (fullString) {
        act.data = JSON.parse(fullString);
      } else {
        act.data = {};
      }

      return act;
    } catch (e) {
      console.error("Error al obtener actividad:", e);
      throw new Error(`Error de descarga: ${e.message}`);
    }
  },

  async updateActivity(id, fields) {
    if (!db) throw new Error("Firebase no está conectado.");
    try {
      await db.collection("community_activities").doc(id).update(fields);
    } catch (e) {
      console.error("Error al actualizar actividad:", e);
      throw new Error(`No se pudo actualizar: ${e.message}`);
    }
  },

  async deleteActivity(id) {
    if (!db) throw new Error("Firebase no está conectado.");
    try {
      const docRef = db.collection("community_activities").doc(id);
      // Borrar todos los chunks de la subcolección primero
      const chunksSnap = await docRef.collection("chunks").get();
      const deleteChunks = chunksSnap.docs.map(d => d.ref.delete());
      await Promise.all(deleteChunks);
      // Borrar el documento principal
      await docRef.delete();
    } catch (e) {
      console.error("Error al eliminar actividad:", e);
      throw new Error(`No se pudo eliminar: ${e.message}`);
    }
  },

  async getAllActivities() {
    if (!db) throw new Error("Firebase no está conectado.");
    try {
      const snapshot = await db.collection("community_activities")
                               .orderBy("publishedAt", "desc")
                               .get();
      const activities = [];
      snapshot.forEach(doc => activities.push({ id: doc.id, ...doc.data() }));
      return activities;
    } catch (e) {
      throw new Error(`Error al obtener lista: ${e.message}`);
    }
  },

  async compressImages(obj) {
    if (!obj) return obj;
    if (typeof obj === 'string' && obj.startsWith('data:image/')) {
      // Aumentado a 1400px y 82% de calidad para mejor nitidez
      return await this._resizeBase64(obj, 1400, 0.82);
    }
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = await this.compressImages(obj[i]);
      }
    } else if (typeof obj === 'object') {
      for (const key in obj) {
        obj[key] = await this.compressImages(obj[key]);
      }
    }
    return obj;
  },

  _resizeBase64(base64Str, maxWidth, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else if (base64Str.startsWith('data:image/jpeg') && base64Str.length < 300000) {
          // Si ya es un jpeg relativamente ligero, lo mantenemos intacto
          return resolve(base64Str);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        
        resolve(compressed.length < base64Str.length ? compressed : base64Str);
      };
      img.onerror = () => resolve(base64Str);
      img.src = base64Str;
    });
  }

};

// Hacer accesible globalmente para los chequeos de window.Community
window.Community = Community;

// Inicializamos al cargar el archivo
Community.init();
