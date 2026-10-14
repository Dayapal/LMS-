/**
 * One generated PDF per starter course, attached to the course's first lesson.
 * Text is kept to plain ASCII because the PDF uses the standard fonts.
 */
export const CHEAT_SHEETS = {
  'full-stack-mern-development': {
    lesson: 'How the Web Works',
    materialTitle: 'MERN quick reference (PDF)',
    filename: 'mern-quick-reference.pdf',
    title: 'MERN Quick Reference',
    subtitle: 'Full-Stack MERN Development - commands and patterns you will use every week',
    sections: [
      {
        heading: 'HTTP essentials',
        text: [
          'Methods: GET reads, POST creates, PUT replaces, PATCH updates part of a resource, DELETE removes.',
          'Status codes: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthenticated, 403 Forbidden, 404 Not Found, 409 Conflict, 500 Server Error.',
        ],
      },
      {
        heading: 'Git',
        code: [
          'git init                      # start a repository',
          'git status                    # what changed?',
          'git add -A && git commit -m "Describe the change"',
          'git switch -c feature/login   # new branch',
          'git push -u origin feature/login',
          'git pull --rebase             # update before pushing',
        ],
      },
      {
        heading: 'Modern JavaScript',
        code: [
          'const { name, ...rest } = user;          // destructuring',
          'const copy = { ...user, active: true };  // spread',
          'const total = items.reduce((sum, i) => sum + i.price, 0);',
          'const res = await fetch("/api/tasks");',
          'if (!res.ok) throw new Error(res.statusText);',
        ],
      },
      {
        heading: 'React',
        code: [
          'const [count, setCount] = useState(0);',
          'useEffect(() => { /* sync */ return () => { /* cleanup */ }; }, [deps]);',
          '{items.map((item) => <Item key={item.id} {...item} />)}',
        ],
      },
      {
        heading: 'Express and Mongoose',
        code: [
          'app.use(express.json());',
          'app.get("/api/tasks/:id", async (req, res) => {',
          '  const task = await Task.findById(req.params.id);',
          '  if (!task) return res.status(404).json({ message: "Not found" });',
          '  res.json(task);',
          '});',
        ],
      },
      {
        heading: 'Security checklist',
        text: [
          'Hash passwords with bcrypt. Validate every request body on the server. Take user ids from the verified token, never from the request body. Keep secrets in environment variables and out of Git.',
        ],
      },
    ],
  },

  'java-full-stack-development': {
    lesson: 'Setting Up the JDK and Your First Program',
    materialTitle: 'Java and Spring quick reference (PDF)',
    filename: 'java-spring-quick-reference.pdf',
    title: 'Java and Spring Quick Reference',
    subtitle: 'Java Full-Stack Development - syntax, SQL and Spring Boot at a glance',
    sections: [
      {
        heading: 'Java basics',
        code: [
          'int count = 0; double price = 9.99; boolean done = false;',
          'String name = "Asha"; var list = new ArrayList<String>();',
          'for (String item : list) { System.out.println(item); }',
          'record Point(int x, int y) {}',
        ],
      },
      {
        heading: 'Collections and streams',
        code: [
          'List<String> names = List.of("b", "a");',
          'Map<String, Integer> counts = new HashMap<>();',
          'counts.merge(word, 1, Integer::sum);',
          'names.stream().filter(n -> n.length() > 3).sorted().toList();',
        ],
      },
      {
        heading: 'SQL',
        code: [
          'SELECT name, email FROM students WHERE city = ? ORDER BY name LIMIT 10;',
          'SELECT c.title, COUNT(*) FROM enrollments e',
          '  JOIN courses c ON c.id = e.course_id GROUP BY c.title HAVING COUNT(*) > 5;',
        ],
      },
      {
        heading: 'Spring Boot annotations',
        text: [
          '@SpringBootApplication starts the app. @RestController + @GetMapping/@PostMapping map HTTP requests. @Service holds business rules. @Repository (or a JpaRepository interface) talks to the database. @Entity and @Id map a class to a table. @Valid triggers Bean Validation on a request body.',
        ],
      },
      {
        heading: 'Maven commands',
        code: [
          './mvnw spring-boot:run        # run the app',
          './mvnw test                   # run the tests',
          './mvnw clean package          # build target/app.jar',
          'java -jar target/app.jar --spring.profiles.active=prod',
        ],
      },
    ],
  },

  'dsa-with-javascript': {
    lesson: 'Big-O Notation',
    materialTitle: 'DSA complexity cheat sheet (PDF)',
    filename: 'dsa-complexity-cheat-sheet.pdf',
    title: 'DSA Complexity Cheat Sheet',
    subtitle: 'DSA with JavaScript - costs to remember and patterns to recognise',
    sections: [
      {
        heading: 'Growth rates, fastest to slowest',
        text: [
          'O(1) constant, O(log n) logarithmic, O(n) linear, O(n log n) linearithmic, O(n^2) quadratic, O(2^n) exponential, O(n!) factorial.',
        ],
      },
      {
        heading: 'JavaScript operation costs',
        text: [
          'Array: index O(1), push/pop O(1) amortized, shift/unshift O(n), splice O(n), includes/indexOf O(n), sort O(n log n).',
          'Map and Set: get, set, has, delete O(1) on average. String concatenation in a loop: prefer collecting parts in an array and calling join.',
        ],
      },
      {
        heading: 'Data structures',
        text: [
          'Binary search on sorted data: O(log n). Balanced BST: O(log n) search, insert and delete. Binary heap: O(log n) push and pop, O(1) peek. Hash map: O(1) average lookup.',
          'Graphs: BFS and DFS run in O(V + E). Dijkstra with a binary heap runs in O((V + E) log V).',
        ],
      },
      {
        heading: 'Pattern recognition',
        text: [
          'Sorted array + pair or triple: two pointers. Contiguous range: sliding window. Fast membership or counting: hash map. All combinations: backtracking. Overlapping subproblems: dynamic programming. Top k or running extremes: heap. Dependencies: topological sort.',
        ],
      },
      {
        heading: 'Binary search template',
        code: [
          'let lo = 0, hi = arr.length - 1;',
          'while (lo <= hi) {',
          '  const mid = lo + Math.floor((hi - lo) / 2);',
          '  if (arr[mid] === target) return mid;',
          '  if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;',
          '}',
          'return -1;',
        ],
      },
    ],
  },
};
