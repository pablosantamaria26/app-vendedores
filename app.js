const API = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";
let vendedor = null;
let cartera = [];

function login(){
  const clave = document.getElementById("claveInput").value.trim();
  fetch(API,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({accion:"login", clave})
  })
  .then(r=>r.json())
  .then(d=>{
    if(!d.ok) return alert("Clave incorrecta");
    vendedor = d.vendedor;
    localStorage.setItem("clave", clave);
    document.getElementById("login-screen").style.display="none";
    document.getElementById("app-screen").style.display="block";
    cargarRuta();
  });
}

function cargarRuta(){
  navigator.geolocation.getCurrentPosition(pos=>{
    fetch(API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        accion:"getRutaDelDia",
        clave: localStorage.getItem("clave"),
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      })
    })
    .then(r=>r.json())
    .then(d=>{
      cartera = d.cartera;
      renderLista();
    });
  });
}

function renderLista(){
  const total = cartera.length;
  const visitados = cartera.filter(c=>c.estado).length;
  const compraron = cartera.filter(c=>c.estado==="compro").length;
  const avance = (visitados/total)*100;

  document.getElementById("headerTitle").innerHTML = vendedor+" — Ruta de hoy";
  document.getElementById("progressInfo").innerHTML = `Visitaste ${visitados}/${total} clientes — Compraron ${compraron}`;
  document.getElementById("coachMsg").innerHTML = coach(avance);

  let html="";
  cartera.forEach((c,i)=>{
    const cls = c.estado || "sin-visitar";
    html+=`
      <div class="card ${cls}">
        <strong>${c.nombre}</strong><br>
        📍 ${c.domicilio} — ${c.localidad}<br>
        ${c.distancia?`🛣 ${c.distancia.toFixed(1)} km`:``}
        <button onclick="marcar(${i})">Registrar Visita</button>
      </div>
    `;
  });
  document.getElementById("listaClientes").innerHTML = html;
}

function marcar(i){
  const c = cartera[i];
  const compro = confirm(`¿${c.nombre} compró? Aceptar = Sí / Cancelar = No`);
  let motivo="";
  if(!compro){
    motivo = prompt("Motivo:\nNo estaba / Sin dinero / Otra distribuidora / No necesita / Otro","No estaba") || "";
  }
  const notas = prompt("Notas adicionales (opcional):","") || "";

  fetch(API,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      accion:"registrarVisita",
      vendedor,
      cliente:c.numero,
      compro,
      motivo,
      notas
    })
  });

  cartera[i].estado = compro?"compro":"no-compro";
  renderLista();
}

function coach(p){
  if(p<20) return "Arrancamos 💪 Vamos con todo.";
  if(p<50) return "Buen ritmo 🚀 Seguimos.";
  if(p<80) return "Más de la mitad 🔥 Vamos!";
  if(p<100) return "Últimos clientes 💥 No aflojes.";
  return "¡JORNADA COMPLETA! 🎉 Excelente trabajo.";
}

/* Tema */
function setTheme(name){
  document.body.classList.remove("theme-foco","theme-ruta","theme-fuerza");
  document.body.classList.add("theme-"+name);
  localStorage.setItem("tema",name);
}
(function restoreTheme(){
  setTheme(localStorage.getItem("tema")||"foco");
})();
