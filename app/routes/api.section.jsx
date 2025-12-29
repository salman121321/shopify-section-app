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
      // 1. Upload the Liquid file to the theme
      // Reverting to Asset resource but ensuring session is passed correctly
      const asset = new admin.rest.resources.Asset({session: session});
      asset.theme_id = themeId;
      asset.key = sectionData.filename;
      asset.value = sectionData.content;
      await asset.save({
        update: true,
      });
      
      return json({ success: true, message: "Section installed successfully" });

    } else if (action === "deactivate") {
      // Remove the Liquid file from the theme
      const asset = new admin.rest.resources.Asset({session: session});
      asset.theme_id = themeId;
      asset.key = sectionData.filename;
      await asset.delete();

      return json({ success: true, message: "Section removed successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Asset API Error:", error);
    // Robust error message extraction
    let msg = "Unknown error";
    if (error instanceof Error) {
        msg = error.message;
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
        details: msg
    }, { status: 500 });
  }
};
