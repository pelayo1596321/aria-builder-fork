<script setup lang="ts">
/** First administrator setup with username, email, and password. */

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useStudioI18n } from "@/i18n";
import { localizeAuthError } from "../utils/localizeAuthError";
import { createFirstAdmin } from "../composables/useAuthApi";
import { useSetupWizard } from "../composables/useSetupWizard";
import SetupAccountStep from "./setup/SetupAccountStep.vue";
import SetupRecoveryStep from "./setup/SetupRecoveryStep.vue";

const { t } = useStudioI18n();
const wizard = useSetupWizard("password_legacy", t);

async function handleSubmit(): Promise<void> {
  if (!wizard.validateRecoveryStep()) return;

  wizard.setLoading(true);
  try {
    const { data, error } = await createFirstAdmin(wizard.formData.value);
    if (error) {
      wizard.setError(localizeAuthError(error, t));
      return;
    }

    if (data?.success) {
      wizard.setSuccess(true);
      setTimeout(() => {
        window.location.href = "/admin";
      }, 900);
      return;
    }

    wizard.setError(
      data?.message
        ? localizeAuthError(data.message, t)
        : t("auth.createAccountFailed"),
    );
  } catch {
    wizard.setError(t("common.failed"));
  } finally {
    wizard.setLoading(false);
  }
}
</script>

<template>
  <form class="space-y-7" @submit.prevent="handleSubmit">
    <Alert
      v-if="wizard.state.value.error"
      variant="destructive"
      class="border-dashed"
    >
      <span class="i-hugeicons:alert-02" aria-hidden="true" />
      <AlertTitle>{{ t("auth.setupAttention") }}</AlertTitle>
      <AlertDescription>{{ wizard.state.value.error }}</AlertDescription>
    </Alert>

    <Alert
      v-if="wizard.state.value.success"
      class="border-dashed border-primary/50 bg-primary/10 text-foreground"
    >
      <span class="i-hugeicons:checkmark-circle-02 text-primary" aria-hidden="true" />
      <AlertTitle>{{ t("auth.accountCreated") }}</AlertTitle>
      <AlertDescription>{{ t("auth.openingStudio") }}</AlertDescription>
    </Alert>

    <SetupAccountStep v-model:form-data="wizard.formData.value" />
    <SetupRecoveryStep v-model:form-data="wizard.formData.value" />

    <Button
      type="submit"
      class="w-full h-9!"
      variant="default"
      size="lg"
      :disabled="wizard.state.value.isLoading || wizard.state.value.success"
    >
      {{ wizard.state.value.isLoading ? t("auth.creating") : t("auth.createAccount") }}
    </Button>
  </form>
</template>
