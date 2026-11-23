"""Local smoke checks using only synthetic pupil data. Never commits real pupil material."""
import asyncio, pathlib, io, csv, zipfile
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).parents[1]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(accept_downloads=True)
  errs=[]
  page.on('pageerror',lambda err:errs.append(str(err)))
  import re
  html=(ROOT/'index.html').read_text()
  html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '',html)
  html=html.replace('<link rel="stylesheet" href="styles.css">','').replace('<script type="module" src="js/app.js"></script>','')
  await page.set_content(html)
  await page.add_style_tag(content=(ROOT/'styles.css').read_text())
  core=re.sub(r'^export\s+', '',(ROOT/'js/core.js').read_text(),flags=re.M)
  app=re.sub(r'^import [^\n]+\n','',(ROOT/'js/app.js').read_text(),count=1)
  await page.add_script_tag(content=core+'\n'+app)
  print('title',await page.title());print('pageerror',errs)
  assert await page.get_by_text('Import an Edulink marksheet').count()>=1
  # Synthetic Edulink export
  path=ROOT/'tests'/'demo.csv'
  with path.open('w',newline='') as f:
   w=csv.writer(f);w.writerow(['Learner','Class','Pupil Premium Indicator','SEN Status','Prior Attainment Group','Y7 Reading age','Y7 Cs AT (Y07 Year End)','Y7 Cs COTTA Dec (Y07 Dec)','Student ID']);w.writerows([[f'Pupil {n}', '7X/CS', 'No', 'N', 'Middle', '10:4', '7','6',f'ID-{n}'] for n in range(1,17)])
  await page.locator('#csvFile').set_input_files(str(path));await page.wait_for_timeout(200)
  assert await page.get_by_text('Review Edulink marksheet changes').count()>=1
  await page.locator('#modalForm button[type=submit]').click()
  print('after import title',(await page.locator('main').inner_text())[:340]);print('pageerror',errs)
  await page.get_by_role('button',name='Open',exact=True).first.click()
  await page.get_by_role('button',name='+ New version').click()
  await page.locator('#modalForm input[name=name]').fill('Autumn 1')
  await page.locator('#modalForm button[type=submit]').click()
  print('room seats',await page.locator('.seat').count())
  assert await page.locator('.seat').count()==32
  await page.get_by_role('button',name='⚄ Generate seats').click()
  print('seated',await page.locator('.seat:not(.unassigned)').count())
  assert await page.locator('.seat:not(.unassigned)').count()==16
  # Moving a seated pupil onto another occupied seat must swap, not unseat.
  before=await page.locator('.seat:not(.unassigned) strong').all_inner_texts()
  first=before[0];second=next(x for x in before if x!=first)
  await page.locator('.pupil-chip',has=page.locator('strong',has_text=first)).first.click()
  await page.locator('.seat:not(.unassigned)',has=page.locator('strong',has_text=second)).first.click()
  assert await page.locator('.seat:not(.unassigned)').count()==16
  # Batch marking: tap a seat, then confirm to create one local record.
  await page.get_by_role('button',name='Mark homework').click()
  await page.locator('#modalForm input[name=assignment]').fill('Synthetic homework task')
  await page.locator('#modalForm button[type=submit]').click()
  await page.locator('.seat:not(.unassigned)').first.click()
  assert await page.locator('.seat.homework-missing').count()==1
  await page.get_by_role('button',name='Save missing records').click()
  await page.locator('#modalForm button[type=submit]').click()
  await page.locator('#nav [data-view=records]').click()
  assert await page.get_by_text('Synthetic homework task').count()>=1
  await page.locator('#nav [data-view=seating]').click()
  await page.get_by_role('button',name='Seating rules').click()
  await page.locator('#modalForm [name=type]').select_option('apart')
  await page.locator('#modalForm [name=b]').select_option(index=2)
  await page.locator('#modalForm button[type=submit]').click()
  await page.get_by_role('button',name='Duplicate').first.click()
  await page.locator('#modalForm button[type=submit]').click()
  print('version selector', await page.locator('select[name=planId] option').count())
  assert await page.locator('select[name=planId] option').count()==2
  await page.get_by_role('button',name='Compare',exact=True).click()
  await page.locator('#modalForm button[type=submit]').click()
  assert await page.get_by_text('Version comparison').count()>=1
  await page.locator('#modalRoot [data-action=close-modal]').click()
  await page.locator('#nav [data-view=rooms]').click()
  await page.get_by_role('button',name='+ Add desk').click()
  print('room seats after add',await page.locator('.seat').count())
  assert await page.locator('.seat').count()==33
  await page.locator('#nav [data-view=records]').click()
  await page.get_by_role('button',name='+ Record homework').click()
  await page.locator('#modalForm input[name=assignment]').fill('Unit 1 work')
  await page.locator('#modalForm button[type=submit]').click()
  print('record found',await page.get_by_text('Unit 1 work').count())
  assert await page.get_by_text('Unit 1 work').count()==1
  await page.locator('#nav [data-view=tools]').click()
  await page.get_by_role('button',name='⚄ Pick a pupil').click()
  await page.locator('#groupForm button[type=submit]').click()
  print('group cards',await page.locator('.group-result').count())
  assert await page.locator('.group-result').count()>=4
  print('crypto context',await page.evaluate('({secure:isSecureContext,subtle:!!crypto.subtle})'))
  # Synthetic Word document with text boxes. No real pupil material is used in tests.
  word_ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  def txbox(*lines):
   paras=''.join(f'<w:p><w:r><w:t>{text}</w:t></w:r></w:p>' for text in lines)
   return f'<w:txbxContent>{paras}</w:txbxContent>'
  xml=f'<w:document xmlns:w="{word_ns}"><w:body>'+txbox('Pupil Name: Pupil 1','SEND Area of Need: C&amp;I')+txbox('Non-negotiables - High Quality Teaching Adaptations','Chunking instructions','Use worked examples')+txbox('Reasonable adjustments/SEND provision:','Teacher check-ins')+'</w:body></w:document>'
  doc=ROOT/'tests'/'synthetic.docx'
  with zipfile.ZipFile(doc,'w',compression=zipfile.ZIP_DEFLATED) as z:z.writestr('word/document.xml',xml)
  await page.locator('#oppFiles').set_input_files(str(doc))
  await page.wait_for_timeout(800)
  print('opp message',await page.locator('#toastRoot').inner_text())
  assert 'Matched 1 OPP(s)' in await page.locator('#toastRoot').inner_text()
  doc.unlink(missing_ok=True)
  # Refresh retains existing pupil identity when the name changes, using Student ID.
  path.write_text(path.read_text().replace('Pupil 1,','Pupil One Renamed,'),encoding='utf-8')
  await page.locator('#csvFile').set_input_files(str(path))
  assert await page.get_by_text('Review Edulink marksheet changes').count()>=1
  await page.locator('#modalForm button[type=submit]').click()
  await page.locator('#nav [data-view=profiles]').click()
  assert await page.get_by_text('Pupil One Renamed').count()>=1
  path.unlink(missing_ok=True)
  print('pageerrors',errs)
  assert not errs,errs
  await browser.close()

if __name__=='__main__': asyncio.run(main())
