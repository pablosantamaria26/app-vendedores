/* ================================
   ⚙️ Config principal
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
// Proxy Worker (CORS-safe) — igual que tu app
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
  const loginDiv=document.getElementById("login"); if(loginDiv) loginDiv.style.display="none";
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.addEventListener("load",()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ document.getElementById("login").style.display="none"; mostrarApp(); }
  else { document.getElementById("login").style.display="grid"; }
  // restaurar tema
  restaurarTema();
  // utilidades
  syncOffline();
  notificacionDiaria(); // como en tu versión
});

/* ================================
   🎨 Temas (selector en encabezado)
================================ */
function toggleTemaMenu(ev){
  ev.stopPropagation();
  const m=document.getElementById("temaMenu");
  m.classList.toggle("visible");
  // cerrar si clic fuera
  const close=()=>{ m.classList.remove("visible"); document.removeEventListener("click", close); };
  setTimeout(()=>document.addEventListener("click", close), 0);
}

function aplicarTema(clase){
  const b=document.body;
  b.classList.remove("tema-confianza","tema-energia","tema-foco");
  b.classList.add(clase);
  localStorage.setItem("temaPreferido", clase);
}

function restaurarTema(){
  const t=localStorage.getItem("temaPreferido")||"tema-confianza";
  aplicarTema(t);
}

function toggleModoOscuro(){
  // Alterna rápido al tema de alto contraste
  const actual=document.body.classList.contains("tema-foco");
  aplicarTema(actual? (localStorage.getItem("temaPreferido")||"tema-confianza") : "tema-foco");
}

/* ================================
   🧭 Navegación de secciones
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  const destino=document.getElementById("seccion-"+s); if(destino) destino.classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  const btn=document.querySelector(`.menu button[onclick=\"mostrarSeccion('${s}')\"]`); if(btn) btn.classList.add("activo");
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
  await cargarResumen(clave);
  await cargarCalendario();

  inicializarNotificaciones(clave);

  // Geofencing básico como tu versión
  if(clientesHoy && clientesHoy.length){ detectarClienteCercano(clave, clientesHoy); }
}

/* ================================
   📍 Distancias (Haversine)
================================ */
const toRad=(d)=> d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

/* ================================
   🗂️ Orden (persistente)
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
    const pred=await predR.json();

    // Orden
    const orden=cargarOrden();
    if(orden.length){
      const map=new Map(clientesData.map(c=>[String(c.numero),c]));
      clientesData = orden.map(id=>map.get(String(id))).filter(Boolean)
        .concat(clientesData.filter(c=>!orden.includes(String(c.numero))));
    }

    // Geo para distancias
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderClientes(); }, ()=>renderClientes(), {enableHighAccuracy:true, maximumAge:15000, timeout:8000});
    }else{ renderClientes(); }

    if(estado){ const ahora=new Date().toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"}); estado.textContent=`Ruta cargada (${clientesData.length} clientes) — Última actualización: ${ahora}`; }

    // Podés reusar pred si querés mostrar panel extra
    return clientesData;
  }catch(e){ console.error("❌ Error al cargar datos:", e); if(estado) estado.textContent="❌ Error al cargar datos."; return []; }
}

/* ================================
   🧱 Render de tarjetas (autobloqueo tras guardar)
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor"); if(!cont) return;
  cont.innerHTML="";

  // aplicar filtros si tuvieras
  let lista = clientesData.slice();
  if(typeof filtroLocalidad!=="undefined" && filtroLocalidad){
    lista = lista.filter(c => String(c.localidad||"") === String(filtroLocalidad));
  }
  if(typeof ordenarPorDistancia!=="undefined" && ordenarPorDistancia && posicionActual){
    lista.sort((a,b)=>{
      const la=parseFloat(a?.lat), loa=parseFloat(a?.lng), lb=parseFloat(b?.lat), lob=parseFloat(b?.lng);
      const da = (Number.isFinite(la)&&Number.isFinite(loa))? distanciaKm(posicionActual.lat,posicionActual.lng,la,loa) : Infinity;
      const db = (Number.isFinite(lb)&&Number.isFinite(lob))? distanciaKm(posicionActual.lat,posicionActual.lng,lb,lob) : Infinity;
      return da - db;
    });
  }

  lista.forEach((c,idx)=>{
    const card=document.createElement("div");
    card.className="cliente"; card.id="c_"+(c?.numero ?? idx);

    const lat=parseFloat(c?.lat); const lng=parseFloat(c?.lng);
    const tieneGeo=Number.isFinite(lat)&&Number.isFinite(lng);
    const dist=(posicionActual && tieneGeo) ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    // ⬇️ NUEVO bloque de botones en lugar de checkboxes
    const visitadoHecho = !!c?.bloqueado; // si ya vino bloqueado lo mostramos como visitado
    card.innerHTML=`
      <h3>${c?.nombre||"(sin nombre)"}</h3>
      <div class="fila">
        <span>📍 ${(c?.direccion||"")}${c?.localidad?`, ${c.localidad}`:""}</span>
        ${dist!==null?`<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>

      <div class="fila" style="margin-top:6px; gap:10px;">
        <button id="btn-visita-${c?.numero}" class="btn-visita ${visitadoHecho ? "hecho" : ""}">
          ${visitadoHecho ? "✅ Visitado" : "Aún sin visitar"}
        </button>

        <button id="btn-compro-${c?.numero}" class="btn-compro" ${visitadoHecho ? "" : "disabled"}>
          🛒 Compró
        </button>
      </div>

      <textarea id="coment-${c?.numero}" placeholder="Comentario..." rows="2"></textarea>

      <div class="acciones">
        <button onclick="registrarVisita(${c?.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="irCliente(${tieneGeo?lat:"null"},${tieneGeo?lng:"null"})">🚗 Ir</button>
      </div>`;

    // Drag & Drop (solo si NO está ordenando por distancia)
    const draggable = !(typeof ordenarPorDistancia!=="undefined" && ordenarPorDistancia);
    card.setAttribute("draggable", String(draggable));
    if(draggable){
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
    }

    // 🔘 Lógica de botones "Visitado" / "Compró"
    const btnVisita = card.querySelector(`#btn-visita-${c?.numero}`);
    const btnCompro = card.querySelector(`#btn-compro-${c?.numero}`);

    if(btnVisita){
      btnVisita.addEventListener("click", () => {
        // marcar como visitado visualmente
        btnVisita.classList.add("hecho");
        btnVisita.textContent = "✅ Visitado";
        btnCompro?.removeAttribute("disabled");
      });
    }
    if(btnCompro){
      btnCompro.addEventListener("click", () => {
        // toggle "compró"
        btnCompro.classList.toggle("hecho");
      });
    }

    // bloquear si viene marcado
    if(c?.bloqueado){
      card.classList.add("bloqueado");
      card.querySelectorAll("input,textarea,button").forEach(el=>el.disabled=true);
    }

    cont.appendChild(card);
  });
}


/* ================================
   🗺️ Mapa (recreación al entrar) + confirm TOAST
================================ */
function renderMapaFull(){
  const el=document.getElementById("mapaFull"); if(!el) return;
  if(mapaFull){ mapaFull.remove(); mapaFull=null; }
  el.innerHTML="";

  mapaFull=L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaFull);

  const group=[];
  clientesData.forEach(c=>{
    const lat=(c.lat!=null)?parseFloat(c.lat):null; const lng=(c.lng!=null)?parseFloat(c.lng):null;
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const mk=L.marker([lat,lng]).addTo(mapaFull).bindPopup(c.nombre);
      mk.on("click",()=>confirmDestino(lat,lng,c.nombre));
      group.push(mk);
    }
  });
  if(group.length){ const gl=L.featureGroup(group); mapaFull.fitBounds(gl.getBounds().pad(0.3)); }

  if(posicionActual){
    L.marker([posicionActual.lat,posicionActual.lng],{ icon:L.icon({iconUrl:"https://cdn-icons-png.flaticon.com/512/684/684908.png",iconSize:[32,32]}) }).addTo(mapaFull).bindPopup("📍 Estás aquí");
  }else if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderMapaFull(); });
  }
}

function confirmDestino(lat,lng,nombre){
  const old=document.querySelector(".confirm-toast"); if(old) old.remove();
  const t=document.createElement("div");
  t.className="confirm-toast";
  t.innerHTML=`<span>¿Ir a <b>${nombre}</b>?</span> <button onclick=\"goYes(${lat},${lng})\">Sí</button> <button onclick=\"this.parentElement.remove()\">No</button>`;
  document.body.appendChild(t);
}
function goYes(lat,lng){ document.querySelector(".confirm-toast")?.remove(); irCliente(lat,lng); }

function irCliente(lat,lng){
  if(!lat||!lng){ alert("📍 Este cliente no tiene coordenadas."); return; }
  const base="https://www.google.com/maps/dir/?api=1";
  const dest=`&destination=${lat},${lng}&travelmode=driving`;
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{ const org=`&origin=${pos.coords.latitude},${pos.coords.longitude}`; window.open(`${base}${org}${dest}`,"_blank"); },()=>{ window.open(`${base}${dest}`,"_blank"); });
  }else{ window.open(`${base}${dest}`,"_blank"); }
}

/* ================================
   💾 Registrar visita (instant toast + segundo plano)
================================ */
function getClientePorNumero(num){ return clientesData.find(x=>String(x.numero)===String(num)); }

async function registrarVisita(numero){
  const c=getClientePorNumero(numero);
  if(!c){ toast("❌ Cliente no encontrado"); return; }

  // ✅ ÉXITO INSTANTÁNEO (1s) ANTES DEL FETCH
  mostrarExito();

  // 🔘 Leer estados desde los botones (no checkboxes)
  const visitado = document.getElementById(`btn-visita-${numero}`)?.classList.contains("hecho") || false;
  const compro   = document.getElementById(`btn-compro-${numero}`)?.classList.contains("hecho") || false;
  const comentario=(document.getElementById(`coment-${numero}`)?.value||"").trim();
  const vendedor=localStorage.getItem("vendedorClave")||"";

  // 🔒 Bloquear tarjeta y mandarla al final YA (UI optimista)
  const idx=clientesData.findIndex(x=>String(x.numero)===String(numero));
  if(idx!==-1){
    const cliente=clientesData.splice(idx,1)[0];
    cliente.bloqueado=true;
    clientesData.push(cliente);
    guardarOrden(clientesData.map(x=>String(x.numero)));
    renderClientes();
    document.getElementById(`c_${numero}`)?.scrollIntoView({behavior:"smooth", block:"end"});
  }

  // 📡 Enviar en segundo plano (queue offline si falla)
  const params=new URLSearchParams({
    accion:"registrarVisita",
    numero:c.numero,
    nombre:c.nombre,
    direccion:c.direccion||"",
    localidad:c.localidad||"",
    visitado, compro, comentario, vendedor
  });

  try{
    const r=await fetch(`${URL_API_BASE}?${params.toString()}`);
    await r.json().catch(()=>{});
  }catch{
    queueOffline({ t:"visita", params:Object.fromEntries(params) });
  }
}

/* ================================
   🔔 Toast de éxito 80% pantalla (1s)
================================ */
function mostrarExito(){
  const prev=document.querySelector(".exito-overlay"); if(prev) prev.remove();
  const wrap=document.createElement("div");
  wrap.className="exito-overlay";
  wrap.innerHTML=`
    <div class=\"exito-box\">
      <div class=\"exito-titulo\">Visita registrada</div>
      <div class=\"exito-circle\">
        <svg viewBox=\"0 0 200 200\">
          <circle class=\"bg\"   cx=\"100\" cy=\"100\" r=\"90\"></circle>
          <circle class=\"prog\" cx=\"100\" cy=\"100\" r=\"90\"></circle>
        </svg>
        <div class=\"exito-check\">
          <svg viewBox=\"0 0 52 52\">
            <path d=\"M14 27 L22 36 L38 16\"></path>
          </svg>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(),1000); // 1s total
}

/* ================================
   📶 Cola offline + sincronización
================================ */
function queueOffline(item){ const k="offlineQueue"; let q=[]; try{ q=JSON.parse(localStorage.getItem(k)||"[]");}catch{} q.push(item); localStorage.setItem(k, JSON.stringify(q)); }
async function syncOffline(){ if(!navigator.onLine) return; const k="offlineQueue"; let q=[]; try{ q=JSON.parse(localStorage.getItem(k)||"[]"); }catch{} if(!q.length) return; const rest=[]; for(const it of q){ try{ if(it.t==="visita"){ const p=new URLSearchParams(it.params); const r=await fetch(`${URL_API_BASE}?${p.toString()}`); await r.json(); } }catch{ rest.push(it); } } localStorage.setItem(k, JSON.stringify(rest)); if(q.length && rest.length===0) toast("✅ Sincronización completada"); }
window.addEventListener("online", syncOffline);

/* ================================
   📈 Resumen + gráfico
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
        <p>🤖 ${ana.mensaje||""}</p>`;
    }

    if(canvas && window.Chart){
      const ctx=canvas.getContext("2d");
      if(canvas._chartInstance) canvas._chartInstance.destroy();
      canvas._chartInstance=new Chart(ctx,{ type:"doughnut", data:{ labels:["Compraron","No compraron"], datasets:[{ data:[res.compraronHoy||0,(res.totalHoy||0)-(res.compraronHoy||0)] }] }, options:{ plugins:{ legend:{ display:false } } } });
    }
  }catch(e){ console.error("❌ Error resumen:", e); if(cont) cont.innerHTML="❌ Error al cargar resumen."; }
}

/* ================================
   📅 Calendario (lista simple)
================================ */
async function cargarCalendario(){
  const cont=document.getElementById("contenedorCalendario"); const clave=localStorage.getItem("vendedorClave");
  if(!cont) return; if(!clave){ cont.innerHTML="⚠️ Debes iniciar sesión primero."; return; }
  cont.innerHTML="⏳ Cargando calendario...";
  try{
    const resp=await fetch(`${URL_API_BASE}?accion=getCalendarioVisitas&clave=${clave}`);
    const data=await resp.json();
    if(!data || !data.length){ cont.innerHTML="📭 No hay visitas programadas."; return; }
    let html=`<div class=\"lista-calendario\">`;
    data.forEach(f=>{ html+=`<div class=\"cal-item\"><div class=\"cal-info\"><b>${f.fecha||""}</b> — ${f.dia||""}<br><span>📍 ${f.localidad||""}</span></div><div class=\"cal-estado\">${f.compro?"✅":"❌"}</div></div>`; });
    html+=`</div>`; cont.innerHTML=html;
  }catch(e){ console.error("Error calendario:", e); cont.innerHTML="❌ Error al cargar calendario."; }
}

/* ================================
   🔔 Firebase Messaging (FCM) — igual que tu versión
================================ */
function inicializarNotificaciones(vendedor){
  const firebaseConfig={
    apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
    authDomain: "app-vendedores-inteligente.firebaseapp.com",
    projectId: "app-vendedores-inteligente",
    storageBucket: "app-vendedores-inteligente.appspot.com",
    messagingSenderId: "583313989429",
    appId: "1:583313989429:web:c4f78617ad957c3b11367c"
  };
  if(typeof firebase==="undefined") return;
  if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const messaging=firebase.messaging();
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("firebase-messaging-sw.js").then(async(reg)=>{
      await navigator.serviceWorker.ready;
      const permiso=await Notification.requestPermission();
      if(permiso!=="granted") return;
      const token=await messaging.getToken({ vapidKey: "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o", serviceWorkerRegistration: reg });
      if(token && vendedor){
        try{ // misma convención que tu app: POST crudo vía Worker
          await fetch(URL_API_BASE,{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ vendedor, token }) });
        }catch(e){ console.warn("No se pudo enviar token FCM", e); }
      }
      messaging.onMessage((payload)=>{ const n=payload.notification; if(n) toast(`${n.title} — ${n.body}`); });
    });
  }
}

/* ================================
   🔔 Notificación diaria (como tu versión)
================================ */
function notificacionDiaria(){
  try{
    if(!("Notification" in window)) return;
    const hoy=new Date().toLocaleDateString("es-AR");
    const ultima=localStorage.getItem("notificacionHoy");
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
   📍 Geofencing básico (como tu versión)
================================ */
async function detectarClienteCercano(vendedor, clientesHoy){
  if(!navigator.geolocation) return;
  const RADIO_ALERTA=150; // metros
  function distM(lat1,lon1,lat2,lon2){
    const R=6371e3; const t=d=>d*Math.PI/180;
    const dphi=t(lat2-lat1), dl=t(lon2-lon1);
    const a=Math.sin(dphi/2)**2 + Math.cos(t(lat1))*Math.cos(t(lat2))*Math.sin(dl/2)**2;
    return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  setInterval(()=>{
    navigator.geolocation.getCurrentPosition((pos)=>{
      const {latitude,longitude}=pos.coords;
      for(const c of clientesHoy){
        if(!c.lat||!c.lng) continue;
        const d=distM(latitude,longitude, c.lat, c.lng);
        if(d<RADIO_ALERTA){ mostrarNotificacionLocal("📍 Cliente cercano", `Estás a ${Math.round(d)} m de ${c.nombre}. Recordá registrar la visita.`); break; }
      }
    },()=>{}, {enableHighAccuracy:true, maximumAge:30000, timeout:10000});
  }, 60*1000);
}
function mostrarNotificacionLocal(titulo,cuerpo){
  if(Notification.permission!=="granted") return;
  navigator.serviceWorker?.ready.then(reg=>{ reg.showNotification(titulo,{ body:cuerpo, icon:"ml-icon-192.png", badge:"ml-icon-96.png" }); });
}

/* ================================
   🔔 Toast simple (mensajes cortos)
================================ */
function toast(msg){ const old=document.querySelector(".toast"); if(old) old.remove(); const t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2800); }

// Exponer funciones si hiciera falta
window.agregarDigito=agregarDigito; window.borrarDigito=borrarDigito; window.login=login; window.logout=logout; window.mostrarSeccion=mostrarSeccion; window.registrarVisita=registrarVisita; window.irCliente=irCliente;

/* === Overrides añadidos: filtros + renderClientes con orden por distancia === */
// Si las variables no existen por fallos de minificación, las definimos de forma segura
if (typeof filtroLocalidad === 'undefined') { var filtroLocalidad = ""; }
if (typeof ordenarPorDistancia === 'undefined') { var ordenarPorDistancia = false; }

function poblarLocalidades(){
  const sel=document.getElementById("filtroLocalidad"); if(!sel) return;
  const set=new Set(); clientesData.forEach(c=>{ if(c && c.localidad) set.add(String(c.localidad)); });
  const arr=[...set].sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = `<option value="">Todas las localidades</option>` + arr.map(l=>`<option value="${l}">${l}</option>`).join("");
  if(filtroLocalidad) sel.value=filtroLocalidad;
}
function aplicarFiltroLocalidad(val){ filtroLocalidad = val || ""; renderClientes(); }
function toggleOrdenDistancia(){ ordenarPorDistancia = !ordenarPorDistancia; const b=document.getElementById("btnOrdenDist"); if(b) b.classList.toggle("activo", ordenarPorDistancia); renderClientes(); }
function initToolbar(){ const sel=document.getElementById("filtroLocalidad"); if(sel && !sel.children.length){ sel.innerHTML = `<option value=\"\">Todas las localidades</option>`; } }

function renderClientes(){
  const cont=document.getElementById("contenedor"); if(!cont) return;
  cont.innerHTML="";

  // aplicar filtros
  let lista = clientesData.slice();
  if(filtroLocalidad){ lista = lista.filter(c => String(c.localidad||"") === String(filtroLocalidad)); }

  // ordenar por distancia si corresponde
  if(ordenarPorDistancia && posicionActual){
    lista.sort((a,b)=>{
      const la=parseFloat(a?.lat), loa=parseFloat(a?.lng), lb=parseFloat(b?.lat), lob=parseFloat(b?.lng);
      const da = (Number.isFinite(la)&&Number.isFinite(loa))? distanciaKm(posicionActual.lat,posicionActual.lng,la,loa) : Infinity;
      const db = (Number.isFinite(lb)&&Number.isFinite(lob))? distanciaKm(posicionActual.lat,posicionActual.lng,lb,lob) : Infinity;
      return da - db;
    });
  }

  lista.forEach((c,idx)=>{
    const card=document.createElement("div");
    card.className="cliente"; card.id="c_"+(c?.numero ?? idx);

    const lat=parseFloat(c?.lat); const lng=parseFloat(c?.lng);
    const tieneGeo=Number.isFinite(lat)&&Number.isFinite(lng);
    const dist=(posicionActual && tieneGeo) ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    card.innerHTML=`
      <h3>${c?.nombre||"(sin nombre)"}</h3>
      <div class=\"fila\">
        <span>📍 ${(c?.direccion||"")}${c?.localidad?`, ${c.localidad}`:""}</span>
        ${dist!==null?`<span class=\"badge\">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>
      <div class=\"fila\" style=\"margin-top:6px\">
        <label><input type=\"checkbox\" id=\"visitado-${c?.numero}\"> Visitado</label>
        <label><input type=\"checkbox\" id=\"compro-${c?.numero}\"> Compró</label>
      </div>
      <textarea id=\"coment-${c?.numero}\" placeholder=\"Comentario...\" rows=\"2\"></textarea>
      <div class=\"acciones\">
        <button onclick=\"registrarVisita(${c?.numero})\">💾 Guardar</button>
        <button class=\"btn-secundario\" onclick=\"irCliente(${tieneGeo?lat:"null"},${tieneGeo?lng:"null"})\">🚗 Ir</button>
      </div>`;

    // Drag & Drop (solo si NO está ordenando por distancia)
    const draggable = !ordenarPorDistancia;
    card.setAttribute("draggable", String(draggable));
    if(draggable){
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
    }

    if(c?.bloqueado){ card.classList.add("bloqueado"); card.querySelectorAll("input,textarea,button").forEach(el=>el.disabled=true); }

    cont.appendChild(card);
  });
}
