// SPDX-License-Identifier: GPL-3.0-or-later
// Development check only; ships no runtime dependency or controller request.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {parse} from 'svelte/compiler';
const root=path.resolve(process.argv[2]??path.join(import.meta.dirname,'../src'));
function catalogue(locale){const tree=ts.createSourceFile(locale,fs.readFileSync(`${root}/locales/${locale}.ts`,'utf8'),ts.ScriptTarget.Latest,true),result={};function walk(n){if(ts.isPropertyAssignment(n)&&ts.isStringLiteral(n.name)&&ts.isStringLiteral(n.initializer)){if(n.name.text in result)throw Error(`Duplicate ${locale} key: ${n.name.text}`);result[n.name.text]=n.initializer.text;}ts.forEachChild(n,walk);}walk(tree);return result;}
const en=catalogue('en'),de=catalogue('de'),errors=[];
if(JSON.stringify(Object.keys(en).sort())!==JSON.stringify(Object.keys(de).sort()))errors.push('English/German key sets differ');
const placeholders=s=>[...s.matchAll(/\{(v\d+)\}/g)].map(m=>m[1]).sort().join(',');
for(const[key,value]of Object.entries(en)){if(!de[key]?.trim())errors.push(`Missing German: ${key}`);else if(placeholders(value)!==placeholders(de[key]))errors.push(`Placeholder mismatch: ${key}`);}
const files=fs.readdirSync(root,{recursive:true}).filter(f=>/\.(svelte|ts)$/.test(f)&&!f.startsWith('locales/'));
const source=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const key of Object.keys(en))if(!source.includes(key)&&!key.startsWith('startup.'))errors.push(`Unused key: ${key}`);
// All fixed prose in markup/accessible attributes must use the catalogue.
// Protocol units, branding, licence and navigation glyphs are deliberately stable.
const preserved=new Set(["s","T","aquaLUMix AFRICAN-SUN","aquaLUMix AMAZON-GROW","aquaLUMix DEEP-BLUE","spotBEAM","http://192.0.2.42:8080","Language / Sprache","English","Deutsch","EN","DE","°C"]);
const technical=/^(?:SunRiser|LEDaquaristik|UTC|BEE|JSON|CH|CC BY-SA 3\.0|\d+(?:px|%| s| ms| °C)?|[\d\s·:,.%°/(){}+−–—→↗↔×<>#=\-]+)$/;
function prose(text,file){const s=text.replace(/\s+/g,' ').trim();if(/[A-Za-zÀ-ž]/.test(s)&&!technical.test(s)&&!preserved.has(s))errors.push(`Untranslated markup ${file}: ${s}`);}
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
 if(node.type==='CallExpression'&&['$t','source'].includes(node.callee?.name)&&node.arguments?.[0]?.type==='Literal'){
  const key=node.arguments[0].value;if(typeof key==='string'&&!(key in en))errors.push(`Unknown translation key ${file}: ${key}`);
 }
 if(node.type==='Attribute'){
  if(['aria-label','title','placeholder','alt','label','detail','scope','unit'].includes(node.name))for(const v of Array.isArray(node.value)?node.value:node.value&&typeof node.value==='object'?[node.value]:[]){if(v.type==='Text')prose(v.data,file);else if(v.type==='ExpressionTag')expressionProse(v.expression,file);}
  // Inspect key calls without interpreting other attributes as human text.
  for(const v of Array.isArray(node.value)?node.value:node.value&&typeof node.value==='object'?[node.value]:[])if(v.type==='ExpressionTag')walkCalls(v.expression,file);
  return;
 }
 for(const[k,v]of Object.entries(node))if(!['start','end','loc','metadata','parent','value'].includes(k))walk(v,file);
}
function walkCalls(node,file){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&['$t','source'].includes(node.callee?.name)&&node.arguments?.[0]?.type==='Literal'){const key=node.arguments[0].value;if(!(key in en))errors.push(`Unknown translation key ${file}: ${key}`);}for(const[k,v]of Object.entries(node))if(!['loc','start','end','parent'].includes(k)){if(Array.isArray(v))v.forEach(n=>walkCalls(n,file));else if(v&&typeof v==='object')walkCalls(v,file);}}

// Typed field metadata can supply visible labels as well as Svelte markup.
for(const file of files.filter(f=>f.endsWith('.ts'))){
 const tree=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
 function labels(node){if(ts.isPropertyAssignment(node)&&['label','title','help','description'].includes(node.name.getText(tree))&&ts.isStringLiteral(node.initializer))prose(node.initializer.text,file);ts.forEachChild(node,labels);}
 labels(tree);
}
for(const file of files.filter(f=>f.endsWith('.svelte')))walk(parse(fs.readFileSync(path.join(root,file),'utf8'),{modern:true}).fragment,file);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`${Object.keys(en).length} bilingual messages: key, placeholder, usage and static markup checks passed.`);
