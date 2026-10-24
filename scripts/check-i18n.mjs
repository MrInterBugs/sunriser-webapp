// SPDX-License-Identifier: GPL-3.0-or-later
// Development check only; ships no runtime dependency or controller request.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {parse} from 'svelte/compiler';
const root=path.resolve(process.argv[2]??path.join(import.meta.dirname,'../src'));
function catalogue(locale){const tree=ts.createSourceFile(locale,fs.readFileSync(`${root}/locales/${locale}.ts`,'utf8'),ts.ScriptTarget.Latest,true),result={};function walk(n){if(ts.isPropertyAssignment(n)&&ts.isStringLiteral(n.name)&&ts.isStringLiteral(n.initializer)){if(n.name.text in result)throw Error(`Duplicate ${locale} key: ${n.name.text}`);result[n.name.text]=n.initializer.text;}ts.forEachChild(n,walk);}walk(tree);return result;}
const en=catalogue('en'),de=catalogue('de'),errors=[];
const exemptionsPath=path.join(root,'locales/exemptions.json');
const exemptions=fs.existsSync(exemptionsPath)?JSON.parse(fs.readFileSync(exemptionsPath,'utf8')):{};
const usedExemptions=new Set();
for(const [key,entry] of Object.entries(exemptions.identical??{})){
 if(!entry.reason?.trim()||entry.text!==en[key]||en[key]!==de[key])errors.push(`Invalid or stale identical exemption: ${key}`);
}
const normalized=value=>value?.replace(/\s+/g,' ').trim();
for(const [key,value] of Object.entries(en))if(normalized(value)===normalized(de[key])&&!exemptions.identical?.[key])errors.push(`Untranslated catalogue entry: ${key}`);

if(JSON.stringify(Object.keys(en).sort())!==JSON.stringify(Object.keys(de).sort()))errors.push('English/German key sets differ');
const placeholders=s=>[...s.matchAll(/\{(v\d+)\}/g)].map(m=>m[1]).sort().join(',');
for(const[key,value]of Object.entries(en)){if(!value.trim())errors.push(`Missing English: ${key}`);if(!de[key]?.trim())errors.push(`Missing German: ${key}`);else if(placeholders(value)!==placeholders(de[key]))errors.push(`Placeholder mismatch: ${key}`);}
const files=fs.readdirSync(root,{recursive:true}).filter(f=>/\.(svelte|ts)$/.test(f)&&!f.startsWith('locales/'));
const source=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const key of Object.keys(en))if(!source.includes(key)&&!key.startsWith('startup.'))errors.push(`Unused key: ${key}`);
// All fixed prose in markup/accessible attributes must use the catalogue.
// Protocol units, branding, licence and navigation glyphs are deliberately stable.
const preserved=new Set(["s","T","aquaLUMix AFRICAN-SUN","aquaLUMix AMAZON-GROW","aquaLUMix DEEP-BLUE","spotBEAM","http://192.0.2.42:8080","Language / Sprache","English","Deutsch","EN","DE","°C"]);
const technical=/^(?:SunRiser|LEDaquaristik|UTC|BEE|JSON|CH|CC BY-SA 3\.0|\d+(?:px|%| s| ms| °C)?|[\d\s·:,.%°/(){}+−–—→↗↔×<>#=\-]+)$/;
function prose(text,file){const raw=text.trim();if(exemptions.literals?.[file]?.[raw]?.trim()){usedExemptions.add(file+'\0'+raw);return;}const s=text.replace(/\s+/g,' ').trim();if(/[A-Za-zÀ-ž]/.test(s)&&!technical.test(s)&&!preserved.has(s))errors.push(`Untranslated markup ${file}: ${s}`);}
// Check prose in simple expressions as well as static text. Comparisons, routes,
// CSS values and translated helper arguments are not treated as UI prose.
function expressionProse(node,file){
 if(!node)return;
 if(node.type==='Literal'&&typeof node.value==='string')prose(node.value,file);
 else if(node.type==='ConditionalExpression'){expressionProse(node.consequent,file);expressionProse(node.alternate,file);}
 else if(node.type==='LogicalExpression'||node.type==='BinaryExpression'&&node.operator==='+'){expressionProse(node.left,file);expressionProse(node.right,file);}
 else if(node.type==='TemplateLiteral')for(const q of node.quasis)prose(q.value.cooked??q.value.raw,file);
}
function walk(node,file){
 if(!node||typeof node!=='object')return;
 if(Array.isArray(node)){for(const child of node)walk(child,file);return;}
 if(node.type==='Text')prose(node.data,file);
 if(node.type==='ExpressionTag')expressionProse(node.expression,file);
 if(['ExpressionTag','EachBlock','IfBlock','KeyBlock','AwaitBlock'].includes(node.type)){
  const expression=node.expression??node.test;
  if(expression)script('const value = ('+fs.readFileSync(path.join(root,file),'utf8').slice(expression.start,expression.end)+');',file);
 }
 if(node.type==='CallExpression'&&['$t','source'].includes(node.callee?.name)&&node.arguments?.[0]?.type==='Literal'){
  const key=node.arguments[0].value;if(typeof key==='string'&&!(key in en))errors.push(`Unknown translation key ${file}: ${key}`);
 }
 if(node.type==='Attribute'){
  if(['aria-label','title','placeholder','alt','label','detail','scope','unit'].includes(node.name))for(const v of Array.isArray(node.value)?node.value:node.value&&typeof node.value==='object'?[node.value]:[]){if(v.type==='Text')prose(v.data,file);else if(v.type==='ExpressionTag')expressionProse(v.expression,file);}
  // Inspect key calls without interpreting other attributes as human text.
  for(const v of Array.isArray(node.value)?node.value:node.value&&typeof node.value==='object'?[node.value]:[])if(v.type==='ExpressionTag'){walkCalls(v.expression,file);script('const value = ('+fs.readFileSync(path.join(root,file),'utf8').slice(v.expression.start,v.expression.end)+');',file);}
  return;
 }
 for(const[k,v]of Object.entries(node))if(!['start','end','loc','metadata','parent','value'].includes(k))walk(v,file);
}
function walkCalls(node,file){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&['$t','source'].includes(node.callee?.name)&&node.arguments?.[0]?.type==='Literal'){const key=node.arguments[0].value;if(!(key in en))errors.push(`Unknown translation key ${file}: ${key}`);}for(const[k,v]of Object.entries(node))if(!['loc','start','end','parent'].includes(k)){if(Array.isArray(v))v.forEach(n=>walkCalls(n,file));else if(v&&typeof v==='object')walkCalls(v,file);}}

// Scan scripts too: putting prose in a variable must not bypass the markup gate.
// Only syntax-defined identifiers/paths and reviewed exceptions bypass this scan.
function script(text,file){
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 function visit(node){
  if(ts.isTypeNode(node)||ts.isImportDeclaration(node)||ts.isExportDeclaration(node))return;
  if(ts.isCallExpression(node)&&['source','$t','translate'].includes(node.expression.getText(tree))){
   const index=node.expression.getText(tree)==='translate'?1:0,key=node.arguments[index],values=node.arguments[index+1];
   if(key&&ts.isStringLiteral(key)&&Object.hasOwn(en,key.text)){
    const required=[...en[key.text].matchAll(/\{(v\d+)\}/g)].map(m=>m[1]);
    if(!values&&required.length)errors.push(`Missing message parameters ${file}: ${key.text}`);
    if(values&&ts.isObjectLiteralExpression(values)&&!values.properties.some(ts.isSpreadAssignment)){
     const supplied=values.properties.map(p=>p.name?.getText(tree).replace(/^['"]|['"]$/g,''));
     for(const slot of required)if(!supplied.includes(slot))errors.push(`Missing message parameter ${file}: ${key.text}/${slot}`);
    }
   }
  }

  if(ts.isStringLiteralLike(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)){
   const p=node.parent,value=node.text;
   if(Object.hasOwn(en,value))return;
   const call=ts.isCallExpression(p)?p:undefined;
   const callee=call?.expression.getText(tree);
   if(call&&['source','$t','translate'].includes(callee)){
    const keyIndex=callee==='translate'?1:0;
    if(call.arguments[keyIndex]===node){if(!(value in en))errors.push(`Unknown translation key ${file}: ${value}`);return;}
   }
   const identifier=(ts.isPropertyAssignment(p)&&p.name===node)||ts.isElementAccessExpression(p)&&p.argumentExpression===node||
     ts.isBinaryExpression(p)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken,ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)||
     ts.isCaseClause(p)||ts.isTypeOfExpression(p)||
     ts.isPropertyAssignment(p)&&['key','route','type','group','method','cache','redirect','credentials'].includes(p.name.getText(tree));
   const apiArgument=call&&((/\.(?:querySelector(?:All)?|getElementById|closest|matches|addEventListener|removeEventListener|getAttribute|hasAttribute)$/.test(callee))||
    /\.(?:setAttribute|removeAttribute)$/.test(callee)&&call.arguments[0]===node);
   const technicalValue=/^(?:[./#][\w./#:[\]=\s"'-]+|https?:\/\/\S+|[a-z][\w-]*[#][\w#-]*|(?:application|text)\/[\w.+-]+)$/.test(value);
   if(!identifier&&!apiArgument&&!technicalValue)prose(value,file);
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
}
for(const file of files){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 const data=exemptions.files?.[file];
 if(data){
  if(!data.reason?.trim()||data.sha256!==createHash('sha256').update(text).digest('hex'))errors.push(`Invalid or stale file exemption: ${file}`);
  continue;
 }
 if(file.endsWith('.ts'))script(text,file);
 else {
  const tree=parse(text,{modern:true});
  for(const section of [tree.instance,tree.module])if(section)script(text.slice(section.content.start,section.content.end),file);
  walk(tree.fragment,file);
 }
}
for(const [file,values]of Object.entries(exemptions.literals??{}))for(const [value,reason]of Object.entries(values)){
 if(!reason.trim()||!usedExemptions.has(file+'\0'+value))errors.push(`Invalid or stale literal exemption ${file}: ${value}`);
}
for(const file of Object.keys(exemptions.files??{}))if(!files.includes(file))errors.push(`Stale file exemption: ${file}`);
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exitCode=1;}else console.log(`${Object.keys(en).length} bilingual messages: catalogue, exemptions, scripts, placeholders and markup checks passed.`);
