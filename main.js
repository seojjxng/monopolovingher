// main.js 
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set, runTransaction, update, onValue, push, onDisconnect, off } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

window.getSafeRef = function(path) {
    if (typeof window.db === 'undefined' || window.db === null) {
        console.warn("Firebase DB no está lista, esperando...");
        return null;
    }
    return ref(window.db, path);
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

window.nombres = ["Dog", "Horse", "Hat", "Car"];
window.colores = ["#ffb7b2", "#baa695", "#c2f0c9", "#c2ddf2"];
let chatListener; 

window.anunciar = function(mensaje) {
    // Protección: no hacer nada si el mensaje es nulo o vacío
    if (!mensaje) return;

    const logContainer = document.getElementById('game-log');
    if (!logContainer) {
        console.warn("Log container no encontrado, no se puede mostrar el anuncio.");
        return;
    }

    // Crear el elemento del mensaje
    const nuevoMensaje = document.createElement('div');
    nuevoMensaje.style.cssText = "margin-bottom: 4px; border-bottom: 1px solid #ffccd5; padding-bottom: 2px; color: #333;";
    nuevoMensaje.innerHTML = mensaje; 
    
    // Agregar al final
    logContainer.appendChild(nuevoMensaje);
    
    // Scroll suave hacia el nuevo mensaje
    logContainer.scrollTo({
        top: logContainer.scrollHeight,
        behavior: 'smooth'
    });
};

// --- 2. FUNCIÓN DE ANUNCIO ---
window.anunciar = function(mensaje) {
    const logContainer = document.getElementById('game-log');
    if (!logContainer) return;
    const nuevoMensaje = document.createElement('div');
    nuevoMensaje.style.cssText = "font-size: 0.85em; margin-bottom: 4px; border-bottom: 1px solid #ffccd5; padding-bottom: 2px; color: #333;";
    nuevoMensaje.innerHTML = mensaje;
    const headerClima = document.getElementById('clima-header');
    if (headerClima && headerClima.nextSibling) {
        logContainer.insertBefore(nuevoMensaje, headerClima.nextSibling);
    } else {
        logContainer.prepend(nuevoMensaje);
    }
    logContainer.scrollTop = 0;
};


window.log = function(mensaje) {
    console.log("LOG:", mensaje);
    // Si quieres que también aparezca en tu chat:
    if (typeof window.enviarMensaje === 'function') {
        window.enviarMensaje("Sistema", mensaje, true); // true para indicar que es aviso del sistema
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

// --- Listener mejorado ---
window.escucharJugadores = function() {
    // 1. Protección contra carga temprana
    if (!window.db) {
        setTimeout(window.escucharJugadores, 500);
        return;
    }
    if (!window.sala) return;

    // 2. Uso de getSafeRef
    const jugadoresRef = window.getSafeRef('salas/' + window.sala + '/jugadores');
    
    // 3. Listener seguro
    if (jugadoresRef) {
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
    } else {
        // Si la referencia no se pudo crear, reintentar
        setTimeout(window.escucharJugadores, 500);
    }
};

// --- 1. CONFIGURACIÓN DE CLIMAS Y GLOBALES ---
// --- 1. CONFIGURACIÓN GLOBAL ---
window.climas = Object.freeze([
    { n: "Primavera Soleada", mult: 1.0 }, { n: "Primavera Lluviosa", mult: 1.0 },
    { n: "Verano Caluroso", mult: 1.0 }, { n: "Verano Nublado", mult: 1.0 },
    { n: "Otoño Fresco", mult: 1.0 }, { n: "Otoño Ventoso", mult: 1.0 },
    { n: "Lluvia Fuerte", mult: 0.7 }, { n: "Tormenta Eléctrica", mult: 0.5 },
    { n: "Ventisca", mult: 0.6 }, { n: "Nevada Intensa", mult: 0.6 },
    { n: "Tornado", mult: 0.5 }
]);


// --- 3. SINCRONIZACIÓN CENTRALIZADA ---
window.sincronizar = function() {
    if (!window.db) { setTimeout(window.sincronizar, 500); return; }
    if (!window.sala) return;

    // LIMPIEZA TOTAL: Eliminamos listeners previos para evitar duplicidad
    if (window.chatListener) { off(window.chatListener); window.chatListener = null; }
    if (window.estadoListener) { off(window.estadoListener); window.estadoListener = null; }
    if (window.climaListener) { off(window.climaListener); window.climaListener = null; }

    const salaRef = window.getSafeRef('salas/' + window.sala);
    const chatRef = window.getSafeRef('salas/' + window.sala + '/chat');
    const climaRef = window.getSafeRef('salas/' + window.sala + '/climaIdx');

    // CHAT
    if (chatRef) {
        window.chatListener = onValue(chatRef, (snap) => {
            const chatLog = document.getElementById('chat-log');
            if (!chatLog) return;
            const data = snap.val();
            chatLog.innerHTML = ""; 
            if (!data) return;
            Object.values(data).forEach(m => {
                if (m.n === "Sistema" && !m.esChat) return;
                const colorEstilo = m.esRosa ? "#ff80bf" : "#333";
                const nombreDisplay = (m.n === "Info" || m.n === "Sistema") ? "" : `<b>${m.n}:</b>`;
                const msgDiv = document.createElement('div');
                msgDiv.style.cssText = `color: ${colorEstilo}; margin-bottom: 5px; text-align: left;`;
                msgDiv.innerHTML = `<small>[${m.t}]</small> ${nombreDisplay} ${m.m}`;
                chatLog.appendChild(msgDiv);
            });
            chatLog.scrollTop = chatLog.scrollHeight;
        });
    }

    // ESTADO (Turnos, Dinero, Fichas, Botones)
    if (salaRef) {
        window.estadoListener = onValue(salaRef, (snap) => {
            const s = snap.val();
            if (!s) return;

            const btnIniciar = document.getElementById('btn-iniciar-partida');
            if (btnIniciar) btnIniciar.style.display = (window.miIdx === 0 && s.estado === "esperando") ? 'block' : 'none';

            if (window.estadoPrevio === "esperando" && s.estado === "jugando") window.anunciar("¡La partida ha comenzado!");
            window.estadoPrevio = s.estado;

            if (s.jugadores && window.miIdx !== undefined && s.jugadores[window.miIdx]) {
                const elDinero = document.getElementById('dinero-mio');
                if (elDinero) elDinero.innerText = s.jugadores[window.miIdx].dinero || 0;
            }

            const elTurno = document.getElementById('turno-text') || document.getElementById('turno-display');
            if (elTurno) {
                const nombreTurno = (s.turno !== undefined && window.nombres) ? (window.nombres[s.turno] || "Jugador " + (s.turno + 1)) : "Esperando...";
                elTurno.innerText = "Turno: " + nombreTurno;
                if (window.colores && s.turno !== undefined) elTurno.style.color = window.colores[s.turno] || "#ff59aa";
            }

            const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
            if (btnDado) {
                const esMiTurno = (s.estado === "jugando" && s.turno === window.miIdx);
                btnDado.style.pointerEvents = esMiTurno ? 'auto' : 'none';
                btnDado.style.opacity = esMiTurno ? '1' : '0.5';
                btnDado.style.cursor = esMiTurno ? 'pointer' : 'default';
            }

            if (s.jugadores && typeof window.actualizarTokens === 'function') window.actualizarTokens(s.jugadores);
        });
    }

    // CLIMA
    if (climaRef) {
        window.climaListener = onValue(climaRef, (snap) => {
            const idx = snap.val() !== null ? snap.val() : 0;
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
    }
};
    
// --- Lógica del Ciclo Automático ---
window.iniciarCicloClima = function() {
    if (window.climaInterval) clearInterval(window.climaInterval);
    
    window.climaInterval = setInterval(() => {
        const controlRef = ref(db, 'salas/' + window.sala + '/controladorClima');
        get(controlRef).then(snap => {
            const ctrl = snap.val();
            const ahora = Date.now();
            
            if (!ctrl || (ahora - ctrl.timestamp > 300000)) {
                const nuevoIdx = Math.floor(Math.random() * window.climas.length);
                const nuevoClima = window.climas[nuevoIdx];
                
                update(ref(db, 'salas/' + window.sala), { climaIdx: nuevoIdx });
                push(ref(db, 'salas/' + window.sala + '/chat'), {
                    n: "Sistema",
                    m: `El clima ha cambiado automáticamente a ${nuevoClima.n}. Alquileres ajustados a ${nuevoClima.mult * 100}%.`,
                    t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        });
    }, 600000); 
};

// --- Panel de Control de Visitantes ---
window.abrirControlClima = function() {
    let html = `<div class="clima-container"><p>Selecciona el nuevo clima para Naeun Town:</p>`;
    window.climas.forEach((c, idx) => {
        html += `<button class="clima-btn" onclick="window.cambiarClima(${idx}); window.cerrarModal();">
                    <b>${c.n}</b> <small>(Mult: ${c.mult}x)</small>
                 </button>`;
    });
    html += `</div>`;
    window.abrirModal("☁️ Panel de Control Climático", html);
};

window.tomarControlClima = function() {
    if (!window.esVisitante) return;
    const refControl = ref(db, 'salas/' + window.sala + '/controladorClima');
    
    runTransaction(refControl, (data) => {
        const ahora = Date.now();
        // Permite tomar control si no hay registro o si pasaron más de 5 min (300,000ms)
        if (!data || (ahora - data.timestamp > 300000)) {
            return { usuario: window.miIdx, timestamp: ahora };
        }
        return; // Aborta la transacción si alguien más tiene el control activo
    }).then((res) => {
        if (res.committed) {
            window.abrirControlClima();
        } else {
            window.abrirModal("Acceso Denegado", "<p>Otro visitante ya tiene el control del clima en este momento.</p>");
        }
    }).catch((error) => {
        console.error("Error al tomar control climático:", error);
        window.abrirModal("Error", "<p>No se pudo conectar con el servidor para gestionar el clima.</p>");
    });
};

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

// 4. Sistema de Ventanas Emergentes (Modal)
window.abrirModal = function(titulo, contenido) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');

    if (modal && titleEl && bodyEl) {
        titleEl.innerHTML = titulo;
        bodyEl.innerHTML = contenido;
        modal.style.display = 'flex';
    } else {
        console.error("Los elementos del modal no se encuentran en el HTML.");
    }
};

window.cerrarModal = function() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
};

// --- 2. LÓGICA DE TIRAR DADO Y MOVER ---
window.estaLanzando = false;
window.tirarDado = async function() {
    // 1. Verificaciones iniciales y bloqueo de doble clic
    if (typeof window.miIdx === 'undefined' || window.miIdx === -1 || window.estaLanzando) return;

    const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
    
    // Activamos el bloqueo
    window.estaLanzando = true;
    if (btnDado) btnDado.style.pointerEvents = 'none';

    try {
        const salaRef = window.getSafeRef('salas/' + window.sala);
        const snap = await get(salaRef);
        const s = snap.val();

        // Validar turno y estado
        if (!s || s.turno !== window.miIdx || s.estado !== "jugando") {
            window.estaLanzando = false;
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            return;
        }

        // Lógica de cárcel
        if (s.jugadores[window.miIdx].enCarcel > 0) {
            window.anunciar(window.nombres[window.miIdx] + " está en la cárcel.");
            window.pasarTurno();
            window.estaLanzando = false;
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            return;
        }

        // 2. Generar dado (1-6)
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        const dado = (array[0] % 6) + 1;
        
        // 3. Calcular posición exacta
        const posActual = Number(s.jugadores[window.miIdx].pos) || 0;
        const TAMANO_TABLERO = 28; 
        const nuevaPos = (posActual + dado) % TAMANO_TABLERO;

        console.log(`DEBUG: Posición Actual (${posActual}) + Dado (${dado}) = Nueva Posición (${nuevaPos})`);

        // 4. ANIMACIÓN SINCRONIZADA (LLAMADA ÚNICA)
        window.lanzarDado3D(dado);
        if(document.getElementById('dado-valor')) document.getElementById('dado-valor').innerText = dado;
        
        // Pausa forzada para que la animación se vea antes de mover el token
        await new Promise(resolve => setTimeout(resolve, 700));

        // 5. Actualización Visual
        if (typeof window.actualizarTokens === 'function') {
            const tempJugadores = JSON.parse(JSON.stringify(s.jugadores));
            tempJugadores[window.miIdx].pos = nuevaPos;
            window.actualizarTokens(tempJugadores);
        }

        // 6. Preparar datos para Firebase
        const jugadorRef = window.getSafeRef('salas/' + window.sala + '/jugadores/' + window.miIdx);
        const dineroActual = Number(s.jugadores[window.miIdx].dinero) || 0;
        let dineroExtra = (nuevaPos < posActual) ? 100 : 0;
        const nuevoContador = (dado === 6) ? (s.jugadores[window.miIdx].seisSeguidos || 0) + 1 : 0;

        if (dineroExtra > 0) window.anunciar("¡Pasaste por SALIDA y cobraste $100!");

        // 7. Guardar en Firebase
        if (nuevoContador === 3) {
            window.anunciar("¡ACUSACIÓN DE FRAUDE! 3 veces 6.");
            await update(jugadorRef, { 
                pos: 9, 
                enCarcel: 2, 
                seisSeguidos: 0, 
                dinero: dineroActual + dineroExtra 
            });
            window.pasarTurno();
        } else {
            await update(jugadorRef, { 
                pos: nuevaPos, 
                seisSeguidos: nuevoContador, 
                dinero: dineroActual + dineroExtra 
            });
            if (dado !== 6) window.pasarTurno();
            else window.anunciar("¡Sacaste un 6! Tienes turno extra.");
        }

        // 8. Manejo final (Casilla)
        if (typeof window.manejarCasilla === 'function') await window.manejarCasilla(nuevaPos);

    } catch (error) {
        console.error("Error crítico en tirarDado:", error);
    } finally {
        window.estaLanzando = false;
        if (btnDado) btnDado.style.pointerEvents = 'auto';
    }
};

window.lanzarDado3D = function(resultado) {
    console.log("--- Lógica 3D forzada para el número:", resultado);
    
    const dice = document.getElementById('dice');
    if (!dice) return;

    // 1. Limpiar TODAS las interferencias visuales
    dice.classList.remove('rolling');
    dice.style.animation = "none"; // Mata cualquier animación CSS activa
    dice.style.transition = "none"; // Elimina transiciones para saltar directo a la posición
    
    // 2. Mapeo geométrico (Ajusta estos valores según la cara real que veas)
    const rot = { 
        1: "rotateX(0deg) rotateY(0deg)", 
        2: "rotateX(0deg) rotateY(-90deg)", 
        3: "rotateX(-90deg) rotateY(0deg)", 
        4: "rotateX(90deg) rotateY(0deg)", 
        5: "rotateX(0deg) rotateY(90deg)", 
        6: "rotateX(0deg) rotateY(180deg)" 
    };

    const transformacion = rot[resultado];
    
    // 3. Forzar el cambio (Reflow)
    void dice.offsetWidth; 
    
    // 4. Aplicar la rotación final sin transiciones que estorben
    dice.style.transform = transformacion;
    
    console.log("Dado visual posicionado en:", transformacion);
};

// --- 3. ACTUALIZAR TOKENS (Renderizado Visual) ---
window.actualizarTokens = function(jugadores) {
    if (!jugadores) return;

    // 1. Mapeo de tus imágenes personalizadas
    const tokensMap = {
        0: "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/Gemini_Generated_Image_bnjz0lbnjz0lbnjz.png",
        1: "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/67791e8f69aea2f39d914aff8fd20714-removebg-preview-removebg-preview.png",
        2: "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/ZaN9ZUG.png",
        3: "https://raw.githubusercontent.com/seojjxng/game-pic/refs/heads/main/mC3Vwc7.png"
    };

    // 2. Limpiar tokens anteriores (buscamos por clase .token)
    document.querySelectorAll('.token').forEach(t => t.remove());

    // 3. Iterar sobre los jugadores
    Object.keys(jugadores).forEach((idx) => {
        const jugador = jugadores[idx];
        const p = parseInt(jugador.pos) || 0;
        const celda = document.getElementById('cell-' + p);

        if (celda) {
            // Aseguramos que la celda tenga posicionamiento para el token
            celda.style.position = 'relative';

            // Creamos la etiqueta <img>
            const token = document.createElement('img');
            token.className = 'token';
            token.id = 'token-' + idx;
            token.src = tokensMap[idx] || tokensMap[0];

            // Estilos del token para asegurar visibilidad y centrado
            token.style.position = 'absolute';
            token.style.top = '50%';
            token.style.left = '50%';
            token.style.transform = 'translate(-50%, -50%)';
            token.style.width = '35px';
            token.style.height = '35px';
            token.style.borderRadius = '50%';
            token.style.zIndex = '9999'; // Z-index extremadamente alto
            token.style.objectFit = 'cover';
            token.style.border = '2px solid white';
            token.style.boxShadow = 'none';
            token.style.pointerEvents = 'none'; // Importante para no bloquear clics
            token.style.border = 'none'; 
            token.style.borderRadius = '0'; 
            token.style.boxShadow = 'none';

            celda.appendChild(token);
        } else {
            console.warn("Celda no encontrada: cell-" + p);
        }
    });
};

window.escucharTurno = function() {
    if (!window.sala) return;
    
    onValue(ref(db, 'salas/' + window.sala), (snap) => {
        // --- BLOQUEO DE SEGURIDAD ---
        // Si el jugador está lanzando el dado, ignoramos cualquier actualización 
        // del servidor para evitar conflictos visuales.
        if (window.estaLanzando) return;

        const data = snap.val();
        if (!data) return;

        // Renderizado del centro del tablero
        const centroTablero = document.getElementById('centro-tablero');
        if (centroTablero) {
            const turnoIdx = data.turno || 0;
            centroTablero.innerHTML = data.estado === "esperando" 
                ? (window.miIdx === 0 ? '<button onclick="window.iniciarPartida()">Iniciar</button>' : 'Esperando...')
                : `<h3>Turno de:</h3><div style="color:${window.colores[turnoIdx]}">${window.nombres[turnoIdx]}</div>`;
        }
        
        // Control visual del botón de dado
        const btnDado = document.querySelector('img[alt="Lanzar dado"]') || document.getElementById('dice');
        if (btnDado) {
            const esMiTurno = (data.estado === "jugando" && data.turno === window.miIdx);
            btnDado.style.pointerEvents = esMiTurno ? 'auto' : 'none';
            btnDado.style.opacity = esMiTurno ? '1' : '0.5';
        }

        // Sincronización de tokens (Si tienes un listener extra que renderiza los tokens, 
        // asegúrate de que también respete la bandera window.estaLanzando)
        if (data.jugadores && typeof window.actualizarTokens === 'function') {
            window.actualizarTokens(data.jugadores);
        }
    });
};

window.pasarTurno = function() {
    const salaRef = ref(db, 'salas/' + window.sala);
    
    // Obtenemos el estado actual de la sala
    get(salaRef).then((snap) => {
        const s = snap.val();
        if (!s || !s.jugadores) return;

        // Calculamos el índice del siguiente jugador
        const jugadoresKeys = Object.keys(s.jugadores);
        const totalJugadores = jugadoresKeys.length;
        const turnoActual = s.turno !== undefined ? s.turno : 0;
        const siguienteTurno = (turnoActual + 1) % totalJugadores;
        
        // Actualizamos el turno en la base de datos
        // Al hacer esto, tu listener en 'window.sincronizar' detectará el cambio
        // y habilitará el dado automáticamente para el siguiente jugador.
        update(salaRef, { 
            turno: siguienteTurno 
        }).then(() => {
            // Log informativo del cambio de turno
            const nombreSiguiente = s.jugadores[siguienteTurno]?.nombre || ("Jugador " + (siguienteTurno + 1));
            window.log("Turno de: " + nombreSiguiente);
            
            // Opcional: Anuncio visual si deseas que todos vean quién sigue
            // window.anunciar("Es el turno de " + nombreSiguiente);
        });
        
    }).catch((error) => console.error("Error al pasar el turno:", error));
};

window.iniciarPartida = function() {
    if (window.miIdx !== 0) return;
    
    // Solo actualizamos la base de datos.
    // El listener que está escuchando el cambio de estado se encargará de anunciarlo.
    update(ref(db, 'salas/' + window.sala), { 
        estado: "jugando", 
        turno: 0 
    }).catch(console.error);
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

// --- Puente para que el botón HTML funcione ---
window.abrirverSaldos = function() {
    window.verSaldos();
};

// --- Función lógica de Saldos ---
window.verSaldos = function() {
    if (!window.sala) return;
    
    const jugadoresRef = window.getSafeRef('salas/' + window.sala + '/jugadores');
    
    if (!jugadoresRef) return;

    get(jugadoresRef).then((snap) => {
        let txt = "<ul style='list-style:none; padding:0;'>";
        
        snap.forEach(c => {
            let j = c.val();
            let key = c.key;
            
            // Lógica: Si la clave empieza con 'v', es visitante. Si no, es jugador (0-3).
            let nombre = key.startsWith('v') 
                ? "Citizen " + key.replace('v','') 
                : (window.nombres[parseInt(key)] || "Jugador " + (parseInt(key) + 1));
            
            // Mostramos el dinero. Si es undefined, ponemos 1500 por defecto.
            let dinero = (j.dinero !== undefined) ? j.dinero : 1500;
            
            txt += `<li style="margin-bottom: 5px;"><b>${nombre}</b>: $${dinero}</li>`;
        });
        
        txt += "</ul>";
        window.abrirModal("Saldos de los jugadores", txt);
    }).catch((error) => {
        console.error("Error al cargar saldos:", error);
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
    const propRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);

    Promise.all([get(propRef), get(jugadorRef)]).then(([snapProp, snapJugador]) => {
        const precio = mapa[pos].p;
        const jugador = snapJugador.val();

        if (jugador.dinero >= precio) {
            update(propRef, { owner: window.miIdx, nivel: 0, hipotecada: false });
            update(jugadorRef, { dinero: jugador.dinero - precio });
            window.cerrarModal();
            // Opcional: Agregar log al chat
            push(ref(db, 'salas/' + window.sala + '/chat'), {
                n: "Sistema", m: `${window.nombres[window.miIdx]} compró ${mapa[pos].n}.`, t: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            });
        } else {
            alert("Dinero insuficiente.");
        }
    });
};

window.verPropiedad = function(pos) {
    const p = mapa[pos];
    if (p.p === 0) return;

    const indicesTransporte = [8, 24, 26, 27];
    const esTransporte = indicesTransporte.includes(pos);
    
    const iconos = { 
        8:  'https://www.svgrepo.com/show/490615/car-2.svg',
        24: 'https://www.svgrepo.com/show/390391/motorcycle-cross-moto-bike.svg',
        26: 'https://www.svgrepo.com/show/490281/plane.svg',
        27: 'https://www.svgrepo.com/show/480860/train-station-mark.svg'
    };

    // Filtro CSS para convertir colores negros a #ff80bf
    const filtroRosa = "invert(75%) sepia(21%) saturate(1828%) hue-rotate(293deg) brightness(105%) contrast(101%)";

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
            contenido += `<button class="btn-accion" style="background:#ff80bf" onclick="window.comprar(${pos})">Comprar Propiedad</button>`;
        } else if (esDuenio) {
            contenido += `<button class="btn-accion" style="background:#2ecc71" onclick="window.mejorar(${pos})">Mejorar (+$50)</button>
                          <button class="btn-accion" style="background:#95a5a6" onclick="window.hipotecar(${pos})">${estaHipotecada ? "Liberar" : "Hipotecar"}</button>`;
        } else if (!estaHipotecada) {
            contenido += `<p>Dueño: <b>${window.nombres[prop.owner]}</b></p>
                          <button class="btn-accion" style="background:#e67e22" onclick="window.pagarAlquiler(${prop.owner}, ${alquiler})">Pagar Alquiler</button>`;
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

    // Usamos 'get' y 'ref' en lugar de window.db.ref
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

    // USAMOS getSafeRef
    const ofertasRef = window.getSafeRef('salas/' + window.sala + '/ofertas');
    if (ofertasRef) {
        push(ofertasRef, {
            de: window.miIdx,
            para: destino,
            propiedad: pIdx,
            precio: valor,
            estado: 'pendiente'
        });
        alert("Oferta enviada a " + (window.nombres[destino] || "Jugador " + destino));
        window.cerrarModal();
    }
};

window.escucharOfertas = function() {
    if (!window.sala) return;
    
    // USAMOS getSafeRef
    const ofertasRef = window.getSafeRef('salas/' + window.sala + '/ofertas');
    
    if (ofertasRef) {
        onChildAdded(ofertasRef, (snap) => {
            const o = snap.val();
            const key = snap.key;

            if (o && String(o.para) === String(window.miIdx) && o.estado === 'pendiente') {
                const nombreVendedor = (window.nombres && window.nombres[o.de]) ? window.nombres[o.de] : "Jugador " + o.de;
                window.abrirModal("¡Oferta de Venta!", `
                    <p>${nombreVendedor} te ofrece la propiedad ${o.propiedad} por <b>$${o.precio}</b></p>
                    <button class="btn-sidebar" style="background:#27ae60;" onclick="window.confirmarCompra('${key}')">Aceptar</button>
                    <button class="btn-sidebar" style="background:#e74c3c;" onclick="window.cerrarModal()">Rechazar</button>
                `);
            }
        });
    }
};

window.confirmarCompra = function(ofertaKey) {
    const ofertaRef = ref(db, 'salas/' + window.sala + '/ofertas/' + ofertaKey);
    
    get(ofertaRef).then((snap) => {
        const o = snap.val();
        if (!o || o.estado !== 'pendiente') return;
        window.ejecutarTransaccionCompra(o.de, o.para, o.propiedad, o.precio, ofertaKey);
    });
};
      window.obtenerAlquilerFerrocarril = function(dueñoIdx, todasLasPropiedades) {
    // 1. Validaciones de seguridad iniciales
    if (!todasLasPropiedades || typeof dueñoIdx === 'undefined') return 0;
    
    const indicesTransporte = [8, 24, 26, 27];
    let cantidad = 0;
    
    // 2. Conteo de ferrocarriles poseídos
    indicesTransporte.forEach(idx => {
        const prop = todasLasPropiedades[idx];
        // Validamos que la propiedad exista y tenga el owner correcto
        if (prop && prop.owner === dueñoIdx) {
            cantidad++;
        }
    });

    // 3. Tabla de alquileres (Escalabilidad protegida)
    const tabla = { 1: 100, 2: 150, 3: 250, 4: 300 };
    
    // Retornamos el valor basado en la cantidad, si es 0, devuelve 0
    return tabla[cantidad] || 0;
};

// Función para procesar el pago al dueño
window.pagarAlquiler = function(ownerIdx, monto) {
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);
    const duenioRef = ref(db, 'salas/' + window.sala + '/jugadores/' + ownerIdx);
    
    // Aquí realizarías el update de dinero en Firebase
    // Ejemplo lógico: restar a uno y sumar a otro
    window.log("Pago de alquiler de $" + monto + " realizado.");
    window.cerrarModal();
};

window.mejorar = function(pos) {
    const propRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const todasPropsRef = ref(db, 'salas/' + window.sala + '/propiedades');

    get(todasPropsRef).then(snap => {
        const todas = snap.val();
        if (verificarMonopolio(pos, todas)) {
            const nivelActual = todas[pos].nivel || 0;
            if (nivelActual < 5) {
                update(propRef, { nivel: nivelActual + 1 });
                window.cerrarModal();
            } else {
                alert("Ya tienes un hotel.");
            }
        } else {
            alert("Debes poseer todas las propiedades de este color para mejorar.");
        }
    });
};

window.hipotecar = function(pos) {
    const propRef = ref(db, 'salas/' + window.sala + '/propiedades/' + pos);
    const jugadorRef = ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx);

    get(propRef).then(snap => {
        const p = snap.val();
        const valorHipoteca = Math.floor(mapa[pos].p * 0.5); // 50% del valor

        if (!p.hipotecada) {
            // Hipotecar
            update(propRef, { hipotecada: true });
            get(jugadorRef).then(s => update(jugadorRef, { dinero: s.val().dinero + valorHipoteca }));
        } else {
            // Liberar (pagando un 10% extra por interés)
            update(propRef, { hipotecada: false });
            get(jugadorRef).then(s => update(jugadorRef, { dinero: s.val().dinero - Math.floor(valorHipoteca * 1.1) }));
        }
        window.cerrarModal();
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
    
    get(ref(db, 'salas/' + salaId)).then((snap) => {
        if (snap.exists()) {
            window.abrirModal("Sala Existente", `<p>La sala <b>${salaId}</b> existe.</p><button class="btn-sidebar" onclick="window.unirseSala('${salaId}')">Unirse</button>`);
        } else {
            window.abrirModal("Nueva Sala", `<p>Crear <b>${salaId}</b>?</p><button class="btn-sidebar" onclick="window.crearSala('${salaId}')">Crear</button>`);
        }
    });
};

window.crearSala = function(salaId) {
    window.sala = salaId;
    set(ref(db, 'salas/' + salaId), {
        estado: "esperando",
        jugadores: { 
            0: { nombre: "Dog", color: window.colores[0], activo: true, dinero: 1500, tienePrestamo: false } 
        }
    }).then(() => {
        window.miIdx = 0;
        window.esVisitante = false;
        window.yaEntro = true;
        
        // Enviamos con esChat: true para que vaya al chat y esRosa: true para el estilo
        push(ref(db, 'salas/' + salaId + '/chat'), { 
            n: "Sistema", 
            m: "Dog ha creado la sala.", 
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            esChat: true,
            esRosa: true 
        });
        
        window.sincronizar();
        window.abrirModal("Sala Creada", `<p>Bienvenido, <b>Dog</b>.</p><button class="btn-sidebar" onclick="window.cerrarModal()">Comenzar</button>`);
    });
};

// --- 1. PERSISTENCIA DE IDENTIDAD ---
window.miIdx = localStorage.getItem('miIdx') || undefined;
window.esVisitante = localStorage.getItem('esVisitante') === 'true';
window.sala = undefined;

// Si ya teníamos datos, intentamos sincronizar automáticamente
if (window.sala && window.miIdx !== undefined) {
    window.sincronizar();
}

// --- 2. UNIRSE A SALA (Con Persistencia) ---
window.estaProcesandoUnion = false; // Bloqueo anti-spam

window.unirseSala = function(salaId) {
    // 1. Bloqueo para evitar clics infinitos
    if (window.estaProcesandoUnion) return;
    
    if (!window.db) {
        setTimeout(() => window.unirseSala(salaId), 500);
        return;
    }

    window.estaProcesandoUnion = true; // Iniciamos proceso
    window.sala = salaId;
    localStorage.setItem('sala', salaId);
    
    if (typeof window.generarTablero === 'function') window.generarTablero();
    
    const salaRef = window.getSafeRef('salas/' + salaId + '/jugadores');
    
    runTransaction(salaRef, (jugadores) => {
        if (!jugadores) jugadores = {};
        
        // Verificamos si ya existe el usuario para no duplicar ID
        const ocupados = Object.keys(jugadores).filter(k => !String(k).startsWith('v')).length;
        const visitantes = Object.keys(jugadores).filter(k => String(k).startsWith('v')).length;
        
        if (ocupados < 4 || visitantes < 3) {
            if (ocupados < 4) {
                window.miIdx = ocupados;
                window.esVisitante = false;
                jugadores[window.miIdx] = { 
                    nombre: window.nombres[window.miIdx], 
                    color: window.colores[window.miIdx], 
                    activo: true, 
                    dinero: 1500, 
                    tienePrestamo: false,
                    pos: 0,
                    seisSeguidos: 0
                };
            } else {
                window.miIdx = 'v' + (visitantes + 1);
                window.esVisitante = true;
                jugadores[window.miIdx] = { 
                    nombre: "Citizen " + (visitantes + 1), 
                    activo: true,
                    pos: 0
                };
            }
            return jugadores;
        }
        return;
    }).then((res) => {
        // Desbloqueamos proceso independientemente del resultado
        window.estaProcesandoUnion = false;

        if (res.committed && window.miIdx !== undefined) {
            localStorage.setItem('miIdx', window.miIdx);
            localStorage.setItem('esVisitante', window.esVisitante);
            
            setTimeout(() => {
                window.sincronizar(); 
                if (typeof window.escucharJugadores === 'function') window.escucharJugadores();
                if (typeof window.escucharTurno === 'function') window.escucharTurno();
                if (typeof window.escucharOfertas === 'function') window.escucharOfertas();
            }, 300);
            
            const nombreMostrar = window.esVisitante ? "Citizen " + String(window.miIdx).replace('v','') : window.nombres[window.miIdx];
            
            const chatRef = window.getSafeRef('salas/' + salaId + '/chat');
            if (chatRef) {
                // Notificación de unión
                push(chatRef, { 
                    n: "Sistema", 
                    m: nombreMostrar + " se ha unido a la partida.", 
                    t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    esChat: true,
                    esRosa: true 
                });

                // Notificación de abandono (usamos un ID único temporal para el set)
                const miRef = window.getSafeRef('salas/' + salaId + '/jugadores/' + window.miIdx);
                const leaveMsgRef = child(chatRef, 'leave_' + Date.now()); 
                
                if (miRef) {
                    onDisconnect(miRef).remove();
                    onDisconnect(leaveMsgRef).set({ 
                        n: "Sistema", 
                        m: nombreMostrar + " ha abandonado la partida.", 
                        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        esChat: true,
                        esRosa: true 
                    });
                }
            }

            window.abrirModal("Bienvenido", `
                <div style="text-align:center; padding:10px;">
                    <p>Lograste entrar al juego como <b>${nombreMostrar}</b>.</p>
                    <button class="btn-sidebar" style="width:100%; margin-top:10px;" onclick="window.cerrarModal()">Comenzar</button>
                </div>
            `);
        } else {
            window.abrirModal("Sala Llena", `<div style="text-align:center; padding:10px; color: #d32f2f;">Lo sentimos, la sala <b>${salaId}</b> está llena.</div>`);
        }
    }).catch((error) => {
        window.estaProcesandoUnion = false;
        console.error("Error al unirse a la sala:", error);
    });
};

window.enviarMensaje = function() {
    const input = document.getElementById('chat-msg');
    const mensaje = input.value.trim();
    
    if (mensaje === "" || !window.sala || window.miIdx === undefined) return;

    const nombre = window.esVisitante ? "Citizen " + String(window.miIdx).replace('v','') : window.nombres[window.miIdx];
    
    push(ref(db, 'salas/' + window.sala + '/chat'), {
        n: nombre,
        m: mensaje,
        t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }).then(() => input.value = "");
};

window.mostrarAvisoReputacion = () => window.abrirModal("Reputación", "<p>Tu nivel en Naeun Town es: <b>Estrella Naciente</b></p>");
// Listener para enviar mensaje con la tecla ENTER
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-msg');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Evita saltos de línea
                window.enviarMensaje(); // Llama a tu función de envío
            }
        });
    }
});

// --- CONFIGURACIÓN DEL EVENTO DEL DADO ---
(function() {
    const configurarDado = () => {
        const dice = document.getElementById('dice');
        if (dice) {
            // Eliminar listeners previos clonando el nodo
            const nuevoDice = dice.cloneNode(true);
            dice.parentNode.replaceChild(nuevoDice, dice);
            
            // Asignar el evento único
            nuevoDice.onclick = function(e) {
                e.stopPropagation(); // Evita que se dispare dos veces
                if (typeof window.tirarDado === 'function') {
                    window.tirarDado();
                }
            };
            console.log("Evento del dado configurado: Control único centralizado.");
        } else {
            setTimeout(configurarDado, 1000);
        }
    };
    configurarDado();
})();

window.generarTablero();

