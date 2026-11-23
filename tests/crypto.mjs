
import { strict as assert } from 'node:assert';
const {encryptBackup,decryptBackup,validateBackup} = await import('../js/core.js');
const sample={schema:1,classes:[{id:'c1',name:'Synthetic'}],students:[{id:'p1',name:'Pupil A'}],rooms:[],plans:[],records:[]};
const encrypted=await encryptBackup(sample,'correct horse battery stable');
assert(!encrypted.includes('Pupil A'));
assert.deepEqual(validateBackup(await decryptBackup(encrypted,'correct horse battery stable')),sample);
await assert.rejects(()=>decryptBackup(encrypted,'incorrect password'));
// An eight-character password is valid. Seven is not.
const shortValid=await encryptBackup(sample,'12345678');
assert.deepEqual(validateBackup(await decryptBackup(shortValid,'12345678')),sample);
await assert.rejects(()=>encryptBackup(sample,'1234567'),/at least 8 characters/);
// Existing longer-password backups still decrypt without restrictions.
assert.deepEqual(validateBackup(await decryptBackup(encrypted,'correct horse battery stable')),sample);
console.log('Encrypted backup round trip and eight-character minimum: PASS');
