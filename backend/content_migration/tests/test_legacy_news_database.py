from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from content_migration.legacy_news.database import LegacyNewsDatabase


class LegacyNewsDatabaseTests(SimpleTestCase):
    @patch("content_migration.legacy_news.database.psycopg2.connect")
    def test_connection_is_forced_read_only(self, connect):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = (73,)
        connect.return_value = connection

        database = LegacyNewsDatabase(
            host="127.0.0.1",
            port=10110,
            dbname="legacy",
            user="reader",
            password="not-logged",
        )

        connection.set_session.assert_called_once_with(readonly=True, autocommit=False)
        self.assertEqual(database._news_content_type_id, 73)
        query = cursor.execute.call_args.args[0]
        self.assertIn("django_content_type", query)
        database.close()
        connection.rollback.assert_called_once()
        connection.close.assert_called_once()
