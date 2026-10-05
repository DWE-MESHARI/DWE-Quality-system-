/*
 * إعدادات الربط مع Supabase — نظام إدارة الجودة
 * ===================================================
 * تسجيل الدخول في هذا النظام يتم فقط عبر Supabase Auth — لا يوجد أي
 * حساب أو كلمة مرور داخل الشيفرة نفسها. يجب تعبئة هذا الملف لتفعيل
 * الدخول للنظام.
 *
 * خطوات التفعيل:
 * 1) أنشئي مشروعاً مجانياً على https://supabase.com
 * 2) من SQL Editor نفّذي محتوى ملف supabase-schema.sql المرفق مرة واحدة
 *    (ينشئ الجداول ويفعّل سياسات RLS التي تتطلب تسجيل دخول لكل وصول).
 * 3) من Authentication → Users أنشئي المستخدم الوحيد (بريد + كلمة مرور)
 *    الذي سيكون مسؤول النظام. لا يوجد تسجيل ذاتي من واجهة النظام.
 * 4) من Project Settings → API انسخي "Project URL" و"anon public key" وضعيهما أدناه.
 * 5) غيّري SUPABASE_ENABLED إلى true.
 * 6) انشري الملفات على GitHub Pages كالمعتاد — لا حاجة لأي أداة بناء.
 *
 * ملاحظة أمنية: مفتاح anon public سيظهر في شيفرة الموقع العلنية —
 * هذا متوقع ومصمَّم من Supabase ولا يمثّل مشكلة، لأن سياسات RLS في
 * supabase-schema.sql تمنع أي قراءة أو كتابة بدون جلسة تسجيل دخول
 * صالحة. المفتاح وحده لا يكفي لأي وصول للبيانات.
 */
window.SUPABASE_ENABLED = true;

window.SUPABASE_URL = 'https://tpejroihmvyxnblexqxt.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_3-pS9TUnPsLkNcbH2HhT7A_H8PrRiEP';
