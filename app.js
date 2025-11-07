/***************************************************
 * CONFIG
 ***************************************************/
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let VENDEDOR = null;

/***************************************************
 * LOGIN AUTOMÁTICO AL ESCRIBIR 4 NÚMEROS
 ***************************************************/
const pinInput = document.getElementById("pinInput");
window.addEventListener("load", () => setTimeout(() => pinInput.focus(), 200));

pinInput.addEventListener("input", () => {
  if (pinInput.value.length === 4) {
    loginConPin(pinInput.value);
  }
});

async function loginConPin(pin) {
  showToast("Verificando…", 1200);

  try {
    const resp = await fetch(`${WORKER_URL}?accion=loginConPin&pin=${pin}`);
    const data = await resp.json();

    if (!data.ok) {
      showError("PIN incorrecto");
      pinInput.value = "";
      return;
    }

    VENDEDOR = data.vendedor;
    localStorage.setItem("VENDEDOR", VENDEDOR);

    mostrarHome();
    registrarTokenFCM(VENDEDOR);

  } catch (err) {
    console.error(err);
    showError("Sin conexión con el servidor");
  }
}

/***************************************************
 * HOME
 ***************************************************/
async function mostrarHome() {
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");

  document.getElementById("greeting").textContent = `👋 Buen día, ${VENDEDOR}`;

  cargarRutaInteligente();
}

/***************************************************
 * CARGAR RUTA
 ***************************************************/
async function cargarRutaInteligente() {
  const resp = await fetch(`${WORKER_URL}?accion=getDataParaCoach&vendedor=${VENDEDOR}`);
  const data = await resp.json();

  if (!data.ok) return showError("No se pudo cargar los datos");

  const ruta = ordenarRuta(data);
  renderRuta(ruta);
  obtenerClima();
}

/***************************************************
 * ORDEN INTELIGENTE DE RUTA
 ***************************************************/
function ordenarRuta(data) {
  const hoy = new Date();
  const last = {};

  data.historial.forEach(h => {
    const d = new Date(h.fecha);
    if (!last[h.numeroCliente] || d > last[h.numeroCliente]) last[h.numeroCliente] = d;
  });

  const g1 = [], g2 = [], g3 = [];

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

/***************************************************
 * MOSTRAR RUTA
 ***************************************************/
function renderRuta(lista) {
  const cont = document.getElementById("routeList");
  cont.innerHTML = "";
  lista.forEach(c => {
    cont.innerHTML += `
      <div class="client">
        <strong>${c.numeroCliente}</strong> — ${c.nombre}<br>
        <small>${c.domicilio} · ${c.localidad}</small>
      </div>`;
  });
}

/***************************************************
 * CLIMA
 ***************************************************/
async function obtenerClima() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async pos => {
    const weather = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`
    ).then(r => r.json());

    showToast(`🌤️ Hoy ${weather.current_weather.temperature}°C`, 2600);
  });
}

/***************************************************
 * FCM TOKEN
 ***************************************************/
async function registrarTokenFCM(vendedor) {
  if (!navigator.serviceWorker) return;
  if (!window.FCM || !FCM.getToken) return;

  try {
    const token = await FCM.getToken();
    if (!token) return;

    await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardarToken", vendedor, token })
    });

    console.log("✅ Token guardado:", token);

  } catch (e) {
    console.warn("No se pudo guardar token", e);
  }
}

/***************************************************
 * TOAST + ERRORS
 ***************************************************/
function showToast(msg, time = 2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), time);
}

function showError(msg) {
  showToast(msg, 2600);
}
