// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAKEZoMaPwAcLVRFVPVTQEOoQUuEEUHpwk",
  authDomain: "app-vendedores-inteligente.firebaseapp.com",
  projectId: "app-vendedores-inteligente",
  storageBucket: "app-vendedores-inteligente.appspot.com",
  messagingSenderId: "583313989429",
  appId: "1:583313989429:web:c4f78617ad957c3b11367c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log("📩 Notificación en segundo plano:", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/ml-icon-192.png"
  });
});
