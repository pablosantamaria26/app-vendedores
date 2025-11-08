/*****************************************
 * ⚙️ CONFIG
 *****************************************/
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";
const CLAVE_MAESTRA = "281730";

/*****************************************
 * 🧱 BASE DE VENDEDORES (LocalStorage)
 *****************************************/
function obtenerVendedores() {
  return JSON.parse(localStorage.getItem("vendedoresML") || "[]");
}
function guardarVendedores(v) {
  localStorage.setItem("vendedoresML", JSON.stringify(v));
}

/*****************************************
 * 🔐 LOGIN
 *****************************************/
const pinInput = document.getElementById("pinInput");
pinInput.addEventListener("input", () => {
  if (pinInput.value.length === 4) login(pinInput.value);
});

function login(pin) {
  const vendedores = obtenerVendedores();
  const vend = vendedores.find(v => v.pin === pin);

  if (!vend) {
    if (pin === CLAVE_MAESTRA) return abrirAdmin();
    showToast("PIN incorrecto", 2000);
    return;
  }

  localStorage.setItem("vendedorActual", vend.nombre);
  entrarHome(vend.nombre);
}

function entrarHome(nombre) {
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");
  document.getElementById("greeting").textContent = `👋 Buen día, ${nombre}`;
  showToast(`Bienvenido ${nombre}`, 2000);
  cargarDatos(nombre);
}

/*****************************************
 * 🧭 CARGA DE DATOS DESDE GAS
 *****************************************/
async function cargarDatos(vendedor) {
  try {
    const resp = await fetch(`${WORKER_URL}/?accion=getDataParaCoach&vendedor=${encodeURIComponent(vendedor)}`);
    const data = await resp.json();
    renderRuta(ordenarRuta(data));
    obtenerClima();
  } catch (err) {
    showToast("Sin conexión — Usando datos guardados", 3000);
  }
}

/*****************************************
 * ♟️ ORDEN DE RUTA
 *****************************************/
function ordenarRuta(data) {
  const hoy = new Date();
  const last = {};

  data.historial.forEach(h => {
    const d = new Date(h.fecha);
    if (!last[h.numeroCliente] || d > last[h.numeroCliente]) last[h.numeroCliente] = d;
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
 * 📋 RENDER RUTA
 *****************************************/
function renderRuta(lista) {
  const cont = document.getElementById("routeList");
  cont.innerHTML = "";
  lista.forEach(c => {
    cont.innerHTML += `<div class="client">${c.numeroCliente} — ${c.nombre}</div>`;
  });
}

/*****************************************
 * 🌤️ CLIMA
 *****************************************/
function obtenerClima() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`).then(r => r.json());
    showToast(`Hoy ${w.current_weather.temperature}°C 🌤️`, 2600);
  });
}

/*****************************************
 * ☀️/🌙 Tema
 *****************************************/
document.getElementById("themeToggle").onclick = () => {
  const d = document.documentElement;
  const isNight = d.getAttribute("data-theme") === "noche";
  d.setAttribute("data-theme", isNight ? "dia" : "noche");
};

/*****************************************
 * 🍞 Toast
 *****************************************/
function showToast(msg, time=2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), time);
}

/*****************************************
 * 🛠️ PANEL ADMINISTRADOR
 *****************************************/
function abrirAdmin() {
  document.body.innerHTML = `
  <div class="screen active admin">
    <h2>Panel Administrador</h2>
    
    <div id="listaVend"></div>

    <div class="admin-add">
      <input id="nuevoNombre" placeholder="Nombre (MARTIN)">
      <input id="nuevoPIN" placeholder="PIN (4 dígitos)" inputmode="numeric" maxlength="4">
      <button onclick="agregarVendedor()">Agregar</button>
    </div>

    <button class="volver" onclick="location.reload()">Salir</button>
  </div>
  `;
  refrescarListaAdmin();
}

function refrescarListaAdmin() {
  const cont = document.getElementById("listaVend");
  const vendedores = obtenerVendedores();
  cont.innerHTML = vendedores.map(v => 
    `<div class="admin-item">${v.nombre} — ${v.pin}</div>`
  ).join("");
}

function agregarVendedor() {
  const nombre = document.getElementById("nuevoNombre").value.trim().toUpperCase();
  const pin = document.getElementById("nuevoPIN").value.trim();
  if (!nombre || !pin) return;
  const vendedores = obtenerVendedores();
  vendedores.push({ nombre, pin });
  guardarVendedores(vendedores);
  refrescarListaAdmin();
}
