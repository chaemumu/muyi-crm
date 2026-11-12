/**
 * MUYI CRM → 구글 드라이브 매일 백업 (Google Apps Script)
 *
 * 설치 (한 번만):
 *  1. https://script.google.com → 새 프로젝트 → 이 파일 내용을 전부 붙여넣고 저장
 *  2. 왼쪽 ⚙️ 프로젝트 설정 → 스크립트 속성 → 속성 추가
 *       이름: BACKUP_KEY   값: Supabase Secret BACKUP_KEY와 같은 값
 *  3. 상단 함수 선택에서 setup 선택 → ▶ 실행 → 권한 허용 (드라이브·외부 요청)
 *     → 매일 새벽 3~4시 자동 실행 등록 + 첫 백업 1회 실행
 *
 * 결과: 내 드라이브 / MUYI CRM 백업 /
 *         db/        crm-YYYY-MM-DD.json.gz   (최근 KEEP_DAYS일 보관)
 *         biz-docs/  {업체ID}_{파일명}.webp     (사업자등록증 압축본, 새 파일만 추가 — 삭제 안 함)
 * 실패하면 구글이 계정 메일로 오류 알림을 보냅니다.
 */
const CONFIG = {
  URL: 'https://npkpxlbcwmwlxqauevyv.supabase.co/functions/v1/backup-export',
  ROOT: 'MUYI CRM 백업',
  KEEP_DAYS: 30,
};

function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'runBackup')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runBackup').timeBased().everyDays(1).atHour(3).inTimezone('Asia/Seoul').create();
  runBackup();
}

function runBackup() {
  const key = PropertiesService.getScriptProperties().getProperty('BACKUP_KEY');
  if (!key) throw new Error('스크립트 속성 BACKUP_KEY가 없습니다 (설치 2단계)');

  const res = UrlFetchApp.fetch(CONFIG.URL, {
    method: 'post',
    headers: { 'x-backup-key': key },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('백업 서버 응답 ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  const body = res.getContentText();
  const data = JSON.parse(body);

  const root = folder_(DriveApp.getRootFolder(), CONFIG.ROOT);
  const dbDir = folder_(root, 'db');
  const docDir = folder_(root, 'biz-docs');

  // 1) DB 전체 (gzip)
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const name = 'crm-' + day + '.json.gz';
  const old = dbDir.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true); // 같은 날 재실행 시 덮어쓰기
  dbDir.createFile(Utilities.gzip(Utilities.newBlob(body, 'application/json', 'crm-' + day + '.json'), name));

  // 2) 사업자등록증 압축본: 아직 없는 파일만 내려받기
  let added = 0;
  (data.files || []).forEach((f) => {
    const fname = f.path.replace('/', '_');
    if (docDir.getFilesByName(fname).hasNext()) return;
    const r = UrlFetchApp.fetch(f.url, { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) { docDir.createFile(r.getBlob().setName(fname)); added++; }
  });

  // 3) 오래된 DB 백업 정리 (사업자등록증 파일은 지우지 않음)
  const cutoff = Date.now() - CONFIG.KEEP_DAYS * 864e5;
  const it = dbDir.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true); }

  if ((data.errors || []).length) throw new Error('일부 테이블 백업 실패: ' + data.errors.join(' / '));
  console.log('백업 완료', day, JSON.stringify(data.counts), '새 사업자등록증 ' + added + '건');
}

function folder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
