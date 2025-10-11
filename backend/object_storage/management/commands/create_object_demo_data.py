"""
Django management command to create demo data for the Object Storage System.

This command creates sample object types and instances to demonstrate:
- Dynamic schema definitions
- Hierarchical relationships
- Widget slot configurations
- Publishing workflows
- Version control
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta
import random

from object_storage.models import ObjectTypeDefinition, ObjectInstance


class Command(BaseCommand):
    help = "Create demo data for the Object Storage System"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing object storage data before creating demo data",
        )
        parser.add_argument(
            "--user",
            type=str,
            help="Username to use as creator (defaults to first superuser)",
        )

    def handle(self, *args, **options):
        # Get or create user
        if options["user"]:
            try:
                user = User.objects.get(username=options["user"])
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'User "{options["user"]}" not found')
                )
                return
        else:
            user = User.objects.filter(is_superuser=True).first()
            if not user:
                self.stdout.write(
                    self.style.ERROR("No superuser found. Please create one first.")
                )
                return

        # Clear existing data if requested
        if options["clear"]:
            self.stdout.write("Clearing existing object storage data...")
            ObjectInstance.objects.all().delete()
            ObjectTypeDefinition.objects.all().delete()

        self.stdout.write("Creating demo object types...")

        # Create object types
        news_type = self.create_news_type(user)
        blog_type = self.create_blog_type(user)
        event_type = self.create_event_type(user)
        project_type = self.create_project_type(user)

        self.stdout.write("Creating demo object instances...")

        # Create news articles
        news_instances = self.create_news_instances(news_type, user)

        # Create blog posts with comments
        blog_instances = self.create_blog_instances(blog_type, user)

        # Create events
        event_instances = self.create_event_instances(event_type, user)

        # Create projects with tasks
        project_instances = self.create_project_instances(project_type, user)

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully created demo data:\n"
                f"- 4 object types\n"
                f"- {len(news_instances)} news articles\n"
                f"- {len(blog_instances)} blog posts\n"
                f"- {len(event_instances)} events\n"
                f"- {len(project_instances)} projects\n"
                f"Total: {ObjectInstance.objects.count()} object instances"
            )
        )

    def create_news_type(self, user):
        """Create News Article object type"""
        return ObjectTypeDefinition.objects.create(
            name="news",
            label="News Article",
            plural_label="News Articles",
            description="News articles and company announcements",
            schema={
                "fields": [
                    {
                        "name": "title",
                        "type": "text",
                        "required": True,
                        "maxLength": 200,
                        "label": "Article Title",
                    },
                    {
                        "name": "summary",
                        "type": "text",
                        "required": False,
                        "maxLength": 300,
                        "label": "Summary",
                    },
                    {
                        "name": "content",
                        "type": "rich_text",
                        "required": True,
                        "label": "Article Content",
                    },
                    {
                        "name": "author",
                        "type": "user_reference",
                        "required": True,
                        "label": "Author",
                    },
                    {
                        "name": "category",
                        "type": "choice",
                        "required": True,
                        "choices": [
                            {"value": "company", "label": "Company News"},
                            {"value": "industry", "label": "Industry News"},
                            {"value": "research", "label": "Research"},
                            {"value": "announcement", "label": "Announcement"},
                        ],
                        "label": "Category",
                    },
                    {
                        "name": "featured",
                        "type": "boolean",
                        "required": False,
                        "label": "Featured Article",
                    },
                ]
            },
            slot_configuration={
                "slots": [
                    {
                        "name": "main_content",
                        "label": "Main Content Area",
                        "maxWidgets": None,
                        "required": True,
                        "widgetControls": [
                            {
                                "id": "main_text",
                                "widgetType": "text-block",
                                "label": "Article Text",
                                "maxInstances": None,
                                "required": True,
                                "preCreate": True,
                                "defaultConfig": {
                                    "title": "Article Content",
                                    "content": "Write your article content here...",
                                },
                            },
                            {
                                "id": "main_image",
                                "widgetType": "image",
                                "label": "Featured Image",
                                "maxInstances": 2,
                                "required": False,
                                "preCreate": False,
                                "defaultConfig": {
                                    "alt": "Article image",
                                    "caption": "",
                                },
                            },
                            {
                                "id": "gallery",
                                "widgetType": "gallery",
                                "label": "Image Gallery",
                                "maxInstances": 1,
                                "required": False,
                                "preCreate": False,
                                "defaultConfig": {},
                            },
                        ],
                    },
                    {
                        "name": "sidebar",
                        "label": "Sidebar Content",
                        "maxWidgets": 3,
                        "required": False,
                        "widgetControls": [
                            {
                                "id": "sidebar_text",
                                "widgetType": "text-block",
                                "label": "Sidebar Info",
                                "maxInstances": 2,
                                "required": False,
                                "preCreate": False,
                                "defaultConfig": {
                                    "title": "Related Information",
                                    "content": "Add related information here...",
                                },
                            },
                            {
                                "id": "sidebar_image",
                                "widgetType": "image",
                                "label": "Sidebar Image",
                                "maxInstances": 1,
                                "required": False,
                                "preCreate": False,
                                "defaultConfig": {
                                    "alt": "Sidebar image",
                                    "caption": "",
                                },
                            },
                        ],
                    },
                ]
            },
            is_active=True,
            created_by=user,
        )

    def create_blog_type(self, user):
        """Create Blog Post object type with comment support"""
        blog_type = ObjectTypeDefinition.objects.create(
            name="blog",
            label="Blog Post",
            plural_label="Blog Posts",
            description="Blog posts and articles with comment support",
            schema={
                "fields": [
                    {
                        "name": "title",
                        "type": "text",
                        "required": True,
                        "maxLength": 200,
                        "label": "Post Title",
                    },
                    {
                        "name": "content",
                        "type": "rich_text",
                        "required": True,
                        "label": "Post Content",
                    },
                    {
                        "name": "author",
                        "type": "user_reference",
                        "required": True,
                        "label": "Author",
                    },
                    {
                        "name": "tags",
                        "type": "text",
                        "required": False,
                        "label": "Tags (comma-separated)",
                    },
                    {
                        "name": "reading_time",
                        "type": "number",
                        "required": False,
                        "label": "Estimated Reading Time (minutes)",
                    },
                ]
            },
            slot_configuration={
                "slots": [
                    {
                        "name": "content",
                        "label": "Main Content",
                        "required": True,
                        "widgetControls": [
                            {
                                "id": "blog_content",
                                "widgetType": "text-block",
                                "label": "Blog Content",
                                "maxInstances": None,
                                "required": True,
                                "preCreate": True,
                                "defaultConfig": {
                                    "title": "Blog Post",
                                    "content": "Write your blog post content here...",
                                },
                            },
                            {
                                "id": "blog_images",
                                "widgetType": "image",
                                "label": "Blog Images",
                                "maxInstances": 5,
                                "required": False,
                                "preCreate": False,
                                "defaultConfig": {"alt": "Blog image", "caption": ""},
                            },
                            {
                                "id": "blog_gallery",
                                "widgetType": "gallery",
                                "label": "Image Gallery",
                                "maxInstances": 1,
                                "required": False,
                                "preCreate": False,
                                "defaultConfig": {},
                            },
                        ],
                    },
                    {
                        "name": "comments",
                        "label": "Comments Section",
                        "maxWidgets": 1,
                        "required": False,
                        "widgetControls": [
                            {
                                "id": "comments_widget",
                                "widgetType": "object-children",
                                "label": "Comments",
                                "maxInstances": 1,
                                "required": False,
                                "preCreate": True,
                                "defaultConfig": {},
                            }
                        ],
                    },
                ]
            },
            is_active=True,
            created_by=user,
        )

        # Create comment type as child of blog
        comment_type = ObjectTypeDefinition.objects.create(
            name="comment",
            label="Comment",
            plural_label="Comments",
            description="User comments on blog posts",
            schema={
                "fields": [
                    {
                        "name": "author_name",
                        "type": "text",
                        "required": True,
                        "maxLength": 100,
                        "label": "Author Name",
                    },
                    {
                        "name": "author_email",
                        "type": "email",
                        "required": True,
                        "label": "Author Email",
                    },
                    {
                        "name": "content",
                        "type": "text",
                        "required": True,
                        "maxLength": 1000,
                        "label": "Comment Content",
                    },
                    {
                        "name": "approved",
                        "type": "boolean",
                        "required": False,
                        "default": False,
                        "label": "Approved",
                    },
                ]
            },
            slot_configuration={"slots": []},
            is_active=True,
            created_by=user,
        )

        # Set up parent-child relationship
        blog_type.allowed_child_types.add(comment_type)

        return blog_type

    def create_event_type(self, user):
        """Create Event object type"""
        return ObjectTypeDefinition.objects.create(
            name="event",
            label="Event",
            plural_label="Events",
            description="Events, workshops, and activities",
            schema={
                "fields": [
                    {
                        "name": "title",
                        "type": "text",
                        "required": True,
                        "maxLength": 200,
                        "label": "Event Title",
                    },
                    {
                        "name": "description",
                        "type": "rich_text",
                        "required": True,
                        "label": "Event Description",
                    },
                    {
                        "name": "start_date",
                        "type": "datetime",
                        "required": True,
                        "label": "Start Date & Time",
                    },
                    {
                        "name": "end_date",
                        "type": "datetime",
                        "required": False,
                        "label": "End Date & Time",
                    },
                    {
                        "name": "location",
                        "type": "text",
                        "required": False,
                        "maxLength": 200,
                        "label": "Location",
                    },
                    {
                        "name": "capacity",
                        "type": "number",
                        "required": False,
                        "min": 1,
                        "label": "Maximum Capacity",
                    },
                    {
                        "name": "registration_url",
                        "type": "url",
                        "required": False,
                        "label": "Registration URL",
                    },
                    {
                        "name": "is_virtual",
                        "type": "boolean",
                        "required": False,
                        "label": "Virtual Event",
                    },
                ]
            },
            slot_configuration={
                "slots": [
                    {
                        "name": "details",
                        "label": "Event Details",
                        "required": True,
                    },
                    {
                        "name": "registration",
                        "label": "Registration Information",
                        "maxWidgets": 2,
                        "required": False,
                    },
                ]
            },
            is_active=True,
            created_by=user,
        )

    def create_project_type(self, user):
        """Create Project object type with task support"""
        project_type = ObjectTypeDefinition.objects.create(
            name="project",
            label="Project",
            plural_label="Projects",
            description="Projects and initiatives with task management",
            schema={
                "fields": [
                    {
                        "name": "title",
                        "type": "text",
                        "required": True,
                        "maxLength": 200,
                        "label": "Project Title",
                    },
                    {
                        "name": "description",
                        "type": "rich_text",
                        "required": True,
                        "label": "Project Description",
                    },
                    {
                        "name": "status",
                        "type": "choice",
                        "required": True,
                        "choices": [
                            {"value": "planning", "label": "Planning"},
                            {"value": "active", "label": "Active"},
                            {"value": "on_hold", "label": "On Hold"},
                            {"value": "completed", "label": "Completed"},
                            {"value": "cancelled", "label": "Cancelled"},
                        ],
                        "label": "Project Status",
                    },
                    {
                        "name": "start_date",
                        "type": "date",
                        "required": False,
                        "label": "Start Date",
                    },
                    {
                        "name": "end_date",
                        "type": "date",
                        "required": False,
                        "label": "Target End Date",
                    },
                    {
                        "name": "budget",
                        "type": "number",
                        "required": False,
                        "min": 0,
                        "label": "Budget",
                    },
                    {
                        "name": "priority",
                        "type": "choice",
                        "required": True,
                        "choices": [
                            {"value": "low", "label": "Low"},
                            {"value": "medium", "label": "Medium"},
                            {"value": "high", "label": "High"},
                            {"value": "critical", "label": "Critical"},
                        ],
                        "label": "Priority",
                    },
                ]
            },
            slot_configuration={
                "slots": [
                    {
                        "name": "overview",
                        "label": "Project Overview",
                        "required": True,
                    },
                    {
                        "name": "resources",
                        "label": "Resources & Links",
                        "maxWidgets": 5,
                        "required": False,
                    },
                ]
            },
            is_active=True,
            created_by=user,
        )

        # Create task type as child of project
        task_type = ObjectTypeDefinition.objects.create(
            name="task",
            label="Task",
            plural_label="Tasks",
            description="Project tasks and action items",
            schema={
                "fields": [
                    {
                        "name": "title",
                        "type": "text",
                        "required": True,
                        "maxLength": 200,
                        "label": "Task Title",
                    },
                    {
                        "name": "description",
                        "type": "text",
                        "required": False,
                        "maxLength": 500,
                        "label": "Task Description",
                    },
                    {
                        "name": "assignee",
                        "type": "user_reference",
                        "required": False,
                        "label": "Assigned To",
                    },
                    {
                        "name": "due_date",
                        "type": "date",
                        "required": False,
                        "label": "Due Date",
                    },
                    {
                        "name": "status",
                        "type": "choice",
                        "required": True,
                        "choices": [
                            {"value": "todo", "label": "To Do"},
                            {"value": "in_progress", "label": "In Progress"},
                            {"value": "review", "label": "In Review"},
                            {"value": "done", "label": "Done"},
                        ],
                        "label": "Task Status",
                    },
                    {
                        "name": "estimated_hours",
                        "type": "number",
                        "required": False,
                        "min": 0,
                        "label": "Estimated Hours",
                    },
                ]
            },
            slot_configuration={"slots": []},
            is_active=True,
            created_by=user,
        )

        # Set up parent-child relationship
        project_type.allowed_child_types.add(task_type)

        return project_type

    def create_news_instances(self, news_type, user):
        """Create sample news articles"""
        news_data = [
            {
                "title": "AI-Integrated CMS Platform Launch",
                "summary": "Announcing the launch of our revolutionary AI-integrated content management system.",
                "content": "We are excited to announce the launch of ECEEE v4, a groundbreaking content management system that seamlessly integrates artificial intelligence into every aspect of content creation and management. This platform represents a new paradigm in web development.",
                "category": "company",
                "featured": True,
            },
            {
                "title": "New Object Storage System Released",
                "summary": "Our new object storage system allows for flexible, schema-driven content management.",
                "content": "The new Object Storage System provides unprecedented flexibility for managing non-hierarchical content. With dynamic schemas and hierarchical relationships, content creators can now build complex content structures without requiring code changes.",
                "category": "announcement",
                "featured": True,
            },
            {
                "title": "Industry Report: Future of Web Development",
                "summary": "Latest trends and predictions for the web development industry.",
                "content": "Our research team has compiled a comprehensive report on emerging trends in web development, including AI integration, headless CMS architectures, and modern JavaScript frameworks.",
                "category": "research",
                "featured": False,
            },
            {
                "title": "Widget System Enhancement",
                "summary": "Major improvements to our widget system for better performance and usability.",
                "content": "The latest update to our widget system includes performance optimizations, new widget types, and improved configuration interfaces. These enhancements make it easier than ever to create rich, interactive web pages.",
                "category": "company",
                "featured": False,
            },
        ]

        instances = []
        for i, data in enumerate(news_data):
            instance = ObjectInstance.objects.create(
                object_type=news_type,
                title=data["title"],
                data={
                    "title": data["title"],
                    "summary": data["summary"],
                    "content": data["content"],
                    "author": user.id,
                    "category": data["category"],
                    "featured": data["featured"],
                },
                status="published" if i < 3 else "draft",
                publish_date=timezone.now() - timedelta(days=random.randint(1, 30)),
                created_by=user,
            )
            instance.create_version(user, "Initial version")
            instances.append(instance)

        return instances

    def create_blog_instances(self, blog_type, user):
        """Create sample blog posts"""
        blog_data = [
            {
                "title": "Getting Started with Dynamic Object Types",
                "content": "Learn how to create and configure dynamic object types in the new Object Storage System. This comprehensive guide walks you through schema definition, widget configuration, and best practices.",
                "tags": "tutorial, object-storage, getting-started",
                "reading_time": 8,
            },
            {
                "title": "Advanced Hierarchy Management",
                "content": "Explore the powerful hierarchy features of the Object Storage System. Learn how to create complex parent-child relationships and leverage MPTT for efficient tree operations.",
                "tags": "advanced, hierarchy, mptt",
                "reading_time": 12,
            },
            {
                "title": "Widget Integration Best Practices",
                "content": "Discover how to effectively use display widgets to showcase your objects in web pages. This article covers widget configuration, styling, and performance optimization.",
                "tags": "widgets, integration, best-practices",
                "reading_time": 6,
            },
        ]

        instances = []
        for i, data in enumerate(blog_data):
            instance = ObjectInstance.objects.create(
                object_type=blog_type,
                title=data["title"],
                data={
                    "title": data["title"],
                    "content": data["content"],
                    "author": user.id,
                    "tags": data["tags"],
                    "reading_time": data["reading_time"],
                },
                status="published",
                publish_date=timezone.now() - timedelta(days=random.randint(5, 20)),
                created_by=user,
            )
            instance.create_version(user, "Initial version")
            instances.append(instance)

        return instances

    def create_event_instances(self, event_type, user):
        """Create sample events"""
        events_data = [
            {
                "title": "AI & Web Development Workshop",
                "description": "Join us for an interactive workshop on integrating AI into web development workflows.",
                "start_date": timezone.now() + timedelta(days=14),
                "end_date": timezone.now() + timedelta(days=14, hours=3),
                "location": "Tech Hub Conference Room A",
                "capacity": 30,
                "is_virtual": False,
            },
            {
                "title": "Virtual CMS Demo Session",
                "description": "Live demonstration of the ECEEE v4 platform features and capabilities.",
                "start_date": timezone.now() + timedelta(days=7),
                "end_date": timezone.now() + timedelta(days=7, hours=1),
                "location": "Online",
                "capacity": 100,
                "is_virtual": True,
                "registration_url": "https://example.com/register",
            },
            {
                "title": "Developer Meetup: Object Storage Deep Dive",
                "description": "Technical deep dive into the architecture and implementation of our Object Storage System.",
                "start_date": timezone.now() + timedelta(days=21),
                "end_date": timezone.now() + timedelta(days=21, hours=2),
                "location": "Innovation Center",
                "capacity": 50,
                "is_virtual": False,
            },
        ]

        instances = []
        for data in events_data:
            instance = ObjectInstance.objects.create(
                object_type=event_type,
                title=data["title"],
                data={
                    "title": data["title"],
                    "description": data["description"],
                    "start_date": data["start_date"].isoformat(),
                    "end_date": data["end_date"].isoformat(),
                    "location": data["location"],
                    "capacity": data["capacity"],
                    "is_virtual": data["is_virtual"],
                    "registration_url": data.get("registration_url", ""),
                },
                status="published",
                publish_date=timezone.now(),
                created_by=user,
            )
            instance.create_version(user, "Initial version")
            instances.append(instance)

        return instances

    def create_project_instances(self, project_type, user):
        """Create sample projects with tasks"""
        project_data = [
            {
                "title": "Object Storage System Development",
                "description": "Develop a comprehensive object storage system for dynamic content management.",
                "status": "completed",
                "start_date": "2024-01-15",
                "end_date": "2024-03-01",
                "budget": 50000,
                "priority": "high",
            },
            {
                "title": "Frontend Interface Enhancement",
                "description": "Improve the user interface for better usability and modern design.",
                "status": "active",
                "start_date": "2024-02-01",
                "end_date": "2024-04-15",
                "budget": 30000,
                "priority": "medium",
            },
            {
                "title": "Performance Optimization Initiative",
                "description": "Optimize system performance and scalability for enterprise use.",
                "status": "planning",
                "start_date": "2024-04-01",
                "end_date": "2024-06-30",
                "budget": 40000,
                "priority": "high",
            },
        ]

        instances = []
        task_type = ObjectTypeDefinition.objects.get(name="task")

        for i, data in enumerate(project_data):
            project = ObjectInstance.objects.create(
                object_type=project_type,
                title=data["title"],
                data={
                    "title": data["title"],
                    "description": data["description"],
                    "status": data["status"],
                    "start_date": data["start_date"],
                    "end_date": data["end_date"],
                    "budget": data["budget"],
                    "priority": data["priority"],
                },
                status="published",
                publish_date=timezone.now() - timedelta(days=random.randint(10, 60)),
                created_by=user,
            )
            project.create_version(user, "Initial version")
            instances.append(project)

            # Create sample tasks for each project
            task_data = [
                {
                    "title": f'Task 1 for {data["title"]}',
                    "description": "Initial setup and planning phase",
                    "status": "done",
                    "estimated_hours": 16,
                },
                {
                    "title": f'Task 2 for {data["title"]}',
                    "description": "Core implementation and development",
                    "status": "in_progress" if data["status"] == "active" else "done",
                    "estimated_hours": 40,
                },
                {
                    "title": f'Task 3 for {data["title"]}',
                    "description": "Testing and quality assurance",
                    "status": (
                        "todo" if data["status"] in ["planning", "active"] else "done"
                    ),
                    "estimated_hours": 20,
                },
            ]

            for task_data_item in task_data:
                task = ObjectInstance.objects.create(
                    object_type=task_type,
                    title=task_data_item["title"],
                    parent=project,
                    data={
                        "title": task_data_item["title"],
                        "description": task_data_item["description"],
                        "assignee": user.id,
                        "status": task_data_item["status"],
                        "estimated_hours": task_data_item["estimated_hours"],
                    },
                    status="published",
                    created_by=user,
                )
                task.create_version(user, "Initial version")
                instances.append(task)

        return instances
