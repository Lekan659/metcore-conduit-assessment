import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { updateCollection } from "../../services/collections";

export default function EditCollectionForm({ collection, onSaved, onCancel }) {
  const { headers } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!name.trim()) { setError("Enter a collection name."); return; }
    setSaving(true);
    try {
      const result = await updateCollection({ headers, id: collection.id, name: name.trim(), description: description.trim() || null });
      onSaved(result.collection);
    } catch (failure) {
      if (failure.status === 401) navigate("/login", { replace: true });
      else setError(failure.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} aria-label="Edit collection">
      <fieldset disabled={saving}>
        <div className="form-group">
          <label htmlFor="edit-collection-name">Name</label>
          <input id="edit-collection-name" className="form-control" required maxLength={100}
            value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="edit-collection-description">Description (optional)</label>
          <textarea id="edit-collection-description" className="form-control" rows={3}
            value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        {error && <p role="alert" className="error-messages">{error}</p>}
        <div className="collection-controls">
          <button className="btn btn-primary" type="submit">{saving ? "Saving…" : "Save changes"}</button>
          <button className="btn btn-outline-secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </fieldset>
    </form>
  );
}
