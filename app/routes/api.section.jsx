import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { THREE_D_CAROUSEL_LIQUID } from "../templates/three-d-carousel";

// Helper to mark section as installed in Shop Metafields
// We use a Shop Metafield to store the list of installed sections per theme or globally.
// Ideally, we attach this to the Theme, but Shop is easier to access consistently.
// We will store: namespace: "shopi_installed", key: "sections", value: JSON array of section IDs
async function markSectionInstalled(shop, accessToken, apiVersion, sectionId) {
    try {
        // 1. Fetch current installed sections
        const getQuery = `
          query {
            currentAppInstallation {
              id
              metafield(namespace: "shopi_section", key: "installed_sections") {
                value
                id
              }
            }
          }
        `;
        
        const gqlUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
        const getResp = await fetch(gqlUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
            body: JSON.stringify({ query: getQuery })
        });
        
        const getData = await getResp.json();
        const appInstallation = getData.data?.currentAppInstallation;
        if (!appInstallation) {
            console.error("Failed to get AppInstallation for Metafield update");
            throw new Error("Failed to get AppInstallation for Metafield update (Permissions?)");
        }

        let installedSections = [];
        if (appInstallation.metafield?.value) {
            try {
                installedSections = JSON.parse(appInstallation.metafield.value);
            } catch (e) {
                console.warn("Failed to parse existing metafield value:", e);
            }
        }

        if (!installedSections.includes(sectionId)) {
            installedSections.push(sectionId);
            
            // 2. Update Metafield
            const updateQuery = `
              mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                  metafields {
                    key
                    value
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
            
            const updateResp = await fetch(gqlUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
                body: JSON.stringify({
                    query: updateQuery,
                    variables: {
                        metafields: [{
                            ownerId: appInstallation.id,
                            namespace: "shopi_section",
                            key: "installed_sections",
                            type: "json",
                            value: JSON.stringify(installedSections)
                        }]
                    }
                })
            });
            
            const updateData = await updateResp.json();
            console.log("Metafield Update Result:", JSON.stringify(updateData));
            
            const userErrors = updateData.data?.metafieldsSet?.userErrors;
            if (userErrors && userErrors.length > 0) {
                 throw new Error(`Metafield Update Failed: ${JSON.stringify(userErrors)}`);
            }
        } else {
            console.log("Section already in metafield list.");
        }

    } catch (err) {
        console.error("Failed to update installed section metafield:", err);
        throw err;
    }
}

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
        filename: "sections/shopi-3d-carousel-pro.liquid",
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
          "presets": [{ 
              "name": "My Custom Section",
              "category": "Shopi Section"
          }]
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
      // Use 2024-04 for REST (LTS - Most Stable)
      const apiVersion = "2024-04"; 
      // Ensure strictly numeric ID
      const cleanThemeId = String(themeId).replace(/\D/g, "");

      console.log(`Debug: Shop=${shop}, ThemeID=${cleanThemeId}, TokenLength=${accessToken?.length}`);

      // DIAGNOSTIC 1: Check if Theme Exists via REST
      const themeUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}.json`;
      
      const themeResp = await fetch(themeUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });

      if (!themeResp.ok) {
          // ... (Existing error handling)
          const text = await themeResp.text();
          if (themeResp.status === 404) {
               return json({ error: `Theme not found (ID: ${cleanThemeId}). It might have been deleted.` }, { status: 404 });
          }
          if (themeResp.status === 403 || themeResp.status === 401) {
              await prisma.session.deleteMany({ where: { shop } });
              return json({ reauth: true, error: "Permissions need update. Reloading..." }, { status: 401 });
          }
          throw new Error(`Theme Check Failed (${themeResp.status}): ${text}`);
      }
      console.log("Diagnostic 1 Success: Theme exists.");

      // DIAGNOSTIC 2: Check Asset Access (Read layout/theme.liquid)
      // This confirms we have 'read_themes' AND access to this specific theme's assets
      const assetCheckUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?asset[key]=layout/theme.liquid`;
      const assetCheckResp = await fetch(assetCheckUrl, {
          headers: { "X-Shopify-Access-Token": accessToken }
      });

      if (!assetCheckResp.ok) {
           const text = await assetCheckResp.text();
           console.error(`Diagnostic 2 Failed: Cannot read assets. Status: ${assetCheckResp.status}`);
           console.error(`Response: ${text}`);

           if (assetCheckResp.status === 404) {
                // Theme might be using Online Store 2.0 - try GraphQL instead
                console.log("REST Asset read failed, theme might be OS 2.0. Continuing with GraphQL...");
           }
      } else {
           console.log("Diagnostic 2 Success: Can read theme assets.");
           const assetData = await assetCheckResp.json();
           console.log("Asset read successful, theme is accessible");
      }

      // DIAGNOSTIC 3: Verify scopes using GraphQL
      console.log("Verifying app has correct scopes...");
      const scopeCheckQuery = `
        query {
          currentAppInstallation {
            accessScopes {
              handle
            }
          }
        }
      `;

      const scopeCheckUrl = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
      const scopeCheckResp = await fetch(scopeCheckUrl, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken
          },
          body: JSON.stringify({ query: scopeCheckQuery })
      });

      if (scopeCheckResp.ok) {
          const scopeData = await scopeCheckResp.json();
          const scopes = scopeData.data?.currentAppInstallation?.accessScopes?.map(s => s.handle) || [];
          console.log("Current App Scopes:", scopes.join(", "));

          if (!scopes.includes("write_themes")) {
              return json({
                  error: "App does not have write_themes permission. Please reinstall the app.",
                  reauth: true
              }, { status: 403 });
          }
      }

      // PRIMARY METHOD: Use GraphQL (More Reliable than REST for theme assets)
      console.log("=== ATTEMPTING GRAPHQL UPLOAD (PRIMARY METHOD) ===");
      console.log(`Theme GID: gid://shopify/Theme/${cleanThemeId}`);
      console.log(`Filename: ${sectionData.filename}`);
      console.log(`Content Length: ${sectionData.content.length} characters`);

      let successResponse = null;
      let uploadMethod = null;
      let graphqlAttempted = false;

      try {
          const gqlMutation = `
            mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
              themeFilesUpsert(themeId: $themeId, files: $files) {
                upsertedThemeFiles {
                  filename
                  size
                  contentType
                }
                userErrors {
                  filename
                  code
                  message
                  field
                }
              }
            }
          `;

          const variables = {
              themeId: `gid://shopify/Theme/${cleanThemeId}`,
              files: [{
                  filename: sectionData.filename,
                  body: {
                      type: "TEXT",
                      value: sectionData.content
                  }
              }]
          };

          console.log("GraphQL Variables:", JSON.stringify(variables, null, 2).substring(0, 500) + "...");

          const gqlUrl = `https://${shop}/admin/api/2024-10/graphql.json`;
          const gqlResponse = await fetch(gqlUrl, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  "X-Shopify-Access-Token": accessToken
              },
              body: JSON.stringify({
                  query: gqlMutation,
                  variables: variables
              })
          });

          graphqlAttempted = true;
          console.log(`GraphQL Response Status: ${gqlResponse.status}`);

          if (gqlResponse.ok) {
              const gqlData = await gqlResponse.json();
              console.log("GraphQL Full Response:", JSON.stringify(gqlData, null, 2));

              if (gqlData.errors) {
                  console.error("❌ GraphQL Errors:", gqlData.errors);
                  throw new Error(`GraphQL Errors: ${gqlData.errors.map(e => e.message).join(", ")}`);
              }

              const upserted = gqlData.data?.themeFilesUpsert?.upsertedThemeFiles;
              const userErrors = gqlData.data?.themeFilesUpsert?.userErrors;

              if (userErrors && userErrors.length > 0) {
                  console.error("❌ GraphQL User Errors:", userErrors);
                  throw new Error(`GraphQL User Errors: ${userErrors.map(e => `${e.code}: ${e.message}`).join(", ")}`);
              }

              if (upserted && upserted.length > 0) {
                  console.log("✅ GraphQL Upload Success!");
                  console.log("Uploaded File:", upserted[0]);
                  successResponse = gqlResponse;
                  uploadMethod = "graphql";
              } else {
                  console.warn("⚠️ GraphQL returned no upserted files and no errors:", gqlData);
                  throw new Error("GraphQL returned empty response");
              }
          } else {
              const text = await gqlResponse.text();
              console.error(`❌ GraphQL HTTP Error: ${gqlResponse.status}`);
              console.error(`Response Body: ${text}`);

              if (gqlResponse.status === 401 || gqlResponse.status === 403) {
                  await prisma.session.deleteMany({ where: { shop } });
                  return json({ reauth: true, error: "Authentication failed. Please reload the page." }, { status: 401 });
              }

              throw new Error(`GraphQL HTTP ${gqlResponse.status}: ${text}`);
          }
      } catch (gqlError) {
          console.error("❌ GraphQL Upload Failed:", gqlError.message);
          console.error("GraphQL Error Stack:", gqlError.stack);
      }

      // FALLBACK METHOD 1: REST API with Multiple Versions
      if (!successResponse) {
          console.log("=== ATTEMPTING REST API FALLBACK ===");

          const versionsToTry = ["2024-10", "2024-07", "2024-04"];
          let lastError = null;
          let lastStatus = 0;

          for (const v of versionsToTry) {
              console.log(`\n--- Trying REST PUT with API Version: ${v} ---`);
              const tryUrl = `https://${shop}/admin/api/${v}/themes/${cleanThemeId}/assets.json`;
              console.log(`URL: ${tryUrl}`);

              try {
                  const payload = {
                      asset: {
                          key: sectionData.filename,
                          value: sectionData.content
                      }
                  };

                  console.log(`Payload: { asset: { key: "${sectionData.filename}", value: "${sectionData.content.substring(0, 50)}..." } }`);

                  const response = await fetch(tryUrl, {
                      method: "PUT",
                      headers: {
                          "X-Shopify-Access-Token": accessToken,
                          "Content-Type": "application/json"
                      },
                      body: JSON.stringify(payload)
                  });

                  console.log(`Response Status: ${response.status}`);

                  if (response.ok) {
                      const responseData = await response.json();
                      console.log(`✅ REST Success with API Version ${v}`);
                      console.log("Response Data:", responseData);
                      successResponse = response;
                      uploadMethod = `rest-${v}`;
                      break;
                  } else {
                      lastStatus = response.status;
                      const text = await response.text();
                      lastError = `Version ${v} Failed (${response.status}): ${text}`;
                      console.error(`❌ ${lastError}`);

                      if (response.status === 401 || response.status === 403) {
                          await prisma.session.deleteMany({ where: { shop } });
                          return json({ reauth: true, error: "Authentication failed. Please reload the page." }, { status: 401 });
                      }
                  }
              } catch (e) {
                  console.error(`❌ Exception with Version ${v}:`, e);
                  lastError = e.message;
              }
          }

          // FALLBACK METHOD 2: Try simplified filename
          if (!successResponse && lastStatus === 404) {
              console.log("Trying simplified filename without 'shopi-' prefix...");

              const simplifiedFilename = sectionData.filename.replace('shopi-', '');
              const tryUrl = `https://${shop}/admin/api/2024-10/themes/${cleanThemeId}/assets.json`;

              try {
                  const response = await fetch(tryUrl, {
                      method: "PUT",
                      headers: {
                          "X-Shopify-Access-Token": accessToken,
                          "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                          asset: {
                              key: simplifiedFilename,
                              value: sectionData.content
                          }
                      })
                  });

                  if (response.ok) {
                      console.log("✓ Simplified filename worked!");
                      successResponse = response;
                      uploadMethod = "rest-simplified";
                      sectionData.filename = simplifiedFilename; // Update for verification
                  }
              } catch (e) {
                  console.error("Simplified filename attempt failed:", e);
              }
          }

          // Final error if all methods failed
          if (!successResponse) {
              console.error("=== ALL UPLOAD METHODS FAILED ===");
              console.error(`GraphQL Attempted: ${graphqlAttempted}`);
              console.error(`Last REST Error: ${lastError}`);
              console.error(`Last Status Code: ${lastStatus}`);

              let helpfulMessage = "Failed to upload section to theme. ";

              if (lastStatus === 404) {
                  helpfulMessage += "\n\n🔍 Troubleshooting Steps:\n";
                  helpfulMessage += "1. This theme might be a protected/locked theme (e.g., Shopify's default themes)\n";
                  helpfulMessage += "2. Try creating a duplicate of this theme first:\n";
                  helpfulMessage += "   - Go to Online Store > Themes\n";
                  helpfulMessage += "   - Click '...' menu on your theme\n";
                  helpfulMessage += "   - Select 'Duplicate'\n";
                  helpfulMessage += "   - Use the duplicated theme instead\n";
                  helpfulMessage += "3. Or try selecting a different theme (unpublished/development theme)\n";
                  helpfulMessage += "\n💡 Tip: Development/Draft themes are usually easier to modify.";
              } else if (lastStatus === 403 || lastStatus === 401) {
                  helpfulMessage += "Permission denied. Please reinstall the app to grant write_themes permission.";
              } else {
                  helpfulMessage += `Unexpected error (Status ${lastStatus}). Please check the console for details.`;
              }

              throw new Error(helpfulMessage);
          }
      }
      
      // If we are here, successResponse is valid.
      // DIAGNOSTIC 4: VERIFY WRITE
      console.log("Verifying write via GET...");
      const verifyUrl = `https://${shop}/admin/api/${apiVersion}/themes/${cleanThemeId}/assets.json?asset[key]=${sectionData.filename}`;
      const verifyResp = await fetch(verifyUrl, {
           headers: { "X-Shopify-Access-Token": accessToken }
      });
      
      if (!verifyResp.ok) {
           console.warn("Write verification failed. File not found immediately after write.");
           // Also Soft Fail here if verification fails but write said OK (or we want to be lenient)
           // But normally if write OK, verify OK.
           // If write OK but verify 404, it might be propagation delay.
           // We will proceed to mark as installed.
      }
      
      // Mark as installed via Metafield (Success Case)
      await markSectionInstalled(shop, accessToken, apiVersion, sectionId);

      return json({
          success: true,
          message: `Section successfully added to theme!`,
          method: uploadMethod,
          filename: sectionData.filename
      });

    } else if (action === "deactivate") {
      // Remove the Liquid file from the theme
      const shop = session.shop;
      const accessToken = session.accessToken;
      const apiVersion = "2024-04"; // Sync with activate action
      // Ensure strictly numeric ID
      const cleanThemeId = String(themeId).replace(/\D/g, "");
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
    let userFriendlyMsg = "";

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

    // Create user-friendly error messages
    if (msg.includes("404") || msg.includes("Not Found")) {
        userFriendlyMsg = "Theme not accessible. This might be a protected theme or the theme ID is incorrect. Try selecting a different theme or contact support.";
    } else if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized") || msg.includes("Forbidden")) {
        userFriendlyMsg = "Permission denied. Please reinstall the app to grant required permissions.";
    } else if (msg.includes("All upload methods failed")) {
        userFriendlyMsg = "Unable to upload section to theme. Please ensure you have write_themes permission and the theme is editable.";
    } else {
        userFriendlyMsg = `Upload failed: ${msg}`;
    }

    console.error("Error Details:", { msg, details, userFriendlyMsg });

    return json({
        error: userFriendlyMsg,
        technicalDetails: msg,
        debug: details || msg
    }, { status: 500 });
  }
};
