import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Banner,
  Divider,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop.replace(".myshopify.com", "");
  return { shop };
};

export default function Index() {
  const { shop } = useLoaderData();

  return (
    <Page>
      <TitleBar title="Dashboard" />
      <BlockStack gap="500">
        
        <Layout>
          <Layout.Section>
             <Banner
                title="Shopi Section is active"
                tone="success"
              >
                <p>Your app is successfully installed and ready to use.</p>
              </Banner>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">
                    Welcome to Shopi Section
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Empower your Shopify store with advanced customizable sections. 
                    No coding required—just plug and play.
                  </Text>
                </BlockStack>
                
                <Divider />

                <BlockStack gap="400">
                   <Text as="h3" variant="headingMd">
                    Quick Start Guide
                  </Text>
                  
                  <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
                        <Box width="100%">
                           <BlockStack gap="200">
                              <Text variant="headingSm">1. Enable App Embed</Text>
                              <Text variant="bodySm" tone="subdued">
                                Go to <b>Theme Settings &gt; App Embeds</b> and enable "Shopi App Embed" to activate global features.
                              </Text>
                           </BlockStack>
                        </Box>
                        <Button variant="primary" url={`https://admin.shopify.com/store/${shop}/themes/current/editor?context=apps&activateAppId=ec818bbb-e7fe-9b80-8c63-162866afa4028167e78f/app-embed`} target="_blank">
                          Enable App Embed
                        </Button>
                    </InlineStack>
                  </Box>

                   <Divider />

                   <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
                      <Box width="100%">
                         <BlockStack gap="200">
                            <Text variant="headingSm">2. Add Custom Sections</Text>
                            <Text variant="bodySm" tone="subdued">
                              In the Theme Editor, click <b>Add Section</b> and look for "My Custom Section" under Apps.
                            </Text>
                         </BlockStack>
                      </Box>
                      <Button url={`https://admin.shopify.com/store/${shop}/themes/current/editor`} target="_blank">
                        Open Theme Editor
                      </Button>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    App Status
                  </Text>
                  <InlineStack gap="200" align="start" blockAlign="center">
                     <Badge tone="success">Active</Badge>
                     <Text tone="subdued">Version 1.0.0</Text>
                  </InlineStack>
                  <Box paddingBlockStart="200">
                    <Text variant="bodySm" tone="subdued">
                      Connected to: <b>{shop}</b>
                    </Text>
                  </Box>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Need Help?
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Have questions or need a custom section built?
                  </Text>
                  <Button variant="plain" url="mailto:support@example.com">Contact Support</Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
