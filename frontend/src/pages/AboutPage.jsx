import { ExternalLink, GitHub, Book, Zap } from 'lucide-react'

const AboutPage = () => {
  const technologies = [
    {
      category: 'Backend',
      items: [
        { name: 'Django 4.2+', description: 'Python web framework' },
        { name: 'Django REST Framework', description: 'API development' },
        { name: 'PostgreSQL 15', description: 'Database system' },
        { name: 'Redis', description: 'Caching and sessions' },
        { name: 'Celery', description: 'Background tasks' },
      ]
    },
    {
      category: 'Frontend',
      items: [
        { name: 'React 19', description: 'UI library' },
        { name: 'Vite', description: 'Build tool' },
        { name: 'Tailwind CSS', description: 'Styling framework' },
        { name: 'React Router', description: 'Client-side routing' },
        { name: 'React Query', description: 'Data fetching' },
      ]
    },
    {
      category: 'DevOps & Tools',
      items: [
        { name: 'Docker', description: 'Containerization' },
        { name: 'Docker Compose', description: 'Multi-container orchestration' },
        { name: 'Git', description: 'Version control' },
        { name: 'GitHub Actions', description: 'CI/CD pipelines' },
        { name: 'nginx', description: 'Web server' },
      ]
    },
    {
      category: 'AI Integration',
      items: [
        { name: 'Model Context Protocol', description: 'AI tool integration' },
        { name: 'Claude Desktop', description: 'AI assistant' },
        { name: 'Cursor IDE', description: 'AI-powered editor' },
        { name: 'HTMX', description: 'Dynamic server interactions' },
        { name: 'MCP Servers', description: 'Tool connectivity' },
      ]
    }
  ]

  const resources = [
    {
      title: 'Django Documentation',
      description: 'Official Django framework documentation',
      url: 'https://docs.djangoproject.com/',
      icon: Book
    },
    {
      title: 'React Documentation',
      description: 'Official React library documentation',
      url: 'https://react.dev/',
      icon: Book
    },
    {
      title: 'Tailwind CSS',
      description: 'Utility-first CSS framework documentation',
      url: 'https://tailwindcss.com/',
      icon: Zap
    },
    {
      title: 'Model Context Protocol',
      description: 'AI tool integration protocol',
      url: 'https://modelcontextprotocol.io/',
      icon: Book
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          About ECEEE v4
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          A comprehensive AI-integrated development environment designed for modern web application development
          with emphasis on productivity, scalability, and developer experience.
        </p>
      </div>

      {/* Project Overview */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Overview</h2>
        <div className="prose prose-lg text-gray-600">
          <p>
            ECEEE v4 represents a next-generation content management system (CMS) built with modern 
            technologies and AI-assisted development workflows. The project combines the robustness 
            of Django with the flexibility of React, all containerized for consistent development 
            and deployment experiences.
          </p>
          <p>
            The development environment is specifically designed to leverage AI assistance through 
            Model Context Protocol (MCP) servers, enabling intelligent code generation, automated 
            testing, and enhanced developer productivity while maintaining code quality and security standards.
          </p>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Technology Stack</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {technologies.map((category) => (
            <div key={category.category} className="card">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {category.category}
              </h3>
              <div className="space-y-3">
                {category.items.map((tech) => (
                  <div key={tech.name} className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">{tech.name}</h4>
                      <p className="text-sm text-gray-600">{tech.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Features */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Development Experience</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Hot reloading for rapid development</li>
              <li>• Comprehensive testing frameworks</li>
              <li>• Automated code quality checks</li>
              <li>• AI-assisted code generation</li>
              <li>• Integrated debugging tools</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Production Ready</h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Containerized deployment</li>
              <li>• Security best practices</li>
              <li>• Performance optimization</li>
              <li>• Monitoring and logging</li>
              <li>• Scalable architecture</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Resources & Documentation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resources.map((resource) => (
            <a
              key={resource.title}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start space-x-3">
                <resource.icon className="w-6 h-6 text-primary-600 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {resource.title}
                    </h3>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <p className="text-gray-600 mt-1">{resource.description}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-gray-200">
        <p className="text-gray-600">
          Built with ❤️ using AI-assisted development workflows
        </p>
        <p className="text-sm text-gray-500 mt-2">
          ECEEE v4 • {new Date().getFullYear()} • AI-Integrated CMS Platform
        </p>
      </div>
    </div>
  )
}

export default AboutPage