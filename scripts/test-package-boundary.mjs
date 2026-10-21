import assert from 'node:assert/strict';
import {PluginMarketGateway} from '../lib/gateway.js';
const gateway=Object.create(PluginMarketGateway.prototype);gateway.config={githubToken:'fake-key'};
const id='owner/repo/tree/'+'a'.repeat(40)+'/packages/feature';
const original=globalThis.fetch;let calls=0,profiles=0,commands=0;
try{
 globalThis.fetch=async()=>{calls++;throw Error('Must not fetch a root manifest for a child')};
 gateway.profileDir=()=>{profiles++;return '/not-used'};
 gateway.runPnpm=async()=>{commands++;throw Error('Unexpected install')};
 assert.equal((await gateway.fetchPackageManifest(id)).status,'unavailable');
 const result=await gateway.install(id);assert.equal(result.ok,false);assert.match(result.detail,/子目录包/);
 assert.equal(calls,0);assert.equal(profiles,0);assert.equal(commands,0);
 for(const name of ['owner/..','../repo','owner/repo/extra','owner/repo?x=1'])assert.equal((await gateway.install(name)).ok,false);
 gateway.loadValidated=()=>{};gateway.validatedCache={'owner/repo':'valid',[id]:'valid'};
 const rows=gateway.filterValid([{full_name:'owner/repo'},{full_name:id},{full_name:id,install_policy:'author_documentation_only'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].full_name,'owner/repo');assert.equal(rows[1].install_policy,'author_documentation_only');
 console.log('Package boundary: no root manifest/installer fallback, no inherited cache attestation; explicit documentation-only listing passed');
}finally{globalThis.fetch=original}
