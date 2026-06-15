/**
 * Service for detecting and handling screening questions
 */
export class ScreeningService {
  /**
   * Detect relocation question
   */
  static detectRelocationQuestion(formHtml: string): boolean {
    const relocationPatterns = [
      /willing.*relocate/i,
      /relocat/i,
      /move.*location/i,
      /based.*location/i
    ]

    return relocationPatterns.some(pattern => pattern.test(formHtml))
  }

  /**
   * Detect custom open-ended screening questions
   */
  static detectCustomQuestions(formHtml: string): string[] {
    const questions: string[] = []

    // TODO: Parse form fields and identify:
    // - Open-ended text fields (not pre-answered)
    // - Questions not in standard Easy Apply set
    // - Custom company questions

    return questions
  }

  /**
   * Check if question is standard and answerable
   */
  static isAnswerable(question: string, prefilledAnswers: Record<string, string>): boolean {
    const standardPatterns = [
      /current.*salary/i,
      /expected.*salary/i,
      /work.*authorization/i,
      /notice.*period/i,
      /years.*experience/i,
      /education/i
    ]

    return (
      standardPatterns.some(pattern => pattern.test(question)) ||
      Object.values(prefilledAnswers).some(answer => answer.length > 0)
    )
  }
}
