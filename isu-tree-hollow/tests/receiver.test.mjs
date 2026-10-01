import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8');
const keys=['requestId','name','email','nationality','studentId','language','mood','message','audioUrl','consent'];
let rows=[Array(22).fill('header')], files=0, formSubmissions=0, failForm=false, responses=[];
class Range {
  constructor(row,col,h=1,w=1){Object.assign(this,{row,col,h,w});}
  getValues(){return Array.from({length:this.h},(_,i)=>Array.from({length:this.w},(_,j)=>rows[this.row-1+i]?.[this.col-1+j]??''));}
  setValues(values){values.forEach((record,i)=>{rows[this.row-1+i]??=[];record.forEach((value,j)=>rows[this.row-1+i][this.col-1+j]=value);});return this;}
  setValue(value){return this.setValues([[value]]);}
  setNumberFormat(){return this;}
  createTextFinder(id){return {matchEntireCell(){return this;},findNext(){const index=rows.findIndex((r,i)=>i>0&&r[0]===id);return index>=0?{getRow:()=>index+1}:null;}};}
}
const sheet={getLastRow:()=>rows.length,getRange:(...args)=>new Range(...args),appendRow:values=>rows.push(values)};
const form={
  getResponses:()=>responses,
  getItemById:id=>({asTextItem:()=>({createResponse:value=>({id,value})}),asParagraphTextItem:()=>({createResponse:value=>({id,value})})}),
  createResponse(){const answers=[];return {withItemResponse(answer){answers.push(answer);return this;},submit(){if(failForm)throw new Error('simulated outage');formSubmissions++;const id='response-'+formSubmissions;const r={getId:()=>id,getItemResponses:()=>answers.map(a=>({getItem:()=>({getId:()=>a.id}),getResponse:()=>a.value}))};responses.push(r);return r;}};}
};
const itemIds=Object.fromEntries(keys.map((k,i)=>[k,String(i+1)]));
const props={FORM_ID:'test-form',BOOK_ID:'test-book',AUDIO_FOLDER_ID:'test-folder',ITEM_IDS:JSON.stringify(itemIds)};
const context=createContext({console:{log(){}},Date,JSON,
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},
  FormApp:{openById:()=>form},
  DriveApp:{getFolderById:()=>({createFile:()=>{files++;return {getId:()=>`file-${files}`,getUrl:()=>`https://drive.google.com/file/d/file-${files}/view`};}})},
  Utilities:{formatDate:()=> '20261001',base64Decode:value=>[...Buffer.from(value,'base64')],newBlob:(bytes,mime,name)=>({bytes,mime,name})},
  LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},
  HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})}
});
runInContext(code,context);
function packet(result){const match=result.html.match(/const p=(.*?);const o=/);return JSON.parse(match[1]);}
function submit(data){return packet(context.doPost({parameter:{payload:JSON.stringify(data)}}));}
function payload(id='11111111-1111-4111-8111-111111111111') {return {requestId:id,origin:'https://weisfx0705.github.io',name:'Test Student',email:'student@example.com',nationality:'Vietnam',studentId:'',language:'Tiếng Việt',mood:'Homesick',message:'Em nhớ nhà.',consent:true,consentVersion:'2026-10-01'};}
let count=0;function test(name,run){run();count++;console.log('PASS '+name);}
test('text accepted with optional student ID empty',()=>{const p=submit(payload());assert.equal(p.ok,true);assert.equal(rows.length,2);assert.equal(rows[1][6],'');assert.equal(rows[1][19],'complete');assert.equal(formSubmissions,1);});
test('retry does not duplicate counseling record or form response',()=>{assert.equal(submit(payload()).ok,true);assert.equal(rows.length,2);assert.equal(formSubmissions,1);});
test('missing identity and consent are rejected without saving',()=>{for(const change of [{name:''},{email:''},{nationality:''},{email:'invalid'},{consent:false}])assert.equal(submit({...payload('22222222-2222-4222-8222-222222222222'),...change}).ok,false);assert.equal(rows.length,2);});
test('unexpected origin, empty content and malformed payload are rejected',()=>{assert.equal(submit({...payload(),origin:'https://untrusted.example'}).ok,false);assert.equal(submit({...payload(),message:''}).ok,false);assert.equal(submit(null).ok,false);assert.equal(packet(context.doPost({parameter:{payload:'bad json'}})).ok,false);});
test('audio-only m4a saves a private file and links it in the record',()=>{const data={...payload('33333333-3333-4333-8333-333333333333'),message:'',audio:{name:'voice.m4a',mimeType:'audio/mp4',base64:'AAAA'}};assert.equal(submit(data).ok,true);assert.equal(files,1);assert.match(rows[2][10],/^https:\/\/drive.google.com/);assert.equal(submit(data).ok,true);assert.equal(files,1);});
test('unsupported audio and over-sized encoded audio are rejected before writes',()=>{for(const audio of [{mimeType:'text/html',base64:'AAAA'},{mimeType:'audio/webm',base64:'A'.repeat(14*1024*1024)}])assert.equal(submit({...payload('44444444-4444-4444-8444-444444444444'),audio}).ok,false);assert.equal(files,1);});
test('partial form outage resumes without duplicating the audio file',()=>{failForm=true;const data={...payload('55555555-5555-4555-8555-555555555555'),audio:{mimeType:'audio/webm;codecs=opus',base64:'AAAA'}};assert.equal(submit(data).ok,false);assert.equal(files,2);assert.equal(rows[3][19],'saving');failForm=false;assert.equal(submit(data).ok,true);assert.equal(files,2);assert.equal(rows[3][19],'complete');});
test('spreadsheet formula text is escaped',()=>{assert.equal(submit({...payload('66666666-6666-4666-8666-666666666666'),message:'=IMPORTXML("example", "//x")'}).ok,true);assert.equal(rows[4][9].startsWith("'="),true);});
test('acknowledgement never exposes student data or private audio URLs',()=>{const result=context.doPost({parameter:{payload:JSON.stringify(payload())}}).html;assert.equal(result.includes('student@example.com'),false);assert.equal(result.includes('Em nhớ nhà'),false);assert.equal(result.includes('drive.google.com'),false);});
console.log(`${count} receiver checks passed (mocked Google services; no network calls).`);
