import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.rest.resources.Theme.all({
    session: admin.session,
  });

  if (response) {
    // Filter for main/published theme usually, but user wants to select.
    // We return all processed themes.
    const themes = response.data.map(theme => ({
      id: theme.id,
      name: theme.name,
      role: theme.role,
      processing: theme.processing
    }));
    return json({ themes });
  }

  return json({ themes: [] });
};
