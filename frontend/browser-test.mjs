import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
const env=Object.fromEntries(readFileSync('../backend/.env','utf8').split(/\r?\n/).filter(s=>s.includes('=')&&!s.startsWith('#')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const checks=[];
function check(name,ok){if(!ok)throw Error(name);checks.push(name);console.log('PASS',name);}
try{
  await page.goto('http://127.0.0.1:4173');
  await page.getByLabel('User ID').fill(env.BOOTSTRAP_VIEWER_ID);
  await page.getByLabel('Access token').fill(env.BOOTSTRAP_VIEWER_TOKEN);
  await page.getByRole('button',{name:'Connect to dashboard'}).click();
  await page.getByRole('heading',{name:'Detection & virtual isolation'}).waitFor();
  check('Login and integrated detection panel',true);
  check('No obsolete pending-stage labels', !/Stage 3.*pending|Disabled.*Stage 5/.test(await page.locator('body').innerText()));
  await page.getByRole('button',{name:'Explain current state'}).click();
  await page.getByText('Mock explanation (template, not an LLM):',{exact:false}).waitFor();check('Mock explanation visible',true);
  await page.getByRole('button',{name:'Demonstrate AI fallback'}).click();
  await page.getByText('Explanation service unavailable.',{exact:false}).waitFor();check('AI fallback visible',true);
  await page.getByText('Administrator simulation controls',{exact:true}).click();
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Restore virtual supply'}).click();
  await page.getByText('forbidden',{exact:true}).waitFor();check('Viewer blocked from control in browser',true);
  await page.screenshot({path:'../docs/dashboard-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Reading history',exact:true}).click();
  check('History renders stored measurements',await page.locator('tbody tr').count()>0);
  await page.getByRole('button',{name:'Parameters',exact:true}).click();check('Provisional parameter register renders',await page.getByText('Reference parameters',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Overview',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../docs/dashboard-mobile.png',fullPage:true});
  check('Mobile layout fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  check('Credentials absent from localStorage',await page.evaluate(()=>localStorage.length===0));
  check('No browser runtime errors',errors.length===0);
  await page.reload();await page.getByLabel('Access token').waitFor();check('Reload clears authenticated session',true);
  writeFileSync('../docs/stage7-browser-results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
