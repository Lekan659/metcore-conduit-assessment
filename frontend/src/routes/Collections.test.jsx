import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Collections from "./Collections";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { createCollection, getCollections } from "../services/collections";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../services/collections", () => ({ createCollection: vi.fn(), getCollections: vi.fn() }));
const headers = { Authorization: "Token example" };
const account = { isAuth: true, headers, loggedUser: { username: "owner" } };
const empty = { collections: [], collectionsCount: 0 };
const listed = { collections: [{ id: 1, name: "Reading", description: "For the weekend" }], collectionsCount: 1 };

function pageTree() {
  return (
    <MemoryRouter initialEntries={["/collections"]}>
      <Routes>
        <Route path="/collections" element={<Collections />} />
        <Route path="/login" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

function view() {
  return render(pageTree());
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue(account);
  getCollections.mockResolvedValue(empty);
});
afterEach(cleanup);

test("shows loading, then a private collection list", async () => {
  let resolve;
  getCollections.mockReturnValue(new Promise((done) => { resolve = done; }));
  view();
  expect(screen.getByText("Loading collections…")).toBeInTheDocument();
  await act(async () => resolve(listed));
  expect(screen.getByRole("heading", { name: "Reading" })).toBeInTheDocument();
  expect(screen.getByText("For the weekend")).toBeInTheDocument();
  expect(getCollections).toHaveBeenCalledWith({ headers, page: 0, limit: 3 });
});

test("redirects signed-out visitors without requesting private data", async () => {
  useAuth.mockReturnValue({ ...account, isAuth: false });
  view();
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  expect(getCollections).not.toHaveBeenCalled();
});

test("shows the empty state and creates a collection without duplicate submits", async () => {
  const user = userEvent.setup();
  let resolve;
  createCollection.mockReturnValue(new Promise((done) => { resolve = done; }));
  view();
  expect(await screen.findByText(/No collections yet/)).toBeInTheDocument();
  await user.type(screen.getByLabelText("Name"), "  Reading  ");
  await user.type(screen.getByLabelText("Description (optional)"), "  For the weekend  ");
  await user.click(screen.getByRole("button", { name: "Create collection" }));
  expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Creating…" }));
  expect(createCollection).toHaveBeenCalledExactlyOnceWith({ headers, name: "Reading", description: "For the weekend" });
  getCollections.mockResolvedValue(listed);
  await act(async () => resolve({ collection: listed.collections[0] }));
  expect(await screen.findByText("Collection created.")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Reading" })).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toHaveValue("");
});

test("rejects blank names before sending a request", async () => {
  const user = userEvent.setup();
  view();
  await user.type(screen.getByLabelText("Name"), "   ");
  await user.click(screen.getByRole("button", { name: "Create collection" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Enter a collection name.");
  expect(createCollection).not.toHaveBeenCalled();
});

test("keeps form input and displays server errors when creation fails", async () => {
  const user = userEvent.setup();
  createCollection.mockRejectedValue(new Error("Collection name must not exceed 100 characters"));
  view();
  await user.type(screen.getByLabelText("Name"), "Reading");
  await user.click(screen.getByRole("button", { name: "Create collection" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Collection name must not exceed 100 characters");
  expect(screen.getByLabelText("Name")).toHaveValue("Reading");
  expect(screen.getByRole("button", { name: "Create collection" })).toBeEnabled();
});

test("failed lists show an error and support retry instead of a false empty state", async () => {
  const user = userEvent.setup();
  getCollections.mockRejectedValueOnce(new Error("Could not connect to the server"));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not connect");
  expect(screen.queryByText(/No collections yet/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/No collections yet/)).toBeInTheDocument();
});

test("pagination requests the next page and creating returns to page zero", async () => {
  const user = userEvent.setup();
  getCollections.mockResolvedValue({ ...listed, collectionsCount: 4 });
  view();
  await screen.findByRole("heading", { name: "Reading" });
  getCollections.mockResolvedValue({ collections: [{ id: 4, name: "Last collection" }], collectionsCount: 4 });
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(await screen.findByRole("heading", { name: "Last collection" })).toBeInTheDocument();
  expect(getCollections).toHaveBeenLastCalledWith({ headers, page: 1, limit: 3 });
  createCollection.mockResolvedValue({ collection: { id: 5, name: "Newest" } });
  getCollections.mockResolvedValue({ collections: [{ id: 5, name: "Newest" }], collectionsCount: 5 });
  await user.type(screen.getByLabelText("Name"), "Newest");
  await user.click(screen.getByRole("button", { name: "Create collection" }));
  expect(await screen.findByRole("heading", { name: "Newest" })).toBeInTheDocument();
  expect(getCollections).toHaveBeenLastCalledWith({ headers, page: 0, limit: 3 });
});

test.each(["list", "create"])("redirects to login when the %s request returns 401", async (operation) => {
  const error = Object.assign(new Error("You need to login first!"), { status: 401 });
  if (operation === "list") getCollections.mockRejectedValue(error);
  else createCollection.mockRejectedValue(error);
  view();
  if (operation === "create") {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Reading");
    await user.click(screen.getByRole("button", { name: "Create collection" }));
  }
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
});

test("late requests from another account do not reveal its collection list", async () => {
  let resolve;
  getCollections.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const rendered = view();
  useAuth.mockReturnValue({ ...account, headers: { Authorization: "Token other" }, loggedUser: { username: "other" } });
  getCollections.mockResolvedValue(empty);
  rendered.rerender(pageTree());
  await screen.findByText(/No collections yet/);
  await act(async () => resolve(listed));
  expect(screen.queryByRole("heading", { name: "Reading" })).not.toBeInTheDocument();
});

test("navigation offers My Collections only when signed in", () => {
  const rendered = render(<MemoryRouter><Navbar /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "My Collections" })).toHaveAttribute("href", "/collections");
  useAuth.mockReturnValue({ ...account, isAuth: false });
  rendered.rerender(<MemoryRouter><Navbar /></MemoryRouter>);
  expect(screen.queryByRole("link", { name: "My Collections" })).not.toBeInTheDocument();
});
