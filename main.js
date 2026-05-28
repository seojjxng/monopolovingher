import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set, runTransaction, update, onValue, push, onDisconnect, off, increment } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

if (typeof window.db === 'undefined') {
    window.db = null; // Inicializamos vacío para que no sea undefined
}

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
window.db = database; 

window.nombres = ["Dog", "Horse", "Hat", "Car"];
window.colores = ["#ffb7b2", "#baa695", "#c2f0c9", "#c2ddf2"];

// Variables globales de listeners
window.chatListener = null;
window.estadoListener = null;
window.climaListener = null;
window.estaLanzando = false;

window.checkDb = function() {
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("CRÍTICO: Firebase DB no está definida aún.");
        return false;
    }
    return true;
};

window.log = function(mensaje) {
    console.log("LOG:", mensaje);
    
    // 1. Intentar usar el sistema existente
    if (typeof window.enviarMensaje === 'function') {
        window.enviarMensaje("Sistema", mensaje, true);
    }
    
    // 2. FORZAR VISUALIZACIÓN EN EL GAME LOG (Por si 'enviarMensaje' no refresca el DOM)
    const logContainer = document.getElementById('game-log');
    if (logContainer) {
        const nuevoMensaje = document.createElement('div');
        nuevoMensaje.style.cssText = "font-size: 0.85em; margin: 2px 0; color: #d63384; font-weight: bold;";
        nuevoMensaje.innerText = `> ${mensaje}`;
        
        // Lo insertamos después del header si existe, o al principio
        const header = document.getElementById('clima-header');
        if (header && header.nextSibling) {
            logContainer.insertBefore(nuevoMensaje, header.nextSibling);
        } else {
            logContainer.prepend(nuevoMensaje);
        }
    }
};

window.generarTablero = function() {
    const board = document.getElementById('board');
    const centerZone = document.getElementById('center-zone'); 
    
    // Verificación de existencia del contenedor
    if (!board) {
        console.warn("Elemento 'board' no encontrado en el DOM.");
        return;
    }
    
    // Verificación de datos de mapa (prevención de errores)
    if (typeof mapa === 'undefined') {
        console.error("Variable 'mapa' no definida. El tablero no puede generarse.");
        return;
    }

    // Limpiamos pero conservamos la zona central (si existe)
    board.innerHTML = '';
    if (centerZone) board.appendChild(centerZone);
    
    mapa.forEach((casilla, i) => {
        const d = document.createElement('div');
        d.className = 'celda-juego';
        d.id = 'cell-' + i; 
        
        // Asignamos estilos de posición
        d.style.gridColumn = typeof getGridColumn === 'function' ? getGridColumn(i) : 'auto';
        d.style.gridRow = typeof getGridRow === 'function' ? getGridRow(i) : 'auto';
        d.style.cursor = "pointer";
        d.style.position = "relative";
        
        d.onclick = () => {
            if (typeof window.verPropiedad === 'function') window.verPropiedad(i);
        };
        
        // Obtenemos grupo (con validación de existencia)
        let grupo = (typeof grupos !== 'undefined') ? grupos.find(g => g.indices.includes(i)) : null;
        
        d.innerHTML = (casilla.n === "?") ? 
            `<div class="interrogacion">?</div>` : 
            (grupo ? 
                `<div class="strip" style="background:${grupo.color}"></div>
                 <div class="celda-content">
                    <div class="nombre">${casilla.n}</div>
                    <div class="precio">${casilla.p > 0 ? '$' + casilla.p : ''}</div>
                 </div>` : 
                `<div class="celda-content">
                    <div class="nombre">${casilla.n}</div>
                 </div>`
            );
        board.appendChild(d);
    });
};

// --- SINCRONIZACIÓN CENTRALIZADA ---
window.sincronizar = function() {
    // 1. GUARDIA DE SEGURIDAD
    if (typeof window.db === 'undefined' || !window.db) {
        console.warn("Firebase DB no inicializada. Reintentando en 500ms...");
        setTimeout(window.sincronizar, 500);
        return;
    }

    if (!window.sala || window.sala === "undefined") {
        console.warn("Sincronización abortada: ID de sala no definido.");
        return;
    }

    console.log("Sincronizando sala:", window.sala);

    // 2. Limpieza de listeners previos
    if (window.chatListener) { off(window.chatListener); window.chatListener = null; }
    if (window.estadoListener) { off(window.estadoListener); window.estadoListener = null; }
    if (window.climaListener) { off(window.climaListener); window.climaListener = null; }

    // 3. Referencias directas
    const salaRef = ref(window.db, 'salas/' + window.sala);
    const chatRef = ref(window.db, 'salas/' + window.sala + '/chat');
    const climaRef = ref(window.db, 'salas/' + window.sala + '/climaIdx');

    // 4. CHAT LISTENER
    window.chatListener = onValue(chatRef, (snap) => {
        const chatLog = document.getElementById('chat-log');
        if (!chatLog) return;
        
        const data = snap.val();
        chatLog.innerHTML = ""; 
        if (!data || typeof data !== 'object') return;

        Object.values(data).forEach(m => {
            if (m.n === "Sistema" && !m.esChat) return;
            const colorEstilo = m.esRosa ? "#ff80bf" : "#333";
            const nombreDisplay = (m.n === "Info" || m.n === "Sistema") ? "" : `<b>${m.n}:</b>`;
            
            const msgDiv = document.createElement('div');
            msgDiv.style.cssText = `color: ${colorEstilo}; margin-bottom: 5px; text-align: left; word-wrap: break-word;`;
            msgDiv.innerHTML = `<small>[${m.t || "00:00"}]</small> ${nombreDisplay} ${m.m}`;
            chatLog.appendChild(msgDiv);
        });
        chatLog.scrollTop = chatLog.scrollHeight;
    });

    // 5. ESTADO LISTENER (Aquí está la lógica integrada del Creador y el Turno)
    window.estadoListener = onValue(salaRef, (snap) => {
        const s = snap.val();
        if (!s) return;

        // --- LÓGICA DE CREADOR ---
        window.creadorSala = s.creador; // Sincronizamos quién es el creador
        const btnIniciar = document.getElementById('btn-iniciar-partida');
        if (btnIniciar) {
            // Solo se muestra si YO soy el creador y la sala espera
            btnIniciar.style.display = (window.miIdx === window.creadorSala && s.estado === "esperando") ? 'block' : 'none';
        }

        if (window.estadoPrevio === "esperando" && s.estado === "jugando") {
            if (typeof window.anunciar === 'function') window.anunciar("¡La partida ha comenzado!");
        }
        window.estadoPrevio = s.estado;

        // Dinero
        const elDinero = document.getElementById('dinero-mio');
        if (elDinero && s.jugadores && s.jugadores[window.miIdx]) {
            elDinero.innerText = s.jugadores[window.miIdx].dinero || 0;
        }

        // --- ACTUALIZACIÓN DE TURNO ---
        // Llamamos a la función que actualiza tu div "turno-display"
        if (typeof window.actualizarTurnoUI === 'function') {
            window.actualizarTurnoUI(s);
        }

        // Botón Lanzar Dado (Lógica habilitar/deshabilitar)
        const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
        if (btnDado) {
            // Permitir lanzar si está jugando y es su turno
            const esMiTurno = (s.estado === "jugando" && s.turno === window.miIdx);
            btnDado.style.pointerEvents = esMiTurno ? 'auto' : 'none';
            btnDado.style.opacity = esMiTurno ? '1' : '0.5';
            btnDado.style.cursor = esMiTurno ? 'pointer' : 'default';
        }

        if (s.jugadores && typeof window.actualizarTokens === 'function') {
            window.actualizarTokens(s.jugadores);
        }
    });

    // 6. CLIMA LISTENER
    window.climaListener = onValue(climaRef, (snap) => {
        const val = snap.val();
        const idx = (val !== null && val !== undefined) ? val : 0;
        
        const elClima = document.getElementById('clima-display');
        if (elClima && window.climas) elClima.innerText = `Clima: ${window.climas[idx].n}`;
        
        const gameLog = document.getElementById('game-log');
        if (gameLog) {
            let header = document.getElementById('clima-header');
            if (!header) {
                header = document.createElement('div');
                header.id = 'clima-header';
                header.style.cssText = "font-size: 0.85em; margin-bottom: 4px; border-bottom: 1px solid #ffccd5; padding-bottom: 2px; color: #ff80bf; font-weight: bold; position: sticky; top: 0; background: #fff5f7; z-index: 10;";
                gameLog.prepend(header);
            }
            header.innerHTML = `☁️ Clima actual: ${window.climas ? window.climas[idx].n : "Cargando..."}`;
        }
    });
};

window.escucharJugadores = function() {
    // 1. Protección: Usamos la constante 'db' local del archivo
    if (typeof db === 'undefined' || !db) {
        console.warn("Firebase DB no lista en escucharJugadores, reintentando...");
        setTimeout(window.escucharJugadores, 500);
        return;
    }
    
    if (!window.sala) return;

    const jugadoresRef = ref(db, 'salas/' + window.sala + '/jugadores');
    
    // 3. Listener directo
    onValue(jugadoresRef, (snap) => {
        const jugadores = snap.val();
        if (jugadores) {
            // Aseguramos que el tablero exista
            if (!document.getElementById('cell-0')) {
                if (typeof window.generarTablero === 'function') {
                    window.generarTablero();
                }
            }
            // Actualizar tokens si la función existe
            if (typeof window.actualizarTokens === 'function') {
                window.actualizarTokens(jugadores);
            }
        }
    });
};

// 4. Sistema de Ventanas Emergentes (Modal)
window.abrirModal = function(titulo, contenido) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');

    if (modal && titleEl && bodyEl) {
        titleEl.innerHTML = titulo;
        bodyEl.innerHTML = contenido;
        
        // CORRECCIÓN: Quitamos la clase que tiene el "display: none !important"
        modal.classList.remove('modal-hidden'); 
        // Ahora aplicamos el flex
        modal.style.display = 'flex'; 
        
        console.log("Modal abierto exitosamente");
    } else {
        console.error("No se encontraron los elementos del modal (modal, title, o body)");
    }
};

window.cerrarModal = function() {
    const modal = document.getElementById('modal');
    if (modal) {
        // CORRECCIÓN: Volvemos a añadir la clase para ocultarlo
        modal.classList.add('modal-hidden');
        modal.style.display = 'none';
    }
};

// --- 1. CONFIGURACIÓN GLOBAL ---
window.climas = Object.freeze([
    { n: "Primavera Soleada", mult: 1.0 }, { n: "Primavera Lluviosa", mult: 1.0 },
    { n: "Verano Caluroso", mult: 1.0 }, { n: "Verano Nublado", mult: 1.0 },
    { n: "Otoño Fresco", mult: 1.0 }, { n: "Otoño Ventoso", mult: 1.0 },
    { n: "Lluvia Fuerte", mult: 0.7 }, { n: "Tormenta Eléctrica", mult: 0.5 },
    { n: "Ventisca", mult: 0.6 }, { n: "Nevada Intensa", mult: 0.6 },
    { n: "Tornado", mult: 0.5 }
]);

// --- Lógica del Ciclo Automático ---
window.iniciarCicloClima = function() {
    if (window.climaInterval) clearInterval(window.climaInterval);
    
    window.climaInterval = setInterval(async () => {
        const salaSnap = await get(ref(db, 'salas/' + window.sala));
        const salaData = salaSnap.val();
        if (!salaData) return;

        // Si hay visitantes, el sistema automático se detiene
        const hayVisitantes = salaData.visitantes && Object.keys(salaData.visitantes).length > 0;
        if (hayVisitantes) return; 

        const controlRef = ref(db, 'salas/' + window.sala + '/controladorClima');
        const snap = await get(controlRef);
        const ctrl = snap.val();
        const ahora = Date.now();
        
        if (!ctrl || (ahora - (ctrl.timestamp || 0) > 300000)) {
            const nuevoIdx = Math.floor(Math.random() * window.climas.length);
            const nuevoClima = window.climas[nuevoIdx];
            
            await update(ref(db, 'salas/' + window.sala), { climaIdx: nuevoIdx });
            
            // Registro del Sistema vía tu log
            if (typeof window.log === 'function') {
                window.log(`¡El clima ha cambiado a ${nuevoClima.n}!`);
            }
        }
    }, 600000); 
};

// 2. Datos Globales
window.mapa = [
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
function getGridColumn(i) {
    if (i < 0 || i > 27) return '1'; 
    if (i >= 0 && i <= 7) return 8 - i;
    if (i >= 8 && i <= 14) return 1;
    if (i >= 15 && i <= 21) return (i - 14) + 1;
    return 8;
}

function getGridRow(i) {
    if (i < 0 || i > 27) return '1';
    if (i >= 0 && i <= 7) return 8;
    if (i >= 8 && i <= 14) return 8 - (i - 7);
    if (i >= 15 && i <= 21) return 1;
    return (i - 21) + 1;
}

// Lógica de Sala, Tablero y otras funciones...
window.validarYConectar = function() {
    const idInput = document.getElementById('sala-id');
    const id = idInput ? idInput.value.trim() : "";
    
    if (!id) {
        window.abrirModal("Error", `
            <div class="modal-content">
                <p>Por favor, ingresa un <b>ID de sala</b> válido.</p>
                <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Aceptar</button>
            </div>
        `);
        return;
    }

    get(ref(db, 'salas/' + id)).then((snapshot) => {
        if (snapshot.exists()) {
            window.abrirModal("Sala encontrada", `
                <div class="modal-content">
                    <p>La sala <b>${id}</b> está activa.</p>
                    <button class="btn-sidebar" style="width: 100%;" onclick="window.modalSeleccionRol('${id}', false)">Unirse como Jugador</button>
                    <button class="btn-sidebar" style="width: 100%; margin-top: 10px;" onclick="window.unirseComoVisitante('${id}', false)">Entrar como Visitante</button>
                </div>
            `);
        } else {
            window.abrirModal("Sala nueva", `
                <div class="abrirModal">
                    <p>La sala <b>${id}</b> no existe. Sé el primero en crearla.</p>
                    <button class="btn-sidebar" style="width: 100%;" onclick="window.modalSeleccionRol('${id}', true)">Crear como Jugador</button>
                    <button class="btn-sidebar" style="width: 100%; margin-top: 10px;" onclick="window.unirseComoVisitante('${id}', true)">Crear como Visitante</button>
                </div>
            `);
        }
    });
};

// --- 2. Selección de Personaje (Fichas) ---
window.modalSeleccionRol = function(salaId, esCreacion) {
    const roles = ["Dog", "Horse", "Hat", "Car"];
    let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
    roles.forEach((rol) => {
        html += `<button class="btn-sidebar" onclick="window.procesarUnion('${salaId}', '${rol}', ${esCreacion})">${rol}</button>`;
    });
    html += `</div>`;
    window.abrirModal("Elige tu ficha", html);
};

// --- 3. Lógica de Unión/Creación de Jugador (Fichas) ---
// --- 3. Lógica de Unión/Creación de Jugador (Fichas) ---
window.procesarUnion = async function(salaId, rol, esCreacion) {
    window.sala = salaId;
    
    if (esCreacion) {
        // Inicialización completa de la sala como creador
        const roomData = {
            estado: "esperando",
            creador: rol, // Guardamos al creador aquí
            jugadores: { 
                [rol]: { nombre: rol, dinero: 1500, pos: 0, activo: true } 
            }
        };
        await set(ref(db, 'salas/' + salaId), roomData);
        
        window.miIdx = rol;
        window.creadorSala = rol;
        window.esVisitante = false;
        window.cerrarModal();
        window.anunciarEnChat(salaId, rol + " ha creado la sala.");
        window.abrirModal("Éxito", `<p>Sala creada como <b>${rol}</b></p><button class="btn-sidebar" onclick="window.cerrarModal()">Comenzar</button>`);
        window.sincronizar();
        
    } else {
        // Unión a sala existente mediante transacción
        const dbRef = ref(db, 'salas/' + salaId + '/jugadores');
        runTransaction(dbRef, (jugadores) => {
            if (!jugadores) jugadores = {};
            if (jugadores[rol]) return; // Ya ocupado
            
            jugadores[rol] = { nombre: rol, dinero: 1500, pos: 0, activo: true };
            return jugadores;
        }).then((res) => {
            if (res.committed) {
                window.miIdx = rol;
                window.esVisitante = false;
                window.cerrarModal();
                window.anunciarEnChat(salaId, rol + " se ha unido.");
                window.abrirModal("Éxito", `<p>Entraste como <b>${rol}</b></p><button class="btn-sidebar" onclick="window.cerrarModal()">Comenzar</button>`);
                window.sincronizar();
            } else {
                alert("El rol " + rol + " ya está ocupado o hubo un error.");
            }
        });
    }
};

window.iniciarPartida = function() {
    const salaRef = ref(db, 'salas/' + window.sala);
    
    get(salaRef).then((snap) => {
        const s = snap.val();
        if (!s || !s.jugadores) return;

        const jugadoresIds = Object.keys(s.jugadores);
        // Elegimos al azar al primer jugador
        const jugadorInicial = jugadoresIds[Math.floor(Math.random() * jugadoresIds.length)];

        update(salaRef, { 
            estado: "jugando", 
            turno: jugadorInicial 
        }).then(() => {
            window.log("¡La partida ha comenzado! Turno de: " + (s.jugadores[jugadorInicial].nombre || jugadorInicial));
        });
    });
};

// --- 4. Unión de Visitante (Automática) ---
window.unirseComoVisitante = async function(salaId, esCreacion, nombreVisitante = "Citizen") {
    window.sala = salaId;
    window.esVisitante = true;
    
    // --- LÓGICA DE CREACIÓN O UNIÓN ---
    if (esCreacion) {
        const nuevoRol = 'v1';
        const roomData = {
            estado: "esperando",
            creador: nuevoRol,
            jugadores: { 
                [nuevoRol]: { nombre: nombreVisitante, activo: true, pos: 0, dinero: 2000 } 
            }
        };
        await set(ref(db, 'salas/' + salaId), roomData);
        window.miIdx = nuevoRol;
        window.creadorSala = nuevoRol;
    } else {
        const dbRef = ref(db, 'salas/' + salaId + '/jugadores');
        const res = await runTransaction(dbRef, (jugadores) => {
            if (!jugadores) jugadores = {};
            const numVisitantes = Object.keys(jugadores).filter(k => k.startsWith('v')).length;
            const nuevoRol = 'v' + (numVisitantes + 1);
            jugadores[nuevoRol] = { 
                nombre: nombreVisitante + " " + (numVisitantes + 1), 
                activo: true, 
                pos: 0, 
                dinero: 2000 
            };
            window.miIdx = nuevoRol;
            return jugadores;
        });
        if (!res.committed) return;
    }

    // --- INICIALIZACIÓN DE DATOS ---
    // Usamos window.miIdx directamente, que ya está definido arriba
    const visitanteRef = ref(db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
    await set(visitanteRef, {
        nombre: nombreVisitante,
        activo: true, 
        pos: 0, 
        reputacion: 0,
        misionesCompletadas: 0
    });

    // --- FINALIZACIÓN Y UI ---
    window.cerrarModal();
    window.anunciarEnChat(salaId, "Un visitante se ha unido a la partida.");
    window.actualizarBotonesPoderes();
    window.renderEstrellas(0);
    window.abrirModal("Éxito", `<p>Entraste como <b>Visitante</b></p><button class="btn-sidebar" onclick="window.cerrarModal()">Comenzar</button>`);
    window.sincronizar();
};

// --- 5. Anuncio en Chat y Desconexión (Crítico) ---
window.anunciarEnChat = function(salaId, mensaje) {
    const chatRef = ref(db, 'salas/' + salaId + '/chat');
    const miRef = ref(db, 'salas/' + salaId + '/jugadores/' + window.miIdx);

    // 1. Mensaje de entrada
    push(chatRef, { 
        n: "Sistema", 
        m: mensaje, 
        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        esChat: true, 
        esRosa: true 
    });

    // 2. Desconexión (Se ejecuta si cierran el navegador)
    onDisconnect(miRef).remove();
    // Nota: Firebase onDisconnect solo permite operaciones simples, 
    // el anuncio de salida se gestiona normalmente mediante un listener en tu sistema de sincronización.
};

// --- 6. Poderes de Visitante ---
// --- 1. MENÚ DE PODERES ORDENADO Y FILTRADO ---
window.actualizarBotonesPoderes = function() {
    const sidebar = document.querySelector('.sidebar');
    if (window.esVisitante && sidebar && !document.getElementById("container-poderes")) {
        const container = document.createElement('div');
        container.id = "container-poderes";
        // CSS Grid para ordenar botones en pares y que se vea profesional
        container.innerHTML = `
            <h4 style="color:#ff59aa; margin:15px 0 10px; text-align:center; border-bottom:1px solid #ffdde2;">
                <i class="fas fa-magic"></i> Poderes
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                <button class="btn-sidebar" onclick="window.abrirMenuProteccion()" style="padding: 5px; font-size: 0.8em;"><i class="fas fa-shield-alt"></i> Escudo</button>
                <button class="btn-sidebar" onclick="window.seleccionarObjetivoSabotaje(0.05, 300)" style="padding: 5px; font-size: 0.8em;"><i class="fas fa-chart-line"></i> Sabotaje 5%</button>
                <button class="btn-sidebar" onclick="window.seleccionarObjetivoSabotaje(0.10, 500)" style="padding: 5px; font-size: 0.8em;"><i class="fas fa-biohazard"></i> Sabotaje 10%</button>
                <button class="btn-sidebar" onclick="window.tomarControlClima()" style="padding: 5px; font-size: 0.8em;"><i class="fas fa-cloud-sun"></i> Clima</button>
            </div>
            <button class="btn-sidebar" onclick="window.pagarFianzaVisitante()" style="margin-top:5px; width:100%; padding: 5px;"><i class="fas fa-unlock"></i> Pagar Fianza ($300)</button>
        `;
        sidebar.appendChild(container);
    }
};

// --- 2. SELECCIÓN DE JUGADOR (FILTRO: SOLO JUGADORES, NO VISITANTES) ---
window.abrirMenuProteccion = async function() {
    const snap = await get(ref(db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Protege a un jugador (los visitantes no pueden ser protegidos):</p>`;
    
    snap.forEach(c => {
        // FILTRO: Solo mostrar si no empieza con 'v' (visitante)
        if (!c.key.startsWith('v')) {
            html += `<button class="btn-accion" style="margin-bottom:5px; width:100%" onclick="window.activarEscudo('${c.key}'); window.cerrarModal()">
                        <i class="fas fa-user-shield"></i> ${c.key}
                     </button>`;
        }
    });
    
    html += `<button class="btn-cerrar" style="width:100%" onclick="window.cerrarModal()">Cancelar</button></div>`;
    window.abrirModal("🛡️ Proteger Ciudadano", html);
};

// --- 3. LÓGICA DE ESCUDO CON NOTIFICACIÓN EN LOG ---
window.activarEscudo = async function(jugadorIdx) {
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + jugadorIdx);
    const nombreVisitante = window.nombres[window.miIdx] || "Visitante";
    
    await update(jRef, { 
        tieneEscudo: true,
        protegidoPor: window.miIdx,
        timestampEscudo: Date.now() 
    });
    
    // Notificar al log global
    window.log(`🛡️ ${nombreVisitante} ha establecido un contrato de protección para ${jugadorIdx}. ¡Cobrarán el 50% de sus ganancias!`);
    
    window.abrirModal("¡Protección Activa!", `<div class="modal-content"><p>Ahora proteges a <b>${jugadorIdx}</b>.</p><button class="btn-accion" onclick="window.cerrarModal()">Aceptar</button></div>`);
};

// --- 4. SELECCIÓN DE OBJETIVO PARA SABOTAJE (EVITA VISITANTES) ---
window.seleccionarObjetivoSabotaje = async function(porcentaje, costo) {
    const snap = await get(ref(db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Elige a quién sabotear (${porcentaje*100}%):</p>`;
    
    snap.forEach(c => {
        if (!c.key.startsWith('v')) {
            html += `<button class="btn-accion" style="margin-bottom:5px; width:100%" 
                        onclick="window.ejecutarSabotaje('${c.key}', ${porcentaje}, ${costo}); window.cerrarModal()">
                        <i class="fas fa-skull"></i> ${c.key}
                     </button>`;
        }
    });
    
    html += `<button class="btn-cerrar" style="width:100%" onclick="window.cerrarModal()">Cancelar</button></div>`;
    window.abrirModal("💥 Sabotaje", html);
};

window.ejecutarSabotaje = async function(objetivoIdx, porcentaje, costo) {
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + objetivoIdx);
    const snap = await get(jRef);
    const j = snap.val();

    if (j.tieneEscudo) {
        window.abrirModal("Bloqueado", `<div class="modal-content"><p><i class="fas fa-ban"></i> ¡El jugador tiene un escudo activo!</p></div>`);
        return;
    }
    
    await update(jRef, { dinero: increment(-(j.dinero * porcentaje)) });
    await update(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { dinero: increment(-costo) });
    
    window.log(`💥 ${window.nombres[window.miIdx]} saboteó a ${objetivoIdx} restándole el ${porcentaje*100}%.`);
};

// --- 5. LÓGICA DE COMISIÓN 50% ---
// Esta función debe ejecutarse cuando alguien paga alquiler
window.procesarAlquiler = async function(propietarioIdx, monto) {
    const propRef = ref(db, 'salas/' + window.sala + '/jugadores/' + propietarioIdx);
    const snap = await get(propRef);
    const propietario = snap.val();

    if (propietario.tieneEscudo && propietario.protegidoPor) {
        const comision = monto * 0.5;
        const visitanteRef = ref(db, 'salas/' + window.sala + '/jugadores/' + propietario.protegidoPor);
        await update(visitanteRef, { dinero: increment(comision) });
        window.log(`💰 ¡Comisión recibida! $${comision} por proteger a ${propietarioIdx}.`);
    }
    await update(propRef, { dinero: increment(monto) });
};

window.abrirControlClima = function() {
    let html = `
    <div style="max-height: 300px; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;">
        <style>.clima-scroll::-webkit-scrollbar { display: none; }</style>
        <p style="font-size: 0.85em; margin-bottom: 10px;">Elige el clima. Se aplicará un <b>cooldown de 10 min</b>.</p>
        <div class="clima-scroll">`;
        
    window.climas.forEach((c, idx) => {
        html += `<button class="btn-sidebar" style="width:100%; margin:5px 0; padding:8px;" 
                 onclick="window.cambiarClimaConCooldown(${idx})">
                    <b>${c.n}</b>
                 </button>`;
    });
    
    html += `</div>
        <button class="btn-cerrar" style="width:100%; margin-top:10px; background:#eee;" onclick="window.cerrarModal()">Cerrar</button>
    </div>`;
    
    window.abrirModal("☁️ Panel de control climático", html);
};

window.cambiarClimaConCooldown = function(idx) {
    const ahora = Date.now();
    const nuevoClima = window.climas[idx];
    const nombreJugador = (window.nombres && window.nombres[window.miIdx]) ? window.nombres[window.miIdx] : "Ciudadano";
    const porcentaje = Math.round(nuevoClima.mult * 100);

    // 1. Guardar cooldown
    update(ref(db, 'salas/' + window.sala + '/controladorClima'), {
        timestamp: ahora,
        ultimoUsuario: window.miIdx
    });

    // 2. Actualizar clima
    update(ref(db, 'salas/' + window.sala), { climaIdx: idx });

    // 3. Registrar en el log usando tu función centralizada
    const mensaje = `¡${nombreJugador} ha cambiado el clima a ${nuevoClima.n}! Las propiedades ahora valen un ${porcentaje}% de su valor original.`;
    if (typeof window.log === 'function') {
        window.log(mensaje);
    }

    // 4. Actualizar display visual
    const display = document.getElementById('clima-display');
    if (display) display.innerText = `Clima: ${nuevoClima.n}`;

    // 5. Ventana de confirmación
    window.cerrarModal();
    window.abrirModal("¡Cambio Exitoso!", `
        <div class="modal-content" style="text-align: center;">
            <p>Clima: <b>${nuevoClima.n}</b> aplicado.</p>
            <p>Impacto: <b>${porcentaje}%</b> del valor original.</p>
            <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Aceptar</button>
        </div>
    `);
};

window.tomarControlClima = function() {
    if (!window.esVisitante) return;
    const refControl = ref(db, 'salas/' + window.sala + '/controladorClima');
    
    get(refControl).then(snap => {
        const data = snap.val();
        const ahora = Date.now();
        // Cooldown de 10 minutos (600,000 ms)
        if (!data || (ahora - data.timestamp > 600000)) {
            window.abrirControlClima();
        } else {
            const minutosRestantes = Math.ceil((600000 - (ahora - data.timestamp)) / 60000);
            window.abrirModal("Control Bloqueado", `<p>El clima está bajo cooldown. Intenta de nuevo en ${minutosRestantes} min.</p>`);
        }
    });
};

window.enviarMensaje = function() {
    const input = document.getElementById('chat-msg');
    const mensaje = input.value.trim();
    
    // Validaciones básicas
    if (mensaje === "" || !window.sala || window.miIdx === undefined) return;
    
    // Usamos window.miIdx directamente si es el ID (Dog, Horse, etc.)
    // Si necesitas un formato más limpio para visitantes, puedes procesarlo aquí
    let idMostrar = window.miIdx;
    
    // Si tu sistema usa IDs tipo "v1", "v2" y quieres que digan "Visitante 1", etc.
    if (typeof idMostrar === 'string' && idMostrar.startsWith('v')) {
        const num = idMostrar.replace('v', '');
        idMostrar = "Visitante " + num;
    }

    push(ref(window.db, 'salas/' + window.sala + '/chat'), {
        n: idMostrar, // Ahora enviará el ID (Dog, Horse, Visitante 1, etc.)
        m: mensaje,
        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }).then(() => {
        input.value = "";
    }).catch((error) => {
        console.error("Error al enviar mensaje:", error);
    });
};

// --- Lógica de Lanzamiento de Dado ---
window.tirarDado = async function() {
    // 1. Verificación: Los visitantes NO pueden mover fichas
    if (window.esVisitante) {
        console.warn("Los visitantes no pueden lanzar el dado.");
        return;
    }

    // 2. Verificación básica y de bloqueo
    if (typeof window.miIdx === 'undefined' || window.estaLanzando) return;
    
    if (typeof db === 'undefined' || !db) {
        console.error("Firebase DB no está definida.");
        return;
    }

    window.estaLanzando = true;
    const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
    if (btnDado) btnDado.style.pointerEvents = 'none';

    try {
        const salaRef = ref(db, 'salas/' + window.sala);
        const snap = await get(salaRef);
        
        if (!snap.exists()) { console.error("Sala perdida"); return; }
        let s = snap.val();

        // --- LÓGICA DE AUTO-INICIO Y TURNO ---
        if (!s.turno || s.estado !== "jugando") {
            await update(salaRef, { estado: "jugando", turno: window.miIdx });
            s.turno = window.miIdx;
            s.estado = "jugando";
        }

        const keys = Object.keys(s.jugadores || {});
        const jugadoresReales = keys.filter(k => !String(k).startsWith('v'));
        const esSolo = jugadoresReales.length === 1;

        if (!esSolo && String(s.turno) !== String(window.miIdx)) {
            window.estaLanzando = false;
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            return;
        }

        // Verificación de cárcel
        if (s.jugadores[window.miIdx].enCarcel > 0) {
            window.anunciar(window.nombres[window.miIdx] + " está en la cárcel.");
            if (!esSolo) window.pasarTurno();
            return;
        }

        // Lanzamiento del dado
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const dado = (array[0] % 6) + 1;
        
        window.lanzarDado3D(dado);
        await new Promise(r => setTimeout(r, 700));

        const posAnterior = Number(s.jugadores[window.miIdx].pos || 0);
        const nuevaPos = (posAnterior + dado) % 28;
        
        // --- LÓGICA DE SALIDA ($100 AUTOMÁTICOS) ---
        if (nuevaPos < posAnterior) {
            await update(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), {
                dinero: increment(100)
            });
            window.log("¡Pasaste por SALIDA y ganaste $100!");
        }

        // Actualización de posición
        const miJugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
        await update(miJugadorRef, { pos: nuevaPos });

        // Lógica de pasar turno
        if (!esSolo) {
            if (dado !== 6) {
                window.pasarTurno();
            } else {
                window.log(window.nombres[window.miIdx] + " sacó 6 y repite turno!");
            }
        }

        // --- MANEJO DE CASILLA (Se habilita compra con 'true') ---
        if (typeof window.manejarCasilla === 'function') {
            await window.manejarCasilla(nuevaPos, true);
        }

    } catch (e) {
        console.error("Error al lanzar:", e);
    } finally {
        window.estaLanzando = false;
        if (btnDado) btnDado.style.pointerEvents = 'auto';
    }
};

// --- Visualización 3D ---
window.lanzarDado3D = function(resultado) {
    const dice = document.getElementById('dice');
    if (!dice) return;

    // 1. Resetear el estado
    dice.classList.remove('rolling');
    dice.style.animation = "none";
    dice.style.transition = "none";
    dice.style.transform = "rotateX(0deg) rotateY(0deg)";
    
    // 2. Forzar reflow para que el navegador "olvide" el estado anterior
    void dice.offsetWidth;

    // 3. Aplicar la animación de giro (rolling)
    dice.style.animation = "girarDado 0.6s ease-out forwards";
    dice.classList.add('rolling');

    // 4. Tras la animación, aplicar la rotación final del resultado
    setTimeout(() => {
        dice.style.animation = "none";
        dice.style.transition = "transform 0.3s ease-out";
        
        const rot = { 
            1: "rotateX(0deg) rotateY(0deg)", 
            2: "rotateX(0deg) rotateY(-90deg)", 
            3: "rotateX(-90deg) rotateY(0deg)", 
            4: "rotateX(90deg) rotateY(0deg)", 
            5: "rotateX(0deg) rotateY(90deg)", 
            6: "rotateX(0deg) rotateY(180deg)" 
        };

        dice.style.transform = rot[resultado];
    }, 650); // Ligeramente más que la duración de la animación (0.6s)
};

// --- LÓGICA DE PASAR TURNO (BLINDADA) ---
window.sortearPrimerTurno = function() {
    const salaRef = ref(db, 'salas/' + window.sala);
    get(salaRef).then((snap) => {
        const s = snap.val();
        if (!s || !s.jugadores) return;

        const listaJugadores = Object.keys(s.jugadores);
        const primerJugador = listaJugadores[Math.floor(Math.random() * listaJugadores.length)];
        
        update(salaRef, { turno: primerJugador });
    });
};

window.pasarTurno = function() {
    const salaRef = ref(db, 'salas/' + window.sala);
    
    get(salaRef).then((snap) => {
        const s = snap.val();
        if (!s || !s.jugadores) return;

        const listaJugadores = Object.keys(s.jugadores);
        const turnoActual = s.turno;
        
        // Buscamos quién es el actual
        const idxActual = listaJugadores.indexOf(turnoActual);
        
        // Calculamos el siguiente (Si es el último, volvemos al 0)
        const siguienteIdx = (idxActual === -1 || idxActual >= listaJugadores.length - 1) 
            ? 0 
            : idxActual + 1;
            
        const siguienteId = listaJugadores[siguienteIdx];
        
        update(salaRef, { 
            turno: siguienteId 
        }).then(() => {
            const nombre = s.jugadores[siguienteId]?.nombre || siguienteId;
            window.log("Turno de: " + nombre);
        });
    });
};

// --- LÓGICA DE UI ACTUALIZADA (CORRECCIÓN DE LECTURA) ---
window.actualizarTurnoUI = function(s) {
    const display = document.getElementById('turno-display');
    if (!display) return;

    if (s.estado !== "jugando") {
        display.innerText = "Turno: Esperando...";
        return;
    }

    let turnoId = s.turno; 
    
    // CORRECCIÓN: Si el turno actual es un visitante, forzamos que UI muestre "Esperando jugador real"
    // y no le damos relevancia al nombre del visitante.
    if (turnoId && String(turnoId).startsWith('v')) {
        display.innerText = "Turno: Esperando jugador...";
        return;
    }
    
    if (!turnoId) {
        display.innerText = "Turno: Iniciando...";
        return;
    }

    const jugadorInfo = s.jugadores ? s.jugadores[turnoId] : null;
    const nombreJugador = (jugadorInfo && jugadorInfo.nombre) ? jugadorInfo.nombre : ("ID: " + turnoId);
    
    display.innerText = "Turno: " + nombreJugador;
};

window.depurarTurno = async function() {
    console.log("--- INICIANDO DEPURACIÓN DE TURNO ---");
    const salaRef = ref(db, 'salas/' + window.sala);
    const snap = await get(salaRef);
    const s = snap.val();
    
    if (!s || !s.jugadores) {
        console.log("Error: No hay datos de jugadores en Firebase.");
        return;
    }

    const keys = Object.keys(s.jugadores);
    console.log("IDs encontrados en jugadores:", keys);
    
    const jugadoresReales = keys.filter(k => !String(k).startsWith('v'));
    console.log("Jugadores reales (filtrados):", jugadoresReales);
    
    if (jugadoresReales.length === 0) {
        console.log("FALLO CRÍTICO: No hay jugadores que NO empiecen con 'v'. Revisa si tus jugadores reales tienen IDs que empiezan con 'v'.");
    } else {
        console.log("Todo bien: Se seleccionará uno de estos:", jugadoresReales);
    }
};

// --- 3. ACTUALIZAR TOKENS (Renderizado Visual) ---
window.actualizarTokens = function(jugadores) {
    if (!jugadores) return;

    const tokensMap = {
        "Dog": "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/Gemini_Generated_Image_bnjz0lbnjz0lbnjz.png",
        "Horse": "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/67791e8f69aea2f39d914aff8fd20714-removebg-preview-removebg-preview.png",
        "Hat": "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/ZaN9ZUG.png",
        "Car": "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/mC3Vwc7.png"
    };

    document.querySelectorAll('.token').forEach(t => t.remove());

    Object.keys(jugadores).forEach((id) => {
        const jugador = jugadores[id];
        if (String(id).startsWith('v')) return;

        const p = parseInt(jugador.pos) || 0;
        const celda = document.getElementById('cell-' + p);
        const nombre = jugador.nombre;

        if (celda && nombre && tokensMap[nombre]) {
            celda.style.position = 'relative';

            const token = document.createElement('img');
            token.className = 'token';
            token.id = 'token-' + id;
            token.src = tokensMap[nombre];

            // Ajustes para que quepan perfectamente
            token.style.position = 'absolute';
            token.style.top = '50%';
            token.style.left = '50%';
            token.style.transform = 'translate(-50%, -50%)';
            
            // Reducido a 25px para que sobre espacio en la celda de 70px
            token.style.width = '50px';
            token.style.height = '50px';
            
            // "contain" hace que la imagen completa se vea sin recortar
            token.style.objectFit = 'contain'; 
            
            token.style.zIndex = '9999';
            token.style.pointerEvents = 'none';
            token.style.border = 'none'; 
            token.style.borderRadius = '0'; 
            token.style.boxShadow = 'none';
            token.style.backgroundColor = 'transparent'; // Por si la imagen tiene fondo oscuro

            celda.appendChild(token);
        }
    });
};

window.pasarTurno = function() {
    const salaRef = ref(db, 'salas/' + window.sala);
    
    get(salaRef).then((snap) => {
        const s = snap.val();
        if (!s || !s.jugadores) return;

        // 1. Filtrar solo jugadores reales (los que no empiezan con 'v')
        const jugadoresReales = Object.keys(s.jugadores).filter(k => !String(k).startsWith('v'));
        if (jugadoresReales.length === 0) return;

        // 2. Calcular siguiente turno
        const turnoActual = String(s.turno);
        const idxActual = jugadoresReales.indexOf(turnoActual);
        const siguienteIdx = (idxActual + 1) % jugadoresReales.length;
        const siguienteId = jugadoresReales[siguienteIdx];
        
        // 3. Actualizar en Firebase
        update(salaRef, { 
            turno: siguienteId 
        }).then(() => {
            window.log("Turno de: " + s.jugadores[siguienteId].nombre);
        });
        
    }).catch((error) => console.error("Error al pasar el turno:", error));
};

window.verificarBancarrota = function(jugadorIdx, saldo) {
    if (saldo < 0) {
        let nombre = (window.nombres && window.nombres[jugadorIdx]) ? window.nombres[jugadorIdx] : "Jugador";
        
        // 1. Anuncio en el Game Log (usando push al chat/log de la sala)
        push(ref(db, 'salas/' + window.sala + '/chat'), {
            n: "Banco",
            m: `⚠️ ¡Alerta! ${nombre} ha caído en bancarrota con un saldo de $${saldo}.`,
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        // 2. Abrir Modal de Bancarrota (Estilo Barbie/Rosa)
        window.abrirModal("¡Bancarrota!", `
            <div style="text-align: center; padding: 10px;">
                <p>Tu saldo es <b>$${saldo}</b>.</p>
                <p>¡El Banco recomienda solicitar un préstamo urgente para continuar!</p>
                <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal(); window.abrirBanco();">Ir al Banco</button>
            </div>
        `);
    }
};

// --- Lógica del Banco ---
// --- BANCO CENTRAL: MENÚ PRINCIPAL ---
window.abrirBanco = async function() {
    if (typeof window.sala === 'undefined' || window.miIdx === -1 || !db) {
        window.abrirModal("Error", `
            <div class="modal-content">
                <p>Debes estar unido a una sala para acceder a los servicios bancarios.</p>
                <button class="btn-accion" style="width:100%" onclick="window.cerrarModal()">Aceptar</button>
            </div>
        `);
        return;
    }

    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jRef);
    const j = snap.val();
    if (!j) return;

    let contenido = "";
    if (j.tienePrestamo) {
        contenido = `
            <p>Préstamo activo: <b>$${j.montoPrestamo || 0}</b></p>
            <button class="btn-accion" style="width:100%; margin-top: 10px;" onclick="window.pagarPrestamo()">Liquidar Préstamo</button>
        `;
    } else {
        contenido = `<p>Selecciona un préstamo:</p>`;
        [200, 400, 650, 800, 1000].forEach(m => {
            contenido += `<button class="btn-accion" style="width:100%; margin-bottom: 8px;" onclick="window.solicitarPrestamo(${m})">Solicitar $${m}</button>`;
        });
    }

    window.abrirModal("🏦 Banco Central", `
        <div class="abrirModal">
            ${contenido}
            <button class="btn-cerrar" style="width:100%; margin-top:10px;" onclick="window.cerrarModal()">Cerrar</button>
        </div>
    `);
};

// --- SOLICITAR PRÉSTAMO ---
window.solicitarPrestamo = async function(monto) {
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jRef);
    const j = snap.val();

    if (j.tienePrestamo) {
        window.abrirModal("Error", `<div class="abrirModal"><p>Ya tienes un préstamo activo.</p><button class="btn-accion" onclick="window.cerrarModal()">Aceptar</button></div>`);
        return;
    }

    await update(jRef, { 
        tienePrestamo: true, 
        montoPrestamo: monto, 
        dinero: (j.dinero || 0) + monto 
    });

    window.abrirModal("✅ Éxito", `
        <div class="abrirModal">
            <p>Transacción aceptada.</p>
            <p>Monto recibido: <b>$${monto}</b></p>
            <button class="btn-accion" style="width:100%; margin-top:10px;" onclick="window.cerrarModal()">Aceptar</button>
        </div>
    `);
};

// --- PAGAR PRÉSTAMO ---
window.pagarPrestamo = async function() {
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jRef);
    const j = snap.val();

    if ((j.dinero || 0) < j.montoPrestamo) {
        window.abrirModal("Error", `<div class="abrirModal"><p>Saldo insuficiente para liquidar.</p><button class="btn-accion" onclick="window.cerrarModal()">Aceptar</button></div>`);
        return;
    }

    await update(jRef, { 
        tienePrestamo: false, 
        montoPrestamo: 0,
        dinero: j.dinero - j.montoPrestamo
    });

    window.abrirModal("🏦 Banco Central", `
        <div class="abrirModal">
            <p>Deuda liquidada correctamente.</p>
            <button class="btn-accion" onclick="window.cerrarModal()">Aceptar</button>
        </div>
    `);
};

// --- LÓGICA DE BANCARROTA ---
window.verificarBancarrota = function(jugadorIdx, saldo) {
    if (saldo < 0) {
        const nombre = (window.nombres && window.nombres[jugadorIdx]) ? window.nombres[jugadorIdx] : "Jugador";
        
        push(ref(db, 'salas/' + window.sala + '/chat'), {
            n: "Banco",
            m: `⚠️ ¡Alerta! ${nombre} ha caído en bancarrota con un saldo de $${saldo}.`,
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        window.abrirModal("¡Bancarrota!", `
            <div class="modal-content">
                <p>Tu saldo es <b>$${saldo}</b>.</p>
                <p>¡El Banco recomienda solicitar un préstamo urgente!</p>
                <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal(); window.abrirBanco();">Ir al Banco</button>
            </div>
        `);
    }
};

// --- Función lógica de Saldos ---
window.verSaldos = function() {
    if (!window.sala || typeof db === 'undefined') return;
    
    const jugadoresRef = ref(db, 'salas/' + window.sala + '/jugadores');

    get(jugadoresRef).then((snap) => {
        let txt = `<div class="modal-content">
                     <h2 style="color: #ff59aa; margin-top: 0; text-align: center;">Saldos</h2>
                     <div style="max-height: 300px; overflow-y: auto; text-align: left;">
                       <ul style='list-style:none; padding:0; margin:10px 0;'>`;
        
        snap.forEach(c => {
            let j = c.val();
            let key = c.key.toString();
            
            // FILTRO ESTRICTO: 
            // Un visitante es SOLAMENTE si la clave empieza por 'v' minúscula.
            // Si tu clave es "v1", "v2", etc., esto funcionará.
            let esVisitante = key.startsWith('v') && key.length > 1; 
            
            let nombre = esVisitante ? "Citizen " + key.replace('v','') : key;
            
            // LÓGICA DE SALDO:
            // Aseguramos que si es ciudadano (no visitante), el saldo inicial sea 1000
            let saldoInicial = esVisitante ? 2000 : 1000;
            
            // Si j.dinero no existe, asignamos el inicial, SI NO, usamos el que tiene en BD
            let dinero = (j.dinero !== undefined && j.dinero !== null) ? j.dinero : saldoInicial;
            
            txt += `<li style="margin-bottom: 8px; border-bottom: 1px solid #ffdde2; padding-bottom: 5px; display: flex; justify-content: space-between;">
                        <span style="font-weight:bold; color:#555;">${nombre} ${esVisitante ? '<i class="fas fa-shield-alt" style="color:#6c5ce7"></i>' : ''}</span> 
                        <span style="color:#ff59aa;">$${dinero}</span>
                    </li>`;
        });
        
        txt += `</ul></div>
                <button class="btn-accion" style="width:100%;" onclick="window.cerrarModal()">Cerrar</button>
                </div>`;
        
        window.abrirModal("🏦 Saldos", txt);
    });
};

window.abrirPagar = function() {
    if (typeof window.sala === 'undefined' || typeof window.miIdx === 'undefined') return;

    get(child(ref(db), 'salas/' + window.sala + '/jugadores/' + window.miIdx)).then((snap) => {
        const j = snap.val();
        let contenido = "";
        
        if (j && j.tienePrestamo) {
            contenido = `
                <p>Saldo pendiente: <b>$${j.montoPrestamo}</b></p>
                <button style="width:100%; margin-top: 10px;" onclick="window.pagarPrestamo()">Liquidar Préstamo</button>
                <button style="width:100%; margin-top: 5px;" onclick="window.cerrarModal()">Cancelar</button>`;
        } else {
            contenido = `<p>No tienes deudas pendientes.</p>
                         <button style="width:100%;" onclick="window.cerrarModal()">Aceptar</button>`;
        }
        
        window.abrirModal("Gestión Bancaria", contenido);
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

window.obtenerGrupo = function(pos) {
    return grupos.find(g => g.indices.includes(pos));
};

// Verifica si el jugador (o su equipo) posee todas las propiedades del color
window.verificarMonopolio = function(pos, todasLasPropiedades) {
    const grupo = obtenerGrupo(pos);
    if (!grupo) return false;
    // Compara si todos los índices del grupo tienen el mismo 'owner' que el jugador actual
    return grupo.indices.every(idx => 
        todasLasPropiedades && 
        todasLasPropiedades[idx] && 
        todasLasPropiedades[idx].owner === window.miIdx
    );
};

window.comprar = function(pos) {
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const propRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);

    get(jugadorRef).then((snap) => {
        const j = snap.val();
        const precio = window.mapa[pos].p;

        if (j.dinero >= precio) {
            update(jugadorRef, { dinero: j.dinero - precio });
            update(propRef, { 
                owner: window.miIdx, 
                nivel: 0, 
                hipotecada: false 
            });
            window.log("Has comprado " + window.mapa[pos].n);
            window.cerrarModal();
        } else {
            alert("Dinero insuficiente.");
        }
    });
};

window.verPropiedad = function(pos, permitirCompra = false) {
    const p = window.mapa[pos];
    if (!p || p.p === 0) return;

    const indicesTransporte = [8, 24, 26, 27];
    const esTransporte = indicesTransporte.includes(pos);
    
    const iconos = { 
        8:  'https://www.svgrepo.com/show/490615/car-2.svg',
        24: 'https://www.svgrepo.com/show/390391/motorcycle-cross-moto-bike.svg',
        26: 'https://www.svgrepo.com/show/490281/plane.svg',
        27: 'https://www.svgrepo.com/show/480860/train-station-mark.svg'
    };

    const filtroRosa = "invert(75%) sepia(21%) saturate(1828%) hue-rotate(293deg) brightness(105%) contrast(101%)";

    // Función auxiliar para mostrar errores estilizados
    window.mostrarError = function(mensaje) {
        const contenido = `
            <div class="carta-monopoly">
                <p style="text-align:center; margin:20px 0;">${mensaje}</p>
                <button class="btn-accion" style="width:100%;" onclick="window.cerrarModal()">Entendido</button>
            </div>`;
        window.abrirModal("Aviso", contenido);
    };

    get(ref(db, 'salas/' + window.sala)).then((snap) => {
        const data = snap.val();
        const climaIdx = data.climaIdx || 0;
        const prop = data.propiedades ? data.propiedades[pos] : null;
        const clima = window.climas[climaIdx];
        const mult = clima.mult;

        let alquiler;
        let listaAlquileres = "";

        if (esTransporte) {
            const dueño = prop ? prop.owner : null;
            const cantidad = dueño !== null ? indicesTransporte.filter(idx => data.propiedades[idx]?.owner === dueño).length : 0;
            const tabla = { 0: 0, 1: 250, 2: 350, 3: 350, 4: 450 };
            alquiler = Math.floor(tabla[cantidad] * mult);
            listaAlquileres = `<li>1 poseído: $250</li><li>2 poseídos: $350</li><li>3 poseídos: $350</li><li>4 poseídos: $450</li>`;
        } else {
            const niveles = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5];
            const nivel = prop ? (prop.nivel || 0) : 0;
            alquiler = Math.floor((p.p * niveles[nivel]) * mult);
            listaAlquileres = niveles.map((n, i) => `<li style="margin: 3px 0;">Nivel ${i + 1}: $${Math.floor(p.p * n * mult)}</li>`).join('');
        }

        const esDuenio = prop && prop.owner === window.miIdx;
        const estaHipotecada = prop && prop.hipotecada;
        const colorClima = mult < 1 ? '#e74c3c' : '#ff80bf';

        let contenido = `
            <div class="card-property">
                <div class="card-header">${p.n}</div>
                <div class="card-body">
                    ${esTransporte ? `<div style="text-align:center; margin:15px 0;"><img src="${iconos[pos]}" style="width:100px; height:auto; filter: ${filtroRosa};"></div>` : ''}
                    <p>Valor de compra: <b>$${p.p}</b></p>
                    <div class="alquiler-destacado" style="color: ${colorClima}; font-size: 1.2em; font-weight: bold;">
                        Alquiler actual: $${estaHipotecada ? 0 : alquiler}
                    </div>
                    <p style="font-size: 0.85em;">Clima: ${clima.n}${mult < 1 ? ' (Descuento aplicado)' : ''}</p>
                    <hr>
                    <p><b>Detalle de alquileres:</b></p>
                    <ul style="text-align: left; font-size: 0.9em; padding-left: 20px;">
                        ${listaAlquileres}
                    </ul>
                    <hr>`;

        if (!prop) {
            if (permitirCompra) {
                contenido += `<button class="btn-accion" style="background:#ff80bf; width:100%; margin-top:10px;" onclick="window.comprar(${pos})">Comprar Propiedad</button>`;
            } else {
                contenido += `<p style="color:gray; font-size:0.8em;">Debes estar en la casilla para comprar.</p>`;
            }
        } else if (esDuenio) {
            contenido += `<button class="btn-accion" style="background:#2ecc71; width:100%; margin-top:5px;" onclick="window.mejorar(${pos})">Mejorar (+$50)</button>
                          <button class="btn-accion" style="background:#95a5a6; width:100%; margin-top:5px;" onclick="window.hipotecar(${pos})">${estaHipotecada ? "Liberar" : "Hipotecar"}</button>`;
        } else if (!estaHipotecada) {
            contenido += `<p>Dueño: <b>${window.nombres[prop.owner]}</b></p>
                          <button class="btn-accion" style="background:#e67e22; width:100%; margin-top:5px;" onclick="window.pagarAlquiler(${prop.owner}, ${alquiler})">Pagar Alquiler</button>`;
        } else {
            contenido += `<p>Propiedad hipotecada por <b>${window.nombres[prop.owner]}</b>. No paga alquiler.</p>`;
        }

        contenido += `</div></div>`;
        window.abrirModal("Tarjeta de Propiedad", contenido);
    });
};

window.abrirIntercambio = function() {
    let modal = document.getElementById('modal');
    if (!modal) return;

    get(ref(db, 'salas/' + window.sala)).then((snap) => {
        let data = snap.val();
        if (!data || !data.propiedades) {
            window.abrirModal("Error", "No tienes propiedades para intercambiar.");
            return;
        }

        let misProps = Object.keys(data.propiedades).filter(idx => data.propiedades[idx].owner === window.miIdx);
        
        if (misProps.length === 0) {
            window.abrirModal("Aviso", "No posees propiedades actualmente.");
            return;
        }

        let optionsProps = misProps.map(idx => `<option value="${idx}">${window.mapa[idx].n}</option>`).join('');
        let optionsJugadores = Object.keys(data.jugadores || {}).filter(jIdx => String(jIdx) !== String(window.miIdx)).map(jIdx => 
            `<option value="${jIdx}">${window.nombres[jIdx]}</option>`
        ).join('');

        const contenido = `
            <div style="display:flex; flex-direction:column; gap: 10px; width: 100%;">
                <label><b>Selecciona propiedad:</b></label>
                <select id="select-prop" class="input-field">${optionsProps}</select>
                
                <label><b>Vender a:</b></label>
                <select id="select-jugador" class="input-field">${optionsJugadores}</select>
                
                <label><b>Valor de venta:</b></label>
                <input type="number" id="input-valor" class="input-field" min="100" max="999" value="250">
                
                <button class="btn-sidebar" style="background:#ff80bf; color:white; margin-top:10px;" onclick="window.ejecutarIntercambio()">Confirmar Oferta</button>
                <button class="btn-sidebar" style="background:#ffccd5;" onclick="window.cerrarModal()">Cancelar</button>
            </div>
        `;
        window.abrirModal("🤝 Intercambio", contenido);
    });
};

window.ejecutarIntercambio = function() {
    let pIdx = document.getElementById('select-prop').value;
    let destino = document.getElementById('select-jugador').value;
    let valor = parseInt(document.getElementById('input-valor').value);

    if (!destino) { alert("No hay jugadores disponibles."); return; }
    if (isNaN(valor) || valor < 100 || valor > 999) {
        alert("El valor debe estar entre 100 y 999.");
        return;
    }

    const ofertasRef = ref(db, 'salas/' + window.sala + '/ofertas');
    
    push(ofertasRef, {
        de: window.miIdx,
        para: destino,
        propiedad: pIdx,
        precio: valor,
        estado: 'pendiente'
    });
    
    alert("Oferta enviada a " + (window.nombres[destino] || "Jugador " + destino));
    window.cerrarModal();
};

window.escucharOfertas = function() {
    // 1. Verificación básica: sala y DB
    if (!window.sala || typeof db === 'undefined' || !db) return;
    
    // 2. Referencia directa
    const ofertasRef = ref(db, 'salas/' + window.sala + '/ofertas');
    
    onChildAdded(ofertasRef, (snap) => {
        const o = snap.val();
        const key = snap.key;

        if (o && String(o.para) === String(window.miIdx) && o.estado === 'pendiente') {
            const nombreVendedor = (window.nombres && window.nombres[o.de]) ? window.nombres[o.de] : "Jugador " + o.de;
            const nombreProp = window.mapa[o.propiedad] ? window.mapa[o.propiedad].n : "Propiedad";
            
            window.abrirModal("¡Oferta de Venta!", `
                <p>${nombreVendedor} te ofrece <b>${nombreProp}</b> por <b>$${o.precio}</b></p>
                <button class="btn-sidebar" style="background:#27ae60;" onclick="window.confirmarCompra('${key}')">Aceptar</button>
                <button class="btn-sidebar" style="background:#e74c3c;" onclick="window.cerrarModal()">Rechazar</button>
            `);
        }
    });
};

window.confirmarCompra = function(ofertaKey) {
    const ofertaRef = ref(db, 'salas/' + window.sala + '/ofertas/' + ofertaKey);
    get(ofertaRef).then((snap) => {
        const o = snap.val();
        if (!o || o.estado !== 'pendiente') return;
        window.ejecutarTransaccionCompra(o.de, o.para, o.propiedad, o.precio, ofertaKey);
    });
};

window.ejecutarTransaccionCompra = function(vendedorIdx, compradorIdx, pos, precio, ofertaKey) {
    const vRef = ref(db, 'salas/' + window.sala + '/jugadores/' + vendedorIdx);
    const cRef = ref(db, 'salas/' + window.sala + '/jugadores/' + compradorIdx);
    const pRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const oRef = ref(db, 'salas/' + window.sala + '/ofertas/' + ofertaKey);

    Promise.all([get(vRef), get(cRef)]).then(([snapV, snapC]) => {
        const v = snapV.val();
        const c = snapC.val();
        if (c.dinero >= precio) {
            update(vRef, { dinero: v.dinero + precio });
            update(cRef, { dinero: c.dinero - precio });
            update(pRef, { owner: compradorIdx });
            update(oRef, { estado: 'completada' });
            window.cerrarModal();
            window.log("Intercambio exitoso.");
        } else {
            alert("Fondos insuficientes.");
        }
    });
};

window.pagarAlquiler = function(ownerIdx, monto) {
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const dRef = ref(db, 'salas/' + window.sala + '/jugadores/' + ownerIdx);
    Promise.all([get(jRef), get(dRef)]).then(([snapJ, snapD]) => {
        const j = snapJ.val();
        const d = snapD.val();
        update(jRef, { dinero: j.dinero - monto });
        update(dRef, { dinero: d.dinero + monto });
        window.log("Alquiler de $" + monto + " pagado.");
        window.cerrarModal();
    });
};

window.mejorar = function(pos) {
    const pRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const tRef = ref(db, 'salas/' + window.sala + '/propiedades');

    Promise.all([get(tRef), get(jRef)]).then(([snapT, snapJ]) => {
        const todas = snapT.val();
        const j = snapJ.val();
        const costo = 50; 

        if (window.verificarMonopolio(pos, todas) && j.dinero >= costo) {
            const nivelActual = (todas[pos].nivel || 0);
            if (nivelActual < 5) {
                update(pRef, { nivel: nivelActual + 1 });
                update(jRef, { dinero: j.dinero - costo });
                window.cerrarModal();
                window.log("Propiedad mejorada al nivel " + (nivelActual + 1));
            } else {
                // Ventana emergente para el límite de hoteles
                window.mostrarError("¡Ya tienes un hotel (nivel máximo)!");
            }
        } else {
            // Ventana emergente con el diseño CSS solicitado
            window.mostrarError("Necesitas el set completo (monopolio) y dinero para mejorar.");
        }
    });
};

window.hipotecar = function(pos) {
    const pRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);

    Promise.all([get(pRef), get(jRef)]).then(([snapP, snapJ]) => {
        const p = snapP.val();
        const j = snapJ.val();
        const valorHipoteca = Math.floor(window.mapa[pos].p * 0.5);

        if (!p.hipotecada) {
            update(pRef, { hipotecada: true });
            update(jRef, { dinero: j.dinero + valorHipoteca });
        } else {
            const costoLiberar = Math.floor(valorHipoteca * 1.1);
            if (j.dinero >= costoLiberar) {
                update(pRef, { hipotecada: false });
                update(jRef, { dinero: j.dinero - costoLiberar });
            } else {
                alert("No tienes dinero para liberar la hipoteca.");
                return;
            }
        }
        window.cerrarModal();
    });
};

window.cartasEvento = [
    { txt: "¡Inversión exitosa! Tus acciones subieron, cobras $250.", v: 250 },
    { txt: "¡Multa por estacionamiento prohibido! Pagas $100.", v: -100 },
    { txt: "¡Bono de productividad! La empresa te premia con $200.", v: 200 },
    { txt: "¡Gastos médicos inesperados! Pagas $250 por una consulta.", v: -250 },
    { txt: "¡Encontraste dinero en tu abrigo viejo! Recibes $50.", v: 50 },
    { txt: "¡Reparación de alcantarillado! Debes pagar $150 al municipio.", v: -150 },
    { txt: "¡Premio de lotería local! Has ganado $300.", v: 300 },
    { txt: "¡Donación benéfica obligatoria! Pagas $100 por el bien común.", v: -100 }
];

window.obtenerCarta = function() {
    return window.cartasEvento[Math.floor(Math.random() * window.cartasEvento.length)];
};

window.manejarCasilla = async function(pos, esLlegadaPorMovimiento = false) {
    const posInt = parseInt(pos);
    const salaRef = ref(db, 'salas/' + window.sala);
    const snap = await get(salaRef);
    const data = snap.val();
    if (!data) return;

    // Lógica de compra
    const esTurnoActual = (data.turno === window.miIdx);
    const puedeComprar = esLlegadaPorMovimiento && esTurnoActual;

    const prop = data.propiedades ? data.propiedades[posInt] : null;
    const p = window.mapa[posInt];
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);

    // FUNCIÓN PARA PINTAR CASILLA (Persistencia visual)
    const pintarCasilla = (posicion, ownerIdx) => {
        const celda = document.getElementById(`cell-${posicion}`);
        if (celda) {
            const idx = window.nombres.indexOf(ownerIdx);
            const color = (idx !== -1) ? window.colores[idx] : "#ccc";
            celda.style.backgroundColor = color;
            celda.style.border = `2px solid ${color}`;
        }
    };

    // Si ya tiene dueño, siempre intentar pintar
    if (prop && prop.owner) {
        pintarCasilla(posInt, prop.owner);
    }

    // 1. CASO TRANSPORTE
    let g = (typeof window.obtenerGrupo === 'function') ? window.obtenerGrupo(posInt) : null;
    if (g && g.color === "#d24285") {
        if (!prop) window.verPropiedad(posInt, puedeComprar); 
        else if (prop.owner !== window.miIdx) {
            const esAliado = (data.jugadores[window.miIdx] && prop.equipo === data.jugadores[window.miIdx].equipo);
            if (esAliado) window.verPropiedad(posInt, false);
            else {
                const trans = [8, 24, 26, 27];
                const count = trans.filter(i => data.propiedades && data.propiedades[i] && data.propiedades[i].owner === prop.owner).length;
                const alquiler = { 1: 100, 2: 150, 3: 250, 4: 300 }[count] || 100;
                window.pagarAlquiler(prop.owner, alquiler);
                window.verPropiedad(posInt, false);
            }
        } else window.verPropiedad(posInt, false);
        return;
    }

    // 2. CASO PROPIEDAD NORMAL
    if (p && p.p > 0) {
        const tieneDuenio = prop && prop.owner !== undefined && prop.owner !== window.miIdx;
        if (tieneDuenio) window.verPropiedad(posInt, false);
        else window.verPropiedad(posInt, puedeComprar);
        return;
    }

    // --- EVENTOS ESPECIALES ---
    let contenido = "";
    let titulo = "";

    if (p.n === "ARCA COMUNAL" || p.n === "?") {
        const carta = window.obtenerCarta();
        titulo = (p.n === "ARCA COMUNAL") ? "Arca Comunal" : "Suerte (?)";
        update(jugadorRef, { dinero: increment(carta.v) });
        contenido = `<h2>${titulo}</h2><p>${carta.txt}</p>`;
    } 
    else if (posInt === 10) {
        titulo = "Cárcel";
        await update(jugadorRef, { enCarcel: 1 });
        window.mostrarOpcionesCarcel();
        return;
    }
    else if (p.n === "IMPUESTOS") {
        const monto = Math.floor(Math.random() * 300) + 50;
        update(jugadorRef, { dinero: increment(-monto) });
        update(salaRef, { pozoImpuestos: increment(monto) });
        titulo = "Impuestos";
        contenido = `<h2>Impuestos</h2><p>Pagas: $${monto}</p>`;
    }
    else if (p.n === "PARADA") {
        const pozo = data.pozoImpuestos || 0;
        update(jugadorRef, { dinero: increment(pozo) });
        update(salaRef, { pozoImpuestos: 0 });
        titulo = "Parada Gratuita";
        contenido = `<h2>Parada</h2><p>Recolectaste $${pozo}.</p>`;
    }

    if (contenido !== "") {
        window.abrirModal(titulo, contenido + `<button class="btn-accion" onclick="window.cerrarModal()">Aceptar</button>`);
    }
};

window.intentarHackeo = async function() {
    if (!window.sala || window.miIdx === undefined) return;
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    
    if (Math.random() < 0.5) {
        window.log("¡HACKEO EXITOSO!");
        await update(jugadorRef, { enCarcel: 0 });
    } else {
        window.log("¡FALLASTE!");
        const snap = await get(jugadorRef);
        const j = snap.val();
        await update(jugadorRef, { enCarcel: (j.enCarcel || 0) + 1 });
        if (typeof window.pasarTurno === 'function') window.pasarTurno();
    }
    document.getElementById('modal').style.display = 'none';
};

window.pagarFianza = function() {
    if (!window.sala || window.miIdx === undefined) return;
    update(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), {
        enCarcel: 0,
        dinero: increment(-200)
    });
    window.log("Fianza pagada.");
    document.getElementById('modal').style.display = 'none';
};

window.quedarseEnCarcel = function() {
    window.log("Cumpliendo condena...");
    document.getElementById('modal').style.display = 'none';
    if (typeof window.pasarTurno === 'function') window.pasarTurno();
};

window.abrirModalMisiones = function() {
    const esVisitante = window.esVisitante;
    let html = `<div class="abrirModal">`;
    html += `<span class="btn-cerrar-x" onclick="window.cerrarModal()">&times;</span>`;
    
    if (esVisitante) {
        html += `<h2 style="color: #ff59aa; margin-top: 0;">✨ Misiones del Paseo</h2>`;
        const misiones = [
            { id: 'benefactor', titulo: 'El Benefactor', desc: 'Regala $100 a un jugador.', tipo: 'angel', color: '#ff59aa' },
            { id: 'consejero', titulo: 'El Consejero', desc: 'Paga fianza de 3 jugadores.', tipo: 'angel', color: '#ff59aa' },
            { id: 'saboteador', titulo: 'El Saboteador', desc: 'Haz perder un turno a un jugador.', tipo: 'gargola', color: '#4a4a4a' }
        ];
        
        misiones.forEach(m => {
            html += `
            <div style="background: #fff; padding: 10px; margin: 10px 0; border-radius: 10px; border: 1px solid ${m.color}; text-align: left;">
                <div style="font-weight: bold; color: ${m.color};">${m.titulo}</div>
                <div style="font-size: 0.9em; margin: 5px 0;">${m.desc}</div>
                <button class="btn-accion" style="width:100%; background:${m.color};" onclick="window.completarMisionVisitante('${m.tipo}')">Completar</button>
            </div>`;
        });
    } else {
        html += `<h2 style="color: #ff59aa; margin-top: 0;">🏆 Objetivos del Jugador</h2>`;
        const misiones = [
            { titulo: 'Inversor', desc: 'Poseer 3 propiedades.', rec: 200 },
            { titulo: 'Coleccionista', desc: 'Completar un set.', rec: 300 },
            { titulo: 'Caja Fuerte', desc: 'Acumular $2,000.', rec: 650 }
        ];

        misiones.forEach(m => {
            html += `
            <div style="background: #fff; padding: 10px; margin: 10px 0; border-radius: 10px; border: 1px solid #ff80bf; text-align: left;">
                <div style="font-weight: bold; color: #ff59aa;">${m.titulo}</div>
                <div style="font-size: 0.9em; margin: 5px 0;">${m.desc}</div>
                <div style="font-size: 0.85em; font-weight: bold; color: #ff59aa;">Premio: $${m.rec}</div>
            </div>`;
        });
    }
    
    html += `</div>`;
    window.abrirModal(esVisitante ? "Misiones" : "Logros", html);
};

    window.renderEstrellas = function(valor) {
    // Busca el contenedor específico en el DOM
    const contenedor = document.getElementById('contenedor-estrellas');
    if (!contenedor) return;

    const estrellas = contenedor.querySelectorAll('.estrella');
    estrellas.forEach((star, index) => {
        // index empieza en 0, valor empieza en 1
        if (index < valor) {
            star.classList.add('activa');
        } else {
            star.classList.remove('activa');
        }
    });
};

window.obtenerTituloReputacion = function(reputacion) {
    if (reputacion === 0) return "Principiante en Sombras";
    if (reputacion <= 1) return "Novato Urbano";
    if (reputacion <= 2) return "Estrella Naciente";
    if (reputacion <= 3) return "Ciudadano Distinguido";
    if (reputacion <= 4) return "Icono de la Ciudad";
    return "Leyenda de Naeun Town";
};

window.mostrarAvisoReputacion = (repActual) => {
    const tituloNivel = window.obtenerTituloReputacion(repActual);
    
    const contenido = `
        <div class="abrirModal">
            <h2 style="color: #ff59aa; margin-top: 0;">Tu Nivel: ${tituloNivel}</h2>
            <div style="font-size: 3em; margin: 10px 0; color: #ff59aa; text-shadow: 0 0 5px #ffccd5;">★</div>
            <p style="font-size: 0.9em; color: #555; margin-bottom: 20px;">
                Reputación actual: ${repActual}/5. 
                Sigue completando misiones para alcanzar el siguiente rango.
            </p>
            <button class="btn-accion" style="width:100%;" onclick="window.cerrarModal(); window.abrirModalMisiones();">
                Ver mis misiones
            </button>
        </div>`;
    
    window.abrirModal("Reputación", contenido);
};

window.completarMisionVisitante = function(tipo) {
    // 1. Definir la ruta dependiendo de si es visitante o jugador
    const rol = window.esVisitante ? 'visitantes' : 'jugadores';
    const refPath = `salas/${window.sala}/${rol}/${window.miIdx}`;
    const userRef = ref(db, refPath);
    
    // 2. Obtener datos actuales para calcular el cambio
    get(userRef).then((snap) => {
        const datos = snap.val();
        let repActual = datos.reputacion || 3;
        
        // Ángel suma, Gárgola resta (limitado entre 0 y 5)
        const cambio = (tipo === 'angel') ? 1 : -1;
        const nuevaRep = Math.min(5, Math.max(0, repActual + cambio));
        
        // 3. Actualizar Firebase
        update(userRef, { 
            reputacion: nuevaRep,
            misionesCompletadas: increment(1)
        }).then(() => {
            // 4. Actualizar la interfaz visual
            window.renderEstrellas(nuevaRep);
            window.cerrarModal();
            
            // Opcional: mostrar un pequeño aviso de éxito
            console.log("Reputación actualizada a: " + nuevaRep);
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización del Chat
    const chatInput = document.getElementById('chat-msg');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.enviarMensaje();
            }
        });
    }

    // 2. Configuración del Dado (Patrón de seguridad)
    (function configurarDado() {
        const dice = document.getElementById('dice');
        if (dice) {
            // El uso de cloneNode es un truco para eliminar eventos antiguos
            const nuevoDice = dice.cloneNode(true);
            dice.parentNode.replaceChild(nuevoDice, dice);
            
            nuevoDice.onclick = (e) => {
                e.stopPropagation();
                if (typeof window.tirarDado === 'function') window.tirarDado();
            };
        } else {
            // Reintenta si el elemento aún no ha aparecido en el DOM
            setTimeout(configurarDado, 1000);
        }
    })();

    // 3. Generación del Tablero
    // Asegúrate de que esto se ejecute después de los elementos básicos
    if (typeof window.generarTablero === 'function') {
        window.generarTablero();
    }
});
