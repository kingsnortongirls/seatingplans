import {extractPdfOpp} from './pdf-opp.js';
/* Seating Plans | self-contained browser utilities. No network, cookies or persistent storage. */
export const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
export const clone = x => JSON.parse(JSON.stringify(x));
export const clean = s => String(s ?? '').trim();
export const nameKey = s => clean(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ');
export const isoDate = () => new Date().toLocaleDateString('en-CA');
export const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const short = (s,n=80) => clean(s).length>n ? clean(s).slice(0,n-1)+'…' : clean(s);
export const norm = s => clean(s).toLowerCase().replace(/[^a-z0-9]/g,'');
export const pick = (row,tests) => {const key=tests.flatMap(t=>Object.keys(row).filter(k=>t.test(norm(k))))[0];return key===undefined?'':clean(row[key]);};
export function displayName(input) { const s=clean(input);if(s.includes(',')){const p=s.split(',');return clean(p.slice(1).join(' '))+' '+clean(p[0]);}return s;}

export function parseCSV(source) {
  source=String(source).replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='"') {if(quoted && source[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===',' && !quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(x=>clean(x)))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('The CSV has an unclosed quoted field.');
  row.push(field);if(row.some(x=>clean(x)))rows.push(row);
  if(rows.length<2)throw new Error('This CSV needs a heading row and at least one pupil.');
  const headers=rows.shift().map(clean);
  return {headers,records:rows.map(cells=>Object.fromEntries(headers.map((k,i)=>[k,clean(cells[i])])))};
}
export const CSV_FIELDS = {
 name:[/^learner$/,/^pupilname$/,/^studentname$/,/^name$/],
 class:[/^class$/,/^teachinggroup$/,/^teachingclass$/],
 reg:[/^reggroup$/,/^registrationgroup$/,/^form$/],
 pp:[/^pupilpremiumindicator$/,/^pupilpremium$/,/^pp$/],
 fsm:[/^fsm$/,/^freeschoolmeals$/],
 eal:[/^eal$/],
 send:[/^senstatus$/,/^sendstatus$/,/^send$/],
 need:[/^senneed$/,/^sendareaofneed$/,/^primaryneed$/],
 more:[/^moreable$/,/^mostable$/],
 prior:[/^priorattainmentgroup$/,/^priorattainment$/],
 readingAge:[/readingage/], readingSS:[/readingss$/,/readingstandardisedscore/],
 spellingAge:[/spellingage/], spellingSS:[/spellingss$/,/spellingstandardisedscore/],
 ks2Reading:[/ks2readingscaledscore/], ks2Maths:[/ks2mathsscaledscore/],
 externalId:[/^learnerid$/,/^pupilid$/,/^studentid$/,/^admissionnumber$/,/^upn$/,/^examno$/],
 internalExternal:[/^internalexternal$/,/^studenttype$/,/^candidateorigin$/],
 target:[/csat/,/generalat/,/targetgrade$/,/^target$/],
 current:[/cotta/,/currentgrade$/, /workingat$/]
};
export function readEdulink(text) {
 const {headers,records}=parseCSV(text);
 const assessmentHeaders=headers.filter(h=>/cotta|currentgrade|workingat|assess(?:ment)?(?:result|grade)?/i.test(norm(h))&&!/target|predicted/i.test(norm(h))).slice(0,45);
 if(!headers.some(h=>CSV_FIELDS.name.some(r=>r.test(norm(h)))))throw new Error('Could not find a Learner / Pupil Name column.');
 const result=records.map(row=>{
   const val=k=>pick(row,CSV_FIELDS[k]);
   return {name:displayName(val('name')),className:val('class')||'Imported Class',reg:val('reg'),externalId:val('externalId'),internalExternal:val('internalExternal'),gradeColumns:Object.fromEntries(assessmentHeaders.map(h=>[h,clean(row[h])])),
     pp:val('pp'),fsm:val('fsm'),eal:val('eal'),send:val('send'),need:val('need'),more:val('more'),
     prior:val('prior'),readingAge:val('readingAge'),readingSS:val('readingSS'),spellingAge:val('spellingAge'),
     spellingSS:val('spellingSS'),ks2Reading:val('ks2Reading'),ks2Maths:val('ks2Maths'),
     target:val('target'),current:val('current')};
 }).filter(s=>s.name);
 if(!result.length)throw new Error('No pupils were found in this marksheet.');
 return {students:result,headers,assessmentHeaders,matched:Object.keys(CSV_FIELDS).filter(k=>headers.some(h=>CSV_FIELDS[k].some(r=>r.test(norm(h)))))};
}

// Edulink imports are proposed, never applied, until a teacher has reviewed them.
// An external identifier, when available, is used only within the same class;
// otherwise a unique normalised-name match is suggested.
export function buildEdulinkReview(classes,students,rows) {
 const seen=new Set();
 const items=rows.map((incoming,index)=>{
  const group=clean(incoming.className)||'Imported Class';
  const cls=classes.find(c=>clean(c.name).toLowerCase()===group.toLowerCase());
  const existing=students.filter(s=>s.classId===cls?.id);
  const signature=group.toLowerCase()+'|'+nameKey(incoming.name);
  const duplicate=seen.has(signature);seen.add(signature);
  let candidates=[];
  if(clean(incoming.externalId))candidates=existing.filter(s=>clean(s.externalId)&&clean(s.externalId)===clean(incoming.externalId));
  if(!candidates.length)candidates=existing.filter(s=>nameKey(s.name)===nameKey(incoming.name));
  const suggestedId=duplicate?'':candidates.length===1?candidates[0].id:'';
  return {index,incoming,group,classId:cls?.id||'',duplicate,suggestedId,
   status:duplicate?'duplicate':candidates.length>1?'ambiguous':suggestedId?'matched':'new'};
 });
 const groups=new Set(items.map(x=>x.group.toLowerCase()));
 const matched=new Set(items.map(x=>x.suggestedId).filter(Boolean));
 const notInExport=students.filter(s=>s.active!==false&&classes.some(c=>c.id===s.classId&&groups.has(clean(c.name).toLowerCase()))&&!matched.has(s.id));
 return {items,notInExport};
}
export function placeStudent(plan,seatId,pupilId) {
 if(!plan.layout.seats.some(s=>s.id===seatId))throw new Error('Seat no longer exists in this layout.');
 if(!pupilId)throw new Error('Select a pupil first.');
 const assignments={...plan.assignments};
 const source=Object.keys(assignments).find(id=>assignments[id]===pupilId);
 const displaced=assignments[seatId];
 if(source===seatId)return {assignments,action:'unchanged'};
 if((plan.locks||[]).includes(seatId)&&displaced!==pupilId)throw new Error('Unlock the destination seat before moving a pupil.');
 if(source&&(plan.locks||[]).includes(source))throw new Error('Unlock the pupil’s current seat before moving them.');
 if(displaced&&!source)throw new Error('This seat is occupied. Choose an empty seat for this pupil, or select a seated pupil to swap places.');
 if(source){
  if(displaced)assignments[source]=displaced;
  else delete assignments[source];
 }
 assignments[seatId]=pupilId;
 return {assignments,action:displaced?'swapped':source?'moved':'seated'};
}
// The workbook's historic assessment sheet stores dated results separately from the
// import. These calculations are pure and do not depend on any browser storage.
export function gradeValue(value){
 const v=clean(value).toUpperCase();
 const a={'U':0,'E':1,'D':2,'C':3,'B':4,'A':5,'A*':6};
 if(/^[1-9]$/.test(v))return {scheme:'gcse',rank:Number(v)};
 if(Object.hasOwn(a,v))return {scheme:'alevel',rank:a[v]};
 return null;
}
export function assessmentGap(result,target){
 const a=gradeValue(result),b=gradeValue(target);
 return a&&b&&a.scheme===b.scheme?a.rank-b.rank:null;
}
export function assessmentHistory(assessments,pupilId){
 return (assessments||[]).filter(a=>a.studentId===pupilId).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.name).localeCompare(String(b.name)));
}
export function classQuality(students,classes,classId){
 const cls=classes.find(c=>c.id===classId);
 const rows=students.filter(s=>s.classId===classId&&s.active!==false);
 const seen=new Set(),duplicates=[];
 for(const s of rows){const key=nameKey(s.name);if(seen.has(key))duplicates.push(s.name);seen.add(key);}
 const choices=cls?.assessmentHeaders||[];
 const selected=cls?.selectedAssessment||'';
 // Older, valid backups may have a current grade but no gradeColumns map.
 // Only prefer an explicitly present selected column over the legacy grade.
 const displayedGrade=s=>selected&&Object.prototype.hasOwnProperty.call(s.gradeColumns||{},selected)
  ? clean(s.gradeColumns[selected]):clean(s.current);
 const incomplete=rows.filter(s=>!s.name||!clean(s.target)||!displayedGrade(s)).map(s=>s.name);
 const emptySelected=selected?rows.filter(s=>!displayedGrade(s)).map(s=>s.name):[];
 // A blank SEND or PP value normally means no indicator, not a faulty import.
 // Missing source *headings* are reported by the CSV importer separately.
 return {total:rows.length,duplicates,incomplete,emptySelected,missingTarget:rows.filter(s=>!clean(s.target)).map(s=>s.name),
  assessmentHeaders:choices,selectedAssessment:selected};
}
// Historical behaviour incidents labelled "Late to lesson" remain part of
// the lateness totals even before a dedicated late-record type existed.
export function isLateRecord(record){
 return record?.type==='late'||(record?.type==='behaviour'&&/^(late to lesson|late arrival|lateness)$/i.test(clean(record.category)));
}
export function isBehaviourRecord(record){
 return record?.type==='behaviour'&&!isLateRecord(record);
}
// Read ZIP central-directory records. DOCX is a ZIP file. Deflate uses the browser's native
// DecompressionStream (no external parser, CDN, service, or data transfer).
const u16=(v,i)=>v.getUint16(i,true), u32=(v,i)=>v.getUint32(i,true);
export function zipEntries(bytes) {
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 let end=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--){if(u32(view,i)===0x06054b50){end=i;break;}}
 if(end<0)throw new Error('This is not a valid ZIP/DOCX archive.');
 const count=u16(view,end+10),start=u32(view,end+16),total=u32(view,end+12);
 if(count>5000||total>20*1024*1024)throw new Error('Archive has too many files or an oversized directory.');
 let ptr=start;const entries=[];
 for(let j=0;j<count;j++){
  if(ptr+46>data.length||u32(view,ptr)!==0x02014b50)throw new Error('Archive directory is damaged.');
  const flags=u16(view,ptr+8),method=u16(view,ptr+10),compressed=u32(view,ptr+20),uncompressed=u32(view,ptr+24);
  const len=u16(view,ptr+28),extra=u16(view,ptr+30),comment=u16(view,ptr+32),offset=u32(view,ptr+42);
  const name=new TextDecoder('utf-8').decode(data.subarray(ptr+46,ptr+46+len));
  if(flags&1)throw new Error('Password-protected ZIP imports are not supported.');
  if(uncompressed>30*1024*1024)throw new Error('An archive entry is too large.');
  entries.push({name,method,compressed,uncompressed,offset});ptr+=46+len+extra+comment;
 }
 return {data,view,entries};
}
export async function zipRead(zip,entry) {
 if(!entry)throw new Error('Required file missing from the archive.');
 const {data,view}=zip;const i=entry.offset;
 if(i+30>data.length||u32(view,i)!==0x04034b50)throw new Error('Damaged ZIP entry.');
 const offset=i+30+u16(view,i+26)+u16(view,i+28);
 if(offset+entry.compressed>data.length)throw new Error('Truncated ZIP entry.');
 const chunk=data.slice(offset,offset+entry.compressed);
 if(entry.method===0)return chunk;
 if(entry.method!==8)throw new Error('Unsupported ZIP compression method: '+entry.method);
 if(!globalThis.DecompressionStream)throw new Error('A current browser supporting DecompressionStream is required for Word and ZIP imports.');
 const stream=new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 const raw=new Uint8Array(await new Response(stream).arrayBuffer());
 if(raw.byteLength!==entry.uncompressed||raw.byteLength>30*1024*1024)throw new Error('Archive entry has an invalid size.');
 return raw;
}
const attrText=(xml,tag)=>{const node=[...xml.getElementsByTagNameNS('*',tag)][0];return node?clean(node.textContent):'';};
function paragraphs(node) {
 return [...node.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('').trim()).filter(Boolean);
}
function categorize(lines) {
 const head=clean(lines[0]).toLowerCase();
 const text=lines.slice(1).map(clean).filter(Boolean).filter((s,i,a)=>i===0||s!==a[i-1]);
 if(/non.negotiables|high quality teaching/.test(head))return ['adaptations',text];
 if(/reasonable adjustments|send provision/.test(head))return ['adjustments',text];
 if(/preparation for adulthood/.test(head))return ['targets',text];
 if(/things you should know/.test(head))return ['about',text];
 return [null,[]];
}
export async function extractOpp(input,filename='OPP.docx') {
 const zip=zipEntries(input);
 const doc=zip.entries.find(e=>e.name==='word/document.xml');
 if(!doc)throw new Error('Missing word/document.xml in '+filename);
 const document=new DOMParser().parseFromString(new TextDecoder().decode(await zipRead(zip,doc)),'application/xml');
 if(document.querySelector('parsererror'))throw new Error('Cannot read the Word document XML.');
 const boxes=[...document.getElementsByTagNameNS('*','txbxContent')];
 const groups=[];const seen=new Set();
 for(const box of boxes){const lines=paragraphs(box);const sig=lines.join('\n').toLowerCase().replace(/\s+/g,' ');if(!sig||seen.has(sig))continue;seen.add(sig);groups.push(lines);}
 if(!groups.length)groups.push(paragraphs(document));
 const all=groups.flat();
 const label=(prefix)=>{
  const ln=all.find(s=>new RegExp('^'+prefix+'\\s*:','i').test(s));
  return ln?clean(ln.replace(new RegExp('^'+prefix+'\\s*:','i'),'')):'';
 };
 const fromFile=clean(filename.replace(/\.docx$/i,'').replace(/,\s*/g,', '));
 const name=displayName(label('Pupil Name')||fromFile);
 const opp={name,need:label('SEND Area of Need'),diagnosis:label('Diagnosis/identification'),examAccess:label('Exam Access'),
  readingSS:label('Reading standardised score'),readingAge:label('Reading age'),spellingSS:label('Spelling standardised score'),spellingAge:label('Spelling age'),
  adaptations:[],adjustments:[],targets:[],about:[],photo:''};
 for(const group of groups){
  const [key,lines]=categorize(group);
  if(key)opp[key].push(...lines.filter(s=>!/^[-•\s]*$/.test(s)));
  else if(!boxes.length){let active='';for(const line of group){const [k]=categorize([line]);if(k)active=k;else if(active)opp[active].push(line);}}
 }
 for(const key of ['adaptations','adjustments','targets','about'])opp[key]=[...new Set(opp[key])].map(s=>s.replace(/^[\u2022\uF0B7\t\s]+/,'').trim()).filter(Boolean);
 const image=zip.entries.find(e=>/^word\/media\/.+\.(jpg|jpeg|png|webp)$/i.test(e.name)&&e.uncompressed<2*1024*1024);
 if(image){const bytes=await zipRead(zip,image);const mime=/\.png$/i.test(image.name)?'image/png':/\.webp$/i.test(image.name)?'image/webp':'image/jpeg';
  const chunkSize=0x6000;let binary='';for(let i=0;i<bytes.length;i+=chunkSize)binary+=String.fromCharCode(...bytes.subarray(i,i+chunkSize));
  opp.photo='data:'+mime+';base64,'+btoa(binary);
 }
 return opp;
}
export async function readOppFiles(files,progress=()=>{}) {
 const documents=[];let index=0;
 for(const f of files){
  if(f.size>60*1024*1024)throw new Error('File too large: '+f.name);
  if(/\.(docx|pdf)$/i.test(f.name)){
   documents.push({filename:f.name,data:new Uint8Array(await f.arrayBuffer())});
  }else if(/\.zip$/i.test(f.name)){
   const zip=zipEntries(await f.arrayBuffer());
   const found=zip.entries.filter(e=>/\.(docx|pdf)$/i.test(e.name)&&!e.name.startsWith('__MACOSX/')&&!e.name.startsWith('._'));
   if(found.length+documents.length>500)throw new Error('Please import fewer than 500 OPPs at once.');
   for(const entry of found){
    if(/\.pdf$/i.test(entry.name)&&entry.uncompressed>24*1024*1024){
     documents.push({filename:entry.name.split('/').pop(),error:'PDF exceeds the 24 MB safety limit.'});
    }else documents.push({filename:entry.name.split('/').pop(),data:await zipRead(zip,entry)});
   }
  }else documents.push({filename:f.name,error:'Unsupported file. Choose PDF, DOCX or ZIP containing these files.'});
  if(documents.length>500)throw new Error('Please import fewer than 500 OPPs at once.');
 }
 const result=[];
 for(const doc of documents){
  index++;
  try{
   if(doc.error)throw Error(doc.error);
   const opp=/\.pdf$/i.test(doc.filename)?await extractPdfOpp(doc.data,doc.filename):await extractOpp(doc.data,doc.filename);
   result.push({filename:doc.filename,opp});
  }catch(e){result.push({filename:doc.filename,error:e.message});}
  progress(index,documents.length);
 }
 return result;
}

const standardAccessibleSeats=new Set([2,3,6,7,10,11,14,15,18,19,22,23,25,26,27,28,29,30,31]);
export function defaultRoom(name='Standard 2-4-2') {
 const seats=[];const xs=[9,19,36,46,56,66,83,93];
 for(let row=0;row<4;row++)for(let i=0;i<8;i++){
  seats.push({id:uid(),label:String(row*8+i+1),x:xs[i],y:24+row*18,rotation:0,
   priority:standardAccessibleSeats.has(row*8+i+1)?'access':'normal',group:'R'+(row+1)+'-'+(i<2?'L':i<6?'C':'R')});
 }
 return {id:uid(),name,preset:'242',access242Version:1,seats,teacher:{x:78,y:7},board:'front'};
}
export function buildPreset(kind,name) {
 if(kind==='242')return defaultRoom(name||'Standard 2-4-2');
 if(kind==='it1'){
  // IT1 from the supplied Edulink diagram: ten seats along the left
  // computer bench, eight along the right, two banks of six in the
  // centre, plus THREE at the upper-right return. All 33 positions count,
  // including empty computers. Real pupil data is never part of presets.
  const seats=[];
  const add=(x,y,group)=>seats.push({id:uid(),label:String(seats.length+1),
   x,y,rotation:0,priority:'normal',group});
  [11,19,27,35,43,51,59,67,75,83].forEach(y=>add(8,y,'IT1-Left'));
  [27,35,43,51,59,67,75,83].forEach(y=>add(92,y,'IT1-Right'));
  [29,38,47,56,65,74].forEach(y=>{
   add(40,y,'IT1-Middle-Left');
   add(57,y,'IT1-Middle-Right');
  });
  add(79,9,'IT1-Upper-Right');
  add(87,9,'IT1-Upper-Right');
  add(92,19,'IT1-Upper-Right');
  applyIT1Priorities({seats});
  return {id:uid(),name:name||'IT1',kind:'it1',preset:'it1',accessIT1Version:1,seats,
   teacher:{x:76,y:91},board:'back'};
 }
 if(kind==='rm29'){
  // RM29 from the supplied Edulink diagram: six single places down the
  // left wall, five down the right, and nine paired desks (three columns
  // by three rows, two pupils at each desk). 29 usable positions.
  // The board is not labelled in the screenshot, so its top-side
  // position is an editable starting assumption, NOT a confirmed fact.
  const seats=[];
  const add=(x,y,group)=>seats.push({id:uid(),label:String(seats.length+1),
   x,y,rotation:0,priority:'normal',group});
  [19,32,45,58,71,84].forEach(y=>add(8,y,'RM29-Left'));
  [19,32,45,58,71].forEach(y=>add(92,y,'RM29-Right'));
  [19,36,53].forEach((y,row)=>{
   [[23,31],[45,53],[67,75]].forEach(([x1,x2],column)=>{
    const group='RM29-Pair-'+(row+1)+'-'+(column+1);
    add(x1,y,group);add(x2,y,group);
   });
  });
  return {id:uid(),name:name||'RM29',kind:'rm29',preset:'rm29',seats,
   teacher:{x:49,y:89},board:'front'};
 }
 if(kind==='it3'){
  // IT3 horseshoe: 8 across the upper wall, 7 down each side,
  // and 12 at the central island (six on each long edge). 34 total.
  const seats=[];
  const add=(x,y,group)=>seats.push({id:uid(),label:String(seats.length+1),x,y,rotation:0,priority:'normal',group});
  [15,25,35,45,55,65,75,85].forEach(x=>add(x,19,'IT3-Top'));
  [30,40,50,60,70,80,90].forEach(y=>add(8,y,'IT3-Left'));
  [30,40,50,60,70,80,90].forEach(y=>add(92,y,'IT3-Right'));
  [26,36,46,56,66,76].forEach(x=>add(x,40,'IT3-Island-North'));
  [26,36,46,56,66,76].forEach(x=>add(x,65,'IT3-Island-South'));
  applyIT3Priorities({seats});
  return {id:uid(),name:name||'IT3',kind:'it3',preset:'it3',accessIT3Version:2,seats,teacher:{x:76,y:90},board:'back'};
 }
 if(kind==='it2'){
  // IT2: 33 usable positions from the classroom photograph. Empty chairs
  // are still real seats and can receive a pupil later.
  // 8 left (one initially empty), 7 right, 10 at the 2x5 island
  // (one initially empty), plus 2x2 upper and 2x2 lower desks.
  const seats=[];
  const add=(x,y,group)=>seats.push({id:uid(),label:String(seats.length+1),x,y,rotation:0,priority:'normal',group});
  [13,24,35,46,57,68,79,90].forEach(y=>add(8,y,'IT2-Left'));
  [19,30,41,52,63,74,85].forEach(y=>add(92,y,'IT2-Right'));
  [29,41,53,65,77].forEach((y,row)=>{
    add(48,y,'IT2-Island-'+(row+1));
    add(59,y,'IT2-Island-'+(row+1));
  });
  [28,38].forEach(x=>add(x,13,'IT2-Upper-Left'));
  [72,82].forEach(x=>add(x,13,'IT2-Upper-Right'));
  [28,38].forEach(x=>add(x,90,'IT2-Lower-Left'));
  [72,82].forEach(x=>add(x,90,'IT2-Lower-Right'));
  applyIT2Priorities({seats});
  return {id:uid(),name:name||'IT2',kind:'it2',preset:'it2',accessIT2Version:2,seats,teacher:{x:55,y:86},board:'back'};
 }
 const seats=[];const add=(x,y,row,col,group)=>seats.push({id:uid(),label:String(seats.length+1),x,y,rotation:0,priority:'normal',group});
 if(kind==='pairs')for(let row=0;row<4;row++)for(let pair=0;pair<4;pair++)for(let col=0;col<2;col++)add(9+pair*23+col*9,24+row*18,row,col,'R'+row+'P'+pair);
 if(kind==='groups')for(let r=0;r<2;r++)for(let c=0;c<4;c++)for(let i=0;i<4;i++)add(12+c*23+(i%2)*9,32+r*36+Math.floor(i/2)*10,r,i,'G'+r+c);
 if(kind==='u')for(let i=0;i<32;i++){const ang=Math.PI+(Math.PI*i/31);add(50+40*Math.cos(ang),48+34*Math.sin(ang),0,i,'U'+Math.floor(i/4));}
 return {id:uid(),name:name||({pairs:'Paired desks',groups:'Grouped tables',u:'U shape'}[kind]||'Custom room'),preset:kind,seats,teacher:{x:78,y:7},board:'front'};
}
// The original IT1 diagram was incorrectly transcribed with only 31 seats.
// Detect exactly that unmodified old preset, so encrypted backups can gain
// the two missing positions without shifting any pupil or overwriting edits.
function isOriginal31SeatIT1(layout){
 if(!layout||layout.kind!=='it1'||layout.seats?.length!==31)return false;
 const expected=[
  ...[11,19,27,35,43,51,59,67,75,83].map(y=>[8,y,'IT1-Left']),
  ...[29,38,47,56,65,74,83].map(y=>[92,y,'IT1-Right']),
  ...[29,38,47,56,65,74].flatMap(y=>[
   [40,y,'IT1-Middle-Left'],[57,y,'IT1-Middle-Right']
  ]),
  [79,11,'IT1-Upper-Right'],[92,19,'IT1-Upper-Right']
 ];
 return expected.every(([x,y,group],i)=>{
  const seat=layout.seats[i];
  return seat&&seat.x===x&&seat.y===y&&seat.group===group;
 });
}
function extendOriginalIT1(layout,extraSeats){
 if(extraSeats?.length===2)layout.seats.push(...extraSeats.map(seat=>clone(seat)));
 else {
  // Preserve the old desk identities and any assignments/locks. The new
  // places can be fine-tuned in the room designer if the teacher wishes.
  layout.seats.push(
   {id:uid(),label:'32',x:92,y:91,rotation:0,priority:'normal',group:'IT1-Right'},
   {id:uid(),label:'33',x:87,y:9,rotation:0,priority:'normal',group:'IT1-Upper-Right'}
  );
 }
}
// Ensure the current templates exist after restoring an old backup.
// Add seats to unmodified legacy 31-seat IT1 rooms and their saved plans,
// but never alter customised layouts or move existing pupil assignments.
function upgradeStandardAccess(layout){
 if(!layout||layout.access242Version===1||layout.seats?.length!==32)return false;
 const xs=[9,19,36,46,56,66,83,93];
 if(!layout.seats.every(s=>{const n=Number(s.label);return Number.isInteger(n)&&n>=1&&n<=32&&Math.abs(s.x-xs[(n-1)%8])<0.01&&Math.abs(s.y-(24+Math.floor((n-1)/8)*18))<0.01;}))return false;
 for(const s of layout.seats)if(standardAccessibleSeats.has(Number(s.label))&&s.priority==='normal')s.priority='access';
 layout.access242Version=1;return true;
}
function applyIT3Priorities(layout){
 for(const s of layout.seats){
  const n=Number(s.label);
  s.priority=(n>=9&&n<=22||n>=29&&n<=34)?'access':n>=23&&n<=28?'avoid':'normal';
  s.avoidIfPossible=n===15||n===22;
 }
}
function upgradeIT3Access(layout){
 if(!layout||layout.kind!=='it3'||layout.accessIT3Version===2||layout.seats?.length!==34)return false;
 if(new Set(layout.seats.map(s=>Number(s.label))).size!==34||layout.seats.some(s=>!Number.isInteger(Number(s.label))||Number(s.label)<1||Number(s.label)>34))return false;
 applyIT3Priorities(layout);layout.accessIT3Version=2;return true;
}
const it2AccessibleSeats=new Set([16,17,18,19,20,21,22,23,24,25,30,31,32,33]);
function applyIT2Priorities(layout){
 for(const s of layout.seats){s.priority=it2AccessibleSeats.has(Number(s.label))?'access':'normal';s.avoidIfPossible=false;}
}
function upgradeIT2Access(layout){
 if(!layout||layout.kind!=='it2'||layout.accessIT2Version===2||layout.seats?.length!==33)return false;
 if(new Set(layout.seats.map(s=>Number(s.label))).size!==33||layout.seats.some(s=>!Number.isInteger(Number(s.label))||Number(s.label)<1||Number(s.label)>33))return false;
 applyIT2Priorities(layout);layout.accessIT2Version=2;return true;
}
function applyIT1Priorities(layout){
 for(const s of layout.seats){const n=Number(s.label);s.priority=n>=19&&n<=30?'access':n===31||n===32?'avoid':'normal';s.avoidIfPossible=false;}
}
function upgradeIT1Access(layout){
 if(!layout||layout.kind!=='it1'||layout.accessIT1Version===1||layout.seats?.length!==33)return false;
 if(new Set(layout.seats.map(s=>Number(s.label))).size!==33||layout.seats.some(s=>!Number.isInteger(Number(s.label))||Number(s.label)<1||Number(s.label)>33))return false;
 applyIT1Priorities(layout);layout.accessIT1Version=1;return true;
}
export function addMissingSchoolRooms(rooms,plans=[]){
 if(!Array.isArray(rooms))throw new Error('Room collection is not an array.');
 let changed=0;
 for(const room of rooms){if(upgradeStandardAccess(room))changed++;if(upgradeIT3Access(room))changed++;if(upgradeIT2Access(room))changed++;}
 for(const plan of plans||[]){if(upgradeStandardAccess(plan.layout))changed++;if(upgradeIT3Access(plan.layout))changed++;if(upgradeIT2Access(plan.layout))changed++;}
 for(const kind of ['it1','rm29']){
  if(rooms.some(room=>String(room.preset||room.kind||'').toLowerCase()===kind||
   String(room.name||'').trim().toLowerCase()===kind))continue;
  rooms.push(buildPreset(kind,kind==='it1'?'IT1':'RM29'));changed++;
 }
 for(const room of rooms){
  if(!isOriginal31SeatIT1(room))continue;
  extendOriginalIT1(room);changed++;
 }
 if(Array.isArray(plans))for(const plan of plans){
  if(!isOriginal31SeatIT1(plan?.layout))continue;
  const room=rooms.find(r=>r.id===plan.roomId);
  // Reuse new room seat IDs only if this plan is a snapshot of the
  // same 31 original desks. A reset/custom room may use different IDs.
  const extra=room?.seats?.length===33&&room.kind==='it1'&&
   plan.layout.seats.every((seat,i)=>room.seats[i]?.id===seat.id)?
   room.seats.slice(-2):null;
  extendOriginalIT1(plan.layout,extra);changed++;
 }
 for(const room of rooms)if(upgradeIT1Access(room))changed++;
 for(const plan of plans||[])if(upgradeIT1Access(plan.layout))changed++;
 return changed;
}

export function newPlan(classId,room,label) {
 return {id:uid(),classId,roomId:room.id,name:label||'Autumn 1',created:new Date().toISOString(),
  layout:clone({kind:room.kind||'',access242Version:room.access242Version,accessIT3Version:room.accessIT3Version,accessIT2Version:room.accessIT2Version,accessIT1Version:room.accessIT1Version,seats:room.seats,teacher:room.teacher,board:room.board}),assignments:{},locks:[],
  rules:[],accessPreference:{send:false,pp:false},generationOptions:{keepApart:true,keepLocked:true,mixed:false,front:true},notes:''};
}
// A teacher can explicitly opt into preferring accessible seating for SEND,
// Pupil Premium or both. No characteristic is inferred as a requirement.
const marked = value => {
 const v=clean(value).toLowerCase();
 return !!v&&!['n','no','none','false','0','not eligible','not applicable','na','n/a','-','unknown','null'].includes(v);
};
const pupilPremium = value => ['yes','y','true','1','pp','eligible','pupil premium'].includes(clean(value).toLowerCase());
export function accessEligible(student,settings={}) {
 return !!((settings.send&&marked(student?.send))||(settings.pp&&pupilPremium(student?.pp)));
}
export function accessReport(plan,studentList,assignments=plan.assignments){
 const settings=plan.accessPreference||{};
 const enabled=!!(settings.send||settings.pp);
 const accessible=plan.layout.seats.filter(s=>s.priority==='access');
 const eligible=enabled?studentList.filter(s=>accessEligible(s,settings)):[];
 const byId=new Map(studentList.map(s=>[s.id,s]));
 const seatById=new Map(plan.layout.seats.map(s=>[s.id,s]));
 const locked=(plan.locks||[]).filter(id=>assignments[id]&&byId.has(assignments[id])&&seatById.has(id));
 const fixedEligible=locked.filter(id=>accessEligible(byId.get(assignments[id]),settings));
 const fixedEligibleAccess=fixedEligible.filter(id=>seatById.get(id)?.priority==='access').length;
 const fixedAccess=locked.filter(id=>seatById.get(id)?.priority==='access').length;
 const usableOpenAccess=Math.max(0,accessible.length-fixedAccess);
 const possible=fixedEligibleAccess+Math.min(usableOpenAccess,Math.max(0,eligible.length-fixedEligible.length));
 const unmet=eligible.filter(s=>seatById.get(Object.keys(assignments).find(id=>assignments[id]===s.id))?.priority!=='access');
 return {
  enabled,selected:{send:!!settings.send,pp:!!settings.pp},
  capacity:accessible.length,eligible:eligible.length,possible,shortfall:Math.max(0,eligible.length-possible),
  assigned:eligible.length-unmet.length,unmet,lockedAccess:fixedAccess
 };
}
// Compare like-for-like GCSE 9-1 or A-level A*-U grades only.
// Mixed scales and unrecognised marks are deliberately left unclassified.
export function gradeGap(student){
 const current=clean(student?.current).toUpperCase(),target=clean(student?.target).toUpperCase();
 const numeric=/^[1-9]$/.test(current)&&/^[1-9]$/.test(target);
 const rank={'U':0,'E':1,'D':2,'C':3,'B':4,'A':5,'A*':6};
 const alphabetic=Object.hasOwn(rank,current)&&Object.hasOwn(rank,target);
 if(!numeric&&!alphabetic)return null;
 const gap=numeric?Number(current)-Number(target):rank[current]-rank[target];
 return {gap,band:gap<=-2?'below-two':gap===-1?'below-one':gap===0?'on-target':gap===1?'above-one':'above-two',
  label:gap===0?'On target':gap<0?Math.abs(gap)+' grade(s) below target':gap+' grade(s) above target'};
}
// Read only explicit OPP phrases. No text is transmitted or sent to AI.
// Match *explicit seating instructions* only. In particular, mention of
// accessible reading materials, board copies or task boards is not a seat rule.
// The result is a teacher-reviewable suggestion, never an automatic change.
export function oppSeatingHints(opp){
 const sections=['adaptations','adjustments','about'];
 const groups=new Map();
 const conditions=[
  {mode:'front',label:'Sit towards the front',patterns:[
   /\b(?:seat(?:ed|ing)?|sit(?:ting)?|sits?|position(?:ed|ing)?|preferential seating|place(?:d)?)\b.{0,60}\b(?:at|in|near|towards?|to|on)\s+(?:the\s+)?(?:front|first row)\b/i,
   /\b(?:front(?:\s+row)?\s+seat(?:ing)?|front of (?:the )?classroom)\b/i,
   /\b(?:seat(?:ed|ing)?|sit|position(?:ed)?)\b.{0,45}\b(?:near|close to|next to)\s+(?:the\s+)?(?:whiteboard|smartboard|interactive board)\b/i
  ]},
  {mode:'teacher',label:'Sit near the teacher',patterns:[
   /\b(?:seat(?:ed|ing)?|sit(?:ting)?|sits?|position(?:ed)?|place(?:d)?|desk)\b.{0,65}\b(?:near|close to|next to|beside)\s+(?:the\s+)?(?:teacher|teaching staff)\b/i,
   /\b(?:near|close to|next to|beside)\s+(?:the\s+)?teacher(?:'?s)?\s+(?:desk|seat)\b/i
  ]},
  {mode:'solo',label:'Prefer sitting independently',patterns:[
   /\b(?:seat(?:ed|ing)?|sit(?:ting)?|sits?|position(?:ed)?|place(?:d)?)\b.{0,48}\b(?:on (?:my|their|his|her) own|alone|independently|by (?:myself|themselves)|separately|away from (?:other )?(?:pupils|students|peers))\b/i,
   /\b(?:individual|separate|own)\s+(?:desk|seat|workstation)\b/i
  ]},
  {mode:'access',label:'Easy-access seat',patterns:[
   /\b(?:seat(?:ed|ing)?|sitting|desk|position)\b.{0,55}\b(?:accessible seating|easy access|wheelchair access|accessible seat|unobstructed access)\b/i,
   /\b(?:accessible seat(?:ing)?|wheelchair-accessible (?:desk|seat)|easy-access seat)\b/i
  ]}
 ];
 const manual=[
  /\b(?:seat(?:ed|ing)?|sit(?:ting)?|sits?|place(?:d)?|position(?:ed)?)\b.{0,65}\b(?:away from|not next to|near|next to)\s+(?:the\s+)?(?:door|window|radiator|light|corridor|distraction|specific pupil|friend)\b/i,
  /\b(?:sit|seat|seating)\b.{0,45}\b(?:back|rear|middle)\s+(?:of the|of)\s+(?:room|classroom)\b/i
 ];
 for(const section of sections){
  const lines=Array.isArray(opp?.[section])?opp[section]:[];
  for(const value of lines){
   const source=clean(value);
   if(!source)continue;
   // Keep the source sentence verbatim so teachers can check the context.
   const segments=source.split(/(?:[.!?](?=\s|$)|[;\r\n]|[•●])/g).map(clean).filter(Boolean);
   for(const text of segments){
    if(text.length>600)continue;
    // Do not reinterpret explicit negations as positive seating preferences.
    if(/\b(?:do not|don't|must not|should not|shouldn't|never|no need to|not to|prefer not to|does not want to|doesn't want to|avoid)\s+(?:be\s+)?(?:sit|seat|sitting|seated|seating)\b/i.test(text))continue;
    const found=conditions.filter(item=>item.patterns.some(regex=>regex.test(text)));
    for(const spec of found){
     const key=spec.mode;
     if(!groups.has(key))groups.set(key,{mode:key,label:spec.label,section,text,evidence:[],reviewOnly:false});
     const item=groups.get(key);
     if(!item.evidence.includes(text))item.evidence.push(text);
    }
    if(!found.length&&manual.some(regex=>regex.test(text))){
     const key='review';
     if(!groups.has(key))groups.set(key,{mode:key,label:'Other seating guidance: review manually',section,text,evidence:[],reviewOnly:true});
     const item=groups.get(key);
     if(!item.evidence.includes(text))item.evidence.push(text);
    }
   }
  }
 }
 return [...groups.values()].map(item=>({...item,evidence:item.evidence.slice(0,8)}));
}

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const soloClear=(seat,assigned,layout)=>{
 if(!seat)return false;
 return !Object.entries(assigned).some(([id,pupil])=>id!==seat.id&&pupil&&layout.seats.some(other=>other.id===id&&Math.hypot(other.x-seat.x,other.y-seat.y)<15));
};
const nearbyTeacher=(seat,layout)=>{
 if(!seat||!layout?.teacher)return false;
 const desks=layout.seats.slice().sort((a,b)=>
  Math.hypot(a.x-layout.teacher.x,a.y-layout.teacher.y)-Math.hypot(b.x-layout.teacher.x,b.y-layout.teacher.y));
 const eligible=desks.slice(0,Math.max(1,Math.ceil(desks.length*.3)));
 return eligible.some(s=>s.id===seat.id);
};

// Human-readable checks are separate from the optimiser: required vs advisory,
// fulfilled vs pending/unfulfilled, and the exact affected pupils.
export function auditRules(plan,studentList,assignments=plan.assignments){
 const idMap=new Map(studentList.map(s=>[s.id,s]));
 const seatMap=new Map(plan.layout.seats.map(s=>[s.id,s]));
 const pupilSeat=new Map(Object.entries(assignments).map(([seat,id])=>[id,seatMap.get(seat)]));
 const checks=(plan.rules||[]).map((rule,index)=>{
  const a=idMap.get(rule.a),b=rule.b?idMap.get(rule.b):null;
  const first=pupilSeat.get(rule.a),second=rule.b?pupilSeat.get(rule.b):null;
  const required=rule.type==='apart'||(rule.type==='priority'&&!!rule.strict);
  const names=[a?.name||'Unknown pupil',...(rule.b?[b?.name||'Unknown pupil']:[])];
  const base={id:rule.id||String(index),type:rule.type,required,pupilIds:[rule.a,...(rule.b?[rule.b]:[])],names};
  if(!a||(rule.type!=='priority'&&!b))return {...base,status:'invalid',description:'Rule refers to a pupil who is not in the current class'};
  const name=names.join(' and ');
  if(!first||(rule.type!=='priority'&&!second))return {...base,status:'pending',description:name+' not yet fully seated'};
  if(rule.type==='apart'){
   const bad=rule.mode==='group'?first.group===second.group:distance(first,second)<(Number(rule.distance)||15);
   return {...base,status:bad?'unmet':'met',description:rule.mode==='group'?name+' must be in different table groups':name+' must be at least '+(Number(rule.distance)||15)+' units apart'};
  }
  if(rule.type==='together')return {...base,status:distance(first,second)>19?'unmet':'met',description:name+' are preferred together'};
  if(rule.type==='priority'){
   const ok=rule.mode==='solo'?soloClear(first,assignments,plan.layout):preferred(first,rule.mode,plan.layout.board,plan.layout);
   const kind={front:'a front position',teacher:'a seat near the teacher desk',solo:'a seat without an immediately adjacent pupil',access:'an easy-access seat',preferred:'a preferred-access seat'}[rule.mode]||'a selected seat type';
   return {...base,status:ok?'met':'unmet',description:a.name+' needs '+kind};
  }
  return {...base,status:'invalid',description:'Unknown seating rule type'};
 });
 return {
  checks,
  required:checks.filter(x=>x.required&&(x.status==='unmet'||x.status==='invalid')),
  advisory:checks.filter(x=>!x.required&&(x.status==='unmet'||x.status==='invalid')),
  pending:checks.filter(x=>x.status==='pending'),
  met:checks.filter(x=>x.status==='met'),
  valid:!checks.some(x=>x.required&&(x.status==='unmet'||x.status==='invalid'))
 };
}
export function issuesFor(plan,assignments=plan.assignments) {
 const byStudent=Object.fromEntries(Object.entries(assignments).map(([seat,id])=>[id,plan.layout.seats.find(s=>s.id===seat)]));
 const issues=[];
 for(const r of plan.rules||[]){const a=byStudent[r.a],b=byStudent[r.b];if(!a)continue;
  if(r.type==='apart'&&b){const bad=r.mode==='group'?a.group===b.group:distance(a,b)<(Number(r.distance)||15);if(bad)issues.push('Separation rule not met');}
  if(r.type==='together'&&b&&distance(a,b)>19)issues.push('Preferred pairing not met');
  if(r.type==='priority'&&r.strict&&!(r.mode==='solo'?soloClear(a,assignments,plan.layout):preferred(a,r.mode,plan.layout.board,plan.layout)))issues.push('Required seat priority not met');
 }
 return issues;
}
export function preferred(seat,mode,board='front',layout=null){return mode==='front'?(board==='back'?seat.y>=57:seat.y<=43):mode==='teacher'?nearbyTeacher(seat,layout):mode==='access'?seat.priority==='access':mode==='preferred'?['access','preferred'].includes(seat.priority):true;}
function score(plan,assigned,studentsById,eligibleIds=new Set(),options={}) {
 const seated=Object.fromEntries(Object.entries(assigned).map(([seat,id])=>[id,plan.layout.seats.find(s=>s.id===seat)]));
 let cost=0,hard=0;
 for(const r of plan.rules||[]){const a=seated[r.a],b=seated[r.b];if(!a)continue;
  if(r.type==='apart'&&b&&options.keepApart!==false){const violated=r.mode==='group'?a.group===b.group:distance(a,b)<(Number(r.distance)||15);if(violated){cost+=30000;hard++;}}
  if(r.type==='together'&&b){cost+=Math.max(0,distance(a,b)-16)*25;}
  if(r.type==='priority'&&(r.mode!=='front'||options.front!==false)&&!(r.mode==='solo'?soloClear(a,assigned,plan.layout):preferred(a,r.mode,plan.layout.board,plan.layout))){cost+=r.strict?30000:1200;if(r.strict)hard++;}
 }
 for(const [seat,id] of Object.entries(assigned)){
  const s=plan.layout.seats.find(x=>x.id===seat),p=studentsById[id];if(!s||!p)continue;
  if(s.priority==='avoid'||s.avoidIfPossible)cost+=120;
  if(eligibleIds.has(id)&&s.priority!=='access')cost+=1800;
  // A small optional spread bonus; protected characteristics never enter the algorithm.
  if(p.prior&&/high/i.test(p.prior))cost+=Math.max(0,28-(plan.layout.board==='back'?100-s.y:s.y))*0.01;
 }
 if(options.mixed){
  const groups=new Map(),global={high:0,low:0,total:0};
  for(const [seatId,id] of Object.entries(assigned)){
   const seat=plan.layout.seats.find(s=>s.id===seatId),p=studentsById[id];
   if(!seat||!p)continue;
   const rank=/high|^h$/i.test(clean(p.prior))?'high':/low|^l$/i.test(clean(p.prior))?'low':null;
   if(!rank)continue;
   const group=seat.group||'Seat-'+seat.id;
   if(!groups.has(group))groups.set(group,{high:0,low:0,total:0});
   groups.get(group)[rank]++;groups.get(group).total++;global[rank]++;global.total++;
  }
  if(global.total>0&&groups.size>1){
   for(const x of groups.values())for(const level of ['high','low']){
    const expected=global[level]/global.total;
    cost+=350*Math.pow(x[level]-expected*x.total,2);
   }
  }
 }
 return {cost,hard};
}
export function autoSeat(plan,studentList,options={}) {
 const seats=plan.layout.seats;
 if(studentList.length>seats.length)throw new Error('There are more pupils than seats. Add desks to the room first.');
 const config={
  send:!!plan.accessPreference?.send,pp:!!plan.accessPreference?.pp,
  keepApart:true,keepLocked:true,mixed:false,front:true,
  ...(plan.generationOptions||{}),...options
 };
 const effectivePlan={...plan,locks:config.keepLocked===false?[]:plan.locks,accessPreference:{send:!!config.send,pp:!!config.pp}};
 const ids=studentList.map(s=>s.id),studentsById=Object.fromEntries(studentList.map(s=>[s.id,s]));
 const fixed=Object.fromEntries(Object.entries(plan.assignments).filter(([seat,id])=>effectivePlan.locks.includes(seat)&&ids.includes(id)&&seats.some(s=>s.id===seat)));
 const available=seats.filter(s=>!Object.hasOwn(fixed,s.id)).map(s=>s.id);
 const remaining=ids.filter(id=>!Object.values(fixed).includes(id));
 if(remaining.length>available.length)throw new Error('Not enough unlocked seats.');
 const eligibleIds=new Set(studentList.filter(s=>accessEligible(s,effectivePlan.accessPreference)).map(s=>s.id));
 const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let best=null;
 for(let run=0;run<16;run++){
  const accessOrder=shuffle(seats.filter(s=>s.priority==='access'&&available.includes(s.id)).map(s=>s.id)).sort((a,b)=>Number(!!seats.find(s=>s.id===a).avoidIfPossible)-Number(!!seats.find(s=>s.id===b).avoidIfPossible));
  const otherOrder=shuffle(available.filter(id=>!accessOrder.includes(id))).sort((a,b)=>Number(seats.find(s=>s.id===a).priority==='avoid')-Number(seats.find(s=>s.id===b).priority==='avoid'));
  const eligible=shuffle(remaining.filter(id=>eligibleIds.has(id)));
  const others=shuffle(remaining.filter(id=>!eligibleIds.has(id)));
  // Use accessible positions for the opted-in group first. Do not move locked pupils.
  let current={...fixed};
  for(const id of eligible)current[(accessOrder.shift()||otherOrder.shift())]=id;
  for(const id of others){const preferredOther=otherOrder.findIndex(k=>seats.find(s=>s.id===k).priority!=='avoid');const preferredAccess=accessOrder.findIndex(k=>!seats.find(s=>s.id===k).avoidIfPossible);const next=preferredOther>=0?otherOrder.splice(preferredOther,1)[0]:preferredAccess>=0?accessOrder.splice(preferredAccess,1)[0]:otherOrder.shift()||accessOrder.shift();current[next]=id;}
  let rating=score(plan,current,studentsById,eligibleIds,config).cost;
  for(let step=0;step<650;step++){
   const movable=Object.keys(current).filter(s=>!Object.hasOwn(fixed,s));
   if(!movable.length)break;
   const a=movable[Math.floor(Math.random()*movable.length)];
   const b=available[Math.floor(Math.random()*available.length)];
   const trial={...current};const temp=trial[a];if(trial[b]===undefined){delete trial[a];trial[b]=temp;}else{trial[a]=trial[b];trial[b]=temp;}
   const next=score(plan,trial,studentsById,eligibleIds,config).cost;
   if(next<rating||Math.random()<0.012*Math.exp((rating-next)/150)){current=trial;rating=next;}
  }
  if(!best||rating<best.rating)best={assignments:current,rating,hard:score(plan,current,studentsById,eligibleIds,config).hard};
  if(best.hard===0&&best.rating<10)break;
 }
 return {...best,issues:issuesFor(plan,best.assignments),access:accessReport(effectivePlan,studentList,best.assignments),options:config};
}
export function makeGroups(students,plan,{size=4,mode='random'}={}) {
 const n=Math.max(1,Math.ceil(students.length/size));
 const unassigned=students.slice();
 if(mode==='random')unassigned.sort(()=>Math.random()-.5);
 if(mode==='mixed'||mode==='similar')unassigned.sort((a,b)=>{const rank=s=>/high|^h$/i.test(s.prior)?3:/middle|medium|^m$/i.test(s.prior)?2:/low|^l$/i.test(s.prior)?1:0;return rank(b)-rank(a);});
 if(mode==='seating'){
  const seatByStudent=Object.fromEntries(Object.entries(plan.assignments).map(([seat,id])=>[id,plan.layout.seats.find(x=>x.id===seat)]));
  unassigned.sort((a,b)=>(seatByStudent[a.id]?.y||100)-(seatByStudent[b.id]?.y||100));
 }
 const groups=Array.from({length:n},()=>[]);
 unassigned.forEach((s,i)=>{
  let index=(mode==='mixed')?(i%n):mode==='similar'?Math.floor(i/size):i%n;
  index=Math.min(n-1,index);
  const avoid=(plan.rules||[]).filter(r=>r.type==='apart'&&r.mode==='group');
  const conflict=g=>g.some(x=>avoid.some(r=>(r.a===s.id&&r.b===x.id)||(r.b===s.id&&r.a===x.id)));
  let options=groups.map((g,j)=>({j,count:g.length,bad:conflict(g),prefer:j===index})).filter(o=>o.count<size).sort((a,b)=>Number(a.bad)-Number(b.bad)||Number(b.prefer)-Number(a.prefer)||a.count-b.count);
  const place=options[0];(groups[place?.j??index]||groups[n-1]).push(s);
 });
 return groups.filter(g=>g.length);
}
const b64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);};
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function encryptBackup(data,password) {
 if(typeof password!=='string'||password.length<8)throw new Error('Use a backup password of at least 8 characters.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt']);
 const payload=new TextEncoder().encode(JSON.stringify(data));
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,payload));
 return JSON.stringify({format:'KNGS-SEATING-ENCRYPTED',version:1,kdf:'PBKDF2-SHA256',iterations:310000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)});
}
export async function decryptBackup(text,password) {
 const x=JSON.parse(text);
 if(x.format!=='KNGS-SEATING-ENCRYPTED'||x.version!==1||x.cipher!=='AES-256-GCM'||x.iterations!==310000)throw new Error('Not a supported encrypted seating plan backup.');
 const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:from64(x.salt),iterations:x.iterations,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['decrypt']);
 try{return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(x.iv)},key,from64(x.ciphertext))));}
 catch{throw new Error('Incorrect password or damaged backup. Nothing has been replaced.');}
}
export function validateBackup(data) {
 if(!data||data.schema!==1||!Array.isArray(data.classes)||!Array.isArray(data.students)||!Array.isArray(data.rooms)||!Array.isArray(data.plans)||!Array.isArray(data.records))throw new Error('Backup data is incomplete or incompatible.');
 if((data.assessments&&!Array.isArray(data.assessments))||(data.questioningLog&&!Array.isArray(data.questioningLog))||(data.yearRollovers&&!Array.isArray(data.yearRollovers)))throw new Error('Backup contains invalid optional collections.');
 if(data.students.length>12000||data.plans.length>2000||data.records.length>200000||(data.assessments?.length||0)>100000||(data.questioningLog?.length||0)>250000||(data.yearRollovers?.length||0)>1000)throw new Error('Backup exceeds reasonable size limits.');
 return data;
}
