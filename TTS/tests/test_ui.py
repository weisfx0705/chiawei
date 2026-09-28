"""Run pure-static browser checks: python3 tests/test_ui.py.

Static files are loaded in an isolated Pages-origin browser. Google API routes are mocked; this test never calls Google or reads real credentials.
"""
import base64
import io
import json
from pathlib import Path
import sys
import time
import wave

def wav_fixture(value=800, seconds=0.2):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1); output.setsampwidth(2); output.setframerate(24000)
        output.writeframes(value.to_bytes(2, 'little', signed=True) * int(seconds * 24000))
    return base64.b64encode(buffer.getvalue()).decode()

def wait_for_js(page, expression):
    deadline = time.monotonic() + 15
    while not page.evaluate(expression):
        if time.monotonic() > deadline:
            raise AssertionError('UI condition timed out: ' + expression)
        page.wait_for_timeout(50)

def run(url):
    from playwright.sync_api import sync_playwright
    output = Path(__file__).resolve().parents[1] / 'test-results'
    output.mkdir(exist_ok=True)
    calls = []
    errors = []
    state = {'fail': False, 'hold': False, 'held': []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        page.on('pageerror', lambda error: errors.append(str(error)))
        base = 'https://weisfx0705.github.io/chiawei/TTS/'
        root = Path(__file__).resolve().parents[1]
        def static_files(route):
            name = route.request.url.split('/')[-1].split('?')[0]
            name = name or 'index.html'
            if name not in {'index.html', 'studio.js', 'tts-core.js', 'gemini-client.js'}:
                route.abort(); return
            route.fulfill(body=(root / name).read_bytes(), content_type='text/html' if name.endswith('.html') else 'text/javascript')
        page.route(base + '**', static_files)
        local_requests = []
        page.on('request', lambda request: local_requests.append(request.url) if '/api/' in request.url or '127.0.0.1' in request.url or 'localhost' in request.url else None)
        fake_key = 'test-only-not-a-valid-api-key'
        def google_api(route):
            assert route.request.headers.get('x-goog-api-key') == fake_key
            assert 'key=' not in route.request.url
            if '/voices?' in route.request.url:
                assert route.request.method == 'GET'
                route.fulfill(json={'voices': [{'id': 'voice_ui_example', 'display_name': '台灣華語測試', 'language_code': 'zh-TW', 'type': 'prompted'}], 'next_page_token': ''})
                return
            body = route.request.post_data_json
            if 'models/gemini-3.8-flash:generateContent' in route.request.url:
                route.fulfill(json={'candidates': [{'content': {'parts': [{'text': 'Speaker 1: [calm] 你好。\nSpeaker 2: [cheerful] 你好！'}]}}]})
                return
            if '/interactions' in route.request.url:
                turns = []
                for part in body['input'][0]['content']:
                    metadata = next((item for item in part.get('annotations', []) if item['type'] == 'speech_metadata'), {})
                    turns.append({'text': part['text'], 'style': metadata.get('style', ''), **({'speaker': metadata['speaker']} if 'speaker' in metadata else {})})
                speech = body['generation_config']['speech_config']
                speakers = speech if isinstance(speech, list) else speech['speakers']
                payload = {'model': body['model'], 'turns': turns, 'speakers': speakers}
            else:
                payload = {'model': 'gemini-3.1-flash-tts-preview', 'turns': [{'text': body['contents'][0]['parts'][0]['text']}], 'speakers': []}
            calls.append(payload)
            if state['fail']:
                route.fulfill(status=400, json={'error': {'message': 'Do not echo provider messages: ' + fake_key}})
            elif state['hold'] and payload['turns'][0]['text'] == '第二句。':
                state['held'].append(route)
            else:
                value = 3000 if payload['turns'][0]['text'] == '第三句。' else 1000
                route.fulfill(json={'steps': [{'type': 'model_output', 'content': [{'type': 'audio', 'data': wav_fixture(value), 'mime_type': 'audio/wav'}]}]})
        page.route('https://generativelanguage.googleapis.com/v1beta/**', google_api)
        page.goto(base + 'index.html')
        page.wait_for_load_state('networkidle')
        assert page.locator('#apiKeyInput').input_value() == ''
        page.locator('#generateBtn').click()
        assert not calls
        page.locator('#apiKeyInput').fill(fake_key)
        assert page.locator('#apiKeyInput').get_attribute('type') == 'password'
        assert page.locator('#connectionLabel').inner_text() == 'API key 已輸入'
        assert page.locator('#bridgePort').count() == 0
        assert page.locator('#modelSelect').input_value() == 'gemini-3.8-flash-tts'
        assert page.locator('#toneInput').input_value() == ''
        assert page.locator('#apiKeyInput').count() == 1
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.screenshot(path=str(output / 'desktop-single.png'), full_page=True)

        # Exact text, optional style, and a downloadable WAV.
        text = '  你好。<short pause>\n很高興認識你。  '
        page.locator('#singleText').fill(text)
        page.locator('#toneInput').fill('warm and friendly')
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.startsWith('完成')")
        assert calls[-1]['turns'] == [{'text': text, 'style': 'warm and friendly'}]
        with page.expect_download() as event: page.locator('.download-btn').click()
        event.value.save_as(str(output / 'single.wav'))
        with wave.open(str(output / 'single.wav')) as audio:
            assert audio.getframerate() == 24000 and audio.getnchannels() == 1
            assert audio.getnframes() == 4800

        # Failure recovers all controls and reports the failure.
        state['fail'] = True
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.startsWith('生成失敗')")
        assert page.locator('#singleText').is_enabled()
        assert fake_key not in page.locator('#toastContainer').inner_text()
        state['fail'] = False

        # Long input is generated in bounded chunks without losing characters.
        long_text = ('這是一句完整的長文。\n' * 400)
        page.locator('#singleText').fill(long_text)
        start = len(calls)
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.startsWith('完成')")
        assert len(calls) - start > 1
        assert ''.join(call['turns'][0]['text'] for call in calls[start:]) == long_text

        # Voice library and stored custom IDs remain available to single TTS.
        page.locator('#loadVoicesBtn').click()
        wait_for_js(page, "() => [...document.getElementById('voiceSelect').options].some(o => o.value === 'voice_ui_example')")
        page.locator('#customVoice').fill('voice_ui_example')
        page.locator('#singleText').fill('自訂語音測試。')
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.startsWith('完成')")
        assert calls[-1]['speakers'][0]['voice'] == 'voice_ui_example'
        page.locator('#customVoice').fill('')

        # Script import preserves multiline content and translates emotion to metadata.
        page.locator('[data-tab="multi"]').click()
        page.locator('#viewBtnScript').click()
        page.locator('#scriptTextarea').fill('語氣/風格指令:\nNormal Pitched and Natural\ncasual and friendly\n\n主持人: [excited] 歡迎。\n這是第二行。\n來賓: [calm] <laugh> 大家好。')
        page.locator('.script-actions button').click()
        assert page.locator('#multiToneInput').input_value() == 'casual and friendly'
        assert page.locator('.line-text').first.input_value() == '歡迎。\n這是第二行。'
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.startsWith('完成')")
        assert calls[-1]['turns'][0]['style'] == 'casual and friendly, excited'
        assert calls[-1]['turns'][0]['speaker'] == '主持人'
        assert calls[-1]['turns'][1]['text'] == '<laugh> 大家好。'
        assert page.locator('.line-text').first.evaluate('(element) => element.scrollHeight <= element.clientHeight + 2')
        page.evaluate("() => document.getElementById('toastContainer').replaceChildren()")
        page.evaluate('() => window.scrollTo(0, 0)')
        page.screenshot(path=str(output / 'desktop-dialogue.png'), full_page=True)

        # A third speaker fails visibly and leaves the editor's existing script intact.
        page.locator('#viewBtnScript').click()
        page.locator('#scriptTextarea').fill('A: [calm] 一。\nB: [calm] 二。\nC: [calm] 三。')
        page.locator('.script-actions button').click()
        assert page.locator('#scriptView').is_visible()
        assert page.locator('.line-text').first.input_value() == '歡迎。\n這是第二行。'
        page.locator('#scriptTextarea').fill('Speaker 1: 一。\nSpeaker 2: 二。')
        page.locator('.script-actions button').click()
        page.locator('#chatInput').fill('產生一段問候對話')
        page.locator('#chatSendBtn').click()
        page.wait_for_selector('.apply-btn')
        page.locator('.apply-btn').click()
        assert page.locator('.line-text').first.input_value() == '你好。'

        # SRT audio follows entry identity even after deletion and renumbering.
        page.locator('[data-tab="srt"]').click()
        srt = '1\n00:00:00,000 --> 00:00:01,000\n第一句。\n\n2\n00:00:02,000 --> 00:00:03,000\n第二句。\n\n3\n00:00:04,000 --> 00:00:05,000\n第三句。'
        page.locator('#srtPasteArea').fill(srt)
        page.locator('button', has_text='解析 SRT').click()
        start = len(calls)
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.includes('3 成功')")
        assert len(calls) - start == 3
        page.locator('#srt-entry-2 .srt-entry-actions button').click()
        start = len(calls)
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.includes('2 成功')")
        assert len(calls) == start
        with page.expect_download() as event: page.locator('.download-btn').click()
        event.value.save_as(str(output / 'srt.wav'))
        with wave.open(str(output / 'srt.wav')) as audio:
            assert audio.getnframes() == 5 * 24000
            audio.setpos(4 * 24000)
            assert int.from_bytes(audio.readframes(1), 'little', signed=True) == 3000
        page.locator('#srt-entry-1 textarea').fill('第一句已修改。')
        start = len(calls)
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.includes('2 成功')")
        assert len(calls) - start == 1
        page.screenshot(path=str(output / 'desktop-srt.png'), full_page=True)

        # Cancellation preserves completed cues; the next run resumes pending cues only.
        page.locator('#srtContent button', has_text='清除').click()
        page.locator('#srtPasteArea').fill(srt)
        page.locator('button', has_text='解析 SRT').click()
        state['hold'] = True
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.querySelector('#srt-entry-2').classList.contains('generating')")
        page.locator('#cancelBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.includes('已取消') && !document.getElementById('generateBtn').disabled")
        assert '1 成功' in page.locator('#generationStatus').inner_text()
        state['hold'] = False
        for route in state['held']:
            try: route.abort()
            except Exception: pass
        start = len(calls)
        page.locator('#generateBtn').click()
        wait_for_js(page, "() => document.getElementById('generationStatus').textContent.includes('3 成功')")
        assert len(calls) - start == 2

        # Narrow screens can edit SRT and reach the dialogue assistant.
        page.set_viewport_size({'width': 390, 'height': 844})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.evaluate("() => document.getElementById('toastContainer').replaceChildren()")
        page.evaluate('() => window.scrollTo(0, 0)')
        page.screenshot(path=str(output / 'mobile-srt.png'), full_page=True)
        page.locator('[data-tab="multi"]').click()
        assert page.locator('#chatPanel').is_visible()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.screenshot(path=str(output / 'mobile-dialogue.png'), full_page=True)
        assert not local_requests, 'Unexpected local-service request'
        assert page.evaluate("() => localStorage.getItem('gemini_api_key') === null")
        page.reload()
        page.wait_for_load_state('networkidle')
        assert page.locator('#apiKeyInput').input_value() == ''
        assert not errors, errors
        browser.close()
    print('Static UI passed: user API key, direct Google requests, single, dialogue, SRT, voice library, assistant, download, mobile; no local backend requests.')

if __name__ == '__main__':
    run('https://weisfx0705.github.io/chiawei/TTS/index.html')
