import { NextResponse } from "next/server";
import { authenticateExtension, isRegistryManager, jsonError, readJson } from "@/lib/extension-server";
import { isUuid, type TaxResponse } from "@/lib/extension";
import { getEstimatedTax } from "@/lib/tax";

const MAX_PRICE = 1_000_000;

// POST { registryId, price } → the price with estimated sales tax, for an
// item the owner marks as bought, as the site's add-item dialog adds it. The
// list's zip code stays on the server. `tax` is null when the list has no zip
// code, or its state has no sales tax.
export async function POST(request: Request) {
  const auth = await authenticateExtension(request);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  const body = await readJson(request);
  const registryId = body?.registryId;
  const price = body?.price;
  if (!isUuid(registryId) || typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    return jsonError("Invalid request", 400);
  }
  if (!(await isRegistryManager(user.id, registryId))) {
    return jsonError("You don't manage that registry.", 403);
  }

  const { data: registry } = await supabase.from("registries").select("settings").eq("id", registryId).maybeSingle();
  const settings = registry?.settings as { tax_enabled?: unknown; zip_code?: unknown } | null;
  const zipCode = settings?.tax_enabled !== false && typeof settings?.zip_code === "string" ? settings.zip_code : null;

  const response: TaxResponse = { tax: zipCode ? await getEstimatedTax(zipCode, price).catch(() => null) : null };
  return NextResponse.json(response);
}
