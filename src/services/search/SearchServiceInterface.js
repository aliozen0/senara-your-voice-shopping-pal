/**
 * SearchServiceInterface
 *  - searchProducts(query, filters): Promise<Product[]>
 *  - getProductDetail(url): Promise<Product>
 *  - comparePrice(productName): Promise<PriceResult[]>
 */
export class SearchServiceInterface {
  async searchProducts(_query, _filters) { throw new Error("not implemented"); }
  async getProductDetail(_url) { throw new Error("not implemented"); }
  async comparePrice(_productName) { throw new Error("not implemented"); }
}
