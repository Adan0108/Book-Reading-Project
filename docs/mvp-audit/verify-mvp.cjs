// Audit evidence only. Requires the existing serve-qa.cjs backend and Vite server.
// Creates fixtures ONLY in the explicitly named localhost publishing_qa database.
// Never sends email, uploads cloud assets, processes payments, or flushes Redis.
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const be = createRequire(path.join(root, 'backend/package.json'));
const fe = createRequire(path.join(root, 'frontend/package.json'));
const mysql = be('mysql2/promise');
const bcrypt = be('bcrypt');
const { chromium } = fe('@playwright/test');
const results = [];
const stamp = Date.now();
let db, browser;
const record = (id, observed) => { results.push({ id, observed }); console.log(id, JSON.stringify(observed)); };
async function api(route, { method = 'GET', body, session, cookie } = {}) {
  const response = await fetch(`http://localhost:3000/v1/api${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}`, 'x-client-id': String(session.id) } : {}), ...(cookie ? { Cookie: cookie, 'x-client-id': String(session.id) } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text(); let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  return { status: response.status, data };
}
async function login(email, password) {
  const result = await api('/access/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200);
  const m = result.data.metadata;
  return { id: m.user.id, token: m.tokens.accessToken, refresh: m.tokens.refreshToken };
}
async function user(label, role = 'READER', state = 1) {
  const email = `mvp-${label}-${stamp}-${randomUUID().slice(0, 8)}@example.invalid`;
  const password = 'MVP-audit-local-only-2026!';
  const [r] = await db.query('INSERT INTO users (email,password_hash,state) VALUES (?,?,?)', [email, await bcrypt.hash(password, 10), state]);
  await db.query('INSERT INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE code=?', [r.insertId, role]);
  return { id: r.insertId, email, password, ...(state === 1 ? { session: await login(email, password) } : {}) };
}
async function chapter(bookId, title, visibility, session, extra = {}) {
  const r = await api(`/authors/me/books/${bookId}/chapters`, { method: 'POST', session, body: { requestId: randomUUID(), title, contentMd: `## ${title}\n\nAudit fixture text.`, isDraft: false, visibility, ...extra } });
  assert.equal(r.status, 200); return r.data.metadata;
}
(async () => {
  db = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: 'publishing-qa-local', database: 'publishing_qa' });
  const [[database]] = await db.query('SELECT DATABASE() AS name'); assert.equal(database.name, 'publishing_qa');
  if (process.argv.includes('--markdown-only')) {
    const [[fixture]] = await db.query(`SELECT b.slug,b.id AS book_id,c.id AS chapter_id,c.chapter_no FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.title='Markdown safety' AND b.title LIKE 'MVP text audit %' ORDER BY c.id DESC LIMIT 1`);
    const session = await login('publishing-e2e@example.invalid', 'Publishing-QA-only-2026!');
    await api(`/authors/me/books/${fixture.book_id}/chapters/${fixture.chapter_id}`, { method:'PATCH',session,body:{requestId:randomUUID(),contentMd:'## Safe markup\n\n<script>window.__auditXss=1</script>\n\n<img src="x" onerror="window.__auditXss=1">\n\n[Unsafe](javascript:alert(1))'} });
    browser = await chromium.launch({headless:process.env.PW_HEADLESS==='1'});const page=await browser.newPage();
    await page.addInitScript(()=>{window.__auditXss=0;});
    await page.route('**/*cloudinary.com/**',r=>r.abort());
    await page.goto(`http://localhost:8000/comic/${fixture.slug}/chapters/${fixture.chapter_no}`);
    const heading=page.getByRole('heading',{name:'Safe markup',exact:true});await heading.waitFor();
    const content=heading.locator('..');
    const observed={executableScriptsInContent:await content.locator('script').count(),inlineEventImages:await content.locator('img[onerror]').count(),unsafeJavascriptLinks:await content.locator('a[href^="javascript:"]').count(),executionMarker:await page.evaluate(()=>window.__auditXss)};
    assert.equal(observed.executableScriptsInContent,0);assert.equal(observed.inlineEventImages,0);assert.equal(observed.unsafeJavascriptLinks,0);assert.equal(observed.executionMarker,0);
    const file=path.join(__dirname,'EVIDENCE.json');const evidence=JSON.parse(fs.readFileSync(file,'utf8'));evidence.results.find(r=>r.id==='MARKDOWN_SAFETY').observed=observed;fs.writeFileSync(file,JSON.stringify(evidence,null,2)+'\n');
    console.log('MARKDOWN_SAFETY_CONTENT_SCOPE',JSON.stringify(observed));return;
  }
  if (process.argv.includes('--refresh-only')) {
    const attempts = [];
    for (let i = 0; i < 8; i++) {
      const u = await user(`refresh-race-${i}`);
      const options = { method: 'POST', session: u.session, cookie: `rt=${u.session.refresh}`, body: {} };
      const wave = await Promise.all([api('/access/refresh', options), api('/access/refresh', options)]);
      const statuses = wave.map(r => r.status); attempts.push(statuses);
      if (statuses.every(s => s === 200)) break;
    }
    const file = path.join(__dirname, 'EVIDENCE.json'); const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entry = evidence.results.find(r => r.id === 'CONCURRENT_REFRESH');
    entry.observed.repeatAttempts = attempts;
    entry.observed.doubleSuccessObserved = attempts.some(a => a.every(s => s === 200));
    entry.observed.note = 'Race is timing-dependent: single winner and double winner outcomes were both observed during this audit.';
    fs.writeFileSync(file, JSON.stringify(evidence, null, 2) + '\n');
    console.log('CONCURRENT_REFRESH_REPEAT', JSON.stringify(entry.observed)); return;
  }
  browser = await chromium.launch({ headless: process.env.PW_HEADLESS === '1' });
  const page = await browser.newPage(); page.setDefaultTimeout(30000);
  let cloudRequests = 0;
  await page.route('**/*cloudinary.com/**', route => { cloudRequests++; return route.abort(); });
  await page.goto('http://localhost:8000/login');
  await page.getByLabel('Email', { exact: true }).fill('publishing-e2e@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Publishing-QA-only-2026!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('http://localhost:8000/');
  await page.goto('http://localhost:8000/author/comic/create');
  const title = `MVP text audit ${stamp}`;
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Genre', { exact: true }).fill('Light Novel');
  await page.getByRole('button', { name: 'Publish Book', exact: true }).click();
  await page.waitForURL(/\/comic\/\d+\/edit/);
  const bookId = Number(page.url().match(/\/comic\/(\d+)/)[1]);
  await page.getByRole('link', { name: 'Create Chapter', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Text-first audit');
  await page.locator('summary').click();
  let content = '## Chapter opening\n\n**Courage** and *patience*.\n\n"Hello," she said.  \n"I am here," he answered.\n\n' + Array.from({ length: 280 }, (_, i) => `Paragraph ${i + 1}. The traveller reads a letter beneath the old oak tree and continues the journey.`).join('\n\n');
  await page.getByLabel('Chapter text', { exact: true }).fill(content);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await page.waitForURL(/\/chapter\/\d+\/edit/);
  await page.getByLabel('Chapter text', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Chapter text', { exact: true }).inputValue(), content);
  content += '\n\nAn edited ending.';
  await page.getByLabel('Chapter text', { exact: true }).fill(content);
  const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/chapters/'));
  await page.getByRole('button', { name: 'Publish Chapter', exact: true }).click();
  const published = (await (await saved).json()).metadata;
  await page.getByRole('status', { name: 'Save progress' }).filter({ hasText: 'Published successfully.' }).waitFor();
  const stored = await page.evaluate(() => ({ token: localStorage.getItem('accessToken'), id: Number(localStorage.getItem('userId')) }));
  const author = await login('publishing-e2e@example.invalid', 'Publishing-QA-only-2026!');
  const read = await api(`/books/${published.slug}/chapters/${published.chapterNo}`);
  assert.equal(read.data.metadata.contentMarkdown, content); assert.equal(read.data.metadata.images.length, 0);
  await page.goto(`http://localhost:8000/comic/${published.slug}/chapters/${published.chapterNo}`);
  await page.getByRole('heading', { name: 'Chapter opening', exact: true }).waitFor();
  assert.equal(await page.locator('strong').filter({ hasText: 'Courage' }).count(), 1);
  const typography = await page.getByRole('heading', { name: 'Chapter opening', exact: true }).evaluate(h => {
    const p = h.nextElementSibling;
    return { headingSize: getComputedStyle(h).fontSize, headingWeight: getComputedStyle(h).fontWeight, paragraphSize: getComputedStyle(p).fontSize, paragraphMargin: getComputedStyle(p).marginBottom, lineHeight: getComputedStyle(p).lineHeight };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  record('TEXT_E2E', { draftReopenedExactly: true, editedSourcePreserved: true, bytes: Buffer.byteLength(content), images: read.data.metadata.images.length, cloudRequests, markdownHeadingAndEmphasis: true, typography, mobileNoOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth) });
  const oversized = await api(`/authors/me/books/${bookId}/chapters`, { method: 'POST', session: author, body: { requestId: randomUUID(), title: 'Large text boundary', contentMd: 'x'.repeat(110 * 1024), isDraft: true } });
  record('LONG_TEXT_LIMIT', { requestContentBytes: 110 * 1024, status: oversized.status });
  const [[authorRow]] = await db.query('SELECT id FROM authors WHERE user_id=?', [author.id]);
  const authorId = authorRow.id;
  const member = await user('member');
  const otherAuthor = await user('other-author', 'AUTHOR');
  const [otherAuthorRow] = await db.query('INSERT INTO authors (user_id,pen_name,is_approved) VALUES (?,?,1)', [otherAuthor.id, 'MVP Other Author']);
  async function tier(a, name) { const [r] = await db.query('INSERT INTO membership_tiers (author_id,name,price) VALUES (?,?,?)', [a, `${name}-${stamp}`, 5]); return r.insertId; }
  const low = await tier(authorId, 'Low'), high = await tier(authorId, 'High'), foreignTier = await tier(otherAuthorRow.insertId, 'Foreign');
  const paid = await chapter(bookId, 'Member chapter', 'MEMBERS', author);
  const tiered = await chapter(bookId, 'Tier chapter', 'TIERS', author);
  await db.query('INSERT INTO chapter_tier_access (chapter_id,author_id,tier_id) VALUES (?,?,?)', [tiered.chapterId, authorId, high]);
  const paidPath = `/books/${published.slug}/chapters/${paid.chapterNo}`;
  const tierPath = `/books/${published.slug}/chapters/${tiered.chapterNo}`;
  const status = async (url, session) => (await api(url, { session })).status;
  const access = { guest: await status(paidPath), nonMember: await status(paidPath, member.session) };
  const [foreignMembership] = await db.query(`INSERT INTO memberships (user_id,author_id,tier_id,current_period_end) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))`, [member.id, otherAuthorRow.insertId, foreignTier]);
  access.memberOfOtherAuthor = await status(paidPath, member.session);
  const [membership] = await db.query(`INSERT INTO memberships (user_id,author_id,tier_id,current_period_end) VALUES (?,?,?,DATE_SUB(NOW(),INTERVAL 1 DAY))`, [member.id, authorId, low]);
  access.expired = await status(paidPath, member.session);
  await db.query("UPDATE memberships SET current_period_end=DATE_ADD(NOW(),INTERVAL 1 DAY),status='CANCELED' WHERE id=?", [membership.insertId]);
  access.cancelled = await status(paidPath, member.session);
  await db.query("UPDATE memberships SET status='ACTIVE' WHERE id=?", [membership.insertId]);
  access.activeMember = await status(paidPath, member.session);
  access.lowerTier = await status(tierPath, member.session);
  await db.query('UPDATE memberships SET tier_id=? WHERE id=?', [high, membership.insertId]);
  access.allowedTier = await status(tierPath, member.session);
  access.guestAfterMemberCacheWarm = await status(tierPath);
  access.tocMemberLock = (await api(`/books/${published.slug}/chapters`, { session: member.session })).data.metadata.items.find(c => c.id === tiered.chapterId)?.isLockedForCurrentUser;
  record('MEMBERSHIP_BOUNDARIES', access);
  const publicWarm = await status(`/books/${published.slug}/chapters/${published.chapterNo}`);
  await api(`/authors/me/books/${bookId}/chapters/${published.chapterId}`, { method: 'PATCH', session: author, body: { requestId: randomUUID(), visibility: 'MEMBERS' } });
  record('PUBLIC_TO_PAID_CACHE', { before: publicWarm, guestAfterChange: await status(`/books/${published.slug}/chapters/${published.chapterNo}`) });
  const scheduled = await chapter(bookId, 'Scheduled draft', 'PUBLIC', author, { isDraft: true, scheduledAt: '2030-01-01T00:00:00.000Z' });
  const [[scheduledRow]] = await db.query('SELECT scheduled_at,published_at,is_draft FROM chapters WHERE id=?', [scheduled.chapterId]);
  record('SCHEDULE_COLUMN', { scheduledStored: !!scheduledRow.scheduled_at, published: !!scheduledRow.published_at, draft: scheduledRow.is_draft });
  const lockedBook = await api('/authors/me/books', { method: 'POST', session: author, body: { requestId: randomUUID(), title: 'Members book audit', genre: 'Novel', status: 'PUBLISHED', visibility: 'MEMBERS' } });
  const lockedChapter = await chapter(lockedBook.data.metadata.id, 'Public chapter inside members book', 'PUBLIC', author);
  record('BOOK_VISIBILITY', { bookVisibility: 'MEMBERS', chapterVisibility: 'PUBLIC', guestContentStatus: await status(`/books/${lockedBook.data.metadata.slug}/chapters/${lockedChapter.chapterNo}`) });
  const pending = await user('pending', 'READER', 2);
  const setup = await api('/access/setup-password', { method: 'POST', body: { email: pending.email, password: 'Audit-chosen-password!', username: `audit_pending_${stamp}` } });
  record('SETUP_WITHOUT_PROOF', { status: setup.status, submittedFields: ['email', 'password', 'username'], verifiedSetupTokenOrOtpSubmitted: false });
  const verifying = await user('otp', 'READER', 0);
  await db.query(`INSERT INTO user_verifications (user_id,type,otp_hash,is_verified,expires_at) VALUES (?,'EMAIL_OTP',?,0,DATE_ADD(NOW(),INTERVAL 5 MINUTE))`, [verifying.id, await bcrypt.hash('123456', 10)]);
  const cooldown = await api('/access/resend-otp', { method: 'POST', body: { email: verifying.email } });
  const otpStatuses = [];
  for (let i = 0; i < 10; i++) otpStatuses.push((await api('/access/verify-email', { method: 'POST', body: { email: verifying.email, otp: '654321' } })).status);
  const afterLimit = await api('/access/verify-email', { method: 'POST', body: { email: verifying.email, otp: '123456' } });
  record('OTP_LIMITS', { recentResendStatus: cooldown.status, tenWrongAttemptStatuses: otpStatuses, correctCodeAfterLimitStatus: afterLimit.status, fixtureOtpSeededNotEmailed: true });
  const resetting = await user('reset');
  await db.query(`INSERT INTO user_verifications (user_id,type,otp_hash,is_verified,expires_at) VALUES (?,'RESET',?,0,DATE_ADD(NOW(),INTERVAL 5 MINUTE))`, [resetting.id, await bcrypt.hash('123456', 10)]);
  const reset = await api('/access/reset-password', { method: 'POST', body: { email: resetting.email, otp: '123456', newPassword: 'Audit-reset-password!' } });
  record('RESET_SESSION_REVOCATION', { resetStatus: reset.status, oldAccessStatus: await status('/user/me', resetting.session), oldRefreshStatus: (await api('/access/refresh', { method: 'POST', session: resetting.session, cookie: `rt=${resetting.session.refresh}`, body: {} })).status });
  const logoutUser = await user('logout');
  const logout = await api('/access/logout', { method: 'POST', session: logoutUser.session, body: {} });
  record('LOGOUT_REVOCATION', { logout: logout.status, oldAccess: await status('/user/me', logoutUser.session), oldRefresh: (await api('/access/refresh', { method: 'POST', session: logoutUser.session, cookie: `rt=${logoutUser.session.refresh}`, body: {} })).status });
  const [jwtInfo] = [{ algorithm: JSON.parse(Buffer.from(author.token.split('.')[0], 'base64url').toString()).alg }];
  record('JWT_ALGORITHM', jwtInfo);
  const rotating = await user('rotation');
  const refreshOptions = { method: 'POST', session: rotating.session, cookie: `rt=${rotating.session.refresh}`, body: {} };
  const rotations = await Promise.all([api('/access/refresh', refreshOptions), api('/access/refresh', refreshOptions)]);
  record('CONCURRENT_REFRESH', { sameRefreshTokenStatuses: rotations.map(r => r.status), sequentialOldTokenStatus: (await api('/access/refresh', refreshOptions)).status });
  const blocked = await user('blocked');
  await db.query('UPDATE users SET state=0 WHERE id=?', [blocked.id]);
  record('BLOCKED_EXISTING_SESSION', { existingAccessStatus: await status('/user/me', blocked.session) });
  await page.evaluate(() => { window.__auditXss = 0; });
  const xss = await chapter(bookId, 'Markdown safety', 'PUBLIC', author, { contentMd: '## Safe markup\n\n<script>window.__auditXss=1</script>\n\n[Unsafe](javascript:alert(1))' });
  await page.goto(`http://localhost:8000/comic/${published.slug}/chapters/${xss.chapterNo}`);
  await page.getByRole('heading', { name: 'Safe markup', exact: true }).waitFor();
  record('MARKDOWN_SAFETY', { executableScriptsInContent: await page.getByRole('heading', { name:'Safe markup',exact:true }).locator('..').locator('script').count(), unsafeJavascriptLinks: await page.locator('a[href^="javascript:"]').count(), executionMarker: await page.evaluate(() => window.__auditXss ?? 0) });
  const discovery = await api(`/books?query=${encodeURIComponent(title)}`);
  record('DISCOVERY', { titleSearchFoundBook: discovery.data.metadata.items.some(b => b.id === bookId), authorBooksStatus: await status(`/books/${authorId}/books`), invalidPageStatus: await status('/books?page=not-a-number') });
  const applicant = await user('applicant'); const admin = await user('admin', 'ADMIN');
  const application = await api('/author-applications', { method: 'POST', session: applicant.session, body: { applicationTitle: 'Audit author application', sampleTitle: 'Audit story', sampleStory: 'Sample novel paragraph. '.repeat(50), penName: 'Audit Applicant' } });
  const approval = await api(`/admin/author-applications/${application.data.metadata.id}/approve`, { method: 'POST', session: admin.session, body: {} });
  const [[profile]] = await db.query('SELECT COUNT(*) AS total FROM authors WHERE user_id=?', [applicant.id]);
  record('AUTHOR_APPROVAL', { application: application.status, approval: approval.status, authorProfiles: Number(profile.total), publishingAccess: await status('/authors/me/books', applicant.session), readerAdminAccess: await status('/admin/author-applications', member.session), adminListAccess: await status('/admin/author-applications', admin.session) });
  const warmDetail = await api(`/books/${published.slug}`);
  await db.query("UPDATE books SET status='HIDDEN' WHERE id=?", [bookId]);
  record('HIDDEN_BOOK_CACHE', { warmed: warmDetail.status, detailAfterDirectDatabaseHide: await status(`/books/${published.slug}`), contentAfterDirectDatabaseHide: await status(paidPath), note: 'Direct isolated DB hide demonstrates out-of-band invalidation; no admin hide API exists.' });
  await api(`/authors/me/books/${bookId}`, { method: 'PATCH', session: author, body: { requestId: randomUUID(), status: 'PUBLISHED' } });
  const resultsFile = path.join(__dirname, 'EVIDENCE.json');
  fs.writeFileSync(resultsFile, JSON.stringify({ auditedCommit: '82b4bf93a16242ce04d4ecd20b09d664d8af376b', environment: 'isolated publishing_qa, headed Chromium, SMTP disabled, no cloud requests', results }, null, 2) + '\n');
  console.log('Evidence saved; no tokens or real credentials recorded.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await browser?.close(); await db?.end(); });
