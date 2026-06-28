import express from 'express'
import { ZodError } from 'zod'

import { config } from './config.ts'
import {
  fetchSatelliteContext,
  fetchSoilContext,
  fetchWeatherContext,
  getLiveDataSources,
  getLiveFarmContext,
} from './connectors.ts'
import { farmId } from './farm.ts'
import { getOntologySnapshot } from './intelligence/ontology.ts'
import { runAgronomicIntelligence } from './intelligence/pipeline.ts'
import { createModelResponse } from './openai.ts'
import { buildAgentInput, buildCropDoctorInput } from './prompts.ts'
import { agentRequestSchema, cropDoctorRequestSchema } from './schemas.ts'

const app = express()

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

app.get('/api/health', (_request, response) => {
  response.json({
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

app.get('/api/farm-context', async (_request, response, next) => {
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

app.get('/api/intelligence/field-state', async (_request, response, next) => {
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

app.post('/api/agent', async (request, response, next) => {
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

app.post('/api/crop-doctor', async (request, response, next) => {
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

app.listen(config.port, () => {
  console.log(`Demeter API listening on http://127.0.0.1:${config.port}`)
})
