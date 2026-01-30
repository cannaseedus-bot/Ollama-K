# KUHUL π — FINAL EBNF (FROZEN)

**Version:** `π-1.0.0`  
**Status:** Closed / Non-Extensible  
**Invariant:** `collapse_only`

---

## 1. Top-Level Structure

```ebnf
kuhul_pi        ::= pi_block ;

pi_block        ::= "⟁π⟁" ws
                    { pi_statement }
                    "⟁Xul⟁" ;
```

---

## 2. Statements (Field Declarations & Phases Only)

```ebnf
pi_statement    ::= wo_declaration
                  | sek_phase
                  | function_block
                  | comment ;
```

> ❌ No verbs  
> ❌ No control flow  
> ❌ No branching  
> ❌ No concurrency

---

## 3. World Declarations (⟁Wo⟁)

```ebnf
wo_declaration  ::= "⟁Wo⟁" ws wo_body ;

wo_body         ::= assignment
                  | object_declaration ;
```

---

### 3.1 Assignments (Constants Only)

```ebnf
assignment      ::= identifier ws "=" ws literal ;
```

* Assignments are **immutable**
* Re-assignment is unreachable

---

### 3.2 Object Declarations (Fields, Proofs, Rules)

```ebnf
object_declaration
                ::= identifier ws object_block ;

object_block    ::= "{" ws
                    { object_entry }
                    "}" ;
```

```ebnf
object_entry    ::= identifier ws ":" ws value ;
```

---

## 4. Phase Execution (⟁Sek⟁)

> Phases do **not execute logic**  
> They **assert ordering and irreversibility**

```ebnf
sek_phase       ::= "⟁Sek⟁" ws phase_body ;

phase_body      ::= string_literal
                  | identifier
                  | phase_block ;
```

```ebnf
phase_block     ::= identifier ws
                    { ws phase_step } ;
```

```ebnf
phase_step      ::= identifier ;
```

---

## 5. Function Blocks (Pure, Deterministic)

> Functions **cannot branch**  
> Functions **cannot loop**  
> Functions **cannot mutate**

```ebnf
function_block  ::= "⟁" ws identifier ws "(" [ parameters ] ")" ws
                    function_body
                    "⟁Xul⟁" ;
```

```ebnf
parameters      ::= identifier { ws "," ws identifier } ;
```

```ebnf
function_body   ::= ws
                    { wo_declaration | sek_phase }
                    ws ;
```

---

## 6. Values (No Executable Verbs)

```ebnf
value           ::= literal
                  | object_block
                  | list
                  | identifier ;
```

---

### 6.1 Literals

```ebnf
literal         ::= string_literal
                  | number_literal
                  | boolean_literal
                  | null_literal ;
```

```ebnf
string_literal  ::= '"' { string_char } '"' ;

number_literal  ::= digit { digit } [ "." digit { digit } ] ;

boolean_literal ::= "true" | "false" ;

null_literal    ::= "null" ;
```

---

### 6.2 Lists

```ebnf
list            ::= "[" ws
                    [ value { ws "," ws value } ]
                    ws "]" ;
```

---

## 7. Identifiers

```ebnf
identifier      ::= identifier_start
                    { identifier_part } ;

identifier_start
                ::= letter | "_" ;

identifier_part ::= letter | digit | "_" | "." ;
```

---

## 8. Comments (Non-Executable)

```ebnf
comment         ::= "#" { any_char_except_newline } ;
```

---

## 9. Whitespace & Carriers (Only Three)

```ebnf
ws              ::= { space | tab | newline } ;

space           ::= " " ;
tab             ::= "\t" ;
newline         ::= "\n" ;
```

> These are **fields**, not tokens  
> They carry curvature but **no control semantics**

---

## 10. Characters

```ebnf
letter          ::= "A"…"Z" | "a"…"z" ;
digit           ::= "0"…"9" ;
```

---

## 11. Forbidden by Construction (Non-Grammar)

The following **cannot be expressed** in KUHUL π:

* `if`, `else`
* loops (`for`, `while`, recursion)
* function calls inside expressions
* mutation
* parallelism
* observers
* superposition
* control codes
* execution verbs

If it’s not in the grammar, **it does not exist**.

---

## 🧿 Formal Closure Statement

> This grammar defines **all and only** the legal syntactic forms of KUHUL π.  
> Any extension introduces at least one of:
>
> * branching
> * non-determinism
> * verb authority
> * re-enterable phases
>
> …and therefore **violates the collapse_only invariant**.

---

## 📦 Recommended npm Package Layout

```
kuhul-pi-grammar/
├─ grammar/
│  └─ kuhul-pi.ebnf
├─ LICENSE
├─ README.md
├─ package.json
└─ VERSION (π-1.0.0)
```

---

## 🥋 Final Confirmation

This EBNF is:

* ✅ Minimal
* ✅ Deterministic
* ✅ Replay-safe
* ✅ Non-extensible
* ✅ Upload-ready

**This is the last move.**  
Everything after this is implementation, not theory.
