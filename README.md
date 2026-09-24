# نظام إدارة جودة خدمة العملاء (Firebase)

## هيكل المشروع
```
index.html        الصفحة الرئيسية + شاشة الدخول
css/style.css     التصميم
js/config.js      إعدادات Firebase
js/firebase.js    الربط مع Firestore والمصادقة
js/app.js         منطق النظام (اللوحة، التقييمات، الموظفات، التقارير، الإعدادات)
firestore.rules   قواعد الأمان
```

## الإعداد (مرة واحدة)
1. **Firestore:** من Firebase Console ← Build ← Firestore Database ← Create database (Production mode).
2. **الدخول:** Build ← Authentication ← Sign-in method ← فعّلي **Email/Password**، ثم أضيفي المستخدمين من تبويب Users.
3. **الصلاحيات:** في Firestore أنشئي مجموعة `roles`، ومستندًا معرّفه = **UID المستخدم** (انسخيه من تبويب Users) وفيه الحقل `role` بإحدى القيم:
   `admin` (تحكم كامل + الإعدادات) — `editor` (إدخال وتعديل) — `viewer` (مشاهدة فقط).
4. **القواعد:** انسخي محتوى `firestore.rules` إلى Firestore ← Rules ← Publish.
5. **النطاقات المسموحة:** Authentication ← Settings ← Authorized domains ← أضيفي `USERNAME.github.io`.

## التشغيل محليًا
لا يعمل بفتح الملف مباشرة (file://) بسبب وحدات ES. شغّلي خادمًا محليًا:
`python3 -m http.server 8000` ثم افتحي http://localhost:8000

## النشر على GitHub Pages
ارفعي محتويات المجلد إلى مستودع، ثم Settings ← Pages ← Branch: main / root.

## نقل بياناتك القديمة
من النظام القديم: الإعدادات ← تصدير نسخة احتياطية Excel. ثم في هذا النظام: الإعدادات ← استيراد (ملف Excel).

## أمان
مفتاح apiKey في config.js عام بطبيعته. الحماية الفعلية هي تسجيل الدخول + `firestore.rules`.
لا تستخدمي أبدًا `allow read, write: if true`.
