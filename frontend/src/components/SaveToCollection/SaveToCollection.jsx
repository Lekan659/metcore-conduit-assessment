import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { addArticleToCollection, getCollections } from "../../services/collections";
import CollectionPagination from "../CollectionPagination/CollectionPagination";

function CollectionPicker({ slug, headers, compact }) {
  const panelId = useId();
  const selectId = useId();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(null);
  const limit = 3;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setListError("");
    getCollections({ headers, page, limit })
      .then(({ collections: items, collectionsCount }) => {
        if (!active) return;
        const lastPage = Math.max(0, Math.ceil(collectionsCount / limit) - 1);
        if (page > lastPage) { setPage(lastPage); return; }
        setCollections(items);
        setTotal(collectionsCount);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) navigate("/login", { replace: true });
        else setListError(error.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, headers, page, revision, navigate]);

  const save = async (event) => {
    event.preventDefault();
    const collection = collections.find((item) => String(item.id) === selected);
    if (!collection || saving) return;
    setSaving(true);
    setSaveError("");
    setSaved(null);
    try {
      await addArticleToCollection({ headers, id: collection.id, articleSlug: slug });
      setSaved(collection);
    } catch (error) {
      if (error.status === 401) navigate("/login", { replace: true });
      else setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-to-collection">
      <button className={`btn btn-outline-primary${compact ? " btn-sm" : ""}`} type="button" aria-expanded={open}
        aria-controls={panelId} disabled={saving} onClick={() => {
          setOpen(!open);
          setPage(0);
          setSelected("");
          setSaved(null);
          setSaveError("");
          setLoading(true);
        }}>
        {compact && <i className="ion-bookmark" aria-hidden="true" />} {open ? "Close collection picker" : "Save to collection"}
      </button>
      {open && (
        <section id={panelId} aria-label="Save article to collection" aria-busy={loading}>
          {loading ? <p role="status">Loading collections…</p> : listError ? (
            <div role="alert">
              <p className="error-messages">{listError}</p>
              <button className="btn btn-outline-primary" onClick={() => setRevision((value) => value + 1)}>Try again</button>
            </div>
          ) : collections.length === 0 ? (
            <p>No collections yet. <Link to="/collections">Create a collection</Link> first, then return to this article to save it.</p>
          ) : (
            <>
              <form onSubmit={save}>
                <fieldset disabled={saving}>
                  <div className="form-group">
                    <label htmlFor={selectId}>Choose a collection</label>
                    <select id={selectId} className="form-control" required value={selected}
                      onChange={(event) => { setSelected(event.target.value); setSaveError(""); setSaved(null); }}>
                      <option value="">Select a collection</option>
                      {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={!selected}>
                    {saving ? "Saving…" : "Save article"}
                  </button>
                </fieldset>
              </form>
              <CollectionPagination total={total} limit={limit} page={page} disabled={saving}
                onPageChange={(next) => {
                  setLoading(true);
                  setSelected("");
                  setSaveError("");
                  setSaved(null);
                  setPage(next);
                }} />
              {saveError && <p className="error-messages" role="alert">{saveError}</p>}
              {saved && <p role="status">Saved to “{saved.name}”. <Link to={`/collections/${saved.id}`}>View collection</Link></p>}
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default function SaveToCollection({ slug, compact = false }) {
  const { isAuth, headers, loggedUser } = useAuth();
  if (!isAuth) return compact ? (
    <div className="save-to-collection">
      <Link className="btn btn-sm btn-outline-primary" to="/login">
        <i className="ion-bookmark" aria-hidden="true" /> Save to collection
      </Link>
    </div>
  ) : <p><Link to="/login">Sign in to save articles to a collection</Link></p>;
  // Changing articles or accounts discards selections and pending list responses.
  return <CollectionPicker key={`${loggedUser.username}:${slug}`} slug={slug} headers={headers} compact={compact} />;
}
