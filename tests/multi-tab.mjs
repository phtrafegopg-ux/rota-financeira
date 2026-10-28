/* Duas abas do mesmo contexto compartilham armazenamento; somente dados fictícios. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port=process.env.RF_TEST_PORT||'8769',url='http://127.0.0.1:'+port+'/index.html';
const server=spawn(process.env.PYTHON||'python3',['-m','http.server',port,'--bind','127.0.0.1'],{stdio:'ignore'});
await new Promise(resolve=>setTimeout(resolve,1100));
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();
 const first=await context.newPage(),second=await context.newPage();
 const errors=[],alerts=[];
 for(const page of [first,second]){
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>{alerts.push(d.message());return d.accept()});
 }
 const password='Abas-Cofre-Sintetico-2026!';
 await first.goto(url,{waitUntil:'networkidle'});
 await first.locator('[data-security="setup"] input[name="password"]').fill(password);
 await first.locator('[data-security="setup"] input[name="confirm"]').fill(password);
 await first.locator('[data-security="setup"] button[type="submit"]').click();
 await first.getByText('Meu painel pessoal').waitFor();
 async function tryUnlock(page,pass=password){
  await page.locator('[data-security="unlock"] input[name="password"]').fill(pass);
  await page.locator('[data-security="unlock"] button[type="submit"]').click();
  await page.waitForFunction(()=>Boolean(vaultKey)||document.querySelector('form[data-security="unlock"] button')?.disabled===false);
 }
 await second.goto(url,{waitUntil:'networkidle'});
 await tryUnlock(second);
 assert.equal(await second.evaluate(()=>vaultKey),null,'segunda aba deve continuar bloqueada');
 assert.ok(alerts.some(message=>message.includes('outra aba')),'explicar por que a segunda aba não abre');
 const imageFile=await first.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
  canvas.getContext('2d').fillRect(0,0,2,2);
  data.settings.name='GRAVADO_NA_PRIMEIRA_ABA';
  data.entries.push({id:'attach-test',type:'uber',date:dt(),gross:220,fuel:30,fee:15,other:5,platform:'Uber'});
  await save(true);return canvas.toDataURL('image/png');
 });
 await first.locator('.nav button[data-nav="entries"]').click();
 await first.locator('[data-action="proof"][data-id="attach-test"]').click();
 await first.locator('form[data-proof] input[type="file"]').setInputFiles({
  name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(imageFile.split(',')[1],'base64')
 });
 await first.evaluate(()=>{
  const original=packState;
  packState=async(...args)=>{const box=await original(...args);await new Promise(resolve=>window.releaseWrite=resolve);return box};
  window.uploadButton=document.querySelector('form[data-proof] button[type="submit"]');
 });
 await first.locator('form[data-proof] button[type="submit"]').click();
 await first.waitForFunction(()=>!!window.releaseWrite);
 const savedImage=await first.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef));
 await first.locator('.sheet button[data-action="close"]').click();
 await first.locator('button[data-nav="settings"]').first().click();
 await first.locator('[data-action="lock"]').click();
 await tryUnlock(second);
 assert.equal(await second.evaluate(()=>vaultKey),null,'gravação em andamento mantém a proteção entre abas');
 await first.evaluate(()=>window.releaseWrite());
 await first.waitForFunction(()=>window.uploadButton.disabled===false);
 assert.equal(await first.evaluate(()=>vaultKey),null,'confirmação tardia não reabre nem renderiza o cofre bloqueado');
 await tryUnlock(second);
 await second.getByText('Meu painel pessoal').waitFor();
 assert.equal(await second.evaluate(()=>data.settings.name),'GRAVADO_NA_PRIMEIRA_ABA','reabrir carrega versão atual');
 assert.equal(await second.evaluate(()=>window.rfSecurityStatus().dirty),true,'pendência criada em outra aba deve ser recuperada');
 assert.equal(await second.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef)),savedImage,'comprovante confirmado sobrevive ao bloqueio durante anexação');
 await second.locator('button[data-nav="settings"]').first().click();
 await second.locator('[data-action="lock"]').click();
 await tryUnlock(first,'Senha-Incorreta-2026!');
 assert.equal(await first.evaluate(()=>vaultKey),null,'senha errada não abre o cofre');
 await tryUnlock(second);
 await second.getByText('Meu painel pessoal').waitFor();
 await second.close();
 await tryUnlock(first);
 await first.getByText('Meu painel pessoal').waitFor();
 const fixture=await first.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2'));
 const unsupported=await browser.newContext();
 await unsupported.addInitScript(box=>{
  Object.defineProperty(navigator,'locks',{value:undefined});
  localStorage.setItem('rota_financeira_vault_v2',box);
 },fixture);
 const oldBrowser=await unsupported.newPage();
 oldBrowser.on('dialog',d=>{alerts.push(d.message());return d.accept()});
 await oldBrowser.goto(url,{waitUntil:'networkidle'});
 await tryUnlock(oldBrowser);
 assert.equal(await oldBrowser.evaluate(()=>vaultKey),null,'navegador sem coordenação não abre edição insegura');
 assert.equal(await oldBrowser.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2')),fixture);
 assert.ok(alerts.some(message=>message.includes('Atualize o navegador')));
 await unsupported.close();
 // As duas páginas mostram primeiro acesso antes que qualquer uma crie o cofre.
 const fresh=await browser.newContext(),creationPages=[await fresh.newPage(),await fresh.newPage()];
 for(const page of creationPages){
  page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.locator('[data-security="setup"] input[name="password"]').fill(password);
  await page.locator('[data-security="setup"] input[name="confirm"]').fill(password);
 }
 await Promise.all(creationPages.map(async page=>{
  await page.locator('[data-security="setup"] button[type="submit"]').click();
  await page.waitForFunction(()=>Boolean(vaultKey)||document.querySelector('form[data-security="setup"] button')?.disabled===false);
 }));
 const opened=await Promise.all(creationPages.map(page=>page.evaluate(()=>Boolean(vaultKey))));
 assert.equal(opened.filter(Boolean).length,1,'somente uma criação recebe acesso ao cofre');
 const winner=creationPages[opened.indexOf(true)],loser=creationPages[opened.indexOf(false)];
 const created=await winner.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2'));
 await winner.close();
 await loser.locator('[data-security="setup"] button[type="submit"]').click();
 await loser.locator('form[data-security="unlock"]').waitFor();
 assert.equal(await loser.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2')),created,'criação antiga não substitui cofre já criado');
 await tryUnlock(loser);await loser.getByText('Meu painel pessoal').waitFor();
 await fresh.close();
 // Uma falha ao gravar o primeiro cofre não pode deixar a reserva presa.
 const quotaContext=await browser.newContext(),failed=await quotaContext.newPage();
 failed.on('dialog',d=>d.accept());
 await failed.goto(url,{waitUntil:'networkidle'});
 await failed.evaluate(()=>{
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
   if(key==='rota_financeira_vault_v2')throw Error('QuotaExceededError');
   return original.call(this,key,value);
  };
 });
 await failed.locator('[data-security="setup"] input[name="password"]').fill(password);
 await failed.locator('[data-security="setup"] input[name="confirm"]').fill(password);
 await failed.locator('[data-security="setup"] button[type="submit"]').click();
 await failed.waitForFunction(()=>document.querySelector('form[data-security="setup"] button')?.disabled===false);
 assert.equal(await failed.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2')),null);
 assert.equal(await failed.evaluate(()=>vaultKey),null);
 const retry=await quotaContext.newPage();await retry.goto(url,{waitUntil:'networkidle'});
 await retry.locator('[data-security="setup"] input[name="password"]').fill(password);
 await retry.locator('[data-security="setup"] input[name="confirm"]').fill(password);
 await retry.locator('[data-security="setup"] button[type="submit"]').click();
 await retry.getByText('Meu painel pessoal').waitFor();
 await quotaContext.close();
 assert.deepEqual(errors,[]);
 console.log('PASS duas abas: edição exclusiva, fila preservada, liberação por bloqueio/fechamento/falha, criação concorrente e ausência da API sem perda de dados');
}finally{
 await browser?.close();server.kill();
}
