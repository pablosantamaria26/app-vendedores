/* ================================
   ⚙️ Config principal (TUS DATOS)
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";

/* ================================
   Estado global
================================ */
let clientesData = [];
let posicionActual = null;
let mapaFull = null;
let dragSrcIndex = null;
let heatLayer = null;
let idxBusqueda = [];

/* ================================
   🔐 Login & sesión (sin teclado virtual)
================================ */
function login(){
  const clave=(document.getElementById("clave")?.value||"").trim();
  const error=document.getElementById("error");
  if(!vendedores[clave]){ if(error) error.textContent="❌ Clave incorrecta"; return; }
  localStorage.setItem("vendedorClave", clave);
  const loginDiv=document.getElementById("login"); 
  if(loginDiv) { loginDiv.style.opacity = "0"; setTimeout(() => { loginDiv.style.display="none"; }, 300); }
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

/* Auto-enter al 4º dígito, sin teclado virtual */
function wireLoginAutoEnter(){
  const i = document.getElementById("clave");
  if(!i) return;
  i.setAttribute("inputmode","numeric");
  i.addEventListener("input", ()=>{
    i.value = i.value.replace(/\D/g,"").slice(0,4);
    if(i.value.length===4) login();
  });
}

window.addEventListener("load",()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ document.getElementById("login").style.display="none"; mostrarApp(); }
  else { document.getElementById("login").style.display="grid"; wireLoginAutoEnter(); }
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
function restaurarTema(){ aplicarTema(localStorage.getItem("temaPreferido")||"tema-confianza"); }
function toggleModoOscuro(){
  const actual=document.body.classList.contains("tema-foco");
  const guardado = localStorage.getItem("temaPreferido") || "tema-confianza";
  aplicarTema(actual ? guardado : "tema-foco");
}

/* ================================
   🧭 Navegación de secciones
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  const destino=document.getElementById("seccion-"+s); if(destino) destino.classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  const btn=document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`); if(btn) btn.classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
   🚀 App principal
================================ */
async function mostrarApp(){
  const clave=localStorage.getItem("vendedorClave");
  const nombre=vendedores[clave];
  const titulo=document.getElementById("titulo"); if(titulo) titulo.textContent=`👋 Hola, ${nombre}`;
  mostrarSeccion("ruta");

  const clientesHoy=await cargarRuta(clave);
  await Promise.all([cargarResumen(clave), cargarCalendario()]);
  inicializarNotificaciones(clave);

  if(clientesHoy && clientesHoy.length){ detectarClienteCercano(clave, clientesHoy); }
}

/* ================================
   📍 Distancias (Haversine)
================================ */
const toRad=(d)=> d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLat + aLat - aLat + (bLng-aLng)); // protección simple
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

/* ================================
   🗂️ Orden (persistente por vendedor)
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }
function cargarOrden(){ try{ return JSON.parse(localStorage.getItem(keyOrden())||"[]"); }catch{ return []; } }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

/* ================================
   🚗 Cargar ruta del día
================================ */
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  const estado=document.getElementById("estado");
  if(cont) cont.innerHTML="⏳ Cargando clientes...";
  try{
    const [r1,predR]=await Promise.all([
      fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`),
      fetch(`${URL_API_BASE}?accion=getPrediccionesVendedor&clave=${clave}`)
    ]);
    clientesData=await r1.json();
    const pred=await predR.json(); // disponible para heatmap

    // Orden guardado
    const orden=cargarOrden();
    if(orden.length){
      const map=new Map(clientesData.map(c=>[String(c.numero),c]));
      clientesData = orden.map(id=>map.get(String(id))).filter(Boolean)
        .concat(clientesData.filter(c=>!orden.includes(String(c.numero))));
    }

    // Distancias
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderClientes(); },
        ()=>renderClientes(),
        {enableHighAccuracy:true, maximumAge:15000, timeout:8000}
      );
    }else{ renderClientes(); }

    if(estado){
      const ahora=new Date().toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"});
      estado.textContent=`Ruta cargada (${clientesData.length} clientes) — Última actualización: ${ahora}`;
    }

    // Índice buscador
    construirIndiceBusqueda();

    return clientesData;
  }catch(e){
    console.error("❌ Error al cargar datos:", e);
    if(estado) estado.textContent="❌ Error al cargar datos.";
    return [];
  }
}

/* ================================
   🧱 Render de tarjetas (drag&drop)
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor"); if(!cont) return;
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const card=document.createElement("div");
    card.className="cliente"; card.id="c_"+c.numero;

    const lat=parseFloat(c.lat); const lng=parseFloat(c.lng);
    const tieneGeo=Number.isFinite(lat)&&Number.isFinite(lng);
    const dist=(posicionActual && tieneGeo) ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    card.innerHTML=`
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}${c.localidad?`, ${c.localidad}`:""}</span>
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

    // DnD
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
}

/* ================================
   🗺️ Mapa (markers + heatmap)
================================ */
function renderMapaFull(){
  const el=document.getElementById("mapaFull"); if(!el) return;
  if(mapaFull){ mapaFull.remove(); mapaFull=null; heatLayer=null; }
  el.innerHTML="";
  mapaFull=L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaFull);

  const group=[];
  clientesData.forEach(c=>{
    const lat=(c.lat!=null)?parseFloat(c.lat):null; const lng=(c.lng!=null)?parseFloat(c.lng):null;
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const mk=L.marker([lat,lng]).addTo(mapaFull).bindPopup(c.nombre);
      mk.on("popupopen", () => confirmDestino(lat, lng, c.nombre));
      group.push(mk);
    }
  });
  if(group.length){ const gl=L.featureGroup(group); mapaFull.fitBounds(gl.getBounds().pad(0.3)); }

  if(posicionActual){
    L.marker([posicionActual.lat,posicionActual.lng],{ icon:L.icon({iconUrl:"https://cdn-icons-png.flaticon.com/512/684/684908.png",iconSize:[32,32]}) }).addTo(mapaFull).bindPopup("📍 Estás aquí");
  }else if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderMapaFull(); });
  }

  aplicarHeatmapFull();
}
async function aplicarHeatmapFull(){
  try{
    const clave=localStorage.getItem("vendedorClave");
    const r = await fetch(`${URL_API_BASE}?accion=getPrediccionesVendedor&clave=${clave}`);
    const d = await r.json();
    const pred = d.predicciones || [];
    if (heatLayer) { mapaFull.removeLayer(heatLayer); heatLayer = null; }
    const puntos = pred.filter(p=>isFinite(p.lat)&&isFinite(p.lng)).map(p => [Number(p.lat), Number(p.lng), Math.min(1, Math.max(0.1, p.prob||0.3))]);
    if (puntos.length) {
      heatLayer = L.heatLayer(puntos, { radius: 22, blur: 16, minOpacity: 0.25 }).addTo(mapaFull);
    }
  }catch(e){ console.warn("Heatmap:", e); }
}

function confirmDestino(lat,lng,nombre){
  const old=document.querySelector(".confirm-toast"); if(old) old.remove();
  const t=document.createElement("div");
  t.className="confirm-toast";
  t.innerHTML=`<span>¿Ir a <b>${nombre}</b>?</span> <button onclick="goYes(${lat},${lng})">Sí</button> <button onclick="this.parentElement.remove()">No</button>`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}
window.goYes = (lat,lng) => { document.querySelector(".confirm-toast")?.remove(); irCliente(lat,lng); }
function irCliente(lat,lng){
  if(!lat||!lng){ alert("📍 Este cliente no tiene coordenadas."); return; }
  const base="https://www.google.com/maps/dir/?api=1";
  const dest=`&destination=${lat},${lng}&travelmode=driving`;
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      pos=>{ const org=`&origin=${pos.coords.latitude},${pos.coords.longitude}`; window.open(`${base}${org}${dest}`,"_blank"); },
      ()=>{ window.open(`${base}${dest}`,"_blank"); }
    );
  }else{ window.open(`${base}${dest}`,"_blank"); }
}

/* ================================
   💾 Registrar visita (cola offline)
================================ */
function getClientePorNumero(num){ return clientesData.find(x=>String(x.numero)===String(num)); }
async function registrarVisita(numero){
  const c=getClientePorNumero(numero);
  if(!c){ toast("❌ Cliente no encontrado"); return; }

  mostrarExito();

  const idx=clientesData.findIndex(x=>String(x.numero)===String(numero));
  if(idx!==-1){
    const cliente=clientesData.splice(idx,1)[0];
    cliente.bloqueado=true;
    clientesData.push(cliente);
    guardarOrden(clientesData.map(x=>String(x.numero)));
    renderClientes();
    document.getElementById('estado')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  const visitado=document.getElementById(`visitado-${numero}`)?.checked||false;
  const compro=document.getElementById(`compro-${numero}`)?.checked||false;
  const comentario=(document.getElementById(`coment-${numero}`)?.value||"").trim();
  const vendedor=localStorage.getItem("vendedorClave")||"";

  const params=new URLSearchParams({
    accion:"registrarVisita",
    numero:c.numero, nombre:c.nombre, direccion:c.direccion||"", localidad:c.localidad||"",
    visitado, compro, comentario, vendedor
  });

  try{ const r=await fetch(`${URL_API_BASE}?${params.toString()}`); await r.json(); }
  catch{ queueOffline({ t:"visita", params:Object.fromEntries(params) }); }
}

/* ================================
   🔔 Toasts
================================ */
function mostrarExito(){
  const prev=document.querySelector(".exito-overlay"); if(prev) prev.remove();
  const wrap=document.createElement("div");
  wrap.className="exito-overlay";
  wrap.innerHTML=`
    <div class="exito-box">
      <div class="exito-titulo">Visita registrada</div>
      <div class="exito-circle">
        <svg viewBox="0 0 200 200">
          <circle class="bg"   cx="100" cy="100" r="90"></circle>
          <circle class="prog" cx="100" cy="100" r="90"></circle>
        </svg>
        <div class="exito-check">
          <svg viewBox="0 0 52 52"><path d="M14 27 L22 36 L38 16"></path></svg>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(),1000);
}
function toast(msg){
  const t = document.createElement("div");
  t.className = "confirm-toast";
  t.style.bottom = "90px";
  t.style.background = "var(--no)";
  t.style.color = "#fff";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2900);
}

/* ================================
   📶 Cola offline + sync
================================ */
function queueOffline(item){ const k="offlineQueue"; let q=[]; try{ q=JSON.parse(localStorage.getItem(k)||"[]");}catch{} q.push(item); localStorage.setItem(k, JSON.stringify(q)); }
async function syncOffline(){ if(!navigator.onLine) return; const k="offlineQueue"; let q=[]; try{ q=JSON.parse(localStorage.getItem(k)||"[]"); }catch{} if(!q.length) return; const rest=[]; for(const it of q){ try{ if(it.t==="visita"){ const p=new URLSearchParams(it.params); const r=await fetch(`${URL_API_BASE}?${p.toString()}`); await r.json(); } }catch{ rest.push(it); } } localStorage.setItem(k, JSON.stringify(rest)); if(q.length && rest.length===0) toast("✅ Sincronización completada"); }
window.addEventListener("online", syncOffline);

/* ================================
   📈 Resumen + Chart + Coach IA
================================ */
async function cargarResumen(clave){
  const cont=document.getElementById("contenedorResumen");
  const canvas=document.getElementById("graficoResumen");
  const coach=document.getElementById("coach");
  if(cont) cont.innerHTML="⏳ Analizando desempeño...";
  try{
    const [r1,r2,r3]=await Promise.all([
      fetch(`${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`),
      fetch(`${URL_API_BASE}?accion=getPrediccionesVendedor&clave=${clave}`),
      fetch(`${URL_API_BASE}?accion=getConsejosVendedor&clave=${clave}`)
    ]);
    const res=await r1.json(); const ana=await r2.json(); const cons=await r3.json();

    if(cont){
      cont.innerHTML=`
        <h3>${res.fecha||""}</h3>
        <p>🚶 Visitas: <b>${res.totalHoy||0}</b> — 🛒 Compraron: <b>${res.compraronHoy||0}</b></p>
        <p>🎯 Tasa: <b>${res.tasa||0}%</b> — ⏱️ Frecuencia: <b>${res.frecuenciaProm||"N/D"}</b> días</p>
        <p>🤖 ${ana.mensaje||""}</p>`;
    }

    if(coach){
      const lista = (cons.sugerencias||[]).map(s=>`<li>${s}</li>`).join("") || "<li>Sin sugerencias por ahora.</li>";
      coach.innerHTML = `<h3 style="margin:8px 0 6px;">🤖 Coach de Ventas</h3><ul style="text-align:left; margin:0 0 4px 18px;">${lista}</ul>`;
    }

    if(canvas && window.Chart){
      const ctx=canvas.getContext("2d");
      if(canvas._chartInstance) canvas._chartInstance.destroy();
      canvas._chartInstance=new Chart(ctx,{
        type:"doughnut",
        data:{ labels:["Compraron","No compraron"], datasets:[{ data:[res.compraronHoy||0,(res.totalHoy||0)-(res.compraronHoy||0)] }] },
        options:{ plugins:{ legend:{ display:false } } }
      });
    }
  }catch(e){ console.error("❌ Error resumen:", e); if(cont) cont.innerHTML="❌ Error al cargar resumen."; }
}

/* ================================
   📅 Calendario
================================ */
async function cargarCalendario(){
  const cont=document.getElementById("contenedorCalendario"); const clave=localStorage.getItem("vendedorClave");
  if(!cont) return; if(!clave){ cont.innerHTML="⚠️ Debes iniciar sesión primero."; return; }
  cont.innerHTML="⏳ Cargando calendario...";
  try{
    const resp=await fetch(`${URL_API_BASE}?accion=getCalendarioVisitas&clave=${clave}`);
    const data=await resp.json();
    if(!data || !data.length){ cont.innerHTML="📭 No hay visitas programadas."; return; }
    let html=`<div class="lista-calendario">`;
    data.forEach(f=>{
      html+=`<div class="cal-item" style="background: var(--card); border: 1px solid var(--borde); border-radius: 10px; padding: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div><b>${f.fecha||""}</b> — ${f.dia||""}<br><span>📍 ${f.localidad||""}</span></div>
        <div style="font-size:1.2rem;">${f.compro?"✅":"❌"}</div>
      </div>`;
    });
    html+=`</div>`; cont.innerHTML=html;
  }catch(e){ console.error("Error calendario:", e); cont.innerHTML="❌ Error al cargar calendario."; }
}

/* ================================
   🔔 Firebase/FCM (tus claves y worker)
================================ */
function inicializarNotificaciones(vendedor) {
  const firebaseConfig = {
    apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
    authDomain: "app-vendedores-inteligente.firebaseapp.com",
    projectId: "app-vendedores-inteligente",
    storageBucket: "app-vendedores-inteligente.appspot.com",
    messagingSenderId: "583313989429",
    appId: "1:583313989429:web:c4f78617ad957c3b11367c"
  };
  if (typeof firebase === "undefined") { console.error("⚠️ Firebase no está cargado."); return; }
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("firebase-messaging-sw.js")
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") return;

        const token = await messaging.getToken({
          vapidKey: "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o",
          serviceWorkerRegistration: registration
        });

        if (token && vendedor) {
          try {
            await fetch(URL_API_BASE, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vendedor, token })
            });
          } catch (err) { console.error("❌ Error enviando token vía Worker:", err); }
        }

        messaging.onMessage((payload) => {
          const n = payload.notification;
          if (n) toast(`${n.title} — ${n.body}`);
        });
      })
      .catch((err) => console.error("❌ Error al registrar el SW:", err));
  }
}

/* ================================
   🔔 Notificación diaria suave
================================ */
function notificacionDiaria(){
  try{
    if(!("Notification" in window)) return;
    const hoy = new Date().toLocaleDateString("es-AR");
    const ultima = localStorage.getItem("notificacionHoy");
    if(ultima===hoy) return;
    Notification.requestPermission().then(perm=>{
      if(perm!=="granted") return;
      const clave=localStorage.getItem("vendedorClave"); if(!clave) return;
      const nombre=vendedores[clave];
      const n=new Notification("🚗 Ruta del día disponible",{ body:`Hola ${nombre}, ya podés consultar tu ruta actualizada.`, icon:"ml-icon-192.png" });
      n.onclick=()=>window.focus();
      localStorage.setItem("notificacionHoy", hoy);
    });
  }catch{}
}

/* ================================
   📍 Geofencing básico
================================ */
async function detectarClienteCercano(vendedor, clientesHoy) {
  if (!navigator.geolocation) return;
  const RADIO_ALERTA = 150; // metros
  function dMetros(lat1, lon1, lat2, lon2) {
    const R = 6371e3; const toRad = deg => (deg * Math.PI) / 180;
    const φ1 = toRad(lat1); const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1); const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        for (const c of clientesHoy) {
          if (!c.lat || !c.lng || c.bloqueado) continue;
          const dist = dMetros(latitude, longitude, c.lat, c.lng);
          if (dist < RADIO_ALERTA) {
            mostrarNotificacionLocal("📍 Cliente cercano", `Estás a ${Math.round(dist)} m de ${c.nombre}. Recordá registrar la visita.`);
            break;
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
  }, 60 * 1000);
}
function mostrarNotificacionLocal(titulo, cuerpo) {
  if (Notification.permission === "granted") {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(titulo, { body: cuerpo, icon: "ml-icon-192.png", badge: "ml-icon-192.png" });
    });
  }
}

/* ================================
   🔎 Buscador (en vivo sobre la cartera)
================================ */
function construirIndiceBusqueda(){
  idxBusqueda = (clientesData||[]).map(c=>({
    num:String(c.numero||""),
    nombre:(c.nombre||"").toLowerCase(),
    direccion:(c.direccion||"").toLowerCase(),
    localidad:(c.localidad||"").toLowerCase()
  }));
}
function abrirBuscador(){ const m=document.getElementById("modalBuscador"); if(!m) return; m.classList.add("visible"); const q=document.getElementById("q"); q.value=""; q.focus(); document.getElementById("resultados").innerHTML=""; }
function cerrarBuscador(ev){ if(ev && ev.target && ev.target.id!=="modalBuscador") return; document.getElementById("modalBuscador").classList.remove("visible"); }
function buscarEnVivo(){
  const q = (document.getElementById("q").value||"").toLowerCase().trim();
  const box = document.getElementById("resultados"); if(!box) return;
  if(!q){ box.innerHTML=""; return; }
  const res = idxBusqueda.filter(x => x.nombre.includes(q) || x.direccion.includes(q) || x.localidad.includes(q)).slice(0,60);
  box.innerHTML = res.map(x=>`<div class="item"><div><b>${x.num}</b> — ${x.nombre}</div><button class="copy" onclick="navigator.clipboard.writeText('${x.num}')">Copiar Nº</button></div>`).join("");
}

/* ================================
   🔗 Exponer a global
================================ */
window.login = login;
window.logout = logout;
window.mostrarSeccion = mostrarSeccion;
window.registrarVisita = registrarVisita;
window.irCliente = irCliente;
window.toggleModoOscuro = toggleModoOscuro;
window.toggleTemaMenu = toggleTemaMenu;
window.aplicarTema = aplicarTema;
window.abrirBuscador = abrirBuscador;
window.cerrarBuscador = cerrarBuscador;
window.buscarEnVivo = buscarEnVivo;
