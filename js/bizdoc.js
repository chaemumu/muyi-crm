// ── 사업자등록증: 업로드 → 흑백 WebP 압축 → AI 추출(biz-ocr) → 확인·수정 → 저장 ──
// 저장: business_registrations(텍스트) + storage biz-docs/{prospect_id}/{uuid}.webp(압축본, 비공개)
const BIZ_FIELDS=[
  ['brn','사업자등록번호'],['tax_type','과세 유형'],['company_name','상호'],['rep_name','대표자'],
  ['rep_birth','대표자 생년월일','date'],['open_date','개업일','date'],['address','사업장 주소'],
  ['biz_type','업태'],['biz_item','종목'],['liquor_no','주류판매신고번호'],
  ['issued_at','발급일','date'],['issuer','발급 세무서'],['email','이메일'],['tel','전화'],['fax','팩스'],
];
let _bizPending=null; // {blob, fields, checksum}

function bizBrnOk(brn){
  const d=String(brn||'').replace(/\D/g,'');if(d.length!==10)return false;
  const w=[1,3,7,1,3,7,1,3,5];let s=0;for(let i=0;i<9;i++)s+=+d[i]*w[i];
  s+=Math.floor(+d[8]*5/10);return (10-(s%10))%10===+d[9];
}
const bizEsc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function loadBizDoc(pid){
  const box=document.getElementById('bizDocBox');if(!box)return;
  box.innerHTML='<div class="biz-doc-h">사업자등록증</div><div class="biz-doc-empty">불러오는 중…</div>';
  const{data}=await sb.from('business_registrations').select('*').eq('prospect_id',pid).order('created_at',{ascending:false}).limit(1);
  if(curCrmId!=pid)return; // 그 사이 다른 업체로 이동
  const r=data?.[0];
  if(!r){
    box.innerHTML=`<div class="biz-doc-h">사업자등록증</div>
      <div class="biz-doc-empty">등록된 사업자등록증이 없습니다. 사진이나 PDF를 올리면 AI가 내용을 읽어 채워줍니다.</div>
      <button class="btn-s btn-sm" onclick="document.getElementById('bizDocInput').click()">📎 사업자등록증 업로드</button>`;
    return;
  }
  const row=(l,v)=>v?`<div class="biz-k">${l}</div><div class="biz-v">${bizEsc(v)}</div>`:'';
  box.innerHTML=`<div class="biz-doc-h">사업자등록증 <span class="biz-chk ${r.brn_checksum_ok?'ok':'bad'}">${r.brn_checksum_ok?'번호 검증됨':'번호 확인 필요'}</span></div>
    <div class="biz-grid">${row('등록번호',r.brn)}${row('상호',r.company_name)}${row('대표자',r.rep_name)}${row('생년월일',r.rep_birth)}${row('개업일',r.open_date)}${row('과세 유형',r.tax_type)}${row('업태',r.biz_type)}${row('종목',r.biz_item)}${row('주소',r.address)}${row('주류판매',r.liquor_no)}${row('연락처',[r.tel&&'T '+r.tel,r.fax&&'F '+r.fax,r.email].filter(Boolean).join(' · '))}${row('발급',[r.issued_at,r.issuer].filter(Boolean).join(' '))}</div>
    <div class="biz-actions">${r.file_path?`<button class="btn-g btn-sm" onclick="openBizDocFile('${bizEsc(r.file_path)}')">🖼 원본(압축본) 보기</button>`:''}
    <button class="btn-g btn-sm" onclick="document.getElementById('bizDocInput').click()">다시 업로드</button></div>`;
}

async function openBizDocFile(path){
  const{data,error}=await sb.storage.from('biz-docs').createSignedUrl(path,60);
  if(error){alert('파일을 열 수 없습니다: '+error.message);return}
  window.open(data.signedUrl,'_blank','noopener');
}

// 이미지/PDF → 흑백 WebP(가로 최대 1100px, 품질 0.45). 사업자등록증은 이 설정에서 글자가 선명히 읽힘
async function bizToCanvas(file){
  if(file.type==='application/pdf'){
    if(!window.pdfjsLib){
      await new Promise((ok,ng)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=ok;s.onerror=()=>ng(new Error('PDF 도구를 불러오지 못했습니다'));document.head.appendChild(s)});
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    const page=await pdf.getPage(1);const vp=page.getViewport({scale:1});const sc=Math.min(2.5,1100/vp.width);
    const v=page.getViewport({scale:sc});const c=document.createElement('canvas');c.width=v.width;c.height=v.height;
    await page.render({canvasContext:c.getContext('2d'),viewport:v}).promise;return c;
  }
  const img=await createImageBitmap(file);
  const sc=Math.min(1,1100/img.width);const c=document.createElement('canvas');
  c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c;
}
async function bizCompress(file){
  const c=await bizToCanvas(file);const ctx=c.getContext('2d');
  const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
  for(let i=0;i<d.length;i+=4){const y=d[i]*.299+d[i+1]*.587+d[i+2]*.114;d[i]=d[i+1]=d[i+2]=y}
  ctx.putImageData(im,0,0);
  let blob=await new Promise(r=>c.toBlob(r,'image/webp',.45));
  if(!blob||blob.type!=='image/webp')blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.6)); // WebP 미지원 브라우저
  return blob;
}
const bizB64=(blob)=>new Promise((ok,ng)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result).split(',')[1]);fr.onerror=ng;fr.readAsDataURL(blob)});

async function onBizDocFile(input){
  const file=input.files?.[0];input.value='';if(!file||!curCrmId)return;
  if(!/^image\/|application\/pdf/.test(file.type)){alert('이미지(JPG·PNG) 또는 PDF 파일만 올릴 수 있습니다');return}
  if(file.size>20*1024*1024){alert('20MB 이하 파일만 올릴 수 있습니다');return}
  const box=document.getElementById('bizDocBox');
  box.innerHTML='<div class="biz-doc-h">사업자등록증</div><div class="biz-doc-empty">압축하고 AI가 읽는 중… (10초 정도 걸려요)</div>';
  try{
    const blob=await bizCompress(file);
    const{data,error}=await sb.functions.invoke('biz-ocr',{body:{image_base64:await bizB64(blob),media_type:blob.type}});
    if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch(_){}throw new Error(m)}
    _bizPending={blob,fields:data.fields,unclear:data.fields.unclear||[],pid:curCrmId};
    openBizConfirm();
  }catch(e){
    alert('사업자등록증을 읽지 못했습니다: '+e.message);
  }
  loadBizDoc(curCrmId);
}

function openBizConfirm(){
  const p=_bizPending;const f=p.fields;
  document.getElementById('bizConfirmBody').innerHTML=`
    <div class="biz-preview"><img id="bizPrevImg" alt="사업자등록증 압축본"></div>
    <div class="biz-form">${BIZ_FIELDS.map(([k,l,t])=>`<label class="lbl ${p.unclear.includes(k)?'biz-unclear':''}">${l}${p.unclear.includes(k)?' <small>· 흐릿함, 확인 필요</small>':''}
      <input class="fi" id="bz_${k}" type="${t||'text'}" value="${bizEsc(f[k]||'')}" ${k==='brn'?'oninput="bizBrnHint()"':''}></label>`).join('')}
      <div id="bizBrnHint" class="biz-hint"></div>
      <div class="biz-hint">압축본 ${(p.blob.size/1024).toFixed(0)}KB · 비공개 저장(담당자·관리자만 열람)</div></div>`;
  document.getElementById('bizPrevImg').src=URL.createObjectURL(p.blob);
  bizBrnHint();
  document.getElementById('bizConfirmModal').style.display='flex';
}
function bizBrnHint(){
  const v=document.getElementById('bz_brn')?.value;const el=document.getElementById('bizBrnHint');if(!el)return;
  const ok=bizBrnOk(v);el.textContent=ok?'✅ 사업자등록번호 검증식 통과':'⚠️ 사업자등록번호가 검증식과 맞지 않습니다. 원본과 대조해 주세요.';el.className='biz-hint '+(ok?'ok':'bad');
}
function closeBizConfirm(){document.getElementById('bizConfirmModal').style.display='none';_bizPending=null}

async function saveBizDoc(){
  const p=_bizPending;if(!p)return;
  const btn=document.getElementById('bizSaveBtn');btn.disabled=true;btn.textContent='저장 중…';
  try{
    const row={prospect_id:p.pid,ocr_raw:p.fields};
    BIZ_FIELDS.forEach(([k])=>{const v=document.getElementById('bz_'+k).value.trim();row[k]=v||null});
    if(!row.brn)throw new Error('사업자등록번호는 필수입니다');
    row.brn_checksum_ok=bizBrnOk(row.brn);
    const ext=p.blob.type==='image/webp'?'webp':'jpg';
    const path=`${p.pid}/${crypto.randomUUID()}.${ext}`;
    const up=await sb.storage.from('biz-docs').upload(path,p.blob,{contentType:p.blob.type});
    if(up.error)throw new Error('파일 저장 실패: '+up.error.message);
    row.file_path=path;
    const{error}=await sb.from('business_registrations').insert([row]);
    if(error)throw new Error(error.message);
    closeBizConfirm();loadBizDoc(p.pid);
  }catch(e){alert('저장하지 못했습니다: '+e.message)}
  finally{btn.disabled=false;btn.textContent='저장'}
}
