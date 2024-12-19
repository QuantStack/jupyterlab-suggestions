import { expect, test, galata } from '@jupyterlab/galata';
import path from 'path';

const BACKEND = process.env.BACKEND ?? 'rtc';
test.use({ autoGoto: false });

test.describe('UI Test', () => {
  test.describe('Extension activation test', () => {
    test('should emit an activation console message', async ({
      page,
      request
    }) => {
      const logs: string[] = [];

      page.on('console', message => {
        logs.push(message.text());
      });

      await page.goto();
      const expectedExtension = BACKEND === 'rtc' ? 7 : 6;
      expect(logs.filter(s => s.includes('@jupyter/suggestions'))).toHaveLength(
        expectedExtension
      );
      await page.getByTitle('Jupyter Suggestions');
      expect(await page.screenshot()).toMatchSnapshot({
        name: `${BACKEND}-main-page.png`
      });
    });
  });
});
