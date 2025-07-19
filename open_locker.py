import time
import firebase_admin
from firebase_admin import credentials, firestore
import RPi.GPIO as GPIO

# === Inisialisasi Firebase ===
cred = credentials.Certificate("/home/pi/web-payment-app/diloker-tugas-akhir-firebase-adminsdk-fbsvc-62f3431e02.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# === Setup GPIO untuk loker ===
GPIO.setmode(GPIO.BCM)
LOKER_GPIO = {
    "001": 17,
    "002": 27,
    "003": 22
}
for pin in LOKER_GPIO.values():
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, GPIO.LOW)  # Semua tertutup awalnya

def update_kondisi_loker(locker_number, kondisi):
    locker_id = f"Loker {locker_number}"
    db.collection("lockers").document(locker_id).set({
        "kondisi_loker": kondisi,
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)
    print(f"[UPDATE] {locker_id} -> {kondisi}")

def buka_loker(locker_number):
    pin = LOKER_GPIO.get(locker_number)
    if not pin:
        print(f"[ERROR] Loker {locker_number} tidak valid.")
        return

    print(f"[INFO] Membuka loker {locker_number} (GPIO {pin})...")
    GPIO.output(pin, GPIO.HIGH)
    update_kondisi_loker(locker_number, "TERBUKA")

    time.sleep(10)  # Waktu terbuka

    GPIO.output(pin, GPIO.LOW)
    update_kondisi_loker(locker_number, "TERTUTUP")

    print(f"[INFO] Loker {locker_number} telah ditutup kembali.")

def monitor_request():
    print("[INFO] Memantau permintaan buka loker...")
    while True:
        try:
            requests = db.collection("open_locker_request") \
                         .where("status", "==", "pending") \
                         .order_by("triggered_at") \
                         .limit(1).get()

            if requests:
                req = requests[0]
                req_id = req.id
                data = req.to_dict()
                locker_number = data.get("locker_number")

                print(f"[REQUEST] Buka Loker {locker_number} (ID: {req_id})")

                # Tandai sebagai processing
                db.collection("open_locker_request").document(req_id).update({
                    "status": "processing",
                    "processing_at": firestore.SERVER_TIMESTAMP
                })

                buka_loker(locker_number)

                db.collection("open_locker_request").document(req_id).update({
                    "status": "opened",
                    "opened_at": firestore.SERVER_TIMESTAMP
                })
        except Exception as e:
            print(f"[ERROR] {e}")

        time.sleep(2)

if __name__ == "__main__":
    try:
        monitor_request()
    except KeyboardInterrupt:
        GPIO.cleanup()
        print("\n[INFO] Program dihentikan oleh pengguna.")