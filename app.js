/*****************************************
 * ⚙️ CONFIG
 *****************************************/
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";
const CLAVE_MAESTRA = "2817";

/*****************************************
 * 🗄️ Vendedores en almacenamiento local
 *****************************************/
function getVendedores() {
  return JSON.parse(localStorage.getItem("vendedoresML") || "[]");
}

function saveVendedores(vendedores) {
  localStorage.setItem("vendedoresML", JSON.stringify(vendedores));
}

/*****************************************
 * 🔐 LOGIN POR PIN
 *****************************************/
const pinInput = document.getElementById("pinInput");

pinInput.addEventListener("input", () => {
  const v = pinInput.value;

  // Si es clave maestra → siempre 6 dígitos
  if (v === CLAVE_MAESTRA) {
    pinInput.value = "";
    abrirPanelAdmin();
    return;
  }

  // Si tiene entre 1 y 6 dígitos → esperar completar
  if (v.length < 4) return;

  // Cuando llega a 4 → intentamos login vendedor
  if (v.length === 4) {
    intentarLogin(v);
    pinInput.value = "";
  }

  // Si escribe más de 4 dígitos → lo limpiamos
  if (v.length > 4) {
    pinInput.value = v.slice(0, 4);
  }
});


function intentarLogin(pin) {
  // 1) Si es clave maestra → abrir configuración
  if (pin === CLAVE_MAESTRA) {
    abrirPanelAdmin();
    return;
  }

  // 2) Buscar vendedor por PIN
  const vendedores = getVendedores();
  const vendedor = vendedores.find(v => v.pin === pin && v.activo);

  if (!vendedor) {
    showToast("PIN incorrecto", 2000);
    pinInput.value = "";
    return;
  }

  // 3) Guardar vendedor activo
  localStorage.setItem("vendedorActual", vendedor.nombre);

  // 4) Entrar a Home
  abrirHome(vendedor.nombre);
}

/*****************************************
 * 🏠 HOME
 *****************************************/
function abrirHome(nombre) {
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");
  document.getElementById("greeting").textContent = `👋 Buen día, ${nombre}`;
  showToast(`Bienvenido ${nombre}`, 2000);
  cargarDatos(nombre);
}

/*****************************************
 * 📡 Obtener datos de la hoja vía Worker
 *****************************************/
async function cargarDatos(vendedor) {
  try {
    const resp = await fetch(`${WORKER_URL}/?accion=getDataParaCoach&vendedor=${encodeURIComponent(vendedor)}`);
    const data = await resp.json();
    renderRuta(ordenarRuta(data));
    obtenerClima();
  } catch {
    showToast("Sin conexión — usando datos guardados", 3000);
  }
}

/*****************************************
 * ♟️ Orden inteligente de ruta
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
 * 📋 Mostrar ruta
 *****************************************/
function renderRuta(lista) {
  const cont = document.getElementById("routeList");
  cont.innerHTML = "";
  lista.forEach(c => {
    cont.innerHTML += `<div class="client">${c.numeroCliente} — ${c.nombre}</div>`;
  });
}

/*****************************************
 * 🌤️ Clima
 *****************************************/
function obtenerClima() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`).then(r=>r.json());
    showToast(`Hoy ${w.current_weather.temperature}°C 🌤️`, 2500);
  });
}

/*****************************************
 * 🎨 Tema
 *****************************************/
document.getElementById("themeToggle").onclick = () => {
  const d = document.documentElement;
  const oscuro = d.getAttribute("data-theme") === "noche";
  d.setAttribute("data-theme", oscuro ? "dia" : "noche");
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
function abrirPanelAdmin() {
  document.body.innerHTML = `
  <div class="screen active admin">
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
  const vendedores = getVendedores();
  cont.innerHTML = vendedores.map(v =>
    `<div class="admin-item">${v.nombre} — ${v.pin}</div>`
  ).join("");
}

function agregarVendedor() {
  const nombre = document.getElementById("nombreVend").value.trim().toUpperCase();
  const pin = document.getElementById("pinVend").value.trim();

  if (!nombre || !pin) return showToast("Complete los datos", 2000);

  const vendedores = getVendedores();
  vendedores.push({ nombre, pin, activo: true });
  saveVendedores(vendedores);

  refrescarListaVendedores();
  showToast("Vendedor agregado ✅", 2000);
}
