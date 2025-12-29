import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import fs from "fs";
import path from "path";

// Map section IDs to their local file paths
const SECTION_FILES = {
  "my-custom-section": "extensions/my-first-section/blocks/my-section.liquid",
  "3d-carousel-pro": "extensions/my-first-section/blocks/3d-carousel.liquid"
};

// Helper to read file content
const getSectionCode = (sectionId) => {
  const relativePath = SECTION_FILES[sectionId];
  if (!relativePath) return null;
  
  const filePath = path.join(process.cwd(), relativePath);
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.error("Error reading file:", e);
    return null;
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const actionType = formData.get("actionType"); // "enable" or "disable"
  const themeId = formData.get("themeId");
  const sectionId = formData.get("sectionId");

  if (!themeId || !sectionId) {
    return json({ error: "Missing themeId or sectionId" }, { status: 400 });
  }

  const assetKey = `sections/${sectionId}.liquid`;

  if (actionType === "enable") {
    // 1. Read Code
    let code = getSectionCode(sectionId);
    if (!code) {
      return json({ error: "Section code not found" }, { status: 404 });
    }
    
    // NOTE: Ensure schema has presets so it appears in Theme Editor "Add Section" list
    // This satisfies the requirement: "App ke neeche app ke saare active sections show hon" (Visibility)
    try {
      const schemaMatch = code.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
      if (schemaMatch) {
        const schemaContent = schemaMatch[1];
        const schemaJson = JSON.parse(schemaContent);
        
        if (!schemaJson.presets) {
          // Inject presets if missing
          schemaJson.presets = [
            {
              name: schemaJson.name || sectionId,
              settings: {}
            }
          ];
          
          const newSchemaContent = JSON.stringify(schemaJson, null, 2);
          code = code.replace(schemaMatch[1], newSchemaContent);
        }
      }
    } catch (e) {
      console.error("Error processing schema presets:", e);
      // Proceed with original code if parsing fails
    }
    
    // 2. Upload Asset
    const assetResponse = await admin.rest.resources.Asset.save({
      session: admin.session,
      theme_id: themeId,
      asset: {
        key: assetKey,
        value: code
      }
    });

    // 3. Add to index.json (Auto-activate)
    try {
      // Fetch index.json
      const indexAsset = await admin.rest.resources.Asset.all({
        session: admin.session,
        theme_id: themeId,
        asset: { key: "templates/index.json" }
      });
      
      if (indexAsset && indexAsset.data && indexAsset.data.length > 0) {
        const indexJson = JSON.parse(indexAsset.data[0].value);
        
        // Check if already exists
        let instanceId = `${sectionId}-auto`;
        
        // If not present in sections, add it
        if (!indexJson.sections[instanceId]) {
          indexJson.sections[instanceId] = {
            type: sectionId, // The filename without extension acts as type
            settings: {} // Default settings
          };
          
          // Add to order if not present
          if (!indexJson.order.includes(instanceId)) {
            indexJson.order.unshift(instanceId); // Add to top
          }
          
          // Save updated index.json
          await admin.rest.resources.Asset.save({
            session: admin.session,
            theme_id: themeId,
            asset: {
              key: "templates/index.json",
              value: JSON.stringify(indexJson, null, 2)
            }
          });
        }
      }
    } catch (err) {
      console.error("Error updating index.json:", err);
      // We don't fail the whole request if auto-activation fails, 
      // as the section is still installed.
    }

    return json({ success: true, message: "Section enabled and activated" });

  } else if (actionType === "disable") {
    // 1. Delete Asset
    await admin.rest.resources.Asset.delete({
      session: admin.session,
      theme_id: themeId,
      asset: { key: assetKey }
    });

    // 2. Cleanup index.json (Optional but recommended)
    try {
       const indexAsset = await admin.rest.resources.Asset.all({
        session: admin.session,
        theme_id: themeId,
        asset: { key: "templates/index.json" }
      });
      
      if (indexAsset && indexAsset.data && indexAsset.data.length > 0) {
        const indexJson = JSON.parse(indexAsset.data[0].value);
        let modified = false;
        
        // Find instances of this type
        const instancesToRemove = [];
        Object.keys(indexJson.sections).forEach(key => {
          if (indexJson.sections[key].type === sectionId) {
            instancesToRemove.push(key);
          }
        });

        if (instancesToRemove.length > 0) {
          // Remove from sections
          instancesToRemove.forEach(key => {
            delete indexJson.sections[key];
          });
          // Remove from order
          indexJson.order = indexJson.order.filter(key => !instancesToRemove.includes(key));
          
          // Save
          await admin.rest.resources.Asset.save({
            session: admin.session,
            theme_id: themeId,
            asset: {
              key: "templates/index.json",
              value: JSON.stringify(indexJson, null, 2)
            }
          });
        }
      }
    } catch (err) {
      console.error("Error cleaning index.json:", err);
    }

    return json({ success: true, message: "Section disabled and removed" });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};
