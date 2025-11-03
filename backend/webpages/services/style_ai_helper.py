"""
Style AI Helper Service

Uses AI to help generate and modify theme styles (Gallery, Carousel, Component).
Tracks conversation context and usage through AIClient.
"""

import json
import logging
from typing import Dict, Any, Optional, List
from ai_tracking.services.ai_client import AIClient

logger = logging.getLogger(__name__)


class StyleAIHelper:
    """
    AI assistant for generating and modifying theme styles.
    Maintains conversation context and supports different style types.
    """

    STYLE_TYPES = ["gallery", "carousel", "component"]

    def __init__(self, user=None, provider="openai", model="gpt-4o-mini"):
        """
        Initialize AI helper.

        Args:
            user: Django user making the request
            provider: AI provider ('openai' or 'anthropic')
            model: Model name to use
        """
        self.user = user
        self.provider = provider
        self.model = model

    def _build_system_prompt(self, style_type: str) -> str:
        """Build system prompt based on style type."""
        base_prompt = """You are an expert web designer helping to create theme styles.
Your job is to generate HTML templates and CSS based on user requests.

IMPORTANT RESPONSE FORMAT:
You must respond with ONLY a valid JSON object, no other text.
The JSON must have ONE of these structures:

1. If you need more information:
{
  "type": "question",
  "question": "What information do you need?"
}

2. If you can generate the templates:
{
  "type": "result",
  "template": "HTML template here",
  "css": "CSS here"
}

NEVER return both a question and templates.
"""

        if style_type == "gallery":
            return (
                base_prompt
                + """
GALLERY STYLE SPECIFICS:
- Use Mustache template syntax
- Available variables:
  * {{#images}}...{{/images}} - Loop through images
  * {{url}} - Image URL (already optimized via imgproxy)
  * {{alt}} - Image alt text
  * {{caption}} - Image caption (optional)
  * {{#showCaptions}}...{{/showCaptions}} - Conditional for captions
- Create responsive, modern gallery layouts
- Use CSS Grid or Flexbox for layout
- Include hover effects and transitions
"""
            )

        elif style_type == "carousel":
            return (
                base_prompt
                + """
CAROUSEL STYLE SPECIFICS:
- Use Mustache template syntax with Alpine.js
- Available variables:
  * {{#images}}...{{/images}} - Loop through images
  * {{url}} - Image URL (already optimized via imgproxy)
  * {{alt}} - Image alt text
  * {{caption}} - Image caption (optional)
  * {{index}} - Image index (0-based)
  * {{imageCount}} - Total number of images
  * {{#multipleImages}}...{{/multipleImages}} - Conditional for >1 image
- Use Alpine.js for interactivity (x-data, @click, :style, etc.)
- Include prev/next navigation
- Smooth transitions between slides
- Responsive design
"""
            )

        elif style_type == "component":
            return (
                base_prompt
                + """
COMPONENT STYLE SPECIFICS:
- Use Mustache template syntax
- Available variables:
  * {{content}} - Generic content placeholder (for inline objects)
  * {{#items}}...{{/items}} - Navigation items (for Navigation widget)
  * {{label}} - Item label (in items loop)
  * {{url}} - Item URL (in items loop)
  * {{targetBlank}} - Boolean for opening in new tab (in items loop)
- Create reusable component templates
- Clean, semantic HTML
- Modern, flexible CSS
"""
            )

        return base_prompt

    def _build_context_messages(
        self, style_type: str, current_style: Dict[str, Any], context_log: List[Dict]
    ) -> List[Dict[str, str]]:
        """Build conversation messages including context."""
        messages = []

        # System prompt
        messages.append(
            {"role": "system", "content": self._build_system_prompt(style_type)}
        )

        # Add current style context
        context_parts = [f"Current {style_type} style:"]
        if current_style.get("name"):
            context_parts.append(f"Name: {current_style['name']}")
        if current_style.get("description"):
            context_parts.append(f"Description: {current_style['description']}")
        if current_style.get("template"):
            context_parts.append(f"Current Template:\n{current_style['template']}")
        if current_style.get("css"):
            context_parts.append(f"Current CSS:\n{current_style['css']}")

        messages.append({"role": "system", "content": "\n".join(context_parts)})

        # Add conversation history
        for entry in context_log:
            if entry.get("role") and entry.get("content"):
                messages.append({"role": entry["role"], "content": entry["content"]})

        return messages

    def generate_style(
        self,
        style_type: str,
        user_prompt: str,
        current_style: Optional[Dict[str, Any]] = None,
        context_log: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """
        Generate or modify a style using AI.

        Args:
            style_type: Type of style ('gallery', 'carousel', 'component')
            user_prompt: User's request/question
            current_style: Current style data (name, description, template, css)
            context_log: Previous conversation messages

        Returns:
            dict: {
                'type': 'question' | 'result',
                'question': str (if type=question),
                'template': str (if type=result),
                'css': str (if type=result),
                'usage': {
                    'input_tokens': int,
                    'output_tokens': int,
                    'total_cost': Decimal
                }
            }
        """
        # Validate style type
        if style_type not in self.STYLE_TYPES:
            raise ValueError(f"Invalid style_type. Must be one of: {self.STYLE_TYPES}")

        # Prepare defaults
        current_style = current_style or {}
        context_log = context_log or []

        # Build messages
        messages = self._build_context_messages(style_type, current_style, context_log)

        # Add user prompt
        messages.append({"role": "user", "content": user_prompt})

        # Create AI client
        ai_client = AIClient(
            provider=self.provider,
            model=self.model,
            user=self.user,
            prompt_type=f"style_generation_{style_type}",
        )

        try:
            # Call AI
            result = ai_client.call(
                prompt=messages,
                task_description=f"Generate {style_type} style",
                metadata={
                    "style_type": style_type,
                    "has_current_style": bool(current_style.get("template")),
                    "context_length": len(context_log),
                },
                response_format={"type": "json_object"},
                store_full_data=True,
            )

            # Parse JSON response
            response_text = result["response"]
            try:
                response_data = json.loads(response_text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response as JSON: {e}")
                logger.error(f"Response was: {response_text}")
                raise ValueError(f"AI returned invalid JSON: {e}")

            # Validate response structure
            response_type = response_data.get("type")
            if response_type not in ["question", "result"]:
                raise ValueError(f"Invalid response type: {response_type}")

            # Build final response
            final_response = {"type": response_type, "usage": result["usage"]}

            if response_type == "question":
                final_response["question"] = response_data.get("question", "")
            else:  # result
                final_response["template"] = response_data.get("template", "")
                final_response["css"] = response_data.get("css", "")

            return final_response

        except Exception as e:
            logger.error(f"AI style generation failed: {e}")
            raise
