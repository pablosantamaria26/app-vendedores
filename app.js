/*****************************************
 * CONFIG
 *****************************************/
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";
let vendedorActual = localStorage.getItem("vendedorActual") || null;
let mapa;
let marcadores = [];

/*****************************************
 * LOGIN
 *****************************************/
const pinInput = document.getElementById("pinInput");
pinInput.addEventListener("input", () => {
  if (pinInput.value.length >= 4) login(pinInput.value);
});

async function login(pin) {
  const resp = await fetch(`${WORKER_URL}/?accion=loginConPin&pin=${pin}`);
  const data = await resp.json();

  if (!data.ok) return showToast("PIN incorrecto");

  vendedorActual = data.vendedor;
  localStorage.setItem("vendedorActual", vendedorActual);

  abrirHome();
}

function abrirHome() {
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");
  document.getElementById("greeting").textContent = `👋 Buen día, ${vendedorActual}`;

  cargarRuta();
}

/*****************************************
 * CARGAR RUTA DEL DÍA
 *****************************************/
async function cargarRuta() {
  const resp = await fetch(`${WORKER_URL}/?accion=getRutaDelDia&vendedor=${vendedorActual}`);
  const data = await resp.json();
  if (!data.ok) return showToast("Error cargando ruta");

  inicializarMapa(data.cartera);
  renderRuta(data.cartera);
}

/*****************************************
 * MAPA
 *****************************************/
function inicializarMapa(cartera) {
  if (!cartera.length) return;

  mapa = new google.maps.Map(document.getElementById("map"), {
    center: { lat: parseFloat(cartera[0].lat), lng: parseFloat(cartera[0].lng) },
    zoom: 12
  });

  cartera.forEach(c => {
    const m = new google.maps.Marker({
      position: { lat: parseFloat(c.lat), lng: parseFloat(c.lng) },
      map: mapa,
      title: c.nombre
    });

    m.addListener("click", () => {
      showToast(`📍 ${c.nombre}`);
      setTimeout(() => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`, "_blank");
      }, 900);
    });

    marcadores.push(m);
  });
}

/*****************************************
 * LISTA DE CLIENTES
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
        <div class="btn compr" onclick="registrarCompra('${c.numeroCliente}')">✔ Compró</div>
        <div class="btn nocomp" onclick="abrirModalNoCompra('${c.numeroCliente}')">✖ No compró</div>
        <div class="btn last" onclick="verUltimoPedido('${c.numeroCliente}')">📄 Último pedido</div>
      </div>
    `;
    cont.appendChild(div);
  });
}

/*****************************************
 * REGISTRAR COMPRA
 *****************************************/
async function registrarCompra(cliente) {
  await enviarVisita(cliente, true, "", "");
  showToast("✅ Visita registrada");
  document.querySelector(`[onclick="registrarCompra('${cliente}')"]`).closest(".client-card").remove();
}

/*****************************************
 * NO COMPRA → MODAL MOTIVO
 *****************************************/
function abrirModalNoCompra(cliente) {
  const motivo = prompt(`Seleccione motivo:\n\n1) Tenía mercadería\n2) Estaba cerrado\n3) Compró a otro\n4) No estaba\n5) Otro`);

  let motivoFinal = "";
  switch (motivo) {
    case "1": motivoFinal = "Tenía mercadería"; break;
    case "2": motivoFinal = "Estaba cerrado"; break;
    case "3": motivoFinal = "Compró a otro"; break;
    case "4": motivoFinal = "No estaba"; break;
    case "5": motivoFinal = prompt("Escriba motivo:"); break;
    default: return;
  }

  enviarVisita(cliente, false, motivoFinal, "");
  showToast("❌ Visita registrada");
  document.querySelector(`[onclick="abrirModalNoCompra('${cliente}')"]`).closest(".client-card").remove();
}

/*****************************************
 * GUARDAR REGISTRO EN BACKEND
 *****************************************/
async function enviarVisita(cliente, compro, motivo, notas) {
  await fetch(WORKER_URL, {
    method: "POST",
    body: JSON.stringify({
      accion: "registrarVisita",
      vendedor: vendedorActual,
      cliente,
      compro,
      motivo,
      notas
    })
  });
}

/*****************************************
 * VER / COPIAR ÚLTIMO PEDIDO
 *****************************************/
async function verUltimoPedido(cliente) {
  const resp = await fetch(`${WORKER_URL}/?accion=getUltimoPedido&cliente=${cliente}`);
  const data = await resp.json();
  if (!data.ok || !data.ultimoPedido) return showToast("Sin historial");

  navigator.clipboard.writeText(data.ultimoPedido.texto);
  showToast("📋 Copiado — listo para pegar en pedido");
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
