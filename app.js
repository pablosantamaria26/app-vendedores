/* ================================================
🧠 App de Vendedores — 2026 (UI renovada)
- Temas motivacionales (Confianza / Energía / Foco) con persistencia
- Toast de éxito 80% pantalla (instantáneo, 1s, círculo + tilde)
- Mapa recargable al volver de pestañas + confirm toast para abrir destino
- Lógica intacta (ruta, resumen, calendario, offline queue, FCM, etc.)
- Geofencing básico + notificación diaria (como en tu versión)
================================================= */


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
