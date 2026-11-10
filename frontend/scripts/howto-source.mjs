import { createHash } from 'node:crypto'

// Hash executable content, locale and context narration; paths are not portable.
export const howToSourceFingerprint = (guide, language) => createHash('sha256').update(JSON.stringify({
  guideId: guide.id,
  helpGuideId: guide.helpGuideId || guide.id,
  language,
  title: guide.title || '',
  summary: guide.summary || '',
  narration: guide.narration || '',
  goal: guide.goal || '',
  why: guide.why || '',
  outcome: guide.outcome || '',
  steps: guide.steps || [],
  actions: guide.actions || [],
  script: guide.script || []
})).digest('hex')
