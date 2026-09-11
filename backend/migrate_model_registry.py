import sqlite3

con = sqlite3.connect("app.db")
cur = con.cursor()

cur.execute("ALTER TABLE predictions ADD COLUMN model_version_id INTEGER")
con.commit()
print("done")

for row in cur.execute("SELECT id, student_label, model_version_id FROM predictions LIMIT 5"):
    print(row)

con.close()