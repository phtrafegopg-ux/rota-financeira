/* Rota Financeira 4.0 — planos exibidos sem cobrança local.
   Somente um backend de pagamentos auditado poderá modificar rf_subscriptions. */
(()=>{
 "use strict";
 const originalSettings=renderSettings;
 const originalRender=render;
 renderSettings=function(){
   return originalSettings()+
     '<section class="panel rf-plans" id="rfBilling" aria-labelledby="rf-plans-title">'+
     '<div class="rf-plans-head"><div><span class="eyebrow">CONTA E ASSINATURA</span>'+
     '<h2 class="h2" id="rf-plans-title">Seu plano Rota Financeira</h2></div>'+
     '<span class="rf-badge">Pré-lançamento</span></div>'+
     '<div id="rfPlanStatus" role="status" aria-live="polite" class="notice mint-note">Entre em Ajustes → Nuvem para consultar o plano.</div>'+
     '<div class="rf-plan-options">'+
     '<article class="rf-plan-option"><span>GRÁTIS</span><h3>Controle essencial</h3>'+
     '<strong>R$ 0 <small>/mês</small></strong>'+
     '<p>Lançamentos, contas, metas, cofre criptografado e backups manuais.</p></article>'+
     '<article class="rf-plan-option rf-plan-future"><span>PRO · PLANEJADO</span><h3>Evolução financeira</h3>'+
     '<strong>R$ 19,90 <small>/mês previsto</small></strong>'+
     '<p>Recursos adicionais a definir e validar antes da cobrança comercial.</p>'+
     '<div class="rf-coming-soon">Assinatura ainda indisponível</div></article></div>'+
     '<p class="rf-hint">Nenhuma cobrança ocorre nesta tela. A ativação PRO depende de aprovação do pagamento no servidor, cancelamento seguro e documentação de privacidade. Os valores são uma proposta, não uma oferta disponível.</p></section>';
 };
 async function updateStatus(){
   const el=document.getElementById("rfPlanStatus");
   if(!el)return;
   if(!cloudSession?.user){el.textContent="Nuvem desconectada. Nenhum plano ativo foi confirmado.";return}
   const cfg=getCloudCfg(),signedInUser=cloudSession.user;
   try{
     if(window.rfEnsureAuth)await window.rfEnsureAuth();
     const url=cfg.url+"/rest/v1/rf_subscriptions?select=plan,status,period_end&user_id=eq."+
       encodeURIComponent(signedInUser);
     const response=await fetch(url,{headers:cloudHeaders(cloudSession.token),cache:"no-store"});
     if(!response.ok)throw Error("HTTP "+response.status);
     const arr=await response.json();
     if(!Array.isArray(arr))throw Error("Resposta de assinatura inválida.");
     if(!el.isConnected||cloudSession?.user!==signedInUser)return;
     const sub=arr[0];
     // Nunca confiar em flags do navegador, nem liberar PRO sem vencimento válido.
     const proActive=sub?.plan==="pro"&&["active","trialing"].includes(sub.status)&&
       !!sub.period_end&&new Date(sub.period_end).getTime()>Date.now();
     el.textContent=proActive?
       "Plano PRO confirmado pelo servidor.":
       "Plano gratuito. Sem assinatura PRO ativa.";
   }catch(err){
     if(el.isConnected)el.textContent="Não foi possível confirmar o plano. Nenhuma cobrança foi iniciada.";
   }
 }
 render=function(){originalRender();if(page==="settings")setTimeout(updateStatus,0)};
})();