#!/usr/bin/env python3
"""Local TTS Studio. Credentials exist only in a wrapper-launched API worker."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
WRAPPER = Path.home() / '.local/bin/with-gemini-key'
MODELS = {'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'}
PREBUILT = set('Zephyr Puck Charon Kore Fenrir Leda Orus Aoede Callirrhoe Autonoe Enceladus Iapetus Umbriel Algieba Despina Erinome Algenib Rasalgethi Laomedeia Achernar Alnilam Schedar Gacrux Pulcherrima Achird Zubenelgenubi Vindemiatrix Sadachbia Sadaltager Sulafat'.split())
BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/'
MAX_BODY = 1024 * 1024
API_SLOTS = threading.BoundedSemaphore(3)
PAGES_URL = 'https://weisfx0705.github.io/chiawei/TTS/index.html'
PAGES_ORIGIN = 'https://weisfx0705.github.io'
ERRORS = {
    400: 'Google 未接受請求，請確認模型、語音 ID 與內容格式。',
    401: 'Google 憑證無效，請在本機確認 Gemini Keychain 設定。',
    403: '目前專案無法使用此模型，請確認 API 權限、地區與計費設定。',
    404: '模型或語音不存在，請確認目前專案的可用模型與語音。',
    429: 'Google 配額或速率已達上限，請稍後再試或檢查配額。',
    500: 'Google 服務發生錯誤，請稍後再試。',
    502: 'Google 回應格式異常，請稍後再試。',
    503: 'Google 服務暫時忙碌，請稍後再試。',
    504: '請求逾時，請縮短內容或稍後再試。',
}

class RequestError(Exception):
    pass

def string(value, label, limit=12000, empty=False):
    if not isinstance(value, str) or len(value) > limit or (not empty and not value.strip()):
        raise RequestError(f'{label}不可空白或超過 {limit} 字。')
    return value

def build_tts_request(payload):
    model = payload.get('model')
    if model not in MODELS:
        raise RequestError('請選擇支援的 TTS 模型。')
    turns, speakers = payload.get('turns'), payload.get('speakers')
    if not isinstance(turns, list) or not 1 <= len(turns) <= 200:
        raise RequestError('請提供 1 至 200 段台詞。')
    if not isinstance(speakers, list) or not 1 <= len(speakers) <= 2:
        raise RequestError('目前支援 1 或 2 位講者。')
    checked_speakers = []
    names = set()
    for speaker in speakers:
        if not isinstance(speaker, dict): raise RequestError('講者格式無效。')
        name = string(speaker.get('speaker'), '講者名稱', 80)
        voice = string(speaker.get('voice'), '語音 ID', 160)
        if name != name.strip() or name in names:
            raise RequestError('講者名稱必須不同，且前後不可有空白。')
        if not re.fullmatch(r'[A-Za-z0-9_-]+', voice) or voice.startswith('voicekey_'):
            raise RequestError('請選擇預設語音或使用已儲存的 voice_ ID。')
        if len(speakers) == 2 and voice.startswith('voice_'):
            raise RequestError('雙人模式請使用預設語音；自訂 voice_ 語音請以單人逐句生成。')
        if model.endswith('preview') and voice not in PREBUILT:
            raise RequestError('3.1 Preview 只支援原有 30 種預設語音。')
        names.add(name)
        checked_speakers.append({'speaker': name, 'voice': voice})
    checked_turns = []
    for turn in turns:
        if not isinstance(turn, dict): raise RequestError('台詞格式無效。')
        text = string(turn.get('text'), '台詞')
        style = string(turn.get('style', ''), '語氣', 1000, empty=True).strip()
        speaker = turn.get('speaker', checked_speakers[0]['speaker'] if len(speakers) == 1 else None)
        if speaker not in names: raise RequestError('每段台詞都必須對應已設定的講者。')
        checked_turns.append({'text': text, 'style': style, 'speaker': speaker})
    if sum(len(t['text']) + len(t['style']) for t in checked_turns) > 12000:
        raise RequestError('單次請求超過本工具的 12,000 字上限，請分段生成。')
    output_format = payload.get('format', 'wav')
    if output_format not in {'wav', 'pcm'}: raise RequestError('音訊格式無效。')
    if model.startswith('gemini-3.8-'):
        content = []
        for turn in checked_turns:
            metadata = {'type': 'speech_metadata'}
            if len(speakers) == 2: metadata['speaker'] = turn['speaker']
            if turn['style']: metadata['style'] = turn['style']
            item = {'type': 'text', 'text': turn['text']}
            if len(metadata) > 1: item['annotations'] = [metadata]
            content.append(item)
        speech = ([{'voice': checked_speakers[0]['voice']}] if len(speakers) == 1 else
                  {'mode': 'conversational', 'speakers': checked_speakers})
        body = {'model': model, 'input': [{'type': 'user_input', 'content': content}],
                'response_format': {'type': 'audio', 'mime_type': 'audio/l16' if output_format == 'pcm' else 'audio/wav', 'sample_rate': 24000},
                'generation_config': {'speech_config': speech}, 'store': False}
        return 'interactions', body
    # Keep the old preview model as an explicit compatibility option.
    transcript = '\n'.join((f"{t['speaker']}: " if len(speakers) == 2 else '') +
                           (f"[{t['style']}] " if t['style'] else '') + t['text'] for t in checked_turns)
    if len(speakers) == 1:
        speech = {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': checked_speakers[0]['voice']}}}
    else:
        speech = {'multiSpeakerVoiceConfig': {'speakerVoiceConfigs': [
            {'speaker': s['speaker'], 'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': s['voice']}}} for s in checked_speakers]}}
    return f'models/{model}:generateContent', {'contents': [{'parts': [{'text': transcript}]}],
        'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': speech}}

def build_request(operation, payload):
    if not isinstance(payload, dict): raise RequestError('請求格式無效。')
    if operation == 'tts': return build_tts_request(payload)
    if operation == 'chat':
        contents = payload.get('contents')
        if not isinstance(contents, list) or not 1 <= len(contents) <= 40: raise RequestError('對話紀錄過長，請清除後重試。')
        clean = []
        for item in contents:
            if not isinstance(item, dict) or item.get('role') not in {'user', 'model'}: raise RequestError('對話格式無效。')
            parts = item.get('parts')
            if not isinstance(parts, list) or len(parts) != 1 or not isinstance(parts[0], dict): raise RequestError('對話內容無效。')
            clean.append({'role': item['role'], 'parts': [{'text': string(parts[0].get('text'), '對話', 20000)}]})
        temperature = payload.get('temperature', 0.7)
        if not isinstance(temperature, (int, float)) or not 0 <= temperature <= 2: raise RequestError('創意程度無效。')
        return 'models/gemini-3.8-flash:generateContent', {
            'systemInstruction': {'parts': [{'text': string(payload.get('instruction'), '助手指令', 12000)}]},
            'contents': clean, 'generationConfig': {'temperature': temperature, 'maxOutputTokens': 8192}}
    if operation == 'voices':
        query = {'page_size': 100}
        for field in ('language_code', 'search', 'page_token'):
            if payload.get(field): query[field] = string(payload[field], '語音搜尋', 500)
        return 'voices?' + urllib.parse.urlencode(query), None
    raise RequestError('不支援的操作。')

def normalize_response(operation, data):
    if not isinstance(data, dict): raise RequestError('無效的 Google 回應。')
    if operation == 'tts':
        audio = data.get('output_audio')
        if not audio:
            audio = next((p for p in data.get('outputs', []) if p.get('type') == 'audio' and p.get('data')), None)
        if not audio:
            # REST Interactions responses expose synthesized audio in step content.
            blocks = [item for step in data.get('steps', []) for item in step.get('content', [])]
            blocks += [item for output in data.get('outputs', []) for item in output.get('content', [])]
            audio = next((item for item in blocks if item.get('type') == 'audio' and item.get('data')), None)
        if not audio:
            candidates = data.get('candidates') or []
            parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
            audio = next((p.get('inlineData') or p.get('inline_data') for p in parts if p.get('inlineData') or p.get('inline_data')), None)
        if not isinstance(audio, dict) or not audio.get('data'): raise RequestError('Google 未回傳音訊，請縮短內容後重試。')
        return {'audio': {'data': audio['data'], 'mime_type': audio.get('mime_type') or audio.get('mimeType') or 'audio/wav'}}
    if operation == 'chat':
        candidates = data.get('candidates') or []
        parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
        text = ''.join(p.get('text', '') for p in parts if not p.get('thought'))
        if not text: raise RequestError('Google 未回傳文字，請稍後再試。')
        return {'text': text}
    if operation == 'voices':
        # Return only catalog fields; never return stateless voice keys or reference audio.
        fields = ('id', 'display_name', 'language_code', 'gender', 'description', 'type', 'accent', 'pitch')
        voices = [{key: voice[key] for key in fields if key in voice} for voice in data.get('voices', [])
                  if isinstance(voice, dict) and voice.get('id') and not voice['id'].startswith('voicekey_')]
        return {'voices': voices, 'next_page_token': data.get('next_page_token', '')}
    raise RequestError('不支援的回應。')

def api_worker():
    """Only this process receives a credential, injected by with-gemini-key."""
    result = {'status': 502, 'error': ERRORS[502]}
    try:
        job = json.load(sys.stdin)
        operation = job['operation']
        path, body = build_request(operation, job['payload'])
        credential = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        if not credential:
            result = {'status': 401, 'error': ERRORS[401]}
        else:
            request = urllib.request.Request(BASE_URL + path,
                data=json.dumps(body).encode() if body is not None else None,
                headers={'Content-Type': 'application/json', 'x-goog-api-key': credential},
                method='POST' if body is not None else 'GET')
            with urllib.request.urlopen(request, timeout=180) as response:
                data = json.load(response)
            result = {'status': 200, **normalize_response(operation, data)}
    except urllib.error.HTTPError as error:
        retry = error.headers.get('Retry-After', '')
        # Provider error bodies/exception strings can contain credentials; discard them.
        result = {'status': error.code, 'error': ERRORS.get(error.code, 'Google API 請求失敗。')}
        if retry.isdigit(): result['retry_after'] = min(int(retry), 120)
    except (TimeoutError, subprocess.TimeoutExpired):
        result = {'status': 504, 'error': ERRORS[504]}
    except RequestError:
        result = {'status': 502, 'error': 'Google 回應沒有可用的內容，請確認模型與輸入。'}
    except Exception:
        result = {'status': 502, 'error': '無法連線至 Google，請確認網路後重試。'}
    sys.stdout.write(json.dumps(result, ensure_ascii=False))

def call_worker(operation, payload):
    if not WRAPPER.is_file() or not os.access(WRAPPER, os.X_OK):
        return {'status': 503, 'error': '找不到 with-gemini-key，請先設定本機 Gemini Keychain wrapper。'}
    if not API_SLOTS.acquire(blocking=False):
        return {'status': 429, 'error': '本機正在處理其他請求，請稍後再試。', 'retry_after': 2}
    try:
        # Do not inherit ambient API credentials; the wrapper is the only credential source.
        worker_env = {k: v for k, v in os.environ.items() if k not in {'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY'}}
        process = subprocess.run([str(WRAPPER), sys.executable, str(Path(__file__).resolve()), '--api-worker'],
            input=json.dumps({'operation': operation, 'payload': payload}), capture_output=True,
            text=True, timeout=195, env=worker_env)
        if process.returncode: return {'status': 401, 'error': 'Keychain wrapper 無法取得憑證，請在本機確認設定。'}
        result = json.loads(process.stdout)
        if not isinstance(result, dict) or not isinstance(result.get('status'), int): raise ValueError()
        return result
    except subprocess.TimeoutExpired:
        return {'status': 504, 'error': ERRORS[504]}
    except Exception:
        return {'status': 502, 'error': '本機 API worker 無法完成請求。'}
    finally:
        API_SLOTS.release()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # No request bodies, headers, credentials, or provider responses in logs.

    def send(self, status, body, content_type='application/json; charset=utf-8'):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        try:
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            if self.headers.get('Origin') == PAGES_ORIGIN:
                self.send_header('Access-Control-Allow-Origin', PAGES_ORIGIN)
                self.send_header('Vary', 'Origin')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; media-src 'self' blob:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def trusted(self):
        port = self.server.server_port
        hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        host = self.headers.get('Host')
        origin = self.headers.get('Origin')
        if host not in hosts: return False
        if origin == PAGES_ORIGIN: return True
        return ((not origin or origin == f'http://{host}')
                and self.headers.get('Sec-Fetch-Site', '') not in {'cross-site', 'same-site'})

    def do_OPTIONS(self):
        if not self.trusted() or self.headers.get('Origin') != PAGES_ORIGIN:
            return self.send(403, {'error': '此來源未獲允許。'})
        if self.path not in {'/api/health', '/api/tts', '/api/chat', '/api/voices'}:
            return self.send(404, {'error': '不支援的 API。'})
        requested = {header.strip().lower() for header in self.headers.get('Access-Control-Request-Headers', '').split(',') if header.strip()}
        if requested - {'content-type'} or self.headers.get('Access-Control-Request-Method') not in {'GET', 'POST'}:
            return self.send(403, {'error': '此請求未獲允許。'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', PAGES_ORIGIN)
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '600')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        if not self.trusted(): return self.send(403, {'error': '只接受本機同來源連線。'})
        path = urllib.parse.urlsplit(self.path).path
        if path == '/api/health':
            return self.send(200, {'ready': WRAPPER.is_file() and os.access(WRAPPER, os.X_OK), 'service': 'keychain-wrapper'})
        files = {'/': ('index.html', 'text/html; charset=utf-8'), '/index.html': ('index.html', 'text/html; charset=utf-8'),
                 '/studio.js': ('studio.js', 'text/javascript; charset=utf-8'), '/tts-core.js': ('tts-core.js', 'text/javascript; charset=utf-8')}
        if path not in files: return self.send(404, {'error': '找不到此頁面。'})
        filename, mime = files[path]
        return self.send(200, (ROOT / filename).read_bytes(), mime)

    def do_POST(self):
        if not self.trusted(): return self.send(403, {'error': '只接受本機同來源連線。'})
        operation = {'/api/tts': 'tts', '/api/chat': 'chat', '/api/voices': 'voices'}.get(self.path)
        if not operation: return self.send(404, {'error': '不支援的 API。'})
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self.send(415, {'error': '請使用 JSON 格式。'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY: return self.send(413, {'error': '請求內容過大或空白。'})
            payload = json.loads(self.rfile.read(size))
            build_request(operation, payload)  # Validate before launching a credential worker.
        except (ValueError, UnicodeError, RequestError) as error:
            message = str(error) if isinstance(error, RequestError) else 'JSON 格式無效。'
            return self.send(400, {'error': message})
        result = call_worker(operation, payload)
        status = result.pop('status')
        self.send(status, result)

def main():
    parser = argparse.ArgumentParser(description='Google TTS Studio local server')
    parser.add_argument('--port', type=int, default=None)
    parser.add_argument('--open', action='store_true', help='Open the studio in your browser')
    parser.add_argument('--pages', action='store_true', help='Open GitHub Pages connected to this local service')
    parser.add_argument('--api-worker', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.api_worker: return api_worker()
    try:
        server = ThreadingHTTPServer(('127.0.0.1', 8765 if args.port is None else args.port), Handler)
    except OSError:
        if args.port is not None:
            print('無法使用指定的連接埠，請改用 --port 0 或其他連接埠。', file=sys.stderr)
            return 1
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'TTS Studio: {url}', flush=True)
    if args.open or args.pages:
        import webbrowser
        webbrowser.open(PAGES_URL + f'#port={server.server_port}' if args.pages else url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__':
    sys.exit(main())
