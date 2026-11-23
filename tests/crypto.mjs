
import { strict as assert } from 'node:assert';
const {encryptBackup,decryptBackup,validateBackup} = await import('../js/core.js');
const sample={schema:1,classes:[{id:'c1',name:'Synthetic'}],students:[{id:'p1',name:'Pupil A'}],rooms:[],plans:[],records:[]};
const encrypted=await encryptBackup(sample,'correct horse battery stable');
assert(!encrypted.includes('Pupil A'));
assert.deepEqual(validateBackup(await decryptBackup(encrypted,'correct horse battery stable')),sample);
await assert.rejects(()=>decryptBackup(encrypted,'incorrect password'));
console.log('Encrypted backup round trip: PASS');
