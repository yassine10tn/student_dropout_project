import pandas as pd

print("Loading studentVle.csv ...")
vle = pd.read_csv("studentVle.csv")
print(f"Loaded {len(vle):,} rows")

vle["week"] = (vle["date"] // 7).astype(int)

weekly = (
    vle.groupby(["code_module", "code_presentation", "id_student", "week"])["sum_click"]
    .sum()
    .reset_index()
    .rename(columns={"sum_click": "total_clicks"})
)

print(f"Aggregated to {len(weekly):,} rows (student x week)")
print(weekly.head(10))

weekly.to_csv("studentVle_weekly.csv", index=False)
print("Saved studentVle_weekly.csv -- upload this file instead of the raw one.")