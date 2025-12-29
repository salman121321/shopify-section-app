import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  console.log("DEBUG: Session Scopes:", session.scope);

  try {
    // Use GraphQL to fetch themes - more robust than REST in this context
    const response = await admin.graphql(
      `#graphql
      query {
        themes(first: 20) {
          edges {
            node {
              id
              name
              role
            }
          }
        }
      }`
    );

    const responseJson = await response.json();
    
    if (responseJson.errors) {
        console.error("GraphQL Errors:", responseJson.errors);
        throw new Error(responseJson.errors[0].message);
    }

    const themesData = responseJson.data.themes.edges.map(edge => {
        const theme = edge.node;
        // GraphQL returns ID as "gid://shopify/Theme/123456", we need just "123456" for REST compatibility downstream if needed,
        // but for now let's keep it as string ID. 
        // Our frontend expects 'id' and 'role' and 'name'.
        // We might need to parse the ID if other parts of the app expect a number, 
        // but the Select component works with strings.
        // However, the Asset API in api.section.jsx expects a numeric ID for the REST client.
        // Let's extract the numeric ID.
        const numericId = theme.id.split('/').pop();
        return {
            ...theme,
            id: numericId
        };
    });

    // Sort themes: Live theme first, then others
    const themes = themesData.sort((a, b) => {
        if (a.role === 'MAIN') return -1; // GraphQL returns uppercase 'MAIN'
        if (b.role === 'MAIN') return 1;
        return 0;
    });
    
    // Normalize roles for frontend (frontend expects lowercase 'main')
    const normalizedThemes = themes.map(t => ({
        ...t,
        role: t.role.toLowerCase()
    }));

    return json({ themes: normalizedThemes });
  } catch (error) {
    console.error("Failed to fetch themes:", error);
    return json({ 
      error: error.message || "Failed to fetch themes",
      details: JSON.stringify(error)
    }, { status: 500 });
  }
};