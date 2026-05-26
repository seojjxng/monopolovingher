// main.js (Versión con Misiones y Banco integrados)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set, runTransaction, update, onValue, push, onDisconnect } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

// 1. Inicialización
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

// Configuración de Jugadores (NUEVO)
window.nombres = ["Dog", "Horse", "Hat", "Car"];
window.colores = ["#ffb7b2", "#baa695", "#c2f0c9", "#c2ddf2"];

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
    document.getElementById('modal-title').innerHTML = titulo;
    document.getElementById('modal-body').innerHTML = contenido;
    document.getElementById('modal').style.display = 'flex';
};

window.cerrarModal = function() {
    document.getElementById('modal').style.display = 'none';
};

// --- Lógica del Banco ---
window.abrirBanco = function() {
   if (typeof window.sala === 'undefined' || typeof window.miIdx === 'undefined') {
        const iconoRosaCSS = `
            <div style="display:inline-block; width: 28px; height: 24px; background: #ff80bf; clip-path: polygon(50% 0%, 0% 100%, 100% 100%); position: relative; vertical-align: middle; margin-right: 10px;">
                <div style="width: 3px; height: 9px; background: white; position: absolute; top: 6px; left: 12.5px; border-radius: 1px;"></div>
                <div style="width: 3px; height: 3px; background: white; position: absolute; bottom: 4px; left: 12.5px; border-radius: 1px;"></div>
            </div>`;
            
        window.abrirModal(iconoRosaCSS + "Banco Central", "<p>Debes estar unido a una sala para acceder a los servicios bancarios.</p>");
        return;
    }
    
    get(child(ref(db), 'salas/' + window.sala + '/jugadores/' + window.miIdx)).then((snap) => {
        const j = snap.val();
        if (j && j.tienePrestamo) {
            window.abrirModal("🏦 Banco Central", `
                <p>Préstamo activo: <b>$${j.montoPrestamo}</b></p>
                <button class="btn-sidebar" style="width:100%; background:#27ae60; margin-top: 10px;" onclick="window.pagarPrestamo()">Liquidar Préstamo</button>
            `);
        } else {
            window.abrirModal("🏦 Banco Central", `
                <p>Selecciona un préstamo:</p>
                <div style="display:flex; flex-direction:column; gap: 10px; width: 100%;">
                    <button class="btn-sidebar" onclick="window.solicitarPrestamo(200)">Solicitar $200</button>
                    <button class="btn-sidebar" onclick="window.solicitarPrestamo(400)">Solicitar $400</button>
                    <button class="btn-sidebar" onclick="window.solicitarPrestamo(650)">Solicitar $650</button>
                    <button class="btn-sidebar" onclick="window.solicitarPrestamo(800)">Solicitar $800</button>
                    <button class="btn-sidebar" onclick="window.solicitarPrestamo(1000)">Solicitar $1000</button>
                </div>
            `);
        }
    }).catch((error) => {
        console.error("Error al cargar datos del banco:", error);
    });
};

window.solicitarPrestamo = function(monto) {
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    get(jRef).then((snap) => {
        const j = snap.val();
        if (j.tienePrestamo) {
            window.abrirModal("Error", "Ya tienes un préstamo activo.");
        } else {
            update(jRef, { 
                tienePrestamo: true, 
                montoPrestamo: monto, 
                dinero: (j.dinero || 0) + monto 
            }).then(() => {
                window.abrirModal("✅ Transacción Exitosa", `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 40px; margin-bottom: 10px;">💰</div>
                        <p style="font-size: 1.1em; color: #333;">¡Transacción aceptada!</p>
                        <div style="margin: 15px 0; padding: 10px; background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 8px; color: #2e7d32; font-weight: bold;">
                            El monto de $${monto} está en curso.
                        </div>
                        <button class="btn-sidebar" style="width:100%; margin-top:15px; background: #27ae60;" onclick="window.cerrarModal()">Aceptar</button>
                    </div>
                `);
            });
        }
    });
};

window.abrirPagar = function() {
    // 1. Verificación de Sala
    if (typeof window.sala === 'undefined' || typeof window.miIdx === 'undefined') {
        const iconoRosaCSS = `
            <div style="display:inline-block; width: 28px; height: 24px; background: #ff80bf; clip-path: polygon(50% 0%, 0% 100%, 100% 100%); position: relative; vertical-align: middle; margin-right: 10px;">
                <div style="width: 3px; height: 9px; background: white; position: absolute; top: 6px; left: 12.5px; border-radius: 1px;"></div>
                <div style="width: 3px; height: 3px; background: white; position: absolute; bottom: 4px; left: 12.5px; border-radius: 1px;"></div>
            </div>`;
        window.abrirModal(iconoRosaCSS + "Atención", "<p>Debes estar unido a una sala para acceder a los servicios bancarios.</p>");
        return;
    }

    // 2. Consulta de Estado en Firebase
    get(child(ref(db), 'salas/' + window.sala + '/jugadores/' + window.miIdx)).then((snap) => {
        const j = snap.val();
        
        if (j && j.tienePrestamo) {
            window.abrirModal("💳 Pagar", `
                <p>Saldo pendiente: <b>$${j.montoPrestamo}</b></p>
                <button class="btn-sidebar" style="width:100%; background:#27ae60; margin-top: 10px;" onclick="window.pagarPrestamo()">Liquidar Préstamo ahora</button>
            `);
        } else {
            window.abrirModal("💳 Pagar", "<p>No tienes deudas pendientes.</p>");
        }
    }).catch((error) => {
        console.error("Error al consultar deuda:", error);
        window.abrirModal("Error", "No se pudo conectar al servidor.");
    });
};

window.pagarPrestamo = function() {
    // 1. Verificación de seguridad
    if (typeof window.sala === 'undefined' || typeof window.miIdx === 'undefined') {
        window.abrirModal("⚠️ Error", "<p>Debes estar en una sala para realizar pagos.</p>");
        return;
    }

    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    
    get(jRef).then((snap) => {
        const j = snap.val();
        
        // 2. Verificación de existencia de datos
        if (!j) {
            window.abrirModal("Error", "No se encontraron datos del jugador.");
            return;
        }

        if (!j.tienePrestamo) {
            window.abrirModal("Info", "No tienes préstamos pendientes.");
            return;
        }
        
        // 3. Lógica de pago
        if (j.dinero >= j.montoPrestamo) {
            update(jRef, { 
                dinero: j.dinero - j.montoPrestamo, 
                tienePrestamo: false, 
                montoPrestamo: 0 
            }).then(() => {
                window.abrirModal("✅ Banco", "Préstamo pagado exitosamente.");
            });
        } else {
            window.abrirModal("❌ Error", "Fondos insuficientes para liquidar el préstamo.");
        }
    }).catch((error) => {
        console.error("Error al pagar:", error);
        window.abrirModal("Error", "No se pudo conectar con el servidor.");
    });
};

// --- Lógica de Misiones ---
window.abrirModalMisiones = function() {
    const misiones = [
        { id: 'inversorInicial', titulo: 'Inversor Inicial', desc: 'Poseer al menos 3 propiedades.', rec: 200 },
        { id: 'coleccionista', titulo: 'El coleccionista', desc: 'Completar cualquier set de color.', rec: 300 },
        { id: 'negociador', titulo: 'El negociador', desc: 'Realizar tu primer intercambio exitoso.', rec: 400 },
        { id: 'cajafuerte', titulo: 'Caja fuerte', desc: 'Acumular $2,000 en efectivo.', rec: 650 },
        { id: 'renovador', titulo: 'Renovador', desc: 'Construir un total de 5 casas.', rec: 500 },
        { id: 'monopolioTotal', titulo: 'Monopolio total', desc: 'Ser dueño de los 3 sets más caros.', rec: 1500 },
        { id: 'intocable', titulo: 'El intocable', desc: 'Otros jugadores caen 5 veces en tus propiedades.', rec: 400 }
    ];

    let html = `<div style="text-align: left; max-height: 400px; overflow-y: auto;">`;
    
    misiones.forEach(m => {
        html += `
            <div style="background: #f9f9f9; border-left: 5px solid #ff80bf; padding: 10px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="font-weight: bold; color: #333; font-size: 1.1em;">${m.titulo}</div>
                <div style="font-size: 0.9em; color: #666; margin: 5px 0;">${m.desc}</div>
                <div style="font-size: 0.85em; color: #ff80bf; font-weight: bold;">Recompensa: $${m.rec}</div>
            </div>`;
    });
    
    html += `</div>
             <button class="btn-sidebar" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Entendido</button>`;

    window.abrirModal("🏆 Misiones Disponibles", html);
};

// Lógica de Sala, Tablero y otras funciones...
window.verificarSala = function() {
    const salaId = document.getElementById('sala-id').value.trim();
    if (!salaId) return window.abrirModal("Error", "<p>Escribe un nombre de sala primero.</p>");
    get(child(ref(db), 'salas/' + salaId)).then((snap) => {
        if (snap.exists()) {
            window.abrirModal("Sala Existente", `<p>La sala <b>${salaId}</b> existe.</p><button class="btn-sidebar" onclick="window.unirseSala('${salaId}')">Unirse</button>`);
        } else {
            window.abrirModal("Nueva Sala", `<p>Crear <b>${salaId}</b>?</p><button class="btn-sidebar" onclick="window.crearSala('${salaId}')">Crear</button>`);
        }
    });
};

window.yaEntro = false;

window.crearSala = function(salaId) {
    set(ref(db, 'salas/' + salaId), {
        estado: "esperando",
        jugadores: { 0: { nombre: "Dog", color: window.colores[0], activo: true, dinero: 1500, tienePrestamo: false } }
    }).then(() => {
        window.sala = salaId;
        window.miIdx = 0;
        window.yaEntro = true;
        // Notificar creación al chat
        push(ref(db, 'salas/' + salaId + '/chat'), { n: "Sistema", m: "Dog ha creado la sala.", t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        window.sincronizar();
        window.abrirModal("Sala Creada", `<p>Bienvenido, <b>Dog</b>.</p><button class="btn-sidebar" onclick="window.cerrarModal()">Comenzar</button>`);
    });
};

window.unirseSala = function(salaId) {
    if (window.yaEntro) return;
    const salaRef = ref(db, 'salas/' + salaId + '/jugadores');
    
    runTransaction(salaRef, (jugadores) => {
        if (!jugadores) jugadores = {};
        const ocupados = Object.keys(jugadores).filter(k => !k.startsWith('v')).length;
        const visitantes = Object.keys(jugadores).filter(k => k.startsWith('v')).length;
        
        if (ocupados < 4) {
            window.miIdx = ocupados;
            window.esVisitante = false;
            jugadores[window.miIdx] = { nombre: window.nombres[window.miIdx], color: window.colores[window.miIdx], activo: true, dinero: 1500, tienePrestamo: false };
        } else if (visitantes < 3) {
            window.miIdx = 'v' + (visitantes + 1);
            window.esVisitante = true;
            jugadores[window.miIdx] = { nombre: "Citizen " + (visitantes + 1), activo: true };
        } else {
            window.miIdx = -1;
        }
        return jugadores;
    }).then((res) => {
        if (res.committed && window.miIdx !== -1) {
            window.sala = salaId;
            window.yaEntro = true;
            window.cerrarModal();
            const nombre = window.esVisitante ? "Citizen " + window.miIdx.replace('v','') : window.nombres[window.miIdx];
            const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            onDisconnect(ref(db, 'salas/' + salaId + '/jugadores/' + window.miIdx)).remove();
            onDisconnect(ref(db, 'salas/' + salaId + '/chat')).push({ n: "Sistema", m: nombre + " ha salido.", t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

            push(ref(db, 'salas/' + salaId + '/chat'), { n: "Sistema", m: nombre + " se ha unido.", t: t });
            window.sincronizar();
            window.abrirModal("¡Bienvenido!", `<p>Te has unido como <b>${nombre}</b>.</p><button class="btn-sidebar" onclick="window.cerrarModal()">Aceptar</button>`);
        } else if (window.miIdx === -1) {
            window.abrirModal("Error", "La sala está llena.");
        }
    });
};

window.sincronizar = function() {
    if (!window.sala) return;
    onValue(ref(db, 'salas/' + window.sala + '/chat'), (snap) => {
        const chatLog = document.getElementById('chat-log');
        if (!chatLog) return;
        chatLog.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            const hora = m.t ? `[${m.t}]` : "";
            const estilo = m.n === "Sistema" ? "color: #ff80bf; font-style: italic;" : "color: #333;";
            chatLog.innerHTML += `<div style="${estilo}"><small>${hora}</small> <b>${m.n}:</b> ${m.m}</div>`;
        });
        chatLog.scrollTop = chatLog.scrollHeight;
    });
};

const msgInput = document.getElementById('chat-msg');
if (msgInput) {
    msgInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') window.enviarMensaje();
    });
}
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

window.mostrarAvisoReputacion = () => window.abrirModal("Reputación", "<p>Tu nivel en Naeun Town es: <b>Estrella Naciente</b></p>");
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
window.generarTablero();
