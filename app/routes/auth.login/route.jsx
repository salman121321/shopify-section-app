import { useState } from "react";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  // Hardcoded fallback to ensure scopes are ALWAYS requested correctly, even if Env Var fails
  const envScopes = process.env.SCOPES || "write_products,read_themes,write_themes";
  const scopes = envScopes.split(",").map(s => s.trim());
  
  console.log("Initiating login with scopes:", scopes);
  
  const errors = loginErrorMessage(await login(request, { scopes }));

  return { errors, polarisTranslations };
};

export const action = async ({ request }) => {
  const envScopes = process.env.SCOPES || "write_products,read_themes,write_themes";
  const scopes = envScopes.split(",").map(s => s.trim());
  
  const errors = loginErrorMessage(await login(request, { scopes }));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <PolarisAppProvider i18n={loaderData.polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="example.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={errors.shop}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}
