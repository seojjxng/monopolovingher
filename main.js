// main.js 
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set, runTransaction, update, onValue, push, onDisconnect, off } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

window.nombres = ["Dog", "Horse", "Hat", "Car"];
window.colores = ["#ffb7b2", "#baa695", "#c2f0c9", "#c2ddf2"];
let chatListener; 

window.anunciar = function(mensaje) {
    const logContainer = document.getElementById('game-log');
    if (logContainer) {
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        logContainer.innerHTML = `<div style="font-size: 0.85em; margin-bottom: 4px; border-bottom: 1px solid #ffccd5; padding-bottom: 2px;">[${t}] ${mensaje}</div>` + logContainer.innerHTML;
    }
};

window.generarTablero = function() {
    const board = document.getElementById('board');
    const centerZone = document.querySelector('.center-zone') || document.getElementById('center-zone'); 
    if (!board) return;
    
    board.innerHTML = '';
    if (centerZone) board.appendChild(centerZone);
    
    mapa.forEach((casilla, i) => {
        const d = document.createElement('div');
        d.className = 'celda-juego';
        d.id = 'cell-' + i;
        d.style.gridColumn = getGridColumn(i);
        d.style.gridRow = getGridRow(i);
        d.style.cursor = "pointer";
        d.onclick = () => window.verPropiedad(i);
        
        let grupo = grupos.find(g => g.indices.includes(i));
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

window.actualizarTokens = function(jugadores) {
    // 1. Ocultar todos los tokens existentes antes de reposicionarlos
    document.querySelectorAll('.token').forEach(t => t.style.display = 'none');

    // 2. Posicionar tokens
    Object.keys(jugadores).forEach(idx => {
        const j = jugadores[idx];
        const celda = document.getElementById(`cell-${j.pos}`);
        if (!celda) return;

        let token = document.getElementById(`token-${idx}`);
        if (!token) {
            token = document.createElement('img');
            token.id = `token-${idx}`;
            token.className = "token";
            const fuentes = [
                "https://i.imgur.com/FGnMi8Y.png", 
                "https://i.imgur.com/fRZJfP8.png", 
                "https://i.imgur.com/u2AtssG.png", 
                "https://i.imgur.com/ekQp8WL.png"
            ];
            token.src = fuentes[idx % fuentes.length];
            document.body.appendChild(token);
        }
        celda.appendChild(token);
        token.style.display = "block";
    });
};

window.escucharJugadores = function() {
    if (!window.sala) return;
    const jugadoresRef = ref(db, 'salas/' + window.sala + '/jugadores');
    onValue(jugadoresRef, (snap) => {
        const jugadores = snap.val();
        if (jugadores) {
            window.actualizarTokens(jugadores);
        }
    });
};

window.sincronizar = function() {
    if (!window.sala) return;

    const chatRef = ref(db, 'salas/' + window.sala + '/chat');
    if (chatListener) off(chatRef);

    chatListener = onValue(chatRef, (snap) => {
        const chatLog = document.getElementById('chat-log');
        const gameLog = document.getElementById('game-log'); 
        
        // Limpiamos los contenedores antes de procesar para evitar duplicados
        if (chatLog) chatLog.innerHTML = "";
        if (gameLog) gameLog.innerHTML = ""; 
        
        const data = snap.val();
        
        if (data) {
            Object.values(data).forEach(m => {
                // FILTRO: Si es sistema Y NO está marcado como chat, va al Game Log
                if (m.n === "Sistema" && !m.esChat) {
                    if (gameLog) {
                        gameLog.innerHTML += `<div style="font-size: 0.85em; margin-bottom: 4px; border-bottom: 1px solid #ffccd5; padding-bottom: 2px;">[${m.t}] ${m.m}</div>`;
                    }
                } 
                // CUALQUIER OTRA COSA (Jugadores o Sistema marcado como chat) va al Chat Log
                else {
                    if (chatLog) {
                        // Aplicamos color rosa si tiene la propiedad esRosa
                        const colorEstilo = m.esRosa ? "#ff80bf" : "#333";
                        const nombreDisplay = m.n === "Info" ? "" : `<b>${m.n}:</b>`;
                        
                        chatLog.innerHTML += `<div style="color: ${colorEstilo}; margin-bottom: 5px; text-align: left;">
                            <small>[${m.t}]</small> ${nombreDisplay} ${m.m}
                        </div>`;
                    }
                }
            });
            
            // Scroll automático al final en ambos
            if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
            if (gameLog) gameLog.scrollTop = gameLog.scrollHeight;
        }
    });
};

// --- 1. Datos Globales del Clima ---
window.climas = Object.freeze([
    { n: "Primavera Soleada", mult: 1.0 },
    { n: "Primavera Lluviosa", mult: 1.0 },
    { n: "Verano Caluroso", mult: 1.0 },
    { n: "Verano Nublado", mult: 1.0 },
    { n: "Otoño Fresco", mult: 1.0 },
    { n: "Otoño Ventoso", mult: 1.0 },
    { n: "Lluvia Fuerte", mult: 0.7 },
    { n: "Tormenta Eléctrica", mult: 0.5 },
    { n: "Ventisca", mult: 0.6 },
    { n: "Nevada Intensa", mult: 0.6 },
    { n: "Tornado", mult: 0.5 }
]);

// --- 2. Sincronización (Listener único) ---
window.sincronizarClima = function() {
    if (!window.sala) return;
    const climaRef = ref(db, 'salas/' + window.sala + '/climaIdx');

    // Escucha principal para UI y anuncios de cambios
    onValue(climaRef, (snap) => {
        const idx = snap.val() !== null ? snap.val() : 0;
        const clima = window.climas[idx];
        const centroClima = document.getElementById('display-clima-centro');
        
        // 1. Actualizar UI central
        if (centroClima) {
            centroClima.innerHTML = `
                <div style="font-size: 1.1em; font-weight:bold; color: #333;">${clima.n}</div>
                <div style="font-size: 0.8em; color: ${clima.mult < 1 ? '#e74c3c' : '#27ae60'};">
                    Mult: ${clima.mult}x
                </div>`;
        }

        // 2. Anunciar en el historial solo si el clima ha cambiado
        // Guardamos el clima previo en una variable global para comparar
        if (window.climaPrevio !== undefined && window.climaPrevio !== idx) {
            window.anunciar("El clima ha cambiado a: " + clima.n);
        } else if (window.climaPrevio === undefined) {
            // Anuncio al entrar por primera vez
            window.anunciar("El clima actual es: " + clima.n);
        }
        
        window.climaPrevio = idx;
    });

    // Iniciar ciclo solo si es el dueño (idx 0)
    if (window.miIdx === 0 || window.miIdx === "0") {
        window.iniciarCicloClima();
    }
};

// --- 3. Lógica del Ciclo Automático ---
window.iniciarCicloClima = function() {
    if (window.climaInterval) clearInterval(window.climaInterval);
    
    window.climaInterval = setInterval(() => {
        const controlRef = ref(db, 'salas/' + window.sala + '/controladorClima');
        get(controlRef).then(snap => {
            const ctrl = snap.val();
            const ahora = Date.now();
            
            // Si el control está libre o pasaron más de 5 min, el sistema cambia
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

// --- 4. Panel de Control de Visitantes ---
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
        if (!data || (ahora - data.timestamp > 300000)) {
            return { usuario: window.miIdx, timestamp: ahora };
        }
        return; 
    }).then((res) => {
        if (res.committed) {
            window.abrirControlClima();
        } else {
            window.abrirModal("Acceso Denegado", "<p>Otro visitante ya tiene el control del clima en este momento.</p>");
        }
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

window.tirarDado = async function() {
    // 1. Verificación básica
    if (typeof window.miIdx === 'undefined' || window.miIdx === -1) return;

    const btnDado = document.querySelector('img[alt="Lanzar dado"]');
    
    // 2. Bloqueo inmediato para evitar clics dobles
    if (btnDado) btnDado.style.pointerEvents = 'none';

    return new Promise((resolve) => {
        // 3. Obtener estado de la sala
        get(ref(db, 'salas/' + window.sala)).then((snap) => {
            const s = snap.val();

            // 4. Validación estricta del turno: si no es mi turno, abortamos y liberamos el botón
            if (!s || s.turno !== window.miIdx) {
                console.warn("No es tu turno.");
                if (btnDado) btnDado.style.pointerEvents = 'auto';
                resolve();
                return;
            }

            // 5. Verificación de cárcel
            if (s.jugadores[window.miIdx].enCarcel > 0) {
                window.log(window.nombres[window.miIdx] + " está en la cárcel.");
                window.pasarTurno();
                if (btnDado) btnDado.style.pointerEvents = 'auto';
                resolve();
                return;
            }

            // 6. Lógica de clima (opcional)
            if (typeof window.climas !== 'undefined') {
                const nuevoClima = Math.floor(Math.random() * window.climas.length);
                set(ref(db, 'salas/' + window.sala + '/clima'), nuevoClima);
            }

            // 7. Lógica del dado
            const dado = Math.floor(Math.random() * 6) + 1;
            document.getElementById('dado-valor').innerText = dado;

            const contadorActual = s.jugadores[window.miIdx].seisSeguidos || 0;
            const nuevoContador = (dado === 6) ? contadorActual + 1 : 0;
            const posActual = Number(s.jugadores[window.miIdx].pos);
            const nuevaPos = (posActual + dado) % window.mapa.length;

            // 8. Paso por SALIDA
            if (nuevaPos < posActual) {
                runTransaction(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx + '/dinero'), (d) => (d || 0) + 100);
                window.log(window.nombres[window.miIdx] + " pasó por SALIDA y cobró $100.");
            }

            // 9. Actualización de estado y gestión de turno
            if (nuevoContador === 3) {
                window.log("¡ACUSACIÓN DE FRAUDE! " + window.nombres[window.miIdx] + " sacó tres 6.");
                update(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { pos: 9, enCarcel: 2, seisSeguidos: 0 });
                window.pasarTurno();
            } else {
                update(ref(db, 'salas/' + window.sala + '/jugadores/' + window.miIdx), { pos: nuevaPos, seisSeguidos: nuevoContador });
                
                // Si no sacó 6, pasamos turno automáticamente
                if (dado !== 6) {
                    window.pasarTurno();
                } else {
                    window.log("¡Sacaste un 6! Tienes turno extra.");
                }
            }

            // 10. Finalización de la animación y resolución de promesa
            setTimeout(() => {
                if (typeof window.manejarCasilla === 'function') window.manejarCasilla(nuevaPos);
                if (btnDado) btnDado.style.pointerEvents = 'auto';
                resolve();
            }, 800);
        }).catch((err) => {
            console.error("Error al tirar el dado:", err);
            if (btnDado) btnDado.style.pointerEvents = 'auto';
            resolve();
        });
    });
};

window.escucharTurno = function() {
    db.ref('salas/' + window.sala + '/turno').on('value', (snap) => {
        const turnoIdx = snap.val();
        const centroTablero = document.getElementById('centro-tablero'); // Asegúrate de tener este ID en tu HTML
        
        if (centroTablero) {
            const nombreTurno = window.nombres[turnoIdx] || "Desconocido";
            centroTablero.innerHTML = `<h3>Turno de:</h3><div style="color:${window.colores[turnoIdx]}">${nombreTurno}</div>`;
        }

        // Habilitar/Deshabilitar botón de dado
        const btnDado = document.querySelector('img[alt="Lanzar dado"]');
        if (btnDado) {
            btnDado.style.pointerEvents = (turnoIdx === window.miIdx) ? 'auto' : 'none';
            btnDado.style.opacity = (turnoIdx === window.miIdx) ? '1' : '0.5';
        }
    });
};

window.pasarTurno = function() {
    const salaRef = ref(db, 'salas/' + window.sala);
    
    get(salaRef).then((snap) => {
        const s = snap.val();
        if (!s || !s.jugadores) return;

        // Calculamos el total basándonos en las claves de los jugadores
        const jugadoresKeys = Object.keys(s.jugadores);
        const totalJugadores = jugadoresKeys.length;
        
        // Obtenemos el turno actual, por defecto 0 si no existe
        const turnoActual = s.turno || 0;
        
        // Lógica de turno cíclico
        const siguienteTurno = (turnoActual + 1) % totalJugadores;
        
        // Actualizamos en Firebase
        update(salaRef, {
            turno: siguienteTurno
        });
        
        // Log informativo
        const nombreSiguiente = s.jugadores[siguienteTurno]?.nombre || ("Jugador " + siguienteTurno);
        window.log("Turno de: " + nombreSiguiente);
    }).catch((error) => {
        console.error("Error al pasar el turno:", error);
    });
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

    // Usamos 'push' con 'ref'
    push(ref(db, 'salas/' + window.sala + '/ofertas'), {
        de: window.miIdx,
        para: destino,
        propiedad: pIdx,
        precio: valor,
        estado: 'pendiente'
    });

    alert("Oferta enviada a " + window.nombres[destino]);
    window.cerrarModal();
};

window.escucharOfertas = function() {
    if (!window.sala) return;
    
    const ofertasRef = ref(db, 'salas/' + window.sala + '/ofertas');
    
    onChildAdded(ofertasRef, (snap) => {
        const o = snap.val();
        const key = snap.key;

        if (o && o.para == window.miIdx && o.estado === 'pendiente') {
            const nombreVendedor = window.nombres[o.de] || "Jugador " + o.de;
            window.abrirModal("¡Oferta de Venta!", `
                <p>${nombreVendedor} te ofrece la propiedad ${o.propiedad} por <b>$${o.precio}</b></p>
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
window.unirseSala = function(salaId) {
    // 1. Inicialización de variables
    window.sala = salaId;
    localStorage.setItem('sala', salaId);
    
    // 2. Generar el tablero visual ANTES de procesar los datos de Firebase
    if (typeof window.generarTablero === 'function') {
        window.generarTablero();
    }
    
    const salaRef = ref(db, 'salas/' + salaId + '/jugadores');
    
    runTransaction(salaRef, (jugadores) => {
        if (!jugadores) jugadores = {};
        
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
                    activo: true 
                };
            }
            return jugadores;
        } else {
            return;
        }
    }).then((res) => {
        if (res.committed && window.miIdx !== undefined) {
            localStorage.setItem('miIdx', window.miIdx);
            localStorage.setItem('esVisitante', window.esVisitante);
            
            // 3. Iniciar todos los listeners de datos necesarios
            window.sincronizar();         // Chat
            window.sincronizarClima();    // Clima (AÑADIDO)
            window.escucharJugadores();   // Tokens
            
            if (typeof window.escucharOfertas === 'function') {
                window.escucharOfertas();
            }
            
            const nombreMostrar = window.esVisitante ? "Citizen " + String(window.miIdx).replace('v','') : window.nombres[window.miIdx];
            
            // 4. Mensajes y desconexión
            push(ref(db, 'salas/' + salaId + '/chat'), { 
                n: "Sistema", 
                m: nombreMostrar + " se ha unido a la partida.", 
                t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            });

            const miRef = ref(db, 'salas/' + salaId + '/jugadores/' + window.miIdx);
            const chatRef = ref(db, 'salas/' + salaId + '/chat');
            
            onDisconnect(miRef).remove();
            onDisconnect(chatRef).push({ 
                n: "Sistema", 
                m: nombreMostrar + " ha abandonado la partida.", 
                t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            });

            window.abrirModal("Bienvenido", `
                <div style="text-align:center; padding:10px;">
                    <p>Lograste entrar al juego como <b>${nombreMostrar}</b>.</p>
                    <button class="btn-sidebar" style="width:100%; margin-top:10px;" onclick="window.cerrarModal()">Comenzar</button>
                </div>
            `);
        } else {
            window.abrirModal("Sala Llena", `
                <div style="text-align:center; padding:10px; color: #d32f2f;">
                    <p>Lo sentimos, la sala <b>${salaId}</b> ya no tiene plazas disponibles.</p>
                    <button class="btn-sidebar" style="width:100%; margin-top:10px; background: #e74c3c;" onclick="window.cerrarModal()">Cerrar</button>
                </div>
            `);
        }
    }).catch((error) => {
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

window.generarTablero();
