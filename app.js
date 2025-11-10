/* === CONFIG === */
const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let estado = {
    vendedor: "",
    nombre: "",
    ruta: [],
    motivoSeleccionado: "",
    ubicacionActual: null // Nueva propiedad para guardar lat/lng del vendedor
};
let map, markers;

/* === INICIO SEGURO === */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App iniciada");
    try { initFirebase(); } catch (e) { console.warn("Firebase bloqueado:", e); }
    checkSesion();
    initTheme();

    // Event Listeners
    document.getElementById("btnIngresar").addEventListener("click", login);
    document.getElementById("claveInput").addEventListener("keyup", (e) => e.key === "Enter" && login());
    document.getElementById("fabMapa").addEventListener("click", toggleMapa);
    document.getElementById("btnCerrarMapa").addEventListener("click", toggleMapa);
    document.getElementById("listaClientes").addEventListener("click", manejarClicksLista);
    
    // Eventos Modales Nuevos
    document.getElementById("btnCancelarModal").addEventListener("click", cerrarModalCliente);
    document.getElementById("btnIrCliente").addEventListener("click", irACliente);
    document.getElementById("overlay-motivo").addEventListener("click", cerrarMotivo);
    document.getElementById("btnConfirmarMotivo").addEventListener("click", confirmarMotivo);
    // CERRAR MODAL AL TOCAR FUERA
    document.getElementById("modal-cliente").addEventListener("click", (e) => {
        // Si el target es exactamente el overlay (lo oscuro), cerramos.
        if (e.target.id === "modal-cliente") {
            cerrarModalCliente();
        }
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener("click", () => setTheme(btn.dataset.theme));
    });

    document.getElementById("motivoOptions").addEventListener("click", (e) => {
        if (!e.target.classList.contains('chip')) return;
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        e.target.classList.add('selected');
        estado.motivoSeleccionado = e.target.dataset.val;
        document.getElementById("motivoOtro").classList.toggle("hidden", estado.motivoSeleccionado !== "Otro");
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
        // Pedimos ubicación antes de cargar la ruta para tenerla lista
        await obtenerUbicacion();

        const res = await fetch(`${API}?accion=getRutaDelDia&clave=${clave}&t=${Date.now()}`);
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Clave incorrecta");

        estado.vendedor = clave;
        estado.nombre = data.vendedor || "Vendedor";
        estado.ruta = data.cartera.map(c => ({ ...c, visitado: false }));
        
        localStorage.setItem("vendedor_sesion", JSON.stringify({ clave, nombre: estado.nombre }));
        activarNotificaciones().catch(e => console.warn("Notificaciones off:", e));
        iniciarApp();

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

async function iniciarApp() {
    document.getElementById("view-login").classList.remove("active");
    void document.getElementById("view-app").offsetWidth; // Force reflow
    document.getElementById("view-app").classList.add("active");
    document.getElementById("vendedorNombre").innerText = estado.nombre;
    
    // Si no tenemos ubicación aún, la pedimos en segundo plano
    if (!estado.ubicacionActual) obtenerUbicacion().then(() => renderRuta());

    renderRuta();
    actualizarProgreso();
}

function obtenerUbicacion() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                estado.ubicacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                resolve();
            },
            (err) => { console.warn("Sin ubicación:", err); resolve(); },
            { enableHighAccuracy: false, timeout: 5000 }
        );
    });
}

/* === RENDER UI (CON DISTANCIA Y FRECUENCIA) === */
function renderRuta() {
    const container = document.getElementById("listaClientes");
    container.innerHTML = ""; 

    estado.ruta.forEach((c, i) => {
        let distanciaHTML = "";
        if (estado.ubicacionActual && c.lat && c.lng) {
            const dist = calcularDistancia(estado.ubicacionActual.lat, estado.ubicacionActual.lng, c.lat, c.lng);
            distanciaHTML = `<div class="distancia-badge">🚗 ${(dist*2).toFixed(0)}min (${dist.toFixed(1)}km)</div>`;
        }

        const card = document.createElement('div');
        card.className = `card ${c.visitado ? 'visitado' : ''} ${c.visitado ? (c.compro ? 'compro-si' : 'compro-no') : ''}`;
        card.dataset.i = i; // Para identificar click en la tarjeta
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
                <p>📊 Frecuencia: ${c.frecuencia || 0} compras</p>
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

function manejarClicksLista(e) {
    const card = e.target.closest('.card');
    const btnVenta = e.target.closest('.btn-venta');
    const btnNoVenta = e.target.closest('.btn-noventa');

    if (!card) return;

    if (btnVenta) {
        registrarVenta(parseInt(btnVenta.dataset.i), true);
    } else if (btnNoVenta) {
        abrirMotivo(parseInt(btnNoVenta.dataset.i));
    } else {
        // Click en la tarjeta (no en botones) -> Abrir modal cliente
        abrirModalCliente(parseInt(card.dataset.i));
    }
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
        toast("⚠️ Sin coordenadas");
    }
}

/* === ACCIONES & MOTIVOS === */
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
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    document.getElementById("motivoOtro").classList.add("hidden");
    document.getElementById("sheet-motivo").classList.remove("hidden");
    setTimeout(() => document.getElementById("sheet-motivo").classList.add("active"), 10);
}

function cerrarMotivo() {
    document.getElementById("sheet-motivo").classList.remove("active");
    setTimeout(() => document.getElementById("sheet-motivo").classList.add("hidden"), 300);
}

function confirmarMotivo() {
    let motivo = estado.motivoSeleccionado;
    if (!motivo) return toast("⚠️ Selecciona un motivo");
    if (motivo === "Otro") motivo = document.getElementById("motivoOtro").value.trim();
    if (!motivo) return toast("⚠️ Escribe el motivo");
    
    registrarVenta(clienteMotivoIndex, false, motivo);
    cerrarMotivo();
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
    estado.ruta.forEach((c, i) => { // ¡Importante! Necesitamos el índice 'i'
        if (c.lat && c.lng) {
            const color = c.visitado ? (c.compro ? '#2ED573' : '#FF4757') : '#4CC9F0';
            const marker = L.circleMarker([c.lat, c.lng], {
                radius: 10, // Un poco más grandes para tocar fácil
                fillColor: color,
                color: '#fff',
                weight: 3,
                fillOpacity: 1
            }).addTo(markers);

            // ALERTA: Esto conecta el mapa con el modal del cliente
            marker.on('click', () => {
                // Cerramos el mapa primero para ver el modal
                document.getElementById("modal-mapa").classList.add("hidden");
                // Abrimos el modal del cliente correspondiente
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

function actualizarProgreso() {
    const total = estado.ruta.length;
    const visitados = estado.ruta.filter(c => c.visitado).length;
    const porc = total === 0 ? 0 : (visitados / total) * 100;
    document.querySelector('.progreso-value').style.strokeDashoffset = 100 - porc;
    document.getElementById("progreso-texto").innerText = `${visitados}/${total}`;
    document.getElementById("mensajeCoach").innerText = porc === 100 ? "🎉 ¡Ruta finalizada!" : `${estado.nombre.split(' ')[0]}, ¡vamos por más!`;
}


async function activarNotificaciones() {
    if (!messaging) return;
    
    const VAPID_KEY = "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o";

    try {
        console.log("DEBUG: 1. Pidiendo permiso de Notificación..."); // LOG 1
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
            console.log("DEBUG: 2. Permiso concedido. Obteniendo token con VAPID..."); // LOG 2
            
            const token = await messaging.getToken({ vapidKey: VAPID_KEY }).catch((err) => {
                console.error("ERROR: Fallo getToken() con VAPID:", err); // LOG 3
                return null;
            });

            if (token) {
                console.log("DEBUG: 3. Token generado. Enviando a la API."); // LOG 4
                
                const tokenGuardado = localStorage.getItem("fcm_token_enviado");
                
                if (token !== tokenGuardado || estado.vendedor !== localStorage.getItem("vendedor_actual")) {
                    console.log("DEBUG: 4. Token NO duplicado. Iniciando fetch a API."); // LOG 5
                    await fetch(API, {
                        method: "POST",
                        body: JSON.stringify({ 
                            accion: "registrarToken", 
                            vendedor: estado.vendedor, 
                            token: token,
                            dispositivo: navigator.userAgent
                        })
                    });
                    
                    localStorage.setItem("fcm_token_enviado", token);
                    localStorage.setItem("vendedor_actual", estado.vendedor);
                    toast("🔔 Notificaciones activadas");
                } else {
                    console.log("DEBUG: 4. Token SÍ duplicado, no se envía."); // LOG 6
                }
            } else {
                 console.log("DEBUG: 3. Token es NULL, no se envía."); // LOG 7
            }
        } else {
             console.log("DEBUG: Permiso denegado por el usuario."); // LOG 8
        }
    } catch (e) {
        console.warn("Error general en activación de notificaciones:", e);
    }
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
