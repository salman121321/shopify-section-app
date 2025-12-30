import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  console.log("\n=== TEST UPLOAD ENDPOINT (V3_FORCED_UPDATE) ===");
  console.log("Shop:", session.shop);
  console.log("Access Token:", session.accessToken?.substring(0, 10) + "...");
  console.log("Scopes:", session.scope);

  const formData = await request.formData();
  const themeId = formData.get("themeId");

  console.log("Theme ID:", themeId);

  const shop = session.shop;
  const accessToken = session.accessToken;
  const apiVersion = "2024-10";

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

  // Test 3: GraphQL Upload (Correct method for OS 2.0)
  try {
    console.log("\n--- Test 3: GraphQL Upload (OS 2.0 Method) ---");

    const testContent = `{% schema %}
{
  "name": "Test Section",
  "settings": []
}
{% endschema %}
<div>✅ Test from Shopi Section - Uploaded via GraphQL!</div>`;

    // Explicitly defining query to avoid requesting unsupported fields like 'size'
    const graphqlQuery = `
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          userErrors {
            filename
            code
            message
          }
        }
      }
    `;

    const cleanThemeId = String(themeId).replace(/\D/g, "");
    const themeGid = `gid://shopify/Theme/${cleanThemeId}`;

    const variables = {
      themeId: themeGid,
      files: [{
        filename: "sections/shopi-test.liquid",
        body: {
          type: "TEXT",
          value: testContent
        }
      }]
    };

    console.log("Theme GID:", themeGid);
    console.log("Using GraphQL mutation via direct fetch");

    const graphqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: variables
      })
    });
    
    console.log("Test 3 Status:", response.status);
    
    if (!response.ok) {
       console.error("❌ Test 3 Fetch Failed with status:", response.status);
       const text = await response.text();
       console.error("Response body:", text);
       results.test3 = {
         method: "graphql",
         success: false,
         status: response.status,
         error: `Fetch failed: ${response.status} ${response.statusText}`,
         body: text
       };
       results.summary = `Test 3 failed: Fetch error ${response.status}`;
       return json({ success: false, message: `Test 3 Fetch Failed: ${response.status}`, results }, { status: 500 });
    }

    const data = await response.json();
    
    // Log the full response for debugging
    console.log("Full GraphQL Response:", JSON.stringify(data, null, 2));

    results.test3 = {
      method: "graphql",
      themeGid: themeGid,
      filename: "sections/shopi-test.liquid",
      response: data
    };

    if (data.data?.themeFilesUpsert?.upsertedThemeFiles?.length > 0) {
      console.log("✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅");
      console.log("Uploaded via GraphQL:", data.data.themeFilesUpsert.upsertedThemeFiles[0]);

      results.test3.success = true;
      results.summary = "✅ ALL TESTS PASSED! Theme accessible and GraphQL upload works!";

      return json({
        success: true,
        message: "✅ All tests passed! GraphQL upload successful!",
        results: results
      });
    } else if (data.data?.themeFilesUpsert?.userErrors?.length > 0) {
      const errors = data.data.themeFilesUpsert.userErrors;
      console.error("❌ GraphQL User Errors:", errors);

      results.test3.success = false;
      results.test3.errors = errors;
      results.summary = `❌ Test 3 failed: ${errors.map(e => `${e.code}: ${e.message}`).join("; ")}`;

      return json({
        success: false,
        message: `GraphQL upload failed: ${errors[0].message}`,
        results: results
      }, { status: 500 });
    } else {
      console.error("❌ Unexpected GraphQL response", data);
      results.test3.success = false;
      results.test3.error = "Unexpected GraphQL response structure";
      results.test3.fullResponse = data; // Return full data to client for inspection
      results.summary = "Unexpected GraphQL response (Check console/results)";
      
      return json({
        success: false,
        message: "Unexpected GraphQL response",
        results: results
      }, { status: 500 });
    }
      results.summary = "❌ Unexpected GraphQL response";

      return json({
        success: false,
        message: "Unexpected GraphQL response",
        results: results
      }, { status: 500 });
    }

  } catch (e) {
    console.error("❌ Test 3 Exception:", e.message);
    console.error("Stack:", e.stack);
    results.test3 = { error: e.message, stack: e.stack };
    results.summary = `Test 3 crashed: ${e.message}`;
    return json({
      success: false,
      message: `Test 3 crashed: ${e.message}`,
      results: results
    }, { status: 500 });
  }
};
