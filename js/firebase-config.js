// Firebase Configuration
// =====================================================
// คำแนะนำการ Setup:
// 1. ไปที่ https://console.firebase.google.com/
// 2. สร้าง Project ใหม่ (ชื่ออะไรก็ได้)
// 3. ไปที่ Project Settings > General > Your apps
// 4. คลิก "Add app" เลือก Web (</>)
// 5. ตั้งชื่อ app แล้ว Register
// 6. Copy config มาวางแทนที่ด้านล่าง
// 7. ไปที่ Firestore Database > Create database > Start in test mode
// 8. ไปที่ Storage > Get started > Start in test mode
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyCuNV96tkIByS-yWh7INRPn1poLrk3YG-M",
  authDomain: "activity-23455.firebaseapp.com",
  projectId: "activity-23455",
  storageBucket: "activity-23455.firebasestorage.app",
  messagingSenderId: "668010686632",
  appId: "1:668010686632:web:38452edcd7c890109b3a9d",
  measurementId: "G-W0X9ET6T8E"
};

// Initialize Firebase
let app, db, storage;

// Check if Firebase is loaded
function initializeFirebase() {
  if (typeof firebase !== 'undefined') {
    // Check if config is set
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
      console.error("⚠️ กรุณาตั้งค่า Firebase Config ก่อนใช้งาน!");
      showConfigError();
      return false;
    }

    try {
      app = firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      storage = firebase.storage();
      console.log("✅ Firebase initialized successfully!");
      return true;
    } catch (error) {
      console.error("❌ Firebase initialization error:", error);
      return false;
    }
  } else {
    console.error("❌ Firebase SDK not loaded!");
    return false;
  }
}

function showConfigError() {
  const container = document.querySelector('.container');
  if (container) {
    container.innerHTML = `
      <div class="card" style="margin-top: 2rem;">
        <h2 style="color: #e94560;">⚠️ Firebase ยังไม่ได้ตั้งค่า</h2>
        <p>กรุณาทำตามขั้นตอนต่อไปนี้:</p>
        <ol style="color: var(--text-secondary); line-height: 2;">
          <li>ไปที่ <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
          <li>สร้าง Project ใหม่</li>
          <li>เพิ่ม Web App</li>
          <li>Copy config มาแก้ไขที่ไฟล์ <code>js/firebase-config.js</code></li>
          <li>สร้าง Firestore Database (test mode)</li>
          <li>สร้าง Storage (test mode)</li>
          <li>Refresh หน้านี้</li>
        </ol>
      </div>
    `;
  }
}

// Export for use in other files
window.firebaseApp = {
  init: initializeFirebase,
  getDb: () => db,
  getStorage: () => storage
};
