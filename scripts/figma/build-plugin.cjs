const fs=require('node:fs'),path=require('node:path');
const {design,lineSvg,barsSvg,donutSvg}=require('./render-trace.cjs');
const out=path.resolve(__dirname,'../../artifacts/figma/trace-figma-builder');fs.mkdirSync(out,{recursive:true});
function chart(n,t){const svg=({lineChart:lineSvg,bars:barsSvg,donut:donutSvg})[n.kind](n,t);const labels=[];const stripped=svg.replace(/<text\b([^>]*)>(.*?)<\/text>/g,(_,attrs,text)=>{const a={};attrs.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>a[k]=v);labels.push({text:text.replaceAll('&amp;','&'),x:+a.x,y:+a.y,size:+a['font-size']||10,weight:+a['font-weight']||400,color:a.fill,anchor:a['text-anchor']||'start'});return '';}).replace('width="100%"',`width="${n.w||310}"`);return {svg:stripped,labels};}
function expand(n){if(n.kind==='component'){const x=expand(design.component(n.component,n.props));return {...x,role:n.component,props:n.props};}let x={...n};if(n.children)x.children=n.children.map(expand);if(n.background)x.background=expand(n.background);if(['lineChart','bars','donut'].includes(n.kind))x.vector={Light:chart(n,'Light'),Dark:chart(n,'Dark')};return x;}
const data={themes:design.themes,icons:design.icons,screens:design.screens.map(s=>({id:s.id,name:s.name,group:s.group,tree:expand(design.screenTree(s))})),finance:design.financialDefinitions};
fs.writeFileSync(path.join(out,'design-data.json'),JSON.stringify(data,null,2));
fs.writeFileSync(path.join(out,'code.js'),'const TRACE_DESIGN = '+JSON.stringify(data)+';\n'+fs.readFileSync(path.join(__dirname,'native-builder.js'),'utf8'));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({name:'Trace UX Builder',api:'1.0.0',main:'code.js',ui:'ui.html',editorType:['figma'],documentAccess:'dynamic-page',networkAccess:{allowedDomains:['none']}},null,2));
console.log('Packaged native Figma builder for '+data.screens.length+' screens × 2 themes.');
