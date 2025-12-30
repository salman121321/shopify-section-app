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
          "presets": [{ "name": "My Custom Section" }]
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
      // Try 2025-01 as a safe stable version
      const apiVersion = "2025-01"; 
      const cleanThemeId = String(themeId).trim();

      console.log(`Debug: Shop=${shop}, ThemeID=${cleanThemeId}, TokenLength=${accessToken?.length}`);

      // DIAGNOSTIC 1: Check if Theme Exists via REST
      const themeUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}.json`;
      
      const themeResp = await fetch(themeUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });

      if (!themeResp.ok) {
          const text = await themeResp.text();
          throw new Error(`Theme Check Failed (${themeResp.status}): ${text} | URL: ${themeUrl}`);
      }
      console.log("Diagnostic 1 Success: Theme exists.");

      // DIAGNOSTIC 2: Check Asset Access (GET)
      const assetCheckUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?fields=key&limit=1`;
      const assetCheckResp = await fetch(assetCheckUrl, {
           headers: { "X-Shopify-Access-Token": accessToken }
      });
      if (!assetCheckResp.ok) {
           const text = await assetCheckResp.text();
           // If this fails, then we can't write either
           throw new Error(`Asset Access Failed (${assetCheckResp.status}): ${text} | URL: ${assetCheckUrl}`);
      }
      console.log("Diagnostic 2 Success: Can list assets.");

      // REAL UPDATE: Use REST API (GraphQL requires exemption)
      console.log("Attempting REST Asset Update via Library...");
      
      try {
          const Asset = admin.rest.resources.Asset;
          const asset = new Asset({ session: session });
          asset.theme_id = Number(cleanThemeId);
          asset.key = sectionData.filename;
          asset.value = sectionData.content;
          
          // Use update: true to force a PUT
          await asset.save({
              update: true,
          });
          console.log("Library Asset Update Success");
      } catch (libError) {
          console.error("Library Asset Update Failed:", libError);
          console.log("Falling back to direct Fetch for REST...");

          // Fallback: Direct Fetch
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
              throw new Error(`REST Fallback Failed (${response.status}): ${text}`);
          }
      }

      return json({ 
          success: true, 
          message: `Section added to ${themeId} via REST`,
          method: "rest"
      });

      const data = await response.json();
      console.log("Direct Fetch Success:", data);
      
      return json({ success: true, message: "Section installed successfully" });

    } else if (action === "deactivate") {
      // Remove the Liquid file from the theme
      const shop = session.shop;
      const accessToken = session.accessToken;
      const apiVersion = "2024-10";
      const cleanThemeId = String(themeId).trim();
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
