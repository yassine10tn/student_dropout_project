import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import os
import math

PROCESSED_DIR = "../../data/processed"
MODELS_DIR = "../models"
os.makedirs(MODELS_DIR, exist_ok=True)

# ---- 1. Load data ----
X_train = np.load(os.path.join(PROCESSED_DIR, "X_train.npy"))
X_val = np.load(os.path.join(PROCESSED_DIR, "X_val.npy"))
X_test = np.load(os.path.join(PROCESSED_DIR, "X_test.npy"))
y_train = np.load(os.path.join(PROCESSED_DIR, "y_train.npy"))
y_val = np.load(os.path.join(PROCESSED_DIR, "y_val.npy"))
y_test = np.load(os.path.join(PROCESSED_DIR, "y_test.npy"))

print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

SEQ_LEN = X_train.shape[1]

# ---- 2. Class imbalance ----
n_pos = y_train.sum()
n_neg = len(y_train) - n_pos
pos_weight = torch.tensor(n_neg / n_pos, dtype=torch.float32)
print(f"pos_weight for imbalance: {pos_weight.item():.3f}")

# ---- 3. Torch datasets ----
def make_loader(X, y, batch_size=64, shuffle=False):
    X_t = torch.tensor(X, dtype=torch.float32).unsqueeze(-1)  # (N, 40, 1)
    y_t = torch.tensor(y, dtype=torch.float32)
    return DataLoader(TensorDataset(X_t, y_t), batch_size=batch_size, shuffle=shuffle)

train_loader = make_loader(X_train, y_train, shuffle=True)
val_loader = make_loader(X_val, y_val)
test_loader = make_loader(X_test, y_test)

# ---- 4. Positional encoding (standard sinusoidal, so the model knows week order) ----
class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=100):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len).unsqueeze(1).float()
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))  # (1, max_len, d_model)

    def forward(self, x):
        return x + self.pe[:, :x.size(1), :]

# ---- 5. Model: small Transformer encoder classifier ----
class TransformerClassifier(nn.Module):
    def __init__(self, d_model=32, nhead=4, num_layers=2, seq_len=SEQ_LEN):
        super().__init__()
        self.input_proj = nn.Linear(1, d_model)          # project scalar click count -> d_model
        self.pos_encoding = PositionalEncoding(d_model, max_len=seq_len)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=64,
            dropout=0.3, batch_first=True
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(d_model, 1)

    def forward(self, x):
        # x: (batch, seq_len, 1)
        x = self.input_proj(x)               # (batch, seq_len, d_model)
        x = self.pos_encoding(x)
        x = self.encoder(x)                  # (batch, seq_len, d_model)
        pooled = x.mean(dim=1)               # mean-pool across weeks -> (batch, d_model)
        out = self.dropout(pooled)
        return self.fc(out).squeeze(-1)

model = TransformerClassifier()
criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

# ---- 6. Training loop with early stopping ----
best_val_loss = float("inf")
patience, patience_counter = 5, 0
n_epochs = 50

for epoch in range(n_epochs):
    model.train()
    train_loss = 0
    for xb, yb in train_loader:
        optimizer.zero_grad()
        logits = model(xb)
        loss = criterion(logits, yb)
        loss.backward()
        optimizer.step()
        train_loss += loss.item() * xb.size(0)
    train_loss /= len(train_loader.dataset)

    model.eval()
    val_loss = 0
    with torch.no_grad():
        for xb, yb in val_loader:
            logits = model(xb)
            loss = criterion(logits, yb)
            val_loss += loss.item() * xb.size(0)
    val_loss /= len(val_loader.dataset)

    print(f"Epoch {epoch+1:2d} | train_loss={train_loss:.4f} | val_loss={val_loss:.4f}")

    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
        torch.save(model.state_dict(), os.path.join(MODELS_DIR, "transformer.pt"))
    else:
        patience_counter += 1
        if patience_counter >= patience:
            print(f"Early stopping at epoch {epoch+1}")
            break

# ---- 7. Evaluate best model on test set ----
model.load_state_dict(torch.load(os.path.join(MODELS_DIR, "transformer.pt")))
model.eval()

all_probs, all_labels = [], []
with torch.no_grad():
    for xb, yb in test_loader:
        logits = model(xb)
        probs = torch.sigmoid(logits)
        all_probs.extend(probs.numpy())
        all_labels.extend(yb.numpy())

all_probs = np.array(all_probs)
all_labels = np.array(all_labels)
all_preds = (all_probs >= 0.5).astype(int)

print("\n=== Test set results (Transformer) ===")
print(classification_report(all_labels, all_preds, target_names=["not_dropout", "dropout"]))
print("ROC-AUC:", roc_auc_score(all_labels, all_probs))
print("Confusion matrix:\n", confusion_matrix(all_labels, all_preds))

print(f"\nSaved best model to {os.path.join(MODELS_DIR, 'transformer.pt')}")