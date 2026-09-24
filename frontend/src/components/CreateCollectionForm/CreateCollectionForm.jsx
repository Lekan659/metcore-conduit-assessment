import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { createCollection } from "../../services/collections";

function CreateCollectionForm({ onCreated }) {
  const { headers } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSuccess("");
    setFormError("");
    if (!name.trim()) {
      setFormError("Enter a collection name.");
      return;
    }
    setSaving(true);
    try {
      await createCollection({ headers, name: name.trim(), description: description.trim() || null });
      setName("");
      setDescription("");
      setSuccess("Collection created.");
      onCreated();
    } catch (error) {
      if (error.status === 401) setUnauthorized(true);
      else setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (unauthorized) return <Navigate to="/login" replace />;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving}>
          <div className="form-group">
            <label htmlFor="collection-name">Name</label>
            <input
              id="collection-name"
              className="form-control"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label htmlFor="collection-description">Description (optional)</label>
            <textarea
              id="collection-description"
              className="form-control"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {formError && <p className="error-messages" role="alert">{formError}</p>}
          <button className="btn btn-primary" type="submit">
            {saving ? "Creating…" : "Create collection"}
          </button>
        </fieldset>
      </form>
      {success && <p role="status">{success}</p>}
    </>
  );
}

export default CreateCollectionForm;
