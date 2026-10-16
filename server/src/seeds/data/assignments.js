/**
 * Starter assignments per course slug. `lesson` names a starter lesson; with
 * `attachTo: 'module'` the assignment belongs to that lesson's module instead.
 * Due dates are days after the seed runs, at 18:30 UTC (midnight in India).
 */
export const ASSIGNMENT_SEEDS = {
  'full-stack-mern-development': [
    {
      title: 'Personal Profile Page',
      lesson: 'Forms and Accessibility',
      attachTo: 'module',
      dueInDays: 14,
      maxMarks: 100,
      maxAttempts: 2,
      allowedSubmissionTypes: ['github_url', 'project_url'],
      latePolicy: { allowLate: true, lateDays: 7, penaltyPercent: 10 },
      objectives: [
        'Structure a page with semantic HTML',
        'Build an accessible contact form',
        'Publish a static site',
      ],
      instructions: `Build a one-page personal profile using only HTML (no CSS framework yet).

## Requirements

- A \`<header>\` with your name and a short tagline
- An **About** section and a **Skills** list
- A contact form with labelled \`name\`, \`email\` and \`message\` fields, and a submit button
- Correct heading order (\`h1\` → \`h2\`) and \`alt\` text on every image

## Submitting

1. Push the code to a public GitHub repository.
2. Deploy it with GitHub Pages, Netlify or Vercel.
3. Submit **both** links here.

Late work is accepted for 7 days with a 10% penalty.`,
    },
    {
      title: 'Responsive Landing Page',
      lesson: 'Responsive Design and Media Queries',
      attachTo: 'lesson',
      dueInDays: 28,
      maxMarks: 50,
      maxAttempts: 3,
      allowedSubmissionTypes: ['github_url', 'project_url', 'drive_url'],
      latePolicy: { allowLate: false },
      objectives: [
        'Lay out sections with Flexbox and Grid',
        'Adapt the layout with mobile-first media queries',
      ],
      instructions: `Turn a product landing page design into a responsive page.

- Mobile first: start at 360 px wide, then add breakpoints at 768 px and 1200 px
- Use **Grid** for the feature cards and **Flexbox** for the navigation
- No horizontal scrolling at any width

Submit the repository and the deployed page. If you made a design mock-up, you can add a Google Drive link to it as well.

Late work is **not** accepted for this assignment.`,
    },
  ],
  'java-full-stack-development': [
    {
      title: 'Console Grade Calculator',
      lesson: 'Control Flow and Methods',
      attachTo: 'lesson',
      dueInDays: 10,
      maxMarks: 20,
      maxAttempts: 2,
      allowedSubmissionTypes: ['code', 'github_url'],
      latePolicy: { allowLate: true, lateDays: 4, penaltyPercent: 20 },
      objectives: ['Read input with Scanner', 'Use if/else and loops', 'Split logic into methods'],
      instructions: `Write a Java console program that reads marks for any number of subjects and prints a report.

## Rules

- Keep asking for marks (0–100) until the user types \`done\`; reject anything else with a message
- Print the average, the highest and lowest mark, and a grade: A (90+), B (75+), C (60+), D (40+), F
- Put the grade logic in its own \`static char gradeFor(double average)\` method

Paste your \`Main.java\` as a code snippet, or link a GitHub repository. Late work loses 20% for up to 4 days.`,
    },
  ],
  'dsa-with-javascript': [
    {
      title: 'Big-O Analysis Worksheet',
      lesson: 'Analysing Loops and Recursion',
      attachTo: 'module',
      dueInDays: 7,
      maxMarks: 30,
      maxAttempts: null,
      allowedSubmissionTypes: ['pdf', 'code'],
      latePolicy: { allowLate: true, lateDays: 3, penaltyPercent: 25 },
      objectives: [
        'Derive the time complexity of loops and recursion',
        'Explain space complexity in your own words',
      ],
      instructions: `For each of the six functions below, give the time and space complexity and a one-paragraph justification.

1. A single loop over \`n\` items
2. Two nested loops where the inner loop starts at \`i + 1\`
3. A loop that halves \`n\` on every step
4. Recursive Fibonacci without memoisation
5. Recursive Fibonacci with a memo object
6. Merging two sorted arrays of lengths \`n\` and \`m\`

Hand in a PDF (typed or a clear scan), and optionally a code snippet with your own timing experiments. Late work loses 25% for up to 3 days.`,
    },
    {
      title: 'Two-Pointer Practice Set',
      lesson: 'Practice: Classic Array Problems',
      attachTo: 'lesson',
      dueInDays: 14,
      maxMarks: 40,
      maxAttempts: 3,
      allowedSubmissionTypes: ['code', 'github_url'],
      latePolicy: { allowLate: false },
      objectives: ['Apply the two-pointer technique', 'Analyse each solution with Big-O'],
      instructions: `Solve these with the two-pointer technique, in plain JavaScript:

- \`isPalindrome(text)\`, ignoring case and non-letters
- \`pairWithSum(sortedNumbers, target)\` returning the two indexes, or \`null\`
- \`removeDuplicates(sortedNumbers)\` in place, returning the new length

Add a comment with the time and space complexity above each function. Submit one code snippet or a repository link.`,
    },
  ],
};
