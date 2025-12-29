import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Try fetching without explicit session first, as admin context handles it
    const response = await admin.rest.resources.Theme.all({
      session: admin.session,
    });
    
    console.log("Themes API Response:", JSON.stringify(response, null, 2));

    // Handle different response structures
    const themesData = response.data || response;
    
    if (!Array.isArray(themesData)) {
        console.error("Invalid themes response format:", themesData);
        return json({ themes: [], error: "Invalid response format from Shopify" });
    }

    // Sort themes: Live theme first, then others
    const themes = themesData.sort((a, b) => {
        if (a.role === 'main') return -1;
        if (b.role === 'main') return 1;
        return 0;
    });

    return json({ themes });
  } catch (error) {
    console.error("Failed to fetch themes:", error);
    return json({ 
      error: error.message || "Failed to fetch themes",
      details: JSON.stringify(error)
    }, { status: 500 });
  }
};
