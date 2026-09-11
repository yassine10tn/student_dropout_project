"""
Run this LOCALLY from ML/scripts/, with venv activated.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import pickle
import os

RAW_DIR = "../../data/raw"
PROCESSED_DIR = "../../data/processed"
MAX_WEEK = 39

print("Loading data...")
weekly = pd.read_csv(os.path.join(PROCESSED_DIR, "studentVle_weekly.csv"))
info = pd.read_csv(os.path.join(RAW_DIR, "studentInfo.csv"))

print("Merging labels...")
merged = weekly.merge(
    info[["id_student", "code_module", "code_presentation", "final_result"]],
    on=["id_student", "code_module", "code_presentation"],
    how="left",
)

merged = merged[merged["week"] >= 0]
merged = merged[merged["week"] <= MAX_WEEK]

merged["student_key"] = (
    merged["id_student"].astype(str) + "_" +
    merged["code_module"] + "_" +
    merged["code_presentation"]
)

activity_totals = merged.groupby("student_key")["total_clicks"].sum()
zero_activity_keys = activity_totals[activity_totals == 0].index
print(f"Dropping {len(zero_activity_keys)} zero-activity student-course records")
merged = merged[~merged["student_key"].isin(zero_activity_keys)]

print("Pivoting to sequence format...")
pivot = merged.pivot_table(
    index="student_key", columns="week", values="total_clicks", aggfunc="sum"
)
pivot = pivot.reindex(columns=range(0, MAX_WEEK + 1), fill_value=0)
pivot = pivot.fillna(0)

print(f"Sequence matrix shape: {pivot.shape}")

label_lookup = (
    merged[["student_key", "final_result"]]
    .drop_duplicates("student_key")
    .set_index("student_key")["final_result"]
)
labels = label_lookup.reindex(pivot.index)
y = (labels == "Withdrawn").astype(int).values

print(f"Label distribution -> dropout: {y.sum()}, not dropout: {len(y) - y.sum()}")

X_raw = pivot.values.astype(float)
X_log = np.log1p(X_raw)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_log)

X_train, X_temp, y_train, y_temp = train_test_split(
    X_scaled, y, test_size=0.30, stratify=y, random_state=42
)
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42
)

print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

np.save(os.path.join(PROCESSED_DIR, "X_train.npy"), X_train)
np.save(os.path.join(PROCESSED_DIR, "X_val.npy"), X_val)
np.save(os.path.join(PROCESSED_DIR, "X_test.npy"), X_test)
np.save(os.path.join(PROCESSED_DIR, "y_train.npy"), y_train)
np.save(os.path.join(PROCESSED_DIR, "y_val.npy"), y_val)
np.save(os.path.join(PROCESSED_DIR, "y_test.npy"), y_test)

with open(os.path.join(PROCESSED_DIR, "scaler.pkl"), "wb") as f:
    pickle.dump(scaler, f)

print("Done.")
