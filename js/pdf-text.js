// Locally read searchable PDF text. No remote scripts, uploads or OCR.
const MAX_PDF=24*1024*1024;
const latin=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return s};
const hexBytes=src=>{const h=src.replace(/[^0-9a-f]/gi,'');const bytes=new Uint8Array(Math.ceil(h.length/2));for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(h.slice(i*2,i*2+2).padEnd(2,'0'),16);return bytes};
const uni=src=>{const b=hexBytes(src),a=[];for(let i=0;i+1<b.length;i+=2)a.push((b[i]<<8)|b[i+1]);return String.fromCharCode(...a).replace(/^\uFEFF/,'')};
function ascii85(input){
 const s=latin(input).replace(/^<~/,'').replace(/~>[\s\S]*$/,'');let n=0,k=0;const out=[];
 const emit=(count)=>{for(let j=0;j<count;j++)out.push((n>>>(24-j*8))&255);n=0;k=0};
 for(const c of s){if(/\s/.test(c))continue;if(c==='z'&&!k){out.push(0,0,0,0);continue;}
  const v=c.charCodeAt(0)-33;if(v<0||v>84)continue;n=n*85+v;k++;if(k===5)emit(4)}
 if(k){const keep=k-1;while(k<5){n=n*85+84;k++}emit(keep)}
 return Uint8Array.from(out);
}
async function streamBytes(o){
 let raw=o.stream||new Uint8Array();
 const direct=/\/Filter\s*\/(\w+)/.exec(o.dict);
 const list=/\/Filter\s*\[([^\]]+)\]/.exec(o.dict);
 const filters=direct?[direct[1]]:list?[...list[1].matchAll(/\/(\w+)/g)].map(m=>m[1]):[];
 for(const f of filters){
  if(f==='ASCII85Decode'||f==='A85')raw=ascii85(raw);
  else if(f==='ASCIIHexDecode'||f==='AHx')raw=hexBytes(latin(raw).split('>')[0]);
  else if(f==='FlateDecode'||f==='Fl'){
   if(!globalThis.DecompressionStream)throw Error('Current Chrome, Edge or Firefox is needed for PDF decompression.');
   const result=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
   if(result.byteLength>18*1024*1024)throw Error('PDF decompressed text exceeds the safety limit.');
   raw=new Uint8Array(result);
  }else throw Error('Unsupported PDF text compression '+f+'. Export a normal searchable PDF.');
 }
 return raw;
}
function pdfObjects(data){
 const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
 if(bytes.length>MAX_PDF)throw Error('PDF exceeds the 24 MB safety limit.');
 const text=latin(bytes);if(!text.startsWith('%PDF-'))throw Error('Not a valid PDF file.');
 if(/\/Encrypt\b/.test(text))throw Error('Password-protected PDF: unlock it before import.');
 const found=[...text.matchAll(/(?:^|[\r\n])(\d+)\s+\d+\s+obj\b/g)];
 if(found.length>18000)throw Error('PDF has too many internal objects.');
 const objects=new Map();
 for(let i=0;i<found.length;i++){
  const id=Number(found[i][1]),start=found[i].index+found[i][0].length;
  const limit=i+1<found.length?found[i+1].index:text.length;
  const end=text.indexOf('endobj',start);
  if(end<0||end>limit)continue;
  const body=text.slice(start,end),mark=/\bstream(?:\r\n|\n|\r)/.exec(body);
  if(!mark){objects.set(id,{dict:body});continue;}
  const at=start+mark.index+mark[0].length;
  const direct=/\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(body.slice(0,mark.index));
  let finish=direct?at+Number(direct[1]):-1;
  if(finish<at||finish>end){finish=text.indexOf('endstream',at);if(finish<0||finish>end)continue;
   while(/\s/.test(text[finish-1]||'')&&finish>at)finish--;}
  objects.set(id,{dict:body.slice(0,mark.index),stream:bytes.slice(at,finish)});
 }
 return objects;
}
async function expandObjects(objects){
 for(const o of [...objects.values()]){
  if(!/\/Type\s*\/ObjStm\b/.test(o.dict))continue;
  const n=Number(/\/N\s+(\d+)/.exec(o.dict)?.[1]||0),first=Number(/\/First\s+(\d+)/.exec(o.dict)?.[1]||0);
  if(!n||n>2500)continue;
  const str=latin(await streamBytes(o));if(!first||first>str.length)continue;
  const nums=[...str.slice(0,first).matchAll(/\d+/g)].map(m=>Number(m[0]));
  for(let i=0;i<n&&i*2+1<nums.length;i++){
   const id=nums[i*2],start=first+nums[i*2+1],end=i+1<n?first+nums[i*2+3]:str.length;
   if(start>=first&&end>start&&end<=str.length&&!objects.has(id))objects.set(id,{dict:str.slice(start,end)});
  }
 }
}
function unicodeMap(raw){
 const map=new Map();
 for(const part of raw.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)){
  for(const x of part[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi))map.set(x[1].toUpperCase(),uni(x[2]));
 }
 for(const part of raw.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)){
  for(const line of part[1].split(/[\r\n]+/)){
   const vals=/^.*?<([\da-f]+)>\s*<([\da-f]+)>\s*(?:<([\da-f]+)>|\[([^\]]*)\])/i.exec(line);
   if(!vals)continue;
   const a=parseInt(vals[1],16),b=parseInt(vals[2],16),width=vals[1].length;
   if(b<a||b-a>4096)continue;
   const dest=vals[4]?[...vals[4].matchAll(/<([\da-f]+)>/gi)].map(x=>uni(x[1])):null;
   for(let i=a;i<=b;i++)map.set(i.toString(16).toUpperCase().padStart(width,'0'),
    dest?dest[i-a]||'':uni((parseInt(vals[3],16)+i-a).toString(16).padStart(vals[3].length,'0')));
  }
 }
 return map;
}
async function pageFonts(objects,dict){
 let current=dict,resources=dict;
 for(let i=0;i<7;i++){
  const r=/\/Resources\s+(\d+)\s+\d+\s+R/.exec(current);
  if(r)resources=objects.get(Number(r[1]))?.dict||current;
  else if(/\/Resources\s*<</.test(current))resources=current;
  if(/\/Font\b/.test(resources))break;
  const p=/\/Parent\s+(\d+)\s+\d+\s+R/.exec(current);if(!p)break;
  current=objects.get(Number(p[1]))?.dict||'';
 }
 const fref=/\/Font\s+(\d+)\s+\d+\s+R/.exec(resources);
 if(fref)resources=objects.get(Number(fref[1]))?.dict||resources;
 const direct=/\/Font\s*<<([\s\S]*?)>>/.exec(resources)?.[1]||resources;
 const map=new Map();
 for(const f of direct.matchAll(/\/([A-Za-z][\w-]*)\s+(\d+)\s+\d+\s+R/g)){
  const font=objects.get(Number(f[2]))?.dict||'',ref=/\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(font);
  if(ref){const cmap=objects.get(Number(ref[1]));if(cmap?.stream){
   try{map.set(f[1],unicodeMap(latin(await streamBytes(cmap))));continue}catch(_){}}
  }
  map.set(f[1],null);
 }
 return map;
}
