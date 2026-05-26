// main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

// 1. Inicialización
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

console.log("Main.js cargado correctamente");

// 2. Datos Globales
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

// 3. Funciones de Posicionamiento
function getGridColumn(i) { if (i >= 0 && i <= 7) return 8 - i; if (i >= 8 && i <= 14) return 1; if (i >= 15 && i <= 21) return (i - 14) + 1; return 8; }
function getGridRow(i) { if (i >= 0 && i <= 7) return 8; if (i >= 8 && i <= 14) return 8 - (i - 7); if (i >= 15 && i <= 21) return 1; return (i - 21) + 1; }

// 4. Sistema de Ventanas Emergentes (Modal)
window.abrirModal = function(titulo, contenido) {
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-body').innerHTML = contenido;
    document.getElementById('modal').style.display = 'flex';
};

window.cerrarModal = function() {
    document.getElementById('modal').style.display = 'none';
};

// Lógica de Sala (Verificación)
window.verificarSala = function() {
    const salaId = document.getElementById('sala-id').value.trim();
    if (!salaId) {
        window.abrirModal("Error", "<p>Escribe un nombre de sala primero.</p>");
        return;
    }

    get(child(ref(db), 'salas/' + salaId)).then((snap) => {
        if (snap.exists()) {
            window.abrirModal("Sala Existente", `
                <p>La sala <b>${salaId}</b> ya existe.</p>
                <div style="display:flex; gap:10px; justify-content:center; margin-top:15px;">
                    <button class="btn-sidebar" onclick="window.unirseSala('${salaId}')">Unirse</button>
                    <button class="btn-cerrar" onclick="window.cerrarModal()">Cancelar</button>
                </div>`);
        } else {
            window.abrirModal("Nueva Sala", `
                <p>La sala <b>${salaId}</b> no existe. ¿Quieres crearla?</p>
                <div style="display:flex; gap:10px; justify-content:center; margin-top:15px;">
                    <button class="btn-sidebar" onclick="window.crearSala('${salaId}')">Crear nueva</button>
                    <button class="btn-cerrar" onclick="window.cerrarModal()">Cancelar</button>
                </div>`);
        }
    });
};

window.crearSala = function(salaId) {
    set(ref(db, 'salas/' + salaId), { estado: "esperando" });
    window.cerrarModal();
    window.abrirModal("Éxito", `<p>Sala <b>${salaId}</b> creada.</p>`);
};

window.unirseSala = function(salaId) {
    set(ref(db, 'salas/' + salaId + '/estado'), "activa");
    window.cerrarModal();
    window.abrirModal("Éxito", `<p>Te has unido a <b>${salaId}</b>.</p>`);
};

window.abrirEnviar = () => {
    window.enviarMensaje();
    window.abrirModal("Chat", "<p>Mensaje enviado correctamente.</p>");
};

// 5. Funciones Globales para el HTML
window.generarTablero = function() {
    const board = document.getElementById('board');
    const centerZone = document.getElementById('center-zone');
    if (!board) return;
    
    board.innerHTML = '';
    board.appendChild(centerZone);
    
    mapa.forEach((casilla, i) => {
        const d = document.createElement('div');
        d.className = 'celda-juego';
        d.id = 'cell-' + i;
        d.style.gridColumn = getGridColumn(i);
        d.style.gridRow = getGridRow(i);
        
        let grupo = grupos.find(g => g.indices.includes(i));
        d.innerHTML = (casilla.n === "?") ? `<div class="interrogacion">?</div>` : 
                      (grupo ? `<div class="strip" style="background:${grupo.color}"></div><div class="celda-content"><div class="nombre">${casilla.n}</div><div class="precio">${casilla.p > 0 ? '$' + casilla.p : ''}</div></div>` : 
                      `<div class="celda-content"><div class="nombre">${casilla.n}</div></div>`);
        board.appendChild(d);
    });
};

window.lanzarDado3D = function() {
    const dice = document.getElementById('dice');
    dice.classList.remove('rolling');
    void dice.offsetWidth; 
    dice.classList.add('rolling');
    setTimeout(() => {
        const res = Math.floor(Math.random() * 6) + 1;
        const rot = { 1: "rotateX(0deg) rotateY(0deg)", 2: "rotateX(0deg) rotateY(180deg)", 3: "rotateX(0deg) rotateY(-90deg)", 4: "rotateX(0deg) rotateY(90deg)", 5: "rotateX(-90deg) rotateY(0deg)", 6: "rotateX(90deg) rotateY(0deg)" };
        dice.style.transform = rot[res];
    }, 600);
};

// Acciones de botones
window.mostrarAvisoReputacion = () => window.abrirModal("Reputación", "<p>Tu nivel en Naeun Town es: <b>Estrella Naciente</b></p>");
window.abrirModalMisiones = () => window.abrirModal("Misiones", "<ul><li>Comprar terreno</li><li>Subir saldo a $2000</li><li>Interactuar con jugadores</li></ul>");
window.abrirBanco = () => window.abrirModal("🏦 Banco", "<p>¿Deseas gestionar tus ahorros?</p>");
window.abrirPagar = () => window.abrirModal("💳 Pagar", "<p>Saldo pendiente: <b>$50</b></p>");
window.abrirIntercambio = () => window.abrirModal("🤝 Intercambio", "<p>Esperando conexión con otro jugador...</p>");

window.enviarMensaje = function() {
    const msg = document.getElementById('chat-msg').value;
    if (!msg) return;
    const chatLog = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.textContent = "Yo: " + msg;
    chatLog.appendChild(div);
    document.getElementById('chat-msg').value = ''; 
    chatLog.scrollTop = chatLog.scrollHeight;
};

// Ejecución inicial
window.generarTablero();
