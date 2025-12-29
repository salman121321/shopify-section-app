import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const response = await admin.rest.resources.Theme.all({
      session: admin.session,
    });
    
    // Sort themes: Live theme first, then others
    const themes = response.data.sort((a, b) => {
        if (a.role === 'main') return -1;
        if (b.role === 'main') return 1;
        return 0;
    });

    return json({ themes });
  } catch (error) {
    console.error("Failed to fetch themes:", error);
    return json({ error: "Failed to fetch themes" }, { status: 500 });
  }
};
