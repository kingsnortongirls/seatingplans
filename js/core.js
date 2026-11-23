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
 externalId:[/^learnerid$/,/^pupilid$/,/^studentid$/,/^admissionnumber$/,/^upn$/],
 target:[/csat/,/generalat/,/targetgrade$/,/^target$/],
 current:[/cotta/,/currentgrade$/, /workingat$/]
};
export function readEdulink(text) {
 const {headers,records}=parseCSV(text);
 if(!headers.some(h=>CSV_FIELDS.name.some(r=>r.test(norm(h)))))throw new Error('Could not find a Learner / Pupil Name column.');
 const result=records.map(row=>{
   const val=k=>pick(row,CSV_FIELDS[k]);
   return {name:displayName(val('name')),className:val('class')||'Imported Class',reg:val('reg'),externalId:val('externalId'),
     pp:val('pp'),fsm:val('fsm'),eal:val('eal'),send:val('send'),need:val('need'),more:val('more'),
     prior:val('prior'),readingAge:val('readingAge'),readingSS:val('readingSS'),spellingAge:val('spellingAge'),
     spellingSS:val('spellingSS'),ks2Reading:val('ks2Reading'),ks2Maths:val('ks2Maths'),
     target:val('target'),current:val('current')};
 }).filter(s=>s.name);
 if(!result.length)throw new Error('No pupils were found in this marksheet.');
 return {students:result,headers,matched:Object.keys(CSV_FIELDS).filter(k=>headers.some(h=>CSV_FIELDS[k].some(r=>r.test(norm(h)))))};
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
  if(/\.docx$/i.test(f.name)){documents.push({filename:f.name,data:new Uint8Array(await f.arrayBuffer())});}
  else if(/\.zip$/i.test(f.name)){
   const zip=zipEntries(await f.arrayBuffer());
   const found=zip.entries.filter(e=>/\.docx$/i.test(e.name)&&!e.name.startsWith('__MACOSX/')&&!e.name.startsWith('._'));
   if(found.length>500)throw new Error('Please import fewer than 500 OPPs at once.');
   for(const entry of found)documents.push({filename:entry.name.split('/').pop(),data:await zipRead(zip,entry)});
  }
 }
 const result=[];
 for(const doc of documents){index++;try{result.push({filename:doc.filename,opp:await extractOpp(doc.data,doc.filename)});}catch(e){result.push({filename:doc.filename,error:e.message});}progress(index,documents.length);}
 return result;
}

export function defaultRoom(name='Standard 2-4-2') {
 const seats=[];const xs=[9,19,36,46,56,66,83,93];
 for(let row=0;row<4;row++)for(let i=0;i<8;i++){
  seats.push({id:uid(),label:String(row*8+i+1),x:xs[i],y:24+row*18,rotation:0,
   priority:'normal',group:'R'+(row+1)+'-'+(i<2?'L':i<6?'C':'R')});
 }
 return {id:uid(),name,preset:'242',seats,teacher:{x:78,y:7},board:'front'};
}
export function buildPreset(kind,name) {
 if(kind==='242')return defaultRoom(name||'Standard 2-4-2');
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
  // Default accessibility priorities follow the approved IT3 layout:
  // accessible seat 13 on the left, seat 20 on the right, and
  // all six places on the lower edge of the central island.
  // Back corner seats 15 and 22 are marked avoid-if-possible.
  // These are classroom-position priorities, never pupil attributes.
  const easyAccess=new Set([13,20,29,30,31,32,33,34]);
  const avoid=new Set([15,22]);
  for(const seat of seats){
   const number=Number(seat.label);
   if(easyAccess.has(number))seat.priority='access';
   else if(avoid.has(number))seat.priority='avoid';
  }
  return {id:uid(),name:name||'IT3',kind:'it3',preset:'it3',seats,teacher:{x:76,y:90},board:'back'};
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
  return {id:uid(),name:name||'IT2',kind:'it2',preset:'it2',seats,teacher:{x:55,y:86},board:'back'};
 }
 const seats=[];const add=(x,y,row,col,group)=>seats.push({id:uid(),label:String(seats.length+1),x,y,rotation:0,priority:'normal',group});
 if(kind==='pairs')for(let row=0;row<4;row++)for(let pair=0;pair<4;pair++)for(let col=0;col<2;col++)add(9+pair*23+col*9,24+row*18,row,col,'R'+row+'P'+pair);
 if(kind==='groups')for(let r=0;r<2;r++)for(let c=0;c<4;c++)for(let i=0;i<4;i++)add(12+c*23+(i%2)*9,32+r*36+Math.floor(i/2)*10,r,i,'G'+r+c);
 if(kind==='u')for(let i=0;i<32;i++){const ang=Math.PI+(Math.PI*i/31);add(50+40*Math.cos(ang),48+34*Math.sin(ang),0,i,'U'+Math.floor(i/4));}
 return {id:uid(),name:name||({pairs:'Paired desks',groups:'Grouped tables',u:'U shape'}[kind]||'Custom room'),preset:kind,seats,teacher:{x:78,y:7},board:'front'};
}
export function newPlan(classId,room,label) {
 return {id:uid(),classId,roomId:room.id,name:label||'Autumn 1',created:new Date().toISOString(),
  layout:clone({kind:room.kind||'',seats:room.seats,teacher:room.teacher,board:room.board}),assignments:{},locks:[],
  rules:[],accessPreference:{send:false,pp:false},notes:''};
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
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
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
  if(rule.type==='priority')return {...base,status:preferred(first,rule.mode,plan.layout.board)?'met':'unmet',description:a.name+' needs '+(rule.mode==='front'?'a front position':rule.mode==='access'?'an easy-access seat':'a preferred-access seat')};
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
  if(r.type==='priority'&&r.strict&&!preferred(a,r.mode,plan.layout.board))issues.push('Required seat priority not met');
 }
 return issues;
}
export function preferred(seat,mode,board='front'){return mode==='front'?(board==='back'?seat.y>=57:seat.y<=43):mode==='access'?seat.priority==='access':mode==='preferred'?['access','preferred'].includes(seat.priority):true;}
function score(plan,assigned,studentsById,eligibleIds=new Set()) {
 const seated=Object.fromEntries(Object.entries(assigned).map(([seat,id])=>[id,plan.layout.seats.find(s=>s.id===seat)]));
 let cost=0,hard=0;
 for(const r of plan.rules||[]){const a=seated[r.a],b=seated[r.b];if(!a)continue;
  if(r.type==='apart'&&b){const violated=r.mode==='group'?a.group===b.group:distance(a,b)<(Number(r.distance)||15);if(violated){cost+=30000;hard++;}}
  if(r.type==='together'&&b){cost+=Math.max(0,distance(a,b)-16)*25;}
  if(r.type==='priority'&&!preferred(a,r.mode,plan.layout.board)){cost+=r.strict?30000:350;if(r.strict)hard++;}
 }
 for(const [seat,id] of Object.entries(assigned)){
  const s=plan.layout.seats.find(x=>x.id===seat),p=studentsById[id];if(!s||!p)continue;
  if(s.priority==='avoid')cost+=120;
  if(eligibleIds.has(id)&&s.priority!=='access')cost+=1800;
  // A small optional spread bonus; protected characteristics never enter the algorithm.
  if(p.prior&&/high/i.test(p.prior))cost+=Math.max(0,28-(plan.layout.board==='back'?100-s.y:s.y))*0.01;
 }
 return {cost,hard};
}
export function autoSeat(plan,studentList) {
 const seats=plan.layout.seats;
 if(studentList.length>seats.length)throw new Error('There are more pupils than seats. Add desks to the room first.');
 const ids=studentList.map(s=>s.id),studentsById=Object.fromEntries(studentList.map(s=>[s.id,s]));
 const fixed=Object.fromEntries(Object.entries(plan.assignments).filter(([seat,id])=>plan.locks.includes(seat)&&ids.includes(id)&&seats.some(s=>s.id===seat)));
 const available=seats.filter(s=>!Object.hasOwn(fixed,s.id)).map(s=>s.id);
 const remaining=ids.filter(id=>!Object.values(fixed).includes(id));
 if(remaining.length>available.length)throw new Error('Not enough unlocked seats.');
 const eligibleIds=new Set(studentList.filter(s=>accessEligible(s,plan.accessPreference)).map(s=>s.id));
 const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 let best=null;
 for(let run=0;run<16;run++){
  const accessOrder=shuffle(seats.filter(s=>s.priority==='access'&&available.includes(s.id)).map(s=>s.id));
  const otherOrder=shuffle(available.filter(id=>!accessOrder.includes(id)));
  const eligible=shuffle(remaining.filter(id=>eligibleIds.has(id)));
  const others=shuffle(remaining.filter(id=>!eligibleIds.has(id)));
  // Use accessible positions for the opted-in group first. Do not move locked pupils.
  let current={...fixed};
  for(const id of eligible)current[(accessOrder.shift()||otherOrder.shift())]=id;
  for(const id of others)current[(otherOrder.shift()||accessOrder.shift())]=id;
  let rating=score(plan,current,studentsById,eligibleIds).cost;
  for(let step=0;step<650;step++){
   const movable=Object.keys(current).filter(s=>!Object.hasOwn(fixed,s));
   if(!movable.length)break;
   const a=movable[Math.floor(Math.random()*movable.length)];
   const b=available[Math.floor(Math.random()*available.length)];
   const trial={...current};const temp=trial[a];if(trial[b]===undefined){delete trial[a];trial[b]=temp;}else{trial[a]=trial[b];trial[b]=temp;}
   const next=score(plan,trial,studentsById,eligibleIds).cost;
   if(next<rating||Math.random()<0.012*Math.exp((rating-next)/150)){current=trial;rating=next;}
  }
  if(!best||rating<best.rating)best={assignments:current,rating,hard:score(plan,current,studentsById,eligibleIds).hard};
  if(best.hard===0&&best.rating<10)break;
 }
 return {...best,issues:issuesFor(plan,best.assignments),access:accessReport(plan,studentList,best.assignments)};
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
 if(password.length<12)throw new Error('Use a backup password of at least 12 characters.');
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
 if(data.students.length>12000||data.plans.length>2000||data.records.length>200000)throw new Error('Backup exceeds reasonable size limits.');
 return data;
}
