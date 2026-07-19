import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.next/static');
const sentinels = [
  process.env.LINE_CHANNEL_SECRET,
  process.env.LINE_CHANNEL_ACCESS_TOKEN,
  process.env.LINE_LOGIN_CHANNEL_SECRET,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.LINE_USER_ID_ENCRYPTION_KEY,
  process.env.POSTBACK_SIGNING_KEY,
  process.env.SESSION_SIGNING_KEY,
  process.env.ADMIN_EXPORT_KEY,
].filter((value) => typeof value === 'string' && value.length > 0);

if (sentinels.length < 8) throw new Error('SERVER_SECRET_SENTINELS_NOT_CONFIGURED');

async function files(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  return (await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? files(fullPath) : [fullPath];
  }))).flat();
}

for (const file of await files(root)) {
  const content = await readFile(file, 'utf8');
  for (const sentinel of sentinels) {
    if (content.includes(sentinel)) throw new Error(`SERVER_SECRET_IN_CLIENT_BUNDLE:${path.relative(root, file)}`);
  }
}

console.log(`Client bundle secret scan passed (${sentinels.length} sentinels).`);
