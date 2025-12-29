import { useState, useEffect } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  BlockStack,
  Box,
  Text,
  Banner,
  InlineStack,
  Divider,
  Select,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// 1. Loader: Fetch existing carousel data from Metafields
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getCarouselData {
      currentAppInstallation {
        metafield(namespace: "shopi_section", key: "carousel_data") {
          value
        }
      }
    }`
  );

  const responseJson = await response.json();
  const metafieldValue = responseJson.data?.currentAppInstallation?.metafield?.value;

  let carouselData = {};
  if (metafieldValue) {
    try {
      const parsed = JSON.parse(metafieldValue);
      // Ensure backwards compatibility or new format
      if (Array.isArray(parsed)) {
        carouselData = { "default": parsed };
      } else {
        carouselData = parsed;
      }
    } catch (e) {
      console.error("Error parsing metafield JSON", e);
    }
  } else {
    carouselData = { "default": [] };
  }

  return json({ carouselData });
};

// 2. Action: Save updated carousel data to Metafields
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const carouselJson = formData.get("carouselJson");

  const response = await admin.graphql(
    `#graphql
    mutation CreateCarouselMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          key
          namespace
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            namespace: "shopi_section",
            key: "carousel_data",
            type: "json",
            value: carouselJson,
            ownerId: (await admin.graphql(`{ currentAppInstallation { id } }`).then(r => r.json())).data.currentAppInstallation.id
          }
        ]
      },
    }
  );

  const responseJson = await response.json();
  
  if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
    return json({ status: "error", errors: responseJson.data.metafieldsSet.userErrors });
  }

  return json({ status: "success" });
};

export default function CarouselBuilder() {
  const { carouselData: initialData } = useLoaderData();
  const [allCarousels, setAllCarousels] = useState(initialData);
  const [selectedCarouselId, setSelectedCarouselId] = useState("default");
  const [newCarouselId, setNewCarouselId] = useState("");
  const [slides, setSlides] = useState(initialData["default"] || []);
  const submit = useSubmit();

  // Update slides when selected carousel changes
  useEffect(() => {
    setSlides(allCarousels[selectedCarouselId] || []);
  }, [selectedCarouselId, allCarousels]);

  const addSlide = () => {
    const updatedSlides = [...slides, { title: "", subtitle: "", imageUrl: "", link: "" }];
    setSlides(updatedSlides);
    updateAllCarousels(selectedCarouselId, updatedSlides);
  };

  const removeSlide = (index) => {
    const updatedSlides = slides.filter((_, i) => i !== index);
    setSlides(updatedSlides);
    updateAllCarousels(selectedCarouselId, updatedSlides);
  };

  const updateSlide = (index, field, value) => {
    const updatedSlides = [...slides];
    updatedSlides[index] = { ...updatedSlides[index], [field]: value };
    setSlides(updatedSlides);
    updateAllCarousels(selectedCarouselId, updatedSlides);
  };

  const updateAllCarousels = (id, currentSlides) => {
    setAllCarousels(prev => ({
      ...prev,
      [id]: currentSlides
    }));
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("carouselJson", JSON.stringify(allCarousels));
    submit(formData, { method: "post" });
  };

  const handleCreateCarousel = () => {
    if (newCarouselId && !allCarousels[newCarouselId]) {
      setAllCarousels(prev => ({
        ...prev,
        [newCarouselId]: []
      }));
      setSelectedCarouselId(newCarouselId);
      setNewCarouselId("");
    }
  };

  const carouselOptions = Object.keys(allCarousels).map(key => ({ label: key, value: key }));

  return (
    <Page title="3D Carousel Builder" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          <Banner title="How to use" tone="info">
            <p>
              1. Create a "Carousel Group" (e.g., 'homepage', 'product-page').<br/>
              2. Add slides to that group.<br/>
              3. In the Theme Editor, enter the Group ID in the "Carousel ID" setting.
            </p>
          </Banner>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Select Carousel Group</Text>
              <InlineStack gap="300" align="start" blockAlign="end">
                <Box minWidth="200px">
                  <Select
                    label="Active Group"
                    options={carouselOptions}
                    value={selectedCarouselId}
                    onChange={setSelectedCarouselId}
                  />
                </Box>
                <Box minWidth="200px">
                    <TextField
                        label="New Group ID"
                        value={newCarouselId}
                        onChange={setNewCarouselId}
                        placeholder="e.g. summer-sale"
                        autoComplete="off"
                        connectedRight={<Button onClick={handleCreateCarousel}>Create</Button>}
                    />
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                    Editing: {selectedCarouselId}
                </Text>
                <Button variant="primary" onClick={handleSave}>Save All Changes</Button>
              </InlineStack>
              
              <Divider />

              {slides.map((slide, index) => (
                <Box key={index} background="bg-surface-secondary" padding="400" borderRadius="200">
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="headingSm" as="h3">Slide {index + 1}</Text>
                      <Button tone="critical" onClick={() => removeSlide(index)} variant="plain">Remove</Button>
                    </InlineStack>
                    
                    <TextField
                      label="Title"
                      value={slide.title}
                      onChange={(value) => updateSlide(index, "title", value)}
                      autoComplete="off"
                    />
                    <TextField
                      label="Subtitle / Price"
                      value={slide.subtitle}
                      onChange={(value) => updateSlide(index, "subtitle", value)}
                      autoComplete="off"
                    />
                    <TextField
                      label="Image URL"
                      value={slide.imageUrl}
                      onChange={(value) => updateSlide(index, "imageUrl", value)}
                      autoComplete="off"
                      helpText="Paste a direct link to an image (e.g. from Shopify Files)"
                    />
                    <TextField
                      label="Link URL (Optional)"
                      value={slide.link}
                      onChange={(value) => updateSlide(index, "link", value)}
                      autoComplete="off"
                    />
                  </BlockStack>
                </Box>
              ))}

              {slides.length === 0 && (
                <Text tone="subdued" as="p" alignment="center">
                  No slides in this group. Click "Add Slide" to start.
                </Text>
              )}

              <Divider />
              
              <InlineStack align="end" gap="300">
                <Button onClick={addSlide}>Add Slide</Button>
                <Button variant="primary" onClick={handleSave}>Save All Changes</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
