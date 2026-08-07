/** Nachmessen: Wie weit reicht jeder Turm ab der Mitte, wenn er am Kern haengt? */
import { apothem } from '../../../../../../../E:/spiele/Desktop/The Tower/src/core/geometry.ts'
import { TOWERS } from '../../../../../../../E:/spiele/Desktop/The Tower/src/data/towers.ts'
import { CORES } from '../../../../../../../E:/spiele/Desktop/The Tower/src/data/cores.ts'
const { TOWERS } = await import(`${base}data/towers.ts`)
const { CORES } = await import(`${base}data/cores.ts`)
const mountBase = apothem(core.sides)
const core = CORES[0]
console.log(`Kern: Reichweite ${core.stats.range}`)
for (const tower of TOWERS) {
console.log(`Kern: Reichweite ${core.stats.range}`)
  const reach = mountBase + apothem(tower.sides) + tower.stats.range
  if (tower.stats.range <= 0) continue
    `${tower.id.padEnd(12)} range ${String(tower.stats.range).padStart(4)}` +
      `  gesamt ${reach.toFixed(0).padStart(4)}` +
    `${tower.id.padEnd(12)} range ${String(tower.stats.range).padStart(4)}` +
      `  gesamt ${reach.toFixed(0).padStart(4)}` +
      `  = ${((reach / core.stats.range) * 100).toFixed(0)}% des Kerns`,
  )
}

