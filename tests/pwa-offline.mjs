/* Cofre e comprovante sintéticos: nenhum perfil pessoal ou serviço de produção. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'rf-pwa-test-'));
let browser,server;
try{
 const site=path.join(temporary,'rota-financeira');
 await fs.mkdir(site);
 for(const name of await fs.readdir('.')){
   if(/\.(html|js|css|svg|webmanifest)$/.test(name))await fs.copyFile(name,path.join(site,name));
 }
 const swFile=path.join(site,'sw.js'),source=await fs.readFile(swFile,'utf8');
 const oldCache=source.match(/const CACHE="([^"]+)"/)[1],nextCache=oldCache+'-test-next';
 server=spawn(process.env.PYTHON||'python3',[
   '-m','http.server','8768','--bind','127.0.0.1','--directory',temporary
 ],{stdio:'ignore'});
 await new Promise(resolve=>setTimeout(resolve,1100));
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();
 let page=await context.newPage();
 const errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:8768/rota-financeira/index.html';
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.locator('[data-security="setup"] input[name="password"]').fill('PWA-Cofre-Sintetico-2026!');
 await page.locator('[data-security="setup"] input[name="confirm"]').fill('PWA-Cofre-Sintetico-2026!');
 await page.locator('[data-security="setup"] button[type="submit"]').click();
 await page.getByText('Meu painel pessoal').waitFor();
 const image=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
   canvas.getContext('2d').fillRect(0,0,2,2);
   const image=canvas.toDataURL('image/png'),ref=proofRef();
   await proofStorePut(ref,image);
   data.entries.push({id:'offline-proof',type:'uber',date:dt(),gross:220,fuel:30,fee:15,other:5,
     platform:'Uber',proofs:[{imageRef:ref,sha256:'synthetic-proof'}]});
   await save(true);
   await caches.open('other-product-test');
   return image;
 });
 const storage=await page.evaluate(()=>JSON.stringify(localStorage));
 async function unlockAndCheck(){
   await page.locator('[data-security="unlock"] input[name="password"]').fill('PWA-Cofre-Sintetico-2026!');
   await page.locator('[data-security="unlock"] button[type="submit"]').click();
   await page.getByText('Meu painel pessoal').waitFor();
   assert.equal(await page.evaluate(()=>data.entries[0].id),'offline-proof');
   assert.equal(await page.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef)),image);
   assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),storage,'cofre e metadados preservados');
 }
 await context.setOffline(true);
 await page.reload({waitUntil:'networkidle'});
 await unlockAndCheck();
 await page.close();
 page=await context.newPage();
 await page.goto(url,{waitUntil:'networkidle'});
 await unlockAndCheck();
 console.log('PASS PWA: reabrir offline sob subdiretório preserva cofre e comprovante');

 // Exercita a ativação real do worker, sem alterar os arquivos do checkout.
 await context.setOffline(false);
 await fs.writeFile(swFile,source.replace(oldCache,nextCache));
 await page.evaluate(async()=>{
   const reg=await navigator.serviceWorker.ready;
   window.testRegistration=reg;
   await Promise.race([reg.update(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SW update timed out')),15000))]);
 });
 console.log('PASS PWA: verificação de nova versão concluída');
 await page.waitForFunction(()=>!!window.testRegistration.waiting);
 await page.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration(),worker=reg.waiting;
   if(!worker)throw Error('Missing waiting worker');
   await new Promise((resolve,reject)=>{
     setTimeout(()=>reject(Error('SW controller change timed out: '+JSON.stringify({
       active:reg.active?.state,waiting:reg.waiting?.state,controller:navigator.serviceWorker.controller?.state
     }))),15000);
     navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true});
     worker.postMessage({type:'SKIP_WAITING'});
   });
 });
 await page.waitForFunction(()=>window.testRegistration.active?.state==='activated');
 const names=await page.evaluate(()=>caches.keys());
 assert.ok(!names.includes(oldCache),'cache anterior removido');
 assert.ok(names.includes(nextCache),'nova versão em cache');
 assert.ok(names.includes('other-product-test'),'cache de outro produto preservado');
 await context.setOffline(true);
 await page.reload({waitUntil:'networkidle'});
 await unlockAndCheck();
 assert.deepEqual(errors,[],'sem erros JavaScript');
 console.log('PASS PWA: atualização remove cache antigo sem perder dados nem outros caches');
}finally{
 await browser?.close();
 server?.kill();
 await fs.rm(temporary,{recursive:true,force:true});
}
