# Collections design note

## Scope and data model

Collections extend the inherited Conduit application without changing its public article, profile or feed APIs. A `Collection` has a required name, optional description and `userId` owner. A `CollectionArticle` joins a collection and article, with a database unique constraint on `(collectionId, articleId)`. Its timestamps record when an article was **saved**, independently of when that article was published. Collection detail orders by save time, then membership ID for stable pagination. Deleting a collection deletes its membership rows, not its articles; deleting an article removes its memberships. The migrations also repair foreign keys missing from the starter schema so a clean database can be migrated and seeded before starting the server. I followed the starter's Sequelize association and `toJSON()` conventions, while excluding `userId` from collection responses.

## API and privacy

All `/api/collections` routes use the existing token middleware. List and create use the authenticated user's ID; detail, edit, delete, add and remove first find the collection by **both** ID and owner ID. A foreign collection and a missing collection therefore produce the same 404, without disclosing another user's data. The server validates names, descriptions and article slugs; collection IDs must be positive integers, page sizes must be 1–100 and page offsets must be non-negative whole numbers. A repeated or concurrent save is rejected by the database constraint and returned as 409. `GET /api/collections` returns the owner's paginated list and total; `GET /api/collections/:id` returns paginated saved articles and total. POST/PUT/DELETE manage collections; POST on `/:id/articles` adds membership and DELETE on `/:id/articles/:slug` removes it. The frontend never acts as the ownership boundary.

The detail query pages membership rows first, then fetches that page's articles and authors together. It returns only the article and author summary fields needed by the view. The owner and `(collectionId, articleId)` indexes support the main access paths. A database-backed test checks that SQL query count does not grow when a page contains three saved articles instead of one, guarding against N+1 regressions.

## Frontend and state

My Collections provides create, list, edit, delete and paginated detail views using the starter's component patterns. It distinguishes loading, empty, success and error states. Mutations refetch affected data; effect-cleanup guards and account-keyed components prevent older requests or private state from appearing after navigation or account changes. The save picker loads collections only when opened.

Readers often decide what to keep while scanning previews, so a compact **Save to collection** control sits directly beneath the existing favourite button, like a bookmark action. The full article page and previews reuse one picker and API flow. Its control sits outside the article link, so opening it does not navigate away; closed pickers make no collection requests. Signed-out readers are linked to login.

Private collection responses use `Cache-Control: private, no-store`. The client does not keep a shared collection cache: mutations refetch affected views, and reopening a picker reloads the collection list. Other browser tabs do not update live. If caching becomes necessary, it must be scoped by user, collection and page, with invalidation after mutations so private data cannot cross accounts.

## Shipping evidence, trade-offs and next steps

Tests cover persistence and uniqueness, authentication and ownership, validation, pagination and N+1 behavior, frontend states, and a browser flow from login through creating a collection, saving from an article preview, viewing and removing the article. GitHub Actions creates a PostgreSQL service, migrates a clean test database, runs tests, builds the frontend and runs E2E tests. The original licence and attribution remain in the repository.

Within the three-day assessment window, I kept the starter's page-number/offset pagination instead of introducing cursor pagination only for Collections. This makes the API and frontend consistent with the inherited application and keeps the change small enough to review. Very deep pages will be slower; if collections grow large, a cursor based on save time and membership ID would be the next step.

The inherited server still calls `sequelize.sync({ alter: true })` at startup. I left it unchanged for this feature, while CI applies migrations before starting the app. With two more days, I would first make deployment safe by removing startup schema alteration and verifying migration rollback; second, inspect query plans and indexes with large collections; third, improve multi-tab refresh and review responsive and keyboard behavior. In production I would monitor collection latency, slow queries, response-code trends and frontend save failures without logging private contents or tokens.
