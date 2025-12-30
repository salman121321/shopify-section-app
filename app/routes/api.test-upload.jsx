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

  const shop = session.shop;
  const accessToken = session.accessToken;
  const apiVersion = "2024-04";

  // Test 1: Direct REST API - Fetch Theme
  try {
    console.log("\n--- Test 1: Fetch Theme (Direct REST) ---");
    const url = `https://${shop}/admin/api/${apiVersion}/themes/${themeId}.json`;
    console.log("URL:", url);

    const response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken }
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("❌ Test 1 Failed!");
      return json({
        success: false,
        message: "Theme fetch failed",
        status: response.status,
        details: data
      }, { status: 500 });
    }
  } catch (e) {
    console.error("❌ Test 1 Exception:", e.message);
    return json({ success: false, message: `Test 1 failed: ${e.message}` }, { status: 500 });
  }

  // Test 2: Direct REST API - Read Asset
  try {
    console.log("\n--- Test 2: Read Asset (Direct REST) ---");
    const url = `https://${shop}/admin/api/${apiVersion}/themes/${themeId}/assets.json?asset[key]=layout/theme.liquid`;
    console.log("URL:", url);

    const response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": accessToken }
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("❌ Test 2 Failed!");
      return json({
        success: false,
        message: "Asset read failed",
        status: response.status,
        details: data
      }, { status: 500 });
    }
  } catch (e) {
    console.error("❌ Test 2 Exception:", e.message);
    return json({ success: false, message: `Test 2 failed: ${e.message}` }, { status: 500 });
  }

  // Test 3: Direct REST API - Upload Asset
  try {
    console.log("\n--- Test 3: Upload Asset (Direct REST) ---");

    const testContent = `{% schema %}
{
  "name": "Test Section",
  "settings": []
}
{% endschema %}
<div>Test from Shopi Section</div>`;

    const url = `https://${shop}/admin/api/${apiVersion}/themes/${themeId}/assets.json`;
    console.log("URL:", url);
    console.log("Uploading to:", "sections/shopi-test.liquid");

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        asset: {
          key: "sections/shopi-test.liquid",
          value: testContent
        }
      })
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("✅ All Tests Passed!");
      return json({
        success: true,
        message: "All tests passed! Upload works!",
        details: data
      });
    } else {
      console.error("❌ Test 3 Failed!");
      return json({
        success: false,
        message: "Upload failed",
        status: response.status,
        details: data
      }, { status: 500 });
    }

  } catch (e) {
    console.error("❌ Test 3 Exception:", e.message);
    console.error("Stack:", e.stack);
    return json({
      success: false,
      message: `Upload failed: ${e.message}`,
      error: String(e)
    }, { status: 500 });
  }
};
