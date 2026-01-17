// ⚠️ TU URL DE WORKER
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [], selectedZones: new Set(), visitedIds: new Set(),
    route: [], currentClient: null, viewMode: 'list',
    coords: null, metrics: { visitas: 0, ventas: 0, racha: 0 },
    regType: null, regReason: ''
};

const app = {
    init: () => {
        if(state.user) app.loadData();
        // GPS Watch de alta precisión
        if('geolocation' in navigator) {
            navigator.geolocation.watchPosition(
                p => state.coords = `${p.coords.latitude},${p.coords.longitude}`,
                e => console.log(e),
                { enableHighAccuracy: true }
            );
        }
        
        // Listeners globales
        const passInp = document.getElementById('pass');
        if(passInp) passInp.addEventListener('input', e => { if(e.target.value.length===4) app.login(); });
        
        const chatInp = document.getElementById('chat-inp');
        if(chatInp) chatInp.addEventListener('keydown', e => { if(e.key==='Enter') bot.send(); });
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
            } else { alert(d.message); document.getElementById('pass').value=''; }
        } catch(e){ alert('Error de conexión'); }
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
                if(document.getElementById('lbl-user')) document.getElementById('lbl-user').innerText = state.user.usuario.toUpperCase();
                app.renderZones();
                // Check de eventos del día (Estrategia)
                setTimeout(() => bot.checkEvents(), 1000);
            }
        } catch(e){ console.error(e); }
        app.loader(false);
    },

    renderZones: () => {
        const zones = {}; const seen = new Set();
        state.clients.forEach(c => {
            if(seen.has(c.id)) return; seen.add(c.id);
            const z = (c.localidad||'GRAL').toUpperCase().trim();
            if(!zones[z]) zones[z]=0; zones[z]++;
            c._zonaNorm = z;
        });
        
        const g = document.getElementById('grid-zonas'); g.innerHTML='';
        Object.keys(zones).sort().forEach(z => {
            const d = document.createElement('div'); 
            // Estilo de tarjeta de zona
            d.className='client-card'; 
            d.style.textAlign='center';
            d.style.cursor='pointer';
            
            d.innerHTML=`
                <h3 style="margin:5px 0; color:white;">${z}</h3>
                <small style="color:#94a3b8; font-weight:bold;">${zones[z]} Clientes</small>
            `;
            
            d.onclick = () => { 
                if(state.selectedZones.has(z)){
                    state.selectedZones.delete(z); 
                    d.style.border = '1px solid rgba(255,255,255,0.05)';
                    d.style.background = 'var(--surface)';
                } else {
                    state.selectedZones.add(z); 
                    d.style.border = '1px solid var(--primary)';
                    d.style.background = 'rgba(59, 130, 246, 0.1)';
                }
            };
            g.appendChild(d);
        });
    },

    buildRoute: () => {
        if(state.selectedZones.size===0) return alert('Selecciona al menos una zona.');
        state.route = state.clients.filter(c => state.selectedZones.has(c._zonaNorm) && !state.visitedIds.has(c.id));
        app.renderRoute();
        app.show('view-route');
    },

    renderRoute: () => {
        const active = state.route.filter(c => !state.visitedIds.has(c.id));
        const listCtn = document.getElementById('route-list-container');
        listCtn.innerHTML = active.length===0 ? '<div style="text-align:center; padding:40px; color:#94a3b8;">🎉 ¡Ruta completada!</div>' : '';
        
        active.forEach(c => {
            const eta = app.calcETA(c.lat, c.lng);
            const d = document.createElement('div'); 
            // Usamos las nuevas clases del CSS Pro
            d.className = `client-card ${c.estado}`; 
            
            d.innerHTML = `
                <span class="cc-id">#${c.id}</span>
                <span class="cc-name">${c.nombre}</span>
                <span class="cc-loc"><i class="fas fa-map-marker-alt"></i> ${c.direccion || 'Sin dirección'}</span>
                
                <div class="cc-stats">
                    <div class="stat-box">
                        <span class="stat-label">Estado</span>
                        <span class="stat-val" style="color:${c.estado==='critico'?'var(--danger)':'var(--success)'}">
                            ${c.estado.toUpperCase()}
                        </span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Distancia</span>
                        <span class="stat-val">${eta.km} km</span>
                    </div>
                </div>
            `;
            d.onclick = () => { state.currentClient = c; app.openModal(); };
            listCtn.appendChild(d);
        });

        // RENDER MODO ENFOQUE (Una sola tarjeta grande)
        const focusCtn = document.getElementById('route-focus-container');
        if(active.length > 0) {
            const c = active[0];
            const eta = app.calcETA(c.lat, c.lng);
            // Enlace real a Google Maps Navegación
            const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
            
            focusCtn.innerHTML = `
                <div class="focus-card">
                    <small style="color:var(--text-sec); letter-spacing:2px; font-weight:bold;">PRÓXIMO DESTINO</small>
                    <h1 style="margin:10px 0; font-size:28px;">${c.nombre}</h1>
                    <p style="color:#cbd5e1;"><i class="fas fa-map-pin"></i> ${c.direccion}</p>
                    
                    <div class="focus-big-val">${eta.min} MIN</div>
                    <small style="color:var(--text-sec);">DISTANCIA: ${eta.km} KM</small>
                    
                    <br><br>
                    <button class="btn btn-primary" onclick="state.currentClient=state.route.find(x=>x.id=='${c.id}'); app.openModal()">
                        REGISTRAR VISITA
                    </button>
                    <br>
                    <a href="${mapsLink}" target="_blank" class="btn btn-outline" style="text-decoration:none;">
                        <i class="fas fa-location-arrow"></i> IR CON GPS
                    </a>
                </div>
            `;
        } else { focusCtn.innerHTML='<h2 style="text-align:center">¡FIN DEL RECORRIDO!</h2>'; }
    },

    openModal: () => { 
        document.getElementById('modal-action').classList.remove('hidden'); 
        app.setRegType(null); 
    },
    
    setRegType: (t) => {
        state.regType = t;
        // Ajuste de clases para botones modernos
        document.getElementById('btn-si').className = t==='si'?'btn btn-success':'btn btn-outline';
        document.getElementById('btn-no').className = t==='no'?'btn btn-danger':'btn btn-outline';
        
        document.getElementById('panel-venta').classList.toggle('hidden', t!=='si');
        document.getElementById('panel-no').classList.toggle('hidden', t!=='no');
    },

    setReason: (el, r) => {
        state.regReason = r;
        document.querySelectorAll('#panel-no .btn').forEach(b => {
            b.className = 'btn btn-outline';
            b.style.borderColor = '#334155';
        });
        el.className = 'btn btn-primary'; // Marca selección
    },

    submit: async () => {
        if(!state.regType) return alert('Selecciona si hubo venta o no.');
        
        app.loader(true);
        document.getElementById('modal-action').classList.add('hidden');
        state.visitedIds.add(state.currentClient.id);
        app.renderRoute(); // Actualización optimista
        
        const obs = document.getElementById('obs').value || '';
        const monto = document.getElementById('inp-monto').value || 0;
        
        try {
            await fetch(WORKER, {
                method:'POST',
                body:JSON.stringify({
                    action:'registrar_movimiento',
                    payload:{
                        vendedor: state.user.vendedorAsignado, 
                        clienteId: state.currentClient.id,
                        tipo: state.regType==='si'?'venta':'visita',
                        motivo: state.regReason, 
                        observacion: obs, 
                        monto: monto,
                        coords: state.coords || ''
                    }
                })
            });
            // Limpieza
            document.getElementById('obs').value = '';
            document.getElementById('inp-monto').value = '';
        } catch(e) { console.error(e); }
        
        app.loader(false);
    },

    // UTILS
    setMode: (m) => {
        state.viewMode = m;
        document.getElementById('btn-list').className = m==='list'?'btn-icon-top active':'btn-icon-top';
        document.getElementById('btn-focus').className = m==='focus'?'btn-icon-top active':'btn-icon-top';
        document.getElementById('route-list-container').classList.toggle('hidden', m!=='list');
        document.getElementById('route-focus-container').classList.toggle('hidden', m!=='focus');
    },
    
    calcETA: (lat2, lon2) => {
        if(!lat2 || !state.coords) return {km:'--', min:'--'};
        const [lat1, lon1] = state.coords.split(',').map(Number);
        if(!lat1 || !lon1) return {km:'--', min:'--'};
        
        const R = 6371; 
        const dLat = (lat2-lat1)*Math.PI/180;
        const dLon = (lon2-lon1)*Math.PI/180;
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const km = (R * c).toFixed(1);
        const min = Math.ceil(km * 4); // Ajustado a tráfico urbano real (4 min por km)
        return {km, min};
    },
    
    show: (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    loader: (s) => document.getElementById('loader').classList.toggle('hidden', !s)
};

// LÓGICA DEL BOT (Sincronizada con el HTML)
const bot = {
    toggle: () => {
        const p = document.getElementById('ai-panel');
        p.classList.toggle('open');
        if(p.classList.contains('open')) {
            setTimeout(() => document.getElementById('chat-inp').focus(), 300);
        }
    },
    
    checkEvents: async () => {
        // Busca estrategia del día al inicio
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({
                action:'check_events', 
                payload:{ vendedor: state.user.vendedorAsignado, visitasTotal: 0 }
            })});
            const d = await r.json();
            if(d.status==='success' && d.data.hayEvento) {
                bot.addMsg(d.data.evento.msg, 'bot');
                bot.toggle(); // Abrir bot automáticamente si hay estrategia
            }
        } catch(e){}
    },

    quickMsg: (txt) => {
        const inp = document.getElementById('chat-inp');
        inp.value = txt;
        bot.send();
    },

    send: async () => {
        const inp = document.getElementById('chat-inp'); 
        const txt = inp.value.trim(); 
        if(!txt) return;
        
        bot.addMsg(txt, 'user'); 
        inp.value='';
        
        // Loader simulado en chat
        const loadingId = 'loading-' + Date.now();
        bot.addMsg('<i class="fas fa-circle-notch fa-spin"></i> Pensando...', 'bot', loadingId);

        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({
                action:'chat_bot', 
                payload:{
                    mensajeUsuario: txt, 
                    vendedor: state.user.vendedorAsignado
                }
            })});
            const d = await r.json();
            
            // Borrar loader
            const el = document.getElementById(loadingId);
            if(el) el.remove();

            if(d.status==='success') {
                bot.addMsg(d.data.respuesta, 'bot');
            } else {
                bot.addMsg("⚠️ Error al conectar con el cerebro.", 'bot');
            }
        } catch(e) {
            const el = document.getElementById(loadingId);
            if(el) el.remove();
            bot.addMsg("Error de red. Intenta de nuevo.", 'bot');
        }
    },

    addMsg: (html, role, id=null) => {
        const c = document.getElementById('chat-content');
        const d = document.createElement('div'); 
        d.className = `msg ${role}`; 
        if(id) d.id = id;
        d.innerHTML = html;
        c.appendChild(d); 
        c.scrollTop = c.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', app.init);
