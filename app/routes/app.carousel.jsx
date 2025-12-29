import { useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// 1. Loader: Fetch existing carousel data from Metafields
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Define the Metafield namespace and key
  // Namespace: "shopi_section", Key: "carousel_data"
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

  let carouselData = [];
  if (metafieldValue) {
    try {
      carouselData = JSON.parse(metafieldValue);
    } catch (e) {
      console.error("Error parsing metafield JSON", e);
    }
  }

  return json({ carouselData });
};

// 2. Action: Save updated carousel data to Metafields
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const carouselJson = formData.get("carouselJson");

  // Use metafieldsSet to save data
  // We save it to the App Installation (so it's global for the shop)
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
  const [slides, setSlides] = useState(initialData || []);
  const submit = useSubmit();

  const addSlide = () => {
    setSlides([...slides, { title: "", subtitle: "", imageUrl: "", link: "" }]);
  };

  const removeSlide = (index) => {
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
  };

  const updateSlide = (index, field, value) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setSlides(newSlides);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("carouselJson", JSON.stringify(slides));
    submit(formData, { method: "post" });
  };

  return (
    <Page title="3D Carousel Builder" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          <Banner title="How this works" tone="info">
            <p>
              Add slides here. The data will be saved to your store's Metafields.
              Your 3D Carousel section can then read this data automatically if you enable "Use App Data" in the Theme Editor.
            </p>
          </Banner>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Manage Slides
              </Text>
              
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
                  No slides added yet. Click "Add Slide" to start.
                </Text>
              )}

              <Divider />
              
              <InlineStack align="end" gap="300">
                <Button onClick={addSlide}>Add Slide</Button>
                <Button variant="primary" onClick={handleSave}>Save Carousel Data</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
