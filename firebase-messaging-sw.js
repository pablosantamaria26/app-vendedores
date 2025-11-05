// ==================================================
// 🔔 Service Worker FCM - App Vendedores Inteligente
// ==================================================

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

// ==================================================
// 📦 Firebase
// ==================================================
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
  authDomain: "app-vendedores-inteligente.firebaseapp.com",
  projectId: "app-vendedores-inteligente",
  storageBucket: "app-vendedores-inteligente.appspot.com",
  messagingSenderId: "583313989429",
  appId: "1:583313989429:web:c4f78617ad957c3b11367c"
});

const messaging = firebase.messaging();

// ==================================================
// 📩 Notificación en segundo plano
// ==================================================
messaging.onBackgroundMessage((payload) => {
  const notif = payload.notification || {};
  self.registration.showNotification(
    notif.title || "Nueva actualización",
    {
      body: notif.body || "",
      icon: "ml-icon-192.png",
      badge: "ml-icon-192.png",
      data: payload.data || {}
    }
  );
});

// ==================================================
// 🖱️ Click en notificación (abrir/enfocar app)
// ==================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "https://pablosantamaria26.github.io/app-vendedores/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
