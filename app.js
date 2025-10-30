const URL_API = "https://script.google.com/macros/s/AKfycbzqPMRir2VCB_C_EUsa0o8-eYCRDM4AQLsY3Jx_5jRKkYi-D2WgTEkTFrBIRFugT5MW/exec";
const contenedor = document.getElementById("contenedor");
const estado = document.getElementById("estado");

// Llama al API y muestra los datos
fetch(URL_API)
  .then(r => r.json())
  .then(data => {
    estado.textContent = `Datos cargados (${data.total} registros - última actualización: ${new Date(data.fechaActualizacion).toLocaleString()})`;
    mostrarPedidos(data.datos);
  })
  .catch(err => {
    estado.textContent = "❌ Error al cargar los datos";
    console.error(err);
  });

function mostrarPedidos(pedidos) {
  pedidos.slice(-20).reverse().forEach(p => {
    const div = document.createElement("div");
    div.className = "pedido";
    div.innerHTML = `
      <h3>🧾 ${p.vendedor} → Cliente ${p.cliente}</h3>
      <p><strong>Fecha:</strong> ${p.fecha}</p>
      <p><strong>Texto Pedido:</strong><br>${p.texto}</p>
    `;
    contenedor.appendChild(div);
  });
}
