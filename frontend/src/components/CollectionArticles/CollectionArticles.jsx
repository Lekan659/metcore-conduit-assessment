import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "../Avatar";
import { useAuth } from "../../context/AuthContext";
import { removeArticleFromCollection } from "../../services/collections";

export default function CollectionArticles({ articles, collectionId, onRemoved }) {
  const { headers } = useAuth();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState("");

  const remove = async (slug) => {
    if (removing) return;
    setRemoving(slug);
    setError("");
    try {
      await removeArticleFromCollection({ headers, id: collectionId, slug });
      onRemoved();
    } catch (failure) {
      if (failure.status === 401) navigate("/login", { replace: true });
      else setError(failure.message);
    } finally {
      setRemoving(null);
    }
  };

  if (!articles.length) return <p>No saved articles yet.</p>;
  return (
    <>
      {error && <p role="alert" className="error-messages">{error}</p>}
      <ul className="collections-list">
        {articles.map((article) => (
          <li className="article-preview" key={article.slug}>
            {article.author && (
              <div className="article-meta">
                <Link to={`/profile/${encodeURIComponent(article.author.username)}`}>
                  <Avatar src={article.author.image} alt={article.author.username} />
                  {article.author.username}
                </Link>
              </div>
            )}
            <Link className="preview-link" to={`/article/${encodeURIComponent(article.slug)}`}>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
            </Link>
            <button className="btn btn-sm btn-outline-danger" disabled={removing !== null}
              aria-label={`Remove ${article.title} from collection`} onClick={() => remove(article.slug)}>
              {removing === article.slug ? "Removing…" : "Remove"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
