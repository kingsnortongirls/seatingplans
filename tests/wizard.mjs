import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';

// Entirely fictional class and pupil data. Nothing is transmitted or saved.
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const core=readFileSync(join(root,'js/core.js'),'utf8')
 .replace(/^import[^\n]*\n/gm,'')
 .replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class))/g,'');
const app=readFileSync(join(root,'js/app.js'),'utf8').replace(/^import[^\n]*\n/gm,'');
const item=()=>({innerHTML:'',textContent:'',value:'',disabled:false,isConnected:true,
 classList:{toggle(){},add(){},remove(){},contains(){return false}},
 addEventListener(){},setAttribute(){},focus(){},scrollIntoView(){},
 remove(){},replaceChildren(){},click(){},
 querySelector(){return item()},querySelectorAll(){return []}});
const elements=new Map();
const node=id=>{if(!elements.has(id))elements.set(id,item());return elements.get(id)};
const document={querySelector:node,querySelectorAll(){return []},
 getElementById:id=>node('#'+id),createElement:item,addEventListener(){},
 activeElement:{tagName:'DIV'},body:{classList:{add(){},remove(){}}}};
const window={addEventListener(){},scrollTo(){},matchMedia(){return{matches:true}},open(){return null}};
const micro=[];
const testHooks=[
 'let modal=null;',
 'openModal=(title,body,onSave,saveLabel)=>{modal={title,body,onSave,saveLabel}};',
 'closeModal=()=>{modal=null};',
 "return {setup:()=>{data.classes=[{id:'A',name:'7X/CS'},{id:'B',name:'8Y/CS'}];",
 "data.students=[{id:'a1',name:'Example One',classId:'A',active:true,send:'K',pp:'No',opp:{adaptations:['Seat at front'],adjustments:[],about:[]}},",
 "{id:'a2',name:'Example Two',classId:'A',active:true,send:'N',pp:'No'},",
 "{id:'b1',name:'Example Three',classId:'B',active:true,send:'N',pp:'No',opp:{adaptations:[],adjustments:['Seat near the teacher'],about:[]}}];",
 "classId='A';view='setup';setupActive=true;setupPhase='import';render();},",
 'action,modal:()=>modal,clearModal:()=>{modal=null},',
 'state:()=>({view,classId,setupPhase,setupActive,wizardPlanIndex,confirmed:[...wizardConfirmed],verified:wizardVerified}),',
 "html:()=>document.querySelector('#app').innerHTML,",
 'verify:stage=>{wizardVerified=stage;render()},',
 'plan:()=>currentPlan(),',
 'assign:()=>mutation(()=>{const p=currentPlan();const pupils=currentStudents();p.assignments=Object.fromEntries(pupils.map((s,i)=>[p.layout.seats[i].id,s.id]))}),',
 "change:()=>mutation(()=>{currentPlan().notes='Synthetic update'})};"
].join('\n');
const ui=new Function('document','window','crypto','queueMicrotask','setTimeout','clearTimeout','setInterval','clearInterval','confirm',
 core+'\n'+app+'\n'+testHooks)(document,window,webcrypto,fn=>micro.push(fn),()=>1,()=>{},()=>1,()=>{},()=>true);
const flush=()=>{for(let i=0;micro.length&&i<100;i++)micro.shift()()};
ui.setup();
assert.match(ui.html(),/Import all your teaching groups/);
ui.action('wizard-finish');flush();
assert.equal(ui.state().setupPhase,'opp');
assert.equal(ui.modal(),null);
assert.match(ui.html(),/Continue to seating plans/);
ui.action('wizard-begin-seating');
assert.equal(ui.state().setupPhase,'plan');
assert.equal(ui.state().classId,'A');
assert.match(ui.html(),/STEP 1 · CHOOSE A ROOM/);
ui.action('wizard-new-plan');
assert.ok(ui.plan());
ui.action('wizard-confirm-plan');assert.equal(ui.modal(),null,'Empty plan cannot be confirmed');
ui.assign();ui.action('wizard-confirm-plan');
assert.equal(ui.modal().title,'Confirm class seating plan');
assert.throws(()=>ui.modal().onSave({has:()=>false}),/acknowledg/i);
ui.modal().onSave({has:()=>true});ui.clearModal();flush();
assert.equal(ui.state().classId,'B');
assert.deepEqual(ui.state().confirmed,['A']);
ui.action('wizard-new-plan');ui.assign();
ui.action('wizard-adjust-plan');
assert.equal(ui.state().view,'seating');
assert.match(ui.html(),/Return to guided setup/);
ui.action('wizard-return-plan');
assert.equal(ui.state().view,'setup');
ui.action('wizard-confirm-plan');ui.modal().onSave({has:()=>true});ui.clearModal();flush();
assert.equal(ui.state().setupPhase,'final-backup');
assert.equal(ui.modal().title,'Create final seating plans backup');
ui.action('wizard-complete');
assert.equal(ui.state().setupPhase,'final-backup','Cannot finish before encrypted download');
ui.verify('downloaded');ui.clearModal();ui.action('wizard-complete');
assert.equal(ui.state().setupPhase,'complete');
assert.match(ui.html(),/Ready to teach/);
console.log('Bulk guided imports, single backup gate and all class plans: PASS');
