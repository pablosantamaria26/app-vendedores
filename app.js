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
   🗂️ Orden manual
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }
function cargarOrden(){ try{return JSON.parse(localStorage.getItem(keyOrden())||"[]");}catch{return[];} }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

/* ================================
   🚗 Cargar ruta del día
================================ */
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  const estado=document.getElementById("estado");
  if(cont) cont.innerHTML="⏳ Cargando clientes...";

  try{
    const r = await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
    clientesData = await r.json();

    const afterGeo = () => {
      ordenarPorDistancia();
      aplicarOrdenManualSiExiste();
      renderClientes();
      if(estado){
        const ahora=new Date().toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"});
        estado.textContent=`Ruta cargada (${clientesData.length} clientes) — Actualizado: ${ahora}`;
      }
    };

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos => { posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; afterGeo(); },
        () => afterGeo(),
        {enableHighAccuracy:true, maximumAge:15000, timeout:8000}
      );
    } else afterGeo();

    return clientesData;
  }catch(e){
    console.error("❌ Error al cargar datos:", e);
    if(estado) estado.textContent="❌ Error al cargar datos.";
    return [];
  }
}

function ordenarPorDistancia(){
  if(!posicionActual) return;
  clientesData.sort((a,b)=>{
    const da = distanciaKm(posicionActual.lat,posicionActual.lng,+a.lat,+a.lng);
    const db = distanciaKm(posicionActual.lat,posicionActual.lng,+b.lat,+b.lng);
    return da - db;
  });
}

function aplicarOrdenManualSiExiste(){
  const orden = cargarOrden();
  if(!Array.isArray(orden) || !orden.length) return;
  const map = new Map(clientesData.map(c=>[String(c.numero), c]));
  const nuevos = orden.map(id=>map.get(String(id))).filter(Boolean);
  const extras = clientesData.filter(c=>!orden.includes(String(c.numero)));
  clientesData = [...nuevos, ...extras];
}

/* ================================
   🧱 Render tarjetas (CON BOTONES TÁCTILES CÍRCULO)
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor"); if(!cont) return;
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const lat = +c.lat, lng = +c.lng;
    const tieneGeo = Number.isFinite(lat)&&Number.isFinite(lng);
    const dist = (posicionActual && tieneGeo) ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    const card = document.createElement("div");
    card.className="cliente";
    card.id="c_"+c.numero;
    card.setAttribute("draggable","true");
    card.dataset.index = idx;

    card.innerHTML = `
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}</span>
        ${dist!==null ? `<span class="badge">📏 ${dist.toFixed(1)} km</span>` : ""}
      </div>

      <div class="check-grande">
        <div class="btn-visita" id="btnVisita-${c.numero}"></div>
        <div class="btn-compra" id="btnCompra-${c.numero}"></div>
      </div>

      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>

      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        ${tieneGeo ? `<button class="btn-secundario" onclick="irCliente(${lat},${lng})">🚗 Ir</button>` : `<button class="btn-secundario" disabled>🚗 Sin ubicación</button>`}
      </div>
    `;

    card.addEventListener("dragstart",(ev)=>{ dragSrcIndex = idx; ev.dataTransfer.effectAllowed="move"; });
    card.addEventListener("dragover",(ev)=>{ ev.preventDefault(); ev.dataTransfer.dropEffect="move"; });
    card.addEventListener("drop",(ev)=>{
      ev.preventDefault();
      const cards = Array.from(cont.querySelectorAll(".cliente"));
      const targetIndex = cards.indexOf(card);
      if(dragSrcIndex===null || dragSrcIndex===targetIndex) return;

      const moved = clientesData.splice(dragSrcIndex,1)[0];
      clientesData.splice(targetIndex,0,moved);
      guardarOrden(clientesData.map(x=>String(x.numero)));
      renderClientes();
    });

    cont.appendChild(card);
  });
}

/* ================================
   ✅ Lógica de botones táctiles (modo A)
================================ */
document.addEventListener("click",(ev)=>{
  if(ev.target.classList.contains("btn-visita")){
    ev.target.classList.toggle("on");
  }
  if(ev.target.classList.contains("btn-compra")){
    ev.target.classList.toggle("on");
  }
});

/* ================================
   💾 Registrar visita
================================ */
async function registrarVisita(num){
  const c = clientesData.find(x=>x.numero==num);
  const visitado = document.getElementById("btnVisita-"+num).classList.contains("on");
  const compro = document.getElementById("btnCompra-"+num).classList.contains("on");
  const comentario = document.getElementById(`coment-${num}`).value;

  await fetch(`${URL_API_BASE}?accion=registrarVisita&numero=${num}&vendedor=${localStorage.getItem("vendedorClave")}&nombre=${c.nombre}&direccion=${c.direccion}&localidad=${c.localidad}&visitado=${visitado}&compro=${compro}&comentario=${encodeURIComponent(comentario)}`);

  if(visitado && compro){
    clientesData = clientesData.filter(x=>x.numero!=num).concat([c]);
  }
  renderClientes();
  registrarInteraccionIA("✅ Visita registrada. ¡Seguimos!");
}

/* ================================
   🚗 Ir
================================ */
function irCliente(lat,lng){ if(lat&&lng) window.open(`https://www.google.com/maps?q=${lat},${lng}`); }

/* ================================
   🧠 IA (se mantiene igual)
================================ */
function mostrarConsejoIA(txt){
  if(Notification.permission==="granted"){
    new Notification("💡 Consejo", { body:txt, icon:"ml-icon-192.png" });
  }
}
function inicializarNotificaciones(v){ /* se mantiene igual */ }
function syncOffline(){ /* igual */ }
function cargarResumen(){ /* igual */ }
function cargarCalendario(){ /* igual */ }
function notificacionDiaria(){ /* igual */ }
function detectarClienteCercano(){ /* igual */ }
function renderMapaFull(){ /* igual */ }

/* IA Generativa mínima */
function generarConsejosIA(clientes){
  const r = [];
  clientes.forEach(c=>{
    if(c._dist && c._dist<1.2) r.push(`🚶 ${c.nombre} está cerca (${c._dist.toFixed(1)}km). Pasá ahora y arrancá con ritmo.`);
  });
  return r.length?r:["✨ Todo tranqui. Mantené tu ritmo."];
}

function actualizarPanelIA(){
  const p=document.getElementById("iaPanel"); if(!p) return;
  const consejos = generarConsejosIA(clientesData);
  p.innerHTML="";
  consejos.forEach(t=>{
    const d=document.createElement("div");
    d.className="bubble-ia"; d.textContent=t;
    p.appendChild(d);
  });
}
function registrarInteraccionIA(txt){
  const p=document.getElementById("iaPanel");
  const d=document.createElement("div");
  d.className="bubble-user"; d.textContent=txt;
  p.appendChild(d);
  p.scrollTo({ top:p.scrollHeight, behavior:"smooth" });
}

/* Vincular IA con carga de ruta */
const _cargarRutaOriginal = cargarRuta;
cargarRuta = async function(clave){
  const data = await _cargarRutaOriginal(clave);
  actualizarPanelIA();
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
