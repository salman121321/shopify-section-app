import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  console.log("DEBUG: Session Scopes:", session.scope);

  try {
    // FALLBACK: Use direct fetch for maximum stability (matches api.section.jsx)
    const shop = session.shop;
    const accessToken = session.accessToken;
    const apiVersion = "2024-10";
    const url = `https://${shop}/admin/api/${apiVersion}/themes.json`;

    const response = await fetch(url, {
        headers: {
            "X-Shopify-Access-Token": accessToken
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            console.log("Details: 401 Unauthorized detected. Deleting invalid session to force re-auth.");
            await prisma.session.deleteMany({ where: { shop } });
            return json({ reauth: true, error: "Authentication expired. Please reload the page." }, { status: 401 });
        }
        throw new Error(`Failed to fetch themes: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const themes = data.themes;

    if (!Array.isArray(themes)) {
       console.error("Invalid themes format:", data);
       throw new Error("Shopify API returned invalid themes format");
    }

    // Sort themes: Live theme first, then others
    const sortedThemes = themes.sort((a, b) => {
        if (a.role === 'main') return -1;
        if (b.role === 'main') return 1;
        return 0;
    });

    // Check for installed sections in ALL themes (to ensure status shows "Activated" regardless of which theme was used)
    // We limit to checking the specific known sections to avoid fetching full asset lists
    const installedSections = new Set();
    const knownSections = [
        "sections/3d-carousel-pro.liquid", 
        "sections/my-custom-section.liquid"
    ];

    // Use Promise.all to check themes in parallel for performance
    await Promise.all(sortedThemes.map(async (theme) => {
        try {
            for (const assetKey of knownSections) {
                // If we already found this section in another theme, we might technically skip checking it again 
                // if we only care about "is it installed anywhere". 
                // But for now, let's just check to be thorough.
                
                const assetUrl = `https://${shop}/admin/api/${apiVersion}/themes/${theme.id}/assets.json?asset[key]=${assetKey}`;
                const assetResp = await fetch(assetUrl, {
                    headers: { "X-Shopify-Access-Token": accessToken }
                });
                
                if (assetResp.ok) {
                    // Asset exists in this theme
                    if (assetKey.includes("3d-carousel-pro")) installedSections.add("3d-carousel-pro");
                    if (assetKey.includes("my-custom-section")) installedSections.add("my-custom-section");
                }
            }
        } catch (err) {
            console.warn(`Failed to check assets for theme ${theme.id}:`, err);
        }
    }));
    
    // Normalize and ensure ID is string for frontend
    const normalizedThemes = sortedThemes.map(t => ({
        id: String(t.id),
        name: t.name,
        role: t.role
    }));

    return json({ themes: normalizedThemes, installedSections: Array.from(installedSections) });
  } catch (error) {
    console.error("Failed to fetch themes:", error);
    return json({ 
      error: error.message || "Failed to fetch themes",
      details: JSON.stringify(error)
    }, { status: 500 });
  }
};