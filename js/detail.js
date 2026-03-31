// ── CRM 모달 열기 ──
async function openCrmModal(id){
  curCrmId=id;
  const{data}=await sb.from('prospects').select('*').eq('id',id).maybeSingle();
  if(!data)return;curCrmData=data;

  // 헤더
  document.getElementById('crmModalTitle').textContent=data.business_name||'-';
  document.getElementById('crmModalSub').innerHTML=`${stageBadge(data.stage||'가망')} &nbsp;담당: ${data.manager||'-'}`;

  // 좌측 정보 뷰 채우기
  document.getElementById('ivName').textContent=data.business_name||'-';
  document.getElementById('ivIndustry').textContent=data.industry||'-';
  document.getElementById('ivManager').textContent=data.manager||'-';
  document.getElementById('ivAddress').textContent=data.address||'-';
  document.getElementById('ivPhone').textContent=maskPhone(data.phone);
  document.getElementById('ivSubPhone').textContent=data.sub_phone||'-';
  document.getElementById('ivFeature').textContent=data.feature||data.memo||'-';
  const urlEl=document.getElementById('ivUrl'),urlEmptyEl=document.getElementById('ivUrlEmpty');
  if(data.naver_url){
    urlEl.href=data.naver_url;
    // 표시 텍스트: 도메인+경로 요약 (너무 길면 앞 50자)
    try{const u=new URL(data.naver_url);urlEl.textContent=u.hostname+(u.pathname.length>1?u.pathname:'');}
    catch(e){urlEl.textContent=data.naver_url.length>50?data.naver_url.slice(0,50)+'…':data.naver_url;}
    urlEl.style.display='block';urlEmptyEl.style.display='none';
  }else{urlEl.style.display='none';urlEmptyEl.style.display='block';}

  // 다음 연락 예정일
  document.getElementById('ivNextContact').textContent=data.next_contact_date||'미설정';

  // 단계 버튼 그룹
  const stageList=[
    {key:'가망',label:'🔵 가망',cls:'sb-prospect'},
    {key:'컨택중',label:'🟡 컨택중',cls:'sb-contact'},
    {key:'미팅확정',label:'🔷 미팅확정',cls:'sb-meeting'},
    {key:'검토중',label:'🟣 검토중',cls:'sb-review'},
    {key:'계약완료',label:'🟢 계약완료',cls:'sb-contract'},
    {key:'영업종결',label:'🔴 영업종결',cls:'sb-lost'}
  ];
  document.getElementById('ivStage').innerHTML=stageList.map(s=>
    `<button class="stage-sel-btn badge ${s.cls}${s.key===data.stage?' active-stage':''}" onclick="quickChangeStage('${s.key}')">${s.label}</button>`
  ).join('');

  // 수정 폼 초기화
  toggleEditForm(false);
  document.getElementById('editName').value=data.business_name||'';
  document.getElementById('editPhone').value=data.phone||'';
  document.getElementById('editSubPhone').value=data.sub_phone||'';
  document.getElementById('editAddress').value=data.address||'';
  document.getElementById('editNaverUrl').value=data.naver_url||'';
  document.getElementById('editIndustry').value=data.industry||'';
  document.getElementById('editFeature').value=data.feature||data.memo||'';
  document.getElementById('editStage').value=data.stage||'가망';
  document.getElementById('editStatus').value=data.status||'가망';
  document.getElementById('editFailReason').value=data.fail_reason||'';
  const cs=document.getElementById('contractSection');
  if(cs){const isC=data.stage==='계약완료';cs.style.display=isC?'block':'none';
    if(isC){document.getElementById('contractEndDate').value=data.contract_end_date||'';
      document.getElementById('contractItems').value=data.contract_items||'';
      document.getElementById('contractStatus').value=data.contract_status||'active';}}

  // 권한
  const canEdit=isPriv()||(data.manager===(PR?.name||''));
  const editToggle=document.getElementById('editToggleBtn');
  if(editToggle)editToggle.style.display=canEdit?'inline-flex':'none';
  document.getElementById('modalDeleteBtn').style.display=((PR?.role||'')==='master')?'block':'none';


  // 통화 입력 초기화
  selectCallResult('');
  document.getElementById('callContent').value='';

  await loadCallHistory(id);
  if(typeof updateModalNav==='function')updateModalNav(id);
  document.getElementById('crmModal').style.display='flex';
}
function closeCrmModal(){document.getElementById('crmModal').style.display='none';curCrmId=null;curCrmData=null;}

// ── 수정 폼 토글 ──
function toggleEditForm(show){
  document.getElementById('crmInfoView').style.display=show?'none':'block';
  document.getElementById('crmEditForm').style.display=show?'block':'none';
  const btn=document.getElementById('editToggleBtn');
  if(btn)btn.textContent=show?'✕ 취소':'✏️ 정보 수정';
  if(show&&curCrmData){
    document.getElementById('editName').value=curCrmData.business_name||'';
    document.getElementById('editPhone').value=curCrmData.phone||'';
    document.getElementById('editSubPhone').value=curCrmData.sub_phone||'';
    document.getElementById('editAddress').value=curCrmData.address||'';
    document.getElementById('editNaverUrl').value=curCrmData.naver_url||'';
    document.getElementById('editIndustry').value=curCrmData.industry||'';
    document.getElementById('editFeature').value=curCrmData.feature||curCrmData.memo||'';
    document.getElementById('editStage').value=curCrmData.stage||'가망';
    document.getElementById('editStatus').value=curCrmData.status||'가망';
    document.getElementById('editFailReason').value=curCrmData.fail_reason||'';
    const cs=document.getElementById('contractSection');
    if(cs){const isC=curCrmData.stage==='계약완료';cs.style.display=isC?'block':'none';}
  }
}

// ── CRM 수정 저장 ──
async function saveCrmEdit(){
  const name=document.getElementById('editName').value.trim(),phone=document.getElementById('editPhone').value.trim();
  if(!name||!phone){setMsg('editMsg','업체명과 전화번호는 필수.',false);return}
  const stageVal=document.getElementById('editStage').value;
  const oldStage=curCrmData?.stage;
  const newFeature=document.getElementById('editFeature').value.trim();
  const payload={
    business_name:name,phone,
    address:document.getElementById('editAddress').value.trim()||null,
    naver_url:document.getElementById('editNaverUrl').value.trim()||null,
    industry:document.getElementById('editIndustry').value.trim()||null,
    sub_phone:document.getElementById('editSubPhone').value.trim()||null,
    feature:newFeature||null,
    memo:newFeature||null,
    stage:stageVal,
    status:document.getElementById('editStatus').value,
    fail_reason:document.getElementById('editFailReason').value||null,
    contract_end_date:document.getElementById('contractEndDate')?.value||null,
    contract_items:document.getElementById('contractItems')?.value.trim()||null,
    contract_status:document.getElementById('contractStatus')?.value||null
  };
  if(stageVal==='계약완료'&&oldStage!=='계약완료')payload.contracted_at=new Date().toISOString();
  const{error}=await sb.from('prospects').update(payload).eq('id',curCrmId);
  if(error){setMsg('editMsg','오류: '+error.message,false);return}
  setMsg('editMsg','✓ 저장되었습니다.',true);
  curCrmData={...curCrmData,...payload};
  // 정보 뷰 갱신
  document.getElementById('crmModalTitle').textContent=name;
  document.getElementById('crmModalSub').innerHTML=`${stageBadge(stageVal)} &nbsp;담당: ${curCrmData.manager||'-'}`;
  document.getElementById('ivName').textContent=name;
  document.getElementById('ivPhone').textContent=maskPhone(phone);
  document.getElementById('ivSubPhone').textContent=payload.sub_phone||'-';
  document.getElementById('ivAddress').textContent=payload.address||'-';
  document.getElementById('ivIndustry').textContent=payload.industry||'-';
  document.getElementById('ivFeature').textContent=newFeature||'-';
  const urlEl=document.getElementById('ivUrl'),urlEmptyEl=document.getElementById('ivUrlEmpty');
  if(payload.naver_url){
    urlEl.href=payload.naver_url;
    try{const u=new URL(payload.naver_url);urlEl.textContent=u.hostname+(u.pathname.length>1?u.pathname:'');}
    catch(e){urlEl.textContent=payload.naver_url.length>50?payload.naver_url.slice(0,50)+'…':payload.naver_url;}
    urlEl.style.display='block';urlEmptyEl.style.display='none';
  }else{urlEl.style.display='none';urlEmptyEl.style.display='block';}
  // 단계 버튼 갱신
  const stageList=[
    {key:'가망',label:'🔵 가망',cls:'sb-prospect'},{key:'컨택중',label:'🟡 컨택중',cls:'sb-contact'},
    {key:'미팅확정',label:'🔷 미팅확정',cls:'sb-meeting'},{key:'검토중',label:'🟣 검토중',cls:'sb-review'},
    {key:'계약완료',label:'🟢 계약완료',cls:'sb-contract'},{key:'영업종결',label:'🔴 영업종결',cls:'sb-lost'}
  ];
  document.getElementById('ivStage').innerHTML=stageList.map(s=>
    `<button class="stage-sel-btn badge ${s.cls}${s.key===stageVal?' active-stage':''}" onclick="quickChangeStage('${s.key}')">${s.label}</button>`
  ).join('');
  if(stageVal==='계약완료'&&oldStage!=='계약완료'&&typeof launchConfetti==='function')launchConfetti();
  toggleEditForm(false);loadPipeline();
}

// ── CRM 삭제 ──
async function deleteCrmFromModal(){
  if(!confirm('삭제하시겠습니까?'))return;
  const{error}=await sb.from('prospects').delete().eq('id',curCrmId);
  if(!error){closeCrmModal();loadPipeline();}else alert('삭제 실패: '+error.message);
}

// ── 다음 연락 예정일 n일 버튼 ──
async function setNextContactDay(n){
  if(!curCrmId)return;
  const d=new Date();d.setDate(d.getDate()+n);
  const dateStr=d.toISOString().slice(0,10);
  const{error}=await sb.from('prospects').update({next_contact_date:dateStr}).eq('id',curCrmId);
  if(error){showToast('저장 실패','error');return;}
  if(curCrmData)curCrmData.next_contact_date=dateStr;
  const el=document.getElementById('ivNextContact');
  if(el)el.textContent=dateStr;
  showToast(`다음 연락일: ${dateStr}`,'success');
}

// ── 통화 후 다음 연락 빠른 설정 ──
function setNextContactQuick(days){
  const d=new Date();d.setDate(d.getDate()+days);
  const el=document.getElementById('callNextDate');
  if(el)el.value=d.toISOString().slice(0,10);
}

// ── 네이버 지도 바로가기 ──
function openNaverMap(){
  // naver_url 우선 처리
  if(curCrmData?.naver_url?.trim()){
    window.open(curCrmData.naver_url,'_blank');
    return;
  }
  // 주소로 검색 (fallback)
  const addr=(curCrmData?.address||'').trim();
  if(!addr){alert('주소 정보가 없습니다.');return}
  window.open(`https://map.naver.com/v5/search/${encodeURIComponent(addr)}`,'_blank');
}

// ── DB 상세 이전/다음 이동 ──
let _listIds=[]; // 현재 목록의 ID 배열

function updateModalNav(id){
  const idx=_listIds.indexOf(id);
  const prevBtn=document.getElementById('modalPrevBtn');
  const nextBtn=document.getElementById('modalNextBtn');
  const lbl=document.getElementById('modalIndexLabel');
  if(_listIds.length===0){
    if(prevBtn)prevBtn.style.display='none';
    if(nextBtn)nextBtn.style.display='none';
    if(lbl)lbl.textContent='';
    return;
  }
  if(prevBtn)prevBtn.disabled=(idx<=0);
  if(nextBtn)nextBtn.disabled=(idx>=_listIds.length-1||idx<0);
  if(lbl)lbl.textContent=idx>=0?`${idx+1}/${_listIds.length}`:'';
}

async function moveCrmModal(dir){
  const curIdx=_listIds.indexOf(curCrmId);
  if(curIdx<0)return;
  const newIdx=curIdx+dir;
  if(newIdx<0||newIdx>=_listIds.length)return;
  await openCrmModal(_listIds[newIdx]);
}

// ── 단계 인라인 변경 (모달 내) ──
async function quickChangeStage(stage){
  if(!curCrmId)return;
  const{error}=await sb.from('prospects').update({stage}).eq('id',curCrmId);
  if(error){showToast('단계 변경 실패: '+error.message,'error');return;}
  if(curCrmData)curCrmData.stage=stage;
  const stageList=[
    {key:'가망',label:'🔵 가망',cls:'sb-prospect'},{key:'컨택중',label:'🟡 컨택중',cls:'sb-contact'},
    {key:'미팅확정',label:'🔷 미팅확정',cls:'sb-meeting'},{key:'검토중',label:'🟣 검토중',cls:'sb-review'},
    {key:'계약완료',label:'🟢 계약완료',cls:'sb-contract'},{key:'영업종결',label:'🔴 영업종결',cls:'sb-lost'}
  ];
  const ivStageEl=document.getElementById('ivStage');
  if(ivStageEl)ivStageEl.innerHTML=stageList.map(s=>
    `<button class="stage-sel-btn badge ${s.cls}${s.key===stage?' active-stage':''}" onclick="quickChangeStage('${s.key}')">${s.label}</button>`
  ).join('');
  document.getElementById('crmModalSub').innerHTML=`${stageBadge(stage)} &nbsp;담당: ${curCrmData?.manager||'-'}`;
  showToast(`단계 변경: ${stage}`,'success');
  if(stage==='계약완료'){
    if(typeof sendKakaoWorkNotify==='function')sendKakaoWorkNotify('contract',{business_name:curCrmData?.business_name||'-',manager:PR?.name||AU.email});
    if(typeof launchConfetti==='function')launchConfetti();
    await sb.from('prospects').update({contracted_at:new Date().toISOString()}).eq('id',curCrmId);
  }
  loadPipeline();
}

// ── 빠른 단계 변경 드롭다운 (목록에서) ──
function openStageQuick(id,currentStage,btn){
  document.querySelectorAll('.stage-quick-drop').forEach(d=>{if(d!==btn.nextElementSibling)d.classList.remove('open')});
  const drop=btn.nextElementSibling;drop.classList.toggle('open');
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.stage-quick-wrap'))
    document.querySelectorAll('.stage-quick-drop.open').forEach(d=>d.classList.remove('open'));
});

// ── 주소 유형 검증 ──
function isRoadAddress(addr){
  return/[가-힣]+(로|길)\s*\d+/.test(addr);
}
function checkAddressType(val,warnId){
  const el=document.getElementById(warnId);
  if(!el)return;
  if(val&&isRoadAddress(val)){el.style.display='block';}
  else{el.style.display='none';}
}
