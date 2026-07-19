import {spawn} from 'node:child_process';
import {createServer} from 'node:http';

const appPort = 4198;
const verifyPort = 4199;
const channelId = '1234567890';

const verifier = createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    const token = form.get('id_token') ?? '';
    if (request.method !== 'POST' || form.get('client_id') !== channelId || !token.startsWith('e2e-user-')) {
      response.writeHead(400, {'content-type': 'application/json'});
      response.end(JSON.stringify({error: 'invalid_token'}));
      return;
    }
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({
      iss: 'https://access.line.me', aud: channelId,
      exp: Math.floor(Date.now() / 1000) + 600, sub: `U-${token}`,
    }));
  });
});

verifier.listen(verifyPort, '127.0.0.1');

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(appPort)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_TEST_MODE: '1', APP_DATA_STORE: 'memory',
    LINE_LOGIN_CHANNEL_ID: channelId,
    LINE_ID_TOKEN_VERIFY_URL: `http://127.0.0.1:${verifyPort}/verify`,
    SESSION_SIGNING_KEY: 'e2e-session-key-that-is-at-least-thirty-two-characters',
    LINE_USER_ID_ENCRYPTION_KEY: 'e2e-identity-key-that-is-at-least-thirty-two-characters',
  },
});

const shutdown = () => {
  child.kill('SIGTERM');
  verifier.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
child.on('exit', (code) => {
  verifier.close();
  process.exit(code ?? 1);
});
