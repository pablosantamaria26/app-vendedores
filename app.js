// ==========================================
// 🔗 CONEXIÓN AL WORKER (CLOUDFLARE -> GAS)
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
    } else {
        switchView('view-login');
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

// ==========================================
// 1. LOGIN
// ==========================================
const handleLogin = async () => {
    const u = el('login-user').value.trim();
    const p = el('login-pass').value.trim();
    
    if (!u || !p) return alert('Ingresa usuario y PIN');

    toggleLoader(true);
    try {
        // action: 'login' coincide con GAS
        const res = await apiCall('login', { user: u, pass: p });
        state.user = res;
        localStorage.setItem('ml_user', JSON.stringify(res));
        switchView('view-main');
        loadData();
    } catch (e) { 
        alert('Error: ' + e.message); 
    }
    toggleLoader(false);
};

// ==========================================
// 2. CARGA DATOS (Ruta)
// ==========================================
const loadData = async () => {
    if (!state.user) return;
    el('lbl-saludo').innerText = `HOLA, ${state.user.user.toUpperCase()}`;
    
    // UI Loading state en la lista
    el('client-list').innerHTML = '<div class="text-center text-slate-500 py-10 animate-pulse">Sincronizando ruta...</div>';
    
    toggleLoader(true);
    try {
        // CORRECCION CRITICA: Backend espera 'get_clientes', no 'get_data'
        const data = await apiCall('get_clientes', { vendedor: state.user.vendedor });
        state.clients = data;
        renderList();
    } catch (e) { 
        console.error(e);
        el('client-list').innerHTML = `<div class="text-center text-red-400 py-10">Error al cargar: ${e.message}<br><button onclick="loadData()" class="mt-4 underline">Reintentar</button></div>`;
    }
    toggleLoader(false);
};

// ==========================================
// 3. RENDER LISTA
// ==========================================
const renderList = (filter = '') => {
    const container = el('client-list');
    container.innerHTML = '';
    const term = filter.toLowerCase();

    if (!state.clients || state.clients.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-500 py-10">No hay clientes asignados.</div>';
        return;
    }

    const list = state.clients.filter(c => 
        (c.nombre && c.nombre.toLowerCase().includes(term)) || 
        (c.localidad && c.localidad.toLowerCase().includes(term)) ||
        (c.direccion && c.direccion.toLowerCase().includes(term)) ||
        (c.id && c.id.includes(term))
    );

    if (list.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-500 py-4">No se encontraron resultados.</div>';
        return;
    }

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = 'client-card p-4 mb-3 shadow-sm';
        
        // Simulación básica de estado si el backend no lo trae
        const estado = c.estado || 'pendiente'; 
        
        // Estilos según estado
        const colors = {
            critico: 'text-red-400 border-red-500/30 bg-red-500/10',
            atencion: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
            aldia: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
            pendiente: 'text-blue-400 border-blue-500/30 bg-blue-500/10'
        };
        const stClass = colors[estado] || colors.pendiente;

        // Calcular dias (mockup si no viene del backend aun)
        const diasSinCompra = c.dias || '—';

        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="overflow-hidden">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">#${c.id} • ${c.localidad || 'Sin Loc.'}</span>
                    <h3 class="text-lg font-extrabold text-white leading-tight truncate pr-2">${c.nombre}</h3>
                </div>
                <div class="px-2 py-1 rounded-md border text-[10px] font-bold uppercase ${stClass} whitespace-nowrap">
                    ${estado}
                </div>
            </div>
            <p class="text-xs text-slate-400 mb-4 flex items-center gap-2 truncate">
                <i class="fas fa-map-marker-alt text-slate-600"></i> ${c.direccion || 'Sin dirección'}
            </p>
            <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                <div class="text-center">
                    <p class="text-[9px] text-slate-500 uppercase font-bold">Sin Compra</p>
                    <p class="text-sm font-bold text-white">${diasSinCompra > 900 ? 'Nunca' : diasSinCompra + ' días'}</p>
                </div>
                <button onclick="openModal('${c.id}')" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                    GESTIONAR
                </button>
            </div>
        `;
        container.appendChild(div);
    });
};

// ==========================================
// 4. GESTIÓN (MODAL & REGISTRO)
// ==========================================
window.openModal = (id) => {
    state.currentClient = state.clients.find(c => c.id === id);
    if(!state.currentClient) return;

    el('modal-client-name').innerText = state.currentClient.nombre;
    el('modal-client-address').innerText = state.currentClient.direccion || '';
    el('modal-action').classList.remove('hidden');
    el('input-obs').value = '';
    
    // Reset selection
    setRegType(null);
    state.regReason = '';
};

window.closeModal = () => {
    el('modal-action').classList.add('hidden');
    state.currentClient = null;
};

window.setRegType = (t) => {
    state.regType = t;
    const base = "p-4 rounded-2xl border font-bold transition-all w-full ";
    const activeP = "border-emerald-500 text-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
    const activeV = "border-orange-500 text-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.2)]";
    const inactive = "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700";

    el('btn-type-pedido').className = base + (t === 'pedido' ? activeP : inactive);
    el('btn-type-visita').className = base + (t === 'visita' ? activeV : inactive);
    
    const panelVisita = el('panel-visita');
    if (t === 'visita') {
        panelVisita.classList.remove('hidden');
    } else {
        panelVisita.classList.add('hidden');
    }
};

window.setReason = (r) => {
    state.regReason = r;
    document.querySelectorAll('.reason-btn').forEach(b => {
        if(b.innerText.includes(r)) {
            b.className = "reason-btn p-3 rounded-xl bg-blue-600 border border-blue-500 text-xs font-bold text-white shadow-lg scale-105 transition-transform";
        } else {
            b.className = "reason-btn p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 transition-colors";
        }
    });
};

window.saveAction = async () => {
    if(!state.regType) return alert('Debes seleccionar: PEDIDO o VISITA');
    if(state.regType === 'visita' && !state.regReason) return alert('Selecciona un motivo para la visita.');
    
    const obs = el('input-obs').value;
    
    toggleLoader(true);
    try {
        await apiCall('registrar_movimiento', {
            vendedor: state.user.vendedor,
            clienteId: state.currentClient.id,
            tipo: state.regType,
            motivo: state.regReason || '',
            observacion: obs
        });
        
        alert('✅ Movimiento registrado correctamente');
        closeModal();
        // Opcional: Recargar datos para actualizar fechas
        // loadData(); 
    } catch(e) { 
        alert('Error al guardar: ' + e.message); 
    }
    toggleLoader(false);
};

// ==========================================
// 5. IA CHATBOT
// ==========================================
window.toggleAI = (s) => el('ai-panel').classList.toggle('translate-y-full', !s);

window.handleAISend = async () => {
    const input = el('ai-input');
    const val = input.value.trim();
    if(!val) return;
    
    addMsg('user', val);
    input.value = '';
    input.focus();

    // Mostrar "Escribiendo..." temporal
    const loadingId = addMsg('bot', 'Pensando...', true);

    try {
        // CORRECCION CRITICA: Backend espera 'chatbot', no 'chat_bot'
        const res = await apiCall('chatbot', { 
            vendedor: state.user.vendedor, 
            message: val 
        });
        
        // Remover mensaje de carga y poner respuesta real
        document.getElementById(loadingId).remove();
        addMsg('bot', formatAIMessage(res.respuesta));
        
    } catch(e) { 
        document.getElementById(loadingId).innerText = 'Error de conexión con IA.';
        console.error(e);
    }
};

const addMsg = (role, txt, isLoading = false) => {
    const container = el('chat-content');
    const divWrapper = document.createElement('div');
    divWrapper.className = `flex flex-col gap-1 items-${role === 'user' ? 'end' : 'start'} max-w-[85%] animate-fade-in`;
    
    const divMsg = document.createElement('div');
    divMsg.className = `p-4 text-sm leading-relaxed shadow-md ${role === 'user' ? 'msg-user' : 'msg-bot'}`;
    
    if (isLoading) {
        divMsg.id = 'ai-loading-' + Date.now();
        divMsg.innerText = txt;
        divMsg.classList.add('animate-pulse');
    } else {
        divMsg.innerHTML = txt; // Usar innerHTML para respetar formato
    }

    divWrapper.appendChild(divMsg);
    
    if(role === 'bot' && !isLoading) {
        const lbl = document.createElement('span');
        lbl.className = "text-[10px] text-slate-600 font-bold ml-1";
        lbl.innerText = "IA";
        divWrapper.appendChild(lbl);
    }

    container.appendChild(divWrapper);
    container.scrollTop = container.scrollHeight;
    return divMsg.id;
};

// Formateador simple para que la respuesta de Gemini se vea bien en HTML
const formatAIMessage = (text) => {
    if (!text) return "Sin respuesta.";
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') // Negritas
        .replace(/\*(.*?)\*/g, '<em class="text-blue-300">$1</em>'); // Cursivas
};

// ==========================================
// 6. FETCH CENTRALIZADO (WORKER)
// ==========================================
async function apiCall(action, payload) {
    console.log(`📡 API CALL: ${action}`, payload);
    
    const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
    });
    
    // Si el worker devuelve error HTTP (ej: 500)
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const json = await res.json();
    console.log(`📥 API RESP:`, json);

    // Verificar status del sobre JSON que envia tu code.gs
    if(json.status !== 'success') {
        throw new Error(json.message || 'Error desconocido en servidor');
    }
    
    return json.data;
}
