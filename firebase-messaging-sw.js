// =================================================
// 🔔 Service Worker FCM - App Vendedores Inteligente
// VERSIÓN v5.7 - FIX FINAL: Renotify & Tag
// =================================================

self.addEventListener("install", (event) => {
  console.log("⚡ SW v5.7 Instalado. Forzando espera...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("♻️ SW v5.7 Activo y controlando.");
  event.waitUntil(clients.claim());
});

// --------------------------------------------------
// 📦 Librerías Firebase
// --------------------------------------------------
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

// --------------------------------------------------
// 📩 LÓGICA DE NOTIFICACIONES (Background)
// --------------------------------------------------
messaging.onBackgroundMessage(async (payload) => {
  console.log("📨 [SW] Push recibido:", payload);

  // 1. Extraer datos
  const titulo = payload.data?.titulo || "Vendedores";
  const mensaje = payload.data?.mensaje || "Nueva actualización";
  
  // 2. Configuración de la Notificación
  const notificationOptions = {
    body: mensaje,
    icon: "/ml-icon-192.png",
    badge: "/ml-icon-192.png",
    
    // --- TRUCO MAESTRO ---
    // Usamos un TAG fijo para que iOS agrupe y oculte el origen.
    // Usamos RENOTIFY: TRUE para obligar a que suene siempre.
    tag: 'app-vendedores-alert', 
    renotify: true, 
    
    data: {
      url: payload.data?.url || "https://pablosantamaria26.github.io/app-vendedores/"
    }
  };

  return self.registration.showNotification(titulo, notificationOptions);
});

// --------------------------------------------------
// 🖱️ Click en Notificación
// --------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // URL por defecto si no viene en el payload
  const urlToOpen = event.notification.data?.url || "https://pablosantamaria26.github.io/app-vendedores/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si la app ya está abierta, la enfocamos
      for (let client of windowClients) {
        if (client.url.startsWith(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // Si no, abrimos ventana nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
