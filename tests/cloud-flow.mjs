import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const server=spawn(process.env.PYTHON || 'python3',['-m','http.server','8766','--bind','127.0.0.1'],{stdio:'ignore'});
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
   const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
   canvas.getContext('2d').fillRect(0,0,2,2);
   const image=canvas.toDataURL('image/png'),ref=proofRef();
   await proofStorePut(ref,image);
   data.entries.push({id:'proof-test',type:'uber',date:dt(),gross:220,fuel:30,fee:15,other:5,
     platform:'Uber',proofs:[{imageRef:ref,sha256:'synthetic-proof'}]});
   await save(true);
 });
 const originalImage=await page.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef));
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
 // Recuperação de backup em computador separado, sem prompt()/confirm().
 const secondContext=await browser.newContext({viewport:{width:1280,height:800}});
 let receiverUploads=0;
 await secondContext.addInitScript(()=>{
   window.prompt=()=>{throw Error("prompt() is not supported")};
   window.confirm=()=>{throw Error("confirm() is not supported")};
 });
 await secondContext.route("https://rota-test.supabase.co/**",async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/rest/v1/rpc/rf_write_vault'&&req.method()==='POST')receiverUploads++;
   const headers={
     "access-control-allow-origin":"*",
     "access-control-allow-methods":"GET,POST,OPTIONS",
     "access-control-allow-headers":"apikey, authorization, content-type, cache-control",
     "content-type":"application/json"
   };
   const reply=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
   if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
   if(url.pathname==="/auth/v1/token")
     return reply({access_token:"pc-login-jwt",refresh_token:"pc-refresh",expires_in:3600,user:{id:userA}});
   if(url.pathname==="/rest/v1/finance_vault")
     return reply([{revision:remoteRev,vault:remoteVault,updated_at:new Date().toISOString()}]);
   if(url.pathname==="/rest/v1/rf_subscriptions")return reply([]);
   if(url.pathname==="/rest/v1/rf_weekly_rankings")return reply([]);
   return reply({message:"Endpoint não simulado"},404);
 });
 const pc=await secondContext.newPage(),pcErrors=[];
 pc.on("pageerror",e=>pcErrors.push(e.message));
 await pc.goto("http://127.0.0.1:8766/index.html",{waitUntil:"networkidle"});
 await pc.locator('form[data-security="setup"] input[name="password"]').fill("Senha-PC-Temporaria-2026!");
 await pc.locator('form[data-security="setup"] input[name="confirm"]').fill("Senha-PC-Temporaria-2026!");
 await pc.locator('form[data-security="setup"] button[type="submit"]').click();
 await pc.getByText("Meu painel pessoal").waitFor({timeout:10000});
 await pc.evaluate(async()=>{data.settings.name="APENAS_PC_TEMPORARIO";await save(true)});
 await pc.locator('button[data-nav="settings"]').first().click();
 const loginPC=pc.locator('form[data-security="cloud"]');
 await loginPC.locator('[name="url"]').fill("https://rota-test.supabase.co");
 await loginPC.locator('[name="anon"]').fill("public-test-key");
 await loginPC.locator('[name="email"]').fill("teste@example.org");
 await loginPC.locator('[name="password"]').fill("Login-PC-2026!");
 await loginPC.locator('button[value="login"]').click();
 await pc.waitForFunction(()=>Boolean(cloudSession?.token),{timeout:10000});
 await pc.locator('[data-action="cloudDownload"]').click();
 const restore=pc.locator('form[data-cloud-restore]');
 await restore.waitFor({timeout:10000});
 await restore.locator('button[data-action="close"]').click();
 assert.equal(await pc.evaluate(()=>data.settings.name),"APENAS_PC_TEMPORARIO","cancelamento preserva PC");
 await pc.locator('[data-action="cloudDownload"]').click();
 await restore.locator('[name="originalPass"]').fill("senha-errada");
 await restore.locator('[name="ack"]').check();
 await restore.locator('button[type="submit"]').click();
 await restore.locator('#rf-restore-error').getByText(/Senha original incorreta/).waitFor({timeout:10000});
 assert.equal(await pc.evaluate(()=>data.settings.name),"APENAS_PC_TEMPORARIO","senha inválida preserva PC");
 await restore.locator('[name="originalPass"]').fill("Senha-Forte-Exclusiva-2026!");
 await restore.locator('button[type="submit"]').click();
 await pc.waitForFunction(()=>window.rfSecurityStatus?.().revision===1,{timeout:12000});
 assert.equal(await pc.evaluate(()=>data.settings.name),"SEGREDO_FINANCEIRO_QUE_NAO_PODE_VAZAR","cofre recuperado");
 assert.equal(await pc.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef)),originalImage,
   'comprovante recuperado em IndexedDB independente');
 assert.equal(await page.evaluate(()=>proofStoreRead(data.entries[0].proofs[0].imageRef)),originalImage,
   'restauração no PC preserva imagem do contexto original');
 assert.equal(uploads,1,'restauração no PC não envia backup');
 assert.equal(receiverUploads,0,'destinatário não tenta enviar nenhum backup');
 assert.equal(await restore.count(),0,"formulário fechado após sucesso");
 assert.equal(await pc.evaluate(()=>window.rfSecurityStatus().autoSync),false,"sem envio automático após recuperação");
 assert.equal(pcErrors.length,0,"erros no PC: "+pcErrors.join("; "));
 await secondContext.close();
 console.log("PASS — recuperação PC: cancelar, senha errada, senha certa, sem prompt e sem upload.");
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
 await page.locator('[data-secure="logout-cloud"]').click();
 assert.equal(await page.evaluate(()=>cloudSession),null,"Sair da nuvem apaga a sessão da memória");
 assert.equal(await page.evaluate(()=>Boolean(vaultKey)),true,"Sair da nuvem não destrava nem apaga cofre local");
 assert.equal(await page.evaluate(()=>window.rfSecurityStatus().autoSync),false,"Sem upload automático após logout");
 assert.equal(jsErrors.length,0,'Erros JavaScript: '+jsErrors.join('; '));
 console.log('PASS — login Supabase simulado, backup AES, JWT refresh, CAS e vínculo de conta.');
} finally {
 await browser?.close();
 server.kill();
}
