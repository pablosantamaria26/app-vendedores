// ==========================================
// 🚀 APP.JS - MERCADO LIMPIO SMART (V9)
// ==========================================
const WORKER_URL = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev/';

// --- ESTADO GLOBAL ---
const state = {
  user: JSON.parse(localStorage.getItem('ml_user')) || null,
  
  // Datos Crudos (Base de conocimiento)
  db: {
    clients: [], // Todos los clientes
    zones: [],   // Resumen de zonas
    ia_data: null // Sugerencias del día
  },

  // Estado de la Sesión (Ruta activa)
  route: {
    activeClients: [], // Clientes filtrados para hoy
    completedIds: new Set(), // IDs visitados en esta sesión
    startTime: null
  },

  // UI
  viewMode: 'list', // 'list' | 'focus'
  currentTheme: 'dark',
  currentClient: null,
  selection: {
    selectedZones: new Set()
  }
};

// --- TEMAS (Configuración de Colores) ---
const THEMES = {
  dark: { bg: 'bg-slate-900', text: 'text-white', card: 'bg-slate-800', accent: 'bg-blue-600' },
  light: { bg: 'bg-gray-100', text: 'text-slate-900', card: 'bg-white shadow-sm', accent: 'bg-blue-600' },
  sunset: { bg: 'bg-gradient-to-br from-indigo-900 to-purple-800', text: 'text-white', card: 'bg-white/10 backdrop-blur-md', accent: 'bg-orange-500' },
  neon: { bg: 'bg-black', text: 'text-green-400', card: 'bg-gray-900 border border-green-500/30', accent: 'bg-green-600' }
};

// --- HELPERS DOM ---
const el = (id) => document.getElementById(id);
const toggleLoader = (s) => el('loader')?.classList.toggle('hidden', !s);

// ==========================================
// 1️⃣ INICIALIZACIÓN Y EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  applyTheme(localStorage.getItem('ml_theme') || 'dark');
  
  if (state.user) {
    initApp();
  } else {
    switchView('view-login');
  }

  // Listeners Globales
  el('btn-login').onclick = handleLogin;
  el('btn-theme-toggle').onclick = cycleTheme;
  el('ai-input').onkeydown = (e) => e.key === 'Enter' && handleAISend();
  
  // Botones flotantes del modo ruta
  el('fab-focus-mode').onclick = toggleViewMode;
});

function initApp() {
  switchView('view-dashboard'); // Pantalla de Zonas primero
  loadAppData(); // La "Supercarga"
}

// ==========================================
// 2️⃣ CARGA DE DATOS (Backend V9)
// ==========================================
async function loadAppData() {
  toggleLoader(true);
  try {
    // LLAMADA MAESTRA: Trae Clientes, Zonas e IA de una sola vez
    const data = await apiCall('get_app_data', { vendedor: state.user.vendedor });
    
    // Guardamos en estado
    state.db.clients = data.clientes || [];
    state.db.zones = data.zonas || [];
    state.db.ia_data = data.sugerencia_ia || null;
    
    // Renderizamos Dashboard de Zonas
    renderZoneDashboard();
    
    // Si hay sugerencia IA fuerte, mostramos alerta amigable
    if (state.db.ia_data && state.db.ia_data.sugerencias) {
      showIASuggestion(state.db.ia_data);
    }
    
  } catch (e) {
    alert('Error iniciando app: ' + e.message);
  } finally {
    toggleLoader(false);
  }
}

// ==========================================
// 3️⃣ VISTA 1: DASHBOARD DE ZONAS
// ==========================================
function renderZoneDashboard() {
  const container = el('zones-grid');
  container.innerHTML = '';
  
  // Header del Dashboard
  el('lbl-saludo').innerText = `Hola, ${state.user.user}`;
  
  // Renderizar Zonas (Botones grandes)
  state.db.zones.forEach(zona => {
    const btn = document.createElement('button');
    // Estilo condicional si hay muchos críticos
    const isCritical = zona.criticos > 0;
    
    btn.className = `p-4 rounded-xl border transition-all text-left relative overflow-hidden group 
      ${isCritical ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`;
      
    btn.innerHTML = `
      <div class="relative z-10">
        <h3 class="font-bold text-lg uppercase text-white">${zona.nombre}</h3>
        <p class="text-xs text-slate-400">${zona.total_clientes} Clientes</p>
        ${isCritical ? `<span class="inline-block mt-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">⚠️ ${zona.criticos} Críticos</span>` : ''}
      </div>
      <div class="absolute inset-0 bg-blue-600 opacity-0 group-[.selected]:opacity-20 transition-opacity"></div>
    `;
    
    btn.onclick = () => toggleZoneSelection(zona.nombre, btn);
    container.appendChild(btn);
  });
}

function toggleZoneSelection(zoneKey, btnElement) {
  if (state.selection.selectedZones.has(zoneKey)) {
    state.selection.selectedZones.delete(zoneKey);
    btnElement.classList.remove('ring-2', 'ring-blue-500', 'selected');
  } else {
    state.selection.selectedZones.add(zoneKey);
    btnElement.classList.add('ring-2', 'ring-blue-500', 'selected');
  }
  
  // Habilitar botón de "Arrancar Ruta"
  const count = state.selection.selectedZones.size;
  const startBtn = el('btn-start-route');
  
  if (count > 0) {
    startBtn.classList.remove('hidden');
    startBtn.innerText = `INICIAR RUTA (${count} Zonas)`;
  } else {
    startBtn.classList.add('hidden');
  }
}

// Iniciar Ruta Manual
window.startRoute = () => {
  if (state.selection.selectedZones.size === 0) return;
  
  // Filtramos clientes según zonas seleccionadas
  const selectedKeys = Array.from(state.selection.selectedZones);
  
  state.route.activeClients = state.db.clients.filter(c => 
    selectedKeys.includes(c.localidad_key)
  );
  
  initRouteView();
};

// Iniciar Ruta Sugerida por IA
window.acceptIARoute = () => {
  const zonasIA = state.db.ia_data?.sugerencias?.rutas_sugeridas || [];
  if (zonasIA.length === 0) return alert('La IA no tiene datos suficientes hoy.');
  
  // Normalizamos nombres de IA para que coincidan con keys
  // (Asumimos que el backend ya devuelve nombres limpios, o hacemos match simple)
  state.route.activeClients = state.db.clients.filter(c => 
    zonasIA.some(zIA => c.localidad_key.includes(zIA.toUpperCase()))
  );
  
  initRouteView();
};

// ==========================================
// 4️⃣ VISTA 2: RUTA ACTIVA (LISTA O FOCO)
// ==========================================
function initRouteView() {
  state.route.startTime = new Date();
  state.route.completedIds.clear();
  switchView('view-route');
  renderRouteList();
  updateProgressCircle();
}

function renderRouteList() {
  const container = el('route-container');
  container.innerHTML = '';
  
  // Filtrar completados para que desaparezcan de la vista
  const pendientes = state.route.activeClients.filter(c => !state.route.completedIds.has(c.id));
  
  if (pendientes.length === 0) {
    showRouteFinished();
    return;
  }

  // MODO: FOCO (Solo 1 cliente grande)
  if (state.viewMode === 'focus') {
    renderFocusCard(pendientes[0], container);
  } 
  // MODO: LISTA (Tarjetas grandes, scroll)
  else {
    pendientes.forEach(c => renderClientCard(c, container));
  }
  
  el('route-count-lbl').innerText = `${pendientes.length} Pendientes`;
}

// Renderiza una tarjeta estándar
function renderClientCard(c, container) {
  const div = document.createElement('div');
  // Animación de entrada
  div.className = `client-card relative p-5 mb-4 rounded-2xl border border-slate-700/50 shadow-lg ${getThemeCardClass()} animate-fade-in-up`;
  
  // Semáforo visual
  const statusColor = getStatusColor(c.dias_sin_comprar);
  
  div.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <div>
        <span class="text-[10px] font-bold opacity-60 uppercase tracking-wider">#${c.id} • ${c.localidad}</span>
        <h2 class="text-xl font-black leading-none mt-1 ${state.currentTheme === 'light' ? 'text-slate-900' : 'text-white'}">${c.nombre}</h2>
      </div>
      <div class="flex flex-col items-end">
        <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase ${statusColor.bg} ${statusColor.text}">
          ${c.dias_sin_comprar} Días
        </span>
      </div>
    </div>
    
    <div class="flex items-center gap-2 mb-4 opacity-70 text-sm">
      <i class="fas fa-map-pin"></i> ${c.direccion}
    </div>

    <div class="grid grid-cols-4 gap-2 mt-4">
      <button onclick="quickRegister('${c.id}', 'COMPRA')" 
        class="col-span-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2">
        <i class="fas fa-dollar-sign"></i> REGISTRAR COMPRA
      </button>
      
      <button onclick="openNoteModal('${c.id}')" 
        class="col-span-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl flex items-center justify-center">
        <i class="fas fa-ellipsis-v"></i>
      </button>
    </div>
  `;
  container.appendChild(div);
}

// Renderiza Modo Foco (Ocupa toda la pantalla casi)
function renderFocusCard(c, container) {
  // Similar a renderClientCard pero con clases h-full y textos más grandes
  // ... (Simplificado para brevedad, usa estructura similar)
  renderClientCard(c, container); 
}

// ==========================================
// 5️⃣ LÓGICA DE REGISTRO (OPTIMISTIC UI)
// ==========================================

// Registro Rápido (Compra) - SENSACIÓN INSTANTÁNEA
window.quickRegister = async (id, tipo) => {
  // 1. Feedback visual inmediato (Vibración si es móvil)
  if (navigator.vibrate) navigator.vibrate(50);
  
  // 2. Actualizar estado local (Optimistic)
  state.route.completedIds.add(id);
  
  // 3. Re-renderizar UI YA (El usuario siente que voló)
  renderRouteList();
  updateProgressCircle();
  
  // 4. Enviar al backend en segundo plano ("Fire and forget" visualmente)
  try {
    const cliente = state.db.clients.find(c => c.id === id);
    // Nota: enviamos motivo default
    await apiCall('registrar_movimiento', {
      vendedor: state.user.vendedor,
      clienteId: id,
      tipo: 'pedido', // Mapeo a tu backend
      motivo: 'Venta exitosa',
      observacion: 'Registro rápido app'
    });
    // Opcional: Mostrar toast pequeño de "Guardado en nube"
  } catch (e) {
    alert('⚠️ Ojo: El pedido de ' + id + ' no se guardó en la nube. Revisa tu conexión.');
    // Rollback visual si falla (complejo, para V2)
  }
};

// Registro Complejo (No compra / Notas)
window.openNoteModal = (id) => {
  state.currentClient = state.db.clients.find(c => c.id === id);
  el('modal-options').classList.remove('hidden');
  el('modal-title').innerText = state.currentClient.nombre;
};

window.saveVisit = async (motivo) => {
  const id = state.currentClient.id;
  const obs = el('input-visit-obs').value;
  
  el('modal-options').classList.add('hidden');
  
  // Optimistic UI
  state.route.completedIds.add(id);
  renderRouteList();
  updateProgressCircle();
  
  // Backend
  await apiCall('registrar_movimiento', {
    vendedor: state.user.vendedor,
    clienteId: id,
    tipo: 'visita',
    motivo: motivo,
    observacion: obs
  });
};

// ==========================================
// 6️⃣ COMPONENTES VISUALES Y HELPERS
// ==========================================

// Círculo de Progreso Dinámico
function updateProgressCircle() {
  const total = state.route.activeClients.length;
  const completed = state.route.completedIds.size;
  const percent = total === 0 ? 0 : (completed / total) * 100;
  
  const circle = el('progress-ring-circle');
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  
  // Color dinámico
  if (percent < 30) circle.style.stroke = '#ef4444'; // Rojo
  else if (percent < 70) circle.style.stroke = '#eab308'; // Amarillo
  else if (percent < 100) circle.style.stroke = '#10b981'; // Verde
  else circle.style.stroke = '#3b82f6'; // Azul (Completo)

  // Mensaje fin
  if (percent === 100) {
    confettiEffect(); // Si tenés librería, si no, un alert lindo
  }
}

// Reloj Header
function initClock() {
  const update = () => {
    const now = new Date();
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    el('header-date').innerText = `${dias[now.getDay()]} ${now.getDate()} - ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  };
  setInterval(update, 1000);
  update();
}

// Temas
function cycleTheme() {
  const themes = ['dark', 'light', 'sunset', 'neon'];
  const next = themes[(themes.indexOf(state.currentTheme) + 1) % themes.length];
  applyTheme(next);
}

function applyTheme(t) {
  state.currentTheme = t;
  localStorage.setItem('ml_theme', t);
  const cfg = THEMES[t];
  
  document.body.className = `${cfg.bg} ${cfg.text} transition-colors duration-500`;
  // Actualizar variables CSS o clases globales si es necesario
  // Aquí confiamos en renderizar de nuevo o usar clases base
  if (state.route.activeClients.length > 0) renderRouteList(); 
}

function getThemeCardClass() {
  return THEMES[state.currentTheme].card;
}

// Estado visual (Días sin compra)
function getStatusColor(dias) {
  if (dias > 60) return { bg: 'bg-red-500/20', text: 'text-red-500' };
  if (dias > 30) return { bg: 'bg-orange-500/20', text: 'text-orange-500' };
  return { bg: 'bg-emerald-500/20', text: 'text-emerald-500' };
}

// IA Suggestion UI
function showIASuggestion(iaData) {
  const box = el('ia-suggestion-box');
  if(!box) return;
  
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-xl shadow-lg mb-4 text-white">
      <div class="flex items-start gap-3">
        <i class="fas fa-robot text-2xl animate-pulse"></i>
        <div>
          <h4 class="font-bold text-sm opacity-90">SUGERENCIA DEL DÍA</h4>
          <p class="text-xs mt-1 opacity-80">
            Hoy deberías visitar: <b>${iaData.sugerencias.rutas_sugeridas.join(', ')}</b>.
            Hay ${iaData.sugerencias.alertas_entrega.length} zonas con entregas hoy.
          </p>
        </div>
      </div>
      <button onclick="acceptIARoute()" class="mt-3 w-full bg-white text-blue-700 font-bold py-2 rounded-lg text-xs shadow-sm hover:bg-blue-50">
        ACEPTAR RUTA SUGERIDA
      </button>
    </div>
  `;
}

// ==========================================
// 7️⃣ LOGIN Y NAVEGACIÓN
// ==========================================
const handleLogin = async () => {
  const u = el('login-user').value.trim();
  const p = el('login-pass').value.trim();
  toggleLoader(true);
  try {
    const res = await apiCall('login', { user: u, pass: p });
    state.user = res;
    localStorage.setItem('ml_user', JSON.stringify(res));
    initApp();
  } catch (e) {
    alert(e.message);
  } finally {
    toggleLoader(false);
  }
};

const switchView = (id) => {
  document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
  el(id).classList.remove('hidden');
};

function toggleViewMode() {
  state.viewMode = state.viewMode === 'list' ? 'focus' : 'list';
  renderRouteList();
}

function showRouteFinished() {
  el('route-container').innerHTML = `
    <div class="text-center mt-20 opacity-80 animate-bounce">
      <i class="fas fa-check-circle text-6xl text-emerald-500 mb-4"></i>
      <h2 class="text-2xl font-bold">¡Ruta Finalizada!</h2>
      <p>Gran trabajo hoy.</p>
      <button onclick="switchView('view-dashboard')" class="mt-8 text-blue-400 underline">Volver a Zonas</button>
    </div>
  `;
}

// ==========================================
// 8️⃣ CHATBOT IA
// ==========================================
// (Misma lógica tuya, solo integrada con los estilos nuevos)
window.handleAISend = async () => {
  const input = el('ai-input');
  const txt = input.value.trim();
  if(!txt) return;
  
  // UI Chat Bubble User
  appendChatMsg('user', txt);
  input.value = '';
  
  try {
    const res = await apiCall('chatbot', { vendedor: state.user.vendedor, mensaje: txt });
    appendChatMsg('bot', res.respuesta);
  } catch(e) {
    appendChatMsg('bot', 'Error IA: ' + e.message);
  }
};

function appendChatMsg(role, text) {
  const div = document.createElement('div');
  div.className = `p-3 my-2 rounded-xl text-xs max-w-[85%] ${role === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-slate-700 text-slate-200'}`;
  div.innerHTML = text.replace(/\n/g, '<br>'); // Soporte básico saltos línea
  el('chat-msgs').appendChild(div);
  el('chat-msgs').scrollTop = el('chat-msgs').scrollHeight;
}

// ==========================================
// API CALL (GENÉRICO)
// ==========================================
async function apiCall(action, payload) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    body: JSON.stringify({ action, payload })
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json.data;
}
