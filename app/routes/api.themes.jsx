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
    const apiVersion = "2024-10"; // Sync with api.section.jsx
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

    // STRATEGY 1: Check Shop Metafields (Source of Truth)
    // We switched to Shop Metafields for better Liquid accessibility
    try {
        const gqlQuery = `
          query {
            shop {
              metafield(namespace: "shopi_section", key: "installed_sections") {
                value
              }
            }
          }
        `;
        const gqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
        const gqlResp = await fetch(gqlUrl, {
             method: "POST",
             headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
             body: JSON.stringify({ query: gqlQuery })
        });
        if (gqlResp.ok) {
            const gqlData = await gqlResp.json();
            const val = gqlData.data?.shop?.metafield?.value;
            if (val) {
                try {
                    const list = JSON.parse(val);
                    if (Array.isArray(list)) {
                        list.forEach(id => installedSections.add(id));
                    }
                } catch (e) { console.warn("Invalid metafield JSON:", e); }
            }
        }
    } catch (err) {
        console.error("Failed to check Shop Metafields:", err);
    }

    // STRATEGY 2: Disabled. 
    // We rely purely on Metafield gating now. File presence does not imply activation.
    /*
    if (!installedSections.has("3d-carousel-pro")) {
        // ... (Asset check logic removed to prevent false positives)
    }
    */
    
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