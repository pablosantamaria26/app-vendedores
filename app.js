// ⚠️ PEGA TU URL DE WORKER
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    selectedZones: new Set(),
    visitedIds: new Set(), // 👻 Aquí guardamos los IDs procesados para borrarlos
    route: [],
    currentClient: null,
    regType: null, // 'si' o 'no'
    regReason: '',
    viewMode: 'list', // 'list' o 'focus'
    coords: { lat: 0, lng: 0 },
    metrics: { visitas: 0, ventas: 0, racha: 0 }
};

const app = {
    init: () => {
        if(state.user) app.loadData();
        // GPS Watch para actualizar distancia en tiempo real
        navigator.geolocation.watchPosition(p => {
            state.coords = { lat: p.coords.latitude, lng: p.coords.longitude };
            if(state.route.length > 0) app.renderRoute(); // Re-renderizar distancias
        });
        // Auto-Login
        const pass = document.getElementById('pass');
        if(pass) pass.addEventListener('input', e => { if(e.target.value.length===4) app.login(); });
    },

    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        if(p.length<4) return;
        app.loader(true);
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({action:'login', payload:{user:u, pass:p}})});
            const d = await r.json();
            if(d.status==='success') {
                state.user = d.data;
                localStorage.setItem('ml_user', JSON.stringify(d.data));
                app.loadData();
                bot.checkEvents(); // ⚡ IA inicia sola
            } else { alert('Acceso denegado'); document.getElementById('pass').value=''; }
        } catch(e){ alert('Error red'); }
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
                // Filtrar los ya visitados en esta sesión (opcional, si quisieras persistencia local)
                document.getElementById('lbl-user').innerText = state.user.usuario.toUpperCase();
                app.renderZones();
            }
        } catch(e){ console.error(e); }
        app.loader(false);
    },

    // --- ZONAS & RUTA ---
    renderZones: () => {
        const zones = {};
        const seen = new Set();
        state.clients.forEach(c => {
            if(seen.has(c.id)) return; seen.add(c.id); // Deduplicar ID
            const z = (c.localidad||'GRAL').toUpperCase().trim();
            if(!zones[z]) zones[z]=0; zones[z]++;
            c._zonaNorm = z;
        });
        
        const g = document.getElementById('grid-zonas'); g.innerHTML='';
        Object.keys(zones).sort().forEach(z => {
            const d = document.createElement('div');
            d.className = 'client-card'; // Reusamos estilo card
            d.style.display = 'block'; d.style.textAlign='center'; d.style.border='1px solid #334155';
            d.innerHTML = `<h3 style="margin:5px 0">${z}</h3><small style="color:var(--text-sec)">${zones[z]}</small>`;
            d.onclick = () => {
                if(state.selectedZones.has(z)) { state.selectedZones.delete(z); d.style.borderColor='#334155'; d.style.background='var(--surface)'; }
                else { state.selectedZones.add(z); d.style.borderColor='var(--primary)'; d.style.background='#1e3a8a'; }
            };
            g.appendChild(d);
        });
    },

    buildRoute: () => {
        if(state.selectedZones.size===0) return alert('Selecciona Zona');
        // Filtramos por zona Y que NO estén visitados
        state.route = state.clients.filter(c => state.selectedZones.has(c._zonaNorm) && !state.visitedIds.has(c.id));
        app.renderRoute();
        app.show('view-route');
    },

    renderRoute: () => {
        // Filtrar (Fantasma) en cada render por si se agregó algo a visitedIds
        const activeRoute = state.route.filter(c => !state.visitedIds.has(c.id));
        
        // --- VISTA LISTA ---
        const listCtn = document.getElementById('route-list-container');
        listCtn.innerHTML = activeRoute.length===0 ? '<p style="text-align:center; padding:20px;">¡ZONA COMPLETADA! 🎉</p>' : '';
        
        activeRoute.forEach(c => {
            const distInfo = app.calcDist(c.lat, c.lng);
            const div = document.createElement('div');
            div.className = `client-card ${c.estado}`;
            div.innerHTML = `
                <div class="cc-header">
                    <div class="cc-name">${c.nombre}</div>
                    <div class="cc-id">#${c.id}</div>
                </div>
                <div class="cc-body">
                    <div class="cc-addr"><i class="fas fa-map-marker-alt"></i> ${c.direccion}</div>
                </div>
                <div class="cc-footer">
                    <div class="cc-dist"><i class="fas fa-route"></i> ${distInfo.km}km (${distInfo.min} min)</div>
                    <div class="cc-status" style="color:${getColor(c.estado)}">${c.estado}</div>
                </div>
            `;
            div.onclick = () => { state.currentClient = c; app.openModal(); };
            listCtn.appendChild(div);
        });

        // --- VISTA FOCO ---
        const focusCtn = document.getElementById('route-focus-container');
        if(activeRoute.length > 0) {
            const c = activeRoute[0]; // Siempre el primero disponible
            const distInfo = app.calcDist(c.lat, c.lng);
            focusCtn.innerHTML = `
                <div class="focus-card ${c.estado}" style="border-top: 6px solid ${getColor(c.estado)}">
                    <small style="color:var(--text-sec); letter-spacing:2px; text-transform:uppercase;">Próximo Objetivo</small>
                    <h1 style="font-size:32px; margin:10px 0;">${c.nombre}</h1>
                    <p style="color:var(--text-sec); font-size:18px;"><i class="fas fa-map-marker-alt"></i> ${c.direccion}</p>
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin:20px 0; display:inline-block;">
                        <strong style="color:var(--accent); font-size:20px;">${distInfo.km} km</strong><br>
                        <small>Tiempo est: ${distInfo.min} min</small>
                    </div>
                    <br>
                    <button class="btn btn-primary" onclick="state.currentClient=state.route.find(x=>x.id==${c.id}); app.openModal()">REGISTRAR VISITA</button>
                    <div style="margin-top:20px; display:flex; justify-content:center; gap:20px;">
                        <a href="https://wa.me/?text=Hola ${c.nombre}" target="_blank" style="color:#25D366; font-size:24px;"><i class="fab fa-whatsapp"></i></a>
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${c.direccion} ${c.localidad}" target="_blank" style="color:#4285F4; font-size:24px;"><i class="fas fa-map-marker-alt"></i></a>
                    </div>
                </div>
            `;
        } else {
            focusCtn.innerHTML = '<h2 style="text-align:center;">¡TERMINASTE POR HOY! 🏆</h2>';
        }
    },

    // --- MODAL & SUBMIT ---
    openModal: () => {
        document.getElementById('modal-action').classList.remove('hidden');
        app.setRegType(null); // Reset
    },

    setRegType: (t) => {
        state.regType = t;
        document.getElementById('btn-no').className = t==='no' ? 'btn btn-danger' : 'btn btn-outline';
        document.getElementById('btn-si').className = t==='si' ? 'btn btn-success' : 'btn btn-outline';
        
        document.getElementById('panel-venta').classList.toggle('hidden', t!=='si');
        document.getElementById('panel-no-venta').classList.toggle('hidden', t!=='no');
    },

    setReason: (el, r) => {
        state.regReason = r;
        document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
        el.classList.add('selected');
    },

    submit: async () => {
        if(!state.regType) return alert('¿Vendiste o no?');
        if(state.regType==='no' && !state.regReason) return alert('Elegí motivo');

        const obs = document.getElementById('obs').value;
        const monto = document.getElementById('inp-monto').value;
        
        app.loader(true);
        document.getElementById('modal-action').classList.add('hidden');

        // 👻 MODO FANTASMA: Agregar ID a visitados
        state.visitedIds.add(state.currentClient.id);

        // Métricas
        state.metrics.visitas++;
        if(state.regType==='si') { state.metrics.ventas++; state.metrics.racha=0; } else state.metrics.racha++;

        // Enviar Backend
        fetch(WORKER, {
            method:'POST',
            body:JSON.stringify({
                action:'registrar_movimiento',
                payload: {
                    vendedor:state.user.vendedorAsignado, clienteId:state.currentClient.id,
                    tipo: state.regType==='si'?'venta':'visita',
                    motivo: state.regReason, observacion: obs, monto: monto,
                    coords: `${state.coords.lat},${state.coords.lng}`
                }
            })
        });

        // RE-RENDERIZAR INMEDIATO (El cliente desaparecerá)
        app.renderRoute();
        
        // Reset Inputs
        document.getElementById('obs').value='';
        document.getElementById('inp-monto').value='';
        state.regReason='';
        
        setTimeout(()=>bot.checkEvents(), 1500); // Check IA
        app.loader(false);
    },

    // UTILS
    setMode: (m) => {
        state.viewMode = m;
        document.getElementById('btn-list').classList.toggle('active', m==='list');
        document.getElementById('btn-focus').classList.toggle('active', m==='focus');
        document.getElementById('route-list-container').classList.toggle('hidden', m!=='list');
        document.getElementById('route-focus-container').classList.toggle('hidden', m!=='focus');
    },
    toggleTheme: () => {
        const b = document.body;
        b.dataset.theme = b.dataset.theme==='industrial' ? 'energia' : 'industrial';
    },
    calcDist: (lat2, lon2) => {
        if(!lat2 || !state.coords.lat) return {km:'?', min:'?'};
        const R = 6371; 
        const dLat = (lat2-state.coords.lat) * Math.PI/180;
        const dLon = (lon2-state.coords.lng) * Math.PI/180;
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(state.coords.lat*Math.PI/180)*Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const km = (R * c).toFixed(1);
        const min = Math.ceil(km * 2); // Estimado muy rústico: 30km/h
        return {km, min};
    },
    show: (id) => {
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    loader: (s) => document.getElementById('loader').classList.toggle('hidden', !s)
};

const getColor = (s) => s==='critico'?'#ef4444':(s==='atencion'?'#f59e0b':'#10b981');

// --- BOT ---
const bot = {
    toggle: () => document.getElementById('ai-panel').classList.toggle('open'),
    checkEvents: async () => {
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({action:'check_events', payload:{visitasTotal:state.metrics.visitas, ventasTotal:state.metrics.ventas, rachaNegativa:state.metrics.racha}})});
            const d = await r.json();
            if(d.status==='success' && d.data.hayEvento) {
                bot.addMsg(d.data.evento.msg, true);
                bot.toggle();
            }
        } catch(e){}
    },
    send: async () => {
        const inp = document.getElementById('chat-inp'); const txt = inp.value; if(!txt) return;
        bot.addMsg(txt, false); inp.value='';
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({action:'chat_bot', payload:{mensajeUsuario:txt, contextoCliente:state.currentClient}})});
            const d = await r.json();
            if(d.status==='success') bot.addMsg(d.data.respuesta, true);
        } catch(e){ bot.addMsg("Error IA", true); }
    },
    addMsg: (txt, isBot) => {
        const c = document.getElementById('chat-content');
        const d = document.createElement('div'); d.className=`msg ${isBot?'bot':'user'}`; d.innerHTML=txt;
        c.appendChild(d); c.scrollTop=c.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', app.init);
