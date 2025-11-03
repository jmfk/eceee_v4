# AI Style Helper Implementation

## Overview

The AI Style Helper is a feature that integrates AI assistance into the theme style editor for Gallery, Carousel, and Component styles. It uses OpenAI (or Anthropic) to generate and modify HTML templates and CSS based on user prompts, while tracking usage through the existing AI tracking system.

## Features

1. **Context-Aware Generation**: Maintains conversation history to provide contextual responses
2. **Different Style Types**: Supports Gallery, Carousel, and Component styles with type-specific prompts
3. **Smart Responses**: LLM can either ask clarifying questions or return generated templates
4. **Undo Functionality**: Users can revert to previous versions with a built-in undo stack
5. **Usage Tracking**: All AI calls are tracked through the existing `AIClient` service

## Architecture

### Backend Components

#### 1. `StyleAIHelper` Service (`backend/webpages/services/style_ai_helper.py`)

Main service class that handles AI generation:

- **Methods**:
  - `generate_style()`: Main method that sends user prompts to AI
  - `_build_system_prompt()`: Creates type-specific system prompts
  - `_build_context_messages()`: Builds conversation context with current style

- **Style Types**:
  - `gallery`: Mustache templates for image galleries
  - `carousel`: Mustache templates with Alpine.js for carousels
  - `component`: Mustache templates for reusable components

- **Response Format**:
  ```json
  {
    "type": "question",
    "question": "What specific layout do you want?"
  }
  ```
  OR
  ```json
  {
    "type": "result",
    "template": "<div>...</div>",
    "css": ".class { ... }"
  }
  ```

#### 2. API Endpoint (`backend/webpages/views/page_theme_views.py`)

New action on `PageThemeViewSet`:

- **Endpoint**: `POST /api/themes/{id}/ai-style-helper/`
- **Request Body**:
  ```json
  {
    "style_type": "gallery" | "carousel" | "component",
    "user_prompt": "Generate a masonry gallery layout",
    "current_style": {
      "name": "...",
      "description": "...",
      "template": "...",
      "css": "..."
    },
    "context_log": [
      {"role": "user", "content": "..."},
      {"role": "assistant", "content": "..."}
    ]
  }
  ```

### Frontend Components

#### 1. `StyleAIHelper` Component (`frontend/src/components/theme/StyleAIHelper.jsx`)

Reusable React component for AI assistance:

- **Props**:
  - `themeId`: Theme ID for API calls
  - `styleType`: Type of style (gallery, carousel, component)
  - `currentStyle`: Current style configuration
  - `onUpdateStyle`: Callback to update style

- **Features**:
  - Collapsible interface (opens on button click)
  - Conversation history display
  - User input with Enter key support
  - Undo stack with visual counter
  - Reset conversation
  - Loading states and error handling
  - Contextual help examples

#### 2. Integration in Style Tabs

The AI Helper is integrated into three tabs:

- **GalleryStylesTab.jsx**: Added after Name/Description fields
- **CarouselStylesTab.jsx**: Added after Name/Description fields
- **ComponentStylesTab.jsx**: Added in ComponentStyleEditor after Description field

## Usage Flow

1. **User Opens AI Helper**: Clicks "AI Helper" button in style editor
2. **User Enters Prompt**: Types request like "Create a masonry gallery"
3. **AI Processes**:
   - Receives current style context
   - Receives conversation history
   - Returns either a question or generated templates
4. **Question Flow**: If AI needs more info, it asks and user responds
5. **Result Flow**: If AI generates templates:
   - Current state saved to undo stack
   - Templates updated in editor
   - Conversation continues
6. **Undo**: User can revert to previous version
7. **Reset**: User can clear conversation and start over

## AI Prompts

### System Prompts by Style Type

Each style type has a specialized system prompt:

- **Gallery**: Focuses on responsive grid/flex layouts, image variables, caption handling
- **Carousel**: Includes Alpine.js patterns, slide navigation, auto-play features
- **Component**: Emphasizes reusable templates, navigation patterns, semantic HTML

All prompts enforce JSON response format with strict type validation.

## AI Tracking

All AI calls are tracked through the existing system:

- **Prompt Type**: `style_generation_{style_type}` (e.g., `style_generation_gallery`)
- **Task Description**: `"Generate {style_type} style"`
- **Metadata**: Includes style type, whether current style exists, context length
- **Cost Tracking**: Automatic token counting and cost calculation
- **Usage Logs**: Stored in `AIUsageLog` model

## Example Prompts

### Gallery
- "Create a masonry gallery with 3 columns"
- "Add hover zoom effect to gallery images"
- "Make gallery responsive for mobile"

### Carousel
- "Create a hero carousel with fade transitions"
- "Add dot navigation below carousel"
- "Make carousel auto-play every 5 seconds"

### Component
- "Create a card component with rounded corners"
- "Design a modern navigation menu"
- "Add shadow on hover to component"

## Error Handling

- **Invalid Style Type**: Returns 400 Bad Request
- **Missing Required Fields**: Returns 400 Bad Request with error message
- **AI Generation Failure**: Returns 500 Internal Server Error with error details
- **Frontend Errors**: Displayed in red error box within AI Helper panel

## Security Considerations

1. **Authentication Required**: All API calls require authentication
2. **Input Validation**: Style type validated against allowed list
3. **Context Log Sanitization**: User input stored in conversation history
4. **Cost Tracking**: All usage tracked to prevent abuse

## Future Enhancements

1. **Template Library**: Save and reuse successful AI-generated templates
2. **Version History**: Keep history of all AI-generated versions
3. **Prompt Templates**: Pre-defined prompts for common tasks
4. **Style Preview**: Live preview of AI-generated styles
5. **Batch Generation**: Generate multiple style variations
6. **Fine-tuning**: Train model on successful style examples

