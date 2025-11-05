/* ================================
    ⚙️ Config principal
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
// ⬇️ Esta URL apunta al Worker de Cloudflare
const URL_API_BASE = "https://script.google.com/macros/s/AKfycbz289_bgRPR7mLAe4-LbuePcHaepAMkhosIozkUDu4vhCR1qjM4cJ0INirCOO389f1n/exec";


let clientesData = [];
let posicionActual = null;
let mapaFull = null;

/* =======================================
    🔐 Login & sesión (NATIVO / API)
======================================= */

function logout(){ 
  localStorage.removeItem("vendedorClave"); 
  location.reload(); 
}

window.addEventListener("DOMContentLoaded", () => {
    restaurarTema();
    syncOffline();
    notificacionDiaria();

    const claveGuardada = localStorage.getItem("vendedorClave");
    if (claveGuardada && vendedores[claveGuardada]) {
        document.getElementById("login").style.display = "none";
        mostrarApp(); 
    } else {
        document.getElementById("login").style.display = "grid";
        inicializarLoginNativo();
    }
});

function inicializarLoginNativo() {
    const hiddenInput = document.getElementById('hidden-pin-input');
    const pinDots = document.querySelectorAll('.pin-dot');
    const pinDisplay = document.querySelector('.pin-display');
    const errorMessage = document.getElementById('error');
    const loader = document.getElementById('loader');
    if (!hiddenInput) return;
    let currentPin = '';

    function focusInput() { hiddenInput.focus(); }
    focusInput();
    document.body.addEventListener('click', () => {
        if (document.getElementById('login').style.display === 'grid') focusInput();
    });
    document.body.addEventListener('touchstart', () => {
        if (document.getElementById('login').style.display === 'grid') focusInput();
    });

    hiddenInput.addEventListener('input', (e) => {
        currentPin = e.target.value.trim().substring(0, 4);
        e.target.value = currentPin;
        updatePinDisplay(currentPin.length);
        vibrate(50); 
        if (currentPin.length === 4) {
            hiddenInput.blur();
            validatePin(currentPin);
        }
    });

    function updatePinDisplay(length) {
        pinDisplay.classList.remove('error');
        errorMessage.classList.remove('visible');
        pinDots.forEach((dot, index) => {
            dot.classList.toggle('active', index < length);
        });
    }

    async function validatePin(pin) {
      showLoading(true);
      errorMessage.classList.remove('visible');
      try {
          // ✅ CORRECTO: Llama al worker (URL_API_BASE)
          // y envía la 'action' DENTRO del body.
          const response = await fetch(URL_API_BASE, { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  action: "autenticarVendedor", // <-- La 'action' va aquí
                  pin: pin 
              }) 
          });

          // Si el worker falla o Google falla, esto dará el error
          const result = await response.json(); 

          if (result.estado === "ok" && result.vendedor) {
              localStorage.setItem("vendedorClave", result.vendedor.clave);
              document.getElementById("login").style.opacity = "0";
              setTimeout(() => {
                  document.getElementById("login").style.display = "none";
              }, 300);
              mostrarApp();
          } else {
              handleLoginError(result.mensaje || "PIN incorrecto");
          }
      } catch (err) {
          // Este es el error que estás viendo
          console.error("Error de red o JSON:", err); 
          handleLoginError("Error de conexión. Revisa el worker.");
      } finally {
          showLoading(false);
      }
    }

    function handleLoginError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('visible');
        pinDisplay.classList.add('error');
        vibrate([100, 50, 100]); 
        currentPin = '';
        hiddenInput.value = '';
        setTimeout(() => {
            updatePinDisplay(0);
            focusInput(); 
        }, 1000);
    }

    function showLoading(isLoading) {
        loader.classList.toggle('visible', isLoading);
        pinDisplay.style.display = isLoading ? 'none' : 'flex';
    }

    function vibrate(pattern) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(pattern);
        }
    }
}
/* ================================
    (Fin del bloque de Login)
================================ */


/* ================================
    🎨 Temas
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
  b.classList.remove("tema-confianza","tema-energia","tema-foco");
  b.classList.add(clase);
  localStorage.setItem("temaPreferido", clase);
}
function restaurarTema(){ aplicarTema(localStorage.getItem("temaPreferido")||"tema-confianza"); }
function toggleModoOscuro(){
  const actual=document.body.classList.contains("tema-foco");
  aplicarTema(actual? (localStorage.getItem("temaPreferido")||"tema-confianza") : "tema-foco");
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
  document.getElementById("titulo").textContent=`👋 Hola, ${vendedores[clave]}`;
  mostrarSeccion("ruta");
  const clientesHoy=await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  inicializarNotificaciones(clave);
  if(clientesHoy.length) detectarClienteCercano(clave, clientesHoy);
}

/* ================================
    📍 Distancias
================================ */
const toRad = d => d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

/* ================================
    🚗 Cargar ruta
================================ */
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  const estado=document.getElementById("estado");
  cont.innerHTML="⏳ Cargando clientes...";
  try{
    // ✅ CORRECTO: Las peticiones GET (para data) están bien como las tenías.
    const r1 = await fetch(`${URL_API_BASE}?action=getRutaDelDiaPorVendedor&clave=${clave}`);
    clientesData = await r1.json();

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{ posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; renderClientes(); });
    }

    estado.textContent=`Ruta cargada (${clientesData.length} clientes)`;
    renderClientes();
    return clientesData;
  }catch(e){
    estado.textContent="❌ Error al cargar datos.";
    return [];
  }
}

/* ================================
    ✅ RENDER CLIENTES
================================ */
function renderClientes(){
  const cont = document.getElementById("contenedor");
  if(!cont) return;
  cont.innerHTML = "";
  let lista = [...clientesData];

  if(posicionActual){
    lista.sort((a,b)=>{
      const da = distanciaKm(posicionActual.lat,posicionActual.lng,parseFloat(a.lat),parseFloat(a.lng)) || 9999;
      const db = distanciaKm(posicionActual.lat,posicionActual.lng,parseFloat(b.lat),parseFloat(b.lng)) || 9999;
      return da - db;
    });
  }

  lista.forEach((c)=>{
    const card=document.createElement("div");
    card.className="cliente"; card.id="c_"+c.numero;
    const lat=parseFloat(c.lat), lng=parseFloat(c.lng);
    const dist = posicionActual && !isNaN(lat) && !isNaN(lng) ? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng).toFixed(1) : null;
    const visitadoHecho = !!c.bloqueado;

    card.innerHTML=`
      <h3>${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion||""}${c.localidad?`, ${c.localidad}`:""}</span>
        ${dist? `<span class="badge">📏 ${dist} km</span>`:""}
      </div>
      <div class="fila" style="margin-top:6px; gap:10px;">
        <button id="btn-visita-${c.numero}" class="btn-visita ${visitadoHecho?"hecho":""}">
          ${visitadoHecho?"✅ Visitado":"Aún sin visitar"}
        </button>
        <button id="btn-compro-${c.numero}" class="btn-compro" ${visitadoHecho?"":"disabled"}>
          🛒 Compró
        </button>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        <button class="btn-secundario" onclick="irCliente(${lat},${lng})">🚗 Ir</button>
      </div>`;

    const btnVisita = card.querySelector(`#btn-visita-${c.numero}`);
    const btnCompro = card.querySelector(`#btn-compro-${c.numero}`);
    btnVisita.onclick=()=>{ btnVisita.classList.add("hecho"); btnVisita.textContent="✅ Visitado"; btnCompro.removeAttribute("disabled"); };
    btnCompro.onclick=()=>{ btnCompro.classList.toggle("hecho"); };
    if(c.bloqueado) card.classList.add("bloqueado");
    cont.appendChild(card);
  });
}

function irCliente(lat,lng){
  if(!lat || !lng){ alert("📍 Este cliente no tiene coordenadas."); return; }
  const dest = `&destination=${lat},${lng}&travelmode=driving`;
  window.open(`https://www.google.com/maps/dir/?api=1${dest}`,"_blank");
}

/* ================================
    🗺️ Mapa
================================ */
function renderMapaFull(){
  const el=document.getElementById("mapaFull");
  if(!el) return;
  if(mapaFull){ mapaFull.remove(); mapaFull=null; }
  mapaFull=L.map("mapaFull").setView([-34.7,-58.4],11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaFull);
  clientesData.forEach(c=>{
    if(c.lat&&c.lng) L.marker([c.lat,c.lng]).addTo(mapaFull).bindPopup(c.nombre);
  });
}

/* ================================
    💾 Registrar visita
================================ */
function getClientePorNumero(num){ return clientesData.find(x=>String(x.numero)===String(num)); }

async function registrarVisita(numero){
  mostrarExito(); 
  const visitado = document.getElementById(`btn-visita-${numero}`)?.classList.contains("hecho");
  const compro    = document.getElementById(`btn-compro-${numero}`)?.classList.contains("hecho");
  const comentario=(document.getElementById(`coment-${numero}`)?.value||"").trim();
  const c=getClientePorNumero(numero);
  const vendedor=localStorage.getItem("vendedorClave");
  c.bloqueado=true;
  renderClientes(); 

  const params = {
      action:"registrarVisita",
      numero:c.numero,
      nombre:c.nombre,
      direccion:c.direccion||"",
      localidad:c.localidad||"",
      visitado: visitado.toString(),
      compro: compro.toString(),
      comentario,
      vendedor
  };
  
  // ✅ CORRECTO: Llama al worker (URL_API_BASE)
  // y envía 'params' (que incluye la 'action') DENTRO del body.
  try{ 
    await fetch(URL_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params) 
    });
  } catch(e) { 
    queueOffline({t:"visita",params:params}); 
  }
}

/* ================================
    🔔 Overlay Éxito
================================ */
function mostrarExito(){
  const prev=document.querySelector(".exito-overlay"); if(prev) prev.remove();
  const wrap=document.createElement("div");
  wrap.className="exito-overlay";
  wrap.innerHTML=`
    <div class="exito-box">
      <div class="exito-circle">
        <svg><circle class="bg" cx="90" cy="90" r="84"></circle><circle class="prog" cx="90" cy="90" r="84"></circle></svg>
        <div class="exito-check">
          <svg><path d="M26 48 L44 68 L70 34"></path></svg>
        </div>
      </div>
      <div class="exito-titulo">Visita registrada</div>
    </div>`;
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(), 900);
}

/* ================================
    📶 Cola Offline y Stubs
================================ */
function queueOffline(item){ const k="offlineQueue"; let q=JSON.parse(localStorage.getItem(k)||"[]"); q.push(item); localStorage.setItem(k,JSON.stringify(q)); }
async function syncOffline(){}
async function cargarResumen(clave){}
async function cargarCalendario(clave){} 
function inicializarNotificaciones(clave){} 
function notificacionDiaria(){}
function detectarClienteCercano(clave, clientesHoy){}
function toast(msg){}

/* Exponer funciones al window */
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.registrarVisita=registrarVisita;
window.irCliente=irCliente;
window.aplicarTema = aplicarTema;
window.toggleModoOscuro = toggleModoOscuro;
window.toggleTemaMenu = toggleTemaMenu;
