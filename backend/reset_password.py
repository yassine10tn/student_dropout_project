import sys
from database import SessionLocal
import models
from auth_utils import hash_password


def main():
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <email> <new_password>")
        sys.exit(1)

    email = sys.argv[1]
    new_password = sys.argv[2]

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"No user found with email '{email}'.")
            return

        if user.auth_provider != "local":
            print(
                f"WARNING: this user's auth_provider is '{user.auth_provider}', not 'local'. "
                f"Setting a password anyway, but they normally log in via Google, not this password."
            )

        user.hashed_password = hash_password(new_password)
        db.commit()
        print(f"Password reset for {email}. Role: {user.role}, is_active: {user.is_active}")

    finally:
        db.close()


if __name__ == "__main__":
    main()