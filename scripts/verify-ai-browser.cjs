/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node QA script */
/* Browser regression checks against a local server or the exact Preview URL.
 * Playwright is a QA tool supplied separately, not an application dependency.
 * CARRIME_PLAYWRIGHT_PATH may point to its installed module.
 * All application-record reads/writes are intercepted with synthetic data.
 * CARRIME_LIVE_AI=1 permits ONE synthetic Gemini generation on Preview only.
 */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CARRIME_PLAYWRIGHT_PATH || 'playwright');
const base = new URL(process.env.CARRIME_BROWSER_BASE_URL || 'http://localhost:3137');
const inputs = { pr_summary: '架空の検証データ：業務改善', episode: '架空の検証データです。事務作業の手順を整理してチームで共有しました。', policy: '協力', occupation: '事務' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const checks = [];
  const record = (name, details = {}) => { checks.push({ name, ...details }); console.log(JSON.stringify({ check: name, status: 'pass', ...details })); };
  async function setup({ stored = JSON.stringify(inputs), quota = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (process.env.VERCEL_OIDC_TOKEN) {
      await context.route(`${base.origin}/**`, (route) => route.continue({ headers: { ...route.request().headers(),
        'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN } }));
    }
    await context.addInitScript(({ stored, quota }) => {
      if (stored !== null) localStorage.setItem('carrime_ai_inputs', stored);
      localStorage.setItem('carrime_resume_id', 'res_0000000000000');
      if (quota) Storage.prototype.setItem = () => { throw new DOMException('Synthetic quota', 'QuotaExceededError'); };
    }, { stored, quota });
    const page = await context.newPage();
    const state = { reads: 0, aiCalls: 0, mode: 'success', statuses: [], telemetry: [], pageErrors: [], depthErrors: 0, dialogs: 0 };
    page.on('pageerror', (error) => state.pageErrors.push(error.name));
    page.on('console', (message) => { if (message.text().includes('Maximum update depth')) state.depthErrors++; });
    page.on('dialog', async (dialog) => { state.dialogs++; await dialog.dismiss(); });
    await page.route('**/api/data/**', async (route) => {
      state.reads++;
      const path = new URL(route.request().url()).pathname;
      const works = [{ company_name: '架空の検証企業', start_year: 2020, start_month: 4, description: '架空の職歴。資料の作成と問い合わせ対応、業務手順の整理を担当しました。' }];
      const json = path.endsWith('/lookups') ? [] : path.endsWith('/education') ? { educations: [] }
        : path.endsWith('/work') ? { works: [] } : { resume: { self_pr: '', summary: '', transferable_skills: '' }, works };
      await route.fulfill({ json });
    });
    await page.route('**/api/telemetry/ai', async (route) => {
      const row = route.request().postDataJSON();
      assert.ok(Object.keys(row).every((key) => ['route', 'code', 'correlationId', 'status'].includes(key)));
      assert.ok(!JSON.stringify(row).includes(inputs.episode));
      state.telemetry.push(row);
      await route.fulfill({ status: 204 });
    });
    await page.route('**/api/ai/*', async (route) => {
      state.aiCalls++;
      if (state.mode === 'live') return route.fallback();
      if (state.mode === 'network') return route.abort('internetdisconnected');
      await sleep(200);
      const id = route.request().headers()['x-correlation-id'];
      if (state.mode === 'success') return route.fulfill({ json: { result: '架空の検証：生成が成功しました。', correlationId: id } });
      if (state.mode === 'html') return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' });
      if (state.mode === 'invalid') return route.fulfill({ json: { unexpected: true } });
      const status = Number(state.mode);
      return route.fulfill({ status, json: { error: 'INTERNAL-PRIVATE-DATA-DO-NOT-DISPLAY', correlationId: id } });
    });
    return { context, page, state };
  }

  try {
    const { context, page, state } = await setup();
    if (process.env.CARRIME_LIVE_AI === '1') {
      const id = '12345678-1234-4123-8123-123456789abc';
      await page.route('**/api/crm-auth/sign-in/email', (route) => route.fulfill({ status: 403,
        json: { code: 'INVALID_ORIGIN', message: 'PRIVATE-AUTH-MESSAGE', correlationId: id } }));
      await page.goto(`${base.origin}/crm/login`);
      await page.getByLabel('メールアドレス').fill('synthetic@example.test');
      await page.getByLabel('パスワード', { exact: true }).fill('Synthetic-password-97531');
      await page.getByRole('button', { name: 'ログイン', exact: true }).click();
      const notice = page.getByRole('alert').filter({ hasText: id });
      await notice.waitFor();
      assert.match(await notice.innerText(), /URL/);
      assert.ok(!(await notice.innerText()).includes('PRIVATE-AUTH-MESSAGE'));
      assert.equal(await page.getByLabel('パスワード', { exact: true }).inputValue(), 'Synthetic-password-97531');
      record('CRM origin failure: safe message/support ID, credentials retained');
    }
    await page.goto(`${base.origin}/cv/1`);
    await page.getByRole('button', { name: '自己PRの生成へ進む' }).click();
    await page.waitForURL('**/cv/2');
    await page.waitForTimeout(2500);
    assert.ok(state.reads <= 2, `Unexpected repeated record loads: ${state.reads}`);
    assert.equal(state.depthErrors, 0);
    record('CV1→CV2: no repeated initialization', { recordReads: state.reads });
    const draft = page.locator('textarea');
    const generate = page.getByRole('button', { name: /AIで自己PRを生成する/ });
    await draft.fill('編集中の文章を保持するテスト');
    for (const mode of ['400', '429', '500', '502', '503', 'html', 'invalid', 'network']) {
      state.mode = mode;
      const before = state.aiCalls;
      await generate.click();
      await page.getByRole('alert').filter({ hasText: 'お問い合わせID:' }).waitFor();
      assert.equal(await draft.inputValue(), '編集中の文章を保持するテスト');
      const text = await page.getByRole('alert').filter({ hasText: 'お問い合わせID:' }).innerText();
      assert.match(text, /お問い合わせID: [0-9a-f-]{36}/i);
      assert.ok(!text.includes('INTERNAL-PRIVATE-DATA'));
      assert.equal(state.aiCalls - before, 1);
      record(`AI failure ${mode}: inline message, ID, retained draft`);
    }
    state.mode = 'success';
    await page.getByRole('button', { name: 'もう一度試す' }).click();
    await page.waitForFunction(() => document.querySelector('textarea').value.includes('生成が成功'));
    assert.equal(await page.getByRole('alert').filter({ hasText: 'お問い合わせID:' }).count(), 0);
    const before = state.aiCalls;
    await generate.evaluate((button) => { button.click(); button.click(); button.click(); });
    await page.waitForTimeout(700);
    assert.equal(state.aiCalls - before, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('carrime_ai_inputs')), JSON.stringify(inputs));
    assert.equal(state.dialogs, 0);
    record('Explicit retry and rapid-click suppression; original inputs retained');

    if (process.env.CARRIME_LIVE_AI === '1') {
      assert.ok(base.protocol === 'https:' && base.hostname.endsWith('.vercel.app'), 'Live verification is Preview-only');
      state.mode = 'live';
      await generate.click();
      await page.waitForFunction(() => { const el = document.querySelector('textarea'); return el && el.value.length > 100; }, null, { timeout: 65_000 });
      assert.equal(await page.getByRole('alert').filter({ hasText: 'お問い合わせID:' }).count(), 0);
      record('Preview browser → real Gemini → text', { generatedCharacters: (await draft.inputValue()).length });
    }

    await page.goto(`${base.origin}/cv/3`);
    await page.getByText('1件', { exact: true }).waitFor();
    state.mode = 'html';
    await page.getByRole('button', { name: /AIで職務要約を書く/ }).click();
    await page.getByRole('alert').filter({ hasText: 'お問い合わせID:' }).waitFor();
    state.mode = 'success';
    await page.getByRole('button', { name: 'もう一度試す' }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('textarea')).some((t) => t.value.includes('生成が成功')));
    await page.getByRole('button', { name: /AIで生成する/ }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('textarea')).filter((t) => t.value.includes('生成が成功')).length === 2);
    record('CV3 summary/experience share safe error/retry handling');
    for (const path of ['/resume/3', '/resume/4']) {
      const reads = state.reads;
      await page.goto(base.origin + path);
      await page.waitForTimeout(1000);
      assert.ok(state.reads - reads <= 2, `Record load loop on ${path}`);
    }
    assert.equal(state.depthErrors, 0);
    assert.deepEqual(state.pageErrors, []);
    record('Education/work pages: stable navigation effects, no browser exceptions');
    await context.close();

    for (const stored of [null, '{']) {
      const { context, page } = await setup({ stored });
      await page.goto(`${base.origin}/cv/2`);
      await page.getByRole('alert').filter({ hasText: 'お問い合わせID:' }).waitFor();
      assert.equal(await page.getByRole('button', { name: /AIで自己PRを生成する/ }).isDisabled(), true);
      assert.equal(await page.evaluate(() => localStorage.getItem('carrime_ai_inputs')), stored);
      await context.close();
    }
    record('Missing/corrupt localStorage: guidance without deletion or automatic redirect');
    const quota = await setup({ quota: true });
    await quota.page.goto(`${base.origin}/cv/1`);
    await quota.page.getByRole('button', { name: '自己PRの生成へ進む' }).click();
    await quota.page.getByRole('alert').filter({ hasText: 'お問い合わせID:' }).waitFor();
    assert.ok(quota.page.url().includes('/cv/1'));
    assert.equal(await quota.page.locator('textarea').nth(1).inputValue(), inputs.episode);
    await quota.context.close();
    record('Storage write failure: retain form and stop navigation');
    console.log(JSON.stringify({ checksPassed: checks.length, applicationRecordsRead: 0, applicationRecordsWritten: 0 }));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
