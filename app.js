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

  await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  inicializarNotificaciones(clave);
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
  if(cont) cont.innerHTML="⏳ Cargando...";

  const r = await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
  clientesData = await r.json();

  const afterGeo = () => {
    ordenarPorDistancia();
    aplicarOrdenManualSiExiste();
    renderClientes();
    actualizarPanelIA();
    alertasIA();
  };

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      pos => { posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; afterGeo(); },
      ()=> afterGeo(),
      {enableHighAccuracy:true, maximumAge:15000, timeout:8000}
    );
  } else afterGeo();
}

/* ================================
   🧭 Ordenar
================================ */
function ordenarPorDistancia(){
  if(!posicionActual) return;
  clientesData.sort((a,b)=>{
    const da = a.lat&&a.lng ? distanciaKm(posicionActual.lat,posicionActual.lng,+a.lat,+a.lng) : 9999;
    const db = b.lat&&b.lng ? distanciaKm(posicionActual.lat,posicionActual.lng,+b.lat,+b.lng) : 9999;
    return da-db;
  });
}

function aplicarOrdenManualSiExiste(){
  const orden=cargarOrden();
  if(!orden.length) return;
  const map = new Map(clientesData.map(c=>[String(c.numero),c]));
  clientesData = orden.map(id=>map.get(String(id))).filter(Boolean).concat(
    clientesData.filter(c=>!orden.includes(String(c.numero)))
  );
}

/* ================================
   🧱 UI Clientes
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor"); if(!cont) return;
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const lat=+c.lat, lng=+c.lng;
    const dist = (posicionActual && lat&&lng)? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng):null;
    c._dist = dist;

    const card=document.createElement("div");
    card.className="cliente";
    card.id="c_"+c.numero;
    card.setAttribute("draggable","true");
    card.dataset.index=idx;

    card.innerHTML=`
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}</span>
        ${dist!==null? `<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>
      <div class="fila check-grande">
        <button onclick="toggleVisita(${c.numero})" id="btnV_${c.numero}" class="btn-visita">No Visitado</button>
        <button onclick="toggleCompra(${c.numero})" id="btnC_${c.numero}" class="btn-compra">No Compró</button>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        ${lat&&lng? `<button class="btn-secundario" onclick="irCliente(${lat},${lng})">🚗 Ir</button>`:`<button class="btn-secundario" disabled>🚫 Sin mapa</button>`}
      </div>
    `;

    card.addEventListener("dragstart",e=>{ dragSrcIndex=idx; });
    card.addEventListener("dragover",e=>e.preventDefault());
    card.addEventListener("drop",e=>{
      e.preventDefault();
      const cards=[...cont.querySelectorAll(".cliente")];
      const targetIndex=cards.indexOf(card);
      if(dragSrcIndex===targetIndex) return;
      const mov=clientesData.splice(dragSrcIndex,1)[0];
      clientesData.splice(targetIndex,0,mov);
      guardarOrden(clientesData.map(c=>String(c.numero)));
      renderClientes();
    });

    cont.appendChild(card);
  });
}

/* ================================
   ✅ Botones táctiles
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
  const c=clientesData.find(x=>x.numero==num);
  const visitado=document.getElementById("btnV_"+num).classList.contains("on");
  const compro=document.getElementById("btnC_"+num).classList.contains("on");
  const comentario=document.getElementById(`coment-${num}`).value;

  await fetch(`${URL_API_BASE}?accion=registrarVisita&numero=${num}&vendedor=${localStorage.getItem("vendedorClave")}&nombre=${c.nombre}&direccion=${c.direccion}&localidad=${c.localidad}&visitado=${visitado}&compro=${compro}&comentario=${encodeURIComponent(comentario)}`);

  if(visitado&&compro){
    clientesData = clientesData.filter(x=>x.numero!=num).concat([c]);
  }
  renderClientes();
  registrarInteraccionIA("✅ Visita registrada. ¡Seguimos!");
}

/* ================================
   🌍 Mapa
================================ */
function irCliente(lat,lng){ window.open(`https://www.google.com/maps?q=${lat},${lng}`); }
function renderMapaFull(){}

/* ================================
   🧠 IA Coach (C + D)
================================ */
function generarConsejosIA(clientes){
  const out=[];
  clientes.forEach(c=>{
    if(c.frecuenciaCompraDias && c.ultCompraDias >= c.frecuenciaCompraDias - 1)
      out.push(`🟢 Hoy ${c.nombre} está listo para mover mercadería. ¡Pasá y cerrá venta! 💥`);
    if(c.ultCompraDias && c.frecuenciaCompraDias && c.ultCompraDias > c.frecuenciaCompraDias * 2)
      out.push(`🕓 ${c.nombre} hace rato que no compra (${c.ultCompraDias} días). ¡Es hoy o nunca! 💬🔥`);
    if(c.esClienteClave)
      out.push(`⭐ ${c.nombre} es cliente clave. Pasalo temprano mientras hay energía 💪😎`);
    if(c._dist && c._dist<1.2)
      out.push(`🚶‍♂️ ${c.nombre} está cerquita (${c._dist.toFixed(1)} km). Ideal para arrancar el día con confianza ⚡`);
  });
  return out.length? out.sort(()=>Math.random()-0.5) : [`✨ Todo tranqui hoy. Entramos confiados 😎🔥`];
}

function actualizarPanelIA(){
  const p=document.getElementById("iaPanel");
  if(!p) return;
  const c=generarConsejosIA(clientesData);
  p.innerHTML = c.map(txt=>`<div class="bubble-ia">${txt}</div>`).join("");
}

function registrarInteraccionIA(txt){
  const p=document.getElementById("iaPanel");
  if(!p) return;
  p.insertAdjacentHTML("beforeend", `<div class="bubble-user">${txt}</div>`);
  p.scrollTo({ top:p.scrollHeight, behavior:'smooth' });
}

/* ================================
   🔔 Alertas IA automáticas
================================ */
function alertasIA(){
  const c=generarConsejosIA(clientesData);
  const importante = c.find(t=> t.includes("⭐") || t.includes("🔥") );
  if(importante) mostrarConsejoIA(importante);
}

function mostrarConsejoIA(txt){
  if(Notification.permission!=="granted"){
    Notification.requestPermission();
    return;
  }
  new Notification("💡 Consejo IA", { body:txt, icon:"ml-icon-192.png" });
}

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
