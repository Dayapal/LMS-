import { lesson } from './helpers.js';

export default {
  title: 'Java Full-Stack Development',
  slug: 'java-full-stack-development',
  summary:
    'Master Java, SQL and Spring Boot, then connect a JavaScript front end to build complete applications.',
  description: `A structured path through the Java ecosystem used by enterprise teams.

You start with core Java and object-oriented design, learn to work with relational databases through JDBC and SQL, then build REST APIs with Spring Boot, Spring Data JPA and Spring Security. Front-end fundamentals let you connect a user interface to your APIs, and the course closes with deployment and a capstone project.

Who it's for: learners who want to work on Java back ends or full-stack teams in enterprise environments.`,
  level: 'intermediate',
  estimatedHours: 240,
  tags: ['java', 'spring-boot', 'sql', 'jpa'],
  modules: [
    {
      title: 'Java Fundamentals',
      description: 'Write, compile and run your first Java programs.',
      lessons: [
        lesson(
          'Setting Up the JDK and Your First Program',
          40,
          'Install the tools and understand how Java code runs.',
          [
            'Install a JDK and an IDE',
            'Explain compilation to bytecode and the JVM',
            'Write and run a main method',
          ],
        ),
        lesson(
          'Variables, Data Types and Operators',
          50,
          'Work with primitives, strings and expressions.',
          [
            'Use primitive types and type casting',
            'Work with String methods',
            'Write arithmetic and logical expressions',
          ],
        ),
        lesson(
          'Control Flow and Methods',
          60,
          'Make decisions, loop and organize code into methods.',
          [
            'Use if, switch and loops',
            'Write methods with parameters and return values',
            'Read input with Scanner',
          ],
        ),
      ],
    },
    {
      title: 'Object-Oriented Programming',
      description: 'Design programs with classes and objects.',
      lessons: [
        lesson('Classes, Objects and Constructors', 60, 'Model real-world entities in code.', [
          'Define classes with fields and methods',
          'Write constructors and use this',
          'Apply encapsulation with access modifiers',
        ]),
        lesson('Inheritance and Polymorphism', 60, 'Reuse and extend behaviour.', [
          'Extend classes and override methods',
          'Use super and dynamic dispatch',
          'Explain compile-time vs run-time polymorphism',
        ]),
        lesson(
          'Abstraction and Interfaces',
          60,
          'Program to contracts instead of implementations.',
          [
            'Write abstract classes and interfaces',
            'Choose between them for a design',
            'Apply basic SOLID principles',
          ],
        ),
      ],
    },
    {
      title: 'Arrays, Strings and Collections',
      description: 'Store and process groups of data.',
      lessons: [
        lesson('Arrays and String Handling', 50, 'Work with fixed-size data and text.', [
          'Declare and iterate arrays',
          'Use StringBuilder for efficient string building',
          'Solve common array and string exercises',
        ]),
        lesson('Lists, Sets and Maps', 60, 'Use the Collections Framework.', [
          'Choose between ArrayList, LinkedList, HashSet and HashMap',
          'Iterate collections safely',
          'Sort with Comparable and Comparator',
        ]),
        lesson(
          'Generics and the Stream API',
          60,
          'Write type-safe, expressive data processing code.',
          [
            'Use generic classes and methods',
            'Filter, map and collect with streams',
            'Write lambda expressions and method references',
          ],
        ),
      ],
    },
    {
      title: 'Exception Handling',
      description: 'Handle errors and keep programs robust.',
      lessons: [
        lesson('Checked and Unchecked Exceptions', 50, 'Understand the exception hierarchy.', [
          'Use try, catch and finally',
          'Explain checked vs unchecked exceptions',
          'Use try-with-resources for cleanup',
        ]),
        lesson('Custom Exceptions and Best Practices', 40, 'Design meaningful error handling.', [
          'Create custom exception classes',
          'Decide when to throw, catch or rethrow',
          'Log errors usefully',
        ]),
      ],
    },
    {
      title: 'JDBC and Database Fundamentals',
      description: 'Connect Java applications to relational databases.',
      lessons: [
        lesson('Relational Database Concepts', 50, 'Tables, keys and relationships.', [
          'Explain tables, rows, primary and foreign keys',
          'Describe one-to-many and many-to-many relationships',
          'Normalize a simple schema',
        ]),
        lesson('Connecting with JDBC', 60, 'Run queries from Java code.', [
          'Open a connection with DriverManager',
          'Use PreparedStatement to prevent SQL injection',
          'Map ResultSet rows to Java objects',
        ]),
        lesson('Transactions and the DAO Pattern', 50, 'Keep data consistent and code organized.', [
          'Commit and roll back transactions',
          'Structure data access with DAO classes',
          'Handle SQLExceptions cleanly',
        ]),
      ],
    },
    {
      title: 'SQL',
      description: 'Query and shape relational data.',
      lessons: [
        lesson('SELECT, Filtering and Sorting', 50, 'Retrieve exactly the data you need.', [
          'Write SELECT with WHERE, ORDER BY and LIMIT',
          'Use comparison, LIKE and IN operators',
          'Handle NULL values',
        ]),
        lesson('Joins and Aggregation', 60, 'Combine tables and summarize data.', [
          'Write INNER, LEFT and RIGHT joins',
          'Use GROUP BY with COUNT, SUM and AVG',
          'Filter groups with HAVING',
        ]),
        lesson('DDL, Constraints and Indexes', 50, 'Define and protect your schema.', [
          'Create and alter tables',
          'Add NOT NULL, UNIQUE and foreign key constraints',
          'Explain when indexes help performance',
        ]),
      ],
    },
    {
      title: 'HTML, CSS and JavaScript Fundamentals',
      description: 'Build the front end that talks to your Java APIs.',
      lessons: [
        lesson('HTML and CSS Essentials', 60, 'Structure and style web pages.', [
          'Write semantic HTML documents',
          'Style layouts with flexbox and grid',
          'Make pages responsive',
        ]),
        lesson('JavaScript Essentials', 60, 'Add logic to the browser.', [
          'Use variables, functions, arrays and objects',
          'Handle DOM events',
          'Write asynchronous code with async/await',
        ]),
        lesson('Calling APIs with Fetch', 50, 'Load and send data from the browser.', [
          'Send GET and POST requests with fetch',
          'Render API data into the page',
          'Handle loading and error states',
        ]),
      ],
    },
    {
      title: 'Spring Boot',
      description: 'Build production-grade applications quickly.',
      lessons: [
        lesson('Spring Boot Project Setup', 50, 'Create and run a Spring Boot application.', [
          'Generate a project with Spring Initializr',
          'Understand auto-configuration and starters',
          'Configure the app with application.properties',
        ]),
        lesson('Dependency Injection and Beans', 60, 'Let Spring wire your application together.', [
          'Explain inversion of control',
          'Use @Component, @Service and @Autowired',
          'Inject configuration values',
        ]),
        lesson('Layered Architecture', 50, 'Organize controllers, services and repositories.', [
          'Separate web, business and data layers',
          'Use DTOs between layers',
          'Write unit tests for services',
        ]),
      ],
    },
    {
      title: 'REST APIs',
      description: 'Expose your application over HTTP.',
      lessons: [
        lesson('Building REST Controllers', 60, 'Map HTTP requests to Java methods.', [
          'Use @RestController and request mappings',
          'Read path variables, query params and request bodies',
          'Return proper status codes with ResponseEntity',
        ]),
        lesson('Validation and Error Handling', 50, 'Reject bad input and return clear errors.', [
          'Validate DTOs with Bean Validation',
          'Handle exceptions with @ControllerAdvice',
          'Return a consistent error response shape',
        ]),
        lesson('Testing and Documenting APIs', 50, 'Prove your API works and describe it.', [
          'Test endpoints with Postman',
          'Write controller tests with MockMvc',
          'Generate API docs with OpenAPI',
        ]),
      ],
    },
    {
      title: 'Spring Data JPA and Hibernate',
      description: 'Persist Java objects without hand-written SQL.',
      lessons: [
        lesson('Entities and Repositories', 60, 'Map classes to tables.', [
          'Annotate entities with @Entity and @Id',
          'Use JpaRepository for CRUD',
          'Write derived query methods',
        ]),
        lesson('Entity Relationships', 60, 'Model associations between entities.', [
          'Map one-to-many and many-to-many relationships',
          'Choose fetch types and cascade options',
          'Avoid the N+1 query problem',
        ]),
        lesson('Custom Queries and Pagination', 50, 'Go beyond basic repository methods.', [
          'Write JPQL queries with @Query',
          'Paginate and sort with Pageable',
          'Use projections for efficient reads',
        ]),
      ],
    },
    {
      title: 'Authentication and Authorization',
      description: 'Secure Spring applications.',
      lessons: [
        lesson('Spring Security Basics', 60, 'Understand the security filter chain.', [
          'Configure Spring Security',
          'Hash passwords with BCrypt',
          'Secure endpoints by path',
        ]),
        lesson('JWT Authentication', 70, 'Implement stateless authentication for APIs.', [
          'Issue JWTs on login',
          'Validate tokens in a filter',
          'Handle token expiry',
        ]),
        lesson('Role-Based Access Control', 50, 'Allow actions based on user roles.', [
          'Assign roles to users',
          'Protect methods with @PreAuthorize',
          'Enforce ownership checks in services',
        ]),
      ],
    },
    {
      title: 'Full-Stack Integration',
      description: 'Connect the front end to your Spring Boot API.',
      lessons: [
        lesson('CORS and API Integration', 50, 'Let the browser call your API safely.', [
          'Configure CORS in Spring Boot',
          'Call secured endpoints from the browser',
          'Store and send tokens correctly',
        ]),
        lesson('Project: Library Management System', 150, 'Build a full-stack CRUD application.', [
          'Design entities, endpoints and screens',
          'Implement authentication and role-based features',
          'Add search and pagination',
        ]),
      ],
    },
    {
      title: 'Deployment and Capstone Project',
      description: 'Ship your application and build a portfolio project.',
      lessons: [
        lesson('Packaging and Deploying Spring Boot', 60, 'Run your application in production.', [
          'Build an executable JAR with Maven',
          'Use profiles and environment variables',
          'Deploy the API and a managed database',
        ]),
        lesson(
          'Capstone Project',
          240,
          'Design, build and deploy an original full-stack Java application.',
          [
            'Write a project proposal',
            'Build and deploy the application',
            'Present the architecture and trade-offs',
          ],
        ),
      ],
    },
  ],
};
