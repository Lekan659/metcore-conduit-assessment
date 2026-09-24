function errorHandler(error) {
  if (!error.response) {
    if (error.request) {
      throw "Could not reach the server. Check that the backend is running on port 3001.";
    }
    throw error.message || "Request failed.";
  }

  const { data } = error.response;
  throw data?.errors?.body?.[0] || "Request failed.";
}

export default errorHandler;
