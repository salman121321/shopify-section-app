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
    // We use GraphQL to check for assets because REST API is returning false 404s for some stores
    await Promise.all(sortedThemes.map(async (theme) => {
        try {
            const gqlQuery = `
              query checkAssets($themeId: ID!) {
                newCarousel: theme(id: $themeId) {
                  files(first: 1, query: "filename:sections/3d-carousel-pro.liquid") { nodes { filename } }
                }
                oldCarousel: theme(id: $themeId) {
                  files(first: 1, query: "filename:sections/three-d-carousel.liquid") { nodes { filename } }
                }
                customSection: theme(id: $themeId) {
                  files(first: 1, query: "filename:sections/my-custom-section.liquid") { nodes { filename } }
                }
              }
            `;

            const gqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
            const gqlResp = await fetch(gqlUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken
                },
                body: JSON.stringify({
                    query: gqlQuery,
                    variables: {
                        themeId: `gid://shopify/Theme/${theme.id}`
                    }
                })
            });

            if (!gqlResp.ok) {
                console.warn(`GraphQL Check Failed for theme ${theme.id}: ${gqlResp.status}`);
                return;
            }

            const gqlData = await gqlResp.json();
            
            if (gqlData.errors) {
                console.warn(`GraphQL Errors for theme ${theme.id}:`, gqlData.errors);
                return;
            }

            const data = gqlData.data;
            if (!data) return;

            // Check 3D Carousel
            const hasNew = data.newCarousel?.files?.nodes?.length > 0;
            const hasOld = data.oldCarousel?.files?.nodes?.length > 0;
            
            if (hasNew || hasOld) {
                console.log(`[GraphQL] FOUND 3d-carousel-pro in theme ${theme.id} (${theme.role})`);
                installedSections.add("3d-carousel-pro");
            } else {
                console.log(`[GraphQL] NOT FOUND 3d-carousel-pro in theme ${theme.id}`);
            }

            // Check Custom Section
            if (data.customSection?.files?.nodes?.length > 0) {
                 console.log(`[GraphQL] FOUND my-custom-section in theme ${theme.id}`);
                 installedSections.add("my-custom-section");
            }

        } catch (err) {
            console.warn(`Failed to check assets (GraphQL) for theme ${theme.id}:`, err);
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