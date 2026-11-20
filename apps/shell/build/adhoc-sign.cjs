/**
 * Internal macOS build: no Developer ID and no notarization, but Apple Silicon
 * requires at least an ad-hoc signature for the app to launch. Sign the packed
 * bundle (and its nested helpers) in place before the dmg is assembled.
 */
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  )
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  })
  console.log(`[adhoc-sign] signed ${appPath}`)
}
