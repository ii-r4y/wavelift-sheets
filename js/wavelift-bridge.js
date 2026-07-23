import { loginAdmin, loginCoach, logoutCoach, resetPassword } from "../src/firebase/auth.js";
import { firebaseConfig } from "../src/firebase/config.js";
import {
  getAdminProfile,
  getAllPlayers,
  getAnnouncements,
  getAttendance,
  getAttendanceRecords,
  getCoaches,
  getCoachProfile,
  getDailyWorkouts,
  getGymExerciseTemplates,
  getSchedule,
  getSportSettings,
  getSports,
  addCoach,
  addDailyWorkout,
  addGymExerciseTemplate,
  addSport,
  deleteAttendanceRecord,
  deleteAttendanceRecordById,
  deleteCoach,
  deleteSport,
  saveSchedule,
  saveAnnouncement,
  deleteAnnouncement,
  saveSportSettings,
  updateAttendance,
  updateCoach,
  updatePlayerNote,
  updateSport,
} from "../src/firebase/database.js";

const KEY = "hilalClubSystemV2";
const DEFAULT_SPORT_CODE = "A7-3K-L9";
const DEFAULT_COACH_PASSWORD = "12341234";
const PLAYERS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyxleFkoKFZA0AEjcO4P7k_qrxPnfJZi5bei1oZ2rX1XxXMYsXAUFtF11sgvd1moIrG0g/exec";
const WEBAPP_UPDATE_TOKEN = "WLUPD_8f3a91c4b2d74e6aa9f03c2d7b618e5d_2026";
const DEFAULT_WEEKLY_PLAN = [
  ["الأحد", "تمارين القوة - سكوات خلفي 4 × 10"],
  ["الاثنين", "تمارين المهارة - تكنيك الرفعة 45 دقيقة"],
  ["الثلاثاء", "استشفاء وتمطيط 30 دقيقة"],
  ["الأربعاء", "اختبار الأداء - سرعة وقوة"],
  ["الخميس", "تمرين شامل حسب توجيه المدرب"],
  ["الجمعة", "راحة"],
  ["السبت", "راحة"],
];
const WEEK_DAYS = DEFAULT_WEEKLY_PLAN.map(([day]) => day);
const EMPTY_WEEKLY_PLAN = WEEK_DAYS.map((day) => [day, ""]);
const DEFAULT_SPORTS = [
  { id: "Weightlifting", nameEn: "Weightlifting", nameAr: "رفع الأثقال" },
  { id: "Weightlifting-Women", nameEn: "Weightlifting-Women", nameAr: "رفع الأثقال-السيدات" },
];
const SPORT_ICONS = {
  Weightlifting:
    '<path d="M6.5 7v10M9 5v14M15 5v14M17.5 7v10"/><path d="M2.5 10v4M21.5 10v4"/><path d="M9 12h6"/>',
  "Weightlifting-Women":
    '<path d="M6.5 7v10M9 5v14M15 5v14M17.5 7v10"/><path d="M2.5 10v4M21.5 10v4"/><path d="M9 12h6"/>',
};
const SPORT_TONES = {
  Weightlifting: "weight",
  "Weightlifting-Women": "weight",
};
const SPORT_IMAGES = {
  Weightlifting: "assets/optimized/sport-weightlifting.webp",
  "Weightlifting-Women": "assets/optimized/sport-weightlifting-women.jpg",
};

function loadSportImage(card) {
  if (!card || card.dataset.loaded === "1") return;
  const requested = card.dataset.img;
  if (!requested) return;
  const image = new Image();
  image.onload = () => {
    card.style.setProperty("--img", `url("${requested}")`);
    card.dataset.loaded = "1";
  };
  image.onerror = () => {
    card.dataset.loaded = "1";
  };
  image.src = requested;
}

function lazyLoadSportImages() {
  const cards = document.querySelectorAll("#home .sport[data-img]");
  if (!("IntersectionObserver" in window)) {
    cards.forEach(loadSportImage);
    return;
  }
  const root = document.querySelector("#home .scroll") || null;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        loadSportImage(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { root, rootMargin: "180px 0px", threshold: 0.01 },
  );
  cards.forEach((card) => observer.observe(card));
}
const PLAYER_CARD_PREFIXES = {
  weightlifting: "WT",
  "weightlifting-women": "WW",
};

const $ = (id) => document.getElementById(id);
let state = loadState();
let sportsCatalog = DEFAULT_SPORTS;
let playersDirectory = [];
let homeAnnouncements = [];
let activePlayer = null;
let activeCoachSession = null;
let activeAdminProfile = null;
window.isAdminAuthenticated = () => Boolean(activeAdminProfile);
let selectedSportSettings = null;
let coachesDirectory = [];
let weeklyExercisesState = {};
let weeklyExercisesSportId = null;
let weeklyActiveDay = "";
let weeklyEditingExerciseId = null;
let exerciseLibraryCache = [];
let exerciseLibraryLoaded = false;
let todayAttendance = [];
let playersDirectoryLoaded = false;
let todayAttendanceLoaded = false;
let allAttendanceRecordsCache = null;
let allAttendanceRecordsCacheLoading = null;
let adminData = { sports: [], players: [], coaches: [], attendance: [], allAttendance: [], announcements: [] };
let adminDashboardSportFilter = "";
let adminPlayerSearch = "";
let adminPlayerSportFilter = "";
let adminPlayerGroupFilter = "";
let adminSelectedSettingsSportId = "";
let adminSelectedSettingsGroup = "فئة الكبار";
let attendanceSearch = "";
let attendanceScanner = null;
let attendanceScannerStarting = false;
let attendanceScannerProcessing = false;
let attendanceScannerUsingVerifyModal = false;
let verifyScanner = null;
let verifyScannerStarting = false;
let secScanner = null;
let secScannerStarting = false;
let secScannerProcessing = false;
let workoutDraft = { sportId: "", sport: "", group: "" };
let gymTemplates = [];
let gymTemplateSearch = "";
let selectedCards = new Set();
let adminCardsTab = "players";

function loadState() {
  try {
    return {
      selectedSport: { en: "Weightlifting", ar: "رفع الأثقال" },
      sportCode: DEFAULT_SPORT_CODE,
      weeklyPlans: {},
      ...JSON.parse(localStorage.getItem(KEY) || "{}"),
    };
  } catch {
    return {
      selectedSport: { en: "Weightlifting", ar: "رفع الأثقال" },
      sportCode: DEFAULT_SPORT_CODE,
      weeklyPlans: {},
    };
  }
}

function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function msg(target, text, type = "ok") {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  el.textContent = text;
  el.style.color = type === "ok" ? "#148347" : type === "warn" ? "#c27a00" : "#c2413b";
}

function ensureMessage(afterEl, id) {
  if ($(id)) return $(id);
  const el = document.createElement("p");
  el.id = id;
  el.className = "bridge-message";
  el.style.cssText = "margin-top:10px;text-align:center;font-weight:800;font-size:13px;line-height:1.5;";
  afterEl?.insertAdjacentElement("afterend", el);
  return el;
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function sameSport(left, right) {
  return norm(left) === norm(right);
}

function sportId() {
  return state.selectedSport?.id || state.selectedSport?.en || "Weightlifting";
}

function sportNameAr() {
  return state.selectedSport?.ar || "رفع الأثقال";
}

function sportNameEn() {
  return state.selectedSport?.en || sportId();
}

function sportLabel(sport) {
  return sport?.nameAr || sport?.sport || sport?.nameEn || sport?.id || "";
}

function sportValue(sport) {
  return sport?.id || sport?.sportId || sport?.nameEn || sport?.nameAr || "";
}

function sportEn(sport) {
  return sport?.nameEn || sport?.id || sport?.sportId || sport?.nameAr || "";
}

function sportAr(sport) {
  return sport?.nameAr || sport?.sport || sport?.nameEn || sport?.id || "";
}

function playerBelongsToSport(player, sport) {
  const accepted = [sportValue(sport), sportEn(sport), sportAr(sport)].map(norm).filter(Boolean);
  return accepted.includes(norm(player?.sportId)) || accepted.includes(norm(player?.sport));
}

function currentSportPlayers() {
  return playersDirectory.filter((player) =>
    player.active !== false &&
    playerBelongsToSport(player, {
      id: sportId(),
      nameEn: sportNameEn(),
      nameAr: sportNameAr(),
    }),
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstText(...values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) || "";
}

function numberValue(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function playerGroup(player) {
  return firstText(player?.group, player?.category, player?.ageGroup, player?.level, player?.className);
}

function playerName(player) {
  return firstText(player?.name, player?.fullName, player?.playerName, player?.nameAr, player?.nameEn);
}

function playerPoints(player) {
  return numberValue(player?.points, player?.score, player?.totalPoints);
}

function playerKey(player) {
  return firstText(player?.playerId, player?.firebaseId, player?.id);
}

function playerQrValue(player) {
  return playerKey(player);
}

function playerPhone(player) {
  return firstText(player?.phone, player?.mobile, player?.phoneNumber, player?.whatsapp);
}

function entityInitials(name) {
  return String(name || "WL")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("") || "WL";
}

async function addPlayerViaWebApp(player) {
  const body = JSON.stringify({
    action: "addPlayer",
    name: player?.name || "",
    nationalId: player?.nationalId || "",
    phone: player?.phone || "",
    birthDate: player?.birthDate || "",
    weight: player?.weight || "",
    sport: player?.sport || "",
  });

  const response = await fetch(PLAYERS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body,
  });

  return response.json();
}

async function updatePlayerViaWebApp(playerId, payload) {
  const requestBody = {
    action: "updatePlayer",
    token: WEBAPP_UPDATE_TOKEN,
    playerId: playerId || "",
    name: payload?.name || "",
    phone: payload?.phone || "",
    birthDate: payload?.birthDate || "",
    weight: payload?.weight || "",
    sport: payload?.sport || "",
    group: payload?.group || "",
  };

  if (payload?.note) requestBody.note = payload.note;

  const response = await fetch(PLAYERS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(requestBody),
  });

  return response.json();
}

async function deletePlayerViaWebApp(playerId) {
  const response = await fetch(PLAYERS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "deletePlayer",
      token: WEBAPP_UPDATE_TOKEN,
      playerId: playerId || "",
    }),
  });

  return response.json();
}

function firebaseAuthRestMessage(code) {
  if (code === "EMAIL_EXISTS") return "هذا البريد مستخدم مسبقاً";
  if (code === "INVALID_EMAIL") return "صيغة البريد الإلكتروني غير صحيحة";
  if (code === "WEAK_PASSWORD") return "كلمة المرور يجب أن تكون 6 أحرف أو أكثر";
  if (code === "OPERATION_NOT_ALLOWED") return "إنشاء الحسابات غير مفعّل في Firebase Auth";
  return "فشل إنشاء حساب Auth";
}

async function createCoachAuthViaRest(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || DEFAULT_COACH_PASSWORD);
  if (!cleanEmail) throw new Error("البريد الإلكتروني مطلوب");
  if (cleanPassword.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف أو أكثر");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        password: cleanPassword,
        returnSecureToken: true,
      }),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = result?.error?.message || "";
    const error = new Error(firebaseAuthRestMessage(code));
    error.code = code;
    throw error;
  }
  return {
    uid: result.localId,
    email: cleanEmail,
  };
}

function isOkWebAppResult(result) {
  const status = String(result?.status || result?.result || "").toLowerCase();
  return result?.ok === true || result?.success === true || ["ok", "success", "done"].includes(status);
}

function localStatusLabel(status) {
  if (status === "late") return "متأخر";
  if (status === "excused") return "بعذر";
  if (status === "present") return "حاضر";
  return "غير مسجل";
}

function toast(text) {
  let el = $("bridgeToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "bridgeToast";
    el.style.cssText =
      "position:absolute;left:18px;right:18px;bottom:92px;z-index:120;background:#0b1b3f;color:#fff;border-radius:14px;padding:12px 14px;text-align:center;font-weight:800;font-size:13px;box-shadow:0 12px 28px rgba(11,27,63,.22);";
    document.querySelector(".screen")?.appendChild(el);
  }
  el.textContent = text;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.remove(), 2600);
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((script) => script.src.endsWith(src));
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else existing.addEventListener("load", resolve, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function categoryTimeKey(group) {
  return String(group || "").trim().replace(/\s+/g, "_");
}

function timeToMinutes(timeStr) {
  if (!timeStr) return -1;
  const [h, m] = String(timeStr).split(":").map((part) => parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

function currentTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function attendanceTimesForPlayer(player) {
  const playerSport = norm(player?.sportId || player?.sport);
  const sport = sportsCatalog.find((item) =>
    [sportValue(item), sportEn(item), sportAr(item)].map(norm).includes(playerSport),
  );
  if (!sport) return null;
  const key = categoryTimeKey(playerGroup(player));
  const categoryTimes = sport.categoryTimes?.[key];
  if (categoryTimes?.lateStart) return categoryTimes;
  const legacy = sport.attendanceTimes;
  if (legacy?.late) return { lateStart: legacy.late };
  return null;
}

function checkAttendanceWindow(player) {
  const times = attendanceTimesForPlayer(player);
  const lateStart = times?.lateStart;
  if (!lateStart) return "present";
  const now = timeToMinutes(currentTimeHHMM());
  const ls = timeToMinutes(lateStart);
  if (ls >= 0 && now >= ls) return "late";
  return "present";
}

function attendanceEntryForPlayer(player, entries = todayAttendance) {
  const id = playerKey(player);
  return (Array.isArray(entries) ? entries : []).find((entry) =>
    String(entry?.playerId || "") === String(id) || attendanceRecordBelongsToPlayer(entry, player),
  );
}

function decoratePlayerWithTodayStatus(player) {
  const entry = attendanceEntryForPlayer(player);
  const status = attendanceStatus(entry);
  return {
    ...player,
    attendanceStatus: status,
    present: status === "present",
    lateToday: status === "late",
    excusedToday: status === "excused",
    note: firstText(entry?.note, player?.note),
  };
}

async function saveAttendance(player, status, note = "") {
  const id = playerKey(player);
  if (!id) throw new Error("PlayerID غير موجود");
  const payload = {
    playerId: id,
    playerName: playerName(player),
    date: todayKey(),
    sport: sportNameAr(),
    sportId: sportId(),
    status,
    present: status === "present",
    late: status === "late",
    excused: status === "excused",
    points: playerPoints(player),
    note,
    checkInTime: new Date().toISOString(),
  };
  await updateAttendance(payload);
  const existingIndex = todayAttendance.findIndex((entry) => String(entry.playerId || "") === String(id));
  const nextEntry = { ...payload, id: `${todayKey()}_${id}` };
  if (existingIndex >= 0) todayAttendance[existingIndex] = nextEntry;
  else todayAttendance.push(nextEntry);
  /* [instant-att-sync] */ if (Array.isArray(allAttendanceRecordsCache)) {
    const __ci = allAttendanceRecordsCache.findIndex((e) => String(e.id) === String(nextEntry.id));
    if (__ci >= 0) allAttendanceRecordsCache[__ci] = nextEntry; else allAttendanceRecordsCache.push(nextEntry);
  }
  if (note) await updatePlayerNote(id, note).catch(() => {});
  return nextEntry;
}

async function clearAttendance(player) {
  const id = playerKey(player);
  if (!id) throw new Error("PlayerID غير موجود");
  await deleteAttendanceRecord(id, todayKey());
  /* [instant-att-sync] */ if (Array.isArray(allAttendanceRecordsCache)) {
    const __rid = todayKey() + "_" + id;
    const __ci = allAttendanceRecordsCache.findIndex((e) => String(e.id) === String(__rid) || (String(e.playerId) === String(id) && e.date === todayKey()));
    if (__ci >= 0) allAttendanceRecordsCache.splice(__ci, 1);
  }
  const existingIndex = todayAttendance.findIndex((entry) => String(entry.playerId || "") === String(id));
  if (existingIndex >= 0) todayAttendance.splice(existingIndex, 1);
}

function todayKey() {
  return new Date().toLocaleDateString("sv-SE");
}

function ageFromBirth(value) {
  if (!value) return "";
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 ? age : "";
}

function nationalDigits(player) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(player?.nationalId || player?.identity || "")
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/\D/g, "");
}

function playerCardPrefix(player) {
  const normalized = norm(player?.sportId || sportId());
  return PLAYER_CARD_PREFIXES[normalized] || String(player?.sportId || sportId()).replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "WL";
}

function playerCardSourceId(player) {
  return String(player?.playerId || player?.firebaseId || player?.id || player?.nationalId || "").trim();
}

function playerCardNumber(player) {
  const stored = String(player?.playerId || player?.playerNumber || player?.memberNumber || player?.cardNumber || "")
    .trim()
    .toUpperCase();
  if (/^[A-Z]{2}-?\d{1,8}$/.test(stored)) return stored.replace("-", "");
  const source = playerCardSourceId(player).toUpperCase();
  if (/^[A-Z]{2}-?\d{1,8}$/.test(source)) return source.replace("-", "");
  const nationalId = nationalDigits(player);
  if (nationalId.length >= 4) return `${playerCardPrefix(player)}${nationalId.slice(-4)}`;
  return source || "";
}

function normalizeScannedPlayerCode(value) {
  const raw = String(value || "").replace(/[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/g, "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return String(url.searchParams.get("playerId") || url.searchParams.get("player") || url.searchParams.get("id") || raw).trim();
  } catch {
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw;
    }
  }
}

function normalizedScannerValue(value) {
  return normalizeScannedPlayerCode(value).replace(/\s+/g, "").toLocaleLowerCase("en");
}

function scannerPlayerCandidates(player) {
  return [
    player?.playerId,
    player?.firebaseId,
    player?.id,
    player?.nationalId,
    player?.identity,
    player?.playerNumber,
    player?.memberNumber,
    player?.cardNumber,
    player?.qr,
    player?.qrCode,
    player?.qrValue,
    player?.barcode,
    player?.barcodeValue,
    player?.playerCode,
    player?.cardCode,
    player?.code,
    playerCardSourceId(player),
    playerCardNumber(player),
  ];
}

function findPlayerByCode(value, players = playersDirectory) {
  const target = normalizedScannerValue(value);
  if (!target) return null;
  return (Array.isArray(players) ? players : []).find((player) =>
    scannerPlayerCandidates(player).some((candidate) => normalizedScannerValue(candidate) === target),
  ) || null;
}

async function refreshPlayersDirectory(forceRefresh = false) {
  if (!forceRefresh && playersDirectoryLoaded) return playersDirectory;
  try {
    const list = await getAllPlayers({});
    playersDirectory = Array.isArray(list) ? list : [];
    playersDirectoryLoaded = true;
  } catch {
    playersDirectory = Array.isArray(playersDirectory) ? playersDirectory : [];
  }
  return playersDirectory;
}

async function refreshCoachesDirectory() {
  try {
    const list = await getCoaches({});
    coachesDirectory = Array.isArray(list) ? list : [];
  } catch {
    coachesDirectory = Array.isArray(coachesDirectory) ? coachesDirectory : [];
  }
  return coachesDirectory;
}

async function refreshTodayAttendance(forceRefresh = false) {
  if (!forceRefresh && todayAttendanceLoaded) return todayAttendance;
  try {
    const list = await getAttendance(todayKey());
    todayAttendance = Array.isArray(list) ? list : [];
    todayAttendanceLoaded = true;
  } catch {
    todayAttendance = [];
  }
  return todayAttendance;
}

async function getCachedAttendanceRecords(forceRefresh = false) {
  if (!forceRefresh && allAttendanceRecordsCache) return allAttendanceRecordsCache;
  if (!forceRefresh && allAttendanceRecordsCacheLoading) return allAttendanceRecordsCacheLoading;
  allAttendanceRecordsCacheLoading = getAttendanceRecords({})
    .catch(() => [])
    .then((records) => {
      allAttendanceRecordsCache = records;
      allAttendanceRecordsCacheLoading = null;
      return records;
    });
  return allAttendanceRecordsCacheLoading;
}

async function forceRefreshCoachData() {
  toast("جاري تحميل أحدث البيانات...");
  try {
    await Promise.all([
      refreshPlayersDirectory(true),
      refreshTodayAttendance(true),
      getCachedAttendanceRecords(true),
    ]);
    await renderCoachDashboard().catch(() => {});
    const activeAttendanceView = document.querySelector("#attendance.active, #gymAttendance.active");
    if (activeAttendanceView) await renderAttendancePage(activeAttendanceView.id, false).catch(() => {});
    toast("تم تحديث البيانات");
  } catch {
    toast("تعذر تحديث البيانات");
  }
}

function updateSportLabels() {
  document.querySelectorAll(".appbar .tag").forEach((tag) => {
    if (tag.closest("#adminDash, #adminClub, #adminSettings, #securityPage")) return;
    tag.textContent = sportNameAr();
  });
}

function closeSideMenu() {
  document.querySelector(".screen")?.classList.remove("menuopen");
}

function updateSessionUi() {
  const hasSession = Boolean(activePlayer || activeCoachSession || activeAdminProfile);
  document.querySelectorAll('[data-sb="logout"]').forEach((button) => {
    button.style.display = hasSession ? "" : "none";
  });
}

function openInfoModal(kind) {
  const modal = $("infoModal");
  const title = $("infoTitle");
  const text = $("infoText");
  if (!modal || !title || !text) return;
  if (kind === "privacy") {
    title.textContent = "الخصوصية";
    text.textContent = "تُستخدم بيانات اللاعبين والمدربين لإدارة الحضور والجداول والبطاقات داخل النادي فقط، ولا يتم تعديلها إلا عبر الصلاحيات المعتمدة.";
  } else {
    title.textContent = "عن التطبيق";
    text.textContent = "Wave Lift منصة لإدارة الرياضات والحضور والجداول التدريبية داخل النادي، مرتبطة ببيانات Firebase و Google Sheets المعتمدة.";
  }
  modal.classList.add("show");
}

async function handleLogout() {
  await closeAttendanceQr().catch(() => {});
  await closeVerifyScanner().catch(() => {});
  await logoutCoach().catch(() => {});
  activePlayer = null;
  activeCoachSession = null;
  activeAdminProfile = null;
  updateSessionUi();
  toast("تم تسجيل الخروج");
  window.go?.("home");
}

function handleLanguageToggle() {
  state.language = state.language === "en" ? "ar" : "en";
  saveState();
  document.documentElement.lang = state.language;
  document.documentElement.dir = "rtl";
  toast(state.language === "en" ? "تم اختيار الإنجليزية مع الحفاظ على اتجاه الواجهة الحالي" : "تم اختيار العربية");
}

function playerAttendedToday(player) {
  const status = attendanceStatus(attendanceEntryForPlayer(player));
  return status === "present" || status === "late";
}

function coachReportPeriodLabel() {
  const sels = [...document.querySelectorAll("#coach .mrep .selrow .sel")];
  const year = sels[0]?.textContent?.trim();
  const month = sels[1]?.textContent?.trim();
  return month && year ? `${month} ${year}` : "الشهر الحالي";
}

async function buildCoachReportText() {
  const players = currentSportPlayers();
  const stats = attendanceStats(players);
  const allRecords = await getCachedAttendanceRecords();
  const summaryByPlayerId = attendanceSummaryByPlayerId(allRecords, { id: sportId(), nameEn: sportNameEn(), nameAr: sportNameAr() });
  const attendanceCountFor = (player) => {
    const summary = summaryByPlayerId.get(String(playerKey(player))) || { present: 0, late: 0, excused: 0 };
    return summary.present + summary.late;
  };

  const groups = [...new Set(players.map(playerGroup).filter(Boolean))];
  const categoryLines = groups.map((group) => {
    const groupPlayers = players.filter((player) => sameSport(playerGroup(player), group));
    const presentInGroup = groupPlayers.filter(playerAttendedToday).length;
    const best = [...groupPlayers].sort((a, b) => attendanceCountFor(b) - attendanceCountFor(a))[0];
    const bestName = best ? playerName(best) || "لاعب" : "—";
    return `- ${group}: ${presentInGroup} حاضر من ${groupPlayers.length} - الأفضل: ${bestName}`;
  });

  const topAttendees = [...players]
    .map((player) => ({ player, count: attendanceCountFor(player) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${playerName(item.player) || "لاعب"} - ${playerGroup(item.player) || "فئة غير محددة"} - ${item.count} حضور`);

  const presentNames = players.filter(playerAttendedToday).map((player) => `- ${playerName(player) || "لاعب"}`);
  const absentNames = players
    .filter((player) => !playerAttendedToday(player))
    .map((player) => `- ${playerName(player) || "لاعب"} (${playerGroup(player) || "فئة غير محددة"})`);

  return [
    `📅 *تقرير الحضور - ${coachReportPeriodLabel()}*`,
    `المدرب: ${activeCoachSession?.name || activeCoachSession?.email || "غير محدد"}`,
    "",
    `👥 إجمالي اللاعبين: ${stats.total}`,
    `✅ الحضور: ${stats.present}`,
    `⏰ التأخير: ${stats.late}`,
    `📋 بعذر: ${stats.excused}`,
    `❌ الغياب: ${stats.notRegistered}`,
    `📊 نسبة الحضور: ${stats.rate}`,
    "",
    "*ملخص الفئات:*",
    ...(categoryLines.length ? categoryLines : ["لا توجد فئات مسجلة"]),
    "",
    "*أفضل الحضور:*",
    ...(topAttendees.length ? topAttendees : ["لا توجد بيانات حضور"]),
    "",
    "*الحاضرون اليوم:*",
    ...(presentNames.length ? presentNames : ["لا يوجد حضور مسجل"]),
    "",
    "*لم يحضروا اليوم:*",
    ...(absentNames.length ? absentNames : ["جميع اللاعبين حاضرون"]),
  ].join("\n");
}

async function shareCoachReportWhatsApp() {
  const text = await buildCoachReportText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

async function handleForgotPassword() {
  const email = $("email")?.value.trim().toLowerCase();
  if (!email) {
    toast("اكتب بريد المدرب أولاً");
    return;
  }
  await resetPassword(email);
  toast("تم إرسال رابط إعادة تعيين كلمة المرور");
}

async function openCoachSection(target) {
  if (!activeCoachSession) {
    toast("سجّل دخول المدرب أولاً");
    return;
  }
  if (target === "coach") {
    await renderCoachDashboard().catch(() => {});
    window.go?.("coach");
    return;
  }
  if (target === "attendance") {
    const viewId = sameSport(activeCoachSession.sportId || activeCoachSession.sport, "gym") ? "gymAttendance" : "attendance";
    await renderAttendancePage(viewId).catch(() => {});
    window.go?.(viewId);
    return;
  }
  if (target === "training") {
    const viewId = sameSport(activeCoachSession.sportId || activeCoachSession.sport, "gym") ? "gymTraining" : "weekly";
    if (viewId === "gymTraining") await renderDailyWorkoutManager().catch(() => {});
    else await renderWeeklyPage().catch(() => {});
    window.go?.(viewId);
  }
}

function handleSidebarAction(button) {
  const key = button?.dataset?.sb || "";
  if (!key || button.disabled) return false;
  closeSideMenu();
  if (key === "admin") {
    setTimeout(() => $("adminModal")?.classList.add("show"), 120);
  } else if (key === "verify") {
    setTimeout(() => {
      window.go?.("securityPage");
      renderSecurityPage().catch(() => toast("تعذر تحميل صفحة التحقق"));
    }, 120);
  } else if (key === "support") {
    setTimeout(() => $("supportModal")?.classList.add("show"), 120);
  } else if (key === "about" || key === "privacy") {
    setTimeout(() => openInfoModal(key), 120);
  } else if (key === "language") {
    handleLanguageToggle();
  } else if (key === "logout") {
    handleLogout().catch((error) => toast(error?.message || "تعذر تسجيل الخروج"));
  } else if (key === "coachDash") {
    setTimeout(() => openCoachSection("coach"), 120);
  } else if (key === "attendance") {
    setTimeout(() => openCoachSection("attendance"), 120);
  } else if (key === "training") {
    setTimeout(() => openCoachSection("training"), 120);
  } else {
    return false;
  }
  return true;
}

function sportIconSvg(en) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SPORT_ICONS[en] || SPORT_ICONS.Weightlifting}</svg>`;
}

function ensureHomeAnnouncementNode() {
  const homeScroll = document.querySelector("#home .scroll");
  if (!homeScroll) return null;
  let node = $("homeAnnouncement");
  if (node) return node;
  node = document.createElement("section");
  node.id = "homeAnnouncement";
  node.className = "home-announcement";
  node.setAttribute("aria-live", "polite");

  const icon = document.createElement("span");
  icon.className = "ha-ico";
  icon.textContent = "!";
  const text = document.createElement("div");
  text.className = "ha-text";
  const title = document.createElement("b");
  const body = document.createElement("small");
  const date = document.createElement("small");
  date.className = "ha-date";
  text.append(title, body, date);
  node.append(icon, text);

  const grid = homeScroll.querySelector(".grid");
  homeScroll.insertBefore(node, grid || null);
  return node;
}

function renderHomeAnnouncement() {
  const announcement = homeAnnouncements.find((item) => item?.active !== false && firstText(item?.body, item?.title));
  const node = ensureHomeAnnouncementNode();
  if (!node) return;
  if (!announcement) {
    node.style.display = "none";
    return;
  }
  setText(node.querySelector(".ha-text b"), firstText(announcement.title, "تنبيه عام"));
  setText(node.querySelector(".ha-text small"), firstText(announcement.body, ""));
  setText(node.querySelector(".ha-date"), formatAnnouncementDate(announcement.updatedAt || announcement.createdAt));
  node.style.display = "";
}

function formatAnnouncementDate(value) {
  let ms = null;
  if (value && typeof value.seconds === "number") ms = value.seconds * 1000;
  else if (typeof value === "string" && Date.parse(value)) ms = Date.parse(value);
  if (!ms) return "";
  const formatter = new Intl.DateTimeFormat("ar-u-ca-gregory", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(new Date(ms));
}

async function loadHomeAnnouncements() {
  try {
    const list = await getAnnouncements();
    homeAnnouncements = Array.isArray(list) ? list : [];
  } catch (error) {
    homeAnnouncements = [];
    console.warn("[WaveLiftBridge] announcements unavailable", error);
  } finally {
    renderHomeAnnouncement();
  }
}

function renderSports() {
  const grid = document.querySelector("#home .grid");
  if (!grid) return;
  grid.innerHTML = sportsCatalog
    .map((sport) => {
      const en = sportEn(sport);
      const ar = sportAr(sport);
      const id = sportValue(sport) || en;
      const count = playersDirectory.filter((player) => player.active !== false && playerBelongsToSport(player, sport)).length;
      const tone = SPORT_TONES[en] || "weight";
      const gymAttr = sameSport(id, "gym") || sameSport(en, "gym") ? " data-gym" : "";
      const pulse = sameSport(en, "Swimming") ? '<div class="pulse"></div>' : "";
      const img = SPORT_IMAGES[en];
      const imgAttr = img ? ` data-img="${escapeHtml(img)}"` : "";
      return `<div class="sport" data-sport-id="${escapeHtml(id)}" data-en="${escapeHtml(en)}" data-ar="${escapeHtml(ar)}"${gymAttr}${imgAttr}>
        <div class="media t-${tone}">${pulse}<div class="deco"></div>${sportIconSvg(en)}</div>
        <div class="body"><div class="en">${escapeHtml(en)}</div><div class="ar">${escapeHtml(ar)}</div><span class="count"><span class="dot"></span>${count} لاعب</span></div>
      </div>`;
    })
    .join("");
  lazyLoadSportImages();
}

const HOME_DATA_CACHE_KEY = "waveLiftHomeDataCache";
const HOME_DATA_CACHE_MS =   120 * 1000;

async function loadHomeData() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(HOME_DATA_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.ts < HOME_DATA_CACHE_MS) {
      if (Array.isArray(cached.sports) && cached.sports.length) {
        sportsCatalog = cached.sports.filter((sport) => sport.active !== false);
      }
      playersDirectory = Array.isArray(cached.players) ? cached.players : [];
      return;
    }
  } catch {}
  let sportsFetchOk = true;
  let playersFetchOk = true;
  const [remoteSports, remotePlayers] = await Promise.all([
    getSports({}).catch(() => {
      sportsFetchOk = false;
      return [];
    }),
    getAllPlayers({}).catch(() => {
      playersFetchOk = false;
      return [];
    }),
  ]);
  try {
    if (Array.isArray(remoteSports) && remoteSports.length) {
      sportsCatalog = remoteSports.filter((sport) => sport.active !== false);
    }
    playersDirectory = Array.isArray(remotePlayers) ? remotePlayers : [];
    if (sportsFetchOk && playersFetchOk && remoteSports.length) {
      try {
        sessionStorage.setItem(HOME_DATA_CACHE_KEY, JSON.stringify({ ts: Date.now(), sports: remoteSports, players: remotePlayers }));
      } catch {}
    }
  } finally {
    renderSports();
  }
}

async function selectSport(card) {
  const id = card.dataset.sportId || card.dataset.en;
  const en = card.dataset.en || id;
  const ar = card.dataset.ar || en;
  state.selectedSport = { id, en, ar };
  activeCoachSession = null;
  activePlayer = null;
  selectedSportSettings = null;
  saveState();
  updateSportLabels();
  try {
    selectedSportSettings = await getSportSettings(id);
    if (selectedSportSettings?.sportCode) {
      state.sportCode = String(selectedSportSettings.sportCode).toUpperCase();
      saveState();
    }
  } catch {}
  if (typeof window.openSheet === "function") window.openSheet(card);
}

async function weeklyPlan() {
  try {
    const schedule = await getSchedule(sportId());
    const plan = Array.isArray(schedule?.weeklyPlan)
      ? schedule.weeklyPlan
      : Array.isArray(schedule?.plan)
        ? schedule.plan
        : null;
    if (plan?.length) {
      return plan.map((entry) => [entry.day || "", entry.workout || entry.title || entry.details || "راحة"]);
    }
  } catch {}
  const stored = state.weeklyPlans?.[sportId()] || state.weeklyPlan;
  if (Array.isArray(stored) && stored.length) {
    return stored.map((entry) => [entry.day || "", entry.workout || ""]);
  }
  return EMPTY_WEEKLY_PLAN;
}

async function renderPlayerDashboard(player) {
  const view = $("player");
  if (!view) return;
  view.querySelector(".appbar .tag").textContent = sportNameAr();
  view.querySelector(".page-head h2").textContent = playerName(player) || "لوحة اللاعب";
  const summary = player ? await playerAttendanceSummary(player).catch(() => ({ present: 0, late: 0, excused: 0 })) : null;
  const points = numberValue(player?.points, player?.score, player?.totalPoints);
  view.querySelector(".page-head p").textContent = player
    ? `${sportNameAr()} · ${playerGroup(player) || "فئة غير محددة"} · حضور ${summary.present} · تأخير ${summary.late} · بعذر ${summary.excused} · نقاط ${points}`
    : "جدول التمارين الأسبوعية";
  await renderPlayerTraining(player).catch(() => {});
}

function attendanceStatus(entry) {
  return entry?.status || entry?.attendanceStatus || (entry?.late ? "late" : entry?.excused ? "excused" : entry?.present ? "present" : "");
}

function attendanceRecordBelongsToPlayer(entry, player) {
  if (!entry || !player) return false;
  const candidates = scannerPlayerCandidates(player).map(normalizedScannerValue).filter(Boolean);
  const entryValues = [
    entry.playerId,
    entry.firebaseId,
    entry.playerFirebaseId,
    entry.playerDocId,
    entry.id,
    entry.nationalId,
    entry.identity,
    entry.playerNumber,
    entry.memberNumber,
    entry.cardNumber,
    entry.qr,
    entry.qrCode,
    entry.barcode,
    entry.playerCode,
    entry.cardCode,
    entry.code,
  ].map(normalizedScannerValue).filter(Boolean);
  return entryValues.some((value) => candidates.includes(value));
}

function summarizeAttendance(records) {
  return records.reduce(
    (summary, entry) => {
      const status = norm(attendanceStatus(entry));
      if (status === "late") summary.late += 1;
      else if (status === "excused" || status === "excuse" || status === "with_excuse") summary.excused += 1;
      else if (status === "present" || status === "attended" || entry?.present === true) summary.present += 1;
      return summary;
    },
    { present: 0, late: 0, excused: 0 },
  );
}

function attendanceSummaryByPlayerId(records, sportCtx) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((entry) => {
    if (sportCtx && !playerBelongsToSport(entry, sportCtx)) return;
    const id = String(entry?.playerId || "");
    if (!id) return;
    const summary = map.get(id) || { present: 0, late: 0, excused: 0 };
    const status = norm(attendanceStatus(entry));
    if (status === "late") summary.late += 1;
    else if (status === "excused" || status === "excuse" || status === "with_excuse") summary.excused += 1;
    else if (status === "present" || status === "attended" || entry?.present === true) summary.present += 1;
    map.set(id, summary);
  });
  return map;
}

async function playerAttendanceSummary(player) {
  const fromFields = {
    present: numberValue(player?.attendance, player?.attendanceCount, player?.present, player?.presentCount),
    late: numberValue(player?.late, player?.lateCount, player?.delays, player?.delayCount),
    excused: numberValue(player?.excused, player?.excusedCount, player?.excuses, player?.excuseCount),
  };
  try {
    const records = await getAttendanceRecords({});
    const playerRecords = (Array.isArray(records) ? records : []).filter((entry) =>
      playerBelongsToSport(entry, { id: sportId(), nameEn: sportNameEn(), nameAr: sportNameAr() }) &&
      attendanceRecordBelongsToPlayer(entry, player),
    );
    if (playerRecords.length) return summarizeAttendance(playerRecords);
  } catch {}
  return fromFields;
}

function workoutTitle(workout) {
  return firstText(workout?.title, workout?.name, workout?.workout, workout?.exercise, workout?.day, "تمرين");
}

function workoutDetails(workout) {
  return firstText(workout?.details, workout?.description, workout?.notes, workout?.note, workout?.sets);
}

function todayArabicName() {
  return ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date().getDay()];
}

function workoutIsForToday(workout) {
  const date = firstText(workout?.date, workout?.workoutDate);
  if (date) return date === todayKey();
  const day = firstText(workout?.day, workout?.dayName);
  if (!day) return true;
  return norm(day) === norm(todayArabicName()) || norm(day) === norm(new Date().toLocaleDateString("en-US", { weekday: "long" }));
}

async function dailyWorkoutsFor(group = "") {
  try {
    const workouts = await getDailyWorkouts({ sportId: sportId(), active: true });
    return (Array.isArray(workouts) ? workouts : []).filter((workout) => {
      if (workout.active === false) return false;
      const workoutGroup = playerGroup(workout);
      if (group && workoutGroup && !sameSport(normalizeGroupName(workoutGroup), normalizeGroupName(group))) return false;
      return workoutIsForToday(workout);
    });
  } catch {
    return [];
  }
}

function planRows(plan) {
  return plan
    .map(([day, workout]) => `<div class="pday${/راحة/.test(workout) ? " empty" : ""}><b>${escapeHtml(day)}</b><span>${escapeHtml(workout || "راحة")}</span></div>`)
    .join("");
}

const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
let coachReportDate = new Date();

function monthBounds(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    dateFrom: new Date(year, month, 1).toLocaleDateString("sv-SE"),
    dateTo: new Date(year, month + 1, 0).toLocaleDateString("sv-SE"),
  };
}

function openCoachReportMonthMenu(anchor) {
  const options = ARABIC_MONTHS.map((name, index) => ({
    label: name,
    value: String(index),
    active: index === coachReportDate.getMonth(),
  }));
  openBridgeSelectMenu(anchor, options, (value) => {
    coachReportDate = new Date(coachReportDate.getFullYear(), Number(value), 1);
    renderCoachMonthlyReport().catch(() => {});
  });
}

function openCoachReportYearMenu(anchor) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];
  const options = years.map((year) => ({
    label: String(year),
    value: String(year),
    active: year === coachReportDate.getFullYear(),
  }));
  openBridgeSelectMenu(anchor, options, (value) => {
    coachReportDate = new Date(Number(value), coachReportDate.getMonth(), 1);
    renderCoachMonthlyReport().catch(() => {});
  });
}

async function renderCoachMonthlyReport() {
  const view = $("coach");
  if (!view) return;
  const monthCard = view.querySelectorAll(".scard")[1];
  if (!monthCard) return;
  const yearSel = monthCard.querySelector("[data-mrep-year]");
  const monthSel = monthCard.querySelector("[data-mrep-month]");
  if (yearSel?.childNodes[0]) yearSel.childNodes[0].textContent = String(coachReportDate.getFullYear());
  if (monthSel?.childNodes[0]) monthSel.childNodes[0].textContent = ARABIC_MONTHS[coachReportDate.getMonth()];
  prepareInteractiveSelect(yearSel, "اختيار سنة التقرير");
  prepareInteractiveSelect(monthSel, "اختيار شهر التقرير");

  const players = currentSportPlayers();
  const { dateFrom, dateTo } = monthBounds(coachReportDate);
  const records = await getAttendanceRecords({ dateFrom, dateTo, sportId: sportId() }).catch(() => []);

  let present = 0;
  let late = 0;
  let excused = 0;
  const attendedIds = new Set();
  records.forEach((entry) => {
    const status = attendanceStatus(entry);
    if (status === "present") present += 1;
    else if (status === "late") late += 1;
    else if (status === "excused") excused += 1;
    if (status === "present" || status === "late") attendedIds.add(String(entry?.playerId || ""));
  });
  const total = players.length;
  const notAttended = players.filter((player) => !attendedIds.has(String(playerKey(player)))).length;
  const rate = total ? `${Math.round(((total - notAttended) / total) * 100)}%` : "0%";

  const valuesByLabel = {
    "إجمالي اللاعبين": total,
    "الحضور": present,
    "التأخير": late,
    "بعذر": excused,
    "الغياب": notAttended,
    "نسبة الحضور": rate,
  };
  monthCard.querySelectorAll(".tile").forEach((tile) => {
    const label = tile.querySelector(".tl")?.textContent?.trim();
    const value = tile.querySelector(".tv");
    if (value && Object.prototype.hasOwnProperty.call(valuesByLabel, label)) value.textContent = valuesByLabel[label];
  });
}

async function renderCoachDashboard() {
  const view = $("coach");
  if (!view) return;
  await Promise.all([refreshPlayersDirectory(), refreshTodayAttendance()]).catch(() => {});
  const players = currentSportPlayers();
  const stats = attendanceStats(players);
  view.querySelector(".appbar .tag").textContent = sportNameAr();
  view.querySelector(".page-head h2").textContent = "لوحة المدرب";
  view.querySelector(".page-head p").textContent = activeCoachSession?.name
    ? `مرحباً ${activeCoachSession.name}`
    : "ملخص سريع وتحكم أساسي للمدرب";
  const todayCard = view.querySelectorAll(".scard")[0];
  if (todayCard) {
    const date = todayCard.querySelector(".scard-head small");
    if (date) date.textContent = todayKey();
    const valuesByLabel = {
      "إجمالي اللاعبين": players.length,
      "الحاضرون اليوم": stats.attended,
      "نسبة الحضور": stats.rate,
    };
    todayCard.querySelectorAll(".tile").forEach((tile) => {
      const label = tile.querySelector(".tl")?.textContent?.trim();
      const value = tile.querySelector(".tv");
      if (value && Object.prototype.hasOwnProperty.call(valuesByLabel, label)) value.textContent = valuesByLabel[label];
    });
  }
  await renderCoachMonthlyReport().catch(() => {});
  const allRecords = await getCachedAttendanceRecords();
  const summaryByPlayerId = attendanceSummaryByPlayerId(allRecords, { id: sportId(), nameEn: sportNameEn(), nameAr: sportNameAr() });
  const ranked = [...players]
    .map((player) => {
      const summary = summaryByPlayerId.get(String(playerKey(player))) || { present: 0, late: 0, excused: 0 };
      return { player, count: summary.present + summary.late };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const rankRows = ensureRepeatedRows(view.querySelectorAll(".scard")[2], ".rank", ranked.length || 1);
  const max = Math.max(...ranked.map((item) => item.count), 1);
  rankRows.forEach((row, index) => {
    const item = ranked[index];
    if (!item) {
      row.querySelector(".rn").textContent = "";
      row.querySelector(".ri b").textContent = "لا توجد بيانات حالياً";
      row.querySelector(".ri small").textContent = "";
      row.querySelector(".bar small").textContent = "";
      row.querySelector(".pct").textContent = "";
      const fill = row.querySelector(".fill");
      if (fill) fill.style.width = "0%";
      return;
    }
    const percent = Math.round((item.count / max) * 100);
    row.querySelector(".rn").textContent = String(index + 1);
    row.querySelector(".ri b").textContent = playerName(item.player) || "لاعب";
    row.querySelector(".ri small").textContent = playerGroup(item.player) || "فئة غير محددة";
    row.querySelector(".bar small").textContent = `حضور ${item.count} يوم`;
    row.querySelector(".pct").textContent = `${percent}%`;
    const fill = row.querySelector(".fill");
    if (fill) fill.style.width = `${percent}%`;
  });
  const groups = [...new Set(players.map(playerGroup).filter(Boolean))];
  const catRows = ensureRepeatedRows(view.querySelector(".cats"), ".cat", groups.length || 1);
  catRows.forEach((row, index) => {
    const group = groups[index];
    if (!group) {
      const title = row.querySelector(".ch");
      setChLabel(title, "لا توجد بيانات حالياً");
      row.querySelectorAll(".val").forEach((value) => { value.textContent = "0"; });
      return;
    }
    const groupPlayers = players.filter((player) => sameSport(playerGroup(player), group));
    const title = row.querySelector(".ch");
    setChLabel(title, group);
    const values = row.querySelectorAll(".val");
    if (values[0]) values[0].textContent = String(groupPlayers.length);
    if (values[1]) values[1].textContent = String(groupPlayers.filter((player) => {
      const status = attendanceStatus(attendanceEntryForPlayer(player));
      return status === "present" || status === "late";
    }).length);
  });
}

function weekChipsHtml() {
  const names = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const today = new Date();
  const current = (today.getDay() + 1) % 7;
  return names
    .map((name, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + (index - current));
      return `<div class="daychip${index === current ? " on" : ""}"><div class="dn">${name}</div><div class="dd">${date.getDate()}</div></div>`;
    })
    .join("");
}

function attendanceStats(players) {
  const records = (Array.isArray(players) ? players : []).map((player) => attendanceStatus(attendanceEntryForPlayer(player)));
  const present = records.filter((status) => status === "present").length;
  const late = records.filter((status) => status === "late").length;
  const excused = records.filter((status) => status === "excused").length;
  return {
    present,
    late,
    excused,
    attended: present + late,
    total: players.length,
    notRegistered: Math.max(players.length - present - late - excused, 0),
    rate: players.length ? `${Math.round(((present + late) / players.length) * 100)}%` : "0%",
  };
}

function updateAttendanceSummary(view, stats) {
  const tiles = [...view.querySelectorAll(".att3 .tile, .tiles .tile")];
  const valuesByLabel = {
    "حاضر": stats.attended,
    "الحاضرون": stats.attended,
    "متأخر": stats.late,
    "المتأخرون": stats.late,
    "بعذر": stats.excused,
    "النسبة": stats.rate,
    "عدد اللاعبين": stats.total,
    "إجمالي اللاعبين": stats.total,
    "غائب": stats.notRegistered,
  };
  tiles.forEach((tile) => {
    const label = tile.querySelector(".tl")?.textContent?.trim();
    const value = tile.querySelector(".tv");
    if (value && Object.prototype.hasOwnProperty.call(valuesByLabel, label)) {
      value.textContent = valuesByLabel[label];
    }
  });
}

function updateAttendanceSearch(view) {
  const input = view.querySelector(".search input");
  if (!input) return;
  input.dataset.bridgeAttendanceSearch = "1";
  if (document.activeElement !== input) input.value = attendanceSearch;
}

function updateAttendanceCategoryBar(view, players, count, activeGroup = "") {
  const bar = view.querySelector(".catbar");
  if (!bar) return;
  const groups = [...new Set(players.map(playerGroup).filter(Boolean))];
  const label = bar.querySelector(".cn");
  const total = bar.querySelector(".cc");
  if (label) label.textContent = activeGroup || sportNameAr();
  if (total) total.textContent = `${count} لاعب`;
  bar.dataset.bridgeGroups = groups.join("|");
  bar.dataset.bridgeActiveGroup = activeGroup;
  if (!groups.length) return;
  bar.style.cursor = "pointer";
  bar.title = "اضغط لتغيير الفئة";
}

function fillAttendanceCard(card, player, summaryByPlayerId) {
  const decorated = decoratePlayerWithTodayStatus(player);
  const id = playerKey(decorated);
  const status = decorated.attendanceStatus;
  const age = ageFromBirth(decorated.birthDate);
  card.dataset.playerId = id;
  const name = card.querySelector(".pn");
  if (name) {
    name.textContent = "";
    name.dataset.cardPlayerName = "1";
    const icon = document.createElement("span");
    icon.className = "pn-card-ico";
    icon.textContent = "🪪";
    name.appendChild(icon);
    name.appendChild(document.createTextNode(playerName(decorated) || "لاعب"));
    if (age) {
      const span = document.createElement("span");
      span.textContent = `(${age} سنة)`;
      name.appendChild(document.createTextNode(" "));
      name.appendChild(span);
    }
  }
  const note = card.querySelector(".notef");
  if (note) {
    note.value = firstText(attendanceEntryForPlayer(decorated)?.note, decorated.note);
    note.dataset.attNote = "1";
  }
  const stats = card.querySelector(".pstats");
  if (stats) {
    const summary = summaryByPlayerId?.get(String(id)) || { present: 0, late: 0, excused: 0 };
    const attendance = summary.present;
    const late = summary.late;
    const excused = summary.excused;
    const labels = ["الحضور", "التأخير", "الأعذار"];
    const values = [attendance, late, excused];
    stats.textContent = "";
    labels.forEach((label, index) => {
      if (index) {
        const sep = document.createElement("i");
        sep.textContent = "|";
        stats.appendChild(sep);
        stats.appendChild(document.createTextNode(" "));
      }
      stats.appendChild(document.createTextNode(`${label}: `));
      const b = document.createElement("b");
      b.textContent = values[index];
      stats.appendChild(b);
      stats.appendChild(document.createTextNode(" "));
    });
  }
  card.querySelectorAll(".prow button").forEach((button) => {
    const text = button.textContent.trim();
    if (button.classList.contains("att-call")) {
      button.dataset.contactPhone = playerPhone(decorated);
      return;
    }
    if (text.includes("بعذر")) button.dataset.attendanceStatus = "excused";
    else if (text.includes("متأخر")) button.dataset.attendanceStatus = "late";
    else if (text.includes("حاضر")) button.dataset.attendanceStatus = "present";
    button.classList.toggle("is-active", button.dataset.attendanceStatus === status);
  });
}

function renderAttendanceCardsFromTemplate(view, players, summaryByPlayerId) {
  const body = view.querySelector(".page-body");
  const existingCards = [...view.querySelectorAll(".pcard")];
  const template = existingCards[0];
  if (!body || !template) return;
  const keepCount = Math.max(players.length, 1);
  existingCards.slice(keepCount).forEach((card) => card.remove());
  for (let index = existingCards.length; index < players.length; index += 1) {
    const clone = template.cloneNode(true);
    body.appendChild(clone);
    existingCards.push(clone);
  }
  existingCards.slice(0, players.length).forEach((card, index) => {
    card.style.display = "";
    fillAttendanceCard(card, players[index], summaryByPlayerId);
  });
  if (!players.length) {
    existingCards.slice(0, keepCount).forEach((card) => {
      card.style.display = "none";
    });
  }
}

function groupFilterHtml(players) {
  const groups = [...new Set(players.map(playerGroup).filter(Boolean))];
  if (!groups.length) return "";
  const chips = groups.map((group) => `<button class="pick" data-att-group="${escapeHtml(group)}">${escapeHtml(group.replace(/^فئة\s*/, ""))}</button>`).join("");
  return `<div class="pick-grid" style="margin-bottom:12px"><button class="pick on" data-att-group="">الكل</button>${chips}</div>`;
}

async function renderAttendancePage(targetId = "attendance", refresh = true) {
  const view = $(targetId);
  if (!view) return;
  view.dataset.bridgeAttendanceReady = "1";
  const tag = view.querySelector(".appbar .tag");
  const title = view.querySelector(".page-head h2");
  if (tag) tag.textContent = sportNameAr();
  if (title) title.textContent = targetId === "gymAttendance" ? "حضور الصالة" : "الحضور والغياب";
  const daysRow = view.querySelector(".daysrow");
  if (daysRow) daysRow.innerHTML = weekChipsHtml();
  if (refresh) await Promise.all([refreshPlayersDirectory(), refreshTodayAttendance()]);
  const players = currentSportPlayers();
  const groupFilter = view.dataset.bridgeGroup || "";
  const filtered = attendanceSearch
    ? players.filter((player) =>
        [playerName(player), player?.nationalId, player?.identity, playerCardNumber(player), playerKey(player)].some((value) =>
          norm(value).includes(norm(attendanceSearch)),
        ),
      )
    : players;
  const visiblePlayers = (groupFilter ? filtered.filter((player) => sameSport(playerGroup(player), groupFilter)) : filtered)
    .slice()
    .sort((a, b) => (Number(ageFromBirth(b?.birthDate)) || 0) - (Number(ageFromBirth(a?.birthDate)) || 0));
  const stats = attendanceStats(players);
  updateAttendanceSummary(view, stats);
  updateAttendanceSearch(view);
  updateAttendanceCategoryBar(view, players, visiblePlayers.length, groupFilter);
  const allRecords = await getCachedAttendanceRecords();
  const summaryByPlayerId = attendanceSummaryByPlayerId(allRecords, { id: sportId(), nameEn: sportNameEn(), nameAr: sportNameAr() });
  renderAttendanceCardsFromTemplate(view, visiblePlayers, summaryByPlayerId);
}

function activeAttendanceViewId() {
  if ($("gymAttendance")?.classList.contains("active")) return "gymAttendance";
  return "attendance";
}

function attendanceStatusFromButton(button) {
  if (!button) return "";
  if (button.dataset.attendanceStatus) return button.dataset.attendanceStatus;
  const text = button.textContent.trim();
  if (text.includes("بعذر")) return "excused";
  if (text.includes("متأخر")) return "late";
  if (text.includes("حاضر")) return "present";
  return "";
}

async function markAttendanceFromButton(button) {
  const card = button.closest("[data-player-id]");
  const id = card?.dataset.playerId;
  const status = attendanceStatusFromButton(button);
  const player = playersDirectory.find((item) => String(playerKey(item)) === String(id));
  if (!player || !status) return;
  const note = card.querySelector("[data-att-note]")?.value || "";
  const currentStatus = attendanceStatus(attendanceEntryForPlayer(player));
  button.disabled = true;
  try {
    if (currentStatus === status) {
      await clearAttendance(player);
      toast(`تم إلغاء تسجيل ${playerName(player)}`);
    } else {
      await saveAttendance(player, status, note);
      toast(`تم تسجيل ${localStatusLabel(status)}: ${playerName(player)}`);
    }
    await renderAttendancePage(activeAttendanceViewId());
    await renderCoachDashboard().catch(() => {});
  } catch (error) {
    toast(error?.message || "تعذر حفظ الحضور");
  } finally {
    button.disabled = false;
  }
}

async function saveAttendanceNoteFromField(field) {
  const card = field.closest("[data-player-id]");
  const id = card?.dataset.playerId;
  const player = playersDirectory.find((item) => String(playerKey(item)) === String(id));
  if (!player) return;
  const note = field.value || "";
  try {
    await updatePlayerNote(id, note);
    const entry = attendanceEntryForPlayer(player);
    const status = attendanceStatus(entry);
    if (status) await saveAttendance(player, status, note);
    toast("تم حفظ الملاحظة");
  } catch (error) {
    toast(error?.message || "تعذر حفظ الملاحظة");
  }
}

function normalizeWhatsappPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `966${digits.slice(1)}`;
  else if (!digits.startsWith("966")) digits = `966${digits}`;
  return digits;
}

let contactOptionsAnchor = null;
let contactOptionsDismissHandler = null;

function closeContactOptionsMenu() {
  document.querySelector("[data-contact-options-menu]")?.remove();
  contactOptionsAnchor = null;
  if (contactOptionsDismissHandler) {
    document.removeEventListener("click", contactOptionsDismissHandler);
    contactOptionsDismissHandler = null;
  }
}

function openContactOptionsMenu(anchor, phone) {
  const wasOpenForThisAnchor = contactOptionsAnchor === anchor;
  closeContactOptionsMenu();
  closeBridgeSelectMenu();
  if (wasOpenForThisAnchor || !anchor) return;
  contactOptionsAnchor = anchor;
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return toast("لا يوجد رقم جوال لهذا اللاعب");
  const menu = document.createElement("div");
  menu.className = "contact-options-menu";
  menu.dataset.contactOptionsMenu = "1";
  menu.innerHTML = `
    <button type="button" class="contact-option contact-call"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l1 4v2a2 2 0 0 1-2 2A16 16 0 0 1 3 7a2 2 0 0 1 2-3Z"/></svg>اتصال هاتفي</button>
    <button type="button" class="contact-option contact-whatsapp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2s-1.1.2-3.6-.9-3.9-3.5-4-3.7-1-1.3-1-2.5.6-1.8.9-2 .5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.7s.7 1.2 1.5 1.9c1 .9 1.8 1.1 2.1 1.3s.4 0 .6-.1l.8-1c.2-.3.4-.2.7-.1l2 .9c.2.1.4.2.4.3s0 .8-.2 1.2Z"/></svg>واتساب</button>
  `;
  document.body.appendChild(menu);
  menu.querySelector(".contact-call").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeContactOptionsMenu();
    window.open(`tel:${clean}`, "_blank");
  });
  menu.querySelector(".contact-whatsapp").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeContactOptionsMenu();
    window.open(`https://wa.me/${normalizeWhatsappPhone(clean)}`, "_blank");
  });
  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuRect.width - 8));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(rect.top - menuRect.height - 8)}px`;
  setTimeout(() => {
    contactOptionsDismissHandler = () => closeContactOptionsMenu();
    document.addEventListener("click", contactOptionsDismissHandler, { once: true });
  }, 0);
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function setChLabel(title, value) {
  if (!title) return;
  let node = [...title.childNodes].find((child) => child.nodeType === Node.TEXT_NODE);
  if (!node) {
    node = document.createTextNode("");
    title.appendChild(node);
  }
  node.textContent = value;
}

function prepareInteractiveSelect(node, label) {
  if (!node) return;
  node.classList.add("is-interactive");
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "0");
  node.setAttribute("aria-haspopup", "listbox");
  node.setAttribute("aria-label", label || node.textContent.trim() || "اختيار");
}

function setSelectLabel(node, label) {
  if (!node) return;
  const text = [...node.childNodes].find((child) => child.nodeType === Node.TEXT_NODE);
  if (text) text.textContent = label;
  else node.prepend(document.createTextNode(label));
}

function closeBridgeSelectMenu() {
  document.querySelector("[data-bridge-select-menu]")?.remove();
}

function openBridgeSelectMenu(anchor, options, onSelect) {
  closeBridgeSelectMenu();
  if (!anchor || !options?.length) return;
  const menu = document.createElement("div");
  menu.className = "bridge-select-menu";
  menu.dataset.bridgeSelectMenu = "1";
  menu.setAttribute("role", "listbox");
  options.forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "bridge-select-option";
    item.textContent = option.label;
    item.dataset.value = option.value || "";
    item.setAttribute("role", "option");
    if (option.active) item.classList.add("active");
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeBridgeSelectMenu();
      onSelect(option.value || "");
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  const menuWidth = Math.max(rect.width, 180);
  menu.style.width = `${menuWidth}px`;
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  menu.style.left = `${Math.round(Math.min(rect.left, window.innerWidth - menuWidth - 12))}px`;
  setTimeout(() => {
    document.addEventListener("click", closeBridgeSelectMenu, { once: true });
  }, 0);
}

function adminSportFilterOptions(currentValue = "") {
  return [
    { label: "كل الرياضات", value: "", active: !currentValue },
    ...adminData.sports.map((sport) => ({
      label: sportAr(sport) || sportEn(sport) || sportValue(sport),
      value: sportValue(sport),
      active: sameSport(sportValue(sport), currentValue),
    })),
  ];
}

const ADMIN_PLAYER_GROUPS = ["فئة الكبار", "فئة الشباب", "فئة الناشئين", "فئة البراعم"];

function adminGroupFilterOptions(currentValue = "") {
  return [
    { label: "كل الفئات", value: "", active: !currentValue },
    ...ADMIN_PLAYER_GROUPS.map((group) => ({
      label: group,
      value: group,
      active: sameSport(group, currentValue),
    })),
  ];
}

function hideExtraRows(rows) {
  rows.forEach((row, index) => {
    row.style.display = index === 0 ? "" : "none";
  });
}

function sanitizePlayerRows() {
  const rows = [...document.querySelectorAll("#player .pday")];
  rows.forEach((row, index) => {
    setWorkoutRow(row, index === 0 ? "لا توجد بيانات حالياً" : "", index === 0 ? "لا توجد تمارين أو جدول أسبوعي حالياً" : "", true);
    row.style.display = index === 0 ? "" : "none";
  });
}

function sanitizeAttendanceTemplate(viewId) {
  const view = $(viewId);
  if (!view) return;
  updateAttendanceSummary(view, { present: 0, late: 0, excused: 0, registered: 0, total: 0, notRegistered: 0, rate: "0%" });
  const cat = view.querySelector(".catbar");
  setText(cat?.querySelector(".cn"), viewId === "gymAttendance" ? "لاعبو الصالة" : sportNameAr());
  setText(cat?.querySelector(".cc"), "0 لاعب");
  const cards = [...view.querySelectorAll(".pcard")];
  cards.forEach((card, index) => {
    setText(card.querySelector(".pn"), index === 0 ? "لا توجد بيانات حالياً" : "");
    setText(card.querySelector(".pstats"), "الحضور: 0 | التأخير: 0 | الأعذار: 0");
    const note = card.querySelector(".notef");
    if (note) note.value = "";
    card.style.display = index === 0 ? "" : "none";
  });
}

function sanitizeCoachDashboardPlaceholders() {
  const view = $("coach");
  if (!view) return;
  setText(view.querySelector(".scard-head small"), todayKey());
  view.querySelectorAll(".tile .tv").forEach((value) => {
    value.textContent = value.textContent.includes("%") ? "0%" : "0";
  });
  const ranks = [...view.querySelectorAll(".rank")];
  ranks.forEach((row, index) => {
    setText(row.querySelector(".rn"), index === 0 ? "" : "");
    setText(row.querySelector(".ri b"), index === 0 ? "لا توجد بيانات حالياً" : "");
    setText(row.querySelector(".ri small"), "");
    setText(row.querySelector(".bar small"), "");
    setText(row.querySelector(".pct"), "");
    const fill = row.querySelector(".fill");
    if (fill) fill.style.width = "0%";
    row.style.display = index === 0 ? "" : "none";
  });
  const cats = [...view.querySelectorAll(".cat")];
  cats.forEach((row, index) => {
    setChLabel(row.querySelector(".ch"), index === 0 ? "لا توجد بيانات حالياً" : "");
    row.querySelectorAll(".val").forEach((value) => { value.textContent = "0"; });
    row.style.display = index === 0 ? "" : "none";
  });
}

function sanitizeWeeklyPlaceholders() {
  const code = document.querySelector("#weekly .cfield");
  if (code) code.textContent = "--";
  document.querySelectorAll("#weekly .wday input").forEach((input) => {
    input.value = "";
  });
}

function sanitizeAdminPlaceholders() {
  const admin = $("adminDash");
  if (admin) {
    admin.querySelectorAll(".tile .tv, .pctbox .pv").forEach((value) => {
      value.textContent = value.textContent.includes("%") ? "0%" : "0";
    });
    const ranks = [...admin.querySelectorAll(".mrank")];
    ranks.forEach((row, index) => {
      setText(row.querySelector(".mn"), index === 0 ? "" : "");
      setText(row.querySelector(".mi b"), index === 0 ? "لا توجد بيانات حالياً" : "");
      setText(row.querySelector(".mi small"), "");
      setText(row.querySelector(".mp"), "");
      const fill = row.querySelector(".mfill");
      if (fill) fill.style.width = "0%";
      row.style.display = index === 0 ? "" : "none";
    });
    const feeds = [...admin.querySelectorAll(".mfeed")];
    feeds.forEach((row, index) => {
      setText(row.querySelector(".mf-info b"), index === 0 ? "لا توجد بيانات حالياً" : "");
      row.querySelectorAll(".mf-info small").forEach((small) => { small.textContent = ""; });
      row.style.display = index === 0 ? "" : "none";
    });
  }
  const club = $("adminClub");
  if (club) {
    club.querySelectorAll(".ah-txt small, .mini-note, .selall em").forEach((node) => {
      if (node.classList?.contains("mini-note")) node.textContent = "0 لاعب مسجل";
      else if (node.tagName === "EM") node.textContent = "0 محدد";
      else node.textContent = "لا توجد بيانات حالياً";
    });
    const rows = [...club.querySelectorAll(".adm-row, .card-row")];
    rows.forEach((row, index) => {
      setText(row.querySelector(".adm-info b, .cr-info b"), index === 0 ? "لا توجد بيانات حالياً" : "");
      row.querySelectorAll(".adm-info small, .cr-info small, .chip").forEach((node) => { node.textContent = ""; });
      row.style.display = index === 0 ? "" : "none";
    });
  }
  const settingsInfo = document.querySelectorAll("#adminSettings .info-row .iv");
  if (settingsInfo[1]) settingsInfo[1].textContent = todayKey();
}

function sanitizeHomeSportCounts() {
  document.querySelectorAll("#home .count").forEach((count) => {
    const dot = count.querySelector(".dot");
    count.textContent = "0 لاعب";
    if (dot) count.prepend(dot);
  });
}

function sanitizeDesignPlaceholders() {
  sanitizeHomeSportCounts();
  sanitizePlayerRows();
  sanitizeCoachDashboardPlaceholders();
  sanitizeAttendanceTemplate("attendance");
  sanitizeAttendanceTemplate("gymAttendance");
  sanitizeWeeklyPlaceholders();
  sanitizeAdminPlaceholders();
}

function setWorkoutRow(row, title, detail = "", empty = false) {
  if (!row) return;
  const b = row.querySelector("b");
  const span = row.querySelector("span");
  if (b) b.textContent = title || "تمرين";
  if (span) span.textContent = detail || "";
  row.classList.toggle("empty", Boolean(empty));
}

function ensureRows(container, selector, count) {
  const rows = [...container.querySelectorAll(selector)];
  const template = rows[0];
  if (!template) return rows;
  while (rows.length < count) {
    const clone = template.cloneNode(true);
    container.insertBefore(clone, container.querySelector(".bigbtn") || null);
    rows.push(clone);
  }
  rows.forEach((row, index) => {
    row.style.display = index < count ? "" : "none";
  });
  return rows.slice(0, count);
}

function exerciseId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `ex_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function flattenDayExercises(exercises) {
  const list = Array.isArray(exercises) ? exercises : [];
  const names = list.map((ex) => ex.name).filter(Boolean);
  return names.length ? names.join(" | ") : "راحة";
}

async function loadWeeklyExercisesForSport() {
  const schedule = await getSchedule(sportId()).catch(() => null);
  const rawExercises = schedule?.weeklyExercises;
  const legacyPlan = Array.isArray(schedule?.weeklyPlan) ? schedule.weeklyPlan : [];
  const result = {};
  WEEK_DAYS.forEach((day) => {
    if (rawExercises && Array.isArray(rawExercises[day])) {
      result[day] = rawExercises[day];
      return;
    }
    const legacyEntry = legacyPlan.find((entry) => entry.day === day);
    const text = String(legacyEntry?.workout || "").trim();
    result[day] = (text && text !== "راحة") ? [{ id: exerciseId(), name: text, notes: "", links: [] }] : [];
  });
  weeklyExercisesState = result;
  weeklyExercisesSportId = sportId();
  return result;
}

function renderExerciseCardHtml(ex, day, readonly = false) {
  const links = Array.isArray(ex.links) ? ex.links : [];
  const linksHtml = links.length
    ? `<div class="ex-section-label">روابط / ملفات</div><div class="ex-links">${links.map((link) => `<div class="ex-link-row" data-ex-link-url="${escapeHtml(link.url || "")}"><span class="ex-link-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/></svg></span><div class="ex-link-info"><b>${escapeHtml(link.label || "رابط")}</b><small>${escapeHtml(link.url || "")}</small></div></div>`).join("")}</div>`
    : "";
  const notesHtml = ex.notes ? `<div class="ex-section-label">ملاحظات / تفاصيل التمرين</div><div class="ex-notes-box">${escapeHtml(ex.notes)}</div>` : "";
  const menuHtml = readonly ? "" : `<button class="ex-menu-btn" data-ex-menu type="button" aria-label="خيارات"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg></button>`;
  return `<div class="ex-card" data-ex-id="${escapeHtml(ex.id)}" data-day="${escapeHtml(day)}">
    <div class="ex-card-head"><span class="ex-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7v10M9 5v14M15 5v14M17.5 7v10M2.5 10v4M21.5 10v4M9 12h6"/></svg></span><b>${escapeHtml(ex.name || "تمرين")}</b>${menuHtml}</div>
    ${notesHtml}
    ${linksHtml}
  </div>`;
}

function renderDayCardBody(row, day) {
  const body = row.querySelector(".dc-body");
  if (!body) return;
  const exercises = weeklyExercisesState[day] || [];
  body.innerHTML = exercises.map((ex) => renderExerciseCardHtml(ex, day)).join("");
}

function renderWeeklyDayCardByName(day) {
  const row = [...document.querySelectorAll("#weekly .daycard")].find((el) => el.dataset.day === day);
  if (row) renderDayCardBody(row, day);
}

async function renderWeeklyPage() {
  const view = $("weekly");
  if (!view) return;
  const backdrop = $("weeklyItemBackdrop");
  if (backdrop && backdrop.parentElement !== document.body) document.body.appendChild(backdrop);
  const tag = view.querySelector(".appbar .tag");
  if (tag) tag.textContent = sportNameAr();
  const body = view.querySelector(".page-body");
  const code = body?.querySelector(".cfield");
  if (code) code.value = String(selectedSportSettings?.sportCode || state.sportCode || DEFAULT_SPORT_CODE);
  const save = body?.querySelector(".bigbtn");
  if (save) save.dataset.saveWeekly = "1";
  const codeButton = body?.querySelector(".savechip");
  if (codeButton) codeButton.dataset.saveSportCode = "1";
  if (weeklyExercisesSportId !== sportId()) await loadWeeklyExercisesForSport();
  const rows = ensureRows(body, ".daycard", WEEK_DAYS.length);
  rows.forEach((row, index) => {
    const day = WEEK_DAYS[index];
    row.dataset.day = day;
    const label = row.querySelector(".dc-day");
    if (label) label.textContent = day;
    renderDayCardBody(row, day);
  });
}

async function saveWeeklyPage() {
  const weeklyPlan = WEEK_DAYS.map((day) => ({ day, workout: flattenDayExercises(weeklyExercisesState[day]) }));
  await saveSchedule({
    sportId: sportId(),
    sport: sportNameAr(),
    type: "weekly",
    weeklyPlan,
    weeklyExercises: weeklyExercisesState,
  });
  state.weeklyPlans = { ...(state.weeklyPlans || {}), [sportId()]: weeklyPlan };
  state.weeklyPlan = weeklyPlan;
  saveState();
  toast("تم حفظ الجدول الأسبوعي");
  if (activePlayer) await renderPlayerDashboard(activePlayer).catch(() => {});
}

function resetExerciseForm() {
  if ($("wkExName")) $("wkExName").value = "";
  if ($("wkExNotes")) $("wkExNotes").value = "";
  const linksBox = $("wkExLinks");
  if (linksBox) linksBox.innerHTML = "";
}

function addLinkInputRow(label = "", url = "") {
  const box = $("wkExLinks");
  if (!box) return;
  const row = document.createElement("div");
  row.className = "wk-link-input-row";
  row.innerHTML = `<button class="wk-link-remove" type="button" aria-label="حذف الرابط"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><input type="text" class="wk-link-url" placeholder="https://" value="${escapeHtml(url)}"><input type="text" class="wk-link-label" placeholder="اسم الرابط (اختياري)" value="${escapeHtml(label)}">`;
  row.querySelector(".wk-link-remove").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    row.remove();
  });
  box.appendChild(row);
}

function collectLinksFromForm() {
  return [...document.querySelectorAll("#wkExLinks .wk-link-input-row")]
    .map((row) => ({
      id: exerciseId(),
      url: row.querySelector(".wk-link-url")?.value.trim() || "",
      label: row.querySelector(".wk-link-label")?.value.trim() || "",
    }))
    .filter((link) => link.url);
}

function showWeeklyPanel(name) {
  document.querySelectorAll("#weeklyItemSheet .wk-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.wkPanel === name));
  const back = $("weeklyItemBack");
  if (back) back.style.display = name === "pick" ? "none" : "";
  const titleEl = $("weeklyItemTitle");
  const titles = {
    pick: `إضافة إلى يوم ${weeklyActiveDay}`,
    exercise: weeklyEditingExerciseId ? "تعديل التمرين" : "تمرين جديد",
    library: "اختيار من القائمة",
  };
  if (titleEl) titleEl.textContent = titles[name] || titles.pick;
  const saveBtn = $("wkSaveExercise");
  if (saveBtn) saveBtn.textContent = weeklyEditingExerciseId ? "حفظ التعديلات" : "إضافة التمرين";
  if (name === "library") loadAndRenderLibrary("");
}

function openWeeklyAddSheet(day) {
  weeklyActiveDay = day;
  weeklyEditingExerciseId = null;
  resetExerciseForm();
  showWeeklyPanel("pick");
  $("weeklyItemBackdrop")?.classList.add("show");
}

function closeWeeklySheet() {
  $("weeklyItemBackdrop")?.classList.remove("show");
  weeklyActiveDay = "";
  weeklyEditingExerciseId = null;
}

function saveExerciseFromSheet() {
  const day = weeklyActiveDay;
  if (!day) return;
  const name = $("wkExName")?.value.trim();
  if (!name) return toast("اكتب اسم التمرين");
  const notes = $("wkExNotes")?.value.trim() || "";
  const links = collectLinksFromForm();
  const list = weeklyExercisesState[day] || (weeklyExercisesState[day] = []);
  if (weeklyEditingExerciseId) {
    const index = list.findIndex((ex) => ex.id === weeklyEditingExerciseId);
    if (index >= 0) list[index] = { ...list[index], name, notes, links };
  } else {
    list.push({ id: exerciseId(), name, notes, links });
  }
  renderWeeklyDayCardByName(day);
  closeWeeklySheet();
  toast(weeklyEditingExerciseId ? "تم حفظ التعديلات — لا تنسَ حفظ الجدول" : "تمت إضافة التمرين — لا تنسَ حفظ الجدول");
}

function editExerciseInSheet(day, exId) {
  const ex = (weeklyExercisesState[day] || []).find((entry) => entry.id === exId);
  if (!ex) return;
  weeklyActiveDay = day;
  weeklyEditingExerciseId = exId;
  resetExerciseForm();
  if ($("wkExName")) $("wkExName").value = ex.name || "";
  if ($("wkExNotes")) $("wkExNotes").value = ex.notes || "";
  (ex.links || []).forEach((link) => addLinkInputRow(link.label, link.url));
  showWeeklyPanel("exercise");
  $("weeklyItemBackdrop")?.classList.add("show");
}

function deleteExercise(day, exId) {
  const list = weeklyExercisesState[day] || [];
  const index = list.findIndex((entry) => entry.id === exId);
  if (index < 0) return;
  list.splice(index, 1);
  renderWeeklyDayCardByName(day);
  toast("تم حذف التمرين — لا تنسَ حفظ الجدول");
}

function saveExerciseToLibrary(day, exId) {
  const ex = (weeklyExercisesState[day] || []).find((entry) => entry.id === exId);
  if (!ex) return;
  addGymExerciseTemplate({
    source: "weekly",
    sportId: sportId(),
    title: ex.name,
    details: ex.notes || "",
    links: ex.links || [],
  })
    .then((entry) => {
      exerciseLibraryCache.push(entry);
      toast(`تم حفظ "${ex.name}" بالقائمة`);
    })
    .catch((error) => toast(error?.message || "تعذر الحفظ بالقائمة"));
}

function closeExerciseActionMenu() {
  document.querySelector("[data-ex-action-menu]")?.remove();
}

function openExerciseActionMenu(anchor, day, exId) {
  closeExerciseActionMenu();
  const menu = document.createElement("div");
  menu.className = "ex-action-menu";
  menu.dataset.exActionMenu = "1";
  menu.innerHTML = `
    <button type="button" data-act="edit">تعديل</button>
    <button type="button" data-act="save-library">حفظ بالقائمة</button>
    <button type="button" class="danger" data-act="delete">حذف</button>
  `;
  document.body.appendChild(menu);
  menu.querySelector('[data-act="edit"]').addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeExerciseActionMenu();
    editExerciseInSheet(day, exId);
  });
  menu.querySelector('[data-act="save-library"]').addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeExerciseActionMenu();
    saveExerciseToLibrary(day, exId);
  });
  menu.querySelector('[data-act="delete"]').addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeExerciseActionMenu();
    deleteExercise(day, exId);
  });
  const rect = anchor.getBoundingClientRect();
  menu.style.width = "150px";
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  menu.style.left = `${Math.round(Math.min(rect.left, window.innerWidth - 150 - 12))}px`;
  setTimeout(() => document.addEventListener("click", closeExerciseActionMenu, { once: true }), 0);
}

async function loadAndRenderLibrary(filterText) {
  if (!exerciseLibraryLoaded) {
    const templates = await getGymExerciseTemplates().catch(() => []);
    exerciseLibraryCache = Array.isArray(templates) ? templates.filter((entry) => entry.source === "weekly") : [];
    exerciseLibraryLoaded = true;
  }
  const list = $("wkLibraryList");
  const empty = $("wkLibraryEmpty");
  if (!list) return;
  const filtered = exerciseLibraryCache
    .filter((entry) => !sportId() || entry.sportId === sportId())
    .filter((entry) => !filterText || norm(entry.title).includes(norm(filterText)));
  list.innerHTML = "";
  if (!filtered.length) {
    if (empty) empty.style.display = "";
    return;
  }
  if (empty) empty.style.display = "none";
  filtered.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "wk-lib-row";
    row.dataset.libId = entry.id || "";
    row.innerHTML = `<div><b>${escapeHtml(entry.title || "تمرين")}</b>${entry.details ? `<small>${escapeHtml(entry.details)}</small>` : ""}</div><button class="wk-lib-add" type="button" data-lib-add aria-label="إضافة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>`;
    list.appendChild(row);
  });
}

function addExerciseFromLibrary(libId) {
  const day = weeklyActiveDay;
  if (!day) return;
  const entry = exerciseLibraryCache.find((item) => String(item.id) === String(libId));
  if (!entry) return;
  const list = weeklyExercisesState[day] || (weeklyExercisesState[day] = []);
  list.push({
    id: exerciseId(),
    name: entry.title || "تمرين",
    notes: entry.details || "",
    links: (entry.links || []).map((link) => ({ id: exerciseId(), label: link.label || "", url: link.url || "" })),
  });
  renderWeeklyDayCardByName(day);
  toast("تمت الإضافة — لا تنسَ حفظ الجدول");
}

async function renderPlayerTraining(player) {
  const view = $("player");
  const body = view?.querySelector(".page-body");
  if (!body) return;
  const group = playerGroup(player);
  const [daily, plan, schedule] = await Promise.all([dailyWorkoutsFor(group), weeklyPlan(), getSchedule(sportId()).catch(() => null)]);
  const weeklyExercises = schedule?.weeklyExercises || {};
  const planByDay = new Map(plan);
  const dailyItems = daily.map((workout) => ({
    title: "تمرين اليوم",
    detail: [workoutTitle(workout), workoutDetails(workout)].filter(Boolean).join(" — "),
    empty: false,
  }));
  const hasWeeklyContent = WEEK_DAYS.some((day) => (weeklyExercises[day] || []).length || String(planByDay.get(day) || "").trim());
  const items = dailyItems.length
    ? dailyItems
    : (hasWeeklyContent ? [] : [{ title: "لا توجد بيانات حالياً", detail: "لا توجد تمارين يومية أو جدول أسبوعي لهذه الرياضة والفئة", empty: true }]);
  const rows = ensureRows(body, ".pday", items.length);
  items.forEach((item, index) => {
    setWorkoutRow(rows[index], item.title, item.detail, item.empty);
  });
  let weekBox = body.querySelector("#playerWeekCards");
  if (!weekBox) {
    weekBox = document.createElement("div");
    weekBox.id = "playerWeekCards";
    weekBox.className = "player-week";
    body.appendChild(weekBox);
  }
  weekBox.innerHTML = WEEK_DAYS.map((day) => {
    const exercises = Array.isArray(weeklyExercises[day]) ? weeklyExercises[day] : [];
    if (exercises.length) {
      return `<div class="daycard player-daycard">
        <div class="daycard-head"><b class="dc-day">${escapeHtml(day)}</b></div>
        <div class="dc-body">${exercises.map((ex) => renderExerciseCardHtml(ex, day, true)).join("")}</div>
      </div>`;
    }
    const text = String(planByDay.get(day) || "").trim();
    if (!text) return "";
    return `<div class="pday"><b>${escapeHtml(day)}</b><span>${escapeHtml(text)}</span></div>`;
  }).join("");
}

function normalizeGroupName(group) {
  const value = String(group || "").trim();
  if (!value) return "";
  return value.startsWith("فئة") ? value : `فئة ${value}`;
}

function renderGymSportsPicker() {
  const grid = $("gymSports");
  if (!grid) return;
  const buttons = [...grid.querySelectorAll(".pick[data-sport]")];
  const preferred = sportByAnyValue(workoutDraft.sportId);
  const baseSports = sportsCatalog.filter((sport) => sport.active !== false);
  const sports = [preferred, ...baseSports]
    .filter(Boolean)
    .filter((sport, index, list) => list.findIndex((item) => sameSport(sportValue(item), sportValue(sport))) === index);
  buttons.forEach((button, index) => {
    const sport = sports[index];
    if (!sport) return;
    button.textContent = sportAr(sport);
    button.dataset.sport = sportAr(sport);
    button.dataset.sportId = sportValue(sport);
    button.classList.toggle("on", sameSport(sportValue(sport), workoutDraft.sportId));
  });
}

function sportByAnyValue(value) {
  return sportsCatalog.find((sport) =>
    [sportValue(sport), sportEn(sport), sportAr(sport)].map(norm).includes(norm(value)),
  );
}

function activeCoachSportId() {
  return activeCoachSession?.sportId || activeCoachSession?.sport || "";
}

function canCoachViewWorkoutSport(targetSportId) {
  const coachSport = activeCoachSportId();
  if (!coachSport) return true;
  if (sameSport(coachSport, "gym") || sameSport(coachSport, "صالة الرياضة")) return true;
  return sameSport(coachSport, targetSportId);
}

function updateGymCategoryButtons() {
  const buttons = [...document.querySelectorAll("#gymCats .pick[data-cat]")];
  const players = playersDirectory.filter((player) =>
    player.active !== false &&
    playerBelongsToSport(player, {
      id: workoutDraft.sportId,
      nameEn: workoutDraft.sportId,
      nameAr: workoutDraft.sport,
    }),
  );
  const groups = [...new Set(players.map(playerGroup).filter(Boolean))];
  const values = groups.length ? groups : ["فئة الكبار", "فئة الشباب", "فئة الناشئين", "فئة البراعم"];
  buttons.forEach((button, index) => {
    const group = values[index] || button.dataset.cat || button.textContent.trim();
    button.textContent = group.replace(/^فئة\s*/, "");
    button.dataset.cat = group;
    button.classList.toggle("on", sameSport(workoutDraft.group, group));
  });
}

function appendWorkoutItem(list, workout) {
  const row = document.createElement("div");
  row.className = "pday";
  row.dataset.workoutId = workout?.id || "";
  const title = document.createElement("b");
  title.textContent = workoutTitle(workout);
  const details = document.createElement("span");
  details.textContent = workoutDetails(workout) || workout?.video || playerGroup(workout) || workoutDraft.group || "";
  row.appendChild(title);
  row.appendChild(details);
  list.appendChild(row);
}

function filterWorkoutsForDraft(workouts) {
  return (Array.isArray(workouts) ? workouts : []).filter((workout) => {
    if (workout.active === false) return false;
    if (!playerBelongsToSport(workout, { id: workoutDraft.sportId, nameEn: workoutDraft.sportId, nameAr: workoutDraft.sport })) return false;
    const group = playerGroup(workout);
    return !workoutDraft.group || !group || sameSport(normalizeGroupName(group), normalizeGroupName(workoutDraft.group));
  });
}

async function renderDailyWorkoutManager() {
  const view = $("gymTraining");
  if (!view) return;
  const tag = view.querySelector(".appbar .tag");
  if (tag) tag.textContent = sportNameAr();
  const preferredSport = activeCoachSportId() || sportId();
  const preferred = sportByAnyValue(preferredSport) || sportByAnyValue(sportId());
  workoutDraft.sportId = workoutDraft.sportId || sportValue(preferred) || sportId();
  workoutDraft.sport = workoutDraft.sport || sportAr(preferred) || sportNameAr();
  workoutDraft.group = workoutDraft.group || "فئة الكبار";
  if (!canCoachViewWorkoutSport(workoutDraft.sportId)) {
    workoutDraft.sportId = sportValue(preferred) || sportId();
    workoutDraft.sport = sportAr(preferred) || sportNameAr();
  }
  renderGymSportsPicker();
  await refreshPlayersDirectory().catch(() => {});
  const catWrap = $("gymCatWrap");
  const manage = $("gymManage");
  if (catWrap) catWrap.style.display = "block";
  if (manage) manage.style.display = "block";
  if ($("mgSport")) $("mgSport").textContent = workoutDraft.sport;
  if ($("mgCat")) $("mgCat").textContent = workoutDraft.group.replace(/^فئة\s*/, "");
  updateGymCategoryButtons();
  let workouts = [];
  try {
    workouts = await getDailyWorkouts({ sportId: workoutDraft.sportId });
  } catch {}
  workouts = filterWorkoutsForDraft(workouts);
  const list = $("exList");
  const empty = $("exEmpty");
  if (list) {
    clearNode(list);
    workouts.forEach((workout) => appendWorkoutItem(list, workout));
  }
  if (empty) empty.style.display = workouts.length ? "none" : "block";
}

function openExerciseModal() {
  const modal = $("exModal");
  if (!modal) return;
  $("exModalTitle").textContent = `إضافة تمرين — ${workoutDraft.sport || sportNameAr()} — ${(workoutDraft.group || "").replace(/^فئة\s*/, "")}`;
  $("exName").value = "";
  $("exDetail").value = "";
  $("exVideo").value = "";
  modal.classList.add("show");
}

async function saveExerciseFromModal(button) {
  const title = $("exName")?.value.trim();
  const details = $("exDetail")?.value.trim();
  const video = $("exVideo")?.value.trim();
  if (!title || !details) return toast("اكتب اسم التمرين وتفاصيله");
  button.disabled = true;
  try {
    await addDailyWorkout({
      title,
      details,
      video,
      sportId: workoutDraft.sportId || sportId(),
      sport: workoutDraft.sport || sportNameAr(),
      group: workoutDraft.group || "",
      active: true,
      date: todayKey(),
    });
    $("exModal")?.classList.remove("show");
    toast("تم حفظ التمرين");
    await renderDailyWorkoutManager();
  } catch (error) {
    toast(error?.message || "تعذر حفظ التمرين");
  } finally {
    button.disabled = false;
  }
}

async function loadGymTemplates() {
  try {
    const templates = await getGymExerciseTemplates();
    gymTemplates = Array.isArray(templates) ? templates.filter((template) => template.active !== false && template.source !== "weekly") : [];
  } catch {
    gymTemplates = [];
  }
  return gymTemplates;
}

function templateTitle(template) {
  return firstText(template?.title, template?.name, template?.exerciseName, "قالب تمرين");
}

function templateDetails(template) {
  const count = Array.isArray(template?.exercises) ? `${template.exercises.length} تمارين` : "";
  return firstText(template?.details, template?.description, template?.notes, count);
}

function appendPickTemplate(template) {
  const list = $("pickList");
  if (!list) return;
  const button = document.createElement("button");
  button.className = "pick-row";
  button.type = "button";
  button.dataset.templateId = template?.id || "";
  const info = document.createElement("div");
  info.className = "pr-info";
  const title = document.createElement("b");
  title.textContent = templateTitle(template);
  const small = document.createElement("small");
  small.textContent = templateDetails(template);
  const apply = document.createElement("span");
  apply.className = "pr-apply";
  apply.textContent = "تطبيق";
  info.appendChild(title);
  if (small.textContent) info.appendChild(small);
  button.appendChild(info);
  button.appendChild(apply);
  list.appendChild(button);
}

function renderGymTemplatesList() {
  const list = $("pickList");
  if (!list) return;
  clearNode(list);
  const filtered = gymTemplates.filter((template) => !gymTemplateSearch || norm(templateTitle(template)).includes(norm(gymTemplateSearch)));
  filtered.forEach(appendPickTemplate);
}

async function openGymTemplatesModal() {
  const modal = $("pickModal");
  if (!modal) return toast("نافذة القوالب غير موجودة في التصميم");
  gymTemplateSearch = "";
  const input = $("pickSearch");
  if (input) input.value = "";
  await loadGymTemplates();
  renderGymTemplatesList();
  if (!gymTemplates.length) toast("لا توجد قوالب محفوظة");
  modal.classList.add("show");
}

async function applyGymTemplate(templateId) {
  const template = gymTemplates.find((item) => String(item.id) === String(templateId));
  if (!template) return;
  const exercises = Array.isArray(template.exercises) && template.exercises.length
    ? template.exercises
    : [template];
  try {
    for (const exercise of exercises) {
      const title = firstText(exercise.title, exercise.name, exercise.exerciseName, templateTitle(template));
      const details = firstText(exercise.details, exercise.description, exercise.durationOrReps, exercise.notes, templateDetails(template), "تمرين");
      await addDailyWorkout({
        title,
        details,
        video: firstText(exercise.video, exercise.videoUrl, template.video, template.videoUrl),
        sportId: workoutDraft.sportId || sportId(),
        sport: workoutDraft.sport || sportNameAr(),
        group: workoutDraft.group || "",
        active: true,
        date: todayKey(),
      });
    }
    $("pickModal")?.classList.remove("show");
    toast("تم تطبيق القالب");
    await renderDailyWorkoutManager();
  } catch (error) {
    toast(error?.message || "تعذر تطبيق القالب");
  }
}

function ensureScannerModal() {
  let modal = $("attendanceQrModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "attendanceQrModal";
  modal.innerHTML = `<div class="modal-card sheet-card">
    <button class="modal-x" id="attendanceQrClose" aria-label="إغلاق">&times;</button>
    <h3>مسح QR للحضور</h3>
    <p>سيتم تسجيل حاضر أو متأخر حسب وقت الرياضة والفئة</p>
    <div class="vf-result" id="attendanceQrResult"></div>
    <div class="scanner"><div id="attendanceQrCamera" style="min-height:260px"></div></div>
    <p class="scan-hint" id="attendanceQrHint">جارٍ تشغيل الكاميرا</p>
  </div>`;
  document.querySelector(".screen")?.appendChild(modal);
  return modal;
}

async function ensureQrLibrary() {
  if (window.Html5Qrcode) return true;
  await loadScriptOnce("js/vendor/html5-qrcode.min.js");
  return Boolean(window.Html5Qrcode);
}

function renderScanResult(target, player, text, ok = true, simple = false) {
  const box = $(target);
  if (!box) return;
  box.className = `vf-result ${ok ? "show ok" : "show bad"}`;
  if (simple) {
    box.innerHTML = player
      ? `<div class="verify-result-title">${escapeHtml(text)}</div>
        <div class="verify-row"><b>${escapeHtml(playerName(player) || "—")}</b></div>`
      : `<div class="verify-result-title">${escapeHtml(text)}</div>`;
    return;
  }
  box.innerHTML = player
    ? `<div class="verify-result-title">${escapeHtml(text)}</div>
      <div class="verify-row"><span>الاسم</span><b>${escapeHtml(playerName(player) || "—")}</b></div>
      <div class="verify-row"><span>الرياضة</span><b>${escapeHtml(player?.sport || sportNameAr())}</b></div>
      <div class="verify-row"><span>الفئة</span><b>${escapeHtml(playerGroup(player) || "—")}</b></div>
      <div class="verify-row"><span>PlayerID</span><b>${escapeHtml(playerKey(player) || "—")}</b></div>`
    : `<div class="verify-result-title">${escapeHtml(text)}</div>`;
}

async function handleQrAttendance(decodedText) {
  if (attendanceScannerProcessing) return;
  attendanceScannerProcessing = true;
  const resultTarget = attendanceScannerUsingVerifyModal ? "vfResult" : "attendanceQrResult";
  try {
    await refreshPlayersDirectory();
    await refreshTodayAttendance();
    const player = findPlayerByCode(decodedText, playersDirectory);
    if (!player) {
      renderScanResult(resultTarget, null, "البطاقة غير مسجلة", false, true);
      toast("البطاقة غير مسجلة");
      return;
    }
    if (!playerBelongsToSport(player, { id: sportId(), nameEn: sportNameEn(), nameAr: sportNameAr() })) {
      renderScanResult(resultTarget, player, "هذا اللاعب لا يتبع هذه الرياضة", false, true);
      toast("هذا اللاعب لا يتبع هذه الرياضة");
      return;
    }
    const current = attendanceStatus(attendanceEntryForPlayer(player));
    if (current === "present" || current === "late") {
      renderScanResult(resultTarget, player, "تم تسجيل الحضور مسبقاً", true, true);
      toast(`تم تسجيل الحضور مسبقاً — ${playerName(player)}`);
      return;
    }
    const status = checkAttendanceWindow(player);
    if (!status) {
      renderScanResult(resultTarget, player, `خارج وقت تسجيل الحضور لـ ${playerGroup(player) || "هذه الفئة"}`, false, true);
      toast(`خارج وقت تسجيل الحضور لـ ${playerGroup(player) || "هذه الفئة"}`);
      return;
    }
    await saveAttendance(player, status, firstText(attendanceEntryForPlayer(player)?.note, player?.note));
    renderScanResult(resultTarget, player, "تم التحضير", true, true);
    toast(`تم التحضير — ${playerName(player)}`);
    if (attendanceScannerUsingVerifyModal) renderVerifyPresentSummary();
    await renderAttendancePage(activeAttendanceViewId());
  } catch (error) {
    renderScanResult(resultTarget, null, error?.message || "تعذر تسجيل الحضور", false, true);
    toast(error?.message || "تعذر تسجيل الحضور");
  } finally {
    setTimeout(() => {
      attendanceScannerProcessing = false;
    }, 600);
  }
}

function morphSheetFromButton(button, sheetEl) {
  if (!button || !sheetEl) return;
  const startRect = button.getBoundingClientRect();
  const endRect = sheetEl.getBoundingClientRect();
  if (!endRect.width || !endRect.height) return;
  const scaleX = startRect.width / endRect.width;
  const scaleY = startRect.height / endRect.height;
  const translateX = startRect.left + startRect.width / 2 - (endRect.left + endRect.width / 2);
  const translateY = startRect.top + startRect.height / 2 - (endRect.top + endRect.height / 2);
  sheetEl.style.transition = "none";
  sheetEl.style.transformOrigin = "center center";
  sheetEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sheetEl.style.transition = "transform .4s cubic-bezier(.22,.78,.31,1)";
      sheetEl.style.transform = "none";
    });
  });
  sheetEl.addEventListener("transitionend", function handler() {
    sheetEl.style.transition = "";
    sheetEl.style.transform = "";
    sheetEl.style.transformOrigin = "";
    sheetEl.removeEventListener("transitionend", handler);
  });
}

async function openAttendanceQr(triggerButton) {
  if (attendanceScanner || attendanceScannerStarting) return;
  const modal = $("verifyModal");
  const cameraId = "scanner";
  const resultId = "vfResult";
  const hint = $("scanHint");
  if (!modal || !$("scanner") || !$("vfResult")) {
    toast("ماسح QR غير موجود في التصميم الحالي");
    return;
  }
  const heading = modal.querySelector("h3");
  const subtitle = modal.querySelector("p");
  attendanceScannerUsingVerifyModal = true;
  if (verifyScanner) await closeVerifyScanner().catch(() => {});
  modal.classList.add("show");
  modal.classList.add("coach-scan");
  modal.classList.remove("has-result");
  const sheetCard = modal.querySelector(".modal-card");
  if (triggerButton && sheetCard) morphSheetFromButton(triggerButton, sheetCard);
  if (heading) heading.textContent = "مسح QR للحضور";
  if (subtitle) subtitle.textContent = "سيتم تسجيل حاضر أو متأخر حسب وقت الرياضة والفئة";
  await refreshTodayAttendance().catch(() => {});
  renderVerifyPresentSummary();
  const result = $(resultId);
  if (result) {
    result.className = "vf-result";
    result.textContent = "";
  }
  if (hint) hint.textContent = "جارٍ تشغيل الكاميرا";
  attendanceScannerStarting = true;
  try {
    await ensureQrLibrary();
    attendanceScanner = new window.Html5Qrcode(cameraId, {
      formatsToSupport: window.Html5QrcodeSupportedFormats ? [window.Html5QrcodeSupportedFormats.QR_CODE] : undefined,
      rememberLastUsedCamera: true,
    });
    await attendanceScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 }, disableFlip: false },
      handleQrAttendance,
      () => {},
    );
    if (hint) hint.textContent = "وجّه الكاميرا نحو بطاقة اللاعب";
  } catch (error) {
    if (hint) hint.textContent = "تعذر تشغيل ماسح QR";
    toast("تعذر تشغيل ماسح QR");
  } finally {
    attendanceScannerStarting = false;
  }
}

async function closeAttendanceQr() {
  const scanner = attendanceScanner;
  attendanceScanner = null;
  attendanceScannerStarting = false;
  attendanceScannerProcessing = false;
  if (scanner) {
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {}
  }
  if (attendanceScannerUsingVerifyModal) {
    $("verifyModal")?.classList.remove("show");
    $("verifyModal")?.classList.remove("has-result");
    $("verifyModal")?.classList.remove("coach-scan");
    document.querySelector(".screen")?.classList.remove("verifyblur");
    const heading = $("verifyModal")?.querySelector("h3");
    const subtitle = $("verifyModal")?.querySelector("p");
    if (heading) heading.textContent = "التحقق من لاعب";
    if (subtitle) subtitle.textContent = "امسح بطاقة اللاعب للتأكد من عضويته فقط";
  } else {
    $("attendanceQrModal")?.classList.remove("show");
  }
  attendanceScannerUsingVerifyModal = false;
  const camera = $("attendanceQrCamera");
  if (camera) camera.innerHTML = "";
}

async function handleVerifyCode(decodedText) {
  await refreshPlayersDirectory();
  const player = findPlayerByCode(decodedText, playersDirectory);
  renderScanResult("vfResult", player, player ? "لاعب مسجل في النادي" : "البطاقة غير مسجلة في النظام", Boolean(player));
}

function renderVerifyPresentSummary() {
  const seen = new Set();
  todayAttendance.forEach((entry) => {
    const status = attendanceStatus(entry);
    if (status !== "present" && status !== "late") return;
    const id = String(entry?.playerId || "").trim();
    if (id) seen.add(id);
  });
  const countEl = $("vfPresentCount");
  if (countEl) countEl.textContent = String(seen.size);
}

async function startVerifyScanner() {
  if (verifyScanner || verifyScannerStarting) return;
  const modal = $("verifyModal");
  if (!modal) return;
  modal.classList.add("show");
  modal.classList.remove("coach-scan");
  document.querySelector(".screen")?.classList.add("verifyblur");
  await refreshTodayAttendance().catch(() => {});
  renderVerifyPresentSummary();
  $("vfResult").innerHTML = "";
  $("scanHint").textContent = "جارٍ تشغيل الكاميرا — وجّهها نحو رمز QR على البطاقة";
  verifyScannerStarting = true;
  try {
    await ensureQrLibrary();
    verifyScanner = new window.Html5Qrcode("scanner", {
      formatsToSupport: window.Html5QrcodeSupportedFormats ? [window.Html5QrcodeSupportedFormats.QR_CODE] : undefined,
      rememberLastUsedCamera: true,
    });
    await verifyScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 }, disableFlip: false },
      handleVerifyCode,
      () => {},
    );
    $("scanHint").textContent = "وجّه الكاميرا نحو بطاقة اللاعب";
  } catch {
    $("scanHint").textContent = "تعذر تشغيل ماسح QR";
  } finally {
    verifyScannerStarting = false;
  }
}

async function closeVerifyScanner() {
  const scanner = verifyScanner;
  verifyScanner = null;
  verifyScannerStarting = false;
  if (scanner) {
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {}
  }
  $("verifyModal")?.classList.remove("show");
  document.querySelector(".screen")?.classList.remove("verifyblur");
}

/* ===== security page: التحقق من لاعب ===== */

function secInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "؟";
}

function secPlayerPhoto(player) {
  return firstText(player?.photoUrl, player?.photoURL, player?.imageUrl, player?.avatarUrl, player?.photo);
}

function secPlayerSportName(player) {
  return firstText(player?.sport, sportNameById(player?.sportId), "غير محدد");
}

function renderCheckinRow(entry) {
  const time = entry.checkInTime
    ? new Date(entry.checkInTime).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })
    : "—";
  return `<div class="sec-checkin-row">
    <div><b>${escapeHtml(entry.playerName || "لاعب")}</b><small>${escapeHtml(entry.sport || "—")}</small></div>
    <div class="sec-checkin-time">${escapeHtml(time)}</div>
  </div>`;
}

function updateLiveCounter() {
  const seen = new Set();
  const presentEntries = [];
  todayAttendance.forEach((entry) => {
    const status = attendanceStatus(entry);
    if (status !== "present" && status !== "late") return;
    const id = String(entry?.playerId || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    presentEntries.push(entry);
  });
  const el = $("secLiveCount");
  if (el) el.textContent = String(seen.size);
  const list = $("secLiveList");
  if (list) {
    const sorted = presentEntries.sort((a, b) => new Date(b.checkInTime || 0) - new Date(a.checkInTime || 0));
    list.innerHTML = sorted.length
      ? sorted.map(renderCheckinRow).join("")
      : `<div class="sec-checkin-empty">لا يوجد لاعبون داخل النادي حالياً</div>`;
  }
}

function searchPlayer(query) {
  const q = String(query || "").trim();
  if (!q) return null;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 4) {
    const byId = playersDirectory.find((player) => {
      const idDigits = nationalDigits(player);
      return idDigits && (idDigits === digits || idDigits.endsWith(digits));
    });
    if (byId) return byId;
  }
  const qNorm = q.toLocaleLowerCase("ar");
  return (
    playersDirectory.find((player) => playerName(player).toLocaleLowerCase("ar").includes(qNorm)) || null
  );
}

function renderInvalidResult() {
  const box = $("secResultCard");
  if (!box) return;
  box.style.display = "flex";
  box.className = "sec-result-card invalid";
  box.innerHTML = `<div class="sec-result-avatar">!</div>
    <div class="sec-result-info"><b>اللاعب غير مسجل في النادي</b></div>
    <div class="sec-result-status">غير مسموح</div>`;
}

function renderSearchResult(player, validated = false) {
  const box = $("secResultCard");
  if (!box) return;
  if (!player) {
    renderInvalidResult();
    return;
  }
  box.style.display = "flex";
  box.className = "sec-result-card valid";
  const photo = secPlayerPhoto(player);
  const avatar = photo
    ? `<img src="${escapeHtml(photo)}" alt="">`
    : escapeHtml(secInitials(playerName(player)));
  box.innerHTML = `<div class="sec-result-avatar">${avatar}</div>
    <div class="sec-result-info">
      <b>${escapeHtml(playerName(player) || "لاعب")}</b>
      <small>${escapeHtml(secPlayerSportName(player))} — ${escapeHtml(playerGroup(player) || "غير محدد")}</small>
      <small>رقم الهوية: ${escapeHtml(nationalDigits(player) || "غير مسجل")}</small>
    </div>
    <div class="sec-result-status">${validated ? "تم التحقق بنجاح" : "مسموح بالدخول"}</div>`;
}

async function saveSecurityCheckIn(player) {
  const id = playerKey(player);
  if (!id) return;
  const payload = {
    playerId: id,
    playerName: playerName(player),
    date: todayKey(),
    sport: secPlayerSportName(player),
    sportId: String(player?.sportId || player?.sport || ""),
    status: "present",
    present: true,
    late: false,
    excused: false,
    points: playerPoints(player),
    note: "",
    checkInTime: new Date().toISOString(),
  };
  await updateAttendance(payload);
  const existingIndex = todayAttendance.findIndex((entry) => String(entry.playerId || "") === String(id));
  const nextEntry = { ...payload, id: `${todayKey()}_${id}` };
  if (existingIndex >= 0) todayAttendance[existingIndex] = nextEntry;
  else todayAttendance.push(nextEntry);
  /* [instant-att-sync] */ if (Array.isArray(allAttendanceRecordsCache)) {
    const __ci = allAttendanceRecordsCache.findIndex((e) => String(e.id) === String(nextEntry.id));
    if (__ci >= 0) allAttendanceRecordsCache[__ci] = nextEntry; else allAttendanceRecordsCache.push(nextEntry);
  }
}

async function validatePlayer(player) {
  if (!player) {
    renderInvalidResult();
    return;
  }
  const entry = attendanceEntryForPlayer(player);
  const already = attendanceStatus(entry) === "present" || attendanceStatus(entry) === "late";
  if (!already) {
    await saveSecurityCheckIn(player).catch(() => toast("تعذر تسجيل الحضور"));
  }
  renderSearchResult(player, true);
  updateLiveCounter();
  loadLatestCheckins();
}

function loadLatestCheckins() {
  const list = $("secCheckinList");
  if (!list) return;
  const sorted = [...todayAttendance]
    .filter((entry) => attendanceStatus(entry) === "present" || attendanceStatus(entry) === "late")
    .sort((a, b) => new Date(b.checkInTime || 0) - new Date(a.checkInTime || 0))
    .slice(0, 5);
  if (!sorted.length) {
    list.innerHTML = `<div class="sec-checkin-empty">لا يوجد لاعبون مسجّلون اليوم بعد</div>`;
    return;
  }
  list.innerHTML = sorted.map(renderCheckinRow).join("");
}

async function openCamera() {
  if (secScanner || secScannerStarting) return;
  const placeholder = $("secScanPlaceholder");
  const startBtn = $("secStartCamBtn");
  const stopBtn = $("secStopCamBtn");
  secScannerStarting = true;
  try {
    await ensureQrLibrary();
    secScanner = new window.Html5Qrcode("secScannerCamera", {
      formatsToSupport: window.Html5QrcodeSupportedFormats ? [window.Html5QrcodeSupportedFormats.QR_CODE] : undefined,
      rememberLastUsedCamera: true,
    });
    await secScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 }, disableFlip: false },
      handleSecurityScan,
      () => {},
    );
    if (placeholder) placeholder.style.display = "none";
    if (startBtn) startBtn.style.display = "none";
    if (stopBtn) stopBtn.style.display = "";
  } catch (error) {
    toast("تعذر تشغيل الكاميرا");
    secScanner = null;
  } finally {
    secScannerStarting = false;
  }
}

async function closeCamera() {
  const scanner = secScanner;
  secScanner = null;
  secScannerStarting = false;
  secScannerProcessing = false;
  if (scanner) {
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {}
  }
  const cameraEl = $("secScannerCamera");
  if (cameraEl) cameraEl.innerHTML = "";
  const placeholder = $("secScanPlaceholder");
  const startBtn = $("secStartCamBtn");
  const stopBtn = $("secStopCamBtn");
  if (placeholder) placeholder.style.display = "";
  if (startBtn) startBtn.style.display = "";
  if (stopBtn) stopBtn.style.display = "none";
}

async function handleSecurityScan(decodedText) {
  if (secScannerProcessing) return;
  secScannerProcessing = true;
  try {
    await refreshPlayersDirectory();
    await refreshTodayAttendance();
    const player = findPlayerByCode(decodedText, playersDirectory);
    await validatePlayer(player);
  } catch {
    toast("تعذر معالجة المسح");
  } finally {
    setTimeout(() => {
      secScannerProcessing = false;
    }, 800);
  }
}

async function renderSecurityPage() {
  await Promise.all([refreshPlayersDirectory(), refreshTodayAttendance()]);
  $("secResultCard")?.style && ($("secResultCard").style.display = "none");
  if ($("secSearchInput")) $("secSearchInput").value = "";
  updateLiveCounter();
  loadLatestCheckins();
}

async function loadAdminData() {
  const [sports, players, coaches, attendance, allAttendance, announcements] = await Promise.all([
    getSports({}).catch(() => []),
    getAllPlayers({}).catch(() => []),
    getCoaches({}).catch(() => []),
    getAttendanceRecords({ date: todayKey() }).catch(() => []),
    getAttendanceRecords({}).catch(() => []),
    getAnnouncements().catch(() => []),
  ]);
  adminData = {
    sports: Array.isArray(sports) ? sports : [],
    players: Array.isArray(players) ? players : [],
    coaches: Array.isArray(coaches) ? coaches : [],
    attendance: Array.isArray(attendance) ? attendance : [],
    allAttendance: Array.isArray(allAttendance) ? allAttendance : [],
    announcements: Array.isArray(announcements) ? announcements : [],
  };
  if (adminData.sports.length) sportsCatalog = adminData.sports;
  playersDirectory = adminData.players;
  coachesDirectory = adminData.coaches;
  return adminData;
}

function playerCountForSport(sport) {
  return adminData.players.filter((player) => playerBelongsToSport(player, sport)).length;
}

function coachCountForSport(sport) {
  const accepted = [sportValue(sport), sportEn(sport), sportAr(sport)].map(norm).filter(Boolean);
  return adminData.coaches.filter((coach) => accepted.includes(norm(coach.sportId || coach.sport))).length;
}

function sportNameById(value) {
  const sport = sportsCatalog.find((item) =>
    [sportValue(item), sportEn(item), sportAr(item)].map(norm).includes(norm(value)),
  );
  return sport ? sportAr(sport) : value || "";
}

async function playerCardQrImageBridge(player) {
  try {
    if (typeof window.qrcode !== "function") await loadScriptOnce("js/vendor/qrcode.js").catch(() => {});
    if (typeof window.qrcode !== "function") return "";
    const value = playerQrValue(player);
    if (!value) return "";
    const code = window.qrcode(0, "M");
    code.addData(value);
    code.make();
    return code.createDataURL(9, 12);
  } catch {
    return "";
  }
}

function cardIcon(name) {
  const paths = {
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h4M7 13h6M16 10h2M16 14h2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    sport: '<path d="M14.5 4.5 19 9M5 19l9.5-9.5M13 6l5 5M6 13l5 5M3 21l3-8 5 5-8 3Z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.user}</svg>`;
}

function cardDate(value) {
  if (!value) return "";
  if (typeof value?.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  return "";
}

function cardAge(player) {
  const explicit = numberValue(player?.age);
  if (explicit) return `${explicit} سنة`;
  const birth = cardDate(firstText(player?.birthDate, player?.dob, player?.dateOfBirth));
  if (!birth) return "غير مسجل";
  const date = new Date(birth);
  if (Number.isNaN(date.getTime())) return "غير مسجل";
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const month = today.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < date.getDate())) age--;
  return age > 0 ? `${age} سنة` : "غير مسجل";
}

function cardInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join("") || "WL";
}

function cardCoachName(player) {
  const identities = [player?.coachId, player?.coachUid, player?.coachEmail]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);
  const sportValue = firstText(player?.sportId, player?.sport);
  const coach =
    adminData.coaches.find((item) =>
      [item?.id, item?.uid, item?.authUid, item?.email]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value && identities.includes(value)),
    ) ||
    adminData.coaches.find((item) => sameSport(firstText(item?.sportId, item?.sport), sportValue));
  return firstText(coach?.name, coach?.email, "غير محدد");
}

function renderWaveLiftPlayerCard(player, qrImage = "") {
  const name = playerName(player) || "لاعب";
  const sport = firstText(player?.sport, sportNameById(player?.sportId), "غير محدد");
  const group = playerGroup(player) || "غير محدد";
  const playerId = playerQrValue(player) || "غير موجود";
  const photo = firstText(player?.photoUrl, player?.photoURL, player?.imageUrl, player?.avatarUrl, player?.photo);
  const birthDate = cardDate(firstText(player?.birthDate, player?.dob, player?.dateOfBirth)) || "غير مسجل";
  const weight = numberValue(player?.weight) ? `${numberValue(player?.weight)} كجم` : "غير مسجل";
  const details = [
    ["id", "رقم الهوية:", firstText(player?.nationalId, player?.identity, player?.idNumber, "غير مسجل")],
    ["calendar", "تاريخ الميلاد:", birthDate],
    ["user", "العمر:", cardAge(player)],
    ["sport", "الوزن:", weight],
    ["user", "الإداري:", firstText(player?.adminName, "غير محدد")],
    ["user", "المدرب:", cardCoachName(player)],
  ];

  return `<article class="wave-id-card" dir="rtl">
    <header class="wave-id-head">
      <div class="wave-id-brand">
        <img src="assets/branding/wave-lift-card-mark.png" alt="Wave Lift">
        <strong><span>WAVE</span> LIFT</strong>
      </div>
      <div class="wave-id-label"><span>بطاقة لاعب</span><i></i></div>
      <div class="wave-id-club">
        <div><strong>نادي الهلال</strong><span>ALHILAL CLUB</span></div>
        <img src="assets/branding/hilal-card-shield.png" alt="نادي الهلال">
      </div>
    </header>
    <section class="wave-id-profile">
      <div class="wave-id-avatar${photo ? " has-photo" : ""}">
        ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}">` : ""}
        <span>${escapeHtml(cardInitials(name))}</span>
      </div>
      <h2 class="${name.length > 28 ? "is-long" : ""}">${escapeHtml(name)}</h2>
      <div class="wave-id-pills">
        <div><b>اللعبة:</b><span>${escapeHtml(sport)}</span>${cardIcon("sport")}</div>
        <div><b>الفئة:</b><span>${escapeHtml(group)}</span>${cardIcon("user")}</div>
      </div>
    </section>
    <section class="wave-id-details">
      ${details.map(([icon, label, value]) => `<div><span>${cardIcon(icon)}</span><b>${label}</b><strong>${escapeHtml(value)}</strong></div>`).join("")}
    </section>
    <aside class="wave-id-qr">
      <div class="wave-id-qrbox">${qrImage ? `<img src="${qrImage}" alt="QR ${escapeHtml(playerId)}">` : `<span>QR</span>`}</div>
      <small>رقم اللاعب:</small>
      <strong>${escapeHtml(playerId)}</strong>
    </aside>
  </article>`;
}

function ensurePrintCardsSheet() {
  let sheet = $("printCardsSheet");
  if (sheet) return sheet;
  sheet = document.createElement("div");
  sheet.id = "printCardsSheet";
  document.body.appendChild(sheet);
  return sheet;
}

function clearPrintCardsSheet() {
  const sheet = $("printCardsSheet");
  if (sheet) sheet.innerHTML = "";
}
window.addEventListener("afterprint", clearPrintCardsSheet);

async function printCards(players) {
  const list = players.filter(Boolean);
  if (!list.length) return toast("لا توجد بطاقات للطباعة");
  const cards = await Promise.all(list.map(async (player) => ({ player, qr: await playerCardQrImageBridge(player) })));
  const sheet = ensurePrintCardsSheet();
  sheet.innerHTML = "";
  const pages = [];
  for (let i = 0; i < cards.length; i += 8) pages.push(cards.slice(i, i + 8));
  sheet.innerHTML = pages
    .map(
      (group) =>
        `<div class="print-page">${group
          .map(({ player, qr }) => `<div class="print-card-box">${renderWaveLiftPlayerCard(player, qr)}</div>`)
          .join("")}</div>`,
    )
    .join("");
  const images = Array.from(sheet.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  window.print();
}
function dateFromAny(value) {
  if (!value) return "";
  if (typeof value?.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  return "";
}

function timeFromAny(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
}

function updatedTime(entity) {
  return Math.max(
    timeFromAny(entity?.updatedAt),
    timeFromAny(entity?.createdAt),
    timeFromAny(entity?.date),
    timeFromAny(entity?.timestamp),
  );
}

function updatedDate(entity) {
  const time = updatedTime(entity);
  return time ? new Date(time).toISOString().slice(0, 10) : "";
}

function adminPlayerAttendanceRecords(player) {
  return adminData.allAttendance.filter((entry) => attendanceRecordBelongsToPlayer(entry, player));
}

function countedAttendanceRecords(records) {
  const days = new Set();
  records.forEach((entry) => {
    const status = norm(attendanceStatus(entry));
    if (status !== "present" && status !== "late") return;
    const date = firstText(entry?.date, entry?.day, dateFromAny(entry?.createdAt), dateFromAny(entry?.updatedAt));
    days.add(date || String(entry?.id || Math.random()));
  });
  return days.size;
}

function adminUpdateEvents(entity, type, name, sport = "") {
  const events = [];
  const created = timeFromAny(entity?.createdAt);
  const updated = timeFromAny(entity?.updatedAt);
  if (created) {
    events.push({
      type,
      operation: "إضافة",
      name,
      sport,
      date: new Date(created).toISOString().slice(0, 10),
      time: created,
    });
  }
  if (updated && updated !== created) {
    events.push({
      type,
      operation: "تعديل",
      name,
      sport,
      date: new Date(updated).toISOString().slice(0, 10),
      time: updated,
    });
  }
  return events;
}

function ensureRepeatedRows(container, selector, count) {
  const rows = [...(container?.querySelectorAll(selector) || [])];
  const template = rows[0];
  if (!container || !template) return rows;
  while (rows.length < count) {
    const clone = template.cloneNode(true);
    container.appendChild(clone);
    rows.push(clone);
  }
  rows.forEach((row, index) => {
    row.style.display = index < count ? "" : "none";
  });
  return rows.slice(0, count);
}

function adminSection(title) {
  return [...document.querySelectorAll("#adminClub .acc")].find((section) =>
    section.querySelector(".ah-txt b")?.textContent?.trim().includes(title),
  );
}

function setAdminHeaderCount(section, text) {
  const small = section?.querySelector(".ah-txt small");
  if (small) small.textContent = text;
}

function setAdminRow(row, entity, type) {
  if (!row) return;
  row.querySelectorAll("button, input").forEach((control) => {
    control.disabled = false;
  });
  row.dataset.adminType = type;
  row.dataset.adminId =
    type === "player" ? playerKey(entity) :
    type === "coach" ? firstText(entity?.id, entity?.uid, entity?.email) :
    sportValue(entity);
  const name = row.querySelector(".adm-info b, .cr-info b");
  const smalls = [...row.querySelectorAll(".adm-info small, .cr-info small")];
  if (type === "sport") {
    if (name) name.textContent = sportAr(entity) || "رياضة";
    if (smalls[0]) {
      smalls[0].textContent = entity.active === false ? "معطلة" : "مفعّلة";
      smalls[0].classList.toggle("off", entity.active === false);
      smalls[0].classList.toggle("on", entity.active !== false);
    }
    const chips = row.querySelectorAll(".mini .chip");
    if (chips[0]) chips[0].textContent = `${playerCountForSport(entity)} لاعب`;
    if (chips[1]) chips[1].textContent = `${coachCountForSport(entity)} مدرب`;
  } else if (type === "coach") {
    if (row.querySelector(".cr-av")) row.querySelector(".cr-av").textContent = entityInitials(entity?.name || entity?.email);
    if (name) name.textContent = entity?.name || entity?.displayName || "مدرب";
    if (smalls[0]) smalls[0].textContent = sportNameById(entity?.sportId || entity?.sport);
    if (smalls[1]) smalls[1].textContent = entity?.email || "";
  } else {
    const id = playerKey(entity);
    if (row.querySelector(".cr-av")) row.querySelector(".cr-av").textContent = entityInitials(playerName(entity));
    if (name) name.textContent = playerName(entity) || "لاعب";
    if (smalls[0]) smalls[0].textContent = `${entity?.sport || sportNameById(entity?.sportId)} • ${playerGroup(entity) || "فئة غير محددة"}`;
    if (smalls[1]) smalls[1].textContent = id || "PlayerID غير موجود";
    const printBtn = row.querySelector(".ic-print");
    if (printBtn) {
      printBtn.dataset.cardSelect = id;
      printBtn.classList.toggle("selected", selectedCards.has(id));
    }
  }
  row.querySelectorAll(".ic-del").forEach((button) => {
    delete button.dataset.adminDisabled;
    button.dataset.adminDelete = type;
    button.disabled = false;
    button.removeAttribute("aria-disabled");
  });
  row.querySelectorAll(".ic-edit").forEach((button) => {
    button.dataset.adminEdit = type;
  });
  row.querySelectorAll(".ic-card").forEach((button) => {
    button.dataset.adminCard = type;
  });
}

function adminFilteredPlayers() {
  const search = norm(adminPlayerSearch);
  return adminData.players.filter((player) => {
    if (adminPlayerSportFilter && !playerBelongsToSport(player, { id: adminPlayerSportFilter, nameEn: adminPlayerSportFilter, nameAr: sportNameById(adminPlayerSportFilter) })) {
      return false;
    }
    if (adminPlayerGroupFilter && !sameSport(playerGroup(player), adminPlayerGroupFilter)) {
      return false;
    }
    if (!search) return true;
    return [playerName(player), player?.nationalId, player?.identity, playerPhone(player), playerCardNumber(player), playerKey(player), player?.sport, sportNameById(player?.sportId)]
      .some((value) => norm(value).includes(search));
  });
}

function adminFilteredCoaches() {
  const search = norm(adminPlayerSearch);
  return adminData.coaches.filter((coach) => {
    if (adminPlayerSportFilter && !sameSport(coach?.sportId || coach?.sport, adminPlayerSportFilter)) {
      const sport = adminData.sports.find((item) => sameSport(sportValue(item), adminPlayerSportFilter));
      if (!sport || ![sportValue(sport), sportEn(sport), sportAr(sport)].map(norm).includes(norm(coach?.sportId || coach?.sport))) return false;
    }
    if (!search) return true;
    return [coach?.name, coach?.displayName, coach?.email, coach?.phone, coach?.sport, sportNameById(coach?.sportId)]
      .some((value) => norm(value).includes(search));
  });
}

function adminDashboardPlayers() {
  if (!adminDashboardSportFilter) return adminData.players;
  const sport = adminData.sports.find((item) => sameSport(sportValue(item), adminDashboardSportFilter));
  const filter = sport || { id: adminDashboardSportFilter, nameEn: adminDashboardSportFilter, nameAr: sportNameById(adminDashboardSportFilter) };
  return adminData.players.filter((player) => playerBelongsToSport(player, filter));
}

function adminDashboardAttendanceRecords(players) {
  if (!adminDashboardSportFilter) return adminData.attendance;
  const ids = new Set(players.map(playerKey).filter(Boolean).map(String));
  const sport = adminData.sports.find((item) => sameSport(sportValue(item), adminDashboardSportFilter));
  const filter = sport || { id: adminDashboardSportFilter, nameEn: adminDashboardSportFilter, nameAr: sportNameById(adminDashboardSportFilter) };
  return adminData.attendance.filter((entry) =>
    playerBelongsToSport(entry, filter) ||
    ids.has(String(firstText(entry?.playerId, entry?.playerID, entry?.id, entry?.uid))),
  );
}

function renderAdminStatsCards() {
  const view = $("adminDash");
  if (!view) return;
  const globalStats = summarizeAttendance(adminData.attendance);
  const globalTotal = adminData.players.length;
  const globalPresent = globalStats.present + globalStats.late;
  const dashboardPlayers = adminDashboardPlayers();
  const summaryStats = summarizeAttendance(adminDashboardAttendanceRecords(dashboardPlayers));
  const summaryTotal = dashboardPlayers.length;
  const summaryPresent = summaryStats.present + summaryStats.late;
  const globalValuesByLabel = {
    "إجمالي اللاعبين": globalTotal,
    "عدد المدربين": adminData.coaches.length,
    "عدد الرياضات": adminData.sports.length,
    "حضور اليوم": globalPresent,
  };
  const summaryValuesByLabel = {
    "الحاضرون": summaryStats.present,
    "المتأخرون": summaryStats.late,
    "الغائبون": Math.max(summaryTotal - summaryPresent - summaryStats.excused, 0),
    "غياب بعذر": summaryStats.excused,
  };
  view.querySelector(".page-body > .tiles")?.querySelectorAll(".tile").forEach((tile) => {
    const label = tile.querySelector(".tl")?.textContent?.trim();
    const value = tile.querySelector(".tv");
    if (value && Object.prototype.hasOwnProperty.call(globalValuesByLabel, label)) value.textContent = globalValuesByLabel[label];
  });
  view.querySelector(".scard .tiles")?.querySelectorAll(".tile").forEach((tile) => {
    const label = tile.querySelector(".tl")?.textContent?.trim();
    const value = tile.querySelector(".tv");
    if (value && Object.prototype.hasOwnProperty.call(summaryValuesByLabel, label)) value.textContent = summaryValuesByLabel[label];
  });
  const rate = summaryTotal ? `${Math.round((summaryPresent / summaryTotal) * 100)}%` : "0%";
  const pct = view.querySelector(".pctbox .pv");
  if (pct) pct.textContent = rate;
  const date = view.querySelector(".scard-head small");
  if (date) date.textContent = todayKey();
  renderAdminTopFilterLabel();
}

function renderAdminTopFilterLabel() {
  const view = $("adminDash");
  if (!view) return;
  const filterSport = adminData.sports.find((sport) => sameSport(sportValue(sport), adminDashboardSportFilter));
  const label = adminDashboardSportFilter ? sportAr(filterSport) || sportNameById(adminDashboardSportFilter) || adminDashboardSportFilter : "كل الرياضات";
  view.querySelectorAll(".scard .selrow .sel, .mcard .selrow .sel").forEach((select) => {
    setSelectLabel(select, label);
    select.dataset.adminDashboardSportFilter = "1";
    prepareInteractiveSelect(select, "فلترة الرياضة");
  });
}

function renderAdminTopAttendance() {
  const view = $("adminDash");
  const players = adminDashboardPlayers();
  const hasAttendanceRecords = adminData.allAttendance.length > 0;
  const ranked = players
    .map((player) => {
      const records = adminPlayerAttendanceRecords(player);
      const recordCount = countedAttendanceRecords(records);
      const fieldCount = numberValue(player?.attendance, player?.attendanceCount, player?.present, player?.presentCount);
      const totalRecords = records.length;
      return {
        player,
        count: hasAttendanceRecords ? recordCount : fieldCount,
        rateBase: hasAttendanceRecords ? Math.max(totalRecords, recordCount) : fieldCount,
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const rows = ensureRepeatedRows(view?.querySelector(".mcard .mc-scroll"), ".mrank", ranked.length || 1);
  const max = Math.max(...ranked.map((item) => item.count), 1);
  rows.forEach((row, index) => {
    const item = ranked[index];
    if (!item) {
      setText(row.querySelector(".mn"), "");
      setText(row.querySelector(".mi b"), "لا توجد بيانات حضور حالياً");
      setText(row.querySelector(".mi small"), "");
      setText(row.querySelector(".mp"), "");
      const fill = row.querySelector(".mfill");
      if (fill) fill.style.width = "0%";
      return;
    }
    row.querySelector(".mn").textContent = String(index + 1);
    row.querySelector(".mi b").textContent = playerName(item.player) || "لاعب";
    row.querySelector(".mi small").textContent = `${item.count} يوم حضور · ${item.player?.sport || sportNameById(item.player?.sportId)}`;
    const percent = item.rateBase > item.count
      ? Math.round((item.count / item.rateBase) * 100)
      : Math.round((item.count / max) * 100);
    const fill = row.querySelector(".mfill");
    if (fill) fill.style.width = `${percent}%`;
    const pct = row.querySelector(".mp");
    if (pct) pct.textContent = `${percent}%`;
  });
}

function renderAdminRecentFeed() {
  const cards = [...document.querySelectorAll("#adminDash .mcard")];
  const feedBox = cards[1]?.querySelector(".mc-scroll");
  const recent = [
    ...adminData.players.flatMap((player) => adminUpdateEvents(player, "لاعب", playerName(player) || "لاعب", player?.sport || sportNameById(player?.sportId))),
    ...adminData.coaches.flatMap((coach) => adminUpdateEvents(coach, "مدرب", coach?.name || coach?.email || "مدرب", sportNameById(coach?.sportId || coach?.sport))),
    ...adminData.sports.flatMap((item) => adminUpdateEvents(item, "رياضة", sportAr(item) || sportEn(item), sportAr(item) || sportEn(item))),
    ...adminData.announcements.flatMap((item) => adminUpdateEvents(item, "تنبيه", firstText(item?.title, item?.body, "تنبيه عام"), "")),
  ].filter((item) => item.time)
    .sort((a, b) => b.time - a.time)
    .slice(0, 6);
  const rows = ensureRepeatedRows(feedBox, ".mfeed", recent.length || 1);
  rows.forEach((row, index) => {
    const item = recent[index];
    if (!item) {
      setText(row.querySelector(".mf-info b"), "لا توجد تحديثات حالياً");
      row.querySelectorAll(".mf-info small").forEach((small) => { small.textContent = ""; });
      return;
    }
    row.querySelector(".mf-info b").textContent = item.name || item.type;
    const smalls = row.querySelectorAll(".mf-info small");
    if (smalls[0]) smalls[0].textContent = `${item.type}${item.operation ? ` · ${item.operation}` : ""}${item.sport ? ` · ${item.sport}` : ""}`;
    if (smalls[1]) smalls[1].textContent = item.date || "";
  });
}

function renderAdminClubSafe() {
  const sportSection = adminSection("الرياضات");
  const coachSection = adminSection("المدربون");
  const cardSection = adminSection("البطاقات");
  setAdminHeaderCount(sportSection, `${adminData.sports.length} رياضة مسجلة`);
  setAdminHeaderCount(coachSection, `${adminData.coaches.length} مدرب في النظام`);
  setAdminHeaderCount(cardSection, `${adminData.players.length} بطاقة لاعب`);

  ensureRepeatedRows(sportSection?.querySelector(".acc-body"), ".adm-row", adminData.sports.length)
    .forEach((row, index) => setAdminRow(row, adminData.sports[index], "sport"));
  ensureRepeatedRows(coachSection?.querySelector(".acc-body"), ".adm-row", adminData.coaches.length)
    .forEach((row, index) => setAdminRow(row, adminData.coaches[index], "coach"));

  const cardBody = cardSection?.querySelector(".acc-body");
  const tabButtons = [...(cardBody?.querySelectorAll(".segtabs .seg") || [])];
  tabButtons.forEach((button, index) => {
    button.dataset.adminCardsTab = index === 1 ? "coaches" : "players";
    button.classList.toggle("on", (index === 1 ? "coaches" : "players") === adminCardsTab);
  });
  const rowsSource = adminCardsTab === "coaches" ? adminFilteredCoaches().slice(0, 100) : adminFilteredPlayers().slice(0, 100);
  const rowsType = adminCardsTab === "coaches" ? "coach" : "player";
  const note = cardBody?.querySelector(".mini-note");
  if (note) note.textContent = adminCardsTab === "coaches" ? `${adminData.coaches.length} مدرب مسجل` : `${adminData.players.length} لاعب مسجل`;
  const input = cardBody?.querySelector(".search input");
  if (input) {
    input.dataset.adminPlayerSearch = "1";
    input.placeholder = adminCardsTab === "coaches" ? "بحث عن مدرب" : "بحث عن لاعب";
    if (document.activeElement !== input) input.value = adminPlayerSearch;
  }
  const print = cardBody?.querySelector(".print-btn");
  if (print) {
    print.dataset.printSelected = "1";
    const printLabel = selectedCards.size ? `طباعة ${selectedCards.size} بطاقات` : "طباعة كل البطاقات";
    const printText = [...print.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (printText) printText.textContent = printLabel;
    else print.append(document.createTextNode(printLabel));
    print.classList.toggle("has-selection", selectedCards.size > 0);
  }
  const reset = cardBody?.querySelector(".reset-btn");
  if (reset) {
    reset.dataset.resetSelectedCards = "1";
    reset.disabled = selectedCards.size === 0;
  }
  const sportFilter = cardBody?.querySelector(".selrow .sel");
  if (sportFilter) {
    const filterSport = adminData.sports.find((sport) => sameSport(sportValue(sport), adminPlayerSportFilter));
    const label = adminPlayerSportFilter ? sportAr(filterSport) || sportNameById(adminPlayerSportFilter) || adminPlayerSportFilter : "كل الرياضات";
    const text = sportFilter.childNodes[0];
    if (text?.nodeType === Node.TEXT_NODE) text.textContent = label;
    else sportFilter.prepend(document.createTextNode(label));
    sportFilter.dataset.adminSportFilterCycle = "1";
    prepareInteractiveSelect(sportFilter, "فلترة البطاقات حسب الرياضة");
  }
  const groupRow = cardBody?.querySelector(".selrow.group-row");
  const groupFilter = groupRow?.querySelector(".sel");
  if (groupRow) groupRow.style.display = adminCardsTab === "coaches" ? "none" : "";
  if (groupFilter) {
    const label = adminPlayerGroupFilter || "كل الفئات";
    const text = groupFilter.childNodes[0];
    if (text?.nodeType === Node.TEXT_NODE) text.textContent = label;
    else groupFilter.prepend(document.createTextNode(label));
    groupFilter.dataset.adminGroupFilterCycle = "1";
    prepareInteractiveSelect(groupFilter, "فلترة البطاقات حسب الفئة");
  }
  const sel = cardBody?.querySelector(".selall input");
  if (sel) sel.dataset.selectAllCards = "1";
  const selAll = cardBody?.querySelector(".selall");
  if (selAll) selAll.style.display = adminCardsTab === "coaches" ? "none" : "";
  const selRow = cardBody?.querySelector(".selrow");
  if (selRow) selRow.classList.toggle("coach-tab", adminCardsTab === "coaches");
  if (print) print.style.display = adminCardsTab === "coaches" ? "none" : "";
  const selectedCount = cardBody?.querySelector(".selall em");
  if (selectedCount) selectedCount.textContent = `${selectedCards.size} محدد`;
  if (sel && adminCardsTab === "players") {
    const visiblePlayers = adminFilteredPlayers();
    sel.checked = visiblePlayers.length > 0 && visiblePlayers.every((player) => selectedCards.has(playerKey(player)));
  }
  ensureRepeatedRows(cardBody, ".card-row", rowsSource.length || 1)
    .forEach((row, index) => {
      const entity = rowsSource[index];
      if (entity) {
        row.style.display = "";
        setAdminRow(row, entity, rowsType);
      } else {
        row.style.display = index === 0 ? "" : "none";
        setAdminRow(row, { id: "", name: "لا توجد بيانات حالياً", sport: "", email: "" }, rowsType);
        row.querySelectorAll("button, input").forEach((control) => {
          control.disabled = true;
          control.removeAttribute("data-admin-card");
          control.removeAttribute("data-admin-edit");
          control.removeAttribute("data-admin-delete");
          control.removeAttribute("data-admin-print-one");
          control.removeAttribute("data-card-select");
        });
      }
    });
}

function selectedSettingsSport() {
  return adminData.sports.find((sport) => String(sportValue(sport)) === String(adminSelectedSettingsSportId)) || adminData.sports[0];
}

function currentSettingsTimes() {
  const sport = selectedSettingsSport();
  return sport?.categoryTimes?.[categoryTimeKey(adminSelectedSettingsGroup)] || sport?.attendanceTimes || {};
}

function renderAdminSettingsSafe() {
  const view = $("adminSettings");
  if (!view) return;
  if (!adminSelectedSettingsSportId) adminSelectedSettingsSportId = sportValue(adminData.sports[0]) || "";
  const sport = selectedSettingsSport();
  const selrow = view.querySelector(".selrow");
  const sel = selrow?.querySelector(".sel");
  if (sel) {
    const text = sel.childNodes[0];
    if (text?.nodeType === Node.TEXT_NODE) text.textContent = sportAr(sport) || "اختر الرياضة";
    else sel.prepend(document.createTextNode(sportAr(sport) || "اختر الرياضة"));
    sel.dataset.settingsSportCycle = "1";
    prepareInteractiveSelect(sel, "اختيار رياضة إعدادات الحضور");
  }
  let groupSel = selrow?.querySelector("[data-settings-group-cycle]");
  if (selrow && sel && !groupSel) {
    groupSel = sel.cloneNode(true);
    groupSel.removeAttribute("data-settings-sport-cycle");
    groupSel.dataset.settingsGroupCycle = "1";
    selrow.appendChild(groupSel);
  }
  if (groupSel) {
    prepareInteractiveSelect(groupSel, "اختيار فئة إعدادات الحضور");
    const text = groupSel.childNodes[0];
    const groupLabel = adminSelectedSettingsGroup || "فئة الكبار";
    if (text?.nodeType === Node.TEXT_NODE) text.textContent = groupLabel;
    else groupSel.prepend(document.createTextNode(groupLabel));
  }
  const rows = view.querySelectorAll(".time-row");
  const times = currentSettingsTimes();
  const lateStartValue = firstText(times.lateStart, times.late);
  rows.forEach((row) => {
    const span = row.querySelector(".tr-time span");
    if (span) span.textContent = lateStartValue || "--:--";
    row.dataset.timeField = "lateStart";
  });
  const save = view.querySelector(".bigbtn");
  if (save) save.dataset.saveAttendanceSettings = "1";
  const infoRows = view.querySelectorAll(".info-row .iv");
  if (infoRows[1]) infoRows[1].textContent = todayKey();
}

async function renderAdminAllSafe() {
  await loadAdminData();
  renderAdminStatsCards();
  renderAdminTopAttendance();
  renderAdminRecentFeed();
  renderAdminClubSafe();
  renderAdminSettingsSafe();
}

function ensureBridgeFormModal() {
  let modal = $("bridgeFormModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "bridgeFormModal";
  modal.className = "modal";
  const card = document.createElement("div");
  card.className = "modal-card";
  const close = document.createElement("button");
  close.className = "modal-x";
  close.type = "button";
  close.dataset.bridgeFormClose = "1";
  close.setAttribute("aria-label", "إغلاق");
  close.textContent = "×";
  const icon = document.createElement("div");
  icon.className = "modal-ico";
  icon.textContent = "+";
  const title = document.createElement("h3");
  title.dataset.bridgeFormTitle = "1";
  const intro = document.createElement("p");
  intro.dataset.bridgeFormIntro = "1";
  const fields = document.createElement("div");
  fields.dataset.bridgeFormFields = "1";
  const message = document.createElement("p");
  message.className = "bridge-message";
  message.dataset.bridgeFormMessage = "1";
  const actions = document.createElement("div");
  actions.className = "bridge-actions";
  actions.dataset.bridgeFormActions = "1";
  const save = document.createElement("button");
  save.className = "btn";
  save.type = "button";
  save.dataset.bridgeFormSave = "1";
  save.textContent = "حفظ";
  card.appendChild(close);
  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(intro);
  card.appendChild(fields);
  card.appendChild(message);
  card.appendChild(actions);
  card.appendChild(save);
  modal.appendChild(card);
  document.querySelector(".screen")?.appendChild(modal);
  return modal;
}

function createBridgeFormField(field) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("label");
  label.textContent = field.label;
  label.setAttribute("for", `bridge-${field.name}`);
  let input;
  if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.className = "ta-input";
  } else if (field.type === "select") {
    input = document.createElement("select");
    input.className = "input";
    (field.options || []).forEach((option) => {
      const optionEl = document.createElement("option");
      const value = typeof option === "string" ? option : option.value;
      const text = typeof option === "string" ? option : option.label;
      optionEl.value = value;
      optionEl.textContent = text;
      input.appendChild(optionEl);
    });
  } else {
    input = document.createElement("input");
    input.className = "input";
  }
  input.id = `bridge-${field.name}`;
  input.dataset.bridgeFormField = field.name;
  if (field.type && field.type !== "textarea" && field.type !== "select") input.type = field.type;
  if (field.type === "date" || field.type === "time") input.setAttribute("dir", "ltr");
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.type === "checkbox") {
    input.checked = Boolean(field.checked ?? field.value);
    input.className = "";
  } else {
    input.value = field.value ?? "";
  }
  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
}

function bridgeForm(title, fields, intro = "", actions = []) {
  return new Promise((resolve) => {
    const modal = ensureBridgeFormModal();
    const fieldsBox = modal.querySelector("[data-bridge-form-fields]");
    const message = modal.querySelector("[data-bridge-form-message]");
    const actionsBox = modal.querySelector("[data-bridge-form-actions]");
    const save = modal.querySelector("[data-bridge-form-save]");
    const close = modal.querySelector("[data-bridge-form-close]");
    modal.querySelector("[data-bridge-form-title]").textContent = title;
    modal.querySelector("[data-bridge-form-intro]").textContent = intro;
    message.textContent = "";
    clearNode(fieldsBox);
    clearNode(actionsBox);
    fields.forEach((field) => fieldsBox.appendChild(createBridgeFormField(field)));
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action.className || "ghostbtn";
      button.textContent = action.label;
      button.addEventListener("click", () => action.onClick?.(modal, message));
      actionsBox.appendChild(button);
    });
    const cleanup = (value) => {
      save.removeEventListener("click", onSave);
      close.removeEventListener("click", onCancel);
      modal.classList.remove("show");
      resolve(value);
    };
    const onCancel = () => cleanup(null);
    const onSave = () => {
      const values = Object.fromEntries(
        [...modal.querySelectorAll("[data-bridge-form-field]")].map((input) => [
          input.dataset.bridgeFormField,
          input.type === "checkbox" ? input.checked : input.value.trim(),
        ]),
      );
      const missing = fields.find((field) => field.required && !values[field.name]);
      if (missing) {
        msg(message, `أكمل حقل ${missing.label}`, "error");
        return;
      }
      cleanup(values);
    };
    save.addEventListener("click", onSave);
    close.addEventListener("click", onCancel);
    modal.classList.add("show");
    modal.querySelector("[data-bridge-form-field]")?.focus();
  });
}

async function addPlayerFromAdminPrompt() {
  const sportOptions = sportsCatalog.length
    ? sportsCatalog.map((sport) => sportAr(sport))
    : [sportNameAr()];
  const groupOptions = ["فئة الكبار", "فئة الشباب", "فئة الناشئين", "فئة البراعم"];
  const values = await bridgeForm("إضافة لاعب", [
    { name: "name", label: "اسم اللاعب", required: true },
    { name: "nationalId", label: "رقم الهوية", required: true },
    { name: "phone", label: "رقم الجوال", type: "tel" },
    { name: "birthDate", label: "تاريخ الميلاد", type: "date" },
    { name: "weight", label: "الوزن", type: "number" },
    { name: "sport", label: "الرياضة", type: "select", options: sportOptions, value: sportNameAr() },
    { name: "group", label: "الفئة", type: "select", options: groupOptions, value: groupOptions[0] },
  ], "سيتم إرسال اللاعب عبر Web App فقط");
  if (!values) return;
  const result = await addPlayerViaWebApp(values);
  if (!isOkWebAppResult(result)) return toast(result?.message || "تعذر إضافة اللاعب عبر Web App");
  toast("تم إرسال اللاعب عبر Web App");
  if (activeAdminProfile) {
    await renderAdminAllSafe();
    return;
  }
  await refreshPlayersDirectory().catch(() => {});
  await renderCoachDashboard().catch(() => {});
  const activeAttendanceView = document.querySelector("#attendance.view.active, #gymAttendance.view.active");
  if (activeAttendanceView) await renderAttendancePage(activeAttendanceView.id).catch(() => {});
}

async function addCoachFromAdminPrompt() {
  const values = await bridgeForm("إضافة مدرب", [
    { name: "name", label: "اسم المدرب", required: true },
    { name: "email", label: "البريد الإلكتروني", type: "email", required: true },
    { name: "phone", label: "رقم الجوال", type: "tel" },
    { name: "sportId", label: "SportID", value: sportId(), required: true },
    { name: "password", label: "كلمة المرور", type: "password", placeholder: DEFAULT_COACH_PASSWORD },
  ], "إذا تركت كلمة المرور فارغة سيتم استخدام كلمة المرور الافتراضية");
  if (!values) return;
  const email = values.email.trim().toLowerCase();
  const password = values.password || DEFAULT_COACH_PASSWORD;
  let account;
  try {
    account = await createCoachAuthViaRest(email, password);
  } catch (error) {
    toast(error?.message || "فشل إنشاء حساب Auth");
    return;
  }
  await addCoach({
    id: account.uid,
    uid: account.uid,
    authUid: account.uid,
    name: values.name,
    email,
    phone: values.phone,
    sportId: values.sportId,
    active: true,
    role: "coach",
  });
  toast("تم إنشاء حساب المدرب وربطه بالرياضة");
  await renderAdminAllSafe();
}

async function addSportFromAdminPrompt() {
  const values = await bridgeForm("إضافة رياضة", [
    { name: "nameAr", label: "اسم الرياضة بالعربي", required: true },
    { name: "nameEn", label: "اسم الرياضة بالإنجليزي", required: true },
    { name: "sportId", label: "SportID", required: true },
  ]);
  if (!values) return;
  await addSport({
    id: values.sportId,
    sportId: values.sportId,
    nameAr: values.nameAr,
    nameEn: values.nameEn,
    sport: values.nameAr,
    active: true,
  });
  toast("تم إضافة الرياضة");
  await loadHomeData().catch(() => {});
  await renderAdminAllSafe();
}

function ensureAnnouncementManagerModal() {
  let modal = $("announcementManagerModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "announcementManagerModal";
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-card ann-card">
      <button class="modal-x" type="button" data-ann-close aria-label="إغلاق">×</button>
      <div class="ann-head">
        <div>
          <small>التنبيهات العامة</small>
          <h3 data-ann-title>نشر تنبيه عام</h3>
        </div>
        <button class="ann-new-link" type="button" data-ann-new>تنبيه جديد</button>
      </div>
      <div class="ann-list" data-ann-list></div>
      <div class="ann-divider"></div>
      <div class="field">
        <label>عنوان التنبيه (اختياري)</label>
        <input class="input" type="text" data-ann-field-title maxlength="100" />
      </div>
      <div class="field">
        <label>نص الملاحظة أو التنبيه</label>
        <textarea class="ta-input" rows="3" data-ann-field-body maxlength="1000"></textarea>
      </div>
      <p class="bridge-message" data-ann-message></p>
      <div class="ann-footer">
        <button class="ann-cancel" type="button" data-ann-close>إلغاء</button>
        <button class="btn" type="button" data-ann-save>نشر</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function renderAnnouncementManagerList(modal) {
  const list = modal.querySelector("[data-ann-list]");
  const items = [...adminData.announcements].sort((left, right) => {
    const time = (value) => value?.updatedAt?.seconds || value?.createdAt?.seconds || 0;
    return time(right) - time(left);
  });
  list.innerHTML = items.length
    ? items
        .map(
          (item) => `<article class="ann-row">
            <div>
              <b>${escapeHtml(firstText(item.title, "تنبيه عام"))}</b>
              <p>${escapeHtml(firstText(item.body, ""))}</p>
              <time>${escapeHtml(formatAnnouncementDate(item.updatedAt || item.createdAt))}</time>
            </div>
            <div class="ann-row-actions">
              <button type="button" data-ann-edit="${escapeHtml(item.id)}" aria-label="تعديل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="danger" type="button" data-ann-delete="${escapeHtml(item.id)}" aria-label="حذف التنبيه"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 16h10l1-16"/><path d="M10 11v6"/><path d="M14 11v6"/></svg><span>حذف</span></button>
            </div>
          </article>`,
        )
        .join("")
    : '<p class="ann-empty">لا توجد تنبيهات منشورة حالياً</p>';
}

function fillAnnouncementForm(modal, item) {
  modal.querySelector("[data-ann-title]").textContent = item ? "تعديل التنبيه" : "نشر تنبيه عام";
  modal.querySelector("[data-ann-field-title]").value = item ? firstText(item.title, "") : "";
  modal.querySelector("[data-ann-field-body]").value = item ? firstText(item.body, "") : "";
  modal.querySelector("[data-ann-save]").textContent = item ? "حفظ" : "نشر";
  modal.dataset.annEditingId = item?.id || "";
  modal.querySelector("[data-ann-message]").textContent = "";
}

async function openAnnouncementManager() {
  const modal = ensureAnnouncementManagerModal();
  await loadAdminData().catch(() => {});
  renderAnnouncementManagerList(modal);
  fillAnnouncementForm(modal, null);
  modal.classList.add("show");
}

async function saveAnnouncementFromManager(modal) {
  const body = modal.querySelector("[data-ann-field-body]").value.trim();
  const message = modal.querySelector("[data-ann-message]");
  if (!body) return msg(message, "اكتب نص التنبيه", "error");
  const title = modal.querySelector("[data-ann-field-title]").value.trim();
  const id = modal.dataset.annEditingId || undefined;
  const save = modal.querySelector("[data-ann-save]");
  save.disabled = true;
  try {
    await saveAnnouncement({ id, title, body, active: true });
    toast(id ? "تم حفظ التعديل" : "تم نشر التنبيه");
    await loadAdminData().catch(() => {});
    await loadHomeAnnouncements().catch(() => {});
    renderAnnouncementManagerList(modal);
    fillAnnouncementForm(modal, null);
  } catch (error) {
    msg(message, error?.message || "تعذر نشر التنبيه", "error");
  } finally {
    save.disabled = false;
  }
}

async function deleteAnnouncementFromManager(modal, id) {
  if (!confirm("تأكيد حذف التنبيه؟")) return;
  try {
    await deleteAnnouncement(id);
    toast("تم حذف التنبيه");
    adminData.announcements = adminData.announcements.filter((item) => String(item.id) !== String(id));
    await loadHomeAnnouncements().catch(() => {});
    renderAnnouncementManagerList(modal);
    if (modal.dataset.annEditingId === id) fillAnnouncementForm(modal, null);
  } catch (error) {
    toast(error?.message || "تعذر حذف التنبيه");
  }
}

document.addEventListener("click", (event) => {
  const modal = $("announcementManagerModal");
  if (!modal) return;
  if (event.target.closest("[data-ann-close]") || event.target === modal) {
    modal.classList.remove("show");
    return;
  }
  if (event.target.closest("[data-ann-new]")) {
    fillAnnouncementForm(modal, null);
    return;
  }
  if (event.target.closest("[data-ann-save]")) {
    saveAnnouncementFromManager(modal);
    return;
  }
  const editButton = event.target.closest("[data-ann-edit]");
  if (editButton) {
    const item = adminData.announcements.find((entry) => String(entry.id) === editButton.dataset.annEdit);
    if (item) fillAnnouncementForm(modal, item);
    return;
  }
  const deleteButton = event.target.closest("[data-ann-delete]");
  if (deleteButton) {
    deleteAnnouncementFromManager(modal, deleteButton.dataset.annDelete);
  }
});

async function editPlayerFromAdminPrompt(playerId) {
  const player = adminData.players.find((item) => String(playerKey(item)) === String(playerId));
  if (!player) return toast("لم يتم العثور على اللاعب");
  const values = await bridgeForm("تعديل لاعب", [
    { name: "name", label: "اسم اللاعب", value: playerName(player), required: true },
    { name: "phone", label: "رقم الجوال", value: playerPhone(player), type: "tel" },
    { name: "birthDate", label: "تاريخ الميلاد", value: player?.birthDate || "", type: "date" },
    { name: "weight", label: "الوزن", value: player?.weight || "", type: "number" },
    { name: "sport", label: "الرياضة", value: player?.sport || sportNameById(player?.sportId) },
    { name: "group", label: "الفئة", value: playerGroup(player) },
  ], "التعديل سيتم عبر Web App ولن يمسح الحضور أو النقاط");
  if (!values) return;
  const result = await updatePlayerViaWebApp(playerId, values);
  if (!isOkWebAppResult(result)) return toast(result?.message || "تعذر تعديل اللاعب عبر Web App");
  toast("تم إرسال تعديل اللاعب عبر Web App");
  await renderAdminAllSafe();
}

async function editCoachFromAdminPrompt(coachId) {
  const coach = adminData.coaches.find((item) => String(firstText(item?.id, item?.uid, item?.email)) === String(coachId));
  if (!coach) return toast("لم يتم العثور على المدرب");
  const values = await bridgeForm("تعديل مدرب", [
    { name: "name", label: "اسم المدرب", value: coach?.name || "", required: true },
    { name: "email", label: "البريد الإلكتروني", value: coach?.email || "", type: "email", required: true },
    { name: "phone", label: "رقم الجوال", value: coach?.phone || "", type: "tel" },
    { name: "sportId", label: "SportID", value: coach?.sportId || coach?.sport || "", required: true },
    { name: "active", label: "الحساب نشط", type: "checkbox", checked: coach.active !== false },
  ], "لا يتم حفظ كلمة المرور داخل Firestore", [
    {
      label: "إرسال رابط تغيير كلمة المرور",
      onClick: async (_modal, message) => {
        const email = String(coach.email || "").trim().toLowerCase();
        if (!email) return msg(message, "لا يوجد بريد إلكتروني لهذا المدرب", "error");
        try {
          await resetPassword(email);
          msg(message, "تم إرسال رابط تغيير كلمة المرور");
        } catch (error) {
          msg(message, error?.message || "تعذر إرسال رابط تغيير كلمة المرور", "error");
        }
      },
    },
  ]);
  if (!values) return;
  await updateCoach(coachId, {
    name: values.name,
    email: values.email.trim().toLowerCase(),
    phone: values.phone,
    sportId: values.sportId,
    active: Boolean(values.active),
    role: "coach",
  });
  toast("تم تعديل المدرب");
  await renderAdminAllSafe();
}

async function editSportFromAdminPrompt(id) {
  const sport = adminData.sports.find((item) => String(sportValue(item)) === String(id));
  if (!sport) return toast("لم يتم العثور على الرياضة");
  const values = await bridgeForm("تعديل رياضة", [
    { name: "nameAr", label: "اسم الرياضة بالعربي", value: sportAr(sport), required: true },
    { name: "nameEn", label: "اسم الرياضة بالإنجليزي", value: sportEn(sport), required: true },
  ]);
  if (!values) return;
  await updateSport(id, { id, sportId: id, nameAr: values.nameAr, nameEn: values.nameEn, active: sport.active !== false });
  toast("تم تعديل الرياضة");
  await renderAdminAllSafe();
}

function playerByAdminRow(row) {
  const id = row?.dataset.adminId;
  return adminData.players.find((player) => String(playerKey(player)) === String(id));
}

function cycleAdminPlayerSportFilter() {
  const ids = ["", ...adminData.sports.map(sportValue).filter(Boolean)];
  const current = ids.indexOf(adminPlayerSportFilter);
  adminPlayerSportFilter = ids[(Math.max(current, 0) + 1) % ids.length] || "";
  selectedCards.clear();
  renderAdminClubSafe();
}

function setAdminPlayerSportFilter(value) {
  adminPlayerSportFilter = value || "";
  selectedCards.clear();
  renderAdminClubSafe();
}

function setAdminPlayerGroupFilter(value) {
  adminPlayerGroupFilter = value || "";
  selectedCards.clear();
  renderAdminClubSafe();
}

function setAdminDashboardSportFilter(value) {
  adminDashboardSportFilter = value || "";
  renderAdminStatsCards();
  renderAdminTopAttendance();
}

function setAdminSettingsSport(value) {
  adminSelectedSettingsSportId = value || "";
  renderAdminSettingsSafe();
}

function setAdminSettingsGroup(value) {
  adminSelectedSettingsGroup = value || adminSelectedSettingsGroup;
  renderAdminSettingsSafe();
}

function printSinglePlayerCard(player) {
  if (!player) return toast("لم يتم العثور على اللاعب");
  printCards([player]).catch((error) => toast(error?.message || "تعذر طباعة البطاقة"));
}

async function confirmPermanentDelete(name = "") {
  const values = await bridgeForm("تأكيد الحذف النهائي", [
    {
      name: "confirm",
      label: "اكتب: حذف نهائي",
      placeholder: "حذف نهائي",
      required: true,
    },
  ], `سيتم حذف ${name || "العنصر"} نهائياً ولا يمكن التراجع`);
  return values?.confirm === "حذف نهائي";
}

function coachBelongsToSport(coach, sport) {
  return sameSport(coach?.sportId || coach?.sport, sportValue(sport)) ||
    sameSport(coach?.sportId || coach?.sport, sportEn(sport)) ||
    sameSport(coach?.sportId || coach?.sport, sportAr(sport));
}

async function deleteAdminEntity(type, id) {
  if (!type || !id) return toast("لم يتم تحديد العنصر");
  if (type === "player") {
    const player = adminData.players.find((item) => String(playerKey(item)) === String(id));
    if (!player) return toast("لم يتم العثور على اللاعب");
    if (!await confirmPermanentDelete(playerName(player) || "اللاعب")) return toast("لم يتم الحذف");
    const result = await deletePlayerViaWebApp(id);
    if (!result?.ok) throw new Error(result?.message || "تعذر حذف اللاعب من Players_Master و Firebase");
    toast("تم حذف اللاعب نهائياً");
  } else if (type === "coach") {
    const coach = adminData.coaches.find((item) => String(firstText(item?.id, item?.uid, item?.email)) === String(id));
    if (!coach) return toast("لم يتم العثور على المدرب");
    if (!await confirmPermanentDelete(coach?.name || coach?.email || "المدرب")) return toast("لم يتم الحذف");
    await deleteCoach(id);
    toast("تم حذف المدرب نهائياً");
  } else if (type === "sport") {
    const sport = adminData.sports.find((item) => String(sportValue(item)) === String(id));
    if (!sport) return toast("لم يتم العثور على الرياضة");
    const linkedPlayers = adminData.players.filter((player) => playerBelongsToSport(player, sport));
    const linkedCoaches = adminData.coaches.filter((coach) => coachBelongsToSport(coach, sport));
    if (linkedPlayers.length || linkedCoaches.length) {
      toast("لا يمكن حذف الرياضة لأنها مرتبطة بلاعبين أو مدربين");
      return;
    }
    if (!await confirmPermanentDelete(sportAr(sport) || sportEn(sport) || "الرياضة")) return toast("لم يتم الحذف");
    await deleteSport(id);
    toast("تم حذف الرياضة نهائياً");
  } else {
    return toast("نوع الحذف غير معروف");
  }
  selectedCards.clear();
  await loadHomeData().catch(() => {});
  await renderAdminAllSafe();
}

async function resetSelectedPlayersAttendance() {
  if (!selectedCards.size) return toast("حدد لاعب واحد على الأقل أولاً");
  const players = adminData.players.filter((player) => selectedCards.has(playerKey(player)));
  if (!players.length) return toast("لم يتم العثور على اللاعبين المحددين");
  const ids = [...new Set(players.map((player) => String(playerKey(player) || "").trim()))].filter(Boolean);
  if (ids.length !== players.length) {
    return toast("تعذر التصفير: بعض اللاعبين المحددين بلا معرّف صالح");
  }
  const names = players.map((player) => playerName(player) || "لاعب").join("، ");
  const confirmed = await bridgeForm(
    "تأكيد التصفير",
    [],
    `سيتم حذف سجل الحضور والتأخير والأعذار فقط (بدون أي تأثير على بيانات اللاعب) لهؤلاء اللاعبين: ${names}. هذا الإجراء لا يمكن التراجع عنه.`,
  );
  if (!confirmed) return;
  const idSet = new Set(ids);
  const allRecords = await getAttendanceRecords({}).catch(() => []);
  const recordsToDelete = allRecords.filter((entry) => {
    const recordPlayerId = String(entry?.playerId || "").trim();
    return recordPlayerId && idSet.has(recordPlayerId);
  });
  await Promise.all(recordsToDelete.map((entry) => deleteAttendanceRecordById(entry.id).catch(() => {})));
  todayAttendance = todayAttendance.filter((entry) => !idSet.has(String(entry?.playerId || "").trim()));
  toast(`تم حذف سجل الحضور لعدد ${players.length} لاعب`);
  selectedCards.clear();
  await loadAdminData().catch(() => {});
  await renderAdminAllSafe();
}

function ensurePlayerCardModal() {
  let modal = $("bridgePlayerCardModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "bridgePlayerCardModal";
  modal.className = "modal";
  const card = document.createElement("div");
  card.className = "modal-card";
  const close = document.createElement("button");
  close.className = "modal-x";
  close.type = "button";
  close.id = "bridgePlayerCardClose";
  close.setAttribute("aria-label", "إغلاق");
  close.textContent = "×";
  const icon = document.createElement("div");
  icon.className = "modal-ico";
  icon.appendChild(document.createTextNode("ID"));
  const title = document.createElement("h3");
  title.textContent = "بطاقة اللاعب";
  const body = document.createElement("div");
  body.className = "player-card-preview";
  body.dataset.playerCardBody = "1";
  const print = document.createElement("button");
  print.className = "btn";
  print.id = "bridgePlayerCardPrint";
  print.type = "button";
  print.textContent = "طباعة البطاقة";
  card.appendChild(close);
  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(print);
  modal.appendChild(card);
  document.querySelector(".screen")?.appendChild(modal);
  return modal;
}

const WAVE_ID_DESIGN_WIDTH = 860;

function fitWaveIdCardScale(body) {
  const card = body.querySelector(".wave-id-card");
  if (!card) return;
  card.style.width = `${WAVE_ID_DESIGN_WIDTH}px`;
  card.style.transform = "none";
  const naturalHeight = card.offsetHeight || WAVE_ID_DESIGN_WIDTH / 1.6;
  const screenEl = body.closest(".screen") || document.querySelector(".screen");
  const containerWidth = screenEl ? screenEl.clientWidth : document.documentElement.clientWidth;
  const availableWidth = containerWidth - 56;
  const scale = Math.min(1, availableWidth / WAVE_ID_DESIGN_WIDTH);
  card.style.transform = `scale(${scale})`;
  body.style.width = `${WAVE_ID_DESIGN_WIDTH * scale}px`;
  body.style.height = `${naturalHeight * scale}px`;
}

async function openPlayerCardModal(player) {
  if (!player) return toast("لم يتم العثور على اللاعب");
  const modal = ensurePlayerCardModal();
  modal.dataset.playerId = playerKey(player);
  const body = modal.querySelector("[data-player-card-body]");
  clearNode(body);
  body.classList.remove("player-card-preview");
  body.classList.add("wave-id-scale-viewport");
  const qr = await playerCardQrImageBridge(player);
  body.innerHTML = renderWaveLiftPlayerCard(player, qr);
  modal.classList.add("show");
  requestAnimationFrame(() => fitWaveIdCardScale(body));
}

window.addEventListener("resize", () => {
  const modal = $("bridgePlayerCardModal");
  if (!modal || !modal.classList.contains("show")) return;
  const body = modal.querySelector("[data-player-card-body]");
  if (body) fitWaveIdCardScale(body);
});
function cycleAdminSettingsSport() {
  if (!adminData.sports.length) return;
  const ids = adminData.sports.map(sportValue).filter(Boolean);
  const current = ids.indexOf(adminSelectedSettingsSportId);
  adminSelectedSettingsSportId = ids[(Math.max(current, 0) + 1) % ids.length];
  renderAdminSettingsSafe();
}

function cycleAdminSettingsGroup() {
  const groups = ["فئة الكبار", "فئة الشباب", "فئة الناشئين", "فئة البراعم"];
  const current = groups.indexOf(adminSelectedSettingsGroup);
  adminSelectedSettingsGroup = groups[(Math.max(current, 0) + 1) % groups.length];
  renderAdminSettingsSafe();
}

async function editAdminSettingsTime(row) {
  const field = row?.dataset.timeField;
  if (!field) return;
  const current = row.querySelector(".tr-time span")?.textContent?.trim();
  const label = row.querySelector(".tr-txt b")?.textContent?.trim() || "الوقت";
  const values = await bridgeForm(label, [
    { name: "value", label, type: "time", value: current === "--:--" ? "" : current },
  ]);
  if (!values) return;
  const span = row.querySelector(".tr-time span");
  if (span) span.textContent = values.value || "--:--";
}

async function saveAdminSettingsFromDesign() {
  const sport = selectedSettingsSport();
  if (!sport) return toast("اختر الرياضة");
  const lateStartSpan = document.querySelector("#adminSettings .time-row .tr-time span");
  const lateStartValue = lateStartSpan?.textContent?.trim();
  const times = { ...currentSettingsTimes(), lateStart: lateStartValue === "--:--" ? "" : lateStartValue };
  const categoryTimes = { ...(sport.categoryTimes || {}), [categoryTimeKey(adminSelectedSettingsGroup)]: times };
  await saveSportSettings({
    id: sportValue(sport),
    sportId: sportValue(sport),
    sport: sportAr(sport),
    nameAr: sportAr(sport),
    nameEn: sportEn(sport),
    categoryTimes,
  });
  toast("تم حفظ إعدادات الحضور");
  await renderAdminAllSafe();
}

async function activateView(id) {
  if (id === "attendance") await renderAttendancePage("attendance").catch(() => {});
  if (id === "gymAttendance") await renderAttendancePage("gymAttendance").catch(() => {});
  if (id === "weekly") await renderWeeklyPage().catch(() => {});
  if (id === "gymTraining") await renderDailyWorkoutManager().catch(() => {});
  if (id === "adminDash" || id === "adminClub" || id === "adminSettings") await renderAdminDashboard().catch(() => {});
  window.go?.(id);
}

async function renderAdminDashboard() {
  await renderAdminAllSafe();
}

function coachLoginErrorMessage(error) {
  const code = error?.code || "";
  const message = error?.message || "";
  if (code === "auth/invalid-email") return "صيغة البريد الإلكتروني غير صحيحة";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (code === "auth/user-disabled") return "تم تعطيل الحساب";
  if (code === "auth/too-many-requests") return "تم إيقاف المحاولات مؤقتاً. حاول لاحقاً";
  if (message.includes("permission")) return "ليست لديك صلاحية الدخول";
  return "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى";
}

async function handlePlayerLogin(button) {
  const output = ensureMessage(button, "bridgePlayerMsg");
  const code = $("code")?.value.trim();
  if (!code) return msg(output, "أدخل رمز الدخول", "error");
  button.disabled = true;
  try {
    await refreshPlayersDirectory();
    const player = findPlayerByCode(code, playersDirectory);
    if (player) {
      if (!playerBelongsToSport(player, { id: sportId(), nameEn: sportNameEn(), nameAr: sportNameAr() })) {
        return msg(output, "هذا اللاعب لا يتبع الرياضة المختارة", "error");
      }
      activePlayer = player;
      updateSessionUi();
      msg(output, "تم دخول اللاعب");
      await renderPlayerDashboard(player);
      window.closeSheet?.();
      setTimeout(() => window.go?.("player"), 120);
      return;
    }
    const expected = String(selectedSportSettings?.sportCode || state.sportCode || DEFAULT_SPORT_CODE).toUpperCase();
    if (String(code).toUpperCase() === expected) {
      activePlayer = null;
      updateSessionUi();
      msg(output, "تم التحقق من كود الرياضة");
      await renderPlayerDashboard(null);
      window.closeSheet?.();
      setTimeout(() => window.go?.("player"), 120);
      return;
    }
    msg(output, "الكود غير صحيح", "error");
  } finally {
    button.disabled = false;
  }
}

async function handleCoachLogin(button) {
  const output = ensureMessage(button, "bridgeCoachMsg");
  const email = $("email")?.value.trim().toLowerCase();
  const password = $("pass")?.value.trim();
  if (!email || !password) return msg(output, "اكتب البريد الإلكتروني وكلمة المرور", "error");
  button.disabled = true;
  try {
    const credential = await loginCoach(email, password);
    const profile = await getCoachProfile({
      email,
      uid: credential?.user?.uid,
    });
    if (!profile) return msg(output, "تم تسجيل الدخول لكن لا يوجد ملف مدرب لهذا الحساب", "error");
    if (profile.active === false) return msg(output, "هذا الحساب معطل", "error");
    if (!profile.sportId) return msg(output, "ملف المدرب لا يحتوي على sportId", "error");
    if (!sameSport(profile.sportId, sportId())) {
      await logoutCoach().catch(() => {});
      return msg(output, "هذا الحساب لا يتبع هذه الرياضة", "error");
    }
    activeCoachSession = profile;
    updateSessionUi();
    msg(output, "تم دخول المدرب");
    await refreshPlayersDirectory();
    await renderCoachDashboard();
    window.closeSheet?.();
    setTimeout(() => {
      const target = sameSport(profile.sportId, "gym") ? "gymAttendance" : "coach";
      window.go?.(target);
      if (target === "gymAttendance") renderAttendancePage("gymAttendance").catch(() => {});
    }, 120);
  } catch (error) {
    msg(output, coachLoginErrorMessage(error), "error");
  } finally {
    button.disabled = false;
  }
}

async function handleAdminLogin(button) {
  const output = ensureMessage(button, "bridgeAdminMsg");
  const email = $("admUser")?.value.trim().toLowerCase();
  const password = $("admPass")?.value.trim();
  if (!email || !password) return msg(output, "اكتب البريد الإلكتروني وكلمة المرور", "error");
  button.disabled = true;
  try {
    const credential = await loginAdmin(email, password);
    const profile = await getAdminProfile({
      uid: credential?.user?.uid,
      email: credential?.user?.email || email,
    });
    if (!profile || profile.active === false) {
      await logoutCoach().catch(() => {});
      return msg(output, "ليس لديك صلاحية دخول الإداري", "error");
    }
    activeAdminProfile = profile;
    updateSessionUi();
    msg(output, "تم دخول الإداري");
    await refreshPlayersDirectory();
    await renderAdminDashboard();
    $("adminModal")?.classList.remove("show");
    setTimeout(() => window.go?.("adminDash"), 120);
  } catch (error) {
    msg(output, coachLoginErrorMessage(error), "error");
  } finally {
    button.disabled = false;
  }
}

function interceptClicks(event) {
  const playerCardModal = $("bridgePlayerCardModal");
  if (playerCardModal?.classList.contains("show") && event.target.closest("#bridgePlayerCardModal")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    playerCardModal.classList.remove("show");
    return;
  }

  const sidebarButton = event.target.closest(".sb-item[data-sb]");
  if (sidebarButton && handleSidebarAction(sidebarButton)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (event.target.closest("#infoClose")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    $("infoModal")?.classList.remove("show");
    return;
  }

  const coachView = event.target.closest("#coach");
  if (coachView) {
    const coachReloadBtn = event.target.closest("[data-coach-reload]");
    if (coachReloadBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!coachReloadBtn.classList.contains("is-loading")) {
        coachReloadBtn.classList.add("is-loading");
        forceRefreshCoachData().finally(() => coachReloadBtn.classList.remove("is-loading"));
      }
      return;
    }

    const coachAddPlayer = event.target.closest(".bigbtn");
    if (coachAddPlayer?.textContent.includes("إضافة لاعب")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addPlayerFromAdminPrompt().catch((error) => toast(error?.message || "تعذر إضافة اللاعب"));
      return;
    }

    const whatsAppShare = event.target.closest(".wa");
    if (whatsAppShare) {
      event.preventDefault();
      event.stopImmediatePropagation();
      shareCoachReportWhatsApp().catch((error) => toast(error?.message || "تعذر تجهيز التقرير"));
      return;
    }
  }

  const mrepMonthSelector = event.target.closest("#coach [data-mrep-month]");
  if (mrepMonthSelector) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCoachReportMonthMenu(mrepMonthSelector);
    return;
  }

  const mrepYearSelector = event.target.closest("#coach [data-mrep-year]");
  if (mrepYearSelector) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCoachReportYearMenu(mrepYearSelector);
    return;
  }

  if (event.target.closest("#bridgePlayerCardClose")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    $("bridgePlayerCardModal")?.classList.remove("show");
    return;
  }

  if (event.target.closest("#bridgePlayerCardPrint")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = $("bridgePlayerCardModal")?.dataset.playerId;
    const player = adminData.players.find((item) => String(playerKey(item)) === String(id));
    printSinglePlayerCard(player);
    return;
  }

  const adminView = event.target.closest("#adminDash, #adminClub, #adminSettings");
  if (adminView) {
    const adminNav = event.target.closest(".bnav.admin .bni");
    if (adminNav) {
      setTimeout(() => renderAdminDashboard().catch(() => {}), 160);
    }

    const deleteButton = event.target.closest("[data-admin-delete], .ic-del");
    if (deleteButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const row = deleteButton.closest("[data-admin-id]");
      const type = deleteButton.dataset.adminDelete || row?.dataset.adminType;
      const id = row?.dataset.adminId;
      deleteAdminEntity(type, id).catch((error) => toast(error?.message || "تعذر الحذف النهائي"));
      return;
    }

    if (event.target.closest("[data-admin-disabled]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast("الحذف معطل حالياً");
      return;
    }

    if (event.target.closest("#bridgePlayerCardClose")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      $("bridgePlayerCardModal")?.classList.remove("show");
      return;
    }

    if (event.target.closest("#bridgePlayerCardPrint")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = $("bridgePlayerCardModal")?.dataset.playerId;
      const player = adminData.players.find((item) => String(playerKey(item)) === String(id));
      printSinglePlayerCard(player);
      return;
    }

    const announcementButton = event.target.closest("#adminDash .mlink");
    if (announcementButton?.textContent.includes("تنبيه")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      publishAnnouncementFromAdminPrompt().catch((error) => toast(error?.message || "تعذر نشر التنبيه"));
      return;
    }

    const dashboardSportFilter = event.target.closest("#adminDash [data-admin-dashboard-sport-filter]");
    if (dashboardSportFilter) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openBridgeSelectMenu(
        dashboardSportFilter,
        adminSportFilterOptions(adminDashboardSportFilter),
        setAdminDashboardSportFilter,
      );
      return;
    }

    const cardsTab = event.target.closest("#adminClub [data-admin-cards-tab]");
    if (cardsTab) {
      event.preventDefault();
      event.stopImmediatePropagation();
      adminCardsTab = cardsTab.dataset.adminCardsTab === "coaches" ? "coaches" : "players";
      selectedCards.clear();
      renderAdminClubSafe();
      return;
    }

    const groupSelector = event.target.closest("#adminSettings [data-settings-group-cycle]");
    if (groupSelector) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const groups = [...new Set([
        adminSelectedSettingsGroup,
        ...adminData.players.map(playerGroup).filter(Boolean),
        "فئة الكبار",
        "فئة الشباب",
        "فئة الناشئين",
      ])].filter(Boolean);
      openBridgeSelectMenu(
        groupSelector,
        groups.map((group) => ({ label: group, value: group, active: group === adminSelectedSettingsGroup })),
        setAdminSettingsGroup,
      );
      return;
    }

    const settingsSelector = event.target.closest("#adminSettings [data-settings-sport-cycle]");
    if (settingsSelector) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openBridgeSelectMenu(
        settingsSelector,
        adminSportFilterOptions(adminSelectedSettingsSportId).filter((option) => option.value),
        setAdminSettingsSport,
      );
      return;
    }

    const timeRow = event.target.closest("#adminSettings .time-row");
    if (timeRow) {
      event.preventDefault();
      event.stopImmediatePropagation();
      editAdminSettingsTime(timeRow).catch((error) => toast(error?.message || "تعذر تعديل الوقت"));
      return;
    }

    const saveSettings = event.target.closest("#adminSettings [data-save-attendance-settings], #adminSettings .bigbtn");
    if (saveSettings) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAdminSettingsFromDesign().catch((error) => toast(error?.message || "تعذر حفظ إعدادات الحضور"));
      return;
    }

    const playerSportFilter = event.target.closest("#adminClub [data-admin-sport-filter-cycle]");
    if (playerSportFilter) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openBridgeSelectMenu(
        playerSportFilter,
        adminSportFilterOptions(adminPlayerSportFilter),
        setAdminPlayerSportFilter,
      );
      return;
    }

    const playerGroupFilter = event.target.closest("#adminClub [data-admin-group-filter-cycle]");
    if (playerGroupFilter) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openBridgeSelectMenu(
        playerGroupFilter,
        adminGroupFilterOptions(adminPlayerGroupFilter),
        setAdminPlayerGroupFilter,
      );
      return;
    }

    const editButton = event.target.closest("[data-admin-edit], .ic-edit");
    if (editButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const row = editButton.closest("[data-admin-id]");
      const type = editButton.dataset.adminEdit || row?.dataset.adminType;
      const id = row?.dataset.adminId;
      if (type === "player") editPlayerFromAdminPrompt(id).catch((error) => toast(error?.message || "تعذر تعديل اللاعب"));
      else if (type === "coach") editCoachFromAdminPrompt(id).catch((error) => toast(error?.message || "تعذر تعديل المدرب"));
      else if (type === "sport") editSportFromAdminPrompt(id).catch((error) => toast(error?.message || "تعذر تعديل الرياضة"));
      return;
    }

    const cardButton = event.target.closest("[data-admin-card], .ic-card");
    if (cardButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const player = playerByAdminRow(cardButton.closest("[data-admin-id]"));
      if (player) openPlayerCardModal(player).catch((error) => toast(error?.message || "تعذر عرض البطاقة"));
      else toast("عرض البطاقات متاح للاعبين فقط حالياً");
      return;
    }

    const cardToggle = event.target.closest("#adminClub .ic-print[data-card-select]");
    if (cardToggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = cardToggle.dataset.cardSelect;
      if (selectedCards.has(id)) selectedCards.delete(id);
      else selectedCards.add(id);
      renderAdminClubSafe();
      return;
    }

    const printSelected = event.target.closest("[data-print-selected], .print-btn");
    if (printSelected) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const players = selectedCards.size
        ? adminData.players.filter((player) => selectedCards.has(playerKey(player)))
        : adminFilteredPlayers();
      printCards(players).catch((error) => toast(error?.message || "تعذر طباعة البطاقات"));
      return;
    }

    const resetSelected = event.target.closest("[data-reset-selected-cards], .reset-btn");
    if (resetSelected && !resetSelected.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resetSelectedPlayersAttendance().catch((error) => toast(error?.message || "تعذر التصفير"));
      return;
    }

    const fabItem = event.target.closest("#adminFabMenu .fab-item");
    if (fabItem) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const label = fabItem.textContent.trim();
      $("adminFabMenu")?.classList.remove("show");
      $("adminFab")?.classList.remove("on");
      if (label.includes("إضافة لاعب")) addPlayerFromAdminPrompt().catch((error) => toast(error?.message || "تعذر إضافة اللاعب"));
      else if (label.includes("إضافة مدرب")) addCoachFromAdminPrompt().catch((error) => toast(error?.message || "تعذر إضافة المدرب"));
      else if (label.includes("إضافة رياضة")) addSportFromAdminPrompt().catch((error) => toast(error?.message || "تعذر إضافة الرياضة"));
      else if (label.includes("تنبيه")) openAnnouncementManager().catch((error) => toast(error?.message || "تعذر فتح التنبيهات"));
      return;
    }
  }

  const weeklyView = event.target.closest("#weekly");
  if (weeklyView) {
    const saveWeekly = event.target.closest(".bigbtn, [data-save-weekly]");
    if (saveWeekly) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveWeeklyPage();
      return;
    }
    const saveCodeBtn = event.target.closest(".savechip, [data-save-sport-code]");
    if (saveCodeBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const input = weeklyView.querySelector(".cfield");
      const newCode = String(input?.value || "").trim().toUpperCase();
      if (newCode.length < 4) {
        toast("أدخل كود أطول وأوضح (4 أحرف على الأقل)");
        return;
      }
      saveCodeBtn.disabled = true;
      saveSportSettings({ id: sportId(), sportId: sportId(), sport: sportNameAr(), sportCode: newCode })
        .then(() => {
          selectedSportSettings = { ...(selectedSportSettings || {}), sportCode: newCode };
          state.sportCode = newCode;
          saveState();
          if (input) input.value = newCode;
          toast("تم حفظ الكود بنجاح");
        })
        .catch(() => toast("تعذر حفظ الكود، حاول مرة أخرى"))
        .finally(() => {
          saveCodeBtn.disabled = false;
        });
      return;
    }
    const dcAdd = event.target.closest("[data-dc-add]");
    if (dcAdd) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const day = dcAdd.closest(".daycard")?.dataset.day;
      if (day) openWeeklyAddSheet(day);
      return;
    }
    const exMenuBtn = event.target.closest("[data-ex-menu]");
    if (exMenuBtn) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const card = exMenuBtn.closest(".ex-card");
      if (card) openExerciseActionMenu(exMenuBtn, card.dataset.day, card.dataset.exId);
      return;
    }
  }

  const exLinkRow = event.target.closest("[data-ex-link-url]");
  if (exLinkRow) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const url = exLinkRow.dataset.exLinkUrl;
    if (url) window.open(url, "_blank");
    return;
  }

  if (event.target.closest("#weeklyItemBackdrop")) {
    if (event.target.id === "weeklyItemBackdrop" || event.target.closest(".wk-close")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeWeeklySheet();
      return;
    }
    const pickRow = event.target.closest("[data-wk-pick]");
    if (pickRow) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showWeeklyPanel(pickRow.dataset.wkPick);
      return;
    }
    if (event.target.closest("#weeklyItemBack")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      weeklyEditingExerciseId = null;
      resetExerciseForm();
      showWeeklyPanel("pick");
      return;
    }
    if (event.target.closest("#wkExAddLink")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addLinkInputRow();
      return;
    }
    if (event.target.closest("#wkSaveExercise")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveExerciseFromSheet();
      return;
    }
    const libAdd = event.target.closest("[data-lib-add]");
    if (libAdd) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addExerciseFromLibrary(libAdd.closest(".wk-lib-row")?.dataset.libId);
      return;
    }
  }

  const trainingView = event.target.closest("#gymTraining");
  if (trainingView) {
    if (event.target.closest("#addSportBtn")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (activeAdminProfile) addSportFromAdminPrompt().catch((error) => toast(error?.message || "تعذر إضافة الرياضة"));
      else toast("إضافة الرياضة متاحة للإداري فقط");
      return;
    }

    const sportButton = event.target.closest("#gymSports .pick[data-sport]");
    if (sportButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const sport = sportByAnyValue(sportButton.dataset.sportId || sportButton.dataset.sport);
      const targetSportId = sportValue(sport) || sportButton.dataset.sportId || sportButton.dataset.sport;
      if (!canCoachViewWorkoutSport(targetSportId)) {
        toast("المدرب يرى تمارين رياضته فقط");
        return;
      }
      workoutDraft.sportId = targetSportId;
      workoutDraft.sport = sportAr(sport) || sportButton.dataset.sport || sportNameAr();
      workoutDraft.group = "";
      trainingView.querySelectorAll("#gymSports .pick").forEach((button) => button.classList.remove("on"));
      sportButton.classList.add("on");
      renderDailyWorkoutManager().catch(() => {});
      return;
    }

    const groupButton = event.target.closest("#gymCats .pick[data-cat]");
    if (groupButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      workoutDraft.group = normalizeGroupName(groupButton.dataset.cat || groupButton.textContent.trim());
      trainingView.querySelectorAll("#gymCats .pick").forEach((button) => button.classList.remove("on"));
      groupButton.classList.add("on");
      renderDailyWorkoutManager().catch(() => {});
      return;
    }

    if (event.target.closest("#newExBtn")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openExerciseModal();
      return;
    }

    if (event.target.closest("#fromListBtn")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openGymTemplatesModal();
      return;
    }
  }

  if (event.target.closest("#exSave")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    saveExerciseFromModal(event.target.closest("#exSave"));
    return;
  }

  if (event.target.closest("#pickClose")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    $("pickModal")?.classList.remove("show");
    return;
  }

  const templateButton = event.target.closest("#pickList .pick-row[data-template-id]");
  if (templateButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    applyGymTemplate(templateButton.dataset.templateId);
    return;
  }

  if (attendanceScannerUsingVerifyModal && event.target.closest("#verifyClose")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeAttendanceQr();
    return;
  }

  if (attendanceScannerUsingVerifyModal && event.target.closest("#scanBtn")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const result = $("vfResult");
    if (result) {
      result.className = "vf-result";
      result.textContent = "";
    }
    if ($("scanHint")) $("scanHint").textContent = "وجّه الكاميرا نحو بطاقة اللاعب";
    return;
  }

  if (event.target.closest("#verifyClose")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeVerifyScanner();
    return;
  }

  if (event.target.closest("#scanBtn")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const result = $("vfResult");
    if (result) {
      result.className = "vf-result";
      result.textContent = "";
    }
    if ($("scanHint")) $("scanHint").textContent = "وجّه الكاميرا نحو بطاقة اللاعب";
    return;
  }

  const secHomeBtn = event.target.closest('#securityPage [data-nav="home"]');
  if (secHomeBtn) {
    closeCamera().catch(() => {});
  }

  const secSearchBtn = event.target.closest("#secSearchBtn");
  if (secSearchBtn) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const query = $("secSearchInput")?.value || "";
    const player = searchPlayer(query);
    if (!query.trim()) {
      const box = $("secResultCard");
      if (box) box.style.display = "none";
    } else if (player) {
      renderSearchResult(player, false);
    } else {
      renderInvalidResult();
    }
    return;
  }

  const secStartCamBtn = event.target.closest("#secStartCamBtn");
  if (secStartCamBtn) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCamera().catch(() => toast("تعذر تشغيل الكاميرا"));
    return;
  }

  const secStopCamBtn = event.target.closest("#secStopCamBtn");
  if (secStopCamBtn) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeCamera().catch(() => {});
    return;
  }

  const attendanceView = event.target.closest("#attendance, #gymAttendance");
  if (attendanceView) {
    const statusButton = event.target.closest(".pcard .att-s, .pcard .att-main, .pcard [data-attendance-status]");
    if (statusButton && attendanceStatusFromButton(statusButton)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      markAttendanceFromButton(statusButton);
      return;
    }

    const callButton = event.target.closest(".pcard .att-call, .pcard [data-contact-phone]");
    if (callButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openContactOptionsMenu(callButton, callButton.dataset.contactPhone);
      return;
    }

    const nameButton = event.target.closest(".pcard .pn");
    if (nameButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = nameButton.closest("[data-player-id]")?.dataset.playerId;
      const player = playersDirectory.find((item) => String(playerKey(item)) === String(id));
      openPlayerCardModal(player).catch((error) => toast(error?.message || "تعذر عرض البطاقة"));
      return;
    }

    const qrButton = event.target.closest(".fab");
    if (qrButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if ($("verifyModal")?.classList.contains("coach-scan") && $("verifyModal")?.classList.contains("show")) {
        closeAttendanceQr();
      } else {
        openAttendanceQr(qrButton);
      }
      return;
    }

    if ($("verifyModal")?.classList.contains("coach-scan") && $("verifyModal")?.classList.contains("show")) {
      const insidePopup = event.target.closest("#verifyModal .modal-card");
      if (!insidePopup) {
        closeAttendanceQr();
      }
    }

    const categoryBar = event.target.closest(".catbar");
    if (categoryBar?.dataset.bridgeGroups) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const groups = categoryBar.dataset.bridgeGroups.split("|").filter(Boolean);
      const options = ["", ...groups];
      const current = attendanceView.dataset.bridgeGroup || "";
      const next = options[(Math.max(options.indexOf(current), 0) + 1) % options.length] || "";
      attendanceView.dataset.bridgeGroup = next;
      renderAttendancePage(attendanceView.id, false);
      return;
    }
  }

  const coachNavButton = event.target.closest(".bnav[data-nav-for] .bni");
  if (coachNavButton?.textContent.includes("التحضير")) {
    setTimeout(() => renderAttendancePage("attendance").catch(() => {}), 160);
  }
  if (coachNavButton?.textContent.includes("التمارين")) {
    setTimeout(() => renderWeeklyPage().catch(() => {}), 160);
  }

  const gymNavButton = event.target.closest(".bnav[data-gymnav] .bni");
  if (gymNavButton?.textContent.includes("التحضير")) {
    setTimeout(() => renderAttendancePage("gymAttendance").catch(() => {}), 160);
  }
  if (gymNavButton?.textContent.includes("التمارين")) {
    setTimeout(() => renderDailyWorkoutManager().catch(() => {}), 160);
  }

  const sportCard = event.target.closest("#home .sport");
  if (sportCard) {
    event.preventDefault();
    event.stopImmediatePropagation();
    selectSport(sportCard);
    return;
  }

  const loginButton = event.target.closest("[data-login]");
  if (loginButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (loginButton.dataset.login === "player") handlePlayerLogin(loginButton);
    else handleCoachLogin(loginButton);
    return;
  }

  if (event.target.closest(".forgot")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    handleForgotPassword().catch((error) => toast(error?.message || "تعذر إرسال رابط إعادة التعيين"));
    return;
  }

  const adminButton = event.target.closest("#adminEnter");
  if (adminButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    handleAdminLogin(adminButton);
  }
}

function interceptInputs(event) {
  const secSearch = event.target.closest("#secSearchInput");
  if (secSearch) {
    const query = secSearch.value || "";
    if (!query.trim()) {
      const box = $("secResultCard");
      if (box) box.style.display = "none";
      return;
    }
    const player = searchPlayer(query);
    if (player) renderSearchResult(player, false);
    else renderInvalidResult();
    return;
  }

  const adminSearch = event.target.closest("#adminClub [data-admin-player-search], #adminClub .search input");
  if (adminSearch) {
    adminPlayerSearch = adminSearch.value || "";
    renderAdminClubSafe();
    return;
  }

  const templateSearch = event.target.closest("#pickSearch");
  if (templateSearch) {
    gymTemplateSearch = templateSearch.value || "";
    renderGymTemplatesList();
    return;
  }

  const librarySearch = event.target.closest("#wkLibrarySearch");
  if (librarySearch) {
    loadAndRenderLibrary(librarySearch.value || "");
    return;
  }

  const input = event.target.closest("#attendance .search input, #gymAttendance .search input, [data-bridge-attendance-search]");
  if (!input) return;
  const view = input.closest("#attendance, #gymAttendance");
  if (!view) return;
  attendanceSearch = input.value || "";
  renderAttendancePage(view.id, false).catch(() => {});
}

function interceptChanges(event) {
  const selectAll = event.target.closest("#adminClub [data-select-all-cards], #adminClub .selall input");
  if (selectAll) {
    selectedCards.clear();
    if (selectAll.checked) adminFilteredPlayers().forEach((player) => selectedCards.add(playerKey(player)));
    renderAdminClubSafe();
    return;
  }

  const note = event.target.closest("#attendance .notef, #gymAttendance .notef, [data-att-note]");
  if (!note) return;
  saveAttendanceNoteFromField(note);
}

function enhanceAdminModal() {
  const user = $("admUser");
  if (user) {
    user.type = "email";
    user.placeholder = "admin@example.com";
    user.closest(".field")?.querySelector("label")?.replaceChildren(document.createTextNode("البريد الإلكتروني"));
  }
  ensureMessage($("adminEnter"), "bridgeAdminMsg");
}

async function boot() {
  document.body.dataset.page = "home";
  sanitizeDesignPlaceholders();
  enhanceAdminModal();
  updateSportLabels();
  updateSessionUi();
  document.addEventListener("click", interceptClicks, true);
  document.addEventListener("input", interceptInputs, true);
  document.addEventListener("change", interceptChanges, true);
  await loadHomeData();
  await loadHomeAnnouncements();
  if (document.querySelector("#home .sport")) {
    const selected = [...document.querySelectorAll("#home .sport")].find((card) =>
      sameSport(card.dataset.sportId || card.dataset.en, sportId()),
    );
    if (selected) {
      selectedSportSettings = await getSportSettings(sportId()).catch(() => null);
      if (selectedSportSettings?.sportCode) {
        state.sportCode = String(selectedSportSettings.sportCode).toUpperCase();
        saveState();
      }
    }
  }
}

boot().catch((error) => {
  console.error("[WaveLiftBridge] boot failed", error);
  renderSports();
});



