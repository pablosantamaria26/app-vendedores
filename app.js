// WORKER URL
const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

let vendedorClave = "";
let lista = [];
let visitas = {};

const $ = (id) => document.getElementById(id);

window.onload = () => {
  cargarTemaGuardado();
  $("btnLogin").onclick = login;
  document.querySelectorAll(".theme-btn").forEach(btn =>
    btn.onclick = () => setTema(btn.dataset.theme)
  );
};

async function login() {
  vendedorClave = $("claveInput").value.trim();
  if (!vendedorClave) return alert("Ingresá tu clave");

  const res = await fetch(API + "?accion=getRutaDelDia&clave=" + vendedorClave);
  const data = await res.json();

  if (!data.ok) return alert("Clave incorrecta");

  lista = data.cartera || [];
  $("loginView").style.display = "none";
  $("rutaView").style.display = "block";
  render();
  actualizarMotivador();
}

function render() {
  const cont = $("listaClientes");
  cont.innerHTML = "";

  lista.forEach(cli => {
    const id = cli.numeroCliente;
    const visitado = visitas[id]?.estado || "no";
    const compro = visitas[id]?.compro || false;

    cont.innerHTML += `
      <div class="card">
        <h3>${cli.nombre}</h3>
        <small>${cli.domicilio} — ${cli.localidad}</small>
        <textarea id="n_${id}" placeholder="Notas..."></textarea>

        <div id="b_${id}" class="btn-line ${visitado === "si" ? "btn-active" : ""}" 
          onclick="toggleVisita('${id}')">
          ${visitado === "si" ? "Visitado" : "Sin visitar"}
        </div>

        ${visitado === "si" ? `
          <div class="btn-line ${compro ? "btn-active" : ""}" 
            onclick="toggleCompra('${id}')">
            ${compro ? "Compró ✅" : "No compró"}
          </div>

          <div class="btn-line" onclick="guardarVisita('${id}')">Guardar visita</div>
        `:''}
      </div>
    `;
  });

  actualizarMotivador();
}

/* interacción */
function toggleVisita(id){
  visitas[id] = visitas[id] || {};
  visitas[id].estado = visitas[id].estado === "si" ? "no" : "si";
  render();
}

function toggleCompra(id){
  visitas[id] = visitas[id] || {};
  visitas[id].compro = !visitas[id].compro;
  render();
}

/* guardar en backend */
async function guardarVisita(id){
  const cli = lista.find(x=>x.numeroCliente===id);
  const notas = $("n_"+id).value.trim();
  const compro = visitas[id]?.compro || false;

  await fetch(API,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      accion:"registrarVisita",
      vendedor:vendedorClave,
      cliente:id,
      compro,
      notas
    })
  });

  alert("Visita guardada ✅");
}

/* motivador */
function actualizarMotivador(){
  const total = lista.length;
  const hechos = Object.values(visitas).filter(v=>v.estado==="si").length;
  $("progressText").innerText = `Visitaste ${hechos} de ${total}`;
}

/* temas */
function setTema(t){
  document.body.className = t;
  localStorage.setItem("temaVendedores",t);
}
function cargarTemaGuardado(){
  const t = localStorage.getItem("temaVendedores") || "foco";
  document.body.className = t;
}
