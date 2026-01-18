// ==========================================
// 🔗 CONEXIÓN AL WORKER (CORAZÓN DE LA APP)
// ==========================================
const WORKER_URL = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev/';

const state = {
  user: JSON.parse(localStorage.getItem('ml_user')) || null,
  clients: [],
  currentClient: null,
  regType: null,     // 'pedido' o 'visita'
  regReason: '',
  lastQuery: ''
};

// Selectores cortos
const el = (id) => document.getElementById(id);
const toggleLoader = (s) => el('loader')?.classList.toggle('hidden', !s);

// INIT
document.addEventListener('DOMContentLoaded', () => {
  if (state.user) {
    switchView('view-main');
    loadData();
  }

  // Eventos base
  el('btn-login').onclick = handleLogin;
  el('search-input').oninput = (e) => {
    state.lastQuery = e.target.value || '';
    renderList(state.lastQuery);
  };

  // IA enter
  el('ai-input').onkeydown = (e) => e.key === 'Enter' && handleAISend();
});

// Vista
const switchView = (id) => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  el(id).classList.add('active');
};

// ==========================================
// 1) LOGIN
// ==========================================
const handleLogin = async () => {
  const u = el('login-user').value.trim();
  const p = el('login-pass').value.trim();
  if (!u || !p) return alert('Ingresa usuario y PIN');

  toggleLoader(true);
  try {
    // action correcto en GAS: login
    const res = await apiCall('login', { user: u, pass: p });
    state.user = res;
    localStorage.setItem('ml_user', JSON.stringify(res));
    switchView('view-main');
    loadData();
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    toggleLoader(false);
  }
};

// ==========================================
// 2) CARGA DATOS (CLIENTES + ESTADO)
// ==========================================
const loadData = async () => {
  el('lbl-saludo').innerText = `HOLA, ${state.user.user.toUpperCase()}`;

  toggleLoader(true);
  try {
    // action correcto en GAS: get_clientes
    // payload: { vendedor }
    const list = await apiCall('get_clientes', { vendedor: state.user.vendedor });

    // El backend idealmente ya trae dias/estado. Si no, “fallback” defensivo.
    state.clients = (list || []).map(c => ({
      ...c,
      dias: (typeof c.dias === 'number') ? c.dias : (Number(c.dias) || 999),
      estado: c.estado || inferEstado_(Number(c.dias) || 999)
    }));

    renderList(state.lastQuery);
  } catch (e) {
    console.error(e);
    alert('Error cargando clientes: ' + e.message);
  } finally {
    toggleLoader(false);
  }
};

// fallback si backend no manda estado
function inferEstado_(dias) {
  if (!isFinite(dias) || dias >= 900) return 'nuevo';       // nunca
  if (dias >= 60) return 'critico';
  if (dias >= 30) return 'atencion';
  return 'aldia';
}

// ==========================================
// 3) RENDER LISTA
// ==========================================
const renderList = (filter = '') => {
  const container = el('client-list');
  container.innerHTML = '';

  const term = String(filter || '').toLowerCase().trim();

  const list = state.clients.filter(c => {
    const nombre = String(c.nombre || '').toLowerCase();
    const localidad = String(c.localidad || '').toLowerCase();
    const id = String(c.id || '');
    return (
      !term ||
      nombre.includes(term) ||
      localidad.includes(term) ||
      id.includes(term)
    );
  });

  list.forEach(c => {
    const div = document.createElement('div');
    div.className = 'client-card p-4 mb-3';

    // Semáforo
    const colors = {
      critico: 'text-red-500 border-red-500 bg-red-500/10',
      atencion: 'text-orange-400 border-orange-400 bg-orange-500/10',
      aldia: 'text-emerald-500 border-emerald-500 bg-emerald-500/10',
      nuevo: 'text-blue-500 border-blue-500 bg-blue-500/10'
    };
    const stClass = colors[c.estado] || colors.nuevo;

    const diasTxt = (c.dias > 900) ? 'NUNCA' : `${c.dias} días`;

    div.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase">#${escapeHtml_(c.id)} • ${escapeHtml_(c.localidad || '')}</span>
          <h3 class="text-lg font-extrabold text-white leading-tight">${escapeHtml_(c.nombre || '')}</h3>
        </div>
        <div class="px-2 py-1 rounded-md border text-[10px] font-bold uppercase ${stClass}">
          ${escapeHtml_(c.estado || 'nuevo')}
        </div>
      </div>

      <p class="text-xs text-slate-400 mb-4 flex items-center gap-1">
        <i class="fas fa-map-marker-alt text-slate-600"></i> ${escapeHtml_(c.direccion || '')}
      </p>

      <div class="flex items-center justify-between pt-3 border-t border-slate-800">
        <div class="text-center">
          <p class="text-[9px] text-slate-500 uppercase font-bold">Sin Compra</p>
          <p class="text-sm font-bold text-white">${escapeHtml_(diasTxt)}</p>
        </div>
        <button onclick="openModal('${escapeJs_(String(c.id))}')" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
          GESTIONAR
        </button>
      </div>
    `;

    container.appendChild(div);
  });
};

// Helpers anti-inyección básica (no cambia tu UI, solo protege)
function escapeHtml_(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function escapeJs_(s) {
  return String(s ?? '').replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

// ==========================================
// 4) MODAL / REGISTRO
// ==========================================
window.openModal = async (id) => {
  state.currentClient = state.clients.find(c => String(c.id) === String(id));
  if (!state.currentClient) return alert('Cliente no encontrado en lista');

  el('modal-client-name').innerText = state.currentClient.nombre || '';
  el('modal-action').classList.remove('hidden');

  // Reset UI modal
  setRegType(null);
  state.regReason = '';
  el('input-obs').value = '';

  // Opcional: si querés “ficha completa” al abrir
  // (esto requiere que el backend api_get_cliente funcione como corresponde)
  try {
    const ficha = await apiCall('get_cliente', { clienteId: String(id) });
    // Si querés mostrar algo extra, acá tenés "ficha"
    // console.log('Ficha cliente:', ficha);
  } catch (e) {
    // No rompemos la UX si falla
    console.warn('No se pudo cargar ficha:', e.message);
  }
};

window.closeModal = () => {
  el('modal-action').classList.add('hidden');
  state.currentClient = null;
};

window.setRegType = (t) => {
  state.regType = t;

  const base = "p-4 rounded-2xl border font-bold transition-all ";
  const activeP = "border-emerald-500 text-emerald-500 bg-emerald-500/10";
  const activeV = "border-orange-500 text-orange-500 bg-orange-500/10";
  const inactive = "border-slate-800 bg-slate-900 text-slate-400";

  el('btn-type-pedido').className = base + (t === 'pedido' ? activeP : inactive);
  el('btn-type-visita').className = base + (t === 'visita' ? activeV : inactive);

  el('panel-visita').classList.toggle('hidden', t !== 'visita');
};

window.setReason = (r) => {
  state.regReason = r || '';
  document.querySelectorAll('.reason-btn').forEach(b => {
    if (b.innerText.includes(r)) {
      b.className = "reason-btn p-3 rounded-xl bg-blue-600 border border-blue-500 text-xs font-bold text-white shadow-lg";
    } else {
      b.className = "reason-btn p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300";
    }
  });
};

window.saveAction = async () => {
  if (!state.currentClient) return alert('No hay cliente seleccionado');
  if (!state.regType) return alert('Selecciona tipo');
  if (state.regType === 'visita' && !state.regReason) return alert('Selecciona motivo');

  toggleLoader(true);
  try {
    // action correcto: registrar_movimiento
    await apiCall('registrar_movimiento', {
      vendedor: state.user.vendedor,
      clienteId: state.currentClient.id,
      tipo: state.regType,
      motivo: state.regReason,           // IMPORTANTE: backend debe guardar motivo
      observacion: el('input-obs').value || ''
    });

    alert('Registro Exitoso');
    closeModal();

    // Recargar lista (para refrescar dias/estado)
    await loadData();
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    toggleLoader(false);
  }
};

// ==========================================
// 5) IA (PANEL CHAT)
// ==========================================
window.toggleAI = (s) => el('ai-panel').classList.toggle('translate-y-full', !s);

window.handleAISend = async () => {
  const val = (el('ai-input').value || '').trim();
  if (!val) return;

  addMsg('user', val);
  el('ai-input').value = '';

  try {
    // action correcto en GAS: chatbot
    // payload que tu api_chatBot lee: vendedor + (mensaje o message)
    const res = await apiCall('chatbot', {
      vendedor: state.user.vendedor,
      mensaje: val
    });

    // res viene como { respuesta: "...texto..." }
    addMsg('bot', res?.respuesta || 'Sin respuesta');
  } catch (e) {
    addMsg('bot', 'Error de conexión IA: ' + (e.message || ''));
  }
};

const addMsg = (role, txt) => {
  const div = document.createElement('div');
  div.className = `p-4 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
    role === 'user'
      ? 'bg-blue-600 text-white ml-auto rounded-br-none'
      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
  }`;
  div.innerText = String(txt || '');
  el('chat-content').appendChild(div);
  el('chat-content').scrollTop = el('chat-content').scrollHeight;
};

// ==========================================
// FETCH CENTRALIZADO AL WORKER
// ==========================================
async function apiCall(action, payload) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });

  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Error en servidor');
  return json.data;
}
