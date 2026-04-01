// ── 이용안내 ──
function renderManual(){
  const role=(PR?.role||'user').toLowerCase();
  const rl=TIER_INFO[role]||TIER_INFO.user;
  const banner=document.getElementById('myRoleBanner');
  banner.style.display='flex';
  banner.innerHTML=`<span style="font-size:18px">${getAnimal(PR?.name||AU?.email)}</span> 현재 내 권한: <strong>${rl.label} — ${rl.name}</strong>`;
  document.getElementById('tierGrid').innerHTML=['inactive','user','admin','master'].map(t=>{
    const info=TIER_INFO[t];const isMe=(t===role);
    return`<div class="tier-card ${t==='inactive'?'inactive-card':''} ${isMe?'featured-active':''}">
      ${isMe?'<div style="font-size:11px;font-weight:800;color:#1e10c7;margin-bottom:7px">✦ 내 권한</div>':''}
      <span class="tier-chip ${info.chip}">${info.label}</span>
      <div class="tier-name">${info.name}</div>
      <div class="tier-desc">${info.desc}</div>
      <div class="tier-div"></div>
      <ul class="feat-list">${info.feats.map(f=>`<li><span class="fi-ic ${f.ok?'fi-yes':'fi-no'}">${f.ok?'✓':'—'}</span><span ${!f.ok?'class="fi-txt-dim"':''}>${f.txt}</span></li>`).join('')}</ul>
    </div>`;
  }).join('');
}

// ── 이용안내 탭 ──
function manualTab(tab, el){
  document.querySelectorAll('.manual-tab-btn').forEach(b=>b.classList.remove('on'));
  if(el)el.classList.add('on');
  const tabs=['roles','stages','features','upload','faq'];
  tabs.forEach(t=>{
    const el2=document.getElementById('manualTab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(el2)el2.style.display=t===tab?'block':'none';
  });
  // 내 등급 강조 (roles 탭)
  if(tab==='roles'&&PR?.role){
    document.querySelectorAll('.tier-card').forEach(c=>c.classList.remove('my-tier'));
    const myCard=document.getElementById('tc-'+PR.role);
    if(myCard)myCard.classList.add('my-tier');
  }
}

// 이용안내 로드 시 내 등급 강조
function loadManual(){
  if(!PR?.role)return;
  // 기존 renderManual 호출 (banner + tierGrid)
  try{renderManual();}catch(e){}
  // 새 탭형 이용안내 - 내 등급 강조
  document.querySelectorAll('.tier-card').forEach(c=>c.classList.remove('my-tier'));
  const myCard=document.getElementById('tc-'+PR.role);
  if(myCard){
    myCard.classList.add('my-tier');
    myCard.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  // 첫 탭(권한안내) 활성화
  const firstBtn=document.querySelector('.manual-tab-btn');
  if(firstBtn){manualTab('roles',firstBtn);}
}

// ── 계약 종료 임박 체크 ──
async function checkContractExpiring(){
  const today=new Date();
  const in7=new Date(today);in7.setDate(today.getDate()+7);
  const todayStr=today.toISOString().slice(0,10);
  const in7Str=in7.toISOString().slice(0,10);
  let q=sb.from('prospects').select('id,business_name,contract_end_date,contract_status')
    .eq('stage','계약완료')
    .neq('contract_status','ended')
    .gte('contract_end_date',todayStr)
    .lte('contract_end_date',in7Str);
  if(!isPriv())q=q.eq('manager_id',PR?.name||'');
  const{data}=await q;
  if(!data?.length)return;
  data.forEach(r=>{
    const daysLeft=Math.ceil((new Date(r.contract_end_date)-today)/(1000*60*60*24));
    showToast(`⚠️ [${r.business_name}] 계약 종료 ${daysLeft}일 전!`,'warning',6000);
  });
}

// ── PERIOD ──
function setPeriod(p,btn){curPeriod=p;document.querySelectorAll('.p-btn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');if(isPriv())loadKPI();}

// ── DASHBOARD ──
async function loadDash(){
  const priv=isPriv();
  document.getElementById('dashAdmin').style.display=priv?'block':'none';
  document.getElementById('dashUser').style.display=priv?'none':'block';
  // badges handled inside loadTodayAct (priv) and loadUserDash (non-priv)
  if(priv)await Promise.all([loadKPI(),loadCharts(),loadTodayAct(),loadTeam(),loadLeaderboard(),loadGoalProgress(),loadTodayContacts(),loadConversionStats(),renderDashCal(),loadFailReasonChart(),loadMonthlyContractChart()]);
  else await Promise.all([loadUserDash(),renderActChart()]);
}

async function loadKPI(){
  const{start,end}=periodRange(curPeriod);
  const pLbl={day:'오늘',week:'이번 주',month:'이번 달'}[curPeriod];
  const n=new Date(),ms=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-01';
  const[{data:cd},{count:crmCnt},{count:cc}]=await Promise.all([
    sb.from('calls').select('call_count,call_time').gte('date',start).lte('date',end),
    sb.from('prospects').select('*',{count:'exact',head:true}).gte('created_at',start+'T00:00:00').lte('created_at',end+'T23:59:59.999'),
    sb.from('prospects').select('*',{count:'exact',head:true}).eq('stage','계약완료').gte('created_at',ms+'T00:00:00'),
  ]);
  let calls=0,mins=0;(cd||[]).forEach(r=>{calls+=r.call_count||0;mins+=r.call_time||0});
  document.getElementById('kCalls').textContent=calls;
  document.getElementById('kTime').textContent=mins+'분';
  document.getElementById('kCallsSub').textContent=pLbl+' · 팀 전체';
  document.getElementById('kTimeSub').textContent=pLbl+' · 팀 전체';
  document.getElementById('kCrm').textContent=crmCnt||0;
  document.getElementById('kCrmSub').textContent=pLbl+' · 팀 전체';
  document.getElementById('kContract').textContent=cc||0;
}

async function loadTodayContacts(){
  const{data}=await sb.from('prospects').select('id,business_name,phone,stage,manager').eq('next_contact_date',td()).order('business_name');
  const card=document.getElementById('todayContactsCard');
  if(!data?.length){card.style.display='none';return}
  card.style.display='block';
  document.getElementById('todayContactCnt').textContent=data.length+'건';
  document.getElementById('todayContactsList').innerHTML=`<table class="tbl"><thead><tr><th>업체명</th><th>전화번호</th><th>단계</th><th>담당자</th></tr></thead><tbody>
    ${data.map(r=>`<tr class="tbl-clickrow" onclick="openCrmModal(${r.id})"><td><strong>${r.business_name||'-'}</strong></td><td>${maskPhone(r.phone)}</td><td>${stageBadge(r.stage||'가망')}</td><td>${r.manager||'-'}</td></tr>`).join('')}
  </tbody></table>`;
}

async function loadConversionStats(){
  const[{data:users},{data:prospects}]=await Promise.all([
    sb.from('users').select('id,name').in('role',['user','admin','master']),
    sb.from('prospects').select('manager,stage'),
  ]);
  const stats={};
  (users||[]).forEach(u=>stats[u.name]={name:u.name,total:0,contract:0});
  (prospects||[]).forEach(p=>{
    if(!p.manager)return;
    if(!stats[p.manager])stats[p.manager]={name:p.manager,total:0,contract:0};
    stats[p.manager].total++;
    if(p.stage==='계약완료')stats[p.manager].contract++;
  });
  const arr=Object.values(stats).filter(s=>s.total>0).sort((a,b)=>b.contract-a.contract);
  const el=document.getElementById('conversionStats');
  if(!arr.length){el.innerHTML='<div class="empty">데이터 없음</div>';return}
  el.innerHTML=arr.map(s=>{
    const rate=s.total>0?Math.round(s.contract/s.total*100):0;
    return`<div class="stat-card">
      <div class="stat-emoji">${getAnimal(s.name)}</div>
      <div class="stat-name">${s.name}</div>
      <div class="stat-val">${rate}%</div>
      <div class="stat-sub">${s.contract}계약 / ${s.total}건</div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${rate}%"></div></div>
    </div>`;
  }).join('');
}

async function loadUserDash(){
  const mgr=AU.id;
  const todayStr=td();
  const{start:ws}=periodRange('week');
  const{start:ms2}=periodRange('month');
  // 8개 순차 쿼리 → 4개 병렬 / 중복 제거
  const[{data:todayRow},{data:wk},{data:mn},{data:pdata}]=await Promise.all([
    sb.from('calls').select('call_count,call_time').eq('manager',mgr).eq('date',todayStr).maybeSingle(),
    sb.from('calls').select('call_count').eq('manager',mgr).gte('date',ws).lte('date',todayStr),
    sb.from('calls').select('call_count').eq('manager',mgr).gte('date',ms2).lte('date',todayStr),
    sb.from('prospects').select('id,business_name,phone,stage,next_contact_date').eq('manager',mgr),
  ]);
  document.getElementById('uKpiCalls').textContent=(todayRow?.call_count||0)+'콜';
  document.getElementById('uKpiTime').textContent=(todayRow?.call_time||0)+'분';
  let wc=0;(wk||[]).forEach(r=>wc+=r.call_count||0);document.getElementById('uWeekCalls').textContent=wc;
  let mc=0;(mn||[]).forEach(r=>mc+=r.call_count||0);document.getElementById('uMonthCalls').textContent=mc;
  // pdata에서 카운트 파생 (별도 count 쿼리 불필요)
  document.getElementById('uMyCrm').textContent=(pdata||[]).length;
  document.getElementById('uMyContract').textContent=(pdata||[]).filter(r=>r.stage==='계약완료').length;
  const sc={};STAGES.forEach(s=>sc[s.key]=0);(pdata||[]).forEach(r=>sc[r.stage||'가망']++);
  document.getElementById('userPipeline').innerHTML=STAGES.map(s=>`
    <div class="pipe-card ${s.pipe}" onclick="goPage('crm')">
      <div class="pipe-icon">${s.icon}</div><div class="pipe-label">${s.label}</div>
      <div class="pipe-count">${sc[s.key]}</div>
    </div>`).join('');
  // 오늘 연락 예정: pdata에서 필터 (별도 쿼리 불필요)
  const tc=(pdata||[]).filter(r=>r.next_contact_date===todayStr);
  const uCard=document.getElementById('userTodayContactsCard');
  if(tc.length){uCard.style.display='block';document.getElementById('userTodayContactCnt').textContent=tc.length+'건';
    document.getElementById('userTodayContactsList').innerHTML=tc.map(r=>`<div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid #f0f2f8"><strong>${r.business_name}</strong> <span style="color:#9fa6bc;font-size:13px">${maskPhone(r.phone)}</span> ${stageBadge(r.stage||'가망')} <button class="btn-s btn-sm" style="margin-left:auto" onclick="openCrmModal(${r.id})">상세</button></div>`).join('');}
  else uCard.style.display='none';
  // 뱃지: todayRow 재사용 (재조회 없음)
  if(typeof renderBadges==='function')await renderBadges(todayRow?.call_count||0,todayRow?.call_time||0);
}

async function loadCharts(){
  const days=last7(),lbls=days.map(d=>d.slice(5).replace('-','/'));
  const{data:cd}=await sb.from('calls').select('date,call_count').in('date',days);
  const cm={};(cd||[]).forEach(r=>cm[r.date]=(cm[r.date]||0)+(r.call_count||0));
  const{data:pd}=await sb.from('prospects').select('created_at').gte('created_at',days[0]+'T00:00:00');
  const pm={};(pd||[]).forEach(r=>{const d=r.created_at.slice(0,10);pm[d]=(pm[d]||0)+1});
  mkChart('chartCalls',chCalls,lbls,days.map(d=>cm[d]||0),'아웃바운드 콜','#1e10c7',i=>chCalls=i);
  mkChart('chartCrm',chCRM,lbls,days.map(d=>pm[d]||0),'CRM 등록','#059669',i=>chCRM=i);
}
function mkChart(id,inst,labels,data,label,color,cb){
  if(inst)inst.destroy();const ctx=document.getElementById(id);if(!ctx)return;
  cb(new Chart(ctx.getContext('2d'),{type:'line',data:{labels,datasets:[{label,data,borderColor:color,backgroundColor:color+'1a',borderWidth:2.5,pointRadius:4,pointBackgroundColor:color,tension:.4,fill:true}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{font:{size:12,family:"'Noto Sans KR',sans-serif"},color:'#9fa6bc'}},
              y:{beginAtZero:true,grid:{color:'#f0f2f8'},ticks:{font:{size:12,family:"'Noto Sans KR',sans-serif"},color:'#9fa6bc',stepSize:1}}}}}));
}

async function setActChart(mode,btn){
  actChartMode=mode;
  document.querySelectorAll('#dashUser .p-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('actChartMonth2').style.display=(mode==='month')?'block':'none';
  await renderActChart();
}
async function renderActChart(){
  const mgr=PR?.name||AU?.email;if(!mgr)return;
  const yr=parseInt(document.getElementById('actChartYear')?.value)||new Date().getFullYear();
  let labels=[],callData=[],crmData=[],contractData=[];
  if(actChartMode==='day'){
    const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return d.toISOString().slice(0,10)});
    labels=days.map(d=>d.slice(5).replace('-','/'));
    // 2개 병렬 쿼리
    const[{data:cd},{data:pd}]=await Promise.all([
      sb.from('calls').select('date,call_count').eq('manager',AU.id).in('date',days),
      sb.from('prospects').select('created_at,stage').eq('manager',mgr).gte('created_at',days[0]+'T00:00:00'),
    ]);
    const cm={};(cd||[]).forEach(r=>cm[r.date]=(cm[r.date]||0)+(r.call_count||0));
    callData=days.map(d=>cm[d]||0);
    const pm={},qm={};(pd||[]).forEach(r=>{const d=r.created_at.slice(0,10);pm[d]=(pm[d]||0)+1;if(r.stage==='계약완료')qm[d]=(qm[d]||0)+1});
    crmData=days.map(d=>pm[d]||0);contractData=days.map(d=>qm[d]||0);
  }else if(actChartMode==='week'){
    // 24개 순차 쿼리 → 2개 병렬 bulk + JS 집계
    const weeks=[];for(let i=7;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i*7);weeks.push(d.toISOString().slice(0,10))}
    labels=weeks.map((_,i)=>`W${8-i}`);
    const wkEnd=new Date(weeks[7]);wkEnd.setDate(wkEnd.getDate()+6);const wkEndStr=wkEnd.toISOString().slice(0,10);
    const[{data:wkCalls},{data:wkCrm}]=await Promise.all([
      sb.from('calls').select('date,call_count').eq('manager',AU.id).gte('date',weeks[0]).lte('date',wkEndStr),
      sb.from('prospects').select('created_at,stage').eq('manager',mgr).gte('created_at',weeks[0]+'T00:00:00').lte('created_at',wkEndStr+'T23:59:59'),
    ]);
    for(let i=0;i<8;i++){
      const ss=weeks[i];const eDate=new Date(ss);eDate.setDate(eDate.getDate()+6);const ee=eDate.toISOString().slice(0,10);
      let c=0;(wkCalls||[]).forEach(r=>{if(r.date>=ss&&r.date<=ee)c+=r.call_count||0;});callData.push(c);
      const sl=(wkCrm||[]).filter(r=>{const d=r.created_at.slice(0,10);return d>=ss&&d<=ee;});
      crmData.push(sl.length);contractData.push(sl.filter(r=>r.stage==='계약완료').length);
    }
  }else{
    // 36개 순차 쿼리 → 2개 병렬 bulk + JS 집계
    labels=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const[{data:moCalls},{data:moCrm}]=await Promise.all([
      sb.from('calls').select('date,call_count').eq('manager',AU.id).gte('date',`${yr}-01-01`).lte('date',`${yr}-12-31`),
      sb.from('prospects').select('created_at,stage').eq('manager',mgr).gte('created_at',`${yr}-01-01T00:00:00`).lte('created_at',`${yr}-12-31T23:59:59`),
    ]);
    for(let m=1;m<=12;m++){
      const ss=`${yr}-${String(m).padStart(2,'0')}-01`,ee=`${yr}-${String(m).padStart(2,'0')}-${String(new Date(yr,m,0).getDate()).padStart(2,'0')}`;
      let c=0;(moCalls||[]).forEach(r=>{if(r.date>=ss&&r.date<=ee)c+=r.call_count||0;});callData.push(c);
      const sl=(moCrm||[]).filter(r=>{const d=r.created_at.slice(0,10);return d>=ss&&d<=ee;});
      crmData.push(sl.length);contractData.push(sl.filter(r=>r.stage==='계약완료').length);
    }
  }
  const ctx=document.getElementById('chartUserAct');if(!ctx)return;
  if(chUserAct)chUserAct.destroy();
  chUserAct=new Chart(ctx.getContext('2d'),{type:'bar',data:{labels,datasets:[
    {label:'아웃바운드 콜',data:callData,backgroundColor:'rgba(30,16,199,.7)',borderRadius:5,borderSkipped:false},
    {label:'CRM 등록',data:crmData,backgroundColor:'rgba(5,150,105,.7)',borderRadius:5,borderSkipped:false},
    {label:'계약 완료',data:contractData,backgroundColor:'rgba(238,78,0,.8)',borderRadius:5,borderSkipped:false},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:12,family:"'Noto Sans KR',sans-serif"},boxWidth:13}}},
    scales:{x:{grid:{display:false},ticks:{font:{size:11,family:"'Noto Sans KR',sans-serif"},color:'#9fa6bc'}},
            y:{beginAtZero:true,grid:{color:'#f0f2f8'},ticks:{font:{size:11,family:"'Noto Sans KR',sans-serif"},color:'#9fa6bc',stepSize:1}}}}});
}

async function loadTodayAct(){
  const{data}=await sb.from('calls').select('call_count,call_time,memo').eq('manager',AU.id).eq('date',td()).maybeSingle();
  if(data){document.getElementById('actCount').value=data.call_count||'';document.getElementById('actTime').value=data.call_time||'';document.getElementById('actMemo').value=data.memo||'';}
  // 뱃지: 여기서 처리해 loadDash의 별도 재조회 제거
  if(typeof renderBadges==='function')await renderBadges(data?.call_count||0,data?.call_time||0);
}
async function loadTeam(){
  const[{data:calls},{data:users}]=await Promise.all([
    sb.from('calls').select('manager,call_count,call_time,memo').eq('date',td()),
    sb.from('users').select('id,name'),
  ]);
  const umap={};(users||[]).forEach(u=>umap[u.id]=u.name);
  const tbody=document.getElementById('teamBody');
  if(!calls?.length){tbody.innerHTML='<tr><td colspan="4" class="empty" style="padding:16px">오늘 활동 기록 없음</td></tr>';return}
  tbody.innerHTML=calls.map(r=>`<tr><td><strong>${umap[r.manager]||'-'}</strong></td><td>${r.call_count||0}콜</td><td>${r.call_time||0}분</td><td>${r.memo||'-'}</td></tr>`).join('');
}
async function loadLeaderboard(){
  const{start:ms}=periodRange('month');
  const[{data},{data:users}]=await Promise.all([
    sb.from('calls').select('manager,call_count').gte('date',ms).lte('date',td()),
    sb.from('users').select('id,name'),
  ]);
  const umap={};(users||[]).forEach(u=>umap[u.id]=u.name);
  const totals={};(data||[]).forEach(r=>totals[r.manager]=(totals[r.manager]||0)+(r.call_count||0));
  const sorted=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const lb=document.getElementById('leaderboard');
  if(!sorted.length){lb.innerHTML='<div class="empty" style="padding:16px">이번 달 활동 없음</div>';return}
  const rc=['r1','r2','r3','rn','rn'];
  lb.innerHTML=sorted.map(([uid,cnt],i)=>`
    <div class="lb-row"><div class="lb-rank ${rc[i]}">${i+1}</div>
    <div style="font-size:18px">${getAnimal(umap[uid]||uid)}</div>
    <div class="lb-name">${umap[uid]||uid.slice(0,6)}</div>
    <div><span class="lb-val">${cnt}</span><span class="lb-unit"> 콜</span></div></div>`).join('');
}
async function loadGoalProgress(){
  const n=new Date();const yr=n.getFullYear(),mo=n.getMonth()+1;
  const{data:goal}=await sb.from('goals').select('*').eq('year',yr).eq('month',mo).maybeSingle();
  const gs=document.getElementById('goalSection');
  if(!goal){gs.style.display='none';return}
  gs.style.display='block';document.getElementById('goalMonthLbl').textContent=yr+'년 '+mo+'월';
  const{start:ms}=periodRange('month');
  const[{data:cd},{count:crmC},{count:conC}]=await Promise.all([
    sb.from('calls').select('call_count').gte('date',ms),
    sb.from('prospects').select('*',{count:'exact',head:true}).gte('created_at',ms+'T00:00:00'),
    sb.from('prospects').select('*',{count:'exact',head:true}).eq('stage','계약완료').gte('created_at',ms+'T00:00:00'),
  ]);
  let tc=0;(cd||[]).forEach(r=>tc+=r.call_count||0);
  const items=[{lbl:'콜 달성',cur:tc,target:goal.target_calls,color:'#1e10c7'},{lbl:'CRM 등록',cur:crmC||0,target:goal.target_crm,color:'#059669'},{lbl:'계약 완료',cur:conC||0,target:goal.target_contracts,color:'#ee4e00'}];
  document.getElementById('goalRow').innerHTML=items.map(({lbl,cur,target,color})=>{
    const pct=target>0?Math.min(100,Math.round(cur/target*100)):0;
    return`<div class="goal-item"><div class="goal-lbl">${lbl}</div><div class="goal-val">${cur} / ${target}</div><div class="goal-bar-wrap"><div class="goal-bar" style="width:${pct}%;background:${color}"></div></div><div class="goal-pct">${pct}%</div></div>`;
  }).join('');
}
async function saveAct(){
  const count=parseInt(document.getElementById('actCount').value)||0,time=parseInt(document.getElementById('actTime').value)||0;
  const memo=document.getElementById('actMemo').value.trim();
  if(count===0&&time===0){setMsg('actMsg','콜 수 또는 통화 시간을 입력하세요.',false);return}
  const payload={call_count:count,call_time:time,memo,date:td(),manager:AU.id};
  const{data:ex}=await sb.from('calls').select('id').eq('manager',AU.id).eq('date',td()).maybeSingle();
  if(ex)await sb.from('calls').update(payload).eq('id',ex.id);
  else await sb.from('calls').insert([payload]);
  setMsg('actMsg','✓ 저장되었습니다.',true);loadKPI();loadTeam();loadLeaderboard();loadGoalProgress();
  // 목표 달성 체크 + 뱃지 체크 (저장한 값 재사용 — 재조회 없음)
  if(typeof checkGoalAchievement==='function')await checkGoalAchievement();
  if(typeof checkAndAwardBadges==='function')await checkAndAwardBadges(count,time);
}

// ── 캘린더 ──
const _stageEvCls={'가망':'cal-ev-prospect','컨택중':'cal-ev-contact','미팅확정':'cal-ev-meeting','검토중':'cal-ev-review','계약완료':'cal-ev-contract','영업종결':'cal-ev-lost'};
async function renderCalendar(){
  const yr=calYear,mo=calMonth;
  document.getElementById('calMonthLabel').textContent=`${yr}년 ${mo+1}월`;
  const firstDay=new Date(yr,mo,1).getDay();
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  const daysInPrev=new Date(yr,mo,0).getDate();
  const mgr=AU.id;
  const startStr=`${yr}-${String(mo+1).padStart(2,'0')}-01`;
  const endStr=`${yr}-${String(mo+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
  let q=sb.from('prospects').select('id,business_name,next_contact_date,stage,manager').gte('next_contact_date',startStr).lte('next_contact_date',endStr).eq('stage','미팅확정');
  if(!isPriv())q=q.eq('manager_id',mgr);
  const{data}=await q;
  const eventMap={};(data||[]).forEach(r=>{const d=r.next_contact_date;if(!eventMap[d])eventMap[d]=[];eventMap[d].push(r)});
  const dayHeaders=['일','월','화','수','목','금','토'];
  let html=dayHeaders.map(d=>`<div class="cal-head">${d}</div>`).join('');
  const todayStr=td();let cellCount=0;
  for(let i=0;i<firstDay;i++){html+=`<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev-firstDay+i+1}</div></div>`;cellCount++;}
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=dateStr===todayStr;const events=eventMap[dateStr]||[];
    const cls=_stageEvCls;
    html+=`<div class="cal-day ${isToday?'today':''}" data-date="${dateStr}" onclick="selectCalDay(this,'${dateStr}')">
      <div class="cal-day-num">${d}</div>
      ${events.slice(0,4).map(e=>`<div class="cal-event-item ${cls[e.stage]||'cal-ev-prospect'}" onclick="event.stopPropagation();openCrmModal(${e.id})" title="${e.business_name||''}">${e.business_name||'-'}</div>`).join('')}
      ${events.length>4?`<div style="font-size:10px;color:var(--gray-400);font-weight:600;margin-top:1px">+${events.length-4}건</div>`:''}
    </div>`;cellCount++;
  }
  const remaining=(7-cellCount%7)%7;
  for(let i=1;i<=remaining;i++)html+=`<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  document.getElementById('calGrid').innerHTML=html;
  document.getElementById('calDayDetail').style.display='none';
}
function moveMonth(dir){calMonth+=dir;if(calMonth>11){calMonth=0;calYear++;}else if(calMonth<0){calMonth=11;calYear--;}renderCalendar();}
function selectCalDay(el, dateStr){
  document.querySelectorAll('.cal-day.selected').forEach(d=>d.classList.remove('selected'));
  if(el)el.classList.add('selected');
  showCalDay(dateStr);
}
async function showCalDay(dateStr){
  const mgr=AU.id;
  let q=sb.from('prospects').select('*').eq('next_contact_date',dateStr);
  if(!isPriv())q=q.eq('manager_id',mgr);
  const{data}=await q;
  const card=document.getElementById('calDayDetail');
  document.getElementById('calDayTitle').textContent=`📞 ${dateStr} 연락 예정 (${data?.length||0}건)`;
  const tbody=document.getElementById('calDayBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="5" class="empty">예정 없음</td></tr>';}
  else tbody.innerHTML=data.map(r=>`<tr class="tbl-clickrow" onclick="openCrmModal(${r.id})" style="cursor:pointer"><td><strong>${r.business_name||'-'}</strong></td><td>${maskPhone(r.phone)}</td><td>${stageBadge(r.stage||'가망')}</td><td>${r.manager||'-'}</td><td><button class="btn-s btn-sm" onclick="event.stopPropagation();openCrmModal(${r.id})">상세</button></td></tr>`).join('');
  card.style.display='block';card.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ── 공지사항 ──
async function loadAnnouncements(){
  // 전체 사용자 접근 가능 — 관리자/마스터만 작성 버튼 표시
  const writeBtn=document.getElementById('announceWriteBtn');
  if(writeBtn)writeBtn.style.display=isPriv()?'flex':'none';
  const{data}=await sb.from('announcements').select('*').order('is_pinned',{ascending:false}).order('created_at',{ascending:false});
  const pinned=(data||[]).filter(a=>a.is_pinned);
  const normal=(data||[]).filter(a=>!a.is_pinned);
  const pinnedEl=document.getElementById('pinnedAnnounceList');
  const normalEl=document.getElementById('normalAnnounceList');
  // 고정 공지 - 전체 내용 표시
  pinnedEl.innerHTML=pinned.length?pinned.map(a=>`
    <div class="announce-pinned">
      <div class="ap-title">📌 ${a.title||''} ${isPriv()?`<button class="btn-d" style="margin-left:auto;font-size:12px" onclick="deleteAnnounce(${a.id})">삭제</button>`:''}</div>
      <div class="ap-meta">${a.author_name||'-'} · ${fmtDate(a.created_at)}</div>
      <div class="ap-content">${a.content||''}</div>
    </div>`).join(''):'';
  // 일반 공지 - 제목+날짜만, 클릭시 펼침
  normalEl.innerHTML=normal.length?normal.map(a=>`
    <div class="announce-normal" id="ann-${a.id}">
      <div class="announce-normal-head" onclick="toggleAnnounce(${a.id})">
        <div class="announce-normal-title">${a.title||''}</div>
        <div class="announce-normal-date">${fmtDate(a.created_at)}</div>
        <div class="announce-normal-arrow" id="arr-${a.id}">▼</div>
      </div>
      <div class="announce-normal-body" id="body-${a.id}">
        <div class="announce-normal-body-inner">${a.content||''}${isPriv()?`<div style="margin-top:12px"><button class="btn-d" onclick="deleteAnnounce(${a.id})">삭제</button></div>`:''}</div>
      </div>
    </div>`).join(''):'<div class="empty">일반 공지 없음</div>';
}
function toggleAnnounce(id){
  const body=document.getElementById('body-'+id);
  const arr=document.getElementById('arr-'+id);
  const isOpen=body.classList.contains('open');
  body.classList.toggle('open',!isOpen);
  arr.classList.toggle('open',!isOpen);
}
async function loadAnnounceBadge(){
  const{count}=await sb.from('announcements').select('*',{count:'exact',head:true});
  const el=document.getElementById('announceBadge');
  if(count>0){el.style.display='flex';el.textContent='N';}else el.style.display='none';
}
function openAnnounceModal(){
  document.getElementById('aTitle').value='';document.getElementById('aContent').value='';document.getElementById('aPinned').checked=false;
  document.getElementById('announceModal').style.display='flex';
}
function closeAnnounceModal(){document.getElementById('announceModal').style.display='none'}
async function saveAnnounce(){
  const title=document.getElementById('aTitle').value.trim(),content_val=document.getElementById('aContent').value.trim();
  if(!title||!content_val){alert('제목과 내용을 입력하세요.');return}
  const isPinned=document.getElementById('aPinned').checked;
  const{error}=await sb.from('announcements').insert([{
    title,content:content_val,
    author_name:PR?.name||AU.email,
    created_by_name:PR?.name||AU.email,
    is_pinned:isPinned,is_active:true
  }]);
  if(error){alert('저장 실패: '+error.message);return}
  // 카카오워크 알림
  sendKakaoWorkNotify('announcement',{title,content:content_val,author_name:PR?.name||AU.email});
  closeAnnounceModal();loadAnnouncements();loadAnnounceBadge();
}
async function deleteAnnounce(id){
  if(!confirm('삭제하시겠습니까?'))return;
  await sb.from('announcements').delete().eq('id',id);loadAnnouncements();
}

// ════ 관리자 설정 — 2단 탭 구조 ════
const ADMIN_MAIN_TABS=[
  {key:'account', label:'계정관리'},
  {key:'data',    label:'데이터관리'},
  {key:'ops',     label:'운영관리'},
];
const ADMIN_SUB_TABS={
  account:[
    {key:'createUser', label:'사용자 생성', panel:'admCreateUser', load:()=>{const sel=document.getElementById('adm_nRole');if(sel)sel.innerHTML=getAllowedRoleOpts('');}},
  ],
  data:[
    {key:'dupcheck', label:'중복 탐지',    panel:'admDupCheck', load:null},
    {key:'blocked',  label:'영업불가 관리', panel:'admBlocked',  load:()=>loadBlockedAdmin()},
    {key:'stale',    label:'장기 종결 DB', panel:'admStale',    load:()=>loadStaleDB()},
    {key:'assign',   label:'DB 배정',     panel:'admAssign',   load:()=>{loadAssignUsers();loadAssignList();}},
  ],
  ops:[
    {key:'pipeline',  label:'팀 파이프라인', panel:'admTeamPipeline',load:()=>{loadTpMgrFilter();loadTeamPipeline();}},
    {key:'goal',      label:'목표 설정',     panel:'admGoal',        load:()=>loadGoalHist()},
    {key:'templates', label:'템플릿 관리',   panel:'admTemplates',   load:()=>loadTemplateAdmin()},
    {key:'report',    label:'리포트',        panel:'admReport',      load:()=>loadWeeklyReport()},
    {key:'perfcards', label:'사원별 성과',   panel:'admPerfCards',   load:()=>{if(typeof initPerfCardSelects==='function')initPerfCardSelects();loadPerfCards();}},
    {key:'kakaowork', label:'카카오워크',    panel:'admKakaoWork',   load:()=>loadKakaoWorkSettings()},
  ],
};
let _adminMainTab='account',_adminSubTab='createUser';

function setupAdminPage(){
  const role=(PR?.role||'').toLowerCase();
  if(!['master','admin'].includes(role)){goPage('dash');return;}
  const sel=document.getElementById('adm_nRole');
  if(sel)sel.innerHTML=getAllowedRoleOpts('');
  renderAdminMainTabs('account');
}
function renderAdminMainTabs(mainKey){
  _adminMainTab=mainKey;
  const bar=document.getElementById('adminMainTabBar');
  if(!bar)return;
  bar.innerHTML=ADMIN_MAIN_TABS.map(t=>
    `<div class="ti${t.key===mainKey?' on':''}" onclick="renderAdminMainTabs('${t.key}')">${t.label}</div>`
  ).join('');
  const subs=ADMIN_SUB_TABS[mainKey]||[];
  renderAdminSubTabs(mainKey,subs[0]?.key);
}
function renderAdminSubTabs(mainKey,subKey){
  _adminSubTab=subKey;
  const subs=ADMIN_SUB_TABS[mainKey]||[];
  const bar=document.getElementById('adminSubTabBar');
  if(!bar)return;
  bar.innerHTML=subs.map(t=>
    `<div class="ti${t.key===subKey?' on':''}" onclick="renderAdminSubTabs('${mainKey}','${t.key}')">${t.label}</div>`
  ).join('');
  // 모든 패널 숨김
  Object.values(ADMIN_SUB_TABS).flat().forEach(t=>{
    const el=document.getElementById(t.panel);if(el)el.style.display='none';
  });
  // 현재 패널 표시 + 데이터 로드
  const cur=subs.find(t=>t.key===subKey);
  if(cur){
    const el=document.getElementById(cur.panel);
    if(el)el.style.display='block';
    if(cur.load)cur.load();
  }
}
// 레거시 호환 — 기존 admTab 호출 지점에서 사용
function admTab(tab,el){
  for(const[mainKey,subs] of Object.entries(ADMIN_SUB_TABS)){
    const found=subs.find(s=>s.key===tab);
    if(found){renderAdminMainTabs(mainKey);setTimeout(()=>renderAdminSubTabs(mainKey,tab),50);return;}
  }
}
function admTab_show(){}// no-op, renderAdminSubTabs가 담당

// ════ 마스터 전용 페이지 ════
const MASTER_PAGE_TABS=[
  {key:'mstrUsers',    label:'사용자 관리'},
  {key:'mstrRoles',    label:'권한 관리'},
  {key:'mstrDatabase', label:'전체 DB'},
  {key:'mstrDbUpload', label:'DB 업로드'},
];
const MASTER_TAB_PANEL_MAP={
  mstrUsers:'admUsers',
  mstrRoles:'admRoles',
  mstrDatabase:'admCrmWrap',
  mstrDbUpload:'admDbUpload',
};
function setupMasterPage(initialTab='mstrUsers'){
  const role=(PR?.role||'').toLowerCase();
  if(role!=='master'){goPage('dash');return;}
  const sel=document.getElementById('nRole');
  if(sel)sel.innerHTML=getAllowedRoleOpts('');
  const tabBar=document.getElementById('masterTabBar');
  if(!tabBar)return;
  tabBar.innerHTML=MASTER_PAGE_TABS.map(t=>
    `<div class="ti${t.key===initialTab?' on':''}" onclick="masterTab('${t.key}',this)">${t.label}</div>`
  ).join('');
  masterTab_show(initialTab);
  if(initialTab==='mstrUsers')loadAdmUsers();
  if(initialTab==='mstrRoles')loadAdmUsersRoles();
  if(initialTab==='mstrDatabase'){loadAdmCRM();loadMgrFilter();}
}
function masterTab(tab,el){
  document.querySelectorAll('#masterTabBar .ti').forEach(t=>t.classList.remove('on'));
  if(el)el.classList.add('on');
  masterTab_show(tab);
  if(tab==='mstrUsers')loadAdmUsers();
  if(tab==='mstrRoles')loadAdmUsersRoles();
  if(tab==='mstrDatabase'){loadAdmCRM();loadMgrFilter();}
}
function masterTab_show(tab){
  Object.entries(MASTER_TAB_PANEL_MAP).forEach(([key,panelId])=>{
    const el=document.getElementById(panelId);
    if(el)el.style.display=(key===tab)?'block':'none';
  });
}
function showMasterPanel(tab){
  goPage('master');// legacy redirect
}

// ── 권한 관리 패널 (마스터 전용) ──
async function loadAdmUsersRoles(){
  const{data}=await sb.from('users').select('*').order('name');
  const tbody=document.getElementById('rolesBody');
  if(!tbody)return;
  if(!data?.length){tbody.innerHTML='<tr><td colspan="4" class="empty">사용자 없음</td></tr>';return;}
  tbody.innerHTML=data.map(u=>`<tr>
    <td><strong>${u.name||'-'}</strong></td>
    <td style="color:var(--gray-500);font-size:13px">${u.email||'-'}</td>
    <td><span class="badge ${rlCls(u.role)}">${rlLbl(u.role)}</span></td>
    <td><select class="role-sel" onchange="changeRole('${u.id}',this.value)">${getAllowedRoleOpts(u.role)}</select></td>
  </tr>`).join('');
}

// ── 관리자 설정 > 계정관리 > 권한 변경 패널 ──
async function loadAdmUsersRolePanel(){
  const kw=(document.getElementById('roleChangeSearch')?.value||'').toLowerCase();
  const{data}=await sb.from('users').select('*').order('name');
  const filtered=(data||[]).filter(u=>!kw||u.name?.toLowerCase().includes(kw)||u.email?.toLowerCase().includes(kw));
  const tbody=document.getElementById('roleChangeBody');
  if(!tbody)return;
  if(!filtered.length){tbody.innerHTML='<tr><td colspan="4" class="empty">사용자 없음</td></tr>';return;}
  tbody.innerHTML=filtered.map(u=>`<tr>
    <td><strong>${u.name||'-'}</strong></td>
    <td style="color:var(--gray-500);font-size:13px">${u.email||'-'}</td>
    <td><span class="badge ${rlCls(u.role)}">${rlLbl(u.role)}</span></td>
    <td><select class="role-sel" onchange="changeRole('${u.id}',this.value)">${getAllowedRoleOpts(u.role)}</select></td>
  </tr>`).join('');
}

// ── 관리자 설정 > 계정관리 > 비밀번호 초기화 패널 ──
async function loadAdmUsersPwPanel(){
  const kw=(document.getElementById('pwResetSearch')?.value||'').toLowerCase();
  const{data}=await sb.from('users').select('*').order('name');
  const filtered=(data||[]).filter(u=>!kw||u.name?.toLowerCase().includes(kw)||u.email?.toLowerCase().includes(kw));
  const el=document.getElementById('pwResetPanelList');
  if(!el)return;
  if(!filtered.length){el.innerHTML='<div class="empty">사용자 없음</div>';return;}
  el.innerHTML=`<table class="tbl"><thead><tr><th>이름</th><th>이메일</th><th>권한</th><th>비밀번호 초기화</th></tr></thead>
  <tbody>${filtered.map(u=>`<tr>
    <td><strong>${u.name||'-'}</strong></td>
    <td style="font-size:12px;font-family:monospace;color:var(--gray-700);background:var(--gray-50);padding:8px 6px;border-radius:4px">${u.email||'-'}</td>
    <td><span class="badge ${rlCls(u.role)}">${rlLbl(u.role)}</span></td>
    <td><button class="btn-g btn-sm" onclick="openPwResetModal('${u.id}','${u.email}','${(u.name||u.email).replace(/'/g,"\\'")}')">🔑 재설정 링크 발송</button></td>
  </tr>`).join('')}</tbody></table>`;
}

// ── 관리자 설정 > 계정관리 > 사용자 생성 ──
async function createUserAdmin(){
  const email=document.getElementById('adm_nEmail')?.value.trim();
  const pw=document.getElementById('adm_nPw')?.value.trim();
  const nick=document.getElementById('adm_nNick')?.value.trim();
  const role=document.getElementById('adm_nRole')?.value;
  if(!email||!pw||!nick){setMsg('adm_createMsg','모든 항목을 입력하세요.',false);return;}
  if(pw.length<8){setMsg('adm_createMsg','비밀번호는 8자 이상.',false);return;}
  const{data,error}=await sb.auth.signUp({email,password:pw});
  if(error){setMsg('adm_createMsg','오류: '+error.message,false);return;}
  const uid=data.user?.id;
  if(uid)await sb.from('users').upsert([{id:uid,name:nick,role,email}]);
  setMsg('adm_createMsg','✓ 계정 생성 완료 — 이메일 인증 발송됨',true);
  ['adm_nEmail','adm_nPw','adm_nNick'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  // 권한 변경 패널 갱신
  if(_adminSubTab==='roleChange')loadAdmUsersRolePanel();
}

// ════ DB 업로드 ════
function openDbUploadModal(){
  const m=document.getElementById('dbUploadModal');
  if(m)m.style.display='flex';
  const f=document.getElementById('dbUploadFile');
  if(f)f.value='';
  const msg=document.getElementById('dbUploadMsg');
  if(msg){msg.textContent='-';msg.className='stmsg';}
}
function closeDbUploadModal(){
  const m=document.getElementById('dbUploadModal');
  if(m)m.style.display='none';
}
function downloadCsvTemplate(){
  const headers=['업체명','전화번호','영업단계','주소','업종','담당자','서브연락처','네이버URL','대표특징','상태'];
  const example=['홍길동치킨','010-1234-5678','가망','서울시 강남구 테헤란로 1','음식점','담당자명','010-9876-5432','https://map.naver.com/...','직영점','가망'];
  const csv='\uFEFF'+headers.join(',')+'\n'+example.join(',');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='MUYI_DB_업로드양식.csv';
  document.body.appendChild(a);a.click();
  URL.revokeObjectURL(url);a.remove();
}
async function doDbUpload(){
  const fileEl=document.getElementById('dbUploadFile');
  const file=fileEl?.files[0];
  if(!file){setMsg('dbUploadMsg','파일을 선택해주세요.',false);return;}
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['csv','xlsx','xls'].includes(ext)){setMsg('dbUploadMsg','CSV 또는 XLSX 파일만 지원합니다.',false);return;}
  const btn=document.getElementById('doDbUploadBtn');
  if(btn){btn.disabled=true;btn.textContent='처리 중...';}
  setMsg('dbUploadMsg','파일 읽는 중...', true);
  try{
    let rawRows=[];
    if(ext==='csv'){
      const text=await file.text();
      const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l);
      if(lines.length<2){setMsg('dbUploadMsg','⚠️ 데이터가 없습니다.',false);if(btn){btn.disabled=false;btn.textContent='업로드';}return;}
      const headers=lines[0].split(',').map(h=>h.replace(/^\uFEFF/,'').replace(/^"|"$/g,'').trim());
      rawRows=lines.slice(1).map(line=>{
        const cols=line.split(',');
        const obj={};
        headers.forEach((h,i)=>obj[h]=(cols[i]||'').replace(/^"|"$/g,'').trim());
        return obj;
      });
    }else{
      if(typeof XLSX==='undefined'){setMsg('dbUploadMsg','XLSX 라이브러리를 불러오는 중 오류가 발생했습니다.',false);if(btn){btn.disabled=false;btn.textContent='업로드';}return;}
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      rawRows=XLSX.utils.sheet_to_json(ws,{defval:''});
    }
    // 컬럼 자동 매핑
    const COL={
      business_name:['업체명','가게명','상호명','상호','name','business_name','업체'],
      phone:['전화번호','전화','연락처','phone','tel','핸드폰','휴대폰'],
      stage:['영업단계','단계','stage','상태값'],
      address:['주소','address','addr','지번주소'],
      industry:['업종','카테고리','category','industry','업태','분류'],
      manager:['담당자','담당자명','담당','manager','담당사원'],
      sub_phone:['서브연락처','서브전화','sub_phone','subPhone','보조연락처'],
      naver_url:['네이버URL','네이버url','naver_url','naverUrl','url','URL'],
      feature:['대표특징','특징','feature','특이사항','비고','설명'],
      status:['상태','status'],
      memo:['비고','메모','memo','note','notes','비고사항'],
    };
    function mapCol(row,aliases){
      for(const a of aliases){
        const v=row[a];
        if(v!==undefined&&v!==null&&String(v).trim()!=='')return String(v).trim();
      }
      return null;
    }
    const VALID_STAGES=['가망','컨택중','미팅확정','검토중','계약완료','영업종결'];
    const VALID_STATUS=['가망','계약중'];
    const payload=rawRows.map(row=>({
      business_name:mapCol(row,COL.business_name),
      phone:mapCol(row,COL.phone),
      stage:(()=>{const s=mapCol(row,COL.stage);return s&&VALID_STAGES.includes(s)?s:'가망';})(),
      address:mapCol(row,COL.address)||null,
      industry:mapCol(row,COL.industry)||'기타',
      manager:mapCol(row,COL.manager)||(PR?.name||AU?.email||null),
      manager_id:AU?.id||null,
      sub_phone:mapCol(row,COL.sub_phone)||null,
      naver_url:mapCol(row,COL.naver_url)||null,
      feature:mapCol(row,COL.feature)||null,
      status:(()=>{const s=mapCol(row,COL.status);return s&&VALID_STATUS.includes(s)?s:'가망';})(),
      memo:mapCol(row,COL.memo)||null,
    })).filter(r=>r.business_name&&r.phone);
    if(!payload.length){
      setMsg('dbUploadMsg','⚠️ 유효한 데이터가 없습니다. (업체명·전화번호 필수)',false);
      if(btn){btn.disabled=false;btn.textContent='업로드';}return;
    }
    setMsg('dbUploadMsg',`총 ${payload.length}건 업로드 중...`,true);
    let success=0,failed=0;
    const BATCH=100;
    for(let i=0;i<payload.length;i+=BATCH){
      const{error}=await sb.from('prospects').insert(payload.slice(i,i+BATCH));
      if(error)failed+=Math.min(BATCH,payload.length-i);
      else success+=Math.min(BATCH,payload.length-i);
    }
    const msg=`✅ ${success}건 업로드 완료${failed>0?` / ⚠️ ${failed}건 실패`:''}`;
    setMsg('dbUploadMsg',msg,true);
    showToast(msg,'success');
    if(fileEl)fileEl.value='';
    if(success>0)setTimeout(closeDbUploadModal,2500);
  }catch(err){
    setMsg('dbUploadMsg','오류: '+err.message,false);
    console.error('DB Upload error:',err);
  }
  if(btn){btn.disabled=false;btn.textContent='업로드';}
}

async function loadAdmUsers(){
  const{data}=await sb.from('users').select('*').order('created_at',{ascending:false});
  const tbody=document.getElementById('userBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="5" class="empty">사용자 없음</td></tr>';return}
  tbody.innerHTML=data.map(u=>`<tr>
    <td><strong>${u.name||'-'}</strong></td>
    <td style="color:#6b7494;font-size:13px">${u.email||'-'}</td>
    <td><span class="badge ${rlCls(u.role)}">${rlLbl(u.role)}</span></td>
    <td><select class="role-sel" onchange="changeRole('${u.id}',this.value)">${getAllowedRoleOpts(u.role)}</select></td>
    <td><button class="btn-g btn-sm" onclick="openPwResetModal('${u.id}','${u.email}','${u.name||u.email}')">🔑 재설정</button></td>
  </tr>`).join('');
}
async function changeRole(uid,role){
  if(role==='inactive'&&!confirm('INACTIVE로 변경하시겠습니까?'))return;
  await sb.from('users').update({role}).eq('id',uid);loadAdmUsers();
}

let pwResetTargetId=null,pwResetTargetEmail=null;

function pwResetTab(tab){
  const isEmail=tab==='email';
  document.getElementById('pwSectionEmail').style.display=isEmail?'block':'none';
  document.getElementById('pwSectionDirect').style.display=isEmail?'none':'block';
  document.getElementById('pwTabEmail').style.cssText=isEmail?'flex:1;font-weight:700;background:var(--blue);color:#fff':'flex:1;font-weight:700';
  document.getElementById('pwTabDirect').style.cssText=isEmail?'flex:1;font-weight:700':'flex:1;font-weight:700;background:var(--blue);color:#fff';
  document.getElementById('pwResetMsg').textContent='-';
  document.getElementById('pwResetMsg').className='stmsg';
}

function openPwResetModal(uid,email,name){
  pwResetTargetId=uid;pwResetTargetEmail=email;
  document.getElementById('pwResetTargetLabel').textContent=`대상: ${name}`;
  document.getElementById('pwResetEmail').value=email;
  document.getElementById('pwResetEmailDisplay').textContent=email;
  document.getElementById('pwResetMsg').className='stmsg';
  document.getElementById('pwResetMsg').textContent='-';
  // 이메일 표시만 (수정 불가 - Auth 등록 이메일 사용)
  document.getElementById('pwResetEmail').style.display='none';
  document.getElementById('pwResetEmailDisplay').style.display='block';
  document.getElementById('pwResetEmailEditBtn').style.display='none';
  document.getElementById('pwResetEmailEditHint').style.display='none';
  // 결과박스 초기화
  const rb=document.getElementById('pwResetResultBox');if(rb)rb.style.display='none';
  const np=document.getElementById('newPwForUser');if(np)np.value='';
  // 기본 탭: 직접 변경 (이메일 rate limit 이슈 때문에)
  pwResetTab('direct');
  document.getElementById('pwResetModal').style.display='flex';
}

function togglePwResetEmailEdit(){
  const inputEl=document.getElementById('pwResetEmail');
  const displayEl=document.getElementById('pwResetEmailDisplay');
  const btnEl=document.getElementById('pwResetEmailEditBtn');
  const isEditing=inputEl.style.display==='block';

  if(isEditing){
    // 편집 완료 → 표시 모드
    displayEl.textContent=inputEl.value;
    inputEl.style.display='none';
    displayEl.style.display='block';
    btnEl.textContent='✏️ 이메일 변경';
  }else{
    // 표시 모드 → 편집 모드
    inputEl.style.display='block';
    displayEl.style.display='none';
    btnEl.textContent='✓ 확인';
    inputEl.focus();
  }
}
function closePwResetModal(){
  document.getElementById('pwResetModal').style.display='none';
  pwResetTargetId=null;pwResetTargetEmail=null;
}

function generateTempPw(){
  const chars='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let pw='';for(let i=0;i<10;i++)pw+=chars[Math.floor(Math.random()*chars.length)];
  document.getElementById('newPwForUser').value=pw;
}

function copyTempPw(){
  const pw=document.getElementById('pwResetResultPw').textContent;
  navigator.clipboard.writeText(pw).then(()=>alert('✅ 클립보드에 복사되었습니다!'));
}

async function sendResetEmail(){
  // 등록된 사용자 이메일만 사용 (Auth에 등록된 이메일)
  const email=pwResetTargetEmail;

  if(!email){setMsg('pwResetMsg','사용자 이메일 정보가 없습니다.',false);return}

  const btn=document.getElementById('sendResetEmailBtn');
  btn.disabled=true;btn.textContent='발송 중...';
  setMsg('pwResetMsg','재설정 링크를 발송하는 중입니다...',true);

  try{
    const{error}=await sb.auth.resetPasswordForEmail(email,{
      redirectTo: window.location.origin + '/reset-password.html'
    });
    if(error){
      const msg=(error.message==='User not found')?'⚠️ Auth 시스템에 등록되지 않은 이메일입니다. 어드민에게 문의하세요.':'발송에 실패했습니다. 다시 시도해주세요.';
      setMsg('pwResetMsg',msg,false);
    }else{
      setMsg('pwResetMsg',`✅ ${email}로 비밀번호 재설정 링크를 발송했습니다.\n\n이메일을 확인하여 링크를 클릭하고 새 비밀번호를 설정해주세요.`,true);
      setTimeout(closePwResetModal,3000);
    }
  }catch(e){
    setMsg('pwResetMsg','오류가 발생했습니다. '+e.message,false);
  }
  btn.disabled=false;btn.textContent='📧 재설정 링크 발송하기';
}

async function doResetPw(){
  const newPw=document.getElementById('newPwForUser').value.trim();
  if(!pwResetTargetId){setMsg('pwResetMsg','대상 사용자 정보가 없습니다.',false);return}
  if(newPw.length<8){setMsg('pwResetMsg','비밀번호는 8자 이상이어야 합니다.',false);return}

  const btn=document.getElementById('doResetPwBtn');
  btn.disabled=true;btn.textContent='처리 중...';
  setMsg('pwResetMsg','비밀번호 변경 중...', true);

  try{
    const{data:{session}}=await sb.auth.getSession();
    if(!session){setMsg('pwResetMsg','세션이 만료되었습니다. 다시 로그인하세요.',false);btn.disabled=false;btn.textContent='🔑 비밀번호 변경';return}

    const res=await fetch(`${SB_URL}/functions/v1/reset-user-password`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${session.access_token}`,
        'apikey': SB_KEY
      },
      body:JSON.stringify({userId:pwResetTargetId,newPassword:newPw})
    });

    let result = {};
    try { result = await res.json(); } catch(_) {}
    if(!res.ok || result.error){
      setMsg('pwResetMsg','오류: '+(result.error||`HTTP ${res.status}`),false);
      btn.disabled=false;btn.textContent='🔑 비밀번호 변경';return;
    }

    document.getElementById('pwResetResultPw').textContent=newPw;
    document.getElementById('pwResetResultBox').style.display='block';
    document.getElementById('newPwForUser').value='';
    setMsg('pwResetMsg','✓ 비밀번호 변경 완료!',true);
  }catch(e){
    setMsg('pwResetMsg','네트워크 오류: '+e.message,false);
  }
  btn.disabled=false;btn.textContent='🔑 비밀번호 변경';
}

async function createUser(){
  const email=document.getElementById('nEmail').value.trim(),pw=document.getElementById('nPw').value.trim();
  const nick=document.getElementById('nNick').value.trim(),role=document.getElementById('nRole').value;
  if(!email||!pw||!nick){setMsg('createMsg','모든 항목을 입력하세요.',false);return}
  if(pw.length<8){setMsg('createMsg','비밀번호는 8자 이상.',false);return}
  const{data,error}=await sb.auth.signUp({email,password:pw});
  if(error){setMsg('createMsg','오류: '+error.message,false);return}
  const uid=data.user?.id;
  if(uid)await sb.from('users').upsert([{id:uid,name:nick,role,email}]);
  setMsg('createMsg','✓ 계정 생성 완료 — 이메일 인증 발송됨',true);
  ['nEmail','nPw','nNick'].forEach(id=>document.getElementById(id).value='');loadAdmUsers();
}

async function loadMgrFilter(){
  const{data}=await sb.from('users').select('id,name').order('name');
  const sel=document.getElementById('admMgr');
  sel.innerHTML='<option value="">전체 담당자</option>';
  (data||[]).forEach(u=>{sel.innerHTML+=`<option value="${u.id}">${u.name}</option>`});
}
async function loadTpMgrFilter(){
  const{data}=await sb.from('users').select('id,name').order('name');
  const sel=document.getElementById('tpMgr');if(!sel)return;
  sel.innerHTML='<option value="">전체 담당자</option>';
  (data||[]).forEach(u=>{sel.innerHTML+=`<option value="${u.id}">${u.name}</option>`});
}
async function loadTeamPipeline(){
  const mgrId=document.getElementById('tpMgr')?.value||'';
  let q=sb.from('prospects').select('stage,manager,id,business_name,phone,created_at');
  if(mgrId)q=q.eq('manager_id',mgrId);
  const[{data},{data:usersRaw}]=await Promise.all([q,sb.from('users').select('name')]);
  const sc={};STAGES.forEach(s=>sc[s.key]=0);(data||[]).forEach(r=>sc[r.stage||'가망']++);
  const total=data?.length||0;
  document.getElementById('teamPipeCards').innerHTML=STAGES.map(s=>`
    <div class="pipe-card ${s.pipe}"><div class="pipe-icon">${s.icon}</div><div class="pipe-label">${s.label}</div>
    <div class="pipe-count">${sc[s.key]}</div><div class="pipe-sub">${total>0?Math.round(sc[s.key]/total*100):0}%</div></div>`).join('');
  document.getElementById('tpListLabel').textContent='전체 '+total+'건';
  const tbody=document.getElementById('tpListBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="6" class="empty">데이터 없음</td></tr>';return}
  const un=(usersRaw||[]).map(u=>u.name);
  tbody.innerHTML=data.map(r=>`<tr>
    <td><strong>${r.business_name||'-'}</strong></td><td>${r.phone||'-'}</td>
    <td>${stageBadge(r.stage||'가망')}</td><td>${r.manager||'-'}</td>
    <td><select class="role-sel" onchange="transferCrm(${r.id},this.value)">
      <option value="${r.manager||''}">${r.manager||'-'}</option>
      ${un.filter(n=>n!==r.manager).map(n=>`<option value="${n}">${n}</option>`).join('')}
    </select></td><td>${fmtDate(r.created_at)}</td>
  </tr>`).join('');
  loadMemberBars();
}
async function loadBlockedAdmin(){
  const{data}=await sb.from('blocked_stores').select('*').order('created_at',{ascending:false});
  const tbody=document.getElementById('blockedBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="4" class="empty">영업 불가 브랜드 없음</td></tr>';return}
  tbody.innerHTML=data.map(b=>`<tr><td><strong>${b.brand_name}</strong></td><td>${b.reason||'-'}</td><td>${fmtDate(b.created_at)}</td><td><button class="btn-d" onclick="deleteBlockedStore(${b.id},this)">삭제</button></td></tr>`).join('');
}
async function saveBlockedStore(){
  const name=document.getElementById('bName').value.trim(),reason=document.getElementById('bReason').value.trim();
  if(!name){setMsg('blockedMsg','브랜드명을 입력하세요.',false);return}
  const{error}=await sb.from('blocked_stores').insert([{brand_name:name,reason:reason||null}]);
  if(error){setMsg('blockedMsg','오류: '+error.message,false);return}
  setMsg('blockedMsg','✓ 등록 완료',true);document.getElementById('bName').value='';document.getElementById('bReason').value='';loadBlockedAdmin();
}
async function deleteBlockedStore(id,btn){
  if(!confirm('삭제하시겠습니까?'))return;
  const{error}=await sb.from('blocked_stores').delete().eq('id',id);
  if(!error)btn.closest('tr').remove();
}
async function saveGoal(){
  const year=parseInt(document.getElementById('goalYear').value),month=parseInt(document.getElementById('goalMonth').value);
  const calls=parseInt(document.getElementById('goalCalls').value)||0,crm=parseInt(document.getElementById('goalCrm').value)||0,contracts=parseInt(document.getElementById('goalContracts').value)||0;
  if(!year||!month){setMsg('goalMsg','연도와 월을 입력하세요.',false);return}
  const{error}=await sb.from('goals').upsert([{year,month,target_calls:calls,target_crm:crm,target_contracts:contracts}],{onConflict:'year,month'});
  if(error){setMsg('goalMsg','오류: '+error.message,false);}else{setMsg('goalMsg','✓ 저장 완료',true);loadGoalHist();}
}
async function loadGoalHist(){
  const{data}=await sb.from('goals').select('*').order('year',{ascending:false}).order('month',{ascending:false});
  const tbody=document.getElementById('goalHistBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="4" class="empty">설정된 목표 없음</td></tr>';return}
  tbody.innerHTML=data.map(g=>`<tr><td>${g.year}년 ${g.month}월</td><td>${g.target_calls}콜</td><td>${g.target_crm}건</td><td>${g.target_contracts}건</td></tr>`).join('');
}
async function loadTemplateAdmin(){
  const{data}=await sb.from('call_templates').select('*').order('created_at',{ascending:false});
  const el=document.getElementById('templateAdminList');
  if(!data?.length){el.innerHTML='<div class="empty">등록된 템플릿 없음</div>';return}
  el.innerHTML=data.map(t=>`
    <div class="template-item" style="cursor:default">
      <div style="font-size:18px">📋</div>
      <div style="flex:1"><div class="template-title">${t.title}</div><div class="template-preview">${t.content}</div></div>
      <button class="btn-d" onclick="deleteTemplate(${t.id},this)">삭제</button>
    </div>`).join('');
}
async function saveTemplate(){
  const title=document.getElementById('tplTitle').value.trim(),content=document.getElementById('tplContent').value.trim();
  if(!title||!content){setMsg('tplMsg','제목과 내용을 입력하세요.',false);return}
  const{error}=await sb.from('call_templates').insert([{title,content,created_by:PR?.name||AU.email}]);
  if(error){setMsg('tplMsg','오류: '+error.message,false);return}
  setMsg('tplMsg','✓ 등록 완료',true);document.getElementById('tplTitle').value='';document.getElementById('tplContent').value='';loadTemplateAdmin();
}
async function deleteTemplate(id,btn){
  if(!confirm('삭제하시겠습니까?'))return;
  const{error}=await sb.from('call_templates').delete().eq('id',id);
  if(!error)btn.closest('.template-item').remove();
}

// ── 주간 리포트 ──
async function loadWeeklyReport(){
  const weekInput=document.getElementById('reportWeek');
  const el=document.getElementById('weeklyReportContent');
  if(!weekInput.value){
    const n=new Date();
    const yr=n.getFullYear();
    const wk=Math.ceil((((n-new Date(yr,0,1))/86400000)+new Date(yr,0,1).getDay()+1)/7);
    weekInput.value=`${yr}-W${String(wk).padStart(2,'0')}`;
  }
  const [yr,wkStr]=weekInput.value.split('-W');
  const wkNum=parseInt(wkStr);
  const jan4=new Date(parseInt(yr),0,4);
  const startOfWeek=new Date(jan4.getTime()+(wkNum-1)*7*86400000);
  startOfWeek.setDate(startOfWeek.getDate()-startOfWeek.getDay()+1);
  const endOfWeek=new Date(startOfWeek.getTime()+6*86400000);
  const ss=startOfWeek.toISOString().slice(0,10);
  const ee=endOfWeek.toISOString().slice(0,10);

  el.innerHTML='<div class="empty">로딩 중...</div>';

  const[{data:callData},{data:crmData},{data:contractData},{data:users}]=await Promise.all([
    sb.from('calls').select('manager,call_count,call_time').gte('date',ss).lte('date',ee),
    sb.from('prospects').select('manager,stage,industry').gte('created_at',ss+'T00:00:00').lte('created_at',ee+'T23:59:59'),
    sb.from('prospects').select('business_name,manager,stage').eq('stage','계약완료').gte('updated_at',ss+'T00:00:00').lte('updated_at',ee+'T23:59:59'),
    sb.from('users').select('id,name').in('role',['user','admin','master']),
  ]);
  const umap={};(users||[]).forEach(u=>umap[u.id]=u.name);
  const callByMgr={};(callData||[]).forEach(r=>{const n=umap[r.manager]||r.manager;if(!callByMgr[n])callByMgr[n]={calls:0,time:0};callByMgr[n].calls+=r.call_count||0;callByMgr[n].time+=r.call_time||0;});
  const crmByMgr={};(crmData||[]).forEach(r=>{if(!crmByMgr[r.manager])crmByMgr[r.manager]=0;crmByMgr[r.manager]++;});
  const totalCalls=Object.values(callByMgr).reduce((s,v)=>s+v.calls,0);
  const totalTime=Object.values(callByMgr).reduce((s,v)=>s+v.time,0);
  const totalCrm=crmData?.length||0;
  const totalContract=contractData?.length||0;
  const industryMap={};(crmData||[]).forEach(r=>{const i=r.industry||'기타';if(!industryMap[i])industryMap[i]=0;industryMap[i]++;});
  const topIndustry=Object.entries(industryMap).sort((a,b)=>b[1]-a[1]).slice(0,3);

  el.innerHTML=`
    <div class="report-section">
      <div class="report-section-title">📅 ${ss} ~ ${ee} 주간 팀 실적</div>
      <div class="report-stat-grid">
        <div class="report-stat"><div class="report-stat-val">${totalCalls}</div><div class="report-stat-lbl">총 아웃바운드 콜</div></div>
        <div class="report-stat"><div class="report-stat-val">${totalTime}분</div><div class="report-stat-lbl">총 통화 시간</div></div>
        <div class="report-stat"><div class="report-stat-val">${totalCrm}</div><div class="report-stat-lbl">신규 가망 등록</div></div>
        <div class="report-stat"><div class="report-stat-val" style="color:#ee4e00">${totalContract}</div><div class="report-stat-lbl">계약 완료</div></div>
      </div>
    </div>
    <div class="report-section">
      <div class="report-section-title">👤 담당자별 실적</div>
      <table class="tbl"><thead><tr><th>담당자</th><th>콜 수</th><th>통화시간</th><th>가망 등록</th></tr></thead>
      <tbody>${Object.entries(callByMgr).sort((a,b)=>b[1].calls-a[1].calls).map(([n,v])=>`
        <tr><td><strong>${n}</strong></td><td>${v.calls}콜</td><td>${v.time}분</td><td>${crmByMgr[n]||0}건</td></tr>`).join('')}
      </tbody></table>
    </div>
    ${totalContract>0?`<div class="report-section">
      <div class="report-section-title">🎉 이번 주 계약 완료</div>
      <table class="tbl"><thead><tr><th>업체명</th><th>담당자</th></tr></thead>
      <tbody>${(contractData||[]).map(r=>`<tr><td><strong>${r.business_name||'-'}</strong></td><td>${r.manager||'-'}</td></tr>`).join('')}</tbody></table>
    </div>`:''}
    ${topIndustry.length?`<div class="report-section">
      <div class="report-section-title">🏷️ 이번 주 등록 상위 업종</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${topIndustry.map(([ind,cnt])=>`<span class="tag-chip industry">${ind} <strong>${cnt}건</strong></span>`).join('')}</div>
    </div>`:''}
  `;
}

async function exportReportExcel(){
  const weekInput=document.getElementById('reportWeek');
  if(!weekInput?.value){alert('기간을 선택하세요.');return}
  const [yr,wkStr]=weekInput.value.split('-W');
  const wkNum=parseInt(wkStr);
  const jan4=new Date(parseInt(yr),0,4);
  const startOfWeek=new Date(jan4.getTime()+(wkNum-1)*7*86400000);
  startOfWeek.setDate(startOfWeek.getDate()-startOfWeek.getDay()+1);
  const endOfWeek=new Date(startOfWeek.getTime()+6*86400000);
  const ss=startOfWeek.toISOString().slice(0,10),ee=endOfWeek.toISOString().slice(0,10);
  const{data:callData}=await sb.from('calls').select('*').gte('date',ss).lte('date',ee);
  const{data:users}=await sb.from('users').select('id,name');
  const umap={};(users||[]).forEach(u=>umap[u.id]=u.name);
  const rows=(callData||[]).map(r=>({날짜:r.date,담당자:umap[r.manager]||r.manager,콜수:r.call_count||0,통화시간:r.call_time||0,메모:r.memo||''}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,'주간리포트',ws);
  XLSX.writeFile(wb,`MUYI_리포트_${ss}_${ee}.xlsx`);
}

// ── 사원별 현황 막대 ──
async function loadMemberBars(){
  const[{data:prospects},{data:users}]=await Promise.all([
    sb.from('prospects').select('manager,stage'),
    sb.from('users').select('name').in('role',['user','admin','master']),
  ]);
  const STAGE_COLORS={'가망':'#6366f1','컨택중':'#f59e0b','검토중':'#8b5cf6','미팅확정':'#ee4e00','계약완료':'#10b981','영업종결':'#ef4444'};
  const byMgr={};
  (users||[]).forEach(u=>{byMgr[u.name]={};});
  (prospects||[]).forEach(r=>{
    if(!byMgr[r.manager])byMgr[r.manager]={};
    const s=r.stage||'가망';
    byMgr[r.manager][s]=(byMgr[r.manager][s]||0)+1;
  });
  const el=document.getElementById('memberBarsWrap');if(!el)return;
  el.innerHTML=Object.entries(byMgr).filter(([n,v])=>Object.values(v).some(x=>x>0)).map(([name,stages])=>{
    const total=Object.values(stages).reduce((s,v)=>s+v,0);
    const segs=Object.entries(stages).map(([s,c])=>`<div class="member-bar-seg" style="width:${Math.round(c/total*100)}%;background:${STAGE_COLORS[s]||'#9fa6bc'}" title="${s}: ${c}건">${c}</div>`).join('');
    return`<div class="member-bar-wrap"><div class="member-bar-name"><span>${name}</span><span style="color:#9fa6bc;font-size:12px">총 ${total}건</span></div><div class="member-bar-track">${segs}</div></div>`;
  }).join('');
}

// ── 카카오워크 연동 ──
async function loadKakaoWorkSettings(){
  const[urlData,contractData,announceData]=await Promise.all([
    sb.from('system_settings').select('value').eq('key','kakaowork_webhook_url').maybeSingle(),
    sb.from('system_settings').select('value').eq('key','kakaowork_notify_contract').maybeSingle(),
    sb.from('system_settings').select('value').eq('key','kakaowork_notify_announce').maybeSingle(),
  ]);
  const urlEl=document.getElementById('kwWebhookUrl');
  if(urlEl&&urlData?.data?.value)urlEl.value=urlData.data.value;
  const nc=document.getElementById('kwNotifyContract');
  if(nc)nc.checked=contractData?.data?.value==='true';
  const na=document.getElementById('kwNotifyAnnounce');
  if(na)na.checked=announceData?.data?.value==='true';
}
async function saveKwWebhook(){
  const url=document.getElementById('kwWebhookUrl')?.value.trim();
  if(!url){setMsg('kwMsg','URL을 입력하세요.',false);return}
  await sb.from('system_settings').upsert([{key:'kakaowork_webhook_url',value:url,updated_at:new Date().toISOString()}]);
  setMsg('kwMsg','✓ 저장되었습니다.',true);
}
async function saveKwSettings(){
  const nc=document.getElementById('kwNotifyContract')?.checked;
  const na=document.getElementById('kwNotifyAnnounce')?.checked;
  await Promise.all([
    sb.from('system_settings').upsert([{key:'kakaowork_notify_contract',value:String(nc)}]),
    sb.from('system_settings').upsert([{key:'kakaowork_notify_announce',value:String(na)}]),
  ]);
  setMsg('kwMsg','✓ 알림 설정 저장 완료',true);
}
async function testKwWebhook(){
  setMsg('kwMsg','발송 중...',true);
  const{data:session}=await sb.auth.getSession();
  if(!session?.session)return;
  const res=await fetch(`${SB_URL}/functions/v1/kakaowork-notify`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':`Bearer ${session.session.access_token}`},
    body:JSON.stringify({type:'test',data:{}})
  });
  const r=await res.json();
  if(r.success)setMsg('kwMsg','✅ 테스트 발송 성공!',true);
  else setMsg('kwMsg','오류: '+(r.error||'실패'),false);
}
async function sendKakaoWorkNotify(type,data){
  try{
    const settingKey=type==='contract'?'kakaowork_notify_contract':'kakaowork_notify_announce';
    const{data:setting}=await sb.from('system_settings').select('value').eq('key',settingKey).maybeSingle();
    if(setting?.value!=='true')return;
    const{data:session}=await sb.auth.getSession();
    if(!session?.session)return;
    fetch(`${SB_URL}/functions/v1/kakaowork-notify`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':`Bearer ${session.session.access_token}`},
      body:JSON.stringify({type,data})
    }).catch(()=>{});
  }catch(e){}
}

// ── 내 정보 ──
async function changePw(){
  const curPw=document.getElementById('curPw').value.trim();
  const pw=document.getElementById('newPw').value.trim();
  const pw2=document.getElementById('newPwConfirm').value.trim();
  if(!curPw){setMsg('pwMsg','현재 비밀번호를 입력하세요.',false);return}
  if(pw.length<8){setMsg('pwMsg','새 비밀번호는 8자 이상.',false);return}
  if(pw!==pw2){setMsg('pwMsg','새 비밀번호가 일치하지 않습니다.',false);return}
  const{error:signErr}=await sb.auth.signInWithPassword({email:AU.email,password:curPw});
  if(signErr){setMsg('pwMsg','현재 비밀번호가 올바르지 않습니다.',false);return}
  const{error}=await sb.auth.updateUser({password:pw});
  if(error){setMsg('pwMsg','오류: '+error.message,false);}
  else{setMsg('pwMsg','✓ 비밀번호 변경 완료',true);['curPw','newPw','newPwConfirm'].forEach(id=>document.getElementById(id).value='');}
}

async function saveProfile(){
  const name=document.getElementById('myNickname').value.trim();
  const emoji=document.getElementById('myAnimalEmoji').value;
  if(!name){setMsg('profileMsg','닉네임을 입력하세요.',false);return}
  const{data:dup}=await sb.from('users').select('id').eq('name',name).neq('id',AU.id).maybeSingle();
  if(dup){setMsg('profileMsg','이미 사용 중인 닉네임입니다.',false);return}
  const{error}=await sb.from('users').update({name,animal_emoji:emoji}).eq('id',AU.id);
  if(error){setMsg('profileMsg','오류: '+error.message,false);return}
  PR.name=name;PR.animal_emoji=emoji;
  document.getElementById('uName').textContent=name;
  document.getElementById('uAv').textContent=emoji;
  document.getElementById('greeting').textContent=`안녕하세요, ${name}님 👋`;
  setMsg('profileMsg','✓ 프로필 저장 완료',true);
}

function loadMypage(){
  const name=PR?.name||AU?.email?.split('@')[0]||'';
  const el=document.getElementById('myNickname');
  if(el)el.value=name;
  initAnimalPicker();
  const roleDisplay=document.getElementById('myRoleDisplay');
  const roleBadge=document.getElementById('myRoleBadge');
  if(roleDisplay&&roleBadge&&PR?.role){
    roleDisplay.style.display='block';
    roleBadge.innerHTML=`<span class="badge ${rlCls(PR.role)}">${rlLbl(PR.role)}</span>`;
  }
  const masterSec=document.getElementById('mypageMasterSection');
  if(masterSec){
    if(PR?.role==='master'){
      masterSec.style.display='block';
      loadMypageUsers();
    }else{
      masterSec.style.display='none';
    }
  }
}

// ── 대시보드 미니 달력 ──
async function renderDashCal(){
  const yr=dashCalYear,mo=dashCalMonth;
  const lbl=document.getElementById('dashCalLabel');
  if(lbl)lbl.textContent=`${yr}년 ${mo+1}월`;
  const firstDay=new Date(yr,mo,1).getDay();
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  const startStr=`${yr}-${String(mo+1).padStart(2,'0')}-01`;
  const endStr=`${yr}-${String(mo+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
  const mgr=PR?.name||AU?.email;
  let q=sb.from('prospects').select('id,business_name,next_contact_date,stage').gte('next_contact_date',startStr).lte('next_contact_date',endStr);
  if(!isPriv())q=q.eq('manager_id',mgr);
  const{data}=await q;
  const evMap={};(data||[]).forEach(r=>{if(!evMap[r.next_contact_date])evMap[r.next_contact_date]=[];evMap[r.next_contact_date].push(r)});
  const todayStr=td();
  const grid=document.getElementById('dashCalGrid');if(!grid)return;
  const days=['일','월','화','수','목','금','토'];
  let html=days.map(d=>`<div class="dash-cal-hd">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++)html+=`<div class="dash-cal-cell other"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evs=evMap[ds]||[];const isToday=ds===todayStr;
    html+=`<div class="dash-cal-cell ${isToday?'today':''}" onclick="showCalDay('${ds}');goPage('calendar')">
      <div class="dash-cal-num">${d}</div>
      ${evs.slice(0,2).map(e=>`<div class="dash-cal-ev ${e.stage==='미팅확정'||e.stage==='검토중'?'urgent':''}">${e.business_name||'-'}</div>`).join('')}
      ${evs.length>2?`<div style="font-size:9px;color:#9fa6bc">+${evs.length-2}</div>`:''}
    </div>`;
  }
  grid.innerHTML=html;
}
function dashCalMove(dir){dashCalMonth+=dir;if(dashCalMonth>11){dashCalMonth=0;dashCalYear++;}else if(dashCalMonth<0){dashCalMonth=11;dashCalYear--;}renderDashCal();}

// ── 신규 등록 초기화 ──
function initRegForm(){
  const t=new Date();t.setDate(t.getDate()+1);
  const el=document.getElementById('rNextContact');
  if(el&&!el.value)el.value=t.toISOString().slice(0,10);
  initIndustryPickers();
  initNaverUrlParsing();
}

// ── 네이버 URL 자동완성 ──
let _naverUrlTimer=null;
function onNaverUrlInput(val){
  clearTimeout(_naverUrlTimer);
  const st=document.getElementById('naverParseStatus');
  if(!val||!val.trim()){if(st)st.innerHTML='';return;}
  const v=val.trim().toLowerCase();
  if(!v.includes('naver.me')&&!v.includes('map.naver.com')&&!v.includes('place.naver.com')){if(st)st.innerHTML='';return;}
  if(st)st.innerHTML='<span class="nps-loading">🔍 장소 정보 불러오는 중…</span>';
  _naverUrlTimer=setTimeout(()=>_fetchNaverPlace(val.trim()),900);
}
async function _fetchNaverPlace(url){
  const st=document.getElementById('naverParseStatus');
  try{
    const {data,error}=await sb.functions.invoke('naver-place',{body:{url}});
    if(error||!data?.name){
      if(st)st.innerHTML='<span class="nps-error">장소 정보를 찾을 수 없습니다</span>';
      return;
    }
    let filled=[];
    const nameEl=document.getElementById('rName');
    if(nameEl&&!nameEl.value&&data.name){nameEl.value=data.name;filled.push('업체명');}
    const addrEl=document.getElementById('rAddress');
    if(addrEl&&!addrEl.value&&data.address){addrEl.value=data.address;filled.push('주소');}
    const indEl=document.getElementById('rIndustry');
    if(indEl&&data.category){indEl.value=data.category;filled.push('업종');}
    if(st)st.innerHTML=filled.length
      ?`<span class="nps-success">✅ ${filled.join('·')} 자동완성됨</span>`
      :'<span class="nps-info">ℹ 이미 입력된 항목은 유지됩니다</span>';
  }catch(e){
    if(st)st.innerHTML='<span class="nps-error">오류: '+e.message+'</span>';
  }
}
function initNaverUrlParsing(){/* URL oninput 핸들러로 동작 */}

// ── 업종 피커 ──
const INDUSTRIES=["음식점", "카페", "베이커리", "치킨", "피자", "분식", "일식", "중식", "고기집", "술집", "호프", "이자카야", "카페/디저트", "피부샵", "네일샵", "헤어샵", "마사지", "세탁소", "편의점", "약국", "병원", "학원", "부동산", "숙박", "기타"];
function initIndustryPickers(){
  ['rIndustryPicker','listIndustryPicker'].forEach(pid=>{
    const el=document.getElementById(pid);if(!el)return;
    el.style.display='none';
    el.innerHTML=INDUSTRIES.map(ind=>`<span class="ind-chip" onclick="selectIndustry('${pid}','${ind}')">${ind}</span>`).join('');
  });
}
function toggleIndustryPicker(pid){
  const el=document.getElementById(pid);if(!el)return;
  const isOpen=el.style.display==='flex';
  document.querySelectorAll('.industry-picker').forEach(p=>p.style.display='none');
  if(!isOpen){el.style.display='flex';}
}
function selectIndustry(pid,val){
  document.getElementById(pid).style.display='none';
  if(pid==='rIndustryPicker'){document.getElementById('rIndustry').value=val;}
  else if(pid==='listIndustryPicker'){
    const el=document.getElementById('listIndustry');
    if(el)el.value=(el.value===val?'':val);
  }
  document.querySelectorAll(`#${pid} .ind-chip`).forEach(c=>c.classList.toggle('selected',c.textContent===val));
}
document.addEventListener('click',e=>{
  if(!e.target.closest('[id$="IndustryPicker"]')&&!e.target.closest('#rIndustry')&&!e.target.closest('#listIndustry')){
    document.querySelectorAll('.industry-picker').forEach(p=>p.style.display='none');
  }
});

// ── 동물 피커 ──
async function initAnimalPicker(){
  const wrap=document.getElementById('animalPickerWrap');if(!wrap)return;
  const cur=(PR?.animal_emoji)||getAnimal(PR?.name||AU?.email||'');
  document.getElementById('myAnimalEmoji').value=cur;
  let usedSet=new Set();
  try{
    const{data:ud}=await sb.from('users').select('animal_emoji').neq('id',AU?.id||'');
    usedSet=new Set((ud||[]).map(u=>u.animal_emoji).filter(Boolean));
  }catch(e){}
  wrap.innerHTML=ANIMALS.map(a=>{
    const isCur=a===cur,isUsed=usedSet.has(a)&&!isCur;
    const cls='animal-chip'+(isCur?' selected':'')+(isUsed?' animal-disabled':'');
    const attrs=isUsed?'style="opacity:.4;cursor:not-allowed;filter:grayscale(1)" title="사용중"':'onclick="selectAnimal(this.dataset.e)"';
    return'<div class="'+cls+'" data-e="'+a+'" '+attrs+'>'+a+'</div>';
  }).join('');
}
function selectAnimal(emoji){
  if(!emoji)return;
  document.getElementById('myAnimalEmoji').value=emoji;
  document.querySelectorAll('.animal-chip').forEach(c=>c.classList.toggle('selected',c.dataset.e===emoji||c.textContent===emoji));
}

// ── 자동완성 ──
async function onNameInput(val){
  const list=document.getElementById('nameAutoList');
  if(val.length<1){list.style.display='none';return}
  const{data}=await sb.from('prospects').select('business_name').ilike('business_name','%'+val+'%').limit(8);
  if(!data?.length){list.style.display='none';return}
  list.style.display='block';
  list.innerHTML=data.map(r=>`<div class="autocomplete-item" onclick="selectNameAuto('${r.business_name.replace(/'/g,"\\'")}','nameAutoList','searchName')">${r.business_name.replace(new RegExp(val,'gi'),m=>`<strong>${m}</strong>`)}</div>`).join('');
}
async function onRegNameInput(val){
  const list=document.getElementById('regNameAutoList');
  if(val.length<1){list.style.display='none';document.getElementById('regDupWarn').style.display='none';return}
  const{data}=await sb.from('prospects').select('business_name,stage,manager').ilike('business_name','%'+val+'%').limit(6);
  if(data?.length){
    list.style.display='block';
    list.innerHTML=data.map(r=>`<div class="autocomplete-item" onclick="selectNameAuto('${r.business_name.replace(/'/g,"\\'")}','regNameAutoList','rName')">${r.business_name} <small style="color:#9fa6bc">${r.stage||'가망'} · ${r.manager||'-'}</small></div>`).join('');
    document.getElementById('regDupWarn').style.display='block';
    document.getElementById('regDupWarn').textContent=`⚠️ "${data[0].business_name}" 등 ${data.length}건 유사 업체 발견 — 중복 확인 탭에서 먼저 확인하세요`;
  }else{list.style.display='none';document.getElementById('regDupWarn').style.display='none';}
}
function selectNameAuto(val,listId,inputId){
  document.getElementById(inputId).value=val;
  document.getElementById(listId).style.display='none';
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.autocomplete-wrap')){
    document.querySelectorAll('.autocomplete-list').forEach(l=>l.style.display='none');
  }
});

// ── 중복 확인 ──
async function loadBlockedInCheckTab(){
  const{data}=await sb.from('blocked_stores').select('*').order('created_at',{ascending:false});
  const el=document.getElementById('blockedListDisplay');
  if(!data?.length){el.innerHTML='';return}
  el.innerHTML=`<div class="blocked-store-banner"><div style="font-size:14px;font-weight:700;color:#c2410c">⛔ 전지점 영업 불가 브랜드</div>
    <div class="blocked-chips">${data.map(b=>`<span class="blocked-chip">${b.brand_name}</span>`).join('')}</div>
    <div style="font-size:13px;color:#9a3412;margin-top:7px">위 브랜드는 전지점 가망 취득 및 CRM 등록이 불가합니다.</div>
  </div>`;
}

async function checkDupByName(){
  const raw=document.getElementById('searchName').value.trim();
  const banner=document.getElementById('dupBanner'),list=document.getElementById('dupList');
  banner.innerHTML='';list.innerHTML='';
  if(!raw){banner.innerHTML=`<div class="dup-banner" style="background:#f0f4ff;border:1px solid #c7d2fe"><span class="db-ic">🔍</span><div><div class="db-title" style="color:#4338ca">업체명을 입력하세요</div></div></div>`;return}
  const{data:blocked}=await sb.from('blocked_stores').select('brand_name,reason');
  const mb=(blocked||[]).find(b=>raw.toLowerCase().includes(b.brand_name.toLowerCase()));
  if(mb){banner.innerHTML=`<div class="dup-banner" style="background:#fef2f2;border:1px solid #fecaca"><span class="db-ic">⛔</span><div><div class="db-title" style="color:#b91c1c">⛔ [${mb.brand_name}] 전지점 가망 취득불가</div><div class="db-sub">${mb.reason||'해당 브랜드는 전지점 영업 불가 업체입니다.'}</div></div></div>`;return}
  const{data}=await sb.from('prospects').select('*').ilike('business_name','%'+raw+'%');
  renderDupResult(data,raw,false);
}

async function checkDupByPhone(){
  const raw=document.getElementById('searchPhone').value.trim();
  const banner=document.getElementById('dupBanner'),list=document.getElementById('dupList');
  banner.innerHTML='';list.innerHTML='';
  const digits=raw.replace(/\D/g,'');
  if(digits.length<7){banner.innerHTML=`<div class="dup-banner" style="background:#fffbeb;border:1px solid #fde68a"><span class="db-ic">⚠️</span><div><div class="db-title" style="color:#b45309">전화번호 자릿수 부족</div><div class="db-sub">7자리 이상 입력해 주세요.</div></div></div>`;return}
  const fmted=fmtPhone(digits);
  const{data}=await sb.from('prospects').select('*').or(`phone.ilike.%${raw}%,phone.ilike.%${fmted}%`);
  renderDupResult(data,raw,true);
}

function renderDupResult(data,raw,isPhone){
  const banner=document.getElementById('dupBanner'),list=document.getElementById('dupList');
  if(data?.length>0){
    const hasC=data.some(d=>d.status==='계약중');
    banner.innerHTML=`<div class="dup-banner" style="background:${hasC?'#fef2f2':'#fff7ed'};border:1px solid ${hasC?'#fecaca':'#fed7aa'}">
      <span class="db-ic">${hasC?'⛔':'⚠️'}</span>
      <div><div class="db-title" style="color:${hasC?'#b91c1c':'#c2410c'}">${hasC?'⛔ 연락 금지 포함 · ':''}중복 ${data.length}건 발견</div>
      <div class="db-sub">${hasC?'계약중 포함. 절대 연락 금지.':'이미 등록된 가망고객입니다.'}</div></div>
      <button class="btn-s btn-sm" style="margin-left:auto;flex-shrink:0" onclick="quickReg('${raw}',${isPhone})">➕ 바로 등록</button>
    </div>`;
    list.innerHTML=`<table class="tbl"><thead><tr><th>업체명</th><th>전화번호</th><th>단계</th><th>상태</th><th>담당자</th><th>등록일</th></tr></thead>
      <tbody>${data.map(d=>`<tr><td><strong>${d.business_name||'-'}</strong></td><td>${maskPhone(d.phone)}</td><td>${stageBadge(d.stage||'가망')}</td><td>${stBadge(d.status||'가망')}</td><td>${d.manager||'-'}</td><td>${fmtDate(d.created_at)}</td></tr>`).join('')}</tbody></table>`;
  }else{
    banner.innerHTML=`<div class="dup-banner" style="background:#f0fdf4;border:1px solid #bbf7d0">
      <span class="db-ic">✅</span>
      <div><div class="db-title" style="color:#15803d">등록 가능 — 중복 없음</div><div class="db-sub">동일 ${isPhone?'전화번호':'업체명'} 없음.</div></div>
      <button class="btn-p btn-sm" style="margin-left:auto;flex-shrink:0" onclick="quickReg('${raw}',${isPhone})">➕ 바로 등록</button>
    </div>`;
  }
}
function quickReg(val,isPhone){
  crmTab('reg',document.querySelector('#pgCrm .tab-bar .ti:nth-child(2)'));
  if(isPhone){const d=val.replace(/\D/g,'');document.getElementById('rPhone').value=fmtPhone(d);}
  else document.getElementById('rName').value=val;
}

// ── 브라우저 푸시 알림 ──
async function setupPushNotification(){
  if(!('Notification' in window)){alert('이 브라우저는 알림을 지원하지 않습니다.');return}
  const perm=await Notification.requestPermission();
  const btn=document.getElementById('pushNotifyBtn');
  if(perm==='granted'){
    if(btn){btn.textContent='🔔 알림 ON';btn.style.background='#dcfce7';btn.style.borderColor='#10b981';}
    localStorage.setItem('pushEnabled','true');
    checkTodayContactsNotification();
  } else {
    if(btn){btn.textContent='🔕 알림 거부됨';}
    localStorage.setItem('pushEnabled','false');
  }
}

async function checkTodayContactsNotification(){
  if(Notification.permission!=='granted')return;
  if(localStorage.getItem('pushEnabled')!=='true')return;
  const lastNotify=localStorage.getItem('lastNotifyDate');
  const today=new Date().toISOString().slice(0,10);
  if(lastNotify===today)return;
  const mgr=PR?.name||AU?.email;
  let q=sb.from('prospects').select('id,business_name').eq('next_contact_date',today);
  if(!isPriv())q=q.eq('manager_id',mgr);
  const{data}=await q;
  if(data?.length>0){
    new Notification('📞 MUYI CRM - 오늘 연락 예정',{
      body:`오늘 연락 예정 ${data.length}건이 있습니다.\n${data.slice(0,3).map(d=>d.business_name).join(', ')}${data.length>3?` 외 ${data.length-3}건`:''}`,
      icon:'/favicon.ico'
    });
    localStorage.setItem('lastNotifyDate',today);
  }
}

function initPushBtn(){
  const btn=document.getElementById('pushNotifyBtn');
  if(!btn||!('Notification' in window))return;
  btn.style.display='flex';
  const enabled=localStorage.getItem('pushEnabled')==='true';
  const perm=Notification.permission;
  if(perm==='granted'&&enabled){
    btn.textContent='🔔 알림 ON';btn.style.background='#dcfce7';btn.style.borderColor='#10b981';
    checkTodayContactsNotification();
  } else if(perm==='denied'){
    btn.textContent='🔕 알림 차단됨';btn.disabled=true;
  } else {
    btn.textContent='🔔 알림 설정';
  }
}

// ── 영업종결 사유 통계 차트 ──
let chFailReason=null,chMonthlyContract=null;

async function loadFailReasonChart(){
  const{data}=await sb.from('prospects').select('fail_reason').eq('stage','영업종결').not('fail_reason','is',null);
  if(!data?.length){
    const el=document.getElementById('chartFailReason');
    if(el&&el.parentElement)el.parentElement.innerHTML='<div class="empty" style="padding:40px">영업종결 사유 데이터 없음</div>';
    return;
  }
  const counts={};
  (data||[]).forEach(r=>{const k=r.fail_reason||'기타';counts[k]=(counts[k]||0)+1;});
  const labels=Object.keys(counts);
  const vals=Object.values(counts);
  const COLORS=['#6366f1','#f59e0b','#ef4444','#8b5cf6','#10b981','#ec4899','#ee4e00'];
  const ctx=document.getElementById('chartFailReason')?.getContext('2d');
  if(!ctx)return;
  if(chFailReason)chFailReason.destroy();
  chFailReason=new Chart(ctx,{
    type:'doughnut',
    data:{labels,datasets:[{data:vals,backgroundColor:COLORS.slice(0,labels.length),borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'right',labels:{font:{size:12,family:"'Noto Sans KR',sans-serif"},boxWidth:13,padding:10}},
      tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw}건 (${Math.round(ctx.raw/vals.reduce((a,b)=>a+b,0)*100)}%)`}}}}
  });
}

async function loadMonthlyContractChart(){
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({label:`${d.getMonth()+1}월`,start:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,
      end:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(new Date(d.getFullYear(),d.getMonth()+1,0).getDate()).padStart(2,'0')}`});
  }
  const vals=await Promise.all(months.map(async m=>{
    const{count}=await sb.from('prospects').select('*',{count:'exact',head:true})
      .eq('stage','계약완료').gte('contracted_at',m.start+'T00:00:00').lte('contracted_at',m.end+'T23:59:59');
    return count||0;
  }));
  const ctx=document.getElementById('chartMonthlyContract')?.getContext('2d');
  if(!ctx)return;
  if(chMonthlyContract)chMonthlyContract.destroy();
  chMonthlyContract=new Chart(ctx,{
    type:'bar',
    data:{labels:months.map(m=>m.label),datasets:[{label:'계약 완료',data:vals,
      backgroundColor:'rgba(238,78,0,.8)',borderRadius:6,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{font:{size:12,family:"'Noto Sans KR',sans-serif"},color:'#9fa6bc'}},
              y:{beginAtZero:true,grid:{color:'#f0f2f8'},ticks:{font:{size:12,family:"'Noto Sans KR',sans-serif"},color:'#9fa6bc',stepSize:1}}}}
  });
}

// ── 목표 달성 시 카카오워크 알림 ──
async function checkGoalAchievement(){
  const n=new Date();const yr=n.getFullYear(),mo=n.getMonth()+1;
  const{data:goal}=await sb.from('goals').select('*').eq('year',yr).eq('month',mo).maybeSingle();
  if(!goal)return;
  const ms=`${yr}-${String(mo).padStart(2,'0')}-01`;
  const{data:cd}=await sb.from('calls').select('call_count').gte('date',ms);
  let tc=0;(cd||[]).forEach(r=>tc+=r.call_count||0);
  const prevAchieved=localStorage.getItem(`goal_achieved_${yr}_${mo}`);
  if(tc>=goal.target_calls&&prevAchieved!=='calls'){
    localStorage.setItem(`goal_achieved_${yr}_${mo}`,'calls');
    sendKakaoWorkNotify('announcement',{
      title:`🎯 ${mo}월 콜 목표 달성!`,
      content:`팀 전체 ${tc}콜 달성으로 이번 달 목표(${goal.target_calls}콜)를 달성했습니다! 🎉`,
      author_name:'MUYI CRM'
    });
  }
}

// ── 뱃지 시스템 ──
const BADGE_DEFS = {
  call_30:  { label:'30콜',   icon:'📞', color:'linear-gradient(135deg,#5e5ce6,#7c7ae8)', req:30,  type:'call', desc:'하루 30콜 달성!' },
  call_50:  { label:'50콜',   icon:'🔥', color:'linear-gradient(135deg,#ff9500,#ffb340)', req:50,  type:'call', desc:'하루 50콜 달성!' },
  call_70:  { label:'70콜',   icon:'⚡', color:'linear-gradient(135deg,#0a84ff,#40a9ff)', req:70,  type:'call', desc:'하루 70콜 달성!' },
  call_100: { label:'100콜',  icon:'👑', color:'linear-gradient(135deg,#ffd60a,#ff9f0a)', req:100, type:'call', desc:'하루 100콜 달성!' },
  time_30:  { label:'30분',   icon:'⏰', color:'linear-gradient(135deg,#34c759,#30d158)', req:30,  type:'time', desc:'누적 통화 30분!' },
  time_60:  { label:'60분',   icon:'💎', color:'linear-gradient(135deg,#5ac8fa,#30b0c7)', req:60,  type:'time', desc:'누적 통화 1시간!' },
  time_120: { label:'2시간',  icon:'🚀', color:'linear-gradient(135deg,#bf5af2,#9b59b6)', req:120, type:'time', desc:'누적 통화 2시간!' },
};

const _notifiedBadges = new Set();

async function renderBadges(callCount, callTime) {
  const today = td();
  document.getElementById('missionDateLbl').textContent = today;

  const { data: achieved } = await sb.from('daily_badges')
    .select('badge_type')
    .eq('user_id', AU.id)
    .eq('achieved_date', today);
  const achievedSet = new Set((achieved||[]).map(b => b.badge_type));

  const callRow = document.getElementById('callBadgeRow');
  const timeRow = document.getElementById('timeBadgeRow');
  if (!callRow || !timeRow) return;

  const callHtml = ['call_30','call_50','call_70','call_100'].map(key => {
    const def = BADGE_DEFS[key];
    const unlocked = achievedSet.has(key);
    const progress = Math.min(100, Math.round(callCount / def.req * 100));
    return renderBadgeItem(key, def, unlocked, progress, callCount);
  }).join('');
  const timeHtml = ['time_30','time_60','time_120'].map(key => {
    const def = BADGE_DEFS[key];
    const unlocked = achievedSet.has(key);
    const progress = Math.min(100, Math.round(callTime / def.req * 100));
    return renderBadgeItem(key, def, unlocked, progress, callTime);
  }).join('');

  if(callRow) callRow.innerHTML = callHtml;
  if(timeRow) timeRow.innerHTML = timeHtml;
  const adminCallRow=document.getElementById('adminCallBadgeRow');
  const adminTimeRow=document.getElementById('adminTimeBadgeRow');
  if(adminCallRow) adminCallRow.innerHTML = callHtml;
  if(adminTimeRow) adminTimeRow.innerHTML = timeHtml;
}

function renderBadgeItem(key, def, unlocked, progress, current) {
  const isNew = !_notifiedBadges.has(key) && unlocked;
  return `
  <div class="badge-item" title="${def.desc}">
    <div class="badge-icon-wrap">
      <div class="badge-circle ${unlocked?'unlocked':'locked'} ${isNew?'new-unlock':''}"
           style="${unlocked?`background:${def.color}`:''}">
        ${def.icon}
      </div>
      ${unlocked?`<div class="badge-check">✓</div>`:''}
    </div>
    <div class="badge-progress-bar">
      <div class="badge-progress-fill" style="width:${progress}%;background:${unlocked?'var(--green)':'var(--blue)'}"></div>
    </div>
    <div class="badge-label ${unlocked?'unlocked':''}">${def.label}</div>
  </div>`;
}

async function checkAndAwardBadges(callCount, callTime) {
  const today = td();
  const { data: existing } = await sb.from('daily_badges')
    .select('badge_type').eq('user_id', AU.id).eq('achieved_date', today);
  const existingSet = new Set((existing||[]).map(b => b.badge_type));

  const newBadges = [];

  for (const key of ['call_30','call_50','call_70','call_100']) {
    const def = BADGE_DEFS[key];
    if (callCount >= def.req && !existingSet.has(key)) {
      newBadges.push({ user_id: AU.id, badge_type: key, achieved_date: today });
    }
  }
  for (const key of ['time_30','time_60','time_120']) {
    const def = BADGE_DEFS[key];
    if (callTime >= def.req && !existingSet.has(key)) {
      newBadges.push({ user_id: AU.id, badge_type: key, achieved_date: today });
    }
  }

  if (newBadges.length > 0) {
    await sb.from('daily_badges').upsert(newBadges);
    for (const b of newBadges) {
      if (!_notifiedBadges.has(b.badge_type)) {
        _notifiedBadges.add(b.badge_type);
        const def = BADGE_DEFS[b.badge_type];
        showBadgeToast(def);
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }
  await renderBadges(callCount, callTime);
}

function showBadgeToast(def) {
  document.querySelectorAll('.badge-toast').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'badge-toast';
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);
    background:${def.color};color:#fff;padding:14px 24px;border-radius:50px;
    font-size:15px;font-weight:800;z-index:9999;
    box-shadow:0 8px 32px rgba(0,0,0,.2);
    display:flex;align-items:center;gap:10px;
    animation:badgeToastIn .4s cubic-bezier(.34,1.56,.64,1) forwards;
    white-space:nowrap;
  `;
  toast.innerHTML = `<span style="font-size:22px">${def.icon}</span> ${def.desc} <span style="opacity:.8;font-size:12px">+뱃지 획득!</span>`;

  if (!document.getElementById('badge-toast-style')) {
    const style = document.createElement('style');
    style.id = 'badge-toast-style';
    style.textContent = `
      @keyframes badgeToastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      @keyframes badgeToastOut{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(-20px)}}
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  launchMiniConfetti();
  setTimeout(() => {
    toast.style.animation = 'badgeToastOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── 계약완료 축하 애니메이션 ──
function launchConfetti(){
  const toast=document.getElementById('celebToast');
  if(toast){toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000);}
  const canvas=document.getElementById('confettiCanvas');
  if(!canvas)return;
  canvas.style.display='block';
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  const onResize=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
  window.addEventListener('resize',onResize,{once:true});
  const ctx=canvas.getContext('2d');
  const colors=['#1e10c7','#ee4e00','#10b981','#f59e0b','#8b5cf6','#ec4899'];
  const particles=Array.from({length:120},()=>({
    x:Math.random()*canvas.width,y:Math.random()*canvas.height-canvas.height,
    r:Math.random()*8+4,color:colors[Math.floor(Math.random()*colors.length)],
    vx:(Math.random()-0.5)*4,vy:Math.random()*4+2,
    rotation:Math.random()*360,rotV:(Math.random()-0.5)*6,
    shape:Math.random()>0.5?'rect':'circle'
  }));
  let frame=0;
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);
      ctx.fillStyle=p.color;
      if(p.shape==='circle'){ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();}
      else{ctx.fillRect(-p.r/2,-p.r*1.5,p.r,p.r*3);}
      ctx.restore();
      p.x+=p.vx;p.y+=p.vy;p.rotation+=p.rotV;
      if(p.y>canvas.height){p.y=-20;p.x=Math.random()*canvas.width;}
    });
    frame++;
    if(frame<150)requestAnimationFrame(draw);
    else{ctx.clearRect(0,0,canvas.width,canvas.height);canvas.style.display='none';}
  }
  draw();
}

// ── 미니 축포 ──
function launchMiniConfetti() {
  let canvas = document.getElementById('miniConfettiCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'miniConfettiCanvas';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;';
    document.body.appendChild(canvas);
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#ffd60a','#ff6b00','#0a84ff','#34c759','#bf5af2','#ff2d55'];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.75;

  const particles = Array.from({length:60}, () => ({
    x: cx + (Math.random()-0.5)*60,
    y: cy,
    vx: (Math.random()-0.5)*10,
    vy: -(Math.random()*12+4),
    r: Math.random()*5+3,
    color: colors[Math.floor(Math.random()*colors.length)],
    gravity: 0.35,
    rotation: Math.random()*360,
    rotV: (Math.random()-0.5)*8,
    alpha: 1,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rotation*Math.PI/180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r/2,-p.r,p.r,p.r*2.5);
      ctx.restore();
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotV;
      p.alpha -= 0.018;
    });
    frame++;
    if (frame < 80) requestAnimationFrame(draw);
    else { ctx.clearRect(0,0,canvas.width,canvas.height); }
  }
  draw();
}

// ── PWA 설치 ──
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredPrompt=e;
  document.getElementById('pwaInstallBtn')?.classList.add('show');
});
async function installPWA(){
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  const{outcome}=await deferredPrompt.userChoice;
  if(outcome==='accepted')document.getElementById('pwaInstallBtn')?.classList.remove('show');
  deferredPrompt=null;
}

// ── 전체 백업 ──
async function backupAllData(){
  if((PR?.role||'')!=='master'){alert('MASTER만 가능합니다.');return}
  showSpinner('전체 데이터 백업 중...');
  try{
    const[{data:prospects},{data:callLogs},{data:users}]=await Promise.all([
      sb.from('prospects').select('*').order('created_at'),
      sb.from('call_logs').select('*').order('called_at'),
      sb.from('users').select('id,name,role,email,created_at'),
    ]);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,'DB목록',XLSX.utils.json_to_sheet(prospects||[]));
    XLSX.utils.book_append_sheet(wb,'통화기록',XLSX.utils.json_to_sheet(callLogs||[]));
    XLSX.utils.book_append_sheet(wb,'사용자',XLSX.utils.json_to_sheet(users||[]));
    const dateStr=new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb,`MUYI_CRM_백업_${dateStr}.xlsx`);
  }finally{hideSpinner();}
}

function setupUploadBtn(){
  setTimeout(initPushBtn,600);
}

// ── 사이드바 캘린더 뱃지 ──
async function updateCalendarSidebarBadge() {
  const mgr = PR?.name||AU?.email;
  let q = sb.from('prospects').select('id',{count:'exact',head:true}).eq('next_contact_date', td());
  if (!isPriv()) q = q.eq('manager', mgr);
  const { count } = await q;
  const badge = document.getElementById('announceBadge');
  const calMenu = document.getElementById('miCalendar');
  if (calMenu && count > 0) {
    if (!calMenu.querySelector('.mi-badge')) {
      const b = document.createElement('span');
      b.className = 'mi-badge';
      b.id = 'calBadge';
      calMenu.appendChild(b);
    }
    const cb = document.getElementById('calBadge');
    if (cb) cb.textContent = count;
  }
}

// ── 주소 → 지역 통계 ──
async function loadRegionStats() {
  const { data } = await sb.from('prospects').select('address').not('address','is',null);
  const regionMap = {};
  (data||[]).forEach(r => {
    const addr = r.address||'';
    const match = addr.match(/([가-힣]+[구시군])/);
    if (match) {
      const region = match[1];
      regionMap[region] = (regionMap[region]||0)+1;
    }
  });
  return Object.entries(regionMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
}
