# Java Full-Stack Development: starter materials

Each lesson below becomes a set of study materials: the note, then each code example, then each link. See `server/src/seeds/materials.seed.js` for the format.

<!-- lesson: Setting Up the JDK and Your First Program -->

## The tools

- **JDK (Java Development Kit):** the compiler (`javac`), the runtime (`java`) and the standard library. Install a current **LTS** release, such as Java 21 or 25, from Adoptium (Eclipse Temurin) or Oracle.
- **IDE:** IntelliJ IDEA Community Edition is the most popular choice. VS Code with the Java extension pack also works.

Check the installation with `java -version` and `javac -version`.

## How Java runs

1. You write source code in `.java` files.
2. `javac` compiles it to **bytecode** in `.class` files. Bytecode isn't machine code for your CPU; it's for the **Java Virtual Machine**.
3. The **JVM** loads the bytecode, checks it, and runs it, compiling hot code to native machine code just in time (JIT).

That's the meaning of *"write once, run anywhere"*: the same `.class` files run on any operating system that has a JVM.

## Anatomy of a program

- Every piece of code lives inside a **class**. A public class must be in a file with the same name: `Hello` goes in `Hello.java`.
- The entry point is `public static void main(String[] args)`.
- Statements end with semicolons, and blocks use braces.
- `System.out.println` prints a line.

Since Java 11 you can run a single file directly with `java Hello.java`, which is handy for quick experiments.

<!-- code: java | Hello, Java | Run it with: java Hello.java Asha -->
```java
public class Hello {
    public static void main(String[] args) {
        String name = args.length > 0 ? args[0] : "world";
        System.out.println("Hello, " + name + "!");

        int year = java.time.Year.now().getValue();
        System.out.printf("Java %s says hi in %d%n", System.getProperty("java.version"), year);
    }
}
```

<!-- code: bash | Compile and run from the terminal -->
```bash
java -version          # check the JDK
javac Hello.java       # produces Hello.class (bytecode)
java Hello Asha        # runs the class on the JVM
java Hello.java Asha   # single-file shortcut: compile and run in one step
```

<!-- link: Dev.java: Getting started with Java | https://dev.java/learn/getting-started/ -->

<!-- lesson: Variables, Data Types and Operators -->

## Static typing

Java checks types at compile time: every variable has a declared type, and the compiler rejects mismatches before the program ever runs. `var` (Java 10+) lets the compiler *infer* the type of a local variable, but the type is still fixed.

## Primitive types

| Type | Size | Example |
| --- | --- | --- |
| `int` | 32-bit | `42` |
| `long` | 64-bit | `9_000_000_000L` |
| `double` | 64-bit floating point | `3.14` |
| `boolean` | true/false | `true` |
| `char` | one UTF-16 unit | `'A'` |

Also `byte`, `short` and `float`. Primitives hold values directly; everything else is an **object reference**.

## Casting

Widening (from `int` to `double`) is automatic. Narrowing needs an explicit cast and can lose data: `(int) 9.99` is `9`. Integer division truncates: `7 / 2` is `3`, while `7 / 2.0` is `3.5`. Never use `double` for money; use `BigDecimal`.

## Strings

`String` is an immutable object. Useful methods include `length()`, `charAt(i)`, `substring(a, b)`, `toUpperCase()`, `trim()`/`strip()`, `contains()`, `split()` and `String.format()`.

**Compare strings with `equals()`, never `==`.** `==` compares references, so two equal strings built at run time can still be `!=`.

## Operators

Arithmetic (`+ - * / %`), compound assignment (`+=`), increment (`++`), comparison (`< <= == !=`), logical (`&& || !`, which short-circuit) and the ternary `cond ? a : b`.

<!-- code: java | Types, casting and strings -->
```java
public class Types {
    public static void main(String[] args) {
        int apples = 7;
        int people = 2;
        System.out.println(apples / people);          // 3: integer division
        System.out.println((double) apples / people); // 3.5

        double price = 19.99;
        int rounded = (int) Math.round(price);        // 20
        long big = 3_000_000_000L;                    // needs the L suffix

        var greeting = "  Hello, Java  ";             // inferred as String
        String clean = greeting.strip();
        System.out.println(clean.toUpperCase());      // HELLO, JAVA
        System.out.println(clean.substring(7));       // Java

        String a = "java";
        String b = new String("java");
        System.out.println(a == b);       // false: different objects
        System.out.println(a.equals(b));  // true: same characters

        boolean canVote = 19 >= 18 && rounded > 0;
        System.out.println(canVote ? "Eligible" : "Not eligible");
        System.out.println(big + rounded);
    }
}
```

<!-- link: Dev.java: Primitive types | https://dev.java/learn/language-basics/primitive-types/ -->

<!-- lesson: Control Flow and Methods -->

## Decisions

- `if / else if / else` for general conditions.
- `switch` for one value against many constants. Modern **switch expressions** use arrows, have no fall-through, and return a value:

```java
String type = switch (day) {
    case SATURDAY, SUNDAY -> "weekend";
    default -> "weekday";
};
```

## Loops

- `for (int i = 0; i < n; i++)`: when you need the index
- **enhanced for** `for (String name : names)`: the cleanest way to visit every element
- `while` and `do { } while`: when the number of iterations is unknown
- `break` exits a loop, and `continue` skips to the next iteration

## Methods

A method has a return type (or `void`), a name, typed parameters and a body. Methods defined in the same class as `main` are `static` for now; you'll meet instance methods in the OOP module.

- Keep methods short, with one job each, and name them with verbs: `calculateTotal`.
- Java passes arguments **by value**. For objects, the value is a copy of the reference, so a method can change an object's contents but can't make the caller's variable point to a different object.
- **Overloading** means several methods with the same name and different parameter lists.

## Reading input

`Scanner` reads from the keyboard: `new Scanner(System.in)`, then `nextInt()`, `nextLine()` and so on. A classic pitfall: `nextInt()` leaves the newline behind, so a following `nextLine()` returns an empty string.

<!-- code: java | A grade calculator with methods and a loop -->
```java
import java.util.Scanner;

public class Grades {
    static String grade(int score) {
        if (score < 0 || score > 100) throw new IllegalArgumentException("Score must be 0-100");
        return switch (score / 10) {
            case 10, 9 -> "A";
            case 8 -> "B";
            case 7 -> "C";
            case 6 -> "D";
            default -> "F";
        };
    }

    static double average(int[] scores) {
        int sum = 0;
        for (int s : scores) sum += s;
        return scores.length == 0 ? 0 : (double) sum / scores.length;
    }

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        System.out.print("How many students? ");
        int count = in.nextInt();
        int[] scores = new int[count];

        for (int i = 0; i < count; i++) {
            System.out.print("Score for student " + (i + 1) + ": ");
            scores[i] = in.nextInt();
            System.out.println("  Grade: " + grade(scores[i]));
        }
        System.out.printf("Class average: %.1f%n", average(scores));
    }
}
```

<!-- link: Dev.java: Control flow statements | https://dev.java/learn/language-basics/controlling-flow/ -->

<!-- lesson: Classes, Objects and Constructors -->

## Classes and objects

A **class** is a blueprint: it defines **fields** (state) and **methods** (behaviour). An **object** is one instance, created with `new`. `new Student("Asha")` allocates memory, runs the constructor and returns a reference.

## Constructors

A constructor has the class's name and no return type. It sets up a valid object. You can overload constructors, and call one from another with `this(...)`. If you write no constructor, Java provides an empty default one.

`this` refers to the current object. It's needed when a parameter has the same name as a field: `this.name = name;`.

## Encapsulation

Hide the fields and expose behaviour:

- Make fields `private`.
- Provide methods that **enforce the rules**. For example, a `withdraw` method that refuses to overdraw is better than a public `setBalance` that accepts anything.
- Add getters only for what callers really need.

| Modifier | Visible to |
| --- | --- |
| `private` | the class itself |
| *(none)* | the same package |
| `protected` | the package plus subclasses |
| `public` | everyone |

## Records

For simple data carriers, a `record` (Java 16+) generates the constructor, accessors, `equals`, `hashCode` and `toString` for you: `record Point(int x, int y) {}`.

## static

`static` members belong to the **class**, not to each object, for example a counter of how many accounts exist, or utility methods like `Math.max`.

<!-- code: java | An encapsulated BankAccount -->
```java
public class BankAccount {
    private static int created = 0;

    private final String owner;
    private double balance;

    public BankAccount(String owner) {
        this(owner, 0);
    }

    public BankAccount(String owner, double openingBalance) {
        if (openingBalance < 0) throw new IllegalArgumentException("Opening balance cannot be negative");
        this.owner = owner;
        this.balance = openingBalance;
        created++;
    }

    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Deposit must be positive");
        balance += amount;
    }

    public boolean withdraw(double amount) {
        if (amount <= 0 || amount > balance) return false; // the rule lives here
        balance -= amount;
        return true;
    }

    public double getBalance() { return balance; }
    public String getOwner() { return owner; }
    public static int accountsCreated() { return created; }

    public static void main(String[] args) {
        BankAccount account = new BankAccount("Asha", 500);
        account.deposit(250);
        System.out.println(account.withdraw(1000)); // false
        System.out.println(account.getBalance());   // 750.0
        System.out.println(BankAccount.accountsCreated()); // 1
    }
}
```

<!-- link: Dev.java: Classes and objects | https://dev.java/learn/classes-objects/ -->

<!-- lesson: Inheritance and Polymorphism -->

## Inheritance

`class Manager extends Employee` makes `Manager` a **subclass**: it inherits `Employee`'s non-private fields and methods, and can add its own. Java has **single inheritance** for classes (one parent), and every class ultimately extends `Object`.

- `super(...)` calls the parent's constructor, and must be the first statement.
- `super.method()` calls the parent's version of an overridden method.

Use inheritance for a true **"is-a"** relationship (a Manager *is an* Employee). For "has-a" relationships, use composition, meaning a field.

## Overriding

A subclass can **override** a method to change its behaviour. Mark it with `@Override`, so the compiler catches typos in the signature. You can't reduce visibility, and `final` methods can't be overridden.

## Polymorphism

A variable of a parent type can refer to any subclass object:

```java
Employee e = new Manager("Ravi", 90000, 15000);
e.monthlyPay(); // runs Manager's version
```

The JVM picks the method from the **actual object's type at run time**. This is **dynamic dispatch**, or run-time polymorphism. It lets you write code against `Employee` that works for every kind of employee, including ones added later.

**Compile-time polymorphism** is method *overloading*: the compiler chooses between same-named methods based on the argument types.

## instanceof

Avoid checking types by hand when you can override a method instead. When you must check, use pattern matching: `if (e instanceof Manager m) { m.getBonus(); }`.

<!-- code: java | Employees and dynamic dispatch -->
```java
import java.util.List;

class Employee {
    protected final String name;
    protected final double salary;

    Employee(String name, double salary) {
        this.name = name;
        this.salary = salary;
    }

    double monthlyPay() { return salary / 12; }

    @Override
    public String toString() {
        return "%s earns %.2f per month".formatted(name, monthlyPay());
    }
}

class Manager extends Employee {
    private final double bonus;

    Manager(String name, double salary, double bonus) {
        super(name, salary);
        this.bonus = bonus;
    }

    @Override
    double monthlyPay() {
        return super.monthlyPay() + bonus / 12;
    }
}

public class Payroll {
    public static void main(String[] args) {
        List<Employee> staff = List.of(
            new Employee("Asha", 60000),
            new Manager("Ravi", 90000, 12000));

        double total = 0;
        for (Employee e : staff) {   // one loop, many behaviours
            System.out.println(e);
            total += e.monthlyPay();
        }
        System.out.printf("Monthly payroll: %.2f%n", total);
    }
}
```

<!-- link: Dev.java: Inheritance | https://dev.java/learn/inheritance/ -->

<!-- lesson: Abstraction and Interfaces -->

## Abstract classes

An `abstract` class can't be instantiated. It can hold fields, constructors and implemented methods, plus **abstract methods** with no body that subclasses must implement. Use one when related classes share state and code.

## Interfaces

An interface is a **contract**: a set of methods a class promises to provide. A class can implement **many** interfaces. Interfaces can also have `default` methods with bodies, and `static` helper methods.

```java
interface PaymentMethod {
    boolean pay(double amount);
}
```

## Which one?

| Question | Choose |
| --- | --- |
| Do unrelated classes need a common capability (`Comparable`, `Runnable`)? | interface |
| Do the classes share state and implementation? | abstract class |
| Do you need multiple inheritance of type? | interfaces |

Modern Java favours interfaces, combined with composition.

## Program to interfaces

Declare variables and parameters with the interface type: `List<String> names = new ArrayList<>();`. Your code then depends on *what* something does, not *how*, so you can swap implementations (say, a fake payment method in tests).

## SOLID, briefly

- **S**ingle responsibility: a class has one reason to change.
- **O**pen/closed: add behaviour with new classes, without editing old ones.
- **L**iskov substitution: subclasses must work wherever the parent is expected.
- **I**nterface segregation: keep interfaces small and focused.
- **D**ependency inversion: depend on abstractions. Spring's dependency injection is built on this.

<!-- code: java | A checkout that depends on an interface -->
```java
interface PaymentMethod {
    boolean pay(double amount);

    default String label() { return getClass().getSimpleName(); }
}

class CardPayment implements PaymentMethod {
    private final String last4;
    CardPayment(String last4) { this.last4 = last4; }

    public boolean pay(double amount) {
        System.out.printf("Charging %.2f to card ending %s%n", amount, last4);
        return true;
    }
}

class UpiPayment implements PaymentMethod {
    private final String upiId;
    UpiPayment(String upiId) { this.upiId = upiId; }

    public boolean pay(double amount) {
        System.out.printf("Requesting %.2f from %s%n", amount, upiId);
        return true;
    }
}

public class Checkout {
    private final PaymentMethod payment; // depends on the abstraction

    Checkout(PaymentMethod payment) { this.payment = payment; }

    void complete(double total) {
        if (payment.pay(total)) System.out.println("Paid with " + payment.label());
    }

    public static void main(String[] args) {
        new Checkout(new CardPayment("4242")).complete(499.00);
        new Checkout(new UpiPayment("asha@okbank")).complete(149.50);
    }
}
```

<!-- link: Dev.java: Interfaces | https://dev.java/learn/interfaces/ -->

<!-- lesson: Arrays and String Handling -->

## Arrays

An array has a **fixed size**, set when it's created, and holds elements of one type:

- `int[] scores = new int[5];` starts filled with defaults (`0`, `false` or `null`).
- `int[] primes = {2, 3, 5, 7};` uses an initializer.
- `scores.length` is a field, not a method.
- Indexes run from `0` to `length - 1`. Going outside that range throws `ArrayIndexOutOfBoundsException`.
- 2D arrays: `int[][] grid = new int[3][4];`

The `java.util.Arrays` class helps: `Arrays.sort(a)`, `Arrays.toString(a)`, `Arrays.fill(a, -1)`, `Arrays.copyOf(a, n)` and `Arrays.equals(a, b)`.

## Strings are immutable

Every "change" to a `String` creates a new object. Concatenating in a loop with `+=` therefore copies the whole string each time, which costs O(n²) for n pieces.

## StringBuilder

`StringBuilder` is a mutable buffer: `append` is cheap, then call `toString()` once at the end. Use it whenever you build a string in a loop. It also has `reverse()`, `insert()` and `deleteCharAt()`.

## Classic exercises

These come up in every interview and exam, so practise them:

- reverse a string; check whether it's a palindrome
- count vowels, or count the frequency of each character
- find the largest and second-largest elements of an array
- reverse an array in place with two indexes
- check whether two strings are anagrams (sort their characters, or count them)

`char` values are numbers underneath: `c - 'a'` gives a letter's position, which is useful for frequency arrays of size 26.

<!-- code: java | Palindromes, frequencies and StringBuilder -->
```java
import java.util.Arrays;

public class TextTools {
    static boolean isPalindrome(String text) {
        String s = text.toLowerCase().replaceAll("[^a-z0-9]", "");
        int i = 0, j = s.length() - 1;
        while (i < j) {
            if (s.charAt(i++) != s.charAt(j--)) return false;
        }
        return true;
    }

    static int[] letterCounts(String text) {
        int[] counts = new int[26];
        for (char c : text.toLowerCase().toCharArray()) {
            if (c >= 'a' && c <= 'z') counts[c - 'a']++;
        }
        return counts;
    }

    static String csv(int[] values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(values[i]);
        }
        return sb.toString();
    }

    public static void main(String[] args) {
        System.out.println(isPalindrome("A man, a plan, a canal: Panama")); // true
        System.out.println(letterCounts("Java")['a' - 'a']);              // 2
        int[] data = {5, 3, 9, 1};
        Arrays.sort(data);
        System.out.println(csv(data));                                     // 1,3,5,9
        System.out.println(new StringBuilder("stressed").reverse());       // desserts
    }
}
```

<!-- link: Dev.java: Strings | https://dev.java/learn/strings/ -->

<!-- lesson: Lists, Sets and Maps -->

## The Collections Framework

Collections grow and shrink as needed, unlike arrays. They hold **objects**, so primitives are boxed automatically (`int` becomes `Integer`). Program to the interfaces (`List`, `Set`, `Map`) and pick an implementation:

| Need | Use |
| --- | --- |
| Ordered list, fast access by index | `ArrayList` |
| Many inserts and removals at both ends | `ArrayDeque` (usually better than `LinkedList`) |
| Unique items, fast lookup | `HashSet` |
| Unique items, kept sorted | `TreeSet` |
| Key to value lookup | `HashMap` |
| Keys in insertion order | `LinkedHashMap` |
| Keys kept sorted | `TreeMap` |

`HashSet` and `HashMap` rely on `equals()` and `hashCode()`. If you override one, override both. Records do this for you.

## Iterating safely

Removing items inside a for-each loop throws `ConcurrentModificationException`. Use `list.removeIf(x -> ...)` or an explicit `Iterator` with `iterator.remove()`.

## Immutable collections

`List.of(...)`, `Set.of(...)` and `Map.of(...)` create unmodifiable collections. Changing them throws an exception, which makes them ideal for constants.

## Sorting

- **Comparable:** the "natural order", built into the class (`compareTo`).
- **Comparator:** any other order, created on the fly: `Comparator.comparing(Student::gpa).reversed().thenComparing(Student::name)`.

`list.sort(comparator)` sorts in place. Java's sort is stable.

<!-- code: java | Counting, deduplicating and sorting -->
```java
import java.util.*;

public class CollectionsDemo {
    record Student(String name, double gpa) {}

    public static void main(String[] args) {
        // Word frequencies with a map
        String text = "to be or not to be";
        Map<String, Integer> counts = new TreeMap<>(); // sorted by key
        for (String word : text.split(" ")) {
            counts.merge(word, 1, Integer::sum);
        }
        System.out.println(counts); // {be=2, not=1, or=1, to=2}

        // Unique values with a set
        Set<String> tags = new LinkedHashSet<>(List.of("java", "spring", "java", "sql"));
        System.out.println(tags); // [java, spring, sql]

        // Sorting with a comparator
        List<Student> students = new ArrayList<>(List.of(
            new Student("Ravi", 8.1), new Student("Asha", 9.2), new Student("Meera", 9.2)));
        students.sort(Comparator.comparingDouble(Student::gpa).reversed()
            .thenComparing(Student::name));
        students.forEach(s -> System.out.println(s.name() + " " + s.gpa()));

        // Safe removal
        students.removeIf(s -> s.gpa() < 8.5);
        System.out.println(students.size()); // 2
    }
}
```

<!-- link: Dev.java: The Collections Framework | https://dev.java/learn/api/collections-framework/ -->

<!-- lesson: Generics and the Stream API -->

## Generics

Generics let a class or method work with **any type, safely**. `List<String>` can only hold strings, so the compiler stops mistakes and you never need casts.

- Generic class: `class Box<T> { T value; }`
- Generic method: `static <T> T firstOrDefault(List<T> list, T fallback)`
- Bounded types: `<T extends Comparable<T>>` means "any T that can be compared".
- Wildcards in parameters: `List<? extends Number>` means you can read Numbers from it.

## Lambdas and method references

A **lambda** is a short anonymous function, `(a, b) -> a + b`, that implements a *functional interface* (an interface with one abstract method, such as `Comparator`, `Predicate`, `Function` or `Runnable`). A **method reference** is an even shorter form when a method already does the job: `String::length` or `System.out::println`.

## Streams

A stream processes a collection as a pipeline. It doesn't modify the source.

1. **Source:** `list.stream()`
2. **Intermediate operations** (lazy): `filter`, `map`, `sorted`, `distinct`, `limit`
3. **Terminal operation** (runs the pipeline): `toList()`, `collect(...)`, `count()`, `sum()`, `forEach`, `anyMatch`, `findFirst`

Collectors do the heavy lifting: `Collectors.groupingBy`, `joining`, `toMap` and `averagingDouble`.

Prefer streams for transformations, and plain loops when you need complex control flow or early exits with side effects. Readability wins.

<!-- code: java | Grouping and summarising orders with streams -->
```java
import java.util.*;
import java.util.stream.*;

public class StreamsDemo {
    record Order(String customer, String city, double total) {}

    static <T extends Comparable<T>> T max(List<T> items) {
        return items.stream().max(Comparator.naturalOrder()).orElseThrow();
    }

    public static void main(String[] args) {
        List<Order> orders = List.of(
            new Order("Asha", "Pune", 1200),
            new Order("Ravi", "Delhi", 450),
            new Order("Meera", "Pune", 300),
            new Order("Asha", "Pune", 800));

        double puneRevenue = orders.stream()
            .filter(o -> o.city().equals("Pune"))
            .mapToDouble(Order::total)
            .sum();                                     // 2300.0

        Map<String, Double> byCustomer = orders.stream()
            .collect(Collectors.groupingBy(Order::customer, TreeMap::new,
                     Collectors.summingDouble(Order::total)));

        String bigSpenders = orders.stream()
            .filter(o -> o.total() > 500)
            .map(Order::customer)
            .distinct()
            .sorted()
            .collect(Collectors.joining(", "));

        System.out.println(puneRevenue);
        System.out.println(byCustomer);   // {Asha=2000.0, Meera=300.0, Ravi=450.0}
        System.out.println(bigSpenders);  // Asha
        System.out.println(max(List.of(3, 9, 4))); // 9
    }
}
```

<!-- link: Dev.java: The Stream API | https://dev.java/learn/api/streams/ -->

<!-- lesson: Checked and Unchecked Exceptions -->

## What exceptions are for

An exception signals that something went wrong and the normal flow can't continue. Throwing it unwinds the call stack until a matching `catch` handles it. If nothing catches it, the program crashes and prints a stack trace.

## The hierarchy

- `Throwable`
  - `Error`: serious JVM problems (`OutOfMemoryError`). Don't catch these.
  - `Exception`
    - **Checked** exceptions (`IOException`, `SQLException`): recoverable conditions outside your control. The compiler **forces** you to catch them or declare them with `throws`.
    - `RuntimeException`, the **unchecked** exceptions (`NullPointerException`, `IllegalArgumentException`, `IndexOutOfBoundsException`): usually programming bugs. They don't need to be declared.

## try / catch / finally

- `try` holds the risky code.
- `catch` handles specific exception types. Order them from most to least specific, and catch several at once with `catch (IOException | SQLException e)`.
- `finally` always runs, whether or not an exception happened. It's for cleanup.

## try-with-resources

Anything that implements `AutoCloseable` (files, database connections, streams) can be declared in the `try (...)` header. Java closes it automatically, even when an exception is thrown, which replaces messy `finally` blocks. Use it every time you open a resource.

## Don't swallow exceptions

An empty `catch {}` hides bugs. At minimum, log the exception. Better still, handle it meaningfully or let it propagate.

<!-- code: java | Reading a file safely -->
```java
import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;

public class ReadScores {
    static int sumScores(Path file) throws IOException {
        int total = 0;
        try (BufferedReader reader = Files.newBufferedReader(file)) { // closed automatically
            String line;
            while ((line = reader.readLine()) != null) {
                try {
                    total += Integer.parseInt(line.trim());
                } catch (NumberFormatException e) {          // unchecked: bad data in one line
                    System.err.println("Skipping invalid line: " + line);
                }
            }
        }
        return total;
    }

    public static void main(String[] args) {
        Path file = Path.of(args.length > 0 ? args[0] : "scores.txt");
        try {
            System.out.println("Total: " + sumScores(file));
        } catch (NoSuchFileException e) {                    // most specific first
            System.err.println("File not found: " + file);
        } catch (IOException e) {                            // checked: must be handled
            System.err.println("Could not read file: " + e.getMessage());
        } finally {
            System.out.println("Done.");
        }
    }
}
```

<!-- link: Dev.java: Exceptions | https://dev.java/learn/exceptions/ -->

<!-- lesson: Custom Exceptions and Best Practices -->

## Why custom exceptions?

A well-named exception explains *what went wrong in your domain*: `InsufficientFundsException` says more than `RuntimeException("error")`. Callers can catch exactly the problems they know how to handle, and your API layer can map each one to the right HTTP status.

## Writing one

- Extend `RuntimeException` for most application errors, such as validation failures or a missing resource. Extend `Exception` only when callers genuinely *must* handle the case.
- Provide constructors that take a message and, when you wrap another exception, a **cause**.
- Add fields for useful context, such as the requested amount or the entity id.

## Throw, catch or rethrow?

- **Throw** when your method can't do what its name promises. Validate inputs early ("fail fast").
- **Catch** only where you can do something useful: retry, use a fallback, or show a message.
- **Wrap and rethrow** to translate low-level exceptions at layer boundaries: a DAO catches `SQLException` and throws `DataAccessException(cause)`. Always keep the cause, so the stack trace shows the root problem.

## Logging

- Log an exception **once**, where it's handled, not at every layer.
- Use a logger (SLF4J) rather than `printStackTrace()`, and pass the exception as the last argument so the stack trace is recorded.
- Never log passwords, tokens or full card numbers.

Don't use exceptions for normal control flow, such as ending a loop. They're for exceptional situations.

<!-- code: java | A domain exception with context -->
```java
class InsufficientFundsException extends RuntimeException {
    private final double requested;
    private final double available;

    InsufficientFundsException(double requested, double available) {
        super("Cannot withdraw %.2f; only %.2f available".formatted(requested, available));
        this.requested = requested;
        this.available = available;
    }

    double shortfall() { return requested - available; }
}

class Wallet {
    private double balance;

    Wallet(double balance) { this.balance = balance; }

    void withdraw(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Amount must be positive");
        if (amount > balance) throw new InsufficientFundsException(amount, balance);
        balance -= amount;
    }
}

public class WalletDemo {
    public static void main(String[] args) {
        Wallet wallet = new Wallet(100);
        try {
            wallet.withdraw(250);
        } catch (InsufficientFundsException e) {
            System.out.println(e.getMessage());
            System.out.printf("Top up at least %.2f%n", e.shortfall());
        }
    }
}
```

<!-- lesson: Relational Database Concepts -->

## Tables, rows and columns

A relational database stores data in **tables**. Each **row** is one record, and each **column** is one attribute with a fixed type (`INT`, `VARCHAR(100)`, `DATE`, `DECIMAL(10,2)`). Unlike a spreadsheet, the database enforces types and rules.

## Keys

- **Primary key (PK):** uniquely identifies each row, usually an auto-increment `id`. It's never null and never duplicated.
- **Foreign key (FK):** a column that references another table's primary key, such as `orders.customer_id` pointing at `customers.id`. The database refuses orphan rows.

## Relationships

- **One-to-many:** one customer has many orders. Put the FK on the "many" side (`orders.customer_id`).
- **Many-to-many:** students and courses. Use a **junction table** (`enrollments`) holding both foreign keys, plus any extra data such as `enrolled_on`.
- **One-to-one:** a user and their profile. An FK with a unique constraint. It's rarer than you'd think.

## Normalisation

Normalisation removes duplication, so each fact is stored once:

- **1NF:** each cell holds one value. No comma-separated lists.
- **2NF:** every non-key column depends on the *whole* key.
- **3NF:** non-key columns don't depend on other non-key columns. For example, don't store `customer_city` in `orders`.

Duplicated data drifts out of sync; normalised data stays consistent. Later, for performance, you might *deliberately* denormalise a little.

**Practice:** take a spreadsheet of "orders" with columns customer, email, product, price and quantity, and split it into `customers`, `products`, `orders` and `order_items`.

<!-- code: sql | A normalised schema for students and courses -->
```sql
CREATE TABLE students (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE courses (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(150) NOT NULL,
    fee        DECIMAL(10, 2) NOT NULL
);

-- Many-to-many: one row per student per course
CREATE TABLE enrollments (
    student_id  INT NOT NULL,
    course_id   INT NOT NULL,
    enrolled_on DATE NOT NULL,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (course_id)  REFERENCES courses(id)
);
```

<!-- link: MySQL: Tutorial | https://dev.mysql.com/doc/refman/8.4/en/tutorial.html -->

<!-- lesson: Connecting with JDBC -->

## What JDBC does

JDBC (Java Database Connectivity) is the standard API for talking to relational databases. Your code uses JDBC interfaces, and a **driver** for your database (the MySQL Connector/J or PostgreSQL JDBC jar) implements them. Spring Data JPA, later in the course, is built on top of JDBC.

## The steps

1. Add the driver dependency to Maven.
2. Get a `Connection` from `DriverManager.getConnection(url, user, password)`. In real apps, a connection *pool* such as HikariCP hands out connections instead.
3. Create a `PreparedStatement` with `?` placeholders.
4. Bind the parameters: `setString(1, ...)`, `setInt(2, ...)`.
5. Run `executeQuery()` for a SELECT (it returns a `ResultSet`) or `executeUpdate()` for INSERT, UPDATE and DELETE (it returns the number of affected rows).
6. Read rows with `while (rs.next())` and `rs.getString("name")`.
7. Close everything, using try-with-resources.

## SQL injection

**Never build SQL by concatenating user input.** `"... WHERE email = '" + email + "'"` lets a user type `' OR '1'='1` and change your query. `PreparedStatement` sends the parameters separately from the SQL, so input is always treated as data, never as code.

## Mapping rows to objects

Convert each `ResultSet` row into a Java object, such as a `record Student(int id, String name, String email)`, so the rest of your code never sees JDBC types.

Keep credentials in environment variables, not in source code.

<!-- code: java | Querying with a PreparedStatement -->
```java
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class StudentQueries {
    record Student(int id, String name, String email) {}

    private static final String URL = System.getenv().getOrDefault(
        "DB_URL", "jdbc:mysql://localhost:3306/school");

    static List<Student> findByCity(String city) throws SQLException {
        String sql = "SELECT id, name, email FROM students WHERE city = ? ORDER BY name";
        try (Connection conn = DriverManager.getConnection(
                 URL, System.getenv("DB_USER"), System.getenv("DB_PASSWORD"));
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, city);                    // bound as data: injection-safe
            try (ResultSet rs = stmt.executeQuery()) {
                List<Student> students = new ArrayList<>();
                while (rs.next()) {
                    students.add(new Student(rs.getInt("id"), rs.getString("name"),
                                             rs.getString("email")));
                }
                return students;
            }
        }
    }

    public static void main(String[] args) throws SQLException {
        findByCity("Pune").forEach(System.out::println);
    }
}
```

<!-- link: Oracle: JDBC basics tutorial | https://docs.oracle.com/javase/tutorial/jdbc/basics/index.html -->

<!-- lesson: Transactions and the DAO Pattern -->

## Transactions

A **transaction** groups several statements so they succeed or fail **together**. Transferring money means debiting one account *and* crediting another; if the second step fails, the first must be undone.

Transactions give you **ACID** guarantees:

- **Atomicity:** all of it happens, or none of it.
- **Consistency:** the constraints still hold afterwards.
- **Isolation:** concurrent transactions don't see each other's half-finished work.
- **Durability:** once committed, the change survives crashes.

In JDBC, connections auto-commit every statement by default. For a transaction:

1. `conn.setAutoCommit(false)`
2. run the statements
3. `conn.commit()` on success, or `conn.rollback()` in a catch block

## The DAO pattern

A **Data Access Object** hides all SQL for one entity behind an interface:

```java
interface StudentDao {
    Optional<Student> findById(int id);
    List<Student> findAll();
    Student save(Student s);
    void delete(int id);
}
```

The rest of the application calls `studentDao.findById(7)` and never sees a `ResultSet`. You can test business logic with a fake DAO and change the database without touching callers. Spring Data repositories are this same idea, automated.

## Handling SQLException

`SQLException` is checked and low-level. Catch it **inside the DAO**, roll back if needed, and rethrow a meaningful unchecked exception with the original as its cause.

<!-- code: java | A transfer inside a transaction -->
```java
import java.sql.*;

public class TransferService {
    private final String url;

    public TransferService(String url) { this.url = url; }

    public void transfer(int fromId, int toId, double amount) {
        String debit = "UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?";
        String credit = "UPDATE accounts SET balance = balance + ? WHERE id = ?";

        try (Connection conn = DriverManager.getConnection(url)) {
            conn.setAutoCommit(false);
            try (PreparedStatement d = conn.prepareStatement(debit);
                 PreparedStatement c = conn.prepareStatement(credit)) {
                d.setDouble(1, amount); d.setInt(2, fromId); d.setDouble(3, amount);
                if (d.executeUpdate() != 1) throw new IllegalStateException("Insufficient funds");

                c.setDouble(1, amount); c.setInt(2, toId);
                if (c.executeUpdate() != 1) throw new IllegalStateException("Unknown account " + toId);

                conn.commit();                       // both updates, or...
            } catch (SQLException | RuntimeException e) {
                conn.rollback();                     // ...neither
                throw e;
            }
        } catch (SQLException e) {
            throw new RuntimeException("Transfer failed", e); // keep the cause
        }
    }
}
```

<!-- lesson: SELECT, Filtering and Sorting -->

## The shape of a query

```sql
SELECT columns
FROM table
WHERE condition
ORDER BY column [ASC|DESC]
LIMIT n OFFSET m;
```

SQL is **declarative**: you describe *what* you want, and the database decides how to get it.

## Choosing columns

Name the columns you need instead of using `SELECT *`. It's clearer, faster, and won't break when someone adds a column. Rename output columns with aliases (`AS full_name`) and compute values in the select list (`price * quantity AS line_total`).

## Filtering with WHERE

- Comparison: `=`, `<>`, `<`, `>`, `<=`, `>=`
- Ranges: `BETWEEN 18 AND 25` (inclusive at both ends)
- Lists: `IN ('Pune', 'Mumbai')`
- Patterns: `LIKE 'A%'` (starts with A) and `LIKE '%son'`. `%` matches any run of characters and `_` matches exactly one.
- Combine conditions with `AND`, `OR` and `NOT`, and use parentheses to make the precedence explicit.

## NULL is special

`NULL` means *unknown*. Any comparison with it, even `NULL = NULL`, is unknown, not true. Use `IS NULL` and `IS NOT NULL`. `COALESCE(phone, 'n/a')` substitutes a default value.

## Sorting and limiting

`ORDER BY last_name, first_name` sorts by the first column, then breaks ties with the next. Add `DESC` for descending order. `LIMIT 10 OFFSET 20` gives the third page of ten. Without `ORDER BY`, the order of rows is **not guaranteed**.

<!-- code: sql | Everyday SELECT queries -->
```sql
-- Students from Pune or Mumbai, youngest first
SELECT name, city, age
FROM students
WHERE city IN ('Pune', 'Mumbai')
  AND age BETWEEN 18 AND 25
ORDER BY age, name;

-- Names starting with 'A', with a computed column
SELECT name, fee, fee * 0.9 AS discounted_fee
FROM courses
WHERE name LIKE 'A%';

-- Students without a phone number
SELECT name, COALESCE(phone, 'not provided') AS phone
FROM students
WHERE phone IS NULL;

-- Page 3 with 10 rows per page
SELECT id, title
FROM courses
ORDER BY title
LIMIT 10 OFFSET 20;
```

<!-- link: PostgreSQL tutorial: Querying a table | https://www.postgresql.org/docs/current/tutorial-select.html -->

<!-- lesson: Joins and Aggregation -->

## Joins

Normalised data is spread across tables. A **join** combines them through matching keys.

- `INNER JOIN`: only rows with a match on **both** sides.
- `LEFT JOIN`: **every** row from the left table, plus matching rows from the right, with `NULL`s where there is no match. Use it to find "customers with no orders" (`WHERE o.id IS NULL`).
- `RIGHT JOIN`: the mirror image of a left join. Most people rewrite it as a left join.
- `FULL OUTER JOIN`: all rows from both sides. MySQL doesn't support it directly.

Always give tables short aliases (`students s`) and qualify column names (`s.name`) once more than one table is involved.

## Aggregation

Aggregate functions summarise many rows: `COUNT(*)`, `COUNT(col)` (which skips NULLs), `SUM`, `AVG`, `MIN` and `MAX`.

`GROUP BY` produces one output row per group. Every selected column must either appear in the `GROUP BY` or be wrapped in an aggregate function.

## WHERE vs HAVING

- `WHERE` filters **rows** before grouping.
- `HAVING` filters **groups** after aggregation: `HAVING COUNT(*) > 5`.

## Logical order

The database evaluates a query in this order: `FROM` and joins, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`, `LIMIT`. That's why you can't use a `SELECT` alias inside `WHERE`.

<!-- code: sql | Joins and grouped reports -->
```sql
-- Each enrollment with student and course names
SELECT s.name, c.title, e.enrolled_on
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN courses  c ON c.id = e.course_id
ORDER BY e.enrolled_on DESC;

-- Students who haven't enrolled in anything
SELECT s.name
FROM students s
LEFT JOIN enrollments e ON e.student_id = s.id
WHERE e.student_id IS NULL;

-- Popular courses: enrollment count and revenue, only courses with 5+ students
SELECT c.title,
       COUNT(*)       AS students,
       SUM(c.fee)     AS revenue
FROM courses c
JOIN enrollments e ON e.course_id = c.id
GROUP BY c.id, c.title
HAVING COUNT(*) >= 5
ORDER BY students DESC;
```

<!-- link: PostgreSQL tutorial: Joins between tables | https://www.postgresql.org/docs/current/tutorial-join.html -->

<!-- lesson: DDL, Constraints and Indexes -->

## DDL: defining the schema

**Data Definition Language** statements create and change structure:

- `CREATE TABLE` with columns, types and constraints
- `ALTER TABLE` to add or modify columns and constraints: `ALTER TABLE students ADD COLUMN phone VARCHAR(20);`
- `DROP TABLE` removes a table and **all its data**. Be careful.

In real projects, schema changes go into versioned **migration** scripts, run with a tool such as Flyway or Liquibase, so every environment ends up with the same schema.

## Constraints protect your data

Let the database enforce the rules, because application code alone will eventually miss a case:

- `NOT NULL`: a value is required
- `UNIQUE`: no duplicates, for example emails
- `PRIMARY KEY`: NOT NULL + UNIQUE, and identifies the row
- `FOREIGN KEY ... REFERENCES`: no orphans. `ON DELETE CASCADE` deletes children along with their parent; use it deliberately.
- `CHECK (fee >= 0)`: any boolean rule
- `DEFAULT CURRENT_TIMESTAMP`: a value when none is given

## Indexes

An index is a sorted lookup structure (usually a B-tree) that lets the database find rows without scanning the whole table.

- Primary keys and unique constraints are indexed automatically.
- Add indexes on columns used in `WHERE`, `JOIN` and `ORDER BY` on large tables, and on foreign keys.
- A composite index `(city, age)` helps queries filtering by `city`, or by `city` and `age`, but not by `age` alone.
- Indexes cost disk space and slow down writes, so add the ones your queries need.

Use `EXPLAIN SELECT ...` to see whether a query uses an index.

<!-- code: sql | Constraints, a migration and an index -->
```sql
CREATE TABLE orders (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    total       DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- A later migration: add a column and make emails unique
ALTER TABLE customers ADD COLUMN phone VARCHAR(20);
ALTER TABLE customers ADD CONSTRAINT uq_customers_email UNIQUE (email);

-- Speed up "recent orders for a customer"
CREATE INDEX idx_orders_customer_created ON orders (customer_id, created_at);

EXPLAIN SELECT id, total FROM orders WHERE customer_id = 42 ORDER BY created_at DESC;
```

<!-- link: MySQL: CREATE INDEX | https://dev.mysql.com/doc/refman/8.4/en/create-index.html -->

<!-- lesson: HTML and CSS Essentials -->

## Why a Java developer needs HTML and CSS

Even as a back-end specialist, you'll build admin screens, read front-end code in reviews, and debug integration issues in the browser. This lesson is a fast tour; the MERN course covers each topic in depth.

## Semantic HTML

Structure the page with meaningful elements: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>` and `<footer>`. Use one `<h1>`, then headings in order. Give images `alt` text, and give every form input a `<label>`. Semantic markup is more accessible and easier to style.

## The box model

Every element is a box made of content, padding, border and margin. Start every stylesheet with `* { box-sizing: border-box; }` so that widths include padding and border.

## Layout

- **Flexbox:** one dimension, a row or a column. `display: flex; justify-content: space-between; align-items: center; gap: 1rem;`. Use it for navbars, toolbars and card rows.
- **Grid:** two dimensions. `display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));`. Use it for page frames and galleries.

## Responsive design

Add the viewport meta tag, write mobile-first CSS, and add `@media (min-width: 768px)` rules as the screen widens. Use relative units such as `rem` and `%`, and `max-width: 100%` for images.

## Browser DevTools

Inspect any element to see its box model and which CSS rules apply. The device toolbar simulates phones. This is the fastest way to learn CSS.

<!-- code: html | A responsive book catalogue page -->
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Library</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #1e293b; color: white; }
    main { padding: 1rem; }
    .books { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
    .book { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; }
    @media (min-width: 768px) { main { padding: 2rem; } }
  </style>
</head>
<body>
  <header>
    <h1>City Library</h1>
    <nav aria-label="Main"><a href="/books" style="color: white">Books</a></nav>
  </header>
  <main>
    <section class="books" aria-label="Books">
      <article class="book"><h2>Clean Code</h2><p>Robert C. Martin</p></article>
      <article class="book"><h2>Effective Java</h2><p>Joshua Bloch</p></article>
    </section>
  </main>
</body>
</html>
```

<!-- link: MDN: Learn web development | https://developer.mozilla.org/en-US/docs/Learn_web_development -->

<!-- lesson: JavaScript Essentials -->

## JavaScript for Java developers

The syntax looks familiar, but JavaScript is a different language:

- **Dynamic typing:** variables have no declared type. Declare them with `const` (the default) or `let`; avoid `var`.
- **Equality:** always use `===`, because `==` converts types.
- **Functions are values:** pass them around, return them, and store them in variables. Arrow functions `(a, b) => a + b` are everywhere.
- **Objects are flexible:** `{ title: 'Clean Code', year: 2008 }` works without a class. Destructuring (`const { title } = book`) and spread (`{ ...book, year: 2009 }`) are idiomatic.
- **Arrays** have stream-like methods built in: `map`, `filter`, `reduce`, `find` and `some`.

## The DOM and events

`document.querySelector('#search')` selects an element. `element.addEventListener('click', handler)` responds to events. Set content with `textContent` (safe) rather than `innerHTML` (an XSS risk with user data).

## Asynchronous code

The browser never blocks waiting for the network. Asynchronous work returns a **Promise**. Inside an `async` function, `await` pauses until the promise settles, and `try/catch` handles failures, much like checked exceptions but by convention rather than enforced by a compiler.

## Modules

Split code into files with `export` and `import`, and load the entry file with `<script type="module" src="app.js">`.

Run JavaScript in the browser console to experiment. It's the quickest REPL you have.

<!-- code: javascript | Filtering a book list as the user types -->
```js
const books = [
  { title: 'Clean Code', author: 'Robert C. Martin', year: 2008 },
  { title: 'Effective Java', author: 'Joshua Bloch', year: 2018 },
  { title: 'Head First Java', author: 'Kathy Sierra', year: 2022 },
];

const input = document.querySelector('#search');
const list = document.querySelector('#results');

function render(items) {
  list.replaceChildren(
    ...items.map(({ title, author, year }) => {
      const li = document.createElement('li');
      li.textContent = `${title} by ${author} (${year})`; // safe: not parsed as HTML
      return li;
    }),
  );
}

input.addEventListener('input', () => {
  const term = input.value.trim().toLowerCase();
  render(books.filter((b) => b.title.toLowerCase().includes(term)));
});

render(books);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function demo() {
  await sleep(500);
  console.log('Half a second later');
}
demo();
```

<!-- link: MDN: JavaScript guide | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide -->

<!-- lesson: Calling APIs with Fetch -->

## fetch

`fetch(url, options)` sends an HTTP request and returns a promise for a `Response`:

- `fetch` **does not reject on HTTP errors**. A `404` or `500` still resolves, so check `response.ok` yourself.
- Read the body with `await response.json()`, which is also a promise.
- To send JSON, set `method`, a `Content-Type: application/json` header, and `body: JSON.stringify(data)`.
- To call a secured API, add `Authorization: Bearer <token>`.

## Rendering API data

Map the JSON into DOM elements, setting text with `textContent`. Handle the three UI states every request has:

1. **Loading:** show a message or spinner, and disable buttons.
2. **Success:** render the data, or a friendly empty state.
3. **Error:** explain what happened and offer a retry.

## Talking to your Spring Boot API

When the page and the API are on different origins (say `localhost:5500` and `localhost:8080`), the browser enforces **CORS**. The API must allow the page's origin, which you'll configure in the Full-Stack Integration module. A development proxy avoids the issue entirely.

## Debugging

The **Network** tab shows every request: the URL, method, status, request and response headers, and the response body. When something fails, look there first, then at the server logs.

<!-- code: javascript | Loading and adding books with fetch -->
```js
const API = 'http://localhost:8080/api/books';
const status = document.querySelector('#status');
const list = document.querySelector('#books');

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body;
}

async function loadBooks() {
  status.textContent = 'Loading...';
  try {
    const books = await api(API);
    list.replaceChildren(...books.map((b) => Object.assign(document.createElement('li'), { textContent: b.title })));
    status.textContent = books.length ? '' : 'No books yet.';
  } catch (error) {
    status.textContent = `Could not load books: ${error.message}`;
  }
}

document.querySelector('#add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = event.target.elements.title.value;
  await api(API, { method: 'POST', body: JSON.stringify({ title }) });
  event.target.reset();
  loadBooks();
});

loadBooks();
```

<!-- link: MDN: Using the Fetch API | https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch -->

<!-- lesson: Spring Boot Project Setup -->

## What Spring Boot gives you

Spring is a large framework for building Java applications. **Spring Boot** makes it practical:

- **Starters:** one dependency pulls in a working set of libraries. `spring-boot-starter-web` brings Spring MVC, JSON support and an embedded Tomcat server.
- **Auto-configuration:** Boot looks at your classpath and configures sensible defaults. If it sees a database driver, it creates a `DataSource`.
- **An embedded server:** your app is a plain JAR that you run with `java -jar`. No separate application server is needed.

## Creating a project

Use **Spring Initializr** (start.spring.io, or your IDE's wizard): choose Maven, Java 21+, and dependencies such as *Spring Web*, *Validation*, *Spring Data JPA*, a database driver, and *Spring Boot DevTools*.

## Project structure

- `pom.xml`: dependencies and the build
- `src/main/java/.../Application.java`: the `@SpringBootApplication` class with `main`
- `src/main/resources/application.properties` (or `.yml`): configuration
- `src/test/java`: tests

Keep your packages *below* the application class's package, because component scanning starts there.

## Configuration

Set the port, database URL and logging levels in `application.properties` or `application.yml`. Read secrets from environment variables with placeholders like `${DB_PASSWORD}`, and use **profiles** (`application-dev.yml`) for per-environment settings.

Run the app with `./mvnw spring-boot:run`, or run `main` from the IDE.

<!-- code: java | The application class and a first endpoint -->
```java
package com.example.library;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class LibraryApplication {
    public static void main(String[] args) {
        SpringApplication.run(LibraryApplication.class, args);
    }
}

@RestController
class HealthController {
    @GetMapping("/api/health")
    String health() {
        return "OK";
    }
}
```

<!-- code: yaml | application.yml with environment placeholders -->
```yaml
server:
  port: 8080

spring:
  application:
    name: library
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/library}
    username: ${DB_USER:library}
    password: ${DB_PASSWORD}

logging:
  level:
    com.example.library: debug
```

<!-- link: Spring Initializr | https://start.spring.io/ -->

<!-- link: Spring Boot reference documentation | https://docs.spring.io/spring-boot/index.html -->

<!-- lesson: Dependency Injection and Beans -->

## Inversion of control

In plain Java, a class creates what it needs: `new EmailService()`. That ties the class to one implementation and makes testing hard. With **inversion of control (IoC)**, the class *declares* its dependencies, and a container creates and supplies them. In Spring, that container is the **ApplicationContext**, and the objects it manages are **beans**.

## Declaring beans

- Annotate classes with a stereotype: `@Component` (generic), `@Service` (business logic), `@Repository` (data access) or `@RestController` (web). Component scanning finds them.
- For third-party classes you can't annotate, write a `@Bean` method in a `@Configuration` class.

Beans are **singletons** by default: one shared instance per application, so keep them stateless.

## Injecting dependencies

Prefer **constructor injection**:

- The dependencies are explicit, and the fields can be `final`.
- The object is always fully initialised.
- Tests can call the constructor directly with fakes.

With a single constructor, `@Autowired` is optional. Avoid field injection (`@Autowired private Foo foo;`), which hides dependencies and needs reflection to test.

When several beans implement the same interface, choose one with `@Primary` or `@Qualifier("name")`.

## Configuration values

Inject simple settings with `@Value("${app.max-loans:3}")`. Group related settings into a typed class with `@ConfigurationProperties(prefix = "app")`, which is safer and easier to validate.

<!-- code: java | Constructor injection and typed configuration -->
```java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Service;

@ConfigurationProperties(prefix = "library")
record LibraryProperties(int maxLoans, int loanDays) {}
// application.yml:  library: { max-loans: 3, loan-days: 14 }
// Enable with @EnableConfigurationProperties(LibraryProperties.class) or @ConfigurationPropertiesScan

interface Notifier {
    void send(String to, String message);
}

@Service
class EmailNotifier implements Notifier {
    public void send(String to, String message) {
        System.out.println("Email to " + to + ": " + message);
    }
}

@Service
class LoanService {
    private final Notifier notifier;          // final: set once, never null
    private final LibraryProperties props;

    LoanService(Notifier notifier, LibraryProperties props) { // Spring injects both
        this.notifier = notifier;
        this.props = props;
    }

    void lend(String memberEmail, String title, int currentLoans) {
        if (currentLoans >= props.maxLoans()) {
            throw new IllegalStateException("Loan limit of " + props.maxLoans() + " reached");
        }
        notifier.send(memberEmail, "Enjoy \"" + title + "\". Return it within " + props.loanDays() + " days.");
    }
}

// In a unit test there's no Spring at all:
// var service = new LoanService((to, msg) -> {}, new LibraryProperties(3, 14));
```

<!-- link: Spring Framework: The IoC container | https://docs.spring.io/spring-framework/reference/core/beans.html -->

<!-- lesson: Layered Architecture -->

## Three layers

A Spring Boot API is usually organised into layers, each with one job:

1. **Web layer (controllers):** maps HTTP to Java. It parses requests, validates input, calls a service and returns a response. No business rules live here.
2. **Service layer:** the business rules. "A member can borrow at most three books." It is transactional, and it knows nothing about HTTP.
3. **Data layer (repositories):** reads and writes the database.

Dependencies point downwards only: controller to service to repository.

## DTOs

Don't expose JPA entities directly in your API. Use **Data Transfer Objects** (records are perfect):

- **Request DTOs** contain only the fields a client may send, which blocks *mass assignment* (a client setting `role` or `id`).
- **Response DTOs** control exactly what leaves the server, such as never a password hash, and decouple the API from your database schema.

Map between entities and DTOs in the service, or in a small mapper class.

## Packaging

Package **by feature** (`book/`, `member/`, `loan/`), each with its controller, service, repository and DTOs. It scales better than packaging by layer, because related code stays together.

## Testing the service layer

Services are plain classes with injected dependencies, so you can unit test them with **JUnit 5** and **Mockito**: mock the repository, call the service, and assert on the result and the interactions. These tests run in milliseconds without starting Spring.

<!-- code: java | A service with DTOs and a Mockito test -->
```java
// BookService.java
@Service
@Transactional
class BookService {
    private final BookRepository books;

    BookService(BookRepository books) { this.books = books; }

    BookResponse create(CreateBookRequest request) {
        if (books.existsByIsbn(request.isbn())) {
            throw new DuplicateIsbnException(request.isbn());
        }
        Book saved = books.save(new Book(request.title(), request.author(), request.isbn()));
        return new BookResponse(saved.getId(), saved.getTitle(), saved.getAuthor());
    }
}

record CreateBookRequest(String title, String author, String isbn) {}
record BookResponse(Long id, String title, String author) {}

// BookServiceTest.java
@ExtendWith(MockitoExtension.class)
class BookServiceTest {
    @Mock BookRepository books;
    @InjectMocks BookService service;

    @Test
    void rejectsDuplicateIsbn() {
        when(books.existsByIsbn("978-0134685991")).thenReturn(true);

        assertThrows(DuplicateIsbnException.class, () ->
            service.create(new CreateBookRequest("Effective Java", "Bloch", "978-0134685991")));
        verify(books, never()).save(any());
    }
}
```

<!-- link: Spring guide: Building a RESTful web service | https://spring.io/guides/gs/rest-service -->

<!-- lesson: Building REST Controllers -->

## @RestController

A class annotated `@RestController` handles HTTP requests, and its return values are serialised to JSON by Jackson. Put a shared prefix on the class with `@RequestMapping("/api/books")`, then map methods:

- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping`

## Reading the request

- `@PathVariable Long id` reads `/api/books/{id}`.
- `@RequestParam(defaultValue = "0") int page` reads `?page=2`. Use `required = false`, or `Optional`, for optional parameters.
- `@RequestBody CreateBookRequest body` turns JSON into a DTO.
- `@RequestHeader("Authorization") String auth` reads a header.

## Status codes

Return the right status, not 200 for everything:

- `201 Created` with a `Location` header for a new resource
- `204 No Content` after a delete
- `404 Not Found` when the id doesn't exist
- `400 Bad Request` for invalid input

`ResponseEntity<T>` gives you full control: `ResponseEntity.created(uri).body(dto)`, `ResponseEntity.noContent().build()` or `ResponseEntity.notFound().build()`. For simple cases, `@ResponseStatus(HttpStatus.CREATED)` on the method is enough.

## Keep controllers thin

A controller method should be a few lines: take the input, call the service, return the response. Business logic belongs in the service, where it can be tested without HTTP.

<!-- code: java | A CRUD controller for books -->
```java
@RestController
@RequestMapping("/api/books")
class BookController {
    private final BookService service;

    BookController(BookService service) { this.service = service; }

    @GetMapping
    List<BookResponse> list(@RequestParam(required = false) String author) {
        return service.findAll(author);
    }

    @GetMapping("/{id}")
    ResponseEntity<BookResponse> get(@PathVariable Long id) {
        return service.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    ResponseEntity<BookResponse> create(@RequestBody CreateBookRequest request) {
        BookResponse created = service.create(request);
        URI location = URI.create("/api/books/" + created.id());
        return ResponseEntity.created(location).body(created);   // 201 + Location
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
```

<!-- link: Spring Framework: Annotated controllers | https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller.html -->

<!-- lesson: Validation and Error Handling -->

## Bean Validation

Add `spring-boot-starter-validation`, then annotate DTO fields:

- `@NotNull`, `@NotBlank` (not null and not just whitespace), `@Size(min = 3, max = 120)`
- `@Email`, `@Pattern(regexp = "...")`
- `@Min`, `@Max`, `@Positive`, `@PastOrPresent`

Put `@Valid` on the `@RequestBody` parameter. Invalid input then never reaches your code: Spring throws `MethodArgumentNotValidException` instead.

## Centralised error handling

A `@RestControllerAdvice` class catches exceptions from **all** controllers in one place, using `@ExceptionHandler` methods:

- validation errors become `400`, with a list of field errors
- your `NotFoundException` becomes `404`
- conflicts such as a duplicate email become `409`
- anything unexpected becomes `500`, with a generic message. Log the details, but never send stack traces to clients.

## A consistent error shape

Pick one JSON shape for every error, so front-end code can handle errors generically. Spring supports the standard **Problem Details** format (RFC 9457) through the `ProblemDetail` class, or you can define a simple record:

```json
{ "status": 400, "message": "Validation failed",
  "errors": [{ "field": "title", "message": "must not be blank" }] }
```

Throw meaningful exceptions from services (`BookNotFoundException`) and let the advice translate them into HTTP. Services stay free of HTTP details.

<!-- code: java | Validated DTO and a controller advice -->
```java
record CreateBookRequest(
    @NotBlank @Size(max = 120) String title,
    @NotBlank String author,
    @Pattern(regexp = "^97[89]-?\\d{10}$", message = "must be a valid ISBN-13") String isbn,
    @Min(1450) @Max(2100) Integer year) {}

record FieldError(String field, String message) {}
record ErrorResponse(int status, String message, List<FieldError> errors) {}

@RestControllerAdvice
class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> invalid(MethodArgumentNotValidException ex) {
        List<FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> new FieldError(e.getField(), e.getDefaultMessage()))
            .toList();
        return ResponseEntity.badRequest().body(new ErrorResponse(400, "Validation failed", errors));
    }

    @ExceptionHandler(BookNotFoundException.class)
    ResponseEntity<ErrorResponse> notFound(BookNotFoundException ex) {
        return ResponseEntity.status(404).body(new ErrorResponse(404, ex.getMessage(), List.of()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception ex) {
        log.error("Unhandled error", ex);
        return ResponseEntity.status(500).body(new ErrorResponse(500, "Something went wrong", List.of()));
    }
}

// In the controller:  create(@Valid @RequestBody CreateBookRequest request)
```

<!-- link: Spring Boot: Validation | https://docs.spring.io/spring-boot/reference/io/validation.html -->

<!-- lesson: Testing and Documenting APIs -->

## Manual testing with Postman

**Postman** (or the IntelliJ HTTP Client, or curl) sends requests by hand. Organise requests into a **collection**, use **environment variables** for the base URL and token, and add simple test scripts that assert on status codes. Share the collection with your team.

## Automated controller tests with MockMvc

`@WebMvcTest(BookController.class)` starts **only the web layer**: the controller, JSON conversion and validation, without a database or services. You mock the service with `@MockitoBean`, then use `MockMvc` to perform requests and assert on:

- the status code (`status().isCreated()`)
- the JSON body (`jsonPath("$.title").value("Clean Code")`)
- headers (`header().exists("Location")`)

These tests are fast and catch mapping mistakes, missing validation and wrong status codes.

For end-to-end checks against a real database, use `@SpringBootTest` with **Testcontainers**, which starts a disposable PostgreSQL or MySQL in Docker.

## Documenting with OpenAPI

Add `springdoc-openapi-starter-webmvc-ui`, and your running API serves:

- `/v3/api-docs`: a machine-readable OpenAPI specification
- `/swagger-ui.html`: interactive documentation where anyone can try requests

Improve the generated docs with `@Operation(summary = "...")` and validation annotations, which springdoc picks up automatically. Good docs make your API usable by front-end developers without asking you questions.

<!-- code: java | A MockMvc test for the books controller -->
```java
@WebMvcTest(BookController.class)
class BookControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean BookService service;

    @Test
    void createsABook() throws Exception {
        when(service.create(any())).thenReturn(new BookResponse(7L, "Clean Code", "Robert C. Martin"));

        mvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title": "Clean Code", "author": "Robert C. Martin", "isbn": "978-0132350884"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/api/books/7"))
            .andExpect(jsonPath("$.title").value("Clean Code"));
    }

    @Test
    void rejectsABlankTitle() throws Exception {
        mvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\": \"\", \"author\": \"x\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("title"));
        verifyNoInteractions(service);
    }
}
```

<!-- link: springdoc-openapi | https://springdoc.org/ -->

<!-- lesson: Entities and Repositories -->

## JPA and Hibernate

**JPA** (Jakarta Persistence API) is the standard for mapping Java objects to relational tables, a technique called ORM. **Hibernate** is the implementation Spring Boot uses. You work with objects, and Hibernate writes the SQL.

## Entities

- `@Entity` marks a class as mapped to a table (`@Table(name = "books")` to choose the name).
- `@Id` with `@GeneratedValue(strategy = GenerationType.IDENTITY)` is an auto-increment primary key.
- `@Column(nullable = false, unique = true, length = 120)` sets column rules.
- `@Enumerated(EnumType.STRING)` stores enums as readable text. Never use `ORDINAL`.
- JPA needs a no-argument constructor, which can be `protected`.

Use classes, not records, for entities: Hibernate needs mutable objects and proxies.

## Repositories

Extend `JpaRepository<Book, Long>` and Spring generates the implementation at startup:

- `save`, `findById` (returns an `Optional`), `findAll`, `deleteById`, `count`, `existsById`
- **Derived queries:** the method name *is* the query:
  - `findByAuthor(String author)`
  - `findByTitleContainingIgnoreCase(String part)`
  - `existsByIsbn(String isbn)`
  - `findTop5ByOrderByCreatedAtDesc()`

## Schema management

`spring.jpa.hibernate.ddl-auto=update` is convenient while learning, but **never use it in production**. Real projects use migrations (Flyway), with `ddl-auto=validate`. Set `spring.jpa.show-sql=true` in development to see the generated SQL and learn what Hibernate does.

<!-- code: java | A Book entity and its repository -->
```java
@Entity
@Table(name = "books")
public class Book {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false)
    private String author;

    @Column(unique = true, length = 17)
    private String isbn;

    @Enumerated(EnumType.STRING)
    private Status status = Status.AVAILABLE;

    public enum Status { AVAILABLE, ON_LOAN, LOST }

    protected Book() {} // for JPA

    public Book(String title, String author, String isbn) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getAuthor() { return author; }
    public Status getStatus() { return status; }
    public void markOnLoan() { this.status = Status.ON_LOAN; }
}

public interface BookRepository extends JpaRepository<Book, Long> {
    List<Book> findByAuthorIgnoreCase(String author);
    List<Book> findByTitleContainingIgnoreCaseAndStatus(String part, Book.Status status);
    boolean existsByIsbn(String isbn);
}
```

<!-- link: Spring guide: Accessing data with JPA | https://spring.io/guides/gs/accessing-data-jpa -->

<!-- lesson: Entity Relationships -->

## Mapping associations

- `@ManyToOne` on the "many" side (each `Loan` belongs to one `Member`) holds the foreign key column, set with `@JoinColumn(name = "member_id")`.
- `@OneToMany(mappedBy = "member")` on the other side is the inverse view. `mappedBy` names the field that owns the relationship.
- `@ManyToMany` uses a join table. If the link carries data, such as an enrollment date, model the join table as its **own entity** with two `@ManyToOne` fields instead.

In a bidirectional relationship, keep both sides in sync with helper methods like `member.addLoan(loan)`.

## Fetch types

- `LAZY`: load the related data only when it's accessed. This is the default for `@OneToMany` and `@ManyToMany`, and **you should make `@ManyToOne` lazy too**.
- `EAGER`: always load it, which easily loads far more than needed.

Accessing a lazy relationship after the transaction has ended throws `LazyInitializationException`. Load what you need inside the service, and return DTOs.

## Cascade

`cascade = CascadeType.ALL` with `orphanRemoval = true` lets a parent manage children it owns, for example an order and its line items. Don't cascade into independent entities: deleting a loan must never delete the member.

## The N+1 problem

Loading 50 loans, then accessing each loan's book lazily, runs 1 + 50 queries. Fix it by fetching in one query: `JOIN FETCH` in JPQL, or `@EntityGraph(attributePaths = "book")` on the repository method. Enable SQL logging to spot it.

<!-- code: java | Members and loans without N+1 -->
```java
@Entity
public class Member {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Loan> loans = new ArrayList<>();

    public void addLoan(Loan loan) {   // keeps both sides in sync
        loans.add(loan);
        loan.setMember(this);
    }
}

@Entity
public class Loan {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id")
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id")
    private Book book;

    private LocalDate dueDate;

    void setMember(Member member) { this.member = member; }
}

public interface LoanRepository extends JpaRepository<Loan, Long> {
    // One query loads the loans with their books: no N+1
    @EntityGraph(attributePaths = "book")
    List<Loan> findByMemberIdAndDueDateBefore(Long memberId, LocalDate date);
}
```

<!-- link: Hibernate ORM user guide: Associations | https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html#associations -->

<!-- lesson: Custom Queries and Pagination -->

## @Query and JPQL

When a derived method name gets too long, write the query yourself with `@Query`. **JPQL** looks like SQL but uses **entity and field names**, not table and column names:

```java
@Query("select b from Book b where lower(b.author) = lower(:author) and b.status = :status")
List<Book> available(@Param("author") String author, @Param("status") Book.Status status);
```

Parameters are always bound, never concatenated, so these queries are injection-safe. Use `nativeQuery = true` only when you need database-specific SQL. Data-changing queries need `@Modifying` and a transaction.

## Pagination and sorting

Never load a whole table into memory. Accept a `Pageable` parameter:

- `PageRequest.of(page, size, Sort.by("title"))`
- The repository returns a `Page<T>` with `getContent()`, `getTotalElements()` and `getTotalPages()`.
- In a controller, Spring builds the `Pageable` from `?page=0&size=20&sort=title,asc` automatically.

Map the `Page<Entity>` to a `Page<Dto>` with `page.map(...)`, and cap the maximum page size so clients can't request a million rows.

## Projections

When a screen needs only a few columns, don't load full entities:

- **Interface projections:** declare an interface with getters (`String getTitle();`) and return it from a repository method.
- **DTO projections:** `select new com.example.BookSummary(b.id, b.title) from Book b`, or simply return a record type.

Projections reduce memory use, skip the persistence context, and make the query's purpose obvious.

<!-- code: java | Search with paging and a projection -->
```java
public interface BookRepository extends JpaRepository<Book, Long> {

    @Query("""
        select b from Book b
        where (:q is null or lower(b.title) like lower(concat('%', :q, '%')))
          and b.status = :status
        """)
    Page<Book> search(@Param("q") String q, @Param("status") Book.Status status, Pageable pageable);

    // Interface projection: only these two values are selected
    interface AuthorCount {
        String getAuthor();
        long getBooks();
    }

    @Query("select b.author as author, count(b) as books from Book b "
         + "group by b.author order by count(b) desc")
    List<AuthorCount> countByAuthor();
}

@RestController
@RequestMapping("/api/books")
class BookSearchController {
    private final BookRepository books;

    BookSearchController(BookRepository books) { this.books = books; }

    @GetMapping("/search")
    Page<BookResponse> search(@RequestParam(required = false) String q,
                              @PageableDefault(size = 20, sort = "title") Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(),
                Math.min(pageable.getPageSize(), 100), pageable.getSort());
        return books.search(q, Book.Status.AVAILABLE, capped)
                .map(b -> new BookResponse(b.getId(), b.getTitle(), b.getAuthor()));
    }
}
```

<!-- link: Spring Data JPA: Query methods | https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html -->

<!-- lesson: Spring Security Basics -->

## The filter chain

Spring Security runs as a chain of **servlet filters** in front of your controllers. Each request passes through them: filters authenticate the caller, check permissions, and add protections such as CSRF checks and security headers. Rejected requests never reach your code.

Adding `spring-boot-starter-security` secures **every** endpoint by default, with a generated password printed in the log. You then configure what you actually want.

## SecurityFilterChain

Define a `SecurityFilterChain` bean to configure:

- **Authorisation rules by path:** `requestMatchers("/api/auth/**").permitAll()`, `requestMatchers(HttpMethod.GET, "/api/books/**").authenticated()`, `anyRequest().hasRole("ADMIN")`. Rules are checked **in order**, so put specific ones first.
- **Session policy:** `STATELESS` for token-based APIs.
- **CSRF:** needed for cookie-based sessions. Stateless bearer-token APIs usually disable it.

## Users and passwords

- Implement `UserDetailsService` to load users from your database.
- Store passwords with a `PasswordEncoder`. Use `BCryptPasswordEncoder`, or `PasswordEncoderFactories.createDelegatingPasswordEncoder()`, which supports upgrading algorithms later.
- Never log or return password hashes.

## 401 vs 403

- **401 Unauthorized:** the caller isn't authenticated (no credentials, or bad ones).
- **403 Forbidden:** the caller is authenticated but not allowed to do this.

Test the security rules themselves: they are features, and regressions are serious.

<!-- code: java | A stateless security configuration -->
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtFilter) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())          // stateless bearer tokens, no cookies
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/v3/api-docs/**", "/swagger-ui/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/books/**").authenticated()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```

<!-- link: Spring Security reference | https://docs.spring.io/spring-security/reference/index.html -->

<!-- lesson: JWT Authentication -->

## Stateless authentication

With session cookies, the server remembers who is logged in. With **JWTs**, the server issues a signed token at login, and the client sends it on every request (`Authorization: Bearer <token>`). The server verifies the signature and expiry; no session storage is needed, so any instance of the API can handle any request.

## The flow

1. `POST /api/auth/login` with an email and password.
2. Authenticate with the `AuthenticationManager`, which checks the BCrypt hash.
3. Issue a JWT with `sub` (the user id or email), a role or authorities claim, `iat` and `exp`. Sign it with a secret key of at least 256 bits, loaded from an environment variable.
4. A filter extending `OncePerRequestFilter` reads the header on each request, validates the token, loads the user and sets the `SecurityContext`.

Libraries such as **jjwt** handle signing and parsing. Spring Security's OAuth2 **resource server** support can also validate JWTs for you, with very little code.

## Expiry and refresh

- Keep access tokens short-lived: 15 minutes is common.
- Use a longer-lived **refresh token** (stored hashed on the server, rotated on use, and sent in an httpOnly cookie) to get new access tokens without logging in again.
- On expiry the API returns `401`; the client refreshes and retries once.

## Pitfalls

- The payload is only Base64-encoded, so **anyone can read it**. Never put secrets in it.
- Reject tokens signed with the `none` algorithm, and pin the algorithm you expect.
- Re-check that the user still exists and is active when you load them in the filter.

<!-- code: java | A JWT filter with jjwt -->
```java
@Component
class JwtAuthFilter extends OncePerRequestFilter {
    private final SecretKey key;
    private final UserDetailsService users;

    JwtAuthFilter(@Value("${jwt.secret}") String secret, UserDetailsService users) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret)); // >= 256-bit secret
        this.users = users;
    }

    String issue(UserDetails user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getUsername())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(15, ChronoUnit.MINUTES)))
            .signWith(key)
            .compact();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            try {
                String email = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(header.substring(7)).getPayload().getSubject();
                UserDetails user = users.loadUserByUsername(email);
                if (user.isEnabled()) {
                    var auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (JwtException | UsernameNotFoundException e) {
                // Invalid or expired token: continue unauthenticated, and the chain returns 401
            }
        }
        chain.doFilter(req, res);
    }
}
```

<!-- link: jjwt on GitHub | https://github.com/jwtk/jjwt -->

<!-- lesson: Role-Based Access Control -->

## Roles and authorities

Spring Security represents permissions as **authorities** (strings). A **role** is an authority with the `ROLE_` prefix, so `hasRole("ADMIN")` checks for `ROLE_ADMIN`. Store roles on the user entity, as an enum or a table, and map them in your `UserDetails`.

Assign roles on the server only. A sign-up endpoint must **always** create a plain `MEMBER`, whatever the request body says.

## Where to check

- **URL rules** in the filter chain: coarse rules, such as everything under `/api/admin/**` requiring `ADMIN`.
- **Method security** with `@EnableMethodSecurity`, then `@PreAuthorize("hasRole('ADMIN')")` on service or controller methods. The rule sits right next to the code it protects.

## Ownership checks

Roles answer "what kind of user are you?" Most data, though, belongs to someone: "a member can see **their own** loans". Role checks can't express that. Enforce it in the service:

- Get the current user from the `Authentication`, never from a request parameter.
- Query with the owner in the filter: `loans.findByIdAndMemberId(id, currentUserId)`.
- Return `404` when the record isn't theirs, which doesn't reveal that it exists. A `403` is acceptable when existence isn't sensitive.

`@PreAuthorize` can also express ownership with SpEL (`#memberId == authentication.principal.id`), but explicit service checks are easier to test and harder to forget.

## Test the rules

Write tests with `@WithMockUser(roles = "MEMBER")` that assert members get `403` on admin endpoints and `404` on other members' data.

<!-- code: java | Method security plus ownership -->
```java
@Service
class LoanService {
    private final LoanRepository loans;

    LoanService(LoanRepository loans) { this.loans = loans; }

    @PreAuthorize("hasRole('ADMIN')")
    List<LoanResponse> allOverdue() {
        return loans.findByDueDateBefore(LocalDate.now()).stream().map(LoanResponse::from).toList();
    }

    // Members may only see their own loans; admins may see any.
    LoanResponse get(Long loanId, AppUser current) {
        Optional<Loan> loan = current.isAdmin()
            ? loans.findById(loanId)
            : loans.findByIdAndMemberId(loanId, current.getId());
        return loan.map(LoanResponse::from)
            .orElseThrow(() -> new NotFoundException("Loan not found")); // 404, not 403
    }
}

@RestController
@RequestMapping("/api/loans")
class LoanController {
    private final LoanService service;

    LoanController(LoanService service) { this.service = service; }

    @GetMapping("/{id}")
    LoanResponse get(@PathVariable Long id, @AuthenticationPrincipal AppUser current) {
        return service.get(id, current); // the user comes from the token, not the request
    }
}
```

<!-- link: Spring Security: Method security | https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html -->

<!-- lesson: CORS and API Integration -->

## Why CORS exists

Browsers enforce the **same-origin policy**: a page from `http://localhost:5173` can't read responses from `http://localhost:8080` unless the API explicitly allows that origin. **CORS** (Cross-Origin Resource Sharing) is how the API grants permission, with response headers such as `Access-Control-Allow-Origin`.

For requests with JSON bodies or `Authorization` headers, the browser first sends a **preflight** `OPTIONS` request to ask whether the real request is allowed.

CORS is a *browser* protection. It doesn't stop curl or Postman, so it is **not** an access-control mechanism for your API.

## Configuring Spring Boot

With Spring Security, configure CORS **on the security chain** (`http.cors(...)` plus a `CorsConfigurationSource` bean). Otherwise preflight requests are rejected before they reach your MVC configuration.

- List exact origins. Never use `*` together with credentials.
- Allow only the methods and headers you use.
- Keep the allowed origins in configuration, because development and production differ.

## Avoiding CORS entirely

Serve the front end and the API from **one origin**: a development proxy (Vite's `server.proxy`), or a production reverse proxy or host rewrite. This is often the simplest and most robust setup.

## Tokens in the browser

- Hold the short-lived access token **in memory**, not `localStorage`, which any injected script can read.
- Use an **httpOnly, Secure, SameSite** cookie for the refresh token.
- Attach `Authorization: Bearer <token>` in one place, an API helper or an interceptor, and handle a `401` by refreshing once and retrying.

<!-- code: java | CORS on the security filter chain -->
```java
@Configuration
class CorsConfig {

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") List<String> origins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins);                  // e.g. http://localhost:5173
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);                   // never with "*" origins
        config.setMaxAge(3600L);                            // cache preflight responses

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}

// In SecurityConfig.filterChain(...):
//   http.cors(Customizer.withDefaults())   // uses the bean above
//
// application.yml:
//   app.cors.allowed-origins: http://localhost:5173,https://library.example.com
```

<!-- link: MDN: Cross-Origin Resource Sharing (CORS) | https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS -->

<!-- lesson: Project: Library Management System -->

## What you'll build

A library system with two roles:

- **Members** browse and search the catalogue, borrow and return books, and see their own loans and due dates.
- **Librarians (admins)** manage books and members, see all loans, and view overdue reports.

## Design first

**Entities:** `Book` (title, author, isbn, totalCopies, availableCopies), `Member` (name, email, passwordHash, role), and `Loan` (member, book, borrowedOn, dueDate, returnedOn).

**Endpoints (examples):**

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/books?q=&page=&size=` and `GET /api/books/{id}`
- `POST /api/books`, `PUT /api/books/{id}`, `DELETE /api/books/{id}` (admin)
- `POST /api/loans` (borrow), `POST /api/loans/{id}/return`
- `GET /api/loans/me` and `GET /api/admin/loans/overdue`

**Screens:** login and register, the catalogue with search and paging, book details with a borrow button, "My loans", and admin pages for books and overdue loans.

## Business rules

1. A member can have at most three active loans.
2. A book can only be borrowed while `availableCopies > 0`. Decrement it in the **same transaction** as creating the loan.
3. Loans are due 14 days after borrowing.
4. Members only ever see their own loans.

## Milestones

1. Entities, repositories and Flyway migrations
2. Services with unit tests for the business rules
3. REST controllers with validation and error handling
4. Security: JWT authentication and role rules
5. The front end, with search and pagination
6. Seed data, a README and a demo

<!-- code: java | Borrowing a book in one transaction -->
```java
@Service
class BorrowService {
    private static final int MAX_ACTIVE_LOANS = 3;
    private final BookRepository books;
    private final LoanRepository loans;

    BorrowService(BookRepository books, LoanRepository loans) {
        this.books = books;
        this.loans = loans;
    }

    @Transactional
    LoanResponse borrow(Long bookId, Member member) {
        if (loans.countByMemberIdAndReturnedOnIsNull(member.getId()) >= MAX_ACTIVE_LOANS) {
            throw new BusinessRuleException("You can borrow at most " + MAX_ACTIVE_LOANS + " books at a time");
        }
        Book book = books.findByIdForUpdate(bookId)          // row lock: no double-booking
            .orElseThrow(() -> new NotFoundException("Book not found"));
        if (book.getAvailableCopies() == 0) {
            throw new BusinessRuleException("No copies of \"" + book.getTitle() + "\" are available");
        }
        book.decrementAvailable();                            // saved at commit

        Loan loan = loans.save(new Loan(member, book, LocalDate.now(), LocalDate.now().plusDays(14)));
        return LoanResponse.from(loan);
    }
}

// In BookRepository:
// @Lock(LockModeType.PESSIMISTIC_WRITE)
// @Query("select b from Book b where b.id = :id")
// Optional<Book> findByIdForUpdate(@Param("id") Long id);
```

<!-- lesson: Packaging and Deploying Spring Boot -->

## An executable JAR

`./mvnw clean package` runs the tests and builds `target/<name>.jar`, a **fat JAR** containing your code, all dependencies and the embedded Tomcat. Run it anywhere that has a JRE with `java -jar app.jar`. Use the Maven Wrapper (`mvnw`), so every machine builds with the same Maven version.

## Profiles and configuration

- Put common settings in `application.yml` and environment-specific ones in `application-dev.yml` and `application-prod.yml`.
- Activate a profile with `SPRING_PROFILES_ACTIVE=prod`.
- **Secrets come from environment variables**, never from committed files. Spring maps `SPRING_DATASOURCE_PASSWORD` to `spring.datasource.password` automatically.
- In production, set `ddl-auto=validate` and let Flyway own the schema.

## Deploying

Common options:

- **A PaaS** (Render, Railway, Fly.io, Heroku): connect the repository, set the build command (`./mvnw -DskipTests package`) and start command (`java -jar target/app.jar`), and add environment variables. Bind to the platform's port with `server.port=${PORT:8080}`.
- **Docker:** build an image and run it on any container host.
- **A managed database:** a hosted PostgreSQL or MySQL instance. Copy its JDBC URL and credentials into environment variables.

## Production checklist

- Add **Spring Boot Actuator**, and expose only `health` (and maybe `info`) publicly. Point the platform's health check at `/actuator/health`.
- Make logs useful: INFO level, no secrets.
- Lock CORS to your real front-end origin.
- Run the JVM with sensible memory limits for small instances.

<!-- code: bash | Build, run and containerise -->
```bash
./mvnw clean package                      # tests + target/library-0.0.1-SNAPSHOT.jar
java -jar target/library-0.0.1-SNAPSHOT.jar --spring.profiles.active=dev

# Production-style run: configuration only from the environment
export SPRING_PROFILES_ACTIVE=prod
export SPRING_DATASOURCE_URL=jdbc:postgresql://db.example.com:5432/library
export SPRING_DATASOURCE_USERNAME=library
export SPRING_DATASOURCE_PASSWORD='use-a-secret-manager'
java -XX:MaxRAMPercentage=75 -jar target/library-0.0.1-SNAPSHOT.jar

# Or build a container image with Spring Boot's buildpacks (no Dockerfile needed)
./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=library:latest
docker run -p 8080:8080 --env-file prod.env library:latest
```

<!-- link: Spring Boot: Deploying to the cloud | https://docs.spring.io/spring-boot/how-to/deployment/cloud.html -->

<!-- lesson: Capstone Project -->

## Your project

Design, build and deploy an **original** full-stack Java application: a Spring Boot API, a relational database, and a browser front end. Pick a domain you understand well, so you can focus on the engineering.

## Requirements

- JWT authentication with at least two roles, plus ownership rules
- At least four related entities, with at least one many-to-many relationship (or a join entity)
- Validation, consistent error responses and pagination
- A service layer with unit tests for the business rules, and MockMvc tests for key endpoints
- Flyway migrations and seed data with demo accounts
- OpenAPI documentation
- Deployed and reachable, with a README covering setup, the architecture, environment variables and screenshots

## Milestones

1. **Proposal:** problem, users and roles, features (MVP vs later), an entity diagram, the main endpoints and wireframes.
2. **Data and domain:** entities, migrations, repositories and services with tests.
3. **API and security:** controllers, validation, error handling, JWT and roles.
4. **Front end:** the main user flows.
5. **Deployment:** live as early as possible.
6. **Presentation:** a demo plus an architecture walkthrough.

## The presentation

Explain your architecture (layers, packages and the request flow), one trade-off you made and why (for example JPA versus a native query, or lazy versus eager loading), how you secured the API, and what you'd improve with more time. Expect questions about any part of your code.

**Ideas:** a clinic appointment system, an event ticketing service, a hostel or room booking app, an internship tracker, or a gym membership manager.

<!-- code: text | Entity and endpoint planning template -->
```text
ENTITIES
  User        (id, name, email, passwordHash, role)
  ...         (...)
  Relationships:
    User 1 --- * Booking
    Booking * --- 1 Room

ENDPOINTS
  Method  Path                         Role       Notes
  POST    /api/auth/login              public     returns JWT
  GET     /api/rooms?page=&size=       any        paginated
  POST    /api/bookings                MEMBER     rule: no overlapping bookings
  GET     /api/bookings/me             MEMBER     own bookings only
  GET     /api/admin/bookings          ADMIN

BUSINESS RULES
  1.
  2.

TESTS TO WRITE
  - Service: each business rule (pass and fail)
  - Controller: validation errors, 401/403/404 cases
```
