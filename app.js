// ⚠️ PEGA TU URL WORKER
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
        if('geolocation' in navigator) navigator.geolocation.watchPosition(p=>state.coords=`${p.coords.latitude},${p.coords.longitude}`);
        document.getElementById('pass')?.addEventListener('input', e=>{if(e.target.value.length===4)app.login()});
        document.getElementById('chat-inp')?.addEventListener('keydown', e=>{if(e.key==='Enter') bot.send()});
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
            } else alert(d.message);
        } catch(e){alert('Error Red')}
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
                app.renderZones();
            }
        } catch(e){console.error(e)}
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
            const d = document.createElement('div'); d.className='client-card'; d.style.textAlign='center';
            d.innerHTML=`<h3>${z}</h3><small>${zones[z]}</small>`;
            d.onclick=()=>{ 
                if(state.selectedZones.has(z)){state.selectedZones.delete(z); d.style.borderLeftColor='#334155';}
                else{state.selectedZones.add(z); d.style.borderLeftColor='var(--primary)';}
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
        const listCtn = document.getElementById('route-list-container');
        listCtn.innerHTML = active.length===0 ? '<p style="text-align:center">¡Terminaste! 🎉</p>' : '';
        
        active.forEach(c => {
            const eta = app.calcETA(c.lat, c.lng);
            const d = document.createElement('div'); d.className=`client-card ${c.estado}`;
            d.innerHTML=`
                <div class="cc-row"><i class="fas fa-user cc-icon"></i> <span class="cc-name">${c.nombre}</span> <span class="cc-badge">${c.estado}</span></div>
                <div class="cc-row"><i class="fas fa-map-pin cc-icon"></i> <span class="cc-text">${c.direccion}</span></div>
                <div class="cc-row"><i class="fas fa-car cc-icon"></i> <span class="cc-text">${eta.km} km (${eta.min} min)</span></div>
            `;
            d.onclick=()=>{state.currentClient=c; app.openModal()};
            listCtn.appendChild(d);
        });

        // RENDER FOCO
        const focusCtn = document.getElementById('route-focus-container');
        if(active.length>0) {
            const c = active[0];
            const eta = app.calcETA(c.lat, c.lng);
            focusCtn.innerHTML = `
                <div class="focus-card">
                    <small>PRÓXIMO OBJETIVO</small>
                    <h1>${c.nombre}</h1>
                    <p><i class="fas fa-map-pin"></i> ${c.direccion}</p>
                    <div class="focus-big-val">${eta.min} MIN</div>
                    <small>${eta.km} KM DE DISTANCIA</small>
                    <br><br>
                    <button class="btn btn-primary" onclick="state.currentClient=state.route.find(x=>x.id==${c.id}); app.openModal()">REGISTRAR VISITA</button>
                    <br>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}" target="_blank" class="btn btn-outline">IR CON GPS</a>
                </div>
            `;
        } else { focusCtn.innerHTML='<h2>¡FIN DEL RECORRIDO!</h2>'; }
    },

    openModal: () => {document.getElementById('modal-action').classList.remove('hidden'); app.setRegType(null)},
    
    setRegType: (t) => {
        state.regType = t;
        document.getElementById('btn-si').className = t==='si'?'btn btn-primary':'btn btn-outline';
        document.getElementById('btn-no').className = t==='no'?'btn btn-primary':'btn btn-outline';
        document.getElementById('panel-venta').classList.toggle('hidden', t!=='si');
        document.getElementById('panel-no').classList.toggle('hidden', t!=='no');
    },

    setReason: (el, r) => {
        state.regReason = r;
        document.querySelectorAll('#panel-no .btn').forEach(b=>b.className='btn btn-outline');
        el.className='btn btn-primary';
    },

    submit: async () => {
        if(!state.regType) return alert('¿Venta o No?');
        app.loader(true);
        document.getElementById('modal-action').classList.add('hidden');
        state.visitedIds.add(state.currentClient.id); // Desaparece
        app.renderRoute(); // Actualizar UI ya
        
        const obs = document.getElementById('obs')?.value || '';
        const monto = document.getElementById('inp-monto')?.value || 0;
        
        fetch(WORKER, {
            method:'POST',
            body:JSON.stringify({
                action:'registrar_movimiento',
                payload:{
                    vendedor:state.user.vendedorAsignado, clienteId:state.currentClient.id,
                    tipo: state.regType==='si'?'venta':'visita',
                    motivo: state.regReason, observacion: obs, monto: monto,
                    coords: state.coords||''
                }
            })
        });
        
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
        if(!lat2 || !state.coords) return {km:'?', min:'?'};
        const [lat1, lon1] = state.coords.split(',').map(Number);
        const R = 6371; 
        const dLat = (lat2-lat1)*Math.PI/180;
        const dLon = (lon2-lon1)*Math.PI/180;
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const km = (R * c).toFixed(1);
        const min = Math.ceil(km * 3); // 20km/h urbano aprox
        return {km, min};
    },
    toggleTheme: () => {document.body.dataset.theme = document.body.dataset.theme==='industrial'?'energia':'industrial'},
    show: (id) => {document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); document.getElementById(id).classList.add('active')},
    loader: (s) => document.getElementById('loader').classList.toggle('hidden', !s)
};

const bot = {
    toggle: () => document.getElementById('ai-panel').classList.toggle('open'),
    send: async () => {
        const inp = document.getElementById('chat-inp'); const txt = inp.value; if(!txt)return;
        bot.addMsg(txt, false); inp.value='';
        try {
            const r = await fetch(WORKER, {method:'POST', body:JSON.stringify({
                action:'chat_bot', 
                payload:{mensajeUsuario:txt, vendedor:state.user.vendedorAsignado}
            })});
            const d = await r.json();
            if(d.status==='success') bot.addMsg(d.data.respuesta, true);
        } catch(e){bot.addMsg("Error conexión", true)}
    },
    addMsg: (t, b) => {
        const c = document.getElementById('chat-content');
        const d = document.createElement('div'); d.className=`msg ${b?'bot':'user'}`; d.innerHTML=t;
        c.appendChild(d); c.scrollTop=c.scrollHeight;
    }
};

document.addEventListener('DOMContentLoaded', app.init);
