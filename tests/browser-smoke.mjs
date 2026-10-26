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
 await page.getByText('Suas corridas em números').waitFor({timeout:10000});
 assert.equal(await page.locator('.rf-bar-col').count(),7,'Gráfico móvel precisa de sete barras');
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
 await page.getByText('Há alterações locais aguardando').waitFor({timeout:10000});
 await page.getByText('Seu plano Rota Financeira').waitFor();
 assert.ok((await page.locator('#rfBilling').innerText()).includes('Assinatura ainda indisponível'),'Sem checkout ativo');
 assert.equal(errors.length,0,'Erros de console JS: '+errors.join('; '));
 console.log('PASS Chrome mobile: cofre, senha, central, opção de backup, recarga.');
 await page.close();
} finally {
 await browser?.close();
 server.kill();
}