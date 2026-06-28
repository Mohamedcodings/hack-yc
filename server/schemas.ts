import { z } from 'zod'

const chatMessageSchema = z.object({
  role: z.enum(['agent', 'farmer']),
  text: z.string().min(1).max(2_000),
})

const farmContextSchema = z.object({
  activeView: z.string(),
  copiedCoordinate: z.string().nullable(),
  cropPlan: z.array(z.object({
    area: z.string(),
    crop: z.string(),
    name: z.string(),
  })),
  farm: z.object({
    area: z.string(),
    frontier: z.array(z.string()),
    location: z.string(),
  }),
  selectedZone: z.record(z.string(), z.unknown()).nullable(),
})

export const agentRequestSchema = z.object({
  farmContext: farmContextSchema,
  question: z.string().min(1).max(2_000),
  recentMessages: z.array(chatMessageSchema).max(12),
})

export const cropDoctorRequestSchema = z.object({
  activeMapView: z.string(),
  fileName: z.string().min(1).max(240),
  imageUrl: z.string().startsWith('data:image/').max(12_000_000),
  selectedZone: z.record(z.string(), z.unknown()).nullable(),
})

export type AgentRequest = z.infer<typeof agentRequestSchema>
export type CropDoctorRequest = z.infer<typeof cropDoctorRequestSchema>
