'use strict';
/*
 * نظام إدارة الجودة — نسخة ثابتة (HTML/CSS/JS عادي بدون أي إطار عمل أو أداة بناء).
 * التخزين: localStorage كنسخة محلية فورية + مزامنة مع Supabase عند تفعيلها.
 * الدخول: حصرياً عبر Supabase Auth — لا يوجد أي حساب داخل الكود. راجعي
 * README.md وsupabase-config.js وsupabase-schema.sql للتفعيل والتفاصيل الأمنية.
 */

/* ============================== التخزين ============================== */
const STORAGE_PREFIX = 'quality-system:';
function load(key, fallback) {
  try { const raw = localStorage.getItem(STORAGE_PREFIX + key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* تجاهل */ }
}

/* ============================== الربط مع Supabase (اختياري) ==============================
 * معطّل تماماً بشكل افتراضي — النظام يعمل محلياً بـ localStorage كما كان دون أي تغيير.
 * يُفعَّل فقط حين تضبطين window.SUPABASE_ENABLED = true في supabase-config.js
 * بعد تنفيذ supabase-schema.sql وتعبئة الرابط والمفتاح. راجعي README للتفاصيل.
 * عند التفعيل: يُحمَّل التطبيق فوراً من النسخة المحلية كالعادة (بدون أي تأخير)،
 * ثم يسحب نسخة أحدث من Supabase في الخلفية ويعيد الرسم، وأي تغيير محلي (persist)
 * يُرفَع تلقائياً إلى Supabase. أي فشل في الشبكة يُتجاهَل بصمت والنظام يستمر محلياً. */
const CLOUD_ENABLED = !!(window.SUPABASE_ENABLED && window.SUPABASE_URL && window.SUPABASE_ANON_KEY
  && window.SUPABASE_URL.indexOf('YOUR-PROJECT-REF') === -1 && typeof window.supabase !== 'undefined');
const cloud = CLOUD_ENABLED ? (() => { try { return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); } catch { return null; } })() : null;
function cloudOn() { return !!cloud; }
function empToRow(e) { return { id: e.id, name: e.name, role: e.role || null, active: e.active !== false, avatar_color: e.avatarColor || null }; }
function rowToEmp(r) { return { id: r.id, name: r.name, role: r.role, active: r.active, avatarColor: r.avatar_color }; }
function evalToRow(e) { return { id: e.id, employee_id: e.employeeId, date: e.date, calls: e.calls, quality: e.quality, fcr: e.fcr, adherence: e.adherence, csat: e.csat, complaints: e.complaints, break_min: (e.breakMin === undefined ? null : e.breakMin), note: e.note || null }; }
function rowToEval(r) { return { id: r.id, employeeId: r.employee_id, date: r.date, calls: r.calls, quality: +r.quality, fcr: +r.fcr, adherence: +r.adherence, csat: +r.csat, complaints: r.complaints, breakMin: (r.break_min === null ? null : +r.break_min), note: r.note }; }
function actToRow(a) { return { id: a.id, at: a.at, uid: a.uid || null, user: a.user, action: a.action, detail: a.detail || null }; }
function rowToAct(r) { return { id: r.id, at: r.at, uid: r.uid, user: r.user, action: r.action, detail: r.detail }; }
async function cloudPullAll() {
  if (!cloud || !isAuthed()) return false;
  try {
    const [r1, r2, r3, r4] = await Promise.all([
      cloud.from('employees').select('*'),
      cloud.from('evaluations').select('*'),
      cloud.from('activities').select('*').order('at', { ascending: false }).limit(300),
      cloud.from('config').select('*').eq('id', 'default').limit(1),
    ]);
    if (r1.error || r2.error || r3.error || r4.error) { console.warn('Supabase: تعذّر سحب البيانات، يستمر النظام بالنسخة المحلية.', r1.error || r2.error || r3.error || r4.error); return false; }
    // Supabase هي المصدر الوحيد للحقيقة بعد تسجيل الدخول — نسخة محلية قديمة (مثلاً بيانات تجريبية سابقة)
    // يجب أن تُستبدل دائماً بما هو في قاعدة البيانات، حتى لو كانت فاضية تماماً.
    employees = (r1.data || []).map(rowToEmp);
    evaluations = (r2.data || []).map(rowToEval);
    activities = (r3.data || []).map(rowToAct);
    if (r4.data && r4.data[0]) config = normalizeConfig({ weights: r4.data[0].weights, targets: r4.data[0].targets, thresholds: r4.data[0].thresholds, breaks: r4.data[0].breaks });
    else config = normalizeConfig(DEFAULT_CONFIG);
    save('employees', employees); save('evaluations', evaluations); save('activities', activities); save('config', config);
    return true;
  } catch (err) { console.warn('Supabase: فشل السحب، يستمر النظام بالنسخة المحلية.', err); return false; }
}
async function cloudPushAll() {
  if (!cloud || !isAuthed()) return;
  try {
    await Promise.all([
      employees.length ? cloud.from('employees').upsert(employees.map(empToRow)) : Promise.resolve(),
      evaluations.length ? cloud.from('evaluations').upsert(evaluations.map(evalToRow)) : Promise.resolve(),
      activities.length ? cloud.from('activities').upsert(activities.slice(0, 300).map(actToRow)) : Promise.resolve(),
      cloud.from('config').upsert([{ id: 'default', weights: config.weights, targets: config.targets, thresholds: config.thresholds, breaks: config.breaks }]),
    ]);
  } catch (err) { console.warn('Supabase: فشل الرفع، النسخة المحلية محفوظة وستُعاد المحاولة لاحقاً.', err); }
}
/** الاسم الفعلي الذي دخلت به الجلسة الحالية (يُستخدم في القائمة الجانبية وسجل النشاط بدل اسم ثابت). */
function sessionUserName() { return (authSession && (authSession.user.user_metadata && authSession.user.user_metadata.full_name)) || (authSession && authSession.user.email) || 'مسؤول النظام'; }
function sessionUserId() { return authSession ? authSession.user.id : 'unknown'; }

/* ============================== الدخول — Supabase Auth حصرياً ==============================
 * لا يوجد أي حساب أو كلمة مرور داخل الكود. الحساب الوحيد يُنشأ من
 * Supabase Dashboard مباشرة (Authentication → Users)، والدخول هنا هو
 * تحقق حقيقي عبر خادم Supabase (JWT)، وليس تحققاً محلياً شكلياً.
 * يتطلب هذا أن يكون الربط مفعّلاً (CLOUD_ENABLED = true عبر supabase-config.js)
 * وأن تكون سياسات RLS في supabase-schema.sql تتطلب auth.uid() IS NOT NULL —
 * بذلك لا تُقرأ أو تُكتب أي بيانات إلا من جلسة مسجَّلة فعلياً.
 */
let authSession = null;
let authChecked = false;
function isAuthed() { return !!authSession; }
async function authInit() {
  if (!cloud) { authChecked = true; return; }
  try {
    const { data } = await cloud.auth.getSession();
    authSession = data.session || null;
  } catch { authSession = null; }
  authChecked = true;
  cloud.auth.onAuthStateChange((_event, session) => { authSession = session; render(); });
}
async function doLogin(email, password) {
  if (!cloud) return { ok: false, msg: 'الربط مع Supabase غير مُفعَّل بعد. راجعي supabase-config.js.' };
  const { data, error } = await cloud.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, msg: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
  authSession = data.session;
  return { ok: true };
}
async function doLogout() {
  addActivity('سجّلت الخروج', 'من النظام');
  if (cloud) { try { await cloud.auth.signOut(); } catch { /* تجاهل */ } }
  authSession = null;
  navigate('/login'); render();
}

/* ============================== القيم الافتراضية (نظام فارغ) ============================== */
const EMPLOYEES_SEED = [];
const EVALS_SEED = [];
const ACTIVITY_SEED = [];
const DEFAULT_CONFIG = { weights: { quality: 40, fcr: 20, adherence: 20, csat: 20 }, targets: { quality: 90, fcr: 85, adherence: 94, csat: 4.5 }, thresholds: { excellent: 90, needs: 80 }, breaks: { limit: 60 } };
function normalizeConfig(c) { const d = DEFAULT_CONFIG; c = c || {}; return { weights: { ...d.weights, ...c.weights }, targets: { ...d.targets, ...c.targets }, thresholds: { ...d.thresholds, ...c.thresholds }, breaks: { ...d.breaks, ...c.breaks } }; }

/* ============================== الحالة ============================== */
let employees = load('employees', EMPLOYEES_SEED);
let evaluations = load('evaluations', EVALS_SEED);
let activities = load('activities', ACTIVITY_SEED);
let config = normalizeConfig(load('config', DEFAULT_CONFIG));

function persist() { save('employees', employees); save('evaluations', evaluations); save('activities', activities); save('config', config); if (cloudOn()) cloudPushAll(); }
function addActivity(action, detail) {
  activities = [{ id: 'a' + Date.now(), at: new Date().toISOString(), uid: sessionUserId(), user: sessionUserName(), action, detail }, ...activities];
  persist();
}
function score(e) {
  return Math.round(
    e.quality * (config.weights.quality / 100) +
    e.fcr * (config.weights.fcr / 100) +
    e.adherence * (config.weights.adherence / 100) +
    (e.csat / 5 * 100) * (config.weights.csat / 100)
  );
}
function statusOf(s) { return s >= config.thresholds.excellent ? ['ممتاز', 'mint'] : s >= config.thresholds.needs ? ['جيد', 'peach'] : ['يحتاج تحسين', 'pink']; }
function barClass(s) { return s >= config.thresholds.excellent ? '' : s >= config.thresholds.needs ? 'warn' : 'bad'; }
function avg(list, key) { const f = typeof key === 'function' ? key : e => e[key]; return list.length ? Math.round(list.reduce((a, e) => a + f(e), 0) / list.length) : 0; }
const AVATAR_COLORS = [
  '#ff9f5e', '#ff7a4d', '#f2994a', '#e0a339',
  '#4d96ff', '#5b7fe0', '#3fb0c9', '#2fb8a6',
  '#7c6fe0', '#9d6fe0', '#c26fd9', '#e06fb0',
  '#e0607a', '#d9534f', '#5fb87a', '#6fae4a',
  '#c9a24d', '#8a8f98',
];
function avatarBg(emp) {
  if (AVATAR_COLORS.includes(emp.avatarColor)) return emp.avatarColor;
  let h = 0; for (const c of String(emp.id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtDate(iso) { try { return new Date(iso + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return iso; } }
function fmtDateTime(iso) { try { return new Date(iso).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } }

/* ============================== أدوات التحليل ============================== */
const METRICS = [
  { key: 'quality', label: 'Quality', name: 'جودة المكالمات' },
  { key: 'fcr', label: 'FCR', name: 'الحل من أول اتصال' },
  { key: 'adherence', label: 'Adherence', name: 'الالتزام بالجدول' },
  { key: 'csat', label: 'CSAT', name: 'رضا العملاء' },
];
function ltr(x) { return `<bdi dir="ltr">${x}</bdi>`; }
function today() { return new Date().toISOString().slice(0, 10); }
function fmtNum(v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtMetric(key, v) { return key === 'csat' ? fmtNum(v, 2) + ' من 5' : fmtNum(v, 1) + '%'; }
function fmtTarget(key) { const t = config.targets[key]; return key === 'csat' ? fmtNum(t, 1) + ' من 5' : t + '%'; }
function metricPct(key, v) { return key === 'csat' ? v / 5 * 100 : v; }
function shortDate(iso) { return `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`; }
function hasBreak(e) { return e.breakMin !== null && e.breakMin !== undefined && e.breakMin !== '' && !isNaN(e.breakMin); }

/* ---- الاستراحات: أخضر أقل من الحد، برتقالي عند الحد تماماً، أحمر عند التجاوز ---- */
function breakStatus(min) {
  if (min === null || min === undefined || min === '' || isNaN(min)) return null;
  const lim = config.breaks.limit; min = Number(min);
  if (min > lim) return { cls: 'over', label: 'تجاوز الحد المسموح' };
  if (min === lim) return { cls: 'warn', label: 'بلغ الحد المسموح' };
  return { cls: 'ok', label: 'ضمن الحد المسموح' };
}
function breakBadge(min) {
  const s = breakStatus(min);
  return s ? `<span class="brk ${s.cls}" title="${s.label}"><i></i>${fmtNum(min, Number.isInteger(Number(min)) ? 0 : 1)} د</span>` : '<span class="muted" style="font-size:11px">—</span>';
}
function breakLegend() {
  const l = config.breaks.limit;
  return `<div class="brk-legend"><span class="brk ok"><i></i>أقل من ${l} د</span><span class="brk warn"><i></i>${l} د (الحد)</span><span class="brk over"><i></i>أكثر من ${l} د</span></div>`;
}

/* ---- الإحصاءات ---- */
function inRange(e, from, to, emp) {
  return (!from || e.date >= from) && (!to || e.date <= to) && (!emp || emp === 'all' || e.employeeId === emp);
}
function statsFor(list) {
  const n = list.length, lim = config.breaks.limit;
  const mean = k => n ? list.reduce((a, e) => a + Number(e[k]), 0) / n : 0;
  const br = list.filter(hasBreak);
  return {
    n,
    score: n ? list.reduce((a, e) => a + score(e), 0) / n : 0,
    quality: mean('quality'), fcr: mean('fcr'), adherence: mean('adherence'), csat: mean('csat'),
    calls: list.reduce((a, e) => a + (Number(e.calls) || 0), 0),
    complaints: list.reduce((a, e) => a + (Number(e.complaints) || 0), 0),
    breakN: br.length,
    breakAvg: br.length ? br.reduce((a, e) => a + Number(e.breakMin), 0) / br.length : null,
    breakOk: br.filter(e => Number(e.breakMin) < lim).length,
    breakAt: br.filter(e => Number(e.breakMin) === lim).length,
    breakOver: br.filter(e => Number(e.breakMin) > lim).length,
  };
}
function goalsHit(st) { return METRICS.map(m => st[m.key] >= config.targets[m.key]); }
function empRows(list) {
  const ids = [...new Set(list.map(e => e.employeeId))];
  return ids.map(id => ({ emp: employees.find(x => x.id === id) || { id, name: '—', role: '', avatarColor: '' }, st: statsFor(list.filter(e => e.employeeId === id)) }))
    .sort((a, b) => b.st.score - a.st.score || b.st.quality - a.st.quality);
}
/* ============================== مركز المتابعة + التنبيهات ============================== */
function computeAlerts() {
  const mk = today().slice(0, 7);
  const allRows = empRows(evaluations);
  const activeEmployees = employees.filter(e => e.active !== false);
  const lowQuality = allRows.filter(r => r.st.n && r.st.quality < config.targets.quality);
  const breakOver = allRows.filter(r => r.st.breakOver > 0);
  const needsReview = evaluations.filter(e => score(e) < config.thresholds.needs);
  const evaluatedIds = new Set(evaluations.filter(e => e.date.slice(0, 7) === mk).map(e => e.employeeId));
  const notEvaluated = activeEmployees.filter(e => !evaluatedIds.has(e.id));
  const gst = statsFor(evaluations);
  const priorities = METRICS.map(m => {
    const curPct = metricPct(m.key, gst[m.key] || 0), tgtPct = metricPct(m.key, config.targets[m.key]);
    const gap = tgtPct ? ((curPct - tgtPct) / tgtPct * 100) : 0;
    return { key: m.key, label: m.label, current: gst[m.key] || 0, target: config.targets[m.key], gap };
  }).filter(p => p.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 3);
  return { lowQuality, breakOver, needsReview, notEvaluated, priorities, total: lowQuality.length + breakOver.length + needsReview.length + notEvaluated.length };
}
function alertItem(iconName, colorClass, badgeClass, count, title, desc, btnLabel, route) {
  return `<div class="alert-item">
    <span class="tag-icon ${colorClass}" style="padding:9px;border-radius:12px">${icon(iconName, 16)}</span>
    <div style="flex:1;min-width:0">
      <div class="between"><b style="font-size:13px">${esc(title)}</b><span class="badge ${badgeClass}">${count}</span></div>
      <p class="muted" style="font-size:11.5px;margin:3px 0 8px;line-height:1.6">${esc(desc)}</p>
      <a class="btn soft sm" href="#${route}">${icon('chevron', 12)} ${esc(btnLabel)}</a>
    </div>
  </div>`;
}
function followUpCenterHtml(alerts) {
  const items = [
    alertItem('employees', 'c-pink', 'pink', alerts.lowQuality.length, 'موظفون', `أقل من الهدف في جودة المكالمات`, 'عرض الموظفين', '/employee-report'),
    alertItem('clock', 'c-amber', 'peach', alerts.breakOver.length, 'موظفون', 'تجاوزوا حد الاستراحة المسموح', 'مراجعة الحالات', '/evaluations'),
    alertItem('report', 'c-indigo', 'lavender', alerts.needsReview.length, 'تقييمات', 'تحتاج إلى مراجعة من المديرة', 'فتح التقييمات', '/evaluations'),
    alertItem('employees', 'c-teal', 'mint', alerts.notEvaluated.length, alerts.notEvaluated.length === 1 ? 'موظفة' : 'موظفون', 'لم يتم تقييمهم هذا الشهر', 'الإدخال الجماعي', '/bulk-entry'),
  ];
  const priorityRows = alerts.priorities.length
    ? alerts.priorities.map(p => `<tr><td>${esc(p.label)}</td><td><b>${fmtMetric(p.key, p.current)}</b></td><td>${fmtTarget(p.key)}</td><td><span class="gap-down">▼ ${fmtNum(Math.abs(p.gap), 1)}%</span></td></tr>`).join('')
    : `<tr><td colspan="4" class="muted" style="text-align:center;padding:14px">كل المؤشرات ضمن الهدف حالياً 🎉</td></tr>`;
  return `<div class="card followup-card avoid-break no-print">
    <div class="between"><h3 class="section-title">مركز المتابعة</h3><span class="tag-icon c-orange" style="padding:8px">${icon('zap', 16)}</span></div>
    <p class="muted" style="font-size:11.5px;margin:2px 0 14px">أهم الإجراءات والتنبيهات التي تحتاج إلى اهتمامك الآن.</p>
    <div class="alert-list">${items.join('')}</div>
    <div class="between" style="margin:20px 0 10px"><h3 class="section-title" style="font-size:14px">أولويات التحسين</h3><span class="tag-icon c-slate" style="padding:7px">${icon('trending', 14)}</span></div>
    <p class="muted" style="font-size:11px;margin:0 0 10px">أبرز المؤشرات التي تحتاج إلى تركيز أكبر حالياً.</p>
    <div class="table-scroll"><table class="tbl compact"><thead><tr><th>المؤشر</th><th>الحالي</th><th>الهدف</th><th>الفارق</th></tr></thead><tbody>${priorityRows}</tbody></table></div>
    <a class="btn soft" style="width:100%;margin-top:14px;justify-content:center" href="#/evaluations">${icon('chevron', 13)} عرض التفاصيل</a>
  </div>`;
}
function notifDropdownHtml(alerts) {
  const rows = [
    { c: 'c-pink', ic: 'employees', t: `${alerts.lowQuality.length} موظفون أقل من هدف الجودة`, r: '/employee-report' },
    { c: 'c-amber', ic: 'clock', t: `${alerts.breakOver.length} موظفون تجاوزوا حد الاستراحة`, r: '/evaluations' },
    { c: 'c-indigo', ic: 'report', t: `${alerts.needsReview.length} تقييمات تحتاج مراجعة`, r: '/evaluations' },
    { c: 'c-teal', ic: 'employees', t: `${alerts.notEvaluated.length} موظفون لم يُقيَّموا هذا الشهر`, r: '/bulk-entry' },
  ].filter(x => parseInt(x.t) > 0);
  const body = rows.length ? rows.map(r => `<a class="notif-row" href="#${r.r}" onclick="closeNotif()"><span class="nic ${r.c}" style="width:28px;height:28px">${icon(r.ic, 13)}</span><span>${esc(r.t)}</span></a>`).join('')
    : `<div class="muted" style="padding:16px;text-align:center;font-size:12.5px">لا توجد تنبيهات حالياً 🎉</div>`;
  return `<div class="notif-head"><b>التنبيهات</b><span class="muted" style="font-size:11px">${rows.length} تنبيه نشط</span></div>${body}`;
}
function toggleNotif() {
  const existing = document.getElementById('notif-panel');
  if (existing) { closeNotif(); return; }
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.className = 'notif-panel';
  panel.innerHTML = notifDropdownHtml(computeAlerts());
  panel.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(panel);
  const btn = document.getElementById('bell-btn');
  if (btn) { const r = btn.getBoundingClientRect(); panel.style.top = (r.bottom + 8) + 'px'; panel.style.left = Math.max(12, r.left - 260) + 'px'; }
  setTimeout(() => document.addEventListener('click', closeNotif, { once: true }), 0);
}
function closeNotif() { const p = document.getElementById('notif-panel'); if (p) p.remove(); }

/* ============================== صفحة: مركز المتابعة ============================== */
function followUpNameList(names) {
  if (!names.length) return '';
  const shown = names.slice(0, 6);
  return `<div class="chips-row" style="margin-top:10px">${shown.map(n => `<span class="gchip">${esc(n)}</span>`).join('')}${names.length > shown.length ? `<span class="gchip">+${names.length - shown.length}</span>` : ''}</div>`;
}
function followUpSection(iconName, colorClass, badgeClass, count, title, desc, btnLabel, route, names) {
  return `<div class="card avoid-break" style="padding:18px">
    <div class="row" style="align-items:flex-start;gap:14px">
      <span class="tag-icon ${colorClass}" style="padding:12px;border-radius:14px">${icon(iconName, 20)}</span>
      <div style="flex:1;min-width:0">
        <div class="between"><h3 class="section-title" style="margin:0">${esc(title)}</h3><span class="badge ${badgeClass}">${count}</span></div>
        <p class="muted" style="font-size:13px;margin:6px 0 0">${esc(desc)}</p>
        ${followUpNameList(names)}
        <a class="btn soft" style="margin-top:14px" href="#${route}">${icon('chevron', 13)} ${esc(btnLabel)}</a>
      </div>
    </div>
  </div>`;
}
function pageFollowUp() {
  const alerts = computeAlerts();
  const header = `<div class="page-header no-print"><div><h2>مركز المتابعة</h2><p>أهم الإجراءات والتنبيهات التشغيلية التي تحتاج إلى اهتمامك الآن، محدّثة تلقائياً من بيانات النظام.</p></div>
    <div class="actions"><button class="btn soft" onclick="window.print()">${icon('printer', 16)} طباعة</button></div></div>`;

  const sections = `<div class="grid cols-2" style="margin-top:4px">
    ${followUpSection('employees', 'c-pink', 'pink', alerts.lowQuality.length, 'موظفون أقل من هدف الجودة', 'أداؤهم في جودة المكالمات دون الهدف المحدد في الإعدادات.', 'عرض تقارير الموظفين', '/employee-report', alerts.lowQuality.map(r => r.emp.name))}
    ${followUpSection('clock', 'c-amber', 'peach', alerts.breakOver.length, 'موظفون تجاوزوا حد الاستراحة', `لديهم تقييمات بوقت استراحة أكثر من الحد المسموح (${config.breaks.limit} د).`, 'مراجعة التقييمات', '/evaluations', alerts.breakOver.map(r => r.emp.name))}
    ${followUpSection('report', 'c-indigo', 'lavender', alerts.needsReview.length, 'تقييمات تحتاج إلى مراجعة', 'تقييمات فردية بدرجة مركبة أقل من حد «يحتاج دعم» وتستدعي مراجعة المديرة.', 'فتح التقييمات', '/evaluations', alerts.needsReview.map(e => { const emp = employees.find(x => x.id === e.employeeId); return `${emp ? emp.name : '—'} · ${fmtDate(e.date)}`; }))}
    ${followUpSection('employees', 'c-teal', 'mint', alerts.notEvaluated.length, 'موظفون لم يُقيَّموا هذا الشهر', 'لا توجد لهم أي تقييمات مسجّلة خلال الشهر الحالي.', 'الإدخال الجماعي', '/bulk-entry', alerts.notEvaluated.map(e => e.name))}
  </div>`;

  const priorityRows = alerts.priorities.length
    ? alerts.priorities.map(p => `<tr><td>${esc(p.label)}</td><td><b>${fmtMetric(p.key, p.current)}</b></td><td>${fmtTarget(p.key)}</td><td><span class="gap-down">▼ ${fmtNum(Math.abs(p.gap), 1)}%</span></td></tr>`).join('')
    : `<tr><td colspan="4" class="muted" style="text-align:center;padding:18px">كل المؤشرات ضمن الهدف حالياً 🎉</td></tr>`;
  const priorities = `<div class="card avoid-break" style="margin-top:20px">
    <div class="between"><h3 class="section-title">أولويات التحسين</h3><span class="tag-icon c-rose" style="padding:9px">${icon('trending', 15)}</span></div>
    <p class="muted" style="font-size:12.5px;margin:4px 0 14px">أبرز المؤشرات التي تحتاج إلى تركيز أكبر حالياً، مرتّبة حسب حجم الفجوة عن الهدف.</p>
    <div class="table-scroll"><table class="tbl"><thead><tr><th>المؤشر</th><th>الحالي</th><th>الهدف</th><th>الفارق</th></tr></thead><tbody>${priorityRows}</tbody></table></div>
  </div>`;

  return header + sections + priorities;
}
function trendSeries(list) {
  const by = {};
  list.forEach(e => (by[e.date] = by[e.date] || []).push(score(e)));
  return Object.keys(by).sort().map(d => ({ label: d, value: by[d].reduce((a, b) => a + b, 0) / by[d].length }));
}
function levelCounts(rows) {
  const c = { ex: 0, good: 0, need: 0 };
  rows.forEach(r => { const s = Math.round(r.st.score); if (s >= config.thresholds.excellent) c.ex++; else if (s >= config.thresholds.needs) c.good++; else c.need++; });
  return c;
}
function periodText(list, from, to) {
  const dates = list.map(e => e.date).sort();
  const a = from || dates[0], b = to || dates[dates.length - 1];
  if (!a) return 'كل الفترات';
  return a === b ? fmtDate(a) : `${fmtDate(a)} — ${fmtDate(b)}`;
}

/* ---- الرسوم البيانية (SVG بدون مكتبات خارجية، تعمل مع الطباعة) ---- */
let chartSeq = 0;
function lineChart(points, target, targetLabel) {
  if (!points.length) return '<div class="empty">لا توجد بيانات كافية للرسم</div>';
  const id = 'g' + (++chartSeq);
  const W = 640, H = 260, L = 44, R = 20, T = 20, B = 38;
  const vals = points.map(p => p.value).concat(target != null ? [target] : []);
  let lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 5) * 5);
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 5) * 5);
  if (hi - lo < 10) lo = Math.max(0, hi - 10);
  const x = i => points.length === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (points.length - 1);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4, yy = y(v);
    grid += `<line x1="${L}" x2="${W - R}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#ffe3cf" stroke-width="1"/><text x="${L - 8}" y="${(yy + 4).toFixed(1)}" font-size="11" fill="#94694c" text-anchor="end">${Math.round(v)}</text>`;
  }
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;
  const step = Math.ceil(points.length / 8);
  const labels = points.map((p, i) => (i % step === 0 || i === points.length - 1) ? `<text x="${x(i).toFixed(1)}" y="${H - 14}" font-size="11" fill="#94694c" text-anchor="middle">${shortDate(p.label)}</text>` : '').join('');
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="4.5" fill="#fff" stroke="#ff8a3d" stroke-width="2.5"><title>${p.label}: ${fmtNum(p.value, 1)}%</title></circle>`).join('');
  const vlabels = points.length <= 7 ? points.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${(y(p.value) - 10).toFixed(1)}" font-size="10.5" font-weight="700" fill="#5c2d0c" text-anchor="middle">${Math.round(p.value)}</text>`).join('') : '';
  const tl = target != null ? `<line x1="${L}" x2="${W - R}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" stroke="#b5470f" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${W - R}" y="${(y(target) - 6).toFixed(1)}" font-size="11" font-weight="700" fill="#b5470f" text-anchor="end">${targetLabel || 'الهدف'} ${target}%</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="مسار تطور الأداء" style="direction:ltr">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".32"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></linearGradient></defs>
    ${grid}${tl}<path d="${area}" fill="url(#${id})"/><path d="${path}" fill="none" stroke="#ff8a3d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${vlabels}${labels}</svg>`;
}
function donutChart(items) {
  const total = items.reduce((a, i) => a + i.value, 0), R = 70, C = 2 * Math.PI * R;
  let off = 0;
  const segs = total ? items.filter(i => i.value > 0).map(i => {
    const len = i.value / total * C;
    const s = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${i.color}" stroke-width="30" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 100 100)"><title>${i.label}: ${i.value}</title></circle>`;
    off += len; return s;
  }).join('') : `<circle cx="100" cy="100" r="${R}" fill="none" stroke="#ffe9da" stroke-width="30"/>`;
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 200 200" role="img" aria-label="تقسيم الموظفين حسب مستوى الأداء">${segs}<text x="100" y="103" text-anchor="middle" font-size="34" font-weight="800" fill="#4a2c17">${total}</text><text x="100" y="124" text-anchor="middle" font-size="12" fill="#94694c">موظف</text></svg>
    <ul class="legend">${items.map(i => `<li><i style="background:${i.color}"></i><span>${i.label}</span><b>${i.value}</b></li>`).join('')}</ul></div>`;
}

/* ---- التحليلات والتوصيات التلقائية ---- */
function trendDelta(trend) {
  if (trend.length < 2) return null;
  const h = Math.floor(trend.length / 2), a = trend.slice(0, h), b = trend.slice(trend.length - h);
  const m = arr => arr.reduce((s, p) => s + p.value, 0) / arr.length;
  return m(b) - m(a);
}
function baseInsights(st, trend) {
  const good = [], opp = [];
  METRICS.forEach(m => {
    const v = st[m.key], t = config.targets[m.key];
    if (v >= t) good.push(`${m.label} حقق الهدف: ${fmtMetric(m.key, v)} مقابل ${fmtTarget(m.key)}.`);
    else opp.push(`${m.label} دون الهدف بفارق ${fmtNum(t - v, m.key === 'csat' ? 2 : 1)}: ${fmtMetric(m.key, v)} مقابل ${fmtTarget(m.key)}.`);
  });
  if (st.breakN) {
    const pct = Math.round((st.breakOk + st.breakAt) / st.breakN * 100);
    if (st.breakOver === 0) good.push(`كل سجلات الاستراحة (${st.breakN}) ضمن الحد المسموح (${config.breaks.limit} د).`);
    else opp.push(`${st.breakOver} من ${st.breakN} سجل استراحة تجاوز ${config.breaks.limit} د (نسبة الالتزام ${pct}%).`);
  }
  const d = trendDelta(trend);
  if (d !== null) {
    if (d >= 1) good.push(`مسار الأداء في تحسّن بمقدار ${fmtNum(d, 1)} نقطة بين بداية الفترة ونهايتها.`);
    else if (d <= -1) opp.push(`مسار الأداء في تراجع بمقدار ${fmtNum(Math.abs(d), 1)} نقطة بين بداية الفترة ونهايتها.`);
  }
  return { good, opp };
}
function teamInsights(st, rows, trend) {
  const { good, opp } = baseInsights(st, trend);
  if (rows.length > 1) {
    good.unshift(`الأعلى أداءً: ${rows[0].emp.name} بمتوسط ${Math.round(rows[0].st.score)}%.`);
    const lv = levelCounts(rows);
    if (lv.ex) good.push(`${lv.ex} من ${rows.length} موظفين بمستوى «ممتاز».`);
    const need = rows.filter(r => Math.round(r.st.score) < config.thresholds.needs);
    if (need.length) opp.unshift(`دون حد الدعم (${config.thresholds.needs}%): ${need.map(r => r.emp.name).join('، ')}.`);
    const c = [...rows].sort((a, b) => b.st.complaints - a.st.complaints)[0];
    if (c && c.st.complaints > 0) opp.push(`أعلى عدد شكاوى: ${c.emp.name} (${c.st.complaints}).`);
    const b = [...rows].sort((a, b2) => b2.st.breakOver - a.st.breakOver)[0];
    if (b && b.st.breakOver > 0) opp.push(`أكثر تجاوزاً لوقت الاستراحة: ${b.emp.name} (${b.st.breakOver} مرة).`);
  }
  return { good, opp };
}
function summaryText(st, rows, period) {
  const s = Math.round(st.score), lvl = statusOf(s)[0], hits = goalsHit(st).filter(Boolean).length;
  let t = `خلال الفترة (${period}) جرت مراجعة ${st.n} تقييم لعدد ${rows.length} من الموظفين، وبلغ متوسط الأداء العام ${fmtNum(st.score, 1)}% (مستوى «${lvl}»). حقق الفريق ${hits} من 4 أهداف، وبلغ إجمالي المكالمات ${fmtNum(st.calls, 0)} مكالمة و${st.complaints} شكوى.`;
  if (st.breakN) t += ` متوسط وقت الاستراحة ${fmtNum(st.breakAvg, 0)} دقيقة مقابل حد مسموح ${config.breaks.limit} دقيقة.`;
  return t;
}
function recommendations(st, rows) {
  const r = [];
  METRICS.filter(m => st[m.key] < config.targets[m.key]).forEach(m => r.push(`وضع خطة تحسين لمؤشر ${m.label} (${fmtMetric(m.key, st[m.key])} مقابل الهدف ${fmtTarget(m.key)}) عبر جلسات استماع وتدريب موجّه.`));
  const need = rows.filter(x => Math.round(x.st.score) < config.thresholds.needs);
  if (need.length) r.push(`متابعة فردية مكثفة للموظفين: ${need.map(x => x.emp.name).join('، ')}.`);
  if (st.breakOver) r.push(`مراجعة الالتزام بوقت الاستراحة (${st.breakOver} حالة تجاوز للحد ${config.breaks.limit} دقيقة) وتذكير الفريق بالسياسة.`);
  if (st.n && st.complaints / st.n >= 2) r.push('تحليل أسباب الشكاوى المتكررة ومعالجتها عند المصدر.');
  if (!r.length) r.push('الحفاظ على المستوى الحالي مع تكريم المتميزين وتوثيق الممارسات الناجحة.');
  return r;
}
function insightBlock(good, opp) {
  const li = a => a.length ? a.map(t => `<li>${esc(t)}</li>`).join('') : '<li class="muted">لا توجد بنود حالياً.</li>';
  return `<div class="grid cols-2 insights"><div class="ins good"><h4>${icon('check', 16)} نقاط القوة</h4><ul>${li(good)}</ul></div><div class="ins opp"><h4>${icon('trending', 16)} فرص التحسين</h4><ul>${li(opp)}</ul></div></div>`;
}
function kpi(label, value, sub, cls) { return `<div class="kpi ${cls || ''}"><div class="kpi-label">${label}</div><div class="kpi-value display">${value}</div><div class="kpi-sub">${sub || ''}</div></div>`; }
const METRIC_COLOR = { quality: 'c-blue', fcr: 'c-teal', adherence: 'c-purple', csat: 'c-pink' };
function kpiMetric(key, st, cls) {
  const m = METRICS.find(x => x.key === key), v = st[key], hit = v >= config.targets[key];
  return kpi(`${m.label} · ${m.name}`, fmtMetric(key, v), `الهدف ${fmtTarget(key)} · <b class="${hit ? 'hit' : 'miss'}">${hit ? '✓ محقق' : '▼ دون الهدف'}</b>`, cls || METRIC_COLOR[key]);
}
function goalsCard(st, title) {
  const hits = goalsHit(st).filter(Boolean).length;
  return `<div class="card avoid-break"><div class="between" style="margin-bottom:14px"><h3 class="section-title">${title}</h3><span class="badge ${hits === 4 ? 'mint' : 'peach'}">${hits} من 4 أهداف</span></div>
    ${METRICS.map(m => { const v = st[m.key], t = config.targets[m.key], pct = Math.max(0, Math.min(100, metricPct(m.key, v))), tp = Math.min(100, metricPct(m.key, t)), hit = v >= t;
      return `<div class="goal-row"><div class="between"><span style="font-weight:700"><i class="mdot ${METRIC_COLOR[m.key]}"></i>${m.label}</span><span>${fmtMetric(m.key, v)} <small class="muted">/ ${fmtTarget(m.key)}</small> <b class="${hit ? 'hit' : 'miss'}">${hit ? '✓' : '▼'}</b></span></div><div class="bar goal-bar ${hit ? '' : 'warn'}"><i style="width:${pct}%"></i><u style="right:${100 - tp}%"></u></div></div>`; }).join('')}</div>`;
}
function setRange(which, field, val) {
  const s = which === 'dash' ? dash : empRep;
  s[field] = val;
  if (s.from && s.to && s.from > s.to) { const t = s.from; s.from = s.to; s.to = t; }
  render();
}
function filterBar(which, state, extraHtml) {
  return `<div class="card no-print filters"><div class="filters-grid">
    <label class="field"><span>من تاريخ</span><input type="date" value="${state.from}" onchange="setRange('${which}','from',this.value)" /></label>
    <label class="field"><span>إلى تاريخ</span><input type="date" value="${state.to}" onchange="setRange('${which}','to',this.value)" /></label>
    ${extraHtml || ''}
    <div class="field"><span>&nbsp;</span><button class="btn soft" onclick="resetFilters('${which}')">إعادة ضبط</button></div>
  </div></div>`;
}
function resetFilters(which) { if (which === 'dash') dash = { from: '', to: '', emp: 'all' }; else { empRep.from = ''; empRep.to = ''; } render(); }
function printHead(title, lines) {
  return `<div class="print-only print-head"><div class="ph-brand">${icon('shield', 22)} نظام إدارة الجودة</div><h1>${title}</h1><div class="ph-meta">${lines.map(l => `<span>${l}</span>`).join('')}</div></div>`;
}
function tableRowsBreakOffenders(list) {
  const lim = config.breaks.limit;
  return list.filter(e => hasBreak(e) && Number(e.breakMin) > lim).sort((a, b) => Number(b.breakMin) - Number(a.breakMin)).slice(0, 10);
}

/* ============================== أيقونات SVG صغيرة ============================== */
const ICONS = {
  dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z',
  evaluations: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  bulk: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
  employees: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  report: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  monthly: 'M18 20V10M12 20V4M6 20v-6',
  activity: 'M13 2 3 14h9l-1 8 10-12h-9z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  menu: 'M3 12h18M3 6h18M3 18h18',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  chevron: 'M15 18l-6-6 6-6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  sparkles: 'M12 3v4M3 12h4M19 12h2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  trending: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
};
function icon(name, size) { size = size || 17; return `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${ICONS[name] || ''}"/></svg>`; }

/* ============================== أدوات التصدير ============================== */
async function exportElementToPdf(el, filename) {
  if (!window.html2canvas || !window.jspdf) { alert('تعذّر تحميل مكتبة PDF — تحققي من الاتصال بالإنترنت. يمكنك استخدام «طباعة» بدلاً من ذلك.'); return; }
  try {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const bg = getComputedStyle(document.body).backgroundColor;
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: bg });
    const pageH = Math.floor(canvas.width * 297 / 210);
    for (let y = 0, page = 0; y < canvas.height; y += pageH, page++) {
      const h = Math.min(pageH, canvas.height - y);
      const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = h;
      const ctx = slice.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, slice.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page) doc.addPage();
      doc.addImage(slice.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, 210, h * 210 / canvas.width);
    }
    doc.save(filename);
  } catch { alert('تعذّر إنشاء ملف PDF.'); }
}
function downloadBlob(filename, blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
function downloadJSON(filename, data) { downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); }
function exportExcel() {
  if (!window.XLSX) { alert('تعذّر تحميل مكتبة Excel.'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees.map(e => ({ الموظف: e.name, المسمى: e.role, الحالة: e.active ? 'نشطة' : 'متوقفة مؤقتاً' }))), 'الموظفون');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evaluations.map(e => { const emp = employees.find(x => x.id === e.employeeId); const s = score(e); return { التاريخ: e.date, الموظف: emp ? emp.name : e.employeeId, 'عدد المكالمات': e.calls, 'Quality %': e.quality, 'FCR %': e.fcr, 'Adherence %': e.adherence, 'CSAT %': e.csat, الشكاوى: e.complaints, 'الدرجة المركبة %': s, الحالة: statusOf(s)[0], 'الاستراحة (دقيقة)': hasBreak(e) ? Number(e.breakMin) : '', 'حالة الاستراحة': hasBreak(e) ? breakStatus(e.breakMin).label : '', ملاحظات: e.note }; })), 'التقييمات');
  downloadBlob(`quality-backup-${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
  addActivity('صدّرت نسخة Excel', 'الموظفون والتقييمات');
}
async function importExcel(file) {
  if (!window.XLSX) { alert('تعذّر تحميل مكتبة Excel.'); return; }
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    let rows = [];
    for (const name of wb.SheetNames) { const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null }); if (r.length && (('الموظف' in r[0]) || ('الموظفة' in r[0])) && 'التاريخ' in r[0]) { rows = r; break; } }
    if (!rows.length) throw new Error('لم أجد ورقة تحتوي عمودي «الموظف» و«التاريخ»');
    const pct = v => { const n = parseFloat(v ?? 0) || 0; return +(n <= 1 ? n * 100 : n).toFixed(2); };
    const asDate = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10);
    let created = 0;
    for (const r of rows) {
      const name = String(r['الموظف'] ?? r['الموظفة'] ?? '').trim();
      const date = r['التاريخ'] ? asDate(r['التاريخ']) : '';
      if (!name || !date) continue;
      let emp = employees.find(x => x.name === name);
      if (!emp) { emp = { id: 'e' + Date.now() + created, name, role: 'أخصائية خدمة عملاء', active: true, avatarColor: '#ff9f5e' }; employees.push(emp); }
      const data = { date, employeeId: emp.id, calls: parseFloat(r['عدد المكالمات'] ?? 0) || 0, quality: pct(r['Quality %']), fcr: pct(r['FCR %']), adherence: pct(r['Adherence %'] ?? r['الالتزام %']), csat: pct(r['CSAT %']), complaints: parseFloat(r['الشكاوى'] ?? 0) || 0, breakMin: (r['الاستراحة (دقيقة)'] === null || r['الاستراحة (دقيقة)'] === undefined || r['الاستراحة (دقيقة)'] === '') ? null : (parseFloat(r['الاستراحة (دقيقة)']) || 0), note: String(r['ملاحظات'] ?? '') };
      const idx = evaluations.findIndex(v => v.employeeId === emp.id && v.date === date);
      if (idx >= 0) evaluations[idx] = { ...evaluations[idx], ...data }; else evaluations.push({ id: 'v' + Date.now() + created, ...data });
      created++;
    }
    persist(); addActivity('استوردت من Excel', `${created} تقييم`); alert(`تم استيراد ${created} تقييم بنجاح`); render();
  } catch (err) { alert(err.message || 'تعذّر استيراد الملف'); }
}

/* ============================== التوجيه ============================== */
const NAV = [
  { href: '/', label: 'لوحة التحليل', icon: 'dashboard', c: 'c-orange' },
  { href: '/evaluations', label: 'التقييمات', icon: 'evaluations', c: 'c-blue' },
  { href: '/follow-up', label: 'مركز المتابعة', icon: 'zap', c: 'c-rose' },
  { href: '/bulk-entry', label: 'إدخال جماعي', icon: 'bulk', c: 'c-teal' },
  { href: '/employees', label: 'الموظفون', icon: 'employees', c: 'c-purple' },
  { href: '/employee-report', label: 'تقارير الموظفين', icon: 'report', c: 'c-pink' },
  { href: '/monthly-report', label: 'التقرير الشهري', icon: 'monthly', c: 'c-indigo' },
  { href: '/activity', label: 'سجل النشاط', icon: 'activity', c: 'c-amber' },
];
function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  return { path: path || '/', params };
}
function navigate(href) { location.hash = '#' + href; }

/* ============================== الإطار العام ============================== */
function shell(pageHtml, title) {
  const { path } = parseHash();
  const current = NAV.find(n => n.href === path);
  return `
  <aside class="sidebar" id="sidebar">
    <div class="brand"><div class="brand-badge">${icon('shield', 22)}</div><div><div class="brand-title display">الجودة</div><div class="brand-sub">نظام إدارة الجودة</div></div></div>
    <div class="nav-label">مساحة العمل</div>
    <nav>${NAV.map(n => `<a class="nav-link ${path === n.href ? 'active' : ''} ${path === n.href ? n.c : ''}" data-route="${n.href}" href="#${n.href}"><span class="nic ${n.c}">${icon(n.icon)}</span><span>${n.label}</span></a>`).join('')}</nav>
    <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">
      <div class="nav-label">الإدارة</div>
      <a class="nav-link ${path === '/settings' ? 'active c-slate' : ''}" href="#/settings"><span class="nic c-slate">${icon('settings')}</span><span>الإعدادات</span></a>
    </div>
    <div class="sidebar-footer">
      <div class="row" style="color:#966212"><span class="nic c-amber" style="width:26px;height:26px;border-radius:9px">${icon('sparkles', 14)}</span><b style="font-size:13px">نظام إدارة الجودة</b></div>
      <p>كل تغييراتك محفوظة محلياً في متصفحك ويمكنك تجربتها بأمان.</p>
    </div>
    <div class="sidebar-user"><div class="avatar sm" style="background:#ffc395">${esc(sessionUserName()[0] || 'م')}</div><div style="flex:1;min-width:0"><div class="name">${esc(sessionUserName())}</div><div class="role">جلسة دخول حالية</div></div><button class="icon-btn" aria-label="تسجيل الخروج" title="تسجيل الخروج" onclick="doLogout()">${icon('logout', 16)}</button></div>
  </aside>
  <div class="main">
    <header class="topbar">
      <div class="row"><button class="icon-btn" id="menu-btn" onclick="document.getElementById('sidebar').classList.toggle('open')">${icon('menu', 20)}</button>
        <div><p class="crumb">نظام إدارة الجودة / ${esc(title)}</p><h1>${esc(title)}</h1></div>
      </div>
      <div class="row"><button class="icon-btn c-amber bell-wrap" id="bell-btn" style="border-radius:12px;position:relative" aria-label="التنبيهات" onclick="event.stopPropagation();toggleNotif()">${icon('bell', 18)}${(() => { const n = computeAlerts().total; return n ? `<span class="bell-dot">${n > 9 ? '9+' : n}</span>` : ''; })()}</button></div>
    </header>
    <div class="page">${pageHtml}</div>
  </div>`;
}

/* ============================== لوحة التحليل ============================== */
let dash = { from: '', to: '', emp: 'all' };
function pageDashboard() {
  if (dash.emp !== 'all' && !employees.some(e => e.id === dash.emp)) dash.emp = 'all';
  const list = evaluations.filter(e => inRange(e, dash.from, dash.to, dash.emp));
  const st = statsFor(list), rows = empRows(list), trend = trendSeries(list);
  const empName = dash.emp === 'all' ? 'كل الموظفين' : employees.find(e => e.id === dash.emp).name;
  const period = periodText(list, dash.from, dash.to);
  const header = `<div class="page-header no-print"><div><h2>لوحة التحليل والإحصائيات</h2><p>مؤشرات الأداء والأهداف والاستراحات، قابلة للتصفية والطباعة.</p></div>
    <div class="actions"><button class="btn soft" onclick="window.print()">${icon('printer', 16)} طباعة اللوحة</button><button class="btn" onclick="exportElementToPdf(document.getElementById('dash-area'),'dashboard-${today()}.pdf')">${icon('download', 16)} تصدير PDF</button></div></div>`;
  const empSel = `<label class="field"><span>الموظف</span><select onchange="dash.emp=this.value;render()"><option value="all">كل الموظفين</option>${employees.map(e => `<option value="${e.id}" ${dash.emp === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>`;
  const filters = filterBar('dash', dash, empSel);
  if (!list.length) return header + filters + `<div class="card">${emptyBlock('لا توجد تقييمات ضمن هذا الاختيار', 'غيّري الفترة الزمنية أو الموظف، أو أضيفي تقييمات جديدة.')}</div>`;

  const s = Math.round(st.score), lvl = statusOf(s);
  const top = rows[0], topHits = goalsHit(top.st);
  const lv = levelCounts(rows);
  const ins = teamInsights(st, rows, trend);

  const kpis = `<div class="grid cols-4 kpis">
      ${kpi('متوسط الأداء العام', s + '%', `<span class="badge ${lvl[1]}">${lvl[0]}</span> · ${st.n} تقييم`, 'accent')}
      ${kpiMetric('quality', st)}${kpiMetric('fcr', st)}${kpiMetric('adherence', st)}
    </div>
    <div class="grid cols-4 kpis" style="margin-top:14px">
      ${kpiMetric('csat', st)}
      ${kpi('إجمالي المكالمات', fmtNum(st.calls, 0), `المتوسط ${fmtNum(st.calls / st.n, 0)} لكل تقييم`)}
      ${kpi('الشكاوى', st.complaints, `المتوسط ${fmtNum(st.complaints / st.n, 1)} لكل تقييم`)}
      ${kpi('متوسط الاستراحة', st.breakN ? breakBadge(Math.round(st.breakAvg)) : '—', st.breakN ? `${st.breakOver} تجاوز من ${st.breakN} سجل · الحد ${config.breaks.limit} د` : 'لا توجد سجلات استراحة')}
    </div>`;

  const topCard = `<div class="card highlight avoid-break"><div class="between"><h3 class="section-title">${dash.emp === 'all' ? 'موظف الفترة' : 'أداء الموظف المحدد'}</h3><span class="tag-icon c-amber">${icon('trophy', 20)}</span></div>
    <div class="row" style="margin:16px 0"><span class="avatar lg" style="background:${avatarBg(top.emp)}">${esc(top.emp.name[0] || '?')}</span>
      <div style="flex:1"><div style="font-weight:800;font-size:17px">${esc(top.emp.name)}</div><div class="muted" style="font-size:12px">${esc(top.emp.role)}</div></div>
      <div style="text-align:left"><div class="display" style="font-size:34px;font-weight:800;line-height:1">${Math.round(top.st.score)}%</div><span class="badge ${statusOf(Math.round(top.st.score))[1]}">${statusOf(Math.round(top.st.score))[0]}</span></div></div>
    <div class="chips-row">${METRICS.map((m, i) => `<span class="gchip ${topHits[i] ? 'on' : ''}">${topHits[i] ? '✓' : '▼'} ${m.label} ${fmtMetric(m.key, top.st[m.key])}</span>`).join('')}</div></div>`;

  const board = `<div class="card table-card avoid-break"><div class="between" style="padding:18px 20px 6px"><div><h3 class="section-title">ترتيب الموظفين (Leaderboard)</h3><p class="muted" style="font-size:12px;margin:2px 0 0">حسب متوسط الدرجة المركبة، مع تتبع الأهداف الفردية (● محقق)</p></div></div>
    <div class="table-scroll"><table class="tbl"><thead><tr><th>#</th><th>الموظف</th><th>الأداء</th><th>Quality</th><th>FCR</th><th>Adherence</th><th>CSAT</th><th>الشكاوى</th><th>الاستراحة</th><th>الأهداف</th><th>المستوى</th></tr></thead><tbody>
    ${rows.map((r, i) => { const sc = Math.round(r.st.score), h = goalsHit(r.st), lv2 = statusOf(sc);
      return `<tr><td><span class="rank r${i + 1}">${i + 1}</span></td>
      <td><div class="eval-emp"><span class="avatar sm" style="background:${avatarBg(r.emp)}">${esc(r.emp.name[0] || '?')}</span><b>${esc(r.emp.name)}</b></div></td>
      <td><b class="display">${sc}%</b><div class="bar ${barClass(sc)}" style="width:80px;margin-top:4px"><i style="width:${Math.min(100, sc)}%"></i></div></td>
      <td>${fmtNum(r.st.quality, 1)}%</td><td>${fmtNum(r.st.fcr, 1)}%</td><td>${fmtNum(r.st.adherence, 1)}%</td><td>${fmtNum(r.st.csat, 2)}</td><td>${r.st.complaints}</td>
      <td>${r.st.breakN ? breakBadge(Math.round(r.st.breakAvg)) : '<span class="muted">—</span>'}${r.st.breakOver ? `<div class="muted" style="font-size:10px;margin-top:2px">${r.st.breakOver} تجاوز</div>` : ''}</td>
      <td><span class="dots" title="${METRICS.map((m, k) => m.label + (h[k] ? ' ✓' : ' ✗')).join(' | ')}">${h.map(x => `<i class="${x ? 'on' : ''}"></i>`).join('')}</span> <small>${h.filter(Boolean).length}/4</small></td>
      <td><span class="badge ${lv2[1]}">${lv2[0]}</span></td></tr>`; }).join('')}
    </tbody></table></div></div>`;

  return header + filters + `<div id="dash-area">
    ${printHead('تقرير لوحة التحليل والإحصائيات', [`الفترة: ${period}`, `الموظف: ${esc(empName)}`, `تاريخ الطباعة: ${fmtDate(today())}`])}
    <section class="card summary avoid-break"><div class="row" style="align-items:flex-start"><div class="tag-icon">${icon('sparkles', 20)}</div><div><h3 class="section-title">أبرز النتائج والتحليلات</h3><p style="margin:6px 0 0;line-height:1.9;font-size:14px">${esc(summaryText(st, rows, period))}</p></div></div>${insightBlock(ins.good, ins.opp)}</section>
    <section style="margin-top:20px">${kpis}</section>
    <section class="grid cols-2" style="margin-top:20px">${topCard}${goalsCard(st, 'تحقيق الأهداف (الفريق)')}</section>
    <section class="grid cols-2 charts" style="margin-top:20px">
      <div class="card avoid-break"><h3 class="section-title">مسار تطور الأداء عبر الزمن</h3><p class="muted" style="font-size:12px;margin:2px 0 10px">متوسط الدرجة المركبة لكل يوم</p>${lineChart(trend, config.thresholds.excellent, 'حد التميّز')}</div>
      <div class="card avoid-break"><h3 class="section-title">تقسيم الموظفين حسب المستوى</h3><p class="muted" style="font-size:12px;margin:2px 0 10px">بحسب متوسط الأداء خلال الفترة</p>${donutChart([{ label: 'ممتاز', value: lv.ex, color: '#ff7a1a' }, { label: 'جيد', value: lv.good, color: '#ffb27a' }, { label: 'يحتاج تحسين', value: lv.need, color: '#ffd9b9' }])}</div>
    </section>
    <section style="margin-top:20px">${board}</section>
  </div>`;
}
function emptyBlock(title, detail) { return `<div class="empty"><b>${esc(title)}</b><span>${esc(detail)}</span></div>`; }

/* ============================== التقييمات ============================== */
let evalQuery = '';
const AR_ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];
function ordLabel(n) { return AR_ORD[n - 1] || ('رقم ' + n); }
function weekOfMonth(dateStr) { const day = +dateStr.slice(8, 10); return Math.min(4, Math.ceil(day / 7)); }
function allMonthKeys() { return [...new Set(evaluations.map(e => e.date.slice(0, 7)))].sort(); }
function monthOrdinal(key) { const i = allMonthKeys().indexOf(key); return i >= 0 ? i + 1 : allMonthKeys().length + 1; }
function monthLabelOf(key) { return new Date(key + '-01T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); }
function monthGroups(rows) {
  const by = {};
  rows.forEach(e => (by[e.date.slice(0, 7)] = by[e.date.slice(0, 7)] || []).push(e));
  return Object.keys(by).sort().reverse().map(key => ({
    key, ord: monthOrdinal(key), label: monthLabelOf(key),
    items: [...by[key]].sort((a, b) => b.date.localeCompare(a.date)),
    weeks: [1, 2, 3, 4].map(w => ({ w, items: by[key].filter(e => weekOfMonth(e.date) === w).sort((a, b) => b.date.localeCompare(a.date)) })),
  }));
}
function exportMonthExcel(key) {
  const items = evaluations.filter(e => e.date.startsWith(key));
  if (!window.XLSX) { alert('تعذّر تحميل مكتبة Excel.'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees.map(e => ({ الموظف: e.name, المسمى: e.role, الحالة: e.active ? 'نشطة' : 'متوقفة مؤقتاً' }))), 'الموظفون');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items.map(e => { const emp = employees.find(x => x.id === e.employeeId); const s = score(e); return { التاريخ: e.date, 'الأسبوع': ordLabel(weekOfMonth(e.date)), الموظف: emp ? emp.name : e.employeeId, 'عدد المكالمات': e.calls, 'Quality %': e.quality, 'FCR %': e.fcr, 'Adherence %': e.adherence, 'CSAT %': e.csat, الشكاوى: e.complaints, 'الدرجة المركبة %': s, الحالة: statusOf(s)[0], 'الاستراحة (دقيقة)': hasBreak(e) ? Number(e.breakMin) : '', ملاحظات: e.note }; })), 'التقييمات');
  downloadBlob(`evaluations-${key}.xlsx`, new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/octet-stream' }));
  addActivity('صدّرت تقييمات الشهر', monthLabelOf(key));
}
function monthStarCard(items) {
  if (!items.length) return '';
  const rows = empRows(items), top = rows[0];
  return `<div class="month-star"><span class="mi">${icon('trophy', 17)}</span><span class="avatar sm" style="background:${avatarBg(top.emp)}">${esc(top.emp.name[0] || '?')}</span>
    <div style="flex:1"><b style="font-size:12.5px">موظف الشهر: ${esc(top.emp.name)}</b><div class="muted" style="font-size:11px">متوسط الأداء ${Math.round(top.st.score)}% عبر ${top.st.n} تقييم</div></div>
    <span class="badge ${statusOf(Math.round(top.st.score))[1]}">${statusOf(Math.round(top.st.score))[0]}</span></div>`;
}
function evalRowHtml(e) {
  const emp = employees.find(x => x.id === e.employeeId), s = score(e);
  return `<div class="eval-row">
      <div class="eval-emp"><span class="avatar sm" style="background:${emp ? avatarBg(emp) : '#ffd9b9'}">${emp ? emp.name[0] : '?'}</span><span><div class="name">${esc(emp ? emp.name : '—')}</div><div class="date">${e.date} · ${ordLabel(weekOfMonth(e.date))} ${breakBadge(e.breakMin)}</div></span></div>
      <div><span class="display" style="font-size:18px;font-weight:800">${s}%</span><div class="bar ${barClass(s)}" style="width:80px;margin-top:4px"><i style="width:${s}%"></i></div></div>
      <div style="font-weight:700;font-size:13px">${e.quality}%</div><div style="font-weight:700;font-size:13px">${e.fcr}%</div><div style="font-weight:700;font-size:13px">${e.csat}</div><div style="font-weight:700;font-size:13px">${e.complaints}</div>
      <div class="row"><button class="icon-btn" onclick="openEvalForm('${e.id}')">${icon('edit', 15)}</button><button class="icon-btn danger" onclick="deleteEval('${e.id}')">${icon('trash', 15)}</button></div>
      <div class="eval-note">ملاحظة: ${esc(e.note) || 'لا توجد ملاحظة'}</div>
    </div>`;
}
function pageEvaluations() {
  const filtered = [...evaluations].filter(e => { const emp = employees.find(x => x.id === e.employeeId); return !evalQuery || (emp && emp.name.includes(evalQuery)); });
  const groups = monthGroups(filtered);
  const head = `<div class="page-header no-print"><div><h2>التقييمات</h2><p>مقسّمة إلى أشهر وأسابيع، مع موظف مميّز وتصدير خاص لكل شهر.</p></div>
    <div class="actions"><button class="btn soft" onclick="window.print()">${icon('printer', 16)} طباعة الكل</button><button class="btn" onclick="openEvalForm()">${icon('plus', 16)} تقييم جديد</button></div>
  </div>
  <div class="row" style="margin-bottom:16px"><input id="eval-search" placeholder="ابحثي عن موظف..." value="${esc(evalQuery)}" style="flex:1;max-width:320px;border:1px solid #ffe0c9;background:var(--cream);border-radius:16px;padding:10px 14px;outline:none" /></div>`;
  if (!groups.length) return head + `<div class="card">${emptyBlock('لا توجد تقييمات', 'جرّبي كلمة بحث مختلفة أو أضيفي تقييماً جديداً')}</div>`;
  const body = groups.map((g, gi) => `
    <details class="month-group" ${(gi === 0 || evalQuery) ? 'open' : ''}>
      <summary class="month-head"><span class="mnum">${g.ord}</span>
        <div><div class="mtitle">الشهر ${ordLabel(g.ord)} <span class="muted" style="font-weight:400">· ${g.label}</span></div><div class="msub">${g.items.length} تقييم عبر ${new Set(g.items.map(e => e.employeeId)).size} موظف</div></div>
        <button class="btn soft no-print" style="margin-inline-start:auto" onclick="event.preventDefault();event.stopPropagation();exportMonthExcel('${g.key}')">${icon('download', 15)} تصدير الشهر</button>
        <span class="chev">${icon('chevron', 16)}</span>
      </summary>
      <div class="month-body">
        ${monthStarCard(g.items)}
        ${g.weeks.map(w => `<details class="week-block" open><summary class="week-head"><span class="wnum">${w.w}</span> الأسبوع ${ordLabel(w.w)}<span class="wcount">${w.items.length} تقييم</span></summary>
          ${w.items.length ? `<div class="eval-row eval-head"><span>الموظف / التاريخ</span><span>الدرجة المركبة</span><span>Quality</span><span>FCR</span><span>CSAT</span><span>الشكاوى</span><span></span></div>${w.items.map(evalRowHtml).join('')}` : `<div class="week-empty">لا توجد تقييمات في هذا الأسبوع.</div>`}
        </details>`).join('')}
      </div>
    </details>`).join('');
  return head + body;
}
function deleteEval(id) { const e = evaluations.find(x => x.id === id); if (!confirm('حذف هذا التقييم؟')) return; const emp = employees.find(x => x.id === e.employeeId); evaluations = evaluations.filter(x => x.id !== id); persist(); addActivity('حذفت تقييماً', `${emp ? emp.name : ''} · ${e.date}`); render(); }
function openEvalForm(id) {
  const initial = id ? evaluations.find(e => e.id === id) : null;
  const activeEmp = employees.filter(e => e.active);
  openModal(`
    <div class="modal-head"><div><h3>${initial ? 'تعديل التقييم' : 'تقييم جديد'}</h3><p>أضيفي تفاصيل المكالمة بدقة ودفء</p></div><button class="icon-btn" onclick="closeModal()">${icon('x', 18)}</button></div>
    <form id="eval-form" class="grid cols-2">
      <label class="field"><span>تاريخ التقييم</span><input type="date" name="date" required value="${initial ? initial.date : today()}" /></label>
      <label class="field"><span>الموظف</span><select name="employeeId" required>${activeEmp.map(e => `<option value="${e.id}" ${initial && initial.employeeId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>عدد المكالمات</span><input type="number" min="0" name="calls" required value="${initial ? initial.calls : 100}" /></label>
      <label class="field"><span>Quality %</span><input type="number" min="0" max="100" step="0.1" name="quality" required value="${initial ? initial.quality : 90}" /></label>
      <label class="field"><span>FCR %</span><input type="number" min="0" max="100" step="0.1" name="fcr" required value="${initial ? initial.fcr : 85}" /></label>
      <label class="field"><span>Adherence %</span><input type="number" min="0" max="100" step="0.1" name="adherence" required value="${initial ? initial.adherence : 90}" /></label>
      <label class="field"><span>CSAT / 5</span><input type="number" min="0" max="5" step="0.1" name="csat" required value="${initial ? initial.csat : 4.5}" /></label>
      <label class="field"><span>الشكاوى</span><input type="number" min="0" name="complaints" required value="${initial ? initial.complaints : 0}" /></label>
      <label class="field"><span>وقت الاستراحة (دقيقة) — اختياري</span><input type="number" min="0" name="breakMin" placeholder="مثال: 45" value="${initial && initial.breakMin != null ? initial.breakMin : ''}" /></label>
      <label class="field" style="grid-column:1/-1"><span>ملاحظة المديرة</span><textarea name="note" rows="3" placeholder="ما الذي لفت انتباهك؟">${initial ? esc(initial.note) : ''}</textarea></label>
      <div class="actions" style="grid-column:1/-1;justify-content:flex-end">
        <button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn">${icon('check', 16)} حفظ التقييم</button>
      </div>
    </form>`);
  document.getElementById('eval-form').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const data = { date: f.get('date'), employeeId: f.get('employeeId'), calls: +f.get('calls'), quality: +f.get('quality'), fcr: +f.get('fcr'), adherence: +f.get('adherence'), csat: +f.get('csat'), complaints: +f.get('complaints'), breakMin: (f.get('breakMin') === null || f.get('breakMin') === undefined || f.get('breakMin') === '') ? null : +f.get('breakMin'), note: f.get('note') };
    const emp = employees.find(x => x.id === data.employeeId);
    if (initial) { evaluations = evaluations.map(x => x.id === initial.id ? { ...data, id: initial.id } : x); addActivity('عدّلت تقييماً', emp ? emp.name : ''); }
    else { evaluations = [{ ...data, id: 'v' + Date.now() }, ...evaluations]; addActivity('أضافت تقييماً', emp ? emp.name : ''); }
    persist(); closeModal(); render();
  };
}

/* ============================== إدخال جماعي ============================== */
let bulkMonth = today().slice(0, 7);
let bulkWeek = 1;
let bulkDay = (() => { const d = +today().slice(8, 10); return Math.max(1, Math.min(7, d - (Math.ceil(d / 7) - 1) * 7)); })();
function daysInMonth(monthKey) { const [y, m] = monthKey.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function computeBulkDate() { const dim = daysInMonth(bulkMonth); const day = Math.min(dim, (bulkWeek - 1) * 7 + bulkDay); return `${bulkMonth}-${String(day).padStart(2, '0')}`; }
let bulkDate = computeBulkDate();
function bulkSetPeriod(field, val) { if (field === 'month') bulkMonth = val || today().slice(0, 7); if (field === 'week') bulkWeek = +val; if (field === 'day') bulkDay = +val; bulkDate = computeBulkDate(); bulkRows = {}; render(); }
let bulkRows = {};
const BULK_FIELDS = ['calls', 'quality', 'fcr', 'adherence', 'csat', 'complaints', 'breakMin'];
function bulkRow(id) {
  if (bulkRows[id]) return bulkRows[id];
  const ex = evaluations.find(v => v.employeeId === id && v.date === bulkDate);
  const s = x => (x === null || x === undefined) ? '' : String(x);
  return ex ? { calls: s(ex.calls), quality: s(ex.quality), fcr: s(ex.fcr), adherence: s(ex.adherence), csat: s(ex.csat), complaints: s(ex.complaints), breakMin: s(ex.breakMin) }
            : { calls: '', quality: '', fcr: '', adherence: '', csat: '', complaints: '', breakMin: '' };
}
function bulkSet(id, field, val) {
  bulkRows[id] = { ...bulkRow(id), [field]: val };
  if (field === 'breakMin') { const el = document.getElementById('bb-' + id); if (el) el.innerHTML = breakBadge(val === '' ? null : Number(val)); }
}
function bulkInput(id, field, max, step, ph) {
  return `<input class="cell" type="number" inputmode="decimal" min="0" ${max !== '' ? `max="${max}"` : ''} step="${step}" placeholder="${ph}" value="${esc(bulkRow(id)[field])}" oninput="bulkSet('${id}','${field}',this.value)" />`;
}
function pageBulk() {
  const active = employees.filter(e => e.active);
  const head = `<div class="page-header"><div><h2>إدخال جماعي</h2><p>سجّلي قياسات يوم واحد للفريق: المكالمات والجودة والمؤشرات ووقت الاستراحة.</p></div>
    <div class="actions"><button class="btn soft" onclick="bulkRows={};render()">تفريغ الحقول</button><button class="btn" onclick="saveBulk()">${icon('check', 16)} حفظ الكل</button></div></div>`;
  if (!active.length) return head + `<div class="card">${emptyBlock('لا يوجد موظفون نشطون', 'أضيفي موظفين من صفحة «الموظفون» أولاً')}</div>`;
  return head + `
  <div class="card filters" style="margin-bottom:16px"><div class="filters-grid">
    <label class="field"><span>الشهر</span><input type="month" value="${bulkMonth}" onchange="bulkSetPeriod('month',this.value)" /></label>
    <label class="field"><span>الأسبوع داخل الشهر</span><select onchange="bulkSetPeriod('week',this.value)">${[1, 2, 3, 4].map(w => `<option value="${w}" ${w === bulkWeek ? 'selected' : ''}>الأسبوع ${ordLabel(w)}</option>`).join('')}</select></label>
    <label class="field"><span>اليوم داخل الأسبوع</span><select onchange="bulkSetPeriod('day',this.value)">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${d === bulkDay ? 'selected' : ''}>يوم ${d}</option>`).join('')}</select></label>
    <div class="field"><span>سيُحفظ في</span><div class="row" style="gap:8px;flex-wrap:wrap"><span class="badge lavender">الشهر ${ordLabel(monthOrdinal(bulkMonth))}</span><span class="badge peach">الأسبوع ${ordLabel(bulkWeek)}</span><b class="display" style="font-size:14px">${bulkDate}</b></div></div>
  </div>
  <div class="row" style="margin-top:12px;flex-wrap:wrap;gap:16px"><div class="row" style="gap:10px"><span class="muted" style="font-size:12px">الحد المسموح للاستراحة:</span><b class="display" style="font-size:16px">${config.breaks.limit} دقيقة</b><a href="#/settings" style="font-size:11px;font-weight:800;color:#b5470f">تغيير</a></div>${breakLegend()}</div>
  </div>
  <div class="card table-card"><div class="table-scroll"><table class="tbl bulk"><thead><tr><th>الموظف</th><th>المكالمات</th><th>Quality %</th><th>FCR %</th><th>Adherence %</th><th>CSAT (0-5)</th><th>الشكاوى</th><th>الاستراحة (د)</th><th>الحالة</th></tr></thead><tbody>
  ${active.map(e => { const ex = evaluations.some(v => v.employeeId === e.id && v.date === bulkDate), r = bulkRow(e.id); return `<tr>
    <td><div class="eval-emp"><span class="avatar sm" style="background:${avatarBg(e)}">${esc(e.name[0])}</span><span><b>${esc(e.name)}</b><div class="muted" style="font-size:11px">${esc(e.role)}</div></span></div></td>
    <td>${bulkInput(e.id, 'calls', '', 1, '0')}</td><td>${bulkInput(e.id, 'quality', 100, 0.1, '90')}</td><td>${bulkInput(e.id, 'fcr', 100, 0.1, '85')}</td><td>${bulkInput(e.id, 'adherence', 100, 0.1, '94')}</td><td>${bulkInput(e.id, 'csat', 5, 0.1, '4.5')}</td><td>${bulkInput(e.id, 'complaints', '', 1, '0')}</td>
    <td><div class="row" style="gap:8px">${bulkInput(e.id, 'breakMin', '', 1, '0')}<span id="bb-${e.id}">${breakBadge(r.breakMin === '' ? null : Number(r.breakMin))}</span></div></td>
    <td class="muted" style="font-size:11px;white-space:nowrap">${ex ? 'سجل مسبق — سيُحدَّث' : 'جديد'}</td></tr>`; }).join('')}
  </tbody></table></div></div>
  <p class="muted" style="font-size:12px;margin-top:12px">الصفوف الفارغة تماماً تُتجاهل. عند تعبئة صف يلزم إدخال Quality وFCR وAdherence وCSAT؛ أما المكالمات والشكاوى والاستراحة فاختيارية.</p>`;
}
function saveBulk() {
  const active = employees.filter(e => e.active);
  const errors = [], ready = [];
  const need = { quality: 'Quality', fcr: 'FCR', adherence: 'Adherence', csat: 'CSAT' };
  active.forEach(emp => {
    const r = bulkRow(emp.id);
    if (BULK_FIELDS.every(k => String(r[k]).trim() === '')) return;
    const missing = Object.keys(need).filter(k => String(r[k]).trim() === '').map(k => need[k]);
    if (missing.length) { errors.push(`${emp.name}: أكملي ${missing.join('، ')}`); return; }
    const n = k => Number(r[k]), bad = [];
    ['quality', 'fcr', 'adherence'].forEach(k => { if (isNaN(n(k)) || n(k) < 0 || n(k) > 100) bad.push(need[k] + ' (0–100)'); });
    if (isNaN(n('csat')) || n('csat') < 0 || n('csat') > 5) bad.push('CSAT (0–5)');
    [['calls', 'المكالمات'], ['complaints', 'الشكاوى'], ['breakMin', 'الاستراحة']].forEach(([k, l]) => { if (String(r[k]).trim() !== '' && (isNaN(n(k)) || n(k) < 0)) bad.push(l + ' غير صالحة'); });
    if (bad.length) errors.push(`${emp.name}: ${bad.join('، ')}`); else ready.push({ emp, r });
  });
  if (errors.length) { alert('لم يُحفظ شيء. صحّحي التالي:\n' + errors.join('\n')); return; }
  if (!ready.length) { alert('لا توجد بيانات لحفظها. أدخلي قيم موظف واحد على الأقل.'); return; }
  ready.forEach(({ emp, r }, i) => {
    const old = evaluations.find(v => v.employeeId === emp.id && v.date === bulkDate);
    const data = { date: bulkDate, employeeId: emp.id, calls: r.calls === '' ? 0 : Number(r.calls), quality: Number(r.quality), fcr: Number(r.fcr), adherence: Number(r.adherence), csat: Number(r.csat), complaints: r.complaints === '' ? 0 : Number(r.complaints), breakMin: r.breakMin === '' ? null : Number(r.breakMin), note: old ? old.note : '' };
    if (old) evaluations = evaluations.map(x => x.id === old.id ? { ...data, id: old.id } : x);
    else evaluations = [{ ...data, id: 'v' + Date.now() + '_' + i }, ...evaluations];
  });
  persist(); addActivity('حفظ إدخالات جماعية', `${ready.length} موظف · ${bulkDate}`); bulkRows = {};
  alert(`تم حفظ ${ready.length} سجل بنجاح`); render();
}

/* ============================== الموظفون ============================== */
function pageEmployees() {
  return `
  <div class="page-header"><div><h2>الموظفون</h2><p>دليل فريقك في لمحة. تابعي الحالة، المسؤوليات، واتركي مساحة للنمو.</p></div>
    <div class="actions"><button class="btn" onclick="openEmployeeForm()">${icon('plus', 16)} إضافة موظف</button></div>
  </div>
  <div class="row" style="margin-bottom:16px"><span class="badge mint">${employees.filter(e => e.active).length} نشطة</span><span class="badge peach">${employees.filter(e => !e.active).length} متوقفة مؤقتاً</span></div>
  <div class="grid cols-3">
    ${employees.map(e => { const hasEval = evaluations.some(v => v.employeeId === e.id); return `
    <div class="card" style="${e.active ? '' : 'opacity:.65'};border-top:4px solid ${avatarBg(e)}">
      <div class="between" style="margin-bottom:16px"><span class="avatar lg" style="background:${avatarBg(e)}">${e.name[0]}</span>
        <div class="row"><button class="icon-btn" onclick='openEmployeeForm(${JSON.stringify(e.id)})'>${icon('edit', 15)}</button><button class="icon-btn" onclick="toggleEmployee('${e.id}')">${icon('zap', 15)}</button><button class="icon-btn danger" ${hasEval ? 'disabled title="لا يمكن حذف موظف لديه تقييمات"' : ''} onclick="deleteEmployee('${e.id}')">${icon('trash', 15)}</button></div>
      </div>
      <div style="font-weight:800;font-size:15px">${esc(e.name)}</div>
      <div class="muted" style="font-size:12px;margin-top:2px">${esc(e.role)}</div>
      <div class="between" style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)"><span class="badge ${e.active ? 'mint' : 'peach'}">${e.active ? 'نشطة' : 'متوقفة مؤقتاً'}</span><a href="#/employee-report?employee=${e.id}" style="font-size:11px;font-weight:800;color:#aa7c62">عرض التقرير ${icon('chevron', 12)}</a></div>
    </div>`; }).join('')}
  </div>`;
}
function toggleEmployee(id) { const e = employees.find(x => x.id === id); employees = employees.map(x => x.id === id ? { ...x, active: !x.active } : x); persist(); addActivity(e.active ? 'أوقفت موظفاً مؤقتاً' : 'فعّلت موظفاً', e.name); render(); }
function deleteEmployee(id) {
  const e = employees.find(x => x.id === id);
  if (!e) return;
  if (evaluations.some(x => x.employeeId === id)) { alert(`لا يمكن حذف ${e.name} نهائياً لوجود تقييمات مسجّلة لها/له. يمكنك إيقافها/إيقافه مؤقتاً بدلاً من ذلك.`); return; }
  if (!confirm(`حذف ${e.name} نهائياً؟`)) return;
  employees = employees.filter(x => x.id !== id); persist(); addActivity('حذفت موظفاً', e.name); render();
}
function openEmployeeForm(id) {
  const initial = id ? employees.find(e => e.id === id) : null;
  const colors = AVATAR_COLORS;
  const current = initial ? initial.avatarColor : colors[employees.length % colors.length];
  openModal(`
    <div class="modal-head"><h3>${initial ? 'تعديل موظف' : 'موظف جديد'}</h3><button class="icon-btn" onclick="closeModal()">${icon('x', 18)}</button></div>
    <form id="emp-form">
      <label class="field"><span>الاسم</span><input name="name" required placeholder="مثال: مها السالم" value="${initial ? esc(initial.name) : ''}" /></label>
      <label class="field"><span>المسمى الوظيفي</span><input name="role" required value="${initial ? esc(initial.role) : 'أخصائية خدمة عملاء'}" /></label>
      <div class="field"><span>لون الصورة (${colors.length} لوناً)</span><div class="row" id="color-pick" style="flex-wrap:wrap;gap:8px">${colors.map(c => `<button type="button" data-c="${c}" onclick="pickColor('${c}')" style="width:32px;height:32px;border-radius:10px;background:${c};border:${current === c ? '3px solid #4a2c17' : '2px solid transparent'};box-shadow:0 0 0 1px #ffe0c9"></button>`).join('')}</div></div>
      <input type="hidden" name="avatarColor" value="${current}" />
      <div class="actions" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button><button type="submit" class="btn">${icon('check', 16)} حفظ</button></div>
    </form>`);
  document.getElementById('emp-form').onsubmit = ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const data = { name: f.get('name'), role: f.get('role'), avatarColor: f.get('avatarColor'), active: initial ? initial.active : true };
    if (initial) { employees = employees.map(x => x.id === initial.id ? { ...data, id: initial.id } : x); addActivity('عدّلت بيانات موظف', data.name); }
    else { employees = [...employees, { ...data, id: 'e' + Date.now() }]; addActivity('أضافت موظفاً', data.name); }
    persist(); closeModal(); render();
  };
}
function pickColor(c) { document.querySelector('#emp-form [name=avatarColor]').value = c; document.querySelectorAll('#color-pick button').forEach(b => b.style.border = b.dataset.c === c ? '3px solid #4a2c17' : '2px solid transparent'); }

/* ============================== تقرير الموظف ============================== */
let empRep = { emp: '', from: '', to: '' };
function empInsights(st, team, trend) {
  const { good, opp } = baseInsights(st, trend);
  if (team.n) {
    const s = Math.round(st.score), t = Math.round(team.score);
    if (s >= t) good.unshift(`الأداء العام أعلى من متوسط الفريق أو مساوٍ له (${s}% مقابل ${t}%).`);
    else opp.unshift(`الأداء العام أقل من متوسط الفريق (${s}% مقابل ${t}%).`);
  }
  if (st.n && st.complaints / st.n >= 2) opp.push(`متوسط ${fmtNum(st.complaints / st.n, 1)} شكوى لكل تقييم.`);
  return { good, opp };
}
function pageEmployeeReport(params) {
  const head = `<div class="page-header no-print"><div><h2>تقارير الموظفين</h2><p>اختاري موظفاً وفترة زمنية لعرض كل تقييماته وسجلاته وطباعتها.</p></div></div>`;
  if (!employees.length) return head + `<div class="card">${emptyBlock('لا يوجد موظفون', 'أضيفي موظفاً أولاً من صفحة الموظفين')}</div>`;
  const p = params.get('employee'); if (p && employees.some(e => e.id === p)) empRep.emp = p;
  const emp = employees.find(e => e.id === empRep.emp) || employees.find(e => e.active) || employees[0];
  empRep.emp = emp.id;
  const list = evaluations.filter(e => inRange(e, empRep.from, empRep.to, emp.id)).sort((a, b) => a.date.localeCompare(b.date));
  const st = statsFor(list), team = statsFor(evaluations.filter(e => inRange(e, empRep.from, empRep.to, 'all')));
  const trend = list.map(e => ({ label: e.date, value: score(e) }));
  const period = periodText(list, empRep.from, empRep.to);
  const empSel = `<label class="field"><span>الموظف</span><select onchange="location.hash='#/employee-report?employee='+this.value">${employees.map(e => `<option value="${e.id}" ${e.id === emp.id ? 'selected' : ''}>${esc(e.name)}${e.active ? '' : ' (متوقف)'}</option>`).join('')}</select></label>`;
  const actions = `<div class="actions no-print" style="margin-bottom:16px"><button class="btn soft" onclick="window.print()">${icon('printer', 16)} طباعة التقرير</button><button class="btn" onclick="exportElementToPdf(document.getElementById('emp-report-area'),'employee-report-${emp.id}-${today()}.pdf')">${icon('download', 16)} تصدير PDF</button></div>`;
  const s = Math.round(st.score), lvl = statusOf(s);
  const band = `<div class="rep-band"><div class="row">${icon('shield', 26)}<div><div class="display" style="font-size:19px">نظام إدارة الجودة</div><div style="font-size:12px;opacity:.8">تقرير أداء موظف</div></div></div><div style="text-align:left;font-size:12px;line-height:1.8"><div>الفترة: <b>${period}</b></div><div>تاريخ الإصدار: <b>${fmtDate(today())}</b></div></div></div>`;
  const who = `<div class="rep-emp"><span class="avatar lg" style="background:${avatarBg(emp)}">${esc(emp.name[0])}</span><div style="flex:1"><h2 class="display" style="margin:0;font-size:26px">${esc(emp.name)}</h2><div class="muted">${esc(emp.role)}</div></div>
    ${list.length ? `<div class="report-score"><div class="num">${s}%</div><span class="badge ${lvl[1]}">${lvl[0]}</span></div>` : ''}</div>`;
  if (!list.length) return head + filterBar('empRep', empRep, empSel) + actions + `<div id="emp-report-area" class="report-box">${band}${who}${emptyBlock('لا توجد تقييمات في هذه الفترة', 'غيّري الفترة الزمنية أو أضيفي تقييمات لهذا الموظف.')}</div>`;
  const ins = empInsights(st, team, trend);
  const table = `<div class="table-scroll"><table class="tbl compact"><thead><tr><th>التاريخ</th><th>المكالمات</th><th>Quality</th><th>FCR</th><th>Adherence</th><th>CSAT</th><th>الشكاوى</th><th>الاستراحة</th><th>الدرجة</th><th>المستوى</th><th>الملاحظة</th></tr></thead><tbody>
    ${[...list].reverse().map(e => { const sc = score(e), l = statusOf(sc); return `<tr><td style="white-space:nowrap">${e.date}</td><td>${e.calls}</td><td>${e.quality}%</td><td>${e.fcr}%</td><td>${e.adherence}%</td><td>${e.csat}</td><td>${e.complaints}</td><td>${breakBadge(e.breakMin)}</td><td><b>${sc}%</b></td><td><span class="badge ${l[1]}">${l[0]}</span></td><td class="note-cell">${esc(e.note) || '—'}</td></tr>`; }).join('')}
    <tr class="total"><td>المتوسط / الإجمالي</td><td>${fmtNum(st.calls, 0)}</td><td>${fmtNum(st.quality, 1)}%</td><td>${fmtNum(st.fcr, 1)}%</td><td>${fmtNum(st.adherence, 1)}%</td><td>${fmtNum(st.csat, 2)}</td><td>${st.complaints}</td><td>${st.breakN ? breakBadge(Math.round(st.breakAvg)) : '—'}</td><td><b>${s}%</b></td><td colspan="2"></td></tr></tbody></table></div>`;
  const brk = st.breakN ? `<div class="grid cols-4 kpis" style="margin-top:14px">${kpi('متوسط الاستراحة', breakBadge(Math.round(st.breakAvg)), `الحد المسموح ${config.breaks.limit} د`)}${kpi('ضمن الحد', st.breakOk, 'أقل من الحد')}${kpi('عند الحد', st.breakAt, `${config.breaks.limit} دقيقة تماماً`)}${kpi('تجاوز الحد', st.breakOver, st.breakOver ? 'يحتاج متابعة' : 'لا تجاوزات')}</div>` : '';
  return head + filterBar('empRep', empRep, empSel) + actions + `<div id="emp-report-area" class="report-box">${band}${who}
    <div class="grid cols-4 kpis" style="margin:20px 0 14px">${kpi('عدد التقييمات', st.n, `إجمالي المكالمات ${fmtNum(st.calls, 0)}`, 'accent')}${METRICS.slice(0, 3).map(m => kpiMetric(m.key, st)).join('')}</div>
    <div class="grid cols-4 kpis">${kpiMetric('csat', st)}${kpi('الشكاوى', st.complaints, `المتوسط ${fmtNum(st.complaints / st.n, 1)} لكل تقييم`)}${kpi('متوسط الفريق', Math.round(team.score) + '%', 'لنفس الفترة')}${kpi('الفرق عن الفريق', ltr((s - Math.round(team.score) >= 0 ? '+' : '') + (s - Math.round(team.score))), 'نقطة')}</div>
    ${brk}
    <section style="margin-top:22px" class="avoid-break"><h3 class="section-title">مسار الأداء خلال الفترة</h3>${lineChart(trend, config.thresholds.excellent, 'حد التميّز')}</section>
    <section style="margin-top:18px" class="avoid-break">${insightBlock(ins.good, ins.opp)}</section>
    <section style="margin-top:22px"><h3 class="section-title" style="margin-bottom:10px">سجل التقييمات التفصيلي</h3>${table}</section>
    <div class="rep-foot">أُعدّ بواسطة نظام إدارة الجودة · ${fmtDate(today())}</div></div>`;
}

/* ============================== التقرير الشهري ============================== */
let monthlyMonth = '';
function prevMonth(m) { const [y, mo] = m.split('-').map(Number), d = new Date(y, mo - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function pageMonthly() {
  const head = `<div class="page-header no-print"><div><h2>التقرير الشهري الرسمي</h2><p>تقرير شامل معدّ للتقديم المباشر إلى الإدارة العليا.</p></div></div>`;
  const months = [...new Set(evaluations.map(e => e.date.slice(0, 7)))].sort().reverse();
  if (!months.length) return head + `<div class="card">${emptyBlock('لا توجد تقييمات بعد', 'أضيفي تقييمات لإنشاء التقرير الشهري')}</div>`;
  const month = months.includes(monthlyMonth) ? monthlyMonth : months[0];
  const list = evaluations.filter(e => e.date.startsWith(month));
  const st = statsFor(list), rows = empRows(list), trend = trendSeries(list);
  const prevList = evaluations.filter(e => e.date.startsWith(prevMonth(month))), prev = prevList.length ? statsFor(prevList) : null;
  const monthLabel = new Date(month + '-01T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });
  const s = Math.round(st.score), lvl = statusOf(s), lv = levelCounts(rows), ins = teamInsights(st, rows, trend);
  const delta = prev ? s - Math.round(prev.score) : null;
  const top = rows[0], support = rows.filter(r => Math.round(r.st.score) < config.thresholds.needs);
  const offenders = tableRowsBreakOffenders(list);
  const compliance = st.breakN ? Math.round((st.breakOk + st.breakAt) / st.breakN * 100) : null;
  const actions = `<div class="actions no-print" style="margin-bottom:16px"><select class="btn soft" onchange="monthlyMonth=this.value;render()" style="border:none">${months.map(m => `<option value="${m}" ${m === month ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <button class="btn soft" onclick="window.print()">${icon('printer', 16)} طباعة</button><button class="btn" onclick="exportElementToPdf(document.getElementById('monthly-report-area'),'monthly-report-${month}.pdf');addActivity('صدّرت التقرير الرسمي','${month}')">${icon('download', 16)} تصدير PDF</button></div>`;
  const sec = (n, t, body, cls) => `<section class="rsec ${cls || 'avoid-break'}"><h3 class="rsec-title"><span class="n${(n - 1) % 7}">${n}</span>${t}</h3>${body}</section>`;
  const empTable = `<div class="table-scroll"><table class="tbl compact"><thead><tr><th>#</th><th>الموظف</th><th>التقييمات</th><th>الأداء</th><th>Quality</th><th>FCR</th><th>Adherence</th><th>CSAT</th><th>المكالمات</th><th>الشكاوى</th><th>الاستراحة</th><th>الأهداف</th><th>المستوى</th></tr></thead><tbody>
    ${rows.map((r, i) => { const sc = Math.round(r.st.score), l = statusOf(sc), h = goalsHit(r.st); return `<tr><td><span class="rank r${i + 1}">${i + 1}</span></td><td><b>${esc(r.emp.name)}</b><div class="muted" style="font-size:10px">${esc(r.emp.role)}</div></td><td>${r.st.n}</td><td><b>${sc}%</b></td><td>${fmtNum(r.st.quality, 1)}%</td><td>${fmtNum(r.st.fcr, 1)}%</td><td>${fmtNum(r.st.adherence, 1)}%</td><td>${fmtNum(r.st.csat, 2)}</td><td>${fmtNum(r.st.calls, 0)}</td><td>${r.st.complaints}</td><td>${r.st.breakN ? breakBadge(Math.round(r.st.breakAvg)) : '—'}${r.st.breakOver ? `<div class="muted" style="font-size:10px">${r.st.breakOver} تجاوز</div>` : ''}</td><td>${h.filter(Boolean).length}/4</td><td><span class="badge ${l[1]}">${l[0]}</span></td></tr>`; }).join('')}
    </tbody></table></div>`;
  const breakBody = st.breakN ? `<div class="grid cols-4 kpis">${kpi('الحد المسموح', config.breaks.limit + ' د', 'يومياً لكل موظف')}${kpi('نسبة الالتزام', compliance + '%', `${st.breakOk + st.breakAt} من ${st.breakN} سجل`)}${kpi('متوسط الاستراحة', breakBadge(Math.round(st.breakAvg)), `${st.breakOk} ضمن · ${st.breakAt} عند الحد`)}${kpi('حالات التجاوز', st.breakOver, st.breakOver ? 'أكثر من الحد' : 'لا تجاوزات')}</div>
    ${offenders.length ? `<div class="table-scroll" style="margin-top:14px"><table class="tbl compact"><thead><tr><th>التاريخ</th><th>الموظف</th><th>الاستراحة</th><th>التجاوز</th></tr></thead><tbody>${offenders.map(e => { const em = employees.find(x => x.id === e.employeeId); return `<tr><td>${e.date}</td><td>${esc(em ? em.name : '—')}</td><td>${breakBadge(e.breakMin)}</td><td>${ltr('+' + (Number(e.breakMin) - config.breaks.limit))} د</td></tr>`; }).join('')}</tbody></table></div>` : ''}` : '<p class="muted">لم تُسجَّل بيانات استراحة لهذا الشهر.</p>';
  return head + actions + `<div id="monthly-report-area" class="report-box official">
    <div class="rep-cover"><div class="row" style="gap:14px">${icon('shield', 34)}<div><div class="display" style="font-size:20px">نظام إدارة الجودة</div><div style="font-size:12px;opacity:.85">إدارة الجودة وخدمة العملاء</div></div></div>
      <div style="text-align:center;margin:26px 0 6px"><div style="font-size:13px;letter-spacing:.06em;opacity:.85">التقرير الشهري الرسمي</div><h1 class="display" style="font-size:38px;margin:6px 0">${monthLabel}</h1><div style="font-size:12px;opacity:.85">مقدَّم إلى الإدارة العليا · تاريخ الإصدار ${fmtDate(today())}</div></div></div>
    <div class="grid cols-4 kpis" style="margin:22px 0">${kpi('النتيجة الإجمالية', s + '%', `<span class="badge ${lvl[1]}">${lvl[0]}</span>`, 'accent')}${kpi('مقارنة بالشهر السابق', delta === null ? '—' : ltr((delta >= 0 ? '+' : '') + delta), delta === null ? 'لا توجد بيانات للشهر السابق' : 'نقطة عن ' + prevMonth(month))}${kpi('التقييمات المنجزة', st.n, `${rows.length} موظف`)}${kpi('إجمالي المكالمات', fmtNum(st.calls, 0), `${st.complaints} شكوى`)}</div>
    ${sec(1, 'الملخص التنفيذي', `<p style="line-height:2;font-size:14px;margin:0">${esc(summaryText(st, rows, monthLabel))}</p>${insightBlock(ins.good, ins.opp)}`)}
    ${sec(2, 'المؤشرات الرئيسية مقابل الأهداف', `<div class="grid cols-2"><div>${goalsCard(st, 'تحقيق الأهداف')}</div><div class="grid cols-2" style="align-content:start">${METRICS.map(m => kpiMetric(m.key, st)).join('')}</div></div>`)}
    ${sec(3, 'التحليل البياني', `<div class="grid cols-2 charts"><div><h4 class="chart-h">مسار الأداء اليومي</h4>${lineChart(trend, config.thresholds.excellent, 'حد التميّز')}</div><div><h4 class="chart-h">تقسيم الموظفين حسب المستوى</h4>${donutChart([{ label: 'ممتاز', value: lv.ex, color: '#ff7a1a' }, { label: 'جيد', value: lv.good, color: '#ffb27a' }, { label: 'يحتاج تحسين', value: lv.need, color: '#ffd9b9' }])}</div></div>`)}
    ${sec(4, 'أداء الموظفين التفصيلي', empTable, 'page-break')}
    ${sec(5, 'التميّز والدعم', `<div class="grid cols-2"><div class="card highlight"><h4 style="margin:0 0 8px">موظف الشهر</h4><div class="row"><span class="avatar lg" style="background:${avatarBg(top.emp)}">${esc(top.emp.name[0] || '?')}</span><div><b style="font-size:16px">${esc(top.emp.name)}</b><div class="muted" style="font-size:12px">متوسط الأداء ${Math.round(top.st.score)}%</div></div></div></div><div class="card"><h4 style="margin:0 0 8px">موظفون يحتاجون دعماً</h4>${support.length ? `<ul class="plain">${support.map(r => `<li><b>${esc(r.emp.name)}</b> — ${Math.round(r.st.score)}%</li>`).join('')}</ul>` : '<span class="muted">لا يوجد موظف دون حد الدعم هذا الشهر.</span>'}</div></div>`)}
    ${sec(6, 'الالتزام بالاستراحات', breakBody)}
    ${sec(7, 'التوصيات', `<ol class="recs">${recommendations(st, rows).map(r => `<li>${esc(r)}</li>`).join('')}</ol>`)}
    <div class="sign-grid avoid-break"><div><span>إعداد</span><div class="sline"></div><small>مديرة الجودة</small></div><div><span>مراجعة</span><div class="sline"></div><small>قائدة الفريق</small></div><div><span>اعتماد</span><div class="sline"></div><small>مدير الإدارة</small></div></div>
    <div class="rep-foot">تقرير سري — للاستخدام الداخلي · نظام إدارة الجودة</div></div>`;
}

/* ============================== سجل النشاط ============================== */
function pageActivity() {
  return `
  <div class="page-header"><div><h2>سجل النشاط</h2><p>كل تغيير مهم، في مكان واضح يمكن الرجوع إليه.</p></div>
    <div class="actions"><button class="btn soft" onclick='downloadJSON("quality-activity-"+new Date().toISOString().slice(0,10)+".json", activities)'>${icon('download', 16)} تصدير السجل</button></div>
  </div>
  <div class="card">
    <div class="row" style="margin-bottom:20px"><div class="c-amber" style="border-radius:14px;padding:10px">${icon('zap', 19)}</div><div><h3 class="section-title">الحركات الأخيرة</h3><p class="muted" style="font-size:11px">مسجّلة تلقائياً في متصفحك</p></div></div>
    <div class="timeline">${activities.map(a => `<div class="item"><div class="between" style="flex-wrap:wrap;gap:6px"><div><div style="font-size:13px;font-weight:800">${esc(a.user)} <span style="font-weight:400;color:#9b6d53">${esc(a.action)}</span></div><div style="margin-top:3px;font-size:13px;color:#a6765b">${esc(a.detail)}</div></div><div class="t">${fmtDateTime(a.at)}</div></div></div>`).join('') || emptyBlock('لا يوجد نشاط بعد', '')}</div>
  </div>`;
}

/* ============================== الإعدادات ============================== */
function pageSettings() {
  ensurePending();
  return `
  <div class="page-header"><div><h2>الإعدادات</h2><p>اضبطي ما تعنيه الجودة لفريقك، واحتفظي بنسخة من إعداداتك.</p></div>
    <div class="actions"><button class="btn" id="save-settings-btn" onclick="saveSettings()">${icon('check', 16)} حفظ التغييرات</button></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><div class="row" style="margin-bottom:16px"><div class="c-blue" style="border-radius:14px;padding:10px">${icon('dashboard', 19)}</div><div><h3 class="section-title">أوزان المؤشرات</h3><p class="muted" style="font-size:11px">كيف تُحسب الدرجة المركبة؟</p></div></div>
      ${sliderRow('weights', 'quality', 'Quality', config.weights.quality, '%', 100)}
      ${sliderRow('weights', 'fcr', 'FCR', config.weights.fcr, '%', 100)}
      ${sliderRow('weights', 'adherence', 'Adherence', config.weights.adherence, '%', 100)}
      ${sliderRow('weights', 'csat', 'CSAT', config.weights.csat, '%', 100)}
    </div>
    <div class="card"><div class="row" style="margin-bottom:16px"><div class="c-purple" style="border-radius:14px;padding:10px">${icon('report', 19)}</div><div><h3 class="section-title">الأهداف الشهرية</h3><p class="muted" style="font-size:11px">المستوى الذي يحتفل به فريقك</p></div></div>
      ${sliderRow('targets', 'quality', 'Quality', config.targets.quality, '%', 100)}
      ${sliderRow('targets', 'fcr', 'FCR', config.targets.fcr, '%', 100)}
      ${sliderRow('targets', 'adherence', 'Adherence', config.targets.adherence, '%', 100)}
      ${sliderRow('targets', 'csat', 'CSAT', config.targets.csat, ' من 5', 5, .1)}
    </div>
    <div class="card"><div class="row" style="margin-bottom:16px"><div class="c-amber" style="border-radius:14px;padding:10px">${icon('shield', 19)}</div><div><h3 class="section-title">حدود التقييم</h3><p class="muted" style="font-size:11px">متى نحتاج إلى احتفال أو جلسة دعم؟</p></div></div>
      ${sliderRow('thresholds', 'excellent', 'ممتاز من', config.thresholds.excellent, '%', 100)}
      ${sliderRow('thresholds', 'needs', 'يحتاج دعماً تحت', config.thresholds.needs, '%', 100)}
    </div>
    <div class="card"><div class="row" style="margin-bottom:16px"><div class="c-teal" style="border-radius:14px;padding:10px">${icon('clock', 19)}</div><div><h3 class="section-title">الاستراحات</h3><p class="muted" style="font-size:11px">الحد اليومي المسموح لكل موظف</p></div></div>
      ${sliderRow('breaks', 'limit', 'الحد المسموح للاستراحة', config.breaks.limit, ' دقيقة', 240)}
      ${breakLegend()}
      <p class="muted" style="font-size:11px;line-height:1.8;margin:12px 0 0">أخضر: أقل من الحد · برتقالي: يساوي الحد تماماً · أحمر: يتجاوز الحد.</p>
    </div>
    <div class="card"><div class="row" style="margin-bottom:16px"><div class="c-indigo" style="border-radius:14px;padding:10px">${icon('upload', 19)}</div><div><h3 class="section-title">النسخ والاستيراد</h3><p class="muted" style="font-size:11px">استعيدي بيانات النظام أو احفظيها في ملف مستقل</p></div></div>
      <div class="grid cols-2">
        <button class="btn soft" onclick='downloadJSON("quality-backup-"+new Date().toISOString().slice(0,10)+".json", {employees,evaluations,activities,config}); addActivity("صدّرت نسخة احتياطية","بيانات النظام كاملة")'>${icon('download', 16)} تصدير JSON</button>
        <label class="btn soft" style="cursor:pointer;justify-content:center">${icon('upload', 16)} استيراد JSON<input type="file" accept=".json" class="hidden" onchange="importJSON(this.files[0]);this.value=''" /></label>
        <button class="btn soft" onclick="exportExcel()">${icon('download', 16)} تصدير Excel</button>
        <label class="btn soft" style="cursor:pointer;justify-content:center">${icon('upload', 16)} استيراد Excel<input type="file" accept=".xlsx,.xls" class="hidden" onchange="importExcel(this.files[0]);this.value=''" /></label>
      </div>
      <button class="btn danger" style="margin-top:12px;width:100%;justify-content:center" onclick="clearData()">${icon('trash', 16)} مسح كل البيانات محلياً والبدء من الصفر</button>
      <div class="card" style="background:var(--lavender);margin-top:16px;font-size:11px;font-weight:700;line-height:1.7;color:#845d47">تتضمن النسخة الموظفات والتقييمات وسجل النشاط والإعدادات، ويمكن نقلها بين نسخ النظام.</div>
    </div>
    <div class="card"><div class="row" style="margin-bottom:16px"><div class="c-rose" style="border-radius:14px;padding:10px">${icon('lock', 19)}</div><div><h3 class="section-title">الأمان والدخول</h3><p class="muted" style="font-size:11px">حساب الدخول يُدار بالكامل من Supabase</p></div></div>
      <p class="muted" style="font-size:12.5px;line-height:1.9">الدخول إلى هذا النظام محصور بحساب واحد تُديرينه من <b>Supabase Dashboard → Authentication → Users</b> — لا يوجد اسم مستخدم أو كلمة مرور محفوظة داخل الكود. لتغيير كلمة المرور أو البريد الإلكتروني، افتحي ذلك الحساب من هناك مباشرة.</p>
      <p class="muted" style="font-size:12.5px;line-height:1.9;margin-top:10px">البريد الحالي لهذه الجلسة: <b>${esc((authSession && authSession.user.email) || '—')}</b></p>
    </div>
  </div>`;
}
function bindSettings() {}
function sliderRow(group, key, label, value, suffix, max, step) {
  return `<label class="slider-row"><div class="top"><span>${label}</span><b>${value}${suffix}</b></div><input type="range" min="0" max="${max}" step="${step || 1}" value="${value}" oninput="this.previousElementSibling.querySelector('b').textContent=this.value+'${suffix}';pendingSettings['${group}']['${key}']=Number(this.value)" /></label>`;
}
let pendingSettings = null;
function ensurePending() { if (!pendingSettings) pendingSettings = JSON.parse(JSON.stringify(config)); return pendingSettings; }
function saveSettings() { const next = pendingSettings || config; const sum = next.weights.quality + next.weights.fcr + next.weights.adherence + next.weights.csat; if (sum !== 100) { alert('مجموع أوزان المؤشرات يجب أن يساوي 100% (الحالي: ' + sum + '%)'); return; } if (!(next.breaks.limit >= 1)) { alert('الحد المسموح للاستراحة يجب أن يكون دقيقة واحدة على الأقل'); return; } if (next.thresholds.needs > next.thresholds.excellent) { alert('حد «يحتاج دعماً» يجب ألا يتجاوز حد «ممتاز»'); return; } config = next; pendingSettings = null; persist(); addActivity('حدّثت الإعدادات', 'الأوزان والأهداف'); const btn = document.getElementById('save-settings-btn'); if (btn) { const old = btn.innerHTML; btn.innerHTML = icon('check', 16) + ' تم الحفظ'; setTimeout(() => render(), 1500); } }
function clearData() {
  if (!confirm('سيتم حذف كل الموظفات والتقييمات وسجل النشاط نهائياً (الإعدادات وبيانات الدخول تبقى). يُنصح بتصدير نسخة احتياطية أولاً. متابعة؟')) return;
  employees = []; evaluations = []; activities = []; persist(); addActivity('بدأت نظاماً فارغاً', 'مسح كل البيانات'); render();
}
async function importJSON(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.employees) || !Array.isArray(data.evaluations) || !data.config) throw new Error('invalid');
    employees = data.employees; evaluations = data.evaluations; if (Array.isArray(data.activities)) activities = data.activities; config = normalizeConfig(data.config);
    persist(); addActivity('استوردت نسخة احتياطية', 'تم استعادة بيانات النظام'); alert('تم استيراد النسخة الاحتياطية بنجاح'); render();
  } catch { alert('ملف النسخة الاحتياطية غير صالح'); }
}

/* ============================== تسجيل الدخول ============================== */
function pageLogin() {
  if (!CLOUD_ENABLED) {
    return `
    <div class="login-wrap">
      <div class="login-card clay" style="grid-template-columns:1fr;max-width:520px">
        <div class="login-form">
          <div class="row"><div class="brand-badge" style="background:#ffd5b3;color:#795641;transform:none">${icon('lock', 23)}</div><span class="display" style="font-size:20px">النظام غير مُهيَّأ بعد</span></div>
          <p class="muted" style="font-size:14px;line-height:1.9;margin:18px 0 0">تم ربط هذا النظام حصرياً بحساب واحد عبر Supabase، ولا يوجد أي حساب دخول داخل الكود.</p>
          <p class="muted" style="font-size:14px;line-height:1.9;margin:10px 0 0">لتفعيله: افتحي <b>supabase-config.js</b> وعبّئي رابط ومفتاح مشروعك، ونفّذي <b>supabase-schema.sql</b>، وأنشئي حسابك من Supabase Dashboard → Authentication → Users. التفاصيل الكاملة في README.</p>
        </div>
      </div>
    </div>`;
  }
  return `
  <div class="login-wrap">
    <div class="blob blob-pink"></div><div class="blob blob-lilac"></div>
    <div class="login-card clay">
      <div class="login-hero">
        <div class="blob blob-rose"></div><div class="blob blob-sand"></div>
        <div class="login-hero-inner">
          <div class="row"><div class="brand-badge" style="background:#fff3e9;color:#93684f;transform:none">${icon('shield', 23)}</div><span class="display" style="font-size:20px;color:#754b32">نظام إدارة الجودة</span></div>
          <div>
            <div class="logo-box clay-sm">${icon('shield', 44)}</div>
            <h1 class="display" style="font-size:46px;line-height:1.05;margin:0;color:#6d462f">كل تقييم<br><span style="color:#c15a15">يصنع فرقاً.</span></h1>
            <p style="margin-top:20px;max-width:300px;font-size:14px;line-height:1.9;color:#855e47">مساحتك الهادئة لفهم أداء الفريق، والاحتفاء بالعمل الذي لا يراه الجميع.</p>
          </div>
          <div style="background:#ffffffb3;border-radius:24px;padding:20px;font-size:14px;font-weight:700;color:#825c46">“الجودة ليست رقماً فقط، إنها شعور يصل للعميل.”</div>
        </div>
      </div>
      <div class="login-form">
        <div class="row login-mobile-brand"><div class="brand-badge" style="background:#ffd5b3;color:#795641;transform:none">${icon('shield', 23)}</div><span class="display" style="font-size:20px">نظام إدارة الجودة</span></div>
        <span class="badge lavender">دخول آمن عبر Supabase</span>
        <h2 class="display" style="font-size:36px;margin:18px 0 30px;color:#5f3d29">مرحباً بعودتكِ</h2>
        <form id="login-form" autocomplete="on">
          <label class="field"><span>البريد الإلكتروني</span><input name="email" type="email" autocomplete="username" required autofocus /></label>
          <label class="field"><span>كلمة المرور</span><input name="password" type="password" autocomplete="current-password" required /></label>
          <div id="login-error" class="login-error hidden">البريد الإلكتروني أو كلمة المرور غير صحيحة</div>
          <button type="submit" class="btn" style="width:100%;justify-content:center;padding:14px;font-size:15px;margin-top:18px">الدخول إلى النظام ${icon('chevron', 18)}</button>
        </form>
      </div>
    </div>
  </div>`;
}
function bindLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.onsubmit = async ev => {
    ev.preventDefault();
    const f = new FormData(form);
    const btn = form.querySelector('button[type=submit]');
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'جارٍ التحقق...';
    const res = await doLogin(String(f.get('email')).trim(), String(f.get('password')));
    btn.disabled = false; btn.innerHTML = old;
    if (!res.ok) { const e = document.getElementById('login-error'); e.textContent = res.msg; e.classList.remove('hidden'); return; }
    addActivity('سجّلت الدخول', 'إلى النظام');
    navigate('/'); render();
  };
}

/* ============================== النافذة المنبثقة ============================== */
function openModal(html) { closeModal(); const ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'modal-overlay'; ov.innerHTML = `<div class="modal">${html}</div>`; ov.addEventListener('click', e => { if (e.target === ov) closeModal(); }); document.body.appendChild(ov); }
function closeModal() { const ov = document.getElementById('modal-overlay'); if (ov) ov.remove(); }

/* ============================== التوجيه والعرض ============================== */
const ROUTES = { '/': { page: pageDashboard, title: 'لوحة التحليل' }, '/evaluations': { page: pageEvaluations, title: 'التقييمات' }, '/follow-up': { page: pageFollowUp, title: 'مركز المتابعة' }, '/bulk-entry': { page: pageBulk, title: 'إدخال جماعي' }, '/employees': { page: pageEmployees, title: 'الموظفون' }, '/employee-report': { page: pageEmployeeReport, title: 'تقارير الموظفين' }, '/monthly-report': { page: pageMonthly, title: 'التقرير الشهري' }, '/activity': { page: pageActivity, title: 'سجل النشاط' }, '/settings': { page: pageSettings, title: 'الإعدادات' } };
function render() {
  const { path, params } = parseHash();
  closeModal();
  const app = document.getElementById('app');
  if (!authChecked) { app.innerHTML = `<div class="login-wrap"><p class="muted" style="font-size:14px">جارٍ التحقق من الجلسة...</p></div>`; return; }
  if (path === '/login') {
    if (isAuthed()) { navigate('/'); return; }
    app.innerHTML = pageLogin();
    bindLogin();
    return;
  }
  if (!isAuthed()) { navigate('/login'); return; }
  const route = ROUTES[path];
  if (path === '/settings') pendingSettings = null;
  const html = route
    ? (route.page.length ? route.page(params) : route.page())
    : `<div class="card empty"><b>الصفحة غير موجودة</b><span>يبدو أن هذا الرابط أخذ استراحة قصيرة.</span><br><br><a class="btn" href="#/">العودة للرئيسية</a></div>`;
  app.innerHTML = shell(html, route ? route.title : 'غير موجودة');
  bindPage();
}
function bindPage() {
  bindSettings();
  document.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', () => document.getElementById('sidebar').classList.remove('open')));
  const search = document.getElementById('eval-search');
  if (search) { search.oninput = e => { evalQuery = e.target.value; render(); setTimeout(() => { const s = document.getElementById('eval-search'); if (s) { s.focus(); s.selectionStart = s.selectionEnd = s.value.length; } }, 0); }; }
}
let __wasOpen = null;
window.addEventListener('beforeprint', () => {
  __wasOpen = [...document.querySelectorAll('details')].map(d => d.hasAttribute('open'));
  document.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
});
window.addEventListener('afterprint', () => {
  if (!__wasOpen) return;
  document.querySelectorAll('details').forEach((d, i) => { if (!__wasOpen[i]) d.removeAttribute('open'); });
  __wasOpen = null;
});
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', async () => {
  render(); // شاشة "جارٍ التحقق" فوراً دون أي تأخير محسوس
  await authInit(); // تحقق حقيقي من جلسة Supabase (أو تعطيل فوري إن لم تُفعَّل)
  render();
  if (cloudOn() && isAuthed()) cloudPullAll().then(changed => { if (changed) render(); }); // مزامنة هادئة من Supabase بعد تأكيد الدخول
});
