/* Rota Financeira 3.1 - camada de sincronização segura.
   Sem credenciais privadas no cliente. Requer supabase/01_seguro.sql. */
(function() {
 "use strict";
 const OPT="rf_autobackup_optin_v31",BASE="rf_revision_anchor_v31";
 let dirty=false, timer=null, busy=false, lastError="",remoteRevision=null,mutationSeq=0;
 let refreshInFlight=null;
 const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
 const cloudIdentity=()=>{const c=getCloudCfg();return cloudSession&&c.url?c.url+"|"+cloudSession.user:null};
 const anchor=()=>{const k=cloudIdentity();const a=readJSON(BASE,null);return k&&a?.identity===k?a:null};
 const boundToAnotherAccount=()=>{const old=readJSON(BASE,null)?.identity;return !!old&&old!==cloudIdentity()};

 const setAnchor=rev=>{const id=cloudIdentity();if(id)localStorage.setItem(BASE,JSON.stringify({identity:id,revision:rev,at:new Date().toISOString()}));remoteRevision=rev};
 const enabled=()=>Boolean(cloudIdentity())&&localStorage.getItem(OPT)===cloudIdentity();
 const statusText=()=>{
   if(!cloudSession)return "Desconectado: dados só neste aparelho.";
   if(lastError)return "Atenção: "+lastError;
   if(!enabled())return "Conectado. Backup automático desativado.";
   return "Conectado. Backup automático ativo enquanto o aplicativo estiver aberto.";
 };
 const oldSettings=renderSettings;
 renderSettings=function(){
   const html=oldSettings().replace("A sincronização é manual nesta versão: envie depois das alterações e restaure em outros aparelhos.", "O backup automático pode ser ativado abaixo após entrar na nuvem. Você também pode exportar um backup manual criptografado.");
   const checked=enabled()?'checked':'';
   const ready=Boolean(cloudSession);
   return html+
     '<section class="panel" id="rf-security-center"><div class="row start"><h2 class="h2">🛡️ Central de proteção</h2><span class="rf-badge">Versão 3.1</span></div>'+
     '<div class="rf-security-summary"><div><strong>Criptografia local</strong><span>AES-GCM no dispositivo</span></div>'+
     '<div><strong>Conta em nuvem</strong><span>'+(ready?'Sessão ativa':'Login necessário')+'</span></div>'+
     '<div><strong>Sincronização</strong><span>'+(enabled()?'Ao editar, quando conectado':'Desativada')+'</span></div>'+
     '<div><strong>Conflitos</strong><span>Bloqueio de sobrescrita (RPC)</span></div></div>'+
     '<div class="notice '+(lastError?'rf-risk':'mint-note')+'">'+esc(statusText())+'</div>'+
     '<label class="field" style="display:flex;flex-direction:row;align-items:center;gap:12px">'+
       '<input id="rfAutosync" type="checkbox" style="width:22px;height:22px" '+checked+'>'+
       '<span>Backup automático criptografado ao registrar alterações</span></label>'+
     '<p class="rf-hint">Requer seu projeto Supabase configurado com o SQL de segurança e login na seção Nuvem. Não envia seus dados antes da autenticação. A senha do cofre nunca é transmitida. Nunca envia dinheiro ou dados sem sua ação.</p>'+
     '<p class="rf-hint">Por segurança, ao fechar o app a sessão de nuvem termina. Ao reabrir, desbloqueie o cofre e entre na nuvem novamente. Não use dois aparelhos ao mesmo tempo sem revisar as alterações: conflitos são bloqueados, nunca mesclados silenciosamente.</p>'+
     '<div class="btnrow"><button class="btn secondary grow" data-secure="sync-now">↑ Sincronizar agora</button>'+
     '<button class="btn outline grow" data-secure="check-sync">Verificar conexão</button></div></section>';
 };

 // Tokens de acesso e atualização somente em memória; jamais em localStorage.
 function authHeaders(cfg, token){
   return {"apikey":cfg.anon,"Authorization":"Bearer "+(token||cfg.anon),"Content-Type":"application/json"};
 }
 function setSession(body){
   if(!body?.access_token||!body?.refresh_token||!body?.user?.id)throw Error("Resposta de autenticação incompleta.");
   cloudSession={
     token:body.access_token,
     user:body.user.id,
     refreshToken:body.refresh_token,
     expiresAt:Date.now()+Math.max(1,Number(body.expires_in)||3600)*1000
   };
 }
 async function ensureSession(){
   if(!vaultKey)throw Error("Desbloqueie o cofre antes de acessar a nuvem.");
   if(!cloudSession?.user)throw Error("Entre na sua conta de nuvem.");
   if(Date.now() < (cloudSession.expiresAt||0)-60000)return;
   if(!cloudSession.refreshToken)throw Error("Sessão expirada. Entre novamente.");
   if(!refreshInFlight){
     refreshInFlight=(async()=>{
       const cfg=getCloudCfg();
       const res=await fetch(cfg.url+"/auth/v1/token?grant_type=refresh_token",{
         method:"POST",
         headers:authHeaders(cfg),
         body:JSON.stringify({refresh_token:cloudSession.refreshToken}),
         cache:"no-store"
       });
       const body=await res.json().catch(()=>({}));
       if(!res.ok||!body.access_token){
         cloudSession=null;
         throw Error("Sua sessão de nuvem expirou. Entre novamente.");
       }
       const previousUser=cloudSession.user;
       setSession(body);
       if(cloudSession.user!==previousUser){
         cloudSession=null;
         throw Error("Conta alterada inesperadamente. Entre novamente.");
       }
     })().finally(()=>{refreshInFlight=null});
   }
   return refreshInFlight;
 }
 window.rfEnsureAuth=ensureSession;
 const originalVaultPage=vaultPage;
 vaultPage=function(){
   cloudSession=null;
   refreshInFlight=null;
   originalVaultPage();
 };
 async function apiFetch(path, options={}){
   await ensureSession();
   const cfg=getCloudCfg();
   if(!cfg?.url||!cfg?.anon)throw Error("Configure a nuvem em Ajustes.");
   const r=await fetch(cfg.url+path,{
     ...options,cache:"no-store",
     headers:{...cloudHeaders(cloudSession.token),...(options.headers||{})}
   });
   const json=await r.json().catch(()=>({}));
   if(!r.ok){
     if(r.status===401||r.status===403)throw Error("Sessão expirada ou banco sem permissão. Entre na conta novamente.");
     throw Error(json.message||json.error||json.code||"Falha na nuvem: "+r.status);
   }
   return json;
 }
 fetchCloudVault=async function(){
   const rows=await apiFetch("/rest/v1/finance_vault?select=vault,revision,updated_at&user_id=eq."+encodeURIComponent(cloudSession.user));
   return rows[0]||null;
 };
 async function putVault({manual=false}={}){
   if(busy)return false;
   if(!cloudSession){if(manual)alert("Entre na sua conta de nuvem antes de sincronizar.");return false}
   busy=true;lastError="";
   try{
     await waitSave();
     if(boundToAnotherAccount())throw Error("Este cofre já está vinculado a outra conta de nuvem. Não enviaremos seus dados para uma conta diferente. Exporte um backup e restaure conscientemente o cofre da conta desejada.");
     const local=anchor();
     const remote=await fetchCloudVault();
     const rev=Number(remote?.revision||0);
     if(remote&&!local){
       throw Error("Já há um backup nesta conta, mas este aparelho não possui histórico de sincronização. Exporte seu backup local e restaure a cópia da nuvem antes de ativar o envio.");
     }
     if(local&&local.revision!==rev){
       throw Error("CONFLITO: outro aparelho alterou a cópia na nuvem. Nada foi sobrescrito. Exporte seu backup local, compare e restaure conscientemente.");
     }
     if(!local&&rev!==0)throw Error("Backup existente não reconhecido. Restaure primeiro.");
     const includedMutation=mutationSeq;
     const blob=await portableVault(); // Snapshot criptografado; alterações posteriores disparam outra rodada.
     const reply=await apiFetch("/rest/v1/rpc/rf_write_vault",{
       method:"POST",body:JSON.stringify({p_vault:blob,p_expected_revision:rev})
     });
     const item=Array.isArray(reply)?reply[0]:reply;
     if(!Number.isSafeInteger(Number(item?.revision)))throw Error("O servidor não confirmou a nova revisão.");
     setAnchor(Number(item.revision));
     dirty=mutationSeq!==includedMutation;
     if(dirty)setTimeout(schedule,1000);
     if(manual)toast("Backup criptografado salvo com controle de revisão.");
     if(page==="settings")render();
     return true;
   }catch(e){
     lastError=String(e.message||e).slice(0,280);
     if(manual)alert("Backup não realizado: "+lastError);
     if(page==="settings")render();
     return false;
   }finally{busy=false}
 }
 cloudUpload=function(){return putVault({manual:true})};
 cloudDownload=async function(){
   if(!cloudSession){alert("Entre na conta de nuvem primeiro.");return}
   try{
     const row=await fetchCloudVault();
     if(!row){toast("Ainda não existe backup nessa conta.");return}
     const pass=prompt("Digite a senha ORIGINAL do cofre na nuvem:");
     if(!pass)return;
     const salt=unbase64(row.vault.salt);
     const key=await deriveKey(pass,salt);
     const restored=await decryptState(row.vault,key);
     if(!confirm("ATENÇÃO: isto SUBSTITUI os registros locais. Exporte um backup deste aparelho antes de continuar. Você confirma que já salvou a cópia local?"))return;
     await waitSave();
     await restorePortableState(restored,key,salt);
     setAnchor(Number(row.revision||0));
     dirty=false;lastError="";
     toast("Backup restaurado. Revisão da nuvem reconhecida.");
   }catch(e){alert("Não foi possível restaurar: "+e.message)}
 };
 // Cadastro e login usam Supabase Auth; refresh_token fica exclusivamente em memória.
 handleCloudForm=async function(form,mode){
   const button=form.querySelector('button[value="'+mode+'"]');
   if(button)button.disabled=true;
   try{
     if(!window.isSecureContext)throw Error("O login exige HTTPS.");
     const cfg={
       url:normalizeUrl(form.elements.url.value),
       anon:form.elements.anon.value.trim()
     };
     const email=form.elements.email.value.trim().toLowerCase();
     const password=form.elements.password.value;
     if(!cfg.anon||!email||!password)throw Error("Preencha projeto, email e senha.");
     localStorage.setItem(CLOUD_CFG,JSON.stringify(cfg));
     const endpoint=mode==="signup"?"signup":"token?grant_type=password";
     const res=await fetch(cfg.url+"/auth/v1/"+endpoint,{
       method:"POST",headers:authHeaders(cfg),
       body:JSON.stringify({email,password}),cache:"no-store"
     });
     const body=await res.json().catch(()=>({}));
     if(!res.ok)throw Error(body.error_description||body.message||body.msg||"Falha na autenticação.");
     form.elements.password.value="";
     if(body.access_token){
       setSession(body);
       lastError="";remoteRevision=anchor()?.revision??null;
       toast("Conectado. Os backups permanecem criptografados.");
       if(enabled()&&dirty)schedule();
     }else{
       toast("Cadastro enviado. Confirme seu endereço de email antes de entrar.");
     }
     render();
   }catch(e){alert("Nuvem: "+e.message)}
   finally{if(button?.isConnected)button.disabled=false}
 };
 function schedule(){
   if(!enabled()||!cloudSession||!vaultKey)return;
   clearTimeout(timer);
   timer=setTimeout(()=>putVault({manual:false}),12000);
 }
 // Nunca exibir valores financeiros na notificação/na tela de bloqueio.
 checkReminders=async function(){
   if(!vaultKey||reminderBusy)return;
   reminderBusy=true;
   try{
     if(typeof Notification==="undefined"||Notification.permission!=="granted")return;
     const items=upcoming(2),today=dt();
     data.alerts=data.alerts||{};
     for(const item of items){
       const id=item.id+"_"+item.due;
       if(data.alerts[id]===today)continue;
       const message={body:"Confira o próximo vencimento no aplicativo. Valores ocultos por privacidade.",tag:id};
       if("serviceWorker" in navigator){
         const reg=await navigator.serviceWorker.ready;
         await reg.showNotification("Rota Financeira: conta próxima",message);
       }else new Notification("Rota Financeira: conta próxima",message);
       data.alerts[id]=today;save();
     }
   }catch(e){console.warn("Lembretes indisponíveis",e)}
   finally{reminderBusy=false}
 };
 const oldSave=save;
 save=function(strict=false){
   const r=oldSave(strict);
   if(vaultKey){mutationSeq++;dirty=true;schedule()}
   return r;
 };
 document.addEventListener("change",ev=>{
   if(ev.target?.id!=="rfAutosync")return;
   if(ev.target.checked&&!cloudSession){
     alert("Faça login na nuvem antes de ativar o backup automático.");
     if(page==="settings")render();
     return;
   }
   if(ev.target.checked&&boundToAnotherAccount()){
     alert("Este cofre está vinculado a outra conta. Exporte um backup e restaure o cofre correto antes de ativar.");
     if(page==="settings")render();
     return;
   }
   localStorage.setItem(OPT,ev.target.checked?cloudIdentity():"");
   if(ev.target.checked){dirty=true;schedule()}else clearTimeout(timer);
   if(page==="settings")render();
 });
 document.addEventListener("click",async ev=>{
   const btn=ev.target.closest("button[data-secure]");
   if(!btn)return;
   if(btn.dataset.secure==="sync-now")await putVault({manual:true});
   if(btn.dataset.secure==="check-sync"){
     if(!cloudSession){alert("Faça login em Ajustes → Nuvem.");return}
     try{
       const remote=await fetchCloudVault(),local=anchor();
       alert("Servidor: "+(remote?"revisão "+remote.revision:"sem backup")+
        "\nEste aparelho: "+(local?"revisão "+local.revision:"ainda não sincronizado")+
        "\n"+(remote&&local&&remote.revision!==local.revision?"Conflito detectado: NÃO envie sem reconciliar.":"Nenhum conflito conhecido."));
     }catch(e){alert("Conexão não confirmada: "+e.message)}
   }
 });
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&dirty)schedule()});
 window.addEventListener("online",()=>{if(dirty)schedule()});
 // Nova senha mais forte; senhas antigas de 8 caracteres continuam válidas para desbloquear.
 const oldSetup=setup;
 setup=async function(password){
   if(password.length<12)throw Error("Para proteger o cofre novo, use pelo menos 12 caracteres.");
   return oldSetup(password);
 };
 const oldChange=changeVaultPass;
 changeVaultPass=async function(form){
   if(form.elements.password.value.length<12){
     alert("Use pelo menos 12 caracteres na NOVA senha. A senha antiga continua válida.");
     return;
   }
   return oldChange(form);
 };
 const adjustSetup=()=>{
   const f=document.querySelector('form[data-security="setup"]');
   if(f){for(const field of f.querySelectorAll('input[type=password]'))field.minLength=12;}
 };
 new MutationObserver(adjustSetup).observe(document.getElementById('app'),{childList:true,subtree:true});
 adjustSetup();
 window.rfSecurityStatus=()=>({connected:!!cloudSession,autoSync:enabled(),dirty,revision:anchor()?.revision??null,error:lastError});
})();