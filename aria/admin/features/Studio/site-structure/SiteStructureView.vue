<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";

defineProps<{ embedded?: boolean }>();
const zoom = ref(100);
const viewport = ref<HTMLElement | null>(null);
onMounted(async () => {
  await nextTick();
  if (!viewport.value) return;
  const fit = Math.floor(Math.min((viewport.value.clientWidth - 20) / 1190, (viewport.value.clientHeight - 20) / 720) * 10) * 10;
  zoom.value = Math.max(40, Math.min(100, fit));
});
const cards = [
  { id: 'home', title: 'Home', type: 'Page', x: 450, y: 35, sections: [
    { name: 'Header', detail: 'Logo · Navigation · Cart', kind: 'shared' },
    { name: 'Hero', detail: 'Featured collection', kind: 'content' },
    { name: 'Featured products', detail: 'Product cards', kind: 'content' },
    { name: 'Footer', detail: 'Links · Contact', kind: 'shared' },
  ] },
  { id: 'shop', title: 'Shop', type: 'Page', x: 80, y: 365, sections: [
    { name: 'Header', detail: 'Logo · Navigation · Cart', kind: 'shared' },
    { name: 'Shop banner', detail: 'Explore the collection', kind: 'content' },
    { name: 'Product grid', detail: 'Product cards', kind: 'content' },
    { name: 'Footer', detail: 'Links · Contact', kind: 'shared' },
  ] },
  { id: 'product', title: 'Product page', type: 'Page', x: 450, y: 365, sections: [
    { name: 'Header', detail: 'Logo · Navigation · Cart', kind: 'shared' },
    { name: 'Product details', detail: 'Images · Price · Size', kind: 'content' },
    { name: 'Add to cart', detail: 'Opens the side cart', kind: 'action' },
    { name: 'Footer', detail: 'Links · Contact', kind: 'shared' },
  ] },
  { id: 'sidecart', title: 'Side cart', type: 'Overlay', x: 900, y: 70, sections: [
    { name: 'Cart items', detail: 'Products · Quantity', kind: 'content' },
    { name: 'Order summary', detail: 'Subtotal', kind: 'content' },
    { name: 'Go to checkout', detail: 'Continue to payment', kind: 'action' },
  ] },
  { id: 'checkout', title: 'Checkout', type: 'Page', x: 900, y: 395, sections: [
    { name: 'Customer details', detail: 'Contact information', kind: 'content' },
    { name: 'Delivery', detail: 'Shipping address', kind: 'content' },
    { name: 'Payment', detail: 'Payment method', kind: 'content' },
    { name: 'Place order', detail: 'Complete purchase', kind: 'action' },
  ] },
];
</script>

<template>
  <section class="architecture-page">
    <header v-if="!embedded" class="architecture-header">
      <div><h1>Architecture</h1><p>A visual map of your store's pages and how visitors move between them.</p></div>
      <span class="example-badge">Example</span>
    </header>
    <div v-if="!embedded" class="architecture-intro">
      <div><h2>Store example</h2><p>A T-shirt store, shown as an example. This map is not connected to your site yet.</p></div>
      <div class="legend"><span><i class="legend-page" /> Page</span><span><i class="legend-overlay" /> Overlay</span></div>
    </div>
    <div ref="viewport" class="map-viewport" tabindex="0" aria-label="Example store architecture map. Scroll to explore.">
      <div class="map-scaled" :style="{ width: `${1190 * zoom / 100}px`, height: `${720 * zoom / 100}px` }">
        <div class="map-canvas" :style="{ transform: `scale(${zoom / 100})` }">
          <svg class="connections" width="1190" height="720" viewBox="0 0 1190 720" aria-hidden="true">
            <path d="M 450 231 H 370 V 333 H 190 V 365" />
            <path d="M 300 561 H 450" />
            <path d="M 670 113 H 745 V 48 H 860 Q 900 48 900 88" />
            <path d="M 670 561 H 760 V 270 H 900" />
            <path d="M 1120 267 H 1155 V 355 H 1010 V 395" />
            <circle cx="450" cy="231" r="4"/><circle cx="300" cy="561" r="4"/><circle cx="670" cy="113" r="4"/><circle cx="670" cy="561" r="4"/><circle cx="1120" cy="267" r="4"/>
          </svg>
          <article v-for="card in cards" :key="card.id" class="map-card" :class="{ overlay: card.type === 'Overlay' }" :style="{ left: `${card.x}px`, top: `${card.y}px` }">
            <div class="card-heading"><div><h3>{{ card.title }}</h3><span>{{ card.type }}</span></div></div>
            <div class="card-sections"><div v-for="part in card.sections" :key="part.name" class="map-section" :class="part.kind"><strong>{{ part.name }}</strong><span>{{ part.detail }}</span></div></div>
          </article>
        </div>
      </div>
    </div>
    <footer class="map-footer"><span>Illustrative example · Changes here do not affect your store</span><div class="zoom-control"><button type="button" aria-label="Zoom out" :disabled="zoom <= 40" @click="zoom = Math.max(40, zoom - 10)">−</button><span>{{ zoom }}%</span><button type="button" aria-label="Zoom in" :disabled="zoom >= 130" @click="zoom = Math.min(130, zoom + 10)">+</button><button type="button" class="reset-zoom" @click="zoom = 100">Reset</button></div></footer>
  </section>
</template>

<style scoped>
.architecture-page{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--background);color:var(--foreground)}.architecture-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px 32px;border-bottom:1px dashed var(--border)}h1,h2,h3,p{margin:0}h1{font-size:24px;font-weight:650}h2{font-size:15px;font-weight:650}p{font-size:13px;line-height:1.5;color:var(--muted-foreground)}.architecture-header p{margin-top:5px}.example-badge{font-size:11px;padding:5px 9px;border:1px solid var(--border);border-radius:5px;color:var(--muted-foreground)}.architecture-intro{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 32px}.architecture-intro p{margin-top:4px}.legend{display:flex;gap:18px;white-space:nowrap;color:var(--muted-foreground);font-size:12px}.legend span{display:flex;align-items:center;gap:7px}.legend i{width:15px;height:15px;border:1.5px solid #47a99e;border-radius:4px}.legend i.legend-overlay{border-style:dashed;border-color:#9c8dd4}.map-viewport{min-height:0;flex:1;overflow:auto;margin:0 20px;border:1px solid var(--border);border-radius:8px;background-color:#101b1a;background-image:radial-gradient(rgba(126,181,168,.16) .8px,transparent .8px);background-size:20px 20px}.map-scaled{min-width:0;position:relative;margin:10px auto}.map-canvas{position:absolute;top:0;left:0;width:1190px;height:720px;transform-origin:top left}.connections{position:absolute;inset:0;overflow:visible;pointer-events:none}.connections path{fill:none;stroke:#54b4a6;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.75}.connections circle{fill:#54b4a6}.map-card{position:absolute;width:220px;border:1px solid #3e8f84;border-radius:8px;background:#162421;box-shadow:0 7px 22px #0003;overflow:hidden}.map-card.overlay{border:1.5px dashed #a895d8;background:#211e2b}.card-heading{height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 13px}.card-heading h3{font-size:13px;font-weight:650}.card-heading span{font-size:10px;color:#9aaea9}.card-heading .card-icon{font-size:14px;opacity:.65}.card-sections{display:flex;flex-direction:column;gap:4px;padding:0 7px 7px}.map-section{height:55px;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:6px 9px;border:1px solid #335b56;border-radius:4px;background:#203c37}.map-section strong{font-size:11px;font-weight:600}.map-section span{font-size:10px;color:#a2b8b2}.map-section.shared{background:#164a41;border-color:#276b5d}.map-section.action{background:#353148;border-color:#57506d}.map-section.action span{color:#b7b0ce}.map-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 22px;color:var(--muted-foreground);font-size:11px}.zoom-control{display:flex;align-items:center;gap:8px}.zoom-control button{height:28px;min-width:28px;border:1px solid var(--border);border-radius:5px;color:var(--foreground);cursor:pointer;font-size:15px}.zoom-control button:disabled{opacity:.4;cursor:default}.zoom-control span{min-width:37px;text-align:center}.zoom-control .reset-zoom{font-size:11px;padding:0 9px}@media(max-width:700px){.architecture-header{padding:22px 20px}.architecture-intro{padding:16px 20px;align-items:flex-start;flex-direction:column}.map-footer{align-items:flex-start;flex-direction:column}}
</style>
