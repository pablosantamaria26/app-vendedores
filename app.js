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

  const login = document.getElementById("login");
  const app = document.getElementById("app");

  login.classList.add("oculto");

  setTimeout(() => {
    login.style.display = "none";
    app.classList.add("visible");
  }, 600);

  const nombre = vendedores[clave];
  document.getElementById("titulo").textContent = `👋 Bienvenido, ${nombre}`;
  cargarDatosVendedor(clave, nombre);
}


window.onload = mostrarApp;

/* ================================
   CARGA DE DATOS DEL VENDEDOR
================================ */
function cargarDatosVendedor(clave, nombre) {
  const urlRuta = `${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`;
  const urlPred = `${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`; // 🔹 Usamos resumen real, no datos inexistentes

  Promise.all([fetch(urlRuta), fetch(urlPred)])
    .then(async ([r1, r2]) => [await r1.json(), await r2.json()])
    .then(([clientes, pred]) => {
      const ahora = new Date().toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      });
      document.getElementById(
        "estado"
      ).textContent = `Ruta del día cargada (${clientes.length} clientes) — Última actualización: ${ahora}`;

      mostrarRutaDia(clientes);

      // ✅ Evita errores si no hay datos
      if (pred && pred.tasa !== undefined) {
        mostrarPredicciones(pred);
      } else {
        console.warn("⚠️ No hay datos de predicciones disponibles.");
      }
    })
    .catch((err) => {
      console.error("Error al cargar datos:", err);
      document.getElementById("estado").textContent = "❌ Error al cargar datos.";
    });
}

/* ================================
   PREDICCIONES / ESTADÍSTICAS
================================ */
function mostrarPredicciones(pred) {
  const cont = document.getElementById("contenedor");

  const resumen = document.createElement("section");
  resumen.className = "resumen";
  resumen.innerHTML = `
    <h2>📊 Predicciones Inteligentes</h2>
    <p>🎯 Tasa de conversión actual: <b>${pred.tasa}%</b></p>
    <p>💰 Clientes que compraron hoy: <b>${pred.compraronHoy}</b></p>
    <p>🚗 Clientes visitados hoy: <b>${pred.totalHoy}</b></p>
    <p>⏳ Frecuencia promedio de compra: <b>${pred.frecuenciaProm || "N/A"} días</b></p>
  `;
  cont.prepend(resumen);
}

/* ================================
   RUTA DEL DÍA + REGISTRO VISITA
================================ */
function mostrarRutaDia(clientes) {
  const cont = document.getElementById("contenedor");
  cont.innerHTML = ""; // 🔹 Limpia antes de volver a renderizar

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
