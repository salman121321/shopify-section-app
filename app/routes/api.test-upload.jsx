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

  const results = {
    test1: null,
    test2: null,
    test3: null,
    summary: ""
  };

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

    results.test1 = {
      status: response.status,
      success: response.ok,
      url: url,
      response: data
    };

    if (!response.ok) {
      console.error("❌ Test 1 Failed!");
      results.summary = "Test 1 (Fetch Theme) failed - Theme not found or not accessible";
      return json({
        success: false,
        message: "Test 1 Failed: Theme not accessible",
        results: results
      }, { status: 500 });
    }
    console.log("✅ Test 1 Passed!");
  } catch (e) {
    console.error("❌ Test 1 Exception:", e.message);
    results.test1 = { error: e.message };
    results.summary = "Test 1 crashed";
    return json({ success: false, message: `Test 1 failed: ${e.message}`, results }, { status: 500 });
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

    results.test2 = {
      status: response.status,
      success: response.ok,
      url: url,
      response: data
    };

    if (!response.ok) {
      console.error("❌ Test 2 Failed!");
      results.summary = "Test 2 (Read Asset) failed - Cannot read theme assets";
      return json({
        success: false,
        message: "Test 2 Failed: Cannot read theme assets",
        results: results
      }, { status: 500 });
    }
    console.log("✅ Test 2 Passed!");
  } catch (e) {
    console.error("❌ Test 2 Exception:", e.message);
    results.test2 = { error: e.message };
    results.summary = "Test 2 crashed";
    return json({ success: false, message: `Test 2 failed: ${e.message}`, results }, { status: 500 });
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

    results.test3 = {
      status: response.status,
      success: response.ok,
      url: url,
      filename: "sections/shopi-test.liquid",
      response: data
    };

    if (response.ok) {
      console.log("✅ All Tests Passed!");
      results.summary = "✅ ALL TESTS PASSED! Theme is accessible and upload works!";
      return json({
        success: true,
        message: "✅ All tests passed! Upload works perfectly!",
        results: results
      });
    } else {
      console.error("❌ Test 3 Failed!");
      results.summary = `❌ Test 3 (Upload) failed - Status ${response.status}: ${data.errors || 'Unknown error'}`;
      return json({
        success: false,
        message: `Test 3 Failed: Upload returned ${response.status}`,
        results: results
      }, { status: 500 });
    }

  } catch (e) {
    console.error("❌ Test 3 Exception:", e.message);
    console.error("Stack:", e.stack);
    results.test3 = { error: e.message, stack: e.stack };
    results.summary = "Test 3 crashed with exception";
    return json({
      success: false,
      message: `Test 3 crashed: ${e.message}`,
      results: results
    }, { status: 500 });
  }
};
