/* === CONFIG === */
const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";
let estado = {
    vendedor: "",
    nombre: "",
    ruta: [],
    motivoSeleccionado: ""
};
let map, markers = L.layerGroup();

/* === INICIO & EVENTOS === */
document.addEventListener("DOMContentLoaded", () => {
    checkSesion();
    initTheme();
});

document.getElementById("btnIngresar").onclick = login;
document.getElementById("claveInput").onkeyup = (e) => e.key === "Enter" && login();
document.getElementById("fabMapa").onclick = toggleMapa;
document.getElementById("btnCerrarMapa").onclick = toggleMapa;

// Delegación de eventos para la lista (mejor performance)
document.getElementById("listaClientes").onclick = (e) => {
    const card = e.target.closest('.card');
    const btnVenta = e.target.closest('.btn-venta');
    const btnNoVenta = e.target.closest('.btn-noventa');

    if (card && !btnVenta && !btnNoVenta) {
        // Toggle acordeón al tocar la tarjeta
        document.querySelectorAll('.card.expanded').forEach(c => c !== card && c.classList.remove('expanded'));
        card.classList.toggle('expanded');
    }
    if (btnVenta) registrarVenta(btnVenta.dataset.i, true);
    if (btnNoVenta) abrirMotivo(btnNoVenta.dataset.i);
};

// Eventos de Temas
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.onclick = () => setTheme(btn.dataset.theme);
});

/* === FUNCIONES PRINCIPALES === */
async function login() {
    const clave = document.getElementById("claveInput").value.trim();
    if (!clave) return toast("⚠️ Ingresa tu clave");

    btnLoading(true);
    try {
        const res = await fetch(`${API}?accion=getRutaDelDia&clave=${clave}`);
        const data = await res.json();

        if (!data.ok) throw new Error("Clave incorrecta");

        // Guardar estado
        estado.vendedor = clave;
        estado.nombre = data.vendedor || "Vendedor";
        estado.ruta = data.cartera.map(c => ({ ...c, visitado: false })); // Reseteo local simple
        
        localStorage.setItem("vendedor_sesion", JSON.stringify({ clave, nombre: estado.nombre }));
        
        iniciarApp();

    } catch (e) {
        toast("❌ Error: " + e.message);
    } finally {
        btnLoading(false);
    }
}

function checkSesion() {
    const sesion = JSON.parse(localStorage.getItem("vendedor_sesion"));
    if (sesion) {
        document.getElementById("claveInput").value = sesion.clave;
        // Opcional: auto-login
        // login();
    }
}

function iniciarApp() {
    document.getElementById("view-login").classList.remove("active");
    document.getElementById("view-app").classList.add("active");
    
    document.getElementById("vendedorNombre").innerText = estado.nombre;
    renderRuta();
    actualizarProgreso();
}

/* === RENDER UI === */
function renderRuta() {
    const container = document.getElementById("listaClientes");
    container.innerHTML = ""; // Limpiar

    estado.ruta.forEach((c, i) => {
        const card = document.createElement('div');
        card.className = `card ${c.visitado ? 'visitado' : ''} ${c.visitado ? (c.compro ? 'compro-si' : 'compro-no') : ''}`;
        card.innerHTML = `
            <div class="card-header">
                <h3>${c.nombre}</h3>
                <span class="badge ${c.visitado ? (c.compro ? 'si' : 'no') : 'pendiente'}">
                    ${c.visitado ? (c.compro ? 'VENTA' : 'NO COMPRÓ') : 'PENDIENTE'}
                </span>
            </div>
            <div class="card-body">
                <p>📍 ${c.domicilio}</p>
                <p>🏙️ ${c.localidad}</p>
            </div>
            ${!c.visitado ? `
            <div class="card-actions">
                <button class="btn-action btn-venta" data-i="${i}">✅ VENTA</button>
                <button class="btn-action btn-noventa" data-i="${i}">❌ NO</button>
            </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function actualizarProgreso() {
    const total = estado.ruta.length;
    const visitados = estado.ruta.filter(c => c.visitado).length;
    const porcentaje = total === 0 ? 0 : Math.round((visitados / total) * 100);

    // Actualizar anillo de progreso SVG
    const circle = document.querySelector('.progress-ring .progreso-value');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference - (porcentaje / 100) * circumference;

    document.getElementById("progreso-texto").innerText = `${visitados}/${total}`;
    
    // Mensaje Coach dinámico
    const mensajes = ["¡Vamos por más!", "Hoy rompes la zona 🚀", "¡Actitud ganadora!", "Casi llegamos 💪"];
    document.getElementById("mensajeCoach").innerText = porcentaje === 100 ? "🎉 ¡Ruta completada!" : 
        `${estado.nombre.split(' ')[0]}, ${mensajes[Math.floor(Math.random() * mensajes.length)]}`;
}

/* === ACCIONES === */
async function registrarVenta(index, compro, motivo = "") {
    const cliente = estado.ruta[index];
    
    // Optimistic UI update (actualizamos antes de esperar al servidor)
    cliente.visitado = true;
    cliente.compro = compro;
    cliente.motivo = motivo;
    renderRuta();
    actualizarProgreso();
    if (compro) toast("🎉 ¡Venta registrada!");

    // Enviar al servidor en background
    try {
         await fetch(API, {
            method: "POST",
            body: JSON.stringify({
                accion: "registrarVisita",
                vendedor: estado.nombre,
                cliente: cliente.numeroCliente,
                compro,
                motivo
            })
        });
    } catch (e) {
        console.error("Error guardando visita", e);
        toast("⚠️ Error de conexión, se guardó localmente");
        // Aquí podrías implementar una cola de reintentos si falla
    }
}

/* === MOTIVO NO COMPRA (BOTTOM SHEET) === */
let clienteActualIndex = null;
const sheetMotivo = document.getElementById("sheet-motivo");
const overlayMotivo = document.getElementById("overlay-motivo");

function abrirMotivo(index) {
    clienteActualIndex = index;
    estado.motivoSeleccionado = "";
    document.querySelectorAll('#motivoOptions .chip').forEach(c => c.classList.remove('selected'));
    document.getElementById("motivoOtro").classList.add("hidden");
    document.getElementById("motivoOtro").value = "";
    
    sheetMotivo.classList.remove("hidden");
    // Pequeño timeout para que la animación CSS funcione
    setTimeout(() => sheetMotivo.classList.add("active"), 10);
}

function cerrarMotivo() {
    sheetMotivo.classList.remove("active");
    setTimeout(() => sheetMotivo.classList.add("hidden"), 300);
}

// Eventos del Sheet
overlayMotivo.onclick = cerrarMotivo;

document.getElementById("motivoOptions").onclick = (e) => {
    if (!e.target.classList.contains('chip')) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    e.target.classList.add('selected');
    estado.motivoSeleccionado = e.target.dataset.val;
    
    document.getElementById("motivoOtro").classList.toggle("hidden", estado.motivoSeleccionado !== "Otro");
};

document.getElementById("btnConfirmarMotivo").onclick = () => {
    if (!estado.motivoSeleccionado) return toast("⚠️ Selecciona un motivo");
    let motivoFinal = estado.motivoSeleccionado;
    if (motivoFinal === "Otro") {
        motivoFinal = document.getElementById("motivoOtro").value.trim();
        if (!motivoFinal) return toast("⚠️ Escribe el motivo");
    }
    
    registrarVenta(clienteActualIndex, false, motivoFinal);
    cerrarMotivo();
    toast("Visita registrada");
};

/* === MAPA === */
function toggleMapa() {
    const modal = document.getElementById("modal-mapa");
    const estaAbierto = !modal.classList.contains("hidden");
    
    if (estaAbierto) {
        modal.classList.add("hidden");
    } else {
        modal.classList.remove("hidden");
        if (!map) initMapa();
        setTimeout(() => map.invalidateSize(), 300); // Fix render leaflet
        cargarMarcadores();
    }
}

function initMapa() {
    map = L.map('map').setView([-34.6, -58.4], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB'
    }).addTo(map);
    markers.addTo(map);
}

function cargarMarcadores() {
    markers.clearLayers();
    const grupo = [];
    estado.ruta.forEach(c => {
        if (c.lat && c.lng) {
            const color = c.visitado ? (c.compro ? '#2ED573' : '#FF4757') : '#4CC9F0';
            const marker = L.circleMarker([c.lat, c.lng], {
                radius: 8, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1
            }).bindPopup(`<b>${c.nombre}</b><br>${c.domicilio}`);
            markers.addLayer(marker);
            grupo.push([c.lat, c.lng]);
        }
    });
    if (grupo.length > 0) map.fitBounds(grupo, { padding: [50, 50] });
}

/* === UTILIDADES === */
function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function btnLoading(isLoading) {
    const btn = document.getElementById("btnIngresar");
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? "⌛ Cargando..." : "INGRESAR";
}

function setTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('theme', themeName);
    document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === themeName);
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'foco';
    setTheme(savedTheme);
}
