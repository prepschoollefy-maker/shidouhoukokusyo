import { randomBytes } from 'crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

/** 8文字の短いランダムトークンを生成（紛らわしい文字 0,O,1,l,I を除外） */
export function generateShortToken(length = 8): string {
  const bytes = randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return result
}
