// main.js (Versión con Misiones y Banco integrados)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, child, get, set, runTransaction, update, onValue, push, onDisconnect, off } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js'; 

// 1. Inicialización
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

// Configuración Global
window.nombres = ["Dog", "Horse", "Hat", "Car"];
window.colores = ["#ffb7b2", "#baa695", "#c2f0c9", "#c2ddf2"];
let chatListener; // Listener global para el chat

// --- DEFINICIÓN DE SINCRONIZAR  ---
window.sincronizar = function() {
    if (!window.sala) return;

    // --- 1. Sincronización del Chat ---
    const chatRef = ref(db, 'salas/' + window.sala + '/chat');
    if (chatListener) off(chatRef);

    chatListener = onValue(chatRef, (snap) => {
        const chatLog = document.getElementById('chat-log');
        if (!chatLog) return;
        
        chatLog.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.values(data).forEach(m => {
                const estilo = m.n === "Sistema" ? "color: #ff80bf; font-style: italic; font-size: 0.8em;" : "color: #333;";
                chatLog.innerHTML += `<div style="${estilo} margin-bottom: 5px;"><small>[${m.t}]</small> <b>${m.n}:</b> ${m.m}</div>`;
            });
            chatLog.scrollTop = chatLog.scrollHeight;
        }
    });

    // --- 2. Sincronización del Clima ---
    const climaRef = ref(db, 'salas/' + window.sala + '/climaIdx');
    onValue(climaRef, (snap) => {
        const idx = snap.val() !== null ? snap.val() : 0;
        const clima = window.climas[idx];
        
        // Actualizar centro del tablero
        const centroClima = document.getElementById('display-clima-centro');
        if (centroClima) {
            centroClima.innerHTML = `
                <div style="font-size: 1.1em; font-weight:bold; color: #333;">${clima.n}</div>
                <div style="font-size: 0.8em; color: ${clima.mult < 1 ? '#e74c3c' : '#27ae60'};">
                    Mult: ${clima.mult}x
                </div>
            `;
        }
    });

    // --- 3. Iniciar Ciclo Automático (Solo si es el primer jugador o dueño) ---
    // Verificamos si somos el dueño de la sala (idx 0) para ejecutar el timer
    if (window.miIdx === 0 || window.miIdx === "0") {
        window.iniciarCicloClima();
    }
};

// Función auxiliar para el ciclo automático
window.iniciarCicloClima = function() {
    // Evitar múltiples intervalos si se llama varias veces
    if (window.climaInterval) clearInterval(window.climaInterval);
    
    window.climaInterval = setInterval(() => {
        const controlRef = ref(db, 'salas/' + window.sala + '/controladorClima');
        get(controlRef).then(snap => {
            const ctrl = snap.val();
            const ahora = Date.now();
            
            // Si el control está libre o pasaron más de 5 min (300,000ms), el sistema cambia
            if (!ctrl || (ahora - ctrl.timestamp > 300000)) {
                const nuevoIdx = Math.floor(Math.random() * window.climas.length);
                const nuevoClima = window.climas[nuevoIdx];
                
                set(ref(db, 'salas/' + window.sala + '/climaIdx'), nuevoIdx);
                push(ref(db, 'salas/' + window.sala + '/chat'), {
                    n: "Sistema",
                    m: `El clima ha cambiado automáticamente a ${nuevoClima.n}. Alquileres ajustados a ${nuevoClima.mult * 100}%.`,
                    t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        });
    }, 600000); // 10 minutos
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

// --- Lógica del clima ---
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

window.iniciarCicloClima = function() {
    const climaRef = ref(db, 'salas/' + window.sala + '/climaIdx');
    const controlRef = ref(db, 'salas/' + window.sala + '/controladorClima');

    setInterval(() => {
        // Verificar si hay alguien controlándolo
        get(controlRef).then(snap => {
            const ctrl = snap.val();
            const ahora = Date.now();
            
            // Si el control está libre o expiró, el sistema toma el mando
            if (!ctrl || (ahora - ctrl.timestamp > 300000)) {
                const nuevoIdx = Math.floor(Math.random() * window.climas.length);
                set(climaRef, nuevoIdx).then(() => {
                    const nuevoClima = window.climas[nuevoIdx];
                    window.log("Sistema: El clima cambió automáticamente a " + nuevoClima.n);
                });
            }
        });
    }, 600000); // 10 minutos
};

window.abrirControlClima = function() {
    let html = `<div class="clima-container">
        <p>Selecciona el nuevo clima para Naeun Town:</p>`;
    
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
            // En lugar de un alert, abrimos nuestro nuevo panel estilizado
            window.abrirControlClima();
        } else {
            window.abrirModal("Acceso Denegado", "<p>Otro visitante ya tiene el control del clima en este momento.</p>");
        }
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

    get(ref(db, 'salas/' + window.sala)).then((snap) => {
        const data = snap.val();
        const climaIdx = data.climaIdx || 0;
        const prop = data.propiedades ? data.propiedades[pos] : null;
        const clima = window.climas[climaIdx];
        const mult = clima.mult;

        const niveles = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5];
        const nivel = prop ? (prop.nivel || 0) : 0;
        const alquiler = Math.floor((p.p * niveles[nivel]) * mult);
        
        const esDuenio = prop && prop.owner === window.miIdx;
        const estaHipotecada = prop && prop.hipotecada;
        
        // Estilos para el clima
        const colorClima = mult < 1 ? '#e74c3c' : '#27ae60';
        const infoClima = mult < 1 ? ' (Descuento aplicado)' : '';

        // Generación de lista de niveles de alquiler
        let listaAlquileres = niveles.map((n, i) => 
            `<li style="margin: 3px 0;">Nivel ${i + 1}: $${Math.floor(p.p * n * mult)}</li>`
        ).join('');

        // Construcción de la tarjeta estilo Monopoly manteniendo toda la info
        let contenido = `
            <div class="card-property">
                <div class="card-header">${p.n}</div>
                <div class="card-body">
                    <p>Valor de compra: <b>$${p.p}</b></p>
                    <div class="alquiler-destacado" style="color: ${colorClima}; font-size: 1.2em; font-weight: bold;">
                        Alquiler actual: $${estaHipotecada ? 0 : alquiler}
                    </div>
                    <p style="font-size: 0.85em;">Clima: ${clima.n}${infoClima}</p>
                    <hr>
                    <p><b>Detalle de alquileres:</b></p>
                    <ul style="text-align: left; font-size: 0.9em; padding-left: 20px;">
                        ${listaAlquileres}
                    </ul>
                    <hr>`;

        // Lógica de botones y estado
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
        
        push(ref(db, 'salas/' + salaId + '/chat'), { 
            n: "Sistema", 
            m: "Dog ha creado la sala.", 
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
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
    window.sala = salaId;
    localStorage.setItem('sala', salaId);
    
    const salaRef = ref(db, 'salas/' + salaId + '/jugadores');
    
    runTransaction(salaRef, (jugadores) => {
        if (!jugadores) jugadores = {};
        const ocupados = Object.keys(jugadores).filter(k => !String(k).startsWith('v')).length;
        const visitantes = Object.keys(jugadores).filter(k => String(k).startsWith('v')).length;
        
        if (ocupados < 4) {
            window.miIdx = ocupados;
            window.esVisitante = false;
            jugadores[window.miIdx] = { 
                nombre: window.nombres[window.miIdx], 
                color: window.colores[window.miIdx], 
                activo: true, dinero: 1500, tienePrestamo: false 
            };
        } else if (visitantes < 3) {
            window.miIdx = 'v' + (visitantes + 1);
            window.esVisitante = true;
            jugadores[window.miIdx] = { nombre: "Citizen " + (visitantes + 1), activo: true };
        } else {
            return;
        }
        return jugadores;
    }).then((res) => {
        if (res.committed && window.miIdx !== undefined) {
            localStorage.setItem('miIdx', window.miIdx);
            localStorage.setItem('esVisitante', window.esVisitante);
            window.sincronizar();
            
            // Lógica de aviso en el chat
            const nombreMostrar = window.esVisitante ? "Citizen " + String(window.miIdx).replace('v','') : window.nombres[window.miIdx];
            push(ref(db, 'salas/' + salaId + '/chat'), { 
                n: "Sistema", 
                m: nombreMostrar + " se ha unido a la partida.", 
                t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            });

            // Configurar eliminación automática al salir
            const miRef = ref(db, 'salas/' + salaId + '/jugadores/' + window.miIdx);
            onDisconnect(miRef).remove();

            // Modal de bienvenida con estilo CSS
            window.abrirModal("Bienvenido", `
                <p>Lograste entrar al juego.</p>
                <button class="btn-sidebar" style="width:100%" onclick="window.cerrarModal()">Comenzar</button>
            `);
        }
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
        
        // Hacer la celda clicable y visualmente interactiva
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
