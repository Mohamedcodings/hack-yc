import { config, assertConfigured } from './config.ts'

type ResponsesPayload = {
  input: unknown[]
  max_output_tokens: number
}

export function extractOpenAIText(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'output_text' in payload &&
    typeof (payload as { output_text?: unknown }).output_text === 'string'
  ) {
    return (payload as { output_text: string }).output_text
  }

  if (!payload || typeof payload !== 'object' || !('output' in payload)) {
    return null
  }

  const output = (payload as { output?: unknown }).output

  if (!Array.isArray(output)) {
    return null
  }

  return output
    .flatMap((item) => {
      if (!item || typeof item !== 'object' || !('content' in item)) {
        return []
      }

      const content = (item as { content?: unknown }).content

      if (!Array.isArray(content)) {
        return []
      }

      return content.flatMap((part) => {
        if (!part || typeof part !== 'object' || !('text' in part)) {
          return []
        }

        const text = (part as { text?: unknown }).text
        return typeof text === 'string' ? [text] : []
      })
    })
    .join('\n')
    .trim()
}

export async function createModelResponse({ input, max_output_tokens }: ResponsesPayload) {
  assertConfigured()

  const response = await fetch('https://api.openai.com/v1/responses', {
    body: JSON.stringify({
      input,
      max_output_tokens,
      model: config.openAIModel,
    }),
    headers: {
      Authorization: `Bearer ${config.openAIKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 240)}`)
  }

  const payload: unknown = await response.json()
  const text = extractOpenAIText(payload)

  if (!text) {
    throw new Error('OpenAI returned no text')
  }

  return text
}
