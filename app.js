/* ================================
   CONFIGURACIÓN PRINCIPAL
================================ */
const vendedores = {
  "0001": "Martín",
  "0002": "Lucas",
  "0003": "Mercado Limpio"
};

// ⚙️ URL del Apps Script desplegado (tu endpoint)
const URL_API_BASE = "https://script.google.com/macros/s/AKfycbzqPMRir2VCB_C_EUsa0o8-eYCRDM4AQLsY3Jx_5jRKkYi-D2WgTEkTFrBIRFugT5MW/exec";

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

  document.getElementById("login").classList.add("oculto");
  const app = document.getElementById("app");
  app.classList.remove("oculto");

  const nombre = vendedores[clave];
  document.getElementById("titulo").textContent = `👋 Bienvenido, ${nombre}`;
  cargarDatosVendedor(clave, nombre);
}

window.onload = mostrarApp;

/* ================================
   CARGA DE DATOS DEL VENDEDOR
================================ */
function cargarDatosVendedor(clave, nombre) {
  // 🔹 Usa el nuevo endpoint de la ruta del día
  const urlRuta = `${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`;
  const urlPred = `${URL_API_BASE}`;

  Promise.all([fetch(urlRuta), fetch(urlPred)])
    .then(async ([r1, r2]) => [await r1.json(), await r2.json()])
    .then(([clientes, pred]) => {
      const ahora = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
      document.getElementById("estado").textContent =
        `Ruta del día cargada (${clientes.length} clientes) — Última actualización: ${ahora}`;

      mostrarRutaDia(clientes);
      mostrarPredicciones(pred.datos);
    })
    .catch(err => {
      console.error("Error al cargar datos:", err);
      document.getElementById("estado").textContent = "❌ Error al cargar datos.";
    });
}

/* ================================
   PREDICCIONES INTELIGENTES
================================ */
function mostrarPredicciones(pedidos) {
  const clientes = {};

  pedidos.forEach(p => {
    const id = p.cliente;
    const fecha = new Date(p.fecha);
    if (!clientes[id]) clientes[id] = { vendedor: p.vendedor, fechas: [] };
    clientes[id].fechas.push(fecha);
  });

  const hoy = new Date();
  const resultados = [];

  for (let id in clientes) {
    const { vendedor, fechas } = clientes[id];
    fechas.sort((a, b) => a - b);
    if (fechas.length < 2) continue;

    const diferencias = [];
    for (let i = 1; i < fechas.length; i++) {
      const dias = (fechas[i] - fechas[i - 1]) / (1000 * 60 * 60 * 24);
      diferencias.push(dias);
    }

    const promedio = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
    const ultimaFecha = fechas.at(-1);
    const proximaFecha = new Date(ultimaFecha);
    proximaFecha.setDate(proximaFecha.getDate() + promedio);
    const diasRestantes = Math.round((proximaFecha - hoy) / (1000 * 60 * 60 * 24));

    resultados.push({
      cliente: id,
      vendedor,
      ultima: ultimaFecha,
      proxima: proximaFecha,
      diasRestantes,
      frecuenciaPromedio: Math.round(promedio)
    });
  }

  const proximos = resultados.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 7);
  const atrasados = resultados.filter(c => c.diasRestantes < 0);
  const promedioFrecuencia = Math.round(
    resultados.reduce((a, b) => a + b.frecuenciaPromedio, 0) / resultados.length
  );

  const resumen = document.createElement("section");
  resumen.className = "resumen";
  resumen.innerHTML = `
    <h2>📊 Predicciones Inteligentes</h2>
    <p>⏳ Promedio de frecuencia entre pedidos: <b>${promedioFrecuencia} días</b></p>
    <p>📅 Clientes que deberían comprar esta semana: <b>${proximos.length}</b></p>
    <p>⚠️ Clientes atrasados: <b>${atrasados.length}</b></p>
  `;

  const cont = document.getElementById("contenedor");
  cont.prepend(resumen);
}

/* ================================
   RUTA DEL DÍA + REGISTRO VISITA
================================ */
function mostrarRutaDia(clientes) {
  const cont = document.getElementById("contenedor");

  const tituloRuta = document.createElement("h2");
  tituloRuta.textContent = "🗺️ Ruta del Día";
  tituloRuta.className = "titulo-seccion";
  cont.appendChild(tituloRuta);

  const btnRuta = document.createElement("button");
  btnRuta.textContent = "📍 Ver ruta completa en Google Maps";
  btnRuta.className = "btn-mapa";
  btnRuta.onclick = () => abrirRutaEnMapa(clientes);
  cont.appendChild(btnRuta);

  if (clientes.length === 0) {
    const vacio = document.createElement("p");
    vacio.textContent = "📭 No hay clientes asignados para hoy.";
    cont.appendChild(vacio);
    return;
  }

  clientes.forEach(c => {
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
    .map(c => `${c.direccion}, ${c.localidad}`)
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
  const comentario = document.getElementById(`coment-${cliente.numero}`).value.trim();
  const vendedor = localStorage.getItem("vendedorClave"); // 🔹 Clave activa del vendedor

  const params = new URLSearchParams({
    accion: "registrarVisita",
    numero: cliente.numero,
    nombre: cliente.nombre,
    direccion: cliente.direccion,
    localidad: cliente.localidad,
    visitado,
    compro,
    comentario,
    vendedor
  });

  fetch(`${URL_API_BASE}?${params.toString()}`)
    .then(r => r.json())
    .then(res => alert(res.estado || "Guardado"))
    .catch(() => alert("❌ Error al registrar visita"));
}

