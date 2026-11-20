import { test, expect } from '@playwright/test'
import { launchShell, closeAndSaveVideo, waitForPageWithUrl } from './helpers'

test.describe('tab bar', () => {
  test('middle-clicking a tab closes it', async () => {
    const launched = await launchShell({ onboardingSeen: true, videoDir: 'tab-middle-click-close' })
    const { app, page } = launched
    try {
      await page.locator('.quick-card').first().click()
      const editorTab = page.locator('.tab-bar .tab-item:not(.tab-home)')
      await expect(editorTab).toHaveCount(1)
      await waitForPageWithUrl(app, '://docs/')

      await editorTab.click({ button: 'middle' })
      await expect(editorTab).toHaveCount(0)
      await expect(page.locator('.home-hero')).toBeVisible()
    } finally {
      await closeAndSaveVideo(launched, 'tab-middle-click-close')
    }
  })
})
