"""Controls and their corresponding signal readouts must stay visible together."""
import os
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('KTV_LAB_BASE_URL','http://127.0.0.1:8765')


def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for width,height in [(320,740),(390,844),(820,1180),(1440,1000)]:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<1440,has_touch=width<1440)
            page=context.new_page();page.emulate_media(reduced_motion='reduce')
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(BASE+'/sound_class/14.html');page.wait_for_load_state('networkidle')
            page.locator('[data-mode="split"]').click();page.locator('#example').click()
            page.locator('#source-music').uncheck()

            def adjust(selector,value,pair):
                control=page.locator(selector)
                control.evaluate('(el)=>el.scrollIntoView({block:"center",behavior:"instant"})')
                control.focus()
                page.wait_for_timeout(50)
                bounds=control.bounding_box();monitor=page.locator(pair+' .pair-monitor').bounding_box()
                assert monitor['y']>=0 and monitor['y']+monitor['height']<=height,(width,monitor)
                assert bounds['y']>=monitor['y']+monitor['height'],(width,bounds,monitor)
                assert bounds['y']+bounds['height']<height,(width,bounds)
                control.evaluate('(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))

            live=page.locator('[data-signal="left"]')
            iso=page.locator('[data-signal="rec-iso1"]')
            before_iso=iso.inner_text();before_live=live.inner_text()
            adjust('#pa-master',40,'.live-pair')
            assert live.inner_text()!=before_live
            assert iso.inner_text()==before_iso
            adjust('[data-control="rec-1-trim"]',-12,'.record-pair')
            expect(iso).to_contain_text('-29.7 dBFS')
            adjust('[data-control="rec-1-fader"]',0,'.record-pair')
            expect(live).to_contain_text('沒有訊號')
            expect(iso).to_contain_text('-29.7 dBFS')

            # Lower F4 controls must retain the paired monitor as well.
            page.locator('[data-mode="stereo"]').click();page.locator('#source-music').check();page.locator('#example').click()
            adjust('[data-control="rec-3-trim"]',-6,'.record-pair')
            expect(page.locator('[data-signal="rec-iso3"]')).to_contain_text('-23.7 dBFS')
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
            assert not errors,errors
            print(f'PASS {width}×{height}: paired monitor and active control share the viewport; PA, ISO and FADER results update correctly',flush=True)
            context.close()
        context=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True)
        page=context.new_page();page.goto(BASE+'/sound_class/14.html');page.wait_for_load_state('networkidle')
        assert page.locator('.pair-monitor').first.evaluate('(el)=>getComputedStyle(el).position')=='static'
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        print('PASS Short landscape viewport keeps monitors in flow so controls remain reachable',flush=True)
        context.close();browser.close()


if __name__=='__main__':
    run()
