<script setup lang="ts">
import { computed, ref } from "vue";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudioI18n } from "@/i18n";
import { usePasswordStrength } from "../../composables/usePasswordStrength";
import type { SetupWizardData } from "../../schemas/setupWizard";

const formData = defineModel<SetupWizardData>("formData", { required: true });
const { t } = useStudioI18n();
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const passwordRef = computed(() => formData.value.password);
const { percentWidth, colorClass, colorStyle } = usePasswordStrength(passwordRef);

const hasPasswordValue = computed(() => formData.value.password.length > 0);
const hasConfirmValue = computed(
  () => formData.value.confirmPassword.length > 0,
);
const passwordsMatch = computed(
  () =>
    !formData.value.confirmPassword ||
    formData.value.password === formData.value.confirmPassword,
);

</script>

<template>
  <div class="space-y-7">
    <div class="relative space-y-2">
      <Label
        for="setup-password"
        class="text-2xs! font-mono font-medium uppercase tracking-wider text-muted-foreground/80"
      >
        {{ t("auth.password") }}
      </Label>
      <div class="relative">
        <Input
          id="setup-password"
          v-model="formData.password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :placeholder="t('auth.newPassword')"
          required
          minlength="7"
          class="border-dashed bg-background-70 pr-12"
        />
        <button
          type="button"
          class="absolute right-3 top-1/2 size-5 -translate-y-1/2 cursor-pointer text-accent"
          :class="showPassword ? 'i-lucide:eye-off' : 'i-lucide:eye'"
          :aria-label="t('auth.togglePasswordVisibility')"
          @click="showPassword = !showPassword"
        />
      </div>
      <p class="pl-1 text-2xs text-muted-foreground">
        {{ t("auth.minimumPasswordLength") }}
      </p>
    </div>

    <div
      class="mx-6 h-1.5 overflow-hidden rounded-full bg-border transition-opacity duration-300 ease-out motion-reduce:transition-none"
      :class="hasPasswordValue ? 'opacity-50' : 'opacity-0'"
    >
      <div
        class="h-full transition-all duration-300 ease-out motion-reduce:transition-none"
        :class="colorClass"
        :style="{ width: percentWidth, ...colorStyle }"
      />
    </div>

    <div class="relative space-y-2">
      <Label
        for="setup-confirm-password"
        class="text-2xs! font-mono font-medium uppercase tracking-wider text-muted-foreground/80"
      >
        {{ t("auth.confirmPassword") }}
      </Label>
      <div class="relative">
        <Input
          id="setup-confirm-password"
          v-model="formData.confirmPassword"
          :type="showConfirmPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :placeholder="t('auth.confirmNewPassword')"
          required
          class="border-dashed bg-background-70 pr-12"
          :aria-invalid="hasConfirmValue && !passwordsMatch"
        />
        <button
          type="button"
          class="absolute right-3 top-1/2 size-5 -translate-y-1/2 cursor-pointer text-accent"
          :class="showConfirmPassword ? 'i-lucide:eye-off' : 'i-lucide:eye'"
          :aria-label="t('auth.togglePasswordVisibility')"
          @click="showConfirmPassword = !showConfirmPassword"
        />
      </div>
      <p
        v-if="hasConfirmValue && !passwordsMatch"
        class="pl-1 text-2xs text-destructive"
      >
        {{ t("auth.passwordsDoNotMatch") }}
      </p>
    </div>
  </div>
</template>
