const WORKER_URL = "https://frosty-term-20ea.santamariapablodaniel.workers.dev";

// ---------------------------
// AUTO LOGIN SI YA ESTÁ
// ---------------------------
window.addEventListener("load", () => {
  let clave = localStorage.getItem("claveVendedor");
  if(clave){ iniciar(clave); }
});

// ---------------------------
// LOGIN
// ---------------------------
const inputClave = document.getElementById("claveInput");
const btnLogin = document.getElementById("btnLogin");

btnLogin.onclick = () => {
  if(inputClave.value.trim().length >= 4){
    iniciar(inputClave.value.trim());
  }
};

inputClave.addEventListener("keyup", (e)=>{
  if(inputClave.value.length === 4) iniciar(inputClave.value.trim());
});

// ---------------------------
// INICIAR APP
// ---------------------------
async function iniciar(clave){
  try{
    const r = await fetch(`${WORKER_URL}?accion=getRutaDelDia&clave=${clave}`);
    const data = await r.json();
    if(!data.ok) return alert("Clave incorrecta");

    localStorage.setItem("claveVendedor", clave);

    // SALUDO
    const vendedor = obtenerVendedor(clave);
    document.getElementById("saludoTexto").innerText =
      `Vamos ${vendedor} 💥 Hoy se gana zona.`;

    document.getElementById("login").classList.add("hidden");
    document.getElementById("saludo").classList.remove("hidden");

    renderLista(data.cartera);
  }catch(err){
    alert("Error conexión");
  }
}

// Trae nombre desde hoja config
function obtenerVendedor(clave){
  if(clave === "0001") return "MARTÍN"; // acá después lo haremos automático
  return "VENDEDOR";
}

// ---------------------------
// RENDER LISTA
// ---------------------------
function renderLista(lista){
  const cont = document.getElementById("listaClientes");
  cont.innerHTML = "";
  cont.classList.remove("hidden");

  document.getElementById("contadorVisitas").innerText =
    `Visitaste 0 de ${lista.length}`;

  lista.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <h4>${c.nombre}</h4>
      <small>${c.domicilio} — ${c.localidad}</small>
      <div class="estado">Sin visitar</div>
    `;
    cont.appendChild(div);
  });
}
