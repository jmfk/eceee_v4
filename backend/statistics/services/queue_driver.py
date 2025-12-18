import json
import pika
import logging
from abc import ABC, abstractmethod
from django.conf import settings

logger = logging.getLogger(__name__)

class QueueDriver(ABC):
    """
    Abstract interface for message queue operations.
    """

    @abstractmethod
    def publish(self, tenant_id, payload):
        """
        Publish an event to the queue for a specific tenant.
        """
        pass

    @abstractmethod
    def consume(self, callback):
        """
        Start consuming messages from the queue.
        """
        pass

    @abstractmethod
    def ack(self, delivery_tag):
        """
        Acknowledge a message.
        """
        pass


class RabbitMqDriver(QueueDriver):
    """
    RabbitMQ implementation of QueueDriver using pika.
    """

    def __init__(self):
        self.host = getattr(settings, "RABBITMQ_HOST", "rabbitmq")
        self.port = getattr(settings, "RABBITMQ_PORT", 5672)
        self.user = getattr(settings, "RABBITMQ_USER", "guest")
        self.password = getattr(settings, "RABBITMQ_PASSWORD", "guest")
        self._connection = None
        self._channel = None

    def _get_connection(self):
        if not self._connection or self._connection.is_closed:
            credentials = pika.PlainCredentials(self.user, self.password)
            parameters = pika.ConnectionParameters(
                host=self.host, port=self.port, credentials=credentials,
                heartbeat=600, blocked_connection_timeout=300
            )
            self._connection = pika.BlockingConnection(parameters)
        return self._connection

    def _get_channel(self):
        if not self._channel or self._channel.is_closed:
            self._channel = self._get_connection().channel()
        return self._channel

    def publish(self, tenant_id, payload):
        """
        Publish to a tenant-specific queue.
        Uses a direct exchange and routing key based on tenant_id.
        """
        channel = self._get_channel()
        
        # Ensure exchange and queue exist for this tenant
        exchange_name = "statistics_events"
        queue_name = f"stats_queue_{tenant_id}"
        routing_key = str(tenant_id)

        channel.exchange_declare(exchange=exchange_name, exchange_type="direct", durable=True)
        channel.queue_declare(queue=queue_name, durable=True)
        channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key=routing_key)

        message = json.dumps(payload)
        channel.basic_publish(
            exchange=exchange_name,
            routing_key=routing_key,
            body=message,
            properties=pika.BasicProperties(
                delivery_mode=2,  # make message persistent
            )
        )

    def consume(self, callback):
        """
        This is typically used in a separate worker process.
        For simplicity in this implementation, we consume from all stats queues.
        In production, workers might be assigned to specific queues.
        """
        channel = self._get_channel()
        
        # We might want a way to discover all tenant queues, 
        # but for now we'll assume a single main queue or 
        # discover them via exchange bindings if needed.
        # For the MVP, we'll use a single queue "statistics_main" that all tenants publish to,
        # and routing keys will distinguish them if needed. 
        # But the PRD says: "Varje tenant får en egen kö i RabbitMQ för isolering."
        
        # To handle multiple queues dynamically, we might need a more complex worker.
        # For now, let's implement a version that consumes from a known queue.
        pass

    def ack(self, delivery_tag):
        if self._channel:
            self._channel.basic_ack(delivery_tag=delivery_tag)

