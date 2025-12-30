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

    // Check for installed sections in the main theme
    const mainTheme = sortedThemes.find(t => t.role === 'main');
    const installedSections = [];

    if (mainTheme) {
        try {
            // We check for specific known section files
            const knownSections = [
                "sections/3d-carousel-pro.liquid", 
                "sections/my-custom-section.liquid"
            ];
            
            // We can check them one by one or list all assets. Listing is often safer for permissions if we just read keys.
            // But let's try checking specific assets to be precise.
            for (const assetKey of knownSections) {
                const assetUrl = `https://${shop}/admin/api/${apiVersion}/themes/${mainTheme.id}/assets.json?asset[key]=${assetKey}`;
                const assetResp = await fetch(assetUrl, {
                    headers: { "X-Shopify-Access-Token": accessToken }
                });
                
                if (assetResp.ok) {
                    // If we get a 200 OK, the asset exists
                    // Map filename back to section ID
                    if (assetKey.includes("3d-carousel-pro")) installedSections.push("3d-carousel-pro");
                    if (assetKey.includes("my-custom-section")) installedSections.push("my-custom-section");
                }
            }
        } catch (assetErr) {
            console.warn("Failed to check installed assets:", assetErr);
            // Don't fail the whole request just because asset check failed
        }
    }
    
    // Normalize and ensure ID is string for frontend
    const normalizedThemes = sortedThemes.map(t => ({
        id: String(t.id),
        name: t.name,
        role: t.role
    }));

    return json({ themes: normalizedThemes, installedSections });
  } catch (error) {
    console.error("Failed to fetch themes:", error);
    return json({ 
      error: error.message || "Failed to fetch themes",
      details: JSON.stringify(error)
    }, { status: 500 });
  }
};