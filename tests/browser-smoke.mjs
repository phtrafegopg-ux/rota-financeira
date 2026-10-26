import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
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
 await page.locator('button[data-nav="settings"]').first().click();
 await page.getByText('Central de proteção').waitFor({timeout:10000});
 const checkbox=page.locator('#rfAutosync');
 await checkbox.check();
 assert.notEqual(await page.evaluate(()=>localStorage.getItem('rf_autobackup_optin_v31')),'1','Não pode ligar backup sem conta autenticada.');
 await page.reload({waitUntil:'networkidle'});
 await page.locator('[data-security="unlock"] input[name="password"]').fill('Cofre-Teste-Seguro-2026!');
 await page.locator('[data-security="unlock"] button[type="submit"]').click();
 await page.getByText('Meu painel pessoal').waitFor({timeout:15000});
 assert.equal(errors.length,0,'Erros de console JS: '+errors.join('; '));
 console.log('PASS Chrome mobile: cofre, senha, central, opção de backup, recarga.');
 await page.close();
} finally {
 await browser?.close();
 server.kill();
}