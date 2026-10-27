import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
function harness(){
 const storage=new Map([['rota_financeira_vault_v2','original-encrypted-vault']]);
 const c={crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,Date,Intl,Uint8Array,
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},render(){}};
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
