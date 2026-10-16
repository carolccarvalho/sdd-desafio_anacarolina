import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const example = 'exemplos/despesas-exemplo.json';

async function runCli(args) {
  return execFileAsync('node', ['src/cli.js', ...args], { cwd: root });
}

test('CLI produz saída JSON válida em caso de sucesso', async () => {
  const directory = await mkdtemp(`${tmpdir()}-reembolso-`);
  const output = `${directory}/resultado.json`;
  try {
    await runCli(['--input', example, '--output', output]);
    const parsed = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(parsed.resumo.total_solicitado, 1765.94);
    assert.match(parsed.processado_em, /Z$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI retorna erro não zero para arquivo inexistente', async () => {
  await assert.rejects(runCli(['--input', 'arquivo-inexistente.json', '--output', 'resultado.json']), error => error.code === 1);
});

test('CLI retorna erro não zero para argumentos ausentes', async () => {
  await assert.rejects(runCli([]), error => error.code === 1 && /Uso:/.test(error.stderr));
});
