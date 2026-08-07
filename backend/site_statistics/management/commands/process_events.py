import json
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from site_statistics.models import EventRaw
from site_statistics.services.queue_driver import RabbitMqDriver
from core.models import Tenant

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Consumes events from RabbitMQ and processes them into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--queue",
            default="statistics_main",
            help="Queue to consume. Defaults to the shared statistics_main queue.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting event processor...")
        driver = RabbitMqDriver()

        connection = driver._get_connection()
        channel = connection.channel()

        exchange_name = driver.exchange_name
        queue_name = options["queue"]

        channel.exchange_declare(exchange=exchange_name, exchange_type="direct", durable=True)
        channel.queue_declare(queue=queue_name, durable=True)

        def callback(ch, method, properties, body):
            try:
                data = json.loads(body)
                self.process_event(data)
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as e:
                logger.error(f"Error processing event: {e}")
                # In production, move to dead letter queue
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        channel.basic_qos(prefetch_count=100)
        channel.basic_consume(queue=queue_name, on_message_callback=callback)

        self.stdout.write("Waiting for events. To exit press CTRL+C")
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
        connection.close()

    def process_event(self, data):
        tenant_id = data.get("tenant_id")
        try:
            tenant = Tenant.objects.get(id=tenant_id)
            event_time = data.get("event_time")
            if isinstance(event_time, str):
                event_time = parse_datetime(event_time)
            if event_time is None:
                event_time = timezone.now()

            EventRaw.objects.create(
                tenant=tenant,
                user_id=data.get("user_id") or "anonymous",
                event_type=data.get("event_type") or "pageview",
                event_time=event_time,
                url=data.get("url"),
                referrer=data.get("referrer"),
                metadata=data.get("metadata", {})
            )
            # In a real system, we might trigger real-time aggregation here
            # or rely on a scheduled task for batch aggregation.
        except Tenant.DoesNotExist:
            logger.error(f"Tenant {tenant_id} not found for event.")
