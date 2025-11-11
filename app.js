/* === CONFIG === */
const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let estado = {
    vendedor: "",
    nombre: "",
    ruta: [],
    motivoSeleccionado: "",
    ubicacionActual: null
};
let map, markers;

/* === INICIO SEGURO & EVENTOS GLOBALES === */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App iniciada");
    
    // Intentamos iniciar Firebase (si los scripts cargaron)
    try { initFirebase(); } catch (e) { console.warn("Firebase bloqueado:", e); }
    
    checkSesion();
    initTheme();

    // Event Listeners
    document.getElementById("btnIngresar").addEventListener("click", login);
    document.getElementById("claveInput").addEventListener("keyup", (e) => e.key === "Enter" && login());
    document.getElementById("fabMapa").addEventListener("click", toggleMapa);
    document.getElementById("btnCerrarMapa").addEventListener("click", toggleMapa);
    document.getElementById("listaClientes").addEventListener("click", manejarClicksLista);
    
    // Eventos Modales
    document.getElementById("btnCancelarModal").addEventListener("click", cerrarModalCliente);
    document.getElementById("btnIrCliente").addEventListener("click", irACliente);
    
    // Eventos Motivos
    document.getElementById("overlay-motivo").addEventListener("click", cerrarMotivo);
    document.getElementById("btnConfirmarMotivo").addEventListener("click", confirmarMotivo);
    document.getElementById("motivoOptions").addEventListener("click", manejarMotivoChips);

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener("click", () => setTheme(btn.dataset.theme));
    });
});

/* === FIREBASE === */
let messaging;
function initFirebase() {
    if (typeof firebase === 'undefined') return;
    firebase.initializeApp({
        apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
        authDomain: "app-vendedores-inteligente.firebaseapp.com",
        projectId: "app-vendedores-inteligente",
        storageBucket: "app-vendedores-inteligente.appspot.com",
        messagingSenderId: "583313989429",
        appId: "1:583313989429:web:c4f78617ad957c3b11367c"
    });
    messaging = firebase.messaging();
}

/* === FUNCIONES PRINCIPALES === */
async function login() {
    const clave = document.getElementById("claveInput").value.trim();
    if (!clave) return toast("⚠️ Ingresa tu clave");

    btnLoading(true);
    try {
        await obtenerUbicacion(); // Obtener ubicación para cálculo de distancia
        
        const res = await fetch(`${API}?accion=getRutaDelDia&clave=${clave}&t=${Date.now()}`);
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Clave incorrecta o error de servidor");

        estado.vendedor = clave.padStart(4, "0");   // Siempre 4 dígitos: 0001, 0002...
        estado.nombre = data.vendedor || "Vendedor";
        estado.ruta = data.cartera.map(c => ({ ...c, visitado: false }));
        
        localStorage.setItem("vendedor_sesion", JSON.stringify({ clave: estado.vendedor, nombre: estado.nombre }));
        localStorage.setItem("vendedor_actual", estado.vendedor);

        
        iniciarApp();
        activarNotificaciones().catch(e => console.warn("Notificaciones fallaron:", e)); // Activación de Notificaciones

    } catch (e) {
        console.error(e);
        toast("❌ Error: " + e.message);
    } finally {
        btnLoading(false);
    }
}

function checkSesion() {
    try {
        const sesion = JSON.parse(localStorage.getItem("vendedor_sesion"));
        if (sesion && sesion.clave) document.getElementById("claveInput").value = sesion.clave;
    } catch (e) { localStorage.removeItem("vendedor_sesion"); }
}



function obtenerUbicacion() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                estado.ubicacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                ordenarRutaPorDistancia();
                resolve();
            },
            () => resolve(), // Resuelve aunque falle
            { enableHighAccuracy: false, timeout: 5000 }
        );
    });
}

/* === SEGUIMIENTO GPS EN TIEMPO REAL (ACTIVO DURANTE LA RUTA) === */
let gpsWatcher = null;
let clientesAvisados = new Set(); // Para no mandar notificación repetida

function iniciarSeguimientoGPS() {
    if (!navigator.geolocation) return;

    gpsWatcher = navigator.geolocation.watchPosition(
         (pos) => {
    estado.ubicacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    ordenarRutaPorDistancia();   // ← 🔥 Ordena automáticamente en tiempo real
    verificarProximidadClientes();
},

        },
        (err) => console.warn("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 7000 }
    );
}

function verificarProximidadClientes() {
    if (!estado.ubicacionActual) return;

    estado.ruta.forEach((c) => {
        if (!c.lat || !c.lng) return; // Sin coordenadas → se ignora
        if (c.visitado) return; // Ya visitado → no avisar
        if (clientesAvisados.has(c.numeroCliente)) return; // Ya avisado → no repetir

        const dist = calcularDistancia(
            estado.ubicacionActual.lat,
            estado.ubicacionActual.lng,
            c.lat,
            c.lng
        ) * 1000; // Km → metros

        if (dist <= 120) { // 120 metros
            clientesAvisados.add(c.numeroCliente);

            // 📣 ENVÍA NOTIFICACIÓN PUSH DESDE EL SERVER
            fetch(API, {
                method: "POST",
                body: JSON.stringify({
                    accion: "enviarPush",
                    vendedor: estado.vendedor,
                    titulo: "🛎️ Estás llegando",
                    mensaje: `Prepárate para ${c.nombre}`
                })
            }).catch(() => console.warn("No se pudo enviar push"));
            
            toast(`📍 Estás cerca de: ${c.nombre}`);
        }
    });
}

/* Llamar seguimiento al iniciar la app */
function iniciarApp() {
    document.getElementById("view-login").classList.remove("active");
    void document.getElementById("view-app").offsetWidth;
    document.getElementById("view-app").classList.add("active");
    document.getElementById("vendedorNombre").innerText = estado.nombre;
    renderRuta();
    actualizarProgreso();
    
    iniciarSeguimientoGPS(); // ← 🔥 ACTIVAMOS SEGUIMIENTO CONTINUO
}


// --- FUNCIÓN DE ACCIÓN Y UX ---
function manejarClicksLista(e) {
    const card = e.target.closest('.card');
    const btnVenta = e.target.closest('.btn-venta');
    const btnNoVenta = e.target.closest('.btn-noventa');

    if (!card) return;
    const index = parseInt(card.dataset.i);

    if (btnVenta) {
        // VENTA (si toca el botón)
        registrarVenta(index, true);
    } else if (btnNoVenta) {
        // MOTIVO (si toca el botón)
        abrirMotivo(index);
    } else {
        // CLICK EN TARJETA (abrir modal cliente o expandir acciones)
        if (estado.ruta[index].visitado) {
            // Si ya está visitado, solo expandir para ver notas
            card.classList.toggle('expanded');
        } else if(card.classList.contains('expanded')) {
            // Si está expandido y toca, lo cerramos
            card.classList.remove('expanded');
        } else {
            // Si no está visitado y no está expandido, abrir modal de detalle/navegación
            abrirModalCliente(index);
        }
    }
}


/* === RENDER UI (CON DISTANCIA Y FRECUENCIA) === */
function renderRuta() {
    const container = document.getElementById("listaClientes");
    container.innerHTML = ""; 

    estado.ruta.forEach((c, i) => {
        let distanciaHTML = "";
        if (estado.ubicacionActual && c.lat && c.lng) {
            const dist = calcularDistancia(estado.ubicacionActual.lat, estado.ubicacionActual.lng, c.lat, c.lng);
            distanciaHTML = `<div class="distancia-badge">🚗 ${(dist * 2).toFixed(0)}min (${dist.toFixed(1)}km)</div>`;
        }
        
        const frecuenciaTexto = c.frecuencia || "Sin historial previo";

        const card = document.createElement('div');
        card.className = `card ${c.visitado ? 'visitado' : ''} ${c.visitado ? (c.compro ? 'compro-si' : 'compro-no') : ''}`;
        card.dataset.i = i; 

        card.innerHTML = `
            ${distanciaHTML}
            <div class="card-header">
                <h3>${c.nombre}</h3>
                <span class="badge ${c.visitado ? (c.compro ? 'si' : 'no') : 'pendiente'}">
                    ${c.visitado ? (c.compro ? 'VENTA' : 'NO') : 'PENDIENTE'}
                </span>
            </div>
            <div class="card-body">
                <p>📍 ${c.domicilio}</p>
                <p>📊 Frecuencia: ${frecuenciaTexto}</p>
            </div>
            ${!c.visitado ? `
            <div class="card-actions">
                <button class="btn-action btn-venta" data-i="${i}">✅ VENTA</button>
                <button class="btn-action btn-noventa" data-i="${i}">❌ MOTIVO</button>
            </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

/* === MODAL CLIENTE & ÚLTIMO PEDIDO === */
let clienteModalIndex = null;

async function abrirModalCliente(index) {
    clienteModalIndex = index;
    const c = estado.ruta[index];
    
    document.getElementById("modal-cliente-nombre").innerText = c.nombre;
    document.getElementById("modal-cliente-direccion").innerText = c.domicilio;
    document.getElementById("modal-ultimo-pedido").innerText = "⌛ Cargando...";
    document.getElementById("btnCopiarPedido").classList.add("hidden");

    const modal = document.getElementById("modal-cliente");
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("active"), 10);

    try {
        const res = await fetch(`${API}?accion=getUltimoPedido&cliente=${c.numeroCliente}`);
        const data = await res.json();
        if (data.ok && data.ultimoPedido) {
            document.getElementById("modal-ultimo-pedido").innerText = `${data.ultimoPedido.fecha}\n${data.ultimoPedido.texto}`;
            const btnCopiar = document.getElementById("btnCopiarPedido");
            btnCopiar.classList.remove("hidden");
            btnCopiar.onclick = () => {
                navigator.clipboard.writeText(data.ultimoPedido.texto);
                toast("📋 ¡Pedido copiado!");
            };
        } else {
            document.getElementById("modal-ultimo-pedido").innerText = "Sin pedidos recientes.";
        }
    } catch (e) {
        document.getElementById("modal-ultimo-pedido").innerText = "Error al cargar.";
    }
}

function cerrarModalCliente() {
    const modal = document.getElementById("modal-cliente");
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
}

function irACliente() {
    const c = estado.ruta[clienteModalIndex];
    if (c.lat && c.lng) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`, '_blank');
    } else {
        toast("⚠️ Cliente sin coordenadas");
    }
}


/* === MOTIVO NO COMPRA Y ACCIONES === */
async function registrarVenta(index, compro, motivo = "") {
    const cliente = estado.ruta[index];
    cliente.visitado = true; cliente.compro = compro; cliente.motivo = motivo;
    renderRuta(); actualizarProgreso();
    if (compro) toast("🎉 ¡Venta registrada!");

    fetch(API, {
        method: "POST",
        body: JSON.stringify({ accion: "registrarVisita", vendedor: estado.nombre, cliente: cliente.numeroCliente, compro, motivo })
    }).catch(() => toast("⚠️ Guardado local"));
}

let clienteMotivoIndex = null;
function abrirMotivo(index) {
    clienteMotivoIndex = index;
    estado.motivoSeleccionado = "";
    document.querySelectorAll('#motivoOptions .chip').forEach(c => c.classList.remove('selected'));
    document.getElementById("motivoOtro").classList.add("hidden");
    document.getElementById("sheet-motivo").classList.remove("hidden");
    setTimeout(() => document.getElementById("sheet-motivo").classList.add("active"), 10);
}

function cerrarMotivo() {
    document.getElementById("sheet-motivo").classList.remove("active");
    setTimeout(() => document.getElementById("sheet-motivo").classList.add("hidden"), 300);
}

function manejarMotivoChips(e) {
    if (!e.target.classList.contains('chip')) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    e.target.classList.add('selected');
    estado.motivoSeleccionado = e.target.dataset.val;
    document.getElementById("motivoOtro").classList.toggle("hidden", estado.motivoSeleccionado !== "Otro");
}

function confirmarMotivo() {
    let motivo = estado.motivoSeleccionado;
    if (!motivo) return toast("⚠️ Selecciona un motivo");
    if (motivo === "Otro") motivo = document.getElementById("motivoOtro").value.trim();
    if (!motivo) return toast("⚠️ Escribe el motivo");
    
    registrarVenta(clienteMotivoIndex, false, motivo);
    cerrarMotivo();
}

async function activarNotificaciones() {
    console.log("TOKEN DEBUG: === INICIO activarNotificaciones() ===");

    // 0) Validación base
    if (typeof firebase === 'undefined' || !messaging) {
        console.error("TOKEN DEBUG: 0. ❌ Firebase o messaging NO cargaron. Revisa index.html y el orden de scripts.");
        return;
    }

    const VAPID_KEY = "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o";

    try {
        console.log("TOKEN DEBUG: 1. Solicitando permiso de notificaciones...");
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.warn("TOKEN DEBUG: 2. ❌ Permiso DENEGADO. No se genera token.");
            return;
        }

        console.log("TOKEN DEBUG: 2. ✅ Permiso concedido.");

        // 🚨 Punto clave: aseguramos ServiceWorker listo antes de pedir token
        console.log("TOKEN DEBUG: 3. Esperando a que ServiceWorker esté listo...");
        const reg = await navigator.serviceWorker.ready;
        console.log("TOKEN DEBUG: 3A. ✅ ServiceWorker listo:", reg.scope);

        // ✅ getToken CORRECTO
        console.log("TOKEN DEBUG: 4. Intentando generar token con VAPID + SW...");
        const token = await messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: reg
        }).catch(err => {
            console.error("TOKEN DEBUG: 4A. ❌ ERROR EN getToken():", err);
            return null;
        });

        if (!token) {
            console.error("TOKEN DEBUG: 4B. ❌ Token NULL. No continúa.");
            return;
        }

        console.log("TOKEN DEBUG: 5. ✅ Token generado:", token.substring(0, 35) + "...");

        // Ver si ya estaba guardado
        const tokenPrevio = localStorage.getItem("fcm_token_enviado");
        const vendedorPrevio = localStorage.getItem("vendedor_actual");

        if (token === tokenPrevio && estado.vendedor === vendedorPrevio) {
            console.log("TOKEN DEBUG: 6. Token repetido → No se envía. (OK)");
            return;
        }

        console.log("TOKEN DEBUG: 6. Token NUEVO → enviando a servidor...");

        const res = await fetch(API, {
            method: "POST",
            body: JSON.stringify({
                accion: "registrarToken",
                vendedor: estado.vendedor,
                token: token,
                dispositivo: navigator.userAgent
            })
        });

        if (!res.ok) {
            console.error("TOKEN DEBUG: 7. ❌ Error guardando token en API:", await res.text());
            return;
        }

        console.log("TOKEN DEBUG: 7. ✅ Token guardado en servidor.");
        localStorage.setItem("fcm_token_enviado", token);
        localStorage.setItem("vendedor_actual", estado.vendedor);

        toast("🔔 Notificaciones activadas");
        console.log("TOKEN DEBUG: === FIN activarNotificaciones() ===");

    } catch (err) {
        console.error("TOKEN DEBUG: ❌ ERROR GENERAL activarNotificaciones():", err);
    }
}


/* === MAPA & UTILIDADES === */
function toggleMapa() {
    const modal = document.getElementById("modal-mapa");
    if (modal.classList.contains("hidden")) {
        modal.classList.remove("hidden");
        if (!map && typeof L !== 'undefined') {
            map = L.map('map').setView([-34.6, -58.4], 10);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '©OpenStreetMap' }).addTo(map);
            markers = L.layerGroup().addTo(map);
        }
        if (map) setTimeout(() => { map.invalidateSize(); cargarMarcadores(); }, 200);
    } else {
        modal.classList.add("hidden");
    }
}

function cargarMarcadores() {
    if (!map || !markers) return;
    markers.clearLayers();
    const grupo = [];
    estado.ruta.forEach((c, i) => {
        if (c.lat && c.lng) {
            const color = c.visitado ? (c.compro ? '#2ED573' : '#FF4757') : '#4CC9F0';
            const marker = L.circleMarker([c.lat, c.lng], { radius: 10, fillColor: color, color: '#fff', weight: 3, fillOpacity: 1 }).addTo(markers);

            // Alerta: Conecta el mapa con el modal del cliente
            marker.on('click', () => {
                document.getElementById("modal-mapa").classList.add("hidden");
                abrirModalCliente(i);
            });

            grupo.push([c.lat, c.lng]);
        }
    });
    if (grupo.length) map.fitBounds(grupo, { padding: [50, 50] });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function ordenarRutaPorDistancia() {
    if (!estado.ubicacionActual) return;

    const { lat, lng } = estado.ubicacionActual;

    // Ordena: primero pendientes por proximidad, luego visitados
    estado.ruta.sort((a, b) => {
        if (a.visitado && !b.visitado) return 1;
        if (!a.visitado && b.visitado) return -1;

        if (!a.lat || !a.lng) return 1;
        if (!b.lat || !b.lng) return -1;

        const dA = calcularDistancia(lat, lng, a.lat, a.lng);
        const dB = calcularDistancia(lat, lng, b.lat, b.lng);
        return dA - dB;
    });

    renderRuta();
}


function actualizarProgreso() {
    const total = estado.ruta.length;
    const visitados = estado.ruta.filter(c => c.visitado).length;
    const porc = total === 0 ? 0 : (visitados / total) * 100;
    const circle = document.querySelector('.progreso-value');
    if (circle) circle.style.strokeDashoffset = 100 - porc;
    document.getElementById("progreso-texto").innerText = `${visitados}/${total}`;
    document.getElementById("mensajeCoach").innerText = porc === 100 ? "🎉 ¡Ruta finalizada!" : `${estado.nombre.split(' ')[0]}, ¡vamos por más!`;
}

function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000);
}
function btnLoading(isLoading) {
    const btn = document.getElementById("btnIngresar"); btn.disabled = isLoading; btn.innerHTML = isLoading ? "⌛..." : "INGRESAR";
}
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme); localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}
function initTheme() { setTheme(localStorage.getItem('theme') || 'foco'); }
