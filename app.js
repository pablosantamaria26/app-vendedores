// ⚠️ PEGA TU URL DE WORKER
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    selectedZones: new Set(),
    visitedIds: new Set(),
    route: [],
    currentClient: null,
    regType: null, regReason: '',
    coords: null, // Guardamos string "lat,lng"
    metrics: { visitas: 0, ventas: 0, racha: 0 }
};

const app = {
    init: () => {
        if(state.user) app.loadData();
        
        // GPS WATCH (Actualización constante)
        if('geolocation' in navigator) {
            navigator.geolocation.watchPosition(p => {
                state.coords = `${p.coords.latitude},${p.coords.longitude}`;
                if(state.route.length > 0) app.renderRoute(); // Recalcular distancias
            }, err => console.warn('GPS Error', err), { enableHighAccuracy: true });
        }

        // Auto Login
        const pass = document.getElementById('pass');
        if(pass) pass.addEventListener('input', e => { if(e.target.value.length===4) app.login(); });

        // Chat Enter Key
        const chatInp = document.getElementById('chat-inp');
        if(chatInp) {
            chatInp.addEventListener('keydown', (e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    bot.send();
                }
            });
        }
    },

    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        app.loader(true);
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({action:'login', payload:{user:u, pass:p}})});
            const d = await r.json();
            if(d.status==='success') {
                state.user = d.data;
                localStorage.setItem('ml_user', JSON.stringify(d.data));
                app.loadData();
                bot.checkEvents();
            } else { alert('Error: ' + d.message); document.getElementById('pass').value=''; }
        } catch(e){ alert('Error Red'); }
        app.loader(false);
    },

    loadData: async () => {
        app.loader(true);
        app.show('view-zonas');
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({action:'get_data_inicial', payload:{vendedorAsignado:state.user.vendedorAsignado}})});
            const d = await r.json();
            if(d.status==='success') {
                state.clients = d.data.clientes;
                document.getElementById('lbl-user').innerText = state.user.usuario.toUpperCase();
                app.renderZones();
            }
        } catch(e){ console.error(e); }
        app.loader(false);
    },

    renderZones: () => {
        const zones = {};
        const seen = new Set();
        state.clients.forEach(c => {
            if(seen.has(c.id)) return; seen.add(c.id);
            const z = (c.localidad||'GRAL').toUpperCase().trim();
            if(!zones[z]) zones[z]=0; zones[z]++;
            c._zonaNorm = z;
        });
        
        const g = document.getElementById('grid-zonas'); g.innerHTML='';
        Object.keys(zones).sort().forEach(z => {
            const d = document.createElement('div');
            d.className = 'client-card';
            d.style.textAlign='center'; d.style.padding='20px';
            d.innerHTML = `<h3 style="margin:5px 0; color:#f1f5f9;">${z}</h3><small style="color:var(--text-sec)">${zones[z]}</small>`;
            d.onclick = () => {
                if(state.selectedZones.has(z)) { state.selectedZones.delete(z); d.style.borderColor='transparent'; d.style.background='var(--surface)'; }
                else { state.selectedZones.add(z); d.style.borderColor='var(--primary)'; d.style.background='rgba(59, 130, 246, 0.2)'; }
            };
            g.appendChild(d);
        });
    },

    buildRoute: () => {
        if(state.selectedZones.size===0) return alert('Selecciona Zona');
        state.route = state.clients.filter(c => state.selectedZones.has(c._zonaNorm) && !state.visitedIds.has(c.id));
        app.renderRoute();
        app.show('view-route');
    },

    renderRoute: () => {
        const active = state.route.filter(c => !state.visitedIds.has(c.id));
        const ctn = document.getElementById('route-list-container');
        ctn.innerHTML = active.length===0 ? '<p style="text-align:center; padding:30px;">¡Ruta Completa! 🎉</p>' : '';
        
        active.forEach(c => {
            const dist = app.calcDist(c.lat, c.lng);
            const div = document.createElement('div');
            div.className = `client-card ${c.estado}`;
            div.innerHTML = `
                <div class="cc-top">
                    <div class="cc-name">${c.nombre}</div>
                    <div class="cc-dist"><i class="fas fa-location-arrow"></i> ${dist}</div>
                </div>
                <div class="cc-addr">${c.direccion}</div>
            `;
            div.onclick = () => { state.currentClient = c; app.openModal(); };
            ctn.appendChild(div);
        });
    },

    openModal: () => { document.getElementById('modal-action').classList.remove('hidden'); app.setRegType(null); },
    
    setRegType: (t) => {
        state.regType = t;
        document.getElementById('btn-no').className = t==='no'?'btn btn-danger':'btn btn-outline';
        document.getElementById('btn-si').className = t==='si'?'btn btn-success':'btn btn-outline';
        document.getElementById('panel-venta').classList.toggle('hidden', t!=='si');
        document.getElementById('panel-no').classList.toggle('hidden', t!=='no');
    },
    
    setReason: (el, r) => {
        state.regReason = r;
        document.querySelectorAll('.icon-btn').forEach(b => b.style.borderColor='#334155');
        el.style.borderColor = 'var(--accent)';
    },

    submit: async () => {
        if(!state.regType) return alert('Selecciona opción');
        if(state.regType==='no' && !state.regReason) return alert('Motivo?');
        
        app.loader(true);
        document.getElementById('modal-action').classList.add('hidden');
        state.visitedIds.add(state.currentClient.id);
        
        // Optimistic UI
        app.renderRoute();
        
        // Background Sync
        const obs = document.getElementById('obs').value;
        const monto = document.getElementById('inp-monto').value;
        state.metrics.visitas++;
        if(state.regType==='si') { state.metrics.ventas++; state.metrics.racha=0; } else state.metrics.racha++;
        
        fetch(WORKER, {
            method:'POST',
            body:JSON.stringify({
                action:'registrar_movimiento',
                payload: {
                    vendedor:state.user.vendedorAsignado, clienteId:state.currentClient.id,
                    tipo: state.regType==='si'?'venta':'visita',
                    motivo: state.regReason, observacion: obs, monto: monto,
                    coords: state.coords || ''
                }
            })
        });

        document.getElementById('obs').value='';
        document.getElementById('inp-monto').value='';
        setTimeout(()=>bot.checkEvents(), 2000);
        app.loader(false);
    },

    // UTILS
    calcDist: (lat2, lon2) => {
        if(!lat2 || !state.coords) return '-- km';
        const [lat1, lon1] = state.coords.split(',').map(Number);
        const R = 6371; 
        const dLat = (lat2-lat1) * Math.PI/180;
        const dLon = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return (R * c).toFixed(1) + 'km';
    },
    toggleTheme: () => {
        const b = document.body;
        b.dataset.theme = b.dataset.theme==='industrial' ? 'energia' : 'industrial';
    },
    show: (id) => {
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    loader: (s) => document.getElementById('loader').classList.toggle('hidden', !s)
};

// --- BOT LOGIC ---
const bot = {
    toggle: () => document.getElementById('ai-panel').classList.toggle('open'),
    
    checkEvents: async () => {
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({action:'check_events', payload:{visitasTotal:state.metrics.visitas}})});
            const d = await r.json();
            if(d.status==='success' && d.data.hayEvento) {
                bot.addMsg(d.data.evento.msg, true);
                bot.toggle();
            }
        } catch(e){}
    },

    send: async () => {
        const inp = document.getElementById('chat-inp');
        const txt = inp.value.trim();
        if(!txt) return;
        
        bot.addMsg(txt, false);
        inp.value = '';
        
        // Simular "Escribiendo..."
        const loadingId = Date.now();
        bot.addMsg('<i class="fas fa-circle-notch fa-spin"></i> Analizando...', true, loadingId);
        
        try {
            const r = await fetch(WORKER, {
                method:'POST',
                body:JSON.stringify({
                    action:'chat_bot',
                    payload: {
                        mensajeUsuario: txt,
                        contextoCliente: state.currentClient,
                        vendedor: state.user.vendedorAsignado,
                        coords: state.coords // LE MANDAMOS LA UBICACIÓN AL CEREBRO
                    }
                })
            });
            const d = await r.json();
            
            // Remover loading
            document.getElementById('msg-'+loadingId).remove();
            
            if(d.status==='success') {
                bot.addMsg(d.data.respuesta, true);
            } else {
                bot.addMsg("⚠️ Error de sistema.", true);
            }
        } catch(e) {
            document.getElementById('msg-'+loadingId).remove();
            bot.addMsg("⚠️ Error de conexión.", true);
        }
    },

    addMsg: (html, isBot, id=null) => {
        const c = document.getElementById('chat-content');
        const d = document.createElement('div');
        d.className = `msg ${isBot?'bot':'user'}`;
        if(id) d.id = 'msg-'+id;
        d.innerHTML = html;
        c.appendChild(d);
        c.scrollTop = c.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', app.init);
