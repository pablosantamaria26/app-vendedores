// =================================================
// 🔔 Service Worker FCM - App Vendedores Inteligente
// =================================================

self.addEventListener("install", () => {
  console.log("⚡ Nueva versión del Service Worker instalada");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("♻️ Activando SW y reclamando clientes...");
  event.waitUntil(clients.claim());
});

// --------------------------------------------------
// 📦 Librerías Firebase
// --------------------------------------------------
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// ✅ Inicializar Firebase
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
// 📩 Notificaciones en segundo plano (app cerrada o minimizada)
// --------------------------------------------------
messaging.onBackgroundMessage((payload) => {
  console.log("📨 Notificación en background:", payload);

  // Soporte para mensajes personalizados hacia cada vendedor
  const vendedor = payload.data?.vendedor ? ` — ${payload.data.vendedor}` : "";

  const titulo = (payload.notification?.title || "Nueva alerta") + vendedor;
  const cuerpo = payload.notification?.body || "";

  self.registration.showNotification(titulo, {
    body: cuerpo,
    icon: "/ml-icon-192.png",
    badge: "/ml-icon-192.png",
    data: {
      url: payload.data?.url || "https://pablosantamaria26.github.io/app-vendedores/"
    }
  });
});

// --------------------------------------------------
// 🖱️ Click → Abrir / Enfocar App
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
