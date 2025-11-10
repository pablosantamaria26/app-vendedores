const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let clave = "";
let clientes = [];
let visitados = 0;

/**************
 * LOGIN
 **************/
document.getElementById("btnLogin").onclick = async () => {
  clave = document.getElementById("inputClave").value.trim();
  if (!clave) return alert("Ingresá tu clave");

  obtenerUbicacion().then(({ lat, lng }) => {
    cargarRuta(lat, lng);
  });
};

/**************
 * THEMES
 **************/
document.querySelectorAll(".tema-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.body.className = btn.dataset.tema;
  });
});

/**************
 * LIMPIAR NOMBRE
 **************/
function limpiarNombreCliente(nombre) {
  const match = nombre.match(/\((.*?)\)\s*(.*)/);
  if (match) return { fantasia: match[2].trim(), persona: match[1].trim() };
  return { fantasia: nombre.trim(), persona: "" };
}

/**************
 * OBTENER UBICACIÓN
 **************/
function obtenerUbicacion(){
  return new Promise(resolve=>{
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat:pos.coords.latitude, lng:pos.coords.longitude}),
      ()  => resolve({lat:null,lng:null}),
      {enableHighAccuracy:true, timeout:5000}
    );
  });
}

/**************
 * CARGAR RUTA
 **************/
async function cargarRuta(lat,lng){
  const r = await fetch(`${WORKER_URL}?accion=getRutaDelDia&clave=${clave}&lat=${lat}&lng=${lng}`);
  const data = await r.json();

  clientes = data.cartera || [];
  visitados = 0;

  document.getElementById("login").classList.add("hidden");
  document.getElementById("estado").classList.remove("hidden");
  document.getElementById("listaClientes").classList.remove("hidden");

  renderLista();
}

/**************
 * RENDER LISTA
 **************/
function renderLista(){
  document.getElementById("progresoTexto").innerText = `Visitaste ${visitados} de ${clientes.length}`;

  const cont = document.getElementById("listaClientes");
  cont.innerHTML = "";

  clientes.forEach(cli => {
    const { fantasia, persona } = limpiarNombreCliente(cli.nombre);

    const div = document.createElement("div");
    div.className = "cliente-card";

    div.innerHTML = `
      <div class="nombre">${fantasia || cli.nombre}</div>
      <div class="persona">${persona || ""}</div>
      <div class="dom">${cli.domicilio} – ${cli.localidad}</div>
      <textarea placeholder="Notas..." class="nota-input"></textarea>

      <div class="btn-row">
        <button class="btn visitar">Sin visitar</button>
        <button class="btn compro hidden">Compró ✅</button>
        <button class="btn nocompro hidden">No compró ❌</button>
      </div>
    `;

    const nota = div.querySelector(".nota-input");
    const btnVisitar = div.querySelector(".visitar");
    const btnCompro = div.querySelector(".compro");
    const btnNoCompro = div.querySelector(".nocompro");

    btnVisitar.onclick = () => {
      btnVisitar.classList.add("hidden");
      btnCompro.classList.remove("hidden");
      btnNoCompro.classList.remove("hidden");
    };

    btnCompro.onclick = () => guardarVisita(cli.numeroCliente, true, nota.value);
    btnNoCompro.onclick = () => guardarVisita(cli.numeroCliente, false, nota.value);

    cont.appendChild(div);
  });
}

/**************
 * GUARDAR VISITA
 **************/
async function guardarVisita(cliente, compro, notas){
  await fetch(WORKER_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      accion:"registrarVisita",
      vendedor:clave,
      cliente,
      compro,
      notas
    })
  });

  visitados++;
  renderLista();
}
