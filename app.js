// ---- CONFIG ----
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let vendedor = null;

// ---- Cambio de Tema ----
const toggle = document.getElementById("themeToggle");
toggle.onclick = () => {
  const isNight = document.documentElement.getAttribute("data-theme") === "noche";
  document.documentElement.setAttribute("data-theme", isNight ? "dia" : "noche");
  toggle.textContent = isNight ? "🌙" : "☀️";
};

// ---- Login Auto PIN ----
const pinInput = document.getElementById("pinInput");
window.addEventListener("load", () => setTimeout(() => pinInput.focus(), 200));

pinInput.addEventListener("input", async () => {
  if (pinInput.value.length === 4) {
    vendedor = localStorage.getItem("vendedor");
    if (!vendedor) vendedor = prompt("Ingrese su nombre (MAYUSC):").trim().toUpperCase();
    localStorage.setItem("vendedor", vendedor);
    login(vendedor, pinInput.value);
  }
});

// ---- Login ----
async function login(vendedor, pin) {
  showToast("Verificando...", 1500);

  const r = await fetch(API_URL + "/login", {
    method: "POST",
    body: JSON.stringify({ vendedor, pin }),
  }).then(r => r.json());

  if (!r.ok) return showToast("PIN incorrecto", 2000);

  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");

  cargarHome();
}

// ---- Toast ----
function showToast(msg, time=2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), time);
}

// ---- Home ----
async function cargarHome() {
  document.getElementById("greeting").textContent = `👋 Buen día, ${vendedor}`;

  // Cargar datos del vendedor
  const data = await fetch(API_URL + "/datos", {
    method: "POST",
    body: JSON.stringify({ vendedor }),
  }).then(r => r.json());

  // Clasificación + orden inteligente
  const ruta = ordenarRuta(data);
  renderRuta(ruta);

  // Clima
  obtenerClima(ruta);
}

// ---- Orden estratégico de ruta ----
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

// ---- Mostrar ruta ----
function renderRuta(lista) {
  const cont = document.getElementById("routeList");
  cont.innerHTML = "";
  lista.forEach(c => {
    cont.innerHTML += `<div class="client">${c.numeroCliente} — ${c.nombre}</div>`;
  });
}

// ---- Clima ----
async function obtenerClima(lista) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`).then(r=>r.json());
    showToast(`Hoy ${weather.current_weather.temperature}°C 🌤️`, 2600);
  });
}
