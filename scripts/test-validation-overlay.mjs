import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {PluginMarketGateway} from '../lib/gateway.js';
const root=mkdtempSync(join(tmpdir(),'mydsh-overlay-'));
try {
 const gateway=Object.create(PluginMarketGateway.prototype);
 gateway.validatedDiskPath=join(root,'scheduled.json');gateway.validatedMetadataPath=join(root,'meta.json');gateway.validatedRuntimeDiskPath=join(root,'profile.json');gateway.validating=false;
 writeFileSync(gateway.validatedDiskPath,JSON.stringify({'owner/a':'valid'}));writeFileSync(gateway.validatedMetadataPath,JSON.stringify({'owner/a':{checkedAt:100}}));gateway.loadValidated();
 writeFileSync(gateway.validatedDiskPath,JSON.stringify({'owner/a':'invalid','owner/external':'valid'}));writeFileSync(gateway.validatedMetadataPath,JSON.stringify({'owner/a':{checkedAt:200},'owner/external':{checkedAt:200}}));
 gateway.validatedCache['owner/local']='valid';gateway.saveValidated();
 assert.deepEqual(JSON.parse(readFileSync(gateway.validatedDiskPath)),{'owner/a':'invalid','owner/external':'valid'});
 assert.equal(gateway.validatedCache['owner/a'],'invalid');assert.equal(gateway.validatedCache['owner/external'],'valid');assert.equal(gateway.validatedCache['owner/local'],'valid');
 gateway.validatedCache['owner/a']='skipped';gateway.saveValidated();assert.equal(gateway.validatedCache['owner/a'],'invalid');
 assert.equal(JSON.parse(readFileSync(gateway.validatedRuntimeDiskPath))['owner/local'].status,'valid');
 console.log('Validation overlay: scheduled writes preserved, profile delta merged, network failures do not downgrade known results');
} finally {rmSync(root,{recursive:true,force:true});}
