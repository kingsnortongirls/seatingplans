import { strict as assert } from 'node:assert';
import { readEdulink,buildEdulinkReview,gradeGap,gradeValue,assessmentGap,assessmentHistory,
  classQuality,isLateRecord,isBehaviourRecord,defaultRoom,buildPreset,addMissingSchoolRooms,newPlan,placeStudent,autoSeat,oppSeatingHints,auditRules } from '../js/core.js';

// Entirely synthetic. Never add actual school information to tests.
const csv=[
 'Learner,Class,Student ID,GCSE CS COTTA Sept,GCSE CS COTTA Nov,Target,More Able,Internal/External,PP,SEN Status',
 '"Example, Alex",9X/CS,T-100,5,6,7,Yes,External,Yes,K',
 'Example Other,9X/CS,T-101,7,7,7,No,Internal,No,N'
].join('\n');
const parsed=readEdulink(csv);
assert.deepEqual(parsed.assessmentHeaders,['GCSE CS COTTA Sept','GCSE CS COTTA Nov']);
assert.equal(parsed.students[0].name,'Alex Example');
assert.equal(parsed.students[0].externalId,'T-100');
assert.equal(parsed.students[0].more,'Yes');
assert.equal(parsed.students[0].internalExternal,'External');
assert.equal(parsed.students[0].gradeColumns['GCSE CS COTTA Nov'],'6');
assert.equal(gradeGap({current:'6',target:'7'}).gap,-1);
assert.equal(gradeGap({current:'B',target:'A'}).gap,-1);
assert.equal(gradeGap({current:'B',target:'7'}),null);
assert.equal(gradeValue('A*').rank,6);
assert.equal(assessmentGap('C','B'),-1);
assert.equal(assessmentGap('7','6'),1);
const records=[{studentId:'a',date:'2026-11-01',grade:'6',name:'Early'},
  {studentId:'a',date:'2026-11-20',grade:'7',name:'Latest'}];
assert.deepEqual(assessmentHistory(records,'a').map(r=>r.name),['Early','Latest']);
const klass={id:'class',name:'9X/CS',assessmentHeaders:parsed.assessmentHeaders,selectedAssessment:parsed.assessmentHeaders[0]};
const quality=classQuality([{...parsed.students[0],id:'a',classId:'class',active:true}], [klass],'class');
assert.equal(quality.emptySelected.length,0);
assert.equal(quality.total,1);

const olderGrades=classQuality([
 {id:'old1',name:'Example One',classId:'class',active:true,target:'7',current:'6',send:'',pp:''},
 {id:'old2',name:'Example Two',classId:'class',active:true,target:'7',current:'7',send:'N',pp:'No'}
], [klass], 'class');
assert.equal(olderGrades.emptySelected.length,0,'Older imports with current grades are complete');
assert.ok(!('missingSEND' in olderGrades),'Blank SEND is not an import error');
assert.ok(!('missingPP' in olderGrades),'Blank PP is not an import error');
const datedLateness={id:'L1',type:'late',category:'Late to lesson',date:'2026-11-23',studentId:'old1',minutesLate:5,lesson:'Period 3'};
const historicLateness={id:'L2',type:'behaviour',category:'Late to lesson',date:'2026-11-22',studentId:'old1'};
const otherBehaviour={id:'B1',type:'behaviour',category:'Disruption',date:'2026-11-21',studentId:'old2'};
assert.ok(isLateRecord(datedLateness));
assert.ok(isLateRecord(historicLateness));
assert.ok(!isBehaviourRecord(historicLateness),'Historical lateness must not double-count as other behaviour');
assert.ok(isBehaviourRecord(otherBehaviour));
assert.equal([datedLateness,historicLateness,otherBehaviour].filter(isLateRecord).length,2);

const proposal=buildEdulinkReview([klass],[{id:'x',classId:'class',name:'Changed Name',externalId:'T-100'}],parsed.students);
assert.equal(proposal.items[0].suggestedId,'x');
assert.equal(proposal.items[1].status,'new');
assert.equal(oppSeatingHints({adjustments:['Sit close to the teacher','Give worked examples']}).length,1);

const teachingOnly=oppSeatingHints({adaptations:[
 'Accessible reading materials: age-appropriate text, visuals and desk copies of board work.',
 'Chunking: step by step instructions and task boards.',
 'Adapted questioning strategies, positive reinforcement and praise.'
]});
assert.equal(teachingOnly.length,0,'General teaching guidance must not be offered as seating rules');
const frontSeating=oppSeatingHints({adaptations:[
 'Preferential seating at the front of the classroom and opportunities for movement during lessons.',
 'Seat at front. Give gentle reminders to stay focused.'
]});
assert.equal(frontSeating.length,1,'Repeated front preferences must be grouped');
assert.equal(frontSeating[0].mode,'front');
assert.equal(frontSeating[0].evidence.length,2);
const ownDesk=oppSeatingHints({about:['If possible, seat me on my own.']});
assert.equal(ownDesk[0].mode,'solo');
assert.equal(ownDesk[0].text,'If possible, seat me on my own');
const nearTeacher=oppSeatingHints({adjustments:['Please seat me close to the teacher.']});
assert.equal(nearTeacher[0].mode,'teacher');
const manualWindow=oppSeatingHints({adjustments:['Seat away from the window.']});
assert.ok(manualWindow[0].reviewOnly,'Unmapped physical locations need a manual review');
for(const negative of [
 'Do not sit at the front of the classroom.',
 'Prefer not to sit at the front of the classroom.'
])assert.equal(oppSeatingHints({about:[negative]}).length,0,'Negated guidance must not become an affirmative rule');

const room=buildPreset('it3','IT3');
assert.equal(room.seats.length,34);
assert.equal(room.seats.filter(s=>s.priority==='access').length,20);
assert.deepEqual(room.seats.filter(s=>s.priority==='avoid'||s.avoidIfPossible).map(s=>+s.label),[15,22,23,24,25,26,27,28]);
assert.deepEqual(buildPreset('it2').seats.filter(s=>s.priority==='access').map(s=>+s.label),[16,17,18,19,20,21,22,23,24,25,30,31,32,33]);
assert.equal(buildPreset('it2','IT2').seats.length,33);
// Screenshots supply room geometry only. Never copy real pupil names or images.
const it1=buildPreset('it1');
assert.equal(it1.name,'IT1');
assert.equal(it1.seats.length,33,'IT1 has 33 usable computer positions');
assert.equal(it1.board,'back','IT1 whiteboard is along the bottom edge');
assert.equal(it1.seats.filter(s=>s.group==='IT1-Left').length,10);
assert.equal(it1.seats.filter(s=>s.group==='IT1-Right').length,8);
assert.equal(it1.seats.filter(s=>s.group.startsWith('IT1-Middle')).length,12);
assert.equal(it1.seats.filter(s=>s.group==='IT1-Upper-Right').length,3);
const rm29=buildPreset('rm29');
assert.equal(rm29.name,'RM29');
assert.equal(rm29.seats.length,29,'RM29 has 29 desk positions');
assert.equal(rm29.seats.filter(s=>s.group==='RM29-Left').length,6);
assert.equal(rm29.seats.filter(s=>s.group==='RM29-Right').length,5);
assert.equal(rm29.seats.filter(s=>s.group.startsWith('RM29-Pair-')).length,18);
assert.equal(new Set(rm29.seats.filter(s=>s.group.startsWith('RM29-Pair-')).map(s=>s.group)).size,9);
for(const schoolRoom of [it1,rm29]){
 assert.deepEqual(schoolRoom.seats.filter(s=>s.priority==='access').map(s=>+s.label),schoolRoom===it1?[19,20,21,22,23,24,25,26,27,28,29,30]:[]);
 assert.deepEqual(schoolRoom.seats.filter(s=>s.priority==='avoid').map(s=>+s.label),schoolRoom===it1?[31,32]:[]);
 assert.equal(new Set(schoolRoom.seats.map(s=>s.id)).size,schoolRoom.seats.length);
 assert.equal(new Set(schoolRoom.seats.map(s=>s.label)).size,schoolRoom.seats.length);
 assert.ok(schoolRoom.seats.every(s=>s.x>=5&&s.x<=95&&s.y>=8&&s.y<=91));
 assert.equal(newPlan('example',schoolRoom,'Synthetic plan').layout.seats.length,schoolRoom.seats.length);
 const demo=Array.from({length:12},(_,i)=>({id:'sample'+i,name:'Synthetic '+i,send:'N',pp:'No'}));
 const proposal=autoSeat(newPlan('class',schoolRoom,'Plan'),demo);
 assert.equal(Object.keys(proposal.assignments).length,demo.length);
}
const oldSavedRooms=[defaultRoom(),buildPreset('it2'),buildPreset('it3')];
const oldIDs=oldSavedRooms.map(r=>r.id);
assert.equal(addMissingSchoolRooms(oldSavedRooms),2,'Both new rooms arrive in older backups');
assert.deepEqual(oldSavedRooms.slice(0,3).map(r=>r.id),oldIDs,'Existing rooms are never replaced');
assert.equal(addMissingSchoolRooms(oldSavedRooms),0,'Migration is idempotent');
assert.equal(oldSavedRooms.filter(r=>r.name==='IT1').length,1);
assert.equal(oldSavedRooms.filter(r=>r.name==='RM29').length,1);
const namedCustom=[{id:'custom',name:'RM29',seats:[],board:'back'}];
assert.equal(addMissingSchoolRooms(namedCustom),1,'An existing named room is preserved');
assert.equal(namedCustom[0].id,'custom');
assert.equal(namedCustom.filter(r=>r.name==='RM29').length,1);

// Simulate an encrypted backup created when IT1 was incorrectly 31 seats.
// Migration must preserve all existing seat IDs, pupil assignments and locks.
const legacyIT1=buildPreset('it1');
const originalLeft=legacyIT1.seats.filter(s=>s.group==='IT1-Left');
const originalRight=legacyIT1.seats.filter(s=>s.group==='IT1-Right').slice(0,7)
 .map((seat,i)=>({...seat,y:[29,38,47,56,65,74,83][i]}));
const originalMiddle=legacyIT1.seats.filter(s=>s.group.startsWith('IT1-Middle'));
const originalTop=legacyIT1.seats.filter(s=>s.group==='IT1-Upper-Right');
legacyIT1.seats=[...originalLeft,...originalRight,...originalMiddle,
 {...originalTop[0],y:11},originalTop[2]].map((seat,i)=>({...seat,label:String(i+1)}));
assert.equal(legacyIT1.seats.length,31);
const legacyIDs=legacyIT1.seats.map(seat=>seat.id);
const legacyPlan=newPlan('synthetic-class',legacyIT1,'Existing seating');
legacyPlan.assignments={[legacyIT1.seats[0].id]:'example-learner'};
legacyPlan.locks=[legacyIT1.seats[0].id];
const beforeLegacyAssignments=structuredClone(legacyPlan.assignments);
const legacyRooms=[legacyIT1,buildPreset('rm29')];
assert.equal(addMissingSchoolRooms(legacyRooms,[legacyPlan]),2,
 'An unedited IT1 room and its saved plan should both gain two seats');
assert.equal(legacyIT1.seats.length,33);
assert.equal(legacyPlan.layout.seats.length,33);
assert.deepEqual(legacyIT1.seats.slice(0,31).map(seat=>seat.id),legacyIDs);
assert.deepEqual(legacyPlan.layout.seats.slice(0,31).map(seat=>seat.id),legacyIDs);
assert.deepEqual(legacyPlan.layout.seats.slice(31).map(seat=>seat.id),
 legacyIT1.seats.slice(31).map(seat=>seat.id));
assert.deepEqual(legacyPlan.assignments,beforeLegacyAssignments);
assert.deepEqual(legacyPlan.locks,[legacyIDs[0]]);
assert.equal(addMissingSchoolRooms(legacyRooms,[legacyPlan]),0,'Upgrade is idempotent');
const customisedLegacy=buildPreset('it1');
customisedLegacy.seats=structuredClone(legacyIT1.seats.slice(0,31));
customisedLegacy.seats[0].x=17;
assert.equal(addMissingSchoolRooms([customisedLegacy,buildPreset('rm29')]),0);
assert.equal(customisedLegacy.seats.length,31,
 'Do not automatically change a teacher-customised old room');

const plan=newPlan('class',room,'Version');
const a=room.seats[0].id,b=room.seats[1].id;
plan.assignments={[a]:'a',[b]:'b'};
assert.deepEqual(placeStudent(plan,b,'a').assignments,{[a]:'b',[b]:'a'});
assert.throws(()=>placeStudent(plan,b,'new'),/occupied/i);
plan.locks=[a];
assert.throws(()=>placeStudent(plan,b,'a'),/Unlock/);
plan.locks=[];plan.assignments={};
const students=Array.from({length:20},(_,i)=>({id:'p'+i,name:'Synthetic '+i,
 send:i<5?'K':'N',pp:i>=15?'Yes':'No',prior:i%2===0?'High':'Low'}));
const suggested=autoSeat(plan,students,{send:true,pp:true,mixed:true,keepApart:true,keepLocked:true,front:true});
assert.equal(Object.keys(suggested.assignments).length,20);
assert.equal(suggested.access.capacity,20);
assert.equal(suggested.access.eligible,10);
assert.equal(suggested.access.unmet.length,0);
plan.rules=[{id:'apart',type:'apart',a:'p1',b:'p2',mode:'distance',distance:100,strict:true}];

const soloAndTeacherPlan=newPlan('class',room,'Review');
soloAndTeacherPlan.rules=[
 {id:'front-rule',type:'priority',a:'p0',mode:'front',strict:false},
 {id:'teacher-rule',type:'priority',a:'p1',mode:'teacher',strict:false},
 {id:'solo-rule',type:'priority',a:'p2',mode:'solo',strict:false}
];
const considered=autoSeat(soloAndTeacherPlan,students,{send:false,pp:false,mixed:false});
const consideredAudit=auditRules(soloAndTeacherPlan,students,considered.assignments);
assert.equal(consideredAudit.checks.length,3);
assert.ok(consideredAudit.checks.every(r=>r.status==='met'),'Explicit OPP suggestions should affect generated seating');

const withConflict=autoSeat(plan,students,{keepApart:false,send:false,pp:false});
assert.equal(auditRules(plan,students,withConflict.assignments).required.length,1);
console.log('Synthetic workbook parity, import, attendance, grades and seating engine: PASS');
