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
 const state={settings:{initialDate:'2026-10-01'},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
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
 const state={settings:{initialDate:'2026-10-01'},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
 const salt=new Uint8Array(16),key=await c.deriveKey('original',salt);
 await assert.rejects(c.restorePortableState(state,key,salt,()=>{throw Error('stale session')}),/stale session/);
 assert.equal(storage.get('rota_financeira_vault_v2'),'original-encrypted-vault');
});

for(const interruption of ['lock','different vault','edit']){
 test('password change cannot replace state after '+interruption,async()=>{
  const {c,storage}=harness();
  const salt=new Uint8Array(16),key=await c.deriveKey('original-password',salt);
  const state={settings:{name:'original',initialDate:'2026-10-01'},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
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
 const state={settings:{name:'candidate',initialDate:'2026-10-01'},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
 const salt=new Uint8Array(16),key=await c.deriveKey('original-password',salt);
 const before=vm.runInContext('data',c),beforeKey=vm.runInContext('vaultKey',c);
 c.localStorage.setItem=()=>{throw Error('QuotaExceededError')};
 await assert.rejects(c.restorePortableState(state,key,salt),/QuotaExceededError/);
 assert.equal(storage.get('rota_financeira_vault_v2'),'original-encrypted-vault');
 assert.equal(vm.runInContext('data',c),before);
 assert.equal(vm.runInContext('vaultKey',c),beforeKey);
});

test('invalid imported fields are rejected before image writes or vault replacement',async()=>{
 const {c,storage}=harness();let imageWrites=0;
 c.compactImages=async state=>{imageWrites++;return state};
 const salt=new Uint8Array(16),key=await c.deriveKey('synthetic-password',salt);
 const cases=[
  {entries:[{id:'e',type:'income',date:null,amount:10}]},
  {entries:[{id:'e',type:'income',date:'2026-02-30',amount:10}]},
  {entries:[{id:'e',type:'income',date:'2026-10-01',amount:'10'}]},
  {entries:[null]},
  {entries:[{id:'e',type:'unknown',date:'2026-10-01',amount:10}]},
  {bills:[{id:'b',title:null,kind:'once',month:'2026-10',amount:10}]},
  {bills:[{id:'b',title:'Test',kind:'once',month:'bad',amount:10}]},
  {bills:[{id:'b',title:'Test',kind:'once',month:'2026-10',amount:10,payments:{'2026-10':{date:null,amount:10}}}]},
  {goals:[{id:'g',title:'Test',target:'100',current:0}]},
  {debts:[{id:'d',title:'Test',installment:10,remaining:2,totalRemaining:null}]},
  {snapshots:[{month:null}]},
  {settings:{salary:'10',initialDate:'2026-10-01'}},
  {settings:{}},
  {settings:{initialDate:'not-a-date'}},
  {leaguePlans:[null]},
  {entries:[{id:'e',type:'uber',date:'2026-10-01',gross:10,fuel:0,fee:0,other:0,proofs:[null]}]},
 ];
 for(const fields of cases){
  const candidate={settings:{initialDate:'2026-10-01'},entries:[],bills:[],debts:[],goals:[],snapshots:[],...fields};
  await assert.rejects(c.restorePortableState(candidate,key,salt),/incompatível/);
  assert.equal(storage.get('rota_financeira_vault_v2'),'original-encrypted-vault');
 }
 assert.equal(imageWrites,0);
});
