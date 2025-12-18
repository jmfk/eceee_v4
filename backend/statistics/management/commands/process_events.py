import json
import logging
import pika
from django.core.management.base import BaseCommand
from django.conf import settings
from statistics.models import EventRaw
from statistics.services.queue_driver import RabbitMqDriver
from core.models import Tenant

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Consumes events from RabbitMQ and processes them into the database."

    def handle(self, *args, **options):
        self.stdout.write("Starting event processor...")
        driver = RabbitMqDriver()
        
        # We need a way to listen to all tenant queues. 
        # For simplicity in this MVP, we'll use a main exchange and a single queue 
        # that all tenants feed into, OR we discover queues.
        # Let's use a single main queue for now to simplify the worker.
        
        connection = driver._get_connection()
        channel = connection.channel()
        
        exchange_name = "statistics_events"
        queue_name = "statistics_main"
        
        channel.exchange_declare(exchange=exchange_name, exchange_type="direct", durable=True)
        channel.queue_declare(queue=queue_name, durable=True)
        # Bind all existing tenants to this queue for now, or use a wildcard if using topic exchange
        # For now, let's just use a single queue "statistics_main" for ingestion
        
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
            EventRaw.objects.create(
                tenant_id=tenant,
                user_id=data.get("user_id"),
                event_type=data.get("event_type"),
                event_time=data.get("event_time"),
                url=data.get("url"),
                referrer=data.get("referrer"),
                metadata=data.get("metadata", {})
            )
            # In a real system, we might trigger real-time aggregation here
            # or rely on a scheduled task for batch aggregation.
        except Tenant.DoesNotExist:
            logger.error(f"Tenant {tenant_id} not found for event.")

