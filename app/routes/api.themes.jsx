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
    const apiVersion = "2024-04"; // Sync with api.section.jsx
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

    // Check for installed sections in ALL themes
    const installedSections = new Set();
    
    console.log(`Checking installed sections for shop: ${shop} across ${sortedThemes.length} themes.`);

    // Use Promise.all to check themes in parallel
    // We use the "List Assets" endpoint which is efficient and returns all asset keys
    await Promise.all(sortedThemes.map(async (theme) => {
        try {
            const assetsUrl = `https://${shop}/admin/api/${apiVersion}/themes/${theme.id}/assets.json`;
            const assetsResp = await fetch(assetsUrl, {
                headers: { "X-Shopify-Access-Token": accessToken }
            });

            if (assetsResp.ok) {
                const assetsData = await assetsResp.json();
                const assets = assetsData.assets || [];
                
                // Debug log to see what we found (summary)
                // console.log(`Theme ${theme.id} (${theme.role}) has ${assets.length} assets.`);

                // Check if our sections exist in this theme's assets
                // We check both new and old filenames to be safe
                const has3DCarousel = assets.some(a => 
                    a.key === "sections/3d-carousel-pro.liquid" || 
                    a.key === "sections/three-d-carousel.liquid"
                );
                
                const hasCustomSection = assets.some(a => 
                    a.key === "sections/my-custom-section.liquid"
                );
                
                if (has3DCarousel) {
                    console.log(`FOUND 3d-carousel-pro in theme ${theme.id} (${theme.role})`);
                    installedSections.add("3d-carousel-pro");
                }
                if (hasCustomSection) {
                    installedSections.add("my-custom-section");
                }
            } else {
                console.warn(`Failed to fetch assets for theme ${theme.id}: ${assetsResp.status}`);
            }
        } catch (err) {
            console.warn(`Failed to check assets for theme ${theme.id}:`, err);
        }
    }));
    
    console.log("Final Installed Sections List:", Array.from(installedSections));
    
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