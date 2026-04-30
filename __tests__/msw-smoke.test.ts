import { describe, it, expect } from 'vitest'

describe('MSW intercepts external API calls', () => {
  it('intercepts Anthropic API and returns mock response', async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'test-key',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hello' }],
      }),
    })

    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.id).toBe('mock-msg-id')
    expect(data.content[0].text).toBe('Mock response from MSW')
  })
})
