"""Near-duplicate screening with one pinned embedding model (plan section 4.9).

The 0.95 cosine cutoff is a provisional generation heuristic, not a validated
duplicate boundary; passing it does not establish originality.
"""
import numpy as np


def embedding_text(submission, fields):
    return "\n".join(submission.get(field, "") for field in fields)


def normalize(vectors):
    vectors = np.asarray(vectors, dtype=np.float64)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.where(norms == 0, 1, norms)


def cosine_to_each(vector, others):
    """Cosine similarity of one vector against each row of `others`."""
    if len(others) == 0:
        return np.zeros(0)
    return normalize(others) @ normalize([vector])[0]


def nearest_neighbors(vectors):
    """For each row, the highest cosine similarity to any other row."""
    unit = normalize(vectors)
    sims = unit @ unit.T
    np.fill_diagonal(sims, -1.0)
    return sims.max(axis=1)


class Embedder:
    """The pinned model from field settings; loading downloads it once into the HF cache."""

    def __init__(self, embedding_settings):
        from huggingface_hub import snapshot_download
        from model2vec import StaticModel

        self.settings = embedding_settings
        path = snapshot_download(embedding_settings["model"], revision=embedding_settings["revision"])
        self.model = StaticModel.from_pretrained(path)

    def embed(self, submissions):
        texts = [embedding_text(s, self.settings["fields"]) for s in submissions]
        return np.asarray(self.model.encode(texts), dtype=np.float64)
