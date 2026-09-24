import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import ContainerRow from "../components/ContainerRow";
import CreateCollectionForm from "../components/CreateCollectionForm";
import CollectionsList from "../components/CollectionsList";
import CollectionPagination from "../components/CollectionPagination/CollectionPagination";
import { useAuth } from "../context/AuthContext";
import { getCollections } from "../services/collections";

const PAGE_SIZE = 3;

function CollectionsPage({ headers }) {
  const { state } = useLocation();
  const [collections, setCollections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setListError("");
    getCollections({ headers, page, limit: PAGE_SIZE })
      .then(({ collections: items, collectionsCount }) => {
        if (!active) return;
        // Another tab may have removed the last item on this page.
        const lastPage = Math.max(0, Math.ceil(collectionsCount / PAGE_SIZE) - 1);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setCollections(items);
        setTotal(collectionsCount);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) setUnauthorized(true);
        else setListError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [headers, page, refresh]);

  if (unauthorized) return <Navigate to="/login" replace />;

  return (
    <div className="collections-page">
      <ContainerRow type="page">
        <div className="col-md-8 offset-md-2 col-xs-12">
          <h1>My Collections</h1>
          {state?.collectionDeleted && <p role="status">Collection deleted.</p>}
          <p>Private lists of articles you want to keep.</p>
          <section aria-labelledby="create-collection-heading">
            <h2 id="create-collection-heading">Create a collection</h2>
            <CreateCollectionForm onCreated={() => {
              setLoading(true);
              setPage(0);
              setRefresh((value) => value + 1);
            }} />
          </section>
          <hr />
          <section aria-labelledby="collections-heading" aria-busy={loading}>
            <h2 id="collections-heading">Your collections</h2>
            <CollectionsList
              collections={collections}
              total={total}
              loading={loading}
              error={listError}
              onRetry={() => setRefresh((value) => value + 1)}
            />
            {!loading && !listError && collections.length > 0 && (
              <CollectionPagination
                total={total}
                limit={PAGE_SIZE}
                page={page}
                onPageChange={(selected) => {
                  setLoading(true);
                  setPage(selected);
                }}
              />
            )}
          </section>
        </div>
      </ContainerRow>
    </div>
  );
}

export default function Collections() {
  const { isAuth, headers, loggedUser } = useAuth();
  if (!isAuth) return <Navigate to="/login" replace />;
  // Reset private page state when the signed-in account changes.
  return <CollectionsPage key={loggedUser.username} headers={headers} />;
}
