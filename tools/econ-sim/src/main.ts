// Economy simulator (GDD §8). Usage: pnpm --filter @pixel-packs/econ-sim start [--days 90] [--players 2000] [--seed s] [--calendar 50]
import { formatReport } from './report.js';
import { DEFAULT_PARAMS, simulate, type SimParams } from './sim.js';

function parseArgs(argv: readonly string[]): SimParams {
  const params: SimParams = { ...DEFAULT_PARAMS };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`missing value for ${String(flag)}`);
    const int = (): number => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) throw new Error(`${String(flag)} needs an integer ≥ 0`);
      return n;
    };
    if (flag === '--days') params.days = int();
    else if (flag === '--players') params.players = int();
    else if (flag === '--calendar') params.calendarGoldPerDay = int();
    else if (flag === '--seed') params.seed = value;
    else throw new Error(`unknown flag ${String(flag)}`);
  }
  return params;
}

const params = parseArgs(process.argv.slice(2).filter((a) => a !== '--'));
console.log(formatReport(params, simulate(params)));
