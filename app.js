/* ================================
    ⚙️ Config principal (Tu código)
================================ */
const vendedores = { "0001": "Martín", "0002": "Lucas", "0003": "Mercado Limpio" };
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";

let clientesData = [];
let posicionActual = null;
let mapaFull = null;

/* =======================================
    🔐 Login & sesión (NATIVO / API)
======================================= */

// La función de logout se mantiene
function logout(){ 
  localStorage.removeItem("vendedorClave"); 
  location.reload(); 
}

// El 'load' se reemplaza por DOMContentLoaded para manejar ambos casos
window.addEventListener("DOMContentLoaded", () => {
    // Restauramos funciones visuales y de fondo
    restaurarTema();
    syncOffline();
    notificacionDiaria();

    // Verificamos si ya hay una sesión válida
    const claveGuardada = localStorage.getItem("vendedorClave");
    if (claveGuardada && vendedores[claveGuardada]) {
        // Sesión válida: ocultar login y mostrar app
        document.getElementById("login").style.display = "none";
        mostrarApp(); // Tu función principal
    } else {
        // No hay sesión: mostrar login e inicializarlo
        document.getElementById("login").style.display = "grid";
        inicializarLoginNativo();
    }
});

/**
 * Inicializa la lógica de login con teclado nativo.
 */
function inicializarLoginNativo() {
    const hiddenInput = document.getElementById('hidden-pin-input');
    const pinDots = document.querySelectorAll('.pin-dot');
    const pinDisplay = document.querySelector('.pin-display');
    const errorMessage = document.getElementById('error');
    const loader = document.getElementById('loader');

    if (!hiddenInput) return; // Si no está en la página, no hacer nada

    let currentPin = '';

    function focusInput() {
        hiddenInput.focus();
    }

    // Forza el foco al cargar y al tocar la pantalla
    focusInput();
    document.body.addEventListener('click', () => {
        // Solo re-enfocar si el login es visible
        if (document.getElementById('login').style.display === 'grid') {
            focusInput();
        }
    });
    document.body.addEventListener('touchstart', () => {
        if (document.getElementById('login').style.display === 'grid') {
            focusInput();
        }
    });

    hiddenInput.addEventListener('input', (e) => {
        currentPin = e.target.value.trim();

        if (currentPin.length > 4) {
            currentPin = currentPin.substring(0, 4);
            e.target.value = currentPin;
        }

        updatePinDisplay(currentPin.length);
        vibrate(50); // Vibración en cada dígito

        // Auto-submit al 4to dígito
        if (currentPin.length === 4) {
            hiddenInput.blur(); // Oculta el teclado
            validatePin(currentPin);
        }
    });

    function updatePinDisplay(length) {
        pinDisplay.classList.remove('error');
        errorMessage.classList.remove('visible');

        pinDots.forEach((dot, index) => {
            if (index < length) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    /**
     * Valida el PIN contra el Worker (Apps Script)
     */
    async function validatePin(pin) {
      showLoading(true);
      errorMessage.classList.remove('visible');

      try {
          // ================================================================
          // AQUÍ ESTÁ LA CORRECCIÓN:
          // 1. La 'action' va DENTRO del JSON.
          // 2. La URL_API_BASE se llama limpia (sin ?action=)
          // ================================================================
          const response = await fetch(URL_API_BASE, { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  action: "autenticarVendedor", // <-- La 'action' debe ir aquí
                  pin: pin 
              }) 
          });

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
          // Este 'catch' se activa por el error de CORS (Failed to fetch)
          // O si el JSON está mal (como el <!DOCTYPE>)
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
        vibrate([100, 50, 100]); // Vibración de error

        // Reseteo
        currentPin = '';
        hiddenInput.value = '';
        setTimeout(() => {
            updatePinDisplay(0);
            focusInput(); // Vuelve a poner el foco
        }, 1000);
    }

    function showLoading(isLoading) {
        if (isLoading) {
            loader.classList.add('visible');
            pinDisplay.style.display = 'none';
        } else {
            loader.classList.remove('visible');
            pinDisplay.style.display = 'flex';
        }
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
    🎨 Temas (Tu código)
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
    🧭 Navegación (Tu código)
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  document.getElementById("seccion-"+s)?.classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`)?.classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
    🚀 App principal (Tu código)
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
    📍 Distancias (Tu código)
================================ */
const toRad = d => d*Math.PI/180;
function distanciaKm(aLat,aLng,bLat,bLng){
  const R=6371, dLat=toRad(bLat-aLat), dLng=toRad(bLng-aLng);
  const A=Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

/* ================================
    🚗 Cargar ruta (Tu código)
================================ */
async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  const estado=document.getElementById("estado");
  cont.innerHTML="⏳ Cargando clientes...";
  try{
    // Las peticiones GET están bien como las tenías
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
    ✅ RENDER CLIENTES (ORDENA POR DISTANCIA) (Tu código)
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
      <div classa="fila">
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
  if(!lat || !lng){
    alert("📍 Este cliente no tiene coordenadas.");
    return;
  }

  const base = "https://www.google.com/maps/dir/?api=1"; // URL de Google Maps actualizada
  const dest = `&destination=${lat},${lng}&travelmode=driving`;
  
  // No pedimos origen, dejamos que Maps use la ubicación actual
  window.open(`${base}${dest}`,"_blank");
}


/* ================================
    🗺️ Mapa (Tu código)
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
    💾 Registrar visita (Tu código)
================================ */
function getClientePorNumero(num){ return clientesData.find(x=>String(x.numero)===String(num)); }

async function registrarVisita(numero){
  mostrarExito(); // Tu overlay de éxito
  const visitado = document.getElementById(`btn-visita-${numero}`)?.classList.contains("hecho");
  const compro    = document.getElementById(`btn-compro-${numero}`)?.classList.contains("hecho");
  const comentario=(document.getElementById(`coment-${numero}`)?.value||"").trim();

  const c=getClientePorNumero(numero);
  const vendedor=localStorage.getItem("vendedorClave");

  c.bloqueado=true;
  renderClientes(); // REPINTA AUTOMÁTICO

  // 'params' ahora es un objeto simple, no URLSearchParams
  const params = {
      action:"registrarVisita",
      numero:c.numero,
      nombre:c.nombre,
      direccion:c.direccion||"",
      localidad:c.localidad||"",
      visitado: visitado.toString(), // Convertir a string
      compro: compro.toString(),   // Convertir a string
      comentario,
      vendedor
  };
  
  // ================================================================
  // AQUÍ ESTÁ LA CORRECCIÓN:
  // 1. La 'action' va DENTRO del JSON (params ya la tiene).
  // 2. La URL_API_BASE se llama limpia.
  // ================================================================
  try{ 
    await fetch(URL_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params) // Enviamos el objeto 'params' directamente
    });
  
  } catch(e) { 
    queueOffline({t:"visita",params:params}); 
  }
}

/* ================================
    🔔 Overlay Éxito (Tu código)
================================ */
function mostrarExito(){
  const prev=document.querySelector(".exito-overlay"); if(prev) prev.remove();
  const wrap=document.createElement("div");
  wrap.className="exito-overlay";
  
  // (Tu HTML de overlay de éxito)
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
    📶 Cola Offline (Tu código)
================================ */
function queueOffline(item){ const k="offlineQueue"; let q=JSON.parse(localStorage.getItem(k)||"[]"); q.push(item); localStorage.setItem(k,JSON.stringify(q)); }
async function syncOffline(){}

/* ================================
    📈 Resumen (Tu código - A completar)
================================ */
async function cargarResumen(clave){
  // (Aquí iría tu lógica para llamar a getResumenVendedor y pintar el chart)
}

/* ================================
    📅 Calendario (Tu código - A completar)
================================ */
async function cargarCalendario(clave){
  // (Aquí iría tu lógica para llamar a getCalendarioVisitas)
} 

/* ================================
    🔔 Notificaciones (Tu código - A completar)
================================ */
function inicializarNotificaciones(clave){} 
function notificacionDiaria(){}
function detectarClienteCercano(clave, clientesHoy){}
function toast(msg){}

/* Exponer funciones al window (Tu código) */
// (Ya no necesitamos exponer agregarDigito ni borrarDigito)
window.login = null; // Se maneja internamente
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.registrarVisita=registrarVisita;
window.irCliente=irCliente;
window.aplicarTema = aplicarTema;
window.toggleModoOscuro = toggleModoOscuro;
window.toggleTemaMenu = toggleTemaMenu;
