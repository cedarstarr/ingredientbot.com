import { describe, it, expect } from 'vitest'
import { sha256, canonicalize, TTL_MS } from '@/lib/recipe-cache'

describe('sha256', () => {
  it('returns a 64-character hex string', () => {
    const result = sha256('hello')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('is deterministic — same input produces same digest', () => {
    expect(sha256('hello')).toBe(sha256('hello'))
  })

  it('produces different digests for different inputs', () => {
    expect(sha256('hello')).not.toBe(sha256('world'))
  })

  it('accepts a Buffer input', () => {
    const result = sha256(Buffer.from('hello'))
    expect(result).toHaveLength(64)
    // Buffer and string of same content produce the same digest
    expect(result).toBe(sha256('hello'))
  })

  it('handles an empty string', () => {
    const result = sha256('')
    expect(result).toHaveLength(64)
  })
})

describe('canonicalize', () => {
  it('produces the same output for objects with different key order', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }))
  })

  it('sorts nested object keys recursively', () => {
    const a = { z: { b: 1, a: 2 }, y: 3 }
    const b = { y: 3, z: { a: 2, b: 1 } }
    expect(canonicalize(a)).toBe(canonicalize(b))
  })

  it('does NOT sort array elements (order is meaningful)', () => {
    expect(canonicalize(['b', 'a'])).not.toBe(canonicalize(['a', 'b']))
  })

  it('handles primitives — string', () => {
    expect(canonicalize('hello')).toBe('"hello"')
  })

  it('handles primitives — number', () => {
    expect(canonicalize(42)).toBe('42')
  })

  it('handles null', () => {
    expect(canonicalize(null)).toBe('null')
  })

  it('handles an empty object', () => {
    expect(canonicalize({})).toBe('{}')
  })

  it('handles an empty array', () => {
    expect(canonicalize([])).toBe('[]')
  })

  it('produces different output for different values', () => {
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 2 }))
  })
})

describe('TTL_MS constants', () => {
  it('suggestions TTL is 24 hours', () => {
    expect(TTL_MS.suggestions).toBe(24 * 60 * 60 * 1000)
  })

  it('photo TTL is 24 hours', () => {
    expect(TTL_MS.photo).toBe(24 * 60 * 60 * 1000)
  })

  it('comment TTL is 7 days', () => {
    expect(TTL_MS.comment).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
