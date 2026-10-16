const esbuild=require('esbuild');
Promise.all(['app','content','background'].map(name=>esbuild.build({entryPoints:[`src/${name}.js`],bundle:true,platform:'browser',format:name==='background'?'esm':'iife',outfile:`extension/${name}.js`}))).catch(e=>{console.error(e);process.exit(1);});
