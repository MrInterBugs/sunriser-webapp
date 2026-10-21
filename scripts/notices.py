# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Aedan Lawrence (original contributions).
# Part of the modern frontend adapted from the SunRiser project and its workflows.
# Upstream: https://github.com/LEDaquaristik/sunriser
# Frontend adaptation (2026); see LICENSING.md and LICENSE.
# Third-party material retains its own terms.

"""Generate/check local notices from the audited distributed materials, offline.
Run from modern/scripts after integration; no dependency install or remote fetch.
"""
import hashlib, html, json, pathlib, re, sys
P=pathlib.Path(__file__).resolve().parents[1]
copy=json.loads((P/'assets/notices-copy.json').read_text())
assert set(copy)=={'en','de'} and copy['en'].keys()==copy['de'].keys(), 'Notice language keys differ'
for key,value in copy['en'].items():
 assert value.strip() and copy['de'][key].strip(), f'Empty notice copy: {key}'
 assert sorted(re.findall(r'\{v\d+\}',value))==sorted(re.findall(r'\{v\d+\}',copy['de'][key])), f'Notice placeholder mismatch: {key}'
def tr(key,tag='p',**values):
 text=copy['en'][key]
 for name,value in values.items():text=text.replace('{'+name+'}',str(value))
 attributes=''.join(' data-'+name+'="'+html.escape(str(value),quote=True)+'"'for name,value in values.items())
 return f'<{tag} data-copy="{key}"{attributes}>{html.escape(text)}</{tag}>'
def section(key,body):
 return f'<section aria-labelledby="{key}"><h2 id="{key}">{tr(key,"span")}</h2>{body}</section>'
def link(url,key):
 return '<a href="'+html.escape(url,quote=True)+'" target="_blank" rel="noopener noreferrer">'+tr(key,'span')+'</a>'
def licence(title,text):
 # Original legal/source documents remain verbatim and carry their own language.
 return '<details>'+title+'<pre lang="en">'+html.escape(text)+'</pre></details>'
sections=[section('project',tr('projectBody'))];sources=[]
for label,package,filename,licence_name in [('Svelte','svelte','LICENSE.md','MIT'),('MessagePack','@msgpack/msgpack','LICENSE','ISC')]:
 root=P/'node_modules'/package;meta=json.loads((root/'package.json').read_text());assert meta['license']==licence_name
 path=root/filename;text=path.read_text();title=f'{label} {meta["version"]}'
 sections.append('<section aria-label="'+html.escape(title)+'"><h2>'+html.escape(title)+'</h2>'+tr('runtime',v0=licence_name)+licence(tr('readLicence','summary',v0=title),text)+'</section>')
 sources.append({'package':package,'version':meta['version'],'license':licence_name,'license_file':str(path.relative_to(P)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
path=P/'LICENSE'
sections.append(section('legacy',tr('legacyBody')+tr('legacyCredit')+link('https://github.com/LEDaquaristik/sunriser','originalProject')+licence(tr('readGpl','summary'),path.read_text())))
sources.append({'material':'SunRiser derived code/configuration','license':'GPL-3.0-only','license_file':'LICENSE','sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
sections.append(section('font',tr('fontBody')+licence(tr('readLicence','summary',v0='Manrope'),(P/'assets/fonts/OFL-Manrope.txt').read_text())))
photo=json.loads((P/'assets/photo/manifest.json').read_text());original=photo['original'];credit=(P/'assets/photo/ATTRIBUTION.txt').read_text();legal=(P/'assets/photo/CC-BY-SA-3.0.txt').read_text()
sections.append('<section id="photography" aria-labelledby="photo"><h2 id="photo">'+tr('photo','span')+'</h2><p>'+html.escape(original['title'])+' — '+html.escape(original['author'])+'. '+link(original['source_page'],'originalPhoto')+' · '+link('https://creativecommons.org/licenses/by-sa/3.0/','photoLicence')+'.</p>'+tr('photoBody')+tr('photoProvenance')+licence(tr('readAttribution','summary'),credit)+licence(tr('readImageLicence','summary'),legal)+'</section>')
sections.append(section('inventory',tr('inventoryBody')+tr('buildBody')))
style='''<style>:root{color-scheme:dark}*{box-sizing:border-box}body{overflow-wrap:anywhere;margin:0;background:#142f29;color:#edf0e4;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;padding:32px 24px;margin:auto}h1{font-size:28px;line-height:1.3}h2{font-size:20px;margin:0 0 12px}p{color:#bdcdbb}a{color:#e4c497;display:inline-block;min-height:44px;padding:8px 0}section{border-top:1px solid #41614f;padding:24px 0}summary{min-height:48px;padding:12px 0;cursor:pointer;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 ui-monospace,monospace;background:#1b3a30;padding:16px;border-radius:6px}.notice-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}.language-choice{display:flex}.language-choice button{border:0;border-bottom:2px solid transparent;background:transparent;color:#bdcdbb;min-width:44px;min-height:44px;padding:10px;font:600 12px/1.4 system-ui,sans-serif}.language-choice button[aria-pressed=true]{color:#e4c497;border-color:#e4c497}.language-choice button:hover{background:#244637;color:#edf0e4}a:focus-visible,summary:focus-visible,button:focus-visible{outline:3px solid #ecd3a5;outline-offset:3px}@media(max-width:500px){main{padding:20px 16px}h1{font-size:25px}}</style>'''
script='''<script>(()=>{const copy=JSON.parse(document.getElementById('notice-copy').textContent),buttons=[...document.querySelectorAll('[data-language]')];function apply(language){if(language!=='de')language='en';document.documentElement.lang=language;for(const node of document.querySelectorAll('[data-copy]')){const value=copy[language][node.dataset.copy].replace(/\\{(v\\d+)\\}/g,(_,key)=>node.dataset[key]??'{'+key+'}');node.textContent=node.tagName==='TITLE'?'SunRiser · '+value:value;}for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.language===language));try{localStorage.setItem('sunriser.language',language);}catch{}}for(const button of buttons)button.addEventListener('click',()=>apply(button.dataset.language));let language='en';try{language=localStorage.getItem('sunriser.language')||'en';}catch{}apply(language);})();</script>'''
page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title data-copy="title">SunRiser · '+html.escape(copy['en']['title'])+'</title>'+style+'</head><body><main><div class="notice-header"><a href="./#help">'+tr('help','span')+'</a><div class="language-choice" role="group" aria-label="Language / Sprache"><button type="button" data-language="en" aria-label="English" aria-pressed="true">EN</button><button type="button" data-language="de" aria-label="Deutsch" aria-pressed="false">DE</button></div></div>'+tr('title','h1')+tr('intro')+''.join(sections)+'</main><script type="application/json" id="notice-copy">'+json.dumps(copy,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+'</script>'+script+'</body></html>'
assert set(re.findall(r'data-copy="([^"]+)"',page))==set(copy['en']), 'Unused notice copy'
page=page.replace(' \n','&#32;\n')
output=P/'public/notices.html'
if '--check' in sys.argv:
 if not output.exists() or output.read_text()!=page:raise SystemExit('Local notices differ from audited licence sources; run python3 scripts/notices.py and review.')
 print('Local notices match audited licence files and bilingual copy.')
else:
 output.parent.mkdir(exist_ok=True);output.write_text(page);print(f'Wrote {output}')
if '--inventory' in sys.argv:print(json.dumps(sources,indent=2))
