import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  console.log("\n=== TEST UPLOAD ENDPOINT ===");
  console.log("Shop:", session.shop);
  console.log("Access Token:", session.accessToken?.substring(0, 10) + "...");
  console.log("Scopes:", session.scope);

  const formData = await request.formData();
  const themeId = formData.get("themeId");

  console.log("Theme ID:", themeId);

  // Test 1: Can we fetch the theme?
  try {
    console.log("\n--- Test 1: Fetching Theme Info ---");
    const themeResponse = await admin.rest.get({
      path: `themes/${themeId}`,
    });
    console.log("Theme fetch status:", themeResponse.status);
    console.log("Theme data:", JSON.stringify(themeResponse.body, null, 2));
  } catch (e) {
    console.error("Failed to fetch theme:", e.message);
  }

  // Test 2: Can we list assets?
  try {
    console.log("\n--- Test 2: Listing Assets ---");
    const assetsResponse = await admin.rest.get({
      path: `themes/${themeId}/assets`,
      query: { "asset[key]": "layout/theme.liquid" }
    });
    console.log("Assets fetch status:", assetsResponse.status);
    console.log("Asset data:", JSON.stringify(assetsResponse.body, null, 2));
  } catch (e) {
    console.error("Failed to fetch assets:", e.message);
  }

  // Test 3: Try uploading a simple asset
  try {
    console.log("\n--- Test 3: Uploading Test Asset ---");

    const testContent = `{%- comment -%} Test section from Shopi Section App {%- endcomment -%}
{% schema %}
{
  "name": "Test Section",
  "settings": []
}
{% endschema %}
<div>Test</div>`;

    const uploadResponse = await admin.rest.put({
      path: `themes/${themeId}/assets`,
      data: {
        asset: {
          key: "sections/test-section.liquid",
          value: testContent
        }
      }
    });

    console.log("Upload status:", uploadResponse.status);
    console.log("Upload response:", JSON.stringify(uploadResponse.body, null, 2));

    if (uploadResponse.status === 200) {
      return json({
        success: true,
        message: "Test upload successful!",
        details: uploadResponse.body
      });
    } else {
      return json({
        success: false,
        message: "Upload failed",
        status: uploadResponse.status,
        details: uploadResponse.body
      }, { status: 500 });
    }

  } catch (e) {
    console.error("Upload failed:", e.message);
    console.error("Error details:", e);

    return json({
      success: false,
      message: e.message,
      error: String(e)
    }, { status: 500 });
  }
};
