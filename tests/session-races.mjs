import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function harness() {
 const listeners={}, storage=new Map(), requests=[];
 const c={console,URL,Date,JSON,Number,String,Boolean,Error,Promise,
  setTimeout:()=>1,clearTimeout:()=>{},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{addEventListener:(n,f)=>(listeners[n]??=[]).push(f),getElementById:()=>({}),querySelector:()=>null},
  MutationObserver:class {observe(){}}, window:{isSecureContext:true,addEventListener(){}},navigator:{},
  renderSettings:()=>'',vaultPage:()=>{},save:()=>true,setup:async()=>{},changeVaultPass:async()=>{},
  render:()=>{},toast:()=>{},alert:()=>{},esc:String,
  cloudSession:null,vaultKey:{},page:'home',currentVault:null,CLOUD_CFG:'cfg',
  getCloudCfg:()=>({url:'https://test.supabase.co',anon:'public'}),
  normalizeUrl:s=>s,cloudHeaders:token=>({Authorization:'Bearer '+token}),
  waitSave:async()=>{},portableVault:async()=>({schema:2,ciphertext:'opaque'}),
  fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),
 };
 vm.createContext(c);vm.runInContext(fs.readFileSync('security-center.js','utf8'),c);
 const form={elements:Object.fromEntries(Object.entries({url:'https://test.supabase.co',anon:'public',email:'a@example.org',password:'password'}).map(([k,value])=>[k,{value}])),querySelector:()=>null};
 const reply=(i,body)=>requests[i].resolve({ok:true,status:200,json:async()=>body});
 const session={token:'old',refreshToken:'refresh',user:'A',expiresAt:Date.now()-1};
 const auth={access_token:'new',refresh_token:'rotated',user:{id:'A'},expires_in:3600};
 return {c,form,reply,requests,session,auth,listeners,storage};
}
test('late login cannot restore session after vault lock',async()=>{
 const h=harness();const pending=h.c.handleCloudForm(h.form,'login');
 h.c.vaultKey=null;h.c.vaultPage();h.reply(0,h.auth);await pending;
 assert.equal(h.c.cloudSession,null);
});
test('late refresh cannot resurrect session after lock',async()=>{
 const h=harness();h.c.cloudSession=h.session;const pending=h.c.window.rfEnsureAuth();
 h.c.vaultKey=null;h.c.cloudSession=null;h.c.vaultPage();h.reply(0,h.auth);
 await assert.rejects(pending);assert.equal(h.c.cloudSession,null);
});
test('cloud read begun by A is rejected after account switches to B',async()=>{
 const h=harness();h.c.cloudSession={...h.session,expiresAt:Date.now()+3600000};
 const pending=h.c.fetchCloudVault();await new Promise(resolve=>setImmediate(resolve));
 h.c.cloudSession={...h.session,user:'B'};h.reply(0,[{vault:{ciphertext:'A'},revision:1}]);
 await assert.rejects(pending);
});
test('ordinary login succeeds without persisting tokens or password',async()=>{
 const h=harness();const pending=h.c.handleCloudForm(h.form,'login');h.reply(0,h.auth);await pending;
 assert.equal(h.c.cloudSession.user,'A');assert.equal(h.form.elements.password.value,'');
 assert.ok(!JSON.stringify([...h.storage]).includes('rotated'));
});
test('upload cancelled while packing cannot write or acknowledge another session',async()=>{
 const h=harness();h.c.cloudSession={...h.session,expiresAt:Date.now()+3600000};
 let release;h.c.portableVault=()=>new Promise(resolve=>release=resolve);
 const pending=h.c.cloudUpload();await new Promise(resolve=>setImmediate(resolve));
 h.reply(0,[]);await new Promise(resolve=>setImmediate(resolve));
 h.c.vaultKey=null;h.c.vaultPage();release({schema:2,ciphertext:'old'});
 assert.equal(await pending,false);assert.equal(h.requests.length,1);
 assert.equal(h.storage.has('rf_revision_anchor_v31'),false);
});
test('old refresh cannot replace a newly authenticated session',async()=>{
 const h=harness();h.c.cloudSession=h.session;const refresh=h.c.window.rfEnsureAuth();
 const login=h.c.handleCloudForm(h.form,'login');h.reply(1,{...h.auth,user:{id:'B'}});await login;
 h.reply(0,h.auth);await assert.rejects(refresh);assert.equal(h.c.cloudSession.user,'B');
});
test('expired token refresh succeeds and concurrent callers share one request',async()=>{
 const h=harness();h.c.cloudSession=h.session;
 const a=h.c.window.rfEnsureAuth(),b=h.c.window.rfEnsureAuth();
 assert.equal(h.requests.length,1);h.reply(0,h.auth);await Promise.all([a,b]);
 assert.equal(h.c.cloudSession.token,'new');
});
test('restore cannot replace a different vault unlocked while deriving the password',async()=>{
 const h=harness();h.c.cloudSession={...h.session,expiresAt:Date.now()+3600000};
 let release,restored=false;
 h.c.unbase64=()=>new Uint8Array(16);
 h.c.deriveKey=()=>new Promise(resolve=>release=resolve);
 h.c.decryptState=async()=>({settings:{},entries:[],bills:[],debts:[],goals:[],snapshots:[]});
 h.c.restorePortableState=async()=>{restored=true};h.c.closeModal=()=>{};
 const warn={style:{},isConnected:true},button={isConnected:true};
 const form={matches:()=>true,elements:{ack:{checked:true},originalPass:{value:'original'}},querySelector:selector=>selector==='#rf-restore-error'?warn:button};
 const pending=h.listeners.submit[0]({target:form,preventDefault(){}});
 await new Promise(resolve=>setImmediate(resolve));
 h.reply(0,[{revision:1,vault:{schema:2,salt:'salt'}}]);await new Promise(resolve=>setImmediate(resolve));
 h.c.vaultKey={different:true};release({key:true});await pending;
 assert.equal(restored,false);
});
