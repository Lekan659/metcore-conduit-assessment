const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");

test("a user creates, edits, saves from an article preview, removes from and deletes a private collection", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const username = `browser-${suffix}`;
  const collectionName = `Read later ${suffix}`;
  const editedName = `Weekend reading ${suffix}`;
  const articleTitle = `Collection article ${suffix}`;

  await page.goto("/#/register");
  await page.getByPlaceholder("Your Name").fill(username);
  await page.getByPlaceholder("Email").fill(`${username}@example.test`);
  await page.getByPlaceholder("Password").fill("browser-test-password");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("link", { name: "My Collections" })).toBeVisible();

  await page.locator(".nav-item.dropdown .dropdown-toggle").click();
  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByPlaceholder("Email").fill(`${username}@example.test`);
  await page.getByPlaceholder("Password").fill("browser-test-password");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("link", { name: "My Collections" })).toBeVisible();

  await page.getByRole("link", { name: "My Collections" }).click();
  await expect(page.getByText("No collections yet. Create your first collection above.")).toBeVisible();
  await page.getByLabel("Name").fill(collectionName);
  await page.getByLabel("Description (optional)").fill("Articles for later");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Collection created." })).toBeVisible();
  await page.getByRole("link", { name: collectionName }).click();
  await expect(page.getByRole("heading", { name: collectionName })).toBeVisible();
  await expect(page.getByText("No saved articles yet.")).toBeVisible();

  await page.getByRole("button", { name: "Edit collection" }).click();
  await page.getByLabel("Name").fill(editedName);
  await page.getByLabel("Description (optional)").fill("Old and new articles");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: editedName })).toBeVisible();
  await expect(page.getByText("Old and new articles")).toBeVisible();

  await page.getByRole("link", { name: "New Article" }).click();
  await page.getByPlaceholder("Article Title").fill(articleTitle);
  await page.getByPlaceholder("What's this article about?").fill("A browser test article");
  await page.getByPlaceholder("Write your article (in markdown)").fill("Article body");
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(page.getByRole("heading", { name: articleTitle })).toBeVisible();

  await page.goto(`/#/profile/${username}`);
  const preview = page.getByRole("link", { name: articleTitle }).locator("..");
  await preview.getByRole("button", { name: "Save to collection" }).click();
  await preview.getByLabel("Choose a collection").selectOption({ label: editedName });
  await preview.getByRole("button", { name: "Save article" }).click();
  await expect(preview.getByRole("status").filter({ hasText: `Saved to “${editedName}”.` })).toBeVisible();
  await preview.getByRole("link", { name: "View collection" }).click();
  await expect(page.getByRole("heading", { name: "Saved articles (1)" })).toBeVisible();
  await expect(page.getByRole("link", { name: articleTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: username }).last()).toBeVisible();

  await page.getByRole("button", { name: `Remove ${articleTitle} from collection` }).click();
  await expect(page.getByRole("heading", { name: "Saved articles (0)" })).toBeVisible();
  await expect(page.getByText("No saved articles yet.")).toBeVisible();

  await page.getByRole("button", { name: "Delete collection" }).click();
  await expect(page.getByText(`Delete “${editedName}”? The articles themselves will remain available.`)).toBeVisible();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("heading", { name: "My Collections" })).toBeVisible();
  await expect(page.getByText("Collection deleted.")).toBeVisible();
  await expect(page.getByText("No collections yet. Create your first collection above.")).toBeVisible();

  // Deleting a collection must not delete the article itself.
  await page.goto(`/#/profile/${username}`);
  await expect(page.getByRole("link", { name: articleTitle })).toBeVisible();
});
