import sqlite3

con = sqlite3.connect("app.db")
cur = con.cursor()

cur.execute("ALTER TABLE students ADD COLUMN course_id INTEGER")
con.commit()
print("done")

for row in cur.execute("SELECT id, full_name, course_id FROM students"):
    print(row)

con.close()