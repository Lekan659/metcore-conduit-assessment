import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Collection from "./Collection";
import Collections from "./Collections";
import { useAuth } from "../context/AuthContext";
import { getCollection, getCollections, updateCollection, deleteCollection, removeArticleFromCollection } from "../services/collections";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../services/collections", () => ({
  getCollection: vi.fn(), getCollections: vi.fn(), createCollection: vi.fn(),
  updateCollection: vi.fn(), deleteCollection: vi.fn(), removeArticleFromCollection: vi.fn(),
}));
const headers = { Authorization: "Token owner" };
const account = { isAuth: true, headers, loggedUser: { username: "owner" } };
const collection = { id: 7, name: "Read later", description: "Weekend reading" };
const article = { slug: "react-basics", title: "React basics", description: "An introduction", author: { username: "writer", image: null, bio: null } };
const detail = { collection, articles: [article], articlesCount: 1 };
const failure = (status, message = "Request failed") => Object.assign(new Error(message), { status });

function ArticleDestination() {
  const { state } = useLocation();
  return <p>Article navigation state: {JSON.stringify(state)}</p>;
}
function tree() {
  return (
    <MemoryRouter initialEntries={["/collections/7"]}>
      <Routes>
        <Route path="/collections/:id" element={<Collection />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/login" element={<h1>Sign in</h1>} />
        <Route path="/article/:slug" element={<ArticleDestination />} />
      </Routes>
    </MemoryRouter>
  );
}
function view() { return render(tree()); }

beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue(account);
  getCollection.mockResolvedValue(detail);
  getCollections.mockResolvedValue({ collections: [], collectionsCount: 0 });
});
afterEach(cleanup);

test("loads the saved summaries and author, and article links do not pass partial state", async () => {
  const user = userEvent.setup();
  view();
  expect(screen.getByText("Loading collection…")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Read later" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /writer/ })).toHaveAttribute("href", "/profile/writer");
  expect(screen.getByText("An introduction")).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: /React basics/ }));
  expect(screen.getByText("Article navigation state: null")).toBeInTheDocument();
});

test("editing updates the name and can clear the description", async () => {
  const user = userEvent.setup();
  let resolve;
  updateCollection.mockReturnValue(new Promise((done) => { resolve = done; }));
  view();
  await user.click(await screen.findByRole("button", { name: "Edit collection" }));
  expect(screen.getByLabelText("Name")).toHaveValue("Read later");
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "  Learning  ");
  await user.clear(screen.getByLabelText("Description (optional)"));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(updateCollection).toHaveBeenCalledExactlyOnceWith({ headers, id: 7, name: "Learning", description: null });
  await act(async () => resolve({ collection: { ...collection, name: "Learning", description: null } }));
  expect(await screen.findByRole("heading", { name: "Learning" })).toBeInTheDocument();
  expect(screen.getByText("Collection updated.")).toBeInTheDocument();
  expect(screen.queryByText("Weekend reading")).not.toBeInTheDocument();
});

test("edit rejects blank names, preserves failed input, and cancel discards changes", async () => {
  const user = userEvent.setup();
  updateCollection.mockRejectedValue(failure(422, "Cannot save these changes"));
  view();
  await user.click(await screen.findByRole("button", { name: "Edit collection" }));
  await user.clear(screen.getByLabelText("Name"));
  await user.type(screen.getByLabelText("Name"), "   ");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a collection name.");
  expect(updateCollection).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Name"), "New name");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Cannot save these changes");
  expect(screen.getByLabelText("Name")).toHaveValue("   New name");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("heading", { name: "Read later" })).toBeInTheDocument();
});

test("delete requires confirmation, supports cancellation, then returns to a refreshed list", async () => {
  const user = userEvent.setup();
  let resolve;
  deleteCollection.mockReturnValue(new Promise((done) => { resolve = done; }));
  view();
  await user.click(await screen.findByRole("button", { name: "Delete collection" }));
  expect(deleteCollection).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(deleteCollection).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Delete collection" }));
  await user.click(screen.getByRole("button", { name: "Confirm delete" }));
  expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  await act(async () => resolve(""));
  expect(await screen.findByRole("heading", { name: "My Collections" })).toBeInTheDocument();
  expect(screen.getByText("Collection deleted.")).toBeInTheDocument();
  expect(deleteCollection).toHaveBeenCalledExactlyOnceWith({ headers, id: 7 });
  await screen.findByText(/No collections yet/);
});

test("delete failure leaves the collection available and allows retry", async () => {
  const user = userEvent.setup();
  deleteCollection.mockRejectedValue(failure(500, "Could not delete collection"));
  view();
  await user.click(await screen.findByRole("button", { name: "Delete collection" }));
  await user.click(screen.getByRole("button", { name: "Confirm delete" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete collection");
  expect(screen.getByRole("button", { name: "Confirm delete" })).toBeEnabled();
  expect(screen.getByRole("heading", { name: "Read later" })).toBeInTheDocument();
});

test("removing the last article on a page reloads the previous page", async () => {
  const user = userEvent.setup();
  getCollection.mockResolvedValueOnce({ ...detail, articlesCount: 4 });
  view();
  await screen.findByRole("heading", { name: "Read later" });
  getCollection.mockResolvedValueOnce({ ...detail, articlesCount: 4 });
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByRole("heading", { name: "Saved articles (4)" });
  expect(getCollection).toHaveBeenLastCalledWith({ headers, id: "7", page: 1, limit: 3 });
  removeArticleFromCollection.mockResolvedValue("");
  getCollection.mockResolvedValueOnce({ collection, articles: [], articlesCount: 3 });
  getCollection.mockResolvedValueOnce({ ...detail, articlesCount: 3 });
  await user.click(screen.getByRole("button", { name: "Remove React basics from collection" }));
  await waitFor(() => expect(getCollection).toHaveBeenLastCalledWith({ headers, id: "7", page: 0, limit: 3 }));
  expect(await screen.findByRole("heading", { name: "Saved articles (3)" })).toBeInTheDocument();
  expect(screen.getByText("Article removed from collection.")).toBeInTheDocument();
  expect(removeArticleFromCollection).toHaveBeenCalledWith({ headers, id: 7, slug: article.slug });
});

test("failed removal does not hide the article", async () => {
  const user = userEvent.setup();
  removeArticleFromCollection.mockRejectedValue(failure(500, "Could not remove article"));
  view();
  await user.click(await screen.findByRole("button", { name: "Remove React basics from collection" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not remove article");
  expect(screen.getByRole("link", { name: /React basics/ })).toBeInTheDocument();
});

test("empty collections and inaccessible collections have distinct states", async () => {
  getCollection.mockResolvedValue({ collection, articles: [], articlesCount: 0 });
  const rendered = view();
  expect(await screen.findByText("No saved articles yet.")).toBeInTheDocument();
  rendered.unmount();
  getCollection.mockRejectedValue(failure(404));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent("Collection not found or unavailable.");
  expect(screen.queryByRole("button", { name: "Edit collection" })).not.toBeInTheDocument();
});

test("detail load errors offer retry", async () => {
  const user = userEvent.setup();
  getCollection.mockRejectedValueOnce(failure(500, "Could not load collection"));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load collection");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Read later" })).toBeInTheDocument();
});

test.each(["detail", "edit", "delete", "remove"])("%s redirects to login on 401", async (operation) => {
  const user = userEvent.setup();
  const error = failure(401);
  if (operation === "detail") getCollection.mockRejectedValue(error);
  if (operation === "edit") updateCollection.mockRejectedValue(error);
  if (operation === "delete") deleteCollection.mockRejectedValue(error);
  if (operation === "remove") removeArticleFromCollection.mockRejectedValue(error);
  view();
  if (operation === "edit") {
    await user.click(await screen.findByRole("button", { name: "Edit collection" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
  }
  if (operation === "delete") {
    await user.click(await screen.findByRole("button", { name: "Delete collection" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
  }
  if (operation === "remove") await user.click(await screen.findByRole("button", { name: "Remove React basics from collection" }));
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
});

test("signed-out users never request collection details", async () => {
  useAuth.mockReturnValue({ ...account, isAuth: false });
  view();
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  expect(getCollection).not.toHaveBeenCalled();
});
