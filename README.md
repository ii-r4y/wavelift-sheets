# WaveLift — نسخة Google Sheets (بدون Firebase)

واجهة WaveLift نفسها، لكن البيانات في **Google Sheets** عبر **Apps Script** بدل Firebase.

## المعمارية
- **الواجهة** (index.html + wavelift-app.css + js/wavelift-bridge.js): ملفات ثابتة تُرفع على GitHub Pages.
- **الباك-إند** (apps-script/Code.gs): Web App في Apps Script يقرأ/يكتب في Google Sheet.
- **طبقة الربط** (src/shim/*): بدائل محلية لـFirebase توجّه كل النداءات إلى Apps Script — بدون تعديل منطق التطبيق.

## خطوات التشغيل
1. أنشئ Google Sheet جديد.
2. Extensions → Apps Script، الصق محتوى `apps-script/Code.gs`، ثم انشره كـ Web App (Execute as: Me، Access: Anyone).
3. انسخ رابط `/exec` وضعه في `src/shim/api.js` مكان `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE`.
4. في الشيت أنشئ تبويب `Users` بالأعمدة: `id, email, password, role, name, active` وأضف حساب المدرب/الأدمن.
5. ارفع الملفات على GitHub وفعّل GitHub Pages.

## تسجيل الدخول
حسابات الدخول في تبويب `Users`. الأدوار: `admin` أو `coach`. (اللاعب يدخل بالرمز كالمعتاد.)
