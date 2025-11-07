/* ==================================================
   🧠 APP VENDEDORES INTELIGENTE — VERSIÓN FINAL 2026
   A + P3 + R2 + MOTIVACIÓN + PROXIMIDAD + OFFLINE
================================================== */

/* ================================
   ⚙️ Configuración
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";

let clientesData = [];
let posicionActual = null;
let mapaFull = null;

/* ================================
   🔐 Login
================================ */
function agregarDigito(n){ const i=document.getElementById("clave"); if(i.value.length<4) i.value+=n; }
function borrarDigito(){ const i=document.getElementById("clave"); i.value=i.value.slice(0,-1); }

function login(){
  const c=document.getElementById("clave").value.trim();
  if(!vendedores[c]){ document.getElementById("error").textContent="❌ Clave incorrecta"; return; }
  localStorage.setItem("vendedorClave",c);
  document.getElementById("login").style.display="none";
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.onload=()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ document.getElementById("login").style.display="none"; mostrarApp(); }
};

/* ================================
   🌙 Modo Oscuro
================================ */
function toggleModoOscuro(){
  const d=document.body.getAttribute("data-dark")==="true";
  document.body.setAttribute("data-dark",!d);
  localStorage.setItem("modoOscuro",String(!d));
}
if(localStorage.getItem("modoOscuro")==="true") document.body.setAttribute("data-dark","true");

/* ================================
   🧭 Navegación
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(x=>x.classList.remove("visible"));
  document.getElementById("seccion-"+s).classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`).classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
   🚀 Iniciar App
================================ */
async function mostrarApp(){
  const clave=localStorage.getItem("vendedorClave");
  document.getElementById("titulo").textContent=`👋 Hola ${vendedores[clave]}`;
  await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  inicializarNotificaciones(clave);
}

/* ================================
   📍 Distancia Haversine
================================ */
const toRad = d=>d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));
}

/* ================================
   🔥 Cargar Ruta
================================ */
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="⏳ Cargando...";

  const r=await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
  clientesData = await r.json();

  // Quitar los ya visitados hoy
  const visitadosHoy = JSON.parse(localStorage.getItem("visitadosHoy_"+clave)||"[]");
  clientesData = clientesData.filter(c=>!visitadosHoy.includes(String(c.numero)));

  // Medir ubicación
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderClientes(); },renderClientes);
  } else renderClientes();
}

/* ================================
   💡 Resumen (barra progreso - P3)
================================ */
function actualizarResumenVivo(){
  const clave=localStorage.getItem("vendedorClave");
  const total = clientesData.length + JSON.parse(localStorage.getItem("visitadosHoy_"+clave)||"[]").length;
  const visitados = total - clientesData.length;
  const cont = document.getElementById("estado");
  cont.innerHTML = `📍 Zona: Hoy — Visitados: <b>${visitados}</b> / ${total} — Restan: <b>${clientesData.length}</b>`;
}

/* ================================
   🧱 Render tarjetas (A + R2)
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="";
  actualizarResumenVivo();

  clientesData.forEach(c=>{
    const dist = (posicionActual && c.lat && c.lng) ? distanciaKm(posicionActual.lat,posicionActual.lng,parseFloat(c.lat),parseFloat(c.lng)).toFixed(1)+" km" : "";
    
    const card=document.createElement("div");
    card.className="cliente";
    card.innerHTML=`
      <h3>${c.nombre}</h3>
      <div class="fila">📍 ${c.direccion || ""} ${c.localidad?`, ${c.localidad}`:""} ${dist?`<span class="badge">📏 ${dist}</span>`:""}</div>
      <div class="acciones">
        <button class="btn-secundario" onclick="marcarVisitado(${c.numero})">✅ Visitado</button>
        <button onclick="irCliente(${c.lat||"null"},${c.lng||"null"})">🚗 Ir</button>
      </div>
    `;
    cont.appendChild(card);
  });
}

/* ================================
   ✅ A → Luego del visitado mostrar COMPRÓ / NO
================================ */
function marcarVisitado(num){
  const c=getCliente(num);
  if(!c) return;

  const cont=document.getElementById("contenedor");
  const div=document.createElement("div");
  div.className="cliente";
  div.innerHTML=`
    <h3>${c.nombre}</h3>
    <p>¿Compró?</p>
    <div class="acciones">
      <button class="btn-secundario" onclick="registrarVisita(${num},true)">🟢 Sí</button>
      <button class="btn-secundario" onclick="registrarVisita(${num},false)">🔴 No</button>
    </div>
    <textarea id="coment-${num}" placeholder="Comentario..."></textarea>
  `;
  cont.innerHTML="";
  cont.appendChild(div);
}

/* ================================
   💾 Registrar visita (R2 + motivación)
================================ */
function getCliente(num){ return clientesData.find(x=>String(x.numero)===String(num)); }

async function registrarVisita(num, compro){
  const c=getCliente(num);
  const comentario=(document.getElementById(`coment-${num}`)?.value||"").trim();
  const vendedor=localStorage.getItem("vendedorClave");

  await fetch(`${URL_API_BASE}?accion=registrarVisita&numero=${c.numero}&nombre=${c.nombre}&direccion=${c.direccion||""}&localidad=${c.localidad||""}&visitado=true&compro=${compro}&comentario=${encodeURIComponent(comentario)}&vendedor=${vendedor}`);

  // R2 → Ocultar tarjeta para este día
  let v=JSON.parse(localStorage.getItem("visitadosHoy_"+vendedor)||"[]");
  v.push(String(num));
  localStorage.setItem("visitadosHoy_"+vendedor,JSON.stringify(v));

  // Motivación
  const frases=["🔥 Excelente ritmo campeón","💪 Muy bien, seguí así","🚀 Alta actitud","🌟 Este es el camino","🎯 Vendedor de élite"];
  toast(frases[Math.floor(Math.random()*frases.length)]);

  cargarRuta(vendedor);
}

/* ================================
   📍 Mapa
================================ */
function renderMapaFull(){
  const el=document.getElementById("mapaFull");
  el.innerHTML="";
  mapaFull=L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaFull);
  clientesData.forEach(c=>{ if(c.lat&&c.lng) L.marker([c.lat,c.lng]).addTo(mapaFull).bindPopup(c.nombre); });
}
function irCliente(lat,lng){
  if(!lat||!lng) return alert("Sin coordenadas");
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,"_blank");
}


/* ================================
   📈 Resumen + gráfico (Chart.js)
================================ */
async function cargarResumen(clave){
  const cont=document.getElementById("contenedorResumen");
  const canvas=document.getElementById("graficoResumen");
  if(cont) cont.innerHTML="⏳ Analizando desempeño...";

  try{
    const [r1,r2]=await Promise.all([
      fetch(`${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`),
      fetch(`${URL_API_BASE}?accion=getPrediccionesVendedor&clave=${clave}`)
    ]);

    const res=await r1.json();
    const ana=await r2.json();

    if(cont){
      cont.innerHTML=`
        <h3>${res.fecha||""}</h3>
        <p>🚶 Visitas: <b>${res.total||0}</b> — 🛒 Compraron: <b>${res.compraron||0}</b></p>
        <p>🎯 Tasa: <b>${res.tasa||0}%</b></p>
        <p>🤖 ${ana.mensaje||""}</p>
      `;
    }

    if(canvas && window.Chart){
      const ctx = canvas.getContext("2d");
      if(canvas._chartInstance) canvas._chartInstance.destroy();
      canvas._chartInstance = new Chart(ctx,{
        type:"doughnut",
        data:{
          labels:["Compraron","No compraron"],
          datasets:[{
            data:[res.compraron||0,(res.total||0)-(res.compraron||0)],
            backgroundColor:["#00c851","#ff4444"]
          }]
        },
        options:{ plugins:{ legend:{ display:false }}}
      });
    }
  }catch(e){
    console.error("❌ Error resumen:", e);
    if(cont) cont.innerHTML="❌ Error al cargar resumen.";
  }
}

/* ================================
   📅 Calendario (listado simple)
================================ */
async function cargarCalendario(){
  const cont=document.getElementById("contenedorCalendario");
  const clave=localStorage.getItem("vendedorClave");
  if(!cont) return;
  if(!clave){ cont.innerHTML="⚠️ Debes iniciar sesión primero."; return; }

  cont.innerHTML="⏳ Cargando calendario...";
  try{
    const resp = await fetch(`${URL_API_BASE}?accion=getCalendarioVisitas&clave=${clave}`);
    const data = await resp.json();
    if(!data || !data.length){ cont.innerHTML="📭 No hay visitas programadas."; return; }

    let html = `<div class="lista-calendario">`;
    data.forEach(f=>{
      html += `
        <div class="cal-item">
          <div class="cal-info">
            <b>${f.fecha||""}</b> — ${f.dia||""}<br><span>📍 ${f.localidad||""}</span>
          </div>
          <div class="cal-estado">${f.compro?"✅":"❌"}</div>
        </div>`;
    });
    html += `</div>`;
    cont.innerHTML = html;

  }catch(e){
    console.error("Error calendario:", e);
    cont.innerHTML = "❌ Error al cargar calendario.";
  }
}


/* ================================
   🔥 Toast
================================ */
function toast(msg){
  const t=document.createElement("div");
  t.className="toast";
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2500);
}



/* ================================
   🎯 Exportar funciones al DOM
================================ */
window.agregarDigito=agregarDigito;
window.borrarDigito=borrarDigito;
window.login=login;
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.irCliente=irCliente;
