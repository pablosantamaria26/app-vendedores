/* ================================================
   🧠 App de Vendedores — JS 2026 (FINAL)
   - Vista de mapa separada (#mapaFull)
   - Distancia desde tu ubicación (si hay lat/lng)
   - Registrar visita (visitado / compró / comentario)
   - Guardado offline + sincronización automática
   - Drag & drop con bloqueo por tarjeta
   - Filtro por localidad + animaciones
   - Toasts instantáneos
   - Modo oscuro con persistencia
   - FCM (Firebase Messaging) intacto
================================================= */

/* ================================
   ⚙️ Config principal
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
// 🔁 Redirige todas las llamadas a través de tu Cloudflare Worker
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";


/* Estado global */
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
  const clave = (document.getElementById("clave")?.value || "").trim();
  const error = document.getElementById("error");
  if(!vendedores[clave]){ if(error) error.textContent = "❌ Clave incorrecta"; return; }
  localStorage.setItem("vendedorClave", clave);
  const loginDiv = document.getElementById("login");
  if(loginDiv) loginDiv.style.display="none";
  mostrarApp();
}

function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.addEventListener("load", ()=>{
  const c = localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ const loginDiv=document.getElementById("login"); if(loginDiv) loginDiv.style.display="none"; mostrarApp(); }
  else { const loginDiv=document.getElementById("login"); if(loginDiv) loginDiv.style.display="flex"; }
  // arranque utilidades
  syncOffline();
  notificacionDiaria();
});

/* ================================
   🧭 Navegación de secciones
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  const destino = document.getElementById("seccion-"+s);
  if(destino) destino.classList.add("visible");

  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  const btn = document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`);
  if(btn) btn.classList.add("activo");

  if(s==="mapa") renderMapaFull();
}

/* ================================
   🚀 App principal
================================ */
async function mostrarApp(){
  const clave = localStorage.getItem("vendedorClave");
  const nombre = vendedores[clave];
  const titulo = document.getElementById("titulo");
  if(titulo) titulo.textContent = `👋 Hola, ${nombre}`;

  mostrarSeccion("ruta");
  await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  inicializarNotificaciones(clave); // FCM intacto
}

/* ================================
   📍 Distancias (Haversine)
================================ */
const toRad = (d)=> d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

/* ================================
   🗂️ Orden y bloqueo por cliente
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }
function keyLock(){ return "clientesLock_"+localStorage.getItem("vendedorClave"); }

function cargarOrden(){ try{ return JSON.parse(localStorage.getItem(keyOrden())||"[]"); }catch{ return []; } }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

function locks(){ try{ return JSON.parse(localStorage.getItem(keyLock())||"{}"); }catch{ return {}; } }
function setLock(id,val){ const m=locks(); m[id]=val; localStorage.setItem(keyLock(), JSON.stringify(m)); }

/* ================================
   🚗 Cargar ruta del día
================================ */
async function cargarRuta(clave){
  const cont = document.getElementById("contenedor");
  const estado = document.getElementById("estado");
  if(cont) cont.innerHTML = "⏳ Cargando clientes...";

  try{
    const [r1, predR] = await Promise.all([
      fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`),
      fetch(`${URL_API_BASE}?accion=getPrediccionesVendedor&clave=${clave}`)
    ]);
    clientesData = await r1.json();
    const pred = await predR.json();

    // Orden persistida
    const orden = cargarOrden();
    if(orden.length){
      const map = new Map(clientesData.map(c=>[String(c.numero),c]));
      clientesData = orden.map(id=>map.get(String(id))).filter(Boolean)
        .concat(clientesData.filter(c=>!orden.includes(String(c.numero))));
    }

    // Geoloc para distancias
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude};
        renderClientes();
      }, ()=>renderClientes(), {enableHighAccuracy:true,maximumAge:15000,timeout:8000});
    }else{
      renderClientes();
    }

    // Estado
    if(estado){
      const ahora = new Date().toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"});
      estado.textContent = `Ruta cargada (${clientesData.length} clientes) — Última actualización: ${ahora}`;
    }

    // Panel inteligente arriba de la lista
    mostrarPanelPredicciones(pred);

  }catch(e){
    console.error("❌ Error al cargar datos:", e);
    if(estado) estado.textContent = "❌ Error al cargar datos.";
  }
}

/* ================================
   🧱 Render de tarjetas + DnD
================================ */
function renderClientes(){
  const cont = document.getElementById("contenedor");
  if(!cont) return;
  cont.innerHTML = "";

  // Filtro + botón “ruta completa”
  insertarBarraHerramientas(cont);

  const mlocks = locks();

  clientesData.forEach((c, idx)=>{
    const card = document.createElement("div");
    card.className = "cliente";
    card.id = "c_"+c.numero;

    const lat = (c.lat!==undefined && c.lat!==null) ? parseFloat(c.lat) : null;
    const lng = (c.lng!==undefined && c.lng!==null) ? parseFloat(c.lng) : null;
    const tieneGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const dist = (posicionActual && tieneGeo) ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    const locked = !!mlocks[c.numero];
    card.classList.toggle("bloqueado", locked);
    card.setAttribute("draggable", String(!locked));

    card.innerHTML = `
      <h3>${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}${c.localidad?`, ${c.localidad}`:""}</span>
        ${dist!==null ? `<span class="badge">📏 ${dist.toFixed(1)} km</span>` : ""}
      </div>
      <div class="fila" style="margin-top:6px">
        <label><input type="checkbox" id="visitado-${c.numero}"> Visitado</label>
        <label><input type="checkbox" id="compro-${c.numero}"> Compró</label>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="irCliente(${tieneGeo?lat:"null"},${tieneGeo?lng:"null"})">🚗 Ir</button>
        <button class="btn-lock" onclick="toggleLock(${c.numero})">${locked?"🔒 Bloqueado":"🔓 Bloquear"}</button>
      </div>
    `;

    // DnD
    card.addEventListener("dragstart",(ev)=>{ dragSrcIndex=idx; ev.dataTransfer.effectAllowed="move"; });
    card.addEventListener("dragover",(ev)=>{ ev.preventDefault(); ev.dataTransfer.dropEffect="move"; card.classList.add("drag-over"); });
    card.addEventListener("dragleave",()=>card.classList.remove("drag-over"));
    card.addEventListener("drop",(ev)=>{
      ev.preventDefault();
      document.querySelectorAll(".cliente.drag-over").forEach(x=>x.classList.remove("drag-over"));
      const targetIndex = Array.from(cont.children).indexOf(card) - 1; // -1 por la barra de herramientas
      if(dragSrcIndex===null || dragSrcIndex===targetIndex) return;
      const moved = clientesData.splice(dragSrcIndex,1)[0];
      clientesData.splice(targetIndex,0,moved);
      dragSrcIndex=null;
      guardarOrden(clientesData.map(x=>String(x.numero)));
      renderClientes();
    });

    cont.appendChild(card);
  });

  animarTarjetas();
}

/* Barra superior: filtro + botón ruta en Google Maps */
function insertarBarraHerramientas(container){
  const bar = document.createElement("div");
  bar.style = "display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0 10px 0;flex-wrap:wrap;";

  const filtro = document.createElement("input");
  filtro.id = "filtroLocalidad";
  filtro.placeholder = "🔍 Filtrar por localidad...";
  filtro.style = "flex:1;min-width:220px;padding:10px;border:1px solid var(--borde);border-radius:8px;background:transparent;color:var(--texto)";
  filtro.oninput = () => filtrarClientesPorLocalidad(filtro.value);

  const btnRuta = document.createElement("button");
  btnRuta.textContent = "📍 Ruta completa (Google Maps)";
  btnRuta.onclick = ()=>abrirRutaEnMapa(clientesData);

  bar.appendChild(filtro);
  bar.appendChild(btnRuta);
  container.appendChild(bar);
}

function toggleLock(numero){
  const m=locks(); const now=!m[numero];
  setLock(numero, now);
  toast(now?"🔒 Tarjeta bloqueada":"🔓 Tarjeta desbloqueada");
  renderClientes();
}

/* ================================
   🗺️ Mapa (vista separada)
================================ */
function renderMapaFull(){
  const el = document.getElementById("mapaFull");
  if(!el) return;

  if(mapaFull){ mapaFull.remove(); mapaFull=null; }

  mapaFull = L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaFull);

  const group=[];
  clientesData.forEach(c=>{
    const lat = (c.lat!==undefined && c.lat!==null) ? parseFloat(c.lat) : null;
    const lng = (c.lng!==undefined && c.lng!==null) ? parseFloat(c.lng) : null;
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const mk=L.marker([lat,lng]).addTo(mapaFull).bindPopup(c.nombre);
      group.push(mk);
    }
  });
  if(group.length){ const gl=L.featureGroup(group); mapaFull.fitBounds(gl.getBounds().pad(0.3)); }

  if(posicionActual){
    L.marker([posicionActual.lat,posicionActual.lng],{
      icon:L.icon({iconUrl:"https://cdn-icons-png.flaticon.com/512/684/684908.png",iconSize:[32,32]})
    }).addTo(mapaFull).bindPopup("📍 Estás aquí");
  }else if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderMapaFull(); });
  }
}

function irCliente(lat,lng){
  if(!lat||!lng){ alert("📍 Este cliente no tiene coordenadas."); return; }
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      const url=`https://www.google.com/maps/dir/?api=1&origin=${pos.coords.latitude},${pos.coords.longitude}&destination=${lat},${lng}&travelmode=driving`;
      window.open(url,"_blank");
    },()=>{
      const url=`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url,"_blank");
    });
  }else{
    const url=`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url,"_blank");
  }
}

function abrirRutaEnMapa(clientes){
  const direcciones = clientes
    .map(c => `${c.direccion||""}, ${c.localidad||""}`.trim())
    .filter(s=>s && s!=",")
    .join("|");
  if(!direcciones){ alert("⚠️ No hay direcciones válidas para mostrar en el mapa."); return; }
  const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&waypoints=${encodeURIComponent(direcciones)}`;
  window.open(url,"_blank");
}

/* ================================
   💾 Registrar visita (+ offline)
================================ */
function getClientePorNumero(num){ return clientesData.find(x=>String(x.numero)===String(num)); }

async function registrarVisita(numero){
  const c = getClientePorNumero(numero);
  if(!c){ toast("❌ Cliente no encontrado"); return; }

  const visitado   = document.getElementById(`visitado-${numero}`)?.checked || false;
  const compro     = document.getElementById(`compro-${numero}`)?.checked || false;
  const comentario = (document.getElementById(`coment-${numero}`)?.value || "").trim();
  const vendedor   = localStorage.getItem("vendedorClave") || "";

  const params = new URLSearchParams({
    accion:"registrarVisita",
    numero:c.numero, nombre:c.nombre,
    direccion:c.direccion||"", localidad:c.localidad||"",
    visitado, compro, comentario, vendedor
  });

  try{
    const r = await fetch(`${URL_API_BASE}?${params.toString()}`);
    const js = await r.json();
    toast(js.estado || "✅ Visita registrada");
  }catch{
    queueOffline({ t:"visita", params:Object.fromEntries(params) });
    toast("📶 Sin conexión. Guardado offline y se sincroniza después.");
  }
}

/* Cola offline + sync */
function queueOffline(item){
  const k="offlineQueue"; let q=[];
  try{ q=JSON.parse(localStorage.getItem(k)||"[]"); }catch{}
  q.push(item); localStorage.setItem(k, JSON.stringify(q));
}
async function syncOffline(){
  if(!navigator.onLine) return;
  const k="offlineQueue"; let q=[];
  try{ q=JSON.parse(localStorage.getItem(k)||"[]"); }catch{}
  if(!q.length) return;

  const rest=[];
  for(const it of q){
    try{
      if(it.t==="visita"){
        const p = new URLSearchParams(it.params);
        const r = await fetch(`${URL_API_BASE}?${p.toString()}`);
        await r.json();
      }
    }catch{ rest.push(it); }
  }
  localStorage.setItem(k, JSON.stringify(rest));
  if(q.length && rest.length===0) toast("✅ Sincronización completada");
}
window.addEventListener("online", syncOffline);

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
    const res=await r1.json(); const ana=await r2.json();

    if(cont){
      cont.innerHTML=`
        <h3>${res.fecha||""}</h3>
        <p>🚶 Visitas: <b>${res.totalHoy||0}</b> — 🛒 Compraron: <b>${res.compraronHoy||0}</b></p>
        <p>🎯 Tasa: <b>${res.tasa||0}%</b> — ⏱️ Frecuencia: <b>${res.frecuenciaProm||"N/D"}</b> días</p>
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
          datasets:[{ data:[res.compraronHoy||0,(res.totalHoy||0)-(res.compraronHoy||0)], backgroundColor:["#00c851","#ff4444"] }]
        },
        options:{ plugins:{ legend:{ display:false } } }
      });
    }
  }catch(e){
    console.error("❌ Error resumen:", e);
    if(cont) cont.innerHTML="❌ Error al cargar resumen.";
  }
}

/* ================================
   📅 Calendario (lista simple)
================================ */
async function cargarCalendario(){
  const cont = document.getElementById("contenedorCalendario");
  const clave = localStorage.getItem("vendedorClave");
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
   📊 Panel inteligente (donut propio)
================================ */
function mostrarPanelPredicciones(pred){
  const cont = document.getElementById("contenedor");
  if(!cont) return;

  // borrar panel viejo si existe
  document.querySelector(".panel-inteligente")?.remove();

  const panel = document.createElement("section");
  panel.className = "panel-inteligente";
  panel.innerHTML = `
    <div class="tarjeta-resumen">
      <h2>📊 Resumen Inteligente</h2>
      <div class="grafico-container">
        <canvas id="graficoTasa" width="150" height="150"></canvas>
        <div class="grafico-texto" id="porcentajeTasa">0%</div>
      </div>
      <p>🚶 Visitados hoy: <b>${pred.totalHoy||0}</b> — 💰 Compraron: <b>${pred.compraronHoy||0}</b></p>
      <p>⏱️ Frecuencia promedio: <b>${pred.frecuencia||"Sin datos"} días</b></p>
      <p>🎯 <b>${pred.tasa||0}%</b> tasa de conversión</p>
      <p class="mensaje-ia">${mensajeMotivacional(pred.tasa||0)}</p>
    </div>
    <div class="tarjeta-prediccion">
      <h3>🤖 Sugerencia Inteligente</h3>
      <p>${pred.mensaje||""}</p>
    </div>
  `;
  cont.prepend(panel);
  setTimeout(()=>animarGrafico(pred.tasa||0), 250);
}

function animarGrafico(valor){
  const canvas=document.getElementById("graficoTasa"); if(!canvas) return;
  const ctx=canvas.getContext("2d");
  const c=canvas.width/2, r=60, full=Math.PI*2;
  const base="#e0e0e0", fill = valor>=70?"#00c851":valor>=40?"#ffbb33":"#ff4444";
  const texto=document.getElementById("porcentajeTasa");
  let p=0;
  const anim=setInterval(()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // base
    ctx.beginPath(); ctx.arc(c,c,r,0,full); ctx.strokeStyle=base; ctx.lineWidth=10; ctx.stroke();
    // progreso
    ctx.beginPath(); ctx.arc(c,c,r,-Math.PI/2, (full*p)/100 - Math.PI/2);
    ctx.strokeStyle=fill; ctx.lineWidth=10; ctx.lineCap="round"; ctx.stroke();
    if(texto) texto.textContent=`${Math.round(p)}%`;
    if(p>=valor) clearInterval(anim); else p+=1;
  },15);
}

function mensajeMotivacional(tasa){
  if(tasa>=80) return "🚀 ¡Excelente trabajo! Sos un referente de ventas.";
  if(tasa>=60) return "🔥 Muy bien, seguí con ese ritmo.";
  if(tasa>=40) return "💪 Buen desempeño, ¡vamos por más!";
  return "💡 No te desanimes, cada cliente cuenta. ¡Dale con todo!";
}


/* ==================================================
   🔔 Inicializar notificaciones Firebase (versión final CORS-safe)
   ================================================== */
function inicializarNotificaciones(vendedor) {
  console.log("🚀 Inicializando notificaciones para", vendedor);

  // 🔧 Configuración de tu proyecto Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
    authDomain: "app-vendedores-inteligente.firebaseapp.com",
    projectId: "app-vendedores-inteligente",
    storageBucket: "app-vendedores-inteligente.appspot.com",
    messagingSenderId: "583313989429",
    appId: "1:583313989429:web:c4f78617ad957c3b11367c"
  };

  // 🧩 Inicializar Firebase si no está iniciado
  if (typeof firebase === "undefined") {
    console.error("⚠️ Firebase no está cargado.");
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("firebase-messaging-sw.js")
      .then(async (registration) => {
        console.log("✅ Service Worker registrado correctamente. Esperando activación...");
        await navigator.serviceWorker.ready;
        console.log("🟢 Service Worker activo. Solicitando permiso de notificaciones...");

        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          console.warn("⚠️ Permiso de notificaciones denegado por el usuario.");
          return;
        }

        console.log("🔑 Obteniendo token FCM...");
        const token = await messaging.getToken({
          vapidKey: "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o",
          serviceWorkerRegistration: registration
        });

        if (token && vendedor) {
          console.log("📬 Token generado correctamente:", token.slice(0, 40) + "...");

          /* ==================================================
             🚀 Envío del token al backend via Worker (sin CORS)
             --------------------------------------------------
             ✅ El Worker Cloudflare actúa como proxy hacia Apps Script
             ✅ Evita errores CORS y preflight
          ================================================== */
          const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";

          try {
            const respuesta = await fetch(WORKER_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vendedor, token })
            });

            const texto = await respuesta.text();
            console.log("✅ Token enviado correctamente vía Worker:", texto);
          } catch (err) {
            console.error("❌ Error enviando token vía Worker:", err);
          }
        } else {
          console.warn("⚠️ No se obtuvo token FCM (posible bloqueo o permiso denegado).");
        }

        // 🔔 Escuchar notificaciones en primer plano
        messaging.onMessage((payload) => {
          console.log("📢 Notificación recibida (foreground):", payload);
          const n = payload.notification;
          if (n) toast(`${n.title} — ${n.body}`);
        });
      })
      .catch((err) => console.error("❌ Error al registrar el Service Worker:", err));
  } else {
    console.warn("⚠️ Este navegador no soporta Service Workers ni notificaciones push.");
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
      const n=new Notification("🚗 Ruta del día disponible",{ body:`Hola ${nombre}, ya podés consultar tu ruta actualizada.`, icon:"/icon-192.png" });
      n.onclick=()=>window.focus();
      localStorage.setItem("notificacionHoy", hoy);
    });
  }catch{}
}

/* ================================
   🔎 Filtro por localidad + anim
================================ */
function filtrarClientesPorLocalidad(localidad){
  const cards=document.querySelectorAll(".cliente");
  const q=(localidad||"").toLowerCase();
  cards.forEach(card=>{
    const t=card.innerText.toLowerCase();
    card.style.display = t.includes(q) ? "block" : "none";
  });
}

function animarTarjetas(){
  const cards=document.querySelectorAll(".cliente");
  cards.forEach((c,i)=>{
    c.style.opacity="0"; c.style.transform="translateY(20px)";
    setTimeout(()=>{ c.style.transition="all .3s ease"; c.style.opacity="1"; c.style.transform="translateY(0)"; }, 80*i);
  });
}

/* ================================
   ⏳ Auto refresco
================================ */
setInterval(()=>{
  const clave=localStorage.getItem("vendedorClave");
  if(!clave) return;
  cargarRuta(clave);
  cargarResumen(clave);
}, 15*60*1000);

/* ================================
   💬 Toasts
================================ */
function toast(msg){
  const t=document.createElement("div");
  t.className="toast"; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2900);
}

/* ================================
   🔗 Exponer funciones a HTML
================================ */
window.agregarDigito     = agregarDigito;
window.borrarDigito      = borrarDigito;
window.login             = login;
window.logout            = logout;
window.mostrarSeccion    = mostrarSeccion;
window.registrarVisita   = registrarVisita;
window.irCliente         = irCliente;
window.toggleLock        = toggleLock;
window.abrirRutaEnMapa   = abrirRutaEnMapa;
