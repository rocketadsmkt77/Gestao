/* ══════════════════════════════════════════
   Configuração do projeto Firebase — Rocket Gestão
   Usado para: login/senha (Authentication) e
   armazenamento centralizado de contas (Firestore),
   permitindo bloqueio remoto de clientes inadimplentes.
   ══════════════════════════════════════════ */

firebase.initializeApp({
  apiKey: "AIzaSyBY9g_bP44YM2q0_E6MM69sPwV30DmZncU",
  authDomain: "rocket-gestao.firebaseapp.com",
  projectId: "rocket-gestao",
  storageBucket: "rocket-gestao.firebasestorage.app",
  messagingSenderId: "1014569295665",
  appId: "1:1014569295665:web:a1880f05f58d684ffdda10",
  measurementId: "G-LZZN1SQ9RL"
});

const auth = firebase.auth();
const db   = firebase.firestore();
