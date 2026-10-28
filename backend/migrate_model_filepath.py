

import sqlite3
import os

DB_PATH = "app.db"

# Paths as ml_model.py will use them (relative to backend/, matching the
# existing MODEL_PATH convention in the current ml_model.py)
DEFAULT_PATHS = {
    "MLP": os.path.join("..", "ML", "models", "mlp.pt"),
    "GRU": os.path.join("..", "ML", "models", "gru.pt"),
    "Transformer": os.path.join("..", "ML", "models", "transformer.pt"),
}


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def main():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: {DB_PATH} not found. Run this from the backend/ folder.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if not column_exists(cursor, "model_versions", "file_path"):
        cursor.execute("ALTER TABLE model_versions ADD COLUMN file_path TEXT")
        conn.commit()
        print("Added file_path column to model_versions.")
    else:
        print("file_path column already exists — skipping ALTER TABLE.")

    cursor.execute("SELECT id, architecture, file_path FROM model_versions")
    rows = cursor.fetchall()

    updated = 0
    skipped_unknown = []
    for row_id, architecture, existing_path in rows:
        if existing_path is not None:
            continue  

        default_path = DEFAULT_PATHS.get(architecture)
        if default_path is None:
            skipped_unknown.append((row_id, architecture))
            continue

        cursor.execute(
            "UPDATE model_versions SET file_path = ? WHERE id = ?",
            (default_path, row_id),
        )
        updated += 1

    conn.commit()
    conn.close()

    print(f"Backfilled file_path on {updated} row(s).")
    if skipped_unknown:
        print("WARNING: these rows have an architecture that didn't match "
              "MLP/GRU/Transformer exactly, so file_path is still NULL. "
              "Set it manually via the admin UI once the new form field exists:")
        for row_id, architecture in skipped_unknown:
            print(f"  - id={row_id}, architecture={architecture!r}")

    print("\nDone. You can now activate any of the 3 versions and /predict "
          "will load the file recorded in file_path.")


if __name__ == "__main__":
    main()
