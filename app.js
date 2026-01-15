// ==========================================
// 🧠 LÓGICA APP VENDEDORES v2.0
// ==========================================

// ⚠️ TU WORKER DE CLOUDFLARE (Copia el que funcionaba)
const WORKER = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    selectedZones: new Set(),
    route: [],
    currentIndex: 0, // Para modo foco
    currentClient: null,
    viewMode: 'lista', // 'lista' o 'foco'
    theme: 'enfoque',
    coords: ''
};

const app = {
    init: () => {
        // Restaurar tema
        const savedTheme = localStorage.getItem('ml_theme');
        if(savedTheme) { state.theme = savedTheme; document.body.dataset.theme = state.theme; }

        if (state.user) {
            app.loadData();
        }
        
        // GPS
        navigator.geolocation.getCurrentPosition(p => {
            state.coords = `${p.coords.latitude},${p.coords.longitude}`;
        });
    },

    // --- LOGIN ---
    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        app.loader(true);
        try {
            const r = await fetch(WORKER, {
                method: 'POST',
                body: JSON.stringify({ action: 'login', payload: { user: u, pass: p } })
            });
            const d = await r.json();
            if (d.status === 'success') {
                state.user = d.data;
                localStorage.setItem('ml_user', JSON.stringify(d.data));
                app.loadData();
            } else { alert(d.message); }
        } catch (e) { alert('Error conexión'); }
        app.loader(false);
    },

    // --- CARGA DATOS ---
    loadData: async () => {
        app.loader(true);
        app.show('view-zonas');
        try {
            const r = await fetch(WORKER, {
                method: 'POST',
                body: JSON.stringify({ 
                    action: 'get_data_inicial', 
                    payload: { vendedorAsignado: state.user.vendedorAsignado } 
                })
            });
            const d = await r.json();
            if (d.status === 'success') {
                state.clients = d.data.clientes;
                document.getElementById('lbl-user').innerText = state.user.usuario;
                app.renderZones();
            }
        } catch (e) { console.error(e); }
        app.loader(false);
    },

    // --- ZONAS ---
    renderZones: () => {
        const zones = {};
        state.clients.forEach(c => {
            const z = c.localidad;
            if(!zones[z]) zones[z] = 0;
            zones[z]++;
        });
        
        const ctn = document.getElementById('container-zonas');
        ctn.innerHTML = '';
        Object.keys(zones).sort().forEach(z => {
            const div = document.createElement('div');
            div.className = 'card-zona';
            div.innerHTML = `<h3>${z}</h3><p>${zones[z]} clientes</p>`;
            div.onclick = () => {
                if(state.selectedZones.has(z)) {
                    state.selectedZones.delete(z);
                    div.classList.remove('selected');
                } else {
                    state.selectedZones.add(z);
                    div.classList.add('selected');
                }
            };
            ctn.appendChild(div);
        });
    },

    prepareRoute: () => {
        if(state.selectedZones.size === 0) return alert('Selecciona zonas');
        
        // Filtrar y Ordenar (Ya viene ordenado del backend por score, pero filtramos zonas)
        state.route = state.clients.filter(c => state.selectedZones.has(c.localidad));
        state.currentIndex = 0;
        
        app.renderRouteList();
        app.renderFocusCard();
        app.show('view-route');
        document.getElementById('btn-bot').classList.remove('hidden');
    },

    // --- RENDERIZADO ---
    renderRouteList: () => {
        const ctn = document.getElementById('route-list');
        ctn.innerHTML = '';
        state.route.forEach((c, i) => {
            const div = document.createElement('div');
            div.className = `client-item ${c.estado}`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <h3>${c.nombre}</h3>
                    <small>${c.estado.toUpperCase()}</small>
                </div>
                <p><i class="fas fa-map-marker-alt"></i> ${c.direccion}</p>
            `;
            div.onclick = () => {
                state.currentIndex = i;
                state.currentClient = c;
                app.openActionModal();
            };
            ctn.appendChild(div);
        });
    },

    renderFocusCard: () => {
        if(state.currentIndex >= state.route.length) {
            document.getElementById('route-focus').innerHTML = '<h2>¡Ruta Finalizada! 🎉</h2>';
            return;
        }
        
        const c = state.route[state.currentIndex];
        state.currentClient = c;
        
        const card = document.getElementById('focus-card');
        card.innerHTML = `
            <div style="font-size:14px; color:var(--text-sec); margin-bottom:10px;">PRÓXIMO CLIENTE</div>
            <h1 style="font-size:32px; margin:0 0 10px 0;">${c.nombre}</h1>
            <p style="font-size:18px;"><i class="fas fa-map-marker-alt"></i> ${c.direccion}</p>
            
            <div style="display:flex; justify-content:center; gap:20px; margin:30px 0;">
                <a href="https://wa.me/?text=Hola ${c.nombre}" target="_blank" class="btn-float" style="position:static; background:#25D366;"><i class="fab fa-whatsapp"></i></a>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.direccion + ' ' + c.localidad)}" target="_blank" class="btn-float" style="position:static; background:#4285F4;"><i class="fas fa-map-marker-alt"></i></a>
            </div>

            <button class="btn btn-primary" onclick="app.openActionModal()">REGISTRAR VISITA</button>
        `;
    },

    // --- INTERACCIÓN ---
    toggleMode: () => {
        const list = document.getElementById('route-list');
        const focus = document.getElementById('route-focus');
        const btn = document.getElementById('lbl-mode');
        
        if (state.viewMode === 'lista') {
            state.viewMode = 'foco';
            list.classList.add('hidden');
            focus.classList.remove('hidden');
            btn.innerText = 'Foco';
            app.renderFocusCard();
        } else {
            state.viewMode = 'lista';
            list.classList.remove('hidden');
            focus.classList.add('hidden');
            btn.innerText = 'Lista';
        }
    },

    toggleTheme: () => {
        state.theme = state.theme === 'enfoque' ? 'energia' : 'enfoque';
        document.body.dataset.theme = state.theme;
        localStorage.setItem('ml_theme', state.theme);
    },

    // --- IA BOT ---
    askBot: async () => {
        if(!state.currentClient) return;
        const modal = document.getElementById('modal-bot');
        const msg = document.getElementById('bot-msg');
        
        modal.classList.remove('hidden');
        msg.innerText = "Pensando estrategia...";
        
        try {
            const r = await fetch(WORKER, {
                method: 'POST',
                body: JSON.stringify({ 
                    action: 'pedir_consejo_ia', 
                    payload: { 
                        clienteNombre: state.currentClient.nombre,
                        diasSin: state.currentClient.diasSin,
                        estado: state.currentClient.estado
                    } 
                })
            });
            const d = await r.json();
            if(d.status === 'success') {
                msg.innerText = d.data.consejo;
            }
        } catch (e) { msg.innerText = "Error consultando a la IA."; }
        
        setTimeout(() => modal.classList.add('hidden'), 8000); // Se oculta solo
    },

    // --- ACCIONES ---
    openActionModal: () => {
        document.getElementById('modal-action').classList.remove('hidden');
        document.getElementById('form-details').classList.add('hidden');
    },

    setAction: (type) => {
        state.lastActionType = type;
        document.getElementById('form-details').classList.remove('hidden');
        document.getElementById('obs').focus();
    },

    submit: async () => {
        const obs = document.getElementById('obs').value;
        app.loader(true);
        
        // Enviar a Backend (Fuego y olvido para rapidez UI en MVP, idealmente await)
        fetch(WORKER, {
            method: 'POST',
            body: JSON.stringify({
                action: 'registrar_movimiento',
                payload: {
                    vendedor: state.user.vendedorAsignado,
                    clienteId: state.currentClient.id,
                    tipo: state.lastActionType,
                    observacion: obs,
                    motivo: state.lastActionType === 'visita' ? 'No compra' : '',
                    coords: state.coords
                }
            })
        });

        // UI Inmediata
        document.getElementById('modal-action').classList.add('hidden');
        document.getElementById('obs').value = '';
        
        // Avanzar en la ruta
        if (state.viewMode === 'foco') {
            state.currentIndex++;
            app.renderFocusCard();
        } else {
            // Si estaba en lista, remover visualmente el item
            app.renderRouteList(); // (Simplificado, recarga lista)
        }
        
        app.loader(false);
    },

    // --- UTILS ---
    show: (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },
    loader: (s) => document.getElementById('loader').classList.toggle('hidden', !s)
};

document.addEventListener('DOMContentLoaded', app.init);
