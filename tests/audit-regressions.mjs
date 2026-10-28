/* Regressões da auditoria: perfil isolado, rede externa bloqueada, dados fictícios. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port=process.env.RF_TEST_PORT||'8770';
const server=spawn(process.env.PYTHON||'python3',['-m','http.server',port,'--bind','127.0.0.1'],{stdio:'ignore'});
await new Promise(resolve=>setTimeout(resolve,1100));
let browser,failures=0;
try{
 browser=await chromium.launch({headless:true});
 async function run(name,check){
  const context=await browser.newContext();
  try{
   await context.route('https://**/*',route=>route.abort());
   const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());
   await page.goto('http://127.0.0.1:'+port+'/index.html');
   await page.evaluate(()=>setup('Auditoria-Ficticia-2026!'));
   await check(page);console.log('PASS '+name);
  }catch(error){failures++;console.error('FAIL '+name+': '+error.message)}
  finally{await context.close()}
 }
 for(const interruption of ['lock','different vault'])await run('comprovante atrasado: '+interruption,async page=>{
  await page.evaluate(()=>{
   const entry={id:'proof',type:'uber',platform:'Teste fictício',date:dt(),gross:10,proofs:[{imageRef:'audit'}]};
   proofStoreRead=()=>new Promise(resolve=>window.releaseImage=resolve);
   window.viewing=viewProof(entry);
  });
  await page.evaluate(()=>{
   vaultKey=null;vaultSalt=null;data=initial();vaultPage();
  });
  if(interruption==='different vault'){
   await page.waitForFunction(async()=>!(await navigator.locks.query()).held.some(lock=>lock.name===VAULT));
   await page.evaluate(()=>unlock('Auditoria-Ficticia-2026!'));
  }
  await page.evaluate(async()=>{
   window.releaseImage('data:image/png;base64,AA==');await window.viewing;
  });
  assert.equal(await page.locator('#modalRoot img').count(),0);
 });
 await run('troca de senha marca backup pendente',async page=>{
  const result=await page.evaluate(async()=>{
   const old=localStorage.getItem(VAULT);
   await changeVaultPass({elements:{old:{value:'Auditoria-Ficticia-2026!'},password:{value:'Nova-Auditoria-Ficticia!'},confirm:{value:'Nova-Auditoria-Ficticia!'}},querySelector:()=>({disabled:false}),reset(){}});
   const box=JSON.parse(localStorage.getItem(VAULT));
   await decryptState(box,await deriveKey('Nova-Auditoria-Ficticia!',unbase64(box.salt)));
   return {changed:JSON.stringify(box)!==old,dirty:rfSecurityStatus().dirty,pending:!!localStorage.getItem('rf_local_unsynced_v40')};
  });
  assert.deepEqual(result,{changed:true,dirty:true,pending:true});
 });
 for(const defect of ['date','initialDate'])for(const encrypted of [false,true])await run('importação inválida preserva cofre: '+defect+' '+(encrypted?'cifrada':'legada'),async page=>{
  await page.locator('button[data-nav="settings"]').first().click();
  const before=await page.evaluate(()=>localStorage.getItem(VAULT));
  const payload=await page.evaluate(async({encrypted,defect})=>{
   const state=initial();
   if(defect==='date')state.entries=[{id:'bad',type:'income',date:null,amount:10}];
   else delete state.settings.initialDate;
   return encrypted?packState(state,vaultKey,vaultSalt):state;
  },{encrypted,defect});
  const alerts=[];
  page.removeAllListeners('dialog');page.on('dialog',dialog=>{alerts.push(dialog.message());return dialog.accept(dialog.type()==='prompt'?'Auditoria-Ficticia-2026!':undefined)});
  await page.locator('#importFile').setInputFiles({name:'invalido-ficticio.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await page.waitForFunction(()=>document.getElementById('importFile').value==='');
  assert.equal(await page.evaluate(()=>localStorage.getItem(VAULT)),before);
  assert.ok(alerts.some(message=>message.includes('Falha ao restaurar')));
 });
 await run('importação válida marca pendência e mantém compatibilidade',async page=>{
  await page.locator('button[data-nav="settings"]').first().click();
  const state=await page.evaluate(()=>({...initial(),entries:[{id:'income',date:dt(),type:'income',category:'Extra',amount:25}]}));
  await page.locator('#importFile').setInputFiles({name:'legado-ficticio.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
  await page.waitForFunction(()=>document.getElementById('importFile').value==='');
  assert.equal(await page.evaluate(()=>data.entries[0].amount),25);
  assert.equal(await page.evaluate(()=>rfSecurityStatus().dirty),true);
 });
 await run('migração inválida preserva os dados legados',async page=>{
  await page.evaluate(()=>{vaultKey=null;vaultSalt=null;data=initial();vaultPage()});
  await page.waitForFunction(async()=>!(await navigator.locks.query()).held.some(lock=>lock.name===VAULT));
  const result=await page.evaluate(async()=>{
   localStorage.removeItem(VAULT);
   const legacy=JSON.stringify({...initial(),entries:[null]});localStorage.setItem(STORE,legacy);
   let rejected=false;try{await setup('Nova-Senha-Ficticia!')}catch{rejected=true}
   return {rejected,preserved:localStorage.getItem(STORE)===legacy,created:!!localStorage.getItem(VAULT)};
  });
  assert.deepEqual(result,{rejected:true,preserved:true,created:false});
 });
 await run('upload atrasado preserva tela de bloqueio',async page=>{
  await page.evaluate(()=>{
   page='settings';render();getCloudCfg=()=>({url:'https://audit.invalid',anon:'public-ficticio'});
   cloudSession={user:'ficticio',token:'ficticio',refreshToken:'ficticio',expiresAt:Date.now()+3600000};
   window.fetch=url=>String(url).includes('/finance_vault?')?new Promise(resolve=>window.releaseFetch=resolve):Promise.resolve({ok:true,json:async()=>[]});
   window.uploading=cloudUpload();
  });
  await page.waitForFunction(()=>!!window.releaseFetch);
  await page.locator('[data-action="lock"]').click();
  await page.evaluate(async()=>{window.releaseFetch({ok:true,json:async()=>[]});await window.uploading});
  assert.equal(await page.evaluate(()=>vaultKey),null);
  assert.equal(await page.locator('form[data-security="unlock"]').count(),1);
 });
}finally{if(browser)await browser.close();server.kill()}
assert.equal(failures,0,'regressões da auditoria');
