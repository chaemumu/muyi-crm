// ── CRM 탭 ──
function crmTab(tab,el){
  const map={check:'tabCheck',reg:'tabReg',list:'tabList'};
  Object.values(map).forEach(id=>document.getElementById(id).style.display='none');
  document.querySelectorAll('#pgCrm .tab-bar .ti').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');document.getElementById(map[tab]).style.display='block';
  if(tab==='list'){loadList();initIndustryPickers();}
  if(tab==='check')loadBlockedInCheckTab();
  if(tab==='reg')loadAssignUserDropdown();
}

// ── PIPELINE ──
async function loadPipeline(){
  const mgr=AU.id;
  let q=sb.from('prospects').select('stage,id');
  if(!isPriv())q=q.eq('manager_id',mgr);
  const{data}=await q;
  const sc={};STAGES.forEach(s=>sc[s.key]=0);(data||[]).forEach(r=>sc[r.stage||'가망']++);
  const total=data?.length||0;
  document.getElementById('pipelineTotal').textContent='전체 '+total+'건';
  document.getElementById('pipelineCards').innerHTML=STAGES.map(s=>`
    <div class="pipe-card ${s.pipe}" onclick="loadStageList('${s.key}','${s.label}')">
      <div class="pipe-icon">${s.icon}</div><div class="pipe-label">${s.label}</div>
      <div class="pipe-count">${sc[s.key]}</div>
      <div class="pipe-sub">${total>0?Math.round(sc[s.key]/total*100):0}%</div>
    </div>`).join('');
}
async function loadStageList(stageKey,stageLabel){
  document.getElementById('stageListWrap').style.display='block';
  document.getElementById('stageListTitle').innerHTML=stageBadge(stageKey)+` ${stageLabel}`;
  const mgr=AU.id;
  let q=sb.from('prospects').select('id,business_name,phone,industry,stage,manager,next_contact_date,contract_end_date,created_at').eq('stage',stageKey).order('created_at',{ascending:false});
  if(!isPriv())q=q.eq('manager_id',mgr);
  const{data}=await q;
  const tbody=document.getElementById('stageListBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="7" class="empty">해당 단계 데이터 없음</td></tr>';return}
  const ids=data.map(r=>r.id);
  const{data:lc}=await sb.from('call_logs').select('prospect_id,called_at').in('prospect_id',ids).order('called_at',{ascending:false});
  const lcm={};(lc||[]).forEach(c=>{if(!lcm[c.prospect_id])lcm[c.prospect_id]=c.called_at});
  const today=td();
  tbody.innerHTML=data.map(r=>{
    let ncBadge='';
    if(r.next_contact_date){
      const isPast=r.next_contact_date<today,isToday=r.next_contact_date===today;
      ncBadge=`<span class="next-contact-badge ${isToday?'today':isPast?'past':''}">${isPast?'⚠️ ':isToday?'📞 ':'📅 '}${r.next_contact_date}</span>`;
    }
    // 계약 종료 임박 표시
    const todayDate=new Date();
    let contractBadge='';
    if(r.stage==='계약완료'&&r.contract_end_date){
      const endDate=new Date(r.contract_end_date);
      const daysLeft=Math.ceil((endDate-todayDate)/(1000*60*60*24));
      if(daysLeft<=7&&daysLeft>=0)contractBadge=`<span style="background:#fee2e2;color:#dc2626;font-size:11px;padding:2px 7px;border-radius:20px;font-weight:700;margin-left:4px">D-${daysLeft}</span>`;
      else if(daysLeft<0)contractBadge=`<span style="background:#f3f4f6;color:#6b7280;font-size:11px;padding:2px 7px;border-radius:20px;font-weight:700;margin-left:4px">종료</span>`;
    }
    return`<tr class="tbl-clickrow ${r.stage==='계약완료'&&r.contract_end_date&&new Date(r.contract_end_date)<todayDate?'row-ended':''}" onclick="openCrmModal(${r.id})">
      <td><strong>${r.business_name||'-'}</strong>${contractBadge}</td>
      <td>${maskPhone(r.phone)}</td>
      <td>${r.industry?`<span class="tag-chip industry">${r.industry}</span>`:'-'}</td>
      <td>${r.manager||'-'}</td>
      <td>${ncBadge||'-'}</td>
      <td>${lcm[r.id]?fmtDt(lcm[r.id]):'기록 없음'}</td>
      <td><button class="btn-s btn-sm" onclick="event.stopPropagation();openCrmModal(${r.id})">상세</button></td>
    </tr>`;
  }).join('');
  document.getElementById('stageListWrap').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function closeStageList(){document.getElementById('stageListWrap').style.display='none'}

// ── CRM 등록 ──
async function saveCRM(){
  const name=document.getElementById('rName').value.trim(),phone=document.getElementById('rPhone').value.trim();
  if(!name||!phone){setMsg('regMsg','업체명과 전화번호는 필수입니다.',false);return}
  const{data:blocked}=await sb.from('blocked_stores').select('brand_name');
  const mb=(blocked||[]).find(b=>name.toLowerCase().includes(b.brand_name.toLowerCase()));
  if(mb){setMsg('regMsg',`⛔ [${mb.brand_name}] 전지점 영업 불가 업체입니다.`,false);return}
  const role=(PR?.role||'user').toLowerCase();
  const{data:dupData}=await sb.from('prospects').select('id,business_name,manager').ilike('business_name',name);
  if(dupData?.length){
    const dupInfo=dupData.map(d=>`${d.business_name}(담당:${d.manager||'-'})`).join(', ');
    if(['user','junior'].includes(role)){setMsg('regMsg',`⚠️ 이미 등록된 업체입니다: ${dupInfo}\n사원 계정은 중복 등록이 불가합니다.`,false);return;}
    else{if(!confirm(`⚠️ 중복 업체 발견:\n${dupInfo}\n\n그래도 등록하시겠습니까?`))return;}
  }
  // 담당자 배정 처리
  const assignSel=document.getElementById('rAssignUser');
  const assignId=assignSel?.value||'';
  let managerName=PR?.name||AU.email;
  let managerId=AU.id;
  if(assignId&&isPriv()){
    const opt=assignSel.options[assignSel.selectedIndex];
    managerName=opt.textContent||managerName;
    managerId=assignId;
  }
  const industryEl=document.getElementById('rIndustry');
  const payload={
    business_name:name,phone,
    address:document.getElementById('rAddress').value.trim()||null,
    industry:industryEl?.value||'음식점',
    stage:'가망',
    next_contact_date:null,
    status:'가망',
    manager:managerName,
    manager_id:managerId,
    naver_url:document.getElementById('rNaverUrl').value.trim()||null
  };
  const{data:inserted,error}=await sb.from('prospects').insert([payload]).select().single();
  if(error){setMsg('regMsg','오류: '+error.message,false);return;}
  // 통화내용이 있으면 call_logs에 초기 등록 기록 저장
  const callContent=document.getElementById('rCallContent').value.trim();
  if(callContent&&inserted?.id){
    await sb.from('call_logs').insert([{
      prospect_id:inserted.id,manager_id:AU.id,manager_name:PR?.name||AU.email,
      content:callContent,result:'통화성공',is_initial:true,called_at:new Date().toISOString()
    }]);
  }
  setMsg('regMsg','✓ 가망 DB 등록 완료',true);
  ['rName','rPhone','rAddress','rNaverUrl','rCallContent'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  if(industryEl)industryEl.value='음식점';
  if(assignSel)assignSel.value='';
  const ns=document.getElementById('naverParseStatus');if(ns)ns.textContent='';
  loadPipeline();
}

// ── CRM 목록 ──
async function loadList(){
  const kw=document.getElementById('listKw').value.trim();
  const sf=document.getElementById('listStageFilter').value;
  const ind=document.getElementById('listIndustry')?.value.trim()||'';
  let q=sb.from('prospects').select('id,business_name,phone,industry,stage,manager,next_contact_date,created_at').order('created_at',{ascending:false}).limit(300);
  // 담당자별 필터링: admin/master는 전체, user는 자신의 데이터만
  if(!isPriv())q=q.eq('manager_id',AU.id);
  if(kw)q=q.or(`business_name.ilike.%${kw}%,manager.ilike.%${kw}%`);
  if(sf)q=q.eq('stage',sf);
  if(ind)q=q.ilike('industry','%'+ind+'%');
  const{data}=await q;
  document.getElementById('crmCnt').textContent=(data?.length||0)+'건';
  const tbody=document.getElementById('listBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="9" class="empty">데이터 없음</td></tr>';return}
  const today=td();
  selectedIds.clear();updateBulkBar();
  _listIds=[];
  const mc=document.getElementById('masterCheck');if(mc)mc.checked=false;
  const STAGE_ICONS={'가망':'🔵','컨택중':'🟡','검토중':'🟣','미팅확정':'🔶','계약완료':'🟢','영업종결':'🔴'};
  tbody.innerHTML=data.map(r=>{
    let ncBadge='';
    if(r.next_contact_date){
      const isPast=r.next_contact_date<today,isToday=r.next_contact_date===today;
      ncBadge=`<span class="next-contact-badge ${isToday?'today':isPast?'past':''}">${isPast?'⚠️':isToday?'📞':'📅'} ${r.next_contact_date}</span>`;
    }
    const stageOpts=Object.entries(STAGE_ICONS).map(([s,i])=>`<div class="stage-q-item" onclick="quickStageChange(${r.id},'${s}',this.closest('.stage-quick-drop'))">${i} ${s}</div>`).join('');
    return`<tr>
      <td class="check-col"><input type="checkbox" class="row-check" data-id="${r.id}" onchange="toggleRowCheck(this,${r.id})"></td>
      <td class="tbl-clickrow" onclick="openCrmModal(${r.id})"><strong>${highlight(r.business_name,kw)}</strong></td>
      <td>${r.phone||'-'}</td>
      <td>${r.industry?`<span class="tag-chip industry">${r.industry}</span>`:'-'}</td>
      <td>
        <div class="stage-quick-wrap">
          <span class="badge ${(STAGES.find(s=>s.key===r.stage)||STAGES[0]).cls}" style="cursor:pointer" onclick="openStageQuick(${r.id},'${r.stage}',this)">${STAGE_ICONS[r.stage]||'🔵'} ${r.stage||'가망'} ▾</span>
          <div class="stage-quick-drop">${stageOpts}</div>
        </div>
      </td>
      <td>${r.manager||'-'}</td>
      <td>${ncBadge||'-'}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td><button class="btn-s btn-sm" onclick="openCrmModal(${r.id})">상세</button></td>
    </tr>`;
  }).join('');
  // 이전/다음 모달 네비용 ID 캐시
  _listIds=data.map(r=>r.id);
}

// ── 엑셀 내보내기 ──
async function exportExcel(){
  const mgr=AU.id;
  let q=sb.from('prospects').select('*').order('created_at',{ascending:false});
  if(!isPriv())q=q.eq('manager_id',mgr);
  const{data}=await q;if(!data?.length){alert('데이터가 없습니다.');return}
  const rows=data.map(r=>({업체명:r.business_name,전화번호:r.phone,주소:r.address||'',업종:r.industry||'',영업단계:r.stage||'가망',상태:r.status||'가망',다음연락:r.next_contact_date||'',담당자:r.manager||'',메모:r.memo||'',등록일:fmtDate(r.created_at)}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,'CRM목록',ws);XLSX.writeFile(wb,'MUYI_CRM_'+td()+'.xlsx');
}
async function exportExcelAll(){
  const{data}=await sb.from('prospects').select('*').order('created_at',{ascending:false});
  if(!data?.length){alert('데이터가 없습니다.');return}
  const rows=data.map(r=>({업체명:r.business_name,전화번호:r.phone,주소:r.address||'',업종:r.industry||'',영업단계:r.stage||'가망',상태:r.status||'가망',다음연락:r.next_contact_date||'',담당자:r.manager||'',메모:r.memo||'',등록일:fmtDate(r.created_at)}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,'전체CRM',ws);XLSX.writeFile(wb,'MUYI_CRM_전체_'+td()+'.xlsx');
}

// ── 엑셀 일괄 업로드 ──
let adminExcelRows=[];

async function openExcelUploadModal(){
  const role=(PR?.role||'user').toLowerCase();
  const modal=document.getElementById('excelUploadModal');
  const masterArea=document.getElementById('uploadMasterArea');
  const adminArea=document.getElementById('uploadAdminArea');
  const uploadBtn=document.getElementById('uploadBtn');
  const requestBtn=document.getElementById('uploadRequestBtn');
  const approvalList=document.getElementById('uploadApprovalList');

  // 초기화
  document.getElementById('uploadMsg').textContent='-';
  document.getElementById('uploadMsg').className='stmsg';
  if(document.getElementById('excelFile'))document.getElementById('excelFile').value='';
  document.getElementById('excelPreview').style.display='none';
  uploadBtn.style.display='none';

  if(role==='master'){
    masterArea.style.display='block';
    adminArea.style.display='none';
    requestBtn.style.display='none';
    loadUploadManagerSel();
    // 승인 대기 목록 표시
    await loadUploadApprovals(approvalList);
  } else if(role==='admin'){
    masterArea.style.display='none';
    adminArea.style.display='block';
    uploadBtn.style.display='none';
    requestBtn.style.display='flex';
    approvalList.innerHTML='';
    // 이 ADMIN이 승인받은 게 있는지 확인
    const{data:approved}=await sb.from('upload_approvals')
      .select('*').eq('requester_id',AU.id).eq('status','approved').order('reviewed_at',{ascending:false}).limit(1).maybeSingle();
    if(approved){
      masterArea.style.display='block';
      adminArea.style.display='none';
      requestBtn.style.display='none';
      loadUploadManagerSel();
      setMsg('uploadMsg',`✅ MASTER 승인 완료 (${fmtDate(approved.reviewed_at)}). 업로드 가능합니다.`,true);
      uploadBtn.style.display='flex';
    }
  } else {
    masterArea.style.display='none';
    adminArea.style.display='none';
    setMsg('uploadMsg','⛔ 업로드 권한이 없습니다.',false);
  }
  modal.style.display='flex';
  excelRows=[];adminExcelRows=[];
}

async function loadUploadApprovals(el){
  const{data}=await sb.from('upload_approvals').select('*').eq('status','pending').order('created_at',{ascending:false});
  if(!data?.length){el.innerHTML='';return}
  el.innerHTML=`<div class="divider"></div>
    <div style="font-size:14px;font-weight:700;color:#0f0c2e;margin-bottom:11px">📋 승인 대기 요청 (${data.length}건)</div>
    ${data.map(r=>`<div style="background:#f8f9fc;border-radius:11px;padding:13px 16px;margin-bottom:9px;display:flex;align-items:center;gap:11px;flex-wrap:wrap">
      <div style="flex:1"><div style="font-size:14px;font-weight:700">${r.requester_name||'-'}</div>
        <div style="font-size:13px;color:#6b7494">${r.file_name||''} · ${r.row_count||0}건 · ${r.memo||''}</div>
        <div style="font-size:12px;color:#9fa6bc">${fmtDate(r.created_at)}</div></div>
      <div style="display:flex;gap:7px">
        <button class="btn-p btn-sm" onclick="approveUpload(${r.id},'approved',this)">✅ 승인</button>
        <button class="btn-d" onclick="approveUpload(${r.id},'rejected',this)">❌ 거절</button>
      </div>
    </div>`).join('')}`;
}

async function approveUpload(id,status,btn){
  btn.disabled=true;
  const{error}=await sb.from('upload_approvals').update({
    status,reviewed_by:PR?.name||AU.email,reviewed_at:new Date().toISOString()
  }).eq('id',id);
  if(!error){
    btn.closest('div[style*="f8f9fc"]').style.opacity='0.5';
    const list=document.getElementById('uploadApprovalList');
    await loadUploadApprovals(list);
  }
}

function previewExcelAdmin(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const wb=XLSX.read(e.target.result,{type:'binary'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    adminExcelRows=rows.slice(1).filter(r=>r[0]);
    document.getElementById('excelPreviewAdmin').style.display='block';
    document.getElementById('excelPreviewAdminLabel').textContent=
      `📊 총 ${adminExcelRows.length}건 확인됨`;
  };
  reader.readAsBinaryString(file);
}

async function requestUploadApproval(){
  const memo=document.getElementById('uploadMemo')?.value.trim();
  const file=document.getElementById('excelFileAdmin')?.files[0];
  if(!file){setMsg('uploadMsg','파일을 선택하세요.',false);return}
  if(!memo){setMsg('uploadMsg','업로드 사유를 입력하세요.',false);return}
  const{error}=await sb.from('upload_approvals').insert([{
    requester_id:AU.id,requester_name:PR?.name||AU.email,
    status:'pending',row_count:adminExcelRows.length,
    file_name:file.name,memo
  }]);
  if(error){setMsg('uploadMsg','오류: '+error.message,false);return}
  setMsg('uploadMsg','✅ 승인 요청이 MASTER에게 전달되었습니다.',true);
  document.getElementById('uploadRequestBtn').style.display='none';
}

function previewExcel(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const wb=XLSX.read(e.target.result,{type:'binary'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(rows.length<2){setMsg('uploadMsg','데이터가 없습니다.',false);return}
    excelRows=rows.slice(1).filter(r=>(r[0]||r[1]));
    document.getElementById('excelPreviewLabel').textContent=`미리보기 (총 ${excelRows.length}건, 최대 5건 표시)`;
    const preview=excelRows.slice(0,5);
    const hdrs=['업체명','대표전화','보조전화','담당자명','주소','업종','단계','메모','다음연락일'];
    document.getElementById('excelPreviewTable').innerHTML=
      `<thead><tr>${hdrs.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`+
      `<tbody>${preview.map(r=>`<tr>${hdrs.map((_,i)=>`<td>${r[i]||''}</td>`).join('')}</tr>`).join('')}</tbody>`;
    document.getElementById('excelPreview').style.display='block';
    document.getElementById('uploadBtn').style.display='flex';
    setMsg('uploadMsg',`총 ${excelRows.length}건 확인됨. 담당 사원 선택 후 업로드 버튼을 누르세요.`,true);
  };
  reader.readAsBinaryString(file);
}

async function loadUploadManagerSel(){
  const sel=document.getElementById('uploadManagerSel');
  if(!sel)return;
  const{data}=await sb.from('users').select('id,name').order('name');
  sel.innerHTML='<option value="">담당자 선택</option>';
  (data||[]).forEach(u=>{
    const opt=document.createElement('option');
    opt.value=u.id;opt.dataset.name=u.name;opt.textContent=u.name;
    sel.appendChild(opt);
  });
  // 본인 선택 기본값
  const myOpt=Array.from(sel.options).find(o=>o.value===AU?.id);
  if(myOpt)myOpt.selected=true;
}

const VALID_STAGES=['가망','컨택중','검토중','미팅확정','계약완료','영업종결'];
async function uploadExcel(){
  if(!excelRows.length){setMsg('uploadMsg','파일을 먼저 선택하세요.',false);return}
  const role=(PR?.role||'user').toLowerCase();
  if(!['master','admin'].includes(role)){setMsg('uploadMsg','권한이 없습니다.',false);return}
  const sel=document.getElementById('uploadManagerSel');
  const mgrId=sel?.value||AU.id;
  const mgrName=sel?.options[sel.selectedIndex]?.dataset?.name||PR?.name||'';
  if(!mgrId){setMsg('uploadMsg','담당 사원을 선택하세요.',false);return}
  document.getElementById('uploadBtn').disabled=true;
  showSpinner('업로드 중...');
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr=tomorrow.toISOString().slice(0,10);
  let ok=0,fail=0;
  const BATCH=50;
  for(let i=0;i<excelRows.length;i+=BATCH){
    const batch=excelRows.slice(i,i+BATCH).map(r=>({
      business_name:(r[0]||'').toString().trim()||null,
      phone:(r[1]||'').toString().trim(),
      sub_phone:(r[2]||'').toString().trim()||null,
      name:(r[3]||'').toString().trim()||null,
      address:(r[4]||'').toString().trim()||null,
      industry:(r[5]||'').toString().trim()||null,
      stage:VALID_STAGES.includes((r[6]||'').toString().trim())?(r[6]||'').toString().trim():'가망',
      memo:(r[7]||'').toString().trim()||null,
      next_contact_date:(r[8]||'').toString().trim()||tomorrowStr,
      naver_url:(r[9]||'').toString().trim()||null,
      feature:(r[10]||'').toString().trim()||null,
      status:'가망',
      manager:mgrName,
      manager_id:mgrId
    })).filter(r=>r.phone);
    const{error}=await sb.from('prospects').insert(batch);
    if(error){fail+=batch.length;console.error(error);}else ok+=batch.length;
    document.getElementById('spinnerText').textContent=`업로드 중... ${Math.min(i+BATCH,excelRows.length)}/${excelRows.length}건`;
  }
  hideSpinner();
  document.getElementById('uploadBtn').disabled=false;
  setMsg('uploadMsg',`✅ 완료: 성공 ${ok}건${fail?` / 실패 ${fail}건`:''}`,true);
  loadPipeline();
  setTimeout(()=>{document.getElementById('excelUploadModal').style.display='none';},2000);
}

// ── 일괄 단계 변경 (체크박스) ──
let selectedIds=new Set();
function toggleMasterCheck(cb){
  document.querySelectorAll('.row-check:not(#masterCheck)').forEach(c=>{
    c.checked=cb.checked;
    const id=parseInt(c.dataset.id);
    if(cb.checked)selectedIds.add(id);else selectedIds.delete(id);
  });
  updateBulkBar();
}
function toggleRowCheck(cb,id){
  if(cb.checked)selectedIds.add(id);else selectedIds.delete(id);
  updateBulkBar();
}
function updateBulkBar(){
  const bar=document.getElementById('bulkBar');
  const cnt=document.getElementById('bulkCount');
  if(!bar)return;
  if(selectedIds.size>0){bar.classList.add('show');cnt.textContent=selectedIds.size+'건 선택';}
  else bar.classList.remove('show');
}
function selectAllRows(){
  document.querySelectorAll('.row-check:not(#masterCheck)').forEach(c=>{
    c.checked=true;selectedIds.add(parseInt(c.dataset.id));
  });
  const mc=document.getElementById('masterCheck');if(mc)mc.checked=true;
  updateBulkBar();
}
function clearSelection(){
  selectedIds.clear();
  document.querySelectorAll('.row-check').forEach(c=>c.checked=false);
  updateBulkBar();
}
async function bulkStageChange(stage){
  if(!selectedIds.size)return;
  if(!confirm(`선택한 ${selectedIds.size}건의 단계를 "${stage}"으로 변경하시겠습니까?`))return;
  const ids=[...selectedIds];
  const{error}=await sb.from('prospects').update({stage}).in('id',ids);
  if(error){alert('오류: '+error.message);return}
  if(stage==='계약완료'){
    const{data:contracts}=await sb.from('prospects').select('business_name,manager').in('id',ids);
    (contracts||[]).forEach(p=>sendKakaoWorkNotify('contract',{business_name:p.business_name,manager:p.manager,stage:'계약 완료'}));
  }
  clearSelection();loadList();loadPipeline();
}

// ── 일괄 담당자 변경 + 다음 연락 일괄 설정 ──
async function bulkTransfer() {
  if (!selectedIds.size) return;
  const { data: users } = await sb.from('users').select('name').in('role',['user','admin','master']);
  const names = (users||[]).map(u=>u.name);
  const target = prompt(`담당자 이관\n선택: ${[...selectedIds].length}건\n\n이관할 담당자 이름을 입력하세요:\n${names.join(', ')}`);
  if (!target || !names.includes(target)) { alert('유효하지 않은 담당자입니다.'); return; }
  const { error } = await sb.from('prospects').update({manager:target}).in('id',[...selectedIds]);
  if (!error) { clearSelection(); loadList(); setMsg('uploadMsg','✓ 담당자 이관 완료',true); }
}

async function bulkSetNextContact() {
  if (!selectedIds.size) return;
  const date = prompt('다음 연락 예정일을 입력하세요 (YYYY-MM-DD):', td());
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('날짜 형식이 올바르지 않습니다.'); return; }
  const { error } = await sb.from('prospects').update({next_contact_date:date}).in('id',[...selectedIds]);
  if (!error) { clearSelection(); loadList(); setMsg('uploadMsg',`✓ 다음 연락일 일괄 설정 완료`,true); }
}

// ── 관리자 CRM ──
async function loadAdmCRM(){
  const kw=document.getElementById('admKw').value.trim(),mgrId=document.getElementById('admMgr').value,stage=document.getElementById('admStage').value;
  let q=sb.from('prospects').select('id,business_name,phone,industry,stage,status,manager,created_at').order('created_at',{ascending:false});
  if(kw)q=q.or(`business_name.ilike.%${kw}%,phone.ilike.%${kw}%`);
  if(mgrId)q=q.eq('manager_id',mgrId);if(stage)q=q.eq('stage',stage);
  const[{data},{data:usersRaw}]=await Promise.all([q,sb.from('users').select('name')]);
  document.getElementById('admCnt').textContent=(data?.length||0)+'건';
  const tbody=document.getElementById('admCrmBody');
  if(!data?.length){tbody.innerHTML='<tr><td colspan="8" class="empty">데이터 없음</td></tr>';return}
  const un=(usersRaw||[]).map(u=>u.name);
  tbody.innerHTML=data.map(r=>`<tr class="tbl-clickrow" onclick="openCrmModal(${r.id})">
    <td><strong>${r.business_name||'-'}</strong></td><td>${r.phone||'-'}</td>
    <td>${r.industry?`<span class="tag-chip industry">${r.industry}</span>`:'-'}</td>
    <td>${stageBadge(r.stage||'가망')}</td><td>${stBadge(r.status||'가망')}</td>
    <td><select class="role-sel" onchange="transferCrm(${r.id},this.value)" onclick="event.stopPropagation()">
      <option value="${r.manager||''}">${r.manager||'-'}</option>
      ${un.filter(n=>n!==r.manager).map(n=>`<option value="${n}">${n}</option>`).join('')}
    </select></td>
    <td>${fmtDate(r.created_at)}</td>
    <td><button class="btn-d btn-sm" onclick="event.stopPropagation();delCRM(${r.id},this)">삭제</button></td>
  </tr>`).join('');
}
async function transferCrm(id,newMgr){await sb.from('prospects').update({manager:newMgr}).eq('id',id)}
async function delCRM(id,btn){
  if(!confirm('삭제하시겠습니까?'))return;
  const{error}=await sb.from('prospects').delete().eq('id',id);
  if(!error)btn.closest('tr').remove();else alert('실패: '+error.message);
}

// ── 중복 DB 탐지 ──
async function loadDupCheck(){
  const el=document.getElementById('dupDetectResult');
  if(el)el.innerHTML='<div class="empty">탐지 실행 버튼을 눌러주세요</div>';
}
async function runDupDetect(){
  const el=document.getElementById('dupDetectResult');
  el.innerHTML='<div class="empty">탐지 중... (유사도 분석 포함)</div>';
  const{data}=await sb.from('prospects').select('id,business_name,phone,manager,stage').order('created_at',{ascending:false}).limit(2000);
  if(!data?.length){el.innerHTML='<div class="empty">데이터 없음</div>';return;}
  const phoneDups=[],nameDups=[],fuzzyDups=[];
  const phoneMap={};
  data.forEach(r=>{const p=(r.phone||'').replace(/\D/g,'');if(p.length>7){if(!phoneMap[p])phoneMap[p]=[];phoneMap[p].push(r);}});
  Object.values(phoneMap).filter(arr=>arr.length>1).forEach(arr=>phoneDups.push(arr));
  const nameMap={};
  data.forEach(r=>{const n=(r.business_name||'').trim().toLowerCase();if(n){if(!nameMap[n])nameMap[n]=[];nameMap[n].push(r);}});
  Object.values(nameMap).filter(arr=>arr.length>1).forEach(arr=>nameDups.push(arr));
  const exactNames=new Set(Object.keys(nameMap).filter(k=>nameMap[k].length>1));
  for(let i=0;i<Math.min(data.length,500);i++){
    for(let j=i+1;j<Math.min(data.length,500);j++){
      const na=(data[i].business_name||'').trim().toLowerCase();
      const nb=(data[j].business_name||'').trim().toLowerCase();
      if(exactNames.has(na)||exactNames.has(nb))continue;
      const score=typeof similarityScore==='function'?similarityScore(na,nb):0;
      if(score>=0.8&&score<1.0)fuzzyDups.push({a:data[i],b:data[j],score});
    }
  }
  const total=phoneDups.length+nameDups.length+fuzzyDups.length;
  if(!total){el.innerHTML='<div class="empty" style="color:var(--green)">✅ 중복/유사 DB 없음!</div>';return;}
  let html=`<div style="font-size:14px;font-weight:700;color:var(--red);margin-bottom:12px">⚠️ 중복/유사 ${total}그룹 발견</div>`;
  if(phoneDups.length){
    html+=`<div style="font-size:13px;font-weight:700;margin-bottom:8px">📱 전화번호 중복 (${phoneDups.length}그룹)</div>`;
    phoneDups.slice(0,15).forEach(arr=>{
      html+=`<div class="dup-detect-banner"><div><div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:6px">☎ ${arr[0].phone}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${arr.map(r=>`<span class="blocked-chip" onclick="openCrmModal(${r.id})">${r.business_name||'-'} (${r.manager||'-'})</span>`).join('')}</div></div></div>`;
    });
  }
  if(nameDups.length){
    html+=`<div style="font-size:13px;font-weight:700;margin:12px 0 8px">📋 업체명 완전일치 (${nameDups.length}그룹)</div>`;
    nameDups.slice(0,15).forEach(arr=>{
      html+=`<div class="dup-detect-banner"><div><div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:6px">🏢 ${arr[0].business_name}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${arr.map(r=>`<span class="blocked-chip" onclick="openCrmModal(${r.id})">${r.stage||'가망'} | ${r.manager||'-'}</span>`).join('')}</div></div></div>`;
    });
  }
  if(fuzzyDups.length){
    html+=`<div style="font-size:13px;font-weight:700;margin:12px 0 8px">🔍 유사 업체명 (${Math.min(fuzzyDups.length,20)}그룹 — 유사도 80%+)</div>`;
    fuzzyDups.slice(0,20).forEach(({a,b,score})=>{
      html+=`<div class="dup-detect-banner"><div style="flex:1"><div style="font-size:12px;font-weight:700;color:#b45309;margin-bottom:6px">유사도 ${Math.round(score*100)}%</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="blocked-chip" onclick="openCrmModal(${a.id})">${a.business_name} (${a.manager||'-'})</span>
          <span style="color:var(--gray-400);align-self:center">↔</span>
          <span class="blocked-chip" onclick="openCrmModal(${b.id})">${b.business_name} (${b.manager||'-'})</span>
        </div></div></div>`;
    });
  }
  el.innerHTML=html;
}

// ── 장기 종결 DB ──
async function loadStaleDB() {
  if (!isPriv()) return;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0,10);

  const { data } = await sb.from('prospects')
    .select('*').eq('stage','영업종결')
    .lt('updated_at', cutoff + 'T00:00:00')
    .order('updated_at', {ascending:true});

  const staleCount = document.getElementById('staleCount');
  const deleteBtn = document.getElementById('staleDeleteAllBtn');
  const listEl = document.getElementById('staleDBList');

  if (!data?.length) {
    if (staleCount) staleCount.textContent = '0';
    if (deleteBtn) deleteBtn.style.display = 'none';
    listEl.innerHTML = '<div class="empty" style="color:var(--green)">✅ 30일 이상 된 종결 DB 없음</div>';
    return;
  }

  if (staleCount) staleCount.textContent = data.length;
  if (deleteBtn) deleteBtn.style.display = 'flex';

  listEl.innerHTML = `<div style="overflow-x:auto"><table class="tbl">
    <thead><tr><th><input type="checkbox" id="staleAll" onchange="toggleStaleAll(this)"></th><th>업체명</th><th>전화번호</th><th>담당자</th><th>종결일</th><th>경과</th><th>관리</th></tr></thead>
    <tbody>${data.map(r => {
      const days = Math.floor((Date.now() - new Date(r.updated_at)) / 86400000);
      return `<tr>
        <td><input type="checkbox" class="row-check stale-check" data-id="${r.id}"></td>
        <td><strong>${r.business_name||'-'}</strong></td>
        <td>${r.phone||'-'}</td>
        <td>${r.manager||'-'}</td>
        <td>${fmtDate(r.updated_at)}</td>
        <td><span style="color:var(--red);font-weight:700">${days}일</span></td>
        <td><button class="btn-d" onclick="deleteStaleSingle(${r.id},this)">삭제</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>
  <div style="margin-top:12px;display:flex;gap:8px">
    <button class="btn-d" onclick="deleteStaleSelected()">✓ 선택 삭제</button>
  </div>`;
}

function toggleStaleAll(cb) {
  document.querySelectorAll('.stale-check').forEach(c => c.checked = cb.checked);
}

async function deleteStaleSelected() {
  const ids = [...document.querySelectorAll('.stale-check:checked')].map(c => parseInt(c.dataset.id));
  if (!ids.length) { alert('선택된 항목이 없습니다.'); return; }
  if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;
  await sb.from('prospects').delete().in('id', ids);
  loadStaleDB();
}

async function deleteStaleAll() {
  if (!confirm('30일 이상 종결 DB를 전부 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0,10);
  await sb.from('prospects').delete().eq('stage','영업종결').lt('updated_at', cutoff+'T00:00:00');
  loadStaleDB();
}

async function deleteStaleSingle(id, btn) {
  if (!confirm('이 항목을 삭제하시겠습니까?')) return;
  await sb.from('prospects').delete().eq('id', id);
  btn.closest('tr').remove();
  const staleCount = document.getElementById('staleCount');
  if (staleCount) staleCount.textContent = parseInt(staleCount.textContent||'0') - 1;
}

// ── 월간 사원별 성과 카드 ──
async function loadPerfCards() {
  const yr = parseInt(document.getElementById('perfYear')?.value) || new Date().getFullYear();
  const mo = parseInt(document.getElementById('perfMonth')?.value) || new Date().getMonth()+1;
  const ss = `${yr}-${String(mo).padStart(2,'0')}-01`;
  const ee = `${yr}-${String(mo).padStart(2,'0')}-${String(new Date(yr,mo,0).getDate()).padStart(2,'0')}`;

  const [{ data: users }, { data: calls }, { data: prospects }] = await Promise.all([
    sb.from('users').select('id,name,animal_emoji,role').in('role',['user','admin','master']),
    sb.from('calls').select('manager,call_count,call_time').gte('date',ss).lte('date',ee),
    sb.from('prospects').select('manager,stage').gte('created_at',ss+'T00:00:00').lte('created_at',ee+'T23:59:59'),
  ]);

  const umap = {};
  (users||[]).forEach(u => umap[u.id] = u);

  // 사원별 집계
  const stats = {};
  (users||[]).forEach(u => { stats[u.name] = { user:u, calls:0, time:0, crm:0, contracts:0 }; });
  (calls||[]).forEach(r => {
    const name = umap[r.manager]?.name || r.manager;
    if (!stats[name]) stats[name] = { user:null, calls:0, time:0, crm:0, contracts:0 };
    stats[name].calls += r.call_count||0;
    stats[name].time += r.call_time||0;
  });
  (prospects||[]).forEach(r => {
    if (!stats[r.manager]) stats[r.manager] = { user:null, calls:0, time:0, crm:0, contracts:0 };
    stats[r.manager].crm++;
    if (r.stage==='계약완료') stats[r.manager].contracts++;
  });

  const grid = document.getElementById('perfCardGrid');
  if (!grid) return;
  const sorted = Object.entries(stats).sort((a,b) => b[1].calls - a[1].calls);

  grid.innerHTML = sorted.map(([name, s]) => {
    const emoji = s.user?.animal_emoji || getAnimal(name);
    const convRate = s.crm > 0 ? Math.round(s.contracts/s.crm*100) : 0;
    return `<div class="perf-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="perf-avatar">${emoji}</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--gray-950)">${name}</div>
          <div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px">${s.user?.role||'USER'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="perf-stat"><div class="perf-stat-val">${s.calls}</div><div class="perf-stat-lbl">콜</div></div>
        <div class="perf-stat"><div class="perf-stat-val">${s.time}분</div><div class="perf-stat-lbl">통화</div></div>
        <div class="perf-stat"><div class="perf-stat-val">${s.crm}</div><div class="perf-stat-lbl">가망 등록</div></div>
        <div class="perf-stat"><div class="perf-stat-val" style="color:var(--orange)">${convRate}%</div><div class="perf-stat-lbl">전환율</div></div>
      </div>
    </div>`;
  }).join('');
}

// perfCards 연도/월 select 초기화
function initPerfCardSelects() {
  const yrSel = document.getElementById('perfYear');
  const moSel = document.getElementById('perfMonth');
  if (!yrSel || yrSel.options.length > 0) return;
  const n = new Date();
  for (let y = n.getFullYear(); y >= n.getFullYear()-2; y--) {
    const o = document.createElement('option'); o.value=y; o.textContent=y+'년'; yrSel.appendChild(o);
  }
  for (let m = 1; m <= 12; m++) {
    const o = document.createElement('option'); o.value=m; o.textContent=m+'월';
    o.selected = m === n.getMonth()+1; moSel.appendChild(o);
  }
}

// ── DB 배정 ──
async function loadAssignUsers(){
  const sel=document.getElementById('assignTargetUser');
  if(!sel)return;
  sel.innerHTML='<option value="">-- 사원 선택 --</option>';
  const{data}=await sb.from('users').select('id,name,role').neq('role','inactive').order('name');
  (data||[]).forEach(u=>{
    const o=document.createElement('option');
    o.value=u.id;
    o.textContent=`${u.name||u.email||'-'} (${rlLbl(u.role)})`;
    sel.appendChild(o);
  });
}
async function loadAssignList(){
  const kw=(document.getElementById('assignSearchKw')?.value||'').trim();
  let q=sb.from('prospects').select('id,business_name,phone,stage,manager,created_at').order('created_at',{ascending:false}).limit(200);
  if(kw)q=q.ilike('business_name','%'+kw+'%');
  const{data}=await q;
  const tbody=document.getElementById('assignListBody');
  if(!tbody)return;
  if(!data?.length){tbody.innerHTML='<tr><td colspan="6" class="empty">결과 없음</td></tr>';return;}
  tbody.innerHTML=data.map(r=>`<tr>
    <td><input type="checkbox" class="assign-row-chk" data-id="${r.id}" data-name="${(r.business_name||'').replace(/"/g,'')}"></td>
    <td><strong>${r.business_name||'-'}</strong></td>
    <td>${maskPhone(r.phone)}</td>
    <td>${stageBadge(r.stage||'가망')}</td>
    <td style="color:#6b7494">${r.manager||'-'}</td>
    <td style="color:#9fa6bc;font-size:13px">${(r.created_at||'').slice(0,10)}</td>
  </tr>`).join('');
  document.querySelectorAll('.assign-row-chk').forEach(cb=>{
    cb.addEventListener('change',()=>{
      const cnt=document.querySelectorAll('.assign-row-chk:checked').length;
      const el=document.getElementById('assignSelCount');
      if(el)el.textContent=cnt+'건 선택';
    });
  });
}
function toggleAssignCheck(master){
  document.querySelectorAll('.assign-row-chk').forEach(cb=>{cb.checked=master.checked;});
  const cnt=master.checked?document.querySelectorAll('.assign-row-chk').length:0;
  const el=document.getElementById('assignSelCount');if(el)el.textContent=cnt+'건 선택';
}
async function doAssignDB(){
  const targetId=document.getElementById('assignTargetUser')?.value;
  if(!targetId){setMsg('assignMsg','배정받을 사원을 선택해 주세요.',false);return;}
  const{data:tUser}=await sb.from('users').select('name').eq('id',targetId).maybeSingle();
  const targetName=tUser?.name||'';
  if(!targetName){setMsg('assignMsg','사원 정보를 찾을 수 없습니다.',false);return;}
  const checked=[...document.querySelectorAll('.assign-row-chk:checked')].map(cb=>parseInt(cb.dataset.id));
  if(!checked.length){setMsg('assignMsg','배정할 DB를 선택해 주세요.',false);return;}
  const{error}=await sb.from('prospects').update({manager:targetName}).in('id',checked);
  if(error){setMsg('assignMsg','오류: '+error.message,false);return;}
  // 배정 이력 기록
  const records=checked.map(pid=>({prospect_id:pid,assigned_to:targetName,assigned_to_id:targetId,assigned_by:PR?.name||AU?.email||'관리자'}));
  try{await sb.from('db_assignments').insert(records);}catch(e){}
  setMsg('assignMsg',`✅ ${checked.length}건을 ${targetName}에게 배정했습니다!`,true);
  await loadAssignList();
  document.getElementById('assignMasterChk').checked=false;
  document.getElementById('assignSelCount').textContent='0건 선택';
}

// ── 담당자 배정 드롭다운 로딩 ──
async function loadAssignUserDropdown(){
  if(!isPriv())return;
  document.getElementById('assignUserGroup').style.display='block';
  const sel=document.getElementById('rAssignUser');
  if(!sel||sel.options.length>1)return; // 이미 로드됨
  const{data:users}=await sb.from('users').select('id,name').not('role','eq','inactive').order('name');
  (users||[]).forEach(u=>{
    if(u.id===AU.id)return; // 본인은 제외 (기본값)
    const opt=document.createElement('option');
    opt.value=u.id;opt.textContent=u.name||u.email||u.id;
    sel.appendChild(opt);
  });
}

// ── 하이라이트 ──
function highlight(text,kw){
  if(!kw||!text)return text||'-';
  const safe=kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return String(text).replace(new RegExp(safe,'gi'),m=>`<span class="hl">${m}</span>`);
}

// ── 레벤슈타인 + 유사도 ──
function levenshtein(a, b) {
  const m=a.length, n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i?j?0:i:j));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

function similarityScore(a, b) {
  const na=(a||'').replace(/\s/g,'').toLowerCase();
  const nb=(b||'').replace(/\s/g,'').toLowerCase();
  if(!na||!nb) return 0;
  const maxLen=Math.max(na.length,nb.length);
  if(maxLen===0) return 1;
  const dist=levenshtein(na,nb);
  return 1 - dist/maxLen;
}

// ── 전화번호 형식 자동 교정 ──
async function fixPhoneFormats() {
  if (!isPriv()) return;
  const { data } = await sb.from('prospects').select('id,phone').not('phone','is',null);
  const toFix = (data||[]).filter(r => {
    const cleaned = (r.phone||'').replace(/\D/g,'');
    return cleaned.length >= 9 && r.phone !== fmtPhone(cleaned);
  });
  if (!toFix.length) { alert('형식 오류 전화번호 없음 ✅'); return; }
  if (!confirm(`형식 오류 ${toFix.length}건을 자동 교정하시겠습니까?`)) return;
  for (const r of toFix) {
    await sb.from('prospects').update({phone: fmtPhone(r.phone.replace(/\D/g,''))}).eq('id',r.id);
  }
  alert(`✅ ${toFix.length}건 교정 완료`);
  loadList();
}

// ── 빠른 단계 변경 (목록, v1) ──
async function quickStageChange(id,stage,dropEl){
  dropEl.classList.remove('open');
  const updates={stage};
  if(stage==='계약완료'){updates.contracted_at=new Date().toISOString();}
  const{error}=await sb.from('prospects').update(updates).eq('id',id);
  if(!error){
    if(stage==='계약완료'){
      launchConfetti();
      const{data:p}=await sb.from('prospects').select('business_name,manager').eq('id',id).maybeSingle();
      if(p)sendKakaoWorkNotify('contract',{business_name:p.business_name,manager:p.manager,stage:'계약 완료'});
    }
    loadList();loadPipeline();
  }
}
