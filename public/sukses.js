// === Ambil Parameter dari URL ===
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// === Fungsi Generate ID Angka Acak ===
function generateId(len = 6) {
  const digits = '0123456789';
  return [...Array(len)].map(() => digits[Math.floor(Math.random() * digits.length)]).join('');
}

// === Proses setelah Halaman Dimuat ===
document.addEventListener("DOMContentLoaded", async () => {
  // === Ambil ID eksternal dari URL (parameter 'external_id') ===
  const externalId = getQueryParam("external_id");
  if (!externalId) return;

  try {
    // === Ambil dokumen pembayaran dari koleksi 'payments' ===
    const docRef = db.collection("payments").doc(externalId);
    const docSnap = await docRef.get();

    // === Cek apakah data pembayaran ditemukan ===
    if (!docSnap.exists) {
      console.error("Data pembayaran tidak ditemukan.");
      return;
    }

    // === Ambil data pembayaran ===
    const data = docSnap.data();

    // === Hitung waktu akhir sewa berdasarkan durasi ===
    const now = new Date();
    const durationMs = (data.duration_hours || 0) * 60 * 60 * 1000;
    const endTime = new Date(now.getTime() + durationMs);

    // === Siapkan data baru untuk koleksi 'reservations' ===
    const reservationData = {
      ...data,
      payment_timestamp: now,                        // Waktu pembayaran
      start_time: now,                               // Waktu mulai sewa
      end_time: endTime,                             // Waktu selesai sewa
      reservation_id_for_loker: generateId(),        // ID unik untuk pembukaan loker manual
      status_bayar: true,
      status_sewa: "active"
    };

    // === Simpan ke koleksi 'reservations' ===
    await db.collection("reservations").doc(externalId).set(reservationData);

    // === Hapus dokumen dari koleksi 'payments' ===
    await docRef.delete();

    // === Perbarui status loker di koleksi 'lockers' ===
    await db.collection("lockers").doc(`Loker ${data.locker_number}`).update({
      status: "not available"
    });

    // === Kirim permintaan buka loker ke koleksi 'open_locker_request' ===
    await db.collection("open_locker_request").add({
      locker_number: data.locker_number,
      status: "pending",
      triggered_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    // === Tambahkan timestamp selesai proses pembayaran ke 'payment_speed' ===
    await db.collection("payment_speed").doc(externalId).update({
      end_time: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log("Transaksi berhasil diproses dan loker dibuka.");
  } catch (err) {
    console.error("Gagal memproses pembayaran:", err);
  }
});