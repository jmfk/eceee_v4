"""
HTMX views for demonstrating server-side rendering with dynamic interactions.
These views showcase how HTMX can be used to create interactive web applications
without heavy JavaScript frameworks.
"""

from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.template.loader import render_to_string
from django_htmx.http import HttpResponseClientRedirect
import json
import time
import random


def htmx_home(request):
    """Main HTMX demonstration page."""
    context = {
        "current_time": timezone.now(),
        "examples": [
            {
                "title": "Dynamic Content Loading",
                "description": "Load content dynamically without page refresh",
                "endpoint": "htmx:dynamic_content",
            },
            {
                "title": "Form Handling",
                "description": "Submit forms with HTMX and show inline validation",
                "endpoint": "htmx:form_example",
            },
            {
                "title": "Live Search",
                "description": "Search as you type with server-side filtering",
                "endpoint": "htmx:search_example",
            },
            {
                "title": "Infinite Scroll",
                "description": "Load more content as you scroll",
                "endpoint": "htmx:infinite_scroll",
            },
        ],
    }
    return render(request, "htmx/home.html", context)


def htmx_examples(request):
    """HTMX examples page with various interactive demonstrations."""
    return render(request, "htmx/examples.html")


@require_http_methods(["GET"])
def dynamic_content(request):
    """Load dynamic content with optional delay to show loading states."""
    delay = request.GET.get("delay", 0)

    try:
        delay = float(delay)
        if delay > 0:
            time.sleep(min(delay, 3.0))  # Max 3 seconds delay
    except (ValueError, TypeError):
        pass

    content_types = [
        {
            "type": "quote",
            "data": {
                "text": "The best way to predict the future is to invent it.",
                "author": "Alan Kay",
            },
        },
        {
            "type": "fact",
            "data": {
                "text": "HTMX allows you to access modern browser features directly from HTML.",
                "category": "Technology",
            },
        },
        {
            "type": "tip",
            "data": {
                "text": "Use hx-boost to progressively enhance regular links and forms.",
                "level": "Beginner",
            },
        },
    ]

    content = random.choice(content_types)

    context = {
        "content": content,
        "timestamp": timezone.now(),
        "request_count": request.session.get("dynamic_requests", 0) + 1,
    }

    request.session["dynamic_requests"] = context["request_count"]

    response = render(request, "htmx/partials/dynamic_content.html", context)
    response[
        "HX-Toast"
    ] = f'Content loaded successfully (Request #{context["request_count"]})'

    return response


@require_http_methods(["GET", "POST"])
def form_example(request):
    """Handle form submission with HTMX including validation."""
    if request.method == "GET":
        return render(request, "htmx/partials/form_example.html")

    # Handle POST request
    name = request.POST.get("name", "").strip()
    email = request.POST.get("email", "").strip()
    message = request.POST.get("message", "").strip()

    errors = {}

    # Simple validation
    if not name:
        errors["name"] = "Name is required"
    elif len(name) < 2:
        errors["name"] = "Name must be at least 2 characters"

    if not email:
        errors["email"] = "Email is required"
    elif "@" not in email:
        errors["email"] = "Please enter a valid email address"

    if not message:
        errors["message"] = "Message is required"
    elif len(message) < 10:
        errors["message"] = "Message must be at least 10 characters"

    if errors:
        context = {
            "errors": errors,
            "form_data": {"name": name, "email": email, "message": message},
        }
        return render(request, "htmx/partials/form_example.html", context)

    # Success case
    context = {
        "success": True,
        "submitted_data": {
            "name": name,
            "email": email,
            "message": message,
            "submitted_at": timezone.now(),
        },
    }

    response = render(request, "htmx/partials/form_success.html", context)
    response["HX-Toast"] = "Form submitted successfully!"

    return response


@require_http_methods(["GET"])
def search_example(request):
    """Live search functionality with server-side filtering."""
    query = request.GET.get("q", "").strip()

    # Sample data to search through
    sample_data = [
        {
            "id": 1,
            "title": "Django REST Framework",
            "description": "Powerful API development toolkit",
            "category": "Backend",
        },
        {
            "id": 2,
            "title": "React",
            "description": "JavaScript library for building user interfaces",
            "category": "Frontend",
        },
        {
            "id": 3,
            "title": "PostgreSQL",
            "description": "Advanced open source relational database",
            "category": "Database",
        },
        {
            "id": 4,
            "title": "Docker",
            "description": "Platform for developing, shipping, and running applications",
            "category": "DevOps",
        },
        {
            "id": 5,
            "title": "HTMX",
            "description": "High power tools for HTML",
            "category": "Frontend",
        },
        {
            "id": 6,
            "title": "Tailwind CSS",
            "description": "Utility-first CSS framework",
            "category": "Frontend",
        },
        {
            "id": 7,
            "title": "Redis",
            "description": "In-memory data structure store",
            "category": "Database",
        },
        {
            "id": 8,
            "title": "Celery",
            "description": "Distributed task queue",
            "category": "Backend",
        },
        {
            "id": 9,
            "title": "nginx",
            "description": "HTTP and reverse proxy server",
            "category": "DevOps",
        },
        {
            "id": 10,
            "title": "Git",
            "description": "Distributed version control system",
            "category": "DevOps",
        },
    ]

    if query:
        results = [
            item
            for item in sample_data
            if query.lower() in item["title"].lower()
            or query.lower() in item["description"].lower()
        ]
    else:
        results = sample_data

    context = {
        "results": results,
        "query": query,
        "total_count": len(sample_data),
        "filtered_count": len(results),
    }

    return render(request, "htmx/partials/search_results.html", context)


@require_http_methods(["GET"])
def infinite_scroll(request):
    """Infinite scroll implementation with pagination."""
    page = int(request.GET.get("page", 1))
    per_page = 5

    # Generate sample items
    start_item = (page - 1) * per_page + 1
    end_item = page * per_page

    items = []
    for i in range(start_item, end_item + 1):
        items.append(
            {
                "id": i,
                "title": f"Item {i}",
                "description": f"This is the description for item number {i}. It contains some sample text to demonstrate the infinite scroll functionality.",
                "timestamp": timezone.now(),
                "category": random.choice(
                    ["Technology", "Science", "Art", "Business", "Education"]
                ),
            }
        )

    # Simulate that we have 50 total items
    has_more = end_item < 50

    context = {
        "items": items,
        "page": page,
        "has_more": has_more,
        "next_page": page + 1 if has_more else None,
    }

    if request.htmx:
        # Return only the new items for HTMX requests
        return render(request, "htmx/partials/infinite_scroll_items.html", context)
    else:
        # Return the full page for non-HTMX requests
        return render(request, "htmx/partials/infinite_scroll.html", context)


@require_http_methods(["POST"])
def toggle_like(request, item_id):
    """Toggle like status for an item (simulated)."""
    # In a real application, you would update the database here
    current_likes = request.session.get(f"likes_{item_id}", 0)
    is_liked = request.session.get(f"liked_{item_id}", False)

    if is_liked:
        current_likes = max(0, current_likes - 1)
        is_liked = False
    else:
        current_likes += 1
        is_liked = True

    request.session[f"likes_{item_id}"] = current_likes
    request.session[f"liked_{item_id}"] = is_liked

    context = {"item_id": item_id, "likes": current_likes, "is_liked": is_liked}

    return render(request, "htmx/partials/like_button.html", context)


@require_http_methods(["GET"])
def server_time(request):
    """Return current server time for real-time updates."""
    context = {
        "current_time": timezone.now(),
        "timezone": str(timezone.get_current_timezone()),
    }
    return render(request, "htmx/partials/server_time.html", context)
