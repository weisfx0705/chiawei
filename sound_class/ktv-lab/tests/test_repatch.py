"""Try a second wiring choice without clearing the entire teaching setup."""
import os
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('KTV_LAB_BASE_URL','http://127.0.0.1:8765')


def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.emulate_media(reduced_motion='reduce')

        def fresh():
            page.goto(BASE+'/sound_class/14.html');page.wait_for_load_state('networkidle')
            page.locator('#example').click()

        def tap(port):page.locator(f'[data-port="{port}"]').click()
        def count(n):expect(page.locator('#cable-count')).to_have_text(f'{n} 條')
        def signal(port,kind):expect(page.locator(f'[data-port="{port}"]')).to_have_attribute('data-signal',kind)

        fresh();count(8)
        tap('mic1')
        expect(page.locator('#unplug-selected')).to_be_enabled()
        signal('pa-mic1','vocal')  # Selecting does not unplug the old route.
        tap('pa-mic2');count(8)
        signal('pa-mic1','none');signal('pa-mic2','vocal')
        print('PASS An occupied output can move to another input without clearing other cables',flush=True)

        tap('pa-mic2')  # Start at a connected input instead.
        tap('rec-in1');count(7)  # Original mic route and occupied REC input are replaced.
        signal('pa-mic2','none');signal('rec-in1','vocal')
        expect(page.locator('[data-signal="left"]')).not_to_contain_text('人聲 1')
        expect(page.locator('[data-signal="rec-iso1"]')).to_contain_text('人聲 1')
        expect(page.locator('[data-signal="rec-iso1"]')).not_to_contain_text('伴奏')
        tap('rec-in1');tap('rec-in1');count(6)
        signal('rec-in1','none')
        expect(page.locator('#unplug-selected')).to_be_disabled()
        print('PASS Connected inputs can be rerouted, occupied targets replaced, and the same pair toggled off',flush=True)

        tap('pc-l');page.locator('#unplug-selected').click();count(5)
        signal('pa-line1','none')
        fresh();tap('mic1');tap('pc-l');tap('pa-line3');count(7)
        signal('pa-mic1','none');signal('pa-line1','none');signal('pa-line3','music');signal('pa-line2','music')
        print('PASS Explicit unplug and changing both ends of an existing cable are supported',flush=True)

        fresh();tap('mic1');page.keyboard.press('Escape');count(8)
        signal('pa-mic1','vocal')
        expect(page.locator('.port.selected')).to_have_count(0)
        tap('pa-mic1');tap('pc-video');tap('rec-in1');count(8)
        expect(page.locator('#patch-message')).to_contain_text('畫面與聲音')
        signal('pa-mic1','vocal');signal('rec-in1','mixed')
        page.keyboard.press('Escape')
        expect(page.locator('#unplug-selected')).to_be_disabled()
        print('PASS Cancellation and incompatible replacement leave every existing connection intact',flush=True)

        fresh();tap('rec-main1');tap('pa-line1');count(8)
        expect(page.locator('#patch-message')).to_contain_text('循環回送')
        signal('pa-line1','music');signal('rec-in1','mixed')
        page.keyboard.press('Escape')
        print('PASS Feedback rejection restores an occupied destination and all original wiring',flush=True)

        fresh();page.locator('#source-mic').uncheck()
        tap('pa-mic1');tap('pa-mic2');count(8)
        page.locator('#source-mic').check()
        signal('pa-mic1','none');signal('pa-mic2','vocal')
        tap('mic1');page.locator('#pa-type').select_option('digital');count(0)
        expect(page.locator('#unplug-selected')).to_be_disabled()
        expect(page.locator('.port.rewiring')).to_have_count(0)
        print('PASS Silent cables can be edited, and equipment changes clear the edit state',flush=True)
        assert not errors,errors

        context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile=context.new_page();mobile.emulate_media(reduced_motion='reduce')
        mobile.goto(BASE+'/sound_class/14.html');mobile.wait_for_load_state('networkidle')
        mobile.locator('#example').tap()
        mobile.locator('[data-board-column="1"]').tap()
        mobile.locator('[data-port="pa-mic1"]').tap()
        expect(mobile.locator('#patch-nav-hint')).to_contain_text('改接')
        mobile.locator('[data-board-column="2"]').tap()
        mobile.locator('[data-port="rec-in1"]').tap()
        expect(mobile.locator('[data-port="rec-in1"]')).to_have_attribute('data-signal','vocal')
        expect(mobile.locator('#cable-count')).to_have_text('7 條')
        mobile.locator('[data-port="rec-in1"]').tap()
        mobile.locator('#unplug-selected').tap()
        expect(mobile.locator('#cable-count')).to_have_text('6 條')
        assert not mobile.evaluate('document.documentElement.scrollWidth>innerWidth')
        print('PASS Phone touch input can reroute across devices and unplug the selected cable',flush=True)
        context.close();browser.close()


if __name__=='__main__':run()
