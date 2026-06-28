import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

function configuredSecret(value: string | undefined) {
  if (!value || value.includes('your-key-here')) {
    return undefined
  }

  return value
}

export const config = {
  clerkPublishableKey: configuredSecret(process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY),
  clerkSecretKey: configuredSecret(process.env.CLERK_SECRET_KEY),
  dataMode: process.env.DEMETER_DATA_MODE ?? 'auto',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  openAIModel: process.env.OPENAI_MODEL ?? process.env.VITE_OPENAI_MODEL ?? 'gpt-4.1-mini',
  openAIKey: process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_API_KEY,
  port: Number(process.env.API_PORT ?? 8787),
}

export function assertConfigured() {
  if (!config.openAIKey) {
    throw new Error('Missing OPENAI_API_KEY. Add it to .env.local before using AI endpoints.')
  }
}
