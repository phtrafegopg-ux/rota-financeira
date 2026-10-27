'use strict';
const STORE='rota_financeira_v1';const VAULT='rota_financeira_vault_v2';const CLOUD_CFG='rf_cloud_config_v2';const fmt=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);const money=n=>Math.round((Number(n)||0)*100)/100;const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const dt=()=>{let d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};const mkey=dt().slice(0,7);const monname=m=>new Date(`${m}-12T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});const monshort=m=>new Date(`${m}-12T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');const mshift=(m,num)=>{let [y,mo]=m.split('-').map(Number);let d=new Date(y,mo-1+num,10);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);const datestring=(m,day)=>`${m}-${String(day).padStart(2,'0')}`;
function initial(){return {version:2,leaguePlans:[],settings:{name:'Meu Controle',initialCash:0,initialDate:dt(),salary:0,uberCost:35,uberTarget:0},entries:[],bills:[],debts:[],goals:[{id:'emergency',title:'Reserva de emergência',target:1000,current:0,note:'Primeira meta do seu planejamento.'}],snapshots:[],notes:[]};}

let data=initial(),vaultKey=null,vaultSalt=null,saveQueue=Promise.resolve(),cloudSession=null,reminderBusy=false;let currentVault=null;let lastActivity=Date.now();
const cleanState=o=>o&&typeof o==='object'&&Array.isArray(o.entries)&&Array.isArray(o.bills)&&Array.isArray(o.debts)&&Array.isArray(o.goals)&&Array.isArray(o.snapshots)&&o.settings&&typeof o.settings==='object';
const base64=a=>{const bytes=new Uint8Array(a);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)};
const unbase64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const saltNew=()=>crypto.getRandomValues(new Uint8Array(16));
async function deriveKey(pass,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function packState(state,key,salt){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(state)));return {schema:2,method:'PBKDF2-SHA256-AES256-GCM',iterations:310000,salt:base64(salt),iv:base64(iv),ciphertext:base64(encrypted),updatedAt:new Date().toISOString()}}
async function decryptState(box,key){const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(box.iv)},key,unbase64(box.ciphertext));const state=JSON.parse(new TextDecoder().decode(bytes));if(!cleanState(state))throw Error('Formato inválido');return state}
function vaultPage(){const root=document.getElementById('app');const exists=!!localStorage.getItem(VAULT);root.innerHTML=`<header class="head"><div class="brand"><div class="mark">↗</div><div><strong>Rota Financeira</strong><div class="eyebrow">Seus dados, protegidos</div></div></div></header><section class="panel hero"><div class="eyebrow" style="color:#bae9d9">${exists?'Acesso protegido':'Primeiro acesso'}</div><h1>${exists?'Desbloquear meu controle':'Crie uma senha de proteção'}</h1><p class="hint">${exists?'Seus lançamentos e suas metas estão criptografados neste aparelho.':'Seus dados financeiros serão criptografados no dispositivo. Sua senha não é enviada para servidores. Após entrar, importe o arquivo de dados iniciais fornecido separadamente.'}</p><form data-security="${exists?'unlock':'setup'}"><div class="field"><label>Senha do cofre (mínimo 8 caracteres)</label><input name="password" type="password" autocomplete="${exists?'current-password':'new-password'}" minlength="8" required></div>${exists?'':'<div class="field"><label>Confirmar senha</label><input name="confirm" type="password" autocomplete="new-password" minlength="8" required></div>'}<button class="btn block" type="submit">${exists?'Desbloquear':'Proteger e entrar'}</button></form></section><div class="notice">Guarde sua senha. Sem ela não é possível recuperar um backup criptografado. A sincronização na nuvem requer configuração separada.</div><p class="hint">Para restaurar em outro celular: configure uma senha temporária, acesse Ajustes → Nuvem, faça login e restaure o cofre salvo usando a senha original.</p>`;document.getElementById('modalRoot').innerHTML='';}
async function changeVaultPass(f){const btn=f.querySelector('button[type=submit]');btn.disabled=true;try{const old=f.elements.old.value,pass=f.elements.password.value;if(pass.length<8||pass!==f.elements.confirm.value)throw Error('Confirme a nova senha (mínimo 8 caracteres).');await waitSave();const local=JSON.parse(localStorage.getItem(VAULT));const key=await deriveKey(old,unbase64(local.salt));await decryptState(local,key);const salt=saltNew(),nextKey=await deriveKey(pass,salt);const withImages=await expandedImages(data,key);await restorePortableState(withImages,nextKey,salt);f.reset();toast('Senha alterada. Exporte um novo backup e atualize a nuvem, se usar.');}catch(e){alert('Senha não alterada: confira a senha atual e os novos campos.')}finally{btn.disabled=false}}
async function initSecurity(){if(!crypto?.subtle){document.getElementById('app').innerHTML='<div class="notice">Este ambiente não oferece criptografia segura. Abra o aplicativo em HTTPS (ou localhost), usando um navegador atualizado.</div>';return;}vaultPage()}
async function unlock(pass){const box=JSON.parse(localStorage.getItem(VAULT));const key=await deriveKey(pass,unbase64(box.salt));const state=await decryptState(box,key);data=state;if(!Array.isArray(data.leaguePlans))data.leaguePlans=[];vaultKey=key;vaultSalt=unbase64(box.salt);currentVault=box;render();syncNativeAlerts();checkReminders()}
async function setup(pass){let legacy;try{legacy=JSON.parse(localStorage.getItem(STORE))}catch(e){}data=cleanState(legacy)?legacy:initial();if(!Array.isArray(data.leaguePlans))data.leaguePlans=[];vaultSalt=saltNew();vaultKey=await deriveKey(pass,vaultSalt);const box=await packState(data,vaultKey,vaultSalt);localStorage.setItem(VAULT,JSON.stringify(box));currentVault=box;localStorage.removeItem(STORE);render();syncNativeAlerts();checkReminders()}

let page='home',selectedMonth=dt().slice(0,7),entryMode='uber',billTab='bills';
function save(strict=false){if(!vaultKey)return strict?Promise.reject(Error('Desbloqueie o cofre.')):false;if(window.AndroidAlerts)try{syncNativeAlerts()}catch(e){console.warn(e)}const snapshot=JSON.parse(JSON.stringify(data));const key=vaultKey,salt=vaultSalt;const write=saveQueue.catch(()=>{}).then(async()=>{const box=await packState(snapshot,key,salt);localStorage.setItem(VAULT,JSON.stringify(box));currentVault=box;localStorage.removeItem(STORE);return box});saveQueue=write.catch(e=>{console.error(e);toast('Falha ao salvar dados! Exporte um backup.');});return strict?write:true} 
async function waitSave(){await saveQueue}
// 2.3: provas grandes ficam no IndexedDB, isoladas do pequeno cofre em localStorage.
// O conteúdo de cada imagem também recebe AES-GCM antes de gravar. O arquivo de backup
// incorpora novamente as imagens criptografadas para permitir restauração no outro aparelho.
function openProofDB(){return new Promise((resolve,reject)=>{
 if(!('indexedDB' in window))return reject(Error('IndexedDB indisponível neste navegador.'));
 let request;try{request=indexedDB.open('rota_financeira_provas_v23',1)}catch(e){reject(e);return}
 request.onupgradeneeded=()=>request.result.createObjectStore('proofs');
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error||Error('Não foi possível abrir o armazenamento de imagens.'));
 request.onblocked=()=>reject(Error('O armazenamento de imagens está bloqueado.'));
})}
async function proofStorePut(ref,image,key=vaultKey){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=new TextEncoder().encode(image);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(ref)},key,bytes);
 const db=await openProofDB();
 try{await new Promise((resolve,reject)=>{const t=db.transaction('proofs','readwrite');t.objectStore('proofs').put({version:1,iv,ciphertext},ref);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error||Error('Sem espaço para guardar a imagem.'));t.onabort=()=>reject(t.error||Error('Gravação da imagem cancelada.'));})}finally{db.close()}
}
async function proofStoreRead(ref,key=vaultKey){
 const db=await openProofDB();let saved;
 try{saved=await new Promise((resolve,reject)=>{const t=db.transaction('proofs','readonly');const r=t.objectStore('proofs').get(ref);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('Erro ao ler a imagem.'));})}finally{db.close()}
 if(!saved)throw Error('Imagem não encontrada no dispositivo. Restaure um backup que inclua o print.');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv,additionalData:new TextEncoder().encode(ref)},key,saved.ciphertext);
 return new TextDecoder().decode(plain);
}
async function proofStoreDelete(ref){if(!ref)return;const db=await openProofDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('proofs','readwrite');tx.objectStore('proofs').delete(ref);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
const proofRef=()=>crypto.randomUUID?crypto.randomUUID():uid()+'-'+Date.now();
async function compactImages(state,key,allowInline=false){
 const clone=JSON.parse(JSON.stringify(state));
 for(const e of clone.entries){for(const proof of proofList(e)){
  if(!proof.image)continue;
  const img=proof.image,ref=proofRef();
  try{await proofStorePut(ref,img,key);delete proof.image;proof.imageRef=ref}
  catch(err){if(!allowInline)throw Error('Não foi possível guardar os prints neste navegador. Abra uma versão HTTPS instalada e restaure seu backup.');console.warn('Armazenamento alternativo indisponível:',err)}
 }}
 return clone;
}
async function expandedImages(state,key=vaultKey){
 const clone=JSON.parse(JSON.stringify(state));
 for(const e of clone.entries){for(const proof of proofList(e)){if(proof.imageRef&&!proof.image)proof.image=await proofStoreRead(proof.imageRef,key)}}
 return clone;
}
async function portableVault(){await waitSave();const expanded=await expandedImages(data);return packState(expanded,vaultKey,vaultSalt)}
async function restorePortableState(state,key,salt,beforeCommit=()=>{}){
 if(!cleanState(state))throw Error('Cofre incompatível.');
 const originalKey=vaultKey,originalState=data,originalQueue=saveQueue;
 await waitSave();
 const candidate=await compactImages(state,key,true);
 if(!Array.isArray(candidate.leaguePlans))candidate.leaguePlans=[];
 const box=await packState(candidate,key,salt);
 if(vaultKey!==originalKey||data!==originalState||saveQueue!==originalQueue)throw Error('O cofre mudou durante a restauração. Nada foi substituído.');
 beforeCommit(); // Reject obsolete cloud restore before replacing the current vault.
 localStorage.setItem(VAULT,JSON.stringify(box));
 data=candidate;vaultKey=key;vaultSalt=salt;currentVault=box;render();return box;
}

function toast(s){const t=document.getElementById('toastRoot');t.innerHTML=`<div class="toast">${esc(s)}</div>`;setTimeout(()=>{t.innerHTML=''},3800)}
const PLATFORMS=['Uber','99','Maxim','inDrive','iFood','Shopee Entregas','Mercado Livre Envios'];
const platformOf=e=>String(e?.platform||'Uber').trim()||'Uber';
const platformKey=p=>String(p||'Uber').trim().toLocaleLowerCase('pt-BR');
const platformInput=(selected='Uber')=>`<div class="field"><label>Aplicativo / plataforma</label><input name="platform" list="delivery-platforms" maxlength="40" value="${esc(selected)}" placeholder="Ex.: Uber, 99, Maxim, iFood" required><datalist id="delivery-platforms">${PLATFORMS.map(p=>`<option value="${esc(p)}">`).join('')}</datalist><span class="hint">Também pode escrever outra plataforma. Registre um total diário por aplicativo.</span></div>`;
const proofList=e=>[...(e.proof?[e.proof]:[]),...(Array.isArray(e.proofs)?e.proofs:[])];
const proofHashes=e=>proofList(e).map(p=>p.sha256);
const refList=e=>proofList(e).map(p=>p.imageRef).filter(Boolean);
const dailyProviderDuplicate=(date,platform,exceptId)=>data.entries.some(e=>e.type==='uber'&&e.date===date&&platformKey(platformOf(e))===platformKey(platform)&&e.id!==exceptId);
const titleIcon=(str)=>({home:'◫',entries:'＋',bills:'▤',goals:'◎',league:'🏆',history:'▥',settings:'⚙'})[str]||'•';
function billItems(month){return data.bills.filter(b=>b.kind==='recurring'?month>=b.start&&(!b.end||month<=b.end):b.month===month).sort((a,b)=>{
 let pa=a.category==='Cartão'?0:(a.title.includes('Van')?1:2),pb=b.category==='Cartão'?0:(b.title.includes('Van')?1:2);return pa-pb||a.title.localeCompare(b.title)
 });}
function paydate(b,m){if(b.category==='Cartão')return b.dueDate?`Venc. ${b.dueDate.split('-').reverse().join('/')} · Prev. ${monshort(m)}`:`Referência ${b.reference}`;return `Prazo: ${b.day||'a confirmar'}`;}
function billTotal(m){return money(billItems(m).reduce((s,b)=>s+b.amount,0))}
function billPaid(b,m){return b.payments?.[m]||null}
function cashDelta(e){if(e.type==='uber')return money(e.gross-e.fuel-e.fee-e.other);if(e.type==='income')return e.amount;if(e.type==='expense'&&e.paymentMethod==='credit')return 0;return -e.amount}
function cash(){return money(Number(data.settings.initialCash)+data.entries.filter(e=>e.date>=data.settings.initialDate&&e.date<=dt()).reduce((s,e)=>s+cashDelta(e),0))}
function actualStats(m){let es=data.entries.filter(e=>e.date.startsWith(m));let gross=0,netUber=0,income=0,expense=0,extraCost=0;es.forEach(e=>{if(e.type==='uber'){gross+=e.gross;let cost=e.fuel+e.fee+e.other;netUber+=e.gross-cost;extraCost+=cost;}else if(e.type==='income')income+=e.amount;else expense+=e.amount});return {gross:money(gross),netUber:money(netUber),income:money(income),expense:money(expense),extraCost:money(extraCost),nUber:es.filter(e=>e.type==='uber').length};}
function platformStats(m){
 const items={};for(const e of data.entries){if(e.type!=='uber'||!e.date.startsWith(m))continue;
 const k=platformOf(e);if(!items[k])items[k]={name:k,gross:0,net:0,proofs:0};
 items[k].gross+=e.gross;items[k].net+=cashDelta(e);items[k].proofs+=proofList(e).length;
 }
 return Object.values(items).sort((a,b)=>b.gross-a.gross).map(x=>({...x,gross:money(x.gross),net:money(x.net)}));
}
function forecast(m){const exp=billTotal(m),sal=data.settings.salary,startDate=data.settings.initialDate||dt(),startMonth=startDate.slice(0,7);const starting=m<startMonth?0:money(Number(data.settings.initialCash)+(m===startMonth?0:data.entries.filter(e=>e.date>=startDate&&e.date<m+"-01").reduce((s,e)=>s+cashDelta(e),0)));return {expenses:exp,salary:sal,starting,need:money(Math.max(0,exp-sal-starting)),left:money(sal+starting-exp)};}
function monthPanel(){return `<div class="monthstrip"><div><div class="eyebrow">Planejamento & acompanhamento</div><h1>${esc(monname(selectedMonth))}</h1></div><div class="monthcontrols"><button type="button" class="iconbtn" data-action="prev" aria-label="Mês anterior">‹</button><button type="button" class="iconbtn" data-action="next" aria-label="Próximo mês">›</button></div></div>`}
function nav(){return `<nav class="nav" aria-label="Navegação principal">${[['home','Início'],['entries','Lançar'],['bills','Contas'],['goals','Metas'],['league','Liga'],['history','Histórico']].map(([k,v])=>`<button type="button" data-nav="${k}" class="${page===k?'on':''}" ${page===k?'aria-current="page"':''}><span class="symbol" aria-hidden="true">${titleIcon(k)}</span><span class="nav-label">${v}</span></button>`).join('')}</nav>`}
function render(){const root=document.getElementById('app');root.innerHTML=`<header class="head"><div class="brand"><div class="mark">↗</div><div><strong>Rota Financeira</strong><div class="eyebrow">Meu painel pessoal</div></div></div><button class="gear" data-nav="settings" aria-label="Configurações">⚙</button></header>${page==='settings'?'':monthPanel()}${({home:renderHome,entries:renderEntries,bills:renderBills,goals:renderGoals,league:renderLeague,history:renderHistory,settings:renderSettings})[page]()}<footer class="footer">Dados armazenados neste navegador/dispositivo. Para não perdê-los, exporte um backup JSON regularmente em Ajustes. O saldo depende dos seus lançamentos.</footer>${nav()}`}
function renderHome(){const f=forecast(selectedMonth),a=actualStats(selectedMonth),paid=billItems(selectedMonth).filter(b=>billPaid(b,selectedMonth)).length,total=billItems(selectedMonth).length;const extraIncome=money(data.entries.filter(e=>e.date.startsWith(selectedMonth)&&e.type==='income'&&e.category!=='Salário').reduce((sum,e)=>sum+e.amount,0));const rest=money(Math.max(0,f.need-a.netUber-extraIncome));const todayCash=cash();
 return `${!data.bills.length?'<div class="notice mint-note">Seu controle está vazio. Importe o arquivo privado com seus dados iniciais em <b>Ajustes → Restaurar backup</b>, depois de criar a senha. <button class="btn sm secondary" data-nav="settings">Ir para Ajustes</button></div>':''}<section class="panel hero"><div class="row"><span class="eyebrow" style="color:#bae9d9">Saldo calculado atual</span><span class="pill">🔒 Cofre protegido</span></div><div class="big">${fmt(todayCash)}</div><div class="small" style="color:#b6d8d3">Saldo inicial ${fmt(data.settings.initialCash)} em ${data.settings.initialDate.split('-').reverse().join('/')} + lançamentos registrados até hoje.</div><div class="divider" style="background:#315b57"></div><div class="row"><span class="small">Última meta: cobrir contas do mês</span><strong>${fmt(f.need)}</strong></div><div class="progt" style="margin-top:9px"><div style="width:${f.need?Math.min(100,Math.max(0,a.netUber/f.need*100)):100}%"></div></div><div class="row" style="margin-top:8px"><span class="small">Apps líquidos registrados ${fmt(a.netUber)}</span><span class="small">${f.need?Math.round(Math.max(0,a.netUber/f.need*100)):100}%</span></div></section>
 <div class="tiles"><div class="panel"><div class="eyebrow">Salário previsto</div><div class="tilevalue">${fmt(f.salary)}</div><div class="small muted">Conforme salário informado</div></div><div class="panel"><div class="eyebrow">Contas previstas</div><div class="tilevalue">${fmt(f.expenses)}</div><div class="small muted">${paid}/${total} registradas como pagas</div></div><div class="panel"><div class="eyebrow">Plataformas no mês</div><div class="tilevalue mint">${fmt(a.netUber)}</div><div class="small muted">${a.nUber} dias/turnos registrados</div></div><div class="panel"><div class="eyebrow">Diferença a cobrir</div><div class="tilevalue ${rest>0?'red':'mint'}">${fmt(rest)}</div><div class="small muted">Estimativa, não cobrança</div></div></div>
 
  ${dueNotice(selectedMonth)}
 <section class="panel"><div class="row"><h2 class="h2">Visão do mês</h2><span class="badge">PROJEÇÃO</span></div><div class="details"><div class="muted">Contas previstas</div><div>${fmt(f.expenses)}</div><div class="muted">Salário líquido previsto</div><div>${fmt(f.salary)}</div><div class="muted">Saldo inicial considerado</div><div>${fmt(f.starting)}</div><div class="muted">Apps líquidos para cobrir diferença</div><div class="${f.need>0?'red':'mint'}">${fmt(f.need)}</div></div><div class="divider"></div><div class="btnrow"><button class="btn grow" data-nav="entries">＋ Registrar ganho/gasto</button><button class="btn secondary grow" data-nav="bills">Ver contas</button></div><p class="hint">Projeção baseada nos lançamentos e no saldo inicial informados. Despesas futuras não cadastradas e encargos desconhecidos não estão incluídos.</p></section>
 <section class="panel"><div class="row"><div><h2 class="h2">🏆 Liga da Evolução</h2><p class="hint">Planeje metas realistas com antecedência, preserve seus descansos e acompanhe pontos provisórios por comprovante. Sem premiação ativa.</p></div><button class="btn sm secondary" data-nav="league">Abrir Liga</button></div></section>
 ${renderMiniChart()}
 <section class="panel"><div class="row"><h2 class="h2">Próximas contas deste mês</h2><button class="btn sm outline" data-nav="bills">Todas</button></div>${billItems(selectedMonth).slice(0,5).map(b=>billCard(b,selectedMonth,true)).join('')||'<div class="empty">Sem contas cadastradas.</div>'}</section>`;
}
function renderMiniChart(){let months=Array.from({length:6},(_,i)=>mshift(selectedMonth,i));let vals=months.map(m=>forecast(m).left);let max=Math.max(1,...vals.map(v=>Math.abs(v)));return `<section class="panel"><h2 class="h2">Projeção dos próximos 6 meses</h2><div class="chartrows">${months.map((m,i)=>`<div class="chartcol"><div class="plot ${vals[i]<0?'negative':''}" title="${esc(monname(m))}: ${fmt(vals[i])}" style="height:${Math.max(4,Math.abs(vals[i])/max*105)}px"></div><label>${esc(monshort(m))}</label></div>`).join('')}</div><p class="hint">Saldo teórico do mês após contas cadastradas e salário fixo de ${fmt(data.settings.salary)}. Atualize a previsão de salário sempre que sua renda mudar.</p></section>`}
function billCard(b,m,compact=false){const p=billPaid(b,m);return `<div class="lineitem"><div class="desc"><strong>${esc(b.title)} ${p?'✓':''}</strong><span>${esc(paydate(b,m))}${b.reference?' · Fat. '+esc(monshort(b.reference)):''}</span>${!compact&&p?`<span class="mint">Pago ${fmt(p.amount)} em ${esc(p.date.split('-').reverse().join('/'))}</span>`:''}</div><div style="text-align:right"><div class="amount ${p?'mint':''}">${fmt(b.amount)}</div>${!compact?`<div class="btnrow" style="justify-content:flex-end;margin-top:8px"><button class="btn sm ${p?'outline':'secondary'}" data-action="${p?'unpay':'pay'}" data-id="${esc(b.id)}">${p?'Desfazer':'Pagar'}</button><button class="btn sm outline" data-action="editBill" data-id="${esc(b.id)}">Editar</button></div>`:`<span class="small ${p?'mint':'amber'}">${p?'Pago':'Pendente'}</span>`}</div></div>`}
function renderEntries(){const a=actualStats(selectedMonth);let es=data.entries.filter(e=>e.date.startsWith(selectedMonth)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,80);return `<section class="panel"><h2 class="h2">Registrar movimentação</h2><div class="seg entry-seg" role="group" aria-label="Tipo de movimentação">${[['uber','🏍','Corridas /<br>entregas','Corridas e entregas'],['expense','↓','Gasto','Gasto'],['income','↑','Entrada','Entrada']].map(([v,icon,label,aria])=>`<button type="button" data-mode="${v}" aria-label="${aria}" aria-pressed="${entryMode===v}" class="${entryMode===v?'active':''}"><span class="entry-tab-icon" aria-hidden="true">${icon}</span><span class="entry-tab-label">${label}</span></button>`).join('')}</div><form data-form="entry"><div class="formgrid"><div class="field"><label for="entrydate">Data</label><input id="entrydate" name="date" type="date" value="${dt()}" required></div><div class="field"><label for="entryamount">${entryMode==='uber'?'Faturamento bruto (R$)':'Valor (R$)'}</label><input id="entryamount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="100,00" required></div></div>${entryMode==='uber'?`${platformInput()}<div class="formgrid"><div class="field"><label>Gasolina (R$)</label><input name="fuel" type="number" min="0" step="0.01" value="0" required></div><div class="field"><label>Passe/taxa (R$)</label><input name="fee" type="number" min="0" step="0.01" value="0" required></div></div><div class="field"><label>Outros custos da plataforma (R$)</label><input name="other" type="number" min="0" step="0.01" value="0"></div>`:`<div class="field"><label>Categoria</label><select name="category">${(entryMode==='expense'?['Casa','Transporte','Saúde','Moto/manutenção','Lazer','Outros']:['Salário','Extra','Presente','Reembolso','Outros']).map(s=>`<option>${s}</option>`).join('')}</select></div>${entryMode==='expense'?`<div class="field"><label>Forma de pagamento</label><select name="paymentMethod"><option value="cash">Pix, dinheiro ou débito (sai do saldo)</option><option value="credit">Cartão de crédito (não sai do saldo agora)</option></select><div class="hint">Compras no crédito serão pagas na fatura. Atualize o valor da fatura em Contas para refletir novas compras.</div></div>`:''}`}<div class="field"><label>Observação (opcional)</label><input name="note" placeholder="Ex.: corrida após o trabalho / mercado"></div><button class="btn block" type="submit">Salvar lançamento</button></form><p class="hint">Para participar da Liga, defina antes a meta total bruta do dia (somando os aplicativos), registre <b>um total diário por plataforma</b> (Uber, 99, iFood etc.) e anexe os prints de cada aplicativo. Combustível compartilhado deve ser lançado <b>uma única vez</b>, para não descontar em dobro. Os pontos são provisórios.</p></section>
 <div class="tiles"><div class="panel"><div class="eyebrow">Apps bruto</div><div class="tilevalue">${fmt(a.gross)}</div></div><div class="panel"><div class="eyebrow">Apps líquido</div><div class="tilevalue mint">${fmt(a.netUber)}</div></div><div class="panel"><div class="eyebrow">Outras entradas</div><div class="tilevalue">${fmt(a.income)}</div></div><div class="panel"><div class="eyebrow">Gastos registrados</div><div class="tilevalue red">${fmt(a.expense)}</div></div></div>
 <section class="panel"><h2 class="h2">Ganhos por plataforma</h2>${platformStats(selectedMonth).length?platformStats(selectedMonth).map(p=>`<div class="lineitem"><div class="desc"><strong>${esc(p.name)}</strong><span>${p.proofs} print(s) anexado(s) · ainda não verificado(s)</span></div><div style="text-align:right"><strong>${fmt(p.gross)}</strong><div class="small muted">Líquido ${fmt(p.net)}</div></div></div>`).join(''):'<p class="hint">Registre um ganho em Uber, 99, Maxim, inDrive, iFood ou outra plataforma para comparar os resultados.</p>'}</section>
 <section class="panel"><h2 class="h2">Lançamentos do mês</h2>${es.length?es.map(e=>`<div class="lineitem"><div class="desc"><strong>${esc(e.type==='uber'?'🏍 '+platformOf(e):e.type==='income'?'↑ '+e.category:e.type==='bill'?'▤ '+e.note:'↓ '+e.category)}</strong><span>${esc(e.date.split('-').reverse().join('/'))}${e.note&&e.type!=='bill'?' · '+esc(e.note):''}</span>${e.type==='uber'?`<span>Bruto ${fmt(e.gross)} · Custos ${fmt(e.fuel+e.fee+e.other)}</span><span class="${proofList(e).length?'amber':'muted'}">${proofList(e).length?`${proofList(e).length} print(s) salvo(s) · ainda NÃO validado(s)`:'Sem comprovante para ranking'}</span>`:e.type==='expense'&&e.paymentMethod==='credit'?`<span>Crédito: ${fmt(e.amount)} na fatura, sem saída de caixa aqui</span>`:''}</div><div style="text-align:right"><div class="amount ${cashDelta(e)>=0?'mint':'red'}">${cashDelta(e)>=0?'+':'−'} ${fmt(Math.abs(cashDelta(e)))}</div>${e.type!=='bill'?`<div class="btnrow" style="margin-top:7px;justify-content:flex-end">${e.type==='uber'?`<button class="btn sm secondary" data-action="${proofList(e).length?'viewProof':'proof'}" data-id="${esc(e.id)}">${proofList(e).length?'🖼 Ver prints':'📷 Anexar prints'}</button>`:''}<button class="btn sm outline" data-action="editEntry" data-id="${esc(e.id)}">Editar</button><button class="btn sm outline" data-action="deleteEntry" data-id="${esc(e.id)}">Excluir</button></div>`:''}</div></div>`).join(''):'<div class="empty">Nenhum lançamento neste mês.</div>'}</section>`}
function renderBills(){const bills=billItems(selectedMonth),paid=bills.filter(b=>billPaid(b,selectedMonth)).reduce((s,b)=>s+billPaid(b,selectedMonth).amount,0);return `<section class="panel"><div class="seg"><button data-billtab="bills" class="${billTab==='bills'?'active':''}">Contas e cartões</button><button data-billtab="debts" class="${billTab==='debts'?'active':''}">Empréstimos</button></div>${billTab==='bills'?`<div class="row"><div><div class="eyebrow">Previsto para ${esc(monshort(selectedMonth))}</div><div class="tilevalue">${fmt(billTotal(selectedMonth))}</div><div class="small muted">Pagamentos registrados ${fmt(paid)}</div></div><button class="btn sm" data-action="newBill">＋ Conta</button></div><div class="divider"></div>${bills.length?bills.map(b=>billCard(b,selectedMonth)).join(''):'<div class="empty">Sem contas para este mês.</div>'}`:`<div class="row"><div><h2 class="h2">Contratos cadastrados</h2><div class="hint">Atualize parcelas conforme forem liquidadas.</div></div><button class="btn sm" data-action="newDebt">＋ Empréstimo</button></div>${data.debts.map(d=>`<div class="lineitem"><div class="desc"><strong>${esc(d.title)}</strong><span>${d.remaining} parcelas restantes · ${d.installment>0?fmt(d.installment)+'/parcela':'Valor a confirmar'}</span><span>${esc(d.note||'')}</span><span class="loantag">${d.deducted?'✓ Já descontado do salário líquido':'Fora da folha'}</span></div><div style="text-align:right"><div class="amount">${fmt(d.totalRemaining)}</div><button class="btn sm outline" style="margin-top:8px" data-action="editDebt" data-id="${esc(d.id)}">Atualizar</button></div></div>`).join('')}<div class="notice spaced">Empréstimos já descontados do salário líquido não devem ser lançados novamente como despesas; registre apenas parcelas que ainda não foram consideradas.</div>`}</section>`}
function renderGoals(){const f=forecast(selectedMonth);const a=actualStats(selectedMonth);return `<section class="panel"><h2 class="h2">Sua meta de renda extra</h2><div class="eyebrow">Valor líquido necessário para as contas</div><div class="tilevalue" style="font-size:29px">${fmt(f.need)}</div><div class="metric"><span>Acumulado registrado</span><strong>${fmt(a.netUber)}</strong></div><div class="progt"><div style="width:${f.need?Math.min(100,Math.max(0,a.netUber/f.need*100)):100}%"></div></div><div class="metric"><span>Falta para a meta</span><strong class="${Math.max(0,f.need-a.netUber)>0?'amber':'mint'}">${fmt(Math.max(0,f.need-a.netUber))}</strong></div><p class="hint">A meta se ajusta automaticamente quando você altera o salário ou as contas. Os custos de cada aplicativo são descontados dos ganhos brutos. Não lance a mesma gasolina em dois aplicativos.</p><div class="btnrow"><button class="btn secondary grow" data-nav="entries">Registrar corrida</button><button class="btn grow" data-nav="league">🏆 Abrir Liga</button></div></section><section class="panel"><div class="row"><h2 class="h2">Metas de patrimônio</h2><button class="btn sm" data-action="newGoal">＋ Meta</button></div>${data.goals.length?data.goals.map(g=>`<div class="lineitem"><div class="desc"><strong>${esc(g.title)}</strong><span>${esc(g.note||'')}</span><div class="bar"><div style="width:${g.target?Math.min(100,Math.max(0,g.current/g.target*100)):0}%"></div></div><span>${Math.round(g.target?g.current/g.target*100:0)}% concluída</span></div><div style="text-align:right"><div class="amount">${fmt(g.current)}<div class="small muted">de ${fmt(g.target)}</div></div><button class="btn sm outline" style="margin-top:8px" data-action="editGoal" data-id="${esc(g.id)}">Atualizar</button></div></div>`).join(''):'<div class="empty">Crie sua primeira meta financeira.</div>'}</section><section class="panel"><h2 class="h2">Princípio do plano</h2><p class="hint">Primeiro pague as obrigações essenciais, evite novas dívidas de cartão, construa uma reserva inicial e só depois aumente investimentos. Metas informadas aqui representam valores que você efetivamente separou; não alteram o saldo da carteira automaticamente.</p></section>`}
// LIGA DA EVOLUCAO (versao local): qualquer ponto aqui e apenas simulacao.
// Premiacao requer validacao externa assinada pelo servidor e revisao independente.
const League = (()=>{
  const monday = date => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const eligibleEntry=(date,entries)=>{
    const day=entries.filter(e=>e.type==='uber'&&e.date===date);
    if(!day.length)return {ok:false,reason:'Sem ganho de aplicativo registrado.'};
    const names=new Set();let gross=0;
    for(const e of day){
      const p=platformKey(platformOf(e));
      if(names.has(p))return {ok:false,reason:'Há registros duplicados da mesma plataforma no dia. Consolide os valores.'};
      names.add(p);
      if(!(Number(e.gross)>0))return {ok:false,reason:'Faturamento inválido.'};
      const proofs=proofList(e);
      if(!proofs.length||!proofs.some(p=>p.sha256&&(p.image||p.imageRef)&&p.status==='local_pending'))return {ok:false,reason:`Falta print no aplicativo ${platformOf(e)}.`};
      gross+=Number(e.gross);
    }
    return {ok:true,gross:money(gross),platforms:day.length,entries:day};
  };
  function evaluate(plans, entries, month, today){
    const days=(plans||[]).filter(p=>p.date?.startsWith(month)).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const weekly={};let preview=0,verified=0,proofs=0,rest=0,worked=0,bonuses=0;
    const rows=[];
    for(const p of days){
      const week=monday(p.date);
      const w=weekly[week]||(weekly[week]={key:week,points:0,qualified:0,rest:0,awarded:0,bonus:0});
      if(p.kind==='rest'){
        rest++;
        if(p.date<=today)w.rest++;
        rows.push({date:p.date,kind:'rest',status:p.date<=today?'Descanso respeitado':'Descanso planejado',points:0});
        continue;
      }
      worked++;
      if(p.date>today){rows.push({date:p.date,kind:'work',status:'Planejado',target:p.grossTarget,points:0});continue;}
      const evidence=eligibleEntry(p.date,entries);
      if(!evidence.ok){rows.push({date:p.date,kind:'work',status:evidence.reason,target:p.grossTarget,points:0});continue;}
      proofs++;
      if(w.awarded>=4){rows.push({date:p.date,kind:'work',status:'Print pendente · teto semanal de 4 dias atingido',target:p.grossTarget,gross:evidence.gross,points:0});continue;}
      w.awarded++;
      w.qualified++;
      const goalHit=evidence.gross>=p.grossTarget;
      const score=10+(goalHit?5:0);
      w.points+=score;preview+=score;
      rows.push({date:p.date,kind:'work',status:'Print anexado · aguardando revisão',target:p.grossTarget,gross:evidence.gross,goalHit,points:score});
    }
    // A pontuacao e somente pre-visualizacao e nunca uma certificacao de vencedor.
    for(const w of Object.values(weekly)){
      if(w.qualified>=3){w.bonus=10;w.points+=10;preview+=10;bonuses++}
    }
    return {preview,verified,proofs,rest,worked,bonuses,days:rows,weeks:Object.values(weekly).sort((a,b)=>b.points-a.points||a.key.localeCompare(b.key))};
  }
  return {evaluate,eligibleEntry,monday};
})();
function leaguePlans(){if(!Array.isArray(data.leaguePlans))data.leaguePlans=[];return data.leaguePlans}
function nextDay(){const x=new Date(`${dt()}T12:00:00`);x.setDate(x.getDate()+1);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function maxPlanDay(){const x=new Date(`${dt()}T12:00:00`);x.setDate(x.getDate()+45);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function renderLeague(){
 const a=League.evaluate(leaguePlans(),data.entries,selectedMonth,dt());
 const restTxt=a.rest?`${a.rest} dia(s) de descanso planejado`: 'Nenhum descanso cadastrado neste mês';
 return `<section class="panel hero"><div class="eyebrow" style="color:#b7f4dd">Liga da Evolução • fase de testes</div><h2 class="h2" style="margin-top:10px">Competição justa, sem corrida por faturamento</h2><p class="hint">O que vale é constância e atingir uma meta pessoal definida com antecedência. Ganhar acima da meta não dá pontos extras. Descanso não reduz sua pontuação.</p><div class="tiles" style="margin:14px 0 0"><div class="panel" style="background:#152b2b"><div class="eyebrow">Pontos estimados</div><div class="tilevalue mint">${a.preview} pts</div></div><div class="panel" style="background:#152b2b"><div class="eyebrow">Pontos oficiais</div><div class="tilevalue">0 pts</div></div></div><div class="small" style="color:#c2d9d5">${a.proofs} dia(s) documentado(s) para análise · ${esc(restTxt)}</div></section>
 <div class="notice">⚠️ <b>Nenhum print é validado automaticamente.</b> Pontos estimados não entram em ranking público, sorteio ou premiação. Para classificar vencedores, será necessário servidor independente com verificação de data/valor, análise de fraudes, regulamento e aprovação jurídica.</div>
 <section class="panel"><div class="row"><h2 class="h2">Meu planejamento antecipado</h2><span class="badge">TRAVADO POR DATA</span></div><p class="hint">Defina a meta bruta do dia <b>antes</b> da data do trabalho, ou programe descanso. Metas cadastradas não podem ser alteradas depois; isso impede ajustar a meta ao valor recebido. Um dia sem atividade não gera punição.</p>
 <form data-form="leaguePlan"><div class="formgrid"><div class="field"><label>Dia futuro</label><input type="date" name="date" min="${nextDay()}" max="${maxPlanDay()}" value="${nextDay()}" required></div><div class="field"><label>Atividade</label><select name="kind"><option value="work">Dia de trabalho</option><option value="rest">Dia de descanso</option></select></div></div><div class="field"><label>Meta bruta pessoal (R$) — para dia de trabalho</label><input name="grossTarget" type="number" inputmode="decimal" min="20" max="400" step="0.01" value="100" required></div><button class="btn block" type="submit">Planejar e travar este dia</button></form><p class="hint">O valor é só uma meta de referência. O aplicativo nunca recomenda estender turnos, correr riscos ou deixar de descansar para atingir pontos.</p></section>
 <section class="panel"><h2 class="h2">Como se pontua</h2><div class="details"><div>Print(s) por plataforma, somados uma vez por dia</div><div>10 pts</div><div>Bater a meta bruta antecipada</div><div>+5 pts</div><div>3 dias documentados na semana (consistência)</div><div>+10 pts</div><div>Mais dinheiro ou mais horas</div><div>0 pts extras</div></div><p class="hint">Máximo de 4 dias pontuáveis por semana; no máximo 70 pontos semanais. Tudo continua provisório até revisão externa. Dias de descanso e metas não cumpridas não retiram pontos.</p></section>
 <section class="panel"><h2 class="h2">Meu histórico de metas</h2>${a.days.length?a.days.map(row=>`<div class="lineitem"><div class="desc"><strong>${row.kind==='rest'?'🌿 Descanso':'🏍 Meta'} · ${esc(row.date.split('-').reverse().join('/'))}</strong><span>${row.kind==='work'?`Meta ${fmt(row.target)}${row.gross!==undefined?' · registrado '+fmt(row.gross):''}`:'Sem exigência de faturamento'}</span><span>${esc(row.status)}</span></div><div class="amount ${row.points?'mint':'muted'}">${row.points?`+${row.points} pts`:'—'}</div></div>`).join(''):'<div class="empty">Nenhum dia planejado para este mês. Defina sua primeira meta para amanhã.</div>'}</section>
 <section class="panel"><h2 class="h2">Melhores semanas deste mês (pessoal)</h2>${a.weeks.length?a.weeks.map((w,i)=>`<div class="lineitem"><div class="desc"><strong>${i+1}º · semana iniciada em ${esc(w.key.split('-').reverse().join('/'))}</strong><span>${w.qualified} dia(s) com prova · ${w.rest} descanso(s) · bônus ${w.bonus} pts</span></div><div class="amount">${w.points} pts</div></div>`).join(''):'<div class="empty">As semanas aparecerão conforme você planejar e registrar.</div>'}<p class="hint">Isto compara somente suas próprias semanas, não outros usuários. O Top 3 global depende da futura verificação pelo servidor e não está ativo.</p></section>`;
}

function renderHistory(){const a=actualStats(selectedMonth);const snap=data.snapshots.find(s=>s.month===selectedMonth);const snaps=[...data.snapshots].sort((x,y)=>y.month.localeCompare(x.month));const first=[...data.snapshots].sort((x,y)=>x.month.localeCompare(y.month))[0];return `<section class="panel"><h2 class="h2">Antes e depois, sem perder o passado</h2><p class="hint">Ao fechar o mês, salve uma fotografia dos indicadores. Ela fica protegida no cofre e permanece registrada para comparar seus meses.</p><div class="details"><div class="muted">Apps líquido neste mês</div><div>${fmt(a.netUber)}</div><div class="muted">Outras entradas lançadas</div><div>${fmt(a.income)}</div><div class="muted">Gastos lançados</div><div>${fmt(a.expense)}</div><div class="muted">Contas pagas registradas</div><div>${billItems(selectedMonth).filter(b=>billPaid(b,selectedMonth)).length}</div><div class="muted">Saldo calculado hoje</div><div>${fmt(cash())}</div></div><div class="divider"></div>${snap?`<div class="notice mint-note">Fotografia salva em ${esc(snap.createdAt)}. Saldo na época: ${fmt(snap.balance)}. Plataformas no mês: ${fmt(snap.uberNet)}.</div>`:''}<button class="btn block" data-action="snapshot">${snap?'Atualizar fotografia deste mês':'Salvar fotografia do mês'}</button></section><section class="panel"><h2 class="h2">Evolução registrada</h2>${snaps.length?snaps.map(s=>`<div class="lineitem"><div class="desc"><strong>${esc(monname(s.month))}</strong><span>Apps líquido ${fmt(s.uberNet)} · ${s.nUber} lançamentos de plataformas</span><span>Contas do mês ${fmt(s.planned)} · despesas lançadas ${fmt(s.expense)}</span><span>Empréstimos cadastrados ${fmt(s.debtsTotal||0)}</span></div><div style="text-align:right"><div class="amount ${s.balance>=0?'mint':'red'}">${fmt(s.balance)}</div>${first&&s.month!==first.month?`<span class="small ${s.balance-first.balance>=0?'mint':'red'}">${s.balance-first.balance>=0?'+':''}${fmt(s.balance-first.balance)} vs. 1º registro</span>`:''}</div></div>`).join(''):'<div class="empty">Nenhuma fotografia salva. Faça a primeira no fim do mês para começar o histórico.</div>'}</section><section class="panel"><h2 class="h2">Backup do histórico</h2><p class="hint">Seus dados ficam criptografados neste dispositivo. Exporte o cofre para evitar perda ao trocar de aparelho.</p><div class="btnrow"><button class="btn secondary grow" data-action="report">↓ Relatório do mês (.txt)</button><button class="btn outline grow" data-action="export">↓ Backup protegido (.json)</button></div></section>`}
function renderSettings(){const s=data.settings;return `<div class="monthstrip"><div><div class="eyebrow">Personalização e segurança</div><h1>Ajustes</h1></div></div><section class="panel"><h2 class="h2">Dados do planejamento</h2><form data-form="settings"><div class="field"><label>Nome do painel</label><input name="name" value="${esc(s.name)}" required></div><div class="field"><label>Salário líquido atual (já descontados os empréstimos da folha)</label><input name="salary" type="number" step="0.01" min="0" value="${s.salary}" required></div><div class="formgrid"><div class="field"><label>Saldo inicial (R$)</label><input name="initialCash" type="number" step="0.01" value="${s.initialCash}" required></div><div class="field"><label>Data do saldo inicial</label><input name="initialDate" type="date" value="${s.initialDate}" required></div></div><div class="field"><label>Custo de aplicativo padrão por noite (referência)</label><input name="uberCost" type="number" min="0" step="0.01" value="${s.uberCost}" required></div><button class="btn block" type="submit">Salvar ajustes</button></form><p class="hint">O salário é previsão, não entrada recebida. Quando o dinheiro cair, registre o salário em Lançar → Entrada. Atualize o salário líquido se os descontos na folha mudarem.</p></section><section class="panel"><h2 class="h2">Seus dados e backups</h2><div class="notice mint-note">Os dados são criptografados antes de serem gravados. O envio para a nuvem só ocorre quando você usa a opção de envio.</div><div class="btnrow"><button class="btn grow" data-action="export">↓ Exportar JSON</button><button class="btn secondary grow" data-action="import">↑ Restaurar backup</button></div><input class="fileinput" id="importFile" type="file" accept="application/json,.json"><div class="divider"></div><button class="btn danger block" data-action="reset">Zerar este aparelho</button></section><section class="panel"><h2 class="h2">Privacidade e lembretes</h2><p class="hint">As informações ficam criptografadas no aparelho e não são legíveis sem a senha. A senha não é recuperável. Backups exportados também são criptografados.</p><form data-security="change"><div class="field"><label>Senha atual</label><input type="password" name="old" minlength="8" autocomplete="current-password" required></div><div class="field"><label>Nova senha do cofre</label><input type="password" name="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Confirmar nova senha</label><input type="password" name="confirm" minlength="8" autocomplete="new-password" required></div><button type="submit" class="btn secondary block">Alterar senha do cofre</button></form><div class="btnrow spaced"><button class="btn secondary grow" data-action="lock">🔒 Bloquear agora</button><button class="btn outline grow" data-action="notification">🔔 Ativar alertas</button></div><p class="hint">Na PWA, avisos só funcionam com ela aberta. No projeto Android compilado, lembretes locais podem tocar com o app fechado após você conceder a permissão; o sistema pode atrasá-los.</p></section><section class="panel"><h2 class="h2">Nuvem criptografada (opcional)</h2><p class="hint">Conecte um projeto Supabase seu para guardar uma cópia criptografada e restaurá-la em outro aparelho. O serviço precisa estar configurado com as regras de acesso do projeto; sem isso os dados permanecem somente neste celular.</p><div id="cloudStatus" class="notice mint-note">${cloudSession?'Conectado ao serviço em nuvem':'Nuvem não conectada'}</div><form data-security="cloud"><div class="field"><label>URL do projeto Supabase</label><input name="url" type="url" placeholder="https://seu-projeto.supabase.co" value="${esc(getCloudCfg().url||'')}" required></div><div class="field"><label>Chave publicável (anon/publishable — nunca service_role)</label><input name="anon" value="${esc(getCloudCfg().anon||'')}" autocomplete="off" required></div><div class="field"><label>E-mail do seu cadastro</label><input name="email" type="email" value="${esc(getCloudCfg().email||'')}" autocomplete="username" required></div><div class="field"><label>Senha da conta da nuvem (pode ser diferente da senha do cofre)</label><input name="password" type="password" minlength="8" autocomplete="current-password" required></div><div class="btnrow"><button class="btn secondary grow" name="mode" value="signup" type="submit">Criar conta</button><button class="btn grow" name="mode" value="login" type="submit">Entrar</button></div></form><div class="btnrow spaced"><button class="btn secondary grow" data-action="cloudUpload">↑ Enviar cofre</button><button class="btn outline grow" data-action="cloudDownload">↓ Restaurar cofre</button></div><p class="hint">A sincronização é manual nesta versão: envie depois das alterações e restaure em outros aparelhos. Não edite simultaneamente em dois celulares sem sincronizar: a substituição não mescla mudanças.</p></section><section class="panel"><h2 class="h2">Instalação no celular</h2><p class="hint">Se hospedado em HTTPS, este projeto funciona como aplicativo web instalável (PWA). No Chrome para Android, abra o site, toque no menu ⋮ e escolha “Adicionar à tela inicial” ou “Instalar app”, quando disponível. Ao abrir arquivos content:// ou file://, o navegador pode bloquear o salvamento dos prints. Para uso diário e armazenamento confiável, hospede em HTTPS e instale pelo Chrome. Faça backups frequentes.</p></section>`}
function showModal(title,html){document.getElementById('modalRoot').innerHTML=`<div class="modalwrap"><div class="sheet" role="dialog" aria-modal="true"><div class="sheethead"><h2>${esc(title)}</h2><button class="close" data-action="close">×</button></div>${html}</div></div>`}
function closeModal(){document.getElementById('modalRoot').innerHTML=''}
const findBill=id=>data.bills.find(b=>b.id===id);
function billForm(b){let exists=!!b;let o=b||{id:'',title:'',amount:'',kind:'once',month:selectedMonth,reference:'',day:'20',category:'Outros'};showModal(exists?'Editar conta':'Nova conta',`<form data-form="bill"><input type="hidden" name="id" value="${esc(o.id)}"><div class="field"><label>Descrição</label><input name="title" value="${esc(o.title)}" required placeholder="Ex.: internet"></div><div class="formgrid"><div class="field"><label>Valor (R$)</label><input name="amount" type="number" step="0.01" min="0.01" value="${o.amount}" required></div><div class="field"><label>Categoria</label><input name="category" value="${esc(o.category)}" required></div></div><div class="field"><label>Tipo de lançamento</label><select name="kind"><option value="once" ${o.kind==='once'?'selected':''}>Somente no mês escolhido</option><option value="recurring" ${o.kind==='recurring'?'selected':''}>Repete mensalmente</option></select></div><div class="formgrid"><div class="field"><label>Mês para pagar / mês de início</label><input name="month" type="month" value="${esc(o.kind==='once'?o.month:o.start||selectedMonth)}" required></div><div class="field"><label>Último mês (opcional)</label><input name="end" type="month" value="${esc(o.end||'')}"></div></div><div class="field"><label>Vencimento ou observação de prazo</label><input name="day" value="${esc(o.day||'')}" placeholder="Ex.: 20, ou 5º dia útil"></div><p class="hint">Para cartão de crédito, selecione o mês previsto para pagar, que pode ser diferente do mês da fatura. Editar o valor não altera pagamentos já registrados.</p><div class="btnrow"><button type="submit" class="btn grow">Salvar</button>${exists?`<button type="button" class="btn danger" data-action="deleteBill" data-id="${esc(o.id)}">Excluir</button>`:''}</div></form>`)}
function debtForm(d){let exists=!!d,o=d||{id:'',title:'',installment:0,remaining:0,totalRemaining:0,deducted:false,note:''};showModal(exists?'Atualizar empréstimo':'Novo empréstimo',`<form data-form="debt"><input name="id" type="hidden" value="${esc(o.id)}"><div class="field"><label>Nome</label><input name="title" value="${esc(o.title)}" required></div><div class="formgrid"><div class="field"><label>Valor de parcela (R$)</label><input name="installment" type="number" min="0" step="0.01" value="${o.installment}" required></div><div class="field"><label>Parcelas restantes</label><input name="remaining" type="number" min="0" step="1" value="${o.remaining}" required></div></div><div class="field"><label>Saldo devedor informado (R$)</label><input name="totalRemaining" type="number" min="0" step="0.01" value="${o.totalRemaining}" required></div><div class="field"><label>Observação</label><textarea name="note">${esc(o.note)}</textarea></div><div class="field"><label><input type="checkbox" name="deducted" style="width:auto;min-height:0" ${o.deducted?'checked':''}> Já descontado na folha</label></div><div class="btnrow"><button class="btn grow" type="submit">Salvar</button>${exists?`<button type="button" class="btn danger" data-action="deleteDebt" data-id="${esc(o.id)}">Excluir</button>`:''}</div></form>`)}
function goalForm(g){let exists=!!g,o=g||{id:'',title:'',target:1000,current:0,note:''};showModal(exists?'Atualizar meta':'Nova meta',`<form data-form="goal"><input type="hidden" name="id" value="${esc(o.id)}"><div class="field"><label>Nome</label><input name="title" value="${esc(o.title)}" required></div><div class="formgrid"><div class="field"><label>Objetivo total (R$)</label><input name="target" type="number" min="1" step="0.01" value="${o.target}" required></div><div class="field"><label>Já reservado (R$)</label><input name="current" type="number" min="0" step="0.01" value="${o.current}" required></div></div><div class="field"><label>Descrição</label><textarea name="note">${esc(o.note)}</textarea></div><p class="hint">O valor reservado é acompanhado manualmente e não é debitado do saldo calculado.</p><div class="btnrow"><button class="btn grow" type="submit">Salvar</button>${exists?`<button type="button" class="btn danger" data-action="deleteGoal" data-id="${esc(o.id)}">Excluir</button>`:''}</div></form>`)}
function entryForm(e){showModal('Editar lançamento',`<form data-form="editEntry"><input type="hidden" name="id" value="${esc(e.id)}"><div class="field"><label>Tipo</label><input value="${esc(e.type==='uber'?platformOf(e):e.type==='income'?'Entrada':'Gasto')}" disabled></div><div class="formgrid"><div class="field"><label>Data</label><input type="date" name="date" required value="${e.date}"></div><div class="field"><label>${e.type==='uber'?'Faturamento bruto (R$)':'Valor (R$)'}</label><input type="number" min="0.01" step="0.01" name="amount" required value="${e.type==='uber'?e.gross:e.amount}"></div></div>${e.type==='uber'?`${platformInput(platformOf(e))}<div class="formgrid"><div class="field"><label>Gasolina</label><input type="number" min="0" step="0.01" name="fuel" value="${e.fuel}"></div><div class="field"><label>Passe</label><input type="number" min="0" step="0.01" name="fee" value="${e.fee}"></div></div><div class="field"><label>Outros custos da plataforma</label><input type="number" min="0" step="0.01" name="other" value="${e.other}"></div>`:`<div class="field"><label>Categoria</label><input name="category" value="${esc(e.category||'Outros')}"></div>${e.type==='expense'?`<div class="field"><label>Forma de pagamento</label><select name="paymentMethod"><option value="cash" ${e.paymentMethod!=='credit'?'selected':''}>Pix/dinheiro/débito</option><option value="credit" ${e.paymentMethod==='credit'?'selected':''}>Cartão de crédito</option></select></div>`:''}`}<div class="field"><label>Observação</label><input name="note" value="${esc(e.note||'')}"></div><button type="submit" class="btn block">Salvar alterações</button></form>`)}
// Imagens sao evidencias suplementares. A validacao real exige conferência externa.
function proofForm(e){
 if(e.type!=='uber')return;
 const count=proofList(e).length;
 showModal('Comprovar ganhos — '+platformOf(e),`<div class="notice">Você pode anexar vários prints por plataforma e dia para ajudar a comprovação, mas eles <b>não somam ganhos automaticamente</b>. A tela deve mostrar a data e, preferencialmente, o total do dia. Prints não equivalem a aprovação.</div><div class="details"><div>Aplicativo</div><div>${esc(platformOf(e))}</div><div>Data cadastrada</div><div>${esc(e.date.split('-').reverse().join('/'))}</div><div>Ganho bruto do dia</div><div>${fmt(e.gross)}</div><div>Imagens já salvas</div><div>${count} de 5</div></div><form data-proof="attach" data-id="${esc(e.id)}"><div class="field"><label>Selecione até ${Math.max(0,5-count)} print(s) (JPG, PNG ou WebP, 8 MB cada)</label><input type="file" name="proofFile" accept="image/png,image/jpeg,image/webp" ${count>=5?'disabled':''} multiple required></div><p class="hint">Ocultar nome, placa, dados de passageiros e localização. Os prints ficam criptografados no aparelho e no backup. Ainda não existe verificação automática nem envio a revisores.</p><button class="btn block" type="submit" ${count>=5?'disabled':''}>Adicionar comprovantes pendentes</button></form>`);
}
async function viewProof(e){
 if(!e||e.type!=='uber'||!proofList(e).length)return;
 try{
 const imgs=await Promise.all(proofList(e).map(p=>p.image||proofStoreRead(p.imageRef)));
 const gallery=imgs.map((image,i)=>`<div style="margin:16px 0;padding:10px;background:var(--panel2);border-radius:12px"><div class="row"><b>Print ${i+1}</b><button class="btn danger sm" data-action="removeSingleProof" data-id="${esc(e.id)}" data-index="${i}">Excluir</button></div><img alt="Captura de tela de ${esc(platformOf(e))}" src="${esc(image)}" style="display:block;width:100%;max-height:50vh;object-fit:contain;margin-top:10px;border:1px solid var(--line);border-radius:9px;background:#081118"></div>`).join('');
 showModal('Prints — '+platformOf(e),`<div class="notice">Status: aguardando revisão externa. Nenhuma imagem deste dispositivo é considerada verificada nem dá direito a premiação.</div><div class="details"><div>Plataforma</div><div>${esc(platformOf(e))}</div><div>Data</div><div>${esc(e.date.split('-').reverse().join('/'))}</div><div>Faturamento declarado</div><div>${fmt(e.gross)}</div><div>Total de anexos</div><div>${imgs.length}</div></div>${gallery}<button class="btn secondary block" data-action="proof" data-id="${esc(e.id)}">＋ Anexar outro print</button>`);
 }catch(err){alert('Não foi possível abrir o print: '+err.message)}
}

async function compressProof(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Envie uma imagem PNG, JPG ou WebP.');
 if(file.size>8*1024*1024)throw Error('A imagem não pode ultrapassar 8 MB.');
 let original=new Uint8Array(await file.arrayBuffer());
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',original))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível ler a imagem.'));img.src=url});
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>22000000)throw Error('Resolução de imagem inválida ou muito grande.');
  const maxWidth=1100,maxHeight=2400,scale=Math.min(1,maxWidth/img.naturalWidth,maxHeight/img.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Seu aparelho não conseguiu processar o print.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  let image=canvas.toDataURL('image/jpeg',0.77);
  if(image.length>350000){let factor=0.8;canvas.width=Math.round(canvas.width*factor);canvas.height=Math.round(canvas.height*factor);ctx.drawImage(img,0,0,canvas.width,canvas.height);image=canvas.toDataURL('image/jpeg',0.65)}
  if(image.length>350000)throw Error('Print muito grande para o armazenamento local. Tente uma captura menor.');
  return {sha256:hash,image,savedAt:new Date().toISOString(),status:'local_pending',method:'captura-de-tela'};
 }finally{URL.revokeObjectURL(url)}
}
async function smallProofFallback(p){
 const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Imagem inválida.'));img.src=p.image});
 const cv=document.createElement('canvas');let ratio=Math.min(1,680/img.naturalWidth,1400/img.naturalHeight);
 cv.width=Math.max(1,Math.round(img.naturalWidth*ratio));cv.height=Math.max(1,Math.round(img.naturalHeight*ratio));
 const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
 let image=cv.toDataURL('image/jpeg',.58);
 if(image.length>65000){cv.width=Math.max(1,Math.round(cv.width*.7));cv.height=Math.max(1,Math.round(cv.height*.7));ctx.drawImage(img,0,0,cv.width,cv.height);image=cv.toDataURL('image/jpeg',.48)}
 if(image.length>65000)throw Error('O armazenamento de arquivos locais está limitado. Use o aplicativo hospedado em HTTPS.');
 return {...p,image};
}
function payForm(b){showModal('Registrar pagamento',`<form data-form="pay"><input type="hidden" name="id" value="${esc(b.id)}"><div class="field"><label>Conta</label><input value="${esc(b.title)} · ${esc(monname(selectedMonth))}" disabled></div><div class="formgrid"><div class="field"><label>Data real do pagamento</label><input name="date" type="date" value="${dt()}" required></div><div class="field"><label>Valor pago (R$)</label><input name="amount" type="number" min="0.01" step="0.01" value="${b.amount}" required></div></div><p class="hint">Se pagou juros ou multa, registre o total efetivamente pago. O pagamento será incluído nos gastos da data informada.</p><button type="submit" class="btn block">Confirmar pagamento</button></form>`)}
function snapshotMonth(){const m=selectedMonth,a=actualStats(m);const s={month:m,createdAt:dt(),uberNet:a.netUber,gross:a.gross,income:a.income,expense:a.expense,nUber:a.nUber,balance:cash(),planned:billTotal(m),debtsTotal:money(data.debts.reduce((sum,d)=>sum+Number(d.totalRemaining||0),0)),goals:data.goals.map(x=>({title:x.title,current:x.current,target:x.target}))};const ind=data.snapshots.findIndex(x=>x.month===m);if(ind>=0)data.snapshots[ind]=s;else data.snapshots.push(s);save();render();toast('Fotografia de '+monshort(m)+' salva!')}
function reportText(){
 const m=selectedMonth,a=actualStats(m),f=forecast(m),items=billItems(m);
 const lines=[`ROTA FINANCEIRA — ${monname(m).toUpperCase()}`,`Relatório gerado em ${dt()}`,'',
 `Saldo calculado atual: ${fmt(cash())}`,`Salário líquido previsto: ${fmt(f.salary)}`,`Contas previstas: ${fmt(f.expenses)}`,
 `Meta de renda extra líquida antes dos lançamentos do mês: ${fmt(f.need)}`,`Apps: bruto registrado no mês: ${fmt(a.gross)}`,
 `Custos de apps registrados: ${fmt(a.extraCost)}`,`Apps líquidos registrados: ${fmt(a.netUber)}`,
 `Outras receitas registradas: ${fmt(a.income)}`,`Gastos registrados (inclusive compras a crédito): ${fmt(a.expense)}`,
 '', 'CONTAS E CARTÕES',...items.map(b=>`${billPaid(b,m)?'PAGO':'PENDENTE'} | ${b.title} | ${fmt(b.amount)} | ${paydate(b,m)}`),
 '', 'EMPRÉSTIMOS',...data.debts.map(d=>`${d.title}: ${d.remaining} parcelas, saldo informado ${fmt(d.totalRemaining)}${d.deducted?' (já descontado na folha)':''}`),
 '', 'METAS',...data.goals.map(g=>`${g.title}: ${fmt(g.current)} / ${fmt(g.target)}`),
 '', 'Observação: confira extratos e vencimentos oficiais; valores e encargos não cadastrados não entram nas previsões.'];
 return lines.join('\n');
}
function reportDownload(){if(window.AndroidFiles){window.AndroidFiles.saveUtf8File(`resumo-financeiro-${selectedMonth}.txt`,reportText());return;}const b=new Blob([reportText()],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`resumo-financeiro-${selectedMonth}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);toast('Relatório do mês exportado!')}

async function downloadJSON(){
 try{const portable=await portableVault();const payload=JSON.stringify(portable);
 if(window.AndroidFiles){window.AndroidFiles.saveUtf8File(`rota-financeira-cofre-${dt()}.json`,payload);return}
 const blob=new Blob([payload],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`rota-financeira-cofre-${dt()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Backup criptografado exportado com os prints. Guarde a senha.');
 }catch(err){alert('Não foi possível preparar o backup completo: '+err.message+'\nNão remova dados do navegador.');}
}
function fromForm(form){return Object.fromEntries(new FormData(form).entries())}
document.addEventListener('submit',async ev=>{const f=ev.target;if(!f.matches('form[data-security]'))return;ev.preventDefault();if(f.dataset.security==='cloud'){await handleCloudForm(f,ev.submitter?.value||'login');return;}if(f.dataset.security==='change'){await changeVaultPass(f);return;}const btn=f.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Protegendo os dados…';try{let pass=f.elements.password.value;if(pass.length<8)throw Error('Use uma senha com pelo menos 8 caracteres.');if(f.dataset.security==='setup'){if(pass!==f.elements.confirm.value)throw Error('As senhas não coincidem.');await setup(pass);}else await unlock(pass);f.reset();}catch(e){alert(f.dataset.security==='unlock'?'Senha incorreta ou dados corrompidos. Verifique sua senha.':e.message);btn.disabled=false;btn.textContent='Tentar novamente'}});
document.addEventListener('submit',ev=>{let f=ev.target;if(!f.matches('form[data-form]'))return;ev.preventDefault();let v=fromForm(f),type=f.dataset.form;
 if(type==='leaguePlan'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||v.date<nextDay()||v.date>maxPlanDay())return toast('Planeje somente datas futuras (até 45 dias).');
   if(leaguePlans().some(p=>p.date===v.date))return toast('Este dia já foi planejado e está travado.');
   const kind=v.kind==='rest'?'rest':v.kind==='work'?'work':null;
   const amount=Number(v.grossTarget);
   if(!kind||kind==='work'&&(!Number.isFinite(amount)||amount<20||amount>400))return toast('Informe uma meta bruta entre R$ 20 e R$ 400.');
   data.leaguePlans.push({id:uid(),date:v.date,kind,grossTarget:kind==='rest'?0:money(amount),createdAt:new Date().toISOString()});
   selectedMonth=v.date.slice(0,7);save();render();toast('Dia planejado! Metas não podem ser alteradas após salvar.');return;
 }
 if(type==='entry'){let n=Number(v.amount);if(!Number.isFinite(n)||n<=0)return toast('Informe um valor positivo.');if(v.date<data.settings.initialDate&&!confirm('A data é anterior ao saldo inicial. Esse lançamento não afetará o saldo calculado. Continuar?'))return;let e={id:uid(),date:v.date,note:v.note||''};if(entryMode==='uber'){
  const platform=String(v.platform||'').trim();if(!platform)return toast('Escolha uma plataforma.');
  if(dailyProviderDuplicate(v.date,platform,null))return toast('Já existe um total deste aplicativo para este dia. Edite o registro existente.');
  const fuel=Number(v.fuel)||0,fee=Number(v.fee)||0,other=Number(v.other)||0;
  if([fuel,fee,other].some(x=>x<0))return toast('Os custos não podem ser negativos.');
  Object.assign(e,{type:'uber',platform,gross:money(n),fuel:money(fuel),fee:money(fee),other:money(other)})
 }else Object.assign(e,{type:entryMode,amount:money(n),category:v.category,paymentMethod:entryMode==='expense'?(v.paymentMethod||'cash'):'cash'});data.entries.push(e);selectedMonth=e.date.slice(0,7);save();render();toast('Lançamento salvo!')}
 if(type==='editEntry'){
  const e=data.entries.find(x=>x.id===v.id);if(!e)return;
  const amount=Number(v.amount);if(!Number.isFinite(amount)||amount<=0)return toast('Informe um valor positivo.');
  if(e.type==='uber'){
   const platform=String(v.platform||'').trim();if(!platform)return toast('Informe a plataforma.');
   if(dailyProviderDuplicate(v.date,platform,e.id))return toast('Já existe um registro desta plataforma neste dia.');
   const fuel=Number(v.fuel)||0,fee=Number(v.fee)||0,other=Number(v.other)||0;
   if([fuel,fee,other].some(x=>x<0))return toast('Os custos não podem ser negativos.');
   const changed=e.date!==v.date||e.gross!==money(amount)||platformKey(platformOf(e))!==platformKey(platform);
   if(changed&&proofList(e).length&&!confirm('Alterar data, plataforma ou valor removerá os prints ligados a este ganho. Continuar?'))return;
   const staleRefs=changed?refList(e):[];
   if(changed){delete e.proof;delete e.proofs}
   Object.assign(e,{date:v.date,note:v.note||'',gross:money(amount),platform,fuel:money(fuel),fee:money(fee),other:money(other)});
   selectedMonth=e.date.slice(0,7);
   save(true).then(()=>Promise.all(staleRefs.map(ref=>proofStoreDelete(ref).catch(console.warn)))).catch(console.warn);
  }else{
   Object.assign(e,{date:v.date,note:v.note||'',amount:money(amount),category:v.category||'Outros'});
   if(e.type==='expense')e.paymentMethod=v.paymentMethod||'cash';selectedMonth=e.date.slice(0,7);save();
  }
  closeModal();render();toast('Lançamento atualizado!')
 }
 if(type==='settings'){data.settings={...data.settings,name:v.name,salary:money(v.salary),initialCash:money(v.initialCash),initialDate:v.initialDate,uberCost:money(v.uberCost)};save();render();toast('Ajustes atualizados!')}
 if(type==='bill'){let b=v.id?findBill(v.id):null;if(!b){b={id:uid(),payments:{}};data.bills.push(b)}Object.assign(b,{title:v.title,amount:money(v.amount),category:v.category,kind:v.kind,day:v.day||'A confirmar'});if(v.kind==='once'){b.month=v.month;b.end='';b.start=''}else{b.start=v.month;b.end=v.end||'';b.month=''}save();closeModal();render();toast('Conta salva!')}
 if(type==='debt'){let d=v.id?data.debts.find(x=>x.id===v.id):null;if(!d){d={id:uid()};data.debts.push(d)}Object.assign(d,{title:v.title,installment:money(v.installment),remaining:Number(v.remaining),totalRemaining:money(v.totalRemaining),note:v.note||'',deducted:f.querySelector('[name=deducted]').checked});save();closeModal();render();toast('Empréstimo atualizado!')}
 if(type==='goal'){let g=v.id?data.goals.find(x=>x.id===v.id):null;if(!g){g={id:uid()};data.goals.push(g)}Object.assign(g,{title:v.title,target:money(v.target),current:money(v.current),note:v.note||''});save();closeModal();render();toast('Meta salva!')}
 if(type==='pay'){let b=findBill(v.id);if(!b)return;const p={amount:money(v.amount),date:v.date};b.payments=b.payments||{};b.payments[selectedMonth]=p;data.entries.push({id:uid(),date:v.date,type:'bill',amount:p.amount,note:b.title,billId:b.id,billMonth:selectedMonth});save();closeModal();render();toast('Pagamento registrado!')}
});
document.addEventListener('submit',async ev=>{
 const f=ev.target;if(!f.matches('form[data-proof]'))return;
 ev.preventDefault();const entry=data.entries.find(e=>e.id===f.dataset.id&&e.type==='uber');if(!entry)return toast('Lançamento não encontrado.');
 const files=Array.from(f.elements.proofFile.files||[]);if(!files.length)return toast('Selecione um print.');
 const old=proofList(entry),remaining=5-old.length;
 if(files.length>remaining)return alert(`Limite: até 5 prints por plataforma/dia. Ainda cabem ${remaining}.`);
 const btn=f.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Protegendo comprovantes…';
 const newRefs=[];let backupProof=entry.proof,backupProofs=entry.proofs;
 try{
   const added=[];
   for(const file of files){
    const p=await compressProof(file);
    if([...data.entries.flatMap(proofHashes),...added.map(a=>a.sha256)].includes(p.sha256))throw Error('Um destes prints já foi utilizado. Anexe apenas imagens diferentes.');
    p.platform=platformOf(entry);
    let ref=null;
    try{
      ref=proofRef();await proofStorePut(ref,p.image);
      if(await proofStoreRead(ref)!==p.image)throw Error('A gravação da imagem não foi confirmada.');
      const stored={...p,imageRef:ref};delete stored.image;added.push(stored);newRefs.push(ref);
    }catch(dbError){
      if(ref)await proofStoreDelete(ref).catch(()=>{});
      console.warn('IndexedDB indisponível, utilizando imagem compacta:',dbError);
      added.push(await smallProofFallback(p));
    }
   }
   entry.proofs=[...old,...added];delete entry.proof;
   await save(true);
   const stored=JSON.parse(localStorage.getItem(VAULT)||'null');
   const confirmed=await decryptState(stored,vaultKey);
   const actual=confirmed.entries.find(e=>e.id===entry.id);
   if(!actual||actual.proofs?.length!==entry.proofs.length||added.some(p=>!proofHashes(actual).includes(p.sha256)))throw Error('O navegador não confirmou todos os prints.');
   closeModal();render();toast(`${added.length} print(s) salvo(s) e protegido(s). Ainda não verificado(s).`);
 }catch(err){
   entry.proof=backupProof;entry.proofs=backupProofs;
   for(const ref of newRefs)await proofStoreDelete(ref).catch(console.warn);
   alert('Não foi possível anexar: '+err.message+'\n\nPreserve seu backup antes de limpar os dados do navegador.');
 }finally{btn.disabled=false;btn.textContent='Adicionar comprovantes pendentes'}
});
document.addEventListener('click',ev=>{const btn=ev.target.closest('button');if(!btn)return;
 if(btn.dataset.nav){page=btn.dataset.nav;render();window.scrollTo(0,0);return}
 if(btn.dataset.mode){entryMode=btn.dataset.mode;render();return}
 if(btn.dataset.billtab){billTab=btn.dataset.billtab;render();return}
 let op=btn.dataset.action,id=btn.dataset.id;
 if(op==='prev'||op==='next'){selectedMonth=mshift(selectedMonth,op==='prev'?-1:1);render();return}
 if(op==='close'){closeModal();return}
 if(op==='newBill'||op==='editBill'){billForm(id?findBill(id):null);return}
 if(op==='newDebt'||op==='editDebt'){debtForm(id?data.debts.find(d=>d.id===id):null);return}
 if(op==='newGoal'||op==='editGoal'){goalForm(id?data.goals.find(g=>g.id===id):null);return}
 if(op==='pay'){const b=findBill(id);if(b)payForm(b);return}
 if(op==='unpay'){const b=findBill(id);if(!b)return;if(confirm('Desfazer pagamento registrado desta conta?')){delete b.payments[selectedMonth];data.entries=data.entries.filter(x=>!(x.type==='bill'&&x.billId===id&&x.billMonth===selectedMonth));save();render();toast('Pagamento desfeito.')}return}
 if(op==='proof'){let e=data.entries.find(x=>x.id===id);if(e)proofForm(e);return}
 if(op==='viewProof'){let e=data.entries.find(x=>x.id===id);if(e)viewProof(e);return}
 if(op==='removeSingleProof'){
   const e=data.entries.find(x=>x.id===id);if(!e)return;
   const ix=Number(btn.dataset.index),proofs=proofList(e),p=proofs[ix];if(!p)return;
   if(!confirm('Excluir este print? Outros prints do dia serão preservados.'))return;
   proofs.splice(ix,1);e.proofs=proofs;delete e.proof;
   save(true).then(()=>{if(p.imageRef)return proofStoreDelete(p.imageRef)}).catch(console.warn);
   closeModal();render();toast('Print removido.');return;
 }
 if(op==='removeProof'){let e=data.entries.find(x=>x.id===id);if(!e)return;if(confirm('Excluir definitivamente todos os prints do lançamento?')){const refs=refList(e);delete e.proof;delete e.proofs;save(true).then(()=>Promise.all(refs.map(ref=>proofStoreDelete(ref).catch(console.warn)))).catch(console.warn);closeModal();render();toast('Comprovantes excluídos.')}return}
 if(op==='editEntry'){let e=data.entries.find(x=>x.id===id);if(e)entryForm(e);return}
 if(op==='deleteEntry'){if(confirm('Excluir este lançamento?')){const e=data.entries.find(x=>x.id===id),refs=e?refList(e):[];data.entries=data.entries.filter(x=>x.id!==id);save(true).then(()=>Promise.all(refs.map(ref=>proofStoreDelete(ref).catch(console.warn)))).catch(console.warn);render();toast('Lançamento excluído.')}return}
 if(op==='deleteBill'){let b=findBill(id);if(!b)return;let used=Object.keys(b.payments||{}).length;if(used)return toast('Desfaça os pagamentos registrados antes de excluir.');if(confirm('Excluir conta e suas futuras previsões?')){data.bills=data.bills.filter(x=>x.id!==id);save();closeModal();render()}return}
 if(op==='deleteDebt'){if(confirm('Excluir este empréstimo do painel?')){data.debts=data.debts.filter(x=>x.id!==id);save();closeModal();render()}return}
 if(op==='deleteGoal'){if(confirm('Excluir esta meta?')){data.goals=data.goals.filter(x=>x.id!==id);save();closeModal();render()}return}
 if(op==='snapshot'){snapshotMonth();return}
 if(op==='export'){downloadJSON();return}
 if(op==='report'){reportDownload();return}
 if(op==='import'){document.getElementById('importFile')?.click();return}
 if(op==='lock'){vaultKey=null;vaultSalt=null;data=initial();cloudSession=null;vaultPage();return}
 if(op==='notification'){enableNotifications();return}
 if(op==='cloudUpload'){cloudUpload();return}
 if(op==='cloudDownload'){cloudDownload();return}
 if(op==='reset'){if(confirm('ATENÇÃO: isso apaga lançamentos e histórico deste aparelho. Já exportou backup?')&&confirm('Confirma apagar todos os dados?')){data=initial();save();page='home';selectedMonth=dt().slice(0,7);render();toast('Controle zerado; faça um novo cadastro de contas.')}return}
});
document.addEventListener('change',async ev=>{
 if(ev.target.id!=='importFile')return;
 const input=ev.target,file=input.files?.[0];if(!file)return;
 try{
  const parsed=JSON.parse(await file.text());await waitSave();
  if(parsed.schema===2&&parsed.ciphertext){
   const pass=prompt('Digite a senha do backup criptografado:');if(!pass)return;
   const salt=unbase64(parsed.salt),key=await deriveKey(pass,salt),state=await decryptState(parsed,key);
   if(!confirm('Substituir TODOS os registros atuais pelos dados deste backup?'))return;
   await restorePortableState(state,key,salt);toast('Backup restaurado, incluindo os prints que estavam no arquivo.');
  }else{
   const candidate=parsed.state||parsed;if(!cleanState(candidate))throw Error('Backup inválido');
   if(!confirm('Importar backup antigo sem criptografia? Os registros atuais serão substituídos.'))return;
   await restorePortableState(candidate,vaultKey,vaultSalt);toast('Backup antigo importado e protegido.');
  }
 }catch(err){console.error(err);alert('Falha ao restaurar: '+err.message+'\nOs dados anteriores não foram substituídos se a gravação falhou.')}finally{input.value=''}
});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

// Lembretes: PWA com alertas ao abrir; no app Android AlarmManager agenda notificações nativas.
function syncNativeAlerts(){if(window.AndroidAlerts)window.AndroidAlerts.scheduleMany(JSON.stringify(upcoming(45)))}
const holidaysFixed=new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25']);
function fifthBusinessDay(month){let [y,m]=month.split('-').map(Number), count=0;for(let day=1;day<=12;day++){let date=new Date(y,m-1,day),dayOfWeek=date.getDay(),key=`${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(dayOfWeek!==0&&dayOfWeek!==6&&!holidaysFixed.has(key))count++;if(count===5)return `${month}-${String(day).padStart(2,'0')}`;}return null}
function deadline(b,m){if(b.dueDate)return b.dueDate;if(b.day?.includes('5º dia útil'))return fifthBusinessDay(m);if(/^\d{1,2}$/.test(b.day||'')){const d=Number(b.day),[year,mo]=m.split('-').map(Number);if(d<=0||d>new Date(year,mo,0).getDate())return null;return `${m}-${String(d).padStart(2,'0')}`}return null}
function upcoming(days=8){const today=dt();let after=new Date(`${today}T12:00:00`);after.setDate(after.getDate()+days);const last=`${after.getFullYear()}-${String(after.getMonth()+1).padStart(2,'0')}-${String(after.getDate()).padStart(2,'0')}`;let list=[];for(let i=-1;i<3;i++){const m=mshift(today.slice(0,7),i);for(const b of billItems(m)){if(billPaid(b,m))continue;const due=deadline(b,m);if(due&&due>=today&&due<=last)list.push({id:b.id,due,title:b.title,amount:b.amount});}}return list.sort((a,b)=>a.due.localeCompare(b.due)).filter((b,i,arr)=>i===arr.findIndex(x=>x.id===b.id&&x.due===b.due));}
function dueNotice(m){if(m!==dt().slice(0,7))return '';let due=upcoming(7);return due.length?`<div class="notice"><b>Próximos vencimentos</b><br>${due.slice(0,4).map(e=>`${esc(e.title)}: ${fmt(e.amount)} até ${esc(e.due.split('-').reverse().join('/'))}`).join('<br>')}<div class="small">Confirme datas bancárias e feriados locais.</div></div>`:''}
async function enableNotifications(){if(window.AndroidAlerts){window.AndroidAlerts.requestPermission();syncNativeAlerts();toast('Lembretes nativos programados; confira a permissão do Android.');return;}if(!('Notification' in window))return toast('Seu navegador não suporta avisos.');if(!window.isSecureContext)return toast('Avisos exigem HTTPS.');let status=await Notification.requestPermission();if(status==='granted'){toast('Avisos ativados enquanto o app estiver aberto.');checkReminders()}else toast('Permissão de notificações não concedida.')}
async function checkReminders(){if(!vaultKey||reminderBusy)return;reminderBusy=true;try{const due=upcoming(2),today=dt();data.alerts=data.alerts||{};for(const item of due){let id=item.id+'_'+item.due;if(data.alerts[id]===today)continue;if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
 const options={body:`${fmt(item.amount)} — vence ${item.due.split('-').reverse().join('/')}`,tag:id};
 if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification('Conta chegando: '+item.title,options)}
 else new Notification('Conta chegando: '+item.title,options);
 data.alerts[id]=today;save();}}}catch(e){console.warn('Avisos indisponíveis:',e)}finally{reminderBusy=false}}
function getCloudCfg(){try{return JSON.parse(localStorage.getItem(CLOUD_CFG)||'{}')}catch(e){return {}}}
function cloudHeaders(token){let cfg=getCloudCfg();return {'apikey':cfg.anon,'Authorization':'Bearer '+(token||cfg.anon),'Content-Type':'application/json'}}
function normalizeUrl(url){const parsed=new URL(url.trim());if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error('Use uma URL https de projeto válida.');return parsed.origin}
async function handleCloudForm(f,mode){const btn=f.querySelector(`button[value="${mode}"]`);btn.disabled=true;try{if(!window.isSecureContext)throw Error('Nuvem exige HTTPS.');let cfg={url:normalizeUrl(f.elements.url.value),anon:f.elements.anon.value.trim(),email:f.elements.email.value.trim().toLowerCase()};if(!cfg.anon)throw Error('Chave publicável não preenchida.');localStorage.setItem(CLOUD_CFG,JSON.stringify(cfg));let endpoint=mode==='signup'?'signup':'token?grant_type=password';let resp=await fetch(`${cfg.url}/auth/v1/${endpoint}`,{method:'POST',headers:cloudHeaders(),body:JSON.stringify({email:cfg.email,password:f.elements.password.value})});let body=await resp.json();if(!resp.ok)throw Error(body.msg||body.error_description||body.message||'Falha no login');if(body.access_token&&body.user){cloudSession={token:body.access_token,user:body.user.id};toast('Nuvem conectada. Use Enviar cofre para gravar dados.')}else{toast('Cadastro recebido. Verifique o e-mail e depois entre na conta.')}f.elements.password.value='';render();}catch(e){alert('Nuvem: '+e.message)}finally{btn.disabled=false}}
async function fetchCloudVault(){const cfg=getCloudCfg();if(!cloudSession)throw Error('Entre na conta de nuvem primeiro.');const response=await fetch(`${cfg.url}/rest/v1/finance_vault?select=vault,updated_at&user_id=eq.${encodeURIComponent(cloudSession.user)}`,{headers:cloudHeaders(cloudSession.token)});const rows=await response.json();if(!response.ok)throw Error(rows.message||'Falha ao acessar cofre remoto. Verifique as políticas RLS e a tabela.');return rows[0]||null}
async function cloudUpload(){try{await waitSave();const prev=await fetchCloudVault();if(prev&&prev.updated_at&&new Date(prev.updated_at)>new Date(currentVault.updatedAt)&&!confirm('Existe uma cópia mais recente na nuvem. Substituí-la pela deste aparelho?'))return;const cfg=getCloudCfg();const resp=await fetch(`${cfg.url}/rest/v1/finance_vault?on_conflict=user_id`,{method:'POST',headers:{...cloudHeaders(cloudSession.token),'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:cloudSession.user,vault:await portableVault(),updated_at:new Date().toISOString()})});if(!resp.ok){let err=await resp.json().catch(()=>({}));throw Error(err.message||'Erro ao enviar dados.')}toast('Cofre criptografado enviado à nuvem.')}catch(e){alert('Sincronização: '+e.message)}}
async function cloudDownload(){try{const row=await fetchCloudVault();if(!row)return toast('Não existe backup na nuvem desta conta.');const pass=prompt('Digite a senha ORIGINAL do cofre salvo na nuvem:');if(!pass)return;const vault=row.vault;if(vault.schema!==2)throw Error('Cofre remoto incompatível');const salt=unbase64(vault.salt),key=await deriveKey(pass,salt),restored=await decryptState(vault,key);if(!confirm('ATENÇÃO: substituir todos os dados deste aparelho pela cópia da nuvem?'))return;await waitSave();await restorePortableState(restored,key,salt);toast('Cópia restaurada, inclusive comprovantes.')}catch(e){alert('Restauração: '+e.message)}}
initSecurity();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&vaultKey){if(Date.now()-lastActivity>15*60*1000){vaultKey=null;vaultSalt=null;data=initial();cloudSession=null;vaultPage()}else checkReminders()}});
document.addEventListener('pointerdown',()=>{lastActivity=Date.now()},{passive:true});
document.addEventListener('keydown',()=>{lastActivity=Date.now()});
setInterval(()=>{if(vaultKey&&Date.now()-lastActivity>15*60*1000){vaultKey=null;vaultSalt=null;data=initial();cloudSession=null;vaultPage()}},60000);
