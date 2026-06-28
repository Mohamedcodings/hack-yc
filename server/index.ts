import express from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'
import { ZodError } from 'zod'

import { config } from './config.js'
import {
  fetchSatelliteContext,
  fetchSoilContext,
  fetchWeatherContext,
  getLiveDataSources,
  getLiveFarmContext,
} from './connectors.js'
import { dataExchangeCatalogVersion, dataProducts } from './data-exchange/catalog.js'
import { buildDataExchangeManifest } from './data-exchange/exporter.js'
import { dataGovernancePolicy, governanceVersion } from './data-exchange/governance.js'
import { farmId } from './farm.js'
import { getOntologySnapshot } from './intelligence/ontology.js'
import { runAgronomicIntelligence } from './intelligence/pipeline.js'
import { createModelResponse } from './openai.js'
import { buildAgentInput, buildCropDoctorInput } from './prompts.js'
import { agentRequestSchema, cropDoctorRequestSchema, dataExchangeRequestSchema } from './schemas.js'

const app = express()
const authEnabled = Boolean(config.clerkSecretKey)

app.use(express.json({ limit: '12mb' }))
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')

  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }

  next()
})

if (authEnabled) {
  app.use(
    clerkMiddleware({
      publishableKey: config.clerkPublishableKey,
      secretKey: config.clerkSecretKey,
    }),
  )
}

const requireAuth: express.RequestHandler = (request, response, next) => {
  if (!authEnabled) {
    next()
    return
  }

  const { userId } = getAuth(request)

  if (!userId) {
    response.status(401).json({
      error: 'Authentication required',
    })
    return
  }

  next()
}

app.get('/api/health', (_request, response) => {
  response.json({
    auth: authEnabled ? 'clerk' : 'demo',
    ok: true,
    model: config.openAIModel,
    service: 'demeter-api',
  })
})

app.get('/api/sources', async (_request, response, next) => {
  try {
    response.json({
      farmId,
      generatedAt: new Date().toISOString(),
      sources: await getLiveDataSources(),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/live/weather', async (_request, response, next) => {
  try {
    response.json(await fetchWeatherContext())
  } catch (error) {
    next(error)
  }
})

app.get('/api/live/soil', async (_request, response, next) => {
  try {
    response.json(await fetchSoilContext())
  } catch (error) {
    next(error)
  }
})

app.get('/api/live/satellite', async (_request, response, next) => {
  try {
    response.json(await fetchSatelliteContext())
  } catch (error) {
    next(error)
  }
})

app.get('/api/farm-context', requireAuth, async (_request, response, next) => {
  try {
    response.json({
      context: await getLiveFarmContext(),
      farmId,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/intelligence/field-state', requireAuth, async (_request, response, next) => {
  try {
    const context = await getLiveFarmContext()

    response.json({
      context,
      farmId,
      intelligence: runAgronomicIntelligence(context),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/intelligence/ontology', (_request, response) => {
  response.json(getOntologySnapshot())
})

app.get('/api/data-exchange/catalog', (_request, response) => {
  response.json({
    catalogVersion: dataExchangeCatalogVersion,
    dataProducts,
    generatedAt: new Date().toISOString(),
    positioning: 'Consent-aware agriculture data exchange for public-sector and enterprise analytics.',
  })
})

app.get('/api/data-exchange/governance', (_request, response) => {
  response.json({
    governanceVersion,
    policy: dataGovernancePolicy,
  })
})

app.post('/api/data-exchange/export', requireAuth, async (request, response, next) => {
  try {
    const payload = dataExchangeRequestSchema.parse(request.body)
    const context = await getLiveFarmContext()
    const intelligence = runAgronomicIntelligence(context)

    response.json(buildDataExchangeManifest(payload, context, intelligence))
  } catch (error) {
    next(error)
  }
})

app.post('/api/agent', requireAuth, async (request, response, next) => {
  try {
    const payload = agentRequestSchema.parse(request.body)
    const answer = await createModelResponse({
      input: buildAgentInput(payload),
      max_output_tokens: 260,
    })

    response.json({ answer })
  } catch (error) {
    next(error)
  }
})

app.post('/api/crop-doctor', requireAuth, async (request, response, next) => {
  try {
    const payload = cropDoctorRequestSchema.parse(request.body)
    const answer = await createModelResponse({
      input: buildCropDoctorInput(payload),
      max_output_tokens: 520,
    })

    response.json({ answer })
  } catch (error) {
    next(error)
  }
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Invalid request payload',
      issues: error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
    })
    return
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error'
  const status = message.includes('Missing OPENAI_API_KEY') ? 503 : 500

  response.status(status).json({ error: message })
})

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Demeter API listening on http://127.0.0.1:${config.port}`)
  })
}

export default app
