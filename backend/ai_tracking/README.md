# AI Cost Tracking System

A comprehensive system for tracking AI API usage, costs, and managing budgets across multiple providers (OpenAI, Anthropic, etc.).

## Features

- **Universal AI Client**: Centralized wrapper for all AI API calls with automatic cost tracking
- **Multi-Provider Support**: Works with OpenAI, Anthropic, and other providers
- **Automatic Cost Calculation**: Tracks tokens and calculates costs using current pricing
- **Price Management**: Auto-update prices with email notifications for changes
- **Budget Alerts**: Set spending thresholds with automatic email notifications
- **Analytics**: Comprehensive reporting by user, model, provider, and time period
- **Optional Data Storage**: Configurable prompt/response storage for audit trails

## Quick Start

### 1. Basic Usage

Replace direct AI API calls with the `AIClient`:

```python
from ai_tracking.services import AIClient

# Create client
client = AIClient(
    provider='openai',
    model='gpt-4o-mini',
    user=request.user
)

# Make tracked API call
result = client.call(
    prompt="What is the capital of France?",
    task_description="Geography question",
    content_object=my_object,  # Optional: link to any Django model
    metadata={'source': 'user_query'}
)

# Access response and usage data
response_text = result['response']
cost = result['usage']['total_cost']
tokens = result['usage']['input_tokens'] + result['usage']['output_tokens']
usage_log = result['log']  # AIUsageLog instance
```

### 2. Async Usage

```python
# For async operations
result = await client.acall(
    prompt="Analyze this text...",
    task_description="Content analysis",
)
```

### 3. Storing Prompts/Responses

```python
# Store full data for important calls
result = client.call(
    prompt="Complex analysis task...",
    task_description="Critical analysis",
    store_full_data=True,  # Override default setting
)
```

## API Endpoints

All endpoints are under `/api/v1/ai-tracking/`:

### Price Management
- `GET /prices/` - List all model prices
- `POST /prices/` - Add new price (admin only)
- `POST /prices/refresh/` - Trigger manual price check (admin only)
- `POST /prices/{id}/verify/` - Mark price as verified (admin only)

### Usage Logs
- `GET /usage/` - List usage logs with filtering
  - Query params: `user`, `provider`, `model`, `date_from`, `date_to`, `was_successful`
- `GET /usage/{id}/` - Get specific log with full details

### Analytics
- `GET /analytics/summary/` - Total costs and statistics
- `GET /analytics/by-user/` - Costs grouped by user (admin only)
- `GET /analytics/by-model/` - Costs grouped by model
- `GET /analytics/by-provider/` - Costs grouped by provider
- `GET /analytics/trends/` - Cost trends over time
  - Query params: `period` (daily/weekly/monthly)
- `GET /analytics/top-tasks/` - Most expensive task types

### Budget Alerts
- `GET /budgets/` - List budget alerts
- `POST /budgets/` - Create budget alert (admin only)
- `GET /budgets/check/` - Check current spend against budgets
- `POST /budgets/{id}/test_alert/` - Send test alert email (admin only)

## Configuration

Add to `settings.py` or environment variables:

```python
# AI Tracking Settings
AI_TRACKING = {
    'STORE_PROMPTS_BY_DEFAULT': False,  # Set to True to store all prompts
    'STORE_RESPONSES_BY_DEFAULT': False,  # Set to True to store all responses
    'PRICE_STALE_DAYS': 30,  # Flag prices as stale after N days
    'ADMIN_EMAIL': 'admin@example.com',  # Email for price/budget alerts
    'BUDGET_CHECK_ENABLED': True,  # Enable budget monitoring
}

# Provider API Keys
OPENAI_API_KEY = 'your-key-here'
ANTHROPIC_API_KEY = 'your-key-here'
```

## Scheduled Tasks

The system includes Celery tasks for automated maintenance:

1. **Price Checks** (weekly): `ai_tracking.tasks.check_ai_prices`
   - Attempts to fetch current prices from provider APIs
   - Flags prices older than 30 days as stale
   - Sends email digest to admins

2. **Stale Price Reminders** (weekly): `ai_tracking.tasks.send_stale_price_reminders`
   - Reminds admins about prices needing verification

3. **Budget Alerts** (hourly): `ai_tracking.tasks.check_budget_alerts`
   - Checks spending against configured budgets
   - Sends emails when thresholds are exceeded

## Budget Alerts

Create budget alerts through the admin panel or API:

```python
from ai_tracking.models import AIBudgetAlert

# Create a monthly budget alert
AIBudgetAlert.objects.create(
    name='Monthly OpenAI Budget',
    budget_amount=100.00,  # $100/month
    period='monthly',
    provider='openai',  # Optional: limit to specific provider
    email_recipients=['team@example.com'],
    threshold_percentage=80,  # Alert at 80% of budget
    is_active=True,
)
```

## Model Pricing

### Current Prices

Prices are seeded automatically on first migration and can be updated:

**OpenAI:**
- GPT-4: $30/$60 per 1M tokens (input/output)
- GPT-4 Turbo: $10/$30 per 1M tokens
- GPT-4o: $5/$15 per 1M tokens
- GPT-4o mini: $0.15/$0.60 per 1M tokens

**Anthropic:**
- Claude 3 Opus: $15/$75 per 1M tokens
- Claude 3.5 Sonnet: $3/$15 per 1M tokens
- Claude 3.5 Haiku: $0.80/$4 per 1M tokens

### Updating Prices

1. **Automatic** (runs weekly): 
   ```bash
   docker-compose exec backend python manage.py check_ai_prices
   ```

2. **Manual** (admin panel):
   - Go to AI Tracking → AI Model Prices
   - Add new price entry for updated model
   - Older prices remain for historical accuracy

## Analytics Examples

### Get monthly costs by user
```bash
curl "http://localhost:8000/api/v1/ai-tracking/analytics/by-user/?date_from=2024-10-01&date_to=2024-10-31"
```

### Get cost trends
```bash
curl "http://localhost:8000/api/v1/ai-tracking/analytics/trends/?period=daily&date_from=2024-10-01"
```

### Check budget status
```bash
curl "http://localhost:8000/api/v1/ai-tracking/budgets/check/"
```

## Best Practices

1. **Always Use AIClient**: Replace direct API calls to ensure tracking
2. **Set Meaningful Descriptions**: Use descriptive `task_description` for reports
3. **Link to Objects**: Use `content_object` to track usage by feature
4. **Configure Storage Wisely**: Only store prompts/responses when needed for compliance
5. **Monitor Budgets**: Set up alerts for cost control
6. **Review Stale Prices**: Update pricing monthly or when providers announce changes

## Troubleshooting

### No costs showing up?
- Ensure AIModelPrice entries exist for your models
- Check that prices aren't marked as stale
- Verify API calls are using AIClient

### Budget alerts not triggering?
- Check `is_active=True` on the alert
- Verify email configuration in Django settings
- Check Celery beat is running for hourly checks

### Price updates failing?
- Most providers don't have pricing APIs yet
- Update prices manually through admin panel
- Check weekly reminder emails for stale prices

## Admin Interface

Access at `/admin/ai_tracking/`:

- **AI Model Prices**: View/edit pricing for all models
- **AI Usage Logs**: Browse all API calls with costs
- **AI Budget Alerts**: Configure spending limits

## Development

### Running Tests
```bash
docker-compose exec backend python manage.py test ai_tracking
```

### Adding New Providers

1. Update `AIModelPrice.PROVIDER_CHOICES`
2. Add provider support in `AIClient._call_<provider>()` and `_acall_<provider>()`
3. Add pricing map in `PriceUpdater._update_<provider>_price()`

## Migration from Direct API Calls

### Before:
```python
from openai import OpenAI

client = OpenAI(api_key=settings.OPENAI_API_KEY)
response = client.chat.completions.create(
    model='gpt-4o-mini',
    messages=[{'role': 'user', 'content': prompt}]
)
text = response.choices[0].message.content
```

### After:
```python
from ai_tracking.services import AIClient

client = AIClient(provider='openai', model='gpt-4o-mini', user=request.user)
result = client.call(
    prompt=prompt,
    task_description='User query'
)
text = result['response']
cost = result['usage']['total_cost']  # Bonus: automatic cost tracking!
```

## Support

For issues or questions, check:
1. This documentation
2. Django admin logs at `/admin/ai_tracking/aiusagelog/`
3. Application logs for errors

