# Full-Stack MERN Development: starter materials

Each lesson below becomes a set of study materials: the note, then each code example, then each link. See `server/src/seeds/materials.seed.js` for the format.

<!-- lesson: How the Web Works -->

## From URL to page

When you type `https://example.com/blog?page=2` and press Enter, a lot happens in under a second:

1. **DNS lookup.** The browser asks a DNS resolver for the IP address of `example.com`.
2. **Connection.** It opens a TCP connection to that IP address and, for `https`, negotiates TLS encryption.
3. **Request.** It sends an HTTP request: a method (`GET`), a path (`/blog?page=2`) and headers such as `Accept` and `Cookie`.
4. **Response.** The server replies with a status code (`200 OK`, `404 Not Found`, ...), headers such as `Content-Type`, and a body, usually HTML.
5. **Rendering.** The browser parses the HTML, requests the CSS, JavaScript and images it references, and paints the page.

## Parts of a URL

| Part | Example |
| --- | --- |
| Scheme | `https` |
| Host | `example.com` |
| Path | `/blog` |
| Query string | `?page=2` |
| Fragment | `#comments` (never sent to the server) |

## Clients and servers

The **client** (your browser) always starts the conversation; the **server** only answers. HTTP is *stateless*: each request stands alone, so servers use cookies or tokens to remember who you are. Everything you build in this course, from static pages to React apps talking to an Express API, follows this request-response cycle.

**Try it:** open your browser's developer tools, go to the *Network* tab and reload any page. Click the first request and find the method, status code and response headers.

<!-- code: javascript | Taking a URL apart | The URL class is built into browsers and Node.js -->
```js
const url = new URL('https://example.com:8080/blog/posts?page=2&sort=new#comments');

console.log(url.protocol); // "https:"
console.log(url.hostname); // "example.com"
console.log(url.port); // "8080"
console.log(url.pathname); // "/blog/posts"
console.log(url.searchParams.get('page')); // "2"
console.log(url.hash); // "#comments"

// Build query strings safely instead of concatenating text.
const search = new URL('https://api.example.com/search');
search.searchParams.set('q', 'react hooks & state');
console.log(search.toString()); // https://api.example.com/search?q=react+hooks+%26+state
```

<!-- link: MDN: How the web works | https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works | A short illustrated overview of clients, servers and HTTP -->

<!-- link: MDN: An overview of HTTP | https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview -->

<!-- lesson: Document Structure and Semantic Tags -->

## The HTML skeleton

Every page starts with the same skeleton: a `<!DOCTYPE html>` declaration, an `<html lang="en">` root, a `<head>` for metadata (title, character set, viewport, stylesheets) and a `<body>` for visible content.

## Semantic elements

Semantic elements describe *what content is*, not how it looks. Browsers, search engines and screen readers use them to understand the page.

- `<header>`: introductory content or navigation for the page or a section
- `<nav>`: a block of navigation links
- `<main>`: the main content; use it once per page
- `<article>`: a self-contained piece, such as a blog post or product card
- `<section>`: a themed group of content, usually with a heading
- `<aside>`: related but secondary content
- `<footer>`: closing information such as copyright and contact links

Prefer these over anonymous `<div>`s whenever one fits.

## Headings, links and images

- Use **one `<h1>`** per page, then `<h2>`–`<h6>` in order. Never skip levels to get a smaller font; use CSS for that.
- Links use `<a href="...">` with text that makes sense on its own. "Read the pricing guide" is better than "click here".
- Images need an `alt` attribute that describes their purpose. Purely decorative images get an empty `alt=""` so screen readers skip them.

**Check your work** with the W3C validator: it catches unclosed tags and invalid nesting.

<!-- code: html | A semantic page skeleton -->
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Asha's Blog</title>
  </head>
  <body>
    <header>
      <nav aria-label="Main">
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <article>
        <h1>Learning semantic HTML</h1>
        <p>Published <time datetime="2026-10-14">14 October 2026</time></p>
        <img src="/images/tags.png" alt="Diagram of header, main and footer areas" />
        <p>Semantic tags make pages easier to read for people and machines.</p>
      </article>
    </main>
    <footer>
      <p>&copy; 2026 Asha</p>
    </footer>
  </body>
</html>
```

<!-- link: MDN: HTML elements reference | https://developer.mozilla.org/en-US/docs/Web/HTML/Element -->

<!-- lesson: Forms and Accessibility -->

## Building forms

A form groups inputs and sends them somewhere. Every input needs a **`<label>`** connected with `for` and `id`; clicking the label focuses the input, and screen readers announce it.

Useful input types give users the right keyboard and free validation: `email`, `password`, `number`, `date`, `tel`, `url`, `checkbox` and `radio`. Use `<select>` for a fixed list of options and `<textarea>` for longer text. Group related controls with `<fieldset>` and `<legend>`.

## Built-in validation

HTML can validate before any JavaScript runs:

- `required`: the field can't be empty
- `minlength` / `maxlength`: text length
- `min` / `max` / `step`: numeric ranges
- `pattern`: a regular expression the value must match
- `type="email"` and `type="url"`: format checks

Client-side validation is a convenience for users. **Always validate again on the server**, because anyone can bypass the browser.

## Accessibility checklist

- Every input has a visible label.
- Error messages are text, not only a red border, and are linked with `aria-describedby`.
- The whole form works with the keyboard alone: Tab, Shift+Tab, Space and Enter.
- Placeholder text is a hint, never a replacement for a label.
- Colour contrast is at least 4.5:1 for normal text.

Run Lighthouse in Chrome DevTools to get an automated accessibility report, then test with the keyboard yourself.

<!-- code: html | An accessible sign-up form -->
```html
<form action="/signup" method="post" novalidate>
  <div>
    <label for="name">Full name</label>
    <input id="name" name="name" autocomplete="name" required minlength="2" />
  </div>

  <div>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="email" required
           aria-describedby="email-hint" />
    <p id="email-hint">We'll send your login link here.</p>
  </div>

  <fieldset>
    <legend>Preferred track</legend>
    <label><input type="radio" name="track" value="mern" checked /> MERN</label>
    <label><input type="radio" name="track" value="java" /> Java</label>
  </fieldset>

  <label>
    <input type="checkbox" name="terms" required /> I accept the terms
  </label>

  <button type="submit">Create account</button>
</form>
```

<!-- link: MDN: Your first form | https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Your_first_form -->

<!-- lesson: Selectors, the Cascade and the Box Model -->

## Selectors

A CSS rule is a selector plus declarations. The selectors you'll use most:

- Type: `p`, `h1`
- Class: `.card` (the workhorse of real projects)
- ID: `#main` (avoid for styling; IDs are hard to override)
- Attribute: `input[type="email"]`
- Pseudo-class: `a:hover`, `button:focus-visible`, `li:nth-child(odd)`
- Combinators: `.card p` (descendant), `.card > p` (direct child)

## The cascade and specificity

When several rules target the same element, the browser decides in this order:

1. **Importance**: `!important` wins (use it almost never).
2. **Specificity**: IDs beat classes, and classes beat element types. Count them as (IDs, classes, types): `#nav .link` is (1,1,0), `.nav a` is (0,1,1).
3. **Source order**: if specificity ties, the later rule wins.

Some properties, such as `color` and `font-family`, are *inherited* by children; layout properties such as `margin` are not.

## The box model

Every element is a box: **content**, then **padding**, then **border**, then **margin**. By default `width` sets only the content width, so padding and border make the box bigger. Almost every project starts with `box-sizing: border-box`, which makes `width` include padding and border.

Vertical margins between blocks *collapse*: two 20px margins become one 20px gap, not 40px.

<!-- code: css | A reset and a card component -->
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

.card {
  width: 320px; /* includes padding and border thanks to border-box */
  padding: 1rem 1.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-block: 1rem;
}

.card > h2 {
  margin-top: 0;
}

.card a:hover,
.card a:focus-visible {
  text-decoration: underline;
}
```

<!-- link: MDN: Specificity | https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity -->

<!-- lesson: Flexbox Layouts -->

## One dimension at a time

Flexbox lays items out along **one axis**: a row or a column. Add `display: flex` to a container and its direct children become flex items.

## The two axes

- The **main axis** follows `flex-direction` (`row` by default, or `column`).
- The **cross axis** runs perpendicular to it.

| Property | Axis | Common values |
| --- | --- | --- |
| `justify-content` | main | `flex-start`, `center`, `space-between`, `space-around` |
| `align-items` | cross | `stretch`, `center`, `flex-start`, `baseline` |
| `gap` | both | `1rem` |

## Sizing items

`flex` is shorthand for `flex-grow flex-shrink flex-basis`:

- `flex: 1` lets items share the free space equally.
- `flex: 0 0 200px` keeps an item at exactly 200px.
- `flex-wrap: wrap` lets items move to a new line instead of shrinking forever.

## Common patterns

- **Navigation bar:** a logo on the left and links on the right, with `justify-content: space-between`.
- **Centering:** `display: flex; justify-content: center; align-items: center;` centres anything.
- **Card rows:** `flex-wrap: wrap` with `flex: 1 1 250px` makes cards that wrap on small screens.

Use your browser's flexbox inspector (the "flex" badge in the Elements panel) to see the axes and free space.

<!-- code: css | Navbar and wrapping card row -->
```css
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
}

.navbar ul {
  display: flex;
  gap: 1.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.cards > .card {
  flex: 1 1 250px; /* grow, shrink, start at 250px */
}
```

<!-- link: CSS-Tricks: A complete guide to flexbox | https://css-tricks.com/snippets/css/a-guide-to-flexbox/ -->

<!-- lesson: CSS Grid Layouts -->

## Two dimensions

Grid controls **rows and columns at the same time**, which makes it ideal for page layouts and galleries. Flexbox is still best for a single row or column of items; real pages use both.

## Defining a grid

```css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 1.5rem;
}
```

- `fr` is a fraction of the remaining space: `1fr 2fr` gives the second column twice the space.
- `repeat(3, 1fr)` creates three equal columns.
- `minmax(200px, 1fr)` sets a minimum and maximum size.
- `repeat(auto-fill, minmax(200px, 1fr))` creates as many columns as fit, a responsive gallery with no media queries.

## Placing items

Items flow into cells automatically, but you can place them:

- by line numbers: `grid-column: 1 / 3` spans from line 1 to line 3
- with `span`: `grid-column: span 2`
- with named areas, defined by `grid-template-areas` on the container and `grid-area: header` on the item

Named areas read like a picture of the layout, which makes them easy to change in media queries.

## Grid + flexbox

Use grid for the page frame (header, sidebar, main, footer) and flexbox inside components (a navbar or a button group).

<!-- code: css | A page layout with named areas -->
```css
.page {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 220px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'header header'
    'sidebar main'
    'footer footer';
  gap: 1rem;
}

.page > header { grid-area: header; }
.page > aside { grid-area: sidebar; }
.page > main { grid-area: main; }
.page > footer { grid-area: footer; }

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}
```

<!-- link: MDN: Basic concepts of grid layout | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout -->

<!-- lesson: Responsive Design and Media Queries -->

## Mobile first

Write the base styles for small screens, then add `min-width` media queries as the screen grows. Phones get the simplest CSS, and larger layouts are layered on top.

Always include the viewport meta tag, or phones will render a zoomed-out desktop page:

`<meta name="viewport" content="width=device-width, initial-scale=1">`

## Media queries

```css
@media (min-width: 768px) {
  .layout { grid-template-columns: 240px 1fr; }
}
```

Pick breakpoints where *your content* breaks, not for specific devices. Common starting points are 640px, 768px and 1024px.

## Relative units

- `rem`: relative to the root font size; use it for spacing and type.
- `%` and `fr`: relative to the container.
- `vw` / `vh`: relative to the viewport.
- `clamp(min, preferred, max)`: fluid sizes with limits, such as `font-size: clamp(1.5rem, 4vw, 3rem)`.

## Responsive images

- `max-width: 100%; height: auto;` stops images overflowing their container.
- `srcset` and `sizes` let the browser download a smaller file on small screens.
- `<picture>` lets you switch formats or crops at breakpoints.

**Test** with the device toolbar in DevTools, and check a real phone at least once.

<!-- code: css | Mobile-first layout with fluid type -->
```css
img {
  max-width: 100%;
  height: auto;
}

.layout {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

h1 {
  font-size: clamp(1.75rem, 5vw, 3rem);
}

/* Tablets and up: add a sidebar. */
@media (min-width: 768px) {
  .layout {
    grid-template-columns: 220px 1fr;
    padding: 2rem;
  }
}

/* Wide screens: limit the line length. */
@media (min-width: 1200px) {
  .layout {
    max-width: 1140px;
    margin-inline: auto;
  }
}
```

<!-- link: web.dev: Learn responsive design | https://web.dev/learn/design -->

<!-- lesson: Variables, Types and Operators -->

## Declaring variables

- `const` for values that are never reassigned. Make this your default.
- `let` for values that change, such as counters or accumulators.
- Avoid `var`: it ignores block scope and is hoisted in confusing ways.

`const` stops reassignment, not mutation: a `const` array can still be pushed to.

## Primitive types

| Type | Examples |
| --- | --- |
| `string` | `'hello'`, template literals with `${name}` |
| `number` | `42`, `3.14`, `NaN`, `Infinity` |
| `bigint` | `9007199254740993n` |
| `boolean` | `true`, `false` |
| `undefined` | a declared variable with no value |
| `null` | an intentional "no value" |
| `symbol` | unique identifiers |

Everything else (arrays, functions, dates) is an **object**. Check types with `typeof`, and remember the historical quirk: `typeof null === 'object'`.

## Comparison and logic

- Always use **strict equality** (`===` and `!==`). Loose `==` converts types: `0 == ''` is `true`.
- `&&` and `||` return one of their operands, not just `true`/`false`.
- `??` (nullish coalescing) falls back only for `null` or `undefined`, so `0 ?? 10` is `0` while `0 || 10` is `10`.
- `?.` (optional chaining) stops safely at `null`: `user?.address?.city`.

## Truthy and falsy

The falsy values are `false`, `0`, `-0`, `0n`, `''`, `null`, `undefined` and `NaN`. Everything else is truthy, including `'0'`, `[]` and `{}`.

<!-- code: javascript | Types and operators in practice -->
```js
const name = 'Asha';
let score = 0;
score += 10;

console.log(`${name} scored ${score} points`); // Asha scored 10 points

console.log(typeof name); // "string"
console.log(typeof score); // "number"
console.log(typeof null); // "object" (a historical quirk)

console.log(0 == ''); // true  (type conversion!)
console.log(0 === ''); // false

const settings = { volume: 0 };
console.log(settings.volume || 50); // 50: 0 is falsy, probably a bug
console.log(settings.volume ?? 50); // 0: only null/undefined fall back

const user = { profile: null };
console.log(user.profile?.city ?? 'Unknown city'); // "Unknown city"
```

<!-- link: MDN: JavaScript data types and data structures | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures -->

<!-- lesson: Functions, Scope and Closures -->

## Three ways to write a function

- **Declaration:** `function add(a, b) { return a + b; }`. It is hoisted, so you can call it before the line where it's defined.
- **Expression:** `const add = function (a, b) { ... };`
- **Arrow function:** `const add = (a, b) => a + b;`. It's short, returns implicitly when there are no braces, and doesn't have its own `this`.

Parameters can have defaults (`function greet(name = 'friend')`), and rest parameters collect extra arguments (`function sum(...nums)`).

## Scope

Scope decides where a variable is visible.

- **Block scope:** `let` and `const` live inside the nearest `{ }`.
- **Function scope:** variables declared in a function are invisible outside it.
- **Lexical scope:** a function can read variables from the place where it was *written*, not where it is called.

## Closures

A closure is a function that remembers the variables of the scope it was created in, even after that scope has finished running. Closures power:

- private state (counters, caches)
- function factories (`makeMultiplier(3)`)
- event handlers and callbacks that remember context

A classic bug: using `var` in a loop with callbacks, so every callback sees the *final* value. `let` creates a fresh binding for each iteration and fixes it.

<!-- code: javascript | Closures for private state -->
```js
function createCounter(start = 0) {
  let count = start; // private: only the returned functions can reach it

  return {
    increment: () => ++count,
    decrement: () => --count,
    value: () => count,
  };
}

const counter = createCounter(5);
counter.increment();
counter.increment();
console.log(counter.value()); // 7
console.log(counter.count); // undefined: the variable isn't a property

// A function factory
const multiplyBy = (factor) => (n) => n * factor;
const triple = multiplyBy(3);
console.log(triple(4)); // 12

// let gives each loop iteration its own binding
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 0, 1, 2
}
```

<!-- link: MDN: Closures | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures -->

<!-- lesson: Arrays and Objects -->

## Arrays: transform, don't loop by hand

The array methods you'll use every day:

- `map(fn)`: transform every item into a new array of the same length
- `filter(fn)`: keep the items where `fn` returns true
- `find(fn)` / `findIndex(fn)`: the first match
- `some(fn)` / `every(fn)`: true or false questions
- `reduce(fn, initial)`: fold the array into a single value (a sum, an object, a map)
- `includes(value)`: membership check

`map`, `filter` and `reduce` return **new** values and leave the original untouched. `sort`, `reverse`, `push` and `splice` **mutate** the array; use `toSorted()` or copy first when you need the original.

## Objects

Objects store data as key-value pairs. Read with `obj.key` or `obj['some key']`, and loop over them with `Object.keys`, `Object.values` or `Object.entries`.

## Destructuring and spread

- `const { title, author: { name } } = post;` pulls values out of nested objects.
- `const [first, ...others] = list;` works the same way for arrays.
- `{ ...user, active: true }` makes a **shallow copy** with one field changed. This is the standard way to update state in React.
- `[...a, ...b]` merges arrays.

Shallow means nested objects are still shared. For a deep copy of plain data, use `structuredClone(value)`.

<!-- code: javascript | Working with a list of orders -->
```js
const orders = [
  { id: 1, customer: 'Asha', total: 1200, status: 'paid' },
  { id: 2, customer: 'Ravi', total: 450, status: 'pending' },
  { id: 3, customer: 'Asha', total: 300, status: 'paid' },
];

const paid = orders.filter((o) => o.status === 'paid');
const totals = paid.map((o) => o.total); // [1200, 300]
const revenue = totals.reduce((sum, t) => sum + t, 0); // 1500

// Group totals by customer with reduce
const byCustomer = orders.reduce((acc, { customer, total }) => {
  acc[customer] = (acc[customer] ?? 0) + total;
  return acc;
}, {});
console.log(byCustomer); // { Asha: 1500, Ravi: 450 }

// Update immutably: copy, then change one field
const updated = orders.map((o) => (o.id === 2 ? { ...o, status: 'paid' } : o));
console.log(orders[1].status, updated[1].status); // "pending" "paid"
```

<!-- link: MDN: Array reference | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array -->

<!-- lesson: Classes, Prototypes and this -->

## Prototypes

Every JavaScript object has a hidden link to another object, its **prototype**. When you read a property that the object doesn't have, JavaScript looks it up along this *prototype chain*. That is how arrays get `map` and `filter`: they live on `Array.prototype`, and every array links to it.

## Classes

`class` is cleaner syntax over prototypes:

- `constructor()` runs when you call `new`.
- Methods are shared through the prototype, so they aren't copied into every instance.
- `extends` sets up inheritance, and `super()` calls the parent constructor.
- `static` members belong to the class itself, such as `User.fromJSON(...)`.
- `#private` fields can only be used inside the class.

## What is `this`?

`this` is decided by **how a function is called**, not where it's written:

| Call | `this` |
| --- | --- |
| `obj.method()` | `obj` |
| `fn()` (plain call, strict mode) | `undefined` |
| `new Fn()` | the new object |
| `fn.call(x)` / `fn.bind(x)` | `x` |
| arrow function | `this` of the surrounding scope |

The most common bug is passing a method as a callback, such as `button.addEventListener('click', obj.method)`, and losing `this`. Fix it with an arrow function (`() => obj.method()`) or `bind`.

<!-- code: javascript | A class hierarchy with private fields -->
```js
class Account {
  #balance = 0; // private field

  constructor(owner) {
    this.owner = owner;
  }

  deposit(amount) {
    if (amount <= 0) throw new Error('Deposit must be positive');
    this.#balance += amount;
    return this; // allows chaining
  }

  get balance() {
    return this.#balance;
  }
}

class SavingsAccount extends Account {
  constructor(owner, rate) {
    super(owner);
    this.rate = rate;
  }

  addInterest() {
    return this.deposit(this.balance * this.rate);
  }
}

const savings = new SavingsAccount('Asha', 0.05).deposit(1000).addInterest();
console.log(savings.balance); // 1050
console.log(Object.getPrototypeOf(savings) === SavingsAccount.prototype); // true

const { deposit } = savings;
// deposit(10); // TypeError: `this` is undefined when called on its own
```

<!-- link: MDN: Classes | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes -->

<!-- lesson: Selecting and Updating the DOM -->

## The DOM

When the browser parses HTML it builds the **Document Object Model**: a tree of objects that JavaScript can read and change. Change the tree, and the page updates.

## Selecting elements

- `document.querySelector('.card')`: the first match for any CSS selector, or `null`
- `document.querySelectorAll('li')`: a static `NodeList` of all matches; loop over it with `forEach`
- `element.closest('.card')`: walks *up* to the nearest matching ancestor

## Reading and changing content

- `textContent`: plain text. **Use it for anything a user typed**, because it can't run code.
- `innerHTML`: parses HTML. Never put untrusted input in it; that's how cross-site scripting (XSS) happens.
- Attributes: `getAttribute`, `setAttribute`, or properties like `img.src` and `input.value`.
- Data attributes: `<li data-id="7">` is read as `li.dataset.id`.

## Creating and removing elements

`document.createElement('li')`, set its content, then insert it with `append`, `prepend`, `before` or `after`. Remove it with `element.remove()`.

## Styling from JavaScript

Prefer toggling classes over setting inline styles: `element.classList.add('active')`, `remove`, and `toggle('open', condition)`. Your styles stay in CSS, and JavaScript only changes state.

<!-- code: javascript | Rendering a list safely -->
```js
const tasks = [
  { id: 1, title: 'Learn the DOM', done: true },
  { id: 2, title: 'Build a to-do list', done: false },
];

const list = document.querySelector('#task-list');

function renderTasks() {
  list.replaceChildren(); // clear the old items

  for (const task of tasks) {
    const item = document.createElement('li');
    item.textContent = task.title; // safe: never parsed as HTML
    item.dataset.id = task.id;
    item.classList.toggle('done', task.done);
    list.append(item);
  }

  document.querySelector('#count').textContent = `${tasks.length} tasks`;
}

renderTasks();
```

<!-- link: MDN: Introduction to the DOM | https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction -->

<!-- lesson: Events and Event Delegation -->

## Listening for events

`element.addEventListener('click', handler)` runs `handler` every time the event fires. Common events: `click`, `input` (every keystroke), `change`, `submit`, `keydown`, `focus`/`blur`, and `DOMContentLoaded`.

The handler receives an **event object**:

- `event.target`: the element where the event started
- `event.currentTarget`: the element the listener is attached to
- `event.preventDefault()`: stops the browser's default action, such as a form reloading the page
- `event.key`: which key was pressed

Remove a listener with `removeEventListener` and the *same* function reference, or pass `{ once: true }` to run it only once.

## Bubbling

Most events **bubble**: after firing on the target, they travel up through every ancestor to `document`. That's why a click on a `<span>` inside a button also counts as a click on the button.

## Event delegation

Instead of attaching a listener to every list item, including items added later, attach **one** listener to the parent and check `event.target`:

1. Listen on the container.
2. Use `event.target.closest('selector')` to find the item that was clicked.
3. Ignore clicks that don't match.

Delegation uses less memory, and it works automatically for elements created after the listener was added.

<!-- code: javascript | Delegated clicks and a form submit -->
```js
const list = document.querySelector('#task-list');
const form = document.querySelector('#task-form');

// One listener handles every current and future delete button.
list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;
  button.closest('li').remove();
});

form.addEventListener('submit', (event) => {
  event.preventDefault(); // don't reload the page
  const input = form.elements.title;
  const title = input.value.trim();
  if (!title) return;

  const item = document.createElement('li');
  item.textContent = title;
  const remove = document.createElement('button');
  remove.textContent = 'Delete';
  remove.dataset.action = 'delete';
  item.append(' ', remove);
  list.append(item);

  form.reset();
  input.focus();
});
```

<!-- link: MDN: Introduction to events | https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events -->

<!-- lesson: Promises and Async/Await -->

## Why asynchronous code?

JavaScript runs on a single thread. Slow work such as network requests, timers and file access is handed off, and your code continues. When the work finishes, a callback is queued, and the **event loop** runs it once the call stack is empty. That's why `setTimeout(fn, 0)` still runs *after* the current code.

## Promises

A promise represents a value that will arrive later. It is *pending*, then either *fulfilled* with a value or *rejected* with an error.

- `.then(fn)` runs on success and returns a new promise, so calls can be chained.
- `.catch(fn)` handles any error earlier in the chain.
- `.finally(fn)` runs either way, which suits hiding spinners.

## Async/await

`async` functions always return a promise. Inside them, `await` pauses until a promise settles, so the code reads top to bottom. Wrap awaits in `try/catch` to handle errors.

## Running things in parallel

Awaiting in sequence is slow when the tasks are independent:

- `Promise.all([...])` waits for all of them and fails fast if one rejects.
- `Promise.allSettled([...])` waits for all and reports each result.
- `Promise.race` / `Promise.any` settle with the first result.

A common mistake is forgetting `await`: you get a pending promise instead of the value.

<!-- code: javascript | Sequential vs parallel awaits -->
```js
const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function sequential() {
  const a = await wait(500, 'profile');
  const b = await wait(500, 'courses'); // starts only after the first: ~1000 ms
  return [a, b];
}

async function parallel() {
  // Both timers start immediately: ~500 ms in total.
  return Promise.all([wait(500, 'profile'), wait(500, 'courses')]);
}

async function main() {
  console.time('parallel');
  try {
    const [profile, courses] = await parallel();
    console.log(profile, courses);
  } catch (error) {
    console.error('Something failed:', error.message);
  } finally {
    console.timeEnd('parallel');
  }
}

main();
console.log('This line runs first, while the timers are pending');
```

<!-- link: javascript.info: Promises, async/await | https://javascript.info/async -->

<!-- lesson: Fetching Data from APIs -->

## The Fetch API

`fetch(url, options)` returns a promise for a `Response`. Two things surprise everyone at first:

1. `fetch` **only rejects on network failures**. A `404` or `500` still resolves, so check `response.ok` (true for status 200–299) yourself.
2. The body is read separately, with `await response.json()` (or `.text()`), which also returns a promise.

## Sending data

For a POST with JSON, set the method, a `Content-Type` header and a stringified body:

```js
fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Read chapter 4' }),
});
```

## Three UI states

Every request has three states your UI must show:

- **Loading:** disable the button and show a spinner.
- **Success:** render the data, or an empty state if there is none.
- **Error:** show a helpful message and a way to retry.

## Avoiding race conditions

If the user types quickly in a search box, responses can arrive out of order. Cancel stale requests with an `AbortController`, and ignore the `AbortError` it causes.

<!-- code: javascript | A small fetch helper with error handling -->
```js
async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed with status ${response.status}`);
  }
  return data;
}

let controller;
async function search(term) {
  controller?.abort(); // cancel the previous search
  controller = new AbortController();
  try {
    const results = await request(`/api/courses?q=${encodeURIComponent(term)}`, {
      signal: controller.signal,
    });
    console.log(results);
  } catch (error) {
    if (error.name !== 'AbortError') console.error(error.message);
  }
}
```

<!-- link: MDN: Using the Fetch API | https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch -->

<!-- lesson: Version Control with Git -->

## Why Git?

Git records snapshots of your project called **commits**. With them you can see what changed, when and why, go back to any earlier version, and work on several things at once without losing anything.

## The three areas

1. **Working directory:** the files you edit.
2. **Staging area (index):** the changes you've selected for the next commit, using `git add`.
3. **Repository:** the history of commits, created with `git commit`.

Staging lets you commit related changes together, even if you edited several things at once.

## Everyday commands

- `git status`: what changed, and what's staged
- `git diff`: unstaged changes; `git diff --staged` shows staged ones
- `git log --oneline --graph`: compact history
- `git show <commit>`: what one commit changed

## Undoing safely

| Situation | Command |
| --- | --- |
| Discard edits to a file | `git restore file.js` |
| Unstage a file | `git restore --staged file.js` |
| Fix the last commit message (not pushed yet) | `git commit --amend` |
| Undo a pushed commit | `git revert <commit>`: a new commit that reverses it |

Avoid `git reset --hard` on shared history. `revert` keeps history honest.

## .gitignore

List files that must never be committed: `node_modules/`, build output, and especially `.env` files with secrets.

<!-- code: bash | A first repository -->
```bash
mkdir portfolio && cd portfolio
git init

echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "# My portfolio" > README.md

git add README.md .gitignore
git commit -m "Initial commit with README and .gitignore"

# Edit a file, then look before you commit
git status
git diff
git add -p          # stage changes chunk by chunk
git commit -m "Add contact section"

git log --oneline --graph
```

<!-- link: Pro Git book (free) | https://git-scm.com/book/en/v2 -->

<!-- lesson: Branching and Merging -->

## Branches are cheap

A branch is just a movable pointer to a commit. Creating one is instant, so create a branch for every feature or fix and keep `main` always working.

- `git switch -c feature/login` creates a branch and switches to it.
- `git switch main` goes back.
- `git branch` lists branches; `git branch -d name` deletes a merged one.

## Merging

`git merge feature/login` (run while on `main`) brings the feature's commits in:

- **Fast-forward:** if `main` hasn't moved, Git just moves the pointer.
- **Merge commit:** if both branches have new commits, Git creates a commit with two parents.

## Merge conflicts

A conflict happens when both branches change the same lines. Git marks the file:

```text
<<<<<<< HEAD
const title = 'Dashboard';
=======
const title = 'My Dashboard';
>>>>>>> feature/rename
```

To resolve it: edit the file to the correct final version, delete the markers, then `git add` the file and `git commit`. Your editor's merge view makes this easier. Run the tests before committing the merge.

## A simple workflow

1. Update `main`: `git switch main && git pull`.
2. Branch: `git switch -c feature/x`.
3. Commit in small, logical steps.
4. Push and open a pull request.
5. After review, merge and delete the branch.

<!-- code: bash | Feature branch from start to finish -->
```bash
git switch main
git pull

git switch -c feature/dark-mode
# ...edit files...
git add -A
git commit -m "Add dark mode toggle"

# Meanwhile main moved on. Bring its changes into the branch:
git switch main && git pull
git switch feature/dark-mode
git merge main            # resolve any conflicts, then:
git add -A && git commit  # completes the merge if there were conflicts

git switch main
git merge --no-ff feature/dark-mode -m "Merge dark mode"
git branch -d feature/dark-mode
```

<!-- link: Learn Git Branching (interactive) | https://learngitbranching.js.org/ -->

<!-- lesson: Collaborating on GitHub -->

## Remotes

A **remote** is a copy of the repository hosted elsewhere, usually called `origin`. `git push` uploads your commits and `git pull` downloads and merges others' commits. `git clone <url>` copies a repository and sets up `origin` for you.

## Pull requests

A pull request (PR) asks for a branch to be merged, and gives the team a place to review it:

1. Push your branch: `git push -u origin feature/x`.
2. Open a PR on GitHub with a clear title and description: *what* changed, *why*, and *how to test it*.
3. Reviewers comment on lines, ask questions and approve.
4. Push more commits to the same branch to address feedback; the PR updates automatically.
5. Merge, then delete the branch.

## Good commit messages

- A short summary line in the imperative mood: "Add login form validation", not "fixed stuff".
- Optionally a blank line and a body explaining *why*.
- One logical change per commit.

## A useful README

Your README is the front page of the project. Include what the project does, a screenshot or live link, how to install and run it, the environment variables it needs, and the tech stack. Recruiters read READMEs.

## Reviewing others' code

Be specific and kind. Ask questions ("What happens if the list is empty?") rather than giving orders, and point out what's done well too.

<!-- code: bash | Publishing a project and opening a PR -->
```bash
# Create an empty repository on GitHub first, then:
git remote add origin https://github.com/<you>/task-manager.git
git branch -M main
git push -u origin main

# Work on a feature
git switch -c feature/filters
git commit -am "Add status filter to the task list"
git push -u origin feature/filters
# GitHub prints a link to open the pull request

# After the PR is merged
git switch main
git pull
git branch -d feature/filters
```

<!-- link: GitHub Docs: About pull requests | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests -->

<!-- lesson: Components, JSX and Props -->

## Thinking in components

A React app is a tree of **components**: functions that return UI. Split the screen into pieces with one job each, such as `Header`, `CourseList` and `CourseCard`, and compose them.

## JSX

JSX looks like HTML but is JavaScript:

- Use `className` instead of `class`, and `htmlFor` instead of `for`.
- Put any expression in `{ }`: `{user.name}`, `{price * 2}`.
- A component must return a single root element; use a fragment `<>...</>` to group siblings without an extra `div`.
- Component names start with a capital letter.

## Props

Props pass data **down** from parent to child, like function arguments. They are read-only: a child never changes its props. Destructure them in the parameter list: `function CourseCard({ title, level })`. The special `children` prop holds whatever is nested inside the component's tags.

## Lists and keys

Render lists with `map`, and give each item a stable, unique `key`, usually a database id. React uses keys to track items between renders. Avoid array indexes as keys when items can be added, removed or reordered.

## Conditional rendering

- `{isLoading && <Spinner />}` renders only when true.
- `{user ? <Profile /> : <Login />}` chooses between two.
- Return `null` to render nothing.

Watch out for `{count && <Badge />}`: when `count` is `0`, React renders "0". Use `count > 0 &&` instead.

<!-- code: jsx | Course cards with props, lists and conditions -->
```jsx
function LevelBadge({ level }) {
  const colors = { beginner: 'green', intermediate: 'orange', advanced: 'red' };
  return <span style={{ color: colors[level] }}>{level}</span>;
}

function CourseCard({ title, level, lessonCount, children }) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <LevelBadge level={level} />
      {lessonCount > 0 ? <p>{lessonCount} lessons</p> : <p>Coming soon</p>}
      {children}
    </article>
  );
}

export function CourseList({ courses }) {
  if (courses.length === 0) return <p>No courses yet.</p>;

  return (
    <section>
      {courses.map((course) => (
        <CourseCard key={course.id} {...course}>
          <a href={`/courses/${course.id}`}>View roadmap</a>
        </CourseCard>
      ))}
    </section>
  );
}
```

<!-- link: React: Your first component | https://react.dev/learn/your-first-component -->

<!-- lesson: State and Effects with Hooks -->

## State with useState

State is data that changes over time and should update the screen. `const [value, setValue] = useState(initial)` gives you the current value and a setter. Calling the setter schedules a re-render.

Rules of thumb:

- **Never mutate state** (`items.push(x)`). Create a new value: `setItems([...items, x])`.
- When the next value depends on the previous one, use the updater form: `setCount((c) => c + 1)`.
- Don't store what you can compute. A filtered list can be derived during render.

## Effects with useEffect

Effects synchronise a component with something *outside* React: fetching data, subscriptions, timers, or the document title.

```jsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id); // cleanup
}, []); // dependency array
```

- The dependency array lists every value from the component that the effect uses. The effect re-runs when one of them changes.
- `[]` means "run once after mounting".
- Return a **cleanup** function to undo the effect (cancel requests, remove listeners).
- In development, React Strict Mode runs effects twice on purpose to reveal missing cleanups.

## Lifting state up

When two components need the same data, move the state to their closest common parent, and pass the value and a setter down as props.

<!-- code: jsx | Fetching data in an effect with cleanup -->
```jsx
import { useEffect, useState } from 'react';

export function CourseSearch() {
  const [query, setQuery] = useState('');
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/courses?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Request failed'))))
      .then((data) => {
        setCourses(data);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort(); // cancel when the query changes
  }, [query]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
      {error && <p role="alert">{error}</p>}
      <ul>
        {courses.map((c) => (
          <li key={c.id}>{c.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

<!-- link: React: Synchronizing with effects | https://react.dev/learn/synchronizing-with-effects -->

<!-- lesson: Forms and Controlled Inputs -->

## Controlled inputs

In a **controlled** input, React state is the single source of truth: the input shows `value={state}` and every keystroke calls `onChange` to update that state. You can then validate, transform or reset the value at any time.

For many fields, keep one state object and update it by the input's `name`:

```jsx
const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
```

Checkboxes use `checked` and `e.target.checked` instead of `value`.

## Validation

- Validate on submit, and optionally when a field loses focus. Don't shout at users on the very first keystroke.
- Keep errors in state, keyed by field name, and show each message next to its field.
- Connect messages to inputs with `aria-describedby`, and mark invalid fields with `aria-invalid`.
- Validate again on the server, and show server errors in the form too.

## Submitting

1. Call `event.preventDefault()` in `onSubmit`.
2. Validate; stop if there are errors.
3. Disable the submit button while the request runs, to prevent double submits.
4. On success, reset the form or navigate away. On failure, show the error.

For large forms, libraries such as **react-hook-form** with **zod** schemas remove most of this boilerplate. Learn the manual version first so you know what they do.

<!-- code: jsx | A validated sign-up form -->
```jsx
import { useState } from 'react';

const initial = { name: '', email: '' };

function validate({ name, email }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email';
  return errors;
}

export function SignupForm({ onSubmit }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm(initial);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" value={form.name} onChange={handleChange}
             aria-invalid={Boolean(errors.name)} aria-describedby="name-error" />
      {errors.name && <p id="name-error">{errors.name}</p>}

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" value={form.email} onChange={handleChange}
             aria-invalid={Boolean(errors.email)} aria-describedby="email-error" />
      {errors.email && <p id="email-error">{errors.email}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create account'}
      </button>
    </form>
  );
}
```

<!-- link: React: Reacting to input with state | https://react.dev/learn/reacting-to-input-with-state -->

<!-- lesson: Routing with React Router -->

## Client-side routing

A single-page app loads one HTML file. A router maps the **URL** to components, so users can bookmark pages, use the back button and share links, all without full page reloads.

## Defining routes

With React Router you describe routes as a tree. Child routes render inside their parent's `<Outlet />`, which makes shared layouts such as a dashboard with a sidebar easy.

- `path: 'courses/:courseId'` declares a **URL parameter**.
- `index: true` is the default child of a parent route.
- `path: '*'` catches everything else, for a 404 page.

## Navigating

- `<Link to="/courses">` for links; `<NavLink>` also knows when it's active.
- `useNavigate()` for navigating in code, such as after a form submits.
- `useParams()` reads URL parameters; `useSearchParams()` reads and writes the query string, which is handy for filters and pagination.

## Protected routes

Wrap private pages in a guard component that checks the signed-in user. If there is no user, it redirects to `/login` and remembers where the user was going.

Remember that route guards are **only UX**. A user can still call your API directly, so the server must check permissions on every request.

<!-- code: jsx | Routes with a layout and a guard -->
```jsx
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { useAuth } from './useAuth.js';

function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function DashboardLayout() {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'courses', element: <CourseList /> },
          { path: 'courses/:courseId', element: <CourseDetail /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]);

export const App = () => <RouterProvider router={router} />;
```

<!-- link: React Router documentation | https://reactrouter.com/home -->

<!-- lesson: Global State with Context -->

## Prop drilling

When a deeply nested component needs data from the top, passing it through every layer of props, even layers that don't use it, gets tedious. That is **prop drilling**.

## Context

Context lets a parent make a value available to every component below it:

1. `const ThemeContext = createContext(defaultValue)`
2. Wrap part of the tree: `<ThemeContext.Provider value={...}>`
3. Read it anywhere below with `useContext(ThemeContext)`

Wrap the reading in a custom hook such as `useTheme()`. It hides the context object and can throw a helpful error if the provider is missing.

## Context + useReducer

For state with several related actions (add, remove, toggle), `useReducer` keeps the update logic in one pure function. Provide `state` and `dispatch` through context, and any component can trigger updates.

## When is it worth it?

Good candidates: the signed-in user, theme, language, and a shopping cart. Poor candidates: data that only two nearby components share (lift state up instead), and server data (use a data-fetching library such as TanStack Query, which handles caching and refetching for you).

**Performance:** every consumer re-renders when the provided value changes. Memoise the value with `useMemo`, and split unrelated data into separate contexts.

<!-- code: jsx | A cart with context and a reducer -->
```jsx
import { createContext, useContext, useMemo, useReducer } from 'react';

const CartContext = createContext(null);

function cartReducer(items, action) {
  switch (action.type) {
    case 'add': {
      const existing = items.find((i) => i.id === action.item.id);
      return existing
        ? items.map((i) => (i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i))
        : [...items, { ...action.item, qty: 1 }];
    }
    case 'remove':
      return items.filter((i) => i.id !== action.id);
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const value = useMemo(() => ({ items, dispatch }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart must be used inside <CartProvider>');
  return cart;
}

// Anywhere below the provider:
// const { items, dispatch } = useCart();
// dispatch({ type: 'add', item: { id: 1, name: 'Notebook', price: 99 } });
```

<!-- link: React: Passing data deeply with context | https://react.dev/learn/passing-data-deeply-with-context -->

<!-- lesson: Node.js Runtime and Modules -->

## What is Node.js?

Node.js runs JavaScript **outside the browser**, on Google's V8 engine. There is no `window` or `document`. Instead you get APIs for files, networking, processes and the operating system. Node is great at I/O-heavy work such as web servers, because slow operations are non-blocking: while one request waits for the database, Node serves others.

## Modules

Modern Node uses **ES modules**:

- `import express from 'express'` and `export function x() {}`
- Enable them with `"type": "module"` in `package.json`, or use the `.mjs` extension.
- Built-in modules use the `node:` prefix: `import fs from 'node:fs/promises'`.

You'll still see older CommonJS code (`require` and `module.exports`), so learn to read both.

## npm

- `npm init -y` creates `package.json`.
- `npm install express` adds a dependency; `npm install -D vitest` adds a development-only one.
- `package-lock.json` pins exact versions. Commit it.
- `scripts` in `package.json` define commands: `npm run dev`.

## Files and environment

- `fs/promises` gives promise-based file functions: `readFile`, `writeFile`, `mkdir`.
- `process.env` holds environment variables, and `process.argv` holds command-line arguments.
- Node 20.6+ can load a `.env` file with `node --env-file=.env app.js`.

<!-- code: javascript | A small CLI that counts words in a file -->
```js
// wordcount.js: run with `node wordcount.js notes.txt`
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node wordcount.js <file>');
  process.exit(1);
}

try {
  const text = await readFile(path.resolve(file), 'utf8');
  const words = text.split(/\s+/).filter(Boolean);
  const counts = new Map();
  for (const word of words) {
    const key = word.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);

  console.log(`${words.length} words in ${path.basename(file)}`);
  console.table(top.map(([word, count]) => ({ word, count })));
} catch (error) {
  console.error(`Could not read ${file}: ${error.message}`);
  process.exit(1);
}
```

<!-- link: Node.js: Introduction | https://nodejs.org/en/learn/getting-started/introduction-to-nodejs -->

<!-- lesson: Building a Server with Express -->

## Express in one paragraph

Express is a minimal web framework for Node. You create an `app`, register **routes** (a method plus a path plus a handler), and start listening on a port. Each handler receives `req` (the request) and `res` (the response).

## Reading the request

- `req.params`: route parameters, so `/tasks/:id` gives `req.params.id`
- `req.query`: the query string, so `?status=done` gives `req.query.status`
- `req.body`: the parsed body. It needs `app.use(express.json())` for JSON.
- `req.headers` / `req.get('Authorization')`: headers

Everything from the request is a **string** (or user-controlled data) until you validate and convert it.

## Sending the response

- `res.json(data)` sends JSON with status 200.
- `res.status(201).json(created)` for a created resource.
- `res.status(204).end()` for success with no body (for example after a delete).
- `res.status(404).json({ message: 'Task not found' })` for errors.

Send exactly one response per request. Forgetting `return` after an error response leads to "headers already sent" errors.

## Status codes to know

`200` OK, `201` Created, `204` No Content, `400` Bad Request, `401` Unauthenticated, `403` Forbidden, `404` Not Found, `409` Conflict, `500` Internal Server Error.

<!-- code: javascript | An in-memory tasks API -->
```js
import express from 'express';

const app = express();
app.use(express.json());

let nextId = 3;
const tasks = [
  { id: 1, title: 'Install Node', done: true },
  { id: 2, title: 'Build an API', done: false },
];

app.get('/api/tasks', (req, res) => {
  const { done } = req.query;
  const result = done === undefined ? tasks : tasks.filter((t) => String(t.done) === done);
  res.json(result);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const title = String(req.body.title ?? '').trim();
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const task = { id: nextId++, title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.listen(5000, () => console.log('API on http://localhost:5000'));
```

<!-- link: Express: Getting started | https://expressjs.com/en/starter/hello-world.html -->

<!-- lesson: Middleware and Error Handling -->

## Middleware

Middleware are functions that run **between** receiving a request and sending a response: `(req, res, next) => { ... }`. Each one can read or change `req` and `res`, end the response, or call `next()` to pass control on. They run **in the order they're registered**, which matters.

Common middleware:

- `express.json()`: parses JSON bodies
- logging, such as `pino-http` or `morgan`
- `cors()` and `helmet()` for security headers
- authentication: checks a token and sets `req.user`
- validation: checks `req.body` before the handler runs

Middleware can be global (`app.use(fn)`), for one router, or for a single route (`app.get('/x', auth, handler)`).

## Centralised error handling

An error middleware has **four** parameters: `(err, req, res, next)`. Register it after all routes. Then any route can `throw` (Express 5 forwards rejected promises from async handlers automatically) or call `next(err)`, and one place turns the error into a consistent JSON response.

Create an error class with a status code, so handlers can throw `new ApiError(404, 'Task not found')`. Log unexpected errors, but never send stack traces to clients in production.

## Organising code

Keep **routes** (URLs), **controllers** (read the request, send the response) and **services** (business rules and database calls) in separate files. Services stay testable, and controllers stay thin.

<!-- code: javascript | Request logging, an auth guard and an error handler -->
```js
import express from 'express';

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const app = express();
app.use(express.json());

// Runs for every request, in registration order.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`));
  next();
});

function requireApiKey(req, res, next) {
  if (req.get('x-api-key') !== process.env.API_KEY) throw new ApiError(401, 'Missing or wrong API key');
  next();
}

app.get('/api/reports', requireApiKey, async (req, res) => {
  const report = await buildReport(); // a rejected promise reaches the error handler
  res.json(report);
});

// 404 for unknown routes, then the error handler (four arguments!)
app.use((req, res, next) => next(new ApiError(404, `No route for ${req.method} ${req.path}`)));
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Something went wrong' : err.message });
});
```

<!-- link: Express: Using middleware | https://expressjs.com/en/guide/using-middleware.html -->

<!-- lesson: Designing RESTful APIs -->

## Resources and URLs

REST models your API as **resources** (nouns) and uses HTTP methods as the verbs:

| Action | Method and path |
| --- | --- |
| List tasks | `GET /api/tasks` |
| Read one | `GET /api/tasks/42` |
| Create | `POST /api/tasks` |
| Replace | `PUT /api/tasks/42` |
| Update some fields | `PATCH /api/tasks/42` |
| Delete | `DELETE /api/tasks/42` |

Use plural nouns, lowercase, and nest only for clear ownership (`/api/projects/7/tasks`). Avoid verbs in URLs, such as `/getTasks`.

## Consistent responses

Pick one response shape and use it everywhere, for example `{ success, data }` for success and `{ success: false, error: { code, message } }` for errors. Lists should support **pagination** (`?page=2&limit=20`), returning the total count, plus filtering (`?status=done`) and searching (`?q=react`).

## Validate everything on the server

Never trust the client. Check types, required fields, lengths and formats, and **strip fields the client must not set**, such as `role`, `isAdmin`, `createdBy` or `price`. A schema library like **zod** makes this declarative and gives you field-level error messages to return with status `400`.

## Idempotency

`GET`, `PUT` and `DELETE` are *idempotent*: repeating them has the same effect as doing them once. `POST` is not. Design retries with this in mind.

<!-- code: javascript | Validating a request body with zod -->
```js
import express from 'express';
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
}); // unknown keys such as `owner` or `role` are stripped

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details } });
    }
    req.body = result.data;
    next();
  };
}

const router = express.Router();
router.post('/tasks', validateBody(createTaskSchema), async (req, res) => {
  const task = await Task.create({ ...req.body, owner: req.user.id }); // owner from the token
  res.status(201).json({ success: true, data: task });
});
```

<!-- link: MDN: HTTP request methods | https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods -->

<!-- lesson: Password Hashing and JWT Authentication -->

## Never store passwords

Store a **hash**, never the password itself. Use a slow, salted algorithm designed for passwords, such as **bcrypt** (or argon2). Hashing is one-way: at login you hash the attempt and compare. Fast hashes like SHA-256 are the wrong tool, because attackers can try billions of guesses per second.

- Use a bcrypt cost factor of 10–12.
- bcrypt only uses the first 72 bytes of a password, so cap the length.
- Give the same error for "unknown email" and "wrong password", so attackers can't find out which accounts exist.

## JSON Web Tokens

A JWT is a signed token with three parts: header, payload and signature. The server signs `{ sub: userId, role }` with a secret. Clients send it back in the `Authorization: Bearer <token>` header, and the server verifies the signature and expiry on every request. No session lookup is needed.

Things to get right:

- The payload is **readable by anyone**; only the signature is secret. Never put passwords or personal data in it.
- Keep access tokens short-lived (about 15 minutes) and use a refresh mechanism.
- Keep the secret in an environment variable, and make it long and random.
- Store tokens carefully on the client. In-memory storage plus an httpOnly refresh cookie resists XSS better than `localStorage`.

## Auth middleware

Middleware reads the header, verifies the token, loads the user and sets `req.user`, or responds with `401`.

<!-- code: javascript | Register, login and an auth middleware -->
```js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

export async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({ name, email, passwordHash }); // never store `password`
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) throw new ApiError(401, 'Invalid email or password'); // same message either way
  const token = jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '15m' });
  return { token, user: { id: user.id, name: user.name } };
}

export async function authenticate(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ message: 'Sign in first' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ message: 'Account not found' });
    next();
  } catch {
    res.status(401).json({ message: 'Session expired' });
  }
}
```

<!-- link: OWASP: Password storage cheat sheet | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html -->

<!-- lesson: Authorization and API Security -->

## Authentication vs authorization

- **Authentication**: *who are you?* This is a valid token, and it answers `401` when it fails.
- **Authorization**: *are you allowed to do this?* This is roles and ownership, and it answers `403` (or `404`, to hide that a resource exists).

## Role-based access control

Store the role on the user record (`student`, `admin`), and check it in middleware: `requireRole('admin')`. Read the role from the **database**, not just the token, so demotions take effect immediately.

## Ownership checks

Most real bugs are ownership bugs: user A can read or edit user B's data by changing an id in the URL (called IDOR). Always scope queries to the signed-in user:

`Task.findOne({ _id: req.params.id, owner: req.user.id })`

Take ownership fields (`owner`, `role`, `createdBy`) from `req.user`, **never** from the request body.

## Hardening checklist

- **helmet** for security headers
- **CORS**: allow only your front-end's origin; never `*` with credentials
- **Rate limiting** on login and other expensive routes
- A body size limit: `express.json({ limit: '1mb' })`
- Validate and sanitise input, and avoid building database queries from raw objects (NoSQL injection)
- Never leak stack traces or internal errors to clients
- Keep dependencies updated (`npm audit`)

<!-- code: javascript | Roles and ownership in practice -->
```js
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(cors({ origin: ['https://app.example.com'], credentials: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }));

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to do this' });
  }
  next();
};

// Admins only
router.delete('/api/users/:id', authenticate, requireRole('admin'), deleteUser);

// Owners only: the filter itself enforces ownership
router.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const { title, done } = req.body; // pick allowed fields; ignore `owner`
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id },
    { title, done },
    { new: true, runValidators: true },
  );
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json(task);
});
```

<!-- link: OWASP API Security Top 10 | https://owasp.org/API-Security/ -->

<!-- lesson: Documents, Collections and Queries -->

## The document model

MongoDB stores **documents**: JSON-like objects (stored as BSON) grouped into **collections**. A document can hold nested objects and arrays, and documents in one collection don't need identical fields. Every document has a unique `_id`, an `ObjectId` by default.

## CRUD

| Operation | Methods |
| --- | --- |
| Create | `insertOne`, `insertMany` |
| Read | `find`, `findOne` |
| Update | `updateOne`, `updateMany` with operators like `$set`, `$inc`, `$push` |
| Delete | `deleteOne`, `deleteMany` |

Forgetting `$set` in an update is a classic mistake. In the raw driver, `updateOne` rejects a plain object without operators, and `replaceOne` replaces the whole document.

## Query operators

- Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`
- Logical: `$and`, `$or`, `$not`
- Elements and arrays: `$exists`, `$all`, `$elemMatch`
- Text matching: `$regex` (escape user input first!)

Fields in nested documents use dot notation: `{ 'address.city': 'Pune' }`.

## Sort, limit, paginate

`find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)` gives page-based pagination. Use **projection** to return only the fields you need: `find({}, { name: 1, email: 1 })`.

Practise in **mongosh** or MongoDB Compass before writing application code.

<!-- code: javascript | Queries in mongosh -->
```js
use school

db.students.insertMany([
  { name: 'Asha', age: 22, city: 'Pune', skills: ['react', 'node'] },
  { name: 'Ravi', age: 19, city: 'Delhi', skills: ['java'] },
  { name: 'Meera', age: 25, city: 'Pune', skills: ['react', 'mongodb'] },
]);

// Pune students aged 21 or older, newest first, names only
db.students.find(
  { city: 'Pune', age: { $gte: 21 } },
  { name: 1, _id: 0 },
).sort({ age: -1 });

// Anyone who knows react OR is under 20
db.students.find({ $or: [{ skills: 'react' }, { age: { $lt: 20 } }] });

// Update with operators
db.students.updateOne({ name: 'Ravi' }, { $set: { city: 'Mumbai' }, $push: { skills: 'spring' } });
db.students.updateMany({}, { $inc: { age: 1 } });

// Page 2 with 10 per page
db.students.find().sort({ name: 1 }).skip(10).limit(10);
```

<!-- link: MongoDB: CRUD operations | https://www.mongodb.com/docs/manual/crud/ -->

<!-- lesson: Schemas and Models with Mongoose -->

## Why Mongoose?

MongoDB doesn't enforce a structure, but your application needs one. **Mongoose** adds schemas, validation, defaults, type casting and a convenient model API on top of the driver.

## Schemas

A schema lists the fields with their types and rules:

- Types: `String`, `Number`, `Boolean`, `Date`, `ObjectId`, arrays and nested objects
- Validators: `required`, `min`/`max`, `minlength`/`maxlength`, `enum`, `match`, and custom `validate` functions
- Modifiers: `trim`, `lowercase`, `default`
- `select: false` hides a field (such as a password hash) unless it is requested explicitly
- `{ timestamps: true }` adds `createdAt` and `updatedAt` automatically

## Models

`mongoose.model('Task', taskSchema)` creates a model class tied to the `tasks` collection:

- `Task.create(data)`, `Task.find(filter)`, `Task.findById(id)`
- `Task.findByIdAndUpdate(id, changes, { new: true, runValidators: true })`. Updates **skip validation** unless you pass `runValidators`.
- `doc.save()` validates the whole document, and `doc.deleteOne()` removes it.

Add **instance methods** (such as `toPublicJSON()`) and **static methods** to keep data logic close to the data.

## Connecting

Call `mongoose.connect(process.env.MONGODB_URI)` once at startup, before the server listens, and handle connection errors by exiting with a clear message.

<!-- code: javascript | A Task model with validation -->
```js
import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 120 },
    status: { type: String, enum: ['todo', 'doing', 'done'], default: 'todo' },
    priority: { type: Number, min: 1, max: 5, default: 3 },
    tags: [{ type: String, lowercase: true, trim: true }],
    dueDate: Date,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

taskSchema.methods.isOverdue = function isOverdue() {
  return Boolean(this.dueDate) && this.status !== 'done' && this.dueDate < new Date();
};

export const Task = mongoose.model('Task', taskSchema);

// Usage
await mongoose.connect(process.env.MONGODB_URI);
const task = await Task.create({ title: '  Write tests ', owner: userId });
console.log(task.title); // "Write tests" (trimmed)

try {
  await Task.create({ owner: userId, status: 'blocked' });
} catch (error) {
  console.log(Object.keys(error.errors)); // [ 'title', 'status' ]
}
```

<!-- link: Mongoose: Schemas | https://mongoosejs.com/docs/guide.html -->

<!-- lesson: Relationships, Indexes and Aggregation -->

## Embed or reference?

- **Embed** data that is read together and owned by its parent, and that stays small: an order's line items, or an address.
- **Reference** (store an `ObjectId`) data that is shared, large, unbounded or queried on its own: a post's author, or a course's thousands of enrollments.

A good rule: if an array can grow without limit, use a reference. Documents have a 16 MB size limit.

## Populate

`Post.find().populate('author', 'name')` replaces the stored author id with the author document. It runs an extra query, so populate only the fields you need, and avoid populating inside loops.

## Indexes

Without an index, MongoDB scans every document. Add indexes for the fields you filter and sort on:

- `schema.index({ owner: 1, createdAt: -1 })`: a compound index, where order matters
- `{ unique: true }` enforces uniqueness, for example for emails
- TTL indexes delete documents automatically after a time

Check a query with `.explain('executionStats')`: you want `IXSCAN`, not `COLLSCAN`. Indexes speed up reads but slow writes slightly, so add the ones your queries actually use.

## Aggregation

An aggregation pipeline transforms documents in stages: `$match` (filter), `$group` (summarise), `$sort`, `$project` (reshape), `$lookup` (join) and `$limit`. Put `$match` first so it can use an index.

<!-- code: javascript | References, populate and an aggregation -->
```js
const postSchema = new mongoose.Schema(
  {
    title: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tags: [String],
    likes: { type: Number, default: 0 },
  },
  { timestamps: true },
);
postSchema.index({ author: 1, createdAt: -1 });
const Post = mongoose.model('Post', postSchema);

// Newest posts with only the author's name
const posts = await Post.find().sort({ createdAt: -1 }).limit(10).populate('author', 'name');

// Likes per tag, most popular first
const stats = await Post.aggregate([
  { $match: { createdAt: { $gte: new Date('2026-01-01') } } },
  { $unwind: '$tags' },
  { $group: { _id: '$tags', posts: { $sum: 1 }, likes: { $sum: '$likes' } } },
  { $sort: { likes: -1 } },
  { $limit: 5 },
  { $project: { _id: 0, tag: '$_id', posts: 1, likes: 1 } },
]);
```

<!-- link: MongoDB: Data modeling | https://www.mongodb.com/docs/manual/data-modeling/ -->

<!-- lesson: Connecting React to an Express API -->

## One app, two servers

In development, React runs on the Vite dev server (for example port 5173) and Express on another port (5000). The browser treats these as different origins, so you have two options:

1. **A dev proxy (recommended):** configure Vite to forward `/api` requests to Express. The browser only sees one origin, so you need no CORS setup, and cookies just work.
2. **CORS:** let the browser call the API's origin directly, and allow it on the server with the `cors` package.

With a proxy, your code calls relative URLs like `/api/tasks`, and the same code works in production behind a reverse proxy or rewrite.

## An API module

Don't scatter `fetch` calls across components. Put them in one module (`api.js`) that sets headers, attaches the auth token, parses JSON and turns error responses into thrown errors. Components then call `tasksApi.list()`.

## CRUD from the UI

- **Read:** fetch on mount, and show loading, empty and error states.
- **Create/update:** submit the form, then add the result to state or refetch the list.
- **Delete:** confirm first, then remove the item from state.
- **Optimistic updates:** update the UI immediately and roll back if the request fails. Use them for fast, low-risk actions such as toggling "done".

Data-fetching libraries such as **TanStack Query** handle caching, refetching and invalidation for you. They're worth adopting once you've done it by hand.

<!-- code: javascript | Vite proxy and an API module -->
```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:5000' } },
});

// src/api/tasks.js
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.message ?? 'Request failed');
  return body;
}

export const tasksApi = {
  list: () => request('/tasks'),
  create: (task) => request('/tasks', { method: 'POST', body: JSON.stringify(task) }),
  update: (id, changes) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  remove: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
};
```

<!-- link: Vite: Server proxy options | https://vite.dev/config/server-options#server-proxy -->

<!-- lesson: Project: Task Manager -->

## What you'll build

A task manager where each user signs up, signs in and manages **their own** tasks. It's small enough to finish, but it covers everything a real full-stack app needs.

## Plan before you code

**Models**

- `User`: name, email (unique), passwordHash
- `Task`: title, description, status (`todo`/`doing`/`done`), priority, dueDate, owner (ref User), timestamps

**Endpoints**

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/tasks?status=&q=&page=&limit=`
- `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`

**Screens:** login, register, a task list with filters, and a create/edit form.

## Requirements

1. Every task route requires authentication.
2. Users can only see and change their own tasks. Filter by `owner: req.user.id` in **every** query.
3. Validate input on both client and server.
4. The list supports filtering by status, searching by title, and pagination.
5. Show loading, empty and error states.

## Milestones

1. API with auth, tested with Postman or REST Client
2. Task CRUD API with ownership checks
3. React auth pages and a protected layout
4. Task list, then filters and pagination
5. Polish: confirm dialogs, toasts and a responsive layout
6. README with setup steps and screenshots

**Stretch goals:** drag-and-drop status columns, due-date reminders, dark mode.

<!-- code: javascript | The tasks list endpoint with filters and pagination -->
```js
router.get('/', authenticate, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 10);

  const filter = { owner: req.user.id }; // ownership first, always
  if (['todo', 'doing', 'done'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) {
    const escaped = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.title = { $regex: escaped, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Task.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Task.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
});
```

<!-- lesson: Project: Blog Platform -->

## What you'll build

A multi-user blog: anyone can read published posts, signed-in users write posts and comment, and only the **author** can edit or delete their own content.

## Data model

- `User`: name, email, passwordHash, bio
- `Post`: title, slug (unique), body (Markdown), status (`draft`/`published`), author (ref), tags, timestamps
- `Comment`: post (ref), author (ref), body, timestamps

Comments live in their own collection. A popular post could collect thousands of them, so they shouldn't be embedded.

## Authorization rules

| Action | Who |
| --- | --- |
| Read published posts and comments | everyone |
| Read a draft | its author only |
| Create a post or comment | signed-in users |
| Edit or delete a post | its author |
| Delete a comment | the comment's author or the post's author |

Enforce these on the **server** with ownership filters, then hide buttons in the UI for convenience.

## Features

1. Home page with paginated published posts
2. Post page that renders Markdown **safely** (sanitise HTML) with comments
3. Editor with a draft/publish toggle and a live preview
4. Author profile page listing their posts
5. Slugs generated from titles, with uniqueness handled

## README

Write a README covering the features, the tech stack, setup steps, environment variables, a screenshot and the live URL. Treat it as part of the project, not an afterthought.

<!-- code: javascript | Author-only edit with a single query -->
```js
router.patch('/posts/:id', authenticate, validate(updatePostSchema), async (req, res) => {
  const post = await Post.findOneAndUpdate(
    { _id: req.params.id, author: req.user.id }, // not the author? nothing matches
    req.body, // already validated and stripped of author/slug fields
    { new: true, runValidators: true },
  );
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

router.delete('/comments/:id', authenticate, async (req, res) => {
  const comment = await Comment.findById(req.params.id).populate('post', 'author');
  if (!comment) return res.status(404).json({ message: 'Comment not found' });

  const isCommentAuthor = comment.author.equals(req.user.id);
  const isPostAuthor = comment.post.author.equals(req.user.id);
  if (!isCommentAuthor && !isPostAuthor) {
    return res.status(403).json({ message: 'You can only delete your own comments' });
  }
  await comment.deleteOne();
  res.status(204).end();
});
```

<!-- lesson: Environment Configuration and Builds -->

## Configuration belongs in the environment

Anything that changes between machines, or that is secret, belongs in **environment variables**, not in code: database URLs, JWT secrets, API keys, allowed origins and ports.

- Keep a `.env` file locally, and **never commit it**: add it to `.gitignore`.
- Commit a `.env.example` listing every variable with safe placeholder values.
- **Validate the environment at startup**, for example with zod, and crash immediately with a clear message if something is missing. That's far better than failing at 2 a.m. on the first request that needs it.

## Front-end variables are public

Vite exposes variables prefixed with `VITE_` to the browser bundle. **Anything in the bundle is public**, so never put secrets there. Prefer relative API URLs (`/api`) behind a proxy or rewrite over baking an API host into the build.

## Production builds

- `npm run build` creates optimised, minified static files in `dist/`.
- `npm run preview` serves the build locally. Test it before deploying.
- The server runs with `NODE_ENV=production`, which makes Express faster and hides error details.

## Cloud database

Create a free **MongoDB Atlas** cluster, add a database user with a strong password, allow your host's IP addresses (avoid `0.0.0.0/0` where you can), and copy the connection string into `MONGODB_URI`.

<!-- code: javascript | Validating the environment at startup -->
```js
// src/config/env.js
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().url(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;

// Start the server with:  node --env-file=.env src/server.js
```

<!-- link: Vite: Env variables and modes | https://vite.dev/guide/env-and-mode -->

<!-- lesson: Deploying Front End and Back End -->

## Two deployments

A MERN app usually deploys as two pieces:

- **Front end:** static files from `npm run build`, hosted on a static host or CDN such as Vercel, Netlify or Cloudflare Pages.
- **API:** a long-running Node process on a platform such as Render or Railway, or on a VPS.
- **Database:** MongoDB Atlas.

## Deploying the API

1. Push to GitHub, and connect the repository to the platform.
2. Set the build command (`npm install`) and the start command (`node src/server.js`).
3. Add the environment variables in the platform's dashboard: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, and the allowed client origin.
4. Make sure the server listens on `process.env.PORT`.
5. Add a `/health` endpoint, and point the platform's health check at it.

## Deploying the front end

Set the build command to `npm run build` and the output directory to `dist`. Single-page apps need a **fallback rewrite** so that refreshing `/courses/42` serves `index.html` instead of returning a 404.

## Connecting them

The simplest robust setup is a **rewrite**: the static host forwards `/api/*` to your API. The browser sees a single origin, so cookies stay first-party and you need no CORS setup. The alternative is calling the API origin directly, with CORS configured for exactly your front-end domain.

## After deploying

Test sign-up and login on the live site, check the browser console and network tab for errors, and watch the server logs.

<!-- code: json | vercel.json with an API rewrite and SPA fallback -->
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://my-api.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

<!-- link: Vercel: Rewrites | https://vercel.com/docs/rewrites -->

<!-- link: Render: Deploy a Node Express app | https://render.com/docs/deploy-node-express-app -->

<!-- lesson: Capstone Project -->

## Your project, your choice

The capstone is an **original** full-stack application that you design, build, deploy and present. Choose something you care about. Motivation carries you through the hard parts.

## Requirements

- Authentication with at least two roles, or clear per-user ownership
- At least three related data models
- Full CRUD with server-side validation and permission checks
- A responsive React front end with routing, forms, and loading, empty and error states
- Deployed and publicly reachable, with a seeded demo account
- A README with features, the tech stack, setup steps, environment variables and screenshots

## Milestones

1. **Proposal (week 1):** the problem, target users, the feature list (must-have vs nice-to-have), data models, the main endpoints and wireframes of key screens. Get it approved before coding.
2. **Back end (weeks 2–3):** models, auth, the API and tests for the permission rules.
3. **Front end (weeks 3–4):** screens wired to the API.
4. **Deploy (week 5):** live early, then iterate.
5. **Present (week 6):** a 10-minute demo plus Q&A.

## Presenting

Show the problem, a live demo of the main flow, one technical decision you're proud of (and its trade-offs), and what you'd do next. Be ready to explain any line of your code.

**Ideas:** a class attendance tracker, a recipe planner with shopping lists, a small-business inventory system, a peer code-review board, or a habit tracker with streaks.

<!-- code: text | Project proposal template -->
```text
PROJECT PROPOSAL

Name:            ______________________
Problem:         Who has the problem, and why does it matter?
Users and roles: e.g. member, organiser, admin

Must-have features (MVP):
  1.
  2.
  3.
Nice-to-have features:
  -

Data models (fields and relationships):
  User  { name, email, passwordHash, role }
  ...

Main API endpoints:
  POST /api/auth/login
  GET  /api/...

Screens (attach wireframes): login, dashboard, ...
Risks and unknowns:
Deployment plan:  front end -> ______  API -> ______  database -> MongoDB Atlas
```
