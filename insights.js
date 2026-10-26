/* Rota Financeira 4.0 — insights locais. Nunca envia valores à nuvem. */
(()=>{
 "use strict";
 const previous=renderHome;
 const safeNumber=v=>Number.isFinite(Number(v))?Number(v):0;
 const moneyFormat=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
 function dates(month){
   const first=new Date(month+"-01T12:00:00");
   if(Number.isNaN(first.getTime()))return [];
   const lastDay=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
   let end=lastDay;
   if(month===dt().slice(0,7))end=Math.min(lastDay,Number(dt().slice(-2)));
   if(month>dt().slice(0,7))end=Math.min(7,lastDay);
   const days=[];
   for(let day=Math.max(1,end-6);day<=end;day++){
     days.push(month+"-"+String(day).padStart(2,"0"));
   }
   return days;
 }
 function build(){
   const month=selectedMonth;
   const entries=(Array.isArray(data?.entries)?data.entries:[]).filter(e=>e?.type==="uber"&&typeof e.date==="string"&&e.date.startsWith(month));
   const netFor=e=>safeNumber(e.gross)-safeNumber(e.fuel)-safeNumber(e.fee)-safeNumber(e.other);
   const gross=entries.reduce((t,e)=>t+safeNumber(e.gross),0);
   const net=entries.reduce((t,e)=>t+netFor(e),0);
   const costs=Math.max(0,gross-net);
   const activeDays=new Set(entries.map(e=>e.date)).size;
   const safeGross=Math.max(gross,0),remaining=safeGross>0?Math.max(0,Math.min(100,Math.round(100*Math.max(net,0)/safeGross))):0;
   const days=dates(month);
   const daily=days.map(d=>Math.max(0,entries.filter(e=>e.date===d).reduce((t,e)=>t+netFor(e),0)));
   const max=Math.max(...daily,1);
   const chart=days.map((day,i)=>{
     const height=Math.min(100,Math.max(3,100*daily[i]/max));
     return '<div class="rf-bar-col"><div class="rf-bar-v" title="'+esc(day.slice(-2)+' — '+moneyFormat(daily[i]))+'">'+
       '<span class="rf-bar-fill" style="height:'+height.toFixed(2)+'%"></span></div>'+
       '<span class="rf-bar-day">'+day.slice(-2)+'</span></div>';
   }).join("");
   return '<section class="panel rf-insights" aria-labelledby="rf-insights-title">'+
     '<div class="rf-insights-header"><div><span class="eyebrow">ANÁLISE DE DESEMPENHO</span>'+
     '<h2 id="rf-insights-title">Suas corridas em números</h2><p class="hint">Valores declarados nas plataformas no mês selecionado.</p></div>'+
     '<span class="rf-insights-icon" aria-hidden="true">↗</span></div>'+
     '<div class="rf-insight-kpis">'+
     '<div class="rf-kpi rf-kpi-primary"><span>Líquido das plataformas</span><strong>'+moneyFormat(net)+'</strong></div>'+
     '<div class="rf-kpi"><span>Bruto informado</span><strong>'+moneyFormat(gross)+'</strong></div>'+
     '<div class="rf-kpi"><span>Custos das corridas</span><strong>'+moneyFormat(costs)+'</strong></div>'+
     '<div class="rf-kpi"><span>Dias registrados</span><strong>'+String(activeDays)+'</strong></div></div>'+
     '<div class="rf-net-panel"><div class="rf-inline-stats"><span>Percentual líquido das plataformas</span>'+
     '<strong>'+remaining+'%</strong></div>'+
     '<div class="rf-track" role="progressbar" aria-label="Percentual líquido" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+remaining+'">'+
     '<span style="width:'+remaining+'%"></span></div></div>'+
     '<div class="rf-chart-head"><h3>Últimos 7 dias do mês selecionado</h3>'+
     '<small>Resultado líquido diário (R$)</small></div>'+
     '<div class="rf-chart" role="img" aria-label="'+esc("Barras do resultado líquido: "+days.map((d,i)=>d.slice(-2)+": "+moneyFormat(daily[i])).join("; "))+'">'+chart+'</div>'+
     '<p class="rf-insights-foot">Inclui apenas lançamentos do tipo plataforma. Não substitui o cálculo de saldo, nem desconta contas pessoais ou dívidas.</p>'+
     '</section>';
 }
 renderHome=function(){
   const html=previous();
   const section=build();
   const heroStart=html.indexOf('<section class="panel hero"');
   if(heroStart<0)return section+html;
   const heroEnd=html.indexOf("</section>",heroStart);
   if(heroEnd<0)return section+html;
   return html.slice(0,heroEnd+10)+section+html.slice(heroEnd+10);
 };
})();
