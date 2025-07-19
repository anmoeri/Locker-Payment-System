// === 🔧 Import Library yang Dibutuhkan ===
const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const port = 5000;

// === 🔑 Inisialisasi Firebase Admin SDK ===
const serviceAccount = require("./diloker-tugas-akhir-firebase-adminsdk-fbsvc-7109cb6182.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// === 🛡️ Middleware untuk Static File & JSON Body Parsing ===
app.use(express.static("public"));
app.use(bodyParser.json());

// === 🔢 Fungsi Generate ID Reservasi (10 digit angka acak) ===
function generateReservationId(length = 6) {
  let result = "";
  const digits = "0123456789";
  for (let i = 0; i < length; i++) {
    result += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return result;
}

// === 💳 Endpoint: Buat Invoice ke Xendit ===
app.post("/api/create-invoice", async (req, res) => {
  const { docId, amount } = req.body;

  try {
    const response = await axios.post(
      "https://api.xendit.co/v2/invoices",
      {
        external_id: docId,
        amount,
        description: "Pembayaran Loker",
        success_redirect_url: `https://a0b72666ea73.ngrok-free.app/sukses.html?external_id=${docId}`,
      },
      {
        auth: {
          username: "xnd_development_404UaBFOdZ8XKsJydcBeu3u2w7nmoKUvKSPruerOlJKRgE2zqHKBZGcrhN3Qsu", // API Key Xendit
          password: "", // kosongkan
        },
      }
    );

    console.log("[INVOICE] Berhasil dibuat:", response.data.invoice_url);
    res.status(200).json({ invoice_url: response.data.invoice_url });
  } catch (error) {
    console.error("Gagal membuat invoice:", error.response?.data || error.message);
    res.status(500).json({ error: "Gagal membuat invoice Xendit." });
  }
});

// === 🔁 Endpoint: Callback dari Xendit saat Pembayaran Sukses ===
app.get("/callback", async (req, res) => {
  const { external_id, status } = req.query;

  // ✅ Validasi parameter
  if (!external_id || !status) {
    return res.status(400).send("Parameter tidak lengkap.");
  }

  console.log(`[Callback] Diterima external_id=${external_id}, status=${status}`);

  // ✅ Jika pembayaran sukses
  if (status.toUpperCase() === "PAID") {
    try {
      const paymentRef = db.collection("payments").doc(external_id);
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists) {
        console.error(`[Callback] Doc ${external_id} tidak ditemukan di payments`);
        return res.status(404).send("Pembayaran tidak ditemukan.");
      }

      // 🔁 Ambil dan ubah data dari koleksi 'payments'
      const paymentData = paymentSnap.data();
      paymentData.status_bayar = true;
      paymentData.status_sewa = "active";
      paymentData.payment_timestamp = admin.firestore.FieldValue.serverTimestamp();
      paymentData.reservation_id_for_loker = generateReservationId();

      // 📥 Simpan ke koleksi 'reservations'
      await db.collection("reservations").doc(external_id).set(paymentData);

      // 📤 Kirim permintaan buka loker ke koleksi 'open_locker_request'
      await db.collection("open_locker_request").add({
        locker_number: paymentData.locker_number,
        status: "pending",
        triggered_at: new Date().toISOString()
      });

      // ⏱️ Catat waktu selesai pembayaran
      await db.collection("payment_speed").doc(external_id).update({
        end_time: admin.firestore.FieldValue.serverTimestamp()
      });

      // ❌ Hapus data dari koleksi 'payments'
      await paymentRef.delete();

      console.log(`[Callback] Pembayaran ${external_id} berhasil. Data dipindahkan dan loker diminta dibuka.`);
      return res.redirect("/sukses.html");
    } catch (err) {
      console.error("[Callback] Error saat proses pembayaran:", err);
      return res.status(500).send("Terjadi kesalahan.");
    }
  }

  // ❌ Jika status bukan "PAID"
  console.warn(`[Callback] Status bukan PAID (${status})`);
  return res.redirect("/payment.html");
});

// === 🚀 Jalankan Server ===
app.listen(port, () => {
  console.log(`🚀 Server aktif di http://localhost:${port}`);
});