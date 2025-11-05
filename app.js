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
  document.getElementById("login").style.display="none";
  mostrarApp();
}
function logout(){ localStorage.removeItem("vendedorClave"); location.reload(); }

window.addEventListener("load",()=>{
  const c=localStorage.getItem("vendedorClave");
  if(c && vendedores[c]){ document.getElementById("login").style.display="none"; mostrarApp(); }
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
  m.classList.toggle("visible");
  const close=()=>{ m.classList.remove("visible"); document.removeEventListener("click", close); };
  setTimeout(()=>document.addEventListener("click", close), 0);
}
function aplicarTema(clase){
  document.body.className = clase;
  localStorage.setItem("temaPreferido", clase);
}
function restaurarTema(){
  aplicarTema(localStorage.getItem("temaPreferido")||"tema-confianza");
}
function toggleModoOscuro(){
  const actual=document.body.classList.contains("tema-foco");
  aplicarTema(actual ? "tema-confianza" : "tema-foco");
}

/* ================================
   🧭 Navegación
================================ */
function mostrarSeccion(s){
  document.querySelectorAll(".seccion").forEach(sec=>sec.classList.remove("visible"));
  document.getElementById("seccion-"+s).classList.add("visible");
  document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("activo"));
  document.querySelector(`.menu button[onclick="mostrarSeccion('${s}')"]`).classList.add("activo");
  if(s==="mapa") renderMapaFull();
}

/* ================================
   🚀 App principal
================================ */
async function mostrarApp(){
  const clave=localStorage.getItem("vendedorClave");
  document.getElementById("titulo").textContent=`👋 Hola, ${vendedores[clave]}`;

  const clientesHoy=await cargarRuta(clave);
  await cargarResumen(clave);
  await cargarCalendario();
  inicializarNotificaciones(clave);

  if(clientesHoy?.length) detectarClienteCercano(clave, clientesHoy);
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
   🗂️ Orden (por vendedor)
================================ */
function keyOrden(){ return "ordenClientes_"+localStorage.getItem("vendedorClave"); }
function cargarOrden(){ try{return JSON.parse(localStorage.getItem(keyOrden())||"[]");}catch{return[];} }
function guardarOrden(ids){ localStorage.setItem(keyOrden(), JSON.stringify(ids)); }

/* ================================
   🚗 Cargar ruta del día
================================ */

async function cargarRuta(clave){
  const cont=document.getElementById("contenedor");
  const estado=document.getElementById("estado");
  if(cont) cont.innerHTML="⏳ Cargando clientes...";

  try{
    const r = await fetch(`${URL_API_BASE}?accion=getRutaDelDiaPorVendedor&clave=${clave}`);
    clientesData = await r.json();

    // Distancia + render
    const afterGeo = () => {
      ordenarPorDistancia();
      aplicarOrdenManualSiExiste();   // 👈 nuevo
      renderClientes();
      if(estado){
        const ahora=new Date().toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"});
        estado.textContent=`Ruta cargada (${clientesData.length} clientes) — Última actualización: ${ahora}`;
      }
    };

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos => { posicionActual={lat:pos.coords.latitude,lng:pos.coords.longitude}; afterGeo(); },
        () => afterGeo(),
        {enableHighAccuracy:true, maximumAge:15000, timeout:8000}
      );
    } else { afterGeo(); }

    return clientesData;
  }catch(e){
    console.error("❌ Error al cargar datos:", e);
    if(estado) estado.textContent="❌ Error al cargar datos.";
    return [];
  }
}

function ordenarPorDistancia(){
  if(!posicionActual) return;
  clientesData.sort((a,b)=>{
    const da = (Number.isFinite(+a.lat)&&Number.isFinite(+a.lng)) ? distanciaKm(posicionActual.lat,posicionActual.lng,+a.lat,+a.lng) : Number.POSITIVE_INFINITY;
    const db = (Number.isFinite(+b.lat)&&Number.isFinite(+b.lng)) ? distanciaKm(posicionActual.lat,posicionActual.lng,+b.lat,+b.lng) : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

// Aplica el orden arrastrado si existe
function aplicarOrdenManualSiExiste(){
  const orden = cargarOrden(); // ['123','456',...]
  if(!Array.isArray(orden) || !orden.length) return;
  const map = new Map(clientesData.map(c=>[String(c.numero), c]));
  const reordenados = orden.map(id=>map.get(String(id))).filter(Boolean);
  const restantes = clientesData.filter(c=>!orden.includes(String(c.numero)));
  clientesData = [...reordenados, ...restantes];
}


/* ================================
   🧱 Render tarjetas
================================ */
function renderClientes(){
  const cont=document.getElementById("contenedor");
  cont.innerHTML="";

  clientesData.forEach((c,idx)=>{
    const lat=parseFloat(c.lat), lng=parseFloat(c.lng);
    const dist=(posicionActual)? distanciaKm(posicionActual.lat,posicionActual.lng,lat,lng) : null; c._dist = dist;

    cont.insertAdjacentHTML("beforeend",`
      <div class="cliente" id="c_${c.numero}">
        <h3>${c.numero} - ${c.nombre}</h3>
        <div class="fila">
          <span>📍 ${c.direccion||""}</span>
          ${dist?`<span class="badge">📏 ${dist.toFixed(1)} km</span>`:""}
        </div>

        <div class="fila check-grande">
          <button onclick="toggleVisita(${c.numero})" id="btnV_${c.numero}" class="btn-visita">No Visitado</button>
          <button onclick="toggleCompra(${c.numero})" id="btnC_${c.numero}" class="btn-compra">No Compró</button>
        </div>

        <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>

        <div class="acciones">
          <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
          <button class="btn-secundario" onclick="irCliente(${lat},${lng})">🚗 Ir</button>
        </div>
      </div>
    `);
  });
}

/* ================================
   ✅ Botones táctiles (no checkbox)
================================ */
function toggleVisita(n){
  const b=document.getElementById("btnV_"+n);
  b.classList.toggle("on");
  b.textContent = b.classList.contains("on") ? "Visitado ✅" : "No Visitado";
}
function toggleCompra(n){
  const b=document.getElementById("btnC_"+n);
  b.classList.toggle("on");
  b.textContent = b.classList.contains("on") ? "Compró 🛍️" : "No Compró";
}

/* ================================
   💾 Registrar visita
================================ */
async function registrarVisita(num){
  const c = clientesData.find(x=>x.numero==num);
  const visitado = document.getElementById("btnV_"+num).classList.contains("on");
  const compro   = document.getElementById("btnC_"+num).classList.contains("on");
  const comentario = document.getElementById(`coment-${num}`).value;

  await fetch(`${URL_API_BASE}?accion=registrarVisita&numero=${num}&vendedor=${localStorage.getItem("vendedorClave")}&nombre=${c.nombre}&direccion=${c.direccion}&localidad=${c.localidad}&visitado=${visitado}&compro=${compro}&comentario=${encodeURIComponent(comentario)}`);

  if(visitado && compro){
    clientesData = clientesData.filter(x=>x.numero!=num).concat([c]);
  }
  renderClientes();
  registrarInteraccionIA("✅ Visita registrada. ¡Seguimos!");

}

/* ================================
   🚗 Ir al mapa
================================ */
function irCliente(lat,lng){ if(lat&&lng) window.open(`https://www.google.com/maps?q=${lat},${lng}`); }

/* ================================
   🌤️ IA minimalista (notificación suave)
================================ */
function mostrarConsejoIA(txt){
  if(Notification.permission==="granted"){
    new Notification("💡 Consejo", { body:txt, icon:"ml-icon-192.png" });
  }
}

/* ================================
   📡 Inicializar notificaciones
================================ */
function inicializarNotificaciones(v){ /* se mantiene igual */ }
function syncOffline(){ /* se mantiene igual */ }
function cargarResumen(){ /* se mantiene igual */ }
function cargarCalendario(){ /* se mantiene igual */ }
function notificacionDiaria(){ /* se mantiene igual */ }
function detectarClienteCercano(){ /* se mantiene igual */ }

/* ================================
   🌍 Mapa
================================ */
function renderMapaFull(){ /* sin cambios */ }


/* =========================================================
   🧠 IA — Reglas Simples y Consejos
========================================================= */

function generarConsejosIA(clientes){
  const consejos = [];

  clientes.forEach(c => {

    // 🔥 Cliente con alta probabilidad de compra hoy
    if(c.frecuenciaCompraDias && c.ultCompraDias >= c.frecuenciaCompraDias - 1){
      consejos.push(`🟢 Hoy ${c.nombre} está listo para mover mercadería. ¡Pasá y cerrá venta! 💥`);
    }

    // ⏱️ Cliente olvidado / dormido
    if(c.ultCompraDias && c.frecuenciaCompraDias && c.ultCompraDias > c.frecuenciaCompraDias * 2){
      consejos.push(`🕓 ${c.nombre} hace rato que no compra (${c.ultCompraDias} días). ¡Es hoy o nunca! Traé tu mejor charla 💬🔥`);
    }

    // 🏆 Cliente clave / rentable
    if(c.esClienteClave){
      consejos.push(`⭐ ${c.nombre} es de los que te suben el promedio. Pasalo temprano mientras tenés energía 💪😎`);
    }

    // 🎯 Cliente cerca + fresco para romper hielo
    if(c._dist && c._dist < 1.2){
      consejos.push(`🚶‍♂️ ${c.nombre} está cerquita (${c._dist.toFixed(1)} km). Pasá a ganar ritmo y arrancar el día con confianza ⚡`);
    }

  });

  // Si no hubo nada especial, motivación base
  if(consejos.length === 0){
    consejos.push(`✨ Todo tranqui por ahora. Vos marcás el ritmo hoy. ¡Vamos con actitud vendedor callejero premium! 😎🔥`);
  }

  // Mezclar un poco para que no siempre salga igual
  return consejos.sort(() => Math.random() - 0.5);
}


/* =========================================================
   💡 Mostrar consejos en el panel IA
========================================================= */
function actualizarPanelIA(){
  const panel = document.getElementById("iaPanel");
  if(!panel) return;

  const consejos = generarConsejosIA(clientesData);

  panel.innerHTML = "";

  if(!consejos.length){
    panel.innerHTML = `<div class="bubble-ia">✨ Sin recomendaciones por ahora. Buen ritmo.</div>`;
    return;
  }

  consejos.forEach(texto=>{
    const div = document.createElement("div");
    div.className = "bubble-ia";
    div.textContent = texto;
    panel.appendChild(div);
  });
}

// Opcional: cuando el vendedor toca algo que demuestra acción → mostramos motivación
function registrarInteraccionIA(texto){
  const panel = document.getElementById("iaPanel");
  const div = document.createElement("div");
  div.className = "bubble-user";
  div.textContent = texto;
  panel.appendChild(div);
  panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
}


/* =========================================================
   🔔 Alertas automáticas IA (cuando hay algo importante)
========================================================= */
function alertasIA(){
  const consejos = generarConsejosIA(clientesData);

  // Solo disparar alertas si hay algo importante
  const alertaClave = consejos.find(c => c.includes("⚠️") || c.includes("⭐"));

  if(alertaClave){
    mostrarConsejoIA(alertaClave);
  }
}

/* =========================================================
   🟢 Integración automática al cargar la ruta
========================================================= */
const _cargarRutaOriginal = cargarRuta;
cargarRuta = async function(clave){
  const data = await _cargarRutaOriginal(clave);
  actualizarPanelIA();
  alertasIA();
  return data;
};


/* ================================
   🔗 Exponer funciones
================================ */
window.agregarDigito=agregarDigito;
window.borrarDigito=borrarDigito;
window.login=login;
window.logout=logout;
window.mostrarSeccion=mostrarSeccion;
window.registrarVisita=registrarVisita;
window.irCliente=irCliente;
window.toggleModoOscuro=toggleModoOscuro;
window.toggleTemaMenu=toggleTemaMenu;
window.aplicarTema=aplicarTema;
window.toggleVisita = toggleVisita;
window.toggleCompra = toggleCompra;
