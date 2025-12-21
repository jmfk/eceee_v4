import os
import subprocess
import psycopg2
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = "Replicates the main database and names it after the current git branch, then updates .env"

    def add_arguments(self, parser):
        parser.add_argument(
            "--branch",
            type=str,
            help="The git branch name to use for the database name",
        )

    def handle(self, *args, **options):
        # 1. Get current git branch
        branch_name = options.get("branch")

        if not branch_name:
            # Try environment variable
            branch_name = os.environ.get("GIT_BRANCH")

        if not branch_name:
            # Try running git
            try:
                branch_name = (
                    subprocess.check_output(
                        ["git", "rev-parse", "--abbrev-ref", "HEAD"]
                    )
                    .decode("utf-8")
                    .strip()
                )
            except Exception as e:
                self.stderr.write(
                    f"Warning: Could not get git branch via subprocess: {e}"
                )
                branch_name = "default"

        self.stdout.write(f"Using branch name: {branch_name}")

        # Clean branch name for Postgres (alphanumeric and underscores only)
        # Replace non-alphanumeric with underscores and ensure it starts with a letter or underscore
        db_name = "".join([c if c.isalnum() else "_" for c in branch_name.lower()])
        if not db_name or db_name[0].isdigit():
            db_name = "db_" + db_name

        source_db = settings.DATABASES["default"]["NAME"]

        if db_name == source_db:
            self.stdout.write(
                self.style.WARNING(
                    f"Already using database '{db_name}', skipping replication."
                )
            )
            return

        self.stdout.write(f"Replicating database '{source_db}' to '{db_name}'...")

        # 2. Connect to postgres database to perform the clone
        db_settings = settings.DATABASES["default"]
        try:
            # Connect to 'postgres' database to avoid being connected to the template DB
            # We use the same credentials as the default DB
            conn = psycopg2.connect(
                dbname="postgres",
                user=db_settings["USER"],
                password=db_settings["PASSWORD"],
                host=db_settings["HOST"],
                port=db_settings["PORT"],
            )
            conn.autocommit = True
            with conn.cursor() as cur:
                # Check if DB already exists
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
                if cur.fetchone():
                    self.stdout.write(
                        self.style.WARNING(
                            f"Database '{db_name}' already exists. Skipping creation."
                        )
                    )
                else:
                    # Clone the database
                    self.stdout.write(f"Cloning {source_db} to {db_name}...")
                    cur.execute(
                        f'CREATE DATABASE "{db_name}" WITH TEMPLATE "{source_db}"'
                    )
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Database '{db_name}' created successfully."
                        )
                    )
            conn.close()
        except Exception as e:
            self.stderr.write(f"Error replicating database: {e}")
            self.stdout.write(
                self.style.NOTICE(
                    "Note: This command requires no active connections to the source database."
                )
            )
            return

        # 3. Update .env file
        # Inside Docker, BASE_DIR is /app, so .env is at /app/.env
        # If running outside, it might be one level up
        env_path = os.path.join(settings.BASE_DIR, ".env")
        if not os.path.exists(env_path):
            project_root = os.path.dirname(settings.BASE_DIR)
            env_path = os.path.join(project_root, ".env")

        self.stdout.write(f"Updating .env at {env_path}...")

        env_lines = []
        db_updated = False

        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if line.startswith("POSTGRES_DB="):
                        env_lines.append(f"POSTGRES_DB={db_name}\n")
                        db_updated = True
                    elif line.startswith("DATABASE_URL="):
                        # Attempt to update the DB name in the URL
                        # Format: postgresql://user:pass@host:port/dbname
                        url = line.strip().split("=", 1)[1]
                        if "/" in url:
                            base_url = url.rsplit("/", 1)[0]
                            env_lines.append(f"DATABASE_URL={base_url}/{db_name}\n")
                        else:
                            env_lines.append(line)
                    else:
                        env_lines.append(line)

        if not db_updated:
            env_lines.append(f"POSTGRES_DB={db_name}\n")

        with open(env_path, "w") as f:
            f.writelines(env_lines)

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully updated .env to use database '{db_name}'."
            )
        )
        self.stdout.write(
            self.style.NOTICE(
                "Restart your docker containers to apply changes: docker-compose up -d backend"
            )
        )
