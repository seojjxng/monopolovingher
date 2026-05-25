
const firebaseConfig = {
  apiKey: "AIzaSyBV8Kcd8mF2CGlIRWDxDR6B3f1_50V3FH0",
  authDomain: "monopolovely.firebaseapp.com",
  databaseURL: "https://monopolovely-default-rtdb.firebaseio.com",
  projectId: "monopolovely",
  storageBucket: "monopolovely.firebasestorage.app",
  messagingSenderId: "325639499908",
  appId: "1:325639499908:web:94ad73a6d82da77ce552d1",
  measurementId: "G-GDKYQYLFQJ"
};

// Inicialización
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
window.db = firebase.database();

// --- AQUÍ EMPIEZAN TUS FUNCIONES ---
window.unirse = function() {
    const salaId = document.getElementById('sala-id').value;
    if (!salaId) return alert("Escribe un nombre de sala");
    
    // Conexión real a la sala
    window.sala = salaId;
    window.db.ref('salas/' + window.sala).once('value', (snap) => {
        if (snap.exists()) {
            console.log("Conectado a la sala existente");
        } else {
            console.log("Creando nueva sala");
            window.db.ref('salas/' + window.sala).set({ estado: "esperando" });
        }
        window.log("Entraste a la sala: " + window.sala);
    });
};