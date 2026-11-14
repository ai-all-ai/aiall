import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/cli.js');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aiall-packs-'));
const run=(root,...args)=>spawnSync(process.execPath,[cli,...args,'--path',root],{encoding:'utf8'});
const cleanup=root=>fs.rmSync(root,{recursive:true,force:true});
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
const config=root=>JSON.parse(read(root,'.ai/aiall.json'));

// Install a pack the way npm does: node_modules/<name>/aiall-pack.json.
function installPack(root,name,data){
  const dir=path.join(root,'node_modules',name);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'aiall-pack.json'),typeof data==='string'?data:JSON.stringify(data));
  // Directive docs are project files; create them so the link check passes.
  for(const d of (Array.isArray(data?.directives)?data.directives:[])){
    const doc=path.join(root,d.doc);
    if(fs.existsSync(doc)) continue;
    fs.mkdirSync(path.dirname(doc),{recursive:true});
    fs.writeFileSync(doc,'# '+d.title+'\n');
  }
}
const goodPack=(summary='Read first.')=>({
  name:'good-pack',version:'1.0.0',title:'Good pack',
  directives:[{id:'good.one',title:'One',summary,doc:'docs/one.md'}]
});

test('a malformed pack manifest stops packs add before any file is written',()=>{
  const root=temp();try{
    assert.equal(run(root,'init').status,0);
    const allBefore=read(root,'ALL.md'), configBefore=read(root,'.ai/aiall.json');
    installPack(root,'bad-pack',{name:'bad-pack'});
    const result=run(root,'packs','add','bad-pack');
    assert.equal(result.status,1);
    assert.match(result.stderr,/Invalid pack bad-pack/);
    assert.equal(read(root,'ALL.md'),allBefore);
    assert.equal(read(root,'.ai/aiall.json'),configBefore);
  }finally{cleanup(root);}
});

test('a pack that is not installed is reported and nothing is written',()=>{
  const root=temp();try{
    run(root,'init');
    const configBefore=read(root,'.ai/aiall.json');
    const result=run(root,'packs','add','missing-pack');
    assert.equal(result.status,1);
    assert.match(result.stderr,/Pack not installed: missing-pack/);
    assert.equal(read(root,'.ai/aiall.json'),configBefore);
  }finally{cleanup(root);}
});

test('packs add then remove updates config and the managed block, and keeps user text',()=>{
  const root=temp();try{
    run(root,'init');
    fs.appendFileSync(path.join(root,'ALL.md'),'\n## Project values\n\nKEEP ME\n');
    installPack(root,'good-pack',goodPack());
    assert.equal(run(root,'packs','add','good-pack').status,0);
    assert.deepEqual(config(root).packs,['aiall-core','good-pack']);
    assert.ok(read(root,'ALL.md').includes('### good-pack 1.0.0'));

    assert.equal(run(root,'packs','remove','good-pack').status,0);
    assert.deepEqual(config(root).packs,['aiall-core']);
    const all=read(root,'ALL.md');
    assert.ok(!all.includes('good-pack'),'removed pack must leave the block');
    assert.ok(all.includes('KEEP ME'),'user text must survive');
    assert.equal(run(root,'check').status,0);
  }finally{cleanup(root);}
});

test('aiall-core cannot be removed',()=>{
  const root=temp();try{
    run(root,'init');
    const result=run(root,'packs','remove','aiall-core');
    assert.equal(result.status,1);
    assert.match(result.stderr,/aiall-core cannot be removed/);
    assert.deepEqual(config(root).packs,['aiall-core']);
  }finally{cleanup(root);}
});

test('packs add and remove with --dry-run write nothing',()=>{
  const root=temp();try{
    run(root,'init');
    installPack(root,'good-pack',goodPack());
    const allBefore=read(root,'ALL.md'), configBefore=read(root,'.ai/aiall.json');
    const add=spawnSync(process.execPath,[cli,'packs','add','good-pack','--path',root,'--dry-run','--json'],{encoding:'utf8'});
    assert.equal(add.status,0,add.stderr);
    assert.equal(JSON.parse(add.stdout).ok,true);
    assert.equal(read(root,'ALL.md'),allBefore);
    assert.equal(read(root,'.ai/aiall.json'),configBefore);
  }finally{cleanup(root);}
});

test('check reports a packs block that is out of date after a pack changes',()=>{
  const root=temp();try{
    run(root,'init');
    installPack(root,'good-pack',goodPack('Read first.'));
    assert.equal(run(root,'packs','add','good-pack').status,0);
    assert.equal(run(root,'check').status,0);

    installPack(root,'good-pack',goodPack('Changed summary.'));
    const result=run(root,'check');
    assert.equal(result.status,1);
    assert.match(result.stdout,/packs block is out of date/);

    assert.equal(run(root,'sync').status,0);
    assert.equal(run(root,'check').status,0);
  }finally{cleanup(root);}
});
