
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

// --- LÓGICA DEL TABLERO (Copia esto en tu script.js) ---

const mapa = [
    {n:"SALIDA",p:0},{n:"ITAEWON",p:100},{n:"ARCA COMUNAL",p:0},{n:"BUSAN",p:200},
    {n:"SEOCHO",p:250},{n:"GANGNAM",p:300},{n:"?",p:0},{n:"CYBER CAFÉ",p:400},
    {n:"AUTOMÓVIL",p:450},{n:"CÁRCEL",p:0},{n:"CAFETERÍA",p:500},{n:"RESTAURANTE",p:520},
    {n:"?",p:0},{n:"SPA",p:300},{n:"CINE",p:450},{n:"HOSPITAL",p:200},
    {n:"TEATRO",p:500},{n:"ESTADIO",p:950},{n:"ARCA COMUNAL",p:0},{n:"SMENT",p:1400},
    {n:"YG ENT",p:950},{n:"YJP",p:750},{n:"IMPUESTOS",p:0},{n:"HYBE CORP.",p:2000},
    {n:"MOTO",p:600},{n:"PARADA",p:0},{n:"AVIÓN",p:600},{n:"TREN",p:600}
];

const grupos = [
    {color: "#ff80bf", indices: [1, 3, 4, 5]},
    {color: "#a5d8ff", indices: [7, 10, 11, 13]},
    {color: "#b2f2bb", indices: [14, 15, 16, 17]},
    {color: "#ffd8a8", indices: [19, 20, 21, 23]}, 
    {color: "#f5f5dc", indices: [8, 24, 26, 27]} 
];

window.generarTablero = function() {
    const board = document.getElementById('board');
    if (!board) return;

    // 1. Guardamos los elementos que queremos mantener
    const tokens = board.querySelectorAll('.token');
    const centerZone = board.querySelector('.center-zone');

    // 2. Limpiamos el tablero
    board.innerHTML = "";

    // 3. Volvemos a insertar los elementos guardados
    tokens.forEach(t => board.appendChild(t));
    if (centerZone) board.appendChild(centerZone);

    // 4. Generamos las celdas
    mapa.forEach((casilla, i) => {
        const cell = document.createElement('div');
        cell.id = `cell-${i}`;
        cell.className = "celda-juego";
        cell.style.gridColumn = getGridColumn(i);
        cell.style.gridRow = getGridRow(i);
        
        const grupo = grupos.find(g => g.indices.includes(i));
        cell.style.backgroundColor = grupo ? grupo.color : "#ffffff";
        
        // AQUÍ AGREGAS EL PRECIO
        cell.innerHTML = `
            <div style="font-size: 8px; font-weight: bold;">${casilla.n}</div>
            <div style="font-size: 7px; color: #ff59aa;">${casilla.p > 0 ? '$' + casilla.p : ''}</div>
        `;
        board.appendChild(cell);
    });
};

// Asegúrate de que esto esté al final de tu archivo script.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("El DOM está listo, generando tablero...");
    window.generarTablero();
});
