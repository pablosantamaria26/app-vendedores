/* ================================
    ⚙️ Config principal
================================ */
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";


let clientesData = [];
let posicionActual = null;
let mapaFull = null;

/* ================================
 🔐 Login & sesión
================================ */
window.addEventListener("DOMContentLoaded", () => {
  restaurarTema();
  const claveGuardada = localStorage.getItem("vendedorClave");
  if (claveGuardada) {
    document.getElementById("login").style.display = "none";
    mostrarApp();
  } else {
    document.getElementById("login").style.display = "grid";
    inicializarLoginNativo();
  }
});

function logout() {
  localStorage.removeItem("vendedorClave");
  location.reload();
}

/* ---- LOGIN UI ---- */
function inicializarLoginNativo() {
  const hiddenInput = document.getElementById('hidden-pin-input');
  const pinDots = document.querySelectorAll('.pin-dot');
  const pinDisplay = document.querySelector('.pin-display');
  const errorMessage = document.getElementById('error');
  const loader = document.getElementById('loader');
  let currentPin = "";

  function focusInput(){ hiddenInput.focus(); }
  focusInput();

  hiddenInput.addEventListener('input', async (e) => {
    currentPin = e.target.value.slice(0,4);
    e.target.value = currentPin;
    pinDots.forEach((dot,i)=>dot.classList.toggle("active", i < currentPin.length));
    if(currentPin.length === 4){
      loader.classList.add("visible");
      pinDisplay.style.display="none";
      await validarLogin(currentPin);
      loader.classList.remove("visible");
      pinDisplay.style.display="flex";
    }
  });

  async function validarLogin(pin){
    try{
      const res = await fetch(URL_API_BASE, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ action:"autenticarVendedor", pin })
      });
      const r = await res.json();
      if(r.estado === "ok"){
        localStorage.setItem("vendedorClave", r.vendedor.clave);
        document.getElementById("login").style.display="none";
        mostrarApp();
      } else {
        errorMessage.textContent = r.mensaje || "PIN incorrecto";
        errorMessage.classList.add("visible");
        currentPin="";
        hiddenInput.value="";
        pinDots.forEach(dot=>dot.classList.remove("active"));
      }
    }catch(err){
      errorMessage.textContent = "Error de conexión";
      errorMessage.classList.add("visible");
    }
  }
}

/* ================================
 🎨 Temas (Modo Día / Modo Noche)
================================ */

function aplicarTema(nombre){
  document.body.classList.remove("tema-dia","tema-noche");
  document.body.classList.add(nombre);
  localStorage.setItem("temaPreferido", nombre);
}

function restaurarTema(){
  aplicarTema(localStorage.getItem("temaPreferido") || "tema-dia");
}

function toggleModoOscuro(){
  if(document.body.classList.contains("tema-noche")){
    aplicarTema("tema-dia");
  } else {
    aplicarTema("tema-noche");
  }
}

/* ================================
 🧭 Navegación entre secciones
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  document.getElementById("seccion-"+s)?.classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[data-seccion="${s}"]`)?.classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
 🚀 Inicio de la App
================================ */
async function mostrarApp(){
  const clave = localStorage.getItem("vendedorClave");
  mostrarSeccion("ruta");
  await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario(clave);
  inicializarNotificaciones(clave); // ✅ ahora sí se envía token al backend
}

/* ================================
 🚗 Ruta del día
================================ */
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="⏳ Cargando clientes...";
  try{
    const r = await fetch(`${URL_API_BASE}?action=getRutaDelDiaPorVendedor&clave=${clave}`);
    clientesData = await r.json();
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude};
        renderClientes();
      });
    } else { renderClientes(); }
  }catch(e){
    cont.innerHTML="❌ Error al cargar ruta.";
  }
  return clientesData;
}

/* ================================
 🧱 Render de tarjetas de clientes
================================ */
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=(bLat-aLat)*Math.PI/180, dLng=(bLng-aLng)*Math.PI/180;
  const A=Math.sin(dLat/2)**2 + Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));
}

function renderClientes(){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="";
  let lista=[...clientesData];

  if(posicionActual){
    lista.sort((a,b)=>{
      const da=distanciaKm(posicionActual.lat,posicionActual.lng,Number(a.lat),Number(a.lng))||999;
      const db=distanciaKm(posicionActual.lat,posicionActual.lng,Number(b.lat),Number(b.lng))||999;
      return da-db;
    });
  }

  lista.forEach(c=>{
    const card=document.createElement("div");
    card.className="cliente";
    card.innerHTML=`
      <h3>${c.nombre}</h3>
      <p>📍 ${c.direccion || ""} ${c.localidad ? "("+c.localidad+")":""}</p>
      <textarea id="coment-${c.numero}" placeholder="Comentario..."></textarea>
      <div class="fila">
        <button onclick="marcarVisita('${c.numero}')">✅ Visitado</button>
        <button onclick="marcarCompra('${c.numero}')">🛒 Compró</button>
        <button onclick="irCliente(${c.lat},${c.lng})">🚗 Ir</button>
      </div>`;
    cont.appendChild(card);
  });
}

function irCliente(lat,lng){
  if(!lat||!lng) return alert("Cliente sin coordenadas");
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,"_blank");
}

/* ================================
 💾 Registrar Visita
================================ */
async function marcarVisita(num){
  await guardarVisita(num,true,false);
}
async function marcarCompra(num){
  await guardarVisita(num,true,true);
}

async function guardarVisita(numero,visitado,compro){
  const c = clientesData.find(x=>String(x.numero)===String(numero));
  const vendedor = localStorage.getItem("vendedorClave");
  const comentario=(document.getElementById(`coment-${numero}`)?.value||"").trim();
  const params={
    action:"registrarVisita",
    numero:c.numero, nombre:c.nombre,
    direccion:c.direccion, localidad:c.localidad,
    visitado, compro, comentario, vendedor
  };
  try{
    await fetch(URL_API_BASE,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(params)
    });
  }catch(err){}
}

/* ================================
 🗺️ Mapa
================================ */
function renderMapaFull(){
  if(mapaFull){ mapaFull.remove(); mapaFull=null; }
  mapaFull=L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaFull);
  clientesData.forEach(c=>{
    if(c.lat && c.lng){
      L.marker([c.lat,c.lng]).addTo(mapaFull).bindPopup(c.nombre);
    }
  });
}

/* ================================
 📊 Pendientes
================================ */
async function cargarResumen(){ }
async function cargarCalendario(){ }

/* ================================
 🔔 Notificaciones Push (FCM)
================================ */
async function inicializarNotificaciones(vendedorClave) {
  const firebaseConfig = {
    apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
    authDomain: "app-vendedores-inteligente.firebaseapp.com",
    projectId: "app-vendedores-inteligente",
    storageBucket: "app-vendedores-inteligente.appspot.com",
    messagingSenderId: "583313989429",
    appId: "1:583313989429:web:c4f78617ad957c3b11367c",
    vapidKey: "BN480IhH70femCH6611oE699tLXFGYbS4MWcTbcEMbOUkR0vIwxXPrzTjhJEB9JcizJxqu4xs91-bQsal1_Hi8o"
  };

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  try {
    await Notification.requestPermission();
    const token = await messaging.getToken({ vapidKey: firebaseConfig.vapidKey });
    if (!token) return;
    await fetch(URL_API_BASE,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"registrarToken", vendedor:vendedorClave, token })
    });
  } catch(err){ console.warn("Notificaciones no habilitadas:",err); }
}

if (typeof firebase !== "undefined") {
  const messaging = firebase.messaging();
  messaging.onMessage((payload) => {
    alert(`🔔 ${payload.notification.title}\n${payload.notification.body}`);
  });
}

/* ================================
 Exponer funciones
================================ */
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.toggleModoOscuro=toggleModoOscuro;
window.marcarVisita=marcarVisita;
window.marcarCompra=marcarCompra;
window.irCliente=irCliente;
