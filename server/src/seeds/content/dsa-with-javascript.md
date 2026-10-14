# DSA with JavaScript: starter materials

Each lesson below becomes a set of study materials: the note, then each code example, then each link. See `server/src/seeds/materials.seed.js` for the format.

<!-- lesson: Big-O Notation -->

## Why measure growth?

Timing code on your laptop depends on the machine, the input and luck. **Asymptotic analysis** asks a better question: *how does the work grow as the input size `n` grows?* An algorithm that's fine for 100 items can be unusable for 1,000,000.

## The notations, informally

- **Big-O, O(f(n)):** an upper bound. The algorithm grows *no faster than* f(n). It's what people usually mean, typically for the worst case.
- **Big-Omega, Ω(f(n)):** a lower bound. It grows *at least* this fast.
- **Big-Theta, Θ(f(n)):** a tight bound. Both at once.

## Common classes, fastest first

| Big-O | Name | Example |
| --- | --- | --- |
| O(1) | constant | array index, Map lookup |
| O(log n) | logarithmic | binary search |
| O(n) | linear | one loop over the input |
| O(n log n) | linearithmic | merge sort |
| O(n²) | quadratic | comparing every pair |
| O(2ⁿ) | exponential | all subsets |

## Simplification rules

1. **Drop constants:** O(3n + 5) is O(n). Constants matter in practice, but not for growth.
2. **Keep the dominant term:** O(n² + n) is O(n²).
3. **Different inputs get different variables:** looping over arrays `a` and `b` is O(a + b), not O(n). Nested over both, it's O(a × b).

## Best, average and worst case

Linear search finds the target immediately in the best case (O(1)), but must check everything in the worst case (O(n)). Unless stated otherwise, interviewers want the **worst case**.

<!-- code: javascript | Four functions, four growth rates -->
```js
// O(1): the same work no matter how big the array is
const first = (arr) => arr[0];

// O(n): one pass
function sum(arr) {
  let total = 0;
  for (const x of arr) total += x;
  return total;
}

// O(n²): every pair
function hasDuplicatePairwise(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return true;
    }
  }
  return false;
}

// O(n) time, O(n) extra space: trading memory for speed
const hasDuplicate = (arr) => new Set(arr).size !== arr.length;

// O(log n): the problem halves each step
function countHalvings(n) {
  let steps = 0;
  while (n > 1) {
    n = Math.floor(n / 2);
    steps++;
  }
  return steps; // countHalvings(1_000_000) === 19
}
```

<!-- link: Big-O cheat sheet | https://www.bigocheatsheet.com/ -->

<!-- lesson: Analysing Loops and Recursion -->

## Loops

- **Sequential loops add:** a loop of n, then another loop of n, is O(n + n) = O(n).
- **Nested loops multiply:** an n-loop inside an n-loop is O(n²). If the inner loop runs `j` from `i` to `n`, the total is n + (n−1) + ... + 1 = n(n+1)/2, which is still O(n²).
- **A loop that halves or doubles** (`i *= 2`) runs O(log n) times.
- **Hidden loops count too:** `arr.includes`, `arr.indexOf`, `slice`, `splice` and `[...arr]` are all O(n). An `includes` inside a loop makes the loop O(n²).

## Recursion: draw the tree

For recursive functions, draw a **recursion tree**: each call is a node, and its children are the calls it makes. Total work = (number of calls) × (work per call), or the sum of the work on each level.

- `factorial(n)` makes one call per level, n levels deep: O(n).
- Naive `fib(n)` makes **two** calls per level, so the tree has about 2ⁿ nodes: O(2ⁿ). That's why it's unusably slow at n = 50.
- Merge sort makes two calls on halves (log n levels) and does O(n) work per level: O(n log n).

## Space complexity

Count the **extra** memory an algorithm uses:

- new arrays, maps and sets
- the **call stack**: each pending recursive call holds a frame, so recursion depth d costs O(d) space. `factorial(n)` uses O(n) stack space, and binary search written recursively uses O(log n).

JavaScript engines don't reliably optimise tail calls, so deep recursion (around 10,000 frames or more) can throw "Maximum call stack size exceeded". Convert it to a loop when the depth can be large.

<!-- code: javascript | Analysing real functions -->
```js
// O(n²) time: includes() is a hidden loop inside the outer loop
function commonSlow(a, b) {
  return a.filter((x) => b.includes(x));
}

// O(a + b) time, O(b) space: build a Set once, then O(1) lookups
function commonFast(a, b) {
  const seen = new Set(b);
  return a.filter((x) => seen.has(x));
}

// O(2^n) time, O(n) stack space: the recursion tree doubles at every level
function fibSlow(n) {
  return n < 2 ? n : fibSlow(n - 1) + fibSlow(n - 2);
}

// O(n) time, O(1) space
function fib(n) {
  let [prev, curr] = [0, 1];
  for (let i = 0; i < n; i++) [prev, curr] = [curr, prev + curr];
  return prev;
}

// O(n log n): the outer loop runs n times, the inner loop doubles (log n steps)
function pairsWithPowersOfTwo(n) {
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let step = 1; step < n; step *= 2) count++;
  }
  return count;
}
```

<!-- lesson: Array Operations and Their Costs -->

## How JavaScript arrays behave

JavaScript arrays are dynamic: they grow as needed, and engines store dense arrays in contiguous memory. What you need to know is the **cost** of each operation:

| Operation | Cost | Why |
| --- | --- | --- |
| `arr[i]`, `arr.length` | O(1) | direct access |
| `push`, `pop` | O(1) amortised | works at the end |
| `shift`, `unshift` | O(n) | every element moves one place |
| `splice(i, k)` | O(n) | elements after `i` move |
| `slice`, spread, `concat` | O(n) | copies |
| `includes`, `indexOf`, `find` | O(n) | linear scan |
| `sort` | O(n log n) | comparison sort |

"Amortised" means an occasional push is expensive (when the engine reallocates and copies), but averaged over many pushes each costs O(1).

## Prefix sums

To answer many "sum of `arr[l..r]`" queries, precompute `prefix[i]` = the sum of the first `i` elements. Then any range sum is `prefix[r + 1] - prefix[l]`: O(n) setup, then **O(1) per query** instead of O(n).

## In-place techniques

- **Reverse** with two indexes moving towards each other, swapping as they go: O(n) time, O(1) space.
- **Rotate right by k:** reverse the whole array, then reverse the first `k` elements, then reverse the rest. Use `k % n` first!

Modifying the input saves memory but surprises callers, so mention it in an interview. JavaScript also has non-mutating versions: `toReversed()`, `toSorted()` and `toSpliced()`.

<!-- code: javascript | Prefix sums and in-place rotation -->
```js
function buildPrefix(arr) {
  const prefix = [0];
  for (const x of arr) prefix.push(prefix.at(-1) + x);
  return prefix;
}

const rangeSum = (prefix, l, r) => prefix[r + 1] - prefix[l]; // inclusive l..r, O(1)

function reverse(arr, lo = 0, hi = arr.length - 1) {
  while (lo < hi) {
    [arr[lo], arr[hi]] = [arr[hi], arr[lo]];
    lo++;
    hi--;
  }
}

function rotateRight(arr, k) {
  const n = arr.length;
  if (n === 0) return arr;
  k %= n;
  reverse(arr);            // [7,6,5,4,3,2,1]
  reverse(arr, 0, k - 1);  // [5,6,7,4,3,2,1]
  reverse(arr, k);         // [5,6,7,1,2,3,4]
  return arr;
}

const prefix = buildPrefix([3, 1, 4, 1, 5, 9]);
console.log(rangeSum(prefix, 2, 4)); // 4 + 1 + 5 = 10
console.log(rotateRight([1, 2, 3, 4, 5, 6, 7], 3)); // [5, 6, 7, 1, 2, 3, 4]
```

<!-- link: MDN: Array | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array -->

<!-- lesson: String Manipulation Patterns -->

## Strings are immutable

In JavaScript you can't change a character in place: `s[0] = 'x'` silently does nothing. Every "modification" creates a new string. Building a result with `+=` in a loop is usually fine in modern engines, but collecting parts in an array and calling `join('')` makes your intent and the O(n) cost clear.

Convert to an array when you need to mutate: `const chars = [...s]`. The spread splits by code points, so emoji survive, whereas `split('')` breaks them apart.

## Frequency maps

Many string problems reduce to **counting characters**:

- **Anagrams:** two strings are anagrams if their character counts match. That's O(n), compared with O(n log n) for sorting both strings.
- **First unique character:** count everything, then scan again for the first count of 1.
- **Can you build a ransom note from a magazine?** Count the magazine's letters, then consume them.

Use a `Map`, or a fixed array of 26 counters for lowercase letters (`code - 97`).

## Palindromes

Compare characters from both ends moving inwards: O(n) time and O(1) space, with no reversed copy needed. Normalise first if the problem says to ignore case and punctuation.

## Useful built-ins

`toLowerCase`, `trim`, `split`, `join`, `slice`, `startsWith`, `includes`, `replaceAll`, `charCodeAt` and `String.fromCharCode`. Remember that `slice` is O(k), not O(1).

<!-- code: javascript | Anagrams, palindromes and first unique character -->
```js
function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const ch of a) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const ch of b) {
    const left = (counts.get(ch) ?? 0) - 1;
    if (left < 0) return false;
    counts.set(ch, left);
  }
  return true;
}

function isPalindrome(text) {
  const s = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0, j = s.length - 1; i < j; i++, j--) {
    if (s[i] !== s[j]) return false;
  }
  return true;
}

function firstUniqueChar(s) {
  const counts = new Array(26).fill(0);
  for (const ch of s) counts[ch.charCodeAt(0) - 97]++;
  for (let i = 0; i < s.length; i++) {
    if (counts[s.charCodeAt(i) - 97] === 1) return i;
  }
  return -1;
}

console.log(isAnagram('listen', 'silent')); // true
console.log(isPalindrome('Never odd or even')); // true
console.log(firstUniqueChar('leetcode')); // 0
```

<!-- lesson: Practice: Classic Array Problems -->

## Maximum subarray (Kadane's algorithm)

Find the contiguous subarray with the largest sum. The brute force tries every pair of endpoints: O(n²). Kadane's insight: at each position, the best subarray *ending here* either extends the previous best, or starts fresh at this element:

`bestEndingHere = max(x, bestEndingHere + x)`

Track the overall maximum as you go: **O(n) time, O(1) space**. Start from `arr[0]`, not 0, so arrays of all negative numbers work.

## Merge two sorted arrays

Walk both arrays with one pointer each, and always take the smaller current element. When one array runs out, append the rest of the other. O(n + m). This is the heart of merge sort.

## Find the missing number

Given `0..n` with one number missing, the expected sum is `n(n+1)/2`; subtract the actual sum. O(n) time and O(1) space. (XOR of all indexes and values also works, and avoids overflow in languages with fixed-size integers.)

## Find duplicates

- With a `Set`: O(n) time, O(n) space. The general answer.
- If the values are in the range `1..n`, you can mark visited values by negating `arr[value - 1]`: O(1) extra space, but it mutates the input.
- Sorting first: O(n log n), then compare neighbours.

## How to practise

For each problem: write the brute force, state its complexity, find the repeated work, and remove it. Then test the edge cases: empty array, one element, all negative, duplicates.

<!-- code: javascript | Kadane, merge and missing number -->
```js
function maxSubarray(nums) {
  let best = nums[0];
  let endingHere = nums[0];
  for (let i = 1; i < nums.length; i++) {
    endingHere = Math.max(nums[i], endingHere + nums[i]); // extend or restart
    best = Math.max(best, endingHere);
  }
  return best;
}

function mergeSorted(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

function missingNumber(nums) {
  const n = nums.length;
  const expected = (n * (n + 1)) / 2;
  return expected - nums.reduce((sum, x) => sum + x, 0);
}

console.log(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6  ([4, -1, 2, 1])
console.log(maxSubarray([-3, -1, -2])); // -1
console.log(mergeSorted([1, 4, 9], [2, 3, 10])); // [1, 2, 3, 4, 9, 10]
console.log(missingNumber([3, 0, 1])); // 2
```

<!-- lesson: Linear and Binary Search -->

## Linear search

Check each element in turn: O(n). It's the only option for unsorted data, and perfectly fine for small arrays.

## Binary search

On **sorted** data, compare the target with the middle element and discard the half that can't contain it. Each step halves the range: **O(log n)**. Searching a million items takes about 20 comparisons.

Getting the details right is what interviews test:

- Keep a clear invariant. With `lo <= hi`, the target, if present, is always inside `[lo, hi]`.
- Compute the middle as `lo + Math.floor((hi - lo) / 2)`.
- Always move past `mid` (`lo = mid + 1` or `hi = mid - 1`), or the loop may never end.

## First and last occurrence

With duplicates, a plain binary search returns *some* match. To find the **first**, record the match and keep searching left (`hi = mid - 1`). For the last, keep searching right. The count of a value is `last - first + 1`, still O(log n).

## Binary search on the answer

Binary search works on any **monotonic yes/no question**, not just arrays. "What's the smallest capacity that ships all packages in D days?" If capacity C works, every bigger capacity works too. So search the range of possible answers, with a helper that checks whether a candidate works. This pattern solves many "minimise the maximum" problems.

<!-- code: javascript | Binary search, first occurrence and search on the answer -->
```js
function binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

function firstOccurrence(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] >= target) {
      if (arr[mid] === target) found = mid;
      hi = mid - 1; // keep looking left
    } else {
      lo = mid + 1;
    }
  }
  return found;
}

// Smallest ship capacity that delivers all weights (in order) within `days`
function shipWithinDays(weights, days) {
  const canShip = (capacity) => {
    let needed = 1;
    let load = 0;
    for (const w of weights) {
      if (load + w > capacity) {
        needed++;
        load = 0;
      }
      load += w;
    }
    return needed <= days;
  };
  let lo = Math.max(...weights);
  let hi = weights.reduce((a, b) => a + b, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (canShip(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

console.log(firstOccurrence([1, 2, 2, 2, 3], 2)); // 1
console.log(shipWithinDays([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)); // 15
```

<!-- lesson: Elementary Sorts -->

## Three simple sorts

All three run in **O(n²)** time in the worst case and use O(1) extra space. You won't use them on big data, but they teach the ideas behind every other sort.

**Bubble sort:** repeatedly swap adjacent elements that are out of order. After each pass, the largest remaining element has "bubbled" to the end. Stop early if a pass makes no swaps; that makes it O(n) on sorted input.

**Selection sort:** find the minimum of the unsorted part and swap it into place. It always does O(n²) comparisons, but only O(n) swaps.

**Insertion sort:** take the next element and slide it left into its place within the already-sorted prefix, the way you sort playing cards.

## Stability

A sort is **stable** if equal elements keep their original relative order. That matters when sorting by one key after another, such as by name and then by grade.

| Sort | Best | Worst | Stable? |
| --- | --- | --- | --- |
| Bubble (early exit) | O(n) | O(n²) | yes |
| Selection | O(n²) | O(n²) | no |
| Insertion | O(n) | O(n²) | yes |

## When insertion sort wins

Insertion sort is **fast on small or nearly sorted arrays**: it does O(n + inversions) work. That's why real-world sorts, including the TimSort variants used by JavaScript engines, switch to insertion sort for small runs.

<!-- code: javascript | Bubble, selection and insertion sort -->
```js
function bubbleSort(arr) {
  const a = [...arr];
  for (let end = a.length - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        swapped = true;
      }
    }
    if (!swapped) break; // already sorted
  }
  return a;
}

function selectionSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) if (a[j] < a[min]) min = j;
    if (min !== i) [a[i], a[min]] = [a[min], a[i]];
  }
  return a;
}

function insertionSort(arr) {
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const current = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > current) {
      a[j + 1] = a[j]; // shift right
      j--;
    }
    a[j + 1] = current;
  }
  return a;
}

const data = [5, 2, 9, 1, 5, 6];
console.log(bubbleSort(data), selectionSort(data), insertionSort(data));
```

<!-- link: VisuAlgo: Sorting visualised | https://visualgo.net/en/sorting -->

<!-- lesson: Merge Sort and Quick Sort -->

## Divide and conquer

Split the problem into smaller pieces, solve them recursively, then combine the results.

## Merge sort

1. Split the array in half.
2. Sort each half recursively.
3. **Merge** the two sorted halves.

There are log n levels of splitting, and merging costs O(n) per level, so it's **O(n log n) in every case**. It's stable, and needs O(n) extra space. Merge sort is the safe choice when worst-case guarantees matter.

## Quick sort

1. Choose a **pivot**.
2. **Partition:** move smaller elements before the pivot and larger ones after it.
3. Recursively sort both sides.

On average it's O(n log n), and it's very fast in practice because it works in place with good cache behaviour. With bad pivots (always the first element of an already sorted array), every partition is lopsided and it degrades to **O(n²)**. Choosing a random pivot makes that vanishingly unlikely. It isn't stable.

## Array.prototype.sort

- Without a comparator, it sorts by **string value**: `[10, 9, 1].sort()` gives `[1, 10, 9]`. Always pass a comparator for numbers: `(a, b) => a - b`.
- The comparator returns a negative number, zero or a positive number. Sort objects by several keys with `||`: `(a, b) => a.grade - b.grade || a.name.localeCompare(b.name)`.
- `sort` mutates the array, while `toSorted()` returns a copy. Since ES2019, `sort` is guaranteed to be stable.

<!-- code: javascript | Merge sort and quick sort -->
```js
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const merged = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    merged.push(left[i] <= right[j] ? left[i++] : right[j++]); // <= keeps it stable
  }
  return merged.concat(left.slice(i), right.slice(j));
}

function quickSort(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return a;
  const pivotIndex = lo + Math.floor(Math.random() * (hi - lo + 1)); // random pivot
  [a[pivotIndex], a[hi]] = [a[hi], a[pivotIndex]];
  const pivot = a[hi];
  let store = lo;
  for (let i = lo; i < hi; i++) {
    if (a[i] < pivot) {
      [a[i], a[store]] = [a[store], a[i]];
      store++;
    }
  }
  [a[store], a[hi]] = [a[hi], a[store]]; // pivot into its final place
  quickSort(a, lo, store - 1);
  quickSort(a, store + 1, hi);
  return a;
}

console.log(mergeSort([38, 27, 43, 3, 9, 82, 10]));
console.log(quickSort([38, 27, 43, 3, 9, 82, 10]));

const students = [{ name: 'Ravi', grade: 2 }, { name: 'Asha', grade: 1 }, { name: 'Meera', grade: 1 }];
console.log(students.toSorted((a, b) => a.grade - b.grade || a.name.localeCompare(b.name)));
```

<!-- lesson: Map and Set in JavaScript -->

## Hash tables in one paragraph

A hash table stores values in an array of "buckets". A **hash function** turns a key into a bucket index, so a lookup jumps straight to the right bucket instead of scanning everything. Two keys can collide in one bucket, but with a good hash function and resizing, `get`, `set`, `has` and `delete` take **O(1) on average**. The worst case is O(n), but you'll rarely see it in practice.

## Map vs plain object

| | `Map` | `{}` object |
| --- | --- | --- |
| Key types | any value, including objects | strings and symbols |
| Size | `map.size` | `Object.keys(obj).length` (O(n)) |
| Iteration order | insertion order | mostly insertion order (integer-like keys first) |
| Inherited keys | none | prototype keys like `toString` can surprise you |

Use **Map** for dynamic collections of key-value data, and plain objects for fixed-shape records such as `{ name, age }`.

## Set

A `Set` stores unique values, with O(1) average `add`, `has` and `delete`. `[...new Set(arr)]` deduplicates an array. Newer engines also provide `union`, `intersection` and `difference` methods.

## Keys are compared by identity

`map.set([1, 2], 'x')` followed by `map.get([1, 2])` returns `undefined`, because those are two different arrays. For composite keys, build a string such as `` `${row},${col}` ``.

## Iterating

`for (const [key, value] of map)`, `map.keys()`, `map.values()`, `map.entries()` and `forEach` all visit entries in insertion order.

<!-- code: javascript | Map and Set essentials -->
```js
// Counting with a Map
const visits = new Map();
for (const page of ['/home', '/about', '/home', '/pricing', '/home']) {
  visits.set(page, (visits.get(page) ?? 0) + 1);
}
console.log(visits.get('/home'), visits.size); // 3 3

for (const [page, count] of visits) console.log(`${page}: ${count}`);

// Objects as keys: impossible with a plain object
const lastSeen = new Map();
const user = { id: 7, name: 'Asha' };
lastSeen.set(user, new Date());
console.log(lastSeen.has(user)); // true

// Sets: uniqueness and fast membership
const tags = new Set(['js', 'dsa', 'js']);
tags.add('react');
console.log(tags.size, tags.has('dsa')); // 3 true
console.log([...new Set([3, 1, 3, 2, 1])]); // [3, 1, 2]

// Composite keys for grids
const visited = new Set();
const key = (row, col) => `${row},${col}`;
visited.add(key(2, 3));
console.log(visited.has(key(2, 3))); // true
```

<!-- link: MDN: Map | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map -->

<!-- lesson: Hashing Problem Patterns -->

## Spot the pattern

Reach for a hash map or set when the brute force asks *"have I seen something like this before?"* inside a loop. A map turns that inner O(n) scan into an O(1) lookup, usually taking the solution from O(n²) to **O(n)**, at the cost of O(n) memory.

## Two Sum

Find two indexes whose values add up to `target`. For each number, the partner you need is `target - x`. Keep a map of *value to index* for everything you've seen so far, and check it before inserting the current number, so an element never pairs with itself.

## Group anagrams

Anagrams share a **canonical key**: their sorted letters (`'eat'` becomes `'aet'`), or a 26-letter count signature. Group the words in a `Map` from key to list of words.

## Top k frequent elements

1. Count the frequencies with a map: O(n).
2. Then either sort the entries by count, O(n log n), or use **bucket sort**: an array where index = frequency, holding the values with that frequency. Read it from the end to get O(n) overall.

## Single-pass duplicate detection

Add each element to a set, and you've found a duplicate as soon as `has` returns true. Variations: "duplicates within k indexes" (store the last index in a map) and "first repeating character".

## Prefix sums + hash map

"Count the subarrays that sum to k" combines both ideas: store how many times each prefix sum has occurred. At each position, add the count of `prefix - k`. That's O(n) instead of O(n²).

<!-- code: javascript | Two Sum, group anagrams and top k -->
```js
function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return null;
}

function groupAnagrams(words) {
  const groups = new Map();
  for (const word of words) {
    const key = [...word].sort().join('');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  return [...groups.values()];
}

function topKFrequent(nums, k) {
  const counts = new Map();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [value, count] of counts) buckets[count].push(value);
  const result = [];
  for (let f = buckets.length - 1; f > 0 && result.length < k; f--) result.push(...buckets[f]);
  return result.slice(0, k);
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]
console.log(groupAnagrams(['eat', 'tea', 'tan', 'ate', 'nat', 'bat']));
console.log(topKFrequent([1, 1, 1, 2, 2, 3], 2)); // [1, 2]
```

<!-- lesson: Thinking Recursively -->

## The two parts of every recursive function

1. **Base case:** the smallest input, answered directly, with no recursive call. Without it, the recursion never stops.
2. **Recursive case:** solve the problem using the answer to a **smaller** version of the same problem, and make sure each call moves towards the base case.

The leap of faith: assume the recursive call already works for the smaller input, and only ask "how do I use it?" Don't try to trace every level in your head.

## The call stack

Each call gets a **stack frame** holding its parameters and local variables. Calls pile up until a base case returns, then the frames unwind in reverse order, each finishing its work with the returned value. Drawing the stack for a small input like `sum([1, 2, 3])` makes this concrete.

Deep recursion uses O(depth) memory, and JavaScript throws `RangeError: Maximum call stack size exceeded` after roughly 10,000 frames, depending on the engine.

## Recursion vs iteration

Anything recursive can be written iteratively:

- **Simple (linear) recursion** becomes a loop with an accumulator.
- **Tree-like recursion** becomes a loop with an **explicit stack** (an array you `push` to and `pop` from).

Recursion is the natural fit for trees, nested structures and divide-and-conquer. Loops are safer for long linear processes.

## Practice problems

Factorial, power, sum of digits, reversing a string, flattening a nested array, and counting the files in a nested folder object.

<!-- code: javascript | Recursive functions and an iterative rewrite -->
```js
function power(base, exp) {
  if (exp === 0) return 1;                     // base case
  const half = power(base, Math.floor(exp / 2)); // smaller problem: O(log exp) calls
  return exp % 2 === 0 ? half * half : half * half * base;
}

function flatten(value) {
  if (!Array.isArray(value)) return [value];   // base case: not a list
  return value.flatMap(flatten);               // recursive case
}

// Count files in a nested folder structure
const tree = { name: 'src', children: [{ name: 'app.js' }, { name: 'lib', children: [{ name: 'a.js' }, { name: 'b.js' }] }] };
const countFiles = (node) =>
  node.children ? node.children.reduce((sum, child) => sum + countFiles(child), 0) : 1;

// The same count with an explicit stack: no recursion depth limit
function countFilesIterative(root) {
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node.children) stack.push(...node.children);
    else count++;
  }
  return count;
}

console.log(power(2, 10)); // 1024
console.log(flatten([1, [2, [3, [4]], 5]])); // [1, 2, 3, 4, 5]
console.log(countFiles(tree), countFilesIterative(tree)); // 3 3
```

<!-- lesson: Backtracking -->

## Explore, then undo

Backtracking builds a solution **one choice at a time**. After each choice it recurses to make the next one, and when it returns, it **undoes** the choice and tries the next option. It systematically explores a tree of decisions.

Every backtracking solution has the same skeleton:

```js
function backtrack(state) {
  if (isComplete(state)) { record(state); return; }
  for (const choice of choices(state)) {
    if (!isValid(choice)) continue;   // prune
    make(choice);
    backtrack(state);
    undo(choice);                     // the "back" in backtracking
  }
}
```

## Classic problems

- **Subsets:** for each element, include it or don't. That's 2ⁿ subsets.
- **Permutations:** pick an unused element for each position: n! orderings.
- **Combination sum:** choose numbers (reusable) that add up to a target.
- **N-Queens, Sudoku and word search:** place a piece, check the constraints, recurse.

## Pruning

Without pruning, backtracking explores everything, which takes exponential time. **Prune** branches that can't lead to a solution: in combination sum, sort the candidates and stop as soon as one exceeds the remaining target. Good pruning can make an exponential search practical.

## Common mistakes

- Pushing the *same array reference* into the results, then mutating it. Copy it: `results.push([...path])`.
- Forgetting to undo a choice, so state leaks between branches.
- Generating duplicates. Sort first, and skip equal neighbours at the same depth.

<!-- code: javascript | Subsets, permutations and combination sum -->
```js
function subsets(nums) {
  const results = [];
  const path = [];
  (function backtrack(start) {
    results.push([...path]); // copy!
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      backtrack(i + 1);
      path.pop();
    }
  })(0);
  return results;
}

function permutations(nums) {
  const results = [];
  const used = new Array(nums.length).fill(false);
  const path = [];
  (function backtrack() {
    if (path.length === nums.length) return results.push([...path]);
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      path.push(nums[i]);
      backtrack();
      path.pop();
      used[i] = false;
    }
  })();
  return results;
}

function combinationSum(candidates, target) {
  const sorted = [...candidates].sort((a, b) => a - b);
  const results = [];
  const path = [];
  (function backtrack(start, remaining) {
    if (remaining === 0) return results.push([...path]);
    for (let i = start; i < sorted.length; i++) {
      if (sorted[i] > remaining) break; // prune: everything after is bigger
      path.push(sorted[i]);
      backtrack(i, remaining - sorted[i]); // i, not i + 1: numbers can repeat
      path.pop();
    }
  })(0, target);
  return results;
}

console.log(subsets([1, 2, 3]).length); // 8
console.log(permutations([1, 2, 3]).length); // 6
console.log(combinationSum([2, 3, 6, 7], 7)); // [[2, 2, 3], [7]]
```

<!-- lesson: The Two Pointers Technique -->

## The idea

Use two indexes that move through the data according to a rule, replacing a nested loop over pairs, O(n²), with a single coordinated pass, **O(n)**.

## Opposite ends

Start one pointer at each end and move them towards each other. On a **sorted** array, to find a pair summing to a target:

- If the sum is too small, move `left` right to get a bigger value.
- If it's too large, move `right` left to get a smaller value.
- If it's equal, you've found the pair.

This also solves *3Sum* (fix one element, then two-pointer the rest, for O(n²) instead of O(n³)), *container with most water*, and palindrome checks.

## Same direction (read and write)

A **slow** pointer marks where the next kept element goes, and a **fast** pointer scans ahead. This removes duplicates or unwanted values **in place** with O(1) extra space, as in "remove duplicates from sorted array" and "move zeroes to the end".

## Fast and slow

One pointer moves twice as fast as the other. You'll use this on linked lists to find the middle element or detect cycles.

## When does it apply?

Look for these clues:

- the input is **sorted**, or sorting it first is acceptable
- you're looking for **pairs** or triples that satisfy a condition
- you must modify an array **in place**
- you're comparing from both ends (palindromes)

<!-- code: javascript | Pair sum, in-place deduplication and move zeroes -->
```js
// Sorted input: indexes of two numbers that add up to target
function pairSum(sorted, target) {
  let left = 0;
  let right = sorted.length - 1;
  while (left < right) {
    const sum = sorted[left] + sorted[right];
    if (sum === target) return [left, right];
    if (sum < target) left++;
    else right--;
  }
  return null;
}

// Returns the new length; the first k elements are the unique values
function removeDuplicates(sorted) {
  if (sorted.length === 0) return 0;
  let write = 1;
  for (let read = 1; read < sorted.length; read++) {
    if (sorted[read] !== sorted[write - 1]) sorted[write++] = sorted[read];
  }
  return write;
}

function moveZeroes(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) {
      [nums[write], nums[read]] = [nums[read], nums[write]];
      write++;
    }
  }
  return nums;
}

console.log(pairSum([1, 3, 4, 6, 8, 11], 10)); // [2, 3]  (4 + 6)
const arr = [1, 1, 2, 3, 3, 3, 4];
console.log(arr.slice(0, removeDuplicates(arr))); // [1, 2, 3, 4]
console.log(moveZeroes([0, 1, 0, 3, 12])); // [1, 3, 12, 0, 0]
```

<!-- lesson: Fixed and Variable Sliding Windows -->

## Contiguous ranges

When a problem asks about **contiguous** subarrays or substrings ("the longest", "the shortest", "the maximum sum of length k"), recomputing every range from scratch is O(n²) or worse. A **sliding window** keeps the current range's state and updates it incrementally as the window moves: **O(n)**.

## Fixed-size window

For a window of exactly `k` elements:

1. Compute the state of the first `k` elements.
2. Slide one step at a time: **add** the element entering on the right and **remove** the element leaving on the left.
3. Update the answer after each step.

Example: the maximum sum of any `k` consecutive elements.

## Variable-size window

The window grows and shrinks to satisfy a condition:

1. Expand `right` one step at a time, adding the element to the window state.
2. While the window is **invalid**, shrink it from the `left`, removing elements.
3. The window is now valid, so update the answer (for "longest" problems).

Each element enters once and leaves at most once, so the total work is O(n), even with the inner `while` loop.

## Window state

Track what the condition needs:

- a running **sum**
- a **Map** of character counts ("at most k distinct characters")
- a **Map** from character to last index ("no repeating characters")

## Fits and limits

Sliding windows need the window's validity to change predictably as it grows and shrinks. For sums with negative numbers, use prefix sums with a hash map instead.

<!-- code: javascript | Fixed window and longest substring without repeats -->
```js
function maxSumOfK(nums, k) {
  if (nums.length < k) return null;
  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += nums[i];
  let best = windowSum;
  for (let right = k; right < nums.length; right++) {
    windowSum += nums[right] - nums[right - k]; // add the new, drop the old
    best = Math.max(best, windowSum);
  }
  return best;
}

function longestUniqueSubstring(s) {
  const lastIndex = new Map(); // char -> last position seen
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastIndex.has(ch) && lastIndex.get(ch) >= left) {
      left = lastIndex.get(ch) + 1; // jump past the repeat
    }
    lastIndex.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}

function longestWithKDistinct(s, k) {
  const counts = new Map();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    counts.set(s[right], (counts.get(s[right]) ?? 0) + 1);
    while (counts.size > k) {
      const out = s[left++];
      counts.set(out, counts.get(out) - 1);
      if (counts.get(out) === 0) counts.delete(out);
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}

console.log(maxSumOfK([2, 1, 5, 1, 3, 2], 3)); // 9
console.log(longestUniqueSubstring('abcabcbb')); // 3 ("abc")
console.log(longestWithKDistinct('eceba', 2)); // 3 ("ece")
```

<!-- lesson: Singly and Doubly Linked Lists -->

## Nodes and pointers

A linked list is a chain of **nodes**. Each node holds a value and a reference to the `next` node, and the list keeps a reference to the `head`. In a **doubly** linked list, each node also points to its `prev` node, and the list usually tracks the `tail` too.

## Linked lists vs arrays

| Operation | Array | Linked list |
| --- | --- | --- |
| Access by index | O(1) | O(n): follow the pointers |
| Insert or delete at the front | O(n) | O(1) |
| Insert or delete at the end | O(1) amortised | O(1) with a tail pointer (delete needs `prev`, so a doubly linked list) |
| Insert or delete in the middle, given the node | O(n) | O(1) |
| Memory | compact | an extra pointer (or two) per node |

In JavaScript you'll rarely need a linked list for performance, because arrays are highly optimised. But linked lists teach pointer manipulation, appear constantly in interviews, and underpin LRU caches, deques and adjacency lists.

## Implementation tips

- Keep a `size` counter, so `length` is O(1).
- **Draw the pointers before writing code.** Most bugs come from updating pointers in the wrong order and losing part of the list.
- Handle the edge cases: an empty list, a single node, and operations at the head or tail.
- A **dummy (sentinel) head node** removes most head special cases.

<!-- code: javascript | A singly linked list -->
```js
class ListNode {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}

class LinkedList {
  head = null;
  size = 0;

  prepend(value) {
    this.head = new ListNode(value, this.head); // O(1)
    this.size++;
  }

  append(value) {
    const node = new ListNode(value);
    if (!this.head) this.head = node;
    else {
      let current = this.head;
      while (current.next) current = current.next; // O(n) without a tail pointer
      current.next = node;
    }
    this.size++;
  }

  remove(value) {
    const dummy = new ListNode(null, this.head); // sentinel: no special case for the head
    let prev = dummy;
    while (prev.next && prev.next.value !== value) prev = prev.next;
    if (!prev.next) return false;
    prev.next = prev.next.next; // unlink
    this.head = dummy.next;
    this.size--;
    return true;
  }

  *[Symbol.iterator]() {
    for (let node = this.head; node; node = node.next) yield node.value;
  }
}

const list = new LinkedList();
list.append(2);
list.append(3);
list.prepend(1);
list.remove(2);
console.log([...list], list.size); // [1, 3] 2
```

<!-- link: VisuAlgo: Linked lists | https://visualgo.net/en/list -->

<!-- lesson: Linked List Problem Patterns -->

## Reverse a linked list

The classic pointer exercise. Walk the list with three pointers, `prev`, `current` and `next`. At each node: save `next`, point `current.next` back to `prev`, then step forward. When you're done, `prev` is the new head. O(n) time, O(1) space. Practise it until you can write it without thinking.

## Detect a cycle (Floyd's algorithm)

Move a **slow** pointer one step and a **fast** pointer two steps at a time. If there's a cycle, fast eventually laps slow and they meet. If fast reaches `null`, there's no cycle. O(n) time, O(1) space, with no set of visited nodes needed. Bonus: to find where the cycle *starts*, reset one pointer to the head and move both one step at a time; they meet at the cycle's entrance.

## Find the middle

The same slow and fast pointers: when fast reaches the end, slow is in the middle. This is useful for splitting a list in merge sort, or checking whether a list is a palindrome.

## Merge two sorted lists

Use a **dummy head** and a `tail` pointer. Repeatedly attach the smaller of the two current nodes, then attach whatever remains of the other list. O(n + m), and it reuses the existing nodes.

## The n-th node from the end

Move one pointer n steps ahead, then move both together. When the leader reaches the end, the follower is at the target.

**Always test with:** an empty list, one node, two nodes, and a cycle back to the head.

<!-- code: javascript | Reverse, cycle detection and merge -->
```js
class ListNode {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}

function reverse(head) {
  let prev = null;
  let current = head;
  while (current) {
    const next = current.next; // save before overwriting
    current.next = prev;
    prev = current;
    current = next;
  }
  return prev;
}

function hasCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

function mergeSorted(a, b) {
  const dummy = new ListNode(null);
  let tail = dummy;
  while (a && b) {
    if (a.value <= b.value) [tail.next, a] = [a, a.next];
    else [tail.next, b] = [b, b.next];
    tail = tail.next;
  }
  tail.next = a ?? b;
  return dummy.next;
}

const fromArray = (values) => values.reduceRight((next, v) => new ListNode(v, next), null);
const toArray = (head) => { const out = []; for (let n = head; n; n = n.next) out.push(n.value); return out; };

console.log(toArray(reverse(fromArray([1, 2, 3])))); // [3, 2, 1]
console.log(toArray(mergeSorted(fromArray([1, 4, 6]), fromArray([2, 3, 7])))); // [1, 2, 3, 4, 6, 7]
const loop = fromArray([1, 2, 3]);
loop.next.next.next = loop.next;
console.log(hasCycle(loop)); // true
```

<!-- lesson: Implementing Stacks and Queues -->

## Stack: last in, first out (LIFO)

Think of a stack of plates: you add and remove at the **top** only.

- `push(x)`, `pop()` and `peek()` are all O(1).
- A JavaScript array **is** a perfect stack: `push` and `pop` work at the end in O(1).

Uses: undo history, the call stack, matching brackets, expression evaluation, depth-first search and backtracking.

## Queue: first in, first out (FIFO)

Like a line at a ticket counter: add at the **back**, remove from the **front**.

- `enqueue(x)`, `dequeue()` and `peek()` should all be O(1).
- **Trap:** using `array.shift()` to dequeue is **O(n)**, because every remaining element moves forward. In a BFS over a large graph, that quietly turns O(V + E) into something much slower.

Fixes:

- Keep a `head` index that moves forward instead of shifting. Occasionally compact the array, or just let it be garbage-collected afterwards.
- Use a linked list with head and tail pointers.
- Use a **circular buffer**: a fixed-size array whose head and tail indexes wrap around with `%`.

## Deque: a double-ended queue

A deque adds and removes at **both** ends in O(1). It's the structure behind sliding-window maximum problems and some BFS variants (0-1 BFS). Implement it as a circular buffer or a doubly linked list.

Uses of queues: breadth-first search, task scheduling, rate limiters and buffering streams of data.

<!-- code: javascript | A stack and an O(1) queue -->
```js
class Stack {
  #items = [];
  push(x) { this.#items.push(x); }
  pop() { return this.#items.pop(); }
  peek() { return this.#items.at(-1); }
  get size() { return this.#items.length; }
  isEmpty() { return this.#items.length === 0; }
}

class Queue {
  #items = [];
  #head = 0; // index of the front element: no shifting

  enqueue(x) { this.#items.push(x); }

  dequeue() {
    if (this.isEmpty()) return undefined;
    const value = this.#items[this.#head];
    this.#items[this.#head++] = undefined; // let it be garbage-collected
    if (this.#head > 1024 && this.#head * 2 > this.#items.length) {
      this.#items = this.#items.slice(this.#head); // compact occasionally
      this.#head = 0;
    }
    return value;
  }

  peek() { return this.#items[this.#head]; }
  get size() { return this.#items.length - this.#head; }
  isEmpty() { return this.size === 0; }
}

const stack = new Stack();
['a', 'b', 'c'].forEach((x) => stack.push(x));
console.log(stack.pop(), stack.peek()); // c b

const queue = new Queue();
[1, 2, 3].forEach((x) => queue.enqueue(x));
console.log(queue.dequeue(), queue.size); // 1 2
```

<!-- lesson: Stack and Queue Problems -->

## Balanced brackets

Push every opening bracket. For each closing bracket, the stack's top must be its matching opener, so pop it. At the end, the stack must be empty. O(n). The same idea validates HTML tags and parses expressions.

## The monotonic stack

A stack kept in increasing or decreasing order answers "the next greater (or smaller) element" questions in **O(n)** instead of O(n²):

- Scan left to right, keeping a stack of **indexes still waiting** for their answer.
- While the current value is greater than the value at the stack's top, pop that index: the current value is its next greater element.
- Push the current index.

Each index is pushed and popped at most once. Variations include daily temperatures (days until a warmer day), stock span, and the largest rectangle in a histogram.

## Simulating with a queue

Queues model anything processed in arrival order:

- **Round-robin scheduling:** dequeue a task, run it for one time slice, and re-enqueue it if it isn't finished.
- **Hot potato / Josephus:** rotate the queue k times, then eliminate the front.
- **Recent requests:** keep the timestamps in a queue, and dequeue those older than the window. This is the basis of rate limiting.

## Two stacks make a queue

Push onto an "in" stack. To dequeue, if the "out" stack is empty, move everything across from "in". That reverses the order, so popping "out" gives FIFO order. Each element moves at most once: **amortised O(1)**.

<!-- code: javascript | Brackets, next greater element and daily temperatures -->
```js
function isBalanced(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

function nextGreater(nums) {
  const result = new Array(nums.length).fill(-1);
  const waiting = []; // indexes, values decreasing from bottom to top
  for (let i = 0; i < nums.length; i++) {
    while (waiting.length && nums[i] > nums[waiting.at(-1)]) {
      result[waiting.pop()] = nums[i];
    }
    waiting.push(i);
  }
  return result;
}

function dailyTemperatures(temps) {
  const days = new Array(temps.length).fill(0);
  const stack = [];
  temps.forEach((t, i) => {
    while (stack.length && t > temps[stack.at(-1)]) {
      const j = stack.pop();
      days[j] = i - j;
    }
    stack.push(i);
  });
  return days;
}

console.log(isBalanced('{[()()]}'), isBalanced('([)]')); // true false
console.log(nextGreater([4, 5, 2, 25])); // [5, 25, 25, -1]
console.log(dailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73])); // [1, 1, 4, 2, 1, 1, 0, 0]
```

<!-- lesson: Tree Terminology and Traversals -->

## Vocabulary

- A **tree** is a set of nodes connected by edges, with no cycles. The top node is the **root**.
- Each node has **children**, and every node except the root has exactly one **parent**. Nodes with no children are **leaves**.
- In a **binary tree**, each node has at most two children: `left` and `right`.
- **Depth** of a node: the number of edges from the root down to it.
- **Height** of a tree: the number of edges on the longest root-to-leaf path. Some books count nodes instead, so check the convention.

## Depth-first traversals

They differ only in **when** you visit the current node:

- **Pre-order** (node, left, right): copies or serialises a tree.
- **In-order** (left, node, right): visits a binary search tree **in sorted order**.
- **Post-order** (left, right, node): processes children before parents, for example when deleting or computing sizes.

Each is a few lines of recursion. Iterative versions use an explicit stack.

## Breadth-first (level order)

Visit the tree level by level using a **queue**: dequeue a node, record it, and enqueue its children. To group the output by level, process `queue.length` nodes per round. Level order finds the minimum depth, the right-side view, and the "zigzag" order.

## Complexity

Every traversal visits each node once: **O(n) time**. Space is O(h) for depth-first traversals, where h is the height (O(log n) for a balanced tree, O(n) for a skewed one), and O(w) for breadth-first, where w is the maximum width.

<!-- code: javascript | Traversals, height and level order -->
```js
class TreeNode {
  constructor(value, left = null, right = null) {
    this.value = value;
    this.left = left;
    this.right = right;
  }
}

//        1
//      /   \
//     2     3
//    / \     \
//   4   5     6
const root = new TreeNode(1, new TreeNode(2, new TreeNode(4), new TreeNode(5)), new TreeNode(3, null, new TreeNode(6)));

const preOrder = (n) => (n ? [n.value, ...preOrder(n.left), ...preOrder(n.right)] : []);
const inOrder = (n) => (n ? [...inOrder(n.left), n.value, ...inOrder(n.right)] : []);
const postOrder = (n) => (n ? [...postOrder(n.left), ...postOrder(n.right), n.value] : []);

// Height in edges: an empty tree is -1, a single node is 0
const height = (n) => (n ? 1 + Math.max(height(n.left), height(n.right)) : -1);

function levelOrder(root) {
  const levels = [];
  const queue = root ? [root] : [];
  while (queue.length) {
    const size = queue.length; // nodes on this level
    const level = [];
    for (let i = 0; i < size; i++) {
      const node = queue.shift(); // fine for small trees; use an O(1) queue for big ones
      level.push(node.value);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    levels.push(level);
  }
  return levels;
}

console.log(preOrder(root)); // [1, 2, 4, 5, 3, 6]
console.log(inOrder(root)); // [4, 2, 5, 1, 3, 6]
console.log(postOrder(root)); // [4, 5, 2, 6, 3, 1]
console.log(height(root)); // 2
console.log(levelOrder(root)); // [[1], [2, 3], [4, 5, 6]]
```

<!-- link: VisuAlgo: Binary search trees | https://visualgo.net/en/bst -->

<!-- lesson: Binary Search Trees -->

## The BST property

For **every** node: all values in its left subtree are smaller, and all values in its right subtree are larger. (Decide on a rule for duplicates, such as "go right" or "keep a count".) An in-order traversal therefore produces sorted output.

## Operations

**Search:** start at the root and go left or right by comparison, like binary search on a tree.

**Insert:** search for the value; where you fall off the tree (`null`), attach the new node.

**Delete** has three cases:

1. **A leaf:** just remove it.
2. **One child:** replace the node with its child.
3. **Two children:** replace its value with the **in-order successor** (the smallest value in the right subtree), then delete the successor from the right subtree.

## Validating a BST

Checking only that `left < node < right` for each parent and child is **wrong**: a node deep in the left subtree could still be larger than the root. Pass down an allowed range `(min, max)` instead, and narrow it as you go.

## Why balance matters

Every operation costs **O(h)**, where h is the height. A balanced tree has h ≈ log n, but inserting sorted data (1, 2, 3, ...) builds a straight line with h = n, and the BST becomes a slow linked list. **Self-balancing trees** such as AVL trees and red-black trees rotate nodes to keep h = O(log n). They power sorted maps in many languages (Java's `TreeMap`) and database indexes (B-trees).

<!-- code: javascript | Insert, search, delete and validate -->
```js
class Node {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

function insert(root, value) {
  if (!root) return new Node(value);
  if (value < root.value) root.left = insert(root.left, value);
  else if (value > root.value) root.right = insert(root.right, value);
  return root; // duplicates ignored
}

function contains(root, value) {
  let node = root;
  while (node) {
    if (value === node.value) return true;
    node = value < node.value ? node.left : node.right;
  }
  return false;
}

function remove(root, value) {
  if (!root) return null;
  if (value < root.value) root.left = remove(root.left, value);
  else if (value > root.value) root.right = remove(root.right, value);
  else {
    if (!root.left) return root.right; // zero or one child
    if (!root.right) return root.left;
    let successor = root.right;        // two children
    while (successor.left) successor = successor.left;
    root.value = successor.value;
    root.right = remove(root.right, successor.value);
  }
  return root;
}

function isValidBST(node, min = -Infinity, max = Infinity) {
  if (!node) return true;
  if (node.value <= min || node.value >= max) return false;
  return isValidBST(node.left, min, node.value) && isValidBST(node.right, node.value, max);
}

let root = null;
for (const v of [50, 30, 70, 20, 40, 60, 80]) root = insert(root, v);
root = remove(root, 30);
console.log(contains(root, 40), contains(root, 30), isValidBST(root)); // true false true
```

<!-- lesson: Tree Problem Patterns -->

## Think in subtrees

Most tree problems follow one recursive template: **solve the problem for the left and right subtrees, then combine the answers at the current node.** Ask yourself what each subtree needs to *return* so the parent can compute its answer.

## Lowest common ancestor (LCA)

The LCA of nodes p and q is the deepest node that has both of them as descendants.

- **In a binary tree:** recurse into both sides. If p and q are found in different subtrees, the current node is the LCA. Otherwise, pass up whichever side found something. O(n).
- **In a BST:** if both values are smaller than the current node, go left; if both are larger, go right; otherwise the current node is the answer. O(h).

## Diameter

The diameter is the longest path between *any* two nodes, and it may not pass through the root. At each node, the longest path *through* it is `leftHeight + rightHeight`. Return the height upwards, and update a running maximum on the side. This "return one thing, track another" pattern also solves the *maximum path sum*.

## Serialise and deserialise

Turning a tree into a string and back requires recording the empty children. With pre-order traversal and a marker such as `#` for null, the string uniquely describes the tree. Deserialise by reading the values in the same order with an index or iterator. Level order with null markers works too.

## Other patterns

Mirror (invert) a tree, check whether two trees are identical or symmetric, compute path sums from root to leaf, and find the k-th smallest element in a BST with an in-order traversal.

<!-- code: javascript | LCA, diameter and serialisation -->
```js
class TreeNode {
  constructor(value, left = null, right = null) {
    this.value = value;
    this.left = left;
    this.right = right;
  }
}

function lowestCommonAncestor(node, p, q) {
  if (!node || node === p || node === q) return node;
  const left = lowestCommonAncestor(node.left, p, q);
  const right = lowestCommonAncestor(node.right, p, q);
  if (left && right) return node; // found on both sides
  return left ?? right;
}

function diameter(root) {
  let best = 0;
  const height = (node) => {
    if (!node) return 0;
    const l = height(node.left);
    const r = height(node.right);
    best = Math.max(best, l + r); // longest path through this node (in edges)
    return 1 + Math.max(l, r);
  };
  height(root);
  return best;
}

const serialize = (node) => (node ? `${node.value},${serialize(node.left)},${serialize(node.right)}` : '#');

function deserialize(data) {
  const values = data.split(',')[Symbol.iterator]();
  const build = () => {
    const v = values.next().value;
    return v === '#' ? null : new TreeNode(Number(v), build(), build());
  };
  return build();
}

const four = new TreeNode(4);
const five = new TreeNode(5);
const root = new TreeNode(1, new TreeNode(2, four, five), new TreeNode(3));
console.log(lowestCommonAncestor(root, four, five).value); // 2
console.log(diameter(root)); // 3 (4 -> 2 -> 1 -> 3)
const text = serialize(root);
console.log(text); // 1,2,4,#,#,5,#,#,3,#,#
console.log(serialize(deserialize(text)) === text); // true
```

<!-- lesson: Binary Heaps -->

## What a heap is

A **binary heap** is a complete binary tree (every level is full except possibly the last, which fills left to right) with the **heap property**:

- **min-heap:** every parent ≤ its children, so the minimum is at the root
- **max-heap:** every parent ≥ its children

The heap isn't fully sorted. It only guarantees that the root is the extreme value, which is all a priority queue needs.

## Stored in an array

A complete tree packs perfectly into an array, with no pointers needed. For the node at index `i`:

- parent: `Math.floor((i - 1) / 2)`
- left child: `2i + 1`
- right child: `2i + 2`

## Operations

- **push:** append at the end, then **sift up**, swapping with the parent while it's smaller than the parent (in a min-heap). O(log n).
- **pop:** take the root, move the last element to the root, then **sift down**, swapping with the smaller child while it's larger than that child. O(log n).
- **peek:** `heap[0]`, O(1).

## Building a heap in O(n)

Pushing n items one by one costs O(n log n). Instead, call sift down on every non-leaf node from the last one up to the root. Most nodes are near the bottom and barely move, so the total is **O(n)**.

## Heap sort

Build a max-heap, then repeatedly swap the root with the last element and sift down within the shrinking heap. O(n log n) time and O(1) extra space, but not stable.

JavaScript has no built-in heap, so you'll write one (or keep a tested one ready) for interviews.

<!-- code: javascript | A min-heap with a custom comparator -->
```js
class MinHeap {
  #items = [];

  constructor(compare = (a, b) => a - b) {
    this.compare = compare;
  }

  get size() { return this.#items.length; }
  peek() { return this.#items[0]; }

  push(value) {
    const a = this.#items;
    a.push(value);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(a[i], a[parent]) >= 0) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop() {
    const a = this.#items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < a.length && this.compare(a[l], a[smallest]) < 0) smallest = l;
        if (r < a.length && this.compare(a[r], a[smallest]) < 0) smallest = r;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]];
        i = smallest;
      }
    }
    return top;
  }
}

const heap = new MinHeap();
[5, 3, 8, 1, 9, 2].forEach((x) => heap.push(x));
const sorted = [];
while (heap.size) sorted.push(heap.pop());
console.log(sorted); // [1, 2, 3, 5, 8, 9]

const tasks = new MinHeap((a, b) => a.priority - b.priority);
tasks.push({ name: 'email', priority: 3 });
tasks.push({ name: 'outage', priority: 1 });
console.log(tasks.pop().name); // "outage"
```

<!-- link: VisuAlgo: Binary heap | https://visualgo.net/en/heap -->

<!-- lesson: Priority Queue Problems -->

## When to reach for a heap

A priority queue (a heap) shines when you repeatedly need **the smallest or largest of a changing set**. Sorting everything is O(n log n); a heap gives you the extreme in O(log n) per operation, and only keeps what it needs.

## The k largest elements

Keep a **min-heap of size k**. Push each element; whenever the size exceeds k, pop the smallest. At the end, the heap holds the k largest values, and its root is the k-th largest. That's O(n log k) time and O(k) space, which beats sorting when k is much smaller than n, and works on streams of unknown length.

Counter-intuitively, finding the *largest* values uses a *min*-heap, because you're throwing away the smallest of the candidates.

## Merge k sorted lists

Push the first element of each list onto a min-heap, as `{ value, listIndex, elementIndex }`. Pop the smallest, append it to the output, and push the next element from the same list. O(N log k) for N total elements. This is how databases merge sorted runs.

## Running median

Split the numbers seen so far into two halves:

- a **max-heap** for the lower half
- a **min-heap** for the upper half

Keep the sizes balanced (differing by at most 1), and every element of the lower half ≤ every element of the upper half. The median is then the top of the larger heap, or the average of both tops. Each insertion costs O(log n), and reading the median costs O(1).

## Scheduling

Task schedulers, event simulations and Dijkstra's algorithm all repeatedly pop the "next most urgent" item, which is exactly a heap.

<!-- code: javascript | Top k, merge k lists and running median -->
```js
// Uses the MinHeap class from the previous lesson (with a custom comparator).

function kLargest(nums, k) {
  const heap = new MinHeap();
  for (const n of nums) {
    heap.push(n);
    if (heap.size > k) heap.pop(); // drop the smallest candidate
  }
  const result = [];
  while (heap.size) result.push(heap.pop());
  return result.reverse();
}

function mergeKSorted(lists) {
  const heap = new MinHeap((a, b) => a.value - b.value);
  lists.forEach((list, li) => list.length && heap.push({ value: list[0], li, ei: 0 }));
  const out = [];
  while (heap.size) {
    const { value, li, ei } = heap.pop();
    out.push(value);
    if (ei + 1 < lists[li].length) heap.push({ value: lists[li][ei + 1], li, ei: ei + 1 });
  }
  return out;
}

class RunningMedian {
  low = new MinHeap((a, b) => b - a); // max-heap for the lower half
  high = new MinHeap(); // min-heap for the upper half

  add(n) {
    if (this.low.size === 0 || n <= this.low.peek()) this.low.push(n);
    else this.high.push(n);
    if (this.low.size > this.high.size + 1) this.high.push(this.low.pop());
    else if (this.high.size > this.low.size) this.low.push(this.high.pop());
  }

  median() {
    return this.low.size > this.high.size ? this.low.peek() : (this.low.peek() + this.high.peek()) / 2;
  }
}

console.log(kLargest([3, 2, 1, 5, 6, 4], 2)); // [6, 5]
console.log(mergeKSorted([[1, 4, 5], [1, 3, 4], [2, 6]])); // [1, 1, 2, 3, 4, 4, 5, 6]
const rm = new RunningMedian();
[5, 15, 1, 3].forEach((n) => rm.add(n));
console.log(rm.median()); // 4
```

<!-- lesson: Graph Representations -->

## Graphs everywhere

A **graph** is a set of **vertices** (nodes) connected by **edges**. Road maps, social networks, course prerequisites, web links and dependency trees are all graphs.

Variations:

- **Undirected** (friendships) or **directed** (follows, prerequisites).
- **Unweighted**, or **weighted** (distances, costs).
- **Cyclic** or **acyclic**. A directed acyclic graph is a **DAG**.
- **Connected**, or made up of several **components**.

## Adjacency list

Each vertex maps to a list of its neighbours: `Map<vertex, neighbours[]>`.

- Space: O(V + E).
- Iterating a vertex's neighbours costs O(degree), which suits BFS and DFS.
- Checking whether a specific edge exists costs O(degree), or O(1) if you use a Set of neighbours.

For weighted graphs, store pairs: `{ to, weight }`. **Use adjacency lists by default.** Most real graphs are *sparse*: they have far fewer edges than V².

## Adjacency matrix

A V × V grid, where `matrix[u][v]` is 1 (or the weight) if the edge exists.

- Space: O(V²), which is wasteful for sparse graphs.
- Edge checks are O(1), but iterating neighbours costs O(V).
- Good for small, dense graphs, and for algorithms like Floyd–Warshall.

## Implicit graphs

Many problems hide a graph: a **grid**, where each cell connects to its four neighbours; word ladders, where words one letter apart connect; or puzzle states. Generate the neighbours on the fly instead of building the graph.

## Building from an edge list

Problems usually give edges as pairs. For an undirected graph, add **both directions**. Forgetting this is the most common bug.

<!-- code: javascript | Building graphs from edge lists -->
```js
function buildGraph(edges, { directed = false } = {}) {
  const graph = new Map();
  const addVertex = (v) => graph.has(v) || graph.set(v, []);
  for (const [from, to, weight = 1] of edges) {
    addVertex(from);
    addVertex(to);
    graph.get(from).push({ to, weight });
    if (!directed) graph.get(to).push({ to: from, weight }); // both directions!
  }
  return graph;
}

const roads = buildGraph([
  ['Pune', 'Mumbai', 150],
  ['Pune', 'Nashik', 210],
  ['Mumbai', 'Nashik', 165],
]);
console.log(roads.get('Pune')); // [{ to: 'Mumbai', weight: 150 }, { to: 'Nashik', weight: 210 }]

const prerequisites = buildGraph([['html', 'css'], ['css', 'react'], ['js', 'react']], { directed: true });
console.log(prerequisites.get('react')); // []: nothing depends on react

// Adjacency matrix for a small dense graph
const n = 3;
const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
[[0, 1], [1, 2]].forEach(([u, v]) => { matrix[u][v] = 1; matrix[v][u] = 1; });
console.log(matrix); // [[0,1,0],[1,0,1],[0,1,0]]

// Implicit graph: neighbours of a grid cell
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const neighbours = (grid, r, c) =>
  DIRS.map(([dr, dc]) => [r + dr, c + dc])
    .filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < grid.length && nc < grid[0].length);
```

<!-- link: VisuAlgo: Graph structures | https://visualgo.net/en/graphds -->

<!-- lesson: Breadth-First and Depth-First Search -->

## Two ways to explore

Both visit every vertex reachable from a start vertex, in **O(V + E)** time. Both must track **visited** vertices, or a cycle will loop forever.

## Breadth-first search (BFS)

BFS explores **level by level** with a queue: first the start, then all of its neighbours, then their neighbours, and so on.

- Mark a vertex visited **when you enqueue it**, not when you dequeue it, to avoid adding it twice.
- In an **unweighted** graph, BFS finds the **shortest path** (the fewest edges) from the start to every vertex. Record each vertex's distance, or its parent if you need to rebuild the path.

## Depth-first search (DFS)

DFS goes **as deep as possible** before backtracking, using recursion (the call stack) or an explicit stack.

Use it for:

- **connectivity**: is there any path at all?
- **counting connected components**: start a DFS from every unvisited vertex, and count how many times you start
- **cycle detection** and **topological sort** (next lesson)
- flood fill: counting islands in a grid, or the paint-bucket tool

## Which one?

| Need | Use |
| --- | --- |
| Shortest path, unweighted | BFS |
| Any path, or "is it reachable?" | either; DFS is often simpler |
| Components, flood fill | either |
| Path through a weighted graph | neither: Dijkstra (next lesson) |

On large grids, prefer iterative versions: recursive DFS on a 1000 × 1000 grid can overflow the call stack.

<!-- code: javascript | BFS shortest path and counting islands with DFS -->
```js
function shortestPath(graph, start, goal) {
  const parent = new Map([[start, null]]); // also serves as the visited set
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (node === goal) {
      const path = [];
      for (let at = goal; at !== null; at = parent.get(at)) path.push(at);
      return path.reverse();
    }
    for (const next of graph.get(node) ?? []) {
      if (!parent.has(next)) {
        parent.set(next, node); // mark visited when enqueuing
        queue.push(next);
      }
    }
  }
  return null; // unreachable
}

function countIslands(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const seen = grid.map((row) => row.map(() => false));
  const sink = (r, c) => {
    const stack = [[r, c]]; // iterative DFS: no stack overflow on big grids
    seen[r][c] = true;
    while (stack.length) {
      const [cr, cc] = stack.pop();
      for (const [nr, nc] of [[cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]]) {
        if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && grid[nr][nc] === 1 && !seen[nr][nc]) {
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
    }
  };
  let islands = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1 && !seen[r][c]) {
        islands++;
        sink(r, c);
      }
    }
  }
  return islands;
}

const graph = new Map([['A', ['B', 'C']], ['B', ['D']], ['C', ['D', 'E']], ['D', ['F']], ['E', ['F']], ['F', []]]);
console.log(shortestPath(graph, 'A', 'F')); // ['A', 'B', 'D', 'F']
console.log(countIslands([[1, 1, 0, 0], [0, 1, 0, 1], [1, 0, 0, 1]])); // 3
```

<!-- link: VisuAlgo: Graph traversal | https://visualgo.net/en/dfsbfs -->

<!-- lesson: Topological Sort and Shortest Paths -->

## Topological sort

In a **DAG** (directed acyclic graph), a topological order lists the vertices so that every edge points **forwards**: each task comes after all of its prerequisites. Uses include course planning, build systems and package installation order.

**Kahn's algorithm (BFS):**

1. Count each vertex's **in-degree**, the number of incoming edges.
2. Queue every vertex with in-degree 0: they have no prerequisites.
3. Dequeue a vertex, append it to the order, and decrement its neighbours' in-degrees. Enqueue any neighbour that reaches 0.
4. If the order contains fewer than V vertices, the graph has a **cycle**, so no valid order exists.

It runs in O(V + E). (The DFS alternative: append each vertex after all its descendants finish, then reverse the list. It detects cycles by finding vertices that are still "in progress".)

## Dijkstra's algorithm

Dijkstra finds the shortest paths from a source in a graph with **non-negative** weights:

1. Set the distance to the source to 0, and every other distance to ∞.
2. Repeatedly take the unfinished vertex with the **smallest known distance**, using a min-heap.
3. **Relax** its edges: if `dist[u] + w < dist[v]`, update `dist[v]` and push `v` with its new distance.
4. Skip heap entries that are stale (larger than the vertex's current best distance).

With a binary heap it runs in **O((V + E) log V)**.

Dijkstra **fails with negative edge weights**, because a vertex finalised early might later be reachable more cheaply. Use Bellman–Ford in that case. For unweighted graphs, plain BFS is simpler and faster.

<!-- code: javascript | Kahn's algorithm and Dijkstra -->
```js
function topologicalSort(vertices, edges) {
  const inDegree = new Map(vertices.map((v) => [v, 0]));
  const next = new Map(vertices.map((v) => [v, []]));
  for (const [from, to] of edges) {
    next.get(from).push(to);
    inDegree.set(to, inDegree.get(to) + 1);
  }
  const queue = vertices.filter((v) => inDegree.get(v) === 0);
  const order = [];
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head];
    order.push(v);
    for (const w of next.get(v)) {
      inDegree.set(w, inDegree.get(w) - 1);
      if (inDegree.get(w) === 0) queue.push(w);
    }
  }
  if (order.length !== vertices.length) throw new Error('Cycle detected: no valid order');
  return order;
}

// graph: Map<vertex, { to, weight }[]>. Uses the MinHeap class from the heaps module.
function dijkstra(graph, source) {
  const dist = new Map([...graph.keys()].map((v) => [v, Infinity]));
  dist.set(source, 0);
  const heap = new MinHeap((a, b) => a.d - b.d);
  heap.push({ v: source, d: 0 });
  while (heap.size) {
    const { v, d } = heap.pop();
    if (d > dist.get(v)) continue; // stale entry
    for (const { to, weight } of graph.get(v)) {
      const candidate = d + weight;
      if (candidate < dist.get(to)) {
        dist.set(to, candidate);
        heap.push({ v: to, d: candidate });
      }
    }
  }
  return dist;
}

console.log(topologicalSort(['html', 'css', 'js', 'react'], [['html', 'css'], ['css', 'react'], ['js', 'react']]));
// ['html', 'js', 'css', 'react']
```

<!-- link: VisuAlgo: Single-source shortest paths | https://visualgo.net/en/sssp -->

<!-- lesson: The Greedy Approach -->

## Make the best local choice

A **greedy** algorithm builds its answer step by step, always taking the choice that looks best **right now**, and never reconsidering. It's usually simple and fast, often just a sort plus a single pass in O(n log n). The catch is that it's only correct for problems with the right structure.

## When greedy works

A greedy algorithm is correct when the problem has:

1. **The greedy-choice property:** some optimal solution includes the greedy first choice.
2. **Optimal substructure:** after making that choice, what remains is a smaller instance of the same problem.

## Interval scheduling

Given meetings with start and end times, attend as many as possible without overlaps. Which greedy rule works?

- Earliest *start* first? No: one long early meeting can block many short ones.
- Shortest meeting first? No: a short meeting can overlap two others.
- **Earliest *end* first: yes.** Finishing as early as possible leaves the most room for everything else.

Sort by end time, then take each meeting that starts after the last one you took ended.

## When greedy fails

**Coin change with coins {1, 3, 4} for amount 6:** greedy takes 4 + 1 + 1, three coins, but 3 + 3 uses only two. **The 0/1 knapsack:** taking the item with the best value-per-weight first can leave space wasted. These problems need **dynamic programming**.

## How to decide

Try to break your greedy rule with small counterexamples first. If you can't, try to prove it with an **exchange argument** (next lesson). If neither works, consider DP.

<!-- code: javascript | Interval scheduling, and greedy failing at coin change -->
```js
function maxMeetings(meetings) {
  const byEnd = [...meetings].sort((a, b) => a[1] - b[1]); // earliest end first
  const chosen = [];
  let lastEnd = -Infinity;
  for (const [start, end] of byEnd) {
    if (start >= lastEnd) {
      chosen.push([start, end]);
      lastEnd = end;
    }
  }
  return chosen;
}

console.log(maxMeetings([[1, 4], [3, 5], [0, 6], [5, 7], [8, 9], [5, 9]]));
// [[1, 4], [5, 7], [8, 9]]

function greedyCoins(coins, amount) {
  const sorted = [...coins].sort((a, b) => b - a);
  const used = [];
  for (const coin of sorted) {
    while (amount >= coin) {
      amount -= coin;
      used.push(coin);
    }
  }
  return amount === 0 ? used : null;
}

console.log(greedyCoins([1, 5, 10, 25], 63)); // [25, 25, 10, 1, 1, 1]: optimal for these coins
console.log(greedyCoins([1, 3, 4], 6)); // [4, 1, 1]: but [3, 3] is better, so greedy fails here
```

<!-- lesson: Greedy Problem Practice -->

## Jump game

Each element of `nums` is the maximum jump length from that index. Can you reach the last index? Track the **farthest reachable index** as you scan. If the current index is ever beyond it, you're stuck. O(n). The variant "minimum number of jumps" is a greedy BFS over ranges: count a jump each time you pass the end of the current range.

## Gas station

There are stations around a circle, each with `gas[i]` fuel and `cost[i]` to reach the next one. Two facts:

1. If the total gas is less than the total cost, no start works.
2. If you run out of fuel between start `s` and station `i`, then **no station between `s` and `i` can work as a start either**. So restart at `i + 1`.

One pass, O(n).

## Minimum coins (canonical systems)

For coin systems such as {1, 2, 5, 10, 20, 50, 100, 500} (Indian rupees) or {1, 5, 10, 25} (US cents), always taking the largest coin that fits is optimal. These are called **canonical** systems. For arbitrary systems, use DP.

## Proving greedy correct: exchange arguments

Assume an optimal solution that **differs** from the greedy one at its first choice. Show you can **swap** in the greedy choice without making the solution worse. Repeat the argument, and you've transformed the optimal solution into the greedy one without losing anything, so the greedy solution is optimal too.

For interval scheduling: swap the optimal solution's first meeting for the meeting that ends earliest. It ends no later, so everything after it still fits.

## More practice

Assigning cookies to children, merging overlapping intervals (sort by start), finding the minimum number of arrows to burst balloons, and task scheduling with cooldowns.

<!-- code: javascript | Jump game, gas station and merging intervals -->
```js
function canJump(nums) {
  let farthest = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i > farthest) return false; // can't even get here
    farthest = Math.max(farthest, i + nums[i]);
  }
  return true;
}

function gasStationStart(gas, cost) {
  let total = 0;
  let tank = 0;
  let start = 0;
  for (let i = 0; i < gas.length; i++) {
    const diff = gas[i] - cost[i];
    total += diff;
    tank += diff;
    if (tank < 0) {
      start = i + 1; // no station in [start, i] can work
      tank = 0;
    }
  }
  return total >= 0 ? start : -1;
}

function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

console.log(canJump([2, 3, 1, 1, 4]), canJump([3, 2, 1, 0, 4])); // true false
console.log(gasStationStart([1, 2, 3, 4, 5], [3, 4, 5, 1, 2])); // 3
console.log(mergeIntervals([[1, 3], [8, 10], [2, 6], [15, 18]])); // [[1, 6], [8, 10], [15, 18]]
```

<!-- lesson: Memoization and Tabulation -->

## Overlapping subproblems

Dynamic programming (DP) applies when a problem has:

1. **Optimal substructure:** the answer can be built from answers to smaller subproblems.
2. **Overlapping subproblems:** the same subproblems come up again and again.

Naive Fibonacci is the classic example: `fib(5)` calls `fib(3)` twice and `fib(2)` three times. The recursion tree has about 2ⁿ nodes but only n *distinct* subproblems. DP solves each distinct subproblem **once**.

## Top-down: memoisation

Keep the natural recursive solution, and cache the results:

- Before computing, check the cache.
- After computing, store the result.

The structure stays readable, and only the subproblems you actually need are computed. The cost is recursion depth (stack space and possible overflow).

## Bottom-up: tabulation

Fill a table from the **smallest subproblems up**, in an order where every dependency is already computed. There's no recursion, it's often faster, and it's easier to optimise for space.

## The DP recipe

1. **Define the state:** what does `dp[i]` (or `dp[i][j]`) *mean*, in one sentence?
2. **Write the recurrence:** how is `dp[i]` computed from smaller states?
3. **Set the base cases.**
4. **Choose the order:** make sure the dependencies are computed first.
5. **Read off the answer**, and check the complexity: (number of states) × (work per state).

Most of the difficulty is in step 1. Practise saying the state definition out loud.

<!-- code: javascript | Fibonacci three ways -->
```js
// Plain recursion: O(2^n)
const fibNaive = (n) => (n < 2 ? n : fibNaive(n - 1) + fibNaive(n - 2));

// Top-down with a memo: O(n) time, O(n) space (cache + call stack)
function fibMemo(n, memo = new Map()) {
  if (n < 2) return n;
  if (memo.has(n)) return memo.get(n);
  const value = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  memo.set(n, value);
  return value;
}

// Bottom-up table: O(n) time, O(n) space, no recursion
function fibTable(n) {
  const dp = new Array(n + 1).fill(0);
  dp[1] = 1;
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
  return dp[n];
}

// Bottom-up with two variables: O(n) time, O(1) space
function fib(n) {
  let [a, b] = [0, 1];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

console.time('memo');
console.log(fibMemo(70)); // 190392490709135
console.timeEnd('memo');
console.log(fibTable(30), fib(30)); // 832040 832040
```

<!-- link: VisuAlgo: Recursion trees and DP | https://visualgo.net/en/recursion -->

<!-- lesson: One-Dimensional DP -->

## One changing parameter

In 1D DP problems the state is a single index or amount, so the table is an array, and each entry depends on a few earlier entries.

## Climbing stairs

You can climb 1 or 2 steps at a time. How many distinct ways are there to reach step `n`?

- **State:** `ways[i]` = the number of ways to reach step `i`.
- **Recurrence:** `ways[i] = ways[i - 1] + ways[i - 2]`. Your last move was either a 1-step or a 2-step.
- **Base cases:** `ways[0] = 1` and `ways[1] = 1`.

## House robber

Houses in a row hold `money[i]`, and you can't rob two adjacent houses. What's the maximum you can take?

- **State:** `best[i]` = the most money obtainable from the first `i` houses.
- **Recurrence:** `best[i] = max(best[i - 1], best[i - 2] + money[i - 1])`, that is, skip this house or rob it.

## Coin change (fewest coins)

- **State:** `dp[a]` = the fewest coins that make amount `a`.
- **Recurrence:** `dp[a] = min over coins c ≤ a of dp[a - c] + 1`.
- **Base case:** `dp[0] = 0`; everything else starts at ∞ (unreachable).

O(amount × coins). Unlike greedy, this works for any coin system.

## Space optimisation

When `dp[i]` depends only on the last one or two entries, keep just those variables instead of the whole array: O(1) space. Climbing stairs and house robber both reduce to two variables. Coin change needs the whole array, because it can look back as far as the largest coin.

<!-- code: javascript | Climbing stairs, house robber and coin change -->
```js
function climbStairs(n) {
  let [prev, curr] = [1, 1]; // ways to reach step 0 and step 1
  for (let i = 2; i <= n; i++) [prev, curr] = [curr, prev + curr];
  return curr;
}

function rob(money) {
  let [skipPrev, best] = [0, 0]; // best[i - 2], best[i - 1]
  for (const m of money) [skipPrev, best] = [best, Math.max(best, skipPrev + m)];
  return best;
}

function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

console.log(climbStairs(5)); // 8
console.log(rob([2, 7, 9, 3, 1])); // 12  (2 + 9 + 1)
console.log(coinChange([1, 3, 4], 6)); // 2  (3 + 3): greedy would give 3
console.log(coinChange([2], 3)); // -1
```

<!-- lesson: Two-Dimensional DP -->

## Two changing parameters

When the state needs two indexes, such as a grid position or a position in each of two strings, the table becomes a 2D array. Fill it row by row, so that the cells each entry depends on (above, to the left, diagonally up-left) are already computed.

## Unique paths in a grid

A robot moves only right or down from the top-left corner of an `m × n` grid. How many paths reach the bottom-right corner?

- **State:** `dp[r][c]` = the number of paths to cell (r, c).
- **Recurrence:** `dp[r][c] = dp[r - 1][c] + dp[r][c - 1]`.
- **Base cases:** the first row and the first column are all 1. With obstacles, a blocked cell is 0.

## Longest common subsequence (LCS)

The longest sequence of characters that appears in both strings in order, though not necessarily contiguously. This is the basis of `diff` tools.

- **State:** `dp[i][j]` = the LCS length of `a[0..i)` and `b[0..j)`.
- **Recurrence:** if `a[i - 1] === b[j - 1]`, then `dp[i - 1][j - 1] + 1`; otherwise `max(dp[i - 1][j], dp[i][j - 1])`.

O(m × n) time. Rebuild the subsequence itself by walking back from `dp[m][n]`.

## 0/1 knapsack

Each item has a weight and a value, and you can take each at most once. What's the maximum value within a capacity `W`?

- **State:** `dp[i][w]` = the best value using the first `i` items with capacity `w`.
- **Recurrence:** `max(dp[i - 1][w], dp[i - 1][w - weight] + value)`: skip the item or take it.

**Space trick:** keep a single 1D array and loop `w` **from high to low**, so each item is used at most once. (Looping from low to high would allow unlimited reuse, which is the *unbounded* knapsack.)

<!-- code: javascript | Unique paths, LCS and 0/1 knapsack -->
```js
function uniquePaths(m, n) {
  const dp = Array.from({ length: m }, () => new Array(n).fill(1));
  for (let r = 1; r < m; r++) {
    for (let c = 1; c < n; c++) dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
  }
  return dp[m - 1][n - 1];
}

function longestCommonSubsequence(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Walk back to rebuild one LCS
  let i = a.length;
  let j = b.length;
  const chars = [];
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { chars.push(a[i - 1]); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return chars.reverse().join('');
}

function knapsack(items, capacity) {
  const dp = new Array(capacity + 1).fill(0);
  for (const { weight, value } of items) {
    for (let w = capacity; w >= weight; w--) { // high to low: each item used once
      dp[w] = Math.max(dp[w], dp[w - weight] + value);
    }
  }
  return dp[capacity];
}

console.log(uniquePaths(3, 7)); // 28
console.log(longestCommonSubsequence('ABCBDAB', 'BDCABA')); // "BCBA" (length 4)
console.log(knapsack([{ weight: 1, value: 1 }, { weight: 3, value: 4 }, { weight: 4, value: 5 }, { weight: 5, value: 7 }], 7)); // 9
```

<!-- lesson: A Framework for Solving Problems -->

## Don't start typing

Strong candidates aren't the ones who instantly know the answer. They follow a **repeatable process** and think out loud, so the interviewer can follow and help.

## 1. Understand (2–5 minutes)

- Restate the problem in your own words.
- Ask about the input: its size, the range of values, whether it's sorted, whether there are duplicates, negatives or empty input.
- Ask about the output format, and what to return when there's no answer.
- Work through **one example by hand**, and invent an edge case.

## 2. Brute force first

State the simplest correct solution and its complexity, even if it's slow. It proves you understand the problem, and it's your fallback.

## 3. Optimise

Look for **repeated work** in the brute force, and match the problem to a pattern:

| Clue | Try |
| --- | --- |
| Sorted input, pairs | two pointers, binary search |
| Contiguous subarray or substring | sliding window, prefix sums |
| "Seen before?" lookups | hash map or set |
| All combinations | backtracking |
| Best or count of ways with overlapping choices | dynamic programming |
| k smallest or largest, streaming | heap |
| Connections, dependencies | graph BFS, DFS or topological sort |

Agree on the approach with the interviewer *before* coding.

## 4. Code cleanly

Use meaningful names and small helper functions. Talk while you write, and don't go silent for minutes at a time.

## 5. Test out loud

Trace your code by hand on the example, then on the edge cases: empty input, one element, duplicates, very large values. Fix bugs calmly. Finish by stating the **time and space complexity**.

<!-- code: javascript | The framework applied: contains nearby duplicate -->
```js
/*
 * Problem: return true if nums[i] === nums[j] for two different indexes with |i - j| <= k.
 *
 * 1. Understand: nums can be empty; values can repeat or be negative; k >= 0.
 *    Example: [1, 2, 3, 1], k = 3 -> true (indexes 0 and 3).
 *    Edge: [1, 2, 3, 1, 2, 3], k = 2 -> false.
 *
 * 2. Brute force: compare each i with the next k elements. O(n * k) time, O(1) space.
 */
function containsNearbyDuplicateBrute(nums, k) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j <= i + k && j < nums.length; j++) {
      if (nums[i] === nums[j]) return true;
    }
  }
  return false;
}

/*
 * 3. Optimise: the repeated work is re-scanning the window. Remember the last index of
 *    each value in a hash map, and check whether it's within k. O(n) time, O(n) space.
 */
function containsNearbyDuplicate(nums, k) {
  const lastIndex = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (lastIndex.has(nums[i]) && i - lastIndex.get(nums[i]) <= k) return true;
    lastIndex.set(nums[i], i);
  }
  return false;
}

// 5. Test out loud, including the edge cases
console.log(containsNearbyDuplicate([1, 2, 3, 1], 3)); // true
console.log(containsNearbyDuplicate([1, 2, 3, 1, 2, 3], 2)); // false
console.log(containsNearbyDuplicate([], 1)); // false
console.log(containsNearbyDuplicateBrute([1, 0, 1, 1], 1)); // true
```

<!-- lesson: Mock Interview Sets -->

## How to use these sets

Each set has **three problems**: one easy, one medium and one medium-to-hard, mixing topics as a real interview would. Give yourself **60 minutes** per set, with no notes and no running the code until you've traced it by hand. Then review.

## Set A

1. **Valid anagram** (hash map). Target: O(n).
2. **Longest substring without repeating characters** (sliding window).
3. **Course schedule:** can you finish all the courses, given their prerequisites? (topological sort and cycle detection)

## Set B

1. **Merge two sorted linked lists** (pointers).
2. **K-th largest element in an array** (heap, or quickselect).
3. **Coin change:** the fewest coins (1D DP).

## Set C

1. **Binary tree level order traversal** (BFS).
2. **Search in a rotated sorted array** (a modified binary search).
3. **Word search in a grid** (backtracking with DFS).

## After each set: review

For every problem, write down:

- the pattern, and how you could have recognised it faster
- your final complexity, and whether a better one exists
- **every bug** you made, and why. Keep a running "mistake log", and reread it before each new set. Off-by-one errors in loop bounds, forgetting to mark nodes visited, and mutating shared arrays are the usual suspects.

Then re-solve any problem you couldn't finish **two days later, from scratch**. Spaced repetition is what makes patterns stick.

## Pair practice

Take turns as interviewer and candidate. The interviewer gives hints only when the candidate is stuck for more than three minutes, and gives feedback on communication as well as on the code.

<!-- code: javascript | Set C, problem 2: search in a rotated sorted array -->
```js
/*
 * nums was sorted ascending, then rotated at an unknown pivot, e.g. [4, 5, 6, 7, 0, 1, 2].
 * Return the index of target, or -1. Required: O(log n).
 *
 * Key insight: at any mid, at least one half ([lo..mid] or [mid..hi]) is sorted.
 * Check whether target lies inside that sorted half; if not, search the other half.
 */
function searchRotated(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return mid;

    if (nums[lo] <= nums[mid]) {
      // left half is sorted
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      // right half is sorted
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}

console.log(searchRotated([4, 5, 6, 7, 0, 1, 2], 0)); // 4
console.log(searchRotated([4, 5, 6, 7, 0, 1, 2], 3)); // -1
console.log(searchRotated([1], 1)); // 0
// Complexity: O(log n) time, O(1) space.
```

<!-- link: NeetCode roadmap (curated practice problems) | https://neetcode.io/roadmap -->

<!-- lesson: Project: Algorithm Visualizer -->

## What you'll build

A small web app that **animates algorithms step by step**: sorting algorithms on bar charts, and BFS/DFS on a grid. Building it forces you to understand each algorithm's every step, and it makes a great portfolio piece.

## Core idea: record, then replay

Don't try to animate *while* sorting. Instead, write each algorithm as a function that **records steps**, such as `{ type: 'compare', i, j }`, `{ type: 'swap', i, j }` or `{ type: 'visit', cell }`, into an array. The UI then replays the steps at a chosen speed. This separates the algorithm from the rendering, makes pause, step and rewind easy, and lets you unit test the algorithms.

**Generator functions** (`function*`) are a natural fit: `yield` a step, and the player pulls the next one on each animation frame.

## Features

1. **Sorting:** bubble, insertion, merge and quick sort, on a random array of bars. Colour the bars being compared and swapped. Show a counter of comparisons and swaps.
2. **Grid search:** click to draw walls, set a start and an end, and run BFS (which finds the shortest path) or DFS. Show the visited order, then the final path.
3. **Controls:** play/pause, step, a speed slider, array size, and reset.
4. **Explanations:** for each algorithm, a panel with its idea, its complexity, and when to use it.

## Stretch goals

Dijkstra with weighted cells, a side-by-side race between two sorting algorithms, and keyboard shortcuts.

## Deliverable

Deploy it as a static site, and write a README with a GIF demo and a section on what you learned about each algorithm.

<!-- code: javascript | Sorting as a generator of steps -->
```js
// Each algorithm yields steps; it never touches the DOM.
function* bubbleSortSteps(input) {
  const a = [...input];
  for (let end = a.length - 1; end > 0; end--) {
    for (let i = 0; i < end; i++) {
      yield { type: 'compare', i, j: i + 1 };
      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        yield { type: 'swap', i, j: i + 1, array: [...a] };
      }
    }
    yield { type: 'sorted', index: end };
  }
}

// The player pulls one step per tick and hands it to the renderer.
function play(steps, render, { delay = 50 } = {}) {
  let timer = null;
  const tick = () => {
    const { value, done } = steps.next();
    if (done) return;
    render(value);
    timer = setTimeout(tick, delay);
  };
  return {
    start: () => tick(),
    pause: () => clearTimeout(timer),
    step: () => {
      const { value, done } = steps.next();
      if (!done) render(value);
    },
  };
}

// Usage with any renderer (canvas, divs, or console while testing):
const player = play(bubbleSortSteps([5, 1, 4, 2]), (step) => console.log(step), { delay: 0 });
player.start();
```

<!-- link: MDN: Generator functions | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function* -->
