/* ================================================
   🧠 App de Vendedores — 2026 (UI y lógica revisadas)
   - Estadísticas en vivo y persistencia diaria
   - Calendario desde hoy (scroll) + buscador profesional
   - Modo Día/Noche con switch iOS
   - Confirm de mapa 60–70% pantalla
   - Fila no desplaza scroll al guardar
================================================= */

/* ================================
   Config principal
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/"; // proxy CORS

let clientesData = [];
let posicionActual = null;
let mapaFull = null;
let dragSrcIndex = null;

/* ================================
   Utilidades de fecha/clave
================================ */
function hoyISO(){ const d=new Date(); return d.toISOString().slice(0,10); }
function keyVendor(){ return localStorage.getItem("vendedorClave")||""; }
function keyDia(){ return `${keyVendor()}_${hoyISO()}`; }
function keyVisitas(){ return `visitas_${keyDia()}`; }         // estado por cliente
function keyOrden(){ return `ordenClientes_${keyVendor()}`; }  // orden manual

/* ================================
   Login & sesión
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
  else { document.getElementById("login").style.display="grid"; }
  // Tema preferido
  restaurarTema();
  restaurarModo();
  // Cola offline
  syncOffline();
});

/* ================================
   Temas y Modo Día/Noche
================================ */
function toggleTemaMenu(ev){
  ev.stopPropagation();
  const m=document.getElementById("temaMenu");
  m.classList.toggle("visible");
  const close=()=>{ m.classList.remove("visible"); document.removeEventListener("click", close); };
  setTimeout(()=>document.addEventListener("click", close), 0);
}
function aplicarTema(clase){
  const b=document.body;
  b.classList.remove("tema-confianza","tema-energia","tema-foco","tema-noche");
  b.classList.add(clase);
  localStorage.setItem("temaPreferido", clase);
}
function restaurarTema(){ aplicarTema(localStorage.getItem("temaPreferido")||"tema-confianza"); }

// Switch iOS Día/Noche (no cambia el tema motivacional)
function toggleModoApple(){
  const sw=document.getElementById("switchModo");
  const on = sw.getAttribute("data-on") === "1";
  if(on){ // pasar a día
    sw.setAttribute("data-on","0"); sw.querySelector('.label').textContent = 'Modo día';
    document.body.classList.add('modo-dia'); document.body.classList.remove('modo-noche');
    localStorage.setItem('modo','dia');
  } else {
    sw.setAttribute("data-on","1"); sw.querySelector('.label').textContent = 'Modo noche';
    document.body.classList.add('modo-noche'); document.body.classList.remove('modo-dia');
    localStorage.setItem('modo','noche');
  }
}
function restaurarModo(){
  const m=localStorage.getItem('modo')||'dia';
  const sw=document.getElementById("switchModo");
  if(m==='noche'){
    document.body.classList.add('modo-noche'); document.body.classList.remove('modo-dia');
    sw?.setAttribute('data-on','1');
    sw?.querySelector('.label')?.replaceChildren(document.createTextNode('Modo noche'));
  } else {
    document.body.classList.add('modo-dia'); document.body.classList.remove('modo-noche');
    sw?.setAttribute('data-on','0');
    sw?.querySelector('.label')?.replaceChildren(document.createTextNode('Modo día'));
  }
}

/* ================================
   Navegación
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  const destino=document.getElementById("seccion-"+s); destino?.classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  const btn=document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`); btn?.classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
   Datos y persistencia diaria
================================ */
function leerEstado(){ try{ return JSON.parse(localStorage.getItem(keyVisitas())||"{}"); }catch{ return {}; } }
function guardarEstado(st){ localStorage.setItem(keyVisitas(), JSON.stringify(st||{})); }

async function mostrarApp(){
  const clave=keyVendor();
  const nombre=vendedores[clave];
  document.getElementById("titulo").textContent=`👋 Hola, ${nombre}`;

  mostrarSeccion("ruta");

  const clientesHoy=await cargarRuta(clave);
  await cargarResumen(clave); // primer render
  await cargarCalendario();
  inicializarNotificaciones(clave);

  if(clientesHoy && clientesHoy.length){ detectarClienteCercano(clave, clientesHoy); }
}

/* ================================
   Distancias
================================ */
const toRad=(d)=> d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

/* ================================
   Cargar ruta y ordenar
================================ */
function cargarOrden(){ try{ return JSON.parse(localStorage.getItem(keyOrden())||"[]"); }catch{ return []; } }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  const estado=document.getElementById("estado");
  if(cont) cont.innerHTML="⏳ Cargando clientes...";
  try{
    const resp=await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
    clientesData=await resp.json();

    // aplica orden guardado
    const orden=cargarOrden();
    if(orden.length){
      const map=new Map(clientesData.map(c=>[String(c.numero), c]));
      clientesData = orden.map(id=>map.get(String(id))).filter(Boolean)
        .concat(clientesData.filter(c=>!orden.includes(String(c.numero))));
    }

    // geoloc para distancias y render
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderClientes(); actualizarEstadoYEstimacion(); },
        ()=>{ renderClientes(); actualizarEstadoYEstimacion(); },
        {enableHighAccuracy:true, maximumAge:15000, timeout:8000}
      );
    } else { renderClientes(); actualizarEstadoYEstimacion(); }

    return clientesData;
  }catch(e){
    console.error("❌ Error al cargar datos:", e);
    if(estado) estado.textContent="❌ Error al cargar datos.";
    return [];
  }
}

/* ================================
   Render clientes + estado persistente
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor"); if(!cont) return;
  const estadoVis=leerEstado();
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const card=document.createElement("div");
    card.className="cliente"; card.id="c_"+c.numero;

    const lat=parseFloat(c.lat); const lng=parseFloat(c.lng);
    const tieneGeo=Number.isFinite(lat)&&Number.isFinite(lng);
    const dist=(posicionActual && tieneGeo) ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null;

    // estado guardado
    const st=estadoVis[String(c.numero)]||{};
    const visitado = !!st.visitado;
    const compro   = !!st.compro;
    const coment   = st.comentario||"";
    const bloqueado= !!st.bloqueado;

    card.innerHTML=`
      <h3>${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}${c.localidad?`, ${c.localidad}`:""}</span>
        ${dist!==null?`<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>
      <div class="fila" style="margin-top:6px">
        <label><input type="checkbox" id="visitado-${c.numero}" ${visitado?"checked":""}> Visitado</label>
        <label><input type="checkbox" id="compro-${c.numero}" ${compro?"checked":""}> Compró</label>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2">${coment.replace(/</g,'&lt;')}</textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="irCliente(${tieneGeo?lat:"null"},${tieneGeo?lng:"null"})">🚗 Ir</button>
      </div>`;

    // Drag & Drop
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

    if(bloqueado){
      card.classList.add("bloqueado");
      card.querySelectorAll("input,textarea,button").forEach(el=>el.disabled=true);
    }

    cont.appendChild(card);
  });
}

/* ================================
   Panel estado en vivo (debajo de Ruta del día)
   - localidad del día
   - visitados/compraron/restantes
   - estimación si llega 9–14h (Longchamps)
================================ */
function actualizarEstadoYEstimacion(){
  const estado=document.getElementById("estado"); if(!estado) return;
  const st=leerEstado();
  const total=clientesData.length;
  let visitados=0, compraron=0;
  clientesData.forEach(c=>{
    const s=st[String(c.numero)];
    if(s?.visitado) visitados++;
    if(s?.compro)   compraron++;
  });
  const restantes=total-visitados;

  // localidad del día (se toma la más frecuente de la lista)
  const locCount={};
  clientesData.forEach(c=>{
    if(!c?.localidad) return;
    const k=String(c.localidad); locCount[k]=(locCount[k]||0)+1;
  });
  const localidad = Object.entries(locCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "Sin localidad";

  // estimación: tiempo servicio + traslados
  const start=9*60, end=14*60; const jornada=end-start; // minutos
  const avgVel=28; // km/h urbana
  const baseServicio=8; // min por cliente
  const extraDemora=7; // si "pide mucho"

  // suma de tiempos estimados (giro simple: Longchamps -> clientes en orden actual)
  let minutos=0; let prev={lat:-34.856, lng:-58.381}; // Longchamps aprox
  clientesData.forEach(c=>{
    const lat=parseFloat(c.lat), lng=parseFloat(c.lng);
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const dk=distanciaKm(prev.lat,prev.lng,lat,lng);
      minutos += (dk/avgVel)*60; // traslado
      prev={lat,lng};
    }
    // servicio: si el cliente tiene flag demora/pideMucho
    const flag = (c.demoraAlta||c.pideMucho)?extraDemora:0;
    minutos += baseServicio + flag;
  });
  const prom = Math.max(4, Math.round(minutos/Math.max(1,total))); // min/cliente
  const llega = minutos <= jornada ? "✅ Llegás" : "⚠️ Complicado";
  estado.innerHTML = `
    <b>📍 ${localidad}</b> · 👥 ${total} clientes —
    ✅ ${visitados} visitados · 🛒 ${compraron} compraron · ⏳ ${restantes} restantes · ${llega}
    <br><small>Si promediás ~<b>${prom} min/cliente</b>, completás la ruta (9–14 h).</small>`;
}

/* ================================
   Registrar visita (persistencia + stats en vivo)
================================ */
function getClientePorNumero(num){ return clientesData.find(x=>String(x.numero)===String(num)); }

async function registrarVisita(numero){
  const st=leerEstado();
  const visitado=document.getElementById(`visitado-${numero}`)?.checked||false;
  const compro=document.getElementById(`compro-${numero}`)?.checked||false;
  const comentario=(document.getElementById(`coment-${numero}`)?.value||"").trim();

  // persistir inmediatamente
  st[String(numero)] = { visitado, compro, comentario, bloqueado:true };
  guardarEstado(st);

  // 1) éxito instantáneo
  mostrarExito();

  // 2) mover tarjeta al final y bloquear sin mover el scroll
  const scrollY=window.scrollY;
  const idx=clientesData.findIndex(x=>String(x.numero)===String(numero));
  if(idx!==-1){
    const cliente=clientesData.splice(idx,1)[0];
    clientesData.push({...cliente});
    guardarOrden(clientesData.map(x=>String(x.numero)));
    renderClientes();
  }
  window.scrollTo(0, scrollY);

  // 3) stats en vivo
  actualizarEstadoYEstimacion();
  actualizarResumenLocal();

  // 4) envío segundo plano
  const vendedor=keyVendor();
  const c=getClientePorNumero(numero);
  if(!c) return;
  const params=new URLSearchParams({
    accion:"registrarVisita",
    numero:c.numero,
    nombre:c.nombre,
    direccion:c.direccion||"",
    localidad:c.localidad||"",
    visitado,
    compro,
    comentario,
    vendedor
  });
  try{
    const r=await fetch(`${URL_API_BASE}?${params.toString()}`);
    await r.json();
  }catch{
    queueOffline({ t:"visita", params:Object.fromEntries(params) });
  }
}

/* ================================
   Éxito (overlay 1s)
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

/* ================================
   Resumen (gráfico) — refresco local inmediato
================================ */
function actualizarResumenLocal(){
  const st=leerEstado();
  const total=clientesData.length;
  let visitados=0, compraron=0;
  clientesData.forEach(c=>{
    const s=st[String(c.numero)];
    if(s?.visitado) visitados++;
    if(s?.compro)   compraron++;
  });
  const cont=document.getElementById("contenedorResumen");
  if(cont){
    cont.innerHTML=`<p>🚶 Visitas hoy: <b>${visitados}</b> / ${total} — 🛒 Compraron: <b>${compraron}</b></p>`;
  }
  const canvas=document.getElementById("graficoResumen");
  if(canvas && window.Chart){
    const ctx=canvas.getContext("2d"); if(canvas._chartInstance) canvas._chartInstance.destroy();
    canvas._chartInstance=new Chart(ctx,{
      type:"doughnut",
      data:{ labels:["Compraron","No compraron"], datasets:[{ data:[compraron, Math.max(0, visitados - compraron)] }] },
      options:{ plugins:{ legend:{ display:false } } }
    });
  }
}

async function cargarResumen(clave){
  try{
    const r=await fetch(`${URL_API_BASE}?accion=getResumenVendedor&clave=${clave}`);
    await r.json(); // no dependemos del backend para el render inmediato
  }catch{}
  actualizarResumenLocal();
}

/* ================================
   Calendario — solo desde hoy
================================ */
async function cargarCalendario(){
  const cont=document.getElementById("contenedorCalendario"); const clave=keyVendor();
  if(!cont||!clave) return;
  cont.innerHTML="⏳ Cargando calendario...";
  try{
    const resp=await fetch(`${URL_API_BASE}?accion=getCalendarioVisitas&clave=${clave}`);
    const data=await resp.json();
    const hoy=new Date(hoyISO());
    const futuros=(data||[]).filter(f=>{ const d=new Date(f.fecha); return d>=hoy; });
    if(!futuros.length){ cont.innerHTML="📭 No hay visitas programadas desde hoy."; return; }
    let html=`<div class="lista-calendario">`;
    futuros.forEach(f=>{
      html+=`<div class="cal-item">
        <div class="cal-info"><b>${f.fecha||""}</b> — ${f.dia||""}<br><span>📍 ${f.localidad||""}</span></div>
        <div class="cal-estado">${f.compro?"✅":"❌"}</div>
      </div>`;
    });
    html+=`</div>`;
    cont.innerHTML=html;
  }catch(e){
    console.error("Error calendario:", e);
    cont.innerHTML="❌ Error al cargar calendario.";
  }
}

/* ================================
   Buscador profesional (nombre/apellido/calle)
================================ */
function abrirBuscador(){
  const old=document.getElementById('buscadorModal'); if(old) old.remove();
  const wr=document.createElement('div'); wr.className='modal visible'; wr.id='buscadorModal';
  wr.innerHTML=`
    <div class="modal-box">
      <div class="modal-head">
        <strong>🔎 Buscar cliente</strong>
        <input id="qCliente" placeholder="Nombre, apellido o calle..." autocomplete="off" />
      </div>
      <div class="modal-body" id="resultados"></div>
    </div>`;
  wr.addEventListener('click', (e)=>{ if(e.target===wr) wr.remove(); });
  document.body.appendChild(wr);
  const inp=wr.querySelector('#qCliente'); inp.focus();
  inp.addEventListener('input', ()=>{
    const v=inp.value.trim().toLowerCase();
    const out=wr.querySelector('#resultados');
    if(v.length<3){ out.innerHTML='<p>Escribí al menos 3 letras…</p>'; return; }
    const res=clientesData.filter(c=>{
      const nombre=(c.nombre||'').toLowerCase();
      const dir=(c.direccion||'').toLowerCase();
      return nombre.includes(v) || dir.includes(v);
    }).slice(0,50);
    if(!res.length){ out.innerHTML='<p>Sin coincidencias.</p>'; return; }
    out.innerHTML = res.map(c=>
      `<div class="result">
         <div><b>${c.nombre}</b><br><small>${c.direccion||''}${c.localidad?`, ${c.localidad}`:''}</small></div>
         <div>#${c.numero} <button class="copy" onclick="navigator.clipboard.writeText('${c.numero}')">Copiar</button></div>
       </div>`
    ).join('');
  });
}

/* ================================
   Mapa + confirm
================================ */
function renderMapaFull(){
  const el=document.getElementById("mapaFull"); if(!el) return;
  if(mapaFull){ mapaFull.remove(); mapaFull=null; }
  el.innerHTML="";
  mapaFull=L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaFull);
  const group=[];
  clientesData.forEach(c=>{
    const lat=parseFloat(c.lat), lng=parseFloat(c.lng);
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const mk=L.marker([lat,lng]).addTo(mapaFull).bindPopup(c.nombre);
      mk.on('click', ()=>confirmDestino(lat,lng,c.nombre));
      group.push(mk);
    }
  });
  if(group.length){
    const gl=L.featureGroup(group);
    mapaFull.fitBounds(gl.getBounds().pad(0.3));
  }
  if(posicionActual){
    L.marker([posicionActual.lat,posicionActual.lng]).addTo(mapaFull).bindPopup('📍 Estás aquí');
  } else if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude};
      renderMapaFull();
    });
  }
}

function confirmDestino(lat,lng,nombre){
  let ov=document.querySelector('.confirm-overlay'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.className='confirm-overlay visible';
  ov.innerHTML=`<div class="confirm-box">
    <h3>¿Ir a <b>${nombre}</b>?</h3>
    <div></div>
    <div class="confirm-actions">
      <button onclick="this.closest('.confirm-overlay').remove()">Cancelar</button>
      <button class="btn-secundario" onclick="goYes(${lat},${lng})">Sí, abrir Maps</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}
function goYes(lat,lng){ document.querySelector('.confirm-overlay')?.remove(); irCliente(lat,lng); }

function irCliente(lat,lng){
  if(!lat||!lng){ alert("📍 Este cliente no tiene coordenadas."); return; }
  const base="https://www.google.com/maps/dir/?api=1";
  const dest=`&destination=${lat},${lng}&travelmode=driving`;
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      pos=>{ const org=`&origin=${pos.coords.latitude},${pos.coords.longitude}`; window.open(`${base}${org}${dest}`,"_blank"); },
      ()=>{ window.open(`${base}${dest}`,"_blank"); }
    );
  }else{
    window.open(`${base}${dest}`,"_blank");
  }
}

/* ================================
   Geofencing básico (cliente cercano)
================================ */
function detectarClienteCercano(vendedor, clientesHoy){
  if(!("geolocation" in navigator) || !("Notification" in window)) return;
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
        if(d<RADIO_ALERTA){
          mostrarNotificacionLocal("📍 Cliente cercano", `Estás a ${Math.round(d)} m de ${c.nombre}. Recordá registrar la visita.`);
          break;
        }
      }
    },()=>{}, {enableHighAccuracy:true, maximumAge:30000, timeout:10000});
  }, 60*1000);
}

function mostrarNotificacionLocal(titulo,cuerpo){
  if(Notification.permission!=="granted") return;
  try{
    // Si hay SW, usarlo; si no, fallback a Notification directa
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg=>{
        reg.showNotification(titulo,{ body:cuerpo, icon:"ml-icon-192.png", badge:"ml-icon-96.png" });
      });
    } else {
      new Notification(titulo,{ body:cuerpo, icon:"ml-icon-192.png" });
    }
  }catch{}
}

/* ================================
   Cola offline + sync
================================ */
function queueOffline(item){
  const k=`offlineQueue_${keyVendor()}`;
  let q=[]; try{ q=JSON.parse(localStorage.getItem(k)||"[]"); }catch{}
  q.push(item);
  localStorage.setItem(k, JSON.stringify(q));
}
async function syncOffline(){
  if(!navigator.onLine) return;
  const k=`offlineQueue_${keyVendor()}`;
  let q=[]; try{ q=JSON.parse(localStorage.getItem(k)||"[]"); }catch{}
  if(!q.length) return;
  const rest=[];
  for(const it of q){
    try{
      if(it.t==="visita"){
        const p=new URLSearchParams(it.params);
        const r=await fetch(`${URL_API_BASE}?${p.toString()}`);
        await r.json();
      }
    }catch{ rest.push(it); }
  }
  localStorage.setItem(k, JSON.stringify(rest));
}
window.addEventListener("online", syncOffline);

/* ================================
   Firebase Messaging (igual estructura)
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
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('firebase-messaging-sw.js').then(async(reg)=>{
      await navigator.serviceWorker.ready;
      const permiso=await Notification.requestPermission(); if(permiso!=="granted") return;
      const token=await messaging.getToken({
        vapidKey: "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o",
        serviceWorkerRegistration: reg
      });
      if(token && vendedor){
        try{ await fetch(URL_API_BASE,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ vendedor, token }) }); }catch(e){}
      }
      messaging.onMessage((payload)=>{ const n=payload.notification; if(n) toast(`${n.title} — ${n.body}`); });
    });
  }
}

/* ================================
   Toast simple
================================ */
function toast(msg){
  const old=document.querySelector('.toast'); if(old) old.remove();
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2800);
}

/* ================================
   Exponer funciones globales
================================ */
window.agregarDigito=agregarDigito;
window.borrarDigito=borrarDigito;
window.login=login;
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.registrarVisita=registrarVisita;
window.irCliente=irCliente;
window.abrirBuscador=abrirBuscador;
window.toggleTemaMenu=toggleTemaMenu;
window.aplicarTema=aplicarTema;
window.toggleModoApple=toggleModoApple;
