"""
Loads whichever model is currently marked `is_active=True` in the
model_versions table, and runs inference with it.

Supports all 3 architectures trained in ML/scripts/:
  - MLP          (train_mlp.py)        -> flat (batch, 40) input, no attention
  - GRU          (train_gru.py)        -> (batch, 40, 1) input, no attention
  - Transformer  (train_transformer.py)-> (batch, 40, 1) input, real self-attention

MLP and GRU have no native interpretability mechanism, so we compute
gradient-based saliency (d(logit)/d(input), abs value, normalized) as a
stand-in for "which weeks mattered." This is reported via
`interpretability_method` so the frontend can label the chart correctly
("Attention" vs "Feature importance") instead of implying every model
has real attention.

Models are cached in memory after first load, keyed by (architecture, file_path),
so repeated /predict calls don't reload from disk every time. Switching the
active model version in the registry only pays the load cost once, on the
next prediction after the switch.
"""

import os
import math
import pickle
import threading

import numpy as np
import torch
import torch.nn as nn

from database import SessionLocal
import models as db_models

SEQ_LEN = 40
SCALER_PATH = os.path.join("..", "data", "processed", "scaler.pkl")

# ---------------------------------------------------------------------------
# Scaler (shared preprocessing across all 3 architectures — see build_sequences.py)
# ---------------------------------------------------------------------------

_scaler = None


def _get_scaler():
    global _scaler
    if _scaler is None:
        with open(SCALER_PATH, "rb") as f:
            _scaler = pickle.load(f)
    return _scaler


# ---------------------------------------------------------------------------
# Model class definitions — must match train_mlp.py / train_gru.py / train_transformer.py exactly
# ---------------------------------------------------------------------------

class MLPClassifier(nn.Module):
    def __init__(self, input_dim=SEQ_LEN):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 1),
        )

    def forward(self, x):
        return self.net(x).squeeze(-1)


class GRUClassifier(nn.Module):
    def __init__(self, input_size=1, hidden_size=32, num_layers=1):
        super().__init__()
        self.gru = nn.GRU(input_size, hidden_size, num_layers, batch_first=True)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        _, h_n = self.gru(x)
        last_hidden = h_n[-1]
        out = self.dropout(last_hidden)
        return self.fc(out).squeeze(-1)


class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=100):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len).unsqueeze(1).float()
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, :x.size(1), :]


class TransformerClassifier(nn.Module):
    def __init__(self, d_model=32, nhead=4, num_layers=2, seq_len=SEQ_LEN):
        super().__init__()
        self.input_proj = nn.Linear(1, d_model)
        self.pos_encoding = PositionalEncoding(d_model, max_len=seq_len)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=64,
            dropout=0.3, batch_first=True
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(d_model, 1)

    def forward(self, x, return_attention=False):
        x = self.input_proj(x)
        x = self.pos_encoding(x)
        attn_weights_all = []
        out = x
        for layer in self.encoder.layers:
            attn_out, attn_weights = layer.self_attn(
                out, out, out, need_weights=True, average_attn_weights=True
            )
            attn_weights_all.append(attn_weights)
            out = layer.norm1(out + layer.dropout1(attn_out))
            ff = layer.linear2(layer.dropout(layer.activation(layer.linear1(out))))
            out = layer.norm2(out + layer.dropout2(ff))
        pooled = out.mean(dim=1)
        logit = self.fc(self.dropout(pooled)).squeeze(-1)
        if return_attention:
            return logit, attn_weights_all
        return logit


MODEL_CLASSES = {
    "mlp": MLPClassifier,
    "gru": GRUClassifier,
    "transformer": TransformerClassifier,
}

# ---------------------------------------------------------------------------
# Model cache — avoid reloading from disk on every /predict call
# ---------------------------------------------------------------------------

_loaded_models = {}   # (arch_key, file_path) -> nn.Module instance
_cache_lock = threading.Lock()


def _load_model(architecture: str, file_path: str):
    arch_key = architecture.strip().lower()
    model_cls = MODEL_CLASSES.get(arch_key)
    if model_cls is None:
        raise ValueError(
            f"Unknown architecture '{architecture}'. "
            f"Expected one of: {', '.join(MODEL_CLASSES)} (case-insensitive)."
        )

    cache_key = (arch_key, file_path)
    with _cache_lock:
        if cache_key in _loaded_models:
            return arch_key, _loaded_models[cache_key]

        if not os.path.exists(file_path):
            raise FileNotFoundError(
                f"Model file not found at '{file_path}' for architecture "
                f"'{architecture}'. Check the file_path set on this model "
                f"version in Admin > Models."
            )

        model = model_cls()
        model.load_state_dict(torch.load(file_path, map_location="cpu"))
        model.eval()
        _loaded_models[cache_key] = model
        return arch_key, model


def clear_model_cache():
    """Call this if a .pt file is replaced on disk without a server restart."""
    with _cache_lock:
        _loaded_models.clear()


# ---------------------------------------------------------------------------
# Saliency (gradient-based importance) for architectures with no attention
# ---------------------------------------------------------------------------

def _compute_saliency(logit: torch.Tensor, x: torch.Tensor, collapse_last_dim: bool = False):
    grad = torch.autograd.grad(logit.sum(), x)[0].detach()
    if collapse_last_dim:
        grad = grad.squeeze(-1)          # (1, 40, 1) -> (1, 40)
    grad = grad[0].abs().numpy()
    total = grad.sum()
    if total > 0:
        grad = grad / total
    return grad.tolist()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def predict_dropout(weekly_clicks, db=None):
    """
    weekly_clicks: list of 40 raw click counts (one per week, weeks 0-39)

    Loads whichever ModelVersion is currently active in the registry and
    runs inference with it.

    Returns: (risk_score, predicted_dropout, week_importance, interpretability_method, architecture)
    """
    if len(weekly_clicks) != SEQ_LEN:
        raise ValueError(f"Expected {SEQ_LEN} weekly values, got {len(weekly_clicks)}")

    owns_session = db is None
    if owns_session:
        db = SessionLocal()

    try:
        active_version = (
            db.query(db_models.ModelVersion)
            .filter(db_models.ModelVersion.is_active == True)  # noqa: E712
            .first()
        )
        if active_version is None:
            raise RuntimeError(
                "No active model version is set. Go to Admin > Models and "
                "activate one before running predictions."
            )
        if not active_version.file_path:
            raise RuntimeError(
                f"Model version #{active_version.id} ({active_version.architecture}) "
                f"has no file_path set. Edit it in Admin > Models."
            )

        arch_key, model = _load_model(active_version.architecture, active_version.file_path)

        raw = np.array(weekly_clicks, dtype=float).reshape(1, -1)
        log_transformed = np.log1p(raw)
        scaled = _get_scaler().transform(log_transformed)   # (1, 40)

        if arch_key == "mlp":
            x = torch.tensor(scaled, dtype=torch.float32)
            x.requires_grad_(True)
            logit = model(x)
            prob = torch.sigmoid(logit).item()
            importance = _compute_saliency(logit, x)
            method = "saliency"

        elif arch_key == "gru":
            x = torch.tensor(scaled, dtype=torch.float32).unsqueeze(-1)   # (1, 40, 1)
            x.requires_grad_(True)
            logit = model(x)
            prob = torch.sigmoid(logit).item()
            importance = _compute_saliency(logit, x, collapse_last_dim=True)
            method = "saliency"

        elif arch_key == "transformer":
            x = torch.tensor(scaled, dtype=torch.float32).unsqueeze(-1)   # (1, 40, 1)
            with torch.no_grad():
                logit, attn_weights_all = model(x, return_attention=True)
                prob = torch.sigmoid(logit).item()
            last_layer_attn = attn_weights_all[-1]                       # (1, seq_len, seq_len)
            importance = last_layer_attn.mean(dim=1)[0].numpy().tolist()
            method = "attention"

        else:
            # Should be unreachable given MODEL_CLASSES check in _load_model,
            # but fail loudly instead of guessing if a 4th architecture ever shows up.
            raise ValueError(f"No inference path implemented for architecture '{arch_key}'.")

        predicted = 1 if prob >= 0.5 else 0
        return prob, predicted, importance, method, active_version.architecture

    finally:
        if owns_session:
            db.close()