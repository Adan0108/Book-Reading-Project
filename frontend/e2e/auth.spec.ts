import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

async function code(request:APIRequestContext,email:string){
  let received='';
  await expect.poll(async()=>{
    const response=await request.get(`http://127.0.0.1:2527/?email=${encodeURIComponent(email)}`);
    if(response.ok())received=(await response.json()).code;
    return received;
  }).toMatch(/^\d{6}$/);
  return received;
}
async function enterCode(page:Page,value:string){
  const inputs=page.locator('input[inputmode="numeric"], input[aria-label^="Please enter OTP"]');
  for(let i=0;i<6;i++)await inputs.nth(i).fill(value[i]);
}
async function login(page:Page,email:string,password:string){
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  const response=page.waitForResponse(r=>r.url().endsWith('/access/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  const data=(await(await response).json()).metadata;
  await expect(page).toHaveURL('/');
  return data;
}
test('registration, SMTP OTP, secure setup, author approval, reload, reset and revocation',async({page,request,browser})=>{
  const email=`browser-auth-${Date.now()}@example.invalid`,password='Browser-test-password-2026!';
  let uploads=0;
  page.on('request',r=>{if(r.url().includes('api.cloudinary.com')&&r.method()==='POST')uploads++;});
  await page.goto('/signup');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/OTP');
  await enterCode(page,await code(request,email));
  await expect(page).toHaveURL('/setPassword');
  await page.getByLabel('Username',{exact:true}).fill(`Reader${Date.now()}`);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByLabel('Confirm Password',{exact:true}).fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/login');
  const session=await login(page,email,password);
  expect(await page.evaluate(()=>localStorage.getItem('accessToken'))).toBeNull();
  await page.goto('/author/dashboard');
  await expect(page.getByRole('alert')).toContainText('author account');
  await page.getByRole('link',{name:'Apply to become an author'}).click();
  await page.getByLabel('Pen name',{exact:true}).fill('Browser writer');
  const applicationTitle=`Application ${Date.now()}`;
  await page.getByLabel('Application title',{exact:true}).fill(applicationTitle);
  await page.getByLabel('Sample title',{exact:true}).fill('A beginning');
  await page.getByLabel('Writing sample').fill('The night train crossed the river. '.repeat(40));
  await page.getByRole('button',{name:'Submit application',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Status: PENDING');
  const adminContext=await browser.newContext();
  const admin=await adminContext.newPage();
  await login(admin,'admin-e2e@example.invalid','Publishing-QA-only-2026!');
  await admin.goto('/admin/applications');
  const item=admin.getByRole('listitem').filter({hasText:applicationTitle});
  await item.getByRole('button',{name:/Review application/}).click();
  await admin.getByRole('button',{name:'Approve author',exact:true}).click();
  await expect(admin.getByRole('region',{name:'Review application'})).toHaveCount(0);
  const otherTab=await page.context().newPage();
  await Promise.all([page.reload(),otherTab.goto('/account/author-application')]);
  await expect(otherTab.getByRole('status')).toHaveText('Status: APPROVED');
  await otherTab.close();
  await expect(page.getByRole('status')).toHaveText('Status: APPROVED');
  await page.getByRole('link',{name:'Open writing studio'}).click();
  await expect(page).toHaveURL('/author/dashboard');
  await page.goto('/author/comic/create');
  await page.getByLabel('Title',{exact:true}).fill(`Onboarding novel ${Date.now()}`);
  await page.getByLabel('Genre',{exact:true}).fill('Novel');
  await page.getByRole('button',{name:'Save Draft',exact:true}).click();
  await expect(page).toHaveURL(/\/author\/comic\/\d+\/edit/);
  await page.reload();
  await expect(page.getByLabel('Title',{exact:true})).toHaveValue(/^Onboarding novel/);
  const oldHeaders={'x-client-id':String(session.user.id),Authorization:`Bearer ${session.tokens.accessToken}`};
  await page.goto('/forgot/email');
  await page.getByLabel('Email Address',{exact:true}).fill(email);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/forgot/changePassword');
  await enterCode(page,await code(request,email));
  await page.getByLabel('New Password',{exact:true}).fill(`${password}new`);
  await page.getByLabel('Confirm New Password',{exact:true}).fill(`${password}new`);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/login');
  const rejected=await request.get('http://localhost:3000/v1/api/user/me',{headers:oldHeaders});
  expect(rejected.status()).toBe(401);
  await login(page,email,`${password}new`);
  expect(uploads).toBe(0);
  await adminContext.close();
});
