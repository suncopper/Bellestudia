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

  async publishActivity(activity, author) {
    if (!db) throw new Error("Firebase no está conectado.");
    
    try {
      const publicActivity = {
        title: activity.title,
        type: activity.type,
        subject: activity.subject || '',
        topic: activity.topic || '',
        data: activity.data,
        author: author || 'Anónimo',
        publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // Para rastrear copias sin colisiones con los ID locales
        originalId: activity.id 
      };

      await db.collection("community_activities").add(publicActivity);
      return true;
    } catch (e) {
      console.error("Error al publicar:", e);
      throw new Error(`No se pudo publicar: ${e.message}`);
    }
  },

  async getRecentActivities(limit = 20) {
    if (!db) throw new Error("Firebase no está conectado.");

    try {
      // Ordenamos por los más recientes y limitamos para no saturar internet/BD
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
  }

};

// Hacer accesible globalmente para los chequeos de window.Community
window.Community = Community;

// Inicializamos al cargar el archivo
Community.init();
