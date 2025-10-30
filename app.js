/* ================================
   CONFIGURACIÓN PRINCIPAL
================================ */
const vendedores = {
  "0001": "Martín",
  "0002": "Lucas",
  "0003": "Mercado Limpio"
};

// ⚙️ URL del Apps Script desplegado (tu endpoint)
const URL_API_BASE =
  "https://script.google.com/macros/s/AKfycbzqPMRir2VCB_C_EUsa0o8-eYCRDM4AQLsY3Jx_5jRKkYi-D2WgTEkTFrBIRFugT5MW/exec";

/* ================================
   LOGIN Y SESIÓN
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

  // Cargar información general
  cargarDatosVendedor(clave, nombre);
  cargarResumenVendedor(clave);
}

/* Ejecutar automáticamente si hay sesión */
window.onload = mostrarApp;

/* ================================
   CARGA DE DATOS DEL VENDEDOR
================================ */
function cargarDatosVendedor(clave, nombre) {
  const urlRuta = `${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`;
  const urlResumen = `${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`;

  Promise.all([fetch(urlRuta), fetch(urlResumen)])
    .then(async ([r1, r2]) => [await r1.json(), await r2.json()])
    .then(([clientes, resumen]) => {
      const ahora = new Date().toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      });

      document.getElementById(
        "estado"
      ).textContent = `Ruta del día cargada (${clientes.length} clientes) — Última actualización: ${ahora}`;

      mostrarRutaDia(clientes);

      if (resumen && resumen.tasa !== undefined) {
        mostrarPredicciones(resumen);
      }
    })
    .catch((err) => {
      console.error("Error al cargar datos:", err);
      document.getElementById("estado").textContent =
        "❌ Error al cargar datos.";
    });
}

/* ================================
   PANEL DE PREDICCIONES / ESTADÍSTICAS
================================ */
function mostrarPredicciones(pred) {
  const cont = document.getElementById("contenedor");

  const resumen = document.createElement("section");
  resumen.className = "resumen";
  resumen.innerHTML = `
    <h2>📊 Resumen del Día</h2>
    <p>🚗 Clientes visitados hoy: <b>${pred.totalHoy}</b></p>
    <p>💰 Compraron: <b>${pred.compraronHoy}</b></p>
    <p>🎯 Tasa de conversión: <b>${pred.tasa}%</b></p>
    <p>⏳ Frecuencia promedio de compra: <b>${pred.frecuenciaProm || "N/A"} días</b></p>
  `;

  cont.prepend(resumen);
}

/* ================================
   RUTA DEL DÍA + REGISTRO VISITA
================================ */
function mostrarRutaDia(clientes) {
  const cont = document.getElementById("contenedor");
  cont.innerHTML = ""; // Limpia antes de volver a renderizar

  const tituloRuta = document.createElement("h2");
  tituloRuta.textContent = "🗺️ Ruta del Día";
  tituloRuta.className = "titulo-seccion";
  cont.appendChild(tituloRuta);

  const btnRuta = document.createElement("button");
  btnRuta.textContent = "📍 Ver ruta completa en Google Maps";
  btnRuta.className = "btn-mapa";
  btnRuta.onclick = () => abrirRutaEnMapa(clientes);
  cont.appendChild(btnRuta);

  if (!clientes || clientes.length === 0) {
    const vacio = document.createElement("p");
    vacio.textContent = "📭 No hay clientes asignados para hoy.";
    cont.appendChild(vacio);
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
      <button onclick='registrarVisita(${JSON.stringify(
        c
      )})'>💾 Guardar visita</button>
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
    alert("No hay direcciones válidas para mostrar en el mapa.");
    return;
  }

  const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&waypoints=${encodeURIComponent(
    direcciones
  )}`;
  window.open(url, "_blank");
}

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
    .then((res) => alert(res.estado || "Guardado"))
    .catch(() => alert("❌ Error al registrar visita"));
}

/* ================================
   CALENDARIO DE VISITAS
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
   PANEL DE ESTADÍSTICAS DEL VENDEDOR
================================ */
function cargarResumenVendedor(clave) {
  fetch(`${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`)
    .then((r) => r.json())
    .then((res) => {
      if (!res || !res.fecha) return;

      const panel = document.createElement("section");
      panel.className = "resumen";
      panel.innerHTML = `
        <h2>📈 Resumen del Día</h2>
        <p>🗓️ Fecha: <b>${res.fecha}</b></p>
        <p>🚗 Clientes visitados hoy: <b>${res.totalHoy}</b></p>
        <p>💰 Compraron: <b>${res.compraronHoy}</b></p>
        <p>🎯 Tasa de conversión: <b>${res.tasa}%</b></p>
        <p>⏳ Frecuencia promedio de compra: <b>${res.frecuenciaProm || "N/A"} días</b></p>
      `;

      const cont = document.getElementById("contenedor");
      cont.prepend(panel);
    })
    .catch((err) => console.error("Error cargando resumen:", err));
}

/* ================================
   UTILIDADES
================================ */
function copiarPedido(pedido) {
  if (!pedido) return alert("Sin pedido disponible.");
  navigator.clipboard.writeText(pedido);
  alert("✅ Pedido copiado al portapapeles");
}
