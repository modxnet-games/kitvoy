import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`pm2 logs madilik --lines 100 --nostream`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', data => process.stdout.write(data.toString()));
    stream.stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).on('error', (err) => console.error(err)).connect({
  host: process.env.MADILIK_VPS_HOST || '', port: 22, username: 'root', password: process.env.MADILIK_DEPLOY_PASSWORD || ''
});
