import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
function harness(){
 const storage=new Map([['rota_financeira_vault_v2','original-encrypted-vault']]);
 const c={crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,Date,Intl,Uint8Array,
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  window:{},render(){},toast(){},alert(){}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('core.js','utf8').split('function toast(s)')[0],c);
 return {c,storage};
}
test('real restore commit rejects lock during image compaction without replacing storage',async()=>{
 const {c,storage}=harness();let release;
 c.compactImages=()=>new Promise(resolve=>release=resolve);
 const state={settings:{},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
 const salt=new Uint8Array(16),key=await c.deriveKey('original',salt);
 const pending=c.restorePortableState(state,key,salt);
 await new Promise(resolve=>setImmediate(resolve));
 vm.runInContext('vaultKey=null;data=initial()',c);release(state);
 await assert.rejects(pending);
 assert.equal(storage.get('rota_financeira_vault_v2'),'original-encrypted-vault');
 assert.equal(vm.runInContext('vaultKey',c),null);
});
test('real restore runs caller guard after encryption and before replacement',async()=>{
 const {c,storage}=harness();c.compactImages=async state=>state;
 const state={settings:{},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
 const salt=new Uint8Array(16),key=await c.deriveKey('original',salt);
 await assert.rejects(c.restorePortableState(state,key,salt,()=>{throw Error('stale session')}),/stale session/);
 assert.equal(storage.get('rota_financeira_vault_v2'),'original-encrypted-vault');
});

for(const interruption of ['lock','different vault','edit']){
 test('password change cannot replace state after '+interruption,async()=>{
  const {c,storage}=harness();
  const salt=new Uint8Array(16),key=await c.deriveKey('original-password',salt);
  const state={settings:{name:'original'},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
  const box=await c.packState(state,key,salt);
  c.seedKey=key;c.seedSalt=salt;c.seedState=state;
  vm.runInContext('vaultKey=seedKey;vaultSalt=seedSalt;data=seedState',c);
  storage.set('rota_financeira_vault_v2',JSON.stringify(box));
  const originalDerive=c.deriveKey;
  let release,started;
  const gate=new Promise(resolve=>release=resolve),atDerive=new Promise(resolve=>started=resolve);
  c.deriveKey=async(...args)=>{started();await gate;return originalDerive(...args)};
  const form={elements:{old:{value:'original-password'},password:{value:'next-password'},
   confirm:{value:'next-password'}},querySelector:()=>({disabled:false}),reset(){}};
  const pending=c.changeVaultPass(form);
  await atDerive;
  if(interruption==='lock')vm.runInContext('vaultKey=null;vaultSalt=null;data=initial()',c);
  else if(interruption==='different vault'){
   c.replacementKey=await originalDerive('other-password',salt);
   c.replacementState={...state,settings:{name:'different'}};
   const other=await c.packState(c.replacementState,c.replacementKey,salt);
   vm.runInContext('vaultKey=replacementKey;data=replacementState',c);
   storage.set('rota_financeira_vault_v2',JSON.stringify(other));
  }else{
   vm.runInContext("data.settings.name='edited'",c);
   await c.save(true);
  }
  const expectedStorage=storage.get('rota_financeira_vault_v2'),expectedKey=vm.runInContext('vaultKey',c);
  release();await pending;
  assert.ok(storage.get('rota_financeira_vault_v2')===expectedStorage,'operation must not overwrite current vault');
  assert.equal(vm.runInContext('vaultKey',c),expectedKey,'operation must not unlock or replace current key');
 });
}

test('storage quota failure during restore preserves current state and key',async()=>{
 const {c,storage}=harness();
 c.compactImages=async state=>state;
 const state={settings:{name:'candidate'},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
 const salt=new Uint8Array(16),key=await c.deriveKey('original-password',salt);
 const before=vm.runInContext('data',c),beforeKey=vm.runInContext('vaultKey',c);
 c.localStorage.setItem=()=>{throw Error('QuotaExceededError')};
 await assert.rejects(c.restorePortableState(state,key,salt),/QuotaExceededError/);
 assert.equal(storage.get('rota_financeira_vault_v2'),'original-encrypted-vault');
 assert.equal(vm.runInContext('data',c),before);
 assert.equal(vm.runInContext('vaultKey',c),beforeKey);
});
