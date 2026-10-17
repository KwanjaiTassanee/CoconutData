/**
 * โหมดข้อมูลตัวอย่าง (Mock API) — จำลองการทำงานของ Apps Script ทั้งหมดในเบราว์เซอร์
 * - ข้อมูลสร้างจากสูตรสุ่มแบบกำหนดค่าได้ (seeded) วันเดิมอำเภอเดิมจะได้ตัวเลขเดิมทุกครั้ง
 * - ข้อมูลที่บันทึก/ลบจากฟอร์ม เก็บใน localStorage ของเบราว์เซอร์นี้เท่านั้น (ไม่ลง Google Sheet)
 * เปิดใช้: ตั้ง DEMO_MODE: true ใน config.js หรือเปิดเว็บด้วย ?demo=1   ปิด: ?demo=0
 */
(function () {
  const DISTRICTS = ['เมืองสงขลา', 'สทิงพระ', 'จะนะ', 'นาทวี', 'เทพา', 'สะบ้าย้อย', 'ระโนด', 'กระแสสินธุ์',
    'รัตภูมิ', 'สะเดา', 'หาดใหญ่', 'นาหม่อม', 'ควนเนียง', 'บางกล่ำ', 'สิงหนคร', 'คลองหอยโข่ง'];
  const TYPES = [
    { name: 'มะพร้าวน้ำหอม', priceUnit: 'บาท/ผล', qtyUnit: 'ผล' },
    { name: 'มะพร้าวแก่', priceUnit: 'บาท/ผล', qtyUnit: 'ผล' }
  ];
  const GRADES = [
    { code: 'A', label: 'เกรด A (ผลใหญ่)' },
    { code: 'B', label: 'เกรด B (ผลกลาง)' },
    { code: 'C', label: 'เกรด C (ผลเล็ก/ตกเกรด)' }
  ];
  // ช่วงราคาฐาน (บาท/ผล) และผลผลิตฐานต่อวัน (ผล)
  const PRICE = {
    'มะพร้าวน้ำหอม': { A: [15, 19], B: [11, 14], C: [6, 9] },
    'มะพร้าวแก่': { A: [19, 25], B: [14, 18], C: [8, 12] }
  };
  const QTY = { A: 1400, B: 2400, C: 1100 };
  // อำเภอที่ปลูกมาก (ผลผลิตสูงกว่า)
  const DISTRICT_SCALE = {
    'สทิงพระ': 1.6, 'ระโนด': 1.5, 'กระแสสินธุ์': 1.4, 'สิงหนคร': 1.3, 'จะนะ': 1.2, 'เทพา': 1.1,
    'หาดใหญ่': 0.6, 'เมืองสงขลา': 0.5, 'สะเดา': 0.7, 'คลองหอยโข่ง': 0.7
  };
  const WX = {
    0: ['ท้องฟ้าแจ่มใส', '☀️'], 1: ['แจ่มใสเป็นส่วนใหญ่', '🌤️'], 2: ['มีเมฆบางส่วน', '⛅'], 3: ['เมฆมาก', '☁️'],
    51: ['ฝนละอองเบา', '🌦️'], 61: ['ฝนตกเล็กน้อย', '🌧️'], 63: ['ฝนตกปานกลาง', '🌧️'], 65: ['ฝนตกหนัก', '🌧️'],
    80: ['ฝนซู่เล็กน้อย', '🌦️'], 81: ['ฝนซู่ปานกลาง', '🌧️'], 95: ['พายุฝนฟ้าคะนอง', '⛈️']
  };
  const STORE_KEY = 'coconut_mock_store_v1';

  /* ---------- helpers ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(seed);
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const r2 = n => Math.round(n * 100) / 100;
  const r1 = n => Math.round(n * 10) / 10;
  function today() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function addDays(s, n) {
    const p = s.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }
  function dayNum(s) { const p = s.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { saved: {}, deleted: {} }; } catch (e) { return { saved: {}, deleted: {} }; } }
  function persist(st) { try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) { } }

  /* ---------- สร้างข้อมูล ---------- */
  function weatherFor(date, district) {
    const r = rng('wx|' + date + '|' + district);
    const region = rng('wxday|' + date)();          // ฝนมักตกพร้อมกันทั้งจังหวัด
    const month = Number(date.slice(5, 7));
    const wetSeason = month >= 10 || month <= 1;    // มรสุมตะวันออกเฉียงเหนือ ต.ค.–ม.ค.
    const pRain = wetSeason ? 0.65 : (month >= 5 && month <= 9 ? 0.4 : 0.2);
    const raining = (region * 0.6 + r() * 0.4) < pRain;
    const rain = raining ? r1(Math.pow(r(), 1.8) * (wetSeason ? 70 : 30) + 0.5) : (r() < 0.2 ? 0.2 : 0);
    let code;
    if (rain === 0) code = [0, 1, 2, 3][Math.floor(r() * 4)];
    else if (rain < 2) code = r() < 0.5 ? 51 : 80;
    else if (rain < 10) code = r() < 0.5 ? 61 : 80;
    else if (rain < 30) code = r() < 0.5 ? 63 : 81;
    else code = r() < 0.5 ? 65 : 95;
    const tmax = r1(33.5 - rain * 0.06 - (wetSeason ? 1.2 : 0) + (r() - 0.5) * 1.6);
    const w = WX[code];
    return {
      date, district, code, desc: w[0], icon: w[1], tmax,
      tmin: r1(23.2 + (r() - 0.5) * 1.6 + (wetSeason ? 0 : 0.6)),
      rain, humidity: Math.round(72 + rain * 0.35 + r() * 8), wind: Math.round(8 + r() * 14 + (rain > 30 ? 10 : 0))
    };
  }

  function generatedRecords(date) {
    if (date > today()) return [];
    const out = [], d = dayNum(date);
    DISTRICTS.forEach((dist, di) => {
      const reports = rng('rep|' + date + '|' + dist)() < 0.88;   // บางอำเภอไม่ได้รายงานบางวัน
      if (!reports) return;
      const bias = (rng('bias|' + dist)() - 0.5) * 2.2;
      const wx = weatherFor(date, dist);
      TYPES.forEach((t, ti) => {
        const season = Math.sin((d + di * 3) / (ti ? 23 : 17)) * 1.1 + Math.sin(d / 61) * 0.9;
        GRADES.forEach(g => {
          const r = rng('rec|' + date + '|' + dist + '|' + t.name + '|' + g.code);
          const [lo, hi] = PRICE[t.name][g.code];
          const price = r2(Math.max(3, lo + (hi - lo) * (0.35 + r() * 0.3) + bias + season - (wx.rain > 40 ? 0.6 : 0)));
          const qty = Math.round(QTY[g.code] * (DISTRICT_SCALE[dist] || 1) * (0.7 + r() * 0.6) * (wx.rain > 40 ? 0.7 : 1) * (ti ? 0.8 : 1));
          out.push({
            id: `m-${date}-${di}-${ti}-${g.code}`, date, district: dist, type: t.name, grade: g.code,
            price, priceUnit: t.priceUnit, qty, qtyUnit: t.qtyUnit, note: 'ข้อมูลตัวอย่าง', recorder: 'ระบบจำลอง', ts: date + ' 17:00'
          });
        });
      });
    });
    return out;
  }

  function recordsFor(date) {
    const st = load();
    const key = r => [r.date, r.district, r.type, r.grade].join('|');
    const map = {};
    generatedRecords(date).forEach(r => { if (!st.deleted[r.id]) map[key(r)] = r; });
    Object.values(st.saved).forEach(r => { if (r.date === date && !st.deleted[r.id]) map[key(r)] = r; });
    return Object.values(map);
  }

  function recordsRange(start, end) {
    let out = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out = out.concat(recordsFor(d));
    return out;
  }

  /* ---------- สรุปข้อมูล (เหมือนฝั่ง Apps Script) ---------- */
  function stats(rs) {
    const qty = rs.reduce((a, r) => a + (r.qty || 0), 0);
    const priced = rs.filter(r => r.price != null);
    if (!priced.length) return { avg: null, min: null, max: null, qty, n: rs.length };
    const prices = priced.map(r => r.price);
    const weighted = priced.every(r => r.qty > 0);
    const avg = weighted
      ? priced.reduce((a, r) => a + r.price * r.qty, 0) / priced.reduce((a, r) => a + r.qty, 0)
      : prices.reduce((a, b) => a + b, 0) / prices.length;
    return { avg: r2(avg), min: Math.min(...prices), max: Math.max(...prices), qty, n: rs.length };
  }
  function aggWeather(ws) {
    if (!ws.length) return null;
    const avg = k => r1(ws.reduce((a, w) => a + w[k], 0) / ws.length);
    const count = {}; ws.forEach(w => count[w.code] = (count[w.code] || 0) + 1);
    const code = Number(Object.keys(count).sort((a, b) => count[b] - count[a])[0]);
    return { code, desc: WX[code][0], icon: WX[code][1], tmax: avg('tmax'), tmin: avg('tmin'), rain: avg('rain'), humidity: avg('humidity'), wind: avg('wind'), districts: ws.length };
  }
  const weatherDay = date => date > addDays(today(), 15) ? [] : DISTRICTS.map(d => weatherFor(date, d));

  /* ---------- API ---------- */
  const api = {
    getInitData() {
      return { districts: DISTRICTS, types: TYPES, grades: GRADES, today: today(), maxHistoryDays: 366, sheetUrl: '', writeProtected: false, demo: true };
    },
    getDailyDashboard(date) {
      const records = recordsFor(date);
      let prevDate = null;
      for (let i = 1; i <= 30; i++) { const d = addDays(date, -i); if (recordsFor(d).length) { prevDate = d; break; } }
      return { date, records, prevDate, prevRecords: prevDate ? recordsFor(prevDate) : [], weather: weatherDay(date), weatherError: null };
    },
    getHistory(start, end, district) {
      if (start > end) [start, end] = [end, start];
      district = district || '';
      const inRange = recordsRange(start, end);
      const recs = inRange.filter(r => !district || r.district === district);
      const byDate = {};
      recs.forEach(r => (byDate[r.date] = byDate[r.date] || []).push(r));
      const days = [];
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const rs = byDate[d] || [], byType = {};
        TYPES.forEach(t => byType[t.name] = stats(rs.filter(r => r.type === t.name)));
        days.push({ date: d, byType, weather: aggWeather(weatherDay(d).filter(w => !district || w.district === district)), n: rs.length });
      }
      const districtSummary = DISTRICTS.map(dn => {
        const rs = inRange.filter(r => r.district === dn), byType = {};
        TYPES.forEach(t => byType[t.name] = stats(rs.filter(r => r.type === t.name)));
        return { district: dn, byType };
      });
      const gradeSummary = [];
      TYPES.forEach(t => GRADES.forEach(g => gradeSummary.push(Object.assign({ type: t.name, grade: g.code }, stats(recs.filter(r => r.type === t.name && r.grade === g.code))))));
      return { start, end, district, days, districtSummary, gradeSummary, total: recs.length, weatherError: null };
    },
    getRecords(date, district) {
      return recordsFor(date).filter(r => !district || r.district === district);
    },
    saveRecords(p) {
      const st = load();
      const items = (p.items || []).filter(it => it.price !== '' && it.price != null);
      if (!items.length) throw new Error('กรุณากรอกราคาอย่างน้อย 1 เกรด');
      let replaced = 0;
      items.forEach(it => {
        const t = TYPES.find(x => x.name === it.type);
        // แทนที่ข้อมูลเดิม (ทั้งที่จำลองและที่เคยบันทึก)
        recordsFor(p.date).filter(r => r.district === p.district && r.type === it.type && r.grade === it.grade)
          .forEach(r => { if (p.replace) { st.deleted[r.id] = true; delete st.saved[r.id]; replaced++; } });
        const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        st.saved[id] = {
          id, date: p.date, district: p.district, type: it.type, grade: it.grade,
          price: Number(it.price), priceUnit: t.priceUnit, qty: it.qty === '' ? null : Number(it.qty), qtyUnit: t.qtyUnit,
          note: p.note || '', recorder: p.recorder || 'ผู้ทดสอบ', ts: new Date().toISOString().slice(0, 16).replace('T', ' ')
        };
      });
      persist(st);
      return { saved: items.length, replaced };
    },
    deleteRecord(id) {
      const st = load();
      st.deleted[id] = true; delete st.saved[id];
      persist(st);
      return true;
    }
  };

  window.MockApi = {
    call(action, args) {
      if (!api[action]) return Promise.reject(new Error('ไม่รู้จักคำสั่ง: ' + action));
      return new Promise((resolve, reject) => setTimeout(() => {
        try { resolve(JSON.parse(JSON.stringify(api[action].apply(null, args || [])))); }
        catch (e) { reject(e); }
      }, 150));
    },
    reset() { try { localStorage.removeItem(STORE_KEY); } catch (e) { } }
  };
})();
