/* ================================
   ⚙️ CONFIGURACIÓN PRINCIPAL
================================ */
const vendedores = {
  "0001": "Martín",
  "0002": "Lucas",
  "0003": "Mercado Limpio",
};

// URL del Apps Script desplegado (tu endpoint)
const URL_API_BASE =
  "https://script.google.com/macros/s/AKfycbzqPMRir2VCB_C_EUsa0o8-eYCRDM4AQLsY3Jx_5jRKkYi-D2WgTEkTFrBIRFugT5MW/exec";

/* ================================
   🔐 LOGIN Y SESIÓN
================================ */
function login() {
  const clave = document.getElementById("clave").value.trim();
  const error = document.getElementById("error");

  if (!vendedores[clave]) {
    error.textContent = "❌ Clave incorrecta";
    return;
  }

  localStorage.setItem("vendedorClave", clave);
  mostrarApp();
}

function logout() {
  localStorage.removeItem("vendedorClave");
  location.reload();
}

function mostrarApp() {
  const clave = localStorage.getItem("vendedorClave");
  if (!clave) return;

  const loginDiv = document.getElementById("login");
  const appDiv = document.getElementById("app");

  loginDiv.classList.add("oculto");

  setTimeout(() => {
    loginDiv.style.display = "none";
    appDiv.classList.add("visible");
  }, 600);

  const nombre = vendedores[clave];
  document.getElementById("titulo").textContent = `👋 Bienvenido, ${nombre}`;
  cargarDatosVendedor(clave);
}

/* Cargar automáticamente si hay sesión activa */
window.onload = mostrarApp;

/* ================================
   🚗 CARGA DE DATOS PRINCIPALES
================================ */
async function cargarDatosVendedor(clave) {
  const urlRuta = `${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`;
  const urlPred = `${URL_API_BASE}?accion=getPrediccionesVendedor&clave=${clave}`;

  try {
    const [r1, r2] = await Promise.all([fetch(urlRuta), fetch(urlPred)]);
    const clientes = await r1.json();
    const pred = await r2.json();

    const ahora = new Date().toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    document.getElementById(
      "estado"
    ).textContent = `Ruta cargada (${clientes.length} clientes) — Última actualización: ${ahora}`;

    mostrarRutaDia(clientes);
    mostrarPanelPredicciones(pred);
  } catch (e) {
    console.error("❌ Error al cargar datos:", e);
    document.getElementById("estado").textContent = "❌ Error al cargar datos.";
  }
}

/* ================================
   🧭 RUTA DEL DÍA
================================ */
function mostrarRutaDia(clientes) {
  const cont = document.getElementById("contenedor");
  cont.innerHTML = "";

  const titulo = document.createElement("h2");
  titulo.textContent = "🗺️ Ruta del Día";
  cont.appendChild(titulo);

  const btnRuta = document.createElement("button");
  btnRuta.textContent = "📍 Ver ruta completa en Google Maps";
  btnRuta.className = "btn-mapa";
  btnRuta.onclick = () => abrirRutaEnMapa(clientes);
  cont.appendChild(btnRuta);

  if (!clientes || clientes.length === 0) {
    cont.innerHTML += "<p>📭 No hay clientes asignados para hoy.</p>";
    return;
  }

  clientes.forEach((c) => {
    const div = document.createElement("div");
    div.className = "cliente";
    div.innerHTML = `
      <h3>${c.nombre}</h3>
      <p>📍 ${c.direccion}, ${c.localidad}</p>
      <p>
        <label><input type="checkbox" id="visitado-${c.numero}"> Visitado</label>
        <label><input type="checkbox" id="compro-${c.numero}"> Compró</label>
      </p>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>
      <button onclick='registrarVisita(${JSON.stringify(c)})'>💾 Guardar visita</button>
    `;
    cont.appendChild(div);
  });
}

function abrirRutaEnMapa(clientes) {
  const direcciones = clientes
    .map((c) => `${c.direccion}, ${c.localidad}`)
    .filter(Boolean)
    .join("|");
  if (!direcciones) {
    alert("⚠️ No hay direcciones válidas para mostrar en el mapa.");
    return;
  }
  const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&waypoints=${encodeURIComponent(
    direcciones
  )}`;
  window.open(url, "_blank");
}

/* ================================
   💾 REGISTRAR VISITA
================================ */
function registrarVisita(cliente) {
  const visitado = document.getElementById(`visitado-${cliente.numero}`).checked;
  const compro = document.getElementById(`compro-${cliente.numero}`).checked;
  const comentario = document
    .getElementById(`coment-${cliente.numero}`)
    .value.trim();
  const vendedor = localStorage.getItem("vendedorClave");

  const params = new URLSearchParams({
    accion: "registrarVisita",
    numero: cliente.numero,
    nombre: cliente.nombre,
    direccion: cliente.direccion,
    localidad: cliente.localidad,
    visitado,
    compro,
    comentario,
    vendedor,
  });

  fetch(`${URL_API_BASE}?${params.toString()}`)
    .then((r) => r.json())
    .then((res) => alert(res.estado || "✅ Visita registrada"))
    .catch(() => alert("❌ Error al registrar visita"));
}

/* ================================
   📅 CALENDARIO DE VISITAS
================================ */
async function cargarCalendario() {
  const clave = localStorage.getItem("vendedorClave");
  const cont = document.getElementById("contenedorCalendario");
  if (!clave) {
    cont.innerHTML = "⚠️ Debes iniciar sesión primero.";
    return;
  }

  cont.innerHTML = "⏳ Cargando calendario...";
  const url = `${URL_API_BASE}?accion=getCalendarioVisitas&clave=${clave}`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (!data || data.length === 0) {
      cont.innerHTML = "📭 No hay visitas programadas.";
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Fecha</th><th>Día</th><th>Localidades</th><th>Última visita</th><th>Compró</th>
          </tr>
        </thead><tbody>
    `;

    data.forEach((fila) => {
      html += `
        <tr>
          <td>${fila.fecha}</td>
          <td>${fila.dia}</td>
          <td>${fila.localidad}</td>
          <td>${fila.ultimaVisita || "-"}</td>
          <td>${fila.compro ? "✅" : "❌"}</td>
        </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (e) {
    console.error("Error al cargar calendario:", e);
    cont.innerHTML = "❌ Error al cargar calendario.";
  }
}

/* ================================
   📈 PANEL DE PREDICCIONES / IA
================================ */
function mostrarPanelPredicciones(pred) {
  const cont = document.getElementById("contenedor");
  const panel = document.createElement("section");
  panel.className = "resumen";
  panel.innerHTML = `
    <h2>📊 Resumen Inteligente</h2>
    <p>🗓️ Frecuencia promedio: <b>${pred.frecuencia || "Sin datos"} días</b></p>
    <p>🎯 ${pred.mensaje}</p>
  `;
  cont.prepend(panel);
}

/* ================================
   🧩 UTILIDADES
================================ */
function copiarPedido(pedido) {
  if (!pedido) return alert("Sin pedido disponible.");
  navigator.clipboard.writeText(pedido);
  alert("✅ Pedido copiado al portapapeles");
}
