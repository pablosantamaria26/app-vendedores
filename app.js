// ⚠️ TU WORKER
const WORKER = 'https://app-vendedores.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [], // Todos los clientes descargados
    selectedZones: new Set(), // Zonas seleccionadas
    activeRoute: [], // Clientes filtrados y ordenados
    current: null, // Cliente actual en detalle
    action: null,
    coords: null
};

const app = {
    init: () => {
        if (state.user) {
            app.loadData(); // Cargar datos y mostrar zonas
        } else {
            app.show('view-login');
        }
        
        // GPS
        navigator.geolocation.getCurrentPosition(p => {
            state.coords = `${p.coords.latitude},${p.coords.longitude}`;
        });

        // SW
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
    },

    // --- NAVEGACIÓN ---
    show: (id) => {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            setTimeout(() => { if(!v.classList.contains('active')) v.classList.add('hidden'); }, 300);
        });
        const el = document.getElementById(id);
        el.classList.remove('hidden');
        // Pequeño delay para permitir que el display:block renderice antes de la opacidad
        setTimeout(() => el.classList.add('active'), 10);
        window.scrollTo(0,0);
    },

    // --- LOGIN ---
    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        if(!u || !p) return app.toast('Faltan datos');
        
        app.loading(true);
        try {
            const r = await fetch(WORKER, {
                method:'POST',
                body: JSON.stringify({ action:'login', payload:{user:u, pass:p} })
            });
            const d = await r.json();
            if(d.status === 'success') {
                state.user = d.data;
                localStorage.setItem('ml_user', JSON.stringify(d.data));
                app.loadData();
            } else {
                app.toast(d.message);
            }
        } catch(e) { app.toast('Error de conexión'); }
        app.loading(false);
    },

    // --- CARGA DE DATOS ---
    loadData: async () => {
        app.loading(true);
        try {
            const r = await fetch(WORKER, {
                method:'POST',
                body: JSON.stringify({ 
                    action:'get_data_inicial', 
                    payload:{ vendedorAsignado: state.user.vendedorAsignado, rol: state.user.rol } 
                })
            });
            const d = await r.json();
            if(d.status === 'success') {
                state.clients = d.data.clientes;
                document.getElementById('lbl-user').innerText = state.user.usuario;
                app.renderZones();
                app.show('view-zonas');
            }
        } catch(e) { app.toast('Error cargando clientes'); }
        app.loading(false);
    },

    // --- RENDER ZONAS (Paso 1) ---
    renderZones: () => {
        const zones = {};
        // Agrupar
        state.clients.forEach(c => {
            const z = c.localidad || 'Otras';
            if(!zones[z]) zones[z] = 0;
            zones[z]++;
        });

        const grid = document.getElementById('grid-zonas');
        grid.innerHTML = '';
        
        Object.keys(zones).sort().forEach(z => {
            const div = document.createElement('div');
            div.className = 'card-zona';
            div.onclick = () => app.toggleZone(z, div);
            div.innerHTML = `
                <span class="zona-name">${z}</span>
                <span class="zona-count">${zones[z]} clientes</span>
            `;
            grid.appendChild(div);
        });
    },

    toggleZone: (zone, el) => {
        if(state.selectedZones.has(zone)) {
            state.selectedZones.delete(zone);
            el.classList.remove('selected');
        } else {
            state.selectedZones.add(zone);
            el.classList.add('selected');
        }
        
        // Animación botón
        const btn = document.getElementById('btn-armar');
        btn.innerText = state.selectedZones.size > 0 
            ? `🚀 ARMAR RUTA (${state.selectedZones.size} ZONAS)` 
            : 'SELECCIONA UNA ZONA';
    },

    // --- ARMAR RUTA INTELIGENTE (Paso 2) ---
    buildRoute: () => {
        if(state.selectedZones.size === 0) return app.toast('Selecciona al menos una localidad');
        
        // 1. Filtrar
        const filtered = state.clients.filter(c => state.selectedZones.has(c.localidad || 'Otras'));
        
        // 2. Ordenar por SCORE (Inteligencia Backend)
        // Mayor score primero
        filtered.sort((a,b) => b.score - a.score);
        
        state.activeRoute = filtered;
        app.renderTimeline();
        app.show('view-route');
    },

    renderTimeline: () => {
        const ctn = document.getElementById('timeline');
        ctn.innerHTML = '';
        
        state.activeRoute.forEach(c => {
            let clase = 'normal';
            let badge = 'Al día';
            if(c.estado === 'critico') { clase = 'critico'; badge = 'URGENTE'; }
            if(c.estado === 'atencion') { clase = 'atencion'; badge = 'VISITAR'; }
            if(c.estado === 'nuevo') { clase = 'nuevo'; badge = 'NUEVO'; }

            const div = document.createElement('div');
            div.className = `client-item ${clase}`;
            div.onclick = () => app.openDetail(c.id);
            div.innerHTML = `
                <div class="client-top">
                    <span class="c-name">${c.nombre}</span>
                    <span class="c-badge">${badge}</span>
                </div>
                <div class="c-address"><i class="fas fa-map-marker-alt"></i> ${c.direccion}</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:4px;">
                   ${c.diasSin === 999 ? 'Nunca compró' : 'Hace ' + c.diasSin + ' días'}
                </div>
            `;
            ctn.appendChild(div);
        });
    },

    // --- DETALLE Y ACCIONES (Paso 3) ---
    openDetail: (id) => {
        state.current = state.activeRoute.find(c => c.id === id);
        document.getElementById('d-name').innerText = state.current.nombre;
        document.getElementById('d-address').innerText = state.current.direccion;
        
        // Links
        let maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(state.current.direccion + ' ' + state.current.localidad)}`;
        if(state.current.lat) maps = `https://www.google.com/maps/search/?api=1&query=${state.current.lat},${state.current.lng}`;
        document.getElementById('btn-maps').href = maps;
        
        document.getElementById('btn-wa').href = `https://wa.me/?text=Hola ${encodeURIComponent(state.current.nombre)}`;
        
        // Reset UI
        document.querySelectorAll('.opt-card').forEach(e => e.classList.remove('active'));
        document.getElementById('form-venta').classList.add('hidden');
        document.getElementById('form-visita').classList.add('hidden');
        document.getElementById('btn-confirm').classList.add('hidden');
        
        app.show('view-detail');
    },

    selectOpt: (type) => {
        state.action = type;
        document.querySelectorAll('.opt-card').forEach(e => e.classList.remove('active'));
        document.getElementById('opt-'+type).classList.add('active');
        
        document.getElementById('form-venta').classList.add('hidden');
        document.getElementById('form-visita').classList.add('hidden');
        document.getElementById('btn-confirm').classList.remove('hidden');
        
        document.getElementById('form-'+type).classList.remove('hidden');
    },

    submit: async () => {
        const payload = {
            vendedor: state.user.vendedorAsignado,
            clienteId: state.current.id,
            tipo: state.action,
            coords: state.coords || ''
        };

        if(state.action === 'venta') {
            payload.observacion = document.getElementById('note-venta').value;
            if(!payload.observacion) return app.toast('Ingresa el pedido');
        } else {
            payload.motivo = document.getElementById('sel-motivo').value;
            payload.observacion = document.getElementById('note-visita').value;
        }

        app.loading(true);
        try {
            const r = await fetch(WORKER, {
                method:'POST',
                body: JSON.stringify({ action:'registrar_movimiento', payload })
            });
            const d = await r.json();
            if(d.status === 'success') {
                app.toast('✅ Guardado');
                app.show('view-route'); // Vuelve a la ruta
            } else {
                app.toast('Error al guardar');
            }
        } catch(e) { app.toast('Error de conexión'); }
        app.loading(false);
    },

    // --- UTILS ---
    toast: (m) => {
        const t = document.getElementById('toast');
        t.innerText = m;
        t.style.opacity = 1;
        t.style.bottom = '40px';
        setTimeout(() => { t.style.opacity = 0; t.style.bottom = '30px'; }, 3000);
    },
    loading: (show) => {
        const l = document.getElementById('loader');
        if(show) l.classList.remove('hidden');
        else l.classList.add('hidden');
    },
    logout: () => {
        localStorage.removeItem('ml_user');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', app.init);
