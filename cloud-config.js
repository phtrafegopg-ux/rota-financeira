/* Configuração pública da instância Rota Financeira. Nunca coloque chave secret/service_role aqui. */
(()=>{
 "use strict";
 const host=location.hostname;
 // Não interferir nos testes localhost ou em instalações de terceiros.
 if(host!=="phtrafegopg-ux.github.io")return;
 const url="https://ycblzalwgzgcpjbjcfvy.supabase.co";
 const anon="sb_publishable_F4ZWsuyVnc0Or5km-jkkcA_ABVFFOlK";
 const name="rf_cloud_config_v2";
 function configure(){
   const stored=JSON.parse(localStorage.getItem(name)||"{}");
   if(stored.url!==url||stored.anon!==anon){
     // A configuração não contém registros financeiros; não apagar dados do cofre.
     localStorage.setItem(name,JSON.stringify({url,anon}));
   }
 }
 try{configure()}catch{localStorage.setItem(name,JSON.stringify({url,anon}))}
 function lockForm(){
   document.querySelectorAll('form[data-security="cloud"]').forEach(form=>{
     const fields=[["url",url],["anon",anon]];
     for(const [key,value] of fields){
       const el=form.elements[key];
       if(el&&(!el.readOnly||el.value!==value)){
         el.value=value;
         el.readOnly=true;
         el.tabIndex=-1;
       }
     }
     const noteId="rf-project-note";
     if(!form.querySelector("#"+noteId)){
       const info=document.createElement("p");
       info.id=noteId;info.className="rf-hint";
       info.textContent="Projeto oficial Rota Financeira configurado. URL e chave pública estão protegidas contra alterações acidentais. Nunca informe sua senha do cofre no campo de senha da conta.";
       form.prepend(info);
     }
   });
 }
 const app=document.getElementById("app");
 if(!app)return;
 new MutationObserver(lockForm).observe(app,{childList:true,subtree:true});
 lockForm();
 window.rfProjectStatus=()=>({project:"rota-financeira",configured:true});
})();