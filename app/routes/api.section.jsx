import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { THREE_D_CAROUSEL_LIQUID } from "../templates/three-d-carousel";

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
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
      // 1. Upload the Liquid file to the theme using direct REST client
      // Using admin.rest.put is more reliable than the Asset resource class for some versions
      const response = await admin.rest.put({
        path: `themes/${themeId}/assets.json`,
        data: {
          asset: {
            key: sectionData.filename,
            value: sectionData.content
          }
        }
      });
      
      if (response.status >= 400) {
         throw new Error(`Shopify API returned status ${response.status}`);
      }
      
      return json({ success: true, message: "Section installed successfully" });

    } else if (action === "deactivate") {
      // Remove the Liquid file from the theme using direct REST client
      const response = await admin.rest.delete({
        path: `themes/${themeId}/assets.json`,
        query: {
            "asset[key]": sectionData.filename
        }
      });

      if (response.status >= 400) {
         throw new Error(`Shopify API returned status ${response.status}`);
      }

      return json({ success: true, message: "Section removed successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Asset API Error:", error);
    // Extract detailed error if available
    let errorMessage = error.message;
    if (error.response) {
        // If it's a response object (e.g. from node-fetch/undici), try to read body or status
        errorMessage = `API Error ${error.response.status}: ${error.response.statusText}`;
    }
    
    return json({ 
        error: `Failed to update theme asset: ${errorMessage}`,
        details: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }, { status: 500 });
  }
};
