// Always creates a fresh, disposable cluster. No URL, PGHOST or existing DB is accepted.
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const base = process.env.PG_BINDIR;
if (!base) throw new Error('Set PG_BINDIR to the directory containing initdb, pg_ctl and psql.');
const dir = mkdtempSync(join(tmpdir(), 'doprava-crud-db-'));
const data = join(dir, 'data');
const socket = join(dir, 'socket');
mkdirSync(socket);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
function run(binary, args) {
  const result = spawnSync(join(base, binary), args, { env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${binary}: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
let started = false;
try {
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '--encoding=UTF8']);
  run('pg_ctl', ['-D', data, '-l', join(dir, 'server.log'), '-o', `-c listen_addresses='' -c unix_socket_directories='${socket}' -p 55439`, '-w', 'start']);
  started = true;
  for (const file of ['tests/db/baseline.sql', 'supabase/manual/admin-crud.sql', 'supabase/manual/carrier-lifecycle.sql', 'tests/db/acceptance.sql']) {
    const output = run('psql', ['-X', '-h', socket, '-p', '55439', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', resolve(file)]);
    console.log(`${file}: PASS`);
    if (file.endsWith('acceptance.sql')) console.log(output.slice(-220));
  }
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  rmSync(dir, { recursive: true, force: true });
}
