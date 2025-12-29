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
  Divider,
  ColorPicker,
  RangeSlider,
  Tooltip,
  Link
} from "@shopify/polaris";
import { SearchIcon, HomeIcon, ProductIcon, SettingsIcon, PaintBrushFlatIcon, ViewIcon, MaximizeIcon, MinimizeIcon, DesktopIcon, MobileIcon, ExternalIcon, CheckIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop.replace(".myshopify.com", "");
  return { shop, shopDomain: session.shop };
};

// Live Preview Component for "My Custom Section"
const MyCustomSectionPreview = ({ settings, compact = false }) => {
  return (
    <div style={{
      backgroundColor: settings.backgroundColor || "#f4f4f4",
      color: settings.textColor || "#000000",
      padding: compact ? '20px' : '40px',
      textAlign: 'center',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: compact ? '180px' : '300px',
      borderTopLeftRadius: compact ? '8px' : '0',
      borderTopRightRadius: compact ? '8px' : '0',
    }}>
      <h2 style={{ margin: 0, fontSize: compact ? '18px' : '24px', fontWeight: 'bold' }}>
        {settings.heading || "Hello from Shopify Section App"}
      </h2>
      <p style={{ marginTop: '10px', fontSize: compact ? '12px' : '16px' }}>
        This section is powered by your Shopify App!
      </p>
    </div>
  );
};

// Live Preview Component for "3D Carousel Pro"
const ThreeDCarouselPreview = ({ settings, compact = false }) => {
   const cardWidth = compact ? '100px' : '200px';
   const cardHeight = compact ? '150px' : '300px';

   return (
     <div style={{
       backgroundColor: settings.backgroundColor || "#a3d5f7",
       width: '100%',
       height: '100%',
       display: 'flex',
       flexDirection: 'column',
       alignItems: 'center',
       justifyContent: 'center',
       overflow: 'hidden',
       position: 'relative',
       minHeight: compact ? '180px' : '500px',
     }}>
        {/* Overlay */}
        <div style={{
           position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
           backgroundColor: settings.bg_overlay_color || '#000',
           opacity: (settings.bg_overlay_opacity || 0) / 100,
           zIndex: 1
        }}></div>

        <div style={{zIndex: 2, textAlign: 'center', marginBottom: compact ? '10px' : '20px'}}>
           <h2 style={{
              color: settings.heading_color || '#1a1a1a', 
              fontSize: compact ? '16px' : (settings.heading_size + 'px' || '24px'),
              margin: '0 0 5px 0'
           }}>
              {settings.heading || "Featured Products"}
           </h2>
           <p style={{
              color: settings.subheading_color || '#4a4a4a',
              fontSize: compact ? '10px' : (settings.subheading_size + 'px' || '16px'),
              margin: 0
           }}>
              {settings.subheading?.replace(/<[^>]*>?/gm, '') || "Check out our latest collection"}
           </p>
        </div>

        {/* Mock Carousel */}
        <div style={{
           display: 'flex', 
           gap: compact ? '10px' : '20px', 
           zIndex: 2, 
           transform: 'perspective(1000px) rotateY(-5deg)',
           transformStyle: 'preserve-3d'
        }}>
           {[1, 2, 3].map((item, index) => (
              <div key={index} style={{
                 width: cardWidth,
                 height: cardHeight,
                 backgroundColor: '#fff',
                 borderRadius: '12px',
                 boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                 display: 'flex',
                 flexDirection: 'column',
                 overflow: 'hidden',
                 transform: index === 1 ? 'translateZ(20px) scale(1.1)' : 'translateZ(0) scale(0.9)',
                 opacity: index === 1 ? 1 : 0.7,
                 transition: 'all 0.3s ease'
              }}>
                 <div style={{flex: 2, backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Icon source={ProductIcon} color="subdued" />
                 </div>
                 <div style={{flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                    <div style={{height: '8px', width: '80%', backgroundColor: '#ddd', marginBottom: '5px', borderRadius: '4px'}}></div>
                    <div style={{height: '8px', width: '40%', backgroundColor: '#eee', borderRadius: '4px'}}></div>
                 </div>
              </div>
           ))}
        </div>
     </div>
   );
};

export default function Index() {
  const { shop, shopDomain } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Sections Data
  const sections = [
    {
      id: "3d-carousel-pro",
      title: "3D Carousel Pro",
      description: "Interactive 3D product carousel with simulated blocks and smooth animations.",
      category: "products",
      status: "active",
      defaultSettings: {
        heading: "Featured Products",
        subheading: "Check out our latest collection",
        backgroundColor: "#a3d5f7",
        heading_color: "#1a1a1a",
      },
      renderPreview: (settings, compact) => <ThreeDCarouselPreview settings={settings} compact={compact} />
    },
    {
      id: "my-custom-section",
      title: "Simple Header",
      description: "A basic header section for simple announcements.",
      category: "headers",
      status: "active",
      defaultSettings: {
        heading: "Welcome to our store",
        textColor: "#000000",
        backgroundColor: "#f4f4f4"
      },
      renderPreview: (settings, compact) => <MyCustomSectionPreview settings={settings} compact={compact} />
    }
  ];

  const filteredSections = sections.filter(section => 
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedCategory === "all" || section.category === selectedCategory)
  );

  const themeEditorUrl = `https://admin.shopify.com/store/${shop}/themes/current/editor?context=apps&app_id=${process.env.SHOPIFY_API_KEY || ''}`;

  return (
    <Page fullWidth>
      <TitleBar title="Section Studio Dashboard" />
      
      <BlockStack gap="500">
        {/* Header Banner */}
        <Banner tone="success" onDismiss={() => {}}>
          <p><strong>Shopi Section is Active!</strong> Your sections are deployed and ready to use in the Theme Editor.</p>
        </Banner>

        <Grid>
          {/* Sidebar Navigation (Simulating Section Studio) */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 3, lg: 3, xl: 3}}>
            <Card padding="0">
              <ActionList
                actionRole="menuitem"
                items={[
                  {
                    content: 'All Sections',
                    icon: HomeIcon,
                    active: selectedCategory === 'all',
                    onAction: () => setSelectedCategory('all'),
                  },
                  {
                    content: 'Product Sections',
                    icon: ProductIcon,
                    active: selectedCategory === 'products',
                    onAction: () => setSelectedCategory('products'),
                  },
                  {
                    content: 'Headers',
                    icon: PaintBrushFlatIcon,
                    active: selectedCategory === 'headers',
                    onAction: () => setSelectedCategory('headers'),
                  },
                ]}
              />
            </Card>
            <Box paddingBlockStart="400">
               <Text as="p" variant="bodySm" tone="subdued">
                  Need help? Check our <Link url="#" target="_blank">documentation</Link>.
               </Text>
            </Box>
          </Grid.Cell>

          {/* Main Content */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 9, lg: 9, xl: 9}}>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                 <Text variant="headingLg" as="h2">My Sections</Text>
                 <Button 
                    variant="primary" 
                    icon={ExternalIcon} 
                    url={themeEditorUrl} 
                    target="_blank"
                 >
                    Open Theme Editor
                 </Button>
              </InlineStack>

              <TextField
                label="Search Sections"
                labelHidden
                placeholder="Search by name..."
                value={searchQuery}
                onChange={setSearchQuery}
                prefix={<Icon source={SearchIcon} />}
                autoComplete="off"
              />

              <Grid>
                {filteredSections.map((section) => (
                  <Grid.Cell key={section.id} columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <Card padding="0">
                      <div style={{ position: 'relative' }}>
                        {/* Status Badge */}
                        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
                           <Badge tone="success" progress="complete">Active</Badge>
                        </div>
                        
                        {/* Preview Area */}
                        <div style={{ height: '200px', overflow: 'hidden', borderBottom: '1px solid #e1e3e5' }}>
                          {section.renderPreview(section.defaultSettings, true)}
                        </div>

                        {/* Content Area */}
                        <Box padding="400">
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                               <Text variant="headingMd" as="h3">{section.title}</Text>
                            </InlineStack>
                            <Text variant="bodySm" tone="subdued" as="p" truncate>
                              {section.description}
                            </Text>
                            
                            <Divider />
                            
                            <InlineStack align="end" gap="200">
                               <Button size="slim">Settings</Button>
                               <Button 
                                  variant="primary" 
                                  size="slim" 
                                  url={themeEditorUrl}
                                  target="_blank"
                               >
                                  Customize
                               </Button>
                            </InlineStack>
                          </BlockStack>
                        </Box>
                      </div>
                    </Card>
                  </Grid.Cell>
                ))}
              </Grid>

              {filteredSections.length === 0 && (
                <EmptyState
                  heading="No sections found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Try changing your search or category.</p>
                </EmptyState>
              )}
            </BlockStack>
          </Grid.Cell>
        </Grid>
      </BlockStack>
    </Page>
  );
}
