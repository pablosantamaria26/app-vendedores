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
  const loginDiv=document.getElementById("login"); 
  if(loginDiv) {
    loginDiv.style.opacity = "0"; 
    setTimeout(() => { loginDiv.style.display="none"; }, 300);
  }
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.addEventListener("load",()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ 
    document.getElementById("login").style.display="none"; 
    mostrarApp(); 
  } else { 
    document.getElementById("login").style.display="grid"; 
  }
  restaurarTema();
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
function restaurarTema(){
  const t=localStorage.getItem("temaPreferido")||"tema-confianza";
  aplicarTema(t);
}
function toggleModoOscuro(){
  const actual=document.body.classList.contains("tema-foco");
  const guardado = localStorage.getItem("temaPreferido") || "tema-confianza";
  aplicarTema(actual ? guardado : "tema-foco");
}

/* ================================
   🧭 Navegación
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  document.getElementById("seccion-"+s)?.classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`)?.classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
   🚀 App principal
================================ */
async function mostrarApp(){
  const clave=localStorage.getItem("vendedorClave");
  const nombre=vendedores[clave];
  document.getElementById("titulo").textContent=`👋 Hola, ${nombre}`;
  mostrarSeccion("ruta");

  await new Promise(r => setTimeout(r, 300));
  await inicializarNotificaciones(clave);
  await new Promise(r => setTimeout(r, 300));
  const clientesHoy = await cargarRuta(clave);
  await new Promise(r => setTimeout(r, 300));
  await cargarCoach(clave);

  if(clientesHoy && clientesHoy.length){
    console.log("✅ Ruta cargada con", clientesHoy.length, "clientes.");
  }
}

/* ================================
   🔔 Inicializar notificaciones (sin duplicados)
================================ */
async function inicializarNotificaciones(vendedorClave){
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyByzMQzUTKY9Gz3Hdq_L1vPLyp6TcnP5dk",
      authDomain: "mlventas.firebaseapp.com",
      projectId: "mlventas",
      messagingSenderId: "1001909689337",
      appId: "1:1001909689337:web:ea9b3ec65f8dfd0e278dc8"
    };

    const app = firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return;

    const token = await messaging.getToken({
      vapidKey: "BCKV3MEhLxYBhlp1AzC0WOfvD1hH7CWZ5C9pqu1Y5raTd03MAl3jvOBM8k-mtW6TQyN6GXcOaItIb5zzU2u0_LY"
    });
    if (!token) return;

    const lastToken = localStorage.getItem("firebaseToken");
    if (lastToken === token) {
      console.log("🔁 Token ya registrado, no se duplica.");
      return;
    }

    await fetch(URL_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardarToken", vendedor: vendedorClave, token })
    });
    localStorage.setItem("firebaseToken", token);
    console.log("✅ Token registrado para", vendedorClave);
  } catch (e) {
    console.warn("⚠️ Error al inicializar notificaciones:", e);
  }
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
   🗂️ Orden
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }
function cargarOrden(){ try{ return JSON.parse(localStorage.getItem(keyOrden())||"[]"); }catch{ return []; } }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

/* ================================
   🚗 Cargar ruta (con cache)
================================ */
async function cargarRuta(clave) {
  const hoy = new Date().toISOString().slice(0,10);
  const cacheKey = `rutaCache_${clave}_${hoy}`;
  const cache = localStorage.getItem(cacheKey);
  if (cache) {
    try {
      clientesData = JSON.parse(cache);
      renderClientes();
      console.log("📦 Ruta cargada desde caché local");
      return clientesData;
    } catch {}
  }

  const cont = document.getElementById("contenedor");
  cont.innerHTML = "⏳ Cargando clientes...";
  try {
    const r1 = await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
    const text = await r1.text();
    clientesData = JSON.parse(text);
    localStorage.setItem(cacheKey, JSON.stringify(clientesData));
    renderClientes();
    return clientesData;
  } catch (e) {
    console.error("❌ Error al cargar datos:", e);
    cont.textContent = "❌ Error al cargar datos.";
    return [];
  }
}

/* ================================
   🧱 Render de clientes
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor"); 
  if(!cont) return;
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const card=document.createElement("div");
    card.className="cliente"; card.id="c_"+c.numero;
    const lat=parseFloat(c.lat), lng=parseFloat(c.lng);
    const tieneGeo=Number.isFinite(lat)&&Number.isFinite(lng);
    const dist=(posicionActual&&tieneGeo)?distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng):null;
    card.innerHTML=`
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}</span>
        ${dist!==null?`<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
      </div>
      <div class="fila" style="margin-top:6px">
        <label><input type="checkbox" id="visitado-${c.numero}" ${c.visitado?'checked':''}> Visitado</label>
        <label><input type="checkbox" id="compro-${c.numero}" ${c.compro?'checked':''}> Compró</label>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2">${c.comentario||""}</textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="confirmDestino(${lat},${lng},'${c.nombre.replace(/'/g,"")}')">🚗 Ir</button>
      </div>`;
    cont.appendChild(card);
  });

  const visitados = clientesData.filter(c=>c.bloqueado).length;
  const restantes = clientesData.length - visitados;
  const compraron = clientesData.filter(c=>c.compro).length;
  const estadoRuta = document.getElementById("estadoRuta");
  if (estadoRuta) {
    estadoRuta.innerHTML = 
      `🚗 <b>${restantes}</b> por visitar · ✅ <b>${visitados}</b> visitados · 🛒 <b>${compraron}</b> compraron`;
  }
}

/* ==================================================
   💾 Registrar visita
================================================== */
async function registrarVisita(numero) {
  const clave = localStorage.getItem("vendedorClave");
  const cliente = clientesData.find(c => String(c.numero) === String(numero));
  if (!cliente) return;

  const visitado = document.getElementById(`visitado-${numero}`)?.checked || false;
  const compro = document.getElementById(`compro-${numero}`)?.checked || false;
  const comentario = document.getElementById(`coment-${numero}`)?.value || "";

  cliente.visitado = visitado;
  cliente.compro = compro;
  cliente.comentario = comentario;
  cliente.bloqueado = true;

  guardarLocal(clave, clientesData);
  mostrarToastExito("✅ Visita registrada");

  try {
    const resp = await fetch(`${URL_API_BASE}?accion=registrarVisita`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clave, numero, visitado, compro, comentario,
        nombre: cliente.nombre,
        direccion: cliente.direccion || "",
        localidad: cliente.localidad || ""
      })
    });
    const text = await resp.text();
    console.log("📤 Enviado:", text);
  } catch (e) {
    console.warn("⚠️ Error al registrar:", e);
  }

  renderClientes();
}

/* ==================================================
   💾 Persistencia local diaria
================================================== */
function guardarLocal(clave, data) {
  const hoy = new Date().toISOString().slice(0,10);
  localStorage.setItem(`data_${clave}_${hoy}`, JSON.stringify(data));
}

/* ==================================================
   ✨ Toast de éxito animado
================================================== */
function mostrarToastExito(texto) {
  const overlay = document.createElement("div");
  overlay.className = "exito-overlay";
  overlay.innerHTML = `
    <div class="exito-box">
      <div class="exito-circle">
        <svg><circle class="bg" cx="90" cy="90" r="90"/><circle class="prog" cx="90" cy="90" r="90"/></svg>
        <div class="exito-check"><svg><path d="M35 90 l30 30 l60 -60"/></svg></div>
      </div>
      <div class="exito-titulo">${texto}</div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>overlay.remove(),1800);
}

/* ==================================================
   📍 Modal de confirmación (Mapa)
================================================== */
function confirmDestino(lat, lng, nombre) {
  alert(`📍 Ir hacia ${nombre}\nhttps://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
}

/* ==================================================
   🗺️ Mapa Full
================================================== */
function renderMapaFull(){
  if(!document.getElementById("mapaFull")) return;
  if(mapaFull){ mapaFull.remove(); }

  mapaFull = L.map("mapaFull").setView([-34.60, -58.38], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapaFull);

  clientesData.forEach(c=>{
    if(!c.lat || !c.lng) return;
    const mk=L.marker([c.lat, c.lng]).addTo(mapaFull);
    mk.bindTooltip(c.nombre);
  });
}

/* ==================================================
   🤖 COACH DE VENTAS IA (con cache)
================================================== */
async function cargarCoach(clave) {
  const hoy = new Date().toISOString().slice(0,10);
  const cacheKey = `coachCache_${clave}_${hoy}`;
  const cache = localStorage.getItem(cacheKey);
  const cont = document.getElementById("contenedorCoach");

  if (cache) {
    try {
      const data = JSON.parse(cache);
      renderCoach(data, cont);
      return;
    } catch {}
  }

  cont.innerHTML = "⏳ Analizando rendimiento...";
  try {
    const resp = await fetch(`${URL_API_BASE}?accion=getConsejosVendedor&clave=${clave}`);
    const text = await resp.text();
    const data = JSON.parse(text);
    localStorage.setItem(cacheKey, JSON.stringify(data));
    renderCoach(data, cont);
  } catch (e) {
    cont.innerHTML = "❌ Error cargando Coach IA.";
  }
}

function renderCoach(data, cont) {
  if (!data || !data.sugerencias?.length) {
    cont.innerHTML = "✅ Sin alertas ni recomendaciones por ahora.";
    return;
  }
  cont.innerHTML = data.sugerencias.map(s => `<div class="coach-item">💡 ${s}</div>`).join("");
}

/* ==================================================
   🔗 Exponer funciones
================================================== */
window.agregarDigito = agregarDigito;
window.borrarDigito = borrarDigito;
window.login = login;
window.logout = logout;
window.mostrarSeccion = mostrarSeccion;
window.toggleModoOscuro = toggleModoOscuro;
window.toggleTemaMenu = toggleTemaMenu;
window.aplicarTema = aplicarTema;
