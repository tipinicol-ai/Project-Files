const fs = require('node:fs')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const executable = path.join(context.appOutDir, 'Project Files.exe')
  const launcher = path.join(context.appOutDir, 'Project Files Web Server.exe')
  if (fs.existsSync(executable)) fs.copyFileSync(executable, launcher)
}
