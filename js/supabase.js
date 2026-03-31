const SB_URL="https://npkpxlbcwmwlxqauevyv.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3B4bGJjd213bHhxYXVldnl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjg2MTIsImV4cCI6MjA4OTkwNDYxMn0.t3n2RvYdJd1_1Ay44V3MW7p2GqJDiocqgrmt0qIov88";
const sb=window.supabase.createClient(SB_URL,SB_KEY);

let AU=null,PR=null,curPeriod='day',chCalls=null,chCRM=null,chUserAct=null;
let curCrmId=null,curCrmData=null,actChartMode='day';
let calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
let dashCalYear=new Date().getFullYear(),dashCalMonth=new Date().getMonth();
let excelRows=[];

const ANIMALS=['🐶','🐱','🐯','🐼','🐨','🦊','🐻','🦁','🐰','🐸','🐧','🦋','🐬','🦄','🐙','🦝','🐺','🦅','🦉','🐿'];
function getAnimal(str){let h=0;for(let c of(str||''))h=(h*31+c.charCodeAt(0))&0xffff;return ANIMALS[h%ANIMALS.length]}

const STAGES=[
  {key:'가망',     label:'가망',      icon:'🔵',cls:'sb-prospect',pipe:'stage-prospect'},
  {key:'컨택중',   label:'컨택중',    icon:'🟡',cls:'sb-contact', pipe:'stage-contact'},
  {key:'검토중',   label:'검토 중',   icon:'🟣',cls:'sb-review',  pipe:'stage-review'},
  {key:'미팅확정', label:'미팅 확정', icon:'🔶',cls:'sb-meeting', pipe:'stage-meeting'},
  {key:'계약완료', label:'계약 완료', icon:'🟢',cls:'sb-contract',pipe:'stage-contract'},
  {key:'영업종결', label:'영업 종결', icon:'🔴',cls:'sb-lost',    pipe:'stage-lost'},
];
const TIER_INFO={
  inactive:{chip:'tc-inactive',label:'INACTIVE',name:'접근 불가',desc:'퇴사/조치로 접근 차단',feats:[{ok:false,txt:'로그인 불가'},{ok:false,txt:'모든 기능 이용 불가'}]},
  user:{chip:'tc-user',label:'USER',name:'일반 사원',desc:'영업 활동 및 개인 실적 조회',feats:[{ok:true,txt:'대시보드 — 나의 실적'},{ok:true,txt:'가망 DB 등록 / 나의 DB목록'},{ok:true,txt:'파이프라인 / 통화기록'},{ok:true,txt:'다음 연락 예정일 관리'},{ok:true,txt:'중복 확인 / 이용 안내'},{ok:true,txt:'통화 멘트 템플릿 사용'},{ok:false,txt:'팀 활동 현황 열람'},{ok:false,txt:'공지사항 작성'},{ok:false,txt:'계정 생성 / 권한 변경'}]},
  admin:{chip:'tc-admin',label:'ADMIN',name:'관리자',desc:'팀 모니터링, 불가업체, 공지작성',feats:[{ok:true,txt:'팀 전체 대시보드'},{ok:true,txt:'팀 파이프라인 현황'},{ok:true,txt:'활동 기록 직접 입력'},{ok:true,txt:'⛔ 영업 불가 업체 관리'},{ok:true,txt:'📣 공지사항 작성/관리'},{ok:true,txt:'월별 목표 설정'},{ok:true,txt:'📝 템플릿 등록/관리'},{ok:false,txt:'계정 생성 / 권한 변경'}]},
  master:{chip:'tc-master',label:'MASTER',name:'최고 관리자',desc:'시스템 전체 관리',feats:[{ok:true,txt:'모든 ADMIN 권한 포함'},{ok:true,txt:'계정 생성 및 권한 변경'},{ok:true,txt:'INACTIVE 권한 부여'},{ok:true,txt:'전체 DB 조회/삭제'},{ok:true,txt:'담당자별 DB 이관'},{ok:true,txt:'비밀번호 재설정'}]},
};

// ════ SaaS 메뉴 구조 ════
const SIDEBAR_GROUPS={
  user:[
    {label:'WORKSPACE',items:[
      {id:'miDash',     page:'dash',     label:'대시보드', icon:'📊'},
      {id:'miCrm',      page:'crm',      label:'영업 DB',  icon:'📋'},
      {id:'miCalendar', page:'calendar', label:'캘린더',   icon:'📅'},
    ]},
    {label:'MANAGEMENT',items:[
      {id:'miAnnounce', page:'announce', label:'공지사항', icon:'📣'},
    ]},
    {label:'ACCOUNT',items:[
      {id:'miManual', page:'manual', label:'이용 안내', icon:'📖'},
      {id:'miMypage', page:'mypage', label:'내 정보',   icon:'👤'},
    ]}
  ],
  admin:[
    {label:'WORKSPACE',items:[
      {id:'miDash',     page:'dash',     label:'대시보드', icon:'📊'},
      {id:'miCrm',      page:'crm',      label:'영업 DB',  icon:'📋'},
      {id:'miCalendar', page:'calendar', label:'캘린더',   icon:'📅'},
    ]},
    {label:'MANAGEMENT',items:[
      {id:'miAnnounce', page:'announce', label:'공지사항', icon:'📣'},
      {id:'miAdmin',    page:'admin',    label:'Admin',    icon:'⚙️'},
    ]},
    {label:'ACCOUNT',items:[
      {id:'miManual', page:'manual', label:'이용 안내', icon:'📖'},
      {id:'miMypage', page:'mypage', label:'내 정보',   icon:'👤'},
    ]}
  ],
  master:[
    {label:'WORKSPACE',items:[
      {id:'miDash',     page:'dash',     label:'대시보드', icon:'📊'},
      {id:'miCrm',      page:'crm',      label:'영업 DB',  icon:'📋'},
      {id:'miCalendar', page:'calendar', label:'캘린더',   icon:'📅'},
    ]},
    {label:'MANAGEMENT',items:[
      {id:'miAnnounce', page:'announce', label:'공지사항', icon:'📣'},
      {id:'miAdmin',    page:'admin',    label:'Admin',    icon:'⚙️'},
    ]},
    {label:'MASTER',items:[
      {id:'miMaster', page:'master', label:'Master Console', icon:'🛡️'},
    ]},
    {label:'ACCOUNT',items:[
      {id:'miManual', page:'manual', label:'이용 안내', icon:'📖'},
      {id:'miMypage', page:'mypage', label:'내 정보',   icon:'👤'},
    ]}
  ]
};

function renderSidebar(role){
  const nav=document.querySelector('.sb-nav');
  if(!nav)return;
  role=(role||'user').toLowerCase();
  nav.innerHTML='';
  const groups=SIDEBAR_GROUPS[role]||SIDEBAR_GROUPS.user;
  groups.forEach(group=>{
    const sec=document.createElement('div');
    sec.className='nav-sec';
    sec.textContent=group.label;
    nav.appendChild(sec);
    group.items.forEach(m=>{
      const div=document.createElement('div');
      div.id=m.id;
      div.className='mi';
      div.onclick=()=>{
        if(m.masterPanel){
          goPage('admin');
          return;
        }
        goPage(m.page);
      };
      div.innerHTML=`<span class="mi-ic">${m.icon}</span>${m.label}`;
      nav.appendChild(div);
    });
  });
}

// ════ Debounce 유틸리티 ════
function debounce(fn,delay){
  let timeoutId;
  return function(...args){
    clearTimeout(timeoutId);
    timeoutId=setTimeout(()=>fn(...args),delay);
  };
}

// ════ 네이버 URL 파싱 + 자동 입력 ════
const NAVER_CATEGORIES={
  '한식':'음식점',
  '중식':'음식점',
  '일식':'음식점',
  '양식':'음식점',
  '카페':'음식점',
  '편의점':'편의점',
  '마트':'마트',
  '병원':'병원',
  '약국':'약국',
  '미용실':'미용실',
  '학원':'학원',
  '헬스':'헬스장',
  '호텔':'숙박',
  '모텔':'숙박',
  '펜션':'숙박',
  '불동산':'부동산',
  '은행':'금융',
  '보험':'금융'
};

function parseNaverUrl(url){
  const el=document.getElementById('naverParseStatus');
  url=url.trim();
  if(!url){if(el)el.textContent='';return}

  // URL 검증
  if(!url.includes('naver')&&!url.includes('map')){
    if(el){el.textContent='⚠️ 네이버 지도 URL이 아닙니다.';el.style.color='var(--red)';}
    return;
  }

  try{
    // placeId 추출
    const placeMatch=url.match(/place[\/=](\d+)/);
    if(placeMatch){
      const placeId=placeMatch[1];

      // 쿼리 파라미터 추출
      const urlObj=new URL(url);
      let query=urlObj.searchParams.get('query')||urlObj.searchParams.get('keyword')||urlObj.searchParams.get('search');

      if(!query){
        const m=url.match(/[?&](?:query|keyword|search)=([^&]+)/);
        query=m?decodeURIComponent(m[1]):null;
      }

      if(query){
        const rName=document.getElementById('rName');
        if(rName&&!rName.value.trim())rName.value=query;

        // 카테고리 자동 입력
        const rInd=document.getElementById('rIndustry');
        if(rInd&&!rInd.value.trim()){
          for(const[key,val] of Object.entries(NAVER_CATEGORIES)){
            if(query.includes(key)){rInd.value=val;break;}
          }
        }
      }

      if(el){el.textContent='✓ 유효한 네이버 지도 URL입니다.';el.style.color='var(--green)';}
    } else {
      if(el){el.textContent='✓ URL 등록됨 (업체명/카테고리는 직접 입력)';el.style.color='var(--blue)';}
    }
  }catch(err){
    if(el){el.textContent='⚠️ URL 파싱 오류';el.style.color='var(--red)';}
  }
}

function initNaverUrlParsing(){
  const input=document.getElementById('rNaverUrl');
  if(input)input.addEventListener('input',debounce((e)=>parseNaverUrl(e.target.value),400));
}

const td=()=>new Date().toISOString().slice(0,10);
const isPriv=()=>['master','admin'].includes((PR?.role||'').toLowerCase());
function periodRange(p){
  const n=new Date();
  if(p==='week'){const d=new Date(n),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return{start:d.toISOString().slice(0,10),end:td()}}
  if(p==='month'){return{start:n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-01',end:td()}}
  return{start:td(),end:td()}
}
function last7(){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10)})}
function fmtPhone(raw){const n=raw.replace(/\D/g,'');if(n.length<=3)return n;if(n.length<=7)return n.slice(0,3)+'-'+n.slice(3);return n.slice(0,3)+'-'+n.slice(3,7)+'-'+n.slice(7,11)}
function maskPhone(p){if(!p)return'-';return p.replace(/(\d{3})-(\d{2})(\d{2})-(\d{2})(\d{2})/,'$1-$2**-$4**')}
function fmtDt(s){if(!s)return'-';const d=new Date(s);return d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
function fmtDate(s){return s?(s+'').slice(0,10):'-'}
function rlLbl(r){return({master:'MASTER',admin:'관리자',user:'사원',junior:'신입사원',inactive:'비활성'})[r]||(r||'USER').toUpperCase()}
function rlCls(r){return({master:'b-master',admin:'b-admin',user:'b-user',inactive:'b-inactive'})[r]||'b-user'}
function stBadge(s){if(s==='계약중')return`<span class="st-contract">⛔ 계약중</span>`;return`<span class="st-prospect">◉ 가망</span>`}
function stageBadge(s){const st=STAGES.find(x=>x.key===s)||STAGES[0];return`<span class="badge ${st.cls}">${st.icon} ${st.label}</span>`}
function setMsg(id,txt,ok){const el=document.getElementById(id);if(!el)return;el.textContent=txt;el.className=ok?'s-ok':'s-err';if(ok)setTimeout(()=>{el.textContent='-';el.className='stmsg'},3500)}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('mobOverlay').classList.add('show')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('mobOverlay').classList.remove('show')}

// 다크모드
function _syncDarkBtn(isDark){
  const btn=document.getElementById('darkModeBtn');
  const lbl=document.getElementById('darkModeLabel');
  if(!btn)return;
  if(isDark){
    btn.style.background='rgba(255,255,255,.07)';
    btn.style.borderColor='rgba(255,255,255,.2)';
    btn.style.color='#e5e7eb';
    btn.firstChild.textContent='☀️ ';
    if(lbl)lbl.textContent='라이트모드';
  }else{
    btn.style.background='none';
    btn.style.borderColor='';
    btn.style.color='';
    btn.firstChild.textContent='🌙 ';
    if(lbl)lbl.textContent='다크모드';
  }
}
function _syncLogo(isDark){
  const logo=document.getElementById('topLogo');
  if(!logo)return;
  if(isDark){
    logo.style.display='none';
  }else{
    logo.style.display='';
    logo.style.filter='brightness(0) saturate(100%) invert(24%) sepia(94%) saturate(1338%) hue-rotate(240deg)';
  }
}
function toggleDark(){
  document.body.classList.toggle('dark');
  const isDark=document.body.classList.contains('dark');
  _syncDarkBtn(isDark);
  _syncLogo(isDark);
  if(AU)sb.from('user_settings').upsert([{user_id:AU.id,dark_mode:isDark}]).then(()=>{});
}
async function loadDarkMode(){
  if(!AU)return;
  const{data}=await sb.from('user_settings').select('dark_mode').eq('user_id',AU.id).maybeSingle();
  if(data?.dark_mode)document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  const isDark=document.body.classList.contains('dark');
  _syncDarkBtn(isDark);
  _syncLogo(isDark);
}

// ── 토스트 알림 ──
function showToast(msg, type='info', duration=3500){
  // 기존 토스트 제거
  let existing=document.getElementById('globalToast');
  if(existing)existing.remove();

  const colors={
    info:{bg:'linear-gradient(135deg,#0a84ff,#5856d6)',icon:'ℹ️'},
    success:{bg:'linear-gradient(135deg,#22c55e,#16a34a)',icon:'✅'},
    warning:{bg:'linear-gradient(135deg,#f97316,#ef4444)',icon:'⚠️'},
    error:{bg:'linear-gradient(135deg,#ef4444,#dc2626)',icon:'❌'},
  };
  const c=colors[type]||colors.info;

  const el=document.createElement('div');
  el.id='globalToast';
  el.style.cssText=`position:fixed;top:20px;right:20px;z-index:99999;background:${c.bg};color:#fff;padding:14px 20px;border-radius:14px;font-size:14px;font-weight:700;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,.3);display:flex;align-items:center;gap:10px;animation:toastIn .3s ease`;
  el.innerHTML=`<span style="font-size:20px">${c.icon}</span><div style="line-height:1.4">${msg}</div><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:4px">✕</button>`;
  document.body.appendChild(el);

  if(!document.getElementById('toast-anim')){
    const style=document.createElement('style');
    style.id='toast-anim';
    style.textContent='@keyframes toastIn{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(style);
  }
  setTimeout(()=>{if(el.parentElement)el.style.animation='toastIn .3s ease reverse';setTimeout(()=>el.remove(),300);},duration);
}

function showSpinner(msg='잠시만 기다려주세요...'){
  const el=document.getElementById('spinnerOverlay');
  const tx=document.getElementById('spinnerText');
  if(el){el.classList.add('show');}
  if(tx)tx.textContent=msg;
}
function hideSpinner(){
  const el=document.getElementById('spinnerOverlay');
  if(el)el.classList.remove('show');
}

// ── 업종 자동완성 함수 ──
const INDUSTRY_KEYWORDS=['음식점','카페','치킨','피자','분식','중국집','일식','한식','패스트푸드','술집/주점','편의점','마트','슈퍼마켓','옷가게/의류','미용실/헤어','헬스장','병원/의원','약국','세탁소','학원','어린이집','노래방','PC방','스터디카페','사무용품','인테리어','전자제품','자동차','부동산','여행사','은행/금융','보험','제조업','건설업','물류','도소매','교육','IT/소프트웨어','기타'];
function onIndustryInput(val,listId){
  const list=document.getElementById(listId);if(!list)return;
  const v=(val||'').trim();
  const filtered=v?INDUSTRY_KEYWORDS.filter(i=>i.toLowerCase().includes(v.toLowerCase())):INDUSTRY_KEYWORDS.slice(0,15);
  if(!filtered.length){list.style.display='none';return;}
  list.innerHTML=filtered.map(i=>`<div class="autocomplete-item" onclick="selectIndustryItem('${i}',this)">${v?i.replace(new RegExp(v,'gi'),m=>`<strong>${m}</strong>`):i}</div>`).join('');
  list.style.display='block';
}
function selectIndustryItem(val,el){
  const list=el.closest('.autocomplete-list');
  if(!list)return;
  const wrap=list.previousElementSibling||list.parentElement?.querySelector('input.fi');
  const inp=list.previousElementSibling?.tagName==='INPUT'?list.previousElementSibling:list.parentElement?.querySelector('input.fi');
  if(inp){inp.value=val;inp.dispatchEvent(new Event('change'));}
  list.style.display='none';
}
document.addEventListener('click',function(e){
  if(!e.target.closest('.autocomplete-wrap')&&!e.target.closest('[id$="IndustryList"]')){
    document.querySelectorAll('[id$="IndustryList"]').forEach(l=>l.style.display='none');
  }
});

async function handleEmailConfirmation(){
  const params=new URLSearchParams(window.location.search);
  const tokenHash=params.get('token_hash'),urlType=params.get('type');
  if(tokenHash&&(urlType==='email'||urlType==='signup')){
    window.history.replaceState({},document.title,window.location.pathname);
    await sb.auth.verifyOtp({token_hash:tokenHash,type:urlType});
    document.getElementById('confirmBanner').style.display='block';return;
  }
  if(window.location.hash.includes('access_token')){
    window.history.replaceState({},document.title,window.location.pathname);
    document.getElementById('confirmBanner').style.display='block';
  }
}

async function doLogin(){
  const email=document.getElementById('email').value.trim();
  const pw=document.getElementById('password').value; // trim 미적용 - 공백 포함 비밀번호 허용
  const errEl=document.getElementById('loginErr');errEl.textContent='';
  if(!email||!pw){errEl.textContent='이메일과 비밀번호를 입력하세요.';return}
  // 한글 포함 여부 체크 - 한글은 비밀번호로 사용 불가
  if(/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(pw)){
    errEl.textContent='비밀번호에 한글이 포함되어 있습니다. 영문/숫자로 입력해 주세요.';return;
  }
  // 로딩 상태
  const btn=document.getElementById('loginBtn');
  const btnText=document.getElementById('loginBtnText');
  const spinner=document.getElementById('loginSpinner');
  if(btn)btn.classList.add('loading');
  if(btnText)btnText.textContent='로그인 중...';
  if(spinner)spinner.style.display='inline-block';
  let loginData=null;
  try{
    const{data,error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error){
      errEl.textContent='로그인 실패: '+(error.message==='Invalid login credentials'?'이메일 또는 비밀번호가 올바르지 않습니다.':error.message);
      if(btn)btn.classList.remove('loading');
      if(btnText)btnText.textContent='로그인';
      if(spinner)spinner.style.display='none';
      return;
    }
    loginData=data;
  }catch(e){
    // 실제 네트워크/서버 오류만 여기서 처리
    console.error('Login network error:',e);
    errEl.textContent='서버 연결 오류. 잠시 후 다시 시도해 주세요.';
    if(btn)btn.classList.remove('loading');
    if(btnText)btnText.textContent='로그인';
    if(spinner)spinner.style.display='none';
    return;
  }
  // 로그인 성공 - bootApp은 별도 try/catch
  try{
    AU=loginData.user;
    await fetchProfile();
    await loadDarkMode();
    bootApp();
  }catch(bootErr){
    console.error('Boot error:',bootErr);
    // bootApp 에러는 무시하고 계속 진행 (이미 로그인은 됨)
    AU=loginData.user;
    try{document.getElementById('loginWrap').style.display='none';}catch(e){}
    try{document.getElementById('app').style.display='block';}catch(e){}
    goPage('dash');
  }
}
async function fetchProfile(){const{data}=await sb.from('users').select('*').eq('id',AU.id).maybeSingle();PR=data}
function bootApp(){
  const role=(PR?.role||'user').toLowerCase();
  if(role==='inactive'){sb.auth.signOut();AU=null;PR=null;document.getElementById('loginErr').textContent='⛔ 접근 권한이 없습니다. MASTER에게 문의하세요.';return}
  document.getElementById('loginWrap').style.display='none';
  document.getElementById('app').style.display='block';
  const name=PR?.name||AU.email.split('@')[0];
  const _s=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  _s('uName',name);
  _s('uAv',PR?.animal_emoji||getAnimal(name));
  _s('uRole',rlLbl(role));
  _s('greeting',`안녕하세요, ${name}님 👋`);

  // ✅ 동적 사이드바 렌더링 (권한 기반)
  renderSidebar(role);

  // 엑셀 업로드 버튼 권한
  const excelBtn=document.getElementById('excelUploadBtn');
  if(excelBtn&&['master','admin'].includes(role))excelBtn.style.display='flex';
  loadAnnounceBadge();goPage('dash');
  setTimeout(checkMustChangePw,500);
  setTimeout(checkContractExpiring,3000);
  setTimeout(()=>{if(typeof initPushBtn==='function')initPushBtn();},800);
  setTimeout(()=>{if(typeof updateCalendarSidebarBadge==='function')updateCalendarSidebarBadge();},1000);
  setupSessionRefresh();
}
async function doLogout(){
  if(!confirm('로그아웃 하시겠습니까?'))return;
  await sb.auth.signOut();AU=null;PR=null;
  document.getElementById('app').style.display='none';
  document.getElementById('loginWrap').style.display='flex';
  ['email','password'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('loginErr').textContent='';
  document.getElementById('confirmBanner').style.display='none';
  closeSidebar();
}

// ── NAV ──
// ════ 라우트 권한 정의 ════
const PAGE_ACCESS={
  dash:['user','admin','master'],
  crm:['user','admin','master'],
  calendar:['user','admin','master'],
  manual:['user','admin','master'],
  mypage:['user','admin','master'],
  announce:['user','admin','master'],
  admin:['admin','master'],
  master:['master']
};

function goPage(page){
  const role=(PR?.role||'user').toLowerCase();

  // 라우트 보호: 권한 없는 페이지 접근 차단
  const allowed=PAGE_ACCESS[page];
  if(allowed&&!allowed.includes(role)){
    goPage('dash');
    return;
  }

  ['dash','crm','calendar','announce','manual','admin','master','mypage'].forEach(p=>{
    const pg=document.getElementById('pg'+cap(p));if(pg)pg.classList.toggle('active',p===page);
    const m=document.getElementById('mi'+cap(p));if(m)m.classList.toggle('active',p===page);
  });
  // master role: miMaster active on 'master' page, miAdmin active on 'admin' page
  const isMaster=(PR?.role||'').toLowerCase()==='master';
  const miMaster=document.getElementById('miMaster');
  const miAdmin=document.getElementById('miAdmin');
  if(isMaster&&page==='master'){
    if(miMaster)miMaster.classList.add('active');
    if(miAdmin)miAdmin.classList.remove('active');
  }
  closeSidebar();
  if(page==='dash')     loadDash();
  if(page==='admin')    setupAdminPage();
  if(page==='master')   setupMasterPage();
  if(page==='announce') loadAnnouncements();
  if(page==='manual')   loadManual();
  if(page==='calendar') renderCalendar();
  if(page==='crm')      {loadPipeline();loadBlockedInCheckTab();setTimeout(initRegForm,100);}
  if(page==='mypage')   loadMypage();
}

// ── 세션 만료 감지 + 자동 갱신 ──
function setupSessionRefresh(){
  // 50분마다 세션 갱신 (Supabase 기본 1시간)
  setInterval(async()=>{
    const{data,error}=await sb.auth.refreshSession();
    if(error){
      document.getElementById('sessionExpiredBar').classList.add('show');
    }
  }, 50*60*1000);
  // 탭 전환 시 세션 체크
  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState==='visible'){
      const{data}=await sb.auth.getSession();
      if(!data?.session&&AU){
        document.getElementById('sessionExpiredBar').classList.add('show');
      }
    }
  });
}

// ── 강제 비밀번호 변경 ──
async function checkMustChangePw(){
  if(!PR)return;
  if(PR.must_change_password){
    document.getElementById('forcePwChangeModal').style.display='flex';
  }
}
async function doForcePwChange(){
  const pw=document.getElementById('forceNewPw').value.trim();
  const pw2=document.getElementById('forceNewPwConfirm').value.trim();
  if(pw.length<8){setMsg('forcePwMsg','비밀번호는 8자 이상이어야 합니다.',false);return}
  if(pw!==pw2){setMsg('forcePwMsg','비밀번호가 일치하지 않습니다.',false);return}
  const{error}=await sb.auth.updateUser({password:pw});
  if(error){setMsg('forcePwMsg','오류: '+error.message,false);return}
  await sb.from('users').update({must_change_password:false}).eq('id',AU.id);
  PR.must_change_password=false;
  document.getElementById('forcePwChangeModal').style.display='none';
  alert('✅ 비밀번호가 성공적으로 변경되었습니다!');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded',async()=>{
  // 로그인 버튼 먼저 등록 (최우선)
  const loginBtnEl=document.getElementById('loginBtn');
  const passwordEl=document.getElementById('password');
  if(loginBtnEl)loginBtnEl.addEventListener('click',doLogin);
  if(passwordEl)passwordEl.addEventListener('keydown',e=>{
    // isComposing: 한글 IME 조합 중이면 무시
    if(e.key==='Enter'&&!e.isComposing&&!e.nativeEvent?.isComposing)doLogin();
  });

  // 나머지 초기화 (에러 발생해도 로그인은 동작)
  try{
    const n=new Date();
    const ds=document.getElementById('dateStr');if(ds)ds.textContent=n.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
    const adl=document.getElementById('actDateLbl');if(adl)adl.textContent=td();
    const gy=document.getElementById('goalYear');if(gy)gy.value=n.getFullYear();
    const gm=document.getElementById('goalMonth');if(gm)gm.value=n.getMonth()+1;
    const yr=n.getFullYear();
    const yrSel=document.getElementById('actChartYear');
    if(yrSel)for(let y=yr;y>=yr-2;y--){const o=document.createElement('option');o.value=y;o.textContent=y+'년';yrSel.appendChild(o)}
    const moSel=document.getElementById('actChartMonth2');
    if(moSel)for(let m=1;m<=12;m++){const o=document.createElement('option');o.value=m;o.textContent=m+'월';o.selected=(m===n.getMonth()+1);moSel.appendChild(o)}
    const rPhone=document.getElementById('rPhone');
    if(rPhone)rPhone.addEventListener('input',function(){
      const pos=this.selectionStart,old=this.value.length;
      this.value=fmtPhone(this.value);
      const diff=this.value.length-old;
      try{this.setSelectionRange(pos+diff,pos+diff)}catch(e){}
    });
  }catch(initErr){console.warn('Init warning:',initErr);}

  try{await handleEmailConfirmation();}catch(e){}
  // 세션 자동 복구 - 단, 로그인 페이지가 표시 중인 경우에만 (이중 로그인 방지)
  try{
    const{data}=await sb.auth.getSession();
    if(data?.session?.user){
      // 이미 앱이 표시 중이면 스킵 (중복 로그인 방지)
      const appVisible=document.getElementById('app')?.style.display==='block';
      if(!appVisible){
        AU=data.session.user;
        await fetchProfile();
        await loadDarkMode();
        bootApp();
      }
    }
  }catch(e){console.warn('Session check error:',e);}
});
