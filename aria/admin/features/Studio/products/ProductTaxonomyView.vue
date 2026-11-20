<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { actions } from "astro:actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IconPickerDialog } from "@/components/ui/icon-picker";
import MediaPickerDialog from "@/features/Studio/media/components/MediaPickerDialog.vue";
import { loadMediaAssets } from "@/features/Studio/media/composables/useMediaClient";
import type { MediaAsset } from "@/features/Studio/media/types/media";
import { useCollectionsList } from "@/features/CMS/composables/useCollectionsList";
import { useCollectionDetail } from "@/features/CMS/composables/useCollectionDetail";
import { useCmsEntriesList } from "@/features/CMS/composables/useCmsEntriesList";
import { fetchEntryList, invalidateCollectionCache, invalidateCollectionsCache, invalidateEntryListCache } from "@/features/CMS/composables/useCmsDataCache";
import { mapEntryRecordToRow, type CmsEntryRow } from "@/features/CMS/lib/entryRow";
import { normalizeEntryFieldOrderForCollection } from "../../../../lib/cms/entryFieldOrder";
import { AriaEntryRecordSchema, type FieldSchema } from "../../../../lib/cms/schemas";
import { slugify } from "../../../../lib/utils/slugify";

type VariantType = "text" | "color" | "image" | "icon";
type Choice = { id: string; label: string; value: string };
const props = defineProps<{ section: "categories" | "variants" | "tags" }>();
const definitions = {
  categories: { name: "product-categories", label: "Categories", singular: "category", description: "Organize products into categories and subcategories." },
  variants: { name: "product-variants", label: "Variants", singular: "variant", description: "Create reusable options for your products." },
  tags: { name: "product-tags", label: "Tags", singular: "tag", description: "Group or highlight products with reusable labels." },
};
const config = computed(() => definitions[props.section]);
const { collections, loadCollections } = useCollectionsList();
void loadCollections({ force: true });
const lookup = computed(() => config.value.name);
const detail = useCollectionDetail(lookup);
const id = computed(() => detail.collection.value?.id ?? "");
const entries = useCmsEntriesList(id);
const product = useCollectionDetail(ref("product"));
const productId = computed(() => product.collection.value?.id ?? "");
const ready = computed(() => ["product-categories", "product-variants", "product-tags"].every((name) => collections.value.some((c) => c.name === name)) && ["product_categories", "product_tags"].every((key) => product.collection.value?.schema.fields.some((field) => field.key === key && field.type === "relation")));
const working = ref(false), loadingForm = ref(false), error = ref(""), showDialog = ref(false);
const formLoadFailed = ref(false);
const editing = ref<CmsEntryRow | null>(null);
const name = ref(""), description = ref(""), parent = ref("none"), categoryImage = ref("");
const tagColor = ref("#14b8a6");
const palette = [{ name: "Red", value: "#ef4444" }, { name: "Orange", value: "#f97316" }, { name: "Amber", value: "#f59e0b" }, { name: "Yellow", value: "#eab308" }, { name: "Lime", value: "#84cc16" }, { name: "Green", value: "#22c55e" }, { name: "Teal", value: "#14b8a6" }, { name: "Blue", value: "#3b82f6" }, { name: "Indigo", value: "#6366f1" }, { name: "Purple", value: "#a855f7" }, { name: "Pink", value: "#ec4899" }, { name: "Gray", value: "#71717a" }];
const variantType = ref<VariantType>("text");
const options = ref<Choice[]>([]);
const allCategories = ref<CmsEntryRow[]>([]), allProducts = ref<CmsEntryRow[]>([]);
const categoryCounts = ref<Record<string, number>>({});
let countRequest = 0;
const categoryDepth = ref<Record<string, number>>({});
const displayRows = computed(() => {
  if (props.section !== "categories" || !allCategories.value.length) return entries.rows.value;
  const rows: CmsEntryRow[] = [], visited = new Set<string>(), depths: Record<string, number> = {};
  const visit = (row: CmsEntryRow, depth: number) => {
    if (visited.has(row.id)) return;
    visited.add(row.id); depths[row.id] = depth; rows.push(row);
    allCategories.value.filter((item) => item.frontmatter.parent === row.id).sort((a, b) => a.title.localeCompare(b.title)).forEach((item) => visit(item, depth + 1));
  };
  allCategories.value.filter((row) => !allCategories.value.some((item) => item.id === row.frontmatter.parent)).sort((a, b) => a.title.localeCompare(b.title)).forEach((row) => visit(row, 0));
  allCategories.value.forEach((row) => visit(row, 0)); categoryDepth.value = depths;
  return rows;
});
const selectedProducts = ref<string[]>([]), originalProducts = ref<string[]>([]);
const productSearch = ref("");
const filteredProducts = computed(() => allProducts.value.filter((item) => item.title.toLowerCase().includes(productSearch.value.trim().toLowerCase())));
const mediaAssets = ref<MediaAsset[]>([]);
const mediaOpen = ref(false), iconOpen = ref(false), pickerIndex = ref<number | null>(null);
const imageUrl = (value: string) => mediaAssets.value.find((asset) => asset.id === value)?.url ?? "";
function productImage(row: CmsEntryRow) {
  const image = row.frontmatter.image as { mediaId?: unknown } | undefined;
  return typeof image?.mediaId === "string" ? imageUrl(image.mediaId) : "";
}
function productPrice(row: CmsEntryRow) {
  return typeof row.frontmatter.price === "number" ? row.frontmatter.price.toFixed(2) : "—";
}
const allowedParents = computed(() => allCategories.value.filter((candidate) => {
  if (!editing.value) return true;
  const visited = new Set<string>(); let current: CmsEntryRow | undefined = candidate;
  while (current && !visited.has(current.id)) {
    if (current.id === editing.value.id) return false;
    visited.add(current.id); const next = current.frontmatter.parent;
    current = allCategories.value.find((item) => item.id === next);
  }
  return true;
}));
watch(() => props.section, () => { showDialog.value = false; error.value = ""; });
async function allRows(collectionId: string) {
  const rows: CmsEntryRow[] = []; let page = 1, total = 0;
  do { const data = await fetchEntryList({ collectionId, page, limit: 200 }, { force: true }); rows.push(...data.items.map(mapEntryRecordToRow)); total = data.total; page++; } while (rows.length < total);
  return rows;
}
async function selectedForClassification(classificationId: string, field: "product_categories" | "product_tags") {
  const ids: string[] = []; let offset = 0, total = 0;
  do { const result = await actions.cms.entries.query({ collectionId: productId.value, filter: { relationIncludes: { field, entryId: classificationId } }, limit: 200, offset }); if (result.error) throw new Error(result.error.message); const data = result.data; ids.push(...data.items.map((item) => item.entry.id)); total = data.total; offset += 200; } while (offset < total);
  return ids;
}
async function loadCategoryCounts(rows: CmsEntryRow[]) {
  const request = ++countRequest;
  const counts: Record<string, number> = {};
  for (let start = 0; start < rows.length; start += 10) {
    await Promise.all(rows.slice(start, start + 10).map(async (row) => {
      try {
        const result = await actions.cms.entries.query({ collectionId: productId.value, filter: { relationIncludes: { field: "product_categories", entryId: row.id } }, limit: 1 });
        if (!result.error) counts[row.id] = result.data.total;
      } catch { /* A missing count is shown as unavailable, not zero. */ }
    }));
    if (request !== countRequest) return;
  }
  if (request === countRequest) categoryCounts.value = counts;
}
async function ensureFields() {
  await detail.loadCollection({ force: true }); const collection = detail.collection.value;
  if (!collection) throw new Error("Could not load the collection schema.");
  const additions: FieldSchema[] = props.section === "categories" ? [
    { key: "parent", label: "Parent category", type: "reference", targetCollection: collection.id },
    { key: "image", label: "Image", type: "image" },
  ] : props.section === "variants" ? [
    { key: "identifier_type", label: "Identifier type", type: "string" },
    { key: "choices", label: "Options", type: "json" },
  ] : [{ key: "color", label: "Color", type: "string" }];
  for (const field of additions) { const existing = collection.schema.fields.find((item) => item.key === field.key); if (existing && (existing.type !== field.type || (field.key === "parent" && ![collection.id, collection.name].includes(existing.targetCollection ?? "")))) throw new Error(`Field ${field.key} has an incompatible schema.`); }
  const missing = additions.filter((field) => !collection.schema.fields.some((item) => item.key === field.key));
  if (!missing.length) return;
  const result = await actions.cms.collections.update({ id: collection.id, expectedUpdatedAt: collection.updatedAt, patch: { fields: [...collection.schema.fields, ...missing] } });
  if (result.error) throw new Error(result.error.message);
  invalidateCollectionCache(collection.id); invalidateCollectionCache(collection.name); invalidateCollectionsCache(); await detail.loadCollection({ force: true });
}
async function setupCollections() {
  working.value = true; error.value = "";
  try {
    await loadCollections({ force: true });
    const existing = new Set(collections.value.map((item) => item.name));
    const definitionsToCreate = [
      { name: "product-categories", label: "Product Categories", kind: "data" as const, fields: [{ key: "description", label: "Description", type: "text" as const }, { key: "parent", label: "Parent category", type: "reference" as const, targetCollection: "product-categories" }, { key: "image", label: "Image", type: "image" as const }] },
      { name: "product-tags", label: "Product Tags", kind: "tags" as const, fields: [{ key: "description", label: "Description", type: "text" as const }, { key: "color", label: "Color", type: "string" as const }] },
      { name: "product-variants", label: "Product Variants", kind: "data" as const, fields: [
        { key: "identifier_type", label: "Identifier type", type: "string" as const },
        { key: "choices", label: "Options", type: "json" as const },
      ] },
    ];
    if (!productId.value) throw new Error("The Product collection must be available before setup.");
    for (const definition of definitionsToCreate) {
      if (existing.has(definition.name)) continue;
      const result = await actions.cms.collections.create({ ...definition, scope: "global", supports: [] });
      if (result.error) throw new Error(result.error.message);
    }
    invalidateCollectionsCache(); await loadCollections({ force: true });
    await product.loadCollection({ force: true });
    const productCollection = product.collection.value;
    if (!productCollection) throw new Error("The Product collection is not available.");
    const additions = [
      { key: "product_categories", label: "Categories", type: "relation" as const, targetCollection: collections.value.find((item) => item.name === "product-categories")!.id },
      { key: "product_tags", label: "Tags", type: "relation" as const, targetCollection: collections.value.find((item) => item.name === "product-tags")!.id },
    ];
    for (const addition of additions) {
      const existingField = productCollection.schema.fields.find((field) => field.key === addition.key);
      if (existingField && (existingField.type !== "relation" || existingField.targetCollection !== addition.targetCollection)) throw new Error(`The Product field “${addition.key}” is incompatible.`);
    }
    const missing = additions.filter((field) => !productCollection.schema.fields.some((existingField) => existingField.key === field.key));
    if (missing.length) {
      const entryFieldOrder = [...normalizeEntryFieldOrderForCollection(productCollection), ...missing.map((field) => ({ kind: "field" as const, key: field.key, placement: "sidebar" as const }))];
      const result = await actions.cms.collections.update({ id: productCollection.id, expectedUpdatedAt: productCollection.updatedAt, patch: { fields: [...productCollection.schema.fields, ...missing], entryFieldOrder } });
      if (result.error) throw new Error(result.error.message);
      invalidateCollectionCache(productCollection.id); invalidateCollectionCache("product");
      await product.loadCollection({ force: true });
    }
    await detail.loadCollection({ force: true });
  } catch (e) { error.value = e instanceof Error ? e.message : "Could not set up product collections."; }
  finally { working.value = false; }
}
function newOption(): Choice { return { id: crypto.randomUUID(), label: "", value: variantType.value === "color" ? "#ef4444" : "" }; }
function changeType(value: unknown) {
  if (typeof value !== "string" || !["text", "color", "image", "icon"].includes(value) || value === variantType.value) return;
  variantType.value = value as VariantType;
  options.value = options.value.map((option) => ({ ...option, value: value === "color" ? "#ef4444" : "" }));
}
function parseOptions(row?: CmsEntryRow): Choice[] {
  const data = row?.frontmatter.choices as { items?: unknown } | undefined;
  if (Array.isArray(data?.items)) return data.items.map((item: any) => ({ id: typeof item.id === "string" ? item.id : crypto.randomUUID(), label: String(item.label ?? ""), value: String(item.value ?? "") }));
  // Keep the original variant data intact; show its old options in a readable form.
  const legacy = row?.frontmatter.options;
  return legacy && typeof legacy === "object" ? Object.entries(legacy).map(([, value]) => ({ id: crypto.randomUUID(), label: String(value), value: String(value) })) : [];
}
async function openForm(row?: CmsEntryRow) {
  editing.value = row ?? null; name.value = row?.title ?? ""; description.value = String(row?.frontmatter.description ?? "");
  parent.value = typeof row?.frontmatter.parent === "string" ? row.frontmatter.parent : "none";
  const image = row?.frontmatter.image as { mediaId?: string } | undefined; categoryImage.value = image?.mediaId ?? "";
  tagColor.value = typeof row?.frontmatter.color === "string" ? row.frontmatter.color : "#14b8a6";
  const savedType = row?.frontmatter.identifier_type; variantType.value = ["text", "color", "image", "icon"].includes(String(savedType)) ? savedType as VariantType : "text";
  options.value = parseOptions(row); if (!options.value.length) options.value = [newOption()];
  error.value = ""; formLoadFailed.value = false; selectedProducts.value = []; originalProducts.value = []; productSearch.value = ""; showDialog.value = true;
  if (props.section === "variants") { void loadMediaAssets({ source: "product-variants" }).then((assets) => { mediaAssets.value = assets; }).catch(() => {}); return; }
  loadingForm.value = true;
  try {
    const [categoryRows, productRows, selected, assets] = await Promise.all([
      props.section === "categories" ? allRows(id.value) : Promise.resolve(allCategories.value), allRows(productId.value), row ? selectedForClassification(row.id, props.section === "categories" ? "product_categories" : "product_tags") : Promise.resolve([]), loadMediaAssets({ source: "products" }),
    ]);
    allCategories.value = categoryRows; allProducts.value = productRows; originalProducts.value = selected; selectedProducts.value = [...selected]; mediaAssets.value = assets;
  } catch (e) { formLoadFailed.value = true; error.value = e instanceof Error ? e.message : "Could not load products."; }
  finally { loadingForm.value = false; }
}
function toggleProduct(id: string, checked: boolean) { selectedProducts.value = checked ? [...new Set([...selectedProducts.value, id])] : selectedProducts.value.filter((item) => item !== id); }
function chooseMedia(index: number | null) { pickerIndex.value = index; mediaOpen.value = true; }
function onMediaSelected(asset: MediaAsset) {
  if (!mediaAssets.value.some((item) => item.id === asset.id)) mediaAssets.value.push(asset);
  if (pickerIndex.value === null) categoryImage.value = asset.id; else if (options.value[pickerIndex.value]) options.value[pickerIndex.value].value = asset.id;
}
function chooseIcon(index: number) { pickerIndex.value = index; iconOpen.value = true; }
function onIconSelected(icon: string) { if (pickerIndex.value !== null && options.value[pickerIndex.value]) options.value[pickerIndex.value].value = icon; }
async function syncClassificationProducts(classificationId: string, field: "product_categories" | "product_tags") {
  const before = new Set(originalProducts.value), after = new Set(selectedProducts.value);
  const changed = [...new Set([...before, ...after])].filter((id) => before.has(id) !== after.has(id));
  for (const productEntryId of changed) {
    const read = await actions.cms.entries.get({ collectionId: productId.value, idOrSlug: productEntryId, include: ["relations"] });
    if (read.error) throw new Error(read.error.message);
    const record = AriaEntryRecordSchema.parse(read.data); const relations = (record.relations ?? []).filter((item) => !(item.fieldKey === field && item.targetEntryId === classificationId));
    if (after.has(productEntryId)) relations.push({ sourceEntryId: productEntryId, fieldKey: field, targetEntryId: classificationId, position: relations.filter((item) => item.fieldKey === field).length });
    const result = await actions.cms.entries.update({ collectionId: productId.value, id: productEntryId, version: record.entry.version, patch: { relations } });
    if (result.error) throw new Error(`Could not update a product: ${result.error.message}`);
    originalProducts.value = after.has(productEntryId) ? [...originalProducts.value, productEntryId] : originalProducts.value.filter((item) => item !== productEntryId);
  }
  invalidateEntryListCache(productId.value);
}
async function save() {
  if (!name.value.trim()) { error.value = "Enter a name."; return; }
  if (props.section !== "variants" && (loadingForm.value || formLoadFailed.value)) return;
  if (props.section === "categories" && parent.value !== "none" && !allowedParents.value.some((item) => item.id === parent.value)) { error.value = "Choose a valid parent category without creating a cycle."; return; }
  if (props.section === "variants" && (!options.value.length || options.value.some((option) => !option.label.trim() || (variantType.value !== "text" && !option.value)))) { error.value = "Complete the name and identifier for each option."; return; }
  if (props.section === "variants" && new Set(options.value.map((option) => option.label.trim().toLowerCase())).size !== options.value.length) { error.value = "Option names must be unique."; return; }
  working.value = true; error.value = "";
  try {
    await ensureFields();
    const frontmatter: Record<string, unknown> = { ...(editing.value?.frontmatter ?? {}) };
    if (props.section === "categories") {
      frontmatter.description = description.value.trim();
      if (parent.value !== "none") frontmatter.parent = parent.value; else delete frontmatter.parent;
      if (categoryImage.value) frontmatter.image = { mediaId: categoryImage.value }; else delete frontmatter.image;
    } else if (props.section === "tags") { frontmatter.description = description.value.trim(); frontmatter.color = tagColor.value; }
    else { frontmatter.identifier_type = variantType.value; frontmatter.choices = { items: options.value.map((option) => ({ id: option.id, label: option.label.trim(), value: variantType.value === "text" ? option.label.trim() : option.value })) }; }
    const result = editing.value
      ? await actions.cms.entries.update({ collectionId: id.value, id: editing.value.id, version: editing.value.version, patch: { title: name.value.trim(), locale: editing.value.locale, frontmatter } })
      : await actions.cms.entries.create({ collectionId: id.value, title: name.value.trim(), slug: slugify(name.value), status: "draft", frontmatter });
    if (result.error) throw new Error(result.error.message);
    const record = AriaEntryRecordSchema.parse(result.data); editing.value = mapEntryRecordToRow(record);
    if (props.section !== "variants") await syncClassificationProducts(record.entry.id, props.section === "categories" ? "product_categories" : "product_tags");
    invalidateEntryListCache(id.value); invalidateCollectionsCache(); await entries.loadEntries({ force: true });
    if (props.section === "categories") { allCategories.value = await allRows(id.value); await loadCategoryCounts(allCategories.value); }
    showDialog.value = false;
  } catch (e) { error.value = e instanceof Error ? e.message : "Could not save."; }
  finally { working.value = false; }
}
function displayOptions(row: CmsEntryRow) { return parseOptions(row).map((item) => item.label).join(", ") || "—"; }
function parentName(value: unknown) { return allCategories.value.find((item) => item.id === value)?.title ?? (value ? "Subcategory" : "—"); }
watch(() => [props.section, id.value, productId.value], async () => { if (props.section === "categories" && id.value && productId.value) { try { allCategories.value = await allRows(id.value); await loadCategoryCounts(allCategories.value); } catch { categoryCounts.value = {}; } } }, { immediate: true });
</script>
<template>
  <section class="taxonomy-view">
    <header class="taxonomy-header"><div><h1>{{ config.label }}</h1><p>{{ config.description }}</p></div><button v-if="ready && id" class="primary-button" @click="openForm()">New {{ config.singular }}</button></header>
    <div v-if="!ready && !detail.isLoading.value" class="setup"><h2>Set up product collections</h2><p>Create the collections used for product categories, variants and tags.</p><button class="primary-button" :disabled="working || !productId" @click="setupCollections">{{ working ? 'Setting up…' : 'Set up collections' }}</button></div>
    <template v-else-if="ready">
      <p v-if="detail.loadError.value || entries.loadError.value" class="error notice" role="alert">{{ detail.loadError.value || entries.loadError.value }}</p>
      <p v-if="error && !showDialog" class="error notice" role="alert">{{ error }}</p>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th v-if="section === 'categories'">Parent category</th><th v-if="section === 'categories'">Products</th><th v-if="section === 'variants'">Identifier</th><th v-if="section === 'variants'">Options</th><th v-if="section === 'tags'">Color</th><th v-if="section !== 'variants'">Description</th></tr></thead>
        <tbody><tr v-for="row in displayRows" :key="row.id" @click="openForm(row)"><td><button :style="section === 'categories' ? { marginLeft: `${(categoryDepth[row.id] || 0) * 20}px` } : {}" class="entry-name" @click.stop="openForm(row)">{{ row.title }}</button><small>{{ row.slug }}</small></td><td v-if="section === 'categories'">{{ parentName(row.frontmatter.parent) }}</td><td v-if="section === 'categories'">{{ categoryCounts[row.id] ?? '—' }}</td><td v-if="section === 'variants'" class="capitalize">{{ row.frontmatter.identifier_type || 'Text' }}</td><td v-if="section === 'variants'"><div v-if="row.frontmatter.identifier_type === 'color' && parseOptions(row).length" class="variant-colors"><span v-for="option in parseOptions(row)" :key="option.id" class="variant-color" :style="{ backgroundColor: option.value }" :title="option.label" role="img" :aria-label="option.label" /></div><div v-else-if="(!row.frontmatter.identifier_type || row.frontmatter.identifier_type === 'text') && parseOptions(row).length" class="variant-text-options"><span v-for="option in parseOptions(row)" :key="option.id" class="variant-text-option">{{ option.label }}</span></div><template v-else>{{ displayOptions(row) }}</template></td><td v-if="section === 'tags'"><span class="color-dot" :style="{ backgroundColor: String(row.frontmatter.color || '#14b8a6') }" />{{ palette.find((color) => color.value === row.frontmatter.color)?.name || 'Teal' }}</td><td v-if="section !== 'variants'">{{ row.frontmatter.description || '—' }}</td></tr></tbody>
      </table><div v-if="!entries.isLoading.value && !entries.rows.value.length" class="empty">No {{ config.label.toLowerCase() }} yet. Add one to get started.</div></div>
      <div v-if="section !== 'categories' && entries.totalPages.value > 1" class="pagination"><button :disabled="entries.page.value <= 1" @click="entries.setPage(entries.page.value - 1)">Previous</button><span>Page {{ entries.page.value }} of {{ entries.totalPages.value }}</span><button :disabled="entries.page.value >= entries.totalPages.value" @click="entries.setPage(entries.page.value + 1)">Next</button></div>
    </template>
    <p v-if="error && !ready" class="error notice" role="alert">{{ error }}</p>
    <Teleport to="body"><div v-if="showDialog" class="backdrop" @click.self="!working && (showDialog = false)"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="taxonomy-title">
      <header><div><h2 id="taxonomy-title">{{ editing ? 'Edit' : 'New' }} {{ config.singular }}</h2><p>{{ config.description }}</p></div><button type="button" class="close" aria-label="Close" :disabled="working" @click="showDialog = false"><span class="i-lucide-x" /></button></header>
      <form @submit.prevent="save"><div class="form-body">
        <label class="field">Name<input v-model="name" required maxlength="200" /></label>
        <template v-if="section === 'categories'">
          <label class="field"><span class="field-title">Description <span>(optional)</span></span><textarea v-model="description" rows="3" /></label>
          <div class="field"><label for="parent-category">Parent category <span>(optional)</span></label><Select v-model="parent" :disabled="loadingForm"><SelectTrigger id="parent-category"><SelectValue placeholder="No parent category" /></SelectTrigger><SelectContent class="!z-[60]"><SelectItem value="none">No parent category</SelectItem><SelectItem v-for="item in allowedParents" :key="item.id" :value="item.id">{{ item.title }}</SelectItem></SelectContent></Select></div>
          <div class="field"><span class="field-title">Category image <span>(optional)</span></span><div class="image-control"><img v-if="categoryImage && imageUrl(categoryImage)" :src="imageUrl(categoryImage)" alt="Category image" /><div v-else class="image-placeholder"><span class="i-lucide-image" /></div><div class="image-actions"><button type="button" class="secondary-button" @click="chooseMedia(null)">{{ categoryImage ? 'Change image' : 'Choose image' }}</button><button v-if="categoryImage" type="button" class="text-button" @click="categoryImage = ''">Remove</button></div></div></div>

        </template>
        <template v-else-if="section === 'variants'">
          <div class="field"><label for="identifier-type">Identifier type</label><Select :model-value="variantType" @update:model-value="changeType"><SelectTrigger id="identifier-type"><SelectValue /></SelectTrigger><SelectContent class="!z-[60]"><SelectItem value="text">Text</SelectItem><SelectItem value="color">Color</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="icon">Icon</SelectItem></SelectContent></Select></div>
          <div class="field"><div class="field-heading"><div><span class="field-title">Options</span><p>Add the choices customers can select.</p></div><button type="button" class="secondary-button" @click="options.push(newOption())"><span class="i-lucide-plus" /> Add option</button></div>
            <div class="option-list"><div v-for="(option, index) in options" :key="option.id" class="option-row"><label class="sr-only" :for="`option-name-${option.id}`">Option name {{ index + 1 }}</label><input :id="`option-name-${option.id}`" v-model="option.label" :placeholder="variantType === 'text' ? 'e.g. S' : 'Option name'" maxlength="100" />
              <label v-if="variantType === 'color'" class="color-input" :title="`Choose color for ${option.label || 'option'}`"><input v-model="option.value" type="color" :aria-label="`Color for option ${index + 1}`" /><span>{{ option.value }}</span></label>
              <button v-if="variantType === 'image'" type="button" class="identifier-button" @click="chooseMedia(index)"><img v-if="option.value && imageUrl(option.value)" :src="imageUrl(option.value)" alt="" /><span v-else class="i-lucide-image-plus" />{{ option.value ? 'Change image' : 'Choose image' }}</button>
              <button v-if="variantType === 'icon'" type="button" class="identifier-button" @click="chooseIcon(index)"><span class="i-lucide-shapes" />{{ option.value || 'Choose icon' }}</button>
              <button type="button" class="remove-option" :aria-label="`Remove option ${index + 1}`" @click="options.splice(index, 1)"><span class="i-lucide-trash-2" /></button>
            </div></div>
          </div>
        </template>
        <template v-else><label class="field"><span class="field-title">Description <span>(optional)</span></span><textarea v-model="description" rows="3" /></label><div class="field"><div class="palette-heading"><span class="field-title">Color</span><span class="palette-name">{{ palette.find((color) => color.value === tagColor)?.name }}</span></div><p>Select a color for this tag.</p><RadioGroup v-model="tagColor" class="palette" aria-label="Tag color"><RadioGroupItem v-for="color in palette" :key="color.value" class="palette-radio" :style="{ backgroundColor: color.value }" :value="color.value" :aria-label="color.name" :title="color.name" /></RadioGroup></div></template>
        <div v-if="section !== 'variants'" class="field"><span class="field-title">Products</span><p>Choose products to assign to this {{ section === 'categories' ? 'category' : 'tag' }}.</p><input v-model="productSearch" type="search" placeholder="Search products" aria-label="Search products" /><div class="product-list"><p v-if="loadingForm">Loading products…</p><p v-else-if="!filteredProducts.length">No products found.</p><div v-for="item in filteredProducts" :key="item.id" class="product-option"><Checkbox :id="`category-product-${item.id}`" :model-value="selectedProducts.includes(item.id)" :disabled="loadingForm || working" @update:model-value="toggleProduct(item.id, $event === true)" /><label :for="`category-product-${item.id}`" class="product-choice"><img v-if="productImage(item)" :src="productImage(item)" alt="" class="product-choice-image" /><span v-else class="product-choice-image product-choice-placeholder"><span class="i-lucide-image" aria-hidden="true" /></span><span class="product-choice-details"><span class="product-choice-name">{{ item.title }}</span><span class="product-choice-price">{{ productPrice(item) }}</span></span></label></div></div><small>{{ selectedProducts.length }} selected</small></div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </div><footer><button type="button" class="secondary-button" :disabled="working" @click="showDialog = false">Cancel</button><button type="submit" class="primary-button" :disabled="working || loadingForm || formLoadFailed">{{ working ? 'Saving…' : 'Save' }}</button></footer></form>
    </div></div></Teleport>
    <MediaPickerDialog v-model:open="mediaOpen" title="Choose image" description="Select or upload an image." media-type="image" @select="onMediaSelected" />
    <IconPickerDialog v-model:open="iconOpen" title="Choose icon" description="Choose an icon for this option." @select="onIconSelected" />
  </section>
</template>
<style scoped>
.taxonomy-view{height:100%;overflow:auto;color:var(--foreground)}.taxonomy-header{padding:28px 32px;display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:1px dashed var(--border)}h1,h2,p{margin:0}h1{font-size:24px;font-weight:650}h2{font-size:17px;font-weight:650}p,small{color:var(--muted-foreground);font-size:12px;line-height:1.5}.taxonomy-header p,.dialog header p{margin-top:5px}.primary-button,.secondary-button{padding:9px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}.primary-button{background:var(--primary);color:var(--primary-foreground);border:1px solid var(--primary)}.secondary-button{background:var(--card);color:var(--foreground);border:1px solid var(--border)}button:disabled{opacity:.5;cursor:not-allowed}.setup{text-align:center;padding:70px 20px}.setup p{margin:8px 0 18px}.table-wrap{overflow:auto}table{border-collapse:collapse;text-align:left;width:100%;font-size:12px}th{padding:14px 20px;color:var(--muted-foreground);font-size:11px;font-weight:500;border-bottom:1px dashed var(--border)}td{padding:16px 20px;border-bottom:1px dashed var(--border)}th:first-child,td:first-child{padding-left:32px}tbody tr{cursor:pointer}tbody tr:hover,tbody tr:focus-within{background:color-mix(in srgb,var(--primary) 10%,transparent)}.entry-name{font-size:13px;font-weight:650;color:var(--foreground);text-align:left}.entry-name:hover{text-decoration:underline}td small{display:block;margin-top:4px}.empty{text-align:center;padding:70px 20px;color:var(--muted-foreground);font-size:13px}.notice{padding:16px 32px}.error{font-size:12px;color:#fb8b86}.pagination{display:flex;justify-content:flex-end;align-items:center;gap:15px;padding:18px 32px;font-size:12px}.backdrop{position:fixed;inset:0;z-index:40;background:#000a;display:flex;align-items:center;justify-content:center;padding:20px}.dialog{width:min(540px,100%);max-height:90vh;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--background);box-shadow:0 20px 60px #0008}.dialog header{display:flex;justify-content:space-between;gap:20px;padding:24px 26px;border-bottom:1px solid var(--border)}.close{width:32px;height:32px;border-radius:6px;color:var(--muted-foreground);font-size:22px;cursor:pointer}.close:hover{background:var(--card);color:var(--foreground)}.form-body{display:grid;gap:18px;padding:24px 26px}.form-body label{font-size:12px;font-weight:600}.form-body label span{font-weight:400;color:var(--muted-foreground)}.form-body input,.form-body textarea,.form-body select{display:block;width:100%;margin-top:8px;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--foreground);font-size:13px}.form-body small{display:block;margin-top:5px;font-weight:400}.product-select{display:grid;gap:8px}.product-select label{font-size:12px;font-weight:600}.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}.dialog footer{position:sticky;bottom:0;background:var(--background);display:flex;justify-content:flex-end;gap:10px;padding:18px 26px;border-top:1px solid var(--border)}@media(max-width:600px){.taxonomy-header{align-items:flex-start;flex-direction:column;padding:22px}.row{grid-template-columns:1fr}}
.field{display:grid;gap:8px;font-size:12px;font-weight:600}.field input:not([type=color]),.field textarea{margin-top:0}.field-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.field p{margin-top:5px}.field-title>span{font-weight:400;color:var(--muted-foreground)}.product-list{display:grid;gap:4px;max-height:190px;overflow:auto;border:1px solid var(--border);border-radius:6px;padding:10px}.product-option{display:flex;align-items:center;gap:9px;padding:6px}.product-option label{cursor:pointer}.image-control{display:flex;align-items:center;gap:12px}.image-control img,.image-placeholder{width:72px;height:72px;object-fit:cover;border-radius:7px;background:var(--card);border:1px solid var(--border)}.image-placeholder{display:grid;place-items:center;color:var(--muted-foreground);font-size:20px}.image-actions{display:flex;gap:8px;align-items:center}.text-button{font-size:12px;color:var(--muted-foreground)}.option-list{display:grid;gap:8px}.option-row{display:flex;gap:8px;align-items:center}.option-row>input{min-width:0;flex:1}.identifier-button{display:inline-flex;align-items:center;gap:6px;max-width:180px;overflow:hidden;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--card);font-size:12px}.identifier-button img{width:24px;height:24px;object-fit:cover;border-radius:3px}.color-input{display:flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:6px;padding:5px 8px;background:var(--card)}.color-input input{width:30px;height:28px;padding:0;border:0;background:none;cursor:pointer}.palette{display:flex;flex-wrap:wrap;gap:12px}.palette-choice{display:flex;align-items:center;gap:5px;cursor:pointer}.color-swatch,.color-dot{width:20px;height:20px;border-radius:50%;border:1px solid #ffffff40}.color-dot{display:inline-block;width:12px;height:12px;vertical-align:middle;margin-right:8px}.capitalize{text-transform:capitalize}.remove-option{width:32px;height:32px;color:var(--muted-foreground);cursor:pointer}.close{display:grid;place-items:center}.secondary-button{display:inline-flex;align-items:center;gap:5px}.dialog{width:min(600px,100%)}

.palette-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.palette-name{font-size:11px;color:var(--muted-foreground);font-weight:500}.palette{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}.palette :deep(.palette-radio){position:relative;display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border:3px solid var(--background);border-radius:50%;box-shadow:0 0 0 1px transparent;cursor:pointer;transition:box-shadow .15s ease,transform .15s ease}.palette :deep(.palette-radio:hover){box-shadow:0 0 0 1px var(--muted-foreground);transform:scale(1.08)}.palette :deep(.palette-radio[data-state=checked]){box-shadow:0 0 0 2px var(--foreground)}.palette :deep(.palette-radio:focus-visible){outline:2px solid var(--primary);outline-offset:3px}.palette :deep(.palette-radio [data-state=checked]){display:grid;place-items:center}.palette :deep(.palette-radio [data-state=checked] span){display:none}

.product-list{scrollbar-width:auto;scrollbar-color:var(--muted-foreground) var(--card)}
.product-list::-webkit-scrollbar{width:14px}
.product-list::-webkit-scrollbar-track{background:var(--card);border-radius:7px}
.product-list::-webkit-scrollbar-thumb{background:var(--muted-foreground);border:3px solid var(--card);border-radius:7px}
.product-list::-webkit-scrollbar-thumb:hover{background:var(--foreground)}

.variant-colors{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.variant-color{display:block;width:30px;height:30px;border-radius:4px;border:1px solid #ffffff40;box-shadow:0 0 0 1px #0002}

.option-row>input,.option-row>.color-input{height:40px;box-sizing:border-box}

.variant-text-options{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.variant-text-option{display:inline-flex;align-items:center;justify-content:center;min-width:30px;min-height:30px;padding:4px 9px;border:1px solid var(--border);border-radius:4px;background:var(--card);color:var(--foreground);font-size:12px;font-weight:500;white-space:nowrap}

.product-choice{display:flex;align-items:center;gap:12px;min-width:0;flex:1;padding:3px 4px}.product-choice-image{width:40px;height:40px;object-fit:cover;flex-shrink:0;border-radius:5px;background:var(--card)}.product-choice-placeholder{display:grid;place-items:center;color:var(--muted-foreground);font-size:18px}.product-choice-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.product-choice-price{flex-shrink:0;color:var(--muted-foreground);font-weight:500;font-variant-numeric:tabular-nums}.product-option:hover{background:color-mix(in srgb,var(--primary) 8%,transparent);border-radius:6px}
.option-row>.color-input{display:flex;align-items:center;justify-content:center;gap:8px;line-height:1}.color-input input[type=color]{appearance:none;display:block;width:24px;height:24px;flex:none;margin:0;padding:0;border:0;background:transparent}.color-input input[type=color]::-webkit-color-swatch-wrapper{padding:0}.color-input input[type=color]::-webkit-color-swatch{border:0;border-radius:3px}.color-input input[type=color]::-moz-color-swatch{border:0;border-radius:3px}

.product-choice-details{display:flex;min-width:0;flex:1;flex-direction:column;align-items:flex-start;gap:4px}.product-choice-name{max-width:100%;flex:none}.product-choice-price{font-size:11px;line-height:1.25}
</style>
