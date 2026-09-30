import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const temp = await mkdtemp(join(tmpdir(), 'rf-design-'));
const root = resolve('.');
const bookingApiSource = await readFile(
  join(root, 'src/extensions/site/widgets/rental-flow-online-booking/booking-widget-api.ts'),
  'utf8',
);
const bookingPanelSource = await readFile(
  join(root, 'src/extensions/site/widgets/rental-flow-online-booking/rental-flow-online-booking.panel.tsx'),
  'utf8',
);
assert(!bookingApiSource.includes('rentalflow-network-ping'));
assert(!bookingApiSource.includes('authPing'));
assert(!bookingPanelSource.includes('public-booking-debug'));
await assert.rejects(
  access(join(root, 'src/pages/api/public-booking-debug.ts')),
  (error) => error?.code === 'ENOENT',
);
await assert.rejects(
  access(join(root, 'src/pages/api/rentalflow-network-ping.ts')),
  (error) => error?.code === 'ENOENT',
);
const mock = `export const httpClient={fetchWithAuth:(...args)=>fetch(...args)}; export const i18n={getLanguage:()=>window.testLanguage||'fr',getLocale:()=>window.testLanguage==='en'?'en-CA':'fr-CA'};`;
const plugins = [{name:'test-wix',setup(b){b.onResolve({filter:/^@wix\/essentials$/},()=>({path:'wix',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js'}));b.onResolve({filter:/\.css\?inline$/},args=>({path:resolve(args.resolveDir,args.path.slice(0,-7)),namespace:'inline'}));b.onLoad({filter:/.*/,namespace:'inline'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}];
await build({stdin:{contents:`import Widget from './src/extensions/site/widgets/rental-flow-online-booking/rental-flow-online-booking.navigation.runtime';customElements.define('test-booking',Widget);`,resolveDir:root},bundle:true,format:'esm',outfile:join(temp,'widget.js'),plugins,define:{'import.meta.env.BASE_API_URL':'""'}});
await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Appearance from './src/extensions/dashboard/pages/settings/booking-appearance';function App(){const [value,setValue]=useState();return <Appearance value={value} onChange={v=>{window.savedTheme=v;setValue(v)}}/>}createRoot(document.getElementById('appearance')).render(<App/>);`,resolveDir:root,loader:'tsx'},bundle:true,format:'esm',jsx:'automatic',outfile:join(temp,'appearance.js'),plugins});
await build({entryPoints:['src/lib/booking-theme.ts'],bundle:true,format:'esm',outfile:join(temp,'theme.mjs')});
const {normalizeBookingTheme,DEFAULT_BOOKING_THEME,bookingThemeVariables,contrastRatio,BOOKING_PALETTES,bookingImageUrl}=await import(pathToFileURL(join(temp,'theme.mjs')).href);
assert.deepEqual(normalizeBookingTheme('{bad'),DEFAULT_BOOKING_THEME);
assert.equal(normalizeBookingTheme({primary:'red;display:none'}).primary,DEFAULT_BOOKING_THEME.primary);
assert.equal(bookingImageUrl('javascript:alert(1)'),'');
assert.equal(bookingImageUrl('wix:image://v1/abc.jpg/file.jpg#originWidth=1'),'https://static.wixstatic.com/media/abc.jpg');
for(const {colors} of BOOKING_PALETTES){const v=bookingThemeVariables(colors);assert(contrastRatio(v['--rf-on-primary'],v['--rf'])>=4.5);assert(contrastRatio(v['--rf-text'],v['--rf-surface'])>=4.5);}
const settings={currency:'CAD',taxesEnabled:true,tax1Name:'TPS',tax1Rate:5,tax2Name:'TVQ',tax2Rate:9.975,tax2Compound:false,paymentsEnabled:true,depositEnabled:true,depositType:'PERCENT',depositValue:25,requiredFields:[],theme:DEFAULT_BOOKING_THEME};
const assets=[{id:'a1',title:'Caméra cinéma',productType:'Vidéo',categoryId:'cat-video',categoryName:'Vidéo',catalogTagsJson:'["cinema"]',dailyRateCents:12500,weeklyRateCents:60000,monthlyRateCents:180000,currency:'CAD',available:null,billableDays:2,lineTotalCents:25000,pricingMode:'DAILY'}, {id:'a2',title:'Éclairage studio',productType:'Accessoires',categoryId:'cat-light',categoryName:'Éclairage',catalogTagsJson:'["studio"]',dailyRateCents:7500,currency:'CAD',available:null,billableDays:2,lineTotalCents:15000,pricingMode:'DAILY'}];
const catalogItems=[
 {id:'extra',name:'Protection',priceCents:2000,currency:'CAD',pricingMode:'FIXED',itemType:'ADDON',required:true,taxable:true,compatibilityMode:'ALL'},
 {id:'video-extra',name:'Moniteur vidéo',priceCents:3000,currency:'CAD',pricingMode:'FIXED',itemType:'ADDON',required:false,taxable:true,compatibilityMode:'CATEGORIES',applicableCategoryIdsJson:'["cat-video"]'},
 {id:'light-extra',name:'Diffuseur lumière',priceCents:1500,currency:'CAD',pricingMode:'FIXED',itemType:'ADDON',required:false,taxable:true,compatibilityMode:'CATEGORIES',applicableCategoryIdsJson:'["cat-light"]'}
];
let submitted,failSearch=false;
const server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/appearance.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(join(temp,'appearance.js')));return;}if(req.url==='/appearance'){res.setHeader('Content-Type','text/html');res.end('<div id="appearance"></div><script type="module" src="/appearance.js"></script>');return;}if(req.url==='/widget.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(join(temp,'widget.js')));return;}if(req.url.startsWith('/api/bi-event')){res.end('{}');return;}if(req.url.startsWith('/api/public-booking')){if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;submitted=JSON.parse(body);res.end(JSON.stringify({reservationNumber:'TEST-001',totalCents:31043,amountDueNowCents:7761,balanceDueCents:23282,currency:'CAD',checkoutUrl:'https://example.com/pay'}));return;}if(failSearch&&req.url.includes('?')){res.statusCode=409;res.end(JSON.stringify({error:'INVALID_PERIOD'}));return;}res.end(JSON.stringify({company:{name:'Notes',logoUrl:''},settings,assets:assets.map(a=>({...a,available:req.url.includes('?')?true:null})),catalogItems}));return;}res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0;padding:20px;background:#e8edf3}</style><test-booking></test-booking><script type="module" src="/widget.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=`http://127.0.0.1:${server.address().port}`;
try{
 await page.goto(url);await page.locator('#search').waitFor();
 assert.equal(await page.locator('h1').textContent(),'Planifiez votre location');
 await page.locator('[data-month="1"]').click();const days=page.locator('[data-day]:not(:disabled)');await days.nth(3).click();await days.nth(5).click();
 assert((await page.locator('#start').inputValue()).endsWith('T09:00'));assert((await page.locator('#end').inputValue()).endsWith('T17:00'));
 await page.locator('#search').click();await page.locator('[data-asset="a1"]:enabled').waitFor();await page.locator('[data-asset="a1"]').click();
 await page.locator('[data-catalog-toggle="extra"]').waitFor();assert(await page.locator('[data-catalog-toggle="extra"]').isChecked());
 await page.locator('[data-catalog-toggle="video-extra"]').waitFor();
 assert.equal(await page.locator('[data-catalog-toggle="light-extra"]').count(),0);
 assert((await page.locator('.sumrow.total').textContent()).includes('310'));
 await page.locator('#continue').click();assert.equal(await page.locator('[name="customerName"]').evaluate(e=>e===e.getRootNode().activeElement),true);
 await page.locator('[name="customerName"]').fill('Marie Test');await page.locator('[name="customerEmail"]').fill('marie@example.com');
 await page.screenshot({path:join(temp,'desktop.png'),fullPage:true});
 for(const width of [980,768,390,320]){await page.setViewportSize({width,height:950});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);}
 await page.screenshot({path:join(temp,'mobile.png'),fullPage:true});
 await page.locator('#submit').click();await page.locator('.complete').waitFor();assert.deepEqual(submitted.assetIds,['a1']);assert.deepEqual(submitted.catalogItems,[{id:'extra',quantity:1}]);assert.equal(submitted.paymentMode,'DEPOSIT');
 settings.paymentsEnabled=false;settings.theme=BOOKING_PALETTES[4].colors;await page.addInitScript(()=>window.testLanguage='en');await page.goto(url);await page.locator('#search').waitFor();assert.equal(await page.locator('h1').textContent(),'Plan your rental');assert.equal(await page.locator('.brand').textContent(),'Notes');assert.equal(await page.locator('test-booking').evaluate(e=>getComputedStyle(e).getPropertyValue('--rf').trim()),'#5eead4');
 await page.locator('#start').fill('2027-02-02T09:00');await page.locator('#end').fill('2027-02-03T17:00');await page.locator('#search').click();await page.locator('[data-asset="a1"]:enabled').waitFor();await page.locator('[data-asset="a1"]').click();
 await page.locator('[name="customerName"]').fill('English Test');await page.locator('[name="customerEmail"]').fill('test@example.com');
 assert.equal(await page.locator('input[name="paymentMode"]').count(),0);
 await page.locator('#start').fill('2027-02-05T09:00');assert(await page.locator('#submit').isDisabled());assert(await page.locator('[data-asset="a1"]').isDisabled());assert.equal(await page.locator('[data-catalog-toggle]').count(),0);
 failSearch=true;await page.locator('#search').click();await page.locator('.notice.error').waitFor();assert.equal(await page.locator('.notice.error').textContent(),'The selected period is invalid.');
 failSearch=false;await page.locator('#end').fill('2027-02-06T17:00');await page.locator('#search').click();await page.locator('[data-asset="a1"]:enabled').waitFor();await page.locator('[data-asset="a1"]').click();await page.locator('#submit').click();await page.locator('.complete').waitFor();assert.equal(submitted.paymentMode,undefined);
 await page.goto(url+'/appearance');await page.getByRole('heading',{name:'Booking widget appearance'}).waitFor();
 await page.getByRole('button',{name:'Prune',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(window.savedTheme).primary),'#804c91');
 await page.getByRole('textbox',{name:'Buttons and selection HEX'}).fill('#123456');assert.equal(await page.evaluate(()=>JSON.parse(window.savedTheme).primary),'#123456');assert.equal(await page.locator('[data-booking-theme-preview]').evaluate(e=>getComputedStyle(e).getPropertyValue('--rf').trim()),'#123456');
 await page.getByRole('textbox',{name:'Buttons and selection HEX'}).fill('invalid');assert.equal(await page.evaluate(()=>JSON.parse(window.savedTheme).primary),'#123456');
 await page.getByRole('button',{name:'Reset default colors'}).click();assert.equal(await page.evaluate(()=>JSON.parse(window.savedTheme).primary),'#007f78');
 assert.deepEqual(errors,[]);console.log(`PASS: calendars, category extras, mandatory extras, deposits/offline booking, date invalidation, FR/EN, themes and responsive widths. Screenshots: ${temp}`);
} finally {await browser.close();await new Promise(r=>server.close(r));}
