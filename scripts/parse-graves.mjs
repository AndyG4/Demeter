import fs from 'node:fs';
import vm from 'node:vm';

const file = fs.readdirSync('_tmp').find((x) => x.startsWith('avd-path---index'));
const code = fs.readFileSync(`_tmp/${file}`, 'utf8');
let captured = null;
const sandbox = {
  webpackJsonp: (ids, modules) => {
    for (const [id, fn] of Object.entries(modules)) {
      if (typeof fn === 'function') {
        const module = { exports: {} };
        fn(module, module.exports);
        if (module.exports?.data?.allMxstatesJson) captured = module.exports.data.allMxstatesJson;
      }
    }
  },
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { timeout: 5000 });
if (!captured) throw new Error('no data');
const states = captured.edges.map((e) => e.node);
console.log('states', states.length);
console.log(JSON.stringify(states[0], null, 1).slice(0, 2000));
fs.writeFileSync('_tmp/avd-states.json', JSON.stringify(states, null, 1));

const totals = states.reduce((a, s) => a + (s.fosas_total || 0), 0);
console.log('fosas total', totals);
console.log('keys', Object.keys(states[0]));
for (const s of states.slice(0, 3)) {
  console.log(s.state_name, s.state_code, s.fosas_total, s.cuerpos_total, s.yearlyFosasData?.length, s.municipios?.length);
}
