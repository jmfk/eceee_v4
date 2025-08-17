"""
Utility module for generating realistic development data
Provides reusable functions for creating sample data across different Django projects
"""

import random
import string
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from django.utils import timezone
from django.contrib.auth.models import User


class DevDataGenerator:
    """Utility class for generating realistic development data."""

    def __init__(self, seed: Optional[int] = None):
        """Initialize the generator with optional random seed."""
        if seed is not None:
            random.seed(seed)

        # Common data pools
        self.first_names = [
            "Sarah",
            "Michael",
            "Emily",
            "James",
            "Lisa",
            "David",
            "Maria",
            "Robert",
            "Jennifer",
            "William",
            "Jessica",
            "John",
            "Ashley",
            "Christopher",
            "Amanda",
            "Daniel",
            "Melissa",
            "Matthew",
            "Deborah",
            "Anthony",
            "Dorothy",
            "Mark",
            "Nancy",
            "Donald",
            "Karen",
            "Steven",
            "Betty",
            "Paul",
            "Helen",
            "Andrew",
        ]

        self.last_names = [
            "Johnson",
            "Williams",
            "Brown",
            "Jones",
            "Garcia",
            "Miller",
            "Davis",
            "Rodriguez",
            "Martinez",
            "Hernandez",
            "Lopez",
            "Gonzalez",
            "Wilson",
            "Anderson",
            "Thomas",
            "Taylor",
            "Moore",
            "Jackson",
            "Martin",
            "Lee",
            "Perez",
            "Thompson",
            "White",
            "Harris",
            "Sanchez",
            "Clark",
            "Ramirez",
            "Lewis",
            "Robinson",
            "Walker",
        ]

        self.company_suffixes = [
            "Inc",
            "LLC",
            "Corp",
            "Ltd",
            "Co",
            "Group",
            "Solutions",
            "Systems",
            "Technologies",
            "Services",
            "Consulting",
            "Partners",
            "Associates",
        ]

        self.job_titles = [
            "Manager",
            "Director",
            "Analyst",
            "Coordinator",
            "Specialist",
            "Lead",
            "Senior Manager",
            "Vice President",
            "Associate",
            "Consultant",
            "Engineer",
            "Developer",
            "Designer",
            "Researcher",
            "Administrator",
            "Supervisor",
        ]

        self.departments = [
            "Research & Development",
            "Marketing",
            "Sales",
            "Human Resources",
            "Information Technology",
            "Operations",
            "Finance",
            "Customer Service",
            "Product Development",
            "Quality Assurance",
            "Business Development",
            "Strategy & Planning",
            "Communications",
            "Legal",
            "Procurement",
        ]

        self.cities = [
            "New York",
            "Los Angeles",
            "Chicago",
            "Houston",
            "Phoenix",
            "Philadelphia",
            "San Antonio",
            "San Diego",
            "Dallas",
            "San Jose",
            "Austin",
            "Jacksonville",
            "Fort Worth",
            "Columbus",
            "Charlotte",
            "San Francisco",
            "Indianapolis",
            "Seattle",
            "Denver",
            "Washington",
            "Boston",
            "Nashville",
            "Baltimore",
            "Oklahoma City",
            "Louisville",
            "Portland",
            "Las Vegas",
            "Milwaukee",
        ]

        self.countries = [
            "United States",
            "Canada",
            "United Kingdom",
            "Germany",
            "France",
            "Italy",
            "Spain",
            "Netherlands",
            "Sweden",
            "Norway",
            "Denmark",
            "Finland",
            "Australia",
            "New Zealand",
            "Japan",
            "South Korea",
            "Singapore",
        ]

    def generate_email(
        self, first_name: str = None, last_name: str = None, domain: str = "example.com"
    ) -> str:
        """Generate a realistic email address."""
        if not first_name:
            first_name = random.choice(self.first_names)
        if not last_name:
            last_name = random.choice(self.last_names)

        # Clean names for email
        first_clean = first_name.lower().replace(" ", "").replace(".", "")
        last_clean = last_name.lower().replace(" ", "").replace(".", "")

        patterns = [
            f"{first_clean}.{last_clean}@{domain}",
            f"{first_clean}{last_clean}@{domain}",
            f"{first_clean[0]}{last_clean}@{domain}",
            f"{first_clean}.{last_clean[0]}@{domain}",
        ]

        return random.choice(patterns)

    def generate_phone_number(self) -> str:
        """Generate a realistic phone number."""
        area_code = random.randint(200, 999)
        exchange = random.randint(200, 999)
        number = random.randint(1000, 9999)
        return f"+1{area_code}{exchange}{number}"

    def generate_company_name(self) -> str:
        """Generate a realistic company name."""
        patterns = [
            lambda: f"{random.choice(self.last_names)} {random.choice(self.company_suffixes)}",
            lambda: f"{random.choice(self.last_names)} & {random.choice(self.last_names)}",
            lambda: f"{random.choice(self.cities)} {random.choice(self.company_suffixes)}",
            lambda: f"Global {random.choice(['Tech', 'Solutions', 'Systems', 'Services'])}",
            lambda: f"{random.choice(['Advanced', 'Innovative', 'Premier', 'Elite'])} {random.choice(['Technologies', 'Solutions', 'Systems'])}",
        ]

        return random.choice(patterns)()

    def generate_address(self) -> Dict[str, str]:
        """Generate a realistic address."""
        street_number = random.randint(1, 9999)
        street_names = [
            "Main St",
            "Oak Ave",
            "Park Rd",
            "First St",
            "Second St",
            "Third St",
            "Elm St",
            "Washington Ave",
            "Lincoln St",
            "Madison Ave",
            "Jefferson St",
            "Franklin St",
            "Cedar Ave",
            "Pine St",
            "Maple Ave",
            "Church St",
        ]

        return {
            "street": f"{street_number} {random.choice(street_names)}",
            "city": random.choice(self.cities),
            "state": random.choice(
                ["CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI"]
            ),
            "zip_code": f"{random.randint(10000, 99999)}",
            "country": random.choice(self.countries),
        }

    def generate_lorem_ipsum(
        self, sentences: int = 3, words_per_sentence: int = 15
    ) -> str:
        """Generate lorem ipsum-style text."""
        lorem_words = [
            "lorem",
            "ipsum",
            "dolor",
            "sit",
            "amet",
            "consectetur",
            "adipiscing",
            "elit",
            "sed",
            "do",
            "eiusmod",
            "tempor",
            "incididunt",
            "ut",
            "labore",
            "et",
            "dolore",
            "magna",
            "aliqua",
            "enim",
            "ad",
            "minim",
            "veniam",
            "quis",
            "nostrud",
            "exercitation",
            "ullamco",
            "laboris",
            "nisi",
            "aliquip",
            "ex",
            "ea",
            "commodo",
            "consequat",
            "duis",
            "aute",
            "irure",
            "in",
            "reprehenderit",
            "voluptate",
            "velit",
            "esse",
            "cillum",
            "fugiat",
            "nulla",
            "pariatur",
            "excepteur",
            "sint",
            "occaecat",
            "cupidatat",
            "non",
            "proident",
            "sunt",
            "culpa",
            "qui",
            "officia",
            "deserunt",
            "mollit",
            "anim",
            "id",
            "est",
            "laborum",
        ]

        result = []
        for _ in range(sentences):
            sentence_words = random.sample(
                lorem_words, min(words_per_sentence, len(lorem_words))
            )
            sentence = " ".join(sentence_words).capitalize() + "."
            result.append(sentence)

        return " ".join(result)

    def generate_realistic_content(self, content_type: str, title: str = None) -> str:
        """Generate realistic content based on type."""
        if content_type == "news":
            return self._generate_news_content(title)
        elif content_type == "event":
            return self._generate_event_content(title)
        elif content_type == "research":
            return self._generate_research_content(title)
        elif content_type == "policy":
            return self._generate_policy_content(title)
        else:
            return self.generate_lorem_ipsum(sentences=random.randint(3, 8))

    def _generate_news_content(self, title: str = None) -> str:
        """Generate news article content."""
        templates = [
            "We are pleased to announce {announcement}. This development represents a significant milestone in our ongoing efforts to {goal}. The initiative will {action} and is expected to {outcome}.",
            "In a recent development, {event} has taken place. This marks an important step forward in {area}. Stakeholders are optimistic about the potential impact on {beneficiaries}.",
            "Following extensive research and planning, {project} has been launched. The project aims to {objective} and will benefit {target_audience}. Initial results show {positive_indicator}.",
        ]

        template = random.choice(templates)

        # Fill in template variables
        replacements = {
            "announcement": random.choice(
                [
                    "a new partnership",
                    "the launch of our latest initiative",
                    "significant progress in our research",
                ]
            ),
            "goal": random.choice(
                [
                    "advance scientific understanding",
                    "improve community outcomes",
                    "drive innovation",
                ]
            ),
            "action": random.choice(
                [
                    "provide new opportunities",
                    "enhance existing services",
                    "create valuable resources",
                ]
            ),
            "outcome": random.choice(
                [
                    "have lasting positive impact",
                    "benefit the broader community",
                    "advance the field",
                ]
            ),
            "event": random.choice(
                [
                    "a major collaboration",
                    "an important agreement",
                    "a significant breakthrough",
                ]
            ),
            "area": random.choice(
                ["sustainability", "technology", "education", "research"]
            ),
            "beneficiaries": random.choice(
                ["the community", "researchers", "students", "professionals"]
            ),
            "project": random.choice(
                [
                    "our new research program",
                    "the community initiative",
                    "the innovation project",
                ]
            ),
            "objective": random.choice(
                [
                    "address key challenges",
                    "provide valuable insights",
                    "create meaningful change",
                ]
            ),
            "target_audience": random.choice(
                [
                    "researchers and practitioners",
                    "the broader community",
                    "industry professionals",
                ]
            ),
            "positive_indicator": random.choice(
                [
                    "promising early outcomes",
                    "strong community engagement",
                    "positive feedback",
                ]
            ),
        }

        content = template
        for key, value in replacements.items():
            content = content.replace(f"{{{key}}}", value)

        return content

    def _generate_event_content(self, title: str = None) -> str:
        """Generate event description content."""
        templates = [
            "Join us for {event_name}, an exciting opportunity to {purpose}. This event will feature {features} and provide excellent networking opportunities. Participants will {benefit} and gain valuable insights from {experts}.",
            "We invite you to attend {event_name}, where {description}. The event includes {activities} and is designed for {audience}. Don't miss this chance to {opportunity}.",
        ]

        template = random.choice(templates)

        replacements = {
            "event_name": title or "this important gathering",
            "purpose": random.choice(
                [
                    "connect with industry leaders",
                    "explore new developments",
                    "share knowledge and insights",
                ]
            ),
            "features": random.choice(
                ["keynote presentations", "interactive workshops", "panel discussions"]
            ),
            "benefit": random.choice(
                [
                    "expand their knowledge",
                    "build valuable connections",
                    "discover new opportunities",
                ]
            ),
            "experts": random.choice(
                [
                    "leading researchers",
                    "industry professionals",
                    "subject matter experts",
                ]
            ),
            "description": random.choice(
                [
                    "experts will share their insights",
                    "we'll explore current trends",
                    "participants will engage in meaningful discussions",
                ]
            ),
            "activities": random.choice(
                [
                    "presentations, workshops, and networking sessions",
                    "interactive sessions and group discussions",
                    "expert panels and Q&A sessions",
                ]
            ),
            "audience": random.choice(
                [
                    "professionals in the field",
                    "researchers and practitioners",
                    "anyone interested in the topic",
                ]
            ),
            "opportunity": random.choice(
                [
                    "learn from the best",
                    "advance your knowledge",
                    "make valuable connections",
                ]
            ),
        }

        content = template
        for key, value in replacements.items():
            content = content.replace(f"{{{key}}}", value)

        return content

    def _generate_research_content(self, title: str = None) -> str:
        """Generate research-focused content."""
        return f"This research {random.choice(['examines', 'investigates', 'explores'])} {random.choice(['key aspects of', 'important factors in', 'critical elements of'])} {random.choice(['sustainable development', 'technological innovation', 'environmental science', 'policy implementation'])}. The study {random.choice(['provides insights into', 'offers new perspectives on', 'contributes to understanding of'])} {random.choice(['current challenges', 'emerging trends', 'best practices'])} and {random.choice(['proposes solutions', 'recommends approaches', 'suggests strategies'])} for {random.choice(['future development', 'improved outcomes', 'enhanced effectiveness'])}."

    def _generate_policy_content(self, title: str = None) -> str:
        """Generate policy-focused content."""
        return f"This policy document {random.choice(['outlines', 'establishes', 'defines'])} {random.choice(['guidelines for', 'frameworks for', 'standards for'])} {random.choice(['organizational practices', 'operational procedures', 'strategic initiatives'])}. It {random.choice(['addresses', 'covers', 'encompasses'])} {random.choice(['key requirements', 'important considerations', 'essential elements'])} and {random.choice(['provides guidance', 'offers direction', 'establishes protocols'])} for {random.choice(['implementation', 'compliance', 'effective execution'])}."

    def generate_date_range(
        self, start_days_ago: int = 365, end_days_ahead: int = 90
    ) -> tuple:
        """Generate a random date range."""
        start_date = timezone.now() - timedelta(days=random.randint(1, start_days_ago))
        end_date = start_date + timedelta(days=random.randint(1, end_days_ahead))
        return start_date, end_date

    def generate_user_data(self, count: int = 1) -> List[Dict[str, Any]]:
        """Generate realistic user data."""
        users = []
        for _ in range(count):
            first_name = random.choice(self.first_names)
            last_name = random.choice(self.last_names)

            user_data = {
                "first_name": first_name,
                "last_name": last_name,
                "username": f"{first_name.lower()}.{last_name.lower()}{random.randint(1, 999)}",
                "email": self.generate_email(first_name, last_name),
                "phone": self.generate_phone_number(),
                "job_title": f"{random.choice(['Senior', 'Lead', 'Principal', ''])} {random.choice(self.job_titles)}".strip(),
                "department": random.choice(self.departments),
                "company": self.generate_company_name(),
                "address": self.generate_address(),
                "bio": self.generate_realistic_content("research"),
            }
            users.append(user_data)

        return users

    def get_or_create_admin_user(self) -> User:
        """Get or create an admin user for development."""
        try:
            user = User.objects.get(is_superuser=True)
        except User.DoesNotExist:
            user = User.objects.create_user(
                username="admin",
                email="admin@example.com",
                password="admin123!",
                first_name="Admin",
                last_name="User",
                is_superuser=True,
                is_staff=True,
            )
        except User.MultipleObjectsReturned:
            user = User.objects.filter(is_superuser=True).first()

        return user


# Convenience functions for quick access
def generate_sample_text(sentences: int = 3) -> str:
    """Quick function to generate sample text."""
    generator = DevDataGenerator()
    return generator.generate_lorem_ipsum(sentences=sentences)


def generate_sample_email(domain: str = "example.com") -> str:
    """Quick function to generate sample email."""
    generator = DevDataGenerator()
    return generator.generate_email(domain=domain)


def generate_sample_phone() -> str:
    """Quick function to generate sample phone number."""
    generator = DevDataGenerator()
    return generator.generate_phone_number()
