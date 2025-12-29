import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // Try fetching with explicit session
    const response = await admin.rest.resources.Theme.all({
      session: admin.session,
    });
    
    // If response is undefined or null, it might be due to API version mismatch or auth issue
    if (!response) {
       console.error("Themes API returned no response");
       return json({ error: "No response from Shopify API" }, { status: 500 });
    }

    console.log("Themes API Response Keys:", Object.keys(response));

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
