import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../server/utils/password'

describe('password hashing', () => {
  it('produces a salt:hash hex string', () => {
    expect(hashPassword('hunter2-secret')).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
  })

  it('verifies the correct password', () => {
    const h = hashPassword('hunter2-secret')
    expect(verifyPassword('hunter2-secret', h)).toBe(true)
  })

  it('rejects the wrong password', () => {
    const h = hashPassword('hunter2-secret')
    expect(verifyPassword('wrong', h)).toBe(false)
  })

  it('uses a random salt (two hashes differ)', () => {
    expect(hashPassword('x')).not.toBe(hashPassword('x'))
  })

  it('rejects a malformed stored hash', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false)
  })
})
