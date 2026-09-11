import os
import math
import pickle
import numpy as np
import torch
import torch.nn as nn

# paths relative to backend/, pointing to the ML and data folders
MODEL_PATH = os.path.join("..", "ML", "models", "transformer.pt")
SCALER_PATH = os.path.join("..", "data", "processed", "scaler.pkl")
SEQ_LEN = 40


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


# load model + scaler once, at import time (not per-request)
_model = TransformerClassifier()
_model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
_model.eval()

with open(SCALER_PATH, "rb") as f:
    _scaler = pickle.load(f)


def predict_dropout(weekly_clicks):
    """
    weekly_clicks: list of 40 raw click counts (one per week, weeks 0-39)
    Returns: (risk_score: float, predicted_dropout: int, attention_by_week: list[float])
    """
    if len(weekly_clicks) != SEQ_LEN:
        raise ValueError(f"Expected {SEQ_LEN} weekly values, got {len(weekly_clicks)}")

    raw = np.array(weekly_clicks, dtype=float).reshape(1, -1)
    log_transformed = np.log1p(raw)
    scaled = _scaler.transform(log_transformed)

    x = torch.tensor(scaled, dtype=torch.float32).unsqueeze(-1)  # (1, 40, 1)

    with torch.no_grad():
        logit, attn_weights_all = _model(x, return_attention=True)
        prob = torch.sigmoid(logit).item()

    last_layer_attn = attn_weights_all[-1]                        # (1, seq_len, seq_len)
    week_importance = last_layer_attn.mean(dim=1)[0].numpy().tolist()

    predicted = 1 if prob >= 0.5 else 0
    return prob, predicted, week_importance