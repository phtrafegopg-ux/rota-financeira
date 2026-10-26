import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{stdio:'ignore'});
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
await sleep(1100);
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:860}});
 const jsErrors=[],alerts=[];
 page.on('pageerror',e=>jsErrors.push(e.message));
 page.on('dialog',async dialog=>{alerts.push(dialog.message());await dialog.accept()});
 let remoteRev=0,remoteVault=null,uploads=0,refreshes=0;
 const userA='11111111-1111-4111-8111-111111111111';
 await page.route('https://rota-test.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   const headers={
     'access-control-allow-origin':'*',
     'access-control-allow-methods':'GET,POST,OPTIONS',
     'access-control-allow-headers':'apikey, authorization, content-type, cache-control',
     'content-type':'application/json'
   };
   const reply=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
   if(url.pathname==='/auth/v1/token'){
     if(url.searchParams.get('grant_type')==='refresh_token'){
       refreshes++;
       return reply({access_token:'jwt-refresh-'+refreshes,refresh_token:'r2',expires_in:3600,user:{id:userA}});
     }
     return reply({access_token:'jwt-original',refresh_token:'r1',expires_in:3600,user:{id:userA}});
   }
   if(url.pathname==='/rest/v1/finance_vault'){
     return reply(remoteRev?[{revision:remoteRev,vault:remoteVault,updated_at:new Date().toISOString()}]:[]);
   }
   if(url.pathname==='/rest/v1/rpc/rf_write_vault'){
     const body=JSON.parse(req.postData()||'{}');
     uploads++;
     if(body.p_expected_revision!==remoteRev)return reply({message:'RF_REVISION_CONFLICT'},409);
     assert.equal(body.p_vault.schema,2,'cofre enviado criptografado');
     assert.equal(typeof body.p_vault.ciphertext,'string');
     remoteVault=body.p_vault;remoteRev++;
     return reply([{revision:remoteRev,updated_at:new Date().toISOString()}]);
   }
   if(url.pathname==='/rest/v1/rf_subscriptions')return reply([]);
   if(url.pathname==='/rest/v1/rf_weekly_rankings')return reply([]);
   return reply({message:'API desconhecida: '+url.pathname},404);
 });
 await page.goto('http://127.0.0.1:8766/index.html',{waitUntil:'networkidle'});
 await page.locator('form[data-security="setup"] input[name="password"]').fill('Senha-Forte-Exclusiva-2026!');
 await page.locator('form[data-security="setup"] input[name="confirm"]').fill('Senha-Forte-Exclusiva-2026!');
 await page.locator('form[data-security="setup"] button[type="submit"]').click();
 await page.getByText('Meu painel pessoal').waitFor();
 await page.locator('button[data-nav="settings"]').first().click();
 await page.getByText('Central de proteção').waitFor();
 // Alterações reais do cofre; a cópia enviada deve ser opaca.
 await page.evaluate(async()=>{
   data.settings.name='SEGREDO_FINANCEIRO_QUE_NAO_PODE_VAZAR';
   await save(true);
 });
 const cloud=page.locator('form[data-security="cloud"]');
 assert.equal(await cloud.count(),1);
 await cloud.locator('[name="url"]').fill('https://rota-test.supabase.co');
 await cloud.locator('[name="anon"]').fill('public-test-key');
 await cloud.locator('[name="email"]').fill('teste@example.org');
 await cloud.locator('[name="password"]').fill('Senha-Login-Diferente!');
 await cloud.locator('button[value="login"]').click();
 await page.waitForFunction(()=>!!cloudSession?.token,{timeout:10000});
 await page.locator('[data-secure="sync-now"]').click();
 await page.waitForFunction(()=>window.rfSecurityStatus?.().revision===1,{timeout:12000});
 assert.equal(uploads,1,'primeiro backup enviado uma única vez');
 assert.ok(!JSON.stringify(remoteVault).includes('SEGREDO_FINANCEIRO_QUE_NAO_PODE_VAZAR'),'dado não foi cifrado');
 assert.equal(await page.evaluate(()=>window.rfSecurityStatus().dirty),false);
 // Renova tokens vencidos sem armazená-los em localStorage.
 await page.evaluate(()=>{cloudSession.expiresAt=Date.now()-100});
 await page.evaluate(async()=>{await fetchCloudVault()});
 assert.equal(refreshes,1,'refresh de JWT por sessão em memória');
 const storage=await page.evaluate(()=>JSON.stringify(localStorage));
 assert.ok(!storage.includes('jwt-original')&&!storage.includes('"refreshToken"')&&!storage.includes('"r1"'),'tokens não gravados em armazenamento persistente');
 // Falha por revisão divergente impede sobrescrita.
 remoteRev=5;
 alerts.length=0;
 await page.locator('[data-secure="sync-now"]').click();
 await page.waitForFunction(()=>window.rfSecurityStatus().error.includes('CONFLITO'),{timeout:10000});
 assert.equal(uploads,1,'conflito não enviou nova gravação');
 assert.ok(alerts.some(x=>x.includes('CONFLITO')),'alerta de conflito exibido');
 // Mudança para outra conta não pode receber dados da primeira.
 await page.evaluate(()=>{cloudSession.user='22222222-2222-4222-8222-222222222222'});
 alerts.length=0;
 await page.locator('[data-secure="sync-now"]').click();
 await page.waitForFunction(()=>window.rfSecurityStatus().error.includes('outra conta'),{timeout:10000});
 assert.equal(uploads,1,'outro usuário não recebeu dados');
 assert.equal(jsErrors.length,0,'Erros JavaScript: '+jsErrors.join('; '));
 console.log('PASS — login Supabase simulado, backup AES, JWT refresh, CAS e vínculo de conta.');
} finally {
 await browser?.close();
 server.kill();
}
