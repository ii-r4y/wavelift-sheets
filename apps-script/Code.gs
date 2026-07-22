/*************************************************************
 * WaveLift — Sheets Backend (بدون Firebase)
 * مخزن مستندات عام فوق Google Sheets + تسجيل دخول من شيت.
 * كل مجموعة (collection) = تبويب باسمها، العمود A = id،
 * وباقي الحقول أعمدة ديناميكية. القيم المركّبة (كائن/مصفوفة)
 * تُخزَّن كنص JSON وتُفكّ عند القراءة.
 *************************************************************/

var USERS_SHEET = 'Users'; // تبويب حسابات الدخول: email | password | role | name | uid | active

function doGet(e)  { return handle_(e, 'GET'); }
function doPost(e) { return handle_(e, 'POST'); }

function handle_(e, method) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      body = e.parameter;
      if (body.data && typeof body.data === 'string') { try { body.data = JSON.parse(body.data); } catch (x) {} }
    }
    var action = String(body.action || '').trim();
    var out;
    switch (action) {
      case 'ping':   out = { ok: true, time: new Date().toISOString() }; break;
      case 'login':  out = login_(body.email, body.password); break;
      case 'list':   out = { ok: true, docs: listDocs_(body.collection) }; break;
      case 'get':    out = { ok: true, doc: getDoc_(body.collection, body.id) }; break;
      case 'add':    out = addDoc_(body.collection, body.data); break;
      case 'set':    out = setDoc_(body.collection, body.id, body.data, !!body.merge); break;
      case 'update': out = updateDoc_(body.collection, body.id, body.data); break;
      case 'delete': out = deleteDoc_(body.collection, body.id); break;
      case 'bulkSet': out = bulkSet_(body.collection, body.docs, body.clear); break;
      default:       out = { ok: false, message: 'action غير مدعوم: ' + action };
    }
    return json_(out, body.callback);
  } catch (err) {
    return json_({ ok: false, message: 'خطأ: ' + err }, e && e.parameter && e.parameter.callback);
  }
}

/* ---------- تسجيل الدخول ---------- */
function login_(email, password) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (!email || !password) return { ok: false, message: 'الإيميل وكلمة المرور مطلوبان' };
  var rows = listDocs_(USERS_SHEET);
  for (var i = 0; i < rows.length; i++) {
    var u = rows[i];
    if (String(u.email || '').trim().toLowerCase() === email) {
      if (String(u.password || '') === password && u.active !== false && u.active !== 'FALSE') {
        return { ok: true, user: {
          uid: u.uid || u.id || email,
          email: email,
          displayName: u.name || '',
          role: u.role || 'coach'
        }};
      }
      return { ok: false, message: 'كلمة المرور غير صحيحة' };
    }
  }
  return { ok: false, message: 'المستخدم غير موجود' };
}

/* ---------- مخزن المستندات ---------- */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  name = String(name || '').trim();
  if (!name) throw new Error('اسم المجموعة مطلوب');
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1).setValue('id'); }
  return sh;
}

function headers_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) { sh.getRange(1, 1).setValue('id'); return ['id']; }
  var h = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) { return String(x || ''); });
  if (h.indexOf('id') === -1) { sh.getRange(1, 1).setValue('id'); h[0] = 'id'; }
  return h;
}

function encode_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}
function decode_(v) {
  if (typeof v === 'string') {
    var t = v.trim();
    if ((t.charAt(0) === '{' && t.charAt(t.length - 1) === '}') ||
        (t.charAt(0) === '[' && t.charAt(t.length - 1) === ']')) {
      try { return JSON.parse(t); } catch (x) {}
    }
  }
  return v;
}

function listDocs_(name) {
  var sh = sheet_(name);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  var h = headers_(sh);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    if (String(row[0] || '') === '') continue;
    var obj = {};
    for (var c = 0; c < h.length; c++) {
      if (!h[c]) continue;
      var val = decode_(row[c]);
      if (val !== '' && val !== null && val !== undefined) obj[h[c]] = val;
    }
    obj.id = String(row[0]);
    out.push(obj);
  }
  return out;
}

function findRow_(sh, id) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function getDoc_(name, id) {
  var docs = listDocs_(name);
  for (var i = 0; i < docs.length; i++) if (String(docs[i].id) === String(id)) return docs[i];
  return null;
}

function ensureColumns_(sh, keys) {
  var h = headers_(sh);
  var added = false;
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === 'id') continue;
    if (h.indexOf(keys[i]) === -1) { h.push(keys[i]); added = true; }
  }
  if (added) sh.getRange(1, 1, 1, h.length).setValues([h]);
  return h;
}

function writeRow_(sh, rowNum, data, id) {
  var h = ensureColumns_(sh, Object.keys(data));
  var arr = [];
  for (var c = 0; c < h.length; c++) {
    var key = h[c];
    if (key === 'id') { arr.push(id); }
    else if (data.hasOwnProperty(key)) { arr.push(encode_(data[key])); }
    else { arr.push(sh.getRange(rowNum, c + 1).getValue()); } // احتفظ بالقيمة القديمة عند الدمج
  }
  sh.getRange(rowNum, 1, 1, h.length).setValues([arr]);
}

function newId_() {
  return 'D' + new Date().getTime() + Math.floor(Math.random() * 1000);
}

function addDoc_(name, data) {
  data = data || {};
  var sh = sheet_(name);
  var id = data.id || newId_();
  delete data.id;
  var rowNum = sh.getLastRow() + 1;
  if (rowNum < 2) rowNum = 2;
  var h = ensureColumns_(sh, Object.keys(data));
  var arr = [];
  for (var c = 0; c < h.length; c++) {
    var key = h[c];
    arr.push(key === 'id' ? id : (data.hasOwnProperty(key) ? encode_(data[key]) : ''));
  }
  sh.getRange(rowNum, 1, 1, h.length).setValues([arr]);
  return { ok: true, id: id };
}

function setDoc_(name, id, data, merge) {
  data = data || {};
  var sh = sheet_(name);
  id = id || data.id || newId_();
  delete data.id;
  var rowNum = findRow_(sh, id);
  if (rowNum === -1) {
    rowNum = sh.getLastRow() + 1; if (rowNum < 2) rowNum = 2;
    var h = ensureColumns_(sh, Object.keys(data));
    var arr = [];
    for (var c = 0; c < h.length; c++) {
      var key = h[c];
      arr.push(key === 'id' ? id : (data.hasOwnProperty(key) ? encode_(data[key]) : ''));
    }
    sh.getRange(rowNum, 1, 1, h.length).setValues([arr]);
  } else {
    writeRow_(sh, rowNum, data, id); // الدمج يحافظ على القيم غير المذكورة
  }
  return { ok: true, id: id };
}

function updateDoc_(name, id, data) {
  var sh = sheet_(name);
  var rowNum = findRow_(sh, id);
  if (rowNum === -1) return { ok: false, message: 'المستند غير موجود' };
  writeRow_(sh, rowNum, data || {}, id);
  return { ok: true, id: id };
}

function deleteDoc_(name, id) {
  var sh = sheet_(name);
  var rowNum = findRow_(sh, id);
  if (rowNum === -1) return { ok: false, message: 'غير موجود' };
  sh.deleteRow(rowNum);
  return { ok: true, id: id };
}

function bulkSet_(name, docs, clear) {
  docs = docs || [];
  var sh = sheet_(name);
  if (clear) sh.clearContents();
  var keys = { id: 1 };
  docs.forEach(function (d) { for (var k in d) keys[k] = 1; });
  var h = Object.keys(keys);
  sh.getRange(1, 1, 1, h.length).setValues([h]);
  if (docs.length) {
    var rows = docs.map(function (d) {
      return h.map(function (k) { return k === 'id' ? String(d.id || '') : encode_(d[k]); });
    });
    sh.getRange(2, 1, rows.length, h.length).setValues(rows);
  }
  return { ok: true, count: docs.length };
}

/* ---------- الإخراج (JSON / JSONP) ---------- */
function json_(obj, callback) {
  var text = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + text + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
