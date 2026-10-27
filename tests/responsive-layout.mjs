/* Testes de responsividade do Rota Financeira.
   Navega com dados fictícios, sem conta Supabase nem operações de produção. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server=spawn(process.env.PYTHON || 'python3',['-m','http.server','8767','--bind','127.0.0.1'],{stdio:'ignore'});
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
await wait(1100);
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:8767/index.html',{waitUntil:'networkidle',timeout:30000});
 await page.locator('form[data-security="setup"] input[name="password"]').fill('Teste-Layout-Responsivo-2026!');
 await page.locator('form[data-security="setup"] input[name="confirm"]').fill('Teste-Layout-Responsivo-2026!');
 await page.locator('form[data-security="setup"] button[type="submit"]').click();
 await page.getByText('Meu painel pessoal').waitFor({timeout:15000});
 const initial=await page.evaluate(()=>JSON.stringify(data));

 async function check(name,w){
   const issues=await page.evaluate(()=>{
     const limit=window.innerWidth,found=[];
     const select=sel=>[...document.querySelectorAll(sel)];
     if(document.documentElement.scrollWidth>limit+2)
       found.push('scrollWidth='+document.documentElement.scrollWidth+' vs viewport='+limit);
     if(document.body.scrollWidth>limit+2)
       found.push('body.scrollWidth='+document.body.scrollWidth);
     for(const el of select('#app>.panel,#app>.monthstrip,#app>.head,.nav,.modalwrap .sheet,.seg,.formgrid,.tiles,.rf-insights,.rf-plan-options')){
       if(!el.getClientRects().length)continue;
       const r=el.getBoundingClientRect();
       if(r.left<-2||r.right>limit+2)found.push('box('+el.className+') '+Math.round(r.left)+'..'+Math.round(r.right));
     }
     for(const el of select('.entry-seg button,.entry-tab-label,.nav button,.nav-label,.seg button,.field input,.field select,.field textarea,.rf-kpi,.rf-security-summary>div')){
       if(!el.getClientRects().length||el.clientWidth===0)continue;
       if(el.scrollWidth>el.clientWidth+3){
         const item=el.className||el.tagName;
         found.push('inner scroll('+item+') '+el.scrollWidth+'>'+el.clientWidth);
       }
     }
     if(document.querySelector('.entry-seg')){
       const tabs=select('.entry-seg>button');
       if(tabs.length!==3)found.push('wrong entry tabs: '+tabs.length);
       if(tabs.some(x=>!x.querySelector('.entry-tab-label')))found.push('missing tab text label');
     }
     return [...new Set(found)].slice(0,20);
   });
   assert.equal(issues.length,0,name+' '+w+'px: '+issues.join(' | '));
 }
 const widths=[280,320,360,375,390,412,480,600,768,820,1024,1366,1920,2560];
 const views=['home','entries','bills','goals','league','history','settings'];
 fs.mkdirSync('test-results',{recursive:true});
 for(const w of widths){
   await page.setViewportSize({width:w,height:w<=480?740:w<=1024?900:1080});
   for(const view of views){
     if(view==='settings')await page.locator('.head button[data-nav="settings"]').click();
     else await page.locator('.nav button[data-nav="'+view+'"]').click();
     await check(view,w);
     if(view==='entries'){
       const first=page.locator('.entry-seg button[data-mode="uber"]');
       assert.equal(await first.getAttribute('aria-label'),'Corridas e entregas');
       assert.ok(await first.locator('.entry-tab-label').isVisible(),'rótulo visível');
       if(w===390||w===768)await page.screenshot({path:'test-results/entrada-'+w+'.png',fullPage:true});
       await page.locator('.entry-seg button[data-mode="expense"]').click();
       await check('expense',w);
       await page.locator('.entry-seg button[data-mode="income"]').click();
       await check('income',w);
       await page.locator('.entry-seg button[data-mode="uber"]').click();
     }
     if(view==='home'&&w===1920)await page.screenshot({path:'test-results/inicio-1920.png',fullPage:true});
   }
   console.log('PASS '+w+'px: '+views.length+' telas, abas e sem overflow horizontal');
 }
 for(const w of [320,390,768,1366]){
   await page.setViewportSize({width:w,height:880});
   await page.locator('.nav button[data-nav="bills"]').click();
   await page.locator('button[data-action="newBill"]').click();
   await page.locator('.sheet form[data-form="bill"]').waitFor();
   await check('modal nova conta',w);
   await page.locator('.sheet button[data-action="close"]').click();
 }
 assert.equal(await page.evaluate(()=>JSON.stringify(data)),initial,'Navegação e resize não podem alterar dados do cofre');
 assert.deepEqual(errors,[],'erros JavaScript');
 console.log('PASS todos os tamanhos, menus, abas, modais e dados preservados');
}finally{
 await browser?.close();
 server.kill();
}
