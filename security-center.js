/* Rota Financeira 3.1 - camada de sincronização segura.
   Sem credenciais privadas no cliente. Requer supabase/01_seguro.sql. */
(function() {
 "use strict";
 const OPT="rf_autobackup_optin_v31",BASE="rf_revision_anchor_v31",PENDING="rf_local_unsynced_v40";
 let dirty=Boolean(localStorage.getItem(PENDING)), timer=null, busy=false, lastError="",remoteRevision=null,mutationSeq=0;
 let refreshInFlight=null, sessionEpoch=0;
 // Every login, logout and lock invalidates outstanding asynchronous work.
 const contextStamp=()=>({epoch:sessionEpoch,identity:cloudIdentity(),key:vaultKey});
 const assertContext=stamp=>{
   if(!vaultKey||stamp.key!==vaultKey||stamp.epoch!==sessionEpoch||stamp.identity!==cloudIdentity())
     throw Error("A sessão ou o cofre mudou. Operação cancelada; tente novamente.");
 };
 const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
 const cloudIdentity=()=>{const c=getCloudCfg();return cloudSession&&c.url?c.url+"|"+cloudSession.user:null};
 const anchor=()=>{const k=cloudIdentity();const a=readJSON(BASE,null);return k&&a?.identity===k?a:null};
 const boundToAnotherAccount=()=>{const old=readJSON(BASE,null)?.identity;return !!old&&old!==cloudIdentity()};

 const setAnchor=rev=>{const id=cloudIdentity();if(id)localStorage.setItem(BASE,JSON.stringify({identity:id,revision:rev,at:new Date().toISOString()}));remoteRevision=rev};
 const enabled=()=>Boolean(cloudIdentity())&&localStorage.getItem(OPT)===cloudIdentity();
 const statusText=()=>{
   if(!cloudSession)return "Sem login na nuvem. "+(dirty?"Há alterações locais ainda não confirmadas no servidor.":"Os dados deste aparelho continuam criptografados.");
   if(lastError)return "Backup não confirmado: "+lastError;
   if(dirty)return "Há alterações locais aguardando envio. Não limpe os dados do aparelho.";
   if(!enabled())return "Conectado. Sincronização automática desligada.";
   const a=anchor();
   return a?"Último backup confirmado em "+new Date(a.at).toLocaleString("pt-BR")+".":"Conectado. O primeiro backup ainda não foi confirmado.";
 };
 const oldSettings=renderSettings;
 renderSettings=function(){
   const html=oldSettings().replace("A sincronização é manual nesta versão: envie depois das alterações e restaure em outros aparelhos.", "O backup automático pode ser ativado abaixo após entrar na nuvem. Você também pode exportar um backup manual criptografado.");
   const checked=enabled()?'checked':'';
   const ready=Boolean(cloudSession);
   return html+
     '<section class="panel" id="rf-security-center"><div class="row start"><h2 class="h2">🛡️ Central de proteção</h2><span class="rf-badge">Versão 4.0</span></div>'+
     '<div class="rf-security-summary"><div><strong>Criptografia local</strong><span>AES-GCM no dispositivo</span></div>'+
     '<div><strong>Conta em nuvem</strong><span>'+(ready?'Sessão ativa':'Login necessário')+'</span></div>'+
     '<div><strong>Sincronização</strong><span>'+(dirty?'Alterações pendentes':enabled()?'Ao editar, quando conectado':'Desativada')+'</span></div>'+
     '<div><strong>Conflitos</strong><span>Bloqueio de sobrescrita (RPC)</span></div></div>'+
     '<div class="notice '+(lastError||dirty?'rf-risk':'mint-note')+'" role="status" aria-live="polite">'+esc(statusText())+'</div>'+
     '<label class="field" style="display:flex;flex-direction:row;align-items:center;gap:12px">'+
       '<input id="rfAutosync" type="checkbox" style="width:22px;height:22px" '+checked+'>'+
       '<span>Backup automático criptografado ao registrar alterações</span></label>'+
     '<p class="rf-hint">Requer seu projeto Supabase configurado com o SQL de segurança e login na seção Nuvem. Não envia seus dados antes da autenticação. A senha do cofre nunca é transmitida. Nunca envia dinheiro ou dados sem sua ação.</p>'+
     '<p class="rf-hint">Por segurança, ao fechar o app a sessão de nuvem termina. Ao reabrir, desbloqueie o cofre e entre na nuvem novamente. Não use dois aparelhos ao mesmo tempo sem revisar as alterações: conflitos são bloqueados, nunca mesclados silenciosamente.</p>'+
     '<div class="btnrow"><button class="btn secondary grow" data-secure="sync-now">↑ Sincronizar agora</button>'+
     '<button class="btn outline grow" data-secure="check-sync">Verificar conexão</button></div>'+ (ready?'<button class="btn outline block" data-secure="logout-cloud" type="button">Sair da conta da nuvem neste aparelho</button>':'')+'</section>';
 };

 // Tokens de acesso e atualização somente em memória; jamais em localStorage.
 function authHeaders(cfg, token){
   return {"apikey":cfg.anon,...(token?{"Authorization":"Bearer "+token}:{}),"Content-Type":"application/json"};
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
     const previousSession=cloudSession, stamp=contextStamp();
     const work=(async()=>{
       const cfg=getCloudCfg();
       const res=await fetch(cfg.url+"/auth/v1/token?grant_type=refresh_token",{
         method:"POST",
         headers:authHeaders(cfg),
         body:JSON.stringify({refresh_token:previousSession.refreshToken}),
         cache:"no-store"
       });
       const body=await res.json().catch(()=>({}));
       assertContext(stamp);
       if(cloudSession!==previousSession)throw Error("A sessão mudou durante a renovação.");
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
     })();
     refreshInFlight=work;
     work.finally(()=>{if(refreshInFlight===work)refreshInFlight=null}).catch(()=>{});
   }
   return refreshInFlight;
 }
 window.rfEnsureAuth=ensureSession;
 const originalVaultPage=vaultPage;
 vaultPage=function(){
   sessionEpoch++;
   cloudSession=null;
   refreshInFlight=null;
   clearTimeout(timer);
   originalVaultPage();
 };
 async function apiFetch(path, options={}){
   const stamp=contextStamp();
   await ensureSession();
   assertContext(stamp);
   const cfg=getCloudCfg();
   if(!cfg?.url||!cfg?.anon)throw Error("Configure a nuvem em Ajustes.");
   const r=await fetch(cfg.url+path,{
     ...options,cache:"no-store",
     headers:{...cloudHeaders(cloudSession.token),...(options.headers||{})}
   });
   const json=await r.json().catch(()=>({}));
   assertContext(stamp);
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
   const stamp=contextStamp();
   try{
     await waitSave();
     assertContext(stamp);
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
     assertContext(stamp);
     const reply=await apiFetch("/rest/v1/rpc/rf_write_vault",{
       method:"POST",body:JSON.stringify({p_vault:blob,p_expected_revision:rev})
     });
     const item=Array.isArray(reply)?reply[0]:reply;
     if(!Number.isSafeInteger(Number(item?.revision)))throw Error("O servidor não confirmou a nova revisão.");
     assertContext(stamp);
     setAnchor(Number(item.revision));
     dirty=mutationSeq!==includedMutation;
     if(!dirty)localStorage.removeItem(PENDING);
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
 // Restaurar por formulário interno: Chrome, WebView e navegadores corporativos
 // podem recusar window.prompt()/window.confirm().
 let restoringCloud=false;
 cloudDownload=async function(){
   if(restoringCloud)return;
   if(!cloudSession||!vaultKey){
     alert("Desbloqueie o cofre e entre na conta em Ajustes → Nuvem.");
     return;
   }
   try{
     const backup=await fetchCloudVault();
     if(!backup||!backup.vault){
       toast("Não existe backup criptografado nesta conta.");
       return;
     }
     showModal("Restaurar backup da nuvem",
       '<form data-cloud-restore autocomplete="off">'+
       '<div class="notice mint-note">Backup encontrado no servidor: revisão '+esc(backup.revision)+'. A restauração não envia nem modifica os dados na nuvem.</div>'+
       '<p class="hint">Digite a senha ORIGINAL do cofre salvo no celular. Não use a senha temporária deste PC nem a senha de login da nuvem, caso sejam diferentes.</p>'+
       '<div class="field"><label for="rf-cloud-pass">Senha original do cofre</label>'+
       '<input id="rf-cloud-pass" name="originalPass" type="password" autocomplete="off" required placeholder="Senha do cofre do celular"></div>'+
       '<label class="field" style="display:flex;flex-direction:row;align-items:start;gap:10px">'+
       '<input name="ack" type="checkbox" required style="width:22px;height:22px;flex:none">'+
       '<span>Entendo que a restauração substituirá os dados locais deste computador. Já guardei um backup local, se necessário. Os dados da nuvem não serão alterados.</span></label>'+
       '<div id="rf-restore-error" class="notice rf-risk" role="alert" aria-live="assertive" style="display:none"></div>'+
       '<div class="btnrow"><button class="btn secondary grow" type="button" data-action="close">Cancelar</button>'+
       '<button class="btn grow" type="submit">Restaurar neste dispositivo</button></div>'+
       '</form>');
     document.getElementById("rf-cloud-pass")?.focus();
   }catch(e){
     alert("Não foi possível localizar o backup: "+String(e.message||e));
   }
 };
 document.addEventListener("submit",async event=>{
   const form=event.target;
   if(!form.matches("form[data-cloud-restore]"))return;
   event.preventDefault();
   if(restoringCloud)return;
   const warn=form.querySelector("#rf-restore-error");
   const button=form.querySelector('button[type="submit"]');
   if(!form.elements.ack.checked||!form.elements.originalPass.value)return;
   const originalPassword=form.elements.originalPass.value;
   form.elements.originalPass.value="";
   restoringCloud=true;
   button.disabled=true;
   button.textContent="Verificando e restaurando…";
   warn.style.display="none";
   const currentAccount=cloudIdentity(), restoreStamp=contextStamp();
   try{
     if(!vaultKey||!currentAccount)throw Error("A sessão foi encerrada. Desbloqueie e entre na nuvem novamente.");
     // Buscar novamente no momento da confirmação: nunca restaurar cópia obsoleta.
     const row=await fetchCloudVault();
     if(!row||row.vault?.schema!==2||!Number.isSafeInteger(Number(row.revision))){
       throw Error("Backup ausente ou incompatível. Nenhum dado local foi substituído.");
     }
     if(cloudIdentity()!==currentAccount)throw Error("A conta mudou durante a operação. Restauração cancelada.");
     const salt=unbase64(row.vault.salt);
     const key=await deriveKey(originalPassword,salt);
     assertContext(restoreStamp);
     let restored;
     try{
       restored=await decryptState(row.vault,key);
     }catch{
       throw Error("Senha original incorreta ou backup danificado. Os dados locais continuam intactos.");
     }
     // Apenas depois de verificar senha e consentimento modificar o dispositivo.
     await waitSave();
     if(cloudIdentity()!==currentAccount)throw Error("A conta mudou. Nada foi substituído.");
     clearTimeout(timer);
     assertContext(restoreStamp);
     await restorePortableState(restored,key,salt,()=>assertContext(restoreStamp));
     setAnchor(Number(row.revision));
     mutationSeq++;
     dirty=false;
     localStorage.removeItem(PENDING);
     lastError="";
     // Nunca subir o cofre recém-restaurado automaticamente: permitir conferência.
     localStorage.removeItem(OPT);
     closeModal();
     render();
     toast("Backup recuperado. Confira saldos e comprovantes antes de ativar a sincronização.");
   }catch(e){
     if(warn?.isConnected){
       warn.textContent=String(e.message||e);
       warn.style.display="block";
     }else{
       alert("Não foi possível restaurar: "+String(e.message||e));
     }
   }finally{
     if(button.isConnected){
       button.disabled=false;
       button.textContent="Restaurar neste dispositivo";
     }
     restoringCloud=false;
   }
 });
 // Cadastro e login usam Supabase Auth; refresh_token fica exclusivamente em memória.
 handleCloudForm=async function(form,mode){
   const button=form.querySelector('button[value="'+mode+'"]');
   const loginEpoch=++sessionEpoch, loginKey=vaultKey;
   cloudSession=null;refreshInFlight=null;clearTimeout(timer);
   if(button)button.disabled=true;
   try{
     if(!window.isSecureContext)throw Error("O login exige HTTPS.");
     if(!vaultKey)throw Error("Desbloqueie o cofre antes do login.");
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
     if(!vaultKey||vaultKey!==loginKey||sessionEpoch!==loginEpoch)throw Error("Login cancelado: a sessão ou o cofre mudou.");
     if(!res.ok)throw Error(body.error_description||body.message||body.msg||"Falha na autenticação.");
     form.elements.password.value="";
     if(body.access_token){
       setSession(body);
       lastError="";remoteRevision=anchor()?.revision??null;
       // Migração de versões anteriores: recuperar aviso de backup atrasado
       // sem confiar em uma sessão anterior ao reiniciar o navegador.
       const lastConfirmed=anchor()?.at;
       const localModified=currentVault?.updatedAt;
       if(lastConfirmed&&localModified&&
          Date.parse(localModified)>Date.parse(lastConfirmed)+2000){
         dirty=true;
         localStorage.setItem(PENDING,localModified);
       }
       toast("Conectado. Os backups permanecem criptografados.");
       if(enabled()&&dirty)schedule();
     }else{
       toast("Cadastro enviado. Confirme seu endereço de email antes de entrar.");
     }
     render();
   }catch(e){alert("Nuvem: "+e.message)}
   finally{form.elements.password.value="";if(button?.isConnected)button.disabled=false}
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
   if(vaultKey){mutationSeq++;dirty=true;localStorage.setItem(PENDING,new Date().toISOString());schedule()}
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
   if(btn.dataset.secure==="logout-cloud"){
     sessionEpoch++;
     clearTimeout(timer);
     cloudSession=null;
     refreshInFlight=null;
     lastError="";
     render();
     toast("Sessão de nuvem encerrada neste aparelho.");
     return;
   }
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