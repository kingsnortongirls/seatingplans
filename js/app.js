import {uid,clone,clean,esc,short,nameKey,isoDate,readEdulink,buildEdulinkReview,readOppFiles,defaultRoom,buildPreset,newPlan,placeStudent,autoSeat,auditRules,issuesFor,accessReport,gradeGap,gradeValue,assessmentGap,assessmentHistory,classQuality,oppSeatingHints,makeGroups,encryptBackup,decryptBackup,validateBackup} from './core.js';

// Everything below exists in memory only. No localStorage, cookies, IndexedDB, API calls or telemetry.
const initial=()=>({schema:1,classes:[],students:[],rooms:[defaultRoom(),buildPreset('it3','IT3'),buildPreset('it2','IT2')],plans:[],records:[],assessments:[],questioned:{},questioningLog:[],yearRollovers:[],pendingOPPs:[],categories:['Late to lesson','Homework not submitted','Truancy','Lack of effort','Disrespect','Missing equipment','Disruption','Not following instructions','Incomplete classwork','Other']});
let data=initial(),view='dashboard',classId='',roomId=data.rooms[0].id,planId='',selectedStudent='',selectedSeat='',selectedRecord='',dirty=false,history=[],future=[],profileTab='support',searchTerm='',recordFilter='all',printMode='teacher',groupResult=[],lastPicked='',pickerExclude=true,absent=new Set(),layoutMode='move',pendingOPPs=[],oppSummary='',importSummary='',dragState=null,homeworkSession=null,projectorWindow=null,backupVerifyStatus='',hideIndicators=false,privacyLocked=false,lessonTimer={remaining:300,running:false,endsAt:0},lessonTimerHandle=null,lastPickerState='',contextLongPress=null,suppressSeatClick=false,recordPeriod=30;
const $=sel=>document.querySelector(sel), $$=sel=>[...document.querySelectorAll(sel)];
const currentClass=()=>data.classes.find(c=>c.id===classId);
const currentRoom=()=>data.rooms.find(r=>r.id===roomId)||data.rooms[0];
const currentPlan=()=>data.plans.find(p=>p.id===planId);
const currentStudents=()=>data.students.filter(s=>s.classId===classId&&s.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'en-GB'));
const student=id=>data.students.find(s=>s.id===id);
const label=s=>esc(s||'');
const h=(tag,text,cls='')=>`<${tag}${cls?` class="${cls}"`:''}>${esc(text)}</${tag}>`;
const badge=(text,kind='')=>`<span class="pill ${kind}">${esc(text)}</span>`;
const button=(text,action,cls='btn',attrs='')=>`<button type="button" class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
const option=(value,text,selected)=>`<option value="${esc(value)}"${selected?' selected':''}>${esc(text)}</option>`;
const choose=(name,arr,value='',extra='')=>`<select name="${name}" ${extra}>${arr.map(a=>option(a.value??a,a.label??a,(a.value??a)===value)).join('')}</select>`;
const empty=(title,body)=>`<div class="empty"><div class="large-icon">▦</div><strong>${esc(title)}</strong><p>${esc(body)}</p></div>`;
const heading=(title,sub,actions='')=>`<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="button-row">${actions}</div></div>`;
const card=(content,title='')=>`<section class="card">${title?`<h2>${esc(title)}</h2>`:''}${content}</section>`;
const stat=(num,title,desc)=>`<div class="metric"><strong>${esc(num)}</strong><small>${esc(title)}</small><span>${esc(desc)}</span></div>`;
const fmtDate=d=>{if(!d)return '';const x=new Date(`${d.slice(0,10)}T12:00:00`);return Number.isNaN(x.getTime())?esc(d):x.toLocaleDateString('en-GB');};
function notice(message,type=''){const div=document.createElement('div');div.className='toast '+type;div.textContent=message;$('#toastRoot').replaceChildren(div);setTimeout(()=>{if(div.isConnected)div.remove()},4200);}
function mutation(fn){backupVerifyStatus='';history.push(clone(data));if(history.length>60)history.shift();future=[];fn();dirty=true;render();}
function undo(){if(!history.length)return;backupVerifyStatus='';future.push(clone(data));data=history.pop();reconcile();dirty=true;render();notice('Change undone.');}
function redo(){if(!future.length)return;backupVerifyStatus='';history.push(clone(data));data=future.pop();reconcile();dirty=true;render();notice('Change restored.');}
function reconcile(){if(!Array.isArray(data.assessments))data.assessments=[];if(!Array.isArray(data.questioningLog))data.questioningLog=[];if(!Array.isArray(data.yearRollovers))data.yearRollovers=[];if(!Array.isArray(data.pendingOPPs))data.pendingOPPs=[];if(!data.rooms.length)data.rooms=[defaultRoom()];if(!data.rooms.some(r=>r.id===roomId))roomId=data.rooms[0].id;if(!data.classes.some(c=>c.id===classId))classId=data.classes[0]?.id||'';if(!data.plans.some(p=>p.id===planId&&p.classId===classId))planId=data.plans.find(p=>p.classId===classId)?.id||'';}
function goto(next){view=next;render();window.scrollTo({top:0,behavior:'instant'});}
function setClass(id){if(homeworkSession&&homeworkSession.classId!==id){if(!confirm('Cancel unfinished homework marking and switch classes? No homework records have been written.'))return;homeworkSession=null;}classId=id;planId=data.plans.find(p=>p.classId===id)?.id||'';selectedStudent='';selectedSeat='';absent.clear();groupResult=[];lastPicked='';}
function render(){reconcile();$$('#nav [data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===view));$('#breadcrumbs').textContent=({dashboard:'Your workspace',seating:'Seating plans',lesson:'Lesson mode',assessments:'Assessment history',overview:'Class overview',rooms:'Classroom designer',profiles:'Pupil profiles',records:'Teacher records',tools:'Teaching tools',backup:'Backup & restore'})[view];$('#saveIndicator').textContent=dirty?'● Changes not backed up':'Session only';$('#undoButton').disabled=history.length===0;$('#redoButton').disabled=future.length===0;
 const views={dashboard:dashboard,seating:seating,lesson:lesson,assessments:assessmentsView,overview:classOverview,rooms:rooms,profiles:profiles,records:records,tools:tools,backup:backup};$('#privacyToggle').textContent=privacyLocked?'◈ Unlock screen':'◈ Privacy lock';$('#app').innerHTML=privacyLocked?'<div class="privacy-cover"><h1>Screen concealed</h1><p>Pupil and staff information is temporarily hidden. Select Unlock screen to return to your workspace.</p></div>':views[view]();}
const classChoices=(value=classId)=>choose('classId',data.classes.map(c=>({value:c.id,label:c.name})),value,'data-action="select-class"');
const planChoices=(value=planId)=>choose('planId',data.plans.filter(p=>p.classId===classId).map(p=>({value:p.id,label:p.name})),value,'data-action="select-plan"');
function dashboard(){const pupils=currentStudents();return heading('Welcome to Seating Plans','An offline-in-the-browser teacher workspace. Student information is never transmitted.',button('↑ Import Edulink CSV','import-csv','btn btn-primary')+button('↑ Import OPPs','import-opp','btn')+(data.pendingOPPs?.length?button('Review OPP matches ('+data.pendingOPPs.length+')','review-opps','btn'):''))+ 
 `<div class="callout privacy"><strong>Private session.</strong> Files are processed in this browser only. There is no account, server database, analytics or automatic saving. Export an encrypted backup before closing or refreshing this page.</div>`+
 `<div class="grid four">${stat(data.classes.length,'Classes','Imported from Edulink')}${stat(data.students.length,'Pupils','Session memory only')}${stat(data.rooms.length,'Room layouts','Fully editable')}${stat(data.plans.length,'Plan versions','Included in backups')}</div>`+
 `<div class="grid two">${card(`<div class="dropzone" data-action="import-csv"><div class="large-icon">↑</div><strong>Import an Edulink marksheet</strong><small>CSV file • create or refresh classes • local processing</small></div><p class="muted tiny">${esc(importSummary||'Importing a newer marksheet updates matching pupils while preserving their records and seating.')}</p>`,'1. Add your classes')}${card(`<div class="dropzone" data-action="import-opp"><div class="large-icon">▤</div><strong>Drop in Word OPPs</strong><small>Select multiple DOCX files or a ZIP containing DOCX files</small></div><p class="muted tiny">${esc(oppSummary||'OPPs are matched by pupil name. Unmatched records are shown for review, never guessed.')}</p>`,'2. Add pupil support')}</div>`+
 `<div class="grid two">${card(data.classes.length?data.classes.map(c=>`<div class="list-card"><div><strong>${esc(c.name)}</strong><small>${data.students.filter(s=>s.classId===c.id).length} pupils · ${data.plans.filter(p=>p.classId===c.id).length} plan version(s)</small></div>${button('Open','open-class','btn btn-small',`data-id="${esc(c.id)}"`)}</div>`).join(''):empty('No classes imported','Use the Edulink marksheet importer above. No school data is stored on the site.'),'Your classes')}${card(`<p>Use the standard four-row, 2-4-2 classroom, or create custom layouts.</p><div class="list-card"><div><strong>Room designer</strong><small>Move desks, mark accessible seats and edit classroom templates</small></div>${button('Design','go-rooms','btn btn-small')}</div><div class="list-card"><div><strong>Backups</strong><small>Encrypted local export and restore, including all versions</small></div>${button('Open','go-backup','btn btn-small')}</div>`,'Next steps')}</div>`;
}
function seatMarkup(layout,assignment={},opts={}){const showPrivate=opts.teacher!==false&&!hideIndicators&&!privacyLocked;return `<div class="canvas ${layout.kind==='it3'?'it3':layout.kind==='it2'?'it2':''}" id="roomCanvas" data-mode="${opts.mode||'seating'}"><div class="board">WHITEBOARD / FRONT</div><div class="teacher-desk" style="left:${layout.teacher?.x??78}%;top:${layout.teacher?.y??7}%" data-desk="teacher">TEACHER DESK</div>${layout.kind==='it3'?'<div class="it3-island" aria-hidden="true"></div>':layout.kind==='it2'?'<div class="it2-table it2-left"></div><div class="it2-table it2-right"></div><div class="it2-table it2-middle"></div><div class="it2-table it2-upper-left"></div><div class="it2-table it2-upper-right"></div><div class="it2-table it2-lower-left"></div><div class="it2-table it2-lower-right"></div>':''}${layout.seats.map(seat=>{const s=student(assignment[seat.id]),grade=s&&showPrivate?gradeGap(s):null,locked=(currentPlan()?.locks||[]).includes(seat.id),selected=selectedSeat===seat.id,hwMissing=!!(s&&homeworkSession?.classId===classId&&homeworkSession.missing.includes(s.id));return `<button type="button" class="seat ${selected?'selected':''} ${!s?'unassigned':''} ${locked?'locked':''} ${hwMissing?'homework-missing':''} ${grade?'grade-'+grade.band:''} ${s&&s.id===lastPicked?'picked-pupil':''}" data-seat="${esc(seat.id)}" data-priority="${esc(seat.priority||'normal')}" style="left:${Number(seat.x)}%;top:${Number(seat.y)}%;rotate:${Number(seat.rotation)||0}deg" title="Seat ${esc(seat.label)}${s?': '+esc(s.name):''}"><span class="seat-number" aria-hidden="true">${esc(seat.label)}</span><strong>${s?esc(short(s.name,22)):opts.mode==='rooms'?'Seat '+esc(seat.label):'+'}</strong>${s?`<small class="pupil-private">${showPrivate?esc(short(badgesForSeat(s),30)):''}</small><small class="pupil-private seat-meta">${showPrivate?esc(gradeSummary(s)):''}</small>`:opts.mode==='rooms'?`<small>${esc(seat.priority)}</small>`:''}</button>`}).join('')}</div>`;}
function gradeSummary(s){if(!s.target&&!s.current)return '';const t=clean(s.target),c=clean(s.current),v=gradeGap(s);return `T:${t||'?'} · C:${c||'?'}${v?' · '+(v.gap>0?'+':'')+v.gap:''}`;}
function badgesForSeat(s){return [s.pp&&/yes|true|^y$|^1$|^pp$/i.test(s.pp)?'PP':'',s.send&&!/^(n|no|none)$/i.test(s.send)?'SEND':'',s.prior?'PA '+s.prior.charAt(0).toUpperCase():'',s.more&&/^(yes|y|true|1)$/i.test(s.more)?'More Able':'',s.internalExternal?'KS5 '+short(s.internalExternal,12):'',s.readingAge?'RA '+short(s.readingAge,6):'',s.target?'T '+short(s.target,3):'',s.current?'C '+short(s.current,3):''].filter(Boolean).join(' · ');}
function seating(){const p=currentPlan(),list=currentStudents(),access=p?accessReport(p,list):null,audit=p?auditRules(p,list):null;const plans=data.plans.filter(x=>x.classId===classId);return heading('Seating plans','Arrange pupils, respect seating priorities and compare versions.',button('+ New version','new-version','btn btn-primary')+button('Print teacher','print-teacher','btn')+button('Print pupil','print-pupil','btn')+button('Projector view','projector-view','btn')+button(hideIndicators?'Show indicators':'Hide indicators','toggle-indicators','btn'))+
 (!data.classes.length?card(empty('Start with Edulink','Import a marksheet from the dashboard first.')):`<div class="board-tools no-print"><label>Class${classChoices()}</label><label>Plan version${planChoices()}</label>${button('Duplicate','duplicate-plan','btn btn-small')}${button('Rename','rename-plan','btn btn-small')}${button('Compare','compare-plans','btn btn-small')}${button('Delete version','delete-plan','btn btn-small btn-danger')}</div>`+
 (!p?card(empty('No plan for this class','Select New version to start with a room template.')):`<div class="print-page-title">${esc(currentClass()?.name)} · ${esc(p.name)} · ${esc(fmtDate(isoDate()))}</div><div class="layout-split"><section class="card stage-card">${homeworkSession?.classId===classId?`<div class="callout no-print" style="margin-bottom:14px"><strong>Mark missing homework: ${esc(homeworkSession.assignment)}</strong><p class="tiny">Due ${esc(fmtDate(homeworkSession.dueDate))}. Tap a seated pupil to mark or unmark missing homework. You can also use the class list. No records are written until you confirm.</p><p><strong>${homeworkSession.missing.length} selected as missing</strong></p><div class="button-row">${button('Save missing records','finish-homework','btn btn-primary')}${button('Cancel marking','cancel-homework','btn')}</div></div>`:''}${seatMarkup(p.layout,p.assignments)}<div class="legend-line no-print" style="margin-top:12px"><span><i class="legend-swatch access"></i>Easy access</span><span><i class="legend-swatch preferred"></i>Preferred</span><span><i class="legend-swatch avoid"></i>Avoid</span><span>Click a pupil, then a seat. Or drag a name onto a seat.</span></div><div class="grade-key no-print"><span><i style="--swatch:#c33737"></i>2+ below</span><span><i style="--swatch:#e9a23b"></i>1 below</span><span><i style="--swatch:#2c9d58"></i>On target</span><span><i style="--swatch:#2d87c4"></i>1 above</span><span><i style="--swatch:#6855b5"></i>2+ above</span><span>GCSE 9–1 / A-level A*–U</span></div><div class="button-row no-print" style="margin-top:14px">${homeworkSession?'':button('⚄ Generate seats','auto-seat','btn btn-primary')}${homeworkSession?'':button('Mark homework','start-homework','btn btn-primary')}${button('Seating rules','seating-rules','btn')}${button('OPP seating prompts','opp-seating-prompts','btn')}${button('Plan notes','plan-notes','btn')}${button('SEND / PP accessible seats','group-access-preference','btn')}${button('Use updated room','sync-room','btn')}${button('Restore previous seating','restore-pupils','btn')}${button('Clear all seats','clear-seats','btn')}</div>${p.notes?`<div class="notice no-print" style="margin-top:12px"><strong>Teacher plan notes:</strong> ${esc(short(p.notes,300))}</div>`:''}${ruleAuditMarkup(audit)}${access?.enabled?`<div class="callout no-print ${access.shortfall?'warn':''}" style="margin-top:12px"><strong>Accessible seating preference:</strong> ${access.selected.send?'SEND':''}${access.selected.send&&access.selected.pp?' and ':''}${access.selected.pp?'PP':''}. <strong>${access.eligible}</strong> eligible pupil(s), <strong>${access.capacity}</strong> marked accessible seat(s).${access.shortfall?`<p><strong>Capacity warning:</strong> At least ${access.shortfall} pupil(s) cannot be placed in an accessible seat with the current locked-seat arrangements. You can add more accessible seats or review priorities.</p>`:''}${Object.values(p.assignments).length&&access.unmet.length?`<p><strong>Currently outside accessible seats:</strong> ${access.unmet.map(s=>esc(s.name)).join(', ')}.</p>`:''}</div>`:''}</section><aside class="card print-hide"><h2>Class register <span class="muted tiny">(${list.length})</span></h2><input aria-label="Filter pupils" id="pupilSearch" placeholder="Find a pupil…" value="${esc(searchTerm)}"><div class="list-scroll" id="pupilRoster">${roster(list,p)}</div><hr class="divider">${selectedSeat?seatControls(p):'<p class="muted tiny">Select a seat to lock, clear, or open pupil details.</p>'}</aside></div>`));
}
function ruleAuditMarkup(report) {
 if(!report.checks.length)return '';
 const problems=[...report.required,...report.advisory];
 return `<div class="no-print" style="margin-top:12px">${problems.length?`<div class="alert"><strong>${report.required.length} required rule(s) unmet · ${report.advisory.length} advisory preference(s) unmet.</strong><ul>${problems.map(x=>`<li><strong>${esc(x.names.join(' and '))}:</strong> ${esc(x.description)}${x.required?' (required)':' (preference)'}</li>`).join('')}</ul></div>`:`<div class="notice tiny">${report.met.length} seated rule(s) satisfied.</div>`}${report.pending.length?`<p class="muted tiny">${report.pending.length} rule(s) are awaiting both pupils being seated.</p>`:''}</div>`;
}
function roster(list,p){const seated=new Set(Object.values(p.assignments));return list.filter(s=>s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s=>`<div class="pupil-chip ${selectedStudent===s.id?'selected':''}" draggable="${homeworkSession?'false':'true'}" data-student="${esc(s.id)}"><div><strong>${esc(s.name)}</strong><small>${esc(short(s.prior||'Prior attainment not provided',35))}${s.opp?' · OPP ✓':''}</small></div><div class="row-flex">${homeworkSession?.classId===classId?button(homeworkSession.missing.includes(s.id)?'✓ Missing':'Mark missing','toggle-homework','btn btn-small',`data-id="${esc(s.id)}"`):`<span class="pill ${seated.has(s.id)?'green':'grey'}">${seated.has(s.id)?'Seated':'Place'}</span>`}<button class="icon-button" type="button" data-action="show-student" data-id="${esc(s.id)}" title="View pupil profile">ⓘ</button></div></div>`).join('')||'<p class="muted">No matching pupils.</p>';}
function seatControls(p){const seat=p.layout.seats.find(x=>x.id===selectedSeat),id=p.assignments[selectedSeat],s=student(id);return `<h3>${seat?'Seat '+esc(seat.label):'Selected seat'}</h3><p class="muted tiny">${s?'Assigned to '+esc(s.name):'Unoccupied'}</p><div class="button-row">${button(p.locks.includes(selectedSeat)?'Unlock seat':'Lock seat','toggle-lock','btn btn-small')}${button('Clear seat','unseat','btn btn-small')}${s?button('Pupil details','show-selected','btn btn-small'):''}</div>`;}
function rooms(){const r=currentRoom(),origin=r.preset||r.kind||(r.name==='Standard 2-4-2'?'242':'');
 return heading('Room designer','Choose a room, then edit its desks directly. New rooms start from a layout preset.',button('+ New room','new-room','btn btn-primary')+button('Duplicate room','duplicate-room','btn')+button('Rename room','rename-room','btn'))+
 `<div class="board-tools no-print"><label>Select room${choose('roomId',data.rooms.map(x=>({value:x.id,label:x.name})),roomId,'data-action="select-room"')}</label>${button('Reset room','reset-room','btn btn-small',origin?'':'disabled title="This older room has no recorded starting preset"')}${button('Delete room','delete-room','btn btn-small btn-danger')}</div><div class="layout-split"><section class="card stage-card"><h2>Edit room: ${esc(r.name)}</h2>${seatMarkup(r,{}, {mode:'rooms'})}<div class="legend-line" style="margin-top:12px"><span>Drag a seat or teacher desk to move it.</span><span>Click any seat to edit its label, group or accessibility priority.</span></div><div class="button-row" style="margin-top:14px">${button('+ Add desk','add-seat','btn btn-primary')}${button('Use for class','room-to-plan','btn')}</div></section><aside class="card"><h2>Seat editor</h2>${selectedSeat&&r.seats.some(s=>s.id===selectedSeat)?roomSeatControls(r):'<p class="muted">Select a desk to edit its position, group and accessibility priority.</p>'}<hr class="divider"><p class="tiny muted">Reset room restores its original preset, not another classroom. Existing seating plan versions remain unchanged. You can undo a reset.</p><hr class="divider"><p class="tiny muted">Easy access seats are reachable without navigating crowded spaces. Mark these manually. SEND labels alone never trigger seat assignments.</p><h3>Keyboard shortcuts</h3><p class="tiny muted">Ctrl+Z: undo<br>Ctrl+Y or Ctrl+Shift+Z: redo</p></aside></div>`;}
function roomSeatControls(r){const s=r.seats.find(s=>s.id===selectedSeat);return `<form id="roomSeatForm"><label>Seat label<input name="label" value="${esc(s.label)}" maxlength="12" required></label><label>Position priority${choose('priority',['normal','access','preferred','avoid'].map((v,i)=>({value:v,label:['Standard','Easy teacher access','Preferred seat','Avoid if possible'][i]})),s.priority)}</label><label>Table group<input name="group" value="${esc(s.group||'')}" maxlength="30"></label><div class="field-grid"><label>X (%)<input type="number" min="5" max="95" name="x" value="${Number(s.x)}"></label><label>Y (%)<input type="number" min="15" max="93" name="y" value="${Number(s.y)}"></label></div><label>Rotation${choose('rotation',[0,90,180,270].map(v=>({value:String(v),label:v+'°'})),String(s.rotation||0))}</label><div class="button-row"><button class="btn btn-primary" type="submit">Update seat</button>${button('Remove seat','remove-seat','btn btn-danger')}</div></form>`;}

function progressChart(id){
 const hist=assessmentHistory(data.assessments,id).map(a=>({...a,value:gradeValue(a.grade),targetValue:gradeValue(a.target)})).filter(a=>a.value);
 if(!hist.length)return '<p class="muted">No saved assessment results yet.</p>';
 const max=Math.max(9,...hist.map(a=>a.value.rank))+1;
 let points=hist.map((a,i)=>({a,x:35+(hist.length===1?.5:i/(hist.length-1))*570,y:175-a.value.rank/max*145}));
 let svg='<svg class="progress-svg" role="img" aria-label="Dated assessment results" viewBox="0 0 640 215"><line x1="35" y1="175" x2="605" y2="175" stroke="#becbda"/>';
 svg+='<polyline fill="none" stroke="#2563ad" stroke-width="3" points="'+points.map(p=>p.x+','+p.y).join(' ')+'"/>';
 for(const p of points){
  svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="#2563ad"><title>'+esc(p.a.name+' · '+p.a.grade+' · '+fmtDate(p.a.date))+'</title></circle>';
  if(p.a.targetValue&&p.a.targetValue.scheme===p.a.value.scheme)svg+='<circle cx="'+p.x+'" cy="'+(175-p.a.targetValue.rank/max*145)+'" r="4" fill="#db8b2e"><title>Target: '+esc(p.a.target)+'</title></circle>';
 }
 svg+='</svg><p class="tiny muted">Blue: result. Orange: target, where comparable. Dates appear in chronological order.</p>';
 return svg;
}
function assessmentsView(){
 const cls=currentClass(),list=currentStudents(),pupil=student(selectedStudent)?.classId===classId?student(selectedStudent):list[0];
 const hist=pupil?assessmentHistory(data.assessments,pupil.id):[];
 if(!cls)return heading('Assessment history','Teacher-entered results and imported COTTA grades.')+card(empty('No class','Import an Edulink marksheet.'));
 const cols=cls.assessmentHeaders||[];
 const select=cols.length?'<div class="board-tools"><label>Displayed Edulink COTTA'+choose('assessmentColumn',cols.map(x=>({value:x,label:x})),cls.selectedAssessment||cols[0],'data-action="choose-assessment-column"')+'</label></div>':'<div class="notice">No selectable COTTA columns were detected in this import.</div>';
 const people=choose('assessmentPupil',list.map(x=>({value:x.id,label:x.name})),pupil?.id||'','data-action="select-assessment-pupil"');
 const rows=hist.slice().reverse().map(a=>'<tr><td>'+esc(fmtDate(a.date))+'</td><td>'+esc(a.name)+'</td><td>'+esc(a.grade)+'</td><td>'+esc(a.target)+'</td><td>'+(assessmentGap(a.grade,a.target)??'Not comparable')+'</td><td>'+button('Edit','edit-assessment','btn btn-small','data-id="'+esc(a.id)+'"')+'</td></tr>').join('');
 return heading('Assessment history','Choose COTTA data, enter assessments and review dated pupil progress.',button('+ Save assessment','new-assessment','btn btn-primary'))+
 '<div class="board-tools"><label>Class'+classChoices()+'</label><label>Pupil'+people+'</label></div>'+select+
 card(pupil?'<h3>'+esc(pupil.name)+' · Current '+esc(pupil.current||'Not supplied')+' · Target '+esc(pupil.target||'Not supplied')+'</h3>'+progressChart(pupil.id):'Select a pupil','Pupil progress')+
 card(hist.length?'<div class="table-wrap"><table><thead><tr><th>Date</th><th>Assessment</th><th>Grade</th><th>Target</th><th>Gap</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>No assessments saved for this pupil yet.</p>','Assessment history');
}
function assessmentModal(id=''){
 const old=data.assessments.find(a=>a.id===id),list=currentStudents(),chosen=student(selectedStudent)?.classId===classId?selectedStudent:list[0]?.id;
 if(!list.length){notice('Import a class first.','error');return;}
 const who=old?.studentId||chosen;
 const content='<label>Pupil'+choose('studentId',list.map(s=>({value:s.id,label:s.name})),who)+'</label>'+
 '<label>Assessment name<input name="name" maxlength="140" required value="'+esc(old?.name||'')+'" placeholder="e.g. SLR 4–5 test"></label>'+
 '<label>Date<input type="date" name="date" required value="'+esc(old?.date||isoDate())+'"></label>'+
 '<div class="field-grid"><label>Grade<input name="grade" required maxlength="8" value="'+esc(old?.grade||'')+'"></label><label>Target<input name="target" maxlength="8" value="'+esc(old?.target||student(who)?.target||'')+'"></label></div>'+
 '<label>Notes<textarea name="notes" rows="3" maxlength="1500">'+esc(old?.notes||'')+'</textarea></label>'+
 (old?'<label class="check"><input type="checkbox" name="delete"> Delete this assessment</label>':'');
 openModal(old?'Edit saved assessment':'Save assessment',content,fd=>{
  const sid=String(fd.get('studentId')),name=clean(fd.get('name')),grade=clean(fd.get('grade')),date=String(fd.get('date'));
  if(!list.some(s=>s.id===sid)||!name||!grade||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))throw new Error('Complete a valid pupil, name, grade and date.');
  mutation(()=>{
   if(old&&fd.has('delete'))data.assessments=data.assessments.filter(a=>a.id!==id);
   else{const entry=old||{id:uid()};Object.assign(entry,{studentId:sid,classId,date,name,grade,target:clean(fd.get('target')),notes:clean(fd.get('notes'))});if(!old)data.assessments.push(entry);}
  });
  selectedStudent=sid;
 },old?'Save changes':'Save assessment');
}

function classOverview(){
 const cls=currentClass(),list=currentStudents();if(!cls)return heading('Class overview','Pupil monitoring and import quality.')+card(empty('No class','Import a class first.'));
 const qc=classQuality(data.students,data.classes,classId),records=data.records.filter(x=>x.classId===classId);
 const send=list.filter(s=>s.send&&!/^(n|no|none)$/i.test(s.send)).length;
 const pp=list.filter(s=>/^(yes|y|true|1|pp)$/i.test(s.pp)).length;
 const eal=list.filter(s=>/^(yes|y|true|1)$/i.test(s.eal)).length;
 const below=list.filter(s=>gradeGap(s)?.gap<0).length;
 const rows=list.map(s=>{
  const behavior=records.filter(r=>r.studentId===s.id&&r.type==='behaviour').length;
  const hw=records.filter(r=>r.studentId===s.id&&r.type==='homework'&&r.status==='Missing').length;
  return '<tr><td>'+button(esc(s.name),'open-overview-pupil','btn btn-small','data-id="'+esc(s.id)+'"')+'</td><td>'+esc(s.current||'–')+'</td><td>'+esc(s.target||'–')+'</td><td>'+esc(gradeGap(s)?.label||'Not comparable')+'</td><td>'+hw+'</td><td>'+behavior+'</td></tr>';
 }).join('');
 const issues=[
  ['Duplicate pupil names',qc.duplicates],
  ['Missing target grades',qc.missingTarget],
  ['Missing selected COTTA',qc.emptySelected],
  ['Missing SEND field',qc.missingSEND],
  ['Missing PP field',qc.missingPP]
 ];
 const quality='<div class="grid three">'+stat(qc.duplicates.length,'Duplicates','Review identity')+stat(qc.missingTarget.length,'Missing targets','Source check')+stat(qc.emptySelected.length,'Missing COTTA','Source check')+'</div><div class="list-scroll" style="max-height:280px">'+
 issues.filter(x=>x[1].length).map(x=>'<p><strong>'+esc(x[0])+':</strong> '+esc(x[1].slice(0,30).join(', '))+(x[1].length>30?' and '+(x[1].length-30)+' more':'')+'</p>').join('')+
 (!issues.some(x=>x[1].length)?'<p>No missing mapped assessment or target fields detected.</p>':'')+'</div>';
 return heading('Class overview','Class attainment, confidential teacher records and data-quality checks.',
 button('Assessment history','go-assessments','btn')+button('Year rollover','year-rollover','btn')+button('Export overview','export-class-summary','btn'))+
 '<div class="board-tools"><label>Class'+classChoices()+'</label></div>'+
 '<div class="grid four">'+stat(list.length,'Pupils','Active class register')+stat(send,'SEND','From Edulink')+stat(pp,'PP','From Edulink')+stat(eal,'EAL','From Edulink')+
 stat(below,'Below target','Comparable COTTA')+stat(records.filter(r=>r.type==='homework'&&r.status==='Missing').length,'Missing homework','Open records')+
 stat(records.filter(r=>r.type==='behaviour').length,'Behaviour incidents','All recorded')+stat(data.assessments.filter(a=>a.classId===classId).length,'Assessments','Saved results')+'</div>'+
 card('<div class="table-wrap"><table><thead><tr><th>Pupil</th><th>Current</th><th>Target</th><th>Difference</th><th>Homework</th><th>Behaviour</th></tr></thead><tbody>'+rows+'</tbody></table></div>','Pupil class overview')+
 card(quality,'Import data quality');
}

function strategyModal(id){
 const s=student(id);
 if(!s)return;
 const body='<p class="muted tiny">These are the teacher-maintained fields from the original workbook, separate from the imported OPP. They stay with a matched pupil after an Edulink refresh.</p>'+
 '<label>Agreed teaching strategies<textarea name="strategies" maxlength="4000" rows="5">'+esc(s.strategies||'')+'</textarea></label>'+
 '<label>What helps me learn (pupil voice)<textarea name="voice" maxlength="4000" rows="4">'+esc(s.pupilVoice||'')+'</textarea></label>'+
 '<label>Reviewed date<input type="date" name="reviewDate" value="'+esc(s.reviewedDate||isoDate())+'"></label>';
 openModal('Review teaching strategies: '+s.name,body,fd=>mutation(()=>{
  s.strategies=clean(fd.get('strategies'));s.pupilVoice=clean(fd.get('voice'));s.reviewedDate=String(fd.get('reviewDate')||'');
 }), 'Save reviewed strategies');
}
function yearRolloverModal(){
 const cls=currentClass(),list=currentStudents();
 if(!cls)return;
 const y=new Date().getFullYear()+1;
 openModal('Academic-year rollover','<div class="alert">This creates a separate teaching group. The original class, seating versions, incident records and assessment history are retained in the encrypted workspace. This does not automatically save a backup.</div>'+
 '<p>Currently selected: <strong>'+esc(cls.name)+'</strong> · '+list.length+' active pupils</p>'+
 '<label>New class name<input required name="name" maxlength="140" value="'+esc(cls.name+' '+y+'–'+(y+1))+'"></label>'+
 '<label class="check"><input type="checkbox" name="archive" checked> Mark the previous teaching group archived (keep all original records)</label>'+
 '<p class="tiny muted">Pupil identities, imported information, OPPs and reviewed strategies are copied. Old assessments and behaviour records remain linked to the original teaching group. New pupils receive fresh internal IDs.</p>',
 fd=>{
  const name=clean(fd.get('name'));
  if(!name||data.classes.some(c=>c.name.toLowerCase()===name.toLowerCase()))throw new Error('Enter a unique new teaching group name.');
  mutation(()=>{
   const newClass={id:uid(),name,assessmentHeaders:[...(cls.assessmentHeaders||[])],selectedAssessment:cls.selectedAssessment||'',archived:false};
   data.classes.push(newClass);
   for(const s of list){const copy=clone(s);copy.id=uid();copy.classId=newClass.id;copy.previousStudentId=s.id;copy.active=true;copy.current='';copy.gradeColumns={};data.students.push(copy);}
   data.yearRollovers.push({id:uid(),fromClassId:cls.id,toClassId:newClass.id,date:isoDate(),studentCount:list.length});
   if(fd.has('archive'))cls.archived=true;
   classId=newClass.id;planId='';selectedStudent='';selectedSeat='';
  });
  notice('New teaching group created. Import a fresh Edulink marksheet to refresh its assessments. Back up the workspace before closing.','success');
 },'Create new teaching group');
}
function exportClassSummary(){
 const cls=currentClass();if(!cls)return;
 if(!confirm('Export an unencrypted CSV containing pupil names and assessment results? Store it only in a school-approved secure location.'))return;
 const records=data.records.filter(r=>r.classId===classId);
 const rows=[['Pupil','Current','Target','Grade gap','Missing homework','Behaviour incidents']];
 for(const s of currentStudents()){
  const diff=gradeGap(s)?.gap;
  rows.push([s.name,s.current||'',s.target||'',diff===undefined?'':String(diff),
   String(records.filter(r=>r.studentId===s.id&&r.type==='homework'&&r.status==='Missing').length),
   String(records.filter(r=>r.studentId===s.id&&r.type==='behaviour').length)]);
 }
 const csv=rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 download(csv,'class-overview-'+isoDate()+'.csv','text/csv;charset=utf-8');
 notice('Teacher summary exported locally. No OPP or SEND/PP fields were included.','success');
}
function profiles(){const list=currentStudents().filter(s=>s.name.toLowerCase().includes(searchTerm.toLowerCase()));return heading('Pupil profiles','Teacher-only information from Edulink and locally imported One Page Profiles.',button('↑ Import OPPs','import-opp','btn btn-primary')+(data.pendingOPPs?.length?button('Review '+data.pendingOPPs.length+' OPP match(es)','review-opps','btn'):''))+ (!data.classes.length?card(empty('No pupils yet','Import your Edulink CSV from the dashboard.')):`<div class="board-tools"><label>Class${classChoices()}</label><label>Search pupils<input id="pupilSearch" placeholder="Search name" value="${esc(searchTerm)}"></label></div><div class="grid two">${card(`<div class="list-scroll profile-list">${list.map(s=>`<button type="button" class="pupil-chip ${selectedStudent===s.id?'selected':''}" data-action="select-profile" data-id="${esc(s.id)}"><strong>${esc(s.name)}</strong><span class="pill ${s.opp?'green':'grey'}">${s.opp?'OPP':'No OPP'}</span></button>`).join('')||empty('No results','Try a different name.')}</div>`,'Class pupils')}${card(selectedStudent&&student(selectedStudent)?.classId===classId?profileDetails(student(selectedStudent)):empty('Select a pupil','Open their Edulink information, OPP guidance, attainment and teacher records.'),'Pupil information')}</div>`);}
function profileDetails(s){let opp=s.opp||{};let head=`<div class="profile-head">${opp.photo&&/^data:image\/(png|jpeg|webp);base64,/.test(opp.photo)?`<img class="avatar" src="${opp.photo}" alt="Pupil photograph">`:'<div class="avatar">♙</div>'}<div><h2>${esc(s.name)}</h2><div class="tag-list">${s.send?badge('SEND '+s.send):''}${s.pp?badge('PP '+s.pp):''}${s.prior?badge('PA '+s.prior):''}${s.eal?badge('EAL '+s.eal):''}${s.more&&/^(yes|y|true|1)$/i.test(s.more)?badge('More Able'):''}${s.internalExternal?badge('KS5 '+s.internalExternal):''}</div></div></div><div class="tabbar">${['support','attainment','history'].map(t=>`<button class="tab ${profileTab===t?'active':''}" data-action="profile-tab" data-tab="${t}">${{support:'OPP / strategies',attainment:'Attainment',history:'Records'}[t]}</button>`).join('')}</div>`;
 if(profileTab==='attainment')return head+(gradeGap(s)?`<div class="grade-summary grade-${gradeGap(s).band}"><strong>${esc(gradeGap(s).label)}</strong> · Current ${esc(s.current)} / Target ${esc(s.target)}</div>`:'')+`<div class="grid two">${[['Target',s.target],['Current',s.current],['Reading age',s.readingAge],['Reading SS',s.readingSS],['Spelling age',s.spellingAge],['Spelling SS',s.spellingSS],['KS2 Reading',s.ks2Reading],['KS2 Maths',s.ks2Maths]].map(([t,v])=>`<div class="notice"><small>${esc(t)}</small><strong style="display:block;font-size:17px;margin-top:4px">${esc(v||'Not supplied')}</strong></div>`).join('')}</div><p class="tiny muted">Assessment grades are shown as supplied by Edulink; no numeric grade gap is invented for missing or non-numeric grades.</p>`;
 if(profileTab==='history')return head+recordRows(data.records.filter(r=>r.studentId===s.id),true);
 return head+`<div class="notice">${opp.need?`<strong>Area of need:</strong> ${esc(opp.need)}<br>`:''}${opp.diagnosis?`<strong>Identification:</strong> ${esc(opp.diagnosis)}<br>`:''}${opp.examAccess?`<strong>Exam access:</strong> ${esc(opp.examAccess)}`:''}${!s.opp?'No One Page Profile imported for this pupil.':''}</div>${[['adaptations','High Quality Teaching Adaptations'],['adjustments','Reasonable adjustments / SEND provision'],['targets','Preparation for adulthood'],['about','Things you should know']].map(([key,title])=>`<div class="opp-section"><h4>${title}</h4>${opp[key]?.length?`<ul>${opp[key].map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:'<p class="muted tiny">Not provided</p>'}</div>`).join('')}<div class="opp-section"><h4>Reviewed teaching strategies & pupil voice</h4><p><strong>Agreed strategies:</strong> ${esc(s.strategies||'Not recorded')}</p><p><strong>What helps me learn:</strong> ${esc(s.pupilVoice||'Not recorded')}</p><p><strong>Last reviewed:</strong> ${esc(s.reviewedDate?fmtDate(s.reviewedDate):'Not reviewed')}</p>${button('Edit pupil strategies','edit-strategies','btn btn-small btn-primary',`data-id="${esc(s.id)}"`)}</div><div class="opp-section"><h4>Teacher strategies and notes</h4><textarea id="profileNotes" rows="3" placeholder="Optional classroom notes, kept only in memory unless you export a backup">${esc(s.notes||'')}</textarea>${button('Update notes','save-profile-notes','btn btn-small btn-primary')}</div>`;}

function records(){
 const cls=currentClass(),list=currentStudents(),all=data.records.filter(r=>r.classId===classId);
 const filtered=recordFilter==='all'?all:all.filter(r=>r.type===recordFilter);
 const selected=student(selectedRecord)?.classId===classId?student(selectedRecord):list[0];
 const behaviour=all.filter(r=>r.type==='behaviour'),homework=all.filter(r=>r.type==='homework');
 const freq=behaviour.filter(r=>r.studentId===selected?.id);
 const categories=[...new Set([...(data.categories||[]),...behaviour.map(r=>r.category).filter(Boolean)])];
 const catRows=categories.map(type=>'<tr><td>'+esc(type)+'</td><td>'+freq.filter(r=>r.category===type).length+'</td></tr>').join('');
 const cutoff=recordPeriod===0?0:Date.now()-recordPeriod*86400000;
 const recent=homework.filter(r=>!cutoff||new Date(r.date+'T12:00:00').getTime()>=cutoff);
 const missing=recent.filter(r=>r.status==='Missing'),resolved=recent.filter(r=>r.status==='Resolved');
 const totals=list.map(s=>({s,count:missing.filter(r=>r.studentId===s.id).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,12);
 const max=Math.max(1,...totals.map(x=>x.count));
 const trends=totals.length?totals.map(x=>'<div class="mini-bar"><span>'+esc(x.s.name)+'</span><div><i style="width:'+Math.round(x.count/max*100)+'%"></i></div><strong>'+x.count+'</strong></div>').join(''):'<p class="muted tiny">No missing homework records in this period.</p>';
 return heading('Teacher records','Record and analyse homework and behaviour without writing back to Edulink.',
 button('✓ Mark whole-class homework','start-homework','btn btn-primary')+button('+ Record homework','new-homework','btn')+
 button('+ Behaviour entry','new-behaviour','btn')+button('Edit behaviour types','edit-categories','btn'))+
 (!cls?card(empty('No class imported','Add a marksheet to begin tracking.')):'<div class="board-tools"><label>Class'+classChoices()+'</label><label>Show'+choose('filter',['all','homework','behaviour'].map(v=>({value:v,label:v[0].toUpperCase()+v.slice(1)})),recordFilter,'data-action="filter-records"')+'</label></div>'+
 '<div class="grid four">'+stat(homework.length,'Homework entries','All dates')+stat(behaviour.length,'Behaviour entries','All dates')+stat(new Set(all.map(r=>r.studentId)).size,'Pupils with records','Across class')+stat(missing.length,'Currently missing','Selected date range')+'</div>'+
 card(recordRows(filtered),'Entries ('+filtered.length+')')+
 '<div class="grid two">'+card('<div class="board-tools"><label>Pupil'+choose('recordPupil',list.map(s=>({value:s.id,label:s.name})),selected?.id||'','data-action="select-record-pupil"')+'</label></div>'+
 '<p><strong>'+freq.length+' total behaviour incidents</strong> for '+esc(selected?.name||'pupil')+'</p><div class="table-wrap"><table><thead><tr><th>Behaviour category</th><th>Count</th></tr></thead><tbody>'+catRows+'</tbody></table></div>','Behaviour summary')+
 card('<div class="board-tools"><label>Period'+choose('period',[{value:'7',label:'Last 7 days'},{value:'30',label:'Last 30 days'},{value:'90',label:'Last 90 days'},{value:'0',label:'All dates'}],String(recordPeriod),'data-action="change-record-period"')+'</label></div>'+
 '<p><strong>'+missing.length+'</strong> missing · <strong>'+resolved.length+'</strong> resolved in this period</p>'+trends,'Homework trends')+'</div>');
}
function recordRows(rows,mini=false){return rows.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Pupil</th><th>Category</th><th>Status</th><th>Details</th>${mini?'':'<th></th>'}</tr></thead><tbody>${rows.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(student(r.studentId)?.name||'Former pupil')}</td><td>${esc(r.category||r.type)}</td><td>${badge(r.status||'Recorded',r.status==='Resolved'?'green':'amber')}</td><td>${esc(short(r.notes||r.assignment||'',65))}</td>${mini?'':`<td>${button('Edit','edit-record','btn btn-small',`data-id="${esc(r.id)}"`)}</td>`}</tr>`).join('')}</tbody></table></div>`:empty('No records','Add a homework or behaviour entry to start a local record.');}

function quickPupilMenu(id){
 const s=student(id),p=currentPlan();if(!s||!p||s.classId!==classId)return;
 selectedStudent=id;
 const seat=p.layout.seats.find(x=>p.assignments[x.id]===id);
 const actions=[['View profile','profile'],['Record homework','homework'],['Record behaviour','behaviour'],['Seating rules','rules'],['Lock / unlock seat','lock']];
 const content='<div class="notice"><strong>'+esc(s.name)+'</strong><p>'+esc(seat?'Seat '+seat.label:'Unseated')+'</p></div><div class="quick-actions">'+actions.map(a=>'<button type="button" class="btn" data-quick-action="'+a[1]+'">'+esc(a[0])+'</button>').join('')+'</div>';
 openModal('Quick pupil actions',content,()=>{},'Close');
 $('#modalRoot').querySelectorAll('[data-quick-action]').forEach(btn=>btn.addEventListener('click',()=>{
  const which=btn.dataset.quickAction;closeModal();
  if(which==='profile')showStudent(id);
  if(which==='homework')recordModal('homework');
  if(which==='behaviour')recordModal('behaviour');
  if(which==='rules')rulesModal();
  if(which==='lock'&&seat){selectedSeat=seat.id;action('toggle-lock');}
 }));
}
function markPicked(status){
 if(!lastPicked||!currentStudents().some(s=>s.id===lastPicked)){notice('Pick a pupil first.','error');return;}
 const id=lastPicked;
 mutation(()=>{
  data.questioningLog.push({id:uid(),classId,studentId:id,date:isoDate(),status,at:new Date().toISOString()});
  if(status==='asked'&&!data.questioned[classId]?.includes(id))data.questioned[classId]=[...(data.questioned[classId]||[]),id];
  if(status==='absent')absent.add(id);
 });
 lastPickerState=status;renderProjector();
 notice((status==='asked'?'Questioned':'Absent')+' recorded for '+(student(id)?.name||'pupil')+'.','success');
}
function timerClock(){
 const value=lessonTimer.running?Math.max(0,Math.ceil((lessonTimer.endsAt-Date.now())/1000)):lessonTimer.remaining;
 const mm=String(Math.floor(value/60)).padStart(2,'0'),ss=String(value%60).padStart(2,'0');
 return mm+':'+ss;
}
function timerTick(){
 if(lessonTimer.running){
  lessonTimer.remaining=Math.max(0,Math.ceil((lessonTimer.endsAt-Date.now())/1000));
  if(!lessonTimer.remaining){lessonTimer.running=false;lessonTimer.endsAt=0;notice('Task timer finished.','success');}
 }
 const el=$('#lessonTimerLabel');if(el){el.textContent=timerClock();el.classList.toggle('timer-finished',!lessonTimer.remaining);}
}
function timerAction(command,value=''){
 if(command==='timer-set'||command==='timer-preset'){
  const minutes=command==='timer-preset'?Number(value):Number($('#customMinutes')?.value||0);
  if(!Number.isFinite(minutes)||minutes<1||minutes>180){notice('Choose a timer between 1 and 180 minutes.','error');return;}
  lessonTimer={remaining:Math.round(minutes*60),running:false,endsAt:0};
 }else if(command==='timer-start'){if(lessonTimer.remaining>0&&!lessonTimer.running){lessonTimer.running=true;lessonTimer.endsAt=Date.now()+lessonTimer.remaining*1000;}}
 else if(command==='timer-pause'){if(lessonTimer.running){lessonTimer.remaining=Math.max(0,Math.ceil((lessonTimer.endsAt-Date.now())/1000));lessonTimer.running=false;}}
 else if(command==='timer-reset'){lessonTimer={remaining:300,running:false,endsAt:0};}
 else if(command==='timer-fullscreen'){const el=$('#lessonClock');if(!el)return;el.requestFullscreen?.().catch(()=>notice('Fullscreen is not available on this browser.'));}
 timerTick();
 if(command!=='timer-fullscreen')render();
}
function timerMarkup(){
 return '<section class="card lesson-clock" id="lessonClock"><h2>Task timer</h2><div id="lessonTimerLabel" class="timer-digits">'+timerClock()+'</div>'+
 '<div class="button-row timer-buttons">'+[2,5,10,15,20,30].map(n=>button(n+' min','timer-preset','btn btn-small','data-value="'+n+'"')).join('')+'</div>'+
 '<div class="button-row"><input id="customMinutes" type="number" min="1" max="180" value="10" aria-label="Custom timer minutes" style="max-width:110px">'+button('Set minutes','timer-set','btn btn-small')+'</div>'+
 '<div class="button-row">'+button(lessonTimer.running?'Pause':'Start',lessonTimer.running?'timer-pause':'timer-start','btn btn-primary')+
 button('Reset','timer-reset','btn')+button('Fullscreen','timer-fullscreen','btn')+'</div></section>';
}
function lesson(){
 const p=currentPlan(),list=currentStudents(),asked=(data.questioned[classId]||[]).length;
 const picked=lastPicked?student(lastPicked):null;
 const seat=p?seatMarkup(p.layout,p.assignments):card(empty('No seating plan','Create a seating plan version first.'));
 return heading('Lesson mode','Your seating plan, questioning, homework, timer and quick pupil actions in one place.',
 button('Seating plans','go-seating','btn')+button(hideIndicators?'Show indicators':'Hide indicators','toggle-indicators','btn')+button('Privacy lock','privacy-lock','btn'))+
 (!classId?card(empty('No class','Import a class and create a plan.')):'<div class="board-tools no-print"><label>Class'+classChoices()+'</label><label>Plan version'+planChoices()+'</label></div>'+
 '<div class="lesson-grid"><section class="card stage-card"><h2>Class seating · '+esc(p?.name||'No plan')+'</h2>'+
 (homeworkSession?.classId===classId?'<div class="notice"><strong>Marking missing homework: '+esc(homeworkSession.assignment)+'</strong> · '+homeworkSession.missing.length+' selected. '+button('Save','finish-homework','btn btn-small')+button('Cancel','cancel-homework','btn btn-small')+'</div>':'')+
 seat+'<p class="tiny muted no-print">Tap a pupil to open quick actions. Right-click or long-press also works.</p><div class="button-row no-print">'+
 button('Mark homework','start-homework','btn btn-primary')+button('Record behaviour','new-behaviour','btn')+
 button('Generate seats','auto-seat','btn')+'</div></section>'+
 '<div class="lesson-side">'+timerMarkup()+
 card('<div class="picker-stage"><strong>'+esc(picked?.name||'Ready to pick')+'</strong><small>'+esc(p&&picked?p.layout.seats.find(s=>p.assignments[s.id]===picked.id)?.label||'Not seated':'')+'</small></div>'+
 '<p>'+asked+' pupil(s) questioned in this round.</p><div class="button-row">'+button('Pick pupil','pick-student','btn btn-primary')+button('Questioned ✓','mark-questioned','btn')+button('Absent','mark-absent-picked','btn')+button('Reset lesson','reset-lesson','btn')+'</div>'+
 '<p class="tiny muted">Pick does not mark the pupil questioned until you confirm.</p>','Questioning tracker')+
 card('<p>Shortcuts for lesson delivery.</p><div class="button-row">'+button('Teacher records','go-records','btn')+button('Class overview','go-overview','btn')+button('Projector view','projector-view','btn')+'</div>','Quick tools')+'</div></div>');
}
function tools(){const p=currentPlan(),list=currentStudents().filter(s=>!pickerExclude||!absent.has(s.id)),asked=new Set(data.questioned[classId]||[]);return heading('Teaching tools','Random questioning, attendance exclusions and intelligent pupil grouping.')+(!classId?card(empty('No classes yet','Import a marksheet first.')):`<div class="board-tools"><label>Class${classChoices()}</label>${p?`<label>Plan version${planChoices()}</label>`:''}</div><div class="grid two">${card(`<div class="picker-stage"><div><small class="muted">Random pupil picker</small><br><strong>${esc(lastPicked?student(lastPicked)?.name||'':'Ready to pick')}</strong>${lastPicked&&p?`<small class="muted">${esc((p.layout.seats.find(x=>p.assignments[x.id]===lastPicked)?.label||'Not seated'))}</small>`:''}</div></div><p class="muted tiny">${asked.size} of ${list.length} pupils questioned. Does not repeat until you reset the round.</p><label class="check"><input id="pickerExclude" type="checkbox" ${pickerExclude?'checked':''}> Exclude pupils marked absent</label><div class="button-row">${button('⚄ Pick a pupil','pick-student','btn btn-primary')}${button('Questioned ✓','mark-questioned','btn')}${button('Absent','mark-absent-picked','btn')}${button('Reset round','reset-picker','btn')}${button('Projector view','projector-view','btn')}${button('Fullscreen picker','fullscreen-picker','btn')}</div><details><summary>Mark pupils absent (${absent.size})</summary><div class="list-scroll" style="max-height:200px">${currentStudents().map(s=>`<label class="check"><input type="checkbox" data-absent="${esc(s.id)}" ${absent.has(s.id)?'checked':''}> ${esc(s.name)}</label>`).join('')}</div></details>`,'Questioning tracker')}${card(`<form id="groupForm"><div class="field-grid"><label>Group size<input name="size" type="number" min="2" max="12" value="4"></label><label>Grouping method${choose('mode',[{value:'random',label:'Random'},{value:'mixed',label:'Mixed attainment'},{value:'similar',label:'Similar attainment'},{value:'seating',label:'Nearby seating'}])}</label></div><label class="check"><input type="checkbox" name="excludeAbsent" checked> Exclude pupils marked absent</label><div class="button-row"><button class="btn btn-primary" type="submit">Generate groups</button>${button('Print groups','print-groups','btn')}</div></form><div id="groupDisplay">${groupsDisplay(groupResult)}</div><p class="tiny muted">Group separation restrictions are respected where possible. Check flagged conflicts before using groups.</p>`,'Grouping tool')}</div>`);}
function groupsDisplay(groups){if(!groups.length)return '<p class="muted tiny">No groups generated yet.</p>';const rules=currentPlan()?.rules||[];return `<div class="grid two" style="margin-top:15px">${groups.map((g,i)=>{let bad=g.some((s,j)=>g.some((t,k)=>k>j&&rules.some(r=>r.type==='apart'&&r.mode==='group'&&((r.a===s.id&&r.b===t.id)||(r.a===t.id&&r.b===s.id)))));return `<div class="group-result"><h3>Group ${i+1} ${bad?badge('Check restriction','red'):''}</h3><ol>${g.map(s=>`<li>${esc(s.name)}</li>`).join('')}</ol></div>`}).join('')}</div>`;}
function backup(){return heading('Backup & restore','Your data is held in temporary memory until you explicitly download an encrypted file.')+`<div class="grid two">${card(`<div class="callout privacy"><strong>Encrypted full-session export</strong><p>Includes pupils, their OPPs and photographs, records, room templates, seating rules, all plan versions and questioning history. Encryption uses AES-256-GCM with a PBKDF2-derived key.</p></div><div class="button-row" style="margin-top:15px">${button('↓ Create encrypted backup','download-backup','btn btn-primary')}</div><p class="tiny muted">Use a unique password of at least 12 characters. Keep the file and password in your school-approved secure storage. The password cannot be recovered.</p>`,'Save locally')}${card(`<div class="notice">Restoring an encrypted backup replaces the current session. Export your current work first if you wish to keep it.</div><div class="button-row" style="margin-top:15px">${button('↑ Restore encrypted backup','restore-backup','btn btn-primary')}${button('✓ Verify downloaded backup','verify-backup','btn')}</div><p class="tiny muted">Verifying decrypts a selected file locally without changing this session. Only files created by this application are accepted. No file contents are transmitted.</p>${backupVerifyStatus?`<div class="notice" role="status">${esc(backupVerifyStatus)}</div>`:''}`,'Continue your work')}</div><div class="grid two">${card(`<p>Share room layouts without student data. This file contains only room names, desk coordinates and accessibility priorities.</p>${button('↓ Export empty room templates','export-rooms','btn')}`,'Share empty layouts')}${card(`<p>No automatic browser storage. Closing or refreshing the tab discards all unexported changes.</p>${button('Clear this session','clear-session','btn btn-danger')}`,'Privacy controls')}</div>`;}

// Event delegation for ordinary controls. Data from files is escaped before being inserted into the page.
$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){goto(b.dataset.view);$('.sidebar').classList.remove('open');}});
$('#menuToggle').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
$('#privacyToggle').addEventListener('click',()=>{privacyLocked=!privacyLocked;if(privacyLocked&&projectorWindow&&!projectorWindow.closed){projectorWindow.close();projectorWindow=null;}render();});
$('#undoButton').addEventListener('click',undo);$('#redoButton').addEventListener('click',redo);$('#quickBackup').addEventListener('click',()=>action('download-backup'));$('#clearSession').addEventListener('click',()=>action('clear-session'));
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if(e.key.toLowerCase()==='y'){e.preventDefault();redo();}}});
window.addEventListener('beforeunload',e=>{if(dirty||homeworkSession){e.preventDefault();e.returnValue='';}});
window.addEventListener('afterprint',()=>document.body.classList.remove('print-pupil','print-teacher','print-groups'));
$('#app').addEventListener('click',e=>{if(suppressSeatClick){suppressSeatClick=false;return;}const trigger=e.target.closest('[data-action]');if(trigger){if(trigger.tagName!=='SELECT'){e.preventDefault();action(trigger.dataset.action,trigger.dataset);return;}}const seat=e.target.closest('[data-seat]');if(seat&&!dragState)seatClick(seat.dataset.seat);const person=e.target.closest('[data-student]');if(person&&!e.target.closest('button')){if(homeworkSession?.classId===classId)toggleHomework(person.dataset.student);else{selectedStudent=person.dataset.student;render();}}});
$('#app').addEventListener('contextmenu',e=>{const seat=e.target.closest('[data-seat]');if(!seat||!['lesson','seating'].includes(view))return;const id=currentPlan()?.assignments[seat.dataset.seat];if(id){e.preventDefault();quickPupilMenu(id);}});
$('#app').addEventListener('pointerdown',e=>{if(!['lesson','seating'].includes(view)||e.button!==0)return;const seat=e.target.closest('[data-seat]'),id=seat&&currentPlan()?.assignments[seat.dataset.seat];if(!id)return;contextLongPress={x:e.clientX,y:e.clientY,token:setTimeout(()=>{suppressSeatClick=true;contextLongPress=null;quickPupilMenu(id);},650)};});
const cancelLongPress=()=>{if(contextLongPress){clearTimeout(contextLongPress.token);contextLongPress=null;}};
$('#app').addEventListener('pointermove',e=>{if(contextLongPress&&Math.hypot(e.clientX-contextLongPress.x,e.clientY-contextLongPress.y)>10)cancelLongPress();});
$('#app').addEventListener('pointerup',cancelLongPress);$('#app').addEventListener('pointercancel',cancelLongPress);
$('#app').addEventListener('dblclick',e=>{const seat=e.target.closest('[data-seat]');if(seat&&view==='seating'){const id=currentPlan()?.assignments[seat.dataset.seat];if(id)showStudent(id);}});
$('#app').addEventListener('change',e=>{const t=e.target;if(t.dataset.action==='select-class'){setClass(t.value);render();}else if(t.dataset.action==='choose-assessment-column'){const cls=currentClass(),choice=t.value;if(!cls?.assessmentHeaders?.includes(choice))return;mutation(()=>{cls.selectedAssessment=choice;for(const s of data.students.filter(x=>x.classId===classId)){s.current=s.gradeColumns?.[choice]||'';}});}else if(t.dataset.action==='select-assessment-pupil'){selectedStudent=t.value;render();}else if(t.dataset.action==='select-plan'){planId=t.value;selectedSeat='';render();}else if(t.dataset.action==='select-room'){roomId=t.value;selectedSeat='';render();}else if(t.dataset.action==='filter-records'){recordFilter=t.value;render();}else if(t.dataset.action==='select-record-pupil'){selectedRecord=t.value;render();}else if(t.dataset.action==='change-record-period'){recordPeriod=Number(t.value);render();}else if(t.dataset.absent){t.checked?absent.add(t.dataset.absent):absent.delete(t.dataset.absent);render();}else if(t.id==='pickerExclude'){pickerExclude=t.checked;render();}});
$('#app').addEventListener('input',e=>{if(e.target.id==='pupilSearch'){searchTerm=e.target.value;const pos=e.target.selectionStart;render();const el=$('#pupilSearch');if(el){el.focus();el.setSelectionRange(pos,pos);}}});
$('#app').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target);if(e.target.id==='roomSeatForm'){const r=currentRoom(),id=selectedSeat;mutation(()=>{const s=r.seats.find(x=>x.id===id);if(!s)return;s.label=clean(fd.get('label'))||s.label;s.priority=fd.get('priority');s.group=clean(fd.get('group'));s.x=Math.min(95,Math.max(5,Number(fd.get('x'))));s.y=Math.min(93,Math.max(15,Number(fd.get('y'))));s.rotation=Number(fd.get('rotation'));});}else if(e.target.id==='groupForm'){const selected=currentStudents().filter(s=>!fd.get('excludeAbsent')||!absent.has(s.id));groupResult=makeGroups(selected,currentPlan()||{assignments:{},layout:{seats:[]},rules:[]},{size:Number(fd.get('size'))||4,mode:fd.get('mode')});render();}});
$('#app').addEventListener('dragstart',e=>{if(homeworkSession)return;const p=e.target.closest('[data-student]');if(p){e.dataTransfer.setData('text/plain',p.dataset.student);e.dataTransfer.effectAllowed='move';}});
$('#app').addEventListener('dragover',e=>{if(e.target.closest('.seat')&&view==='seating')e.preventDefault();});
$('#app').addEventListener('drop',e=>{const b=e.target.closest('.seat');if(b&&view==='seating'&&!homeworkSession){e.preventDefault();const sid=e.dataTransfer.getData('text/plain');if(student(sid))assignSeat(b.dataset.seat,sid);}});
// Smooth pointer dragging of physical desks, with a single undo step per drag.
$('#app').addEventListener('pointerdown',e=>{if(view!=='rooms'||e.button!==0)return;const part=e.target.closest('[data-seat],[data-desk]');if(!part)return;const canvas=$('#roomCanvas');const rect=canvas.getBoundingClientRect();const r=currentRoom();const s=part.dataset.seat?r.seats.find(s=>s.id===part.dataset.seat):r.teacher;if(!s)return;dragState={id:part.dataset.seat||'teacher',from:{x:s.x,y:s.y},rect,part,moved:false,prior:clone(data)};try{part.setPointerCapture(e.pointerId)}catch{};});
$('#app').addEventListener('pointermove',e=>{if(!dragState||view!=='rooms')return;const d=dragState,r=currentRoom(),s=d.id==='teacher'?r.teacher:r.seats.find(x=>x.id===d.id);if(!s)return;const x=Math.max(5,Math.min(95,(e.clientX-d.rect.left)/d.rect.width*100)),y=Math.max(d.id==='teacher'?5:16,Math.min(95,(e.clientY-d.rect.top)/d.rect.height*100));if(Math.hypot(x-d.from.x,y-d.from.y)>1)d.moved=true;s.x=Math.round(x);s.y=Math.round(y);d.part.style.left=s.x+'%';d.part.style.top=s.y+'%';});
$('#app').addEventListener('pointerup',()=>{if(!dragState)return;const d=dragState;dragState=null;if(d.moved){history.push(d.prior);if(history.length>60)history.shift();future=[];dirty=true;selectedSeat=d.id==='teacher'?'':d.id;render();}else if(d.id!=='teacher'){selectedSeat=d.id;render();}});
$('#app').addEventListener('pointercancel',()=>{if(dragState){data=dragState.prior;dragState=null;render();}});

function seatClick(seatId){const p=currentPlan();if(homeworkSession?.classId===classId&&(view==='seating'||view==='lesson')){const id=p?.assignments[seatId];if(id)toggleHomework(id);else notice('This seat has no pupil. Use the class list for unseated pupils.');return;}if(view==='rooms'){selectedSeat=seatId;render();return;}if(view==='lesson'){const id=p?.assignments[seatId];if(id)quickPupilMenu(id);else notice('Select an occupied seat to open pupil actions.');return;}if(!p)return;
 if(selectedStudent){assignSeat(seatId,selectedStudent);return;}
 if(selectedSeat&&selectedSeat!==seatId){const a=selectedSeat,b=seatId;if(p.locks.includes(a)||p.locks.includes(b)){notice('Unlock fixed seats before swapping pupils.','error');return;}mutation(()=>{const first=p.assignments[a],second=p.assignments[b];if(first!==undefined)p.assignments[b]=first;else delete p.assignments[b];if(second!==undefined)p.assignments[a]=second;else delete p.assignments[a];});selectedSeat=b;return;}
 selectedSeat=seatId;render();}
function assignSeat(seatId,id){const p=currentPlan();if(!p||!currentStudents().some(s=>s.id===id))return;
 try{const result=placeStudent(p,seatId,id);if(result.action!=='unchanged')mutation(()=>{p.assignments=result.assignments;});selectedStudent='';selectedSeat=seatId;if(result.action==='swapped')notice('Pupils swapped. Undo is available.','success');}
 catch(err){notice(err.message,'error');}
}
function openModal(title,body,onSave,saveLabel='Save'){const root=$('#modalRoot');root.innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><form id="modalForm">${body}<div class="modal-actions">${button('Cancel','close-modal','btn')}<button class="btn btn-primary" type="submit">${esc(saveLabel)}</button></div></form></div></div>`;root.querySelector('#modalForm').onsubmit=e=>{e.preventDefault();try{const values=new FormData(e.currentTarget);const result=onSave(values);if(result&&typeof result.then==='function')result.then(()=>{closeModal();}).catch(e=>notice(e.message,'error'));else closeModal();}catch(err){notice(err.message,'error');}};root.querySelector('[data-action=close-modal]').onclick=closeModal;root.querySelector('.modal-backdrop').addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});root.querySelector('input,select,textarea')?.focus();}
function closeModal(){$('#modalRoot').replaceChildren();}
const field=(name,title,value='',type='text')=>`<label>${esc(title)}<input type="${type}" name="${name}" value="${esc(value)}" ${type==='text'?'maxlength="140"':''} required></label>`;
function showStudent(id){selectedStudent=id;profileTab='support';goto('profiles');}
function action(id,attrs={}){try{switch(id){
 case 'import-csv':$('#csvFile').click();break;
 case 'import-opp':$('#oppFiles').click();break;case 'review-opps':reviewPendingOPPs();break;
 case 'go-rooms':goto('rooms');break;case 'go-backup':goto('backup');break;
 case 'open-class':setClass(attrs.id);goto('seating');break;
 case 'new-version':{if(!classId){notice('Import a class first.','error');break;}openModal('Create seating plan version',`${field('name','Version name','Autumn 1')}<label>Room layout${choose('room',data.rooms.map(r=>({value:r.id,label:r.name})),roomId)}</label>`,fd=>{const room=data.rooms.find(r=>r.id===fd.get('room'));mutation(()=>{const p=newPlan(classId,room,clean(fd.get('name')));data.plans.push(p);planId=p.id;roomId=room.id;});selectedSeat='';});break;}
 case 'duplicate-plan':{const p=currentPlan();if(!p)break;openModal('Duplicate this version',field('name','New version name',p.name+' copy'),fd=>mutation(()=>{const n=clone(p);n.id=uid();n.name=clean(fd.get('name'));n.created=new Date().toISOString();data.plans.push(n);planId=n.id;}));break;}
 case 'rename-plan':{const p=currentPlan();if(!p)break;openModal('Rename version',field('name','Version name',p.name),fd=>mutation(()=>p.name=clean(fd.get('name'))));break;}
 case 'delete-plan':{const p=currentPlan();if(!p||!confirm(`Delete version "${p.name}"? This can be undone.`))break;mutation(()=>{data.plans=data.plans.filter(x=>x.id!==p.id);planId='';});break;}
 case 'compare-plans':compareVersions();break;
 case 'auto-seat':generateSeatsModal();break;
 case 'restore-pupils':{const p=currentPlan();if(!p?.previousAssignments){notice('No earlier generated seating arrangement saved in this version. Use Undo or an earlier version.');break;}if(confirm('Restore the previous seating arrangement? The current arrangement can be recovered using Undo.'))mutation(()=>{const prior=clone(p.assignments);p.assignments=clone(p.previousAssignments);p.previousAssignments=prior;});break;}
 case 'clear-seats':{const p=currentPlan();if(p&&confirm('Unseat all pupils in this version? You can undo this change.'))mutation(()=>{p.previousAssignments=clone(p.assignments);p.assignments={};p.locks=[];});break;}
 case 'toggle-lock':{const p=currentPlan();if(p&&selectedSeat)mutation(()=>{p.locks=p.locks.includes(selectedSeat)?p.locks.filter(x=>x!==selectedSeat):[...p.locks,selectedSeat];});break;}
 case 'unseat':{const p=currentPlan();if(p&&selectedSeat)mutation(()=>{delete p.assignments[selectedSeat];p.locks=p.locks.filter(x=>x!==selectedSeat);});break;}
 case 'show-selected':{const id=currentPlan()?.assignments[selectedSeat];if(id)showStudent(id);break;}
 case 'show-student':showStudent(attrs.id);break;
 case 'select-profile':selectedStudent=attrs.id;profileTab='support';render();break;
 case 'profile-tab':profileTab=attrs.tab;render();break;
 case 'edit-strategies':strategyModal(attrs.id);break;
 case 'save-profile-notes':{const id=selectedStudent,value=$('#profileNotes')?.value||'';mutation(()=>{const s=student(id);if(s)s.notes=value;});notice('Notes updated in session memory.','success');break;}
 case 'seating-rules':rulesModal();break;
 case 'go-assessments':goto('assessments');break;
 case 'open-overview-pupil':selectedStudent=attrs.id;profileTab='support';goto('profiles');break;
 case 'year-rollover':yearRolloverModal();break;
 case 'export-class-summary':exportClassSummary();break;
 case 'new-assessment':assessmentModal();break;
 case 'edit-assessment':assessmentModal(attrs.id);break;
 case 'opp-seating-prompts':oppSeatingPromptsModal();break;
 case 'plan-notes':planNotesModal();break;
 case 'group-access-preference':groupAccessPreferenceModal();break;
 case 'toggle-indicators':hideIndicators=!hideIndicators;render();break;
 case 'projector-view':openProjector(false);break;
 case 'fullscreen-picker':openProjector(true);break;
 case 'sync-room':{const p=currentPlan(),room=data.rooms.find(r=>r.id===p?.roomId);if(!p||!room)break;const missing=Object.keys(p.assignments).filter(id=>!room.seats.some(s=>s.id===id)).length;if(confirm(`Apply latest room template to this version? ${missing} occupied seat(s) would be removed. You can undo this.`))mutation(()=>{p.layout=clone({kind:room.kind||'',seats:room.seats,teacher:room.teacher,board:room.board});p.assignments=Object.fromEntries(Object.entries(p.assignments).filter(([k])=>p.layout.seats.some(s=>s.id===k)));p.locks=p.locks.filter(id=>p.layout.seats.some(s=>s.id===id));});break;}
 case 'new-room':openModal('Create new room',`${field('name','Room name','Room 1')}<label>Layout${choose('preset',[{value:'242',label:'Standard 2-4-2'},{value:'it3',label:'IT3 · 34 seats'},{value:'it2',label:'IT2 · 33 seats'},{value:'pairs',label:'Paired desks'},{value:'groups',label:'Grouped tables'},{value:'u',label:'U shape'}])}</label>`,fd=>mutation(()=>{const r=buildPreset(fd.get('preset'),clean(fd.get('name')));data.rooms.push(r);roomId=r.id;selectedSeat='';}));break;
 case 'duplicate-room':{const r=currentRoom();openModal('Duplicate room',field('name','Room name',r.name+' copy'),fd=>mutation(()=>{const n=clone(r);n.id=uid();n.name=clean(fd.get('name'));data.rooms.push(n);roomId=n.id;selectedSeat='';}));break;}
 case 'rename-room':{const r=currentRoom();openModal('Rename room',field('name','Room name',r.name),fd=>mutation(()=>r.name=clean(fd.get('name'))));break;}
 case 'delete-room':{if(data.rooms.length<=1){notice('Keep at least one room template.','error');break;}if(confirm('Delete this room template? Existing plan versions retain their layouts.'))mutation(()=>{data.rooms=data.rooms.filter(r=>r.id!==roomId);roomId=data.rooms[0].id;selectedSeat='';});break;}
 case 'reset-room':{const r=currentRoom(),k=r.preset||r.kind||(r.name==='Standard 2-4-2'?'242':'');if(!['242','it2','it3','pairs','groups','u'].includes(k)){notice('This older room has no recorded starting preset. Duplicate it and edit it, or create a new room.','error');break;}if(!confirm('Reset '+r.name+' to its original '+({242:'2-4-2',it2:'IT2',it3:'IT3',pairs:'Paired desks',groups:'Grouped tables',u:'U shape'}[k])+' arrangement? Your edits to this room will be lost, but existing seating plan versions will remain unchanged. You can undo this.'))break;mutation(()=>{const preset=buildPreset(k,r.name);r.seats=preset.seats;r.teacher=preset.teacher;r.kind=preset.kind||'';r.preset=k;r.board=preset.board;selectedSeat='';});break;}
 case 'add-seat':mutation(()=>{const r=currentRoom();const s={id:uid(),label:String(r.seats.length+1),x:50,y:52,priority:'normal',group:'Custom',rotation:0};r.seats.push(s);selectedSeat=s.id;});break;
 case 'remove-seat':{const r=currentRoom();if(selectedSeat&&confirm('Remove this desk from the room template?'))mutation(()=>{r.seats=r.seats.filter(s=>s.id!==selectedSeat);selectedSeat='';});break;}
 case 'room-to-plan':{if(!classId){notice('Choose or import a class first.','error');break;}const r=currentRoom();mutation(()=>{const p=newPlan(classId,r,r.name+' plan');data.plans.push(p);planId=p.id;});goto('seating');break;}
 case 'start-homework':startHomeworkSession();break;
 case 'toggle-homework':toggleHomework(attrs.id);break;
 case 'cancel-homework':homeworkSession=null;render();notice('Homework marking cancelled; no records created.');break;
 case 'finish-homework':finishHomeworkSession();break;
 case 'go-seating':goto('seating');break;
 case 'go-records':goto('records');break;
 case 'go-overview':goto('overview');break;
 case 'privacy-lock':privacyLocked=true;if(projectorWindow&&!projectorWindow.closed){projectorWindow.close();projectorWindow=null;}render();break;
 case 'timer-preset':case 'timer-set':case 'timer-start':case 'timer-pause':case 'timer-reset':case 'timer-fullscreen':timerAction(id,attrs.value);break;
 case 'new-homework':recordModal('homework');break;case 'new-behaviour':recordModal('behaviour');break;
 case 'edit-categories':categoriesModal();break;
 case 'edit-record':recordModal('',attrs.id);break;
 case 'pick-student':{const all=currentStudents().filter(s=>!pickerExclude||!absent.has(s.id)),asked=data.questioned[classId]||[];const left=all.filter(s=>!asked.includes(s.id)&&s.id!==lastPicked);const pool=left.length?left:all.filter(s=>!asked.includes(s.id));if(!pool.length){notice('Every available pupil has been questioned. Reset the lesson.');break;}const next=pool[Math.floor(Math.random()*pool.length)];lastPicked=next.id;lastPickerState='picked';render();renderProjector();break;}
 case 'reset-picker':case 'reset-lesson':mutation(()=>{data.questioned[classId]=[];});absent.clear();lastPicked='';lastPickerState='';render();renderProjector();break;
 case 'mark-questioned':markPicked('asked');break;
 case 'mark-absent-picked':markPicked('absent');break;
 case 'print-teacher':printMode='teacher';document.body.classList.remove('print-pupil');document.body.classList.add('print-teacher');window.print();break;
 case 'print-pupil':printMode='pupil';document.body.classList.remove('print-teacher');document.body.classList.add('print-pupil');window.print();break;
 case 'print-groups':printGroups();break;
 case 'download-backup':backupModal();break;
 case 'restore-backup':$('#backupFile').click();break;
 case 'verify-backup':$('#verifyBackupFile').click();break;
 case 'export-rooms':download(JSON.stringify({format:'SEATING-EMPTY-ROOMS',version:1,rooms:data.rooms},null,2),'room-layouts.json','application/json');notice('Room templates exported without student information.','success');break;
 case 'clear-session':{if(confirm('Clear all pupils, OPPs, notes, records and plans from memory? Export a backup first if needed.')){homeworkSession=null;if(projectorWindow&&!projectorWindow.closed)projectorWindow.close();projectorWindow=null;data=initial();history=[];future=[];dirty=false;classId='';planId='';roomId=data.rooms[0].id;selectedStudent='';selectedSeat='';absent.clear();goto('dashboard');notice('Session cleared.','success');}break;}
 } }catch(e){console.error(e);notice(e.message,'error');}}
function compareVersions(){const p=currentPlan(),others=data.plans.filter(x=>x.classId===classId&&x.id!==planId);if(!p||!others.length){notice('Create a second version to compare.');return;}openModal('Compare seating plan versions',`<p class="muted">Compare against the current version: <strong>${esc(p.name)}</strong>.</p><label>Other version${choose('other',others.map(x=>({value:x.id,label:x.name})))}</label>`,fd=>{const other=data.plans.find(x=>x.id===fd.get('other'));const reverse=x=>Object.fromEntries(Object.entries(x.assignments).map(([seat,id])=>[id,x.layout.seats.find(s=>s.id===seat)?.label||'Unknown seat']));const a=reverse(p),b=reverse(other);const moved=currentStudents().filter(s=>a[s.id]!==b[s.id]);queueMicrotask(()=>openModal('Version comparison',`<p>${esc(p.name)} compared with ${esc(other.name)}: <strong>${moved.length} pupils moved or unseated</strong>.</p><div class="list-scroll">${moved.map(s=>`<div class="list-card"><strong>${esc(s.name)}</strong><small>${esc(b[s.id]||'Unseated')} → ${esc(a[s.id]||'Unseated')}</small></div>`).join('')||'<p>No changes.</p>'}</div>`,()=>{} ,'Close'));});}
function startHomeworkSession(){
 if(!classId||!currentPlan()){notice('Open or create a seating plan for this class first.','error');return;}
 openModal('Mark whole-class homework',`<p class="muted">Choose the task, then tap pupils on the seating plan or class list to record missing work in one go.</p><label>Homework task<input name="assignment" required maxlength="200" placeholder="e.g. Unit 3 revision"></label><label>Date due<input type="date" name="dueDate" value="${esc(isoDate())}" required></label>`,fd=>{
  const assignment=clean(fd.get('assignment')),dueDate=clean(fd.get('dueDate'));
  if(!assignment||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))throw new Error('Enter a homework task and valid due date.');
  homeworkSession={classId,assignment,dueDate,missing:[]};selectedStudent='';selectedSeat='';goto('seating');
 },'Start marking');
}
function toggleHomework(id){
 if(!homeworkSession||homeworkSession.classId!==classId||!currentStudents().some(s=>s.id===id))return;
 homeworkSession.missing=homeworkSession.missing.includes(id)?homeworkSession.missing.filter(x=>x!==id):[...homeworkSession.missing,id];
 render();
}
function finishHomeworkSession(){
 const session=homeworkSession;if(!session||session.classId!==classId)return;
 const selected=session.missing.map(id=>student(id)).filter(s=>s?.active!==false&&s.classId===classId);
 openModal('Confirm missing homework',`<p><strong>${esc(session.assignment)}</strong> · Due ${esc(fmtDate(session.dueDate))}</p><p>${selected.length} pupil(s) marked as missing:</p><div class="list-scroll" style="max-height:240px">${selected.map(s=>`<div class="list-card"><strong>${esc(s.name)}</strong></div>`).join('')||'<p class="muted">No pupils selected.</p>'}</div><p class="muted tiny">This creates or updates one local missing homework record per selected pupil. Existing records for the same task and due date will not be duplicated. Pupils not selected will not receive a new record.</p>`,()=>{
  let added=0,updated=0;mutation(()=>{
   for(const s of selected){
    const existing=data.records.find(r=>r.classId===classId&&r.studentId===s.id&&r.type==='homework'&&clean(r.assignment).toLowerCase()===session.assignment.toLowerCase()&&r.dueDate===session.dueDate);
    if(existing){existing.status='Missing';existing.category='Homework not submitted';existing.date=isoDate();updated++;}
    else{data.records.push({id:uid(),classId,type:'homework',studentId:s.id,date:isoDate(),dueDate:session.dueDate,assignment:session.assignment,category:'Homework not submitted',status:'Missing',notes:''});added++;}
   }
  });homeworkSession=null;render();
  notice(`Homework recorded: ${added} new, ${updated} updated. Undo remains available.`,'success');
 },'Save missing records');
}
// Separate name-only window. NO Edulink fields, OPP text, confidential flags,
// grade colours, student IDs, photos or application state are copied into this DOM.
function renderProjector(){
 if(!projectorWindow||projectorWindow.closed)return;
 const p=currentPlan(),list=currentStudents(),names=new Map(list.map(s=>[s.id,s.name]));
 const drawing=p?`<div class="room">${p.layout.kind==='it3'?'<div class="island"></div>':p.layout.kind==='it2'?'<div class="island narrow"></div>':''}<div class="board" style="${p.layout.board==='back'?'bottom:0':'top:0'}">WHITEBOARD</div>${p.layout.seats.map(seat=>{
  const id=p.assignments[seat.id],name=id?names.get(id):'';
  return `<div class="place ${id&&id===lastPicked?'picked':''}" style="left:${Number(seat.x)}%;top:${Number(seat.y)}%">${esc(name||'Empty')}</div>`;
 }).join('')}</div>`:'<p>No seating plan selected.</p>';
 const who=lastPicked&&names.get(lastPicked)?names.get(lastPicked):'Ready to pick';
 const html=`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Classroom projector</title><style>
 body{margin:0;background:#101b2b;color:#fff;font:19px system-ui,sans-serif;padding:22px}
 h1{font-size:27px;margin:0 0 10px}.heading{display:flex;justify-content:space-between;align-items:center;gap:15px}
 .picked-name{background:#285a9e;padding:12px 24px;border-radius:10px;font-weight:800}
 .room{position:relative;background:#fafcfe;border:2px solid #a6b5c7;border-radius:16px;color:#162b40;height:min(72vh,680px);margin-top:20px;overflow:hidden}
 .board{position:absolute;background:#264866;color:white;left:37%;width:26%;height:25px;text-align:center;font-size:12px;padding:4px}
 .island{position:absolute;left:21%;top:43%;width:60%;height:19%;background:#c9d7e7;border-radius:10px}
 .island.narrow{left:43%;top:23%;width:21%;height:60%}
 .place{position:absolute;transform:translate(-50%,-50%);width:8.6%;min-height:23px;padding:8px 1px;display:grid;place-items:center;overflow-wrap:anywhere;text-align:center;border:1px solid #9aabba;border-radius:7px;background:white;font-size:clamp(9px,1.1vw,15px);font-weight:600}
 .place.picked{border:4px solid #e69a29;background:#fff2d8;color:#562e04;box-shadow:0 0 0 6px #ffd982}
 @media(max-width:850px){.place{font-size:9px;padding:3px 0}}
 </style></head><body><div class="heading"><h1>${esc(currentClass()?.name||'Class')} · ${esc(p?.name||'Seating')}</h1><div class="picked-name">${esc(who)}</div></div>${drawing}</body></html>`;
 try{projectorWindow.document.open();projectorWindow.document.write(html);projectorWindow.document.close();}catch(e){projectorWindow=null;notice('Unable to update projector window. Open projector view again.','error');}
}
function openProjector(fullscreen=false){
 try{
  if(!projectorWindow||projectorWindow.closed)projectorWindow=window.open('about:blank','seatingplans_projector','width=1280,height=900');
  if(!projectorWindow){notice('Your browser blocked the projector window. Allow pop-ups for this site.','error');return;}
  renderProjector();projectorWindow.focus();
  if(fullscreen)projectorWindow.document.documentElement.requestFullscreen?.().catch(()=>notice('Fullscreen was blocked. The name-only projector window is still open.'));
 }catch(e){notice('Could not open projector view: '+e.message,'error');}
}
function planNotesModal(){
 const p=currentPlan();if(!p)return;
 openModal('Seating plan notes',`<p class="muted tiny">Record why this arrangement was chosen, what worked and what to review next time. Notes are private to this plan version and are included only in encrypted exports.</p><label>Teacher notes<textarea rows="7" name="notes" maxlength="4000" placeholder="Seating rationale, changes to review, classroom observations...">${esc(p.notes||'')}</textarea></label>`,
  fd=>mutation(()=>{p.notes=clean(fd.get('notes')).slice(0,4000);}), 'Save notes');
}
function reviewOppSeatingHint(pupilId,hintIndex){
 const p=currentPlan(),s=student(pupilId);
 const hint=s&&oppSeatingHints(s.opp)[hintIndex];
 if(!p||!s||s.classId!==classId||!hint)return;
 openModal('Confirm a pupil-specific seating rule',`<div class="notice"><strong>${esc(s.name)} · Original OPP wording</strong><p>${esc(hint.text)}</p></div><p class="muted tiny">Please interpret the individual guidance yourself. The application will not automatically decide whether the pupil needs a front, accessible or preferred seat.</p><label>Teacher-confirmed rule${choose('mode',[{value:'front',label:'Prefer front (nearest whiteboard)'},{value:'access',label:'Easy teacher access (green seats)'},{value:'preferred',label:'Preferred or accessible seats'}])}</label><label class="check"><input name="strict" type="checkbox"> Make this mandatory rather than a preference</label>`,fd=>{
  const mode=fd.get('mode');
  if(!['front','access','preferred'].includes(mode))throw new Error('Choose a valid seating rule.');
  mutation(()=>{p.rules.push({id:uid(),type:'priority',a:s.id,b:'',mode,strict:fd.has('strict'),source:'Teacher-confirmed OPP',guidance:hint.text});});
  notice('Teacher-confirmed seating rule added. You can inspect it in Seating rules.','success');
 },'Add confirmed rule');
}
function oppSeatingPromptsModal(){
 const p=currentPlan();if(!p)return;
 const entries=currentStudents().flatMap(s=>oppSeatingHints(s.opp).map((hint,index)=>({s,hint,index})));
 const rows=entries.map(({s,hint,index})=>`<div class="list-card" style="align-items:flex-start;gap:10px"><div style="flex:1"><strong>${esc(s.name)}</strong><small>${esc(hint.text)}</small></div><button type="button" class="btn btn-small" data-opp-hint="${index}" data-opp-pupil="${esc(s.id)}">Review rule</button></div>`).join('');
 openModal('Review OPP seating guidance',`<p class="muted tiny">These are exact excerpts from locally imported OPPs. They may include phrases that are not actual seating requirements. Review the full profile and confirm any rule yourself.</p><div class="list-scroll" style="max-height:430px">${rows||'<p class="muted">No likely seating guidance found in the imported OPPs for this class.</p>'}</div>`,()=>{},'Close');
 $('#modalRoot').querySelectorAll('[data-opp-hint]').forEach(el=>el.addEventListener('click',()=>{
  reviewOppSeatingHint(el.dataset.oppPupil,Number(el.dataset.oppHint));
 }));
}
function generateSeatsModal(){
 const p=currentPlan();if(!p)return;
 const options={keepApart:true,keepLocked:true,mixed:false,front:true,...(p.generationOptions||{}),send:!!p.accessPreference?.send,pp:!!p.accessPreference?.pp};
 const check=(name,label,explanation)=>`<label class="check"><input type="checkbox" name="${name}" ${options[name]?'checked':''}><span><strong>${esc(label)}</strong><small style="display:block;color:var(--sub);font-weight:400">${esc(explanation)}</small></span></label>`;
 const content=`<p class="muted tiny">Configure the local generator for this plan version. A preview will show rule conflicts, accessible-seat shortages and pupils not accommodated before you apply changes.</p>
 ${check('send','Prioritise SEND pupils for accessible seats','Teacher-selected preference; pupils in both SEND and PP are counted once')}
 ${check('pp','Prioritise PP pupils for accessible seats','Teacher-selected preference, not an assumed individual requirement')}
 ${check('keepApart','Respect specified pupil separation rules','Existing separation restrictions remain in the saved rule list')}
 ${check('keepLocked','Preserve locked seats','Turning this off may move locked pupils and unlock their seats if applied')}
 ${check('mixed','Balance prior attainment','Aim to distribute high and low prior attainment across table groups')}
 ${check('front','Apply front-row rules for selected pupils','Only pupils with teacher-defined front-seat rules are affected')}
 `;
 openModal('Configure seating generation',content,fd=>{
  const settings=Object.fromEntries(['send','pp','keepApart','keepLocked','mixed','front'].map(key=>[key,fd.has(key)]));
  const pupils=currentStudents(),proposal=autoSeat(p,pupils,settings);
  const audit=auditRules(p,pupils,proposal.assignments),report=proposal.access;
  const conflicts=[...audit.required,...audit.advisory];
  const lines=conflicts.map(r=>`<li><strong>${esc(r.names.join(' and '))}:</strong> ${esc(r.description)} (${r.required?'required':'preference'})</li>`).join('');
  const missing=report.enabled&&report.unmet.length?`<p><strong>${report.unmet.length} eligible pupil(s) are outside accessible seats:</strong> ${report.unmet.map(s=>esc(s.name)).join(', ')}.</p>`:'';
  const preview=`<div class="${audit.required.length?'alert':'notice'}"><strong>${audit.required.length} required conflicts; ${audit.advisory.length} advisory preferences unmet; ${audit.met.length} rules satisfied.</strong><p>${pupils.length} pupils will be assigned to ${p.layout.seats.length} seats.</p></div>
   ${conflicts.length?`<h3>Rules to review</h3><div class="list-scroll" style="max-height:230px"><ul>${lines}</ul></div>`:'<p>All assessed rules can be satisfied by this proposal.</p>'}
   ${audit.pending.length?`<p class="muted tiny">${audit.pending.length} rule(s) are pending because one or more pupils are unseated.</p>`:''}
   ${report.enabled?`<div class="notice"><strong>Accessible seating:</strong> ${report.eligible} eligible, ${report.capacity} seats, ${report.assigned} assigned in accessible positions.${report.shortfall?`<p>At least ${report.shortfall} cannot fit with these constraints.</p>`:''}${missing}</div>`:''}
   ${!settings.keepLocked&&p.locks.length?`<div class="alert">You have opted to unlock ${p.locks.length} fixed seat(s) when applying this plan.</div>`:''}
   <p class="muted tiny">Your current plan is untouched until you click Apply. Any changes can be undone afterwards. The generator runs entirely on this device.</p>`;
  queueMicrotask(()=>openModal('Review proposed seating plan',preview,()=>{
   mutation(()=>{
    p.generationOptions={keepApart:settings.keepApart,keepLocked:settings.keepLocked,mixed:settings.mixed,front:settings.front};
    p.accessPreference={send:settings.send,pp:settings.pp};
    p.previousAssignments=clone(p.assignments);p.assignments=proposal.assignments;
    if(!settings.keepLocked)p.locks=[];
   });
   notice(audit.required.length?'Plan applied with confirmed required conflicts. Review the rule warnings.':report.unmet.length?'Plan applied. Review accessible-seat shortfalls.':'Seating plan applied; rules checked.',audit.required.length||report.unmet.length?'error':'success');
  },audit.required.length?'Apply despite conflicts':'Apply seating plan'));
 },'Preview seating plan');
}
function groupAccessPreferenceModal(){
 const p=currentPlan();if(!p)return;
 const report=accessReport(p,currentStudents()),prefs=p.accessPreference||{};
 const body=`<p class="muted">Prioritise accessible seats for selected pupils when generating this seating plan. This is an optional teacher choice, not an assumed individual SEND or PP requirement.</p>
 <label class="check"><input type="checkbox" name="send" ${prefs.send?'checked':''}> Prefer accessible seats for pupils marked SEND</label>
 <label class="check"><input type="checkbox" name="pp" ${prefs.pp?'checked':''}> Prefer accessible seats for pupils marked Pupil Premium (PP)</label>
 <div class="notice"><strong>${report.capacity} accessible seat(s) available in this room.</strong><p class="muted tiny">Select one or both options, then save. Pupils who appear in both categories are counted once. Existing pupil-specific mandatory rules and locked seats still take priority. The result will show any shortage and pupils not accommodated.</p></div>`;
 openModal('SEND / PP accessible seating',body,fd=>{
  mutation(()=>{p.accessPreference={send:fd.has('send'),pp:fd.has('pp')};});
  const next=accessReport(p,currentStudents());
  if(next.enabled&&next.shortfall)notice(`Accessible seat shortfall: ${next.eligible} eligible pupils for ${next.capacity} accessible seats. At least ${next.shortfall} cannot be accommodated.`,'error');
 },'Save preferences');
}
function rulesModal(){const p=currentPlan();if(!p)return;const rows=(p.rules||[]).map((r,i)=>`<div class="list-card"><div><strong>${esc({apart:'Keep apart',together:'Prefer together',priority:'Priority seat'}[r.type])}</strong><small>${esc(student(r.a)?.name||'Unknown')}${r.b?' / '+esc(student(r.b)?.name||'Unknown'):''} · ${esc(r.mode||'')}</small></div><button type="button" class="btn btn-small" data-remove-rule="${i}">Remove</button></div>`).join('');const candidates=currentStudents().map(s=>({value:s.id,label:s.name}));openModal('Seating rules',`<p class="muted tiny">Mandatory separation rules and required seat priorities are checked by the generator. Preferred pairings are advisory.</p><div class="list-scroll" id="rulesList">${rows||'<p class="muted tiny">No rules added.</p>'}</div><hr class="divider"><label>Rule type${choose('type',[{value:'apart',label:'Keep two pupils apart'},{value:'together',label:'Prefer together'},{value:'priority',label:'Pupil seating priority'}])}</label><div class="field-grid"><label>Pupil${choose('a',candidates,selectedStudent)}</label><label>Other pupil (pair rules)${choose('b',[{value:'',label:'None'},...candidates])}</label></div><label>Seat rule${choose('mode',[{value:'distance',label:'Keep apart: minimum distance'},{value:'group',label:'Keep apart: different table groups'},{value:'front',label:'Prefer front rows'},{value:'access',label:'Easy teacher access'},{value:'preferred',label:'Preferred accessible seats'}])}</label><label>Minimum distance (if selected)<input type="number" name="distance" min="10" max="90" value="20"></label><label class="check"><input type="checkbox" name="strict" checked> Required priority (rather than preference)</label>`,fd=>{const type=fd.get('type'),a=fd.get('a'),b=fd.get('b'),mode=fd.get('mode');if(type!=='priority'&&(!b||a===b))throw new Error('Choose two different pupils for pair rules.');if(type==='priority'&&!['front','access','preferred'].includes(mode))throw new Error('Select a front, easy access or preferred seat option.');if(type==='apart'&&!['distance','group'].includes(mode))throw new Error('Select minimum distance or different table groups.');mutation(()=>{p.rules.push({id:uid(),type,a,b:type==='priority'?'':b,mode: type==='together'?'near':mode,distance:Number(fd.get('distance'))||20,strict:fd.has('strict')});});},'Add rule');$('#rulesList').addEventListener('click',e=>{const b=e.target.closest('[data-remove-rule]');if(!b)return;const i=Number(b.dataset.removeRule);mutation(()=>p.rules.splice(i,1));closeModal();rulesModal();});}

function categoriesModal(){
 const categories=data.categories||[];
 const content='<p class="muted tiny">Add a category or remove an unused one. Existing behaviour records retain their original category text.</p>'+
 '<label>Add behaviour type<input name="newCategory" maxlength="90" placeholder="e.g. Talking over others"></label>'+
 '<label>Remove a category'+choose('removeCategory',[{value:'',label:'Do not remove'},...categories.map(x=>({value:x,label:x}))])+'</label>'+
 '<p class="tiny muted">Categories that are already used in records may be removed from the entry menu without deleting those records.</p>';
 openModal('Edit behaviour categories',content,fd=>{
  const add=clean(fd.get('newCategory')),remove=clean(fd.get('removeCategory'));
  if(!add&&!remove)throw new Error('Enter a new category or select one to remove.');
  if(add&&categories.some(x=>x.toLowerCase()===add.toLowerCase()))throw new Error('This category already exists.');
  mutation(()=>{
   if(remove)data.categories=data.categories.filter(x=>x!==remove);
   if(add)data.categories.push(add);
  });
  notice('Behaviour category list updated locally.','success');
 },'Save categories');
}
function recordModal(type='homework',editId=''){const old=data.records.find(x=>x.id===editId);if(old)type=old.type;if(!classId||!currentStudents().length){notice('Import a class first.','error');return;}const s=currentStudents().map(x=>({value:x.id,label:x.name}));openModal(old?'Edit teacher record':type==='homework'?'Add homework record':'Add behaviour record',`<div class="field-grid"><label>Pupil${choose('studentId',s,old?.studentId||selectedStudent)}</label>${field('date','Date',old?.date||isoDate(),'date')}</div><label>Category${choose('category',type==='homework'?[{value:'Homework not submitted',label:'Homework not submitted'},{value:'Homework late',label:'Homework late'},{value:'Homework incomplete',label:'Homework incomplete'},{value:'Other',label:'Other'}]:data.categories,old?.category||'')}</label>${type==='homework'?`<label>Homework task<input name="assignment" value="${esc(old?.assignment||'')}" maxlength="200" placeholder="e.g. Unit 2 revision"></label><label>Status${choose('status',['Missing','Late','Resolved'],old?.status||'Missing')}</label>`:''}<label>Notes<textarea name="notes" rows="3" maxlength="3000">${esc(old?.notes||'')}</textarea></label>${old?'<label class="check"><input type="checkbox" name="delete"> Delete this record</label>':''}`,fd=>{const pupil=fd.get('studentId');if(!currentStudents().some(s=>s.id===pupil))throw new Error('Pupil not in this class.');mutation(()=>{if(old&&fd.has('delete'))data.records=data.records.filter(r=>r.id!==old.id);else{const item=old||{id:uid(),classId,type};Object.assign(item,{studentId:pupil,date:fd.get('date'),category:fd.get('category'),status:type==='homework'?fd.get('status'):'Recorded',assignment:clean(fd.get('assignment')),notes:clean(fd.get('notes'))});if(!old)data.records.push(item);}});},old?'Save changes':'Add record');}
function download(content,name,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function backupModal(){if(!crypto.subtle){notice('Encrypted backups require a secure (HTTPS) browser context.','error');return;}openModal('Create encrypted backup',`<div class="callout privacy">Creates one encrypted file containing all your session data, including private OPP details. Choose a strong, unique password.</div>${field('password','Backup password (12+ characters)','','password')}${field('confirm','Repeat password','','password')}`,async fd=>{const pass=String(fd.get('password'));if(pass.length<12||pass!==fd.get('confirm'))throw new Error('Passwords must match and be at least 12 characters.');const encrypted=await encryptBackup(data,pass);download(encrypted,`seating-plans-${isoDate()}.seatingplan`,'application/octet-stream');render();notice('Encrypted download requested. Verify the saved file before closing this session.','success');});}
async function importCSV(files){
 if(!files.length)return;
 const incoming=[];
 for(const file of files){
  if(file.size>10*1024*1024)throw new Error('CSV larger than 10 MB.');
  const pack=readEdulink(await file.text());
  incoming.push(...pack.students);
 }
 if(!incoming.length)throw new Error('No pupils found in these files.');
 reviewEdulinkImport(incoming);
}
function reviewEdulinkImport(incoming){
 const preview=buildEdulinkReview(data.classes,data.students,incoming),items=preview.items;
 const counts={matched:items.filter(x=>x.status==='matched').length,new:items.filter(x=>x.status==='new').length,review:items.filter(x=>['duplicate','ambiguous'].includes(x.status)).length};
 const rows=items.map(item=>{
  const existing=data.classes.find(c=>c.id===item.classId);
  const options=[{value:'new',label:'Add as new pupil'},{value:'skip',label:'Skip this row'},...data.students.filter(s=>s.classId===existing?.id).sort((a,b)=>a.name.localeCompare(b.name,'en-GB')).map(s=>({value:'match:'+s.id,label:'Match to '+s.name+(s.active===false?' (inactive)':'')}))];
  const value=item.status==='duplicate'||item.status==='ambiguous'?'skip':item.suggestedId?'match:'+item.suggestedId:'new';
  const kind={matched:'Matched',new:'New pupil',ambiguous:'Needs review',duplicate:'Duplicate in export'}[item.status];
  return `<div class="list-card" style="align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:160px"><strong>${esc(item.incoming.name)}</strong><small>${esc(item.group)}${item.incoming.reg?' · '+esc(item.incoming.reg):''} · ${esc(kind)}</small></div><label style="min-width:200px;flex:1">Import action${choose('map_'+item.index,options,value)}</label></div>`;
 }).join('');
 const absent=preview.notInExport.map(s=>`<label class="check" style="display:block;margin:8px 0"><input type="checkbox" name="retire_${esc(s.id)}"> Mark <strong>${esc(s.name)}</strong> inactive (${esc(data.classes.find(c=>c.id===s.classId)?.name||'Class')})</label>`).join('');
 openModal('Review Edulink marksheet changes',`<div class="notice"><strong>${items.length} incoming pupils:</strong> ${counts.matched} suggested matches, ${counts.new} new, ${counts.review} requiring review. These are suggestions only; nothing has been changed.</div><p class="muted tiny">Check name changes and duplicates. Choose an existing pupil to retain their seating history, OPP and homework records. The import must be reviewed and confirmed locally.</p><div class="list-scroll" style="max-height:360px">${rows}</div><hr class="divider"><h3>Not found in this export (${preview.notInExport.length})</h3><p class="muted tiny">These pupils remain active by default. Only tick a pupil if you have confirmed they have left this teaching group. If this export is incomplete, do not mark anyone inactive.</p><div class="list-scroll" style="max-height:150px">${absent||'<p class="muted tiny">All known active pupils were matched, or this is a new class.</p>'}</div>`,fd=>{
  const choices=items.map(item=>({item,decision:String(fd.get('map_'+item.index)||'skip')}));
  const used=new Set(),newNames=new Set();
  for(const {item,decision} of choices){
   if(decision==='skip')continue;
   if(decision==='new'){
    const key=item.group.toLowerCase()+'|'+nameKey(item.incoming.name);
    if(newNames.has(key))throw new Error('Duplicate new pupil: '+item.incoming.name+'. Skip or match one of the duplicate rows.');
    newNames.add(key);
   }else if(decision.startsWith('match:')){
    const id=decision.slice(6),existing=data.students.find(s=>s.id===id);
    if(!existing||!data.classes.some(c=>c.id===existing.classId&&c.name.toLowerCase()===item.group.toLowerCase()))throw new Error('Pupil mapping is not valid for '+item.group+'.');
    if(used.has(id))throw new Error('One existing pupil has been selected for more than one CSV row. Review the mappings.');
    used.add(id);
   }else throw new Error('Invalid import option.');
  }
  for(const {item,decision} of choices.filter(x=>x.decision==='new')){
   const exists=data.students.some(s=>data.classes.some(c=>c.id===s.classId&&c.name.toLowerCase()===item.group.toLowerCase())&&nameKey(s.name)===nameKey(item.incoming.name));
   if(exists)throw new Error(item.incoming.name+' already exists in this class. Select Match existing, not Add as new.');
  }
  let added=0,updated=0,retired=0;
  mutation(()=>{
   for(const {item,decision} of choices){
    if(decision==='skip')continue;
    let cls=data.classes.find(c=>c.name.toLowerCase()===item.group.toLowerCase());
    if(!cls){cls={id:uid(),name:item.group};data.classes.push(cls);}
    const options=Object.keys(item.incoming.gradeColumns||{});
    cls.assessmentHeaders=[...new Set([...(cls.assessmentHeaders||[]),...options])].slice(0,45);
    if(!cls.selectedAssessment&&cls.assessmentHeaders.length)cls.selectedAssessment=cls.assessmentHeaders[0];
    const imported={...item.incoming,current:cls.selectedAssessment?item.incoming.gradeColumns?.[cls.selectedAssessment]||item.incoming.current:item.incoming.current};
    if(decision==='new'){data.students.push({...imported,id:uid(),classId:cls.id,active:true,opp:null,notes:'',strategies:'',pupilVoice:'',reviewedDate:''});added++;}
    else{
     const old=data.students.find(s=>s.id===decision.slice(6));
     Object.assign(old,imported,{id:old.id,classId:cls.id,active:true,externalId:item.incoming.externalId||old.externalId||'',opp:old.opp,notes:old.notes,strategies:old.strategies||'',pupilVoice:old.pupilVoice||'',reviewedDate:old.reviewedDate||''});
     updated++;
    }
    if(!classId)classId=cls.id;
   }
   for(const s of preview.notInExport){
    if(fd.has('retire_'+s.id)&&!used.has(s.id)){const pupil=data.students.find(x=>x.id===s.id);if(pupil){pupil.active=false;retired++;}}
   }
  });
  importSummary=`Edulink reviewed: ${added} added, ${updated} refreshed, ${retired} marked inactive. Existing seating and records retained.`;
  notice(importSummary,'success');
 },'Confirm reviewed import');
}
async function importOPPs(files){
 if(!files.length)return;
 if(!data.students.length){notice('Import an Edulink class list before importing OPPs.','error');return;}
 notice('Reading Word documents locally…');
 const entries=await readOppFiles(files);
 let matched=0,unmatched=0,errors=[];
 mutation(()=>{
  for(const entry of entries){
   if(entry.error){errors.push(`${entry.filename}: ${entry.error}`);continue;}
   const key=nameKey(entry.opp.name),candidates=data.students.filter(s=>nameKey(s.name)===key);
   if(candidates.length===1){candidates[0].opp=entry.opp;matched++;}
   else{data.pendingOPPs.push({id:uid(),filename:entry.filename,opp:entry.opp});unmatched++;}
  }
 });
 oppSummary=`Matched ${matched} OPP(s), ${unmatched} need teacher matching, ${errors.length} failed.`;
 notice(oppSummary,errors.length?'error':'success');
 if(unmatched||errors.length){
  openModal('OPP import review',`<p>${esc(oppSummary)}</p><p class="muted tiny">No uncertain OPP was attached to a pupil. Use <strong>Review OPP matches</strong> to link documents after checking their identities.</p><div class="list-scroll">${errors.map(x=>`<p class="alert">${esc(x)}</p>`).join('')}</div>`,()=>{},'Close');
 }
}
function reviewPendingOPPs(){
 if(!data.pendingOPPs?.length){notice('There are no unmatched OPPs.');return;}
 const pending=data.pendingOPPs[0],matches=data.students.filter(s=>nameKey(s.name)===nameKey(pending.opp.name));
 const pupils=data.students.slice().sort((a,b)=>a.name.localeCompare(b.name,'en-GB'));
 openModal('Match OPP to a pupil',`<p><strong>Document:</strong> ${esc(pending.filename)}</p><p><strong>Detected name:</strong> ${esc(pending.opp.name)}</p><div class="alert">${data.pendingOPPs.length} unmatched document(s). Check the pupil identity carefully. No match is applied automatically when names are ambiguous.</div><label>Choose correct pupil${choose('studentId',[{value:'',label:'Select pupil after checking identity'},...pupils.map(x=>({value:x.id,label:x.name+' · '+(data.classes.find(c=>c.id===x.classId)?.name||'Class')}))],matches.length===1?matches[0].id:'')}</label><label class="check"><input type="checkbox" name="applyAll"> Apply to all class entries with exactly the same pupil name (only if confirmed to be the same pupil)</label>`,fd=>{
  const id=fd.get('studentId'),selected=data.students.find(s=>s.id===id);
  if(!selected)throw new Error('Choose the correct pupil first.');
  mutation(()=>{
   const targets=fd.has('applyAll')?data.students.filter(s=>nameKey(s.name)===nameKey(selected.name)):[selected];
   for(const student of targets)student.opp=clone(pending.opp);
   data.pendingOPPs=data.pendingOPPs.filter(x=>x.id!==pending.id);
  });
  notice('OPP matched after teacher confirmation.');
 },'Confirm match');
}
$('#csvFile').addEventListener('change',async e=>{try{await importCSV([...e.target.files]);}catch(err){notice(err.message,'error');}finally{e.target.value='';}});
$('#oppFiles').addEventListener('change',async e=>{try{await importOPPs([...e.target.files]);}catch(err){notice(err.message,'error');}finally{e.target.value='';}});
$('#backupFile').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  if(file.size>60*1024*1024)throw new Error('Backup exceeds 60 MB.');
  const content=await file.text();
  openModal('Restore encrypted backup',`<p class="muted">Enter the password for this encrypted file. Restoring will replace the current session.</p><label>Backup password<input type="password" name="password" required autocomplete="off"></label><div class="alert">Export a new backup first if you need to preserve unbacked changes.</div>`,async fd=>{
   const restored=validateBackup(await decryptBackup(content,String(fd.get('password'))));
   if(!confirm('Replace the current session? Changes not backed up will be discarded.'))return;
   homeworkSession=null;if(projectorWindow&&!projectorWindow.closed)projectorWindow.close();projectorWindow=null;data=restored;history=[];future=[];dirty=false;classId=data.classes[0]?.id||'';roomId=data.rooms[0]?.id||'';planId=data.plans.find(p=>p.classId===classId)?.id||'';selectedStudent='';selectedSeat='';absent.clear();render();notice('Encrypted session restored locally.','success');
  },'Decrypt and restore');
 }catch(err){notice(err.message,'error');}
});
// Validates a user-selected encrypted file locally without replacing session data.
// A successful exact comparison confirms the file can restore the current work.
$('#verifyBackupFile').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  if(file.size>60*1024*1024)throw new Error('Backup exceeds 60 MB.');
  const ciphertext=await file.text();
  openModal('Verify downloaded backup',`<p class="muted">The file is decrypted and compared with this session entirely in your browser. It is never uploaded, and no stored data will be replaced.</p><label>Backup password<input type="password" name="password" required autocomplete="off"></label>`,async fd=>{
   const restored=validateBackup(await decryptBackup(ciphertext,String(fd.get('password'))));
   const exact=JSON.stringify(restored)===JSON.stringify(data);
   backupVerifyStatus=exact?
     'Verified: the file decrypts correctly and contains the exact current session. Store it in an approved secure location.':
     'Verified: the file decrypts correctly and is structurally valid, but it differs from this session. It may be an older backup.';
   if(exact)dirty=false;
   render();notice(backupVerifyStatus,exact?'success':'');
  },'Decrypt and verify');
 }catch(err){backupVerifyStatus='Verification failed: '+err.message;notice(backupVerifyStatus,'error');}
});
function printGroups(){if(!groupResult.length){notice('Generate groups first.');return;}const printWin=window.open('','_blank');if(!printWin){notice('Allow a new window to print groups.');return;}const safe=`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Groups</title><style>body{font:16px Arial;padding:28px}h2{margin-top:18px}.groups{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.group{border:1px solid #999;border-radius:8px;padding:12px}li{margin:6px}</style></head><body><h1>${esc(currentClass()?.name)} · Groups</h1><div class="groups">${groupResult.map((g,i)=>`<div class="group"><h2>Group ${i+1}</h2><ol>${g.map(s=>`<li>${esc(s.name)}</li>`).join('')}</ol></div>`).join('')}</div></body></html>`;printWin.document.write(safe);printWin.document.close();printWin.focus();printWin.print();}
// Local-only countdown. No network or browser persistence.
lessonTimerHandle=setInterval(timerTick,500);
// Development-only hook for automated checks. It is not wired to any network transport.
render();
