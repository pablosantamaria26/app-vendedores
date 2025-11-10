const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let vendedorClave = "";
let vendedorNombre = "";
let datosRuta = [];
let map, markerGroup;

/* === LOGIN === */
document.getElementById("btnIngresar").onclick = iniciar;
document.getElementById("claveInput").addEventListener("keyup", e=>{
  if(e.key==="Enter") iniciar();
});

async function iniciar(){
  vendedorClave = document.getElementById("claveInput").value.trim();
  if(!vendedorClave) return alert("Ingresar clave");

  const url = `${API}?accion=getRutaDelDia&clave=${vendedorClave}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if(!data.ok) return alert("Clave incorrecta");

  datosRuta = data.cartera;
  vendedorNombre = obtenerNombreVendedor();
  
  document.getElementById("login").classList.add("hidden");
  document.getElementById("header").classList.remove("hidden");
  document.getElementById("contenido").classList.remove("hidden");

  cargarLista();
  actualizarProgreso();
}

/* Obtenemos el nombre desde ConfigVendedores, pero como ya lo trae el backend vía rutas, lo tomamos del primer match */
function obtenerNombreVendedor(){
  if(datosRuta.length===0) return "";
  return datosRuta[0].vendedor || (()=>{
    return "Vendedor";
  })();
}

/* === RENDER LISTA === */
function cargarLista(){
  const cont = document.getElementById("listaClientes");
  cont.innerHTML = "";

  datosRuta.forEach((c,i)=>{
    const card = document.createElement("div");
    card.className="card";
    card.innerHTML = `
      <h3>${(c.nombre || "").trim()}</h3>
      <small>${c.domicilio} — ${c.localidad}</small>
      <textarea placeholder="Notas..." data-i="${i}"></textarea>
      <div class="estado" data-i="${i}">Sin visitar</div>
      <div class="btnRowHidden" id="btnRow-${i}">
        <div class="btnRow">
          <button data-act="si" data-i="${i}">COMPRÓ</button>
          <button data-act="no" data-i="${i}">NO COMPRÓ</button>
        </div>
      </div>
    `;
    cont.appendChild(card);
  });

  cont.onclick = manejarClickTarjetas;
}

function manejarClickTarjetas(e){
  if(e.target.classList.contains("estado")){
    const i = e.target.dataset.i;
    document.getElementById(`btnRow-${i}`).className="btnRow";
  }

  if(e.target.dataset.act==="si"){
    guardarVisita(e.target.dataset.i, true);
  }

  if(e.target.dataset.act==="no"){
    abrirMotivo(e.target.dataset.i);
  }
}

/* === MODAL MOTIVO === */
let indexMotivo = null;
document.getElementById("motivoSelect").onchange = ()=>{
  document.getElementById("motivoOtro").classList.toggle("hidden",
    document.getElementById("motivoSelect").value!=="Otro"
  );
};
document.getElementById("btnCancelarMotivo").onclick = ()=> cerrarMotivo();

document.getElementById("btnGuardarMotivo").onclick = ()=>{
  const motivoSel = document.getElementById("motivoSelect").value;
  const otro = document.getElementById("motivoOtro").value.trim();
  const finalMotivo = motivoSel==="Otro" ? otro : motivoSel;

  guardarVisita(indexMotivo,false,finalMotivo);
  cerrarMotivo();
};

function abrirMotivo(i){
  indexMotivo = i;
  document.getElementById("modalMotivo").classList.remove("hidden");
}
function cerrarMotivo(){
  document.getElementById("modalMotivo").classList.add("hidden");
}

/* === GUARDAR VISITA === */
async function guardarVisita(i, compro, motivo=""){
  const cliente = datosRuta[i];
  const notas = document.querySelector(`textarea[data-i="${i}"]`).value;

  await fetch(API, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      accion:"registrarVisita",
      vendedor:vendedorNombre,
      cliente:cliente.numeroCliente,
      compro,
      motivo,
      notas
    })
  });

  // mover tarjeta
  const item = datosRuta.splice(i,1)[0];
  datosRuta.push(item);
  cargarLista();
  actualizarProgreso();
}

/* === PROGRESO === */
function actualizarProgreso(){
  const total = datosRuta.length;
  const visitados = total - datosRuta.length;
  document.getElementById("progreso").innerText = `Visitaste ${visitados} de ${total}`;
}

/* === MAPA === */
document.getElementById("btnVerMapa").onclick = mostrarMapa;
document.getElementById("btnCerrarMapa").onclick = ()=>{
  document.getElementById("mapaContainer").classList.add("hidden");
};

function mostrarMapa(){
  document.getElementById("mapaContainer").classList.remove("hidden");

  if(!map){
    map = L.map('map').setView([-34.85,-58.39], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19
    }).addTo(map);
    markerGroup = L.layerGroup().addTo(map);
  }

  markerGroup.clearLayers();
  datosRuta.forEach(c=>{
    if(c.lat && c.lng){
      L.marker([c.lat,c.lng]).addTo(markerGroup)
        .bindPopup(`<b>${c.nombre}</b><br>${c.domicilio}`);
    }
  });
}

/* === TEMAS === */
document.querySelectorAll("#temas button").forEach(btn=>{
  btn.onclick = ()=> {
    document.body.className = btn.dataset.theme;
  }
});
