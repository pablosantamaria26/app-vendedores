// ==========================================
// 🔗 CONEXIÓN AL WORKER (CORAZÓN DE LA APP)
// ==========================================
const WORKER_URL = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev/'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    currentClient: null,
    regType: null, // 'pedido' o 'visita'
    regReason: ''
};

// Selectores cortos
const el = (id) => document.getElementById(id);
const toggleLoader = (s) => el('loader').classList.toggle('hidden', !s);

// INIT
document.addEventListener('DOMContentLoaded', () => {
    if (state.user) {
        switchView('view-main');
        loadData();
    }
    // Eventos
    el('btn-login').onclick = handleLogin;
    el('search-input').oninput = (e) => renderList(e.target.value);
    el('ai-input').onkeydown = (e) => e.key === 'Enter' && handleAISend();
});

const switchView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    el(id).classList.add('active');
};

// 1. LOGIN (REAL)
const handleLogin = async () => {
    const u = el('login-user').value.trim();
    const p = el('login-pass').value.trim();
    if (!u || !p) return alert('Ingresa usuario y PIN');

    toggleLoader(true);
    try {
        const res = await apiCall('login', { user: u, pass: p });
        state.user = res;
        localStorage.setItem('ml_user', JSON.stringify(res));
        switchView('view-main');
        loadData();
    } catch (e) { alert('Error: ' + e.message); }
    toggleLoader(false);
};

// 2. CARGA DATOS
const loadData = async () => {
    el('lbl-saludo').innerText = `HOLA, ${state.user.user.toUpperCase()}`;
    toggleLoader(true);
    try {
        const data = await apiCall('get_data', { vendedor: state.user.vendedor });
        state.clients = data;
        renderList();
    } catch (e) { console.error(e); }
    toggleLoader(false);
};

// 3. RENDER LISTA (LIMPIO)
const renderList = (filter = '') => {
    const container = el('client-list');
    container.innerHTML = '';
    const term = filter.toLowerCase();

    const list = state.clients.filter(c => 
        c.nombre.toLowerCase().includes(term) || 
        c.localidad.toLowerCase().includes(term) ||
        c.id.includes(term)
    );

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'client-card p-4 mb-3';
        
        // Estilos según estado (Semáforo)
        const colors = {
            critico: 'text-red-500 border-red-500 bg-red-500/10',
            atencion: 'text-orange-400 border-orange-400 bg-orange-500/10',
            aldia: 'text-emerald-500 border-emerald-500 bg-emerald-500/10',
            nuevo: 'text-blue-500 border-blue-500 bg-blue-500/10'
        };
        const stClass = colors[c.estado] || colors.nuevo;

        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="text-[10px] font-bold text-slate-500 uppercase">#${c.id} • ${c.localidad}</span>
                    <h3 class="text-lg font-extrabold text-white leading-tight">${c.nombre}</h3>
                </div>
                <div class="px-2 py-1 rounded-md border text-[10px] font-bold uppercase ${stClass}">
                    ${c.estado}
                </div>
            </div>
            <p class="text-xs text-slate-400 mb-4 flex items-center gap-1">
                <i class="fas fa-map-marker-alt text-slate-600"></i> ${c.direccion}
            </p>
            <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                <div class="text-center">
                    <p class="text-[9px] text-slate-500 uppercase font-bold">Sin Compra</p>
                    <p class="text-sm font-bold text-white">${c.dias > 900 ? 'NUNCA' : c.dias + ' días'}</p>
                </div>
                <button onclick="openModal('${c.id}')" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                    GESTIONAR
                </button>
            </div>
        `;
        container.appendChild(div);
    });
};

// 4. MODAL
window.openModal = (id) => {
    state.currentClient = state.clients.find(c => c.id === id);
    el('modal-client-name').innerText = state.currentClient.nombre;
    el('modal-action').classList.remove('hidden');
    setRegType(null);
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
    state.regReason = r;
    document.querySelectorAll('.reason-btn').forEach(b => {
        if(b.innerText.includes(r)) b.className = "reason-btn p-3 rounded-xl bg-blue-600 border border-blue-500 text-xs font-bold text-white shadow-lg";
        else b.className = "reason-btn p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300";
    });
};

window.saveAction = async () => {
    if(!state.regType) return alert('Selecciona tipo');
    
    toggleLoader(true);
    try {
        await apiCall('registrar_movimiento', {
            vendedor: state.user.vendedor,
            clienteId: state.currentClient.id,
            tipo: state.regType,
            motivo: state.regReason,
            observacion: el('input-obs').value
        });
        alert('Registro Exitoso');
        closeModal();
        loadData(); // Refrescar lista
    } catch(e) { alert('Error: ' + e.message); }
    toggleLoader(false);
};

// 5. IA
window.toggleAI = (s) => el('ai-panel').classList.toggle('translate-y-full', !s);
window.handleAISend = async () => {
    const val = el('ai-input').value;
    if(!val) return;
    
    addMsg('user', val);
    el('ai-input').value = '';

    try {
        const res = await apiCall('chat_bot', { 
            vendedor: state.user.vendedor, 
            message: val 
        });
        addMsg('bot', res);
    } catch(e) { addMsg('bot', 'Error de conexión IA'); }
};

const addMsg = (role, txt) => {
    const div = document.createElement('div');
    div.className = `p-4 rounded-2xl text-sm leading-relaxed max-w-[85%] ${role === 'user' ? 'bg-blue-600 text-white ml-auto rounded-br-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'}`;
    div.innerText = txt;
    el('chat-content').appendChild(div);
    el('chat-content').scrollTop = el('chat-content').scrollHeight;
};

// FETCH CENTRALIZADO AL WORKER
async function apiCall(action, payload) {
    const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
    });
    
    const json = await res.json();
    if(json.status !== 'success') throw new Error(json.message || 'Error en servidor');
    return json.data;
}
