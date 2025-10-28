"""
AI Client Service

Centralized service for making AI API calls with automatic cost tracking.
Supports multiple providers (OpenAI, Anthropic, etc.) with unified interface.
"""

import time
import logging
from decimal import Decimal
from typing import Optional, Dict, Any
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class AIClient:
    """
    Universal AI client that wraps provider-specific APIs.

    Automatically tracks usage, calculates costs, and logs to database.
    Supports both sync and async operations.
    """

    def __init__(self, provider="openai", model=None, user=None, prompt_type=None):
        """
        Initialize AI client.

        Args:
            provider: AI provider name ('openai', 'anthropic', etc.)
            model: Model name (e.g., 'gpt-4', 'claude-3-opus')
            user: Django user making the request
            prompt_type: Optional stable identifier for this prompt type
        """
        self.provider = provider.lower()
        self.model = model
        self.user = user
        self.prompt_type = prompt_type
        self._client = None

        # Get settings
        self.tracking_settings = getattr(settings, "AI_TRACKING", {})
        self.store_prompts_default = self.tracking_settings.get(
            "STORE_PROMPTS_BY_DEFAULT", False
        )
        self.store_responses_default = self.tracking_settings.get(
            "STORE_RESPONSES_BY_DEFAULT", False
        )

    def _get_client(self):
        """Get the appropriate provider client."""
        if self._client:
            return self._client

        if self.provider == "openai":
            import openai

            api_key = getattr(settings, "OPENAI_API_KEY", None)
            if not api_key:
                raise ValueError("OPENAI_API_KEY not configured in settings")
            self._client = openai.OpenAI(api_key=api_key)
            return self._client

        elif self.provider == "anthropic":
            import anthropic

            api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not configured in settings")
            self._client = anthropic.Anthropic(api_key=api_key)
            return self._client

        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def _get_current_price(self):
        """Fetch current pricing from database."""
        from ai_tracking.models import AIModelPrice

        price = AIModelPrice.get_current_price(self.provider, self.model)
        if not price:
            logger.warning(
                f"No pricing found for {self.provider}/{self.model}. "
                "Cost tracking will not be accurate."
            )
            return None

        if price.is_stale:
            logger.warning(
                f"Price for {self.provider}/{self.model} is marked as stale. "
                "Consider updating pricing information."
            )

        return price

    def _calculate_cost(self, input_tokens, output_tokens):
        """Calculate cost based on token usage."""
        price = self._get_current_price()
        if not price:
            return Decimal("0")

        return price.calculate_cost(input_tokens, output_tokens)

    def _log_usage(
        self,
        input_tokens,
        output_tokens,
        cost,
        task_description,
        content_object=None,
        metadata=None,
        prompt="",
        response="",
        store_full_data=False,
        duration_ms=None,
        error_message="",
        was_successful=True,
    ):
        """Create usage log entry in database."""
        from ai_tracking.models import AIUsageLog

        log_data = {
            "provider": self.provider,
            "model_name": self.model,
            "user": self.user,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost": cost,
            "task_description": task_description,
            "metadata": metadata or {},
            "store_full_data": store_full_data,
            "duration_ms": duration_ms,
            "error_message": error_message,
            "was_successful": was_successful,
        }

        # Add content object if provided
        if content_object:
            log_data["content_type"] = ContentType.objects.get_for_model(content_object)
            log_data["object_id"] = content_object.pk

        # Store prompt/response if configured
        if store_full_data:
            log_data["prompt"] = prompt
            log_data["response"] = response

        return AIUsageLog.objects.create(**log_data)

    def call(
        self,
        prompt,
        task_description,
        content_object=None,
        store_full_data=None,
        metadata=None,
        **kwargs,
    ):
        """
        Make synchronous AI API call.

        Args:
            prompt: The prompt text or messages
            task_description: Brief description of the task
            content_object: Optional Django model instance to link
            store_full_data: Whether to store full prompt/response (overrides default)
            metadata: Additional context data (dict)
            **kwargs: Provider-specific parameters

        Returns:
            dict: {
                'response': AI response text/object,
                'usage': {
                    'input_tokens': int,
                    'output_tokens': int,
                    'total_cost': Decimal
                },
                'log': AIUsageLog instance
            }
        """
        from ai_tracking.models import AIPromptConfig

        start_time = time.time()

        # Get or create prompt config if prompt_type is provided
        prompt_config = None
        if self.prompt_type:
            prompt_config, created = AIPromptConfig.objects.get_or_create(
                prompt_type=self.prompt_type,
                defaults={"description": task_description},
            )

            # Override store_full_data from config if not explicitly set
            if store_full_data is None:
                store_full_data = prompt_config.track_full_data

        # Determine if we should store full data (existing fallback logic)
        if store_full_data is None:
            store_full_data = self.store_prompts_default or self.store_responses_default

        try:
            # Make the actual API call
            if self.provider == "openai":
                result = self._call_openai(prompt, **kwargs)
            elif self.provider == "anthropic":
                result = self._call_anthropic(prompt, **kwargs)
            else:
                raise ValueError(f"Unsupported provider: {self.provider}")

            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)

            # Extract token usage
            input_tokens = result["usage"]["input_tokens"]
            output_tokens = result["usage"]["output_tokens"]

            # Calculate cost
            cost = self._calculate_cost(input_tokens, output_tokens)

            # Update prompt config with latest call data
            if prompt_config:
                prompt_config.last_prompt = str(prompt)
                prompt_config.last_response = str(result["response"])
                prompt_config.last_input_tokens = input_tokens
                prompt_config.last_output_tokens = output_tokens
                prompt_config.last_cost = cost
                prompt_config.last_user = self.user
                prompt_config.last_metadata = metadata or {}
                prompt_config.last_called_at = timezone.now()
                prompt_config.last_duration_ms = duration_ms
                prompt_config.total_calls += 1
                prompt_config.total_cost += cost
                prompt_config.save()

            # Only create usage log if active (or no config)
            log = None
            if not prompt_config or prompt_config.is_active:
                log = self._log_usage(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost,
                    task_description=task_description,
                    content_object=content_object,
                    metadata=metadata,
                    prompt=str(prompt) if store_full_data else "",
                    response=str(result["response"]) if store_full_data else "",
                    store_full_data=store_full_data,
                    duration_ms=duration_ms,
                    was_successful=True,
                )

            return {
                "response": result["response"],
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_cost": cost,
                },
                "log": log,
            }

        except Exception as e:
            # Log failed call
            duration_ms = int((time.time() - start_time) * 1000)

            # Update prompt config even on failure
            if prompt_config:
                prompt_config.last_prompt = str(prompt)
                prompt_config.last_response = f"ERROR: {str(e)}"
                prompt_config.last_input_tokens = 0
                prompt_config.last_output_tokens = 0
                prompt_config.last_cost = Decimal("0")
                prompt_config.last_user = self.user
                prompt_config.last_metadata = metadata or {}
                prompt_config.last_called_at = timezone.now()
                prompt_config.last_duration_ms = duration_ms
                prompt_config.total_calls += 1
                prompt_config.save()

            # Only create usage log if active (or no config)
            log = None
            if not prompt_config or prompt_config.is_active:
                log = self._log_usage(
                    input_tokens=0,
                    output_tokens=0,
                    cost=Decimal("0"),
                    task_description=task_description,
                    content_object=content_object,
                    metadata=metadata,
                    prompt=str(prompt) if store_full_data else "",
                    response="",
                    store_full_data=store_full_data,
                    duration_ms=duration_ms,
                    error_message=str(e),
                    was_successful=False,
                )

            logger.error(f"AI API call failed: {e}")
            raise

    async def acall(
        self,
        prompt,
        task_description,
        content_object=None,
        store_full_data=None,
        metadata=None,
        **kwargs,
    ):
        """
        Make asynchronous AI API call.

        Same parameters as call() but uses async/await.
        """
        from ai_tracking.models import AIPromptConfig

        start_time = time.time()

        # Get or create prompt config if prompt_type is provided
        prompt_config = None
        if self.prompt_type:
            prompt_config, created = await sync_to_async(
                AIPromptConfig.objects.get_or_create
            )(
                prompt_type=self.prompt_type,
                defaults={"description": task_description},
            )

            # Override store_full_data from config if not explicitly set
            if store_full_data is None:
                store_full_data = prompt_config.track_full_data

        # Determine if we should store full data (existing fallback logic)
        if store_full_data is None:
            store_full_data = self.store_prompts_default or self.store_responses_default

        try:
            # Make the actual API call
            if self.provider == "openai":
                result = await self._acall_openai(prompt, **kwargs)
            elif self.provider == "anthropic":
                result = await self._acall_anthropic(prompt, **kwargs)
            else:
                raise ValueError(f"Unsupported provider: {self.provider}")

            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)

            # Extract token usage
            input_tokens = result["usage"]["input_tokens"]
            output_tokens = result["usage"]["output_tokens"]

            # Calculate cost
            cost = self._calculate_cost(input_tokens, output_tokens)

            # Update prompt config with latest call data (async)
            if prompt_config:
                prompt_config.last_prompt = str(prompt)
                prompt_config.last_response = str(result["response"])
                prompt_config.last_input_tokens = input_tokens
                prompt_config.last_output_tokens = output_tokens
                prompt_config.last_cost = cost
                prompt_config.last_user = self.user
                prompt_config.last_metadata = metadata or {}
                prompt_config.last_called_at = timezone.now()
                prompt_config.last_duration_ms = duration_ms
                prompt_config.total_calls += 1
                prompt_config.total_cost += cost
                await sync_to_async(prompt_config.save)()

            # Only create usage log if active (or no config)
            log = None
            if not prompt_config or prompt_config.is_active:
                log = await sync_to_async(self._log_usage)(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost=cost,
                    task_description=task_description,
                    content_object=content_object,
                    metadata=metadata,
                    prompt=str(prompt) if store_full_data else "",
                    response=str(result["response"]) if store_full_data else "",
                    store_full_data=store_full_data,
                    duration_ms=duration_ms,
                    was_successful=True,
                )

            return {
                "response": result["response"],
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_cost": cost,
                },
                "log": log,
            }

        except Exception as e:
            # Log failed call
            duration_ms = int((time.time() - start_time) * 1000)

            # Update prompt config even on failure (async)
            if prompt_config:
                prompt_config.last_prompt = str(prompt)
                prompt_config.last_response = f"ERROR: {str(e)}"
                prompt_config.last_input_tokens = 0
                prompt_config.last_output_tokens = 0
                prompt_config.last_cost = Decimal("0")
                prompt_config.last_user = self.user
                prompt_config.last_metadata = metadata or {}
                prompt_config.last_called_at = timezone.now()
                prompt_config.last_duration_ms = duration_ms
                prompt_config.total_calls += 1
                await sync_to_async(prompt_config.save)()

            # Only create usage log if active (or no config)
            log = None
            if not prompt_config or prompt_config.is_active:
                log = await sync_to_async(self._log_usage)(
                    input_tokens=0,
                    output_tokens=0,
                    cost=Decimal("0"),
                    task_description=task_description,
                    content_object=content_object,
                    metadata=metadata,
                    prompt=str(prompt) if store_full_data else "",
                    response="",
                    store_full_data=store_full_data,
                    duration_ms=duration_ms,
                    error_message=str(e),
                    was_successful=False,
                )

            logger.error(f"AI API call failed: {e}")
            raise

    def _call_openai(self, prompt, **kwargs):
        """Make OpenAI API call."""
        client = self._get_client()

        # Handle different prompt formats
        if isinstance(prompt, str):
            messages = [{"role": "user", "content": prompt}]
        else:
            messages = prompt

        # Make API call
        response = client.chat.completions.create(
            model=self.model, messages=messages, **kwargs
        )

        return {
            "response": response.choices[0].message.content,
            "usage": {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            },
            "raw": response,
        }

    async def _acall_openai(self, prompt, **kwargs):
        """Make async OpenAI API call."""
        import openai

        api_key = getattr(settings, "OPENAI_API_KEY", None)
        client = openai.AsyncOpenAI(api_key=api_key)

        # Handle different prompt formats
        if isinstance(prompt, str):
            messages = [{"role": "user", "content": prompt}]
        else:
            messages = prompt

        # Make API call
        response = await client.chat.completions.create(
            model=self.model, messages=messages, **kwargs
        )

        return {
            "response": response.choices[0].message.content,
            "usage": {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            },
            "raw": response,
        }

    def _call_anthropic(self, prompt, **kwargs):
        """Make Anthropic API call."""
        client = self._get_client()

        # Handle different prompt formats
        if isinstance(prompt, str):
            messages = [{"role": "user", "content": prompt}]
        else:
            messages = prompt

        # Make API call
        response = client.messages.create(
            model=self.model,
            messages=messages,
            max_tokens=kwargs.pop("max_tokens", 1024),
            **kwargs,
        )

        return {
            "response": response.content[0].text,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
            "raw": response,
        }

    async def _acall_anthropic(self, prompt, **kwargs):
        """Make async Anthropic API call."""
        import anthropic

        api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
        client = anthropic.AsyncAnthropic(api_key=api_key)

        # Handle different prompt formats
        if isinstance(prompt, str):
            messages = [{"role": "user", "content": prompt}]
        else:
            messages = prompt

        # Make API call
        response = await client.messages.create(
            model=self.model,
            messages=messages,
            max_tokens=kwargs.pop("max_tokens", 1024),
            **kwargs,
        )

        return {
            "response": response.content[0].text,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
            "raw": response,
        }
