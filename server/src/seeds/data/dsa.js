import { lesson } from './helpers.js';

const js = ['Comfortable with JavaScript functions, arrays and objects'];

export default {
  title: 'DSA with JavaScript',
  slug: 'dsa-with-javascript',
  summary:
    'Build problem-solving skills with data structures and algorithms, all in JavaScript, and prepare for coding interviews.',
  description: `A focused path through the data structures and algorithms that show up in technical interviews and real systems.

Each module introduces a structure or technique, explains how it works and what it costs, and then applies it to classic problems. You will learn to analyse complexity, recognise patterns such as two pointers and sliding window, and explain your solutions clearly.

Who it's for: developers who know JavaScript basics and want to get better at problem solving and interviews.`,
  level: 'intermediate',
  estimatedHours: 160,
  tags: ['javascript', 'algorithms', 'data-structures', 'interviews'],
  modules: [
    {
      title: 'Time and Space Complexity',
      description: 'Measure how algorithms scale.',
      lessons: [
        lesson(
          'Big-O Notation',
          50,
          'Describe growth rates and compare algorithms.',
          [
            'Explain Big-O, Big-Omega and Big-Theta informally',
            'Identify O(1), O(log n), O(n), O(n log n) and O(n²) code',
            'Drop constants and lower-order terms',
          ],
          js,
        ),
        lesson('Analysing Loops and Recursion', 50, 'Work out the complexity of real code.', [
          'Analyse nested and sequential loops',
          'Estimate recursive complexity with recursion trees',
          'Analyse space usage including the call stack',
        ]),
      ],
    },
    {
      title: 'Arrays and Strings',
      description: 'Master the most common interview data types.',
      lessons: [
        lesson(
          'Array Operations and Their Costs',
          50,
          'Know what each operation costs in JavaScript.',
          [
            'Explain the cost of push, unshift, splice and slice',
            'Use prefix sums for range queries',
            'Rotate and reverse arrays in place',
          ],
        ),
        lesson('String Manipulation Patterns', 50, 'Solve problems on text efficiently.', [
          'Check palindromes and anagrams',
          'Build strings efficiently',
          'Count characters with frequency maps',
        ]),
        lesson(
          'Practice: Classic Array Problems',
          60,
          'Apply the patterns to well-known problems.',
          [
            'Solve maximum subarray with Kadane’s algorithm',
            'Merge sorted arrays',
            'Find duplicates and missing numbers',
          ],
        ),
      ],
    },
    {
      title: 'Searching and Sorting',
      description: 'Find and order data efficiently.',
      lessons: [
        lesson('Linear and Binary Search', 50, 'Search unsorted and sorted data.', [
          'Implement binary search iteratively and recursively',
          'Find first and last occurrences',
          'Binary search on the answer space',
        ]),
        lesson('Elementary Sorts', 50, 'Bubble, selection and insertion sort.', [
          'Implement the three elementary sorts',
          'Compare their complexity and stability',
          'Know when insertion sort is a good choice',
        ]),
        lesson('Merge Sort and Quick Sort', 60, 'Divide-and-conquer sorting.', [
          'Implement merge sort and quick sort',
          'Explain their best, average and worst cases',
          'Use a custom comparator with Array.prototype.sort',
        ]),
      ],
    },
    {
      title: 'Hash Maps and Sets',
      description: 'Trade memory for speed with hashing.',
      lessons: [
        lesson('Map and Set in JavaScript', 40, 'Use the built-in hash-based collections.', [
          'Choose between Map, Set and plain objects',
          'Explain average-case O(1) lookups',
          'Iterate maps and sets',
        ]),
        lesson('Hashing Problem Patterns', 60, 'Recognise when a hash map solves the problem.', [
          'Solve two-sum and group anagrams',
          'Count frequencies to find the top k elements',
          'Detect duplicates in a single pass',
        ]),
      ],
    },
    {
      title: 'Recursion and Backtracking',
      description: 'Solve problems by breaking them into smaller ones.',
      lessons: [
        lesson('Thinking Recursively', 50, 'Base cases, recursive cases and the call stack.', [
          'Write recursive functions with clear base cases',
          'Trace the call stack for a recursive call',
          'Convert simple recursion to iteration',
        ]),
        lesson('Backtracking', 70, 'Explore choices and undo them.', [
          'Generate subsets and permutations',
          'Solve combination sum',
          'Prune the search space early',
        ]),
      ],
    },
    {
      title: 'Two Pointers and Sliding Window',
      description: 'Turn quadratic solutions into linear ones.',
      lessons: [
        lesson('The Two Pointers Technique', 50, 'Walk an array from both ends or at two speeds.', [
          'Solve pair-sum problems on sorted arrays',
          'Remove duplicates in place',
          'Recognise when two pointers apply',
        ]),
        lesson('Fixed and Variable Sliding Windows', 60, 'Process contiguous ranges efficiently.', [
          'Find the maximum sum of a fixed-size window',
          'Find the longest substring without repeating characters',
          'Track window state with a hash map',
        ]),
      ],
    },
    {
      title: 'Linked Lists',
      description: 'Pointer-based sequences.',
      lessons: [
        lesson('Singly and Doubly Linked Lists', 60, 'Build linked lists from scratch.', [
          'Implement insert, delete and search',
          'Compare linked lists with arrays',
          'Implement a doubly linked list',
        ]),
        lesson('Linked List Problem Patterns', 60, 'Classic pointer manipulation problems.', [
          'Reverse a linked list',
          'Detect a cycle with fast and slow pointers',
          'Merge two sorted lists',
        ]),
      ],
    },
    {
      title: 'Stacks and Queues',
      description: 'LIFO and FIFO structures and where they shine.',
      lessons: [
        lesson(
          'Implementing Stacks and Queues',
          50,
          'Build both structures and know their costs.',
          [
            'Implement a stack with an array',
            'Implement a queue without O(n) shifts',
            'Explain deques',
          ],
        ),
        lesson('Stack and Queue Problems', 60, 'Apply them to parsing and scheduling problems.', [
          'Validate balanced parentheses',
          'Solve next greater element with a monotonic stack',
          'Simulate processes with a queue',
        ]),
      ],
    },
    {
      title: 'Binary Trees and BSTs',
      description: 'Hierarchical data and ordered search.',
      lessons: [
        lesson('Tree Terminology and Traversals', 60, 'Visit every node in the right order.', [
          'Implement pre-, in- and post-order traversal',
          'Implement level-order traversal with a queue',
          'Compute height and depth',
        ]),
        lesson('Binary Search Trees', 60, 'Keep data ordered for fast lookups.', [
          'Insert, search and delete in a BST',
          'Validate a BST',
          'Explain why balance matters',
        ]),
        lesson('Tree Problem Patterns', 60, 'Recursive thinking on trees.', [
          'Find the lowest common ancestor',
          'Compute the diameter of a tree',
          'Serialize and deserialize a tree',
        ]),
      ],
    },
    {
      title: 'Heaps and Priority Queues',
      description: 'Always get the smallest or largest item fast.',
      lessons: [
        lesson('Binary Heaps', 60, 'Implement a heap on top of an array.', [
          'Implement insert and extract with sift-up and sift-down',
          'Build a heap in O(n)',
          'Implement heap sort',
        ]),
        lesson('Priority Queue Problems', 50, 'Use heaps to solve top-k and merging problems.', [
          'Find the k largest elements',
          'Merge k sorted lists',
          'Find the running median',
        ]),
      ],
    },
    {
      title: 'Graphs',
      description: 'Model networks and relationships.',
      lessons: [
        lesson('Graph Representations', 50, 'Store graphs in code.', [
          'Build adjacency lists and matrices',
          'Model directed and weighted graphs',
          'Choose a representation for a problem',
        ]),
        lesson('Breadth-First and Depth-First Search', 60, 'Explore graphs systematically.', [
          'Implement BFS and DFS',
          'Count connected components',
          'Find shortest paths in unweighted graphs',
        ]),
        lesson(
          'Topological Sort and Shortest Paths',
          70,
          'Order dependencies and find cheapest routes.',
          [
            'Implement topological sort',
            'Detect cycles in directed graphs',
            'Explain and implement Dijkstra’s algorithm',
          ],
        ),
      ],
    },
    {
      title: 'Greedy Algorithms',
      description: 'Make the locally best choice, and know when it works.',
      lessons: [
        lesson('The Greedy Approach', 50, 'When local choices lead to a global optimum.', [
          'Explain the greedy-choice property',
          'Solve interval scheduling',
          'Recognise when greedy fails',
        ]),
        lesson('Greedy Problem Practice', 50, 'Apply greedy thinking to classic problems.', [
          'Solve jump game and gas station',
          'Solve minimum coins for canonical systems',
          'Prove correctness with exchange arguments',
        ]),
      ],
    },
    {
      title: 'Dynamic Programming',
      description: 'Solve overlapping subproblems once.',
      lessons: [
        lesson('Memoization and Tabulation', 60, 'Two ways to apply dynamic programming.', [
          'Identify overlapping subproblems',
          'Convert recursion to memoized recursion',
          'Build bottom-up tables',
        ]),
        lesson('One-Dimensional DP', 60, 'Problems with a single changing parameter.', [
          'Solve climbing stairs and house robber',
          'Solve coin change',
          'Optimize space usage',
        ]),
        lesson('Two-Dimensional DP', 70, 'Grids and string comparisons.', [
          'Solve unique paths in a grid',
          'Solve longest common subsequence',
          'Solve the 0/1 knapsack problem',
        ]),
      ],
    },
    {
      title: 'Interview Practice and Problem-Solving Projects',
      description: 'Bring it all together under interview conditions.',
      lessons: [
        lesson(
          'A Framework for Solving Problems',
          40,
          'A repeatable approach for any coding question.',
          [
            'Clarify requirements and edge cases',
            'Start brute force, then optimize',
            'Test your solution out loud',
          ],
        ),
        lesson('Mock Interview Sets', 120, 'Timed sets of mixed problems.', [
          'Solve mixed problems within a time limit',
          'Explain complexity for each solution',
          'Review and learn from mistakes',
        ]),
        lesson(
          'Project: Algorithm Visualizer',
          180,
          'Build a small app that visualizes sorting and graph algorithms.',
          [
            'Animate sorting algorithms step by step',
            'Visualize BFS and DFS on a grid',
            'Explain each algorithm in the UI',
          ],
        ),
      ],
    },
  ],
};
