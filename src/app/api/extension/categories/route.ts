import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authenticateExtension, isRegistryManager, jsonError, readJson } from "@/lib/extension-server";
import { isUuid, type CategoryResponse } from "@/lib/extension";
import { categoryName } from "@/lib/item-categories";
import { addListCategory } from "@/lib/list-categories";

// POST { registryId, name } → adds a category to a registry the user
// manages, for the product form's "+ New category". It makes it the way the
// site's add-item dialog does (src/lib/list-categories.ts), so a category
// with that name already on the registry comes back instead of a second one.
export async function POST(request: Request) {
  const auth = await authenticateExtension(request);
  if (auth.response) return auth.response;
  const { user, supabase } = auth;

  const body = await readJson(request);
  const registryId = body?.registryId;
  if (!isUuid(registryId)) return jsonError("Invalid request", 400);
  if (!categoryName(body?.name)) return jsonError("Give the category a name.", 400);
  if (!(await isRegistryManager(user.id, registryId))) {
    return jsonError("You don't manage that registry.", 403);
  }

  // Runs as the user, so the access rules check they manage the registry too.
  const result = await addListCategory(supabase, registryId, body?.name);
  if ("error" in result) return jsonError("Couldn't add the category.", 500);

  revalidatePath(`/dashboard/registry/${registryId}`);
  const response: CategoryResponse = { category: { id: result.category.id, name: result.category.name } };
  return NextResponse.json(response);
}
