import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set, runTransaction, update, onValue, push, onDisconnect, off, increment, query, limitToLast, onChildAdded } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

if (typeof window.db === 'undefined') {
    window.db = null; // Inicializamos vacío para que no sea undefined
}

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
window.db = database; 

window.nombres = ["Dog", "Horse", "Hat", "Car"];
window.colores = ["#88c4ec", "#f29c9c", "#c2f0c9", "#f3aee9"];

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

window.log = function(mensaje) {
    console.log("LOG:", mensaje);
    const logContainer = document.getElementById('game-log');
    if (logContainer) {
        const nuevoMensaje = document.createElement('div');
        // Estilo limpio, sin borde vertical
        nuevoMensaje.style.cssText = "font-size: 0.85em; margin: 4px 0; color: #d63384; font-weight: bold;";
        nuevoMensaje.innerHTML = `> ${mensaje}`;
        logContainer.appendChild(nuevoMensaje);
        logContainer.scrollTop = logContainer.scrollHeight;
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

        // Contenedor de mejoras
        const hc = document.createElement('div');
        hc.className = 'house-container';
        d.appendChild(hc);

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

    // --- FUNCIÓN HELPER ---
    function actualizarUIClima(idx) {
        const climaInfo = (window.climas && window.climas[idx]) ? window.climas[idx].n : "Cargando...";
    
    // 1. Display principal
    const elClima = document.getElementById('clima-display');
    if (elClima) elClima.innerText = `Clima: ${climaInfo}`;
    
    // 2. Clima Header en contenedor independiente (INMUNE A WINDOW.LOG)
    let container = document.getElementById('clima-container');
    if (!container) {
        // Si no existe el contenedor, lo creamos dinámicamente encima del game-log
        const gameLog = document.getElementById('game-log');
        if (gameLog) {
            container = document.createElement('div');
            container.id = 'clima-container';
            gameLog.parentNode.insertBefore(container, gameLog);
        }
    }
    
    if (container) {
        container.innerHTML = `<div id="clima-header" style="font-size: 0.85em; margin-bottom: 4px; border-bottom: 1px solid #ffccd5; padding-bottom: 2px; color: #ff80bf; font-weight: bold; position: sticky; top: 0; background: #fff5f7; z-index: 10;">☁️ Clima actual: ${climaInfo}</div>`;
        }
    }

    console.log("Sincronizando sala:", window.sala);

    // 2. LIMPIEZA TOTAL DE LISTENERS
    if (window.chatListener) { off(window.chatListener); window.chatListener = null; }
    if (window.estadoListener) { off(window.estadoListener); window.estadoListener = null; }
    if (window.climaListener) { off(window.climaListener); window.climaListener = null; }
    if (window.logListener) { off(window.logListener); window.logListener = null; }

    // 3. REFERENCIAS
    const salaRef = ref(window.db, 'salas/' + window.sala);
    const chatRef = ref(window.db, 'salas/' + window.sala + '/chat');
    const climaRef = ref(window.db, 'salas/' + window.sala + '/climaIdx');
    const logRef = ref(window.db, 'salas/' + window.sala + '/logs');

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

    // 5. ESTADO LISTENER (Sincronización maestra)
    window.estadoListener = onValue(salaRef, (snap) => {
        const s = snap.val();
        if (!s) return; 

        window.salaData = s;

        if (typeof window.pintarTodasLasCasillas === 'function') {
            window.pintarTodasLasCasillas(s);
        }

        window.creadorSala = s.creador;
        const btnIniciar = document.getElementById('btn-iniciar-partida');
        if (btnIniciar) {
            const esCreador = (window.miIdx !== undefined && String(window.miIdx) === String(s.creador));
            const estaEsperando = (s.estado === "esperando");
            
            if (esCreador && estaEsperando) {
                btnIniciar.style.display = 'flex';
                btnIniciar.classList.remove('btn-iniciar-oculto');
                btnIniciar.classList.add('btn-iniciar-visible');
            } else {
                btnIniciar.style.display = 'none';
                btnIniciar.classList.remove('btn-iniciar-visible');
                btnIniciar.classList.add('btn-iniciar-oculto');
            }
        }

        if (s.climaIdx !== undefined) {
            actualizarUIClima(s.climaIdx);
        }

        if (window.estadoPrevio === "esperando" && s.estado === "jugando") {
            if (typeof window.anunciar === 'function') window.anunciar("¡La partida ha comenzado!");
        }
        window.estadoPrevio = s.estado;

        const elDinero = document.getElementById('dinero-mio');
        if (elDinero && s.jugadores && s.jugadores[window.miIdx]) {
            elDinero.innerText = s.jugadores[window.miIdx].dinero ?? 0;
        }

        if (typeof window.actualizarTurnoUI === 'function') {
            window.actualizarTurnoUI(s);
        }

        const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
        if (btnDado) {
            const esMiTurno = (s.estado === "jugando" && String(s.turno) === String(window.miIdx));
            btnDado.style.pointerEvents = esMiTurno ? 'auto' : 'none';
            btnDado.style.opacity = esMiTurno ? '1' : '0.5';
            btnDado.style.cursor = esMiTurno ? 'pointer' : 'default';
        }

        if (s.jugadores && typeof window.actualizarTokens === 'function') {
            try { window.actualizarTokens(s.jugadores); } catch (e) { console.error("Error tokens:", e); }
        }
    });

    // 6. CLIMA LISTENER (Implementación solicitada)
    window.climaListener = onValue(climaRef, (snap) => {
        const idx = snap.val() !== null ? snap.val() : 0;
        actualizarUIClima(idx);

        const clima = window.climas ? window.climas[idx] : null;
        if (clima) {
            const gameLog = document.getElementById('game-log');
            if (gameLog) {
                gameLog.innerHTML += `<div style="font-size: 0.85em; margin-bottom: 4px; border-bottom: 1px solid #ffccd5; padding-bottom: 2px; color: #ff80bf; font-weight: bold;">
                    ☁️ Clima actual: ${clima.n}
                </div>`;
                gameLog.scrollTop = gameLog.scrollHeight;
            }
        }
    });

    // 7. LOGS LISTENER
    window.logListener = onChildAdded(query(logRef, limitToLast(20)), (snap) => {
        const data = snap.val();
        if (data && data.mensaje && typeof window.log === 'function') {
            window.log(data.mensaje);
        }
    });
};

// 1. Asegúrate de declarar esto al principio de tu script
window.jugadoresListener = null;

window.escucharJugadores = function() {
    // 1. Protección de DB
    if (typeof db === 'undefined' || !db) {
        setTimeout(window.escucharJugadores, 500);
        return;
    }
    
    if (!window.sala) return;

    // 2. LIMPIEZA: Si ya hay un listener activo, lo matamos antes de crear otro
    if (window.jugadoresListener) {
        off(window.jugadoresListener);
        window.jugadoresListener = null;
    }

    const jugadoresRef = ref(db, 'salas/' + window.sala + '/jugadores');
    
    // 3. Listener con control
    window.jugadoresListener = onValue(jugadoresRef, (snap) => {
        const jugadores = snap.val();
        if (jugadores) {
            // Aseguramos tablero
            if (!document.getElementById('cell-0') && typeof window.generarTablero === 'function') {
                window.generarTablero();
            }
            // Actualizar tokens
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

// Añade esto una vez al inicio de tu script
window.obtenerDatosJugador = function(id, data = null) {
    // 1. Si tenemos data (snapshot), buscamos ahí primero
    if (data && data.jugadores && data.jugadores[id]) {
        return {
            nombre: data.jugadores[id].nombre || "Jugador",
            color: window.colores ? (window.colores[id] || "#ccc") : "#ccc"
        };
    }
    // 2. Si no, buscamos en globales (Respaldo)
    return {
        nombre: (window.nombres && window.nombres[id]) ? window.nombres[id] : "Jugador " + id,
        color: (window.colores && window.colores[id]) ? window.colores[id] : "#ccc"
    };
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

window.iniciarCicloClima = function() {
    if (window.climaInterval) clearInterval(window.climaInterval);
    
    window.climaInterval = setInterval(async () => {
        try {
            // USAMOS window.db
            const salaSnap = await get(ref(window.db, 'salas/' + window.sala));
            const salaData = salaSnap.val();
            if (!salaData) return;

            const hayVisitantes = salaData.visitantes && Object.keys(salaData.visitantes).length > 0;
            if (hayVisitantes) return; 

            const controlRef = ref(window.db, 'salas/' + window.sala + '/controladorClima');
            const snap = await get(controlRef);
            const ctrl = snap.val();
            const ahora = Date.now();
            
            if (!ctrl || (ahora - (ctrl.timestamp || 0) > 300000)) {
                const nuevoIdx = Math.floor(Math.random() * (window.climas ? window.climas.length : 1));
                const nuevoClima = window.climas ? window.climas[nuevoIdx] : { n: "Desconocido" };
                
                const porcentaje = Math.random() < 0.5 ? 0.05 : 0.10;
                let ajuste = 0;
                
                if (nuevoClima.tipo === "desastre") ajuste = -porcentaje;
                else if (nuevoClima.tipo === "bonanza") ajuste = porcentaje;

                await update(ref(window.db, 'salas/' + window.sala), { 
                    climaIdx: nuevoIdx,
                    modificadorAlquiler: ajuste
                });
                
                await update(controlRef, { timestamp: ahora });
                
                const mensaje = `¡El clima cambió a ${nuevoClima.n}! ${ajuste !== 0 ? 'Ajuste: ' + (ajuste * 100).toFixed(0) + '%' : 'Alquiler estable.'}`;
                
                await push(ref(window.db, 'salas/' + window.sala + '/logs'), {
                    mensaje: mensaje,
                    timestamp: ahora
                });
            }
        } catch (error) {
            console.error("Error en el ciclo automático de clima:", error);
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
    {color: "#edca70", indices: [1, 3, 4, 5]},
    {color: "#6bb8da", indices: [7, 10, 11, 13]},
    {color: "#f571b1", indices: [14, 15, 16, 17]},
    {color: "#7cc687", indices: [19, 20, 21, 23]}, 
    {color: "#b671e7", indices: [8, 24, 26, 27]} 
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
    
    // 1. Identificación del usuario y reglas de negocio
    const esVisitante = rol.toString().startsWith('v');
    const dineroInicial = esVisitante ? 2000 : 1500;

    // Mapeo para asignar ID de pieza único (0-3 Jugadores, 4-6 Visitantes)
    const pieceMap = { "Dog": 0, "Horse": 1, "Hat": 2, "Car": 3, "v1": 4, "v2": 5, "v3": 6 };
    
    const datosJugador = { 
        nombre: rol, 
        pieceNum_: pieceMap[rol] ?? 99, // 99 como fallback de seguridad
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
        enCarcel: 0,
        esVisitante: esVisitante // Marcador crítico para reconocerlos después
    };
    
    // 2. Lógica si eres el creador de la sala
    if (esCreacion) {
        const roomData = { 
            estado: "esperando", 
            creador: rol, 
            jugadores: { [rol]: datosJugador } 
        };
        
        try {
            await set(ref(db, 'salas/' + salaId), roomData);
            
            window.miIdx = rol; 
            window.creadorSala = rol; 
            window.esVisitante = esVisitante;
            
            const botonIniciar = document.getElementById('btn-iniciar-partida');
            if (botonIniciar) {
                botonIniciar.style.setProperty('display', 'flex', 'important');
            }
            
            window.cerrarModal();
            window.anunciarEnChat(salaId, rol + " ha creado la sala.");
            window.abrirModal("Éxito", `<p>Sala creada como <b>${rol}</b></p>`);
            
            // Inicialización de procesos
            window.sincronizar();
            if (typeof window.escucharOfertas === 'function') window.escucharOfertas(); 
        } catch (error) {
            console.error("Error al crear la sala:", error);
        }
        
    } else {
        // 3. Lógica si te unes o te reconectas (Transacción Atómica)
        const dbRef = ref(db, 'salas/' + salaId + '/jugadores');
        
        runTransaction(dbRef, (jugadores) => {
            if (!jugadores) jugadores = {};
            
            if (jugadores[rol]) {
                // RECONEXIÓN: El jugador ya existe, solo activamos su estado.
                // Mantenemos TODO lo demás (dinero, pos, etc.) intacto.
                jugadores[rol].activo = true; 
            } else {
                // UNIÓN: Jugador nuevo, creamos su ficha desde cero.
                jugadores[rol] = datosJugador;
            }
            return jugadores;
        }).then((res) => {
            if (res.committed) {
                // Éxito: El servidor aceptó la unión o reconexión
                window.miIdx = rol; 
                window.esVisitante = esVisitante;
                
                window.cerrarModal();
                window.anunciarEnChat(salaId, rol + " se ha unido o reconectado.");
                
                window.sincronizar();
                if (typeof window.escucharOfertas === 'function') window.escucharOfertas(); 
            } else {
                // Fallo: Ocurrió un error en la transacción o el ID estaba bloqueado
                window.mostrarErrorOcupado(rol);
            }
        }).catch((err) => {
            console.error("Fallo crítico en la transacción de unión:", err);
        });
    }
};

window.iniciarPartida = function() {
    if (!window.sala) return;
    
    const salaRef = ref(db, 'salas/' + window.sala);
    
    get(salaRef).then((snap) => {
        const s = snap.val();
        
        // Verificación de seguridad
        if (!s || !s.jugadores) {
            console.error("No se encontraron jugadores para iniciar.");
            window.log("Error: No hay nadie en la sala para empezar.");
            return;
        }

        // Validación: No permitir reiniciar si ya está jugando
        if (s.estado === "jugando") {
            window.log("La partida ya está en curso.");
            return;
        }

        // Obtenemos los IDs (roles) de los jugadores registrados
        const jugadoresIds = Object.keys(s.jugadores);

        if (jugadoresIds.length === 0) {
            window.log("Error: No hay participantes para empezar.");
            return;
        }

        // Elegimos al azar usando los IDs
        const jugadorInicial = jugadoresIds[Math.floor(Math.random() * jugadoresIds.length)];

        // Preparamos las actualizaciones (rutas relativas a la sala)
        let actualizaciones = { 
            estado: "jugando", 
            turno: jugadorInicial 
        };

        // Asignamos condiciones iniciales a cada jugador por su ID
        jugadoresIds.forEach(id => {
            actualizaciones['jugadores/' + id + '/dinero'] = 1500;
            actualizaciones['jugadores/' + id + '/enCarcel'] = 0; 
            actualizaciones['jugadores/' + id + '/activo'] = true;
        });

        // Ejecutamos la actualización atómica
        update(salaRef, actualizaciones)
        .then(() => {
            // Confirmación segura: usamos el ID para buscar el nombre
            const jugadorData = s.jugadores[jugadorInicial];
            const nombreTurno = jugadorData ? (jugadorData.nombre || jugadorInicial) : jugadorInicial;
            
            window.log("¡La partida ha comenzado! Turno de: " + nombreTurno);
            window.log("Se han repartido $1500 a cada participante.");
            
            // Forzamos sincronización local
            window.sincronizar();
        })
        .catch((error) => {
            console.error("Error al actualizar la base de datos:", error);
            window.abrirModal("Error", "No se pudo iniciar la partida: " + error.message);
        });

    }).catch((error) => {
        console.error("Error al leer la sala:", error);
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

// --- 4. Unión de Visitante (Persistente y con distinción) ---
window.unirseComoVisitante = async function(salaId, esCreacion, nombreVisitante = "Visitante") {
    window.sala = salaId;
    window.esVisitante = true;
    
    // El ID será el nombre del visitante proporcionado
    const miRolCalculado = nombreVisitante;
    
    // Configuración unificada para visitante dentro de 'jugadores'
    const datosVisitante = { 
        nombre: nombreVisitante, 
        esVisitante: true, 
        activo: true, 
        pos: 0, 
        dinero: 2000,
        reputacion: 0,
        misionesCompletadas: 0,
        pieceNum_: 99 // Fallback de seguridad
    };

    if (esCreacion) {
        const roomData = {
            estado: "esperando",
            creador: miRolCalculado,
            jugadores: { [miRolCalculado]: datosVisitante }
        };
        await set(ref(db, 'salas/' + salaId), roomData);
    } else {
        const dbRef = ref(db, 'salas/' + salaId + '/jugadores');
        const res = await runTransaction(dbRef, (jugadores) => {
            if (!jugadores) jugadores = {};
            
            // Lógica de reconexión/unión por ID (sin auto-incremento)
            if (jugadores[miRolCalculado]) {
                // Si el ID existe, solo marcamos como activo
                jugadores[miRolCalculado].activo = true;
            } else {
                // Si el ID no existe, creamos la ficha
                jugadores[miRolCalculado] = datosVisitante;
            }
            return jugadores;
        });
        
        if (!res.committed) {
            console.error("Error en la transacción de unión de visitante.");
            return;
        }
    }

    // --- FINALIZACIÓN Y PERSISTENCIA ---
    window.miIdx = miRolCalculado;
    localStorage.setItem('monopoly_session', JSON.stringify({ salaId: window.sala, miIdx: window.miIdx }));
    
    window.configurarDesconexion(window.sala, window.miIdx);
    
    window.cerrarModal();
    window.anunciarEnChat(salaId, nombreVisitante + " se ha unido a la partida.");
    window.actualizarBotonesPoderes();
    window.renderEstrellas(0);
    window.abrirModal("Éxito", `<p>Entraste como <b>Visitante (${window.miIdx})</b></p><button class="btn-sidebar" onclick="window.cerrarModal()">Comenzar</button>`);
    window.sincronizar();
};

// --- 5. Anuncio en Chat y Desconexión (Optimizado) ---
window.anunciarEnChat = function(salaId, mensaje, esSistema = true) {
    const chatRef = ref(db, 'salas/' + salaId + '/chat');
    
    push(chatRef, { 
        n: esSistema ? "Sistema" : "Info", 
        m: mensaje, 
        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        esChat: true, 
        esRosa: esSistema 
    });
};

window.configurarDesconexion = function(salaId, jugadorIdx) {
    // jugadorIdx es el ID único (ej: "Dog", "v1")
    const miRef = ref(db, 'salas/' + salaId + '/jugadores/' + jugadorIdx);

    // Marcamos como inactivo en lugar de borrar para mantener la integridad de los turnos
    onDisconnect(miRef).update({ 
        activo: false 
    });
};

window.enviarMensaje = function() {
    const input = document.getElementById('chat-msg');
    if (!input) return;
    
    const mensaje = input.value.trim();
    // window.miIdx es el ID/Nombre del jugador
    if (mensaje === "" || !window.sala || window.miIdx === undefined) return;
    
    let idMostrar = window.miIdx;
    // Si el ID es de un visitante (empieza por 'v'), lo formateamos para el chat
    if (typeof idMostrar === 'string' && idMostrar.startsWith('v')) {
        idMostrar = "Visitante " + idMostrar.replace('v', '');
    }

    push(ref(db, 'salas/' + window.sala + '/chat'), {
        n: idMostrar,
        m: mensaje,
        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }).then(() => { 
        input.value = ""; 
    }).catch((e) => console.error("Error al enviar mensaje:", e));
};

// --- Lógica de Lanzamiento de Dado ---
window.tirarDado = async function() {
    if (window.esVisitante) { console.warn("Los visitantes no pueden lanzar el dado."); return; }
    if (typeof window.miIdx === 'undefined' || window.estaLanzando) return;
    if (typeof window.db === 'undefined' || !window.db) return;

    window.estaLanzando = true;
    const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
    if (btnDado) btnDado.style.pointerEvents = 'none';

    try {
        const salaRef = ref(window.db, 'salas/' + window.sala);
        const snap = await get(salaRef);
        if (!snap.exists()) { console.error("Sala perdida"); window.estaLanzando = false; return; }
        let s = snap.val();

        if (!s.jugadores) { console.error("No hay jugadores"); window.estaLanzando = false; return; }

        if (!s.turno || s.estado !== "jugando") {
            await update(salaRef, { estado: "jugando", turno: window.miIdx });
            s.turno = window.miIdx; s.estado = "jugando";
        }

        const keys = Object.keys(s.jugadores || {});
        // Lógica de ID: Filtramos por los IDs de los jugadores para verificar si es el turno
        const esSolo = keys.filter(k => !String(k).startsWith('v')).length === 1;

        if (!esSolo && String(s.turno) !== String(window.miIdx)) {
            window.estaLanzando = false;
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            return;
        }

        const miJugador = s.jugadores[window.miIdx];
        if (!miJugador) return; 

        if ((miJugador.enCarcel ?? 0) > 0) {
            window.mostrarOpcionesCarcel();
            window.estaLanzando = false;
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            return;
        }

        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const dado = (array[0] % 6) + 1;
        
        window.lanzarDado3D(dado);
        await new Promise(r => setTimeout(r, 700));

        // --- LÓGICA TRES SEIS (FRAUDE) ---
        window.consecutivos6 = (dado === 6) ? (window.consecutivos6 + 1) : 0;

        if (window.consecutivos6 >= 3) {
            window.consecutivos6 = 0;
            
            // --- ACTUALIZACIÓN DE REPUTACIÓN POR ID ---
            if (typeof window.actualizarReputacionConContador === 'function') {
                await window.actualizarReputacionConContador('fraude', false);
            }

            await update(ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { 
                pos: 9, enCarcel: 1 
            });
            
            window.log("¡Cazado! " + (window.nombres[window.miIdx] || "Jugador") + " fue enviado a la cárcel por fraude.");
            
            window.abrirModal("¡FRAUDE EN EL CASINO!", `
                <div class="modal-fraude">
                    <h2>¡Juego Sucio!</h2>
                    <p>La seguridad del casino te ha sorprendido haciendo trampa con los dados.</p>
                    <p>Te enviamos a la cárcel a cumplir condena (un turno sin jugar).</p>
                    <button onclick="window.cerrarModal(); window.pasarTurno();" class="btn-sidebar" style="margin-top: 10px;">Aceptar consecuencias</button>
                </div>
            `);
            
            window.estaLanzando = false;
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            return; 
        }

        // --- MOVIMIENTO NORMAL ---
        const posAnterior = Number(miJugador.pos || 0);
        const nuevaPos = (posAnterior + dado) % 28;
        
        // Verificación de paso por SALIDA usando el ID
        if (nuevaPos < posAnterior) {
            await update(ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { dinero: increment(250) });
            window.log("¡Pasaste por SALIDA y ganaste $250!");
        }

        // Actualización de posición mediante ID
        await update(ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { pos: nuevaPos });

        if (!esSolo) {
            if (dado !== 6) window.pasarTurno();
            else window.log((window.nombres[window.miIdx] || window.miIdx) + " sacó 6 y repite turno!");
        }

        if (typeof window.manejarCasilla === 'function') await window.manejarCasilla(nuevaPos, true);

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

        // Filtramos IDs que no sean visitantes
        const listaJugadores = Object.keys(s.jugadores).filter(id => !id.startsWith('v'));
        if (listaJugadores.length === 0) return;

        const primerJugador = listaJugadores[Math.floor(Math.random() * listaJugadores.length)];
        update(salaRef, { turno: primerJugador });
    });
};

window.pasarTurno = async function() {
    const salaRef = ref(window.db, 'salas/' + window.sala);
    const snap = await get(salaRef);
    const s = snap.val();
    if (!s || !s.jugadores) return;

    // Solo tomamos jugadores reales (no visitantes) usando sus IDs
    const listaJugadores = Object.keys(s.jugadores).filter(id => !id.startsWith('v'));
    
    if (listaJugadores.length === 0) return;

    let currentIndex = listaJugadores.indexOf(s.turno);
    let siguienteId = s.turno; 
    let encontrado = false;

    // Buscamos al siguiente jugador libre (damos una vuelta completa como máximo)
    for (let i = 1; i <= listaJugadores.length; i++) {
        let candidateIdx = (currentIndex + i) % listaJugadores.length;
        let candidateId = listaJugadores[candidateIdx];
        let candidate = s.jugadores[candidateId];

        // LÓGICA DE CÁRCEL
        if (candidate && (candidate.enCarcel ?? 0) > 0) {
            let nuevoContador = candidate.enCarcel - 1;

            if (nuevoContador <= 0) {
                // Cumplió condena: Sale libre
                await update(ref(window.db, `salas/${window.sala}/jugadores/${candidateId}`), {
                    enCarcel: null
                });
                window.log((candidate.nombre || candidateId) + " ha cumplido su condena y sale de la cárcel.");
                siguienteId = candidateId;
                encontrado = true;
                break; // Es su turno
            } else {
                // Sigue en la cárcel: Restamos turno y continuamos buscando
                await update(ref(window.db, `salas/${window.sala}/jugadores/${candidateId}`), {
                    enCarcel: nuevoContador
                });
                window.log((candidate.nombre || candidateId) + " sigue en la cárcel. Le quedan " + nuevoContador + " turnos.");
                // No rompemos el bucle, seguimos buscando al siguiente jugador libre
            }
        } else {
            // Jugador libre, es su turno
            siguienteId = candidateId;
            encontrado = true;
            break;
        }
    }

    // Finalizamos el cambio de turno
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
    if (typeof db === 'undefined' || !db || !window.sala) return;

    try {
        const salaRef = ref(db, 'salas/' + window.sala);
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
        const celda = document.getElementById('cell-' + p);

        // Verificamos que todo exista antes de crear nada
        // ACTUALIZADO A ID: Usamos 'id' para la validación y el mapeo
        if (celda && id && tokensMap[id]) {
            celda.style.position = 'relative';

            const token = document.createElement('img');
            token.className = 'token';
            token.id = 'token-' + id;
            token.src = tokensMap[id]; // ACTUALIZADO A ID

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

// --- 1. VERIFICAR BANCARROTA (Castigo de reputación) ---
window.verificarBancarrota = async function(jugadorIdx, saldo) {
    if (saldo < 0) {
        const playerRef = ref(db, 'salas/' + window.sala + '/jugadores/' + jugadorIdx);
        const snap = await get(playerRef);
        const data = snap.val();
        if (!data) return;

        // Incrementar contador y calcular reputación
        let count = (data.bancarrotasCount || 0) + 1;
        let repActual = (data.reputacion !== undefined) ? data.reputacion : 5;
        let updates = { bancarrotasCount: count };

        // Castigo: Cada 3 bancarrotas, pierde 1 punto de reputación
        if (count > 0 && count % 3 === 0) {
            repActual = Math.max(0, repActual - 1);
            updates.reputacion = repActual;
            window.log(`¡Advertencia! ${data.nombre || jugadorIdx} ha acumulado ${count} bancarrotas. ¡Reputación reducida!`);
            
            if (typeof window.renderEstrellas === 'function') {
                window.renderEstrellas(repActual);
            }
        }

        // Aplicar cambios
        await update(playerRef, updates);

        // Notificación
        push(ref(db, 'salas/' + window.sala + '/chat'), {
            n: "Banco",
            m: `¡Alerta! ${data.nombre || jugadorIdx} ha caído en bancarrota con un saldo de $${saldo}. (Total: ${count} veces)`,
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        window.abrirModal("¡Bancarrota!", `
            <div class="modal-content">
                <p>Tu saldo es <b>$${saldo}</b>.</p>
                <p>¡El Banco recomienda solicitar un préstamo urgente para continuar!</p>
                <button class="btn-accion" style="width: 100%; margin-top: 15px;" onclick="window.cerrarModal(); window.abrirBanco();">Ir al Banco</button>
            </div>
        `);
    }
};

window.abrirBanco = async function() {
    // Verificación actualizada para ID
    if (typeof window.sala === 'undefined' || !window.miIdx || !db) {
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

// --- 2. VER SALDOS (Distingue jugadores y visitantes) ---
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
                const j = c.val();
                const key = c.key.toString(); // ID del jugador/visitante
                const esVisitante = key.startsWith('v'); 
                
                // Si es visitante, usa "Citizen", si es jugador usa su nombre guardado o ID
                let nombre = j.nombre || (esVisitante ? "Citizen " + key.replace('v','') : key);
                let dinero = j.dinero || 0;
                
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

// --- SOLICITAR PRÉSTAMO ---
window.solicitarPrestamo = async function(monto) {
    // Usamos el ID (window.miIdx) para la referencia
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
        </div>
    `);
};

window.abrirPagar = async function() {
    const jRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jRef);
    const j = snap.val();

    if (!j || !j.tienePrestamo) {
        window.abrirModal("Banco Central", "<p>No tienes deudas pendientes.</p><button class='btn-accion' onclick='window.cerrarModal()'>Aceptar</button>");
        return;
    }

    // Modal de confirmación
    const contenido = `
        <div style="text-align:center;">
            <h3>Liquidación de Deuda</h3>
            <p>Tu deuda actual es de: <b>$${j.montoPrestamo}</b></p>
            <p>Al pagar, ganarás <b>+1 de reputación</b>.</p>
            <button class="btn-accion" style="background:#2ecc71;" onclick="window.pagarPrestamo();">Confirmar Pago</button>
            <button class="btn-accion" style="background:#95a5a6;" onclick="window.cerrarModal();">Cancelar</button>
        </div>
    `;
    window.abrirModal("Pagar Préstamo", contenido);
};

// --- PAGAR PRÉSTAMO ---
window.pagarPrestamo = async function() {
    const jRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jRef);
    const j = snap.val();

    if (!j || !j.tienePrestamo) {
        window.abrirModal("Banco Central", "<p>No tienes deudas pendientes.</p><button class='btn-accion' onclick='window.cerrarModal()'>Aceptar</button>");
        return;
    }

    // Calcular montos
    const saldoActual = (j.dinero || 0);
    const deuda = j.montoPrestamo;

    if (saldoActual < deuda) {
        window.abrirModal("Error", `<p>Saldo insuficiente. Tu saldo es <b>$${saldoActual}</b> y debes <b>$${deuda}</b>.</p>`);
        return;
    }

    // Actualizar reputación (máximo 5)
    const nuevaReputacion = Math.min(5, (j.reputacion || 0) + 1);

    // Ejecutar actualización
    await update(jRef, { 
        tienePrestamo: false, 
        montoPrestamo: 0,
        dinero: saldoActual - deuda,
        reputacion: nuevaReputacion
    });

    // Actualizar UI
    if (typeof window.renderEstrellas === 'function') window.renderEstrellas(nuevaReputacion);
    
    window.log("¡Deuda liquidada! Has ganado +1 de reputación.");
    window.cerrarModal();
    window.abrirModal("Éxito", "<p>Deuda liquidada. Has recibido +1 de reputación.</p>");
};

window.obtenerGrupo = function(pos) {
    return grupos.find(g => g.indices.includes(pos));
};

window.verificarParColor = async function(pos, todasLasPropiedades) {
    const grupo = window.obtenerGrupo(pos);
    if (!grupo) return;

    // Filtramos propiedades del grupo que son del jugador
    const propiasDelGrupo = grupo.indices.filter(idx => 
        todasLasPropiedades[idx] && todasLasPropiedades[idx].owner === window.miIdx
    );

    // Lógica dinámica: Si tiene todas las propiedades del grupo
    // Nota: cambié length === 2 por length === grupo.indices.length para que funcione en cualquier grupo
    const tieneMonopolio = propiasDelGrupo.length === grupo.indices.length;

    if (tieneMonopolio) {
        const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
        const snap = await get(jugadorRef);
        let j = snap.val();

        // Solo damos el bono si no lo tiene ya (usamos el flag bonoParColor para control)
        if (!j.bonoParColor) {
            const nuevaReputacion = Math.min(5, (j.reputacion || 0) + 1);
            
            await update(jugadorRef, { 
                reputacion: nuevaReputacion, // Usamos la variable unificada
                bonoParColor: true 
            });

            window.log("⭐ ¡Grupo completado! Has ganado +1 de reputación.");
            
            // Actualización UI
            if (typeof window.renderEstrellas === 'function') {
                window.renderEstrellas(nuevaReputacion);
            }
            window.mostrarAvisoReputacion(nuevaReputacion);
        }
    } else {
        // HUECO CUBIERTO: Si pierde una propiedad, quitamos el bono
        const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
        const snap = await get(jugadorRef);
        let j = snap.val();

        if (j.bonoParColor) {
            await update(jugadorRef, { bonoParColor: false });
            window.log("Has perdido el grupo de color, el bono de reputación se ha desactivado.");
        }
    }
};

window.verificarMonopolio = function(pos, todasLasPropiedades) {
    const grupo = window.obtenerGrupo(pos);
    if (!grupo) return false;
    
    // Verificación segura de que TODAS las propiedades del grupo tienen el mismo dueño
    return grupo.indices.every(idx => 
        todasLasPropiedades && 
        todasLasPropiedades[idx] && 
        todasLasPropiedades[idx].owner === window.miIdx
    );
};

window.comprar = async function(pos) {
    if (typeof window.sala === 'undefined' || typeof window.miIdx === 'undefined') return;

    const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const propRef = ref(window.db, 'salas/' + window.sala + '/propiedades/' + pos);

    // Obtenemos ambos datos a la vez para validar la compra
    const [snapJugador, snapProp] = await Promise.all([get(jugadorRef), get(propRef)]);
    const j = snapJugador.val();
    const p = snapProp.val();

    // 1. Validación de seguridad: ¿Ya tiene dueño?
    if (p && p.owner) {
        window.abrirModal("Error", "<p>Esta propiedad ya tiene dueño.</p>");
        return;
    }

    // 2. Validación de existencia y precio
    if (!window.mapa || !window.mapa[pos]) {
        console.error("Error: Posición de mapa inválida.");
        return;
    }
    const precio = window.mapa[pos].p;

    // 3. Verificación de fondos
    if (j.dinero >= precio) {
        // Ejecución atómica
        const updates = {};
        updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = j.dinero - precio;
        updates['salas/' + window.sala + '/propiedades/' + pos] = { 
            owner: window.miIdx, 
            nivel: 0, 
            hipotecada: false,
            p: precio // <--- ESTO ES LO QUE FALTABA
        };

        await update(ref(window.db), updates);

        // --- UI Y ACCIONES ---
        window.pintarCasilla(pos, window.miIdx);
        window.log("Has comprado " + (window.mapa[pos].n || "Propiedad"));
        window.cerrarModal();
        
    } else {
        // 4. Fondos insuficientes
        window.abrirModal("Fondos insuficientes", `
            <div style="text-align: center; padding: 10px;">
                <p>No tienes suficiente dinero para esta compra.</p>
                <p>Precio: <b>$${precio}</b> | Tu saldo: <b>$${j.dinero}</b></p>
                <p>¿Deseas solicitar un préstamo urgente?</p>
                
                <button class="btn-accion" style="width: 100%; margin-bottom: 10px;" onclick="window.solicitarPrestamo(1000); window.cerrarModal();">
                    Solicitar Préstamo ($1000)
                </button>
                
                <button class="btn-accion" style="width: 100%; background: #ff59aa;" onclick="window.cerrarModal()">
                    Cancelar
                </button>
            </div>
        `);
    }
};

window.verPropiedad = function(pos, permitirCompra = false, dataActual = null) {
    const p = window.mapa[pos];
    if (!p || p.p === 0) return;

    // 1. Carga segura de datos (Prioriza la data actual, o usa la global como respaldo)
    const data = dataActual || window.salaData || {}; 
    const props = data.propiedades || {};
    const prop = props[pos] || null;
    
    // Obtener color del grupo para el encabezado
    const grupo = grupos.find(g => g.indices.includes(pos));
    const colorHeader = grupo ? grupo.color : "#ff80bf";
    
    // Obtener clima de forma segura
    const clima = (window.climas && window.climas[data.climaIdx || 0]) ? window.climas[data.climaIdx || 0] : { n: "Normal", mult: 1 };
    const mult = clima.mult;

    const indicesTransporte = [8, 24, 26, 27];
    const esTransporte = indicesTransporte.includes(pos);
    
    // 2. Iconos y estilo rosa
    const iconos = { 
        8:  'https://www.svgrepo.com/show/490615/car-2.svg',
        24: 'https://www.svgrepo.com/show/390391/motorcycle-cross-moto-bike.svg',
        26: 'https://www.svgrepo.com/show/490281/plane.svg',
        27: 'https://www.svgrepo.com/show/480860/train-station-mark.svg'
    };
    const filtroRosa = "invert(75%) sepia(21%) saturate(1828%) hue-rotate(293deg) brightness(105%) contrast(101%)";

    // 3. Lógica de Alquiler
    let alquiler;
    let listaAlquileres = "";

    if (esTransporte) {
        // Usamos el owner ID directamente
        const ownerId = prop ? prop.owner : null;
        const cantidad = ownerId !== null ? indicesTransporte.filter(idx => props[idx]?.owner == ownerId).length : 0;
        const tabla = { 0: 0, 1: 250, 2: 350, 3: 350, 4: 450 };
        alquiler = Math.floor(tabla[cantidad] * mult);
        listaAlquileres = `<li>1 poseído: $250</li><li>2 poseídos: $350</li><li>3 poseídos: $350</li><li>4 poseídos: $450</li>`;
    } else {
        const niveles = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5];
        const nivel = prop ? (prop.nivel || 0) : 0;
        alquiler = Math.floor((p.p * niveles[nivel]) * mult);
        listaAlquileres = niveles.map((n, i) => {
            let label = i === 0 ? "Base" : (i < 5 ? `Nivel ${i} (Casas)` : "Hotel (Nivel 5)");
            return `<li style="margin: 3px 0;">${label}: $${Math.floor(p.p * n * mult)}</li>`;
        }).join('');
    }

    // 4. Estados de Dueño (Blindaje total: usamos el ID como string, NO convertimos a entero)
    const ownerId = prop ? prop.owner : null;
    const esDuenio = (ownerId !== null && String(ownerId) === String(window.miIdx));
    const estaHipotecada = prop && prop.hipotecada;
    const colorClima = mult < 1 ? '#e74c3c' : '#ff80bf';
    
    // Identificación robusta: Primero buscamos en los datos de la sala, luego en las globales
    const jugadorData = (ownerId && data.jugadores && data.jugadores[ownerId]) ? data.jugadores[ownerId] : null;
    const nombreDueño = jugadorData ? (jugadorData.nombre || "Jugador") : (window.nombres && window.nombres[ownerId] ? window.nombres[ownerId] : "Desconocido");
    const colorDueño = (window.colores && window.colores[ownerId]) ? window.colores[ownerId] : "#ccc";

    let contenido = `
        <div class="card-property">
            <div class="card-header" style="background:${colorHeader}; color:white; padding:10px; border-radius:5px 5px 0 0; text-align:center; font-weight:bold;">${p.n}</div>
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

    // 5. Botones de Acción
    if (!prop) {
        contenido += permitirCompra ? 
            `<button class="btn-sidebar" style="width:100%; display:block; background:#ff80bf; color:white; margin-bottom:10px;" onclick="window.comprar(${pos}); window.cerrarModal();">Comprar Propiedad</button>` : 
            `<p style="color:gray; font-size:0.8em;">Debes estar en la casilla para comprar.</p>`;
    } else if (esDuenio) {
        contenido += `
            <div style="border-left: 5px solid ${colorDueño}; padding-left: 10px; margin-bottom: 15px;">Dueño: <b>Tú</b></div>
            <button class="btn-sidebar" style="width:100%; display:block; background:#2ecc71; color:white; margin-bottom:10px;" onclick="window.mejorar(${pos}); window.cerrarModal();">Mejorar (+$50)</button>
            <button class="btn-sidebar" style="width:100%; display:block; background:#95a5a6; color:white; margin-bottom:10px;" onclick="window.hipotecar(${pos}); window.cerrarModal();">${estaHipotecada ? "Liberar" : "Hipotecar"}</button>`;
    } else if (!estaHipotecada) {
        contenido += `
            <div style="border-left: 5px solid ${colorDueño}; padding-left: 10px; margin-bottom: 15px;">Dueño: <b>${nombreDueño}</b></div>
            <button class="btn-sidebar" style="width:100%; display:block; background:#e67e22; color:white; margin-bottom:10px;" onclick="window.interaccionAlquiler('${ownerId}', ${alquiler}); window.cerrarModal();">Pagar Alquiler</button>`;
    } else {
        contenido += `<div style="border-left: 5px solid ${colorDueño}; padding-left: 10px; margin-bottom: 15px;">Dueño: <b>${nombreDueño}</b></div>
                      <p>Propiedad hipotecada. No paga alquiler.</p>`;
    }

    contenido += `</div></div></div>`;
    window.abrirModal("Tarjeta de Propiedad", contenido);
};

// --- 1. ABRIR VENTANA DE INTERCAMBIO (REVISADA Y SEGURA) ---
window.abrirIntercambio = function() {
    // Usamos el estado actual del juego en lugar de hacer una nueva llamada get() si es posible
    // Pero para asegurar integridad, hacemos la petición a la sala
    get(ref(db, 'salas/' + window.sala)).then((snap) => {
        let data = snap.val();
        
        if (!data || !data.propiedades) {
            window.abrirModal("Error", "<p>No hay propiedades registradas en la sala.</p>");
            return;
        }

        // Filtramos propiedades que realmente pertenecen al usuario usando ID
        let misProps = Object.keys(data.propiedades).filter(idx => 
            String(data.propiedades[idx].owner) === String(window.miIdx)
        );

        if (misProps.length === 0) {
            window.abrirModal("Aviso", "<p>No posees propiedades para intercambiar.</p>");
            return;
        }

        // Generamos opciones
        let optionsProps = misProps.map(idx => {
            const nombre = window.mapa[idx] ? window.mapa[idx].n : "Propiedad #" + idx;
            return `<option value="${idx}">${nombre}</option>`;
        }).join('');

        // Filtramos jugadores para que no se incluya a sí mismo (usando ID)
        let optionsJugadores = Object.keys(data.jugadores || {}).filter(jIdx => 
            String(jIdx) !== String(window.miIdx)
        ).map(jIdx => {
            const nombre = (window.nombres && window.nombres[jIdx]) ? window.nombres[jIdx] : "Jugador " + jIdx;
            return `<option value="${jIdx}">${nombre}</option>`;
        }).join('');

        if (!optionsJugadores) {
            window.abrirModal("Aviso", "<p>No hay otros jugadores en la sala para negociar.</p>");
            return;
        }

        const contenido = `
            <div style="display:flex; flex-direction:column; gap: 10px; width: 100%;">
                <label><b>Tu propiedad:</b></label>
                <select id="select-prop" class="input-field" style="width:100%; padding:8px;">${optionsProps}</select>
                
                <label><b>Vender a:</b></label>
                <select id="select-jugador" class="input-field" style="width:100%; padding:8px;">${optionsJugadores}</select>
                
                <label><b>Precio ($):</b></label>
                <input type="number" id="input-valor" class="input-field" min="100" max="5000" value="500" style="width:100%; padding:8px;">
                
                <button class="btn-sidebar" style="background:#ff80bf; color:white; border:none; padding:12px; cursor:pointer; margin-top:10px; font-weight:bold;" 
                        onclick="window.ejecutarIntercambio()">Enviar Oferta</button>
            </div>
        `;
        window.abrirModal("Intercambio", contenido);
    });
};

// --- 2. EJECUTAR OFERTA (BLINDADA) ---
window.ejecutarIntercambio = async function() {
    const pIdx = document.getElementById('select-prop').value;
    const destino = document.getElementById('select-jugador').value;
    const valor = parseInt(document.getElementById('input-valor').value);

    // Validación de entrada
    if (isNaN(valor) || valor < 100 || valor > 5000) { 
        window.abrirModal("Error", "El precio debe estar entre 100 y 5000."); 
        return; 
    }

    // Doble verificación: ¿Aún poseo la propiedad antes de enviar?
    const propRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pIdx);
    const snap = await get(propRef);
    const prop = snap.val();

    // Verificación estricta de ID
    if (!prop || String(prop.owner) !== String(window.miIdx)) {
        window.abrirModal("Error", "Ya no posees esta propiedad, el intercambio se ha cancelado.");
        return;
    }

    const oferta = {
        propiedad: parseInt(pIdx),
        vendedor: String(window.miIdx), 
        comprador: String(destino), 
        precio: valor,
        estado: 'pendiente',
        timestamp: Date.now()
    };

    window.abrirModal("Procesando...", "Enviando oferta...");
    
    push(ref(db, 'salas/' + window.sala + '/ofertas'), oferta)
    .then(() => {
        window.cerrarModal();
        window.abrirModal("Éxito", "Oferta enviada. Esperando respuesta del jugador...");
    })
    .catch((error) => {
        window.abrirModal("Error", "Error de red: " + error.message);
    });
};

// --- 2. ESCUCHA DE OFERTAS (CON BOTONES MODIFICADOS) ---
window.ofertasProcesadas = new Set();

window.escucharOfertas = function() {
    // 1. Limpiar listener anterior de forma segura
    const ofertasRef = ref(window.db, 'salas/' + window.sala + '/ofertas');
    
    // Si ya tienes un listener activo, Firebase maneja el reemplazo, 
    // pero es buena práctica no acumular.
    onValue(ofertasRef, (snapshot) => {
        const ofertas = snapshot.val();
        if (!ofertas) {
            window.ofertasProcesadas.clear(); // Si no hay ofertas, reseteamos el control
            return;
        }

        // Convertimos a array para procesar
        Object.keys(ofertas).forEach((key) => {
            const o = ofertas[key];
            
            // Filtros de seguridad
            const esParaMi = String(o.comprador).trim() === String(window.miIdx).trim();
            const estaPendiente = o.estado === 'pendiente';
            const yaProcesada = window.ofertasProcesadas.has(key);

            if (esParaMi && estaPendiente && !yaProcesada) {
                // Marcamos como procesada para que no vuelva a saltar el modal
                window.ofertasProcesadas.add(key);

                const nombreVendedor = (window.nombres && window.nombres[o.vendedor]) ? window.nombres[o.vendedor] : "Jugador " + o.vendedor;
                const nombreProp = (window.mapa && window.mapa[o.propiedad]) ? window.mapa[o.propiedad].n : "Propiedad #" + o.propiedad;
                
                window.abrirModal("🤝 Nueva Oferta", `
                    <div style="text-align: center; padding: 10px;">
                        <p style="margin-bottom: 20px;"><b>${nombreVendedor}</b> te ofrece <b>${nombreProp}</b> por <b>$${o.precio}</b></p>
                        
                        <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
                            <button style="background:#ff80bf; color:white; padding:10px; border:none; border-radius:5px; cursor:pointer; width: 100%; font-weight:bold;" 
                                    onclick="window.confirmarCompra('${key}', '${o.vendedor}', ${o.propiedad}, ${o.precio}); window.cerrarModal();">ACEPTAR OFERTA</button>
                            
                            <button style="background:#e74c3c; color:white; padding:10px; border:none; border-radius:5px; cursor:pointer; width: 100%;" 
                                    onclick="window.rechazarOferta('${key}'); window.cerrarModal();">RECHAZAR</button>
                        </div>
                    </div>
                `);
            }
        });
    });
};

// --- 3. TRANSACCIÓN ATÓMICA DE COMPRA ---
window.confirmarCompra = async function(key, vendedorIdx, pos, precio) {
    window.abrirModal("Procesando...", "Verificando fondos e intercambio...");
    
    // 1. Verificación de seguridad: ¿Aún tiene el comprador el dinero?
    const compradorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snapComprador = await get(compradorRef);
    const dineroComprador = snapComprador.val()?.dinero || 0;

    if (dineroComprador < precio) {
        window.abrirModal("Error", "No tienes saldo suficiente para completar esta compra.");
        return;
    }

    // 2. Preparar el objeto de cambios (Atomicidad)
    const updates = {};
    
    // Sumar dinero al vendedor
    updates['salas/' + window.sala + '/jugadores/' + vendedorIdx + '/dinero'] = increment(Number(precio));
    
    // Restar dinero al comprador
    updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-Number(precio));
    
    // Cambiar dueño de la propiedad (resetear nivel y quitar hipoteca por seguridad)
    updates['salas/' + window.sala + '/propiedades/' + pos] = { 
        owner: window.miIdx, 
        nivel: 0, 
        hipotecada: false 
    };
    
    // Marcar oferta como completada
    updates['salas/' + window.sala + '/ofertas/' + key + '/estado'] = 'completada';

    // 3. Ejecutar actualización atómica
    update(ref(window.db), updates)
    .then(() => {
        // Limpiar control de caché para que no vuelva a saltar el modal
        if (window.ofertasProcesadas) window.ofertasProcesadas.delete(key);
        
        window.cerrarModal();
        window.abrirModal("Éxito", "¡Intercambio realizado con éxito!");
        
        // Opcional: Refrescar UI (si tienes una función para ello)
        if (typeof window.renderTablero === 'function') window.renderTablero();
    })
    .catch(e => {
        console.error("Error en transacción:", e);
        window.abrirModal("Error", "Ocurrió un error al procesar el intercambio: " + e.message);
    });
};

// --- 4. RECHAZAR OFERTA ---
window.rechazarOferta = function(key) {
    // Marcamos como rechazada en la base de datos
    update(ref(window.db, 'salas/' + window.sala + '/ofertas/' + key), { 
        estado: 'rechazada' 
    })
    .then(() => {
        // Limpiar control de caché
        if (window.ofertasProcesadas) window.ofertasProcesadas.delete(key);
        window.cerrarModal();
    })
    .catch(e => {
        window.abrirModal("Error", "No se pudo rechazar la oferta.");
    });
};

// --- 1. INTERACCIÓN (Entrada del usuario) ---
window.interaccionAlquiler = function(ownerIdx, monto) {
    window.decisionTomada = false; 
    const montoLimpio = parseFloat(monto) || 0;

    const contenido = `
        <div style="text-align:center;">
            <h3>Alquiler de $${montoLimpio}</h3>
            <p>El dueño espera su pago.</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="btn-accion" style="background:#e74c3c;" onclick="window.procesarEvasion('${ownerIdx}', ${montoLimpio})">Intentar Evadir (Riesgo)</button>
                <button class="btn-accion" style="background:#2ecc71;" onclick="window.pagarAlquiler('${ownerIdx}', ${montoLimpio})">Pagar Alquiler</button>
            </div>
        </div>
    `;
    
    window.abrirModal("Gestión de Alquiler", contenido);
};

// --- FUNCIÓN CENTRALIZADA DE PAGO (ÚNICA Y DEFINITIVA) ---
window.pagarAlquiler = async function(ownerIdx, monto) {
    const montoLimpio = parseFloat(monto) || 0;
    
    // Validación de seguridad básica
    if (montoLimpio <= 0) {
        window.log("Error de sistema: Monto inválido.");
        return;
    }

    const esImpuesto = (String(ownerIdx) === 'IMPUESTO');
    
    // 1. Obtener nombre del pagador
    const nombrePagador = window.nombres[window.miIdx] || "Jugador";
    
    // 2. Obtener nombre del receptor de forma robusta (buscando directo en DB si falla la caché)
    let nombreReceptor = "Dueño";
    if (esImpuesto) {
        nombreReceptor = "el Pozo de Impuestos";
    } else {
        try {
            const snapReceptor = await get(ref(window.db, `salas/${window.sala}/jugadores/${ownerIdx}/nombre`));
            nombreReceptor = snapReceptor.val() || window.nombres[ownerIdx] || "Dueño";
        } catch (e) {
            nombreReceptor = window.nombres[ownerIdx] || "Dueño";
        }
    }
    
    const textoLog = `${nombrePagador} ha pagado $${montoLimpio} a ${nombreReceptor}.`;

    const updates = {};
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // 1. Descontar dinero al jugador actual
    updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-montoLimpio);

    // 2. Sumar dinero al destino
    if (esImpuesto) {
        updates['salas/' + window.sala + '/pozoImpuestos'] = increment(montoLimpio);
    } else {
        updates['salas/' + window.sala + '/jugadores/' + ownerIdx + '/dinero'] = increment(montoLimpio);
    }

    // 3. Registrar el evento en el chat
    const msgId = push(ref(window.db, 'salas/' + window.sala + '/chat')).key;
    updates['salas/' + window.sala + '/chat/' + msgId] = {
        n: "Sistema",
        m: textoLog,
        t: timestamp
    };

    // 4. Ejecución atómica y notificación
    try {
        await update(ref(window.db), updates);
        
        window.cerrarModal(); 
        window.log(textoLog);
        
    } catch (e) {
        console.error("Error crítico en pago:", e);
        window.abrirModal("Error", "No se pudo procesar el pago: " + e.message);
    }
};

// --- 1. CONFIRMAR PAGO ---
window.confirmarPago = async function(ownerIdx, monto) {
    if (window.decisionTomada) return; // Evitar doble clic
    window.decisionTomada = true;
    
    const montoNumerico = parseFloat(monto) || 0;
    const esImpuesto = (ownerIdx === 'IMPUESTO');
    
    // Si es impuesto, ejecutamos la transacción personalizada, si es alquiler, usamos la centralizada
    if (esImpuesto) {
        const updates = {};
        updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-montoNumerico);
        updates['salas/' + window.sala + '/pozoImpuestos'] = increment(montoNumerico);
        
        // Log al chat
        const msgId = push(ref(db, 'salas/' + window.sala + '/chat')).key;
        updates['salas/' + window.sala + '/chat/' + msgId] = {
            n: "Sistema",
            m: `Impuestos pagados: $${montoNumerico}.`,
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        await update(ref(db), updates);
        window.cerrarModal();
    } else {
        // Esta función ya incluye el log y la actualización atómica
        await window.pagarAlquiler(ownerIdx, montoNumerico);
    }
};

// --- 2. PROCESAR EVASIÓN ---
window.procesarEvasion = async function(ownerIdx, monto) {

    if (window.decisionTomada) return;

    window.decisionTomada = true;

    // Desactivar botones para evitar clics múltiples
    const botones = document.querySelectorAll('.btn-accion');
    botones.forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });

    try {
        const montoLimpio = parseFloat(monto) || 0;
        const esImpuesto = (ownerIdx === 'IMPUESTO');

        const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
        const snap = await get(jugadorRef);
        let j = snap.val() || {};
        const rnd = Math.random();
        const nombre = window.nombres ? window.nombres[window.miIdx] : "Jugador";

        // --- LÓGICA DE AZAR ---
        if (rnd > 0.6) {
            // ÉXITO
            window.logGlobal(nombre + " evadió los impuestos y se ahorró " + montoLimpio);
            window.cerrarModal();
        } 
        else if (rnd > 0.3) {
            // EVASIÓN PARCIAL
            const montoParcial = Math.max(1, Math.floor(montoLimpio / 2));
            const ahorro = montoLimpio - montoParcial;
            window.logGlobal(nombre + " evadió los impuestos y se ahorró " + ahorro + " (pagó " + montoParcial + ")");
            
            if (esImpuesto) {
                // Pago parcial de impuestos (manual)
                const updates = {};
                updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-montoParcial);
                updates['salas/' + window.sala + '/pozoImpuestos'] = increment(montoParcial);
                await update(ref(window.db), updates);
                window.cerrarModal();
            } else {
                // Pago parcial de alquiler (usando la centralizada)
                await window.pagarAlquiler(ownerIdx, montoParcial);
            }
        } 
        else {
            // FALLO: MULTA
            const multa = montoLimpio + 100;
            let intentos = (j.intentosFallidos || 0) + 1;
            let updates = { intentosFallidos: intentos };
            
            // Penalización por reincidencia
            if (intentos >= 5) { 
                updates.intentosFallidos = 0; 
                updates.estrellas = Math.max(0, (j.estrellas || 0) - 1); 
                window.logGlobal("¡" + nombre + " ha perdido 1 estrella por reincidencia!");
            }
            await update(jugadorRef, updates);
            
            window.logGlobal(nombre + " evadió los impuestos y tiene que pagar " + montoLimpio + " más 100 por multa");
            
            if (esImpuesto) {
                // Pago de multa de impuestos (manual)
                const taxUpdates = {};
                taxUpdates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-multa);
                taxUpdates['salas/' + window.sala + '/pozoImpuestos'] = increment(multa);
                await update(ref(window.db), taxUpdates);
                window.cerrarModal();
            } else {
                // Pago de multa alquiler
                await window.pagarAlquiler(ownerIdx, multa);
            }
        }
    } catch (e) {
        console.error("Error en proceso de evasión:", e);
    } finally {
        // Aseguramos que siempre se reactiven los botones y se libere la decisión
        window.decisionTomada = false;
        botones.forEach(b => { b.disabled = false; b.style.opacity = "1"; });
    }
};

// --- HELPER ---
window.logGlobal = function(mensaje) {
    push(ref(window.db, 'salas/' + window.sala + '/chat'), {
        n: "Sistema",
        m: mensaje,
        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
};

// --- 1. PAGO DE IMPUESTOS (ATÓMICO Y REGISTRADO) ---
window.pagarImpuesto = async function(monto) {
    const montoLimpio = parseFloat(monto) || 0;
    if (montoLimpio <= 0) return;

    if (!window.db) {
        console.error("Error: La base de datos no está inicializada.");
        return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updates = {};

    // 1. Descontar dinero y sumar al pozo (Operación atómica)
    updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-montoLimpio);
    updates['salas/' + window.sala + '/pozoImpuestos'] = increment(montoLimpio);

    // 2. Registro en Chat (Visible para todos)
    const chatRef = ref(window.db, 'salas/' + window.sala + '/chat');
    const msgId = push(chatRef).key;
    updates['salas/' + window.sala + '/chat/' + msgId] = {
        n: "Sistema",
        m: (window.nombres[window.miIdx] || "Jugador") + " ha pagado $" + montoLimpio + " en impuestos.",
        t: timestamp
    };

    try {
        // Ejecutar todas las actualizaciones de una vez
        await update(ref(window.db), updates);
        
        // 3. Confirmación inmediata para el jugador (Gamelog)
        window.cerrarModal();
        window.log("¡Impuestos pagados! Se han descontado $" + montoLimpio + " de tu cuenta.");
        
        // Opcional: Si quieres que el turno pase automáticamente tras pagar, descomenta la siguiente línea:
        // window.pasarTurno();
        
    } catch (e) {
        console.error("Error al pagar impuestos:", e);
        window.abrirModal("Error", "No se pudo procesar el pago: " + e.message);
    }
};

// --- 2. MEJORAR PROPIEDAD (ATÓMICO Y VALIDADO) ---
window.mejorar = function(pos) {
    const pRef = ref(window.db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const tRef = ref(window.db, 'salas/' + window.sala + '/propiedades');

    Promise.all([get(tRef), get(jRef)]).then(async ([snapT, snapJ]) => {
        const todas = snapT.val() || {};
        const j = snapJ.val() || {};
        const costo = 50;
        const prop = todas[pos];

        // Validaciones
        if (!prop || !window.verificarMonopolio(pos, todas)) {
            window.abrirModal("Acción no permitida", "<p>Necesitas poseer todas las propiedades del mismo color para mejorar.</p>");
            return;
        }

        if (j.dinero < costo) {
            window.abrirModal("Sin fondos", "<p>No tienes suficiente dinero ($50).</p>");
            return;
        }

        const nivelActual = prop.nivel || 0;
        if (nivelActual >= 5) {
            window.abrirModal("Límite alcanzado", "<p>¡Ya tienes un hotel (nivel máximo)!</p>");
            return;
        }

        // Cálculo de incremento: 5% por mejora (niveles 1-4), 15% al llegar a Hotel (nivel 5)
        const nuevoNivel = nivelActual + 1;
        const factorIncremento = (nuevoNivel === 5) ? 0.15 : 0.05;
        // CORRECCIÓN: Forzamos a número para evitar NaN
        const precioActual = parseFloat(prop.p) || 0;
        const nuevoPrecio = Math.floor(precioActual * (1 + factorIncremento));

        // --- TRANSACCIÓN ATÓMICA ---
        const updates = {};
        updates['salas/' + window.sala + '/propiedades/' + pos + '/nivel'] = nuevoNivel;
        updates['salas/' + window.sala + '/propiedades/' + pos + '/p'] = nuevoPrecio; // Incremento de valor y alquiler
        updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-costo);
        
        // Log al chat
        const msgId = push(ref(window.db, 'salas/' + window.sala + '/chat')).key;
        updates['salas/' + window.sala + '/chat/' + msgId] = {
            n: "Sistema",
            m: `${window.nombres[window.miIdx]} mejoró ${prop.n || 'propiedad'} a nivel ${nuevoNivel}.`,
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        try {
            await update(ref(window.db), updates);
            window.cerrarModal();
            window.log("Propiedad mejorada al nivel " + nuevoNivel);
        } catch (e) {
            window.abrirModal("Error", "Error al mejorar la propiedad: " + e.message);
        }
    });
};

// --- 1. HIPOTECAR / LIBERAR (ATÓMICO Y REALISTA) ---
window.hipotecar = async function(pos) {
    const pRef = ref(window.db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);

    // 1. Obtener datos actuales
    const [snapP, snapJ] = await Promise.all([get(pRef), get(jRef)]);
    const p = snapP.val();
    const j = snapJ.val();
    
    if (!p) return;

    // Cálculo realista: Valor base + Valor mejoras
    const nivel = p.nivel || 0;
    const precioBase = window.mapa[pos].p;
    const costoMejora = 50; // Ajusta esto si tu costo es distinto
    const valorTotal = precioBase + (nivel * costoMejora);
    
    // Valor de hipoteca (50% del total)
    const valorHipoteca = Math.floor(valorTotal * 0.5);
    const costoLiberar = Math.floor(valorHipoteca * 1.1); // 10% de interés al recuperar

    const updates = {};
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = push(ref(window.db, 'salas/' + window.sala + '/chat')).key;

    if (!p.hipotecada) {
        // --- ACCIÓN: HIPOTECAR ---
        updates['salas/' + window.sala + '/propiedades/' + pos + '/hipotecada'] = true;
        updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(valorHipoteca);
        
        updates['salas/' + window.sala + '/chat/' + msgId] = {
            n: "Sistema",
            m: `${window.nombres[window.miIdx]} ha hipotecado ${window.mapa[pos].n} por $${valorHipoteca}.`,
            t: timestamp
        };

        await update(ref(window.db), updates);
        window.abrirModal("Banco Hipotecario", `<div style="text-align:center;">
            <p>Propiedad hipotecada con éxito.</p>
            <p style="font-size:1.5em; color:#e74c3c;">Has recibido: <b>$${valorHipoteca}</b></p>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" onclick="window.cerrarModal()">Aceptar</button>
        </div>`);

    } else {
        // --- ACCIÓN: LIBERAR ---
        if (j.dinero < costoLiberar) {
            window.abrirModal("Error", "No tienes suficiente dinero para pagar la deuda ($" + costoLiberar + ").");
            return;
        }

        updates['salas/' + window.sala + '/propiedades/' + pos + '/hipotecada'] = false;
        updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(-costoLiberar);

        updates['salas/' + window.sala + '/chat/' + msgId] = {
            n: "Sistema",
            m: `${window.nombres[window.miIdx]} ha liberado ${window.mapa[pos].n}.`,
            t: timestamp
        };

        await update(ref(window.db), updates);
        window.abrirModal("Banco Hipotecario", `<div style="text-align:center;">
            <p>Has pagado la deuda y liberado tu propiedad.</p>
            <p style="font-size:1.5em; color:#2ecc71;">Costo: <b>$${costoLiberar}</b></p>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" onclick="window.cerrarModal()">Aceptar</button>
        </div>`);
    }
};

// --- 1. CARTAS CORREGIDAS (Valores alineados con el texto) ---
window.cartasEvento = [
    { txt: "¡Inversión exitosa! Tus acciones subieron, cobras $450.", v: 450 },
    { txt: "¡Multa por estacionamiento prohibido! Pagas $100.", v: -100 },
    { txt: "¡Bono de productividad! La empresa te premia con $200.", v: 200 },
    { txt: "¡Gastos médicos inesperados! Pagas $400 por la consulta.", v: -400 },
    { txt: "¡Encontraste dinero en tu abrigo viejo! Recibes $50.", v: 50 },
    { txt: "¡Reparación de alcantarillado! Debes pagar $350 al municipio.", v: -350 },
    { txt: "¡Te sacaste la lotería! Has ganado $300.", v: 300 },
    { txt: "¡Donación benéfica a los niños de la iglesia! Pagas $400 por el bien común.", v: -400 }
];

window.obtenerCarta = function() {
    return window.cartasEvento[Math.floor(Math.random() * window.cartasEvento.length)];
};

// --- 2. EJECUTOR DE EVENTOS (ATÓMICO Y PÚBLICO) ---
window.ejecutarEvento = async function() {
    const carta = window.obtenerCarta();
    const nombre = window.nombres[window.miIdx] || "Jugador";
    const valor = carta.v;

    // Mostrar el modal antes de procesar
    window.abrirModal("¡Carta de Evento!", `
        <div style="text-align:center; padding:20px;">
            <p style="font-size:1.2em; font-weight:bold; margin-bottom:20px;">${carta.txt}</p>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" onclick="window.procesarTransaccionCarta(${valor}, '${carta.txt}')">Aceptar</button>
        </div>
    `);
};

// --- 3. TRANSACCIÓN SEGURA ---
window.procesarTransaccionCarta = async function(valor, texto) {
    window.cerrarModal();
    
    const updates = {};
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = push(ref(window.db, 'salas/' + window.sala + '/chat')).key;

    // Actualizar dinero del jugador
    updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(valor);
    
    // Log en el chat para todos
    updates['salas/' + window.sala + '/chat/' + msgId] = {
        n: "Sistema",
        m: `${window.nombres[window.miIdx]} sacó una carta: "${texto}" (${valor > 0 ? '+' : ''}${valor})`,
        t: timestamp
    };

    try {
        await update(ref(window.db), updates);
        console.log("Evento procesado correctamente.");
    } catch (e) {
        console.error("Error al procesar evento:", e);
        window.abrirModal("Error", "No se pudo procesar la carta. Intenta de nuevo.");
    }
};

// --- 1. MANEJAR CASILLA (CORREGIDO CONTRA BUCLES) ---
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

    let g = (typeof window.obtenerGrupo === 'function') ? window.obtenerGrupo(posInt) : null;
    if (g && g.color === "#d24285") {
        if (!prop) {
            window.verPropiedad(posInt, puedeComprar, data); // Pasamos data
        } else if (prop.owner !== window.miIdx) {
            const trans = [8, 24, 26, 27];
            const count = trans.filter(i => data.propiedades && data.propiedades[i] && data.propiedades[i].owner === prop.owner).length;
            const alquiler = { 1: 100, 2: 150, 3: 250, 4: 300 }[count] || 100;
            window.interaccionAlquiler(prop.owner, alquiler);
        } else {
            window.verPropiedad(posInt, false, data); // Pasamos data
        }
        return;
    }

    if (p && p.p > 0) {
        if (prop && prop.owner && prop.owner !== window.miIdx) {
            const alquilerReal = (p.a && p.a > 0) ? p.a : Math.floor(p.p * 0.1);
            window.interaccionAlquiler(prop.owner, alquilerReal);
        } else {
            window.verPropiedad(posInt, puedeComprar, data); // Pasamos data
        }
        return;
    }

    if (p.n === "ARCA COMUNAL" || p.n === "?") {
        const carta = window.obtenerCarta();
        const titulo = (p.n === "ARCA COMUNAL") ? "Arca Comunal" : "Suerte (?)";
        await update(jugadorRef, { dinero: increment(carta.v) });
        window.abrirModal(titulo, `<p>${carta.txt}</p>`);
    } 
    else if (posInt === 9 && esLlegadaPorMovimiento) {
        await update(jugadorRef, { enCarcel: 1, pos: 9 });
        window.mostrarOpcionesCarcel();
        window.pasarTurno(); 
        return; 
    }
    else if (p.n === "IMPUESTOS") {
        const monto = 200;
        const contenido = `
            <h2>Impuestos</h2>
            <p>Debes pagar: <b>$${monto}</b></p>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer; margin:5px;" onclick="window.pagarImpuesto(${monto}); window.cerrarModal();">Pagar</button>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer; margin:5px;" onclick="window.procesarEvasion('IMPUESTO', ${monto}); window.cerrarModal();">Evadir (40% éxito)</button>
        `;
        window.abrirModal("Impuestos", contenido);
    }
    else if (p.n === "PARADA") {
        const pozo = data.pozoImpuestos || 0;
        await update(jugadorRef, { dinero: increment(pozo) });
        await update(salaRef, { pozoImpuestos: 0 });
        window.abrirModal("Parada Gratuita", `<p>Recolectaste $${pozo}.</p>`);
    }
};

// --- 2. MOSTRAR OPCIONES (SIN BUCLES) ---
window.mostrarOpcionesCarcel = function() {
    const contenido = `
        <div class="contenedor-carcel">
            <p style="text-align: center; color: #333; margin-top: 0;">Estás en la cárcel. ¿Qué deseas hacer?</p>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer; display:block; width:100%; margin-bottom:5px;" onclick="window.pagarFianza()">Pagar Fianza ($200)</button>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer; display:block; width:100%; margin-bottom:5px;" onclick="window.quedarseEnCarcel()">Cumplir condena (1 turno sin jugar)</button>
            <button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer; display:block; width:100%; margin-bottom:5px;" onclick="window.intentarHackeo()">Intentar Hackear el sistema de escape (50% éxito)</button>
        </div>
    `;
    window.abrirModal("¡Alto ahí! Estás bajo arresto y tienes derecho a un abogado.", contenido);
};

// --- 3. PAGAR FIANZA (Libre inmediatamente) ---
window.pagarFianza = async function() {
    const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    const j = snap.val();
    
    if ((j.dinero || 0) < 200) {
        window.abrirModal("Error", "No tienes suficiente dinero ($200).");
        return;
    }

    // Al pagar, liberamos totalmente (enCarcel: null)
    await update(jugadorRef, { 
        enCarcel: null, 
        dinero: increment(-200) 
    });
    window.cerrarModal();
    window.log("Has pagado la fianza y estás libre.");
    // Como pagó, el jugador no pierde el turno, puede seguir jugando
};

window.quedarseEnCarcel = async function() {
    if (!window.miIdx || !window.sala) return;
    
    const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const chatRef = ref(window.db, 'salas/' + window.sala + '/chat');
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Actualizamos el estado del jugador en la base de datos
    // enCarcel: 1 indica que está castigado.
    await update(jugadorRef, { enCarcel: 1 });

    // 2. Registro público en el chat para que todos sepan que está en la cárcel
    const msgId = push(chatRef).key;
    await update(ref(window.db), {
        ['salas/' + window.sala + '/chat/' + msgId]: {
            n: "Sistema",
            m: `${window.nombres[window.miIdx] || "El jugador"} ha decidido cumplir condena y perderá este turno.`,
            t: timestamp
        }
    });
    
    // 3. Confirmación visual local
    window.log("Has decidido cumplir condena de 1 turno.");
    window.cerrarModal();

    // 4. Forzamos el paso de turno
    // IMPORTANTE: Asegúrate de que tu lógica de "pasarTurno" también verifique
    // el campo "enCarcel" en los datos de la sala.
    if (typeof window.pasarTurno === 'function') {
        window.pasarTurno();
    }
};

// --- 5. INTENTAR HACKEO ---
window.intentarHackeo = async function() {
    const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    const j = snap.val();

    // 1. Lógica de Éxito
    if (Math.random() < 0.5) {
        window.log("¡HACKEO EXITOSO!");
        await update(jugadorRef, { enCarcel: null });
        
        window.abrirModal("¡Éxito!", `
            <div style="text-align: center; padding: 15px;">
                <h2 style="color: #ff80bf;">Sistema Hackeado</h2>
                <p>Has burlado la seguridad y quedado en libertad.</p>
                <button onclick="window.cerrarModal()" style="width:100%; padding:10px; background:#ff80bf; color:white; border:none; cursor:pointer;">Continuar</button>
            </div>
        `);
    } 
    // 2. Lógica de Fallo (Castigo de 2 turnos sin jugar)
    else {
        window.log("¡FALLASTE!");
        
        // Penalización: Se queda 2 turnos bloqueado
        await update(jugadorRef, { enCarcel: 2 });

        if (typeof window.actualizarReputacionConContador === 'function') {
            await window.actualizarReputacionConContador('hackeo', false);
        }

        const html = `
            <div style="text-align: center; padding: 15px;">
                <h2 style="color: #ff80bf;">¡Hackeo Fallido!</h2>
                <p>El sistema te ha bloqueado por 2 turnos.</p>
                <div style="background: #fff0f0; padding: 10px; margin: 10px 0; border: 1px solid #ff80bf;">
                    <b>CASTIGO: 2 TURNOS SIN JUGAR</b>
                </div>
                <button onclick="window.cerrarModal(); window.pasarTurno();" 
                        style="width:100%; padding:10px; background:#ff80bf; color:white; border:none; cursor:pointer;">
                    Aceptar consecuencias
                </button>
            </div>
        `;
        window.abrirModal("¡ALERTA!", html);
    }
};

// --- 1. MODAL DE MISIONES Y OBJETIVOS ---
window.abrirModalMisiones = function() {
    const esVisitante = window.esVisitante;
    const nombre = window.nombres[window.miIdx] || "Jugador";
    let html = `<div class="abrirModal">`;
    html += `<span class="btn-cerrar-x" onclick="window.cerrarModal()">&times;</span>`;
    
    if (esVisitante) {
        html += `<h2 style="color: #ff59aa; margin-top: 0;">Misiones de Citizen</h2>`;
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
                <button style="width:100%; background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" onclick="window.completarMisionVisitante('${m.id}')">Completar</button>
            </div>`;
        });
    } else {
        html += `<h2 style="color: #ff59aa; margin-top: 0;">🏆 Objetivos de ${nombre}</h2>`;
        const misiones = [
            { id: 'inversor', titulo: 'Inversor', desc: 'Poseer 3 propiedades.', rec: 200 },
            { id: 'coleccionista', titulo: 'Coleccionista', desc: 'Completar un set.', rec: 300 },
            { id: 'caja_fuerte', titulo: 'Caja Fuerte', desc: 'Acumular $2,000.', rec: 650 }
        ];

        misiones.forEach(m => {
            html += `
            <div style="background: #fff; padding: 10px; margin: 10px 0; border-radius: 10px; border: 1px solid #ff80bf; text-align: left;">
                <div style="font-weight: bold; color: #ff59aa;">${m.titulo}</div>
                <div style="font-size: 0.9em; margin: 5px 0;">${m.desc}</div>
                <div style="font-size: 0.85em; font-weight: bold; color: #ff59aa;">Premio: $${m.rec}</div>
                <button style="width:100%; background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" onclick="window.otorgarRecompensaMision({id: '${m.id}', titulo: '${m.titulo}', rec: ${m.rec}})">Reclamar</button>
            </div>`;
        });
    }
    
    html += `</div>`;
    window.abrirModal(esVisitante ? "Misiones" : "Logros", html);
};

// --- 2. RECOMPENSA ATÓMICA Y LOG GLOBAL ---
window.otorgarRecompensaMision = async function(mision) {
    const jugadorRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const snap = await get(jugadorRef);
    const j = snap.val() || {};
    
    // 1. Verificación de seguridad básica (evitar spam si ya se completó)
    // Asumimos que j.misionesCompletadas es un objeto o array
    const completadas = j.misionesCompletadas || {};
    if (completadas[mision.id]) {
        window.abrirModal("Aviso", "Ya has reclamado esta misión.");
        return;
    }

    // 2. Preparar actualizaciones
    const updates = {};
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = push(ref(window.db, 'salas/' + window.sala + '/chat')).key;

    // Aumentar dinero
    updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'] = increment(mision.rec);
    // Marcar misión como completada
    updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/misionesCompletadas/' + mision.id] = true;

    // Lógica de estrella
    let ganoEstrella = false;
    const estrellasActuales = j.estrellas || 0;
    if (estrellasActuales < 5) {
        updates['salas/' + window.sala + '/jugadores/' + window.miIdx + '/estrellas'] = estrellasActuales + 1;
        ganoEstrella = true;
    }

    // Log Global (Visible para todos)
    updates['salas/' + window.sala + '/chat/' + msgId] = {
        n: "Sistema",
        m: `¡${window.nombres[window.miIdx]} completó la misión "${mision.titulo}" y ganó $${mision.rec}!`,
        t: timestamp
    };

    // 3. Ejecutar todo de una vez
    try {
        await update(ref(window.db), updates);
        window.cerrarModal();
        
        // 4. Feedback visual
        if (typeof window.renderEstrellas === 'function') {
            window.renderEstrellas(ganoEstrella ? estrellasActuales + 1 : estrellasActuales);
        }
        
        if (ganoEstrella) {
            window.mostrarAvisoReputacion(estrellasActuales + 1);
        } else {
            window.abrirModal("Misión Completada", `
                <div style="text-align: center;">
                    <h2>${mision.titulo}</h2>
                    <p>¡Has recibido <b>$${mision.rec}</b>!</p>
                </div>
            `);
        }
    } catch (e) {
        console.error("Error al procesar misión:", e);
    }
};

// --- 1. MODAL DE ALINEAMIENTO (Con seguridad de rol) ---
window.preguntarAlineamiento = function() {
    // Seguridad: Solo mostrar si es visitante y no tiene alineamiento ya definido
    if (!window.esVisitante) return; 

    const html = `
        <div class="modal-content" style="text-align: center; padding: 20px;">
            <h2 style="color: #ff59aa;">¿Cuál es tu naturaleza?</h2>
            <p>Al realizar acciones, tu reputación definirá tu camino:</p>
            <button class="btn-sidebar" style="background: #ff59aa; color: white; width:100%; margin:10px 0; padding:10px;" 
                    onclick="window.guardarAlineamiento('angel')">👼 Ángel</button>
            <button class="btn-sidebar" style="background: #333; color: white; width:100%; margin:10px 0; padding:10px;" 
                    onclick="window.guardarAlineamiento('gargola')">👺 Gárgola</button>
        </div>`;
    window.abrirModal("Elección de Destino", html);
};

// --- 2. GUARDAR ALINEAMIENTO (Atómico y seguro) ---
window.guardarAlineamiento = async function(tipo) {
    if (!window.esVisitante) {
        console.error("Acceso denegado: No eres visitante.");
        return;
    }

    const vRef = ref(db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
    
    // Verificamos antes de escribir para no sobrescribir reputación existente
    const snap = await get(vRef);
    if (snap.exists() && snap.val().alineamiento) {
        window.abrirModal("Aviso", "Ya has elegido tu destino.");
        return;
    }

    await update(vRef, { 
        alineamiento: tipo, 
        reputacion: 0,
        nombre: window.nombres[window.miIdx] || "Visitante" // Registro de identidad
    });

    window.cerrarModal();
    if (typeof window.renderEstrellas === 'function') window.renderEstrellas(0);
    window.log(`Has elegido tu destino: ${tipo === 'angel' ? 'Ángel' : 'Gárgola'}`);
};

// --- 3. INYECTOR SEGURO (Sin fugas de memoria) ---
window.iniciarInyectorPoderes = function() {
    const check = setInterval(() => {
        const btn = document.getElementById("btn-iniciar-partida");
        const container = document.getElementById("container-poderes");
        
        if (btn) {
            if (!container) {
                window.actualizarBotonesPoderes();
            }
            // Una vez que encontramos el botón, detenemos el intervalo para no consumir recursos
            clearInterval(check);
        }
    }, 1000);
};

window.aplicarConsecuenciaReputacion = async function(esMalaAccion) {
    // Seguridad: verificar conexión
    if (!window.db || !window.sala) {
        console.error("Error: Sistema no inicializado.");
        return;
    }

    const vRef = ref(window.db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
    
    try {
        // 1. Obtenemos el estado más reciente
        const snap = await get(vRef);
        const v = snap.val();

        if (!v) {
            console.warn("Visitante no encontrado en la base de datos.");
            return;
        }

        // 2. VERIFICACIÓN CRÍTICA: Si no existe el alineamiento, forzamos elección
        if (!v.alineamiento) {
            console.log("Visitante sin alineamiento detectado. Abriendo selector...");
            window.preguntarAlineamiento();
            return;
        }

        // 3. Procesamos la reputación
        const alineamiento = v.alineamiento;
        let rep = parseInt(v.reputacion) || 0;

        // Lógica de cálculo
        if (alineamiento === 'angel') {
            rep = esMalaAccion ? (rep - 1) : (rep + 1);
        } else if (alineamiento === 'gargola') {
            rep = esMalaAccion ? (rep + 1) : (rep - 1);
        }

        // Límites estrictos (0-5)
        const nuevaRep = Math.max(0, Math.min(5, rep));

        // 4. Actualizamos Firebase
        await update(vRef, { reputacion: nuevaRep });

        // 5. Refrescamos UI y Log
        window.renderEstrellas(nuevaRep);
        window.log(`Reputación ajustada: ${nuevaRep} ★ (${esMalaAccion ? 'Mala acción' : 'Buena acción'})`);
        
        console.log(`Reputación procesada: ${alineamiento} | Nueva Rep: ${nuevaRep}`);

    } catch (error) {
        console.error("Error al aplicar consecuencia de reputación:", error);
    }
};

// --- 1. INTENTO DE USO DE PODER (Protegido) ---
window.intentarUsarPoder = async function(esMalaAccion, callbackDelPoder) {
    // Seguridad: Verificar que tenemos la información necesaria antes de consultar la DB
    if (!window.sala || !window.miIdx) {
        console.error("No se puede usar el poder: ID de sala o usuario no definido.");
        return;
    }

    const vRef = ref(window.db, 'salas/' + window.sala + '/visitantes/' + window.miIdx);
    const snap = await get(vRef);
    const v = snap.val();

    // 1. Si no existe en la DB o no tiene alineamiento, forzamos elección
    if (!v || !v.alineamiento) {
        console.log("Visitante no registrado o sin alineamiento. Abriendo modal...");
        window.preguntarAlineamiento();
        return; // Interrumpimos el flujo: el poder NO se ejecuta esta vez
    }

    // 2. Si ya existe, primero aplicamos la consecuencia de reputación
    // Esto es un proceso asíncrono, por lo que debemos esperarlo (await)
    await window.aplicarConsecuenciaReputacion(esMalaAccion);
    
    // 3. Luego, ejecutamos el poder real
    if (typeof callbackDelPoder === 'function') {
        try {
            callbackDelPoder();
        } catch (e) {
            console.error("Error al ejecutar el callback del poder:", e);
        }
    }
};

// --- 2. BARRA DE PODERES (Optimizada) ---
window.actualizarBotonesPoderes = function() {
    // Evitar duplicados y verificar que somos visitante
    if (!window.esVisitante || document.getElementById('barra-tareas-poderes')) return;

    const barra = document.createElement('div');
    barra.id = 'barra-tareas-poderes';
    barra.style.cssText = `position: fixed; bottom: 5px; left: 50%; transform: translateX(-50%); width: auto; max-width: 90%; height: 50px; background: #fff0f3; border: 2px solid #ff80bf; border-radius: 25px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 15px; z-index: 999999; box-shadow: 0 4px 10px #ff80bf;`;
    
    const estiloBtn = `padding: 5px 12px; font-size: 11px; height: 30px; border-radius: 15px; background: #ffccd5; border: 1px solid #ff80bf; color: #c71585; cursor: pointer; transition: background 0.2s;`;

    barra.innerHTML = `
        <button id="poder-escudo" class="btn-sidebar" style="${estiloBtn}">Escudo</button>
        <button id="poder-sabotaje-5" class="btn-sidebar" style="${estiloBtn}">Sabotear 5% ($300)</button>
        <button id="poder-sabotaje-10" class="btn-sidebar" style="${estiloBtn}">Sabotear 10% ($500)</button>
        <button id="poder-clima" class="btn-sidebar" style="${estiloBtn}">Clima ($200)</button>
        <button id="poder-rescate" class="btn-sidebar" style="${estiloBtn} background: #ff59aa; color: white;">Rescatar ($300)</button>
    `;
    
    document.body.appendChild(barra);
    
    // Solo aplicamos el padding al body una vez
    if (!document.body.style.paddingBottom || document.body.style.paddingBottom === "0px") {
        document.body.style.paddingBottom = "70px";
    }

    // Asignación de eventos programática (más limpia que onclick en HTML)
    document.getElementById('poder-escudo').onclick = () => window.intentarUsarPoder(false, window.abrirMenuProteccion);
    document.getElementById('poder-sabotaje-5').onclick = () => window.intentarUsarPoder(true, () => window.seleccionarObjetivoSabotaje(0.05, 300));
    document.getElementById('poder-sabotaje-10').onclick = () => window.intentarUsarPoder(true, () => window.seleccionarObjetivoSabotaje(0.10, 500));
    document.getElementById('poder-clima').onclick = () => window.intentarUsarPoder(false, window.tomarControlClima);
    document.getElementById('poder-rescate').onclick = () => window.intentarUsarPoder(false, window.abrirMenuRescate);
};

// --- 1. LÓGICA DE PAGO (Blindada) ---
window.validarYDescontar = async function(costo) {
    try {
        const rama = window.esVisitante ? 'visitantes' : 'jugadores';
        const refPath = `salas/${window.sala}/${rama}/${window.miIdx}`;
        const userRef = ref(window.db, refPath);
        
        const snap = await get(userRef);
        const datos = snap.val();
        
        if (!datos || (datos.dinero || 0) < costo) {
            window.abrirModal("Error", `<p>Saldo insuficiente. Necesitas <b>$${costo}</b>.</p>`);
            return false;
        }
        
        await update(userRef, { dinero: increment(-costo) });
        window.log(`Has gastado $${costo}.`);
        return true;
    } catch (error) {
        console.error("Error al procesar el pago:", error);
        window.log("Error de conexión al procesar el pago.");
        return false; // Evita que se ejecute el poder si el pago falló
    }
};

// --- FUNCIÓN ÚNICA: Muestra el popup temporal (Renombrada a 'mostrarToast') ---
window.mostrarToast = function(mensaje) {
    const div = document.createElement('div');
    // Usamos la misma clase CSS que definimos antes
    div.className = 'dinero-toast';
    div.innerHTML = `💰 <span>${mensaje}</span>`;
    
    document.body.appendChild(div);
    
    // Elimina el elemento automáticamente
    setTimeout(() => {
        div.remove();
    }, 3000);
};

// --- SUMAR DINERO (Ahora llama a la nueva función sin conflictos) ---
window.sumarDineroVisitante = async function(cantidad) {
    if (!window.esVisitante) return;
    
    try {
        const vRef = ref(window.db, `salas/${window.sala}/visitantes/${window.miIdx}`);
        await update(vRef, { dinero: increment(cantidad) });
        
        // Llamada segura
        window.mostrarToast(`¡Has ganado $${cantidad}!`);
        
    } catch (error) {
        console.error("Error al sumar dinero:", error);
    }
};

// --- GENERAR SALARIO ---
window.generarSalarioVisitante = async function() {
    const bono = 50;
    await window.sumarDineroVisitante(bono);
};

// --- SELECCIÓN DE OBJETIVO ---
window.seleccionarObjetivoSabotaje = async function(porcentaje, costo) {
    const snap = await get(ref(window.db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Selecciona objetivo (Costo: $${costo}):</p>`;
    
    snap.forEach(c => {
        // Validación del jugador (asegúrate de que window.esJugadorValido esté definido)
        if (typeof window.esJugadorValido === 'function' && window.esJugadorValido(c.key, c.val())) {
            html += `<button style="width:100%; margin-bottom:5px; background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" 
                     onclick="window.ejecutarSabotaje('${c.key}', ${porcentaje}, ${costo}); window.cerrarModal()">
                     Sabotear ${c.key} (${(porcentaje * 100).toFixed(0)}%)</button>`;
        }
    });
    window.abrirModal("Sabotaje", html + `</div>`);
};

// --- EJECUCIÓN SABOTAJE ---
window.ejecutarSabotaje = async function(objetivoIdx, porcentaje, costo) {
    // 1. Validar pago
    if (await window.validarYDescontar(costo)) {
        const jRef = ref(window.db, 'salas/' + window.sala + '/jugadores/' + objetivoIdx);
        const snap = await get(jRef);
        const jugadorAfectado = snap.val();
        
        if (!jugadorAfectado) return;

        // 2. Comprobar escudo
        if (jugadorAfectado.tieneEscudo) {
            window.abrirModal("Bloqueado", "¡El jugador tiene un escudo activo!");
            return;
        }

        // 3. Aplicar efecto
        const montoPerdido = Math.round(jugadorAfectado.dinero * porcentaje);
        const nombreSaboteador = window.nombres[window.miIdx] || "Un visitante";
        const mensajeFinal = `¡${nombreSaboteador} saboteó a ${objetivoIdx} restándole $${montoPerdido}.`;

        await update(jRef, { 
            dinero: increment(-montoPerdido),
            notificacion: {
                titulo: "¡Sabotaje!",
                mensaje: `¡${nombreSaboteador} ha saboteado tus suministros! Has perdido $${montoPerdido}.`,
                timestamp: Date.now()
            }
        });

        // 4. Log
        await update(ref(window.db, 'salas/' + window.sala + '/logs'), {
            mensaje: mensajeFinal,
            timestamp: Date.now()
        });

        // 5. INTEGRACIÓN REPUTACIÓN (Acción Mala = true)
        if (window.esVisitante) {
            await window.aplicarConsecuenciaReputacion(true);
        }
    }
};

// --- ABRIR MENÚ RESCATE ---
window.abrirMenuRescate = async function() {
    const snap = await get(ref(window.db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Pagar fianza ($300):</p>`;
    let hayPresos = false;
    
    snap.forEach(c => {
        // Verificamos si está en cárcel
        if ((c.val().enCarcel ?? 0) > 0) {
            hayPresos = true;
            html += `<button style="width:100%; margin-bottom:5px; background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer;" 
                     onclick="window.ejecutarRescate('${c.key}', 300); window.cerrarModal()">
                     Liberar ${c.key}</button>`;
        }
    });
    
    if (!hayPresos) html += `<p>No hay nadie en la cárcel.</p>`;
    window.abrirModal("Rescate", html + `</div>`);
};

// --- EJECUCIÓN RESCATE ---
window.ejecutarRescate = async function(idPreso, costo) {
    // 1. Validar pago
    if (await window.validarYDescontar(costo)) {
        const nombreSalvador = window.nombres[window.miIdx] || "Un ciudadano";
        const mensajeLog = `¡${nombreSalvador} ha pagado la fianza para liberar a ${idPreso}!`;
        
        // 2. Liberar jugador
        await update(ref(window.db, 'salas/' + window.sala + '/jugadores/' + idPreso), { 
            enCarcel: 0,
            notificacion: {
                titulo: "¡Libertad!",
                mensaje: `¡Has sido rescatado! El visitante ${nombreSalvador} ha pagado tu fianza.`,
                timestamp: Date.now()
            }
        });

        // 3. Log
        await update(ref(window.db, 'salas/' + window.sala + '/logs'), {
            mensaje: mensajeLog,
            timestamp: Date.now()
        });

        // 4. INTEGRACIÓN REPUTACIÓN (Acción Buena = false)
        // Al rescatar, el visitante hace una buena acción, esto sube su reputación
        if (window.esVisitante) {
            await window.aplicarConsecuenciaReputacion(false);
        }
    }
};

// --- 1. CONTROL CLIMA (Vigilancia de Cooldown) ---
window.tomarControlClima = function() {
    if (!window.esVisitante) return;
    
    // Usamos window.db para mayor seguridad
    get(ref(window.db, 'salas/' + window.sala + '/controladorClima')).then(snap => {
        const data = snap.val();
        // Si no hay dato o pasaron más de 10 min (600,000ms)
        if (!data || (Date.now() - data.timestamp > 600000)) {
            window.abrirControlClima();
        } else {
            const minutos = Math.ceil((600000 - (Date.now() - data.timestamp)) / 60000);
            window.abrirModal("Cooldown", `El sistema climático está inestable. Intenta en ${minutos} min.`);
        }
    }).catch(e => console.error("Error al verificar clima:", e));
};

// --- 2. EJECUCIÓN CLIMA (CORREGIDO PARA NO BORRAR EL LOG) ---
window.cambiarClimaConCooldown = async function(idx) {
    // 1. Validar pago
    const costo = 200;
    if (!(await window.validarYDescontar(costo))) return;

    try {
        const nuevoClima = window.climas[idx];
        const nombreUsuario = (window.nombres && window.nombres[window.miIdx]) ? window.nombres[window.miIdx] : "Visitante #" + window.miIdx;
        
        // 2. Calcular impacto
        const porcentaje = Math.random() < 0.5 ? 0.05 : 0.10;
        let ajuste = 0;
        let efecto = "";
        let esMalaAccion = null;

        if (nuevoClima.tipo === "desastre") {
            ajuste = -porcentaje;
            efecto = `¡Desastre! Los alquileres bajan un ${(porcentaje * 100).toFixed(0)}%.`;
            esMalaAccion = true;
        } else if (nuevoClima.tipo === "bonanza") {
            ajuste = porcentaje;
            efecto = `¡Bonanza! Los alquileres suben un ${(porcentaje * 100).toFixed(0)}%.`;
            esMalaAccion = false;
        } else {
            ajuste = 0;
            efecto = "El mercado de alquileres se mantiene estable.";
        }

        // 3. Aplicar consecuencia de reputación
        if (esMalaAccion !== null) {
            await window.aplicarConsecuenciaReputacion(esMalaAccion);
        }

        // 4. Actualizar base de datos
        await update(ref(window.db, 'salas/' + window.sala + '/controladorClima'), { 
            timestamp: Date.now(), 
            ultimoUsuario: window.miIdx 
        });
        
        await update(ref(window.db, 'salas/' + window.sala), { 
            climaIdx: idx,
            modificadorAlquiler: ajuste 
        });
        
        // 5. Registrar en Log USANDO PUSH (Para no borrar historial)
        const mensajeLog = `☁️ ${nombreUsuario} cambió el clima a ${nuevoClima.n}. ${efecto}`;
        // IMPORTANTE: Se requiere importar 'push' de firebase/database
        await push(ref(window.db, 'salas/' + window.sala + '/logs'), {
            mensaje: mensajeLog,
            timestamp: Date.now()
        });
        
        window.cerrarModal();
        window.abrirModal("Éxito", "Clima cambiado correctamente. " + efecto);
        
    } catch (error) {
        console.error("Error al cambiar clima:", error);
        window.log("Error al cambiar el clima. Intenta de nuevo.");
    }
};

// --- 3. PANEL DE CONTROL (Interfaz) ---
window.abrirControlClima = function() {
    let html = `<div style="max-height: 300px; overflow-y: auto;">`;
    window.climas.forEach((c, idx) => {
        html += `<button style="width:100%; margin:5px 0; padding:10px; border-radius:10px; background:#ff80bf; color:white; border:none; cursor:pointer;" 
                     onclick="window.cambiarClimaConCooldown(${idx})">
                     <b>${c.n}</b><br><small>Tipo: ${c.tipo || 'Neutral'}</small>
                 </button>`;
    });
    window.abrirModal("☁️ Panel de control climático", html + `</div>`);
};

// --- 6. PROTECCIÓN (ESCUDO) ---
window.activarEscudo = async function(jugadorIdx) {
    const costo = 300; // Define aquí el costo del escudo
    
    // 1. Validar pago y saldo (Capa de seguridad)
    if (!(await window.validarYDescontar(costo))) {
        return; // El modal de saldo insuficiente lo maneja validarYDescontar
    }

    const nombreProtector = (window.nombres && window.nombres[window.miIdx]) ? window.nombres[window.miIdx] : "Un ciudadano";
    const mensajeLog = `🛡️ ¡${nombreProtector} ha puesto bajo protección a ${jugadorIdx}!`;
    
    try {
        // 2. Aplicar reputación (Es una buena acción, false)
        if (window.esVisitante) {
            await window.aplicarConsecuenciaReputacion(false);
        }

        // 3. Actualizar Firebase
        await update(ref(window.db, 'salas/' + window.sala + '/jugadores/' + jugadorIdx), { 
            tieneEscudo: true, 
            protegidoPor: window.miIdx, 
            timestampEscudo: Date.now(),
            notificacion: {
                titulo: "🛡️ ¡Protección Recibida!",
                mensaje: `¡El ciudadano ${nombreProtector} te ha puesto bajo su protección! Estás a salvo de sabotajes.`,
                timestamp: Date.now()
            }
        });

        // 4. Registrar en Log
        await update(ref(window.db, 'salas/' + window.sala + '/logs'), {
            mensaje: mensajeLog,
            timestamp: Date.now()
        });

        window.cerrarModal();
        window.abrirModal("Protección Activa", `<div class="modal-content"><p>Has gastado $${costo} y ahora proteges a <b>${jugadorIdx}</b>.</p></div>`);

    } catch (error) {
        console.error("Error al activar escudo:", error);
        window.abrirModal("Error", "No se pudo activar el escudo. Inténtalo de nuevo.");
    }
};

window.abrirMenuProteccion = async function() {
    const snap = await get(ref(window.db, 'salas/' + window.sala + '/jugadores'));
    let html = `<div class="modal-content"><p>Selecciona a quién deseas proteger (Costo: $300):</p>`;
    let hayJugadores = false;

    snap.forEach(c => {
        // Validación de jugador válido
        if (typeof window.esJugadorValido === 'function' && window.esJugadorValido(c.key, c.val())) {
            hayJugadores = true;
            html += `<button style="background:#ff80bf; color:white; border:none; padding:10px; cursor:pointer; margin-bottom:5px; width:100%" 
                     onclick="window.activarEscudo('${c.key}')">
                     🛡️ Proteger a ${c.key}</button>`;
        }
    });

    if (!hayJugadores) html += `<p>No hay otros jugadores disponibles.</p>`;
    window.abrirModal("Proteger Ciudadano", html + `</div>`);
};

// --- UTILIDAD (Asegurada) ---
window.esJugadorValido = (id, d) => (d && d.tipo === 'jugador') || !id.startsWith('v');

// --- VINCULACIÓN BLINDADA POR DELEGACIÓN DE EVENTOS ---
document.addEventListener('click', function(e) {
    // Buscamos si el elemento clickeado es nuestro botón o algo dentro de él
    const btn = e.target.closest('#btn-reputacion-global');
    
    if (btn) {
        e.preventDefault();
        e.stopPropagation();
        
        // Ejecutamos la función de reputación
        if (typeof window.mostrarAvisoReputacion === 'function') {
            window.mostrarAvisoReputacion();
        } else {
            console.error("Error: window.mostrarAvisoReputacion no está definida.");
        }
    }
}, true); // El 'true' asegura que capturemos el clic antes que cualquier otra capa del juego

console.log("Sistema de Reputación: Evento delegado activo permanentemente.");

window.mostrarAvisoReputacion = async function() {
    // 1. Obtener los datos del jugador actual
    const rol = window.esVisitante ? 'visitantes' : 'jugadores';
    const userRef = ref(window.db, `salas/${window.sala}/${rol}/${window.miIdx}`);
    const snap = await get(userRef);
    const datos = snap.val() || { reputacion: 0 };

    // 2. Obtener título y descripción
    const info = window.obtenerTituloFinal(datos);
    const rep = parseInt(datos.reputacion) || 0;

    // 3. Crear estrellas (Rosa para activas, Gris para inactivas)
    let estrellasHTML = '';
    for(let i = 1; i <= 5; i++) {
        const color = i <= rep ? '#ff59aa' : '#ccc';
        estrellasHTML += `<span style="color: ${color}; font-size: 28px; margin: 0 3px;">★</span>`;
    }

    // 4. Contenido con la estética solicitada
    const contenido = `
        <div style="text-align: center; padding: 20px; font-family: Arial, sans-serif; color: #333; background: #fff;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; color: #ff59aa;">Reputación</h2>
            <div style="margin-bottom: 20px;">${estrellasHTML}</div>
            <h3 style="margin: 0 0 10px 0; font-size: 24px; color: #ff59aa;">${info.t}</h3>
            <p style="font-size: 15px; margin-bottom: 30px; color: #f7c2dc; line-height: 1.5;">
                ${info.d}
            </p>
            <div style="border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px;">
                <button onclick="window.cerrarModal()" style="padding: 10px 30px; background: #ff59aa; border: none; color: white; cursor: pointer; font-size: 14px; font-weight: bold; border-radius: 4px;">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    // 5. Abrir el modal
    window.abrirModal("Información", contenido);
};

// --- 1. LÓGICA UNIFICADA DE TÍTULOS ---
window.obtenerTituloFinal = function(datos) {
    const rep = parseInt(datos.reputacion) || 0;
    
    // Si tiene alineamiento, usamos la lógica de Ángel/Gárgola
    if (datos.alineamiento) {
        const esGargola = datos.alineamiento === 'gargola';
        const niveles = esGargola ? [
            {t: "Sombra", d: "Apenas inicias tu camino del caos."},
            {t: "Inquietud", d: "Tu presencia incomoda a la ciudad."},
            {t: "Saboteador", d: "Has causado problemas reales."},
            {t: "Agente del Caos", d: "El pánico sigue tus pasos."},
            {t: "Monarca Oscuro", d: "La ciudad es tu patio de juegos."}
        ] : [
            {t: "Aprendiz de Luz", d: "Dando tus primeros pasos en el camino del bien."},
            {t: "Ayudante", d: "La gente empieza a notar tu bondad."},
            {t: "Guardián", d: "Proteges a los necesitados."},
            {t: "Héroe Local", d: "Eres un pilar de la comunidad."},
            {t: "Ángel de la Ciudad", d: "Tu luz es invencible."}
        ];
        
        if (rep <= 0) return {t: "Ciudadano", d: "Aún no has destacado."};
        return niveles[Math.min(rep - 1, niveles.length - 1)];
    }

    // Si es JUGADOR NORMAL, usamos la tabla estándar
    const data = [
        { t: "Principiante en Sombras", d: "Apenas comienzas tu camino." },
        { t: "Novato Urbano", d: "Empiezas a ser reconocido en las calles." },
        { t: "Estrella Naciente", d: "Tu nombre suena en los negocios locales." },
        { t: "Ciudadano Distinguido", d: "Cuentas con el respeto de los habitantes." },
        { t: "Icono de la Ciudad", d: "Tu influencia es innegable." },
        { t: "Leyenda de Naeun Town", d: "Eres el dueño de la ciudad." }
    ];
    const idx = Math.min(rep, data.length - 1);
    return data[idx];
};

// --- 2. RENDERIZADO DEL BOTÓN Y ESTRELLAS (ACTUALIZADO) ---
window.renderEstrellas = function(rep, datos) {
    // 1. Sanitizar el valor (asegurar que esté entre 0 y 5)
    const nivel = Math.max(0, Math.min(5, parseInt(rep) || 0));

    // 2. Actualizar el botón global
    const btn = document.getElementById('btn-reputacion-global');
    if (btn) {
        // Lógica Inteligente: Si hay datos, mostramos el Título. Si no, mostramos el número.
        if (datos) {
            const info = window.obtenerTituloFinal(datos);
            btn.innerText = `${info.t}`; // Ejemplo: "Ángel de la Ciudad"
        } else {
            btn.innerText = `Reputación: ${nivel} ★`; // Fallback simple
        }
    }

    // 3. Actualizar atributo en el contenedor (útil para CSS)
    const container = document.querySelector('.estrellas-container');
    if (container) container.setAttribute('data-reputacion', nivel);

    // 4. Actualizar colores de las estrellas
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (star) {
            star.style.color = i <= nivel ? '#ff59aa' : '#ccc';
            star.style.transition = "color 0.3s ease"; // Suavizado visual
        }
    }
};

window.verificarAscenso = function(repAnterior, repNueva, datosUsuario) {
    // 1. Solo mostramos si el nivel aumentó realmente
    if (repNueva > repAnterior) {
        
        // 2. Usamos nuestra nueva función unificada (la que creamos antes)
        // Pasamos el objeto de datos que contiene {reputacion, alineamiento}
        const data = window.obtenerTituloFinal(datosUsuario);
        
        // 3. Abrimos el modal
        window.abrirModal("¡Ascenso de Rango!", `
            <div style="text-align:center; padding: 15px;">
                <h2 style="color: #ff59aa;">¡Felicidades!</h2>
                <p>Has alcanzado un nuevo nivel de prestigio:</p>
                <h3 style="color: #ff59aa; font-size: 1.5em; margin: 10px 0;">${data.t}</h3>
                <p style="font-style: italic; color: #555;">"${data.d}"</p>
                <div style="font-size: 2em; margin: 15px 0; color: #ff59aa;">${repNueva} ★</div>
                <button onclick="window.cerrarModal()" style="background: #ff59aa; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer;">¡Genial!</button>
            </div>
        `);
    }
};

window.completarMisionVisitante = async function(tipo) {
    try {
        const rol = window.esVisitante ? 'visitantes' : 'jugadores';
        const userRef = ref(window.db, `salas/${window.sala}/${rol}/${window.miIdx}`);
        
        const snap = await get(userRef);
        const datos = snap.val();
        if (!datos) return;

        // 1. Calcular reputación (0 a 5)
        const repActual = parseInt(datos.reputacion) || 0;
        const cambio = (tipo === 'angel') ? 1 : -1;
        const nuevaRep = Math.min(5, Math.max(0, repActual + cambio));
        
        const recompensa = (tipo === 'angel') ? 200 : 150;
        const nombreMision = (tipo === 'angel') ? "Misión de Benefactor" : "Misión de Saboteador";

        // Preparamos los datos actualizados para pasarlos a las funciones de UI
        const datosActualizados = {
            ...datos,
            reputacion: nuevaRep,
            alineamiento: tipo // IMPORTANTE: usamos 'alineamiento'
        };

        // 2. Actualizar datos en Firebase
        await update(userRef, { 
            reputacion: nuevaRep,
            dinero: increment(recompensa),
            misionesCompletadas: increment(1),
            alineamiento: tipo // IMPORTANTE: nombre del campo unificado
        });

        // 3. Sincronización Total con el sistema
        // Actualiza las estrellas y el Título en el botón
        window.renderEstrellas(nuevaRep, datosActualizados);
        
        // Verifica automáticamente si hubo ascenso de rango
        window.verificarAscenso(repActual, nuevaRep, datosActualizados);

        // 4. Feedback visual
        if (typeof window.mostrarExitoMision === 'function') {
            window.mostrarExitoMision(nombreMision, recompensa);
        } else {
            console.log(`${nombreMision} completada. Recompensa: $${recompensa}`);
        }

        window.cerrarModal();
        console.log(`Misión ${tipo} completada. Reputación: ${nuevaRep}`);

    } catch (error) {
        console.error("Error al completar misión:", error);
    }
};

/// --- 1. CONFIGURACIÓN DE HERRAMIENTAS DE DEBUG ---
window.firebaseTools = { ref, get, update, increment }; 

window.verInfoReputacionEnConsola = async function() {
    const rol = window.esVisitante ? 'visitantes' : 'jugadores';
    // Asegúrate de que 'db' esté disponible globalmente o usa 'window.db' si es necesario
    const userRef = ref(db, `salas/${window.sala}/${rol}/${window.miIdx}`);
    
    try {
        const snap = await get(userRef);
        const datos = snap.val();
        
        if (!datos) {
            console.warn("⚠️ No se encontraron datos del jugador actual.");
            return;
        }

        // Info extraída del usuario
        const info = {
            Nombre: datos.nombre || "Desconocido",
            Reputacion: datos.reputacion ?? 0,
            Alineacion: datos.alineamiento || "Neutral", // CORREGIDO: Ahora busca 'alineamiento'
            Misiones_Completadas: datos.misionesCompletadas || 0,
            Dinero: datos.dinero || 0
        };

        console.log("%c--- REPORTE DE REPUTACIÓN Y MISIONES ---", "color: #ff59aa; font-weight: bold; font-size: 14px;");
        console.table(info);
        
        // Diagnóstico visual en consola
        if (datos.alineamiento === 'angel') {
            console.log("%cEstado: Protector de la ciudad (Ángel) 👼", "color: #ff59aa;");
        } else if (datos.alineamiento === 'gargola') {
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
            
            // --- TRUCO: rep [número] ---
            if (valor.startsWith('rep ')) {
                e.preventDefault();
                const partes = valor.split(' ');
                const num = parseInt(partes[1]);
                
                if (!isNaN(num)) {
                    // Creamos un objeto "ficticio" para que la UI se actualice correctamente
                    // Esto engaña al sistema visual para que muestre el título correspondiente
                    const mockData = { reputacion: num, alineamiento: 'angel' }; 
                    
                    window.renderEstrellas(num, mockData);
                    
                    // IMPORTANTE: quitamos el argumento (num) porque la función
                    // ahora busca los datos en la base de datos ella misma.
                    window.mostrarAvisoReputacion(); 
                }
                chatInput.value = "";
            }
            
            // --- TRUCO: misiones ---
            if (valor === 'misiones') {
                e.preventDefault();
                // Asegúrate de que esta función exista en tu proyecto
                if (typeof window.abrirModalMisiones === 'function') {
                    window.abrirModalMisiones();
                }
                chatInput.value = "";
            }
        }
    });
};

window.mostrarExitoMision = function(nombreMision, recompensa, repGanada = 0) {
    // Definimos el color según si ganó o perdió reputación
    const colorRep = repGanada >= 0 ? '#ff59aa' : '#555';
    const signoRep = repGanada >= 0 ? '+' : '';

    const html = `
        <div style="text-align: center; padding: 20px; font-family: sans-serif;">
            <div style="font-size: 3em; margin-bottom: 10px;">🎉</div>
            <h2 style="color: #ff59aa; margin-top: 0;">¡Misión Completada!</h2>
            <p style="margin-bottom: 20px;">Has terminado: <b>${nombreMision}</b></p>
            
            <div style="background: #fff5f7; border: 2px dashed #ff80bf; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <div style="font-size: 0.8em; color: #666; margin-bottom: 5px;">RECOMPENSA RECIBIDA:</div>
                <div style="font-size: 1.5em; font-weight: bold; color: #ff59aa;">+$${recompensa}</div>
                ${repGanada !== 0 ? `<div style="font-size: 1.1em; color: ${colorRep}; margin-top: 5px;">Reputación: ${signoRep}${repGanada} ★</div>` : ''}
            </div>
            
            <button onclick="window.cerrarModal()" 
                style="width: 100%; background: #ff59aa; color: white; border: none; padding: 12px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 1em;">
                ¡A por la siguiente!
            </button>
        </div>`;
    
    window.abrirModal("Logro desbloqueado", html);
};

window.pintarTodasLasCasillas = function(salaData) {
    // Si no hay datos de propiedades, no hacemos nada
    if (!salaData || !salaData.propiedades) return;
    
    Object.keys(salaData.propiedades).forEach(pos => {
        const prop = salaData.propiedades[pos];
        if (prop.owner !== undefined) {
            window.pintarCasilla(pos, prop.owner);
        }

        // Dentro de tu bucle renderBoard:
        let cell = document.getElementById('cell-' + pos);
        let hc = cell ? cell.querySelector('.house-container') : null; 
        if (hc) {
            hc.innerHTML = "";
            let nivel = salaData.propiedades[pos]?.nivel || 0;
            if (nivel > 0 && nivel < 5) {
                for (let k = 0; k < nivel; k++) { 
                    let h = document.createElement('div'); h.className = 'house'; hc.appendChild(h); 
                }
            } else if (nivel === 5) { 
                let h = document.createElement('div'); h.className = 'hotel'; hc.appendChild(h); 
            }
        }
    });
};

window.pintarCasilla = function(posicion, ownerId) {
    const celda = document.getElementById(`cell-${posicion}`);
    if (!celda) return;

    // Limpieza de estilos previos para evitar que se solapen colores
    celda.style.backgroundColor = ""; 
    celda.style.boxShadow = "none";
    celda.style.transition = "background-color 0.3s ease";

    let color = null;

    // 1. Si ownerId es numérico (0, 1, 2...)
    const idxNumerico = parseInt(ownerId);
    if (!isNaN(idxNumerico) && idxNumerico >= 0 && window.colores && idxNumerico < window.colores.length) {
        color = window.colores[idxNumerico];
    } 
    // 2. Si no es numérico, intentamos buscarlo por nombre (ej: "Dog", "Car")
    else if (window.nombres) {
        const idxNombre = window.nombres.indexOf(ownerId);
        if (idxNombre !== -1 && window.colores[idxNombre]) {
            color = window.colores[idxNombre];
        }
    }

    // Aplicar color si se encontró
    if (color) {
        celda.style.backgroundColor = color;
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

    // 5. INICIALIZACIÓN DE SISTEMAS GLOBALES
    if (typeof window.iniciarInyectorPoderes === 'function') {
        window.iniciarInyectorPoderes();
    }
    if (typeof window.generarTablero === 'function') {
        window.generarTablero();
    }
    console.log("Juego cargado y sistemas inicializados.");

    // 6. VINCULACIÓN ÚNICA DE BOTONES (Reputación)
    const vincularBotonesUI = () => {
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
    vincularBotonesUI();

    // 7. LISTENERS GLOBALES (Firebase)
    if (window.db && window.sala && window.miIdx) {
        
        // Notificaciones Privadas
        onValue(ref(window.db, 'salas/' + window.sala + '/jugadores/' + window.miIdx + '/notificacion'), (snap) => {
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

        // Gamelog: Escuchamos los logs recientes
        const logsRef = query(ref(window.db, 'salas/' + window.sala + '/logs'), limitToLast(50));
        off(logsRef); // Limpiamos para evitar duplicados
        onChildAdded(logsRef, (snap) => {
            const logEntry = snap.val();
            if (logEntry && logEntry.mensaje && typeof window.log === 'function') {
                window.log(logEntry.mensaje);
            }
        });

        // Listener de Reputación (Actualizado para títulos)
        const rutaRep = window.esVisitante 
            ? 'salas/' + window.sala + '/visitantes/' + window.miIdx 
            : 'salas/' + window.sala + '/jugadores/' + window.miIdx;

        onValue(ref(window.db, rutaRep), (snap) => {
            const data = snap.val();
            if (data && data.reputacion !== undefined) {
                // Pasamos el objeto completo para renderizar estrellas y título
                window.renderEstrellas(data.reputacion, data);
            }
        });
    }
});
