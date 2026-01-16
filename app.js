// ⚠️ TU WORKER
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    selectedZones: new Set(),
    route: [],
    metrics: { ventas: 0, visitas: 0, rachaNegativa: 0 }, // Métricas locales para decisión rápida
    currentClient: null,
    coords: ''
};

const app = {
    init: () => {
        if(state.user) app.loadData();
        navigator.geolocation.getCurrentPosition(p => state.coords = `${p.coords.latitude},${p.coords.longitude}`);
    },

    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        app.loader(true);
        try {
            const r = await fetch(WORKER, { method:'POST', body:JSON.stringify({ action:'login', payload:{user:u, pass:p} }) });
            const d = await r.json();
            if(d.status==='success') {
                state.user = d.data;
                localStorage.setItem('ml_user', JSON.stringify(d.data));
                app.loadData();
                bot.checkEvents(); // ⚡ PRIMER CHECK AL ENTRAR
            } else alert(d.message);
        } catch(e) { alert('Error red'); }
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
                document.getElementById('lbl-user').innerText = state.user.usuario;
                app.renderZones();
            }
        } catch(e){console.error(e);}
        app.loader(false);
    },

    renderZones: () => {
        const zones = {};
        state.clients.forEach(c => { zones[c.localidad] = (zones[c.localidad]||0)+1; });
        const ctn = document.getElementById('container-zonas');
        ctn.innerHTML = '';
        Object.keys(zones).forEach(z => {
            const div = document.createElement('div');
            div.className = 'card-zona';
            div.innerHTML = `<h3>${z}</h3><small>${zones[z]} clientes</small>`;
            div.onclick = () => {
                if(state.selectedZones.has(z)) { state.selectedZones.delete(z); div.classList.remove('selected'); }
                else { state.selectedZones.add(z); div.classList.add('selected'); }
            };
            ctn.appendChild(div);
        });
    },

    buildRoute: () => {
        if(state.selectedZones.size===0) return alert('Selecciona zona');
        state.route = state.clients.filter(c => state.selectedZones.has(c.localidad));
        app.renderRoute();
        app.show('view-route');
    },

    renderRoute: () => {
        const ctn = document.getElementById('route-list');
        ctn.innerHTML = '';
        state.route.forEach(c => {
            const div = document.createElement('div');
            div.className = `client-item ${c.estado}`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;"><strong>${c.nombre}</strong> <small>${c.estado.toUpperCase()}</small></div>
                <div style="color:#64748b; font-size:14px;">${c.direccion}</div>`;
            div.onclick = () => { state.currentClient = c; document.getElementById('modal-action').classList.remove('hidden'); };
            ctn.appendChild(div);
        });
    },

    saveAction: (type) => { state.lastAction = type; }, // Helper UI

    submit: async () => {
        const obs = document.getElementById('obs').value;
        app.loader(true);
        document.getElementById('modal-action').classList.add('hidden');

        // Actualizar métricas locales
        state.metrics.visitas++;
        if(state.lastAction === 'venta') {
            state.metrics.ventas++;
            state.metrics.rachaNegativa = 0;
        } else {
            state.metrics.rachaNegativa++;
        }

        // Enviar a backend
        fetch(WORKER, {
            method: 'POST',
            body: JSON.stringify({
                action: 'registrar_movimiento',
                payload: {
                    vendedor: state.user.vendedorAsignado,
                    clienteId: state.currentClient.id,
                    tipo: state.lastAction,
                    motivo: state.lastAction==='visita'?'No compra':'',
                    observacion: obs,
                    coords: state.coords
                }
            })
        });

        // ⚡ CHECK AUTOMÁTICO DE EVENTOS POST-VISITA
        setTimeout(() => bot.checkEvents(), 1500);

        document.getElementById('obs').value = '';
        app.loader(false);
    },

    show: (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    toggleTheme: () => {
        const b = document.body;
        b.dataset.theme = b.dataset.theme === 'enfoque' ? 'energia' : 'enfoque';
    },
    loader: (s) => document.getElementById('loader').classList.toggle('hidden', !s)
};

// ==========================================
// 🤖 CONTROLADOR BOT (Copiloto)
// ==========================================
const bot = {
    checkEvents: async () => {
        // Consultar al backend si hay algo que decir
        try {
            const r = await fetch(WORKER, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'check_events',
                    payload: {
                        vendedor: state.user.vendedorAsignado,
                        visitasTotal: state.metrics.visitas,
                        ventasTotal: state.metrics.ventas,
                        rachaNegativa: state.metrics.rachaNegativa
                    }
                })
            });
            const d = await r.json();
            
            // Si el backend devuelve un evento, abrimos el modal
            if(d.status === 'success' && d.data.hayEvento) {
                bot.open(d.data.evento.msg);
            }
        } catch(e) { console.log('Bot silencioso'); }
    },

    open: (initialMsg) => {
        document.getElementById('ai-overlay').classList.add('open');
        document.getElementById('ai-modal').classList.add('open');
        if(initialMsg) bot.addMsg('bot', initialMsg);
    },

    close: () => {
        document.getElementById('ai-overlay').classList.remove('open');
        document.getElementById('ai-modal').classList.remove('open');
    },

    addMsg: (role, text) => {
        const ctn = document.getElementById('chat-content');
        const div = document.createElement('div');
        div.className = role === 'bot' ? 'msg-bot' : 'msg-user';
        // Convertir saltos de línea y negritas básicas
        div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); 
        ctn.appendChild(div);
        ctn.scrollTop = ctn.scrollHeight;
    },

    send: (text) => {
        bot.addMsg('user', text);
        // Simular "Escribiendo..."
        const status = document.getElementById('bot-status');
        status.innerText = "Escribiendo...";
        
        fetch(WORKER, {
            method: 'POST',
            body: JSON.stringify({
                action: 'chat_bot',
                payload: {
                    mensajeUsuario: text,
                    contextoCliente: state.currentClient // Le mandamos quién es el cliente actual para que opine
                }
            })
        })
        .then(r => r.json())
        .then(d => {
            status.innerText = "Online";
            if(d.status === 'success') bot.addMsg('bot', d.data.respuesta);
        })
        .catch(() => status.innerText = "Error");
    },
    
    sendManual: () => {
        const inp = document.getElementById('chat-input');
        if(!inp.value.trim()) return;
        bot.send(inp.value);
        inp.value = '';
    }
};

document.addEventListener('DOMContentLoaded', app.init);
