// ==========================================
// 🚀 APP.JS - MERCADO LIMPIO SMART (V11 — Worker v3 + IA Soporte)
// ==========================================

const WORKER_URL = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev/';

// --- ESTADO GLOBAL ---
const state = {
  user: JSON.parse(localStorage.getItem('ml_user')) || null,
  userLocation: null,

  // Datos crudos
  db: { clients: [], zones: [], cobertura: null },

  // Sesión de ruta
  route: { activeClients: [], completedIds: new Set(), startTime: null },

  // UI
  viewMode: 'list',
  currentTheme: 'dark',
  currentClient: null,
  selection: { selectedZones: new Set() },

  // Chat IA
  chatHistory: [],           // [{ role: 'user'|'bot', text }]
  chatClienteId: null        // cliente en foco al abrir el chat
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
// 🔥 DEBUG
// ==========================================
window.addEventListener('error', (e) => { console.error('JS ERROR:', e); });
window.addEventListener('unhandledrejection', (e) => { console.error('PROMISE ERROR:', e?.reason || e); });
console.log('APP.JS V11 CARGADO OK');

// ==========================================
// 1️⃣ INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    try {
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

      safeCreateIcons();
      const observer = new MutationObserver(() => safeCreateIcons());
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(safeCreateIcons, 50);
      setTimeout(safeCreateIcons, 250);
      setTimeout(safeCreateIcons, 800);
    } catch (_) {}
  }

  initClock();
  initGeo();
  applyTheme(localStorage.getItem('ml_theme') || 'dark');
  initFCM();

  if (state.user) {
    initApp();
  } else {
    window.switchView('view-login');
  }

  el('btn-login')?.addEventListener('click', handleLogin);
  el('btn-theme-toggle')?.addEventListener('click', cycleTheme);
  el('ai-input')?.addEventListener('keydown', (e) => e.key === 'Enter' && window.handleAISend());
  el('fab-focus-mode')?.addEventListener('click', window.toggleViewMode);
  el('login-pass')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(e); });

  // Guardar memoria al cerrar modal de chat
  const chatModal = el('modal-chat') || document.querySelector('[id*="chat"]');
  if (chatModal) {
    const closeBtns = chatModal.querySelectorAll('[onclick*="closeChat"], [onclick*="close-chat"], [data-close-chat]');
    closeBtns.forEach(btn => btn.addEventListener('click', () => saveChatMemory()));
  }
});

function initApp() {
  window.switchView('view-dashboard');
  loadAppData();
}

// ==========================================
// 2️⃣ WORKER API — Worker v3
// Envía objeto plano con { accion, ...campos }
// ==========================================
async function workerPost(body) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Respuesta no JSON del Worker: ' + text.slice(0, 200));
  }
}

// ==========================================
// 3️⃣ LOGIN
// ==========================================
async function handleLogin(e) {
  if (e) e.preventDefault();

  const u = (el('login-user')?.value || '').trim();
  const p = (el('login-pass')?.value || '').trim();
  if (!u || !p) return alert('Ingrese usuario y PIN');

  toggleLoader(true);
  try {
    const res = await workerPost({ accion: 'login', username: u, pin: p });

    if (!res.exito) throw new Error(res.error || 'Usuario o PIN incorrecto');

    // Guardar en estado y localStorage
    state.user = { vendedor: res.vendedor, username: res.username, id: res.id };
    localStorage.setItem('ml_user', JSON.stringify(state.user));
    initApp();
  } catch (e) {
    alert(e.message || e);
  } finally {
    toggleLoader(false);
  }
}

// ==========================================
// 4️⃣ CARGA DATOS + COBERTURA
// ==========================================
async function loadAppData() {
  toggleLoader(true);
  try {
    const [dataRes, coberturaRes] = await Promise.all([
      workerPost({ accion: 'get_app_data', vendedor: state.user.vendedor }),
      workerPost({ accion: 'get_cobertura', vendedor: state.user.vendedor })
    ]);

    if (!dataRes.exito) throw new Error(dataRes.error || 'Error cargando datos');

    state.db.clients = dataRes.clientes || [];
    state.db.zones   = dataRes.zonas   || [];
    state.db.cobertura = coberturaRes || null;

    renderZoneDashboard();
    renderCoberturaBanner();

  } catch (e) {
    alert('Error iniciando app: ' + (e.message || e));
    console.error(e);
  } finally {
    toggleLoader(false);
  }
}

// Banner de cobertura — muestra clientes críticos pendientes de visitar
function renderCoberturaBanner() {
  const container = el('zones-grid')?.parentElement;
  if (!container) return;

  // Limpiar banner anterior
  const prev = el('cobertura-banner');
  if (prev) prev.remove();

  const resumen = state.db.cobertura?.resumen;
  if (!resumen) return;

  const criticos = Number(resumen.criticos || 0);
  const abandonados = Number(resumen.abandonados || 0);
  const urgentes = criticos + abandonados;

  if (urgentes === 0) return;

  const banner = document.createElement('div');
  banner.id = 'cobertura-banner';
  banner.className = 'mx-4 mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-400';
  banner.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="text-lg">⚠️</span>
      <div class="flex-1">
        <div class="font-bold text-red-300 mb-1">Clientes sin visitar</div>
        <div class="opacity-90">
          ${criticos > 0 ? `<b>${criticos}</b> críticos (más de 30 días)` : ''}
          ${criticos > 0 && abandonados > 0 ? ' · ' : ''}
          ${abandonados > 0 ? `<b>${abandonados}</b> abandonados` : ''}
        </div>
        <div class="text-[11px] mt-1 opacity-70">Cobertura: ${resumen.pct_cobertura ?? '?'}%</div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="text-red-400 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  `;

  // Insertar antes de la grilla de zonas
  const zonesGrid = el('zones-grid');
  if (zonesGrid) {
    container.insertBefore(banner, zonesGrid);
  } else {
    container.prepend(banner);
  }
}

// ==========================================
// 5️⃣ DASHBOARD
// ==========================================
function renderZoneDashboard() {
  const container = el('zones-grid');
  if (!container) return;

  container.innerHTML = '';

  const lbl = el('lbl-saludo');
  if (lbl && state.user?.vendedor) lbl.innerText = `HOLA, ${String(state.user.vendedor).toUpperCase()}`;

  state.db.zones.forEach(zona => {
    const btn = document.createElement('button');
    const isCritical = Number(zona.criticos || 0) > 0;

    btn.className = `p-4 rounded-xl border transition-all text-left relative overflow-hidden group
      ${isCritical ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`;

    const diasZona = (zona.dias_sin_visitar_localidad !== undefined && zona.dias_sin_visitar_localidad !== null)
      ? `<p class="text-[10px] mt-1 opacity-80">Última vez: <b>${zona.dias_sin_visitar_localidad}</b> días</p>`
      : '';

    btn.innerHTML = `
      <div class="relative z-10">
        <h3 class="font-bold text-lg uppercase text-white">${escapeHtml(zona.nombre)}</h3>
        <p class="text-xs text-slate-400">${zona.total_clientes} Clientes</p>
        ${diasZona}
        ${isCritical
          ? `<span class="inline-block mt-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">⚠️ ${zona.criticos} Críticos</span>`
          : ''}
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

window.startRoute = () => {
  if (state.selection.selectedZones.size === 0) return;
  const selectedKeys = Array.from(state.selection.selectedZones);
  state.route.activeClients = state.db.clients.filter(c =>
    selectedKeys.some(k => k.toLowerCase() === (c.localidad || '').toLowerCase())
  );
  console.log('[startRoute] zonas seleccionadas:', selectedKeys);
  console.log('[startRoute] clientes totales:', state.db.clients.length, '| clientes en ruta:', state.route.activeClients.length);
  initRouteView();
};

window.acceptIARoute = () => {
  // Sin sugerencia IA automática en v11 — abrir IA para consultar
  alert('Usá el chat de Soporte para pedir sugerencias de ruta.');
};

// ==========================================
// 6️⃣ RUTA DEL DÍA
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

  let geoInfo = '';
  const hasCoords = c.lat !== null && c.lat !== '' && c.lng !== null && c.lng !== '';
  if (state.userLocation && hasCoords) {
    const km = calculateDistance(state.userLocation.lat, state.userLocation.lng, Number(c.lat), Number(c.lng));
    if (km !== null && !Number.isNaN(km)) {
      const time = getTravelTime(km);
      geoInfo = `<span class="flex items-center gap-1 text-blue-400 font-bold ml-2 border-l border-white/10 pl-2 text-xs"><i class="fas fa-car-side"></i> ${km.toFixed(1)}km (${time})</span>`;
    }
  }

  const nombre    = String(c.nombre    || 'Cliente');
  const localidad = String(c.localidad || '');
  const direccion = String(c.direccion || 'Sin dirección');
  const id        = String(c.id        || '');

  div.innerHTML = `
    <span class="absolute -right-2 -bottom-6 text-[6rem] font-black text-white opacity-[0.03] pointer-events-none select-none z-0">${id}</span>
    <div class="relative z-10">
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-[10px] font-bold opacity-60 uppercase tracking-wider flex items-center">
            ${escapeHtml(localidad)} ${geoInfo}
          </span>
          <h2 class="text-xl font-black leading-tight mt-1 text-white">${escapeHtml(nombre)}</h2>
        </div>
        <span class="px-2 py-1 rounded-lg text-[10px] font-bold uppercase border border-white/5 ${statusColor.bg} ${statusColor.text}">
          ${Number.isFinite(dias) ? dias : '?'} Días
        </span>
      </div>
      <div class="flex items-center gap-2 mb-5 opacity-70 text-sm">
        <i class="fas fa-map-pin text-xs"></i> ${escapeHtml(direccion)}
      </div>
      <div class="grid grid-cols-4 gap-2">
        <button onclick="quickRegister('${id}')"
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
// 7️⃣ REGISTRO DE VISITAS
// ==========================================
window.quickRegister = async (id) => {
  try { if (navigator.vibrate) navigator.vibrate(50); } catch (_) {}

  const sid = String(id);
  state.route.completedIds.add(sid);
  renderRouteList();
  updateProgressCircle();

  // Fire-and-forget
  workerPost({
    accion:     'registrar_visita',
    cliente_id: sid,
    vendedor:   state.user.vendedor,
    tipo:       'venta',
    nota:       'Venta registrada desde ruta',
    lat:        state.userLocation?.lat || null,
    lng:        state.userLocation?.lng || null,
  }).catch(() => {});
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

// Mapa de motivos a tipo de visita para el Worker
const TIPO_VISITA = {
  'No estaba':   'no_llegue',
  'No compró':   'no_compro',
  'Visita':      'visita',
  'Nota':        'visita',
  'default':     'visita',
};

window.saveVisit = async (motivo) => {
  if (!state.currentClient) return;

  const id  = String(state.currentClient.id);
  const obs = el('input-visit-obs')?.value || '';

  el('modal-options')?.classList.add('hidden');

  state.route.completedIds.add(id);
  renderRouteList();
  updateProgressCircle();

  const tipo = TIPO_VISITA[motivo] || TIPO_VISITA['default'];

  workerPost({
    accion:     'registrar_visita',
    cliente_id: id,
    vendedor:   state.user.vendedor,
    tipo,
    nota:       obs || motivo || 'Visita',
    lat:        state.userLocation?.lat || null,
    lng:        state.userLocation?.lng || null,
  }).catch(() => {});
};

window.closeModal = () => el('modal-options')?.classList.add('hidden');

// ==========================================
// 8️⃣ CHATBOT IA — con historial y memoria
// ==========================================
window.openChat = (clienteId = null) => {
  state.chatClienteId = clienteId ? String(clienteId) : null;
  state.chatHistory = [];
  const msgs = el('chat-msgs');
  if (msgs) msgs.innerHTML = '';
  el('modal-chat')?.classList.remove('hidden');
};

window.closeChat = () => {
  saveChatMemory();
  el('modal-chat')?.classList.add('hidden');
  state.chatHistory = [];
  state.chatClienteId = null;
};

window.handleAISend = async () => {
  const input = el('ai-input');
  if (!input) return;

  const txt = input.value.trim();
  if (!txt) return;

  appendChatMsg('user', txt);
  input.value = '';

  // Agregar al historial local
  state.chatHistory.push({ role: 'user', text: txt });

  // Mostrar indicador de escritura
  const typingId = 'typing-' + Date.now();
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'p-3 my-2 rounded-2xl text-sm bg-slate-700 text-slate-400 rounded-tl-none max-w-[85%]';
  typingDiv.innerText = '...';
  el('chat-msgs')?.appendChild(typingDiv);
  el('chat-msgs').scrollTop = el('chat-msgs').scrollHeight;

  try {
    const res = await workerPost({
      accion:     'chatbot_ia',
      vendedor:   state.user.vendedor,
      cliente_id: state.chatClienteId,
      mensaje:    txt,
      historial:  state.chatHistory.slice(-6),
    });

    // Quitar indicador de escritura
    document.getElementById(typingId)?.remove();

    const respuesta = res.text || '(sin respuesta)';
    appendChatMsg('bot', respuesta);
    state.chatHistory.push({ role: 'bot', text: respuesta });

    // Notificar acciones ejecutadas por la IA
    if (Array.isArray(res.acciones) && res.acciones.length > 0) {
      const accionesTexto = res.acciones
        .filter(a => a.resultado?.ok)
        .map(a => `✅ ${a.nombre.replace(/_/g, ' ')}`)
        .join(' · ');
      if (accionesTexto) {
        appendChatMsg('system', accionesTexto);
      }
    }

  } catch (e) {
    document.getElementById(typingId)?.remove();
    appendChatMsg('bot', 'Error al contactar al asistente. Revisá tu conexión.');
    console.error(e);
  }
};

function appendChatMsg(role, text) {
  const container = el('chat-msgs');
  if (!container) return;

  const div = document.createElement('div');

  if (role === 'system') {
    div.className = 'text-[11px] text-center text-slate-500 my-1 italic';
    div.textContent = text;
  } else {
    const isUser = role === 'user';
    div.className = `p-3 my-2 rounded-2xl text-sm max-w-[85%] ${
      isUser ? 'bg-blue-600 text-white ml-auto rounded-tr-none' : 'bg-slate-700 text-slate-200 rounded-tl-none'
    }`;
    div.innerHTML = escapeHtml(String(text || '')).replace(/\n/g, '<br>');
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Guarda resumen de la conversación en Supabase (fire-and-forget)
async function saveChatMemory() {
  if (state.chatHistory.length < 2) return;
  if (!state.user?.vendedor) return;

  // Resumen sencillo: últimos 2 mensajes
  const ultimos = state.chatHistory.slice(-4);
  const resumen = ultimos
    .map(m => `${m.role === 'user' ? 'Vendedor' : 'IA'}: ${m.text.slice(0, 80)}`)
    .join(' | ');

  workerPost({
    accion:          'guardar_memoria',
    vendedor:        state.user.vendedor,
    cliente_id:      state.chatClienteId,
    resumen,
    turno_count:     state.chatHistory.length,
    acciones_tomadas: [],
  }).catch(() => {});
}

// ==========================================
// 9️⃣ FCM — Push Notifications
// ==========================================
async function initFCM() {
  try {
    if (!('serviceWorker' in navigator) || !window.firebase?.messaging) return;

    const messaging = firebase.messaging();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const token = await messaging.getToken();
    if (!token || !state.user?.vendedor) return;

    workerPost({
      accion:      'save_fcm_token',
      vendedor:    state.user.vendedor,
      token,
      dispositivo: navigator.userAgent.slice(0, 100),
    }).catch(() => {});
  } catch (_) {
    // FCM no disponible — silencioso
  }
}

// ==========================================
// 10️⃣ UI HELPERS
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

  if (percent < 30)       circle.style.stroke = '#ef4444';
  else if (percent < 70)  circle.style.stroke = '#eab308';
  else if (percent < 100) circle.style.stroke = '#10b981';
  else                    circle.style.stroke = '#3b82f6';
}

function initClock() {
  const update = () => {
    const elDate = el('header-date');
    if (!elDate) return;
    const now  = new Date();
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

function getThemeCardClass() {
  return THEMES[state.currentTheme].card;
}

function getStatusColor(dias) {
  if (dias > 60) return { bg: 'bg-red-500/20',     text: 'text-red-500' };
  if (dias > 30) return { bg: 'bg-orange-500/20',  text: 'text-orange-500' };
  return              { bg: 'bg-emerald-500/20',  text: 'text-emerald-500' };
}

function showIASuggestion() {
  // En v11 las sugerencias se piden al chat IA directamente
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
// 11️⃣ GEO
// ==========================================
function initGeo() {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (state.route.activeClients.length > 0) renderRouteList();
    },
    (err) => console.log('GPS:', err),
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
  const speed = 20;
  const mins = Math.round((km / speed) * 60);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
}

// ==========================================
// 12️⃣ VISTAS
// ==========================================
window.switchView = (id) => {
  document.querySelectorAll('.view-section').forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });
  const view = el(id);
  if (view) {
    view.style.display = 'flex';
    setTimeout(() => view.classList.add('active'), 10);
  }
};

window.toggleViewMode = () => {
  state.viewMode = state.viewMode === 'list' ? 'focus' : 'list';
  renderRouteList();
};

// ==========================================
// 13️⃣ UTILS
// ==========================================
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
