// =================================================
// 🔔 Service Worker FCM - App Vendedores Inteligente
// VERSIÓN v5.2 - "SW Inteligente"
// =================================================

self.addEventListener("install", () => {
  console.log("⚡ Nueva versión del Service Worker (v5.2) instalada");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("♻️ Activando SW (v5.2) y reclamando clientes...");
  event.waitUntil(clients.claim());
});

// --------------------------------------------------
// 📦 Librerías Firebase (Sin cambios)
// --------------------------------------------------
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// ✅ Inicializar Firebase (Sin cambios)
firebase.initializeApp({
  apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
  authDomain: "app-vendedores-inteligente.firebaseapp.com",
  projectId: "app-vendedores-inteligente",
  storageBucket: "app-vendedores-inteligente.appspot.com",
  messagingSenderId: "583313989429",
  appId: "1:583313989429:web:c4f78617ad957c3b11367c"
});

const messaging = firebase.messaging();

// --------------------------------------------------
// 📩 LÓGICA DE MENSAJERÍA (v5.2)
// --------------------------------------------------
messaging.onBackgroundMessage(async (payload) => { // <-- Se añade "async"
  console.log("📨 Notificación en background (v5.2):", payload);

  // --- ¡INICIO DE LÓGICA INTELIGENTE v5.2! ---
  // Revisa si la app ya está abierta y visible
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  
  const isAppVisible = windowClients.some(client => 
      client.visibilityState === 'visible' && client.focused
  );

  if (isAppVisible) {
      // ----
      // APP ESTÁ ABIERTA Y VISIBLE
      // ----
      console.log("SW v5.2: App está visible. Dejando que app.js (onMessage) lo maneje.");
      // No hacemos NADA. Devolvemos null.
      // Esto permite que el "oyente" en app.js (messaging.onMessage)
      // reciba el mensaje y muestre el toast de colores.
      return null; 
  }
  // --- FIN DE LÓGICA INTELIGENTE ---

  // ----
  // APP ESTÁ CERRADA O EN SEGUNDO PLANO
  // ----
  console.log("SW v5.2: App CERRADA. Mostrando notificación push (lógica original).");
  
  // Usamos tu lógica original para mostrar la notificación
  const vendedor = payload.data?.vendedor ? ` — ${payload.data.vendedor}` : "";
  const titulo = (payload.notification?.title || "Nueva alerta") + vendedor;
  const cuerpo = payload.notification?.body || "";

  // Devolvemos la promesa para mostrar la notificación
  return self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: "/ml-icon-192.png",
    badge: "/ml-icon-192.png",
    data: {
      url: payload.data?.url || "https://pablosantamaria26.github.io/app-vendedores/"
    }
  });
});


// --------------------------------------------------
// 🖱️ Click → Abrir / Enfocar App (Tu código original, sin cambios)
// --------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data.url || "https://pablosantamaria26.github.io/app-vendedores/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if (tab.url.startsWith(destino) && "focus" in tab) {
          return tab.focus();
        }
      }
      return clients.openWindow(destino);
    })
  );
});
