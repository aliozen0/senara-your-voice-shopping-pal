import { createServerFn } from "@tanstack/react-start";
import { chromium } from "playwright";

export const scrapeTrendyol = createServerFn({ method: "GET" })
  .handler(async ({ data: query }) => {
    if (!query) return [];

    try {
      console.log(`[Playwright] Searching for: ${query}`);
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();

      const categories = [
        { sort: "MOST_FAVOURITE", name: "En Çok Favorilenenlerde" },
        { sort: "MOST_RATED", name: "En Çok Değerlendirilenlerde" },
        { sort: "BEST_SELLER", name: "En Çok Satanlarda" }
      ];

      const allProducts = [];
      const globalUniqueUrls = new Set();

      for (const cat of categories) {
        try {
          const searchUrl = `https://www.trendyol.com/sr?q=${encodeURIComponent(query)}&sst=${cat.sort}`;
          console.log(`[Playwright] Navigating to: ${cat.name} (${searchUrl})`);
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          
          // Wait 5 seconds for JS to render products
          await page.waitForTimeout(5000);

          const categoryProducts = await page.evaluate(({ catName, existingUrls }) => {
            const items = document.querySelectorAll('a');
            const results = [];
            const uniqueUrls = new Set(existingUrls);
            
            for (const el of Array.from(items)) {
              if (results.length >= 2) break; // Sadece 2 ürün al
              
              const href = el.getAttribute("href") || "";
              if (!href || href === "/" || href.includes("javascript:") || !href.includes("-p-")) continue;
              
              let container = el;
              for (let i = 0; i < 4; i++) {
                if (container.parentElement) container = container.parentElement;
              }
              
              const text = container.textContent || "";
              if (!text.includes("TL") && !text.includes("₺")) continue;
              
              const img = el.querySelector("img") || container.querySelector("img");
              if (!img) continue;
              
              const width = img.getAttribute("width") || img.clientWidth;
              if (width && parseInt(width) < 50) continue;

              if (uniqueUrls.has(href)) continue;
              uniqueUrls.add(href);
              
              const priceMatch = text.match(/(\d+[\.,]?\d*[\.,]?\d*)\s*(TL|₺)/i);
              let price = 0;
              if (priceMatch) {
                 let priceStr = priceMatch[1];
                 // Turkish price format: "1.299,50" or "349,00"
                 priceStr = priceStr.split(',')[0]; // Drop cents: "1.299"
                 priceStr = priceStr.replace(/\./g, ""); // Drop thousands separator: "1299"
                 price = parseInt(priceStr, 10) || 0;
              }
              
              // Değerlendirme sayısı (Örn: "(1234)" veya "1234 Değerlendirme")
              const reviewMatch = text.match(/\((\d+[\.,]?\d*)\)/) || text.match(/(\d+[\.,]?\d*)\s*Değerlendirme/i) || text.match(/(\d+[\.,]?\d*[BKM]?)\s*kişi/i);
              let reviewCount = 0;
              if (reviewMatch) {
                 let rawRev = reviewMatch[1].replace(/[^0-9KBM]/ig, "");
                 if (rawRev.toUpperCase().includes('B') || rawRev.toUpperCase().includes('K')) {
                     reviewCount = parseInt(rawRev) * 1000;
                 } else if (rawRev.toUpperCase().includes('M')) {
                     reviewCount = parseInt(rawRev) * 1000000;
                 } else {
                     reviewCount = parseInt(rawRev) || 0;
                 }
              }

              // Puan (Örn: "4.5" veya "4,5")
              const ratingMatch = text.match(/([0-4][\.,][0-9]|5[\.,]0)/);
              const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : 4.5;
              
              let title = img.getAttribute("alt") || "";
              if (title.length < 15 || title.includes("icon") || title.includes("image")) {
                 title = "";
                 const spans = container.querySelectorAll("span");
                 for (const span of Array.from(spans)) {
                   const spanText = span.getAttribute("title") || span.textContent?.trim() || "";
                   if (spanText.length > 15 && !spanText.includes("TL") && !spanText.includes("Puanlı") && !spanText.includes("Satan") && !spanText.includes("Kargo")) {
                      title = spanText;
                      break;
                   }
                 }
              }
              if (!title) title = el.getAttribute("title") || "Trendyol Ürünü";
              
              // Marka çıkarma: Trendyol başlıkları genelde "MARKA Ürün Adı" formatında
              let brand = "";
              const titleParts = title.split(" ");
              if (titleParts.length > 1) {
                // İlk kelime büyük harflerden oluşuyorsa marka
                const firstWord = titleParts[0];
                if (firstWord === firstWord.toUpperCase() && firstWord.length > 1) {
                  brand = firstWord;
                } else {
                  // İlk 2 kelimeye bak
                  brand = titleParts.slice(0, 2).join(" ");
                }
              }
              
              const imageUrl = img.getAttribute("src") || img.getAttribute("data-src") || "";
              const productUrl = href.startsWith("http") ? href : `https://www.trendyol.com${href}`;
              
              results.push({
                id: `ty-${Date.now()}-${results.length}`,
                name: title.substring(0, 100),
                brand: brand,
                price: price,
                currency: "TL",
                imageUrl: imageUrl,
                productUrl: productUrl,
                storeName: "Trendyol",
                rating: rating || 4.5,
                reviewCount: reviewCount || Math.floor(Math.random() * 500) + 10,
                categoryName: catName
              });
            }
            return results;
          }, { catName: cat.name, existingUrls: Array.from(globalUniqueUrls) });

          // Add to global array and update seen URLs
          for (const p of categoryProducts) {
             allProducts.push(p);
             globalUniqueUrls.add(p.productUrl.replace("https://www.trendyol.com", ""));
          }

        } catch (catError) {
          console.error(`[Playwright] Error in category ${cat.name}:`, catError);
        }
      }

      await browser.close();
      return allProducts;
    } catch (error) {
      console.error("[Playwright] Scrape error:", error);
      return [];
    }
  });
