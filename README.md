# 🥥 Dashboard มะพร้าว จังหวัดสงขลา

แสดงราคา ผลผลิต และเกรดของมะพร้าวน้ำหอมกับมะพร้าวแก่ รายอำเภอ (16 อำเภอ) พร้อมสภาพอากาศรายวันและข้อมูลย้อนหลัง

```
ผู้ใช้ ──► Netlify (index.html, config.js)   ← โค้ดเก็บบน GitHub
              │ fetch (POST JSON)
              ▼
        Google Apps Script /exec (apps-script/Code.gs)
              │                       │
              ▼                       ▼
        Google Sheet            Open-Meteo (สภาพอากาศ)
```

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้า Dashboard (Frontend) |
| `config.js` | ลิงก์ API ของ Apps Script (`/exec`) และสวิตช์โหมดข้อมูลตัวอย่าง |
| `mock.js` | ข้อมูลตัวอย่าง (จำลอง API ในเบราว์เซอร์) |
| `netlify.toml` | ตั้งค่า Netlify |
| `apps-script/Code.gs` | Backend: วางใน Apps Script ไม่ได้ใช้บน Netlify |

## 1) ตั้งค่า Google Apps Script (Backend)

1. เปิด Google Sheet แล้วไปที่ **ส่วนขยาย → Apps Script**
2. วางโค้ดจาก `apps-script/Code.gs` ทับไฟล์ `Code.gs` เดิม
   - ถ้ามีไฟล์ `Index.html` อยู่ในโปรเจกต์ Apps Script ให้ลบทิ้ง เพราะไม่ได้ใช้แล้ว
3. ที่ส่วน `CONFIG` ตอนต้นไฟล์ ตั้งค่าดังนี้
   - `SPREADSHEET_URL`: เว้นว่างไว้ได้ ถ้าสคริปต์ผูกกับ Sheet อยู่แล้ว
   - `WRITE_PIN`: รหัสผ่านสำหรับบันทึกหรือลบข้อมูล **แนะนำให้ตั้ง** เพราะหน้าเว็บเปิดได้ทุกคน
4. เลือกฟังก์ชัน `setup` แล้วกด **เรียกใช้** (ทำครั้งแรกครั้งเดียว)
5. อัปเดตการ Deploy ตามนี้
   - **การทำให้ใช้งานได้ → จัดการการทำให้ใช้งานได้ → ✏️**
   - เวอร์ชัน: **เวอร์ชันใหม่**
   - ดำเนินการในฐานะ: **ฉัน**
   - ผู้ที่มีสิทธิ์เข้าถึง: **ทุกคน** (สำคัญ ถ้าไม่ตั้งค่านี้ หน้าเว็บจะเรียก API ไม่ได้)
6. ทดสอบโดยเปิดลิงก์ `/exec` ในเบราว์เซอร์ ต้องเห็นข้อความ `"Coconut Dashboard API พร้อมใช้งาน"`

> ทุกครั้งที่แก้ `Code.gs` ต้องทำขั้นตอนที่ 5 (เวอร์ชันใหม่) ซ้ำ ลิงก์ `/exec` จะยังเป็นลิงก์เดิม

## 2) อัปโหลดขึ้น GitHub

1. ไปที่ https://github.com/new แล้วตั้งชื่อ repository เช่น `coconut-dashboard`
2. กด **uploading an existing file** แล้วลากไฟล์ทั้งหมดในโฟลเดอร์นี้ (รวมโฟลเดอร์ `apps-script`) ไปวาง
3. กด **Commit changes**

## 3) เชื่อม Netlify

1. เข้า https://app.netlify.com แล้วกด **Add new site → Import an existing project → GitHub**
2. เลือก repository `coconut-dashboard`
3. ไม่ต้องกรอก Build command และให้ Publish directory เป็น `.` (ค่านี้ตั้งไว้ใน `netlify.toml` แล้ว)
4. กด **Deploy** แล้วจะได้ลิงก์แบบ `https://xxxx.netlify.app`
5. ถ้าต้องการเปลี่ยนชื่อ ไปที่ **Site configuration → Change site name** เช่น `songkhla-coconut.netlify.app`
6. ถ้ามีโดเมนของตัวเอง ให้ตั้งที่ **Domain management → Add a domain**

หลังจากนี้ ทุกครั้งที่แก้ไฟล์บน GitHub แล้ว commit Netlify จะอัปเดตเว็บให้อัตโนมัติ

## โหมดข้อมูลตัวอย่าง

- `DEMO_MODE: true` ใน `config.js` แสดงข้อมูลจำลองทั้ง 16 อำเภอ ย้อนหลังได้ 1 ปี และพยากรณ์ล่วงหน้า 15 วัน โดยไม่ต้องเชื่อม Apps Script
- เปลี่ยนเป็น `false` เมื่อพร้อมใช้ข้อมูลจริงจาก Google Sheet
- สลับได้ชั่วคราวผ่าน URL: `?demo=1` เพื่อเปิด และ `?demo=0` เพื่อปิด
- ในโหมดนี้ การบันทึกหรือลบจะเก็บในเบราว์เซอร์นั้นเท่านั้น ไม่ลง Google Sheet

## แก้ปัญหา

| อาการ | วิธีแก้ |
|---|---|
| "เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON" | ตั้ง Deploy ให้ผู้ที่มีสิทธิ์เข้าถึงเป็น **ทุกคน** และเลือก **เวอร์ชันใหม่** |
| "ไม่รู้จักคำสั่ง" / ข้อมูลไม่อัปเดตหลังแก้โค้ด | ยังไม่ได้ Deploy เป็นเวอร์ชันใหม่ |
| "รหัสผ่านสำหรับบันทึกไม่ถูกต้อง" | ใส่ให้ตรงกับ `WRITE_PIN` ใน Code.gs |
| เปลี่ยนลิงก์ `/exec` | แก้ `API_URL` ใน `config.js` บน GitHub |
