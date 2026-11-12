import test from 'node:test'
import assert from 'node:assert/strict'

function isSafeExtractionPath(destinationRoot, entryName) {
  const normalize = (value) => {
    const parts = []
    value.replace(/\\/g, '/').split('/').forEach((part) => {
      if (!part || part === '.') return
      if (part === '..') {
        if (parts.length && parts[parts.length - 1] !== '..') parts.pop()
        else parts.push('..')
        return
      }
      parts.push(part)
    })
    return parts.join('/').replace(/\/$/, '').toLowerCase()
  }
  if (/^(?:[a-z]:[\\/]|[\\/]{2})/i.test(entryName)) return false
  const root = normalize(destinationRoot)
  const candidate = normalize(`${destinationRoot}/${entryName}`)
  return candidate === root || candidate.startsWith(`${root}/`)
}

test('permite archivos dentro del destino', () => {
  assert.equal(isSafeExtractionPath('C:/Projects/demo', 'assets/logo.png'), true)
})

test('rechaza traversal con ..', () => {
  assert.equal(isSafeExtractionPath('C:/Projects/demo', '../../Users/Public/file.txt'), false)
})

test('rechaza una ruta absoluta fuera del destino', () => {
  assert.equal(isSafeExtractionPath('C:/Projects/demo', 'C:/Windows/System32/file.dll'), false)
})
