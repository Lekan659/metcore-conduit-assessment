import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SaveToCollection from "./SaveToCollection";
import Article from "../../routes/Article/Article";
import { useAuth } from "../../context/AuthContext";
import { getCollections, addArticleToCollection } from "../../services/collections";
import getArticle from "../../services/getArticle";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../services/collections", () => ({ getCollections: vi.fn(), addArticleToCollection: vi.fn() }));
vi.mock("../../services/getArticle", () => ({ default: vi.fn() }));
const headers = { Authorization: "Token owner" };
const account = { headers, isAuth: true, loggedUser: { username: "owner" } };
const lists = { collections: [{ id: 7, name: "Read later" }, { id: 8, name: "Learning" }], collectionsCount: 2 };
const failure = (status, message) => Object.assign(new Error(message), { status });

function tree(slug = "react-basics") {
  return (
    <MemoryRouter initialEntries={["/article/react-basics"]}>
      <Routes>
        <Route path="/article/:slug" element={<SaveToCollection slug={slug} />} />
        <Route path="/login" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>
  );
}
const view = () => render(tree());
async function open(user) {
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  return screen.findByRole("combobox", { name: "Choose a collection" });
}
beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue(account);
  getCollections.mockResolvedValue(lists);
  addArticleToCollection.mockResolvedValue({ message: "Article added to collection" });
});
afterEach(cleanup);

test("signed-out readers see a sign-in link and make no collection requests", () => {
  useAuth.mockReturnValue({ ...account, isAuth: false });
  view();
  expect(screen.getByRole("link", { name: "Sign in to save articles to a collection" })).toHaveAttribute("href", "/login");
  expect(getCollections).not.toHaveBeenCalled();
});

test("loads only when opened and requires an explicit collection choice", async () => {
  const user = userEvent.setup();
  let resolve;
  getCollections.mockReturnValue(new Promise((done) => { resolve = done; }));
  view();
  expect(getCollections).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  expect(screen.getByText("Loading collections…")).toBeInTheDocument();
  await act(async () => resolve(lists));
  expect(screen.getByRole("button", { name: "Save article" })).toBeDisabled();
  expect(getCollections).toHaveBeenCalledWith({ headers, page: 0, limit: 3 });
});

test("saves the chosen collection and prevents repeat submits while pending", async () => {
  const user = userEvent.setup();
  let resolve;
  addArticleToCollection.mockReturnValue(new Promise((done) => { resolve = done; }));
  view();
  await user.selectOptions(await open(user), "7");
  await user.click(screen.getByRole("button", { name: "Save article" }));
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close collection picker" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Saving…" }));
  expect(addArticleToCollection).toHaveBeenCalledExactlyOnceWith({ headers, id: 7, articleSlug: "react-basics" });
  await act(async () => resolve({ message: "Article added to collection" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Saved to “Read later”.");
  expect(screen.getByRole("link", { name: "View collection" })).toHaveAttribute("href", "/collections/7");
});

test.each([
  [409, "Article is already in this collection"],
  [404, "Collection not found"],
  [500, "Could not save article"],
  [undefined, "Could not connect to the server"],
])("save failure %s is displayed without false success and allows another choice", async (status, message) => {
  const user = userEvent.setup();
  addArticleToCollection.mockRejectedValue(failure(status, message));
  view();
  await user.selectOptions(await open(user), "7");
  await user.click(screen.getByRole("button", { name: "Save article" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.queryByRole("link", { name: "View collection" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save article" })).toBeEnabled();
  await user.selectOptions(screen.getByRole("combobox"), "8");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("users without collections get a link to create one", async () => {
  const user = userEvent.setup();
  getCollections.mockResolvedValue({ collections: [], collectionsCount: 0 });
  view();
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  expect(await screen.findByRole("link", { name: "Create a collection" })).toHaveAttribute("href", "/collections");
  expect(screen.queryByRole("button", { name: "Save article" })).not.toBeInTheDocument();
});

test("collection loading errors offer retry", async () => {
  const user = userEvent.setup();
  getCollections.mockRejectedValueOnce(new Error("Could not load collections"));
  view();
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load collections");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("combobox")).toBeInTheDocument();
});

test("later pages are reachable and changing page clears the selection", async () => {
  const user = userEvent.setup();
  getCollections.mockResolvedValueOnce({ ...lists, collectionsCount: 4 });
  view();
  await user.selectOptions(await open(user), "7");
  getCollections.mockResolvedValue({ collections: [{ id: 10, name: "Last collection" }], collectionsCount: 4 });
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByRole("option", { name: "Last collection" });
  expect(getCollections).toHaveBeenLastCalledWith({ headers, page: 1, limit: 3 });
  expect(screen.getByRole("button", { name: "Save article" })).toBeDisabled();
  await user.selectOptions(screen.getByRole("combobox"), "10");
  await user.click(screen.getByRole("button", { name: "Save article" }));
  expect(addArticleToCollection).toHaveBeenCalledWith({ headers, id: 10, articleSlug: "react-basics" });
});

test("closing ignores an old list response and reopening fetches fresh collections", async () => {
  const user = userEvent.setup();
  let resolve;
  getCollections.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  view();
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  await user.click(screen.getByRole("button", { name: "Close collection picker" }));
  getCollections.mockResolvedValue({ collections: [], collectionsCount: 0 });
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  await screen.findByRole("link", { name: "Create a collection" });
  await act(async () => resolve(lists));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

test.each(["list", "save"])("expired authentication during %s redirects to login", async (operation) => {
  const user = userEvent.setup();
  if (operation === "list") getCollections.mockRejectedValue(failure(401, "Sign in"));
  else addArticleToCollection.mockRejectedValue(failure(401, "Sign in"));
  view();
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  if (operation === "save") {
    await user.selectOptions(await screen.findByRole("combobox"), "7");
    await user.click(screen.getByRole("button", { name: "Save article" }));
  }
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
});

test.each(["account", "article"])("changing the %s resets the picker and ignores previous requests", async (change) => {
  const user = userEvent.setup();
  let resolve;
  getCollections.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const rendered = view();
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  if (change === "account") useAuth.mockReturnValue({ ...account, headers: { Authorization: "Token another" }, loggedUser: { username: "another" } });
  rendered.rerender(tree(change === "article" ? "other-article" : "react-basics"));
  await act(async () => resolve(lists));
  expect(screen.getByRole("button", { name: "Save to collection" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

test("the real article page mounts one picker and saves its loaded article slug", async () => {
  const user = userEvent.setup();
  getArticle.mockResolvedValue({ slug: "react-basics", title: "React basics", body: "Article body", tagList: [],
    author: { username: "writer", image: null }, createdAt: "2026-01-01", favoritesCount: 0, favorited: false });
  render(<MemoryRouter initialEntries={["/article/react-basics"]}><Routes>
    <Route path="/article/:slug" element={<Article />} />
  </Routes></MemoryRouter>);
  await screen.findByRole("heading", { name: "React basics" });
  expect(screen.getAllByRole("button", { name: "Save to collection" })).toHaveLength(1);
  await user.selectOptions(await open(user), "8");
  await user.click(screen.getByRole("button", { name: "Save article" }));
  expect(addArticleToCollection).toHaveBeenCalledWith({ headers, id: 8, articleSlug: "react-basics" });
});
