"use server";
import { revalidatePath } from "next/cache";
import { repository } from "@/lib/runtime";
import { resetSettings, saveSettings } from "@/lib/settings-service";
import { automaticLabels } from "@/lib/catalog";
import type { FormState } from "./tickets";
function number(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
}
export async function updateSettings(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const version = number(form, "version");
  const overrides = Object.fromEntries(
    automaticLabels
      .filter((k) => form.get(`override-${k}`) !== "")
      .map((k) => [k, number(form, `override-${k}`)]),
  );
  const result =
    form.get("action") === "reset"
      ? resetSettings(repository(), version)
      : saveSettings(
          repository(),
          {
            minConfidence: number(form, "minConfidence"),
            minMargin: number(form, "minMargin"),
            categoryOverrides: overrides,
          },
          version,
        );
  if (!result.ok) return { message: result.message };
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Settings saved. Version ${result.data.version}.`,
  };
}
