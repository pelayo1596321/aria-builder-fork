<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import SiteStructureView from "../site-structure/SiteStructureView.vue";

const route = useRoute();
const router = useRouter();
const isLibrary = computed(() => route.query.library !== undefined);
const themes = [
  { id: "current", name: "Current site", description: "Your current site design", style: "current" },
  { id: "studio", name: "Studio", description: "A clean, modern storefront", style: "studio" },
  { id: "market", name: "Market", description: "A friendly, product-focused storefront", style: "market" },
  { id: "editorial", name: "Editorial", description: "A spacious, story-led storefront", style: "editorial" },
];
const exampleContents = [
  { title: "Pages", icon: "i-lucide-files", items: ["Homepage", "Shop", "Product page", "Checkout"] },
  { title: "Components", icon: "i-lucide-boxes", items: ["Product card", "Checkout sidebar", "Header", "Footer"] },
  { title: "Collections", icon: "i-lucide-database", items: ["Main Navigation", "Product"] },
  { title: "Media", icon: "i-lucide-image", items: ["Store logo", "Homepage banner", "Product images"] },
];
</script>

<template>
  <section class="theme-page">
    <header class="theme-header">
      <div>
        <button v-if="isLibrary" class="back-link" type="button" @click="router.push('/appearance')">
          <span class="i-lucide-arrow-left back-icon" aria-hidden="true" /> Theme
        </button>
        <h1>{{ isLibrary ? 'Theme Library' : 'Theme' }}</h1>
        <p>{{ isLibrary ? 'Explore designs for your online store.' : 'Your current online store design.' }}</p>
      </div>
      <button v-if="!isLibrary" class="library-button" type="button" @click="router.push('/appearance?library')">
        Theme Library <span aria-hidden="true">↗</span>
      </button>
    </header>

    <main class="theme-content">
      <template v-if="!isLibrary">
        <div class="theme-summary">
        <div class="current-card">
          <div class="preview-shell large"><div class="preview current">
            <div class="preview-nav"><b>STOREFRONT</b><span>Shop &nbsp; About &nbsp; Contact</span></div>
            <div class="preview-hero"><div><small>WELCOME TO OUR STORE</small><strong>Made for<br>your everyday.</strong><i>Explore collection</i></div><div class="preview-image"><span /></div></div>
            <div class="preview-products"><span /><span /><span /></div>
          </div></div>
        </div>
        <div class="theme-information">
          <div class="theme-name-row"><h3>Current theme</h3></div>
          <dl class="theme-metadata"><div><dt>Created by</dt><dd>Not available</dd></div><div><dt>Version</dt><dd>Not available</dd></div></dl>
          <p class="theme-description">A simple storefront example for exploring how a theme can bring pages, components and content together.</p>
          <p class="theme-example-note">Illustrative theme details</p>
        </div>
        </div>
        <section class="theme-contents" aria-labelledby="theme-contents-heading">
          <div class="contents-heading">
            <div>
              <h2 id="theme-contents-heading">What's included</h2>
              <p>Example content for a T-shirt store theme. Actual theme contents will appear here when themes are available.</p>
            </div>
            <span class="example-label">Example</span>
          </div>
          <div class="contents-grid">
            <article v-for="group in exampleContents" :key="group.title" class="contents-card">
              <div class="contents-card-header">
                <div class="contents-title"><span :class="group.icon" aria-hidden="true" /><h3>{{ group.title }}</h3></div>
                <span class="contents-count">{{ group.items.length }}</span>
              </div>
              <ul><li v-for="item in group.items" :key="item">{{ item }}</li></ul>
            </article>
          </div>
        </section>
          <section class="theme-architecture" aria-labelledby="theme-architecture-heading">
            <div class="architecture-heading">
              <div><h2 id="theme-architecture-heading">Architecture</h2><p>Example of how the theme's pages and side cart connect.</p></div>
              <button type="button" class="architecture-link" @click="router.push('/site-structure')">View architecture <span aria-hidden="true">↗</span></button>
            </div>
            <div class="architecture-embed"><SiteStructureView embedded /></div>
          </section>
      </template>
      <template v-else>
        <div class="library-intro"><h2>Explore themes</h2><p>Theme previews are illustrative. More themes will be available as the library grows.</p></div>
        <div class="theme-grid">
          <article v-for="theme in themes" :key="theme.id" class="theme-card">
            <div class="preview-shell"><div class="preview" :class="theme.style">
              <div class="preview-nav"><b>{{ theme.id === 'current' ? 'STOREFRONT' : theme.name.toUpperCase() }}</b><span>Shop &nbsp; About &nbsp; Contact</span></div>
              <div class="preview-hero"><div><small>WELCOME TO OUR STORE</small><strong>{{ theme.id === 'market' ? 'Find your new favorites.' : theme.id === 'editorial' ? 'A considered way to live.' : 'Made for your everyday.' }}</strong><i>Explore collection</i></div><div class="preview-image"><span /></div></div>
              <div class="preview-products"><span /><span /><span /></div>
            </div><span v-if="theme.id === 'current'" class="preview-status"><span class="status-dot" />Installed</span></div>
            <div class="card-details"><div><h3>{{ theme.name }}</h3><p>{{ theme.description }}</p></div><span v-if="theme.id !== 'current'" class="coming-soon">Coming soon</span></div>
          </article>
        </div>
      </template>
    </main>
  </section>
</template>

<style scoped>
.theme-page{height:100%;min-height:0;overflow:auto;color:var(--foreground);background:var(--background)}
.theme-summary .current-card{border:0;border-radius:0;background:transparent}.theme-summary .preview-shell.large{padding:0!important;background:transparent}
.theme-header .back-link{display:inline-flex;align-items:center;gap:6px}.theme-header .back-icon{display:inline-block;width:14px;height:14px;margin:0;flex:none}
.theme-name-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.theme-summary{display:grid;grid-template-columns:minmax(200px,340px) minmax(0,1fr);gap:26px;align-items:start}.theme-summary .current-card{max-width:340px}.theme-summary .preview-shell.large{padding:14px}.theme-summary .preview-hero strong{font-size:clamp(12px,1.2vw,17px)}.theme-summary .preview-hero small{font-size:4px}.theme-summary .preview-hero i{font-size:4px;padding:4px}.theme-information{padding:4px 0}.theme-information h3{font-size:18px}.theme-metadata{display:flex;gap:32px;margin:18px 0}.theme-metadata div{display:flex;flex-direction:column;gap:4px}.theme-metadata dt,.theme-example-note{color:var(--muted-foreground);font-size:11px}.theme-metadata dd{margin:0;font-size:13px}.theme-description{max-width:560px}.theme-example-note{margin-top:12px}.theme-content>.theme-contents{max-width:none;margin-top:36px;padding-bottom:0}@media(max-width:700px){.theme-summary{grid-template-columns:1fr}.theme-summary .current-card{max-width:340px}}
.architecture-embed{height:510px;min-width:0;border:1px solid var(--border);border-radius:8px;overflow:hidden}.architecture-embed :deep(.map-viewport){margin:10px 10px 0}.architecture-embed :deep(.map-footer){padding:10px}
.current-layout{grid-template-columns:minmax(180px,240px) minmax(0,1fr)!important}.theme-architecture{margin-top:26px}.architecture-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}.architecture-heading p{margin-top:5px}.architecture-link{font-size:12px;color:#42bcae;white-space:nowrap;cursor:pointer}.architecture-link:hover{text-decoration:underline}.architecture-link span{margin-left:4px}.architecture-preview{overflow:hidden;border:1px solid var(--border);border-radius:8px;background-color:#101b1a;background-image:radial-gradient(rgba(126,181,168,.16) .8px,transparent .8px);background-size:16px 16px;padding:6px}.architecture-preview svg{display:block;width:100%;height:auto;min-height:120px}.arch-node rect{fill:#193c35;stroke:#438b80;stroke-width:1.5}.arch-overlay{fill:#302940;stroke:#a895d8;stroke-width:1.5;stroke-dasharray:4 3}.arch-label{fill:#e4f2ed;font:600 12px sans-serif;text-anchor:middle}.architecture-note{margin-top:8px;font-size:11px}@media(max-width:1000px){.current-layout{grid-template-columns:minmax(0,1fr)!important}.current-layout .current-card{max-width:240px!important}.architecture-heading{flex-wrap:wrap}}
.current-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px;align-items:start}.current-layout .current-card{max-width:none}.current-layout .theme-contents{margin-top:0;max-width:none}.current-layout .preview-shell.large{padding:14px}.current-layout .preview-hero strong{font-size:clamp(12px,1.4vw,23px)}.current-layout .contents-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))}
.current-layout .preview-hero strong{font-size:12px}.current-layout .preview-hero small{font-size:4px}.current-layout .preview-hero i{font-size:4px;padding:4px}.current-layout .current-details{align-items:flex-start;flex-direction:column;gap:8px}
.theme-contents{max-width:850px;margin-top:34px;padding-bottom:20px}.contents-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.contents-heading p{margin-top:5px}.example-label{border:1px solid var(--border);border-radius:5px;color:var(--muted-foreground);font-size:11px;padding:4px 8px;white-space:nowrap}.contents-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.contents-card{min-width:0;border:1px solid var(--border);border-radius:8px;background:var(--card);padding:16px 18px}.contents-card-header,.contents-title{display:flex;align-items:center}.contents-card-header{justify-content:space-between;gap:12px}.contents-title{gap:9px}.contents-title>span{color:var(--primary);font-size:16px}.contents-count{font-size:11px;color:var(--muted-foreground)}.contents-card ul{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:7px}.contents-card li{border:1px solid var(--border);border-radius:5px;padding:5px 8px;color:var(--muted-foreground);font-size:12px;line-height:1.3}@media(max-width:600px){.contents-grid{grid-template-columns:1fr}}
.theme-header{min-height:112px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px dashed var(--border)}
h1,h2,h3,p{margin:0}h1{font-size:24px;line-height:1.25;font-weight:650}h2{font-size:16px;font-weight:650}h3{font-size:14px;font-weight:650}p{color:var(--muted-foreground);font-size:13px;line-height:1.5}.theme-header p{margin-top:6px}.library-button{border:1px solid var(--primary);border-radius:6px;background:var(--primary);color:var(--primary-foreground);font-size:13px;font-weight:600;padding:10px 15px;white-space:nowrap;cursor:pointer}.library-button span{margin-left:8px}.library-button:hover{opacity:.85}.back-link{display:block;color:var(--muted-foreground);font-size:12px;margin:0 0 12px;cursor:pointer}.back-link:hover{color:var(--foreground)}.back-link span{margin-right:5px}
.theme-content{max-width:1200px;margin:0 auto;padding:32px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.section-heading p,.library-intro p{margin-top:5px}.status,.preview-status{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(17,153,137,.32);background:rgba(17,153,137,.12);color:#39c8b6;border-radius:5px;font-size:11px;font-weight:600;padding:5px 9px}.status-dot{width:6px;height:6px;background:#36c8b1;border-radius:50%}.current-card,.theme-card{overflow:hidden;border:1px solid var(--border);border-radius:8px;background:var(--card)}.current-card{max-width:850px}.preview-shell{position:relative;padding:14px;background:#222727}.preview-shell.large{padding:22px}.preview{--ink:#283e3a;--tint:#dcebe6;--accent:#167f71;--paper:#f5f7f2;aspect-ratio:1.65;overflow:hidden;background:var(--paper);color:var(--ink);padding:6% 7%;font-family:Arial,sans-serif}.preview.studio{--paper:#f2eee9;--tint:#d4c5b7;--accent:#755746;--ink:#332b28}.preview.market{--paper:#fbf5e4;--tint:#efd297;--accent:#dd714c;--ink:#42372c}.preview.editorial{--paper:#eff1ed;--tint:#b8c6b2;--accent:#586d53;--ink:#2a372c}.preview-nav{display:flex;justify-content:space-between;align-items:center;font-size:clamp(5px,.55vw,9px);letter-spacing:.04em}.preview-nav span{opacity:.6;font-size:.8em}.preview-hero{display:grid;grid-template-columns:1fr 1fr;gap:10%;align-items:center;height:57%;padding-top:5%}.preview-hero>div:first-child{display:flex;flex-direction:column;align-items:start;gap:9%}.preview-hero small{font-size:clamp(4px,.5vw,8px);letter-spacing:.12em;opacity:.65}.preview-hero strong{font-size:clamp(11px,2.3vw,32px);line-height:1.08;letter-spacing:-.035em;max-width:85%}.preview-hero i{font-size:clamp(4px,.45vw,8px);font-style:normal;color:#fff;background:var(--accent);padding:6px 9px;border-radius:2px}.preview-image{height:100%;background:var(--tint);display:grid;place-items:center}.preview-image span{width:34%;height:60%;border-radius:45% 45% 14% 14%;background:var(--accent);opacity:.4}.preview-products{height:21%;display:grid;grid-template-columns:repeat(3,1fr);gap:3%;margin-top:7%}.preview-products span{background:var(--tint);opacity:.7}.current-details,.card-details{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 20px}.current-details p,.card-details p{margin-top:4px;font-size:12px}.current-details>span,.coming-soon{color:var(--muted-foreground);font-size:11px;white-space:nowrap}.library-intro{margin-bottom:20px}.theme-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}.preview-status{position:absolute;top:23px;left:23px;background:#123e37;color:#b3f2e7}.theme-card .preview{padding:6% 7%}.theme-card .preview-hero strong{font-size:clamp(12px,1.4vw,20px)}.theme-card .card-details{align-items:flex-start}.coming-soon{padding-top:2px}
@media(max-width:600px){.theme-header{padding:22px 20px}.theme-content{padding:24px 20px}.theme-grid{grid-template-columns:1fr}.current-details{align-items:flex-start;flex-direction:column}}
</style>
