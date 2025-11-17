/* ======================================================
   APP VENDEDORES PRO v2.7 - FINAL MERGE
   ====================================================== */

const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

// --- ESTADO GLOBAL ACTUALIZADO ---
let estado = {
    vendedor: "",
    nombre: "",
    ruta: [],
    motivoSeleccionado: "",
    ubicacionActual: null,
    viewMode: "list",
    diaRutaActual: "LUN" // Antes era zonaActual. Ahora guarda: LUN, MAR, MIE...
};

let map, markers;
let gpsWatcher = null;
let clientesAvisados = new Set();
let _reporteEnviado = false;
let diaSeleccionadoTemp = ""; // Para guardar la selección antes de confirmar

const MENSAJES_MOTIVACIONALES = [
    "¡Vamos por un gran día de ventas!",
    "Tu actitud determina tu dirección. ¡A ganar!",
    "Cada 'no' te acerca a un 'sí'. ¡Adelante!",
    "El éxito es la suma de pequeños esfuerzos. ¡Vamos!",
    "Hoy es un buen día para superar tus metas."
];

/* === INICIO & EVENTOS GLOBALES === */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App iniciada (v2.7 PRO)");
    try { initFirebase(); } catch (e) { console.warn("Firebase bloqueado:", e); }
    
    // Verificar si es un nuevo día antes de cargar sesión
    checkDailyReset(); 
    checkSesion();
    initTheme();

    // Eventos de Login
    const claveInput = document.getElementById("claveInput");
    if(document.getElementById("btnIngresar")) document.getElementById("btnIngresar").addEventListener("click", login);
    if(claveInput) {
        claveInput.addEventListener("keyup", (e) => e.key === "Enter" && login());
        claveInput.addEventListener("input", handleClaveInput);
    }
    if(document.getElementById("toggleClave")) document.getElementById("toggleClave").addEventListener("click", toggleClave);

    // Eventos de Navegación (Footer)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if (target) showView(target);
        });
    });
    
    // Botón Mapa Footer (Acción directa)
    const btnMap = document.getElementById("btnFooterMapa");
    if(btnMap) btnMap.addEventListener("click", toggleMapa);
    const btnCloseMap = document.getElementById("btnCerrarMapa");
    if(btnCloseMap) btnCloseMap.addEventListener("click", toggleMapa);

    // Eventos Lista Clientes
    const lista = document.getElementById("listaClientes");
    if(lista) lista.addEventListener("click", manejarClicksLista);
    
    // Modals
    document.getElementById("btnCancelarModal")?.addEventListener("click", cerrarModalCliente);
    document.getElementById("btnIrCliente")?.addEventListener("click", irACliente);

    // Eventos Motivos
    document.getElementById("overlay-motivo")?.addEventListener("click", cerrarMotivo);
    document.getElementById("btnConfirmarMotivo")?.addEventListener("click", confirmarMotivo);
    document.getElementById("motivoOptions")?.addEventListener("click", manejarMotivoChips);

    // Eventos Header
    document.getElementById("btnViewList")?.addEventListener("click", () => setViewMode("list"));
    document.getElementById("btnViewFocus")?.addEventListener("click", () => setViewMode("focus"));
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener("click", () => setTheme(btn.dataset.theme));
    });

    // --- NUEVOS EVENTOS: AGENDA (DÍAS) ---
    // Nota: Los botones se generan dinámicamente en initDiaRutaControls
    
    // Modal Confirmación Cambio de Día
    const btnSolicitarZona = document.getElementById("btnSolicitarCambioZona"); // (Si existe en tu HTML viejo)
    if(btnSolicitarZona) btnSolicitarZona.addEventListener("click", abrirConfirmacionDia);

    // Botones del Modal de Confirmación de Zona (Ahora Día)
    // Asegúrate que en tu HTML los botones del modal tengan estos IDs o ajusta aquí
    const btnCancelZone = document.getElementById("btnCancelZone") || document.getElementById("btnCancelZona");
    if(btnCancelZone) btnCancelZone.addEventListener("click", () => document.getElementById("modal-confirm-zona").classList.remove("active"));
    
    const btnOkZone = document.getElementById("btnOkZone") || document.getElementById("btnOkZona");
    if(btnOkZone) btnOkZone.addEventListener("click", confirmarCambioDiaAPI);

    // --- NUEVOS EVENTOS: AJUSTES (PIN & SYNC) ---
    document.getElementById("btnLogout")?.addEventListener("click", logout);
    
    // Botón Sincronizar
    document.getElementById("btnSync")?.addEventListener("click", forzarSincronizacion);

    // Cambio de PIN
    document.getElementById("btnCambiarPin")?.addEventListener("click", () => {
        document.getElementById("password-change-modal").classList.add("active");
    });
    document.getElementById("btnCancelPinChange")?.addEventListener("click", () => {
        document.getElementById("password-change-modal").classList.remove("active");
    });
    document.getElementById("btnSavePinChange")?.addEventListener("click", guardarNuevoPin);
});

/* === LÓGICA DE NAVEGACIÓN === */
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    // Si entra a agenda, asegurarse que los controles estén bien
    if(viewId === 'view-agenda') {
        initDiaRutaControls();
    }
}

/* === LÓGICA DE REINICIO DIARIO (00:00hs) === */
function checkDailyReset() {
    const fechaGuardada = localStorage.getItem("fecha_ruta");
    const hoy = new Date().toLocaleDateString();

    if (fechaGuardada && fechaGuardada !== hoy) {
        console.log("📅 Nuevo día detectado. Limpiando ruta anterior...");
        const vend = localStorage.getItem("vendedor_actual");
        if(vend) localStorage.removeItem("ruta_" + vend);
        localStorage.removeItem("fecha_ruta");
        localStorage.removeItem("vendedor_sesion");
        window.location.reload();
    }
}

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

    // Listener para App Abierta (Foreground)
    messaging.onMessage((payload) => {
        console.log("Mensaje en primer plano:", payload);
        const { tipo, titulo, mensaje } = payload.data;
        if (tipo && mensaje) {
            showDynamicToast(tipo, titulo, mensaje);
        }
    });
}

/* === LOGIN & API === */
function mostrarLoadingToast(msgOverride) {
    const msg = msgOverride || MENSAJES_MOTIVACIONALES[Math.floor(Math.random() * MENSAJES_MOTIVACIONALES.length)];
    const elMsg = document.getElementById("loading-toast-msg");
    if(elMsg) elMsg.innerText = msg;
    
    const elWeather = document.getElementById("loading-toast-weather");
    if(elWeather) elWeather.innerText = "Conectando...";
    
    document.getElementById("loading-toast").classList.remove("hidden");
}

function ocultarLoadingToast() {
    document.getElementById("loading-toast").classList.add("hidden");
}

async function login() {
    const clave = document.getElementById("claveInput").value.trim();
    if (clave.length < 4) return toast("⚠️ Clave debe tener 4 dígitos");

    mostrarLoadingToast();
    btnLoading(true);
    
    try {
        // Pedimos ruta y ubicación en paralelo
        const rutaPromise = fetch(`${API}?accion=getRutaDelDia&clave=${clave}&t=${Date.now()}`);
        const ubicacionPromise = obtenerUbicacion();

        await ubicacionPromise;

        // Intentamos cargar clima
        if (estado.ubicacionActual) {
            fetchClimaString(estado.ubicacionActual.lat, estado.ubicacionActual.lng)
                .then(climaStr => {
                    const elW = document.getElementById("loading-toast-weather");
                    if(elW) elW.innerText = climaStr;
                });
        }

        const rutaResponse = await rutaPromise;
        const data = await rutaResponse.json();

        if (!rutaResponse.ok || !data.ok) {
            throw new Error(data.error || "Clave incorrecta o error de servidor");
        }

        // Guardar Estado
        estado.vendedor = clave.padStart(4, "0");
        estado.nombre = data.vendedor || "Vendedor";
        // Capturamos el día asignado desde el Backend
        estado.diaRutaActual = (data.diaAsignado || "LUN").toUpperCase();
        
        estado.ruta = data.cartera.map(c => ({ ...c, visitado: false, expanded: false }));
        
        // Persistencia
        localStorage.setItem("vendedor_sesion", JSON.stringify({ 
            clave: estado.vendedor, 
            nombre: estado.nombre,
            diaDefault: estado.diaRutaActual // Guardamos el día también
        }));
        localStorage.setItem("vendedor_actual", estado.vendedor);
        localStorage.setItem(`ruta_${estado.vendedor}`, JSON.stringify(estado.ruta));
        localStorage.setItem("fecha_ruta", new Date().toLocaleDateString()); 
        localStorage.setItem("dia_ruta_actual", estado.diaRutaActual);

        iniciarApp();
        ocultarLoadingToast();
        
        activarNotificaciones().catch(e => console.warn("Notificaciones fallaron:", e));

    } catch (e) {
        console.error(e);
        toast("❌ Error: " + e.message);
        ocultarLoadingToast();
    } finally {
        btnLoading(false);
    }
}

function handleClaveInput(e) {
    if (e.target.value.length === 4) login();
}

function toggleClave() {
    const i = document.getElementById("claveInput");
    const b = document.getElementById("toggleClave");
    if (i.type === "password") { i.type = "text"; b.innerText = "🙈"; } 
    else { i.type = "password"; b.innerText = "👁️"; }
}

function logout() {
    localStorage.removeItem("vendedor_sesion");
    location.reload();
}

/* === NUEVA LÓGICA DE AGENDA (DÍAS) === */

// Dibuja los botones LUN, MAR, MIE...
function initDiaRutaControls() {
    const selector = document.getElementById('zone-selector'); 
    if (!selector) return;
    
    selector.innerHTML = ''; // Limpiar
    
    const dias = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE']; 
    
    dias.forEach(dia => {
        const btn = document.createElement('button');
        // Si coincide con el día actual de la ruta, lo marcamos
        const isSelected = (estado.diaRutaActual === dia);
        btn.className = `chip ${isSelected ? 'selected' : ''}`;
        btn.innerText = dia;
        
        btn.onclick = () => {
            document.querySelectorAll('#zone-selector .chip').forEach(c => c.classList.remove('selected'));
            btn.classList.add('selected');
            
            // Guardamos intención y pedimos confirmación
            diaSeleccionadoTemp = dia;
            
            if (dia !== estado.diaRutaActual) {
                abrirConfirmacionDia();
            }
        };
        selector.appendChild(btn);
    });

    // Actualizar texto visual
    const display = document.getElementById("current-zone-display");
    if(display) display.innerText = estado.diaRutaActual; // Ahora muestra el DÍA
    
    // Actualizar título del modal si existe (zonaTargetSpan) para reutilizarlo
    const modalTitle = document.getElementById("zonaTargetSpan");
    if(modalTitle) modalTitle.innerText = `RUTA DEL ${estado.diaRutaActual}`;
}

function abrirConfirmacionDia() {
    const modal = document.getElementById("modal-confirm-zona");
    // Actualizamos el texto del modal dinámicamente
    const msg = modal.querySelector("p") || modal.querySelector("h3");
    if(msg) msg.innerHTML = `¿Cambiar a ruta del <b>${diaSeleccionadoTemp}</b>?<br>Se recargarán los clientes.`;
    
    modal.classList.add("active");
}

// Llama al backend para cambiar el día
async function confirmarCambioDiaAPI() {
    const modal = document.getElementById("modal-confirm-zona");
    modal.classList.remove("active");
    mostrarLoadingToast(`Cambiando ruta a ${diaSeleccionadoTemp}...`);
    
    try {
        const payload = {
            accion: "cambiarDiaRuta", // Nueva acción en GAS
            vendedor: estado.vendedor,
            nuevoDia: diaSeleccionadoTemp 
        };

        const response = await fetch(API, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload) 
        });
        
        const data = await response.json();

        if (data.ok) {
            // Actualizamos localmente
            estado.diaRutaActual = diaSeleccionadoTemp;
            localStorage.setItem('dia_ruta_actual', estado.diaRutaActual);
            
            // Forzamos recarga de datos (true)
            await recargarDatos(true); 
            
            showDynamicToast("EXITO", "Ruta Actualizada", `Ahora ves los clientes del ${diaSeleccionadoTemp}.`);
            showView('view-app'); 
        } else {
            throw new Error(data.error || "Error desconocido");
        }

    } catch (e) {
        console.error(e);
        toast("⚠️ Error al cambiar día: " + e.message);
        initDiaRutaControls(); // Reset visual
    } finally {
        ocultarLoadingToast();
    }
}

/* === NUEVA LÓGICA DE AJUSTES (PIN & SYNC) === */

// Guardar Nuevo PIN
async function guardarNuevoPin() {
    const input = document.getElementById("newPinInput");
    const nuevoPin = input.value.trim();
    
    if (nuevoPin.length !== 4 || isNaN(nuevoPin)) {
        toast("⚠️ El PIN debe ser de 4 números.");
        return;
    }

    const btnGuardar = document.getElementById("btnSavePinChange");
    const txtOriginal = btnGuardar.innerText;
    btnGuardar.innerText = "Guardando...";
    btnGuardar.disabled = true;

    try {
        const payload = {
            accion: "cambiarPIN",
            vendedor: estado.vendedor,
            nuevoPin: nuevoPin
        };
        
        const response = await fetch(API, { 
            method: "POST", 
            headers: {"Content-Type": "application/json"}, // Importante para POST
            body: JSON.stringify(payload) 
        });
        const data = await response.json();
        
        if (data.ok) {
            document.getElementById("password-change-modal").classList.remove("active");
            showDynamicToast("EXITO", "PIN Cambiado", "Tu clave se actualizó correctamente.");
            input.value = ""; 
            // Forzamos logout para que pruebe el nuevo PIN
            setTimeout(logout, 2000);
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        toast("❌ Error al cambiar PIN: " + e.message);
    } finally {
        btnGuardar.innerText = txtOriginal;
        btnGuardar.disabled = false;
    }
}

// Sincronización Forzada
function forzarSincronizacion() {
    mostrarLoadingToast("Sincronizando datos con la nube...");
    recargarDatos(true)
        .then(() => {
            ocultarLoadingToast();
            showDynamicToast("EXITO", "Sincronizado", "Datos actualizados correctamente.");
        })
        .catch((e) => {
            ocultarLoadingToast();
            toast("❌ Fallo la sincronización.");
        });
}

// Función auxiliar para recargar datos sin pasar por login de UI
async function recargarDatos(forzar = false) {
    const t = forzar ? Date.now() : 0;
    const res = await fetch(`${API}?accion=getRutaDelDia&clave=${estado.vendedor}&t=${t}`);
    const data = await res.json();
    
    if (data.ok) {
        estado.ruta = data.cartera.map(c => ({ ...c, visitado: false, expanded: false }));
        estado.diaRutaActual = (data.diaAsignado || "LUN").toUpperCase();
        
        localStorage.setItem(`ruta_${estado.vendedor}`, JSON.stringify(estado.ruta));
        localStorage.setItem("dia_ruta_actual", estado.diaRutaActual);
        
        iniciarApp(); // Redibuja todo
    } else {
        throw new Error("No se pudo descargar la ruta");
    }
}

/* === TOAST DINÁMICO === */
function showDynamicToast(tipo, titulo, mensaje) {
    const container = document.getElementById("dynamic-toast-container");
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `dynamic-toast ${tipo}`;
    toast.innerHTML = `<p>${titulo}</p><span>${mensaje}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 500);
    }, 8000);
}

function checkSesion() {
    try {
        const sesion = JSON.parse(localStorage.getItem("vendedor_sesion"));
        if (sesion && sesion.clave) {
            const rutaGuardada = JSON.parse(localStorage.getItem(`ruta_${sesion.clave}`));
            if (rutaGuardada) {
                estado.vendedor = sesion.clave;
                estado.nombre = sesion.nombre;
                // Recuperar el día guardado o usar el de la sesión
                estado.diaRutaActual = localStorage.getItem("dia_ruta_actual") || sesion.diaDefault || "LUN";
                estado.ruta = rutaGuardada;
                
                iniciarApp(); 
                activarNotificaciones().catch(e => console.warn("Notificaciones:", e));
                return;
            }
        }
        document.getElementById("view-login").classList.add("active");
    } catch (e) {
        localStorage.clear();
        document.getElementById("view-login").classList.add("active");
    }
}

// --- FUNCIÓN PRINCIPAL DE INICIO (ACTUALIZADA) ---
function iniciarApp() {
    // 1. Mostrar la interfaz principal
    document.getElementById("view-login").classList.remove("active");
    document.getElementById("view-app").classList.add("active");
    
    // 2. Obtener datos clave
    const primerNombre = estado.nombre.split(' ')[0];
    const totalClientes = estado.ruta.length;
    const diaAsignado = (estado.diaRutaActual || "LUN").toUpperCase();
    
    // 3. Actualizar UI y Mensajes
    const elNombre = document.getElementById("vendedorNombre");
    if(elNombre) elNombre.innerText = estado.nombre;

    let coachMsg = `¡Hola, <span id="coach-nombre">${primerNombre}</span>! `;
    
    if (totalClientes === 0) {
        coachMsg += `Ruta del **${diaAsignado}** cargada, pero no hay clientes.`;
    } else {
        coachMsg += `Tu ruta de **${diaAsignado}** tiene ${totalClientes} clientes. ¡A vender! 🚀`;
    }
    
    const elCoach = document.getElementById("mensajeCoach");
    if(elCoach) elCoach.innerHTML = coachMsg;
    
    // 4. Mostrar Toast de Bienvenida (Solo si acabamos de loguear o recargar)
    // Usamos un flag simple para no spammear si solo cambia de vista
    if (!sessionStorage.getItem("welcome_shown")) {
        showDynamicToast(
            "INFO", 
            `¡Bienvenido, ${primerNombre}!`, 
            `Hoy cargamos la ruta del día **${diaAsignado}**.`
        );
        sessionStorage.setItem("welcome_shown", "true");
    }
    
    // 5. Renderizar
    document.body.setAttribute("data-view-mode", estado.viewMode);
    
    renderRuta();
    actualizarProgreso();
    iniciarSeguimientoGPS();
    
    // 6. Inicializar botones de Agenda
    initDiaRutaControls(); 
}

function setViewMode(mode) {
    if (estado.viewMode === mode) return;
    estado.viewMode = mode;
    document.body.setAttribute("data-view-mode", mode);
    document.getElementById("btnViewList")?.classList.toggle("active", mode === "list");
    document.getElementById("btnViewFocus")?.classList.toggle("active", mode === "focus");
    renderRuta();
}

/* === RENDERIZADO === */
function renderRuta() {
    const container = document.getElementById("listaClientes");
    if(!container) return;
    container.innerHTML = "";
    const pendientes = estado.ruta.filter(c => !c.visitado);
    
    if (pendientes.length === 0) {
        container.innerHTML = `<div class="ruta-completa">🎉<br>¡Ruta del ${estado.diaRutaActual} finalizada!<br>🎉</div>`;
        return;
    }
    
    if (estado.viewMode === "focus") {
        const clienteSiguiente = pendientes[0];
        const indexOriginal = estado.ruta.findIndex(c => c.numeroCliente === clienteSiguiente.numeroCliente);
        renderClienteCard(clienteSiguiente, indexOriginal, true);
    } else {
        const indexSiguienteOriginal = estado.ruta.findIndex(c => !c.visitado);
        let colorIndex = 0;
        estado.ruta.forEach((c, i) => {
            if (c.visitado) return;
            const esSiguiente = (i === indexSiguienteOriginal);
            renderClienteCard(c, i, esSiguiente, colorIndex % 4);
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
    
    const frecuenciaTexto = c.frecuencia || "Sin historial";
    const card = document.createElement('div');
    card.dataset.i = i;
    card.dataset.colorIndex = colorIndex;
    let classes = ['card'];
    if (isNext) classes.push('next');
    if (c.expanded || estado.viewMode === 'focus') classes.push('expanded');
    card.className = classes.join(' ');
    
    const detalleTexto = (estado.viewMode === 'focus') ? 'VER PEDIDO' : 'ℹ️ DETALLE';
    
    card.innerHTML = `
        ${distanciaHTML}
        <div class="card-header"><h3>${c.nombre}</h3><span class="badge pendiente">PENDIENTE</span></div>
        <div class="card-body"><p>📍 ${c.domicilio}</p><p>📊 ${frecuenciaTexto}</p></div>
        <div class="card-actions">
            <button class="btn-action btn-venta" data-i="${i}">✅ VENTA</button>
            <button class="btn-action btn-noventa" data-i="${i}">❌ MOTIVO</button>
            <button class="btn-action btn-detalle" data-i="${i}">${detalleTexto}</button>
        </div>`;
    container.appendChild(card);
}

/* === INTERACCIONES === */
function manejarClicksLista(e) {
    const card = e.target.closest('.card');
    if (!card) return;
    const index = parseInt(card.dataset.i);
    if (isNaN(index)) return;

    if (e.target.closest('.btn-venta')) { registrarVenta(index, true); return; }
    if (e.target.closest('.btn-noventa')) { abrirMotivo(index); return; }
    if (e.target.closest('.btn-detalle')) { abrirModalCliente(index); return; }

    if (estado.viewMode === 'list') {
        const cliente = estado.ruta[index];
        if (cliente) {
            cliente.expanded = !cliente.expanded;
            estado.ruta.forEach((c, i) => { if (i !== index) c.expanded = false; });
            renderRuta();
        }
    }
}

async function registrarVenta(index, compro, motivo = "") {
    const cliente = estado.ruta[index];
    if (!cliente || cliente._enviando) return;
    cliente._enviando = true;
    const ahora = new Date();
    
    cliente.visitado = true;
    cliente.compro = !!compro;
    cliente.motivo = compro ? "" : (motivo || "");
    cliente.hora = ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    
    localStorage.setItem(`ruta_${estado.vendedor}`, JSON.stringify(estado.ruta));
    
    // Animación visual de salida
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

    try {
        const payload = {
            accion: "registrarVisita", vendedor: estado.vendedor, vendedorNombre: estado.nombre,
            cliente: cliente.numeroCliente, compro: !!compro, motivo: cliente.motivo || "",
            lat: estado.ubicacionActual?.lat ?? "", lng: estado.ubicacionActual?.lng ?? "",
            ts: ahora.toISOString(), app: "App Vendedores Pro v2.7"
        };
        await fetch(API, { method: "POST", body: JSON.stringify(payload) });
        toast(compro ? "🎉 ¡Venta registrada!" : "ℹ️ Visita registrada");
    } catch (err) {
        console.warn("registrarVenta error:", err);
        toast("⚠️ Sin conexión: guardado localmente");
    } finally {
        cliente._enviando = false;
    }
}

/* === GPS === */
function obtenerUbicacion() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                estado.ubicacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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
            ordenarRutaPorDistancia();
            verificarProximidadClientes();
        },
        (err) => console.warn("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 7000 }
    );
}

function ordenarRutaPorDistancia() {
    if (estado.viewMode === 'focus' || !estado.ubicacionActual) return;
    const { lat, lng } = estado.ubicacionActual;
    estado.ruta.sort((a, b) => {
        if (a.visitado !== b.visitado) return a.visitado ? 1 : -1;
        if (!a.lat || !a.lng) return 1;
        if (!b.lat || !b.lng) return -1;
        return calcularDistancia(lat, lng, a.lat, a.lng) - calcularDistancia(lat, lng, b.lat, b.lng);
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
            toast(`📍 Estás cerca de: ${c.nombre}`);
        }
    });
}

/* === MAPA === */
function toggleMapa() {
    const modal = document.getElementById("modal-mapa");
    if (modal.classList.contains("hidden")) {
        modal.classList.remove("hidden");
        if (!map && typeof L !== 'undefined') {
            map = L.map('map').setView([-34.6, -58.4], 10);
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
    const pendientes = estado.ruta.filter(c => !c.visitado);
    pendientes.forEach((c, i) => {
        if (c.lat && c.lng) {
            const marker = L.circleMarker([c.lat, c.lng], { 
                radius: 10, fillColor: '#4CC9F0', color: '#fff', weight: 3, fillOpacity: 1 
            }).addTo(markers);
            marker.bindTooltip(c.nombre, { permanent: true, direction: 'top', offset: [0, -10] });
            grupo.push([c.lat, c.lng]);
        }
    });
    if (grupo.length) map.fitBounds(grupo, { padding: [50, 50] });
}

/* === MODALES UTILS === */
let clienteModalIndex = null;
async function abrirModalCliente(index) {
    clienteModalIndex = index;
    const c = estado.ruta[index];
    document.getElementById("modal-cliente-nombre").innerText = c.nombre;
    document.getElementById("modal-cliente-direccion").innerText = c.domicilio;
    document.getElementById("modal-ultimo-pedido").innerText = "⌛ Cargando...";
    
    const modal = document.getElementById("modal-cliente");
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("active"), 10);

    try {
        const res = await fetch(`${API}?accion=getUltimoPedido&cliente=${c.numeroCliente}`);
        const data = await res.json();
        if (data.ok && data.ultimoPedido) {
            document.getElementById("modal-ultimo-pedido").innerText = `${data.ultimoPedido.fecha}\n${data.ultimoPedido.texto}`;
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
    if (c.lat && c.lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`, '_blank');
}

/* === MOTIVOS === */
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

/* === NOTIFICACIONES === */
async function activarNotificaciones() {
    if (typeof firebase === 'undefined' || !messaging) return;
    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        // NOTA: Reemplaza esta VAPID key si tienes una nueva
        const token = await messaging.getToken({ vapidKey: "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o", serviceWorkerRegistration: reg });
        if (!token) return;
        
        const tokenPrevio = localStorage.getItem("fcm_token_enviado");
        if (token !== tokenPrevio) {
            await fetch(API, { method: "POST", body: JSON.stringify({ accion: "registrarToken", vendedor: estado.vendedor, token: token, dispositivo: navigator.userAgent })});
            localStorage.setItem("fcm_token_enviado", token);
        }
    } catch (e) { console.error("Error notificaciones:", e); }
}

/* === UTILS === */
function getWMOWeatherDescription(code) {
    const codes = { 0: "☀️ Despejado", 1: "🌤️ Mayormente despejado", 2: "🌥️ Parcialmente nublado", 3: "☁️ Nublado", 61: "🌧️ Lluvia", 95: "⛈️ Tormenta" };
    return codes[code] || "Clima";
}
async function fetchClimaString(lat, lng) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
        const data = await res.json();
        return `${getWMOWeatherDescription(data.current_weather.weathercode)}, ${data.current_weather.temperature.toFixed(0)}°C`;
    } catch { return "Sin datos clima"; }
}
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
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = circumference - (porc / 100) * circumference;
    }
    document.getElementById("progreso-texto").innerText = `${visitados}/${total}`;
    document.getElementById("ventas-texto").innerText = `${estado.ruta.filter(c => c.compro).length} Ventas`;
    document.getElementById("pendientes-texto").innerText = `${total - visitados} Pend.`;
    
    if (porc === 100 && !_reporteEnviado) {
        _reporteEnviado = true;
        enviarReporteSupervisor();
    }
}
function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000);
}
function btnLoading(isLoading) {
    const btn = document.getElementById("btnIngresar"); 
    if(btn) {
        btn.disabled = isLoading; 
        btn.innerHTML = isLoading ? "⌛..." : "INGRESAR";
    }
}
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme); localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}
function initTheme() { setTheme(localStorage.getItem('theme') || 'blue'); }
async function enviarReporteSupervisor() {
    const visitas = estado.ruta.filter(c => c.visitado).map(c => ({ numeroCliente: c.numeroCliente, nombre: c.nombre, compro: !!c.compro, motivo: c.motivo, hora: c.hora }));
    await fetch(API, { method: "POST", body: JSON.stringify({ accion: "reporteSupervisor", vendedor: estado.vendedor, vendedorNombre: estado.nombre, fechaISO: new Date().toISOString(), visitas })});
    toast("📧 Reporte enviado");
}
