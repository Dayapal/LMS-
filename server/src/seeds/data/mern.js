import { lesson } from './helpers.js';

export default {
  title: 'Full-Stack MERN Development',
  slug: 'full-stack-mern-development',
  summary:
    'Go from HTML basics to deploying full-stack apps with MongoDB, Express, React and Node.js.',
  description: `A project-driven path from the fundamentals of the web to production-ready full-stack applications.

You will build static pages, make them responsive, add interactivity with modern JavaScript, then move to React on the front end and Node.js with Express and MongoDB on the back end. Every module ends with practical work, and the course finishes with a deployed capstone project you can show to employers.

Who it's for: beginners who can use a computer comfortably and want a job-ready MERN skill set.`,
  level: 'beginner',
  estimatedHours: 220,
  tags: ['javascript', 'react', 'node', 'mongodb', 'express'],
  modules: [
    {
      title: 'HTML Fundamentals',
      description: 'Structure web pages with semantic, accessible HTML.',
      lessons: [
        lesson(
          'How the Web Works',
          40,
          'Browsers, servers, HTTP requests and what happens when you open a URL.',
          [
            'Explain the request-response cycle',
            'Describe the roles of DNS, servers and browsers',
            'Read a URL and identify its parts',
          ],
        ),
        lesson(
          'Document Structure and Semantic Tags',
          60,
          'Build pages with headings, sections, lists, links and images using the right elements.',
          [
            'Write a valid HTML5 document skeleton',
            'Choose semantic elements such as header, main, article and nav',
            'Add links and images with meaningful alt text',
          ],
        ),
        lesson(
          'Forms and Accessibility',
          60,
          'Collect user input with forms that work for everyone.',
          [
            'Build forms with labels, inputs, selects and textareas',
            'Use built-in validation attributes',
            'Apply basic accessibility checks to a page',
          ],
        ),
      ],
    },
    {
      title: 'CSS, Flexbox, Grid and Responsive Design',
      description: 'Style pages and build layouts that adapt to any screen.',
      lessons: [
        lesson(
          'Selectors, the Cascade and the Box Model',
          60,
          'Understand how styles are applied and how elements take up space.',
          [
            'Write class, attribute and pseudo-class selectors',
            'Predict which rule wins using specificity',
            'Control spacing with margin, border and padding',
          ],
        ),
        lesson('Flexbox Layouts', 60, 'Align and distribute items in one dimension.', [
          'Build navigation bars and card rows with flexbox',
          'Use justify-content, align-items and gap',
          'Control item growth with flex-grow and flex-basis',
        ]),
        lesson('CSS Grid Layouts', 60, 'Create two-dimensional page layouts.', [
          'Define grid templates with fr units and repeat()',
          'Place items with grid lines and areas',
          'Combine grid and flexbox in one page',
        ]),
        lesson(
          'Responsive Design and Media Queries',
          50,
          'Make layouts work from phones to desktops.',
          [
            'Apply a mobile-first approach',
            'Write media queries for breakpoints',
            'Use relative units and responsive images',
          ],
        ),
      ],
    },
    {
      title: 'JavaScript Fundamentals and Advanced Concepts',
      description: 'Learn the language that powers the whole MERN stack.',
      lessons: [
        lesson(
          'Variables, Types and Operators',
          50,
          'The building blocks of every JavaScript program.',
          [
            'Declare variables with let and const',
            'Work with strings, numbers, booleans, null and undefined',
            'Use comparison and logical operators correctly',
          ],
        ),
        lesson(
          'Functions, Scope and Closures',
          70,
          'Write reusable logic and understand where variables live.',
          [
            'Write function declarations, expressions and arrow functions',
            'Explain block scope and lexical scope',
            'Use closures to keep private state',
          ],
        ),
        lesson('Arrays and Objects', 70, 'Model data and transform it with built-in methods.', [
          'Use map, filter, reduce and find',
          'Destructure arrays and objects',
          'Copy and merge data with the spread operator',
        ]),
        lesson('Classes, Prototypes and this', 60, 'Understand object-oriented JavaScript.', [
          'Explain how prototypes link objects',
          'Write classes with constructors and methods',
          'Predict the value of this in different calls',
        ]),
      ],
    },
    {
      title: 'DOM, Events, Promises, Async/Await and Fetch',
      description: 'Make pages interactive and talk to APIs.',
      lessons: [
        lesson(
          'Selecting and Updating the DOM',
          50,
          'Read and change page content from JavaScript.',
          [
            'Select elements with querySelector',
            'Create, update and remove elements',
            'Toggle classes to change styles',
          ],
        ),
        lesson(
          'Events and Event Delegation',
          50,
          'Respond to clicks, input and form submissions.',
          [
            'Attach and remove event listeners',
            'Use the event object and preventDefault',
            'Handle events for many elements with delegation',
          ],
        ),
        lesson(
          'Promises and Async/Await',
          70,
          'Write asynchronous code that reads like synchronous code.',
          [
            'Explain the event loop at a high level',
            'Chain promises and handle errors',
            'Rewrite promise chains with async/await and try/catch',
          ],
        ),
        lesson('Fetching Data from APIs', 60, 'Load and send JSON with the Fetch API.', [
          'Make GET and POST requests with fetch',
          'Handle loading, success and error states in the UI',
          'Parse and render JSON responses',
        ]),
      ],
    },
    {
      title: 'Git and GitHub',
      description: 'Track your work and collaborate like a professional developer.',
      lessons: [
        lesson('Version Control with Git', 50, 'Commit, inspect and undo changes locally.', [
          'Initialize a repository and make commits',
          'Read history with git log and git diff',
          'Undo mistakes safely',
        ]),
        lesson('Branching and Merging', 50, 'Work on features in isolation and combine them.', [
          'Create and switch branches',
          'Merge branches and resolve conflicts',
          'Follow a simple feature-branch workflow',
        ]),
        lesson('Collaborating on GitHub', 50, 'Push code, open pull requests and review changes.', [
          'Connect a local repository to GitHub',
          'Open and review a pull request',
          'Write useful commit messages and README files',
        ]),
      ],
    },
    {
      title: 'React.js, Hooks, Routing and State Management',
      description: 'Build modern user interfaces with components.',
      lessons: [
        lesson(
          'Components, JSX and Props',
          60,
          'Think in components and pass data down the tree.',
          [
            'Write function components with JSX',
            'Pass and validate props',
            'Render lists with keys and conditional content',
          ],
        ),
        lesson(
          'State and Effects with Hooks',
          70,
          'Make components interactive and sync them with the outside world.',
          [
            'Manage local state with useState',
            'Run side effects with useEffect and clean them up',
            'Lift state up to share it between components',
          ],
        ),
        lesson('Forms and Controlled Inputs', 50, 'Collect and validate user input in React.', [
          'Build controlled form inputs',
          'Validate input and show error messages',
          'Submit form data to an API',
        ]),
        lesson(
          'Routing with React Router',
          50,
          'Build multi-page experiences in a single-page app.',
          [
            'Define routes and nested layouts',
            'Read URL parameters',
            'Protect routes that need a signed-in user',
          ],
        ),
        lesson(
          'Global State with Context',
          50,
          'Share data across the app without prop drilling.',
          [
            'Create and provide a context',
            'Combine context with useReducer',
            'Decide when global state is worth it',
          ],
        ),
      ],
    },
    {
      title: 'Node.js and Express.js',
      description: 'Write server-side JavaScript and build web servers.',
      lessons: [
        lesson('Node.js Runtime and Modules', 50, 'Run JavaScript outside the browser.', [
          'Explain what Node.js is and how it differs from the browser',
          'Use ES modules and npm packages',
          'Read and write files with the fs module',
        ]),
        lesson('Building a Server with Express', 60, 'Create routes and send responses.', [
          'Create an Express app and define routes',
          'Read params, query strings and JSON bodies',
          'Send JSON responses with proper status codes',
        ]),
        lesson(
          'Middleware and Error Handling',
          60,
          'Structure request processing with middleware.',
          [
            'Write and order custom middleware',
            'Centralize error handling',
            'Organize routes, controllers and services',
          ],
        ),
      ],
    },
    {
      title: 'REST APIs and Authentication',
      description: 'Design APIs and secure them.',
      lessons: [
        lesson('Designing RESTful APIs', 60, 'Model resources, endpoints and responses.', [
          'Map CRUD operations to HTTP methods',
          'Design consistent URLs and response shapes',
          'Validate request input on the server',
        ]),
        lesson(
          'Password Hashing and JWT Authentication',
          70,
          'Register and sign in users securely.',
          [
            'Hash passwords with bcrypt',
            'Issue and verify JSON Web Tokens',
            'Protect routes with authentication middleware',
          ],
        ),
        lesson(
          'Authorization and API Security',
          60,
          'Control who can do what and harden the API.',
          [
            'Implement role-based access control',
            'Configure CORS, security headers and rate limiting',
            'Never trust ownership or role values from the client',
          ],
        ),
      ],
    },
    {
      title: 'MongoDB and Mongoose',
      description: 'Store and query application data.',
      lessons: [
        lesson(
          'Documents, Collections and Queries',
          60,
          'Understand the document model and basic queries.',
          [
            'Insert, find, update and delete documents',
            'Filter with query operators',
            'Sort, limit and paginate results',
          ],
        ),
        lesson(
          'Schemas and Models with Mongoose',
          60,
          'Add structure and validation to your data.',
          [
            'Define schemas with types and validators',
            'Create models and run CRUD operations',
            'Use timestamps and default values',
          ],
        ),
        lesson(
          'Relationships, Indexes and Aggregation',
          70,
          'Model related data and query it efficiently.',
          [
            'Choose between embedding and referencing',
            'Populate references',
            'Add indexes and write simple aggregation pipelines',
          ],
        ),
      ],
    },
    {
      title: 'Full-Stack CRUD Projects',
      description: 'Connect React to your Express API end to end.',
      lessons: [
        lesson('Connecting React to an Express API', 60, 'Call your own API from the front end.', [
          'Configure a development proxy',
          'Fetch, create, update and delete records from React',
          'Handle API errors in the UI',
        ]),
        lesson('Project: Task Manager', 120, 'Build a complete task manager with authentication.', [
          'Plan models, endpoints and screens',
          'Implement full CRUD with protected routes',
          'Add filtering and pagination',
        ]),
        lesson('Project: Blog Platform', 120, 'Build a multi-user blog with comments.', [
          'Model users, posts and comments',
          'Restrict editing to the author',
          'Write a short README describing the project',
        ]),
      ],
    },
    {
      title: 'Deployment and Capstone Project',
      description: 'Ship your work to the internet and build a portfolio piece.',
      lessons: [
        lesson('Environment Configuration and Builds', 50, 'Prepare apps for production.', [
          'Manage secrets with environment variables',
          'Create production builds of the front end',
          'Use a cloud MongoDB database',
        ]),
        lesson('Deploying Front End and Back End', 60, 'Put your full-stack app online.', [
          'Deploy a React app to a static host',
          'Deploy an Express API to a cloud platform',
          'Configure the client to reach the API in production',
        ]),
        lesson(
          'Capstone Project',
          240,
          'Design, build and deploy an original full-stack application.',
          [
            'Write a project proposal with features and data models',
            'Build and deploy the application',
            'Present the project and its technical decisions',
          ],
        ),
      ],
    },
  ],
};
