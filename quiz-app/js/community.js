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
        author: author || 'Anónimo',
        publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
        originalId: activity.id 
      };

      const dataString = JSON.stringify(activity.data || {});
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
        await docRef.set(publicActivity);
      } else {
        docRef = await db.collection("community_activities").add(publicActivity);
      }

      // 2. Guardar los trozos
      for (let i = 0; i < chunks.length; i++) {
        await docRef.collection("chunks").doc(i.toString()).set({
          text: chunks[i]
        });
      }

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
      for (let i = 0; i < (act.chunksCount || 1); i++) {
        const chunkDoc = await doc.ref.collection("chunks").doc(i.toString()).get();
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
  }

};

// Hacer accesible globalmente para los chequeos de window.Community
window.Community = Community;

// Inicializamos al cargar el archivo
Community.init();
