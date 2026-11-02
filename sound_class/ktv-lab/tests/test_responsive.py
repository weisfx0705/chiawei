"""Touch layout, patch navigation and monitor visibility across small viewports."""
import os
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('KTV_LAB_BASE_URL','http://127.0.0.1:8765')


def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for width,height in [(320,740),(390,844),(600,900),(820,1180),(1024,768),(1180,820),(1440,1000)]:
            touch=width<1440
            ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch)
            page=ctx.new_page()
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.emulate_media(reduced_motion='reduce')
            page.goto(BASE+'/sound_class/14.html');page.wait_for_load_state('networkidle')
            page.locator('[data-mode="stereo"]').click()
            page.locator('#mic-count').select_option('2')
            page.locator('#speakers').select_option('passive')
            page.locator('#example').click()
            page.wait_for_timeout(100)
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
            if touch:
                for selector in ('#mic-type','#pa-type','#rec-type','#listen-target','.input-mode','#f4-route'):
                    assert page.locator(selector).first.evaluate('(el)=>parseFloat(getComputedStyle(el).fontSize)')>=16,(width,selector)
                for selector in ('#audio-play','[data-audio-target="source-vocal"]','.matrix button','.port'):
                    assert page.locator(selector).first.bounding_box()['height']>=44,(width,selector)
            if width<=700:
                kits=page.locator('.kit').all()
                assert all(kit.bounding_box()['width']>width*.8 for kit in kits)
            if width<=1100:
                panels=page.locator('.control-panel').all()
                assert panels[1].bounding_box()['y']>=panels[0].bounding_box()['y']+panels[0].bounding_box()['height']
            assert not errors,errors
            print(f'PASS {width}×{height}: no page overflow, readable touch fields and reachable controls',flush=True)
            ctx.close()

        ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        page=ctx.new_page();page.emulate_media(reduced_motion='reduce')
        page.goto(BASE+'/sound_class/14.html');page.wait_for_load_state('networkidle')
        expect(page.locator('#patch-navigation')).to_be_visible()
        page.locator('[data-board-column="0"]').tap()
        page.locator('[data-port="mic1"]').tap()
        expect(page.locator('#patch-nav-hint')).to_contain_text('MIC 1 OUT')
        page.locator('[data-board-column="1"]').tap()
        assert page.locator('.board-scroll').evaluate('(e)=>e.scrollLeft')>100
        expect(page.locator('[data-port="mic1"]')).to_have_class('port out selected')
        page.locator('[data-port="pa-mic1"]').tap()
        expect(page.locator('#cable-count')).to_have_text('1 條')
        expect(page.locator('#cables [data-wire="mic1"][data-kind="vocal"]')).to_have_count(1)
        page.locator('[data-mode="split"]').tap()
        expect(page.locator('[data-board-column="1"]')).to_have_text('錄音機')
        expect(page.locator('[data-board-column="2"]')).to_have_text('PA')
        page.locator('#example').tap()
        count=page.locator('#cable-count').inner_text()
        page.set_viewport_size({'width':844,'height':390})
        expect(page.locator('#cable-count')).to_have_text(count)
        page.set_viewport_size({'width':390,'height':844})
        expect(page.locator('#cable-count')).to_have_text(count)
        print('PASS Touch patching with equipment jumps, selected OUT preserved, dynamic route order and rotation',flush=True)

        page.locator('[data-audio-target="source-vocal"]').tap()
        expect(page.locator('#audio-play')).to_have_attribute('aria-pressed','true')
        page.locator('#audio-play').scroll_into_view_if_needed()
        expect(page.locator('#audio-dock')).to_be_hidden()
        page.locator('#soundcheck').scroll_into_view_if_needed()
        expect(page.locator('#audio-dock')).to_be_visible()
        assert page.locator('#audio-dock').bounding_box()['width']>=388
        page.locator('#dock-pause').tap()
        expect(page.locator('#audio-dock')).to_be_hidden()
        expect(page.locator('body')).not_to_have_class('audio-dock-visible')
        print('PASS Phone playback uses the main button when visible and a bottom pause bar elsewhere',flush=True)
        ctx.close()
        browser.close()


if __name__=='__main__':
    run()
