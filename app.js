/*****************************************
 * CONFIG
 *****************************************/
const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";
const CLAVE_MAESTRA = "281730";

let vendedor = null;
let mapa;

/*****************************************
 * LOGIN
 *****************************************/
document.getElementById("pinInput").addEventListener("input", async (e)=>{
  const pin = e.target.value.trim();
  if(pin.length < 4) return;

  const resp = await fetch(WORKER_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ accion:"loginConPin", pin })
  }).then(r=>r.json()).catch(()=> null);

  if(!resp || !resp.ok){
    return showToast("PIN incorrecto");
  }

  vendedor = resp.vendedor;
  localStorage.setItem("vendedorActual", vendedor);

  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("homeScreen").classList.add("active");
  document.getElementById("greeting").textContent = `👋 Buen día, ${vendedor}`;

  cargarCartera();
});

/*****************************************
 * CARGAR CARTERA DESDE WORKER
 *****************************************/
async function cargarCartera(){
  const data = await fetch(WORKER_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ accion:"getDataParaCoach", vendedor })
  }).then(r=>r.json()).catch(()=> null);

  if(!data || !data.ok){
    showToast("Sin conexión");
    return;
  }

  renderMapa(data.cartera);
  renderLista(data.cartera);
}

/*****************************************
 * MAPA
 *****************************************/
function renderMapa(cartera){
  if(!cartera.length) return;

  mapa = new google.maps.Map(document.getElementById("map"), {
    center:{ lat:+cartera[0].lat, lng:+cartera[0].lng },
    zoom: 12
  });

  cartera.forEach(c=>{
    const m = new google.maps.Marker({
      position:{lat:+c.lat,lng:+c.lng},
      map:mapa,
      title:`${c.nombre}`
    });

    m.addListener("click", ()=>{
      showToast(`📍 ${c.nombre}`);
      setTimeout(()=>{
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`,"_blank");
      },800);
    });
  });
}

/*****************************************
 * LISTA + GUARDAR VISITA
 *****************************************/
function renderLista(lista){
  const cont = document.getElementById("routeList");
  cont.innerHTML = "";

  lista.forEach(c=>{
    const div = document.createElement("div");
    div.className = "client-card";

    div.innerHTML = `
      <b>${c.numeroCliente} — ${c.nombre} ${c.apellido||""}</b>
      <small>${c.localidad} — ${c.domicilio}</small>

      <div class="btn-row">
        <div class="btn" onclick="guardarVisita('${c.numeroCliente}','SI')">Compró ✅</div>
        <div class="btn red" onclick="guardarVisita('${c.numeroCliente}','NO')">No compró ❌</div>
      </div>
    `;
    cont.appendChild(div);
  });
}

async function guardarVisita(numeroCliente, compro){
  await fetch(WORKER_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      accion:"guardarVisita",
      vendedor,
      numeroCliente,
      compro
    })
  });

  showToast("Visita guardada ✅");
  cargarCartera();
}

/*****************************************
 * TEMA
 *****************************************/
document.getElementById("themeToggle").onclick = ()=>{
  const d=document.documentElement;
  d.setAttribute("data-theme",
    d.getAttribute("data-theme")==="noche" ? "dia" : "noche"
  );
};

/*****************************************
 * TOAST
 *****************************************/
function showToast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2000);
}
