// =================================================
// 🔔 Service Worker FCM - App Vendedores Inteligente
// VERSIÓN v5.3 - Optimizada para iOS Push
// =================================================

self.addEventListener("install", () => {
  console.log("⚡ Nueva versión del Service Worker (v5.3) instalada");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("♻️ Activando SW (v5.3) y reclamando clientes...");
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
// 📩 LÓGICA DE NOTIFICACIONES (v5.3) - Siempre muestra Push en iOS
// --------------------------------------------------
messaging.onBackgroundMessage(async (payload) => {
  console.log("📨 Notificación en background (v5.3):", payload);

  // En iOS, el Service Worker casi siempre intercepta.
  // Así que siempre mostraremos una notificación push del sistema,
  // pero usando los datos enriquecidos que enviamos desde el GAS.

  // Tomamos los datos limpios que preparamos en el GAS.
  const tituloNotificacion = payload.data?.titulo || "Maestro de Ventas";
  const mensajeCuerpo = payload.data?.mensaje || "Tienes un nuevo mensaje.";
  const tipoMensaje = payload.data?.tipo || "INFO"; // Para posibles usos futuros

  // Puedes añadir un emoji al cuerpo o título según el tipo aquí si quieres
  let iconoEmoji = "";
  if (tipoMensaje === "URGENTE") {
      // Ya lo ponemos en el título desde GAS
  } else if (tipoMensaje === "EXITO") {
      // Ya lo ponemos en el título desde GAS
  } else {
      // iconoEmoji = "🔵 ";
  }

  // Devolvemos la promesa para mostrar la notificación
  return self.registration.showNotification(tituloNotificacion, {
    body: iconoEmoji + mensajeCuerpo, // El emoji ya está en el cuerpo
    icon: "/ml-icon-192.png",
    badge: "/ml-icon-192.png",
    data: {
      url: payload.data?.url || "https://pablosantamaria26.github.io/app-vendedores/"
    }
  });
});


// --------------------------------------------------
// 🖱️ Click → Abrir / Enfocar App (Tu código original, preservado)
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
