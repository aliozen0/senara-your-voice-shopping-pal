/**
 * AIServiceInterface
 * Tüm AI servisleri bu interface'i implemente eder.
 *
 * Metodlar:
 *  - parseIntent(userText: string): Promise<Intent>
 *  - analyzeImage(imageUrl: string): Promise<string>
 *  - analyzeReviews(reviews: string[]): Promise<ReviewAnalysis>
 *  - generateResponse(context: object, question: string): Promise<string>
 */
export class AIServiceInterface {
  // eslint-disable-next-line no-unused-vars
  async parseIntent(userText) {
    throw new Error("parseIntent() must be implemented");
  }
  // eslint-disable-next-line no-unused-vars
  async analyzeImage(imageUrl) {
    throw new Error("analyzeImage() must be implemented");
  }
  // eslint-disable-next-line no-unused-vars
  async analyzeReviews(reviews) {
    throw new Error("analyzeReviews() must be implemented");
  }
  // eslint-disable-next-line no-unused-vars
  async generateResponse(context, question) {
    throw new Error("generateResponse() must be implemented");
  }
}
