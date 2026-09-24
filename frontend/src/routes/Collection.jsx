import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ContainerRow from "../components/ContainerRow";
import EditCollectionForm from "../components/EditCollectionForm";
import DeleteCollectionButton from "../components/DeleteCollectionButton";
import CollectionArticles from "../components/CollectionArticles";
import CollectionPagination from "../components/CollectionPagination/CollectionPagination";
import { useAuth } from "../context/AuthContext";
import useCollection from "../hooks/useCollection";

function CollectionPage({ id, headers }) {
  const { collection, articles, articlesCount, page, limit, loading, error, changePage, reload, updateMetadata } = useCollection({ id, headers });
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState("");

  if (error?.status === 401) return <Navigate to="/login" replace />;

  return (
    <div className="collections-page">
      <ContainerRow type="page">
        <div className="col-md-8 offset-md-2 col-xs-12">
          <Link to="/collections">Back to My Collections</Link>
          {success && <p role="status">{success}</p>}
          {loading ? <p role="status">Loading collection…</p> : error ? (
            <div role="alert">
              <p className="error-messages">{error.status === 404 ? "Collection not found or unavailable." : error.message}</p>
              {error.status !== 404 && <button className="btn btn-outline-primary" onClick={reload}>Try again</button>}
            </div>
          ) : collection && (
            <>
              <h1>{collection.name}</h1>
              {editing ? (
                <EditCollectionForm collection={collection} onCancel={() => setEditing(false)} onSaved={(updated) => {
                  updateMetadata(updated);
                  setEditing(false);
                  setSuccess("Collection updated.");
                }} />
              ) : (
                <>
                  {collection.description && <p className="collection-description">{collection.description}</p>}
                  <div className="collection-controls">
                    <button className="btn btn-outline-primary" onClick={() => { setEditing(true); setSuccess(""); }}>Edit collection</button>
                    <DeleteCollectionButton collection={collection} />
                  </div>
                </>
              )}
              {!editing && (
                <section aria-labelledby="saved-articles-heading">
                  <hr />
                  <h2 id="saved-articles-heading">Saved articles ({articlesCount})</h2>
                  <CollectionArticles articles={articles} collectionId={collection.id} onRemoved={() => {
                    setSuccess("Article removed from collection.");
                    reload();
                  }} />
                  <CollectionPagination total={articlesCount} limit={limit} page={page} onPageChange={changePage} />
                </section>
              )}
            </>
          )}
        </div>
      </ContainerRow>
    </div>
  );
}

export default function Collection() {
  const { id } = useParams();
  const { isAuth, headers, loggedUser } = useAuth();
  if (!isAuth) return <Navigate to="/login" replace />;
  return <CollectionPage key={`${loggedUser.username}:${id}`} id={id} headers={headers} />;
}
