import { useState } from "react";
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
  Grid,
  TextField,
  Icon,
  Listbox,
  EmptyState,
  LegacyCard,
  ActionList
} from "@shopify/polaris";
import { SearchIcon, HomeIcon, ProductIcon, SettingsIcon, PaintBrushFlatIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop.replace(".myshopify.com", "");
  return { shop };
};

export default function Index() {
  const { shop } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = [
    { id: "all", label: "All Sections", icon: HomeIcon },
    { id: "headers", label: "Headers", icon: PaintBrushFlatIcon },
    { id: "products", label: "Product Page", icon: ProductIcon },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const sections = [
    {
      id: "my-custom-section",
      title: "My Custom Section",
      description: "A customizable section with heading and colors.",
      category: "headers",
      status: "active",
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
    },
    {
      id: "hero-banner",
      title: "Hero Banner Pro",
      description: "Advanced hero banner with video support.",
      category: "headers",
      status: "coming_soon",
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle_1_large.png"
    },
    {
      id: "product-slider",
      title: "Product Slider",
      description: "Smooth sliding product carousel.",
      category: "products",
      status: "coming_soon",
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-collection-1_large.png"
    },
     {
      id: "settings-panel",
      title: "Global Settings",
      description: "Configure global app styles and behaviors.",
      category: "settings",
      status: "active",
      image: null
    }
  ];

  const filteredSections = sections.filter((section) => {
    const matchesSearch = section.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || section.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Page fullWidth>
      <TitleBar title="Dashboard" />
      
      <Grid>
        {/* Sidebar Navigation */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 2, xl: 2 }}>
          <LegacyCard>
             <ActionList
                actionRole="menuitem"
                items={categories.map(cat => ({
                  content: cat.label,
                  icon: cat.icon,
                  active: selectedCategory === cat.id,
                  onAction: () => setSelectedCategory(cat.id),
                }))}
              />
          </LegacyCard>
           <Box paddingBlockStart="400">
             <Card>
                <BlockStack gap="200">
                   <Text variant="headingSm">App Status</Text>
                   <Badge tone="success">Active</Badge>
                   <Text variant="bodyXs" tone="subdued">Connected to {shop}</Text>
                </BlockStack>
             </Card>
           </Box>
        </Grid.Cell>

        {/* Main Content Area */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 10, xl: 10 }}>
          <BlockStack gap="500">
            
            {/* Search Bar */}
            <Card>
               <InlineStack align="space-between" blockAlign="center">
                  <Box width="100%">
                    <TextField
                      label="Search Sections"
                      labelHidden
                      placeholder="Search for sections..."
                      value={searchQuery}
                      onChange={setSearchQuery}
                      prefix={<Icon source={SearchIcon} />}
                      autoComplete="off"
                    />
                  </Box>
               </InlineStack>
            </Card>

             {/* Welcome Banner if All */}
             {selectedCategory === "all" && !searchQuery && (
                <Banner
                  title="Welcome to Shopi Section Studio"
                  tone="info"
                  onDismiss={() => {}}
                >
                  <p>Explore our collection of premium sections to enhance your store.</p>
                  <Button url={`https://admin.shopify.com/store/${shop}/themes/current/editor?context=apps&activateAppId=ec818bbb-e7fe-9b80-8c63-162866afa4028167e78f/app-embed`} target="_blank">Enable App Embed</Button>
                </Banner>
             )}

            {/* Sections Grid */}
            <Box>
               <Grid>
                  {filteredSections.map((section) => (
                    <Grid.Cell key={section.id} columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
                      <Card padding="0">
                         <Box background="bg-surface-secondary" minHeight="150px" padding="400" borderEndStartRadius="0" borderEndEndRadius="0">
                            {section.image ? (
                               <img src={section.image} alt={section.title} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px'}} />
                            ) : (
                               <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                                  <Icon source={PaintBrushFlatIcon} color="base" />
                               </Box>
                            )}
                         </Box>
                         <Box padding="400">
                           <BlockStack gap="200">
                             <InlineStack align="space-between">
                                <Text variant="headingMd" as="h3">{section.title}</Text>
                                {section.status === "active" ? (
                                   <Badge tone="success">Installed</Badge>
                                ) : (
                                   <Badge tone="attention">Coming Soon</Badge>
                                )}
                             </InlineStack>
                             <Text variant="bodySm" tone="subdued">{section.description}</Text>
                             
                             <Button 
                                variant={section.status === "active" ? "primary" : "secondary"}
                                disabled={section.status !== "active"}
                                url={`https://admin.shopify.com/store/${shop}/themes/current/editor`}
                                target="_blank"
                             >
                                {section.status === "active" ? "Customize" : "Notify Me"}
                             </Button>
                           </BlockStack>
                         </Box>
                      </Card>
                    </Grid.Cell>
                  ))}
               </Grid>
               
               {filteredSections.length === 0 && (
                  <EmptyState
                    heading="No sections found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Try changing your search or category filter.</p>
                  </EmptyState>
               )}
            </Box>

          </BlockStack>
        </Grid.Cell>
      </Grid>
    </Page>
  );
}
