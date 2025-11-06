/* ================================
   ⚙️ CONFIGURACIÓN PRINCIPAL
================================ */
const vendedores = {
  "0001": "Martín",
  "0002": "Lucas",
  "0003": "Mercado Limpio",
};


const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";


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

  // Guardar la clave y cargar la app
  localStorage.setItem("vendedorClave", clave);
  mostrarApp();
}

function logout() {
  localStorage.removeItem("vendedorClave");
  document.getElementById("app").classList.remove("visible");
  document.getElementById("login").style.display = "flex";
  document.getElementById("login").classList.remove("oculto");
}

function mostrarApp() {
  const clave = localStorage.getItem("vendedorClave");
  if (!clave || !vendedores[clave]) {
    document.getElementById("login").style.display = "flex";
    document.getElementById("login").classList.remove("oculto");
    document.getElementById("app").classList.remove("visible");
    return;
  }

  const loginDiv = document.getElementById("login");
  const appDiv = document.getElementById("app");
  loginDiv.classList.add("oculto");

  setTimeout(() => {
    loginDiv.style.display = "none";
    appDiv.classList.add("visible");

    // 👇 Mostrar resumen al inicio
    mostrarSeccion("resumen");
  }, 500);

  const nombre = vendedores[clave];
  document.getElementById("titulo").textContent = `👋 Bienvenido, ${nombre}`;
  cargarDatosVendedor(clave, nombre);
  registrarTokenPush();
}


/* ================================
   AUTOEJECUCIÓN DE SESIÓN
================================ */
window.addEventListener("load", () => {
  const claveGuardada = localStorage.getItem("vendedorClave");
  if (claveGuardada && vendedores[claveGuardada]) {
    mostrarApp();
  } else {
    document.getElementById("login").style.display = "flex";
  }
});


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
   📈 PANEL DE PREDICCIONES / IA + GRÁFICO DE DESEMPEÑO
================================ */
function mostrarPanelPredicciones(pred) {
  const cont = document.getElementById("contenedor");

  // Eliminar panel anterior si existe
  const viejo = document.querySelector(".panel-inteligente");
  if (viejo) viejo.remove();

  const panel = document.createElement("section");
  panel.className = "panel-inteligente";
  panel.innerHTML = `
    <div class="tarjeta-resumen">
      <h2>📊 Resumen Inteligente</h2>
      <div class="grafico-container">
        <canvas id="graficoTasa" width="140" height="140"></canvas>
        <div class="grafico-texto" id="porcentajeTasa">0%</div>
      </div>

      <p>🚗 Visitados hoy: <b>${pred.totalHoy || 0}</b></p>
      <p>💰 Compraron: <b>${pred.compraronHoy || 0}</b></p>
      <p>⏱️ Frecuencia promedio: <b>${pred.frecuencia || "Sin datos"} días</b></p>
      <p>🎯 <b>${pred.tasa || 0}%</b> tasa de conversión</p>
      <p class="mensaje-ia">${mensajeMotivacional(pred.tasa || 0)}</p>
    </div>

    <div class="tarjeta-prediccion">
      <h3>🤖 Sugerencia Inteligente</h3>
      <p>${pred.mensaje}</p>
    </div>
  `;

  cont.prepend(panel);

  // Animar el gráfico circular
  setTimeout(() => animarGrafico(pred.tasa || 0), 300);
}

/* ================================
   🔵 ANIMACIÓN GRÁFICO CIRCULAR
================================ */
function animarGrafico(valor) {
  const canvas = document.getElementById("graficoTasa");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const centro = canvas.width / 2;
  const radio = 60;
  const circunferencia = Math.PI * 2;
  const colorBase = "#e0e0e0";
  const colorRelleno = valor >= 70 ? "#00c851" : valor >= 40 ? "#ffbb33" : "#ff4444";
  const texto = document.getElementById("porcentajeTasa");

  let progreso = 0;
  const anim = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo
    ctx.beginPath();
    ctx.arc(centro, centro, radio, 0, circunferencia);
    ctx.strokeStyle = colorBase;
    ctx.lineWidth = 10;
    ctx.stroke();

    // Progreso
    ctx.beginPath();
    ctx.arc(centro, centro, radio, -Math.PI / 2, (circunferencia * progreso) / 100 - Math.PI / 2);
    ctx.strokeStyle = colorRelleno;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.stroke();

    // Texto
    texto.textContent = `${Math.round(progreso)}%`;

    if (progreso >= valor) clearInterval(anim);
    else progreso += 1;
  }, 15);
}

/* ================================
   💬 MENSAJE MOTIVACIONAL
================================ */
function mensajeMotivacional(tasa) {
  if (tasa >= 80) return "🚀 ¡Excelente trabajo! Sos un referente de ventas.";
  if (tasa >= 60) return "🔥 Muy bien, seguí con ese ritmo.";
  if (tasa >= 40) return "💪 Buen desempeño, ¡vamos por más!";
  return "💡 No te desanimes, cada cliente cuenta. ¡Dale con todo!";
}

/* =====================================================
 🧠 APP DE VENDEDORES INTELIGENTE - EXTENSIÓN AVANZADA
 Versión: Final Octubre 2025
 Compatible con index_final.html
===================================================== */

/* ============================
   🕒 NOTIFICACIÓN DIARIA
   (Recuerda la ruta al iniciar el día)
============================ */
function notificacionDiaria() {
  if (!("Notification" in window)) return;

  Notification.requestPermission().then((perm) => {
    if (perm === "granted") {
      const clave = localStorage.getItem("vendedorClave");
      if (!clave) return;

      const nombre = vendedores[clave];
      const notif = new Notification("🚗 Ruta del día disponible", {
        body: `Hola ${nombre}, ya podés consultar tu ruta actualizada.`,
        icon: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
      });

      notif.onclick = () => window.focus();
    }
  });
}

// Ejecutar al cargar si es la primera visita del día
const ultimaNotif = localStorage.getItem("notificacionHoy");
const hoy = new Date().toLocaleDateString("es-AR");
if (ultimaNotif !== hoy) {
  notificacionDiaria();
  localStorage.setItem("notificacionHoy", hoy);
}

/* ============================
   📆 CALENDARIO AVANZADO
============================ */
async function cargarCalendario() {
  const clave = localStorage.getItem("vendedorClave");
  const cont = document.getElementById("contenedorCalendario");
  if (!clave) {
    cont.innerHTML = "<p>⚠️ Debes iniciar sesión primero.</p>";
    return;
  }

  cont.innerHTML = "<p>⏳ Cargando calendario...</p>";
  const url = `${URL_API_BASE}?accion=getCalendarioVisitas&clave=${clave}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (!data || data.length === 0) {
      cont.innerHTML = "<p>📭 No hay visitas programadas.</p>";
      return;
    }

    let html = `<div class="lista-calendario">`;
    data.forEach((f) => {
      const estado = f.compro ? "✅" : "❌";
      html += `
        <div class="cal-item">
          <div class="cal-info">
            <b>${f.fecha}</b> - ${f.dia}<br>
            <span>📍 ${f.localidad}</span>
          </div>
          <div class="cal-estado">${estado}</div>
        </div>
      `;
    });
    html += "</div>";

    cont.innerHTML = html;
  } catch (e) {
    console.error("Error calendario avanzado:", e);
    cont.innerHTML = "<p>❌ Error al cargar calendario.</p>";
  }
}

/* ============================
   🕒 HISTORIAL DE VISITAS
============================ */
async function verHistorial() {
  const clave = localStorage.getItem("vendedorClave");
  if (!clave) {
    alert("⚠️ Primero iniciá sesión.");
    return;
  }

  const url = `${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`;
  const resp = await fetch(url);
  const data = await resp.json();

  let historial = document.createElement("div");
  historial.className = "historial-overlay";
  historial.innerHTML = `
    <div class="historial-card">
      <h3>📜 Historial de visitas recientes</h3>
      <p>Fecha: ${data.fecha || "N/A"}</p>
      <p>Total: ${data.totalHoy || 0}</p>
      <p>Compraron: ${data.compraronHoy || 0}</p>
      <p>Tasa: ${data.tasa || 0}%</p>
      <button onclick="cerrarHistorial()">Cerrar</button>
    </div>
  `;
  document.body.appendChild(historial);
}

function cerrarHistorial() {
  document.querySelector(".historial-overlay")?.remove();
}

/* ============================
   🌍 FILTRAR CLIENTES POR LOCALIDAD
============================ */
function filtrarClientesPorLocalidad(localidad) {
  const cards = document.querySelectorAll(".cliente");
  cards.forEach((card) => {
    const texto = card.innerText.toLowerCase();
    card.style.display = texto.includes(localidad.toLowerCase()) ? "block" : "none";
  });
}

function mostrarFiltroLocalidad() {
  const cont = document.getElementById("contenedor");
  if (!cont.querySelector("#filtroLocalidad")) {
    const input = document.createElement("input");
    input.id = "filtroLocalidad";
    input.placeholder = "🔍 Filtrar por localidad...";
    input.style = `
      width: 90%;
      padding: 10px;
      margin: 10px auto;
      display: block;
      border: 1px solid #ccc;
      border-radius: 8px;
    `;
    input.oninput = () => filtrarClientesPorLocalidad(input.value);
    cont.prepend(input);
  }
}

/* ============================
   🎨 ANIMACIONES Y EFECTOS
============================ */
function animarTarjetas() {
  const cards = document.querySelectorAll(".cliente");
  cards.forEach((c, i) => {
    c.style.opacity = "0";
    c.style.transform = "translateY(20px)";
    setTimeout(() => {
      c.style.transition = "all 0.3s ease";
      c.style.opacity = "1";
      c.style.transform = "translateY(0)";
    }, 100 * i);
  });
}

/* ============================
   ⏳ AUTO REFRESCO DE DATOS
============================ */
function activarAutoRefresh(minutos = 15) {
  setInterval(() => {
    const clave = localStorage.getItem("vendedorClave");
    if (clave) {
      console.log("🔄 Auto-refrescando datos del vendedor...");
      cargarRuta(clave);
      cargarResumen(clave);
    }
  }, minutos * 60 * 1000);
}

// Activar refresco cada 15 min
activarAutoRefresh();

/* ============================
   🧩 MEJORAS DE MAPA
============================ */
function mostrarMapa(puntos) {
  const mapaDiv = document.getElementById("mapa");
  mapaDiv.innerHTML = "";
  const map = L.map("mapa").setView([-34.7, -58.4], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  let group = [];
  puntos.forEach((p) => {
    const marker = L.marker([p[0], p[1]]).addTo(map).bindPopup(p[2]);
    group.push(marker);
  });

  const groupLayer = L.featureGroup(group);
  if (group.length) map.fitBounds(groupLayer.getBounds().pad(0.3));

  // 📍 Agregar marcador del vendedor actual
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const marker = L.marker([pos.coords.latitude, pos.coords.longitude], {
        icon: L.icon({
          iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
          iconSize: [32, 32],
        }),
      })
        .addTo(map)
        .bindPopup("📍 Estás aquí");
    });
  }
}

/* ============================
   🧭 ATENCIÓN A LOS DETALLES
============================ */
// Se ejecuta automáticamente cada vez que se carga la ruta
const observer = new MutationObserver(() => {
  mostrarFiltroLocalidad();
  animarTarjetas();
});
observer.observe(document.body, { childList: true, subtree: true });

/* ==================================================
   🔔 REGISTRO DE TOKEN FIREBASE (PUSH)
   -------------------------------------------------- */
async function registrarTokenPush() {
  try {
    // Verificar compatibilidad del navegador
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.log("⚠️ Notificaciones no soportadas en este dispositivo.");
      return;
    }

    // Solicitar permiso
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      console.log("⚠️ El usuario no permitió notificaciones.");
      return;
    }

    // Registrar Service Worker
    const reg = await navigator.serviceWorker.register("service-worker.js");
    
    // Obtener token desde Firebase (asumiendo FCM ya instalado en tu proyecto)
    const token = await firebase.messaging().getToken({
      serviceWorkerRegistration: reg,
    });

    const vendedor = localStorage.getItem("vendedorClave");
    if (!vendedor || !token) return;

    // ✅ Enviar token al Apps Script
    await fetch(URL_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendedor, token })
    });

    console.log("✅ Token enviado al servidor:", token.slice(0, 20) + "...");

  } catch (e) {
    console.error("❌ Error al registrar token:", e);
  }
}

/* ▶️ Ejecutar automáticamente al iniciar la app */
window.addEventListener("load", () => {
  const clave = localStorage.getItem("vendedorClave");
  if (clave) registrarTokenPush();
});

