import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootOfPackage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readTemplate = name => fs.readFileSync(path.join(rootOfPackage, 'templates', name), 'utf8');
const managed = '<!-- AIALL MANAGED ENTRYPOINT; edit ALL.md instead. -->';
const bridge = 'Before performing this task, open and read `ALL.md` at the repository root. Apply its mandatory rules, then read only the documents and skills whose task triggers match. A Markdown reference is not proof that the file was loaded. If it cannot be read, report that before changing files.';
export const AGENTS = {
  codex: {file:'AGENTS.md', kind:'instruction', content:()=>`${managed}\n# Project instructions\n\n${bridge}\n`},
  claude: {file:'CLAUDE.md', kind:'import', content:()=>`${managed}\n# Project instructions\n\n@ALL.md\n`},
  gemini: {file:'GEMINI.md', kind:'import', content:()=>`${managed}\n# Project instructions\n\n@./ALL.md\n`},
  cursor: {file:'.cursor/rules/aiall.mdc', kind:'instruction', content:()=>`---\ndescription: Project-wide AI-ALL rule routing\nalwaysApply: true\n---\n${managed}\n${bridge}\n`},
  copilot: {file:'.github/copilot-instructions.md', kind:'instruction', content:()=>`${managed}\n# Shared project instructions\n\n${bridge}\n`},
  windsurf: {file:'.windsurf/rules/aiall.md', kind:'instruction', content:()=>`---\ntrigger: always_on\n---\n${managed}\n${bridge}\n`},
  roo: {file:'.roo/rules/aiall.md', kind:'instruction', content:()=>`${managed}\n${bridge}\n`},
  antigravity: {file:'.agents/rules/aiall.md', kind:'import', content:()=>`${managed}\n# Shared rules\n\n@[Project Rules](../../ALL.md)\n`}
};
const defaultAgents=['codex','claude','gemini'];
const cliNames={codex:'codex',claude:'claude',gemini:'gemini'};
const systemTemplates={
  'ALL.md':'ALL.md',
  '.ai/GOVERNANCE.md':'GOVERNANCE.md',
  '.ai/rules/security.md':'security.md',
  '.ai/rules/git.md':'git.md',
  '.ai/rules/coding.md':'coding.md',
  '.ai/rules/testing.md':'testing.md',
  '.ai/workflows/review.md':'review.md',
  '.ai/integrations/registry.md':'integrations.md'
};
const configFile='.ai/aiall.json';
const originalConfigContent=Symbol('originalConfigContent');

function parseAgents(value, label) {
  if(!Array.isArray(value)||value.some(agent=>typeof agent!=='string'||!Object.hasOwn(AGENTS,agent))) {
    throw Error(`${label} must be an array of supported agent names: ${Object.keys(AGENTS).join(', ')}`);
  }
  if(new Set(value).size!==value.length) throw Error(`${label} must not contain duplicate agents`);
  return value;
}

function parse(args){
  let command='help', dir=process.cwd(), agents=null, agentsSpecified=false, json=false, dryRun=false;
  if(args[0]&&!args[0].startsWith('-')) command=args.shift();
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--path'||arg==='-p'){
      if(!args[i+1]||args[i+1].startsWith('-')) throw Error('--path requires a directory');
      dir=path.resolve(args[++i]);
    }
    else if(arg==='--agents'){
      if(args[i+1]===undefined) throw Error('--agents requires a comma-separated list');
      agentsSpecified=true;
      agents=args[++i].split(',').map(a=>a.trim());
      if(agents.length===0||agents.some(a=>!a)) throw Error('--agents requires one or more agent names');
      parseAgents(agents,'--agents');
    }
    else if(arg==='--all-agents'){agentsSpecified=true;agents=Object.keys(AGENTS);}
    else if(arg==='--json') json=true;
    else if(arg==='--dry-run') dryRun=true;
    else if(arg==='--help'||arg==='-h') command='help';
    else if(arg==='--version'||arg==='-v') command='version';
    else throw Error(`Unknown argument: ${arg}`);
  }
  let root;
  try {root=fs.realpathSync(dir);} catch {throw Error(`Directory not found: ${dir}`);}
  if(!fs.statSync(root).isDirectory()) throw Error(`Directory not found: ${dir}`);
  return {command,dir:root,agents,agentsSpecified,json,dryRun};
}

function safePath(root, relative){
  const dest=path.resolve(root,relative);
  if(dest!==root&&!dest.startsWith(root+path.sep)) throw Error(`Path escapes project: ${relative}`);
  let cursor=root;
  for(const part of path.relative(root,dest).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,part);
    let stat;
    try {stat=fs.lstatSync(cursor);}
    catch(error){if(error.code==='ENOENT') continue;throw error;}
    if(stat.isSymbolicLink()) throw Error(`Refusing symlink: ${cursor}`);
    if(cursor!==dest&&!stat.isDirectory()) throw Error(`Path component is not a directory: ${cursor}`);
  }
  return dest;
}

function maybeStat(file){
  try {return fs.lstatSync(file);}
  catch(error){if(error.code==='ENOENT') return null;throw error;}
}

function validateConfig(data){
  if(!data||typeof data!=='object'||Array.isArray(data)) throw Error(`Invalid ${configFile}: expected a JSON object`);
  if(data.schemaVersion!==undefined&&data.schemaVersion!==1) throw Error(`Invalid ${configFile}: schemaVersion must be 1`);
  parseAgents(data.agents,`${configFile} agents`);
  return {...data,schemaVersion:data.schemaVersion??1,agents:[...data.agents]};
}

function readConfig(root){
  const file=safePath(root,configFile);
  if(!maybeStat(file)) return null;
  let raw, data;
  try {
    raw=fs.readFileSync(file,'utf8');
    data=JSON.parse(raw);
  }
  catch(error){throw Error(`Cannot read ${configFile}: ${error.message}`);}
  const parsed=validateConfig(data);
  Object.defineProperty(parsed,originalConfigContent,{value:raw});
  return parsed;
}

function desired(agents){
  const result={};
  for(const [dest,template] of Object.entries(systemTemplates)) result[dest]=readTemplate(template);
  for(const agent of agents) result[AGENTS[agent].file]=AGENTS[agent].content();
  return result;
}

function preparePath(root, name){
  const dest=safePath(root,name);
  const stat=maybeStat(dest);
  if(stat&&!stat.isFile()) throw Error(`Expected a regular file: ${name}`);
  return {dest,exists:!!stat};
}

function preflight(root, files, configUpdate, previousConfigContent){
  const plan=[];
  for(const [name,content] of Object.entries(files)) plan.push({name,content,...preparePath(root,name)});
  if(configUpdate){
    const entry=preparePath(root,configFile);
    plan.push({
      ...entry,
      name:configFile,
      content:JSON.stringify(configUpdate,null,2)+'\n',
      configuration:true,
      previousContent:previousConfigContent
    });
  }
  return plan;
}

function ensureDirectory(root, dir, createdDirs){
  const relative=path.relative(root,dir);
  let cursor=root;
  for(const part of relative.split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,part);
    const stat=maybeStat(cursor);
    if(stat){
      if(stat.isSymbolicLink()) throw Error(`Refusing symlink: ${cursor}`);
      if(!stat.isDirectory()) throw Error(`Path component is not a directory: ${cursor}`);
    }else{
      fs.mkdirSync(cursor);
      createdDirs.push(cursor);
    }
  }
}

function removeCreated(files, dirs){
  const errors=[];
  for(const {file,content} of files.reverse()){
    try {
      const stat=fs.lstatSync(file);
      if(!stat.isFile()||stat.isSymbolicLink()||fs.readFileSync(file,'utf8')!==content){
        errors.push(`left changed file untouched: ${file}`);
      }else fs.unlinkSync(file);
    } catch(error){if(error.code!=='ENOENT') errors.push(`could not remove file ${file}: ${error.message}`);}
  }
  for(const dir of dirs.reverse()){
    try {fs.rmdirSync(dir);} catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTEMPTY') errors.push(`could not remove directory ${dir}: ${error.message}`);}
  }
  return errors;
}

function writeConfig(root, entry, createdFiles, createdDirs){
  const {dest,content,exists}=entry;
  ensureDirectory(root,path.dirname(dest),createdDirs);
  const temp=path.join(path.dirname(dest),`.aiall-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  let tempCreated=false;
  try {
    fs.writeFileSync(temp,content,{flag:'wx'});
    tempCreated=true;
    if(exists){
      safePath(root,configFile);
      const current=maybeStat(dest);
      if(!current||!current.isFile()) throw Error(`${configFile} changed during update`);
      if(fs.readFileSync(dest,'utf8')!==entry.previousContent) throw Error(`${configFile} changed during update`);
      fs.renameSync(temp,dest);
      tempCreated=false;
    }else{
      fs.linkSync(temp,dest);
      createdFiles.push({file:dest,content});
    }
  }finally{
    if(tempCreated){
      try {fs.unlinkSync(temp);} catch(error){if(error.code!=='ENOENT') throw error;}
    }
  }
}

function applyPlan(root, plan){
  const results=[], createdFiles=[], createdDirs=[];
  try{
    for(const entry of plan){
      if(entry.configuration) continue;
      if(entry.exists){results.push({status:'preserved',file:entry.name});continue;}
      const dest=safePath(root,entry.name);
      ensureDirectory(root,path.dirname(dest),createdDirs);
      try {fs.writeFileSync(dest,entry.content,{flag:'wx'});}
      catch(error){if(error.code==='EEXIST'){results.push({status:'preserved',file:entry.name});continue;}throw error;}
      createdFiles.push({file:dest,content:entry.content});
      results.push({status:'created',file:entry.name});
    }
    const configEntry=plan.find(entry=>entry.configuration);
    if(configEntry){
      writeConfig(root,configEntry,createdFiles,createdDirs);
      results.push({status:configEntry.exists?'updated':'created',file:configFile});
    }else results.push({status:'preserved',file:configFile});
    return results;
  }catch(error){
    const rollbackErrors=removeCreated(createdFiles,createdDirs);
    if(rollbackErrors.length) throw Error(`${error.message}; rollback incomplete: ${rollbackErrors.join('; ')}`);
    throw error;
  }
}

function planResults(plan){
  return plan.map(entry=>{
    if(entry.configuration){
      return {status:entry.exists?'would-update':'would-create',file:configFile};
    }
    return {status:entry.exists?'preserved':'would-create',file:entry.name};
  });
}

function detect(root, config){
  return Object.entries(AGENTS).map(([name,agent])=>{
    const file=agent.file;
    const present=!!maybeStat(safePath(root,file));
    const executable=cliNames[name];
    let installed=null, evidence='installation not detectable';
    if(executable){
      const extensions=process.platform==='win32'
        ? (process.env.PATHEXT||'.EXE;.CMD;.BAT;.COM').split(';')
        : [''];
      installed=(process.env.PATH||'').split(path.delimiter).some(dir=>{
        if(!dir) return false;
        return extensions.some(extension=>{
          try {
            const candidate=path.join(dir,executable+extension);
            if(!fs.statSync(candidate).isFile()) return false;
            fs.accessSync(candidate,fs.constants.X_OK);
            return true;
          }
          catch{return false;}
        });
      });
      evidence=installed?`executable found on PATH: ${executable}`:`executable not found on PATH: ${executable}`;
    }
    return {
      name,
      installed,
      installationEvidence:evidence,
      projectFiles:present?[file]:[],
      selected:config?.agents.includes(name)||false
    };
  });
}

function check(root, agents, config){
  const issues=[], warnings=[], results=[];
  const entrypoints=new Set(agents.map(agent=>AGENTS[agent].file));
  for(const [name,expected] of Object.entries(desired(agents))){
    const dest=safePath(root,name), stat=maybeStat(dest);
    if(!stat){issues.push(`Missing: ${name}`);results.push({file:name,status:'missing'});continue;}
    if(!stat.isFile()){issues.push(`Not a regular file: ${name}`);continue;}
    if(entrypoints.has(name)){
      const text=fs.readFileSync(dest,'utf8');
      if(text!==expected){
        if(text.includes(managed)) issues.push(`Managed entrypoint differs: ${name}`);
        else warnings.push(`Existing custom entrypoint: ${name}; verify manually that it loads ALL.md`);
      }
    }
    results.push({file:name,status:'present'});
  }
  const all=safePath(root,'ALL.md'), allStat=maybeStat(all);
  if(allStat?.isFile()){
    const source=fs.readFileSync(all,'utf8');
    const links=[...source.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)].map(match=>match[1]);
    for(const ref of links){
      if(/^(?:https?:|mailto:|#)/i.test(ref)) continue;
      try {
        const decoded=decodeURIComponent(ref);
        const linked=safePath(root,path.join(path.dirname(all),decoded));
        if(!maybeStat(linked)) issues.push(`Broken ALL.md link: ${ref}`);
      }catch(error){issues.push(`Unsafe or invalid ALL.md link: ${ref} (${error.message})`);}
    }
  }
  if(!config) issues.push(`Missing: ${configFile}`);
  return {ok:issues.length===0,issues,warnings,results};
}

function jsonResponse(command, {ok=true,code=0,errors=[],warnings=[],results=[],issues=[]}={}){
  return {ok,command,code,errors,warnings,results,issues};
}

function emitJson(response){
  console.log(JSON.stringify(response,null,2));
  process.exitCode=response.code;
}

function usage(){
  return `AI-ALL — shared agent instructions

Usage: aiall <command> [--path DIR] [--agents codex,claude,...] [--dry-run] [--json]

Commands:
  init     Create ALL.md, project rules and native entrypoints (no overwrite)
  detect   Show installation, project-file and configured-selection evidence
  sync     Add missing entrypoints/files only; preserve existing
  check    Validate required files, managed entrypoints and ALL.md links
  doctor   check plus detection evidence
  upgrade  Explain safe package upgrade process
  --version

Supported adapters: ${Object.keys(AGENTS).join(', ')}
`;
}

export async function run(raw){
  const json=raw.includes('--json');
  let command=raw.find(arg=>!arg.startsWith('-'))||'help';
  try{
    const opts=parse([...raw]);
    command=opts.command;
    const {dir,agents:specifiedAgents,agentsSpecified,dryRun}=opts;
    if(command==='version'){
      const version=JSON.parse(fs.readFileSync(path.join(rootOfPackage,'package.json'),'utf8')).version;
      if(json) emitJson(jsonResponse(command,{results:[{version}]}));
      else console.log(version);
      return;
    }
    if(command==='help'){
      if(json) emitJson(jsonResponse(command,{results:[{usage:usage()}]}));
      else console.log(usage());
      return;
    }
    const savedConfig=readConfig(dir);
    const agents=agentsSpecified?specifiedAgents:(savedConfig?.agents||defaultAgents);
    if(command==='detect'){
      const results=detect(dir,savedConfig);
      if(json) emitJson(jsonResponse(command,{results}));
      else console.log(JSON.stringify(results,null,2));
      return;
    }
    if(command==='upgrade'){
      const message='Upgrade package with your package manager, then run `aiall sync --dry-run`, `aiall sync`, and `aiall check`. Existing project rules are never overwritten automatically.';
      if(json) emitJson(jsonResponse(command,{results:[{message}]}));
      else console.log(message);
      return;
    }
    if(command==='init'||command==='sync'){
      const files=desired(agents);
      const updateConfig=agentsSpecified||!savedConfig;
      const configValue=updateConfig?{...(savedConfig||{}),schemaVersion:1,agents}:null;
      const plan=preflight(dir,files,configValue,savedConfig?.[originalConfigContent]);
      let results;
      if(dryRun){
        results=planResults(plan);
        if(!updateConfig) results.push({status:'preserved',file:configFile});
      }else results=applyPlan(dir,plan);
      if(json) emitJson(jsonResponse(command,{results}));
      else results.forEach(result=>console.log(`${result.status}: ${result.file}`));
      return;
    }
    if(command==='check'||command==='doctor'){
      const result=check(dir,agents,savedConfig);
      if(command==='doctor') result.detected=detect(dir,savedConfig);
      const jsonResults=command==='doctor'?{files:result.results,detected:result.detected}:result.results;
      if(json) emitJson(jsonResponse(command,{ok:result.ok,code:result.ok?0:1,warnings:result.warnings,results:jsonResults,issues:result.issues}));
      else console.log(JSON.stringify(result,null,2));
      if(!result.ok) process.exitCode=1;
      return;
    }
    throw Error(`Unknown command: ${command}`);
  }catch(error){
    if(json) emitJson(jsonResponse(command,{ok:false,code:1,errors:[error.message]}));
    else throw error;
  }
}
