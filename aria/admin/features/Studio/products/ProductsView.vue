<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { actions } from "astro:actions";
import { Checkbox } from "@/components/ui/checkbox";
import ProductTaxonomyView from "./ProductTaxonomyView.vue";
import { useCollectionDetail } from "@/features/CMS/composables/useCollectionDetail";
import { useCmsEntriesList } from "@/features/CMS/composables/useCmsEntriesList";
import { invalidateCollectionCache, invalidateCollectionsCache, invalidateEntryListCache } from "@/features/CMS/composables/useCmsDataCache";
import { uploadMediaFile, loadMediaAssets } from "@/features/Studio/media/composables/useMediaClient";
import { findUploadedAssetInList } from "@/features/Studio/media/utils/mediaPickerUtils";
import { type FieldSchema } from "../../../../lib/cms/schemas";
import { slugify } from "../../../../lib/utils/slugify";
import type { CmsEntryRow } from "@/features/CMS/lib/entryRow";

const route = useRoute();
const titles: Record<string, string> = { all: "All products", categories: "Categories", variants: "Variants", tags: "Tags", reviews: "Reviews" };
const section = computed(() => String(route.query.section || "all"));
const title = computed(() => titles[section.value] || titles.all);
const lookup = ref("product");
const detail = useCollectionDetail(lookup);
const collectionId = computed(() => detail.collection.value?.id ?? "");
const entries = useCmsEntriesList(collectionId);
watch(section, (value) => { if (value === "all") void entries.loadEntries({ force: true }); });
const assets = ref<Awaited<ReturnType<typeof loadMediaAssets>>>([]);
const mediaError = ref("");
async function refreshMedia() { try { assets.value = await loadMediaAssets({ source: "products" }); mediaError.value = ""; } catch { mediaError.value = "Product images could not be loaded."; } }
void refreshMedia();
const showForm = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const name = ref("");
const price = ref("");
const salePrice = ref("");
const description = ref("");
const available = ref(true);
const files = ref<File[]>([]);
const filePreviews = ref<string[]>([]);
const draggingImages = ref(false);
const editing = ref<CmsEntryRow | null>(null);
const existingImages = ref<{ mediaId: string }[]>([]);
function addFiles(incoming: File[]) {
  for (const file of incoming.filter((item) => item.type.startsWith("image/"))) {
    files.value.push(file);
    filePreviews.value.push(URL.createObjectURL(file));
  }
}
function selectedFiles(event: Event) { const input = event.target as HTMLInputElement; addFiles(Array.from(input.files ?? [])); input.value = ""; }
function removeFile(index: number) { URL.revokeObjectURL(filePreviews.value[index]); filePreviews.value.splice(index, 1); files.value.splice(index, 1); }
function clearFiles() { for (const url of filePreviews.value) URL.revokeObjectURL(url); filePreviews.value = []; files.value = []; }
function dropFiles(event: DragEvent) { draggingImages.value = false; addFiles(Array.from(event.dataTransfer?.files ?? [])); }
onBeforeUnmount(clearFiles);
watch(showForm, (open) => { if (!open) clearFiles(); });
function imageUrl(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const id = (value as { mediaId?: string }).mediaId;
  return assets.value.find((asset) => asset.id === id)?.url ?? "";
}
function resetForm() { editing.value = null; existingImages.value = []; name.value = ""; price.value = ""; salePrice.value = ""; description.value = ""; available.value = true; clearFiles(); errorMessage.value = ""; }
function openEdit(row: CmsEntryRow) {
  resetForm(); editing.value = row; name.value = row.title;
  price.value = typeof row.frontmatter.price === "number" ? String(row.frontmatter.price) : "";
  salePrice.value = typeof row.frontmatter.sale_price === "number" ? String(row.frontmatter.sale_price) : "";
  description.value = typeof row.frontmatter.description === "string" ? row.frontmatter.description : "";
  available.value = row.frontmatter.available !== false;
  const main = row.frontmatter.image as { mediaId?: string } | undefined;
  const gallery = Array.isArray(row.frontmatter.images) ? row.frontmatter.images as { gallery_image?: { mediaId?: string } }[] : [];
  existingImages.value = [main, ...gallery.map((item) => item.gallery_image)].filter((item): item is { mediaId: string } => typeof item?.mediaId === "string");
  showForm.value = true;

}
const additions: FieldSchema[] = [
  { key: "sale_price", label: "Sale price", type: "number" },
  { key: "available", label: "Available", type: "boolean" },
  { key: "images", label: "Additional images", type: "repeater", fields: [{ key: "gallery_image", label: "Image", type: "image", required: true }] },
];
async function ensureFields() {
  const collection = detail.collection.value;
  if (!collection) throw new Error("The Product collection is not available.");
  const fields = collection.schema.fields;
  for (const required of [{ key: "price", type: "number" }, { key: "description", type: "text" }, { key: "image", type: "image" }, ...additions]) {
    const existing = fields.find((field) => field.key === required.key);
    if (existing && existing.type !== required.type) throw new Error(`The Product field “${required.key}” has an incompatible type.`);
  }
  const missing = additions.filter((field) => !fields.some((existing) => existing.key === field.key));
  if (!missing.length) return;
  const { error } = await actions.cms.collections.update({ id: collection.id, expectedUpdatedAt: collection.updatedAt, patch: { fields: [...fields, ...missing] } });
  if (error) throw new Error(error.message);
  invalidateCollectionCache(collection.id); invalidateCollectionCache("product"); invalidateCollectionsCache();
  await detail.loadCollection({ force: true });
}
async function uploadImages(images: File[]) {
  const uploads = [];
  for (const file of images) { const result = await uploadMediaFile({ file, source: "products" }); if (!result) throw new Error(`Could not upload ${file.name}`); uploads.push(result); }
  if (!uploads.length) return [];
  await refreshMedia();
  return uploads.map((upload) => { const asset = findUploadedAssetInList(assets.value, upload); if (!asset) throw new Error(`Could not find uploaded image ${upload.name}.`); return { mediaId: asset.id }; });
}
async function createProduct(input: { name: string; price: number; salePrice?: number; description: string; available: boolean; images: { mediaId: string }[] }) {
  const id = collectionId.value;
  const frontmatter: Record<string, unknown> = { price: input.price, description: input.description, available: input.available };
  if (input.salePrice !== undefined) frontmatter.sale_price = input.salePrice;
  if (input.images.length) { frontmatter.image = input.images[0]; frontmatter.images = input.images.slice(1).map((image) => ({ gallery_image: image })); }
  const { error } = await actions.cms.entries.create({ collectionId: id, title: input.name, slug: slugify(input.name), status: "draft", frontmatter });
  if (error) throw new Error(error.message);
}
async function refreshProducts() { invalidateEntryListCache(collectionId.value); invalidateCollectionsCache(); await entries.loadEntries({ force: true }); }
async function saveProduct() {
  errorMessage.value = "";
  const regular = Number(price.value); const sale = salePrice.value === "" ? undefined : Number(salePrice.value);
  if (!name.value.trim() || price.value === "" || !Number.isFinite(regular) || regular < 0 || (sale !== undefined && (!Number.isFinite(sale) || sale < 0 || sale > regular))) { errorMessage.value = "Enter a name and valid prices. Sale price cannot exceed the regular price."; return; }
  saving.value = true;
  try {
    await ensureFields();
    const images = [...existingImages.value, ...await uploadImages(files.value)];
    if (editing.value) {
      const frontmatter: Record<string, unknown> = { ...editing.value.frontmatter, price: regular, description: description.value.trim(), available: available.value };
      delete frontmatter.sale_price; delete frontmatter.image; delete frontmatter.images;
      if (sale !== undefined) frontmatter.sale_price = sale;
      if (images.length) { frontmatter.image = images[0]; frontmatter.images = images.slice(1).map((image) => ({ gallery_image: image })); }
      const { error } = await actions.cms.entries.update({ collectionId: collectionId.value, id: editing.value.id, version: editing.value.version, patch: { title: name.value.trim(), locale: editing.value.locale, frontmatter } });
      if (error) throw new Error(error.message);
    } else await createProduct({ name: name.value.trim(), price: regular, salePrice: sale, description: description.value.trim(), available: available.value, images });
    await refreshProducts(); showForm.value = false; resetForm();
  }
  catch (error) { errorMessage.value = error instanceof Error ? error.message : "Could not save product."; }
  finally { saving.value = false; }
}
function formatPrice(value: unknown) { return typeof value === "number" ? value.toFixed(2) : "—"; }
</script>

<template>
  <ProductTaxonomyView v-if="section === 'categories' || section === 'variants' || section === 'tags'" :section="section" />
  <section v-else class="products-view">
    <header class="products-header"><div><h1>{{ title }}</h1><p v-if="section === 'all'">Manage your store's products.</p></div><div v-if="section === 'all'" class="header-actions"><button class="primary-button" :disabled="!collectionId" @click="resetForm(); showForm = true">New product</button></div></header>
    <template v-if="section === 'all'">
      <div v-if="errorMessage && !showForm" class="notice error" role="alert">{{ errorMessage }}</div>
      <div v-if="detail.loadError.value || entries.loadError.value" class="notice error" role="alert">{{ detail.loadError.value || entries.loadError.value }}</div>
      <div v-if="mediaError" class="notice error" role="status">{{ mediaError }}</div>
      <div class="table-scroll"><table><thead><tr><th>Image</th><th>Product</th><th>Price</th><th>Sale price</th><th>Availability</th></tr></thead><tbody>
        <tr v-for="row in entries.rows.value" :key="row.id" class="product-row" @click="openEdit(row)"><td><img v-if="imageUrl(row.frontmatter.image)" class="product-image" :src="imageUrl(row.frontmatter.image)" :alt="row.title" /><div v-else class="product-image placeholder"><span class="i-lucide-image" aria-hidden="true" /></div></td><td><button type="button" class="product-link" @click.stop="openEdit(row)">{{ row.title }}</button><small>{{ row.slug }}</small></td><td>{{ formatPrice(row.frontmatter.price) }}</td><td>{{ formatPrice(row.frontmatter.sale_price) }}</td><td><span v-if="typeof row.frontmatter.available === 'boolean'" class="availability"><i :class="{ unavailable: !row.frontmatter.available }" />{{ row.frontmatter.available ? 'Available' : 'Unavailable' }}</span><span v-else class="muted">Not set</span></td></tr>
      </tbody></table><div v-if="!entries.isLoading.value && !entries.rows.value.length" class="empty">No products yet. Add your first product to get started.</div></div>
      <div v-if="entries.totalPages.value > 1" class="pagination"><button :disabled="entries.page.value <= 1" @click="entries.setPage(entries.page.value - 1)">Previous</button><span>Page {{ entries.page.value }} of {{ entries.totalPages.value }}</span><button :disabled="entries.page.value >= entries.totalPages.value" @click="entries.setPage(entries.page.value + 1)">Next</button></div>
    </template>
    <Teleport to="body"><div v-if="showForm" class="modal-backdrop" @click.self="!saving && (showForm = false)"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="new-product-heading"><header><div><h2 id="new-product-heading">{{ editing ? "Edit product" : "New product" }}</h2><p>{{ editing ? "Update the details for your product." : "Add the details for your product." }}</p></div><button class="close" aria-label="Close" :disabled="saving" @click="showForm = false">×</button></header><form @submit.prevent="saveProduct"><div class="form-body"><label>Product name<input v-model="name" required maxlength="200" placeholder="e.g. Classic T-shirt" /></label><div class="form-row"><label>Price<input v-model="price" type="number" min="0" step="0.01" required placeholder="0.00" /></label><label>Sale price <span class="muted">(optional)</span><input v-model="salePrice" type="number" min="0" step="0.01" placeholder="0.00" /></label></div><label>Description<textarea v-model="description" rows="4" placeholder="Describe this product" /></label><section class="product-media" aria-labelledby="product-images-title">
  <div class="media-heading"><div><h3 id="product-images-title">Product images <span>(optional)</span></h3><p>Add images to show your product. The first image is the main image.</p></div><label class="add-images-button"><span class="i-lucide-image-plus" aria-hidden="true" /> Add images<input type="file" accept="image/*" multiple :disabled="saving" @change="selectedFiles" /></label></div>
  <div v-if="existingImages.length || files.length" class="media-grid">
    <div v-for="(image, index) in existingImages" :key="`${image.mediaId}-${index}`" class="media-tile"><div class="media-thumb"><img v-if="imageUrl(image)" :src="imageUrl(image)" alt="Product image" /><span v-else class="missing-image">Image unavailable</span><button type="button" class="remove-image" :aria-label="`Remove image ${index + 1}`" :disabled="saving" @click="existingImages.splice(index, 1)"><span class="i-lucide-x" aria-hidden="true" /></button><span v-if="index === 0" class="main-image-badge">Main image</span></div></div>
    <div v-for="(file, index) in files" :key="`${file.name}-${index}`" class="media-tile"><div class="media-thumb"><img :src="filePreviews[index]" :alt="file.name" /><button type="button" class="remove-image" :aria-label="`Remove ${file.name}`" :disabled="saving" @click="removeFile(index)"><span class="i-lucide-x" aria-hidden="true" /></button><span v-if="index === 0 && existingImages.length === 0" class="main-image-badge">Main image</span></div><small class="image-filename" :title="file.name">{{ file.name }}</small></div>
    <label class="add-tile"><span class="i-lucide-plus" aria-hidden="true" /><span>Add more</span><input type="file" accept="image/*" multiple :disabled="saving" @change="selectedFiles" /></label>
  </div>
  <label v-else class="upload-zone" :class="{ dragging: draggingImages }" @dragenter.prevent="draggingImages = true" @dragover.prevent @dragleave.prevent="draggingImages = false" @drop.prevent="dropFiles"><span class="upload-icon i-lucide-image-plus" aria-hidden="true" /><span class="upload-title">Add product images</span><span class="upload-hint">Choose images or drag and drop them here</span><input type="file" accept="image/*" multiple :disabled="saving" @change="selectedFiles" /></label>
</section><p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p></div><footer><div class="availability-control"><Checkbox id="product-available" :model-value="available" :disabled="saving" @update:model-value="available = $event === true" /><label for="product-available">Available for purchase</label></div><div class="footer-actions"><button type="button" class="secondary-button" :disabled="saving" @click="showForm = false">Cancel</button><button type="submit" class="primary-button" :disabled="saving">{{ saving ? 'Saving…' : 'Save product' }}</button></div></footer></form></div></div></Teleport>
  </section>
</template>

<style scoped>
.modal .close{display:grid;place-items:center;width:32px;height:32px;border-radius:6px;cursor:pointer;transition:background-color .15s ease,color .15s ease}.modal .close:hover{background:var(--card);color:var(--foreground)}.modal .close:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.modal footer{position:sticky;bottom:0;z-index:1;background:var(--background);justify-content:space-between!important;align-items:center;flex-wrap:wrap}.availability-control,.footer-actions{display:flex;align-items:center;gap:9px}.availability-control label{font-size:12px;font-weight:600;cursor:pointer}.footer-actions{gap:10px}

.product-media{padding-top:3px}.media-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.media-heading h3{margin:0;font-size:13px;font-weight:650}.media-heading h3 span{font-size:11px;color:var(--muted-foreground);font-weight:400}.media-heading p{margin-top:5px;line-height:1.45}.add-images-button,.add-tile,.upload-zone{cursor:pointer}.add-images-button{display:inline-flex!important;align-items:center;gap:7px;white-space:nowrap;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--card);font-size:11px!important;font-weight:600}.add-images-button:hover,.add-tile:hover{border-color:var(--primary)}.add-images-button>span{font-size:15px}.product-media input[type=file]{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;padding:0;margin:0;border:0}.add-images-button:focus-within,.add-tile:focus-within,.upload-zone:focus-within{outline:2px solid var(--primary);outline-offset:2px}.upload-zone{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:128px;margin-top:14px;border:1px dashed var(--border);border-radius:8px;background:var(--card);color:var(--muted-foreground);font-weight:400!important}.upload-zone:hover,.upload-zone.dragging{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 8%,var(--card))}.upload-icon{font-size:22px;color:var(--primary)}.upload-title{font-size:12px;color:var(--foreground);font-weight:600}.upload-hint{font-size:11px}.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:12px;margin-top:14px}.media-tile{min-width:0}.media-thumb{aspect-ratio:1;position:relative;overflow:hidden;border:1px solid var(--border);border-radius:7px;background:var(--card);display:grid;place-items:center}.media-thumb img{width:100%;height:100%;object-fit:cover}.missing-image{padding:8px;font-size:11px;color:var(--muted-foreground);text-align:center}.remove-image{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:24px;height:24px;border-radius:5px;background:#101918d9;color:white;cursor:pointer}.remove-image:hover{background:#a33e3e}.remove-image span{font-size:15px}.main-image-badge{position:absolute;bottom:6px;left:6px;right:6px;padding:5px;border-radius:4px;background:#101918d9;color:white;font-size:10px;text-align:center;font-weight:600}.image-filename{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:6px!important;font-size:10px!important}.add-tile{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:7px;aspect-ratio:1;border:1px dashed var(--border);border-radius:7px;color:var(--muted-foreground);font-size:11px!important;font-weight:500!important}.add-tile>span:first-child{font-size:19px}.media-grid+.upload-zone{margin-top:12px}@media(max-width:480px){.media-heading{flex-direction:column}.media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

.product-row{cursor:pointer;transition:background-color .15s ease}.product-row:hover,.product-row:focus-within{background:color-mix(in srgb,var(--primary) 10%,transparent)}.product-link{color:var(--foreground);font-size:13px;font-weight:650;cursor:pointer;text-align:left}.product-link:hover{color:var(--primary);text-decoration:underline}.existing-images>span{font-size:12px;font-weight:600}.image-list{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.image-item{position:relative;width:70px}.image-item img{width:70px;height:70px;object-fit:cover;border-radius:5px}.image-item button{position:absolute;right:2px;top:2px;background:#17201e;color:white;border-radius:4px;width:22px;height:22px}.image-item small{display:block;text-align:center}.products-view{height:100%;overflow:auto;color:var(--foreground)}.products-header{padding:28px 32px;display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:1px dashed var(--border)}h1,h2,p{margin:0}h1{font-size:24px;font-weight:650}h2{font-size:18px;font-weight:650}p,small,.muted{color:var(--muted-foreground);font-size:12px}.products-header p{margin-top:5px}.header-actions{display:flex;gap:10px;flex-wrap:wrap}.primary-button,.secondary-button{padding:9px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer}.primary-button{background:var(--primary);color:var(--primary-foreground);border:1px solid var(--primary)}.secondary-button{border:1px solid var(--border);background:var(--card);color:var(--foreground)}button:disabled{opacity:.5;cursor:not-allowed}.notice{margin:16px 32px}.error{color:#fb8b86;font-size:12px}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:12px}th{font-size:11px;font-weight:500;color:var(--muted-foreground);padding:13px 18px;border-bottom:1px dashed var(--border)}td{padding:12px 18px;border-bottom:1px dashed var(--border)}th:first-child,td:first-child{padding-left:32px;width:78px}td strong{display:block;font-size:13px}td small{display:block;margin-top:4px}.product-image{width:42px;height:42px;object-fit:cover;border-radius:4px;background:var(--card)}.placeholder{display:grid;place-items:center;color:var(--muted-foreground);font-size:17px}.availability{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}.availability i{width:7px;height:7px;background:#31c4a8;border-radius:50%}.availability i.unavailable{background:#8a9292}.empty{text-align:center;padding:70px 20px;color:var(--muted-foreground);font-size:13px}.pagination{display:flex;justify-content:flex-end;align-items:center;gap:15px;padding:18px 32px;font-size:12px}.pagination button{color:var(--foreground)}.modal-backdrop{position:fixed;inset:0;z-index:1000;background:#000a;display:flex;align-items:center;justify-content:center;padding:20px}.modal{width:min(580px,100%);max-height:90vh;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--background);color:var(--foreground);box-shadow:0 20px 60px #0008}.modal header{display:flex;justify-content:space-between;padding:24px 26px;border-bottom:1px solid var(--border)}.modal header p{margin-top:5px}.close{font-size:22px;color:var(--muted-foreground);line-height:1}.form-body{display:grid;gap:18px;padding:24px 26px}.form-body label{display:block;font-size:12px;font-weight:600}.form-body input:not([type=checkbox]),.form-body textarea{display:block;width:100%;margin-top:8px;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--foreground);font-size:13px}.form-body input[type=file]{font-weight:400}.form-body small{display:block;margin-top:6px;font-weight:400}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}.check-label{display:flex!important;align-items:center;gap:9px}.check-label input{accent-color:#078b7d}.modal footer{display:flex;justify-content:flex-end;gap:10px;padding:18px 26px;border-top:1px solid var(--border)}@media(max-width:600px){.products-header{align-items:flex-start;flex-direction:column;padding:22px}.form-row{grid-template-columns:1fr}}
</style>
