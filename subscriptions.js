/* Planos: somente o banco indica acesso, nunca o armazenamento local. */
(()=>{
 "use strict";
 const original=renderSettings,oldRender=render;
 renderSettings=function(){
   return original()+
     '<section class="panel" id="rfBilling"><h2 class="h2">💳 Plano Rota PRO</h2>'+
     '<p class="hint">Consulta segura do plano vinculado à sua conta. A cobrança ainda não está habilitada.</p>'+
     '<div id="rfPlanStatus" class="notice mint-note">Entre em Ajustes → Nuvem para consultar sua conta.</div>'+
     '<p class="rf-hint">O aplicativo não cobra nem ativa planos sozinho. Futuras assinaturas dependerão de checkout de provedor autorizado, webhook verificado e conformidade legal. Não informe dados de cartão aqui.</p></section>';
 };
 async function load(){
   const el=document.getElementById("rfPlanStatus");
   if(!el)return;
   if(!cloudSession){el.textContent="Sem sessão de nuvem. Plano ainda não identificado.";return}
   const cfg=getCloudCfg();
   try{
     if(window.rfEnsureAuth)await window.rfEnsureAuth();
     const url=cfg.url+"/rest/v1/rf_subscriptions?select=plan,status,period_end&user_id=eq."+
      encodeURIComponent(cloudSession.user);
     const r=await fetch(url,{headers:cloudHeaders(cloudSession.token),cache:"no-store"});
     if(!r.ok)throw Error("Serviço de planos indisponível (HTTP "+r.status+").");
     const rows=await r.json(),sub=rows?.[0];
     const valid=sub?.plan==="pro"&&["active","trialing"].includes(sub.status)&&
       (!sub.period_end||new Date(sub.period_end)>new Date());
     el.textContent=valid?"Plano PRO confirmado pelo servidor.":"Plano gratuito / sem assinatura ativa.";
   }catch(e){el.textContent="Plano não verificado. Nenhuma cobrança foi realizada."}
 }
 render=function(){oldRender();if(page==="settings")setTimeout(load,0)};
})();