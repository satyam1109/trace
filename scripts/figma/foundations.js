const createdNodeIds = [], mutatedNodeIds = [];
await Promise.all(['Regular','Medium','Bold','SemiBold'].map(style=>figma.loadFontAsync({family:'Roboto',style})));
// Adapted from the bundled createVariableCollection helper; single-mode palettes
// keep the light/dark screen set editable on the user's Starter plan.
async function createVariableCollection(name, modeNames) {
 const collection=figma.variables.createVariableCollection(name),modeIds={};
 collection.renameMode(collection.modes[0].modeId,modeNames[0]);modeIds[modeNames[0]]=collection.modes[0].modeId;
 for(let i=1;i<modeNames.length;i++)modeIds[modeNames[i]]=collection.addMode(modeNames[i]);
 return {collection,modeIds};
}
function rgb(hex){return {r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255};}
const collections={};for(const name of ['Trace / Primitives','Trace / Light','Trace / Dark','Trace / Metrics']) collections[name]=await createVariableCollection(name,['Value']);
const primitive={},variables={Light:{},Dark:{},Metrics:{}};
function code(v,name){v.setVariableCodeSyntax('WEB',`var(--trace-${name.replaceAll('/','-')})`);v.setVariableCodeSyntax('ANDROID',`trace_${name.replaceAll('/','_')}`);v.setVariableCodeSyntax('iOS',`Trace.${name.replaceAll('/','.')}`);}
function raw(hex){if(primitive[hex])return primitive[hex];const {collection,modeIds}=collections['Trace / Primitives'];const v=figma.variables.createVariable('palette/'+hex.slice(1),collection,'COLOR');v.scopes=[];v.setValueForMode(modeIds.Value,rgb(hex));code(v,'palette/'+hex.slice(1));primitive[hex]=v;return v;}
const palettes={Light:{bg:'#F6F7FB',surface:'#FFFFFF',subtle:'#EEF1F7',ink:'#202638',muted:'#5F6B80',line:'#DFE4EE',navy:'#17233D',onNavy:'#F8FAFC',gold:'#C7A15A',goldInk:'#76551D',goldSoft:'#FFF4DD',danger:'#A54238',dangerSoft:'#F8E7E3',food:'#C7A15A',groceries:'#8F9FC4',travel:'#B1A3C5',bills:'#6F859C',other:'#B8C0CD',accentText:'#17233D'},Dark:{bg:'#0D1526',surface:'#17233D',subtle:'#243653',ink:'#F8FAFC',muted:'#BBC5D5',line:'#3A4A65',navy:'#17233D',onNavy:'#F8FAFC',gold:'#D5B470',goldInk:'#E1C68B',goldSoft:'#3B3328',danger:'#FFB4AB',dangerSoft:'#4B2F33',food:'#D5B470',groceries:'#A5B5DA',travel:'#BEB0D4',bills:'#91A8BF',other:'#8D9AB0',accentText:'#17233D'}};
for(const [theme,colors] of Object.entries(palettes)){const {collection,modeIds}=collections['Trace / '+theme];for(const [name,hex]of Object.entries(colors)){const v=figma.variables.createVariable('color/'+name,collection,'COLOR');v.scopes=['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR'];v.setValueForMode(modeIds.Value,{type:'VARIABLE_ALIAS',id:raw(hex).id});code(v,'color/'+name);variables[theme][name]=v.id;}}
const metrics={};for(const n of [4,8,12,16,20,24,28,32,48]){const v=figma.variables.createVariable('space/'+n,collections['Trace / Metrics'].collection,'FLOAT');v.scopes=['GAP','CORNER_RADIUS','WIDTH_HEIGHT'];v.setValueForMode(collections['Trace / Metrics'].modeIds.Value,n);code(v,'space/'+n);metrics[n]=v.id;}
const styles={};for(const [name,size,style,line]of [['Display',42,'Bold',48],['Amount',32,'Bold',38],['Title',26,'Bold',32],['Heading',18,'Bold',24],['Body',15,'Regular',22],['Body strong',15,'Medium',22],['Caption',12,'Regular',18],['Caption strong',12,'Medium',18],['Micro',10,'Medium',14]]){const s=figma.createTextStyle();s.name='Trace/'+name;s.fontName={family:'Roboto',style};s.fontSize=size;s.lineHeight={unit:'PIXELS',value:line};styles[name]=s.id;}
const shadow=figma.createEffectStyle();shadow.name='Trace/Floating surface';shadow.effects=[{type:'DROP_SHADOW',color:{r:.035,g:.065,b:.13,a:.14},offset:{x:0,y:8},radius:28,spread:0,visible:true,blendMode:'NORMAL'}];
const page=figma.root.children[0];page.name='01 · Light screens';mutatedNodeIds.push(page.id);
const cp=figma.createPage();cp.name='02 · Components';createdNodeIds.push(cp.id);
const dp=figma.createPage();dp.name='03 · Dark screens';createdNodeIds.push(dp.id);
return {createdNodeIds,mutatedNodeIds,pages:{Light:page.id,Components:cp.id,Dark:dp.id},variables,metrics,styles,shadow:shadow.id,collections:Object.fromEntries(Object.entries(collections).map(([k,v])=>[k,{id:v.collection.id,modeId:v.modeIds.Value}])),fontFamily:'Roboto',paletteStrategy:'Single-mode light/dark semantic palettes, aliased to primitives; compatible with Starter',primitiveCount:Object.keys(primitive).length};
