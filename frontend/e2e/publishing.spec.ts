import { test, expect } from '@playwright/test';

test('real author publishing, direct Cloudinary uploads, edit and reader order', async ({ page, request }) => {
  const title = `Publishing QA ${Date.now()}`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ioAAAAASUVORK5CYII=', 'base64');
  const file = (name: string) => ({ name, mimeType: 'image/png', buffer: png });
  const cloudUploads: string[] = [];
  page.on('request', req => { if (req.url().includes('api.cloudinary.com') && req.method() === 'POST') cloudUploads.push(req.url()); });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('publishing-e2e@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Publishing-QA-only-2026!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/author/dashboard');
  await page.goto('/author/comic/create');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Genre', { exact: true }).fill('Comic');
  await page.getByLabel('Choose cover', { exact: true }).setInputFiles(file('cover.png'));
  await expect(page.getByAltText('Page 1 preview')).toHaveAttribute('src', /^blob:/);
  expect(cloudUploads).toHaveLength(0);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page).toHaveURL(/\/author\/comic\/\d+\/edit/);
  const bookId = Number(page.url().match(/\/comic\/(\d+)/)![1]);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
  expect(cloudUploads).toHaveLength(1);
  await page.getByLabel('Replace page 1').setInputFiles(file('cover-replaced.png'));
  await page.getByRole('button', { name: 'Publish Book', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Save progress' })).toHaveText('Published successfully.');
  expect(cloudUploads).toHaveLength(2);
  await page.getByRole('link', { name: 'Create Chapter', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Visual pages');
  const drop = page.getByText(/Or drag images here/).locator('..');
  const data = await page.evaluateHandle(base64 => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    for (const name of ['one.png','two.png','three.png']) transfer.items.add(new File([bytes],name,{ type:'image/png' }));
    return transfer;
  }, png.toString('base64'));
  await drop.dispatchEvent('drop', { dataTransfer: data });
  await expect(page.getByRole('article')).toHaveCount(3);
  expect(cloudUploads).toHaveLength(2);
  const first = await page.getByRole('button', { name: 'Drag page 1', exact: true }).boundingBox();
  const second = await page.getByRole('button', { name: 'Drag page 2', exact: true }).boundingBox();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
  await page.mouse.down();
  await page.mouse.move(first!.x + first!.width / 2 + 12, first!.y + first!.height / 2);
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('article').first()).toContainText('two.png');
  // Keyboard sortable handle plus accessible button alternatives.
  await page.getByRole('button', { name: 'Drag page 3', exact: true }).focus();
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Move page 3 up', exact: true }).click();
  await page.getByRole('button', { name: 'Remove page 2', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page).toHaveURL(/\/chapter\/\d+\/edit/);
  await expect(page.getByRole('article')).toHaveCount(2);
  expect(cloudUploads).toHaveLength(4);
  await page.getByRole('button', { name: 'Move page 2 up', exact: true }).click();
  const publishedResponse = page.waitForResponse(r => r.url().includes('/chapters/') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Publish Chapter', exact: true }).click();
  const result = (await (await publishedResponse).json()).metadata;
  await expect(page.getByRole('status', { name: 'Save progress' })).toHaveText('Published successfully.');
  const expectedOrder = await page.getByRole('article').locator('img').evaluateAll(imgs => imgs.map(i => (i as HTMLImageElement).src));
  expect(cloudUploads).toHaveLength(4);
  // Reorder an already-published chapter and publish again without re-uploading.
  await page.getByRole('button', { name: 'Move page 2 up', exact: true }).click();
  await page.getByRole('button', { name: 'Publish Chapter', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Save progress' })).toHaveText('Published successfully.');
  expectedOrder.reverse();
  await page.goto(`/comic/${result.slug}/chapters/${result.chapterNo}`);
  const pages = page.locator('img[alt^="Page "]');
  await expect(pages).toHaveCount(2);
  expect(await pages.evaluateAll(imgs => imgs.map(i => (i as HTMLImageElement).src))).toEqual(expectedOrder);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const credentials = await page.evaluate(() => ({ token: localStorage.getItem('accessToken'), userId: localStorage.getItem('userId') }));
  const legacy = await request.post(`http://localhost:3000/v1/api/authors/me/books/${bookId}/chapters`, {
    headers: { Authorization: `Bearer ${credentials.token}`, 'x-client-id': credentials.userId! },
    data: { requestId: crypto.randomUUID(), title: 'Legacy Markdown', contentMd: `![Legacy page](${expectedOrder[0]})`, isDraft: false },
  });
  expect(legacy.ok()).toBe(true);
  const legacyChapter = (await legacy.json()).metadata;
  await page.goto(`/comic/${result.slug}/chapters/${legacyChapter.chapterNo}`);
  await expect(page.getByAltText('Legacy page', { exact: true })).toHaveAttribute('src', expectedOrder[0]);
});

test('upload authorization and confirmation reject unauthenticated HTTP requests', async ({ request }) => {
  for (const endpoint of ['authorize', 'confirm']) {
    const response = await request.post(`http://localhost:3000/v1/api/upload/fan-art/${endpoint}`, { data: {} });
    expect(response.status()).toBe(401);
  }
});
