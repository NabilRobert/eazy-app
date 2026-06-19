import { describe, it, expect } from 'vitest'
import { ScreeningService } from '../server/services/screening.service'

describe('ScreeningService', () => {
  it('detects relocation questions', () => {
    expect(ScreeningService.detectRelocationQuestion('Are you willing to relocate?')).toBe(true)
    expect(ScreeningService.detectRelocationQuestion('What is your expected salary?')).toBe(false)
  })

  it('recognizes standard answerable questions', () => {
    expect(ScreeningService.isStandardAnswerable('Expected salary?', {})).toBe(true)
    expect(ScreeningService.isStandardAnswerable('Are you authorized to work in the US?', {})).toBe(true)
    expect(ScreeningService.isStandardAnswerable('Describe a time you led a project', {})).toBe(false)
    expect(ScreeningService.isStandardAnswerable('Portfolio URL', { 'portfolio url': 'x.com' })).toBe(true)
  })

  it('returns only custom open-ended questions', () => {
    const custom = ScreeningService.detectCustomQuestions(
      ['Why do you want this job?', 'Years of experience', 'Are you willing to relocate?'],
      {}
    )
    expect(custom).toContain('Why do you want this job?')
    expect(custom).not.toContain('Years of experience')
    expect(custom).not.toContain('Are you willing to relocate?')
  })

  it('classifies screening reasons', () => {
    const r1 = ScreeningService.classifyScreening(['Are you willing to relocate?', 'Expected salary?'], {})
    expect(r1.reasons).toContain('relocation_question')
    expect(r1.reasons).not.toContain('custom_screening')

    const r2 = ScreeningService.classifyScreening(['Why do you want this job?', 'Years of experience'], {})
    expect(r2.reasons).toContain('custom_screening')
    expect(r2.customQuestions).toContain('Why do you want this job?')

    const r3 = ScreeningService.classifyScreening(['First name', 'Email', 'Phone'], {})
    expect(r3.reasons).toHaveLength(0)
  })
})
