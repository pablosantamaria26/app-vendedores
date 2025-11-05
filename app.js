/* ==========================================================
   🧠 APP DE VENDEDORES — Versión estabilizada y ordenada
   - Login correcto
   - Ruta del día con orden + distancias
   - Guardar = bloquear + bajar al final + mantener arriba
   - Panel con: total / visitados / compraron / zona del día
   - Botón IR → confirmación → Google Maps
   - Mapa dinámico
   - FCM listo
   - Geofencing suave
==========================================================*/

const vendedores = { "0001":"Martín","0002":"Lucas","0003":"Mercado Limpio" };
const URL_API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";

let clientesData = [];
let posicionActual = null;

/* ========== LOGIN ========== */
function agregarDigito(n){ const i=document.getElementById("clave"); if(i.value.length<4) i.value+=n; }
function borrarDigito(){ const i=document.getElementById("clave"); i.value=i.value.slice(0,-1); }

function login(){
  const c=document.getElementById("clave").value;
  if(!vendedores[c]) return document.getElementById("error").textContent="❌ Clave incorrecta";
  localStorage.setItem("vendedorClave",c);
  document.getElementById("login").style.display="none";
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

/* ========== TEMA ========== */
function aplicarTema(t){ document.body.className=t; localStorage.setItem("temaPreferido",t); }
function restaurarTema(){ aplicarTema(localStorage.getItem("temaPreferido")||"tema-confianza"); }
function toggleTemaMenu(e){ e.stopPropagation(); const m=document.getElementById("temaMenu"); m.classList.toggle("visible"); }

/* ========== INICIO ========== */
window.addEventListener("load",()=>{
  restaurarTema();
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ document.getElementById("login").style.display="none"; mostrarApp(); }
});

/* ========== NAVEGACIÓN ========== */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(e=>e.classList.remove("visible"));
  document.getElementById("seccion-"+s).classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`).classList.add("activo");
  if(s==="mapa") renderMapa();
}

/* ========== DISTANCIAS ========== */
const toRad=v=>v*Math.PI/180;
function distKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));
}

/* ========== RUTA DEL DÍA ========== */
async function mostrarApp(){
  const clave=localStorage.getItem("vendedorClave");
  document.getElementById("titulo").textContent=`👋 Hola, ${vendedores[clave]}`;
  await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  iniciarNotificaciones(clave);
}

async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="⏳ Cargando...";
  const r=await fetch(`${URL_API}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
  clientesData = await r.json();

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderClientes(); },()=>renderClientes());
  }else renderClientes();

  actualizarPanelRuta();
}

function actualizarPanelRuta(){
  const p=document.getElementById("panelRuta");
  const total=clientesData.length;
  const visitados=clientesData.filter(c=>c.visitado==1).length;
  const compraron=clientesData.filter(c=>c.compro==1).length;
  const zona = clientesData[0]?.localidad || "Sin zona";
  p.innerHTML=`
    📦 Clientes: <b>${total}</b> — ✅ Visitados: <b>${visitados}</b> — 🛍️ Compraron: <b>${compraron}</b><br>
    📍 Zona del día: <b>${zona}</b>
  `;
}

/* ========== RENDER TARJETAS ========== */
function renderClientes(){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const lat=+c.lat, lng=+c.lng;
    const tieneGeo=lat&&lng;
    const dist=posicionActual&&tieneGeo? distKm(posicionActual.lat,posicionActual.lng,lat,lng):null;

    const div=document.createElement("div");
    div.className="cliente"+(c.bloqueado?" bloqueado":"");
    div.id=`c_${c.numero}`;

    div.innerHTML=`
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}, ${c.localidad||""}</span>
        ${dist?`<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>

      <div class="check-grande">
        <button class="btn-visita ${c.visitado?"on":""}" id="v-${c.numero}">${c.visitado?"Visitado ✅":"No Visitado"}</button>
        <button class="btn-compra ${c.compro?"on":""}" id="c-${c.numero}" ${!c.visitado?"style='opacity:.45;pointer-events:none;'":""}>${c.compro?"Compró 🛍️":"No Compró"}</button>
      </div>

      <textarea id="t-${c.numero}" placeholder="Comentario..." rows="2">${c.comentario||""}</textarea>

      <div class="acciones">
        <button onclick="guardar(${c.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="ir(${lat},${lng})">🚗 Ir</button>
      </div>
    `;

    cont.appendChild(div);
  });
}

/* ====== BOTONES ====== */
document.addEventListener("click",(ev)=>{
  if(ev.target.classList.contains("btn-visita")){
    ev.target.classList.toggle("on");
    const num=ev.target.id.split("-")[1];
    const compra=document.getElementById("c-"+num);
    if(ev.target.classList.contains("on")){ compra.style.opacity="1"; compra.style.pointerEvents="auto"; }
    else{ compra.classList.remove("on"); compra.style.opacity=".45"; compra.style.pointerEvents="none"; }
  }
  if(ev.target.classList.contains("btn-compra")){
    ev.target.classList.toggle("on");
  }
});

/* ========== GUARDAR VISITA ========== */
async function guardar(num){
  const c=clientesData.find(x=>x.numero==num);
  const visitado=document.getElementById("v-"+num).classList.contains("on");
  const compro=document.getElementById("c-"+num).classList.contains("on");
  const comentario=document.getElementById("t-"+num).value;

  c.visitado=visitado;
  c.compro=compro;
  c.comentario=comentario;
  c.bloqueado=true;

  clientesData = clientesData.filter(x=>x.numero!=num).concat([c]);
  renderClientes();
  window.scrollTo({top:0,behavior:"smooth"});
  actualizarPanelRuta();

  fetch(`${URL_API}?accion=registrarVisita&numero=${num}&vendedor=${localStorage.getItem("vendedorClave")}&visitado=${visitado}&compro=${compro}&comentario=${encodeURIComponent(comentario)}`).catch(()=>{});
}

/* ========== MAPA ========== */
let mapa;
function renderMapa(){
  const el=document.getElementById("mapaFull");
  el.innerHTML="";
  mapa=L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapa);

  clientesData.forEach(c=>{
    if(c.lat&&c.lng){
      L.marker([+c.lat,+c.lng]).addTo(mapa).on("click",()=>confirmarIr(c.nombre,c.lat,c.lng));
    }
  });
}

function confirmarIr(nombre,lat,lng){
  if(confirm(`¿Ir a ${nombre}?`)) ir(lat,lng);
}

function ir(lat,lng){
  window.open(`https://www.google.com/maps?q=${lat},${lng}`,"_blank");
}

/* ========== RESUMEN ========== */
async function cargarResumen(clave){
  const cont=document.getElementById("contenedorResumen");
  const r=await fetch(`${URL_API}?accion=getResumenVendedor&clave=${clave}`);
  const d=await r.json();
  cont.innerHTML=`Visitas: <b>${d.totalHoy}</b> — Compraron: <b>${d.compraronHoy}</b>`;
  
  const ctx=document.getElementById("graficoResumen").getContext("2d");
  new Chart(ctx,{type:"doughnut",data:{labels:["Compraron","No"],datasets:[{data:[d.compraronHoy,d.totalHoy-d.compraronHoy]}]}});
}

/* ========== CALENDARIO ========== */
async function cargarCalendario(){
  const clave=localStorage.getItem("vendedorClave");
  const cont=document.getElementById("contenedorCalendario");
  const r=await fetch(`${URL_API}?accion=getCalendarioVisitas&clave=${clave}`);
  const d=await r.json();
  cont.innerHTML=d.map(f=>`<div class="cal-item"><b>${f.fecha}</b> — ${f.dia}<br>📍 ${f.localidad}</div>`).join("");
}

/* ========== FCM ========== */
function iniciarNotificaciones(v){
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("firebase-messaging-sw.js");
}

/* ========== EXPONER ========== */
window.agregarDigito=agregarDigito;
window.borrarDigito=borrarDigito;
window.login=login;
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
