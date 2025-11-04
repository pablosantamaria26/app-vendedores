/* ================================
   ⚙️ Config principal
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
// Proxy Worker (CORS-safe)
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
  syncOffline();
  notificacionDiaria();
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
  await cargarResumen(clave);
  await cargarCalendario();
  await cargarCoach(clave); // 👈 NUEVO PANEL COACH IA
  inicializarNotificaciones(clave);

  if(clientesHoy && clientesHoy.length){ detectarClienteCercano(clave, clientesHoy); }
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
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  const estado=document.getElementById("estado");
  cont.innerHTML="⏳ Cargando clientes...";
  try{
    const [r1,predR]=await Promise.all([
      fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`),
      fetch(`${URL_API_BASE}?accion=getPrediccionesVendedor&clave=${clave}`)
    ]);
    clientesData=await r1.json();
    const pred=await predR.json();

    const orden=cargarOrden();
    if(orden.length){
      const map=new Map(clientesData.map(c=>[String(c.numero),c]));
      clientesData = orden.map(id=>map.get(String(id))).filter(Boolean)
        .concat(clientesData.filter(c=>!orden.includes(String(c.numero))));
    }

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{ 
        posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderClientes(); 
      }, ()=>renderClientes(), {enableHighAccuracy:true, maximumAge:15000, timeout:8000});
    }else{ renderClientes(); }

    if(estado){ const ahora=new Date().toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}); estado.textContent=`Ruta cargada (${clientesData.length} clientes) — Última actualización: ${ahora}`; }

    return clientesData;
  }catch(e){ console.error("❌ Error al cargar datos:", e); estado.textContent="❌ Error al cargar datos."; return []; }
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
        <button class="btn-secundario" onclick="irCliente(${tieneGeo?lat:"null"},${tieneGeo?lng:"null"})">🚗 Ir a este cliente</button>
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
    if(c.bloqueado){ card.classList.add("bloqueado"); card.querySelectorAll("input,textarea,button").forEach(el=>el.disabled=true); }
    cont.appendChild(card);
  });

  // 🔢 Contador de progreso
  let visitados = 0, compraron = 0;
  clientesData.forEach(c => {
    if (c.bloqueado) visitados++;
    if (c.compro) compraron++;
  });
  const restantes = clientesData.length - visitados;
  let estadoRuta = document.getElementById("estadoRuta");
  if (!estadoRuta) {
    estadoRuta = document.createElement("div");
    estadoRuta.id = "estadoRuta";
    estadoRuta.className = "estado-ruta";
    cont.parentElement.insertBefore(estadoRuta, cont);
  }
  estadoRuta.innerHTML = `🚗 <b>${restantes}</b> por visitar · ✅ <b>${visitados}</b> visitados · 🛒 <b>${compraron}</b> compraron`;
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
   📅 Calendario / Resumen / Notificaciones
   (resto igual a tu versión actual)
================================================== */
// ... (mantener tus funciones originales cargarResumen, cargarCalendario, notificaciones, etc.)

/* ==================================================
   🔗 Exponer funciones
================================================== */
window.agregarDigito = agregarDigito;
window.borrarDigito = borrarDigito;
window.login = login;
window.logout = logout;
window.mostrarSeccion = mostrarSeccion;
window.registrarVisita = registrarVisita;
window.irCliente = irCliente;
window.toggleModoOscuro = toggleModoOscuro;
window.toggleTemaMenu = toggleTemaMenu;
window.aplicarTema = aplicarTema;
