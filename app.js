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
  if(!vendedores[clave]){
    document.getElementById("error").textContent="❌ Clave incorrecta";
    return;
  }
  localStorage.setItem("vendedorClave", clave);
  document.getElementById("login").style.display="none";
  mostrarApp();
}

function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.addEventListener("load",()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]) document.getElementById("login").style.display="none", mostrarApp();
  restaurarTema();
  syncOffline();
  notificacionDiaria();
});

/* ================================
   🎨 Temas (3 DUOTONO)
================================ */
function toggleTemaMenu(ev){
  ev.stopPropagation();
  const m=document.getElementById("temaMenu");
  m.classList.toggle("visible");
  const close=()=>{ m.classList.remove("visible"); document.removeEventListener("click", close); };
  setTimeout(()=>document.addEventListener("click", close),0);
}

function aplicarTema(clase){
  document.body.className = clase;
  localStorage.setItem("temaPreferido", clase);
}

function restaurarTema(){
  aplicarTema(localStorage.getItem("temaPreferido") || "tema-oceano");
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

  const clientesHoy = await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  inicializarNotificaciones(clave);

  if(clientesHoy?.length) detectarClienteCercano(clientesHoy);
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
   🗂️ Orden Manual
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
  cont.innerHTML="⏳ Cargando clientes...";

  try{
    const r = await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
    clientesData = await r.json();

    const afterGeo = () => {
      ordenarPorDistancia();
      aplicarOrdenManualSiExiste();
      renderClientes();
      actualizarPanelIA();
      estado.textContent=`Ruta cargada (${clientesData.length}) — ${new Date().toLocaleTimeString()}`;
    };

    navigator.geolocation ?
      navigator.geolocation.getCurrentPosition(
        pos => { posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; afterGeo(); },
        () => afterGeo(),
        {enableHighAccuracy:true, maximumAge:15000, timeout:8000}
      ) : afterGeo();

    return clientesData;
  }catch(e){
    estado.textContent="❌ Error al cargar datos.";
    return [];
  }
}

function ordenarPorDistancia(){
  if(!posicionActual) return;
  clientesData.sort((a,b)=>{
    const da = distanciaKm(posicionActual.lat,posicionActual.lng,+a.lat,+a.lng);
    const db = distanciaKm(posicionActual.lat,posicionActual.lng,+b.lat,+b.lng);
    return da-db;
  });
}

function aplicarOrdenManualSiExiste(){
  const orden=cargarOrden();
  if(!orden.length) return;
  const map=new Map(clientesData.map(c=>[String(c.numero),c]));
  clientesData = orden.map(id=>map.get(String(id))).filter(Boolean)
    .concat(clientesData.filter(c=>!orden.includes(String(c.numero))));
}

/* ================================
   🧱 Render tarjetas con botones táctiles
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const lat=+c.lat, lng=+c.lng;
    const tieneGeo = Number.isFinite(lat)&&Number.isFinite(lng);
    const dist = posicionActual && tieneGeo ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    const card=document.createElement("div");
    card.className="cliente"; card.dataset.index=idx;

    const vOn = c.visitado ? "on" : "";
    const cOn = c.visitado && c.compro ? "on" : "";
    const bloqueoCompra = c.visitado ? "" : "style='opacity:.45;pointer-events:none;'";

    card.innerHTML=`
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}</span>
        ${dist!==null? `<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>

      <div class="check-grande">
        <button class="btn-visita ${vOn}" id="btnVisita-${c.numero}">${vOn?"Visitado ✅":"No Visitado"}</button>
        <button class="btn-compra ${cOn}" id="btnCompra-${c.numero}" ${bloqueoCompra}>${cOn?"Compró 🛍️":"No Compró"}</button>
      </div>

      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2">${c.comentario||""}</textarea>

      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        ${tieneGeo? `<button class="btn-secundario" onclick="irCliente(${lat},${lng})">🚗 Ir</button>`:`<button class="btn-secundario" disabled>🚗 Sin mapa</button>`}
      </div>
    `;

    card.draggable=true;
    card.addEventListener("dragstart",(e)=>{ dragSrcIndex=idx; });
    card.addEventListener("dragover",(e)=>e.preventDefault());
    card.addEventListener("drop",(e)=>{
      e.preventDefault();
      const cards=[...cont.querySelectorAll(".cliente")];
      const targetIndex=cards.indexOf(card);
      const mov=clientesData.splice(dragSrcIndex,1)[0];
      clientesData.splice(targetIndex,0,mov);
      guardarOrden(clientesData.map(x=>String(x.numero)));
      renderClientes();
    });

    cont.appendChild(card);
  });
}

/* ================================
   ✅ Botones táctiles inteligentes
================================ */
document.addEventListener("click",(ev)=>{
  if(ev.target.classList.contains("btn-visita")){
    ev.target.classList.toggle("on");
    const num=ev.target.id.split("-")[1];
    const compra=document.getElementById("btnCompra-"+num);
    if(ev.target.classList.contains("on")){
      compra.style.opacity="1"; compra.style.pointerEvents="auto";
    } else {
      compra.classList.remove("on");
      compra.style.opacity=".45"; compra.style.pointerEvents="none";
    }
  }

  if(ev.target.classList.contains("btn-compra")){
    ev.target.classList.toggle("on");
  }
});

/* ================================
   💾 Registrar visita
================================ */
async function registrarVisita(num){
  const c=clientesData.find(x=>x.numero==num);
  const visitado=document.getElementById("btnVisita-"+num).classList.contains("on");
  const compro=document.getElementById("btnCompra-"+num).classList.contains("on");
  const comentario=document.getElementById(`coment-${num}`).value;

  try{
    await fetch(`${URL_API_BASE}?accion=registrarVisita&numero=${num}&vendedor=${localStorage.getItem("vendedorClave")}&nombre=${c.nombre}&direccion=${c.direccion}&localidad=${c.localidad}&visitado=${visitado}&compro=${compro}&comentario=${encodeURIComponent(comentario)}`);
  }catch{
    queueOffline({t:"visita", params:{num,visitado,compro,comentario}});
  }

  if(visitado && compro){
    clientesData = clientesData.filter(x=>x.numero!=num).concat([c]);
  }
  renderClientes();
  registrarInteraccionIA("✅ Visita registrada.");
}

/* ================================
   🚗 Google Maps
================================ */
function irCliente(lat,lng){ window.open(`https://www.google.com/maps?q=${lat},${lng}`,"_blank"); }

/* ================================
   🤖 IA Coach
================================ */
function generarConsejosIA(clientes){
  const r=[];
  clientes.forEach(c=>{
    if(c._dist && c._dist<1.1) r.push(`⚡ ${c.nombre} está muy cerca (${c._dist.toFixed(1)} km). ¡Aprovechá ahora!`);
  });
  return r.length?r:["✨ Ruta tranquila. Mantené tu ritmo."];
}

function actualizarPanelIA(){
  const p=document.getElementById("iaPanel");
  p.innerHTML=generarConsejosIA(clientesData)
    .map(t=>`<div class="bubble-ia">${t}</div>`).join("");
}
function registrarInteraccionIA(txt){
  const p=document.getElementById("iaPanel");
  p.insertAdjacentHTML("beforeend", `<div class="bubble-user">${txt}</div>`);
  p.scrollTo({top:p.scrollHeight, behavior:"smooth"});
}

/* ================================
   🔔 Aviso inteligente cliente cercano
================================ */
function detectarClienteCercano(clientes){
  if(!navigator.geolocation) return;

  const RADIO=120; // metros

  setInterval(()=>{
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude,longitude}=pos.coords;
      clientes.forEach(c=>{
        if(!c.lat||!c.lng) return;
        const d=distanciaKm(latitude,longitude,+c.lat,+c.lng)*1000;
        if(d<RADIO){
          mostrarConsejoIA(`📍 Estás muy cerca de ${c.nombre}.`);
        }
      });
    },()=>{}, {enableHighAccuracy:true, maximumAge:20000});
  },60000);
}

function mostrarConsejoIA(txt){
  if(Notification.permission==="granted"){
    new Notification("💡 Consejo", { body:txt, icon:"ml-icon-192.png" });
  }
}

/* ================================
   🔔 Notificaciones FCM (sin tocar)
================================ */
function inicializarNotificaciones(vendedor){
  const firebaseConfig = {
    apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
    authDomain: "app-vendedores-inteligente.firebaseapp.com",
    projectId: "app-vendedores-inteligente",
    storageBucket: "app-vendedores-inteligente.appspot.com",
    messagingSenderId: "583313989429",
    appId: "1:583313989429:web:c4f78617ad957c3b11367c"
  };
  if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const messaging=firebase.messaging();

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("firebase-messaging-sw.js").then(async reg=>{
      await Notification.requestPermission();
      const token=await messaging.getToken({
        vapidKey:"BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o",
        serviceWorkerRegistration:reg
      });
      if(token && vendedor){
        await fetch(URL_API_BASE,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({vendedor,token})});
      }
      messaging.onMessage(p=> mostrarConsejoIA(`${p.notification.title} — ${p.notification.body}`));
    });
  }
}

/* ================================
   📶 Offline Queue
================================ */
function queueOffline(it){
  let q=[]; try{q=JSON.parse(localStorage.getItem("offlineQueue")||"[]");}catch{}
  q.push(it); localStorage.setItem("offlineQueue",JSON.stringify(q));
}
async function syncOffline(){
  if(!navigator.onLine) return;
  let q=[]; try{q=JSON.parse(localStorage.getItem("offlineQueue")||"[]");}catch{}
  const rest=[];
  for(const it of q){
    try{
      if(it.t==="visita"){
        const {num,visitado,compro,comentario}=it.params;
        await fetch(`${URL_API_BASE}?accion=registrarVisita&numero=${num}&visitado=${visitado}&compro=${compro}&comentario=${encodeURIComponent(comentario)}`);
      }
    }catch{ rest.push(it); }
  }
  localStorage.setItem("offlineQueue",JSON.stringify(rest));
}

/* ================================
   📈 Resumen
================================ */
async function cargarResumen(clave){
  const cont=document.getElementById("contenedorResumen");
  const canvas=document.getElementById("graficoResumen");
  cont.innerHTML="⏳ Analizando...";
  try{
    const r=await fetch(`${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`);
    const d=await r.json();
    cont.innerHTML=`<p>Visitas: <b>${d.totalHoy}</b> — Compraron: <b>${d.compraronHoy}</b></p>`;
    if(canvas && window.Chart){
      const ctx=canvas.getContext("2d");
      if(canvas._chartInstance) canvas._chartInstance.destroy();
      canvas._chartInstance=new Chart(ctx,{type:"doughnut",data:{
        labels:["Compraron","No compraron"],
        datasets:[{data:[d.compraronHoy,d.totalHoy-d.compraronHoy]}]
      }});
    }
  }catch(e){ cont.innerHTML="❌ Error"; }
}

/* ================================
   📅 Calendario
================================ */
async function cargarCalendario(){
  const cont=document.getElementById("contenedorCalendario");
  const clave=localStorage.getItem("vendedorClave");
  cont.innerHTML="⏳ Cargando...";
  try{
    const resp=await fetch(`${URL_API_BASE}?accion=getCalendarioVisitas&clave=${clave}`);
    const data=await resp.json();
    cont.innerHTML = data.map(f=>`
      <div class="cal-item">
        <b>${f.fecha}</b> — ${f.dia}<br>📍 ${f.localidad}
      </div>
    `).join("");
  }catch{ cont.innerHTML="❌ Error"; }
}

/* ================================
   🔗 Exponer
================================ */
window.agregarDigito=agregarDigito;
window.borrarDigito=borrarDigito;
window.login=login;
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.registrarVisita=registrarVisita;
window.irCliente=irCliente;
window.toggleTemaMenu=toggleTemaMenu;
window.aplicarTema=aplicarTema;
window.toggleModoOscuro=restaurarTema;
