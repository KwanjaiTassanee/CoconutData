/**
 * ============================================================
 *  Dashboard มะพร้าวน้ำหอม / มะพร้าวแก่  จังหวัดสงขลา
 *  - ราคา ผลผลิต เกรด แยกรายอำเภอ (บันทึกลง Google Sheet)
 *  - สภาพอากาศรายวันรายอำเภอ (Open-Meteo, ไม่ต้องใช้ API key)
 *  - เรียกดูข้อมูลย้อนหลังรายวัน / ช่วงวันที่
 *  ไฟล์นี้คือ Backend (JSON API) — หน้าเว็บอยู่ที่ GitHub/Netlify
 * ============================================================
 */

const CONFIG = {
  // 👉 วางลิงก์ (URL) หรือ ID ของ Google Sheet ที่ต้องการใช้เก็บข้อมูลไว้ตรงนี้
  //    เช่น 'https://docs.google.com/spreadsheets/d/1AbCdEf.../edit'
  //    ถ้าเว้นว่าง '' จะใช้ Google Sheet ที่สคริปต์นี้ผูกอยู่ (สร้างจาก ส่วนขยาย > Apps Script)
  SPREADSHEET_URL: '',

  // 🔒 รหัสผ่านสำหรับบันทึก/ลบข้อมูลจากหน้าเว็บ (แนะนำให้ตั้ง เพราะหน้าเว็บบน Netlify เปิดได้ทุกคน)
  //    เว้นว่าง '' = ไม่ต้องใช้รหัส
  WRITE_PIN: '',

  SHEET_RECORDS: 'ข้อมูลมะพร้าว',
  SHEET_WEATHER: 'สภาพอากาศ',
  SHEET_DISTRICTS: 'อำเภอ',
  TZ: 'Asia/Bangkok',
  TYPES: [
    { name: 'มะพร้าวน้ำหอม', priceUnit: 'บาท/ผล', qtyUnit: 'ผล' },
    { name: 'มะพร้าวแก่',    priceUnit: 'บาท/ผล', qtyUnit: 'ผล' }
  ],
  GRADES: [
    { code: 'A', label: 'เกรด A (ผลใหญ่)' },
    { code: 'B', label: 'เกรด B (ผลกลาง)' },
    { code: 'C', label: 'เกรด C (ผลเล็ก/ตกเกรด)' }
  ],
  WEATHER_CACHE_HOURS: 3,   // ข้อมูลอากาศของวันล่าสุดจะดึงใหม่ถ้าเก่ากว่านี้
  MAX_HISTORY_DAYS: 366,    // ช่วงย้อนหลังสูงสุดต่อการเรียกดู 1 ครั้ง
  FORECAST_PAST_DAYS: 60,   // ย้อนหลังไม่เกินกี่วันใช้ forecast API, เกินนั้นใช้ archive API
  TRIGGER_HOUR: 7           // เวลาที่ดึงสภาพอากาศอัตโนมัติทุกวัน
};

const REC_HEADERS = ['ID', 'วันที่', 'อำเภอ', 'ประเภท', 'เกรด', 'ราคา', 'หน่วยราคา',
  'ผลผลิต', 'หน่วยผลผลิต', 'หมายเหตุ', 'ผู้บันทึก', 'เวลาบันทึก'];
const WX_HEADERS = ['วันที่', 'อำเภอ', 'รหัสอากาศ', 'สภาพอากาศ', 'อุณหภูมิสูงสุด (°C)',
  'อุณหภูมิต่ำสุด (°C)', 'ปริมาณฝน (มม.)', 'ความชื้นเฉลี่ย (%)', 'ลมสูงสุด (กม./ชม.)', 'อัปเดตเมื่อ'];
const DIST_HEADERS = ['อำเภอ', 'ละติจูด', 'ลองจิจูด'];

// พิกัดโดยประมาณของที่ว่าการอำเภอ (แก้ไขได้ในชีต "อำเภอ")
const DEFAULT_DISTRICTS = [
  ['เมืองสงขลา', 7.1989, 100.5951],
  ['สทิงพระ', 7.4836, 100.4375],
  ['จะนะ', 6.9165, 100.7397],
  ['นาทวี', 6.7316, 100.6913],
  ['เทพา', 6.8306, 100.9661],
  ['สะบ้าย้อย', 6.6040, 100.9420],
  ['ระโนด', 7.7769, 100.3192],
  ['กระแสสินธุ์', 7.6106, 100.3156],
  ['รัตภูมิ', 7.1428, 100.2869],
  ['สะเดา', 6.6378, 100.4228],
  ['หาดใหญ่', 7.0084, 100.4747],
  ['นาหม่อม', 6.9672, 100.5520],
  ['ควนเนียง', 7.1580, 100.3750],
  ['บางกล่ำ', 7.0890, 100.4220],
  ['สิงหนคร', 7.2330, 100.5530],
  ['คลองหอยโข่ง', 6.8970, 100.3540]
];

const WX_CODES = {
  0: ['ท้องฟ้าแจ่มใส', '☀️'], 1: ['แจ่มใสเป็นส่วนใหญ่', '🌤️'], 2: ['มีเมฆบางส่วน', '⛅'], 3: ['เมฆมาก', '☁️'],
  45: ['มีหมอก', '🌫️'], 48: ['หมอกหนา', '🌫️'],
  51: ['ฝนละอองเบา', '🌦️'], 53: ['ฝนละออง', '🌦️'], 55: ['ฝนละอองหนาแน่น', '🌦️'],
  56: ['ฝนละอองเย็นจัด', '🌦️'], 57: ['ฝนละอองเย็นจัด', '🌦️'],
  61: ['ฝนตกเล็กน้อย', '🌧️'], 63: ['ฝนตกปานกลาง', '🌧️'], 65: ['ฝนตกหนัก', '🌧️'],
  66: ['ฝนเย็นจัด', '🌧️'], 67: ['ฝนเย็นจัดหนัก', '🌧️'],
  71: ['หิมะเล็กน้อย', '🌨️'], 73: ['หิมะ', '🌨️'], 75: ['หิมะหนัก', '🌨️'], 77: ['เกล็ดหิมะ', '🌨️'],
  80: ['ฝนซู่เล็กน้อย', '🌦️'], 81: ['ฝนซู่ปานกลาง', '🌧️'], 82: ['ฝนซู่หนักมาก', '⛈️'],
  85: ['หิมะซู่', '🌨️'], 86: ['หิมะซู่หนัก', '🌨️'],
  95: ['พายุฝนฟ้าคะนอง', '⛈️'], 96: ['พายุฝนฟ้าคะนอง มีลูกเห็บ', '⛈️'], 99: ['พายุฝนฟ้าคะนองรุนแรง', '⛈️']
};

/* =================== Web App & เมนู =================== */

/* ---------- JSON API (หน้าเว็บบน Netlify เรียกผ่าน URL /exec) ---------- */

// true = ต้องใช้ WRITE_PIN
const API_ACTIONS = {
  getInitData: false, getDailyDashboard: false, getHistory: false, getRecords: false,
  saveRecords: true, deleteRecord: true
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action) {
    let args = [];
    try { args = p.args ? JSON.parse(p.args) : []; } catch (err) { }
    return apiResponse_(p.action, args, p.pin);
  }
  return json_({ ok: true, message: 'Coconut Dashboard API พร้อมใช้งาน', time: new Date().toISOString() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }); }
  return apiResponse_(body.action, body.args || [], body.pin);
}

function apiResponse_(action, args, pin) {
  try {
    if (!Object.prototype.hasOwnProperty.call(API_ACTIONS, action)) throw new Error('ไม่รู้จักคำสั่ง: ' + action);
    if (API_ACTIONS[action] && CONFIG.WRITE_PIN && String(pin || '') !== String(CONFIG.WRITE_PIN)) {
      throw new Error('รหัสผ่านสำหรับบันทึกไม่ถูกต้อง');
    }
    const fns = { getInitData, getDailyDashboard, getHistory, getRecords, saveRecords, deleteRecord };
    const data = fns[action].apply(null, Array.isArray(args) ? args : []);
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('🥥 Dashboard มะพร้าว')
      .addItem('1) ตั้งค่าระบบครั้งแรก', 'setup')
      .addItem('อัปเดตสภาพอากาศวันนี้', 'dailyWeatherJob')
      .addSeparator()
      .addItem('สร้างข้อมูลตัวอย่าง 30 วัน (ทดสอบ)', 'seedSampleData')
      .addItem('ลบข้อมูลตัวอย่าง', 'clearSampleData')
      .addToUi();
  } catch (e) { /* เปิดจากที่อื่นที่ไม่มี UI */ }
}

/** รันครั้งแรกครั้งเดียว: สร้างชีต หัวตาราง รายชื่ออำเภอ และตั้งเวลาดึงอากาศอัตโนมัติ */
function setup() {
  const ss = openConfiguredSs_() || SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('กรุณาใส่ SPREADSHEET_URL ใน CONFIG หรือสร้างสคริปต์จาก Google Sheet (ส่วนขยาย > Apps Script)');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  console.log('ใช้ Google Sheet: ' + ss.getName() + ' — ' + ss.getUrl());
  ss.setSpreadsheetTimeZone(CONFIG.TZ);

  const rec = ensureSheet_(ss, CONFIG.SHEET_RECORDS, REC_HEADERS);
  rec.getRange('B:B').setNumberFormat('@');
  rec.getRange('F:F').setNumberFormat('#,##0.00');
  rec.getRange('H:H').setNumberFormat('#,##0');
  rec.getRange('L:L').setNumberFormat('yyyy-mm-dd hh:mm');

  const wx = ensureSheet_(ss, CONFIG.SHEET_WEATHER, WX_HEADERS);
  wx.getRange('A:A').setNumberFormat('@');
  wx.getRange('J:J').setNumberFormat('yyyy-mm-dd hh:mm');

  const dist = ensureSheet_(ss, CONFIG.SHEET_DISTRICTS, DIST_HEADERS);
  if (dist.getLastRow() < 2) {
    dist.getRange(2, 1, DEFAULT_DISTRICTS.length, 3).setValues(DEFAULT_DISTRICTS);
  }

  // ตั้ง trigger ดึงสภาพอากาศทุกวัน (ลบตัวเก่าก่อนกันซ้ำ)
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'dailyWeatherJob')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyWeatherJob').timeBased()
    .everyDays(1).atHour(CONFIG.TRIGGER_HOUR).inTimezone(CONFIG.TZ).create();

  dailyWeatherJob();
  try { ss.toast('ตั้งค่าเรียบร้อย ต่อไปให้ Deploy เป็น Web app (สิทธิ์: ทุกคน)', '🥥 Dashboard มะพร้าว', 8); } catch (e) { }
  console.log('ตั้งค่าเรียบร้อย ใช้ Sheet: ' + ss.getUrl());
}

/** งานรายวัน: บันทึกสภาพอากาศเมื่อวาน (ค่าจริง) และวันนี้ (พยากรณ์) ของทุกอำเภอ */
function dailyWeatherJob() {
  const today = todayStr_();
  const rows = fetchWeather_(addDays_(today, -1), today, getDistricts_());
  upsertWeather_(rows);
}

/* =================== API ที่หน้าเว็บเรียกใช้ =================== */

function getInitData() {
  return {
    districts: getDistricts_().map(d => d.name),
    types: CONFIG.TYPES,
    grades: CONFIG.GRADES,
    today: todayStr_(),
    maxHistoryDays: CONFIG.MAX_HISTORY_DAYS,
    sheetUrl: getSs_().getUrl(),
    writeProtected: !!CONFIG.WRITE_PIN
  };
}

/** ข้อมูลรายวัน: รายการราคา/ผลผลิตของวันนั้น + วันที่มีข้อมูลก่อนหน้า + สภาพอากาศทุกอำเภอ */
function getDailyDashboard(dateStr) {
  if (!isValidDate_(dateStr)) dateStr = todayStr_();
  const all = readRecords_();
  const records = all.filter(r => r.date === dateStr);

  let prevDate = null;
  all.forEach(r => { if (r.date < dateStr && (!prevDate || r.date > prevDate)) prevDate = r.date; });
  const prevRecords = prevDate ? all.filter(r => r.date === prevDate) : [];

  let weather = [], weatherError = null;
  try { weather = getWeatherRange_(dateStr, dateStr); }
  catch (e) { weatherError = String(e.message || e); }

  return { date: dateStr, records, prevDate, prevRecords, weather, weatherError };
}

/** ข้อมูลย้อนหลังช่วงวันที่ สรุปรายวัน รายอำเภอ และรายเกรด */
function getHistory(start, end, district) {
  if (!isValidDate_(start) || !isValidDate_(end)) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
  if (start > end) { const t = start; start = end; end = t; }
  const span = diffDays_(start, end) + 1;
  if (span > CONFIG.MAX_HISTORY_DAYS) throw new Error('เลือกช่วงได้ไม่เกิน ' + CONFIG.MAX_HISTORY_DAYS + ' วัน');
  district = district || '';

  const inRange = readRecords_().filter(r => r.date >= start && r.date <= end);
  const recs = inRange.filter(r => !district || r.district === district);

  let wx = [], weatherError = null;
  try { wx = getWeatherRange_(start, end).filter(w => !district || w.district === district); }
  catch (e) { weatherError = String(e.message || e); }

  // จัดกลุ่ม
  const recByDate = {}, wxByDate = {};
  recs.forEach(r => { (recByDate[r.date] = recByDate[r.date] || []).push(r); });
  wx.forEach(w => { (wxByDate[w.date] = wxByDate[w.date] || []).push(w); });

  const days = [];
  for (let d = start; d <= end; d = addDays_(d, 1)) {
    const rs = recByDate[d] || [];
    const byType = {};
    CONFIG.TYPES.forEach(t => { byType[t.name] = statsFor_(rs.filter(r => r.type === t.name)); });
    days.push({ date: d, byType, weather: aggregateWeather_(wxByDate[d] || []), n: rs.length });
  }

  // สรุปรายอำเภอ (ใช้ข้อมูลทุกอำเภอเพื่อเปรียบเทียบ)
  const districtSummary = getDistricts_().map(dd => {
    const rs = inRange.filter(r => r.district === dd.name);
    const byType = {};
    CONFIG.TYPES.forEach(t => { byType[t.name] = statsFor_(rs.filter(r => r.type === t.name)); });
    return { district: dd.name, byType };
  });

  // สรุปรายเกรด
  const gradeSummary = [];
  CONFIG.TYPES.forEach(t => CONFIG.GRADES.forEach(g => {
    const s = statsFor_(recs.filter(r => r.type === t.name && r.grade === g.code));
    gradeSummary.push(Object.assign({ type: t.name, grade: g.code }, s));
  }));

  return { start, end, district, days, districtSummary, gradeSummary, total: recs.length, weatherError };
}

/** ดึงรายการที่บันทึกไว้ของวัน/อำเภอ (ใช้เติมฟอร์มเพื่อแก้ไข) */
function getRecords(dateStr, district) {
  return readRecords_().filter(r => r.date === dateStr && (!district || r.district === district));
}

/**
 * บันทึกข้อมูล
 * payload = { date, district, recorder, note, replace, items:[{type, grade, price, qty}] }
 * replace = true จะแทนที่ข้อมูลเดิมของ วัน+อำเภอ+ประเภท+เกรด เดียวกัน
 */
function saveRecords(p) {
  if (!p || !isValidDate_(p.date)) throw new Error('วันที่ไม่ถูกต้อง');
  if (getDistricts_().map(d => d.name).indexOf(p.district) < 0) throw new Error('ไม่พบอำเภอที่เลือก');

  const typeMap = {}; CONFIG.TYPES.forEach(t => typeMap[t.name] = t);
  const gradeSet = CONFIG.GRADES.map(g => g.code);
  const items = (p.items || []).map(it => ({
    type: it.type, grade: it.grade, price: toNum_(it.price), qty: toNum_(it.qty)
  })).filter(it => it.price !== null || it.qty !== null);

  if (!items.length) throw new Error('กรุณากรอกราคาหรือผลผลิตอย่างน้อย 1 รายการ');
  items.forEach(it => {
    if (!typeMap[it.type]) throw new Error('ประเภทมะพร้าวไม่ถูกต้อง: ' + it.type);
    if (gradeSet.indexOf(it.grade) < 0) throw new Error('เกรดไม่ถูกต้อง: ' + it.grade);
    if (it.price === null) throw new Error('กรุณากรอกราคา ' + it.type + ' เกรด ' + it.grade);
    if (it.price < 0 || (it.qty !== null && it.qty < 0)) throw new Error('ตัวเลขต้องไม่ติดลบ');
  });

  let recorder = String(p.recorder || '').trim();
  if (!recorder) { try { recorder = Session.getActiveUser().getEmail(); } catch (e) { } }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(CONFIG.SHEET_RECORDS, REC_HEADERS);
    let replaced = 0;
    if (p.replace && sh.getLastRow() >= 2) {
      const keys = {};
      items.forEach(it => keys[[p.date, p.district, it.type, it.grade].join('|')] = true);
      const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
      for (let i = vals.length - 1; i >= 0; i--) {
        const k = [toDateStr_(vals[i][1]), vals[i][2], vals[i][3], vals[i][4]].join('|');
        if (keys[k]) { sh.deleteRow(i + 2); replaced++; }
      }
    }
    const now = new Date();
    const rows = items.map(it => {
      const t = typeMap[it.type];
      return [Utilities.getUuid().slice(0, 8), p.date, p.district, it.type, it.grade,
        it.price, t.priceUnit, it.qty === null ? '' : it.qty, t.qtyUnit,
        String(p.note || ''), recorder, now];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, REC_HEADERS.length).setValues(rows);
    return { saved: rows.length, replaced };
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(CONFIG.SHEET_RECORDS, REC_HEADERS);
    if (sh.getLastRow() < 2) return false;
    const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); return true; }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

/* =================== ข้อมูลสภาพอากาศ =================== */

/** คืนข้อมูลอากาศช่วงวันที่ ใช้ข้อมูลในชีตก่อน ถ้าขาดหรือเก่าจะดึงจาก Open-Meteo แล้วบันทึก */
function getWeatherRange_(start, end) {
  const districts = getDistricts_();
  const today = todayStr_();
  const maxEnd = addDays_(today, 15);           // พยากรณ์ล่วงหน้าได้ ~16 วัน
  if (end > maxEnd) end = maxEnd;
  if (start > end) return [];

  const cached = readWeather_(start, end);
  const staleBefore = Date.now() - CONFIG.WEATHER_CACHE_HOURS * 3600 * 1000;
  const recentFrom = addDays_(today, -2);

  let needStart = null, needEnd = null;
  for (let d = start; d <= end; d = addDays_(d, 1)) {
    const recent = d >= recentFrom;
    const need = districts.some(x => {
      const c = cached[d + '|' + x.name];
      return !c || (recent && c.updatedMs < staleBefore);
    });
    if (need) { if (!needStart) needStart = d; needEnd = d; }
  }

  if (needStart) {
    const fresh = fetchWeather_(needStart, needEnd, districts);
    upsertWeather_(fresh);
    fresh.forEach(w => { cached[w.date + '|' + w.district] = w; });
  }

  return Object.keys(cached).map(k => {
    const w = cached[k];
    return {
      date: w.date, district: w.district, code: w.code, desc: w.desc, icon: w.icon,
      tmax: w.tmax, tmin: w.tmin, rain: w.rain, humidity: w.humidity, wind: w.wind
    };
  }).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

function fetchWeather_(start, end, districts) {
  const today = todayStr_();
  const cutoff = addDays_(today, -CONFIG.FORECAST_PAST_DAYS);
  let out = [];
  if (start <= cutoff) {
    out = out.concat(callOpenMeteo_('https://archive-api.open-meteo.com/v1/archive',
      start, end < cutoff ? end : cutoff, districts));
  }
  if (end > cutoff) {
    out = out.concat(callOpenMeteo_('https://api.open-meteo.com/v1/forecast',
      start > cutoff ? start : addDays_(cutoff, 1), end, districts));
  }
  return out;
}

function callOpenMeteo_(base, start, end, districts) {
  const baseVars = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max';
  const build = vars => base + '?' + [
    'latitude=' + districts.map(d => d.lat).join(','),
    'longitude=' + districts.map(d => d.lon).join(','),
    'daily=' + vars,
    'timezone=' + encodeURIComponent(CONFIG.TZ),
    'start_date=' + start,
    'end_date=' + end
  ].join('&');

  let res = UrlFetchApp.fetch(build(baseVars + ',relative_humidity_2m_mean'), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    // สำรอง: บาง endpoint อาจไม่รองรับความชื้นเฉลี่ยรายวัน
    res = UrlFetchApp.fetch(build(baseVars), { muteHttpExceptions: true });
  }
  if (res.getResponseCode() !== 200) {
    throw new Error('ดึงสภาพอากาศไม่สำเร็จ (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200));
  }

  let data = JSON.parse(res.getContentText());
  if (!Array.isArray(data)) data = [data];

  const rows = [];
  data.forEach((loc, i) => {
    const d = loc.daily;
    if (!d || !d.time || !districts[i]) return;
    d.time.forEach((t, j) => {
      const tmax = at_(d.temperature_2m_max, j);
      if (tmax === null) return;               // ยังไม่มีข้อมูลวันนั้น
      const code = at_(d.weather_code, j);
      const info = wxInfo_(code);
      rows.push({
        date: t, district: districts[i].name, code: code, desc: info.text, icon: info.icon,
        tmax: tmax, tmin: at_(d.temperature_2m_min, j), rain: at_(d.precipitation_sum, j),
        humidity: at_(d.relative_humidity_2m_mean, j), wind: at_(d.wind_speed_10m_max, j),
        updatedMs: Date.now()
      });
    });
  });
  return rows;
}

function readWeather_(start, end) {
  const sh = getSheet_(CONFIG.SHEET_WEATHER, WX_HEADERS);
  const map = {};
  if (sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, WX_HEADERS.length).getValues().forEach(r => {
    const date = toDateStr_(r[0]);
    if (date < start || date > end) return;
    const code = toNum_(r[2]);
    const info = wxInfo_(code);
    map[date + '|' + r[1]] = {
      date: date, district: String(r[1]), code: code, desc: info.text, icon: info.icon,
      tmax: toNum_(r[4]), tmin: toNum_(r[5]), rain: toNum_(r[6]), humidity: toNum_(r[7]), wind: toNum_(r[8]),
      updatedMs: r[9] instanceof Date ? r[9].getTime() : 0
    };
  });
  return map;
}

function upsertWeather_(rows) {
  if (!rows || !rows.length) return;
  const sh = getSheet_(CONFIG.SHEET_WEATHER, WX_HEADERS);
  const index = {};
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
      .forEach((k, i) => { index[toDateStr_(k[0]) + '|' + k[1]] = i + 2; });
  }
  const now = new Date();
  const appends = [];
  rows.forEach(w => {
    const vals = [w.date, w.district, w.code, w.desc, w.tmax, w.tmin, w.rain, w.humidity, w.wind, now]
      .map(v => v === null || v === undefined ? '' : v);
    const r = index[w.date + '|' + w.district];
    if (r) sh.getRange(r, 1, 1, vals.length).setValues([vals]);
    else appends.push(vals);
  });
  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, WX_HEADERS.length).setValues(appends);
  }
}

/** รวมสภาพอากาศหลายอำเภอเป็นค่าเฉลี่ย (กรณีเลือก "ทุกอำเภอ") */
function aggregateWeather_(ws) {
  if (!ws.length) return null;
  const avg = key => {
    const v = ws.map(w => w[key]).filter(x => x !== null && x !== '' && !isNaN(x));
    return v.length ? round_(v.reduce((a, b) => a + b, 0) / v.length, 1) : null;
  };
  const count = {};
  ws.forEach(w => { if (w.code !== null) count[w.code] = (count[w.code] || 0) + 1; });
  let code = null, best = -1;
  Object.keys(count).forEach(c => { if (count[c] > best) { best = count[c]; code = Number(c); } });
  const info = wxInfo_(code);
  return {
    code: code, desc: info.text, icon: info.icon, tmax: avg('tmax'), tmin: avg('tmin'),
    rain: avg('rain'), humidity: avg('humidity'), wind: avg('wind'), districts: ws.length
  };
}

function wxInfo_(code) {
  const c = WX_CODES[code];
  return c ? { text: c[0], icon: c[1] } : { text: 'ไม่มีข้อมูล', icon: '❔' };
}

/* =================== ข้อมูลตัวอย่าง (สำหรับทดสอบ) =================== */

function seedSampleData() {
  const sh = getSheet_(CONFIG.SHEET_RECORDS, REC_HEADERS);
  const base = {
    'มะพร้าวน้ำหอม': { A: [14, 18], B: [10, 13], C: [6, 9] },
    'มะพร้าวแก่': { A: [18, 24], B: [13, 17], C: [8, 12] }
  };
  const today = todayStr_(), rows = [], now = new Date();
  getDistricts_().forEach(d => {
    const bias = (Math.random() - 0.5) * 2;
    for (let i = 29; i >= 0; i--) {
      const date = addDays_(today, -i);
      const trend = Math.sin(i / 6) * 0.8;
      CONFIG.TYPES.forEach(t => CONFIG.GRADES.forEach(g => {
        const r = base[t.name][g.code];
        const price = round_(r[0] + Math.random() * (r[1] - r[0]) + bias + trend, 2);
        const qty = Math.round((g.code === 'A' ? 1500 : g.code === 'B' ? 2500 : 1200) * (0.6 + Math.random() * 0.8));
        rows.push([Utilities.getUuid().slice(0, 8), date, d.name, t.name, g.code, price, t.priceUnit,
          qty, t.qtyUnit, 'ข้อมูลตัวอย่าง', 'ระบบ', now]);
      }));
    }
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, REC_HEADERS.length).setValues(rows);
  try { SpreadsheetApp.getActiveSpreadsheet().toast('สร้างข้อมูลตัวอย่าง ' + rows.length + ' แถว'); } catch (e) { }
}

function clearSampleData() {
  const sh = getSheet_(CONFIG.SHEET_RECORDS, REC_HEADERS);
  if (sh.getLastRow() < 2) return;
  const all = sh.getRange(2, 1, sh.getLastRow() - 1, REC_HEADERS.length).getValues();
  const keep = all.filter(r => r[9] !== 'ข้อมูลตัวอย่าง');
  sh.getRange(2, 1, all.length, REC_HEADERS.length).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, REC_HEADERS.length).setValues(keep);
  try { SpreadsheetApp.getActiveSpreadsheet().toast('ลบข้อมูลตัวอย่าง ' + (all.length - keep.length) + ' แถว'); } catch (e) { }
}

/* =================== ตัวช่วย =================== */

/** เปิด Sheet จาก SPREADSHEET_URL (รับได้ทั้ง URL เต็มหรือ ID) */
function openConfiguredSs_() {
  const v = String(CONFIG.SPREADSHEET_URL || '').trim();
  if (!v) return null;
  const m = v.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return SpreadsheetApp.openById(m ? m[1] : v);
}

function getSs_() {
  const configured = openConfiguredSs_();
  if (configured) return configured;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('ยังไม่ได้ตั้งค่าระบบ กรุณารันฟังก์ชัน setup() ก่อน');
  return ss;
}

function ensureSheet_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1f6b42').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getSheet_(name, headers) {
  return ensureSheet_(getSs_(), name, headers);
}

function getDistricts_() {
  const sh = getSs_().getSheetByName(CONFIG.SHEET_DISTRICTS);
  if (sh && sh.getLastRow() >= 2) {
    const list = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues()
      .filter(r => r[0] !== '' && r[1] !== '' && r[2] !== '')
      .map(r => ({ name: String(r[0]).trim(), lat: Number(r[1]), lon: Number(r[2]) }));
    if (list.length) return list;
  }
  return DEFAULT_DISTRICTS.map(r => ({ name: r[0], lat: r[1], lon: r[2] }));
}

function readRecords_() {
  const sh = getSheet_(CONFIG.SHEET_RECORDS, REC_HEADERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, REC_HEADERS.length).getValues()
    .filter(r => r[0] !== '' && r[1] !== '')
    .map(r => ({
      id: String(r[0]), date: toDateStr_(r[1]), district: String(r[2]), type: String(r[3]),
      grade: String(r[4]), price: toNum_(r[5]), priceUnit: String(r[6]), qty: toNum_(r[7]),
      qtyUnit: String(r[8]), note: String(r[9]), recorder: String(r[10]),
      ts: r[11] instanceof Date ? Utilities.formatDate(r[11], CONFIG.TZ, 'yyyy-MM-dd HH:mm') : String(r[11])
    }));
}

/** ราคาเฉลี่ยถ่วงน้ำหนักด้วยผลผลิต (ถ้ามีผลผลิตครบ) มิฉะนั้นใช้ค่าเฉลี่ยธรรมดา */
function statsFor_(rs) {
  const qty = rs.reduce((a, r) => a + (r.qty || 0), 0);
  const priced = rs.filter(r => r.price !== null);
  if (!priced.length) return { avg: null, min: null, max: null, qty: qty, n: rs.length };
  const prices = priced.map(r => r.price);
  const weighted = priced.every(r => r.qty > 0);
  const avg = weighted
    ? priced.reduce((a, r) => a + r.price * r.qty, 0) / priced.reduce((a, r) => a + r.qty, 0)
    : prices.reduce((a, b) => a + b, 0) / prices.length;
  return {
    avg: round_(avg, 2), min: Math.min.apply(null, prices), max: Math.max.apply(null, prices),
    qty: qty, n: rs.length
  };
}

function fmtDate_(d) { return Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd'); }
function todayStr_() { return fmtDate_(new Date()); }
function pad2_(n) { return ('0' + n).slice(-2); }

function toDateStr_(v) {
  if (v instanceof Date) return fmtDate_(v);
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]) : s;
}

function isValidDate_(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

function addDays_(s, n) {
  const p = s.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

function diffDays_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

function toNum_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function at_(arr, i) { return arr && arr[i] !== undefined && arr[i] !== null ? arr[i] : null; }
function round_(n, d) { const f = Math.pow(10, d); return Math.round(n * f) / f; }
