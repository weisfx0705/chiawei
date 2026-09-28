import copy
import importlib.util
import io
import json
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location('tts_server', Path(__file__).resolve().parents[1] / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

def single(model='gemini-3.8-flash-tts'):
    return {'model': model, 'turns': [{'text': '  你好。<short pause>\n今天好嗎？  ', 'style': 'warm and friendly'}],
            'speakers': [{'speaker': '主持人', 'voice': 'Kore'}]}

class ProtocolTests(unittest.TestCase):
    def test_verbatim_transcript_and_metadata_for_both_models(self):
        for model in ('gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'):
            payload = single(model)
            path, body = server.build_request('tts', payload)
            self.assertEqual(path, 'interactions')
            turn = body['input'][0]['content'][0]
            self.assertEqual(turn['text'], payload['turns'][0]['text'])
            self.assertEqual(turn['annotations'], [{'type': 'speech_metadata', 'style': 'warm and friendly'}])
            self.assertEqual(body['generation_config']['speech_config'], [{'voice': 'Kore'}])
            self.assertEqual(body['response_format']['mime_type'], 'audio/wav')
            self.assertFalse(body['store'])

    def test_empty_style_is_not_forced(self):
        payload = single()
        payload['turns'][0]['style'] = ''
        payload['format'] = 'pcm'
        _, body = server.build_request('tts', payload)
        self.assertNotIn('annotations', body['input'][0]['content'][0])
        self.assertEqual(body['response_format']['mime_type'], 'audio/l16')

    def test_each_dialogue_turn_has_its_speaker_and_style(self):
        payload = single()
        payload['speakers'].append({'speaker': '來賓', 'voice': 'Puck'})
        payload['turns'] = [{'speaker': '主持人', 'text': '你來了。', 'style': 'excited'},
                            {'speaker': '來賓', 'text': '<sigh> 對啊。', 'style': 'tired'}]
        _, body = server.build_request('tts', payload)
        speech = body['generation_config']['speech_config']
        self.assertEqual(speech['mode'], 'conversational')
        for actual, expected in zip(body['input'][0]['content'], payload['turns']):
            self.assertEqual(actual['text'], expected['text'])
            self.assertEqual(actual['annotations'][0]['speaker'], expected['speaker'])
            self.assertEqual(actual['annotations'][0]['style'], expected['style'])

    def test_invalid_requests_are_rejected_before_api(self):
        cases = []
        payload = single(); payload['model'] = 'invalid'; cases.append(payload)
        payload = single(); payload['turns'][0]['text'] = ' '; cases.append(payload)
        payload = single(); payload['speakers'] *= 2; cases.append(payload)
        payload = single(); payload['turns'][0]['speaker'] = 'missing'; cases.append(payload)
        payload = single(); payload['turns'][0]['text'] *= 1000; cases.append(payload)
        for payload in cases:
            with self.assertRaises(server.RequestError): server.build_request('tts', payload)

    def test_custom_voice_single_only_and_legacy_compatibility(self):
        payload = single(); payload['speakers'][0]['voice'] = 'voice_example'
        self.assertEqual(server.build_request('tts', payload)[0], 'interactions')
        payload['speakers'].append({'speaker': '來賓', 'voice': 'Puck'})
        with self.assertRaises(server.RequestError): server.build_request('tts', payload)
        payload = single('gemini-3.1-flash-tts-preview')
        self.assertIn(':generateContent', server.build_request('tts', payload)[0])
        payload['speakers'][0]['voice'] = 'voice_example'
        with self.assertRaises(server.RequestError): server.build_request('tts', payload)

    def test_audio_can_appear_after_text_or_in_interactions(self):
        audio = {'data': 'AAAA', 'mime_type': 'audio/l16'}
        self.assertEqual(server.normalize_response('tts', {'output_audio': audio})['audio'], audio)
        self.assertEqual(server.normalize_response('tts', {'outputs': [{'type': 'audio', **audio}]})['audio'], audio)
        rest = {'steps': [{'type': 'model_output', 'content': [{'type': 'text', 'text': 'ignored'}, {'type': 'audio', **audio}]}]}
        self.assertEqual(server.normalize_response('tts', rest)['audio'], audio)
        legacy = {'candidates': [{'content': {'parts': [{'text': 'ignored'}, {'inlineData': {'data': 'AAAA', 'mimeType': 'audio/L16;rate=24000'}}]}}]}
        self.assertEqual(server.normalize_response('tts', legacy)['audio']['data'], 'AAAA')

    def test_voice_library_does_not_return_keys_or_audio(self):
        data = {'voices': [{'id': 'Kore', 'type': 'prebuilt', 'key': 'synthetic-test-only', 'sample_audio': {'data': 'AAAA'}}]}
        voice = server.normalize_response('voices', data)['voices'][0]
        self.assertEqual(voice, {'id': 'Kore', 'type': 'prebuilt'})

    def test_error_body_is_never_echoed(self):
        error = urllib.error.HTTPError('https://example.invalid', 403, 'synthetic-test-only', {}, io.BytesIO(b'synthetic-test-only'))
        output = io.StringIO()
        job = json.dumps({'operation': 'tts', 'payload': single()})
        with patch('sys.stdin', io.StringIO(job)), patch('sys.stdout', output), \
             patch.dict(server.os.environ, {'GEMINI_API_KEY': 'synthetic-test-only'}, clear=True), \
             patch.object(server.urllib.request, 'urlopen', side_effect=error):
            server.api_worker()
        self.assertNotIn('synthetic-test-only', output.getvalue())
        self.assertEqual(json.loads(output.getvalue())['status'], 403)

class LocalHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.thread.join()

    def test_only_allowlisted_static_files_are_served(self):
        with urllib.request.urlopen(self.url + '/') as response:
            self.assertEqual(response.status, 200)
            self.assertIn("connect-src 'self'", response.headers['Content-Security-Policy'])
        for path in ('/server.py', '/.env', '/tests/test_server.py', '/../server.py'):
            with self.assertRaises(urllib.error.HTTPError) as result: urllib.request.urlopen(self.url + path)
            self.assertEqual(result.exception.code, 404)

    def test_cross_origin_requests_cannot_use_worker(self):
        request = urllib.request.Request(self.url + '/api/tts', data=json.dumps(single()).encode(),
            headers={'Content-Type': 'application/json', 'Origin': 'https://example.invalid'})
        with patch.object(server, 'call_worker') as worker:
            with self.assertRaises(urllib.error.HTTPError) as result: urllib.request.urlopen(request)
            self.assertEqual(result.exception.code, 403)
            worker.assert_not_called()

    def test_valid_local_request_calls_worker(self):
        request = urllib.request.Request(self.url + '/api/tts', data=json.dumps(single()).encode(),
            headers={'Content-Type': 'application/json', 'Origin': self.url})
        with patch.object(server, 'call_worker', return_value={'status': 200, 'audio': {'data': 'AAAA', 'mime_type': 'audio/l16'}}) as worker:
            with urllib.request.urlopen(request) as response: self.assertIn('audio', json.load(response))
            worker.assert_called_once()

    def test_pages_origin_can_connect_with_preflight(self):
        request = urllib.request.Request(self.url + '/api/tts', method='OPTIONS', headers={
            'Origin': server.PAGES_ORIGIN, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type', 'Access-Control-Request-Private-Network': 'true'})
        with urllib.request.urlopen(request) as response:
            self.assertEqual(response.status, 204)
            self.assertEqual(response.headers['Access-Control-Allow-Origin'], server.PAGES_ORIGIN)
            self.assertEqual(response.headers['Access-Control-Allow-Private-Network'], 'true')
        request = urllib.request.Request(self.url + '/api/tts', data=json.dumps(single()).encode(),
            headers={'Content-Type': 'application/json', 'Origin': server.PAGES_ORIGIN, 'Sec-Fetch-Site': 'cross-site'})
        with patch.object(server, 'call_worker', return_value={'status': 200, 'audio': {'data': 'AAAA', 'mime_type': 'audio/l16'}}) as worker:
            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.headers['Access-Control-Allow-Origin'], server.PAGES_ORIGIN)
                self.assertIn('audio', json.load(response))
            worker.assert_called_once()

    def test_pages_cors_does_not_allow_other_origins(self):
        request = urllib.request.Request(self.url + '/api/tts', method='OPTIONS', headers={
            'Origin': 'https://example.invalid', 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'})
        with self.assertRaises(urllib.error.HTTPError) as result: urllib.request.urlopen(request)
        self.assertEqual(result.exception.code, 403)

if __name__ == '__main__':
    unittest.main()
