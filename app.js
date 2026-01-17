// ⚠️ TU URL DE WORKER
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 


const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    currentClient: null,
    regType: null,
    regReason: ''
};

// ELEMENTOS DOM
const el = (id) => document.getElementById(id);
const views = { login: el('view-login'), main: el('view-main') };

// INICIO
const init = () => {
    if (state.user) {
        switchView('main');
        loadData();
    }
    
    // Listeners
    el('btn-login').onclick = handleLogin;
    el('search-input').oninput = (e) => renderList(e.target.value);
    el('ai-input').onkeydown = (e) => e.key === 'Enter' && handleAISend();
};

const switchView = (vName) => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[vName].classList.add('active');
};

const toggleLoader = (show) => el('loader').classList.toggle('hidden', !show);

// 1. LOGIN
const handleLogin = async () => {
    const u = el('login-user').value;
    const p = el('login-pass').value;
    if(!u || !p) return alert('Datos incompletos');

    toggleLoader(true);
    try {
        const res = await apiCall('login', { user: u, pass: p });
        state.user = res;
        localStorage.setItem('ml_user', JSON.stringify(res));
        switchView('main');
        loadData();
    } catch (e) { alert(e.message); }
    toggleLoader(false);
};

// 2. CARGAR DATOS
const loadData = async () => {
    toggleLoader(true);
    try {
        el('lbl-saludo').innerText = `HOLA, ${state.user.user.toUpperCase()}`;
        const data = await apiCall('get_data', { vendedor: state.user.vendedor });
        state.clients = data;
        renderList();
    } catch (e) { console.error(e); }
    toggleLoader(false);
};

// 3. RENDERIZADO LISTA
const renderList = (filter = '') => {
    const container = el('client-list');
    container.innerHTML = '';
    
    const term = filter.toLowerCase();
    const list = state.clients.filter(c => 
        c.nombre.toLowerCase().includes(term) || 
        c.id.includes(term) || 
        c.localidad.toLowerCase().includes(term)
    );

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'custom-card rounded-2xl p-4 relative overflow-hidden';
        
        // Colores según estado
        const colors = {
            critico: 'bg-red-500', atencion: 'bg-orange-500', nuevo: 'bg-blue-500', aldia: 'bg-emerald-500'
        };
        const color = colors[c.estado] || 'bg-slate-500';

        div.innerHTML = `
            <div class="absolute left-0 top-0 bottom-0 w-1 ${color}"></div>
            <div class="flex justify-between items-start mb-1 pl-2">
                <span class="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded uppercase">#${c.id}</span>
                <span class="text-[9px] font-extrabold ${color} text-white px-2 py-0.5 rounded uppercase">${c.estado}</span>
            </div>
            <h3 class="pl-2 font-bold text-lg text-white leading-tight truncate">${c.nombre}</h3>
            <p class="pl-2 text-xs text-slate-400 mb-3 flex items-center gap-1"><i class="fas fa-map-marker-alt text-slate-600"></i> ${c.direccion}, ${c.localidad}</p>
            
            <div class="pl-2 grid grid-cols-2 gap-2">
                 <div class="bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    <p class="text-[9px] text-slate-500 uppercase font-bold">Sin Compra</p>
                    <p class="text-sm font-bold text-white">${c.dias > 900 ? 'NUNCA' : c.dias + ' días'}</p>
                 </div>
                 <button class="bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-lg border border-slate-700" onclick="openModal('${c.id}')">
                    REGISTRAR <i class="fas fa-arrow-right ml-1"></i>
                 </button>
            </div>
        `;
        container.appendChild(div);
    });
};

// 4. MODAL ACCIONES
window.openModal = (id) => {
    state.currentClient = state.clients.find(c => c.id === id);
    el('modal-client-name').innerText = state.currentClient.nombre;
    el('modal-action').classList.remove('hidden');
    window.setRegType(null);
};

window.closeModal = () => {
    el('modal-action').classList.add('hidden');
    state.currentClient = null;
};

window.setRegType = (type) => {
    state.regType = type;
    
    // UI Updates
    el('btn-type-visita').className = `p-4 rounded-xl border font-bold transition-all ${type === 'visita' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-slate-800 text-slate-400 bg-slate-900'}`;
    el('btn-type-venta').className = `p-4 rounded-xl border font-bold transition-all ${type === 'venta' ? 'border-blue-500 text-blue-500 bg-blue-500/10' : 'border-slate-800 text-slate-400 bg-slate-900'}`;

    el('panel-venta').classList.toggle('hidden', type !== 'venta');
    el('panel-visita').classList.toggle('hidden', type !== 'visita');
};

window.setReason = (reason) => {
    state.regReason = reason;
    document.querySelectorAll('.reason-btn').forEach(b => {
        if(b.innerText.includes(reason)) b.classList.replace('border-slate-800', 'border-blue-500');
        else b.classList.replace('border-blue-500', 'border-slate-800');
    });
};

window.saveAction = async () => {
    if(!state.regType) return alert('Selecciona tipo');
    
    const payload = {
        vendedor: state.user.vendedor,
        clienteId: state.currentClient.id,
        tipo: state.regType,
        monto: el('input-monto').value,
        motivo: state.regReason,
        observacion: el('input-obs').value
    };

    toggleLoader(true);
    try {
        await apiCall('save_action', payload);
        alert('Guardado correctamente');
        closeModal();
        loadData(); // Recargar para actualizar días
    } catch(e) { alert('Error al guardar'); }
    toggleLoader(false);
};

// 5. INTELIGENCIA ARTIFICIAL (Proxy)
window.toggleAI = (show) => {
    el('ai-panel').classList.toggle('translate-y-full', !show);
    if(show) setTimeout(() => el('ai-input').focus(), 300);
};

window.askAI = (txt) => {
    el('ai-input').value = txt;
    handleAISend();
};

window.handleAISend = async () => {
    const txt = el('ai-input').value.trim();
    if(!txt) return;

    addMsg('user', txt);
    el('ai-input').value = '';

    // Preparar contexto ligero (Top 20 clientes relevantes o filtrados)
    const contextLite = state.clients.slice(0, 30).map(c => ({
        n: c.nombre, d: c.dias, est: c.estado, 
        last: c.ultimo_pedido ? c.ultimo_pedido.substring(0, 50) : 'N/A'
    }));

    try {
        addMsg('bot', '<i class="fas fa-circle-notch fa-spin"></i> Pensando...');
        const res = await apiCall('chat_ai', { message: txt, context: contextLite });
        el('chat-content').lastChild.remove(); // Quitar loader
        addMsg('bot', res);
    } catch(e) {
        addMsg('bot', 'Error de conexión.');
    }
};

const addMsg = (role, html) => {
    const div = document.createElement('div');
    div.className = `p-4 rounded-2xl text-sm leading-relaxed max-w-[85%] animate-slide-up ${role === 'user' ? 'bg-blue-600 text-white ml-auto rounded-br-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'}`;
    div.innerHTML = html;
    el('chat-content').appendChild(div);
    el('chat-content').scrollTop = el('chat-content').scrollHeight;
};

// UTIL: Copiar Pedido
window.copyOrder = (btn) => {
    const txt = btn.parentElement.innerText.replace('COPIAR', '');
    navigator.clipboard.writeText(txt);
    const old = btn.innerText;
    btn.innerText = "¡COPIADO!";
    setTimeout(() => btn.innerText = old, 2000);
};

// API HELPER
async function apiCall(action, payload) {
    const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action, payload })
    });
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message);
    return json.data;
}

// Iniciar
init();
