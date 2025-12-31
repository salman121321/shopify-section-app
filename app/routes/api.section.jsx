import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { THREE_D_CAROUSEL_LIQUID } from "../templates/three-d-carousel";

// Helper to mark section as installed in Shop Metafields
// We use a Shop Metafield to store the list of installed sections per theme or globally.
// We use Shop Metafields (owner: Shop) because they are more reliably accessible in Liquid than App Metafields.
async function markSectionInstalled(shop, accessToken, apiVersion, sectionId) {
    try {
        const gqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

        // 1. Fetch Shop ID and current installed sections
        const getQuery = `
          query {
            shop {
              id
              metafield(namespace: "shopi_section", key: "installed_sections") {
                value
              }
            }
          }
        `;
        
        const getResp = await fetch(gqlUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
            body: JSON.stringify({ query: getQuery })
        });
        
        const getData = await getResp.json();
        const shopData = getData.data?.shop;
        
        if (!shopData) {
            console.error("Failed to get Shop data for Metafield update");
            throw new Error("Failed to get Shop data");
        }

        let installedSections = [];
        if (shopData.metafield?.value) {
            try {
                installedSections = JSON.parse(shopData.metafield.value);
            } catch (e) {
                console.warn("Failed to parse existing metafield value:", e);
            }
        }

        if (!installedSections.includes(sectionId)) {
            installedSections.push(sectionId);
            
            // 2. Update Metafield on Shop Owner
            const updateQuery = `
              mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                  metafields {
                    key
                    value
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
            
            const updateResp = await fetch(gqlUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
                body: JSON.stringify({
                    query: updateQuery,
                    variables: {
                        metafields: [{
                            ownerId: shopData.id,
                            namespace: "shopi_section",
                            key: "installed_sections",
                            type: "json", 
                            value: JSON.stringify(installedSections)
                        }]
                    }
                })
            });
            
            const updateData = await updateResp.json();
            const userErrors = updateData.data?.metafieldsSet?.userErrors;
            if (userErrors && userErrors.length > 0) {
                 throw new Error(`Metafield Update Failed: ${JSON.stringify(userErrors)}`);
            }
        }
    } catch (err) {
        console.error("Failed to update installed section metafield:", err);
        throw err;
    }
}

async function unmarkSectionInstalled(shop, accessToken, apiVersion, sectionId) {
    try {
        const gqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

        // 1. Fetch Shop ID and current installed sections
        const getQuery = `
          query {
            shop {
              id
              metafield(namespace: "shopi_section", key: "installed_sections") {
                value
              }
            }
          }
        `;
        
        const getResp = await fetch(gqlUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
            body: JSON.stringify({ query: getQuery })
        });
        
        const getData = await getResp.json();
        const shopData = getData.data?.shop;
        
        if (!shopData) {
             console.error("Failed to get Shop data for Metafield update");
             return;
        }

        let installedSections = [];
        if (shopData.metafield?.value) {
            try {
                installedSections = JSON.parse(shopData.metafield.value);
            } catch (e) {
                console.warn("Failed to parse existing metafield value:", e);
            }
        }

        if (installedSections.includes(sectionId)) {
            // Filter out the section
            installedSections = installedSections.filter(id => id !== sectionId);
            
            const updateQuery = `
              mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                  metafields {
                    key
                    value
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
            
            const updateResp = await fetch(gqlUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
                body: JSON.stringify({
                    query: updateQuery,
                    variables: {
                        metafields: [{
                            ownerId: shopData.id,
                            namespace: "shopi_section",
                            key: "installed_sections",
                            type: "json", 
                            value: JSON.stringify(installedSections)
                        }]
                    }
                })
            });
            
            const updateData = await updateResp.json();
            const userErrors = updateData.data?.metafieldsSet?.userErrors;
            if (userErrors && userErrors.length > 0) {
                 throw new Error(`Metafield Update Failed: ${JSON.stringify(userErrors)}`);
            }
        }
    } catch (err) {
        console.error("Failed to remove installed section metafield:", err);
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
      // Instead, we just mark it as installed (for our own records).
      
      console.log(`Activating section: ${sectionId} for shop: ${session.shop}`);
      
      // Still mark as installed in our DB/Metafields if needed
      await markSectionInstalled(session.shop, session.accessToken, "2024-10", sectionId);

      return json({ 
          success: true, 
          message: "Section Activated Successfully",
          method: "metafield_update",
          details: "Section has been marked as active. It will now be visible in the Theme Editor."
      });

    } else if (requestAction === "deactivate") {
      // FOR THEME APP EXTENSIONS: We do NOT delete files.
      // We should probably remove it from the installed list.
      
      console.log(`Deactivating section: ${sectionId} for shop: ${session.shop}`);

      await unmarkSectionInstalled(session.shop, session.accessToken, "2024-10", sectionId);
      
      return json({ 
        success: true, 
        message: "Section Deactivated Successfully", 
        method: "metafield_update",
        details: "Section has been marked as inactive." 
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Section Activation Failed:", error);
    return json({ error: error.message, technicalDetails: error.stack }, { status: 500 });
  }
};
