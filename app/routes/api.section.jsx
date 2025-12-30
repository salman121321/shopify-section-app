import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { THREE_D_CAROUSEL_LIQUID } from "../templates/three-d-carousel";

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
        filename: "sections/3d-carousel-pro.liquid",
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
          "presets": [{ "name": "My Custom Section", "category": "Shopi Section" }]
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
      // Use 2024-10 (Latest Stable) to fix 404 on assets
      const apiVersion = "2024-10"; 
      const cleanThemeId = String(themeId).trim();

      console.log(`Debug: Shop=${shop}, ThemeID=${cleanThemeId}, TokenLength=${accessToken?.length}`);

      // DIAGNOSTIC 1: Check if Theme Exists via REST
      const themeUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}.json`;
      
      const themeResp = await fetch(themeUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });

      if (!themeResp.ok) {
          const text = await themeResp.text();
          // If theme check fails with 404, the theme ID is definitely wrong/gone
          if (themeResp.status === 404) {
               return json({ error: "Theme not found. It might have been deleted." }, { status: 404 });
          }
          // If 403/401, handle reauth
          if (themeResp.status === 403 || themeResp.status === 401) {
              console.log("Triggering Re-Auth due to Theme Check failure...");
              await prisma.session.deleteMany({ where: { shop } });
              return json({ reauth: true, error: "Permissions need update. Reloading..." }, { status: 401 });
          }
          throw new Error(`Theme Check Failed (${themeResp.status}): ${text} | URL: ${themeUrl}`);
      }
      console.log("Diagnostic 1 Success: Theme exists.");

      // DIAGNOSTIC 2: Check Asset Endpoint Reachability (List Assets)
      // This verifies if the assets endpoint is actually valid for this theme
      const assetsCheckUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?limit=1`;
      const assetsCheckResp = await fetch(assetsCheckUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });

      if (!assetsCheckResp.ok) {
          const text = await assetsCheckResp.text();
          console.warn(`Diagnostic 2 Failed: Assets endpoint returned ${assetsCheckResp.status}`);
          if (assetsCheckResp.status === 404) {
              return json({ error: "This theme does not support Asset API modifications (Assets endpoint 404). It might be a development or trial theme." }, { status: 404 });
          }
      } else {
          console.log("Diagnostic 2 Success: Assets endpoint is reachable.");
      }

      // DIAGNOSTIC 3: Verify Actual Scopes from Shopify
      // Sometimes the session has scopes but the token doesn't (stale token)
      const scopeUrl = `https://${shop}/admin/oauth/access_scopes.json`;
      const scopeResp = await fetch(scopeUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });
      
      if (scopeResp.ok) {
          const scopeData = await scopeResp.json();
          const activeScopes = scopeData.access_scopes.map(s => s.handle);
          console.log("Verified Active Scopes from Shopify:", activeScopes);
          
          if (!activeScopes.includes("write_themes")) {
              console.log("CRITICAL: Token missing write_themes despite session record. Forcing Re-Auth.");
              await prisma.session.deleteMany({ where: { shop } });
              return json({ reauth: true, error: "Critical: Missing write permissions. Reloading to fix..." }, { status: 401 });
          }
      } else {
          console.warn("Could not verify scopes from API:", await scopeResp.text());
      }

      // REAL UPDATE: Use REST API
      console.log("Attempting REST Asset Update...");
      const url = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json`;
      
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
               // We delete the session to force a fresh token exchange next time
               await prisma.session.deleteMany({ where: { shop } });
               return json({ reauth: true, error: "Permissions synchronization failed. Reloading..." }, { status: 401 });
           }

            // 404 on PUT usually means the theme ID is wrong OR the endpoint is wrong.
            // Since we verified the theme exists (Diag 1), it might be the API version or URL format.
            // But for now, if it's 404, we return error instead of re-auth loops, as we verified scopes.
           if (response.status === 404) {
               return json({ error: `Shopify API returned 404 Not Found for Asset PUT. URL: ${url}. Response: ${text}` }, { status: 404 });
           }

           throw new Error(`Failed to save section: ${response.status} ${text}`);
      }

      // 2. AUTO-ADD TO HOME PAGE (INDEX.JSON)
      // Only for Online Store 2.0 Themes (which use templates/index.json)
      console.log("Attempting to add section to Home Page (templates/index.json)...");
      try {
        const indexUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?asset[key]=templates/index.json`;
        const indexResp = await fetch(indexUrl, {
            headers: { "X-Shopify-Access-Token": accessToken }
        });

        if (indexResp.ok) {
            const indexData = await indexResp.json();
            const indexJson = JSON.parse(indexData.asset.value);
            
            // Generate unique ID for the new section instance
            const newSectionInstanceId = `${sectionId.replace(/-/g, "_")}_${Date.now()}`;
            
            // Add section definition
            // Note: 'type' refers to the filename without extension and 'sections/' prefix
            const sectionType = sectionData.filename.replace("sections/", "").replace(".liquid", "");
            
            if (!indexJson.sections) indexJson.sections = {};
            indexJson.sections[newSectionInstanceId] = {
                type: sectionType,
                settings: {}
            };
            
            // Add to order (append to the end of the page)
            if (!indexJson.order) indexJson.order = [];
            indexJson.order.push(newSectionInstanceId);
            
            console.log(`Adding section instance ${newSectionInstanceId} of type ${sectionType} to index.json`);

            // Save back to Shopify
            const updateIndexResp = await fetch(`https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json`, {
                method: "PUT",
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    asset: {
                        key: "templates/index.json",
                        value: JSON.stringify(indexJson)
                    }
                })
            });

            if (updateIndexResp.ok) {
                console.log("Successfully added section to Home Page.");
            } else {
                console.warn("Failed to update index.json:", await updateIndexResp.text());
                // We don't fail the whole request if this fails, as the section is technically installed
            }
        } else {
             console.log("templates/index.json not found (likely vintage theme). Skipping auto-add.");
        }
      } catch (err) {
          console.error("Error during auto-add to index.json:", err);
          // Non-critical error
      }

      return json({ success: true, message: "Section activated and added to Home Page successfully!" });
    }
  } catch (error) {
    console.error("Error activating section:", error);
    return json({ error: error.message || "Failed to activate section" }, { status: 500 });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};
