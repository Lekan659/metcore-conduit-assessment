import { useEffect, useState } from "react";
import { getCollection } from "../services/collections";

export default function useCollection({ id, headers }) {
  const [data, setData] = useState({ collection: null, articles: [], articlesCount: 0 });
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const limit = 3;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getCollection({ headers, id, page, limit })
      .then((result) => {
        if (!active) return;
        const lastPage = Math.max(0, Math.ceil(result.articlesCount / limit) - 1);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setData(result);
      })
      .catch((failure) => { if (active) setError(failure); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [headers, id, page, revision]);

  return {
    ...data, page, limit, loading, error,
    changePage: (next) => { setLoading(true); setPage(next); },
    reload: () => { setLoading(true); setRevision((value) => value + 1); },
    updateMetadata: (collection) => setData((previous) => ({ ...previous, collection })),
  };
}
