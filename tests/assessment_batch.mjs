import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';

// Entirely synthetic class data. Drafts remain local and no HTTP is used.
const dir=dirname(dirname(fileURLToPath(import.meta.url)));
const core=readFileSync(join(dir,'js/core.js'),'utf8').replace(/^import\s+[^\n]+\n/gm,'')
 .replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class))/g,'');
const app=readFileSync(join(dir,'js/app.js'),'utf8').replace(/^import\s+[^\n]+\n/gm,'');
const el=()=>({innerHTML:'',textContent:'',value:'',disabled:false,isConnected:true,
 classList:{contains(){return false},add(){},remove(){},toggle(){}},
 addEventListener(){},setAttribute(){},focus(){},select(){},scrollIntoView(){},
 replaceChildren(){},click(){},querySelector(){return el()},querySelectorAll(){return []}});
const elements=new Map();
const element=sel=>{if(!elements.has(sel))elements.set(sel,el());return elements.get(sel)};
const document={querySelector:element,querySelectorAll(){return []},createElement:el,
 addEventListener(){},activeElement:{tagName:'DIV'},body:{classList:{add(){},remove(){}}}};
const window={addEventListener(){},scrollTo(){},matchMedia(){return {matches:true}},open(){return null}};
const jobs=[];
let consent=true;
const hooks=[
 'let modal=null;',
 'openModal=(title,body,onSave,label)=>modal={title,body,onSave,label};',
 'closeModal=()=>modal=null;',
 "return {setup:()=>{data.classes=[{id:'c',name:'Synthetic 9X/CS',assessmentHeaders:[],selectedAssessment:''}];",
 "data.students=[{id:'a',name:'Alpha Example',classId:'c',active:true,current:'6',target:'7'},",
 "{id:'b',name:'Beta Example',classId:'c',active:true,current:'5',target:'6'},",
 "{id:'g',name:'Gamma Example',classId:'c',active:true,current:'7',target:'8'}];",
 "classId='c';view='assessments';render();},",
 'action,modal:()=>modal,html:()=>document.querySelector("#app").innerHTML,',
 'view:()=>view,state:()=>assessmentWizard?structuredClone(assessmentWizard):null,',
 'grades:()=>data.assessments,go:goto,undo,check:sid=>assessmentWizard?.grades[sid]};'
].join('\n');
const runtime=new Function('document','window','crypto','queueMicrotask','setTimeout',
 'clearTimeout','setInterval','clearInterval','confirm',core+'\n'+app+'\n'+hooks)
 (document,window,webcrypto,fn=>jobs.push(fn),()=>1,()=>{},()=>1,()=>{},()=>consent);
const flush=()=>{let i=0;while(jobs.length&&i++<50)jobs.shift()()};
const fd=(name,date)=>({get:key=>key==='name'?name:key==='date'?date:''});
runtime.setup();
assert.match(runtime.html(),/Add whole class assessment/);
runtime.action('new-class-assessment');
assert.equal(runtime.modal().title,'Add whole class assessment');
runtime.modal().onSave(fd('Synthetic unit test','2026-11-24'));flush();
assert.equal(runtime.view(),'assessment-entry');
assert.match(runtime.html(),/Alpha Example/);
assert.equal(runtime.grades().length,0);
runtime.action('assessment-next');
assert.equal(runtime.state().index,0,'Blank grade cannot silently advance');
element('#assessmentGrade').value='7';
runtime.action('assessment-next');
assert.equal(runtime.state().index,1);
assert.equal(runtime.check('a'),'7');
element('#assessmentGrade').value='5';
runtime.action('assessment-next');
assert.equal(runtime.state().index,2);
runtime.action('assessment-back');
assert.equal(runtime.state().index,1);
element('#assessmentGrade').value='6';
runtime.action('assessment-next');
assert.equal(runtime.check('b'),'6','Back and correction must persist');
runtime.action('assessment-skip');
assert.equal(runtime.state().index,3);
assert.equal(runtime.state().skipped.g,true);
assert.match(runtime.html(),/End of class reached/);
assert.match(runtime.html(),/Save all and return to overview/);
assert.equal(runtime.grades().length,0,'No grades saved before final confirmation');
runtime.action('assessment-save');
assert.equal(runtime.view(),'overview');
assert.equal(runtime.grades().length,2,'Batch must save exactly two results');
assert.equal(runtime.grades().find(x=>x.studentId==='b').grade,'6');
assert.ok(runtime.grades().every(x=>x.name==='Synthetic unit test'&&x.date==='2026-11-24'));
runtime.undo();
assert.equal(runtime.grades().length,0,'Whole class save is a single Undo operation');
// Re-enter the same name/date: prefill and replace, never duplicate.
runtime.go('assessments');
runtime.action('new-class-assessment');
runtime.modal().onSave(fd('Synthetic unit test','2026-11-24'));flush();
// Explicitly mark Alpha as having no result before jumping across pupils.
runtime.action('assessment-skip');
element('#assessmentGrade').value='';
runtime.action('assessment-jump',{id:'g'});
element('#assessmentGrade').value='';
runtime.action('assessment-jump',{id:'b'});
element('#assessmentGrade').value='8';
runtime.action('assessment-next');
runtime.action('assessment-skip');
runtime.action('assessment-save');
assert.equal(runtime.grades().length,1);
assert.equal(runtime.grades()[0].grade,'8');
runtime.go('assessments');
runtime.action('new-class-assessment');
runtime.modal().onSave(fd('Synthetic unit test','2026-11-24'));flush();
assert.equal(runtime.check('b'),'8','Existing matching assessments are prefilled');
runtime.action('assessment-skip');
element('#assessmentGrade').value='';
runtime.action('assessment-jump',{id:'b'});
element('#assessmentGrade').value='9';
runtime.action('assessment-next');
runtime.action('assessment-skip');
runtime.action('assessment-save');
assert.equal(runtime.grades().length,1,'Re-entry updates instead of duplicating');
assert.equal(runtime.grades()[0].grade,'9');
// Cancel and route changes ask for consent and never write provisional grades.
runtime.go('assessments');
runtime.action('new-class-assessment');
runtime.modal().onSave(fd('Draft only','2026-11-24'));flush();
const before=runtime.grades().length;
consent=false;
runtime.go('overview');
assert.equal(runtime.view(),'assessment-entry','Declining to discard keeps the draft');
assert.notEqual(runtime.state(),null);
consent=true;
runtime.action('assessment-cancel');
assert.equal(runtime.view(),'assessments');
assert.equal(runtime.grades().length,before,'Cancel must not save any new data');
console.log('PASS: Whole-class assessment draft, Enter-next, corrections, skip, single-save, undo and no duplicates');
