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
  document.getElementById("login").style.display="none";
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.addEventListener("load",()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ document.getElementById("login").style.display="none"; mostrarApp(); }
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
  m.classList.toggle("visible");
  const close=()=>{ m.classList.remove("visible"); document.removeEventListener("click", close); };
  setTimeout(()=>document.addEventListener("click", close), 0);
}
function aplicarTema(clase){
  document.body.className = clase;
  localStorage.setItem("temaPreferido", clase);
}
function restaurarTema(){
  aplicarTema(localStorage.getItem("temaPreferido")||"tema-confianza");
}
function toggleModoOscuro(){
  const actual=document.body.classList.contains("tema-foco");
  aplicarTema(actual ? "tema-confianza" : "tema-foco");
}

/* ================================
   🧭 Navegación
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  document.getElementById("seccion-"+s).classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`).classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
   🚀 App principal
================================ */
async function mostrarApp(){
  const clave=localStorage.getItem("vendedorClave");
  document.getElementById("titulo").textContent=`👋 Hola, ${vendedores[clave]}`;

  const clientesHoy=await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  inicializarNotificaciones(clave);

  if(clientesHoy?.length) detectarClienteCercano(clave, clientesHoy);
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
   🗂️ Orden (por vendedor)
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }
function cargarOrden(){ try{return JSON.parse(localStorage.getItem(keyOrden())||"[]");}catch{return[];} }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

/* ================================
   🚗 Cargar ruta del día
================================ */
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="⏳ Cargando...";
  const r=await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
  clientesData = await r.json();

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude};
      ordenarPorDistancia();
      renderClientes();
    },()=>{ ordenarPorDistancia(); renderClientes(); });
  } else { ordenarPorDistancia(); renderClientes(); }

  return clientesData;
}

/* ================================
   🧭 Ordenar automáticamente por distancia
================================ */
function ordenarPorDistancia(){
  if(!posicionActual) return;
  clientesData.sort((a,b)=>{
    const da = distanciaKm(posicionActual.lat,posicionActual.lng,parseFloat(a.lat),parseFloat(a.lng))||999;
    const db = distanciaKm(posicionActual.lat,posicionActual.lng,parseFloat(b.lat),parseFloat(b.lng))||999;
    return da-db;
  });
}

/* ================================
   🧱 Render tarjetas
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const lat=parseFloat(c.lat), lng=parseFloat(c.lng);
    const dist=(posicionActual)? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    cont.insertAdjacentHTML("beforeend",`
      <div class="cliente" id="c_${c.numero}">
        <h3>${c.numero} - ${c.nombre}</h3>
        <div class="fila">
          <span>📍 ${c.direccion||""}</span>
          ${dist?`<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
        </div>

        <div class="fila check-grande">
          <button onclick="toggleVisita(${c.numero})" id="btnV_${c.numero}" class="btn-visita">No Visitado</button>
          <button onclick="toggleCompra(${c.numero})" id="btnC_${c.numero}" class="btn-compra">No Compró</button>
        </div>

        <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>

        <div class="acciones">
          <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
          <button class="btn-secundario" onclick="irCliente(${lat},${lng})">🚗 Ir</button>
        </div>
      </div>
    `);
  });
}

/* ================================
   ✅ Botones táctiles (no checkbox)
================================ */
function toggleVisita(n){
  const b=document.getElementById("btnV_"+n);
  b.classList.toggle("on");
  b.textContent = b.classList.contains("on") ? "Visitado ✅" : "No Visitado";
}
function toggleCompra(n){
  const b=document.getElementById("btnC_"+n);
  b.classList.toggle("on");
  b.textContent = b.classList.contains("on") ? "Compró 🛍️" : "No Compró";
}

/* ================================
   💾 Registrar visita
================================ */
async function registrarVisita(num){
  const c = clientesData.find(x=>x.numero==num);
  const visitado = document.getElementById("btnV_"+num).classList.contains("on");
  const compro   = document.getElementById("btnC_"+num).classList.contains("on");
  const comentario = document.getElementById(`coment-${num}`).value;

  await fetch(`${URL_API_BASE}?accion=registrarVisita&numero=${num}&vendedor=${localStorage.getItem("vendedorClave")}&nombre=${c.nombre}&direccion=${c.direccion}&localidad=${c.localidad}&visitado=${visitado}&compro=${compro}&comentario=${encodeURIComponent(comentario)}`);

  if(visitado && compro){
    clientesData = clientesData.filter(x=>x.numero!=num).concat([c]);
  }
  renderClientes();
}

/* ================================
   🚗 Ir al mapa
================================ */
function irCliente(lat,lng){ if(lat&&lng) window.open(`https://www.google.com/maps?q=${lat},${lng}`); }

/* ================================
   🌤️ IA minimalista (notificación suave)
================================ */
function mostrarConsejoIA(txt){
  if(Notification.permission==="granted"){
    new Notification("💡 Consejo", { body:txt, icon:"ml-icon-192.png" });
  }
}

/* ================================
   📡 Inicializar notificaciones
================================ */
function inicializarNotificaciones(v){ /* se mantiene igual */ }
function syncOffline(){ /* se mantiene igual */ }
function cargarResumen(){ /* se mantiene igual */ }
function cargarCalendario(){ /* se mantiene igual */ }
function notificacionDiaria(){ /* se mantiene igual */ }
function detectarClienteCercano(){ /* se mantiene igual */ }

/* ================================
   🌍 Mapa
================================ */
function renderMapaFull(){ /* sin cambios */ }


/* =========================================================
   🧠 IA — Reglas Simples y Consejos
========================================================= */

function generarConsejosIA(clientes){
  const consejos = [];

  const hoy = new Date();

  clientes.forEach(c => {
    // Días sin comprar
    if(c.ultCompraDias && c.ultCompraDias > 10){
      consejos.push(`⚠️ El cliente ${c.numero} (${c.nombre}) no compra hace ${c.ultCompraDias} días.`);
    }

    // Si suele comprar cada X días (predicción desde backend)
    if(c.frecuenciaCompraDias && c.ultCompraDias){
      if(c.ultCompraDias >= c.frecuenciaCompraDias - 1){
        consejos.push(`🟢 Probabilidad de compra HOY en ${c.numero} (${c.nombre}).`);
      }
    }

    // Clientes grandes primero
    if(c.esClienteClave){
      consejos.push(`⭐ ${c.nombre} es cliente importante → Priorizar hoy.`);
    }
  });

  return consejos;
}

/* =========================================================
   💡 Mostrar consejos en el panel IA
========================================================= */
function actualizarPanelIA(){
  const panel = document.getElementById("iaPanel");
  if(!panel) return;

  const consejos = generarConsejosIA(clientesData);

  if(!consejos.length){
    panel.innerHTML = "<span style='opacity:.7'>Sin consejos por ahora ✨</span>";
    return;
  }

  panel.innerHTML = consejos.map(c=>`<div style="margin-bottom:6px">${c}</div>`).join("");
}

/* =========================================================
   🔔 Alertas automáticas IA (cuando hay algo importante)
========================================================= */
function alertasIA(){
  const consejos = generarConsejosIA(clientesData);

  // Solo disparar alertas si hay algo importante
  const alertaClave = consejos.find(c => c.includes("⚠️") || c.includes("⭐"));

  if(alertaClave){
    mostrarConsejoIA(alertaClave);
  }
}

/* =========================================================
   🟢 Integración automática al cargar la ruta
========================================================= */
const _cargarRutaOriginal = cargarRuta;
cargarRuta = async function(clave){
  const data = await _cargarRutaOriginal(clave);
  actualizarPanelIA();
  alertasIA();
  return data;
};


/* ================================
   🔗 Exponer funciones
================================ */
window.agregarDigito=agregarDigito;
window.borrarDigito=borrarDigito;
window.login=login;
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.registrarVisita=registrarVisita;
window.irCliente=irCliente;
window.toggleModoOscuro=toggleModoOscuro;
window.toggleTemaMenu=toggleTemaMenu;
window.aplicarTema=aplicarTema;
window.toggleVisita = toggleVisita;
window.toggleCompra = toggleCompra;
