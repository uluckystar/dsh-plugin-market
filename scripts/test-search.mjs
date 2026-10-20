import assert from 'node:assert/strict';
import {PluginMarketGateway} from '../lib/gateway.js';
const gateway=Object.create(PluginMarketGateway.prototype);gateway.config={marketBaseUrl:'https://mydsh.dev'};
const noise=Array.from({length:220},(_,i)=>({full_name:`noise/repo${i}`,description:'unrelated',topics:[],language:'JS',stargazers_count:1000,forks_count:0,html_url:'https://github.com/noise/repo'}));
const relevant={...noise[0],full_name:'owner/memory',description:'memory knowledge retrieval'};
gateway.installedNames=async()=>new Set();gateway.catalog=async()=>[...noise,relevant];gateway.startValidation=()=>{};gateway.filterValid=x=>x;
const originalFetch=globalThis.fetch,originalTimer=globalThis.setTimeout;
try {
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('unexpected AI request')};
 assert.equal((await gateway.search('memory',false)).local[0].full_name,'owner/memory');assert.equal(calls,0);
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.candidates[0].full_name,'owner/memory');return new Response('data: '+JSON.stringify({choices:[{delta:{content:'{"full_name":"owner/memory"}\n{"full_name":"noise/repo0"}'}}]})+'\n')};
 const result=await gateway.search('memory',true);assert.deepEqual(result.ai.map(x=>x.full_name),['owner/memory']);
 globalThis.setTimeout=(fn,_delay,...args)=>originalTimer(fn,20,...args);
 globalThis.fetch=async(_url,options)=>({ok:true,text:()=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('body timed out'))))});
 const bounded=await gateway.search('memory',true);assert.equal(bounded.local.length,1);assert.equal(bounded.ai.length,0);
 console.log('Market search: local-only requests, relevant candidate selection, hallucination filtering and body timeout passed');
} finally {globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimer;}
