import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { deleteCollection } from "../../services/collections";

export default function DeleteCollectionButton({ collection }) {
  const { headers } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteCollection({ headers, id: collection.id });
      navigate("/collections", { replace: true, state: { collectionDeleted: true } });
    } catch (failure) {
      if (failure.status === 401) navigate("/login", { replace: true });
      else setError(failure.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!confirming) {
    return <button className="btn btn-outline-danger" onClick={() => setConfirming(true)}>Delete collection</button>;
  }
  return (
    <div role="group" aria-label="Confirm collection deletion">
      <p>Delete “{collection.name}”? The articles themselves will remain available.</p>
      {error && <p role="alert" className="error-messages">{error}</p>}
      <div className="collection-controls">
        <button className="btn btn-danger" disabled={deleting} onClick={remove}>
          {deleting ? "Deleting…" : "Confirm delete"}
        </button>
        <button className="btn btn-outline-secondary" disabled={deleting} onClick={() => { setConfirming(false); setError(""); }}>Cancel</button>
      </div>
    </div>
  );
}
