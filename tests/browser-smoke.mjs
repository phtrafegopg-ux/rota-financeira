import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'rf-portable-test-'));
const server=spawn(process.env.PYTHON || 'python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await sleep(1300);
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:850},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'networkidle',timeout:30000});
 console.log("DIAG",JSON.stringify({url:page.url(),title:await page.title(),body:(await page.locator('body').innerText()).slice(0,600),errors,hasCrypto:await page.evaluate(()=>!!crypto?.subtle),scripts:await page.locator('script').count()}));
 await page.locator('[data-security="setup"] input[name="password"]').fill('Cofre-Teste-Seguro-2026!');
 await page.locator('[data-security="setup"] input[name="confirm"]').fill('Cofre-Teste-Seguro-2026!');
 await page.locator('[data-security="setup"] button[type="submit"]').click();
 await page.getByText('Meu painel pessoal').waitFor({timeout:15000});
 await page.getByText('Suas corridas em números').waitFor({timeout:10000});
 assert.equal(await page.locator('.rf-bar-col').count(),7,'Gráfico móvel precisa de sete barras');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,"Layout móvel não pode ter rolagem horizontal");
 await page.setViewportSize({width:1280,height:850});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,"Layout desktop não pode ter rolagem horizontal");
 assert.equal(await page.locator('.rf-insights').count(),1,"Card desktop preservado");
 await page.setViewportSize({width:390,height:850});
 assert.ok(!(await page.locator('#app').innerText()).includes('Bradesco'),'Não exibir dados financeiros de outro usuário');
 await page.evaluate(async()=>{
   data.entries.push({type:'uber',date:dt(),gross:220,fuel:30,fee:15,other:5,platform:'Uber'});
   await save(true);
   render();
 });
 assert.ok((await page.locator('.rf-insights').innerText()).includes('170,00'),'Indicador calcula receita líquida real');
 assert.ok(await page.evaluate(()=>!!localStorage.getItem('rf_local_unsynced_v40')),'Gravação local marca alteração pendente');
 await page.locator('button[data-nav="settings"]').first().click();
 await page.getByText('Central de proteção').waitFor({timeout:10000});
 const checkbox=page.locator('#rfAutosync');
 await checkbox.click();
 assert.notEqual(await page.evaluate(()=>localStorage.getItem('rf_autobackup_optin_v31')),'1','Não pode ligar backup sem conta autenticada.');
 await page.reload({waitUntil:'networkidle'});
 await page.locator('[data-security="unlock"] input[name="password"]').fill('Cofre-Teste-Seguro-2026!');
 await page.locator('[data-security="unlock"] button[type="submit"]').click();
 await page.getByText('Meu painel pessoal').waitFor({timeout:15000});
 assert.ok(await page.evaluate(()=>!!localStorage.getItem('rf_local_unsynced_v40')),'Pendências sobrevivem ao recarregamento');
 await page.locator('button[data-nav="settings"]').first().click();
 await page.getByText(/Há alterações locais/).waitFor({timeout:10000});
 await page.getByText('Seu plano Rota Financeira').waitFor();
 assert.ok((await page.locator('#rfBilling').innerText()).includes('Assinatura ainda indisponível'),'Sem checkout ativo');
 // Backup real pela interface, com prova cifrada no IndexedDB de origem.
 const image=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
   canvas.getContext('2d').fillRect(0,0,2,2);
   const image=canvas.toDataURL('image/png'),ref=proofRef();
   await proofStorePut(ref,image);
   data.entries[0].id='portable-test';
   data.entries[0].proofs=[{imageRef:ref,sha256:'synthetic-proof'}];
   await save(true);return image;
 });
 const downloadEvent=page.waitForEvent('download');
 await page.locator('[data-action="export"]').click();
 const file=path.join(temporary,'portable.json');
 await (await downloadEvent).saveAs(file);
 const payload=await fs.readFile(file,'utf8');
 assert.equal(JSON.parse(payload).schema,2);
 assert.ok(!payload.includes(image)&&!payload.includes('portable-test'),'arquivo sem dados claros');
 const receiver=await browser.newContext();
 const pc=await receiver.newPage();
 const pcErrors=[];pc.on('pageerror',e=>pcErrors.push(e.message));
 let password='senha-errada',cancel=false;
 pc.on('dialog',dialog=>dialog.type()==='prompt'?
   dialog.accept(password):dialog.type()==='confirm'&&cancel?dialog.dismiss():dialog.accept());
 await pc.goto('http://127.0.0.1:8765/index.html',{waitUntil:'networkidle'});
 await pc.locator('[data-security="setup"] input[name="password"]').fill('Cofre-Destino-Temporario!');
 await pc.locator('[data-security="setup"] input[name="confirm"]').fill('Cofre-Destino-Temporario!');
 await pc.locator('[data-security="setup"] button[type="submit"]').click();
 await pc.getByText('Meu painel pessoal').waitFor();
 await pc.locator('button[data-nav="settings"]').first().click();
 const destinationProof=await pc.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=3;canvas.height=3;
   const ctx=canvas.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,3,3);
   const image=canvas.toDataURL('image/png'),ref=proofRef();
   await proofStorePut(ref,image);
   data.entries.push({id:'destination-proof',type:'uber',date:dt(),gross:100,fuel:0,fee:0,other:0,
     platform:'Uber',proofs:[{imageRef:ref,sha256:'destination-synthetic-proof'}]});
   await save(true);return {ref,image};
 });
 const initial=await pc.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2'));
 async function importBackup(){
   await pc.locator('#importFile').setInputFiles(file);
   await pc.waitForFunction(()=>!document.getElementById('importFile')?.files.length);
 }
 await importBackup();
 assert.equal(await pc.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2')),initial,'senha errada preserva destino');
 assert.equal(await pc.evaluate(ref=>proofStoreRead(ref),destinationProof.ref),destinationProof.image,'senha errada preserva imagem do destino');
 password='Cofre-Teste-Seguro-2026!';cancel=true;
 await importBackup();
 assert.equal(await pc.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2')),initial,'cancelar preserva destino');
 assert.equal(await pc.evaluate(ref=>proofStoreRead(ref),destinationProof.ref),destinationProof.image,'cancelar preserva imagem do destino');
 cancel=false;await importBackup();
 assert.equal(await pc.evaluate(()=>data.entries[0].id),'portable-test');
 assert.equal(await pc.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef)),image);
 assert.equal(await page.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef)),image,'origem preservada');
 // Bloqueio durante derivação da senha não pode reabrir o cofre nem substituir dados.
 const beforeLock=await pc.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2'));
 await pc.evaluate(()=>{
   const original=deriveKey;
   deriveKey=async(...args)=>{await new Promise(resolve=>window.releaseImport=resolve);return original(...args)};
   const originalToast=toast;
   toast=message=>{window.importFinished=true;originalToast(message)};
   window.alert=()=>{window.importFinished=true};
 });
 await pc.locator('#importFile').setInputFiles(file);
 await pc.waitForFunction(()=>!!window.releaseImport);
 await pc.locator('[data-action="lock"]').click();
 await pc.evaluate(()=>window.releaseImport());
 await pc.waitForFunction(()=>window.importFinished);
 assert.equal(await pc.evaluate(()=>vaultKey),null,'importação tardia não reabre cofre bloqueado');
 assert.equal(await pc.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2')),beforeLock,'importação tardia preserva armazenamento');
 assert.deepEqual(pcErrors,[]);
 await receiver.close();
 // Imagem ausente deve impedir exportação incompleta, sem download falso.
 let badDownload=false;page.on('download',()=>badDownload=true);
 const beforeFailure=await page.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2'));
 await page.evaluate(async()=>{await proofStoreDelete(data.entries[0].proofs[0].imageRef)});
 const exportError=page.waitForEvent('dialog');
 await page.locator('[data-action="export"]').click();
 const errorDialog=await exportError;
 assert.match(errorDialog.message(),/Não foi possível preparar o backup completo/);
 await errorDialog.accept();
 assert.equal(badDownload,false,'não baixar backup incompleto');
 assert.equal(await page.evaluate(()=>localStorage.getItem('rota_financeira_vault_v2')),beforeFailure);
 assert.equal(errors.length,0,'Erros de console JS: '+errors.join('; '));
 console.log('PASS Chrome mobile: cofre, senha, central, opção de backup, recarga.');
 await page.close();
} finally {
 await browser?.close();
 server.kill();
 await fs.rm(temporary,{recursive:true,force:true});
}
