import sqlite3
import sys

# Usage: python make_admin.py some.email@example.com
# If no email is passed as an argument, defaults to the one below.
EMAIL = sys.argv[1] if len(sys.argv) > 1 else "admin@test.local"

con = sqlite3.connect("app.db")
cur = con.cursor()

cur.execute("UPDATE users SET role = 'admin' WHERE email = ?", (EMAIL,))
con.commit()
print(f"Promoted {EMAIL} to admin ({cur.rowcount} row(s) affected).")

for row in cur.execute("SELECT id, email, role, auth_provider FROM users"):
    print(row)

con.close()