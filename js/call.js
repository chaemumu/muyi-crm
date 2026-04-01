// ── 통화 결과 버튼 선택 ──
function selectCallResult(result){
  document.getElementById('callResult').value=result;
  document.querySelectorAll('.call-result-btn').forEach(btn=>{
    btn.classList.remove('sel-success','sel-absent','sel-reject');
  });
  if(!result)return;
  const btn=document.querySelector(`.call-result-btn[data-result="${result}"]`);
  if(!btn)return;
  if(result==='통화성공')btn.classList.add('sel-success');
  else if(result==='부재중')btn.classList.add('sel-absent');
  else if(result==='거절')btn.classList.add('sel-reject');
}

// ── 통화 결과 → timeline 클래스 ──
function _tlClass(result){
  if(result==='통화성공')return'success';
  if(result==='부재중')return'absent';
  if(result==='거절')return'reject';
  return'default';
}
function _tlEmoji(result){
  if(result==='통화성공')return'✅';
  if(result==='부재중')return'📵';
  if(result==='거절')return'🚫';
  return'📝';
}

// ── 통화 기록 저장 ──
async function saveCallLog(){
  if(!curCrmId)return;
  const content=document.getElementById('callContent').value.trim();
  const result=document.getElementById('callResult').value;
  if(!result){setMsg('callLogMsg','통화 결과를 선택하세요.',false);return}
  if(!content){setMsg('callLogMsg','통화 내용을 입력하세요.',false);return}

  // 초기 등록 확인
  const{data:existing}=await sb.from('call_logs').select('id',{count:'exact',head:true}).eq('prospect_id',curCrmId);
  const isInitial=!existing||existing.length===0;

  const{error}=await sb.from('call_logs').insert([{
    prospect_id:curCrmId,manager_id:AU.id,manager_name:PR?.name||AU.email,
    content,result,is_initial:isInitial,called_at:new Date().toISOString()
  }]);
  if(error){setMsg('callLogMsg','오류: '+error.message,false);return}
  setMsg('callLogMsg','✓ 통화 기록 저장',true);
  document.getElementById('callContent').value='';
  selectCallResult('');
  await loadCallHistory(curCrmId);
}

// ── 통화 기록 불러오기 ──
async function loadCallHistory(id){
  const{data}=await sb.from('call_logs').select('*').eq('prospect_id',id).order('called_at',{ascending:false});
  const el=document.getElementById('callLogList');
  if(!data?.length){el.innerHTML='<div class="empty">통화 기록 없음</div>';return}
  const myId=AU?.id;
  el.innerHTML='<div class="crm-tl-list">'+data.map(c=>{
    const isInitial=c.is_initial===true||c.is_initial==='true';
    const canEdit=isPriv()||(c.manager_id===myId);
    const dt=new Date(c.called_at);
    const timeStr=`${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    const safeContent=(c.content||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const tc=_tlClass(c.result);
    return`<div class="crm-tl-item${isInitial?' call-log-initial':''}" id="cl-${c.id}">
      <div class="crm-tl-dot tl-${tc}">${_tlEmoji(c.result)}</div>
      <div class="crm-tl-body">
        <div class="crm-tl-header">
          <span class="crm-tl-badge tl-${tc}">${c.result||'-'}</span>
          <span class="crm-tl-time">${timeStr}</span>
          <span class="crm-tl-manager">${c.manager_name||'-'}</span>
        </div>
        <div class="crm-tl-content" id="cl-txt-${c.id}">${safeContent}</div>
        ${canEdit?`<div class="crm-tl-actions">
          <button class="crm-tl-edit-btn" onclick="startEditCallLog(${c.id},'${(c.content||'').replace(/'/g,'\\\'').replace(/\n/g,'\\n')}','${c.result||'기타'}')">수정</button>
          <button class="crm-tl-edit-btn del" onclick="deleteCallLog(${c.id})">삭제</button>
        </div>
        <div class="crm-tl-editing" id="cl-edit-${c.id}">
          <select class="fi" id="cl-result-${c.id}" style="margin-bottom:7px;font-size:13px">
            <option value="통화성공" ${c.result==='통화성공'?'selected':''}>통화성공</option>
            <option value="부재중" ${c.result==='부재중'?'selected':''}>부재중</option>
            <option value="거절" ${c.result==='거절'?'selected':''}>거절</option>
          </select>
          <textarea class="fi" id="cl-content-${c.id}" rows="3" style="margin-bottom:7px;resize:vertical;font-size:13px">${safeContent}</textarea>
          <div style="display:flex;gap:6px">
            <button class="btn-p btn-sm" onclick="saveEditCallLog(${c.id})">저장</button>
            <button class="btn-g btn-sm" onclick="cancelEditCallLog(${c.id})">취소</button>
          </div>
        </div>`:''}
      </div>
    </div>`;
  }).join('')+'</div>';
}

// ── 통화 기록 수정/삭제 ──
function startEditCallLog(id,content,result){
  const editDiv=document.getElementById(`cl-edit-${id}`);
  if(editDiv)editDiv.style.display='block';
}
function cancelEditCallLog(id){
  const editDiv=document.getElementById(`cl-edit-${id}`);
  if(editDiv)editDiv.style.display='none';
}
async function saveEditCallLog(id){
  const content=document.getElementById(`cl-content-${id}`)?.value.trim();
  const result=document.getElementById(`cl-result-${id}`)?.value;
  if(!content){alert('내용을 입력하세요.');return}
  const{error}=await sb.from('call_logs').update({content,result}).eq('id',id);
  if(error){alert('수정 실패: '+error.message);return}
  cancelEditCallLog(id);
  await loadCallHistory(curCrmId);
}
async function deleteCallLog(id){
  if(!confirm('통화 기록을 삭제하시겠습니까?'))return;
  const{error}=await sb.from('call_logs').delete().eq('id',id);
  if(!error)await loadCallHistory(curCrmId);
  else alert('삭제 실패: '+error.message);
}

// ── 템플릿 빠른 목록 ──
async function loadTemplateQuickList(){
  const{data}=await sb.from('call_templates').select('*').order('created_at',{ascending:false}).limit(5);
  const el=document.getElementById('templateQuickList');
  if(!data?.length){el.innerHTML='';return}
  el.innerHTML=`<div style="font-size:13px;color:#9fa6bc;margin-bottom:7px">📝 템플릿 빠른 선택</div>`+
    data.map(t=>`<div class="template-item" onclick="applyTemplate('${t.content.replace(/'/g,"\\'")}')">
      <div style="font-size:16px">📋</div>
      <div><div class="template-title">${t.title}</div><div class="template-preview">${t.content}</div></div>
    </div>`).join('');
}
function applyTemplate(content){document.getElementById('callContent').value=content}

// ── 콜 타이머 ──
let _timerInterval = null;
let _timerSeconds = 0;
let _timerRunning = false;

function initCallTimer() {
  // 통화 기록 모달에 타이머 UI 동적 추가
  const callContentEl = document.getElementById('callContent');
  if (!callContentEl) return;
  const wrap = callContentEl.closest('.form-group');
  if (!wrap || document.getElementById('callTimerWrap')) return;

  const timerHTML = `
  <div id="callTimerWrap" style="display:flex;align-items:center;gap:10px;margin-bottom:11px;background:var(--gray-50);border-radius:12px;padding:10px 14px;border:1px solid var(--border2)">
    <span style="font-size:13px;font-weight:700;color:var(--gray-600)">⏱ 콜 타이머</span>
    <div id="callTimerDisplay" style="font-size:20px;font-weight:900;color:var(--gray-950);letter-spacing:-1px;min-width:60px;font-variant-numeric:tabular-nums">0:00</div>
    <button class="btn-p btn-sm" id="callTimerBtn" onclick="toggleCallTimer()" style="padding:6px 14px;font-size:12px">▶ 시작</button>
    <button class="btn-g btn-sm" onclick="resetCallTimer()" style="padding:6px 12px;font-size:12px">↺</button>
  </div>`;

  wrap.insertAdjacentHTML('beforebegin', timerHTML);
}

function toggleCallTimer() {
  const btn = document.getElementById('callTimerBtn');
  if (_timerRunning) {
    clearInterval(_timerInterval);
    _timerRunning = false;
    if (btn) btn.innerHTML = '▶ 재개';
    // 통화시간 자동 입력
    const mins = Math.ceil(_timerSeconds / 60);
    const durEl = document.getElementById('callDuration');
    if (durEl && !durEl.value) durEl.value = mins;
  } else {
    _timerRunning = true;
    if (btn) btn.innerHTML = '⏸ 일시정지';
    _timerInterval = setInterval(() => {
      _timerSeconds++;
      const m = Math.floor(_timerSeconds/60);
      const s = _timerSeconds%60;
      const display = document.getElementById('callTimerDisplay');
      if (display) display.textContent = `${m}:${String(s).padStart(2,'0')}`;
    }, 1000);
  }
}

function resetCallTimer() {
  clearInterval(_timerInterval);
  _timerRunning = false;
  _timerSeconds = 0;
  const display = document.getElementById('callTimerDisplay');
  const btn = document.getElementById('callTimerBtn');
  if (display) display.textContent = '0:00';
  if (btn) btn.innerHTML = '▶ 시작';
}

// ── AI 통화 멘트 생성 ──
async function generateCallScript() {
  if (!curCrmData) return;
  const btn = document.getElementById('aiScriptBtn');
  if (btn) { btn.disabled=true; btn.textContent='생성 중...'; }
  try {
    const industry = curCrmData.industry || '음식점';
    const stage = curCrmData.stage || '가망';
    const name = curCrmData.business_name || '업체';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:400,
        messages:[{
          role:'user',
          content:`너는 B2B 영업 전문가야. 다음 정보를 바탕으로 전화 영업 멘트를 한국어로 작성해줘. 자연스럽고 부담 없는 첫 인사 → 서비스 소개 → 미팅/재연락 제안 순서로. 200자 이내.\n\n업체명: ${name}\n업종: ${industry}\n영업단계: ${stage}`
        }]
      })
    });
    const data = await res.json();
    const script = data.content?.[0]?.text || '생성 실패';
    const textarea = document.getElementById('callContent');
    if (textarea) textarea.value = script;
  } catch(e) {
    alert('AI 생성 실패: '+e.message);
  }
  if (btn) { btn.disabled=false; btn.textContent='🤖 AI 멘트'; }
}

// ── 통화결과 → 다음 연락 자동 추천 ──
function onCallResultChange(val) {
  const nextDateEl = document.getElementById('callNextDate');
  if (!nextDateEl || nextDateEl.value) return; // 이미 입력됐으면 변경 안함
  const d = new Date();
  if (val === '부재중') d.setDate(d.getDate()+1);
  else if (val === '통화성공') d.setDate(d.getDate()+3);
  else if (val === '거절') d.setDate(d.getDate()+14);
  else return;
  nextDateEl.value = d.toISOString().slice(0,10);
}
