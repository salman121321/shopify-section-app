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
  RangeSlider
} from "@shopify/polaris";
import { SearchIcon, HomeIcon, ProductIcon, SettingsIcon, PaintBrushFlatIcon, ViewIcon, MaximizeIcon, MinimizeIcon, DesktopIcon, MobileIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop.replace(".myshopify.com", "");
  return { shop };
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
  const { shop } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const [previewModal, setPreviewModal] = useState({ open: false, section: null });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState("desktop"); // desktop | mobile

  // Handle Banner Dismiss
  const handleBannerDismiss = useCallback(() => setIsBannerVisible(false), []);

  const categories = [
    { id: "all", label: "All Sections", icon: HomeIcon },
    { id: "headers", label: "Headers", icon: PaintBrushFlatIcon },
    { id: "products", label: "Product Page", icon: ProductIcon },
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
      // No image, we use preview component
      defaultSettings: {
        heading: "Hello from Shopify Section App",
        textColor: "#000000",
        backgroundColor: "#f4f4f4"
      },
      renderPreview: (settings, compact) => <MyCustomSectionPreview settings={settings} compact={compact} />
    },
    {
      id: "3d-carousel-pro",
      title: "3D Carousel Pro",
      description: "A stunning 3D product carousel with interactive physics and glassmorphism effects.",
      category: "products",
      status: "active",
      defaultSettings: {
        heading: "Featured Products",
        subheading: "Check out our latest collection",
        backgroundColor: "#a3d5f7",
        bg_overlay_color: "#000000",
        bg_overlay_opacity: 0,
        heading_color: "#1a1a1a",
        subheading_color: "#4a4a4a",
        heading_size: 36,
        subheading_size: 16
      },
      renderPreview: (settings, compact) => <ThreeDCarouselPreview settings={settings} compact={compact} />
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
                <Scrollable shadow style={{height: 'calc(100vh - 230px)'}}>
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
                <Divider />
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
                         {/* Live Preview Container with Hover Effect */}
                         <div 
                           style={{position: 'relative', height: '180px', overflow: 'hidden', cursor: 'pointer', borderTopLeftRadius: '8px', borderTopRightRadius: '8px'}}
                           className="section-image-container"
                           onClick={() => handlePreview(section)}
                         >
                            {section.renderPreview ? (
                               section.renderPreview(section.defaultSettings, true)
                            ) : section.image ? (
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
              {/* Modal Live Preview */}
              <div 
                 onContextMenu={(e) => e.preventDefault()} 
                 style={{
                    display: 'flex', justifyContent: 'center', background: '#e0e0e0', padding: '20px', borderRadius: '8px',
                    userSelect: 'none', WebkitUserSelect: 'none', minHeight: '300px'
                 }}
              >
                 {previewModal.section?.renderPreview ? (
                    previewModal.section.renderPreview(previewModal.section.defaultSettings, false)
                 ) : previewModal.section?.image ? (
                    <img 
                       src={previewModal.section.image} 
                       alt="Preview" 
                       style={{maxWidth: '100%', maxHeight: '60vh', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                       draggable="false"
                    />
                 ) : (
                    <Banner tone="warning">No preview available for this section.</Banner>
                 )}
              </div>

              <Text variant="bodyLg" as="p">{previewModal.section?.description}</Text>
              <InlineStack align="end" gap="200">
                 <Button icon={MaximizeIcon} onClick={() => { setIsFullScreen(true); setViewMode("desktop"); }}>Live Preview</Button>
                 <Button onClick={() => setPreviewModal({ open: false, section: null })}>Close</Button>
                 <Button variant="primary" url={`https://admin.shopify.com/store/${shop}/themes/current/editor`} target="_blank">Customize on Store</Button>
              </InlineStack>
           </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Full Screen Overlay */}
      {isFullScreen && previewModal.section && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 100000,
          backgroundColor: '#f6f6f7',
          display: 'flex',
          flexDirection: 'column'
        }}>
           <div style={{ 
              padding: '1rem 2rem', 
              borderBottom: '1px solid #e1e3e5', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
           }}>
              <InlineStack gap="400" blockAlign="center">
                 <Text variant="headingLg" as="h2">{previewModal.section.title}</Text>
                 <div style={{height: '24px', width: '1px', background: '#e1e3e5'}}></div>
                 <InlineStack gap="200">
                    <Button 
                       icon={DesktopIcon} 
                       pressed={viewMode === 'desktop'} 
                       onClick={() => setViewMode('desktop')}
                    >
                       Desktop
                    </Button>
                    <Button 
                       icon={MobileIcon} 
                       pressed={viewMode === 'mobile'} 
                       onClick={() => setViewMode('mobile')}
                    >
                       Mobile
                    </Button>
                 </InlineStack>
              </InlineStack>
              <Button icon={MinimizeIcon} onClick={() => setIsFullScreen(false)}>Exit Preview</Button>
           </div>
           <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              position: 'relative',
              backgroundColor: '#f1f2f4',
              display: 'flex',
              justifyContent: 'center',
              paddingTop: '2rem',
              paddingBottom: '2rem'
           }}>
              <div style={{
                 width: viewMode === 'desktop' ? '100%' : '375px',
                 height: viewMode === 'desktop' ? '100%' : '812px',
                 backgroundColor: '#fff',
                 boxShadow: viewMode === 'mobile' ? '0 20px 40px rgba(0,0,0,0.2)' : '0 0 20px rgba(0,0,0,0.1)',
                 transition: 'all 0.3s ease',
                 overflow: 'hidden', // Hide overflow on frame to clip content
                 borderRadius: viewMode === 'mobile' ? '40px' : '0',
                 border: viewMode === 'mobile' ? '14px solid #1a1a1a' : 'none',
                 position: 'relative'
              }}>
                 {/* Mobile Notch (Only visible in mobile view) */}
                 {viewMode === 'mobile' && (
                    <div style={{
                       position: 'absolute',
                       top: 0,
                       left: '50%',
                       transform: 'translateX(-50%)',
                       width: '150px',
                       height: '24px',
                       backgroundColor: '#1a1a1a',
                       borderBottomLeftRadius: '16px',
                       borderBottomRightRadius: '16px',
                       zIndex: 10
                    }}></div>
                 )}

                 {/* Content Scroll Area */}
                 <div style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'auto',
                    paddingTop: viewMode === 'mobile' ? '24px' : '0' // Space for notch
                 }}>
                    {previewModal.section.renderPreview ? (
                       previewModal.section.renderPreview(previewModal.section.defaultSettings, false)
                    ) : previewModal.section.image ? (
                       <img 
                          src={previewModal.section.image} 
                          alt="Full Preview" 
                          style={{width: '100%', height: 'auto', display: 'block'}} 
                       />
                    ) : (
                       <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                          <Text as="p">No preview available</Text>
                       </Box>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* CSS for Hover Effect */}
      <style>{`
         .section-image-container:hover .hover-overlay {
            opacity: 1 !important;
         }
      `}</style>
    </Page>
  );
}
