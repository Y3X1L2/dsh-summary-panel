import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = async path => (await readFile(new URL(path,root),'utf8')).replace(/\r\n/g,'\n');
const core = (await source('src/aggregate.js') + '\n' + await source('src/layout.js') + '\n' + await source('src/sidebar.js') + '\n' + await source('src/motion.js')).replace(/^export /gm,'');
const ui = "const ReactDOM=require('react-dom');\n" + await source('src/client.js');
const css = await source('src/panel.css');
await mkdir(new URL('lib/',root),{recursive:true});
await writeFile(new URL('lib/client.js',root),`window.__ModuleLoader__.load({id:'dsh-summary-panel',factory:(require)=>{\nconst React=require('react');\n${core}\nconst PANEL_CSS=${JSON.stringify(css)};\n${ui}\nreturn {apply(ctx){try{return apply(ctx);}catch(error){console.error('dsh-summary-panel activation',error?.stack||error);throw error;}},inject};\n}});\n`);
console.log('Built lib/client.js using host React and public DSH client services.');
