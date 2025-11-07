/*****************************************************
 * 🌎 CONFIG
 *****************************************************/
const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

/*****************************************************
 * 🎨 CAMBIO DE TEMA (Día / Noche)
 *****************************************************/
const toggle = document.getElementById("themeToggle");
toggle.onclick = () => {
  const current = document.documentElement.getAttribute("data-theme") || "dia";
  const next = current === "dia" ? "noche" : "dia";
  document.documentElement.setAttribute("data-theme", next);
  toggle.textContent = next === "dia" ? "🌙" : "☀️";
};

/*****************************************************
 * 🔐 LOGIN POR PIN AUTOMÁTICO
 *****************************************************/
const pinInput = document.getElementById("pinInput");
let vendedor = null;

window.addEventListener("load", () => setTimeout(() => pinInput.focus(), 200));

pinInput.addEventListener("input", async () => {
  if (pinInput.value.length === 4) {
    loginConPin(pinInput.value);
  }
});

async function loginConPin(pin) {
  showToast("Verificando PIN...");

  try {
    const resp = await fetch(`${API}?accion=loginConPin&pin=${pin}`);
    const data = await resp.json();

    if (!data.ok) return showToast("PIN incorrecto ❌");

    vendedor = data.vendedor;
    localStorage.setItem("vendedor", vendedor);

    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("homeScreen").classList.add("active");

    showToast(`Bienvenido ${vendedor} 👋`, 2000);
    cargarHome();

  } catch (err) {
    showToast("Error de conexión");
  }
}

/*****************************************************
 * 🏠 HOME
 *****************************************************/
async function cargarHome() {
  document.getElementById("greeting").textContent = `👋 Hola ${vendedor}`;

  const resp = await fetch(`${API}?accion=getDataParaCoach&vendedor=${vendedor}`);
  const data = await resp.json();
  if (!data.ok) return showToast("No se pudo cargar datos");

  const ruta = ordenarRuta(data.cartera, data.historial);
  renderRuta(ruta);
  obtenerClima();
}

/*****************************************************
 * 📍 ORDEN INTELIGENTE DE VISITA
 *****************************************************/
function ordenarRuta(cartera, historial) {
  const hoy = new Date();
  const last = {};

  historial.forEach(h => {
    const d = new Date(h.fecha);
    if (!last[h.numeroCliente] || d > last[h.numeroCliente]) last[h.numeroCliente] = d;
  });

  const g1 = [], g2 = [], g3 = [];

  cartera.forEach(c => {
    const f = last[c.numeroCliente];
    if (!f) return g1.push(c);

    const diff = (hoy - f) / 86400000;
    if (diff > 14) g1.push(c);
    else if (diff > 7) g2.push(c);
    else g3.push(c);
  });

  return [...g1, ...g2, ...g3];
}

/*****************************************************
 * 🧾 Mostrar lista
 *****************************************************/
function renderRuta(lista) {
  const cont = document.getElementById("routeList");
  cont.innerHTML = "";
  lista.forEach(c => {
    cont.innerHTML += `
      <div class="client">
        <b>${c.numeroCliente}</b> — ${c.nombre}<br>
        <small>${c.localidad}</small>
      </div>`;
  });
}

/*****************************************************
 * ⛅ Clima del vendedor
 *****************************************************/
function obtenerClima() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const weather = await fetch(url).then(r => r.json());
    showToast(`Hoy ${weather.current_weather.temperature}°C 🌤️`, 2600);
  });
}

/*****************************************************
 * 🍞 Toast
 *****************************************************/
function showToast(msg, time = 2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), time);
}
