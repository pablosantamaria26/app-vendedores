/* ================================
   ⚙️ Config principal
================================ */
// ... existing code ... -->
const URL_API_BASE = "https://frosty-term-20ea.santamariapablodaniel.workers.dev/";

// ✨ Clave de API de Gemini (debe ser creada en Google AI Studio)
// Dejar vacía, el Creador la proveerá.
const API_KEY = "";

// Estado global de la app
let clientesData = []; // Clientes de la ruta del DÍA
// ... existing code ... -->
  await Promise.all([
    cargarRuta(clave),
    cargarResumen(clave),
    cargarCalendario(),
    // cargarConsejosIA(clave), // Se elimina, ahora se activa por botón
    setupBuscador(clave) // Configura el buscador
  ]);

  // Inicializar notificaciones
// ... existing code ... -->
function renderClientes() {
  const cont = document.getElementById("contenedor"); if (!cont) return;
  cont.innerHTML = "";

  clientesData.forEach((c, idx) => {
// ... existing code ... -->
    const dist = (posicionActual && tieneGeo) ? distanciaKm(posicionActual.lat, posicionActual.lng, lat, lng) : null;

    card.innerHTML = `
      <h3>${c.numero} - ${c.nombre}</h3>
      <div class="fila">
        <span>📍 ${c.direccion || ""} (${c.localidad || 'N/D'})</span>
        ${dist !== null ? `<span class="badge">📏 ${dist.toFixed(1)} km</span>` : ""}
      </div>
      <div class="fila" style="margin-top:10px; justify-content: space-around;">
        <label><input type="checkbox" id="visitado-${c.numero}"> Visitado</label>
        <label><input type="checkbox" id="compro-${c.numero}"> Compró</label>
      </div>
      <textarea id="coment-${c.numero}" placeholder="Comentario..." rows="2"></textarea>
      <div class="acciones">
        <button onclick="registrarVisita(${c.numero})">💾 Guardar</button>
        <button class="btn-ia" onclick="prepararVisita('${c.numero}')" title="Preparar visita con IA">✨ Preparar</button>
        <button class="btn-secundario" onclick="irCliente(${tieneGeo ? lat : "null"},${tieneGeo ? lng : "null"}, '${c.direccion}, ${c.localidad}')">🚗 Ir</button>
      </div>`;

    // DnD
    card.setAttribute("draggable", "true");
// ... existing code ... -->
    cont.appendChild(card);
  });
}

/* ================================
// ... existing code ... -->
  renderizarResumenUI();
}

/* ================================
   🤖 Coach de Ventas IA (Nuevo)
================================ */
async function runCoachIA() {
  const btn = document.getElementById("btnCoachIA");
  const msg = document.getElementById("coachIA-mensaje");
  if (!btn || !msg) return;

  btn.disabled = true;
  msg.innerHTML = '<div class="spinner" style="width:20px; height:20px; margin: 0 auto; border-width: 3px;"></div>';

  const prompt = `Soy un vendedor. Hoy visité ${statLocal.visitas} clientes y ${statLocal.compraron} compraron. Mi tasa de conversión es ${statLocal.tasa}. Dame un consejo motivacional y accionable de una sola línea para mejorar mañana.`;
  
  try {
    const respuesta = await callGemini(prompt);
    msg.textContent = respuesta;
  } catch (e) {
    console.error("Error en Coach IA:", e);
    msg.textContent = "Error al contactar al coach. Intenta de nuevo.";
  } finally {
    btn.disabled = false;
  }
}

/* ================================
   📅 Calendario
// ... existing code ... -->
  }
}

/* ================================
   ✨ Funciones de Gemini API (Nuevas)
================================ */

/**
 * Muestra el modal de IA
 * @param {string} titulo - El título del modal
 * @param {string} contenido - HTML para el cuerpo (puede ser spinner)
 */
function mostrarModalIA(titulo, contenido) {
  const modal = document.getElementById("modal-ia");
  if (modal) {
    document.getElementById("modal-ia-titulo").textContent = titulo;
    document.getElementById("modal-ia-body").innerHTML = contenido;
    modal.classList.add("visible");
  }
}

/**
 * Cierra el modal de IA
 */
function cerrarModalIA() {
  const modal = document.getElementById("modal-ia");
  if (modal) {
    modal.classList.remove("visible");
  }
}

/**
 * Prepara la visita usando Gemini
 * @param {string} numero - El número de cliente
 */
async function prepararVisita(numero) {
  const c = clientesData.find(x => String(x.numero) === String(numero));
  if (!c) {
    toast("❌ Cliente no encontrado");
    return;
  }

  const spinner = '<div class="spinner"></div><p style="text-align:center;">Analizando historial...</p>';
  mostrarModalIA(`Preparando visita: ${c.nombre}`, spinner);

  // ✨ Accedemos a los datos extra que pedimos al backend
  const prompt = `
    Eres un coach de ventas experto para un vendedor de productos de limpieza/consumo masivo.
    Voy a visitar a este cliente:
    - Nombre: ${c.nombre}
    - Localidad: ${c.localidad}
    - Dirección: ${c.direccion}
    - Última Visita: ${c.ultimaVisita || 'Sin registro'}
    - Último Pedido: ${c.ultimoPedido || 'Sin registro'}

    Dame 3 consejos en viñetas (formato HTML <ul><li>...</li></ul>) para esta visita.
    Cada viñeta debe ser breve y accionable.
    1. Un saludo/rompehielos basado en su historial o localidad.
    2. Una sugerencia de venta (upsell/cross-sell) basada en su último pedido o en su ausencia.
    3. Un recordatorio importante o una pregunta clave para hacerle.
  `;

  try {
    const respuesta = await callGemini(prompt);
    document.getElementById("modal-ia-body").innerHTML = respuesta;
  } catch (e) {
    console.error("Error en prepararVisita:", e);
    document.getElementById("modal-ia-body").innerHTML = "<p>Error al generar la preparación. Intenta de nuevo.</p>";
  }
}

/**
 * Función central para llamar a la API de Gemini
 * @param {string} prompt - El prompt para enviar
 * @returns {Promise<string>} - La respuesta de texto del modelo
 */
async function callGemini(prompt) {
  // Usamos el modelo gemini-2.5-flash-preview-09-2025
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  // Implementar reintento con backoff exponencial
  let response;
  let retries = 0;
  const maxRetries = 3;
  while (retries < maxRetries) {
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        break; // Éxito, salir del bucle
      } else if (response.status === 429 || response.status >= 500) {
        // Error de throttling o servidor, reintentar
        retries++;
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Otro tipo de error (ej. 400, 401), no reintentar
        const errorBody = await response.json();
        console.error("Error de API:", errorBody);
        throw new Error(`Error ${response.status}: ${errorBody.error?.message || 'Error desconocido'}`);
      }
    } catch (error) {
      if (retries >= maxRetries - 1) {
         console.error("Error en callGemini tras reintentos:", error);
         throw error; // Lanzar error final
      }
      retries++;
      const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  if (!response.ok) {
    throw new Error(`Falló la API de Gemini después de ${maxRetries} intentos.`);
  }

  const result = await response.json();
  
  if (result.candidates && result.candidates[0].content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text;
  } else {
    console.warn("Respuesta inesperada de Gemini:", result);
    throw new Error("No se recibió contenido de texto válido.");
  }
}


/* ================================
   🔔 Notificaciones (Firebase)
================================ */
// ... existing code ... -->
window.toggleTemaMenu = toggleTemaMenu;
window.aplicarTema = aplicarTema;
window.copiarAlPortapapeles = copiarAlPortapapeles;
window.prepararVisita = prepararVisita;
window.cerrarModalIA = cerrarModalIA;
window.runCoachIA = runCoachIA;

