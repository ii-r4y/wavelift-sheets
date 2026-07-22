// بديل firebase/firestore/lite فوق Apps Script + Sheets
import { apiCall } from "./api.js";

export function getFirestore() { return { __db: true }; }
export function collection(_db, name) { return { __t: "collection", name }; }
export function doc(_db, name, id) { return { __t: "doc", name, id }; }
export function query(ref, ...cons) { return { __t: "query", name: ref.name, cons }; }
export function where(f, op, v) { return { __c: "where", f, op, v }; }
export function limit(n) { return { __c: "limit", n }; }
export function serverTimestamp() { return new Date().toISOString(); }

function stripId(obj) { if (!obj) return obj; const { id, ...rest } = obj; return rest; }
function snap(row) {
  return { id: String(row.id), exists: () => true, data: () => stripId(row) };
}
function applyCons(rows, cons) {
  let out = rows;
  let lim = null;
  (cons || []).forEach((c) => {
    if (c.__c === "where") {
      out = out.filter((r) => {
        const val = r[c.f];
        switch (c.op) {
          case "==": return val === c.v;
          case "!=": return val !== c.v;
          case ">": return val > c.v;
          case ">=": return val >= c.v;
          case "<": return val < c.v;
          case "<=": return val <= c.v;
          case "in": return Array.isArray(c.v) && c.v.indexOf(val) !== -1;
          case "array-contains": return Array.isArray(val) && val.indexOf(c.v) !== -1;
          default: return true;
        }
      });
    } else if (c.__c === "limit") { lim = c.n; }
  });
  if (lim != null) out = out.slice(0, lim);
  return out;
}

// [أداء] كاش قصير + دمج الطلبات المتوازية لنفس المجموعة
const __listCache = new Map();   // name -> {ts, rows}
const __inflight = new Map();    // name -> Promise
const CACHE_MS = 60000;
async function listCollection(name) {
  const c = __listCache.get(name);
  if (c && Date.now() - c.ts < CACHE_MS) return c.rows;
  if (__inflight.has(name)) return __inflight.get(name);
  const p = apiCall("list", { collection: name }).then((r) => {
    const rows = (r && r.docs) || [];
    __listCache.set(name, { ts: Date.now(), rows });
    __inflight.delete(name);
    return rows;
  }).catch((e) => { __inflight.delete(name); throw e; });
  __inflight.set(name, p);
  return p;
}
function invalidate(name) { __listCache.delete(name); }

export async function getDocs(ref) {
  let rows = await listCollection(ref.name);
  if (ref.__t === "query") rows = applyCons(rows, ref.cons);
  const docs = rows.map(snap);
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) };
}
export async function getDoc(ref) {
  const rows = await listCollection(ref.name);
  const d = rows.find((x) => String(x.id) === String(ref.id)) || null;
  return { id: String(ref.id), exists: () => !!d, data: () => (d ? stripId(d) : undefined) };
}
export async function addDoc(ref, data) {
  invalidate(ref.name);
  const r = await apiCall("add", { collection: ref.name, data: data || {} });
  if (!r || r.ok === false) throw new Error((r && r.message) || "فشل الإضافة");
  return { id: r.id };
}
export async function setDoc(ref, data, opts) {
  invalidate(ref.name);
  const r = await apiCall("set", { collection: ref.name, id: ref.id, data: data || {}, merge: !!(opts && opts.merge) });
  if (!r || r.ok === false) throw new Error((r && r.message) || "فشل الحفظ");
  return;
}
export async function updateDoc(ref, data) {
  invalidate(ref.name);
  const r = await apiCall("update", { collection: ref.name, id: ref.id, data: data || {} });
  if (!r || r.ok === false) throw new Error((r && r.message) || "فشل التحديث");
  return;
}
export async function deleteDoc(ref) {
  invalidate(ref.name);
  const r = await apiCall("delete", { collection: ref.name, id: ref.id });
  if (!r || r.ok === false) throw new Error((r && r.message) || "فشل الحذف");
  return;
}
