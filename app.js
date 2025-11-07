/*****************************************
 * 🌐 CONFIG
 *****************************************/
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

/*****************************************
 * 🎨 CAMBIO DE TEMA
 *****************************************/
const toggle = document.getElementById("themeToggle");
toggle.onclick = () => {
  const isNight = document.documentElement.getAttribute("data-theme") === "noche";
  document.documentElement.setAttribute("data-theme", isNight ? "dia" : "noche");
  toggle.textContent = isNight ? "🌙" : "☀️";
};

/*****************************************
 * 🔐 LOGIN AUTOMÁTICO CON PIN (4 DÍGITOS)
 *****************************************/
const pinInput = document.getElementById("pinInput");
let vendedor = null;

window.addEventListener("load", () => setTimeout(() => pinInput.focus(), 200));

pinInput.addEventListener("input", async () => {
  if (pinInput.value.length === 4) {
    loginConPin(pinInput.value);
  }
});

/*****************************************
 * 🟦 LOGIN → API
 *****************************************/
async function loginConPin(pin) {
  showToast("Verificando...", 1500);

  try {
    const url = `${WORKER_URL}/?accion=loginConPin&pin=${encodeURIComponent(pin)}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (!data.ok) return showToast("PIN incorrecto", 2000);

    vendedor = data.vendedor;  // ← viene desde la tabla Config_Vendedores
    localStorage.setItem("vendedor", vendedor);

    // Pasamos a la pantalla principal
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("homeScreen").classList.add("active");

    showToast(`Bienvenido ${vendedor} 👋`, 2500);
    cargarHome();

  } catch (err) {
    console.error(err);
    showToast("Error de conexión", 2500);
  }
}

/*****************************************
 * 🌤️ HOME + RUTA + CLIMA
 *****************************************/
async function cargarHome() {

  document.getElementById("greeting").textContent = `👋 Buen día, ${vendedor}`;

  // Pedimos datos al backend
  const resp = await fetch(`${WORKER_URL}/?accion=getDataParaCoach&vendedor=${encodeURIComponent(vendedor)}`);
  const data = await resp.json();

  const rutaOrdenada = ordenarRuta(data);
  renderRuta(rutaOrdenada);

  obtenerClima();
}

/*****************************************
 * ♟️ ORDEN ESTRATÉGICO DE VISITA
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
 * 📋 MOSTRAR LISTA
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
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`).then(r=>r.json());
    showToast(`Hoy ${weather.current_weather.temperature}°C 🌤️`, 2600);
  });
}

/*****************************************
 * 💬 TOAST
 *****************************************/
function showToast(msg, time=2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), time);
}
