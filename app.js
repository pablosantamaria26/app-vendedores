// ==========================================
// ⚙️ CONFIGURACIÓN Y ESTADO
// ==========================================

// 🔥 ¡OJO AQUÍ! PEGA LA URL DE TU CLOUDFLARE WORKER 
// NO la de Google Script. El Worker se encarga de hablar con Google.
const WORKER_URL = 'https://frosty-term-20ea.santamariapablodaniel.workers.dev/'; 

const state = {
    user: JSON.parse(localStorage.getItem('ml_user')) || null,
    clients: [],
    currentClient: null,
    selectedAction: null,
    coords: null
};

// ==========================================
// 🧠 LÓGICA DE LA APP
// ==========================================
const app = {
    init: () => {
        // 1. Verificar sesión guardada
        if (state.user) {
            app.showView('view-dashboard');
            app.loadData();
            document.getElementById('lbl-user').innerText = state.user.usuario;
        }
        
        // 2. Obtener GPS (Importante para registrar visitas)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    state.coords = `${pos.coords.latitude},${pos.coords.longitude}`;
                    console.log("📍 GPS OK");
                }, 
                err => console.log('⚠️ Sin GPS o permiso denegado')
            );
        }

        // 3. Registrar Service Worker (Para instalar App y Offline básico)
        if ('serviceWorker' in navigator) {
            // Registramos el sw.js básico que creaste (el que tiene skipWaiting)
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('✅ Service Worker Registrado:', reg.scope))
                .catch(err => console.log('❌ Error SW:', err));
        }
    },

    // 🔐 LOGIN
    login: async () => {
        const u = document.getElementById('user').value;
        const p = document.getElementById('pass').value;
        if (!u || !p) return app.toast('Completa los datos');

        app.loader(true);
        try {
            // Petición al PROXY (Cloudflare)
            const res = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'login', 
                    payload: { user: u, pass: p } 
                })
            });
            
            const json = await res.json();

            if (json.status === 'success') {
                state.user = json.data;
                localStorage.setItem('ml_user', JSON.stringify(state.user));
                document.getElementById('lbl-user').innerText = state.user.usuario;
                app.showView('view-dashboard');
                app.loadData();
            } else {
                app.toast('❌ ' + json.message);
            }
        } catch (e) {
            app.toast('Error de conexión con el servidor');
            console.error(e);
        }
        app.loader(false);
    },

    // 📥 CARGAR CARTERA
    loadData: async () => {
        app.loader(true);
        try {
            const res = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'get_data_inicial', 
                    payload: { 
                        vendedorAsignado: state.user.vendedorAsignado, 
                        rol: state.user.rol 
                    } 
                })
            });
            
            const json = await res.json();
            
            if (json.status === 'success') {
                state.clients = json.data.clientes;
                app.renderList(state.clients);
                app.toast(`Cargados ${state.clients.length} clientes`);
            } else {
                app.toast('⚠️ Error cargando datos');
            }
        } catch (e) {
            console.error(e);
            app.toast('Error de red al actualizar');
        }
        app.loader(false);
    },

    // 🎨 RENDERIZAR LISTA
    renderList: (list) => {
        const container = document.getElementById('client-list');
        container.innerHTML = '';
        
        if (!list || list.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8"><h4>Sin clientes asignados</h4><p>Contacta al administrador.</p></div>';
            return;
        }

        list.forEach(c => {
            // Lógica visual de estados
            let borderClass = 'status-aldia';
            let badgeColor = '#dcfce7'; let badgeText = '#166534'; let badgeLabel = 'AL DÍA';

            if (c.estado === 'critico') { 
                borderClass = 'status-critico'; badgeColor = '#fee2e2'; badgeText = '#991b1b'; badgeLabel = 'CRÍTICO'; 
            } else if (c.estado === 'atencion' || c.estado === 'inactivo') {
                borderClass = 'status-atencion'; badgeColor = '#fef3c7'; badgeText = '#92400e'; badgeLabel = 'VISITAR';
            } else if (c.estado === 'nuevo') {
                badgeColor = '#e0f2fe'; badgeText = '#075985'; badgeLabel = 'NUEVO';
            }

            const html = `
                <div class="client-card ${borderClass}" onclick="app.openDetail('${c.id}')">
                    <div class="status-badge" style="background:${badgeColor}; color:${badgeText}">${badgeLabel}</div>
                    <div class="client-name">${c.nombre} <small style="font-weight:400; color:#94a3b8">(${c.id})</small></div>
                    <div class="client-meta"><i class="fas fa-map-marker-alt"></i> ${c.direccion || 'Sin dirección'}</div>
                    <div class="client-meta"><i class="fas fa-history"></i> Última: ${c.ultimaFecha || '-'} (${c.diasSinCompra} días)</div>
                    ${c.zona ? `<div class="client-meta" style="color:var(--primary); font-weight:600; margin-top:4px; font-size:11px;">📍 ${c.zona}</div>` : ''}
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    },

    // 👁️ ABRIR DETALLE
    openDetail: (id) => {
        state.currentClient = state.clients.find(c => c.id == id);
        if(!state.currentClient) return;
        
        document.getElementById('detail-name').innerText = state.currentClient.nombre;
        document.getElementById('detail-address').innerText = state.currentClient.direccion;
        
        app.selectAction(null);
        document.getElementById('txt-nota-venta').value = '';
        document.getElementById('txt-nota-visita').value = '';
        
        app.showView('view-detail');
    },

    // 🔘 SELECCIONAR ACCIÓN
    selectAction: (type) => {
        state.selectedAction = type;
        document.querySelectorAll('.action-card').forEach(el => el.classList.remove('selected'));
        if (type) document.getElementById('opt-' + type).classList.add('selected');

        document.getElementById('form-venta').classList.add('hidden');
        document.getElementById('form-visita').classList.add('hidden');
        document.getElementById('btn-submit').disabled = true;

        if (type === 'venta') {
            document.getElementById('form-venta').classList.remove('hidden');
            document.getElementById('btn-submit').disabled = false;
        } else if (type === 'visita') {
            document.getElementById('form-visita').classList.remove('hidden');
            document.getElementById('btn-submit').disabled = false;
        }
    },

    // 📤 ENVIAR REPORTE
    submitVisit: async () => {
        if (!state.selectedAction) return;

        // Validaciones simples
        if (state.selectedAction === 'venta') {
           const obs = document.getElementById('txt-nota-venta').value;
           if (!obs) return app.toast('⚠️ Escribe el detalle del pedido');
        }

        const payload = {
            vendedor: state.user.vendedorAsignado, // IMPORTANTE: Usa el nombre mapeado (ej: MARTIN)
            clienteId: state.currentClient.id,
            tipo: state.selectedAction,
            coords: state.coords || ''
        };

        if (state.selectedAction === 'venta') {
            payload.observacion = document.getElementById('txt-nota-venta').value;
        } else {
            payload.motivo = document.getElementById('sel-motivo').value;
            payload.observacion = document.getElementById('txt-nota-visita').value;
        }

        app.loader(true);
        try {
            const res = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'registrar_movimiento', payload: payload })
            });
            const json = await res.json();
            
            if (json.status === 'success') {
                app.toast(state.selectedAction === 'venta' ? '💰 Venta registrada' : '📝 Visita registrada');
                app.showView('view-dashboard');
                // Opcional: recargar datos para actualizar estado del cliente
                setTimeout(() => app.loadData(), 1000); 
            } else {
                app.toast('❌ Error: ' + json.message);
            }
        } catch (e) {
            console.error(e);
            app.toast('Error enviando datos');
        }
        app.loader(false);
    },

    // UTILS
    filter: (type, el) => {
        document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        
        if (type === 'todos') {
            app.renderList(state.clients);
        } else {
            let target = type;
            // Mapeo de filtros a estados reales
            if (type === 'atencion') target = ['atencion', 'inactivo']; 
            if (type === 'critico') target = ['critico'];
            if (type === 'aldia') target = ['al_dia', 'nuevo'];
            
            const filtered = state.clients.filter(c => target.includes(c.estado));
            app.renderList(filtered);
        }
    },
    showView: (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        window.scrollTo(0, 0);
    },
    loader: (show) => {
        const el = document.getElementById('loader');
        show ? el.classList.remove('hidden') : el.classList.add('hidden');
    },
    toast: (msg) => {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.style.opacity = 1;
        t.style.bottom = '30px';
        setTimeout(() => { 
            t.style.opacity = 0; 
            t.style.bottom = '20px';
        }, 3000);
    },
    logout: () => {
        if(confirm('¿Cerrar sesión?')) {
            localStorage.removeItem('ml_user');
            location.reload();
        }
    }
};

// Iniciar App cuando el HTML cargue
document.addEventListener('DOMContentLoaded', app.init);
