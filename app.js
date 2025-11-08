/*****************************************
 * CONFIG
 *****************************************/
const CLAVE_MAESTRA = "281730";
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let vendedorActual = localStorage.getItem("vendedorActual") || null;
let mapa;
let marcadores = [];

/*****************************************
 * LOGIN
 *****************************************/
const pinInput = document.getElementById("pinInput");
pinInput.addEventListener("input", () => {
  let v = pinInput.value.trim();
  if (v.length >= 6 && v === CLAVE_MAESTRA) return abrirPanelAdmin();
  if (v.length === 4) intentarLogin(v);
});

function intentarLogin(pin) {
  const vendedores = getVendedores();
  const v = vendedores.find(x => x.pin === pin && x.activo);

  if (!v) return showToast("PIN incorrecto");

  vendedorActual = v.nombre;
  localStorage.setItem("vendedorActual", vendedorActual);

  abrirHome();
}

/*****************************************
 * AUTO LOGIN SI YA ESTABA LOGUEADO
 *****************************************/
window.addEventListener("load", () => {
  if (vendedorActual) abrirHome();
});

/*****************************************
 * IR AL HOME
 *****************************************/
function abrirHome() {
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");
  document.getElementById("greeting").textContent = `👋 Buen día, ${vendedorActual}`;
  cargarDatos();
}

/*****************************************
 * OBTENER DATOS DESDE BACKEND
 *****************************************/
async function cargarDatos() {
  try {
    const resp = await fetch(`${WORKER_URL}/?accion=getDataParaCoach&vendedor=${encodeURIComponent(vendedorActual)}`);
    const data = await resp.json();

    if (!data.ok) return showToast("No se pudo cargar la ruta");

    inicializarMapa(data.cartera);
    const ordenada = ordenarRuta(data);
    renderRuta(ordenada);

  } catch {
    showToast("Sin conexión — datos no cargados");
  }
}

/*****************************************
 * ORDEN ESTRATÉGICO DE VISITA
 *****************************************/
function ordenarRuta(data) {
  const hoy = new Date();
  const last = {};

  data.historial.forEach(h => {
    const f = new Date(h.fecha);
    if (!last[h.numeroCliente] || f > last[h.numeroCliente]) last[h.numeroCliente] = f;
  });

  const g1=[], g2=[], g3=[];
  data.cartera.forEach(c => {
    const f = last[c.numeroCliente];
    if (!f) return g1.push(c);
    const diff = (hoy - f) / 86400000;
    if (diff > 14) g1.push(c);
    else if (diff > 7) g2.push(c);
    else g3.push(c);
  });

  return [...g1, ...g2, ...g3];
}

/*****************************************
 * MAPA + MARCADORES
 *****************************************/
function inicializarMapa(cartera) {
  if (!cartera.length) return;

  mapa = new google.maps.Map(document.getElementById("map"), {
    center: { lat: parseFloat(cartera[0].lat), lng: parseFloat(cartera[0].lng) },
    zoom: 12
  });

  marcadores.forEach(m => m.setMap(null));
  marcadores = [];

  cartera.forEach(c => {
    const marcador = new google.maps.Marker({
      position: { lat: parseFloat(c.lat), lng: parseFloat(c.lng) },
      map: mapa,
      title: c.nombre
    });

    marcador.addListener("click", () => abrirModalCliente(c));
    marcadores.push(marcador);
  });
}

/*****************************************
 * MODAL CLIENTE
 *****************************************/
function abrirModalCliente(c) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box">
      <h2>${c.nombre}</h2>
      <p>${c.domicilio} — ${c.localidad}</p>
      <button class="btn" onclick="abrirRuta('${c.lat}','${c.lng}')">📍 Ir ahora</button>
      <button class="btnCerrar" onclick="this.parentElement.parentElement.remove()">Cerrar</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function abrirRuta(lat, lng) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
}

/*****************************************
 * LISTA DE CLIENTES (TARJETAS)
 *****************************************/
function renderRuta(lista) {
  const cont = document.getElementById("routeList");
  cont.innerHTML = "";

  lista.forEach(c => {
    const div = document.createElement("div");
    div.className = "client-card";

    div.innerHTML = `
      <b>${c.numeroCliente} — ${c.nombre}</b>
      <small>${c.localidad}</small>

      <div class="btn-row">
        <div class="btn" onclick="marcarVisitado('${c.numeroCliente}', this)">✅ Visitado</div>
      </div>
    `;

    cont.appendChild(div);
  });
}

function marcarVisitado(cliente, btn) {
  btn.parentElement.innerHTML = `
    <div class="btn" onclick="marcarCompra('${cliente}', this)">🛒 Compró</div>
    <div class="btn" onclick="guardarVisita('${cliente}')">❌ No compró</div>
  `;
  showToast("Marcado como visitado");
}

function marcarCompra(cliente, btn) {
  btn.parentElement.innerHTML = `
    <div class="btn" onclick="guardarVisita('${cliente}')">Guardar visita ✅</div>
  `;
  showToast("Marcado como que compró 🛒");
}

function guardarVisita(cliente) {
  showToast("Visita guardada ✅");
  document.querySelector(`[onclick*="${cliente}"]`).closest(".client-card").remove();
}

/*****************************************
 * PANEL ADMIN
 *****************************************/
function getVendedores() { return JSON.parse(localStorage.getItem("vendedoresML") || "[]"); }
function saveVendedores(v) { localStorage.setItem("vendedoresML", JSON.stringify(v)); }

function abrirPanelAdmin() {
  document.body.innerHTML = `
    <div class="admin">
      <h2>Panel de Configuración</h2>
      <div id="listaVendedores"></div>
      <div class="admin-add">
        <input id="nombreVend" placeholder="Nombre (MARTIN)">
        <input id="pinVend" placeholder="PIN (0001)" inputmode="numeric" maxlength="4">
        <button onclick="agregarVendedor()">Agregar</button>
      </div>
      <button class="volver" onclick="location.reload()">Salir</button>
    </div>
  `;
  refrescarListaVendedores();
}

function refrescarListaVendedores() {
  const cont = document.getElementById("listaVendedores");
  cont.innerHTML = getVendedores().map(v => `<div class="admin-item">${v.nombre} — ${v.pin}</div>`).join("");
}

function agregarVendedor() {
  const nombre = nombreVend.value.trim().toUpperCase();
  const pin = pinVend.value.trim();
  if (!nombre || !pin) return showToast("Complete los campos");
  const vs = getVendedores(); vs.push({ nombre, pin, activo: true });
  saveVendedores(vs);
  refrescarListaVendedores();
  showToast("Vendedor agregado ✅");
}

/*****************************************
 * TEMA
 *****************************************/
document.getElementById("themeToggle").onclick = () => {
  const d = document.documentElement;
  d.setAttribute("data-theme", d.getAttribute("data-theme") === "noche" ? "dia" : "noche");
};

/*****************************************
 * TOAST
 *****************************************/
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}
