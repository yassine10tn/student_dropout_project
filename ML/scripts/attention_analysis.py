import numpy as np
import torch
import torch.nn as nn
import matplotlib.pyplot as plt
import os
import math

PROCESSED_DIR = "../../data/processed"
MODELS_DIR = "../models"

X_test = np.load(os.path.join(PROCESSED_DIR, "X_test.npy"))
y_test = np.load(os.path.join(PROCESSED_DIR, "y_test.npy"))
SEQ_LEN = X_test.shape[1]

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

model = TransformerClassifier()
model.load_state_dict(torch.load(os.path.join(MODELS_DIR, "transformer.pt")))
model.eval()

X_t = torch.tensor(X_test, dtype=torch.float32).unsqueeze(-1)
y_t = np.array(y_test)

dropout_idx = np.where(y_t == 1)[0]
X_dropout = X_t[dropout_idx]

with torch.no_grad():
    _, attn_weights_all = model(X_dropout, return_attention=True)


last_layer_attn = attn_weights_all[-1]              # (n, seq_len, seq_len)
week_importance = last_layer_attn.mean(dim=1)        # avg over queries -> (n, seq_len)
week_importance = week_importance.mean(dim=0).numpy()  # avg over students -> (seq_len,)

print("Average attention weight per week (dropout students, last layer):")
for w, val in enumerate(week_importance):
    print(f"  week {w:2d}: {val:.4f}")

top5 = np.argsort(week_importance)[::-1][:5]
print(f"\nTop 5 most attended weeks: {sorted(top5.tolist())}")

# ---- Plot ----
plt.figure(figsize=(10, 4))
plt.bar(range(SEQ_LEN), week_importance, color="#2c5282")
plt.xlabel("Week")
plt.ylabel("Average attention weight")
plt.title("Which weeks the Transformer attends to most (dropout students)")
plt.tight_layout()
out_path = os.path.join(MODELS_DIR, "attention_by_week.png")
plt.savefig(out_path, dpi=150)
print(f"\nSaved chart to {out_path}")
