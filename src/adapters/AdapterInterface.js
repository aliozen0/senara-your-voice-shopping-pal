/**
 * AdapterInterface
 * Yeni e-ticaret sitesi eklemek için bu interface'i implemente edip
 * /src/adapters/ klasörüne yeni bir dosya ekleyin. Başka hiçbir
 * dosyaya dokunmanıza gerek yoktur.
 *
 *  - siteName: string
 *  - urlPattern: RegExp
 *  - extractProduct(dom): Product
 *  - extractReviews(dom): string[]
 *  - extractPrice(dom): number
 *  - buildSearchUrl(query, filters): string
 */
export class AdapterInterface {
  get siteName() { throw new Error("siteName getter required"); }
  get urlPattern() { throw new Error("urlPattern getter required"); }
  extractProduct(_dom) { throw new Error("not implemented"); }
  extractReviews(_dom) { throw new Error("not implemented"); }
  extractPrice(_dom) { throw new Error("not implemented"); }
  buildSearchUrl(_query, _filters) { throw new Error("not implemented"); }
}
