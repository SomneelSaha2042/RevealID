import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const issuerEmail = "issuer@demo-university.edu";
const issuerPassword = "DemoIssuerPass123!";
const holderPassword = "DemoHolderPass123!";

const uniqueHolder = () => `holder-${Date.now()}-${Math.random().toString(16).slice(2)}@example.edu`;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function registerHolder(page: Page, holderEmail: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Holder");
  await page.getByLabel("Email").fill(holderEmail);
  await page.getByLabel("Password").fill(holderPassword);
  await page.getByRole("button", { name: "Create holder account" }).click();
  await expect(page).toHaveURL(/\/wallet/);
}

async function issueCredential(page: Page, holderEmail: string) {
  await signIn(page, issuerEmail, issuerPassword);
  await expect(page).toHaveURL(/\/issuer\/issue/);
  await page.getByLabel("Holder email").fill(holderEmail);
  await page.getByLabel("Degree").fill("BSc Computer Science");
  await page.getByLabel("Graduation year").fill("2026");
  await page.getByLabel("CGPA").fill("4.72");
  await page.getByLabel("Marks").fill("9120");
  await page.getByRole("button", { name: "Issue credential" }).click();
  await expect(page.getByText("Credential issued to holder wallet.")).toBeVisible();
}

async function createSelectiveShare(page: Page, holderEmail: string) {
  await signIn(page, holderEmail, holderPassword);
  await expect(page).toHaveURL(/\/wallet/);
  await expect(page.getByText("RevealIDAcademicCredential").first()).toBeVisible();
  await page.getByRole("link", { name: "Share", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Share credential" })).toBeVisible();

  await expect(page.getByLabel("Degree")).toBeChecked();
  await expect(page.getByLabel("Graduation year")).toBeChecked();
  await expect(page.getByLabel("CGPA")).not.toBeChecked();
  await expect(page.getByLabel("Marks")).not.toBeChecked();

  await page.getByRole("button", { name: "Create secure share" }).click();
  await expect(page.getByRole("heading", { name: "Verification link" })).toBeVisible();

  const href = await page.locator(".share-result a").getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}

test("issuer issues, holder selectively shares, verifier sees a verified report", async ({ page }) => {
  const holderEmail = uniqueHolder();

  await registerHolder(page, holderEmail);
  await signOut(page);
  await issueCredential(page, holderEmail);
  await signOut(page);
  const verificationUrl = await createSelectiveShare(page, holderEmail);

  await page.goto(verificationUrl);
  await expect(page.getByText("Cryptographically Verified")).toBeVisible();
  await expect(page.getByText("BSc Computer Science")).toBeVisible();
  await expect(page.locator("dd", { hasText: "2026" })).toBeVisible();
  await expect(page.getByText("Issuer signature verified")).toBeVisible();
  await expect(page.getByText("Holder key binding verified")).toBeVisible();
});

test("privacy path never renders hidden CGPA or marks in the verifier", async ({ page }) => {
  const holderEmail = uniqueHolder();

  await registerHolder(page, holderEmail);
  await signOut(page);
  await issueCredential(page, holderEmail);
  await signOut(page);
  const verificationUrl = await createSelectiveShare(page, holderEmail);

  await page.goto(verificationUrl);
  await expect(page.getByText("Cryptographically Verified")).toBeVisible();
  await expect(page.getByText("Degree")).toBeVisible();
  await expect(page.getByText("Graduation year")).toBeVisible();
  await expect(page.getByText("CGPA")).toHaveCount(0);
  await expect(page.getByText("cgpa")).toHaveCount(0);
  await expect(page.getByText("Marks")).toHaveCount(0);
  await expect(page.getByText("marks")).toHaveCount(0);
  await expect(page.getByText("4.72")).toHaveCount(0);
  await expect(page.getByText("9120")).toHaveCount(0);
});

test("holder imports OpenCerts, derives a wallet credential, and shares selected claims only", async ({ page }) => {
  test.setTimeout(120_000);
  const holderEmail = uniqueHolder();

  await registerHolder(page, holderEmail);
  await page.goto("/wallet/import");
  await expect(page.getByLabel("OpenCerts file")).toBeEnabled();
  await page.getByLabel("Verification").selectOption("OPENCERTS_API");
  await page
    .getByLabel("OpenCerts file")
    .setInputFiles(path.join(process.cwd(), "samples", "opencerts", "sepolia.opencert"));
  await expect(page.getByLabel("Document JSON")).not.toHaveValue("");
  await expect(page.getByRole("button", { name: "Verify source" })).toBeEnabled();
  await page.getByRole("button", { name: "Verify source" }).click();
  await expect(page.getByRole("heading", { name: "Verified source" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Hidden by Default")).toBeVisible();
  await expect(page.getByText("academicCredential.transcript")).toBeVisible();
  await page.getByRole("button", { name: "Store in wallet" }).click();
  await expect(page.getByRole("link", { name: "Open credential" })).toBeVisible();
  await page.getByRole("link", { name: "Open credential" }).click();

  await expect(page.getByRole("heading", { name: "Share credential" })).toBeVisible();
  await expect(page.getByText("Source verified")).toBeVisible();
  await expect(page.getByLabel("Recipient")).toBeChecked();
  await expect(page.getByLabel("Institution")).toBeChecked();
  await expect(page.getByLabel("Course")).toBeChecked();
  await expect(page.getByLabel("Graduation date")).toBeChecked();
  await page.getByRole("button", { name: "Create secure share" }).click();
  await expect(page.getByRole("heading", { name: "Verification link" })).toBeVisible();

  const href = await page.locator(".share-result a").getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByText("Cryptographically Verified")).toBeVisible();
  await expect(page.getByText("Recipient")).toBeVisible();
  await expect(page.getByText("Your Name")).toBeVisible();
  await expect(page.getByText("Course")).toBeVisible();
  await expect(page.getByText("OpenCerts Demo")).toBeVisible();
  await expect(page.getByText("Credential", { exact: true })).toHaveCount(0);
  await expect(page.getByText("A+")).toHaveCount(0);
  await expect(page.getByText("123456")).toHaveCount(0);
  await expect(page.getByText("001")).toHaveCount(0);
});

test("security failure path shows revoked credentials as invalid", async ({ page }) => {
  const holderEmail = uniqueHolder();

  await registerHolder(page, holderEmail);
  await signOut(page);
  await issueCredential(page, holderEmail);
  await signOut(page);
  const verificationUrl = await createSelectiveShare(page, holderEmail);
  await signOut(page);

  await signIn(page, issuerEmail, issuerPassword);
  await expect(page).toHaveURL(/\/issuer\/issue/);
  const issuedCredential = page.getByTestId("issued-credential-row").filter({ hasText: holderEmail }).first();
  await expect(issuedCredential).toBeVisible();
  await issuedCredential.getByRole("button", { name: "Revoke" }).click();
  await expect(issuedCredential.getByText("Revoked")).toBeVisible();

  await page.goto(verificationUrl);
  await expect(page.getByText("Verification Failed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revoked Credential" })).toBeVisible();
});
