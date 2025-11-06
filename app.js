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
async function mostrarApp() {
  const clave = localStorage.getItem("vendedorClave");
  const nombre = vendedores[clave];
  const titulo = document.getElementById("titulo");
  if (titulo) titulo.textContent = `👋 Hola, ${nombre}`;

  mostrarSeccion("ruta");

  // 1️⃣ Cargar información principal
  const clientesHoy = await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();

  // 2️⃣ Inicializar notificaciones push (Firebase)
  inicializarNotificaciones(clave);

  // 3️⃣ Activar detección de cliente cercano (geofencing local)
  if (clientesHoy && clientesHoy.length) {
    detectarClienteCercano(clave, clientesHoy);
  }
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
   🗂️ Orden de clientes (sin bloqueo manual)
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }

function cargarOrden(){
  try { return JSON.parse(localStorage.getItem(keyOrden()) || "[]"); }
  catch { return []; }
}

function guardarOrden(ids){
  localStorage.setItem(keyOrden(), JSON.stringify(ids));
}


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

    // 👇 devolvemos la lista para detectar clientes cercanos
    return clientesData;

  } catch(e) {
    console.error("❌ Error al cargar datos:", e);
    if (estado) estado.textContent = "❌ Error al cargar datos.";
    return []; // 👈 devolvemos lista vacía en caso de error
  }
}


/* ================================
   🧱 Render de tarjetas (sin botón de bloqueo, con bloqueo automático)
================================ */
function renderClientes() {
  const cont = document.getElementById("contenedor");
  if (!cont) return;
  cont.innerHTML = "";

  clientesData.forEach((c, idx) => {
    const card = document.createElement("div");
    card.className = "cliente";
    card.id = "c_" + c.numero;

    const lat = parseFloat(c.lat);
    const lng = parseFloat(c.lng);
    const tieneGeo = Number.isFinite(lat) && Number.isFinite(lng);
    const dist = (posicionActual && tieneGeo)
      ? distanciaKm(posicionActual.lat, posicionActual.lng, lat, lng)
      : null;

    card.innerHTML = `
      <h3>${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion || ""}${c.localidad ? `, ${c.localidad}` : ""}</span>
        ${dist !== null ? `<span class="badge">📏 ${dist.toFixed(1)} km</span>` : ""}
      </div>
      <div class="fila" style="margin-top:6px">
        <label><input type="checkbox" id="visitado-${c.numero}"> Visitado</label>
        <label><input type="checkbox" id="compro-${c.numero}"> Compró</label>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="irCliente(${tieneGeo ? lat : "null"},${tieneGeo ? lng : "null"})">🚗 Ir</button>
      </div>
    `;

    // Bloqueado: desactivar y estilo
    if (c.bloqueado) {
      card.classList.add("bloqueado");
      card.querySelectorAll("input, textarea, button").forEach(el => el.disabled = true);
      card.style.opacity = "0.6";
      const tag = document.createElement("div");
      tag.textContent = "✅ Visitado";
      tag.className = "etiqueta-bloqueado";
      tag.style = "position:absolute;top:8px;right:10px;font-weight:bold;color:#2ecc71;";
      card.style.position = "relative";
      card.appendChild(tag);
      card.setAttribute("draggable", "false");
    } else {
      card.setAttribute("draggable", "true");
    }

    // DnD
    card.addEventListener("dragstart", (ev) => {
      dragSrcIndex = idx;
      ev.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
    });
    card.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const cards = Array.from(cont.querySelectorAll(".cliente"));
      const targetIndex = cards.indexOf(card);
      if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;
      const moved = clientesData.splice(dragSrcIndex, 1)[0];
      clientesData.splice(targetIndex, 0, moved);
      dragSrcIndex = null;
      guardarOrden(clientesData.map(x => String(x.numero)));
      renderClientes();
    });

    cont.appendChild(card);
  });

  animarTarjetas();
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
   💾 Registrar visita (+ offline + bloqueo automático)
================================ */
async function registrarVisita(numero) {
  const c = getClientePorNumero(numero);
  if (!c) {
    toast("❌ Cliente no encontrado");
    return;
  }

  const visitado   = document.getElementById(`visitado-${numero}`)?.checked || false;
  const compro     = document.getElementById(`compro-${numero}`)?.checked || false;
  const comentario = (document.getElementById(`coment-${numero}`)?.value || "").trim();
  const vendedor   = localStorage.getItem("vendedorClave") || "";

  const params = new URLSearchParams({
    accion: "registrarVisita",
    numero: c.numero,
    nombre: c.nombre,
    direccion: c.direccion || "",
    localidad: c.localidad || "",
    visitado,
    compro,
    comentario,
    vendedor,
  });
  let exito = false;

  try {
    const r = await fetch(`${URL_API_BASE}?${params.toString()}`);
    const js = await r.json();
    
    // --- MODIFICACIÓN ---
    mostrarExito(); // En lugar de toast()
    // --- FIN MODIFICACIÓN ---

    exito = true;
  } catch {
    // Guardado offline si no hay conexión
    queueOffline({ t: "visita", params: Object.fromEntries(params) });

    // --- MODIFICACIÓN ---
    mostrarExito(); // En lugar de toast()
    // --- FIN MODIFICACIÓN ---

    exito = true;
  }

  if (exito) {
    // 🔒 Esta lógica de bloqueo y movimiento ya estaba correcta
    const idx = clientesData.findIndex(x => String(x.numero) === String(numero));
    if (idx !== -1) {
      const cliente = clientesData.splice(idx, 1)[0];
      cliente.bloqueado = true;
      clientesData.push(cliente);
      guardarOrden(clientesData.map(x => String(x.numero)));

      // 🔄 Actualizar visualmente sin esperar recarga total
      renderClientes();
      // ✨ Animación opcional para que se note el cambio
      const card = document.getElementById(`c_${numero}`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }
}


/* ================================
   📶 Cola offline + sincronización automática
================================ */
function queueOffline(item) {
  const k = "offlineQueue";
  let q = [];
  try {
    q = JSON.parse(localStorage.getItem(k) || "[]");
  } catch {}
  q.push(item);
  localStorage.setItem(k, JSON.stringify(q));
}

async function syncOffline() {
  if (!navigator.onLine) return;
  const k = "offlineQueue";
  let q = [];
  try {
    q = JSON.parse(localStorage.getItem(k) || "[]");
  } catch {}
  if (!q.length) return;

  const rest = [];
  for (const it of q) {
    try {
      if (it.t === "visita") {
        const p = new URLSearchParams(it.params);
        const r = await fetch(`${URL_API_BASE}?${p.toString()}`);
        await r.json();
      }
    } catch {
      rest.push(it);
    }
  }
  localStorage.setItem(k, JSON.stringify(rest));
  if (q.length && rest.length === 0) toast("✅ Sincronización completada");
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
   🔔 Inicializar notificaciones Firebase (versión final con Worker)
   ================================================== */
function inicializarNotificaciones(vendedor) {
  console.log("🚀 Inicializando notificaciones para", vendedor);

  const firebaseConfig = {
    apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
    authDomain: "app-vendedores-inteligente.firebaseapp.com",
    projectId: "app-vendedores-inteligente",
    storageBucket: "app-vendedores-inteligente.appspot.com",
    messagingSenderId: "583313989429",
    appId: "1:583313989429:web:c4f78617ad957c3b11367c"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  if (!("serviceWorker" in navigator)) {
    console.warn("⚠️ Este navegador no soporta Service Workers ni notificaciones push.");
    return;
  }

  navigator.serviceWorker.register("firebase-messaging-sw.js")
    .then(async (registration) => {
      console.log("✅ Service Worker FCM registrado");

      await navigator.serviceWorker.ready;

      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        console.warn("⚠️ El usuario no permitió notificaciones.");
        return;
      }

      console.log("🔑 Obteniendo token FCM...");
      const token = await messaging.getToken({
        vapidKey: "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o",
        serviceWorkerRegistration: registration
      });

      if (!token) {
        console.warn("⚠️ No se obtuvo token FCM");
        return;
      }

      console.log("📬 Token generado:", token.slice(0, 40) + "...");

      // ✅ Enviar token al backend → al WORKER (no al GAS directo)
      try {
        const res = await fetch(URL_API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendedor, token })
        });

        console.log("✅ Token enviado:", await res.text());
      } catch (err) {
        console.error("❌ Error enviando token:", err);
      }

      // Notificaciones en primer plano
      messaging.onMessage((payload) => {
        console.log("📢 Notificación recibida (foreground):", payload);
        if (payload.notification) {
          toast(`${payload.notification.title} — ${payload.notification.body}`);
        }
      });
    })
    .catch((err) => console.error("❌ Error registrando SW FCM:", err));
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
/* ================================
   ✅ Modal de Éxito (NUEVO)
================================ */
function mostrarExito() {
  // 1. Crear elementos
  const overlay = document.createElement("div");
  overlay.className = "exito-overlay";

  const modal = document.createElement("div");
  modal.className = "exito-modal";

  const titulo = document.createElement("h2");
  titulo.textContent = "Visita registrada con éxito";

  const animContainer = document.createElement("div");
  animContainer.className = "exito-anim-container";
  // El CSS se encarga de la animación
  animContainer.innerHTML = '<div class="exito-circulo"></div><div class="exito-tilde"></div>';

  // 2. Ensamblar
  modal.appendChild(animContainer);
  modal.appendChild(titulo);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // 3. Remover después de 1 segundo (1000ms)
  setTimeout(() => {
    overlay.remove();
  }, 1000); 
}


function toast(msg){
// ... (la función toast existente se queda como está)

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
window.abrirRutaEnMapa   = abrirRutaEnMapa;


/* ==================================================
   📍 DETECCIÓN DE CLIENTE CERCANO (Geofencing básico)
   -------------------------------------------------- */
async function detectarClienteCercano(vendedor, clientesHoy) {
  if (!navigator.geolocation) {
    console.warn("⚠️ Geolocalización no soportada en este dispositivo.");
    return;
  }

  // Distancia mínima en metros para considerar “cercano”
  const RADIO_ALERTA = 150;

  // Función para calcular distancia entre dos coordenadas (Haversine)
  function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metros
    const toRad = deg => (deg * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distancia en metros
  }

  // Verifica ubicación periódicamente (cada 60 segundos)
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        for (const c of clientesHoy) {
          if (!c.lat || !c.lng) continue;
          const dist = calcularDistancia(latitude, longitude, c.lat, c.lng);
          if (dist < RADIO_ALERTA) {
            mostrarNotificacionLocal(
              "📍 Cliente cercano",
              `Estás a ${Math.round(dist)} m de ${c.nombre}. Recordá registrar la visita.`
            );
            break; // evita múltiples alertas seguidas
          }
        }
      },
      (err) => console.warn("❌ Error obteniendo ubicación:", err),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
  }, 60 * 1000);
}

/* ==================================================
   🔔 Notificación local directa desde el navegador
   -------------------------------------------------- */
function mostrarNotificacionLocal(titulo, cuerpo) {
  if (Notification.permission === "granted") {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(titulo, {
        body: cuerpo,
        icon: "ml-icon-192.png",
        badge: "ml-icon-96.png"
      });
    });
  } else {
    console.warn("⚠️ Notificaciones no permitidas por el usuario.");
  }
}

