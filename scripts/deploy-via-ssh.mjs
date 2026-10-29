#!/usr/bin/env node
/**
 * Deploy madilik to VPS via SSH (password auth)
 * Run: node scripts/deploy-via-ssh.mjs
 */
import { Client } from 'ssh2';

const config = {
  host: process.env.MADILIK_VPS_HOST || '',
  port: 22,
  username: 'root',
  password: process.env.MADILIK_DEPLOY_PASSWORD || '',
};

const commands = `
cd /var/www/madilik && \
echo '=== Fetching and resetting to latest ===' && \
git fetch origin && \
git reset --hard origin/main && \
echo '=== Adding Google OAuth env vars if missing ===' && \
grep -q 'GOOGLE_CLIENT_ID' .env || echo '
# Google OAuth
GOOGLE_CLIENT_ID=<set-in-env>
GOOGLE_CLIENT_SECRET=<set-in-env>
' >> .env && \
echo '=== Installing dependencies ===' && \
npm install && \
echo '=== Running Prisma DB push ===' && \
npx prisma db push --skip-generate --accept-data-loss && \
npx prisma generate && \
echo '=== Building ===' && \
npm run build && \
echo '=== Restarting PM2 ===' && \
pm2 restart madilik --update-env && \
echo '=== Done ===' && \
pm2 status madilik
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(commands, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      process.exit(1);
    }
    stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
    stream.on('close', (code, signal) => {
      conn.end();
      process.exit(code ?? 0);
    }).on('data', (data) => process.stdout.write(data.toString()));
  });
}).on('error', (err) => {
  console.error('SSH error:', err.message);
  process.exit(1);
}).connect(config);
