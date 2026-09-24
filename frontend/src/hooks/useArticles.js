import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import getArticles from "../services/getArticles";

function useArticles({ location, tabName, tagName, username }) {
  const [{ articles, articlesCount }, setArticlesData] = useState({
    articles: [],
    articlesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { headers } = useAuth();

  useEffect(() => {
    if (!headers && tabName === "feed") return;

    setLoading(true);
    setError("");

    getArticles({ headers, location, tabName, tagName, username })
      .then(setArticlesData)
      .catch((failure) => setError(String(failure)))
      .finally(() => setLoading(false));
  }, [headers, location, tabName, tagName, username]);

  return { articles, articlesCount, loading, error, setArticlesData };
}

export default useArticles;
