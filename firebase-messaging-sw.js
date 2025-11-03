// ==================================================
// 🔔 Service Worker FCM - App Vendedores Inteligente (versión auto-actualizable)
// ==================================================

// ✅ Fuerza la actualización inmediata del SW cuando cambia
self.addEventListener("install", (event) => {
  console.log("⚡ Nueva versión del Service Worker instalada");
  self.skipWaiting(); // Evita quedar en estado “waiting”
});

self.addEventListener("activate", (event) => {
  console.log("♻️ Activando nueva versión del SW y reclamando clientes...");
  event.waitUntil(clients.claim()); // Toma control inmediato de las pestañas
});

// ==================================================
// 📦 Librerías Firebase
// ==================================================
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// ✅ Configuración Firebase
firebase.initializeApp({
  apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
  authDomain: "app-vendedores-inteligente.firebaseapp.com",
  projectId: "app-vendedores-inteligente",
  storageBucket: "app-vendedores-inteligente.appspot.com",
  messagingSenderId: "583313989429",
  appId: "1:583313989429:web:c4f78617ad957c3b11367c"
});

// ✅ Inicializa el servicio de mensajería
const messaging = firebase.messaging();

// ==================================================
// 📩 Manejo de notificaciones en segundo plano
// ==================================================
messaging.onBackgroundMessage((payload) => {
  console.log("📨 Notificación en segundo plano recibida:", payload);

  const notif = payload.notification || {
    title: "Nueva alerta",
    body: "Tienes una nueva notificación.",
    icon: "ml-icon-192.png"
  };

  const notificationTitle = notif.title || "Notificación";
  const notificationOptions = {
    body: notif.body || "",
    icon: notif.icon || "ml-icon-192.png",
    badge: "ml-icon-192.png",
    data: payload.data || {}
  };

  // Muestra la notificación
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==================================================
// 🖱️ Click en la notificación
// Abre la app si está cerrada o la enfoca si está abierta
// ==================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = "https://pablosantamaria26.github.io/app-vendedores/"; // 🔗 ajustá si cambia el path

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
