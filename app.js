// ==========================================
// 🚀 APP.JS - MERCADO LIMPIO SMART (V10 FIXED + BLINDADO)
// Compatible con TU HTML actual (onclicks en HTML + vistas .view-section/.active)
// No quita funciones: solo corrige fallas de carga, exporta globals y agrega defensas.
// ==========================================

const WORKER_URL = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev/';

// --- ESTADO GLOBAL ---
const state = {
  user: JSON.parse(localStorage.getItem('ml_user')) || null,
  userLocation: null,

  // Datos crudos
  db: { clients: [], zones: [], ia_data: null },

  // Sesión de ruta
  route: { activeClients: [], completedIds: new Set(), startTime: null },

  // UI
  viewMode: 'list',
  currentTheme: 'dark',
  currentClient: null,
  selection: { selectedZones: new Set() }
};

// --- TEMAS ---
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
// 🔥 DEBUG (opcional pero útil)
// ==========================================
window.addEventListener('error', (e) => {
  console.error('JS ERROR:', e);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('PROMISE ERROR:', e?.reason || e);
});
console.log('APP.JS CARGADO OK');

// ==========================================
// 1️⃣ INICIALIZACIÓN (FIXED - evita freeze por Lucide + MutationObserver)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // ✅ Iconos Lucide (blindado: evita loop infinito por mutaciones del DOM)
  if (window.lucide) {
    try {
      // Ejecuta createIcons como máximo 1 vez por frame
      const safeCreateIcons = (() => {
        let scheduled = false;
        return () => {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(() => {
            scheduled = false;
            try { lucide.createIcons(); } catch (_) {}
          });
        };
      })();

      // Primera pasada
      safeCreateIcons();

      // Observer con debounce (no llama createIcons directo)
      const observer = new MutationObserver(() => safeCreateIcons());
      observer.observe(document.body, { childList: true, subtree: true });

      // Extra: por si Tailwind/Lucide tardan en cargar o hay render tardío
      setTimeout(safeCreateIcons, 50);
      setTimeout(safeCreateIcons, 250);
      setTimeout(safeCreateIcons, 800);
    } catch (_) {}
  }

  initClock();
  initGeo();
  applyTheme(localStorage.getItem('ml_theme') || 'dark');

  // Vistas
  if (state.user) {
    initApp();
  } else {
    // Tu HTML ya tiene login "active", pero lo dejamos consistente
    window.switchView('view-login');
  }

  // Listeners (blindados)
  el('btn-login')?.addEventListener('click', handleLogin);
  el('btn-theme-toggle')?.addEventListener('click', cycleTheme);
  el('ai-input')?.addEventListener('keydown', (e) => e.key === 'Enter' && window.handleAISend());
  el('fab-focus-mode')?.addEventListener('click', window.toggleViewMode);

  // Tip: si el usuario aprieta Enter en password, loguea
  el('login-pass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin(e);
  });
});

function initApp() {
  window.switchView('view-dashboard');
  loadAppData();
}


// ==========================================
// 2️⃣ API (con headers correctos)
// ==========================================
async function apiCall(action, payload) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });

  // Si el worker devuelve HTML por error, esto lo detecta más claro
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error('Respuesta no JSON del servidor/worker. Revisa Worker y doPost. Texto: ' + text.slice(0, 200));
  }

  if (json.status !== 'success') throw new Error(json.message || 'Error desconocido en servidor');
  return json.data;
}

async function loadAppData() {
  toggleLoader(true);
  try {
    const data = await apiCall('get_app_data', { vendedor: state.user.vendedor });

    state.db.clients = data?.clientes || [];
    state.db.zones = data?.zonas || [];
    state.db.ia_data = data?.sugerencia_ia || null;

    renderZoneDashboard();

    // IA sugerencia
    if (state.db.ia_data && state.db.ia_data.sugerencias) {
      showIASuggestion(state.db.ia_data);
    }

  } catch (e) {
    alert('Error iniciando app: ' + (e.message || e));
    console.error(e);
  } finally {
    toggleLoader(false);
  }
}

// ==========================================
// 3️⃣ LOGIN
// ==========================================
async function handleLogin(e) {
  if (e) e.preventDefault();

  const u = (el('login-user')?.value || '').trim();
  const p = (el('login-pass')?.value || '').trim();
  if (!u || !p) return alert('Ingrese usuario y contraseña');

  toggleLoader(true);
  try {
    const res = await apiCall('login', { user: u, pass: p });
    state.user = res;
    localStorage.setItem('ml_user', JSON.stringify(res));
    initApp();
  } catch (e) {
    alert(e.message || e);
  } finally {
    toggleLoader(false);
  }
}

// ==========================================
// 4️⃣ DASHBOARD (MIS ZONAS)
// - Botón por localidad (zona.nombre)
// - Muestra cantidad clientes y críticos
// - Permite seleccionar 1+ zonas y luego iniciar ruta
// ==========================================
function renderZoneDashboard() {
  const container = el('zones-grid');
  if (!container) return;

  container.innerHTML = '';

  const lbl = el('lbl-saludo');
  if (lbl && state.user?.user) lbl.innerText = `HOLA, ${String(state.user.user).toUpperCase()}`;

  state.db.zones.forEach(zona => {
    const btn = document.createElement('button');
    const isCritical = Number(zona.criticos || 0) > 0;

    btn.className = `p-4 rounded-xl border transition-all text-left relative overflow-hidden group
      ${isCritical ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`;

    // Nota: Si en backend luego agregás dias_sin_visitar_localidad, acá se muestra automáticamente
    const diasZona = (zona.dias_sin_visitar_localidad !== undefined && zona.dias_sin_visitar_localidad !== null)
      ? `<p class="text-[10px] mt-1 opacity-80">Última vez: <b>${zona.dias_sin_visitar_localidad}</b> días</p>`
      : '';

    btn.innerHTML = `
      <div class="relative z-10">
        <h3 class="font-bold text-lg uppercase text-white">${zona.nombre}</h3>
        <p class="text-xs text-slate-400">${zona.total_clientes} Clientes</p>
        ${diasZona}
        ${
          isCritical
            ? `<span class="inline-block mt-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">⚠️ ${zona.criticos} Críticos</span>`
            : ''
        }
      </div>
      <div class="absolute inset-0 bg-blue-600 opacity-0 group-[.selected]:opacity-20 transition-opacity"></div>
    `;

    btn.onclick = () => toggleZoneSelection(zona.nombre, btn);
    container.appendChild(btn);
  });
}

function toggleZoneSelection(zoneKey, btnElement) {
  if (!zoneKey) return;

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

  if (!startBtn) return;

  if (count > 0) {
    startBtn.classList.remove('hidden');
    if (label) label.innerText = `INICIAR RUTA (${count})`;
  } else {
    startBtn.classList.add('hidden');
    if (label) label.innerText = 'INICIAR RUTA';
  }
}

// ⚠️ Necesario porque tu HTML lo llama con onclick="startRoute()"
window.startRoute = () => {
  if (state.selection.selectedZones.size === 0) return;

  const selectedKeys = Array.from(state.selection.selectedZones);

  // Clientes ya vienen con localidad_key desde backend
  state.route.activeClients = state.db.clients.filter(c => selectedKeys.includes(c.localidad_key));

  initRouteView();
};

// IA -> aceptar ruta sugerida
window.acceptIARoute = () => {
  const zonasIA = state.db.ia_data?.sugerencias?.rutas_sugeridas || [];
  if (!Array.isArray(zonasIA) || zonasIA.length === 0) return alert('La IA no tiene datos suficientes hoy.');

  // Se intenta matchear por localidad_key (NORMALIZADA) usando includes/upper
  const iaKeys = zonasIA.map(z => String(z).toUpperCase().trim());
  state.route.activeClients = state.db.clients.filter(c => {
    const k = String(c.localidad_key || '').toUpperCase();
    return iaKeys.some(z => k.includes(z));
  });

  initRouteView();
};

// ==========================================
// 5️⃣ VISTA RUTA (RUTA DEL DÍA)
// ==========================================
function initRouteView() {
  state.route.startTime = new Date();
  state.route.completedIds.clear();

  window.switchView('view-route');

  renderRouteList();
  updateProgressCircle();
}

function renderRouteList() {
  const container = el('route-container');
  if (!container) return;

  container.innerHTML = '';

  const pendientes = state.route.activeClients.filter(c => !state.route.completedIds.has(String(c.id)));

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
  if (countLbl) countLbl.innerText = `${pendientes.length} Pendientes`;
}

function renderClientCard(c, container) {
  const div = document.createElement('div');
  div.className = `client-card relative p-5 mb-4 rounded-3xl border border-white/5 shadow-xl ${getThemeCardClass()} animate-fade-in-up overflow-hidden`;

  const dias = Number(c.dias_sin_comprar ?? 999);
  const statusColor = getStatusColor(dias);

  // GEO
  let geoInfo = '';
  const hasCoords = c.lat !== null && c.lat !== '' && c.lng !== null && c.lng !== '';
  if (state.userLocation && hasCoords) {
    const km = calculateDistance(state.userLocation.lat, state.userLocation.lng, Number(c.lat), Number(c.lng));
    if (km !== null && !Number.isNaN(km)) {
      const time = getTravelTime(km);
      geoInfo = `<span class="flex items-center gap-1 text-blue-400 font-bold ml-2 border-l border-white/10 pl-2 text-xs"><i class="fas fa-car-side"></i> ${km.toFixed(1)}km (${time})</span>`;
    }
  }

  const nombre = String(c.nombre || 'Cliente');
  const localidad = String(c.localidad || '');
  const direccion = String(c.direccion || 'Sin dirección');
  const id = String(c.id || '');

  div.innerHTML = `
    <span class="absolute -right-2 -bottom-6 text-[6rem] font-black text-white opacity-[0.03] pointer-events-none select-none z-0">
      ${id}
    </span>

    <div class="relative z-10">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-[10px] font-bold opacity-60 uppercase tracking-wider flex items-center">
            ${localidad} ${geoInfo}
          </span>
          <h2 class="text-xl font-black leading-tight mt-1 text-white">${escapeHtml(nombre)}</h2>
        </div>
        <span class="px-2 py-1 rounded-lg text-[10px] font-bold uppercase border border-white/5 ${statusColor.bg} ${statusColor.text}">
          ${Number.isFinite(dias) ? dias : 999} Días
        </span>
      </div>

      <div class="flex items-center gap-2 mb-5 opacity-70 text-sm">
        <i class="fas fa-map-pin text-xs"></i> ${escapeHtml(direccion)}
      </div>

      <div class="grid grid-cols-4 gap-2">
        <button onclick="quickRegister('${id}', 'COMPRA')"
          class="col-span-3 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 text-sm">
          <i class="fas fa-check"></i> VENTA OK
        </button>

        <button onclick="openNoteModal('${id}')"
          class="col-span-1 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white font-bold py-3.5 rounded-2xl flex items-center justify-center border border-white/5">
          <i class="fas fa-ellipsis-v"></i>
        </button>
      </div>
    </div>
  `;

  container.appendChild(div);
}

function renderFocusCard(c, container) {
  renderClientCard(c, container);
}

// ==========================================
// 6️⃣ REGISTRO (MOVIMIENTOS)
// ==========================================
window.quickRegister = async (id, tipo) => {
  try { if (navigator.vibrate) navigator.vibrate(50); } catch (_) {}

  const sid = String(id);
  state.route.completedIds.add(sid);

  renderRouteList();
  updateProgressCircle();

  try {
    await apiCall('registrar_movimiento', {
      vendedor: state.user.vendedor,
      clienteId: sid,
      tipo: 'pedido',
      motivo: 'Venta exitosa',
      observacion: 'Registro rápido app'
    });
  } catch (e) {
    alert('⚠️ Error conexión. El movimiento podría no haberse guardado.');
  }
};

window.openNoteModal = (id) => {
  const sid = String(id);
  state.currentClient = state.db.clients.find(c => String(c.id) === sid);

  const modal = el('modal-options');
  if (!modal) return;

  modal.classList.remove('hidden');

  const title = el('modal-title');
  if (title) title.innerText = state.currentClient?.nombre || 'Cliente';

  const obs = el('input-visit-obs');
  if (obs) obs.value = '';
};

window.saveVisit = async (motivo) => {
  if (!state.currentClient) return;

  const id = String(state.currentClient.id);
  const obs = el('input-visit-obs')?.value || '';

  el('modal-options')?.classList.add('hidden');

  state.route.completedIds.add(id);
  renderRouteList();
  updateProgressCircle();

  try {
    await apiCall('registrar_movimiento', {
      vendedor: state.user.vendedor,
      clienteId: id,
      tipo: 'visita',
      motivo: String(motivo || 'Nota'),
      observacion: obs
    });
  } catch (e) {
    alert('⚠️ Error guardando visita: ' + (e.message || e));
  }
};

window.closeModal = () => el('modal-options')?.classList.add('hidden');

// ==========================================
// 7️⃣ UI HELPERS (PROGRESO, RELOJ, TEMAS)
// ==========================================
function updateProgressCircle() {
  const total = state.route.activeClients.length;
  const completed = state.route.completedIds.size;
  const percent = total === 0 ? 0 : (completed / total) * 100;

  const circle = el('progress-ring-circle');
  if (!circle) return;

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

  // refrescar ruta si está activa
  if (state.route.activeClients.length > 0) renderRouteList();
}

function getThemeCardClass() {
  return THEMES[state.currentTheme].card;
}

function getStatusColor(dias) {
  if (dias > 60) return { bg: 'bg-red-500/20', text: 'text-red-500' };
  if (dias > 30) return { bg: 'bg-orange-500/20', text: 'text-orange-500' };
  return { bg: 'bg-emerald-500/20', text: 'text-emerald-500' };
}

function showIASuggestion(iaData) {
  const box = el('ia-suggestion-box');
  if (!box) return;

  box.classList.remove('hidden');

  const rutas = iaData?.sugerencias?.rutas_sugeridas || [];
  const alertas = iaData?.sugerencias?.alertas_entrega || [];

  const suggestionText = rutas.length
    ? `Hoy deberías visitar: <b>${rutas.map(escapeHtml).join(', ')}</b>.`
    : `Hoy no hay ruta sugerida por patrón.`;

  const extra = alertas.length
    ? `<div class="text-[11px] opacity-90 mt-2">Entregas/alertas: <b>${alertas.map(escapeHtml).join(', ')}</b></div>`
    : '';

  box.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 text-white p-5">
      <div class="absolute top-0 right-0 p-4 opacity-10"><i data-lucide="sparkles" class="w-20 h-20"></i></div>
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-2">
          <div class="bg-white/20 p-1.5 rounded-lg"><i class="fas fa-robot text-yellow-300 animate-pulse"></i></div>
          <span class="text-xs font-bold uppercase tracking-wider">Sugerencia IA</span>
        </div>

        <div class="text-sm font-medium leading-relaxed opacity-95">
          ${suggestionText}
          ${extra}
        </div>

        <button onclick="acceptIARoute()" class="mt-4 w-full bg-white text-blue-700 font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md">
          ACEPTAR RUTA <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `;

  // Re-render icons
  try { window.lucide && lucide.createIcons(); } catch (_) {}
}

function showRouteFinished() {
  const cont = el('route-container');
  if (!cont) return;

  cont.innerHTML = `
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
// 8️⃣ CHATBOT IA
// ==========================================
window.handleAISend = async () => {
  const input = el('ai-input');
  if (!input) return;

  const txt = input.value.trim();
  if (!txt) return;

  appendChatMsg('user', txt);
  input.value = '';

  try {
    const res = await apiCall('chatbot', { vendedor: state.user.vendedor, mensaje: txt });
    appendChatMsg('bot', res?.respuesta || '(sin respuesta)');
  } catch (e) {
    appendChatMsg('bot', 'Error IA: ' + (e.message || e));
  }
};

function appendChatMsg(role, text) {
  const container = el('chat-msgs');
  if (!container) return;

  const div = document.createElement('div');
  const isUser = role === 'user';

  div.className = `p-3 my-2 rounded-2xl text-sm max-w-[85%] ${
    isUser ? 'bg-blue-600 text-white ml-auto rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'
  }`;

  div.innerHTML = escapeHtml(String(text || '')).replace(/\n/g, '<br>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ==========================================
// 9️⃣ GEO (DISTANCIA + TIEMPO)
// ==========================================
function initGeo() {
  if (!('geolocation' in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (state.route.activeClients.length > 0) renderRouteList();
    },
    (err) => console.log('Sin permiso GPS o error:', err),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTravelTime(km) {
  if (!km) return '';
  const speed = 20; // km/h promedio en ciudad
  const mins = Math.round((km / speed) * 60);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
}

// ==========================================
// 10️⃣ VISTAS (CRÍTICO: exportar a window para onclick en HTML)
// ==========================================
window.switchView = (id) => {
  // Ocultar todas
  document.querySelectorAll('.view-section').forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });

  // Mostrar target
  const view = el(id);
  if (view) {
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
  }
};

// ==========================================
// 11️⃣ MODO FOCO
// ==========================================
window.toggleViewMode = () => {
  state.viewMode = state.viewMode === 'list' ? 'focus' : 'list';
  renderRouteList();
};

// ==========================================
// 12️⃣ UTILS
// ==========================================
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
