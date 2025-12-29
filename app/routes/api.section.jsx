import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
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
  const sectionId = formData.get("sectionId");

  if (!themeId || !sectionId) {
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
      // Reverting to Asset resource but ensuring session is passed correctly
      const asset = new admin.rest.resources.Asset({session: session});
      asset.theme_id = Number(themeId);
      asset.key = sectionData.filename;
      asset.value = sectionData.content;
      await asset.save({
        update: true,
      });
      
      return json({ success: true, message: "Section installed successfully" });

    } else if (action === "deactivate") {
      // Remove the Liquid file from the theme
      const asset = new admin.rest.resources.Asset({session: session});
      asset.theme_id = Number(themeId);
      asset.key = sectionData.filename;
      await asset.delete();

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
