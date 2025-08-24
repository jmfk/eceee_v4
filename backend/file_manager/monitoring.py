"""
Comprehensive monitoring and health check system for media management.
"""

import time
import psutil
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from django.core.cache import cache
from django.db import connection, models
from django.conf import settings
from django.utils import timezone
from django.core.management.base import BaseCommand
import json

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception

logger = logging.getLogger(__name__)


class HealthChecker:
    """
    Comprehensive health check system for media management.
    """

    def __init__(self):
        self.checks = {
            "database": self._check_database,
            "cache": self._check_cache,
            "storage": self._check_storage,
            "ai_services": self._check_ai_services,
            "disk_space": self._check_disk_space,
            "memory": self._check_memory,
            "celery": self._check_celery,
            "media_processing": self._check_media_processing,
        }

    def run_all_checks(self) -> Dict[str, Any]:
        """Run all health checks and return comprehensive status."""
        results = {
            "timestamp": timezone.now().isoformat(),
            "overall_status": "healthy",
            "checks": {},
            "summary": {
                "total_checks": len(self.checks),
                "passed": 0,
                "failed": 0,
                "warnings": 0,
            },
        }

        for check_name, check_func in self.checks.items():
            try:
                check_result = check_func()
                results["checks"][check_name] = check_result

                if check_result["status"] == "healthy":
                    results["summary"]["passed"] += 1
                elif check_result["status"] == "warning":
                    results["summary"]["warnings"] += 1
                else:
                    results["summary"]["failed"] += 1
                    results["overall_status"] = "unhealthy"

            except Exception as e:
                logger.error(f"Health check {check_name} failed: {e}")
                results["checks"][check_name] = {
                    "status": "error",
                    "message": str(e),
                    "timestamp": timezone.now().isoformat(),
                }
                results["summary"]["failed"] += 1
                results["overall_status"] = "unhealthy"

        return results

    def _check_database(self) -> Dict[str, Any]:
        """Check database connectivity and performance."""
        start_time = time.time()

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()

            response_time = (time.time() - start_time) * 1000  # ms

            # Check connection pool
            db_connections = len(connection.queries)

            status = "healthy"
            message = f"Database responsive in {response_time:.2f}ms"

            if response_time > 1000:  # 1 second
                status = "warning"
                message += " (slow response)"

            return {
                "status": status,
                "message": message,
                "metrics": {
                    "response_time_ms": response_time,
                    "connection_count": db_connections,
                },
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Database connection failed: {e}",
                "timestamp": timezone.now().isoformat(),
            }

    def _check_cache(self) -> Dict[str, Any]:
        """Check cache system health."""
        try:
            test_key = "health_check_test"
            test_value = {"timestamp": time.time()}

            # Test write
            cache.set(test_key, test_value, 60)

            # Test read
            retrieved_value = cache.get(test_key)

            if retrieved_value != test_value:
                raise Exception("Cache read/write mismatch")

            # Clean up
            cache.delete(test_key)

            # Get cache stats if available (Redis)
            cache_info = {}
            try:
                cache_stats = cache._cache.get_client().info()
                cache_info = {
                    "memory_usage": cache_stats.get("used_memory_human", "N/A"),
                    "connected_clients": cache_stats.get("connected_clients", "N/A"),
                    "keyspace_hits": cache_stats.get("keyspace_hits", "N/A"),
                    "keyspace_misses": cache_stats.get("keyspace_misses", "N/A"),
                }
            except:
                pass

            return {
                "status": "healthy",
                "message": "Cache system operational",
                "metrics": cache_info,
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Cache system failed: {e}",
                "timestamp": timezone.now().isoformat(),
            }

    def _check_storage(self) -> Dict[str, Any]:
        """Check S3 storage connectivity and permissions."""
        try:
            from .storage import S3MediaStorage

            storage = S3MediaStorage()
            client = storage._get_s3_client()

            # Test bucket access
            start_time = time.time()
            response = client.head_bucket(Bucket=storage.bucket_name)
            response_time = (time.time() - start_time) * 1000

            # Test write permissions with a small test file
            test_key = f"health_check/{timezone.now().isoformat()}.txt"
            test_content = b"Health check test file"

            client.put_object(
                Bucket=storage.bucket_name, Key=test_key, Body=test_content
            )

            # Clean up test file
            client.delete_object(Bucket=storage.bucket_name, Key=test_key)

            status = "healthy"
            message = f"Storage accessible in {response_time:.2f}ms"

            if response_time > 2000:  # 2 seconds
                status = "warning"
                message += " (slow response)"

            return {
                "status": status,
                "message": message,
                "metrics": {
                    "response_time_ms": response_time,
                    "bucket": storage.bucket_name,
                },
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Storage check failed: {e}",
                "timestamp": timezone.now().isoformat(),
            }

    def _check_ai_services(self) -> Dict[str, Any]:
        """Check AI services availability."""
        try:
            import openai

            if not settings.OPENAI_API_KEY:
                return {
                    "status": "warning",
                    "message": "AI services not configured",
                    "timestamp": timezone.now().isoformat(),
                }

            # Test API connectivity with a minimal request
            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

            start_time = time.time()
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=1,
            )
            response_time = (time.time() - start_time) * 1000

            return {
                "status": "healthy",
                "message": f"AI services responsive in {response_time:.2f}ms",
                "metrics": {
                    "response_time_ms": response_time,
                    "model": "gpt-3.5-turbo",
                },
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "warning",
                "message": f"AI services unavailable: {e}",
                "timestamp": timezone.now().isoformat(),
            }

    def _check_disk_space(self) -> Dict[str, Any]:
        """Check disk space usage."""
        try:
            disk_usage = psutil.disk_usage("/")

            total_gb = disk_usage.total / (1024**3)
            used_gb = disk_usage.used / (1024**3)
            free_gb = disk_usage.free / (1024**3)
            usage_percent = (disk_usage.used / disk_usage.total) * 100

            status = "healthy"
            message = (
                f"Disk usage: {usage_percent:.1f}% ({used_gb:.1f}GB / {total_gb:.1f}GB)"
            )

            if usage_percent > 90:
                status = "error"
                message += " - CRITICAL: Low disk space"
            elif usage_percent > 80:
                status = "warning"
                message += " - WARNING: High disk usage"

            return {
                "status": status,
                "message": message,
                "metrics": {
                    "total_gb": round(total_gb, 2),
                    "used_gb": round(used_gb, 2),
                    "free_gb": round(free_gb, 2),
                    "usage_percent": round(usage_percent, 1),
                },
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Disk space check failed: {e}",
                "timestamp": timezone.now().isoformat(),
            }

    def _check_memory(self) -> Dict[str, Any]:
        """Check memory usage."""
        try:
            memory = psutil.virtual_memory()

            total_gb = memory.total / (1024**3)
            used_gb = memory.used / (1024**3)
            available_gb = memory.available / (1024**3)
            usage_percent = memory.percent

            status = "healthy"
            message = f"Memory usage: {usage_percent:.1f}% ({used_gb:.1f}GB / {total_gb:.1f}GB)"

            if usage_percent > 90:
                status = "error"
                message += " - CRITICAL: High memory usage"
            elif usage_percent > 80:
                status = "warning"
                message += " - WARNING: High memory usage"

            return {
                "status": status,
                "message": message,
                "metrics": {
                    "total_gb": round(total_gb, 2),
                    "used_gb": round(used_gb, 2),
                    "available_gb": round(available_gb, 2),
                    "usage_percent": round(usage_percent, 1),
                },
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Memory check failed: {e}",
                "timestamp": timezone.now().isoformat(),
            }

    def _check_celery(self) -> Dict[str, Any]:
        """Check Celery worker status."""
        try:
            from celery import current_app

            # Get active workers
            inspect = current_app.control.inspect()
            active_workers = inspect.active()

            if not active_workers:
                return {
                    "status": "warning",
                    "message": "No active Celery workers found",
                    "timestamp": timezone.now().isoformat(),
                }

            worker_count = len(active_workers)
            total_tasks = sum(len(tasks) for tasks in active_workers.values())

            return {
                "status": "healthy",
                "message": f"Celery operational: {worker_count} workers, {total_tasks} active tasks",
                "metrics": {
                    "worker_count": worker_count,
                    "active_tasks": total_tasks,
                },
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "warning",
                "message": f"Celery check failed: {e}",
                "timestamp": timezone.now().isoformat(),
            }

    def _check_media_processing(self) -> Dict[str, Any]:
        """Check media processing pipeline health."""
        try:
            from .models import MediaFile

            # Check recent upload success rate
            recent_files = MediaFile.objects.filter(
                created_at__gte=timezone.now() - timedelta(hours=24)
            )

            total_files = recent_files.count()

            if total_files == 0:
                return {
                    "status": "healthy",
                    "message": "No recent uploads to process",
                    "timestamp": timezone.now().isoformat(),
                }

            # Check for files with AI analysis
            analyzed_files = recent_files.exclude(ai_extracted_text="").count()
            analysis_rate = (
                (analyzed_files / total_files) * 100 if total_files > 0 else 0
            )

            # Check for files with thumbnails
            files_with_thumbnails = 0
            for file in recent_files.filter(file_type="image"):
                if hasattr(file, "thumbnails") and file.thumbnails.exists():
                    files_with_thumbnails += 1

            image_files = recent_files.filter(file_type="image").count()
            thumbnail_rate = (
                (files_with_thumbnails / image_files) * 100 if image_files > 0 else 100
            )

            status = "healthy"
            message = f"Processing pipeline healthy: {analysis_rate:.1f}% analyzed, {thumbnail_rate:.1f}% thumbnails"

            if analysis_rate < 50 or thumbnail_rate < 80:
                status = "warning"
                message += " - Some processing delays detected"

            return {
                "status": status,
                "message": message,
                "metrics": {
                    "total_recent_files": total_files,
                    "analysis_rate_percent": round(analysis_rate, 1),
                    "thumbnail_rate_percent": round(thumbnail_rate, 1),
                },
                "timestamp": timezone.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Media processing check failed: {e}",
                "timestamp": timezone.now().isoformat(),
            }


class PerformanceMonitor:
    """
    Monitor system performance metrics.
    """

    def __init__(self):
        self.metrics_cache_key = "performance_metrics"
        self.metrics_retention = 86400  # 24 hours

    def collect_metrics(self) -> Dict[str, Any]:
        """Collect comprehensive performance metrics."""
        metrics = {
            "timestamp": timezone.now().isoformat(),
            "system": self._collect_system_metrics(),
            "database": self._collect_database_metrics(),
            "application": self._collect_application_metrics(),
            "media_system": self._collect_media_metrics(),
        }

        # Store metrics in cache for trending
        self._store_metrics(metrics)

        return metrics

    def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect system-level metrics."""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "disk_percent": (disk.used / disk.total) * 100,
            "load_average": (
                psutil.getloadavg() if hasattr(psutil, "getloadavg") else None
            ),
        }

    def _collect_database_metrics(self) -> Dict[str, Any]:
        """Collect database performance metrics."""
        try:
            with connection.cursor() as cursor:
                # Query performance stats
                cursor.execute(
                    """
                    SELECT 
                        COUNT(*) as active_connections,
                        AVG(EXTRACT(EPOCH FROM (now() - query_start))) as avg_query_time
                    FROM pg_stat_activity 
                    WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'
                """
                )

                result = cursor.fetchone()

                return {
                    "active_connections": result[0] if result else 0,
                    "avg_query_time_seconds": result[1] if result and result[1] else 0,
                    "total_queries": len(connection.queries),
                }
        except Exception as e:
            logger.error(f"Database metrics collection failed: {e}")
            return {"error": str(e)}

    def _collect_application_metrics(self) -> Dict[str, Any]:
        """Collect application-level metrics."""
        try:
            # Cache hit rate
            cache_stats = {}
            try:
                redis_info = cache._cache.get_client().info()
                keyspace_hits = redis_info.get("keyspace_hits", 0)
                keyspace_misses = redis_info.get("keyspace_misses", 0)
                total_requests = keyspace_hits + keyspace_misses

                cache_stats = {
                    "hit_rate_percent": (
                        (keyspace_hits / total_requests * 100)
                        if total_requests > 0
                        else 0
                    ),
                    "total_keys": (
                        redis_info.get("db0", {}).get("keys", 0)
                        if "db0" in redis_info
                        else 0
                    ),
                }
            except:
                pass

            return {
                "cache": cache_stats,
                "uptime_seconds": time.time() - psutil.Process().create_time(),
            }
        except Exception as e:
            logger.error(f"Application metrics collection failed: {e}")
            return {"error": str(e)}

    def _collect_media_metrics(self) -> Dict[str, Any]:
        """Collect media system specific metrics."""
        try:
            from .models import MediaFile, MediaCollection, MediaTag

            # File statistics
            total_files = MediaFile.objects.count()
            total_size = (
                MediaFile.objects.aggregate(total=models.Sum("file_size"))["total"] or 0
            )

            # Recent activity
            recent_uploads = MediaFile.objects.filter(
                created_at__gte=timezone.now() - timedelta(hours=24)
            ).count()

            # File type distribution
            file_types = MediaFile.objects.values("file_type").annotate(
                count=models.Count("id")
            )

            return {
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_gb": round(total_size / (1024**3), 2),
                "recent_uploads_24h": recent_uploads,
                "total_collections": MediaCollection.objects.count(),
                "total_tags": MediaTag.objects.count(),
                "file_type_distribution": {
                    ft["file_type"]: ft["count"] for ft in file_types
                },
            }
        except Exception as e:
            logger.error(f"Media metrics collection failed: {e}")
            return {"error": str(e)}

    def _store_metrics(self, metrics: Dict[str, Any]):
        """Store metrics for historical tracking."""
        try:
            # Get existing metrics
            existing_metrics = cache.get(self.metrics_cache_key, [])

            # Add new metrics
            existing_metrics.append(metrics)

            # Keep only last 24 hours of metrics (assuming 5-minute intervals)
            max_entries = 288  # 24 hours * 12 (5-minute intervals)
            if len(existing_metrics) > max_entries:
                existing_metrics = existing_metrics[-max_entries:]

            # Store back in cache
            cache.set(self.metrics_cache_key, existing_metrics, self.metrics_retention)

        except Exception as e:
            logger.error(f"Metrics storage failed: {e}")

    def get_historical_metrics(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get historical metrics for the specified number of hours."""
        try:
            all_metrics = cache.get(self.metrics_cache_key, [])

            # Filter by time range
            cutoff_time = timezone.now() - timedelta(hours=hours)

            filtered_metrics = [
                metric
                for metric in all_metrics
                if datetime.fromisoformat(metric["timestamp"].replace("Z", "+00:00"))
                >= cutoff_time
            ]

            return filtered_metrics

        except Exception as e:
            logger.error(f"Historical metrics retrieval failed: {e}")
            return []


class AlertManager:
    """
    Manage alerts and notifications for system health issues.
    """

    def __init__(self):
        self.alert_thresholds = {
            "cpu_percent": 80,
            "memory_percent": 85,
            "disk_percent": 90,
            "response_time_ms": 5000,
            "error_rate_percent": 5,
        }
        self.alert_cooldown = 3600  # 1 hour cooldown between similar alerts

    def check_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check metrics against thresholds and generate alerts."""
        alerts = []

        # System alerts
        if (
            metrics.get("system", {}).get("cpu_percent", 0)
            > self.alert_thresholds["cpu_percent"]
        ):
            alerts.append(
                {
                    "type": "system",
                    "level": "warning",
                    "message": f"High CPU usage: {metrics['system']['cpu_percent']:.1f}%",
                    "timestamp": timezone.now().isoformat(),
                }
            )

        if (
            metrics.get("system", {}).get("memory_percent", 0)
            > self.alert_thresholds["memory_percent"]
        ):
            alerts.append(
                {
                    "type": "system",
                    "level": "warning",
                    "message": f"High memory usage: {metrics['system']['memory_percent']:.1f}%",
                    "timestamp": timezone.now().isoformat(),
                }
            )

        if (
            metrics.get("system", {}).get("disk_percent", 0)
            > self.alert_thresholds["disk_percent"]
        ):
            alerts.append(
                {
                    "type": "system",
                    "level": "critical",
                    "message": f"High disk usage: {metrics['system']['disk_percent']:.1f}%",
                    "timestamp": timezone.now().isoformat(),
                }
            )

        # Database alerts
        db_metrics = metrics.get("database", {})
        if db_metrics.get("avg_query_time_seconds", 0) > 5:  # 5 seconds
            alerts.append(
                {
                    "type": "database",
                    "level": "warning",
                    "message": f"Slow database queries: {db_metrics['avg_query_time_seconds']:.2f}s average",
                    "timestamp": timezone.now().isoformat(),
                }
            )

        return alerts

    def send_alert(self, alert: Dict[str, Any]):
        """Send alert notification."""
        # Check cooldown
        cooldown_key = f"alert_cooldown:{alert['type']}:{alert['level']}"
        if cache.get(cooldown_key):
            return  # Skip due to cooldown

        # Set cooldown
        cache.set(cooldown_key, True, self.alert_cooldown)

        # Log alert
        logger.warning(
            f"ALERT [{alert['level'].upper()}] {alert['type']}: {alert['message']}"
        )

        # Send notification (email, Slack, etc.)
        self._send_notification(alert)

    def _send_notification(self, alert: Dict[str, Any]):
        """Send notification via configured channels."""
        # Implementation would depend on notification preferences
        # Could integrate with email, Slack, PagerDuty, etc.
        pass
