/** Native Tauri WebDriver smoke test. Start under Xvfb on Linux. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const executable=resolve('src-tauri/target/release',process.platform==='win32'?'verso.exe':'verso');
const driver=spawn('tauri-driver',['--port','4444'],{stdio:['ignore','pipe','pipe']});
let logs='';driver.stdout.on('data',value=>logs+=value);driver.stderr.on('data',value=>logs+=value);driver.on('error',error=>logs+=String(error));
const origin='http://127.0.0.1:4444';
let session;
await mkdir('artifacts',{recursive:true});
async function call(path,body,method='POST'){
 const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json();if(!response.ok||result.value?.error)throw Error(JSON.stringify(result));return result.value;
}
async function until(action){const deadline=Date.now()+90000;let last;while(Date.now()<deadline){try{const value=await action();if(value)return value;}catch(error){last=error;}await new Promise(done=>setTimeout(done,300));}throw Error(`Native wait timed out: ${last??logs}`);}
const execute=(script,args=[])=>call(`/session/${session}/execute/sync`,{script,args});
try{
 await until(async()=>{try{await fetch(origin+'/status');return true;}catch{return false;}});
 const created=await call('/session',{capabilities:{alwaysMatch:{'tauri:options':{application:executable}}}});session=created.sessionId;assert(session);
 await until(()=>execute("return document.querySelector('.status-row [role=status]')?.textContent === 'Bereit für deinen Text'"));
 await execute("const e=document.querySelector('textarea[aria-label=Eingabe]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,arguments[0]);e.dispatchEvent(new Event('input',{bubbles:true}));",['[ti:Native]\n[ar:CI]\n[00:01.200]<00:01.200>Hello <00:01.800>world']);
 await until(()=>execute("return document.querySelector('textarea[aria-label=Ergebnis]')?.value.includes('start_ms: 1200') && document.querySelector('.status-row [role=status]')?.textContent === 'Konvertierung bereit'"));
 const output=await execute("return document.querySelector('textarea[aria-label=Ergebnis]').value");assert(output.includes('words:'));assert(output.includes('Native'));
 assert.equal(await execute("return document.querySelectorAll('img').length"),0);
 const image=await call(`/session/${session}/screenshot`,undefined,'GET');await writeFile(`artifacts/native-${process.platform}.png`,Buffer.from(image,'base64'));
 await writeFile(`artifacts/native-${process.platform}.json`,JSON.stringify({status:'passed',platform:process.platform,checks:['native-start','worker-wasm-under-csp','live-conversion','word-timing','no-logo'],nativeDialogs:'not automated'},null,2));
 console.log('PASS: native Tauri starts and converts through its actual WebView/worker/CSP.');
}finally{
 if(session)await call(`/session/${session}`,undefined,'DELETE').catch(()=>{});
 driver.kill();await writeFile(`artifacts/tauri-driver-${process.platform}.log`,logs);
}
