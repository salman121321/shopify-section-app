import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
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
  
  console.log("Current Session Scopes:", session.scope);
  if (!session.scope?.includes("write_themes")) {
      return json({ error: "Missing 'write_themes' permission. Please reinstall the app or update permissions." }, { status: 403 });
  }

  const action = formData.get("action");
  const themeId = formData.get("themeId");

  console.log("Received Action:", action);
  console.log("Received ThemeID:", themeId);

  if (!themeId) {
    return json({ error: "Theme ID is required" }, { status: 400 });
  }

  // Verify theme exists
  try {
      // Direct REST client usage to verify theme existence and avoid Resource wrapping issues for this check
      // Note: admin.rest.resources.Theme.find() is the standard way
      const theme = await admin.rest.resources.Theme.find({
          session: session,
          id: Number(themeId)
      });
      
      if (!theme) {
          console.error(`Theme ${themeId} returned null/undefined`);
          return json({ error: `Theme with ID ${themeId} not found.` }, { status: 404 });
      }
      console.log("Theme verified:", theme.name);
  } catch (e) {
      console.error("Theme verification failed:", e);
      // Check if this error is also a 401
      if (e.message && e.message.includes("401")) {
          console.log("Details: 401 Unauthorized detected during theme check. Deleting invalid session.");
          await prisma.session.deleteMany({ where: { shop: session.shop } });
          return json({ reauth: true, error: "Authentication expired. Please reload the page." }, { status: 401 });
      }
      return json({ error: `Theme with ID ${themeId} not accessible. Details: ${e.message}` }, { status: 404 });
  }

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
    if (action === "activate") {
      // 1. Upload the Liquid file to the theme
      console.log(`Uploading asset ${sectionData.filename} to theme ${themeId}`);
      console.log(`Content length: ${sectionData.content.length}`);

      // FALLBACK: Use direct fetch to bypass library issues
      const shop = session.shop;
      const accessToken = session.accessToken;
      // Use 2024-04 for REST (LTS - Most Stable)
      const apiVersion = "2024-04"; 
      // Ensure strictly numeric ID
      const cleanThemeId = String(themeId).replace(/\D/g, "");

      console.log(`Debug: Shop=${shop}, ThemeID=${cleanThemeId}, TokenLength=${accessToken?.length}`);

      // DIAGNOSTIC 1: Check if Theme Exists via REST
      const themeUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}.json`;
      
      const themeResp = await fetch(themeUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });

      if (!themeResp.ok) {
          // ... (Existing error handling)
          const text = await themeResp.text();
          if (themeResp.status === 404) {
               return json({ error: `Theme not found (ID: ${cleanThemeId}). It might have been deleted.` }, { status: 404 });
          }
          if (themeResp.status === 403 || themeResp.status === 401) {
              await prisma.session.deleteMany({ where: { shop } });
              return json({ reauth: true, error: "Permissions need update. Reloading..." }, { status: 401 });
          }
          throw new Error(`Theme Check Failed (${themeResp.status}): ${text}`);
      }
      console.log("Diagnostic 1 Success: Theme exists.");

      // DIAGNOSTIC 2: Check Asset Access (Read layout/theme.liquid)
      // This confirms we have 'read_themes' AND access to this specific theme's assets
      const assetCheckUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?asset[key]=layout/theme.liquid`;
      const assetCheckResp = await fetch(assetCheckUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });
      
      if (!assetCheckResp.ok) {
           const text = await assetCheckResp.text();
           console.error(`Diagnostic 2 Failed: Cannot read assets. Status: ${assetCheckResp.status}`);
           
           if (assetCheckResp.status === 404) {
                // This is the Smoking Gun: If we can't read assets, we definitely can't write.
                // It means the Theme ID is valid (Diag 1) but the Assets endpoint is 404ing.
                // This usually implies a permissions mismatch or the theme is "locked".
                return json({ error: `Cannot access assets for Theme ${cleanThemeId}. Please ensure you have granted all permissions.` }, { status: 403 });
           }
      } else {
           console.log("Diagnostic 2 Success: Can read theme assets.");
      }

      // REAL UPDATE: Use REST API
      console.log("Attempting REST Asset Update...");
      const url = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json`;
      
      // DIAGNOSTIC 3: Verify Actual Scopes from Shopify
      // Sometimes the session has scopes but the token doesn't (stale token)
      const scopeUrl = `https://${shop}/admin/oauth/access_scopes.json`;
      const scopeResp = await fetch(scopeUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });
      
      let activeScopes = [];
      if (scopeResp.ok) {
          const scopeData = await scopeResp.json();
          activeScopes = scopeData.access_scopes.map(s => s.handle);
          console.log("Verified Active Scopes from Shopify:", activeScopes);
          
          if (!activeScopes.includes("write_themes")) {
              console.log("CRITICAL: Token missing write_themes despite session record. Forcing Re-Auth.");
              await prisma.session.deleteMany({ where: { shop } });
              return json({ reauth: true, error: "Critical: Missing write permissions. Reloading to fix..." }, { status: 401 });
          }
      } else {
          console.warn("Could not verify scopes from API:", await scopeResp.text());
      }

      const response = await fetch(url, {
          method: "PUT",
          headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json"
          },
          body: JSON.stringify({
              asset: {
                  key: sectionData.filename,
                  value: sectionData.content
              }
          })
      });

      if (!response.ok) {
           const text = await response.text();
           console.error(`Asset Update Failed (${response.status}): ${text}`);
           
           // If 404 or 403 or 401, it is likely a Permission/Scope issue or Auth issue
           if (response.status === 403 || response.status === 401) {
               console.log(`Triggering Re-Auth due to write failure (${response.status})...`);
               await prisma.session.deleteMany({ where: { shop } });
               return json({ reauth: true, error: "Permissions synchronization failed. Reloading..." }, { status: 401 });
           }

            // 404 on PUT usually means the theme ID is wrong OR the endpoint is wrong.
            if (response.status === 404) {
                 throw new Error(`Failed to inject section. REST 404 at ${url}. Response: ${text}. Check if Theme ID ${cleanThemeId} allows edits.`);
            }
            
            throw new Error(`Asset Update Failed (${response.status}): ${text}`);
      }

      // DIAGNOSTIC 4: VERIFY WRITE
      console.log("Verifying write via GET...");
      const verifyUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?asset[key]=${sectionData.filename}`;
      const verifyResp = await fetch(verifyUrl, {
           headers: { "X-Shopify-Access-Token": accessToken }
      });
      
      if (!verifyResp.ok) {
           console.error("Write verification failed. File not found immediately after write.");
           throw new Error(`Section injection verification failed. The file was sent but could not be read back from Theme ID ${cleanThemeId}. (Status: ${verifyResp.status})`);
      }
      
      // Mark as installed via Metafield (Success Case)
      await markSectionInstalled(shop, accessToken, apiVersion, sectionId);

      return json({ 
          success: true, 
          message: `Section added to ${themeId} via REST (2024-04)`,
          method: "rest"
      });

    } else if (action === "deactivate") {
      // Remove the Liquid file from the theme
      const shop = session.shop;
      const accessToken = session.accessToken;
      const apiVersion = "2024-04"; // Sync with activate action
      // Ensure strictly numeric ID
      const cleanThemeId = String(themeId).replace(/\D/g, "");
      const url = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?asset[key]=${sectionData.filename}`;

      const response = await fetch(url, {
          method: "DELETE",
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
          const text = await response.text();
          // If 404 on delete, it's already gone, consider success
          if (response.status === 404) {
             return json({ success: true, message: "Section already removed" });
          }
          throw new Error(`Shopify API ${response.status}: ${text}`);
      }

      return json({ success: true, message: "Section removed successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Asset API Error:", error);
    
    let msg = "Unknown error";
    let details = "";

    // Check if error is a Response object (common in fetch/shopify-api)
    if (error && typeof error.text === 'function') {
        try {
            const text = await error.text();
            msg = `API Error ${error.status || ''}: ${text}`;
            try {
                const jsonErr = JSON.parse(text);
                if (jsonErr.errors) {
                    msg = `Shopify API Error: ${JSON.stringify(jsonErr.errors)}`;
                }
            } catch (e) {
                // Not JSON
            }
        } catch (e) {
            msg = "Failed to read error response body";
        }
    } else if (error instanceof Error) {
        msg = error.message;
        details = error.stack;
    } else if (typeof error === 'string') {
        msg = error;
    } else {
        try {
            msg = JSON.stringify(error);
        } catch (e) {
            msg = "Circular error object";
        }
    }
    
    return json({ 
        error: `Failed to update theme asset: ${msg}`,
        details: details || msg
    }, { status: 500 });
  }
};
