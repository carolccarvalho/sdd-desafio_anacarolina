import fs from 'node:fs/promises';
import { loadInput } from './loader.js';
import { calculate } from './engine.js';

const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const outputIndex = args.indexOf('--output');
if (inputIndex < 0 || outputIndex < 0 || !args[inputIndex + 1] || !args[outputIndex + 1]) { console.error('Uso: node src/cli.js --input <arquivo> --output <arquivo>'); process.exit(1); }
try { const result = calculate(await loadInput(args[inputIndex + 1])); await fs.writeFile(args[outputIndex + 1], `${JSON.stringify(result, null, 2)}\n`); } catch (error) { console.error(error.message); process.exit(1); }
