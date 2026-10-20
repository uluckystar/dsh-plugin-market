import assert from 'node:assert/strict';
import { PluginMarketGateway } from '../lib/gateway.js';
const gateway=Object.create(PluginMarketGateway.prototype);gateway.config={githubToken:'test-token'};
const original=globalThis.fetch;
try {
 let endpoint;
 globalThis.fetch=async(url,options)=>{endpoint=url;assert.equal(options.headers.authorization,'Bearer test-token');return new Response(JSON.stringify({dsh:{bundle:{patch:'cordis.patch.yml'}}}))};
 let result=await gateway.fetchPackageManifest('owner/repo');assert.equal(result.status,'ok');assert.match(endpoint,/api\.github\.com/);
 globalThis.fetch=async()=>new Response('',{status:404});assert.equal((await gateway.fetchPackageManifest('owner/repo')).status,'missing');
 globalThis.fetch=async()=>{throw Error('network unavailable')};assert.equal((await gateway.fetchPackageManifest('owner/repo')).status,'unavailable');
 console.log('Manifest fetch: managed token, reachable GitHub API, missing vs unavailable classification passed');
} finally {globalThis.fetch=original;}
