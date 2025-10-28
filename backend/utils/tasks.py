"""
Celery tasks for AI Agent execution in ECEEE v4

This module contains all Celery tasks for running AI agents in the background
and providing real-time updates to the frontend.
"""

import logging
import time
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from celery import shared_task, current_task
from django.utils import timezone
from django.conf import settings
from django.core.cache import cache

# Import AI services
import openai
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class AIAgentTaskManager:
    """
    Manager class for AI agent task execution with progress tracking
    and real-time updates.
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.task_instance = None
        self._load_task()

    def _load_task(self):
        """Load the AIAgentTask instance."""
        from .models import AIAgentTask

        try:
            self.task_instance = AIAgentTask.objects.get(id=self.task_id)
        except AIAgentTask.DoesNotExist:
            raise ValueError(f"AI Agent Task {self.task_id} not found")

    def update_progress(self, progress: int, message: str, data: Dict[str, Any] = None):
        """Update task progress and send real-time notification."""
        from .models import AIAgentTaskUpdate
        from .notifications import send_task_update

        # Update the main task
        self.task_instance.progress = progress
        self.task_instance.save(update_fields=["progress", "updated_at"])

        # Create progress update record
        update = AIAgentTaskUpdate.objects.create(
            task=self.task_instance,
            update_type="progress",
            message=message,
            data=data or {},
            progress_percentage=progress,
        )

        # Send real-time notification
        send_task_update(
            self.task_instance.id,
            {
                "type": "progress",
                "progress": progress,
                "message": message,
                "data": data,
                "timestamp": update.timestamp.isoformat(),
            },
        )


    def update_status(self, status: str, message: str = None):
        """Update task status."""
        from .models import AIAgentTaskUpdate
        from .notifications import send_task_update

        old_status = self.task_instance.status
        self.task_instance.status = status
        self.task_instance.save()

        # Create status update record
        update_message = message or f"Status changed from {old_status} to {status}"
        update = AIAgentTaskUpdate.objects.create(
            task=self.task_instance,
            update_type="status",
            message=update_message,
            data={"old_status": old_status, "new_status": status},
        )

        # Send real-time notification
        send_task_update(
            self.task_instance.id,
            {
                "type": "status",
                "status": status,
                "message": update_message,
                "timestamp": update.timestamp.isoformat(),
            },
        )


    def add_result(
        self, result_data: Dict[str, Any], message: str = "Result generated"
    ):
        """Add partial or final results."""
        from .models import AIAgentTaskUpdate
        from .notifications import send_task_update

        # Update main task results
        current_results = self.task_instance.result_data or {}
        current_results.update(result_data)
        self.task_instance.result_data = current_results
        self.task_instance.save(update_fields=["result_data", "updated_at"])

        # Create result update record
        update = AIAgentTaskUpdate.objects.create(
            task=self.task_instance,
            update_type="result",
            message=message,
            data=result_data,
        )

        # Send real-time notification
        send_task_update(
            self.task_instance.id,
            {
                "type": "result",
                "message": message,
                "data": result_data,
                "timestamp": update.timestamp.isoformat(),
            },
        )


    def log_error(self, error: str, data: Dict[str, Any] = None):
        """Log an error or warning."""
        from .models import AIAgentTaskUpdate
        from .notifications import send_task_update

        # Create error update record
        update = AIAgentTaskUpdate.objects.create(
            task=self.task_instance, update_type="error", message=error, data=data or {}
        )

        # Send real-time notification
        send_task_update(
            self.task_instance.id,
            {
                "type": "error",
                "message": error,
                "data": data,
                "timestamp": update.timestamp.isoformat(),
            },
        )

        logger.warning(f"Task {self.task_id} error: {error}")


@shared_task(bind=True, max_retries=3)
def execute_ai_agent_task(self, task_id: str):
    """
    Main Celery task for executing AI agent tasks.

    This task handles the orchestration of AI agent execution with
    progress tracking and real-time updates.
    """
    manager = AIAgentTaskManager(task_id)

    try:
        # Update task status to running
        manager.update_status("running", "AI agent task started")

        # Update Celery task ID
        if hasattr(self, "request") and hasattr(self.request, "id"):
            manager.task_instance.celery_task_id = self.request.id
            manager.task_instance.save(update_fields=["celery_task_id"])

        # Get task configuration
        task_type = manager.task_instance.task_type
        config = manager.task_instance.task_config

        # Route to appropriate handler
        if task_type == "summary":
            result = _execute_summary_task(manager, config)
        elif task_type == "research":
            result = _execute_research_task(manager, config)
        elif task_type == "content_generation":
            result = _execute_content_generation_task(manager, config)
        elif task_type == "data_analysis":
            result = _execute_data_analysis_task(manager, config)
        else:
            result = _execute_custom_task(manager, config)

        # Mark task as completed
        manager.update_status("completed", "AI agent task completed successfully")
        manager.add_result({"final_result": result}, "Task completed")

        return result

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()

        logger.error(f"AI Agent task {task_id} failed: {error_msg}\n{error_trace}")

        # Update task status to failed
        manager.task_instance.status = "failed"
        manager.task_instance.error_message = (
            f"{error_msg}\n\nTraceback:\n{error_trace}"
        )
        manager.task_instance.save()

        manager.log_error(f"Task failed: {error_msg}", {"traceback": error_trace})

        # Retry if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            raise self.retry(countdown=60 * (2**self.request.retries))

        raise


def _execute_summary_task(
    manager: AIAgentTaskManager, config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute content summarization task."""
    manager.update_progress(10, "Initializing summarization task")

    # Get content to summarize
    content = config.get("content", "")
    urls = config.get("urls", [])
    max_length = config.get("max_length", 500)

    if not content and not urls:
        raise ValueError("No content or URLs provided for summarization")

    # Fetch content from URLs if provided
    if urls:
        manager.update_progress(20, f"Fetching content from {len(urls)} URLs")
        fetched_content = []

        for i, url in enumerate(urls):
            try:
                manager.update_progress(20 + (i * 30 // len(urls)), f"Fetching: {url}")
                response = requests.get(url, timeout=30)
                response.raise_for_status()

                soup = BeautifulSoup(response.content, "html.parser")
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                text = soup.get_text()
                fetched_content.append(
                    {
                        "url": url,
                        "title": soup.title.string if soup.title else url,
                        "content": text[:5000],  # Limit content length
                    }
                )

            except Exception as e:
                manager.log_error(f"Failed to fetch {url}: {str(e)}")

        content = "\n\n".join(
            [f"## {item['title']}\n{item['content']}" for item in fetched_content]
        )

    # Generate summary using OpenAI
    manager.update_progress(60, "Generating AI summary")

    if not settings.OPENAI_API_KEY:
        raise ValueError("OpenAI API key not configured")

    openai.api_key = settings.OPENAI_API_KEY

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": f"You are a helpful assistant that creates concise summaries. "
                    f"Summarize the following content in approximately {max_length} words.",
                },
                {
                    "role": "user",
                    "content": content[:10000],  # Limit input to avoid token limits
                },
            ],
            max_tokens=max_length * 2,  # Rough token estimate
            temperature=0.3,
        )

        summary = response.choices[0].message.content

        manager.update_progress(90, "Summary generated successfully")

        return {
            "summary": summary,
            "original_length": len(content),
            "summary_length": len(summary),
            "urls_processed": len(urls) if urls else 0,
        }

    except Exception as e:
        raise ValueError(f"Failed to generate summary: {str(e)}")


def _execute_research_task(
    manager: AIAgentTaskManager, config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute research and analysis task."""
    manager.update_progress(10, "Initializing research task")

    topic = config.get("topic", "")
    urls = config.get("urls", [])
    questions = config.get("questions", [])

    if not topic and not urls:
        raise ValueError("No topic or URLs provided for research")

    research_data = []

    # Research from provided URLs
    if urls:
        manager.update_progress(20, f"Researching {len(urls)} sources")

        for i, url in enumerate(urls):
            try:
                manager.update_progress(20 + (i * 40 // len(urls)), f"Analyzing: {url}")
                response = requests.get(url, timeout=30)
                response.raise_for_status()

                soup = BeautifulSoup(response.content, "html.parser")
                title = soup.title.string if soup.title else url

                # Extract key information
                text = soup.get_text()
                research_data.append(
                    {
                        "url": url,
                        "title": title,
                        "content": text[:3000],
                        "word_count": len(text.split()),
                    }
                )

            except Exception as e:
                manager.log_error(f"Failed to research {url}: {str(e)}")

    # Generate research analysis using AI
    manager.update_progress(70, "Generating research analysis")

    if not settings.OPENAI_API_KEY:
        raise ValueError("OpenAI API key not configured")

    openai.api_key = settings.OPENAI_API_KEY

    research_content = "\n\n".join(
        [f"Source: {item['title']}\n{item['content']}" for item in research_data]
    )

    prompt = f"Research Topic: {topic}\n\nSources:\n{research_content}"
    if questions:
        prompt += f"\n\nSpecific Questions to Address:\n" + "\n".join(
            [f"- {q}" for q in questions]
        )

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a research analyst. Provide a comprehensive analysis "
                    "of the given sources, highlighting key findings, insights, and conclusions.",
                },
                {"role": "user", "content": prompt[:10000]},
            ],
            max_tokens=2000,
            temperature=0.2,
        )

        analysis = response.choices[0].message.content

        manager.update_progress(95, "Research analysis completed")

        return {
            "topic": topic,
            "analysis": analysis,
            "sources": research_data,
            "questions_addressed": questions,
        }

    except Exception as e:
        raise ValueError(f"Failed to generate research analysis: {str(e)}")


def _execute_content_generation_task(
    manager: AIAgentTaskManager, config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute content generation task."""
    manager.update_progress(10, "Initializing content generation")

    content_type = config.get("content_type", "article")
    topic = config.get("topic", "")
    keywords = config.get("keywords", [])
    length = config.get("length", 1000)
    tone = config.get("tone", "professional")

    if not topic:
        raise ValueError("No topic provided for content generation")

    manager.update_progress(30, f"Generating {content_type} about: {topic}")

    if not settings.OPENAI_API_KEY:
        raise ValueError("OpenAI API key not configured")

    openai.api_key = settings.OPENAI_API_KEY

    # Build prompt
    prompt = f"Write a {content_type} about {topic}. "
    prompt += f"Target length: approximately {length} words. "
    prompt += f"Tone: {tone}. "

    if keywords:
        prompt += f"Include these keywords naturally: {', '.join(keywords)}. "

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": f"You are a professional content writer. Create high-quality, "
                    f"engaging {content_type} content that is informative and well-structured.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=length * 2,
            temperature=0.7,
        )

        content = response.choices[0].message.content

        manager.update_progress(90, "Content generated successfully")

        return {
            "content_type": content_type,
            "topic": topic,
            "content": content,
            "word_count": len(content.split()),
            "keywords_used": keywords,
            "tone": tone,
        }

    except Exception as e:
        raise ValueError(f"Failed to generate content: {str(e)}")


def _execute_data_analysis_task(
    manager: AIAgentTaskManager, config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute data analysis task."""
    manager.update_progress(10, "Initializing data analysis")

    data = config.get("data", {})
    analysis_type = config.get("analysis_type", "summary")

    if not data:
        raise ValueError("No data provided for analysis")

    manager.update_progress(40, f"Performing {analysis_type} analysis")

    # Basic statistical analysis
    if isinstance(data, dict) and "values" in data:
        values = data["values"]
        if isinstance(values, list) and all(
            isinstance(x, (int, float)) for x in values
        ):
            import statistics

            analysis_result = {
                "count": len(values),
                "mean": statistics.mean(values),
                "median": statistics.median(values),
                "mode": (
                    statistics.mode(values) if len(set(values)) < len(values) else None
                ),
                "std_dev": statistics.stdev(values) if len(values) > 1 else 0,
                "min": min(values),
                "max": max(values),
                "range": max(values) - min(values),
            }
        else:
            analysis_result = {"error": "Data values must be numeric"}
    else:
        analysis_result = {"error": "Invalid data format"}

    manager.update_progress(90, "Data analysis completed")

    return {
        "analysis_type": analysis_type,
        "data_summary": analysis_result,
        "data_points": len(data.get("values", [])) if isinstance(data, dict) else 0,
    }


def _execute_custom_task(
    manager: AIAgentTaskManager, config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute custom AI task."""
    manager.update_progress(10, "Initializing custom task")

    # Custom task implementation would go here
    # For now, just simulate some work

    for i in range(1, 10):
        time.sleep(1)  # Simulate work
        manager.update_progress(10 + i * 9, f"Processing step {i}/9")

    return {"message": "Custom task completed", "config": config}


@shared_task
def cleanup_old_tasks():
    """Clean up old completed/failed tasks to prevent database bloat."""
    from .models import AIAgentTask, AIAgentTaskUpdate

    # Delete tasks older than 30 days
    cutoff_date = timezone.now() - timedelta(days=30)

    old_tasks = AIAgentTask.objects.filter(
        created_at__lt=cutoff_date, status__in=["completed", "failed", "cancelled"]
    )

    task_count = old_tasks.count()
    old_tasks.delete()


    return f"Cleaned up {task_count} tasks"


@shared_task
def cancel_stuck_tasks():
    """Cancel tasks that have been running for too long."""
    from .models import AIAgentTask

    # Cancel tasks running for more than 2 hours
    cutoff_time = timezone.now() - timedelta(hours=2)

    stuck_tasks = AIAgentTask.objects.filter(
        status="running", started_at__lt=cutoff_time
    )

    for task in stuck_tasks:
        task.status = "cancelled"
        task.error_message = "Task cancelled due to timeout"
        task.save()

        # Send notification
        from .notifications import send_task_update

        send_task_update(
            task.id,
            {
                "type": "status",
                "status": "cancelled",
                "message": "Task cancelled due to timeout",
            },
        )

    count = stuck_tasks.count()

    return f"Cancelled {count} stuck tasks"
