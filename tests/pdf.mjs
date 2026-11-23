import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {pdfTextLines} from '../js/pdf-text.js';
import {pdfOppFromLines} from '../js/pdf-opp.js';
import {readOppFiles} from '../js/core.js';

// All test data is synthetic. No real school records or OPPs.
const sample=[
 'Pupil Name: Example, Alice',
 'SEND Area of Need: Communication and Interaction',
 'High Quality Teaching',
 'Preferential seating at the front',
 'Break instructions into steps',
 'Reasonable Adjustments',
 'Seat near the teacher'
];
function pdf(lines,{compressed=false,unicode=false,splitGlyphs=false}={}){
 const escape=s=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 const show=t=>splitGlyphs?'['+[...t].map(c=>'<'+c.charCodeAt(0).toString(16).padStart(2,'0')+'>').join('')+'] TJ':'('+escape(t)+') Tj';
 const content='BT\n/F1 12 Tf\n50 760 Td\n'+lines.map(t=>show(t)+'\n0 -22 Td').join('\n')+'\nET\n';
 const stream=compressed?deflateSync(Buffer.from(content)):Buffer.from(content);
 const map=unicode?(()=>{const chars=Array.from({length:95},(_,i)=>i+32);
  return 'begincmap\n'+chars.length+' beginbfchar\n'+chars.map(c=>
   '<'+c.toString(16).padStart(2,'0')+'> <'+c.toString(16).padStart(4,'0')+'>').join('\n')+
   '\nendbfchar\nendcmap';})():'';
 const parts=[
 '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
 '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
 '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /MediaBox [0 0 600 800] >>\nendobj\n',
 '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica'+(unicode?' /ToUnicode 6 0 R':'')+' >>\nendobj\n'
 ].map(x=>Buffer.from(x));
 parts.push(Buffer.from('5 0 obj\n<< /Length '+stream.length+(compressed?' /Filter /FlateDecode':'')+' >>\nstream\n'));
 parts.push(stream,Buffer.from('\nendstream\nendobj\n'));
 if(unicode)parts.push(Buffer.from('6 0 obj\n<< /Length '+map.length+' >>\nstream\n'+map+'\nendstream\nendobj\n'));
 return Buffer.concat([Buffer.from('%PDF-1.4\n'),...parts,Buffer.from('%%EOF\n')]);
}
const toFile=(name,bytes)=>({
 name,size:bytes.length,async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
});
function zipStored(files){
 const parts=[],directory=[];let offset=0;
 for(const [filename,data] of Object.entries(files)){
  const bytes=Buffer.from(data),name=Buffer.from(filename);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50,0);
  header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
  parts.push(header,name,bytes);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);
  central.writeUInt32LE(bytes.length,20);central.writeUInt32LE(bytes.length,24);
  central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
  directory.push(central,name);offset+=header.length+name.length+bytes.length;
 }
 const dir=Buffer.concat(directory),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);
 end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...parts,dir,end]);
}
for(const options of [{},{compressed:true},{unicode:true,splitGlyphs:true}]){
 const text=await pdfTextLines(pdf(sample,options));
 assert.equal(text[0],sample[0]);
 assert.equal(text[3],sample[3]);
 const opp=pdfOppFromLines(text,'Example, Alice.pdf');
 assert.equal(opp.name,'Alice Example');
 assert.equal(opp.need,'Communication and Interaction');
 assert.ok(opp.adaptations.some(x=>x.includes('front')));
 assert.ok(opp.adjustments.some(x=>x.includes('teacher')));
}
const direct=await readOppFiles([toFile('Example, Alice.pdf',pdf(sample))]);
assert.equal(direct.length,1);assert.equal(direct[0].opp.name,'Alice Example');
const zipped=await readOppFiles([toFile('Year 7/OPPs.zip',zipStored({
 'Year 7/Example, Alice.pdf':pdf(sample),
 'Year 7/Example, Beth.pdf':pdf(sample.map(x=>x.replace('Alice','Beth')))
}))]);
assert.equal(zipped.length,2);
assert.deepEqual(zipped.map(x=>x.opp.name).sort(),['Alice Example','Beth Example']);
const imageOnly=await readOppFiles([toFile('scanned.pdf',pdf([]))]);
assert.equal(imageOnly.length,1);
assert.match(imageOnly[0].error,/selectable|scanned|OCR/i);
const invalid=await readOppFiles([toFile('unrecognised.doc',Buffer.from('test'))]);
assert.match(invalid[0].error,/unsupported/i);
console.log('PDF OPP extraction: plain, compressed, Unicode, ZIP, scanned rejection PASS');
