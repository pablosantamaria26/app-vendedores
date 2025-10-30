const URL_API = "https://script.google.com/macros/s/AKfycbzqPMRir2VCB_C_EUsa0o8-eYCRDM4AQLsY3Jx_5jRKkYi-D2WgTEkTFrBIRFugT5MW/exec";
const contenedor = document.getElementById("contenedor");
const estado = document.getElementById("estado");

const vendedores = {
  "0001": "Martín",
  "0002": "Lucas",
  "0003": "Mercado Limpio"
};

const URL_API_BASE = "https://script.google.com/macros/s/AKfycbzqPMRir2VCB_C_EUsa0o8-eYCRDM4AQLsY3Jx_5jRKkYi-D2WgTEkTFrBIRFugT5MW/exec";

function login() {
  const clave = document.getElementById("clave").value.trim();
  const error = document.getElementById("error");
  if (!vendedores[clave]) {
    error.textContent = "Clave incorrecta ❌";
    return;
  }
  localStorage.setItem("vendedorClave", clave);
  mostrarApp();
}

function mostrarApp() {
  const clave = localStorage.getItem("vendedorClave");
  if (!clave) return;

  const nombre = vendedores[clave];
  document.getElementById("login").classList.add("oculto");
  const app = document.getElementById("app");
  app.classList.remove("oculto");
  document.getElementById("titulo").textContent = `👋 Bienvenido, ${nombre}`;
  
  const URL_API = `${URL_API_BASE}?accion=getClientesDelDia&vendedor=${clave}`;
  
  fetch(URL_API)
    .then(r => r.json())
    .then(clientes => {
      document.getElementById("estado").textContent = `Clientes del día (${clientes.length})`;
      mostrarClientesDelDia(clientes);
    })
    .catch(err => {
      document.getElementById("estado").textContent = "❌ Error al cargar datos";
      console.error(err);
    });
}

window.onload = mostrarApp;

function mostrarClientesDelDia(clientes) {
  const contenedor = document.getElementById("contenedor");
  contenedor.innerHTML = "";
  clientes.forEach(c => {
    const div = document.createElement("div");
    div.className = "cliente";
    div.innerHTML = `
      <h3>${c.nombre}</h3>
      <p>${c.direccion}, ${c.localidad}</p>
      <button onclick="abrirMapa('${encodeURIComponent(c.direccion + ', ' + c.localidad)}')">📍 Ver en mapa</button>
    `;
    contenedor.appendChild(div);
  });
}

function abrirMapa(dir) {
  window.open(`https://www.google.com/maps/search/?api=1&query=${dir}`, "_blank");
}


fetch(URL_API)
  .then(r => r.json())
  .then(data => {
    estado.textContent = `Datos cargados (${data.total} registros - última actualización: ${new Date(data.fechaActualizacion).toLocaleString()})`;
    const analisis = analizarFrecuencias(data.datos);
    mostrarResumen(analisis);
    mostrarClientesPrediccion(analisis);
  })
  .catch(err => {
    estado.textContent = "❌ Error al cargar los datos";
    console.error(err);
  });

/** ===========================
 *  ANALÍTICA Y PREDICCIONES
 *  =========================== */
function analizarFrecuencias(pedidos) {
  const clientes = {};

  pedidos.forEach(p => {
    const id = p.cliente;
    const fecha = new Date(p.fecha);
    if (!clientes[id]) clientes[id] = { vendedor: p.vendedor, fechas: [] };
    clientes[id].fechas.push(fecha);
  });

  const hoy = new Date();
  const resultado = [];

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

    resultado.push({
      cliente: id,
      vendedor,
      ultima: ultimaFecha,
      proxima: proximaFecha,
      diasRestantes: diasRestantes,
      frecuenciaPromedio: Math.round(promedio)
    });
  }

  return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/** ===========================
 *  MOSTRAR RESUMEN GLOBAL
 *  =========================== */
function mostrarResumen(clientes) {
  const proximos = clientes.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 7);
  const atrasados = clientes.filter(c => c.diasRestantes < 0);
  const promedioFrecuencia = Math.round(clientes.reduce((a, b) => a + b.frecuenciaPromedio, 0) / clientes.length);

  const resumen = document.createElement("section");
  resumen.className = "resumen";
  resumen.innerHTML = `
    <h2>📊 Predicciones Inteligentes</h2>
    <p>⏳ Promedio de frecuencia entre pedidos: <b>${promedioFrecuencia} días</b></p>
    <p>📅 Clientes que deberían comprar esta semana: <b>${proximos.length}</b></p>
    <p>⚠️ Clientes atrasados: <b>${atrasados.length}</b></p>
  `;
  contenedor.prepend(resumen);
}

/** ===========================
 *  MOSTRAR CLIENTES POR PRIORIDAD
 *  =========================== */
function mostrarClientesPrediccion(clientes) {
  const lista = document.createElement("div");
  lista.className = "lista-clientes";

  clientes.slice(0, 50).forEach(c => {
    const div = document.createElement("div");
    div.className = "cliente";

    let estado = "🟢 Al día";
    if (c.diasRestantes < 0) estado = "🔴 Atrasado";
    else if (c.diasRestantes <= 7) estado = "🟠 Comprar pronto";

    div.innerHTML = `
      <h3>👤 Cliente ${c.cliente}</h3>
      <p><b>Vendedor:</b> ${c.vendedor}</p>
      <p><b>Último pedido:</b> ${new Date(c.ultima).toLocaleDateString()}</p>
      <p><b>Próxima compra estimada:</b> ${new Date(c.proxima).toLocaleDateString()}</p>
      <p><b>Días restantes:</b> ${c.diasRestantes} — ${estado}</p>
    `;
    lista.appendChild(div);
  });

  contenedor.appendChild(lista);
}
