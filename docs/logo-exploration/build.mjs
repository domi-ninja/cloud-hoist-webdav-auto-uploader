// Rebuild the standalone report and editable SVG concepts with node docs/logo-exploration/build.mjs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const concepts = [];
const add = (name, family, bg, ink, accent, note, body) => concepts.push({ name, family, bg, ink, accent, note, body });
const path = (d, fill = 'currentColor') => `<path d="${d}" fill="${fill}"/>`;
const line = (d, color = 'currentColor', width = 12) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const rect = (x,y,w,h,r,fill='currentColor') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle = (x,y,r,fill='currentColor') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
add('Pocket sky','Literal','#20594B','#F7F2DF','#9BE3BE','The original idea, reduced to one silhouette. A cloud grows straight out of the phone.',
rect(84,102,88,108,20)+path('M77 134a30 30 0 0 1-2-60 50 50 0 0 1 96-7 34 34 0 0 1 9 67Z')+line('M128 169V96m-22 22 22-22 22 22','#20594B',13)+rect(112,188,32,6,3,'#20594B'));
add('Photo lift','Literal','#F4E9D7','#213D38','#F26B3B','A photo becomes an upload arrow. My strongest direct replacement: one shape does both jobs.',
rect(61,78,134,123,14)+rect(73,90,110,99,5,'#F4E9D7')+path('M73 174l34-40 24 25 24-28 28 43v15H73Z')+circle(99,113,10,'#F26B3B')+path('M114 129V64H91l37-36 37 36h-23v65Z','#F26B3B'));
add('Spring loaded','Abstract','#DFFF68','#232A1B','#FFFFFF','An upload arrow made from a compressed spring. Automatic, restless, slightly ridiculous.',
line('M78 199h88c35 0 35-42 0-42H92c-35 0-35-42 0-42h68c35 0 35-42 0-42h-32V57',undefined,17)+path('m128 29-31 35h62Z'));
add('The courier','Creature','#FA6C45','#26233A','#FFF1D5','A swallow carrying a photo. Fast and recognisable, even without the usual cloud symbol.',
path('M40 96l65 18 34-67 15 70 60-34-37 66 29 30-52-6-35 39 3-50Z')+path('m122 124 40-2-31 26Z','#FFF1D5')+rect(159,151,34,39,3,'#FFF1D5')+path('m164 182 9-12 7 7 8-10v20h-24Z','#FA6C45')+circle(170,132,4,'#FFF1D5'));
add('Cloud cut','Literal','#357AF5','#FFFFFF','#BBDDFF','A broad cloud with an arrow cut through it. Familiar, but much cleaner at launcher size.',
path('M71 179a43 43 0 0 1-9-85 57 57 0 0 1 110-11 48 48 0 0 1 14 96h-44v-50h25l-39-43-39 43h25v50Z'));
add('Escape hatch','Spatial','#201C31','#E6D9FF','#BEF275','A file slips through a portal. A stranger take on moving something somewhere safe.',
'<ellipse cx="131" cy="125" rx="57" ry="85" transform="rotate(30 131 125)" fill="none" stroke="#E6D9FF" stroke-width="16"/>'+path('m56 153 69-78 69 49-68 78Z','#BEF275')+path('m125 75 0 45 69 4Z','#78A336')+line('M85 190c35 15 69-9 88-42','#E6D9FF',16));
add('Updraft','Abstract','#F6EFE1','#E74E32','#183E39','Three rising ribbons. Bold enough to work as a tiny mark or a large sticker.',
path('M51 190V107l35-35v83l-35 35Zm58 0V72l35-35v118l-35 35Zm58 0v-83l35-35v83l-35 35Z'));
add('Orbit archive','Spatial','#142F4D','#FFF0D1','#FFAA51','A photo on a transfer orbit. More space programme than backup utility.',
'<ellipse cx="128" cy="128" rx="94" ry="44" transform="rotate(-35 128 128)" fill="none" stroke="#FFAA51" stroke-width="10"/>'+rect(83,75,90,108,10)+rect(94,86,68,70,3,'#142F4D')+circle(142,103,8,'#FFAA51')+path('m94 148 21-29 18 19 13-12 16 22v8H94Z','#FFAA51')+circle(201,75,13));
add('Folder fox','Creature','#F3B652','#6E3028','#FFF2D8','A fox face folded into a folder. Friendly enough to build an identity around.',
path('M56 69l61 28 29-13h54l-8 91-64 36-64-36Z')+path('m56 69 61 28-44 29Zm144 0-63 29 46 28Z')+path('m68 132 60 34 60-34-10 36-50 31-50-31Z','#FFF2D8')+path('m113 163 30 0-15 17Z')+circle(93,132,6,'#FFF2D8')+circle(163,132,6,'#FFF2D8'));
add('Paper kite','Spatial','#BCE5EC','#164F63','#F46D49','A photograph folded into a kite. Light, optimistic, and deliberately less technical.',
line('M132 133c-53 32 41 41-20 77','#164F63',6)+path('m52 108 109-67 38 122-67-30Z')+path('m52 108 109-67-29 92Z','#F46D49')+path('m161 41 38 122-67-30Z','#FFF5D9')+path('m102 170 23 1-7 21Z','#F46D49'));
add('Homeward','Literal','#F5F0E7','#2E5F50','#DCA050','Your files coming home. A roof, an arrow, and a server shelf share the same geometry.',
path('M48 113 128 43l80 70-17 19-63-55-63 55Z')+rect(72,127,112,72,10)+rect(87,143,82,11,3,'#F5F0E7')+rect(87,172,52,11,3,'#F5F0E7')+circle(162,178,6,'#DCA050'));
add('Beam me up','Creature','#35365E','#EDE3FF','#AAEEB2','A tiny UFO abducts your photos. Probably the most fun direction here.',
path('m103 113-43 88h136l-43-88Z','#AAEEB2')+path('M91 94a37 37 0 0 1 74 0Z')+'<ellipse cx="128" cy="103" rx="77" ry="22" fill="#EDE3FF"/>'+rect(108,144,40,44,4,'#35365E')+path('m114 176 10-13 9 8 9-11v21h-28Z','#AAEEB2')+circle(87,103,5,'#35365E')+circle(128,108,5,'#35365E')+circle(169,103,5,'#35365E'));
add('Continuous','Abstract','#F4486B','#FFF6E5','#61293D','An open loop turns upward. A compact symbol for a job that keeps running.',
line('M166 102v53a43 43 0 1 1-43-43h43',undefined,24)+path('m166 45-39 45h78Z')+rect(154,79,24,54,6));
add('Packet stairs','Abstract','#F4EADB','#2448B5','#EF633B','Files climbing a staircase. Squared, utilitarian, almost an old computer badge.',
rect(55,153,42,42,3)+rect(107,101,42,42,3)+rect(159,49,42,42,3,'#EF633B')+path('M107 195v-42h42v42Zm52 0v-94h42v94Z'));
add('Cloud jelly','Creature','#093E48','#A2E7DB','#FFAC81','A cloud with jellyfish legs. The oddball mascot, built from just a few thick curves.',
path('M53 131a30 30 0 0 1 14-56 34 34 0 0 1 60-13 35 35 0 0 1 65 20 28 28 0 0 1 11 49Z')+line('M79 130v29q0 18-16 27m48-56v54m34-54v36q0 20 14 29m19-65v21q0 14 16 21',undefined,12)+circle(107,107,6,'#093E48')+circle(150,107,6,'#093E48')+line('M120 122q8 7 16 0','#093E48',4));
add('Vault bloom','Abstract','#F2DDE7','#8C3566','#FFB54B','Four files opening like petals around a safe centre. Soft, but still geometric.',
'<g transform="translate(128 128)">'+[0,90,180,270].map(a=>`<path transform="rotate(${a})" d="M-9-9h-55v-44a25 25 0 0 1 50 0Z" fill="currentColor"/>`).join('')+'</g>'+circle(128,128,18,'#FFB54B'));
add('Cloud press','Literal','#F9DE68','#2A302D','#F9DE68','A heavy ink-stamp cloud. An oversized arrow gives it a bit of industrial attitude.',
path('M64 177c-39-4-43-65-7-76-6-46 54-69 78-34 38-23 79 9 67 45 39 19 25 65-12 65h-42v-44h28l-48-53-48 53h28v44Z'));
add('Launch slab','Spatial','#1D5147','#FFF0D6','#FF835B','Keeps the tilted phone from the current logo, with a single chunky arrow launching out of it.',
path('m49 159 89-47 71 45v22l-88 46-72-44Z','#8DBCA9')+path('m49 159 89-47 71 45-88 46Z')+path('m72 159 65-34 49 31-64 34Z','#1D5147')+path('M117 146V88H91l44-45 44 45h-26v58Z','#FF835B'));
add('Pixel weather','Retro','#282A33','#E2E8CF','#89C9A6','A 16-bit cloud and a hot pink file. Charming, blunt, and completely unpolished on purpose.',
path('M48 96h16V80h32V64h48v16h32v16h32v48H48Z')+path('M112 192v-64H96v-16h16V96h16V80h16v16h16v16h16v16h-16v64Z','#282A33')+path('M120 192v-64h-16l32-32 32 32h-16v64Z','#F38BA9')+rect(64,168,24,24,0,'#89C9A6')+rect(176,168,16,16,0,'#89C9A6'));
add('Good elephant','Creature','#CDDDD1','#384E43','#FFF3D5','The backup that remembers. An elephant whose raised trunk doubles as the upload gesture.',
path('M55 177V99q0-41 43-41h39q35 0 35 36v38h15V83h-16l27-31 27 31h-16v61q0 19-19 19h-18v29h-28v-37h-58v37H55Z')+ '<ellipse cx="108" cy="108" rx="27" ry="33" fill="#FFF3D5"/>'+circle(154,102,5,'#FFF3D5'));

await mkdir(new URL('logos/', root), { recursive: true });
const original = await readFile(new URL('../../assets/icon.svg', root), 'utf8');
const svgFor = c => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${c.name}"><title>${c.name}</title><rect width="256" height="256" fill="${c.bg}"/><g color="${c.ink}">${c.body}</g></svg>`;
const data = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
for (const [i,c] of concepts.entries()) {
  c.file = `${String(i+1).padStart(2,'0')}-${c.name.toLowerCase().replaceAll(' ','-')}.svg`;
  c.svg = svgFor(c);
  await writeFile(new URL(`logos/${c.file}`, root), c.svg+'\n');
}
const cards = concepts.map((c,i)=>`<article id="concept-${i+1}" data-family="${c.family}">
<div class="card-head"><a href="#concept-${i+1}">${String(i+1).padStart(2,'0')} / ${c.name}</a><span>${c.family}</span></div>
<div class="stage"><img class="hero" src="${data(c.svg)}" alt="${c.name} logo" width="256" height="256"></div>
<div class="samples" aria-label="Small icon previews"><img src="${data(c.svg)}" width="48" height="48" alt="${c.name} at 48 pixels"><img src="${data(c.svg)}" width="32" height="32" alt="${c.name} at 32 pixels"><img src="${data(c.svg)}" width="24" height="24" alt="${c.name} at 24 pixels"><span>48 / 32 / 24 px</span></div>
<p>${c.note}</p><div class="card-foot"><a download="${c.file}" href="${data(c.svg)}">Download SVG ↗</a><button class="pick" type="button" aria-pressed="false" aria-label="Shortlist ${c.name}">Shortlist +</button></div></article>`).join('\n');
await writeFile(new URL('index.html', root), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f4f0e7"><title>20 logo directions · WebDAV Auto Upload</title>
<style>
:root{color-scheme:light;--paper:#f4f0e7;--ink:#292d29;--line:#c8c9bd;--accent:#275a45}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 'Courier New',monospace}a{color:inherit;text-underline-offset:4px}button,select{font:inherit;color:inherit;background:transparent;border:1px solid var(--line);padding:10px 14px;min-height:44px;border-radius:4px;cursor:pointer}button:hover,a:hover{color:var(--accent)}button[aria-pressed=true]{background:var(--ink);color:var(--paper)}:focus-visible{outline:3px solid #b14520;outline-offset:4px}.skip{position:absolute;left:16px;top:-80px}.skip:focus{top:16px;background:var(--paper);padding:12px;z-index:4}header,main,footer{max-width:1520px;margin:auto;padding:32px}header{border-bottom:1px solid var(--line)}.masthead,.intro,.toolbar,.controls,.card-head,.card-foot,.samples{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.masthead{justify-content:space-between;margin-bottom:32px}.masthead span:last-child{color:#606457}.intro{justify-content:space-between}.intro-copy{max-width:780px}h1,h2,p{font-size:inherit;margin:0}h1{font-weight:bold;letter-spacing:.03em;margin-bottom:16px}header p{max-width:740px}.baseline{display:flex;align-items:center;gap:16px}.baseline img{border-radius:18px}.baseline span{max-width:145px;color:#606457}.recommendations{margin-top:24px;color:#4e554b}.toolbar{justify-content:space-between;margin-bottom:24px}.controls{gap:8px}select{background:var(--paper)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}article{min-width:0;scroll-margin-top:24px;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#faf8f2}.card-head{justify-content:space-between;padding:16px;gap:4px;font-size:13px}.card-head a{font-weight:bold;text-decoration:none}.card-head span{color:#616759}.stage{padding:24px;display:grid;place-items:center;background:#e9e9df;min-height:264px}.hero{width:min(100%,216px);height:auto;aspect-ratio:1;border-radius:23%;box-shadow:0 3px 5px #17251816}.samples{padding:16px;border-bottom:1px solid var(--line);min-height:81px;gap:12px}.samples img{border-radius:23%}.samples span{font-size:11px;color:#616759;margin-left:auto}article p{padding:16px;min-height:124px;font-size:14px}.card-foot{justify-content:space-between;padding:0 16px 16px;gap:8px;font-size:12px}.card-foot a{display:inline-flex;align-items:center;min-height:44px}.card-foot button{padding:8px;font-size:12px}body[data-mask=circle] .hero,body[data-mask=circle] .samples img{border-radius:50%}body[data-mask=square] .hero,body[data-mask=square] .samples img{border-radius:0}body[data-backdrop=dark] .stage{background:#242b29}body[data-backdrop=dark] .samples{background:#242b29}body[data-backdrop=dark] .samples span{color:#d9dfd4}[hidden]{display:none!important}.empty{padding:32px;border:1px solid var(--line)}footer{border-top:1px solid var(--line);color:#606457;font-size:13px}@media(min-width:1800px){header,main,footer{max-width:1800px}.grid{grid-template-columns:repeat(5,minmax(0,1fr))}}@media(max-width:1150px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header,main,footer{padding:24px}.baseline{margin-top:16px}}@media(max-width:540px){.grid{grid-template-columns:1fr}.stage{min-height:280px}article p{min-height:0}header,main,footer{padding:16px}.toolbar{align-items:flex-start}.controls{width:100%}}@media print{.toolbar,.card-foot,.skip{display:none}.grid{grid-template-columns:repeat(3,1fr);gap:12px}article{break-inside:avoid}.stage{min-height:0;padding:12px}.hero{width:120px}header,main,footer{padding:16px}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body data-mask="rounded" data-backdrop="light"><a class="skip" href="#concepts">Skip to logos</a><header><div class="masthead"><span>WEBDAV AUTO UPLOAD / DESIGN STUDY</span><span>20 concepts · October 2026</span></div><div class="intro"><div class="intro-copy"><h1>A little less cloud. A lot more character.</h1><p>Twenty directions for the app icon, from a cleaner phone-and-cloud to an elephant with an upload trunk. Each has a large view and real-size launcher previews.</p></div><div class="baseline"><img src="${data(original)}" width="80" height="80" alt="Current app icon"><span>Current icon<br>Reference / 00</span></div></div><p class="recommendations">My picks: <a href="#concept-2">02 Photo lift</a> for clarity, <a href="#concept-4">04 The courier</a> for identity, <a href="#concept-12">12 Beam me up</a> for fun.</p></header>
<main id="concepts"><div class="toolbar"><div class="controls"><label for="family">Direction</label><select id="family"><option value="all">All 20</option>${[...new Set(concepts.map(c=>c.family))].map(f=>`<option>${f}</option>`).join('')}</select><button id="only-picks" aria-pressed="false">Shortlist (0)</button></div><div class="controls"><label for="mask">Mask</label><select id="mask"><option value="rounded">Rounded</option><option value="circle">Circle</option><option value="square">Square</option></select><button id="backdrop" aria-pressed="false">Dark backdrop</button></div></div><p id="count" role="status" style="margin-bottom:16px">20 concepts</p><div class="grid">${cards}</div><p class="empty" hidden>No logos in this view. Choose another direction or turn off the shortlist filter.</p></main><footer>Editable SVG originals. Concept names are working labels, not proposed app names. The installed app icon has not been changed.</footer>
<script>
const cards = [...document.querySelectorAll('article')];
const family = document.querySelector('#family');
const mask = document.querySelector('#mask');
const only = document.querySelector('#only-picks');
const backdrop = document.querySelector('#backdrop');
const params = new URLSearchParams(location.search);
const chosen = new Set((params.get('picks') || '').split(',').filter(id => cards.some(c => c.id === id)));
family.value = [...family.options].some(o => o.value === params.get('family')) ? params.get('family') : 'all';
mask.value = ['rounded','circle','square'].includes(params.get('mask')) ? params.get('mask') : 'rounded';
only.setAttribute('aria-pressed', String(params.get('shortlist') === '1'));
backdrop.setAttribute('aria-pressed', String(params.get('dark') === '1'));
function update(syncUrl = true) {
 let visible = 0;
 for (const card of cards) {
  const picked = chosen.has(card.id);
  const button = card.querySelector('.pick');
  button.setAttribute('aria-pressed', String(picked));
  button.textContent = picked ? 'Shortlisted ✓' : 'Shortlist +';
  card.hidden = (family.value !== 'all' && card.dataset.family !== family.value) || (only.getAttribute('aria-pressed') === 'true' && !picked);
  if (!card.hidden) visible++;
 }
 document.body.dataset.mask = mask.value;
 document.body.dataset.backdrop = backdrop.getAttribute('aria-pressed') === 'true' ? 'dark' : 'light';
 only.textContent = 'Shortlist (' + chosen.size + ')';
 document.querySelector('#count').textContent = visible + (visible === 1 ? ' concept' : ' concepts');
 document.querySelector('.empty').hidden = visible > 0;
 if (syncUrl) {
  const query = new URLSearchParams({family:family.value,mask:mask.value,shortlist:only.getAttribute('aria-pressed') === 'true' ? '1':'0',dark:backdrop.getAttribute('aria-pressed') === 'true' ? '1':'0',picks:[...chosen].join(',')});
  try { history.replaceState(null, '', '?' + query + location.hash); } catch { /* Some file viewers disallow URL changes. */ }
 }
}
for (const card of cards) card.querySelector('.pick').addEventListener('click', () => { chosen.has(card.id) ? chosen.delete(card.id) : chosen.add(card.id); update(); });
for (const button of [only,backdrop]) button.addEventListener('click', () => { button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')); update(); });
for (const select of [family,mask]) select.addEventListener('change', () => update());
for (const link of document.querySelectorAll('.recommendations a')) link.addEventListener('click', () => { family.value = 'all'; only.setAttribute('aria-pressed','false'); update(); });
update(false);
</script></body></html>`);
console.log(`Wrote ${concepts.length} SVGs and index.html`);
