"""
Management command for comprehensive media system health checks.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from file_manager.monitoring import HealthChecker, PerformanceMonitor, AlertManager
import json


class Command(BaseCommand):
    help = "Run comprehensive health checks for the media system"

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            choices=["json", "text"],
            default="text",
            help="Output format (default: text)",
        )
        parser.add_argument(
            "--alerts", action="store_true", help="Check and send alerts for issues"
        )
        parser.add_argument(
            "--metrics", action="store_true", help="Include performance metrics"
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS(f"Starting health check at {timezone.now()}")
        )

        # Run health checks
        health_checker = HealthChecker()
        health_results = health_checker.run_all_checks()

        # Collect metrics if requested
        metrics = None
        if options["metrics"]:
            performance_monitor = PerformanceMonitor()
            metrics = performance_monitor.collect_metrics()

        # Check alerts if requested
        alerts = []
        if options["alerts"] and metrics:
            alert_manager = AlertManager()
            alerts = alert_manager.check_alerts(metrics)

            # Send alerts
            for alert in alerts:
                alert_manager.send_alert(alert)

        # Output results
        if options["format"] == "json":
            output = {
                "health": health_results,
                "metrics": metrics,
                "alerts": alerts,
            }
            self.stdout.write(json.dumps(output, indent=2))
        else:
            self._output_text_format(health_results, metrics, alerts)

    def _output_text_format(self, health_results, metrics, alerts):
        """Output results in human-readable text format."""
        # Health check summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.HTTP_INFO("HEALTH CHECK SUMMARY"))
        self.stdout.write("=" * 60)

        overall_status = health_results["overall_status"]
        if overall_status == "healthy":
            status_style = self.style.SUCCESS
        elif overall_status == "warning":
            status_style = self.style.WARNING
        else:
            status_style = self.style.ERROR

        self.stdout.write(f"Overall Status: {status_style(overall_status.upper())}")

        summary = health_results["summary"]
        self.stdout.write(
            f"Checks: {summary['passed']} passed, {summary['warnings']} warnings, {summary['failed']} failed"
        )

        # Individual check results
        self.stdout.write("\n" + "-" * 40)
        self.stdout.write("INDIVIDUAL CHECKS")
        self.stdout.write("-" * 40)

        for check_name, result in health_results["checks"].items():
            status = result["status"]
            message = result["message"]

            if status == "healthy":
                status_icon = self.style.SUCCESS("✓")
            elif status == "warning":
                status_icon = self.style.WARNING("⚠")
            else:
                status_icon = self.style.ERROR("✗")

            self.stdout.write(f"{status_icon} {check_name.title()}: {message}")

            # Show metrics if available
            if "metrics" in result and result["metrics"]:
                for key, value in result["metrics"].items():
                    self.stdout.write(f"    {key}: {value}")

        # Performance metrics
        if metrics:
            self.stdout.write("\n" + "-" * 40)
            self.stdout.write("PERFORMANCE METRICS")
            self.stdout.write("-" * 40)

            system_metrics = metrics.get("system", {})
            self.stdout.write(f"CPU Usage: {system_metrics.get('cpu_percent', 'N/A')}%")
            self.stdout.write(
                f"Memory Usage: {system_metrics.get('memory_percent', 'N/A')}%"
            )
            self.stdout.write(
                f"Disk Usage: {system_metrics.get('disk_percent', 'N/A'):.1f}%"
            )

            media_metrics = metrics.get("media_system", {})
            if media_metrics:
                self.stdout.write(
                    f"Total Files: {media_metrics.get('total_files', 'N/A')}"
                )
                self.stdout.write(
                    f"Total Size: {media_metrics.get('total_size_gb', 'N/A')} GB"
                )
                self.stdout.write(
                    f"Recent Uploads (24h): {media_metrics.get('recent_uploads_24h', 'N/A')}"
                )

        # Alerts
        if alerts:
            self.stdout.write("\n" + "-" * 40)
            self.stdout.write(self.style.ERROR("ACTIVE ALERTS"))
            self.stdout.write("-" * 40)

            for alert in alerts:
                level = alert["level"]
                message = alert["message"]

                if level == "critical":
                    alert_style = self.style.ERROR
                else:
                    alert_style = self.style.WARNING

                self.stdout.write(f"{alert_style(level.upper())}: {message}")

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(f"Health check completed at {timezone.now()}")
        self.stdout.write("=" * 60)
