import { Link } from "react-router-dom";

function CollectionsList({ collections, total, loading, error, onRetry }) {
  if (loading) return <p role="status">Loading collections…</p>;

  if (error) {
    return (
      <div role="alert">
        <p className="error-messages">{error}</p>
        <button className="btn btn-outline-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (!collections.length) {
    return <p>No collections yet. Create your first collection above.</p>;
  }

  return (
    <>
      <p>{total} {total === 1 ? "collection" : "collections"}</p>
      <ul className="collections-list">
        {collections.map((collection) => (
          <li className="article-preview" key={collection.id}>
            <h3><Link to={`/collections/${collection.id}`}>{collection.name}</Link></h3>
            {collection.description && <p>{collection.description}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

export default CollectionsList;
