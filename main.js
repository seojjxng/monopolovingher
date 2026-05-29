import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set, runTransaction, update, onValue, push, onDisconnect, off, increment, onChildAdded } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

if (typeof window.db === 'undefined') {
    window.db = null; 
}

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
window.db = database; 

window.nombres = ["Dog", "Horse", "Hat", "Car"];
window.colores = ["#ffb7b2", "#f29f9f", "#c2f0c9", "#f3aee9"];

// Variables globales de listeners (Asegúrate de tener todas estas)
window.chatListener = null;
window.estadoListener = null;
window.climaListener = null;
window.logsListener = null; 
window.ofertasListener = null;   // <--- NECESARIO: Para evitar ofertas duplicadas
window.reputacionListener = null; // <--- NECESARIO: Para evitar que el listener de reputación se multiplique
window.estaLanzando = false;
window.notificacionListener = null;

// SISTEMA DE LOG GLOBAL - Sincronizado para Jugadores y Visitantes
window.log = function(mensaje) {
    // Si no hay sala, intentamos usar console.log para debug
    if (!window.sala || !window.db) {
        console.log("Log local (sin sala):", mensaje);
        return;
    }
    
    // Escribimos en la base de datos: Todos los que escuchen la sala verán esto
    const logsRef = ref(window.db, 'salas/' + window.sala + '/logs');
    push(logsRef, {
        mensaje: mensaje,
        timestamp: Date.now()
    });
};

// SISTEMA DE LOG GLOBAL - Sincronizado para Jugadores y Visitantes
window.log = function(mensaje) {
    // Si no hay sala, intentamos usar console.log para debug
    if (!window.sala || !window.db) {
        console.log("Log local (sin sala):", mensaje);
        return;
    }
    
    // Escribimos en la base de datos: Todos los que escuchen la sala verán esto
    const logsRef = ref(window.db, 'salas/' + window.sala + '/logs');
    push(logsRef, {
        mensaje: mensaje,
        timestamp: Date.now()
    });
};

window.agregarLogAlDOM = function(mensaje) {
    const logContainer = document.getElementById('game-log');
    if (logContainer) {
        const nuevoMensaje = document.createElement('div');
        nuevoMensaje.style.cssText = "font-size: 0.85em; margin: 4px 0; color: #d63384; font-weight: bold;";
        nuevoMensaje.innerHTML = `> ${mensaje}`;
        logContainer.appendChild(nuevoMensaje);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Limpieza si hay muchos logs
        if (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.children[0]);
        }
    }
};

// 1. ESTA ES LA FUNCIÓN QUE DEBES LLAMAR EN TU SINCRONIZAR
window.iniciarLogs = function() {
    if (!window.sala) return;
    // Limpieza antes de crear
    if (window.logsListener) off(window.logsListener);

    const logsRef = ref(window.db, 'salas/' + window.sala + '/logs');
    const logContainer = document.getElementById('game-log');
    if (logContainer) logContainer.innerHTML = ""; // Limpiamos pantalla

    // A. CARGA HISTÓRICA (El visitante ve lo que pasó antes de entrar)
    get(logsRef).then((snapshot) => {
        if (snapshot.exists()) {
            snapshot.forEach((childSnap) => {
                const msg = childSnap.val().mensaje;
                if (msg) window.agregarLogAlDOM(msg);
            });
        }
    });

    // B. ESCUCHA DE NUEVOS (En tiempo real)
    window.logsListener = onChildAdded(logsRef, (snapshot) => {
        const msg = snapshot.val().mensaje;
        if (msg) window.agregarLogAlDOM(msg);
    });
};

// 2. FUNCIÓN DE RENDERIZADO (Global para jugadores y visitantes)
window.agregarLogAlDOM = function(mensaje) {
    const logContainer = document.getElementById('game-log');
    if (logContainer) {
        const div = document.createElement('div');
        div.style.cssText = "font-size: 0.85em; margin: 4px 0; color: #d63384; font-weight: bold;";
        div.innerHTML = `> ${mensaje}`;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
};

// 3. Tus otras funciones de utilidad
window.checkDb = function() {
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("CRÍTICO: Firebase DB no está definida aún.");
        return false;
    }
    return true;
};

// 4. Ejecución final
if (typeof window.initCheatSystem === 'function') {
    window.initCheatSystem();
}

window.bgMusic = new Audio('https://dl.dropbox.com/scl/fi/hk4mo9t0v12r63c6nznon/.mp3?rlkey=a6zljcoh6spn484f3soqmi59g&st=8ntfk49p&dl=1'); 
window.bgMusic.loop = true;
window.bgMusic.volume = 0.3;

window.mostrarDedicatoria = function() {
    const dedicatoria = document.createElement('div');
    dedicatoria.id = 'dedicatoria-modal';
    dedicatoria.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 240, 243, 0.8); z-index: 10000; justify-content: center; align-items: center;";
    
    dedicatoria.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 20px; border: 2px solid #ff80bf; text-align: center; width: 300px; color: #c71585; position: relative;">
            <span onclick="window.cerrarDedicatoria()" 
                  style="cursor: pointer; position: absolute; top: 10px; right: 15px; font-size: 24px; font-weight: bold;">
                  &times;
            </span>
            <p style="margin: 20px 0 10px 0;">"A Naeun, mi musa; porque todas mis mejores ideas nacen pensando en ella."</p>
            <p><b>- Seojun</b></p>
        </div>`;
    
    document.body.appendChild(dedicatoria);
};

// Nueva función de cierre que también activa la música
window.cerrarDedicatoria = function() {
    const modal = document.getElementById('dedicatoria-modal');
    if (modal) modal.style.display = 'none';
    
    // Aquí forzamos el play después de que el usuario hizo clic en la 'x'
    window.bgMusic.play().catch(e => console.log("Aún bloqueado por el navegador"));
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

window.sincronizar = function() {
    console.log("DEBUG: Iniciando sincronización para sala:", window.sala);
    // 1. GUARDIA DE SEGURIDAD
    if (typeof window.db === 'undefined' || !window.db) {
        console.warn("Firebase DB no inicializada. Reintentando...");
        setTimeout(window.sincronizar, 500);
        return;
    }

    if (!window.sala || window.sala === "undefined") {
        console.warn("Sincronización abortada: ID de sala no definido.");
        return;
    }

    console.log("Sincronizando sala:", window.sala);

    // 2. LIMPIEZA TOTAL DE LISTENERS
    if (window.chatListener) { off(window.chatListener); window.chatListener = null; }
    if (window.estadoListener) { off(window.estadoListener); window.estadoListener = null; }
    if (window.climaListener) { off(window.climaListener); window.climaListener = null; }
    if (window.logsListener) { off(window.logsListener); window.logsListener = null; }
    if (window.ofertasListener) { off(window.ofertasListener); window.ofertasListener = null; }
    if (window.reputacionListener) { off(window.reputacionListener); window.reputacionListener = null; }
    if (window.notificacionListener) { off(window.notificacionListener); window.notificacionListener = null; }

    // 3. REFERENCIAS
    const salaRef = ref(window.db, 'salas/' + window.sala);
    const chatRef = ref(window.db, 'salas/' + window.sala + '/chat');
    const climaRef = ref(window.db, 'salas/' + window.sala + '/climaIdx');

    // Inicializamos logs para todos (Jugadores y Visitantes)
    if (typeof window.iniciarLogs === 'function') {
        window.iniciarLogs();
    }

    // 4. CHAT LISTENER
    window.chatListener = onValue(chatRef, (snap) => {
    // 1. Buscamos el elemento PRIMERO
    const chatLog = document.getElementById('chat-log');
    
    // 2. Si no existe, avisamos en la consola para detectar el error
    if (!chatLog) {
        console.error("¡ERROR! El elemento 'chat-log' no existe en el DOM de esta vista.");
        return; 
    }
    
    // 3. Si existe, procedemos con la lógica
    const data = snap.val();
    chatLog.innerHTML = ""; 
    if (!data || typeof data !== 'object') return;

        Object.values(data).forEach(m => {
            if (m.n === "Sistema" && !m.m) return;
            const colorEstilo = m.esRosa ? "#ff80bf" : "#333";
            const nombreDisplay = (m.n === "Info" || m.n === "Sistema") ? "" : `<b>${m.n}:</b>`;
            const msgDiv = document.createElement('div');
            msgDiv.style.cssText = `color: ${colorEstilo}; margin-bottom: 5px; text-align: left; word-wrap: break-word;`;
            msgDiv.innerHTML = `<small>[${m.t || "00:00"}]</small> ${nombreDisplay} ${m.m}`;
            chatLog.appendChild(msgDiv);
        });
        chatLog.scrollTop = chatLog.scrollHeight;
    });

    // 5. ESTADO LISTENER (Sincronización maestra)
    window.estadoListener = onValue(salaRef, (snap) => {
        const s = snap.val();
        if (!s) return; 
        window.salaData = s;
        window.creadorSala = s.creador;

        // Pintamos el tablero
        if (typeof window.pintarTodasLasCasillas === 'function') {
            try { window.pintarTodasLasCasillas(s); } catch (err) { console.warn("Esperando datos..."); }
        }

        // LÓGICA DE BOTÓN INICIAR (Blindado contra parpadeos)
        const btnIniciar = document.getElementById('btn-iniciar-partida');
        if (btnIniciar) {
            const debeSerVisible = (window.miIdx && window.miIdx === s.creador && s.estado === "esperando");
            btnIniciar.style.display = ''; 
            if (debeSerVisible) {
                btnIniciar.classList.remove('btn-iniciar-oculto');
                btnIniciar.classList.add('btn-iniciar-visible');
            } else {
                btnIniciar.classList.remove('btn-iniciar-visible');
                btnIniciar.classList.add('btn-iniciar-oculto');
            }
        }

        // Control de Turnos
        if (window.estadoPrevio === "esperando" && s.estado === "jugando") {
            if (typeof window.anunciar === 'function') window.anunciar("¡La partida ha comenzado!");
        }
        window.estadoPrevio = s.estado;

        // UI Turnos y Botones
        if (typeof window.actualizarTurnoUI === 'function') window.actualizarTurnoUI(s);

        const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
        if (btnDado) {
            const esMiTurno = (s.estado === "jugando" && s.turno === window.miIdx);
            btnDado.style.pointerEvents = esMiTurno ? 'auto' : 'none';
            btnDado.style.opacity = esMiTurno ? '1' : '0.5';
            btnDado.style.cursor = esMiTurno ? 'pointer' : 'default';
        }

        if (s.jugadores && typeof window.actualizarTokens === 'function') {
            try { window.actualizarTokens(s.jugadores); } catch (e) { console.error(e); }
        }
    });

    // 6. CLIMA LISTENER
    window.climaListener = onValue(climaRef, (snap) => {
        const val = snap.val();
        const idx = (val !== null && val !== undefined) ? val : 0;
        const elClima = document.getElementById('clima-display');
        if (elClima && window.climas && window.climas[idx]) elClima.innerText = `Clima: ${window.climas[idx].n}`;
        
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
    // Bonanza (Suben alquiler)
    { n: "Primavera Soleada", mult: 1.0, tipo: "bonanza" }, 
    { n: "Primavera Lluviosa", mult: 1.0, tipo: "bonanza" },
    { n: "Verano Caluroso", mult: 1.0, tipo: "bonanza" }, 
    { n: "Verano Nublado", mult: 1.0, tipo: "bonanza" },
    
    // Neutral (Se mantienen)
    { n: "Otoño Fresco", mult: 1.0, tipo: "neutral" }, 
    { n: "Otoño Ventoso", mult: 1.0, tipo: "neutral" },
    
    // Desastres (Bajan alquiler)
    { n: "Lluvia Fuerte", mult: 0.7, tipo: "desastre" }, 
    { n: "Tormenta Eléctrica", mult: 0.5, tipo: "desastre" },
    { n: "Ventisca", mult: 0.6, tipo: "desastre" }, 
    { n: "Nevada Intensa", mult: 0.6, tipo: "desastre" },
    { n: "Tornado", mult: 0.5, tipo: "desastre" }
]);

// --- Lógica del Ciclo Automático (AJUSTADO) ---
window.iniciarCicloClima = function() {
    if (window.climaInterval) clearInterval(window.climaInterval);
    
    window.climaInterval = setInterval(async () => {
        const salaSnap = await get(ref(db, 'salas/' + window.sala));
        const salaData = salaSnap.val();
        if (!salaData) return;

        // Si hay visitantes, el sistema automático se detiene (toman el control ellos)
        const hayVisitantes = salaData.visitantes && Object.keys(salaData.visitantes).length > 0;
        if (hayVisitantes) return; 

        const controlRef = ref(db, 'salas/' + window.sala + '/controladorClima');
        const snap = await get(controlRef);
        const ctrl = snap.val();
        const ahora = Date.now();
        
        if (!ctrl || (ahora - (ctrl.timestamp || 0) > 300000)) {
            const nuevoIdx = Math.floor(Math.random() * window.climas.length);
            const nuevoClima = window.climas[nuevoIdx];
            
            // 1. Calcular el ajuste automático
            const porcentaje = Math.random() < 0.5 ? 0.05 : 0.10;
            let ajuste = 0;
            
            if (nuevoClima.tipo === "desastre") ajuste = -porcentaje;
            else if (nuevoClima.tipo === "bonanza") ajuste = porcentaje;

            // 2. Actualizar el clima Y el modificador en Firebase
            await update(ref(db, 'salas/' + window.sala), { 
                climaIdx: nuevoIdx,
                modificadorAlquiler: ajuste
            });
            
            // 3. Actualizar también el timestamp del controlador para el cooldown
            await update(controlRef, { timestamp: ahora });
            
            // 4. Registro del Sistema en el Log Global
            const mensaje = `¡El clima cambió a ${nuevoClima.n}! ${ajuste !== 0 ? 'Ajuste de alquiler: ' + (ajuste * 100).toFixed(0) + '%' : 'Alquiler estable.'}`;
            
            await update(ref(db, 'salas/' + window.sala + '/logs'), {
                mensaje: mensaje,
                timestamp: ahora
            });
        }
    }, 600000); 
};

// 2. Datos Globales
window.mapa = [
    {n:"SALIDA",p:0},{n:"ITAEWON",p:100},{n:"ARCA COMUNAL",p:0},{n:"BUSAN",p:200},
    {n:"SEOCHO",p:250},{n:"GANGNAM",p:300},{n:"?",p:0},{n:"CYBER CAFÉ",p:400},
    {n:"AUTOMÓVIL",p:450},{n:"CÁRCEL",p:0},{n:"CAFETERÍA",p:500},{n:"RESTAURANTE",p:520},
    {n:"?",p:0},{n:"SPA",p:300},{n:"CINE",p:450},{n:"HOSPITAL",p:200},
    {n:"TEATRO",p:500},{n:"ESTADIO",p:950},{n:"ARCA COMUNAL",p:0},{n:"SMENT",p:900},
    {n:"YG ENT",p:750},{n:"YJP",p:750},{n:"IMPUESTOS",p:0},{n:"HYBE CORP.",p:1000},
    {n:"MOTO",p:400},{n:"PARADA",p:0},{n:"AVIÓN",p:300},{n:"TREN",p:600}
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
            <div class="abrirModal">
                <p>Por favor, ingresa un <b>ID de sala</b> válido.</p>
                <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Aceptar</button>
            </div>
        `);
        return;
    }

    get(ref(db, 'salas/' + id)).then((snapshot) => {
        if (snapshot.exists()) {
            window.abrirModal("Sala encontrada", `
                <div class="abrirModal">
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
    
    get(ref(db, 'salas/' + salaId + '/jugadores')).then((snap) => {
        const jugadoresOcupados = snap.exists() ? Object.keys(snap.val()) : [];
        
        let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
        roles.forEach((rol) => {
            const ocupado = jugadoresOcupados.includes(rol);
            const estilo = ocupado ? "background:#ccc; color:#666; cursor:not-allowed;" : "";
            
            // Si está ocupado, simplemente llama a la función de error
            html += `<button class="btn-sidebar" style="${estilo}" 
                        onclick="${ocupado ? `window.mostrarErrorOcupado('${rol}')` : `window.procesarUnion('${salaId}', '${rol}', ${esCreacion})`}">
                        ${rol} ${ocupado ? "(Ocupado)" : ""}
                     </button>`;
        });
        html += `</div>`;
        window.abrirModal("Elige tu ficha", html);
    });
};

window.mostrarErrorOcupado = function(rol) {
    // Aquí no se cierra nada, solo se abre el modal de aviso
    const htmlError = `
        <div style="text-align:center;">
            <p style="color:red; font-size: 1.1em;">La ficha <b>${rol}</b> ya ha sido seleccionada.</p>
            <p>Por favor, elige otra ficha disponible.</p>
        </div>`;
        
    window.abrirModal("⚠️ Ficha Ocupada", htmlError);
};

window.procesarUnion = async function(salaId, rol, esCreacion) {
    window.sala = salaId;
    
    // Función de seguridad para mostrar el botón
    const forzarMostrarBoton = () => {
        const btn = document.getElementById('btn-iniciar-partida');
        if (btn) {
            btn.style.setProperty('display', 'flex', 'important');
            console.log("Botón de inicio forzado a visible.");
        } else {
            console.error("ERROR: No se encontró el elemento 'btn-iniciar-partida' en el DOM.");
        }
    };
    
    const pieceMap = { "Dog": 0, "Horse": 1, "Hat": 2, "Car": 3 };
    const esVisitante = rol.toString().startsWith('v');
    const dineroInicial = esVisitante ? 2000 : 1500;
    
    const datosJugador = { 
        nombre: rol, 
        pieceNum_: pieceMap[rol] ?? 0, 
        dinero: dineroInicial,
        pos: 0, 
        activo: true, 
        intentosFallidos: 0, 
        estrellas: 0, 
        tipoReputacion: 'neutral', 
        misionesCompletadas: 0,
        accionesIncorrectas: 0,
        visitasCarcel: 0, 
        cumplidasCarcel: 0,
        enCarcel: 0 
    };
    
    if (esCreacion) {
        const roomData = { 
            estado: "esperando", 
            creador: rol, 
            jugadores: { [rol]: datosJugador } 
        };
        await set(ref(db, 'salas/' + salaId), roomData);
        
        window.miIdx = rol; 
        window.creadorSala = rol; 
        window.esVisitante = esVisitante;
        
        forzarMostrarBoton(); // Si es creador, mostramos siempre
        
        window.cerrarModal();
        window.anunciarEnChat(salaId, rol + " ha creado la sala.");
        window.abrirModal("Éxito", `<p>Sala creada como <b>${rol}</b></p>`);
        
        window.sincronizar();
        window.escucharOfertas(); 
        
    } else {
        const dbRef = ref(db, 'salas/' + salaId + '/jugadores');
        runTransaction(dbRef, (jugadores) => {
            if (!jugadores) jugadores = {};
            if (jugadores[rol]) return undefined; 
            jugadores[rol] = datosJugador;
            return jugadores;
        }).then((res) => {
            if (res.committed) {
                window.miIdx = rol; 
                window.esVisitante = esVisitante;
                
                // Si el que se une es el creador (o quieres que el primero lo vea), forzamos
                forzarMostrarBoton();
                
                window.cerrarModal();
                window.anunciarEnChat(salaId, rol + " se ha unido.");
                
                window.sincronizar();
                window.escucharOfertas(); 
            } else {
                window.mostrarErrorOcupado(rol);
            }
        });
    }
};

window.iniciarPartida = function() {
    if (!window.sala) return;
    
    const salaRef = ref(db, 'salas/' + window.sala);
    
    get(salaRef).then((snap) => {
        const s = snap.val();
        if (!s || !s.jugadores) {
            window.log("No hay jugadores en la sala.");
            return;
        }

        if (s.estado === "jugando") return;

        const jugadoresIds = Object.keys(s.jugadores);
        const jugadorInicial = jugadoresIds[Math.floor(Math.random() * jugadoresIds.length)];

        let actualizaciones = { estado: "jugando", turno: jugadorInicial };

        // Repartir dinero a todos los que están en la rama 'jugadores'
        jugadoresIds.forEach(id => {
            actualizaciones['jugadores/' + id + '/dinero'] = 1500;
            actualizaciones['jugadores/' + id + '/enCarcel'] = 0; 
        });

        update(salaRef, actualizaciones).then(() => {
            window.log("¡Partida iniciada!");
            window.sincronizar();
        });
    });
};

window.mostrarAviso2v2 = function() {
    window.abrirModal("Aviso", `
        <div style="text-align: center; padding: 20px;">
            <p>El modo <b>2v2</b> está actualmente en proceso de desarrollo.</p>
            <p>¡Muy pronto estará disponible!</p>
            <button class="btn-sidebar" style="margin-top: 20px;" onclick="window.cerrarModal()">Entendido</button>
        </div>
    `);
};

// --- 4. Unión de Visitante (Automática) ---
window.unirseComoVisitante = async function(salaId, esCreacion, nombreVisitante = "Citizen") {
    try {
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
            await set(ref(window.db, 'salas/' + salaId), roomData);
            window.miIdx = nuevoRol;
            window.creadorSala = nuevoRol;
        } else {
            const dbRef = ref(window.db, 'salas/' + salaId + '/jugadores');
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
            if (!res.committed) throw new Error("No se pudo unir a la sala (Transacción fallida)");
        }

        // --- INICIALIZACIÓN DE DATOS ---
        const visitanteRef = ref(window.db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
        await set(visitanteRef, {
            nombre: nombreVisitante,
            activo: true, 
            pos: 0, 
            reputacion: 0,
            misionesCompletadas: 0
        });

        // --- FINALIZACIÓN Y UI (Blindada) ---
        window.cerrarModal();
        if (typeof window.anunciarEnChat === 'function') window.anunciarEnChat(salaId, "Un visitante se ha unido a la partida.");
        if (typeof window.actualizarBotonesPoderes === 'function') window.actualizarBotonesPoderes();
        
        // CORRECCIÓN DEL ERROR: Solo ejecutar si la función existe
        if (typeof window.renderEstrellas === 'function') {
            window.renderEstrellas(0);
        }

        window.abrirModal("Éxito", `<p>Entraste como <b>Visitante</b></p><button class="btn-sidebar" onclick="window.cerrarModal()">Comenzar</button>`);
        
        // LLAMADA CRÍTICA:
        window.sincronizar();

    } catch (error) {
        console.error("Error crítico al unirse:", error);
        window.abrirModal("Error", `<p>No se pudo conectar: ${error.message}</p>`);
    }
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

window.enviarMensaje = function() {
    const input = document.getElementById('chat-msg');
    const mensaje = input.value.trim();
    if (mensaje === "" || !window.sala || window.miIdx === undefined) return;
    let idMostrar = window.miIdx;
    if (typeof idMostrar === 'string' && idMostrar.startsWith('v')) {
        const num = idMostrar.replace('v', '');
        idMostrar = "Visitante " + num;
    }
    push(ref(window.db, 'salas/' + window.sala + '/chat'), {
        n: idMostrar,
        m: mensaje,
        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }).then(() => { input.value = ""; }).catch((e) => console.error(e));
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
    
    // Usamos window.db por consistencia
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("Firebase DB no está definida.");
        return;
    }

    window.estaLanzando = true;
    const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
    if (btnDado) btnDado.style.pointerEvents = 'none';

    try {
        const salaRef = ref(window.db, 'salas/' + window.sala);
        const snap = await get(salaRef);
        
        if (!snap.exists()) { console.error("Sala perdida"); return; }
        let s = snap.val();

        // Seguridad: Verificar que existen jugadores
        if (!s.jugadores) { console.error("No hay jugadores en la sala"); window.estaLanzando = false; return; }

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

        // --- CORRECCIÓN CÁRCEL (BLINDADA) ---
        // Usamos (s.jugadores[window.miIdx]?.enCarcel ?? 0) para evitar que falle si es undefined
        const miJugador = s.jugadores[window.miIdx];
        if (!miJugador) return; 

        if ((miJugador.enCarcel ?? 0) > 0) {
            window.mostrarOpcionesCarcel();
            window.estaLanzando = false;
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            return;
        }

        // Lanzamiento del dado
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const dado = (array[0] % 6) + 1;
        
        window.lanzarDado3D(dado);
        await new Promise(r => setTimeout(r, 700));

        const posAnterior = Number(miJugador.pos || 0);
        const nuevaPos = (posAnterior + dado) % 28;
        
        // --- LÓGICA DE SALIDA ($100 AUTOMÁTICOS) ---
        if (nuevaPos < posAnterior) {
            await update(ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), {
                dinero: increment(250)
            });
            window.log("¡Pasaste por SALIDA y ganaste $250!");
        }

        // Actualización de posición
        const miJugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
        await update(miJugadorRef, { pos: nuevaPos });

        // Lógica de pasar turno
        if (!esSolo) {
            if (dado !== 6) {
                window.pasarTurno();
            } else {
                const nombreJugador = (window.nombres && window.nombres[window.miIdx]) ? window.nombres[window.miIdx] : window.miIdx;
                window.log(nombreJugador + " sacó 6 y repite turno!");
            }
        }

        // --- MANEJO DE CASILLA ---
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

window.lanzarDado3D = function(resultado) {
    const dice = document.getElementById('dice');
    if (!dice) return;

    dice.classList.remove('rolling');
    dice.style.animation = "none";
    dice.style.transition = "none";
    dice.style.transform = "rotateX(0deg) rotateY(0deg)";
    void dice.offsetWidth;
    dice.style.animation = "girarDado 0.6s ease-out forwards";
    dice.classList.add('rolling');

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
    }, 650);
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

window.pasarTurno = async function() {
    const salaRef = ref(db, 'salas/' + window.sala);
    const snap = await get(salaRef);
    const s = snap.val();
    
    // Si no hay jugadores, abortar
    if (!s || !s.jugadores) return;

    // Filtramos jugadores válidos (que NO son visitantes)
    const listaJugadores = Object.keys(s.jugadores).filter(id => !id.startsWith('v'));
    
    // Si no hay jugadores normales, no se puede pasar turno
    if (listaJugadores.length === 0) return;

    // Asegurar que s.turno sea válido, si no, empezar por el primero
    let idxActual = listaJugadores.indexOf(s.turno);
    if (idxActual === -1) idxActual = 0; 
    
    const buscarSiguiente = async (indice) => {
        let siguienteIdx = (indice + 1) % listaJugadores.length;
        let siguienteId = listaJugadores[siguienteIdx];
        let jugadorSiguiente = s.jugadores[siguienteId];

        // Validar que el objeto jugadorSiguiente exista
        if (!jugadorSiguiente) return buscarSiguiente(siguienteIdx);

        if (jugadorSiguiente.enCarcel > 0) {
            let nuevoContador = jugadorSiguiente.enCarcel - 1;
            
            await update(ref(db, `salas/${window.sala}/jugadores/${siguienteId}`), {
                enCarcel: nuevoContador
            });

            if (nuevoContador > 0) {
                window.log(jugadorSiguiente.nombre + " sigue en la cárcel.");
                return await buscarSiguiente(siguienteIdx);
            } else {
                window.log(jugadorSiguiente.nombre + " ha salido de la cárcel.");
                return siguienteId;
            }
        }
        return siguienteId;
    };

    const siguienteId = await buscarSiguiente(idxActual);
    
    await update(salaRef, { turno: siguienteId });
    window.log("Turno de: " + (s.jugadores[siguienteId]?.nombre || siguienteId));
};

// --- LÓGICA DE UI ACTUALIZADA ---
window.actualizarTurnoUI = function(s) {
    const display = document.getElementById('turno-display');
    if (!display) return;

    if (!s || s.estado !== "jugando") {
        display.innerText = "Turno: Esperando...";
        return;
    }

    let turnoId = s.turno;
    if (!turnoId) {
        display.innerText = "Turno: Iniciando...";
        return;
    }

    if (String(turnoId).startsWith('v')) {
        display.innerText = "Turno: Esperando jugador...";
        return;
    }
    
    const jugadorInfo = s.jugadores ? s.jugadores[turnoId] : null;
    if (!jugadorInfo) {
        display.innerText = "Turno: Error en ID...";
        return;
    }

    const nombreJugador = jugadorInfo.nombre || ("ID: " + turnoId);
    // Ahora enCarcel es un número, si es > 0 está preso
    const esPrisionero = (jugadorInfo.enCarcel || 0) > 0;
    const estadoCárcel = esPrisionero ? " 🔒" : "";
    
    display.innerText = "Turno: " + nombreJugador + estadoCárcel;
};

window.depurarTurno = async function() {
    console.log("--- INICIANDO DEPURACIÓN DE TURNO ---");
    if (typeof window.db === 'undefined' || !window.db || !window.sala) return;

    try {
        const salaRef = ref(window.db, 'salas/' + window.sala);
        const snap = await get(salaRef);
        const s = snap.val();
        
        if (!s || !s.jugadores) return;

        const keys = Object.keys(s.jugadores).filter(k => !String(k).startsWith('v'));
        
        keys.forEach(id => {
            const j = s.jugadores[id];
            console.log(`Jugador [${id}]: ${j.nombre}, Pos: ${j.pos}, Turnos cárcel restantes: ${j.enCarcel || 0}`);
        });
    } catch (error) {
        console.error("Error durante la depuración:", error);
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

    // Limpiamos tokens viejos
    document.querySelectorAll('.token').forEach(t => t.remove());

    Object.keys(jugadores).forEach((id) => {
        const jugador = jugadores[id];
        
        // --- AQUÍ ESTÁ LA SEGURIDAD ---
        // Si 'jugador' no existe, nos saltamos esta vuelta del bucle
        if (!jugador) return; 
        
        if (String(id).startsWith('v')) return;

        // Usamos Optional Chaining (?.) por si acaso 'pos' no existe
        const p = parseInt(jugador.pos) || 0; 
        const nombre = jugador.nombre;
        const celda = document.getElementById('cell-' + p);

        // Verificamos que todo exista antes de crear nada
        if (celda && nombre && tokensMap[nombre]) {
            celda.style.position = 'relative';

            const token = document.createElement('img');
            token.className = 'token';
            token.id = 'token-' + id;
            token.src = tokensMap[nombre];

            // Ajustes de estilo
            token.style.position = 'absolute';
            token.style.top = '50%';
            token.style.left = '50%';
            token.style.transform = 'translate(-50%, -50%)';
            token.style.width = '50px';
            token.style.height = '50px';
            token.style.objectFit = 'contain'; 
            token.style.zIndex = '9999';
            token.style.pointerEvents = 'none';
            token.style.border = 'none'; 
            token.style.borderRadius = '0'; 
            token.style.boxShadow = 'none';
            token.style.backgroundColor = 'transparent';

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
            m: `¡Alerta! ${nombre} ha caído en bancarrota con un saldo de $${saldo}.`,
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
            <div class="abrirModal">
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

    window.abrirModal("Banco Central", `
        <div class="abrirModal">
            ${contenido}
        </div>
    `);
};

// --- SOLICITAR PRÉSTAMO ---
window.solicitarPrestamo = async function(monto) {
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jRef);
    const j = snap.val();

    if (j.tienePrestamo) {
        window.abrirModal("Error", `<div class="abrirModal"><p>Ya tienes un préstamo activo.</p></div>`);
        return;
    }

    await update(jRef, { 
        tienePrestamo: true, 
        montoPrestamo: monto, 
        dinero: (j.dinero || 0) + monto 
    });

    window.abrirModal("Éxito", `
        <div class="abrirModal">
            <p>Transacción aceptada.</p>
            <p>Monto recibido: <b>$${monto}</b></p>
            <button class="btn-accion" style="width:100%; margin-top:10px;" onclick="window.cerrarModal()">Aceptar</button>
        </div>
    `);
};

// --- PAGAR PRÉSTAMO ---
window.pagarPrestamo = async function() {
    // 1. Verificación de seguridad inicial
    if (typeof window.sala === 'undefined' || typeof window.miIdx === 'undefined') {
        window.abrirModal("Error", "<p>Debes estar en una sala para realizar pagos.</p>");
        return;
    }

    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jRef);
    const j = snap.val();

    // 2. Validación de datos
    if (!j) {
        window.abrirModal("Error", "No se encontraron datos del jugador.");
        return;
    }

    // Verificamos que tenga préstamo
    if (!j.tienePrestamo || j.montoPrestamo <= 0) {
        window.abrirModal("Banco Central", "<p>No tienes deudas pendientes.</p><button class='btn-accion' onclick='window.cerrarModal()'>Aceptar</button>");
        return;
    }

    // 3. Verificación de saldo usando el valor actual de 'dinero' en la DB
    const saldoActual = (j.dinero || 0);
    if (saldoActual < j.montoPrestamo) {
        window.abrirModal("Error", `<p>Saldo insuficiente. Tu saldo actual es de <b>$${saldoActual}</b> y la deuda es de <b>$${j.montoPrestamo}</b>.</p><button class='btn-accion' onclick='window.cerrarModal()'>Aceptar</button>`);
        return;
    }

    // 4. Aplicar cambios de forma atómica
    try {
        // Ahora usamos 'reputacion' (o 'estrellas' como respaldo) para mantener la consistencia
        const repActual = parseInt(j.reputacion || j.estrellas || 0);
        const nuevaRep = repActual + 1;

        await update(jRef, { 
            tienePrestamo: false, 
            montoPrestamo: 0,
            dinero: increment(-j.montoPrestamo), 
            reputacion: nuevaRep,
            // Opcional: limpiar el campo viejo si ya migraste todo a 'reputacion'
            estrellas: null 
        });

        // 5. Refrescar la interfaz
        // Si tienes una función para renderizar la reputación, llámala aquí
        if (typeof window.renderReputacion === 'function') {
            window.renderReputacion(nuevaRep);
        }

        window.log("¡Deuda liquidada! Has ganado 1 punto de reputación.");

        window.abrirModal("Banco Central", `
            <div class="modal-body">
                <p>Deuda liquidada correctamente.</p>
                <p>Has recibido <b>+1 punto</b> de reputación por tu responsabilidad financiera.</p>
                <button class="btn-accion" style="margin-top:15px;" onclick="window.cerrarModal()">Aceptar</button>
            </div>
        `);
    } catch (error) {
        console.error("Error al pagar préstamo:", error);
        window.abrirModal("Error", "No se pudo conectar con el servidor.");
    }
};

// --- LÓGICA DE BANCARROTA ---
window.verificarBancarrota = function(jugadorIdx, saldo) {
    if (saldo < 0) {
        const nombre = (window.nombres && window.nombres[jugadorIdx]) ? window.nombres[jugadorIdx] : "Jugador";
        
        push(ref(db, 'salas/' + window.sala + '/chat'), {
            n: "Banco",
            m: `¡Alerta! ${nombre} ha caído en bancarrota con un saldo de $${saldo}.`,
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
        let txt = `<div class="modal-body">
                     <h2 style="color: #ff59aa; margin-top: 0; text-align: center;">Saldos</h2>
                     <div style="max-height: 300px; overflow-y: auto; text-align: left;">
                       <ul style='list-style:none; padding:0; margin:10px 0;'>`;
        
        if (!snap.exists()) {
            txt += `<li style="text-align:center; color:#999;">No hay jugadores.</li>`;
        } else {
            snap.forEach(c => {
                let j = c.val();
                let key = c.key.toString();
                let esVisitante = key.startsWith('v') && key.length > 1;
                
                // Mantenemos el dinero real, sin modificaciones ni reseteos
                let dinero = j.dinero || 0;
                
                let nombre = esVisitante ? "Citizen " + key.replace('v','') : key;
                
                txt += `<li style="margin-bottom: 8px; border-bottom: 1px solid #ffdde2; padding-bottom: 5px; display: flex; justify-content: space-between;">
                            <span style="font-weight:bold; color:#555;">${nombre}</span> 
                            <span style="color:#ff59aa;">$${dinero}</span>
                        </li>`;
            });
        }
        
        txt += `</ul></div></div>`;
        window.abrirModal("Saldos", txt);
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
                <button class="btn-accion" style="width:100%; margin-top: 10px;" onclick="window.pagarPrestamo()">Liquidar Préstamo</button>`;
        } else {
            contenido = `
                <p>No tienes deudas pendientes.</p>
                <button class="btn-accion" style="width:100%;" onclick="window.cerrarModal()">Aceptar</button>`;
        }
        
        window.abrirModal("Gestión Bancaria", contenido);
    });
};

window.obtenerGrupo = function(pos) {
    return grupos.find(g => g.indices.includes(pos));
};

window.verificarParColor = async function(pos, todasLasPropiedades) {
    const grupo = window.obtenerGrupo(pos);
    if (!grupo) return;

    // Filtramos cuántas propiedades del grupo tiene el jugador actual
    const propiasDelGrupo = grupo.indices.filter(idx => 
        todasLasPropiedades[idx] && todasLasPropiedades[idx].owner === window.miIdx
    );

    // Si tiene exactamente 2, le damos la recompensa
    if (propiasDelGrupo.length === 2) {
        const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
        const snap = await get(jugadorRef);
        let j = snap.val();

        // Evitamos dar el bono si ya lo tiene registrado
        if (!j.bonoParColor) {
            // Usamos 'reputacion' (o 'estrellas' si aún no has migrado el campo)
            const repActual = parseInt(j.reputacion || j.estrellas || 0);
            const nuevaRep = repActual + 1;
            
            await update(jugadorRef, { 
                reputacion: nuevaRep,
                bonoParColor: true 
            });

            window.log("⭐ ¡Has adquirido un par de color y ganado una estrella de reputación!");

            // Llamamos a la función sin parámetros, ya que ella misma lee la DB
            window.mostrarAvisoReputacion();
        }
    }
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

            // --- AÑADE ESTO PARA PINTAR AL COMPRAR ---
            window.pintarCasilla(pos, window.miIdx);
            // ------------------------------------------

            window.log("Has comprado " + window.mapa[pos].n);
            window.cerrarModal();
        } else {
            // Ventana emergente con estilo CSS y opción de préstamo
            window.abrirModal("Fondos insuficientes", `
                <div style="text-align: center; padding: 10px;">
                    <p>No tienes suficiente dinero para esta compra.</p>
                    <p>¿Deseas solicitar un préstamo de <b>$1000</b>?</p>
                    
                    <button class="btn-accion" style="width: 100%; margin-bottom: 10px;" onclick="window.solicitarPrestamo(1000); window.cerrarModal();">
                        Solicitar Préstamo ($1000)
                    </button>
                    
                    
                </div>
            `);
        }
    });
};

window.verPropiedad = function(pos, permitirCompra = false) {
    const p = window.mapa[pos];
    if (!p || p.p === 0) return;

    // Usamos los datos ya cargados en memoria para mayor velocidad
    const data = window.salaData || {}; 
    const prop = data.propiedades ? data.propiedades[pos] : null;
    const clima = window.climas[data.climaIdx || 0];
    const mult = clima.mult;

    const indicesTransporte = [8, 24, 26, 27];
    const esTransporte = indicesTransporte.includes(pos);
    
    const iconos = { 
        8:  'https://www.svgrepo.com/show/490615/car-2.svg',
        24: 'https://www.svgrepo.com/show/390391/motorcycle-cross-moto-bike.svg',
        26: 'https://www.svgrepo.com/show/490281/plane.svg',
        27: 'https://www.svgrepo.com/show/480860/train-station-mark.svg'
    };
    const filtroRosa = "invert(75%) sepia(21%) saturate(1828%) hue-rotate(293deg) brightness(105%) contrast(101%)";

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
            <div class="card-header" style="background:#ff80bf; color:white; padding:10px; border-radius:5px 5px 0 0; text-align:center; font-weight:bold;">${p.n}</div>
            <div class="card-body" style="padding:15px;">
                ${esTransporte ? `<div style="text-align:center; margin:15px 0;"><img src="${iconos[pos]}" style="width:80px; filter: ${filtroRosa};"></div>` : ''}
                <p>Valor de compra: <b>$${p.p}</b></p>
                <div style="color: ${colorClima}; font-size: 1.2em; font-weight: bold; margin: 10px 0;">
                    Alquiler actual: $${estaHipotecada ? 0 : alquiler}
                </div>
                <p style="font-size: 0.8em; color: #666;">Clima: ${clima.n}</p>
                <hr>
                <p><b>Detalle de alquileres:</b></p>
                <ul style="text-align: left; font-size: 0.9em; padding-left: 20px;">${listaAlquileres}</ul>
                <hr>`;

    contenido += `<div style="text-align: center; margin-top: 25px;">`; 

    if (!prop) {
        contenido += permitirCompra ? 
            `<button class="btn-sidebar" style="width:100%; display:block; background:#ff80bf; color:white; margin-bottom:10px;" onclick="window.comprar(${pos}); window.cerrarModal();">Comprar Propiedad</button>` : 
            `<p style="color:gray; font-size:0.8em;">Debes estar en la casilla para comprar.</p>`;
    } else if (esDuenio) {
        contenido += `
            <button class="btn-sidebar" style="width:100%; display:block; background:#2ecc71; color:white; margin-bottom:10px;" onclick="window.mejorar(${pos}); window.cerrarModal();">Mejorar (+$50)</button>
            <button class="btn-sidebar" style="width:100%; display:block; background:#95a5a6; color:white; margin-bottom:10px;" onclick="window.hipotecar(${pos}); window.cerrarModal();">${estaHipotecada ? "Liberar" : "Hipotecar"}</button>`;
    } else if (!estaHipotecada) {
        contenido += `
            <p>Dueño: <b>${window.nombres[prop.owner]}</b></p>
            <button class="btn-sidebar" style="width:100%; display:block; background:#e67e22; color:white; margin-bottom:10px;" onclick="window.interaccionAlquiler('${prop.owner}', ${alquiler}); window.cerrarModal();">Pagar Alquiler</button>`;
    } else {
        contenido += `<p>Propiedad hipotecada por <b>${window.nombres[prop.owner]}</b>. No paga alquiler.</p>`;
    }

    contenido += `</div></div></div>`;
    window.abrirModal("Tarjeta de Propiedad", contenido);
};

// --- 1. ABRIR VENTANA DE INTERCAMBIO ---
window.abrirIntercambio = function() {
    get(ref(db, 'salas/' + window.sala)).then((snap) => {
        let data = snap.val();
        if (!data || !data.propiedades) {
            window.abrirModal("Error", "<p>No hay propiedades disponibles.</p>");
            return;
        }

        let misProps = Object.keys(data.propiedades).filter(idx => data.propiedades[idx].owner === window.miIdx);
        if (misProps.length === 0) {
            window.abrirModal("Aviso", "<p>No posees propiedades para intercambiar.</p>");
            return;
        }

        let optionsProps = misProps.map(idx => `<option value="${idx}">${window.mapa[idx].n}</option>`).join('');
        let optionsJugadores = Object.keys(data.jugadores || {}).filter(jIdx => String(jIdx) !== String(window.miIdx)).map(jIdx => {
            const nombre = (window.nombres && window.nombres[jIdx]) ? window.nombres[jIdx] : "Jugador " + jIdx;
            return `<option value="${jIdx}">${nombre}</option>`;
        }).join('');

        const contenido = `
            <div style="display:flex; flex-direction:column; gap: 10px; width: 100%;">
                <label><b>Propiedad:</b></label>
                <select id="select-prop" class="input-field">${optionsProps}</select>
                <label><b>Vender a:</b></label>
                <select id="select-jugador" class="input-field">${optionsJugadores}</select>
                <label><b>Precio (250 - 1000):</b></label>
                <input type="number" id="input-valor" class="input-field" min="250" max="1000" value="250">
                <button class="btn-sidebar" style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" onclick="window.ejecutarIntercambio()">Confirmar Oferta</button>
            </div>
        `;
        window.abrirModal("🤝 Intercambio", contenido);
    });
};

// --- 1. EJECUTAR OFERTA ---
window.ejecutarIntercambio = function() {
    const pIdx = document.getElementById('select-prop').value;
    const destino = document.getElementById('select-jugador').value;
    const valor = parseInt(document.getElementById('input-valor').value);

    if (isNaN(valor) || valor < 250 || valor > 1000) { 
        window.abrirModal("Error", "El precio debe estar entre 250 y 1000."); 
        return; 
    }

    const oferta = {
        propiedad: parseInt(pIdx),
        vendedor: window.miIdx, 
        comprador: destino,     
        precio: valor,
        estado: 'pendiente',
        timestamp: Date.now()
    };

    window.abrirModal("Enviando...", "Procesando oferta...");
    
    push(ref(window.db, 'salas/' + window.sala + '/ofertas'), oferta)
    .then(() => {
        window.cerrarModal();
        window.abrirModal("Éxito", "Oferta enviada correctamente.");
    })
    .catch((error) => {
        window.cerrarModal();
        window.abrirModal("Error", "No se pudo enviar: " + error.message);
    });
};

// --- 2. ESCUCHA DE OFERTAS (CON BOTONES MODIFICADOS) ---
window.ofertasListener = null;

window.escucharOfertas = function() {
    if (window.ofertasListener) {
        off(window.ofertasListener);
    }

    const ofertasRef = ref(window.db, 'salas/' + window.sala + '/ofertas');
    window.ofertasListener = ofertasRef;

    onValue(ofertasRef, (snapshot) => {
        const ofertas = snapshot.val();
        if (!ofertas) return;

        Object.keys(ofertas).forEach((key) => {
            const o = ofertas[key];
            const esParaMi = String(o.comprador).trim() === String(window.miIdx).trim();
            const estaPendiente = o.estado === 'pendiente';

            if (esParaMi && estaPendiente) {
                const nombreVendedor = (window.nombres && window.nombres[o.vendedor]) ? window.nombres[o.vendedor] : o.vendedor;
                const nombreProp = (window.mapa && window.mapa[o.propiedad]) ? window.mapa[o.propiedad].n : "Propiedad #" + o.propiedad;
                
                // Estilo mejorado: Botones más pequeños y abajo
                window.abrirModal("🤝 Nueva Oferta", `
                    <div style="text-align: center; padding: 10px;">
                        <p style="margin-bottom: 30px;"><b>${nombreVendedor}</b> te ofrece <b>${nombreProp}</b> por <b>$${o.precio}</b></p>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
                            <button style="background:#ff80bf; color:white; padding:8px 20px; border:none; border-radius:4px; cursor:pointer; width: 60%;" 
                                    onclick="window.confirmarCompra('${key}', '${o.vendedor}', ${o.propiedad}, ${o.precio})">ACEPTAR</button>
                            <button style="background:#e74c3c; color:white; padding:8px 20px; border:none; border-radius:4px; cursor:pointer; width: 60%;" 
                                    onclick="window.rechazarOferta('${key}')">RECHAZAR</button>
                        </div>
                    </div>
                `);
            }
        });
    });
};

// --- 3. TRANSACCIÓN ATÓMICA DE COMPRA (CORREGIDA) ---
window.confirmarCompra = function(key, vendedorIdx, pos, precio) {
    window.abrirModal("Procesando...", "Realizando intercambio...");
    
    const updates = {};
    updates['salas/' + window.sala + '/jugadores/' + vendedorIdx + '/dinero'] = increment(Number(precio));
    updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-Number(precio));
    updates['salas/' + window.sala + '/propiedades/' + pos + '/owner'] = window.miIdx;
    updates['salas/' + window.sala + '/ofertas/' + key + '/estado'] = 'completada';

    // RUTA CORREGIDA: Apuntamos a la base de datos completa
    update(ref(window.db), updates)
    .then(() => {
        window.cerrarModal();
        window.abrirModal("Éxito", "¡Intercambio realizado!");
    })
    .catch(e => {
        console.error("Error técnico:", e);
        window.abrirModal("Error", "Error técnico: " + e.message);
    });
};

// --- 4. RECHAZAR OFERTA ---
window.rechazarOferta = function(key) {
    update(ref(window.db, 'salas/' + window.sala + '/ofertas/' + key), { estado: 'rechazada' })
    .then(() => window.cerrarModal());
};

// Usamos async/await para garantizar que el dinero se reste y se sume correctamente
window.pagarAlquiler = async function(ownerIdx, monto) {
    const montoNumerico = parseFloat(monto);
    
    // Validación de seguridad
    if (!montoNumerico || montoNumerico <= 0) {
        window.log("Error: Se intentó pagar un monto inválido ($" + monto + ").");
        return;
    }

    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const dRef = ref(db, 'salas/' + window.sala + '/jugadores/' + ownerIdx);

    // Ejecutamos la resta al jugador y suma al propietario
    await update(jRef, { dinero: increment(-montoNumerico) });
    await update(dRef, { dinero: increment(montoNumerico) });

    window.log("Alquiler de $" + montoNumerico + " pagado correctamente.");
    window.cerrarModal();
};

// 1. Interfaz para que el jugador elija qué hacer
window.decisionTomada = false;

// 1. Interfaz para que el jugador elija qué hacer
window.decisionTomada = false;

window.interaccionAlquiler = function(ownerIdx, monto) {
    // DIAGNÓSTICO:
    console.log("DEBUG - Recibido ownerIdx:", ownerIdx);
    console.log("DEBUG - Recibido monto:", monto);

    if (ownerIdx === undefined || ownerIdx === null) {
        alert("ERROR: El juego no sabe quién es el dueño (ownerIdx es undefined)");
    }
    if (monto === undefined || monto === 0) {
        alert("ERROR: El monto recibido es 0 o indefinido");
    }

    window.decisionTomada = false; 
    const montoLimpio = parseFloat(monto) || 0;

    const contenido = `
        <h3>Alquiler de $${montoLimpio}</h3>
        <p>Propietario detectado: ${ownerIdx}</p>
        <button class="btn-accion" onclick="window.procesarEvasion('${ownerIdx}', ${montoLimpio})">Intentar Evadir</button>
        <button class="btn-accion" style="background:#ff59aa;" onclick="window.confirmarPago('${ownerIdx}', ${montoLimpio})">Pagar normal</button>
    `;
    
    window.abrirModal("Alquiler", contenido);
    
    const modal = document.getElementById('modal');
    modal.onclick = (e) => {
        if (e.target.id === 'modal' && !window.decisionTomada) {
            window.procesarEvasion(ownerIdx, montoLimpio);
        }
    };
};

// 3. Función centralizada de pago (la única que debes usar)
window.pagarAlquiler = async function(ownerIdx, monto) {
    const montoLimpio = parseFloat(monto) || 0;
    
    if (montoLimpio <= 0) {
        window.log("Error de sistema: El monto a pagar es $0.");
        return;
    }

    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const dRef = ref(db, 'salas/' + window.sala + '/jugadores/' + ownerIdx);
    
    // Ejecutamos las transacciones
    await update(jRef, { dinero: increment(-montoLimpio) });
    await update(dRef, { dinero: increment(montoLimpio) });

    window.log("Alquiler de $" + montoLimpio + " pagado correctamente.");
    // NOTA: Se eliminó window.cerrarModal() de aquí porque ya se llama 
    // desde la función principal que invoca a pagarAlquiler.
};

// 2. Ejecuta el pago normal si el jugador no quiere arriesgarse
window.confirmarPago = async function(ownerIdx, monto) {
    // 1. FORZAMOS A QUE MONTO SEA NÚMERO
    const montoNumerico = parseFloat(monto) || 0;
    
    window.decisionTomada = true;
    const esImpuesto = (ownerIdx === 'IMPUESTO');
    
    // 2. REGISTRO EN EL SISTEMA DE REPUTACIÓN (Éxito)
    // Se registra como acción positiva para el contador de 5 veces
    const tipoAccion = esImpuesto ? 'impuesto' : 'alquiler';
    await window.actualizarReputacionConContador(tipoAccion, true);

    // 3. LÓGICA DE PAGO
    if (esImpuesto) {
        await update(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { 
            dinero: increment(-montoNumerico) 
        });
        await update(ref(db, 'salas/' + window.sala), { 
            pozoImpuestos: increment(montoNumerico) 
        });
    } else {
        await window.pagarAlquiler(ownerIdx, montoNumerico);
    }
    
    // 4. LOG Y CIERRE
    window.log("Pago normal realizado: $" + montoNumerico);
    window.cerrarModal();
};

window.procesarEvasion = async function(ownerIdx, monto) {
    window.decisionTomada = true;
    const montoLimpio = parseFloat(monto) || 0;
    const esImpuesto = (ownerIdx === 'IMPUESTO');
    const tipoAccion = esImpuesto ? 'impuesto' : 'alquiler';
    
    // 1. Desactivar botones
    const botones = document.querySelectorAll('.btn-accion');
    botones.forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });

    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    let j = snap.val();
    const rnd = Math.random();

    // 2. LÓGICA DE EVASIÓN
    if (rnd > 0.6) {
        window.log("¡Éxito! Has evadido totalmente.");
        // Opcional: Si evadir es una acción, aquí podrías contar el éxito de evasión si lo deseas
    } 
    else if (rnd > 0.3) {
        const montoParcial = Math.max(1, Math.floor(montoLimpio / 2));
        window.log("¡Evasión parcial! Pagarás $" + montoParcial);
        
        if (esImpuesto) {
            await update(jugadorRef, { dinero: increment(-montoParcial) });
        } else {
            await window.pagarAlquiler(ownerIdx, montoParcial);
        }
    } 
    else {
        // Falló la evasión: Penalización
        const multa = montoLimpio + 100;
        
        // NOTIFICACIÓN A SISTEMA DE REPUTACIÓN: Fallo (Acción de Evasión)
        await window.actualizarReputacionConContador(tipoAccion, false);
        
        if (esImpuesto) {
            await update(jugadorRef, { dinero: increment(-multa) });
        } else {
            await window.pagarAlquiler(ownerIdx, multa);
        }
        window.log("¡Falló la evasión! Total pagado: $" + multa);
    }
    
    window.cerrarModal();
};

window.pagarImpuesto = async function(monto) {
    // NOTIFICACIÓN A SISTEMA DE REPUTACIÓN: Éxito (Pagó correctamente)
    await window.actualizarReputacionConContador('impuesto', true);
    
    await update(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { dinero: increment(-monto) });
    await update(ref(db, 'salas/' + window.sala), { pozoImpuestos: increment(monto) });
    window.cerrarModal();
};

window.mejorar = function(pos) {
    const pRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const tRef = ref(db, 'salas/' + window.sala + '/propiedades');

    Promise.all([get(tRef), get(jRef)]).then(async ([snapT, snapJ]) => {
        const todas = snapT.val();
        const j = snapJ.val();
        const costo = 50; 

        if (window.verificarMonopolio(pos, todas) && j.dinero >= costo) {
            const nivelActual = (todas[pos].nivel || 0);
            if (nivelActual < 5) {
                // 1. APLICAR MEJORA
                await update(pRef, { nivel: nivelActual + 1 });
                await update(jRef, { dinero: j.dinero - costo });
                
                // 2. REGISTRAR EN CONTADOR DE REPUTACIÓN (Éxito en construcción)
                await window.actualizarReputacionConContador('construccion', true);
                
                window.cerrarModal();
                window.log("Propiedad mejorada al nivel " + (nivelActual + 1));
            } else {
                window.abrirModal("Límite alcanzado", `
                    <div style="text-align: center; padding: 10px;">
                        <p>¡Ya tienes un hotel (nivel máximo)!</p>
                        <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Entendido</button>
                    </div>
                `);
            }
        } else {
            window.abrirModal("Acción no permitida", `
                <div style="text-align: center; padding: 10px;">
                    <p>Necesitas poseer todas las propiedades del mismo color y dinero suficiente para mejorar.</p>
                    <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Entendido</button>
                </div>
            `);
        }
    });
};

window.hipotecar = function(pos) {
    const pRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);

    Promise.all([get(pRef), get(jRef)]).then(([snapP, snapJ]) => {
        const p = snapP.val();
        const j = snapJ.val();
        const valorPropiedad = window.mapa[pos].p;
        const valorHipoteca = Math.floor(valorPropiedad * 0.5);

        if (!p.hipotecada) {
            // Acción de Hipotecar
            update(pRef, { hipotecada: true });
            update(jRef, { dinero: j.dinero + valorHipoteca });
            
            window.abrirModal("Banco Hipotecario", `
                <div style="text-align:center; padding:15px;">
                    <img src="https://cdn-icons-png.flaticon.com/512/2933/2933116.png" style="width:60px; margin-bottom:10px;">
                    <p>El banco ha tomado la propiedad en garantía.</p>
                    <p style="font-size:1.2em; font-weight:bold; color:#e74c3c;">Has recibido: $${valorHipoteca}</p>
                    <button class="btn-sidebar" style="margin-top:20px;" onclick="window.cerrarModal()">Aceptar</button>
                </div>
            `);
        } else {
            // Acción de Liberar
            const costoLiberar = Math.floor(valorHipoteca * 1.1);
            if (j.dinero >= costoLiberar) {
                update(pRef, { hipotecada: false });
                update(jRef, { dinero: j.dinero - costoLiberar });
                
                window.abrirModal("Banco Hipotecario", `
                    <div style="text-align:center; padding:15px;">
                        <p>Has pagado la deuda y liberado tu propiedad.</p>
                        <p style="font-size:1.2em; font-weight:bold; color:#2ecc71;">Costo: $${costoLiberar}</p>
                        <button class="btn-sidebar" style="margin-top:20px;" onclick="window.cerrarModal()">Aceptar</button>
                    </div>
                `);
            } else {
                alert("No tienes suficiente dinero para saldar la hipoteca.");
                return;
            }
        }
    });
};

window.cartasEvento = [
    { txt: "¡Inversión exitosa! Tus acciones subieron, cobras $450.", v: 350 },
    { txt: "¡Multa por estacionamiento prohibido! Pagas $100.", v: -100 },
    { txt: "¡Bono de productividad! La empresa te premia con $200.", v: 200 },
    { txt: "¡Gastos médicos inesperados! Pagas $400 por la consulta.", v: -200 },
    { txt: "¡Encontraste dinero en tu abrigo viejo! Recibes $50.", v: 50 },
    { txt: "¡Reparación de alcantarillado! Debes pagar $350 al municipio.", v: -350 },
    { txt: "¡Te sacaste la lotería! Has ganado $300.", v: 300 },
    { txt: "¡Donación benéfica a los niños de la iglesia! Pagas $400 por el bien común.", v: -200 }
];

window.obtenerCarta = function() {
    return window.cartasEvento[Math.floor(Math.random() * window.cartasEvento.length)];
};

window.manejarCasilla = async function(pos, esLlegadaPorMovimiento = false) {
    const posInt = parseInt(pos);
    const salaRef = ref(window.db, 'salas/' + window.sala);
    const snap = await get(salaRef);
    const data = snap.val();
    if (!data) return;

    const esTurnoActual = (data.turno === window.miIdx);
    const puedeComprar = esLlegadaPorMovimiento && esTurnoActual;
    const prop = data.propiedades ? data.propiedades[posInt] : null;
    const p = window.mapa[posInt]; 
    const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);

    if (prop && prop.owner) window.pintarCasilla(posInt, prop.owner);

    // --- 1. LÓGICA DE TRANSPORTE (Grupo Rosa) ---
    let g = (typeof window.obtenerGrupo === 'function') ? window.obtenerGrupo(posInt) : null;
    if (g && g.color === "#d24285") {
        if (!prop) {
            window.verPropiedad(posInt, puedeComprar);
        } else if (prop.owner !== window.miIdx) {
            const trans = [8, 24, 26, 27];
            const count = trans.filter(i => data.propiedades && data.propiedades[i] && data.propiedades[i].owner === prop.owner).length;
            const alquiler = { 1: 100, 2: 150, 3: 250, 4: 300 }[count] || 100;
            window.interaccionAlquiler(prop.owner, alquiler);
        } else {
            window.verPropiedad(posInt, false);
        }
        return;
    }

    // --- 2. PROPIEDAD NORMAL ---
    if (p && p.p > 0) {
        if (prop && prop.owner && prop.owner !== window.miIdx) {
            const alquilerReal = (p.a && p.a > 0) ? p.a : Math.floor(p.p * 0.1);
            window.interaccionAlquiler(prop.owner, alquilerReal);
        } else {
            window.verPropiedad(posInt, puedeComprar);
        }
        return;
    }

    // --- 3. EVENTOS ---
    let contenido = "";
    let titulo = "";

    if (p.n === "ARCA COMUNAL" || p.n === "?") {
        const carta = window.obtenerCarta();
        titulo = (p.n === "ARCA COMUNAL") ? "Arca Comunal" : "Suerte (?)";
        await update(jugadorRef, { dinero: increment(carta.v) });
        // Si gana dinero en Arca/Suerte, cuenta como éxito
        if (carta.v > 0) await window.actualizarReputacionConContador('evento', true);
        contenido = `<h2>${titulo}</h2><p>${carta.txt}</p>`;
    } 
    else if (posInt === 9) {
        const snapJ = await get(jugadorRef);
        let j = snapJ.val();
        let visitas = (j?.visitasCarcel || 0) + 1;
        await update(jugadorRef, { enCarcel: 2, visitasCarcel: visitas, pos: 9 });
        window.mostrarOpcionesCarcel();
        return; 
    }
    else if (p.n === "IMPUESTOS") {
        const monto = Math.floor(Math.random() * 300) + 50;
        titulo = "Impuestos";
        contenido = `
            <h2>Impuestos</h2>
            <p>Debes pagar: <b>$${monto}</b></p>
            <button class="btn-sidebar" style="background:#ff80bf; color:white; width:100%; margin-bottom:5px;" onclick="window.pagarImpuesto(${monto}); window.cerrarModal();">Pagar</button>
            <button class="btn-sidebar" style="background:#ffccd5; width:100%;" onclick="window.procesarEvasion('IMPUESTO', ${monto}); window.cerrarModal();">Evadir (40% éxito)</button>
        `;
    }
    else if (p.n === "PARADA") {
        const pozo = data.pozoImpuestos || 0;
        if (pozo > 0) {
            await update(jugadorRef, { dinero: increment(pozo) });
            await update(salaRef, { pozoImpuestos: 0 });
            await window.actualizarReputacionConContador('evento', true);
        }
        titulo = "Parada Gratuita";
        contenido = `<h2>Parada</h2><p>Recolectaste $${pozo}.</p>`;
    }

    if (contenido !== "") window.abrirModal(titulo, contenido);
};

window.mostrarOpcionesCarcel = function() {
    window.abrirModal("Cárcel", `
        <div style="text-align:center;">
            <p>Has sido encarcelado. Estás perdiendo turnos.</p>
            <button class="btn-accion" onclick="window.intentarHackeo(); window.cerrarModal();">Intentar Hackeo (50%)</button>
            <button class="btn-accion" onclick="window.pagarFianza(); window.cerrarModal();">Pagar Fianza ($200)</button>
            <button class="btn-accion" onclick="window.quedarseEnCarcel(); window.cerrarModal();">Cumplir Condena</button>
        </div>
    `);
};

window.pagarFianza = async function() {
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    const j = snap.val();
    
    if ((j.dinero || 0) < 200) {
        window.abrirModal("Error", "No tienes suficiente dinero para pagar la fianza ($200).");
        return;
    }

    let fianzasPagadas = (j.fianzasPagadas || 0) + 1;
    let updates = { 
        enCarcel: 0, 
        dinero: increment(-200),
        fianzasPagadas: fianzasPagadas 
    };

    let mensaje = "Fianza pagada.";

    if (fianzasPagadas >= 3) {
        updates.fianzasPagadas = 0;
        // CORRECCIÓN: usamos reputacion en lugar de estrellas
        updates.reputacion = increment(1);
        mensaje = "¡Fianza pagada! Por tu buena conducta al pagar 3 veces, has ganado 1 punto de reputación.";
    }

    await update(jugadorRef, updates);
    
    window.log(mensaje);
    window.abrirModal("Cárcel", `
        <div style="text-align:center;">
            <p>${mensaje}</p>
            <button class="btn-accion" onclick="window.cerrarModal()">Aceptar</button>
        </div>
    `);
};

window.estaEnCarcel = function(jugadorData) {
    return (jugadorData.enCarcel || 0) > 0;
};

window.quedarseEnCarcel = async function() {
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    let j = snap.val();
    let cumplidas = (j.cumplidasCarcel || 0) + 1;

    let updates = { cumplidasCarcel: cumplidas };
    let mensajeExtra = "";

    if (cumplidas >= 10) {
        updates.cumplidasCarcel = 0;
        // CORRECCIÓN: usamos reputacion en lugar de estrellas
        const repActual = parseInt(j.reputacion || 0);
        updates.reputacion = repActual + 1;
        mensajeExtra = `<p style="color: #ff59aa;"><b>¡Felicidades!</b> Has ganado 1 punto de reputación por buen comportamiento.</p>`;
    }

    await update(jugadorRef, updates);
    
    window.abrirModal("Cárcel", `
        <div style="text-align: center; padding: 10px;">
            <p>Has decidido cumplir tu condena.</p>
            ${mensajeExtra}
            <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Entendido</button>
        </div>
    `);

    window.log("Cumpliendo condena...");
    if (typeof window.pasarTurno === 'function') window.pasarTurno();
};

window.intentarHackeo = async function() {
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    const j = snap.val();

    if (Math.random() < 0.5) {
        window.log("¡HACKEO EXITOSO!");
        await update(jugadorRef, { 
            enCarcel: 0,
            turnosExtraBloqueados: 0 
        });
        
        window.abrirModal("¡Éxito!", `
            <div style="text-align: center; padding: 15px;">
                <div style="font-size: 3em; margin-bottom: 10px;">🔓</div>
                <h2 style="color: #4dff88;">Sistema Hackeado</h2>
                <p>Has burlado la seguridad y quedado en libertad.</p>
                <button onclick="window.cerrarModal()" style="width:100%; padding:10px; background:#4dff88; border:none; border-radius:5px; cursor:pointer;">Continuar</button>
            </div>
        `);
    } else {
        window.log("¡FALLASTE!");
        const pen = (j.turnosExtraBloqueados || 0) + 1;
        await update(jugadorRef, { 
            enCarcel: 1, 
            turnosExtraBloqueados: pen 
        });

        // Esta función ya utiliza el campo 'reputacion' internamente en la lógica unificada
        await window.actualizarReputacionConContador('hackeo', false);

        const html = `
            <div style="text-align: center; padding: 15px;">
                <div style="font-size: 3em; margin-bottom: 10px;">🛡️</div>
                <h2 style="color: #ff4d4d; margin: 0;">¡Hackeo Fallido!</h2>
                <p style="color: #555; margin: 15px 0;">El sistema de seguridad ha rastreado tu conexión.</p>
                <div style="background: #fff0f0; border: 1px solid #ffcccc; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                    <span style="font-size: 1.2em; font-weight: bold; color: #cc0000;">PENALIZACIÓN: +${pen} TURNO(S) EXTRA</span>
                </div>
                <button onclick="window.cerrarModal(); window.pasarTurno();" 
                        style="width: 100%; padding: 12px; background: #ff4d4d; border: none; 
                               color: white; border-radius: 5px; font-weight: bold; cursor: pointer;">
                    Aceptar consecuencias
                </button>
            </div>
        `;
        window.abrirModal("¡ALERTA DE SEGURIDAD!", html);
    }
};

window.actualizarReputacionConContador = async function(tipoAccion, fueExitoso) {
    // 1. Identificar ruta (Visitante o Jugador)
    const rutaBase = window.esVisitante 
        ? 'salas/' + window.sala + '/visitantes/' + window.miIdx 
        : 'salas/' + window.sala + '/jugadores/' + window.miIdx;

    const refUsuario = ref(db, rutaBase);
    const snap = await get(refUsuario);
    const u = snap.val();
    
    if (!u) return;

    // 2. Definir campos de contador
    const campoContador = `contador_${tipoAccion}_${fueExitoso ? 'exitoso' : 'fallido'}`;
    let contador = (u[campoContador] || 0) + 1;
    let actualizaciones = { [campoContador]: contador };
    let mensaje = "";

    // 3. Lógica de 5 acciones (Reseteo y ajuste de reputación)
    if (contador >= 5) {
        actualizaciones[campoContador] = 0; // Reset del contador al llegar a 5
        
        // Obtenemos el valor actual de reputación (priorizando el campo unificado)
        const repActual = parseInt(u.reputacion || u.estrellas || 0);

        if (window.esVisitante) {
            // Lógica para Ángeles/Gárgulas
            const alineamiento = u.alineamiento;
            let cambioRep = (fueExitoso) ? (alineamiento === 'angel' ? 1 : -1) : (alineamiento === 'angel' ? -1 : 1);
            let nuevaRep = Math.max(0, Math.min(5, repActual + cambioRep));
            
            actualizaciones.reputacion = nuevaRep;
            // Limpiamos el campo viejo si existía
            if (u.estrellas !== undefined) actualizaciones.estrellas = null;

            if (nuevaRep > repActual) window.verificarAscenso(repActual, nuevaRep);
            mensaje = `¡Evento de reputación! ${fueExitoso ? "Éxito" : "Fallo"} en ${tipoAccion}. Reputación ajustada.`;
        } else {
            // Lógica para Jugadores Normales
            let nuevaRep = Math.max(0, Math.min(5, repActual + (fueExitoso ? 1 : -1)));
            
            actualizaciones.reputacion = nuevaRep;
            // Limpiamos el campo viejo si existía
            if (u.estrellas !== undefined) actualizaciones.estrellas = null;

            mensaje = fueExitoso ? "¡Logro acumulado! +1 reputación." : "¡Penalización! -1 reputación.";
        }
    }

    // 4. Aplicar actualizaciones a Firebase
    await update(refUsuario, actualizaciones);
    
    // 5. Log y actualización visual
    if (mensaje) window.log(mensaje);
    if (typeof window.renderEstrellas === 'function') {
        const nuevaRepVisual = actualizaciones.reputacion !== undefined ? actualizaciones.reputacion : (u.reputacion || u.estrellas || 0);
        window.renderEstrellas(nuevaRepVisual);
    }
};

// Función para otorgar recompensa de misión incluyendo estrellas
window.otorgarRecompensaMision = async function(mision) {
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    let j = snap.val();
    
    // 1. Preparamos el objeto de actualizaciones
    // Usamos 'reputacion' (o estrellas de respaldo)
    const repActual = parseInt(j.reputacion || j.estrellas || 0);
    let updates = { 
        dinero: increment(mision.rec) 
    };

    let ganoRep = false;

    // 2. Lógica de reputación (solo si es menor a 5)
    if (repActual < 5) {
        updates.reputacion = repActual + 1;
        // Limpiamos el campo viejo si existía
        if (j.estrellas !== undefined) updates.estrellas = null;
        ganoRep = true;
    }

    // 3. Aplicamos los cambios en Firebase
    await update(jugadorRef, updates);
    
    // 4. Actualizamos la interfaz visual si existe la función
    if (typeof window.renderReputacion === 'function') {
        const nuevoValor = ganoRep ? (repActual + 1) : repActual;
        window.renderReputacion(nuevoValor);
    }
    
    window.log(`Misión completada: ${mision.titulo}. Recompensa: $${mision.rec}`);

    // 5. Aviso de recompensa
    if (ganoRep) {
        // La función mostrarAvisoReputacion ya lee la base de datos sola
        window.mostrarAvisoReputacion();
    } else {
        // Si ya es nivel 5, solo avisamos del dinero
        window.abrirModal("Misión Completada", `
            <div style="text-align: center;">
                <h2>${mision.titulo}</h2>
                <p>¡Has recibido <b>$${mision.rec}</b>!</p>
                <button class="btn-accion" onclick="window.cerrarModal()">Aceptar</button>
            </div>
        `);
    }
};

window.abrirModalMisiones = function() {
    const esVisitante = window.esVisitante;
    let html = `<div class="abrirModal">`;
    html += `<span class="btn-cerrar-x" onclick="window.cerrarModal()">&times;</span>`;
    
    if (esVisitante) {
        html += `<h2 style="color: #ff59aa; margin-top: 0;">Misiones de citizens</h2>`;
        const misiones = [
            { id: 'benefactor', titulo: 'El Benefactor', desc: 'Regala $100 a un jugador.', tipo: 'angel', color: '#ff59aa' },
            { id: 'consejero', titulo: 'El Consejero', desc: 'Paga fianza de 3 jugadores.', tipo: 'angel', color: '#ff59aa' },
            { id: 'saboteador', titulo: 'El Saboteador', desc: 'Haz perder un turno a un jugador.', tipo: 'gargola', color: '#ff59aa' }
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
        html += `<h2 style="color: #ff59aa; margin-top: 0;">Objetivos del Jugador</h2>`;
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
                <div style="font-size: 0.85em; font-weight: bold; color: #ff59aa;">Premio: $${m.rec} + 1 Reputación</div>
            </div>`;
        });
    }
    
    html += `</div>`;
    
    // Abrimos el modal con el título correspondiente según el rol
    window.abrirModal(esVisitante ? "Misiones" : "Logros", html);
};

  window.renderReputacion = function(rep) {
    // 1. Actualizar texto del botón (Cambiamos el nombre de ID si fuera necesario, 
    // pero mantendré 'btn-reputacion-global' como tenías)
    const btn = document.getElementById('btn-reputacion-global');
    if (btn) btn.innerText = `Reputación: ${rep} ★`;

    // 2. Actualizar visualización de estrellas
    // Buscamos elementos con ID star-1 hasta star-5
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (star) {
            // Si el índice i es menor o igual a la reputación actual, se ilumina
            star.style.color = i <= rep ? '#ff59aa' : '#ccc';
        }
    }
    
    console.log("Reputación actualizada visualmente a:", rep);
};

window.aplicarConsecuenciaReputacion = async function(esMalaAccion) {
    const vRef = ref(db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
    
    // 1. Obtenemos el estado más reciente de la base de datos
    const snap = await get(vRef);
    const v = snap.val();

    if (!v) return;

    // 2. VERIFICACIÓN CRÍTICA: Si no existe el campo 'alineamiento', obligamos a elegir
    if (!v.alineamiento) {
        console.log("Visitante sin alineamiento detectado. Abriendo modal...");
        window.preguntarAlineamiento();
        return; 
    }

    // 3. Procesamos la consecuencia (Usamos reputacion, respaldado por estrellas)
    const alineamiento = v.alineamiento;
    let rep = parseInt(v.reputacion || v.estrellas || 0);

    // Lógica: Ángel (Buena=+1, Mala=-1) | Gárgola (Buenas=-1, Mala=+1)
    if (alineamiento === 'angel') {
        rep = esMalaAccion ? (rep - 1) : (rep + 1);
    } else if (alineamiento === 'gargola') {
        rep = esMalaAccion ? (rep + 1) : (rep - 1);
    }

    // Límites estrictos de 0 a 5
    rep = Math.max(0, Math.min(5, rep));

    // 4. Actualizamos Firebase (limpiando estrellas si existían)
    await update(vRef, { 
        reputacion: rep,
        estrellas: null 
    });

    // 5. Refrescamos la UI con la función unificada
    if (typeof window.renderReputacion === 'function') {
        window.renderReputacion(rep);
    }
    
    console.log(`Acción procesada: Mala=${esMalaAccion} | Alineamiento: ${alineamiento} | Reputación: ${rep}`);
};

window.intentarUsarPoder = async function(esMalaAccion, callbackDelPoder) {
    const vRef = ref(db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
    const snap = await get(vRef);
    const v = snap.val();

    // Si no existe, es la primera vez: Lanza el modal y NO ejecuta el poder
    if (!v || !v.alineamiento) {
        window.preguntarAlineamiento();
        return; 
    }

    // Si ya existe, primero aplicamos la consecuencia de reputación
    await window.aplicarConsecuenciaReputacion(esMalaAccion);
    
    // Luego, ejecutamos el poder real
    if (typeof callbackDelPoder === 'function') {
        callbackDelPoder();
    }
};

window.preguntarAlineamiento = function() {
    const html = `
        <div class="modal-content" style="text-align: center; padding: 20px;">
            <h2 style="color: #ff59aa;">¿Cuál es tu naturaleza?</h2>
            <p>Al realizar acciones, tu reputación definirá tu camino:</p>
            <button class="btn-sidebar" style="background: #ff59aa; color: white; width:100%; margin:10px 0; padding:10px;" 
                    onclick="window.guardarAlineamiento('angel')">Ángel (Malas acciones restan)</button>
            <button class="btn-sidebar" style="background: #333; color: white; width:100%; margin:10px 0; padding:10px;" 
                    onclick="window.guardarAlineamiento('gargola')">Gárgola (Buenas acciones restan)</button>
        </div>`;
    window.abrirModal("Elección de Destino", html);
};

window.guardarAlineamiento = async function(tipo) {
    const vRef = ref(db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
    
    // Guardamos el alineamiento y establecemos la reputación inicial en 0
    await update(vRef, { 
        alineamiento: tipo, 
        reputacion: 0,
        // Eliminamos rastro del campo viejo si existía
        estrellas: null 
    });
    
    window.cerrarModal();
    
    // Usamos la nueva función unificada de renderizado
    if (typeof window.renderReputacion === 'function') {
        window.renderReputacion(0);
    }
    
    window.log(`Has elegido tu destino: ${tipo === 'angel' ? 'Ángel' : 'Gárgola'}`);
};

// --- 6. Poderes de Visitante ---
const verificarYInyectar = setInterval(() => {
    const btn = document.getElementById("btn-iniciar-partida");
    const container = document.getElementById("container-poderes");
    
    if (btn && !container) {
        if (typeof window.actualizarBotonesPoderes === 'function') {
            window.actualizarBotonesPoderes();
        }
    }
}, 500);

// --- 1. BARRA DE PODERES ---
window.actualizarBotonesPoderes = function() {
    // Verificamos que sea visitante y que no exista ya la barra para evitar duplicados
    if (window.esVisitante && !document.getElementById('barra-tareas-poderes')) {
        const barra = document.createElement('div');
        barra.id = 'barra-tareas-poderes';
        barra.style.cssText = `position: fixed; bottom: 5px; left: 50%; transform: translateX(-50%); width: auto; max-width: 90%; height: 50px; background: #fff0f3; border: 2px solid #ff80bf; border-radius: 25px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 15px; z-index: 999999; box-shadow: 0 4px 10px #ff80bf;`;
        
        const estiloBtn = `padding: 5px 12px; font-size: 11px; height: 30px; border-radius: 15px; background: #ffccd5; border: 1px solid #ff80bf; color: #c71585; cursor: pointer;`;

        barra.innerHTML = `
            <button id="poder-escudo" class="btn-sidebar" style="${estiloBtn}">Escudo</button>
            <button id="poder-sabotaje-5" class="btn-sidebar" style="${estiloBtn}">Sabotear 5% ($300)</button>
            <button id="poder-sabotaje-10" class="btn-sidebar" style="${estiloBtn}">Sabotear 10% ($500)</button>
            <button id="poder-clima" class="btn-sidebar" style="${estiloBtn}">Clima ($200)</button>
            <button id="poder-rescate" class="btn-sidebar" style="${estiloBtn} background: #ff59aa; color: white;">Rescatar ($300)</button>
        `;
        document.body.appendChild(barra);
        document.body.style.paddingBottom = "70px";

        // Asignación de eventos: intentamos usar el poder tras aplicar la consecuencia de reputación
        document.getElementById('poder-escudo').onclick = () => window.intentarUsarPoder(false, window.abrirMenuProteccion);
        
        document.getElementById('poder-sabotaje-5').onclick = () => window.intentarUsarPoder(true, () => window.seleccionarObjetivoSabotaje(0.05, 300));
        
        document.getElementById('poder-sabotaje-10').onclick = () => window.intentarUsarPoder(true, () => window.seleccionarObjetivoSabotaje(0.10, 500));
        
        document.getElementById('poder-clima').onclick = () => window.intentarUsarPoder(false, window.tomarControlClima);
        
        document.getElementById('poder-rescate').onclick = () => window.intentarUsarPoder(false, window.abrirMenuRescate);
    }
};

// --- 2. LÓGICA DE PAGO CENTRALIZADA ---
window.validarYDescontar = async function(costo) {
    // Usamos la variable global db (o window.db si así la tienes configurada en tu init de Firebase)
    const dbRef = window.db || db; 
    const jRef = ref(dbRef, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    
    const snap = await get(jRef);
    const datos = snap.val();
    
    if (!datos || (datos.dinero || 0) < costo) {
        window.abrirModal("Error", `<p>Saldo insuficiente. Necesitas <b>$${costo}</b>.</p>`);
        return false;
    }
    
    await update(jRef, { dinero: increment(-costo) });
    return true;
};

// --- 3. SABOTAJE ---
window.seleccionarObjetivoSabotaje = async function(porcentaje, costo) {
    const snap = await get(ref(db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Selecciona objetivo (Costo: $${costo}):</p>`;
    snap.forEach(c => {
        if (window.esJugadorValido(c.key, c.val())) {
            html += `<button class="btn-sidebar" style="width:100%; margin-bottom:5px;" onclick="window.ejecutarSabotaje('${c.key}', ${porcentaje}, ${costo}); window.cerrarModal()">Sabotear ${c.key} (${porcentaje*100}%)</button>`;
        }
    });
    window.abrirModal("Sabotaje", html + `</div>`);
};

window.ejecutarSabotaje = async function(objetivoIdx, porcentaje, costo) {
    if (await window.validarYDescontar(costo)) {
        const jRef = ref(db, 'salas/' + window.sala + '/jugadores/' + objetivoIdx);
        const snap = await get(jRef);
        const jugadorAfectado = snap.val();
        
        if (jugadorAfectado.tieneEscudo) {
            window.abrirModal("Bloqueado", "¡El jugador tiene un escudo!");
            return;
        }

        const montoPerdido = Math.round(jugadorAfectado.dinero * porcentaje);
        const nombreSaboteador = window.nombres[window.miIdx] || "Un visitante";
        const mensajeFinal = `¡${nombreSaboteador} saboteó a ${objetivoIdx} restándole $${montoPerdido} (${porcentaje*100}%).`;

        await update(jRef, { 
            dinero: increment(-montoPerdido),
            notificacion: {
                titulo: "¡Sabotaje!",
                mensaje: `¡${nombreSaboteador} ha saboteado tus suministros! Has perdido $${montoPerdido}.`,
                timestamp: Date.now()
            }
        });

        await update(ref(db, 'salas/' + window.sala + '/logs'), {
            mensaje: mensajeFinal,
            timestamp: Date.now()
        });

        // INTEGRACIÓN REPUTACIÓN: Es una mala acción (true)
        if (window.esVisitante) {
            await window.aplicarConsecuenciaReputacion(true);
        }
    }
};

// --- 4. RESCATE ---
window.abrirMenuRescate = async function() {
    const snap = await get(ref(db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Pagar fianza ($300):</p>`;
    let hayPresos = false;
    
    snap.forEach(c => {
        if ((c.val().enCarcel ?? 0) > 0) {
            hayPresos = true;
            html += `<button class="btn-sidebar" style="width:100%; margin-bottom:5px;" onclick="window.ejecutarRescate('${c.key}', 300); window.cerrarModal()">Liberar ${c.key}</button>`;
        }
    });
    
    if (!hayPresos) html += `<p>No hay nadie en la cárcel.</p>`;
    window.abrirModal("Rescate", html + `</div>`);
};

window.ejecutarRescate = async function(idPreso, costo) {
    if (await window.validarYDescontar(costo)) {
        const nombreSalvador = window.nombres[window.miIdx] || "Un ciudadano";
        const mensajeLog = `¡${nombreSalvador} ha pagado la fianza de $${costo} para liberar a ${idPreso}!`;
        
        await update(ref(db, 'salas/' + window.sala + '/jugadores/' + idPreso), { 
            enCarcel: 0,
            notificacion: {
                titulo: "¡Libertad!",
                mensaje: `¡Has sido rescatado! El ciudadano ${nombreSalvador} ha pagado tu fianza de $${costo}.`,
                timestamp: Date.now()
            }
        });

        await update(ref(db, 'salas/' + window.sala + '/logs'), {
            mensaje: mensajeLog,
            timestamp: Date.now()
        });

        // INTEGRACIÓN REPUTACIÓN: Rescatar es una BUENA acción (false en esMalaAccion)
        if (window.esVisitante) {
            await window.aplicarConsecuenciaReputacion(false);
        }
    }
};

// --- 5. CLIMA (ACTUALIZADO CON ALQUILER) ---
window.tomarControlClima = function() {
    if (!window.esVisitante) return;
    get(ref(db, 'salas/' + window.sala + '/controladorClima')).then(snap => {
        const data = snap.val();
        if (!data || (Date.now() - data.timestamp > 600000)) {
            window.abrirControlClima();
        } else {
            const minutos = Math.ceil((600000 - (Date.now() - data.timestamp)) / 60000);
            window.abrirModal("Cooldown", `Intenta en ${minutos} min.`);
        }
    });
};

// --- 5. CLIMA CON CÁLCULO DE ALQUILER DINÁMICO ---
window.cambiarClimaConCooldown = async function(idx) {
    if (await window.validarYDescontar(200)) {
        const nuevoClima = window.climas[idx]; // Esperamos que tengan: {n: "...", tipo: "desastre/bonanza/neutral"}
        const nombreUsuario = window.nombres[window.miIdx] || "Un visitante";
        
        // 1. Calcular el porcentaje aleatorio (5% o 10%)
        const porcentaje = Math.random() < 0.5 ? 0.05 : 0.10;
        let efecto = "";
        let ajuste = 0;

        // 2. Definir lógica según el tipo
        if (nuevoClima.tipo === "desastre") {
            ajuste = -porcentaje; // Disminuye
            efecto = `¡Debido al desastre, los alquileres bajan un ${porcentaje * 100}%!`;
        } else if (nuevoClima.tipo === "bonanza") {
            ajuste = porcentaje; // Aumenta
            efecto = `¡Es época de bonanza, los alquileres suben un ${porcentaje * 100}%!`;
        } else {
            ajuste = 0; // Otoño o neutral
            efecto = "El mercado de alquileres se mantiene estable.";
        }

        const mensajeLog = `☁️ ${nombreUsuario} cambió el clima a ${nuevoClima.n}. ${efecto}`;

        // 3. Actualizar base de datos
        await update(ref(db, 'salas/' + window.sala + '/controladorClima'), { 
            timestamp: Date.now(), 
            ultimoUsuario: window.miIdx 
        });
        
        // Guardamos el modificador calculado en la sala para que el sistema de cobro lo use
        await update(ref(db, 'salas/' + window.sala), { 
            climaIdx: idx,
            modificadorAlquiler: ajuste 
        });
        
        window.cerrarModal();
        window.abrirModal("Éxito", "Clima cambiado. " + efecto);
        
        await update(ref(db, 'salas/' + window.sala + '/logs'), {
            mensaje: mensajeLog,
            timestamp: Date.now()
        });
    }
};

window.abrirControlClima = function() {
    let html = `<div style="max-height: 300px; overflow-y: auto;">`;
    window.climas.forEach((c, idx) => {
        // Mostramos el tipo en el botón como guía
        html += `<button class="btn-sidebar" style="width:100%; margin:5px 0; padding:8px;" onclick="window.cambiarClimaConCooldown(${idx})">
                    <b>${c.n}</b><br><small>Tipo: ${c.tipo || 'Neutral'}</small>
                 </button>`;
    });
    window.abrirModal("☁️ Panel de control climático", html + `</div>`);
};

// --- 6. PROTECCIÓN (ESCUDO) ---
window.activarEscudo = async function(jugadorIdx) {
    const nombreProtector = window.nombres[window.miIdx] || "Un ciudadano";
    const mensajeLog = `🛡️ ¡${nombreProtector} ha establecido un contrato de protección sobre ${jugadorIdx}!`;
    
    await update(ref(db, 'salas/' + window.sala + '/jugadores/' + jugadorIdx), { 
        tieneEscudo: true, 
        protegidoPor: window.miIdx, 
        timestampEscudo: Date.now(),
        notificacion: {
            titulo: "🛡️ ¡Protección Recibida!",
            mensaje: `¡El ciudadano ${nombreProtector} te ha puesto bajo su protección! Estás a salvo de sabotajes.`,
            timestamp: Date.now()
        }
    });

    window.abrirModal("Protección Activa", `<div class="modal-content"><p>Ahora proteges a <b>${jugadorIdx}</b>.</p></div>`);
    
    await update(ref(db, 'salas/' + window.sala + '/logs'), {
        mensaje: mensajeLog,
        timestamp: Date.now()
    });
};

window.abrirMenuProteccion = async function() {
    const snap = await get(ref(db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Selecciona a quién deseas proteger:</p>`;
    let hayJugadores = false;

    snap.forEach(c => {
        if (window.esJugadorValido(c.key, c.val())) {
            hayJugadores = true;
            html += `<button class="btn-sidebar" style="margin-bottom:5px; width:100%" onclick="window.activarEscudo('${c.key}'); window.cerrarModal()">🛡️ Proteger a ${c.key}</button>`;
        }
    });

    if (!hayJugadores) html += `<p>No hay otros jugadores disponibles.</p>`;
    window.abrirModal("Proteger Ciudadano", html + `</div>`);
};

window.esJugadorValido = (id, d) => (d && d.tipo === 'jugador') || !id.startsWith('v');


window.actualizarReputacionConContador = async function(tipoAccion, fueExitoso) {
    // 1. Identificar si es Visitante o Jugador
    const rutaBase = window.esVisitante 
        ? 'salas/' + window.sala + '/visitantes/' + window.miIdx 
        : 'salas/' + window.sala + '/jugadores/' + window.miIdx;

    const refUsuario = ref(db, rutaBase);
    const snap = await get(refUsuario);
    const u = snap.val();
    if (!u) return;
    
    // 2. Definir campos
    const campoContador = `contador_${tipoAccion}_${fueExitoso ? 'exitoso' : 'fallido'}`;
    let contador = (u[campoContador] || 0) + 1;
    let actualizaciones = { [campoContador]: contador };
    
    // Guardamos la reputación anterior para verificar cambios
    const repAnterior = parseInt(u.reputacion || u.estrellas || 0);

    // 3. Lógica de 5 acciones
    if (contador >= 5) {
        actualizaciones[campoContador] = 0; // Reset
        
        let nuevaRep = repAnterior;

        if (window.esVisitante) {
            const alineamiento = u.alineamiento;
            let cambio = (fueExitoso) ? (alineamiento === 'angel' ? 1 : -1) : (alineamiento === 'angel' ? -1 : 1);
            nuevaRep = Math.max(0, Math.min(5, repAnterior + cambio));
        } else {
            nuevaRep = Math.max(0, Math.min(5, repAnterior + (fueExitoso ? 1 : -1)));
        }

        actualizaciones.reputacion = nuevaRep;
        if (u.estrellas !== undefined) actualizaciones.estrellas = null; // Limpieza

        // 4. Lógica de Ascenso integrada
        if (nuevaRep > repAnterior) {
            // Obtenemos la info usando la función unificada
            const info = window.obtenerInfoReputacion({ ...u, reputacion: nuevaRep });
            
            window.abrirModal("¡Ascenso de Rango!", `
                <div style="text-align:center; padding: 20px;">
                    <h2 style="color: #ff59aa;">¡Felicidades!</h2>
                    <p>Has alcanzado el nuevo rango de:</p>
                    <h3 style="color: #ff59aa; font-size: 1.5em; margin: 10px 0;">${info.t}</h3>
                    <p style="font-style: italic; color: #555;">${info.d}</p>
                    <div style="font-size: 2em; margin: 20px 0; color: #ff59aa; font-weight: bold;">
                        ${nuevaRep} ★
                    </div>
                    <button onclick="window.cerrarModal()" style="background: #ff59aa; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer;">
                        Continuar
                    </button>
                </div>
            `);
        } else {
            window.log(fueExitoso ? "Reputación aumentada." : "Reputación penalizada.");
        }
    }

    await update(refUsuario, actualizaciones);
    if (typeof window.renderReputacion === 'function') window.renderReputacion(actualizaciones.reputacion || repAnterior);
};

window.obtenerInfoReputacion = function(datos) {
    // 1. Unificamos la lectura del valor de reputación/estrellas
    // (Asegúrate de que en Firebase el campo se llame 'reputacion' en ambos casos para evitar errores)
    const rep = parseInt(datos.reputacion || datos.estrellas) || 0;

    // 2. Lógica para VISITANTES (Ángeles / Gárgolas)
    if (window.esVisitante) {
        const esGargola = datos.alineamiento === 'gargola';
        const niveles = esGargola ? [
            {t: "Sombra", d: "Apenas inicias tu camino de caos."},
            {t: "Inquietud", d: "Tu presencia incomoda a la ciudad."},
            {t: "Saboteador", d: "Has causado problemas reales."},
            {t: "Agente del Caos", d: "El pánico sigue tus pasos."},
            {t: "Monarca Oscuro", d: "La ciudad es tu patio de juegos."}
        ] : [
            {t: "Aprendiz de Luz", d: "Dando tus primeros pasos bondadosos."},
            {t: "Ayudante", d: "La gente empieza a notar tu bondad."},
            {t: "Guardián", d: "Proteges a los necesitados."},
            {t: "Héroe Local", d: "Eres un pilar de la comunidad."},
            {t: "Ángel de la Ciudad", d: "Tu luz es invencible."}
        ];

        if (rep <= 0) return {t: "Desconocido", d: "Aún no has realizado acciones."};
        return niveles[Math.min(rep - 1, 4)];
    } 
    
    // 3. Lógica para JUGADORES (Tabla estándar)
    else {
        const data = [
            { t: "Principiante en Sombras", d: "Apenas comienzas tu camino. Eres un extraño en las calles de Naeun Town." },
            { t: "Novato Urbano", d: "Empiezas a ser reconocido en el vecindario. Tu presencia se nota." },
            { t: "Estrella Naciente", d: "Tu nombre suena en los negocios locales. Empiezas a destacar." },
            { t: "Ciudadano Distinguido", d: "Cuentas con el respeto de los habitantes. Eres alguien importante." },
            { t: "Icono de la Ciudad", d: "Tu influencia es innegable. Todos conocen tus hazañas." },
            { t: "Leyenda de Naeun Town", d: "Eres el dueño de la ciudad. Tu nombre quedará grabado en la historia." }
        ];
        
        const idx = Math.min(rep, data.length - 1);
        return data[idx];
    }
};

window.obtenerReputacionData = function(reputacion) {
    const data = window.obtenerTablaReputacion();
    const idx = Math.min(reputacion, data.length - 1);
    return data[idx];
};

// 2. FUNCIÓN DE MOSTRAR AVISO (Corregida y optimizada)
window.mostrarAvisoReputacion = async function() {
    const ruta = window.esVisitante 
        ? 'salas/' + window.sala + '/visitantes/' + window.miIdx 
        : 'salas/' + window.sala + '/jugadores/' + window.miIdx;

    const snap = await get(ref(db, ruta));
    const miData = snap.val();
    
    if (!miData) {
        console.warn("No se encontraron datos de reputación.");
        return;
    }

    // Usamos la función unificada de info
    const info = window.obtenerInfoReputacion(miData);
    const puntos = parseInt(miData.reputacion || 0);
    
    const contenido = `
        <div style="text-align: center; padding: 20px;">
            <h2 style="color: #ff59aa;">${info.t}</h2>
            <p style="font-size: 1.1em; margin-bottom: 10px;">${info.d}</p>
            <div style="font-size: 3em; margin: 15px 0; color: #ff59aa; font-weight: bold;">
                ${puntos} ★
            </div>
            <button onclick="window.cerrarModal()" style="background: #ff59aa; color: white; border: none; padding: 12px 25px; border-radius: 20px; cursor: pointer; font-weight: bold;">
                Entendido
            </button>
        </div>`;
    
    window.abrirModal("Tu Estado", contenido);
};

window.completarMisionVisitante = async function(tipo) {
    try {
        const rol = window.esVisitante ? 'visitantes' : 'jugadores';
        const userRef = ref(db, `salas/${window.sala}/${rol}/${window.miIdx}`);
        
        const snap = await get(userRef);
        const datos = snap.val();
        if (!datos) return;

        // 1. Calcular reputación (usando campo unificado)
        const repActual = parseInt(datos.reputacion || datos.estrellas || 0);
        const cambio = (tipo === 'angel') ? 1 : -1;
        const nuevaRep = Math.min(5, Math.max(0, repActual + cambio));
        
        const recompensa = (tipo === 'angel') ? 200 : 150;
        const nombreMision = (tipo === 'angel') ? "Misión de Benefactor" : "Misión de Saboteador";

        // 2. Actualizar datos en Firebase
        await update(userRef, { 
            reputacion: nuevaRep,
            estrellas: null, // Limpiamos campo viejo
            dinero: increment(recompensa),
            misionesCompletadas: increment(1),
            tipoReputacion: tipo
        });

        // 3. Actualizar interfaz visual unificada
        if (typeof window.renderReputacion === 'function') {
            window.renderReputacion(nuevaRep);
        }

        // 4. Mostrar aviso de resultado
        // Primero mostramos el éxito de la misión y luego el estado de reputación
        if (typeof window.mostrarExitoMision === 'function') {
            window.mostrarExitoMision(nombreMision, recompensa);
        } else {
            window.log(`${nombreMision} completada. Recompensa: $${recompensa}`);
        }

        // Llamamos al aviso de reputación unificado
        window.mostrarAvisoReputacion();

        window.cerrarModal();
        console.log(`Misión ${tipo} completada. Reputación: ${nuevaRep}`);

    } catch (error) {
        console.error("Error al completar misión:", error);
        if (typeof window.log === 'function') window.log("Error al procesar la misión.");
    }
};

// --- 1. CONFIGURACIÓN DE HERRAMIENTAS ---
// Asegúrate de que 'ref', 'get', 'update', 'db', 'increment' estén definidos globalmente en tu proyecto
window.firebaseTools = { ref, get, update, increment }; 

window.verInfoReputacionEnConsola = async function() {
    const rol = window.esVisitante ? 'visitantes' : 'jugadores';
    const userRef = ref(db, `salas/${window.sala}/${rol}/${window.miIdx}`);
    
    try {
        const snap = await get(userRef);
        const datos = snap.val();
        
        if (!datos) {
            console.warn("⚠️ No se encontraron datos del jugador actual.");
            return;
        }

        const info = {
            Nombre: datos.nombre || "Desconocido",
            Reputacion: datos.reputacion ?? 0,
            Alineacion: datos.tipoReputacion || "Neutral",
            Misiones_Completadas: datos.misionesCompletadas || 0,
            Dinero: datos.dinero || 0
        };

        console.log("%c--- REPORTE DE REPUTACIÓN Y MISIONES ---", "color: #ff59aa; font-weight: bold; font-size: 14px;");
        console.table(info);
        
        if (datos.tipoReputacion === 'angel') {
            console.log("%cEstado: Protector de la ciudad (Ángel) 👼", "color: #ff59aa;");
        } else if (datos.tipoReputacion === 'gargola') {
            console.log("%cEstado: Agente del caos (Gárgola) 👿", "color: #ff59aa;");
        } else {
            console.log("%cEstado: Neutro", "color: #888;");
        }
    } catch (e) {
        console.error("❌ Error al cargar datos para la consola:", e);
    }
};

window.initCheatSystem = function() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const valor = chatInput.value.trim();
            
            // Usamos un prefijo sin barra para evitar conflictos con el motor de JS
            // Escribe: "rep 5" en vez de "/rep 5"
            if (valor.startsWith('rep ')) {
                e.preventDefault();
                const partes = valor.split(' ');
                const num = parseInt(partes[1]);
                if (!isNaN(num)) {
                    window.renderEstrellas(num);
                    window.mostrarAvisoReputacion(num);
                }
                chatInput.value = "";
            }
            
            // Escribe: "misiones" en vez de "/misiones"
            if (valor === 'misiones') {
                e.preventDefault();
                window.abrirModalMisiones();
                chatInput.value = "";
            }
        }
    });
};

window.mostrarExitoMision = function(nombreMision, recompensa) {
    const html = `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 4em; margin-bottom: 10px;">🎉</div>
            <h2 style="color: #ff59aa; margin-top: 0;">¡Misión Completada!</h2>
            <p>Has terminado: <b>${nombreMision}</b></p>
            <div style="background: #fff5f7; border: 2px dashed #ff80bf; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <div style="font-size: 0.9em; color: #666;">RECOMPENSA RECIBIDA:</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #ff59aa;">+$${recompensa}</div>
            </div>
            <button class="btn-accion" style="width:100%; background: #ff59aa;" onclick="window.cerrarModal()">¡A por la siguiente!</button>
        </div>`;
    
    window.abrirModal("Logro desbloqueado", html);
};

window.pintarCasilla = function(posicion, ownerId) {
    const celda = document.getElementById(`cell-${posicion}`);
    
    // Verificamos que los datos necesarios existan
    if (celda && Array.isArray(window.nombres) && Array.isArray(window.colores)) {
        const idx = window.nombres.indexOf(ownerId);
        const color = (idx !== -1 && window.colores[idx]) ? window.colores[idx] : null;
        
        if (color) {
            // Usamos box-shadow con 'inset' para pintar solo el interior (la parte blanca)
            // Esto mantiene los bordes y estructura original de la casilla intactos
            celda.style.boxShadow = `inset 0 0 0 100px ${color}80`; // 80 al final es opacidad al 50%
            celda.style.backgroundColor = color; 
        } else {
            // Limpiar si no hay dueño
            celda.style.boxShadow = "none";
            celda.style.backgroundColor = "transparent";
        }
        
    } else {
        console.warn("Faltan los datos de nombres/colores para pintar la casilla.");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización del Chat
    const chatInput = document.getElementById('chat-msg');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof window.enviarMensaje === 'function') window.enviarMensaje();
            }
        });
    }

    // 2. Activación de Música
    document.addEventListener('click', () => {
        if (typeof window.iniciarMusica === 'function') window.iniciarMusica();
    }, { once: true });

    // 3. Mostrar Dedicatoria
    if (typeof window.mostrarDedicatoria === 'function') window.mostrarDedicatoria();

    // 4. Configuración del Dado
    (function configurarDado() {
        const dice = document.getElementById('dice');
        if (dice) {
            const nuevoDice = dice.cloneNode(true);
            dice.parentNode.replaceChild(nuevoDice, dice);
            nuevoDice.onclick = (e) => {
                e.stopPropagation();
                if (typeof window.tirarDado === 'function') window.tirarDado();
            };
        } else {
            setTimeout(configurarDado, 1000);
        }
    })();

    // ESCUCHA GLOBAL: BOTON REPUTACION
     document.addEventListener('click', function(e) {
    // Verificamos si el elemento clicado es nuestro botón o contiene su ID
    if (e.target && (e.target.id === 'btn-reputacion-global' || e.target.classList.contains('reputacion-label'))) {
        e.preventDefault();
        
        // Ejecutamos la función de aviso
        if (typeof window.mostrarAvisoReputacion === 'function') {
            window.mostrarAvisoReputacion();
        } else if (typeof window.mostrarAvisoReputacionVisitante === 'function') {
            window.mostrarAvisoReputacionVisitante();
        }
    }
});

    // 5. LISTENERS GLOBALES (Notificaciones y Logs)
    if (window.db && window.sala && window.miIdx) {
    
    // Notificaciones Privadas (Controlada)
    window.notificacionListener = onValue(ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx + '/notificacion'), (snap) => {
        const aviso = snap.val();
        if (aviso && aviso.titulo && (Date.now() - (aviso.timestamp || 0) < 10000)) {
            window.abrirModal(aviso.titulo, `
                <div style="text-align: center;">
                    <p style="font-size: 1.1em; color: #c71585;">${aviso.mensaje}</p>
                    <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal()">Entendido</button>
                </div>
            `);
            update(ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx + '/notificacion'), { titulo: null, mensaje: null, timestamp: 0 });
        }
    });

        // Gamelog
        const logsRef = query(ref(window.db, 'salas/' + window.sala + '/logs'), limitToLast(1));
        onValue(logsRef, (snap) => {
            const data = snap.val();
            if (data) {
                const logId = Object.keys(data)[0];
                const logEntry = data[logId];
                if (logEntry && logEntry.mensaje && (Date.now() - (logEntry.timestamp || 0) < 5000)) {
                    if (typeof window.log === 'function') window.log(logEntry.mensaje);
                }
            }
        });

        // 5b. LISTENER DE REPUTACIÓN EN TIEMPO REAL
        window.reputacionListener = onValue(ref(window.db, 'salas/' + window.sala + '/visitantes/' + window.miIdx), (snap) => {
        const data = snap.val();
        if (data && data.reputacion !== undefined) {
            window.renderEstrellas(data.reputacion);
        }
    });
}

    // 6. VINCULACIÓN DE REPUTACIÓN
    const iniciarVinculoReputacion = () => {
        const btnRep = document.getElementById('btn-reputacion-global') || document.querySelector('.reputacion-label');
        if (btnRep) {
            btnRep.style.cursor = 'pointer';
            btnRep.onclick = () => {
                if (typeof window.mostrarAvisoReputacion === 'function') {
                    window.mostrarAvisoReputacion();
                } else if (typeof window.mostrarAvisoReputacionVisitante === 'function') {
                    window.mostrarAvisoReputacionVisitante();
                }
            };
        }
    };
    iniciarVinculoReputacion();
    setInterval(iniciarVinculoReputacion, 2000); 

    // 7. GENERACIÓN DEL TABLERO
    if (typeof window.generarTablero === 'function') {
        window.generarTablero();
    }
});
