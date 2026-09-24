import axios from "axios";


async function request(options) {
  try {
    const { data } = await axios(options);
    return data;
  } catch (error) {
    const message = error.response?.data?.errors?.body?.[0];
    const failure = new Error(
      typeof message === "string"
        ? message
        : error.response
          ? "Could not complete the collection request. Please try again."
          : "Could not connect to the server. Please try again.",
    );
    failure.status = error.response?.status;
    throw failure;
  }
}

export function getCollections({ headers, page = 0, limit = 3 }) {
  return request({
    url: "/api/collections",
    headers,
    params: { limit, offset: page },
  });
}

export function getCollection({ headers, id, page = 0, limit = 3 }) {
  return request({
    url: `/api/collections/${encodeURIComponent(id)}`,
    headers,
    params: { limit, offset: page },
  });
}

export function createCollection({ headers, name, description }) {
  return request({
    url: "/api/collections",
    method: "POST",
    headers,
    data: { collection: { name, description } },
  });
}

export function updateCollection({ headers, id, name, description }) {
  return request({
    url: `/api/collections/${encodeURIComponent(id)}`,
    method: "PUT",
    headers,
    data: { collection: { name, description } },
  });
}

export function deleteCollection({ headers, id }) {
  return request({
    url: `/api/collections/${encodeURIComponent(id)}`,
    method: "DELETE",
    headers,
  });
}

export function addArticleToCollection({ headers, id, articleSlug }) {
  return request({
    url: `/api/collections/${encodeURIComponent(id)}/articles`,
    method: "POST",
    headers,
    data: { articleSlug },
  });
}

export function removeArticleFromCollection({ headers, id, slug }) {
  return request({
    url: `/api/collections/${encodeURIComponent(id)}/articles/${encodeURIComponent(slug)}`,
    method: "DELETE",
    headers,
  });
}
