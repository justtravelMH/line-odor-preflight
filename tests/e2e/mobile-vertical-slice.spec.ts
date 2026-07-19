import {expect, test} from '@playwright/test';

test('mobile onboarding through deletion confirmation uses real APIs', async ({page}) => {
  await page.goto('/records');
  await expect(page.getByRole('button', {name: '重新登入 LINE'})).toBeVisible();

  const session = await page.request.post('/api/v1/auth/line/session', {data: {idToken: 'e2e-user-mobile-vertical-slice'}});
  expect(session.ok()).toBeTruthy();

  await page.goto('/onboarding');
  await page.getByRole('button', {name: '2', exact: true}).click();
  await page.getByRole('button', {name: '靠近砂盆'}).click();
  await page.getByText(/我同意保存主動提交的紀錄/).click();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', {name: '完成設定'}).click();
  await expect(page.getByTestId('onboarding-complete')).toContainText('首次設定已完成');

  await page.goto('/records');
  await expect(page.getByTestId('empty-records')).toContainText('還沒有紀錄');

  for (const [index, level] of [2, 2, 2].entries()) {
    const response = await page.request.post('/api/v1/records', {data: {odorLevel: level, sourceEventId: `e2e-baseline-${index}`}});
    expect(response.ok()).toBeTruthy();
  }
  await page.reload();
  await expect(page.getByTestId('records-list').locator('.row')).toHaveCount(3);

  await page.getByLabel('改善方式').selectOption('SCOOP_MORE');
  await page.getByRole('button', {name: '開始方案'}).click();
  await expect(page.getByTestId('current-plan')).toContainText('增加清理頻率');

  for (const [index, level] of [1, 1, 1].entries()) {
    const response = await page.request.post('/api/v1/records', {data: {odorLevel: level, sourceEventId: `e2e-post-${index}`}});
    expect(response.ok()).toBeTruthy();
  }
  await page.goto('/result');
  await expect(page.getByTestId('latest-result')).toContainText('POSSIBLE_IMPROVEMENT');

  await page.goto('/privacy');
  await page.getByText('我了解這項操作無法復原').click();
  await expect(page.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', {name: '送出刪除申請'}).click();
  await expect(page.getByTestId('deletion-status')).toContainText('PENDING');
});
