import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
const filename=`dist/${manifest.name}-${manifest.version}.tgz`;
const code=`import tarfile,pathlib\nr=pathlib.Path.cwd()\nwith tarfile.open(${JSON.stringify(filename)},'w:gz') as t:\n for name in ['package.json','cordis.patch.yml','lib','README.md','LICENSE']:\n  t.add(r/name,arcname='package/'+name)\n`;
const result=spawnSync('python',['-c',code],{stdio:'inherit'});
if(result.status)process.exit(result.status);
console.log(filename);
