// ตั้งค่าการเชื่อมต่อกับ Google Apps Script (Backend)
// API_URL = ลิงก์ Web app ที่ลงท้ายด้วย /exec
// ถ้า Deploy ใหม่แล้วได้ลิงก์ใหม่ ให้แก้บรรทัดนี้แล้ว commit ขึ้น GitHub (Netlify จะอัปเดตเว็บให้อัตโนมัติ)
window.APP_CONFIG = {
  // true = แสดงข้อมูลตัวอย่าง (ไม่ต้องเชื่อม Apps Script) | false = ใช้ข้อมูลจริงจาก Google Sheet
  // หรือเปิดเว็บด้วย ?demo=1 เพื่อดูข้อมูลตัวอย่าง และ ?demo=0 เพื่อกลับมาใช้ข้อมูลจริง
  DEMO_MODE: false,

  API_URL: 'https://script.google.com/macros/s/AKfycbzF_DwxpmVfVAuHWRhKBLY1S17mxMZS3Qq3nn65mkIZ0eaigQrfWZTZxDsAq8fuijumjw/exec'
};

// https://script.google.com/macros/s/AKfycbzF_DwxpmVfVAuHWRhKBLY1S17mxMZS3Qq3nn65mkIZ0eaigQrfWZTZxDsAq8fuijumjw/exec
