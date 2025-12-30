import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { redirect } from "@remix-run/node";
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
  Select,
  Spinner,
  Toast,
  Frame
} from "@shopify/polaris";
import { SearchIcon, HomeIcon, ProductIcon, SettingsIcon, PaintBrushFlatIcon, ViewIcon, MaximizeIcon, MinimizeIcon, DesktopIcon, MobileIcon, PlusIcon, CheckIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  // Check scopes (Strictly based on write_themes)
  const currentScopes = new Set(session.scope ? session.scope.split(",").map(s => s.trim()) : []);
  
  // Hardcode required scopes to what is strictly necessary for functionality
  // We ignore read_themes because write_themes implies it, and we want to avoid UI confusion
  const requiredScopes = ["write_products", "write_themes"];
  
  const hasAllScopes = requiredScopes.every(scope => currentScopes.has(scope));

  const shop = session.shop.replace(".myshopify.com", "");
  
  // Pass scope status to UI
  return { 
    shop, 
    reauthRequired: !hasAllScopes, 
    host: session.shop, 
    requiredScopes,
    currentScopesRaw: session.scope || "No scopes found"
  };
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
  const { shop, reauthRequired, host, requiredScopes, currentScopesRaw } = useLoaderData();
  const themesFetcher = useFetcher();
  const sectionFetcher = useFetcher();
  
   const [searchQuery, setSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const [previewModal, setPreviewModal] = useState({ open: false, section: null });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState("desktop"); // desktop | mobile
  
  // Theme Selection State
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [selectedSectionForInstall, setSelectedSectionForInstall] = useState(null);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [themes, setThemes] = useState([]);
  const [installedSectionIds, setInstalledSectionIds] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [showReauthModal, setShowReauthModal] = useState(false);

  // Load themes on mount
  useEffect(() => {
    if (themesFetcher.state === "idle" && !themesFetcher.data) {
      themesFetcher.load("/api/themes");
    }
  }, []); // Run once on mount

  // Check initial reauth status
  useEffect(() => {
      if (reauthRequired) {
          setShowReauthModal(true);
      }
  }, [reauthRequired]);

  useEffect(() => {
    if (themesFetcher.data) {
      if (themesFetcher.data.reauth) {
        console.log("Re-auth required from themes API.");
        setShowReauthModal(true);
        return;
      }
      
      if (themesFetcher.data.themes) {
        setThemes(themesFetcher.data.themes);
        // Default to main theme
        const mainTheme = themesFetcher.data.themes.find(t => t.role === 'main');
        if (mainTheme) setSelectedThemeId(mainTheme.id.toString());
      }
      
      if (themesFetcher.data.installedSections) {
        setInstalledSectionIds(themesFetcher.data.installedSections);
      }
    }
  }, [themesFetcher.data]);

  // Handle installation response
  useEffect(() => {
    if (sectionFetcher.state === "idle" && sectionFetcher.data) {
        if (sectionFetcher.data.reauth) {
            console.log("Re-auth required from section API.");
            setShowReauthModal(true);
            return;
        }

        if (sectionFetcher.data.success) {
            setToastMessage(sectionFetcher.data.message);
            setThemeModalOpen(false);
            // Optimistically update installed status
            if (selectedSectionForInstall) {
                 setInstalledSectionIds(prev => [...prev, selectedSectionForInstall.id]);
            }
            // Force re-fetch themes to verify persistence immediately
            themesFetcher.load("/api/themes");
        } else if (sectionFetcher.data.error) {
            setToastMessage("Error: " + sectionFetcher.data.error);
        }
    }
  }, [sectionFetcher.state, sectionFetcher.data]);

  const handleReauth = () => {
      // Redirect to auth endpoint to trigger scope update
      const authUrl = `/auth/login?shop=${shop}.myshopify.com`; // Assuming standard auth path
      // Or simply reload which should trigger loader -> authenticate -> redirect
      // But let's try a hard redirect to the app root which triggers loader
      window.open(`https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/${process.env.SHOPIFY_API_KEY || "shopi-section"}`, "_top");
  };

  // Handle Banner Dismiss
  const handleBannerDismiss = useCallback(() => setIsBannerVisible(false), []);

  const handleInstallClick = (section) => {
    setSelectedSectionForInstall(section);
    setThemeModalOpen(true);
  };

  const handleConfirmInstall = () => {
    if (!selectedThemeId || !selectedSectionForInstall) return;
    
    sectionFetcher.submit(
      { 
        action: "activate", 
        themeId: selectedThemeId, 
        sectionId: selectedSectionForInstall.id 
      },
      { method: "post", action: "/api/section" }
    );
  };


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
    
    if (selectedCategory === "activated") {
        return matchesSearch && installedSectionIds.includes(section.id);
    }
    
    const matchesCategory = selectedCategory === "all" || section.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handlePreview = (section) => {
    setPreviewModal({ open: true, section });
  };
  
  const themeOptions = themes.map(theme => {
    let roleLabel = theme.role;
    if (theme.role === 'main') roleLabel = 'Live';
    else if (theme.role === 'unpublished') roleLabel = 'Draft';
    else if (theme.role === 'demo') roleLabel = 'Demo';
    
    return {
      label: `${theme.name} (${roleLabel})`,
      value: theme.id.toString()
    };
  });

  return (
    <Frame>
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
                  items={[
                    {
                        content: "Settings",
                        icon: SettingsIcon,
                        active: selectedCategory === "settings",
                        onAction: () => setSelectedCategory("settings"),
                    },
                    {
                        content: "Activated Sections",
                        icon: CheckIcon,
                        active: selectedCategory === "activated",
                        onAction: () => setSelectedCategory("activated"),
                    }
                  ]}
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
                  <p>Explore our collection of premium sections to enhance your store. Select a section to add it to your theme.</p>
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
                                   <Badge tone="success">Ready</Badge>
                                ) : (
                                   <Badge tone="attention">Coming Soon</Badge>
                                )}
                             </InlineStack>
                             <Text variant="bodySm" tone="subdued" truncate as="p">{section.description}</Text>
                             
                             <InlineStack gap="200">
                                {(() => {
                                    const isInstalled = installedSectionIds.includes(section.id);
                                    return (
                                        <Button 
                                            fullWidth
                                            variant={isInstalled ? "secondary" : "primary"}
                                            icon={isInstalled ? CheckIcon : PlusIcon}
                                            disabled={isInstalled}
                                            onClick={() => handleInstallClick(section)}
                                        >
                                            {isInstalled ? "Activated" : "Activate"}
                                        </Button>
                                    );
                                })()}
                                <Button 
                                    icon={SettingsIcon}
                                    onClick={() => handlePreview(section)}
                                >
                                    Preview
                                </Button>
                             </InlineStack>
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
                 <Button variant="primary" onClick={() => {
                     setPreviewModal({ open: false, section: null });
                     handleInstallClick(previewModal.section);
                 }}>Activate Section</Button>
              </InlineStack>
           </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Re-Auth Modal - Removed as we use Banner now */}
      {/* <Modal
        open={reauthRequired && parseInt(typeof window !== 'undefined' ? localStorage.getItem("auth_retry_count") || "0" : "0") >= 3}
        title="Update Required"
        onClose={() => {}} // Force user to update
        primaryAction={{
            content: 'Update App Permissions',
            onAction: () => {
                // Reset counter to allow another try
                localStorage.removeItem("auth_retry_count");
                const authUrl = `/auth/login?shop=${shop}`;
                window.open(authUrl, "_top");
            }
        }}
      >
        <Modal.Section>
            <Banner tone="critical">
                 <p>Automatic update failed. Please manually update permissions.</p>
                 <p>Missing scopes: {
                      (requiredScopes || ["read_themes", "write_themes", "write_products"])
                      .filter(s => !(host ? false : true)) // Simplify for UI
                      .join(", ")
                 }</p>
             </Banner>
        </Modal.Section>
      </Modal> */}

      {/* Theme Selection Modal */}
      <Modal
        open={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        title={`Activate ${selectedSectionForInstall?.title}`}
      >
        <Modal.Section>
            <BlockStack gap="400">
                <Text as="p">
                    Select the theme where you want to add this section. 
                    The section will be automatically added and activated in the selected theme.
                </Text>
                
                {themesFetcher.state === "loading" ? (
                    <Box display="flex" justifyContent="center" padding="400">
                        <Spinner size="large" />
                    </Box>
                ) : themes.length === 0 ? (
                    <BlockStack gap="200">
                        <Banner tone="warning">
                            {themesFetcher.data?.error ? (
                              <>
                                <p>Error: {themesFetcher.data.error}</p>
                                {(themesFetcher.data.error.includes("Access denied") || themesFetcher.data.error.includes("scope")) && (
                                   <div style={{ marginTop: '0.5rem' }}>
                                      <Button 
                                        variant="primary"
                                        onClick={() => {
                                            // Force re-auth
                                            const shopDomain = new URLSearchParams(window.location.search).get("shop") || shop;
                                            // Redirect to auth endpoint
                                            window.open(`/auth/login?shop=${shopDomain}`, "_top");
                                        }}
                                      >
                                        Grant Permissions
                                      </Button>
                                      <p style={{ marginTop: '0.25rem' }}><small>App needs permission to read themes.</small></p>
                                   </div>
                                )}
                                {themesFetcher.data.details && <p><small>{themesFetcher.data.details}</small></p>}
                              </>
                            ) : (
                              "No themes found or failed to load."
                            )}
                        </Banner>
                        <Button onClick={() => themesFetcher.load("/api/themes")}>Retry Loading Themes</Button>
                    </BlockStack>
                ) : (
                    <Select
                        label="Select Theme"
                        options={themeOptions}
                        value={selectedThemeId}
                        onChange={setSelectedThemeId}
                    />
                )}
            </BlockStack>
        </Modal.Section>
        <Modal.Section>
            <InlineStack align="end" gap="200">
                <Button onClick={() => setThemeModalOpen(false)}>Cancel</Button>
                <Button 
                    variant="primary" 
                    onClick={handleConfirmInstall}
                    loading={sectionFetcher.state === "submitting"}
                >
                    Add & Activate
                </Button>
            </InlineStack>
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
              }}>
                 {previewModal.section.renderPreview(previewModal.section.defaultSettings, false)}
              </div>
           </div>
        </div>
      )}

      {toastMessage && (
        <Toast content={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}

        {/* Re-Auth Modal */}
      <Modal
        open={showReauthModal}
        onClose={() => {}} // Force user to act
        title="Permissions Update Required"
        primaryAction={{
            content: "Update Permissions",
            onAction: () => {
                // Force redirect to auth login to ensure fresh scopes
                const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
                window.open(`/auth/login?shop=${shopDomain}`, "_top");
            }
        }}
      >
        <Modal.Section>
            <BlockStack gap="400">
                <Banner tone="critical">
                    <p>The app is missing required permissions to modify your theme.</p>
                </Banner>
                <Text as="p">
                    To install sections, Shopi Section needs the <b>write_themes</b> permission.
                    Please click the button below to grant these permissions.
                </Text>
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                        <Text variant="headingSm" as="h4">Diagnostic Info:</Text>
                        <Text variant="bodyXs" as="p">Required: {requiredScopes.join(", ")}</Text>
                        <Text variant="bodyXs" as="p">Current: {currentScopesRaw}</Text>
                    </BlockStack>
                </Box>
            </BlockStack>
        </Modal.Section>
      </Modal>

    </Page>
    </Frame>
  );
}
