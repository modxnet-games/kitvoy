import { Client } from 'ssh2';

const cmd = process.argv.slice(2).join(' ');
if (!cmd) {
  console.error('Usage: node scripts/ssh-exec.mjs "<command>"');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err.message);
      conn.end();
      process.exit(1);
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      conn.end();
      process.exit(code ?? 0);
    });
  });
}).on('error', (e) => {
  console.error('SSH error:', e.message);
  process.exit(1);
}).connect({
  host: process.env.MADILIK_VPS_HOST || '',
  port: 22,
  username: 'root',
  password: process.env.MADILIK_DEPLOY_PASSWORD || '',
});
