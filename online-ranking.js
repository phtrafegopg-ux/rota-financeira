/* Liga online: resultados exclusivamente publicados por revisores, nunca pelas capturas locais. */
(()=>{
 "use strict";
 const oldLeague=renderLeague,oldRender=render;
 const weekStart=()=>{
   const now=new Date(dt()+"T12:00:00");
   now.setDate(now.getDate()-((now.getDay()+6)%7));
   return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
 };
 renderLeague=function(){
   return oldLeague()+
    '<section class="panel" id="rfOfficialRanking"><div class="row start">'+
    '<div><h2 class="h2">🏆 Liga online verificada</h2><p class="hint">Ranking oficial somente de resultados aprovados por revisão humana.</p></div>'+
    '<span class="rf-badge">Beta</span></div><div id="rfRankContent" class="notice mint-note">Conecte sua conta de nuvem para consultar o placar.</div>'+
    '<button class="btn secondary block" data-online-ranking="refresh">Atualizar classificação</button>'+
    '<p class="rf-hint">Seus pontos pessoais continuam provisórios. Prints não são publicados nem compartilhados automaticamente. Prêmios em dinheiro permanecem desativados.</p></section>';
 };
 let inFlight=false;
 async function loadRanking(){
   const target=document.getElementById("rfRankContent");
   if(!target||inFlight)return;
   if(!cloudSession){target.textContent="Entre na conta em Ajustes → Nuvem para consultar o placar.";return}
   const cfg=getCloudCfg();
   if(!cfg?.url||!cfg?.anon)return;
   inFlight=true;
   target.textContent="Consultando classificação verificada...";
   try{
     if(window.rfEnsureAuth)await window.rfEnsureAuth();
     const q="/rest/v1/rf_weekly_rankings?select=alias,points,week_start&week_start=eq."+
       encodeURIComponent(weekStart())+"&order=points.desc&limit=10";
     const response=await fetch(cfg.url+q,{
       headers:cloudHeaders(cloudSession.token),cache:"no-store"
     });
     if(!response.ok)throw Error("Ranking indisponível (HTTP "+response.status+").");
     const rows=await response.json();
     if(!Array.isArray(rows))throw Error("Formato de classificação inválido.");
     if(!document.getElementById("rfRankContent"))return;
     if(!rows.length){target.textContent="Nenhum resultado aprovado nesta semana. O ranking oficial ainda não possui competidores validados.";return}
     target.innerHTML=rows.slice(0,10).map((r,i)=>
       '<div class="lineitem"><div class="desc"><strong>'+String(i+1)+'º — '+esc(String(r.alias||"Motorista"))+
       '</strong><span>Participação verificada</span></div><div class="amount">'+
       Math.max(0,Math.min(200,Number(r.points)||0))+' pts</div></div>'
     ).join("");
   }catch(e){if(document.getElementById("rfRankContent"))target.textContent=e.message||"Não foi possível consultar o ranking."}
   finally{inFlight=false}
 }
 render=function(){oldRender();if(page==="league")setTimeout(loadRanking,0)};
 document.addEventListener("click",ev=>{
   if(ev.target.closest('[data-online-ranking="refresh"]'))loadRanking();
 });
})();