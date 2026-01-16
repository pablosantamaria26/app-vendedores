// ⚠️ PEGA AQUÍ TU WORKER ACTUALIZADO
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    selectedZones: new Set(),
    route: [],
    currentClient: null,
    regMode: null, // 'venta' o 'no-compra'
    regReason: '',
    metrics: { visitas: 0, ventas: 0, racha: 0 },
    coords: ''
};

const app = {
    init: () => {
        if(state.user) app.loadData();
        navigator.geolocation.getCurrentPosition(p => state.coords = `${p.coords.latitude},${p.coords.longitude}`);
        
        // --- AUTO LOGIN LOGIC ---
        const passInput = document.getElementById('pass');
        if(passInput) {
            passInput.addEventListener('input', (e) => {
                if(e.target.value.length === 4) app.login();
            });
        }
    },

    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        if(p.length < 4) return; // Evitar disparos falsos
        
        app.loader(true);
        try {
            const r = await fetch(WORKER, { method:'POST', body:JSON.stringify({ action:'login', payload:{user:u, pass:p} }) });
            const d = await r.json();
            if(d.status==='success') {
                state.user = d.data;
                localStorage.setItem('ml_user', JSON.stringify(d.data));
                app.loadData();
                bot.checkEvents();
            } else {
                alert('ACCESO DENEGADO');
                document.getElementById('pass').value = ''; // Limpiar para reintentar rápido
            }
        } catch(e) { alert('SIN CONEXIÓN'); }
        app.loader(false);
    },

    loadData: async () => {
        app.loader(true);
        app.show('view-zonas');
        try {
            const r = await fetch(WORKER, { method:'POST', body:JSON.stringify({ action:'get_data_inicial', payload:{vendedorAsignado:state.user.vendedorAsignado} }) });
            const d = await r.json();
            if(d.status==='success') {
                state.clients = d.data.clientes;
                document.getElementById('lbl-user').innerText = state.user.usuario.toUpperCase();
                app.renderZones();
            }
        } catch(e){ console.error(e); }
        app.loader(false);
    },

    // --- LÓGICA DE AGRUPACIÓN Y DEDUPLICACIÓN ---
    renderZones: () => {
        const zones = {};
        const processedIDs = new Set(); // Para evitar duplicados por ID Cliente

        state.clients.forEach(c => {
            // 1. Deduplicación por ID
            if(processedIDs.has(c.id)) return; 
            processedIDs.add(c.id);

            // 2. Normalización de Zona (Mar de Ajo = MAR DE AJO)
            const zName = (c.localidad || 'SIN ZONA').trim().toUpperCase();
            
            if(!zones[zName]) zones[zName] = 0;
            zones[zName]++;
            
            // Guardamos la versión normalizada en el objeto cliente en memoria para filtrar fácil después
            c._zonaNorm = zName;
        });

        const grid = document.getElementById('grid-zonas');
        grid.innerHTML = '';
        Object.keys(zones).sort().forEach(z => {
            const div = document.createElement('div');
            div.className = 'zone-card';
            div.innerHTML = `<div class="zone-title">${z}</div><div class="zone-count">${zones[z]}</div>`;
            div.onclick = () => {
                if(state.selectedZones.has(z)) { state.selectedZones.delete(z); div.classList.remove('selected'); }
                else { state.selectedZones.add(z); div.classList.add('selected'); }
            };
            grid.appendChild(div);
        });
    },

    buildRoute: () => {
        if(state.selectedZones.size === 0) return alert('SELECCIONA UNA ZONA');
        // Filtramos usando la zona normalizada
        state.route = state.clients.filter(c => c._zonaNorm && state.selectedZones.has(c._zonaNorm));
        app.renderRouteList();
        app.show('view-route');
    },

    renderRouteList: () => {
        const ctn = document.getElementById('route-list');
        ctn.innerHTML = '';
        state.route.forEach(c => {
            const div = document.createElement('div');
            div.className = `client-card ${c.estado}`;
            div.innerHTML = `
                <div>
                    <div class="c-name">${c.nombre}</div>
                    <div class="c-addr">${c.direccion}</div>
                </div>
                <div><i class="fas fa-chevron-right" style="color:#334155"></i></div>
            `;
            div.onclick = () => {
                state.currentClient = c;
                app.openModal();
            };
            ctn.appendChild(div);
        });
    },

    // --- MODAL Y REGISTRO ---
    openModal: () => {
        document.getElementById('modal-action').classList.remove('hidden');
        app.setMode('venta'); // Default
        state.regReason = '';
        document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('active'));
    },
    closeModal: () => document.getElementById('modal-action').classList.add('hidden'),

    setMode: (m) => {
        state.regMode = m;
        document.getElementById('btn-mode-si').className = m === 'venta' ? 'btn btn-primary' : 'btn btn-outline';
        document.getElementById('btn-mode-no').className = m === 'no-compra' ? 'btn btn-danger' : 'btn btn-outline'; // Rojo si es no-compra
        
        const panelNo = document.getElementById('panel-no-compra');
        if(m === 'no-compra') panelNo.classList.remove('hidden');
        else panelNo.classList.add('hidden');
    },

    setReason: (r, el) => {
        state.regReason = r;
        document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
    },

    submit: async () => {
        if(state.regMode === 'no-compra' && !state.regReason) return alert('SELECCIONA UN MOTIVO');
        
        const obs = document.getElementById('obs').value;
        app.closeModal();
        app.loader(true);

        // Métricas locales
        state.metrics.visitas++;
        if(state.regMode === 'venta') {
            state.metrics.ventas++;
            state.metrics.racha = 0;
        } else {
            state.metrics.racha++;
        }

        fetch(WORKER, {
            method: 'POST',
            body: JSON.stringify({
                action: 'registrar_movimiento',
                payload: {
                    vendedor: state.user.vendedorAsignado,
                    clienteId: state.currentClient.id,
                    tipo: state.regMode === 'venta' ? 'venta' : 'visita',
                    motivo: state.regReason,
                    observacion: obs,
                    coords: state.coords
                }
            })
        });

        document.getElementById('obs').value = '';
        setTimeout(() => bot.checkEvents(), 1000); // Check IA
        app.loader(false);
    },

    // UTILS
    show: (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    logout: () => { localStorage.removeItem('ml_user'); location.reload(); },
    loader: (s) => document.getElementById('loader').classList.toggle('hidden', !s)
};

// --- COPILOTO ---
const bot = {
    toggle: () => document.getElementById('ai-panel').classList.toggle('open'),
    checkEvents: async () => {
        try {
            const r = await fetch(WORKER, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'check_events',
                    payload: { 
                        vendedor: state.user.vendedorAsignado, 
                        visitasTotal: state.metrics.visitas, 
                        ventasTotal: state.metrics.ventas 
                    }
                })
            });
            const d = await r.json();
            if(d.status === 'success' && d.data.hayEvento) {
                bot.addMsg(d.data.evento.msg, true);
                bot.toggle(); // Abrir panel si hay evento importante
            }
        } catch(e){}
    },
    send: async () => {
        const inp = document.getElementById('chat-inp');
        const txt = inp.value;
        if(!txt) return;
        
        bot.addMsg(txt, false);
        inp.value = '';
        
        try {
            const r = await fetch(WORKER, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'chat_bot',
                    payload: { mensajeUsuario: txt, contextoCliente: state.currentClient }
                })
            });
            const d = await r.json();
            if(d.status==='success') bot.addMsg(d.data.respuesta, true);
        } catch(e) { bot.addMsg("Error de conexión", true); }
    },
    addMsg: (txt, isBot) => {
        const ctn = document.getElementById('chat-content');
        const d = document.createElement('div');
        d.className = 'ai-msg';
        d.style.borderColor = isBot ? 'var(--primary)' : 'var(--text-sec)';
        d.innerHTML = `<strong>${isBot ? 'IA' : 'VOS'}:</strong> ${txt}`;
        ctn.appendChild(d);
        ctn.scrollTop = ctn.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', app.init);
