/**
 * I-Shou Tree Hollow receiver — V8 Google Apps Script.
 * Creates NEW private records; never reads other Drive files or sends emails.
 * Deploy as Web app, execute as yourself, access Anyone.
 * Public doPost is write-only. Recordings remain private in Drive.
 */
const SETTINGS = {
  allowedOrigins: ['https://weisfx0705.github.io', 'http://127.0.0.1:4173', 'http://localhost:4173'],
  maxAudioBytes: 10 * 1024 * 1024,
  consentVersion: '2026-10-01'
};
const HEADERS = ['Request ID','Reference','Received (Taipei)','Name 姓名','Email','Nationality 國籍','Student ID 學號 (optional)','Reply language 回覆語言','Feeling 心情','Message 原文','Audio 錄音連結','Audio file ID','Form response ID','Transcript 逐字稿','Translation 中文摘要','Need / referral 需求與轉介','Status 處理狀態','Reply draft 回覆草稿','Replied at 回覆時間','Save state','Consent version','Consent 同意'];
const QUESTIONS = {
  requestId: 'Reference ID · 收件識別碼 · Mã tham chiếu',
  name: 'Name · 姓名 · Họ và tên',
  email: 'Email · 電子郵件 · Email',
  nationality: 'Nationality · 國籍 · Quốc tịch',
  studentId: 'Student ID (optional) · 學號（選填）· Mã số sinh viên (không bắt buộc)',
  language: 'Reply language · 回覆語言 · Ngôn ngữ phản hồi',
  mood: 'Feeling · 心情 · Cảm xúc',
  message: 'Your message · 想分享的事 · Lời nhắn',
  audioUrl: 'Audio recording · 錄音連結 · Bản ghi âm',
  consent: 'Consent · 資料用途同意 · Đồng ý sử dụng thông tin'
};

// Run once in the Apps Script editor. Running again reuses the same resources.
function setupTreeHollow() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_ID')) return showSetupLinks();
  const folder = DriveApp.createFolder('ISU Tree Hollow — private student support');
  const audioFolder = folder.createFolder('Private audio');
  const book = SpreadsheetApp.create('ISU Tree Hollow — 輔導紀錄');
  book.setSpreadsheetTimeZone('Asia/Taipei');
  DriveApp.getFileById(book.getId()).moveTo(folder);
  const records = book.getSheets()[0]; records.setName('Support records');
  records.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  records.getRange(1,1,1,HEADERS.length).setBackground('#315b45').setFontColor('#ffffff').setFontWeight('bold');
  records.setFrozenRows(1); records.setColumnWidth(10,330); records.setColumnWidth(14,330); records.setColumnWidth(15,330); records.setColumnWidth(18,330);
  const statuses = SpreadsheetApp.newDataValidation().requireValueInList(['New','Reviewing','Replied','Referred'],true).build();
  records.getRange(2,17,Math.max(records.getMaxRows()-1,1),1).setDataValidation(statuses);
  const form = FormApp.create('A Little Closer · 義守樹洞 · Hốc cây tâm sự');
  form.setDescription('Your language. Your words. Chia-Wei replies by email on weekends.\n用你熟悉的語言分享，Chia-Wei 會在週末以 Email 回覆。\nHãy dùng ngôn ngữ của bạn. Chia-Wei sẽ trả lời qua email vào cuối tuần.');
  form.setCollectEmail(false).setLimitOneResponsePerUser(false).setAllowResponseEdits(false).setPublishingSummary(false);
  if (form.supportsAdvancedResponderPermissions()) form.setPublished(true);
  form.setAcceptingResponses(true);
  const items = {};
  Object.keys(QUESTIONS).forEach(key => {
    const item = key === 'message' ? form.addParagraphTextItem() : form.addTextItem();
    item.setTitle(QUESTIONS[key]).setRequired(['name','email','nationality','consent'].includes(key));
    if (key === 'email') item.setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
    items[key] = String(item.getId());
  });
  form.setDestination(FormApp.DestinationType.SPREADSHEET,book.getId());
  form.setConfirmationMessage('Thank you. Chia-Wei will reply on the weekend.\n謝謝你的分享，我會在週末回覆。\nCảm ơn bạn. Chia-Wei sẽ trả lời vào cuối tuần.');
  DriveApp.getFileById(form.getId()).moveTo(folder);
  props.setProperties({FORM_ID:form.getId(), BOOK_ID:book.getId(), AUDIO_FOLDER_ID:audioFolder.getId(), FOLDER_ID:folder.getId(), ITEM_IDS:JSON.stringify(items)});
  return showSetupLinks();
}

// Logs only document URLs; never logs student submissions or credentials.
function showSetupLinks() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('FORM_ID')) throw new Error('Run setupTreeHollow first.');
  const links = {records:SpreadsheetApp.openById(p.getProperty('BOOK_ID')).getUrl(), form:FormApp.openById(p.getProperty('FORM_ID')).getEditUrl(), audio:DriveApp.getFolderById(p.getProperty('AUDIO_FOLDER_ID')).getUrl()};
  console.log(JSON.stringify(links)); return links;
}

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><html><body><p>Tree Hollow receiver is online. Submit from the student page.</p></body></html>');
}

function doPost(e) {
  let data = {}, lock = null;
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (typeof raw !== 'string' || raw.length > 14500000) throw new Error('invalid_payload');
    data = JSON.parse(raw); validatePayload(data);
    lock = LockService.getScriptLock(); lock.waitLock(10000);
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('FORM_ID')) throw new Error('not_configured');
    const book = SpreadsheetApp.openById(props.getProperty('BOOK_ID'));
    const sheet = book.getSheetByName('Support records');
    let row = findRecord(sheet,data.requestId);
    let values = row ? sheet.getRange(row,1,1,HEADERS.length).getValues()[0] : null;
    if (values && values[19] === 'complete') return reply(data.origin,{ok:true,requestId:data.requestId,receipt:values[1]});
    const now = new Date();
    const receipt = values ? values[1] : 'TH-' + Utilities.formatDate(now,'Asia/Taipei','yyyyMMdd') + '-' + data.requestId.slice(0,8).toUpperCase();
    if (!row) {
      enforceRateLimit(sheet,data.email,now);
      const cells = [data.requestId,receipt,now,data.name,data.email,data.nationality,data.studentId,data.language,data.mood,data.message,'','','','','','','New','','','saving',data.consentVersion,'Agreed'];
      sheet.appendRow(cells.map(safeCell)); row = sheet.getLastRow();
      sheet.getRange(row,3).setNumberFormat('yyyy-mm-dd hh:mm:ss');
      values = sheet.getRange(row,1,1,HEADERS.length).getValues()[0];
    }
    // Save intermediate IDs so a retry reuses an existing recording and response.
    let audioUrl = values[10] || '';
    if (data.audio && !values[11]) {
      const bytes = Utilities.base64Decode(data.audio.base64);
      if (!bytes.length || bytes.length > SETTINGS.maxAudioBytes) throw new Error('invalid_audio');
      const mime = data.audio.mimeType.split(';')[0];
      const extensions = {'audio/webm':'webm','video/webm':'webm','audio/mp4':'m4a','video/mp4':'m4a','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','application/ogg':'ogg','audio/aac':'aac','audio/flac':'flac','audio/x-flac':'flac'};
      const file = DriveApp.getFolderById(props.getProperty('AUDIO_FOLDER_ID')).createFile(Utilities.newBlob(bytes,mime,receipt+'.'+extensions[mime]));
      // No link sharing is enabled: the teacher opens the audio with their own account.
      audioUrl = file.getUrl(); sheet.getRange(row,11,1,2).setValues([[audioUrl,file.getId()]]);
    }
    if (!values[12]) {
      const form = FormApp.openById(props.getProperty('FORM_ID'));
      const ids = JSON.parse(props.getProperty('ITEM_IDS'));
      // Reconcile a response saved just before an interrupted spreadsheet update.
      const since = new Date(new Date(values[2]).getTime()-10000);
      const existing = form.getResponses(since).find(response => response.getItemResponses().some(item => String(item.getItem().getId()) === ids.requestId && item.getResponse() === data.requestId));
      let responseId;
      if (existing) responseId = existing.getId();
      else {
        let response = form.createResponse();
        const answers = Object.assign({},data,{audioUrl,consent:'Agreed · 同意 · Đồng ý'});
        Object.keys(QUESTIONS).forEach(key => {
          const value = String(answers[key] || ''); const item = form.getItemById(Number(ids[key]));
          response = response.withItemResponse(key === 'message' ? item.asParagraphTextItem().createResponse(value) : item.asTextItem().createResponse(value));
        });
        responseId = response.submit().getId();
      }
      sheet.getRange(row,13).setValue(responseId);
    }
    sheet.getRange(row,20).setValue('complete'); SpreadsheetApp.flush();
    return reply(data.origin,{ok:true,requestId:data.requestId,receipt});
  } catch (_) {
    // Do not expose errors, identifiers, student text, file contents or account details.
    const origin = data && SETTINGS.allowedOrigins.includes(data.origin) ? data.origin : SETTINGS.allowedOrigins[0];
    return reply(origin,{ok:false,requestId:data && typeof data.requestId === 'string' ? data.requestId : '',code:'not_saved'});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}

function validatePayload(data) {
  if (!data || !SETTINGS.allowedOrigins.includes(data.origin) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.requestId || '')) throw new Error('invalid_request');
  const required = {name:100,email:254,nationality:100};
  Object.keys(required).forEach(key => { if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > required[key]) throw new Error('invalid_identity'); });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('invalid_email');
  const optional = {studentId:40,language:80,mood:100,message:10000};
  Object.keys(optional).forEach(key => { if (typeof data[key] !== 'string' || data[key].length > optional[key]) throw new Error('invalid_text'); });
  if (data.consent !== true || data.consentVersion !== SETTINGS.consentVersion) throw new Error('consent_required');
  if (!data.message.trim() && !data.audio) throw new Error('empty_message');
  if (data.audio) {
    const a = data.audio;
    const allowed = /^(audio\/(webm|mp4|mpeg|mp3|wav|x-wav|ogg|aac|flac|x-flac)|video\/(webm|mp4)|application\/ogg)(;[^\r\n]*)?$/;
    if (typeof a.mimeType !== 'string' || !allowed.test(a.mimeType) || typeof a.base64 !== 'string' || !a.base64 || a.base64.length > Math.ceil(SETTINGS.maxAudioBytes/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(a.base64)) throw new Error('invalid_audio');
  }
}
function safeCell(value) { return typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? "'"+value : value; }
function findRecord(sheet,id) {
  if (sheet.getLastRow() < 2) return null;
  const cell = sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : null;
}
function enforceRateLimit(sheet,email,now) {
  if (sheet.getLastRow()<2) return;
  const rows = sheet.getRange(2,3,sheet.getLastRow()-1,3).getValues();
  const recent = rows.filter(row => String(row[2]).toLowerCase()===email.toLowerCase() && now.getTime()-new Date(row[0]).getTime()<3600000);
  if (recent.length>=20) throw new Error('try_later');
}
function reply(origin,result) {
  const packet = JSON.stringify(Object.assign({type:'tree-hollow-result'},result)).replace(/</g,'\\u003c');
  const target = JSON.stringify(origin).replace(/</g,'\\u003c');
  // This iframe contains only an acknowledgement, never a record or recording URL.
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><p>Request processed.</p><script>const p='+packet+';const o='+target+';window.top.postMessage(p,o);let n=0;const t=setInterval(()=>{window.top.postMessage(p,o);if(++n===8)clearInterval(t);},250);</script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
