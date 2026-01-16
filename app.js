// ⚠️ PEGA TU URL DE WORKER
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    selectedZones: new Set(),
    visitedIds: new Set(),
    route: [],
    currentClient: null,
    regType: null,
    regReason: '',
    viewMode: 'list',
    coords: { lat: 0, lng: 0 },
    metrics: { visitas: 0, ventas: 0, racha: 0 }
};

const app = {
    init: () => {
        console.log("🚀 App Iniciada");
        if(state.user) {
            console.log("👤 Usuario detectado:", state.user.usuario);
            app.loadData();
        }
        
        // GPS
        navigator.geolocation.watchPosition(
            p => {
                state.coords = { lat: p.coords.latitude, lng: p.coords.longitude };
                if(state.route.length > 0) app.renderRoute();
            },
            err => console.warn("⚠️ GPS Error:", err)
        );

        // Auto Login Input
        const pass = document.getElementById('pass');
        if(pass) pass.addEventListener('input', e => { if(e.target.value.length===4) app.login(); });
    },

    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        if(p.length<4) return;
        
        app.loader(true, "Verificando credenciales...");
        try {
            console.log("📡 Enviando Login a:", WORKER);
            const r = await fetch(WORKER, {
                method:'POST', 
                body:JSON.stringify({action:'login', payload:{user:u, pass:p}})
            });
            const d = await r.json();
            console.log("📥 Respuesta Login:", d);

            if(d.status==='success') {
                state.user = d.data;
                localStorage.setItem('ml_user', JSON.stringify(d.data));
                app.loadData();
                bot.checkEvents();
            } else {
                alert('❌ Error Login: ' + d.message);
                document.getElementById('pass').value='';
            }
        } catch(e){
            console.error(e);
            alert('❌ ERROR DE RED: ' + e.message + "\nRevisa la consola para más detalles.");
        }
        app.loader(false);
    },

    loadData: async () => {
        app.loader(true, "Cargando Cartera...");
        app.show('view-zonas');
        try {
            console.log("📡 Pidiendo Datos...");
            const r = await fetch(WORKER, {
                method:'POST', 
                body:JSON.stringify({
                    action:'get_data_inicial', 
                    payload:{vendedorAsignado:state.user.vendedorAsignado}
                })
            });
            const d = await r.json();
            console.log("📥 Datos Recibidos:", d);

            if(d.status==='success') {
                state.clients = d.data.clientes;
                if(state.clients.length === 0) alert("⚠️ Atención: La lista de clientes llegó vacía. Revisa el Sheet.");
                
                document.getElementById('lbl-user').innerText = state.user.usuario.toUpperCase();
                app.renderZones();
            } else {
                alert("❌ Error Carga: " + d.message);
            }
        } catch(e){ 
            console.error(e);
            alert("❌ Error Fatal Carga: " + e.message); 
        }
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
        const keys = Object.keys(zones).sort();
        
        if(keys.length === 0) g.innerHTML = '<p style="color:#cbd5e1; text-align:center;">No hay zonas disponibles.</p>';

        keys.forEach(z => {
            const d = document.createElement('div');
            d.className = 'client-card';
            d.style.display = 'block'; d.style.textAlign='center'; d.style.border='1px solid #334155'; d.style.padding='20px';
            d.innerHTML = `<h3 style="margin:5px 0; color:#f1f5f9;">${z}</h3><small style="color:var(--text-sec)">${zones[z]}</small>`;
            d.onclick = () => {
                if(state.selectedZones.has(z)) { state.selectedZones.delete(z); d.style.borderColor='#334155'; d.style.background='var(--surface)'; }
                else { state.selectedZones.add(z); d.style.borderColor='var(--primary)'; d.style.background='#1e3a8a'; }
            };
            g.appendChild(d);
        });
    },

    buildRoute: () => {
        if(state.selectedZones.size===0) return alert('⚠️ Selecciona al menos una zona');
        state.route = state.clients.filter(c => state.selectedZones.has(c._zonaNorm) && !state.visitedIds.has(c.id));
        app.renderRoute();
        app.show('view-route');
    },

    renderRoute: () => {
        const activeRoute = state.route.filter(c => !state.visitedIds.has(c.id));
        
        // LISTA
        const listCtn = document.getElementById('route-list-container');
        listCtn.innerHTML = activeRoute.length===0 ? '<p style="text-align:center; padding:20px; color:var(--success);">¡ZONA COMPLETADA! 🎉</p>' : '';
        
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
                    <div class="cc-dist"><i class="fas fa-route"></i> ${distInfo.km}km</div>
                    <div style="margin-left:auto; font-size:11px; color:#94a3b8;">${c.estado.toUpperCase()}</div>
                </div>
            `;
            div.onclick = () => { state.currentClient = c; app.openModal(); };
            listCtn.appendChild(div);
        });

        // FOCO
        const focusCtn = document.getElementById('route-focus-container');
        if(activeRoute.length > 0) {
            const c = activeRoute[0];
            const distInfo = app.calcDist(c.lat, c.lng);
            focusCtn.innerHTML = `
                <div class="focus-card ${c.estado}" style="border-top: 6px solid ${getColor(c.estado)}">
                    <small style="color:var(--text-sec); letter-spacing:2px; text-transform:uppercase;">Próximo Objetivo</small>
                    <h1 style="font-size:28px; margin:15px 0; color:#f1f5f9; line-height:1.2;">${c.nombre}</h1>
                    <p style="color:#cbd5e1; font-size:18px;"><i class="fas fa-map-marker-alt"></i> ${c.direccion}</p>
                    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin:20px 0; display:inline-block;">
                        <strong style="color:var(--accent); font-size:24px;">${distInfo.km} km</strong>
                    </div>
                    <br>
                    <button class="btn btn-primary" onclick="state.currentClient=state.route.find(x=>x.id==${c.id}); app.openModal()">REGISTRAR VISITA</button>
                    
                    <div style="margin-top:25px;">
                         <a href="https://www.google.com/maps/dir/?api=1&destination=${c.direccion} ${c.localidad}" target="_blank" style="color:#4285F4; font-size:20px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:10px; border:1px solid #334155; padding:10px; border-radius:12px;">
                            <i class="fas fa-location-arrow"></i> IR CON MAPS
                         </a>
                    </div>
                </div>
            `;
        } else {
            focusCtn.innerHTML = '<h2 style="text-align:center;">¡TERMINASTE POR HOY! 🏆</h2>';
        }
    },

    openModal: () => {
        document.getElementById('modal-action').classList.remove('hidden');
        app.setRegType(null);
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
        
        app.loader(true, "Guardando...");
        document.getElementById('modal-action').classList.add('hidden');
        state.visitedIds.add(state.currentClient.id);
        
        // Optimistic UI
        app.renderRoute();

        try {
            await fetch(WORKER, {
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
            setTimeout(()=>bot.checkEvents(), 1500);
        } catch(e) { console.error("Error guardando en background", e); }
        
        document.getElementById('obs').value='';
        document.getElementById('inp-monto').value='';
        state.regReason='';
        app.loader(false);
    },

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
        if(!lat2 || !state.coords.lat) return {km:'--'};
        const R = 6371; 
        const dLat = (lat2-state.coords.lat) * Math.PI/180;
        const dLon = (lon2-state.coords.lng) * Math.PI/180;
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(state.coords.lat*Math.PI/180)*Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return {km: (R * c).toFixed(1)};
    },
    show: (id) => {
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    loader: (s, msg) => {
        const l = document.getElementById('loader');
        l.classList.toggle('hidden', !s);
        if(msg) l.querySelector('p').innerText = msg;
    }
};

const getColor = (s) => s==='critico'?'#ef4444':(s==='atencion'?'#f59e0b':'#10b981');

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
        } catch(e){ bot.addMsg("Error IA: Revisa la conexión.", true); }
    },
    addMsg: (txt, isBot) => {
        const c = document.getElementById('chat-content');
        const d = document.createElement('div'); d.className=`msg ${isBot?'bot':'user'}`; d.innerHTML=txt;
        c.appendChild(d); c.scrollTop=c.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', app.init);
