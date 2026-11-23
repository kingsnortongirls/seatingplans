import { strict as assert } from 'node:assert';
import { readEdulink,buildEdulinkReview,gradeGap,gradeValue,assessmentGap,assessmentHistory,
  classQuality,isLateRecord,isBehaviourRecord,defaultRoom,buildPreset,newPlan,placeStudent,autoSeat,oppSeatingHints,auditRules } from '../js/core.js';

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
assert.equal(room.seats.filter(s=>s.priority==='access').length,8);
assert.equal(buildPreset('it2','IT2').seats.length,33);
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
assert.equal(suggested.access.capacity,8);
assert.equal(suggested.access.eligible,10);
assert.equal(suggested.access.unmet.length,2);
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
