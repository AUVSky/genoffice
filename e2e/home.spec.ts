import { test, expect } from '@playwright/test'
import { launchShell, closeAndSaveVideo, screenshotPath } from './helpers'

test.describe('home screen', () => {
  test('shows hero, quick-create cards and tab bar', async () => {
    const launched = await launchShell({ onboardingSeen: true, videoDir: 'home-basics' })
    const { page } = launched
    try {
      await expect(page.locator('.home-hero')).toBeVisible()
      // five editor quick-create cards plus the "Open file" browse card
      await expect(page.locator('.quick-card')).toHaveCount(6)
      await expect(page.locator('.quick-card').first()).toContainText('Word')
      await expect(page.locator('.quick-card').nth(1)).toContainText('Excel')
      await expect(page.locator('.quick-card').nth(2)).toContainText('PPT')
      await expect(page.locator('.quick-card').nth(3)).toContainText('Markdown')
      await expect(page.locator('.quick-card').nth(4)).toContainText('PDF')
      // the launcher is not a tab: the home surface shows and the strip is empty
      await expect(page.locator('.home-hero')).toBeVisible()
      await expect(page.locator('.tab-settings-btn')).toBeVisible()
      await page.screenshot({ path: screenshotPath('home-overview') })
    } finally {
      await closeAndSaveVideo(launched, 'home-basics')
    }
  })

  test('renders localized UI when GENOFFICE_LANG=zh-CN', async () => {
    const launched = await launchShell({
      onboardingSeen: true,
      lang: 'zh-CN',
      videoDir: 'home-zh-cn',
    })
    const { page } = launched
    try {
      await expect(
        page.locator('.toolbar-filters .filter-pills').nth(1).locator('.filter-pill').first(),
      ).toHaveText('全部')
      await page.screenshot({ path: screenshotPath('home-zh-cn') })
    } finally {
      await closeAndSaveVideo(launched, 'home-zh-cn')
    }
  })
})
