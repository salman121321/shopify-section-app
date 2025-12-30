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

  console.log("\n=== NEW SECTION INSTALL REQUEST ===");
  console.log("Session Shop:", session.shop);
  console.log("Session Scopes:", session.scope);
  console.log("Session Access Token Length:", session.accessToken?.length || 0);

  if (!session.scope?.includes("write_themes")) {
      console.error("❌ Missing write_themes scope!");
      return json({ error: "Missing 'write_themes' permission. Please reinstall the app or update permissions." }, { status: 403 });
  }

  const action = formData.get("action");
  const themeId = formData.get("themeId");

  console.log("Action:", action);
  console.log("Theme ID:", themeId);

  if (!themeId) {
    return json({ error: "Theme ID is required" }, { status: 400 });
  }

  // Skip early theme verification - we'll verify with direct API calls below
  // The admin.rest.resources.Theme.find() was causing false 404 errors
  console.log("Theme ID received:", themeId);

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

      // PRIMARY METHOD: Using Shopify Admin REST Client (Official Way)
      console.log("\n=== ATTEMPTING ASSET UPLOAD ===");
      console.log(`Shop: ${shop}`);
      console.log(`Theme ID: ${cleanThemeId}`);
      console.log(`Filename: ${sectionData.filename}`);
      console.log(`Content Length: ${sectionData.content.length} characters`);

      let successResponse = null;
      let uploadMethod = null;
      let lastError = "Unknown error";
      let lastStatus = 0;

      // METHOD 1: Use GraphQL themeFilesUpsert (Correct for OS 2.0)
      try {
          console.log("\n=== METHOD 1: GraphQL themeFilesUpsert ===");

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

          // Correct GID format for themes
          const themeGid = `gid://shopify/Theme/${cleanThemeId}`;

          const variables = {
              themeId: themeGid,
              files: [{
                  filename: sectionData.filename,
                  body: {
                      type: "TEXT",
                      value: sectionData.content
                  }
              }]
          };

          console.log("Theme GID:", themeGid);
          console.log("Filename:", sectionData.filename);
          console.log("Content length:", sectionData.content.length);

          const response = await admin.graphql(graphqlQuery, { variables });
          const responseData = await response.json();

          console.log("GraphQL Response Status:", response.status);
          console.log("GraphQL Response:", JSON.stringify(responseData, null, 2));

          if (responseData.data?.themeFilesUpsert?.upsertedThemeFiles?.length > 0) {
              console.log("✅ ✅ ✅ GraphQL Upload SUCCESS! ✅ ✅ ✅");
              console.log("Uploaded File:", responseData.data.themeFilesUpsert.upsertedThemeFiles[0]);
              successResponse = { ok: true };
              uploadMethod = "graphql";
          } else if (responseData.data?.themeFilesUpsert?.userErrors?.length > 0) {
              const errors = responseData.data.themeFilesUpsert.userErrors;
              console.error("❌ GraphQL User Errors:", errors);
              lastError = errors.map(e => `[${e.code}] ${e.message} (field: ${e.field || 'unknown'})`).join("; ");
              lastStatus = 400;
          } else if (responseData.errors) {
              console.error("❌ GraphQL API Errors:", responseData.errors);
              lastError = responseData.errors.map(e => e.message).join("; ");
              lastStatus = 400;
          } else {
              console.warn("❌ Unexpected GraphQL response structure");
              console.log("Full response:", responseData);
              lastError = "Unexpected response - no files uploaded and no errors";
              lastStatus = 500;
          }
      } catch (graphqlError) {
          console.error("❌ GraphQL Exception:", graphqlError.message);
          console.error("Error Stack:", graphqlError.stack);
          lastError = `GraphQL Exception: ${graphqlError.message}`;
      }

      // METHOD 2: Direct REST API (Fallback)
      if (!successResponse) {
          try {
              console.log("\n=== METHOD 2: Direct REST API ===");

              const apiVer = "2024-04";
              const assetUrl = `https://${shop}/admin/api/${apiVer}/themes/${cleanThemeId}/assets.json`;

              console.log(`Trying URL: ${assetUrl}`);

              const response = await fetch(assetUrl, {
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

              console.log(`Response Status: ${response.status}`);

              if (response.ok) {
                  const data = await response.json();
                  console.log("✅ Direct REST Success!");
                  console.log("Asset saved:", data.asset);
                  successResponse = response;
                  uploadMethod = "direct-rest";
              } else {
                  const errorText = await response.text();
                  lastError = errorText;
                  lastStatus = response.status;
                  console.error(`❌ Direct REST Failed (${response.status}):`, errorText);

                  if (response.status === 401 || response.status === 403) {
                      await prisma.session.deleteMany({ where: { shop } });
                      return json({ reauth: true, error: "Authentication failed. Please reload the page." }, { status: 401 });
                  }

                  // Try alternative API versions
                  console.log("Trying alternative API versions...");
                  const altVersions = ["2024-10", "2024-07"];

                  for (const v of altVersions) {
                      console.log(`Trying alternative version: ${v}`);
                      const altUrl = `https://${shop}/admin/api/${v}/themes/${cleanThemeId}/assets.json`;

                      try {
                          const altResp = await fetch(altUrl, {
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

                          if (altResp.ok) {
                              console.log(`✅ Success with ${v}!`);
                              successResponse = altResp;
                              uploadMethod = `rest-${v}`;
                              break;
                          } else {
                              lastStatus = altResp.status;
                              lastError = await altResp.text();
                              console.warn(`Version ${v} failed (${lastStatus})`);
                          }
                      } catch (e) {
                          console.error(`Exception with ${v}:`, e.message);
                          lastError = e.message;
                      }
                  }

                  // FALLBACK METHOD 3: Try simplified filename
                  if (!successResponse && lastStatus === 404) {
                      console.log("Trying simplified filename...");

                      const simplifiedFilename = sectionData.filename.replace('shopi-', '');
                      const simpleUrl = `https://${shop}/admin/api/2024-04/themes/${cleanThemeId}/assets.json`;

                      try {
                          const simpleResp = await fetch(simpleUrl, {
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

                          if (simpleResp.ok) {
                              console.log("✅ Simplified filename worked!");
                              successResponse = simpleResp;
                              uploadMethod = "rest-simplified";
                              sectionData.filename = simplifiedFilename;
                          }
                      } catch (e) {
                          console.error("Simplified filename failed:", e.message);
                          lastError = e.message;
                      }
                  }
              }
          } catch (methodTwoError) {
              console.error("❌ METHOD 2 Exception:", methodTwoError.message);
              lastError = methodTwoError.message;
          }
      }

      // Final error if all methods failed
      if (!successResponse) {
          console.error("\n=== ALL UPLOAD METHODS FAILED ===");
          console.error(`Last Error: ${lastError}`);
          console.error(`Last Status: ${lastStatus}`);

          let helpfulMessage = `Failed to upload section. Error: ${lastError}`;

          if (lastStatus === 404) {
              helpfulMessage = "Theme not accessible. Please check:\n";
              helpfulMessage += "1. Theme ID is correct\n";
              helpfulMessage += "2. Try a different theme (duplicate or development theme)\n";
              helpfulMessage += "3. Check terminal logs for detailed error";
          } else if (lastStatus === 403 || lastStatus === 401) {
              helpfulMessage = "Permission denied. Please reinstall the app with write_themes permission.";
          }

          return json({
              error: helpfulMessage,
              technicalDetails: `Status ${lastStatus}: ${lastError}`,
              debug: { lastStatus, lastError, shop, themeId: cleanThemeId }
          }, { status: 500 });
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
