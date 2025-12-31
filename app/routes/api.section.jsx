import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { THREE_D_CAROUSEL_LIQUID } from "../templates/three-d-carousel";

// Helper to mark section as installed in Shop Metafields
// We use a Shop Metafield to store the list of installed sections per theme or globally.
// Ideally, we attach this to the Theme, but Shop is easier to access consistently.
// We will store: namespace: "shopi_installed", key: "sections", value: JSON array of section IDs
async function markSectionInstalled(shop, accessToken, apiVersion, sectionId) {
    try {
        // 1. Fetch current installed sections
        const getQuery = `
          query {
            currentAppInstallation {
              id
              metafield(namespace: "shopi_section", key: "installed_sections") {
                value
                id
              }
            }
          }
        `;
        
        const gqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
        const getResp = await fetch(gqlUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
            body: JSON.stringify({ query: getQuery })
        });
        
        const getData = await getResp.json();
        const appInstallation = getData.data?.currentAppInstallation;
        if (!appInstallation) {
            console.error("Failed to get AppInstallation for Metafield update");
            throw new Error("Failed to get AppInstallation for Metafield update (Permissions?)");
        }

        let installedSections = [];
        if (appInstallation.metafield?.value) {
            try {
                installedSections = JSON.parse(appInstallation.metafield.value);
            } catch (e) {
                console.warn("Failed to parse existing metafield value:", e);
            }
        }

        if (!installedSections.includes(sectionId)) {
            installedSections.push(sectionId);
            
            // 2. Update Metafield
            const updateQuery = `
              mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                  metafields {
                    key
                    value
                    valueType: JSON_STRING
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
            // NOTE: 'type' is deprecated in favor of specific types, but API version matters.
            // For 2024-10, type is removed from MetafieldsSetInput in favor of inferring from definition or just value?
            // Actually, for app-owned metafields, we often just need value.
            // But let's check the spec. 'type' was deprecated. 
            // We'll stick to what was working or use simplified input.
            // Wait, previous code had `type: "json"`.
            
            const updateResp = await fetch(gqlUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
                body: JSON.stringify({
                    query: updateQuery,
                    variables: {
                        metafields: [{
                            ownerId: appInstallation.id,
                            namespace: "shopi_section",
                            key: "installed_sections",
                            type: "json", 
                            value: JSON.stringify(installedSections)
                        }]
                    }
                })
            });
            
            const updateData = await updateResp.json();
            console.log("Metafield Update Result:", JSON.stringify(updateData));
            
            const userErrors = updateData.data?.metafieldsSet?.userErrors;
            if (userErrors && userErrors.length > 0) {
                 throw new Error(`Metafield Update Failed: ${JSON.stringify(userErrors)}`);
            }
        } else {
            console.log("Section already in metafield list.");
        }

    } catch (err) {
        console.error("Failed to update installed section metafield:", err);
        throw err;
    }
}

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  console.log("\n=== NEW SECTION INSTALL REQUEST (V2_FIXED) ===");
  console.log("Session Shop:", session.shop);
  console.log("Session Scopes:", session.scope);
  console.log("Session Access Token Length:", session.accessToken?.length || 0);

  if (!session.scope?.includes("write_themes")) {
      console.error("❌ Missing write_themes scope!");
      // We can relax this check if we are just deep linking, but for now let's keep it 
      // or we can remove it since we aren't uploading.
      // But user said they don't have exemption access, so maybe they don't even have write_themes?
      // If they don't have write_themes, this will block them.
      // Let's REMOVE this check since we are using deep links now!
      // return json({ error: "Missing 'write_themes' permission. Please reinstall the app or update permissions." }, { status: 403 });
      console.warn("⚠️ User might be missing write_themes, but we are proceeding with Deep Link.");
  }

  const requestAction = formData.get("action");
  const themeId = formData.get("themeId");

  console.log("Action:", requestAction);
  console.log("Theme ID:", themeId);

  if (!themeId) {
    return json({ error: "Theme ID is required" }, { status: 400 });
  }

  // Skip early theme verification - we'll verify with direct API calls below
  // The admin.rest.resources.Theme.find() was causing false 404 errors
  console.log("Theme ID received:", themeId);

  const sectionId = formData.get("sectionId");

  if (!sectionId) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  // Map section IDs to their Liquid templates
  const sectionTemplates = {
    "3d-carousel-pro": {
        filename: "sections/shopi-3d-carousel-pro.liquid",
        content: THREE_D_CAROUSEL_LIQUID
    },
    "my-custom-section": {
        filename: "sections/my-custom-section.liquid",
        content: `{% schema %}
        {
          "name": "My Custom Section",
          "settings": [
             { "type": "text", "id": "heading", "label": "Heading", "default": "Hello World" }
          ],
          "presets": [{ 
              "name": "My Custom Section",
              "category": "Shopi Section"
          }]
        }
        {% endschema %}
        <h2>{{ section.settings.heading }}</h2>
        `
    }
  };

  const sectionData = sectionTemplates[sectionId];
  
  if (!sectionData) {
      return json({ error: "Invalid section ID" }, { status: 400 });
  }

  try {
    if (requestAction === "activate") {
      // FOR THEME APP EXTENSIONS: We do NOT upload liquid files anymore.
      // Instead, we just mark it as installed (for our own records) and redirect to the deep link.
      
      console.log(`Skipping asset upload for Theme App Extension: ${sectionData.filename}`);
      
      // Still mark as installed in our DB/Metafields if needed
      await markSectionInstalled(session.shop, session.accessToken, "2024-10", sectionId);

      return json({ 
          success: true, 
          message: "Redirecting to Theme Editor...",
          method: "deep_link",
          details: "Section activation is handled via Theme Editor deep link."
      });

    } else if (requestAction === "deactivate") {
      // FOR THEME APP EXTENSIONS: We do NOT delete files.
      // We just redirect to the theme editor so user can remove it.
      
      return json({ 
        success: true, 
        message: "Redirecting to Theme Editor...", 
        method: "deep_link",
        details: "Section removal is handled via Theme Editor." 
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Section Activation Failed:", error);
    return json({ error: error.message, technicalDetails: error.stack }, { status: 500 });
  }
};
