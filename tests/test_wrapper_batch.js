import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const wrapperPath = path.join(testDir, '..', 'V2 Wrapper', 'shared', 'WCL_Compat.gs');
const wrapperSource = fs.readFileSync(wrapperPath, 'utf8');

const propertyStore = {};
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Logger: { log() {} },
  Utilities: { sleep() {} },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperties: () => ({ ...propertyStore }),
        setProperty: (key, value) => { propertyStore[key] = value; },
        deleteProperty: (key) => { delete propertyStore[key]; },
      };
    },
  },
};

vm.createContext(context);
vm.runInContext(wrapperSource, context, { filename: wrapperPath });

const capturedQueries = [];
context.wclV2GraphQLQuery_ = (auth, query, variables) => {
  capturedQueries.push({ auth, query, variables });
  const aliases = [...query.matchAll(/table(\d+): table\(/g)].map((match) => `table${match[1]}`);
  const report = {};
  for (const alias of aliases) {
    report[alias] = { data: { marker: capturedQueries.length + ':' + alias } };
  }
  return {
    data: {
      rateLimitData: { limitPerHour: 800, pointsSpentThisHour: 1, pointsResetIn: 3600 },
      reportData: { report },
    },
  };
};

const requests = Array.from({ length: 13 }, (_, index) => ({
  dataType: index % 2 === 0 ? 'summary' : 'buffs',
  options: {
    start: index * 1000,
    end: index * 1000 + 999,
    sourceid: index + 1,
  },
}));

const results = context.wclV2FetchTables_(
  { mode: 'v2', clientId: 'test', clientSecret: 'test' },
  'REPORT',
  requests,
);

assert.equal(capturedQueries.length, 2, '13 table requests should use two GraphQL operations');
assert.match(capturedQueries[0].query, /table0: table\(/);
assert.match(capturedQueries[0].query, /table11: table\(/);
assert.doesNotMatch(capturedQueries[0].query, /table12: table\(/);
assert.match(capturedQueries[1].query, /table0: table\(/);
assert.equal(capturedQueries[0].variables.sourceID0, 1);
assert.equal(capturedQueries[1].variables.sourceID0, 13);
assert.equal(results.length, requests.length);
assert.equal(results[0].marker, '1:table0');
assert.equal(results[12].marker, '2:table0');

assert.equal(context.wclGetRetryAfterMs_('30'), 30000);
propertyStore.WCL_V2_COOLDOWN_UNTIL_MS = String(Date.now() + 30000);
context.wclCachedProperties_ = null;
assert.throws(
  () => context.wclCheckV2Cooldown_(),
  /cooldown is active/,
);
propertyStore.WCL_V2_COOLDOWN_UNTIL_MS = String(Date.now() - 1000);
context.wclCachedProperties_ = null;
context.wclCheckV2Cooldown_();
assert.equal(propertyStore.WCL_V2_COOLDOWN_UNTIL_MS, undefined);

console.log('Wrapper batch tests passed.');
