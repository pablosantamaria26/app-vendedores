/* ================================
   ⚙️ Config principal
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";

let clientesData = [];
let posicionActual = null;
let mapaFull = null;
let dragSrcIndex = null;

/* ================================
   🔐 Login & sesión
================================ */
function agregarDigito(n){ const i=document.getElementById("clave"); if(i && i.value.length<4) i.value+=n; }
function borrarDigito(){ const i=document.getElementById("clave"); if(i) i.value=i.value.slice(0,-1); }
function login(){
  const clave=(document.getElementById("clave")?.value||"").trim();
  const error=document.getElementById("error");
  if(!vendedores[clave]){ if(error) error.textContent="❌ Clave incorrecta"; return; }
  localStorage.setItem("vendedorClave", clave);
  const loginDiv=document.getElementById("login"); 
  if(loginDiv) {
    loginDiv.style.opacity = "0"; 
    setTimeout(() => { loginDiv.style.display="none"; }, 300);
  }
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.addEventListener("load",()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ 
    document.getElementById("login").style.display="none"; 
    mostrarApp(); 
  } else { 
    document.getElementById("login").style.display="grid"; 
  }
  restaurarTema();
});

/* ================================
   🎨 Temas
================================ */
function toggleTemaMenu(ev){
  ev.stopPropagation();
  const m=document.getElementById("temaMenu");
  if (!m) return;
  m.classList.toggle("visible");
  const close=()=>{ m.classList.remove("visible"); document.removeEventListener("click", close); };
  setTimeout(()=>document.addEventListener("click", close), 0);
}
function aplicarTema(clase){
  const b=document.body;
  b.classList.remove("tema-confianza","tema-energia","tema-foco","tema-noche");
  b.classList.add(clase);
  localStorage.setItem("temaPreferido", clase);
  const color = getComputedStyle(b).getPropertyValue('--azul-oscuro').trim();
  document.querySelector('meta[name="theme-color"]').setAttribute('content', color);
}
function restaurarTema(){
  const t=localStorage.getItem("temaPreferido")||"tema-confianza";
  aplicarTema(t);
}
function toggleModoOscuro(){
  const actual=document.body.classList.contains("tema-foco");
  const guardado = localStorage.getItem("temaPreferido") || "tema-confianza";
  aplicarTema(actual ? guardado : "tema-foco");
}

/* ================================
   🧭 Navegación
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  document.getElementById("seccion-"+s)?.classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`)?.classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
   🚀 App principal
================================ */
async function mostrarApp(){
  const clave=localStorage.getItem("vendedorClave");
  const nombre=vendedores[clave];
  document.getElementById("titulo").textContent=`👋 Hola, ${nombre}`;
  mostrarSeccion("ruta");

  const clientesHoy=await cargarRuta(clave);
  await cargarCoach(clave);
  if(clientesHoy && clientesHoy.length){
  console.log("✅ Ruta cargada con", clientesHoy.length, "clientes.");
}

}

/* ================================
   📍 Distancias
================================ */
const toRad=(d)=> d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

/* ================================
   🗂️ Orden
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }
function cargarOrden(){ try{ return JSON.parse(localStorage.getItem(keyOrden())||"[]"); }catch{ return []; } }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

/* ================================
   🚗 Cargar ruta
================================ */
async function cargarRuta(clave) {
  const cont = document.getElementById("contenedor");
  const estado = document.getElementById("estado");
  cont.innerHTML = "⏳ Cargando clientes...";

  try {
    // 📥 1. Obtener datos base desde la API
    const r1 = await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
    clientesData = await r1.json();

    // 🔁 2. Restaurar progreso local del día (si existe)
    const local = cargarLocal(clave);
    if (local.length) {
      const mapa = new Map(local.map(c => [String(c.numero), c]));
      clientesData = clientesData.map(c => mapa.get(String(c.numero)) || c);
      console.log("♻️ Estados restaurados desde localStorage");
    }

    // 🗂️ 3. Aplicar orden personalizado si existe
    const orden = cargarOrden();
    if (orden.length) {
      const map = new Map(clientesData.map(c => [String(c.numero), c]));
      clientesData = orden.map(id => map.get(String(id))).filter(Boolean)
        .concat(clientesData.filter(c => !orden.includes(String(c.numero))));
    }

    // 📍 4. Obtener ubicación actual y renderizar clientes
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          posicionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          renderClientes();
        },
        () => renderClientes(),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
      );
    } else {
      renderClientes();
    }

    // 🕒 5. Mostrar estado general de carga
    if (estado) {
      const ahora = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
      estado.textContent = `Ruta cargada (${clientesData.length} clientes) — Última actualización: ${ahora}`;
    }

    // 🎯 6. Detectar si la ruta ya está completada
    const todosCompletos = clientesData.every(c => c.bloqueado);
    if (todosCompletos && clientesData.length > 0) {
      mostrarToastExito("🎉 ¡Ruta completada! Felicitaciones por tu trabajo de hoy 💪");
    }

    return clientesData;

  } catch (e) {
    console.error("❌ Error al cargar datos:", e);
    cont.textContent = "❌ Error al cargar datos.";
    return [];
  }
}

/* ================================
   🧱 Render de clientes
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor"); 
  if(!cont) return;
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const card=document.createElement("div");
    card.className="cliente"; card.id="c_"+c.numero;
    const lat=parseFloat(c.lat), lng=parseFloat(c.lng);
    const tieneGeo=Number.isFinite(lat)&&Number.isFinite(lng);
    const dist=(posicionActual&&tieneGeo)?distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng):null;
    card.innerHTML=`
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}</span>
        ${dist!==null?`<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>
      <div class="fila" style="margin-top:6px">
        <label><input type="checkbox" id="visitado-${c.numero}"> Visitado</label>
        <label><input type="checkbox" id="compro-${c.numero}"> Compró</label>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="confirmDestino(${lat},${lng},'${c.nombre.replace(/'/g,"")}')">🚗 Ir a este cliente</button>
      </div>`;
    card.setAttribute("draggable","true");
    card.addEventListener("dragstart",(ev)=>{ dragSrcIndex=idx; ev.dataTransfer.effectAllowed="move"; });
    card.addEventListener("dragover",(ev)=>{ ev.preventDefault(); ev.dataTransfer.dropEffect="move"; });
    card.addEventListener("drop",(ev)=>{
      ev.preventDefault();
      const cards=Array.from(cont.querySelectorAll(".cliente"));
      const targetIndex=cards.indexOf(card);
      if(dragSrcIndex===null||dragSrcIndex===targetIndex) return;
      const moved=clientesData.splice(dragSrcIndex,1)[0];
      clientesData.splice(targetIndex,0,moved);
      dragSrcIndex=null; guardarOrden(clientesData.map(x=>String(x.numero))); renderClientes();
    });
    cont.appendChild(card);
  });

  // 🔢 Contador
  const visitados = clientesData.filter(c=>c.bloqueado).length;
  const restantes = clientesData.length - visitados;
  const compraron = clientesData.filter(c=>c.compro).length;
  document.getElementById("estadoRuta").innerHTML = 
    `🚗 <b>${restantes}</b> por visitar · ✅ <b>${visitados}</b> visitados · 🛒 <b>${compraron}</b> compraron`;
}

/* ==================================================
   💾 Registrar visita y mantener estado
================================================== */
async function registrarVisita(numero) {
  const clave = localStorage.getItem("vendedorClave");
  const cliente = clientesData.find(c => String(c.numero) === String(numero));
  if (!cliente) return;

  // Datos del formulario
  const visitado = document.getElementById(`visitado-${numero}`)?.checked || false;
  const compro = document.getElementById(`compro-${numero}`)?.checked || false;
  const comentario = document.getElementById(`coment-${numero}`)?.value || "";

  // Bloquear y mover al final visualmente
  cliente.visitado = visitado;
  cliente.compro = compro;
  cliente.comentario = comentario;
  cliente.bloqueado = true;

  // Mover al final sin alterar el scroll del usuario
  const scrollY = window.scrollY;
  clientesData = clientesData.filter(c => String(c.numero) !== String(numero));
  clientesData.push(cliente);
  renderClientes();
  window.scrollTo({ top: scrollY, behavior: "instant" });

  // Guardar en localStorage para persistencia
  guardarLocal(clave, clientesData);

  // Mostrar feedback
  mostrarToastExito("✅ Visita registrada");

  // Enviar al backend (Google Sheets vía Worker)
  try {
    const resp = await fetch(`${URL_API_BASE}?accion=registrarVisita`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clave, numero, visitado, compro, comentario,
        nombre: cliente.nombre,
        direccion: cliente.direccion || "",
        localidad: cliente.localidad || ""
      })
    });
    const data = await resp.json();
    console.log("📤 Enviado a hoja:", data);
  } catch (e) {
    console.warn("⚠️ Offline, guardando en cola local:", e);
    queueOffline({ t:"visita", cliente });
  }
}

/* ==================================================
   💾 Persistencia local diaria
================================================== */
function guardarLocal(clave, data) {
  const hoy = new Date().toISOString().slice(0,10);
  localStorage.setItem(`data_${clave}_${hoy}`, JSON.stringify(data));
}

function cargarLocal(clave) {
  const hoy = new Date().toISOString().slice(0,10);
  try { return JSON.parse(localStorage.getItem(`data_${clave}_${hoy}`) || "[]"); }
  catch { return []; }
}


/* ==================================================
   ✨ Toast de éxito animado
================================================== */
function mostrarToastExito(texto) {
  const overlay = document.createElement("div");
  overlay.className = "exito-overlay";
  overlay.innerHTML = `
    <div class="exito-box">
      <div class="exito-circle">
        <svg><circle class="bg" cx="90" cy="90" r="90"/><circle class="prog" cx="90" cy="90" r="90"/></svg>
        <div class="exito-check"><svg><path d="M35 90 l30 30 l60 -60"/></svg></div>
      </div>
      <div class="exito-titulo">${texto}</div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>overlay.remove(),1800);
}


/* ==================================================
   📍 Modal de confirmación de destino (Mapa)
================================================== */
function confirmDestino(lat, lng, nombre) {
  const modal = document.getElementById("modalDestino");
  const nombreCliente = document.getElementById("modalNombreCliente");
  const btnIr = document.getElementById("btnIr");
  const btnCancelar = document.getElementById("btnCancelar");

  if (!modal) return;
  nombreCliente.textContent = nombre;
  modal.style.display = "grid";

  btnIr.onclick = () => {
    btnIr.classList.add("rebote");
    setTimeout(()=>btnIr.classList.remove("rebote"),600);
    setTimeout(()=>{ modal.style.display="none"; irCliente(lat, lng); },250);
  };
  btnCancelar.onclick = () => modal.style.display = "none";
}

/* ==================================================
   🗺️ Mapa Full
================================================== */
function renderMapaFull(){
  if(!document.getElementById("mapaFull")) return;
  if(mapaFull){ mapaFull.remove(); }

  mapaFull = L.map("mapaFull").setView([-34.60, -58.38], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapaFull);

  clientesData.forEach(c=>{
    if(!c.lat || !c.lng) return;
    const mk=L.marker([c.lat, c.lng]).addTo(mapaFull);
    mk.bindTooltip(c.nombre);
    mk.on("click", ()=>confirmDestino(c.lat, c.lng, c.nombre));
  });
}

/* ==================================================
   🤖 COACH DE VENTAS IA
================================================== */
async function cargarCoach(clave) {
  const cont = document.getElementById("contenedorCoach");
  if (!cont) return;
  cont.innerHTML = "⏳ Analizando rendimiento...";
  try {
    const resp = await fetch(`${URL_API_BASE}?accion=getConsejosVendedor&clave=${clave}`);
    const data = await resp.json();

    if (!data || !data.sugerencias || !data.sugerencias.length) {
      cont.innerHTML = "✅ Sin alertas ni recomendaciones por ahora.";
      return;
    }

    cont.innerHTML = data.sugerencias.map(s => `<div class="coach-item">💡 ${s}</div>`).join("");

    if (data.estadisticas && data.estadisticas.zonas) {
      const zonas = data.estadisticas.zonas;
      const labels = Object.keys(zonas);
      const valores = labels.map(z => zonas[z].monto);
      const ctx = document.getElementById("graficoHeatmap").getContext("2d");
      if (ctx._chart) ctx._chart.destroy();
      ctx._chart = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets: [{ label: "💰 Ventas por zona", data: valores, borderWidth: 1 }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }
  } catch (e) {
    cont.innerHTML = "❌ Error cargando Coach IA.";
    console.error(e);
  }
}

/* ==================================================
   🔗 Exponer funciones
================================================== */
window.agregarDigito = agregarDigito;
window.borrarDigito = borrarDigito;
window.login = login;
window.logout = logout;
window.mostrarSeccion = mostrarSeccion;
window.toggleModoOscuro = toggleModoOscuro;
window.toggleTemaMenu = toggleTemaMenu;
window.aplicarTema = aplicarTema;
