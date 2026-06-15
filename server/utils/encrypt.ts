import crypto from 'crypto'

const config = useRuntimeConfig()

// AES-256-GCM encryption for session cookies
export function encryptSessionCookie(data: Record<string, any>): string {
  const secret = config.encrypt_secret
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPT_SECRET must be at least 32 bytes (64 hex chars)')
  }

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(secret, 'hex'),
    iv
  )

  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv + authTag + encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptSessionCookie(encrypted: string): Record<string, any> {
  const secret = config.encrypt_secret
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPT_SECRET must be at least 32 bytes (64 hex chars)')
  }

  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(secret, 'hex'),
    iv
  )

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}
