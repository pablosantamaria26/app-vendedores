// ==========================================
// 🚀 APP.JS - MERCADO LIMPIO SMART (V10 FIXED)
// ==========================================
const WORKER_URL = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev/';

const state = {
  user: JSON.parse(localStorage.getItem('ml_user')) || null,
  userLocation: null,
  db: { clients: [], zones: [], ia_data: null },
  route: { activeClients: [], completedIds: new Set(), startTime: null },
  viewMode: 'list',
  currentTheme: 'dark',
  currentClient: null,
  selection: { selectedZones: new Set() }
};

const THEMES = {
  dark: { bg: 'bg-slate-900', text: 'text-white', card: 'bg-slate-800', accent: 'bg-blue-600' },
  light: { bg: 'bg-gray-100', text: 'text-slate-900', card: 'bg-white shadow-sm', accent: 'bg-blue-600' },
  sunset: { bg: 'bg-gradient-to-br from-indigo-900 to-purple-800', text: 'text-white', card: 'bg-white/10 backdrop-blur-md', accent: 'bg-orange-500' },
  neon: { bg: 'bg-black', text: 'text-green-400', card: 'bg-gray-900 border border-green-500/30', accent: 'bg-green-600' }
};

const el = (id) => document.getElementById(id);
const toggleLoader = (s) => el('loader')?.classList.toggle('hidden', !s);

// ==========================================
// 1️⃣ INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Iconos Lucide
  if (window.lucide) {
    lucide.createIcons();
    const observer = new MutationObserver(() => lucide.createIcons());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  initClock();
  initGeo();
  applyTheme(localStorage.getItem('ml_theme') || 'dark');
  
  // ✅ CAMBIO 3: Gestión correcta de vistas al inicio
  if (state.user) {
    // Si ya hay usuario, saltamos Login y vamos a Dashboard
    // SwitchView se encarga de ocultar el Login que ahora es visible por defecto
    initApp(); 
  } else {
    // Si no hay usuario, el Login ya está visible en el HTML, no hacemos nada
    // pero nos aseguramos que switchView lo active por consistencia
    switchView('view-login');
  }

  // Listeners
  el('btn-login').onclick = handleLogin;
  el('btn-theme-toggle').onclick = cycleTheme;
  el('ai-input').onkeydown = (e) => e.key === 'Enter' && handleAISend();
  el('fab-focus-mode').onclick = toggleViewMode;
});

function initApp() {
  switchView('view-dashboard');
  loadAppData();
}

// ==========================================
// 2️⃣ CARGA DE DATOS & API
// ==========================================

// ✅ CAMBIO 2: apiCall con HEADERS para evitar error CORS/JSON
async function apiCall(action, payload) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // Header crítico agregado
    body: JSON.stringify({ action, payload })
  });
  
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Error desconocido en servidor');
  return json.data;
}

async function loadAppData() {
  toggleLoader(true);
  try {
    const data = await apiCall('get_app_data', { vendedor: state.user.vendedor });
    state.db.clients = data.clientes || [];
    state.db.zones = data.zonas || [];
    state.db.ia_data = data.sugerencia_ia || null;
    
    renderZoneDashboard();
    
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
// 3️⃣ LOGIN
// ==========================================
async function handleLogin(e) {
  if(e) e.preventDefault();
  const u = el('login-user').value.trim();
  const p = el('login-pass').value.trim();
  if (!u || !p) return alert('Ingrese usuario y contraseña');

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
}

// ==========================================
// 4️⃣ DASHBOARD ZONAS
// ==========================================
function renderZoneDashboard() {
  const container = el('zones-grid');
  container.innerHTML = '';
  const lbl = el('lbl-saludo');
  if(lbl) lbl.innerText = `HOLA, ${state.user.user.toUpperCase()}`;
  
  const countLbl = el('zone-count');
  // Ajuste defensivo por si el elemento no existe en alguna versión del HTML
  if(document.querySelector('.zone-count-disp')) {
      document.querySelector('.zone-count-disp').innerText = `${state.db.zones.length} Disp.`;
  }

  state.db.zones.forEach(zona => {
    const btn = document.createElement('button');
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
  
  const count = state.selection.selectedZones.size;
  const startBtn = el('btn-start-route');
  const label = el('btn-start-label');
  
  if (count > 0) {
    startBtn.classList.remove('hidden');
    if(label) label.innerText = `INICIAR RUTA (${count})`;
  } else {
    startBtn.classList.add('hidden');
  }
}

window.startRoute = () => {
  if (state.selection.selectedZones.size === 0) return;
  const selectedKeys = Array.from(state.selection.selectedZones);
  state.route.activeClients = state.db.clients.filter(c => selectedKeys.includes(c.localidad_key));
  initRouteView();
};

window.acceptIARoute = () => {
  const zonasIA = state.db.ia_data?.sugerencias?.rutas_sugeridas || [];
  if (zonasIA.length === 0) return alert('La IA no tiene datos suficientes hoy.');
  state.route.activeClients = state.db.clients.filter(c => 
    zonasIA.some(zIA => c.localidad_key.includes(zIA.toUpperCase()))
  );
  initRouteView();
};

// ==========================================
// 5️⃣ VISTA RUTA
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
  
  const pendientes = state.route.activeClients.filter(c => !state.route.completedIds.has(c.id));
  
  if (pendientes.length === 0) {
    showRouteFinished();
    return;
  }

  if (state.viewMode === 'focus') {
    renderFocusCard(pendientes[0], container);
  } else {
    pendientes.forEach(c => renderClientCard(c, container));
  }
  
  const countLbl = el('route-count-lbl');
  if(countLbl) countLbl.innerText = `${pendientes.length} Pendientes`;
}

function renderClientCard(c, container) {
  const div = document.createElement('div');
  div.className = `client-card relative p-5 mb-4 rounded-3xl border border-white/5 shadow-xl ${getThemeCardClass()} animate-fade-in-up overflow-hidden`;
  
  const statusColor = getStatusColor(c.dias_sin_comprar);
  
  // GEO
  let geoInfo = '';
  if (state.userLocation && c.lat && c.lng) {
    const km = calculateDistance(state.userLocation.lat, state.userLocation.lng, c.lat, c.lng);
    const time = getTravelTime(km);
    geoInfo = `<span class="flex items-center gap-1 text-blue-400 font-bold ml-2 border-l border-white/10 pl-2 text-xs"><i class="fas fa-car-side"></i> ${km.toFixed(1)}km (${time})</span>`;
  }

  div.innerHTML = `
    <span class="absolute -right-2 -bottom-6 text-[6rem] font-black text-white opacity-[0.03] pointer-events-none select-none z-0">
      ${c.id}
    </span>
    <div class="relative z-10">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-[10px] font-bold opacity-60 uppercase tracking-wider flex items-center">
             ${c.localidad} ${geoInfo}
          </span>
          <h2 class="text-xl font-black leading-tight mt-1 text-white">${c.nombre}</h2>
        </div>
        <span class="px-2 py-1 rounded-lg text-[10px] font-bold uppercase border border-white/5 ${statusColor.bg} ${statusColor.text}">
          ${c.dias_sin_comprar} Días
        </span>
      </div>
      
      <div class="flex items-center gap-2 mb-5 opacity-70 text-sm">
        <i class="fas fa-map-pin text-xs"></i> ${c.direccion || 'Sin dirección'}
      </div>

      <div class="grid grid-cols-4 gap-2">
        <button onclick="quickRegister('${c.id}', 'COMPRA')" 
          class="col-span-3 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 text-sm">
          <i class="fas fa-check"></i> VENTA OK
        </button>
        
        <button onclick="openNoteModal('${c.id}')" 
          class="col-span-1 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white font-bold py-3.5 rounded-2xl flex items-center justify-center border border-white/5">
          <i class="fas fa-ellipsis-v"></i>
        </button>
      </div>
    </div>
  `;
  container.appendChild(div);
}

function renderFocusCard(c, container) { renderClientCard(c, container); }

// ==========================================
// 6️⃣ REGISTRO
// ==========================================
window.quickRegister = async (id, tipo) => {
  if (navigator.vibrate) navigator.vibrate(50);
  state.route.completedIds.add(id);
  renderRouteList();
  updateProgressCircle();
  try {
    await apiCall('registrar_movimiento', {
      vendedor: state.user.vendedor,
      clienteId: id,
      tipo: 'pedido',
      motivo: 'Venta exitosa',
      observacion: 'Registro rápido app'
    });
  } catch (e) { alert('⚠️ Error conexión, movimiento local'); }
};

window.openNoteModal = (id) => {
  state.currentClient = state.db.clients.find(c => c.id === id);
  el('modal-options').classList.remove('hidden');
  const title = el('modal-title');
  if(title) title.innerText = state.currentClient.nombre;
};

window.saveVisit = async (motivo) => {
  const id = state.currentClient.id;
  const obs = el('input-visit-obs').value;
  el('modal-options').classList.add('hidden');
  state.route.completedIds.add(id);
  renderRouteList();
  updateProgressCircle();
  await apiCall('registrar_movimiento', {
    vendedor: state.user.vendedor,
    clienteId: id,
    tipo: 'visita',
    motivo: motivo,
    observacion: obs
  });
};

window.closeModal = () => el('modal-options').classList.add('hidden');

// ==========================================
// 7️⃣ HELPERS UI & LOGIC
// ==========================================
function updateProgressCircle() {
  const total = state.route.activeClients.length;
  const completed = state.route.completedIds.size;
  const percent = total === 0 ? 0 : (completed / total) * 100;
  
  const circle = el('progress-ring-circle');
  if(!circle) return;
  
  const radius = 16; 
  const circumference = radius * 2 * Math.PI; 
  
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  
  if (percent < 30) circle.style.stroke = '#ef4444';
  else if (percent < 70) circle.style.stroke = '#eab308';
  else if (percent < 100) circle.style.stroke = '#10b981';
  else circle.style.stroke = '#3b82f6';
}

function initClock() {
  const update = () => {
    const elDate = el('header-date');
    if (!elDate) return;
    const now = new Date();
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    elDate.innerText = `${dias[now.getDay()]} ${now.getDate()} - ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  };
  setInterval(update, 1000);
  update();
}

function cycleTheme() {
  const themes = ['dark', 'light', 'sunset', 'neon'];
  const next = themes[(themes.indexOf(state.currentTheme) + 1) % themes.length];
  applyTheme(next);
}

function applyTheme(t) {
  state.currentTheme = t;
  localStorage.setItem('ml_theme', t);
  const cfg = THEMES[t];
  document.body.className = `${cfg.bg} ${cfg.text} transition-colors duration-500 overflow-hidden`;
  if (state.route.activeClients.length > 0) renderRouteList(); 
}

function getThemeCardClass() { return THEMES[state.currentTheme].card; }

function getStatusColor(dias) {
  if (dias > 60) return { bg: 'bg-red-500/20', text: 'text-red-500' };
  if (dias > 30) return { bg: 'bg-orange-500/20', text: 'text-orange-500' };
  return { bg: 'bg-emerald-500/20', text: 'text-emerald-500' };
}

function showIASuggestion(iaData) {
  const box = el('ia-suggestion-box');
  if(!box) return;
  box.classList.remove('hidden');
  
  const suggestionText = `${iaData.sugerencias.rutas_sugeridas.join(', ')}. ${iaData.sugerencias.alertas_entrega.length} zonas con entregas.`;
  
  box.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 text-white p-5">
      <div class="absolute top-0 right-0 p-4 opacity-10"><i data-lucide="sparkles" class="w-20 h-20"></i></div>
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-2">
          <div class="bg-white/20 p-1.5 rounded-lg"><i class="fas fa-robot text-yellow-300 animate-pulse"></i></div>
          <span class="text-xs font-bold uppercase tracking-wider">Sugerencia IA</span>
        </div>
        <p class="text-sm font-medium leading-relaxed opacity-90 mb-4">
          ${suggestionText}
        </p>
        <button onclick="acceptIARoute()" class="w-full bg-white text-blue-700 font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md">
          ACEPTAR RUTA <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `;
}

function showRouteFinished() {
  el('route-container').innerHTML = `
    <div class="flex flex-col items-center justify-center mt-20 animate-fade-in-up">
      <div class="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
        <i class="fas fa-check text-4xl text-emerald-500"></i>
      </div>
      <h2 class="text-3xl font-black text-white">¡Ruta Finalizada!</h2>
      <p class="text-slate-400 mt-2">Gran trabajo hoy.</p>
      <button onclick="switchView('view-dashboard')" class="mt-8 px-8 py-4 bg-slate-800 rounded-2xl font-bold text-white border border-white/10 active:scale-95 transition-transform">
        Volver al Inicio
      </button>
    </div>
  `;
}

// ==========================================
// 8️⃣ CHAT & UTILS
// ==========================================
window.handleAISend = async () => {
  const input = el('ai-input');
  const txt = input.value.trim();
  if(!txt) return;
  appendChatMsg('user', txt);
  input.value = '';
  try {
    const res = await apiCall('chatbot', { vendedor: state.user.vendedor, mensaje: txt });
    appendChatMsg('bot', res.respuesta);
  } catch(e) { appendChatMsg('bot', 'Error IA: ' + e.message); }
};

function appendChatMsg(role, text) {
  const div = document.createElement('div');
  const isUser = role === 'user';
  div.className = `p-3 my-2 rounded-2xl text-sm max-w-[85%] ${isUser ? 'bg-blue-600 text-white ml-auto rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'}`;
  div.innerHTML = text.replace(/\n/g, '<br>');
  const container = el('chat-msgs');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function initGeo() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if(state.route.activeClients.length > 0) renderRouteList();
      },
      (err) => console.log('Sin permiso GPS'),
      { enableHighAccuracy: true }
    );
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if(!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

function getTravelTime(km) {
  if (!km) return '';
  const speed = 20; 
  const mins = Math.round((km / speed) * 60);
  return mins > 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins} min`;
}

// Lógica de Vistas (Blindada)
const switchView = (id) => {
  // Ocultamos todas
  document.querySelectorAll('.view-section').forEach(v => {
      v.classList.remove('active'); // Para animación
      v.style.display = 'none'; // Hard hide por si acaso
  });
  
  // Mostramos la elegida
  const v = el(id);
  if(v) {
      v.style.display = 'flex';
      // Pequeño timeout para permitir que el display:flex renderice antes de la opacidad
      setTimeout(() => v.classList.add('active'), 10);
  }
};

window.toggleViewMode = () => {
  state.viewMode = state.viewMode === 'list' ? 'focus' : 'list';
  renderRouteList();
};
