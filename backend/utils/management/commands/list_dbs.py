import psycopg2
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    help = 'Lists all databases in the Postgres server'

    def handle(self, *args, **options):
        db_settings = settings.DATABASES['default']
        try:
            conn = psycopg2.connect(
                dbname='postgres',
                user=db_settings['USER'],
                password=db_settings['PASSWORD'],
                host=db_settings['HOST'],
                port=db_settings['PORT']
            )
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;")
                databases = cur.fetchall()
                
                self.stdout.write("\nAvailable Databases:")
                self.stdout.write("=" * 30)
                for db in databases:
                    name = db[0]
                    suffix = " (Current)" if name == db_settings['NAME'] else ""
                    self.stdout.write(f"- {name}{suffix}")
                self.stdout.write("=" * 30 + "\n")
            conn.close()
        except Exception as e:
            self.stderr.write(f"Error listing databases: {e}")

