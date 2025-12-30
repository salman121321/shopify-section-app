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
    // We use SPECIFIC ASSET GET because "List Assets" might be paginated and miss the file
    await Promise.all(sortedThemes.map(async (theme) => {
        try {
            // Check for 3D Carousel (New Key)
            const checkCarouselNew = fetch(`https://${shop}/admin/api/${apiVersion}/themes/${theme.id}/assets.json?asset[key]=sections/3d-carousel-pro.liquid`, {
                headers: { "X-Shopify-Access-Token": accessToken }
            });
            
            // Check for 3D Carousel (Old Key - just in case)
            const checkCarouselOld = fetch(`https://${shop}/admin/api/${apiVersion}/themes/${theme.id}/assets.json?asset[key]=sections/three-d-carousel.liquid`, {
                headers: { "X-Shopify-Access-Token": accessToken }
            });

            // Check for Custom Section
            const checkCustom = fetch(`https://${shop}/admin/api/${apiVersion}/themes/${theme.id}/assets.json?asset[key]=sections/my-custom-section.liquid`, {
                headers: { "X-Shopify-Access-Token": accessToken }
            });

            const [respNew, respOld, respCustom] = await Promise.all([checkCarouselNew, checkCarouselOld, checkCustom]);

            if (respNew.ok || respOld.ok) {
                console.log(`FOUND 3d-carousel-pro in theme ${theme.id} (${theme.role})`);
                installedSections.add("3d-carousel-pro");
            }
            
            if (respCustom.ok) {
                installedSections.add("my-custom-section");
            }

        } catch (err) {
            console.warn(`Failed to check specific assets for theme ${theme.id}:`, err);
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