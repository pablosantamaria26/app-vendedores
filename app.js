/*****************************************
 * CONFIG
 *****************************************/
const CLAVE_MAESTRA = "281730";
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let vendedorActual = null;
let mapa;
let marcadores = [];

/*****************************************
 * LOGIN
 *****************************************/
const pinInput = document.getElementById("pinInput");
pinInput.addEventListener("input", () => {
  let v = pinInput.value;
  if (v.length >= 4) intentarLogin(v);
});

function intentarLogin(pin) {
  if (pin === CLAVE_MAESTRA) return abrirPanelAdmin();

  const v = getVendedores().find(x => x.pin === pin && x.activo);
  if (!v) return showToast("PIN incorrecto");

  vendedorActual = v.nombre;
  localStorage.setItem("vendedorActual", vendedorActual);

  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");
  document.getElementById("greeting").textContent = `👋 Buen día, ${vendedorActual}`;

  cargarDatos();
}

/*****************************************
 * DATOS DESDE BACKEND
 *****************************************/
async function cargarDatos() {
  const resp = await fetch(`${WORKER_URL}/?accion=getDataParaCoach&vendedor=${vendedorActual}`);
  const data = await resp.json();

  inicializarMapa(data.cartera);
  renderRuta(data.cartera);
}

/*****************************************
 * MAPA + MARCADORES
 *****************************************/
function inicializarMapa(cartera) {
  if (!cartera.length) return;

  mapa = new google.maps.Map(document.getElementById("map"), {
    center: { lat: parseFloat(cartera[0].lat), lng: parseFloat(cartera[0].lng) },
    zoom: 12,
    styles: []
  });

  cartera.forEach(c => {
    const m = new google.maps.Marker({
      position: { lat: parseFloat(c.lat), lng: parseFloat(c.lng) },
      map: mapa,
      title: c.nombre
    });

    m.addListener("click", () => {
      showToast(`📍 ${c.nombre}\nÚltimo pedido: revisar`);
      setTimeout(() => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`, "_blank");
      }, 1200);
    });

    marcadores.push(m);
  });
}

/*****************************************
 * RUTA VISUAL
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
        <div class="btn" onclick="marcarVisitado(this, '${c.numeroCliente}')">Visitado</div>
      </div>
    `;
    cont.appendChild(div);
  });
}

function marcarVisitado(btn, cliente) {
  btn.parentElement.innerHTML = `
    <div class="btn" onclick="guardarVisita('${cliente}')">Guardar visita ✅</div>
  `;
  showToast("Marcado como visitado");
}

function guardarVisita(cliente) {
  showToast("Visita guardada ✅");
  document.querySelector(`[onclick*="${cliente}"]`).closest(".client-card").remove();
}

/*****************************************
 * PANEL ADMIN
 *****************************************/
function getVendedores() {
  return JSON.parse(localStorage.getItem("vendedoresML") || "[]");
}
function saveVendedores(v) {
  localStorage.setItem("vendedoresML", JSON.stringify(v));
}
function abrirPanelAdmin() {
  document.body.innerHTML = `<h2>Panel Admin</h2>`;
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
