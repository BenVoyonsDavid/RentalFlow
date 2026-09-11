/** Actual application components with local Wix service/layout doubles; no live data is written. */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'rentalflow-i18n-'));
const components = {
  dashboard: 'my-page/my-page', calendar: 'calendar/calendar', customers: 'customers/customers',
  equipment: 'equipment/equipment', reservations: 'reservations/reservations-v2', settings: 'settings/settings-v2',
};
const plugin = { name: 'wix-test-services', setup(api) {
  api.onResolve({ filter: /^@wix\// }, ({ path }) => ({ path, namespace: 'wix-test' }));
  api.onLoad({ filter: /.*/, namespace: 'wix-test' }, ({ path }) => {
    if (path.endsWith('.css')) return { contents: '', loader: 'css' };
    if (path === '@wix/design-system') return { loader: 'jsx', resolveDir: process.cwd(), contents: `
      import React from 'react';
      export const WixDesignSystemProvider = ({children}) => <>{children}</>;
      export const Page = ({children}) => <main>{children}</main>;
      Page.Header = ({title,subtitle}) => <header><h1>{title}</h1><p>{subtitle}</p></header>;
      Page.Content = ({children}) => <section>{children}</section>;
    ` };
    if (path === '@wix/essentials') return { contents: `export const httpClient = { fetchWithAuth: (...args) => fetch(...args) };` };
    if (path === '@wix/data') return { contents: `
      export const items = {
        query(id) { return { limit(){return this},eq(){return this},async find(){return {items: id.endsWith('/assets') ? [{_id:'a1',title:'Équipement Démo',assetNumber:'EQ-1',status:'AVAILABLE',active:true,dailyRateCents:1000,currency:'CAD'}] : []}} }; },
        async insert(id,value) { window.testWrites.push({id,value}); return {_id:'new-1',...value}; },
        async update(id,value) { window.testWrites.push({id,value}); return value; }
      };
    ` };
    return { contents: 'export const paymentLinks = {};' };
  });
} };
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
${Object.entries(components).map(([name,path]) => `import ${name} from './src/extensions/dashboard/pages/${path}';`).join('\n')}
import Booking from './src/extensions/site/widgets/rental-flow-online-booking/rental-flow-online-booking';
window.testWrites = [];
const components = {${Object.keys(components).join(',')}};
customElements.define('test-booking', Booking);
const route = new URLSearchParams(location.search).get('page');
if (route === 'booking') document.body.append(document.createElement('test-booking'));
else { const Component = components[route] || dashboard; createRoot(document.getElementById('root')).render(<Component/>); }
`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true,
  outfile: join(directory,'app.js'), jsx: 'automatic', define: { 'import.meta.env.BASE_API_URL': '""', 'import.meta.env.DEV': 'true' }, plugins:[plugin] });
let requests = [];
const server = createServer(async (request,response) => {
  const url = new URL(request.url,'http://localhost');
  if (url.pathname === '/api/public-booking') {
    let body = ''; for await (const chunk of request) body += chunk;
    requests.push({language:url.searchParams.get('lang'),method:request.method,body});
    response.setHeader('content-type','application/json');
    if (request.method === 'POST') {
      const value = JSON.parse(body);
      if (value.customer.name === 'Error') {
        response.statusCode = 400;
        response.end(JSON.stringify({error:'A valid email is required.',errorKey:'Un courriel valide est obligatoire.'}));return;
      }
      response.end(JSON.stringify({ reservationNumber:'RES-123',totalCents:2000,amountDueNowCents:500,balanceDueCents:1500,currency:'CAD',checkoutUrl:'https://example.invalid/pay' }));return;
    }
    response.end(JSON.stringify({company:{name:'Entreprise Démo',logoUrl:''},settings:{currency:'CAD',taxesEnabled:false,depositEnabled:true,depositType:'PERCENT',depositValue:25,requiredFields:[]},assets:[{id:'a1',title:'Équipement Démo',productType:'Kayak',currency:'CAD',dailyRateCents:1000,weeklyRateCents:0,monthlyRateCents:0,available:url.searchParams.has('start')?true:null,billableDays:2,lineTotalCents:2000,pricingMode:'Journalier'}]}));return;
  }
  response.setHeader('content-type',url.pathname==='/app.js'?'text/javascript':'text/html');
  response.end(url.pathname==='/app.js'?await readFile(join(directory,'app.js')):'<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args:['--no-sandbox']});
const context = await browser.newContext({locale:'fr-CA'});
const page = await context.newPage();
const errors = [];
page.on('pageerror',error => errors.push(error.message));
const change = async lang => { await page.locator('select').first().selectOption(lang); };
const titles = {dashboard:['Tableau de bord','Dashboard'],calendar:['Calendrier','Calendar'],customers:['Clients','Customers'],equipment:['Équipements','Equipment'],reservations:['Réservations','Reservations'],settings:['Paramètres','Settings']};
try {
  for (const [route,[fr,en]] of Object.entries(titles)) {
    await page.goto(`${origin}/?page=${route}`);await change('fr');
    await page.getByRole('heading',{name:fr,exact:true}).waitFor();
    await change('en');await page.getByRole('heading',{name:en,exact:true}).waitFor();
    if (route==='calendar'||route==='reservations') assert.ok((await page.locator('body').innerText()).includes('Mon'));
    await page.reload();await page.getByRole('heading',{name:en,exact:true}).waitFor();
    await change('fr');await page.getByRole('heading',{name:fr,exact:true}).waitFor();
    console.log(`PASS ${route}: FR/EN and saved preference`);
  }
  // Switching language keeps unsaved dashboard edits and machine option values.
  await page.goto(`${origin}/?page=equipment`);await page.getByRole('button',{name:'+ Ajouter un équipement',exact:true}).click();
  await page.getByPlaceholder('Ex. Kayak Pelican').fill('Mon équipement');
  // Modal overlays the header; dispatching the change also exercises cross-frame storage notifications.
  await page.evaluate(() => { localStorage.setItem('rentalflow.language.dashboard','en');window.dispatchEvent(new StorageEvent('storage',{key:'rentalflow.language.dashboard',newValue:'en'})); });
  assert.equal(await page.getByPlaceholder('E.g. Pelican kayak').inputValue(),'Mon équipement');
  assert.ok(await page.locator('option[value="AVAILABLE"]').count());
  assert.deepEqual(await page.evaluate(()=>window.testWrites),[]);
  console.log('PASS dashboard drafts and stored enum values remain unchanged');

  await page.goto(`${origin}/?page=booking`);
  await page.getByRole('heading',{name:'Entreprise Démo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Voir les disponibilités',exact:true}).click();
  await change('en');await page.getByText('Choose a start date and an end date.',{exact:true}).waitFor();
  await page.locator('#start').fill('2030-06-01T10:00');await page.locator('#end').fill('2030-06-03T10:00');
  await page.getByRole('button',{name:'Check availability',exact:true}).click();
  await page.getByRole('button',{name:/Équipement Démo/}).click();
  await page.getByLabel('Full name *',{exact:true}).fill('Élodie $& <test>');
  await page.getByLabel('Email *',{exact:true}).fill('demo@example.com');
  await page.getByLabel('Notes',{exact:true}).fill('Ne pas traduire ces notes.');
  await change('fr');
  assert.equal(await page.getByLabel('Nom complet *',{exact:true}).inputValue(),'Élodie $& <test>');
  assert.equal(await page.locator('#start').inputValue(),'2030-06-01T10:00');
  assert.equal(await page.locator('[data-asset].selected').count(),1);
  await page.getByText('1 équipement disponible.',{exact:true}).waitFor();
  await change('en');await page.getByText('1 equipment item available.',{exact:true}).waitFor();
  assert.ok((await page.locator('.asset-main').innerText()).includes('Daily'));
  await page.getByLabel('Full name *',{exact:true}).fill('Error');
  await page.getByRole('button',{name:'Book and continue to payment',exact:true}).click();
  await page.getByText('A valid email is required.',{exact:true}).waitFor();
  await change('fr');await page.getByText('Un courriel valide est obligatoire.',{exact:true}).waitFor();
  await page.getByLabel('Nom complet *',{exact:true}).fill('Élodie $& <test>');
  await change('en');await page.getByRole('button',{name:'Book and continue to payment',exact:true}).click();
  await page.getByRole('heading',{name:'Your reservation has been created',exact:true}).waitFor();
  await change('fr');await page.getByRole('heading',{name:'Votre réservation est créée',exact:true}).waitFor();
  await page.getByText('Réservation RES-123 créée avec succès.',{exact:true}).waitFor();
  const post = requests.filter(r=>r.method==='POST').at(-1);
  assert.equal(post.language,'en');
  assert.equal(JSON.parse(post.body).customer.name,'Élodie $& <test>');
  assert.equal(JSON.parse(post.body).paymentMode,'DEPOSIT');
  assert.equal(JSON.parse(post.body).notes,'Ne pas traduire ces notes.');
  console.log('PASS booking: live feedback, selection, drafts, payment mode, API language and confirmation');
  await page.setViewportSize({width:375,height:812});
  await page.reload();await change('en');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS booking fits a 375px viewport');

  // Storage restrictions in embedded/private browsing must not disable the selector.
  const blocked = await browser.newContext({locale:'en-CA'});
  await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})});
  const blockedPage = await blocked.newPage();await blockedPage.goto(`${origin}/?page=dashboard`);
  await blockedPage.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
  await blockedPage.locator('select').first().selectOption('fr');
  await blockedPage.getByRole('heading',{name:'Tableau de bord',exact:true}).waitFor();await blocked.close();
  assert.deepEqual(errors,[]);
  console.log('PASS blocked storage, browser language detection and no browser exceptions');
} finally {
  await browser.close();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});
}
