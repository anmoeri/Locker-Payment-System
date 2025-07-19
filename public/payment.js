let lastScannedDocId = null;
let lastTotalPrice = null;

// === [1] Inisialisasi Event DOM ===
document.addEventListener("DOMContentLoaded", () => {
  // === [1.1] Referensi Elemen UI ===
  const checkBtn = document.getElementById("checkBtn");
  const openLockerBtn = document.getElementById("openLockerBtn");
  const confirmBtn = document.getElementById("confirmPayBtn");
  const inputField = document.getElementById("qrInput");
  const statusDiv = document.getElementById("status");
  const detailDiv = document.getElementById("reservationDetails");

  // === [2] EVENT: Periksa Pembayaran ===
  checkBtn.addEventListener("click", async () => {
    const inputCode = inputField.value.trim();
    if (!inputCode) {
      alert("Masukkan kode pembayaran terlebih dahulu.");
      return;
    }

    statusDiv.innerHTML = "Memeriksa data reservasi...";
    detailDiv.innerHTML = "";
    confirmBtn.style.display = "none";

    let dataDoc = null;
    let collectionFound = null;
    let statusPeriksa = "tidak ditemukan";

    try {
      // === [2.1] Cek di Koleksi payments ===
      const paySnap = await db.collection("payments")
        .where("payment_qr_code_data", "==", inputCode)
        .limit(1)
        .get();

      if (!paySnap.empty) {
        dataDoc = paySnap.docs[0].data();
        collectionFound = "payments";
      } else {
        // === [2.2] Jika tidak ditemukan, cek di reservations ===
        const resSnap = await db.collection("reservations")
          .where("payment_qr_code_data", "==", inputCode)
          .limit(1)
          .get();

        if (!resSnap.empty) {
          dataDoc = resSnap.docs[0].data();
          collectionFound = "reservations";
        }
      }

      // === [2.3] Jika data ditemukan ===
      if (dataDoc && collectionFound) {
        const lockerDoc = await db.collection("lockers").doc("Loker " + dataDoc.locker_number).get();

        const lockerStatus = lockerDoc.exists ? lockerDoc.data().status : null;
        const isLokerAvailable = lockerStatus === "available";

        // === [2.4] Tampilkan informasi reservasi ===
        detailDiv.innerHTML = `
          <h3>Data Reservasi (${collectionFound}):</h3>
          <p><strong>Payment Code:</strong> ${dataDoc.payment_qr_code_data}</p>
          <p><strong>Tanggal:</strong> ${dataDoc.date}</p>
          <p><strong>Loker:</strong> ${dataDoc.locker_number}</p>
          <p><strong>Durasi:</strong> ${dataDoc.duration_hours} jam</p>
          <p><strong>Status Sewa:</strong> ${dataDoc.status_sewa}</p>
          <p><strong>Status Bayar:</strong> ${dataDoc.status_bayar}</p>
          <p><strong>Total:</strong> Rp${dataDoc.total_price.toLocaleString()}</p>
          ${!isLokerAvailable ? '<p style="color:red;"><strong>Loker tidak tersedia.</strong></p>' : ''}
        `;

        lastScannedDocId = dataDoc.payment_qr_code_data;
        lastTotalPrice = dataDoc.total_price;

        // === [2.5] Atur tombol bayar ===
        if (
          dataDoc.status_sewa === "completed" ||
          dataDoc.status_bayar === true ||
          !isLokerAvailable
        ) {
          confirmBtn.disabled = true;
          confirmBtn.innerText = isLokerAvailable ? "Sudah Dibayar" : "Loker Tidak Tersedia";
          confirmBtn.style.opacity = 0.5;
        } else {
          confirmBtn.disabled = false;
          confirmBtn.innerText = "Bayar Sekarang";
          confirmBtn.style.opacity = 1;
        }

        confirmBtn.style.display = "block";
        statusDiv.innerHTML = `<span style="color:green;">Reservasi ditemukan.</span>`;
        statusPeriksa = "valid";
      } else {
        // === [2.6] Jika data tidak ditemukan ===
        statusDiv.innerHTML = `<span style="color:red;">Kode tidak ditemukan di sistem.</span>`;
        detailDiv.innerHTML = "";
        confirmBtn.style.display = "none";
      }

      // === [2.7] Catat log pemeriksaan ke Firestore ===
      await db.collection("check_code").add({
        input_code: inputCode,
        status_periksa: statusPeriksa,
        waktu_periksa: firebase.firestore.FieldValue.serverTimestamp()
      });

    } catch (err) {
      console.error("Gagal memeriksa kode:", err);
      statusDiv.innerHTML = `<span style="color:red;">Terjadi kesalahan saat memeriksa kode.</span>`;
    }
  });

  // === [3] EVENT: Kirim Permintaan Pembayaran ===
  confirmBtn.addEventListener("click", async () => {
    if (!lastScannedDocId || !lastTotalPrice) {
      alert("Reservasi tidak valid.");
      return;
    }

    try {
      // === [3.1] Simpan waktu mulai proses pembayaran ===
      await db.collection("payment_speed").doc(lastScannedDocId).set({
        start_time: firebase.firestore.FieldValue.serverTimestamp()
      });

      // === [3.2] Kirim permintaan POST ke server ===
      const res = await fetch("/api/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: lastScannedDocId,
          amount: lastTotalPrice
        })
      });

      const data = await res.json();
      if (data.invoice_url) {
        window.open(data.invoice_url, "_blank");
      } else {
        alert("Gagal membuat invoice.");
      }
    } catch (err) {
      console.error("Gagal membuat invoice:", err);
      alert("Gagal menghubungi server.");
    }
  });

  // === [4] EVENT: Buka Loker Manual ===
  openLockerBtn.addEventListener("click", async () => {
    const inputCode = inputField.value.trim();
    if (!inputCode) {
      alert("Masukkan kode unik reservasi terlebih dahulu.");
      return;
    }

    try {
      const snap = await db.collection("reservations")
        .where("reservation_id_for_loker", "==", inputCode)
        .limit(1)
        .get();

      if (snap.empty) {
        alert("Kode reservasi tidak ditemukan.");
        return;
      }

      const data = snap.docs[0].data();

      await db.collection("open_locker_request").add({
        locker_number: data.locker_number,
        status: "pending",
        triggered_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert(`Permintaan buka loker ${data.locker_number} telah dikirim.`);
    } catch (err) {
      console.error("Gagal buka loker:", err);
      alert("Terjadi kesalahan saat membuka loker.");
    }
  });
});
