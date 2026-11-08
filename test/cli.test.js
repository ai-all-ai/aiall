import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {run as coreRun} from '../src/core.js';

const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/cli.js');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'aiall-test-'));
function run(root,...args){return spawnSync(process.execPath,[cli,...args,'--path',root],{encoding:'utf8'});}
function jsonRun(root,...args){
  const result=run(root,...args,'--json');
  assert.equal(result.stderr,'');
  return {...result,data:JSON.parse(result.stdout)};
}
function cleanup(root){fs.rmSync(root,{recursive:true,force:true});}

test('init creates complete base and check succeeds',()=>{
  const root=temp();try{
    const init=run(root,'init');assert.equal(init.status,0,init.stderr);
    for(const file of ['ALL.md','AGENTS.md','CLAUDE.md','GEMINI.md','.ai/GOVERNANCE.md','.ai/aiall.json'])assert.ok(fs.existsSync(path.join(root,file)),file);
    const result=run(root,'check');assert.equal(result.status,0,result.stdout+result.stderr);
  }finally{cleanup(root);}
});

test('init and sync save explicitly selected agents in configuration',()=>{
  for(const command of ['init','sync']){
    const root=temp();try{
      const result=run(root,command,'--agents','codex,cursor,copilot');
      assert.equal(result.status,0,result.stderr);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'.ai/aiall.json'),'utf8')).agents,['codex','cursor','copilot']);
      assert.ok(fs.existsSync(path.join(root,'AGENTS.md')));
      assert.ok(fs.existsSync(path.join(root,'.cursor/rules/aiall.mdc')));
      assert.ok(fs.existsSync(path.join(root,'.github/copilot-instructions.md')));
      assert.equal(fs.existsSync(path.join(root,'CLAUDE.md')),false);
    }finally{cleanup(root);}
  }
});

test('saved configuration is used by init, sync and check when --agents is omitted',()=>{
  const root=temp();try{
    fs.mkdirSync(path.join(root,'.ai'),{recursive:true});
    fs.writeFileSync(path.join(root,'.ai/aiall.json'),JSON.stringify({schemaVersion:1,agents:['cursor']}));
    let result=run(root,'sync');assert.equal(result.status,0,result.stderr);
    assert.ok(fs.existsSync(path.join(root,'.cursor/rules/aiall.mdc')));
    assert.equal(fs.existsSync(path.join(root,'CLAUDE.md')),false);
    result=run(root,'check');assert.equal(result.status,0,result.stdout+result.stderr);
  }finally{cleanup(root);}
});

test('check --agents is a one-off override and leaves saved configuration unchanged',()=>{
  const root=temp();try{
    run(root,'init','--agents','codex');
    const before=fs.readFileSync(path.join(root,'.ai/aiall.json'),'utf8');
    const result=run(root,'check','--agents','cursor');
    assert.equal(result.status,1);
    assert.match(result.stdout,/Missing: \.cursor\/rules\/aiall\.mdc/);
    assert.equal(fs.readFileSync(path.join(root,'.ai/aiall.json'),'utf8'),before);
  }finally{cleanup(root);}
});

test('removing an agent from configuration never deletes its existing entrypoint',()=>{
  const root=temp();try{
    run(root,'init','--agents','codex,claude');
    const claude=path.join(root,'CLAUDE.md');
    const original=fs.readFileSync(claude,'utf8');
    const result=run(root,'sync','--agents','codex');
    assert.equal(result.status,0,result.stderr);
    assert.equal(fs.existsSync(claude),true);
    assert.equal(fs.readFileSync(claude,'utf8'),original);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'.ai/aiall.json'),'utf8')).agents,['codex']);
  }finally{cleanup(root);}
});

test('init and sync never overwrite user instructions',()=>{
  const root=temp();try{
    run(root,'init');fs.writeFileSync(path.join(root,'ALL.md'),'CUSTOM CONTENT');
    fs.writeFileSync(path.join(root,'AGENTS.md'),'CUSTOM AGENT');
    const result=run(root,'sync');assert.equal(result.status,0,result.stderr);
    assert.equal(fs.readFileSync(path.join(root,'ALL.md'),'utf8'),'CUSTOM CONTENT');
    assert.equal(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'),'CUSTOM AGENT');
  }finally{cleanup(root);}
});

test('--dry-run previews config changes without writing files or changing configuration',()=>{
  const root=temp();try{
    let result=run(root,'init','--agents','codex,cursor','--dry-run');
    assert.equal(result.status,0,result.stderr);assert.equal(fs.readdirSync(root).length,0);
    fs.mkdirSync(path.join(root,'.ai'),{recursive:true});
    const config=path.join(root,'.ai/aiall.json');
    fs.writeFileSync(config,JSON.stringify({schemaVersion:1,agents:['codex']}));
    const before=fs.readFileSync(config,'utf8');
    result=run(root,'sync','--agents','cursor','--dry-run');
    assert.equal(result.status,0,result.stderr);
    assert.equal(fs.readFileSync(config,'utf8'),before);
    assert.equal(fs.existsSync(path.join(root,'.cursor')),false);
    assert.match(result.stdout,/would-update: \.ai\/aiall\.json/);
  }finally{cleanup(root);}
});

test('existing configuration is updated atomically for explicit --agents',()=>{
  const root=temp();try{
    run(root,'init','--agents','codex');
    const result=run(root,'sync','--agents','cursor');
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'.ai/aiall.json'),'utf8')).agents,['cursor']);
    assert.ok(fs.existsSync(path.join(root,'.cursor/rules/aiall.mdc')));
    assert.equal(fs.existsSync(path.join(root,'AGENTS.md')),true);
  }finally{cleanup(root);}
});

test('a late write failure rolls back new files and preserves an existing config',async()=>{
  const root=temp(),second=temp();
  assert.equal(run(second,'init','--agents','codex').status,0);
  const configPath=path.join(second,'.ai/aiall.json');
  const configBefore=fs.readFileSync(configPath,'utf8');
  const original=fs.writeFileSync;
  const patched=mock.method(fs,'writeFileSync',function(file,...args){
    if(String(file).endsWith(path.join('.ai','rules','security.md'))||
      String(file).endsWith(path.join('.cursor','rules','aiall.mdc'))){
      const error=Error('simulated disk write failure');error.code='EIO';throw error;
    }
    return original.call(this,file,...args);
  });
  try{
    await assert.rejects(coreRun(['init','--path',root]),/simulated disk write failure/);
    assert.deepEqual(fs.readdirSync(root),[]);
    await assert.rejects(coreRun(['sync','--agents','claude,cursor','--path',second]),/simulated disk write failure/);
    assert.equal(fs.existsSync(path.join(second,'CLAUDE.md')),false);
    assert.equal(fs.readFileSync(configPath,'utf8'),configBefore);
    assert.equal(fs.existsSync(path.join(second,'.cursor')),false);
  }finally{patched.mock.restore();cleanup(root);cleanup(second);}
});

test('invalid, damaged and unsupported configuration is reported without writes',()=>{
  const invalid=[
    ['not-json','Cannot read'],
    ['[]','expected a JSON object'],
    ['{"agents":"codex"}','agents must be an array'],
    ['{"agents":["unknown"]}','agents must be an array'],
    ['{"agents":["__proto__"]}','agents must be an array'],
    ['{"schemaVersion":2,"agents":["codex"]}','schemaVersion must be 1'],
    ['{"agents":["codex","codex"]}','duplicate agents']
  ];
  for(const [contents,message] of invalid){
    const root=temp();try{
      fs.mkdirSync(path.join(root,'.ai'),{recursive:true});
      fs.writeFileSync(path.join(root,'.ai/aiall.json'),contents);
      const result=jsonRun(root,'sync');
      assert.equal(result.status,1);
      assert.equal(result.data.ok,false);
      assert.equal(result.data.code,1);
      assert.match(result.data.errors[0],new RegExp(message));
      assert.deepEqual(fs.readdirSync(root),['.ai']);
    }finally{cleanup(root);}
  }
});

test('invalid command-line agent lists return structured JSON errors',()=>{
  const root=temp();try{
    for(const value of ['','codex,','codex,unknown','codex,codex','__proto__']){
      const result=jsonRun(root,'init','--agents',value);
      assert.equal(result.status,1);
      assert.equal(result.data.ok,false);
      assert.equal(result.data.code,1);
      assert.equal(result.data.errors.length,1);
      assert.deepEqual(fs.readdirSync(root),[]);
    }
  }finally{cleanup(root);}
});

test('symlink targets are refused before writes and external files remain untouched',()=>{
  const root=temp(),outside=temp();try{
    fs.writeFileSync(path.join(outside,'sentinel'),'untouched');
    fs.symlinkSync(outside,path.join(root,'.cursor'),process.platform==='win32'?'junction':'dir');
    const result=jsonRun(root,'init','--agents','cursor');
    assert.equal(result.status,1);
    assert.match(result.data.errors[0],/Refusing symlink/);
    assert.equal(fs.existsSync(path.join(root,'ALL.md')),false);
    assert.equal(fs.readFileSync(path.join(outside,'sentinel'),'utf8'),'untouched');
  }finally{cleanup(root);cleanup(outside);}
});

test('symlinked config paths and external ALL.md links are never followed',()=>{
  const root=temp(),outside=temp(),linksRoot=temp();try{
    fs.writeFileSync(path.join(outside,'aiall.json'),JSON.stringify({schemaVersion:1,agents:['codex']}));
    fs.symlinkSync(outside,path.join(root,'.ai'),process.platform==='win32'?'junction':'dir');
    let result=jsonRun(root,'sync');
    assert.equal(result.status,1);assert.match(result.data.errors[0],/Refusing symlink/);
    assert.equal(fs.readFileSync(path.join(outside,'aiall.json'),'utf8'),JSON.stringify({schemaVersion:1,agents:['codex']}));
    fs.writeFileSync(path.join(linksRoot,'ALL.md'),'[outside](../outside-secret.md)\n');
    result=jsonRun(linksRoot,'check','--agents','codex');
    assert.equal(result.status,1);
    assert.ok(result.data.issues.some(issue=>issue.startsWith('Unsafe or invalid ALL.md link:')));
    assert.equal(fs.existsSync(path.join(outside,'outside-secret.md')),false);
  }finally{cleanup(root);cleanup(outside);cleanup(linksRoot);}
});

test('detect distinguishes installation, project entrypoints and explicit selection',()=>{
  const root=temp();try{
    fs.writeFileSync(path.join(root,'AGENTS.md'),'shared instruction file');
    fs.mkdirSync(path.join(root,'.ai'),{recursive:true});
    fs.writeFileSync(path.join(root,'.ai/aiall.json'),JSON.stringify({schemaVersion:1,agents:['claude']}));
    const result=spawnSync(process.execPath,[cli,'detect','--path',root,'--json'],{encoding:'utf8',env:{...process.env,PATH:''}});
    assert.equal(result.status,0,result.stderr);
    const agents=JSON.parse(result.stdout).results;
    const codex=agents.find(agent=>agent.name==='codex');
    const claude=agents.find(agent=>agent.name==='claude');
    assert.equal(codex.installed,false);
    assert.deepEqual(codex.projectFiles,['AGENTS.md']);
    assert.equal(codex.selected,false);
    assert.equal(claude.installed,false);
    assert.deepEqual(claude.projectFiles,[]);
    assert.equal(claude.selected,true);
  }finally{cleanup(root);}
});

test('JSON responses use one shape and emit no human-readable stdout on errors or warnings',()=>{
  const root=temp();try{
    const bad=jsonRun(root,'check');
    assert.equal(bad.status,1);
    assert.deepEqual(Object.keys(bad.data),['ok','command','code','errors','warnings','results','issues']);
    assert.equal(bad.data.command,'check');
    assert.ok(bad.data.issues.length>0);
    const parseError=run(root,'init','--agents','unknown','--json');
    assert.equal(parseError.status,1);
    assert.equal(parseError.stderr,'');
    const parsed=JSON.parse(parseError.stdout);
    assert.deepEqual(Object.keys(parsed),['ok','command','code','errors','warnings','results','issues']);
    assert.equal(parsed.command,'init');
    run(root,'init');
    fs.writeFileSync(path.join(root,'CLAUDE.md'),'custom');
    const warning=jsonRun(root,'check');
    assert.equal(warning.status,0);
    assert.equal(warning.data.warnings.length,1);
    assert.equal(warning.data.errors.length,0);
  }finally{cleanup(root);}
});

test('check reports missing managed entrypoint and broken ALL.md link',()=>{
  const root=temp();try{
    run(root,'init');fs.rmSync(path.join(root,'CLAUDE.md'));
    fs.appendFileSync(path.join(root,'ALL.md'),'\n[Missing](docs/missing.md)\n');
    const result=run(root,'check');assert.equal(result.status,1);
    assert.match(result.stdout,/Missing: CLAUDE.md/);
    assert.match(result.stdout,/Broken ALL.md link/);
  }finally{cleanup(root);}
});

test('optional adapters and dry-run remain supported',()=>{
  const root=temp();try{
    let result=run(root,'init','--agents','codex,cursor,copilot','--dry-run');assert.equal(result.status,0,result.stderr);
    assert.equal(fs.readdirSync(root).length,0);
    result=run(root,'init','--agents','codex,cursor,copilot');assert.equal(result.status,0,result.stderr);
    assert.ok(fs.existsSync(path.join(root,'.cursor/rules/aiall.mdc')));
    assert.equal(run(root,'check').status,0);
  }finally{cleanup(root);}
});
