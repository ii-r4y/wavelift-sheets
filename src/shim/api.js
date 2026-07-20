// عميل الاتصال بـ Apps Script (Sheets backend).
// ⬇️ ضع هنا رابط النشر (/exec) بعد نشر Apps Script:
export const API_URL = "https://script.google.com/macros/s/AKfycbyrmT-ITfLM3zXzuQdH2dH4QNhDnb5shbZVzmdDzSA6vs0nzqfQmuz8em2SqZ6qo2rl/exec";

export async function apiCall(action, payload = {}) {
  if (!API_URL || API_URL.indexOf("PASTE_") === 0) {
    throw new Error("لم يتم ضبط رابط API بعد (api.js).");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
    redirect: "follow",
  });
  return res.json();
}
