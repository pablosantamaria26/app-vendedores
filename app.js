/* ======================================================
   APP VENDEDORES PRO v2.1 - LÓGICA (CON TEMAS Y ARREGLOS)
   ====================================================== */

const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let estado = {
    vendedor: "",
    nombre: "",
    ruta: [],
    motivoSeleccionado: "",
    ubicacionActual: null,
    viewMode: "list" // "list" o "focus"
};
let map, markers;
let gpsWatcher = null;
let clientesAvisados = new Set();
let _reporteEnviado = false;

/* === INICIO & EVENTOS GLOBALES === */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App iniciada (v2.1 PRO)");
    
    try { initFirebase(); } catch (e) { console.warn("Firebase bloqueado:", e); }
    
    checkSesion();
    initTheme(); // <-- Vuelve a inicializar el tema

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

    // Listeners de Modo de Vista
    document.getElementById("btnViewList").addEventListener("click", () => setViewMode("list"));
    document.getElementById("btnViewFocus").addEventListener("click", () => setViewMode("focus"));

    // Listeners de Temas (Nuevo)
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener("click", () => setTheme(btn.dataset.theme));
    });
});

/* === FIREBASE (Sin cambios) === */
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

/* === LÓGICA DE SESIÓN Y LOGIN (CON MEMORIA) === */
async function login() {
    const clave = document.getElementById("claveInput").value.trim();
    if (!clave) return toast("⚠️ Ingresa tu clave");

    btnLoading(true);
    try {
        await obtenerUbicacion();
        
        const res = await fetch(`${API}?accion=getRutaDelDia&clave=${clave}&t=${Date.now()}`);
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Clave incorrecta o error de servidor");

        estado.vendedor = clave.padStart(4, "0");
        // IMPORTANTE: Si data.vendedor no viene, usa "Vendedor".
        // Revisa tu Google Sheet "ConfigVendedores" para poner el nombre.
        estado.nombre = data.vendedor || "Vendedor"; 
        estado.ruta = data.cartera.map(c => ({ ...c, visitado: false, expanded: false }));
        
        localStorage.setItem("vendedor_sesion", JSON.stringify({ clave: estado.vendedor, nombre: estado.nombre }));
        localStorage.setItem("vendedor_actual", estado.vendedor);
        localStorage.setItem(`ruta_${estado.vendedor}`, JSON.stringify(estado.ruta));
        
        iniciarApp();
        activarNotificaciones().catch(e => console.warn("Notificaciones fallaron:", e));

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
        if (sesion && sesion.clave) {
            const rutaGuardada = JSON.parse(localStorage.getItem(`ruta_${sesion.clave}`));
            if (rutaGuardada) {
                console.log("Restaurando sesión y ruta para " + sesion.clave);
                estado.vendedor = sesion.clave;
                estado.nombre = sesion.nombre;
                estado.ruta = rutaGuardada;
                iniciarApp(); 
                activarNotificaciones().catch(e => console.warn("Notificaciones fallaron:", e));
                return;
            }
        }
        console.log("Mostrando login.");
        document.getElementById("view-login").classList.add("active");
        
    } catch (e) {
        localStorage.clear();
        document.getElementById("view-login").classList.add("active");
    }
}

/* === INICIO DE APP Y VISTAS === */
function iniciarApp() {
    document.getElementById("view-login").classList.remove("active");
    void document.getElementById("view-app").offsetWidth;
    document.getElementById("view-app").classList.add("active");
    
    // Saludo personalizado
    const primerNombre = estado.nombre.split(' ')[0];
    document.getElementById("vendedorNombre").innerText = estado.nombre;
    document.getElementById("mensajeCoach").innerHTML = `¡Hola, <span id="coach-nombre">${primerNombre}</span>! Vamos por la ruta de hoy.`;
    
    document.getElementById("fabMapa").style.display = 'block';
    
    // Configurar modo de vista
    document.body.setAttribute("data-view-mode", estado.viewMode);
    document.getElementById("btnViewList").classList.toggle("active", estado.viewMode === "list");
    document.getElementById("btnViewFocus").classList.toggle("active", estado.viewMode === "focus");

    renderRuta();
    actualizarProgreso();
    iniciarSeguimientoGPS();
}

function setViewMode(mode) {
    if (estado.viewMode === mode) return;
    estado.viewMode = mode;
    document.body.setAttribute("data-view-mode", mode);
    document.getElementById("btnViewList").classList.toggle("active", mode === "list");
    document.getElementById("btnViewFocus").classList.toggle("active", mode === "focus");
    renderRuta();
}

/* === LÓGICA DE RENDERIZADO (v2.1) === */
function renderRuta() {
    const container = document.getElementById("listaClientes");
    container.innerHTML = "";

    const pendientes = estado.ruta.filter(c => !c.visitado);

    if (pendientes.length === 0) {
        container.innerHTML = `<div class="ruta-completa">🎉<br>¡Ruta finalizada por hoy!<br>🎉</div>`;
        return;
    }

    if (estado.viewMode === "focus") {
        // MODO FOCO: Renderizar solo el primero
        const clienteSiguiente = pendientes[0];
        const indexOriginal = estado.ruta.findIndex(c => c.numeroCliente === clienteSiguiente.numeroCliente);
        renderClienteCard(clienteSiguiente, indexOriginal, true); // true = es "next"
    
    } else {
        // MODO LISTA: Renderizar todos los pendientes
        const indexSiguienteOriginal = estado.ruta.findIndex(c => !c.visitado);
        
        let colorIndex = 0;
        estado.ruta.forEach((c, i) => {
            if (c.visitado) return; // Ocultar visitados
            
            const esSiguiente = (i === indexSiguienteOriginal);
            renderClienteCard(c, i, esSiguiente, colorIndex % 4); // Pasa el índice de color
            colorIndex++;
        });
    }
}

function renderClienteCard(c, i, isNext, colorIndex = 0) {
    const container = document.getElementById("listaClientes");

    let distanciaHTML = "";
    if (estado.ubicacionActual && c.lat && c.lng) {
        const dist = calcularDistancia(estado.ubicacionActual.lat, estado.ubicacionActual.lng, c.lat, c.lng);
        distanciaHTML = `<div class="distancia-badge">🚗 ${(dist * 2).toFixed(0)}min (${dist.toFixed(1)}km)</div>`;
    }

    const frecuenciaTexto = c.frecuencia || "Sin historial previo";

    const card = document.createElement('div');
    card.dataset.i = i;
    card.dataset.colorIndex = colorIndex; // Para el color del borde en modo lista
    
    let classes = ['card'];
    if (isNext) classes.push('next');
    if (c.expanded) classes.push('expanded');
    card.className = classes.join(' ');

    card.innerHTML = `
        ${distanciaHTML}
        <div class="card-header">
            <h3>${c.nombre}</h3>
            <span class="badge pendiente">PENDIENTE</span>
        </div>
        <div class="card-body">
            <p>📍 ${c.domicilio}</p>
            <p>📊 Frecuencia: ${frecuenciaTexto}</p>
        </div>
        <div class="card-actions">
            <button class="btn-action btn-venta" data-i="${i}">✅ VENTA</button>
            <button class="btn-action btn-noventa" data-i="${i}">❌ MOTIVO</button>
            <button class="btn-action btn-detalle" data-i="${i}">ℹ️ DETALLE</button>
        </div>
    `;
    container.appendChild(card);
}

/* === MANEJO DE CLICKS E INTERACCIONES === */
function manejarClicksLista(e) {
    const card = e.target.closest('.card');
    if (!card) return;
    const index = parseInt(card.dataset.i);
    if (isNaN(index)) return;

    const btnVenta   = e.target.closest('.btn-venta');
    const btnNoVenta = e.target.closest('.btn-noventa');
    const btnDetalle = e.target.closest('.btn-detalle');

    if (btnVenta) { registrarVenta(index, true); return; }
    if (btnNoVenta) { abrirMotivo(index); return; }
    if (btnDetalle) { abrirModalCliente(index); return; }

    const cliente = estado.ruta[index];
    if (cliente) {
        cliente.expanded = !cliente.expanded;
        if (estado.viewMode === 'list') {
            estado.ruta.forEach((c, i) => {
                if (i !== index) c.expanded = false;
            });
        }
        renderRuta();
    }
}

async function registrarVenta(index, compro, motivo = "") {
    const cliente = estado.ruta[index];
    if (!cliente || cliente._enviando) return;
    cliente._enviando = true;

    // 1. Marcas locales
    const ahora = new Date();
    cliente.visitado = true;
    cliente.compro = !!compro;
    cliente.motivo = compro ? "" : (motivo || "");
    cliente.hora = ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    // 2. Guardar estado en localStorage
    localStorage.setItem(`ruta_${estado.vendedor}`, JSON.stringify(estado.ruta));
    
    // 3. Animación y UI
    const card = document.querySelector(`.card[data-i="${index}"]`);
    let animDuration = 0;
    
    if (card && estado.viewMode === 'focus') {
        card.classList.add('slide-out');
        animDuration = 400;
    }

    setTimeout(() => {
        renderRuta();
        actualizarProgreso();
    }, animDuration);

    // 4. Envío a la API (segundo plano)
    try {
        const payload = {
            accion: "registrarVisita",
            vendedor: estado.vendedor, vendedorNombre: estado.nombre,
            cliente: cliente.numeroCliente, compro: !!compro,
            motivo: cliente.motivo || "", notas: cliente.notas || "",
            lat: estado.ubicacionActual?.lat ?? "", lng: estado.ubicacionActual?.lng ?? "",
            ts: ahora.toISOString(), app: "App Vendedores Pro v2.1"
        };
        await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast(compro ? "🎉 ¡Venta registrada!" : "ℹ️ Visita registrada");
    } catch (err) {
        console.warn("registrarVenta error:", err);
        toast("⚠️ Sin conexión: queda pendiente de enviar");
    } finally {
        cliente._enviando = false;
    }

    if (estado.viewMode === 'list') {
        irAlSiguienteCliente();
    }
}

/* === LÓGICA DE GPS (CON ARREGLO DE PARPADEO) === */
function obtenerUbicacion() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                estado.ubicacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                ordenarRutaPorDistancia();
                resolve();
            },
            () => resolve(), { enableHighAccuracy: false, timeout: 5000 }
        );
    });
}

function iniciarSeguimientoGPS() {
    if (!navigator.geolocation || gpsWatcher) return;
    gpsWatcher = navigator.geolocation.watchPosition(
        (pos) => {
            estado.ubicacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            ordenarRutaPorDistancia(); // Esto ahora es seguro
            verificarProximidadClientes();
        },
        (err) => console.warn("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 7000 }
    );
}

function ordenarRutaPorDistancia() {
    // --- ARREGLO DE PARPADEO ---
    // Si estamos en Modo Foco, no reordenamos la lista para no causar saltos.
    if (estado.viewMode === 'focus') return;

    if (!estado.ubicacionActual) return;
    const { lat, lng } = estado.ubicacionActual;
    
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

function verificarProximidadClientes() {
    if (!estado.ubicacionActual) return;
    estado.ruta.forEach((c) => {
        if (!c.lat || !c.lng || c.visitado || clientesAvisados.has(c.numeroCliente)) return;
        const dist = calcularDistancia(estado.ubicacionActual.lat, estado.ubicacionActual.lng, c.lat, c.lng) * 1000;
        if (dist <= 120) {
            clientesAvisados.add(c.numeroCliente);
            fetch(API, { method: "POST", body: JSON.stringify({
                accion: "enviarPush", vendedor: estado.vendedor,
                titulo: "🛎️ Estás llegando", mensaje: `Prepárate para ${c.nombre}`
            })}).catch(() => console.warn("No se pudo enviar push"));
            toast(`📍 Estás cerca de: ${c.nombre}`);
        }
    });
}

/* === LÓGICA DE MAPA (MEJORADA) === */
function toggleMapa() {
    const modal = document.getElementById("modal-mapa");
    if (modal.classList.contains("hidden")) {
        modal.classList.remove("hidden");
        if (!map && typeof L !== 'undefined') {
            map = L.map('map').setView([-34.6, -58.4], 10);
            // Nuevo estilo de mapa "Voyager"
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { 
                attribution: '©OpenStreetMap, ©CartoDB' 
            }).addTo(map);
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
    
    // Filtrar solo pendientes para el mapa
    const pendientes = estado.ruta.filter(c => !c.visitado);

    pendientes.forEach((c, i) => {
        if (c.lat && c.lng) {
            // El color del marcador ahora usa la variable CSS
            const color = 'var(--accent-solid)';
            const marker = L.circleMarker([c.lat, c.lng], { 
                radius: 10, fillColor: color, color: '#fff', weight: 3, fillOpacity: 1 
            }).addTo(markers);

            // NUEVO: Añadir nombre del cliente en el mapa
            marker.bindTooltip(c.nombre, {
                permanent: true, // Para que se vea siempre
                direction: 'top',
                className: 'map-tooltip', // Estilo CSS personalizado
                offset: [0, -10]
            });

            // Al hacer clic, se busca el índice original
            const indexOriginal = estado.ruta.findIndex(r => r.numeroCliente === c.numeroCliente);
            marker.on('click', () => {
                document.getElementById("modal-mapa").classList.add("hidden");
                abrirModalCliente(indexOriginal);
            });
            grupo.push([c.lat, c.lng]);
        }
    });
    if (grupo.length) map.fitBounds(grupo, { padding: [50, 50] });
}

/* === MODALES, MOTIVOS, ETC. (Lógica sin cambios) === */
let clienteModalIndex = null;
async function abrirModalCliente(index) {
    clienteModalIndex = index;
    const c = estado.ruta[index];
    if (!c) return;
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
            btnCopiar.onclick = () => { navigator.clipboard.writeText(data.ultimoPedido.texto); toast("📋 ¡Pedido copiado!"); };
        } else { document.getElementById("modal-ultimo-pedido").innerText = "Sin pedidos recientes."; }
    } catch (e) { document.getElementById("modal-ultimo-pedido").innerText = "Error al cargar."; }
}
function cerrarModalCliente() {
    const modal = document.getElementById("modal-cliente");
    modal.classList.remove("active");
    setTimeout(() => modal.classList.add("hidden"), 300);
}
function irACliente() {
    const c = estado.ruta[clienteModalIndex];
    if (c.lat && c.lng) { window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`, '_blank'); } 
    else { toast("⚠️ Cliente sin coordenadas"); }
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
function irAlSiguienteCliente() {
    const idx = estado.ruta.findIndex(c => !c.visitado);
    if (idx === -1) { toast("✅ ¡Ruta finalizada!"); return; }
    const card = document.querySelector(`.card[data-i="${idx}"]`);
    if (card) { card.classList.add("next"); card.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

/* === NOTIFICACIONES (Sin cambios) === */
async function activarNotificaciones() {
    console.log("TOKEN DEBUG: === INICIO activarNotificaciones() ===");
    if (typeof firebase === 'undefined' || !messaging) { console.error("TOKEN DEBUG: 0. ❌ Firebase o messaging NO cargaron."); return; }
    const VAPID_KEY = "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o";
    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { console.warn("TOKEN DEBUG: 2. ❌ Permiso DENEGADO."); return; }
        const reg = await navigator.serviceWorker.ready;
        const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }).catch(err => null);
        if (!token) { console.error("TOKEN DEBUG: 4B. ❌ Token NULL."); return; }
        const tokenPrevio = localStorage.getItem("fcm_token_enviado");
        const vendedorPrevio = localStorage.getItem("vendedor_actual");
        if (token === tokenPrevio && estado.vendedor === vendedorPrevio) { console.log("TOKEN DEBUG: 6. Token repetido → No se envía. (OK)"); return; }
        const res = await fetch(API, { method: "POST", body: JSON.stringify({
            accion: "registrarToken", vendedor: estado.vendedor, token: token, dispositivo: navigator.userAgent
        })});
        if (!res.ok) { console.error("TOKEN DEBUG: 7. ❌ Error guardando token en API:", await res.text()); return; }
        localStorage.setItem("fcm_token_enviado", token);
        localStorage.setItem("vendedor_actual", estado.vendedor);
        toast("🔔 Notificaciones activadas");
        console.log("TOKEN DEBUG: === FIN activarNotificaciones() ===");
    } catch (err) { console.error("TOKEN DEBUG: ❌ ERROR GENERAL activarNotificaciones():", err); }
}

/* === UTILIDADES Y HELPERS === */
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function actualizarProgreso() {
    const total = estado.ruta.length;
    const visitados = estado.ruta.filter(c => c.visitado).length;
    const porc = total === 0 ? 0 : (visitados / total) * 100;
    const circle = document.querySelector('.progreso-value');
    if (circle) circle.style.strokeDashoffset = 100 - porc;
    document.getElementById("progreso-texto").innerText = `${visitados}/${total}`;
    if (porc === 100) { document.getElementById("mensajeCoach").innerText = "🎉 ¡Ruta finalizada! ¡Excelente trabajo!"; }
    if (porc === 100 && !_reporteEnviado) {
        _reporteEnviado = true;
        enviarReporteSupervisor().catch(err => { console.error("Error enviando reporte:", err); _reporteEnviado = false; });
    }
}
function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000);
}
function btnLoading(isLoading) {
    const btn = document.getElementById("btnIngresar"); btn.disabled = isLoading; btn.innerHTML = isLoading ? "⌛..." : "INGRESAR";
}
// Nuevo: Funciones de Tema
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
    // Actualizar el nombre del coach con el nuevo color
    const primerNombre = estado.nombre.split(' ')[0] || 'Vendedor';
    document.getElementById("mensajeCoach").innerHTML = `¡Hola, <span id="coach-nombre">${primerNombre}</span>! Vamos por la ruta de hoy.`;
}
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'blue'; // 'blue' es el nuevo default
    setTheme(savedTheme);
}
async function enviarReporteSupervisor() {
    const visitas = estado.ruta.filter(c => c.visitado).map(c => ({
        numeroCliente: c.numeroCliente || "", nombre: c.nombre || "", domicilio: c.domicilio || "",
        compro: !!c.compro, motivo: c.motivo || "", hora: c.hora || ""
    }));
    const payload = {
        accion: "reporteSupervisor", vendedor: estado.vendedor, vendedorNombre: estado.nombre,
        fechaISO: new Date().toISOString(), visitas
    };
    const res = await fetch(API, { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    toast("📧 Reporte enviado al supervisor");
}
