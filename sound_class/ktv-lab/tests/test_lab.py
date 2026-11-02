"""Browser regression for the signal-flow teaching contract.
Run with the server helper documented in ../README.md. No credentials needed.
"""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('KTV_LAB_BASE_URL', 'http://127.0.0.1:8765')


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        checks = []

        def fresh():
            page.goto(BASE + '/sound_class/14.html')
            page.wait_for_load_state('networkidle')

        def mode(name):
            page.locator(f'[data-mode="{name}"]').click()

        def demo():
            page.locator('#example').click()
            page.wait_for_timeout(50)

        def wire(source, destination):
            page.locator(f'[data-port="{source}"]').click()
            page.locator(f'[data-port="{destination}"]').click()
            page.wait_for_timeout(50)

        def slider(control, value):
            element = page.locator(f'[data-control="{control}"]' if control.count('-') >= 2 else '#' + control)
            element.evaluate('(el, value) => { el.focus(); el.value = value; el.dispatchEvent(new Event("input", {bubbles:true})); el.blur(); }', str(value))
            page.wait_for_timeout(30)

        def signal(name):
            return page.locator(f'[data-signal="{name}"]').inner_text()

        def check(label):
            checks.append(label)
            print('PASS', label, flush=True)

        fresh()
        assert page.locator('#cables path').count() == 0
        page.locator('[data-port="pa-mic1"]').click()
        assert '先選上游' in page.locator('#patch-message').inner_text()
        wire('pc-video', 'rec-in1')
        assert '畫面與聲音' in page.locator('#patch-message').inner_text()
        assert page.locator('#cable-count').inner_text() == '0 條'
        wire('mic1', 'pa-mic1')
        expect(page.locator('#cables .live')).to_have_count(1)
        page.locator('.connections summary').click()
        page.locator('#connection-list [data-unplug]').click()
        assert page.locator('#cable-count').inner_text() == '0 條'
        check('Manual patching, incompatible signals, input-first hint and unplug')

        fresh()
        demo()
        page.locator('#check').click()
        assert '5 / 5' in page.locator('#check-score').inner_text()
        assert '人聲 1 ＋ 伴奏 L' in signal('rec-iso1')
        page.locator('#goal').select_option('film')
        assert '4 / 5' in page.locator('#check-score').inner_text()
        live_before = signal('left')
        slider('send-master', 0)
        assert signal('left') == live_before
        assert '沒有訊號' in signal('rec-iso1')
        slider('send-master', 80)
        slider('pa-master', 0)
        assert '沒有訊號' in signal('left') and '沒有訊號' in signal('rec-iso1')
        slider('pa-master', 80)
        page.locator('#pa-fx').check()
        assert 'PA FX' in signal('rec-iso1')
        check('PA mix is not dry ISO; REC and MAIN levels and wet content follow the actual path')

        fresh()
        mode('split')
        demo()
        page.locator('#goal').select_option('film')
        page.locator('#check').click()
        assert '5 / 5' in page.locator('#check-score').inner_text()
        assert '雙邊 Mono' in page.locator('#stereo-result').inner_text()
        iso_before = signal('rec-iso1')
        slider('rec-1-fader', 0)
        assert '人聲' not in signal('left')
        assert signal('rec-iso1') == iso_before
        slider('rec-1-fader', 100)
        slider('rec-1-trim', -12)
        assert '-29.7 dBFS' in signal('rec-iso1')
        page.locator('[data-control="rec-1-arm"]').uncheck()
        assert page.locator('[data-signal="rec-iso1"]').count() == 0
        assert '人聲 1' in signal('left')
        assert '3 / 5' in page.locator('#check-score').inner_text()
        check('Recorder-first: pan split, ISO/fader independence, trim and ARM behavior')

        fresh()
        mode('stereo')
        page.locator('#mic-count').select_option('2')
        demo()
        page.locator('#goal').select_option('film')
        page.locator('#check').click()
        assert '5 / 5' in page.locator('#check-score').inner_text()
        assert 'Stereo：' in page.locator('#stereo-result').inner_text()
        assert '伴奏' not in signal('rec-iso1') and '伴奏' not in signal('rec-iso2')
        assert '伴奏 L' in signal('rec-iso3') and '伴奏 R' in signal('rec-iso4')
        slider('rec-1-fader', 0)
        assert '人聲 1' in signal('left')  # Matrix PRE ignores the channel fader.
        page.locator('[data-matrix="0,0"]').click()  # PRE -> POST.
        assert '人聲 1' not in signal('left')
        assert '人聲 1' in signal('rec-iso1')
        check('Two singers plus stereo occupy four inputs; F4 PRE/POST matrix keeps ISO independent')

        fresh()
        page.locator('#pa-type').select_option('aux')
        demo()
        page.locator('#goal').select_option('film')
        page.locator('#check').click()
        assert '5 / 5' in page.locator('#check-score').inner_text()
        assert '伴奏' not in signal('rec-iso1')
        aux_iso = signal('rec-iso1')
        slider('pa-mic1-level', 0)
        assert signal('rec-iso1') == aux_iso
        page.locator('#aux-pre').uncheck()
        assert '沒有訊號' in signal('rec-iso1')
        check('Independent AUX excludes music; PRE ignores fader and POST follows fader')

        fresh()
        page.locator('#pa-type').select_option('digital')
        demo()
        page.locator('#goal').select_option('film')
        page.locator('#check').click()
        assert '5 / 5' in page.locator('#check-score').inner_text()
        assert '伴奏' not in signal('rec-iso1')
        page.locator('#clear').click()
        wire('mic1', 'pa-mic1')
        wire('pc-l', 'pa-line1')
        wire('pc-r', 'pa-line2')
        wire('pa-bus1', 'rec-in1')
        wire('pa-bus2', 'rec-in2')
        slider('pa-mic1-send2', 0)
        slider('pa-line1-send1', 0)
        slider('pa-line2-send1', 0)
        assert '人聲 1' in signal('rec-iso1') and '伴奏' not in signal('rec-iso1')
        assert '人聲' not in signal('rec-iso2') and '伴奏' in signal('rec-iso2')
        check('Digital direct out and independent vocal/music BUS routing')

        fresh()
        page.locator('#speakers').select_option('passive')
        wire('pa-main-l', 'sp-l')
        assert '被動式喇叭需要' in page.locator('#patch-message').inner_text()
        wire('amp-out-l', 'rec-in1')
        assert '功率輸出' in page.locator('#patch-message').inner_text()
        demo()
        page.locator('#check').click()
        assert '5 / 5' in page.locator('#check-score').inner_text()
        check('Passive speakers require power amplifier; power output cannot feed the recorder')

        fresh()
        mode('split')
        page.locator('#rec-type').select_option('mono')
        demo()
        page.locator('#check').click()
        assert '容量提醒' in page.locator('#diagnostics').inner_text()
        mode('pa')
        page.locator('#mic-count').select_option('2')
        page.locator('#pa-mics').select_option('1')
        demo()
        page.locator('#check').click()
        assert '5 / 5' not in page.locator('#check-score').inner_text()
        check('Insufficient recorder or PA inputs cannot falsely complete the task')

        fresh()
        mode('split')
        demo()
        page.locator('#record-format').select_option('both')
        assert page.locator('#record-results .signal-row').count() == 6
        page.locator('#record-test').click()
        slider('rec-master', 0)
        page.locator('#record-test').click()
        assert page.locator('#take-list .take').count() == 2
        assert 'REC OUT 80%' in page.locator('#take-list .take').nth(1).inner_text()
        assert 'REC OUT 0%' in page.locator('#take-list .take').nth(0).inner_text()
        page.locator('#record-format').select_option('mix')
        assert page.locator('#record-results .signal-row').count() == 2
        page.locator('#listen-live').click()
        slider('rec-master', 80)
        page.locator('#listen-live').click()
        expect(page.locator('#audio-status')).to_contain_text('正在循環播放')
        page.locator('#audio-play').click()
        check('ISO/LR format selection, immutable take snapshots and synthesized audition')

        fresh()
        page.locator('#source-music').uncheck()
        demo()
        expect(page.locator('#cables .cable:not(.live)')).not_to_have_count(0)
        expect(page.locator('#cables .live')).not_to_have_count(0)
        page.locator('[data-port="rec-main1"]').click()
        page.locator('[data-port="pa-line3"]').click()
        assert '循環回送' in page.locator('#patch-message').inner_text()
        page.locator('[data-port="pc-l"]').focus()
        page.keyboard.press('Enter')
        page.keyboard.press('Escape')
        assert page.locator('.port.selected').count() == 0
        check('Inactive signal cables, feedback prevention and keyboard selection/cancel')

        for width in (390, 768, 1440):
            page.set_viewport_size({'width':width,'height':900})
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}'
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('html').evaluate('(el)=>getComputedStyle(el).scrollBehavior') == 'auto'
        page.set_viewport_size({'width':390,'height':844})
        scroll = page.locator('.board-scroll')
        scroll.evaluate('(el)=>el.scrollLeft=el.scrollWidth')
        assert scroll.evaluate('(el)=>el.scrollLeft') > 0
        check('Phone/tablet/desktop containment, scrollable patch bay and reduced motion')

        # No application code or fonts are required from a CDN to run the lesson.
        offline = browser.new_context()
        offline.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
        offpage = offline.new_page()
        offpage.goto(BASE + '/sound_class/14.html')
        offpage.locator('#example').click()
        offpage.locator('#check').click()
        assert '5 / 5' in offpage.locator('#check-score').inner_text()
        offpage.goto(BASE + '/sound_class/index2.html')
        assert offpage.locator('a[href="./14.html"]').count() == 1
        check('Local-only lesson works with external requests blocked; course card is present')
        offline.close()
        assert not errors, errors
        browser.close()
        print(f'{len(checks)} browser scenarios passed; no JavaScript errors.')


if __name__ == '__main__':
    run()
