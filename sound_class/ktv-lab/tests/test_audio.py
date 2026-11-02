"""Listen to the actual Web Audio graph through its output analysers.
These checks do not substitute UI state or a mock audio engine for audible samples.
"""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('KTV_LAB_BASE_URL', 'http://127.0.0.1:8765')


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':1440, 'height':1000})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script('''
          const Context=window.AudioContext;
          window.__outputAnalysers=[];
          window.AudioContext=class extends Context {
            createAnalyser(){const a=super.createAnalyser();window.__outputAnalysers.push(a);return a;}
          };
          window.__micCalls=0;
          if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>{window.__micCalls++;throw new Error('No real mic in this lesson');};
        ''')
        page.goto(BASE+'/sound_class/14.html')
        page.wait_for_load_state('networkidle')
        assert page.evaluate('window.__outputAnalysers.length') == 0, 'No audio context before a user gesture'

        def probe():
            # Average across multiple render quanta and a portion of the syllable envelope.
            page.wait_for_timeout(180)
            return page.evaluate('''async()=>{
              const energy=[0,0];let difference=0;
              for(let frame=0;frame<20;frame++){
                const waves=window.__outputAnalysers.map(a=>{const v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);return v;});
                for(let i=0;i<waves[0].length;i++){
                  energy[0]+=waves[0][i]**2;energy[1]+=waves[1][i]**2;
                  difference+=(waves[0][i]-waves[1][i])**2;
                }
                await new Promise(r=>setTimeout(r,35));
              }
              return {rms:energy.map(e=>Math.sqrt(e/(20*1024))),difference:Math.sqrt(difference/(20*1024))};
            }''')

        def slider(name,value):
            selector=f'[data-control="{name}"]' if name.count('-')>=2 else '#'+name
            page.locator(selector).evaluate('(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.blur();}',str(value))
            page.wait_for_timeout(35)

        def audible():
            result=probe()
            assert max(result['rms'])>.0005, result
            return result

        def silent():
            result=probe()
            assert max(result['rms'])<.00001,result

        page.locator('[data-audio-target="source-vocal"]').click()
        expect(page.locator('#audio-play')).to_have_attribute('aria-pressed','true')
        vocal=audible()
        assert abs(vocal['rms'][0]-vocal['rms'][1])<.0001, vocal
        expect(page.locator('#listen-mode')).to_contain_text('不經接線')
        page.locator('[data-audio-target="source-music"]').click()
        backing=audible()
        assert backing['difference']>.001, backing
        print('PASS Audible vowel lead and distinct stereo backing; source listening is explicitly labeled',flush=True)

        slider('preview-volume',0)
        silent()
        slider('preview-volume',55)
        page.locator('#listen-target').select_option('live')
        silent()  # Unpatched live output stays silent even with active stems.
        page.locator('#example').click()
        audible()
        print('PASS No false audio from an unpatched output; headphone mute silences the actual graph',flush=True)

        page.locator('[data-mode="split"]').click()
        page.locator('#example').click()
        page.locator('#source-music').uncheck()
        audible()
        slider('rec-1-fader',0)
        silent()
        page.locator('#listen-target').select_option('rec-iso1')
        audible()
        page.locator('[data-control="rec-1-arm"]').uncheck()
        expect(page.locator('#listen-target')).to_have_value('live')
        silent()
        print('PASS Fader mutes live while dry ISO remains audible; disabling ARM removes that monitor target',flush=True)

        page.locator('[data-mode="stereo"]').click()
        page.locator('#example').click()
        # Vocal-only routing, with a known simultaneous L/R amplitude ratio.
        page.locator('#listen-target').select_option('live')
        slider('pa-line1-pan',.5)
        levels=audible()['rms']
        assert .45<levels[0]/levels[1]<.55,levels
        slider('pa-master',0)
        silent()
        page.locator('#listen-target').select_option('rec-iso1')
        audible()
        print('PASS Actual output follows PAN proportions and PA master without changing dry ISO',flush=True)

        page.locator('#source-video').uncheck()
        expect(page.locator('#projection')).not_to_have_class('projection on')
        expect(page.locator('#cables [data-kind="video"]')).to_have_count(0)
        audible()
        page.locator('#audio-play').click()
        expect(page.locator('#audio-play')).to_have_attribute('aria-pressed','false')
        silent()
        expect(page.locator('#tiny-lyric')).to_have_text('畫面已關閉')
        print('PASS Video is silent and independent; pause also mutes effect tails',flush=True)

        page.locator('[data-mode="pa"]').click()
        page.locator('#source-music').check()
        page.locator('#source-video').check()
        page.locator('#example').click()
        expect(page.locator('#cables [data-wire="mic1"][data-kind="vocal"]')).to_have_count(1)
        expect(page.locator('#cables [data-wire="pc-l"][data-kind="music"]')).to_have_count(1)
        expect(page.locator('#cables [data-wire="pc-video"][data-kind="video"]')).to_have_count(1)
        for kind in ('vocal','music'):
            expect(page.locator(f'#cables [data-wire="pa-rec-l"][data-kind="{kind}"]')).to_have_count(1)
        assert page.locator('[data-port="rec-in1"] .signal-chip').count()==2
        page.locator('#source-music').uncheck()
        expect(page.locator('#cables [data-wire="pa-rec-l"][data-kind="music"]')).to_have_count(0)
        expect(page.locator('#cables [data-wire="pa-rec-l"][data-kind="vocal"]')).to_have_count(1)
        print('PASS Colored lines and readable source badges follow content before and after mixing/muting',flush=True)

        for width in (390,768,1440):
            page.set_viewport_size({'width':width,'height':844})
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
        page.emulate_media(reduced_motion='reduce')
        page.locator('[data-audio-target="source-vocal"]').click()
        audible()  # Reduced visual motion must not disable audio.
        page.locator('#soundcheck').scroll_into_view_if_needed()
        expect(page.locator('#audio-dock')).to_be_visible()
        page.locator('#dock-pause').click()
        expect(page.locator('#audio-dock')).to_be_hidden()
        assert page.evaluate('window.__micCalls')==0
        assert not errors,errors
        print('PASS Responsive controls, reduced motion and no microphone requests; no JS errors',flush=True)
        browser.close()


if __name__=='__main__':
    run()
