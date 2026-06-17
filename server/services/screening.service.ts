/**
 * Service for detecting and classifying Easy Apply screening questions.
 * Pure functions over question-label text — no browser dependency — so the
 * worker can call them with labels scraped from the open modal.
 */
export class ScreeningService {
  /** Standard questions covered by candidate profile / prefilled answers. */
  private static readonly STANDARD_PATTERNS = [
    /current.*salary/i,
    /expected.*salary/i,
    /desired.*salary/i,
    /salary.*expectation/i,
    /work.*authoriz/i,
    /authoriz.*work/i,
    /legally.*work/i,
    /sponsor/i,
    /notice.*period/i,
    /years.*experience/i,
    /how many years/i,
    /education/i,
    /degree/i,
    /first name/i,
    /last name/i,
    /full name/i,
    /email/i,
    /phone|mobile/i
  ]

  /**
   * True if the question asks about relocation. Flagged to review regardless
   * of whether it looks auto-answerable, per the V1 plan.
   */
  static detectRelocationQuestion(text: string): boolean {
    const relocationPatterns = [
      /willing.*relocat/i,
      /able.*relocat/i,
      /relocat/i,
      /willing.*move/i,
      /open.*to.*reloc/i
    ]
    return relocationPatterns.some((pattern) => pattern.test(text))
  }

  /**
   * True if the question is a standard field we can answer automatically,
   * either by matching a known standard pattern or a prefilled answer key.
   */
  static isStandardAnswerable(question: string, prefilledAnswers: Record<string, string>): boolean {
    if (this.STANDARD_PATTERNS.some((pattern) => pattern.test(question))) return true

    const nq = question.toLowerCase().replace(/[^a-z0-9]/g, '')
    return Object.entries(prefilledAnswers).some(([key, val]) => {
      if (!val) return false
      const nk = key.toLowerCase().replace(/[^a-z0-9]/g, '')
      return !!nk && (nq.includes(nk) || nk.includes(nq))
    })
  }

  /**
   * Return the subset of labels that are custom/open-ended screening
   * questions: not relocation (handled separately) and not auto-answerable.
   */
  static detectCustomQuestions(labels: string[], prefilledAnswers: Record<string, string>): string[] {
    return labels.filter(
      (label) =>
        !!label &&
        !this.detectRelocationQuestion(label) &&
        !this.isStandardAnswerable(label, prefilledAnswers)
    )
  }

  /**
   * Classify a step's question labels into review-queue reason codes.
   * - relocation_question: any relocation prompt present
   * - custom_screening: one or more custom/open-ended questions present
   */
  static classifyScreening(
    labels: string[],
    prefilledAnswers: Record<string, string>
  ): { relocation: boolean; customQuestions: string[]; reasons: string[] } {
    const relocation = labels.some((label) => this.detectRelocationQuestion(label))
    const customQuestions = this.detectCustomQuestions(labels, prefilledAnswers)

    const reasons: string[] = []
    if (relocation) reasons.push('relocation_question')
    if (customQuestions.length) reasons.push('custom_screening')

    return { relocation, customQuestions, reasons }
  }
}
