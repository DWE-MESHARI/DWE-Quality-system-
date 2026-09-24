import {DB,onAuth,login,logout,getRole} from './firebase.js';
const TABS=[['d','لوحة التحليل'],['v','التقييمات'],['b','إدخال جماعي'],['e','الموظفات'],['r','تقرير موظفة'],['m','التقرير الشهري الرسمي'],['l','سجل التغييرات'],['s','الإعدادات']];
const PAL=['#0284C7','#38BDF8','#4A2C22','#7DD3FC','#64748B'];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let LG=[],UID='',UN='',BD='',E=[],V=[],R={},CF={wq:40,wf:30,wc:30,t1:90,t2:80,t3:70,wa:0,tq:90,tf:85,tc:90,ta:85,tp:90},ED=true,tab='d',FL={m:'',e:'',from:'',to:''},RP={e:'',m:'',from:'',to:''},EF={e:'',from:'',to:''},MO={mm:''},EDIT=null,CH=[],PRN=0;
Chart.defaults.animation=false;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const nm=id=>(E.find(e=>e.id===id)||{}).name||'—';
const pf=v=>v==null?'—':v.toFixed(1)+'%';
const today=()=>new Date().toISOString().slice(0,10);
const dk=v=>v instanceof Date?new Date(v.getTime()+432e5).toISOString().slice(0,10):String(v).slice(0,10);
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2600)}
const ev=r=>r.q>0||r.com>0;
const IP={d:'M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z',v:'M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1zM6 6h12a1 1 0 011 1v13a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1zM9 14l2 2 4-4',b:'M3 5h18v14H3zM3 10h18M9 5v14',e:'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M17 11a3 3 0 100-6M18 14.5a5.5 5.5 0 013.5 5.5',r:'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',m:'M12 15a6 6 0 100-12 6 6 0 000 12zM8.500 14L7 21l5-3 5 3-1.500-7',l:'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',s:'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',q:'M12 3l8 3v6c0 4.500-3.200 8-8 9-4.800-1-8-4.500-8-9V6zM8.500 12l2.500 2.500 4.500-5',f:'M5 4h4l2 5-2.500 1.500a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2zM15 5l2 2 3-3',c:'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M9 15l2 2 4-4',a:'M12 21a9 9 0 100-18 9 9 0 000 18zM8.500 14a4.500 4.500 0 007 0M9 9.500h.01M15 9.500h.01',p:'M3 17l6-6 4 4 8-8M15 7h6v6',calls:'M4 14v-2a8 8 0 0116 0v2M4 14h3v5H4zM17 14h3v5h-3zM17 19c0 1.500-2 2-5 2',cm:'M12 3l10 18H2zM12 10v5M12 18h.01',star:'M12 3l2.700 5.600 6.100.900-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100-4.400-4.300 6.100-.900z',tg:'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.500a4.500 4.500 0 100-9 4.500 4.500 0 000 9zM12 12h.01'};
const TC={d:'#8E7BD3',v:'#4DB36A',b:'#F0628E',e:'#E9A32B',r:'#2FA8A0',m:'#5B6CE0',l:'#8A6F62',s:'#EF7B5B'};
const dd=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const pres=()=>`<div class="row noprint" style="width:100%;margin:0">${[['0','اليوم'],['7','آخر 7 أيام'],['30','آخر 30 يومًا'],['all','كل الفترات']].map(([k,t])=>`<button class="btn s sm" onclick="preset('${k}')">${t}</button>`).join('')}</div>`;
function preset(k){const o=tab==='r'?RP:tab==='v'?EF:FL;o.m='';o.from=k==='all'?'':dd(k==='0'?0:+k-1);o.to=k==='all'?'':today();top_();draw()}
const dfld=(a,b,o)=>`<div><label>من تاريخ</label><input type="date" id="${a}" value="${o.from}"></div><div><label>إلى تاريخ</label><input type="date" id="${b}" value="${o.to}"></div>`;
const evFlt=()=>`<div class="row noprint"><div><label>الموظفة</label><select id="ef">${empOpts(EF.e,1)}</select></div>${dfld('eff','eft',EF)}${pres()}</div>`;
const MC={q:'#8E7BD3',f:'#4DB36A',c:'#E9A32B',a:'#F0628E',p:'#3AA6C9',calls:'#2FA8A0',cm:'#E5534B',star:'#F7C948',tg:'#8E7BD3'};
const ico=(k,z)=>`<svg viewBox="0 0 24 24" width="${z||20}" height="${z||20}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${IP[k]||IP.tg}"/></svg>`;
const ik=l=>/CSAT/i.test(l)?'a':/Quality/i.test(l)?'q':/FCR/i.test(l)?'f':/الالتزام/.test(l)?'c':/الأداء/.test(l)?'p':/المكالمات/.test(l)?'calls':/الشكاوى/.test(l)?'cm':/موظفة/.test(l)?'star':'tg';
const EP=['#8E7BD3','#F0628E','#4DB36A','#E9A32B','#3AA6C9','#D6549A','#2FA8A0','#EF7B5B','#5B6CE0','#9AA83A'];
const EC=id=>EP[[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0)%EP.length];
const chip=(id,n)=>`<span class="ec" style="--c:${EC(id)}"><i>${esc(String(n).trim().charAt(0))}</i>${esc(n)}</span>`;
const LC={'ممتاز':'#3FA35B','جيد جدًا':'#5B7BE0','يحتاج تحسين':'#F2A93B','تدخل فوري':'#E5534B'};
const LOG=(a,d)=>DB.collection('log').add({t:new Date().toISOString(),u:UID,un:UN,a,d}).catch(()=>{});
const perf=r=>{let n=CF.wq*r.q+CF.wf*r.fcr+CF.wc*r.com,s=CF.wq+CF.wf+CF.wc;if(CF.wa&&r.cs>0){n+=CF.wa*r.cs;s+=CF.wa}return n/(s||1)};
const lvl=v=>v==null?['—','n']:v>=CF.t1?['ممتاز','g']:v>=CF.t2?['جيد جدًا','b']:v>=CF.t3?['يحتاج تحسين','a']:['تدخل فوري','r'];
const badge=v=>{const l=lvl(v);return`<span class="bd ${l[1]}">${l[0]}</span>`};
function agg(L){const x=L.filter(ev);return{n:x.length,all:L.length,calls:L.reduce((s,r)=>s+(r.calls||0),0),cm:L.reduce((s,r)=>s+(r.comp||0),0),q:mean(x.map(r=>r.q)),f:mean(L.map(r=>r.fcr)),c:mean(x.map(r=>r.com)),p:mean(x.map(perf)),a:mean(L.filter(r=>r.cs>0).map(r=>r.cs))}}
const months=()=>[...new Set(V.map(r=>r.date.slice(0,7)))].sort().reverse();
const opt=(a,sel)=>a.map(([v,t])=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(t)}</option>`).join('');
const empOpts=(sel,all)=>opt((all?[['','كل الموظفات']]:[]).concat(E.filter(e=>e.on!==false||e.id===sel).map(e=>[e.id,e.name])),sel);
const monOpts=sel=>opt([['','كل الأشهر']].concat(months().map(m=>[m,m])),sel);
const inRange=(r,m,e,f,t)=>(!m||r.date.startsWith(m))&&(!e||r.emp===e)&&(!f||r.date>=f)&&(!t||r.date<=t);

function setNav(){document.documentElement.style.setProperty('--tc',TC[tab]);$('#nav').innerHTML=TABS.map(([k,t])=>`<button class="${k===tab?'on':''}" style="--c:${TC[k]}" data-k="${k}">${ico(k,18)}${t}</button>`).join('');$$('#nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.k;EDIT=null;top_();draw()})}
function top_(){
 setNav();const t=$('#top');
 if(tab==='d')t.innerHTML=`<div class="row noprint"><div><label>الشهر</label><select id="fm">${monOpts(FL.m)}</select></div><div><label>الموظفة</label><select id="fe">${empOpts(FL.e,1)}</select></div>${dfld('ff','ft',FL)}<button class="btn" onclick="print()">طباعة التقرير</button><button class="btn s" onclick="pdf()">تصدير PDF</button>${pres()}</div>`;
 else if(tab==='b'){t.innerHTML=bulkTop();if($('#bd'))$('#bd').onchange=()=>{BD=$('#bd').value;top_()}}
 else if(tab==='m'){const ms=months();t.innerHTML=`<div class="row noprint"><div><label>شهر التقرير</label><select id="mm">${opt(ms.map(m=>[m,mname(m)]),MO.mm||ms[0])}</select></div><button class="btn" onclick="pdf()">تصدير PDF رسمي</button><button class="btn s" onclick="print()">طباعة</button></div>`}
 else if(tab==='v')t.innerHTML=evForm()+evFlt();
 else if(tab==='e')t.innerHTML=ED?`<div class="cd noprint"><div class="fg"><div><label>اسم الموظفة</label><input id="en"></div><div><label>المسمى الوظيفي (اختياري)</label><input id="er"></div><button class="btn" onclick="addEmp()">إضافة موظفة</button></div></div>`:'';
 else if(tab==='r')t.innerHTML=`<div class="row noprint"><div><label>الموظفة</label><select id="re">${empOpts(RP.e)}</select></div><div><label>الشهر</label><select id="rm">${monOpts(RP.m)}</select></div>${dfld('rf','rt',RP)}${pres()}<button class="btn" onclick="print()">طباعة التقرير</button><button class="btn s" onclick="pdf()">تصدير PDF</button></div>`;
 else t.innerHTML='';
 [['fm','m',FL],['fe','e',FL],['ff','from',FL],['ft','to',FL],['re','e',RP],['rm','m',RP],['rf','from',RP],['rt','to',RP],['mm','mm',MO],['ef','e',EF],['eff','from',EF],['eft','to',EF]].forEach(([id,k,o])=>{const el=$('#'+id);if(el)el.onchange=()=>{o[k]=el.value;if(k==='m'){o.from=o.to=''}else if(k==='from'||k==='to')o.m='';top_();draw()}});
}
function evForm(){
 if(!ED)return'';const x=EDIT?V.find(r=>r.id===EDIT):{date:today(),emp:'',calls:0,q:0,fcr:0,com:0,cs:0,comp:0,note:''};
 return`<div class="cd noprint"><b>${EDIT?'تعديل تقييم':'تقييم جديد'}</b><div class="fg" style="margin-top:10px">
 <div><label>التاريخ</label><input type="date" id="fd" value="${x.date}"></div>
 <div><label>الموظفة</label><select id="fp">${empOpts(x.emp)}</select></div>
 <div><label>عدد المكالمات</label><input type="number" min="0" id="fc" value="${x.calls}"></div>
 <div><label>Quality %</label><input type="number" min="0" max="100" step="0.1" id="fq" value="${x.q}"></div>
 <div><label>FCR %</label><input type="number" min="0" max="100" step="0.1" id="ff" value="${x.fcr}"></div>
 <div><label>الالتزام %</label><input type="number" min="0" max="100" step="0.1" id="fo" value="${x.com}"></div>
 <div><label>CSAT % (اختياري)</label><input type="number" min="0" max="100" step="0.1" id="fa" value="${x.cs||0}"></div>
 <div><label>عدد الشكاوى</label><input type="number" min="0" id="fs" value="${x.comp}"></div>
 <div style="grid-column:1/-1"><label>ملاحظات</label><input id="fn" value="${esc(x.note)}"></div></div>
 <div class="row"><button class="btn" onclick="saveEv()">حفظ التقييم</button>${EDIT?'<button class="btn s" onclick="cancelEdit()">إلغاء</button>':''}<span id="pv" style="color:var(--mu)"></span></div></div>`}
async function saveEv(){
 const g=id=>$('#'+id).value,n=id=>parseFloat(g(id))||0,e=g('fp'),d=g('fd');
 if(!e||!d)return toast('اختاري الموظفة والتاريخ');
 const r={date:d,emp:e,calls:n('fc'),q:n('fq'),fcr:n('ff'),com:n('fo'),comp:n('fs'),cs:n('fa'),note:g('fn').trim()};
 if([r.q,r.fcr,r.com,r.cs].some(v=>v<0||v>100)||r.calls<0||r.comp<0)return toast('النسب يجب أن تكون بين 0 و100');
 const id=e+'_'+d;
 try{const o=V.find(v=>v.id===id)||V.find(v=>v.id===EDIT);if(EDIT&&EDIT!==id)await DB.doc('ev/'+EDIT).delete();await DB.doc('ev/'+id).set(r);LOG(o?'تعديل':'إضافة',(o?'تعديل':'إضافة')+' تقييم '+nm(e)+' بتاريخ '+d+' — الأداء '+(o&&ev(o)?pf(perf(o))+' ← ':'')+(ev(r)?pf(perf(r)):'بلا تقييم'));EDIT=null;toast('تم حفظ التقييم');top_();draw()}catch(x){toast('تعذّر الحفظ: ليست لديك صلاحية التعديل')}
}
async function addEmp(){
 const n=$('#en').value.trim();if(!n)return toast('أدخلي اسم الموظفة');
 if(E.some(e=>e.name===n))return toast('الاسم موجود مسبقًا');
 try{await DB.collection('emp').add({name:n,role:$('#er').value.trim(),on:true});LOG('إضافة','إضافة موظفة: '+n);$('#en').value='';toast('تمت إضافة الموظفة')}catch(x){toast('تعذّر الحفظ')}
}
async function W(fn){try{await fn()}catch(x){toast('تعذّر تنفيذ العملية: تحقق من الصلاحيات')}}
function draw(){
 CH.forEach(c=>c.destroy());CH=[];
 const dark=!PRN&&tab!=='m'&&matchMedia('(prefers-color-scheme:dark)').matches&&document.documentElement.dataset.theme!=='light';
 Chart.defaults.color=dark?'#F0E3F4':'#4A2C22';Chart.defaults.font.family="'Baloo Bhaijaan 2',Tajawal,Tahoma";Chart.defaults.borderColor='rgba(128,128,128,.22)';
 $('#sub').textContent='تاريخ التقرير: '+new Date().toLocaleDateString('ar-u-ca-gregory-nu-latn',{dateStyle:'long'});
 ({d:pDash,v:pEv,e:pEmp,r:pRep,m:pMon,s:pSet,b:()=>{$('#out').innerHTML=''},l:pLog})[tab]();
}
function mk(id,c){const e=$('#'+id);if(e)CH.push(new Chart(e,c))}
const kp=a=>`<div class="kp">${a.map(x=>`<div class="k ${x[4]||''}" style="--c:${MC[ik(x[0])]}"><small>${ico(ik(x[0]))}${x[0]}</small><b class="${x[3]||''}">${x[1]}</b><em>${x[2]||''}</em></div>`).join('')}</div>`;
function pDash(){
 const L=V.filter(r=>inRange(r,FL.m,FL.e,FL.from,FL.to)),T=agg(L),o=$('#out');
 let dl='';if(FL.from&&FL.to){const n=Math.round((new Date(FL.to)-new Date(FL.from))/864e5)+1,sh=x=>new Date(new Date(x).getTime()-n*864e5).toISOString().slice(0,10),pp=agg(V.filter(r=>inRange(r,'',FL.e,sh(FL.from),sh(FL.to)))).p;if(pp!=null&&T.p!=null)dl=(T.p>=pp?'▲ ':'▼ ')+Math.abs(T.p-pp).toFixed(1)+' عن الفترة السابقة'}
 if(!L.length){o.innerHTML='<div class="cd">لا توجد تقييمات لهذه الفترة بعد. ابدئي بإضافة الموظفات ثم التقييمات، أو استوردي ملف Excel من تبويب «الإعدادات».</div>';return}
 const by=E.map(e=>({e,a:agg(L.filter(r=>r.emp===e.id))})).filter(x=>x.a.all).sort((a,b)=>(b.a.p??-1)-(a.a.p??-1));
 const best=by.find(x=>x.a.p!=null),ins=[];
 if(by.length>1){const w=[...by].reverse().find(x=>x.a.p!=null);if(w&&w!==best)ins.push(`أعلى أداء: <b>${esc(best.e.name)}</b> (${pf(best.a.p)})، وأدنى أداء: <b>${esc(w.e.name)}</b> (${pf(w.a.p)}).`)}
 const ms=[['Quality',T.q],['FCR',T.f],['الالتزام',T.c]].filter(x=>x[1]!=null).sort((a,b)=>a[1]-b[1]);
 if(ms.length)ins.push(`أضعف مؤشر على مستوى الفريق: <b>${ms[0][0]}</b> (${pf(ms[0][1])})، وأقواها: <b>${ms[ms.length-1][0]}</b> (${pf(ms[ms.length-1][1])}).`);
 const r1=by.filter(x=>x.a.p!=null&&x.a.p<CF.t3).map(x=>x.e.name),r2=by.filter(x=>x.a.p!=null&&x.a.p>=CF.t3&&x.a.p<CF.t2).map(x=>x.e.name);
 if(r1.length)ins.push(`تدخل فوري مطلوب: <b>${esc(r1.join('، '))}</b> (أقل من ${CF.t3}%).`);
 if(r2.length)ins.push(`خطة تحسين مطلوبة: <b>${esc(r2.join('، '))}</b> (${CF.t3}%–${CF.t2}%).`);
 const un=T.all-T.n;if(un)ins.push(`<b>${un}</b> سجل بلا تقييم (Quality والالتزام صفر) — استُبعدت من المتوسطات.`);
 if(T.cm)ins.push(`إجمالي الشكاوى في الفترة: <b>${T.cm}</b>.`);
 const ds=[...new Set(L.map(r=>r.date))].sort();
 o.innerHTML=`<div class="ph">${FL.from||FL.to?'الفترة: '+(FL.from||'…')+' ← '+(FL.to||'…'):FL.m?'الشهر: '+FL.m:'كل الفترات'} ${FL.e?'· '+esc(nm(FL.e)):''}</div><h2>المؤشرات الرئيسية</h2>`+kp([['متوسط الأداء',pf(T.p),lvl(T.p)[0]+(dl?' · '+dl:''),lvl(T.p)[1]],['متوسط Quality',pf(T.q)],['متوسط FCR',pf(T.f)],['متوسط الالتزام',pf(T.c)],['متوسط CSAT',pf(T.a)],['إجمالي المكالمات',T.calls.toLocaleString('en'),T.all+' سجل'],...(best&&!FL.e?[['⭐ موظفة الفترة',esc(best.e.name),pf(best.a.p),'','star']]:[])])+
 `<h2>تحقيق الأهداف</h2><div class="kp">${[['Quality',T.q,CF.tq],['FCR',T.f,CF.tf],['الالتزام',T.c,CF.tc],['CSAT',T.a,CF.ta],['الأداء العام',T.p,CF.tp]].filter(x=>x[1]!=null&&x[2]).map(([l,v,t])=>`<div class="k" style="--c:${MC[ik(l)]}"><small>${ico(ik(l))}${l}</small><b class="${v>=t?'g':'r'}">${pf(v)}</b><em>الهدف ${t}% · ${v>=t?'محقق (+'+(v-t).toFixed(1)+')':'فجوة '+(t-v).toFixed(1)+' نقطة'}</em><div class="pb"><i style="width:${Math.min(100,v/t*100)}%"></i></div></div>`).join('')}</div><h2>أبرز النتائج والتنبيهات</h2><ul class="in">${ins.map(x=>`<li>${x}</li>`).join('')}</ul><h2>التحليل البياني</h2><div class="ch"><div class="cd"><h3>مقارنة الموظفات</h3><div class="cv"><canvas id="c1"></canvas></div></div><div class="cd"><h3>تطور الأداء (لون خاص لكل موظفة)</h3><div class="cv"><canvas id="c2"></canvas></div></div><div class="cd"><h3>توزيع مستويات التقييم</h3><div class="cv"><canvas id="c3"></canvas></div></div></div>
 <h2>ترتيب الموظفات</h2><div class="cd tw"><table><tr><th>#</th><th>الموظفة</th><th>المكالمات</th><th>Quality</th><th>FCR</th><th>الالتزام</th><th>CSAT</th><th>الشكاوى</th><th>الأداء</th><th>التقييم</th></tr>${by.map((x,i)=>`<tr><td><span class="rk r${i<3?i+1:0}">${i+1}</span></td><td>${chip(x.e.id,x.e.name)}</td><td>${x.a.calls}</td><td style="color:${MC.q};font-weight:700">${pf(x.a.q)}</td><td style="color:${MC.f};font-weight:700">${pf(x.a.f)}</td><td style="color:${MC.c};font-weight:700">${pf(x.a.c)}</td><td style="color:${MC.a};font-weight:700">${pf(x.a.a)}</td><td>${x.a.cm}</td><td><b class="${lvl(x.a.p)[1]}">${pf(x.a.p)}</b><div class="pb"><i class="f${lvl(x.a.p)[1]}" style="width:${x.a.p||0}%"></i></div></td><td>${badge(x.a.p)}</td></tr>`).join('')}</table></div>`;
 mk('c1',{type:'bar',data:{labels:by.map(x=>x.e.name),datasets:[['Quality','q'],['FCR','f'],['الالتزام','c'],['CSAT','a'],['الأداء','p']].map(([l,k],i)=>({label:l,data:by.map(x=>x.a[k]==null?null:+x.a[k].toFixed(1)),backgroundColor:MC[k],borderRadius:5}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',rtl:true}},scales:{y:{min:0,max:100}}}});
 const tm=(f)=>ds.map(d=>{const v=agg(L.filter(r=>r.date===d&&f(r))).p;return v==null?null:+v.toFixed(1)});
 mk('c2',{type:'line',data:{labels:ds,datasets:[...by.map(x=>({label:x.e.name,data:tm(r=>r.emp===x.e.id),borderColor:EC(x.e.id),backgroundColor:EC(x.e.id),tension:.3,spanGaps:true,pointRadius:4,borderWidth:2.5})),{label:'متوسط الفريق',data:tm(()=>1),borderColor:'#4A2C22',backgroundColor:'#4A2C22',borderDash:[6,4],tension:.3,spanGaps:true,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',rtl:true}},scales:{y:{min:0,max:100}}}});
 const lv=Object.keys(LC);mk('c3',{type:'doughnut',data:{labels:lv,datasets:[{data:lv.map(k=>L.filter(ev).filter(r=>lvl(perf(r))[0]===k).length),backgroundColor:lv.map(k=>LC[k]),borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'bottom',rtl:true}}}});
}
function pEv(){
 const L=V.filter(r=>inRange(r,'',EF.e,EF.from,EF.to)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,300);
 $('#out').innerHTML=`<h2>التقييمات (${L.length})</h2><div class="cd tw"><table><tr><th>التاريخ</th><th>الموظفة</th><th>المكالمات</th><th>Quality</th><th>FCR</th><th>الالتزام</th><th>الشكاوى</th><th>الأداء</th><th>الحالة</th><th>ملاحظات</th>${ED?'<th class="noprint"></th>':''}</tr>${L.map(r=>{const p=ev(r)?perf(r):null;return`<tr><td>${r.date}</td><td>${chip(r.emp,nm(r.emp))}</td><td>${r.calls}</td><td style="color:${MC.q};font-weight:700">${r.q}%</td><td style="color:${MC.f};font-weight:700">${r.fcr}%</td><td style="color:${MC.c};font-weight:700">${r.com}%</td><td>${r.comp}</td><td><b class="${p==null?'':lvl(p)[1]}">${pf(p)}</b></td><td>${p==null?'<span class="bd n">بلا تقييم</span>':badge(p)}</td><td>${esc(r.note)}</td>${ED?`<td class="noprint" style="white-space:nowrap"><button class="btn s sm" data-ed="${r.id}">تعديل</button> <button class="btn d sm" data-del="${r.id}">حذف</button></td>`:''}</tr>`}).join('')||'<tr><td colspan="11">لا توجد تقييمات بعد.</td></tr>'}</table></div>`;
 $$('[data-ed]').forEach(b=>b.onclick=()=>{EDIT=b.dataset.ed;top_();scrollTo(0,0)});
 $$('[data-del]').forEach(b=>b.onclick=()=>{if(confirm('حذف هذا التقييم نهائيًا؟'))W(async()=>{const r=V.find(v=>v.id===b.dataset.del);await DB.doc('ev/'+b.dataset.del).delete();LOG('حذف','حذف تقييم '+nm(r.emp)+' بتاريخ '+r.date+(ev(r)?' (الأداء '+pf(perf(r))+')':''))})});
 const upd=()=>{const g=id=>parseFloat($('#'+id)?.value)||0,p=perf({q:g('fq'),fcr:g('ff'),com:g('fo')});if($('#pv'))$('#pv').textContent=(g('fq')||g('fo'))?'الأداء المحسوب: '+p.toFixed(1)+'% — '+lvl(p)[0]:''};
 ['fq','ff','fo'].forEach(i=>$('#'+i)&&($('#'+i).oninput=upd));upd();
}
function pEmp(){
 $('#out').innerHTML=`<h2>الموظفات (${E.length})</h2><div class="cd tw"><table><tr><th>الاسم</th><th>المسمى</th><th>عدد التقييمات</th><th>الحالة</th>${ED?'<th class="noprint"></th>':''}</tr>${E.map(e=>`<tr><td>${chip(e.id,e.name)}</td><td>${esc(e.role)}</td><td>${V.filter(r=>r.emp===e.id).length}</td><td>${e.on===false?'<span class="bd n">موقوفة</span>':'<span class="bd g">نشطة</span>'}</td>${ED?`<td class="noprint" style="white-space:nowrap"><button class="btn s sm" data-rn="${e.id}">تعديل الاسم</button> <button class="btn s sm" data-tg="${e.id}">${e.on===false?'تفعيل':'إيقاف'}</button> <button class="btn d sm" data-dl="${e.id}">حذف</button></td>`:''}</tr>`).join('')||'<tr><td colspan="5">لم تُضف موظفات بعد.</td></tr>'}</table></div>`;
 $$('[data-rn]').forEach(b=>b.onclick=()=>{const n=prompt('الاسم الجديد',nm(b.dataset.rn));if(n&&n.trim())W(async()=>{const o=nm(b.dataset.rn);await DB.doc('emp/'+b.dataset.rn).update({name:n.trim()});LOG('تعديل','تغيير اسم موظفة: '+o+' ← '+n.trim())})});
 $$('[data-tg]').forEach(b=>b.onclick=()=>{const e=E.find(x=>x.id===b.dataset.tg);W(async()=>{await DB.doc('emp/'+e.id).update({on:e.on===false});LOG('تعديل',(e.on===false?'تفعيل':'إيقاف')+' الموظفة '+e.name)})});
 $$('[data-dl]').forEach(b=>b.onclick=()=>{const id=b.dataset.dl,n=V.filter(r=>r.emp===id).length;
  if(n)return alert('لا يمكن حذف موظفة لديها '+n+' تقييم. استخدمي «إيقاف» للحفاظ على السجل التاريخي.');
  if(confirm('حذف الموظفة نهائيًا؟'))W(async()=>{const n=nm(id);await DB.doc('emp/'+id).delete();LOG('حذف','حذف الموظفة '+n)})});
}
function pRep(){
 const o=$('#out');if(!RP.e&&E[0]){RP.e=E[0].id;top_()}
 const e=E.find(x=>x.id===RP.e);if(!e){o.innerHTML='<div class="cd">أضيفي موظفة أولًا.</div>';return}
 const L=V.filter(r=>inRange(r,RP.m,e.id,RP.from,RP.to)),A=agg(L),Tm=agg(V.filter(r=>inRange(r,RP.m,'',RP.from,RP.to))),n=R[e.id]||{};
 const d=(a,b)=>a==null||b==null?'':((a-b>=0?'+':'')+(a-b).toFixed(1)+' نقطة عن متوسط الفريق');
 const ms=[['Quality',A.q,Tm.q],['FCR',A.f,Tm.f],['الالتزام',A.c,Tm.c]].filter(x=>x[1]!=null&&x[2]!=null).map(x=>[x[0],x[1]-x[2]]).sort((a,b)=>b[1]-a[1]);
 const sg=ms.length?`أقوى مؤشر مقارنة بالفريق: ${ms[0][0]}`:'',ip=ms.length?`أولوية التحسين: ${ms[ms.length-1][0]}`:'';
 o.innerHTML=`<div class="ph">الموظفة: ${esc(e.name)} · ${RP.from||RP.to?(RP.from||'…')+' ← '+(RP.to||'…'):RP.m||'كل الفترات'}</div><h2>تقرير الموظفة: ${chip(e.id,e.name)}</h2>`+kp([['متوسط الأداء',pf(A.p),lvl(A.p)[0],lvl(A.p)[1]],['Quality',pf(A.q),d(A.q,Tm.q)],['FCR',pf(A.f),d(A.f,Tm.f)],['الالتزام',pf(A.c),d(A.c,Tm.c)],['المكالمات',A.calls,A.n+' يوم مُقيَّم من '+A.all],['الشكاوى',A.cm]])+
 `<h2>التحليل والتوصيات</h2><div class="cd fg" style="align-items:start">${[['s','نقاط القوة',sg],['i','نقاط التحسين',ip],['a','الإجراء المقترح','']].map(([k,t,ph])=>`<div><label>${t}</label><textarea rows="4" data-n="${k}" placeholder="${ph}" ${ED?'':'readonly'}>${esc(n[k]||'')}</textarea></div>`).join('')}</div>${ED?'<div class="row noprint"><button class="btn" id="sn">حفظ الملاحظات</button></div>':''}
 <h2>سجل التقييمات</h2><div class="cd tw"><table><tr><th>التاريخ</th><th>المكالمات</th><th>Quality</th><th>FCR</th><th>الالتزام</th><th>الأداء</th><th>الحالة</th></tr>${[...L].sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{const p=ev(r)?perf(r):null;return`<tr><td>${r.date}</td><td>${r.calls}</td><td style="color:${MC.q};font-weight:700">${r.q}%</td><td style="color:${MC.f};font-weight:700">${r.fcr}%</td><td style="color:${MC.c};font-weight:700">${r.com}%</td><td>${pf(p)}</td><td>${p==null?'—':badge(p)}</td></tr>`}).join('')||'<tr><td colspan="7">لا توجد تقييمات.</td></tr>'}</table></div>`;
 if($('#sn'))$('#sn').onclick=()=>{const o={};$$('[data-n]').forEach(t=>o[t.dataset.n]=t.value);W(async()=>{await DB.doc('rep/'+e.id).set(o);toast('تم حفظ الملاحظات')})};
}
function pSet(){
 const f=(k,t)=>`<div><label>${t}</label><input type="number" min="0" max="100" data-c="${k}" value="${CF[k]}" ${ED?'':'disabled'}></div>`;
 $('#out').innerHTML=`<h2>أوزان احتساب متوسط الأداء</h2><div class="cd"><div class="fg">${f('wq','وزن Quality')}${f('wf','وزن FCR')}${f('wc','وزن الالتزام')}${f('wa','وزن CSAT (0 = غير محتسب)')}</div><p style="color:var(--mu);font-size:13px">الأداء = (Quality×وزنه + FCR×وزنه + الالتزام×وزنه) ÷ مجموع الأوزان. يُحسب تلقائيًا لكل التقييمات، وتنعكس التغييرات فورًا على كل الشاشات.</p></div>
 <h2>الأهداف الشهرية (%)</h2><div class="cd"><div class="fg">${f('tq','هدف Quality')}${f('tf','هدف FCR')}${f('tc','هدف الالتزام')}${f('ta','هدف CSAT')}${f('tp','هدف الأداء العام')}</div></div><h2>حدود التقييم والتنبيهات</h2><div class="cd"><div class="fg">${f('t1','ممتاز من %')}${f('t2','جيد جدًا من %')}${f('t3','تحسين من % (وما دونها تدخل فوري)')}</div></div>
 ${ED?`<div class="row"><button class="btn" id="sv">حفظ الإعدادات</button></div>
 <h2>استيراد وتصدير البيانات</h2><div class="cd"><div class="row"><div><label>استيراد ملف Excel قديم (ورقة Raw Data)</label><input type="file" id="im" accept=".xlsx,.xls"></div><button class="btn s" onclick="exportX()">تصدير نسخة احتياطية Excel</button></div></div>`:''}`;
 if(!ED)return;
 $('#sv').onclick=()=>{const o={};$$('[data-c]').forEach(i=>o[i.dataset.c]=parseFloat(i.value)||0);if(o.wq+o.wf+o.wc+o.wa<=0)return toast('مجموع الأوزان يجب أن يكون أكبر من صفر');if(!(o.t1>o.t2&&o.t2>o.t3))return toast('الحدود يجب أن تكون: ممتاز > جيد جدًا > تحسين');W(async()=>{await DB.doc('cfg/main').set(o);LOG('تعديل','تعديل الإعدادات — الأوزان (Quality/FCR/الالتزام/CSAT): '+o.wq+'/'+o.wf+'/'+o.wc+'/'+o.wa);toast('تم حفظ الإعدادات')})};
 $('#im').onchange=e=>e.target.files[0]&&imp(e.target.files[0]);
}
async function imp(file){
 try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
  let rows=[];for(const n of wb.SheetNames){const r=XLSX.utils.sheet_to_json(wb.Sheets[n],{defval:null});if(r.length&&('الموظفة' in r[0]&&'التاريخ' in r[0])){rows=r;break}}
  if(!rows.length)return toast('لم أجد ورقة تحتوي عمود «الموظفة»');
  const ids={};E.forEach(e=>ids[e.name]=e.id);let c=0;
  const p=v=>{v=parseFloat(v)||0;return+(v<=1?v*100:v).toFixed(2)};
  for(const r of rows){const n=String(r['الموظفة']||'').trim(),d=r['التاريخ'];if(!n||!d)continue;
   if(!ids[n]){const ref=await DB.collection('emp').add({name:n,on:true});ids[n]=ref.id}
   const dt=dk(d);await DB.doc('ev/'+ids[n]+'_'+dt).set({date:dt,emp:ids[n],calls:parseFloat(r['عدد المكالمات'])||0,q:p(r['Quality %']),fcr:p(r['FCR %']),com:p(r['الالتزام %']),cs:p(r['CSAT %']),comp:0,note:''});c++}
  LOG('استيراد','استيراد '+c+' تقييم من ملف '+file.name);toast('تم استيراد '+c+' تقييم')}catch(x){toast('تعذّر الاستيراد')}
}
async function exportX(){
 try{const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(E.map(e=>({الموظفة:e.name,المسمى:e.role||'',الحالة:e.on===false?'موقوفة':'نشطة'}))),'الموظفات');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([...V].sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{const p=ev(r)?perf(r):0;return{التاريخ:r.date,الموظفة:nm(r.emp),'عدد المكالمات':r.calls,'Quality %':r.q,'FCR %':r.fcr,'الالتزام %':r.com,'CSAT %':r.cs||0,الشكاوى:r.comp,'متوسط الأداء %':+p.toFixed(1),الحالة:ev(r)?lvl(p)[0]:'بلا تقييم',ملاحظات:r.note}})),'التقييمات');
  dl('quality-backup-'+today()+'.xlsx',XLSX.write(wb,{type:'array',bookType:'xlsx'}))}catch(x){toast('تعذّر التصدير')}
}
function bulkTop(){
 if(!ED)return'<div class="cd">الإدخال الجماعي متاح لمن لديهم صلاحية التعديل.</div>';
 if(!BD)BD=today();
 const rows=E.filter(e=>e.on!==false).map(e=>{const x=V.find(r=>r.id===e.id+'_'+BD)||{};return`<tr data-e="${e.id}"><td>${chip(e.id,e.name)}</td>${['calls','q','fcr','com','cs','comp'].map(k=>`<td><input type="number" min="0" ${k==='calls'||k==='comp'?'':'max="100" step="0.1"'} data-k="${k}" value="${x[k]||0}"></td>`).join('')}</tr>`}).join('');
 return`<div class="cd noprint"><div class="row"><div><label>تاريخ الإدخال</label><input type="date" id="bd" value="${BD}"></div><button class="btn" onclick="saveBulk()">حفظ تقييم الجميع</button></div><p style="color:var(--mu);font-size:13px;margin:0 0 8px">اتركي Quality والالتزام صفرًا للموظفة التي لم تُقيَّم في هذا اليوم. إن وُجد تقييم محفوظ لنفس اليوم فسيظهر ويمكن تعديله.</p><div class="tw"><table><tr><th>الموظفة</th><th>المكالمات</th><th>Quality %</th><th>FCR %</th><th>الالتزام %</th><th>CSAT %</th><th>الشكاوى</th></tr>${rows||'<tr><td colspan="7">أضيفي موظفات أولًا.</td></tr>'}</table></div></div>`}
async function saveBulk(){
 const d=$('#bd').value;if(!d)return toast('اختاري التاريخ');let c=0;
 try{for(const tr of $$('tr[data-e]')){const e=tr.dataset.e,o={};tr.querySelectorAll('input').forEach(i=>o[i.dataset.k]=parseFloat(i.value)||0);
  if([o.q,o.fcr,o.com,o.cs].some(v=>v<0||v>100))return toast('النسب يجب أن تكون بين 0 و100 ('+nm(e)+')');
  const old=V.find(v=>v.id===e+'_'+d);if(!old&&!Object.values(o).some(v=>v))continue;
  await DB.doc('ev/'+e+'_'+d).set({date:d,emp:e,calls:o.calls,q:o.q,fcr:o.fcr,com:o.com,cs:o.cs,comp:o.comp,note:old?old.note||'':''});c++}
  LOG('إضافة','إدخال جماعي بتاريخ '+d+': '+c+' تقييم');toast('تم حفظ '+c+' تقييم')}catch(x){toast('تعذّر الحفظ')}
}
async function pLog(){
 const L=[...LG].sort((a,b)=>b.t.localeCompare(a.t)).slice(0,150),ids=[...new Set(L.map(x=>x.u).filter(Boolean))];let P={};
 
 if(tab!=='l')return;
 $('#out').innerHTML=`<h2>سجل التغييرات (آخر ${L.length})</h2><div class="cd tw"><table><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th></tr>${L.map(x=>`<tr><td style="white-space:nowrap">${new Date(x.t).toLocaleString('ar-u-ca-gregory-nu-latn',{dateStyle:'short',timeStyle:'short'})}</td><td>${esc(x.un||'مستخدم')}</td><td><span class="bd ${x.a==='حذف'?'r':x.a==='إضافة'?'g':'b'}">${esc(x.a)}</span></td><td>${esc(x.d)}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد سجلات بعد.</td></tr>'}</table></div>`;
}
const mname=m=>new Date(m+'-15').toLocaleDateString('ar-u-ca-gregory-nu-latn',{month:'long',year:'numeric'});
function pMon(){
 const o=$('#out'),ms=months(),m=MO.mm||ms[0];
 if(!m){o.innerHTML='<div class="cd">لا توجد تقييمات لإصدار تقرير.</div>';return}
 let[y,mo]=m.split('-').map(Number);mo--;if(!mo){mo=12;y--}const pm=y+'-'+String(mo).padStart(2,'0');
 const L=V.filter(r=>r.date.startsWith(m)),T=agg(L),PT=agg(V.filter(r=>r.date.startsWith(pm)));
 const by=E.map(e=>({e,a:agg(L.filter(r=>r.emp===e.id)),b:agg(V.filter(r=>r.date.startsWith(pm)&&r.emp===e.id))})).filter(x=>x.a.all).sort((a,b)=>(b.a.p??-1)-(a.a.p??-1));
 const best=by.find(x=>x.a.p!=null),dv=(a,b)=>a==null||b==null?'—':`<b class="${a>=b?'g':'r'}">${a>=b?'▲':'▼'} ${Math.abs(a-b).toFixed(1)}</b>`;
 const gl=[['Quality',T.q,CF.tq,PT.q],['FCR',T.f,CF.tf,PT.f],['الالتزام',T.c,CF.tc,PT.c],['CSAT',T.a,CF.ta,PT.a],['الأداء العام',T.p,CF.tp,PT.p]].filter(x=>x[1]!=null&&x[2]);
 const wk=a=>[['Quality',a.q,CF.tq],['FCR',a.f,CF.tf],['الالتزام',a.c,CF.tc]].filter(x=>x[1]!=null&&x[2]).sort((x,z)=>(x[1]-x[2])-(z[1]-z[2]))[0];
 const low=by.filter(x=>x.a.p!=null&&x.a.p<CF.t2),ok=gl.filter(x=>x[1]>=x[2]).length;
 const F=[`أداء الفريق لشهر ${mname(m)}: <b>${pf(T.p)}</b> (${lvl(T.p)[0]}) ${PT.p!=null?'— '+dv(T.p,PT.p)+' نقطة عن الشهر السابق':''}.`,`تحقق <b>${ok}</b> من أصل <b>${gl.length}</b> أهداف شهرية.`];
 if(best)F.push(`أعلى أداء: <b>${esc(best.e.name)}</b> (${pf(best.a.p)}).`);
 const w=[...by].reverse().find(x=>x.a.p!=null);if(w&&w!==best)F.push(`أدنى أداء: <b>${esc(w.e.name)}</b> (${pf(w.a.p)}).`);
 if(T.all>T.n)F.push(`<b>${T.all-T.n}</b> سجل بلا تقييم، وتُنصح الإدارة بتغطية جميع الأيام.`);
 if(T.cm)F.push(`إجمالي الشكاوى: <b>${T.cm}</b> شكوى خلال الشهر.`);
 const iss=new Date().toLocaleDateString('ar-u-ca-gregory-nu-latn',{dateStyle:'long'}),no='QR-'+m.replace('-','');
 const hd=`<div class="ph2"><div><b>التقرير الشهري الرسمي لجودة خدمة العملاء</b><span>إدارة تجربة العميل — ما بعد البيع</span></div><em>${mname(m)}</em></div>`;
 const ft=n=>`<div class="pf"><span>رقم التقرير: ${no}</span><span>صفحة ${n} من 3</span><span>تاريخ الإصدار: ${iss}</span></div>`;
 const nm2=x=>`<span class="dot" style="background:${EC(x.e.id)}"></span><b>${esc(x.e.name)}</b>`;
 const rows=by.map((x,i)=>`<tr><td><span class="rk r${i<3?i+1:0}">${i+1}</span></td><td>${nm2(x)}</td><td>${x.a.calls}</td><td style="color:${MC.q}">${pf(x.a.q)}</td><td style="color:${MC.f}">${pf(x.a.f)}</td><td style="color:${MC.c}">${pf(x.a.c)}</td><td style="color:${MC.a}">${pf(x.a.a)}</td><td><b class="${lvl(x.a.p)[1]}">${pf(x.a.p)}</b></td><td>${dv(x.a.p,x.b.p)}</td><td>${badge(x.a.p)}</td></tr>`).join('');
 o.innerHTML=`<div class="pgw">
 <div class="pg">${hd}<h2>الملخص التنفيذي</h2>${kp([['متوسط الأداء',pf(T.p),lvl(T.p)[0],lvl(T.p)[1]],['متوسط Quality',pf(T.q)],['متوسط FCR',pf(T.f)],['متوسط الالتزام',pf(T.c)],['متوسط CSAT',pf(T.a)],['إجمالي المكالمات',T.calls.toLocaleString('en')],['إجمالي الشكاوى',T.cm],['أيام مقيّمة',T.n+' / '+T.all]])}
 ${best?`<div class="k star" style="margin-top:14px;display:flex;justify-content:space-between;align-items:center"><div><small>${ico('star')}موظفة الشهر</small><b>${esc(best.e.name)}</b></div><div style="text-align:left"><b>${pf(best.a.p)}</b><em>متوسط الأداء</em></div></div>`:''}
 <h2>تحقيق الأهداف الشهرية</h2><table><tr><th>المؤشر</th><th>الفعلي</th><th>الهدف</th><th>الفجوة</th><th>عن الشهر السابق</th><th>الحالة</th></tr>${gl.map(([l,v,t,pv])=>`<tr><td><b style="color:${MC[ik(l)]}">${l}</b></td><td>${pf(v)}</td><td>${t}%</td><td>${(v-t>=0?'+':'')+(v-t).toFixed(1)}</td><td>${dv(v,pv)}</td><td><span class="bd ${v>=t?'g':'r'}">${v>=t?'محقق':'غير محقق'}</span></td></tr>`).join('')}</table>${ft(1)}</div>
 <div class="pg">${hd}<h2>التحليل البياني</h2><div class="ch" style="grid-template-columns:1.5fr 1fr"><div class="cd"><h3>مؤشرات كل موظفة</h3><div class="cv"><canvas id="c1"></canvas></div></div><div class="cd"><h3>توزيع مستويات التقييم</h3><div class="cv"><canvas id="c3"></canvas></div></div></div>
 <h2>ترتيب الموظفات وأدائهن</h2><table><tr><th>#</th><th>الموظفة</th><th>المكالمات</th><th>Quality</th><th>FCR</th><th>الالتزام</th><th>CSAT</th><th>الأداء</th><th>التغير</th><th>التقييم</th></tr>${rows}</table>${ft(2)}</div>
 <div class="pg">${hd}<h2>أبرز النتائج</h2><ul class="in">${F.map(x=>`<li>${x}</li>`).join('')}</ul>
 <h2>خطط التحسين والمتابعة</h2>${low.length?`<table><tr><th>الموظفة</th><th>الأداء</th><th>أضعف مؤشر</th><th>الإجراء المقترح</th></tr>${low.map(x=>{const q=wk(x.a);return`<tr><td>${nm2(x)}</td><td><b class="${lvl(x.a.p)[1]}">${pf(x.a.p)}</b></td><td>${q?q[0]+' ('+pf(q[1])+')':'—'}</td><td>${esc((R[x.e.id]||{}).a||'متابعة أسبوعية وجلسة تدريب على '+(q?q[0]:'المؤشرات الأضعف'))}</td></tr>`}).join('')}</table>`:'<div class="cd">لا توجد موظفات دون حد التحسين هذا الشهر.</div>'}
 <div class="sg"><div>مسؤولة الجودة</div><div>مدير الإدارة</div></div>${ft(3)}</div></div>`;
 const lv=Object.keys(LC);
 mk('c1',{type:'bar',data:{labels:by.map(x=>x.e.name),datasets:[['Quality','q'],['FCR','f'],['الالتزام','c'],['CSAT','a'],['الأداء','p']].map(([l,k])=>({label:l,data:by.map(x=>x.a[k]==null?null:+x.a[k].toFixed(1)),backgroundColor:MC[k],borderRadius:4}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',rtl:true}},scales:{y:{min:0,max:100}}}});
 mk('c3',{type:'doughnut',data:{labels:lv,datasets:[{data:lv.map(k=>L.filter(ev).filter(r=>lvl(perf(r))[0]===k).length),backgroundColor:lv.map(k=>LC[k]),borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{position:'bottom',rtl:true}}}});
}
async function pdf(){
 toast('جارٍ إنشاء ملف PDF…');
 try{const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4',compress:true}),bg=tab==='m'?'#ffffff':getComputedStyle(document.body).backgroundColor,fix=d=>{d.querySelectorAll('.ec').forEach(e=>{e.style.background='none';e.style.border='0'});d.querySelectorAll('th').forEach(t=>t.style.background=TC[tab])},pg=$$('.pg');
  if(pg.length)for(let i=0;i<pg.length;i++){const c=await html2canvas(pg[i],{scale:2,backgroundColor:bg,onclone:fix});if(i)doc.addPage();doc.addImage(c.toDataURL('image/jpeg',.92),'JPEG',0,0,210,297)}
  else{const c=await html2canvas($('#out'),{scale:2,backgroundColor:bg,onclone:fix}),h=Math.floor(c.width*297/210);
   for(let y=0,i=0;y<c.height;y+=h,i++){const k=document.createElement('canvas');k.width=c.width;k.height=h;const x=k.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,k.width,h);x.drawImage(c,0,y,c.width,h,0,0,c.width,h);if(i)doc.addPage();doc.addImage(k.toDataURL('image/jpeg',.92),'JPEG',0,0,210,297)}}
  doc.save((tab==='m'?'monthly-report-'+(MO.mm||months()[0]):'report-'+tab+'-'+today())+'.pdf');
 }catch(e){toast('تعذّر التنزيل المباشر، استخدمي الطباعة ثم «حفظ كـ PDF»');setTimeout(print,600)}
}
addEventListener('beforeprint',()=>{PRN=1;draw()});addEventListener('afterprint',()=>{PRN=0;draw()});
let T=0;const sched=()=>{clearTimeout(T);T=setTimeout(draw,60)};
function cancelEdit(){EDIT=null;top_();draw()}
const dl=(name,data)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data]));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
function start(u,role){
 UID=u.uid;UN=u.displayName||u.email;ED=role==='admin'||role==='editor';
 $('#who').innerHTML=`<div class="wu"><b>${esc(UN)}</b><span>${{admin:'مدير النظام',editor:'محرر',viewer:'مشاهدة فقط'}[role]||role}</span><button class="btn s sm" id="lo">تسجيل الخروج</button></div>`;
 $('#lo').onclick=async()=>{await logout();location.reload()};
 top_();draw();
 const ld=(p,fn)=>DB.collection(p).onSnapshot(s=>{fn(s.docs.map(d=>({id:d.id,...d.data()})));sched()},e=>{console.error(e);toast('تعذّر تحميل البيانات: تحقق من قواعد Firestore والصلاحيات')});
 ld('emp',a=>{E=a.sort((x,y)=>x.name.localeCompare(y.name,'ar'));refreshTop()});
 ld('ev',a=>V=a);ld('log',a=>LG=a);
 DB.collection('rep').onSnapshot(s=>{R={};s.docs.forEach(d=>R[d.id]=d.data());sched()});
 DB.doc('cfg/main').onSnapshot(s=>{if(s.exists)CF={...CF,...s.data()};sched()});
}
function refreshTop(){const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&$('#top').contains(a))return;top_()}

Object.assign(window,{pdf,saveEv,addEmp,preset,saveBulk,exportX,cancelEdit});
$('#lf').onsubmit=async e=>{e.preventDefault();$('#le').textContent='';try{await login($('#em').value,$('#pw').value)}catch(x){$('#le').textContent='بيانات الدخول غير صحيحة'}};
onAuth(async u=>{
 if(!u){$('#login').style.display='flex';return}
 let role=null;try{role=await getRole(u.uid)}catch(e){console.error(e)}
 if(!role){$('#le').textContent='هذا الحساب غير مصرّح له بدخول النظام. تواصل مع مدير النظام.';await logout();return}
 $('#login').style.display='none';start(u,role);
});
