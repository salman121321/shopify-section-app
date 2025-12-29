import { Page, Layout, Text, Card, BlockStack, List, Link } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <Page>
      <TitleBar title="Shopi Section App" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Welcome to Shopi Section App! 🎉
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Congratulations! Your app is successfully installed and running.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    This app provides customizable sections that you can use in your Shopify Theme.
                    You don't need to do anything here in this dashboard.
                  </Text>
                </BlockStack>
                
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    How to use your new Section:
                  </Text>
                  <List type="number">
                    <List.Item>
                      Go to <Text as="strong">Online Store</Text> from the left sidebar.
                    </List.Item>
                    <List.Item>
                      Click on <Text as="strong">Customize</Text> for your current theme.
                    </List.Item>
                    <List.Item>
                      In the Theme Editor, click <Text as="strong">Add section</Text>.
                    </List.Item>
                    <List.Item>
                      Look for <Text as="strong">"My Custom Section"</Text> under the <b>Apps</b> category.
                    </List.Item>
                    <List.Item>
                      Add it to your page and customize the settings (Heading, Colors, etc.)!
                    </List.Item>
                  </List>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
