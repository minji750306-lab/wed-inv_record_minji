import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { publicInvitation, cacheSeconds, serializeInvitation } from '../lib/public-invitation.js';

const original = {groom:'A',bride:'B',editKey:'secret',inviteCode:'secret-code',_code:'secret-code',code:'secret-code',msg:'</script><script>alert(1)</script>',deleteDate:'2099-01-01'};
assert.equal(publicInvitation(original).editKey, undefined);
assert.equal(original.editKey, 'secret');
assert.equal(serializeInvitation(original).includes('</script>'), false);
assert.equal(cacheSeconds({}, Date.now()), 60);
assert.equal(cacheSeconds({deleteDate:'2000-01-01'}), 0);
const expiry = Date.parse('2099-01-01T23:59:59+09:00');
assert.equal(cacheSeconds(original, expiry - 5000), 5);

let reads = 0;
const context = vm.createContext({Date, console, fetch: async()=>({json:async()=>({data:original})})});
const helper = new vm.SourceTextModule(fs.readFileSync('lib/public-invitation.js','utf8'), {context});
await helper.link(()=>{}); await helper.evaluate();
const blob = new vm.SyntheticModule(['head'], function(){this.setExport('head',async()=>{reads++;return {url:'https://example.test/inv.json'};});},{context});
const fsModule = new vm.SyntheticModule(['default'], function(){this.setExport('default',fs);},{context});
const pathModule = new vm.SyntheticModule(['default'], function(){this.setExport('default',path);},{context});
context.process = {cwd:()=>process.cwd()};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},send(v){this.body=v;return this;},json(v){this.body=v;return this;}};}
for (const file of ['card','get']) {
  const module = new vm.SourceTextModule(fs.readFileSync(`api/${file}.js`,'utf8'),{context});
  await module.link(spec=> spec.includes('public-invitation')?helper:spec==='@vercel/blob'?blob:spec==='fs'?fsModule:pathModule);
  await module.evaluate();
  const res=response();
  await module.namespace.default({query:{slug:'abc',id:'abc'},headers:{host:'example.test'}},res);
  assert.equal(res.code,200);
  assert.equal(res.headers['Vercel-CDN-Cache-Control'],'public, s-maxage=60');
  assert.equal(JSON.stringify(res.body).includes('secret'),false);
  if(file==='card') {
    const match=res.body.match(/<script id="invitation-data" type="application\/json">(.*?)<\/script>/s);
    assert.ok(match); assert.equal(JSON.parse(match[1]).msg,original.msg);
  }
  original.deleteDate='2000-01-01';
  const expired=response(); await module.namespace.default({query:{slug:'abc',id:'abc'},headers:{host:'example.test'}},expired);
  assert.equal(expired.headers['Vercel-CDN-Cache-Control'],undefined);
  if(file==='get') assert.equal(expired.code,404);
  else assert.equal(expired.body.includes('id="invitation-data"'),false);
  original.deleteDate='2099-01-01';
}
// Exercise the real loader: embedded data must avoid the second API request.
const html=fs.readFileSync('i.html','utf8');
const start=html.indexOf('async function loadData(){');
const end=html.indexOf('loadData().then',start);
let requests=0;
const browser=vm.createContext({URLSearchParams,location:{search:'',pathname:'/abc'},document:{getElementById:()=>({textContent:JSON.stringify(publicInvitation(original))})},fetch:()=>{requests++;throw Error('unexpected request');}});
vm.runInContext('let SLUG=null;'+html.slice(start,end)+';globalThis.result=loadData();',browser);
assert.equal((await browser.result).groom,'A'); assert.equal(requests,0);
console.log('Passed: credential filtering, safe embedding, cache expiry, API/HTML responses, and no duplicate browser fetch.');
