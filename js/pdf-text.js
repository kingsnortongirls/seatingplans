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
  const direct=/\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(body.slice(0,mark.index));
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

// PDF strings may be literal (including octal escapes) or hexadecimal.
function literalToken(input,start){
 const out=[];let depth=1,i=start+1;
 for(;i<input.length;i++){
  const c=input[i];
  if(c==='\\'){
   const next=input[++i];if(next===undefined)break;
   const escapes={n:10,r:13,t:9,b:8,f:12};
   if(Object.hasOwn(escapes,next))out.push(escapes[next]);
   else if(/[0-7]/.test(next)){
    let oct=next;for(let n=0;n<2&&/[0-7]/.test(input[i+1]||'');n++)oct+=input[++i];
    out.push(parseInt(oct,8));
   }else if(next==='\r'){if(input[i+1]==='\n')i++}
   else if(next!=='\n')out.push(next.charCodeAt(0)&255);
  }else if(c==='('){depth++;out.push(40)}
  else if(c===')'){if(--depth===0)break;out.push(41)}
  else out.push(c.charCodeAt(0)&255);
 }
 return [{kind:'bytes',value:Uint8Array.from(out)},i+1];
}
function contentTokens(src){
 const result=[];const size=Math.min(src.length,6*1024*1024);
 for(let i=0;i<size;){
  const c=src[i];
  if(/\s/.test(c)){i++;continue}
  if(c==='%'){while(i<size&&src[i]!=='\r'&&src[i]!=='\n')i++;continue}
  if(c==='('){const [t,next]=literalToken(src,i);result.push(t);i=next;continue}
  if(c==='<'&&src[i+1]!=='<'){
   const end=src.indexOf('>',i+1);if(end<0)break;
   result.push({kind:'bytes',value:hexBytes(src.slice(i+1,end))});i=end+1;continue;
  }
  if(c==='['||c===']'){result.push({kind:c});i++;continue}
  let j=i+1;while(j<size&&!/[\s\[\]<>()/%]/.test(src[j]))j++;
  if(c==='/'){result.push({kind:'name',value:src.slice(i+1,j)});}
  else if(j>i){result.push({kind:'atom',value:src.slice(i,j)});}
  i=j;
  if(result.length>250000)throw Error('PDF has too many text operators.');
 }
 return result;
}
function decodeText(bytes,cmap){
 if(!bytes?.length)return '';
 if(!cmap?.size){
  if(bytes.length>=2&&bytes[0]===254&&bytes[1]===255){
   let text='';for(let i=2;i+1<bytes.length;i+=2)text+=String.fromCharCode((bytes[i]<<8)|bytes[i+1]);
   return text;
  }
  return new TextDecoder('windows-1252').decode(bytes);
 }
 const widths=[...new Set([...cmap.keys()].map(k=>k.length/2))].sort((a,b)=>b-a);
 let out='';
 for(let i=0;i<bytes.length;){
  let got=false;
  for(const n of widths){
   if(i+n>bytes.length)continue;
   let key='';for(let j=0;j<n;j++)key+=bytes[i+j].toString(16).padStart(2,'0').toUpperCase();
   if(cmap.has(key)){out+=cmap.get(key);i+=n;got=true;break}
  }
  if(!got){out+=new TextDecoder('windows-1252').decode(bytes.subarray(i,i+1));i++}
 }
 return out;
}
function contentLines(src,fonts){
 const tokens=contentTokens(src),stack=[],lines=[];
 let active=false,font='',line='',yOld=null;
 const flush=()=>{const str=line.replace(/\s+/g,' ').trim();if(str&&lines.length<16000)lines.push(str);line=''};
 const append=bytes=>{
  const t=decodeText(bytes,fonts.get(font)).replace(/[\u0000-\u0008\u000b-\u001f]/g,'');
  if(!t)return;
  // A TJ array can contain one glyph per string. Do not insert a space
  // unless the source text or numeric kerning actually specifies one.
  line+=t;
 };
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i];
  if(t.kind==='['){
   const group=[];while(++i<tokens.length&&tokens[i].kind!==']')group.push(tokens[i]);
   stack.push({kind:'array',value:group});continue;
  }
  if(t.kind!=='atom'||!/^([A-Za-z*'"]+)$/.test(t.value)){stack.push(t);continue}
  const op=t.value;
  if(op==='BT'){flush();active=true;yOld=null}
  else if(op==='ET'){flush();active=false}
  else if(active&&op==='Tf'){font=stack.findLast(x=>x.kind==='name')?.value||font}
  else if(active&&(op==='Tj'||op==="'"||op==='"')){
   if(op!=='Tj')flush();
   const value=stack.findLast(x=>x.kind==='bytes');if(value)append(value.value);
  }else if(active&&op==='TJ'){
   const array=stack.findLast(x=>x.kind==='array');
   if(array)for(const x of array.value){
    if(x.kind==='bytes')append(x.value);
    else if(x.kind==='atom'&&Number(x.value)<-150&&line&&!line.endsWith(' '))line+=' ';
   }
  }else if(active&&(op==='T*'||op==='Td'||op==='TD'))flush();
  else if(active&&op==='Tm'){
   const numbers=stack.filter(x=>x.kind==='atom').map(x=>Number(x.value));
   const y=numbers.at(-1);
   if(Number.isFinite(y)&&yOld!==null&&Math.abs(y-yOld)>2)flush();
   if(Number.isFinite(y))yOld=y;
  }
  stack.length=0;
 }
 flush();return lines;
}
export async function pdfTextLines(input){
 const objects=pdfObjects(input);
 await expandObjects(objects);
 const pages=[...objects.values()].filter(o=>/\/Type\s*\/Page\b/.test(o.dict)).slice(0,30);
 if(!pages.length)throw Error('PDF has no readable pages.');
 const lines=[];
 for(const page of pages){
  const fonts=await pageFonts(objects,page.dict);
  const list=/\/Contents\s*\[([\s\S]*?)\]/.exec(page.dict);
  const refs=list?[...list[1].matchAll(/(\d+)\s+\d+\s+R/g)].map(x=>Number(x[1])):
   [Number(/\/Contents\s+(\d+)\s+\d+\s+R/.exec(page.dict)?.[1]||0)].filter(Boolean);
  for(const id of refs){
   const object=objects.get(id);if(!object?.stream)continue;
   lines.push(...contentLines(latin(await streamBytes(object)),fonts));
   if(lines.length>15000)throw Error('PDF is too long for a One Page Profile.');
  }
 }
 if(!lines.length)throw Error('No selectable PDF text found. Scanned profiles need OCR or the original Word file.');
 return lines;
}
