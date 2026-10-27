import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
const c={crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,Date,Intl,Uint8Array};
vm.createContext(c);
// Load the real crypto functions, before the DOM portion of core.js.
vm.runInContext(fs.readFileSync('core.js','utf8').split('function vaultPage(){')[0],c);
const state={settings:{name:'segredo'},entries:[],bills:[],debts:[],goals:[],snapshots:[]};
test('large encrypted backup including proof images round-trips without stack overflow',async()=>{
 const salt=new Uint8Array(16).fill(7),key=await c.deriveKey('senha-exclusiva-de-teste',salt);
 const large={...state,notes:['x'.repeat(400000)]};
 const box=await c.packState(large,key,salt);
 assert.equal(box.schema,2);assert.ok(!box.ciphertext.includes('segredo'));
 assert.equal((await c.decryptState(box,key)).notes[0].length,400000);
});
test('AES-GCM rejects tampering and wrong password; fresh IV per backup',async()=>{
 const salt=new Uint8Array(16).fill(5),key=await c.deriveKey('senha-original',salt);
 const a=await c.packState(state,key,salt),b=await c.packState(state,key,salt);
 assert.notEqual(a.iv,b.iv);
 const bytes=Buffer.from(a.ciphertext,'base64');bytes[0]^=1;
 await assert.rejects(c.decryptState({...a,ciphertext:bytes.toString('base64')},key));
 const wrong=await c.deriveKey('senha-errada',salt);await assert.rejects(c.decryptState(a,wrong));
});
