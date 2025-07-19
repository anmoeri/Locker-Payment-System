// === Konfigurasi Firebase ===
const firebaseConfig = {
  // API Key digunakan untuk otentikasi permintaan ke Firebase dari aplikasi web
  apiKey: "AIzaSyBLJJo37DI4j9_azHTTVw6mMJIl6KKFP_g",

  // authDomain digunakan untuk konfigurasi Firebase Authentication (login, dll)
  authDomain: "diloker-tugas-akhir.firebaseapp.com",

  // projectId adalah ID unik dari project Firebase Anda
  projectId: "diloker-tugas-akhir",

  // storageBucket digunakan untuk penyimpanan file (jika Anda menggunakan Firebase Storage)
  storageBucket: "diloker-tugas-akhir.firebasestorage.app",

  // ID pengirim pesan, biasanya untuk Firebase Cloud Messaging (jika digunakan)
  messagingSenderId: "518411277",

  // appId adalah ID unik aplikasi Anda di Firebase
  appId: "1:518411277:web:06669e3e12ff4673eeb144",

  // measurementId digunakan jika Anda menggunakan Google Analytics
  measurementId: "G-VSVER452B2"
};

// === Inisialisasi Firebase dengan konfigurasi di atas ===
firebase.initializeApp(firebaseConfig);

// === Inisialisasi Firestore untuk akses database ===
const db = firebase.firestore();
