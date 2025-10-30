const URL_API = "https://script.google.com/macros/s/AKfycbzqPMRir2VCB_C_EUsa0o8-eYCRDM4AQLsY3Jx_5jRKkYi-D2WgTEkTFrBIRFugT5MW/exec";
const contenedor = document.getElementById("contenedor");
const estado = document.getElementById("estado");

fetch(URL_API)
  .then(r => r.json())
  .then(data => {
    estado.textContent = `Datos cargados (${data.total} registros - última actualización: ${new Date(data.fechaActualizacion).toLocaleString()})`;
    mostrarResumen(data.datos);
    mostrarPedidos(data.datos);
  })
  .catch(err => {
    estado.textContent = "❌ Error al cargar los datos";
    console.error(err);
  });

function mostrarResumen(pedidos) {
  const totalPedidos = pedidos.length;
  const vendedores = {};
  const clientes = new Set();
  const pedidosPorDia = {};

  pedidos.forEach(p => {
    clientes.add(p.cliente);
    vendedores[p.vendedor] = (vendedores[p.vendedor] || 0) + 1;
    const fecha = p.fecha.split("T")[0];
    pedidosPorDia[fecha] = (pedidosPorDia[fecha] || 0) + 1;
  });

  const topVendedor = Object.entries(vendedores).sort((a, b) => b[1] - a[1])[0];
  const ultimosDias = Object.keys(pedidosPorDia).slice(-7);
  const promedioPorDia = Math.round(Object.values(pedidosPorDia).reduce((a, b) => a + b, 0) / ultimosDias.length);

  const resumen = document.createElement("section");
  resumen.className = "resumen";
  resumen.innerHTML = `
    <h2>📈 Resumen Inteligente</h2>
    <p><strong>Total pedidos:</strong> ${totalPedidos}</p>
    <p><strong>Total clientes:</strong> ${clientes.size}</p>
    <p><strong>Top vendedor:</strong> ${topVendedor ? topVendedor[0] + " (" + topVendedor[1] + " pedidos)" : "—"}</p>
    <p><strong>Promedio pedidos/día:</strong> ${promedioPorDia}</p>
  `;
  contenedor.prepend(resumen);
}

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
