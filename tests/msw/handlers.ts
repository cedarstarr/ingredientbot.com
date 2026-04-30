import { http, HttpResponse } from 'msw'

export const handlers = [
  // Anthropic
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'mock-msg-id',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [{ type: 'text', text: 'Mock response from MSW' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    })
  }),
]
