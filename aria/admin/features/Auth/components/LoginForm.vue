<script setup lang="ts">
/**
 * LoginForm Component
 *
 * Username/email and password login form with TOTP support.
 * Mutations stay behind Astro Actions.
 *
 * @component
 */

import { ref, computed, nextTick, onBeforeUnmount, onMounted } from "vue";
import {
  LoginFormSchema,
  type LoginFormData,
  type LoginFormState,
} from "../types";
import { getLoginCaptchaConfig, loginUser } from "../composables/useAuthApi";
import type { LoginCaptchaConfig } from "../composables/useAuthApi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useStudioI18n } from "@/i18n";
import { localizeAuthError } from "../utils/localizeAuthError";

const formData = ref<LoginFormData>({
  identifier: "",
  password: "",
  rememberMe: false,
  captchaToken: undefined,
  totpCode: undefined,
});

const formState = ref<LoginFormState>({
  isLoading: false,
  error: null,
  success: false,
  showTotpInput: false,
});

const { t } = useStudioI18n();

const totpValue = ref("");
const showPassword = ref(false);
const captchaConfig = ref<LoginCaptchaConfig>({ enabled: false });
const captchaLoading = ref(true);
const captchaLoadError = ref<string | null>(null);
const captchaContainer = ref<HTMLElement | null>(null);
let captchaWidgetId: string | undefined;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const buttonText = computed(() => {
  if (formState.value.isLoading) return t("auth.signingIn");
  return t("auth.signIn");
});

function clearError(): void {
  formState.value.error = null;
}

function setError(message: string): void {
  formState.value.error = message;
}

function loginValidationMessage(field: unknown): string {
  if (field === "identifier") return t("auth.identifierRequired");
  if (field === "password") return t("auth.passwordRequired");
  if (field === "totpCode") return t("auth.totpCodeInvalid");
  return t("auth.invalidForm");
}

async function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return window.turnstile;

  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-aria-turnstile="true"]',
  );
  await new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.ariaTurnstile = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
      once: true,
    });
  });
  if (!window.turnstile) throw new Error("Turnstile failed to initialize");
  return window.turnstile;
}

function resetCaptcha(): void {
  formData.value.captchaToken = undefined;
  if (captchaWidgetId && window.turnstile) window.turnstile.reset(captchaWidgetId);
}

async function initializeCaptcha(): Promise<void> {
  if (!captchaConfig.value.enabled) return;
  await nextTick();
  const container = captchaContainer.value;
  if (!container) throw new Error("Turnstile container is unavailable");
  const turnstile = await loadTurnstile();
  captchaWidgetId = turnstile.render(container, {
    sitekey: captchaConfig.value.siteKey,
    action: "turnstile-spin-v1",
    callback: (token) => {
      formData.value.captchaToken = token;
      captchaLoadError.value = null;
    },
    "error-callback": () => {
      formData.value.captchaToken = undefined;
      captchaLoadError.value = t("auth.captcha.loadFailed");
    },
    "expired-callback": () => {
      formData.value.captchaToken = undefined;
      captchaLoadError.value = t("auth.captcha.expired");
    },
    "timeout-callback": () => {
      formData.value.captchaToken = undefined;
      captchaLoadError.value = t("auth.captcha.timedOut");
    },
  });
}

async function handleSubmit(): Promise<void> {
  clearError();

  if (captchaLoading.value || captchaLoadError.value) {
    setError(captchaLoadError.value ?? t("auth.captcha.loading"));
    return;
  }
  if (captchaConfig.value.enabled && !formData.value.captchaToken) {
    setError(t("auth.captcha.required"));
    return;
  }

  // Sync OTP value from the template binding before Zod validation
  if (formState.value.showTotpInput) {
    formData.value.totpCode = totpValue.value;
  }

  // Validate with Zod
  const validation = LoginFormSchema.safeParse(formData.value);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    setError(loginValidationMessage(firstError?.path[0]));
    return;
  }

  // TOTP code required when TOTP input is visible
  if (formState.value.showTotpInput && formData.value.totpCode?.length !== 6) {
    setError(t("auth.enterSixDigitCode"));
    return;
  }

  formState.value.isLoading = true;

  try {
    const { data, error } = await loginUser(validation.data);

    if (error) {
      setError(localizeAuthError(error, t));
      if (captchaConfig.value.enabled) resetCaptcha();
      formState.value.isLoading = false;
      return;
    }

    if (data?.status === "totp_required") {
      formState.value.showTotpInput = true;
      formData.value.totpCode = "";
      totpValue.value = "";
      // Turnstile tokens are single-use. Obtain a fresh token for the TOTP
      // submission, which repeats the password-login request server-side.
      if (captchaConfig.value.enabled) resetCaptcha();
      formState.value.isLoading = false;
      return;
    }

    if (data?.status === "success") {
      formState.value.success = true;
      window.location.href = "/admin";
    }
  } catch {
    setError(t("common.failed"));
  } finally {
    formState.value.isLoading = false;
  }
}

onMounted(() => {
  // Check for URL error parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlError = urlParams.get("error");
  if (urlError) {
    setError(localizeAuthError(urlError, t));
  }

  void getLoginCaptchaConfig()
    .then(async ({ data, error }) => {
      if (error || !data) {
        captchaLoadError.value = t("auth.captcha.unavailable");
        return;
      }
      captchaConfig.value = data;
      if (data.enabled) await initializeCaptcha();
    })
    .catch(() => {
      captchaLoadError.value = t("auth.captcha.unavailable");
    })
    .finally(() => {
      captchaLoading.value = false;
    });
});

onBeforeUnmount(() => {
  if (captchaWidgetId && window.turnstile) window.turnstile.remove(captchaWidgetId);
});
</script>

<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <Alert
      v-if="formState.error"
      variant="destructive"
      class="border-dashed animate-shake"
    >
      <span class="i-hugeicons:alert-02" aria-hidden="true" />
      <AlertTitle>{{ t("auth.signInAttention") }}</AlertTitle>
      <AlertDescription>
        {{ formState.error }}
      </AlertDescription>
    </Alert>

    <div class="space-y-2">
      <Label
        for="identifier"
        class="text-sm! text-muted-foreground"
        >{{ t("auth.identifier") }}</Label
      >
      <Input
        id="identifier"
        v-model="formData.identifier"
        type="text"
        :placeholder="t('auth.identifier')"
        required
        autocomplete="username"
        class="bg-background-70 border-dashed"
      />
    </div>

    <div class="relative space-y-2">
      <Label
        for="password"
        class="text-sm! text-muted-foreground"
        >{{ t("auth.password") }}</Label
      >
      <Input
        id="password"
        v-model="formData.password"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="t('auth.password')"
        required
        autocomplete="current-password"
        class="bg-background-70 border-dashed pr-12"
      />
      <button
        type="button"
        class="absolute right-3 top-[28px] size-5 cursor-pointer text-foreground/80 transition-colors hover:text-primary"
        :class="showPassword ? 'i-lucide:eye-off' : 'i-lucide:eye'"
        :aria-label="t('auth.togglePasswordVisibility')"
        @click="showPassword = !showPassword"
      />
    </div>

    <div
      v-if="formState.showTotpInput"
      class="px-3 py-5 bg-background/50 rounded-md border-dashed border border-border"
    >
      <p class="text-sm text-muted-foreground leading-0 pb-2">
        {{ t("auth.enterTotp") }}
      </p>
      <div>
        <InputOTP v-model="totpValue" :maxlength="6">
          <InputOTPGroup>
            <InputOTPSlot :index="0" />
            <InputOTPSlot :index="1" />
            <InputOTPSlot :index="2" />
            <InputOTPSlot :index="3" />
            <InputOTPSlot :index="4" />
            <InputOTPSlot :index="5" />
          </InputOTPGroup>
        </InputOTP>
      </div>
    </div>

    <div v-if="captchaConfig.enabled" class="space-y-2">
      <div ref="captchaContainer" />
      <p v-if="captchaLoadError" class="text-sm text-destructive">
        {{ captchaLoadError }}
      </p>
    </div>

    <div class="flex items-center justify-between gap-3">
      <label class="flex items-center gap-2 cursor-pointer">
        <Checkbox v-model="formData.rememberMe" />
        <span class="text-sm text-muted-foreground">{{ t("auth.rememberMe") }}</span>
      </label>
      <a
        href="/admin/forgot-password"
        class="text-sm text-muted-foreground hover:text-primary transition-colors"
        >{{ t("auth.forgotPassword") }}</a
      >
    </div>

    <Button
      type="submit"
      :disabled="formState.isLoading"
      class="w-full"
      size="lg"
    >
      {{ formState.showTotpInput ? t("auth.verifyCode") : buttonText }}
    </Button>
  </form>
</template>
