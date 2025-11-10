/* === CONFIG === */
const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let estado = { vendedor: "", nombre: "", ruta: [], motivoSeleccionado: "" };
let map, markers;

/* === INICIO SEGURO === */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App iniciada");
    try {
        initFirebase(); // Intentar cargar Firebase sin bloquear
    } catch (e) { console.warn("Firebase bloqueado:", e); }
    
    checkSesion();
    initTheme();

    // Event Listeners
    document.getElementById("btnIngresar").addEventListener("click", login);
    document.getElementById("claveInput").addEventListener("keyup", (e) => e.key === "Enter" && login());
    document.getElementById("fabMapa").addEventListener("click", toggleMapa);
    document.getElementById("btnCerrarMapa").addEventListener("click", toggleMapa);
    
    document.getElementById("listaClientes").addEventListener("click", manejarClicksLista);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener("click", () => setTheme(btn.dataset.theme));
    });
});

/* === FIREBASE (INTENTO SEGURO) === */
let messaging;
function initFirebase() {
    if (typeof firebase === 'undefined') return; // Si el script fue bloqueado
    const firebaseConfig = {
        apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
        authDomain: "app-vendedores-inteligente.firebaseapp.com",
        projectId: "app-vendedores-inteligente",
        storageBucket: "app-vendedores-inteligente.appspot.com",
        messagingSenderId: "583313989429",
        appId: "1:583313989429:web:c4f78617ad957c3b11367c"
    };
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
}

/* === FUNCIONES PRINCIPALES === */
async function login() {
    const clave = document.getElementById("claveInput").value.trim();
    if (!clave) return toast("⚠️ Ingresa tu clave");

    btnLoading(true);
    try {
        const res = await fetch(`${API}?accion=getRutaDelDia&clave=${clave}&t=${Date.now()}`);
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Clave incorrecta");

        estado.vendedor = clave;
        estado.nombre = data.vendedor || "Vendedor";
        estado.ruta = data.cartera.map(c => ({ ...c, visitado: false }));
        
        localStorage.setItem("vendedor_sesion", JSON.stringify({ clave, nombre: estado.nombre }));
        
        // Intentar activar notificaciones sin esperar
        activarNotificaciones().catch(e => console.warn("No se pudo activar notificaciones:", e));
        
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
        if (sesion && sesion.clave) {
            document.getElementById("claveInput").value = sesion.clave;
        }
    } catch (e) { localStorage.removeItem("vendedor_sesion"); }
}

function iniciarApp() {
    document.getElementById("view-login").classList.remove("active");
    // Forzar un reflow para asegurar que la transición funcione
    void document.getElementById("view-app").offsetWidth;
    document.getElementById("view-app").classList.add("active");
    
    document.getElementById("vendedorNombre").innerText = estado.nombre;
    renderRuta();
    actualizarProgreso();
}

async function activarNotificaciones() {
    if (!messaging) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        const token = await messaging.getToken().catch(() => null);
        if (token) {
            fetch(API, {
                method: "POST",
                body: JSON.stringify({ accion: "registrarToken", vendedor: estado.vendedor, token })
            });
        }
    }
}

/* === RENDER UI === */
function renderRuta() {
    const container = document.getElementById("listaClientes");
    container.innerHTML = ""; 

    estado.ruta.forEach((c, i) => {
        const card = document.createElement('div');
        card.className = `card ${c.visitado ? 'visitado' : ''} ${c.visitado ? (c.compro ? 'compro-si' : 'compro-no') : ''}`;
        card.innerHTML = `
            <div class="card-header">
                <h3>${c.nombre}</h3>
                <span class="badge ${c.visitado ? (c.compro ? 'si' : 'no') : 'pendiente'}">
                    ${c.visitado ? (c.compro ? 'VENTA' : 'NO') : 'PENDIENTE'}
                </span>
            </div>
            <div class="card-body">
                <p>📍 ${c.domicilio}</p>
                <p>🏙️ ${c.localidad}</p>
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

    if (card && !btnVenta && !btnNoVenta) {
        document.querySelectorAll('.card.expanded').forEach(c => c !== card && c.classList.remove('expanded'));
        card.classList.toggle('expanded');
    }
    if (btnVenta) registrarVenta(parseInt(btnVenta.dataset.i), true);
    if (btnNoVenta) abrirMotivo(parseInt(btnNoVenta.dataset.i));
}

function actualizarProgreso() {
    const total = estado.ruta.length;
    const visitados = estado.ruta.filter(c => c.visitado).length;
    const porcentaje = total === 0 ? 0 : (visitados / total) * 100;

    const circle = document.querySelector('.progress-ring .progreso-value');
    if (circle) {
        const radius = 16; // Radio fijo del SVG
        const circumference = radius * 2 * Math.PI;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference - (porcentaje / 100) * circumference;
    }

    document.getElementById("progreso-texto").innerText = `${visitados}/${total}`;
    const mensajes = ["¡Dale gas! ⛽", "Hoy se rompe 🚀", "¡Actitud ganadora! 🦁", "Ya casi estamos 💪"];
    document.getElementById("mensajeCoach").innerText = porcentaje === 100 ? "🎉 ¡Ruta finalizada!" : 
        `${estado.nombre.split(' ')[0]}, ${mensajes[Math.floor(Math.random() * mensajes.length)]}`;
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
    }).catch(e => { console.error(e); toast("⚠️ Guardado local"); });
}

let clienteIndex = null;
const sheet = document.getElementById("sheet-motivo");

function abrirMotivo(index) {
    clienteIndex = index;
    estado.motivoSeleccionado = "";
    document.querySelectorAll('#motivoOptions .chip').forEach(c => c.classList.remove('selected'));
    document.getElementById("motivoOtro").classList.add("hidden");
    document.getElementById("motivoOtro").value = "";
    sheet.classList.remove("hidden");
    setTimeout(() => sheet.classList.add("active"), 10);
}

document.getElementById("overlay-motivo").onclick = () => {
    sheet.classList.remove("active");
    setTimeout(() => sheet.classList.add("hidden"), 300);
};

document.getElementById("motivoOptions").addEventListener("click", (e) => {
    if (!e.target.classList.contains('chip')) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    e.target.classList.add('selected');
    estado.motivoSeleccionado = e.target.dataset.val;
    document.getElementById("motivoOtro").classList.toggle("hidden", estado.motivoSeleccionado !== "Otro");
});

document.getElementById("btnConfirmarMotivo").onclick = () => {
    let motivo = estado.motivoSeleccionado;
    if (!motivo) return toast("⚠️ Selecciona un motivo");
    if (motivo === "Otro") {
        motivo = document.getElementById("motivoOtro").value.trim();
        if (!motivo) return toast("⚠️ Escribe el motivo");
    }
    registrarVenta(clienteIndex, false, motivo);
    document.getElementById("overlay-motivo").click(); // Cerrar usando el mismo handler
};

/* === MAPA (CARGA LAZY) === */
function toggleMapa() {
    const modal = document.getElementById("modal-mapa");
    if (modal.classList.contains("hidden")) {
        modal.classList.remove("hidden");
        if (!map && typeof L !== 'undefined') {
            map = L.map('map').setView([-34.6, -58.4], 10);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '©OpenStreetMap' }).addTo(map);
            markers = L.layerGroup().addTo(map);
        }
        if (map) {
            setTimeout(() => { map.invalidateSize(); cargarMarcadores(); }, 200);
        } else {
            toast("❌ Mapa no disponible (bloqueado por navegador)");
        }
    } else {
        modal.classList.add("hidden");
    }
}

function cargarMarcadores() {
    if (!map || !markers) return;
    markers.clearLayers();
    const grupo = [];
    estado.ruta.forEach(c => {
        if (c.lat && c.lng) {
            const color = c.visitado ? (c.compro ? '#2ED573' : '#FF4757') : '#4CC9F0';
            L.circleMarker([c.lat, c.lng], { radius: 8, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 })
             .bindPopup(`<b>${c.nombre}</b><br>${c.domicilio}`).addTo(markers);
            grupo.push([c.lat, c.lng]);
        }
    });
    if (grupo.length) map.fitBounds(grupo, { padding: [50, 50] });
}

/* === UTILIDADES === */
function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.innerText = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
function btnLoading(isLoading) {
    const btn = document.getElementById("btnIngresar");
    btn.disabled = isLoading; btn.innerHTML = isLoading ? "⌛..." : "INGRESAR";
}
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}
function initTheme() { setTheme(localStorage.getItem('theme') || 'foco'); }
