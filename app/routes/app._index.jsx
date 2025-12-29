import { useState, useCallback } from "react";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Banner,
  Badge,
  Grid,
  TextField,
  Icon,
  EmptyState,
  LegacyCard,
  ActionList,
  Modal,
  Scrollable,
  Divider
} from "@shopify/polaris";
import { SearchIcon, HomeIcon, ProductIcon, SettingsIcon, PaintBrushFlatIcon, ViewIcon } from "@shopify/polaris-icons";
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
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const [previewModal, setPreviewModal] = useState({ open: false, section: null });

  // Handle Banner Dismiss
  const handleBannerDismiss = useCallback(() => setIsBannerVisible(false), []);

  const categories = [
    { id: "all", label: "All Sections", icon: HomeIcon },
    { id: "headers", label: "Headers", icon: PaintBrushFlatIcon },
    { id: "products", label: "Product Page", icon: ProductIcon },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    // Simulate many categories for testing scroll
    ...Array.from({ length: 15 }).map((_, i) => ({
       id: `cat-${i}`, label: `Category ${i+1}`, icon: PaintBrushFlatIcon 
    }))
  ];

  const filteredCategories = categories.filter(cat => 
    cat.label.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

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

  const handlePreview = (section) => {
    setPreviewModal({ open: true, section });
  };

  return (
    <Page fullWidth>
      <TitleBar title="Dashboard" />
      
      <Grid>
        {/* Sidebar Navigation - Fixed & Scrollable */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 2, xl: 2 }}>
          <Box position="sticky" insetBlockStart="0">
             <LegacyCard>
                <Box padding="200">
                   <TextField
                      label="Search Categories"
                      labelHidden
                      placeholder="Search categories..."
                      value={categorySearchQuery}
                      onChange={setCategorySearchQuery}
                      prefix={<Icon source={SearchIcon} />}
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => setCategorySearchQuery("")}
                   />
                </Box>
                <Divider />
                <Scrollable shadow style={{height: 'calc(100vh - 200px)'}}>
                   <ActionList
                      actionRole="menuitem"
                      items={filteredCategories.map(cat => ({
                        content: cat.label,
                        icon: cat.icon,
                        active: selectedCategory === cat.id,
                        onAction: () => setSelectedCategory(cat.id),
                      }))}
                    />
                    {filteredCategories.length === 0 && (
                        <Box padding="400">
                            <Text tone="subdued" alignment="center" as="p">No categories found</Text>
                        </Box>
                    )}
                </Scrollable>
             </LegacyCard>
             <Box paddingBlockStart="400">
               <LegacyCard>
                <ActionList
                  actionRole="menuitem"
                  items={[{
                    content: "Settings",
                    icon: SettingsIcon,
                    active: selectedCategory === "settings",
                    onAction: () => setSelectedCategory("settings"),
                  }]}
                />
               </LegacyCard>
             </Box>
             <Box paddingBlockStart="400">
               <Card>
                  <BlockStack gap="200">
                     <Text variant="headingSm" as="h2">App Status</Text>
                     <Badge tone="success">Active</Badge>
                     <Text variant="bodyXs" tone="subdued" as="p">Connected to {shop}</Text>
                  </BlockStack>
               </Card>
             </Box>
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

             {/* Welcome Banner - Dismissible */}
             {selectedCategory === "all" && !searchQuery && isBannerVisible && (
                <Banner
                  title="Welcome to Shopi Section Studio"
                  tone="info"
                  onDismiss={handleBannerDismiss}
                >
                  <p>Explore our collection of premium sections to enhance your store. Make sure to enable the App Embed first.</p>
                  <BlockStack gap="200">
                     <InlineStack gap="300">
                        <Button url={`https://admin.shopify.com/store/${shop}/themes/current/editor?context=apps&activateAppId=ec818bbb-e7fe-9b80-8c63-162866afa4028167e78f/app-embed`} target="_blank">Enable App Embed</Button>
                        <Button variant="plain" onClick={handleBannerDismiss}>I have enabled it</Button>
                     </InlineStack>
                  </BlockStack>
                </Banner>
             )}

            {/* Sections Grid */}
            <Box>
               <Grid>
                  {filteredSections.map((section) => (
                    <Grid.Cell key={section.id} columnSpan={{ xs: 6, sm: 6, md: 3, lg: 3, xl: 3 }}>
                      <Card padding="0">
                         {/* Image Container with Hover Effect */}
                         <div 
                           style={{position: 'relative', height: '180px', overflow: 'hidden', cursor: 'pointer', borderTopLeftRadius: '8px', borderTopRightRadius: '8px'}}
                           className="section-image-container"
                           onClick={() => handlePreview(section)}
                         >
                            {section.image ? (
                               <img 
                                 src={section.image} 
                                 alt={section.title} 
                                 style={{width: '100%', height: '100%', objectFit: 'cover'}} 
                               />
                            ) : (
                               <Box background="bg-surface-secondary" height="100%" display="flex" alignItems="center" justifyContent="center">
                                  <Icon source={PaintBrushFlatIcon} color="base" />
                               </Box>
                            )}
                            
                            {/* Hover Overlay */}
                            <div className="hover-overlay" style={{
                               position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                               background: 'rgba(0,0,0,0.3)', 
                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                               opacity: 0, transition: 'opacity 0.2s ease-in-out'
                            }}>
                               <div style={{background: 'white', padding: '8px', borderRadius: '50%'}}>
                                  <Icon source={ViewIcon} />
                               </div>
                            </div>
                         </div>

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
                             <Text variant="bodySm" tone="subdued" truncate as="p">{section.description}</Text>
                             
                             <Button 
                                fullWidth
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

      {/* Preview Modal */}
      <Modal
        open={previewModal.open}
        onClose={() => setPreviewModal({ open: false, section: null })}
        title={previewModal.section?.title}
        large
      >
        <Modal.Section>
           <BlockStack gap="400">
              {previewModal.section?.image ? (
                 <div 
                    onContextMenu={(e) => e.preventDefault()} 
                    style={{
                       display: 'flex', justifyContent: 'center', background: '#f4f4f4', padding: '20px', borderRadius: '8px',
                       userSelect: 'none', WebkitUserSelect: 'none'
                    }}
                 >
                    <img 
                       src={previewModal.section.image} 
                       alt="Preview" 
                       style={{maxWidth: '100%', maxHeight: '60vh', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                       draggable="false"
                    />
                 </div>
              ) : (
                 <Banner tone="warning">No preview available for this section.</Banner>
              )}
              <Text variant="bodyLg" as="p">{previewModal.section?.description}</Text>
              <InlineStack align="end">
                 <Button onClick={() => setPreviewModal({ open: false, section: null })}>Close</Button>
                 <Button variant="primary" url={`https://admin.shopify.com/store/${shop}/themes/current/editor`} target="_blank">Customize on Store</Button>
              </InlineStack>
           </BlockStack>
        </Modal.Section>
      </Modal>

      {/* CSS for Hover Effect */}
      <style>{`
         .section-image-container:hover .hover-overlay {
            opacity: 1 !important;
         }
      `}</style>
    </Page>
  );
}
