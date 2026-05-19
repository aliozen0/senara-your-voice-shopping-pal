/**
 * @fileoverview Senara Chrome Extension — Build Script
 */

import { execSync } from "child_process";
import { cpSync, existsSync, rmSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

console.log("🔧 Senara Extension Build başlıyor...\n");

// 1. Temiz build
if (existsSync(dist)) {
  rmSync(dist, { recursive: true });
  console.log("🗑️  dist/ temizlendi");
}

// 2. Extension build (Vite)
console.log("\n📦 [1/4] Extension build ediliyor...");
execSync("npx vite build --config vite.config.extension.ts", {
  cwd: root,
  stdio: "inherit",
});

// 3. sidepanel.html'i dist/ köküne taşı ve yolları düzelt
console.log("\n📂 [2/4] Dosya yapısı düzenleniyor...");
const nested = resolve(dist, "extension", "sidepanel.html");
const target = resolve(dist, "sidepanel.html");
if (existsSync(nested)) {
  let html = readFileSync(nested, "utf-8");
  html = html.replace(/\.\.\//g, "./");
  writeFileSync(target, html, "utf-8");
  rmSync(resolve(dist, "extension"), { recursive: true });
  console.log("   ✓ sidepanel.html → dist/ (yollar düzeltildi)");
}

// 4. Statik dosyaları kopyala
console.log("\n📋 [3/4] Statik dosyalar kopyalanıyor...");
const staticFiles = [
  "manifest.json",
  "background.js",
];
for (const file of staticFiles) {
  const src = resolve(root, file);
  const dest = resolve(dist, file);
  if (existsSync(src)) {
    cpSync(src, dest);
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ✗ ${file} BULUNAMADI!`);
  }
}

// 5. Final kontrol
console.log("\n✅ Build tamamlandı! dist/ içeriği:");
const required = [
  "manifest.json",
  "sidepanel.html",
  "sidepanel.js",
  "background.js",
];
for (const f of required) {
  const ok = existsSync(resolve(dist, f));
  console.log(`   ${ok ? "✓" : "✗"} ${f}`);
}

// CSS kontrol
const assetsDir = resolve(dist, "assets");
if (existsSync(assetsDir)) {
  const cssFiles = readdirSync(assetsDir).filter(f => f.endsWith(".css"));
  for (const f of cssFiles) {
    console.log(`   ✓ assets/${f}`);
  }
}

// Content scripts kontrol
const csDir = resolve(dist, "content_scripts");
if (existsSync(csDir)) {
  const csFiles = readdirSync(csDir);
  for (const f of csFiles) {
    console.log(`   ✓ content_scripts/${f}`);
  }
}

// sidepanel.html doğrulama
const finalHtml = readFileSync(target, "utf-8");
const scriptMatch = finalHtml.match(/src="([^"]+\.js)"/);
const cssMatch = finalHtml.match(/href="([^"]+\.css)"/);
console.log(`\n   📄 JS yolu:  ${scriptMatch?.[1] || "YOK"}`);
console.log(`   🎨 CSS yolu: ${cssMatch?.[1] || "YOK"}`);

console.log("\n   Chrome'da yüklemek için:");
console.log("   1. chrome://extensions → Geliştirici modu AÇ");
console.log("   2. 'Paketlenmemiş öğe yükle' → dist/ klasörünü seç\n");
