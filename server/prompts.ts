import type { AgentRequest, CropDoctorRequest } from './schemas.js'

export function buildAgentInput(request: AgentRequest) {
  return [
    {
      content: [
        {
          text: `You are Demeter, a concise farm operating agent for a real satellite map demo.
Speak like an expert agronomist and product-grade farm assistant.
Use the provided farm context and never pretend that live backend data exists.
If the farmer pasted coordinates, treat them as the current place of interest.
Keep answers short, operational, and specific: what you see, why it matters, what to do next.
Avoid generic disclaimers, fake confidence scores, and long explanations.`,
          type: 'input_text',
        },
      ],
      role: 'system',
    },
    {
      content: [
        {
          text: JSON.stringify(request, null, 2),
          type: 'input_text',
        },
      ],
      role: 'user',
    },
  ]
}

export function buildCropDoctorInput(request: CropDoctorRequest) {
  return [
    {
      content: [
        {
          text: `You are Crop Doctor inside Demeter, a farm operating system.
Analyze the uploaded crop/leaf photo for likely disease, pest pressure, nutrient stress, or pesticide/fungicide considerations.
Use practical farmer language. Return:
1. Likely issue
2. Evidence visible in the image
3. Severity
4. What to check in the field
5. Treatment / pesticide guidance
6. When to call an agronomist
Be careful: phrase pesticide advice as guidance to verify against local regulations and label instructions. Do not claim certainty from one photo.`,
          type: 'input_text',
        },
        {
          image_url: request.imageUrl,
          type: 'input_image',
        },
      ],
      role: 'user',
    },
    {
      content: [
        {
          text: JSON.stringify({
            activeMapView: request.activeMapView,
            fileName: request.fileName,
            selectedZone: request.selectedZone,
            supportedReferenceClasses: [
              'Apple scab',
              'Corn rust',
              'Grape black rot',
              'Potato early blight',
              'Potato late blight',
              'Tomato bacterial spot',
              'Tomato late blight',
              'Tomato leaf mold',
              'Wheat rust',
              'Rice blast',
            ],
          }),
          type: 'input_text',
        },
      ],
      role: 'user',
    },
  ]
}
