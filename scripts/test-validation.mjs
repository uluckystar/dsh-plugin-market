import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'mydsh-validation-'));
try {
  mkdirSync(join(root,'storages'));
  const cached = {'owner/old1':'invalid','owner/old2':'invalid','owner/old3':'invalid'};
  writeFileSync(join(root,'storages/plugin_market_catalog.json'), JSON.stringify({plugins:[{full_name:'owner/new'},...Object.keys(cached).map(full_name=>({full_name}))]}));
  writeFileSync(join(root,'storages/plugin_market_validated_bundle_v1.json'),JSON.stringify(cached));
  const source=readFileSync(new URL('./validate-plugins.mjs',import.meta.url),'utf8').replace("import { ProxyAgent } from 'undici'",'class ProxyAgent {}');
  const program=`globalThis.fetch=async()=>new Response(JSON.stringify({dsh:{bundle:{patch:'./cordis.patch.yml'}}}));\n`+source.replace(/^#!.*\n/,'');
  const out=spawnSync(process.execPath,['--input-type=module'],{input:program,encoding:'utf8',env:{...process.env,DSH_HOME:root,HTTP_PROXY:'',HTTPS_PROXY:'',PLUGIN_MARKET_VALIDATE_MAX_ITEMS:'2',PLUGIN_MARKET_VALIDATE_CONCURRENCY:'1',PLUGIN_MARKET_CATALOG_SOURCE:''}});
  assert.equal(out.status,0,out.stderr);
  const result=JSON.parse(readFileSync(join(root,'storages/plugin_market_validated_bundle_v1.json')));
  assert.equal(Object.values(result).filter(v=>v==='valid').length,2,'daily limit must include invalid rechecks');
  assert.equal(Object.values(result).filter(v=>v==='invalid').length,2);
  console.log('Validation: bounded invalid rechecks and atomic result persistence passed');
} finally {rmSync(root,{recursive:true,force:true});}
