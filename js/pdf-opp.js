import {pdfTextLines} from './pdf-text.js';
// Local, text-based PDF One Page Profile parser. Image-only/scanned PDFs
// deliberately fail rather than being silently attached to a pupil.
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const displayName=s=>{const v=clean(s);if(!v.includes(','))return v;const p=v.split(',');return clean(p.slice(1).join(',')+' '+p[0])};
const headings=[
 {pattern:/^non.negotiables|^high quality teaching/i,key:'adaptations'},
 {pattern:/^reasonable adjustments|^send provision/i,key:'adjustments'},
 {pattern:/^preparation for adulthood/i,key:'targets'},
 {pattern:/^things you should know/i,key:'about'}
];
export function pdfOppFromLines(lines,filename='OPP.pdf'){
 const cleaned=lines.map(clean).filter(Boolean).slice(0,15000);
 const joined=cleaned.join(' ');
 if(joined.replace(/[\W\d_]+/g,'').length<35)
  throw Error('PDF has no usable selectable text. Scanned/image-only PDFs need OCR or an original Word file.');
 const field=label=>{
  const re=new RegExp('^\\s*'+label+'\\s*[:\\-]?\\s*(.*)$','i');
  for(let i=0;i<cleaned.length;i++){
   const found=re.exec(cleaned[i]);if(!found)continue;
   const value=clean(found[1]);if(value)return value;
   const next=clean(cleaned[i+1]);
   if(next&&!/^(pupil name|send area|diagnosis|exam access|reading|spelling|non.negotiables|reasonable adjustments)/i.test(next))return next;
  }
  return '';
 };
 const fromFile=clean(filename.replace(/\.pdf$/i,'').replace(/,\s*/g,', '));
 const opp={name:displayName(field('Pupil\\s*Name')||fromFile),
  need:field('SEND\\s*Area\\s*of\\s*Need'),
  diagnosis:field('Diagnosis\\s*\\/\\s*identification'),
  examAccess:field('Exam\\s*Access'),
  readingSS:field('Reading\\s*standardised\\s*score'),readingAge:field('Reading\\s*age'),
  spellingSS:field('Spelling\\s*standardised\\s*score'),spellingAge:field('Spelling\\s*age'),
  adaptations:[],adjustments:[],targets:[],about:[],photo:''};
 const labels=/^(pupil name|send area of need|diagnosis|exam access|reading (age|standardised)|spelling (age|standardised))/i;
 let section='';
 for(const line of cleaned){
  const group=headings.find(h=>h.pattern.test(line));
  if(group){section=group.key;continue}
  if(labels.test(line))continue;
  if(section&&line.length>2&&line.length<1200&&!opp[section].includes(line))opp[section].push(line);
 }
 if(!opp.need&&!opp.diagnosis&&!opp.examAccess&&!opp.adaptations.length&&!opp.adjustments.length&&!opp.targets.length&&!opp.about.length)
  throw Error('PDF has no recognisable OPP sections. Export a searchable, text-based PDF from Word.');
 return opp;
}
export async function extractPdfOpp(buffer,filename='OPP.pdf'){
 return pdfOppFromLines(await pdfTextLines(buffer),filename);
}
